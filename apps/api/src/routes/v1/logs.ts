import { Hono } from "hono";
import { LogsController } from "@/controllers/logs.controller.js";
import { RequireAdmin } from "@/middleware/AdminAuth.js";

export const LogsRouter = new Hono();

LogsRouter.get("/logs", RequireAdmin, LogsController.ListLogs);
LogsRouter.get("/logs/stats", RequireAdmin, LogsController.GetStats);
LogsRouter.get("/logs/analytics", RequireAdmin, LogsController.GetAnalytics);
