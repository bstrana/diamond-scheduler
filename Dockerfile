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
# will sed-replace with the real APP_DOMAIN at container startup.
RUN VITE_PB_URL="__VITE_PB_URL__" \
    VITE_PB_COLLECTION="__VITE_PB_COLLECTION__" \
    npm run build

# ── Cloudron config files ─────────────────────────────────────────────────────
COPY cloudron/nginx.conf      /etc/nginx/sites-enabled/default
COPY cloudron/supervisord.conf /etc/supervisor/conf.d/diamond.conf
COPY cloudron/start.sh        /app/start.sh
RUN chmod +x /app/start.sh

# ── Nginx temp dirs ────────────────────────────────────────────────────────────
# Cloudron's filesystem is read-only at runtime; redirect nginx's temp dirs
# to /tmp which is always a writable tmpfs.  The dirs themselves are created
# by start.sh before supervisord starts nginx.
RUN printf 'client_body_temp_path /tmp/nginx/client_body;\n\
proxy_temp_path      /tmp/nginx/proxy;\n\
fastcgi_temp_path    /tmp/nginx/fastcgi;\n\
scgi_temp_path       /tmp/nginx/scgi;\n\
uwsgi_temp_path      /tmp/nginx/uwsgi;\n' \
    > /etc/nginx/conf.d/cloudron-temp-paths.conf

# ── Remove default nginx site ─────────────────────────────────────────────────
RUN rm -f /etc/nginx/sites-enabled/default.bak

# Cloudron listens on 8000; PocketBase and node.js are internal only
EXPOSE 8000

CMD ["/app/start.sh"]
