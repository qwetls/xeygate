import {
    createTransactionDB,
    createCreatorEarningDB,
    getProviderByIdDB,
    getAPIKeyByIdDB,
    userAuthStore,
    type TransactionType
} from "@srouter/db";

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
}): Promise<void> {
    const { apiKeyId, providerId, model, amount } = options;
    if (!(amount > 0)) return;

    try {
        const apiKey = await getAPIKeyByIdDB(apiKeyId);
        if (!apiKey?.user_id) return;

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
