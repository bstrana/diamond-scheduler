import React, { useState, useEffect, useMemo } from 'react';
import { Team, Game, CalendarDay, League } from '../types';
import { MOCK_TEAMS, INITIAL_GAMES } from '../constants';
import { getMonthDays, formatDate } from '../utils';
import Calendar from './Calendar';
import { loadStorageData } from '../services/storage';

interface EmbeddableCalendarProps {
  initialLeagueId?: string;
  initialCategory?: string;
  initialTeamId?: string;
  initialView?: 'grid' | 'list';
  height?: string;
  dataOverride?: { leagues: League[]; teams: Team[]; games: Game[] } | null;
  hideLeagueFilter?: boolean;
  hideCategoryFilter?: boolean;
  hideTeamFilter?: boolean;
}

const EmbeddableCalendar: React.FC<EmbeddableCalendarProps> = ({
  initialLeagueId,
  initialCategory,
  initialTeamId,
  initialView = 'grid',
  height = '800px',
  dataOverride = null,
  hideLeagueFilter = false,
  hideCategoryFilter = false,
  hideTeamFilter = false
}) => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [games, setGames] = useState<Game[]>(INITIAL_GAMES);

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

  useEffect(() => {
    let isActive = true;
    const hydrate = async () => {
      if (dataOverride) {
        setLeagues(dataOverride.leagues || []);
        setGames(dataOverride.games || []);
        const leagueTeams = dataOverride.leagues.flatMap((l: League) => l.teams || []);
        const allTeams = [...(dataOverride.teams || []), ...leagueTeams];
        const uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());
        setTeams(uniqueTeams.length > 0 ? uniqueTeams : MOCK_TEAMS);
        return;
      }

      const data = await loadStorageData({
        leagues: [],
        teams: MOCK_TEAMS,
        games: INITIAL_GAMES,
        gamesInHoldingArea: []
      });
      if (!isActive) return;
      setLeagues(data.leagues);
      setGames(data.games);
      const leagueTeams = data.leagues.flatMap((l: League) => l.teams || []);
      const allTeams = [...data.teams, ...leagueTeams];
      const uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());
      setTeams(uniqueTeams.length > 0 ? uniqueTeams : MOCK_TEAMS);
    };
    hydrate();
    return () => {
      isActive = false;
    };
  }, [dataOverride]);

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

  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const announcement = useMemo(() => {
    const league = selectedLeagueId !== 'all'
      ? leagues.find(l => l.id === selectedLeagueId)
      : leagues[0];
    return league?.announcement || null;
  }, [leagues, selectedLeagueId]);

  return (
    <div style={{ height, width: '100%', display: 'flex', flexDirection: 'column' }} className="bg-slate-50">
      {announcement && !announcementDismissed && (
        <div style={{
          background: '#fef3c7',
          borderBottom: '1px solid #fcd34d',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          fontSize: '0.85em',
          color: '#92400e',
          flexShrink: 0,
        }}>
          <span>📢 {announcement}</span>
          <button
            onClick={() => setAnnouncementDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', fontWeight: 700, fontSize: '1em', lineHeight: 1, padding: '2px 4px' }}
            title="Dismiss"
          >×</button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
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
          hideLeagueFilter={hideLeagueFilter}
          hideCategoryFilter={hideCategoryFilter}
          hideTeamFilter={hideTeamFilter}
          hideViewToggle={initialView === 'list'}
        />
      </div>
    </div>
  );
};

export default EmbeddableCalendar;

