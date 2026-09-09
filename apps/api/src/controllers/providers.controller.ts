import type { Context } from "hono";
import type { CreateProviderPayload } from "@/logic/providers.logic.js";
import type { ProviderConfig } from "@srouter/types";
import { ProvidersLogic } from "@/logic/providers.logic.js";
import { deleteProviderDB, getProviderByIdDB } from "@srouter/db";
import { AddCustomModelSchema, BulkDisableModelsSchema, BulkModelsSchema, CreateProviderSchema, DisableModelSchema, ToggleRoundRobinSchema, UpdateMyProviderSchema, VerifyProviderSchema } from "@srouter/types";
import { loadSavedProvidersFromDB, registry } from "@/services/registry.js";
import { Err, Ok } from "@/utils/response.js";

function SanitizedProvider(config: ProviderConfig): Record<string, unknown> {
    const { apiKey, accessToken, refreshToken, ...rest } = config;
    void apiKey; void accessToken; void refreshToken;
    return rest as Record<string, unknown>;
}

export class ProvidersController {
    public static async ListProviders(c: Context): Promise<Response> {
        return Ok(c, {
            object: "list",
            data: await ProvidersLogic.ListProviders()
        });
    }

    public static async GetCatalog(c: Context): Promise<Response> {
        return Ok(c, await ProvidersLogic.GetCatalog());
    }

    public static async GetProvider(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const Provider = await ProvidersLogic.GetProviderById(ProviderId);
        if (!Provider) {
            return Err(c, `Provider '${ProviderId}' not found`, 404);
        }
        // Connections carry decrypted credentials for internal routing — never
        // expose them on the public (ApiKeyAuth) discovery endpoint.
        if (Array.isArray(Provider.connections)) {
            Provider.connections = Provider.connections.map(
                (Conn) => SanitizedProvider(Conn) as unknown as ProviderConfig
            );
        }
        return Ok(c, Provider);
    }

    public static async AddProvider(c: Context): Promise<Response> {
        const RawBody = await c.req.json().catch(() => null);
        const Parsed = CreateProviderSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid provider payload", 400);
        }

