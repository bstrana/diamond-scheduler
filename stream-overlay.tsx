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
  // Prefer WBSC-sourced inning data stored in scores (most accurate)
  if (game.scores?.currentInning != null) {
    return {
      inning: String(game.scores.currentInning),
      half: game.scores.inningHalf ?? null,
    };
  }
  // Fallback: use top-level game fields (manually set)
  if (game.currentInning != null) {
    return {
      inning: String(game.currentInning),
      half: game.inningHalf ?? null,
    };
  }
  // Last resort: infer from the linescore shape
  const innings = game.scores?.innings;
  if (!innings || innings.length === 0) return { inning: '—', half: null };
  const last = innings[innings.length - 1];
  // If away scored but home hasn't batted yet → bottom half in progress
  if (last?.away != null && last?.home == null) {
    return { inning: String(innings.length), half: 'bottom' };
  }
  // Both sides complete → top of the next inning
  if (last?.away != null && last?.home != null) {
    return { inning: String(innings.length + 1), half: 'top' };
  }
  return { inning: String(innings.length), half: 'top' };
};

// ── Sub-components ────────────────────────────────────────────────────────────

// Two dots only — 3rd out resets the count so it never needs to display
const OutsDots: React.FC<{ outs: number }> = ({ outs }) => (
  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
    {[0, 1].map(i => (
      <div key={i} style={{
        width: 13, height: 13, borderRadius: '50%',
        backgroundColor: i < outs ? '#fbbf24' : 'rgba(255,255,255,0.2)',
        border: '1.5px solid rgba(255,255,255,0.35)',
      }} />
    ))}
  </div>
);

const BaseDiamond: React.FC<{ runners?: { first?: boolean; second?: boolean; third?: boolean } }> = ({ runners }) => {
  const bases = [
    { key: 'second' as const, cx: 30, cy: 12 },
    { key: 'third'  as const, cx: 12, cy: 44 },
    { key: 'first'  as const, cx: 48, cy: 44 },
  ];
  return (
    <svg width={96} height={88} viewBox="-15 -15 90 90" style={{ display: 'block' }}>
      {bases.map(({ key, cx, cy }) => (
        <rect key={key}
          x={cx - 11} y={cy - 11} width={22} height={22}
          transform={`rotate(45 ${cx} ${cy})`}
          fill={runners?.[key] ? '#fbbf24' : 'rgba(255,255,255,0.18)'}
          stroke="rgba(255,255,255,0.4)" strokeWidth={0.9}
        />
      ))}
    </svg>
  );
};

