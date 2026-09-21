import type { Context, MiddlewareHandler } from "hono";
import { Err } from "@/utils/response.js";
import { userAuthStore, getPlanConfigDB } from "@srouter/db";
import { tierAllowsPlan, type PlanId } from "@srouter/constants";

const PLANS_URL = "https://gate.xeycompany.com/plans";

// ── Daily token tracking (in-memory, per-process) ──
const dailyTokens = new Map<string, { date: string; tokens: number }>();

function todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
}

function getDailyTokens(userId: string): number {
    const entry = dailyTokens.get(userId);
    if (!entry || entry.date !== todayUtc()) return 0;
    return entry.tokens;
}

function addDailyTokens(userId: string, tokens: number): void {
    const today = todayUtc();
    const entry = dailyTokens.get(userId);
    if (!entry || entry.date !== today) {
        dailyTokens.set(userId, { date: today, tokens });
    } else {
        entry.tokens += tokens;
    }
}

// ── Per-minute request tracking (in-memory) ──
const WINDOW_MS = 60_000;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function trackRequest(userId: string, limit: number): { ok: boolean; retryAfterSec?: number } {
    if (limit <= 0) return { ok: true };
    const now = Date.now();
    const key = `plan:${userId}`;
    const entry = requestWindows.get(key);

    if (!entry || entry.resetAt <= now) {
        requestWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { ok: true };
    }

    entry.count += 1;
    if (entry.count > limit) {
        const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        return { ok: false, retryAfterSec };
    }
    return { ok: true };
}

/**
 * Model-tier classification by provider category.
 * Free-tier providers → starter, api_key → pro, oauth/custom → pro_max.
 * The actual model tier is resolved from the provider's registered category.
 */
function classifyModelTier(modelId: string): string {
    // Models from custom_models (creator marketplace) are always pro_max
    // because creators supply them and pricing is set by the creator.
    // Official supply follows provider category.
    //
    // For now, classify by model name patterns as a heuristic.
    // When provider registry is available at request time, use that instead.
    const lower = modelId.toLowerCase();

    // Explicit free-tier models
    if (lower.includes("flash") && lower.includes("free")) return "starter";
    if (lower.includes("qwen3.8-flash")) return "starter";
    if (lower.includes("bai-")) return "starter";
    if (lower.includes("opencode-")) return "starter";
    if (lower.includes("seekai-")) return "starter";
    if (lower.includes("gorouter-")) return "starter";
    if (lower.includes("tabitoken-")) return "starter";
    if (lower.includes("bluesminds-")) return "starter";

    // Pro-tier models (paid providers with API keys)
    if (lower.includes("gpt-4")) return "pro";
    if (lower.includes("gpt-3.5")) return "pro";
    if (lower.includes("claude")) return "pro";
    if (lower.includes("gemini")) return "pro";
    if (lower.includes("llama")) return "pro";
    if (lower.includes("mistral")) return "pro";
    if (lower.includes("qwen")) return "pro";

    // Everything else (unknown/new models) → pro
    return "pro";
}

/**
 * Middleware that enforces plan-based model access and rate limits.
 *
 * Must run AFTER ApiKeyAuth (which sets `userId` on the context).
 *
 * Checks:
 * 1. User's plan allows the requested model's tier
 * 2. User hasn't exceeded daily token budget (if set)
 * 3. User hasn't exceeded per-minute request limit (if set)
 */
export function EnforcePlanAccess(): MiddlewareHandler {
    return async (c, next) => {
        const userId = c.get("userId") as string | undefined;
        if (!userId) return await next();

        const user = await userAuthStore.getUserById(userId);
        if (!user) return await next();

        // Admins bypass all plan restrictions
        if (user.isAdmin) return await next();

        const planId = (user.plan ?? "starter") as PlanId;
        // DB-backed config (admin-editable at /admin/plans) with a constants
        // fallback, so limits change without a redeploy.
        const plan = await getPlanConfigDB(planId);

        // ── 1. Rate limit (requests per minute) ──
        const rateCheck = trackRequest(userId, plan.rpm);
        if (!rateCheck.ok) {
            c.header("Retry-After", String(rateCheck.retryAfterSec));
            return Err(
                c,
                `Plan limit exceeded: your ${plan.label} plan allows ${plan.rpm} requests per minute. Upgrade at ${PLANS_URL}`,
                429,
                {
                    type: "insufficient_quota",
                    code: "plan_rate_exceeded",
                    plan: planId,
                    upgrade_url: PLANS_URL
                }
            );
        }

        // ── 2. Model tier access (only for chat completions) ──
        // ValidateJson has already parsed the body, so we can safely read it.
        const body = c.req.valid("json" as never) as { model?: string } | undefined;
        if (body?.model) {
            const modelTier = classifyModelTier(body.model);
            if (!tierAllowsPlan(plan.minTier, modelTier)) {
                return Err(
                    c,
                    `Model '${body.model}' requires the ${modelTier === "pro_max" ? "Pro Max" : "Pro"} plan or higher. Your current plan is ${plan.label}. Upgrade at ${PLANS_URL}`,
                    403,
                    {
                        type: "invalid_request_error",
                        code: "plan_upgrade_required",
                        required_tier: modelTier,
                        current_plan: planId,
                        upgrade_url: PLANS_URL
                    }
                );
            }
        }

        // ── 3. Daily token budget ──
        if (plan.dailyTokens > 0) {
            const used = getDailyTokens(userId);
            if (used >= plan.dailyTokens) {
                return Err(
                    c,
                    `Daily token limit reached for your ${plan.label} plan (${plan.dailyTokens.toLocaleString()} tokens/day). Resets at midnight UTC. Upgrade at ${PLANS_URL}`,
                    429,
                    {
                        type: "insufficient_quota",
                        code: "plan_daily_limit",
                        daily_limit: plan.dailyTokens,
                        daily_used: used,
                        plan: planId,
                        upgrade_url: PLANS_URL
                    }
                );
            }
        }

        await next();

        // ── Track tokens after successful completion ──
        if (plan.dailyTokens > 0) {
            try {
                const usage = c.get("usage") as { total_tokens?: number } | undefined;
                if (usage?.total_tokens) {
                    addDailyTokens(userId, usage.total_tokens);
                }
            } catch {
                // Usage not set yet — fine
            }
        }
    };
}
