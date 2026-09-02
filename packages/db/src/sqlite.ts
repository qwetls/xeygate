import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

/** Directory holding the SRouter database (and backups) in the user's home directory. */
export const SROUTER_DIR = path.join(os.homedir(), ".srouter");

/** Default database location: ~/.srouter/srouter.db */
export const DEFAULT_DB_PATH = path.join(SROUTER_DIR, "srouter.db");

/** Legacy database locations checked for backward compatibility (relative to cwd). */
export const LEGACY_DB_LOCATIONS = [
    path.resolve(process.cwd(), "apps/api/srouter.db"),
    path.resolve(process.cwd(), "srouter.db")
];

function getDatabasePath(): string {
    // Allow explicit override via DATABASE_PATH environment variable
    if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;

    // Fallback for legacy installations (keep existing for backward compatibility)
    for (const legacyPath of LEGACY_DB_LOCATIONS) {
        if (fs.existsSync(legacyPath)) return legacyPath;
    }

    // Return new default path and create directory if needed
    return DEFAULT_DB_PATH;
}

const dbPath = getDatabasePath();

// Ensure parent folder exists if path contains subdirectories
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

export const sqliteDb = new DatabaseSync(dbPath);

// Wait up to 5s instead of failing immediately when another connection
// (e.g. a parallel test process or the CLI) holds the write lock.
sqliteDb.exec("PRAGMA busy_timeout = 5000;");

// Enable WAL mode for high performance concurrency.
// Retry briefly — concurrent processes initializing on the same DB file
// (CI runs app test suites in parallel) can transiently hold the lock.
function execWithRetry(sql: string, attempts = 5): void {
    for (let i = 0; i < attempts; i++) {
        try {
            sqliteDb.exec(sql);
            return;
        } catch (error) {
            const code = (error as { code?: string }).code;
            if (code === "SQLITE_BUSY" && i < attempts - 1) {
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200 * (i + 1));
                continue;
            }
            throw error;
        }
    }
}

execWithRetry("PRAGMA journal_mode = WAL;");
execWithRetry("PRAGMA foreign_keys = ON;");
execWithRetry("PRAGMA synchronous = NORMAL;");
execWithRetry("PRAGMA temp_store = MEMORY;");
execWithRetry("PRAGMA cache_size = -20000;");