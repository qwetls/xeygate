import {
    createTransactionDB,
    createCreatorEarningDB,
    getProviderByIdDB,
    getAPIKeyByIdDB,
    getModelPricingDB,
    userAuthStore,
    type TransactionType
} from "@srouter/db";
import { calculateCostFromTokens } from "@srouter/pricing";

/**
 * Platform fee share taken from each marketplace usage (e.g. 0.3 = 30%).
 * TODO(Fase C): make this configurable per-provider via system_settings.
 */
export const PLATFORM_FEE_RATE = 0.3;

export interface BillingResult {
    charged: boolean;
    amount: number;
    platformFee: number;
    creatorNet: number;
    creatorId?: string;
    reason?: string;
}

/**
 * Resolve the buyer-facing price for a request.
 * Admin per-model override (model_pricing) wins; otherwise fall back to the
 * static catalog estimate passed in as `fallback`.
 */
export async function resolveMarketplacePrice(options: {
    providerId: string;
    model: string;
    fallback: number;
    breakdown?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        cached_tokens?: number;
        cache_creation_tokens?: number;
        reasoning_tokens?: number;
    };
}): Promise<number> {
    if (!options.breakdown) return options.fallback;
    const override = await getModelPricingDB(options.providerId, options.model);
    if (!override) return options.fallback;
    return calculateCostFromTokens(
        {
            prompt_tokens: options.breakdown.prompt_tokens,
            completion_tokens: options.breakdown.completion_tokens,
            cached_tokens: options.breakdown.cached_tokens,
            cache_creation_input_tokens: options.breakdown.cache_creation_tokens,
            reasoning_tokens: options.breakdown.reasoning_tokens
        },
        {
            input: override.input,
            output: override.output,
            cached: override.cached,
            cache_creation: override.cacheCreation,
            reasoning: override.reasoning
        }
    );
}

/**
 * Settle a completed marketplace request:
 * 1. Debit the buyer's credit balance by the request cost.
 * 2. If the provider is creator-owned, credit the creator's earnings
 *    (gross - platform fee) and record an earnings row.
 * 3. Record the debit transaction on the buyer's ledger.
 *
 * Failures are swallowed on purpose: billing must never break request
 * logging, which is the caller's primary responsibility.
 */
export async function settleMarketplaceUsage(options: {
    apiKeyId: string;
    providerId: string;
    model: string;
    amount: number;
    breakdown?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        cached_tokens?: number;
        cache_creation_tokens?: number;
        reasoning_tokens?: number;
    };
}): Promise<void> {
    const { apiKeyId, providerId, model } = options;

    try {
        const apiKey = await getAPIKeyByIdDB(apiKeyId);
        if (!apiKey?.user_id) return;

        // Buyer-facing price: admin override wins, else static estimate.
        const amount = await resolveMarketplacePrice({
            providerId,
            model,
            fallback: options.amount,
            breakdown: options.breakdown
        });
        if (!(amount > 0)) return;

        const provider = await getProviderByIdDB(providerId);
        const creatorId = provider?.ownerId ?? undefined;
        const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 1e6) / 1e6;
        const creatorNet = Math.max(0, amount - platformFee);

        // Debit buyer ledger + balance.
        await createTransactionDB({
            userId: apiKey.user_id,
            type: "debit",
            amount,
            description: `Usage: ${providerId} / ${model}`,
            providerId,
            model,
            apiKeyId
        });
        await userAuthStore.updateCredits(apiKey.user_id, -amount);

        // Credit creator (if the provider is creator-owned).
        if (creatorId) {
            await createCreatorEarningDB({
                userId: creatorId,
                providerId,
                grossAmount: amount,
                platformFee,
                netAmount: creatorNet,
            });
            await userAuthStore.updateCredits(creatorId, creatorNet);
        }
    } catch (error) {
        console.error("[xeygate] marketplace billing failed:", error);
    }
}
