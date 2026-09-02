import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    createFallbackRuleDB,
    deleteFallbackRuleDB,
    findMatchingFallbackRulesDB,
    getAllFallbackRulesDB,
    getFallbackRuleByIdDB,
    updateFallbackRuleDB
} from "@srouter/db";

const createdRuleIds: string[] = [];

afterEach(async () => {
    for (const id of createdRuleIds.splice(0)) {
        await await deleteFallbackRuleDB(id);
    }
});

test("Fallback DB creates, gets, updates, and deletes fallback rules", async () => {
    const created = await await createFallbackRuleDB({
        sourceModel: "openai_codex/gpt-4o",
        targetModel: "antigravity/gemini-2.5-pro",
        priority: 1,
        enabled: true,
        triggerOnStatus: [429, 502, 503]
    });
    createdRuleIds.push(created.id);

    assert.equal(created.sourceModel, "openai_codex/gpt-4o");
    assert.equal(created.targetModel, "antigravity/gemini-2.5-pro");
    assert.equal(created.priority, 1);
    assert.equal(created.enabled, true);
    assert.deepEqual(created.triggerOnStatus, [429, 502, 503]);

    const retrieved = await await getFallbackRuleByIdDB(created.id);
    assert.ok(retrieved);
    assert.equal(retrieved?.id, created.id);

    const updated = await await updateFallbackRuleDB(created.id, {
        targetModel: "anthropic/claude-3-7-sonnet",
        priority: 2,
        enabled: false
    });
    assert.ok(updated);
    assert.equal(updated?.targetModel, "anthropic/claude-3-7-sonnet");
    assert.equal(updated?.priority, 2);
    assert.equal(updated?.enabled, false);

    await await deleteFallbackRuleDB(created.id);
    assert.equal(await await getFallbackRuleByIdDB(created.id), null);
});

test("findMatchingFallbackRulesDB prioritizes exact match over wildcard prefix and global wildcard", async () => {
    const rule1 = await await createFallbackRuleDB({
        sourceModel: "*",
        targetModel: "fallback/global",
        priority: 3,
        enabled: true
    });
    createdRuleIds.push(rule1.id);

    const rule2 = await await createFallbackRuleDB({
        sourceModel: "openai_codex/*",
        targetModel: "fallback/codex-prefix",
        priority: 2,
        enabled: true
    });
    createdRuleIds.push(rule2.id);

    const rule3 = await await createFallbackRuleDB({
        sourceModel: "openai_codex/gpt-4o",
        targetModel: "fallback/exact-gpt4o",
        priority: 1,
        enabled: true
    });
    createdRuleIds.push(rule3.id);

    // Disabled rule should not be returned
    const ruleDisabled = await await createFallbackRuleDB({
        sourceModel: "openai_codex/gpt-4o",
        targetModel: "fallback/disabled",
        priority: 0,
        enabled: false
    });
    createdRuleIds.push(ruleDisabled.id);

    const matches = await await findMatchingFallbackRulesDB("openai_codex/gpt-4o");
    assert.equal(matches.length, 3);
    assert.equal(matches[0]?.targetModel, "fallback/exact-gpt4o");
    assert.equal(matches[1]?.targetModel, "fallback/codex-prefix");
    assert.equal(matches[2]?.targetModel, "fallback/global");
});

test("findMatchingFallbackRulesDB ignores self-referencing rules", async () => {
    const loopRule = await await createFallbackRuleDB({
        sourceModel: "openai_codex/gpt-4o",
        targetModel: "openai_codex/gpt-4o",
        priority: 1,
        enabled: true
    });
    createdRuleIds.push(loopRule.id);

    const matches = await await findMatchingFallbackRulesDB("openai_codex/gpt-4o");
    assert.equal(matches.length, 0);
});