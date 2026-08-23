import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { AdminAuthStore } from "../../../packages/db/src/adminAuth.js";
import {
    ADMIN_SESSION_TTL_MS,
    createAdminSession,
    hashAdminPassword,
    hashSessionToken,
    isLoopbackAddress,
    validateAdminPassword,
    verifyAdminPassword,
    verifyAdminSession
} from "../src/services/adminAuth.js";

test("admin passwords use salted scrypt hashes", () => {
    const firstHash = hashAdminPassword("correct horse battery staple");
    const secondHash = hashAdminPassword("correct horse battery staple");

    assert.notEqual(firstHash, secondHash);
    assert.notEqual(firstHash, "correct horse battery staple");
    assert.equal(verifyAdminPassword("correct horse battery staple", firstHash), true);
    assert.equal(verifyAdminPassword("wrong password", firstHash), false);
});

test("admin password validation enforces the setup policy", () => {
    assert.equal(validateAdminPassword("short"), null);
    assert.equal(validateAdminPassword("a".repeat(129)), "Password must be at most 128 characters");
    assert.equal(validateAdminPassword("a".repeat(128)), null);
    assert.equal(validateAdminPassword(null), "Password is required");
});

test("admin sessions store only a token hash and expire", () => {
    const store = new AdminAuthStore(new DatabaseSync(":memory:"));
    const token = createAdminSession(store, 1_000);

    assert.equal(
        store.getSession(hashSessionToken(token), 1_000)?.tokenHash,
        hashSessionToken(token)
    );
    assert.equal(verifyAdminSession(store, token, 1_000), true);
    assert.equal(verifyAdminSession(store, token, 1_000 + ADMIN_SESSION_TTL_MS), false);
});

test("loopback detection accepts local IPv4 and IPv6 addresses only", () => {
    assert.equal(isLoopbackAddress("127.0.0.1"), true);
    assert.equal(isLoopbackAddress("::1"), true);
    assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
    assert.equal(isLoopbackAddress("192.168.1.10"), false);
    assert.equal(isLoopbackAddress(undefined), false);
});