        try {
            const Created = await ProvidersLogic.AddProvider(
                Parsed.data as CreateProviderPayload,
                c.get("userId") as string | undefined
            );
            return Ok(c, Created);
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Invalid provider payload", 400);
        }
    }

    public static async DeleteProvider(c: Context): Promise<Response> {
        const Id = c.req.param("id");
        if (!Id) return Err(c, "Connection ID is required", 400);
        if (!(await deleteProviderDB(Id))) {
            return Err(c, `Connection '${Id}' not found`, 404);
        }

        registry.unregisterProvider(Id);
        await loadSavedProvidersFromDB();
        return Ok(c, { message: "Connection deleted" });
    }

    public static async VerifyProvider(c: Context): Promise<Response> {
        const RawBody = await c.req.json().catch(() => null);
        const Parsed = VerifyProviderSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid verification payload", 400);
        }

        const Result = await ProvidersLogic.VerifyConnection(Parsed.data);
        return Ok(c, Result);
    }

    public static async AddCustomModel(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const RawBody = await c.req.json().catch(() => null);
        const Parsed = AddCustomModelSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid model payload", 400);
        }

        try {
            const Model = await ProvidersLogic.AddCustomModel(ProviderId, Parsed.data.model_id);
            return Ok(c, Model, 201);
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Invalid model payload", 400);
        }
    }

    public static async DeleteCustomModel(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        const ModelId = c.req.param("modelId");
        if (!ProviderId || !ModelId) {
            return Err(c, "Provider ID and model ID are required", 400);
        }

        try {
            await ProvidersLogic.DeleteCustomModel(ProviderId, decodeURIComponent(ModelId));
            return Ok(c, { message: "Custom model deleted" });
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Failed to delete model", 404);
        }
    }

    public static async AddCustomModelsBulk(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const RawBody = await c.req.json().catch(() => null);
        const Parsed = BulkModelsSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid models payload", 400);
        }

        try {
            const Result = await ProvidersLogic.AddCustomModels(ProviderId, Parsed.data.models);
            return Ok(c, Result, 201);
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Invalid models payload", 400);
        }
    }

    public static async DeleteCustomModelsBulk(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const RawBody = await c.req.json().catch(() => null);
        const Parsed = BulkModelsSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid models payload", 400);
        }

        try {
            const Result = await ProvidersLogic.DeleteCustomModels(ProviderId, Parsed.data.models);
            return Ok(c, Result);
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Failed to delete models", 400);
        }
    }

    public static async ToggleRoundRobin(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const RawBody = await c.req.json().catch(() => null);
        const Parsed = ToggleRoundRobinSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid payload", 400);
        }

        try {
            const Result = await ProvidersLogic.SetRoundRobin(ProviderId, Parsed.data.enabled);
            return Ok(c, Result);
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Failed to toggle round-robin mode", 400);
        }
    }

    // Server-side model disable rules. The model id travels in the body —
    // upstream ids legitimately contain slashes, which cannot be a path param
    // without colliding with the action segment.
    public static async DisableModel(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const RawBody = await c.req.json().catch(() => null);
        const Parsed = DisableModelSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid model payload", 400);
        }

        try {
            const Row = await ProvidersLogic.DisableModel(
                ProviderId,
                Parsed.data.model_id,
                (c.get("userId") as string) || "admin",
                Parsed.data.reason
            );
            return Ok(c, {
                object: "model.disable",
                provider: ProviderId.toLowerCase(),
                model: Row.modelId,
                disabled: true,
                disabled_at: Row.createdAt,
                reason: Row.reason ?? null
            });
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Failed to disable model", 400);
        }
    }

    public static async EnableModel(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const RawBody = await c.req.json().catch(() => null);
        const Parsed = DisableModelSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid model payload", 400);
        }

        try {
            await ProvidersLogic.EnableModel(ProviderId, Parsed.data.model_id);
            return Ok(c, {
                object: "model.disable",
                provider: ProviderId.toLowerCase(),
                model: Parsed.data.model_id,
                disabled: false
            });
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Failed to enable model", 400);
        }
    }

    public static async ListDisabledModels(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const Rows = await ProvidersLogic.ListDisabledModels(ProviderId);
        return Ok(c, {
            object: "list",
            data: Rows.map((R) => ({
                model_id: R.modelId,
                disabled_by: R.disabledBy,
                reason: R.reason ?? null,
                disabled_at: R.createdAt
            }))
        });
    }

    public static async DisableModelsBulk(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const RawBody = await c.req.json().catch(() => null);
        const Parsed = BulkDisableModelsSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid models payload", 400);
        }

        try {
            const Result = await ProvidersLogic.DisableModels(
                ProviderId,
                Parsed.data.models,
                (c.get("userId") as string) || "admin",
                Parsed.data.reason
            );
            return Ok(c, { object: "list.disable", provider: ProviderId.toLowerCase(), ...Result });
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Failed to disable models", 400);
        }
    }

    public static async EnableModelsBulk(c: Context): Promise<Response> {
        const ProviderId = c.req.param("providerId");
        if (!ProviderId) return Err(c, "Provider ID is required", 400);

        const RawBody = await c.req.json().catch(() => null);
        const Parsed = BulkModelsSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid models payload", 400);
        }

        try {
            const Result = await ProvidersLogic.EnableModels(ProviderId, Parsed.data.models);
            return Ok(c, { object: "list.enable", provider: ProviderId.toLowerCase(), ...Result });
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Failed to enable models", 400);
        }
    }

    // ── Creator-scoped provider management ──

    public static async ListMyProviders(c: Context): Promise<Response> {
        const userId = c.get("userId") as string;
        const providers = await ProvidersLogic.ListMyProviders(userId);
        return Ok(c, { object: "list", data: providers.map(SanitizedProvider) });
    }

    public static async AddMyProvider(c: Context): Promise<Response> {
        const userId = c.get("userId") as string;
        const RawBody = await c.req.json().catch(() => null);
        const Parsed = CreateProviderSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid provider payload", 400);
        }

        try {
            const Created = await ProvidersLogic.AddProvider(
                Parsed.data as CreateProviderPayload,
                userId
            );
            return Ok(c, Created);
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Invalid provider payload", 400);
        }
    }

    public static async DeleteMyProvider(c: Context): Promise<Response> {
        const userId = c.get("userId") as string;
        const Id = c.req.param("id");
        if (!Id) return Err(c, "Connection ID is required", 400);

        const Existing = await getProviderByIdDB(Id);
        if (!Existing || Existing.ownerId !== userId) {
            return Err(c, `Connection '${Id}' not found`, 404);
        }

        await deleteProviderDB(Id);
        registry.unregisterProvider(Id);
        await loadSavedProvidersFromDB();
        return Ok(c, { message: "Connection deleted" });
    }

    public static async UpdateMyProvider(c: Context): Promise<Response> {
        const userId = c.get("userId") as string;
        const Id = c.req.param("id");
        if (!Id) return Err(c, "Connection ID is required", 400);

        const Existing = await getProviderByIdDB(Id);
        if (!Existing || Existing.ownerId !== userId) {
            return Err(c, `Connection '${Id}' not found`, 404);
        }

        const RawBody = await c.req.json().catch(() => null);
        const Parsed = UpdateMyProviderSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid provider update payload", 400);
        }

        try {
            const Updated = await ProvidersLogic.UpdateMyProvider(Existing, Parsed.data);
            return Ok(c, SanitizedProvider(Updated));
        } catch (error) {
            return Err(c, error instanceof Error ? error.message : "Invalid provider update payload", 400);
        }
    }

    public static async VerifyMyProvider(c: Context): Promise<Response> {
        const RawBody = await c.req.json().catch(() => null);
        const Parsed = VerifyProviderSchema.safeParse(RawBody);
        if (!Parsed.success) {
            return Err(c, Parsed.error.issues[0]?.message || "Invalid verification payload", 400);
        }

        const Result = await ProvidersLogic.VerifyConnection(Parsed.data);
        return Ok(c, Result);
    }
}