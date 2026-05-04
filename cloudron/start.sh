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

# ── Admin config file ─────────────────────────────────────────────────────────
# Cloudron has no dashboard UI for per-app env vars.  On first boot this script
# writes a template to /app/data/config.env so the admin can edit it via the
# Cloudron file manager (App → Files) and then restart the app.
CONFIG_FILE="/app/data/config.env"
if [ ! -f "${CONFIG_FILE}" ]; then
    echo "==> Creating config template at ${CONFIG_FILE}"
    cat > "${CONFIG_FILE}" <<'TEMPLATE'
# Diamond Scheduler configuration
# Edit this file via the Cloudron file manager (App → Files → /app/data/config.env)
# then restart the app for changes to take effect.

# ── Keycloak (required) ───────────────────────────────────────────────────────
VITE_KEYCLOAK_URL=https://keycloak.example.com
VITE_KEYCLOAK_REALM=diamond
VITE_KEYCLOAK_CLIENT_ID=diamond-scheduler

# ── PocketBase write protection (optional, default: false) ────────────────────
# Set to true to route all /_pb/ traffic through the Node.js proxy, which
# validates the Keycloak token before allowing writes to app_state, tenants,
# score_links, and published_schedules. score_edits remains public (score page).
# To roll back: set to false and restart — nginx goes direct again.
PB_WRITE_PROTECTION=false

# ── App identity ──────────────────────────────────────────────────────────────
VITE_APP_ID=scheduler

# ── Server-side ICS token validation ─────────────────────────────────────────
KC_REALM=diamond
KC_CLIENT_ID=diamond-scheduler-server
KC_CLIENT_SECRET=replace-with-client-secret

# ── Optional overrides ────────────────────────────────────────────────────────
# SCHEDULE_EVENT_DURATION_MINUTES=120
# VITE_PB_SCHEDULE_COLLECTION=published_schedules
# VITE_PB_SCORE_LINKS_COLLECTION=score_links
# VITE_PB_SCORE_EDITS_COLLECTION=score_edits
# VITE_PB_TENANTS_COLLECTION=tenants

# NOTE: VITE_PB_URL is baked into the SPA at Docker build time as "/_pb".
# You do NOT need to set it here. Setting it will have no effect on the browser
# client — the built JS already contains the correct value.
TEMPLATE
    chmod 644 "${CONFIG_FILE}"
    echo "    Edit it and restart the app to apply your Keycloak settings."
fi

