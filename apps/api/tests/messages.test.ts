import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Hono } from "hono";
import {
    createAPIKeyDB,
    deleteAPIKeyDB,
    deleteLogsByProviderDB,
    deleteProviderDB,
    setRequireApiKeyDB,
    upsertProviderDB
} from "@srouter/db";
import type {
    AIProvider,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ProviderConfig
} from "@srouter/types";
import { MessagesRouter } from "../src/routes/v1/messages.js";

const app = new Hono();
app.route("/v1", MessagesRouter);
app.route("/", MessagesRouter);

const createdKeyIds: string[] = [];
const createdProviderIds: string[] = [];

afterEach(async () => {
    setRequireApiKeyDB(false);
    for (const id of createdKeyIds.splice(0)) {
        deleteAPIKeyDB(id);
    }
    const { registry } = await import("../src/services/registry.js");
    for (const id of createdProviderIds.splice(0)) {
        deleteLogsByProviderDB(id);
        deleteProviderDB(id);
        registry.unregisterProvider(id);
    }
    deleteLogsByProviderDB("anthropic_test");
    deleteLogsByProviderDB("mock-auth-provider");
    deleteLogsByProviderDB("mock-model");
});

test("POST /v1/messages returns Anthropic message response for non-streaming request", async () => {
    const { registry } = await import("../src/services/registry.js");
    const mockProvider: AIProvider = {
        id: "anthropic_test",
        name: "Mock Anthropic Provider",
        listModels: async () => [{ id: "claude-3-7-sonnet-20250219", object: "model" }],
        chatCompletion: async (req: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
            return {
                id: "chatcmpl-mock-123",
                object: "chat.completion",
                created: 1786759000,
                model: req.model,
                choices: [
                    {
                        index: 0,
                        message: {
                            role: "assistant",
                            content: "Hello from Claude via SRouter!"
                        },
                        finish_reason: "stop"
                    }
                ],
                usage: {
                    prompt_tokens: 15,
                    completion_tokens: 8,
                    total_tokens: 23
                }
            };
        },
        chatCompletionStream: async function* () {}
    };
    registry.registerProvider(mockProvider);
    createdProviderIds.push(mockProvider.id);

    const res = await app.request("/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
            model: "claude-3-7-sonnet-20250219",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 1024,
            stream: false
        })
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as {
        id: string;
        type: string;
        role: string;
        content: Array<{ type: string; text: string }>;
        model: string;
        stop_reason: string;
        usage: { input_tokens: number; output_tokens: number };
    };

    assert.equal(data.type, "message");
    assert.equal(data.role, "assistant");
    assert.equal(data.model, "claude-3-7-sonnet-20250219");
    assert.equal(data.stop_reason, "end_turn");
    assert.equal(data.content[0]?.type, "text");
    assert.equal(data.content[0]?.text, "Hello from Claude via SRouter!");
    assert.equal(data.usage.input_tokens, 15);
    assert.equal(data.usage.output_tokens, 8);
});

test("POST /v1/messages authenticates with x-api-key header when require_api_key is true", async () => {
    setRequireApiKeyDB(true);
    const keyRecord = createAPIKeyDB({ name: "Claude Code Key" });
    createdKeyIds.push(keyRecord.id);

    const { registry } = await import("../src/services/registry.js");
    const mockProvider: AIProvider = {
        id: "mock_auth_provider",
        name: "Mock Auth Provider",
        listModels: async () => [{ id: "mock-auth-provider/test-model", object: "model" }],
        chatCompletion: async (req: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
            return {
                id: "chatcmpl-mock-456",
                object: "chat.completion",
                created: 1786759000,
                model: req.model,
                choices: [
                    {
                        index: 0,
                        message: {
                            role: "assistant",
                            content: "Authenticated successfully with x-api-key!"
                        },
                        finish_reason: "stop"
                    }
                ],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
            };
        },
        chatCompletionStream: async function* () {}
    };
    registry.registerProvider(mockProvider);
    createdProviderIds.push(mockProvider.id);

    // 1. Request with invalid key -> 401
    const resInvalid = await app.request("/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": "invalid-key-token"
        },
        body: JSON.stringify({
            model: "mock-auth-provider/test-model",
            messages: [{ role: "user", content: "Test" }],
            max_tokens: 512
        })
    });
    assert.equal(resInvalid.status, 401);

    // 2. Request with valid x-api-key -> 200
    const resValid = await app.request("/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": keyRecord.key
        },
        body: JSON.stringify({
            model: "mock-auth-provider/test-model",
            messages: [{ role: "user", content: "Test" }],
            max_tokens: 512
        })
    });
    assert.equal(resValid.status, 200);
    const data = (await resValid.json()) as { content: Array<{ text: string }> };
    assert.equal(data.content[0]?.text, "Authenticated successfully with x-api-key!");
});

test("POST /v1/messages streams Anthropic SSE events", async () => {
    const { registry } = await import("../src/services/registry.js");
    const mockProvider: AIProvider = {
        id: "stream_provider_test",
        name: "Mock Stream Provider",
        listModels: async () => [{ id: "mock-model", object: "model" }],
        chatCompletion: async () => {
            throw new Error("not used");
        },
        chatCompletionStream: async function* () {
            yield {
                id: "chunk-1",
                object: "chat.completion.chunk",
                created: 1786759000,
                model: "mock-model",
                choices: [
                    {
                        index: 0,
                        delta: { role: "assistant", content: "Chunk 1 " },
                        finish_reason: null
                    }
                ]
            };
            yield {
                id: "chunk-2",
                object: "chat.completion.chunk",
                created: 1786759000,
                model: "mock-model",
                choices: [{ index: 0, delta: { content: "Chunk 2" }, finish_reason: "stop" }]
            };
        }
    };
    registry.registerProvider(mockProvider);
    createdProviderIds.push(mockProvider.id);

    const res = await app.request("/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "mock-model",
            messages: [{ role: "user", content: "Stream test" }],
            max_tokens: 256,
            stream: true
        })
    });

    assert.equal(res.status, 200);
    const sseText = await res.text();
    assert.ok(sseText.includes("event: message_start"));
    assert.ok(sseText.includes("event: content_block_start"));
    assert.ok(sseText.includes("event: content_block_delta"));
    assert.ok(sseText.includes("event: message_delta"));
    assert.ok(sseText.includes("event: message_stop"));
    assert.ok(sseText.includes("Chunk 1 "));
    assert.ok(sseText.includes("Chunk 2"));
});
