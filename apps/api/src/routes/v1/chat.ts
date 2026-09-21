import { Hono } from "hono";
import { ChatCompletionRequestSchema } from "@srouter/types";
import { ChatController } from "@/controllers/chat.controller.js";
import { ValidateJson } from "@/middleware/Validation.js";
import { ApiKeyAuth } from "@/middleware/ApiKeyAuth.js";
import { EnforceModelAccess } from "@/middleware/ModelAccess.js";
import { EnforceRateLimit } from "@/middleware/RateLimit.js";
import { EnforcePlanAccess } from "@/middleware/PlanAccess.js";

export const ChatRouter = new Hono();

ChatRouter.post(
    "/chat/completions",
    ApiKeyAuth,
    EnforceRateLimit,
    ValidateJson(ChatCompletionRequestSchema),
    EnforcePlanAccess,
    EnforceModelAccess(),
    ChatController.CreateCompletion
);
ChatRouter.post(
    "/chat/completion",
    ApiKeyAuth,
    EnforceRateLimit,
    ValidateJson(ChatCompletionRequestSchema),
    EnforcePlanAccess,
    EnforceModelAccess(),
    ChatController.CreateCompletion
);
