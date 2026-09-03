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

        // Group models into buckets: Gemini pool vs Other pool (Claude & GPT)
        let geminiMinRemaining = 1.0;
        let geminiResetTime: string | undefined;
        let geminiHasModel = false;

        let otherMinRemaining = 1.0;
        let otherResetTime: string | undefined;
        let otherHasModel = false;

        for (const [modelId, item] of Object.entries(Data.models)) {
            const rawName = (item.displayName || modelId).toLowerCase();
            // Filter out internal background preview tabs
            if (rawName.startsWith("tab_") || rawName.startsWith("chat_")) {
                continue;
            }

            const rem = item.quotaInfo?.remainingFraction ?? 1.0;
            const rTime = item.quotaInfo?.resetTime;

            if (rawName.includes("gemini")) {
                geminiHasModel = true;
                if (rem < geminiMinRemaining) {
                    geminiMinRemaining = rem;
                }
                if (rTime && (!geminiResetTime || new Date(rTime) > new Date(geminiResetTime))) {
                    geminiResetTime = rTime;
                }
            } else if (rawName.includes("claude") || rawName.includes("gpt")) {
                otherHasModel = true;
                if (rem < otherMinRemaining) {
                    otherMinRemaining = rem;
                }
                if (rTime && (!otherResetTime || new Date(rTime) > new Date(otherResetTime))) {
                    otherResetTime = rTime;
                }
            }
        }

        const Quotas: LiveModelQuotaItem[] = [];

        const createQuotaItem = (
            name: string,
            fraction: number,
            resetTime?: string
        ): LiveModelQuotaItem => {
            const percentageValue = Math.round(fraction * 100);
            const limit = 1000;
            const used = Math.round((1 - fraction) * limit);
            const resetIn = formatResetIn(resetTime);

            let status: "ok" | "warning" | "exhausted" = "ok";
            if (percentageValue <= 5) status = "exhausted";
            else if (percentageValue <= 20) status = "warning";

            return {
                name,
                used,
                limit,
                percentage: `${percentageValue}%`,
                percentageValue,
                resetIn,
                resetTime,
                status
            };
        };

        if (geminiHasModel) {
            Quotas.push(createQuotaItem("Quota Gemini", geminiMinRemaining, geminiResetTime));
        }
        if (otherHasModel) {
            Quotas.push(createQuotaItem("Quota Other (Claude & GPT)", otherMinRemaining, otherResetTime));
        }

        // Fallback: If no models matched the grouping, map original models
        if (Quotas.length === 0) {
            for (const [modelId, item] of Object.entries(Data.models)) {
                Quotas.push(
                    createQuotaItem(
                        item.displayName || modelId,
                        item.quotaInfo?.remainingFraction ?? 1.0,
                        item.quotaInfo?.resetTime
                    )
                );
            }
        }

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
