# Keycloak Integration Guide — Diamond Scheduler

This document describes the current Keycloak setup, its gaps, and the full
recommended path to deep integration including role-based access control (RBAC)
and PocketBase as a Keycloak-aware external auth backend.

---

## 1. Current State

| Aspect | Status |
|---|---|
| OIDC / PKCE S256 flow | ✅ Implemented (`index.tsx`) |
| `login-required` on app load | ✅ |
| Token claims → userId / orgId | ✅ (`App.tsx` lines 89-94) |
| Realm roles extracted | ✅ (extracted but unused for gating) |
| Token forwarded to PocketBase | ❌ PocketBase called anonymously |
| Role-based feature gating | ❌ |
| Token refresh before API calls | ❌ |
| Silent SSO for embedded widget | ❌ |
| Standardised `org_id` claim | ❌ Four-way fallback heuristic |

---

## 2. Keycloak Realm & Client Configuration

### 2.1 Realm settings

```
Realm → Login → Require SSL: all requests
Realm → Sessions → SSO Session Idle: 30 min
Realm → Sessions → SSO Session Max: 8 h
Realm → Tokens → Access Token Lifespan: 5 min   ← keep short; refresh handles the rest
```

### 2.2 Client settings (the `diamond-scheduler` client)

```
Client Protocol: openid-connect
Access Type: public  (SPA — no client secret)
Standard Flow: ON
Direct Access Grants: OFF
Valid Redirect URIs: https://your-app.example.com/*
Web Origins: https://your-app.example.com
PKCE Code Challenge Method: S256
```

### 2.3 Required client scopes

Add a dedicated `scheduler` scope and map the following claims into the token:

| Claim | Source | Notes |
|---|---|---|
| `sub` | Built-in | User UUID — used as `userId` |
| `email` | Built-in email scope | |
| `preferred_username` | Built-in profile scope | |
| `org_id` | Custom attribute mapper | See §2.4 |
| `realm_access.roles` | Built-in roles scope | Used for RBAC |

### 2.4 Standardise the `org_id` claim

The current code tries four claim names (`org_id`, `organization`, `tenant`, `org`).
Pick one — `org_id` — and configure a single **User Attribute** mapper:

```
Mapper Type: User Attribute
User Attribute: org_id
Token Claim Name: org_id
Claim JSON Type: String
Add to access token: ON
Add to ID token: ON
```

Then in `App.tsx` remove the fallback chain and read only `org_id`:

```ts
// Before (brittle):
const orgId =
  keycloak.tokenParsed?.org_id ||
  keycloak.tokenParsed?.organization ||
  keycloak.tokenParsed?.tenant ||
  keycloak.tokenParsed?.org;

// After (canonical):
const orgId = (keycloak.tokenParsed as any)?.org_id as string | undefined;
```

---

## 3. Role-Based Access Control (RBAC)

### 3.1 Define roles in Keycloak

Create the following **realm roles** (or client roles scoped to `diamond-scheduler`):

| Role | Who gets it | What it unlocks |
|---|---|---|
| `scheduler_admin` | League administrators | Publish / delete schedules; generate score links; manage all settings |
| `scheduler_editor` | Coaches, scorekeepers | Edit games, enter scores via the main app |
| `scheduler_viewer` | Read-only staff | View calendar only; no edits |

### 3.2 Gate features in `App.tsx`

Add a helper at the top of the component:

```ts
const realmRoles = (keycloak.tokenParsed as any)?.realm_access?.roles as string[] | undefined;

const hasRole = (role: string) => realmRoles?.includes(role) ?? false;
const isAdmin  = hasRole('scheduler_admin');
const isEditor = hasRole('scheduler_editor') || isAdmin;
```

Then gate UI elements:

```tsx
// Publish button — admin only
{isAdmin && (
  <button onClick={handlePublish}>Publish Schedule</button>
)}

// Score links — admin only
{isAdmin && (
  <button onClick={() => setViewMode('score_links')}>Score Links</button>
)}

// Edit game — editor or admin
{isEditor && (
  <button onClick={() => setShowEditModal(true)}>Edit</button>
)}
```

