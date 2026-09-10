import { Hono } from "hono";
import { getAllProvidersDB, listModelPricingDB } from "@srouter/db";
import type { ProviderConfig } from "@srouter/types";
import { isSeedProvider, providerBaseId } from "@srouter/constants";
import { getPricingForModel, getModelMetadata } from "@srouter/pricing";
import { IsOfficialProviderRow, SelectDisabledModelIds, SelectMarketplaceRows } from "@/logic/official.logic.js";
import { RuntimeAliasFor, StorefrontName } from "@/logic/providers.logic.js";
import { Ok } from "@/utils/response.js";

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

interface CatalogPricing {
    input: number;
    output: number;
    cached?: number;
    cache_creation?: number;
    reasoning?: number;
}

/** Admin override keyed to this exact (provider, model) wins; else static table. */
function ResolvePricing(
    overrides: Awaited<ReturnType<typeof listModelPricingDB>>,
    providerId: string,
    modelId: string
): { pricing: CatalogPricing; override: boolean } {
    const o = overrides.find((x) => x.providerId === providerId && x.model === modelId);
    if (o) {
        return {
            pricing: {
                input: o.input,
                output: o.output,
                cached: o.cached,
                cache_creation: o.cacheCreation,
                reasoning: o.reasoning
            },
            override: true
        };
    }
    const sp = getPricingForModel(providerId, modelId);
    return {
        pricing: {
            input: sp.input,
            output: sp.output,
            cached: sp.cached,
            cache_creation: sp.cache_creation,
            reasoning: sp.reasoning
        },
        override: false
    };
}

/**
 * Model→providers mapping.
 *
 * `GET /v1/catalog/models?model=gpt-4o` — every enabled offering that lists
 * this model (exact or slash-suffix match), merged with pricing.
 * `GET /v1/catalog/models` (no param) — the flat marketplace model list: one
 * entry per bare model id across all cards, with every offering, the cheapest
 * one highlighted, and models.dev metadata (description/context/modalities)
 * when the dataset knows the model. This powers the model-centric storefront.
 */
CatalogRouter.get("/catalog/models", async (c) => {
    const raw = (c.req.query("model") ?? "").trim();
    const pricingOverrides = await listModelPricingDB();

    if (!raw) {
        interface FlatOffer extends CatalogPricing {
            providerId: string;
            name: string;
            providerName: string;
            official: boolean;
            override: boolean;
        }
        const byModel = new Map<string, { id: string; offers: FlatOffer[] }>();

        for (const { row: p, official } of await MarketplaceCards()) {
            const rows = await EnabledListings(p, official);
            if (rows.length === 0) continue;
            const displayName = official
                ? p.name
                : await StorefrontName(p.ownerId, p.name);
            for (const mr of rows) {
                const bare = BareModelId(mr.modelId);
                const key = bare.toLowerCase();
                let entry = byModel.get(key);
                if (!entry) {
                    entry = { id: bare, offers: [] };
                    byModel.set(key, entry);
                }
                if (entry.offers.some((o) => o.providerId === p.providerId)) continue;
                const { pricing, override } = ResolvePricing(
                    pricingOverrides,
                    p.providerId,
                    mr.modelId
                );
                entry.offers.push({
                    providerId: p.providerId,
                    name: displayName,
                    providerName: p.name,
                    official,
                    ...pricing,
                    override
                });
            }
        }

        const models = [...byModel.values()]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((e) => {
                const cheapest = [...e.offers].sort(
                    (a, b) => a.input - b.input || a.output - b.output
                )[0];
                const meta = getModelMetadata(e.id);
                return {
                    id: e.id,
                    endpoints: e.offers.length,
                    offers: e.offers,
                    bestOffer: cheapest ?? null,
                    metadata: meta
                        ? {
                              name: meta.name,
                              description: meta.description ?? null,
                              family: meta.family ?? null,
                              context: meta.limit?.context ?? null,
                              output: meta.limit?.output ?? null,
                              modality: meta.modalities?.input ?? null,
                              reasoning: meta.reasoning ?? false,
                              toolCall: meta.tool_call ?? false,
                              released: meta.release_date ?? null
                          }
                        : null
                };
            });

        return Ok(c, { object: "catalog.models", total: models.length, models });
    }

    const target = BareModelId(raw).toLowerCase();
    const targetFull = raw.toLowerCase();

    const offerings: Array<{
        providerId: string;
        name: string;
        providerName: string;
        official: boolean;
        pricing: CatalogPricing;
        override: boolean;
    }> = [];

    const seen = new Set<string>();
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
        const { pricing, override } = ResolvePricing(
            pricingOverrides,
            p.providerId,
            firstModel.modelId
        );
        offerings.push({
            providerId: p.providerId,
            name: displayName,
            providerName: p.name,
            official,
            pricing,
            override
        });
    }

    return Ok(c, { model: raw, total: offerings.length, offerings });
});
