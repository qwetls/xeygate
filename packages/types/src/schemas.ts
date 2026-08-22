import { z } from "zod";

export const ContentPartSchema = z.object({
    type: z.enum(["text", "image_url"]),
    text: z.string().optional(),
    image_url: z
        .object({
            url: z.string(),
            detail: z.enum(["auto", "low", "high"]).optional()
        })
        .optional()
});

export const ToolCallFunctionSchema = z.object({
    name: z.string(),
    arguments: z.string()
});

export const ToolCallSchema = z.object({
    id: z.string(),
    type: z.literal("function"),
    function: ToolCallFunctionSchema
});

export const ChatMessageSchema = z.object({
    role: z.enum(["system", "user", "assistant", "tool", "function"], {
        required_error:
            "Role is required and must be 'system', 'user', 'assistant', 'tool', or 'function'"
    }),
    content: z.union([z.string(), z.array(ContentPartSchema), z.null()], {
        required_error: "Content is required"
    }),
    name: z.string().optional(),
    tool_calls: z.array(ToolCallSchema).optional(),
    tool_call_id: z.string().optional()
});

// Tool parameter properties are arbitrary JSON Schema (unions via oneOf/anyOf,
// nested objects, items, ...). Accept as-is; provider translators sanitize
// per-provider (e.g. cleanJSONSchemaForAntigravity).
export const JSONSchemaValue: z.ZodType<unknown> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(JSONSchemaValue),
        z.record(JSONSchemaValue)
    ])
);

export const ToolParameterPropertySchema = z.record(JSONSchemaValue);

export const ToolParametersSchema = z
    .object({
        type: z.literal("object"),
        properties: z.record(ToolParameterPropertySchema).optional(),
        required: z.array(z.string()).optional()
    })
    .passthrough();

export const ToolDefinitionSchema = z.object({
    type: z.literal("function"),
    function: z.object({
        name: z.string(),
        description: z.string().optional(),
        parameters: ToolParametersSchema.optional()
    })
});

export const ToolChoiceSchema = z.union([
    z.enum(["none", "auto", "required"]),
    z.object({
        type: z.literal("function"),
        function: z.object({ name: z.string() })
    })
]);

export const ChatCompletionRequestSchema = z.object({
    model: z.string({
        required_error: "Missing required parameter 'model'"
    }),
    messages: z
        .array(ChatMessageSchema, {
            required_error: "Missing required parameter 'messages'"
        })
        .min(1, "Parameter 'messages' cannot be empty"),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    n: z.number().int().positive().optional(),
    stream: z.boolean().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    max_tokens: z.number().int().positive().optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    user: z.string().optional(),
    tools: z.array(ToolDefinitionSchema).optional(),
    tool_choice: ToolChoiceSchema.optional(),
    response_format: z.object({ type: z.string() }).optional()
});

export const CreateAPIKeySchema = z.object({
    name: z
        .string({
            required_error: "Field 'name' is required"
        })
        .min(1, "Field 'name' cannot be empty"),
    rateLimit: z.number().int().nonnegative().optional(),
    quotaLimit: z.number().int().nonnegative().optional()
});

export const CreateProviderSchema = z.object({
    providerId: z.string({ required_error: "Field 'providerId' is required" }),
    name: z.string({ required_error: "Field 'name' is required" }),
    category: z.enum(["custom", "oauth", "free_tier", "api_key"]),
    protocol: z.enum(["openai", "anthropic", "gemini", "custom"]),
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    accessToken: z.string().optional(),
    customHeaders: z.record(z.string()).optional()
});

export type ChatCompletionRequestZod = z.infer<typeof ChatCompletionRequestSchema>;
export type CreateAPIKeyZod = z.infer<typeof CreateAPIKeySchema>;
export type CreateProviderZod = z.infer<typeof CreateProviderSchema>;
