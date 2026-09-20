import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { ChatCompletionRequest, APIKeyZod } from "@srouter/types";
import { ChatLogic } from "@/logic/chat.logic.js";
import type { MarketplaceScope } from "@/logic/official.logic.js";
import {
    EnsureRequestId,
    Err,
    FormatErrorPayload,
    LogUpstreamFailure,
    Ok,
    PublicInferenceError
} from "@/utils/response.js";

function NormalizeDeveloperRole(Body: ChatCompletionRequest): ChatCompletionRequest {
    for (const msg of Body.messages) {
        if (msg.role === "developer") msg.role = "system";
    }
    return Body;
}

export class ChatController {
    public static async CreateCompletion(c: Context): Promise<Response> {
        const StartTime = Date.now();
        EnsureRequestId(c);
        const Body = NormalizeDeveloperRole(
            c.req.valid("json" as never) as ChatCompletionRequest
        );
        const ApiKeyRow = c.get("apiKeyRow") as APIKeyZod | undefined;
        const ApiKeyId = ApiKeyRow?.id;
        const userAgent = c.req.header("user-agent");
        const rawIp =
            c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
            c.req.header("x-real-ip") ||
            c.req.header("cf-connecting-ip") ||
            "127.0.0.1";
        const marketplaceScope = (c.get("marketplaceScope") as MarketplaceScope | undefined) ?? "all";

        if (Body.stream) {
            c.header("Content-Type", "text/event-stream");
            c.header("Cache-Control", "no-cache, no-transform");
            c.header("Connection", "keep-alive");
            c.header("X-Accel-Buffering", "no");
            return streamSSE(c, async (stream) => {
                try {
                    const Generator = ChatLogic.ProcessStreamingCompletion(
                        Body,
                        StartTime,
                        0,
                        ApiKeyId,
                        rawIp,
                        userAgent,
                        marketplaceScope
                    );
                    for await (const Chunk of Generator) {
                        await stream.writeSSE({
                            data: JSON.stringify(Chunk)
                        });
                    }
                    await stream.writeSSE({
                        data: "[DONE]"
                    });
                } catch (error) {
                    const { message, status, traceId } = PublicInferenceError(error);
                    LogUpstreamFailure(traceId, error, status);
                    await stream.writeSSE({
                        data: JSON.stringify(
                            FormatErrorPayload(message, status, { request_id: traceId })
                        )
                    });
                }
            });
        }

        try {
            const ResponseData = await ChatLogic.ProcessNonStreamingCompletion(
                Body,
                StartTime,
                0,
                ApiKeyId,
                rawIp,
                userAgent,
                marketplaceScope
            );
            return Ok(c, ResponseData);
        } catch (error) {
            const { message, status, traceId } = PublicInferenceError(error);
            LogUpstreamFailure(traceId, error, status);
            return Err(c, message, status, { request_id: traceId });
        }
    }
}
