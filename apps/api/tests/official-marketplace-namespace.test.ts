/**
 * Marketplace namespace isolation tests.
 *
 * Official (platform-owned) listings live under the shared provider base id
 * and are served by every admin-owned connection of that driver; creator
 * listings stay connection-scoped. /user/v1 resolves only creator supply,
 * /official/v1 only official supply, /v1 both.
 */
import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { Hono } from "hono";
import type { AIProvider } from "@srouter/types";
import {
    userAuthStore as store,
    upsertProviderDB,
    deleteProviderDB,
    addCustomModelDB,
    deleteCustomModelsByProviderDB,
    createAPIKeyDB,
    db,
    getCreatorEarningsDB,
    getUserTransactionsDB,
    type User
} from "@srouter/db";
import {
    InvalidateOfficialCache,
    IsOfficialOwnerId,
    IsOfficialProviderRow,
    SelectMarketplaceRows
} from "@/logic/official.logic.js";
import { MarketplaceScopeMiddleware } from "@/middleware/MarketplaceScope.js";
import { ResolveMarketplaceRoute } from "@/logic/routing.logic.js";
import { settleMarketplaceUsage } from "@/logic/billing.logic.js";
import { CatalogRouter } from "@/routes/v1/catalog.js";
import { registry } from "@/services/registry.js";

const TAG = crypto.randomUUID().slice(0, 8);

const trackedProviderIds: string[] = [];
const trackedCustomKeys: string[] = [];

afterEach(async () => {
    for (const providerId of trackedProviderIds.splice(0)) {
        await deleteProviderDB(providerId).catch(() => {});
        for (const provider of registry.getAllProviders().values()) {
            if (provider.id === providerId) registry.unregisterProvider(providerId);
        }
    }
    for (const key of trackedCustomKeys.splice(0)) {
        await deleteCustomModelsByProviderDB(key).catch(() => {});
    }
});

after(async () => {
    InvalidateOfficialCache();
});

function mockExecutor(id: string): AIProvider {
    return {
        id,
        name: `Mock ${id}`,
        listModels: async () => [],
        chatCompletion: async () => {
            throw new Error("not implemented");
        },
        chatCompletionStream: async function* () {
            throw new Error("not implemented");
        }
    };
}

function trackProvider(config: Record<string, unknown>): Promise<unknown> {
    trackedProviderIds.push(config.id as string);
    return upsertProviderDB(config as never);
}

function trackCustomModel(providerKey: string, modelId: string): Promise<unknown> {
    trackedCustomKeys.push(providerKey);
    return addCustomModelDB(providerKey, modelId);
}

// ── IsOfficialProviderRow ─────────────────────────────────────────────

test("legacy rows without an owner are official", async () => {
    assert.equal(IsOfficialOwnerId(null), true);
    assert.equal(IsOfficialOwnerId(undefined), true);
    assert.equal(await IsOfficialProviderRow({ ownerId: null }), true);
});

test("admin-account-owned connections are official, creator-owned are not", async () => {
    const admin = (await store.createUser({
        email: `ns_admin_${TAG}@test.local`,
        passwordHash: "x",
        name: "NS Admin",
        isAdmin: true
    }))! as User;

    const creator = (await store.createUser({
        email: `ns_creator_${TAG}@test.local`,
        passwordHash: "x",
        name: "NS Creator"
    }))! as User;

    assert.equal(await IsOfficialProviderRow({ ownerId: admin.id }), true);
    assert.equal(await IsOfficialProviderRow({ ownerId: creator.id }), false);

    // Demotion flips the flag once the cache is invalidated (60s TTL guard).
    await store.setAdmin(admin.id, false);
    InvalidateOfficialCache(admin.id);
    assert.equal(await IsOfficialProviderRow({ ownerId: admin.id }), false);
    await store.setAdmin(admin.id, true);
    InvalidateOfficialCache(admin.id);
});

// ── SelectMarketplaceRows (key-space isolation) ───────────────────────

