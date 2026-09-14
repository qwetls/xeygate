<div align="center">

# ⚡ XEYGATE

**Cloud-first AI gateway & LLM proxy for OpenAI, Anthropic, and custom models.**

One stable API key. Every provider. Automatic routing, OAuth refresh, failover, and live telemetry.

<p>
  <a href="https://github.com/qwetls/xeygate/releases"><img src="https://img.shields.io/badge/version-v1.6.0-6366f1?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="MIT License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://hono.dev/"><img src="https://img.shields.io/badge/Hono-v4-e36002?style=flat-square" alt="Hono"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-v19-61dafb?style=flat-square&logo=react&logoColor=black" alt="React"></a>
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-WAL-003b57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite"></a>
</p>

[Quick Start](#-quick-start) • [Providers](#-supported-providers) • [Coding Tools](#-connect-coding-tools) • [Integrate](#-integrate) • [Features](#-core-features) • [Architecture](#-architecture) • [API](#-api-endpoints) • [Docker](#-docker) • [Changelog](CHANGELOG.md)

</div>

---

## ⚡ Quick Start

Get XEYGATE running locally in under a minute.

### Option A: Docker (Recommended)

```bash
docker run -d \
  --name xeygate \
  --restart unless-stopped \
  -p 3000:3000 \
  -p 1455:1455 \
  -v $HOME/.xeygate:/root/.xeygate \
  ghcr.io/qwetls/xeygate:latest
```

### Option B: Local Node.js

```bash
git clone https://github.com/qwetls/xeygate.git
cd xeygate
pnpm install
pnpm build
pnpm start
```

Open **`http://localhost:3000`** to access the dashboard. Configure your provider accounts under **Providers**, generate a virtual key in **API Keys**, and test endpoints immediately in **Playground**.

### Admin Access

There is no separate admin login. An **admin is an ordinary user account** flagged `is_admin` — it signs in through the same `/login` page as everyone else and lands on `/admin`; non-admin accounts cannot reach any admin surface (routes return 401/403 and the Admin nav item stays hidden).

- **First run:** while no admin exists, `/admin` shows a claim form (`POST /v1/admin/bootstrap`, first-come-wins). The claimer is signed in immediately.
- **Recovery / headless:** set `SROUTER_ADMIN_PASSWORD` (optionally `SROUTER_ADMIN_EMAIL`, default `admin@xeygate.local`) — every boot ensures that account exists and its password is reset, so a lost admin password is recoverable from the environment.
- **Managing admins:** existing admins promote or demote accounts from `/admin/users`. The last remaining admin cannot be demoted (409), and demoting revokes that account's sessions.
- **Password change:** `POST /v1/users/change-password` rotates the password and invalidates all previous sessions.
- **Brute-force guard:** `/v1/users/login` locks an address for 15 minutes after 5 failed attempts (429).

---

## 🔌 Connect Coding Tools

Use `@xeygate/cli` to configure AI developer tools with one command:

```bash
# Interactive setup wizard
npx @xeygate/cli setup

# Check status & link tools
npx @xeygate/cli doctor
npx @xeygate/cli link claude --model claude-3-7-sonnet
npx @xeygate/cli link opencode --model antigravity/gemini-3.7-flash-high

# Run tools directly wrapped in XEYGATE environment
npx @xeygate/cli run claude
```

### Manual Configuration (Cursor / Windsurf / Cline / Continue)

Point your editor or extension to your local XEYGATE instance:
- **Base URL:** `http://localhost:3000/v1`
- **API Key:** `sr-live-your_key` (or your master admin key)
- **Model:** Any model from `http://localhost:3000/v1/models` (e.g. `antigravity/gemini-3.7-flash-high`, `openai_codex/gpt-4o`)

---

## 🌐 Supported Providers

XEYGATE normalizes authentication and protocol differences across all major model providers:

| Provider | Model Prefix | Auth Method | Streaming | Live Quota |
| :--- | :--- | :--- | :---: | :---: |
| **Google Antigravity** | `antigravity/*` | OAuth 2.0 PKCE | ✅ | ✅ |
| **OpenAI Codex / ChatGPT** | `openai_codex/*` | OAuth 2.0 PKCE | ✅ | ✅ |
| **Anthropic Claude** | `anthropic/*` | API Key / OAuth | ✅ | ✅ |
| **OpenCode Zen** | `opencode_zen/*` | Free / Access Token | ✅ | ✅ |
| **Amazon Q / Kiro** | `kiro/*` | SigV4 / API Key | ✅ | ✅ |
| **Qoder** | `qoder/*` | OAuth / Device Token | ✅ | ✅ |
| **GoRouter** | `gorouter/*` | API Key | ✅ | ✅ |
| **BluesMinds** | `bluesminds/*` | API Key | ✅ | ✅ |
| **SeekAI / TabiToken** | `seekai/*`, `tabitoken/*` | API Key | ✅ | ✅ |
| **Custom Endpoints** | `custom/*` | Custom Headers | ✅ | Configurable |

---

## 💻 Integrate

XEYGATE exposes standard OpenAI and Anthropic compatible interfaces.

### OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="sr-live-your_virtual_key"
)

