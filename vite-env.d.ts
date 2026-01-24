/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KEYCLOAK_URL: string;
  readonly VITE_KEYCLOAK_REALM: string;
  readonly VITE_KEYCLOAK_CLIENT_ID: string;
  readonly VITE_APP_ID?: string;
  readonly VITE_LEAGUE_LIMIT?: string;
  readonly VITE_TEAM_LIMT?: string;
  readonly VITE_PB_URL?: string;
  readonly VITE_PB_COLLECTION?: string;
  readonly VITE_PB_SCHEDULE_COLLECTION?: string;
  readonly VITE_PB_SCHEDULE_PUBLISH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
