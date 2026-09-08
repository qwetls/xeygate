<div align="center">

# ⚡ XEYGATE

**Cloud-first AI gateway & LLM proxy for OpenAI, Anthropic, and custom models.**

One stable API key. Every provider. Automatic routing, OAuth refresh, failover, and live telemetry.

<p>
  <a href="https://github.com/qwetls/xeygate/releases"><img src="https://img.shields.io/badge/version-v1.0.0-6366f1?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="MIT License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://hono.dev/"><img src="https://img.shields.io/badge/Hono-v4-e36002?style=flat-square" alt="Hono"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-v19-61dafb?style=flat-square&logo=react&logoColor=black" alt="React"></a>
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-WAL-003b57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite"></a>
</p>

[Quick Start](#-quick-start) • [Providers](#-supported-providers) • [Coding Tools](#-connect-coding-tools) • [Integrate](#-integrate) • [API](#-api-endpoints) • [Docker](#-docker)

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
- **Creator Approval Workflow:** Upgrades to creator require admin approval — the account keeps the buyer role until approved.
- **Registration Gate (optional):** Toggle admin approval for new sign-ups from the admin settings.
- **Platform Analytics:** Marketplace-wide metrics (users, creators, models, requests/tokens, top users) on the admin dashboard, plus a public overview for every portal user.
- **Creator Wallets & Payouts:** Requests accrue creator earnings (default 80/20 share, admin-tunable per creator); creators withdraw via payout requests that admins mark paid/failed (`/dashboard/payouts`, `/admin/payouts`).
- **Quality-Weighted Marketplace Routing:** Bare model requests (`"gpt-4o"`) auto-route across every creator listing that model — success-rate + latency weighted primary pick, mandatory failover chain, circuit-breaker aware, with a floor share for weaker-but-working listings.
- **Marketplace Namespaces:** `/user/v1` serves creator-owned listings only; `/official/v1` serves platform-official (admin-account-owned) listings only. The unscoped `/v1` continues to serve both for backward compatibility. Official listings live under the shared base provider id and are inherited by every admin key of that driver; creator listings stay connection-scoped so the two key spaces never mix.
- **Admin Model Management:** On any provider page, admins open *Manage Models* to fetch the upstream model list, tick-select multiple models (search + select-all), register them in bulk, or remove selected custom listings. Model IDs are normalized server-side (a leading provider-alias segment is stripped) so the catalog stays consistent with the routing keys.

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
| `GET` / `POST` | `/v1/keys` | Manage virtual API keys |
| `GET` | `/v1/logs` | Query request audit logs and token telemetry |
| `GET` / `POST` | `/v1/tunnel/*` | Manage Cloudflare Tunnel daemon state |
| `GET` | `/v1/admin/status` | Setup probe — `{ setupRequired }` while no admin exists |
| `POST` | `/v1/admin/bootstrap` | First-run admin claim (rejected with 409 once an admin exists) |
| `POST` | `/v1/admin/users/:id/promote` | Grant the admin flag to an account |
| `POST` | `/v1/admin/users/:id/demote` | Revoke the admin flag (409 on last admin) |
| `POST` | `/v1/users/change-password` | Rotate password, revoking all prior sessions |

---

## 🐳 Docker Compose

```yaml
services:
  xeygate:
    image: ghcr.io/qwetls/xeygate:latest
    container_name: xeygate
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "1455:1455"
    volumes:
      - ${HOME}/.xeygate:/root/.xeygate
    environment:
      - PORT=3000
      - NODE_ENV=production
```

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
