# Design Specification: Fase D — Creator Payouts, Upstream Model & Quality Routing

- **Author**: Qwen & Xeyyzu
- **Date**: 2026-09-08
- **Status**: Implemented — DB, billing, API, web, routing shipped; tests cover payouts + routing math + alias billing.
- **Supersedes**: open design questions in `xeygate-marketplace-vision` (2026-09-06) — Q1 (who pays upstream) and Q3 (routing policy) are now ANSWERED below.

---

## 1. Overview & Decisions (the lock-in)

Fase D closes the last two open design questions of the marketplace pivot and adds the payout flow that makes "creator earns revenue" real. Everything below assumes **Fase B/C are already shipped**: credit ledger debits buyers, `creator_earnings` table exists with gross/platform_fee/net, admin sets retail pricing per provider+model in `model_pricing`, creators add their own upstream keys via `providers.owner_id`.

### Decision 1 — Upstream cost: **Creator bears it (Model A / reseller)**

- Creators bring their own upstream key/account and pay the real upstream provider themselves. The platform never sees or needs the creator's upstream cost.
- Admin sets **retail price** per model (already in `model_pricing.input/output`) and a **creator share %**.
- Creator payout per request = `retail × share` (credits). Platform fee = `retail × (1 − share)`.
- Self-selection keeps the catalog honest: if retail < a creator's upstream cost, they simply don't list that model.
- **Platform obligation:** admin must set retail above the typical upstream cost, or the catalog empties. XEYGATE already records `estimated_cost` in `request_logs`, so pricing can be calibrated against real cost data.

### Decision 2 — Routing across creators: **Quality-weighted + failover chain + floor**

- Retail is uniform per model, so routing is revenue distribution and must not be price-based.
- Each creator listing is scored on reliability: success rate + avg latency + uptime (from `request_logs`, windowed).
- Traffic share ∝ quality score, but every healthy creator keeps a **minimum floor** share (anti-churn for small creators).
- **Failover chain is mandatory**: creator A errors/429/timeout → automatically fall to B, then C (extends the existing admin-provider failover engine to the creator level).
- Explicit admin pinning (choose one creator for a model) is a later nicety, not MVP.

### Decision 3 — Share default: **80/20 (creator/platform), per-creator overridable**

- Default 80/20. Rationale: supply side is the scarce side in a young marketplace; 80% is a real-margin signal that attracts key owners. 20% covers infra/support and later payment fees.
- Stored as a **per-creator column** (not a constant) so high-quality/high-volume creators can be offered 85% as a retention lever.
- Easier to lower later than to raise.

### Decision 4 — Payouts: **internal balance first, real money later**

- Creator earnings already accrue to `creator_earnings` (gross/platform_fee/net). Fase D adds creator **payout requests** that convert accrued balance into a tracked payout record.
- Real-money withdrawal (Midtrans/Stripe) is explicitly out of scope for MVP; the ledger is built so a payment provider can be attached later.

### Non-Goals (YAGNI) for Fase D

- No real-money payouts, no tax/withholding, no creator "pricing their own markup" (admin-only retail), no reputation UI, no per-key analytics.
- No new charting or new dependencies beyond what the API already uses.

---

## 2. Schema Changes

All additive — no rewrite of existing tables.

### 2.1 `users` — creator share (packages/db/src/users.ts, migration pattern as before)

```sql
ALTER TABLE users ADD COLUMN creator_share REAL NOT NULL DEFAULT 0.80;
```

- `creator_share` ∈ (0,1], default 0.80. Admin can raise per creator (e.g. 0.85).
- Backfilled automatically by the DEFAULT for existing approved creators.

### 2.2 New table `payouts`

```sql
CREATE TABLE IF NOT EXISTS payouts (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,            -- creator receiving the payout
    amount         REAL NOT NULL,            -- net amount paid out
    currency       TEXT NOT NULL DEFAULT 'USD',
    status         TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed | cancelled
    requested_at   INTEGER NOT NULL,
    processed_at   INTEGER,                  -- set when admin marks paid/failed
    note           TEXT
);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id, requested_at DESC);
```

