import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CheckCircle, AlertCircle, Loader2, Plus, Minus } from 'lucide-react';
import './index.css';
import './i18n';
import {
  validateScoreLink,
  loadPublishedScheduleByKey,
  saveScoreEdit,
} from './services/storage';
import { ScoreLink, Game, Team } from './types';

// ── helpers ──────────────────────────────────────────────────────────────────

const token = new URLSearchParams(window.location.search).get('token') || '';

function hoursLeft(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
}

// ── Interactive base diamond ──────────────────────────────────────────────────

const BaseDiamondInput: React.FC<{
  value: { first: boolean; second: boolean; third: boolean };
  onChange: (v: { first: boolean; second: boolean; third: boolean }) => void;
}> = ({ value, onChange }) => {
  const toggle = (base: 'first' | 'second' | 'third') =>
    onChange({ ...value, [base]: !value[base] });

  const W = 110, H = 90;
  const BS = 26; // rotated square half-diagonal → visual size
  const bases: { key: 'first' | 'second' | 'third'; cx: number; cy: number; label: string }[] = [
    { key: 'second', cx: W / 2,     cy: BS,        label: '2B' },
    { key: 'third',  cx: BS,        cy: H / 2 + 4, label: '3B' },
    { key: 'first',  cx: W - BS,    cy: H / 2 + 4, label: '1B' },
  ];

  return (
    <svg
      width={W} height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ touchAction: 'manipulation', userSelect: 'none' }}
      aria-label="Runners on base"
    >
      {bases.map(({ key, cx, cy, label }) => (
        <g key={key} onClick={() => toggle(key)} style={{ cursor: 'pointer' }}>
          <rect
            x={cx - BS / 2} y={cy - BS / 2}
            width={BS} height={BS}
            transform={`rotate(45 ${cx} ${cy})`}
            fill={value[key] ? '#f59e0b' : '#e2e8f0'}
            stroke={value[key] ? '#d97706' : '#94a3b8'}
            strokeWidth={1.5}
            rx={2}
          />
          <text
            x={cx} y={cy}
            textAnchor="middle" dominantBaseline="central"
            fontSize={9} fontWeight="700"
            fill={value[key] ? '#ffffff' : '#64748b'}
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ── Score-entry form ──────────────────────────────────────────────────────────

const ScoreEditApp: React.FC = () => {
  const [phase, setPhase] = useState<'loading' | 'invalid' | 'form'>('loading');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt]   = useState<Date | null>(null);
  const [saveError, setSaveError] = useState(false);
  const formReadyRef = useRef(false);   // true after initial prefill — skip first effect run
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [link, setLink]   = useState<ScoreLink | null>(null);
  const [game, setGame]   = useState<Game | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);

  // form state
  const [status, setStatus] = useState<Game['status']>('final');
  const [innings, setInnings] = useState<Array<{ home: number | null; away: number | null }>>([
    { home: null, away: null },
  ]);
  const [outs, setOuts] = useState<number>(0);
  const [balls, setBalls] = useState<number>(0);
  const [strikes, setStrikes] = useState<number>(0);
  const [baseRunners, setBaseRunners] = useState<{ first: boolean; second: boolean; third: boolean }>({ first: false, second: false, third: false });
  const [recap, setRecap] = useState<string>('');

  const homeTotal = innings.reduce((s, i) => s + (i.home ?? 0), 0);
  const awayTotal = innings.reduce((s, i) => s + (i.away ?? 0), 0);

  // ── on mount: validate token ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (!token) { setPhase('invalid'); return; }

      const validated = await validateScoreLink(token);
      if (!validated) { setPhase('invalid'); return; }
      setLink(validated);

      const schedule = await loadPublishedScheduleByKey(validated.scheduleKey);
      if (!schedule) { setPhase('invalid'); return; }

      const g = schedule.games.find(x => x.id === validated.gameId);
      if (!g) { setPhase('invalid'); return; }
      setGame(g);

      // pre-fill current values if already scored
      if (g.status !== 'scheduled') setStatus(g.status);
      if (g.recap) setRecap(g.recap);
      if (g.scores?.innings?.length) {
        setInnings(g.scores.innings.map(i => ({ home: i.home, away: i.away })));
      }
      if (g.scores?.outs     != null) setOuts(g.scores.outs);
      if (g.scores?.balls    != null) setBalls(g.scores.balls);
      if (g.scores?.strikes  != null) setStrikes(g.scores.strikes);
      if (g.scores?.baseRunners) setBaseRunners({
        first:  !!g.scores.baseRunners.first,
        second: !!g.scores.baseRunners.second,
        third:  !!g.scores.baseRunners.third,
      });

      // look up team names from all teams across leagues
      const allTeams: Team[] = [];
      schedule.leagues.forEach(l => l.teams.forEach(t => { if (!allTeams.find(x => x.id === t.id)) allTeams.push(t); }));
      setHomeTeam(allTeams.find(t => t.id === g.homeTeamId) ?? null);
      setAwayTeam(allTeams.find(t => t.id === g.awayTeamId) ?? null);

      formReadyRef.current = true;
      setPhase('form');
    })();
  }, []);

  // ── auto-save on any form state change (debounced 900 ms) ────────────────────
  useEffect(() => {
    if (!formReadyRef.current || !link || !game) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(false);
      const ok = await saveScoreEdit({
        gameId:      game.id,
        scheduleKey: link.scheduleKey,
        token:       link.token,
        status,
        scores: {
          home:    homeTotal,
          away:    awayTotal,
          innings: innings.map(i => ({ home: i.home ?? 0, away: i.away ?? 0 })),
          ...(status === 'live' && { outs, balls, strikes, baseRunners }),
        },
        recap: recap || undefined,
      });
      setIsSaving(false);
      if (ok) {
        setSavedAt(new Date());
        setTimeout(() => setSavedAt(null), 4000);
      } else {
        setSaveError(true);
      }
    }, 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // homeTotal and awayTotal are derived from innings — no need to list them separately
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, innings, outs, balls, strikes, baseRunners, recap]);

  const addInning = () => setInnings(prev => [...prev, { home: null, away: null }]);
  const removeInning = () => setInnings(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  const setInningVal = (idx: number, team: 'home' | 'away', val: string) => {
    const n = val === '' ? null : Math.max(0, parseInt(val, 10) || 0);
    setInnings(prev => prev.map((inn, i) => i === idx ? { ...inn, [team]: n } : inn));
  };

  // ── render states ────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Validating link…</div>
      </div>
    );
  }

  if (phase === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center space-y-3">
          <AlertCircle size={40} className="mx-auto text-red-400" />
          <h1 className="text-lg font-semibold text-slate-800">Link unavailable</h1>
          <p className="text-sm text-slate-500">This score-entry link is invalid, expired, or has been disabled by the schedule owner.</p>
        </div>
      </div>
    );
  }

  // ── main form ────────────────────────────────────────────────────────────────
  const homeName = homeTeam ? `${homeTeam.city} ${homeTeam.name}` : 'Home';
  const awayName = awayTeam ? `${awayTeam.city} ${awayTeam.name}` : 'Away';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-8 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Score Entry</div>
          <div className="text-xl font-bold">{awayName} @ {homeName}</div>
          {game && (
            <div className="text-sm opacity-80 mt-1">
              {game.date} · {game.time}{game.location ? ` · ${game.location}` : ''}
              {game.gameNumber ? ` · Game #${game.gameNumber}` : ''}
            </div>
          )}
          {link && (
            <div className="text-xs opacity-60 mt-2">Link expires in {hoursLeft(link.expiresAt)}h</div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Game Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as Game['status'])}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="scheduled">Scheduled</option>
              <option value="live">● Live</option>
              <option value="final">Final</option>
              <option value="postponed">Postponed (PPD)</option>
            </select>
          </div>

          {/* Score by inning */}
          {(status === 'live' || status === 'final') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Score by Inning</label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={removeInning} disabled={innings.length <= 1}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30">
                    <Minus size={14} />
                  </button>
                  <span className="text-xs text-slate-500 px-1">{innings.length}</span>
                  <button type="button" onClick={addInning}
                    className="p-1 rounded text-slate-400 hover:text-slate-600">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* inning grid */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-xs text-slate-500 font-medium pb-1 pr-2 w-24">Team</th>
                      {innings.map((_, i) => (
                        <th key={i} className="text-center text-xs text-slate-500 font-medium pb-1 px-1 min-w-[2.5rem]">{i + 1}</th>
                      ))}
                      <th className="text-center text-xs text-slate-700 font-bold pb-1 pl-2 min-w-[2.5rem]">R</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(['away', 'home'] as const).map(side => (
                      <tr key={side}>
                        <td className="py-1 pr-2 text-xs font-medium text-slate-600 truncate max-w-[6rem]">
                          {side === 'away' ? awayName : homeName}
                        </td>
                        {innings.map((inn, i) => (
                          <td key={i} className="py-1 px-1">
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={inn[side] ?? ''}
                              onChange={e => setInningVal(i, side, e.target.value)}
                              className="w-10 text-center border border-slate-200 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                          </td>
                        ))}
                        <td className="py-1 pl-2 text-center font-bold text-slate-800 text-sm">
                          {side === 'away' ? awayTotal : homeTotal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Outs + runners — live only */}
          {status === 'live' && (
            <div className="space-y-4">
              {/* Outs */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Outs</label>
                <div className="flex gap-2">
                  {[0, 1, 2].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setOuts(n)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                        outs === n
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                      }`}
                    >
                      {n} {n === 1 ? 'out' : 'outs'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Balls & Strikes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Balls</label>
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setBalls(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          balls === n
                            ? 'bg-green-500 text-white'
                            : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                        }`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Strikes</label>
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setStrikes(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          strikes === n
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                        }`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Runners on base */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Runners on Base <span className="text-xs font-normal text-slate-400">(tap to toggle)</span></label>
                <div className="flex justify-center py-1">
                  <BaseDiamondInput value={baseRunners} onChange={setBaseRunners} />
                </div>
              </div>
            </div>
          )}

          {/* Recap */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Game Recap <span className="text-xs font-normal text-slate-400">(shown scrolling in stream overlay)</span>
            </label>
            <textarea
              value={recap}
              onChange={e => setRecap(e.target.value)}
              rows={3}
              placeholder="e.g. Johnson threw 7 strong innings, striking out 9..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          {/* Auto-save indicator */}
          <div className="flex items-center gap-2 text-sm min-h-[2rem]">
            {isSaving && (
              <><Loader2 size={14} className="text-slate-400 animate-spin flex-shrink-0" /><span className="text-slate-400">Saving…</span></>
            )}
            {!isSaving && savedAt && (
              <><CheckCircle size={14} className="text-emerald-500 flex-shrink-0" /><span className="text-emerald-700">Saved {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></>
            )}
            {!isSaving && saveError && (
              <><AlertCircle size={14} className="text-red-500 flex-shrink-0" /><span className="text-red-700">Could not save — check your connection.</span></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('score-edit-root')!).render(
  <React.StrictMode><ScoreEditApp /></React.StrictMode>
);
