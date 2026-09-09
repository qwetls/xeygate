/**
 * Public marketplace analytics tests (OpenRouter-style).
 *
 * Covers the aggregate read path: bare-model merging of the "alias/model" and
 * bare spellings request_logs carries, window filtering, endpoint attribution
 * (creator storefront name vs official provider name), unattributable-failure
 * row exclusion from supply-side pages, and the privacy guarantee that no
 * caller-identifying column reaches the public payload.
 *
 * Each test gets a fresh set of users (SEQUENCE-suffixed emails) and all
 * request_logs are wiped between tests so assertions on absolute counts
 * remain deterministic.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Hono } from "hono";
import { userAuthStore as store, upsertProviderDB, deleteProviderDB, db, type User } from "@srouter/db";
import { InvalidateOfficialCache } from "@/logic/official.logic.js";
import { AnalyticsRouter } from "@/routes/v1/analytics.js";

const TAG = crypto.randomUUID().slice(0, 8);
const HOUR = 3_600_000;
let SEQ = 0;

const app = new Hono();
app.route("/v1", AnalyticsRouter);

const trackedProviderIds: string[] = [];

afterEach(async () => {
    await db.prepare("DELETE FROM request_logs").run();
    for (const providerId of trackedProviderIds.splice(0)) {
        await deleteProviderDB(providerId).catch(() => {});
    }
    InvalidateOfficialCache();
});

interface LogSeed {
    providerId: string;
    model: string;
    statusCode: number;
    latencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
    cachedTokens?: number;
    totalTokens?: number;
    createdAt?: number;
    apiKeyId?: string;
    ipAddress?: string;
    userAgent?: string;
    estimatedCost?: number;
}

/**
 * Raw insert (rather than logRequestDB) so tests control created_at and can
 * plant caller-identifying columns that the public endpoints must not leak.
 * request_logs declares no foreign keys, so the planted api_key_id needs no
 * backing api_keys row.
 */
