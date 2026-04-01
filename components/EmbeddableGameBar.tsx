import React, { useState, useEffect, useMemo } from 'react';
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
  hideStatusFilter?: boolean;
  hideLeagueName?: boolean;
  hideGameNumber?: boolean;
  orgName?: string;
}

const EmbeddableGameBar: React.FC<EmbeddableGameBarProps> = ({
  initialLeagueId,
  initialCategory,
  initialTeamId,
  height = '260px',
  dataOverride = null,
  hideLeagueFilter = false,
  hideCategoryFilter = false,
  hideTeamFilter = false,
  hideStatusFilter = false,
  hideLeagueName = false,
  hideGameNumber = false,
  orgName,
}) => {
  // Load data from storage (local storage or PocketBase)
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId || 'all');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(initialLeagueId || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Apply initial filters from URL params
  useEffect(() => {
    const ids = (initialLeagueId || '').split(',').filter(Boolean);
    setSelectedLeagueId(ids.length === 1 ? ids[0] : 'all');
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

  // When multiple leagues are specified (comma-separated), restrict visible data to those leagues
  const allowedLeagueIds = useMemo(() => (initialLeagueId || '').split(',').filter(Boolean), [initialLeagueId]);

  const visibleLeagues = useMemo(() => {
    if (allowedLeagueIds.length <= 1) return leagues;
    return leagues.filter(l => allowedLeagueIds.includes(l.id));
  }, [leagues, allowedLeagueIds]);

  const visibleGames = useMemo(() => {
    if (allowedLeagueIds.length <= 1) return games;
    const allowed = new Set(allowedLeagueIds);
    return games.filter(g => {
      const ids = g.leagueIds?.length ? g.leagueIds : g.leagueId ? [g.leagueId] : [];
      return ids.some(id => allowed.has(id));
    });
  }, [games, allowedLeagueIds]);

  // Hide filters if a single team is selected (for single team website embeds)
  const hideFilters = !!initialTeamId;

  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const announcement = useMemo(() => {
    const league = selectedLeagueId !== 'all'
      ? visibleLeagues.find(l => l.id === selectedLeagueId)
      : visibleLeagues[0];
    return league?.announcement || null;
  }, [visibleLeagues, selectedLeagueId]);

  return (
    <div
      style={{
        height,
        width: '100%',
        backgroundColor: 'var(--embed-bg, #f8fafc)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {announcement && !announcementDismissed && (
        <div style={{
          background: 'var(--embed-announcement-bg, #fef3c7)',
          borderBottom: '1px solid var(--embed-announcement-border, #fcd34d)',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          fontSize: '0.82em',
          color: 'var(--embed-announcement-text, #92400e)',
          flexShrink: 0,
        }}>
          <span>📢 {announcement}</span>
          <button
            onClick={() => setAnnouncementDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--embed-announcement-text, #92400e)', fontWeight: 700, fontSize: '1em', lineHeight: 1, padding: '2px 4px' }}
            title="Dismiss"
          >×</button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
      <GameBar
        games={visibleGames}
        teams={teams}
        leagues={visibleLeagues}
        selectedTeamId={selectedTeamId}
        selectedLeagueId={selectedLeagueId}
        selectedCategory={selectedCategory}
        onTeamFilterChange={setSelectedTeamId}
        onLeagueFilterChange={setSelectedLeagueId}
        onCategoryFilterChange={setSelectedCategory}
        selectedStatus={selectedStatus}
        onStatusFilterChange={setSelectedStatus}
        hideFilters={hideFilters}
        hideLeagueFilter={hideLeagueFilter}
        hideCategoryFilter={hideCategoryFilter}
        hideTeamFilter={hideTeamFilter}
        hideStatusFilter={hideStatusFilter}
        hideLeagueName={hideLeagueName}
        hideGameNumber={hideGameNumber}
        includePastDays={30}
        orgName={orgName}
      />
      </div>
    </div>
  );
};

export default EmbeddableGameBar;

