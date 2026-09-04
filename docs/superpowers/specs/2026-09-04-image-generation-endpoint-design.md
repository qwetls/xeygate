# Design Specification: Image Generation Endpoint (`/v1/images/generations`)

- **Author**: Seaavey & Hermes
- **Date**: 2026-09-04
- **Status**: Approved — ready for implementation

---

## 1. Overview & Motivation

SRouter currently functions purely as a text-based LLM routing gateway supporting `/v1/chat/completions` (OpenAI format) and `/v1/messages` (Anthropic format). Many downstream AI developer clients, coding agents, and apps (OpenAI SDK, LangChain, LlamaIndex, etc.) expect the standard OpenAI Image Generation API (`/v1/images/generations`).

This specification outlines adding standard OpenAI-compatible image generation routing to SRouter, enabling client applications to request image generations through configured providers (e.g. OpenAI DALL-E, Google Gemini Imagen, OpenRouter / HuggingFace image models, etc.) while leveraging SRouter's core features: API key validation, provider alias routing, fallback handling, and request logging.

---

## 2. API Contract (OpenAI Specification)

### 2.1 Endpoint
`POST /v1/images/generations`

### 2.2 Headers
- `Authorization: Bearer <srouter-api-key>`
- `Content-Type: application/json`

### 2.3 Request Payload (`ImageGenerationRequest`)

```json
{
  "prompt": "A futuristic city in watercolor style",
  "model": "dall-e-3",
  "image": "data:image/png;base64,...",
  "mask": "data:image/png;base64,...",
  "n": 1,
  "quality": "standard",
  "response_format": "url",
  "size": "1024x1024",
  "style": "vivid",
  "user": "optional-user-id"
}
```

#### Fields & Constraints (OpenAI OpenAPI Standard):
- `prompt` (string, required): Text description of the desired image(s). Max 1000 characters for `dall-e-2`, 4000 for `dall-e-3`, up to 32000 for GPT image models.
- `model` (string, optional, default: `"dall-e-2"` or `"dall-e-3"`): ID or alias of the model to use. Supports model mapping / provider prefix (e.g. `openai/dall-e-3`, `openrouter/stabilityai/stable-diffusion-3`).
- `image` (string | array of string, optional): Input image for **img2img / image editing**. Accepts base64 data URL (`data:image/png;base64,...`), raw base64 string, or external image URL (`https://...`). Also supports array of image references (`images`) for multi-reference models.
- `mask` (string, optional): Transparent mask image for inpainting / selective image editing (base64 data URL or external URL).
- `n` (integer, optional, default: `1`): Number of images to generate (1 to 10). Note: `dall-e-3` only supports `n=1`.
- `quality` (string, optional, default: `"auto"` or `"standard"`): `"standard"`, `"hd"` (`dall-e-3`), or `"low"`, `"medium"`, `"high"`, `"auto"` (GPT image models).
- `response_format` (string, optional, default: `"url"`): `"url"` or `"b64_json"`.
- `size` (string, optional, default: `"1024x1024"`): Dimensions of the generated images (`256x256`, `512x512`, `1024x1024`, `1024x1536`, `1536x1024`, `1024x1792`, `1792x1024`, or arbitrary for newer models).
- `style` (string, optional, default: `"vivid"`): `"vivid"` or `"natural"` (`dall-e-3` only).
- `user` (string, optional): Unique end-user identifier for abuse detection.
- `partial_images` (integer, optional, min 0, max 3): Number of partial images to generate for streaming responses.

### 2.4 Response Payload (`ImageGenerationResponse`)

```json
{
  "created": 1725408000,
  "data": [
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/...",
      "revised_prompt": "A modern watercolor painting of a towering futuristic metropolis with neon accents..."
    }
  ],
  "usage": {
    "total_tokens": 0,
    "input_tokens": 0,
    "output_tokens": 0
  }
}
```

Or for `response_format: "b64_json"`:

```json
{
  "created": 1725408000,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "revised_prompt": "..."
    }
  ]
}
```

---

## 3. Architecture & Data Flow

Following SRouter's architectural law:
```
routes/v1 → controllers → logic → services / packages/{db,executors,providers,translator}
```

