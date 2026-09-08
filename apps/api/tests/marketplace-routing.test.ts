import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
    userAuthStore as store,
    db,
    upsertProviderDB,
    createAPIKeyDB,
    getUserTransactionsDB,
    getCreatorEarningsDB,
    upsertModelPricingDB,
    deleteModelPricingDB,
    logRequestDB,
    getMarketplaceQualityDB,
    type User,
} from "@srouter/db";
import {
    ComputeQualityScore,
    BuildMarketplaceChain,
    type ScoredMarketplaceCandidate,
} from "@/logic/routing.logic.js";
import { settleMarketplaceUsage } from "@/logic/billing.logic.js";

// ── ComputeQualityScore ──────────────────────────────────────────────

test("ComputeQualityScore returns neutral for missing or low-sample stats", () => {
    assert.equal(ComputeQualityScore(undefined), 0.6);
    assert.equal(ComputeQualityScore({ samples: 4, successes: 4, successRate: 1, avgLatencyMs: 0 }), 0.6);
});

test("ComputeQualityScore weights success rate 0.7 and latency 0.3", () => {
    // Perfect: 100% success, 0ms latency.
    const perfect = ComputeQualityScore({ samples: 10, successes: 10, successRate: 1, avgLatencyMs: 0 });
    assert.equal(perfect, 1);

    // 100% success at 30s latency → 0.7*1 + 0.3*0 = 0.7.
    const slow = ComputeQualityScore({ samples: 10, successes: 10, successRate: 1, avgLatencyMs: 30_000 });
    assert.equal(slow, 0.7);

    // 50% success at 15s → 0.7*0.5 + 0.3*0.5 = 0.5.
    const mid = ComputeQualityScore({ samples: 10, successes: 5, successRate: 0.5, avgLatencyMs: 15_000 });
    assert.equal(mid, 0.5);

    // Clamped at zero for catastrophic stats.
    const bad = ComputeQualityScore({ samples: 10, successes: 0, successRate: 0, avgLatencyMs: 90_000 });
    assert.equal(bad, 0);
});

// ── BuildMarketplaceChain ────────────────────────────────────────────

function candidate(fullId: string, score: number, overrides: Partial<ScoredMarketplaceCandidate> = {}): ScoredMarketplaceCandidate {
    return { fullId, score, successRate: 1, samples: 100, healthy: true, ...overrides };
}

test("BuildMarketplaceChain picks deterministically with a fixed rng", () => {
    const cands = [candidate("a/model", 0.9), candidate("b/model", 0.5), candidate("c/model", 0.1)];
    assert.deepEqual(BuildMarketplaceChain(cands, () => 0), ["a/model", "b/model", "c/model"]);
    assert.deepEqual(BuildMarketplaceChain(cands, () => 0.999), ["c/model", "a/model", "b/model"]);
});

test("BuildMarketplaceChain floors zero-score providers so they stay pickable", () => {
    // Without a floor, c's weight would be 0 and the cumulative walk would
    // never reach it; the floor (0.15 * 0.9) keeps it eligible for primary.
    const cands = [candidate("a/model", 0.9), candidate("c/model", 0)];
    const chain = BuildMarketplaceChain(cands, () => 0.999);
    assert.equal(chain[0], "c/model");
});

test("BuildMarketplaceChain excludes low success-rate providers from primary when others exist", () => {
    const cands = [
        candidate("a/model", 0.9),
        candidate("bad/model", 0.8, { successRate: 0.2, samples: 50 }),
    ];
    // bad/ is excluded from the pool, so any rng picks a/.
    assert.equal(BuildMarketplaceChain(cands, () => 0.999)[0], "a/model");
});

test("BuildMarketplaceChain falls back to all candidates when none are healthy", () => {
    const cands = [
        candidate("a/model", 0.9, { healthy: false }),
        candidate("b/model", 0.5, { healthy: false }),
    ];
    const chain = BuildMarketplaceChain(cands, () => 0);
    assert.equal(chain[0], "a/model");
    assert.equal(chain.length, 2);
});

