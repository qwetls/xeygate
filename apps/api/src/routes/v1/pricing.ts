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
// Pricing is keyed by *driver* (e.g. "openai", "anthropic"), not by
// individual connection UUID — so a creator who has 3 OpenAI keys sets the
// price once and it applies to all of them.

PricingRouter.use("/user/pricing/*", RequireCreator);
PricingRouter.use("/user/pricing", RequireCreator);

/** Group owned connections by driver key and merge model lists. */
function groupByDriver(owned: import("@srouter/types").ProviderConfig[]): Array<{
    id: string;
    providerId: string;
    name: string;
    alias?: string;
    models: string[];
}> {
    const groups = new Map<string, { id: string; providerId: string; name: string; alias?: string; models: Set<string> }>();
    for (const p of owned) {
        const key = (p.providerId || p.id).toLowerCase();
        let g = groups.get(key);
        if (!g) {
            g = { id: key, providerId: key, name: p.name || p.providerId, alias: p.alias, models: new Set() };
            groups.set(key, g);
        }
        if (p.models) {
            for (const m of p.models) g.models.add(m);
        }
    }
    return [...groups.values()].map((g) => ({
        id: g.id,
        providerId: g.providerId,
        name: g.name,
        alias: g.alias,
        models: [...g.models],
    }));
}

/** Check if the creator owns at least one connection for the given driver key. */
function ownsDriver(owned: import("@srouter/types").ProviderConfig[], driverKey: string): boolean {
    const lk = driverKey.toLowerCase();
    return owned.some((p) => (p.providerId || p.id).toLowerCase() === lk);
}

// List pricing for the creator's own providers (grouped by driver).
PricingRouter.get("/user/pricing", async (c) => {
    if (!(await getCreatorPricingEnabledDB())) {
        return Err(c, "Creator pricing is currently disabled by the administrator.", 403);
    }

    const userId = c.get("userId") as string;
    const ownedConnections = await getProvidersByOwnerDB(userId);
    const drivers = groupByDriver(ownedConnections);
    const driverKeys = drivers.map((d) => d.providerId);

    // Fetch pricing overrides that belong to any of the creator's drivers.
    const allOverrides = await listModelPricingDB();
    const ownedOverrides = allOverrides.filter((o) =>
        driverKeys.includes(o.providerId.toLowerCase())
    );

    return Ok(c, { overrides: ownedOverrides, providers: drivers });
});

// Get pricing for a specific model on a creator's driver.
PricingRouter.get("/user/pricing/detail", async (c) => {
    if (!(await getCreatorPricingEnabledDB())) {
        return Err(c, "Creator pricing is currently disabled by the administrator.", 403);
    }

    const userId = c.get("userId") as string;
    const providerId = c.req.query("providerId");
    const model = c.req.query("model");

    if (!providerId || !model) return Err(c, "providerId and model are required", 400);

    const ownedConnections = await getProvidersByOwnerDB(userId);
    if (!ownsDriver(ownedConnections, providerId)) {
        return Err(c, "You do not own this provider.", 403);
    }

    const override = await getModelPricingDB(providerId, model);
    if (!override) return Err(c, "Pricing override not found", 404);

    return Ok(c, override);
});

// Create or update pricing for a creator's driver model.
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

    const ownedConnections = await getProvidersByOwnerDB(userId);
    if (!ownsDriver(ownedConnections, body.providerId)) {
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

// Delete pricing for a creator's driver model.
PricingRouter.delete("/user/pricing", async (c) => {
    if (!(await getCreatorPricingEnabledDB())) {
        return Err(c, "Creator pricing is currently disabled by the administrator.", 403);
    }

    const userId = c.get("userId") as string;
    const providerId = c.req.query("providerId");
    const model = c.req.query("model");

    if (!providerId || !model) return Err(c, "providerId and model are required", 400);

    const ownedConnections = await getProvidersByOwnerDB(userId);
    if (!ownsDriver(ownedConnections, providerId)) {
        return Err(c, "You do not own this provider.", 403);
    }

    const deleted = await deleteModelPricingDB(providerId, model);
    if (!deleted) return Err(c, "Pricing override not found", 404);

    return Ok(c, { message: "Pricing override deleted" });
});
