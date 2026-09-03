import assert from "node:assert/strict";
import { test } from "node:test";
import { AntigravityExecutor } from "../src/antigravity.js";

test("AntigravityExecutor initializes with default options", () => {
    const executor = new AntigravityExecutor();
    assert.equal(executor.id, "antigravity");
    assert.equal(executor.category, "oauth");
    assert.equal(executor.protocol, "openai");
});

test("AntigravityExecutor lists official models with accessToken", async () => {
    const executor = new AntigravityExecutor({
        accessToken: "ya29.test_token"
    });
    const models = await executor.listModels();
    assert.ok(models.length > 0);
    const flashModel = models.find((m) => m.id === "gemini-3.7-flash-high");
    assert.ok(flashModel);
    assert.equal(flashModel.owned_by, "antigravity");

    // gemini-3.8-flash must be present in the official Antigravity model list
    const flash38 = models.find((m) => m.id === "gemini-3.8-flash-high");
    assert.ok(flash38, "gemini-3.8-flash-high must be listed");
    assert.equal(flash38.owned_by, "antigravity");
});

test("AntigravityExecutor accepts Google One AI credits options", () => {
    const executor = new AntigravityExecutor({
        accessToken: "ya29.test_token",
        enabledCreditTypes: ["GOOGLE_ONE_AI"],
        creditsMode: "always"
    });
    assert.equal(executor.getRemainingCredits(), undefined);
});
