import assert from "node:assert/strict";
import { test } from "node:test";
import { CodeBuddyOAuth } from "../src/oauth/codebuddy.js";

const originalFetch = globalThis.fetch;

test("CodeBuddyOAuth requestAuthState sends correct headers and returns state + authUrl", async (t) => {
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    let requestedUrl = "";
    let requestedMethod = "";
    let requestedHeaders: Record<string, string> = {};

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        requestedUrl = String(input);
        requestedMethod = init?.method ?? "GET";
        requestedHeaders = (init?.headers as Record<string, string>) ?? {};

        return new Response(
            JSON.stringify({
                code: 0,
                msg: "ok",
                data: {
                    state: "test-cb-state-456",
                    authUrl: "https://www.codebuddy.ai/auth/authorize?state=test-cb-state-456"
                }
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    };

    const oauth = new CodeBuddyOAuth();
    const result = await oauth.requestAuthState();

    assert.equal(requestedMethod, "POST");
    assert.ok(requestedUrl.includes("/v2/plugin/auth/state?platform=ide"));
    assert.equal(requestedHeaders["X-Domain"], "www.codebuddy.ai");
    assert.equal(requestedHeaders["X-Product"], "SaaS");
    assert.equal(result.state, "test-cb-state-456");
    assert.equal(result.authUrl, "https://www.codebuddy.ai/auth/authorize?state=test-cb-state-456");
});

test("CodeBuddyOAuth pollToken returns pending when authorization is pending (code 11217)", async (t) => {
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                code: 11217,
                msg: "authorization pending"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

    const oauth = new CodeBuddyOAuth();
    const result = await oauth.pollToken("test-cb-state-456");

    assert.equal(result.status, "pending");
});

test("CodeBuddyOAuth pollToken returns ok with tokens on success", async (t) => {
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                code: 0,
                msg: "ok",
                data: {
                    accessToken: "cb-access-token-123",
                    refreshToken: "cb-refresh-token-123",
                    tokenType: "Bearer",
                    expiresIn: 86400
                }
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

    const oauth = new CodeBuddyOAuth();
    const result = await oauth.pollToken("test-cb-state-456");

    assert.equal(result.status, "ok");
    assert.equal(result.accessToken, "cb-access-token-123");
    assert.equal(result.refreshToken, "cb-refresh-token-123");
    assert.equal(result.expiresIn, 86400);
});
