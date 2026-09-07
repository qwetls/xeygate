import { db } from "./db.js";
import { generateId, num, str } from "./row-utils.js";

export interface ModelPriceOverride {
    id: string;
    providerId: string;
    model: string;
    input: number;
    output: number;
    cached?: number;
    cacheCreation?: number;
    reasoning?: number;
    updatedAt: number;
    createdAt: number;
}

interface ModelPricingRow {
    id: string;
    provider_id: string;
    model: string;
    input: number;
    output: number;
    cached: number | null;
    cache_creation: number | null;
    reasoning: number | null;
    updated_at: number;
    created_at: number;
}

function mapRow(row: ModelPricingRow): ModelPriceOverride {
    return {
        id: str(row.id),
        providerId: str(row.provider_id),
        model: str(row.model),
        input: num(row.input),
        output: num(row.output),
        cached: row.cached != null ? num(row.cached) : undefined,
        cacheCreation: row.cache_creation != null ? num(row.cache_creation) : undefined,
        reasoning: row.reasoning != null ? num(row.reasoning) : undefined,
        updatedAt: num(row.updated_at),
        createdAt: num(row.created_at)
    };
}

/**
 * Upsert a per-model pricing override. Keyed by (provider_id, model).
 */
export async function upsertModelPricingDB(data: {
    providerId: string;
    model: string;
    input: number;
    output: number;
    cached?: number;
    cacheCreation?: number;
    reasoning?: number;
}): Promise<ModelPriceOverride> {
    const now = Date.now();
    const existing = (await db
        .prepare("SELECT id FROM model_pricing WHERE provider_id = ? AND model = ?")
        .get(data.providerId, data.model)) as { id: string } | undefined;

    if (existing) {
        await db.prepare(
            `UPDATE model_pricing SET input = ?, output = ?, cached = ?, cache_creation = ?, reasoning = ?, updated_at = ?
             WHERE provider_id = ? AND model = ?`
        ).run(
            data.input,
            data.output,
            data.cached ?? null,
            data.cacheCreation ?? null,
            data.reasoning ?? null,
            now,
            data.providerId,
            data.model
        );
        const row = (await db
            .prepare("SELECT * FROM model_pricing WHERE provider_id = ? AND model = ?")
            .get(data.providerId, data.model)) as unknown as ModelPricingRow;
        return mapRow(row);
    }

    const id = generateId("price");
    await db.prepare(
        `INSERT INTO model_pricing (id, provider_id, model, input, output, cached, cache_creation, reasoning, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        data.providerId,
        data.model,
        data.input,
        data.output,
        data.cached ?? null,
        data.cacheCreation ?? null,
        data.reasoning ?? null,
        now,
        now
    );

    return {
        id,
        providerId: data.providerId,
        model: data.model,
        input: data.input,
        output: data.output,
        cached: data.cached,
        cacheCreation: data.cacheCreation,
        reasoning: data.reasoning,
        updatedAt: now,
        createdAt: now
    };
}

/**
 * Get pricing override for a specific provider+model. Returns null if no override exists.
 */
export async function getModelPricingDB(
    providerId: string,
    model: string
): Promise<ModelPriceOverride | null> {
    const row = (await db
        .prepare("SELECT * FROM model_pricing WHERE provider_id = ? AND model = ?")
        .get(providerId, model)) as unknown as ModelPricingRow | undefined;
    return row ? mapRow(row) : null;
}

/**
 * List all pricing overrides for a provider.
 */
export async function listModelPricingDB(providerId?: string): Promise<ModelPriceOverride[]> {
    const sql = providerId
        ? "SELECT * FROM model_pricing WHERE provider_id = ? ORDER BY model ASC"
        : "SELECT * FROM model_pricing ORDER BY provider_id ASC, model ASC";
    const params = providerId ? [providerId] : [];
    const rows = (await db.prepare(sql).all(...params)) as unknown as ModelPricingRow[];
    return rows.map(mapRow);
}

/**
 * Delete a pricing override. Returns true if deleted.
 */
export async function deleteModelPricingDB(
    providerId: string,
    model: string
): Promise<boolean> {
    const result = await db
        .prepare("DELETE FROM model_pricing WHERE provider_id = ? AND model = ?")
        .run(providerId, model);
    return num(result.changes) > 0;
}
