import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
    ModelObject,
    ProviderCategory,
    ProviderDefinition,
    ProviderProtocol
} from "@srouter/types";

export interface AddConnectionPayload {
    id?: string;
    name: string;
    category: ProviderCategory;
    protocol: ProviderProtocol;
    base_url?: string;
    api_key?: string;
}

export interface BulkAddKeysPayload {
    provider_id: string;
    name: string;
    category: ProviderCategory;
    protocol: ProviderProtocol;
    base_url?: string;
    api_keys: string[];
}

export interface BulkAddKeysResult {
    requested: number;
    added: number;
    skipped: number;
    connections: Array<{ id: string; name: string }>;
}

export interface DisabledModelEntry {
    model_id: string;
    disabled_by: string;
    reason: string | null;
    disabled_at: number;
}

/**
 * Loads a provider definition and exposes add/delete connection mutations with
 * query invalidation for both the detail view and the catalog.
 */
export function useProvider(providerId: string) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["providers", providerId],
        queryFn: () => api.get<ProviderDefinition>(`/v1/providers/${providerId}`),
        enabled: Boolean(providerId)
    });

    const addMutation = useMutation({
        mutationFn: (payload: AddConnectionPayload) =>
            api.post<ProviderDefinition>("/v1/providers", payload),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
            void queryClient.invalidateQueries({ queryKey: ["providers", "catalog"] });
            void queryClient.invalidateQueries({ queryKey: ["models"] });
            toast.success(`Connection "${variables.name}" saved successfully`);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to save connection");
        }
    });

    const bulkAddMutation = useMutation({
        mutationFn: (payload: BulkAddKeysPayload) =>
            api.post<BulkAddKeysResult>("/v1/providers/bulk", payload),
        onSuccess: (data) => {
            void queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
            void queryClient.invalidateQueries({ queryKey: ["providers", "catalog"] });
            void queryClient.invalidateQueries({ queryKey: ["models"] });
            const suffix = data.skipped > 0 ? ` (${data.skipped} duplicate skipped)` : "";
            if (data.added > 0) {
                toast.success(`Added ${data.added} key${data.added === 1 ? "" : "s"}${suffix}`);
            } else {
                toast.info("No new keys added — all were duplicates");
            }
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to add keys");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (connectionId: string) =>
            api.delete<{ message: string }>(`/v1/providers/${connectionId}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
            void queryClient.invalidateQueries({ queryKey: ["providers", "catalog"] });
            void queryClient.invalidateQueries({ queryKey: ["models"] });
            toast.success("Connection deleted successfully");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to delete connection");
        }
    });

    const toggleRoundRobinMutation = useMutation({
        mutationFn: (enabled: boolean) =>
            api.patch<ProviderDefinition>(`/v1/providers/${providerId}/round-robin`, { enabled }),
        onSuccess: (data) => {
            void queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
            void queryClient.invalidateQueries({ queryKey: ["providers", "catalog"] });
            toast.success(
                data.roundRobin ? "Round-robin load balancing enabled" : "Round-robin load balancing disabled"
            );
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to update round-robin mode");
        }
    });

    const addModelMutation = useMutation({
        mutationFn: (modelId: string) =>
            api.post<ModelObject>(`/v1/providers/${providerId}/models`, { model_id: modelId }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
            void queryClient.invalidateQueries({ queryKey: ["models"] });
            toast.success("Custom model added");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to add custom model");
        }
    });

    const deleteModelMutation = useMutation({
        mutationFn: (modelId: string) =>
            api.delete<{ message: string }>(
                `/v1/providers/${providerId}/models/${encodeURIComponent(modelId)}`
            ),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
            void queryClient.invalidateQueries({ queryKey: ["models"] });
            toast.success("Custom model deleted");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to delete custom model");
        }
    });

    const addModelsBulkMutation = useMutation({
        mutationFn: (modelIds: string[]) =>
            api.post<{ added: number }>(`/v1/providers/${providerId}/models/bulk`, {
                models: modelIds
            }),
        onSuccess: (data) => {
            void queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
            void queryClient.invalidateQueries({ queryKey: ["models"] });
            toast.success(`Added ${data.added} model${data.added === 1 ? "" : "s"} to the catalog`);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to add models");
        }
    });

    const deleteModelsBulkMutation = useMutation({
        mutationFn: (modelIds: string[]) =>
            api.post<{ deleted: number }>(`/v1/providers/${providerId}/models/bulk-delete`, {
                models: modelIds
            }),
        onSuccess: (data) => {
            void queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
            void queryClient.invalidateQueries({ queryKey: ["models"] });
            toast.success(`Removed ${data.deleted} model${data.deleted === 1 ? "" : "s"} from the catalog`);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to delete models");
        }
    });

    /**
     * Server-side disable rules for this endpoint. The provider detail view
     * already carries the `disabled` flag per model; this query adds the
     * governance metadata (who disabled it, when, why).
     */
    const disabledModelsQuery = useQuery({
        queryKey: ["providers", providerId, "disabled-models"],
        queryFn: () =>
            api.get<{ object: "list"; data: DisabledModelEntry[] }>(
                `/v1/providers/${providerId}/models/disabled`
            ),
        enabled: Boolean(providerId)
    });

    const invalidateModelLists = () => {
        void queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
        void queryClient.invalidateQueries({
            queryKey: ["providers", providerId, "disabled-models"]
        });
        void queryClient.invalidateQueries({ queryKey: ["providers", "catalog"] });
        void queryClient.invalidateQueries({ queryKey: ["models"] });
    };

    const disableModelMutation = useMutation({
        mutationFn: (payload: { modelId: string; reason?: string }) =>
            api.post<{ model: string }>(`/v1/providers/${providerId}/models/disable`, {
                model_id: payload.modelId,
                reason: payload.reason
            }),
        onSuccess: (data) => {
            invalidateModelLists();
            toast.success(`Model "${data.model}" disabled — it no longer serves traffic`);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to disable model");
        }
    });

    const enableModelMutation = useMutation({
        mutationFn: (modelId: string) =>
            api.post<{ model: string }>(`/v1/providers/${providerId}/models/enable`, {
                model_id: modelId
            }),
        onSuccess: () => {
            invalidateModelLists();
            toast.success("Model enabled — routing restored");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to enable model");
        }
    });

    const disableModelsBulkMutation = useMutation({
        mutationFn: (payload: { modelIds: string[]; reason?: string }) =>
            api.post<{ disabled: number }>(
                `/v1/providers/${providerId}/models/bulk-disable`,
                { models: payload.modelIds, reason: payload.reason }
            ),
        onSuccess: (data) => {
            invalidateModelLists();
            toast.success(
                `Disabled ${data.disabled} model${data.disabled === 1 ? "" : "s"} — they no longer serve traffic`
            );
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to disable models");
        }
    });

    const enableModelsBulkMutation = useMutation({
        mutationFn: (modelIds: string[]) =>
            api.post<{ enabled: number }>(`/v1/providers/${providerId}/models/bulk-enable`, {
                models: modelIds
            }),
        onSuccess: (data) => {
            invalidateModelLists();
            toast.success(`Enabled ${data.enabled} model${data.enabled === 1 ? "" : "s"}`);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to enable models");
        }
    });

    return {
        ...query,
        disabledModels: disabledModelsQuery,
        addMutation,
        bulkAddMutation,
        deleteMutation,
        toggleRoundRobinMutation,
        addModelMutation,
        deleteModelMutation,
        addModelsBulkMutation,
        deleteModelsBulkMutation,
        disableModelMutation,
        enableModelMutation,
        disableModelsBulkMutation,
        enableModelsBulkMutation
    };
}
