import type {
    AnalyticsReport,
    AnalyticsWindow,
    MarketplaceAnalyticsOverview,
    MarketplaceAnalyticsWindow,
    MarketplaceLeaderboard,
    MarketplaceModelStats,
    MarketplaceProviderStats
} from "@srouter/types";

export interface CatalogFlatOffer {
    providerId: string;
    name: string;
    providerName: string;
    official: boolean;
    input: number;
    output: number;
    cached?: number;
    cache_creation?: number;
    reasoning?: number;
    override: boolean;
}

export interface CatalogModelMetadata {
    name: string;
    description: string | null;
    family: string | null;
    context: number | null;
    output: number | null;
    modality: string[] | null;
    reasoning: boolean;
    toolCall: boolean;
    released: string | null;
}

export interface CatalogFlatModel {
    id: string;
    endpoints: number;
    offers: CatalogFlatOffer[];
    bestOffer: CatalogFlatOffer | null;
    metadata: CatalogModelMetadata | null;
}

export interface CatalogFlatModelsResponse {
    object: "catalog.models";
    total: number;
    models: CatalogFlatModel[];
}

export interface CatalogModelOffering {
    providerId: string;
    name: string;
    providerName: string;
    official: boolean;
    pricing: { input: number; output: number; cached?: number; cache_creation?: number; reasoning?: number };
    override: boolean;
}

export interface CatalogModelDetailResponse {
    model: string;
    total: number;
    offerings: CatalogModelOffering[];
}

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...init
    });

    if (!res.ok) {
        let message = res.statusText;
        try {
            const body = (await res.json()) as { error?: { message?: string } | string };
            message =
                typeof body.error === "string" ? body.error : (body.error?.message ?? message);
        } catch {
            // ignore body parse errors
        }
        throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

export const api = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: "POST",
            body: body === undefined ? undefined : JSON.stringify(body)
        }),
    patch: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: "PATCH",
            body: body === undefined ? undefined : JSON.stringify(body)
        }),
    put: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: "PUT",
            body: body === undefined ? undefined : JSON.stringify(body)
        }),
    delete: <T>(path: string) =>
        request<T>(path, {
            method: "DELETE"
        })
};

/**
 * Resolves the Gateway Base URL for client requests (OpenAI/Anthropic SDKs, curl, etc.).
 * - Honors `VITE_API_BASE_URL` or `VITE_API_URL` environment variables if set.
 * - In dev mode (e.g. Vite running on port 5173/5174), points to the backend server (default port 3000).
 * - In production, resolves relative to window.location.origin.
 */
export function getGatewayBaseUrl(): string {
    if (import.meta.env.VITE_API_BASE_URL) {
        return (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "");
    }
    if (import.meta.env.VITE_API_URL) {
        const base = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
        return base.endsWith("/v1") ? base : `${base}/v1`;
    }

    if (typeof window !== "undefined") {
        const { hostname, protocol, port, origin } = window.location;

        // In Vite dev mode (e.g. Vite dev server on port 5173/5174), target the backend API server port
        if (import.meta.env.DEV || port === "5173" || port === "5174") {
            const backendPort = (import.meta.env.VITE_BACKEND_PORT as string) || "3000";
            return `${protocol}//${hostname}:${backendPort}/v1`;
        }

        return `${origin}/v1`;
    }

    return "http://localhost:3000/v1";
}

export const Api = {
    getAnalytics: (window: AnalyticsWindow): Promise<AnalyticsReport> =>
        api.get<AnalyticsReport>(`/v1/logs/analytics?window=${window}`),

    // Marketplace-wide aggregates. Unauthenticated by design (see AGENTS.md),
    // so the client portal can show them without an admin session.
    getMarketplaceOverview: (
        window: MarketplaceAnalyticsWindow,
        limit = 10
    ): Promise<MarketplaceAnalyticsOverview> =>
        api.get<MarketplaceAnalyticsOverview>(
            `/v1/analytics/overview?window=${window}&limit=${limit}`
        ),
    getMarketplaceModels: (
        window: MarketplaceAnalyticsWindow,
        limit = 25
    ): Promise<MarketplaceLeaderboard> =>
        api.get<MarketplaceLeaderboard>(
            `/v1/analytics/models?window=${window}&limit=${limit}`
        ),
    getMarketplaceEndpoints: (
        window: MarketplaceAnalyticsWindow
    ): Promise<MarketplaceProviderStats> =>
        api.get<MarketplaceProviderStats>(`/v1/analytics/endpoints?window=${window}`),
    getMarketplaceModelStats: (
        model: string,
        window: MarketplaceAnalyticsWindow
    ): Promise<MarketplaceModelStats> =>
        api.get<MarketplaceModelStats>(
            `/v1/analytics/models/${encodeURIComponent(model)}?window=${window}`
        ),

    // Public model-centric catalog (no auth). Flat list aggregates every
    // enabled offering per bare model id; the detail call lists all providers
    // serving one model with merged pricing.
    getCatalogModels: (): Promise<CatalogFlatModelsResponse> =>
        api.get<CatalogFlatModelsResponse>("/v1/catalog/models"),
    getCatalogModelOfferings: (
        model: string
    ): Promise<CatalogModelDetailResponse> =>
        api.get<CatalogModelDetailResponse>(
            `/v1/catalog/models?model=${encodeURIComponent(model)}`
        )
};
