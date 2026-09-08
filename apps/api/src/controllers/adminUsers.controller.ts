import type { Context } from "hono";
import {
    userAuthStore,
    getPlatformSummaryDB,
    listAllPendingPayoutsDB,
    listPayoutsDB,
    processPayoutDB,
    markEarningsPaidForPayoutDB,
    type Payout
} from "@srouter/db";
import { Err, Ok } from "@/utils/response.js";

function toUserPayload(user: {
    id: string;
    email: string;
    name: string;
    credits: number;
    role: string;
    status: string;
    creatorStatus: string;
    creatorShare: number;
    createdAt: number;
    updatedAt: number;
}) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        role: user.role,
        status: user.status,
        creatorStatus: user.creatorStatus,
        creatorShare: user.creatorShare,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

export class AdminUsersController {
    public static async ListUsers(c: Context): Promise<Response> {
        const users = await userAuthStore.listUsers();
        return Ok(c, { users: users.map(toUserPayload) });
    }

    public static async PlatformAnalytics(c: Context): Promise<Response> {
        const summary = await getPlatformSummaryDB();
        return Ok(c, summary);
    }

    public static async ApproveRegistration(c: Context): Promise<Response> {
        const id = c.req.param("id");
        const user = await userAuthStore.getUserById(id);
        if (!user) return Err(c, "User not found", 404);

        if (user.status === "pending") {
            await userAuthStore.updateStatus(id, "active");
        }
        const updated = await userAuthStore.getUserById(id);
        if (!updated) return Err(c, "User not found", 404);
        return Ok(c, { user: toUserPayload(updated) });
    }

    public static async BanUser(c: Context): Promise<Response> {
        const id = c.req.param("id");
        const user = await userAuthStore.getUserById(id);
        if (!user) return Err(c, "User not found", 404);

        const updated = await userAuthStore.updateStatus(id, "banned");
        if (!updated) return Err(c, "User not found", 404);
        return Ok(c, { user: toUserPayload(updated) });
    }

    public static async UnbanUser(c: Context): Promise<Response> {
        const id = c.req.param("id");
        const user = await userAuthStore.getUserById(id);
        if (!user) return Err(c, "User not found", 404);

        const updated = await userAuthStore.updateStatus(id, "active");
        if (!updated) return Err(c, "User not found", 404);
        return Ok(c, { user: toUserPayload(updated) });
    }

    public static async RevokeApiAccess(c: Context): Promise<Response> {
        const id = c.req.param("id");
        const user = await userAuthStore.getUserById(id);
        if (!user) return Err(c, "User not found", 404);

        const revoked = await userAuthStore.revokeApiKeys(id);
        return Ok(c, { revoked, user: toUserPayload(user) });
    }

    public static async ApproveCreator(c: Context): Promise<Response> {
        const id = c.req.param("id");
        const user = await userAuthStore.getUserById(id);
        if (!user) return Err(c, "User not found", 404);
        if (user.creatorStatus !== "pending") {
            return Err(c, "User has no pending creator request", 409, {
                code: "no_pending_creator_request"
            });
        }

        const updated = await userAuthStore.setCreatorApproval(id, "approved");
        if (!updated) return Err(c, "User not found", 404);
        return Ok(c, { user: toUserPayload(updated) });
    }

    public static async RejectCreator(c: Context): Promise<Response> {
        const id = c.req.param("id");
        const user = await userAuthStore.getUserById(id);
        if (!user) return Err(c, "User not found", 404);
        if (user.creatorStatus !== "pending") {
            return Err(c, "User has no pending creator request", 409, {
                code: "no_pending_creator_request"
            });
        }

        const updated = await userAuthStore.setCreatorApproval(id, "rejected");
        if (!updated) return Err(c, "User not found", 404);
        return Ok(c, { user: toUserPayload(updated) });
    }

    // ── Creator revenue share ──

    public static async SetCreatorShare(c: Context): Promise<Response> {
        const id = c.req.param("id");
        const body = await c.req.json<{ share?: number }>().catch(() => ({}));
        const share = Number(body.share);
        if (!share || share < 0.01 || share > 1) {
            return Err(c, "Share must be between 0.01 and 1", 400, {
                code: "invalid_share"
            });
        }

        const user = await userAuthStore.getUserById(id);
        if (!user) return Err(c, "User not found", 404);
        if (user.role !== "creator") {
            return Err(c, "Only creators have a revenue share", 400, {
                code: "not_a_creator"
            });
        }

        const updated = await userAuthStore.setCreatorShare(id, share);
        if (!updated) return Err(c, "User not found", 404);
        return Ok(c, { user: toUserPayload(updated) });
    }

    // ── Payouts ──

    public static async ListPayouts(c: Context): Promise<Response> {
        const userId = c.req.query("userId");
        const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
        const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

        let payouts: Payout[];
        if (userId) {
            payouts = await listPayoutsDB(userId, limit, offset);
        } else {
            payouts = await listAllPendingPayoutsDB(limit);
        }

        // Attach the requesting creator's identity so the admin queue is
        // readable without a second lookup per row.
        const userCache = new Map<string, { email: string; name: string }>();
        const enriched: Array<Payout & { userEmail?: string; userName?: string }> = [];
        for (const payout of payouts) {
            let user = userCache.get(payout.userId);
            if (!user) {
                const u = await userAuthStore.getUserById(payout.userId);
                user = u ? { email: u.email, name: u.name } : { email: "", name: "" };
                userCache.set(payout.userId, user);
            }
            enriched.push({ ...payout, userEmail: user.email, userName: user.name });
        }
        return Ok(c, { payouts: enriched });
    }

    public static async ProcessPayout(c: Context): Promise<Response> {
        const id = c.req.param("id");
        const body = await c.req.json<{ status?: string; note?: string }>().catch(() => ({}));
        if (body.status !== "paid" && body.status !== "failed") {
            return Err(c, "Status must be 'paid' or 'failed'", 400, {
                code: "invalid_payout_status"
            });
        }

        // processPayoutDB only flips rows still 'pending', so a double process
        // is impossible: a second call returns null and we 409.
        const payout = await processPayoutDB(id, body.status, body.note);
        if (!payout) {
            return Err(c, "Payout not found or already processed", 409, {
                code: "payout_not_pending"
            });
        }

        // Move the ledger after the status flip.
        if (payout.status === "paid") {
            await markEarningsPaidForPayoutDB(payout.userId, payout.amount);
        } else {
            // Failed → unlock the funds back to the creator's wallet.
            await userAuthStore.updateCredits(payout.userId, payout.amount);
        }
        return Ok(c, { payout });
    }
}
