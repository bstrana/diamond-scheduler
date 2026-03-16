import React, { useState, useEffect } from 'react';
import { Team, Game, League } from '../types';
import { MOCK_TEAMS, INITIAL_GAMES } from '../constants';
import { formatDate } from '../utils';
import GameBar from './GameBar';
import { loadStorageData } from '../services/storage';

interface EmbeddableGameBarProps {
  initialLeagueId?: string;
  initialCategory?: string;
  initialTeamId?: string;
  height?: string;
  dataOverride?: { leagues: League[]; teams: Team[]; games: Game[] } | null;
  hideLeagueFilter?: boolean;
  hideCategoryFilter?: boolean;
  hideTeamFilter?: boolean;
}

const EmbeddableGameBar: React.FC<EmbeddableGameBarProps> = ({
  initialLeagueId,
  initialCategory,
  initialTeamId,
  height = '260px',
  dataOverride = null,
  hideLeagueFilter = false,
  hideCategoryFilter = false,
  hideTeamFilter = false
}) => {
  // Load data from storage (local storage or PocketBase)
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId || 'all');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(initialLeagueId || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');

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

      const leagueTeams = data.leagues.flatMap((l: League) => l.teams || []);
      const allTeams = [...data.teams, ...leagueTeams];
      const uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());
      setTeams(uniqueTeams.length > 0 ? uniqueTeams : MOCK_TEAMS);

      setGames(data.games);
    };
    hydrate();
    return () => {
      isActive = false;
    };
  }, [dataOverride]);

  const handleGameClick = (game: Game) => {
    const home = teams.find(t => t.id === game.homeTeamId);
    const away = teams.find(t => t.id === game.awayTeamId);
    const seriesInfo = game.seriesName ? `\nSeries: ${game.seriesName}` : '';
    alert(`${game.date} @ ${game.time}\n${away?.name || 'Unknown'} vs ${home?.name || 'Unknown'}\nLocation: ${game.location}${seriesInfo}`);
  };

  // Hide filters if a single team is selected (for single team website embeds)
  const hideFilters = !!initialTeamId;

  return (
    <div
      style={{
        height,
        width: '100%',
        backgroundColor: 'var(--embed-bg, #f8fafc)'
      }}
    >
      <GameBar
        games={games}
        teams={teams}
        leagues={leagues}
        selectedTeamId={selectedTeamId}
        selectedLeagueId={selectedLeagueId}
        selectedCategory={selectedCategory}
        onGameClick={handleGameClick}
        onTeamFilterChange={setSelectedTeamId}
        onLeagueFilterChange={setSelectedLeagueId}
        onCategoryFilterChange={setSelectedCategory}
        hideFilters={hideFilters}
        hideLeagueFilter={hideLeagueFilter}
        hideCategoryFilter={hideCategoryFilter}
        hideTeamFilter={hideTeamFilter}
        includePastDays={30}
      />
    </div>
  );
};

export default EmbeddableGameBar;

