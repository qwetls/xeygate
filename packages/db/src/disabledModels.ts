import { db } from "./db.js";
import { num, str } from "./row-utils.js";

export interface DisabledModelRow {
    providerId: string;
    modelId: string;
    disabledBy: string;
    reason?: string;
    createdAt: number;
}

interface DisabledModelDBShape {
    provider_id: string;
    model_id: string;
    disabled_by: string;
    reason: string | null;
    created_at: number;
}

function mapRow(row: DisabledModelDBShape): DisabledModelRow {
    return {
        providerId: str(row.provider_id),
        modelId: str(row.model_id),
        disabledBy: str(row.disabled_by),
        reason: str(row.reason) || undefined,
        createdAt: num(row.created_at)
    };
}

/** All disabled rows — backs the router's short-lived in-memory gate cache. */
export async function getAllDisabledModelsDB(): Promise<DisabledModelRow[]> {
    const rows = (await db
        .prepare("SELECT * FROM disabled_models ORDER BY created_at ASC")
        .all()) as unknown as DisabledModelDBShape[];
    return rows.map(mapRow);
}

export async function getDisabledModelsByProviderDB(providerId: string): Promise<DisabledModelRow[]> {
    const rows = (await db
        .prepare("SELECT * FROM disabled_models WHERE provider_id = ? ORDER BY created_at ASC")
        .all(providerId)) as unknown as DisabledModelDBShape[];
    return rows.map(mapRow);
}

/** Lower-cased model ids disabled under one provider key. */
export async function getDisabledModelIdsForProviderDB(providerId: string): Promise<Set<string>> {
    const rows = await getDisabledModelsByProviderDB(providerId);
    return new Set(rows.map((r) => r.modelId.toLowerCase()));
}

export async function disableModelDB(
    providerId: string,
    modelId: string,
    disabledBy: string,
    reason?: string
): Promise<DisabledModelRow> {
    const createdAt = Date.now();
    const Pid = providerId.toLowerCase();
    await db
        .prepare(
            `INSERT INTO disabled_models (provider_id, model_id, disabled_by, reason, created_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (provider_id, model_id) DO UPDATE SET
               disabled_by = excluded.disabled_by,
               reason      = excluded.reason,
               created_at  = excluded.created_at`
        )
        .run(Pid, modelId, disabledBy, reason ?? null, createdAt);
    return { providerId: Pid, modelId, disabledBy, reason, createdAt };
}

export async function enableModelDB(providerId: string, modelId: string): Promise<boolean> {
    const result = await db
        .prepare("DELETE FROM disabled_models WHERE provider_id = ? AND model_id = ?")
        .run(providerId.toLowerCase(), modelId);
    return num(result.changes) > 0;
}

/**
 * Insert many disable rules under one provider key in a single statement —
 * the multi-row VALUES form upserts each tuple, so re-disabling refreshes the
 * reason/timestamp exactly like `disableModelDB`.
 */
export async function disableModelsDB(
    providerId: string,
    modelIds: string[],
    disabledBy: string,
    reason?: string
): Promise<number> {
    const Unique = [...new Set(modelIds)];
    if (Unique.length === 0) return 0;
    const Pid = providerId.toLowerCase();
    const createdAt = Date.now();
    const Tuples: unknown[] = [];
    for (const mid of Unique) Tuples.push(Pid, mid, disabledBy, reason ?? null, createdAt);
    const placeholders = Unique.map(() => "(?, ?, ?, ?, ?)").join(", ");
    await db
        .prepare(
            `INSERT INTO disabled_models (provider_id, model_id, disabled_by, reason, created_at)
             VALUES ${placeholders}
             ON CONFLICT (provider_id, model_id) DO UPDATE SET
               disabled_by = excluded.disabled_by,
               reason      = excluded.reason,
               created_at  = excluded.created_at`
        )
        .run(...Tuples);
    return Unique.length;
}

/** Remove many disable rules under one provider key. Returns rows deleted. */
export async function enableModelsDB(
    providerId: string,
    modelIds: string[]
): Promise<number> {
    const Unique = [...new Set(modelIds)];
    if (Unique.length === 0) return 0;
    const Pid = providerId.toLowerCase();
    const placeholders = Unique.map(() => "?").join(", ");
    const result = await db
        .prepare(
            `DELETE FROM disabled_models WHERE provider_id = ? AND model_id IN (${placeholders})`
        )
        .run(Pid, ...Unique);
    return num(result.changes);
}

export async function deleteDisabledModelsByProviderDB(providerId: string): Promise<number> {
    const result = await db
        .prepare("DELETE FROM disabled_models WHERE provider_id = ?")
        .run(providerId.toLowerCase());
    return num(result.changes);
}
