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

### 2. Set Environment Variables

In the Cloudron app settings panel (**App → Settings → Environment variables**), configure:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_KEYCLOAK_URL` | Public URL of your Keycloak instance | `https://keycloak.example.com` |
| `VITE_KEYCLOAK_REALM` | Realm name | `diamond` |
| `VITE_KEYCLOAK_CLIENT_ID` | Public client ID | `diamond-scheduler` |
| `VITE_APP_ID` | Unique identifier for this tenant | `scheduler` |
| `KC_CLIENT_SECRET` | Confidential client secret for server-side ICS token validation | `<secret>` |
| `SCHEDULE_EVENT_DURATION_MINUTES` | Default game duration in minutes | `120` |

After saving, Cloudron will restart the app and rebuild the SPA with the updated values.

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
- **Slow first start**: The SPA is built on each startup; allow 30–60 seconds on first launch.
