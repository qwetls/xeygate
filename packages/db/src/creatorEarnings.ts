import { db } from "./db.js";
import { generateId, num, str, optStr } from "./row-utils.js";

export type EarningStatus = "pending" | "paid" | "cancelled";

export interface CreatorEarning {
    id: string;
    userId: string;
    providerId: string;
    grossAmount: number;
    platformFee: number;
    netAmount: number;
    currency: string;
    status: EarningStatus;
    transactionId?: string;
    createdAt: number;
}

interface CreatorEarningRow {
    id: string;
    user_id: string;
    provider_id: string;
    gross_amount: number;
    platform_fee: number;
    net_amount: number;
    currency: string;
    status: string;
    transaction_id: string | null;
    created_at: number;
}

function mapEarningRow(row: CreatorEarningRow): CreatorEarning {
    return {
        id: row.id,
        userId: str(row.user_id),
        providerId: str(row.provider_id),
        grossAmount: num(row.gross_amount),
        platformFee: num(row.platform_fee),
        netAmount: num(row.net_amount),
        currency: str(row.currency, "USD"),
        status: row.status === "paid" ? "paid" : row.status === "cancelled" ? "cancelled" : "pending",
        transactionId: optStr(row.transaction_id),
        createdAt: num(row.created_at)
    };
}

export async function createCreatorEarningDB(data: {
    userId: string;
    providerId: string;
    grossAmount: number;
    platformFee: number;
    netAmount: number;
    transactionId?: string;
}): Promise<CreatorEarning> {
    const id = generateId("earn");
    const createdAt = Date.now();

    await db.prepare(
        `INSERT INTO creator_earnings (id, user_id, provider_id, gross_amount, platform_fee, net_amount, currency, status, transaction_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'USD', 'pending', ?, ?)`
    ).run(
        id,
        data.userId,
        data.providerId,
        data.grossAmount,
        data.platformFee,
        data.netAmount,
        data.transactionId ?? null,
        createdAt
    );

    return {
        id,
        userId: data.userId,
        providerId: data.providerId,
        grossAmount: data.grossAmount,
        platformFee: data.platformFee,
        netAmount: data.netAmount,
        currency: "USD",
        status: "pending",
        transactionId: data.transactionId,
        createdAt
    };
}

export async function getCreatorEarningsDB(
    userId: string,
    limit = 50,
    offset = 0
): Promise<CreatorEarning[]> {
    const rows = (await db
        .prepare(
            "SELECT * FROM creator_earnings WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .all(userId, limit, offset)) as unknown as CreatorEarningRow[];
    return rows.map(mapEarningRow);
}

export interface EarningsSummary {
    totalGross: number;
    totalFees: number;
    totalNet: number;
    pendingAmount: number;
    paidAmount: number;
    requestCount: number;
}

export async function getEarningsSummaryDB(userId: string): Promise<EarningsSummary> {
    const row = (await db
        .prepare(
            `SELECT
                COALESCE(SUM(gross_amount), 0) as total_gross,
                COALESCE(SUM(platform_fee), 0) as total_fees,
                COALESCE(SUM(net_amount), 0) as total_net,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END), 0) as pending_amount,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN net_amount ELSE 0 END), 0) as paid_amount,
                COUNT(*) as request_count
             FROM creator_earnings WHERE user_id = ?`
        )
        .get(userId)) as unknown as {
        total_gross: number;
        total_fees: number;
        total_net: number;
        pending_amount: number;
        paid_amount: number;
        request_count: number;
    };

    return {
        totalGross: num(row?.total_gross),
        totalFees: num(row?.total_fees),
        totalNet: num(row?.total_net),
        pendingAmount: num(row?.pending_amount),
        paidAmount: num(row?.paid_amount),
        requestCount: num(row?.request_count)
    };
}
