import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Hono } from "hono";
import { db, userAuthStore } from "@srouter/db";
import { UserAuthRouter } from "@/routes/v1/users.js";
import { AdminUsersRouter } from "@/routes/v1/adminUsers.js";
import { hashUserPassword, createUserSession, USER_SESSION_COOKIE } from "@/services/userAuth.js";

let seq = 0;
const app = new Hono();
app.route("/v1", UserAuthRouter);
app.route("/v1", AdminUsersRouter);

async function newAccount(admin = false) {
    seq += 1;
    const email = `topup-test-${seq}@xeygate.test`;
    const user = await userAuthStore.createUser({
        email,
        passwordHash: hashUserPassword("topup-pass-123"),
        name: "Topup Test",
        status: "active"
    });
    assert.ok(user);
    if (admin) {
        await userAuthStore.setAdmin(user.id, true);
    }
    const token = await createUserSession(userAuthStore, user.id);
    return { id: user.id, email, token, credits: user.credits };
}

function cookie(token: string) {
    return { Cookie: `${USER_SESSION_COOKIE}=${token}` };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// Scoped to this file's prefix (sibling suites run concurrently against
// per-worker temp DBs; a wildcard sweep would poison other files).
afterEach(async () => {
    await db
        .prepare("DELETE FROM topup_orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'topup-test-%')")
        .run();
    await db
        .prepare("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'topup-test-%')")
        .run();
    await db
        .prepare("DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'topup-test-%')")
        .run();
    await db.prepare("DELETE FROM users WHERE email LIKE 'topup-test-%'").run();
});

async function postTopup(token: string, body: unknown) {
    return app.request("/v1/users/topups", {
        method: "POST",
        headers: { ...JSON_HEADERS, ...cookie(token) },
        body: JSON.stringify(body)
    });
}

test("POST /users/topups rejects amounts outside the allowed range", async () => {
    const { token } = await newAccount();

    assert.equal((await postTopup(token, { amount: 0 })).status, 400);
    assert.equal((await postTopup(token, { amount: 4.99 })).status, 400);
    assert.equal((await postTopup(token, { amount: 10001 })).status, 400);
    assert.equal((await postTopup(token, { amount: "abc" })).status, 400);
    assert.equal((await postTopup(token, {})).status, 400);

    const anonymous = await app.request("/v1/users/topups", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ amount: 25 })
    });
    assert.equal(anonymous.status, 401);
});

test("order lifecycle: create → duplicate guard → list → cancel → re-cancel", async () => {
    const { token } = await newAccount();

    const created = await postTopup(token, { amount: 25.5, reference: "  ref-9911  " });
    assert.equal(created.status, 200);
    const order = ((await created.json()) as { topup: { id: string; amount: number; status: string; reference?: string } }).topup;
    assert.equal(order.amount, 25.5);
    assert.equal(order.status, "pending");
    assert.equal(order.reference, "ref-9911");

    const duplicate = await postTopup(token, { amount: 10 });
    assert.equal(duplicate.status, 409);
    const dupBody = (await duplicate.json()) as { error: { code: string } };
    assert.equal(dupBody.error.code, "topup_pending_exists");

    const list = (await (
        await app.request("/v1/users/topups", { headers: cookie(token) })
    ).json()) as { topups: Array<{ id: string }>; total: number; pending: { id: string } | null };
    assert.equal(list.total, 1);
    assert.equal(list.pending?.id, order.id);

    const cancelled = await app.request(`/v1/users/topups/${order.id}/cancel`, {
        method: "POST",
        headers: cookie(token)
    });
    assert.equal(cancelled.status, 200);
    const afterCancel = (await cancelled.json()) as { topup: { status: string } };
    assert.equal(afterCancel.topup.status, "cancelled");

    // No pending order anymore → a fresh one is accepted again.
    assert.equal((await postTopup(token, { amount: 5 })).status, 200);

    const recancel = await app.request(`/v1/users/topups/${order.id}/cancel`, {
        method: "POST",
        headers: cookie(token)
    });
    assert.equal(recancel.status, 409);
});

test("cancel is owner-only", async () => {
    const { token } = await newAccount();
    const intruder = await newAccount();

    const created = ((await (await postTopup(token, { amount: 12 })).json()) as {
        topup: { id: string };
    }).topup;

    const stolen = await app.request(`/v1/users/topups/${created.id}/cancel`, {
        method: "POST",
        headers: cookie(intruder.token)
    });
    assert.equal(stolen.status, 404);
});

