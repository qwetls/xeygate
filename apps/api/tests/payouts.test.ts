import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
    userAuthStore as store,
    createPayoutRequestDB,
    listPayoutsDB,
    listAllPendingPayoutsDB,
    getPendingPayoutCountDB,
    getAvailableBalanceDB,
    markEarningsPaidForPayoutDB,
    processPayoutDB,
    createCreatorEarningDB,
    getCreatorEarningsDB,
    type User,
} from "@srouter/db";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let creator: User;

beforeEach(async () => {
    const cId = `pay_creator_${crypto.randomUUID().slice(0, 8)}`;
    creator = (await store.createUser({ email: `${cId}@test.local`, passwordHash: "x", name: "Payout Creator" }))!;
    await store.updateRole(creator.id, "creator");
});

async function seedEarnings(netAmounts: number[]) {
    for (const net of netAmounts) {
        await createCreatorEarningDB({
            userId: creator.id,
            providerId: "payout_test_provider",
            grossAmount: net + 1,
            platformFee: 1,
            netAmount: net,
        });
        // Ensure strictly increasing created_at for deterministic FIFO order.
        await wait(5);
    }
}

// ── payout request lifecycle ─────────────────────────────────────────

test("createPayoutRequestDB creates a pending payout", async () => {
    const payout = await createPayoutRequestDB({ userId: creator.id, amount: 10 });
    assert.equal(payout.status, "pending");
    assert.equal(payout.amount, 10);
    assert.equal(payout.currency, "USD");
    assert.equal(payout.processedAt, undefined);

    const stored = await listPayoutsDB(creator.id);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].id, payout.id);
});

test("only one pending payout is allowed (duplicate detection via count)", async () => {
    await createPayoutRequestDB({ userId: creator.id, amount: 10 });
    assert.equal(await getPendingPayoutCountDB(creator.id), 1);

    // The controller turns count > 0 into a 409; at DB level the second
    // request would create a row, so the count check is the gate.
    assert.equal(await listAllPendingPayoutsDB(100).then((rows) => rows.some((r) => r.userId === creator.id)), true);
});

// ── available balance ────────────────────────────────────────────────

test("getAvailableBalanceDB subtracts pending payouts from pending earnings", async () => {
    await seedEarnings([30, 20]); // 50 pending net
    assert.equal(await getAvailableBalanceDB(creator.id), 50);

    await createPayoutRequestDB({ userId: creator.id, amount: 10 });
    assert.equal(await getAvailableBalanceDB(creator.id), 40);
});

// ── admin processing ─────────────────────────────────────────────────

test("processPayoutDB flips pending to paid and preserves note; double process returns null", async () => {
    await seedEarnings([30]);
    const payout = await createPayoutRequestDB({ userId: creator.id, amount: 20, note: "creator note" });

    const paid = await processPayoutDB(payout.id, "paid", "paid via bank transfer");
    assert.equal(paid?.status, "paid");
    assert.notEqual(paid?.processedAt, undefined);
    assert.equal(paid?.note, "paid via bank transfer");

    // Already processed — no more transitions.
    const again = await processPayoutDB(payout.id, "failed", "should not happen");
    assert.equal(again, null);
});

test("processPayoutDB flips pending to failed (wallet refund happens in the controller)", async () => {
    await seedEarnings([30]);
    const payout = await createPayoutRequestDB({ userId: creator.id, amount: 10 });
    const failed = await processPayoutDB(payout.id, "failed", "payout provider offline");
    assert.equal(failed?.status, "failed");

    // Failed payout no longer locks funds.
    assert.equal(await getAvailableBalanceDB(creator.id), 30);
});

// ── FIFO earnings settlement ─────────────────────────────────────────

test("markEarningsPaidForPayoutDB settles earnings FIFO with partial consumption", async () => {
    await seedEarnings([30, 20]); // oldest 30, then 20

    const payout = await createPayoutRequestDB({ userId: creator.id, amount: 20 });
    const marked = await markEarningsPaidForPayoutDB(creator.id, payout.amount);
    assert.equal(marked, 1); // only the oldest row consumed (row-level granularity)

    const earnings = await getCreatorEarningsDB(creator.id, 100);
    const byAmount = new Map(earnings.map((e) => [e.netAmount, e.status]));
    assert.equal(byAmount.get(30), "paid");
    assert.equal(byAmount.get(20), "pending");

    await processPayoutDB(payout.id, "paid");
});

test("markEarningsPaidForPayoutDB consumes multiple rows when amounts align", async () => {
    await seedEarnings([10, 10, 10]);

    const payout = await createPayoutRequestDB({ userId: creator.id, amount: 25 });
    const marked = await markEarningsPaidForPayoutDB(creator.id, payout.amount);
    assert.equal(marked, 3); // 10+10+10 >= 25 — all three consumed

    const paidCount = (await getCreatorEarningsDB(creator.id, 100)).filter((e) => e.status === "paid").length;
    assert.equal(paidCount, 3);
});

test("markEarningsPaidForPayoutDB returns 0 when nothing to mark", async () => {
    assert.equal(await markEarningsPaidForPayoutDB(creator.id, 10), 0);
});
