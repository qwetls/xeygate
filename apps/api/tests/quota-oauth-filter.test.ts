import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { deleteProviderDB, upsertProviderDB } from "@srouter/db";
import type { ProviderConfig } from "@srouter/types";
import { QuotaLogic } from "../src/logic/quota.logic.js";

const createdIds: string[] = [];

afterEach(async () => {
    for (const id of createdIds.splice(0)) {
        await deleteProviderDB(id);
    }
});

test("QuotaLogic filters out non-OAuth providers and returns only OAuth providers", async () => {
    // 1. Non-OAuth provider (regular API key)
    const apiKeyProviderId = `openai_apikey_test_${Date.now()}`;
    createdIds.push(apiKeyProviderId);
    const apiKeyConfig: ProviderConfig = {
        id: apiKeyProviderId,
        providerId: "openai",
        name: "OpenAI API Key Account",
        category: "standard",
        protocol: "openai",
        apiKey: "sk-test-key",
        enabled: true,
        createdAt: Date.now()
    };
    await upsertProviderDB(apiKeyConfig);

    // 2. OAuth provider without live token (will attempt live fetch and get caught gracefully)
    const oauthProviderId = `antigravity_test_${Date.now()}`;
    createdIds.push(oauthProviderId);
    const oauthConfig: ProviderConfig = {
        id: oauthProviderId,
        providerId: "antigravity",
        name: "Antigravity OAuth Account",
        category: "oauth",
        protocol: "antigravity",
        accessToken: "invalid-token",
        enabled: true,
        createdAt: Date.now()
    };
    await upsertProviderDB(oauthConfig);

    const result = await QuotaLogic.getQuotaInfo();

    assert.equal(result.object, "quota");
    // Should NEVER contain regular API key provider
    assert.equal(
        result.providers.some((p) => p.id === apiKeyProviderId),
        false,
        "Regular API key provider should not be included in /quota response"
    );
});
