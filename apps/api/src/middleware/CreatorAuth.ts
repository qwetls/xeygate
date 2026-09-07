import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { userAuthStore } from "@srouter/db";
import { verifyUserSession, USER_SESSION_COOKIE } from "@/services/userAuth.js";
import { Err } from "@/utils/response.js";

/**
 * Middleware that requires the authenticated user to have the 'creator' role.
 * Verifies the user session inline (same as RequireUserAuth) then checks role.
 */
export async function RequireCreator(c: Context, next: Next): Promise<Response | void> {
    const token = getCookie(c, USER_SESSION_COOKIE);
    const userId = await verifyUserSession(userAuthStore, token);
    if (!userId) {
        return Err(c, "Authentication required. Please sign in.", 401, {
            type: "invalid_request_error",
            code: "unauthorized"
        });
    }

    const user = await userAuthStore.getUserById(userId);
    if (!user) return Err(c, "User not found", 404);
    if (user.role !== "creator") {
        return Err(
            c,
            "Creator access required. Upgrade your account to start selling APIs.",
            403,
            { code: "creator_only" }
        );
    }

    c.set("userId", userId);
    return await next();
}