test("official connection inherits base-id rows; creator never does", async () => {
    const officialModel = `ns-official-${TAG}`;
    const creatorModel = `ns-creator-${TAG}`;
    const strayBaseModel = `ns-stray-${TAG}`;

    // Admin registers the catalog once, keyed by the shared base id.
    await trackCustomModel("anthropic", officialModel);

    // A stray creator row keyed at its own base id must stay private to the
    // connection that owns it.
    await trackCustomModel("creatorconn", strayBaseModel);

    await trackProvider({
        id: `anthropic-official-${TAG}`,
        providerId: `anthropic-official-${TAG}`,
        alias: "officl",
        name: "XEYGATE Official",
        category: "api_key",
        protocol: "openai",
        baseUrl: "https://official.local/v1",
        enabled: true
    });
    const officialRow = {
        id: `anthropic-official-${TAG}`,
        providerId: `anthropic-official-${TAG}`
    };

    await trackProvider({
        id: `creatorconn-${TAG}`,
        providerId: `creatorconn-${TAG}`,
        alias: "creatorx",
        name: "Creator Conn",
        category: "custom_provider",
        protocol: "openai",
        baseUrl: "https://creator.local/v1",
        ownerId: (
            await store.createUser({
                email: `ns_owner_${TAG}@test.local`,
                passwordHash: "x",
                name: "NS Owner"
            })
        )!.id,
        enabled: true
    });
    await trackCustomModel(`creatorconn-${TAG}`, creatorModel);
    const creatorRow = { id: `creatorconn-${TAG}`, providerId: `creatorconn-${TAG}` };

    // Official inherits the base-id catalog; creator sees only its own rows.
    const officialRows = await SelectMarketplaceRows(officialRow, true);
    assert.ok(officialRows.some((r) => r.modelId === officialModel));

    const creatorRows = await SelectMarketplaceRows(creatorRow, false);
    assert.ok(creatorRows.some((r) => r.modelId === creatorModel));
    assert.ok(!creatorRows.some((r) => r.modelId === strayBaseModel));
    assert.ok(!creatorRows.some((r) => r.modelId === officialModel));
});

// ── ResolveMarketplaceRoute scope isolation ───────────────────────────

test("routing namespaces resolve disjoint chains", async () => {
    const officialModel = `ns-route-official-${TAG}`;
    const bothModel = `ns-route-both-${TAG}`;

    const admin = (await store.createUser({
        email: `ns_route_admin_${TAG}@test.local`,
        passwordHash: "x",
        name: "NS Route Admin",
        isAdmin: true
    }))! as User;
    const creator = (await store.createUser({
        email: `ns_route_creator_${TAG}@test.local`,
        passwordHash: "x",
        name: "NS Route Creator"
    }))! as User;

    await trackCustomModel("anthropic", officialModel);
    await trackCustomModel("anthropic", bothModel);
    await trackCustomModel(`creatorconn-route-${TAG}`, bothModel);

    await trackProvider({
        id: `anthropic-route-${TAG}`,
        providerId: `anthropic-route-${TAG}`,
        alias: "officl",
        name: "XEYGATE Official Route",
        category: "api_key",
        protocol: "openai",
        baseUrl: "https://official-route.local/v1",
        ownerId: admin.id,
        enabled: true
    });
    await trackProvider({
        id: `creatorconn-route-${TAG}`,
        providerId: `creatorconn-route-${TAG}`,
        alias: "creatorx",
        name: "Creator Route Conn",
        category: "custom_provider",
        protocol: "openai",
        baseUrl: "https://creator-route.local/v1",
        ownerId: creator.id,
        enabled: true
    });

    registry.registerProvider(mockExecutor(`anthropic-route-${TAG}`));
    registry.registerProvider(mockExecutor(`creatorconn-route-${TAG}`));

    // Official namespace: only the admin connection's inherited listing.
    const officialChain = await ResolveMarketplaceRoute(officialModel, "official");
    assert.ok(officialChain);
    assert.deepEqual(officialChain, [`officl/${officialModel}`]);

    // User namespace: official supply is invisible.
    const userOfficial = await ResolveMarketplaceRoute(officialModel, "user");
    assert.equal(userOfficial, null);

    // Both namespaces for a model listed on both sides.
    const officialBoth = await ResolveMarketplaceRoute(bothModel, "official");
    assert.deepEqual(officialBoth, [`officl/${bothModel}`]);
    const userBoth = await ResolveMarketplaceRoute(bothModel, "user");
    assert.deepEqual(userBoth, [`creatorx/${bothModel}`]);
    const allBoth = await ResolveMarketplaceRoute(bothModel, "all");
    assert.deepEqual(allBoth.sort(), [`creatorx/${bothModel}`, `officl/${bothModel}`]);

    registry.unregisterProvider(`anthropic-route-${TAG}`);
    registry.unregisterProvider(`creatorconn-route-${TAG}`);
});

