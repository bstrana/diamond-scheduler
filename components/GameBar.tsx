import React, { useMemo, useEffect } from 'react';
import { Game, Team, League } from '../types';
import { formatDate, buildGameShareText, copyToClipboard } from '../utils';
import { ChevronLeft, ChevronRight, MapPin, Calendar as CalIcon, Clock, ChevronDown, SlidersHorizontal, Radio, Share2, Copy, Check, Maximize2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GameBarProps {
  games: Game[];
  teams: Team[];
  leagues?: League[];
  selectedTeamId: string;
  selectedLeagueId: string;
  selectedCategory: string;
  selectedStatus: string;
  onGameClick?: (game: Game) => void;
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
  const { t, i18n } = useTranslation();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = React.useState(0);
  const [showFiltersMenu, setShowFiltersMenu] = React.useState(false);
  const filtersMenuRef = React.useRef<HTMLDivElement>(null);
  const [shareGameId, setShareGameId] = React.useState<string | null>(null);
  const [copiedGameId, setCopiedGameId] = React.useState<string | null>(null);
  const sharePopoverRef = React.useRef<HTMLDivElement>(null);
  const [touchedCardId, setTouchedCardId] = React.useState<string | null>(null);
  const [fullscreenGame, setFullscreenGame] = React.useState<Game | null>(null);
  const isTouchDevice = React.useMemo(() =>
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
  []);

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

  const teamRecords = useMemo(() => {
    const records: Record<string, { w: number; l: number }> = {};
    games.forEach(g => {
      if (g.status !== 'final' || !g.scores) return;
      if (!records[g.homeTeamId]) records[g.homeTeamId] = { w: 0, l: 0 };
      if (!records[g.awayTeamId]) records[g.awayTeamId] = { w: 0, l: 0 };
      if (g.scores.home > g.scores.away) { records[g.homeTeamId].w++; records[g.awayTeamId].l++; }
      else if (g.scores.away > g.scores.home) { records[g.awayTeamId].w++; records[g.homeTeamId].l++; }
    });
    return records;
  }, [games]);

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

  useEffect(() => {
    if (!shareGameId) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (sharePopoverRef.current && !sharePopoverRef.current.contains(event.target as Node)) {
        setShareGameId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [shareGameId]);

  useEffect(() => {
    if (!touchedCardId) return;
    const clear = () => setTouchedCardId(null);
    document.addEventListener('touchstart', clear, { passive: true });
    return () => document.removeEventListener('touchstart', clear);
  }, [touchedCardId]);

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
    if (status === 'postponed') {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
          PPD
        </span>
      );
    }
    return null;
  };

  // ── Fullscreen story overlay ──────────────────────────────────────────────
  const renderStoryOverlay = () => {
    if (!fullscreenGame) return null;
    const g = fullscreenGame;
    const home = getTeam(g.homeTeamId);
    const away = getTeam(g.awayTeamId);
    const gameLeagues = getGameLeagues(g);
    if (!home || !away) return null;

    const isLive = g.status === 'live';
    const isFinal = g.status === 'final';
    const isPostponed = g.status === 'postponed';
    const hasScore = (isLive || isFinal) && g.scores != null;
    const awayWon = hasScore && g.scores!.away > g.scores!.home;
    const homeWon = hasScore && g.scores!.home > g.scores!.away;
    const gameDate = new Date(g.date + 'T00:00:00');
    const dateFmt = gameDate.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' });

    // Build gradient from team colors
    const awayColor = away.primaryColor || '#4f46e5';
    const homeColor = home.primaryColor || '#7c3aed';
    const bg = `linear-gradient(135deg, ${awayColor}cc 0%, #0f172a 50%, ${homeColor}cc 100%)`;

    const TeamBlock = ({ team, score, won }: { team: Team; score: number | null; won: boolean }) => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
        {team.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} style={{ width: '96px', height: '96px', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))' }} />
        ) : (
          <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: team.primaryColor || '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>⚾</div>
        )}
        <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', textShadow: '0 2px 6px rgba(0,0,0,0.7)', textAlign: 'center', letterSpacing: '0.04em' }}>{team.abbreviation}</span>
        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', textAlign: 'center' }}>{team.city}</span>
        {hasScore && score !== null && (
          <span style={{ color: won ? '#4ade80' : '#fff', fontSize: '3rem', fontWeight: 900, lineHeight: 1, textShadow: won ? '0 0 24px rgba(74,222,128,0.6)' : '0 2px 10px rgba(0,0,0,0.5)', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
        )}
      </div>
    );

    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', padding: '16px' }}
        onClick={() => setFullscreenGame(null)}
      >
        {/* Story card */}
        <div
          style={{ position: 'relative', width: '100%', maxWidth: '380px', borderRadius: '24px', overflow: 'hidden', background: bg, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cover image overlay */}
          {gameLeagues[0]?.coverImageUrl && (
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${gameLeagues[0].coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1, pointerEvents: 'none' }} />
          )}

          {/* Close button — top-right */}
          <button
            onClick={() => setFullscreenGame(null)}
            style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', padding: 0, zIndex: 10, backdropFilter: 'blur(4px)' }}
          >
            <X size={16} />
          </button>

          {/* League header */}
          {gameLeagues.length > 0 && (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px', padding: '18px 56px 12px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {gameLeagues.map(league => (
                <div key={league.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {league.logoUrl && (
                    <img src={league.logoUrl} alt={league.name} style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>{league.name}</div>
                    {league.shortName && league.shortName !== league.name && (
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{league.shortName}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Status badge row */}
          {(isLive || isFinal || isPostponed) && (
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', paddingTop: '14px' }}>
              {isLive && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#22c55e', color: '#fff', fontSize: '0.8rem', fontWeight: 700, padding: '5px 14px', borderRadius: '999px', letterSpacing: '0.06em' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />LIVE
                </span>
              )}
              {isFinal && (
                <span style={{ background: '#334155', color: '#fff', fontSize: '0.8rem', fontWeight: 700, padding: '5px 14px', borderRadius: '999px', letterSpacing: '0.06em' }}>FINAL</span>
              )}
              {isPostponed && (
                <span style={{ background: '#f97316', color: '#fff', fontSize: '0.8rem', fontWeight: 700, padding: '5px 14px', borderRadius: '999px', letterSpacing: '0.06em' }}>POSTPONED</span>
              )}
            </div>
          )}

          {/* Series / Game info */}
          {(g.seriesName || g.gameNumber) && (
            <div style={{ textAlign: 'center', padding: '10px 16px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
              {g.seriesName}{g.seriesName && g.gameNumber ? ` · ` : ''}{g.gameNumber ? `#${g.gameNumber}` : ''}
            </div>
          )}

          {/* Teams & Score */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 20px' }}>
            <TeamBlock team={away} score={hasScore ? g.scores!.away : null} won={awayWon} />
            <div style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 700, fontSize: '1.4rem', flexShrink: 0, paddingBottom: hasScore ? '48px' : '0' }}>
              {hasScore ? '–' : '@'}
            </div>
            <TeamBlock team={home} score={hasScore ? g.scores!.home : null} won={homeWon} />
          </div>

          {/* Details */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '7px', padding: '0 20px 18px', color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <CalIcon size={13} style={{ flexShrink: 0 }} />
              <span>{dateFmt}{!hasScore && g.time ? ` · ${g.time}` : ''}</span>
            </div>
            {g.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <MapPin size={13} style={{ flexShrink: 0 }} />
                <span>{g.location}</span>
              </div>
            )}
            {g.recap && (
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', margin: '4px 0 0', lineHeight: 1.45 }}>{g.recap}</p>
            )}
          </div>

          {/* Action row — Watch Live only (copy removed) */}
          {g.streamUrl && (
            <div style={{ position: 'relative', padding: '0 16px 18px' }}>
              <a href={g.streamUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '12px', background: '#22c55e', color: '#fff', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}
                onClick={e => e.stopPropagation()}
              >
                <Radio size={15} />{t('gameBar.watchLiveStream')}
              </a>
            </div>
          )}

          {/* Branding */}
          <div style={{ position: 'relative', textAlign: 'center', padding: '0 16px 14px', color: 'rgba(255,255,255,0.25)', fontSize: '0.6rem', letterSpacing: '0.08em' }}>
            DIAMOND MANAGER SCHEDULER
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    <div
      className="h-full flex flex-col rounded-xl shadow-sm"
      style={{
        backgroundColor: 'var(--embed-card-bg, #ffffff)',
        border: 'var(--embed-border-width, 1px) solid var(--embed-border, #e2e8f0)',
        borderRadius: 'var(--embed-radius, 0.75rem)'
      }}
    >
      {!hideFilters && (!hideLeagueFilter || !hideCategoryFilter || !hideTeamFilter || !hideStatusFilter) && (
        <div
          className="relative border-b px-3 py-2"
          style={{
            borderBottomColor: 'var(--embed-border, #e2e8f0)',
            backgroundColor: 'var(--embed-bg, #f8fafc)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('gameBar.filters')}
            </div>
            <div className="relative" ref={filtersMenuRef}>
              <button
                onClick={() => setShowFiltersMenu((prev) => !prev)}
                className="flex items-center space-x-2 rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <SlidersHorizontal size={16} />
                <span>{t('gameBar.filterMenu')}</span>
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
                      <div className="text-xs font-semibold text-slate-500">{t('gameBar.gameStatus')}</div>
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
                        <option value="all">{t('gameBar.allStatuses')}</option>
                        <option disabled>──────────</option>
                        <option value="scheduled">{t('gameBar.statusScheduled')}</option>
                        <option value="live">{t('gameBar.statusLive')}</option>
                        <option value="final">{t('gameBar.statusFinal')}</option>
                      </select>
                    </div>
                  )}

                  {/* League Filter */}
                  {leagues.length > 0 && !hideLeagueFilter && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-500">{t('gameBar.league')}</div>
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
                        <option value="all">{t('gameBar.allLeagues')}</option>
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
                      <div className="text-xs font-semibold text-slate-500">{t('gameBar.category')}</div>
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
                        <option value="all">{t('gameBar.allCategories')}</option>
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
                      <div className="text-xs font-semibold text-slate-500">{t('gameBar.team')}</div>
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
                        <option value="all">{t('gameBar.allTeams')}</option>
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
          title={t('gameBar.scrollLeft')}
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
          title={t('gameBar.scrollRight')}
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
                  <p className="text-lg font-medium">{t('gameBar.noGamesFound')}</p>
                  <p className="text-sm">{t('gameBar.tryAdjustingFilters')}</p>
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
                const isPostponed = game.status === 'postponed';
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
                    onClick={onGameClick ? () => onGameClick(game) : undefined}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setTouchedCardId(game.id);
                    }}
                    className={`flex-shrink-0 w-72 mx-2 rounded-lg p-4 transition-all group${onGameClick ? ' cursor-pointer' : ''}`}
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
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
                    {/* League cover image background */}
                    {gameLeagues[0]?.coverImageUrl && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundImage: `url(${gameLeagues[0].coverImageUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          opacity: 0.07,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {/* League logo in bottom-right corner when no cover image */}
                    {gameLeagues[0]?.logoUrl && !gameLeagues[0]?.coverImageUrl && (
                      <img
                        src={gameLeagues[0].logoUrl}
                        alt=""
                        style={{
                          position: 'absolute',
                          bottom: 6,
                          right: 6,
                          width: 36,
                          height: 36,
                          objectFit: 'contain',
                          opacity: 0.18,
                          pointerEvents: 'none',
                          zIndex: 0,
                        }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}

                    {/* Share button — top-right corner of card (mouse hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareGameId(shareGameId === game.id ? null : game.id);
                      }}
                      className="absolute opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      style={{
                        top: '6px',
                        right: '6px',
                        padding: '4px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--embed-card-bg, #ffffff)',
                        border: '1px solid var(--embed-border, #e2e8f0)',
                        color: 'var(--embed-text, #64748b)',
                        cursor: 'pointer',
                        lineHeight: 0,
                      }}
                      title={t('gameBar.shareGame')}
                    >
                      <Share2 size={13} />
                    </button>

                    {/* Expand/story button — always visible on touch devices, hover on desktop */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullscreenGame(game);
                        setTouchedCardId(null);
                      }}
                      className={isTouchDevice ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        padding: '6px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--embed-primary, #4f46e5)',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        lineHeight: 0,
                        zIndex: 10,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                      title="View fullscreen"
                    >
                      <Maximize2 size={14} />
                    </button>

                    {/* Share popover */}
                    {shareGameId === game.id && (
                      <div
                        ref={sharePopoverRef}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute z-20 rounded-lg shadow-xl"
                        style={{
                          top: '28px',
                          right: '6px',
                          padding: '6px',
                          width: '148px',
                          backgroundColor: 'var(--embed-card-bg, #ffffff)',
                          border: '1px solid var(--embed-border, #e2e8f0)',
                        }}
                      >
                        <button
                          onClick={async () => {
                            const text = buildGameShareText(
                              game,
                              home,
                              away,
                              gameLeagues.map(l => l.shortName || l.name)
                            );
                            await copyToClipboard(text);
                            setCopiedGameId(game.id);
                            setTimeout(() => setCopiedGameId(null), 2000);
                          }}
                          className="flex items-center gap-2 w-full text-left rounded-md"
                          style={{
                            padding: '6px 8px',
                            fontSize: '0.8125rem',
                            color: copiedGameId === game.id ? '#16a34a' : 'var(--embed-text, #334155)',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--embed-bg, #f8fafc)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {copiedGameId === game.id
                            ? <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                            : <Copy size={14} style={{ flexShrink: 0 }} />
                          }
                          {copiedGameId === game.id ? t('common.copied') : t('gameBar.copyText')}
                        </button>
                      </div>
                    )}

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
                            {gameDate.toLocaleDateString(i18n.language, { weekday: 'short' })}
                          </div>
                          <div className="text-base font-bold">
                            {gameDate.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          {/* Status badge — always shown when live/final/postponed; TODAY shown for scheduled */}
                          {(isLive || isFinal || isPostponed) ? (
                            <div className="mb-1">{renderStatusBadge(game.status)}</div>
                          ) : isToday ? (
                            <div className="text-xs bg-white/20 px-2 py-1 rounded-full font-semibold mb-1">
                              {t('gameBar.today')}
                            </div>
                          ) : null}
                          {!isLive && !isFinal && !isPostponed && (
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
                              title={t('gameBar.watchLiveStream')}
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
                    {/* Teams — left=away, right=home; in single-team mode show both */}
                    {isSingleTeamFilter && opponent ? (() => {
                      const selectedTeam = getTeam(selectedTeamId);
                      // Left = away team, Right = home team (standard convention)
                      const leftTeam  = isSelectedTeamAway ? selectedTeam : opponent;
                      const rightTeam = isSelectedTeamAway ? opponent     : selectedTeam;
                      const awayScore = hasScore ? game.scores!.away : null;
                      const homeScore = hasScore ? game.scores!.home : null;
                      const awayWon   = hasScore && awayScore !== null && homeScore !== null && awayScore > homeScore;
                      const homeWon   = hasScore && awayScore !== null && homeScore !== null && homeScore > awayScore;

                      const renderTeamCol = (team: Team | null | undefined, score: number | null, isWinner: boolean) => (
                        <div className="flex flex-col items-center space-y-1">
                          <div className="flex items-center space-x-2">
                            {team?.logoUrl ? (
                              <img src={team.logoUrl} alt={`${team.name} logo`} className="w-10 h-10 object-contain" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }} />
                            ) : (
                              <span className="text-2xl">⚾</span>
                            )}
                            <div className="flex flex-col">
                              <span className="font-bold text-sm" style={{ color: team?.primaryColor || 'var(--embed-text, #334155)' }}>
                                {team?.abbreviation ?? '?'}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--embed-text, #64748b)' }}>
                                {team?.city ?? ''}
                              </span>
                              {team && teamRecords[team.id] && (
                                <span className="text-xs font-medium" style={{ color: 'var(--embed-text, #94a3b8)' }}>
                                  {teamRecords[team.id].w}-{teamRecords[team.id].l}
                                </span>
                              )}
                            </div>
                          </div>
                          {hasScore && score !== null && (
                            <span className="text-2xl font-bold tabular-nums" style={{
                              color: isWinner ? 'var(--embed-primary, #4f46e5)' : 'var(--embed-text, #1e293b)'
                            }}>
                              {score}
                            </span>
                          )}
                        </div>
                      );

                      return (
                        <div className="flex items-center justify-center space-x-3">
                          {renderTeamCol(leftTeam, awayScore, awayWon)}
                          <div className="font-bold text-base" style={{ color: 'var(--embed-text, #94a3b8)' }}>
                            {hasScore ? '–' : (isSelectedTeamAway ? '@' : 'vs')}
                          </div>
                          {renderTeamCol(rightTeam, homeScore, homeWon)}
                        </div>
                      );
                    })() : (
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
                              {teamRecords[away.id] && (
                                <span className="text-xs font-medium" style={{ color: 'var(--embed-text, #94a3b8)' }}>
                                  {teamRecords[away.id].w}-{teamRecords[away.id].l}
                                </span>
                              )}
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
                              {teamRecords[home.id] && (
                                <span className="text-xs font-medium" style={{ color: 'var(--embed-text, #94a3b8)' }}>
                                  {teamRecords[home.id].w}-{teamRecords[home.id].l}
                                </span>
                              )}
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
    {renderStoryOverlay()}
    </>
  );
};

export default GameBar;
