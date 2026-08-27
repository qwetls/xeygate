#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distEntry = path.join(__dirname, "../dist/index.js");

if (fs.existsSync(distEntry)) {
    await import("../dist/index.js");
} else {
    console.error("Error: @srouter/cli distribution entry not found at " + distEntry);
    process.exit(1);
}

