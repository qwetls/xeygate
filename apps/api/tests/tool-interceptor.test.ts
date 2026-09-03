import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type {
    AIProvider,
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse
} from "@srouter/types";
import { deleteLogsByProviderDB } from "@srouter/db";
import {
    extractSearchQuery,
    isToolProvidedByClient,
    shouldInterceptToolCall
} from "../src/services/toolInterceptor.js";
import { ChatLogic } from "../src/logic/chat.logic.js";
import { registry } from "../src/services/registry.js";

test("isToolProvidedByClient detects if client declared the tool", async () => {
    assert.equal(isToolProvidedByClient(undefined, "web_search"), false);
    assert.equal(isToolProvidedByClient([], "web_search"), false);

    const clientTools = [
        { type: "function", function: { name: "execute_command" } },
        { type: "function", function: { name: "read_file" } }
    ];
    assert.equal(isToolProvidedByClient(clientTools, "web_search"), false);
    assert.equal(isToolProvidedByClient(clientTools, "read_file"), true);
});

test("shouldInterceptToolCall detects search tools not in client tools", async () => {
    assert.equal(shouldInterceptToolCall("web_search"), true);
    assert.equal(shouldInterceptToolCall("google_search"), true);
    assert.equal(shouldInterceptToolCall("bing_search"), true);
    assert.equal(shouldInterceptToolCall("read_file"), false);

    // If client explicitly provided web_search, do NOT intercept
    const toolsWithSearch = [{ type: "function", function: { name: "web_search" } }];
    assert.equal(shouldInterceptToolCall("web_search", toolsWithSearch), false);
});

test("extractSearchQuery parses JSON objects and raw strings", async () => {
    assert.equal(extractSearchQuery('{"query":"GitHub seaavey"}'), "GitHub seaavey");
    assert.equal(extractSearchQuery('{"q":"search test"}'), "search test");
    assert.equal(extractSearchQuery('{"searchTerm":"antigravity"}'), "antigravity");
    assert.equal(extractSearchQuery("raw search text"), "raw search text");
    assert.equal(extractSearchQuery(""), "");
});

const mockInterceptProviderId = "mock_search_provider";
let mockCallCount = 0;

const mockProvider: AIProvider = {
    id: mockInterceptProviderId,
    name: "Mock Intercept Search Provider",
    listModels: async () => [{ id: `${mockInterceptProviderId}/test-model`, object: "model" }],
    chatCompletion: async (req: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
        mockCallCount++;
        // On first call, return web_search tool call
        if (mockCallCount === 1) {
            return {
                id: "chatcmpl-mock-1",
                object: "chat.completion",
                created: Date.now(),
                model: req.model,
                choices: [
                    {
                        index: 0,
                        message: {
                            role: "assistant",
                            content: null,
                            tool_calls: [
                                {
                                    id: "call_web_search_1",
                                    type: "function",
                                    function: {
                                        name: "web_search",
                                        arguments: JSON.stringify({ query: "GitHub seaavey" })
                                    }
                                }
                            ]
                        },
                        finish_reason: "tool_calls"
                    }
                ]
            };
        }

        // On second call (with tool result in messages), return final answer
        const toolMsg = req.messages.find((m) => m.role === "tool");
        assert.ok(toolMsg, "Expected follow-up request to include tool result message");

        return {
            id: "chatcmpl-mock-2",
            object: "chat.completion",
            created: Date.now(),
            model: req.model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: "Found GitHub profile for seaavey."
                    },
                    finish_reason: "stop"
                }
            ]
        };
    },
    chatCompletionStream: async function* (
        req: ChatCompletionRequest
    ): AsyncGenerator<ChatCompletionChunk, void, void> {
        mockCallCount++;
        if (mockCallCount === 1) {
            // Yield tool call stream
            yield {
                id: "chunk-1",
                object: "chat.completion.chunk",
                created: Date.now(),
                model: req.model,
                choices: [
                    {
                        index: 0,
                        delta: {
                            role: "assistant",
                            tool_calls: [
                                {
                                    index: 0,
                                    id: "call_web_search_stream_1",
                                    type: "function",
                                    function: {
                                        name: "web_search",
                                        arguments: '{"query":'
                                    }
                                }
                            ]
                        },
                        finish_reason: null
                    }
                ]
            };
            yield {
                id: "chunk-2",
                object: "chat.completion.chunk",
                created: Date.now(),
                model: req.model,
                choices: [
                    {
                        index: 0,
                        delta: {
                            tool_calls: [
                                {
                                    index: 0,
                                    function: {
                                        arguments: '"GitHub seaavey"}'
                                    }
                                }
                            ]
                        },
                        finish_reason: "tool_calls"
                    }
                ]
            };
        } else {
            // Second call with tool result yielded as final answer
            yield {
                id: "chunk-3",
                object: "chat.completion.chunk",
                created: Date.now(),
                model: req.model,
                choices: [
                    {
                        index: 0,
                        delta: {
                            content: "Streaming response with search results for seaavey."
                        },
                        finish_reason: "stop"
                    }
                ]
            };
        }
    }
};

beforeEach(async () => {
    mockCallCount = 0;
    registry.registerProvider(mockProvider);
});

afterEach(async () => {
    registry.unregisterProvider(mockInterceptProviderId);
    await deleteLogsByProviderDB(mockInterceptProviderId);
});

test("ChatLogic intercepts non-streaming web_search and returns final answer without tool error", async () => {
    const req: ChatCompletionRequest = {
        model: `${mockInterceptProviderId}/test-model`,
        messages: [{ role: "user", content: "Who is GitHub seaavey?" }]
    };

    const res = await ChatLogic.processNonStreamingCompletion(req, Date.now());
    assert.equal(mockCallCount, 2);
    assert.equal(res.choices[0]?.message?.content, "Found GitHub profile for seaavey.");
});

test("ChatLogic intercepts streaming web_search and yields final answer stream to client", async () => {
    const req: ChatCompletionRequest = {
        model: `${mockInterceptProviderId}/test-model`,
        messages: [{ role: "user", content: "Who is GitHub seaavey?" }],
        stream: true
    };

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of ChatLogic.processStreamingCompletion(req, Date.now())) {
        chunks.push(chunk);
    }

    assert.equal(mockCallCount, 2);
    const text = chunks.map((c) => c.choices[0]?.delta?.content || "").join("");
    assert.equal(text, "Streaming response with search results for seaavey.");
});
