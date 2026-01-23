import React, { useState, useEffect, useMemo } from 'react';
import { Team, Game, CalendarDay, League } from '../types';
import { MOCK_TEAMS, INITIAL_GAMES } from '../constants';
import { getMonthDays, formatDate } from '../utils';
import Calendar from './Calendar';

interface EmbeddableCalendarProps {
  initialLeagueId?: string;
  initialCategory?: string;
  initialTeamId?: string;
  initialView?: 'grid' | 'list';
  height?: string;
}

const EmbeddableCalendar: React.FC<EmbeddableCalendarProps> = ({
  initialLeagueId,
  initialCategory,
  initialTeamId,
  initialView = 'grid',
  height = '800px'
}) => {
  // Load data from localStorage (shared with main app)
  const [leagues] = useState<League[]>(() => {
    const saved = localStorage.getItem('dsa_leagues');
    return saved ? JSON.parse(saved) : [];
  });

  const [teams] = useState<Team[]>(() => {
    const saved = localStorage.getItem('dsa_teams');
    const savedTeams = saved ? JSON.parse(saved) : MOCK_TEAMS;
    // Also include teams from leagues
    const savedLeagues = localStorage.getItem('dsa_leagues');
    const leagues = savedLeagues ? JSON.parse(savedLeagues) : [];
    const leagueTeams = leagues.flatMap((l: League) => l.teams || []);
    // Merge and deduplicate by id
    const allTeams = [...savedTeams, ...leagueTeams];
    const uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());
    return uniqueTeams.length > 0 ? uniqueTeams : MOCK_TEAMS;
  });

  const [games] = useState<Game[]>(() => {
    const saved = localStorage.getItem('dsa_games');
    return saved ? JSON.parse(saved) : INITIAL_GAMES;
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId || 'all');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(initialLeagueId || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [calendarView, setCalendarView] = useState<'grid' | 'list'>(initialView);

  // Apply initial filters from URL params
  useEffect(() => {
    if (initialLeagueId) setSelectedLeagueId(initialLeagueId);
    if (initialCategory) setSelectedCategory(initialCategory);
    if (initialTeamId) setSelectedTeamId(initialTeamId);
  }, [initialLeagueId, initialCategory, initialTeamId]);

  // Helper to get league IDs from a game (handles both old and new format)
  const getGameLeagueIds = (game: Game): string[] => {
    if (game.leagueIds && game.leagueIds.length > 0) {
      return game.leagueIds;
    }
    if (game.leagueId) {
      return [game.leagueId];
    }
    return [];
  };

  // Filter games - only show scheduled games
  const filteredGames = useMemo(() => {
    return games.filter(g => {
      // Only scheduled games
      if (g.status !== 'scheduled') {
        return false;
      }
      
      // Team filter
      if (selectedTeamId !== 'all') {
        if (g.homeTeamId !== selectedTeamId && g.awayTeamId !== selectedTeamId) {
          return false;
        }
      }
      
      // League filter
      if (selectedLeagueId !== 'all') {
        const gameLeagueIds = getGameLeagueIds(g);
        if (!gameLeagueIds.includes(selectedLeagueId)) {
          return false;
        }
      }
      
      // Category filter
      if (selectedCategory !== 'all') {
        const gameLeagueIds = getGameLeagueIds(g);
        const gameLeagues = gameLeagueIds.map(id => leagues.find(l => l.id === id)).filter(Boolean);
        const hasMatchingCategory = gameLeagues.some(l => l && l.category === selectedCategory);
        if (!hasMatchingCategory) {
          return false;
        }
      }
      
      return true;
    });
  }, [games, selectedTeamId, selectedLeagueId, selectedCategory, leagues]);

  // Calendar days
  const days = useMemo(() => {
    return getMonthDays(currentDate.getFullYear(), currentDate.getMonth(), filteredGames);
  }, [currentDate, filteredGames]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleGameClick = (game: Game) => {
    const home = teams.find(t => t.id === game.homeTeamId);
    const away = teams.find(t => t.id === game.awayTeamId);
    const seriesInfo = game.seriesName ? `\nSeries: ${game.seriesName}` : '';
    alert(`${game.date} @ ${game.time}\n${away?.name || 'Unknown'} vs ${home?.name || 'Unknown'}\nLocation: ${game.location}${seriesInfo}`);
  };

  const handleDateClick = () => {
    // Disable adding games in embed mode
  };

  const handleGameMove = () => {
    // Disable moving games in embed mode
  };

  const handleGameCopy = () => {
    // Disable copying games in embed mode
  };

  const handleDeleteGame = () => {
    // Disable deleting games in embed mode
  };

  return (
    <div style={{ height, width: '100%' }} className="bg-slate-50">
      <Calendar 
        currentDate={currentDate}
        days={days}
        filteredGames={filteredGames}
        teams={teams}
        leagues={leagues}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onGameClick={handleGameClick}
        onDateClick={handleDateClick}
        onGameMove={handleGameMove}
        onGameCopy={handleGameCopy}
        onDeleteGame={handleDeleteGame}
        viewType={calendarView}
        onViewTypeChange={setCalendarView}
        selectedTeamId={selectedTeamId}
        onTeamFilterChange={setSelectedTeamId}
        selectedLeagueId={selectedLeagueId}
        onLeagueFilterChange={setSelectedLeagueId}
        selectedCategory={selectedCategory}
        onCategoryFilterChange={setSelectedCategory}
      />
    </div>
  );
};

export default EmbeddableCalendar;

