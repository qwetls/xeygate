import { Hono } from "hono";
import {
    getAllProvidersDB,
    getAllCustomModelsDB,
    getCustomModelsByProviderDB,
    listModelPricingDB
} from "@srouter/db";
import { isSeedProvider } from "@srouter/constants";
import { getPricingForModel } from "@srouter/pricing";
import { Err, Ok } from "@/utils/response.js";

export const CatalogRouter = new Hono();

interface CatalogItem {
    providerId: string;
    name: string;
    protocol: string | null;
    category: string | null;
    ownerId: string | null;
    models: Array<{
        id: string;
        pricing: { input: number; output: number; cached?: number; cache_creation?: number; reasoning?: number };
        override: boolean;
    }>;
}

function BareModelId(modelWithPrefix: string): string {
    const slash = modelWithPrefix.indexOf("/");
    return slash >= 0 ? modelWithPrefix.slice(slash + 1) : modelWithPrefix;
}

// GET /v1/catalog — public (no auth). Lists all enabled providers with their
// available models and merged pricing (admin override wins, else static).
CatalogRouter.get("/catalog", async (c) => {
    const all = await getAllProvidersDB();
    const enabled = all.filter((p) => p.enabled && !isSeedProvider(p));
    const pricingOverrides = await listModelPricingDB();

    const items: CatalogItem[] = await Promise.all(
        enabled.map(async (p) => {
            const customModels = await getCustomModelsByProviderDB(
                (p.providerId || p.id).toLowerCase()
            );
            const models = customModels.map((row) => {
                const modelId = row.modelId;
                const override = pricingOverrides.find(
                    (o) => o.providerId === p.providerId && o.model === modelId
                );
                if (override) {
                    return {
                        id: modelId,
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
                name: p.name,
                protocol: (p.protocol as unknown as string) ?? null,
                category: (p.category as unknown as string) ?? null,
                ownerId: p.ownerId ?? null,
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

    const [all, pricingOverrides, allModels] = await Promise.all([
        getAllProvidersDB(),
        listModelPricingDB(),
        getAllCustomModelsDB()
    ]);
    // custom_models rows store the lowercase provider base id; build a lookup
    // that resolves via both p.id and p.providerId (lowercased).
    const providerLookup = new Map<string, typeof all[number]>();
    for (const p of all) {
        providerLookup.set(p.id.toLowerCase(), p);
        providerLookup.set(p.providerId.toLowerCase(), p);
    }

    const seen = new Set<string>(); // dedupe by providerId
    const offerings: Array<{
        providerId: string;
        name: string;
        pricing: { input: number; output: number; cached?: number; cache_creation?: number; reasoning?: number };
        override: boolean;
    }> = [];

    for (const row of allModels) {
        const bare = BareModelId(row.modelId).toLowerCase();
        if (bare !== target && row.modelId.toLowerCase() !== targetFull) continue;
        const provider = providerLookup.get(row.providerId.toLowerCase());
        if (!provider || !provider.enabled || isSeedProvider(provider)) continue;
        if (seen.has(provider.providerId)) continue;
        seen.add(provider.providerId);

        const override = pricingOverrides.find(
            (o) => o.providerId === provider.providerId && o.model === row.modelId
        );
        if (override) {
            offerings.push({
                providerId: provider.providerId,
                name: provider.name,
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
            const sp = getPricingForModel(provider.providerId, row.modelId);
            offerings.push({
                providerId: provider.providerId,
                name: provider.name,
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
