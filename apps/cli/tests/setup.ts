/**
 * Test loader — runs BEFORE any test file via `tsx --test --import ./tests/setup.ts`.
 *
 * Redirects the database to an isolated temp file per test process so tests
 * NEVER touch the production database (`~/.srouter/srouter.db`). A previous
 * `migrate` test run wiped production API keys because it targeted that file.
 *
 * Standalone on purpose (node builtins only): importing `@srouter/db` here
 * would open the production connection before the redirect happens.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROD_DB_PATH = path.join(os.homedir(), ".srouter", "srouter.db");

function isProductionPath(p: string): boolean {
    return path.resolve(p) === path.resolve(PROD_DB_PATH);
}

// Respect an explicit non-production override (e.g. CI-provided temp DB).
const current = process.env.DATABASE_PATH;
if (!current || isProductionPath(current)) {
    const dir = path.join(os.tmpdir(), "srouter-test");
    fs.mkdirSync(dir, { recursive: true });
    // Per-process file: each `tsx --test` worker gets its own database.
    const testDb = path.join(dir, `test-${process.pid}.db`);
    // Fresh slate on (unlikely) pid reuse.
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
        try {
            fs.rmSync(`${testDb}${suffix}`, { force: true });
        } catch {
            // Ignore cleanup errors for files that may not exist.
        }
    }
    process.env.DATABASE_PATH = testDb;
    process.on("exit", () => {
        for (const suffix of ["", "-wal", "-shm", "-journal"]) {
            try {
                fs.rmSync(`${testDb}${suffix}`, { force: true });
            } catch {
                // Best-effort temp cleanup only.
            }
        }
    });
}

// Tests run against local SQLite — never a production Postgres.
if (process.env.DATABASE_URL) {
    delete process.env.DATABASE_URL;
}

process.env.NODE_ENV ??= "test";
