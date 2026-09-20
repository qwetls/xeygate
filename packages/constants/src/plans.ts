/**
 * Subscription plan definitions for XEYGATE.
 *
 * Plans control which models a user can access and what rate/token limits
 * apply. The admin assigns a plan to each user; enforcement happens in the
 * inference middleware.
 *
 * `credit_limit = 0` means UNLIMITED — this convention is already used by
 * ApiKeyAuth for per-key credit checks.
 */

export type PlanId = "starter" | "pro" | "pro_max" | "payg";

export interface PlanDefinition {
    id: PlanId;
    label: string;
    /** Daily token budget — 0 means unlimited */
    dailyTokens: number;
    /** Requests per minute — 0 means unlimited */
    requestsPerMinute: number;
    /**
     * Minimum model tier the plan grants access to.
     *   "starter" = free-tier models only
     *   "pro"     = free-tier + pro models
     *   "pro_max" = everything
     *   "payg"    = everything (pay per token)
     */
    minTier: "starter" | "pro" | "pro_max";
}

export const PLANS: Record<PlanId, PlanDefinition> = {
    starter: {
        id: "starter",
        label: "Starter",
        dailyTokens: 10_000,
        requestsPerMinute: 10,
        minTier: "starter"
    },
    pro: {
        id: "pro",
        label: "Pro",
        dailyTokens: 500_000,
        requestsPerMinute: 60,
        minTier: "pro"
    },
    pro_max: {
        id: "pro_max",
        label: "Pro Max",
        dailyTokens: 0,
        requestsPerMinute: 0,
        minTier: "pro_max"
    },
    payg: {
        id: "payg",
        label: "Pay-as-you-go",
        dailyTokens: 0,
        requestsPerMinute: 0,
        minTier: "pro_max"
    }
};

/** Tier hierarchy — higher index = more access. */
const TIER_RANK: Record<string, number> = { starter: 0, pro: 1, pro_max: 2 };

/**
 * Returns true if the plan grants access to the given model tier.
 */
export function planAllowsTier(planId: PlanId, modelTier: string): boolean {
    const plan = PLANS[planId];
    if (!plan) return false;
    const planRank = TIER_RANK[plan.minTier] ?? 0;
    const modelRank = TIER_RANK[modelTier] ?? 0;
    return modelRank <= planRank;
}
