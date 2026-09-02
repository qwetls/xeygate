import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { AdminAuthStore } from "../../../packages/db/src/adminAuth.js";
import { SqliteClient } from "../../../packages/db/src/client.js";

test("admin auth store creates one account and preserves its hash", async () => {
    const store = new AdminAuthStore(new SqliteClient(new DatabaseSync(":memory:")));

    assert.equal(await store.hasAdminAccount(), false);
    assert.equal(await store.createAdminAccount("hash-one", 100), true);
    assert.equal(await store.hasAdminAccount(), true);
    assert.equal(await store.getPasswordHash(), "hash-one");
    assert.equal(await store.createAdminAccount("hash-two", 200), false);
    assert.equal(await store.getPasswordHash(), "hash-one");
});

test("admin auth store creates, finds, and deletes sessions", async () => {
    const store = new AdminAuthStore(new SqliteClient(new DatabaseSync(":memory:")));

    await store.createSession("token-hash", 100, 200);

    assert.deepEqual(await await store.getSession("token-hash", 150), {
        tokenHash: "token-hash",
        createdAt: 100,
        expiresAt: 200
    });
    assert.equal(await store.deleteSession("token-hash"), true);
    assert.equal(await await store.getSession("token-hash", 150), null);

    await store.createSession("expired-token-hash", 100, 200);
    assert.equal(await await store.getSession("expired-token-hash", 200), null);
});
