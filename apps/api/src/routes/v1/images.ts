import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ImageGenerationRequestSchema } from "@srouter/types";
import { ImagesController } from "@/controllers/images.controller.js";
import { ApiKeyAuth } from "@/middleware/ApiKeyAuth.js";
import { EnforceRateLimit } from "@/middleware/RateLimit.js";

const imagesRouter = new Hono();

imagesRouter.use("*", ApiKeyAuth, EnforceRateLimit);

imagesRouter.post(
    "/generations",
    zValidator("json", ImageGenerationRequestSchema, (result, c) => {
        if (!result.success) {
            return c.json(
                {
                    error: {
                        message: result.error.errors.map((e) => e.message).join(", "),
                        type: "invalid_request_error",
                        code: "invalid_payload"
                    }
                },
                400
            );
        }
    }),
    ImagesController.generate
);

export default imagesRouter;
