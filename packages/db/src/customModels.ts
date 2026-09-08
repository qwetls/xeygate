import { db, isPostgres } from "./db.js";
import { num, str } from "./row-utils.js";

export interface CustomModelRow {
    providerId: string;
    modelId: string;
    createdAt: number;
}

interface CustomModelDBShape {
    provider_id: string;
    model_id: string;
    created_at: number;
}

export async function getAllCustomModelsDB(): Promise<CustomModelRow[]> {
    const Rows = (await db
        .prepare("SELECT * FROM custom_models ORDER BY created_at ASC")
        .all()) as unknown as CustomModelDBShape[];
    return Rows.map(mapCustomModelRow);
}

export async function getCustomModelsByProviderDB(providerId: string): Promise<CustomModelRow[]> {
    const Rows = (await db
        .prepare("SELECT * FROM custom_models WHERE provider_id = ? ORDER BY created_at ASC")
        .all(providerId)) as unknown as CustomModelDBShape[];
    return Rows.map(mapCustomModelRow);
}

/**
 * Models listed for one provider row. Official (platform-owned) listings are
 * keyed by the provider base id and shared by every connection of that
 * provider — admin registers the catalog once, then connects keys in any
 * order. Connection-scoped rows stay private to their own connection and win
 * over base-id rows on modelId conflicts. `baseId` must only be passed for
 * official providers; creators never inherit listings from other owners.
 */
export async function getCustomModelsForProviderDB(
    providerId: string,
    baseId?: string
): Promise<CustomModelRow[]> {
    const Key = providerId.toLowerCase();
    const Base = baseId?.toLowerCase();
    if (!Base || Base === Key) return getCustomModelsByProviderDB(Key);
    const [own, inherited] = await Promise.all([
        getCustomModelsByProviderDB(Key),
        getCustomModelsByProviderDB(Base)
    ]);
    const seen = new Set(own.map((row) => row.modelId.toLowerCase()));
    return [...own, ...inherited.filter((row) => !seen.has(row.modelId.toLowerCase()))];
}

export async function addCustomModelDB(providerId: string, modelId: string): Promise<CustomModelRow> {
    const CreatedAt = Date.now();
    const UpsertSql = isPostgres()
        ? `INSERT INTO custom_models (provider_id, model_id, created_at)
           VALUES (?, ?, ?)
           ON CONFLICT (provider_id, model_id) DO NOTHING`
        : `INSERT OR IGNORE INTO custom_models (provider_id, model_id, created_at)
           VALUES (?, ?, ?)`;
    await db.prepare(UpsertSql).run(providerId, modelId, CreatedAt);
    return { providerId, modelId, createdAt: CreatedAt };
}

export async function deleteCustomModelDB(providerId: string, modelId: string): Promise<boolean> {
    const Result = await db
        .prepare("DELETE FROM custom_models WHERE provider_id = ? AND model_id = ?")
        .run(providerId, modelId);
    return num(Result.changes) > 0;
}

export async function deleteCustomModelsByProviderDB(providerId: string): Promise<number> {
    const Result = await db
        .prepare("DELETE FROM custom_models WHERE provider_id = ?")
        .run(providerId);
    return num(Result.changes);
}

function mapCustomModelRow(row: CustomModelDBShape): CustomModelRow {
    return {
        providerId: str(row.provider_id),
        modelId: str(row.model_id),
        createdAt: num(row.created_at)
    };
}