import type { Context } from "hono";
import { userAuthStore, getPlatformSummaryDB } from "@srouter/db";
import { Err, Ok } from "@/utils/response.js";

function toUserPayload(user: {
    id: string;
    email: string;
    name: string;
    credits: number;
    role: string;
    status: string;
    creatorStatus: string;
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
}
