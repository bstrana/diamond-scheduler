## Post-Installation Setup

### 1. Configure Keycloak

Diamond Scheduler requires an external Keycloak instance for authentication. If you don't already have one, install the [Keycloak Cloudron app](https://www.cloudron.io/store/org.keycloak.cloudronapp.html) first.

#### Create a Realm and Client

1. Log in to Keycloak admin console
2. Create a new realm (e.g. `diamond`)
3. Create a client:
   - **Client ID**: `diamond-scheduler` (or your chosen value)
   - **Client type**: OpenID Connect
   - **Valid redirect URIs**: `https://YOUR_APP_DOMAIN/*`
   - **Web origins**: `https://YOUR_APP_DOMAIN`

#### Import the example realm (optional)

A `keycloak-realm-import.json` is included in the repository. Import it via **Realm Settings → Action → Partial import** to bootstrap roles and client scopes.

### 2. Create `/app/data/config.env`

Cloudron does not expose a UI for per-app environment variables. Instead, create
the file `/app/data/config.env` using the **Cloudron File Manager** (Cloudron
dashboard → App → Files) or via SSH into the Cloudron server:

```bash
# on the Cloudron host
cloudron files edit --app <app-id> /app/data/config.env
```

Paste the following, filling in your values:

```bash
# ── Keycloak (required) ───────────────────────────────────────────────────────
VITE_KEYCLOAK_URL=https://keycloak.example.com
VITE_KEYCLOAK_REALM=diamond
VITE_KEYCLOAK_CLIENT_ID=diamond-scheduler

# ── App identity ──────────────────────────────────────────────────────────────
VITE_APP_ID=scheduler

# ── Server-side ICS token validation ─────────────────────────────────────────
KC_REALM=diamond
KC_CLIENT_ID=diamond-scheduler-server
KC_CLIENT_SECRET=<confidential-client-secret>

# ── Optional overrides (defaults shown) ──────────────────────────────────────
# SCHEDULE_EVENT_DURATION_MINUTES=120
# VITE_PB_SCHEDULE_COLLECTION=published_schedules
# VITE_PB_SCORE_LINKS_COLLECTION=score_links
# VITE_PB_SCORE_EDITS_COLLECTION=score_edits
# VITE_PB_TENANTS_COLLECTION=tenants
```

After saving the file, **restart the app** from the Cloudron dashboard so the
new values are stamped into the SPA bundle.

### 3. First Login

1. Navigate to `https://YOUR_APP_DOMAIN`
2. You will be redirected to Keycloak login
3. Log in with a Keycloak user that has the `admin` role
4. The app will initialize PocketBase collections on first run

### 4. PocketBase Admin (optional)

PocketBase is accessible at `https://YOUR_APP_DOMAIN/_pb/_/` for direct database administration. The PocketBase superuser is created automatically on first startup; check the container logs for the credentials:

```
cloudron logs -f
```

### Troubleshooting

- **Blank page / auth error**: Verify Keycloak env vars are set correctly and the Keycloak client's redirect URIs include your app domain.
- **iCal feed returns 403**: Ensure `KC_CLIENT_SECRET` is set and matches the Keycloak confidential client.
- **Slow first start**: The SPA bundle is pre-built into the image; startup should be fast. If it seems stuck, check `cloudron logs` for errors in the config file.
