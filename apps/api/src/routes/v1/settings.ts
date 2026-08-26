import { Hono } from "hono";
import { SettingsController } from "@/controllers/settings.controller.js";
import { TokenSaverController } from "@/controllers/tokenSaver.controller.js";
import { FallbacksController } from "@/controllers/fallbacks.controller.js";
import { RequireAdmin } from "@/middleware/AdminAuth.js";
import { ApiKeyAuth } from "@/middleware/ApiKeyAuth.js";

export const SettingsRouter = new Hono();

SettingsRouter.get("/settings", ApiKeyAuth, SettingsController.GetSettings);
SettingsRouter.get("/settings/token-saver", ApiKeyAuth, TokenSaverController.GetSettings);
SettingsRouter.get("/settings/fallbacks", ApiKeyAuth, FallbacksController.GetFallbacks);

// Mutations require an authenticated admin session
SettingsRouter.patch("/settings", RequireAdmin, SettingsController.UpdateSettings);
SettingsRouter.post("/settings", RequireAdmin, SettingsController.UpdateSettings);
SettingsRouter.patch("/settings/token-saver", RequireAdmin, TokenSaverController.UpdateSettings);
SettingsRouter.put("/settings/token-saver", RequireAdmin, TokenSaverController.UpdateSettings);
SettingsRouter.post("/settings/token-saver/test", RequireAdmin, TokenSaverController.Preview);
SettingsRouter.post("/settings/fallbacks", RequireAdmin, FallbacksController.CreateFallback);
SettingsRouter.put("/settings/fallbacks/:id", RequireAdmin, FallbacksController.UpdateFallback);
SettingsRouter.patch("/settings/fallbacks/:id", RequireAdmin, FallbacksController.UpdateFallback);
SettingsRouter.delete("/settings/fallbacks/:id", RequireAdmin, FallbacksController.DeleteFallback);
