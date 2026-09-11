import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import {
    userAuthStore,
    getUserTransactionsDB,
    countUserTransactionsDB,
    getRequireRegistrationApprovalDB,
    getPublicPlatformStatsDB
} from "@srouter/db";
import {
    validateEmail,
    validateUserPassword,
    hashUserPassword,
    verifyUserPassword,
    createUserSession,
    revokeUserSession,
    USER_SESSION_COOKIE,
    USER_SESSION_TTL_MS
} from "@/services/userAuth.js";
import { RequireUserAuth } from "@/middleware/UserAuth.js";
import { GetDirectClientAddress } from "@/middleware/ApiKeyAuth.js";
import { GrantDailyLoginReward } from "@/services/dailyReward.js";
import { Err, Ok } from "@/utils/response.js";

export const UserAuthRouter = new Hono();

const COOKIE_OPTS = {
    path: "/",
    httpOnly: true,
    secure: process.env.SROUTER_SECURE_COOKIES === "true",
    sameSite: "lax" as const,
    maxAge: Math.floor(USER_SESSION_TTL_MS / 1000)
};

/** Sliding window of failed logins keyed by client address. */
const LOGIN_MAX_FAILURES = 5;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const FailedLogins = new Map<string, { count: number; blockedUntil: number }>();

function RegisterFailure(key: string, now: number): void {
    const entry = FailedLogins.get(key) ?? { count: 0, blockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= LOGIN_MAX_FAILURES) {
        entry.blockedUntil = now + LOGIN_BLOCK_MS;
        entry.count = 0;
    }
    FailedLogins.set(key, entry);
}

function IsBlocked(key: string, now: number): number {
    const entry = FailedLogins.get(key);
    if (!entry) return 0;
    if (entry.blockedUntil > now) return Math.ceil((entry.blockedUntil - now) / 1000);
    if (entry.blockedUntil !== 0 && entry.blockedUntil <= now) FailedLogins.delete(key);
    return 0;
}

function ClearFailures(key: string): void {
    FailedLogins.delete(key);
}

// ── Register ──
UserAuthRouter.post("/users/register", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string; name?: string }>().catch(() => ({}));

    const emailErr = validateEmail(body.email);
    if (emailErr) return Err(c, emailErr, 400);

    const pwErr = validateUserPassword(body.password);
    if (pwErr) return Err(c, pwErr, 400);

    const existing = await userAuthStore.getUserByEmail(body.email!);
    if (existing) return Err(c, "Email already registered", 409, { code: "email_exists" });

    const requiresApproval = await getRequireRegistrationApprovalDB();
    const user = await userAuthStore.createUser({
        email: body.email!,
        passwordHash: hashUserPassword(body.password!),
        name: body.name,
        status: requiresApproval ? "pending" : "active"
    });
    if (!user) return Err(c, "Registration failed", 500);

    // When registration requires admin approval, the account is created as
    // "pending" and can't sign in until an admin approves it.
    if (requiresApproval) {
        return Ok(c, {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            creatorStatus: user.creatorStatus,
            requiresApproval: true,
            message: "Account created. An admin must approve your registration before you can sign in."
        });
    }

    const token = await createUserSession(userAuthStore, user.id);
    setCookie(c, USER_SESSION_COOKIE, token, COOKIE_OPTS);

    return Ok(c, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        creatorStatus: user.creatorStatus,
        isAdmin: user.isAdmin,
        credits: user.credits
    });
});

// ── Login ──
UserAuthRouter.post("/users/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}));

    if (!body.email || !body.password) return Err(c, "Email and password are required", 400);

    const ClientAddress = GetDirectClientAddress(c) ?? "unknown";
    const now = Date.now();

    const blockedFor = IsBlocked(ClientAddress, now);
    if (blockedFor > 0) {
        return Err(c, `Too many failed attempts. Try again in ${blockedFor}s.`, 429, {
            code: "rate_limited"
        });
    }

    const user = await userAuthStore.getUserByEmail(body.email);
    if (!user || !verifyUserPassword(body.password, user.passwordHash)) {
        RegisterFailure(ClientAddress, now);
        return Err(c, "Invalid email or password", 401, { code: "invalid_credentials" });
    }

    if (user.status === "banned") {
        return Err(c, "This account has been banned. Contact support for assistance.", 403, {
            code: "account_banned"
        });
    }
    if (user.status === "pending") {
        return Err(c, "Your account is pending admin approval. Please try again later.", 403, {
            code: "account_pending"
        });
    }

    ClearFailures(ClientAddress);
    const token = await createUserSession(userAuthStore, user.id);
    setCookie(c, USER_SESSION_COOKIE, token, COOKIE_OPTS);

    const reward = await GrantDailyLoginReward(user.id);

    return Ok(c, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        creatorStatus: user.creatorStatus,
        isAdmin: user.isAdmin,
        credits: reward.awarded ? reward.credits : user.credits,
        dailyReward: reward.awarded ? { day: reward.day, amount: reward.amount } : null
    });
});

// ── Logout ──
UserAuthRouter.post("/users/logout", async (c) => {
    const token = getCookie(c, USER_SESSION_COOKIE);
    await revokeUserSession(userAuthStore, token);
    deleteCookie(c, USER_SESSION_COOKIE, { path: "/" });
    return Ok(c, { message: "Logged out" });
});

