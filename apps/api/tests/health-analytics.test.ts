/**
 * Public marketplace health (uptime stripe) tests.
 *
 * Covers GET /v1/analytics/health: the 7-day per-model bucketed series that
 * powers the marketplace uptime stripes. Asserts bucket shape and alignment,
 * bare-key merging of alias/bare spellings, error attribution per bucket,
 * zero-fill of quiet slots, and the privacy guarantee that no caller-
 * identifying column reaches the unauthenticated payload.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Hono } from "hono";
import { userAuthStore as store, upsertProviderDB, deleteProviderDB, db, type User } from "@srouter/db";
import { InvalidateOfficialCache } from "@/logic/official.logic.js";
import { AnalyticsRouter } from "@/routes/v1/analytics.js";

const TAG = crypto.randomUUID().slice(0, 8);
const HOUR = 3_600_000;
const BUCKET = 6 * HOUR;
const BUCKET_COUNT = 28;
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
    createdAt?: number;
    apiKeyId?: string;
    ipAddress?: string;
    userAgent?: string;
}

async function insertLog(seed: LogSeed): Promise<void> {
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
            0,
            0,
            0,
            seed.statusCode,
            seed.latencyMs,
            0,
            0,
            0,
            0,
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

async function SeedSupply(): Promise<{ admin: User; creator: User }> {
    const ns = ++SEQ;
    const admin = (await store.createUser({
        email: `h_admin_${ns}_${TAG}@test.local`,
        passwordHash: "x",
        name: "Health Admin",
        isAdmin: true
    }))!;
    const creator = (await store.createUser({
        email: `h_creator_${ns}_${TAG}@test.local`,
        passwordHash: "x",
        name: "Health Creator"
    }))!;

    await trackProvider({
        id: `anthropic-h-${TAG}`,
        providerId: `anthropic-h-${TAG}`,
        alias: "offh",
        name: "XEYGATE Official H",
        category: "api_key",
        protocol: "openai",
        baseUrl: "https://official-h.local/v1",
        ownerId: admin.id,
        enabled: true
    });
    await trackProvider({
        id: `creatorh-${TAG}`,
        providerId: `creatorh-${TAG}`,
        alias: "creh",
        name: "Creator H Conn",
        category: "custom_provider",
        protocol: "openai",
        baseUrl: "https://creator-h.local/v1",
        ownerId: creator.id,
        enabled: true
    });

    return { admin, creator };
}

const ALPHA = `pa-halpha-${TAG}`;
const BETA = `pa-hbeta-${TAG}`;

/**
 * ALPHA: three successes in the current bucket (2 spellings merged) plus one
 * error three days ago. BETA: one success three days ago. All rows carry
 * planted caller-identifying columns that health must never expose.
 */
async function SeedTraffic(): Promise<void> {
    await insertLog({
        providerId: "offh",
        model: `offh/${ALPHA}`,
        statusCode: 200,
        latencyMs: 100,
        apiKeyId: "hkey-secret",
        ipAddress: "203.0.113.9",
        userAgent: `health-agent/${TAG}`
    });
    await insertLog({ providerId: "creh", model: `creh/${ALPHA}`, statusCode: 200, latencyMs: 200 });
    await insertLog({ providerId: ALPHA, model: ALPHA, statusCode: 500, latencyMs: 300 });
    await insertLog({
        providerId: "creh",
        model: `creh/${ALPHA}`,
        statusCode: 503,
        latencyMs: 900,
        createdAt: Date.now() - 72 * HOUR
    });
    await insertLog({
        providerId: "creh",
        model: `creh/${BETA}`,
        statusCode: 200,
        latencyMs: 150,
        createdAt: Date.now() - 72 * HOUR
    });
}

// ── Shape ───────────────────────────────────────────────────────────────

