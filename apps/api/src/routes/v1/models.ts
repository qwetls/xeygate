import { Hono } from "hono";
import { ModelsController } from "@/controllers/models.controller.js";
import { ApiKeyAuth } from "@/middleware/ApiKeyAuth.js";

export const ModelsRouter = new Hono();

ModelsRouter.get("/models", ApiKeyAuth, ModelsController.ListModels);
ModelsRouter.get("/models/:model{.+}", ApiKeyAuth, ModelsController.GetModelById);
