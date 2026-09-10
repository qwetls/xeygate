import assert from "node:assert/strict";
import { test } from "node:test";
import { BulkCreateProviderSchema } from "@srouter/types";
import { deleteProviderDB, getAllProvidersDB } from "@srouter/db";
import { providerBaseId } from "@srouter/constants";
import { ProvidersLogic } from "@/logic/providers.logic.js";

// Bulk-add provider keys: one connection per key, ids fold back to the driver
// base (catalog grouping + round-robin), duplicates are skipped not doubled.
const DRIVER = `bulkdrv${process.pid}`;
const KEYS = [`key-a-${Date.now()}`, `key-b-${Date.now()}`, `key-c-${Date.now()}`];
const created: string[] = [];

async function cleanup() {
    for (const id of created.splice(0)) await deleteProviderDB(id);
}

function payload(apiKeys: string[]) {
    return {
        provider_id: DRIVER,
        name: "Bulk Test Key",
        category: "api_key" as const,
        protocol: "openai" as const,
        base_url: "https://api.example.com/v1",
        api_keys: apiKeys
    };
}

test("BulkCreateProviderSchema enforces required fields and bounds", () => {
    assert.equal(BulkCreateProviderSchema.safeParse(payload(["k1"])).success, true);
    // provider_id must be a safe slug
    assert.equal(BulkCreateProviderSchema.safeParse({ ...payload(["k1"]), provider_id: "bad id!" }).success, false);
    assert.equal(BulkCreateProviderSchema.safeParse({ ...payload(["k1"]), provider_id: "" }).success, false);
    // api_keys: non-empty array, no empty strings, capped at 100
    assert.equal(BulkCreateProviderSchema.safeParse({ ...payload([]) }).success, false);
    assert.equal(BulkCreateProviderSchema.safeParse({ ...payload(["", "  "]) }).success, false);
    assert.equal(BulkCreateProviderSchema.safeParse({ ...payload(Array.from({ length: 101 }, (_, i) => `k${i}`)) }).success, false);
    // base_url must be a real URL
    assert.equal(BulkCreateProviderSchema.safeParse({ ...payload(["k1"]), base_url: "not-a-url" }).success, false);
});

test("BulkAddProvider creates one connection per key with driver-folding ids", async () => {
    const result = await ProvidersLogic.BulkAddProvider(payload(KEYS));
    assert.equal(result.requested, 3);
    assert.equal(result.added, 3);
    assert.equal(result.skipped, 0);
    created.push(...result.connections.map((c) => c.id));

    const rows = await getAllProvidersDB();
    for (const [i, conn] of result.connections.entries()) {
        assert.ok(conn.id.startsWith(`${DRIVER}-`), "id carries the driver prefix");
        assert.equal(providerBaseId(conn.id), DRIVER, "id folds back to the driver base");
        assert.equal(conn.name, `Bulk Test Key #${i + 1}`);
        const row = rows.find((r) => r.id === conn.id);
        assert.ok(row, "row persisted");
        assert.equal(row!.apiKey, KEYS[i]);
        assert.equal(row!.enabled, true);
        assert.equal(row!.ownerId ?? null, null, "admin bulk adds are official (owner NULL)");
    }
    await cleanup();
});

test("BulkAddProvider dedupes the submitted list and skips keys already saved", async () => {
    const first = await ProvidersLogic.BulkAddProvider(payload([KEYS[0]!, KEYS[0]!, KEYS[1]!]));
    assert.equal(first.requested, 2, "in-payload duplicate collapsed before saving");
    assert.equal(first.added, 2);
    created.push(...first.connections.map((c) => c.id));

    // Re-submitting the same keys (plus one new) adds only the new one.
    const second = await ProvidersLogic.BulkAddProvider(payload([KEYS[0]!, KEYS[1]!, KEYS[2]!]));
    assert.equal(second.added, 1);
    assert.equal(second.skipped, 2);
    created.push(...second.connections.map((c) => c.id));
    await cleanup();
});

test("BulkAddProvider rejects blank-only batches", async () => {
    await assert.rejects(() => ProvidersLogic.BulkAddProvider(payload(["   ", "\t"])), /non-empty API key/);
});
