import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import {
  validateScoreLink,
  loadPublishedScheduleByKey,
  listScoreEditsByScheduleKey,
  subscribeScoreEdits,
} from './services/storage';
import { Game, Team, ScoreLink } from './types';

// ── URL params ────────────────────────────────────────────────────────────────

const params = new URLSearchParams(window.location.search);
const token = params.get('token') || '';
// bg: transparent (default — OBS browser source), dark, light
const bg = params.get('bg') || 'transparent';

// ── Helpers ───────────────────────────────────────────────────────────────────

const deriveInning = (game: Game): { inning: string; half: 'top' | 'bottom' | null } => {
  const innings = game.scores?.innings;
  if (!innings || innings.length === 0) {
    return {
      inning: game.currentInning != null ? String(game.currentInning) : '—',
      half: game.inningHalf ?? null,
    };
  }
  const filled = innings.reduce(
    (n, inn) => n + (inn.away != null ? 1 : 0) + (inn.home != null ? 1 : 0),
    0,
  );
  if (filled === 0) return { inning: '—', half: null };
  const isOdd = filled % 2 !== 0;
  return { inning: String(Math.ceil(filled / 2)), half: isOdd ? 'top' : 'bottom' };
};

// ── Sub-components ────────────────────────────────────────────────────────────

const OutsDots: React.FC<{ outs: number }> = ({ outs }) => (
  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 9, height: 9, borderRadius: '50%',
        backgroundColor: i < outs ? '#fbbf24' : 'rgba(255,255,255,0.25)',
        border: '1px solid rgba(255,255,255,0.3)',
      }} />
    ))}
  </div>
);

