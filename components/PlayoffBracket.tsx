import React, { useMemo } from 'react';
import { Trophy, Clock, CheckCircle2, Zap, ChevronRight } from 'lucide-react';
import { Game, Team } from '../types';
import { useTranslation } from 'react-i18next';

interface PlayoffBracketProps {
  games: Game[];
  teams: Team[];
}

const TBD_TEAM: Team = {
  id: '__tbd__',
  name: 'TBD',
  city: '',
  abbreviation: 'TBD',
  primaryColor: '#94a3b8',
  secondaryColor: undefined,
};

function formatShortDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

const PlayoffBracket: React.FC<PlayoffBracketProps> = ({ games, teams }) => {
  const { t } = useTranslation();

  const getTeam = (id: string): Team => {
    if (!id || id.startsWith('__tbd_')) return TBD_TEAM;
    return teams.find(t => t.id === id) ?? TBD_TEAM;
  };

  const isWin = (g: Game, teamId: string): boolean => {
    const done = g.status === 'final' || g.status === 'forfeit';
    if (!done || !g.scores) return false;
    return (g.homeTeamId === teamId && g.scores.home > g.scores.away) ||
           (g.awayTeamId === teamId && g.scores.away > g.scores.home);
  };

  // Separate pool games (bracketRound === 0) from bracket games (bracketRound >= 1)
  // Games without bracketRound but with seriesName are treated as bracket games
  const poolGames    = useMemo(() => games.filter(g => g.bracketRound === 0 && g.seriesName), [games]);
  const bracketGames = useMemo(() => games.filter(g => g.seriesName && (g.bracketRound ?? 0) >= 1), [games]);

  // ── Helper: build ordered series list ──────────────────────────────────────
  const orderedSeries = (source: Game[]) => {
    const map = new Map<string, { date: string; round: number }>();
    source.forEach(g => {
      if (!g.seriesName) return;
      const cur = map.get(g.seriesName);
      if (!cur || g.date < cur.date) map.set(g.seriesName, { date: g.date, round: g.bracketRound ?? 0 });
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].round - b[1].round || a[1].date.localeCompare(b[1].date))
      .map(([name]) => name);
  };

  // ── Helper: group games in a series into matchups ──────────────────────────
  const buildMatchups = (source: Game[], sName: string) => {
    const sg = source.filter(g => g.seriesName === sName);
    const matchupMap = new Map<string, Game[]>();
    sg.forEach(g => {
      const key = [g.homeTeamId, g.awayTeamId].sort().join('|');
      const arr = matchupMap.get(key) ?? [];
      arr.push(g);
      matchupMap.set(key, arr);
    });
    return Array.from(matchupMap.entries()).map(([key, mGames]) => {
      const [a, b] = key.split('|');
      return { teamA: a, teamB: b, games: mGames.sort((x, y) => x.date.localeCompare(y.date)) };
    });
  };

  const poolSeriesOrder    = useMemo(() => orderedSeries(poolGames), [poolGames]);
  const bracketSeriesOrder = useMemo(() => orderedSeries(bracketGames), [bracketGames]);

  // Group bracket series by round name for layout
  const bracketRounds = useMemo(() => {
    const rounds = new Map<string, string[]>(); // seriesName[] per round label
    bracketSeriesOrder.forEach(sName => {
      const g = bracketGames.find(g => g.seriesName === sName);
      const key = sName; // pool names like "Semifinal", "Final"
      // Group by bracketRound number
      const roundKey = `round_${g?.bracketRound ?? 1}`;
      const arr = rounds.get(roundKey) ?? [];
      arr.push(sName);
      rounds.set(roundKey, arr);
    });
    return Array.from(rounds.entries())
      .sort((a, b) => {
        const ra = parseInt(a[0].split('_')[1]);
        const rb = parseInt(b[0].split('_')[1]);
        return ra - rb;
      })
      .map(([, series]) => series);
  }, [bracketSeriesOrder, bracketGames]);

  const isFinalRound = (sName: string) => {
    const maxRound = Math.max(...bracketGames.map(g => g.bracketRound ?? 1));
    const g = bracketGames.find(g => g.seriesName === sName);
    return (g?.bracketRound ?? 1) === maxRound;
  };

  const hasAny = poolGames.length > 0 || bracketGames.length > 0;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2 p-8 text-center">
        <Trophy size={40} className="text-slate-300 mb-2" />
        <p className="text-lg font-semibold text-slate-500">{t('playoff.noBracketYet')}</p>
        <p>{t('playoff.noBracketHint')}</p>
      </div>
    );
  }

  // ── Matchup card ────────────────────────────────────────────────────────────
  const MatchupCard = ({ teamA, teamB, games: mGames, final: isFinal }: {
    teamA: string; teamB: string; games: Game[]; final?: boolean;
  }) => {
    const tA = getTeam(teamA);
    const tB = getTeam(teamB);
    const isTbdA = teamA.startsWith('__tbd_');
    const isTbdB = teamB.startsWith('__tbd_');

    const winsA = mGames.filter(g => isWin(g, teamA)).length;
    const winsB = mGames.filter(g => isWin(g, teamB)).length;
    const played = mGames.filter(g => g.status === 'final' || g.status === 'forfeit').length;
    const hasLive = mGames.some(g => g.status === 'live');
    const allDone = played > 0 && played === mGames.length;
    const seriesInProgress = played > 0 && !allDone;

    const leaderA = played > 0 && winsA > winsB;
    const leaderB = played > 0 && winsB > winsA;
    const winnerA = allDone && winsA > winsB;
    const winnerB = allDone && winsB > winsA;

    const statusBadge = hasLive ? (
      <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold animate-pulse"><Zap size={11} />LIVE</span>
    ) : allDone ? (
      <span className="flex items-center gap-1 text-xs text-slate-400"><CheckCircle2 size={11} />Done</span>
    ) : seriesInProgress ? (
      <span className="text-xs text-amber-500 font-medium">{played}/{mGames.length} played</span>
    ) : (
      <span className="flex items-center gap-1 text-xs text-slate-400"><Clock size={11} />{formatShortDate(mGames[0]?.date ?? '')}</span>
    );

    const TeamRow = ({ team, teamId, wins, winner, leader, tbd }: {
      team: Team; teamId: string; wins: number; winner: boolean; leader: boolean; tbd: boolean;
    }) => (
      <div className={`flex items-center gap-2 px-3 py-2 transition-colors
        ${winner && isFinal ? 'bg-amber-50' : winner ? 'bg-emerald-50' : leader ? 'bg-emerald-50/60' : ''}
        ${allDone && !winner ? 'opacity-50' : ''}
      `}>
        {tbd ? (
          <span className="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 flex-shrink-0" />
        ) : team.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} className="w-5 h-5 object-contain flex-shrink-0" />
        ) : (
          <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: team.primaryColor ?? '#94a3b8' }} />
        )}
        <span className={`flex-1 text-sm truncate ${winner ? 'font-bold text-slate-800' : tbd ? 'text-slate-400 italic' : 'text-slate-700'}`}>
          {tbd ? 'TBD' : team.city ? `${team.city} ${team.name}` : team.name}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {winner && isFinal && <Trophy size={13} className="text-amber-500" />}
          {played > 0 && (
            <span className={`text-sm font-bold w-4 text-right ${winner ? (isFinal ? 'text-amber-600' : 'text-emerald-600') : leader ? 'text-emerald-500' : 'text-slate-300'}`}>
              {wins}
            </span>
          )}
        </div>
      </div>
    );

    return (
      <div className={`bg-white rounded-lg overflow-hidden shadow-sm border transition-all
        ${isFinal && allDone ? 'border-amber-300 shadow-amber-100' : allDone ? 'border-emerald-200' : 'border-slate-200'}
      `}>
        <div className="flex items-center justify-between px-3 pt-1.5 pb-0.5">
          {statusBadge}
          {played > 0 && <span className="text-xs text-slate-400">{winsA}–{winsB}</span>}
        </div>

        <TeamRow team={tA} teamId={teamA} wins={winsA} winner={winnerA} leader={leaderA} tbd={isTbdA} />
        <div className="border-t border-slate-100" />
        <TeamRow team={tB} teamId={teamB} wins={winsB} winner={winnerB} leader={leaderB} tbd={isTbdB} />

        {/* Individual game results */}
        {mGames.length > 0 && (
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 space-y-0.5">
            {mGames.map((g, gi) => {
              const home = getTeam(g.homeTeamId);
              const away = getTeam(g.awayTeamId);
              const done = g.status === 'final' || g.status === 'forfeit';
              return (
                <div key={g.id} className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-slate-400">Gm {gi + 1} · {formatShortDate(g.date)}</span>
                  {g.status === 'live' ? (
                    <span className="text-emerald-600 font-bold animate-pulse">LIVE</span>
                  ) : done && g.scores ? (
                    <span className="font-medium text-slate-700 tabular-nums">
                      {away.abbreviation} {g.scores.away}–{g.scores.home} {home.abbreviation}
                      {g.status === 'forfeit' && <span className="ml-1 text-orange-400 text-xs">FFT</span>}
                    </span>
                  ) : g.status === 'postponed' ? (
                    <span className="text-orange-500 font-medium">PPD</span>
                  ) : (
                    <span className="text-slate-400">{g.time}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Column render ───────────────────────────────────────────────────────────
  const RoundColumn = ({ sName, isLast }: { sName: string; isLast: boolean }) => {
    const matchups = buildMatchups(bracketGames, sName);
    const final = isFinalRound(sName);
    return (
      <div className="flex items-stretch gap-0 flex-shrink-0">
        <div className="w-60">
          <div className={`text-white text-center text-xs font-bold py-1.5 px-3 rounded-t-lg
            ${final ? 'bg-amber-500' : 'bg-indigo-600'}`}>
            {sName}
          </div>
          <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-b-lg p-2.5">
            {matchups.map(({ teamA, teamB, games: mGames }) => (
              <MatchupCard key={`${teamA}-${teamB}`} teamA={teamA} teamB={teamB} games={mGames} final={final} />
            ))}
          </div>
        </div>
        {!isLast && (
          <div className="flex items-center px-1 text-slate-300">
            <ChevronRight size={16} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 overflow-auto h-full space-y-8">
      <h2 className="text-2xl font-bold text-slate-800">{t('playoff.title')}</h2>

      {/* Pool Stage */}
      {poolGames.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pool Stage</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="flex gap-1 items-start overflow-x-auto pb-2">
            {poolSeriesOrder.map((sName, i) => {
              const matchups = buildMatchups(poolGames, sName);
              return (
                <div key={sName} className="flex items-stretch gap-0 flex-shrink-0">
                  <div className="w-56">
                    <div className="bg-slate-600 text-white text-center text-xs font-bold py-1.5 px-3 rounded-t-lg">
                      {sName}
                    </div>
                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-b-lg p-2.5">
                      {matchups.map(({ teamA, teamB, games: mGames }) => (
                        <MatchupCard key={`${teamA}-${teamB}`} teamA={teamA} teamB={teamB} games={mGames} />
                      ))}
                    </div>
                  </div>
                  {i < poolSeriesOrder.length - 1 && (
                    <div className="flex items-center px-1 text-slate-300">
                      <ChevronRight size={14} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Bracket */}
      {bracketGames.length > 0 && (
        <section>
          {poolGames.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Bracket</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          )}
          <div className="flex gap-1 items-start overflow-x-auto pb-4">
            {bracketRounds.map((roundSeries, ri) =>
              roundSeries.map((sName, si) => (
                <RoundColumn
                  key={sName}
                  sName={sName}
                  isLast={ri === bracketRounds.length - 1 && si === roundSeries.length - 1}
                />
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default PlayoffBracket;