Registered in the `TABLES` registry + index list inside `packages/db/src/db.ts` (unlike `users`, which lives only in `users.ts`, `payouts` should follow the db.ts registry convention used by `creator_earnings`).

### 2.3 Routing metadata (optional for MVP — see §4)

If quality routing ships with an explicit score cache: `creator_quality(user_id, model)` cached windowed aggregates. Default: compute on demand from `request_logs`; only add the table if query cost proves too high.

---

## 3. Ledger & Payout Flow

### 3.1 Earning (already exists, verify wiring)

`settleMarketplaceUsage` writes `creator_earnings` rows with gross/platform_fee/net. Fase D only adds the **payout-side**:

- `POST /v1/creators/payouts/request` (RequireCreator): converts available net balance → `payouts` row `pending`. Guard: minimum amount (e.g. $10), no duplicate pending request.
- `GET /v1/creators/payouts` (RequireCreator): list own payouts + available balance summary.
- `POST /v1/admin/payouts/:id/process` (RequireAdmin): `pending → paid|failed` (+ `processed_at`, optional note). Admin performs the off-platform money movement (manual bank transfer for MVP).

### 3.2 Where does the money come from?

Buyer credits are the platform's liability. Creator earnings accrue as platform debt. Payout = reducing that debt — no new money movement until real withdrawal. This keeps MVP fully internal and auditable via the two ledgers (`credit_ledger` debits, `creator_earnings` credits).

---

## 4. Routing Design (reference for implementation)

```
selectCreatorForRequest(model, candidates):
  healthy = [c for c in candidates if qualityScore(c) >= MIN_QUALITY]
  if not healthy: healthy = candidates            # fall back — better a slow key than none
  weights  = [qualityScore(c) for c in healthy]   # success_rate dominant, latency penalty
  chosen   = weightedRandom(healthy, weights)
  attempt  = requestVia(chosen)
  if attempt fails (5xx/429/timeout):
      remaining = healthy - chosen
      return failoverChain(remaining, attempt)    # existing executor failover, creator-aware
```

- Quality score per creator+model computed from `request_logs` window (default 24h): `successRate`, `avgLatencyMs`, sample count. Floor share enforced when building weights (e.g. floor weight = 15% of the max weight).
- Admin UI: per-model creator listing with live quality % and an optional "disable" toggle (existing moderation surface).

---

## 5. API Surface (draft)

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/creators/payouts` | RequireCreator | List payouts + available balance |
| `POST` | `/v1/creators/payouts/request` | RequireCreator | Request payout (min $10, no dup pending) |
| `POST` | `/v1/admin/payouts/:id/process` | RequireAdmin | `pending → paid/failed` |
| `PATCH` | `/v1/admin/users/:id/share` | RequireAdmin | Adjust creator_share |

Web: creator "Payouts" view under client dashboard (balance, request button, history table); admin "Payouts" page (pending list → process) + share column in `/admin/users`.

---

## 6. Verification Plan

1. **DB migration test**: `users.creator_share` default 0.80 on existing + new rows; `payouts` table creation + index.
2. **API tests** (`apps/api/tests/payouts.test.ts`): creator requests payout → pending row + balance reduced; duplicate pending rejected; buyer cannot request; admin process transitions pending→paid; balance math consistent with `creator_earnings` net totals.
3. **Routing test**: seeded quality scores route more traffic to high-score creator while floor keeps the low-score creator above zero; failover hits B when A errors.
4. **Build gate** (per convention, via CI): types → api → web.

---

## 7. Implementation Checklist (follow-up PR)

- [ ] `packages/db` — `users.creator_share` migration; `payouts` table (db.ts registry + helpers `listPayoutsDB`/`createPayoutRequestDB`/`processPayoutDB`/`getAvailableBalanceDB`)
- [ ] `packages/db` — routing: `getCreatorQualityDB(model, window)` + weighted/failover selection in executor layer (creator-aware, reusing existing failover)
- [ ] `apps/api` — payout routes/controller + share PATCH; wire `settleMarketplaceUsage` to read `creator_share` when crediting
- [ ] `apps/web` — creator Payouts view; admin Payouts page + share editor; routeTree.gen.ts manual patch
- [ ] Tests per §6; README + docs update per convention
