import { useQuery } from "@tanstack/react-query";
import { api, Api, ApiError } from "@/lib/api";
import type { ShellUserInfo } from "@/components/layout";
import type { MarketplaceAnalyticsWindow } from "@srouter/types";

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