test("admin approval credits the wallet once and writes the ledger row", async () => {
    const buyer = await newAccount();
    const admin = await newAccount(true);

    const created = ((await (await postTopup(buyer.token, { amount: 40 })).json()) as {
        topup: { id: string };
    }).topup;

    // A plain buyer session must not reach the admin queue.
    const forbidden = await app.request(`/v1/admin/topups/${created.id}/process`, {
        method: "POST",
        headers: { ...JSON_HEADERS, ...cookie(buyer.token) },
        body: JSON.stringify({ status: "approved" })
    });
    assert.equal(forbidden.status, 401);

    const queue = (await (
        await app.request("/v1/admin/topups", { headers: cookie(admin.token) })
    ).json()) as { topups: Array<{ id: string; userEmail?: string }> };
    const queued = queue.topups.find((t) => t.id === created.id);
    assert.ok(queued, "pending order appears in the admin queue");
    assert.ok(queued.userEmail?.startsWith("topup-test-"), "queue rows carry buyer email");

    const approved = await app.request(`/v1/admin/topups/${created.id}/process`, {
        method: "POST",
        headers: { ...JSON_HEADERS, ...cookie(admin.token) },
        body: JSON.stringify({ status: "approved" })
    });
    assert.equal(approved.status, 200);
    const approvedBody = (await approved.json()) as {
        topup: { status: string; processedBy?: string };
        credits: number;
    };
    assert.equal(approvedBody.topup.status, "approved");
    assert.equal(approvedBody.topup.processedBy, admin.id);
    assert.equal(approvedBody.credits, buyer.credits + 40);

    const ledger = (await (
        await app.request("/v1/users/transactions", { headers: cookie(buyer.token) })
    ).json()) as { transactions: Array<{ type: string; amount: number; description: string }> };
    const row = ledger.transactions.find((t) => t.description.includes(created.id));
    assert.ok(row, "approval wrote a ledger row");
    assert.equal(row.type, "credit");
    assert.equal(row.amount, 40);

    // Double-approve guard.
    const again = await app.request(`/v1/admin/topups/${created.id}/process`, {
        method: "POST",
        headers: { ...JSON_HEADERS, ...cookie(admin.token) },
        body: JSON.stringify({ status: "approved" })
    });
    assert.equal(again.status, 409);

    const me = (await (
        await app.request("/v1/users/me", { headers: cookie(buyer.token) })
    ).json()) as { credits: number };
    assert.equal(me.credits, buyer.credits + 40);
});

test("admin rejection closes the order without crediting", async () => {
    const buyer = await newAccount();
    const admin = await newAccount(true);

    const created = ((await (await postTopup(buyer.token, { amount: 60 })).json()) as {
        topup: { id: string };
    }).topup;

    const rejected = await app.request(`/v1/admin/topups/${created.id}/process`, {
        method: "POST",
        headers: { ...JSON_HEADERS, ...cookie(admin.token) },
        body: JSON.stringify({ status: "rejected", note: "payment not found" })
    });
    assert.equal(rejected.status, 200);
    const body = (await rejected.json()) as { topup: { status: string; note?: string }; credits?: number };
    assert.equal(body.topup.status, "rejected");
    assert.equal(body.topup.note, "payment not found");
    assert.equal(body.credits, undefined);

    const me = (await (
        await app.request("/v1/users/me", { headers: cookie(buyer.token) })
    ).json()) as { credits: number };
    assert.equal(me.credits, buyer.credits);

    // A rejected order cannot be approved afterwards.
    const approve = await app.request(`/v1/admin/topups/${created.id}/process`, {
        method: "POST",
        headers: { ...JSON_HEADERS, ...cookie(admin.token) },
        body: JSON.stringify({ status: "approved" })
    });
    assert.equal(approve.status, 409);
});

test("admin rejects unknown process statuses", async () => {
    const buyer = await newAccount();
    const admin = await newAccount(true);

    const created = ((await (await postTopup(buyer.token, { amount: 15 })).json()) as {
        topup: { id: string };
    }).topup;

    const bad = await app.request(`/v1/admin/topups/${created.id}/process`, {
        method: "POST",
        headers: { ...JSON_HEADERS, ...cookie(admin.token) },
        body: JSON.stringify({ status: "paid" })
    });
    assert.equal(bad.status, 400);
});
