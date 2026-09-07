import { db } from "./db.js";
import { generateId, num, str, optStr } from "./row-utils.js";

export type TransactionType = "debit" | "credit" | "refund";

export interface Transaction {
    id: string;
    userId: string;
    type: TransactionType;
    amount: number;
    description: string;
    providerId?: string;
    model?: string;
    apiKeyId?: string;
    createdAt: number;
}

interface TransactionRow {
    id: string;
    user_id: string;
    type: string;
    amount: number;
    description: string;
    provider_id: string | null;
    model: string | null;
    api_key_id: string | null;
    created_at: number;
}

function mapTransactionRow(row: TransactionRow): Transaction {
    return {
        id: row.id,
        userId: str(row.user_id),
        type: row.type === "credit" ? "credit" : row.type === "refund" ? "refund" : "debit",
        amount: num(row.amount),
        description: str(row.description),
        providerId: optStr(row.provider_id),
        model: optStr(row.model),
        apiKeyId: optStr(row.api_key_id),
        createdAt: num(row.created_at)
    };
}

export async function createTransactionDB(data: {
    userId: string;
    type: TransactionType;
    amount: number;
    description: string;
    providerId?: string;
    model?: string;
    apiKeyId?: string;
}): Promise<Transaction> {
    const id = generateId("txn");
    const createdAt = Date.now();

    await db.prepare(
        `INSERT INTO transactions (id, user_id, type, amount, description, provider_id, model, api_key_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        data.userId,
        data.type,
        data.amount,
        data.description,
        data.providerId ?? null,
        data.model ?? null,
        data.apiKeyId ?? null,
        createdAt
    );

    return {
        id,
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        description: data.description,
        providerId: data.providerId,
        model: data.model,
        apiKeyId: data.apiKeyId,
        createdAt
    };
}

export async function getUserTransactionsDB(
    userId: string,
    limit = 50,
    offset = 0
): Promise<Transaction[]> {
    const rows = (await db
        .prepare(
            "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .all(userId, limit, offset)) as unknown as TransactionRow[];
    return rows.map(mapTransactionRow);
}

export async function countUserTransactionsDB(userId: string): Promise<number> {
    const row = (await db
        .prepare("SELECT COUNT(*) as cnt FROM transactions WHERE user_id = ?")
        .get(userId)) as unknown as { cnt: number };
    return num(row?.cnt);
}
