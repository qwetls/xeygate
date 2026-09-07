import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { userAuthStore } from "@srouter/db";
import { verifyUserSession, USER_SESSION_COOKIE } from "@/services/userAuth.js";
import { Err } from "@/utils/response.js";

/**
 * Middleware that requires a valid user session.
 * Sets c.set("userId", ...) on success.
 */
export async function RequireUserAuth(c: Context, next: Next): Promise<Response | void> {
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
    if (user.status === "banned") {
        return Err(c, "This account has been banned. Contact support for assistance.", 403, {
            code: "account_banned"
        });
    }

    c.set("userId", userId);
    return await next();
}
