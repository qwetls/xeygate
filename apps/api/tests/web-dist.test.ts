import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { resolveWebDistPath } from "../src/services/webDist.js";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const expectedWebDist = path.join(repoRoot, "apps/web/dist");

test("resolves the dashboard when the API starts from apps/api", async () => {
    assert.equal(resolveWebDistPath(path.join(repoRoot, "apps/api")), expectedWebDist);
});
