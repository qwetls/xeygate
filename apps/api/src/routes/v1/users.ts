import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { userAuthStore, getUserTransactionsDB, countUserTransactionsDB } from "@srouter/db";
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
import { Err, Ok } from "@/utils/response.js";

export const UserAuthRouter = new Hono();

const COOKIE_OPTS = {
    path: "/",
    httpOnly: true,
    secure: false, // set true behind HTTPS proxy
    sameSite: "lax" as const,
    maxAge: Math.floor(USER_SESSION_TTL_MS / 1000)
};

// ── Register ──
UserAuthRouter.post("/users/register", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string; name?: string }>().catch(() => ({}));

    const emailErr = validateEmail(body.email);
    if (emailErr) return Err(c, emailErr, 400);

    const pwErr = validateUserPassword(body.password);
    if (pwErr) return Err(c, pwErr, 400);

    const existing = await userAuthStore.getUserByEmail(body.email!);
    if (existing) return Err(c, "Email already registered", 409, { code: "email_exists" });

    const user = await userAuthStore.createUser({
        email: body.email!,
        passwordHash: hashUserPassword(body.password!),
        name: body.name
    });
    if (!user) return Err(c, "Registration failed", 500);

    const token = await createUserSession(userAuthStore, user.id);
    setCookie(c, USER_SESSION_COOKIE, token, COOKIE_OPTS);

    return Ok(c, { id: user.id, email: user.email, name: user.name, role: user.role, credits: user.credits });
});

// ── Login ──
UserAuthRouter.post("/users/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}));

    if (!body.email || !body.password) return Err(c, "Email and password are required", 400);

    const user = await userAuthStore.getUserByEmail(body.email);
    if (!user || !verifyUserPassword(body.password, user.passwordHash)) {
        return Err(c, "Invalid email or password", 401, { code: "invalid_credentials" });
    }

    const token = await createUserSession(userAuthStore, user.id);
    setCookie(c, USER_SESSION_COOKIE, token, COOKIE_OPTS);

    return Ok(c, { id: user.id, email: user.email, name: user.name, role: user.role, credits: user.credits });
});

// ── Logout ──
UserAuthRouter.post("/users/logout", async (c) => {
    const token = getCookie(c, USER_SESSION_COOKIE);
    await revokeUserSession(userAuthStore, token);
    deleteCookie(c, USER_SESSION_COOKIE, { path: "/" });
    return Ok(c, { message: "Logged out" });
});

// ── Current user ──
UserAuthRouter.get("/users/me", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const user = await userAuthStore.getUserById(userId);
    if (!user) return Err(c, "User not found", 404);
    return Ok(c, { id: user.id, email: user.email, name: user.name, role: user.role, credits: user.credits });
});

// ── Role ──
UserAuthRouter.get("/users/role", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const user = await userAuthStore.getUserById(userId);
    if (!user) return Err(c, "User not found", 404);
    return Ok(c, { role: user.role });
});

UserAuthRouter.put("/users/role", RequireUserAuth, async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json<{ role?: string }>().catch(() => ({}));
    if (body.role !== "buyer" && body.role !== "creator") {
        return Err(c, "Role must be 'buyer' or 'creator'", 400);
    }
    const updated = await userAuthStore.updateRole(userId, body.role);
    if (!updated) return Err(c, "User not found", 404);
    return Ok(c, { id: updated.id, role: updated.role });
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
