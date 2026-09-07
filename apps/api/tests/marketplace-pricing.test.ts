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
    getModelPricingDB,
    listModelPricingDB,
    deleteModelPricingDB,
    type User,
} from "@srouter/db";
import { resolveMarketplacePrice, settleMarketplaceUsage, PLATFORM_FEE_RATE } from "@/logic/billing.logic.js";

let creator: User;
let buyer: User;
let providerId: string;

beforeEach(async () => {
    const cId = `price_creator_${crypto.randomUUID().slice(0, 8)}`;
    creator = (await store.createUser({ email: `${cId}@test.local`, passwordHash: "x", name: "Price Creator" }))!;
    await store.updateRole(creator.id, "creator");
    creator = (await store.getUserById(creator.id))!;

    const bId = `price_buyer_${crypto.randomUUID().slice(0, 8)}`;
    buyer = (await store.createUser({ email: `${bId}@test.local`, passwordHash: "x", name: "Price Buyer" }))!;

    providerId = `price_prov_${crypto.randomUUID().slice(0, 8)}`;
    await upsertProviderDB({
        id: providerId,
        providerId,
        name: "Pricing Test Provider",
        category: "openai",
        protocol: "openai",
        baseUrl: "https://price.local/v1",
        ownerId: creator.id,
        enabled: true,
    } as any);
});

// ── model_pricing DB CRUD ────────────────────────────────────────────

test("upsertModelPricingDB creates and getModelPricingDB returns it", async () => {
    await upsertModelPricingDB({ providerId, model: "gpt-4o", input: 3, output: 12 });
    const row = await getModelPricingDB(providerId, "gpt-4o");
    assert.notEqual(row, null);
    assert.equal(row!.input, 3);
    assert.equal(row!.output, 12);
    // cleanup
    await deleteModelPricingDB(providerId, "gpt-4o");
});

test("upsertModelPricingDB updates existing row", async () => {
    await upsertModelPricingDB({ providerId, model: "gpt-4o", input: 2, output: 8 });
    await upsertModelPricingDB({ providerId, model: "gpt-4o", input: 5, output: 15 });
    const row = await getModelPricingDB(providerId, "gpt-4o");
    assert.equal(row!.input, 5);
    assert.equal(row!.output, 15);
    await deleteModelPricingDB(providerId, "gpt-4o");
});

test("getModelPricingDB returns null when no override exists", async () => {
    const row = await getModelPricingDB(providerId, "no-such-model");
    assert.equal(row, null);
});

test("listModelPricingDB filters by provider", async () => {
    const otherProv = `other_${crypto.randomUUID().slice(0, 6)}`;
    await upsertModelPricingDB({ providerId, model: "gpt-4o", input: 1, output: 4 });
    await upsertModelPricingDB({ providerId: otherProv, model: "claude-3", input: 2, output: 10 });

    const onlyThisProvider = await listModelPricingDB(providerId);
    assert.ok(onlyThisProvider.some((r) => r.model === "gpt-4o"));
    assert.ok(!onlyThisProvider.some((r) => r.providerId === otherProv));

    const all = await listModelPricingDB();
    assert.ok(all.some((r) => r.providerId === otherProv));

    await deleteModelPricingDB(providerId, "gpt-4o");
    await deleteModelPricingDB(otherProv, "claude-3");
});

test("deleteModelPricingDB returns true when deleted, false otherwise", async () => {
    await upsertModelPricingDB({ providerId, model: "gpt-4o", input: 1, output: 1 });
    const deleted = await deleteModelPricingDB(providerId, "gpt-4o");
    assert.equal(deleted, true);
    const again = await deleteModelPricingDB(providerId, "gpt-4o");
    assert.equal(again, false);
});

// ── resolveMarketplacePrice ──────────────────────────────────────────

test("resolveMarketplacePrice returns fallback when no breakdown", async () => {
    await upsertModelPricingDB({ providerId, model: "gpt-4o", input: 100, output: 200 });
    const price = await resolveMarketplacePrice({ providerId, model: "gpt-4o", fallback: 7 });
    assert.equal(price, 7);
    await deleteModelPricingDB(providerId, "gpt-4o");
});

test("resolveMarketplacePrice returns fallback when no override for that model", async () => {
    const price = await resolveMarketplacePrice({
        providerId,
        model: "no-override-model",
        fallback: 7,
        breakdown: { prompt_tokens: 1000, completion_tokens: 500 },
    });
    assert.equal(price, 7);
});

test("resolveMarketplacePrice recomputes with admin override when breakdown is provided", async () => {
    // Override: $10 per 1M input, $30 per 1M output.
    await upsertModelPricingDB({ providerId, model: "gpt-4o", input: 10, output: 30 });
    const price = await resolveMarketplacePrice({
        providerId,
        model: "gpt-4o",
        fallback: 999,
        breakdown: { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 },
    });
    // 10 * 1 + 30 * 1 = 40
    assert.equal(price, 40);
    await deleteModelPricingDB(providerId, "gpt-4o");
});

// ── settleMarketplaceUsage with override ─────────────────────────────

test("settleMarketplaceUsage charges admin override when breakdown is provided", async () => {
    await upsertModelPricingDB({ providerId, model: "gpt-4o", input: 10, output: 30 });
    const key = await createAPIKeyDB({ name: "price-key" });
    await db.prepare("UPDATE api_keys SET user_id = ? WHERE id = ?").run(buyer.id, key.id);
    await store.updateCredits(buyer.id, 100);

    const breakdown = { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 };
    const fallbackAmount = 7;
    await settleMarketplaceUsage({ apiKeyId: key.id, providerId, model: "gpt-4o", amount: fallbackAmount, breakdown });

    // Override price is 40, so buyer is debited 40.
    const buyerAfter = await store.getUserCredits(buyer.id);
    assert.equal(buyerAfter, 60);

    const txns = await getUserTransactionsDB(buyer.id);
    assert.equal(txns[0].amount, 40);

    const earnings = await getCreatorEarningsDB(creator.id);
    assert.equal(earnings[0].grossAmount, 40);
    assert.equal(earnings[0].platformFee, Math.round(40 * PLATFORM_FEE_RATE * 1e6) / 1e6);

    await deleteModelPricingDB(providerId, "gpt-4o");
});

test("settleMarketplaceUsage falls back to static amount when no override for that model", async () => {
    const key = await createAPIKeyDB({ name: "no-override-key" });
    await db.prepare("UPDATE api_keys SET user_id = ? WHERE id = ?").run(buyer.id, key.id);
    await store.updateCredits(buyer.id, 100);

    const breakdown = { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 };
    await settleMarketplaceUsage({ apiKeyId: key.id, providerId, model: "no-override-model", amount: 7, breakdown });

    const buyerAfter = await store.getUserCredits(buyer.id);
    assert.equal(buyerAfter, 93);
    const txns = await getUserTransactionsDB(buyer.id);
    assert.equal(txns[0].amount, 7);
});
