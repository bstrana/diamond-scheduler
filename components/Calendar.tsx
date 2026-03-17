import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Game, Team, CalendarDay, League } from '../types';
import { WEEKDAYS, MONTH_NAMES } from '../constants';
import { ChevronLeft, ChevronRight, MapPin, Grid, List, Filter, Copy, Maximize, Minimize, Hash, Trash2, Edit, PlusCircle } from 'lucide-react';
import { formatDate } from '../utils';

interface CalendarProps {
  currentDate: Date;
  days: CalendarDay[];
  filteredGames: Game[]; // Full list of filtered games for List View
  teams: Team[];
  leagues?: League[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGameClick: (game: Game) => void;
  onDateClick: (date: Date) => void;
  onGameMove: (gameId: string, newDate: Date) => void;
  onGameCopy: (game: Game) => void;
  onDeleteGame: (gameId: string) => void;
  onAddToHoldingArea?: (gameId: string) => void;
  onRemoveAllGames?: () => void;
  onAddGame?: () => void;
  // New Props
  viewType: 'grid' | 'list';
  onViewTypeChange: (type: 'grid' | 'list') => void;
  selectedTeamId: string;
  onTeamFilterChange: (id: string) => void;
  selectedLeagueId: string;
  onLeagueFilterChange: (id: string) => void;
  selectedCategory: string;
  onCategoryFilterChange: (category: string) => void;
  hideLeagueFilter?: boolean;
  hideCategoryFilter?: boolean;
  hideTeamFilter?: boolean;
}

const Calendar: React.FC<CalendarProps> = ({ 
  currentDate, 
  days,
  filteredGames,
  teams, 
  leagues = [],
  onPrevMonth, 
  onNextMonth,
  onGameClick,
  onDateClick,
  onGameMove,
  onGameCopy,
  onDeleteGame,
  onAddToHoldingArea,
  onRemoveAllGames,
  onAddGame,
  viewType,
  onViewTypeChange,
  selectedTeamId,
  onTeamFilterChange,
  selectedLeagueId,
  onLeagueFilterChange,
  selectedCategory,
  onCategoryFilterChange,
  hideLeagueFilter = false,
  hideCategoryFilter = false,
  hideTeamFilter = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const getTeam = (id: string) => teams.find(t => t.id === id);
  const getLeague = (id?: string) => leagues.find(l => l.id === id);
  
  // Helper to get league IDs from a game (handles both old and new format)
  const getGameLeagueIds = (game: Game): string[] => {
    if (game.leagueIds && game.leagueIds.length > 0) {
      return game.leagueIds;
    }
    if (game.leagueId) {
      return [game.leagueId];
    }
    return [];
  };
  
  // Helper to get leagues for a game
  const getGameLeagues = (game: Game): League[] => {
    const leagueIds = getGameLeagueIds(game);
    return leagueIds.map(id => getLeague(id)).filter(Boolean) as League[];
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleDragStart = (e: React.DragEvent, gameId: string) => {
    e.dataTransfer.setData("gameId", gameId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const gameId = e.dataTransfer.getData("gameId");
    if (gameId) {
        onGameMove(gameId, date);
    }
  };

  // Logic for List View: Upcoming games from today onwards
  const upcomingGames = useMemo(() => {
    const todayStr = formatDate(new Date());
    return filteredGames
      .filter(g => g.date >= todayStr)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
  }, [filteredGames]);

  // Group upcoming games by date for the list view
  const gamesByDate = useMemo(() => {
    const groups: { [key: string]: Game[] } = {};
    upcomingGames.forEach(g => {
        if (!groups[g.date]) groups[g.date] = [];
        groups[g.date].push(g);
    });
    return groups;
  }, [upcomingGames]);

  return (
    <div 
      ref={containerRef}
      className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between p-4 border-b border-slate-200 bg-slate-50 gap-4 shrink-0">
        
        {/* Month Navigation (Only for Grid) */}
        {viewType === 'grid' ? (
             <div className="flex items-center space-x-4">
                <div className="flex space-x-1">
                    <button onClick={onPrevMonth} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"><ChevronLeft size={18} /></button>
                    <button onClick={onNextMonth} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"><ChevronRight size={18} /></button>
                </div>
                <h2 className="text-xl font-bold text-slate-800">
                    {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
            </div>
        ) : (
            <h2 className="text-xl font-bold text-slate-800">Upcoming Schedule</h2>
        )}

        {/* Controls */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end flex-wrap gap-2">
            
            {/* League Filter */}
            {leagues.length > 0 && !hideLeagueFilter && (
                <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5">
                    <Filter size={16} className="text-slate-400" />
                    <select 
                        value={selectedLeagueId}
                        onChange={(e) => onLeagueFilterChange(e.target.value)}
                        className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
                    >
                        <option value="all">All Leagues</option>
                        <option disabled>──────────</option>
                        {leagues.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Category Filter */}
            {!hideCategoryFilter && leagues.length > 0 && (() => {
                const categories = Array.from(new Set(leagues.map(l => l.category).filter(Boolean)));
                return categories.length > 0 ? (
                    <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5">
                        <Filter size={16} className="text-slate-400" />
                        <select 
                            value={selectedCategory}
                            onChange={(e) => onCategoryFilterChange(e.target.value)}
                            className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
                        >
                            <option value="all">All Categories</option>
                            <option disabled>──────────</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                ) : null;
            })()}
            
            {/* Team Filter */}
            {!hideTeamFilter && (
            <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5">
                <Filter size={16} className="text-slate-400" />
                <select 
                    value={selectedTeamId}
                    onChange={(e) => onTeamFilterChange(e.target.value)}
                    className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
                >
                    <option value="all">All Teams</option>
                    <option disabled>──────────</option>
                    {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.city} {t.name}</option>
                    ))}
                </select>
            </div>
            )}

            {/* View Toggle */}
            <div className="flex bg-slate-200 p-1 rounded-lg">
                <button 
                    onClick={() => onViewTypeChange('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewType === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    title="Calendar View"
                >
                    <Grid size={18} />
                </button>
                <button 
                    onClick={() => onViewTypeChange('list')}
                    className={`p-1.5 rounded-md transition-all ${viewType === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    title="List View"
                >
                    <List size={18} />
                </button>
            </div>

            {/* Full Screen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>

            {/* Add Game */}
            {onAddGame && (
              <button
                onClick={onAddGame}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                title="Add Game"
              >
                <PlusCircle size={16} />
                <span>Add Game</span>
              </button>
            )}

            {/* Remove All Games */}
            {onRemoveAllGames && (
              <button
                onClick={onRemoveAllGames}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove All Games from Schedule"
              >
                <Trash2 size={20} />
              </button>
            )}
        </div>
      </div>

      {/* View Content */}
      {viewType === 'grid' ? (
          <>
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100 shrink-0">
                {WEEKDAYS.map(day => (
                <div key={day} className="py-2 text-center text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    {day}
                </div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-200 gap-px overflow-y-auto">
                {days.map((day, idx) => (
                <div 
                    key={idx} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day.date)}
                    className={`min-h-[120px] bg-white p-2 flex flex-col group relative transition-colors ${
                    !day.isCurrentMonth ? 'bg-slate-50 text-slate-400' : 'text-slate-800'
                    } ${day.isToday ? 'bg-blue-50/50' : ''} hover:bg-slate-50`}
                    onClick={() => onDateClick(day.date)}
                >
                    <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full ${day.isToday ? 'bg-blue-600 text-white' : ''}`}>
                        {day.date.getDate()}
                    </span>
                    <button className="opacity-0 group-hover:opacity-100 text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600">
                        + Add
                    </button>
                    </div>

                    <div className="space-y-1 overflow-y-auto max-h-[140px] custom-scrollbar">
                    {day.games.map(game => {
                        const home = getTeam(game.homeTeamId);
                        const away = getTeam(game.awayTeamId);
                        const gameLeagues = getGameLeagues(game);
                        
                        if (!home || !away) return null;

                        // When a single team is selected, show only the opponent
                        const isSingleTeamFilter = selectedTeamId !== 'all';
                        let opponent: Team | null = null;
                        let isSelectedTeamHome = false;
                        let isSelectedTeamAway = false;
                        
                        if (isSingleTeamFilter) {
                            if (game.homeTeamId === selectedTeamId) {
                                opponent = away;
                                isSelectedTeamHome = true;
                            } else if (game.awayTeamId === selectedTeamId) {
                                opponent = home;
                                isSelectedTeamAway = true;
                            }
                        }

                        return (
                        <div 
                            key={game.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, game.id)}
                            onClick={(e) => { e.stopPropagation(); onGameClick(game); }}
                            className="text-xs p-1.5 rounded border border-slate-100 hover:border-blue-300 hover:bg-blue-50 cursor-grab active:cursor-grabbing shadow-sm transition-all bg-white relative group/game"
                        >
                            <div className="absolute top-0.5 right-0.5 flex space-x-1 opacity-0 group-hover/game:opacity-100 transition-opacity z-10">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onGameClick(game); }}
                                    className="p-1 bg-white/90 border border-slate-200 shadow-sm rounded text-slate-400 hover:text-blue-600"
                                    title="Edit Game"
                                >
                                    <Edit size={10} />
                                </button>
                                {onAddToHoldingArea && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onAddToHoldingArea(game.id); }}
                                        className="p-1 bg-white/90 border border-slate-200 shadow-sm rounded text-slate-400 hover:text-amber-600"
                                        title="Move to Holding Area"
                                    >
                                        <Minimize size={10} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onGameCopy(game); }}
                                    className="p-1 bg-white/90 border border-slate-200 shadow-sm rounded text-slate-400 hover:text-indigo-600"
                                    title="Copy Game"
                                >
                                    <Copy size={10} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteGame(game.id); }}
                                    className="p-1 bg-white/90 border border-slate-200 shadow-sm rounded text-slate-400 hover:text-red-600"
                                    title="Delete Game"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>

                            {/* Series Name, League Info & Game Number */}
                            {(game.seriesName || gameLeagues.length > 0 || game.gameNumber) && (
                                <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-50 text-[9px] text-slate-400">
                                    <span className="truncate max-w-[60px]">
                                        {game.seriesName && (
                                            <span className="font-semibold text-indigo-600">{game.seriesName}</span>
                                        )}
                                        {game.seriesName && gameLeagues.length > 0 && <span className="mx-1">•</span>}
                                        {gameLeagues.length > 0 
                                          ? gameLeagues.map(l => l.category || l.name).join(', ')
                                          : ''}
                                    </span>
                                    {game.gameNumber && <span>#{game.gameNumber}</span>}
                                </div>
                            )}

                            {/* Main Content: Teams on left, Time/Location on right */}
                            <div className="flex items-start justify-between gap-2">
                                {/* Teams - Show only opponent if single team filter, otherwise show both */}
                                {isSingleTeamFilter && opponent ? (
                                    <div className="flex items-center space-x-1.5 w-full justify-center flex-1 min-w-0" title={`${opponent.city} ${opponent.name}`}>
                                        <span className="text-base text-slate-400 font-bold">
                                            {isSelectedTeamAway ? '@' : 'vs'}
                                        </span>
                                        <span className="font-bold text-xs" style={{color: opponent.primaryColor}}>{opponent.abbreviation}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-1.5 flex-1 min-w-0 justify-center">
                                        {/* Away Team */}
                                        <div className="flex items-center space-x-1" title={`${away.city} ${away.name}`}>
                                            <span className="font-bold text-xs" style={{color: away.primaryColor}}>{away.abbreviation}</span>
                                        </div>
                                        <span className="text-base text-slate-400 font-bold">@</span>
                                        {/* Home Team */}
                                        <div className="flex items-center space-x-1" title={`${home.city} ${home.name}`}>
                                            <span className="font-bold text-xs" style={{color: home.primaryColor}}>{home.abbreviation}</span>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Time and Location - Stacked Vertically on Right */}
                                <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-500 font-medium">{game.time}</span>
                                {game.status !== 'scheduled' && (
                                    <span className={`text-[8px] px-1 py-0.5 rounded uppercase font-bold tracking-wider leading-none
                                    ${game.status === 'completed' ? 'bg-slate-200 text-slate-600' : ''}
                                    ${game.status === 'in-progress' ? 'bg-emerald-100 text-emerald-700 animate-pulse' : ''}
                                    ${game.status === 'postponed' ? 'bg-orange-100 text-orange-700' : ''}
                                    `}>
                                    {game.status === 'in-progress' ? 'LIVE' : game.status === 'postponed' ? 'PPD' : 'FIN'}
                                    </span>
                                )}
                            </div>
                                    <div className="flex items-center text-[9px] text-slate-400">
                                        <MapPin size={8} className="mr-0.5 flex-shrink-0" />
                                        <span className="truncate max-w-[60px]">{game.location}</span>
                                </div>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                    </div>
                </div>
                ))}
            </div>
          </>
      ) : (
          /* List View */
          <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6">
              {Object.keys(gamesByDate).length === 0 ? (
                  <div className="text-center py-20 opacity-50">
                      <p className="text-xl font-medium">No upcoming games scheduled.</p>
                      <p className="text-sm">Try changing the filter or generating a new schedule.</p>
                  </div>
              ) : (
                  Object.keys(gamesByDate).sort().map(dateStr => (
                      <div key={dateStr}>
                          <div className="flex items-center space-x-4 mb-3 sticky top-0 bg-slate-50 py-2 z-10">
                              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                                  {new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                              </h3>
                              <div className="h-px bg-slate-200 flex-1"></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {gamesByDate[dateStr]
                                .sort((a, b) => a.time.localeCompare(b.time))
                                .map(game => {
                                  const home = getTeam(game.homeTeamId);
                                  const away = getTeam(game.awayTeamId);
                                  const gameLeagues = getGameLeagues(game);

                                  if (!home || !away) return null;
                                  
                                  // When a single team is selected, show only the opponent
                                  const isSingleTeamFilter = selectedTeamId !== 'all';
                                  let opponent: Team | null = null;
                                  let isSelectedTeamHome = false;
                                  let isSelectedTeamAway = false;
                                  
                                  if (isSingleTeamFilter) {
                                      if (game.homeTeamId === selectedTeamId) {
                                          opponent = away;
                                          isSelectedTeamHome = true;
                                      } else if (game.awayTeamId === selectedTeamId) {
                                          opponent = home;
                                          isSelectedTeamAway = true;
                                      }
                                  }
                                  
                                  // Get league logo from first league if available
                                  const leagueLogo = gameLeagues.length > 0 && gameLeagues[0].logoUrl 
                                    ? gameLeagues[0].logoUrl 
                                    : null;

                                  return (
                                    <div 
                                        key={game.id}
                                        onClick={() => onGameClick(game)}
                                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group overflow-hidden"
                                    >
                                        {/* League logo in bottom right as background */}
                                        {leagueLogo && (
                                          <div 
                                            className="absolute bottom-0 right-0 w-24 h-24 opacity-10 z-0"
                                            style={{
                                              backgroundImage: `url(${leagueLogo})`,
                                              backgroundSize: 'contain',
                                              backgroundPosition: 'bottom right',
                                              backgroundRepeat: 'no-repeat'
                                            }}
                                          ></div>
                                        )}
                                        
                                        {/* Content wrapper with relative positioning */}
                                        <div className="relative z-10">
                                        {/* Time in top right corner */}
                                        <div className="absolute top-4 right-4 text-lg font-bold text-slate-800">
                                            {game.time}
                                        </div>

                                        <div>
                                            {/* Series Name, League & Meta Info */}
                                            {(game.seriesName || gameLeagues.length > 0 || game.gameNumber) && (
                                                <div className="flex items-center space-x-2 mb-2 text-xs text-slate-400 font-medium uppercase tracking-wide flex-wrap">
                                                    {game.seriesName && (
                                                        <span className="px-2 py-0.5 rounded font-semibold bg-indigo-100 text-indigo-700">{game.seriesName}</span>
                                                    )}
                                                    {game.seriesName && gameLeagues.length > 0 && <span className="text-slate-300">|</span>}
                                                    {gameLeagues.map((league, idx) => (
                                                        <React.Fragment key={league.id}>
                                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{league.shortName || league.name}</span>
                                                            {league.category && <span>• {league.category}</span>}
                                                            {idx < gameLeagues.length - 1 && <span className="text-slate-300">|</span>}
                                                        </React.Fragment>
                                                    ))}
                                                    {game.gameNumber && (
                                                        <span className="flex items-center text-indigo-500">
                                                            <Hash size={10} className="mr-0.5"/> {game.gameNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* Show only opponent if single team filter, otherwise show both teams */}
                                            {isSingleTeamFilter && opponent ? (
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-slate-400 font-bold text-lg">
                                                        {isSelectedTeamAway ? '@' : 'vs'}
                                                    </span>
                                                    {opponent.logoUrl ? (
                                                        <img src={opponent.logoUrl} alt={`${opponent.name} logo`} className="w-12 h-12 object-contain" onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const parent = e.currentTarget.parentElement;
                                                            if (parent) {
                                                                const span = document.createElement('span');
                                                                span.className = 'text-3xl';
                                                                span.textContent = '⚾';
                                                                parent.insertBefore(span, e.currentTarget.nextSibling);
                                                            }
                                                        }} />
                                                    ) : (
                                                        <span className="text-3xl">⚾</span>
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-base" style={{color: opponent.primaryColor}}>{opponent.abbreviation}</span>
                                                        <span className="text-xs text-slate-500">{opponent.city}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-start space-y-2">
                                                    {/* Away Team */}
                                                    <div className="flex items-center space-x-3">
                                                        {away.logoUrl ? (
                                                            <img src={away.logoUrl} alt={`${away.name} logo`} className="w-12 h-12 object-contain" onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                const parent = e.currentTarget.parentElement;
                                                                if (parent) {
                                                                    const span = document.createElement('span');
                                                                    span.className = 'text-3xl';
                                                                    span.textContent = '⚾';
                                                                    parent.insertBefore(span, e.currentTarget.nextSibling);
                                                                }
                                                            }} />
                                                        ) : (
                                                            <span className="text-3xl">⚾</span>
                                                        )}
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-base" style={{color: away.primaryColor}}>{away.abbreviation}</span>
                                                            <span className="text-xs text-slate-500">{away.city}</span>
                                                        </div>
                                                    </div>
                                                    {/* Home Team */}
                                                    <div className="flex items-center space-x-3">
                                                        {home.logoUrl ? (
                                                            <img src={home.logoUrl} alt={`${home.name} logo`} className="w-12 h-12 object-contain" onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                const parent = e.currentTarget.parentElement;
                                                                if (parent) {
                                                                    const span = document.createElement('span');
                                                                    span.className = 'text-3xl';
                                                                    span.textContent = '⚾';
                                                                    parent.insertBefore(span, e.currentTarget.nextSibling);
                                                                }
                                                            }} />
                                                        ) : (
                                                            <span className="text-3xl">⚾</span>
                                                        )}
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-base" style={{color: home.primaryColor}}>{home.abbreviation}</span>
                                                            <span className="text-xs text-slate-500">{home.city}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Location below teams */}
                                            <div className="text-xs text-slate-500 flex items-center justify-center mt-2">
                                                <MapPin size={10} className="mr-1" />
                                                {game.location}
                                            </div>
                                        </div>
                                        </div>
                                    </div>
                                  );
                              })}
                          </div>
                      </div>
                  ))
              )}
          </div>
      )}
    </div>
  );
};

export default Calendar;