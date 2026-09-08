import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie } from "hono/cookie";
import { Err } from "@/utils/response.js";
import { USER_SESSION_COOKIE } from "@/services/userAuth.js";
import { verifyAdminSession, type AdminStore } from "@/services/adminAuth.js";

export interface AdminAuthMiddlewareOptions {
    store?: AdminStore;
    now?: () => number;
}

export function CreateAdminAuthMiddleware(
    Options: AdminAuthMiddlewareOptions = {}
): MiddlewareHandler {
    const Store = Options.store;
    const Now = Options.now ?? (() => Date.now());

    return async (c: Context, next: Next) => {
        const admin = await verifyAdminSession(Store, getCookie(c, USER_SESSION_COOKIE), Now());
        if (!admin) {
            return Err(c, "Admin authentication is required", 401, {
                code: "authentication_required"
            });
        }

        c.set("userId", admin.id);
        c.set("authType", "admin_session");
        return next();
    };
}

export const RequireAdmin = CreateAdminAuthMiddleware();
