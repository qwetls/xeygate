import type { Pool as PgPool } from "pg";
import type { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);

// Lazy-load SQLite — only when DATABASE_URL is NOT set
function getSqliteDbLazy(): DatabaseSync {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync: DS } = _require("node:sqlite") as { DatabaseSync: new (...args: unknown[]) => DatabaseSync };
    const path = _require("node:path") as typeof import("node:path");
    const os = _require("node:os") as typeof import("node:os");
    const fs = _require("node:fs") as typeof import("node:fs");

    const XEYGATE_DIR = path.join(os.homedir(), ".xeygate");
    const dbPath = process.env.DATABASE_PATH || path.join(XEYGATE_DIR, "xeygate.db");

    if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    const db = new DS(dbPath);
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec("PRAGMA journal_mode = WAL;");
    return db;
}

// ──────────────────────────────────────────────────
// DbClient interface — async so it works for both
// node:sqlite (sync → wrapped) and pg (native async)
// ──────────────────────────────────────────────────

export interface DbResult {
    changes: number;
}

export interface DbClient {
    all(sql: string, ...params: unknown[]): Promise<unknown[]>;
    get(sql: string, ...params: unknown[]): Promise<unknown>;
    run(sql: string, ...params: unknown[]): Promise<DbResult>;
    exec(sql: string): Promise<void>;
    /** Column names of a table (for ensureColumns migration). */
    tableColumns(table: string): Promise<string[]>;
}

// ──────────────────────────────────────────────────
// SQLite implementation (wraps node:sqlite DatabaseSync)
// ──────────────────────────────────────────────────

type SQLInputValue = string | number | null | bigint | Uint8Array;

export class SqliteClient implements DbClient {
    constructor(private readonly db: DatabaseSync) {}

    /** Normalize undefined → null (node:sqlite previously tolerated undefined; pg needs null). */
    private normalizeParams(params: unknown[]): SQLInputValue[] {
        return params.map((p) => (p === undefined ? null : (p as SQLInputValue)));
    }

    all(sql: string, ...params: unknown[]): Promise<unknown[]> {
        return Promise.resolve(
            this.db.prepare(sql).all(...this.normalizeParams(params)) as unknown[]
        );
    }

    get(sql: string, ...params: unknown[]): Promise<unknown> {
        return Promise.resolve(this.db.prepare(sql).get(...this.normalizeParams(params)));
    }

    run(sql: string, ...params: unknown[]): Promise<DbResult> {
        const result = this.db.prepare(sql).run(...this.normalizeParams(params));
        return Promise.resolve(result as unknown as DbResult);
    }

    exec(sql: string): Promise<void> {
        this.db.exec(sql);
        return Promise.resolve();
    }

    async tableColumns(table: string): Promise<string[]> {
        const rows = (await this.all(`PRAGMA table_info("${table}")`)) as Array<{
            name: string;
        }>;
        return rows.map((r) => r.name);
    }
}

// ──────────────────────────────────────────────────
// PostgreSQL implementation (wraps pg.Pool)
// ──────────────────────────────────────────────────

let pgPool: PgPool | null = null;

async function getPool(): Promise<PgPool> {
    if (pgPool) return pgPool;
    const { Pool } = await import("pg");
    pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        // Heroku Postgres requires TLS; self-signed cert → rejectUnauthorized: false
        ssl: { rejectUnauthorized: false }
    });
    return pgPool;
}

/** Convert SQLite `?` placeholders to PG `$1`, `$2`, ... */
function toPg(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

/** Split a SQL script into individual statements on top-level semicolons (ignores quotes/strings). */
function splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = "";
    let inSingle = false;
    let inDouble = false;
    let inDollar = false;
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = sql[i + 1];
        if (!inDollar && !inSingle && !inDouble && ch === "'") {
            inSingle = true;
        } else if (inSingle && ch === "'" && next !== "'") {
            inSingle = false;
        } else if (!inDollar && !inSingle && !inDouble && ch === '"') {
            inDouble = true;
        } else if (inDouble && ch === '"' && next !== '"') {
            inDouble = false;
        } else if (!inSingle && !inDouble && ch === "$" && /^[a-zA-Z_0-9]*\$/.test(sql.slice(i, i + 40))) {
            inDollar = true;
        } else if (inDollar && ch === "$" && next !== "$") {
            // crude dollar-quote end detection: only terminates if same tag — acceptable for our DDL
            inDollar = false;
        } else if (!inSingle && !inDouble && !inDollar && ch === ";") {
            if (current.trim()) statements.push(current.trim());
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim()) statements.push(current.trim());
    return statements;
}

export class PgClient implements DbClient {
    /** Normalize undefined → null (pg rejects undefined params). */
    private normalizeParams(params: unknown[]): unknown[] {
        return params.map((p) => (p === undefined ? null : p));
    }

    async all(sql: string, ...params: unknown[]): Promise<unknown[]> {
        const pool = await getPool();
        const result = await pool.query(toPg(sql), this.normalizeParams(params));
        return result.rows;
    }

    async get(sql: string, ...params: unknown[]): Promise<unknown> {
        const pool = await getPool();
        const result = await pool.query(toPg(sql), this.normalizeParams(params));
        return result.rows[0] ?? null;
    }

    async run(sql: string, ...params: unknown[]): Promise<DbResult> {
        const pool = await getPool();
        const result = await pool.query(toPg(sql), this.normalizeParams(params));
        return { changes: result.rowCount ?? 0 };
    }

    async exec(sql: string): Promise<void> {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith("PRAGMA")) return;

        const pool = await getPool();
        // pg driver rejects multiple statements in a single query() call.
        // Split on top-level semicolons and execute each separately.
        const statements = splitStatements(sql);
        for (const stmt of statements) {
            await pool.query(stmt);
        }
    }

    async tableColumns(table: string): Promise<string[]> {
        const rows = (await this.all(
            "SELECT column_name AS name FROM information_schema.columns WHERE table_name = $1",
            table
        )) as Array<{ name: string }>;
        return rows.map((r) => r.name);
    }
}

// ──────────────────────────────────────────────────
// Singleton factory
// ──────────────────────────────────────────────────

let _client: DbClient | null = null;

export function getDbClient(): DbClient {
    if (_client) return _client;

    if (process.env.DATABASE_URL) {
        _client = new PgClient();
    } else {
        _client = new SqliteClient(getSqliteDbLazy());
    }

    return _client;
}

export function setDbClient(client: DbClient): void {
    _client = client;
}

/** Expose the raw SQLite DatabaseSync for tests/legacy paths. */
export function getSqliteDb() {
    return getSqliteDbLazy();
}