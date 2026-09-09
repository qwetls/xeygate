import {
    getAllProvidersDB,
    getBucketCount,
    getBucketSizeMs,
    getMarketplaceGlobalP95DB,
    getMarketplaceLatencyPercentilesDB,
    getMarketplaceModelProviderStatsDB,
    getMarketplaceTimeSeriesDB
} from "@srouter/db";
import type {
    MarketplaceAnalyticsOverview,
    MarketplaceAnalyticsWindow,
    MarketplaceEndpointStat,
    MarketplaceLeaderboard,
    MarketplaceModelStat,
    MarketplaceModelStats,
    MarketplaceProviderStat,
    MarketplaceProviderStats,
    MarketplaceStatPoint
} from "@srouter/types";
import { isSeedProvider, providerAlias, providerBaseId } from "@srouter/constants";
import { IsOfficialProviderRow } from "./official.logic.js";
import { RuntimeAliasFor, StorefrontName } from "./providers.logic.js";

/**
 * Public, OpenRouter-style marketplace analytics.
 *
 * Everything served here is an aggregate over request_logs for the chosen
 * window. The shapes never carry caller-identifying data (api key, IP, user
 * agent) and never expose spend — those belong to the admin and owner
 * dashboards, not the public surface.
 *
 * One grouped read (model × provider over the window) feeds the leaderboard,
 * the per-model page and the per-endpoint page, so all three agree exactly.
 */

interface WindowSpec {
    windowMs: number;
    bucketSizeMs: number;
    bucketCount: number;
}

function WindowSpecFor(window: MarketplaceAnalyticsWindow): WindowSpec {
    const bucketSizeMs = getBucketSizeMs(window);
    const bucketCount = getBucketCount(window);
    return { windowMs: bucketSizeMs * bucketCount, bucketSizeMs, bucketCount };
}

/**
 * request_logs stores the model as it was sent: the bare id when a marketplace
 * attempt failed ("gpt-4o") and the rewritten "alias/bare" form once a listing
 * served it. Both spellings are one marketplace model, so every aggregate keys
 * on the suffix after the first slash.
 */
function BareKey(rawModel: string): string {
    const slash = rawModel.indexOf("/");
    const bare = slash >= 0 ? rawModel.slice(slash + 1) : rawModel;
    return bare.trim();
}

interface Accumulator {
    requests: number;
    errors: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    totalTokens: number;
    latencySumMs: number;
    lastSeenAt: number;
}

function Empty(): Accumulator {
    return {
        requests: 0,
        errors: 0,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        latencySumMs: 0,
        lastSeenAt: 0
    };
}

function Absorb(acc: Accumulator, row: Accumulator): void {
    acc.requests += row.requests;
    acc.errors += row.errors;
    acc.promptTokens += row.promptTokens;
    acc.completionTokens += row.completionTokens;
    acc.cachedTokens += row.cachedTokens;
    acc.totalTokens += row.totalTokens;
    acc.latencySumMs += row.latencySumMs;
    acc.lastSeenAt = Math.max(acc.lastSeenAt, row.lastSeenAt);
}

function Round(value: number, digits = 0): number {
    const factor = 10 ** digits;
    return Math.round((value || 0) * factor) / factor;
}

function SuccessRate(acc: Accumulator): number {
    return acc.requests > 0 ? Round((acc.requests - acc.errors) / acc.requests, 3) : 0;
}

function AvgLatencyMs(acc: Accumulator): number {
    return acc.requests > 0 ? Round(acc.latencySumMs / acc.requests) : 0;
}

/**
 * Output tokens per wall-clock second across the window — the same
 * effective-throughput figure the quality router weighs.
 */
function Throughput(acc: Accumulator): number {
    const seconds = acc.latencySumMs / 1000;
    return seconds > 0 ? Round(acc.completionTokens / seconds, 2) : 0;
}

function CacheHitRate(acc: Accumulator): number {
    const inputTotal = acc.promptTokens + acc.cachedTokens;
    return inputTotal > 0 ? Round(acc.cachedTokens / inputTotal, 3) : 0;
}

// ── Usage scan ──────────────────────────────────────────────────────────

interface UsageSlice {
    bare: string;
    displayModel: string;
    rawModel: string;
    providerId: string;
    acc: Accumulator;
}

async function ScanUsage(window: MarketplaceAnalyticsWindow): Promise<UsageSlice[]> {
    const rows = await getMarketplaceModelProviderStatsDB(WindowSpecFor(window).windowMs);
    const slices: UsageSlice[] = [];
    for (const row of rows) {
        const bare = BareKey(row.model);
        if (!bare) continue;
        slices.push({
            bare,
            displayModel: bare,
            rawModel: row.model,
            providerId: row.providerId,
            acc: {
                requests: row.totalRequests,
                errors: row.errorRequests,
                promptTokens: row.promptTokens,
                completionTokens: row.completionTokens,
                cachedTokens: row.cachedTokens,
                totalTokens: row.totalTokens,
                latencySumMs: row.latencySumMs,
                lastSeenAt: row.lastSeenAt
            }
        });
    }
    return slices;
}

