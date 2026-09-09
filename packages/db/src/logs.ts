import type {
    AnalyticsWindow,
    ModelUsageSummaryRow,
    RequestLogEntry,
    UsageByModelRow,
    UsageSummary
} from "@srouter/types";
import { db, isPostgres } from "./db.js";
import { generateId, num, optStr, str } from "./row-utils.js";

interface RequestLogRow {
    id: string;
    api_key_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    provider_id: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    status_code: number;
    latency_ms: number;
    cached_tokens: number;
    cache_creation_tokens: number;
    reasoning_tokens: number;
    estimated_cost: number;
    fallback_occurred: number;
    fallback_path: string | null;
    fallback_reason: string | null;
    resolved_model: string | null;
    created_at: number;
}

interface UsageSummaryRow {
    totalRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCachedTokens: number;
    totalCacheCreationTokens: number;
    totalReasoningTokens: number;
    totalEstimatedCost: number;
}

interface ModelUsageDBShape {
    model: string;
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    estimatedCost: number;
    lastUsedAt: number | null;
}

interface UsageByModelDBShape {
    model: string;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    estCost: number;
}

export async function logRequestDB(entry: Omit<RequestLogEntry, "id" | "createdAt">): Promise<RequestLogEntry> {
    const Id = generateId("log");
    const CreatedAt = Date.now();

    await db.prepare(`
        INSERT INTO request_logs (id, api_key_id, ip_address, user_agent, provider_id, model, prompt_tokens, completion_tokens, total_tokens, status_code, latency_ms, cached_tokens, cache_creation_tokens, reasoning_tokens, estimated_cost, fallback_occurred, fallback_path, fallback_reason, resolved_model, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        Id,
        entry.apiKeyId ?? null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        entry.providerId,
        entry.model,
        entry.promptTokens,
        entry.completionTokens,
        entry.totalTokens,
        entry.statusCode,
        entry.latencyMs,
        entry.cachedTokens ?? 0,
        entry.cacheCreationTokens ?? 0,
        entry.reasoningTokens ?? 0,
        entry.estimatedCost ?? 0,
        entry.fallbackOccurred ? 1 : 0,
        entry.fallbackPath ?? null,
        entry.fallbackReason ?? null,
        entry.resolvedModel ?? null,
        CreatedAt
    );

    return {
        id: Id,
        ...entry,
        createdAt: CreatedAt
    };
}

export async function getRecentLogsDB(limit = 50): Promise<RequestLogEntry[]> {
    const Rows = (await db
        .prepare("SELECT * FROM request_logs ORDER BY created_at DESC LIMIT ?")
        .all(limit)) as unknown as RequestLogRow[];
    return Rows.map(mapLogRow);
}

export async function getUsageSummaryDB(): Promise<UsageSummary> {
    const Result = (await db.prepare(`
        SELECT 
            COUNT(*) as "totalRequests",
            COALESCE(SUM(total_tokens), 0) as "totalTokens",
            COALESCE(SUM(prompt_tokens), 0) as "totalPromptTokens",
            COALESCE(SUM(completion_tokens), 0) as "totalCompletionTokens",
            COALESCE(SUM(cached_tokens), 0) as "totalCachedTokens",
            COALESCE(SUM(cache_creation_tokens), 0) as "totalCacheCreationTokens",
            COALESCE(SUM(reasoning_tokens), 0) as "totalReasoningTokens",
            COALESCE(SUM(estimated_cost), 0) as "totalEstimatedCost"
        FROM request_logs
    `).get()) as unknown as UsageSummaryRow | undefined;

    return {
        totalRequests: num(Result?.totalRequests),
        totalTokens: num(Result?.totalTokens),
        totalPromptTokens: num(Result?.totalPromptTokens),
        totalCompletionTokens: num(Result?.totalCompletionTokens),
        totalCachedTokens: num(Result?.totalCachedTokens),
        totalCacheCreationTokens: num(Result?.totalCacheCreationTokens),
        totalReasoningTokens: num(Result?.totalReasoningTokens),
        totalEstimatedCost: num(Result?.totalEstimatedCost),
        totalInputTokens: num(Result?.totalPromptTokens),
        totalOutputTokens: num(Result?.totalCompletionTokens)
    };
}

export async function getProviderUsageSummaryDB(providerId: string): Promise<UsageSummary> {
    const Result = (await db.prepare(`
        SELECT 
            COUNT(*) as "totalRequests",
            COALESCE(SUM(total_tokens), 0) as "totalTokens",
            COALESCE(SUM(prompt_tokens), 0) as "totalPromptTokens",
            COALESCE(SUM(completion_tokens), 0) as "totalCompletionTokens",
            COALESCE(SUM(cached_tokens), 0) as "totalCachedTokens",
            COALESCE(SUM(cache_creation_tokens), 0) as "totalCacheCreationTokens",
            COALESCE(SUM(reasoning_tokens), 0) as "totalReasoningTokens",
            COALESCE(SUM(estimated_cost), 0) as "totalEstimatedCost"
        FROM request_logs
        WHERE provider_id = ?
    `).get(providerId)) as unknown as UsageSummaryRow | undefined;

    return {
        totalRequests: num(Result?.totalRequests),
        totalTokens: num(Result?.totalTokens),
        totalPromptTokens: num(Result?.totalPromptTokens),
        totalCompletionTokens: num(Result?.totalCompletionTokens),
        totalCachedTokens: num(Result?.totalCachedTokens),
        totalCacheCreationTokens: num(Result?.totalCacheCreationTokens),
        totalReasoningTokens: num(Result?.totalReasoningTokens),
        totalEstimatedCost: num(Result?.totalEstimatedCost),
        totalInputTokens: num(Result?.totalPromptTokens),
        totalOutputTokens: num(Result?.totalCompletionTokens)
    };
}

export async function getProviderModelUsageDB(providerId: string): Promise<ModelUsageSummaryRow[]> {
    const Rows = (await db.prepare(`
        SELECT 
            model,
            COUNT(*) as "totalRequests",
            COALESCE(SUM(total_tokens), 0) as "totalTokens",
            COALESCE(SUM(prompt_tokens), 0) as "promptTokens",
            COALESCE(SUM(completion_tokens), 0) as "completionTokens",
            COALESCE(SUM(cached_tokens), 0) as "cachedTokens",
            COALESCE(SUM(estimated_cost), 0) as "estimatedCost",
            MAX(created_at) as "lastUsedAt"
        FROM request_logs
        WHERE provider_id = ?
        GROUP BY model
        ORDER BY "lastUsedAt" DESC
    `).all(providerId)) as unknown as ModelUsageDBShape[];

    return Rows.map((row) => ({
        model: row.model,
        totalRequests: row.totalRequests,
        totalTokens: row.totalTokens,
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        cachedTokens: row.cachedTokens,
        estimatedCost: row.estimatedCost,
        lastUsedAt: row.lastUsedAt
    }));
}

export async function getUsageByModelDB(): Promise<UsageByModelRow[]> {
    const Rows = (await db.prepare(`
        SELECT 
            model,
            COUNT(*) as "totalRequests",
            COALESCE(SUM(prompt_tokens), 0) as "totalInputTokens",
            COALESCE(SUM(completion_tokens), 0) as "totalOutputTokens",
            COALESCE(SUM(cached_tokens), 0) as "totalCachedTokens",
            COALESCE(SUM(estimated_cost), 0) as "estCost"
        FROM request_logs
        GROUP BY model
        ORDER BY "totalRequests" DESC
    `).all()) as unknown as UsageByModelDBShape[];

    return Rows.map((row) => ({
        model: row.model,
        totalRequests: num(row.totalRequests),
        totalInputTokens: num(row.totalInputTokens),
        totalOutputTokens: num(row.totalOutputTokens),
        totalCachedTokens: num(row.totalCachedTokens),
        estCost: num(row.estCost)
    }));
}

export async function deleteLogsByModelDB(model: string): Promise<void> {
    await db.prepare("DELETE FROM request_logs WHERE model = ?").run(model);
}

export async function deleteLogsByProviderDB(providerId: string): Promise<void> {
    await db.prepare("DELETE FROM request_logs WHERE provider_id = ?").run(providerId);
}

function mapLogRow(row: RequestLogRow): RequestLogEntry {
    return {
        id: str(row.id),
        apiKeyId: optStr(row.api_key_id),
        ipAddress: optStr(row.ip_address),
        userAgent: optStr(row.user_agent),
        providerId: str(row.provider_id),
        model: str(row.model),
        promptTokens: num(row.prompt_tokens),
        completionTokens: num(row.completion_tokens),
        totalTokens: num(row.total_tokens),
        statusCode: num(row.status_code),
        latencyMs: num(row.latency_ms),
        cachedTokens: num(row.cached_tokens),
        cacheCreationTokens: num(row.cache_creation_tokens),
        reasoningTokens: num(row.reasoning_tokens),
        estimatedCost: num(row.estimated_cost),
        fallbackOccurred: Boolean(row.fallback_occurred),
        fallbackPath: optStr(row.fallback_path),
        fallbackReason: optStr(row.fallback_reason),
        resolvedModel: optStr(row.resolved_model),
        createdAt: num(row.created_at)
    };
}

// --- Analytics ---

export interface AnalyticsDBResult {
    buckets: AnalyticsBucketRow[];
    topModels: AnalyticsTopModelRow[];
    topAgents: AnalyticsTopAgentRow[];
    providers: AnalyticsProviderRow[];
    p95LatencyMs: number;
    rps: number;
}

interface AnalyticsTopAgentRow {
    userAgent: string;
    totalRequests: number;
    totalTokens: number;
}

interface AnalyticsBucketRow {
    bucket: number;
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    avgLatencyMs: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
}

interface AnalyticsTopModelRow {
    model: string;
    totalRequests: number;
    totalTokens: number;
    estCost: number;
}

interface AnalyticsProviderRow {
    providerId: string;
    totalRequests: number;
}

export function getBucketSizeMs(window: AnalyticsWindow): number {
    switch (window) {
        case "1h":
            return 60_000;
        case "24h":
            return 3_600_000;
        case "7d":
            return 21_600_000;
        case "30d":
            return 86_400_000;
    }
}

export function getBucketCount(window: AnalyticsWindow): number {
    switch (window) {
        case "1h":
            return 60;
        case "24h":
            return 24;
        case "7d":
            return 28;
        case "30d":
            return 30;
    }
}

export async function getAnalyticsDB(window: AnalyticsWindow): Promise<AnalyticsDBResult> {
    const Now = Date.now();
    const BucketSizeMs = getBucketSizeMs(window);
    const Since = Now - BucketSizeMs * getBucketCount(window);

    // Time buckets. SQLite binds numbers as REAL; CAST truncates to bucket start.
    // Postgres uses BIGINT timestamps, so division is integer-safe.
    // Use BIGINT cast for the bucket calculation — the multiplication
    // (bucketIndex * bucketSize) easily exceeds INT (2.1B) for 24h+ windows.
    const BucketsSql = `
        SELECT
            CAST(created_at / ? AS BIGINT) * ? AS "bucket",
            COUNT(*)                                             AS "totalRequests",
            SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) AS "successRequests",
            SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)  AS "errorRequests",
            AVG(latency_ms)                                      AS "avgLatencyMs",
            SUM(total_tokens)                                    AS "totalTokens",
            SUM(prompt_tokens)                                   AS "promptTokens",
            SUM(completion_tokens)                               AS "completionTokens",
            SUM(cached_tokens)                                   AS "cachedTokens"
        FROM request_logs
        WHERE created_at >= ?
        GROUP BY "bucket" ORDER BY "bucket" ASC
    `;
    const Buckets = (await db.prepare(BucketsSql).all(BucketSizeMs, BucketSizeMs, Since)) as unknown as AnalyticsBucketRow[];

    const ModelsSql = `
        SELECT model, COUNT(*) AS "totalRequests", SUM(total_tokens) AS "totalTokens",
               SUM(estimated_cost) AS "estCost"
        FROM request_logs WHERE created_at >= ?
        GROUP BY model ORDER BY "totalRequests" DESC LIMIT 10
    `;
    const TopModels = (await db.prepare(ModelsSql).all(Since)) as unknown as AnalyticsTopModelRow[];

    const AgentSql = `
        SELECT COALESCE(user_agent, 'Unknown') AS "userAgent", COUNT(*) AS "totalRequests",
               SUM(total_tokens) AS "totalTokens"
        FROM request_logs WHERE created_at >= ?
        GROUP BY "userAgent" ORDER BY "totalRequests" DESC LIMIT 10
    `;
    const TopAgents = (await db.prepare(AgentSql).all(Since)) as unknown as AnalyticsTopAgentRow[];

    const ProviderSql = `
        SELECT provider_id AS "providerId", COUNT(*) AS "totalRequests"
        FROM request_logs WHERE created_at >= ?
        GROUP BY "providerId" ORDER BY "totalRequests" DESC
    `;
    const Providers = (await db.prepare(ProviderSql).all(Since)) as unknown as AnalyticsProviderRow[];

    // p95 latency. COUNT(*) is BIGINT; scale to INT only when the result
    // is guaranteed small (we cap at the table size). Use BIGINT to be safe.
    const P95Sql = `SELECT latency_ms FROM request_logs
           WHERE created_at >= ?
           ORDER BY latency_ms
           LIMIT 1 OFFSET (SELECT CAST(COUNT(*) * 0.95 AS BIGINT) - 1 FROM request_logs WHERE created_at >= ?)`;
    const P95Row = (await db.prepare(P95Sql).get(Since, Since)) as { latency_ms: number } | undefined;
    const P95LatencyMs = P95Row ? num(P95Row.latency_ms) : 0;

    // RPS (last 60s rolling average)
    const RpsSql = `SELECT COUNT(*) AS count FROM request_logs WHERE created_at >= ?`;
    const RpsRow = (await db.prepare(RpsSql).get(Now - 60_000)) as { count: number } | undefined;
    const Rps = RpsRow ? Math.round((num(RpsRow.count) / 60) * 100) / 100 : 0;

    return {
        buckets: Buckets,
        topModels: TopModels,
        topAgents: TopAgents,
        providers: Providers,
        p95LatencyMs: P95LatencyMs,
        rps: Rps
    };
}

// --- Marketplace routing quality ---

export interface ProviderQualityStats {
    samples: number;
    successes: number;
    successRate: number;
    avgLatencyMs: number;
}

interface QualityLogRow {
    provider_id: string;
    model: string;
    status_code: number;
    latency_ms: number;
}

/**
 * Aggregate recent request quality per provider for a bare marketplace model.
 * request_logs stores the model as it was sent — either the bare name or the
 * "alias/bare" form produced by a marketplace rewrite — so the match is done
 * by suffix in JS rather than in SQL. Keys are lowercased provider ids, which
 * line up with the providers.id / provider_id / alias lookups the router does.
 */
export async function getMarketplaceQualityDB(
    bareModel: string,
    windowMs = 86_400_000
): Promise<Map<string, ProviderQualityStats>> {
    const Target = bareModel.toLowerCase();
    const Since = Date.now() - windowMs;
    const Rows = (await db
        .prepare(`
            SELECT provider_id, model, status_code, latency_ms
            FROM request_logs
            WHERE created_at >= ?
            ORDER BY created_at DESC
            LIMIT 10000
        `)
        .all(Since)) as unknown as QualityLogRow[];

    const Acc = new Map<string, { samples: number; successes: number; latency: number }>();
    for (const row of Rows) {
        const model = str(row.model).toLowerCase();
        if (model !== Target && !model.endsWith(`/${Target}`)) continue;
        const Key = str(row.provider_id).toLowerCase();
        const entry = Acc.get(Key) ?? { samples: 0, successes: 0, latency: 0 };
        entry.samples += 1;
        const status = num(row.status_code);
        if (status >= 200 && status < 300) entry.successes += 1;
        entry.latency += num(row.latency_ms);
        Acc.set(Key, entry);
    }

    const Result = new Map<string, ProviderQualityStats>();
    for (const [key, entry] of Acc) {
        Result.set(key, {
            samples: entry.samples,
            successes: entry.successes,
            successRate: entry.samples > 0 ? entry.successes / entry.samples : 0,
            avgLatencyMs: entry.samples > 0 ? entry.latency / entry.samples : 0
        });
    }
    return Result;
}

// --- Public marketplace analytics (aggregate-only, OpenRouter-style) ---
//
// All queries below read request_logs only. The shapes deliberately exclude
// every caller-identifying column (api_key_id, ip_address, user_agent) so the
// API layer cannot leak them into unauthenticated responses.

/** Numeric aggregate columns shared between model-provider and bucket rows. */
interface MarketplaceCounters {
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    totalTokens: number;
    latencySumMs: number;
}

interface MarketplaceModelProviderAggregateRow extends MarketplaceCounters {
    model: string;
    providerId: string;
    lastSeenAt: number;
}

interface MarketplaceBucketAggregateRow extends MarketplaceCounters {
    bucket: number;
    model: string;
}

const MARKETPLACE_SUCCESS = `SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)`;
const MARKETPLACE_ERRORS = `SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)`;

/** Raw aggregate shape: Postgres returns COUNT/SUM/MAX over bigint as strings. */
interface MarketplaceAggregateShape {
    totalRequests: unknown;
    successRequests: unknown;
    errorRequests: unknown;
    promptTokens: unknown;
    completionTokens: unknown;
    cachedTokens: unknown;
    totalTokens: unknown;
    latencySumMs: unknown;
}

function MapMarketplaceCounts(Row: MarketplaceAggregateShape): MarketplaceCounters {
    return {
        totalRequests: num(Row.totalRequests),
        successRequests: num(Row.successRequests),
        errorRequests: num(Row.errorRequests),
        promptTokens: num(Row.promptTokens),
        completionTokens: num(Row.completionTokens),
        cachedTokens: num(Row.cachedTokens),
        totalTokens: num(Row.totalTokens),
        latencySumMs: num(Row.latencySumMs)
    };
}

export async function getMarketplaceModelProviderStatsDB(
    windowMs: number
): Promise<MarketplaceModelProviderAggregateRow[]> {
    const Rows = (await db
        .prepare(
            `SELECT
                model                                           AS "model",
                provider_id                                     AS "providerId",
                COUNT(*)                                        AS "totalRequests",
                ${MARKETPLACE_SUCCESS}                          AS "successRequests",
                ${MARKETPLACE_ERRORS}                           AS "errorRequests",
                COALESCE(SUM(prompt_tokens), 0)                 AS "promptTokens",
                COALESCE(SUM(completion_tokens), 0)             AS "completionTokens",
                COALESCE(SUM(cached_tokens), 0)                 AS "cachedTokens",
                COALESCE(SUM(total_tokens), 0)                  AS "totalTokens",
                COALESCE(SUM(latency_ms), 0)                    AS "latencySumMs",
                MAX(created_at)                                 AS "lastSeenAt"
            FROM request_logs
            WHERE created_at >= ?
            GROUP BY model, provider_id
            ORDER BY "totalRequests" DESC`
        )
        .all(Date.now() - windowMs)) as unknown as Array<
        MarketplaceAggregateShape & { model: unknown; providerId: unknown; lastSeenAt: unknown }
    >;
    return Rows.map((Row) => ({
        model: str(Row.model),
        providerId: str(Row.providerId),
        ...MapMarketplaceCounts(Row),
        lastSeenAt: num(Row.lastSeenAt)
    }));
}

export async function getMarketplaceTimeSeriesDB(
    windowMs: number,
    bucketSizeMs: number
): Promise<MarketplaceBucketAggregateRow[]> {
    const Rows = (await db
        .prepare(
            `SELECT
                CAST(created_at / ? AS BIGINT) * ?              AS "bucket",
                model                                           AS "model",
                COUNT(*)                                        AS "totalRequests",
                ${MARKETPLACE_SUCCESS}                          AS "successRequests",
                ${MARKETPLACE_ERRORS}                           AS "errorRequests",
                COALESCE(SUM(prompt_tokens), 0)                 AS "promptTokens",
                COALESCE(SUM(completion_tokens), 0)             AS "completionTokens",
                COALESCE(SUM(cached_tokens), 0)                 AS "cachedTokens",
                COALESCE(SUM(total_tokens), 0)                  AS "totalTokens",
                COALESCE(SUM(latency_ms), 0)                    AS "latencySumMs"
            FROM request_logs
            WHERE created_at >= ?
            GROUP BY "bucket", model
            ORDER BY "bucket" ASC`
        )
        .all(bucketSizeMs, bucketSizeMs, Date.now() - windowMs)) as unknown as Array<
        MarketplaceAggregateShape & { bucket: unknown; model: unknown }
    >;
    return Rows.map((Row) => ({
        bucket: num(Row.bucket),
        model: str(Row.model),
        ...MapMarketplaceCounts(Row)
    }));
}

/**
 * p50/p95 latency per raw logged model string via a windowed scan.
 *
 * Keys are the raw model strings from request_logs (bare or "alias/bare");
 * the API layer merges them per bare marketplace model. `models` restricts the
 * scan to the spellings that are actually being displayed — ranking latencies
 * for every model in the window costs a full sort, so callers pass the handful
 * of rows a leaderboard page needs.
 */
export async function getMarketplaceLatencyPercentilesDB(
    windowMs: number,
    models: string[]
): Promise<Map<string, { p50: number; p95: number }>> {
    const Result = new Map<string, { p50: number; p95: number }>();
    if (models.length === 0) return Result;

    const Placeholders = models.map(() => "?").join(", ");
    const Rows = (await db
        .prepare(
            `WITH ranked AS (
                SELECT
                    model,
                    latency_ms,
                    ROW_NUMBER() OVER (PARTITION BY model ORDER BY latency_ms) AS rn,
                    COUNT(*)    OVER (PARTITION BY model)                      AS cnt
                FROM request_logs
                WHERE created_at >= ? AND model IN (${Placeholders})
            )
            SELECT model, latency_ms,
                   CAST((cnt * 50 + 99) / 100 AS INTEGER) AS p50rn,
                   CAST((cnt * 95 + 99) / 100 AS INTEGER) AS p95rn,
                   rn
            FROM ranked
            WHERE rn IN (CAST((cnt * 50 + 99) / 100 AS INTEGER),
                         CAST((cnt * 95 + 99) / 100 AS INTEGER))`
        )
        .all(Date.now() - windowMs, ...models)) as unknown as Array<{
        model: string;
        latency_ms: number;
        p50rn: number;
        p95rn: number;
        rn: number;
    }>;

    for (const row of Rows) {
        const Key = str(row.model);
        const entry = Result.get(Key) ?? { p50: 0, p95: 0 };
        const Latency = num(row.latency_ms);
        if (num(row.rn) === num(row.p95rn)) entry.p95 = Latency;
        if (num(row.rn) === num(row.p50rn)) entry.p50 = Latency;
        Result.set(Key, entry);
    }
    return Result;
}

/**
 * Platform-wide p95 latency over the window (single value, no grouping).
 */
export async function getMarketplaceGlobalP95DB(windowMs: number): Promise<number> {
    const Row = (await db
        .prepare(
            `WITH ranked AS (
                SELECT
                    latency_ms,
                    ROW_NUMBER() OVER (ORDER BY latency_ms) AS rn,
                    COUNT(*)    OVER ()                     AS cnt
                FROM request_logs
                WHERE created_at >= ?
            )
            SELECT latency_ms FROM ranked
            WHERE rn = CAST((cnt * 95 + 99) / 100 AS INTEGER)`
        )
        .get(Date.now() - windowMs)) as unknown as
        | { latency_ms: number }
        | undefined;
    return Row ? num(Row.latency_ms) : 0;
}