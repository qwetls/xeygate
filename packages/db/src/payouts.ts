import { db } from "./db.js";
import { generateId, num, str, optStr } from "./row-utils.js";

// ─────────────────────────────────────────────────────
// Creator payouts — internal-balance withdrawals.
// Creators accrue net earnings in creator_earnings; a payout request
// converts their available balance into a tracked payout record that an
// admin later marks paid/failed (real money movement happens off-platform).
// ─────────────────────────────────────────────────────

export type PayoutStatus = "pending" | "paid" | "failed" | "cancelled";

export interface Payout {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    status: PayoutStatus;
    requestedAt: number;
    processedAt?: number;
    note?: string;
}

interface PayoutRow {
    id: string;
    user_id: string;
    amount: number;
    currency: string;
    status: string;
    requested_at: number;
    processed_at: number | null;
    note: string | null;
}

function mapPayoutRow(row: PayoutRow): Payout {
    const status =
        row.status === "paid" || row.status === "failed" || row.status === "cancelled"
            ? row.status
            : "pending";
    return {
        id: str(row.id),
        userId: str(row.user_id),
        amount: num(row.amount),
        currency: str(row.currency, "USD"),
        status,
        requestedAt: num(row.requested_at),
        processedAt: row.processed_at == null ? undefined : num(row.processed_at),
        note: optStr(row.note)
    };
}

export async function createPayoutRequestDB(data: {
    userId: string;
    amount: number;
    note?: string;
}): Promise<Payout> {
    const id = generateId("pay");
    const now = Date.now();
    await db.prepare(
        `INSERT INTO payouts (id, user_id, amount, currency, status, requested_at, processed_at, note)
         VALUES (?, ?, ?, 'USD', 'pending', ?, NULL, ?)`
    ).run(id, data.userId, data.amount, now, data.note ?? null);
    return {
        id,
        userId: data.userId,
        amount: data.amount,
        currency: "USD",
        status: "pending",
        requestedAt: now,
        note: data.note
    };
}

export async function listPayoutsDB(
    userId: string,
    limit = 50,
    offset = 0
): Promise<Payout[]> {
    const rows = (await db
        .prepare(
            "SELECT * FROM payouts WHERE user_id = ? ORDER BY requested_at DESC LIMIT ? OFFSET ?"
        )
        .all(userId, limit, offset)) as unknown as PayoutRow[];
    return rows.map(mapPayoutRow);
}

export async function listAllPendingPayoutsDB(limit = 100): Promise<Payout[]> {
    const rows = (await db
        .prepare(
            "SELECT * FROM payouts WHERE status = 'pending' ORDER BY requested_at ASC LIMIT ?"
        )
        .all(limit)) as unknown as PayoutRow[];
    return rows.map(mapPayoutRow);
}

export async function getPendingPayoutCountDB(userId: string): Promise<number> {
    const row = (await db
        .prepare(
            "SELECT COUNT(*) AS count FROM payouts WHERE user_id = ? AND status = 'pending'"
        )
        .get(userId)) as unknown as { count: number } | undefined;
    return num(row?.count);
}

/**
 * Balance a creator can actually request: accrued net earnings still marked
 * 'pending' minus funds already locked in an outstanding payout request.
 */
export async function getAvailableBalanceDB(userId: string): Promise<number> {
    const row = (await db
        .prepare(
            `SELECT
                (SELECT COALESCE(SUM(net_amount), 0) FROM creator_earnings
                 WHERE user_id = ? AND status = 'pending')
              - (SELECT COALESCE(SUM(amount), 0) FROM payouts
                 WHERE user_id = ? AND status = 'pending') AS available`
        )
        .get(userId, userId)) as unknown as { available: number } | undefined;
    return num(row?.available);
}

/**
 * Mark creator earnings as paid, oldest first, up to `upToAmount` of net
 * value (FIFO). Supports partial payouts: only the earnings rows consumed by
 * this payout are flipped to 'paid'; the rest stay claimable.
 */
export async function markEarningsPaidForPayoutDB(
    userId: string,
    upToAmount: number
): Promise<number> {
    const rows = (await db
        .prepare(
            `SELECT id, net_amount FROM creator_earnings
             WHERE user_id = ? AND status = 'pending'
             ORDER BY created_at ASC, id ASC`
        )
        .all(userId)) as unknown as Array<{ id: string; net_amount: number }>;
    const toMark: string[] = [];
    let remaining = upToAmount;
    for (const row of rows) {
        if (remaining <= 0) break;
        toMark.push(row.id);
        remaining -= num(row.net_amount);
    }
    if (toMark.length === 0) return 0;
    const placeholders = toMark.map(() => "?").join(",");
    const result = await db
        .prepare(`UPDATE creator_earnings SET status = 'paid' WHERE id IN (${placeholders})`)
        .run(...toMark);
    return num(result.changes);
}

export async function processPayoutDB(
    payoutId: string,
    status: Extract<PayoutStatus, "paid" | "failed">,
    note?: string
): Promise<Payout | null> {
    const now = Date.now();
    const result = await db.prepare(
        `UPDATE payouts SET status = ?, processed_at = ?, note = COALESCE(?, note) WHERE id = ? AND status = 'pending'`
    ).run(status, now, note ?? null, payoutId);
    if (num(result.changes) === 0) return null;
    const row = (await db
        .prepare("SELECT * FROM payouts WHERE id = ?")
        .get(payoutId)) as unknown as PayoutRow | undefined;
    return row ? mapPayoutRow(row) : null;
}
