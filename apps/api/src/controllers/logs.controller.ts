import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { LogsLogic } from "@/logic/logs.logic.js";
import { Ok } from "@/utils/response.js";
import { AnalyticsQuerySchema } from "@srouter/types";

export class LogsController {
    public static async ListLogs(c: Context): Promise<Response> {
        const limit = Number(c.req.query("limit")) || 50;
        return Ok(c, {
            object: "list",
            data: await LogsLogic.getRecentLogs(limit)
        });
    }

    public static async GetStats(c: Context): Promise<Response> {
        return Ok(c, await LogsLogic.getUsageStats());
    }

    public static async GetAnalytics(c: Context): Promise<Response> {
        const Query = c.req.query("window") || "24h";
        const Result = AnalyticsQuerySchema.safeParse({ window: Query });
        if (!Result.success) {
            throw new HTTPException(400, { message: "Invalid window parameter" });
        }
        return Ok(c, await LogsLogic.getAnalytics(Result.data.window));
    }
}
