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
}

export type ViewMode = 'calendar' | 'list' | 'teams' | 'leagues' | 'league_builder' | 'scheduler' | 'embed' | 'gamebar' | 'help' | 'bracket';

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