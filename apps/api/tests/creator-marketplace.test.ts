import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { userAuthStore, userAuthStore as store } from "@srouter/db";
import type { User } from "@srouter/db";
import { Hono } from "hono";
import { UserAuthRouter } from "@/routes/v1/users.js";
import { ProvidersRouter } from "@/routes/v1/providers.js";
import {
    createUserSession,
    hashUserPassword,
    USER_SESSION_COOKIE
} from "@/services/userAuth.js";
import { deleteProviderDB } from "@srouter/db";

function createTestApp() {
    const app = new Hono();
    app.route("/v1", UserAuthRouter);
    app.route("/v1", ProvidersRouter);
    return app;
}

let creatorUser: User;
let buyerUser: User;
let creatorCookie: string;
let buyerCookie: string;
const createdProviderIds: string[] = [];

beforeEach(async () => {
    const cId = `test_creator_${crypto.randomUUID().slice(0, 8)}`;
    creatorUser = await store.createUser({
        email: `${cId}@test.local`,
        passwordHash: hashUserPassword("testpassword1234"),
        name: "Creator Test"
    }) as User;
    await store.updateRole(creatorUser.id, "creator");
    creatorUser = (await store.getUserById(creatorUser.id))!;

    const bId = `test_buyer_${crypto.randomUUID().slice(0, 8)}`;
    buyerUser = await store.createUser({
        email: `${bId}@test.local`,
        passwordHash: hashUserPassword("testpassword1234"),
        name: "Buyer Test"
    }) as User;

    const creatorToken = await createUserSession(store, creatorUser.id);
    creatorCookie = `${USER_SESSION_COOKIE}=${creatorToken}`;

    const buyerToken = await createUserSession(store, buyerUser.id);
    buyerCookie = `${USER_SESSION_COOKIE}=${buyerToken}`;
});

afterEach(async () => {
    for (const id of createdProviderIds.splice(0)) {
        await deleteProviderDB(id).catch(() => {});
    }
});

test("GET /v1/users/me returns creator role", async () => {
    const app = createTestApp();
    const res = await app.request("/v1/users/me", {
        headers: { Cookie: creatorCookie }
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { role: string };
    assert.equal(body.role, "creator");
});

test("GET /v1/users/role returns the correct role", async () => {
    const app = createTestApp();
    const res = await app.request("/v1/users/role", {
        headers: { Cookie: buyerCookie }
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { role: string };
    assert.equal(body.role, "buyer");
});

test("PUT /v1/users/role upgrades buyer to creator", async () => {
    const app = createTestApp();
    const res = await app.request("/v1/users/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: buyerCookie },
        body: JSON.stringify({ role: "creator" })
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { id: string; role: string };
    assert.equal(body.id, buyerUser.id);
    assert.equal(body.role, "creator");
});

test("PUT /v1/users/role rejects invalid role", async () => {
    const app = createTestApp();
    const res = await app.request("/v1/users/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: creatorCookie },
        body: JSON.stringify({ role: "admin" })
    });
    assert.equal(res.status, 400);
});

test("GET /v1/providers/mine returns empty list for new creator", async () => {
    const app = createTestApp();
    const res = await app.request("/v1/providers/mine", {
        headers: { Cookie: creatorCookie }
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { object: string; data: unknown[] };
    assert.equal(body.object, "list");
    assert.equal(body.data.length, 0);
});

test("POST /v1/providers/mine creates provider with owner_id", async () => {
    const app = createTestApp();
    const providerId = `test-owner-${crypto.randomUUID().slice(0, 8)}`;
    const res = await app.request("/v1/providers/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: creatorCookie },
        body: JSON.stringify({
            id: providerId,
            name: "Creator Provider",
            category: "custom_provider",
            protocol: "openai",
            api_key: "sk-creator-secret-test-key",
            base_url: "https://api.example.com"
        })
    });
    const body = (await res.json()) as { id: string };
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    createdProviderIds.push(providerId);
    assert.equal(body.id, providerId);

    // List mine should show it
    const listRes = await app.request("/v1/providers/mine", {
        headers: { Cookie: creatorCookie }
    });
    const list = await listRes.json() as { data: unknown[] };
    assert.equal(list.data.length, 1);
});

test("POST /v1/providers/mine sanitises credentials from response", async () => {
    const app = createTestApp();
    const providerId = `test-sanitise-${crypto.randomUUID().slice(0, 8)}`;
    const createRes = await app.request("/v1/providers/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: creatorCookie },
        body: JSON.stringify({
            id: providerId,
            name: "Sanitised Provider",
            category: "custom_provider",
            protocol: "openai",
            api_key: "sk-should-not-appear",
            base_url: "https://api.example.com"
        })
    });
    assert.equal(createRes.status, 200);
    createdProviderIds.push(providerId);

    const createBody = await createRes.json() as Record<string, unknown>;
    assert.equal(createBody.apiKey, undefined, "apiKey should not appear in response");
    assert.equal(createBody.accessToken, undefined);

    const listRes = await app.request("/v1/providers/mine", {
        headers: { Cookie: creatorCookie }
    });
    const list = await listRes.json() as { data: Record<string, unknown>[] };
    for (const p of list.data) {
        assert.equal(p.apiKey, undefined, "apiKey leaked in list");
    }
});

test("DELETE /v1/providers/mine/:id deletes own provider", async () => {
    const app = createTestApp();
    const providerId = `test-delete-${crypto.randomUUID().slice(0, 8)}`;
    await app.request("/v1/providers/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: creatorCookie },
        body: JSON.stringify({
            id: providerId,
            name: "Deletable Provider",
            category: "custom_provider",
            protocol: "openai",
            api_key: "sk-delete-test",
            base_url: "https://api.example.com"
        })
    });
    // delete
    const delRes = await app.request(`/v1/providers/mine/${providerId}`, {
        method: "DELETE",
        headers: { Cookie: creatorCookie }
    });
    assert.equal(delRes.status, 200);

    // gone
    const listRes = await app.request("/v1/providers/mine", {
        headers: { Cookie: creatorCookie }
    });
    const list = await listRes.json() as { data: unknown[] };
    assert.equal(list.data.length, 0);
});

test("DELETE /v1/providers/mine/:id returns 404 for other user's provider", async () => {
    const app = createTestApp();
    const providerId = `test-cross-${crypto.randomUUID().slice(0, 8)}`;
    // creator creates
    await app.request("/v1/providers/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: creatorCookie },
        body: JSON.stringify({
            id: providerId,
            name: "Cross Owner Provider",
            category: "custom_provider",
            protocol: "openai",
            api_key: "sk-cross-test",
            base_url: "https://api.example.com"
        })
    });
    createdProviderIds.push(providerId);

    // another user (buyer, after upgrade) tries to delete
    await store.updateRole(buyerUser.id, "creator");
    const token2 = await createUserSession(store, buyerUser.id);
    const cookie2 = `${USER_SESSION_COOKIE}=${token2}`;

    const delRes = await app.request(`/v1/providers/mine/${providerId}`, {
        method: "DELETE",
        headers: { Cookie: cookie2 }
    });
    assert.equal(delRes.status, 404);
});

test("buyer (non-creator) gets 403 on /providers/mine", async () => {
    const app = createTestApp();
    const res = await app.request("/v1/providers/mine", {
        headers: { Cookie: buyerCookie }
    });
    assert.equal(res.status, 403);
    const body = await res.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, "creator_only");
});

test("unauthenticated request returns 401 on /providers/mine", async () => {
    const app = createTestApp();
    const res = await app.request("/v1/providers/mine");
    assert.equal(res.status, 401);
});
