# Design Specification: Server-Side Model Disable (Platform Supply Governance)

- **Author**: Qwen & Xeyyzu
- **Date**: 2026-09-09
- **Status**: Implemented — DB, routing chokepoints, listings, admin API, admin UI shipped.
- **Context**: Step 1 of turning `/admin/providers` from a redundant CRUD mirror into a
  *platform supply operations + governance* surface. CRUD of one's own listings stays in the
  client area; the admin dashboard keeps the levers that only the platform may pull.

---

## 1. Problem & Decisions

### The bug this fixes

Hiding a model on an admin provider page wrote to `localStorage`
(`xeygate_deleted_models_<providerId>`). The model kept serving traffic, kept appearing in
`/v1/models`, the namespace lists and the public storefront, and the "deletion" vanished on
another browser or another admin account. It was a personal view filter wearing governance clothes.

### Decision 1 — A denylist table, not a flag on `custom_models`

`custom_models` only exists for manually registered listings. Live models discovered from an
upstream driver have no row at all, so a `disabled` column there cannot cover them.
`disabled_models` is therefore a separate table that can shadow **any** model id, whether it
came from the driver or from the local catalog. Additive: nothing about existing listing
behaviour changes.

### Decision 2 — Write at the base id, read both key spaces

`SelectMarketplaceRows` keys creator listings by `providerId || id` and official listings by
`providerBaseId`, with base-id inheritance so one admin registration applies to every connection
of that driver. The admin surface is the *catalog* page, which is addressed by base id, and
`providerBaseId()` leaves a UUID untouched — so a rule written against a custom (UUID) connection
stays private to that connection, while one written against a shared driver shadows every
connection of it. No `scope` column was needed for the same reason.

Reads (`SelectDisabledModelIds`, `IsModelDisabled`) consult **both** the connection key and the
base key, always. A model is therefore hidden from every listing surface exactly when the gate
would refuse to serve it — a storefront that advertises a model whose only supplier is vetoed is
the same class of lie the localStorage filter was.

### Decision 3 — One central gate, not N call-site checks

Two routing paths exist: bare model → `ResolveMarketplaceRoute` (custom_models-driven, quality
weighted), and full `alias/model` → `registry.chatCompletion` → `getCandidateProvidersForModel`
(never touches `custom_models`). Gating only the marketplace path would leak: a client naming the
model in full would still be served. So the enforcement point is a `ModelGate` dependency injected
into `ProviderRegistry` (`packages/providers` stays DB-agnostic), checked in every branch of
`getCandidateProvidersForModel` plus the default-provider tail. That single seam covers chat,
streaming, image generation and fallback targets. The marketplace chain additionally *filters*
disabled candidates so they never enter the quality-weighted primary pick.

### Decision 4 — Fail closed, and stay visible to the platform

A request that names a disabled model errors instead of silently falling back to another account's
key — routing to somebody else's supply behind a creator's back is the wrong default. Admin-facing
surfaces keep showing disabled entries (annotated `disabled: true` with reason/who/when) because a
rule the admin cannot see is a rule the admin cannot lift. Public surfaces drop them entirely.

### Non-Goals (YAGNI)

- No admin veto over *creator* listings yet — that needs a reason + notification path, deferred.
- No per-model pricing/offering expiry, no approval queue for models, no audit-log UI beyond the
  `disabled_by` + `created_at` columns already stored.
- No propagation guarantee tighter than the gate TTL (below).

---

## 2. Schema

```
disabled_models
  provider_id  TEXT NOT NULL   -- official: provider base id · creator: connection id
  model_id     TEXT NOT NULL   -- bare id, provider alias prefix stripped
  disabled_by  TEXT NOT NULL   -- admin user id (or "admin")
  reason       TEXT             -- optional, ≤500 chars
  created_at   INTEGER NOT NULL
  PRIMARY KEY (provider_id, model_id)
```

Declared in the `TABLES` array, so both engines (`node:sqlite` and Postgres via `DATABASE_URL`)
auto-create it; one index on `provider_id` in `INDEXES`. No `ensureColumns` migration needed —
the table is new.

`disableModelDB` upserts with `ON CONFLICT (provider_id, model_id) DO UPDATE`, so re-disabling
refreshes reason/who/timestamp instead of erroring. Bulk insert uses the multi-row `VALUES` form
with the same conflict target; bulk enable is a single `DELETE ... WHERE provider_id = ? AND
model_id IN (...)`. `?` placeholders go through the existing `toPg` translation.

