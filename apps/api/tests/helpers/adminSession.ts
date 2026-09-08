import { userAuthStore } from "@srouter/db";
import { createUserSession, hashUserPassword } from "@/services/userAuth.js";

export const TEST_ADMIN_PASSWORD = "test-admin-password-123";

let seq = 0;

/**
 * Creates an admin user account (the post-refactor replacement for the old
 * singleton admin session) and returns a signed session token for it.
 * Send it as `${USER_SESSION_COOKIE}=<token>` to authenticate admin routes.
 */
export async function createTestAdmin(): Promise<{ userId: string; token: string }> {
    seq += 1;
    const user = await userAuthStore.createUser({
        email: `test-admin-${seq}-${process.pid}@xeygate.test`,
        passwordHash: hashUserPassword(TEST_ADMIN_PASSWORD),
        name: "Test Admin",
        status: "active",
        isAdmin: true
    });
    if (!user) throw new Error("Failed to create test admin account");
    return { userId: user.id, token: await createUserSession(userAuthStore, user.id) };
}

export async function createTestAdminSession(): Promise<string> {
    return (await createTestAdmin()).token;
}

/** Same, for a plain (non-admin) account. */
export async function createTestUserSession(role?: "buyer" | "creator"): Promise<string> {
    seq += 1;
    const user = await userAuthStore.createUser({
        email: `test-user-${seq}-${process.pid}@xeygate.test`,
        passwordHash: hashUserPassword(TEST_ADMIN_PASSWORD),
        name: "Test User",
        status: "active"
    });
    if (!user) throw new Error("Failed to create test user account");
    if (role === "creator") await userAuthStore.updateRole(user.id, "creator");
    return await createUserSession(userAuthStore, user.id);
}

export function adminCookieHeader(token: string): Record<string, string> {
    return { Cookie: `xeygate_user_session=${token}` };
}
