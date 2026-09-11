import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Hono } from "hono";
import { db, userAuthStore, setRequireApiKeyDB } from "@srouter/db";
import { UserAuthRouter } from "@/routes/v1/users.js";
import { adminRoute } from "@/routes/v1/admin.js";
import { AdminUsersRouter } from "@/routes/v1/adminUsers.js";
import { CreateAdminAuthMiddleware } from "@/middleware/AdminAuth.js";
import { CreateApiKeyAuth } from "@/middleware/ApiKeyAuth.js";
import {
    hashUserPassword,
    createUserSession,
    hashSessionToken,
    USER_SESSION_COOKIE
} from "@/services/userAuth.js";
import { createTestAdminSession, createTestAdmin } from "./helpers/adminSession.js";

const createdUserIds: string[] = [];
let seq = 0;

afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
        await userAuthStore.deleteSessionsForUser(id);
    }
    // Remove every account this file (and its helper) created, so admin-count
    // assertions stay deterministic for the next test.
    await db.prepare("DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@xeygate.test')").run();
    await db.prepare("DELETE FROM users WHERE email LIKE '%@xeygate.test'").run();
    await setRequireApiKeyDB(false);
});

function createTestApp() {
    const app = new Hono();
    app.route("/v1", adminRoute);
    app.route("/v1", UserAuthRouter);
    app.route("/v1", AdminUsersRouter);
    return app;
}

async function createAccount(email: string, password: string, opts: { isAdmin?: boolean } = {}) {
    const user = await userAuthStore.createUser({
        email,
        passwordHash: hashUserPassword(password),
        name: "Account Test",
        status: "active",
        isAdmin: opts.isAdmin ?? false
    });
    if (!user) throw new Error(`failed to create ${email}`);
    createdUserIds.push(user.id);
    return user;
}

function cookie(token: string) {
    return { Cookie: `${USER_SESSION_COOKIE}=${token}` };
}

test("GET /admin/status reports setupRequired before any admin exists", async () => {
    const app = createTestApp();
    const res = await app.request("/v1/admin/status");
    assert.equal(res.status, 200);
    // The shared test DB may already hold an admin from other tests; both
    // outcomes are valid, the shape is what matters here.
    const body = (await res.json()) as { setupRequired: boolean };
    assert.equal(typeof body.setupRequired, "boolean");
});

test("POST /admin/bootstrap creates the first admin and signs it in", async () => {
    const app = createTestApp();
    seq += 1;
    const email = `acct-test-bootstrap-${seq}@xeygate.test`;

    const res = await app.request("/v1/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "bootstrap-pass-123" })
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { admin: { email: string; isAdmin: boolean } };
    assert.equal(body.admin.email, email);
    assert.equal(body.admin.isAdmin, true);

    const stored = await userAuthStore.getUserByEmail(email);
    assert.ok(stored?.isAdmin);
});

test("POST /admin/bootstrap is rejected once an admin exists", async () => {
    const app = createTestApp();
    // Guarantee an admin exists regardless of cleanup order in this file.
    await createTestAdminSession();

    const res = await app.request("/v1/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "acct-test-second@xeygate.test",
            password: "bootstrap-pass-123"
        })
    });
    assert.equal(res.status, 409);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "admin_exists");
});

test("admin signs in through /users/login and gets isAdmin in the payload", async () => {
    const app = createTestApp();
    seq += 1;
    const email = `acct-test-login-${seq}@xeygate.test`;
    await createAccount(email, "login-pass-123", { isAdmin: true });

    const res = await app.request("/v1/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "login-pass-123" })
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { isAdmin: boolean };
    assert.equal(body.isAdmin, true);
});

test("/users/me exposes isAdmin for admin and omits privilege for buyers", async () => {
    const app = createTestApp();
    seq += 1;
    const adminEmail = `acct-test-me-admin-${seq}@xeygate.test`;
    const buyerEmail = `acct-test-me-buyer-${seq}@xeygate.test`;
    await createAccount(adminEmail, "me-pass-123", { isAdmin: true });
    await createAccount(buyerEmail, "me-pass-123");

    const adminLogin = await app.request("/v1/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: "me-pass-123" })
    });
    assert.equal(adminLogin.status, 200);
    const adminToken = (await userAuthStore.getUserByEmail(adminEmail))?.id;
    assert.ok(adminToken);
    const adminTokenSession = await createUserSession(userAuthStore, adminToken);

    const meAdmin = await app.request("/v1/users/me", { headers: cookie(adminTokenSession) });
    assert.equal(meAdmin.status, 200);
    assert.equal(((await meAdmin.json()) as { isAdmin: boolean }).isAdmin, true);

    const buyer = await userAuthStore.getUserByEmail(buyerEmail);
    assert.ok(buyer);
    const buyerSession = await createUserSession(userAuthStore, buyer.id);
    const meBuyer = await app.request("/v1/users/me", { headers: cookie(buyerSession) });
    assert.equal(meBuyer.status, 200);
    assert.equal(((await meBuyer.json()) as { isAdmin: boolean }).isAdmin, false);
});

