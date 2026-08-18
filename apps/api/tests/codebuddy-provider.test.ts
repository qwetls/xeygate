import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { deleteProviderDB, upsertProviderDB } from "@srouter/db";
import type { ProviderConfig } from "@srouter/types";
import { AuthLogic } from "../src/logic/auth.logic.js";
import { codeBuddyAuthHandler } from "../src/logic/auth.providers.js";

const createdIds: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const id of createdIds.splice(0)) deleteProviderDB(id);
});

test("saved CodeBuddy connections instantiate CodeBuddyExecutor and list models", async () => {
    const id = `codebuddy_test_${Date.now()}`;
    const fixtureKey = "codebuddy-test-token";
    createdIds.push(id);

    const config: ProviderConfig = {
        id,
        providerId: "codebuddy",
        name: "CodeBuddy Test",
        category: "api_key",
        protocol: "openai",
        apiKey: fixtureKey,
        enabled: true,
        createdAt: Date.now()
    };
    upsertProviderDB(config);

    const { loadSavedProvidersFromDB, registry } = await import("../src/services/registry.js");
    loadSavedProvidersFromDB();
    const provider = registry.getProvider(id);
    assert.ok(provider);
    const models = await provider.listModels();

    assert.ok(models.length > 0);
    assert.ok(models.some((m) => m.id === "codebuddy/glm-5.2"));

    registry.unregisterProvider(id);
});

test("processCodeBuddyTokenImport creates and registers CodeBuddy provider config", () => {
    const config = AuthLogic.processCodeBuddyTokenImport({
        accessToken: "test-codebuddy-key",
        name: "My CodeBuddy Account"
    });

    createdIds.push(config.id);

    assert.match(config.id, /^codebuddy_\d+$/);
    assert.equal(config.name, "My CodeBuddy Account");
    assert.equal(config.category, "api_key");
    assert.equal(config.protocol, "openai");
    assert.equal(config.baseUrl, "https://www.codebuddy.ai/v2/chat/completions");
    assert.equal(config.apiKey, "test-codebuddy-key");
    assert.equal(config.enabled, true);
    assert.equal(
        codeBuddyAuthHandler.tokenImportMessage,
        "CodeBuddy API Key / Token registered and saved directly to SQLite database!"
    );
});