```
apps/api/src/routes/v1/images.ts
  └── ImagesController.Generate
        └── ImagesLogic.generate()
              ├── ApiKeyAuth / RateLimit Check
              ├── Model capability validation (@srouter/pricing getModelMetadata)
              │     └── Verify `modalities.output` includes `"image"`
              │     └── If not supported: raise 400 HTTPException ("Model '<model>' does not support image generation.")
              ├── Model resolution & provider routing (resolveProvider)
              ├── Fallback chain execution
              ├── Packages:
              │     ├── @srouter/types: ImageGenerationRequest & Response schemas
              │     ├── @srouter/pricing: getModelMetadata / modalities output validation
              │     ├── @srouter/translator: translateImageRequest / translateImageResponse
              │     ├── @srouter/executors: ImageExecutor or ProviderExecutor.generateImage()
              │     └── @srouter/db: request_logs persistence
              └── Return standard JSON response
```

### 3.1 Layer Responsibilities

1. **`apps/api/src/routes/v1/images.ts`**:
   - Declares route `POST /generations` with `apiKeyAuth` middleware.
   - Validates request body using `@hono/zod-validator` and `ImageGenerationRequestSchema`.
2. **`apps/api/src/controllers/images.controller.ts`**:
   - HTTP extraction (c.req.valid('json'), auth context, client IP, user agent).
   - Calls `ImagesLogic.generate()`.
   - Returns standard JSON response or raises `HTTPException`.
3. **`apps/api/src/logic/images.logic.ts`**:
   - **Model Modality Validation**:
     - Uses `getModelMetadata(model)` from `@srouter/pricing` (which queries `models.jsonc`).
     - Checks if `metadata.modalities.output` contains `"image"`.
     - For known image models not yet cataloged (e.g. `dall-e-2`, `dall-e-3`), provides a known fallback allowlist.
     - If the requested model does NOT support image output (e.g. text-only model like `deepseek-chat`, `gpt-4o`, `claude-sonnet-4`), immediately throws a `400 Bad Request`:
       ```json
       {
         "error": {
           "message": "Model 'claude-sonnet-4' does not support image generation. Output modalities do not include 'image'.",
           "type": "invalid_request_error",
           "param": "model",
           "code": "model_not_supported"
         }
       }
       ```
   - Resolves provider based on model prefix or default catalog.
   - Executes image generation request with fallback retry runner.
   - Records request log into SQLite `request_logs`.
4. **`packages/types`**:
   - Zod schemas: `ImageGenerationRequestSchema`, `ImageGenerationResponseSchema`.
   - TypeScript types derived via `z.infer`.
5. **`packages/executors`**:
   - Extends provider executor interface or base executor to support `generateImage(req: ImageGenerationRequest)`.
   - Handles upstream HTTP request to target provider's `/v1/images/generations` or provider-specific image generation API.
6. **`packages/translator`**:
   - Standardizes differences across providers (e.g. Gemini Imagen vs OpenAI DALL-E) into the OpenAI output envelope.

---

## 4. Key Considerations & YAGNI Boundaries

1. **Strict OpenAI Compatibility**: Keep standard response envelope `{ created, data: [{ url | b64_json, revised_prompt }] }`.
2. **Stream Handling**: Image generation is non-streaming; returns pure JSON. No SSE required.
3. **Cost & Token Tracking**:
   - Images do not consume input/output tokens in the standard LLM sense.
   - Log entry will mark `total_tokens: 0`, and calculate `estimated_cost` based on model image unit pricing if configured in catalog.
4. **Out of Scope (YAGNI for Phase 1)**:
   - No image edits (`/v1/images/edits`) or image variations (`/v1/images/variations`) in Phase 1.
   - No direct local file caching or image storage proxying (URLs are returned directly from upstream provider or base64).

---

## 5. Implementation Plan (Phases)

- **Phase 1 (Spec & Review)**: Commit this specification and submit PR for review.
- **Phase 2 (Types & Executors)**: Add schemas in `@srouter/types`, adapt `@srouter/executors` for image generation endpoint.
- **Phase 3 (Routing & Logic)**: Mount `/v1/images` router in `apps/api`, wire up `ImagesLogic` & logging.
- **Phase 4 (Testing & Verification)**: Unit tests for schemas and executors; smoke tests against local SRouter instance.
