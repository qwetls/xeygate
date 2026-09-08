import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { userAuthStore, type UserAuthStore } from "@srouter/db";
import {
    validateEmail,
    validateUserPassword,
    hashUserPassword,
    createUserSession,
    USER_SESSION_COOKIE,
    USER_SESSION_TTL_MS
} from "@/services/userAuth.js";
import { Err, Ok } from "@/utils/response.js";

const COOKIE_OPTS = {
    path: "/",
    httpOnly: true,
    secure: false, // set true behind HTTPS proxy
    sameSite: "lax" as const,
    maxAge: Math.floor(USER_SESSION_TTL_MS / 1000)
};

function toAdminPayload(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    isAdmin: boolean;
    createdAt: number;
    updatedAt: number;
}) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

export interface AdminRouteOptions {
    store?: UserAuthStore;
    secureCookies?: boolean;
}

/**
 * Admin bootstrap routes.
 *
 * Admins are ordinary user accounts carrying `is_admin`, so signing in happens
 * through /v1/users/login like everyone else. These two routes only cover the
 * cold-start case where no admin account exists yet.
 */
export function CreateAdminRoute(Options: AdminRouteOptions = {}): Hono {
    const Store = Options.store ?? userAuthStore;
    const SecureCookies =
        Options.secureCookies ?? process.env.SROUTER_SECURE_COOKIES === "true";
    const Route = new Hono();

    // Public: does an admin account exist yet? Drives the first-run form.
    Route.get("/admin/status", async (c) => {
        return Ok(c, { setupRequired: !(await Store.hasAdmin()) });
    });

    // Public while no admin exists: the first account to claim wins.
    Route.post("/admin/bootstrap", async (c) => {
        if (await Store.hasAdmin()) {
            return Err(c, "An admin account already exists", 409, {
                code: "admin_exists"
            });
        }

        const body = await c.req
            .json<{ email?: string; password?: string; name?: string }>()
            .catch(() => ({}));

        const emailErr = validateEmail(body.email);
        if (emailErr) return Err(c, emailErr, 400);
        const pwErr = validateUserPassword(body.password);
        if (pwErr) return Err(c, pwErr, 400);

        const email = body.email!;
        const password = body.password!;

        const existing = await Store.getUserByEmail(email);
        let admin;
        if (existing) {
            // Claim a pre-existing account (e.g. seeded by SROUTER_ADMIN_PASSWORD)
            // instead of failing on the unique-email constraint.
            admin = await Store.getUserById(existing.id);
            if (!admin) return Err(c, "Bootstrap failed", 500);
            await Store.setAdmin(admin.id, true);
            await Store.updatePasswordHash(admin.id, hashUserPassword(password));
            if (admin.status !== "active") {
                const activated = await Store.updateStatus(admin.id, "active");
                if (activated) admin = activated;
            }
            const reloaded = await Store.getUserById(admin.id);
            if (!reloaded) return Err(c, "Bootstrap failed", 500);
            admin = reloaded;
        } else {
            admin = await Store.createUser({
                email,
                passwordHash: hashUserPassword(password),
                name: body.name ?? "Administrator",
                status: "active",
                isAdmin: true
            });
            if (!admin) return Err(c, "Bootstrap failed", 500);
        }

        const token = await createUserSession(Store, admin.id);
        setCookie(c, USER_SESSION_COOKIE, token, { ...COOKIE_OPTS, secure: SecureCookies });
        return Ok(c, { admin: toAdminPayload(admin) });
    });

    return Route;
}

export const createAdminRoute = CreateAdminRoute;
export const adminRoute = CreateAdminRoute();
