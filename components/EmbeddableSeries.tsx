import React, { useEffect, useMemo, useState } from 'react';
import { Game, League, Team } from '../types';
import * as storageApi from '../services/storage';
import { useTranslation } from 'react-i18next';

interface EmbeddableSeriesProps {
  leagueId?: string;
  dataOverride?: { leagues: League[]; teams: Team[]; games: Game[] } | null;
  scheduleKey?: string;
}

const EmbeddableSeries: React.FC<EmbeddableSeriesProps> = ({
  leagueId,
  dataOverride,
  scheduleKey,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<{ leagues: League[]; teams: Team[]; games: Game[] } | null>(
    dataOverride || null
  );
  const [isLoading, setIsLoading] = useState(!dataOverride && !!scheduleKey);
  const allowedLeagueIds = useMemo(() => (leagueId || '').split(',').filter(Boolean), [leagueId]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(allowedLeagueIds.length === 1 ? allowedLeagueIds[0] : '');

  useEffect(() => {
    if (dataOverride) { setData(dataOverride); return; }
    if (!scheduleKey) { setIsLoading(false); return; }
    let active = true;
    storageApi.loadPublishedScheduleByKey(scheduleKey).then(result => {
      if (!active) return;
      setData(result ? { leagues: result.leagues, teams: result.teams, games: result.games } : null);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [scheduleKey, dataOverride]);

  useEffect(() => {
    if (!selectedLeagueId && data?.leagues?.length) {
      const first = allowedLeagueIds.length > 0
        ? data.leagues.find(l => allowedLeagueIds.includes(l.id))?.id
        : data.leagues[0]?.id;
      setSelectedLeagueId(first || '');
    }
  }, [data, allowedLeagueIds, selectedLeagueId]);

  const visibleLeagues = useMemo(() => {
    const all = data?.leagues ?? [];
    if (allowedLeagueIds.length > 1) return all.filter(l => allowedLeagueIds.includes(l.id));
    return all;
  }, [data, allowedLeagueIds]);

  const league = useMemo(
    () => visibleLeagues.find(l => l.id === selectedLeagueId) ?? visibleLeagues[0] ?? null,
    [visibleLeagues, selectedLeagueId]
  );

  const games = useMemo(() => data?.games ?? [], [data]);
  const teams = useMemo(() => data?.teams ?? [], [data]);

  const getTeam = (id: string) => teams.find(t => t.id === id);

  // Filter games that belong to the selected league and have a series name
  const bracketGames = useMemo(() => {
    if (!league) return [];
    return games.filter(g => {
      if (!g.seriesName) return false;
      const ids = g.leagueIds?.length ? g.leagueIds : g.leagueId ? [g.leagueId] : [];
      return ids.includes(league.id);
    });
  }, [games, league]);

  // Order series by first game date
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

  // Group games by series → matchup
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

  const root: React.CSSProperties = {
    fontFamily: 'var(--embed-font, Inter, sans-serif)',
    fontSize: 'var(--embed-font-size, 14px)',
    color: 'var(--embed-text, #1e293b)',
    background: 'var(--embed-bg, #f8fafc)',
    padding: '16px',
    height: '100%',
    overflowY: 'auto',
    boxSizing: 'border-box',
  };

  if (isLoading) {
    return (
      <div style={{ ...root, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {t('standings.loading')}
      </div>
    );
  }

  if (!data || !league) {
    return (
      <div style={{ ...root, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        {t('standings.noData')}
      </div>
    );
  }

  return (
    <div style={root}>
      {/* League selector */}
      {visibleLeagues.length > 1 && allowedLeagueIds.length !== 1 && (
        <div style={{ marginBottom: '12px' }}>
          <select
            value={selectedLeagueId}
            onChange={e => setSelectedLeagueId(e.target.value)}
            style={{
              border: '1px solid var(--embed-border, #e2e8f0)',
              borderRadius: 'var(--embed-radius, 6px)',
              padding: '6px 10px',
              background: 'var(--embed-card-bg, #fff)',
              fontSize: 'inherit',
              color: 'inherit',
            }}
          >
            {visibleLeagues.map(l => (
              <option key={l.id} value={l.id}>
                {l.shortName || l.name}{l.category ? ` – ${l.category}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        {league.logoUrl && (
          <img src={league.logoUrl} alt={league.name} style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        )}
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1em', fontWeight: 700 }}>
            {league.name}{league.category ? ` – ${league.category}` : ''}
          </h2>
          <p style={{ margin: 0, fontSize: '0.78em', opacity: 0.6 }}>{t('playoff.title')}</p>
        </div>
      </div>

      {bracketGames.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 16px' }}>
          <p style={{ fontWeight: 600, marginBottom: '6px' }}>{t('playoff.noBracketYet')}</p>
          <p style={{ fontSize: '0.85em' }}>{t('playoff.noBracketHint')}</p>
        </div>
      ) : (
        /* Bracket: horizontal scroll for multiple rounds */
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' } as React.CSSProperties}>
          {seriesOrder.map(sName => (
            <div key={sName} style={{ flexShrink: 0, width: '240px' }}>
              {/* Round header */}
              <div style={{
                background: 'var(--embed-primary, #4f46e5)',
                color: '#fff',
                textAlign: 'center',
                fontSize: '0.8em',
                fontWeight: 700,
                padding: '7px 12px',
                borderRadius: '8px 8px 0 0',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {sName}
              </div>

              <div style={{
                background: 'var(--embed-bg, #f8fafc)',
                border: '1px solid var(--embed-border, #e2e8f0)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {seriesMatchups[sName]?.map(({ teamA, teamB, games: mGames }) => {
                  const tA = getTeam(teamA);
                  const tB = getTeam(teamB);

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

                  const hasResults = mGames.some(g => g.status === 'final');
                  const leaderA = hasResults && winsA > winsB;
                  const leaderB = hasResults && winsB > winsA;

                  return (
                    <div
                      key={`${teamA}-${teamB}`}
                      style={{
                        background: 'var(--embed-card-bg, #fff)',
                        border: '1px solid var(--embed-card-border, #e2e8f0)',
                        borderRadius: 'var(--embed-card-radius, 8px)',
                        overflow: 'hidden',
                        boxShadow: 'var(--embed-card-shadow, 0 1px 3px rgba(0,0,0,0.07))',
                      }}
                    >
                      {/* Team rows */}
                      {[
                        { team: tA, teamId: teamA, wins: winsA, leading: leaderA },
                        { team: tB, teamId: teamB, wins: winsB, leading: leaderB },
                      ].map(({ team, teamId, wins, leading }, i) => (
                        <div
                          key={teamId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            borderBottom: i === 0 ? '1px solid var(--embed-border, #e2e8f0)' : 'none',
                            background: leading ? 'rgba(22,163,74,0.06)' : 'transparent',
                          }}
                        >
                          {team?.logoUrl ? (
                            <img src={team.logoUrl} alt={team.name} style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0 }} />
                          ) : (
                            <span style={{
                              width: '18px', height: '18px', borderRadius: '50%',
                              background: team?.primaryColor ?? '#94a3b8',
                              display: 'inline-block', flexShrink: 0,
                            }} />
                          )}
                          <span style={{
                            flex: 1,
                            fontSize: '0.85em',
                            fontWeight: leading ? 700 : 500,
                            color: leading ? '#16a34a' : 'var(--embed-text, #1e293b)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {team ? `${team.city} ${team.name}` : 'TBD'}
                          </span>
                          {hasResults && (
                            <span style={{
                              fontSize: '0.9em',
                              fontWeight: 700,
                              color: leading ? '#16a34a' : '#94a3b8',
                              minWidth: '16px',
                              textAlign: 'right',
                            }}>
                              {wins}
                            </span>
                          )}
                        </div>
                      ))}

                      {/* Game list */}
                      {mGames.length > 0 && (
                        <div style={{
                          padding: '4px 10px 6px',
                          background: 'var(--embed-bg, #f8fafc)',
                          borderTop: '1px solid var(--embed-border, #e2e8f0)',
                        }}>
                          {mGames.map((g, gi) => {
                            const home = getTeam(g.homeTeamId);
                            const away = getTeam(g.awayTeamId);
                            return (
                              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: '0.75em', color: '#64748b' }}>
                                <span>Gm {gi + 1} · {g.date}</span>
                                {g.status === 'final' && g.scores ? (
                                  <span style={{ fontWeight: 600, color: '#334155' }}>
                                    {away?.abbreviation ?? '?'} {g.scores.away}–{g.scores.home} {home?.abbreviation ?? '?'}
                                  </span>
                                ) : g.status === 'live' ? (
                                  <span style={{ color: '#16a34a', fontWeight: 700 }}>● LIVE</span>
                                ) : g.status === 'postponed' ? (
                                  <span style={{ color: '#f97316', fontWeight: 600 }}>PPD</span>
                                ) : (
                                  <span>{g.time}</span>
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
      )}
    </div>
  );
};

export default EmbeddableSeries;
