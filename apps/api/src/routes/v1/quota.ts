import { Hono } from "hono";
import { QuotaController } from "@/controllers/quota.controller.js";
import { RequireAdmin } from "@/middleware/AdminAuth.js";

export const QuotaRouter = new Hono();

QuotaRouter.get("/quota", RequireAdmin, QuotaController.GetQuota);
QuotaRouter.get("/qouta", RequireAdmin, QuotaController.GetQuota);
