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
VITE_PB_URL="https://${APP_DOMAIN:-localhost}/_pb"
VITE_PB_COLLECTION="${VITE_PB_COLLECTION:-app_state}"

# Pass KC_URL through for the server-side ICS token introspection
export KC_URL="${VITE_KEYCLOAK_URL:-}"

# ── Stamp runtime values into the pre-built SPA ───────────────────────────────
# /app is read-only in Cloudron; copy the image-built dist to writable storage
# and substitute the placeholders baked in during the Docker build.
DIST_DIR="/app/data/dist"
echo "==> Stamping SPA (VITE_PB_URL=${VITE_PB_URL})"
rm -rf "${DIST_DIR}"
cp -r /app/dist "${DIST_DIR}"
find "${DIST_DIR}" -type f -name "*.js" \
    -exec sed -i \
        "s|__VITE_PB_URL__|${VITE_PB_URL}|g; s|__VITE_PB_COLLECTION__|${VITE_PB_COLLECTION}|g" \
        {} \;

# ── Health endpoint ────────────────────────────────────────────────────────────
# Cloudron checks GET /health. Nginx returns 200 from a static stub.
echo "OK" > "${DIST_DIR}/health"

# ── Nginx writable temp dirs (filesystem is read-only except /tmp, /app/data) ─
mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy /tmp/nginx/fastcgi \
         /tmp/nginx/scgi /tmp/nginx/uwsgi

# ── Launch via supervisord ────────────────────────────────────────────────────
echo "==> Starting supervisord"
exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/diamond.conf
