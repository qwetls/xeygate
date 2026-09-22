import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { TERMS_VERSION } from "@srouter/constants";
import {
    userAuthStore,
    getUserTransactionsDB,
    countUserTransactionsDB,
    getRequireRegistrationApprovalDB,
    getCreatorApplicationsOpenDB,
    getPublicPlatformStatsDB,
    createTopupOrderDB,
    getTopupOrderDB,
    listTopupOrdersDB,
    countTopupOrdersDB,
    getPendingTopupOrderDB,
    processTopupOrderDB,
    getTopupEnabledDB,
    createPlanPurchaseDB,
    getPlanPurchaseDB,
    getPendingPlanPurchaseDB,
    settlePlanPurchaseDB,
    listPlanPurchasesDB,
    getPlanConfigDB
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
import {
    GetActiveGateway,
    GetPayableTopupOrder,
    SettleTopupOrder
} from "@/services/paymentGateway.js";
import { Err, Ok } from "@/utils/response.js";
import { CreateAPIKeySchema } from "@srouter/types";

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
    const body = await c.req
        .json<{ email?: string; password?: string; name?: string; accepted_terms?: boolean }>()
        .catch(() => ({}));

    const emailErr = validateEmail(body.email);
    if (emailErr) return Err(c, emailErr, 400);

    const pwErr = validateUserPassword(body.password);
    if (pwErr) return Err(c, pwErr, 400);

    // Server-side consent gate: the sign-up checkbox is UI, this is the record.
    if (body.accepted_terms !== true) {
        return Err(c, "You must accept the Terms of Service and Privacy Policy to create an account.", 400, {
            code: "terms_not_accepted"
        });
    }

    const existing = await userAuthStore.getUserByEmail(body.email!);
    if (existing) return Err(c, "Email already registered", 409, { code: "email_exists" });

    const requiresApproval = await getRequireRegistrationApprovalDB();
    const user = await userAuthStore.createUser({
        email: body.email!,
        passwordHash: hashUserPassword(body.password!),
        name: body.name,
        status: requiresApproval ? "pending" : "active",
        acceptedTermsAt: Date.now(),
        termsVersion: TERMS_VERSION
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
    const body = await c.req
        .json<{ email?: string; password?: string; accepted_terms?: boolean }>()
        .catch(() => ({}));

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

    // Accounts predating the consent record (or consented to a stale ToS
    // version) must re-accept once before they get a session.
    if (user.acceptedTermsAt === null || user.termsVersion !== TERMS_VERSION) {
        if (body.accepted_terms !== true) {
            return Err(c, "You must accept the current Terms of Service and Privacy Policy to continue.", 403, {
                code: "terms_required"
            });
        }
        await userAuthStore.acceptTerms(user.id, TERMS_VERSION);
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
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
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

// ── Sign out everywhere ──
// Revokes every session for the account (this device included) so a leaked or
// forgotten login elsewhere can be cleaned up without waiting for expiry.
UserAuthRouter.post("/users/logout-all", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const revoked = await userAuthStore.deleteSessionsForUser(userId);
    deleteCookie(c, USER_SESSION_COOKIE, { path: "/" });
    return Ok(c, { revoked });
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
    const [user, reward] = await Promise.all([
        userAuthStore.getUserById(userId),
        userAuthStore.getLoginReward(userId)
    ]);
    if (!user) return Err(c, "User not found", 404);
    return Ok(c, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        creatorStatus: user.creatorStatus,
        isAdmin: user.isAdmin,
        credits: user.credits,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        acceptedTermsAt: user.acceptedTermsAt,
        termsVersion: user.termsVersion,
        createdAt: user.createdAt,
        loginStreak: reward?.streak ?? 0
    });
});

// ── Update own profile ──
// Email is intentionally not editable here: it is the login identity and
// changing it would need an ownership proof (verification flow), not a PATCH.
UserAuthRouter.patch("/users/me", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{ name?: string }>().catch(() => ({}));
    const name = body.name?.trim();
    if (!name || name.length < 1 || name.length > 64) {
        return Err(c, "Name must be 1-64 characters", 400);
    }
    const updated = await userAuthStore.updateName(userId, name);
    if (!updated) return Err(c, "User not found", 404);
    return Ok(c, {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        status: updated.status,
        creatorStatus: updated.creatorStatus,
        isAdmin: updated.isAdmin,
        credits: updated.credits
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
    const body = await c.req.json<{
        role?: string;
        displayName?: string;
        reason?: string;
        link?: string;
    }>().catch(() => ({}));
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

    // New applications require the admin applications toggle to be open, and
    // come with a short form the admin reviews before approving.
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const link = typeof body.link === "string" ? body.link.trim() : "";
    if (!displayName || !reason) {
        return Err(c, "displayName and reason are required to apply as a creator.", 400, {
            code: "creator_form_incomplete"
        });
    }
    if (displayName.length > 80 || reason.length > 2000 || link.length > 300) {
        return Err(c, "Application fields exceed length limits.", 400, {
            code: "creator_form_too_long"
        });
    }
    const applicationsOpen = await getCreatorApplicationsOpenDB();
    if (!applicationsOpen) {
        return Err(c, "Creator applications are closed right now. Check back later.", 403, {
            code: "creator_applications_closed"
        });
    }
    await userAuthStore.upsertCreatorApplication(userId, displayName, reason, link);
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

// ── User's subscription plan ──
UserAuthRouter.get("/users/plan", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const user = await userAuthStore.getUserById(userId);
    if (!user) return Err(c, "User not found", 404);
    return Ok(c, { plan: user.plan, planExpiresAt: user.planExpiresAt });
});

// The applicant's own application form (mirrors what the admin sees).
UserAuthRouter.get("/users/creator-application", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const application = await userAuthStore.getUserCreatorApplication(userId);
    return Ok(c, { application });
});

// ── Wallet top-up orders (payment-gateway flow, sandbox settlement) ──
// The buyer creates an order ('pending_payment') and settles it through the
// active gateway — the sandbox gateway's "pay" endpoint below credits the
// wallet immediately; a real gateway settles from its webhook. Only one
// unpaid order may exist per user at a time.
const TOPUP_MIN_AMOUNT = 5;
const TOPUP_MAX_AMOUNT = 10000;

UserAuthRouter.post("/users/topups", RequireUserAuth, async (c) => {
    if (!(await getTopupEnabledDB())) {
        return Err(c, "Top-up is currently disabled by the administrator.", 403, {
            code: "topup_disabled"
        });
    }
    const userId = c.get("userId") as string;
    const body = await c.req.json<{ amount?: number; reference?: string }>().catch(() => ({}));
    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < TOPUP_MIN_AMOUNT || amount > TOPUP_MAX_AMOUNT) {
        return Err(c, `Amount must be between $${TOPUP_MIN_AMOUNT} and $${TOPUP_MAX_AMOUNT}`, 400);
    }
    const reference =
        body.reference === undefined ? undefined : String(body.reference).trim().slice(0, 100);
    if (await getPendingTopupOrderDB(userId)) {
        return Err(c, "A top-up order is already awaiting payment. Pay or cancel it first.", 409, {
            code: "topup_pending_exists"
        });
    }
    const order = await createTopupOrderDB({ userId, amount, reference });
    return Ok(c, {
        topup: order,
        gateway: { name: GetActiveGateway().name, sandbox: GetActiveGateway().sandbox }
    });
});

UserAuthRouter.get("/users/topups", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
    const [topups, total, pending] = await Promise.all([
        listTopupOrdersDB(userId, limit, offset),
        countTopupOrdersDB(userId),
        getPendingTopupOrderDB(userId)
    ]);
    return Ok(c, { topups, total, pending });
});

UserAuthRouter.post("/users/topups/:id/cancel", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const order = await getTopupOrderDB(c.req.param("id"));
    if (!order || order.userId !== userId) return Err(c, "Top-up order not found", 404);
    if (order.status !== "pending" && order.status !== "pending_payment") {
        return Err(c, "Only unpaid orders can be cancelled", 409, { code: "topup_not_pending" });
    }
    const cancelled = await processTopupOrderDB(order.id, "cancelled");
    return Ok(c, { topup: cancelled });
});

