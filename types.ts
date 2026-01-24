export interface Team {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor?: string;
  logoUrl?: string;
}

export interface League {
  id: string;
  name: string;
  logoUrl?: string;
  coverImageUrl?: string;
  category: string;
  teams: Team[];
}

export interface Game {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string; // ISO String YYYY-MM-DD
  time: string; // HH:MM 24h format
  location: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'postponed';
  scores?: {
    home: number;
    away: number;
  };
  leagueId?: string; // Deprecated: kept for backward compatibility
  leagueIds?: string[]; // New: array of league IDs
  gameNumber?: number;
  seriesName?: string; // Name of the series (e.g., "Semifinal", "Final")
}

export type ViewMode = 'calendar' | 'list' | 'teams' | 'leagues' | 'league_builder' | 'scheduler' | 'embed' | 'gamebar';

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