import { userAuthStore, type User, type UserAuthStore } from "@srouter/db";
import { TERMS_VERSION } from "@srouter/constants";
import { hashUserPassword, verifyUserSession } from "@/services/userAuth.js";

export const DEFAULT_ADMIN_EMAIL = "admin@xeygate.local";

export type AdminStore = Pick<UserAuthStore, "getSession" | "getUserById">;

/**
 * Resolve a session cookie to an admin identity.
 *
 * Admins are ordinary user accounts flagged with `is_admin`, so this shares the
 * user-session store and simply adds the privilege + ban checks. Returns null
 * when the session is missing/expired, the account no longer exists, is not an
 * admin, or has been banned.
 */
export async function verifyAdminSession(
    store: AdminStore = userAuthStore,
    token: string | undefined,
    now = Date.now()
): Promise<User | null> {
    const userId = await verifyUserSession(store, token, now);
    if (!userId) return null;

    const user = await store.getUserById(userId);
    if (!user || !user.isAdmin) return null;
    if (user.status === "banned") return null;
    return user;
}

/**
 * Make sure an admin account exists at boot.
 *
 * Order of precedence:
 * 1. `SROUTER_ADMIN_PASSWORD` set → ensures the `SROUTER_ADMIN_EMAIL` account
 *    exists as admin and resets its password on every boot (documented recovery
 *    path for a forgotten password).
 * 2. Otherwise, if the pre-refactor `admin_account` singleton is still on disk,
 *    migrate it into a real user account and keep its password working.
 * 3. Otherwise do nothing — the dashboard's first-run form (POST
 *    /v1/admin/bootstrap) lets the first visitor claim admin access.
 */
export async function bootstrapAdminFromEnv(store: UserAuthStore = userAuthStore): Promise<void> {
    const envPassword = process.env.SROUTER_ADMIN_PASSWORD;
    const email = (process.env.SROUTER_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).toLowerCase().trim();

    if (envPassword !== undefined && envPassword.length > 0) {
        const hash = hashUserPassword(envPassword);
        const existing = await store.getUserByEmail(email);
        if (existing) {
            await store.updatePasswordHash(existing.id, hash);
            if (!existing.isAdmin) await store.setAdmin(existing.id, true);
            return;
        }
        await store.createUser({
            email,
            passwordHash: hash,
            name: "Administrator",
            status: "active",
            isAdmin: true,
            acceptedTermsAt: Date.now(),
            termsVersion: TERMS_VERSION
        });
        return;
    }

    if (await store.hasAdmin()) return;

    const legacyHash = await store.getLegacyAdminPasswordHash();
    if (!legacyHash) return;

    const clash = await store.getUserByEmail(email);
    if (clash) {
        await store.setAdmin(clash.id, true);
        return;
    }
    // Operator accounts consent at provisioning time (the deployer owns this
    // box), so the migration stamps the current terms instead of locking the
    // admin out of /users-login behind a re-accept gate meant for sign-ups.
    await store.createUser({
        email,
        passwordHash: legacyHash,
        name: "Administrator",
        status: "active",
        isAdmin: true,
        acceptedTermsAt: Date.now(),
        termsVersion: TERMS_VERSION
    });
    console.log(
        `ℹ️ Migrated the legacy admin account to ${email} — sign in from the dashboard with the existing password.`
    );
}