// ── getMarketplaceQualityDB ──────────────────────────────────────────

let seedTag: string;

beforeEach(async () => {
    seedTag = crypto.randomUUID().slice(0, 8);
});

test("getMarketplaceQualityDB aggregates by provider with bare and prefixed model matches", async () => {
    const bare = `qm-${seedTag}`;
    await logRequestDB({ providerId: "provA", model: bare, promptTokens: 1, completionTokens: 1, totalTokens: 2, statusCode: 200, latencyMs: 1000 });
    await logRequestDB({ providerId: "provA", model: `alias/${bare}`, promptTokens: 1, completionTokens: 1, totalTokens: 2, statusCode: 500, latencyMs: 3000 });
    await logRequestDB({ providerId: "provB", model: `creator/${bare}`, promptTokens: 1, completionTokens: 1, totalTokens: 2, statusCode: 200, latencyMs: 2000 });
    // Unrelated model must not pollute the aggregation.
    await logRequestDB({ providerId: "provA", model: "other-model", promptTokens: 1, completionTokens: 1, totalTokens: 2, statusCode: 200, latencyMs: 10 });

    const quality = await getMarketplaceQualityDB(bare);
    const a = quality.get("prova")!;
    assert.equal(a.samples, 2);
    assert.equal(a.successes, 1);
    assert.ok(Math.abs(a.successRate - 0.5) < 1e-9);
    assert.ok(Math.abs(a.avgLatencyMs - 2000) < 1e-9);

    const b = quality.get("provb")!;
    assert.equal(b.samples, 1);
    assert.equal(b.successRate, 1);
});

// ── settleMarketplaceUsage alias + bare-model resolution ─────────────

describeAliasSettle();

function describeAliasSettle() {
    let creator: User;
    let buyer: User;
    let providerId: string;
    let alias: string;

    beforeEach(async () => {
        const cId = `route_creator_${seedTag}`;
        creator = (await store.createUser({ email: `${cId}@test.local`, passwordHash: "x", name: "Route Creator" }))!;
        await store.updateRole(creator.id, "creator");
        creator = (await store.getUserById(creator.id))!;

        const bId = `route_buyer_${seedTag}`;
        buyer = (await store.createUser({ email: `${bId}@test.local`, passwordHash: "x", name: "Route Buyer" }))!;

        providerId = `route_prov_${seedTag}`;
        alias = `creator_${seedTag}`;
        await upsertProviderDB({
            id: providerId,
            providerId: `${providerId}_uuid`,
            alias,
            name: "Routing Test Provider",
            category: "openai",
            protocol: "openai",
            baseUrl: "https://route.local/v1",
            ownerId: creator.id,
            enabled: true,
        } as any);
    });

    test("settleMarketplaceUsage resolves provider by alias and strips model prefix for pricing", async () => {
        // Override is keyed by the canonical row id + BARE model.
        await upsertModelPricingDB({ providerId, model: "gpt-4o", input: 10, output: 30 });
        const key = await createAPIKeyDB({ name: "route-key" });
        await db.prepare("UPDATE api_keys SET user_id = ? WHERE id = ?").run(buyer.id, key.id);
        await store.updateCredits(buyer.id, 100);

        // Runtime logs store the ALIAS and the REWRITTEN model form.
        const breakdown = { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 };
        await settleMarketplaceUsage({
            apiKeyId: key.id,
            providerId: alias,
            model: `${alias}/gpt-4o`,
            amount: 7,
            breakdown,
        });

        // Override (10+30=40) must win over the static fallback (7), proving
        // both the alias→row resolution and the bare-model strip worked.
        const buyerAfter = await store.getUserCredits(buyer.id);
        assert.equal(buyerAfter, 60);

        const txns = await getUserTransactionsDB(buyer.id);
        assert.equal(txns[0].amount, 40);

        const earnings = await getCreatorEarningsDB(creator.id);
        assert.equal(earnings[0].grossAmount, 40);
        assert.equal(earnings[0].providerId, providerId);

        await deleteModelPricingDB(providerId, "gpt-4o");
    });
}