/** Distinct raw log spellings behind a set of merged slices, in first-seen order. */
function RawSpellings(slices: UsageSlice[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const slice of slices) {
        if (!seen.has(slice.rawModel)) {
            seen.add(slice.rawModel);
            out.push(slice.rawModel);
        }
    }
    return out;
}

/**
 * Percentiles are measured per raw logged spelling; one marketplace model
 * carries a couple (the served "alias/bare" plus the failed bare form). The
 * busiest spelling represents the model.
 */
function DominantPercentiles(
    percentiles: Map<string, { p50: number; p95: number }>,
    slices: UsageSlice[]
): { p50: number; p95: number } {
    let best: UsageSlice | undefined;
    for (const slice of slices) {
        if (!best || slice.acc.requests > best.acc.requests) best = slice;
    }
    return (best && percentiles.get(best.rawModel)) || { p50: 0, p95: 0 };
}

// ── Endpoint directory (who served the traffic) ─────────────────────────

interface EndpointMeta {
    providerId: string;
    alias: string;
    displayName: string;
    official: boolean;
}

interface EndpointDirectory {
    find(loggedProviderId: string): EndpointMeta | undefined;
    resolve(loggedProviderId: string): EndpointMeta;
}

/**
 * Index every enabled non-seed connection by all four identifiers the log
 * column may hold (row id, provider_id, alias, runtime alias).
 *
 * Keys that map to no connection are not supply: a failed bare marketplace
 * attempt logs its provider_id as the model name itself because the router had
 * no winning connection to attribute. That traffic stays in the model totals
 * and is left out of every per-endpoint breakdown.
 */
async function BuildEndpointDirectory(): Promise<EndpointDirectory> {
    const rows = await getAllProvidersDB();
    const byKey = new Map<string, EndpointMeta>();

    for (const row of rows) {
        if (!row.enabled || isSeedProvider(row)) continue;
        const official = await IsOfficialProviderRow(row);
        const providerId = row.providerId || row.id;
        const alias = row.alias || RuntimeAliasFor(providerId.toLowerCase());
        const displayName = official ? row.name : await StorefrontName(row.ownerId, row.name);
        const meta: EndpointMeta = { providerId, alias, displayName, official };
        for (const key of [row.id, row.providerId, row.alias, alias]) {
            if (key) byKey.set(key.toLowerCase(), meta);
        }
    }

    return {
        find(loggedProviderId: string): EndpointMeta | undefined {
            return byKey.get(loggedProviderId.toLowerCase());
        },
        resolve(loggedProviderId: string): EndpointMeta {
            const known = byKey.get(loggedProviderId.toLowerCase());
            if (known) return known;
            // Unmatched keys are platform drivers: OAuth connections log under
            // their base id and own no storefront row, so they are official.
            const lower = loggedProviderId.toLowerCase();
            const alias = providerAlias(providerBaseId(lower));
            return { providerId: lower, alias, displayName: alias, official: true };
        }
    };
}

/**
 * Distinct attributable endpoints among a model's slices. A provider id that is
 * not a connection (the failed-bare marker) is not counted as supply, but the
 * "default" marker a slash-form failure logs under still resolves to the driver
 * that was asked.
 */
function CountProviders(slices: UsageSlice[], directory: EndpointDirectory): number {
    const keys = new Set<string>();
    for (const slice of slices) {
        if (directory.find(slice.providerId)) keys.add(slice.providerId.toLowerCase());
    }
    return keys.size;
}

// ── Shaping helpers ─────────────────────────────────────────────────────

function ModelStat(
    model: string,
    slices: UsageSlice[],
    percentiles: Map<string, { p50: number; p95: number }>,
    directory: EndpointDirectory
): MarketplaceModelStat {
    const acc = SumAll(slices);
    const q = DominantPercentiles(percentiles, slices);
    return {
        model,
        totalRequests: acc.requests,
        totalErrors: acc.errors,
        successRate: SuccessRate(acc),
        avgLatencyMs: AvgLatencyMs(acc),
        p50LatencyMs: Round(q.p50),
        p95LatencyMs: Round(q.p95),
        throughputTokensPerSec: Throughput(acc),
        totalTokens: acc.totalTokens,
        completionTokens: acc.completionTokens,
        promptTokens: acc.promptTokens,
        cachedTokens: acc.cachedTokens,
        cacheHitRate: CacheHitRate(acc),
        providers: CountProviders(slices, directory),
        lastSeenAt: acc.lastSeenAt
    };
}

