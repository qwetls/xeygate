import { db } from "./db.js";
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

export async function addCustomModelDB(providerId: string, modelId: string): Promise<CustomModelRow> {
    const CreatedAt = Date.now();
    await db.prepare(
        `INSERT OR IGNORE INTO custom_models (provider_id, model_id, created_at)
         VALUES (?, ?, ?)`
    ).run(providerId, modelId, CreatedAt);
    return { providerId, modelId, createdAt: CreatedAt };
}

export async function deleteCustomModelDB(providerId: string, modelId: string): Promise<boolean> {
    const Result = await db
        .prepare("DELETE FROM custom_models WHERE provider_id = ? AND model_id = ?")
        .run(providerId, modelId);
    return num(Result.changes) > 0;
}

function mapCustomModelRow(row: CustomModelDBShape): CustomModelRow {
    return {
        providerId: str(row.provider_id),
        modelId: str(row.model_id),
        createdAt: num(row.created_at)
    };
}