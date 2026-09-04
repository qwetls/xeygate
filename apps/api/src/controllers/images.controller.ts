import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ImageGenerationRequest } from "@srouter/types";
import { ImagesLogic } from "@/logic/images.logic.js";

export class ImagesController {
    public static async generate(c: Context) {
        const body = c.req.valid("json" as never) as ImageGenerationRequest;
        const apiKeyRow = c.get("apiKeyRow");
        const clientIp =
            c.req.header("cf-connecting-ip") ||
            c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
            "127.0.0.1";
        const userAgent = c.req.header("user-agent");

        try {
            const response = await ImagesLogic.generate(
                body,
                Date.now(),
                apiKeyRow?.id,
                clientIp,
                userAgent
            );
            return c.json(response);
        } catch (err: unknown) {
            if (err instanceof HTTPException) {
                throw err;
            }
            const message = err instanceof Error ? err.message : String(err);
            throw new HTTPException(500, {
                message: JSON.stringify({
                    error: {
                        message,
                        type: "server_error",
                        code: "image_generation_failed"
                    }
                })
            });
        }
    }
}
