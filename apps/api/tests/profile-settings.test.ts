import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Hono } from "hono";
import { db, userAuthStore } from "@srouter/db";
import { UserAuthRouter } from "@/routes/v1/users.js";
import { hashUserPassword, createUserSession, USER_SESSION_COOKIE } from "@/services/userAuth.js";
import { GrantDailyLoginReward } from "@/services/dailyReward.js";

let seq = 0;
const app = new Hono();
app.route("/v1", UserAuthRouter);

async function newAccount() {
    seq += 1;
    const email = `profile-test-${seq}@xeygate.test`;
    const user = await userAuthStore.createUser({
        email,
        passwordHash: hashUserPassword("profile-pass-123"),
        name: "Profile Test",
        status: "active"
    });
    assert.ok(user);
    return { id: user.id, email };
}

function cookie(token: string) {
    return { Cookie: `${USER_SESSION_COOKIE}=${token}` };
}

// Scoped to this file's prefix: node --test runs sibling test files as
// concurrent processes against the same DB, so a wildcard sweep here would
// delete other suites' accounts mid-run.
afterEach(async () => {
    await db
        .prepare("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'profile-test-%')")
        .run();
    await db
        .prepare("DELETE FROM login_rewards WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'profile-test-%')")
        .run();
    await db
        .prepare("DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'profile-test-%')")
        .run();
    await db.prepare("DELETE FROM users WHERE email LIKE 'profile-test-%'").run();
});

test("GET /users/me reports createdAt and the live login streak", async () => {
    const { id } = await newAccount();
    const token = await createUserSession(userAuthStore, id);

    const before = (await (
        await app.request("/v1/users/me", { headers: cookie(token) })
    ).json()) as { createdAt: number; loginStreak: number };
    assert.equal(typeof before.createdAt, "number");
    assert.ok(before.createdAt > 0);
    assert.equal(before.loginStreak, 0);

    await GrantDailyLoginReward(id);
    const after = (await (
        await app.request("/v1/users/me", { headers: cookie(token) })
    ).json()) as { loginStreak: number };
    assert.equal(after.loginStreak, 1);
});

test("PATCH /users/me updates the display name", async () => {
    const { id } = await newAccount();
    const token = await createUserSession(userAuthStore, id);

    const res = await app.request("/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...cookie(token) },
        body: JSON.stringify({ name: "  Renamed Hero  " })
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { name: string; email: string };
    assert.equal(body.name, "Renamed Hero");

    const me = (await (
        await app.request("/v1/users/me", { headers: cookie(token) })
    ).json()) as { name: string };
    assert.equal(me.name, "Renamed Hero");
});

test("PATCH /users/me rejects blank and oversized names, and needs auth", async () => {
    const { id } = await newAccount();
    const token = await createUserSession(userAuthStore, id);

    const blank = await app.request("/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...cookie(token) },
        body: JSON.stringify({ name: "   " })
    });
    assert.equal(blank.status, 400);

    const tooLong = await app.request("/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...cookie(token) },
        body: JSON.stringify({ name: "x".repeat(65) })
    });
    assert.equal(tooLong.status, 400);

    const anonymous = await app.request("/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sneaky" })
    });
    assert.equal(anonymous.status, 401);
});

test("POST /users/logout-all revokes every session including the caller's", async () => {
    const { id } = await newAccount();
    const tokenA = await createUserSession(userAuthStore, id);
    const tokenB = await createUserSession(userAuthStore, id);

    const res = await app.request("/v1/users/logout-all", { method: "POST", headers: cookie(tokenA) });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { revoked: number };
    assert.ok(body.revoked >= 2);

    const deadA = await app.request("/v1/users/me", { headers: cookie(tokenA) });
    assert.equal(deadA.status, 401);
    const deadB = await app.request("/v1/users/me", { headers: cookie(tokenB) });
    assert.equal(deadB.status, 401);
});
