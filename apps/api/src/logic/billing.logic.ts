import {
    createTransactionDB,
    createCreatorEarningDB,
    getProviderByIdDB,
    getProviderByAliasDB,
    getAPIKeyByIdDB,
    getModelPricingDB,
    userAuthStore,
    type TransactionType
} from "@srouter/db";
import { calculateCostFromTokens } from "@srouter/pricing";

/**
 * Default creator revenue share (80% creator / 20% platform fee). Admin can
 * override per creator via users.creator_share; the share is read at settle
 * time so changes apply to new traffic immediately.
 */
export const DEFAULT_CREATOR_SHARE = 0.8;

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

        // The router may record the connection under its alias (custom creator
        // rows) and the model under its rewritten "alias/bare" form, while
        // pricing overrides and ownership are keyed by the canonical row id
        // and the bare model. Re-resolve both before pricing/crediting.
        let provider = await getProviderByIdDB(providerId);
        if (!provider) provider = await getProviderByAliasDB(providerId);
        const canonicalProviderId = provider?.id ?? providerId;
        const bareModel = model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;

        // Buyer-facing price: admin override wins, else static estimate.
        const amount = await resolveMarketplacePrice({
            providerId: canonicalProviderId,
            model: bareModel,
            fallback: options.amount,
            breakdown: options.breakdown
        });
        if (!(amount > 0)) return;

        const creatorId = provider?.ownerId ?? undefined;
        const creatorShare = creatorId
            ? (await userAuthStore.getUserById(creatorId))?.creatorShare ?? DEFAULT_CREATOR_SHARE
            : 0;
        // Creator share defaults to 80%; admin can override per creator. The
        // platform fee is the remainder (1 - share). Admin-owned providers have
        // no creator share, so the platform keeps the full amount.
        const platformFee = Math.round(amount * (1 - creatorShare) * 1e6) / 1e6;
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
                providerId: canonicalProviderId,
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
