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
        category: "oauth",
        protocol: "openai",
        accessToken: fixtureKey,
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
    assert.equal(config.category, "oauth");
    assert.equal(config.protocol, "openai");
    assert.equal(config.baseUrl, "https://www.codebuddy.ai/v2/chat/completions");
    assert.equal(config.accessToken, "test-codebuddy-key");
    assert.equal(config.enabled, true);
    assert.equal(
        codeBuddyAuthHandler.tokenImportMessage,
        "CodeBuddy Access Token registered and saved directly to SQLite database!"
    );
});

test("initiateCodeBuddyOAuth requests state and creates session", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/v2/plugin/auth/state")) {
            return new Response(
                JSON.stringify({
                    code: 0,
                    msg: "ok",
                    data: {
                        state: "test-codebuddy-state-123",
                        authUrl: "https://www.codebuddy.ai/login?state=test-codebuddy-state-123"
                    }
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        return new Response("Not found", { status: 404 });
    };

    const result = await AuthLogic.initiateCodeBuddyOAuth();
    assert.equal(result.state, "test-codebuddy-state-123");
    assert.equal(
        result.authorizeUrl,
        "https://www.codebuddy.ai/login?state=test-codebuddy-state-123"
    );
});

test("pollCodeBuddyDeviceToken polls upstream and creates provider when user authorizes", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/v2/plugin/auth/token")) {
            return new Response(
                JSON.stringify({
                    code: 0,
                    msg: "ok",
                    data: {
                        accessToken: "cb-access-token-xyz",
                        refreshToken: "cb-refresh-token-xyz",
                        tokenType: "Bearer",
                        expiresIn: 86400
                    }
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        return new Response("Not found", { status: 404 });
    };

    const state = "cb-test-state-auth";
    const { saveOAuthSessionDB } = await import("@srouter/db");
    saveOAuthSessionDB({
        state,
        codeVerifier: "",
        clientId: "",
        redirectUri: "",
        createdAt: Date.now()
    });

    const result = await AuthLogic.pollCodeBuddyDeviceToken(state);
    assert.equal(result.status, "ok");
    assert.ok(result.provider);
    createdIds.push(result.provider.id);

    assert.equal(result.provider.providerId, "codebuddy");
    assert.equal(result.provider.category, "oauth");
    assert.equal(result.provider.accessToken, "cb-access-token-xyz");
    assert.equal(result.provider.refreshToken, "cb-refresh-token-xyz");
});
