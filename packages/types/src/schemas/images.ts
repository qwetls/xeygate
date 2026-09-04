import { z } from "zod";

export const ImageGenerationRequestSchema = z.object({
    prompt: z.string().min(1).max(32000),
    model: z.string().optional().default("dall-e-3"),
    image: z.union([z.string(), z.array(z.string())]).optional(),
    images: z.array(z.string()).optional(),
    mask: z.string().optional(),
    n: z.number().int().min(1).max(10).optional().default(1),
    quality: z.enum(["standard", "hd", "low", "medium", "high", "auto"]).optional().default("auto"),
    response_format: z.enum(["url", "b64_json"]).optional().default("url"),
    size: z.string().optional().default("1024x1024"),
    style: z.enum(["vivid", "natural"]).optional(),
    user: z.string().optional(),
    partial_images: z.number().int().min(0).max(3).optional()
});

export const ImageGenerationItemSchema = z.object({
    url: z.string().optional(),
    b64_json: z.string().optional(),
    revised_prompt: z.string().optional()
});

export const ImageGenerationUsageSchema = z.object({
    total_tokens: z.number().optional(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional()
});

export const ImageGenerationResponseSchema = z.object({
    created: z.number(),
    data: z.array(ImageGenerationItemSchema),
    usage: ImageGenerationUsageSchema.optional()
});

export type ImageGenerationRequest = z.infer<typeof ImageGenerationRequestSchema>;
export type ImageGenerationItem = z.infer<typeof ImageGenerationItemSchema>;
export type ImageGenerationResponse = z.infer<typeof ImageGenerationResponseSchema>;
