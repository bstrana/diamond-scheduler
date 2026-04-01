import React, { useEffect, useMemo, useRef, useState } from 'react';
import { League, Team, Game } from '../types';
import { buildStandingsShareText, copyToClipboard, calculateStandings, StandingsRow, getCountryCode } from '../utils';
import { Share2, Copy, Check, ImageDown, GripVertical, ChevronDown, X } from 'lucide-react';
import * as storageApi from '../services/storage';
import { useTranslation } from 'react-i18next';

type SortKey = 'W' | 'GB' | 'RS' | 'RA' | 'RD';
const ALL_SORT_KEYS: SortKey[] = ['W', 'GB', 'RS', 'RA', 'RD'];

const compareByKey = (a: StandingsRow, b: StandingsRow, key: SortKey): number => {
  switch (key) {
    case 'W':  return b.w - a.w;
    case 'GB': return (a.gb ?? 0) - (b.gb ?? 0);
    case 'RS': return b.rs - a.rs;
    case 'RA': return a.ra - b.ra;
    case 'RD': return b.diff - a.diff;
    default:   return 0;
  }
};

function getGameLeagueIds(game: Game): string[] {
  if (game.leagueIds && game.leagueIds.length > 0) return game.leagueIds;
  if (game.leagueId) return [game.leagueId];
  return [];
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
  infoText?: string;
  showCountry?: boolean;
  defaultSort?: string;
}

