# Image Generation Endpoint (`POST /v1/images/generations`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standard OpenAI-compatible image generation routing to SRouter via `POST /v1/images/generations` with request/response schema validation, model output modality checks via `@srouter/pricing` (`models.jsonc`), provider execution delegation, fallback support, and SQLite telemetry logging.

**Architecture:**
- Route: `apps/api/src/routes/v1/images.ts` mounted at `/v1/images` (path `/v1/images/generations`).
- Controller: `apps/api/src/controllers/images.controller.ts`.
- Logic: `apps/api/src/logic/images.logic.ts` performs API key / rate-limit checks, modality validation using `getModelMetadata()` from `@srouter/pricing`, provider resolution via `registry`, fallback cascading, and logging into `request_logs`.
- Packages:
  - `@srouter/types`: `ImageGenerationRequestSchema`, `ImageGenerationResponseSchema`, and derived TypeScript types.
  - `@srouter/executors`: `generateImage(req: ImageGenerationRequest)` method in base and concrete executors (e.g. `OpenAIExecutor`, `AntigravityExecutor`, `GoRouterExecutor`, `GenericExecutor`).
  - `@srouter/translator`: Request/response translation utilities when provider dialects differ.

**Tech Stack:** Node.js (v22+), TypeScript, Hono 4, Zod, `@srouter/types`, `@srouter/executors`, `@srouter/pricing`, `@srouter/db`.

---

## Global Constraints
- Runtime: Node.js >= 22, ESM only.
- Architecture Law: `routes/v1 -> controllers -> logic -> services / packages/{db,executors,pricing,translator,types}`.
- Zero loose `any`, strict type safety, PascalCase guards/helpers.
- Gateway endpoints mount under `/v1` in `apps/api/src/index.ts`.
- Never run whole-monorepo build or broad test suites. Only test/build touched packages.

---

### Task 1: Shared Types & Zod Schemas (`@srouter/types`)

**Files:**
- Create: `packages/types/src/schemas/images.ts`
- Create: `packages/types/src/images.ts`
- Modify: `packages/types/src/schemas/index.ts`
- Modify: `packages/types/src/index.ts`
- Test: `packages/types/tests/images.test.ts`

- [ ] **Step 1: Create types and Zod schemas for Image Generation**
  - Implement `ImageGenerationRequestSchema`:
    - `prompt`: `z.string().min(1).max(32000)`
    - `model`: `z.string().optional().default("dall-e-3")`
    - `n`: `z.number().int().min(1).max(10).optional().default(1)`
    - `quality`: `z.enum(["standard", "hd", "low", "medium", "high", "auto"]).optional().default("auto")`
    - `response_format`: `z.enum(["url", "b64_json"]).optional().default("url")`
    - `size`: `z.string().optional().default("1024x1024")`
    - `style`: `z.enum(["vivid", "natural"]).optional()`
    - `user`: `z.string().optional()`
    - `partial_images`: `z.number().int().min(0).max(3).optional()`
  - Implement `ImageGenerationResponseSchema`:
    - `created`: `z.number()`
    - `data`: `z.array(z.object({ url: z.string().optional(), b64_json: z.string().optional(), revised_prompt: z.string().optional() }))`
    - `usage`: `z.object({ total_tokens: z.number().optional(), input_tokens: z.number().optional(), output_tokens: z.number().optional() }).optional()`
  - Derive types: `ImageGenerationRequest = z.infer<typeof ImageGenerationRequestSchema>` and `ImageGenerationResponse = z.infer<typeof ImageGenerationResponseSchema>`.

- [ ] **Step 2: Export in `@srouter/types` and verify package build**
  - Run: `cd packages/types && pnpm run build`

---

### Task 2: Provider Executor Interface & Implementations (`@srouter/executors`)

**Files:**
- Modify: `packages/executors/src/base.ts`
- Modify: `packages/executors/src/openai.ts`
- Modify: `packages/executors/src/antigravity.ts` (if applicable)
- Modify: `packages/executors/src/index.ts`
- Test: `packages/executors/tests/images.test.ts`

- [ ] **Step 1: Add `generateImage` to `BaseExecutor`**
  - Add signature to `BaseExecutor`:
    ```ts
    generateImage?(req: ImageGenerationRequest): Promise<ImageGenerationResponse>;
    ```
- [ ] **Step 2: Implement `generateImage` in `OpenAIExecutor`**
  - POST to `${this.baseUrl}/images/generations` with standard Authorization and payload.
  - Map response into `ImageGenerationResponse`.
  - Handle errors without leaking upstream credentials.
- [ ] **Step 3: Run unit tests for executors**
  - Run: `cd packages/executors && pnpm test`

---

### Task 3: Modality Validation Helper (`@srouter/pricing`)

**Files:**
- Modify: `packages/pricing/src/pricing.ts`
- Modify: `packages/pricing/src/index.ts`
- Test: `packages/pricing/tests/image-modality.test.ts`

- [ ] **Step 1: Implement `isImageGenerationSupported(model: string): boolean`**
  - Use `getModelMetadata(model)`.
  - Check `metadata?.modalities?.output?.includes("image")`.
  - Provide fallback allowlist for models known to generate images (e.g. `dall-e-2`, `dall-e-3`, `gpt-image-1`, `gpt-image-1.5`, `gpt-image-2`, `nano-banana`).
  - Return `true` if supported, `false` otherwise.
- [ ] **Step 2: Run pricing tests**
  - Run: `cd packages/pricing && pnpm test`

---

### Task 4: Images Logic & Routing in API (`apps/api`)

**Files:**
- Create: `apps/api/src/logic/images.logic.ts`
- Create: `apps/api/src/controllers/images.controller.ts`
- Create: `apps/api/src/routes/v1/images.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/tests/images-route.test.ts`

- [ ] **Step 1: Implement `ImagesLogic.generate(req, context)`**
  - Validate model capability: call `isImageGenerationSupported(model)`. If false, throw `HTTPException(400, { message: "Model '<model>' does not support image generation. Output modalities do not include 'image'." })`.
  - Deduce credit/rate-limit using existing apiKey helpers.
  - Resolve provider and execute with fallback chain if configured.
  - Record request log in `request_logs`.
- [ ] **Step 2: Implement `ImagesController` & Mount Route**
  - Mount `imagesRoute` at `/images` under `/v1` (`POST /v1/images/generations`).
  - Protect with `apiKeyAuth`.
- [ ] **Step 3: Write tests for `/v1/images/generations`**
  - Test validation rejection (model not supporting image output -> 400).
  - Test valid request delegating to registered executor and returning 200 with `{ created, data: [...] }`.
  - Test auth rejection (401 when API key required but missing).
  - Run: `cd apps/api && pnpm exec tsx --test tests/images-route.test.ts`

---

### Task 5: Verification & End-to-End Smoke Test

- [ ] **Step 1: Run typechecks and builds for touched packages**
  - `cd packages/types && pnpm run build`
  - `cd packages/pricing && pnpm run build`
  - `cd packages/executors && pnpm run build`
  - `cd apps/api && pnpm run build`
- [ ] **Step 2: Run targeted test suite in `apps/api`**
  - `cd apps/api && pnpm test`
