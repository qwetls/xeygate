import { db } from "./db.js";
import { generateId, num, str, optStr } from "./row-utils.js";

// ─────────────────────────────────────────────────────
// Plan purchases — buyer-initiated subscription orders.
// Buyers create an order, pay through the payment gateway (sandbox
// today), and settlement assigns the plan + sets an expiry date.
// ─────────────────────────────────────────────────────

export type PlanPurchaseStatus =
    | "pending_payment"
    | "paid"
    | "cancelled"
    | "expired";

export interface PlanPurchase {
    id: string;
    userId: string;
    plan: string;
    amountCents: number;
    status: PlanPurchaseStatus;
    createdAt: number;
    paidAt?: number;
}

interface PlanPurchaseRow {
    id: string;
    user_id: string;
    plan: string;
    amount_cents: number;
    status: string;
    created_at: number;
    paid_at: number | null;
}

const STATUSES: PlanPurchaseStatus[] = [
    "pending_payment",
    "paid",
    "cancelled",
    "expired"
];

function mapRow(row: PlanPurchaseRow): PlanPurchase {
    const status = (STATUSES as string[]).includes(row.status)
        ? (row.status as PlanPurchaseStatus)
        : "pending_payment";
    return {
        id: str(row.id),
        userId: str(row.user_id),
        plan: str(row.plan),
        amountCents: num(row.amount_cents),
        status,
        createdAt: num(row.created_at),
        paidAt: row.paid_at == null ? undefined : num(row.paid_at)
    };
}

export async function createPlanPurchaseDB(data: {
    userId: string;
    plan: string;
    amountCents: number;
}): Promise<PlanPurchase> {
    const id = generateId("pp");
    const now = Date.now();
    await db.prepare(
        `INSERT INTO plan_purchases (id, user_id, plan, amount_cents, status, created_at, paid_at)
         VALUES (?, ?, ?, ?, 'pending_payment', ?, NULL)`
    ).run(id, data.userId, data.plan, data.amountCents, now);
    return {
        id,
        userId: data.userId,
        plan: data.plan,
        amountCents: data.amountCents,
        status: "pending_payment",
        createdAt: now
    };
}

export async function getPlanPurchaseDB(id: string): Promise<PlanPurchase | null> {
    const row = (await db
        .prepare("SELECT * FROM plan_purchases WHERE id = ?")
        .get(id)) as unknown as PlanPurchaseRow | undefined;
    return row ? mapRow(row) : null;
}

export async function getPendingPlanPurchaseDB(
    userId: string
): Promise<PlanPurchase | null> {
    const row = (await db
        .prepare(
            `SELECT * FROM plan_purchases WHERE user_id = ? AND status = 'pending_payment' ORDER BY created_at DESC LIMIT 1`
        )
        .get(userId)) as unknown as PlanPurchaseRow | undefined;
    return row ? mapRow(row) : null;
}

/**
 * Settle a pending plan purchase. Assigns the plan to the user and sets
 * plan_expires_at to 30 days from now. Double-settle guarded by the
 * WHERE status = 'pending_payment' condition.
 */
export async function settlePlanPurchaseDB(
    purchaseId: string
): Promise<{ purchase: PlanPurchase; expiresAt: number } | null> {
    const now = Date.now();
    const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const expiresAt = now + EXPIRY_MS;

    const result = await db.prepare(
        `UPDATE plan_purchases SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending_payment'`
    ).run(now, purchaseId);

    if (num(result.changes) === 0) return null;

    const purchase = await getPlanPurchaseDB(purchaseId);
    if (!purchase) return null;

    // Assign plan + set expiry on the user
    await db.prepare(
        `UPDATE users SET plan = ?, plan_expires_at = ?, updated_at = ? WHERE id = ?`
    ).run(purchase.plan, expiresAt, now, purchase.userId);

    return { purchase, expiresAt };
}

export async function listPlanPurchasesDB(
    userId: string,
    limit = 50,
    offset = 0
): Promise<PlanPurchase[]> {
    const rows = (await db
        .prepare(
            "SELECT * FROM plan_purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .all(userId, limit, offset)) as unknown as PlanPurchaseRow[];
    return rows.map(mapRow);
}

export async function listAllPlanPurchasesDB(
    status: "pending_payment" | "all" = "pending_payment",
    limit = 100
): Promise<PlanPurchase[]> {
    const sql =
        status === "pending_payment"
            ? "SELECT * FROM plan_purchases WHERE status = 'pending_payment' ORDER BY created_at ASC LIMIT ?"
            : "SELECT * FROM plan_purchases ORDER BY created_at DESC LIMIT ?";
    const rows = (await db.prepare(sql).all(limit)) as unknown as PlanPurchaseRow[];
    return rows.map(mapRow);
}
