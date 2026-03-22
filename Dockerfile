# Diamond Scheduler — Cloudron package
# https://docs.cloudron.io/packaging/
#
# The SPA is built here at image build time with placeholder env vars.
# start.sh stamps the real APP_DOMAIN-derived values via sed at container
# startup, copying the bundle to writable /app/data/dist before nginx starts.

FROM cloudron/base:5.0.0

WORKDIR /app

# ── System dependencies ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx \
        supervisor \
        curl \
        unzip \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 20 ────────────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── PocketBase ─────────────────────────────────────────────────────────────────
ARG PB_VERSION=0.26.3
RUN mkdir -p /app/pocketbase \
    && curl -fsSL \
       "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
       -o /tmp/pb.zip \
    && unzip -q /tmp/pb.zip -d /app/pocketbase \
    && rm /tmp/pb.zip \
    && chmod +x /app/pocketbase/pocketbase

# ── Application source ────────────────────────────────────────────────────────
COPY package*.json ./
RUN npm install
COPY . .
# Build the SPA at image build time with placeholder values that start.sh
# will sed-replace with Cloudron-injected env vars at container startup.
RUN VITE_PB_URL="__VITE_PB_URL__" \
    VITE_PB_COLLECTION="__VITE_PB_COLLECTION__" \
    VITE_KEYCLOAK_URL="__VITE_KEYCLOAK_URL__" \
    VITE_KEYCLOAK_REALM="__VITE_KEYCLOAK_REALM__" \
    VITE_KEYCLOAK_CLIENT_ID="__VITE_KEYCLOAK_CLIENT_ID__" \
    VITE_APP_ID="__VITE_APP_ID__" \
    VITE_PB_SCHEDULE_COLLECTION="__VITE_PB_SCHEDULE_COLLECTION__" \
    VITE_PB_SCHEDULE_PUBLISH="__VITE_PB_SCHEDULE_PUBLISH__" \
    VITE_PB_SCORE_LINKS_COLLECTION="__VITE_PB_SCORE_LINKS_COLLECTION__" \
    VITE_PB_SCORE_EDITS_COLLECTION="__VITE_PB_SCORE_EDITS_COLLECTION__" \
    VITE_PB_TENANTS_COLLECTION="__VITE_PB_TENANTS_COLLECTION__" \
    npm run build

# ── Cloudron config files ─────────────────────────────────────────────────────
COPY cloudron/nginx.conf      /app/nginx.conf.template
COPY cloudron/supervisord.conf /etc/supervisor/conf.d/diamond.conf
COPY cloudron/start.sh        /app/start.sh
RUN chmod +x /app/start.sh

# ── Nginx temp dirs & log paths ────────────────────────────────────────────────
# Cloudron's filesystem is read-only at runtime; redirect nginx's temp dirs
# to /tmp which is always a writable tmpfs.  The dirs themselves are created
# by start.sh before supervisord starts nginx.
# Also redirect logs to stdout/stderr so supervisord captures them.
# Also redirect the sites-enabled include to /tmp/nginx/sites-enabled/ so
# start.sh can write the rendered site config there without hitting the
# read-only /etc/nginx/sites-enabled/ filesystem.
RUN printf 'client_body_temp_path /tmp/nginx/client_body;\n\
proxy_temp_path      /tmp/nginx/proxy;\n\
fastcgi_temp_path    /tmp/nginx/fastcgi;\n\
scgi_temp_path       /tmp/nginx/scgi;\n\
uwsgi_temp_path      /tmp/nginx/uwsgi;\n' \
    > /etc/nginx/conf.d/cloudron-temp-paths.conf \
    && sed -i \
        -e 's|error_log /var/log/nginx/error.log.*|error_log /dev/stderr warn;|' \
        -e 's|access_log /var/log/nginx/access.log.*|access_log /dev/stdout;|' \
        -e 's|include /etc/nginx/sites-enabled/\*;|include /tmp/nginx/sites-enabled/*;|' \
        /etc/nginx/nginx.conf

# ── Remove any default nginx sites (config is rendered at runtime into /tmp) ──
RUN rm -f /etc/nginx/sites-enabled/default \
          /etc/nginx/sites-enabled/default.bak

# Cloudron listens on 8000; PocketBase and node.js are internal only
EXPOSE 8000


CMD ["/app/start.sh"]
