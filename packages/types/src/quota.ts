export interface LiveModelQuotaItem {
    name: string;
    used: number;
    limit: number;
    percentage: string;
    percentageValue: number;
    resetIn: string;
    resetTime?: string;
    status: "ok" | "warning" | "exhausted";
}

export interface ProviderUsageMetric {
    model: string;
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    lastUsedAt: string | null;
}

export interface ProviderQuotaAccount {
    id: string;
    providerId: string;
    provider: string;
    account: string;
    enabled: boolean;
    quotaType: "live_provider_quota" | "usage_logged";
    totalQuotas?: number;
    quotas?: LiveModelQuotaItem[];
    usageMetrics?: ProviderUsageMetric[];
}

export interface QuotaResponse {
    object: "quota";
    totalAccounts: number;
    providers: ProviderQuotaAccount[];
}
