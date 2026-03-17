import React, { useMemo, useEffect } from 'react';
import { Game, Team, League } from '../types';
import { formatDate } from '../utils';
import { ChevronLeft, ChevronRight, MapPin, Calendar as CalIcon, Clock, ChevronDown, SlidersHorizontal, Radio } from 'lucide-react';

interface GameBarProps {
  games: Game[];
  teams: Team[];
  leagues?: League[];
  selectedTeamId: string;
  selectedLeagueId: string;
  selectedCategory: string;
  selectedStatus: string;
  onGameClick: (game: Game) => void;
  onTeamFilterChange: (id: string) => void;
  onLeagueFilterChange: (id: string) => void;
  onCategoryFilterChange: (category: string) => void;
  onStatusFilterChange: (status: string) => void;
  hideFilters?: boolean;
  hideLeagueFilter?: boolean;
  hideCategoryFilter?: boolean;
  hideTeamFilter?: boolean;
  hideStatusFilter?: boolean;
  /** Include games from this many days in the past (default 0 = only future games) */
  includePastDays?: number;
}

const GameBar: React.FC<GameBarProps> = ({
  games,
  teams,
  leagues = [],
  selectedTeamId,
  selectedLeagueId,
  selectedCategory,
  selectedStatus,
  onGameClick,
  onTeamFilterChange,
  onLeagueFilterChange,
  onCategoryFilterChange,
  onStatusFilterChange,
  hideFilters = false,
  hideLeagueFilter = false,
  hideCategoryFilter = false,
  hideTeamFilter = false,
  hideStatusFilter = false,
  includePastDays = 0,
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = React.useState(0);
  const [showFiltersMenu, setShowFiltersMenu] = React.useState(false);
  const filtersMenuRef = React.useRef<HTMLDivElement>(null);

  // Get cutoff date string for filtering
  const cutoffDate = new Date();
  if (includePastDays > 0) cutoffDate.setDate(cutoffDate.getDate() - includePastDays);
  const todayStr = formatDate(cutoffDate);

  // Helper functions (defined before useMemo)
  const getTeam = (id: string) => teams.find(t => t.id === id);
  const getLeague = (id?: string) => leagues.find(l => l.id === id);

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

  // Helper to get leagues for a game
  const getGameLeagues = (game: Game): League[] => {
    const leagueIds = getGameLeagueIds(game);
    return leagueIds.map(id => getLeague(id)).filter(Boolean) as League[];
  };

  // Filter games
  const filteredGames = useMemo(() => {
    return games.filter(g => {
      // Date filter: skip for live/final-specific filters so past results show
      const skipDateFilter = selectedStatus === 'live' || selectedStatus === 'final';
      if (!skipDateFilter && g.date < todayStr) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && g.status !== selectedStatus) {
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
    }).sort((a, b) => {
      // Sort finished games newest-first; everything else oldest-first
      const dir = selectedStatus === 'final' ? -1 : 1;
      if (a.date !== b.date) return dir * a.date.localeCompare(b.date);
      return dir * a.time.localeCompare(b.time);
    });
  }, [games, selectedTeamId, selectedLeagueId, selectedCategory, selectedStatus, leagues, todayStr]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 400;
    const newPosition = direction === 'left'
      ? scrollPosition - scrollAmount
      : scrollPosition + scrollAmount;

    scrollContainerRef.current.scrollTo({
      left: Math.max(0, newPosition),
      behavior: 'smooth'
    });
    setScrollPosition(Math.max(0, newPosition));
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setScrollPosition(scrollContainerRef.current.scrollLeft);
    }
  };

  const categories = useMemo(() => {
    return Array.from(new Set(leagues.map(l => l.category).filter(Boolean)));
  }, [leagues]);

  useEffect(() => {
    if (!showFiltersMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (filtersMenuRef.current && !filtersMenuRef.current.contains(event.target as Node)) {
        setShowFiltersMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFiltersMenu]);

  const renderStatusBadge = (status: Game['status']) => {
    if (status === 'live') {
      return (
        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-500 text-white">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          LIVE
        </span>
      );
    }
    if (status === 'final') {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-white">
          FINAL
        </span>
      );
    }
    return null;
  };

  return (
    <div
      className="h-full flex flex-col rounded-xl shadow-sm"
      style={{
        backgroundColor: 'var(--embed-card-bg, #ffffff)',
        border: 'var(--embed-border-width, 1px) solid var(--embed-border, #e2e8f0)',
        borderRadius: 'var(--embed-radius, 0.75rem)'
      }}
    >
      {!hideFilters && (
        <div
          className="relative border-b px-3 py-2"
          style={{
            borderBottomColor: 'var(--embed-border, #e2e8f0)',
            backgroundColor: 'var(--embed-bg, #f8fafc)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Filters
            </div>
            <div className="relative" ref={filtersMenuRef}>
              <button
                onClick={() => setShowFiltersMenu((prev) => !prev)}
                className="flex items-center space-x-2 rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <SlidersHorizontal size={16} />
                <span>Filter Menu</span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>
              {showFiltersMenu && (
                <div
                  className="absolute right-0 mt-2 w-60 rounded-lg border bg-white p-3 shadow-lg z-20 space-y-3"
                  style={{
                    borderColor: 'var(--embed-border, #e2e8f0)'
                  }}
                >
                  {/* Status Filter */}
                  {!hideStatusFilter && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-500">Game Status</div>
                      <select
                        value={selectedStatus}
                        onChange={(e) => onStatusFilterChange(e.target.value)}
                        className="w-full rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--embed-card-bg, #ffffff)',
                          border: 'var(--embed-border-width, 1px) solid var(--embed-border, #cbd5e1)',
                          borderRadius: 'var(--embed-card-radius, 0.375rem)',
                          color: 'var(--embed-text, #334155)',
                          fontFamily: 'var(--embed-font, inherit)',
                          fontSize: 'var(--embed-font-size, 0.875rem)',
                          '--tw-ring-color': 'var(--embed-primary, #4f46e5)'
                        } as React.CSSProperties}
                      >
                        <option value="all">All Statuses</option>
                        <option disabled>──────────</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="live">Live</option>
                        <option value="final">Final</option>
                      </select>
                    </div>
                  )}

                  {/* League Filter */}
                  {leagues.length > 0 && !hideLeagueFilter && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-500">League</div>
                      <select
                        value={selectedLeagueId}
                        onChange={(e) => onLeagueFilterChange(e.target.value)}
                        className="w-full rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--embed-card-bg, #ffffff)',
                          border: 'var(--embed-border-width, 1px) solid var(--embed-border, #cbd5e1)',
                          borderRadius: 'var(--embed-card-radius, 0.375rem)',
                          color: 'var(--embed-text, #334155)',
                          fontFamily: 'var(--embed-font, inherit)',
                          fontSize: 'var(--embed-font-size, 0.875rem)',
                          '--tw-ring-color': 'var(--embed-primary, #4f46e5)'
                        } as React.CSSProperties}
                      >
                        <option value="all">All Leagues</option>
                        <option disabled>──────────</option>
                        {leagues.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Category Filter */}
                  {categories.length > 0 && !hideCategoryFilter && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-500">Category</div>
                      <select
                        value={selectedCategory}
                        onChange={(e) => onCategoryFilterChange(e.target.value)}
                        className="w-full rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--embed-card-bg, #ffffff)',
                          border: 'var(--embed-border-width, 1px) solid var(--embed-border, #cbd5e1)',
                          borderRadius: 'var(--embed-card-radius, 0.375rem)',
                          color: 'var(--embed-text, #334155)',
                          fontFamily: 'var(--embed-font, inherit)',
                          fontSize: 'var(--embed-font-size, 0.875rem)',
                          '--tw-ring-color': 'var(--embed-primary, #4f46e5)'
                        } as React.CSSProperties}
                      >
                        <option value="all">All Categories</option>
                        <option disabled>──────────</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Team Filter */}
                  {!hideTeamFilter && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-500">Team</div>
                      <select
                        value={selectedTeamId}
                        onChange={(e) => onTeamFilterChange(e.target.value)}
                        className="w-full rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--embed-card-bg, #ffffff)',
                          border: 'var(--embed-border-width, 1px) solid var(--embed-border, #cbd5e1)',
                          borderRadius: 'var(--embed-card-radius, 0.375rem)',
                          color: 'var(--embed-text, #334155)',
                          fontFamily: 'var(--embed-font, inherit)',
                          fontSize: 'var(--embed-font-size, 0.875rem)',
                          '--tw-ring-color': 'var(--embed-primary, #4f46e5)'
                        } as React.CSSProperties}
                      >
                        <option value="all">All Teams</option>
                        <option disabled>──────────</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.city} {t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Game Bar - Single Row */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Scroll Buttons */}
        <button
          onClick={() => scroll('left')}
          disabled={scrollPosition === 0}
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full shadow-lg transition-all ${
            scrollPosition === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'
          }`}
          style={{
            backgroundColor: 'var(--embed-card-bg, #ffffff)',
            border: 'var(--embed-border-width, 1px) solid var(--embed-border, #cbd5e1)',
            boxShadow: 'var(--embed-card-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1))'
          }}
          title="Scroll Left"
        >
          <ChevronLeft
            size={20}
            style={{ color: 'var(--embed-text, #334155)' }}
          />
        </button>

        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full shadow-lg hover:shadow-xl transition-all"
          style={{
            backgroundColor: 'var(--embed-card-bg, #ffffff)',
            border: 'var(--embed-border-width, 1px) solid var(--embed-border, #cbd5e1)',
            boxShadow: 'var(--embed-card-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1))'
          }}
          title="Scroll Right"
        >
          <ChevronRight
            size={20}
            style={{ color: 'var(--embed-text, #334155)' }}
          />
        </button>

        {/* Horizontal Scrollable Container - Single Row */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 transparent'
          }}
        >
          <div className="flex h-full items-center min-w-max py-4 px-2">
            {filteredGames.length === 0 ? (
              <div
                className="flex items-center justify-center w-full h-full"
                style={{ color: 'var(--embed-text, #94a3b8)', opacity: 0.7 }}
              >
                <div className="text-center">
                  <CalIcon size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No games found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              </div>
            ) : (
              filteredGames.map(game => {
                const home = getTeam(game.homeTeamId);
                const away = getTeam(game.awayTeamId);
                const gameLeagues = getGameLeagues(game);
                const gameDate = new Date(game.date + 'T00:00:00');
                const isToday = formatDate(new Date()) === game.date;
                const isLive = game.status === 'live';
                const isFinal = game.status === 'final';
                const hasScore = (isLive || isFinal) && game.scores != null;

                if (!home || !away) return null;

                // When a single team is selected, show only the opponent
                const isSingleTeamFilter = selectedTeamId !== 'all';
                let opponent: Team | null = null;
                let isSelectedTeamHome = false;
                let isSelectedTeamAway = false;

                if (isSingleTeamFilter) {
                    if (game.homeTeamId === selectedTeamId) {
                        opponent = away;
                        isSelectedTeamHome = true;
                    } else if (game.awayTeamId === selectedTeamId) {
                        opponent = home;
                        isSelectedTeamAway = true;
                    }
                }

                return (
                  <div
                    key={game.id}
                    onClick={() => onGameClick(game)}
                    className="flex-shrink-0 w-72 mx-2 rounded-lg p-4 transition-all cursor-pointer group"
                    style={{
                      backgroundColor: 'var(--embed-card-bg, #ffffff)',
                      border: isLive
                        ? '1.5px solid #22c55e'
                        : 'var(--embed-border-width, 1px) solid var(--embed-card-border, #e2e8f0)',
                      borderRadius: 'var(--embed-card-radius, 0.5rem)',
                      boxShadow: isLive
                        ? '0 0 0 2px rgba(34,197,94,0.15)'
                        : 'var(--embed-card-shadow, 0 1px 3px 0 rgba(0, 0, 0, 0.1))',
                      padding: 'var(--embed-padding, 1rem)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = isLive ? '#16a34a' : 'var(--embed-primary, #6366f1)';
                      e.currentTarget.style.boxShadow = 'var(--embed-card-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isLive ? '#22c55e' : 'var(--embed-card-border, #e2e8f0)';
                      e.currentTarget.style.boxShadow = isLive
                        ? '0 0 0 2px rgba(34,197,94,0.15)'
                        : 'var(--embed-card-shadow, 0 1px 3px 0 rgba(0, 0, 0, 0.1))';
                    }}
                  >
                    {/* Date Header with Time, Location and Status Badge */}
                    <div
                      className="mb-3 px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: isLive
                          ? 'rgba(34, 197, 94, 0.1)'
                          : isToday
                            ? 'var(--embed-primary, #4f46e5)'
                            : 'var(--embed-bg, #f8fafc)',
                        color: isToday && !isLive
                          ? '#ffffff'
                          : 'var(--embed-text, #1e293b)',
                        borderRadius: 'var(--embed-card-radius, 0.5rem)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
                            {gameDate.toLocaleDateString(undefined, { weekday: 'short' })}
                          </div>
                          <div className="text-base font-bold">
                            {gameDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          {/* Status badge — always shown when live/final; TODAY shown for scheduled */}
                          {(isLive || isFinal) ? (
                            <div className="mb-1">{renderStatusBadge(game.status)}</div>
                          ) : isToday ? (
                            <div className="text-xs bg-white/20 px-2 py-1 rounded-full font-semibold mb-1">
                              TODAY
                            </div>
                          ) : null}
                          {!isLive && !isFinal && (
                            <div className="flex items-center space-x-1.5">
                              <Clock
                                size={12}
                                style={{
                                  color: isToday ? 'rgba(255, 255, 255, 0.8)' : 'var(--embed-text, #64748b)',
                                  opacity: isToday ? 0.8 : 1
                                }}
                              />
                              <span
                                className="text-sm font-medium"
                                style={{
                                  color: isToday ? '#ffffff' : 'var(--embed-text, #334155)'
                                }}
                              >
                                {game.time}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1 text-xs">
                            <MapPin
                              size={10}
                              style={{
                                color: isToday && !isLive ? 'rgba(255, 255, 255, 0.8)' : 'var(--embed-text, #64748b)',
                                opacity: isToday && !isLive ? 0.8 : 1
                              }}
                            />
                            <span
                              className="truncate max-w-[100px]"
                              style={{
                                color: isToday && !isLive ? 'rgba(255, 255, 255, 0.9)' : 'var(--embed-text, #64748b)'
                              }}
                            >
                              {game.location}
                            </span>
                          </div>
                          {game.streamUrl && (
                            <a
                              href={game.streamUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center space-x-1 text-xs font-semibold mt-0.5"
                              style={{ color: isLive ? '#22c55e' : 'var(--embed-primary, #4f46e5)' }}
                              title="Watch Live Stream"
                            >
                              <Radio size={10} />
                              <span>Watch</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Series Name, League & Game Number */}
                    {(game.seriesName || gameLeagues.length > 0 || game.gameNumber) && (
                      <div className="flex items-center justify-between mb-2 text-xs">
                        <div className="flex items-center space-x-2">
                          {game.seriesName && (
                            <span
                              className="px-2 py-0.5 rounded font-semibold text-xs"
                              style={{
                                backgroundColor: 'var(--embed-primary-light, rgba(79, 70, 229, 0.1))',
                                color: 'var(--embed-primary, #4f46e5)'
                              }}
                            >
                              {game.seriesName}
                            </span>
                          )}
                          {game.seriesName && gameLeagues.length > 0 && (
                            <span style={{ color: 'var(--embed-border, #cbd5e1)' }}>|</span>
                          )}
                          {gameLeagues.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {gameLeagues.map((league, idx) => (
                                <React.Fragment key={league.id}>
                                  <span
                                    className="px-2 py-0.5 rounded font-medium text-xs"
                                    style={{
                                      backgroundColor: 'var(--embed-bg, #f1f5f9)',
                                      color: 'var(--embed-text, #475569)'
                                    }}
                                  >
                                    {league.shortName || league.name}
                                  </span>
                                  {league.category && (
                                    <span
                                      className="text-xs"
                                      style={{ color: 'var(--embed-text, #94a3b8)' }}
                                    >
                                      {league.category}
                                    </span>
                                  )}
                                  {idx < gameLeagues.length - 1 && (
                                    <span style={{ color: 'var(--embed-border, #cbd5e1)' }}>|</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          )}
                        </div>
                        {game.gameNumber && (
                          <span
                            className="font-semibold"
                            style={{ color: 'var(--embed-primary, #4f46e5)' }}
                          >
                            #{game.gameNumber}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Teams — with inline score for live/final */}
                    {isSingleTeamFilter && opponent ? (
                      <div className="flex items-center space-x-2 w-full justify-center">
                        <span
                          className="font-bold text-lg"
                          style={{ color: 'var(--embed-text, #94a3b8)' }}
                        >
                          {isSelectedTeamAway ? '@' : 'vs'}
                        </span>
                        {opponent.logoUrl ? (
                          <img src={opponent.logoUrl} alt={`${opponent.name} logo`} className="w-10 h-10 object-contain" onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              const span = document.createElement('span');
                              span.className = 'text-2xl';
                              span.textContent = '⚾';
                              parent.insertBefore(span, e.currentTarget.nextSibling);
                            }
                          }} />
                        ) : (
                          <span className="text-2xl">⚾</span>
                        )}
                        <div className="flex flex-col">
                          <span
                            className="font-bold text-sm"
                            style={{ color: opponent.primaryColor }}
                          >
                            {opponent.abbreviation}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: 'var(--embed-text, #64748b)' }}
                          >
                            {opponent.city}
                          </span>
                        </div>
                        {hasScore && (
                          <div className="ml-2 flex flex-col items-center">
                            <span className="text-xl font-bold" style={{ color: 'var(--embed-text, #1e293b)' }}>
                              {isSelectedTeamAway
                                ? `${game.scores!.away} – ${game.scores!.home}`
                                : `${game.scores!.home} – ${game.scores!.away}`}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-3">
                        {/* Away Team */}
                        <div className="flex flex-col items-center space-y-1">
                          <div className="flex items-center space-x-2">
                            {away.logoUrl ? (
                              <img src={away.logoUrl} alt={`${away.name} logo`} className="w-10 h-10 object-contain" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  const span = document.createElement('span');
                                  span.className = 'text-2xl';
                                  span.textContent = '⚾';
                                  parent.insertBefore(span, e.currentTarget.nextSibling);
                                }
                              }} />
                            ) : (
                              <span className="text-2xl">⚾</span>
                            )}
                            <div className="flex flex-col">
                              <span
                                className="font-bold text-sm"
                                style={{ color: away.primaryColor }}
                              >
                                {away.abbreviation}
                              </span>
                              <span
                                className="text-xs"
                                style={{ color: 'var(--embed-text, #64748b)' }}
                              >
                                {away.city}
                              </span>
                            </div>
                          </div>
                          {hasScore && (
                            <span
                              className="text-2xl font-bold tabular-nums"
                              style={{
                                color: isFinal && game.scores!.away > game.scores!.home
                                  ? 'var(--embed-primary, #4f46e5)'
                                  : 'var(--embed-text, #1e293b)'
                              }}
                            >
                              {game.scores!.away}
                            </span>
                          )}
                        </div>

                        {/* Divider */}
                        <div
                          className="font-bold text-base"
                          style={{ color: 'var(--embed-text, #94a3b8)' }}
                        >
                          {hasScore ? '–' : '@'}
                        </div>

                        {/* Home Team */}
                        <div className="flex flex-col items-center space-y-1">
                          <div className="flex items-center space-x-2">
                            {home.logoUrl ? (
                              <img src={home.logoUrl} alt={`${home.name} logo`} className="w-10 h-10 object-contain" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  const span = document.createElement('span');
                                  span.className = 'text-2xl';
                                  span.textContent = '⚾';
                                  parent.insertBefore(span, e.currentTarget.nextSibling);
                                }
                              }} />
                            ) : (
                              <span className="text-2xl">⚾</span>
                            )}
                            <div className="flex flex-col">
                              <span
                                className="font-bold text-sm"
                                style={{ color: home.primaryColor }}
                              >
                                {home.abbreviation}
                              </span>
                              <span
                                className="text-xs"
                                style={{ color: 'var(--embed-text, #64748b)' }}
                              >
                                {home.city}
                              </span>
                            </div>
                          </div>
                          {hasScore && (
                            <span
                              className="text-2xl font-bold tabular-nums"
                              style={{
                                color: isFinal && game.scores!.home > game.scores!.away
                                  ? 'var(--embed-primary, #4f46e5)'
                                  : 'var(--embed-text, #1e293b)'
                              }}
                            >
                              {game.scores!.home}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBar;
