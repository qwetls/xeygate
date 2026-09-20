#!/usr/bin/env node
/**
 * Migration: normalize custom_models model_id with gateway prefix.
 *
 * Problem: model IDs were stored without the provider alias prefix
 *   e.g. "neko/hy3" instead of "xeygate/neko/hy3"
 * This causes the catalog to display raw vendor-prefixed IDs.
 *
 * Fix: prepend the provider's alias to model_ids that don't already
 * start with it. After migration, toDisplayModelId() can correctly
 * strip the vendor prefix for clean display.
 *
 * Usage: node --experimental-sqlite scripts/migrate-model-display-ids.mjs
 * Or run on VPS via SSH.
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const DB_PATH = process.argv[2] || "/app/data/xeygate.db";

console.log(`Opening database: ${DB_PATH}`);
const db = new DatabaseSync(DB_PATH, { open: true, readOnly: false });

// 1. Load all providers with aliases
const providers = db
  .prepare("SELECT id, alias FROM providers WHERE alias IS NOT NULL AND alias != ''")
  .all();
const aliasMap = new Map(providers.map((p) => [p.id, p.alias]));
console.log(`Found ${providers.length} providers with aliases`);

// 2. Load all custom_models
const models = db.prepare("SELECT rowid, provider_id, model_id FROM custom_models").all();
console.log(`Found ${models.length} custom_models rows`);

// 3. Identify rows that need updating
const updates = [];
for (const row of models) {
  const alias = aliasMap.get(row.provider_id);
  if (!alias) continue; // seed provider or no alias — skip

  const prefix = alias + "/";
  if (row.model_id.startsWith(prefix)) continue; // already has prefix

  const newModelId = prefix + row.model_id;
  updates.push({
    rowid: row.rowid,
    provider_id: row.provider_id,
    alias,
    old: row.model_id,
    new: newModelId,
  });
}

if (updates.length === 0) {
  console.log("Nothing to migrate — all model_ids already have gateway prefix.");
  process.exit(0);
}

console.log(`\nWill update ${updates.length} rows:`);
for (const u of updates) {
  console.log(`  [${u.alias}] ${u.old} → ${u.new}`);
}

// 4. Apply updates
const updateStmt = db.prepare("UPDATE custom_models SET model_id = ? WHERE rowid = ?");
for (const u of updates) {
  updateStmt.run(u.new, u.rowid);
}
console.log(`\nMigration complete. ${updates.length} rows updated.`);

// 5. Verify
const verify = db.prepare("SELECT provider_id, model_id FROM custom_models").all();
console.log("\nVerification — all custom_models:");
for (const row of verify) {
  const alias = aliasMap.get(row.provider_id) || row.provider_id;
  console.log(`  [${alias}] ${row.model_id}`);
}
