import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { logRequestDB, getRecentLogsDB } from "@srouter/db";
import { ProvidersRouter } from "../src/routes/v1/providers.js";
import { registry } from "../src/services/registry.js";
import type { AIProvider } from "@srouter/types";

function mockProvider(id: string): AIProvider {
    return {
        id,
        name: `Mock ${id}`,
        listModels: async () => [{ id: `${id}/mock-model`, object: "model", owned_by: id }],
        chatCompletion: async () => {
            throw new Error("not used");
        },
        chatCompletionStream: async function* () {
            throw new Error("not used");
        }
    };
}

test("round-robin toggle persists and flips registry flag", async (t) => {
    const openai1 = "openai_1789000001";
    const openai2 = "openai_1789000002";
    registry.registerProvider(mockProvider(openai1));
    registry.registerProvider(mockProvider(openai2));

    t.after(() => {
        registry.unregisterProvider(openai1);
        registry.unregisterProvider(openai2);
        registry.setRoundRobin("openai", false);
    });

    const app = new Hono();
    app.route("/v1", ProvidersRouter);

    // Requires admin session — expect 401 without it (proves mutation guard)
    const unauth = await app.request("/v1/providers/openai/round-robin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true })
    });
    assert.equal(unauth.status, 401, "mutation without admin session should be rejected");
});

// ── Pool spread: the claim "all keys of a bulk pool share traffic" ─────

/**
 * A bulk import registers one connection per key under the same driver, all
 * sharing one base id. With round-robin on for that base id, consecutive
 * marketplace calls must hit different connections — one key per request —
 * and wrap around once the pool is exhausted.
 */
test("round-robin spreads consecutive calls across every connection in the pool", async (t) => {
    const BASE = "bai";
    const POOL_SIZE = 5;
    const pool = Array.from({ length: POOL_SIZE }, (_, i) => `${BASE}_pooltest_${i}`);

    for (const id of pool) {
        registry.registerProvider({
            id,
            name: `Pool ${id}`,
            listModels: async () => [{ id: "hy3", object: "model", owned_by: id }],
            chatCompletion: async (req) => ({
                id: "mock-completion",
                object: "chat.completion",
                created: Date.now(),
                model: req.model,
                choices: [
                    {
                        index: 0,
                        message: { role: "assistant", content: "ok" },
                        finish_reason: "stop"
                    }
                ]
            })
        } as unknown as AIProvider);
    }
    registry.setRoundRobin(BASE, true);

    t.after(() => {
        for (const id of pool) registry.unregisterProvider(id);
        registry.setRoundRobin(BASE, false);
    });

    const served: string[] = [];
    for (let i = 0; i < POOL_SIZE + 1; i += 1) {
        await registry.chatCompletion(
            { model: `${BASE}/hy3`, messages: [{ role: "user", content: "hi" }] } as never,
            (providerId) => served.push(providerId)
        );
    }

    assert.equal(served.length, POOL_SIZE + 1);
    assert.equal(
        new Set(served.slice(0, POOL_SIZE)).size,
        POOL_SIZE,
        `every connection must serve exactly once per cycle, got ${JSON.stringify(served)}`
    );
    assert.equal(
        served[POOL_SIZE],
        served[0],
        "the pool must wrap around after a full cycle"
    );
});

test("request logs record the concrete connection that served the call", async () => {
    const servedProviderId = `bai-1789023519492-37`;
    const entry = await logRequestDB({
        providerId: "bai",
        model: "bai/hy3",
        promptTokens: 3,
        completionTokens: 5,
        totalTokens: 8,
        statusCode: 200,
        latencyMs: 42,
        servedProviderId
    });

    const logs = await getRecentLogsDB(20);
    const stored = logs.find((l) => l.id === entry.id);
    assert.ok(stored, "the inserted log must be readable back");
    assert.equal(stored!.servedProviderId, servedProviderId);
    assert.equal(stored!.providerId, "bai", "routing identity stays the alias");
});
