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

export type ViewMode = 'calendar' | 'list' | 'teams' | 'leagues' | 'league_builder' | 'scheduler' | 'embed' | 'gamebar' | 'help' | 'bracket' | 'score_links';

export interface ScoreLink {
  id?: string;          // PocketBase record id
  token: string;        // UUID token that goes in the share URL
  gameId: string;       // game.id this link covers
  scheduleKey: string;  // which published schedule
  orgId?: string;
  userId?: string;
  disabled: boolean;
  autoSync: boolean;    // automatically apply submitted scores without manual sync
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
  updated?: string;
}

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