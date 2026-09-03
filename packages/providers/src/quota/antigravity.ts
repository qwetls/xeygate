import { isProviderBaseId } from "@srouter/constants";
import type { LiveModelQuotaItem, ProviderQuotaAccount } from "@srouter/types";
import { type IProviderQuotaFetcher, type ProviderQuotaContext, formatResetIn } from "./base.js";

interface CloudCodeFetchAvailableModelsResponse {
    models?: Record<
        string,
        {
            displayName?: string;
            quotaInfo?: {
                remainingFraction?: number;
                resetTime?: string;
            };
        }
    >;
}

export class AntigravityQuotaFetcher implements IProviderQuotaFetcher {
    public readonly providerKey = "antigravity";

    public canHandle(providerId: string): boolean {
        return isProviderBaseId(providerId, "antigravity");
    }

    public async fetchQuota(ctx: ProviderQuotaContext): Promise<ProviderQuotaAccount> {
        const accessToken = ctx.accessToken || "";
        if (!accessToken || !(accessToken.startsWith("ya29.") || accessToken.length > 20)) {
            throw new Error("Antigravity quota requires a valid access token");
        }

        const Res = await fetch("https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "User-Agent": "Antigravity/1.0 (VSCode)",
                "x-goog-api-client": "gl-node/18.0.0 gd/1.0.0"
            },
            body: JSON.stringify({})
        });

        if (!Res.ok) {
            throw new Error(`Antigravity quota fetch failed: HTTP ${Res.status}`);
        }

        const Data = (await Res.json()) as CloudCodeFetchAvailableModelsResponse;
        if (!Data.models || Object.keys(Data.models).length === 0) {
            throw new Error("Antigravity quota fetch returned no models");
        }

        const Quotas: LiveModelQuotaItem[] = Object.entries(Data.models).map(([modelId, item]) => {
            const RemainingFraction = item.quotaInfo?.remainingFraction ?? 1.0;
            const PercentageValue = Math.round(RemainingFraction * 100);
            const Limit = 1000;
            const Used = Math.round((1 - RemainingFraction) * Limit);
            const ResetIn = formatResetIn(item.quotaInfo?.resetTime);

            let Status: "ok" | "warning" | "exhausted" = "ok";
            if (PercentageValue <= 5) Status = "exhausted";
            else if (PercentageValue <= 20) Status = "warning";

            return {
                name: item.displayName || modelId,
                used: Used,
                limit: Limit,
                percentage: `${PercentageValue}%`,
                percentageValue: PercentageValue,
                resetIn: ResetIn,
                resetTime: item.quotaInfo?.resetTime,
                status: Status
            };
        });

        return {
            id: ctx.id,
            provider: "Antigravity",
            account: ctx.name || "Antigravity Account",
            enabled: ctx.enabled,
            quotaType: "live_provider_quota",
            totalQuotas: Quotas.length,
            quotas: Quotas
        };
    }
}
