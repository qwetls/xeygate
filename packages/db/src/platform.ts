import { db } from "./db.js";
import { num, str } from "./row-utils.js";

// ─────────────────────────────────────────────────────
// Platform analytics — admin-facing aggregate metrics
// over the whole marketplace (users, creators, spend,
// top users). Mirrors the shape used by OpenRouter /
// OpenCode platform dashboards.
// ─────────────────────────────────────────────────────

export interface PlatformTopUserRow {
    userId: string;
    name: string;
    email: string;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
}

export interface PlatformSummary {
    users: {
        total: number;
        active: number;
        pending: number;
        banned: number;
    };
    creators: {
        approved: number;
        pending: number;
    };
    usage: {
        totalRequests: number;
        totalTokens: number;
        totalCost: number;
    };
    topUsers: PlatformTopUserRow[];
    generatedAt: number;
}

export interface PublicPlatformStats {
    users: number;
    creators: number;
    models: number;
    totalRequests: number;
    totalTokens: number;
}

// Lightweight, non-sensitive aggregate counters for authenticated portal users
// (client dashboard "platform overview" section).
export async function getPublicPlatformStatsDB(): Promise<PublicPlatformStats> {
    const UserRow = (await db
        .prepare(
            `SELECT
                COUNT(*) AS users,
                SUM(CASE WHEN creator_status = 'approved' THEN 1 ELSE 0 END) AS creators
            FROM users WHERE status = 'active'`
        )
        .get()) as unknown as { users: number; creators: number } | undefined;

    const UsageRow = (await db
        .prepare(
            `SELECT
                COUNT(*) AS totalRequests,
                COALESCE(SUM(total_tokens), 0) AS totalTokens
            FROM request_logs`
        )
        .get()) as unknown as { totalRequests: number; totalTokens: number } | undefined;

    const ModelCountRow = (await db
        .prepare(
            `SELECT COUNT(DISTINCT model) AS models FROM request_logs`
        )
        .get()) as unknown as { models: number } | undefined;

    return {
        users: num(UserRow?.users),
        creators: num(UserRow?.creators),
        models: num(ModelCountRow?.models),
        totalRequests: num(UsageRow?.totalRequests),
        totalTokens: num(UsageRow?.totalTokens)
    };
}

export async function getPlatformSummaryDB(): Promise<PlatformSummary> {
    const UserCounts = (await db
        .prepare(
            `SELECT status, COUNT(*) AS count FROM users GROUP BY status`
        )
        .all()) as unknown as Array<{ status: string; count: number }>;
    const UserCount = {
        total: 0,
        active: 0,
        pending: 0,
        banned: 0
    };
    for (const r of UserCounts) {
        const count = num(r.count);
        UserCount.total += count;
        if (r.status === "pending") UserCount.pending += count;
        else if (r.status === "banned") UserCount.banned += count;
        else UserCount.active += count; // null/legacy rows → active
    }

    // Creator counts (approved/pending)
    const CreatorCounts = (await db
        .prepare(
            `SELECT creator_status, COUNT(*) AS count FROM users GROUP BY creator_status`
        )
        .all()) as unknown as Array<{ creator_status: string; count: number }>;
    let CreatorsApproved = 0;
    let CreatorsPending = 0;
    for (const r of CreatorCounts) {
        const count = num(r.count);
        if (r.creator_status === "approved") CreatorsApproved += count;
        else if (r.creator_status === "pending") CreatorsPending += count;
    }

    // Aggregate usage across all request logs
    const Usage = (await db
        .prepare(
            `SELECT
                COUNT(*) AS totalRequests,
                COALESCE(SUM(total_tokens), 0) AS totalTokens,
                COALESCE(SUM(estimated_cost), 0) AS totalCost
            FROM request_logs`
        )
        .get()) as unknown as { totalRequests: number; totalTokens: number; totalCost: number } | undefined;

    // Top users by request volume (join request_logs → api_keys → users)
    const TopUsers = (await db
        .prepare(
            `SELECT
                u.id AS userId,
                u.name AS name,
                u.email AS email,
                COUNT(r.id) AS totalRequests,
                COALESCE(SUM(r.total_tokens), 0) AS totalTokens,
                COALESCE(SUM(r.estimated_cost), 0) AS totalCost
            FROM request_logs r
            JOIN api_keys k ON r.api_key_id = k.id
            JOIN users u ON k.user_id = u.id
            GROUP BY u.id, u.name, u.email
            ORDER BY totalRequests DESC
            LIMIT 10`
        )
        .all()) as unknown as PlatformTopUserRow[];

    return {
        users: UserCount,
        creators: { approved: CreatorsApproved, pending: CreatorsPending },
        usage: {
            totalRequests: num(Usage?.totalRequests),
            totalTokens: num(Usage?.totalTokens),
            totalCost: num(Usage?.totalCost)
        },
        topUsers: TopUsers.map((row) => ({
            userId: str(row.userId),
            name: str(row.name),
            email: str(row.email),
            totalRequests: num(row.totalRequests),
            totalTokens: num(row.totalTokens),
            totalCost: num(row.totalCost)
        })),
        generatedAt: Date.now()
    };
}
