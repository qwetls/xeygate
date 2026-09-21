import { Hono } from "hono";
import { AdminPlansController } from "@/controllers/adminPlans.controller.js";
import { RequireAdmin } from "@/middleware/AdminAuth.js";

export const PlansRouter = new Hono();

// Public feed for the /plans marketing page — display fields only.
PlansRouter.get("/plans", AdminPlansController.PublicPlans);

PlansRouter.get("/admin/plans", RequireAdmin, AdminPlansController.ListPlans);
PlansRouter.put("/admin/plans/:plan", RequireAdmin, AdminPlansController.UpdatePlan);
