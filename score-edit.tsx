import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CheckCircle, AlertCircle, Loader2, Plus, Minus, RefreshCw } from 'lucide-react';
import './index.css';
import './i18n';
import {
  validateScoreLink,
  loadPublishedScheduleByKey,
  listScoreEditsByScheduleKey,
  saveScoreEdit,
} from './services/storage';
import { fetchWbscGameState } from './services/wbsc';
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
  const BS = 26; // rect size (rotated 45°); half-diagonal ≈ 18.4 → need >36.8 between centers
  const bases: { key: 'first' | 'second' | 'third'; cx: number; cy: number; label: string }[] = [
    { key: 'second', cx: 55, cy: 20, label: '2B' },
    { key: 'third',  cx: 33, cy: 58, label: '3B' },
    { key: 'first',  cx: 77, cy: 58, label: '1B' },
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
  const [scrolled, setScrolled] = useState(false);
  const formReadyRef   = useRef(false);  // true after initial prefill
  const skipInitSaveRef = useRef(false); // true for exactly one auto-save cycle after init — prevents saving the initial prefill back as if it were a user change
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [link, setLink]   = useState<ScoreLink | null>(null);
  const [game, setGame]   = useState<Game | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);

  // form state
  const [status, setStatus] = useState<Game['status']>('scheduled');
  const [confirmingFinal, setConfirmingFinal] = useState(false);
  const [innings, setInnings] = useState<Array<{ home: number | null; away: number | null }>>([
    { home: null, away: null },
  ]);
  const [outs, setOuts] = useState<number>(0);
  const [balls, setBalls] = useState<number>(0);
  const [strikes, setStrikes] = useState<number>(0);
  const [baseRunners, setBaseRunners] = useState<{ first: boolean; second: boolean; third: boolean }>({ first: false, second: false, third: false });
  const [recap, setRecap] = useState<string>('');
  const [pitcher, setPitcher] = useState<string>('');
  const [linescore, setLinescore] = useState<boolean>(false);
  const [hits,   setHits]   = useState<{ away: number | null; home: number | null }>({ away: null, home: null });
  const [errors, setErrors] = useState<{ away: number | null; home: number | null }>({ away: null, home: null });

  // WBSC live sync state
  const [wbscEnabled, setWbscEnabled] = useState(true);
  const [wbscSyncing, setWbscSyncing] = useState(false);
  const [wbscError, setWbscError]     = useState<string | null>(null);
  const [wbscPlayNumber, setWbscPlayNumber] = useState(-1);
  const [wbscLastDesc, setWbscLastDesc]     = useState<string | null>(null);
  const wbscLastPlayRef = useRef(-1); // ref copy so the interval closure is stable

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

      // fetch score edit first so we can prefer its values over the base game
      const existingEdits = await listScoreEditsByScheduleKey(validated.scheduleKey);
      const existingEdit = existingEdits.find(e => e.gameId === g.id);

      // status: prefer score edit (keeps final/live set by the scorer), fall back to base game
      setStatus(existingEdit ? existingEdit.status : g.status);

      // scores: prefer score edit innings over base game
      const sourceScores = existingEdit?.scores ?? g.scores;
      if (sourceScores?.innings?.length) {
        setInnings(sourceScores.innings.map(i => ({ home: i.home, away: i.away })));
      }
      if (sourceScores?.outs     != null) setOuts(sourceScores.outs);
      if (sourceScores?.balls    != null) setBalls(sourceScores.balls);
      if (sourceScores?.strikes  != null) setStrikes(sourceScores.strikes);
      if (sourceScores?.baseRunners) setBaseRunners({
        first:  !!sourceScores.baseRunners.first,
        second: !!sourceScores.baseRunners.second,
        third:  !!sourceScores.baseRunners.third,
      });

      const sourceRecap = existingEdit?.recap ?? g.recap;
      if (sourceRecap) setRecap(sourceRecap);
      if (existingEdit?.pitcher) setPitcher(existingEdit.pitcher);
      if (existingEdit?.linescore) setLinescore(true);
      if (existingEdit?.hits)      setHits(existingEdit.hits);
      if (existingEdit?.errors)    setErrors(existingEdit.errors);

      // look up team names from all teams across leagues
      const allTeams: Team[] = [];
      schedule.leagues.forEach(l => l.teams.forEach(t => { if (!allTeams.find(x => x.id === t.id)) allTeams.push(t); }));
      setHomeTeam(allTeams.find(t => t.id === g.homeTeamId) ?? null);
      setAwayTeam(allTeams.find(t => t.id === g.awayTeamId) ?? null);

      formReadyRef.current  = true;
      skipInitSaveRef.current = true; // skip the auto-save that fires from the initial state population
      setPhase('form');
    })();
  }, []);

  // ── auto-save on any form state change (debounced 900 ms) ────────────────────
  useEffect(() => {
    if (!formReadyRef.current || !link || !game) return;
    // Skip the very first fire after initialization — that fire is caused by the initial
    // state population (setting status/innings/etc. from the existing score edit), not by
    // an actual user change. Saving it would overwrite the stored score with the loaded
    // values, which risks resetting them if anything loaded incorrectly.
    if (skipInitSaveRef.current) { skipInitSaveRef.current = false; return; }
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
          innings: innings.map(i => ({ home: i.home, away: i.away })),
          ...(status === 'live' && { outs, balls, strikes, baseRunners }),
        },
        recap: recap || undefined,
        pitcher: pitcher || undefined,
        linescore,
        hits,
        errors,
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
  }, [status, innings, outs, balls, strikes, baseRunners, recap, pitcher, linescore, hits, errors]);

  // ── WBSC live data polling ───────────────────────────────────────────────────
  // Runs every 5 seconds when: game has a wbscGameId, status is live, and
  // wbscEnabled is true.  On each tick:
  //   1. fetch latest play number  → if unchanged, skip
  //   2. fetch full play data      → map to form state fields
  //   3. state changes trigger the existing 900 ms auto-save debounce
  useEffect(() => {
    if (!game?.wbscGameId || !wbscEnabled || status !== 'live') return;

    const poll = async () => {
      setWbscSyncing(true);
      try {
        const state = await fetchWbscGameState(game.wbscGameId!, wbscLastPlayRef.current);
        if (!state) return; // no new play or network error

        setWbscError(null);
        wbscLastPlayRef.current = state.playNumber;
        setWbscPlayNumber(state.playNumber);
        setWbscLastDesc(state.description ?? null);

        // Apply game state — these changes will trigger the auto-save debounce
        // (900 ms), which writes the data to PocketBase and keeps the stream
        // overlay and published schedule up to date.
        setInnings(state.innings);
        setOuts(state.outs);
        setBalls(state.balls);
        setStrikes(state.strikes);
        setBaseRunners(state.baseRunners);
        if (state.pitcher) setPitcher(state.pitcher);
        if (state.hits)   setHits(state.hits);
        if (state.errors) setErrors(state.errors);
        if (state.status === 'final') setStatus('final');
      } catch {
        setWbscError('Fetch failed');
      } finally {
        setWbscSyncing(false);
      }
    };

    poll(); // immediate first tick
    const interval = setInterval(poll, 5_000);
    return () => clearInterval(interval);
  // wbscLastPlayRef is a ref so it is intentionally excluded from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.wbscGameId, wbscEnabled, status]);

  // ── collapse header on scroll ────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
  const homeAbbr = homeTeam?.abbreviation || (homeTeam ? homeTeam.name.slice(0, 3).toUpperCase() : 'HOM');
  const awayAbbr = awayTeam?.abbreviation || (awayTeam ? awayTeam.name.slice(0, 3).toUpperCase() : 'AWY');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start pt-8 px-4">
      {/* Sticky collapsible header */}
      <div className="sticky top-0 z-10 w-full max-w-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white transition-all duration-200"
        style={{ borderRadius: scrolled ? '0 0 12px 12px' : '12px 12px 0 0', padding: scrolled ? '8px 20px' : '20px 24px' }}>
        {scrolled ? (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Score Entry</span>
            <span className="text-sm font-bold">{awayAbbr} @ {homeAbbr}</span>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 border-t-0 w-full max-w-md mb-8">
        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Game Status</label>
            <select
              value={status}
              onChange={e => {
                const next = e.target.value as Game['status'];
                if (next === 'final') { setConfirmingFinal(true); }
                else { setConfirmingFinal(false); setStatus(next); }
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="scheduled">Scheduled</option>
              <option value="live">● Live</option>
              <option value="final">Final</option>
              <option value="postponed">Postponed (PPD)</option>
            </select>

            {confirmingFinal && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-800">Mark this game as Final?</p>
                <p className="text-xs text-amber-700">The final score will be published to the schedule. The score entry link will remain active until it expires.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setStatus('final'); setConfirmingFinal(false); }}
                    className="flex-1 py-1.5 rounded-md bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 active:bg-amber-800"
                  >
                    Confirm Final
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingFinal(false)}
                    className="flex-1 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* WBSC live sync status bar — visible when game has a WBSC ID */}
          {game?.wbscGameId && (
            <div className={`rounded-lg border px-4 py-3 space-y-2 ${
              wbscError
                ? 'border-red-200 bg-red-50'
                : wbscEnabled
                  ? 'border-indigo-200 bg-indigo-50'
                  : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {wbscSyncing ? (
                    <RefreshCw size={13} className="text-indigo-500 animate-spin flex-shrink-0" />
                  ) : wbscError ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  ) : wbscEnabled ? (
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                  ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                  )}
                  <span className={`text-xs font-semibold uppercase tracking-wide ${
                    wbscError ? 'text-red-700' : wbscEnabled ? 'text-indigo-700' : 'text-slate-500'
                  }`}>
                    WBSC Live{wbscPlayNumber >= 0 ? ` · Play ${wbscPlayNumber}` : ''}
                  </span>
                  {wbscError && (
                    <span className="text-xs text-red-600">{wbscError}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setWbscEnabled(v => !v)}
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${
                    wbscEnabled
                      ? 'border-indigo-300 text-indigo-600 hover:bg-indigo-100'
                      : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {wbscEnabled ? 'Pause' : 'Resume'}
                </button>
              </div>
              {wbscLastDesc && wbscEnabled && (
                <p className="text-xs text-indigo-700 leading-relaxed truncate" title={wbscLastDesc}>
                  {wbscLastDesc}
                </p>
              )}
            </div>
          )}

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
                      <th className="text-center text-xs text-slate-700 font-bold pb-1 pl-1 min-w-[2.5rem]">H</th>
                      <th className="text-center text-xs text-slate-700 font-bold pb-1 pl-1 min-w-[2.5rem]">E</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(['away', 'home'] as const).map(side => (
                      <tr key={side}>
                        <td className="py-1 pr-2 text-xs font-medium text-slate-600 truncate max-w-[6rem]">
                          {side === 'away' ? awayAbbr : homeAbbr}
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
                        <td className="py-1 pl-1">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={hits[side] ?? ''}
                            onChange={e => setHits(prev => ({ ...prev, [side]: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                            className="w-10 text-center border border-slate-200 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                        </td>
                        <td className="py-1 pl-1">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={errors[side] ?? ''}
                            onChange={e => setErrors(prev => ({ ...prev, [side]: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                            className="w-10 text-center border border-slate-200 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
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

              {/* Current pitcher */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Current Pitcher <span className="text-xs font-normal text-slate-400">(shown in stream overlay)</span>
                </label>
                <input
                  type="text"
                  value={pitcher}
                  onChange={e => setPitcher(e.target.value)}
                  placeholder="e.g. Johnson"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
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

          {/* Linescore toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Overlay Settings</label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative flex-shrink-0" onClick={() => setLinescore(v => !v)}>
                <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${linescore ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${linescore ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-sm text-slate-700">Show line score by inning in overlay</span>
            </label>
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
