import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Team, Game, League } from '../types';
import { MOCK_TEAMS, INITIAL_GAMES } from '../constants';
import { formatDate, buildGameShareText, copyToClipboard } from '../utils';
import { loadStorageData } from '../services/storage';
import {
  MapPin,
  Calendar as CalIcon,
  Radio,
  Share2,
  Copy,
  Check,
  Maximize2,
  ImageDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmbeddableTeamGamesProps {
  teamId?: string;
  height?: string;
  dataOverride?: { leagues: League[]; teams: Team[]; games: Game[] } | null;
  orgName?: string;
  includePastDays?: number;
}

const EmbeddableTeamGames: React.FC<EmbeddableTeamGamesProps> = ({
  teamId,
  height = '500px',
  dataOverride = null,
  orgName,
  includePastDays = 30,
}) => {
  const { t, i18n } = useTranslation();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  const [shareGameId, setShareGameId] = useState<string | null>(null);
  const [copiedGameId, setCopiedGameId] = useState<string | null>(null);
  const sharePopoverRef = useRef<HTMLDivElement>(null);

  const [fullscreenGame, setFullscreenGame] = useState<Game | null>(null);
  const [copiedOverlayLink, setCopiedOverlayLink] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Table-level share
  const tableRef = useRef<HTMLDivElement>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isSavingTable, setIsSavingTable] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    let isActive = true;
    const hydrate = async () => {
      if (dataOverride) {
        setLeagues(dataOverride.leagues || []);
        setGames(dataOverride.games || []);
        const leagueTeams = dataOverride.leagues.flatMap((l: League) => l.teams || []);
        const all = [...(dataOverride.teams || []), ...leagueTeams];
        const unique = Array.from(new Map(all.map(t => [t.id, t])).values());
        setTeams(unique.length > 0 ? unique : MOCK_TEAMS);
        return;
      }
      const data = await loadStorageData({
        leagues: [],
        teams: MOCK_TEAMS,
        games: INITIAL_GAMES,
        gamesInHoldingArea: [],
      });
      if (!isActive) return;
      setLeagues(data.leagues);
      const leagueTeams = data.leagues.flatMap((l: League) => l.teams || []);
      const all = [...data.teams, ...leagueTeams];
      setTeams(Array.from(new Map(all.map(t => [t.id, t])).values()));
      setGames(data.games);
    };
    hydrate();
    return () => { isActive = false; };
  }, [dataOverride]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getTeam = (id: string) => teams.find(t => t.id === id);
  const getGameLeagues = (game: Game): League[] => {
    const ids = game.leagueIds?.length ? game.leagueIds : game.leagueId ? [game.leagueId] : [];
    return ids.map(id => leagues.find(l => l.id === id)).filter(Boolean) as League[];
  };

  // ── Table-level share helpers ────────────────────────────────────────────────
  const buildAllGamesText = (): string => {
    if (!selectedTeam) return '';
    const header = `${selectedTeam.city} ${selectedTeam.name} — Schedule\n${'─'.repeat(44)}`;
    const lines = filteredGames.map(g => {
      const home = getTeam(g.homeTeamId);
      const away = getTeam(g.awayTeamId);
      if (!home || !away) return '';
      return buildGameShareText(g, home, away, getGameLeagues(g).map(l => l.shortName || l.name));
    }).filter(Boolean);
    return [header, ...lines].join('\n\n');
  };

  const handleCopyAll = async () => {
    await copyToClipboard(buildAllGamesText());
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleSaveTable = async () => {
    if (!tableRef.current || isSavingTable) return;
    setIsSavingTable(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(tableRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `${selectedTeam?.name?.replace(/\s+/g, '-') ?? 'team'}-schedule.png`;
      link.href = canvas.toDataURL('image/png');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch { /* ignore */ } finally {
      setIsSavingTable(false);
    }
  };

  // ── Share popover outside-click ─────────────────────────────────────────────
  useEffect(() => {
    if (!shareGameId) return;
    const onClickOutside = (e: MouseEvent) => {
      if (sharePopoverRef.current && !sharePopoverRef.current.contains(e.target as Node)) {
        setShareGameId(null);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [shareGameId]);

  // ── Fullscreen ESC sync ──────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreenGame(null); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const openFullscreen = async (game: Game) => {
    setFullscreenGame(game);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch { /* not available */ }
  };

  const closeFullscreen = async () => {
    setFullscreenGame(null);
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
  };

  const captureCard = async (game: Game) => {
    if (!cardRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        backgroundColor: null,
        scale: 2,
      });
      const link = document.createElement('a');
      const home = getTeam(game.homeTeamId);
      const away = getTeam(game.awayTeamId);
      link.download = `${away?.abbreviation ?? 'AWAY'}-at-${home?.abbreviation ?? 'HOME'}-${game.date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch { /* ignore */ } finally {
      setIsCapturing(false);
    }
  };

  // ── Filtered & sorted games ──────────────────────────────────────────────────
  const cutoffDate = useMemo(() => {
    const d = new Date();
    if (includePastDays > 0) d.setDate(d.getDate() - includePastDays);
    return formatDate(d);
  }, [includePastDays]);

  const filteredGames = useMemo(() => {
    return games
      .filter(g => {
        if (g.date < cutoffDate) return false;
        if (!teamId || teamId === 'all') return true;
        return g.homeTeamId === teamId || g.awayTeamId === teamId;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  }, [games, teamId, cutoffDate]);

  const selectedTeam = teamId ? getTeam(teamId) : undefined;

  // ── Status badge ─────────────────────────────────────────────────────────────
  const renderStatusBadge = (status: Game['status']) => {
    if (status === 'live') {
      return (
        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-500 text-white whitespace-nowrap">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          LIVE
        </span>
      );
    }
    if (status === 'final') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-white whitespace-nowrap">FINAL</span>;
    if (status === 'postponed') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white whitespace-nowrap">PPD</span>;
    return null;
  };

  // ── Fullscreen story card (same visual as GameBar) ───────────────────────────
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

    const awayColor = away.primaryColor || '#4f46e5';
    const homeColor = home.primaryColor || '#7c3aed';
    const bg = `linear-gradient(135deg, ${awayColor}cc 0%, #0f172a 50%, ${homeColor}cc 100%)`;

    const TeamBlock = ({ team, score, won }: { team: Team; score: number | null; won: boolean }) => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
        {team.logoUrl
          ? <img src={team.logoUrl} alt={team.name} style={{ width: '96px', height: '96px', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))' }} />
          : <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: team.primaryColor || '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>⚾</div>
        }
        <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', textShadow: '0 2px 6px rgba(0,0,0,0.7)', textAlign: 'center', letterSpacing: '0.04em' }}>{team.abbreviation}</span>
        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', textAlign: 'center' }}>{team.city}</span>
        {hasScore && score !== null && (
          <span style={{ color: won ? '#4ade80' : '#fff', fontSize: '3rem', fontWeight: 900, lineHeight: 1, textShadow: won ? '0 0 24px rgba(74,222,128,0.6)' : '0 2px 10px rgba(0,0,0,0.5)', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
        )}
      </div>
    );

    const overlay = (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'rgba(0,0,0,0.9)' }}
        onClick={closeFullscreen}
      >
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
          <div
            ref={cardRef}
            style={{ position: 'relative', width: '100%', maxWidth: '380px', borderRadius: '24px', overflow: 'hidden', background: bg, boxShadow: '0 32px 80px rgba(0,0,0,0.7)', flexShrink: 0 }}
            onClick={e => e.stopPropagation()}
          >
            {gameLeagues[0]?.coverImageUrl && (
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${gameLeagues[0].coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1, pointerEvents: 'none' }} />
            )}
            {gameLeagues.length > 0 && (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px', padding: '18px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {gameLeagues.map(league => (
                  <div key={league.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {league.logoUrl && <img src={league.logoUrl} alt={league.name} style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />}
                    <div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>{league.name}</div>
                      {!isFinal && league.shortName && league.shortName !== league.name && (
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{league.shortName}</div>
                      )}
                    </div>
                  </div>
                ))}
                {isFinal && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', marginTop: '2px', flexWrap: 'wrap' }}>
                    <CalIcon size={11} style={{ flexShrink: 0 }} />
                    <span>{dateFmt}{g.location ? ` · ${g.location}` : ''}</span>
                  </div>
                )}
              </div>
            )}
            {(isLive || isFinal || isPostponed || g.streamUrl) && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', paddingTop: '14px', flexWrap: 'wrap' }}>
                {isLive && <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#22c55e', color: '#fff', fontSize: '0.8rem', fontWeight: 700, padding: '5px 14px', borderRadius: '999px', letterSpacing: '0.06em' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff', display: 'inline-block' }} />LIVE</span>}
                {isFinal && <span style={{ background: '#334155', color: '#fff', fontSize: '0.8rem', fontWeight: 700, padding: '5px 14px', borderRadius: '999px', letterSpacing: '0.06em' }}>FINAL</span>}
                {isPostponed && <span style={{ background: '#f97316', color: '#fff', fontSize: '0.8rem', fontWeight: 700, padding: '5px 14px', borderRadius: '999px', letterSpacing: '0.06em' }}>POSTPONED</span>}
                {g.streamUrl && (
                  <a href={g.streamUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4ade80', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                    <Radio size={12} />{t('gameBar.watchLiveStream')}
                  </a>
                )}
              </div>
            )}
            {g.seriesName && <div style={{ textAlign: 'center', padding: '10px 16px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>{g.seriesName}</div>}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '8px', padding: '24px 20px' }}>
              <TeamBlock team={away} score={hasScore ? g.scores!.away : null} won={awayWon} />
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', height: '96px' }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 700, fontSize: '1.4rem' }}>{hasScore ? '–' : '@'}</span>
              </div>
              <TeamBlock team={home} score={hasScore ? g.scores!.home : null} won={homeWon} />
            </div>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '7px', padding: '0 20px 18px', color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem' }}>
              {!isLive && !isFinal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <CalIcon size={13} style={{ flexShrink: 0 }} />
                  <span>{dateFmt}{g.time ? ` · ${g.time}` : ''}</span>
                </div>
              )}
              {!isLive && !isFinal && g.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <MapPin size={13} style={{ flexShrink: 0 }} />
                  <span>{g.location}</span>
                </div>
              )}
              {g.recap && <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', margin: '4px 0 0', lineHeight: 1.45 }}>{g.recap}</p>}
            </div>
            <div style={{ position: 'relative', textAlign: 'center', padding: '0 16px 14px', color: 'rgba(255,255,255,0.25)', fontSize: '0.6rem', letterSpacing: '0.08em' }}>
              {orgName || (import.meta.env.VITE_ORG_NAME as string | undefined) || 'DIAMOND SCHEDULER'}
            </div>
          </div>

          {/* Action buttons outside the card */}
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button
              onClick={e => { e.stopPropagation(); captureCard(g); }}
              disabled={isCapturing}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '999px', border: 'none', backgroundColor: isCapturing ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: isCapturing ? 'default' : 'pointer', backdropFilter: 'blur(6px)' }}
            >
              <ImageDown size={16} />
              {isCapturing ? 'Saving…' : 'Save as image'}
            </button>
            {g.streamUrl && (
              <button
                onClick={async e => { e.stopPropagation(); await copyToClipboard(g.streamUrl!); setCopiedOverlayLink(true); setTimeout(() => setCopiedOverlayLink(false), 2000); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '999px', border: 'none', backgroundColor: copiedOverlayLink ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.15)', color: copiedOverlayLink ? '#4ade80' : '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(6px)' }}
              >
                {copiedOverlayLink ? <Check size={16} /> : <Radio size={16} />}
                {copiedOverlayLink ? 'Copied!' : 'Copy link'}
              </button>
            )}
          </div>
        </div>
      </div>
    );

    const portalTarget = (document.fullscreenElement as HTMLElement) || document.body;
    return ReactDOM.createPortal(overlay, portalTarget);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const today = formatDate(new Date());

  return (
    <div style={{ height, width: '100%', backgroundColor: 'var(--embed-bg, #f8fafc)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--embed-font, Inter, sans-serif)', fontSize: 'var(--embed-font-size, 14px)', color: 'var(--embed-text, #1e293b)', overflow: 'hidden' }}>

      {/* Capture wrapper — everything inside gets captured as the schedule image */}
      <div ref={tableRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Team header banner with team colors */}
      <div style={{
        background: selectedTeam
          ? `linear-gradient(135deg, ${selectedTeam.primaryColor || '#4f46e5'} 0%, ${selectedTeam.secondaryColor || '#7c3aed'} 100%)`
          : 'var(--embed-primary, #4f46e5)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}>
        {/* Logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {selectedTeam?.logoUrl
            ? <img src={selectedTeam.logoUrl} alt={selectedTeam.name} style={{ width: 40, height: 40, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))', flexShrink: 0 }} />
            : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>⚾</div>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedTeam ? `${selectedTeam.city} ${selectedTeam.name}` : 'Team Schedule'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
              {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Table-level share toolbar */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleCopyAll}
            title="Copy full schedule as text"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          >
            {copiedAll ? <Check size={13} /> : <Copy size={13} />}
            {copiedAll ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleSaveTable}
            disabled={isSavingTable}
            title="Download schedule as image"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: isSavingTable ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: isSavingTable ? 0.6 : 1 }}
            onMouseEnter={e => { if (!isSavingTable) e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          >
            <ImageDown size={13} />
            {isSavingTable ? 'Saving…' : 'Save image'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredGames.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.45)', fontSize: '0.875rem' }}>
            No upcoming games
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--embed-card-bg, #ffffff)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.5)', borderBottom: '1px solid var(--embed-border, #e2e8f0)', whiteSpace: 'nowrap' }}>DATE</th>
                <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.5)', borderBottom: '1px solid var(--embed-border, #e2e8f0)', whiteSpace: 'nowrap' }}>OPPONENT</th>
                <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.5)', borderBottom: '1px solid var(--embed-border, #e2e8f0)', whiteSpace: 'nowrap' }}>LOCATION</th>
                <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.5)', borderBottom: '1px solid var(--embed-border, #e2e8f0)', whiteSpace: 'nowrap' }}>STATUS</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.5)', borderBottom: '1px solid var(--embed-border, #e2e8f0)', whiteSpace: 'nowrap' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredGames.map((game, idx) => {
                const home = getTeam(game.homeTeamId);
                const away = getTeam(game.awayTeamId);
                if (!home || !away) return null;

                const isHome = game.homeTeamId === teamId;
                const opponent = isHome ? away : home;
                const isLive = game.status === 'live';
                const isFinal = game.status === 'final';
                const hasScore = (isLive || isFinal) && game.scores != null;
                const isToday = game.date === today;
                const gameLeagues = getGameLeagues(game);

                const gameDate = new Date(game.date + 'T00:00:00');
                const dateParts = gameDate.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
                const weekday = gameDate.toLocaleDateString(i18n.language, { weekday: 'short' });

                const myScore = hasScore ? (isHome ? game.scores!.home : game.scores!.away) : null;
                const oppScore = hasScore ? (isHome ? game.scores!.away : game.scores!.home) : null;
                const won = myScore !== null && oppScore !== null && myScore > oppScore;
                const lost = myScore !== null && oppScore !== null && myScore < oppScore;

                const teamPrimary = selectedTeam?.primaryColor || '#4f46e5';
                const rowBg = isLive
                  ? 'rgba(34,197,94,0.05)'
                  : isToday
                    ? `${teamPrimary}12`
                    : idx % 2 === 0
                      ? 'var(--embed-card-bg, #ffffff)'
                      : 'var(--embed-bg, #f8fafc)';

                return (
                  <tr
                    key={game.id}
                    style={{ backgroundColor: rowBg, cursor: 'pointer', transition: 'background-color 0.1s', borderLeft: `3px solid ${isToday || isLive ? teamPrimary : 'transparent'}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = `${teamPrimary}15`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = rowBg; }}
                    onClick={() => openFullscreen(game)}
                  >
                    {/* Date */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--embed-border, #e2e8f0)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: isToday ? 700 : 500, fontSize: '0.85rem', color: isToday ? teamPrimary : 'inherit' }}>{dateParts}</div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.5)' }}>
                        {weekday}{game.time ? ` · ${game.time}` : ''}
                      </div>
                    </td>

                    {/* Opponent */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--embed-border, #e2e8f0)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* H/A badge */}
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(var(--embed-text-rgb, 30,41,59),0.4)', letterSpacing: '0.04em', width: '14px', flexShrink: 0 }}>
                          {isHome ? 'vs' : '@'}
                        </span>
                        {opponent.logoUrl
                          ? <img src={opponent.logoUrl} alt={opponent.name} style={{ width: '22px', height: '22px', objectFit: 'contain', borderRadius: '3px', flexShrink: 0 }} />
                          : <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: opponent.primaryColor || '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', flexShrink: 0 }}>⚾</div>
                        }
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.2 }}>{opponent.abbreviation}</div>
                          {gameLeagues.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.45)' }}>
                              {gameLeagues.map(l => l.shortName || l.name).join(', ')}
                            </div>
                          )}
                        </div>
                        {/* Score */}
                        {hasScore && myScore !== null && oppScore !== null && (
                          <span style={{ marginLeft: '6px', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.03em', color: won ? '#16a34a' : lost ? '#dc2626' : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                            {myScore}–{oppScore}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--embed-border, #e2e8f0)', maxWidth: '160px' }}>
                      {game.location
                        ? <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.65)' }}>
                            <MapPin size={11} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.location}</span>
                          </div>
                        : <span style={{ fontSize: '0.75rem', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.3)' }}>—</span>
                      }
                    </td>

                    {/* Status */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--embed-border, #e2e8f0)', whiteSpace: 'nowrap' }}>
                      {renderStatusBadge(game.status) ?? (
                        <span style={{ fontSize: '0.78rem', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.45)' }}>Scheduled</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td
                      style={{ padding: '10px 8px', borderBottom: '1px solid var(--embed-border, #e2e8f0)', textAlign: 'right', whiteSpace: 'nowrap' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
                        {/* Fullscreen */}
                        <button
                          onClick={() => openFullscreen(game)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.4)', display: 'flex', alignItems: 'center' }}
                          title="View game card"
                        >
                          <Maximize2 size={14} />
                        </button>
                        {/* Share */}
                        <button
                          onClick={() => setShareGameId(shareGameId === game.id ? null : game.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: 'rgba(var(--embed-text-rgb, 30,41,59),0.4)', display: 'flex', alignItems: 'center' }}
                          title="Share"
                        >
                          <Share2 size={14} />
                        </button>

                        {/* Share popover */}
                        {shareGameId === game.id && (
                          <div
                            ref={sharePopoverRef}
                            onClick={e => e.stopPropagation()}
                            style={{ position: 'absolute', top: '28px', right: 0, zIndex: 20, padding: '6px', width: '150px', backgroundColor: 'var(--embed-card-bg, #ffffff)', border: '1px solid var(--embed-border, #e2e8f0)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                          >
                            <button
                              onClick={async () => {
                                const text = buildGameShareText(game, home, away, gameLeagues.map(l => l.shortName || l.name));
                                await copyToClipboard(text);
                                setCopiedGameId(game.id);
                                setTimeout(() => setCopiedGameId(null), 2000);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '6px 8px', fontSize: '0.8125rem', color: copiedGameId === game.id ? '#16a34a' : 'var(--embed-text, #334155)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--embed-bg, #f8fafc)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                            >
                              {copiedGameId === game.id
                                ? <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                                : <Copy size={14} style={{ flexShrink: 0 }} />
                              }
                              {copiedGameId === game.id ? t('common.copied') : t('gameBar.copyText')}
                            </button>
                            {game.streamUrl && (
                              <button
                                onClick={async () => { await copyToClipboard(game.streamUrl!); setCopiedGameId(game.id + '_link'); setTimeout(() => setCopiedGameId(null), 2000); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '6px 8px', fontSize: '0.8125rem', color: copiedGameId === game.id + '_link' ? '#16a34a' : 'var(--embed-text, #334155)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--embed-bg, #f8fafc)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                              >
                                {copiedGameId === game.id + '_link'
                                  ? <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                                  : <Radio size={14} style={{ flexShrink: 0 }} />
                                }
                                {copiedGameId === game.id + '_link' ? 'Copied!' : 'Copy stream link'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Branding footer */}
      <div style={{ textAlign: 'center', padding: '5px 12px', color: 'rgba(var(--embed-text-rgb,30,41,59),0.3)', fontSize: '0.58rem', letterSpacing: '0.08em', borderTop: '1px solid var(--embed-border, #e2e8f0)', flexShrink: 0 }}>
        {orgName || (import.meta.env.VITE_ORG_NAME as string | undefined) || 'DIAMOND SCHEDULER'}
      </div>

      </div>{/* end tableRef capture wrapper */}

      {renderStoryOverlay()}
    </div>
  );
};

export default EmbeddableTeamGames;
