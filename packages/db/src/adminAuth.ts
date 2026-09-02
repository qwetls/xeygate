import { db } from "./db.js";
import { getDbClient, type DbClient } from "./client.js";
import { num, str } from "./row-utils.js";

export interface AdminSession {
    tokenHash: string;
    createdAt: number;
    expiresAt: number;
}

interface AdminAccountRow {
    password_hash: string;
}

interface AdminSessionRow {
    token_hash: string;
    created_at: number;
    expires_at: number;
}

export class AdminAuthStore {
    private initialized = false;
    private readonly client: DbClient;

    /** Accept a DbClient for isolation (tests use :memory: SqliteClient); defaults to global. */
    public constructor(client?: DbClient) {
        this.client = client ?? getDbClient();
    }

    private async ensureTables(): Promise<void> {
        if (this.initialized) return;
        const pg = Boolean(process.env.DATABASE_URL);
        const integer = pg ? "BIGINT" : "INTEGER";
        await this.client.exec(`
            CREATE TABLE IF NOT EXISTS admin_account (
                id ${integer} PRIMARY KEY CHECK (id = 1),
                password_hash TEXT NOT NULL,
                created_at ${integer} NOT NULL,
                updated_at ${integer} NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admin_sessions (
                token_hash TEXT PRIMARY KEY,
                created_at ${integer} NOT NULL,
                expires_at ${integer} NOT NULL
            );
        `);
        this.initialized = true;
    }

    public async hasAdminAccount(): Promise<boolean> {
        await this.ensureTables();
        const Row = await this.client.get("SELECT 1 AS present FROM admin_account WHERE id = 1");
        return Boolean(Row);
    }

    public async createAdminAccount(passwordHash: string, now = Date.now()): Promise<boolean> {
        await this.ensureTables();
        const Result = await this.client.run(
            `INSERT INTO admin_account (id, password_hash, created_at, updated_at)
             VALUES (1, ?, ?, ?)
             ON CONFLICT(id) DO NOTHING`,
            passwordHash,
            now,
            now
        );
        return num(Result.changes) > 0;
    }

    public async getPasswordHash(): Promise<string | null> {
        await this.ensureTables();
        const Row = await this.client.get(
            "SELECT password_hash FROM admin_account WHERE id = 1"
        ) as unknown as AdminAccountRow | undefined;
        return Row?.password_hash ? str(Row.password_hash) : null;
    }

    public async updatePasswordHash(passwordHash: string, now = Date.now()): Promise<boolean> {
        await this.ensureTables();
        const Result = await this.client.run(
            `UPDATE admin_account
             SET password_hash = ?, updated_at = ?
             WHERE id = 1`,
            passwordHash,
            now
        );
        return num(Result.changes) > 0;
    }

    public async createSession(tokenHash: string, createdAt: number, expiresAt: number): Promise<void> {
        await this.ensureTables();
        await this.client.run(
            `INSERT INTO admin_sessions (token_hash, created_at, expires_at)
             VALUES (?, ?, ?)`,
            tokenHash,
            createdAt,
            expiresAt
        );
    }

    public async getSession(tokenHash: string, now = Date.now()): Promise<AdminSession | null> {
        await this.ensureTables();
        await this.client.run("DELETE FROM admin_sessions WHERE expires_at <= ?", now);

        const Row = await this.client.get(
            `SELECT token_hash, created_at, expires_at
             FROM admin_sessions
             WHERE token_hash = ? AND expires_at > ?`,
            tokenHash,
            now
        ) as unknown as AdminSessionRow | undefined;

        if (!Row) return null;

        return {
            tokenHash: str(Row.token_hash),
            createdAt: num(Row.created_at),
            expiresAt: num(Row.expires_at)
        };
    }

    public async deleteSession(tokenHash: string): Promise<boolean> {
        await this.ensureTables();
        const Result = await this.client.run(
            "DELETE FROM admin_sessions WHERE token_hash = ?",
            tokenHash
        );
        return num(Result.changes) > 0;
    }
}

export const adminAuthStore = new AdminAuthStore();