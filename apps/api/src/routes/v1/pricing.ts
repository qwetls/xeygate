import { Hono } from "hono";
import { RequireAdmin } from "@/middleware/AdminAuth.js";
import { RequireCreator } from "@/middleware/CreatorAuth.js";
import {
    upsertModelPricingDB,
    getModelPricingDB,
    listModelPricingDB,
    deleteModelPricingDB,
    getProvidersByOwnerDB,
    getCreatorPricingEnabledDB
} from "@srouter/db";
import { Err, Ok } from "@/utils/response.js";

export const PricingRouter = new Hono();

// ── Admin Pricing Routes ──────────────────────────────────────────────
// All admin pricing routes require Admin Auth.
PricingRouter.use("/admin/pricing/*", RequireAdmin);
PricingRouter.use("/admin/pricing", RequireAdmin);

// List all pricing overrides (optionally filtered by providerId).
PricingRouter.get("/admin/pricing", async (c) => {
    const providerId = c.req.query("providerId") ?? undefined;
    const overrides = await listModelPricingDB(providerId);
    return Ok(c, { overrides });
});

// Get pricing override for a specific provider+model.
PricingRouter.get("/admin/pricing/detail", async (c) => {
    const providerId = c.req.query("providerId");
    const model = c.req.query("model");
    if (!providerId || !model) return Err(c, "providerId and model are required", 400);
    const override = await getModelPricingDB(providerId, model);
    if (!override) return Err(c, "Pricing override not found", 404);
    return Ok(c, override);
});

// Create or update pricing override.
PricingRouter.put("/admin/pricing", async (c) => {
    const body = await c.req.json<{
        providerId?: string;
        model?: string;
        input?: number;
        output?: number;
        cached?: number;
        cacheCreation?: number;
        reasoning?: number;
    }>().catch(() => ({}));

    if (!body.providerId || !body.model) return Err(c, "providerId and model are required", 400);
    if (typeof body.input !== "number" || typeof body.output !== "number") {
        return Err(c, "input and output rates (per million tokens) are required", 400);
    }

    const override = await upsertModelPricingDB({
        providerId: body.providerId,
        model: body.model,
        input: body.input,
        output: body.output,
        cached: body.cached,
        cacheCreation: body.cacheCreation,
        reasoning: body.reasoning,
    });
    return Ok(c, override);
});

// Delete pricing override.
PricingRouter.delete("/admin/pricing", async (c) => {
    const providerId = c.req.query("providerId");
    const model = c.req.query("model");
    if (!providerId || !model) return Err(c, "providerId and model are required", 400);
    const deleted = await deleteModelPricingDB(providerId, model);
    if (!deleted) return Err(c, "Pricing override not found", 404);
    return Ok(c, { message: "Pricing override deleted" });
});

// ── Creator Pricing Routes ──────────────────────────────────────────────
// Creator pricing is gated by the `creator_pricing_enabled` system setting.
// Creators can only set pricing for their own provider connections.

PricingRouter.use("/user/pricing/*", RequireCreator);
PricingRouter.use("/user/pricing", RequireCreator);

// List pricing for the creator's own providers.
PricingRouter.get("/user/pricing", async (c) => {
    if (!(await getCreatorPricingEnabledDB())) {
        return Err(c, "Creator pricing is currently disabled by the administrator.", 403);
    }

    const userId = c.get("userId") as string;
    const ownedProviders = await getProvidersByOwnerDB(userId);
    const ownedIds = ownedProviders.map((p) => p.id);

    // Fetch all pricing overrides and filter for owned providers.
    const allOverrides = await listModelPricingDB();
    const ownedOverrides = allOverrides.filter((o) => ownedIds.includes(o.providerId));

    return Ok(c, { overrides: ownedOverrides, providers: ownedProviders });
});

// Get pricing for a specific model on a creator's provider.
PricingRouter.get("/user/pricing/detail", async (c) => {
    if (!(await getCreatorPricingEnabledDB())) {
        return Err(c, "Creator pricing is currently disabled by the administrator.", 403);
    }

    const userId = c.get("userId") as string;
    const providerId = c.req.query("providerId");
    const model = c.req.query("model");

    if (!providerId || !model) return Err(c, "providerId and model are required", 400);

    const ownedProviders = await getProvidersByOwnerDB(userId);
    if (!ownedProviders.some((p) => p.id === providerId)) {
        return Err(c, "You do not own this provider.", 403);
    }

    const override = await getModelPricingDB(providerId, model);
    if (!override) return Err(c, "Pricing override not found", 404);

    return Ok(c, override);
});

// Create or update pricing for a creator's provider model.
PricingRouter.put("/user/pricing", async (c) => {
    if (!(await getCreatorPricingEnabledDB())) {
        return Err(c, "Creator pricing is currently disabled by the administrator.", 403);
    }

    const userId = c.get("userId") as string;
    const body = await c.req.json<{
        providerId?: string;
        model?: string;
        input?: number;
        output?: number;
        cached?: number;
        cacheCreation?: number;
        reasoning?: number;
    }>().catch(() => ({}));

    if (!body.providerId || !body.model) return Err(c, "providerId and model are required", 400);
    if (typeof body.input !== "number" || typeof body.output !== "number") {
        return Err(c, "input and output rates (per million tokens) are required", 400);
    }

    const ownedProviders = await getProvidersByOwnerDB(userId);
    if (!ownedProviders.some((p) => p.id === body.providerId)) {
        return Err(c, "You do not own this provider.", 403);
    }

    const override = await upsertModelPricingDB({
        providerId: body.providerId,
        model: body.model,
        input: body.input,
        output: body.output,
        cached: body.cached,
        cacheCreation: body.cacheCreation,
        reasoning: body.reasoning,
    });
    return Ok(c, override);
});

// Delete pricing for a creator's provider model.
PricingRouter.delete("/user/pricing", async (c) => {
    if (!(await getCreatorPricingEnabledDB())) {
        return Err(c, "Creator pricing is currently disabled by the administrator.", 403);
    }

    const userId = c.get("userId") as string;
    const providerId = c.req.query("providerId");
    const model = c.req.query("model");

    if (!providerId || !model) return Err(c, "providerId and model are required", 400);

    const ownedProviders = await getProvidersByOwnerDB(userId);
    if (!ownedProviders.some((p) => p.id === providerId)) {
        return Err(c, "You do not own this provider.", 403);
    }

    const deleted = await deleteModelPricingDB(providerId, model);
    if (!deleted) return Err(c, "Pricing override not found", 404);

    return Ok(c, { message: "Pricing override deleted" });
});
