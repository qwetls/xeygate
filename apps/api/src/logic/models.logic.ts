import type { ModelObject } from "@srouter/types";
import {
    getAllCustomModelsDB,
    getAllFallbackRulesDB,
    getAllProvidersDB
} from "@srouter/db";
import { isSeedProvider, providerAlias, providerBaseId } from "@srouter/constants";
import {
    IsOfficialProviderRow,
    SelectMarketplaceRows,
    type MarketplaceScope
} from "@/logic/official.logic.js";
import { registry } from "@/services/registry.js";

export class ModelsLogic {
    public static async GetAllModels(
        Provider?: string,
        ForceRefresh = false,
        Scope: MarketplaceScope = "all"
    ): Promise<ModelObject[]> {
        const Models = await registry.listAllModels(Provider, ForceRefresh);
        const Scoped = Scope === "all" ? Models : await this.FilterModelsByScope(Models, Scope);
        const Merged = await this.MergeCustomModels(Scoped, Provider, Scope);
        return Scope === "all" ? this.MergeComboModels(Merged) : Merged;
    }

    /**
     * Keep only the native registry models whose owning connection belongs to
     * the request's marketplace namespace. Connections without a DB row
     * (built-in seed accounts) are platform supply, so they surface under
     * "official" only.
     */
    private static async FilterModelsByScope(
        Models: ModelObject[],
        Scope: Exclude<MarketplaceScope, "all">
    ): Promise<ModelObject[]> {
        const OfficialByAlias = new Map<string, boolean>();
        for (const Row of await getAllProvidersDB()) {
            const IsOfficial = await IsOfficialProviderRow(Row);
            const Alias = this.AliasForProviderId(
                (Row.providerId || Row.id).toLowerCase()
            ).toLowerCase();
            OfficialByAlias.set(Alias, IsOfficial);
        }
        return Models.filter((M) => {
            const IsOfficial = OfficialByAlias.get(M.owned_by.toLowerCase()) ?? true;
            return Scope === "official" ? IsOfficial : !IsOfficial;
        });
    }

    private static async MergeComboModels(Models: ModelObject[]): Promise<ModelObject[]> {
        const Rules = (await getAllFallbackRulesDB()).filter((Rule) => Rule.enabled);
        if (Rules.length === 0) return Models;

        const Merged = new Map<string, ModelObject>();

        for (const Model of Models) {
            Merged.set(Model.id.toLowerCase(), Model);
        }

        const ComboModels = new Set<string>();

        for (const Rule of Rules) {
            const SourceModel = Rule.sourceModel.trim();

            if (!SourceModel || SourceModel === "*" || SourceModel.endsWith("/*")) {
                continue;
            }

            ComboModels.add(SourceModel);
        }

        for (const ComboModel of ComboModels) {
            const VirtualModelId = ComboModel.startsWith("srouter/")
                ? ComboModel
                : `srouter/${ComboModel}`;

            Merged.set(ComboModel.toLowerCase(), {
                id: VirtualModelId,
                object: "model",
                owned_by: "srouter",
                custom: true
            });
        }

        return Array.from(Merged.values());
    }

    private static async MergeCustomModels(
        Models: ModelObject[],
        ProviderFilter?: string,
        Scope: MarketplaceScope = "all"
    ): Promise<ModelObject[]> {
        const Merged = new Map<string, ModelObject>();
        for (const M of Models) {
            Merged.set(M.id.toLowerCase(), M);
        }

        if (Scope === "all") {
            const Rows = await getAllCustomModelsDB();
            for (const Row of Rows) {
                const Alias = this.AliasForProviderId(Row.providerId);
                const Id = `${Alias}/${Row.modelId}`;
                if (ProviderFilter && !Alias.toLowerCase().startsWith(ProviderFilter.toLowerCase())) {
                    continue;
                }
                Merged.set(Id.toLowerCase(), {
                    id: Id,
                    object: "model",
                    owned_by: Alias,
                    custom: true
                });
            }
            return Array.from(Merged.values());
        }

        // Namespace listing: walk marketplace-eligible connections and read
        // only the rows that namespace exposes (official = shared base id
        // rows, creator = connection-scoped rows).
        const Providers = (await getAllProvidersDB()).filter(
            (P) => P.enabled && !isSeedProvider(P)
        );
        for (const P of Providers) {
            const IsOfficial = await IsOfficialProviderRow(P);
            if (Scope === "official" && !IsOfficial) continue;
            if (Scope === "user" && IsOfficial) continue;
            const Alias = this.AliasForProviderId((P.providerId || P.id).toLowerCase());
            if (ProviderFilter && !Alias.toLowerCase().startsWith(ProviderFilter.toLowerCase())) {
                continue;
            }
            for (const Row of await SelectMarketplaceRows(P, IsOfficial)) {
                const Id = `${Alias}/${Row.modelId}`;
                Merged.set(Id.toLowerCase(), {
                    id: Id,
                    object: "model",
                    owned_by: Alias,
                    custom: true
                });
            }
        }
        return Array.from(Merged.values());
    }

    /**
     * Resolve the human-facing model prefix for a provider id. Custom providers
     * carry UUID ids whose base identity is the UUID itself, so the runtime
     * alias (registered executor's alias) must win over the built-in alias
     * lookup, which would otherwise echo the UUID back as the model prefix.
     */
    private static AliasForProviderId(ProviderId: string): string {
        const Registered = registry.getAllProviders().get(ProviderId);
        if (Registered?.alias) return Registered.alias;
        return providerAlias(providerBaseId(ProviderId));
    }

    public static async GetModelById(
        ModelId: string,
        ForceRefresh = false,
        Scope: MarketplaceScope = "all"
    ): Promise<ModelObject | undefined> {
        if (!ModelId) return undefined;
        const Models = await registry.listAllModels(undefined, ForceRefresh);
        const Scoped = Scope === "all" ? Models : await this.FilterModelsByScope(Models, Scope);
        const CleanId = ModelId.replace(/^srouter\//, "");

        return Scoped.find(
            (M) =>
                M.id.replace(/^srouter\//, "") === CleanId ||
                M.id.endsWith(`/${CleanId}`) ||
                CleanId.endsWith(`/${M.id}`)
        );
    }

    public static RefreshModels(ForceRefresh = false): Promise<ModelObject[]> {
        return registry.refreshModels(ForceRefresh);
    }

    public static ClearCache(ProviderId?: string): void {
        registry.clearModelsCache(ProviderId);
    }
}
