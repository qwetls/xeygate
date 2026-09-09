import { Hono } from "hono";
import { AnalyticsController } from "@/controllers/analytics.controller.js";

/**
 * Public marketplace analytics (OpenRouter-style). Intentionally unauthenticated
 * like /v1/catalog, and aggregate-only: these endpoints expose traffic, latency
 * and quality figures, never keys, IPs, user agents or spend.
 *
 * They are not mounted inside the /user and /official namespaces — the numbers
 * describe the whole marketplace, not one supply key space.
 */
export const AnalyticsRouter = new Hono();

AnalyticsRouter.get("/analytics/overview", AnalyticsController.GetOverview);
AnalyticsRouter.get("/analytics/models", AnalyticsController.GetLeaderboard);
AnalyticsRouter.get("/analytics/models/:model{.+}", AnalyticsController.GetModelStats);
AnalyticsRouter.get("/analytics/endpoints", AnalyticsController.GetEndpointStats);
