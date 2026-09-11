import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Hono } from "hono";
import { db, userAuthStore, getUserTransactionsDB } from "@srouter/db";
import { UserAuthRouter } from "@/routes/v1/users.js";
import { hashUserPassword } from "@/services/userAuth.js";
import { GrantDailyLoginReward } from "@/services/dailyReward.js";

const DAY = 24 * 60 * 60 * 1000;
// Noon UTC so every +n*DAY hop lands squarely on the next calendar day.
const D0 = Date.UTC(2027, 0, 10, 12, 0, 0);
let seq = 0;

async function newAccount() {
    seq += 1;
    const email = `reward-test-${seq}@xeygate.test`;
    const user = await userAuthStore.createUser({
        email,
        passwordHash: hashUserPassword("reward-pass-123"),
        name: "Reward Test",
        status: "active"
    });
    assert.ok(user);
    return { id: user.id, email };
}

afterEach(async () => {
    await db
        .prepare("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@xeygate.test')")
        .run();
    await db
        .prepare("DELETE FROM login_rewards WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@xeygate.test')")
        .run();
    await db
        .prepare("DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@xeygate.test')")
        .run();
    await db.prepare("DELETE FROM users WHERE email LIKE '%@xeygate.test'").run();
});

test("seven consecutive logins pay six $8 days and a $10 finale", async () => {
    const { id } = await newAccount();
    const amounts: number[] = [];
    for (let i = 0; i < 7; i++) {
        const reward = await GrantDailyLoginReward(id, D0 + i * DAY);
        assert.equal(reward.awarded, true);
        assert.equal(reward.day, i + 1);
        amounts.push(reward.amount);
    }
    assert.deepEqual(amounts, [8, 8, 8, 8, 8, 8, 10]);
    assert.equal(await userAuthStore.getUserCredits(id), 58);

    const ledger = await getUserTransactionsDB(id, 50);
    assert.equal(ledger.length, 7);
    assert.ok(ledger.every((t) => t.type === "credit"));
    assert.ok(ledger.some((t) => t.description === "Daily login reward — day 7 of 7" && t.amount === 10));
});

test("extra logins on the same UTC day never double-credit", async () => {
    const { id } = await newAccount();
    const first = await GrantDailyLoginReward(id, D0);
    const second = await GrantDailyLoginReward(id, D0 + 60 * 60 * 1000);
    assert.equal(first.awarded, true);
    assert.equal(second.awarded, false);
    assert.equal(second.day, 1);
    assert.equal(second.amount, 0);
    assert.equal(second.credits, 8);
    assert.equal((await userAuthStore.getUserCredits(id)), 8);
});

test("skipping a day resets the streak back to day 1", async () => {
    const { id } = await newAccount();
    await GrantDailyLoginReward(id, D0);
    const afterGap = await GrantDailyLoginReward(id, D0 + 2 * DAY);
    assert.equal(afterGap.awarded, true);
    assert.equal(afterGap.day, 1);
    assert.equal(afterGap.amount, 8);
    assert.equal(await userAuthStore.getUserCredits(id), 16);
});

test("the cycle restarts the day after the $10 finale", async () => {
    const { id } = await newAccount();
    for (let i = 0; i < 7; i++) {
        await GrantDailyLoginReward(id, D0 + i * DAY);
    }
    const wrapped = await GrantDailyLoginReward(id, D0 + 7 * DAY);
    assert.equal(wrapped.awarded, true);
    assert.equal(wrapped.day, 1);
    assert.equal(wrapped.amount, 8);
    assert.equal(await userAuthStore.getUserCredits(id), 66);
});

test("POST /users/login reports the reward once per day and credits the wallet", async () => {
    const app = new Hono();
    app.route("/v1", UserAuthRouter);
    const { email } = await newAccount();

    const first = await app.request("/v1/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "reward-pass-123" })
    });
    assert.equal(first.status, 200);
    const body1 = (await first.json()) as { credits: number; dailyReward: unknown };
    assert.deepEqual(body1.dailyReward, { day: 1, amount: 8 });
    assert.equal(body1.credits, 8);

    const second = await app.request("/v1/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "reward-pass-123" })
    });
    const body2 = (await second.json()) as { credits: number; dailyReward: unknown };
    assert.equal(body2.dailyReward, null);
    assert.equal(body2.credits, 8);
});
