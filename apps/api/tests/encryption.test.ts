import assert from "node:assert/strict";
import { test } from "node:test";

// Derive key for the test process so encryption actually runs.
process.env.XEYGATE_ENCRYPTION_KEY ??= "test-encryption-key-for-ci-only";

import { DecryptSecret, EncryptSecret, IsEncrypted } from "../../../packages/db/src/encryption.js";

test("encrypt/decrypt round-trip preserves value", () => {
    const original = "sk-proj-abc123def456";
    const encrypted = EncryptSecret(original);

    assert.ok(encrypted);
    assert.notEqual(encrypted, original);
    assert.ok(encrypted.startsWith("enc:v1:"));
    assert.ok(IsEncrypted(encrypted));

    const decrypted = DecryptSecret(encrypted);
    assert.equal(decrypted, original);
});

test("encrypted value is stable — same plaintext, different ciphertext (random IV)", () => {
    const a = EncryptSecret("same-key");
    const b = EncryptSecret("same-key");
    assert.notEqual(a, b);
    assert.equal(DecryptSecret(a), DecryptSecret(b));
});

test("already-encrypted value is not double-encrypted", () => {
    const once = EncryptSecret("my-api-key");
    const twice = EncryptSecret(once);
    assert.equal(once, twice);
});

test("null/undefined/empty pass through untouched", () => {
    assert.equal(EncryptSecret(null), null);
    assert.equal(EncryptSecret(undefined), undefined);
    assert.equal(EncryptSecret(""), "");
    assert.equal(DecryptSecret(null), null);
    assert.equal(DecryptSecret(undefined), undefined);
    assert.equal(DecryptSecret(""), "");
});

test("legacy plaintext passthrough — no prefix means returned as-is", () => {
    const legacyKey = "plain-old-api-key";
    assert.equal(DecryptSecret(legacyKey), legacyKey);
    assert.equal(IsEncrypted(legacyKey), false);
});

test("IsEncrypted distinguishes encrypted vs plaintext", () => {
    assert.ok(IsEncrypted(EncryptSecret("test")));
    assert.equal(IsEncrypted("sk-proj-abc"), false);
    assert.equal(IsEncrypted(null), false);
});