stream = client.chat.completions.create(
    model="antigravity/gemini-3.7-flash-high",
    messages=[{"role": "user", "content": "Explain vector embeddings in one sentence."}],
    stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

### Anthropic SDK (TypeScript)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
    baseURL: "http://localhost:3000/v1",
    apiKey: "sr-live-your_virtual_key"
});

const message = await client.messages.create({
    model: "anthropic/claude-3-7-sonnet",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello from XEYGATE!" }]
});

console.log(message.content[0].text);
```

### cURL

```bash
curl -N http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sr-live-your_virtual_key" \
  -d '{
    "model": "antigravity/gemini-3.7-flash-high",
    "messages": [{"role": "user", "content": "Ping!"}],
    "stream": true
  }'
```

---

## 🎯 Core Features

- **Unified Protocol Translation:** OpenAI `chat/completions` ↔ Anthropic `messages` format translation.
- **Automated OAuth Refresh:** Background sweeper keeps short-lived OAuth sessions alive.
- **Failover & Smart Combo Routing:** Cascade fallback chains recover from rate limits (`429`) or provider outages.
- **Token Saver Engine:** Prompt compression and tool output optimization to cut inference cost.
- **Virtual API Keys:** Scoped keys (`sr-live-*`) with rate limits, token quotas, and credit limits.
- **Cloudflare Tunnel:** Expose your gateway securely with zero open ports.
- **Embedded Observability:** Track token usage, cache efficiency, and estimated costs in real-time.
- **Admin User Management:** Approve pending registrations and creator requests, ban/unban accounts, and revoke a user's API access (`/admin/users`).
- **Account-Based Admins:** Admins are regular user accounts flagged `is_admin` — one login path, promote/demote from `/admin/users`, first-run claim at `/admin`, and env-password recovery (`SROUTER_ADMIN_PASSWORD`).
- **Creator Approval Workflow:** Upgrades to creator require admin approval — the account keeps the buyer role until approved. Applications are gated by an **admin toggle** (settings → Security → "Open Creator Applications", default closed) and submitted with a short form (brand name, intended offer, optional link) that admins review on `/admin/users` before approving or rejecting.
- **Registration Gate (optional):** Toggle admin approval for new sign-ups from the admin settings.
- **GitHub Sign-in (optional):** "Continue with GitHub" on `/login` and `/register` creates or signs into accounts via the GitHub OAuth flow — CSRF-guarded state round-trip, same-email accounts are **linked** rather than duplicated, and the registration gate, bans, and server-side terms consent all apply exactly as in the email path. Hidden profile emails fall back to the GitHub `ID+login@users.noreply.github.com` address. Enable by setting `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` for a GitHub OAuth App whose callback URL is `https://<host>/v1/users/oauth/github/callback`; the button hides automatically while unconfigured.
- **Platform Analytics:** Marketplace-wide metrics (users, creators, models, requests/tokens, top users) on the admin dashboard, plus a public overview for every portal user.
- **Creator Wallets & Payouts:** Requests accrue creator earnings (default 80/20 share, admin-tunable per creator); creators withdraw via payout requests that admins mark paid/failed (`/dashboard/payouts`, `/admin/payouts`).
- **Daily Login Rewards:** Signing in credits the wallet automatically — **+$8 on days 1–6 of a login streak, +$10 on day 7**, then the cycle restarts. At most one grant per UTC day (extra logins don't double-credit), every reward is itemized in the wallet ledger, and skipping a day resets the streak.
- **Client Billing & Top-ups:** `/dashboard/billing` — wallet balance, top-up orders (preset or custom amount + payment reference, one pending at a time, cancel anytime before review), order history, and the full transaction ledger. Orders are verified by an admin (`/admin/topups`) — approval credits the wallet instantly.
- **Client Profile & Settings:** `/dashboard/profile` — display name, wallet, account identity, and live streak progress; `/dashboard/settings` — change password (keeps your current session, signs out others) and sign out of every device at once.
- **Public Legal Pages:** `/terms`, `/privacy`, `/acceptable-use` and `/refund` — tailored to how the platform actually runs (prepaid credits, admin-confirmed top-ups, third-party model routing, marketplace conduct). Linked from the landing footer's **Legal** column; sign-up and sign-in require checking agreement to the Terms & Privacy first. Consent is enforced **server-side**: registration without `accepted_terms` is rejected (`400 terms_not_accepted`), each account stores `accepted_terms_at` + `terms_version`, and pre-consent accounts must re-accept once at sign-in (`403 terms_required`).
- **Quality-Weighted Marketplace Routing:** Marketplace model requests (`"gpt-4o"`, or any listing id whose first path segment is not a provider — including ids that legitimately contain a slash, like `"cx/gpt-6-astra"`) auto-route across every creator listing that model — success-rate + latency weighted primary pick, mandatory failover chain, circuit-breaker aware, with a floor share for weaker-but-working listings.
- **Marketplace Namespaces:** `/user/v1` serves creator-owned listings only; `/official/v1` serves platform-official (admin-account-owned) listings only. The unscoped `/v1` continues to serve both for backward compatibility. Official listings live under the shared base provider id and are inherited by every admin key of that driver; creator listings stay connection-scoped so the two key spaces never mix.
- **Public Marketplace Analytics:** OpenRouter-style aggregate endpoints — no authentication, no caller-identifying data (`api_key_id`, IP, user agent, spend are never returned), and the finest window is 24h so per-request activity cannot be correlated from the outside. The same data surfaces in `/dashboard/analytics` for both buyers and creators, with a 24h/7d/30d window picker, traffic and token charts, model leaderboard, and endpoint performance tables.
- **Model-Centric Storefront:** The public marketplace (`/catalog`) is a flat list of every supplied model — not provider cards. Each row shows the cheapest per-1M-token price across providers, the number of supply endpoints, and models.dev metadata (description, context window, modalities, reasoning/tool capabilities). The same model listed on several endpoints is **one entry**, not one per prefix: entries group by bare model id, the prefix-free id stays canonical and requestable, and prefixed variants (e.g. `neko/hy3` alongside `hy3`) survive as aliases that still resolve through the detail lookup — offers from every endpoint merge with the cheapest highlighted. Clicking a model opens a detail page (`/catalog/{model}`) with the full provider pricing table (best price highlighted), live request stats behind a 24h/7d/30d window picker, traffic sparkline, and per-endpoint performance. For signed-in users the storefront renders **inside** the portal shell (sidebar + topbar stay); anonymous visitors get the standalone public header.
- **Admin Model Management:** On any provider page, admins open *Manage Models* to fetch the upstream model list, tick-select multiple models (search + select-all), register them in bulk, or remove selected custom listings. Every model row also carries an explicit marketplace state — **Listed** (published in the public catalog) vs **Not listed** — with one-click List / Unlist per model and bulk List/Unlist in the selection toolbar. Model IDs are normalized server-side (a leading provider-alias segment is stripped) so the catalog stays consistent with the routing keys.
- **Bulk API Key Import:** On any provider page, *Bulk Keys* accepts a pasted list (one key per line, or comma-separated; up to 500 per batch) and registers one connection per key under the same driver. Connection ids fold back to the driver base id, so the catalog card and round-robin pool treat them as one endpoint group. Duplicate keys are deduped in the batch and skipped when the same owner already has that key saved — re-pasting a list never doubles the pool. Traffic spread is auditable: every request records the concrete connection that served it (`served_provider_id`), so the pool's round-robin distribution can be verified per key from the logs. The **My APIs** page correctly shows the model count for bulk connections by inheriting base-id catalog listings, so every key in the pool reflects the same models the admin registered once. Available on both the admin surface (`POST /v1/providers/bulk`) and the creator surface (`POST /v1/providers/mine/bulk`).
- **Server-Side Model Disable:** Disabling a model is a platform rule, not a browser preference. `disabled_models` is keyed like the listings (`custom_models`) — platform rules under the shared base provider id so every key of that driver inherits them, custom connections keeping their own UUID key space — and is enforced at one central chokepoint in the provider registry plus the marketplace routing chain. A disabled model disappears from `/v1/models`, the namespace lists, and the public storefront, and any request naming it fails closed with `400` instead of silently serving another account's key or being laundered through a fallback rule. Admins still see disabled entries on the provider page (with reason + who/when) and can re-enable individually or in bulk.

---

## 🏗️ Architecture

### High-Level System Overview

```mermaid
graph TB
    subgraph Clients
        SDK[OpenAI / Anthropic SDK]
        CLI[xeygate/cli]
        WEB[Browser - Dashboard]
        CURL[curl / HTTP clients]
    end

    subgraph XEYGATE[Gateway]
        AUTH[Auth Layer<br/>API Key + Session + CSRF]
        ROUTER[Quality-Weighted Router<br/>Failover + Round-Robin]
        REG[Provider Registry<br/>OAuth Refresh + Model Cache]
        LOGS[Request Logs<br/>served_provider_id Audit]
        CATALOG[Marketplace Catalog<br/>Namespaces + Storefront]
    end

    subgraph Providers
        AG[Antigravity<br/>OAuth PKCE]
        BAI[B.AI<br/>API Key Pool x100]
        OAI[OpenAI Codex<br/>OAuth PKCE]
        ANT[Anthropic<br/>API Key]
        MORE[GoRouter Kiro<br/>Qoder Custom]
    end

    subgraph Data
        DB[(SQLite WAL<br/>srouter.db)]
        MODELS[(custom_models +<br/>disabled_models)]
    end

    SDK & CLI & CURL --> AUTH
    WEB --> AUTH
    AUTH --> ROUTER
    AUTH --> CATALOG
    ROUTER --> REG
    REG --> AG & BAI & OAI & ANT & MORE
    ROUTER --> LOGS
    LOGS --> DB
    REG --> DB
    CATALOG --> MODELS
```

### Entity-Relationship Diagram

```mermaid
erDiagram
    users {
        TEXT id PK
        TEXT email UK
        TEXT password_hash
        TEXT name
        TEXT role
        TEXT status
        TEXT creator_status
        REAL creator_share
        INTEGER is_admin
        REAL credits
        TEXT github_id UK
        INTEGER accepted_terms_at
        TEXT terms_version
        INTEGER created_at
        INTEGER updated_at
    }

    user_sessions {
        TEXT token_hash PK
        TEXT user_id FK
        INTEGER created_at
        INTEGER expires_at
    }

    login_rewards {
        TEXT user_id PK
        TEXT last_day
        INTEGER streak
    }

    creator_applications {
        TEXT user_id PK
        TEXT display_name
        TEXT reason
        TEXT link
        INTEGER created_at
        INTEGER updated_at
    }

    providers {
        TEXT id PK
        TEXT provider_id
        TEXT name
        TEXT alias
        TEXT category
        TEXT protocol
        TEXT base_url
        TEXT api_key
        TEXT access_token
        TEXT refresh_token
        TEXT account_id
        TEXT organization_id
        TEXT provider_specific_data
        TEXT custom_headers
        INTEGER token_expires_at
        INTEGER last_refreshed_at
        TEXT owner_id FK
        INTEGER enabled
        INTEGER created_at
    }

    api_keys {
        TEXT id PK
        TEXT key UK
        TEXT user_id FK
        TEXT name
        INTEGER enabled
        INTEGER rate_limit
        INTEGER quota_limit
        INTEGER usage_tokens
        REAL credit_limit
        REAL usage_cost
        TEXT allowed_models
        INTEGER created_at
    }

    custom_models {
        TEXT provider_id PK
        TEXT model_id PK
        INTEGER created_at
    }

    disabled_models {
        TEXT provider_id PK
        TEXT model_id PK
        TEXT disabled_by
        TEXT reason
        INTEGER created_at
    }

    model_pricing {
        TEXT id PK
        TEXT provider_id
        TEXT model
        REAL input
        REAL output
        REAL cached
        REAL cache_creation
        REAL reasoning
        INTEGER updated_at
        INTEGER created_at
    }

    request_logs {
        TEXT id PK
        TEXT api_key_id
        TEXT provider_id
        TEXT model
        TEXT served_provider_id
        INTEGER status_code
        INTEGER latency_ms
        INTEGER prompt_tokens
        INTEGER completion_tokens
        INTEGER total_tokens
        INTEGER cached_tokens
        INTEGER reasoning_tokens
        REAL estimated_cost
        INTEGER fallback_occurred
        TEXT fallback_path
        TEXT resolved_model
        TEXT ip_address
        TEXT user_agent
        INTEGER created_at
    }

    transactions {
        TEXT id PK
        TEXT user_id
        TEXT type
        REAL amount
        TEXT description
        TEXT provider_id
        TEXT model
        TEXT api_key_id
        INTEGER created_at
    }

    creator_earnings {
        TEXT id PK
        TEXT user_id
        TEXT provider_id
        REAL gross_amount
        REAL platform_fee
        REAL net_amount
        TEXT currency
        TEXT status
        TEXT transaction_id
        INTEGER created_at
    }

    topup_orders {
        TEXT id PK
        TEXT user_id FK
        REAL amount
        TEXT currency
        TEXT status
        TEXT reference
        TEXT note
        INTEGER requested_at
        INTEGER processed_at
        TEXT processed_by
    }

    payouts {
        TEXT id PK
        TEXT user_id FK
        REAL amount
        TEXT currency
        TEXT status
        INTEGER requested_at
        INTEGER processed_at
        TEXT note
    }

    users ||--o{ user_sessions : sessions
    users ||--o| login_rewards : streak
    users ||--o| creator_applications : applies
    users ||--o{ providers : owns
    users ||--o{ api_keys : keys
    users ||--o{ transactions : ledger
    users ||--o{ creator_earnings : earns
    users ||--o{ topup_orders : tops-up
    users ||--o{ payouts : withdraws
    providers ||--o{ custom_models : lists
    providers ||--o{ disabled_models : blocks
    providers ||--o{ model_pricing : prices
    providers ||--o{ request_logs : serves
    providers ||--o{ creator_earnings : generates
```

### Chat Completion Request Flow

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant G as XEYGATE
    participant A as Auth + Quota
    participant R as Router
    participant P as Provider Registry

    C->>G: POST /v1/chat/completions
    G->>A: Validate API Key / Session
    A-->>G: Auth OK + quota check

    G->>R: ResolveMarketplaceRoute(model)
    R->>R: BareModelId to look up custom_models
    R->>R: Build quality chain successRate x 0.7 + latency x 0.3
    R-->>G: Chain: primary, failover1, failover2

    loop For each candidate - failover on error
        G->>P: chatCompletion with onServed callback
        P->>P: Forward to upstream provider
        alt 2xx Success
            P-->>G: Response + servedProviderId
            G->>G: onServed(candidate.id)
        else 429 / 5xx / Timeout
            P-->>G: Error
            G->>G: Mark candidate unhealthy, try next
        end
    end

    G->>G: logRequestDB served_provider_id, model, tokens, latency
    G-->>C: Streaming / non-streaming response
```

### Marketplace Namespaces & Routing

```mermaid
graph LR
    subgraph Request[Incoming Model Request]
        REQ[model: gpt-4o]
    end

    REQ --> DETECT{First segment<br/>matches provider?}

    DETECT -->|Yes| CONN[Match connection by<br/>stored model id]
    DETECT -->|No| NS{Namespace?}

    NS -->|official| OFF[Official Listings<br/>admin-owned base-id shared]
    NS -->|user| CRE[Creator Listings<br/>user-owned connection-scoped]
    NS -->|v1| BOTH[Both - merge + dedupe]

    OFF --> CHAIN[Build quality chain]
    CRE --> CHAIN
    BOTH --> CHAIN

    CHAIN --> RR{Round-robin<br/>enabled?}
    RR -->|Yes| ROTATE[Rotate across pool<br/>of N connections]
    RR -->|No| PICK[Weighted random<br/>primary pick]

    ROTATE --> UP[Upstream Provider]
    PICK --> UP
    CONN --> UP

    UP -->|2xx| AUDIT[served_provider_id<br/>logged to request_logs]
    UP -->|429/5xx| FAILOVER[Next in failover chain]
    FAILOVER --> UP
```

---

## 📡 API Endpoints

All gateway endpoints are served under `/v1`:

### Inference & Models
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/v1/chat/completions` | OpenAI chat completion (streaming supported) |
| `POST` | `/v1/messages` | Anthropic messages endpoint |
| `GET` | `/v1/models` | List all discovered & connected models |
| `GET` | `/v1/models/:model` | Retrieve specific model schema & capabilities |
| `POST` | `/user/v1/chat/completions` | Chat completion routed across creator listings only |
| `POST` | `/official/v1/chat/completions` | Chat completion routed across platform-official listings only |
| `GET` | `/user/v1/models`, `/official/v1/models` | Namespace-scoped model lists |

### Management & Metrics
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check |
| `GET` | `/v1/quota` | Real-time provider balance & reset countdowns |
| `GET` / `POST` | `/v1/providers` | Read or connect provider accounts |
| `POST` | `/v1/providers/bulk` | Add many upstream keys as one connection each (admin session) |
| `POST` | `/v1/providers/mine/bulk` | Same for creator-owned connections (creator session) |
| `GET` / `POST` | `/v1/keys` | Manage virtual API keys |
| `POST` | `/v1/users/login` | Sign in — issues the 30-day sliding session cookie and grants the daily login reward (max once per UTC day) |
| `GET` / `PATCH` | `/v1/users/me` | Read own profile (incl. member-since + login streak) / update display name |
| `POST` | `/v1/users/logout-all` | Revoke every session of the account, including the current device |
| `GET` | `/v1/users/oauth/github/status` | Whether GitHub sign-in is configured on this instance |
| `GET` | `/v1/users/oauth/github/start` | Begin GitHub sign-in (`?consent=1` from the ToS checkbox) — redirects to GitHub |
| `GET` | `/v1/users/oauth/github/callback` | GitHub redirect target — links/creates the account and issues the session |
| `GET` / `POST` | `/v1/users/topups` | List own top-up orders (incl. the pending one) / create a top-up order (`$5–$10,000`, optional payment reference; one pending at a time) |
| `POST` | `/v1/users/topups/:id/cancel` | Cancel own pending top-up order |
| `GET` | `/v1/admin/topups` | Top-up review queue — pending by default, `?status=all` for history (`userId=` to filter by buyer) |
| `POST` | `/v1/admin/topups/:id/process` | Approve (credits the wallet + writes a ledger row) or reject a top-up order — exactly once |
| `GET` | `/v1/logs` | Query request audit logs and token telemetry |
| `GET` | `/v1/analytics/overview` | Public platform totals + time series (`?window=24h\|7d\|30d`) |
| `GET` | `/v1/analytics/models` | Public model leaderboard by token volume (`&limit=1..100`) |
| `GET` | `/v1/analytics/models/:model` | Public per-model page: endpoints serving it + series (404 when no traffic) |
| `GET` | `/v1/analytics/endpoints` | Public supply-side stats per connection (creator storefronts + official) |
| `GET` | `/v1/catalog` | Public storefront cards: every enabled provider with its listed models + merged pricing |
| `GET` | `/v1/catalog/models` | Public flat model list: one entry per stored listing id (advertised id = requestable id) — all offers, cheapest highlighted, models.dev metadata |
| `GET` | `/v1/catalog/models?model=` | Public per-model offerings: every provider listing that model with merged pricing |
| `GET` / `POST` | `/v1/tunnel/*` | Manage Cloudflare Tunnel daemon state |
| `GET` | `/v1/admin/status` | Setup probe — `{ setupRequired }` while no admin exists |
| `POST` | `/v1/admin/bootstrap` | First-run admin claim (rejected with 409 once an admin exists) |
| `POST` | `/v1/admin/users/:id/promote` | Grant the admin flag to an account |
| `POST` | `/v1/admin/users/:id/demote` | Revoke the admin flag (409 on last admin) |
| `POST` | `/v1/users/change-password` | Rotate password, revoking all prior sessions |
| `POST` | `/v1/providers/:providerId/models/disable` | Disable a model for a provider (requires admin session) |
| `POST` | `/v1/providers/:providerId/models/enable` | Re-enable a previously disabled model (requires admin session) |
| `GET` | `/v1/providers/:providerId/models/disabled` | List disabled models for a provider (requires admin session) |
| `POST` | `/v1/providers/:providerId/models/bulk-disable` | Disable multiple models at once (requires admin session) |
| `POST` | `/v1/providers/:providerId/models/bulk-enable` | Re-enable multiple models at once (requires admin session) |

---

## 🐳 Docker Compose

```yaml
services:
  xeygate:
    image: ghcr.io/qwetls/xeygate:latest
    container_name: xeygate
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"   # loopback-only by default — front it with nginx/TLS
      - "1455:1455"              # OAuth PKCE callback (must stay reachable)
    volumes:
      - ${HOME}/.xeygate:/root/.xeygate
    environment:
      - PORT=3000
      - NODE_ENV=production
      # Optional GitHub sign-in — create a GitHub OAuth App whose callback URL
      # is https://<your-host>/v1/users/oauth/github/callback:
      # - GITHUB_CLIENT_ID=Iv1...
      # - GITHUB_CLIENT_SECRET=...
```

---

## 🌐 Self-hosting Behind nginx (Domain + TLS)

Production instance at **https://gate.xeycompany.com** runs as the Docker Compose container above, fronted by nginx with TLS from Let's Encrypt:

1. **DNS** — point an `A` record for your subdomain at the VPS IP in **DNS only** mode (grey cloud). Proxy mode rewrites the Host and breaks the same-origin CSRF check on portal mutations.
2. **nginx vhost** — proxy the subdomain to the container with SSE-friendly settings:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name gate.xeycompany.com;

    client_max_body_size 50m;
    proxy_buffering off;                 # SSE / streaming responses
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }
}
```

3. **TLS** — `certbot --nginx -d gate.xeycompany.com --redirect` issues the certificate, installs the 443 block, and adds the HTTP→HTTPS redirect; renewal is automatic.
4. **Secure cookies** — set `SROUTER_SECURE_COOKIES=true` (and `SROUTER_CORS_ORIGINS=https://your-domain`) in `/opt/xeygate/.env`, then `docker compose up -d` so session cookies get the `Secure` flag.
5. **Loopback-only app port** — the compose stack publishes `127.0.0.1:3000` by default, so the gateway is unreachable over plaintext HTTP on the host interface; nginx is the only public door. Escape hatch for machines without a front proxy: `GATE_BIND=0.0.0.0` in `.env`.

---

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Start local dev server (API + Dashboard with HMR)
pnpm dev

# Quality checks
pnpm lint
pnpm test
pnpm build
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).

---

Built by **XeyCompany Group** — [xeycompany.com](https://xeycompany.com)
