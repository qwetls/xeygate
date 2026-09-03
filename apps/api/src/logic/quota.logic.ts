import { getAllProvidersDB } from "@srouter/db";
import { fetchLiveOAuthQuota, isOAuthQuotaSupported } from "@srouter/providers";
import type { ProviderQuotaAccount, QuotaResponse } from "@srouter/types";

export class QuotaLogic {
    public static async getQuotaInfo(): Promise<QuotaResponse> {
        const dbProviders = await QuotaLogic.getOAuthProviders();
        const providerAccounts: ProviderQuotaAccount[] = [];

        for (const p of dbProviders) {
            try {
                const account = await fetchLiveOAuthQuota({
                    id: p.id,
                    providerId: p.providerId,
                    name: p.name,
                    accessToken: p.accessToken,
                    enabled: p.enabled
                });
                if (account) {
                    providerAccounts.push(account);
                }
            } catch {
                // Skip providers whose live quota fails or is temporarily unavailable
            }
        }

        return {
            object: "quota",
            totalAccounts: providerAccounts.length,
            providers: providerAccounts
        };
    }

    private static async getOAuthProviders() {
        const all = await getAllProvidersDB();
        // Wajib OAuth: category === 'oauth' atau provider yang mendukung quota OAuth
        return all.filter((p) => {
            if (p.category === "oauth") return true;
            if (isOAuthQuotaSupported(p.providerId) || isOAuthQuotaSupported(p.id)) return true;
            return false;
        });
    }
}
