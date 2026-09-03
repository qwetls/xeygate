import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
    createAPIKeyDB,
    deleteAPIKeyDB,
    getAllAPIKeysDB,
    getAPIKeyByKeyDB,
    incrementAPIKeyUsageDB
} from "@srouter/db";

const createdIds: string[] = [];

afterEach(async () => {
    for (const id of createdIds.splice(0)) {
        await deleteAPIKeyDB(id);
    }
});

test("createAPIKeyDB stores a new virtual key with prefix sr-live-", async () => {
    const created = await createAPIKeyDB({
        name: "Test Client Key",
        rateLimit: 60,
        quotaLimit: 50000
    });

    createdIds.push(created.id);

    assert.ok(created.id.startsWith("key_"));
    assert.ok(created.key.startsWith("sr-live-"));
    assert.equal(created.name, "Test Client Key");
    assert.equal(created.enabled, true);
    assert.equal(created.rate_limit, 60);
    assert.equal(created.quota_limit, 50000);
    assert.equal(created.usage_tokens, 0);

    const lookup = await getAPIKeyByKeyDB(created.key);
    assert.ok(lookup);
    assert.equal(lookup?.id, created.id);
    assert.equal(lookup?.name, "Test Client Key");
});

test("incrementAPIKeyUsageDB and deleteAPIKeyDB work accurately", async () => {
    const created = await createAPIKeyDB({
        name: "Usage Test Key"
    });

    createdIds.push(created.id);

    await incrementAPIKeyUsageDB(created.id, 1250);

    const all = await getAllAPIKeysDB();
    const found = all.find((k) => k.id === created.id);
    assert.equal(found?.usage_tokens, 1250);

    const deleted = await deleteAPIKeyDB(created.id);
    assert.equal(deleted, true);

    const lookupAfterDelete = await getAPIKeyByKeyDB(created.key);
    assert.equal(lookupAfterDelete, null);
});

test("createAPIKeyDB supports enabled false on creation", async () => {
    const created = await createAPIKeyDB({
        name: "Disabled Key",
        enabled: false
    });

    createdIds.push(created.id);

    assert.equal(created.enabled, false);
    const lookup = await getAPIKeyByKeyDB(created.key);
    // getAPIKeyByKeyDB only returns enabled keys
    assert.equal(lookup, null);
    const all = await getAllAPIKeysDB();
    const found = all.find((k) => k.id === created.id);
    assert.equal(found?.enabled, false);
});