// ── Change password ──
// Every account (admins included) authenticates through the user login, so the
// password lives here too. Rotating it signs out all sessions, including the
// current one, and re-issues a fresh cookie for the caller.
UserAuthRouter.post("/users/change-password", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req
        .json<{ current_password?: string; new_password?: string; confirmation?: string }>()
        .catch(() => ({}));

    if (body.new_password !== undefined && body.new_password !== body.confirmation) {
        return Err(c, "Password confirmation does not match", 400, {
            code: "password_mismatch"
        });
    }
    const pwErr = validateUserPassword(body.new_password);
    if (pwErr) return Err(c, pwErr, 400);

    const user = await userAuthStore.getUserById(userId);
    if (!user) return Err(c, "User not found", 404);
    if (!body.current_password || !verifyUserPassword(body.current_password, user.passwordHash)) {
        return Err(c, "Current password is incorrect", 401, { code: "invalid_credentials" });
    }

    const updated = await userAuthStore.updatePasswordHash(
        userId,
        hashUserPassword(body.new_password!)
    );
    if (!updated) return Err(c, "Failed to update password", 500);

    await userAuthStore.deleteSessionsForUser(userId);
    const token = await createUserSession(userAuthStore, userId);
    setCookie(c, USER_SESSION_COOKIE, token, COOKIE_OPTS);

    return Ok(c, { message: "Password updated" });
});

// ── Current user ──
UserAuthRouter.get("/users/me", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const user = await userAuthStore.getUserById(userId);
    if (!user) return Err(c, "User not found", 404);
    return Ok(c, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        creatorStatus: user.creatorStatus,
        isAdmin: user.isAdmin,
        credits: user.credits
    });
});

// ── Role ──
UserAuthRouter.get("/users/role", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const user = await userAuthStore.getUserById(userId);
    if (!user) return Err(c, "User not found", 404);
    return Ok(c, { role: user.role, status: user.status, creatorStatus: user.creatorStatus });
});

UserAuthRouter.put("/users/role", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{ role?: string }>().catch(() => ({}));
    if (body.role !== "buyer" && body.role !== "creator") {
        return Err(c, "Role must be 'buyer' or 'creator'", 400);
    }
    const user = await userAuthStore.getUserById(userId);
    if (!user) return Err(c, "User not found", 404);

    // Buyer is always instant — the account is (re)activated to the buyer role.
    if (body.role === "buyer") {
        const updated = await userAuthStore.updateRole(userId, "buyer");
        if (!updated) return Err(c, "User not found", 404);
        return Ok(c, { id: updated.id, role: updated.role, status: updated.status, creatorStatus: updated.creatorStatus });
    }

    // Creator upgrade is gated behind admin approval.
    if (user.status !== "active") {
        return Err(c, "Your account must be active to request creator access.", 403, {
            code: "account_not_active"
        });
    }
    if (user.creatorStatus === "pending") {
        return Ok(c, {
            id: user.id,
            role: user.role,
            status: user.status,
            creatorStatus: user.creatorStatus,
            requiresApproval: true
        });
    }
    if (user.creatorStatus === "approved" && user.role === "creator") {
        return Ok(c, {
            id: user.id,
            role: user.role,
            status: user.status,
            creatorStatus: user.creatorStatus
        });
    }
    // First request (none/rejected) → pending; role stays 'buyer' until approved.
    const updated = await userAuthStore.setCreatorApproval(userId, "pending");
    if (!updated) return Err(c, "User not found", 404);
    return Ok(c, {
        id: updated.id,
        role: updated.role,
        status: updated.status,
        creatorStatus: updated.creatorStatus,
        requiresApproval: true
    });
});

// ── Top up credits (simulated for MVP) ──
UserAuthRouter.post("/users/credits/topup", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{ amount?: number }>().catch(() => ({}));
    const amount = Number(body.amount);
    if (!amount || amount <= 0 || amount > 10000) {
        return Err(c, "Amount must be between 0.01 and 10000", 400);
    }
    const updated = await userAuthStore.updateCredits(userId, amount);
    if (!updated) return Err(c, "User not found", 404);
    return Ok(c, { credits: updated.credits });
});

// ── List user's API keys ──
UserAuthRouter.get("/users/keys", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const keys = await userAuthStore.getUserKeys(userId);
    return Ok(c, { keys });
});

// ── Transaction history ──
UserAuthRouter.get("/users/transactions", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
    const [transactions, total] = await Promise.all([
        getUserTransactionsDB(userId, limit, offset),
        countUserTransactionsDB(userId)
    ]);
    return Ok(c, { transactions, total });
});

// ── Create API key ──
UserAuthRouter.post("/users/keys", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{ name?: string }>().catch(() => ({}));
    const name = body.name?.trim();
    if (!name || name.length < 1 || name.length > 64) {
        return Err(c, "Key name must be 1-64 characters", 400);
    }
    const key = await userAuthStore.createUserKey(userId, name);
    if (!key) return Err(c, "Failed to create key", 500);
    return Ok(c, key);
});

// ── Delete API key ──
UserAuthRouter.delete("/users/keys/:keyId", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const keyId = c.req.param("keyId");
    const deleted = await userAuthStore.deleteUserKey(userId, keyId);
    if (!deleted) return Err(c, "Key not found", 404);
    return Ok(c, { message: "Key deleted" });
});

// ── User usage stats ──
UserAuthRouter.get("/users/usage", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const usage = await userAuthStore.getUserUsage(userId);
    return Ok(c, usage);
});

// ── Platform stats (authenticated portal users) ──
// Lightweight, non-sensitive aggregate counters shared with all dashboard users.
UserAuthRouter.get("/users/platform-stats", RequireUserAuth, async (c) => {
    const stats = await getPublicPlatformStatsDB();
    return Ok(c, stats);
});
