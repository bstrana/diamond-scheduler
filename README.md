<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

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
- `VITE_PB_SCHEDULE_COLLECTION` (collection containing schedules, default: `scheduled_games`)
- `VITE_PB_SCHEDULE_PUBLISH` (`true`/`false`, default: `false`)
- `VITE_PB_SCHEDULE_TEAMS_COLLECTION` (teams collection, default: `teams`)

Published schedule record fields (aligns with scorekeeping app):
- `title` (text)
- `date` (datetime)
- `competition` (text)
- `location` (text)
- `status` (select: scheduled, in_progress, finished)
- `home_team` (relation -> teams)
- `away_team` (relation -> teams)
- `home_roster` (relation -> rosters, optional)
- `away_roster` (relation -> rosters, optional)
- Optional: `org_id`, `user_id`, `app_id`

Published teams fields (aligns with scorekeeping app):
- `name` (text)
- `logo_url` (url or text)
- `color` (text)

### Tailwind CSS

Tailwind is compiled locally via PostCSS. Install dependencies and run Vite as usual.

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
