import { db } from "./db.js";
import { getDbClient, type DbClient } from "./client.js";
import { num, str } from "./row-utils.js";

export interface User {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    credits: number;
    createdAt: number;
    updatedAt: number;
}

export interface UserSession {
    tokenHash: string;
    userId: string;
    createdAt: number;
    expiresAt: number;
}

interface UserRow {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    credits: number;
    created_at: number;
    updated_at: number;
}

interface UserSessionRow {
    token_hash: string;
    user_id: string;
    created_at: number;
    expires_at: number;
}

export class UserAuthStore {
    private initialized = false;
    private readonly client: DbClient;

    public constructor(client?: DbClient) {
        this.client = client ?? getDbClient();
    }

    private async ensureTables(): Promise<void> {
        if (this.initialized) return;
        const pg = Boolean(process.env.DATABASE_URL);
        const integer = pg ? "BIGINT" : "INTEGER";
        await this.client.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                credits ${pg ? "DOUBLE PRECISION" : "REAL"} NOT NULL DEFAULT 0,
                created_at ${integer} NOT NULL,
                updated_at ${integer} NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at ${integer} NOT NULL,
                expires_at ${integer} NOT NULL
            );
        `);
        // Ensure user_id column exists on api_keys (for linking keys to users)
        try {
            await this.client.exec(`ALTER TABLE api_keys ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL`);
        } catch {
            // Column already exists
        }
        this.initialized = true;
    }

    public async getUserByEmail(email: string): Promise<User | null> {
        await this.ensureTables();
        const Row = (await this.client.get(
            "SELECT * FROM users WHERE email = ?",
            email.toLowerCase().trim()
        )) as unknown as UserRow | undefined;
        if (!Row) return null;
        return mapUserRow(Row);
    }

    public async getUserById(id: string): Promise<User | null> {
        await this.ensureTables();
        const Row = (await this.client.get(
            "SELECT * FROM users WHERE id = ?",
            id
        )) as unknown as UserRow | undefined;
        if (!Row) return null;
        return mapUserRow(Row);
    }

    public async createUser(data: {
        email: string;
        passwordHash: string;
        name?: string;
    }): Promise<User | null> {
        await this.ensureTables();
        const id = `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
        const now = Date.now();
        const email = data.email.toLowerCase().trim();

        try {
            await this.client.run(
                `INSERT INTO users (id, email, password_hash, name, credits, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 0, ?, ?)`,
                id, email, data.passwordHash, data.name ?? "", now, now
            );
        } catch {
            // Duplicate email
            return null;
        }

