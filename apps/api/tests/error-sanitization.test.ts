import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import {
    EnsureRequestId,
    FormatErrorPayload,
    PublicInferenceError
} from "../src/utils/response.js";

// A raw provider failure exactly as the executors raise it: status buried in
// the message text, upstream body appended verbatim.
function providerError(status: number, body: string): Error {
    return new Error(`[OI] Provider Error (${status}): ${body}`);
}

test("a provider error never reaches the client verbatim", () => {
    const raw = providerError(
        402,
        '{"error":{"type":"insufficient_quota","message":"You exceeded your current quota, please check your plan and billing details"}}'
    );

    const { message, status } = PublicInferenceError(raw);

    assert.equal(status, 402);
    assert.ok(
        !message.includes("insufficient_quota"),
        "upstream error code must not leak"
    );
    assert.ok(!message.includes("Provider Error"), "provider framing must not leak");
    assert.ok(!message.includes("billing"), "upstream advice must not leak");
    assert.match(message, /\(ref: xg-[0-9a-f]{8}\)$/, "message must carry a trace ref");
});

test("credit exhaustion reads as temporarily unavailable", () => {
    const { message, status } = PublicInferenceError(providerError(402, "out of credit"));
    assert.equal(status, 402);
    assert.match(message, /temporarily unavailable/i);
});

test("capacity and timeout failures get distinct guidance", () => {
    assert.match(PublicInferenceError(providerError(429, "slow down")).message, /capacity/i);
    assert.match(PublicInferenceError(providerError(503, "unavailable")).message, /try again/i);
    assert.match(PublicInferenceError(providerError(504, "gateway timeout")).message, /timed out/i);
});

test("an unknown failure still yields a usable message", () => {
    const { message, status } = PublicInferenceError(new Error("kaboom"));
    assert.equal(status, 500);
    assert.match(message, /could not be completed/i);
});

test("gateway-authored messages stay verbatim so the client can act on them", () => {
    // Disabled-by-admin is definitive (400) and names no provider.
    const disabled = new Error('Model "bai/hy3" is disabled on this gateway.');
    const disabledOut = PublicInferenceError(disabled);
    assert.equal(disabledOut.status, 400);
    assert.equal(disabledOut.message, disabled.message);

    // Unroutable model is a 404 the caller can correct by name.
    const unroutable = new Error(
        'No active provider connection found for model "bai/nope". Please connect a provider account in the Providers tab.'
    );
    const unroutableOut = PublicInferenceError(unroutable);
    assert.equal(unroutableOut.status, 404);
    assert.equal(unroutableOut.message, unroutable.message);
});

test("trace ids are unique per failure and shape-stable", () => {
    const a = PublicInferenceError(new Error("one")).traceId;
    const b = PublicInferenceError(new Error("two")).traceId;
    assert.notEqual(a, b);
    assert.match(a, /^xg-[0-9a-f]{8}$/);
});

test("the error body carries the trace id for correlation", () => {
    const payload = FormatErrorPayload("Model is not available right now.", 404, {
        request_id: "xg-deadbeef"
    });
    assert.equal(payload.error.request_id, "xg-deadbeef");
    assert.equal(payload.error.type, "invalid_request_error");
});

test("EnsureRequestId is stable within a request and sets the header", async () => {
    const app = new Hono();
    app.get("/probe", (c) => {
        const first = EnsureRequestId(c);
        const second = EnsureRequestId(c);
        return c.json({ first, second });
    });

    const res = await app.request("/probe");
    const body = (await res.json()) as { first: string; second: string };

    assert.equal(body.first, body.second, "one request must reuse one trace id");
    assert.equal(res.headers.get("X-Request-Id"), body.first, "header must match the body");
});
