#!/bin/bash
# Cloudron startup script for Diamond Scheduler
# Cloudron sets APP_DOMAIN, APP_ORIGIN, CLOUDRON_API_ORIGIN, and any
# user-configured env vars before this script runs.
set -eu

echo "==> Diamond Scheduler starting"

# ── Persistent storage ────────────────────────────────────────────────────────
# Cloudron mounts the localstorage addon at /app/data (read-write, persisted).
PB_DATA_DIR="/app/data/pb_data"
mkdir -p "${PB_DATA_DIR}"

# ── Runtime env vars that depend on APP_DOMAIN ────────────────────────────────
# VITE_ variables are baked in at build time, so we build here after
# Cloudron has injected all env vars.
export VITE_PB_URL="https://${APP_DOMAIN:-localhost}/_pb"
export VITE_PB_COLLECTION="${VITE_PB_COLLECTION:-app_state}"

# Pass KC_URL through for the server-side ICS token introspection
export KC_URL="${VITE_KEYCLOAK_URL:-}"

echo "==> Building SPA (VITE_PB_URL=${VITE_PB_URL})"
cd /app
npm run build

# ── Health endpoint ────────────────────────────────────────────────────────────
# Cloudron checks GET /health. Nginx returns 200 from a static stub.
echo "OK" > /app/dist/health

# ── Launch via supervisord ────────────────────────────────────────────────────
echo "==> Starting supervisord"
exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/diamond.conf