        return this.getUserById(id);
    }

    public async updateCredits(userId: string, delta: number): Promise<User | null> {
        await this.ensureTables();
        await this.client.run(
            `UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?`,
            delta, Date.now(), userId
        );
        return this.getUserById(userId);
    }

    // ── Sessions ──

    public async createSession(tokenHash: string, userId: string, now = Date.now()): Promise<void> {
        await this.ensureTables();
        const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days
        await this.client.run(
            `INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at)
             VALUES (?, ?, ?, ?)`,
            tokenHash, userId, now, expiresAt
        );
    }

    public async getSession(tokenHash: string, now = Date.now()): Promise<UserSession | null> {
        await this.ensureTables();
        await this.client.run("DELETE FROM user_sessions WHERE expires_at <= ?", now);
        const Row = (await this.client.get(
            `SELECT token_hash, user_id, created_at, expires_at
             FROM user_sessions WHERE token_hash = ? AND expires_at > ?`,
            tokenHash, now
        )) as unknown as UserSessionRow | undefined;
        if (!Row) return null;
        return {
            tokenHash: str(Row.token_hash),
            userId: str(Row.user_id),
            createdAt: num(Row.created_at),
            expiresAt: num(Row.expires_at)
        };
    }

    public async deleteSession(tokenHash: string): Promise<boolean> {
        await this.ensureTables();
        const Result = await this.client.run(
            "DELETE FROM user_sessions WHERE token_hash = ?", tokenHash
        );
        return num(Result.changes) > 0;
    }

    // ── User's API Keys ──

    public async getUserKeys(userId: string): Promise<Array<{ id: string; name: string; key: string; enabled: boolean; usageTokens: number; creditLimit: number; usageCost: number; createdAt: number }>> {
        await this.ensureTables();
        const Rows = (await this.client.all(
            `SELECT id, name, key, enabled, usage_tokens, credit_limit, usage_cost, created_at
             FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
            userId
        )) as unknown as Array<{ id: string; name: string; key: string; enabled: number; usage_tokens: number; credit_limit: number; usage_cost: number; created_at: number }>;
        return Rows.map((r) => ({
            id: str(r.id),
            name: str(r.name),
            key: str(r.key),
            enabled: Boolean(r.enabled),
            usageTokens: num(r.usage_tokens),
            creditLimit: num(r.credit_limit),
            usageCost: num(r.usage_cost),
            createdAt: num(r.created_at)
        }));
    }

    public async createUserKey(userId: string, name: string): Promise<{ id: string; name: string; key: string } | null> {
        await this.ensureTables();
        const id = `key_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
        const key = `xg_${crypto.randomUUID().replace(/-/g, "")}`;
        const now = Date.now();
        try {
            await this.client.run(
                `INSERT INTO api_keys (id, key, name, enabled, rate_limit, quota_limit, usage_tokens, credit_limit, usage_cost, created_at, user_id)
                 VALUES (?, ?, ?, 1, 0, 0, 0, 0, 0, ?, ?)`,
                id, key, name, now, userId
            );
            return { id, name, key };
        } catch {
            return null;
        }
    }

    public async deleteUserKey(userId: string, keyId: string): Promise<boolean> {
        await this.ensureTables();
        const Result = await this.client.run(
            "DELETE FROM api_keys WHERE id = ? AND user_id = ?", keyId, userId
        );
        return num(Result.changes) > 0;
    }

    // ── User Usage Stats ──

    public async getUserUsage(userId: string): Promise<{ totalRequests: number; totalTokens: number; totalCost: number; byModel: Array<{ model: string; tokens: number; cost: number }> }> {
        await this.ensureTables();
        const keyRows = (await this.client.all(
            "SELECT id FROM api_keys WHERE user_id = ?", userId
        )) as unknown as Array<{ id: string }>;
        if (keyRows.length === 0) return { totalRequests: 0, totalTokens: 0, totalCost: 0, byModel: [] };
        const keyIds = keyRows.map((r) => str(r.id));
        const placeholders = keyIds.map(() => "?").join(",");

        const totalRow = (await this.client.get(
            `SELECT COUNT(*) as total_requests, COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(SUM(estimated_cost), 0) as total_cost
             FROM request_logs WHERE api_key_id IN (${placeholders})`,
            ...keyIds
        )) as unknown as { total_requests: number; total_tokens: number; total_cost: number } | undefined;

        const byModelRows = (await this.client.all(
            `SELECT model, COALESCE(SUM(total_tokens), 0) as tokens, COALESCE(SUM(estimated_cost), 0) as cost
             FROM request_logs WHERE api_key_id IN (${placeholders})
             GROUP BY model ORDER BY tokens DESC LIMIT 20`,
            ...keyIds
        )) as unknown as Array<{ model: string; tokens: number; cost: number }>;

        return {
            totalRequests: num(totalRow?.total_requests ?? 0),
            totalTokens: num(totalRow?.total_tokens ?? 0),
            totalCost: num(totalRow?.total_cost ?? 0),
            byModel: byModelRows.map((r) => ({ model: str(r.model), tokens: num(r.tokens), cost: num(r.cost) }))
        };
    }
}

function mapUserRow(row: UserRow): User {
    return {
        id: str(row.id),
        email: str(row.email),
        passwordHash: str(row.password_hash),
        name: str(row.name),
        credits: num(row.credits),
        createdAt: num(row.created_at),
        updatedAt: num(row.updated_at)
    };
}

export const userAuthStore = new UserAuthStore();
