import { Hono } from "hono";
import { ProvidersController } from "@/controllers/providers.controller.js";
import { RequireAdmin } from "@/middleware/AdminAuth.js";
import { RequireCreator } from "@/middleware/CreatorAuth.js";
import { ApiKeyAuth } from "@/middleware/ApiKeyAuth.js";
import { getCreatorEarningsDB, getEarningsSummaryDB } from "@srouter/db";
import { Ok } from "@/utils/response.js";

export const ProvidersRouter = new Hono();

// Creator-scoped management (session cookie + creator role).
// Registered before the ":providerId" wildcard so "mine" is not captured as an ID.
ProvidersRouter.get("/providers/mine", RequireCreator, ProvidersController.ListMyProviders);
ProvidersRouter.post("/providers/mine", RequireCreator, ProvidersController.AddMyProvider);
ProvidersRouter.delete("/providers/mine/:id", RequireCreator, ProvidersController.DeleteMyProvider);

// Creator earnings dashboard.
ProvidersRouter.get("/providers/mine/earnings", RequireCreator, async (c) => {
    const userId = c.get("userId") as string;
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
    const [earnings, summary] = await Promise.all([
        getCreatorEarningsDB(userId, limit, offset),
        getEarningsSummaryDB(userId)
    ]);
    return Ok(c, { earnings, summary });
});

// Provider catalog is model-discovery data (same sensitivity as GET /models),
// so it stays on ApiKeyAuth — clients need it to discover routable models.
ProvidersRouter.get("/providers", ApiKeyAuth, ProvidersController.ListProviders);
ProvidersRouter.get("/providers/catalog", ApiKeyAuth, ProvidersController.GetCatalog);
ProvidersRouter.get("/providers/:providerId", ApiKeyAuth, ProvidersController.GetProvider);

// Mutation endpoints require Admin Auth
ProvidersRouter.post("/providers/verify", RequireAdmin, ProvidersController.VerifyProvider);
ProvidersRouter.post("/providers", RequireAdmin, ProvidersController.AddProvider);
ProvidersRouter.delete("/providers/:id", RequireAdmin, ProvidersController.DeleteProvider);

// Custom (user-added) models per provider driver
ProvidersRouter.post(
    "/providers/:providerId/models",
    RequireAdmin,
    ProvidersController.AddCustomModel
);
ProvidersRouter.delete(
    "/providers/:providerId/models/:modelId{.+}",
    RequireAdmin,
    ProvidersController.DeleteCustomModel
);

// Round-robin load balancing toggle
ProvidersRouter.patch(
    "/providers/:providerId/round-robin",
    RequireAdmin,
    ProvidersController.ToggleRoundRobin
);
