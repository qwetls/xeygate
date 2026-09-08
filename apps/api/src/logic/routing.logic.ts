import {
    getAllProvidersDB,
    getMarketplaceQualityDB,
    type ProviderQualityStats
} from "@srouter/db";
import { isSeedProvider, providerAlias, providerBaseId } from "@srouter/constants";
import { registry } from "@/services/registry.js";
import {
    IsOfficialProviderRow,
    SelectMarketplaceRows,
    type MarketplaceScope
} from "@/logic/official.logic.js";

// Quality window and scoring knobs. Weights favor success rate over latency;
// providers without enough recent samples score neutral so new listings still
// receive traffic (exploration) instead of being starved.
const QUALITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_SAMPLES = 5;
const SUCCESS_WEIGHT = 0.7;
const LATENCY_REF_MS = 30_000;
const NEUTRAL_SCORE = 0.6;
// Primary pick weights never fall below this fraction of the best score, so
// weaker-but-working listings keep a share of traffic (weighted exploration).
const FLOOR_RATIO = 0.15;
// Providers below this observed success rate (with enough samples) are kept
// out of the primary lottery; they remain reachable via the failover tail.
const MIN_SUCCESS_RATE = 0.5;

const ROUTE_CACHE_TTL_MS = 30_000;
const routeCache = new Map<string, { expires: number; chain: string[] | null }>();

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

/**
 * Quality score in [0,1] for one provider from windowed request stats.
 * Unknown / low-sample providers get a neutral score.
 */
export function ComputeQualityScore(stats?: ProviderQualityStats): number {
    if (!stats || stats.samples < MIN_SAMPLES) return NEUTRAL_SCORE;
    const latencyScore = clamp01(1 - stats.avgLatencyMs / LATENCY_REF_MS);
    return clamp01(stats.successRate * SUCCESS_WEIGHT + latencyScore * (1 - SUCCESS_WEIGHT));
}

export interface ScoredMarketplaceCandidate {
    fullId: string;
    score: number;
    successRate: number;
    samples: number;
    healthy: boolean;
}

/**
 * Order a marketplace chain: a weighted-random primary among the healthy
 * pool (weight = score with a floor relative to the best score), then the
 * remaining candidates sorted by score descending as the mandatory failover
 * tail. Fully deterministic given `random`.
 */
export function BuildMarketplaceChain(
    candidates: ScoredMarketplaceCandidate[],
    random: () => number = Math.random
): string[] {
    if (candidates.length === 0) return [];

    let pool = candidates.filter(
        (c) => c.healthy && (c.successRate >= MIN_SUCCESS_RATE || c.samples < MIN_SAMPLES)
    );
    if (pool.length === 0) pool = candidates;

    const maxScore = Math.max(...pool.map((c) => c.score));
    const weights = pool.map((c) => Math.max(c.score, maxScore * FLOOR_RATIO));

    let pick = 0;
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total > 0) {
        let cursor = random() * total;
        for (let i = 0; i < weights.length; i += 1) {
            cursor -= weights[i]!;
            if (cursor <= 0) {
                pick = i;
                break;
            }
        }
    }

    const primary = pool[pick]!;
    const tail = candidates
        .filter((c) => c !== primary)
        .sort((a, b) => b.score - a.score)
        .map((c) => c.fullId);
    return [primary.fullId, ...tail];
}

/**
 * Resolve a bare marketplace model ("gpt-4o") to an ordered chain of full
 * candidate ids ("creatorAlias/gpt-4o") within one marketplace namespace.
 * Scope selects the key space: "user" routes only creator-owned connections,
 * "official" only platform-owned ones, "all" (default, backward-compatible
 * /v1) both. Returns null when the model is not bare, has no marketplace
 * listings, or nothing is currently registered — the caller then falls back
 * to existing candidate resolution (including its 404 path). Results are
 * cached briefly to keep the hot path cheap.
 */
export async function ResolveMarketplaceRoute(
    model: string,
    scope: MarketplaceScope = "all"
): Promise<string[] | null> {
    if (model.includes("/")) return null;

    const Bare = model.toLowerCase();
    const CacheKey = `${scope}:${Bare}`;
    const cached = routeCache.get(CacheKey);
    if (cached && Date.now() < cached.expires) return cached.chain;

    const [providers, quality] = await Promise.all([
        getAllProvidersDB(),
        getMarketplaceQualityDB(Bare, QUALITY_WINDOW_MS)
    ]);

    const enabled = providers.filter((p) => p.enabled && !isSeedProvider(p));
    const scored: ScoredMarketplaceCandidate[] = [];

    for (const provider of enabled) {
        if (!registry.getProvider(provider.id)) continue;
        const isOfficial = await IsOfficialProviderRow(provider);
        if (scope === "official" && !isOfficial) continue;
        if (scope === "user" && isOfficial) continue;

        // Official listings live under the shared base id and are inherited
        // by every official connection of that driver; creator listings stay
        // connection-scoped, so the two key spaces never cross.
        const rows = await SelectMarketplaceRows(provider, isOfficial);
        for (const row of rows) {
            if (row.modelId.toLowerCase() !== Bare) continue;

            const stats =
                quality.get(provider.id.toLowerCase()) ??
                quality.get(provider.providerId.toLowerCase()) ??
                (provider.alias ? quality.get(provider.alias.toLowerCase()) : undefined);
            const health = registry.getCircuitBreaker().getHealth(provider.id);

            scored.push({
                fullId: `${provider.alias || providerAlias(providerBaseId(provider.id))}/${row.modelId}`,
                score: ComputeQualityScore(stats),
                successRate: stats?.successRate ?? 0,
                samples: stats?.samples ?? 0,
                healthy: health.state === "healthy"
            });
        }
    }

    const chain = scored.length > 0 ? BuildMarketplaceChain(scored) : null;
    routeCache.set(CacheKey, { expires: Date.now() + ROUTE_CACHE_TTL_MS, chain });
    return chain;
}
