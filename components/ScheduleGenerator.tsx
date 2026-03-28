import React, { useState, useMemo, useCallback } from 'react';
import { generateRoundRobinSchedule, generateSingleEliminationBracket, generateDoubleEliminationBracket, generatePoolKnockout, calculateStandings } from '../utils';
import { Team, Game, League } from '../types';
import { Wand2, Loader2, Calendar as CalIcon, Clock, Layers, Info, Plus, X, Trophy, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { formatDate } from '../utils';
import { WEEKDAYS } from '../constants';
import { useTranslation } from 'react-i18next';

interface SchedulerTemplate {
  id: string;
  name: string;
  leagueId: string;
  config: {
    startDate: string;
    gamesPerTeam: number;
    selectedDays: string[];
    dayTimes: Record<string, string>;
    doubleHeaderMode: string;
    bestOf: number;
    seriesGameMode: string;
    roundGapDays: number;
    poolSize: number;
    advancingPerPool: number;
  };
  savedAt: string;
}

const TEMPLATES_KEY = 'ds_sched_templates';

interface ScheduleGeneratorProps {
  leagues: League[];
  games: Game[];
  onLeagueSelected: (leagueId: string) => void;
  onScheduleGenerated: (games: Game[], mode: 'replace' | 'append') => void;
}

// Special prefix used to mark standings-position references in team IDs
const STANDING_PREFIX = '__standing__';

const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({ leagues, games, onLeagueSelected, onScheduleGenerated }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  
  // Schedule Gen State
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [gamesPerTeam, setGamesPerTeam] = useState(10);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Sat']); // Default to weekend for series logic
  const [doubleHeaderMode, setDoubleHeaderMode] = useState<'none' | 'same_day' | 'consecutive' | 'series'>('none');
  const [bestOf, setBestOf] = useState<number>(3); // For series format
  const [seriesMatchups, setSeriesMatchups] = useState<Array<{team1Id: string, team2Id: string, seriesName?: string}>>([]); // For series format
  const [seriesGameMode, setSeriesGameMode] = useState<'alternate' | 'back_to_back'>('alternate'); // For series format
  const [matchupMode, setMatchupMode] = useState<'manual' | 'standings'>('manual'); // For series format
  const [appendMode, setAppendMode] = useState<'replace' | 'append'>('replace');

  // Time config per day
  const [dayTimes, setDayTimes] = useState<Record<string, string>>({
    'Sun': '13:00',
    'Mon': '15:00',
    'Tue': '15:00',
    'Wed': '15:00',
    'Thu': '15:00',
    'Fri': '15:00',
    'Sat': '13:00'
  });

  const handleLeagueChange = (id: string) => {
    setSelectedLeagueId(id);
    onLeagueSelected(id);
    // Reset series matchups when league changes
    setSeriesMatchups([]);
  };

  const handleGenerateSchedule = async () => {
    const selectedLeague = leagues.find(l => l.id === selectedLeagueId);
    
    if (!selectedLeague) {
        setError(t('scheduler.noLeagueSelected'));
        return;
    }

    if (selectedLeague.teams.length < 2) {
      setError(t('scheduler.needTwoTeams'));
      return;
    }

    if (selectedDays.length === 0) {
      setError(t('scheduler.selectGameDay'));
      return;
    }

    // For series format, validate that at least one matchup is selected
    if (doubleHeaderMode === 'series' && seriesMatchups.length === 0) {
      setError(t('scheduler.addSeriesMatchupFirst'));
      return;
    }

    // Resolve standings-position references to actual team IDs
    let resolvedMatchups = seriesMatchups;
    if (doubleHeaderMode === 'series' && matchupMode === 'standings') {
      resolvedMatchups = seriesMatchups.map(m => {
        const resolveId = (id: string): string => {
          if (!id.startsWith(STANDING_PREFIX)) return id;
          const pos = parseInt(id.slice(STANDING_PREFIX.length), 10) - 1;
          return currentStandings[pos]?.team.id ?? '';
        };
        return { ...m, team1Id: resolveId(m.team1Id), team2Id: resolveId(m.team2Id) };
      });
      // Validate all resolved
      const unresolved = resolvedMatchups.some(m => !m.team1Id || !m.team2Id);
      if (unresolved) {
        setError(t('scheduler.standingsPositionUnavailable'));
        return;
      }
    }

    setLoading(true);
    setError(null);

    // Slight delay to simulate processing for UX
    setTimeout(() => {
        try {
            const newGames = generateRoundRobinSchedule(
                selectedLeague.teams,
                startDate,
                gamesPerTeam,
                selectedDays,
                dayTimes,
                doubleHeaderMode,
                bestOf,
                resolvedMatchups,
                seriesGameMode
            );
            
            // Inject League ID (as array for multi-league support)
            const gamesWithMeta = newGames.map(g => ({
                ...g,
                leagueIds: [selectedLeague.id]
            }));

            if (gamesWithMeta.length === 0) {
                setError(t('scheduler.noGamesGenerated'));
            } else {
                // Conflict detection: flag any team scheduled twice on the same date
                const teamDateMap = new Map<string, Set<string>>();
                const detectedConflicts: string[] = [];
                gamesWithMeta.forEach(g => {
                    [g.homeTeamId, g.awayTeamId].forEach(tid => {
                        if (!teamDateMap.has(tid)) teamDateMap.set(tid, new Set());
                        const dates = teamDateMap.get(tid)!;
                        if (dates.has(g.date)) {
                            const team = selectedLeague.teams.find(t => t.id === tid);
                            const label = `${team?.abbreviation || tid} on ${g.date}`;
                            if (!detectedConflicts.includes(label)) detectedConflicts.push(label);
                        }
                        dates.add(g.date);
                    });
                });
                setConflicts(detectedConflicts);
                onScheduleGenerated(gamesWithMeta, appendMode);
            }
        } catch (e) {
            console.error(e);
            setError(t('scheduler.errorGenerating'));
        } finally {
            setLoading(false);
        }
    }, 600);
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // UI Helper: Monday first
  const orderedWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Calculate which days need time configuration
  // If consecutive or series mode, we need to show time inputs for Start Days AND the days that follow them
  const relevantDays = useMemo(() => {
    const daysSet = new Set(selectedDays);
    if (doubleHeaderMode === 'consecutive') {
        selectedDays.forEach(day => {
            const idx = WEEKDAYS.indexOf(day);
            if (idx !== -1) {
                const nextDay = WEEKDAYS[(idx + 1) % 7];
                daysSet.add(nextDay);
            }
        });
    } else if (doubleHeaderMode === 'series') {
        // For series, we might need multiple consecutive days (best of 3, 5, or 7)
        selectedDays.forEach(day => {
            const idx = WEEKDAYS.indexOf(day);
            if (idx !== -1) {
                for (let i = 0; i < bestOf; i++) {
                    const nextDay = WEEKDAYS[(idx + i) % 7];
                    daysSet.add(nextDay);
                }
            }
        });
    }
    return Array.from(daysSet).sort((a, b) => orderedWeekdays.indexOf(a as string) - orderedWeekdays.indexOf(b as string));
  }, [selectedDays, doubleHeaderMode, bestOf]);

  // Current standings for the selected league (used for standings-based matchup mode)
  const currentStandings = useMemo(() => {
    const league = leagues.find(l => l.id === selectedLeagueId);
    if (!league) return [];
    return calculateStandings(league, games);
  }, [selectedLeagueId, leagues, games]);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 rounded-2xl text-white shadow-xl">
        <div className="flex items-center space-x-4 mb-4">
          <CalIcon className="w-8 h-8" />
          <h2 className="text-3xl font-bold">{t('scheduler.title')}</h2>
        </div>
        <p className="opacity-90">
          {t('scheduler.subtitle')}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg">
          <p className="font-semibold mb-1">{t('scheduler.conflictsDetected', { count: conflicts.length })}</p>
          <p className="text-sm mb-2">{t('scheduler.conflictsNote')}</p>
          <ul className="text-sm space-y-0.5">
            {conflicts.map((c, i) => <li key={i} className="font-mono">• {c}</li>)}
          </ul>
          <button onClick={() => setConflicts([])} className="mt-2 text-xs text-orange-600 underline">{t('common.dismiss')}</button>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative">
        {leagues.length === 0 && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-xl">
            <div className="text-center p-6 bg-white shadow-lg rounded-lg border border-slate-200">
              <p className="text-slate-600 font-medium mb-2">{t('scheduler.noLeaguesAvailable')}</p>
              <p className="text-sm text-slate-500">{t('scheduler.goToLeagueCreator')}</p>
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg text-green-600">
            <CalIcon size={24} />
          </div>
          <h3 className="text-xl font-semibold text-slate-800">{t('scheduler.configuration')}</h3>
        </div>

        <div className="space-y-6">
          {/* League Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('scheduler.selectLeague')}</label>
            <select
                value={selectedLeagueId}
                onChange={(e) => handleLeagueChange(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
                <option value="">{t('scheduler.chooseLeague')}</option>
                {leagues.map(l => (
                    <option key={l.id} value={l.id}>
                        {l.name}{l.category ? ` - ${l.category}` : ''} ({l.teams.length} teams)
                    </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('scheduler.seasonStartDate')}</label>
                <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('scheduler.gamesPerTeam')}</label>
                <input 
                type="number"
                min="1"
                max="162"
                value={gamesPerTeam}
                onChange={(e) => setGamesPerTeam(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">{t('scheduler.gameFormat')}</label>
             <div className="relative">
                <select 
                    value={doubleHeaderMode}
                    onChange={(e) => {
                        setDoubleHeaderMode(e.target.value as any);
                        // Reset series matchups when switching away from series mode
                        if (e.target.value !== 'series') {
                            setSeriesMatchups([]);
                        }
                    }}
                    className="w-full border border-slate-300 rounded-md p-2 pl-9 focus:ring-2 focus:ring-emerald-500 focus:outline-none appearance-none bg-white"
                >
                    <option value="none">{t('scheduler.singleGame')}</option>
                    <option value="same_day">{t('scheduler.doubleHeader')}</option>
                    <option value="consecutive">{t('scheduler.backToBackSeries')}</option>
                    <option value="series">{t('scheduler.playoffSeries')}</option>
                </select>
                <Layers size={18} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
             </div>
             {doubleHeaderMode === 'consecutive' && (
                 <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-start">
                    <Info size={14} className="mr-1.5 mt-0.5 shrink-0" />
                    <span>{t('scheduler.backToBackNote')}</span>
                 </div>
             )}
             {doubleHeaderMode === 'series' && (() => {
                const selectedLeague = leagues.find(l => l.id === selectedLeagueId);
                const availableTeams = selectedLeague ? selectedLeague.teams : [];
                
                return (
                    <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('scheduler.bestOf')}</label>
                                <select
                                    value={bestOf}
                                    onChange={(e) => setBestOf(Number(e.target.value))}
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                >
                                    <option value={3}>{t('scheduler.bestOf3')}</option>
                                    <option value={5}>{t('scheduler.bestOf5')}</option>
                                    <option value={7}>{t('scheduler.bestOf7')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('scheduler.gameMode')}</label>
                                <select
                                    value={seriesGameMode}
                                    onChange={(e) => setSeriesGameMode(e.target.value as 'alternate' | 'back_to_back')}
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                >
                                    <option value="alternate">{t('scheduler.alternateGames')}</option>
                                    <option value="back_to_back">{t('scheduler.backToBackGames')}</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-slate-700">{t('scheduler.seriesMatchups')}</label>
                                {/* Matchup mode toggle */}
                                {selectedLeagueId && (
                                    <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs font-medium">
                                        <button
                                            onClick={() => { setMatchupMode('manual'); setSeriesMatchups([]); }}
                                            className={`px-2.5 py-1 transition-colors ${matchupMode === 'manual' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {t('scheduler.matchupManual')}
                                        </button>
                                        <button
                                            onClick={() => { setMatchupMode('standings'); setSeriesMatchups([]); }}
                                            className={`px-2.5 py-1 flex items-center gap-1 transition-colors ${matchupMode === 'standings' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <Trophy size={11} />
                                            {t('scheduler.matchupByStandings')}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {selectedLeagueId ? (
                                <div className="space-y-2">
                                    {matchupMode === 'standings' && (
                                        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 flex items-start gap-1.5">
                                            <Trophy size={12} className="mt-0.5 shrink-0" />
                                            <span>{t('scheduler.matchupByStandingsNote')}</span>
                                        </div>
                                    )}
                                    {seriesMatchups.map((matchup, idx) => {
                                        const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
                                        const rankOptions = availableTeams.map((_, i) => ({
                                            value: `${STANDING_PREFIX}${i + 1}`,
                                            label: matchupMode === 'standings' && currentStandings[i]
                                                ? `${ordinals[i] || `#${i+1}`} — ${currentStandings[i].team.city} ${currentStandings[i].team.name} (${currentStandings[i].w}-${currentStandings[i].l})`
                                                : `${ordinals[i] || `#${i+1}`} Place`,
                                        }));
                                        return (
                                            <div key={idx} className="space-y-2 p-2 bg-slate-50 rounded border border-slate-200">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">{t('scheduler.seriesNameLabel')}</label>
                                                    <input
                                                        type="text"
                                                        value={matchup.seriesName || ''}
                                                        onChange={(e) => {
                                                            const newMatchups = [...seriesMatchups];
                                                            newMatchups[idx].seriesName = e.target.value;
                                                            setSeriesMatchups(newMatchups);
                                                        }}
                                                        placeholder={t('scheduler.seriesNameInput')}
                                                        className="w-full border border-slate-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                                        {matchupMode === 'standings' ? (
                                                            <>
                                                                <select
                                                                    value={matchup.team1Id}
                                                                    onChange={(e) => {
                                                                        const newMatchups = [...seriesMatchups];
                                                                        newMatchups[idx].team1Id = e.target.value;
                                                                        setSeriesMatchups(newMatchups);
                                                                    }}
                                                                    className="border border-slate-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                                                >
                                                                    <option value="">{t('scheduler.selectPosition1')}</option>
                                                                    {rankOptions.map(o => (
                                                                        <option key={o.value} value={o.value} disabled={o.value === matchup.team2Id}>{o.label}</option>
                                                                    ))}
                                                                </select>
                                                                <select
                                                                    value={matchup.team2Id}
                                                                    onChange={(e) => {
                                                                        const newMatchups = [...seriesMatchups];
                                                                        newMatchups[idx].team2Id = e.target.value;
                                                                        setSeriesMatchups(newMatchups);
                                                                    }}
                                                                    className="border border-slate-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                                                >
                                                                    <option value="">{t('scheduler.selectPosition2')}</option>
                                                                    {rankOptions.map(o => (
                                                                        <option key={o.value} value={o.value} disabled={o.value === matchup.team1Id}>{o.label}</option>
                                                                    ))}
                                                                </select>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <select
                                                                    value={matchup.team1Id}
                                                                    onChange={(e) => {
                                                                        const newMatchups = [...seriesMatchups];
                                                                        newMatchups[idx].team1Id = e.target.value;
                                                                        setSeriesMatchups(newMatchups);
                                                                    }}
                                                                    className="border border-slate-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                                                >
                                                                    <option value="">{t('scheduler.selectTeam1')}</option>
                                                                    {availableTeams.map(t => (
                                                                        <option key={t.id} value={t.id} disabled={t.id === matchup.team2Id}>
                                                                            {t.city} {t.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <select
                                                                    value={matchup.team2Id}
                                                                    onChange={(e) => {
                                                                        const newMatchups = [...seriesMatchups];
                                                                        newMatchups[idx].team2Id = e.target.value;
                                                                        setSeriesMatchups(newMatchups);
                                                                    }}
                                                                    className="border border-slate-300 rounded-md p-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                                                >
                                                                    <option value="">{t('scheduler.selectTeam2')}</option>
                                                                    {availableTeams.map(t => (
                                                                        <option key={t.id} value={t.id} disabled={t.id === matchup.team1Id}>
                                                                            {t.city} {t.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => setSeriesMatchups(seriesMatchups.filter((_, i) => i !== idx))}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Remove matchup"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <button
                                        onClick={() => setSeriesMatchups([...seriesMatchups, { team1Id: '', team2Id: '', seriesName: '' }])}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                                    >
                                        <Plus size={16} />
                                        {t('scheduler.addSeriesMatchup')}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">{t('scheduler.selectLeagueFirst')}</p>
                            )}
                        </div>
                        
                        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-start">
                            <Info size={14} className="mr-1.5 mt-0.5 shrink-0" />
                            <span>
                                {seriesGameMode === 'alternate' 
                                  ? 'Alternate Games: Games alternate home/away (Game 1 at Team 1, Game 2 at Team 2, etc.).'
                                  : 'Back-to-Back Games: All games are played at Team 1\'s home field on consecutive days.'}
                                {' '}Games are scheduled on consecutive days starting from the selected start day.
                            </span>
                        </div>
                    </div>
                );
             })()}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Allowed Game Days (Series Start)</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {orderedWeekdays.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`
                      px-3 py-1.5 text-xs font-semibold rounded-full border transition-all flex items-center
                      ${isSelected 
                        ? 'bg-emerald-100 border-emerald-200 text-emerald-700 shadow-sm' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {relevantDays.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center space-x-2 mb-2 text-xs font-semibold text-slate-500 uppercase">
                    <Clock size={12} />
                    <span>Start Times {(doubleHeaderMode === 'consecutive' || doubleHeaderMode === 'series') ? '(All Series Days)' : ''}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {relevantDays.map(day => (
                        <div key={day} className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                            <span className="text-sm font-medium text-slate-700">{day}</span>
                            <input 
                                type="time" 
                                value={dayTimes[day]}
                                onChange={(e) => setDayTimes({...dayTimes, [day]: e.target.value})}
                                className="text-sm bg-transparent border-none focus:ring-0 text-right font-mono text-slate-600 cursor-pointer"
                            />
                        </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Replace vs Append toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden mt-4 text-sm font-medium">
            <button
              onClick={() => setAppendMode('replace')}
              className={`flex-1 py-2 transition-colors ${appendMode === 'replace' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {t('scheduler.replaceExisting')}
            </button>
            <button
              onClick={() => setAppendMode('append')}
              className={`flex-1 py-2 transition-colors ${appendMode === 'append' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {t('scheduler.appendToExisting')}
            </button>
          </div>

          <button
            onClick={handleGenerateSchedule}
            disabled={loading || !selectedLeagueId}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all mt-2
              ${loading || !selectedLeagueId
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-emerald-500/30'
              } flex justify-center items-center`}
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" size={18} />}
            {appendMode === 'append' ? t('scheduler.generateAndAppend') : t('scheduler.generateSchedule')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleGenerator;