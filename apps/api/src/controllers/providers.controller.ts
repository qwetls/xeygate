import type { Context } from "hono";
import type { CreateProviderPayload } from "@/logic/providers.logic.js";
import { ProvidersLogic } from "@/logic/providers.logic.js";
import { deleteProviderDB } from "@srouter/db";
import { loadSavedProvidersFromDB, registry } from "@/services/registry.js";
import { ok } from "@/utils/response.js";

export class ProvidersController {
    public static listProviders(c: Context): Response {
        const catalog = ProvidersLogic.listProviders();
        return ok(c, {
            object: "list",
            data: catalog
        });
    }

    public static getCatalog(c: Context): Response {
        const summary = ProvidersLogic.getCatalog();
        return ok(c, summary);
    }

    public static async getProvider(c: Context): Promise<Response> {
        const providerId = c.req.param("providerId");
        if (!providerId) return c.json({ error: { message: "Provider ID is required" } }, 400);
        const provider = await ProvidersLogic.getProviderById(providerId);
        if (!provider) {
            return c.json({ error: { message: `Provider '${providerId}' not found` } }, 404);
        }
        return ok(c, provider);
    }

    public static async addProvider(c: Context): Promise<Response> {
        const body = await c.req.json<CreateProviderPayload>();
        if (!body.name || !body.category || !body.protocol) {
            return c.json({ error: { message: "Name, category, and protocol are required" } }, 400);
        }
        try {
            const created = ProvidersLogic.addProvider(body);
            return ok(c, created);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid provider payload";
            return c.json({ error: { message } }, 400);
        }
    }

    public static deleteProvider(c: Context): Response {
        const id = c.req.param("id");
        if (!id) return c.json({ error: { message: "Connection ID is required" } }, 400);
        const deleted = deleteProviderDB(id);
        if (!deleted) {
            return c.json({ error: { message: `Connection '${id}' not found` } }, 404);
        }
        registry.unregisterProvider(id);
        loadSavedProvidersFromDB();
        return ok(c, { message: "Connection deleted" });
    }

    public static async verifyProvider(c: Context): Promise<Response> {
        const body = await c.req.json<{
            protocol: "openai" | "anthropic" | "gemini" | "custom";
            baseUrl?: string;
            apiKey?: string;
        }>();

        const result = await ProvidersLogic.verifyConnection(body);
        return ok(c, result);
    }

    public static async addCustomModel(c: Context): Promise<Response> {
        const providerId = c.req.param("providerId");
        if (!providerId) return c.json({ error: { message: "Provider ID is required" } }, 400);

        const body = await c.req.json<{ modelId?: string }>();
        try {
            const model = ProvidersLogic.addCustomModel(providerId, body.modelId ?? "");
            return ok(c, model, 201);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid model payload";
            return c.json({ error: { message } }, 400);
        }
    }

    public static deleteCustomModel(c: Context): Response {
        const providerId = c.req.param("providerId");
        const modelId = c.req.param("modelId");
        if (!providerId || !modelId)
            return c.json({ error: { message: "Provider ID and model ID are required" } }, 400);

        try {
            ProvidersLogic.deleteCustomModel(providerId, decodeURIComponent(modelId));
            return ok(c, { message: "Custom model deleted" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete model";
            return c.json({ error: { message } }, 404);
        }
    }
}
