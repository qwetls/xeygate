import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, Api, ApiError } from "@/lib/api";
import type { ShellUserInfo } from "@/components/layout";
import type { MarketplaceAnalyticsWindow, MarketplaceHealthEntry } from "@srouter/types";

// Public (unauthenticated) model-centric storefront data. Keyed separately
// from the admin catalog hook so the two surfaces never share cache entries.

export function useCatalogModels() {
    return useQuery({
        queryKey: ["public-catalog-models"],
        queryFn: () => Api.getCatalogModels(),
        staleTime: 5 * 60_000
    });
}

export function useCatalogModel(model: string | undefined) {
    return useQuery({
        queryKey: ["public-catalog-model", model],
        queryFn: () => Api.getCatalogModelOfferings(model!),
        enabled: Boolean(model),
        staleTime: 5 * 60_000
    });
}

/**
 * Traffic for one model. A quiet model is not an error: the API answers 404
 * `no_traffic`, which surfaces here as a null data result.
 */
export function useMarketplaceModelStats(model: string | undefined, window: MarketplaceAnalyticsWindow) {
    return useQuery({
        queryKey: ["marketplace-model-stats", model, window],
        queryFn: async () => {
            try {
                return await Api.getMarketplaceModelStats(model!, window);
            } catch (e) {
                if (e instanceof ApiError && e.status === 404) return null;
                throw e;
            }
        },
        enabled: Boolean(model),
        placeholderData: (prev) => prev,
        refetchInterval: 60_000
    });
}

/**
 * Per-model 7-day uptime stripes, keyed by bare model id. One fetch feeds the
 * strip on every marketplace card and detail page, so lookups are a Map
 * join — never a per-model request.
 */
export function useMarketplaceHealth() {
    const query = useQuery({
        queryKey: ["marketplace-health"],
        queryFn: () => Api.getMarketplaceHealth(),
        staleTime: 60_000,
        refetchInterval: 5 * 60_000
    });

    const byId = useMemo(() => {
        const map = new Map<string, MarketplaceHealthEntry>();
        for (const entry of query.data?.models ?? []) {
            map.set(entry.model.toLowerCase(), entry);
            // A prefixed listing id ("cx/gpt-6-astra") is also reachable under
            // its bare tail, the same tolerant matching the detail route uses.
            const slash = entry.model.lastIndexOf("/");
            if (slash >= 0) map.set(entry.model.slice(slash + 1).toLowerCase(), entry);
        }
        return map;
    }, [query.data]);

    return {
        ...query,
        find: (modelId: string | undefined): MarketplaceHealthEntry | undefined =>
            modelId ? byId.get(modelId.toLowerCase()) : undefined
    };
}

/**
 * The signed-in account, or null. Shares the cache entry the portal layouts
 * use ("user-auth-status"), so a marketplace page never fires a second session
 * probe and inherits their 60s freshness window instead of re-asking on every
 * navigation.
 */
export function useSessionUser(): { user: ShellUserInfo | null; isPending: boolean } {
    const query = useQuery({
        queryKey: ["user-auth-status"],
        queryFn: () => api.get<ShellUserInfo>("/v1/users/me"),
        retry: false,
        staleTime: 60_000
    });
    return { user: query.data ?? null, isPending: query.isPending };
}
