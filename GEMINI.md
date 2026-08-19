# GEMINI.md

This file serves as the memory and operational rulebook for Antigravity and AI agents working on the **SRouter** codebase.

---

## 1. Project Overview & Architecture

**SRouter** is a high-performance, multi-provider AI Gateway and LLM proxy router built with **Hono**, **TypeScript**, and native **SQLite WAL**, accompanied by a modern **React dashboard**.

### Monorepo Structure (pnpm + Turborepo)

- **`apps/api`**: Hono API server running on port `3000`.
    - Routes located under `src/routes/v1` (admin, auth, chat, keys, logs, messages, models, providers, quota, settings).
    - Strict separation of concerns: `routes/` (routing & validation) → `controllers/` (HTTP transport) → `logic/` & `services/` (business flows & registry) → `packages/db` & `packages/executors`.
    - `src/services/registry.ts`: Builds runtime provider registry from environment and SQLite.
    - `src/services/tokenRefresh.ts`: Handles OAuth token lifecycles and background refreshes.
    - Default API SQLite database file: `apps/api/srouter.db`.

- **`apps/web`**: Dashboard application built with Vite, React 19, and TanStack Router on port `5173`.
    - File-based routing located in `src/routes/` with `routeTree.gen.ts`.
    - Server state managed via `@tanstack/react-query`.
    - Centralized typed fetch client in `src/lib/api.ts` (proxies `/v1` to API).
    - Theme provider in `src/context/Theme.tsx`.

- **`packages/types`**: Shared TypeScript domain types and Zod validation schemas (`openai.ts`, `anthropic.ts`, `schemas.ts`, `provider.ts`, `logs.ts`, `quota.ts`, `apiKeys.ts`).
- **`packages/providers`**: Provider catalog definitions, registry abstractions, and contract interfaces.
- **`packages/executors`**: Concrete execution engines for upstream LLMs (OpenAI, Anthropic, Codex, Antigravity, Kiro, Qoder, CommandCode, SeekAI, Bluesminds, GoRouter, Tabitoken, TokenRouter, retry/search wrappers, SSE streaming).
- **`packages/translator`**: Bidirectional protocol translation (OpenAI ↔ Anthropic ↔ Gemini) and usage normalization.
- **`packages/pricing`**: Model token cost estimation and calculation.
- **`packages/db`**: Database layer using native `node:sqlite` in WAL mode. Manages repositories for providers, API keys, OAuth sessions, quotas, settings, and request logs.
- **`packages/constants`**: Shared constants and defaults across workspaces.

---

## 2. Critical Operational Constraints (HARD RULES)

> [!CAUTION]
> **STRICT BAN ON BUILD AND RUNNING COMMANDS**
>
> - **DO NOT EXECUTE** `build`, `dev`, `start`, `pnpm run dev`, `pnpm run build`, `pnpm start`, `turbo dev`, `turbo build`, or equivalent wrappers (e.g. via `npx`, `corepack`, `env`, shell chaining).
> - Never start live servers or launch dev servers during automated agent sessions.
> - Only read, static analysis, file editing, formatting checks, and safe targeted test executions are allowed.

### Safe Commands

```bash
pnpm install              # Install dependencies if explicitly requested
pnpm --version            # Check package manager version
pnpm list --depth 0       # Inspect dependencies
pnpm format:check         # Check Prettier formatting
pnpm lint                 # Run linter
pnpm test                 # Run workspace test suites
pnpm clean                # Remove build/turbo artifacts
```

### Targeted Test Execution

Tests run with `tsx --test` without requiring a prior build step:

```bash
pnpm --filter api exec tsx --test --test-concurrency=1 tests/<test-name>.test.ts
pnpm --filter @srouter/providers exec tsx --test tests/<test-name>.test.ts
pnpm --filter @srouter/executors exec tsx --test tests/<test-name>.test.ts
```

_Note: Run API tests serially (`--test-concurrency=1`) to prevent SQLite state collision. Never use the live production database for destructive tests._

---

## 3. Code Standards & Architecture Guidelines

### Backend Modularity

- **Single Responsibility**: One primary concern per file/module.
- **Dependency Flow**: `route → controller → logic/service → repository/provider`. Lower layers must never import higher layers or frontend code.
- **Size Signals**: Files > 300 lines or functions > 50 lines are review signals for splitting.
- **Error Handling**: Use standard OpenAI-style formatted error responses defined in `apps/api/src/middleware/validator.ts`.

### Frontend Modularity & Naming Conventions

- **Route Files**: Keep `apps/web/src/routes/*` thin; delegate complex views to feature components.
- **Feature Components**: Place feature-specific UI in `apps/web/src/components/<feature>/` (e.g., `ModelUsageOverview.tsx`, `ConnectionCard.tsx`).
- **UI Primitives**: Place reusable UI components in `apps/web/src/components/ui/` using lowercase kebab-case (e.g., `button.tsx`, `card.tsx`).
- **Hooks**: Standalone hooks go in `apps/web/src/hooks/use<Name>.ts` (single word `<Name>`).
- **Contexts**: React contexts and providers go in `apps/web/src/context/<Name>.tsx` (PascalCase).
- **API State**: Use `apps/web/src/lib/api.ts` and React Query hooks; avoid raw `fetch` calls in components.

### Formatting & Code Style

- Prettier Configuration: **4 spaces indentation**, **double quotes (`"` )**, **100 print width**, **no trailing commas**.
- Preserve existing comments and docstrings.
- Strict type-safety with TypeScript throughout all packages and apps.
