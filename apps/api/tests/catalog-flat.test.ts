import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Hono } from "hono";
import {
    userAuthStore as store,
    upsertProviderDB,
    deleteProviderDB,
    addCustomModelDB,
    deleteCustomModelsByProviderDB,
    upsertModelPricingDB,
    deleteModelPricingDB,
    type User,
} from "@srouter/db";
import { InvalidateOfficialCache } from "@/logic/official.logic.js";
import { CatalogRouter } from "@/routes/v1/catalog.js";

const TAG = crypto.randomUUID().slice(0, 8);
let SEQ = 0;

const app = new Hono();
app.route("/v1", CatalogRouter);

const trackedProviders: string[] = [];
const trackedPricing: { providerId: string; model: string }[] = [];

afterEach(async () => {
    for (const m of trackedPricing.splice(0)) await deleteModelPricingDB(m.providerId, m.model);
    for (const pid of trackedProviders.splice(0)) {
        await deleteCustomModelsByProviderDB(pid).catch(() => {});
        await deleteProviderDB(pid).catch(() => {});
    }
    InvalidateOfficialCache();
});

async function seed(): Promise<{ admin: User; creator: User; adminPid: string; creatorPid: string }> {
    const ns = ++SEQ;
    const admin = (await store.createUser({
        email: `cat_admin_${ns}_${TAG}@test.local`,
        passwordHash: "x",
        name: "CAT Admin",
        isAdmin: true
    }))!;
    const creator = (await store.createUser({
        email: `cat_creator_${ns}_${TAG}@test.local`,
        passwordHash: "x",
        name: "CAT Creator"
    }))!;

    const adminPid = `cat_off_${TAG}_${ns}`;
    const creatorPid = `cat_cre_${TAG}_${ns}`;

    await upsertProviderDB({
        id: adminPid,
        providerId: adminPid,
        alias: `off${ns}`,
        name: `Official CAT #${ns}`,
        category: "api_key",
        protocol: "openai",
        baseUrl: "https://cat-off.local/v1",
        ownerId: admin.id,
        enabled: true
    } as any);

    await upsertProviderDB({
        id: creatorPid,
        providerId: creatorPid,
        alias: `cre${ns}`,
        name: `Creator CAT #${ns}`,
        category: "custom_provider",
        protocol: "openai",
        baseUrl: "https://cat-cre.local/v1",
        ownerId: creator.id,
        enabled: true
    } as any);

    trackedProviders.push(adminPid, creatorPid);

    // Listings: both offer "alpha-model"; only official offers "beta-model";
    // only creator offers "gamma-model".
    await addCustomModelDB(adminPid, "alpha-model");
    await addCustomModelDB(adminPid, "beta-model");
    await addCustomModelDB(creatorPid, "alpha-model");
    await addCustomModelDB(creatorPid, "gamma-model");

    return { admin, creator, adminPid, creatorPid };
}

async function getJson(path: string) {
    const res = await app.request(path);
    return { status: res.status, body: await res.json() };
}

// ── Flat list ─────────────────────────────────────────────────────────

test("GET /v1/catalog/models returns one entry per bare model with correct endpoints count", async () => {
    const { adminPid, creatorPid } = await seed();
    const { status, body } = await getJson("/v1/catalog/models");
    assert.equal(status, 200);
    assert.equal(body.object, "catalog.models");

    const ids = body.models.map((m: { id: string }) => m.id);
    assert.ok(ids.includes("alpha-model"));
    assert.ok(ids.includes("beta-model"));
    assert.ok(ids.includes("gamma-model"));

    const alpha = body.models.find((m: { id: string }) => m.id === "alpha-model")!;
    assert.equal(alpha.endpoints, 2, "alpha-model listed on both providers");
    assert.ok(alpha.offers.length === 2);

    const beta = body.models.find((m: { id: string }) => m.id === "beta-model")!;
    assert.equal(beta.endpoints, 1);
    assert.equal(beta.offers[0].providerId, adminPid);

    const gamma = body.models.find((m: { id: string }) => m.id === "gamma-model")!;
    assert.equal(gamma.endpoints, 1);
    assert.equal(gamma.offers[0].providerId, creatorPid);
});

test("bestOffer picks the cheapest by input then output", async () => {
    const { adminPid, creatorPid } = await seed();
    // Admin override: $5 in / $20 out
    await upsertModelPricingDB({ providerId: adminPid, model: "alpha-model", input: 5, output: 20 });
    trackedPricing.push({ providerId: adminPid, model: "alpha-model" });
    // Creator override: $2 in / $40 out — cheaper input
    await upsertModelPricingDB({ providerId: creatorPid, model: "alpha-model", input: 2, output: 40 });
    trackedPricing.push({ providerId: creatorPid, model: "alpha-model" });

    const { body } = await getJson("/v1/catalog/models");
    const alpha = body.models.find((m: { id: string }) => m.id === "alpha-model")!;

    assert.equal(alpha.bestOffer.providerId, creatorPid, "creator is cheaper on input");
    assert.equal(alpha.bestOffer.input, 2);
    assert.equal(alpha.bestOffer.output, 40);

    const officialOffer = alpha.offers.find((o: { providerId: string }) => o.providerId === adminPid)!;
    assert.equal(officialOffer.input, 5);
    assert.equal(officialOffer.override, true);
});

test("models are sorted alphabetically by id", async () => {
    await seed();
    const { body } = await getJson("/v1/catalog/models");
    const ids = body.models.map((m: { id: string }) => m.id);
    const sorted = [...ids].sort((a: string, b: string) => a.localeCompare(b));
    assert.deepEqual(ids, sorted);
});

test("total matches the models array length", async () => {
    await seed();
    const { body } = await getJson("/v1/catalog/models");
    assert.equal(body.total, body.models.length);
});

// ── Per-model detail preserved ────────────────────────────────────────

test("GET /v1/catalog/models?model= still returns per-provider offerings", async () => {
    const { adminPid, creatorPid } = await seed();
    const { status, body } = await getJson("/v1/catalog/models?model=alpha-model");
    assert.equal(status, 200);
    assert.equal(body.model, "alpha-model");
    assert.equal(body.total, 2);
    const providerIds = body.offerings.map((o: { providerId: string }) => o.providerId);
    assert.ok(providerIds.includes(adminPid));
    assert.ok(providerIds.includes(creatorPid));
});
