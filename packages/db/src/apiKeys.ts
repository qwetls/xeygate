import type { APIKeyZod } from "@srouter/types";
import { db } from "./db.js";
import { randomUUID } from "node:crypto";
import { generateId, num, str } from "./row-utils.js";

interface APIKeyRow {
    id: string;
    key: string;
    name: string;
    enabled: number;
    rate_limit: number;
    quota_limit: number;
    usage_tokens: number;
    credit_limit: number;
    usage_cost: number;
    allowed_models: string | null;
    created_at: number;
    user_id: string | null;
}

function ParseAllowedModels(value: string | null): string[] | null {
    if (!value) return null;
    try {
        const Parsed: unknown = JSON.parse(value);
        if (Array.isArray(Parsed) && Parsed.every((item) => typeof item === "string")) {
            return Parsed.length > 0 ? (Parsed as string[]) : null;
        }
    } catch {}
    return null;
}

export async function getAllAPIKeysDB(): Promise<APIKeyZod[]> {
    const Rows = (await db
        .prepare("SELECT * FROM api_keys ORDER BY created_at DESC")
        .all()) as unknown as APIKeyRow[];
    return Rows.map(mapAPIKeyRow);
}

export async function getAPIKeyByKeyDB(key: string): Promise<APIKeyZod | null> {
    const Row = (await db
        .prepare("SELECT * FROM api_keys WHERE key = ? AND enabled = 1")
        .get(key)) as unknown as APIKeyRow | undefined;
    if (!Row) return null;
    return mapAPIKeyRow(Row);
}

function mapAPIKeyRow(row: APIKeyRow): APIKeyZod {
    return {
        id: row.id,
        key: row.key,
        name: row.name,
        enabled: Boolean(row.enabled),
        rate_limit: row.rate_limit ?? 0,
        quota_limit: row.quota_limit ?? 0,
        usage_tokens: row.usage_tokens ?? 0,
        credit_limit: row.credit_limit ?? 0,
        usage_cost: row.usage_cost ?? 0,
        allowed_models: ParseAllowedModels(row.allowed_models),
        created_at: row.created_at,
        user_id: row.user_id ?? undefined
    };
}

export async function createAPIKeyDB(data: {
    name: string;
    enabled?: boolean;
    rate_limit?: number;
    quota_limit?: number;
    credit_limit?: number;
    rateLimit?: number;
    quotaLimit?: number;
    creditLimit?: number;
    allowed_models?: string[] | null;
}): Promise<APIKeyZod> {
    const Id = generateId("key");
    const RandomHex = randomUUID().replace(/-/g, "").slice(0, 16);
    const Key = `sr-live-${RandomHex}`;
    const CreatedAt = Date.now();
    const AllowedModels =
        data.allowed_models && data.allowed_models.length > 0 ? data.allowed_models : null;
    const AllowedModelsJson = AllowedModels ? JSON.stringify(AllowedModels) : null;
    const RateLimit = data.rate_limit ?? data.rateLimit ?? 0;
    const QuotaLimit = data.quota_limit ?? data.quotaLimit ?? 0;
    const CreditLimit = data.credit_limit ?? data.creditLimit ?? 0;
    const Enabled = data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1;

    await db.prepare(`
        INSERT INTO api_keys (id, key, name, enabled, rate_limit, quota_limit, usage_tokens, credit_limit, usage_cost, allowed_models, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)
    `).run(
        Id,
        Key,
        data.name,
        Enabled,
        RateLimit,
        QuotaLimit,
        CreditLimit,
        AllowedModelsJson,
        CreatedAt
    );

    return {
        id: Id,
        key: Key,
        name: data.name,
        enabled: Boolean(Enabled),
        rate_limit: RateLimit,
        quota_limit: QuotaLimit,
        usage_tokens: 0,
        credit_limit: CreditLimit,
        usage_cost: 0,
        allowed_models: AllowedModels,
        created_at: CreatedAt
    };
}

export async function incrementAPIKeyUsageDB(keyId: string, tokens: number, cost = 0): Promise<void> {
    await db.prepare(
        "UPDATE api_keys SET usage_tokens = usage_tokens + ?, usage_cost = usage_cost + ? WHERE id = ?"
    ).run(tokens, cost, keyId);
}

export async function getAPIKeyByIdDB(id: string): Promise<APIKeyZod | null> {
    const Row = (await db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id)) as unknown as
        | APIKeyRow
        | undefined;
    if (!Row) return null;
    return mapAPIKeyRow(Row);
}

export async function addCreditAPIKeyDB(id: string, amount: number): Promise<APIKeyZod | null> {
    await db.prepare("UPDATE api_keys SET credit_limit = credit_limit + ? WHERE id = ?").run(amount, id);

    const Row = (await db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id)) as unknown as
        | APIKeyRow
        | undefined;
    if (!Row) return null;
    return mapAPIKeyRow(Row);
}

export async function updateAPIKeyDB(
    id: string,
    data: {
        name?: string;
        enabled?: boolean;
        rate_limit?: number;
        quota_limit?: number;
        credit_limit?: number;
        rateLimit?: number;
        quotaLimit?: number;
        creditLimit?: number;
        allowed_models?: string[] | null;
    }
): Promise<APIKeyZod | null> {
    const existing = (await db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id)) as unknown as
        | APIKeyRow
        | undefined;
    if (!existing) return null;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
        fields.push("name = ?");
        values.push(data.name.trim());
    }
    if (data.enabled !== undefined) {
        fields.push("enabled = ?");
        values.push(data.enabled ? 1 : 0);
    }
    const rateLimit = data.rate_limit ?? data.rateLimit;
    if (rateLimit !== undefined) {
        fields.push("rate_limit = ?");
        values.push(rateLimit);
    }
    const quotaLimit = data.quota_limit ?? data.quotaLimit;
    if (quotaLimit !== undefined) {
        fields.push("quota_limit = ?");
        values.push(quotaLimit);
    }
    const creditLimit = data.credit_limit ?? data.creditLimit;
    if (creditLimit !== undefined) {
        fields.push("credit_limit = ?");
        values.push(creditLimit);
    }
    if (data.allowed_models !== undefined) {
        fields.push("allowed_models = ?");
        const json =
            data.allowed_models && data.allowed_models.length > 0
                ? JSON.stringify(data.allowed_models)
                : null;
        values.push(json);
    }

    if (fields.length > 0) {
        values.push(id);
        await db.prepare(`UPDATE api_keys SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    const updatedRow = (await db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id)) as unknown as
        | APIKeyRow
        | undefined;
    return updatedRow ? mapAPIKeyRow(updatedRow) : null;
}

export async function deleteAPIKeyDB(id: string): Promise<boolean> {
    const Result = await db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
    return num(Result.changes) > 0;
}