interface ModelAggregate {
    displayModel: string;
    slices: UsageSlice[];
    totalRequests: number;
    totalTokens: number;
}

/** Merge the alias and bare spellings of every model in the window, busiest first. */
function ModelAggregates(slices: UsageSlice[]): ModelAggregate[] {
    const Result = new Map<string, ModelAggregate>();
    for (const slice of slices) {
        const key = slice.bare.toLowerCase();
        const existing = Result.get(key);
        if (existing) {
            existing.slices.push(slice);
            existing.totalRequests += slice.acc.requests;
            existing.totalTokens += slice.acc.totalTokens;
        } else {
            Result.set(key, {
                displayModel: slice.displayModel,
                slices: [slice],
                totalRequests: slice.acc.requests,
                totalTokens: slice.acc.totalTokens
            });
        }
    }
    return [...Result.values()].sort(
        (a, b) => b.totalTokens - a.totalTokens || b.totalRequests - a.totalRequests
    );
}

/**
 * The ranked model stats for a window, capped at `limit`. Percentile SQL runs
 * only over the raw spellings that survive the cap — unbounded percentile
 * ranking is far more expensive than the volume that a leaderboard or a
 * top-models strip can display.
 */
async function RankedModelStats(
    window: MarketplaceAnalyticsWindow,
    slices: UsageSlice[],
    directory: EndpointDirectory,
    limit: number
): Promise<MarketplaceModelStat[]> {
    const top = ModelAggregates(slices).slice(0, limit);
    const models = RawSpellings(top.flatMap((agg) => agg.slices));
    const percentiles =
        models.length === 0
            ? new Map<string, { p50: number; p95: number }>()
            : await getMarketplaceLatencyPercentilesDB(WindowSpecFor(window).windowMs, models);
    return top.map((agg) => ModelStat(agg.displayModel, agg.slices, percentiles, directory));
}

async function EndpointStat(
    slices: UsageSlice[],
    directory: EndpointDirectory
): Promise<MarketplaceEndpointStat> {
    const acc = Empty();
    for (const slice of slices) Absorb(acc, slice.acc);
    const meta = directory.resolve(slices[0]!.providerId);
    return {
        providerId: meta.providerId,
        alias: meta.alias,
        displayName: meta.displayName,
        official: meta.official,
        totalRequests: acc.requests,
        totalErrors: acc.errors,
        successRate: SuccessRate(acc),
        avgLatencyMs: AvgLatencyMs(acc),
        throughputTokensPerSec: Throughput(acc),
        totalTokens: acc.totalTokens,
        completionTokens: acc.completionTokens,
        cachedTokens: acc.cachedTokens,
        cacheHitRate: CacheHitRate(acc),
        lastSeenAt: acc.lastSeenAt
    };
}

function GroupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
    const Result = new Map<string, T[]>();
    for (const item of items) {
        const k = key(item);
        const bucket = Result.get(k);
        if (bucket) bucket.push(item);
        else Result.set(k, [item]);
    }
    return Result;
}

function SumAll(slices: UsageSlice[]): Accumulator {
    const acc = Empty();
    for (const slice of slices) Absorb(acc, slice.acc);
    return acc;
}

// ── Time series ─────────────────────────────────────────────────────────

async function BuildSeries(
    window: MarketplaceAnalyticsWindow,
    include?: (rawModel: string) => boolean
): Promise<MarketplaceStatPoint[]> {
    const Spec = WindowSpecFor(window);
    const rows = await getMarketplaceTimeSeriesDB(Spec.windowMs, Spec.bucketSizeMs);

    const ByBucket = new Map<number, Accumulator>();
    for (const row of rows) {
        if (include && !include(row.model)) continue;
        const acc = ByBucket.get(row.bucket) ?? Empty();
        acc.requests += row.totalRequests;
        acc.errors += row.errorRequests;
        acc.promptTokens += row.promptTokens;
        acc.completionTokens += row.completionTokens;
        acc.cachedTokens += row.cachedTokens;
        acc.totalTokens += row.totalTokens;
        acc.latencySumMs += row.latencySumMs;
        ByBucket.set(row.bucket, acc);
    }

    // Zero-fill so the client can plot the window without guessing gaps.
    const Now = Date.now();
    const Start = Math.floor((Now - Spec.windowMs) / Spec.bucketSizeMs) * Spec.bucketSizeMs;
    const points: MarketplaceStatPoint[] = [];
    for (let i = 0; i < Spec.bucketCount; i++) {
        const ts = Start + i * Spec.bucketSizeMs;
        const acc = ByBucket.get(ts) ?? Empty();
        points.push({
            ts,
            requests: acc.requests,
            tokens: acc.totalTokens,
            successRate: SuccessRate(acc),
            avgLatencyMs: AvgLatencyMs(acc)
        });
    }
    return points;
}