And guard actions server-side by checking the claim in PocketBase collection rules
(see §4.3).

---

## 4. PocketBase as Keycloak External Auth Backend

This is the most impactful change: instead of relying on application-level
`org_id`/`user_id` filtering, PocketBase enforces access control at the database
level using the Keycloak JWT.

### 4.1 Configure PocketBase OAuth2 / OIDC external provider

In the PocketBase admin UI:

```
Settings → Auth providers → Add provider: OpenID Connect

Name: keycloak
Client ID: diamond-scheduler          ← same client as the SPA
Client Secret: <generated in Keycloak>
Discovery URL: https://keycloak.example.com/realms/your-realm/.well-known/openid-configuration
```

PocketBase will validate incoming tokens against Keycloak's public JWKS
endpoint automatically.

### 4.2 Authenticate PocketBase with the Keycloak token

In `services/storage.ts`, after the Keycloak token is available, pass it to
PocketBase before every API call. Wire this through a helper in the storage
module:

```ts
// storage.ts — add this helper
export const authenticatePocketBase = (token: string) => {
  if (!pocketbaseClient || !token) return;
  pocketbaseClient.authStore.save(token, null);
};
```

In `App.tsx`, call it whenever the Keycloak token changes and before any
storage operation:

```ts
// App.tsx
const { keycloak } = useKeycloak();

// Sync token into PocketBase on every token change
useEffect(() => {
  if (keycloak.token) {
    storageApi.authenticatePocketBase(keycloak.token);
  }
}, [keycloak.token]);

// Refresh token before storage calls (add to persistStorageData call site)
const refreshAndSave = async () => {
  if (keycloak.isTokenExpired(30)) {
    await keycloak.updateToken(30);
    storageApi.authenticatePocketBase(keycloak.token!);
  }
  await storageApi.persistStorageData(...);
};
```

For `score-edit.tsx` (public, no Keycloak), the PocketBase client continues
to operate anonymously — only the token-validation path (`validateScoreLink`)
and `saveScoreEdit` need public access, which is controlled by PocketBase
collection rules (§4.3).

### 4.3 PocketBase collection rules

Once PocketBase receives the Keycloak JWT, `@request.auth.*` is populated with
the token claims. Set these rules in the PocketBase admin UI.

#### `app_state` (working schedule state)

```
List/View: @request.auth.id != "" && (record.org_id = @request.auth.org_id || record.user_id = @request.auth.id)
Create:    @request.auth.id != ""
Update:    @request.auth.id != "" && (record.org_id = @request.auth.org_id || record.user_id = @request.auth.id)
Delete:    @request.auth.id != "" && (record.org_id = @request.auth.org_id || record.user_id = @request.auth.id)
```

#### `published_schedules`

```
List/View: @request.auth.id != "" && (record.org_id = @request.auth.org_id || record.user_id = @request.auth.id)
Create:    @request.auth.id != "" && "scheduler_admin" in @request.auth.realm_access.roles[*]
Update:    @request.auth.id != "" && (record.org_id = @request.auth.org_id || record.user_id = @request.auth.id)
           && "scheduler_admin" in @request.auth.realm_access.roles[*]
Delete:    same as Update
```

#### `score_links`

```
List/View: @request.auth.id != "" && (record.org_id = @request.auth.org_id || record.user_id = @request.auth.id)
Create:    @request.auth.id != "" && "scheduler_admin" in @request.auth.realm_access.roles[*]
Update:    same as Create
Delete:    same as Create
```

#### `score_edits` (public write — score entry form)

```
List/View: ""                          ← public; used by embed and auto-sync
Create:    ""                          ← public; token validated in saveScoreEdit()
Update:    ""                          ← public; same token check enforced in code
Delete:    @request.auth.id != "" && "scheduler_admin" in @request.auth.realm_access.roles[*]
```

