import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAIExecutor } from "../src/openai.js";
import type { ImageGenerationRequest } from "@srouter/types";

test("OpenAIExecutor generateImage calls images/generations endpoint", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = url.toString();
        if (init?.body) {
            capturedBody = JSON.parse(init.body.toString());
        }
        return new Response(
            JSON.stringify({
                created: 1725408000,
                data: [{ url: "https://example.com/image.png" }]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }) as unknown as typeof fetch;

    try {
        const executor = new OpenAIExecutor({
            apiKey: "test-openai-key",
            baseUrl: "https://api.openai.com/v1"
        });

        const req: ImageGenerationRequest = {
            prompt: "A beautiful sunset over mountains",
            model: "openai/dall-e-3",
            n: 1,
            size: "1024x1024",
            quality: "standard",
            response_format: "url"
        };

        const res = await executor.generateImage(req);
        assert.equal(capturedUrl, "https://api.openai.com/v1/images/generations");
        assert.equal((capturedBody as { model: string }).model, "dall-e-3");
        assert.equal(res.data[0]?.url, "https://example.com/image.png");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("OpenAIExecutor generateImage routes img2img to images/edits", async () => {
    let capturedUrl = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return new Response(
            JSON.stringify({
                created: 1725408000,
                data: [{ b64_json: "fake_b64" }]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }) as unknown as typeof fetch;

    try {
        const executor = new OpenAIExecutor({
            apiKey: "test-openai-key",
            baseUrl: "https://api.openai.com/v1"
        });

        const req: ImageGenerationRequest = {
            prompt: "Make the sky purple",
            model: "gpt-image-1.5",
            image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            n: 1,
            quality: "standard",
            response_format: "b64_json",
            size: "1024x1024"
        };

        const res = await executor.generateImage(req);
        assert.equal(capturedUrl, "https://api.openai.com/v1/images/edits");
        assert.equal(res.data[0]?.b64_json, "fake_b64");
    } finally {
        globalThis.fetch = originalFetch;
    }
});