// Sandbox gateway settlement — stands in for the gateway's async "payment
// succeeded" callback. Owner-only; credits land immediately. A real gateway
// replaces this with its checkout redirect + webhook into SettleTopupOrder.
UserAuthRouter.post("/users/topups/:id/pay", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const lookup = await GetPayableTopupOrder(c.req.param("id"), userId);
    if (!lookup.topup) {
        const payable = lookup.statusCode === 409;
        return Err(
            c,
            lookup.error ?? "Top-up order not found",
            lookup.statusCode ?? 404,
            { code: payable ? "topup_not_payable" : "topup_not_found" }
        );
    }
    const settled = await SettleTopupOrder(lookup.topup.id);
    if (!settled) return Err(c, "Order is not awaiting payment", 409, { code: "topup_not_payable" });
    return Ok(c, { topup: settled.topup, credits: settled.credits });
});

// ── Plan purchases (self-subscribe) ──

UserAuthRouter.post("/plan-purchases", RequireUserAuth, async (c) => {
    if (!(await getTopupEnabledDB())) {
        return Err(c, "Plan purchases are currently disabled by the administrator.", 403, {
            code: "topup_disabled"
        });
    }
    const userId = c.get("userId") as string;
    const body = await c.req.json<{ plan?: string }>().catch(() => ({}));
    const plan = String(body.plan ?? "").trim();
    const allowed = ["pro", "pro_max"] as const;
    if (!(allowed as readonly string[]).includes(plan)) {
        return Err(c, "Invalid plan. Allowed: pro, pro_max", 400, { code: "invalid_plan" });
    }
    if (await getPendingPlanPurchaseDB(userId)) {
        return Err(c, "A plan purchase is already awaiting payment. Pay or cancel it first.", 409, {
            code: "plan_purchase_pending"
        });
    }
    const config = await getPlanConfigDB(plan as "pro" | "pro_max");
    const purchase = await createPlanPurchaseDB({ userId, plan, amountCents: config.priceCentsUsd });
    return Ok(c, { purchase });
});

