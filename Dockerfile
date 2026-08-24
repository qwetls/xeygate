# ==============================================================================
# SRouter Production Multi-Stage Dockerfile
# ==============================================================================

# --- Stage 1: Base image with Node 22 & PNPM ---
FROM node:22-alpine AS base
WORKDIR /app

# Enable Corepack & prepare PNPM
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_PROJECT_SPEC=0
RUN corepack enable && corepack prepare pnpm@11.23.0 --activate

# --- Stage 2: Dependencies and Build ---
FROM base AS builder
ENV CI=true

# Copy package manifests for workspace dependency resolution & layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/constants/package.json ./packages/constants/
COPY packages/db/package.json ./packages/db/
COPY packages/executors/package.json ./packages/executors/
COPY packages/pricing/package.json ./packages/pricing/
COPY packages/providers/package.json ./packages/providers/
COPY packages/translator/package.json ./packages/translator/
COPY packages/types/package.json ./packages/types/

# Install all dependencies (including devDependencies needed for build)
RUN pnpm install --frozen-lockfile

# Copy full source tree
COPY . .

# Build all packages, API server, and web dashboard
RUN pnpm build

# Create a self-contained production dependency graph for the API.
# Injected workspace packages are copied into the deployment instead of
# remaining symlinks to the builder workspace.
RUN pnpm --config.inject-workspace-packages=true --filter api deploy --prod /app/deploy

# --- Stage 3: Production Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

# Install tzdata for accurate timezone and logging
RUN apk add --no-cache tzdata

# Set runtime environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV OAUTH_PORT=1455
ENV DATABASE_PATH=/app/data/srouter.db
ENV WEB_DIST_PATH=/app/apps/web/dist

# Create persistent storage directory for SQLite WAL database
RUN mkdir -p /app/data

# Copy the isolated API production deployment.
COPY --from=builder /app/deploy ./

# The API serves the dashboard as static files at runtime.
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Expose API/Web port (3000) and OAuth callback receiver port (1455)
EXPOSE 3000 1455

# Declare persistent volume mount point
VOLUME ["/app/data"]

# Native health check using Node 22 built-in fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start SRouter unified API & Dashboard server
CMD ["node", "dist/index.js"]
