# DB Migration Notes

This file tracks schema changes that are not automatically handled by the
declarative `initDatabase()` migration (see `packages/db/src/db.ts`).

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
