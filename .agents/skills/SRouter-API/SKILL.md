---
name: srouter-api
description: |
    Development skill for SRouter API server and backend packages (@srouter/db, @srouter/executors, @srouter/providers, @srouter/translator, @srouter/pricing, @srouter/constants, @srouter/types). Use when working on apps/api, routing (/v1/chat/completions, /v1/messages, /v1/models), authentication (adminAuth, apiKeyAuth), OAuth PKCE flows, token sweeper, tool interception, or provider drivers.
---

# ⚡ SRouter — API & Backend Skill

Comprehensive guide for the SRouter REST API server (`apps/api`) and internal backend packages.

## Overview & Architecture

Layered architecture:
`Routes (Hono) → Controllers → Logic → Services / Database / Executors`

### Key Paths & Packages:
- `apps/api/src/index.ts`: Dual-server entrypoint (Port 3000 for API/Dashboard, Port 1455 for OAuth callbacks).
- `apps/api/src/routes/v1/`: Endpoint definitions (`chat.ts`, `messages.ts`, `models.ts`, `providers.ts`, `keys.ts`, `admin.ts`, `settings.ts`, `tunnel.ts`, `quota.ts`, `logs.ts`).
- `apps/api/src/middleware/`: Security headers (`X-Version`, `X-Powered-By`), CORS, `apiKeyAuth` (loopback/virtual key), `adminAuth` (session cookie).
- `apps/api/src/logic/`: Core logic (`chat.logic.ts` cascade/failover/intercept, `models.logic.ts`, `auth.logic.ts`).
- `packages/executors/`: Upstream drivers (Antigravity, OpenAI Codex, Anthropic, Qoder, CodeBuddy, Kiro, etc.).
- `packages/translator/`: OpenAI ↔ Anthropic payload, stream, and tool translation.
- `packages/db/`: SQLite WAL layer via native `node:sqlite`.
- `packages/constants/`: Version definitions (`version.ts`), provider catalogs, seed data.

## Server Ports & Lifecycle
- **Port 3000**: API routes (`/v1/*`), health (`/health`), and static dashboard serving.
- **Port 1455**: Secondary server for OAuth callbacks (`/auth/*/callback`) & CLI fallback listener.
- **Startup**: Database migrations/seeding → Token refresh sweeper daemon (`startTokenRefreshSweeper()`) → Model registry cache warming → Tunnel autostart.

## Security & Auth Rules
1. **Loopback Detection**: Local requests (`127.0.0.1`, `::1`) bypass API key if `require_api_key` is off in settings. Remote requests **must** provide a valid virtual key (`sr-live-*`).
2. **Admin Auth**: Scrypt password hashing with session cookie `srouter_admin_session`. Remote setup requires `SROUTER_SETUP_TOKEN`.
3. **SSRF Guard**: Target URLs in provider verification block `169.254.*`, `127.*`, `localhost`, and internal metadata hostnames.

## Testing & Validation
- **Targeted Test Execution**: Always run `cd apps/api && pnpm test` or `pnpm test tests/<filename>.test.ts`. Never run full monorepo tests at once.
- **Build**: `cd apps/api && pnpm run build` (tsup node20 ESM).
