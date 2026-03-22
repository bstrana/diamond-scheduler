## Diamond Scheduler

Diamond Scheduler is a self-hosted sports league management app designed for baseball, softball, and other diamond sports — but flexible enough for any multi-team round-robin or playoff format.

### Features

- **Drag-and-drop calendar** — schedule games across a full season with visual day/week views
- **Playoff brackets** — auto-generate and manage single or double-elimination brackets
- **Live score entry** — shareable per-game links let scorekeepers update results from any device
- **iCal subscription feeds** — teams subscribe to their schedule in Google Calendar, Apple Calendar, or Outlook and receive automatic updates
- **Multi-tenant** — run separate leagues (tenants) on a single installation
- **Role-based access** — Keycloak integration for admin, team manager, and read-only roles

### Architecture

| Component | Role |
|-----------|------|
| Vite + React SPA | Main UI (drag-drop scheduler, brackets, score entry) |
| Express (Node.js) | ICS calendar feed endpoint |
| PocketBase | Embedded database — no external DB required |
| Keycloak | Authentication & authorization (external, user-supplied) |

PocketBase runs inside the container and its data is stored in Cloudron's persistent `localstorage` volume. No database addon is needed.

### Requirements

- A running **Keycloak** instance reachable from the internet (can be another Cloudron app)
- A Keycloak realm and client configured for the scheduler (see POSTINSTALL.md)
