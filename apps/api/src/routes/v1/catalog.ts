import { Hono } from "hono";
import {
    getAllProvidersDB,
    getAllCustomModelsDB,
    getCustomModelsByProviderDB,
    listModelPricingDB,
    userAuthStore
} from "@srouter/db";
import { isSeedProvider } from "@srouter/constants";
import { getPricingForModel } from "@srouter/pricing";
import { RuntimeAliasFor } from "@/logic/providers.logic.js";
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

// Storefront display name: creators run a provider under their account name,
// so the marketplace (and the playground model list) shows the account name;
// official providers show their own name.
const creatorNameCache = new Map<string, string | null>();

async function StorefrontName(ownerId: string | null | undefined, fallback: string): Promise<string> {
    if (!ownerId) return fallback;
    const cached = creatorNameCache.get(ownerId);
    if (cached !== undefined) return cached || fallback;
    const user = await userAuthStore.getUserById(ownerId);
    const name = user?.name?.trim() || null;
    creatorNameCache.set(ownerId, name);
    return name || fallback;
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
            const alias = RuntimeAliasFor((p.providerId || p.id).toLowerCase());
            const models = customModels.map((row) => {
                const modelId = row.modelId;
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
                name: await StorefrontName(p.ownerId, p.name),
                providerName: p.name,
                protocol: (p.protocol as unknown as string) ?? null,
                category: (p.category as unknown as string) ?? null,
                ownerId: p.ownerId ?? null,
                official: !p.ownerId,
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
        providerName: string;
        official: boolean;
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
        const displayName = await StorefrontName(provider.ownerId, provider.name);

        const override = pricingOverrides.find(
            (o) => o.providerId === provider.providerId && o.model === row.modelId
        );
        if (override) {
            offerings.push({
                providerId: provider.providerId,
                name: displayName,
                providerName: provider.name,
                official: !provider.ownerId,
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
                name: displayName,
                providerName: provider.name,
                official: !provider.ownerId,
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
