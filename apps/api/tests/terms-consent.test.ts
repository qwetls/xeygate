import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Hono } from "hono";
import { db, userAuthStore } from "@srouter/db";
import { TERMS_VERSION } from "@srouter/constants";
import { UserAuthRouter } from "@/routes/v1/users.js";
import { hashUserPassword } from "@/services/userAuth.js";

let seq = 0;
const app = new Hono();
app.route("/v1", UserAuthRouter);

function nextEmail() {
    seq += 1;
    return `terms-test-${seq}@xeygate.test`;
}

async function post(path: string, body: unknown) {
    return app.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

// Scoped to this file's prefix: sibling test files run concurrently against
// the same DB.
afterEach(async () => {
    await db
        .prepare("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'terms-test-%')")
        .run();
    await db
        .prepare("DELETE FROM login_rewards WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'terms-test-%')")
        .run();
    await db
        .prepare("DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'terms-test-%')")
        .run();
    await db.prepare("DELETE FROM users WHERE email LIKE 'terms-test-%'").run();
});

test("register without accepted_terms is rejected and creates no account", async () => {
    const email = nextEmail();
    const res = await post("/v1/users/register", { email, password: "terms-pass-123", name: "No Consent" });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.equal(payload.error.code, "terms_not_accepted");
    assert.equal(await userAuthStore.getUserByEmail(email), null);
});

test("register with accepted_terms:false is rejected too", async () => {
    const email = nextEmail();
    const res = await post("/v1/users/register", {
        email,
        password: "terms-pass-123",
        accepted_terms: false
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, "terms_not_accepted");
    assert.equal(await userAuthStore.getUserByEmail(email), null);
});

test("register with accepted_terms:true stamps consent on the account", async () => {
    const email = nextEmail();
    const res = await post("/v1/users/register", {
        email,
        password: "terms-pass-123",
        name: "Consented",
        accepted_terms: true
    });
    assert.equal(res.status, 200);
    const user = await userAuthStore.getUserByEmail(email);
    assert.ok(user);
    assert.ok(user.acceptedTermsAt !== null && user.acceptedTermsAt > 0);
    assert.equal(user.termsVersion, TERMS_VERSION);
});

test("legacy account (no consent record) must re-accept before it gets a session", async () => {
    const email = nextEmail();
    const created = await userAuthStore.createUser({
        email,
        passwordHash: hashUserPassword("terms-pass-123"),
        name: "Legacy",
        status: "active"
    });
    assert.ok(created);
    assert.equal(created.acceptedTermsAt, null);

    const denied = await post("/v1/users/login", { email, password: "terms-pass-123" });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error.code, "terms_required");

    const granted = await post("/v1/users/login", {
        email,
        password: "terms-pass-123",
        accepted_terms: true
    });
    assert.equal(granted.status, 200);
    const user = await userAuthStore.getUserByEmail(email);
    assert.ok(user);
    assert.ok(user.acceptedTermsAt !== null && user.acceptedTermsAt > 0);
    assert.equal(user.termsVersion, TERMS_VERSION);
});

test("already-consented account signs in without re-sending the flag", async () => {
    const email = nextEmail();
    const created = await userAuthStore.createUser({
        email,
        passwordHash: hashUserPassword("terms-pass-123"),
        name: "Fresh",
        status: "active",
        acceptedTermsAt: Date.now(),
        termsVersion: TERMS_VERSION
    });
    assert.ok(created);

    const res = await post("/v1/users/login", { email, password: "terms-pass-123" });
    assert.equal(res.status, 200);
});