UserAuthRouter.post("/plan-purchases/:id/pay", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const purchase = await getPlanPurchaseDB(c.req.param("id"));
    if (!purchase || purchase.userId !== userId) {
        return Err(c, "Plan purchase not found", 404, { code: "plan_purchase_not_found" });
    }
    if (purchase.status !== "pending_payment") {
        return Err(c, "Order is not awaiting payment", 409, { code: "plan_purchase_not_payable" });
    }
    const settled = await settlePlanPurchaseDB(purchase.id);
    if (!settled) return Err(c, "Order is not awaiting payment", 409, { code: "plan_purchase_not_payable" });
    return Ok(c, { purchase: settled.purchase, expiresAt: settled.expiresAt });
});

UserAuthRouter.get("/plan-purchases", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const purchases = await listPlanPurchasesDB(userId);
    return Ok(c, { purchases });
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
    const body = await c.req.json().catch(() => ({}));
    const parsed = CreateAPIKeySchema.safeParse(body);
    if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? "Invalid payload";
        return Err(c, msg, 400);
    }
    const { name, enabled, rate_limit, quota_limit, credit_limit, allowed_models } = parsed.data;
    const key = await userAuthStore.createUserKey(userId, name, {
        enabled: enabled ?? true,
        rate_limit: rate_limit ?? 0,
        quota_limit: quota_limit ?? 0,
        credit_limit: credit_limit ?? 0,
        allowed_models: allowed_models ?? null
    });
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
