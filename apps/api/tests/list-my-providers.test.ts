import assert from "node:assert/strict";
import { test } from "node:test";
import {
    addCustomModelDB,
    deleteCustomModelsByProviderDB,
    deleteProviderDB,
    upsertProviderDB,
} from "@srouter/db";
import { ProvidersLogic } from "@/logic/providers.logic.js";

const TS = Date.now();
const OWNER = `test-myapis-owner-${TS}`;

// A connection whose id folds to the "bai" seed base via BaseIdOf().
const CONN_ID = `bai-myapis-${TS}-0`;
const BASE = "bai";

test("ListMyProviders shows inherited base-id models for official connections", async (t) => {
    await upsertProviderDB({
        id: CONN_ID,
        providerId: CONN_ID,
        name: "My Bulk Key",
        category: "free_tier",
        protocol: "openai",
        apiKey: `sk-test-${TS}`,
        ownerId: OWNER,
        enabled: true,
        createdAt: TS
    });

    const M1 = `myapis-alpha-${TS}`;
    const M2 = `myapis-beta-${TS}`;
    await addCustomModelDB(BASE, M1);
    await addCustomModelDB(BASE, M2);

    t.after(async () => {
        await deleteProviderDB(CONN_ID).catch(() => {});
        await deleteCustomModelsByProviderDB(BASE).catch(() => {});
    });

    const list = await ProvidersLogic.ListMyProviders(OWNER);
    const mine = list.find((p) => p.id === CONN_ID);
    assert.ok(mine, `connection ${CONN_ID} must appear in ListMyProviders`);
    assert.equal(mine!.modelsCount, 2, "modelsCount must include inherited base-id rows");
    assert.ok(mine!.models.includes(M1));
    assert.ok(mine!.models.includes(M2));
});

test("ListMyProviders merges own connection rows with inherited base-id rows", async (t) => {
    const CONN_ID_2 = `bai-myapis-${TS}-1`;
    await upsertProviderDB({
        id: CONN_ID_2,
        providerId: CONN_ID_2,
        name: "My Bulk Key 2",
        category: "free_tier",
        protocol: "openai",
        apiKey: `sk-test-2-${TS}`,
        ownerId: OWNER,
        enabled: true,
        createdAt: TS
    });

    const BASE_MODEL = `myapis-gamma-${TS}`;
    const OWN_MODEL = `myapis-delta-${TS}`;
    await addCustomModelDB(BASE, BASE_MODEL);
    await addCustomModelDB(CONN_ID_2, OWN_MODEL);

    t.after(async () => {
        await deleteProviderDB(CONN_ID_2).catch(() => {});
        await deleteCustomModelsByProviderDB(CONN_ID_2).catch(() => {});
        await deleteCustomModelsByProviderDB(BASE).catch(() => {});
    });

    const list = await ProvidersLogic.ListMyProviders(OWNER);
    const mine = list.find((p) => p.id === CONN_ID_2);
    assert.ok(mine);
    assert.equal(mine!.modelsCount, 2, "own + inherited = 2 distinct models");
    assert.ok(mine!.models.includes(BASE_MODEL), "inherited model present");
    assert.ok(mine!.models.includes(OWN_MODEL), "own model present");
});

test("ListMyProviders deduplicates own vs inherited when the same model id appears in both", async (t) => {
    const CONN_ID_3 = `bai-myapis-${TS}-2`;
    await upsertProviderDB({
        id: CONN_ID_3,
        providerId: CONN_ID_3,
        name: "My Bulk Key 3",
        category: "free_tier",
        protocol: "openai",
        apiKey: `sk-test-3-${TS}`,
        ownerId: OWNER,
        enabled: true,
        createdAt: TS
    });

    const SHARED = `myapis-shared-${TS}`;
    await addCustomModelDB(BASE, SHARED);
    await addCustomModelDB(CONN_ID_3, SHARED);

    t.after(async () => {
        await deleteProviderDB(CONN_ID_3).catch(() => {});
        await deleteCustomModelsByProviderDB(CONN_ID_3).catch(() => {});
        await deleteCustomModelsByProviderDB(BASE).catch(() => {});
    });

    const list = await ProvidersLogic.ListMyProviders(OWNER);
    const mine = list.find((p) => p.id === CONN_ID_3);
    assert.ok(mine);
    assert.equal(mine!.modelsCount, 1, "shared model must not be double-counted");
    assert.ok(mine!.models.includes(SHARED));
});
