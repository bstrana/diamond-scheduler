
# Scheduler (Diamond Manager)

A baseball schedule management application with calendar interface, team management, and league creation.

## Related Apps

- Scorekeeping app: `../diamond-scorer/diamond-manager-scorer`

## Run Locally

**Prerequisites:**  Node.js

### Keycloak Configuration

Set the following environment variables in `.env.local` before running the app:

- `VITE_KEYCLOAK_URL` (e.g. `https://keycloak.example.com`)
- `VITE_KEYCLOAK_REALM` (e.g. `your-realm`)
- `VITE_KEYCLOAK_CLIENT_ID` (e.g. `your-client-id`)

### App Configuration

Set these optional environment variables in `.env.local`:

- `VITE_APP_ID` (app identifier)
- `VITE_LEAGUE_LIMIT` (max leagues allowed)
- `VITE_TEAM_LIMT` (max teams allowed)
- `VITE_PB_URL` (PocketBase URL, enables remote storage)
- `VITE_PB_COLLECTION` (PocketBase collection, default: `app_state`)

PocketBase storage expects a collection with fields:
- `app_id` (text)
- `payload` (json)

### Publish Schedule for Other Apps (PocketBase)

This app can publish its active schedule so other apps (e.g., scorekeeping) can read it by org/user.

Set these optional variables in `.env.local`:
- `VITE_PB_SCHEDULE_COLLECTION` (collection containing schedules)
- `VITE_PB_SCHEDULE_PUBLISH` (`true`/`false`, default: `false`)
- `VITE_PB_SCHEDULE_KEY` (default schedule key used for auto-publish)

Published schedule record fields:
- `app_id` (text)
- `active` (boolean)
- `org_id` (text, optional)
- `user_id` (text, optional)
- `schedule_key` (text, used to identify multiple schedules)
- `schedule_name` (text, optional)
- `data` (json) with `{ leagues, teams, games }`

### Tailwind CSS

Tailwind is compiled locally via PostCSS. Install dependencies and run Vite as usual.

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