---

## 3. Enforcement points (the whole list)

| Surface | File | Behaviour |
| :--- | :--- | :--- |
| Marketplace chain (bare model) | `apps/api/src/logic/routing.logic.ts` | Disabled candidates filtered out of the quality-weighted chain |
| Every registry route (full `alias/model`) | `packages/providers/src/registry.ts` | `ModelGate` filters each candidate; when it vetoes every match (or the default fallback) it throws `ModelDisabledError` → `Model "x" is disabled on this gateway.` |
| `/v1/models`, `/v1/models/:model`, `/user/v1`, `/official/v1` | `apps/api/src/logic/models.logic.ts` | `ExcludeDisabled` fans the denylist keys out to every runtime alias they own and drops matches |
| Public storefront | `apps/api/src/routes/v1/catalog.ts` | `EnabledListings` = `SelectMarketplaceRows` minus `SelectDisabledModelIds` |
| Admin provider detail | `apps/api/src/logic/providers.logic.ts` | Annotates `disabled: true`, never hides |
| Status mapping (chat / messages / images) | `apps/api/src/utils/response.ts` | `InferenceErrorStatus` renders the veto as `400`, not `503`/`500` |

Gate cache: `apps/api/src/services/registry.ts` keeps a 30 s snapshot of `getAllDisabledModelsDB()`
(`DISABLED_GATE_TTL_MS`), with in-flight de-duplication, and checks both the connection key and the
base key. Writes call `InvalidateDisabledModelsCache()` + `InvalidateRouteCache()` +
`registry.clearModelsCache()`, so the admin who disabled a model is immediate; other workers settle
within 30 s. That TTL is the accepted staleness budget.

---

## 4. API (all `RequireAdmin`, session cookie accepted inside `ApiKeyAuth`)

| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| `POST` | `/v1/providers/:providerId/models/disable` | body `{ model_id, reason? }` |
| `POST` | `/v1/providers/:providerId/models/enable` | body `{ model_id }` |
| `POST` | `/v1/providers/:providerId/models/bulk-disable` | body `{ models[], reason? }`, ≤300 |
| `POST` | `/v1/providers/:providerId/models/bulk-enable` | body `{ models[] }` |
| `GET` | `/v1/providers/:providerId/models/disabled` | governance metadata |

The model id rides in the **body**, never the path: upstream ids legitimately contain slashes
(`meta-llama/Llama-3`) and a path param would collide with the action segment. Ids are normalized
with `StripProviderPrefix`, which removes a leading segment only when it matches this provider's own
alias/base id, so slashed ids survive untouched.

---

## 5. Admin UI

`admin.providers/$providerId` model table/cards:

- Row state is real: `Active` (pulse) vs `Disabled` (dashed border, struck-through id, muted).
- Per row: `Disable` (amber, `Ban`) ↔ `Enable` (emerald, `RotateCcw`). Hard delete remains only for
  custom listings — a live model is disabled, never deleted, because the driver will re-discover it.
- Multi-select HUD gains bulk Disable/Enable; the section header shows `N disabled` + **Enable all**.
- `Manage Models` dialog removal now disables live models server-side instead of writing
  `localStorage`. The `xeygate_deleted_models_*` keys are abandoned; nothing reads them.

---

## 6. Verification notes

- Fallback chains: `ResolveCandidates` appends `rule.targetModel` unfiltered, but
  `ShouldTriggerFallback` short-circuits on the gate's message (`… is disabled on this
  gateway.`) before consulting `triggerOnStatus`, so an admin veto is never laundered into a
  fallback to another model. The refusal surfaces as `400 invalid_request_error` from
  chat/messages/images via `InferenceErrorStatus`.
- `GetProviderById` returns disabled models on purpose; the *public* provider read is the same
  payload, so an admin-only field is exposed on an `ApiKeyAuth` route as a bare boolean. Accepted
  (no secret, and the storefront/`/v1/models` already hide it) — revisit if listing privacy matters.
- `disabled_models` rows for a deleted connection are removed with it
  (`deleteDisabledModelsByProviderDB`), so no orphan rules resurface under a recycled id.
