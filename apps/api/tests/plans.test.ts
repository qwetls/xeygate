import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { userAuthStore } from "@srouter/db";
import { PlansRouter } from "@/routes/v1/plans.js";
import { hashUserPassword, createUserSession, USER_SESSION_COOKIE } from "@/services/userAuth.js";

let seq = 0;
const app = new Hono();
app.route("/v1", PlansRouter);

async function newAdmin() {
    seq += 1;
    const user = await userAuthStore.createUser({
        email: `plans-test-${seq}@xeygate.test`,
        passwordHash: hashUserPassword("plans-pass-123"),
        name: "Plans Test",
        status: "active"
    });
    assert.ok(user);
    await userAuthStore.setAdmin(user.id, true);
    const token = await createUserSession(userAuthStore, user.id);
    return token;
}

function cookie(token: string) {
    return { Cookie: `${USER_SESSION_COOKIE}=${token}` };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

interface PlanPayload {
    id: string;
    label: string;
    priceCentsUsd: number;
    dailyTokens: number;
    rpm: number;
    minTier: string;
}

async function listPlans(token?: string) {
    const res = await app.request("/v1/plans", {
        headers: token ? cookie(token) : {}
    });
    return (await res.json()) as { plans: PlanPayload[] };
}

test("GET /plans is public and seeds the four tiers from defaults", async () => {
    const body = await listPlans();
    const ids = body.plans.map((p) => p.id);
    assert.deepEqual(ids, ["starter", "pro", "pro_max", "payg"]);

    const starter = body.plans.find((p) => p.id === "starter")!;
    assert.equal(starter.rpm, 10);
    assert.equal(starter.dailyTokens, 10_000);
    assert.equal(starter.minTier, "starter");
    const proMax = body.plans.find((p) => p.id === "pro_max")!;
    assert.equal(proMax.rpm, 0);
    assert.equal(proMax.dailyTokens, 0);
});

test("admin plan updates persist and validate", async () => {
    const admin = await newAdmin();

    const updated = await app.request("/v1/admin/plans/starter", {
        method: "PUT",
        headers: { ...JSON_HEADERS, ...cookie(admin) },
        body: JSON.stringify({ rpm: 3, dailyTokens: 1000, minTier: "pro", priceCentsUsd: 500 })
    });
    assert.equal(updated.status, 200);
    const payload = (await updated.json()) as { plan: PlanPayload };
    assert.equal(payload.plan.rpm, 3);
    assert.equal(payload.plan.dailyTokens, 1000);
    assert.equal(payload.plan.minTier, "pro");
    assert.equal(payload.plan.priceCentsUsd, 500);

    // Public feed reflects the new config (admin edits visible without redeploy).
    const body = await listPlans();
    const starter = body.plans.find((p) => p.id === "starter")!;
    assert.equal(starter.rpm, 3);
    assert.equal(starter.minTier, "pro");

    // Bad values are refused.
    for (const bad of [
        { rpm: -5 },
        { rpm: 1.5 },
        { dailyTokens: "many" },
        { minTier: "god" },
        { priceCentsUsd: -1 },
        {}
    ]) {
        const res = await app.request("/v1/admin/plans/starter", {
            method: "PUT",
            headers: { ...JSON_HEADERS, ...cookie(admin) },
            body: JSON.stringify(bad)
        });
        assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
    }

    // Unknown plan id is refused.
    const unknown = await app.request("/v1/admin/plans/diamond", {
        method: "PUT",
        headers: { ...JSON_HEADERS, ...cookie(admin) },
        body: JSON.stringify({ rpm: 5 })
    });
    assert.equal(unknown.status, 400);

    // Restore defaults for sibling tests / live parity.
    const restore = await app.request("/v1/admin/plans/starter", {
        method: "PUT",
        headers: { ...JSON_HEADERS, ...cookie(admin) },
        body: JSON.stringify({ rpm: 10, dailyTokens: 10_000, minTier: "starter", priceCentsUsd: 0 })
    });
    assert.equal(restore.status, 200);
});

test("non-admin cannot edit plans", async () => {
    seq += 1;
    const user = await userAuthStore.createUser({
        email: `plans-buyer-${seq}@xeygate.test`,
        passwordHash: hashUserPassword("plans-pass-123"),
        name: "Plans Buyer",
        status: "active"
    });
    assert.ok(user);
    const token = await createUserSession(userAuthStore, user.id);

    const res = await app.request("/v1/admin/plans/pro", {
        method: "PUT",
        headers: { ...JSON_HEADERS, ...cookie(token) },
        body: JSON.stringify({ rpm: 999 })
    });
    assert.equal(res.status, 401);
});
