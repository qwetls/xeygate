import { Hono } from "hono";
import { ProvidersController } from "@/controllers/providers.controller.js";
import { RequireAdmin } from "@/middleware/AdminAuth.js";

export const ProvidersRouter = new Hono();

ProvidersRouter.get("/providers", RequireAdmin, ProvidersController.ListProviders);
ProvidersRouter.get("/providers/catalog", RequireAdmin, ProvidersController.GetCatalog);
ProvidersRouter.get("/providers/:providerId", RequireAdmin, ProvidersController.GetProvider);

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