// ── Public surface ──────────────────────────────────────────────────────

/**
 * GET /v1/analytics/models — token-volume leaderboard across the marketplace.
 * `limit` bounds the payload; ranking is by tokens, tie-broken by requests.
 */
export async function GetLeaderboard(
    window: MarketplaceAnalyticsWindow,
    limit: number
): Promise<MarketplaceLeaderboard> {
    const [slices, directory] = await Promise.all([ScanUsage(window), BuildEndpointDirectory()]);
    return {
        object: "marketplace.leaderboard",
        window,
        generatedAt: Date.now(),
        models: await RankedModelStats(window, slices, directory, limit)
    };
}

/**
 * GET /v1/analytics/models/:model — one model's public stats page: totals,
 * the endpoints that served it, and the window's time series. Returns null
 * when the model has no traffic in the window (the route answers 404).
 */
export async function GetModelStats(
    model: string,
    window: MarketplaceAnalyticsWindow
): Promise<MarketplaceModelStats | null> {
    const target = BareKey(model).toLowerCase();
    if (!target) return null;

    const [slices, directory] = await Promise.all([ScanUsage(window), BuildEndpointDirectory()]);
    const matching = slices.filter((s) => s.bare.toLowerCase() === target);
    if (matching.length === 0) return null;

    const models = RawSpellings(matching);
    const percentiles = await getMarketplaceLatencyPercentilesDB(
        WindowSpecFor(window).windowMs,
        models
    );

    const endpoints: MarketplaceEndpointStat[] = [];
    for (const [, group] of GroupBy(matching, (s) => s.providerId.toLowerCase())) {
        if (!directory.find(group[0]!.providerId)) continue;
        endpoints.push(await EndpointStat(group, directory));
    }
    endpoints.sort((a, b) => b.totalRequests - a.totalRequests);

    const series = await BuildSeries(window, (rawModel) => BareKey(rawModel).toLowerCase() === target);

    return {
        object: "marketplace.model.stats",
        model: matching[0]!.displayModel,
        window,
        generatedAt: Date.now(),
        total: ModelStat(matching[0]!.displayModel, matching, percentiles, directory),
        endpoints,
        series
    };
}

/**
 * GET /v1/analytics/endpoints — supply-side leaderboard: how every creator
 * storefront and platform driver actually performed.
 */
export async function GetEndpointStats(
    window: MarketplaceAnalyticsWindow
): Promise<MarketplaceProviderStats> {
    const [slices, directory] = await Promise.all([ScanUsage(window), BuildEndpointDirectory()]);

    const providers: MarketplaceProviderStat[] = [];
    for (const [, group] of GroupBy(slices, (s) => s.providerId.toLowerCase())) {
        const slice = group[0]!;
        const known = directory.find(slice.providerId);
        // Unattributable rows (a failed bare marketplace attempt logs the model
        // name as its provider) are not a supply endpoint. OAuth platform
        // drivers have no storefront row at all, so "default" is their marker.
        if (!known) continue;
        const stat = await EndpointStat(group, directory);
        const models = new Set(group.map((s) => s.bare.toLowerCase()));
        providers.push({ ...stat, models: models.size });
    }
    providers.sort((a, b) => b.totalTokens - a.totalTokens || b.totalRequests - a.totalRequests);

    return {
        object: "marketplace.provider.stats",
        window,
        generatedAt: Date.now(),
        providers
    };
}

/**
 * GET /v1/analytics/overview — platform health at a glance, plus the top
 * models. Aggregate counters only: no user, key or spend data.
 */
export async function GetOverview(
    window: MarketplaceAnalyticsWindow,
    topModelLimit: number
): Promise<MarketplaceAnalyticsOverview> {
    const [slices, directory, globalP95LatencyMs, series] = await Promise.all([
        ScanUsage(window),
        BuildEndpointDirectory(),
        getMarketplaceGlobalP95DB(WindowSpecFor(window).windowMs),
        BuildSeries(window)
    ]);

    const total = SumAll(slices);
    const aggregates = ModelAggregates(slices);

    return {
        object: "marketplace.analytics.overview",
        window,
        generatedAt: Date.now(),
        totalRequests: total.requests,
        totalErrors: total.errors,
        successRate: SuccessRate(total),
        totalTokens: total.totalTokens,
        promptTokens: total.promptTokens,
        completionTokens: total.completionTokens,
        cachedTokens: total.cachedTokens,
        cacheHitRate: CacheHitRate(total),
        avgLatencyMs: AvgLatencyMs(total),
        p95LatencyMs: Round(globalP95LatencyMs),
        throughputTokensPerSec: Throughput(total),
        models: aggregates.length,
        endpoints: CountProviders(slices, directory),
        series,
        topModels: await RankedModelStats(window, slices, directory, topModelLimit)
    };
}
