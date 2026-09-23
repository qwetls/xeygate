# DB Migration Notes

This file tracks schema changes that are not automatically handled by the
declarative `initDatabase()` migration (see `packages/db/src/db.ts`).

## 2026-09-23 — Provider Governance: Banning and Creator Model Toggles

**Change:** Added provider banning and granular creator model control.
- `providers` table: added `banned` column (`INTEGER NOT NULL DEFAULT 0`).
  - Admin can ban a creator's provider connection, which automatically disables it.
  - Creator cannot re-enable a banned provider.
- `disabled_models` table: now supports `disabled_by` prefixes for governance:
  - `admin:<adminId>`: Admin-level disable, creator cannot override.
  - `creator:<creatorId>`: Creator-level disable for their own models.
- New API endpoints:
  - `POST /v1/providers/:id/ban` (Admin)
  - `POST /v1/providers/:id/unban` (Admin)
  - `POST /v1/providers/mine/:id/models/toggle` (Creator)

## 2026-09-23 — Bell Notifications system tables

**Change:** Added persistent notification storage and per-user read tracking.
- `notifications` table: stores broadcast and role-targeted notifications (`id`, `title`, `message`, `type`, `target`, `created_by`, `created_at`).
- `user_notification_reads` table: junction table tracking which user has read which notification (`user_id`, `notification_id`, `read_at`).
- Three performance indexes created automatically by `initDatabase()`:
  - `idx_notifications_created_at`
  - `idx_notifications_target`
  - `idx_user_notification_reads_lookup`

**No manual migration required:** tables and indexes are created automatically by `initDatabase()` on boot across both SQLite and PostgreSQL.

## 2026-09-23 — Creator Custom Token Pricing (admin-gated)

**Change:** Added `creator_pricing_enabled` boolean toggle stored in the `system_settings` table (default: `false`).
- Admin controls whether creators can set custom token pricing for their own provider connections.
- Creator endpoints `GET/PUT/DELETE /v1/user/pricing` read and enforce this toggle.
- No schema change needed: stored as a key-value pair in existing `system_settings`.

## 2026-09-22 — All plan/subscription infrastructure removed

**Change:** XEYGATE is a credits-based marketplace, not a subscription platform.
Everything plan-related has been deleted:
- `plan_configs` and `plan_purchases` tables removed from schema.
- `EnforcePlanAccess` middleware, `PLANS` constants, `planConfig.ts`, `planPurchases.ts` deleted.
- Admin plan editor (`/admin/plans`, `PATCH /v1/admin/users/:id/plan`) removed.
- `/plans` page, client dashboard plan card, and all plan-related UI removed.
- `plan` and `plan_expires_at` columns on `users` table are retained as harmless
  leftovers (no data migration needed — they just sit unused).

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
