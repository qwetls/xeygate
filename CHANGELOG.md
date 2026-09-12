# Changelog

All notable changes to **XEYGATE** are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **GitHub sign-in** — visitors can create an account and sign in with their GitHub account via a "Continue with GitHub" button on `/login` and `/register`, gated by the same Terms & Privacy checkbox as the email flow. The OAuth round-trip (`/v1/users/oauth/github/start` → GitHub → `/v1/users/oauth/github/callback`) is CSRF-guarded by a state cookie, stores the GitHub id on the account, and **links to an existing account with the same email** instead of creating a duplicate. It honors every existing rule: the admin registration gate (new GitHub accounts land as `pending` when enabled), bans, and server-side terms consent (new accounts are stamped from the checkbox flag; pre-consent accounts re-accept through the same flow). Subsequent GitHub sign-ins count as sign-ins for the daily login streak; accounts created through GitHub are registrations and never grant it. Falls back to the `ID+login@users.noreply.github.com` address when the profile email is private. The button hides itself (`GET /v1/users/oauth/github/status`) until the instance is configured with `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` for a GitHub OAuth App whose callback URL is `https://<host>/v1/users/oauth/github/callback`.

## [1.4.0] - 2026-09-12

### Added
- **Server-side terms consent** — the sign-up/sign-in checkbox is now enforced by the API, not just the UI. `POST /v1/users/register` rejects bodies without `accepted_terms: true` (`400 terms_not_accepted`) and stamps the new-account row with `accepted_terms_at` + `terms_version`; accounts created before the consent record (or consented to a stale ToS version) must re-accept once at `POST /v1/users/login` (`403 terms_required`) before a session is issued. `GET /v1/users/me` exposes both fields. Operator accounts (env bootstrap, legacy `admin_account` migration, first-run `/admin/bootstrap`) are stamped at provisioning time so admins are never locked out.

### Fixed
- **Marketplace no longer leaves the portal shell** — clicking **Marketplace** in the client/admin sidebar navigated to `/catalog`, a public standalone page with its own header; the sidebar and topbar vanished, making it feel like exiting to an external page. Signed-in users (any status except banned) now get `/catalog` rendered **inside** the client shell — the navbar stays put with Marketplace active in the breadcrumb — while anonymous visitors keep the original standalone storefront. The portal shell was extracted into a reusable `ClientShell` component shared with the `_client` layout.

## [1.3.0] - 2026-09-12

### Added
- **Public legal pages** — `/terms`, `/privacy`, `/acceptable-use` and `/refund`, written for how XEYGATE actually operates (prepaid credit wallet, admin-confirmed top-ups, third-party model routing, creator marketplace). Shared `LegalShell` layout with cross-links and a **Legal** column in the landing footer; sign-up and sign-in are gated by a required "I agree to the Terms of Service and Privacy Policy" checkbox (submit stays disabled until checked).
- **Client Billing page** (`/dashboard/billing`) — wallet balance hero, top-up orders (preset $10/$25/$50/$100 or custom $5–$10,000 with an optional payment reference), the buyer's order history, and the full transaction ledger (`GET /v1/users/transactions`, previously API-only) with load-more paging.
- **Top-up order flow** — buyers create an order and pay out-of-band (`POST /v1/users/topups`, one pending order per user, `POST /v1/users/topups/:id/cancel`); an admin reviews them at `/admin/topups` and **Approves** (wallet credited + `credit` ledger row, processed exactly once via a conditional state flip) or **Rejects** with a note. New endpoints: `GET /v1/admin/topups`, `POST /v1/admin/topups/:id/process`.

### Removed
- The simulated `POST /v1/users/credits/topup` MVP endpoint (added credits directly with no ledger entry and no payment step) — superseded by the order-based flow.

## [1.2.0] - 2026-09-11

### Added
- **Client Profile page** (`/dashboard/profile`) — display-name editing (`PATCH /v1/users/me`), wallet balance, account identity (id, member-since, status, creator access), and a live daily-streak progress bar fed by the new `loginStreak` field on `GET /v1/users/me`.
- **Client Settings page** (`/dashboard/settings`) — change password (other devices signed out, current session kept) and **Sign out everywhere** (`POST /v1/users/logout-all`, revokes every session including the caller's).
- Profile and Settings entries in the client sidebar navigation.

### Fixed
- **Marketplace header CTA for signed-in users** — `/catalog` always rendered "Sign in / Get started"; it now detects the active session (`GET /v1/users/me`) and shows a single **Dashboard** button instead, so the storefront no longer asks logged-in buyers to sign in again.

## [1.1.0] - 2026-09-11

### Added
- **Daily Login Rewards** — signing in credits the account wallet automatically: **+$8 on days 1–6 of a login streak, +$10 on day 7**, after which the cycle restarts. Granting is keyed to the UTC calendar day (extra logins the same day never double-credit); skipping a day resets the streak to day 1. Every reward lands as a `credit` row in the wallet ledger (`Daily login reward — day N of 7`) and is reported in the `POST /v1/users/login` response (`dailyReward`) with a toast on the dashboard sign-in page.
- **Sliding web sessions** — an authenticated request made while a session is under half its 30-day window refreshes it back to the full 30 days, so active users are never bounced to the login page mid-work; idle sessions still expire. (`packages/db` `user_sessions`)
- **Marketplace in navigation** — `/catalog` link added to both the admin sidebar and the client sidebar (the landing page already linked it).
- **Cache-Control on the SPA** — the HTML shell is served `no-cache` and hashed `/assets/*` files `public, max-age=31536000, immutable`, so a deploy actually reaches browsers instead of pinning a stale bundle (the SPA fallback HTML is excluded from the immutable rule).
- `GET /v1/quota` now reports a second tier of provider accounts (`quotaType: "usage_logged"`) aggregated from the 30-day request logs for every enabled provider without a live OAuth quota fetcher, so Quotas & Limits reflects real connected supply instead of only OAuth-supported drivers.

### Fixed
- **Playground model picker 500** (`e.filter is not a function`) — `ModelsLogic.List` awaited the combo-merge only outside the `"all"` scope, so the disabled-model filter received an unresolved Promise whenever at least one model was denylisted. `/v1/models` is now stable with an active denylist (regression-tested against the exact production trigger).
- Login/register/`change-password` session cookies now honor `SROUTER_SECURE_COOKIES` (previously the user-facing paths hardcoded `secure: false` while only the admin bootstrap respected the flag).

## [1.0.0] - 2026-09-09

### Added
- Initial public release of XEYGATE: cloud-first AI gateway with OpenAI- and Anthropic-compatible endpoints, multi-provider OAuth/API-key connectivity with background token refresh, failover & combo routing, virtual API keys with quota/credit limits, request logs & analytics, Cloudflare Tunnel support, the model-centric public storefront (`/catalog`), marketplace namespaces (`/user/v1`, `/official/v1`), creator listings with wallets & payouts, admin user management with account-based admins, bulk API-key import, and server-side model disable.