// ── Slash-containing listing ids ──────────────────────────────────────

test("a listing id with a slash routes as an exact marketplace candidate", async () => {
    const creator = (await store.createUser({
        email: `ns_slash_creator_${TAG}@test.local`,
        passwordHash: "x",
        name: "NS Slash Creator"
    }))! as User;

    const slashModel = `cx/ns-slash-${TAG}`; // leading segment is not a provider alias
    const connId = `creatorconn-slash-${TAG}`;
    await trackCustomModel(connId, slashModel);
    await trackProvider({
        id: connId,
        providerId: connId,
        alias: "slashx",
        name: "Slash Creator Conn",
        category: "custom_provider",
        protocol: "openai",
        baseUrl: "https://slash.local/v1",
        ownerId: creator.id,
        enabled: true
    });
    registry.registerProvider(mockExecutor(connId));

    // The advertised id is exactly the requestable id.
    const chain = await ResolveMarketplaceRoute(slashModel, "user");
    assert.ok(chain, "slash listing must produce a marketplace chain");
    assert.deepEqual(chain, [`slashx/${slashModel}`]);

    // Provider-qualified requests keep the direct registry path: a custom
    // connection alias as head…
    assert.equal(await ResolveMarketplaceRoute(`slashx/${slashModel}`, "user"), null);
    // …and a built-in namespace can never be laundered through another
    // account's row, even if one literally stored that name.
    await trackCustomModel(connId, `anthropic/ns-poison-${TAG}`);
    assert.equal(
        await ResolveMarketplaceRoute(`anthropic/ns-poison-${TAG}`, "all"),
        null
    );

    registry.unregisterProvider(connId);
});

// ── Public catalog endpoints ──────────────────────────────────────────

const catalogApp = new Hono();
catalogApp.route("/v1", CatalogRouter);

test("official listings surface in /v1/catalog with provider name and official flag", async () => {
    const admin = (await store.createUser({
        email: `ns_cat_admin_${TAG}@test.local`,
        passwordHash: "x",
        name: "Catalog Boss",
        isAdmin: true
    }))! as User;
    const catalogModel = `ns-catalog-${TAG}`;
    await trackCustomModel("anthropic", catalogModel);

    await trackProvider({
        id: `anthropic-catalog-${TAG}`,
        providerId: `anthropic-catalog-${TAG}`,
        alias: "officl",
        name: "XEYGATE Official Catalog",
        category: "api_key",
        protocol: "openai",
        baseUrl: "https://official-catalog.local/v1",
        ownerId: admin.id,
        enabled: true
    });

    const res = await catalogApp.request("/v1/catalog");
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
        providers: Array<{
            providerId: string;
            name: string;
            official: boolean;
            ownerId: string | null;
            models: Array<{ id: string; fullId: string }>;
        }>;
    };

    const officialCard = body.providers.find((p) => p.providerId === `anthropic-catalog-${TAG}`);
    assert.ok(officialCard, "official connection must appear in the catalog");
    assert.equal(officialCard.official, true);
    assert.equal(officialCard.name, "XEYGATE Official Catalog");
    assert.equal(officialCard.ownerId, admin.id);
    assert.ok(
        officialCard.models.some((m) => m.id === catalogModel),
        "base-id-keyed model must be listed on the official connection"
    );
});