test("health returns 7d zero-filled series of 28 buckets per model", async () => {
    await SeedSupply();
    await SeedTraffic();

    const { status, body } = await getJson("/v1/analytics/health");
    assert.equal(status, 200);
    assert.equal(body.object, "marketplace.health");
    assert.equal(body.window, "7d");
    assert.equal(body.totalModels, 2);

    for (const entry of body.models) {
        assert.equal(entry.series.length, BUCKET_COUNT, "every model is zero-filled to 28 buckets");
        // Buckets are contiguous 6h slots.
        for (let i = 1; i < entry.series.length; i++) {
            assert.equal(
                entry.series[i].ts - entry.series[i - 1].ts,
                BUCKET,
                "buckets advance by 6h"
            );
        }
        // Last bucket aligns to the current time window.
        const end = Math.floor(Date.now() / BUCKET) * BUCKET;
        assert.equal(body.models[0].series[BUCKET_COUNT - 1].ts, end, "last bucket is now-aligned");
        const plotted = entry.series.reduce((s: number, b: { requests: number }) => s + b.requests, 0);
        assert.equal(
            plotted,
            entry.requests,
            "series buckets account for every request in the window"
        );
    }
});

test("health merges alias and bare spellings and attributes errors per bucket", async () => {
    await SeedSupply();
    await SeedTraffic();

    const { body } = await getJson("/v1/analytics/health");
    const alpha = body.models.find((m: { model: string }) => m.model === ALPHA);
    assert.ok(alpha, "ALPHA must appear once under its bare key");
    // 3 current-bucket rows (2 alias + 1 bare failure) + 1 error three days ago.
    assert.equal(alpha.requests, 4, "2 alias successes + 1 bare failure + 1 old error");
    assert.equal(alpha.errors, 2, "the bare 500 and the old 503");
    assert.equal(alpha.successRate, 0.5, "(4-2)/4");

    const nowBucket = Math.floor(Date.now() / BUCKET) * BUCKET;
    const current = alpha.series.find((b: { ts: number }) => b.ts === nowBucket);
    assert.ok(current, "current bucket present");
    assert.equal(current.requests, 3, "the three fresh rows land in the current bucket");
    assert.equal(current.errors, 1, "the bare 500 is an error");

    const oldBucket = Math.floor((Date.now() - 72 * HOUR) / BUCKET) * BUCKET;
    const old = alpha.series.find((b: { ts: number }) => b.ts === oldBucket);
    assert.ok(old, "the three-day-old bucket is present");
    assert.equal(old.requests, 1);
    assert.equal(old.errors, 1, "the old 503 is counted in its bucket");

    const beta = body.models.find((m: { model: string }) => m.model === BETA);
    assert.ok(beta);
    assert.equal(beta.requests, 1);
    assert.equal(beta.errors, 0);
    assert.equal(beta.successRate, 1);
});

test("quiet buckets are zero-filled so the strip can show them gray", async () => {
    await SeedSupply();
    await SeedTraffic();

    const { body } = await getJson("/v1/analytics/health");
    const alpha = body.models.find((m: { model: string }) => m.model === ALPHA);
    const quiet = alpha.series.filter((b: { requests: number }) => b.requests === 0);
    assert.ok(quiet.length > 0, "most of the 7d window is quiet for a fresh seed");
    for (const b of quiet) {
        assert.equal(b.requests, 0);
        assert.equal(b.errors, 0);
    }
});

test("models are ranked by traffic", async () => {
    await SeedSupply();
    await SeedTraffic();

    const { body } = await getJson("/v1/analytics/health");
    assert.equal(body.models[0].model, ALPHA, "busiest model first");
    assert.ok(body.models[0].requests >= body.models[1].requests);
});

// ── Empty marketplace ───────────────────────────────────────────────────

test("no traffic yields an empty health list, not an error", async () => {
    const { status, body } = await getJson("/v1/analytics/health");
    assert.equal(status, 200);
    assert.equal(body.totalModels, 0);
    assert.deepEqual(body.models, []);
});

// ── Privacy ─────────────────────────────────────────────────────────────

test("health payload never carries caller-identifying data", async () => {
    await SeedSupply();
    await SeedTraffic();

    const res = await app.request("/v1/analytics/health");
    assert.equal(res.status, 200, "served without authentication");
    const text = await res.text();
    for (const secret of ["203.0.113.9", "hkey-secret", `health-agent/${TAG}`, "estimatedCost", "ip_address"]) {
        assert.ok(!text.includes(secret), `health must not expose '${secret}'`);
    }
});
