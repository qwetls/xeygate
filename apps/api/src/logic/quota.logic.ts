import { getAllProvidersDB, getMarketplaceModelProviderStatsDB } from "@srouter/db";
import { fetchLiveOAuthQuota, isOAuthQuotaSupported } from "@srouter/providers";
import type {
    ProviderConfig,
    ProviderQuotaAccount,
    ProviderUsageMetric,
    QuotaResponse
} from "@srouter/types";

// request_logs retention window used to synthesize "usage_logged" quota accounts.
const USAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export class QuotaLogic {
    private static cachedQuota: QuotaResponse | null = null;
    private static cacheExpiresAt = 0;
    private static inFlightPromise: Promise<QuotaResponse> | null = null;
    private static readonly CACHE_TTL_MS = 60_000; // 60 seconds

    public static async getQuotaInfo(forceRefresh = false): Promise<QuotaResponse> {
        const now = Date.now();

        if (!forceRefresh && QuotaLogic.cachedQuota && now < QuotaLogic.cacheExpiresAt) {
            return QuotaLogic.cachedQuota;
        }

        if (QuotaLogic.inFlightPromise) {
            return QuotaLogic.inFlightPromise;
        }

        QuotaLogic.inFlightPromise = (async () => {
            try {
                const dbProviders = await getAllProvidersDB();
                const providerAccounts: ProviderQuotaAccount[] = [];

                // Providers with a real upstream quota API (OAuth/token based) are fetched live.
                const liveCandidates = dbProviders.filter(
                    (p) =>
                        p.category === "oauth" ||
                        isOAuthQuotaSupported(p.providerId) ||
                        isOAuthQuotaSupported(p.id)
                );

                // Fetch quota concurrently across accounts with individual timeout protection
                await Promise.allSettled(
                    liveCandidates.map(async (p) => {
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
                    })
                );

                // Every other provider that has served gateway traffic is reported from its
                // recorded usage so the dashboard reflects the real connected providers, not
                // just the handful with a live quota endpoint.
                const covered = new Set(providerAccounts.map((a) => a.id));
                const usageAccounts = await QuotaLogic.getUsageLoggedAccounts(
                    dbProviders,
                    covered
                );
                providerAccounts.push(...usageAccounts);

                const response: QuotaResponse = {
                    object: "quota",
                    totalAccounts: providerAccounts.length,
                    providers: providerAccounts
                };

                QuotaLogic.cachedQuota = response;
                QuotaLogic.cacheExpiresAt = Date.now() + QuotaLogic.CACHE_TTL_MS;
                return response;
            } finally {
                QuotaLogic.inFlightPromise = null;
            }
        })();

        return QuotaLogic.inFlightPromise;
    }

    /**
     * Build "usage_logged" quota accounts from request_logs aggregates.
     * request_logs.provider_id stores whichever identifier routed the request
     * (row id, canonical provider_id, or alias), so each provider row claims
     * usage under any of its lowercased keys.
     */
    private static async getUsageLoggedAccounts(
        dbProviders: ProviderConfig[],
        covered: Set<string>
    ): Promise<ProviderQuotaAccount[]> {
        const stats = await getMarketplaceModelProviderStatsDB(USAGE_WINDOW_MS);

        const byKey = new Map<string, ProviderUsageMetric[]>();
        for (const row of stats) {
            const key = row.providerId.toLowerCase();
            const list = byKey.get(key) ?? [];
            list.push({
                model: row.model,
                totalRequests: row.totalRequests,
                totalTokens: row.totalTokens,
                promptTokens: row.promptTokens,
                completionTokens: row.completionTokens,
                lastUsedAt: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null
            });
            byKey.set(key, list);
        }

        const accounts: ProviderQuotaAccount[] = [];
        for (const p of dbProviders) {
            if (covered.has(p.id)) continue;
            const keys = [p.id, p.providerId, p.alias ?? ""]
                .map((k) => k.toLowerCase())
                .filter(Boolean);
            const metrics: ProviderUsageMetric[] = [];
            for (const key of keys) {
                const rows = byKey.get(key);
                if (rows) metrics.push(...rows);
            }
            if (metrics.length === 0) continue;
            metrics.sort((a, b) => b.totalRequests - a.totalRequests);
            accounts.push({
                id: p.id,
                provider: p.name || p.providerId,
                account: p.alias ? `${p.name} (${p.alias})` : p.name || p.providerId,
                enabled: p.enabled,
                quotaType: "usage_logged",
                usageMetrics: metrics
            });
        }
        return accounts;
    }
}
