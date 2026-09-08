import assert from "node:assert/strict";
import { test } from "node:test";
import {
    getCustomModelsByProviderDB,
} from "@srouter/db";
import { ProvidersLogic } from "@/logic/providers.logic.js";
import { providerAlias, providerBaseId } from "@srouter/constants";

// Admin model management: bulk add/delete + id normalization.
// Uses the built-in "anthropic" seed provider (alias "claude") so no DB row
// is needed — DEFAULT_PROVIDER_MAP["anthropic"] exists at init.
const PROVIDER = "anthropic";
const RUNTIME_ALIAS = providerAlias(providerBaseId(PROVIDER)); // "claude"
const UNIQUE = `test-mng-${Date.now()}-${process.pid}`;

// ── AddCustomModels (bulk) ───────────────────────────────────────────

test("AddCustomModels normalizes alias-prefixed ids, dedupes and returns custom models", async () => {
    const result = await ProvidersLogic.AddCustomModels(PROVIDER, [
        `sonnet-4.5-tiny-${UNIQUE}`,
        `claude/sonnet-4.5-tiny-${UNIQUE}`,
        `  claude/sonnet-4.5-mini-${UNIQUE}  `
    ]);

    assert.equal(result.added, 2);
    assert.deepEqual(
        result.models.map((m) => m.id).sort(),
        [`${RUNTIME_ALIAS}/sonnet-4.5-mini-${UNIQUE}`, `${RUNTIME_ALIAS}/sonnet-4.5-tiny-${UNIQUE}`].sort()
    );
    for (const m of result.models) {
        assert.equal(m.custom, true);
        assert.equal(m.owned_by, RUNTIME_ALIAS);
    }

    // Stored rows stay bare (no prefix).
    const rows = (await getCustomModelsByProviderDB(PROVIDER)).map((r) => r.modelId);
    assert.ok(rows.includes(`sonnet-4.5-tiny-${UNIQUE}`));
    assert.ok(rows.includes(`sonnet-4.5-mini-${UNIQUE}`));
});

test("AddCustomModels rejects unknown providers and invalid ids", async () => {
    await assert.rejects(() => ProvidersLogic.AddCustomModels("no-such-provider-x", ["m-1"]), /not found/);
    await assert.rejects(
        () => ProvidersLogic.AddCustomModels(PROVIDER, [`ok-${UNIQUE}`, "bad id!"]),
        /Invalid model ID/
    );
    // Validation runs per-id in loop order: the valid id before the invalid
    // one IS stored, everything after is not.
    const rows = (await getCustomModelsByProviderDB(PROVIDER)).map((r) => r.modelId);
    assert.ok(rows.includes(`ok-${UNIQUE}`));
});

test("AddCustomModels keeps ids with legit slashes that do not match the provider prefix", async () => {
    const result = await ProvidersLogic.AddCustomModels(PROVIDER, [`openrouter/mixtral-${UNIQUE}`]);
    assert.equal(result.added, 1);
    assert.equal(result.models[0]!.id, `${RUNTIME_ALIAS}/openrouter/mixtral-${UNIQUE}`);
    const rows = (await getCustomModelsByProviderDB(PROVIDER)).map((r) => r.modelId);
    assert.ok(rows.includes(`openrouter/mixtral-${UNIQUE}`));
});

// ── DeleteCustomModels (bulk) ────────────────────────────────────────

test("DeleteCustomModels is idempotent and counts only existing rows", async () => {
    await ProvidersLogic.AddCustomModels(PROVIDER, [`del-a-${UNIQUE}`, `claude/del-b-${UNIQUE}`]);

    const first = await ProvidersLogic.DeleteCustomModels(PROVIDER, [
        `del-a-${UNIQUE}`,
        `claude/del-b-${UNIQUE}`,
        `never-existed-${UNIQUE}`
    ]);
    assert.equal(first.deleted, 2);

    const second = await ProvidersLogic.DeleteCustomModels(PROVIDER, [`del-a-${UNIQUE}`, `del-b-${UNIQUE}`]);
    assert.equal(second.deleted, 0);
});

// ── Single add/delete with prefix normalization ──────────────────────

test("AddCustomModel and DeleteCustomModel tolerate alias-prefixed ids", async () => {
    const added = await ProvidersLogic.AddCustomModel(PROVIDER, `claude/single-${UNIQUE}`);
    assert.equal(added.custom, true);
    assert.equal(added.id, `${RUNTIME_ALIAS}/single-${UNIQUE}`);

    const rows = (await getCustomModelsByProviderDB(PROVIDER)).map((r) => r.modelId);
    assert.ok(rows.includes(`single-${UNIQUE}`));

    await ProvidersLogic.DeleteCustomModel(PROVIDER, `claude/single-${UNIQUE}`);
    const after = (await getCustomModelsByProviderDB(PROVIDER)).map((r) => r.modelId);
    assert.ok(!after.includes(`single-${UNIQUE}`));
});

// Cleanup so reruns (and other suites) do not see leftovers.
test("cleanup: remove all models created by this suite", async () => {
    await ProvidersLogic.DeleteCustomModels(PROVIDER, [
        `sonnet-4.5-tiny-${UNIQUE}`,
        `sonnet-4.5-mini-${UNIQUE}`,
        `openrouter/mixtral-${UNIQUE}`,
        `ok-${UNIQUE}`,
        `single-${UNIQUE}`
    ]);
    const rows = (await getCustomModelsByProviderDB(PROVIDER)).map((r) => r.modelId);
    assert.equal(rows.filter((r) => r.includes(UNIQUE)).length, 0);
});
