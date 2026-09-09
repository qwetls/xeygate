import { z } from "zod";

export interface LogCostBreakdown {
    inputCost: number;
    outputCost: number;
    cacheReadCost: number;
    cacheCreationCost?: number;
    totalCost: number;
}

export interface RequestLogEntry {
    id: string;
    apiKeyId?: string;
    apiKeyName?: string;
    ipAddress?: string;
    userAgent?: string;
    providerId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    statusCode: number;
    latencyMs: number;
    cachedTokens?: number;
    cacheCreationTokens?: number;
    reasoningTokens?: number;
    estimatedCost?: number;
    costBreakdown?: LogCostBreakdown;
    fallbackOccurred?: boolean;
    fallbackPath?: string;
    fallbackReason?: string;
    resolvedModel?: string;
    createdAt: number;
}

export interface UsageSummary {
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCachedTokens: number;
    totalCacheCreationTokens: number;
    totalReasoningTokens: number;
    totalEstimatedCost: number;
    // 9router-style aliases
    totalInputTokens: number;
    totalOutputTokens: number;
}

export interface UsageByModelRow {
    model: string;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    estCost: number;
}

export interface ModelUsageSummaryRow {
    model: string;
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    estimatedCost: number;
    lastUsedAt: number | null;
}

export interface UsageStats extends UsageSummary {
    object: "usage";
    costLabel: string;
    estimated: boolean;
    byModel: UsageByModelRow[];
}

// --- Analytics ---

export type AnalyticsWindow = "1h" | "24h" | "7d" | "30d";

export interface AnalyticsBucket {
    bucketStart: number; // epoch ms, aligned to bucket size
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    avgLatencyMs: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
}

export interface AnalyticsTopModel {
    model: string;
    totalRequests: number;
    totalTokens: number;
    estCost: number;
}

export interface AnalyticsTopAgent {
    agent: string;
    rawUserAgent: string;
    totalRequests: number;
    totalTokens: number;
}

export interface AnalyticsProviderSlice {
    providerId: string;
    totalRequests: number;
}

export interface AnalyticsReport {
    object: "analytics";
    window: AnalyticsWindow;
    bucketSizeMs: number;
    generatedAt: number;
    requestsPerSecond: number; // rolling 60s average
    totalRequests: number;
    errorRate: number; // 0..1 over the window
    p95LatencyMs: number;
    buckets: AnalyticsBucket[];
    topModels: AnalyticsTopModel[];
    topAgents?: AnalyticsTopAgent[];
    providers: AnalyticsProviderSlice[];
}

export const AnalyticsQuerySchema = z.object({
    window: z.enum(["1h", "24h", "7d", "30d"]).default("24h")
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

// --- Public marketplace analytics ---
//
// Aggregate-only shapes served without authentication (OpenRouter-style).
// They deliberately exclude every caller-identifying field: api key, IP
// address, user agent and spend are private to the requesting account.

export type MarketplaceAnalyticsWindow = "24h" | "7d" | "30d";

/** One bucket of a public time series. */
export interface MarketplaceStatPoint {
    ts: number; // epoch ms, aligned to the bucket size
    requests: number;
    tokens: number;
    successRate: number; // 0..1
    avgLatencyMs: number;
}

/** Aggregated traffic for one bare marketplace model. */
export interface MarketplaceModelStat {
    model: string;
    totalRequests: number;
    totalErrors: number;
    successRate: number; // 0..1
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    throughputTokensPerSec: number; // completion tokens per request-second
    totalTokens: number;
    completionTokens: number;
    promptTokens: number;
    cachedTokens: number;
    cacheHitRate: number; // cached / prompt tokens, 0..1
    providers: number; // distinct supply endpoints seen
    lastSeenAt: number;
}

/** Aggregated traffic for one supply endpoint (a provider connection). */
export interface MarketplaceEndpointStat {
    providerId: string;
    alias: string;
    displayName: string; // creator account name, provider name when official
    official: boolean;
    totalRequests: number;
    totalErrors: number;
    successRate: number;
    avgLatencyMs: number;
    throughputTokensPerSec: number;
    totalTokens: number;
    completionTokens: number;
    cachedTokens: number;
    cacheHitRate: number;
    lastSeenAt: number;
}

export interface MarketplaceProviderStat extends MarketplaceEndpointStat {
    models: number; // distinct bare models served in the window
}

export interface MarketplaceModelStats {
    object: "marketplace.model.stats";
    model: string;
    window: MarketplaceAnalyticsWindow;
    generatedAt: number;
    total: MarketplaceModelStat;
    endpoints: MarketplaceEndpointStat[];
    series: MarketplaceStatPoint[];
}

export interface MarketplaceLeaderboard {
    object: "marketplace.leaderboard";
    window: MarketplaceAnalyticsWindow;
    generatedAt: number;
    models: MarketplaceModelStat[];
}

export interface MarketplaceProviderStats {
    object: "marketplace.provider.stats";
    window: MarketplaceAnalyticsWindow;
    generatedAt: number;
    providers: MarketplaceProviderStat[];
}

export interface MarketplaceAnalyticsOverview {
    object: "marketplace.analytics.overview";
    window: MarketplaceAnalyticsWindow;
    generatedAt: number;
    totalRequests: number;
    totalErrors: number;
    successRate: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    cacheHitRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    throughputTokensPerSec: number;
    models: number;
    endpoints: number;
    series: MarketplaceStatPoint[];
    topModels: MarketplaceModelStat[];
}

export const MarketplaceAnalyticsQuerySchema = z.object({
    window: z.enum(["24h", "7d", "30d"]).default("24h")
});
export type MarketplaceAnalyticsQuery = z.infer<typeof MarketplaceAnalyticsQuerySchema>;

export const MarketplaceLeaderboardQuerySchema = MarketplaceAnalyticsQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(100).default(10)
});
export type MarketplaceLeaderboardQuery = z.infer<typeof MarketplaceLeaderboardQuerySchema>;