async function insertLog(seed: LogSeed): Promise<void> {
    const prompt = seed.promptTokens ?? 0;
    const completion = seed.completionTokens ?? 0;
    await db
        .prepare(
            `INSERT INTO request_logs (
                id, api_key_id, ip_address, user_agent, provider_id, model,
                prompt_tokens, completion_tokens, total_tokens, status_code,
                latency_ms, cached_tokens, cache_creation_tokens, reasoning_tokens,
                estimated_cost, fallback_occurred, fallback_path, fallback_reason,
                resolved_model, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            `log_${crypto.randomUUID()}`,
            seed.apiKeyId ?? null,
            seed.ipAddress ?? null,
            seed.userAgent ?? null,
            seed.providerId,
            seed.model,
            prompt,
            completion,
            seed.totalTokens ?? prompt + completion,
            seed.statusCode,
            seed.latencyMs,
            seed.cachedTokens ?? 0,
            0,
            0,
            seed.estimatedCost ?? 0,
            0,
            null,
            null,
            null,
            seed.createdAt ?? Date.now()
        );
}

async function trackProvider(config: Record<string, unknown>): Promise<void> {
    trackedProviderIds.push(config.id as string);
    await upsertProviderDB(config as never);
}

async function getJson(path: string): Promise<{ status: number; body: any }> {
    const res = await app.request(path);
    return { status: res.status, body: await res.json() };
}

/** Official (admin-account) + creator connections, each with a distinct alias. */
async function SeedSupply(): Promise<{ admin: User; creator: User }> {
    const ns = ++SEQ;
    const admin = (await store.createUser({
        email: `pa_admin_${ns}_${TAG}@test.local`,
        passwordHash: "x",
        name: "PA Admin",
        isAdmin: true
    }))!;
    const creator = (await store.createUser({
        email: `pa_creator_${ns}_${TAG}@test.local`,
        passwordHash: "x",
        name: "Papa Creator"
    }))!;

    await trackProvider({
        id: `anthropic-pa-${TAG}`,
        providerId: `anthropic-pa-${TAG}`,
        alias: "offpa",
        name: "XEYGATE Official PA",
        category: "api_key",
        protocol: "openai",
        baseUrl: "https://official-pa.local/v1",
        ownerId: admin.id,
        enabled: true
    });
    await trackProvider({
        id: `creatorpa-${TAG}`,
        providerId: `creatorpa-${TAG}`,
        alias: "crepa",
        name: "Creator PA Conn",
        category: "custom_provider",
        protocol: "openai",
        baseUrl: "https://creator-pa.local/v1",
        ownerId: creator.id,
        enabled: true
    });

    return { admin, creator };
}

const ALPHA = `pa-alpha-${TAG}`;
const BETA = `pa-beta-${TAG}`;

/**
 * ALPHA: three official successes ("offpa/ALPHA"), one creator success and one
 * creator error ("crepa/ALPHA"), plus one bare-form marketplace failure whose
 * provider_id the router logs as the model name itself because no listing won.
 * BETA: a single creator success three days back (outside the 24h window).
 *
 * Offpa/ALPHA is strictly the busiest spelling (3 vs 2 vs 1), so the merged
 * model's percentiles are deterministic: latencies 100/300/500 → p50=300, p95=500.
 */
async function SeedTraffic(): Promise<void> {
    await insertLog({
        providerId: "offpa",
        model: `offpa/${ALPHA}`,
        statusCode: 200,
        latencyMs: 100,
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        apiKeyId: "key-secret-1",
        ipAddress: "203.0.113.7",
        userAgent: `claude-cli/${TAG}`,
        estimatedCost: 0.5
    });
    await insertLog({
        providerId: "offpa",
        model: `offpa/${ALPHA}`,
        statusCode: 200,
        latencyMs: 300,
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
    });
    await insertLog({
        providerId: "offpa",
        model: `offpa/${ALPHA}`,
        statusCode: 200,
        latencyMs: 500,
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
    });
    await insertLog({
        providerId: "crepa",
        model: `crepa/${ALPHA}`,
        statusCode: 200,
        latencyMs: 200,
        promptTokens: 5,
        completionTokens: 10,
        cachedTokens: 5,
        totalTokens: 15
    });
    await insertLog({ providerId: "crepa", model: `crepa/${ALPHA}`, statusCode: 500, latencyMs: 900 });
    // Bare-form marketplace failure: the router has no winning connection, so it
    // logs the model name itself as provider_id. This row is real traffic but
    // not attributable supply — it must appear in model totals but NOT as an
    // endpoint or a provider count.
    await insertLog({ providerId: ALPHA, model: ALPHA, statusCode: 502, latencyMs: 50 });
    await insertLog({
        providerId: "crepa",
        model: `crepa/${BETA}`,
        statusCode: 200,
        latencyMs: 150,
        promptTokens: 8,
        completionTokens: 12,
        cachedTokens: 4,
        totalTokens: 20,
        createdAt: Date.now() - 72 * HOUR
    });
}

// ── Leaderboard ─────────────────────────────────────────────────────────

test("leaderboard merges the alias and bare spellings of one marketplace model", async () => {
    await SeedSupply();
    await SeedTraffic();

    const { status, body } = await getJson("/v1/analytics/models?window=24h&limit=50");
    assert.equal(status, 200);
    assert.equal(body.object, "marketplace.leaderboard");

    const alpha = body.models.find((m: { model: string }) => m.model === ALPHA);
    assert.ok(alpha, "ALPHA must appear once, not split across spellings");
    // 6 rows total: 3 offpa, 2 crepa, 1 bare failure — all merge to one bare key.
    assert.equal(alpha.totalRequests, 6, "3 official + 2 creator + 1 bare failure");
    assert.equal(alpha.totalErrors, 2, "1 creator 500 + 1 bare 502");
    assert.equal(alpha.successRate, 0.667, "4/6 = 0.667 rounded to 3dp");
    assert.equal(alpha.totalTokens, 105, "30+30+30+15 from the four token-bearing rows");
    assert.equal(alpha.promptTokens, 35, "10+10+10+5");
    assert.equal(alpha.completionTokens, 70, "20+20+20+10");
    assert.equal(alpha.cachedTokens, 5, "only the crepa success carries cached tokens");
    assert.equal(alpha.avgLatencyMs, 342, "2050ms summed latency over 6 requests");
    assert.equal(alpha.p50LatencyMs, 300, "dominant offpa/ALPHA [100,300,500] — rn 2 of 3");
    assert.equal(alpha.p95LatencyMs, 500, "dominant offpa/ALPHA [100,300,500] — rn 3 of 3");
    assert.equal(alpha.throughputTokensPerSec, 34.15, "70 / 2.05s");
    assert.equal(alpha.cacheHitRate, 0.125, "5 / (35+5)");
    assert.equal(alpha.providers, 2, "only offpa and crepa — the bare failure is not a supply endpoint");

    const split = body.models.filter(
        (m: { model: string }) => m.model === `offpa/${ALPHA}` || m.model === `crepa/${ALPHA}`
    );
    assert.equal(split.length, 0, "prefixed spellings must not leak into the leaderboard");
});

test("leaderboard honours the window", async () => {
    await SeedSupply();
    await SeedTraffic();

    const day = await getJson("/v1/analytics/models?window=24h&limit=50");
    assert.equal(
        day.body.models.find((m: { model: string }) => m.model === BETA),
        undefined,
        "a request three days back is outside 24h"
    );

    const week = await getJson("/v1/analytics/models?window=7d&limit=50");
    const beta = week.body.models.find((m: { model: string }) => m.model === BETA);
    assert.ok(beta, "the same request is inside the 7d window");
    assert.equal(beta.totalRequests, 1);
    assert.equal(beta.successRate, 1);
});

// ── Per-model page ──────────────────────────────────────────────────────

test("model page attributes traffic to the right storefront and flags official supply", async () => {
    await SeedSupply();
    await SeedTraffic();

    const { status, body } = await getJson(`/v1/analytics/models/${ALPHA}?window=24h`);
    assert.equal(status, 200);
    assert.equal(body.object, "marketplace.model.stats");
    assert.equal(body.model, ALPHA);

    // Totals include all 6 rows (the bare failure is real traffic).
    assert.equal(body.total.totalRequests, 6);
    assert.equal(body.total.p50LatencyMs, 300);
    assert.equal(body.total.p95LatencyMs, 500);

    // Only the two attributable connections appear as endpoints; the bare row
    // is excluded because its provider_id is the model name, not a connection.
    assert.equal(body.endpoints.length, 2);
    const official = body.endpoints.find((e: { alias: string }) => e.alias === "offpa");
    const creator = body.endpoints.find((e: { alias: string }) => e.alias === "crepa");
    assert.ok(official && creator, "both connections appear as endpoints");

    assert.equal(official.official, true);
    assert.equal(official.displayName, "XEYGATE Official PA", "official supply shows the provider name");
    assert.equal(official.providerId, `anthropic-pa-${TAG}`);
    assert.equal(official.totalRequests, 3);
    assert.equal(official.successRate, 1);

    assert.equal(creator.official, false);
    assert.equal(creator.displayName, "Papa Creator", "creator supply shows the account name");
    assert.equal(creator.providerId, `creatorpa-${TAG}`);
    assert.equal(creator.totalRequests, 2);
    assert.equal(creator.totalErrors, 1);
    assert.equal(creator.successRate, 0.5);

    assert.equal(body.series.length, 24, "24h window zero-fills 24 hourly buckets");
    assert.equal(
        body.series.reduce((sum: number, p: { requests: number }) => sum + p.requests, 0),
        6,
        "series covers all 6 ALPHA rows including the bare failure"
    );
});

test("a prefixed model id on the detail route resolves to the same bare aggregates", async () => {
    await SeedSupply();
    await SeedTraffic();

    const prefixed = await getJson(`/v1/analytics/models/offpa/${ALPHA}?window=24h`);
    const bare = await getJson(`/v1/analytics/models/${ALPHA}?window=24h`);
    assert.equal(prefixed.status, 200);
    assert.deepEqual(prefixed.body.total, bare.body.total);
});

test("unknown models answer 404 instead of an empty page", async () => {
    await SeedSupply();
    await SeedTraffic();

    const { status, body } = await getJson(`/v1/analytics/models/pa-nope-${TAG}?window=24h`);
    assert.equal(status, 404);
    assert.equal(body.error.code, "no_traffic");
});

// ── Supply-side page ────────────────────────────────────────────────────

test("endpoint stats count distinct bare models served per connection", async () => {
    await SeedSupply();
    await SeedTraffic();

    const day = await getJson("/v1/analytics/endpoints?window=24h");
    assert.equal(day.status, 200);
    assert.equal(day.body.object, "marketplace.provider.stats");

    const creator = day.body.providers.find((p: { alias: string }) => p.alias === "crepa");
    assert.ok(creator);
    assert.equal(creator.models, 1, "only ALPHA is within 24h; BETA is 72h ago");
    assert.equal(creator.totalRequests, 2);

    const official = day.body.providers.find((p: { alias: string }) => p.alias === "offpa");
    assert.equal(official.models, 1);
    assert.equal(official.totalRequests, 3);
    assert.equal(official.official, true);

    // The bare failure row (provider_id = model name) must NOT appear as an endpoint.
    const phantom = day.body.providers.find(
        (p: { providerId: string }) => p.providerId === ALPHA
    );
    assert.equal(phantom, undefined, "unattributable rows must not surface as supply endpoints");

    const week = await getJson("/v1/analytics/endpoints?window=7d");
    const creatorWeek = week.body.providers.find((p: { alias: string }) => p.alias === "crepa");
    assert.equal(creatorWeek.models, 2, "BETA joins the count once the window covers it");
});

// ── Overview ────────────────────────────────────────────────────────────

test("overview reports platform totals and a zero-filled series", async () => {
    await SeedSupply();
    await SeedTraffic();

    const { status, body } = await getJson("/v1/analytics/overview?window=24h&limit=5");
    assert.equal(status, 200);
    assert.equal(body.object, "marketplace.analytics.overview");
    assert.equal(body.totalRequests, 6);
    assert.equal(body.totalErrors, 2);
    assert.equal(body.successRate, 0.667);
    assert.equal(body.totalTokens, 105);
    assert.equal(body.models, 1);
    assert.equal(body.endpoints, 2, "only attributable endpoints — bare failure excluded");
    assert.equal(body.series.length, 24);
    assert.equal(
        body.series.reduce((sum: number, p: { requests: number }) => sum + p.requests, 0),
        6,
        "the plotted window accounts for every request in the window"
    );
    assert.equal(
        body.series.reduce((sum: number, p: { tokens: number }) => sum + p.tokens, 0),
        105,
        "the plotted window accounts for every token in the window"
    );
    assert.ok(
        body.series.slice(-2).some((p: { requests: number }) => p.requests > 0),
        "fresh traffic lands in the current bucket, not just historical ones"
    );
    assert.equal(body.topModels.length, 1);
    assert.equal(body.topModels[0].model, ALPHA);
    assert.equal(body.avgLatencyMs, 342);
    assert.equal(body.p95LatencyMs, 900, "global p95 over 6 rows: sorted [50,100,200,300,500,900]");
    assert.equal(body.cacheHitRate, 0.125);
});

test("public analytics payloads never carry caller-identifying data", async () => {
    await SeedSupply();
    await SeedTraffic();

    for (const path of [
        "/v1/analytics/overview?window=24h",
        "/v1/analytics/models?window=24h",
        `/v1/analytics/models/${ALPHA}?window=24h`,
        "/v1/analytics/endpoints?window=24h"
    ]) {
        const res = await app.request(path);
        assert.equal(res.status, 200, `${path} is served without authentication`);
        const text = await res.text();
        for (const secret of [
            "203.0.113.7",
            "key-secret-1",
            `claude-cli/${TAG}`,
            "estimated_cost",
            "estimatedCost"
        ]) {
            assert.ok(
                !text.includes(secret),
                `${path} must not expose '${secret}' to unauthenticated callers`
            );
        }
    }
});

// ── Validation ──────────────────────────────────────────────────────────

test("invalid window and limit are rejected with 400", async () => {
    const badWindow = await getJson("/v1/analytics/models?window=5m");
    assert.equal(badWindow.status, 400);
    assert.match(badWindow.body.error.message, /window/);

    const badLimit = await getJson("/v1/analytics/models?window=24h&limit=5000");
    assert.equal(badLimit.status, 400);

    const badOverview = await getJson("/v1/analytics/overview?window=bogus");
    assert.equal(badOverview.status, 400);

    const badEndpoints = await getJson("/v1/analytics/endpoints?window=bogus");
    assert.equal(badEndpoints.status, 400);
});

test("window defaults to 24h when omitted", async () => {
    await SeedSupply();
    await SeedTraffic();

    const { status, body } = await getJson("/v1/analytics/models");
    assert.equal(status, 200);
    assert.equal(body.window, "24h");
    assert.ok(body.models.find((m: { model: string }) => m.model === ALPHA));
});
