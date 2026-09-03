# DB Migration Notes

This file tracks schema changes that are not automatically handled by the
declarative `initDatabase()` migration (see `packages/db/src/db.ts`).

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