const EmbeddableStandings: React.FC<EmbeddableStandingsProps> = ({
  leagueId,
  dataOverride,
  scheduleKey,
  infoText,
  showCountry = false,
  defaultSort,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<{ leagues: League[]; teams: Team[]; games: Game[] } | null>(
    dataOverride || null
  );
  const [isLoading, setIsLoading] = useState(!dataOverride && !!scheduleKey);
  const allowedLeagueIds = useMemo(() => (leagueId || '').split(',').filter(Boolean), [leagueId]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(allowedLeagueIds.length === 1 ? allowedLeagueIds[0] : '');
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const sortPanelRef = useRef<HTMLDivElement>(null);
  const [activeSortKeys, setActiveSortKeys] = useState<SortKey[]>([]);
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const [useCustomSort, setUseCustomSort] = useState(false);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [dragSrcId, setDragSrcId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!showShareMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareMenu]);

  useEffect(() => {
    if (!sortPanelOpen) return;
    const handle = (e: MouseEvent) => {
      if (sortPanelRef.current && !sortPanelRef.current.contains(e.target as Node)) {
        setSortPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [sortPanelOpen]);

  useEffect(() => {
    if (!defaultSort) return;
    const keys = defaultSort.split(',').filter((k): k is SortKey => ALL_SORT_KEYS.includes(k as SortKey));
    if (keys.length > 0) setActiveSortKeys(keys);
  }, [defaultSort]);

  // Reset custom order when active league changes
  useEffect(() => {
    setCustomOrder([]);
  }, [selectedLeagueId]);

  const visibleLeagues = useMemo(() => {
    const all = data?.leagues ?? [];
    if (allowedLeagueIds.length > 1) return all.filter(l => allowedLeagueIds.includes(l.id));
    return all;
  }, [data, allowedLeagueIds]);

  const league = useMemo(
    () => visibleLeagues.find(l => l.id === selectedLeagueId) ?? visibleLeagues[0] ?? null,
    [visibleLeagues, selectedLeagueId]
  );

  const standings = useMemo(
    () => (league && data ? calculateStandings(league, data.games) : []),
    [league, data]
  );

  const sortedStandings = useMemo(() => {
    if (useCustomSort) {
      if (customOrder.length === 0) return standings;
      const orderMap = new Map<string, number>(customOrder.map((id, i) => [id, i]));
      return [...standings].sort((a, b) => {
        const ai: number = orderMap.get(a.team.id) ?? Infinity;
        const bi: number = orderMap.get(b.team.id) ?? Infinity;
        return ai - bi;
      });
    }
    if (activeSortKeys.length === 0) return standings;
    return [...standings].sort((a, b) => {
      for (const key of activeSortKeys) {
        const c = compareByKey(a, b, key);
        if (c !== 0) return c;
      }
      return 0;
    });
  }, [standings, activeSortKeys, useCustomSort, customOrder]);

  const totalGames = standings.reduce((s, r) => s + r.w + r.l, 0) / 2;

  const liveGamesWithStream = useMemo(() => {
    if (!data || !league) return [];
    return data.games.filter(g =>
      g.status === 'live' &&
      (g as any).streamUrl &&
      getGameLeagueIds(g).includes(league.id)
    );
  }, [data, league]);

  const captureStandings = async () => {
    if (!cardRef.current || isCapturing) return;
    setIsCapturing(true);
    setShowShareMenu(false);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      const link = document.createElement('a');
      const leagueLabel = league
        ? (league.shortName || league.name) + (league.category ? ` – ${league.category}` : '')
        : 'standings';
      link.download = `standings-${leagueLabel.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to capture standings:', err);
    } finally {
      setIsCapturing(false);
    }
  };

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
              <option key={l.id} value={l.id}>{l.shortName || l.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Announcement banner */}
      {league?.announcement && !announcementDismissed && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: 'var(--embed-radius, 6px)',
          padding: '8px 12px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          fontSize: '0.85em',
          color: '#92400e',
        }}>
          <span>📢 {league.announcement}</span>
          <button
            onClick={() => setAnnouncementDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', fontWeight: 700, fontSize: '1em', lineHeight: 1, padding: '2px 4px' }}
            title={t('standings.dismiss')}
          >×</button>
        </div>
      )}

      {/* Watch Live banner */}
      {liveGamesWithStream.length > 0 && (
        <div style={{
          marginBottom: '12px',
          padding: '8px 12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--embed-radius, 6px)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.85em', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            ● {t('standings.liveNow')}
          </span>
          {liveGamesWithStream.map(g => (
            <a
              key={g.id}
              href={(g as any).streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.8em',
                padding: '3px 10px',
                background: '#dc2626',
                color: '#fff',
                borderRadius: '999px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              {t('standings.watchLive')}
            </a>
          ))}
        </div>
      )}

      {/* Table */}
      <div ref={cardRef} style={{
        background: 'var(--embed-card-bg, #fff)',
        borderRadius: 'var(--embed-card-radius, 8px)',
        border: '1px solid var(--embed-border, #e2e8f0)',
        overflow: 'hidden',
        boxShadow: 'var(--embed-card-shadow, 0 1px 3px 0 rgba(0,0,0,0.08))',
      }}>
        {/* Capture header — league logo + name, shown inside the card so it's included in save-as-image */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--embed-border, #e2e8f0)',
        }}>
          {league.logoUrl && (
            <img
              src={league.logoUrl}
              alt={league.name}
              style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95em', lineHeight: 1.2 }}>
              {league.name}{league.category ? ` – ${league.category}` : ''}
            </div>
            <div style={{ fontSize: '0.72em', opacity: 0.75 }}>{t('standings.title')}</div>
          </div>
          {/* Sort selector */}
          <div ref={sortPanelRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setSortPanelOpen(p => !p)}
              title="Sort order"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px', borderRadius: '6px',
                border: '1px solid var(--embed-border, #e2e8f0)',
                background: (activeSortKeys.length > 0 || useCustomSort) ? 'var(--embed-primary, #4f46e5)' : 'var(--embed-card-bg, #fff)',
                color: (activeSortKeys.length > 0 || useCustomSort) ? '#fff' : 'var(--embed-text, #64748b)',
                cursor: 'pointer', fontSize: '0.72em', fontWeight: 600, lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {useCustomSort ? 'Custom' : activeSortKeys.length > 0 ? activeSortKeys.join(' › ') : 'Sort'}
              <ChevronDown size={11} />
            </button>
            {sortPanelOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 40,
                background: 'var(--embed-card-bg, #fff)',
                border: '1px solid var(--embed-border, #e2e8f0)',
                borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                padding: '10px', width: '210px',
              }}>
                <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Sort Priority
                </div>
                {/* Active sort keys */}
                {activeSortKeys.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {activeSortKeys.map((key, i) => (
                      <span key={key} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        background: 'var(--embed-primary, #4f46e5)', color: '#fff',
                        borderRadius: '4px', padding: '2px 6px', fontSize: '0.8em', fontWeight: 700,
                      }}>
                        <span style={{ opacity: 0.7, fontSize: '0.85em' }}>{i + 1}.</span> {key}
                        <button
                          onClick={() => setActiveSortKeys(prev => prev.filter(k => k !== key))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center', opacity: 0.8 }}
                        ><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Available keys to add */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                  {ALL_SORT_KEYS.filter(k => !activeSortKeys.includes(k)).map(key => (
                    <button
                      key={key}
                      onClick={() => { setUseCustomSort(false); setActiveSortKeys(prev => [...prev, key]); }}
                      style={{
                        background: 'var(--embed-bg, #f8fafc)',
                        border: '1px solid var(--embed-border, #e2e8f0)',
                        borderRadius: '4px', padding: '2px 8px', fontSize: '0.8em', fontWeight: 600,
                        cursor: 'pointer', color: 'var(--embed-text, #334155)',
                      }}
                    >{key}</button>
                  ))}
                </div>
                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--embed-border, #e2e8f0)', marginBottom: '8px' }} />
                {/* Custom sort toggle */}
                <button
                  onClick={() => { setUseCustomSort(p => !p); if (!useCustomSort) setActiveSortKeys([]); if (customOrder.length === 0) setCustomOrder(sortedStandings.map(r => r.team.id)); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                    background: useCustomSort ? 'var(--embed-primary, #4f46e5)' : 'var(--embed-bg, #f8fafc)',
                    color: useCustomSort ? '#fff' : 'var(--embed-text, #334155)',
                    border: '1px solid var(--embed-border, #e2e8f0)',
                    borderRadius: '6px', padding: '5px 8px', cursor: 'pointer',
                    fontSize: '0.8em', fontWeight: 600, textAlign: 'left',
                  }}
                >
                  <GripVertical size={12} />
                  Custom order (drag rows)
                </button>
                {(activeSortKeys.length > 0 || useCustomSort) && (
                  <button
                    onClick={() => { setActiveSortKeys([]); setUseCustomSort(false); setCustomOrder([]); }}
                    style={{
                      marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', width: '100%',
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75em',
                      color: '#94a3b8', padding: '2px 4px', textAlign: 'left',
                    }}
                  >
                    <X size={10} /> Reset to default
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <table style={{ width: '100%', minWidth: '480px', borderCollapse: 'collapse', fontSize: '0.9em' }}>
          <thead>
            <tr style={{ background: 'var(--embed-primary, #4f46e5)', color: '#fff' }}>
              <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '14px', width: '28px' }}>#</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Team</th>
              <th style={thStyle}>GP</th>
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
            {sortedStandings.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9em' }}
                >
                  {t('standings.noGamesYet')}
                </td>
              </tr>
            ) : (
              sortedStandings.map((row, idx) => (
                <tr
                  key={row.team.id}
                  draggable={useCustomSort}
                  onDragStart={useCustomSort ? () => setDragSrcId(row.team.id) : undefined}
                  onDragOver={useCustomSort ? (e) => e.preventDefault() : undefined}
                  onDrop={useCustomSort ? (e) => {
                    e.preventDefault();
                    if (!dragSrcId || dragSrcId === row.team.id) return;
                    setCustomOrder(prev => {
                      const base = prev.length > 0 ? [...prev] : sortedStandings.map(r => r.team.id);
                      const srcIdx = base.indexOf(dragSrcId);
                      const tgtIdx = base.indexOf(row.team.id);
                      if (srcIdx === -1 || tgtIdx === -1) return prev;
                      const next = [...base];
                      next.splice(srcIdx, 1);
                      next.splice(tgtIdx, 0, dragSrcId);
                      return next;
                    });
                    setDragSrcId(null);
                  } : undefined}
                  onDragEnd={useCustomSort ? () => setDragSrcId(null) : undefined}
                  style={{
                    borderTop: '1px solid var(--embed-border, #e2e8f0)',
                    background: dragSrcId === row.team.id
                      ? 'var(--embed-primary-light, rgba(79,70,229,0.07))'
                      : idx % 2 === 0
                        ? 'var(--embed-card-bg, #fff)'
                        : 'var(--embed-bg, #f8fafc)',
                    cursor: useCustomSort ? 'grab' : 'default',
                  }}
                >
                  <td style={{ ...tdStyle, paddingLeft: '14px', color: '#94a3b8', fontWeight: 500 }}>
                    {useCustomSort ? <GripVertical size={12} style={{ opacity: 0.4 }} /> : idx + 1}
                  </td>
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
                        {showCountry && getCountryCode(row.team.country) && (
                          <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '4px', fontSize: '0.82em', letterSpacing: '0.05em' }}>
                            ({getCountryCode(row.team.country)})
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: '#64748b' }}>{row.gp}</td>
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
      </div>

      {/* Footer + share button */}
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {infoText && (
            <p style={{ margin: 0, fontSize: '0.78em', color: 'var(--embed-text, #475569)' }}>{infoText}</p>
          )}
          {totalGames > 0 && (
            <p style={{ margin: 0, fontSize: '0.73em', color: '#94a3b8' }}>
              {t('standings.basedOn', { count: totalGames })}
            </p>
          )}
        </div>

        <div ref={shareMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowShareMenu(p => !p)}
            title={t('standings.shareStandings')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '5px', borderRadius: '6px',
              border: '1px solid var(--embed-border, #e2e8f0)',
              backgroundColor: 'var(--embed-card-bg, #ffffff)',
              color: 'var(--embed-text, #64748b)',
              cursor: 'pointer', lineHeight: 0,
            }}
          >
            <Share2 size={15} />
          </button>

          {showShareMenu && (
            <div style={{
              position: 'absolute',
              bottom: '30px',
              right: 0,
              zIndex: 30,
              padding: '6px',
              width: '168px',
              borderRadius: '8px',
              border: '1px solid var(--embed-border, #e2e8f0)',
              backgroundColor: 'var(--embed-card-bg, #ffffff)',
              boxShadow: '0 -4px 15px -3px rgba(0,0,0,0.1)',
            }}>
              <button
                onClick={async () => {
                  const leagueLabel = league.name + (league.category ? ` – ${league.category}` : '');
                  const text = buildStandingsShareText(standings, leagueLabel);
                  await copyToClipboard(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '6px 8px', fontSize: '0.8125rem',
                  color: copied ? '#16a34a' : 'var(--embed-text, #334155)',
                  backgroundColor: 'transparent', border: 'none', borderRadius: '6px',
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--embed-bg, #f8fafc)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {copied ? <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} /> : <Copy size={14} style={{ flexShrink: 0 }} />}
                {copied ? t('common.copied') : t('standings.copyText')}
              </button>
              <button
                onClick={captureStandings}
                disabled={isCapturing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '6px 8px', fontSize: '0.8125rem',
                  color: 'var(--embed-text, #334155)',
                  backgroundColor: 'transparent', border: 'none', borderRadius: '6px',
                  cursor: isCapturing ? 'default' : 'pointer', textAlign: 'left',
                  opacity: isCapturing ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { if (!isCapturing) e.currentTarget.style.backgroundColor = 'var(--embed-bg, #f8fafc)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <ImageDown size={14} style={{ flexShrink: 0 }} />
                {isCapturing ? t('common.saving', 'Saving…') : t('standings.saveAsImage', 'Save as image')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbeddableStandings;
