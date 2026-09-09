import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Api } from "@/lib/api";
import type { MarketplaceAnalyticsWindow } from "@srouter/types";

export function useMarketplaceOverview(window: MarketplaceAnalyticsWindow) {
    return useQuery({
        queryKey: ["marketplace-overview", window],
        queryFn: () => Api.getMarketplaceOverview(window),
        placeholderData: keepPreviousData,
        refetchInterval: 60_000
    });
}

export function useMarketplaceModels(window: MarketplaceAnalyticsWindow) {
    return useQuery({
        queryKey: ["marketplace-models", window],
        queryFn: () => Api.getMarketplaceModels(window),
        placeholderData: keepPreviousData,
        refetchInterval: 60_000
    });
}

export function useMarketplaceEndpoints(window: MarketplaceAnalyticsWindow) {
    return useQuery({
        queryKey: ["marketplace-endpoints", window],
        queryFn: () => Api.getMarketplaceEndpoints(window),
        placeholderData: keepPreviousData,
        refetchInterval: 60_000
    });
}
