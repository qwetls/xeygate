#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# XEYGATE VPS Deploy Script
# Run this ONCE on your VPS as root:
#   curl -sL <raw-url>/deploy.sh | bash
# Or copy-paste manually.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

APP="xeygate"
APP_DIR="/opt/$APP"
REPO="https://github.com/XeyCompany/xeygate.git"
BRANCH="main"
PORT="${PORT:-4000}"
NODE_MAJOR=22

echo "⚡ XEYGATE Deploy — starting..."

# ── 1. System deps ──
if command -v apt-get &>/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl git build-essential >/dev/null
elif command -v dnf &>/dev/null; then
    dnf install -y -q curl git gcc-c++ make >/dev/null
fi

# ── 2. Node.js ──
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "$NODE_MAJOR" ]]; then
    echo "📦 Installing Node.js $NODE_MAJOR..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - >/dev/null 2>&1
    if command -v apt-get &>/dev/null; then
        apt-get install -y -qq nodejs >/dev/null
    else
        curl -fsSL https://rpm.nodesource.com/setup_${NODE_MAJOR}.x | bash - >/dev/null 2>&1
        dnf install -y -q nodejs >/dev/null
    fi
fi
echo "✅ Node $(node -v)"

# ── 3. pnpm ──
if ! command -v pnpm &>/dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm@latest >/dev/null
fi
echo "✅ pnpm $(pnpm -v)"

# ── 4. Clone / pull ──
if [ -d "$APP_DIR/.git" ]; then
    echo "📥 Pulling latest..."
    cd "$APP_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
else
    echo "📥 Cloning repo..."
    git clone --branch "$BRANCH" --depth 1 "$REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

# ── 5. Install deps & build ──
echo "🔨 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo "🔨 Building..."
pnpm build

# ── 6. Create systemd service ──
cat > /etc/systemd/system/$APP.service << EOF
[Unit]
Description=XEYGATE AI Gateway
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$(which node) apps/api/dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=DATABASE_PATH=$APP_DIR/data/xeygate.db

# Security
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR/data

[Install]
WantedBy=multi-user.target
EOF

mkdir -p "$APP_DIR/data"
systemctl daemon-reload
systemctl enable $APP
systemctl restart $APP

echo ""
echo "══════════════════════════════════════════"
echo "  ⚡ XEYGATE deployed successfully!"
echo "  🌐 http://$(hostname -I | awk '{print $1}'):$PORT"
echo "  📊 systemctl status $APP"
echo "  📋 journalctl -u $APP -f"
echo "══════════════════════════════════════════"
