import { Hono } from "hono";
import { QuotaController } from "@/controllers/quota.controller.js";
import { ApiKeyAuth } from "@/middleware/ApiKeyAuth.js";

export const QuotaRouter = new Hono();

QuotaRouter.get("/quota", ApiKeyAuth, QuotaController.GetQuota);
QuotaRouter.get("/qouta", ApiKeyAuth, QuotaController.GetQuota);
