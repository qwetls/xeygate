# DB Migration Notes

This file tracks schema changes that are not automatically handled by the
declarative `initDatabase()` migration (see `packages/db/src/db.ts`).

## 2026-09-22 — Plan enforcement disabled (marketplace pivot)

**Change:** `EnforcePlanAccess` middleware reduced to a pass-through. XEYGATE operates
as a credits-based marketplace, not a subscription platform. The `plan` column on
`users` and the `plan_configs` table are retained (unused at runtime) for future
creator tiers. Plan purchase endpoints (`POST /v1/plan-purchases`, `/pay`) removed.
`/plans` page redirects to `/catalog`.

## 2026-09-08 — Admins become user accounts (`users.is_admin`)

**Change:** Admin authentication no longer uses a separate singleton table.
The `admin_account` / `admin_sessions` tables are removed from the generated
schema; admins are now ordinary `users` rows carrying a boolean `is_admin`
flag, and admin sessions are ordinary `user_sessions`.

- Handled automatically by `initDatabase()` column sync — `users.is_admin`
  is added with default `false`, so existing accounts keep normal access.
- **Legacy upgrade path:** if an old `admin_account` row still exists, its
  password hash is migrated at boot into a real user account
  (`admin@xeygate.local`, overridable via `SROUTER_ADMIN_EMAIL`) with the
  same scrypt format — the existing admin password keeps working. If the
  old table is already gone, the first-run claim via
  `POST /v1/admin/bootstrap` (or `SROUTER_ADMIN_PASSWORD` at boot) creates
  the initial admin.
- The dropped `admin_account` / `admin_sessions` tables are harmless
  leftovers on upgraded databases and can be removed manually
  (`DROP TABLE IF EXISTS admin_sessions; DROP TABLE IF EXISTS admin_account;`).

## 2026-09 — Add client ip_address column to request_logs

**Change:** Added `ip_address` TEXT column to `request_logs` table for auditing and client request tracking.

- Handled automatically by `initDatabase()` column sync (`ensureSync` in SQLite and column reflection in PostgreSQL).
- Defaults to NULL for existing records; populated from request headers (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`) on new completions.

## 2026-09 — Dual SQLite / PostgreSQL support (DATABASE_URL)

**Change:** The database layer now supports PostgreSQL via `DATABASE_URL`
in addition to the default SQLite. Schema is generated dialect-aware:

- **SQLite** (default): unchanged behavior, `INTEGER` timestamps, WAL mode.
- **PostgreSQL** (`DATABASE_URL` set): timestamps are `BIGINT` (SQLite
  `INTEGER` overflows at ~2.1B; `Date.now()` is ~1.7T). Upserts use
  `ON CONFLICT ... DO UPDATE SET ... EXCLUDED.` instead of SQLite's
  `excluded.` / `INSERT OR IGNORE`.

**No data migration required** — tables are created fresh on first boot in
either engine. Existing SQLite files are untouched.

**Placeholder syntax:** `?` in all queries is auto-translated to `$1, $2, ...`
for PostgreSQL by the `PgClient` (see `packages/db/src/client.ts`).

## 2026-09-21 — User plan system (`users.plan`)

**Change:** Added `plan` TEXT column to `users` table for plan-based model access
and rate limiting. Values: `starter` (default), `pro`, `pro_max`, `payg`.

- Handled automatically by `initDatabase()` column sync — `users.plan`
  is added with default `'starter'`, so existing accounts start on the
  free tier.
- Plan definitions live in `packages/constants/src/plans.ts`:
  - `starter`: 10K tokens/day, 10 req/min, starter-tier models only
  - `pro`: 500K tokens/day, 60 req/min, pro-tier models (GPT-4, Claude, etc.)
  - `pro_max`: unlimited tokens, unlimited requests, all models
  - `payg`: pay-as-you-go, unlimited tokens/requests, all models
- `EnforcePlanAccess` middleware checks model tier, daily token budget,
  and per-minute request rate. Admins bypass all plan restrictions.
- Admins can change user plans via `PATCH /v1/admin/users/:id/plan`.

## 2026-09-22 — DB-backed plan configuration (`plan_configs`)

**Change:** Plan limits are no longer hardcoded constants — they live in a new
`plan_configs` table so admins can edit them at runtime without a redeploy.

- Handled automatically by `initDatabase()` table sync — `plan_configs` is
  created on first boot in either engine.
- Columns: `plan` (TEXT PK), `label`, `price_cents_usd` (INTEGER),
  `rpm` (INTEGER), `daily_tokens` (INTEGER), `min_tier` (TEXT),
  `updated_at` (INTEGER). On SQLite/PG `rpm`/`daily_tokens`/`price_cents_usd`
  are BIGINT under PostgreSQL (INTEGER→BIGINT quirk).
- **Self-seeding:** the table is empty on first read, so `loadAllPlanConfigs()`
  inserts one row per `PLANS` id from `packages/constants/src/plans.ts` via a
  multi-row `INSERT ... ON CONFLICT(plan) DO NOTHING`. The constants remain the
  source of the initial defaults; the DB rows become the live source thereafter.
- `EnforcePlanAccess` now reads `getPlanConfigDB(planId)` (a 15s-TTL cache) for
  `rpm`, `daily_tokens`, and `min_tier` on every `/chat/completions` request;
  `tierAllowsPlan()` in constants does the tier comparison. A 0 limit means
  unlimited, matching the `pro_max`/`payg` defaults.
- Admins edit config via `PUT /v1/admin/plans/:plan` (validated); the public
  `GET /v1/plans` catalog and the `/plans` page now render from these rows.

## 2026-09-22 — Top-up orders settle through a gateway (`pending_payment`)

**Change:** `topup_orders.status` gains two values. A new order is created as
`pending_payment` (not `pending`); a sandbox payment gateway settles it to
`paid`, crediting the wallet and writing a ledger row in one step — no admin
approval is required.

- No schema change: `status` is TEXT, so the new values (`pending_payment`,
  `paid`) need no migration. Legacy rows keep their status.
- `pending`/`approved` are still readable and processable so orders created
  before this change are not stranded; the admin `POST /v1/admin/topups/:id/process`
  endpoint remains as a manual-correction escape hatch.
- `processTopupOrderDB` pins open statuses with a conditional
  `WHERE ... status IN ('pending','pending_payment')`, so a double-settle
  (buyer pays while an admin approves) can only credit once.
- Settlement is one function (`SettleTopupOrder`) the sandbox flow calls and a
  future real-gateway webhook can reuse.
