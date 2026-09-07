import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
    userAuthStore as store,
    db,
    upsertProviderDB,
    deleteProviderDB,
    getProviderByIdDB,
    getUserTransactionsDB,
    getCreatorEarningsDB,
    getEarningsSummaryDB,
    createAPIKeyDB,
    deleteAPIKeyDB,
    type User
} from "@srouter/db";
import { settleMarketplaceUsage, PLATFORM_FEE_RATE } from "@/logic/billing.logic.js";

let creator: User;
let buyer: User;
let providerId: string;
const createdProviderIds: string[] = [];
const createdKeyIds: string[] = [];

beforeEach(async () => {
    const cId = `bill_creator_${crypto.randomUUID().slice(0, 8)}`;
    creator = (await store.createUser({
        email: `${cId}@test.local`,
        passwordHash: "x",
        name: "Billing Creator"
    }))!;
    await store.updateRole(creator.id, "creator");
    creator = (await store.getUserById(creator.id))!;

    const bId = `bill_buyer_${crypto.randomUUID().slice(0, 8)}`;
    buyer = (await store.createUser({
        email: `${bId}@test.local`,
        passwordHash: "x",
        name: "Billing Buyer"
    }))!;

    providerId = `bill_prov_${crypto.randomUUID().slice(0, 8)}`;
    createdProviderIds.push(providerId);
    await upsertProviderDB({
        providerId,
        name: "Billing Test Provider",
        category: "openai",
        protocol: "openai",
        baseUrl: "https://test.local/v1",
        models: ["test-model"],
        ownerId: creator.id,
        enabled: true
    });
});

test("settleMarketplaceUsage debits buyer and credits creator", async () => {
    const key = await createAPIKeyDB({ name: "bill-key" });
    createdKeyIds.push(key.id);
    // Link key to buyer
    await db.prepare("UPDATE api_keys SET user_id = ? WHERE id = ?").run(buyer.id, key.id);

    // Give buyer credits
    await store.updateCredits(buyer.id, 100);
    const buyerBefore = await store.getUserCredits(buyer.id);
    assert.equal(buyerBefore, 100);

    const amount = 10;
    await settleMarketplaceUsage({
        apiKeyId: key.id,
        providerId,
        model: "test-model",
        amount
    });

    // Buyer debited
    const buyerAfter = await store.getUserCredits(buyer.id);
    assert.equal(buyerAfter, 90);

    // Creator credited with net (amount - platform fee)
    const expectedNet = amount - Math.round(amount * PLATFORM_FEE_RATE * 1e6) / 1e6;
    const creatorAfter = await store.getUserCredits(creator.id);
    assert.equal(creatorAfter, expectedNet);

    // Transaction record exists for buyer
    const txns = await getUserTransactionsDB(buyer.id);
    assert.equal(txns.length, 1);
    assert.equal(txns[0].type, "debit");
    assert.equal(txns[0].amount, amount);
    assert.equal(txns[0].providerId, providerId);

    // Earning record exists for creator
    const earnings = await getCreatorEarningsDB(creator.id);
    assert.equal(earnings.length, 1);
    assert.equal(earnings[0].grossAmount, amount);
    assert.equal(earnings[0].netAmount, expectedNet);
    assert.equal(earnings[0].platformFee, Math.round(amount * PLATFORM_FEE_RATE * 1e6) / 1e6);
});

test("settleMarketplaceUsage is no-op for zero amount", async () => {
    const key = await createAPIKeyDB({ name: "zero-key" });
    createdKeyIds.push(key.id);
    await db.prepare("UPDATE api_keys SET user_id = ? WHERE id = ?").run(buyer.id, key.id);
    await store.updateCredits(buyer.id, 50);

    await settleMarketplaceUsage({
        apiKeyId: key.id,
        providerId,
        model: "test-model",
        amount: 0
    });

    const credits = await store.getUserCredits(buyer.id);
    assert.equal(credits, 50);
    const txns = await getUserTransactionsDB(buyer.id);
    assert.equal(txns.length, 0);
});

test("settleMarketplaceUsage floors buyer balance at 0", async () => {
    const key = await createAPIKeyDB({ name: "poor-key" });
    createdKeyIds.push(key.id);
    await db.prepare("UPDATE api_keys SET user_id = ? WHERE id = ?").run(buyer.id, key.id);
    await store.updateCredits(buyer.id, 3);

    await settleMarketplaceUsage({
        apiKeyId: key.id,
        providerId,
        model: "test-model",
        amount: 10
    });

    const credits = await store.getUserCredits(buyer.id);
    assert.equal(credits, 0);
});

test("settleMarketplaceUsage skips when API key has no user_id", async () => {
    const key = await createAPIKeyDB({ name: "orphan-key" });
    createdKeyIds.push(key.id);
    // No user_id set

    await settleMarketplaceUsage({
        apiKeyId: key.id,
        providerId,
        model: "test-model",
        amount: 10
    });

    // No transactions for anyone
    const buyerTxns = await getUserTransactionsDB(buyer.id);
    assert.equal(buyerTxns.length, 0);
    const creatorEarnings = await getCreatorEarningsDB(creator.id);
    assert.equal(creatorEarnings.length, 0);
});

test("settleMarketplaceUsage handles admin-owned provider (no creator)", async () => {
    const adminProvId = `admin_prov_${crypto.randomUUID().slice(0, 8)}`;
    createdProviderIds.push(adminProvId);
    await upsertProviderDB({
        providerId: adminProvId,
        name: "Admin Provider",
        category: "openai",
        protocol: "openai",
        baseUrl: "https://admin.local/v1",
        models: ["admin-model"],
        ownerId: null,
        enabled: true
    });

    const key = await createAPIKeyDB({ name: "admin-key" });
    createdKeyIds.push(key.id);
    await db.prepare("UPDATE api_keys SET user_id = ? WHERE id = ?").run(buyer.id, key.id);
    await store.updateCredits(buyer.id, 50);

    await settleMarketplaceUsage({
        apiKeyId: key.id,
        providerId: adminProvId,
        model: "admin-model",
        amount: 5
    });

    // Buyer debited
    const credits = await store.getUserCredits(buyer.id);
    assert.equal(credits, 45);

    // No creator earnings
    const earnings = await getCreatorEarningsDB(creator.id);
    assert.equal(earnings.length, 0);
});

test("getEarningsSummaryDB aggregates correctly", async () => {
    const key = await createAPIKeyDB({ name: "summary-key" });
    createdKeyIds.push(key.id);
    await db.prepare("UPDATE api_keys SET user_id = ? WHERE id = ?").run(buyer.id, key.id);
    await store.updateCredits(buyer.id, 100);

    // Two settlements
    await settleMarketplaceUsage({ apiKeyId: key.id, providerId, model: "m1", amount: 10 });
    await settleMarketplaceUsage({ apiKeyId: key.id, providerId, model: "m2", amount: 20 });

    const summary = await getEarningsSummaryDB(creator.id);
    assert.equal(summary.requestCount, 2);
    assert.equal(summary.totalGross, 30);
    assert.equal(summary.totalFees, Math.round(30 * PLATFORM_FEE_RATE * 1e6) / 1e6);
    assert.equal(summary.pendingAmount, summary.totalNet);
});