test("GET /v1/catalog/models finds official supply through the base id", async () => {
    const admin = (await store.createUser({
        email: `ns_catm_admin_${TAG}@test.local`,
        passwordHash: "x",
        name: "Catalog Models Admin",
        isAdmin: true
    }))! as User;
    const model = `ns-catm-${TAG}`;
    await trackCustomModel("anthropic", model);
    await trackProvider({
        id: `anthropic-catm-${TAG}`,
        providerId: `anthropic-catm-${TAG}`,
        alias: "officl",
        name: "XEYGATE Official CatM",
        category: "api_key",
        protocol: "openai",
        baseUrl: "https://official-catm.local/v1",
        ownerId: admin.id,
        enabled: true
    });

    const res = await catalogApp.request(`/v1/catalog/models?model=${model}`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
        offerings: Array<{ providerId: string; official: boolean; name: string }>;
    };
    const officialOffering = body.offerings.find(
        (o) => o.providerId === `anthropic-catm-${TAG}`
    );
    assert.ok(officialOffering, "official offering must be discoverable by bare model");
    assert.equal(officialOffering.official, true);
    assert.equal(officialOffering.name, "XEYGATE Official CatM");
});

test("official connections of one driver collapse into a single catalog card", async () => {
    const admin = (await store.createUser({
        email: `ns_grp_admin_${TAG}@test.local`,
        passwordHash: "x",
        name: "Grouping Admin",
        isAdmin: true
    }))! as User;
    await trackCustomModel("anthropic", `ns-group-${TAG}`);
    await trackProvider({
        id: `anthropic-grp-a-${TAG}`,
        providerId: `anthropic-grp-a-${TAG}`,
        alias: "officl",
        name: "XEYGATE Official A",
        category: "api_key",
        protocol: "openai",
        baseUrl: "https://official-a.local/v1",
        ownerId: admin.id,
        enabled: true
    });
    await trackProvider({
        id: `anthropic-grp-b-${TAG}`,
        providerId: `anthropic-grp-b-${TAG}`,
        alias: "officl",
        name: "XEYGATE Official B",
        category: "api_key",
        protocol: "openai",
        baseUrl: "https://official-b.local/v1",
        ownerId: admin.id,
        enabled: true
    });

    const res = await catalogApp.request("/v1/catalog");
    const body = (await res.json()) as { providers: Array<{ providerId: string }> };
    const officialCards = body.providers.filter((p) => p.providerId.startsWith("anthropic-grp-"));
    assert.equal(officialCards.length, 1, "both connections share one base-id card");
});

// ── Billing: official supply keeps the full amount ────────────────────

test("settleMarketplaceUsage credits nothing for official providers", async () => {
    const admin = (await store.createUser({
        email: `ns_bill_admin_${TAG}@test.local`,
        passwordHash: "x",
        name: "Billing Admin",
        isAdmin: true
    }))! as User;
    const buyer = (await store.createUser({
        email: `ns_bill_buyer_${TAG}@test.local`,
        passwordHash: "x",
        name: "Billing Buyer"
    }))! as User;

    await trackProvider({
        id: `billprov-${TAG}`,
        providerId: `billprov-${TAG}`,
        alias: `billprov_${TAG}`,
        name: "Billing Provider",
        category: "custom_provider",
        protocol: "openai",
        baseUrl: "https://bill.local/v1",
        ownerId: admin.id,
        enabled: true
    });

    const key = await createAPIKeyDB({ name: "ns-billing-key" });
    await db.prepare("UPDATE api_keys SET user_id = ? WHERE id = ?").run(buyer.id, key.id);
    await store.updateCredits(buyer.id, 100);

    await settleMarketplaceUsage({
        apiKeyId: key.id,
        providerId: `billprov-${TAG}`,
        model: "gpt-4o",
        amount: 10
    });

    const buyerCredits = await store.getUserCredits(buyer.id);
    assert.equal(buyerCredits, 90, "buyer is debited the full amount");
    const adminEarnings = await getCreatorEarningsDB(admin.id);
    assert.equal(adminEarnings.length, 0, "official supply earns no creator share");

    const txns = await getUserTransactionsDB(buyer.id);
    assert.equal(txns[0].amount, 10);
});

// ── Namespace middleware ──────────────────────────────────────────────

test("MarketplaceScopeMiddleware pins the request namespace", async () => {
    for (const scope of ["user", "official"] as const) {
        const app = new Hono();
        app.use("*", MarketplaceScopeMiddleware(scope));
        app.get("/probe", (c) => c.json({ scope: c.get("marketplaceScope") }));

        const res = await app.request("/probe");
        const body = (await res.json()) as { scope: string };
        assert.equal(body.scope, scope);
    }
});