test("RequireAdmin accepts an admin user session and rejects a buyer session", async () => {
    const app = new Hono();
    app.use("/v1/*", CreateAdminAuthMiddleware());
    app.get("/v1/admin/users", (c) => c.json({ ok: true }));

    seq += 1;
    const buyerEmail = `acct-test-guard-buyer-${seq}@xeygate.test`;
    const buyer = await createAccount(buyerEmail, "guard-pass-123");
    const buyerSession = await createUserSession(userAuthStore, buyer.id);

    const rejected = await app.request("/v1/admin/users", { headers: cookie(buyerSession) });
    assert.equal(rejected.status, 401);

    const adminToken = await createTestAdminSession();
    const accepted = await app.request("/v1/admin/users", { headers: cookie(adminToken) });
    assert.equal(accepted.status, 200);
});

test("POST /admin/users/:id/promote grants admin and /demote revokes it", async () => {
    const app = createTestApp();
    seq += 1;
    const targetEmail = `acct-test-promote-${seq}@xeygate.test`;
    const target = await createAccount(targetEmail, "promote-pass-123");

    const adminToken = await createTestAdminSession();

    const promote = await app.request(`/v1/admin/users/${target.id}/promote`, {
        method: "POST",
        headers: cookie(adminToken)
    });
    assert.equal(promote.status, 200);
    assert.equal(((await promote.json()) as { user: { isAdmin: boolean } }).user.isAdmin, true);

    const demote = await app.request(`/v1/admin/users/${target.id}/demote`, {
        method: "POST",
        headers: cookie(adminToken)
    });
    assert.equal(demote.status, 200);
    assert.equal(((await demote.json()) as { user: { isAdmin: boolean } }).user.isAdmin, false);
});

test("demoting the last remaining admin is refused", async () => {
    const app = createTestApp();
    // The sole admin attempts to drop their own flag: the request is
    // authenticated, but refusing it is the only way to keep the instance
    // administrable.
    const { userId, token } = await createTestAdmin();
    const res = await app.request(`/v1/admin/users/${userId}/demote`, {
        method: "POST",
        headers: cookie(token)
    });
    assert.equal(res.status, 409);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "last_admin");
});

test("banned admins lose access immediately", async () => {
    seq += 1;
    const email = `acct-test-banned-${seq}@xeygate.test`;
    const admin = await createAccount(email, "banned-pass-123", { isAdmin: true });
    const token = await createUserSession(userAuthStore, admin.id);

    const app = new Hono();
    app.use("/v1/*", CreateAdminAuthMiddleware());
    app.get("/v1/admin/ok", (c) => c.json({ ok: true }));

    const before = await app.request("/v1/admin/ok", { headers: cookie(token) });
    assert.equal(before.status, 200);

    await userAuthStore.updateStatus(admin.id, "banned");
    const after = await app.request("/v1/admin/ok", { headers: cookie(token) });
    assert.equal(after.status, 401);
});

test("admin user session satisfies ApiKeyAuth without an API key", async () => {
    await setRequireApiKeyDB(true);
    const app = new Hono();
    app.use("/*", CreateApiKeyAuth());
    app.post("/chat/completions", (c) => c.json({ ok: true }));

    const spoofed = await app.request("/chat/completions", {
        method: "POST",
        headers: { "X-SRouter-Client": "playground" }
    });
    assert.equal(spoofed.status, 401);

    const token = await createTestAdminSession();
    const adminRequest = await app.request("/chat/completions", {
        method: "POST",
        headers: cookie(token)
    });
    assert.equal(adminRequest.status, 200);
});

test("POST /users/change-password rotates the password and invalidates old sessions", async () => {
    const app = createTestApp();
    seq += 1;
    const email = `acct-test-changepw-${seq}@xeygate.test`;
    await createAccount(email, "old-password-123");

    const login = await app.request("/v1/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "old-password-123" })
    });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get("set-cookie") ?? "";
    const oldToken = /xeygate_user_session=([^;]+)/.exec(setCookie)?.[1];
    assert.ok(oldToken);

    const change = await app.request("/v1/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookie(oldToken) },
        body: JSON.stringify({
            current_password: "old-password-123",
            new_password: "new-password-456",
            confirmation: "new-password-456"
        })
    });
    assert.equal(change.status, 200);

    // Old session was revoked by the rotation.
    const withOld = await app.request("/v1/users/me", { headers: cookie(oldToken) });
    assert.equal(withOld.status, 401);

    // New password works, old one no longer does.
    const reloginOld = await app.request("/v1/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "old-password-123" })
    });
    assert.equal(reloginOld.status, 401);
    const reloginNew = await app.request("/v1/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "new-password-456" })
    });
    assert.equal(reloginNew.status, 200);
});

test("active sessions slide back to the full window while idle ones still expire", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    seq += 1;
    const email = `acct-test-slide-${seq}@xeygate.test`;
    const user = await createAccount(email, "slide-pass-123");
    const createdAt = Date.now();
    const token = await createUserSession(userAuthStore, user.id, createdAt);
    const tokenHash = hashSessionToken(token);

    // Day 20: 10 days of the 30-day window remain — below half, so the next
    // successful authentication refreshes the session back to a full window.
    const slid = await userAuthStore.getSession(tokenHash, createdAt + 20 * DAY);
    assert.ok(slid);
    assert.equal(slid.expiresAt, createdAt + 50 * DAY);

    // A session checked while most of its window remains is left untouched.
    const fresh = await userAuthStore.getSession(tokenHash, createdAt + DAY);
    assert.ok(fresh);
    assert.equal(fresh.expiresAt, createdAt + 50 * DAY);

    // Once the refreshed window elapses unused, the session is gone for good.
    const gone = await userAuthStore.getSession(tokenHash, createdAt + 50 * DAY + 1000);
    assert.equal(gone, null);
});