> **Note:** The `score_edits` collection must remain publicly writable because
> `score-edit.html` is accessed without Keycloak by score reporters. The
> server-side token re-validation in `saveScoreEdit()` is the gate here.

### 4.4 Token refresh strategy

Add a utility wrapper around every PocketBase call that refreshes the Keycloak
token if it is close to expiry:

```ts
// storage.ts
let keycloakRefreshFn: (() => Promise<void>) | null = null;

export const registerKeycloakRefresh = (fn: () => Promise<void>) => {
  keycloakRefreshFn = fn;
};

const withFreshToken = async <T>(fn: () => Promise<T>): Promise<T> => {
  await keycloakRefreshFn?.();
  return fn();
};
```

In `App.tsx` during initialisation:

```ts
useEffect(() => {
  storageApi.registerKeycloakRefresh(async () => {
    if (keycloak.isTokenExpired(30)) {
      await keycloak.updateToken(30);
      if (keycloak.token) storageApi.authenticatePocketBase(keycloak.token);
    }
  });
}, [keycloak]);
```

Wrap every exported storage function that calls PocketBase with `withFreshToken`.

---

## 5. Silent SSO for the Embedded Widget

`embed.tsx` renders a public schedule widget. The current `login-required`
init option forces a redirect for anonymous visitors. Fix:

### 5.1 Create a silent-SSO relay page

Add `public/silent-check-sso.html`:

```html
<!DOCTYPE html>
<html>
  <body>
    <script>parent.postMessage(location.href, location.origin);</script>
  </body>
</html>
```

### 5.2 Use `check-sso` in the embed entry point

In the embed Keycloak init (or a separate `embed-keycloak.ts`):

```ts
const keycloakEmbed = new Keycloak({
  url:      import.meta.env.VITE_KEYCLOAK_URL,
  realm:    import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

keycloakEmbed.init({
  onLoad:           'check-sso',          // ← never redirects anonymous users
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  pkceMethod:       'S256',
});
```

Anonymous visitors will see the embed without interruption; authenticated users
will transparently receive their token.

---

## 6. Logout with Redirect URI

Currently `keycloak.logout()` is called without a `redirectUri`. After logout
Keycloak redirects back to the app root, which immediately triggers
`login-required` and bounces the user back to Keycloak — a confusing loop.

```ts
// Before:
keycloak.logout();

// After:
keycloak.logout({ redirectUri: `${window.location.origin}/logged-out.html` });
```

Create a minimal `public/logged-out.html` with a "Sign in again" link.

---

## 7. Optional: Bearer Auth on the ICS Endpoint

`/subscribe.ics` is fully public. For leagues that need private calendar feeds,
add optional Bearer token support in `server.js`:

```js
app.get('/subscribe.ics', icsRateLimiter, async (req, res) => {
  // ... existing schedule_key validation ...

  // Optional: verify Keycloak Bearer token for private schedules
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const introspectUrl =
      `${process.env.KC_URL}/realms/${process.env.KC_REALM}/protocol/openid-connect/token/introspect`;
    const introspectRes = await fetch(introspectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        client_id:     process.env.KC_CLIENT_ID,
        client_secret: process.env.KC_CLIENT_SECRET,
      }),
    });
    const { active } = await introspectRes.json();
    if (!active) { res.status(401).send('Unauthorized.'); return; }
  }
  // ... rest of handler ...
});
```

Add `KC_URL`, `KC_REALM`, `KC_CLIENT_ID`, `KC_CLIENT_SECRET` to the server's
environment variables (server-side only, never `VITE_` prefixed).

---

## 8. Environment Variable Reference

### Frontend (`VITE_*` — embedded in the JS bundle, not secret)

