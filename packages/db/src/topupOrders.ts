import { db } from "./db.js";
import { generateId, num, str, optStr } from "./row-utils.js";

// ─────────────────────────────────────────────────────
// Wallet top-up orders — buyer-initiated credit purchases.
// Buyers create an order for a chosen amount and pay out of band;
// an admin verifies the payment and approves the order, which credits
// the wallet and writes a matching ledger row. Money never moves in
// this table — it only tracks the request lifecycle.
// ─────────────────────────────────────────────────────

export type TopupStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface TopupOrder {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    status: TopupStatus;
    reference?: string;
    note?: string;
    requestedAt: number;
    processedAt?: number;
    processedBy?: string;
}

interface TopupRow {
    id: string;
    user_id: string;
    amount: number;
    currency: string;
    status: string;
    reference: string | null;
    note: string | null;
    requested_at: number;
    processed_at: number | null;
    processed_by: string | null;
}

function mapTopupRow(row: TopupRow): TopupOrder {
    const status =
        row.status === "approved" || row.status === "rejected" || row.status === "cancelled"
            ? row.status
            : "pending";
    return {
        id: str(row.id),
        userId: str(row.user_id),
        amount: num(row.amount),
        currency: str(row.currency, "USD"),
        status,
        reference: optStr(row.reference),
        note: optStr(row.note),
        requestedAt: num(row.requested_at),
        processedAt: row.processed_at == null ? undefined : num(row.processed_at),
        processedBy: optStr(row.processed_by)
    };
}

export async function createTopupOrderDB(data: {
    userId: string;
    amount: number;
    reference?: string;
}): Promise<TopupOrder> {
    const id = generateId("top");
    const now = Date.now();
    await db.prepare(
        `INSERT INTO topup_orders (id, user_id, amount, currency, status, reference, note, requested_at, processed_at, processed_by)
         VALUES (?, ?, ?, 'USD', 'pending', ?, NULL, ?, NULL, NULL)`
    ).run(id, data.userId, data.amount, data.reference ?? null, now);
    return {
        id,
        userId: data.userId,
        amount: data.amount,
        currency: "USD",
        status: "pending",
        reference: data.reference,
        requestedAt: now
    };
}

export async function getTopupOrderDB(id: string): Promise<TopupOrder | null> {
    const row = (await db
        .prepare("SELECT * FROM topup_orders WHERE id = ?")
        .get(id)) as unknown as TopupRow | undefined;
    return row ? mapTopupRow(row) : null;
}

export async function listTopupOrdersDB(
    userId: string,
    limit = 50,
    offset = 0
): Promise<TopupOrder[]> {
    const rows = (await db
        .prepare(
            "SELECT * FROM topup_orders WHERE user_id = ? ORDER BY requested_at DESC LIMIT ? OFFSET ?"
        )
        .all(userId, limit, offset)) as unknown as TopupRow[];
    return rows.map(mapTopupRow);
}

export async function countTopupOrdersDB(userId: string): Promise<number> {
    const row = (await db
        .prepare("SELECT COUNT(*) AS count FROM topup_orders WHERE user_id = ?")
        .get(userId)) as unknown as { count: number } | undefined;
    return num(row?.count);
}

export async function getPendingTopupOrderDB(userId: string): Promise<TopupOrder | null> {
    const row = (await db
        .prepare(
            "SELECT * FROM topup_orders WHERE user_id = ? AND status = 'pending' ORDER BY requested_at DESC LIMIT 1"
        )
        .get(userId)) as unknown as TopupRow | undefined;
    return row ? mapTopupRow(row) : null;
}

export async function listAllTopupOrdersDB(
    status: "pending" | "all" = "pending",
    limit = 100
): Promise<TopupOrder[]> {
    const sql =
        status === "pending"
            ? "SELECT * FROM topup_orders WHERE status = 'pending' ORDER BY requested_at ASC LIMIT ?"
            : "SELECT * FROM topup_orders ORDER BY requested_at DESC LIMIT ?";
    const rows = (await db.prepare(sql).all(limit)) as unknown as TopupRow[];
    return rows.map(mapTopupRow);
}

/**
 * Move a pending order to a terminal state. The WHERE clause pins status to
 * 'pending' so a second concurrent processing attempt changes 0 rows and
 * returns null — callers rely on this as the double-approve guard.
 */
export async function processTopupOrderDB(
    orderId: string,
    status: Extract<TopupStatus, "approved" | "rejected" | "cancelled">,
    opts?: { processedBy?: string; note?: string }
): Promise<TopupOrder | null> {
    const now = Date.now();
    const result = await db.prepare(
        `UPDATE topup_orders
         SET status = ?, processed_at = ?, processed_by = ?, note = COALESCE(?, note)
         WHERE id = ? AND status = 'pending'`
    ).run(status, now, opts?.processedBy ?? null, opts?.note ?? null, orderId);
    if (num(result.changes) === 0) return null;
    return getTopupOrderDB(orderId);
}
