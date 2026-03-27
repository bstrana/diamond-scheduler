export interface Team {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  country?: string;
  field?: string;
  roster?: Array<{
    number: number;
    name: string;
    position: string;
  }>;
  primaryColor: string;
  secondaryColor?: string;
  logoUrl?: string;
}

export interface League {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  category: string;
  color?: string;
  teams: Team[];
  fields?: string[];
  announcement?: string;
}

export interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string; // ISO String YYYY-MM-DD
  time: string; // HH:MM 24h format
  location: string;
  status: 'scheduled' | 'live' | 'final' | 'postponed';
  scores?: {
    home: number;
    away: number;
    innings?: Array<{ home: number | null; away: number | null }>;
    outs?: number;       // 0-2, only meaningful when status=live
    balls?: number;      // 0-3
    strikes?: number;    // 0-2
    baseRunners?: { first?: boolean; second?: boolean; third?: boolean };
  };
  recap?: string;
  leagueId?: string; // Deprecated: kept for backward compatibility
  leagueIds?: string[]; // New: array of league IDs
  gameNumber?: string;
  seriesName?: string; // Name of the series (e.g., "Semifinal", "Final")
  streamUrl?: string; // Optional live stream URL
  currentInning?: number; // Current inning for live games
  inningHalf?: 'top' | 'bottom'; // Top (▲) or bottom (▼) of the inning
}

export type ViewMode = 'calendar' | 'list' | 'teams' | 'leagues' | 'league_builder' | 'scheduler' | 'embed' | 'gamebar' | 'help' | 'bracket' | 'score_links' | 'tenant_settings';

export interface ScoreLink {
  id?: string;          // PocketBase record id
  token: string;        // UUID token that goes in the share URL
  gameId: string;       // game.id this link covers
  scheduleKey: string;  // which published schedule
  orgId?: string;
  userId?: string;
  disabled: boolean;
  expiresAt: string;    // ISO datetime (48 h from creation)
  created?: string;
}

export interface ScoreEdit {
  id?: string;
  gameId: string;
  scheduleKey: string;
  token: string;       // link token used (for audit)
  status: Game['status'];
  scores?: Game['scores'];
  recap?: string;
  updated?: string;
}

// ── Multi-tenancy / SaaS ──────────────────────────────────────────────────────

export type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface TenantLimits {
  leagues: number;
  teams: number;
  scoreLinks: number;
  publishedSchedules: number;
}

/** Hard limits enforced per plan. Override per-tenant in the `tenants` PocketBase record. */
export const PLAN_LIMITS: Record<TenantPlan, TenantLimits> = {
  free:       { leagues: 2,   teams: 20,  scoreLinks: 5,   publishedSchedules: 1 },
  starter:    { leagues: 5,   teams: 50,  scoreLinks: 20,  publishedSchedules: 3 },
  pro:        { leagues: 20,  teams: 200, scoreLinks: 100, publishedSchedules: 10 },
  enterprise: { leagues: 999, teams: 9999, scoreLinks: 999, publishedSchedules: 999 },
};

export interface TenantBranding {
  orgName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export interface Tenant {
  id?: string;
  orgId: string;
  name: string;
  plan: TenantPlan;
  /** Per-tenant limit overrides; falls back to PLAN_LIMITS[plan] when absent. */
  limits: TenantLimits;
  active: boolean;
  /** ISO date string — undefined means not on trial. */
  trialEndsAt?: string;
  branding?: TenantBranding;
  created?: string;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  games: Game[];
}

export interface AILeagueParams {
  theme: string;
  count: number;
}