// Team row: gradient background, logo, abbreviation + city, score
const TeamRow: React.FC<{
  team: Team | null;
  score: number | null;
  showScore: boolean;
  isLight: boolean;
}> = ({ team, score, showScore, isLight }) => {
  const primaryColor = team?.primaryColor || '#334155';
  const secondaryColor = team?.secondaryColor || primaryColor;
  const abbr = team ? (team.abbreviation || team.name.slice(0, 3).toUpperCase()) : '???';
  const city = team?.city || '';

  const rowBg = isLight
    ? `linear-gradient(to right, ${primaryColor}dd 0%, ${primaryColor}55 50%, rgba(240,244,248,0.0) 100%)`
    : `linear-gradient(to right, ${primaryColor}ee 0%, ${primaryColor}77 50%, rgba(10,17,30,0.0) 100%)`;

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      alignItems: 'center',
      gap: 9,
      padding: '9px 14px',
      background: rowBg,
    }}>
      {team?.logoUrl ? (
        <img
          src={team.logoUrl}
          alt={abbr}
          style={{ width: 42, height: 42, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.55))' }}
        />
      ) : (
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, border: '2px solid rgba(255,255,255,0.25)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>⚾</div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{
          fontSize: 17, fontWeight: 800, color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1,
          textShadow: '0 1px 4px rgba(0,0,0,0.7)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{abbr}</span>
        {city && (
          <span style={{
            fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{city}</span>
        )}
      </div>
      {showScore && score !== null && (
        <span style={{
          fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1,
          textShadow: '0 2px 8px rgba(0,0,0,0.65)',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0, minWidth: 30, textAlign: 'right',
        }}>{score}</span>
      )}
    </div>
  );
};

// ── Main overlay ──────────────────────────────────────────────────────────────

const StreamOverlayApp: React.FC = () => {
  const [phase, setPhase] = useState<'loading' | 'invalid' | 'live'>('loading');
  const [link, setLink] = useState<ScoreLink | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [showLinescore, setShowLinescore] = useState(false);
  const [showRecap,     setShowRecap]     = useState(true);
  const [pitcher,    setPitcher]    = useState('');
  const [pitchCount, setPitchCount] = useState<number | null>(null);
  const [batter,     setBatter]     = useState('');
  const [batting,    setBatting]    = useState('');
  const [gameHits,   setGameHits]   = useState<{ away: number | null; home: number | null } | null>(null);
  const [gameErrors, setGameErrors] = useState<{ away: number | null; home: number | null } | null>(null);
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

      const editMap = new Map(edits.map(e => [e.gameId, e]));
      const g = schedule.games.find(x => x.id === gameId);
      if (!g) { setPhase('invalid'); return; }

      const edit = editMap.get(g.id);
      const finalGame = edit
        ? { ...g, status: edit.status, scores: edit.scores ?? g.scores, recap: edit.recap?.trim() || undefined }
        : g;

      const allTeams: Team[] = [];
      schedule.leagues.forEach(l => l.teams.forEach(t => {
        if (!allTeams.find(x => x.id === t.id)) allTeams.push(t);
      }));

      if (edit) {
        setShowLinescore(!!edit.linescore);
        setShowRecap(edit.showRecap !== false);
        setPitcher(edit.pitcher ?? '');
        setPitchCount(edit.pitchCount ?? null);
        setBatter(edit.batter   ?? '');
        setBatting(edit.batting ?? '');
        setGameHits(edit.hits ?? null);
        setGameErrors(edit.errors ?? null);
      }
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
      setGame(prev => prev ? { ...prev, status: edit.status, scores: edit.scores ?? prev.scores, recap: edit.recap?.trim() || undefined } : prev);
      setShowLinescore(!!edit.linescore);
      setShowRecap(edit.showRecap !== false);
      setPitcher(edit.pitcher ?? '');
      setPitchCount(edit.pitchCount ?? null);
      setBatter(edit.batter   ?? '');
      setBatting(edit.batting ?? '');
      setGameHits(edit.hits ?? null);
      setGameErrors(edit.errors ?? null);
    });

    // 15 s fallback poll
    const interval = setInterval(async () => {
      const edits = await listScoreEditsByScheduleKey(link.scheduleKey);
      const edit = edits.find(e => e.gameId === link.gameId);
      if (edit) {
        setGame(prev => prev ? { ...prev, status: edit.status, scores: edit.scores ?? prev.scores, recap: edit.recap?.trim() || undefined } : prev);
        setShowLinescore(!!edit.linescore);
        setShowRecap(edit.showRecap !== false);
        setPitcher(edit.pitcher ?? '');
        setPitchCount(edit.pitchCount ?? null);
        setBatter(edit.batter   ?? '');
        setBatting(edit.batting ?? '');
        setGameHits(edit.hits ?? null);
        setGameErrors(edit.errors ?? null);
      }
    }, 15_000);

    return () => { unsub(); clearInterval(interval); };
  }, [link]);

  const isLight = bg === 'light';

  // ── Loading / invalid states ────────────────────────────────────────────────
  const shellStyle: React.CSSProperties = isLight
    ? { background: 'rgba(240,244,248,0.96)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden' }
    : { background: 'rgba(10,17,30,0.86)', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', overflow: 'hidden' };

  const mutedColor = isLight ? '#64748b' : 'rgba(241,245,249,0.55)';

  if (phase === 'loading') {
    return (
      <div style={{ padding: 12, fontFamily: 'Inter, sans-serif', display: 'inline-block' }}>
        <div style={{ ...shellStyle, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 13, color: mutedColor }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (phase === 'invalid') {
    return (
      <div style={{ padding: 12, fontFamily: 'Inter, sans-serif', display: 'inline-block' }}>
        <div style={{ ...shellStyle, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#f87171' }}>Invalid or expired link</span>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const isLive      = game.status === 'live';
  const isFinal     = game.status === 'final';
  const isPostponed = game.status === 'postponed';
  const hasScore    = isLive || isFinal || (game.scores != null && (game.scores.home !== 0 || game.scores.away !== 0));

  const innInfo = isLive ? deriveInning(game) : null;

  // Status badge — not shown when live (the in-game elements make it obvious)
  const statusBadge = isLive
    ? null
    : isFinal
    ? <span style={{ fontSize: 11, fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>FINAL</span>
    : isPostponed
    ? <span style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PPD</span>
    : <span style={{ fontSize: 11, fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{game.time || '—'}</span>;

  const dividerColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

  return (
    <div style={{ padding: 12, fontFamily: 'Inter, sans-serif', display: 'inline-block' }}>
      <div style={{ ...shellStyle, display: 'flex', flexDirection: 'column', userSelect: 'none', minWidth: 220 }}>

      {/* Pitcher bar — static text at top, live only */}
      {isLive && pitcher.trim() && (
        <div style={{
          borderBottom: `1px solid ${dividerColor}`,
          background: isLight ? 'rgba(241,245,249,0.9)' : 'rgba(8,14,26,0.7)',
          padding: '5px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: isLight ? '#64748b' : 'rgba(226,232,240,0.5)',
            flexShrink: 0,
          }}>NOW PITCHING</span>
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isLight ? '#1e293b' : 'rgba(226,232,240,0.9)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{pitcher.trim()}</span>
          {pitchCount != null && (
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: isLight ? '#4f46e5' : '#a5b4fc',
              flexShrink: 0,
              letterSpacing: '0.04em',
            }}>{pitchCount}P</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex' }}>

        {/* Col 1: away (top) + home (bottom) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TeamRow
            team={awayTeam}
            score={hasScore ? (game.scores?.away ?? 0) : null}
            showScore={hasScore}
            isLight={isLight}
          />
          <div style={{ height: 1, background: dividerColor }} />
          <TeamRow
            team={homeTeam}
            score={hasScore ? (game.scores?.home ?? 0) : null}
            showScore={hasScore}
            isLight={isLight}
          />
        </div>

        {/* Col 2: status, inning, outs + count */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'space-evenly',
          padding: '8px 12px',
          borderLeft: `1px solid ${dividerColor}`,
          flexShrink: 0, minWidth: 60,
          background: isLight ? 'rgba(248,250,252,0.8)' : 'rgba(15,23,42,0.5)',
        }}>
          {statusBadge}

          {isLive && innInfo && (
            <span style={{ fontSize: 14, fontWeight: 800, color: '#4ade80', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {innInfo.inning !== '—'
                ? `${innInfo.inning}${innInfo.half === 'top' ? ' ▲' : innInfo.half === 'bottom' ? ' ▼' : ''}`
                : '—'}
            </span>
          )}

          {isLive && game.scores?.outs != null && (
            <OutsDots outs={game.scores.outs} />
          )}

          {isLive && (game.scores?.balls != null || game.scores?.strikes != null) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{game.scores?.balls ?? 0}</span>
              <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}>·</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#f87171', lineHeight: 1 }}>{game.scores?.strikes ?? 0}</span>
            </div>
          )}
        </div>

        {/* Col 3: base diamond */}
        {isLive && game.scores?.baseRunners && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '8px 10px',
            borderLeft: `1px solid ${dividerColor}`,
            flexShrink: 0,
            background: isLight ? 'rgba(248,250,252,0.8)' : 'rgba(15,23,42,0.5)',
          }}>
            <BaseDiamond runners={game.scores.baseRunners} />
          </div>
        )}

        {/* Col 4: linescore — slides in from right */}
        <div style={{
          maxWidth: showLinescore ? `${28 + ((game.scores?.innings?.length ?? 0) * 24) + 26 + 22 + 22 + 20}px` : 0,
          overflow: 'hidden',
          transition: 'max-width 0.35s ease',
          borderLeft: showLinescore ? `1px solid ${dividerColor}` : 'none',
          background: isLight ? 'rgba(248,250,252,0.8)' : 'rgba(15,23,42,0.5)',
          display: 'flex',
          alignItems: 'center',
        }}>
          {(() => {
            const inn = game.scores?.innings ?? [];
            const awayAbbr = awayTeam ? (awayTeam.abbreviation || awayTeam.name.slice(0, 3).toUpperCase()) : 'AWY';
            const homeAbbr = homeTeam ? (homeTeam.abbreviation || homeTeam.name.slice(0, 3).toUpperCase()) : 'HOM';
            const cellStyle = (bold?: boolean): React.CSSProperties => ({
              minWidth: 22, textAlign: 'center', fontSize: 11,
              fontWeight: bold ? 800 : 500, lineHeight: 1.4,
              color: bold ? (isLight ? '#1e293b' : '#f8fafc') : (isLight ? '#475569' : 'rgba(226,232,240,0.7)'),
              fontVariantNumeric: 'tabular-nums',
            });
            return (
              <div style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                {/* Header row */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
                  <div style={{ ...cellStyle(), minWidth: 28, textAlign: 'left' }} />
                  {inn.map((_, i) => (
                    <div key={i} style={cellStyle()}>{i + 1}</div>
                  ))}
                  <div style={{ ...cellStyle(true), minWidth: 26, borderLeft: `1px solid ${dividerColor}`, paddingLeft: 4 }}>R</div>
                  <div style={{ ...cellStyle(true), minWidth: 22, borderLeft: `1px solid ${dividerColor}`, paddingLeft: 4 }}>H</div>
                  <div style={{ ...cellStyle(true), minWidth: 22, paddingLeft: 4 }}>E</div>
                </div>
                {/* Away row */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 1 }}>
                  <div style={{ ...cellStyle(true), minWidth: 28, textAlign: 'left' }}>{awayAbbr}</div>
                  {inn.map((entry, i) => (
                    <div key={i} style={cellStyle()}>{entry.away != null ? entry.away : <span style={{ opacity: 0.35 }}>—</span>}</div>
                  ))}
                  <div style={{ ...cellStyle(true), minWidth: 26, borderLeft: `1px solid ${dividerColor}`, paddingLeft: 4 }}>
                    {inn.reduce((s, e) => s + (e.away ?? 0), 0)}
                  </div>
                  <div style={{ ...cellStyle(true), minWidth: 22, borderLeft: `1px solid ${dividerColor}`, paddingLeft: 4 }}>
                    {gameHits?.away != null ? gameHits.away : <span style={{ opacity: 0.35 }}>—</span>}
                  </div>
                  <div style={{ ...cellStyle(true), minWidth: 22, paddingLeft: 4 }}>
                    {gameErrors?.away != null ? gameErrors.away : <span style={{ opacity: 0.35 }}>—</span>}
                  </div>
                </div>
                {/* Home row */}
                <div style={{ display: 'flex', gap: 2 }}>
                  <div style={{ ...cellStyle(true), minWidth: 28, textAlign: 'left' }}>{homeAbbr}</div>
                  {inn.map((entry, i) => (
                    <div key={i} style={cellStyle()}>{entry.home != null ? entry.home : <span style={{ opacity: 0.35 }}>—</span>}</div>
                  ))}
                  <div style={{ ...cellStyle(true), minWidth: 26, borderLeft: `1px solid ${dividerColor}`, paddingLeft: 4 }}>
                    {inn.reduce((s, e) => s + (e.home ?? 0), 0)}
                  </div>
                  <div style={{ ...cellStyle(true), minWidth: 22, borderLeft: `1px solid ${dividerColor}`, paddingLeft: 4 }}>
                    {gameHits?.home != null ? gameHits.home : <span style={{ opacity: 0.35 }}>—</span>}
                  </div>
                  <div style={{ ...cellStyle(true), minWidth: 22, paddingLeft: 4 }}>
                    {gameErrors?.home != null ? gameErrors.home : <span style={{ opacity: 0.35 }}>—</span>}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

      </div>

      {/* Batter bar — static text at bottom, live only */}
      {isLive && batter.trim() && (
        <div style={{
          borderTop: `1px solid ${dividerColor}`,
          background: isLight ? 'rgba(241,245,249,0.9)' : 'rgba(8,14,26,0.7)',
          padding: '5px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          {batting.trim() && (
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: isLight ? '#64748b' : 'rgba(226,232,240,0.45)',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}>{batting.trim()}</span>
          )}
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isLight ? '#1e293b' : 'rgba(226,232,240,0.9)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{batter.trim()}</span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: isLight ? '#64748b' : 'rgba(226,232,240,0.5)',
            flexShrink: 0,
          }}>AT BAT</span>
        </div>
      )}

      {/* Recap ticker — inside shell so border-radius clips it */}
      {showRecap && game.recap?.trim() && (
        <div style={{
          borderTop: `1px solid ${dividerColor}`,
          overflow: 'hidden',
          background: isLight ? 'rgba(241,245,249,0.9)' : 'rgba(8,14,26,0.7)',
          padding: '5px 0',
        }}>
          <style>{`
            @keyframes ticker {
              0%   { transform: translateX(100%); }
              100% { transform: translateX(-100%); }
            }
          `}</style>
          <div style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            animation: 'ticker 20s linear infinite',
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
            color: isLight ? '#475569' : 'rgba(226,232,240,0.85)',
            paddingLeft: '100%',
          }}>
            {game.recap}
          </div>
        </div>
      )}
      </div>
    </div>
  );

};

ReactDOM.createRoot(document.getElementById('stream-overlay-root')!).render(
  <React.StrictMode><StreamOverlayApp /></React.StrictMode>
);
