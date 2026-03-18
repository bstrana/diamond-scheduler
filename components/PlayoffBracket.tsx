import React, { useMemo } from 'react';
import { Game, Team } from '../types';

interface PlayoffBracketProps {
  games: Game[];
  teams: Team[];
}

const PlayoffBracket: React.FC<PlayoffBracketProps> = ({ games, teams }) => {
  const getTeam = (id: string) => teams.find(t => t.id === id);

  const bracketGames = useMemo(() => games.filter(g => g.seriesName), [games]);

  // Ordered series based on first game date in each series
  const seriesOrder = useMemo(() => {
    const map = new Map<string, string>();
    bracketGames.forEach(g => {
      if (!g.seriesName) return;
      const existing = map.get(g.seriesName);
      if (!existing || g.date < existing) map.set(g.seriesName, g.date);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([name]) => name);
  }, [bracketGames]);

  // Group games within each series by team-pair matchup
  const seriesMatchups = useMemo(() => {
    const result: Record<string, { teamA: string; teamB: string; games: Game[] }[]> = {};
    seriesOrder.forEach(sName => {
      const sg = bracketGames.filter(g => g.seriesName === sName);
      const matchupMap = new Map<string, Game[]>();
      sg.forEach(g => {
        const key = [g.homeTeamId, g.awayTeamId].sort().join('|');
        const arr = matchupMap.get(key) ?? [];
        arr.push(g);
        matchupMap.set(key, arr);
      });
      result[sName] = Array.from(matchupMap.entries()).map(([key, mGames]) => {
        const [a, b] = key.split('|');
        return { teamA: a, teamB: b, games: mGames.sort((x, y) => x.date.localeCompare(y.date)) };
      });
    });
    return result;
  }, [bracketGames, seriesOrder]);

  if (bracketGames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2 p-8 text-center">
        <p className="text-lg font-semibold text-slate-500">No bracket games yet</p>
        <p>Assign a <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">Series Name</span> to games (e.g. "Semifinal", "Final") when scheduling to build the bracket automatically.</p>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-auto h-full">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Playoff Bracket</h2>
      <div className="flex gap-6 items-start overflow-x-auto pb-4">
        {seriesOrder.map((sName) => (
          <div key={sName} className="flex-shrink-0 w-64">
            {/* Round header */}
            <div className="bg-indigo-600 text-white text-center text-sm font-bold py-2 px-4 rounded-t-lg">
              {sName}
            </div>
            <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-b-lg p-3">
              {seriesMatchups[sName].map(({ teamA, teamB, games: mGames }) => {
                const tA = getTeam(teamA);
                const tB = getTeam(teamB);

                // Tally wins per team in this matchup
                const winsA = mGames.filter(g => {
                  if (g.status !== 'final' || !g.scores) return false;
                  return (g.homeTeamId === teamA && g.scores.home > g.scores.away) ||
                         (g.awayTeamId === teamA && g.scores.away > g.scores.home);
                }).length;
                const winsB = mGames.filter(g => {
                  if (g.status !== 'final' || !g.scores) return false;
                  return (g.homeTeamId === teamB && g.scores.home > g.scores.away) ||
                         (g.awayTeamId === teamB && g.scores.away > g.scores.home);
                }).length;

                const seriesOver = mGames.some(g => g.status === 'final');
                const leaderA = seriesOver && winsA > winsB;
                const leaderB = seriesOver && winsB > winsA;

                return (
                  <div key={`${teamA}-${teamB}`} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    {[{ team: tA, teamId: teamA, wins: winsA, leading: leaderA },
                      { team: tB, teamId: teamB, wins: winsB, leading: leaderB }].map(({ team, teamId, wins, leading }, i) => (
                      <div
                        key={teamId}
                        className={`flex items-center gap-2 px-3 py-2 ${i === 0 ? 'border-b border-slate-100' : ''} ${leading ? 'bg-emerald-50' : ''}`}
                      >
                        {team?.logoUrl ? (
                          <img src={team.logoUrl} alt={team.name} className="w-5 h-5 object-contain flex-shrink-0" />
                        ) : (
                          <span
                            className="w-5 h-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: team?.primaryColor ?? '#94a3b8' }}
                          />
                        )}
                        <span className={`flex-1 text-sm truncate ${leading ? 'font-bold text-emerald-700' : 'text-slate-700'}`}>
                          {team ? `${team.city} ${team.name}` : 'TBD'}
                        </span>
                        {seriesOver && (
                          <span className={`text-sm font-bold w-5 text-right flex-shrink-0 ${leading ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {wins}
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Game list within the matchup */}
                    {mGames.length > 0 && (
                      <div className="px-3 py-1 bg-slate-50 border-t border-slate-100">
                        {mGames.map((g, gi) => {
                          const home = getTeam(g.homeTeamId);
                          const away = getTeam(g.awayTeamId);
                          return (
                            <div key={g.id} className="flex items-center justify-between py-0.5 text-xs text-slate-500">
                              <span>Gm {gi + 1} · {g.date}</span>
                              {g.status === 'final' && g.scores ? (
                                <span className="font-medium text-slate-700">
                                  {away?.abbreviation ?? '?'} {g.scores.away} – {g.scores.home} {home?.abbreviation ?? '?'}
                                </span>
                              ) : g.status === 'live' ? (
                                <span className="text-emerald-600 font-semibold animate-pulse">LIVE</span>
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
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayoffBracket;
