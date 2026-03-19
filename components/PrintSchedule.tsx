import React, { useEffect, useMemo } from 'react';
import { Game, Team, League } from '../types';
import { Printer, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PrintScheduleProps {
  games: Game[];
  teams: Team[];
  leagues: League[];
  onClose: () => void;
}

const PrintSchedule: React.FC<PrintScheduleProps> = ({ games, onClose, teams, leagues }) => {
  const { t } = useTranslation();

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const getTeam = (id: string) => teams.find(t => t.id === id);

  const getGameLeagueIds = (game: Game): string[] => {
    if (game.leagueIds?.length) return game.leagueIds;
    if (game.leagueId) return [game.leagueId];
    return [];
  };

  const getGameLeagueNames = (game: Game): string => {
    return getGameLeagueIds(game)
      .map(id => leagues.find(l => l.id === id)?.shortName || leagues.find(l => l.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  // Sort all games by date then time
  const sortedGames = useMemo(() =>
    [...games].sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time)),
    [games]
  );

  // Group by date
  const gamesByDate = useMemo(() => {
    const groups: { date: string; games: Game[] }[] = [];
    sortedGames.forEach(g => {
      const last = groups[groups.length - 1];
      if (last && last.date === g.date) last.games.push(g);
      else groups.push({ date: g.date, games: [g] });
    });
    return groups;
  }, [sortedGames]);

  const formatDateLong = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const formatStatus = (game: Game): string => {
    if (game.status === 'final' && game.scores) {
      return `Final: ${game.scores.away}–${game.scores.home}`;
    }
    if (game.status === 'live') return 'Live';
    if (game.status === 'postponed') return 'PPD';
    return game.time || '—';
  };

  let rowNum = 0;

  return (
    <>
      {/* Overlay backdrop (hidden on print) */}
      <div
        className="no-print fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="print-schedule-section fixed inset-4 md:inset-8 z-50 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">

        {/* Modal header — hidden on print */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{t('print.title')}</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{sortedGames.length} {t('print.gamesTotal')}</span>
            <button
              onClick={() => window.print()}
              className="print-show flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Printer size={15} />
              {t('print.printBtn')}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
              title={t('common.close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable table area */}
        <div className="flex-1 overflow-auto p-6 print-expand">

          {/* Print-only title */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold">{t('print.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('print.generatedOn')} {new Date().toLocaleDateString()}</p>
          </div>

          {sortedGames.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              {t('print.noGames')}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wide">
                  <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                  <th className="px-3 py-2 text-left font-semibold">{t('print.colDate')}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t('print.colAway')}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t('print.colHome')}</th>
                  <th className="px-3 py-2 text-left font-semibold hidden md:table-cell">{t('print.colLocation')}</th>
                  <th className="px-3 py-2 text-left font-semibold hidden md:table-cell">{t('print.colLeague')}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t('print.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {gamesByDate.map(({ date, games: dGames }) => (
                  <React.Fragment key={date}>
                    {/* Date group header */}
                    <tr className="print-break-avoid">
                      <td
                        colSpan={7}
                        className="px-3 py-2 bg-indigo-600 text-white font-semibold text-xs tracking-wide"
                      >
                        {formatDateLong(date)}
                      </td>
                    </tr>
                    {dGames.map(game => {
                      rowNum += 1;
                      const away = getTeam(game.awayTeamId);
                      const home = getTeam(game.homeTeamId);
                      const leagueNames = getGameLeagueNames(game);
                      const isEven = rowNum % 2 === 0;
                      return (
                        <tr
                          key={game.id}
                          className={`print-break-avoid border-b border-slate-100 ${isEven ? 'bg-slate-50' : 'bg-white'}`}
                        >
                          <td className="px-3 py-2 text-slate-400 text-xs">{rowNum}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">
                            {game.time || '—'}
                            {game.seriesName && (
                              <span className="ml-1.5 text-indigo-500 font-medium text-xs">({game.seriesName})</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            <div className="flex items-center gap-1.5">
                              {away?.logoUrl ? (
                                <img src={away.logoUrl} alt={away.name} className="w-4 h-4 object-contain shrink-0" />
                              ) : (
                                <span className="w-3 h-3 rounded-full shrink-0 inline-block" style={{ background: away?.primaryColor ?? '#94a3b8' }} />
                              )}
                              {away ? `${away.city} ${away.name}` : '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-medium">
                            <div className="flex items-center gap-1.5">
                              {home?.logoUrl ? (
                                <img src={home.logoUrl} alt={home.name} className="w-4 h-4 object-contain shrink-0" />
                              ) : (
                                <span className="w-3 h-3 rounded-full shrink-0 inline-block" style={{ background: home?.primaryColor ?? '#94a3b8' }} />
                              )}
                              {home ? `${home.city} ${home.name}` : '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-xs hidden md:table-cell truncate max-w-[160px]">
                            {game.location || '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-xs hidden md:table-cell">
                            {leagueNames || '—'}
                          </td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap font-medium">
                            {game.status === 'final' && game.scores ? (
                              <span className="text-emerald-700">
                                {game.scores.away}–{game.scores.home} F
                              </span>
                            ) : game.status === 'live' ? (
                              <span className="text-red-600 font-bold">● LIVE</span>
                            ) : game.status === 'postponed' ? (
                              <span className="text-orange-500">PPD</span>
                            ) : (
                              <span className="text-slate-400">{formatStatus(game)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

export default PrintSchedule;
