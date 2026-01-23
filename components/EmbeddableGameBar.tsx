import React, { useState, useEffect, useMemo } from 'react';
import { Team, Game, League } from '../types';
import { MOCK_TEAMS, INITIAL_GAMES } from '../constants';
import { formatDate } from '../utils';
import GameBar from './GameBar';

interface EmbeddableGameBarProps {
  initialLeagueId?: string;
  initialCategory?: string;
  initialTeamId?: string;
  height?: string;
}

const EmbeddableGameBar: React.FC<EmbeddableGameBarProps> = ({
  initialLeagueId,
  initialCategory,
  initialTeamId,
  height = '400px'
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

  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId || 'all');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(initialLeagueId || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');

  // Apply initial filters from URL params
  useEffect(() => {
    if (initialLeagueId) setSelectedLeagueId(initialLeagueId);
    if (initialCategory) setSelectedCategory(initialCategory);
    if (initialTeamId) setSelectedTeamId(initialTeamId);
  }, [initialLeagueId, initialCategory, initialTeamId]);

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
      />
    </div>
  );
};

export default EmbeddableGameBar;

