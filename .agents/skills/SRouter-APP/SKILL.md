---
name: srouter-app
description: |
    Development skill for SRouter Web Dashboard (apps/web). Use when creating or editing React 19 pages, TanStack Router routes, TanStack Query hooks, Tailwind CSS v4 styling, Base UI components, Lucide icons, Playground chat studio, provider configuration modals, or cloudflare tunnel UI.
---

# ⚡ SRouter — Web App & Dashboard Skill

Complete guide for the SRouter Web Dashboard (`apps/web`), a React 19 SPA.

## Tech Stack & Architecture

- **Framework**: React 19, TypeScript
- **Routing**: TanStack Router (file-based routing under `src/routes/`)
- **Data Fetching**: TanStack React Query v5 (`useQuery`, `useMutation`)
- **Styling**: Tailwind CSS v4 with OKLCH tokens (`src/styles.css`), Base UI primitives, Motion animations
- **Icons**: Lucide React
- **Notifications**: Sonner (`toast.success()`, `toast.error()`)

## Directory Structure

```
apps/web/src/
├── main.tsx              # App bootstrap & query client
├── styles.css            # Tailwind v4 @theme tokens
├── routeTree.gen.ts      # Auto-generated TanStack Router tree
├── routes/               # File-based routes
│   ├── __root.tsx         # Layout shell (AppSidebar, Topbar, AdminAuthGate)
│   ├── index.tsx          # Dashboard overview & analytics
│   ├── playground.tsx     # Streaming chat playground & prompt lab
│   ├── keys.tsx           # Virtual API keys & balance management
│   ├── providers/         # Provider catalog, OAuth, model management
│   ├── combo.tsx          # Failover & routing combo rules
│   ├── token-saver.tsx    # Prompt compression & optimization
│   ├── quota.tsx          # Usage quotas & limits
│   ├── logs.tsx           # Request/audit log inspection
│   └── settings.tsx       # Gateway, appearance, system settings
├── components/
│   ├── playground/        # Streaming chat UI, markdown/code rendering
│   ├── providers/         # Provider catalog & connection forms
│   ├── dashboard/         # Analytics, topology & tunnel widgets
│   ├── keys/              # Key CRUD, credits & metrics
│   ├── combo/             # Combo architecture & rule builders
│   ├── settings/          # Gateway/security/system settings panels
│   ├── auth/              # Admin auth gate
│   ├── layout/            # Sidebar & topbar shell
│   ├── skeletons/         # Loading placeholders
│   └── ui/                # Shared design-system primitives
├── hooks/                 # Query-backed React hooks
└── lib/                   # API client helpers & utilities
```

## Conventions & Rules

1. **Version Constant**: Always import version from `@srouter/constants` (`APP_VERSION`), never hardcode version strings.
2. **API Communication**: The dashboard communicates with the backend via `/v1` endpoints (proxied via Vite dev server on `5173` or served statically by API on port `3000`).
3. **Responsive & Theme**: Dark/light mode support using theme context and OKLCH color variables.
4. **Build & Dev**:
    - Dev: `cd apps/web && pnpm dev` (Vite port 5173)
    - Build: `cd apps/web && pnpm run build` (Outputs to `apps/web/dist`)
