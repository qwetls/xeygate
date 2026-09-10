import type { Context } from "hono";
import {
    MarketplaceAnalyticsQuerySchema,
    MarketplaceLeaderboardQuerySchema,
    type MarketplaceAnalyticsWindow
} from "@srouter/types";
import {
    GetEndpointStats,
    GetLeaderboard,
    GetModelStats,
    GetOverview
} from "@/logic/analytics.logic.js";
import { Err, Ok } from "@/utils/response.js";

interface ParsedWindow {
    window: MarketplaceAnalyticsWindow;
    error?: never;
}

interface WindowError {
    window?: never;
    error: string;
}

function ParseWindow(c: Context): ParsedWindow | WindowError {
    const Parsed = MarketplaceAnalyticsQuerySchema.safeParse({
        window: c.req.query("window") || undefined
    });
    if (!Parsed.success) {
        return { error: "window must be one of 24h, 7d, 30d" };
    }
    return { window: Parsed.data.window };
}

export class AnalyticsController {
    /** GET /v1/analytics/overview — public aggregate health snapshot. */
    public static async GetOverview(c: Context): Promise<Response> {
        const Parsed = MarketplaceLeaderboardQuerySchema.safeParse({
            window: c.req.query("window") || undefined,
            limit: c.req.query("limit") || undefined
        });
        if (!Parsed.success) {
            return Err(c, "window must be one of 24h, 7d, 30d and limit a number 1-100", 400);
        }
        return Ok(c, await GetOverview(Parsed.data.window, Parsed.data.limit));
    }

    /** GET /v1/analytics/models — public token-volume leaderboard. */
    public static async GetLeaderboard(c: Context): Promise<Response> {
        const Parsed = MarketplaceLeaderboardQuerySchema.safeParse({
            window: c.req.query("window") || undefined,
            limit: c.req.query("limit") || undefined
        });
        if (!Parsed.success) {
            return Err(c, "window must be one of 24h, 7d, 30d and limit a number 1-100", 400);
        }
        return Ok(c, await GetLeaderboard(Parsed.data.window, Parsed.data.limit));
    }

    /** GET /v1/analytics/models/:model — public stats page for one model. */
    public static async GetModelStats(c: Context): Promise<Response> {
        const RawModel = c.req.param("model");
        // Listing ids may contain slashes ("cx/gpt-6-astra"); the client
        // percent-encodes them, so decode before matching the stored name.
        const Model = RawModel ? decodeURIComponent(RawModel) : undefined;
        if (!Model) return Err(c, "model is required", 400);
        const ParsedWindow = ParseWindow(c);
        if (ParsedWindow.error) return Err(c, ParsedWindow.error, 400);

        const Stats = await GetModelStats(Model, ParsedWindow.window);
        if (!Stats) {
            return Err(c, `No marketplace traffic for model '${Model}' in this window`, 404, {
                code: "no_traffic"
            });
        }
        return Ok(c, Stats);
    }

    /** GET /v1/analytics/endpoints — public supply-side performance list. */
    public static async GetEndpointStats(c: Context): Promise<Response> {
        const ParsedWindow = ParseWindow(c);
        if (ParsedWindow.error) return Err(c, ParsedWindow.error, 400);
        return Ok(c, await GetEndpointStats(ParsedWindow.window));
    }
}
