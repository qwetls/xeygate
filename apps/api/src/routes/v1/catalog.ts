import { Hono } from "hono";
import { getAllProvidersDB, listModelPricingDB } from "@srouter/db";
import type { ProviderConfig } from "@srouter/types";
import { isSeedProvider, providerBaseId } from "@srouter/constants";
import { getPricingForModel } from "@srouter/pricing";
import { IsOfficialProviderRow, SelectDisabledModelIds, SelectMarketplaceRows } from "@/logic/official.logic.js";
import { RuntimeAliasFor, StorefrontName } from "@/logic/providers.logic.js";
import { Err, Ok } from "@/utils/response.js";

export const CatalogRouter = new Hono();

interface CatalogItem {
    providerId: string;
    name: string;
    providerName: string;
    protocol: string | null;
    category: string | null;
    ownerId: string | null;
    official: boolean;
    models: Array<{
        id: string;
        fullId: string;
        pricing: { input: number; output: number; cached?: number; cache_creation?: number; reasoning?: number };
        override: boolean;
    }>;
}

function BareModelId(modelWithPrefix: string): string {
    const slash = modelWithPrefix.indexOf("/");
    return slash >= 0 ? modelWithPrefix.slice(slash + 1) : modelWithPrefix;
}

/**
 * Storefront listings for one card, minus the models the platform disabled.
 * The denylist consults both the connection key and the shared base id so a
 * platform-wide rule always hides the model regardless of which scope it was
 * written at.
 */
async function EnabledListings(
    p: ProviderConfig,
    official: boolean
): Promise<Awaited<ReturnType<typeof SelectMarketplaceRows>>> {
    const [rows, disabled] = await Promise.all([
        SelectMarketplaceRows(p, official),
        SelectDisabledModelIds(p)
    ]);
    if (disabled.size === 0) return rows;
    return rows.filter((r) => !disabled.has(r.modelId.toLowerCase()));
}

/**
 * Every enabled non-seed connection, deduplicated for official supply:
 * multiple connections of one driver share the same base-id catalog, so the
 * storefront merges them into a single card per driver.  Creator connections
 * each keep their own card (they own their rows individually).
 */
async function MarketplaceCards(): Promise<
    { row: ProviderConfig; official: boolean }[]
> {
    const all = (await getAllProvidersDB()).filter(
        (p) => p.enabled && !isSeedProvider(p)
    );
    const flags = await Promise.all(
        all.map(async (p) => ({ p, official: await IsOfficialProviderRow(p) }))
    );

    const officialByBase = new Map<string, { row: ProviderConfig; official: boolean }>();
    const cards: { row: ProviderConfig; official: boolean }[] = [];

    for (const { p, official } of flags) {
        if (!official) {
            cards.push({ row: p, official: false });
            continue;
        }
        const base = providerBaseId(
            (p.providerId || p.id).toLowerCase()
        );
        if (!officialByBase.has(base)) {
            officialByBase.set(base, { row: p, official: true });
        }
    }
    cards.unshift(...officialByBase.values());
    return cards;
}

// GET /v1/catalog — public (no auth). Lists all enabled providers with their
// available models and merged pricing (admin override wins, else static).
CatalogRouter.get("/catalog", async (c) => {
    const pricingOverrides = await listModelPricingDB();

    const cards = await MarketplaceCards();
    const items: CatalogItem[] = await Promise.all(
        cards.map(async ({ row: p, official }) => {
            const customModels = await EnabledListings(p, official);
            const alias = RuntimeAliasFor((p.providerId || p.id).toLowerCase());
            const models = customModels.map((mr) => {
                const modelId = mr.modelId;
                const override = pricingOverrides.find(
                    (o) => o.providerId === p.providerId && o.model === modelId
                );
                if (override) {
                    return {
                        id: modelId,
                        fullId: `${alias}/${modelId}`,
                        pricing: {
                            input: override.input,
                            output: override.output,
                            cached: override.cached,
                            cache_creation: override.cacheCreation,
                            reasoning: override.reasoning,
                        },
                        override: true,
                    };
                }
                const staticPrice = getPricingForModel(p.providerId, modelId);
                return {
                    id: modelId,
                    fullId: `${alias}/${modelId}`,
                    pricing: {
                        input: staticPrice.input,
                        output: staticPrice.output,
                        cached: staticPrice.cached,
                        cache_creation: staticPrice.cache_creation,
                        reasoning: staticPrice.reasoning,
                    },
                    override: false,
                };
            });
            return {
                providerId: p.providerId,
                name: official
                    ? p.name
                    : await StorefrontName(p.ownerId, p.name),
                providerName: p.name,
                protocol: (p.protocol as unknown as string) ?? null,
                category: (p.category as unknown as string) ?? null,
                ownerId: p.ownerId ?? null,
                official,
                models,
            };
        })
    );

    return Ok(c, { providers: items, total: items.length });
});

// GET /v1/catalog/models?model=gpt-4o — model→providers mapping.
// Bare `model` (no provider prefix). Returns every enabled offering that lists
// this model (exact or slash-suffix match), merged with pricing.
CatalogRouter.get("/catalog/models", async (c) => {
    const raw = (c.req.query("model") ?? "").trim();
    if (!raw) return Err(c, "query param 'model' is required", 400);
    const target = BareModelId(raw).toLowerCase();
    const targetFull = raw.toLowerCase();

    const pricingOverrides = await listModelPricingDB();
    const seen = new Set<string>();

    const offerings: Array<{
        providerId: string;
        name: string;
        providerName: string;
        official: boolean;
        pricing: { input: number; output: number; cached?: number; cache_creation?: number; reasoning?: number };
        override: boolean;
    }> = [];

    for (const { row: p, official } of await MarketplaceCards()) {
        if (seen.has(p.providerId)) continue;
        const rows = await EnabledListings(p, official);
        const firstModel = rows.find((mr) => {
            const bare = BareModelId(mr.modelId).toLowerCase();
            return bare === target || mr.modelId.toLowerCase() === targetFull;
        });
        if (!firstModel) continue;
        seen.add(p.providerId);
        const displayName = official
            ? p.name
            : await StorefrontName(p.ownerId, p.name);
        const override = pricingOverrides.find(
            (o) => o.providerId === p.providerId && o.model === firstModel.modelId
        );
        if (override) {
            offerings.push({
                providerId: p.providerId,
                name: displayName,
                providerName: p.name,
                official,
                pricing: {
                    input: override.input,
                    output: override.output,
                    cached: override.cached,
                    cache_creation: override.cacheCreation,
                    reasoning: override.reasoning,
                },
                override: true,
            });
        } else {
            const sp = getPricingForModel(p.providerId, firstModel.modelId);
            offerings.push({
                providerId: p.providerId,
                name: displayName,
                providerName: p.name,
                official,
                pricing: {
                    input: sp.input,
                    output: sp.output,
                    cached: sp.cached,
                    cache_creation: sp.cache_creation,
                    reasoning: sp.reasoning,
                },
                override: false,
            });
        }
    }

    return Ok(c, { model: raw, total: offerings.length, offerings });
});
