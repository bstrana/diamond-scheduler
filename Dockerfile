# Diamond Scheduler — Cloudron package
# https://docs.cloudron.io/packaging/
#
# The SPA is intentionally built at container startup (cloudron/start.sh) so
# that Vite can bake Cloudron-provided runtime env vars (APP_DOMAIN, Keycloak
# URLs, etc.) into the bundle.  All source files are therefore shipped inside
# the image and npm run build executes on first start.

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
# will sed-replace with the real APP_DOMAIN at container startup.
RUN VITE_PB_URL="__VITE_PB_URL__" \
    VITE_PB_COLLECTION="__VITE_PB_COLLECTION__" \
    npm run build

# ── Cloudron config files ─────────────────────────────────────────────────────
COPY cloudron/nginx.conf      /etc/nginx/sites-enabled/default
COPY cloudron/supervisord.conf /etc/supervisor/conf.d/diamond.conf
COPY cloudron/start.sh        /app/start.sh
RUN chmod +x /app/start.sh

# ── Remove default nginx site ─────────────────────────────────────────────────
RUN rm -f /etc/nginx/sites-enabled/default.bak

# Cloudron listens on 8000; PocketBase and node.js are internal only
EXPOSE 8000

CMD ["/app/start.sh"]