| Variable | Required | Example |
|---|---|---|
| `VITE_KEYCLOAK_URL` | Yes | `https://keycloak.example.com` |
| `VITE_KEYCLOAK_REALM` | Yes | `diamond` |
| `VITE_KEYCLOAK_CLIENT_ID` | Yes | `diamond-scheduler` |
| `VITE_PB_URL` | Yes (if using PB) | `https://pb.example.com` |
| `VITE_PB_COLLECTION` | No | `app_state` |
| `VITE_PB_SCHEDULE_COLLECTION` | No | `published_schedules` |
| `VITE_PB_SCHEDULE_PUBLISH` | No | `true` |
| `VITE_PB_SCORE_LINKS_COLLECTION` | No | `score_links` |
| `VITE_PB_SCORE_EDITS_COLLECTION` | No | `score_edits` |

### Server-side only (never `VITE_` prefix — not in bundle)

| Variable | Purpose |
|---|---|
| `PB_URL` | PocketBase URL for server.js |
| `PB_SCHEDULE_COLLECTION` | Schedule collection for ICS endpoint |
| `KC_URL` | Keycloak URL for token introspection (§7) |
| `KC_REALM` | Keycloak realm for token introspection |
| `KC_CLIENT_ID` | Confidential client for introspection |
| `KC_CLIENT_SECRET` | Confidential client secret — **never expose** |

---

## 9. Implementation Checklist

- [ ] Standardise `org_id` claim in Keycloak (§2.4)
- [ ] Define `scheduler_admin`, `scheduler_editor`, `scheduler_viewer` roles (§3.1)
- [ ] Add role-based feature gates in `App.tsx` (§3.2)
- [ ] Configure PocketBase OIDC provider pointing at Keycloak (§4.1)
- [ ] Implement `authenticatePocketBase` + `registerKeycloakRefresh` (§4.2, §4.4)
- [ ] Apply PocketBase collection rules (§4.3)
- [ ] Add `silent-check-sso.html` and switch embed to `check-sso` (§5)
- [ ] Add `redirectUri` to logout call (§6)
- [ ] (Optional) Add Bearer auth to `/subscribe.ics` (§7)
- [ ] Remove `unsafe-inline` from `script-src` CSP once Vite nonce support is configured

---

## 10. SaaS / Multi-Tenant Architecture

### 10.1 Tenant model

Each customer is a **tenant** identified by a UUID `org_id`. The `org_id` flows
from Keycloak (via the `scheduler` client scope mapper) into every PocketBase
API call, isolating all data at the database level.

```
Keycloak Realm "diamond"
  └─ Group /tenants/acme          (org_id attribute = "acme-uuid")
       ├─ /tenants/acme/admins    → role: tenant_admin
       ├─ /tenants/acme/editors   → role: scheduler_editor
       └─ /tenants/acme/viewers   → role: scheduler_viewer

PocketBase
  └─ tenants collection           (one record per org_id)
  └─ app_state collection         (one record per org_id)
  └─ published_schedules          (many records per org_id)
  └─ score_links                  (many records per org_id)
  └─ score_edits                  (public; token-validated only)
```

### 10.2 Role hierarchy

```
system_admin          Platform operator — manages all tenants, bypasses suspension gate
  └─ tenant_admin     Manages one tenant's users, plan, and branding
       └─ scheduler_admin   Publishes schedules, creates score links
            └─ scheduler_editor   Edits games and scores
                 └─ scheduler_viewer   Read-only calendar access
```

Roles are **composite** in Keycloak, so assigning `tenant_admin` automatically
grants all lower permissions. This avoids the need for OR chains in PocketBase
rules and application code.

### 10.3 Tenant lifecycle

#### Onboarding a new customer

1. **Keycloak**: Create a group `/tenants/<slug>` with attribute `org_id = <uuid>`.
   Add sub-groups `admins`, `editors`, `viewers` with the corresponding realm roles.
2. **PocketBase**: Create a `tenants` record via `storageApi.createTenant(...)`:
   ```ts
   await storageApi.createTenant({
     orgId:    'acme-uuid',
     name:     'ACME Baseball League',
     plan:     'starter',
     limits:   PLAN_LIMITS['starter'],   // or custom overrides
     active:   true,
     trialEndsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
     branding: { orgName: 'ACME Baseball' },
   });
   ```