const BaseDiamond: React.FC<{ runners?: { first?: boolean; second?: boolean; third?: boolean } }> = ({ runners }) => {
  const VW = 32, VH = 26, bs = 7;
  const bases = [
    { key: 'second' as const, cx: VW / 2, cy: 4 },
    { key: 'third'  as const, cx: 4,       cy: VH - 3 },
    { key: 'first'  as const, cx: VW - 4,  cy: VH - 3 },
  ];
  return (
    <svg width={28} height={Math.round(28 * VH / VW)} viewBox={`0 0 ${VW} ${VH}`} style={{ display: 'block' }}>
      {bases.map(({ key, cx, cy }) => (
        <rect key={key}
          x={cx - bs / 2} y={cy - bs / 2} width={bs} height={bs}
          transform={`rotate(45 ${cx} ${cy})`}
          fill={runners?.[key] ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
          stroke="rgba(255,255,255,0.3)" strokeWidth={0.8}
        />
      ))}
    </svg>
  );
};

// ── Main overlay ──────────────────────────────────────────────────────────────

const StreamOverlayApp: React.FC = () => {
  const [phase, setPhase] = useState<'loading' | 'invalid' | 'live'>('loading');
  const [link, setLink] = useState<ScoreLink | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const gameRef = useRef<Game | null>(null);
  gameRef.current = game;

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setPhase('invalid'); return; }
    let isActive = true;

    const loadGame = async (scheduleKey: string, gameId: string) => {
      const [schedule, edits] = await Promise.all([
        loadPublishedScheduleByKey(scheduleKey),
        listScoreEditsByScheduleKey(scheduleKey),
      ]);
      if (!isActive || !schedule) return;

      // Apply any pending score edits
      const editMap = new Map(edits.map(e => [e.gameId, e]));
      const g = schedule.games.find(x => x.id === gameId);
      if (!g) { setPhase('invalid'); return; }

      const edit = editMap.get(g.id);
      const finalGame = edit
        ? { ...g, status: edit.status, scores: edit.scores ?? g.scores }
        : g;

      const allTeams: Team[] = [];
      schedule.leagues.forEach(l => l.teams.forEach(t => {
        if (!allTeams.find(x => x.id === t.id)) allTeams.push(t);
      }));

      setGame(finalGame);
      setHomeTeam(allTeams.find(t => t.id === g.homeTeamId) ?? null);
      setAwayTeam(allTeams.find(t => t.id === g.awayTeamId) ?? null);
      setPhase('live');
    };

    (async () => {
      const validated = await validateScoreLink(token);
      if (!isActive || !validated) { setPhase('invalid'); return; }
      setLink(validated);
      await loadGame(validated.scheduleKey, validated.gameId);
    })();

    return () => { isActive = false; };
  }, []);

  // ── Real-time subscription + fallback poll ──────────────────────────────────
  useEffect(() => {
    if (!link) return;

    const unsub = subscribeScoreEdits(link.scheduleKey, (edit) => {
      if (edit.gameId !== link.gameId) return;
      setGame(prev => prev ? { ...prev, status: edit.status, scores: edit.scores ?? prev.scores } : prev);
    });

    // 15 s fallback poll — covers SSE unavailability
    const interval = setInterval(async () => {
      const edits = await listScoreEditsByScheduleKey(link.scheduleKey);
      const edit = edits.find(e => e.gameId === link.gameId);
      if (edit) {
        setGame(prev => prev ? { ...prev, status: edit.status, scores: edit.scores ?? prev.scores } : prev);
      }
    }, 15_000);

    return () => { unsub(); clearInterval(interval); };
  }, [link]);

  // ── Styles based on bg param ────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = bg === 'light'
    ? { background: 'rgba(255,255,255,0.95)', color: '#0f172a', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }
    : { background: 'rgba(15,23,42,0.88)', color: '#f1f5f9', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' };

  const textMain = bg === 'light' ? '#0f172a' : '#f1f5f9';
  const textMuted = bg === 'light' ? '#475569' : 'rgba(241,245,249,0.6)';
  const divider = bg === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';

  if (phase === 'loading') {
    return (
      <div style={{ padding: 16, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ ...cardStyle, padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 13, color: textMuted }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (phase === 'invalid') {
    return (
      <div style={{ padding: 16, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ ...cardStyle, padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#f87171' }}>Invalid or expired link</span>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const isLive     = game.status === 'live';
  const isFinal    = game.status === 'final';
  const isPostponed = game.status === 'postponed';
  const hasScore   = game.scores != null && (game.scores.home !== 0 || game.scores.away !== 0 || isFinal);

  const innInfo = isLive ? deriveInning(game) : null;
  const awayName = awayTeam ? (awayTeam.abbreviation || awayTeam.name) : 'AWAY';
  const homeName = homeTeam ? (homeTeam.abbreviation || homeTeam.name) : 'HOME';
  const awayFull = awayTeam ? `${awayTeam.city} ${awayTeam.name}`.trim() : 'Away';
  const homeFull = homeTeam ? `${homeTeam.city} ${homeTeam.name}`.trim() : 'Home';

  // Status badge
  const statusBadge = isLive
    ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80' }} />
        LIVE
      </span>
    : isFinal
    ? <span style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>FINAL</span>
    : isPostponed
    ? <span style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PPD</span>
    : <span style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{game.time || '—'}</span>;

  return (
    <div style={{ padding: 12, fontFamily: 'Inter, sans-serif', display: 'inline-block' }}>
      <div style={{ ...cardStyle, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, userSelect: 'none' }}>

        {/* Status */}
        <div style={{ flexShrink: 0, minWidth: 42 }}>{statusBadge}</div>

        <div style={{ width: 1, height: 28, background: divider, flexShrink: 0 }} />

        {/* Away team */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{awayFull}</span>
          {(hasScore || isFinal) && (
            <span style={{ fontSize: 22, fontWeight: 800, color: textMain, lineHeight: 1 }}>{game.scores?.away ?? 0}</span>
          )}
        </div>

        {/* Centre separator */}
        <span style={{ fontSize: 18, fontWeight: 700, color: textMuted, flexShrink: 0 }}>
          {hasScore || isFinal ? '—' : '@'}
        </span>

        {/* Home team */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{homeFull}</span>
          {(hasScore || isFinal) && (
            <span style={{ fontSize: 22, fontWeight: 800, color: textMain, lineHeight: 1 }}>{game.scores?.home ?? 0}</span>
          )}
        </div>

        {/* Live situation — inning / outs / runners */}
        {isLive && innInfo && (
          <>
            <div style={{ width: 1, height: 28, background: divider, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#4ade80', lineHeight: 1, whiteSpace: 'nowrap' }}>
                {innInfo.inning !== '—' ? `${innInfo.inning}${innInfo.half === 'top' ? ' ▲' : innInfo.half === 'bottom' ? ' ▼' : ''}` : '—'}
              </span>
              {game.scores?.outs != null && <OutsDots outs={game.scores.outs} />}
            </div>
            {game.scores?.baseRunners && (
              <BaseDiamond runners={game.scores.baseRunners} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('stream-overlay-root')!).render(
  <React.StrictMode><StreamOverlayApp /></React.StrictMode>
);
