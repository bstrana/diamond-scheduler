import React, { useEffect, useMemo, useState } from 'react';
import { League, Team, Game } from '../types';
import * as storageApi from '../services/storage';

interface StandingsRow {
  team: Team;
  w: number;
  l: number;
  pct: number;
  gb: number | null; // null for leader
  rs: number;
  ra: number;
  diff: number;
}

function getGameLeagueIds(game: Game): string[] {
  if (game.leagueIds && game.leagueIds.length > 0) return game.leagueIds;
  if (game.leagueId) return [game.leagueId];
  return [];
}

function calculateStandings(league: League, games: Game[]): StandingsRow[] {
  const completedGames = games.filter(game => {
    const isCompleted = game.status === 'final' || game.status === 'completed';
    return isCompleted && game.scores != null && getGameLeagueIds(game).includes(league.id);
  });

  const stats = new Map<string, { w: number; l: number; rs: number; ra: number }>();
  league.teams.forEach(team => stats.set(team.id, { w: 0, l: 0, rs: 0, ra: 0 }));

  completedGames.forEach(game => {
    const home = stats.get(game.homeTeamId);
    const away = stats.get(game.awayTeamId);
    if (!home || !away || !game.scores) return;

    const hr = game.scores.home;
    const ar = game.scores.away;
    home.rs += hr; home.ra += ar;
    away.rs += ar; away.ra += hr;
    if (hr > ar) { home.w++; away.l++; }
    else if (ar > hr) { away.w++; home.l++; }
  });

  const rows: StandingsRow[] = league.teams
    .filter(team => stats.has(team.id))
    .map(team => {
      const s = stats.get(team.id)!;
      const gp = s.w + s.l;
      return { team, w: s.w, l: s.l, pct: gp > 0 ? s.w / gp : 0, gb: 0, rs: s.rs, ra: s.ra, diff: s.rs - s.ra };
    })
    .sort((a, b) => b.w - a.w || a.l - b.l || b.diff - a.diff);

  if (rows.length > 0) {
    const leader = rows[0];
    rows.forEach((row, idx) => {
      row.gb = idx === 0 ? null : ((leader.w - row.w) + (row.l - leader.l)) / 2;
    });
  }

  return rows;
}

const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '0.8em',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = { padding: '9px 8px', textAlign: 'center' };

interface EmbeddableStandingsProps {
  leagueId?: string;
  dataOverride?: { leagues: League[]; teams: Team[]; games: Game[] } | null;
  scheduleKey?: string;
}

const EmbeddableStandings: React.FC<EmbeddableStandingsProps> = ({
  leagueId,
  dataOverride,
  scheduleKey,
}) => {
  const [data, setData] = useState<{ leagues: League[]; teams: Team[]; games: Game[] } | null>(
    dataOverride || null
  );
  const [isLoading, setIsLoading] = useState(!dataOverride && !!scheduleKey);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(leagueId || '');

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
      setSelectedLeagueId(leagueId || data.leagues[0]?.id || '');
    }
  }, [data, leagueId, selectedLeagueId]);

  const league = useMemo(
    () => data?.leagues?.find(l => l.id === selectedLeagueId) ?? data?.leagues?.[0] ?? null,
    [data, selectedLeagueId]
  );

  const standings = useMemo(
    () => (league && data ? calculateStandings(league, data.games) : []),
    [league, data]
  );

  const totalGames = standings.reduce((s, r) => s + r.w + r.l, 0) / 2;

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
        Loading standings…
      </div>
    );
  }

  if (!data || !league) {
    return (
      <div style={{ ...root, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        No standings data available.
      </div>
    );
  }

  return (
    <div style={root}>
      {/* League selector — only when multiple leagues exist and none was pre-selected */}
      {data.leagues.length > 1 && !leagueId && (
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
            {data.leagues.map(l => (
              <option key={l.id} value={l.id}>
                {l.shortName || l.name}{l.category ? ` – ${l.category}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {league.logoUrl && (
          <img src={league.logoUrl} alt={league.name} style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
        )}
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1em', fontWeight: 700 }}>
            {league.name}{league.category ? ` – ${league.category}` : ''}
          </h2>
          <p style={{ margin: 0, fontSize: '0.78em', opacity: 0.6 }}>League Standings</p>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--embed-card-bg, #fff)',
        borderRadius: 'var(--embed-card-radius, 8px)',
        border: '1px solid var(--embed-border, #e2e8f0)',
        overflow: 'hidden',
        boxShadow: 'var(--embed-card-shadow, 0 1px 3px 0 rgba(0,0,0,0.08))',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
          <thead>
            <tr style={{ background: 'var(--embed-primary, #4f46e5)', color: '#fff' }}>
              <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '14px', width: '28px' }}>#</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Team</th>
              <th style={thStyle}>W</th>
              <th style={thStyle}>L</th>
              <th style={thStyle}>PCT</th>
              <th style={thStyle}>GB</th>
              <th style={thStyle}>RS</th>
              <th style={thStyle}>RA</th>
              <th style={{ ...thStyle, paddingRight: '14px' }}>DIFF</th>
            </tr>
          </thead>
          <tbody>
            {standings.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9em' }}
                >
                  No completed games yet. Standings will appear here once games are finalized.
                </td>
              </tr>
            ) : (
              standings.map((row, idx) => (
                <tr
                  key={row.team.id}
                  style={{
                    borderTop: '1px solid var(--embed-border, #e2e8f0)',
                    background: idx % 2 === 0
                      ? 'var(--embed-card-bg, #fff)'
                      : 'var(--embed-bg, #f8fafc)',
                  }}
                >
                  <td style={{ ...tdStyle, paddingLeft: '14px', color: '#94a3b8', fontWeight: 500 }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {row.team.logoUrl ? (
                        <img
                          src={row.team.logoUrl}
                          alt={row.team.name}
                          style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }}
                        />
                      ) : (
                        <span style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: row.team.primaryColor || '#94a3b8',
                          display: 'inline-block', flexShrink: 0,
                        }} />
                      )}
                      <span style={{ fontWeight: 600 }}>
                        {row.team.city} {row.team.name}
                        <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '4px', fontSize: '0.85em' }}>
                          {row.team.abbreviation}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--embed-primary, #4f46e5)' }}>{row.w}</td>
                  <td style={tdStyle}>{row.l}</td>
                  <td style={{ ...tdStyle, color: '#64748b' }}>
                    {(row.w + row.l === 0) ? '.000' : row.pct.toFixed(3).replace(/^0/, '')}
                  </td>
                  <td style={{ ...tdStyle, color: '#64748b' }}>
                    {row.gb === null ? '—' : row.gb === 0 ? '—' : (row.gb % 1 === 0 ? row.gb : row.gb.toFixed(1))}
                  </td>
                  <td style={tdStyle}>{row.rs}</td>
                  <td style={tdStyle}>{row.ra}</td>
                  <td style={{
                    ...tdStyle,
                    paddingRight: '14px',
                    fontWeight: 600,
                    color: row.diff > 0 ? '#16a34a' : row.diff < 0 ? '#dc2626' : '#94a3b8',
                  }}>
                    {row.diff > 0 ? `+${row.diff}` : row.diff === 0 ? '0' : row.diff}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {totalGames > 0 && (
        <p style={{ margin: '8px 0 0', fontSize: '0.73em', color: '#94a3b8', textAlign: 'right' }}>
          Based on {totalGames} completed game{totalGames !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default EmbeddableStandings;
