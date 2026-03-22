## Changelog

### 1.0.0

- Initial Cloudron community release
- Embedded PocketBase (v0.26.3) — no external database required
- PocketBase data persisted via Cloudron `localstorage` addon
- SPA built at container startup so Cloudron env vars (including `APP_DOMAIN`) are baked correctly into the Vite bundle
- nginx serves the SPA on port 8000 and reverse-proxies `/_pb/` to PocketBase and `/subscribe.ics` to Node.js
- Multi-tenant support via `VITE_APP_ID` environment variable
- CloudronVersions.json for community app distribution and automatic updates
