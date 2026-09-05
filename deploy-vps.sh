#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# XEYGATE VPS Deploy — satu command, semua di-handle
# Run as root:
#   bash deploy-vps.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

APP="xeygate"
APP_DIR="/opt/$APP"
REPO="https://github.com/qwetls/xeygate.git"
PORT="${PORT:-4000}"
NODE_REQUIRED=22

export HOME="${HOME:-/root}"

echo "⚡ XEYGATE Deploy — starting..."

# ── 1. System deps ──
echo "📦 Installing system dependencies..."
if command -v apt-get &>/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq 2>/dev/null || true
    apt-get install -y -qq curl git build-essential >/dev/null 2>&1
fi

# ── 2. Node.js via nvm (user-level, tidak ganggu system) ──
CURRENT_NODE=""
if command -v node &>/dev/null; then
    CURRENT_NODE="$(node -v | tr -d 'v' | cut -d. -f1)"
fi

if [ -z "$CURRENT_NODE" ] || [ "$CURRENT_NODE" -lt "$NODE_REQUIRED" ]; then
    echo "📦 Installing Node.js $NODE_REQUIRED via nvm..."

    # Setup nvm
    export NVM_DIR="$HOME/.nvm"
    if [ ! -d "$NVM_DIR" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash >/dev/null 2>&1
    fi

    # Load nvm
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    # Install Node 22
    nvm install 22 >/dev/null 2>&1
    nvm use 22 >/dev/null 2>&1
    nvm alias default 22 >/dev/null 2>&1

    # Make node available system-wide for systemd
    NODE_BIN="$(dirname "$(command -v node)")"
    ln -sf "$NODE_BIN/node" /usr/local/bin/node 2>/dev/null || true
    for bin in npm npx pnpm; do
        [ -f "$NODE_BIN/$bin" ] && ln -sf "$NODE_BIN/$bin" /usr/local/bin/$bin 2>/dev/null || true
    done
fi

echo "✅ Node $(node -v)"

# ── 3. pnpm ──
if ! command -v pnpm &>/dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm@latest 2>/dev/null
fi
echo "✅ pnpm $(pnpm -v)"

# ── 4. Clone / pull ──
if [ -d "$APP_DIR/.git" ]; then
    echo "📥 Pulling latest..."
    cd "$APP_DIR"
    git fetch origin main 2>/dev/null
    git reset --hard origin/main 2>/dev/null
else
    echo "📥 Cloning repo..."
    rm -rf "$APP_DIR"
    git clone --branch main --depth 1 "$REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

# ── 5. Install deps & build ──
echo "🔨 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo "🔨 Building..."
pnpm build

# ── 6. Create systemd service ──
NODE_PATH="$(command -v node)"
mkdir -p "$APP_DIR/data"

cat > /etc/systemd/system/$APP.service << EOF
[Unit]
Description=XEYGATE AI Gateway
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$NODE_PATH --experimental-sqlite apps/api/dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=DATABASE_PATH=$APP_DIR/data/xeygate.db
Environment=PATH=$NODE_PATH:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $APP
systemctl restart $APP

sleep 2

if systemctl is-active --quiet $APP; then
    echo ""
    echo "══════════════════════════════════════════"
    echo "  ⚡ XEYGATE deployed successfully!"
    echo "  🌐 http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "  📊 systemctl status $APP"
    echo "  📋 journalctl -u $APP -f"
    echo "══════════════════════════════════════════"
else
    echo "❌ Service failed to start. Check: journalctl -u $APP -n 50"
    systemctl status $APP --no-pager
fi
