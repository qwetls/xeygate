#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# XEYGATE Docker Setup Script
# Run on Debian VPS as root:
#   curl -sL https://raw.githubusercontent.com/qwetls/xeygate/main/setup.sh | bash
# ──────────────────────────────────────────────────────────────
set -euo pipefail

APP="xeygate"
APP_DIR="/opt/$APP"
REPO="https://github.com/qwetls/xeygate.git"
BRANCH="main"
PORT="${PORT:-3000}"
OAUTH_PORT="${OAUTH_PORT:-1455}"

echo ""
echo "══════════════════════════════════════════"
echo "  ⚡ XEYGATE Docker Setup"
echo "══════════════════════════════════════════"
echo ""

# ── 1. Install Docker ──
if command -v docker &>/dev/null; then
    echo "✅ Docker $(docker --version | awk '{print $3}' | tr -d ',')"
else
    echo "📦 Installing Docker..."
    export DEBIAN_FRONTEND=noninteractive

    # Repair apt and make sure basic helpers are present
    apt-get update -qq
    dpkg --configure -a || true
    apt-get -f install -y || true
    apt-get install -y -qq ca-certificates curl gnupg apt-transport-https lsb-release >/dev/null || true

    # Ensure nftables is available (required by upstream docker-ce)
    if ! apt-cache policy nftables | grep -q Candidate; then
        CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
        cat >/etc/apt/sources.list.d/debian-main.list <<EOF
deb http://deb.debian.org/debian ${CODENAME} main contrib non-free
deb http://deb.debian.org/debian ${CODENAME}-updates main contrib non-free
deb http://security.debian.org/debian-security ${CODENAME}-security main contrib non-free
EOF
        apt-get update -qq
    fi

    if ! apt-get install -y -qq nftables >/dev/null 2>&1; then
        echo "⚠️  Could not install nftables from apt; docker-ce may fail. Continuing and will attempt fallback."
    fi

    # Add Docker GPG key + repo (avoid interactive overwrite)
    install -m 0755 -d /etc/apt/keyrings
    rm -f /etc/apt/keyrings/docker.gpg
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list

    apt-get update -qq

    # Try upstream docker-ce first, fall back to docker.io if it fails
    if apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null 2>&1; then
        echo "✅ Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    else
        echo "⚠️  docker-ce install failed; falling back to distro docker package (docker.io)"
        apt-get update -qq
        apt-get install -y -qq docker.io docker-compose-plugin >/dev/null
        echo "✅ Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    fi

    systemctl enable --now docker || true
fi

# ── 2. Install Docker Compose plugin (if missing) ──
if docker compose version &>/dev/null; then
    echo "✅ Docker Compose $(docker compose version --short)"
else
    echo "📦 Installing Docker Compose plugin..."
    apt-get update -qq
    apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 \
        || apt-get install -y -qq docker-compose-v2 >/dev/null 2>&1 \
        || { echo "   ⚠️  Compose plugin unavailable — trying standalone..."; apt-get install -y -qq docker-compose >/dev/null; }
    echo "✅ Docker Compose $(docker compose version --short 2>/dev/null || docker-compose --version)"
fi

# ── 3. Clone or pull repo ──
if [ -d "$APP_DIR/.git" ]; then
    echo "📥 Pulling latest..."
    cd "$APP_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
else
    echo "📥 Cloning XEYGATE..."
    git clone --branch "$BRANCH" --depth 1 "$REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

# ── 4. Create .env if missing ──
if [ ! -f "$APP_DIR/.env" ]; then
    echo "📝 Creating .env..."
    JWT_SECRET=$(openssl rand -hex 32)
    cat > "$APP_DIR/.env" << EOF
# ── XEYGATE Environment ──
PORT=$PORT
OAUTH_PORT=$OAUTH_PORT
NODE_ENV=production
DATABASE_PATH=/app/data/xeygate.db
JWT_SECRET=$JWT_SECRET
# PUBLIC_URL=https://your-domain.com
EOF
    echo "   ✅ Generated JWT_SECRET"
else
    echo "✅ .env already exists"
fi

# ── 5. Create data directory ──
mkdir -p "$APP_DIR/data"

# ── 6. Build & start container ──
echo ""
echo "🔨 Building Docker image..."
docker compose build --no-cache

echo ""
echo "🚀 Starting XEYGATE..."
docker compose up -d

# ── 7. Wait for health check ──
echo "⏳ Waiting for XEYGATE to be healthy..."
for i in $(seq 1 30); do
    if docker compose ps --format json 2>/dev/null | grep -q '"healthy"'; then
        break
    fi
    # Fallback: check if container is running
    if [ "$i" -eq 30 ]; then
        echo "⚠️  Health check timed out — check logs with: docker compose logs"
    fi
    sleep 2
done

# ── 8. Firewall (if ufw is installed) ──
if command -v ufw &>/dev/null; then
    echo "🔓 Opening firewall ports $PORT and $OAUTH_PORT..."
    ufw allow "$PORT"/tcp >/dev/null 2>&1 || true
    ufw allow "$OAUTH_PORT"/tcp >/dev/null 2>&1 || true
fi

# ── Done ──
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "══════════════════════════════════════════"
echo "  ⚡ XEYGATE is live!"
echo ""
echo "  🌐 Dashboard:  http://$IP:$PORT"
echo "  📊 Logs:       docker compose logs -f"
echo "  🔄 Restart:    docker compose restart"
echo "  ⛔ Stop:       docker compose down"
echo "  📦 Update:     cd $APP_DIR && bash setup.sh"
echo "══════════════════════════════════════════"
echo ""