echo "==> Loading config from ${CONFIG_FILE}"
# Parse config.env manually so that lines with spaces around '=' (e.g. VAR = value)
# are handled gracefully instead of causing "command not found" errors.
while IFS= read -r _line || [ -n "${_line}" ]; do
  # Strip leading/trailing whitespace
  _line="${_line#"${_line%%[![:space:]]*}"}"
  _line="${_line%"${_line##*[![:space:]]}"}"
  # Skip blank lines and comments
  [[ -z "${_line}" || "${_line}" == \#* ]] && continue
  # Match VAR=value or VAR = value (optional spaces around '=')
  if [[ "${_line}" =~ ^([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*) ]]; then
    export "${BASH_REMATCH[1]}"="${BASH_REMATCH[2]}"
  fi
done < "${CONFIG_FILE}"

# ── PocketBase internal token (generated once, persisted across restarts) ─────
# nginx always injects this into /_pb/ proxy requests so PocketBase rules can
# reject requests that bypass nginx entirely.
PB_TOKEN_FILE="/app/data/pb_internal_token"
if [ ! -f "${PB_TOKEN_FILE}" ]; then
    openssl rand -hex 32 > "${PB_TOKEN_FILE}"
    chmod 600 "${PB_TOKEN_FILE}"
fi
export PB_INTERNAL_TOKEN="$(cat "${PB_TOKEN_FILE}")"

# ── PocketBase write-protection mode ─────────────────────────────────────────
# PB_WRITE_PROTECTION=true  → /_pb/ routes through Node.js (Keycloak-gated writes)
# PB_WRITE_PROTECTION=false → /_pb/ routes directly to PocketBase (no KC check)
if [ "${PB_WRITE_PROTECTION:-false}" = "true" ]; then
    PB_PROXY_PASS="http://127.0.0.1:3001/_pb-proxy/"
    echo "==> PocketBase write protection: ENABLED (Node.js proxy)"
else
    PB_PROXY_PASS="http://127.0.0.1:8090/"
    echo "==> PocketBase write protection: DISABLED (direct)"
fi

# ── Runtime env vars ──────────────────────────────────────────────────────────
# PB_URL is the absolute internal URL used by server.js (Node.js ICS endpoint).
# The browser SPA uses the relative URL /_pb baked in at Docker build time.
export PB_URL="http://127.0.0.1:8090"
# Restrict PocketBase CORS to the app's own origin. Falls back to '*' only
# when Cloudron hasn't set APP_ORIGIN (local dev / first-boot edge cases).
export PB_ORIGINS="${APP_ORIGIN:-*}"
export VITE_PB_COLLECTION="${VITE_PB_COLLECTION:-app_state}"

# Default values for all other collection/feature vars.
# Cloudron injects these from the manifest, but guard against cases where
# they are absent (e.g. first boot on an older Cloudron version, or a
# variable not yet configured in the app settings UI).
# Must be exported so supervisord child processes (node.js) inherit them.
export VITE_PB_SCHEDULE_PUBLISH="${VITE_PB_SCHEDULE_PUBLISH:-true}"
export VITE_PB_SCHEDULE_COLLECTION="${VITE_PB_SCHEDULE_COLLECTION:-published_schedules}"
export VITE_PB_SCORE_LINKS_COLLECTION="${VITE_PB_SCORE_LINKS_COLLECTION:-score_links}"
export VITE_PB_SCORE_EDITS_COLLECTION="${VITE_PB_SCORE_EDITS_COLLECTION:-score_edits}"
export VITE_PB_TENANTS_COLLECTION="${VITE_PB_TENANTS_COLLECTION:-tenants}"

# Pass KC_URL through for the server-side ICS token introspection
export KC_URL="${VITE_KEYCLOAK_URL:-}"

# ── Stamp Keycloak origin into nginx CSP ──────────────────────────────────────
# frame-src needs the Keycloak origin so the OIDC silent-check-sso iframe works.
KC_ORIGIN="'none'"
if [ -n "${VITE_KEYCLOAK_URL:-}" ]; then
    # Extract scheme + host from the full URL (strip any path)
    KC_ORIGIN="$(echo "${VITE_KEYCLOAK_URL}" | grep -oP '^https?://[^/]+')"
fi
# /etc/nginx/sites-enabled/ is read-only at runtime; render the template into
# the writable /tmp/nginx/sites-enabled/ that nginx is configured to include.
mkdir -p /tmp/nginx/sites-enabled
sed \
    -e "s|__KC_ORIGIN__|${KC_ORIGIN}|g" \
    -e "s|__PB_PROXY_PASS__|${PB_PROXY_PASS}|g" \
    -e "s|__PB_INTERNAL_TOKEN__|${PB_INTERNAL_TOKEN}|g" \
    /app/nginx.conf.template > /tmp/nginx/sites-enabled/default

# ── Stamp runtime values into the pre-built SPA ───────────────────────────────
# /app is read-only in Cloudron; copy the image-built dist to writable storage
# and substitute the placeholders baked in during the Docker build.
DIST_DIR="/app/data/dist"
echo "==> Stamping SPA (PB_URL=${PB_URL})"
rm -rf "${DIST_DIR}"
cp -r /app/dist "${DIST_DIR}"
find "${DIST_DIR}" -type f -name "*.js" \
    -exec sed -i \
        -e "s|__VITE_PB_COLLECTION__|${VITE_PB_COLLECTION}|g" \
        -e "s|__VITE_KEYCLOAK_URL__|${VITE_KEYCLOAK_URL:-}|g" \
        -e "s|__VITE_KEYCLOAK_REALM__|${VITE_KEYCLOAK_REALM:-}|g" \
        -e "s|__VITE_KEYCLOAK_CLIENT_ID__|${VITE_KEYCLOAK_CLIENT_ID:-}|g" \
        -e "s|__VITE_APP_ID__|${VITE_APP_ID:-}|g" \
        -e "s|__VITE_PB_SCHEDULE_COLLECTION__|${VITE_PB_SCHEDULE_COLLECTION:-}|g" \
        -e "s|__VITE_PB_SCHEDULE_PUBLISH__|${VITE_PB_SCHEDULE_PUBLISH:-}|g" \
        -e "s|__VITE_PB_SCORE_LINKS_COLLECTION__|${VITE_PB_SCORE_LINKS_COLLECTION:-}|g" \
        -e "s|__VITE_PB_SCORE_EDITS_COLLECTION__|${VITE_PB_SCORE_EDITS_COLLECTION:-}|g" \
        -e "s|__VITE_PB_TENANTS_COLLECTION__|${VITE_PB_TENANTS_COLLECTION:-}|g" \
        {} \;

# ── Health endpoint ────────────────────────────────────────────────────────────
# Cloudron checks GET /health. Nginx returns 200 from a static stub.
echo "OK" > "${DIST_DIR}/health"

# ── Nginx writable temp dirs (filesystem is read-only except /tmp, /app/data) ─
mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy /tmp/nginx/fastcgi \
         /tmp/nginx/scgi /tmp/nginx/uwsgi

# ── PocketBase migrations (explicit pre-flight run) ───────────────────────────
# Running `migrate up` here (before supervisord) gives us clear log output if
# something is wrong with the migration files, and guarantees collections exist
# before the first HTTP request arrives. The serve command also has
# --migrationsDir set, but already-applied migrations are skipped.
echo "==> Running PocketBase migrations"
/app/pocketbase/pocketbase migrate up \
    --dir="${PB_DATA_DIR}" \
    --migrationsDir=/app/pb_migrations \
    2>&1 || {
    echo "WARNING: PocketBase migrations failed – see errors above."
    echo "         Collections may be missing. Open ${PB_URL}/_/ to inspect."
}

# ── Launch via supervisord ────────────────────────────────────────────────────
echo "==> Starting supervisord"
exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/diamond.conf