3. **Keycloak**: Create the first `tenant_admin` user; assign to `/tenants/acme/admins`;
   set `org_id` attribute. Send invite email with required-action `UPDATE_PASSWORD`.

#### Upgrading a plan

Update the `tenants` PocketBase record via `storageApi.updateTenant(id, { plan: 'pro', limits: PLAN_LIMITS['pro'] })`.
The new limits take effect on the user's next page load (tenant is re-fetched
at hydration time).

#### Suspending a tenant

```ts
await storageApi.updateTenant(id, { active: false });
```

All tenant users will see the suspension screen on next load. `system_admin`
users bypass the gate and can still access the account for support.

#### Deleting a tenant

1. Disable all users in the Keycloak group.
2. Delete the Keycloak group `/tenants/<slug>`.
3. Delete the PocketBase `tenants` record.
4. PocketBase collection rules (scoped by `org_id`) prevent orphaned records
   from being accessible.

### 10.4 PocketBase `tenants` collection schema

| Field | Type | Notes |
|---|---|---|
| `org_id` | Text (unique) | Keycloak `sub` or org UUID |
| `name` | Text | Display name e.g. "ACME Baseball League" |
| `plan` | Text | `free` \| `starter` \| `pro` \| `enterprise` |
| `limits` | JSON | Overrides for `PLAN_LIMITS[plan]` |
| `active` | Bool | `false` = suspended |
| `trial_ends_at` | DateTime | Null = not on trial |
| `branding` | JSON | `{ orgName, logoUrl, primaryColor }` |

**Collection rules:**

```
List/View: @request.auth.org_id = record.org_id
           || "system_admin" in @request.auth.realm_access.roles[*]

Create:    "system_admin" in @request.auth.realm_access.roles[*]

Update:    ("tenant_admin" in @request.auth.realm_access.roles[*]
            && @request.auth.org_id = record.org_id)
           || "system_admin" in @request.auth.realm_access.roles[*]

Delete:    "system_admin" in @request.auth.realm_access.roles[*]
```

### 10.5 Keycloak Organizations (Keycloak 24+)

Keycloak 24 introduced a native **Organizations** feature that maps directly to
tenants. When enabled it replaces the group-based approach:

- Each Organization = one tenant; members automatically receive the `org_id`
  claim via the Organization's `id` field.
- Organization admins can self-manage their members without needing realm admin
  access.
- The `scheduler` client scope mapper changes from `user.attribute` to
  `organization.attribute` type.

Enable via: `Realm settings → Organizations → Enable`.
Then create one Organization per tenant and map its `id` to the `org_id` claim.

The realm import JSON uses the group-based approach (compatible with all
Keycloak versions ≥ 18) and can be migrated to Organizations later without
changing any application code, as long as the `org_id` claim value stays the
same.

### 10.6 Plan enforcement summary

| Feature | free | starter | pro | enterprise |
|---|---|---|---|---|
| Leagues | 2 | 5 | 20 | unlimited |
| Teams | 20 | 50 | 200 | unlimited |
| Score links | 5 | 20 | 100 | unlimited |
| Published schedules | 1 | 3 | 10 | unlimited |
| Trial | 14 days | — | — | — |

Limits are enforced in the application layer (`App.tsx` reads `tenant.limits`).
Add a second enforcement layer in PocketBase rules for defence-in-depth once
Keycloak JWT auth is wired up (§4.3).

### 10.7 Environment variable additions for SaaS

Add to `.env`:

```env
VITE_PB_TENANTS_COLLECTION=tenants
```

Add to server environment (never `VITE_` prefix):

```env
KC_URL=https://keycloak.example.com
KC_REALM=diamond
KC_CLIENT_ID=diamond-scheduler-server
KC_CLIENT_SECRET=<copy from Keycloak admin>
```
