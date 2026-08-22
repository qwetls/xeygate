import type { ModelObject } from "@srouter/types";
import { getAllCustomModelsDB } from "@srouter/db";
import { providerAlias, providerBaseId } from "@srouter/constants";
import { registry } from "@/services/registry.js";

export class ModelsLogic {
    public static async getAllModels(
        provider?: string,
        forceRefresh = false
    ): Promise<ModelObject[]> {
        const models = await registry.listAllModels(provider, forceRefresh);
        return this.mergeCustomModels(models, provider);
    }

    /**
     * Merge user-added custom models into the live model list. Custom entries
     * are keyed by their provider alias prefix and win over duplicates.
     */
    private static mergeCustomModels(
        models: ModelObject[],
        providerFilter?: string
    ): ModelObject[] {
        const rows = getAllCustomModelsDB();
        if (rows.length === 0) return models;

        const merged = new Map<string, ModelObject>();
        for (const m of models) {
            merged.set(m.id.toLowerCase(), m);
        }
        for (const row of rows) {
            const alias = providerAlias(providerBaseId(row.providerId));
            const id = `${alias}/${row.modelId}`;
            if (providerFilter && !alias.toLowerCase().startsWith(providerFilter.toLowerCase())) {
                continue;
            }
            merged.set(id.toLowerCase(), { id, object: "model", owned_by: alias, custom: true });
        }
        return Array.from(merged.values());
    }

    public static async getModelById(
        modelId: string,
        forceRefresh = false
    ): Promise<ModelObject | undefined> {
        if (!modelId) return undefined;
        const models = await registry.listAllModels(undefined, forceRefresh);

        const cleanId = modelId.replace(/^srouter\//, "");

        // Direct match or clean / prefix match
        const match = models.find(
            (m) =>
                m.id === modelId ||
                m.id === cleanId ||
                m.id.replace(/^srouter\//, "") === cleanId ||
                m.id.endsWith(`/${cleanId}`) ||
                cleanId.endsWith(`/${m.id}`)
        );
        return match;
    }

    public static refreshModels(forceRefresh = false): Promise<ModelObject[]> {
        return registry.refreshModels(forceRefresh);
    }

    public static clearCache(providerId?: string): void {
        registry.clearModelsCache(providerId);
    }
}
