import React from 'react';
import { Game, Team, League } from '../types';
import { ChevronDown, ChevronUp, Clock, MapPin, Hash, X } from 'lucide-react';
import { formatDate } from '../utils';

interface GameHoldingAreaProps {
  games: Game[];
  teams: Team[];
  leagues: League[];
  onGameMove: (gameId: string, newDate: Date | null) => void;
  onGameRemove: (gameId: string) => void;
  onGameClick: (game: Game) => void;
}

const GameHoldingArea: React.FC<GameHoldingAreaProps> = ({
  games,
  teams,
  leagues,
  onGameMove,
  onGameRemove,
  onGameClick
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

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

  const handleDragStart = (e: React.DragEvent, gameId: string) => {
    e.dataTransfer.setData("gameId", gameId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const gameId = e.dataTransfer.getData("gameId");
    if (gameId) {
      // When dropping into holding area, trigger onGameMove with null date
      // This signals to move the game to holding area
      onGameMove(gameId, null as any);
    }
  };

  return (
    <div className="bg-slate-100 border border-slate-300 rounded-lg shadow-sm mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-200 transition-colors rounded-t-lg"
      >
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-700">Games in Edit Mode</span>
          {games.length > 0 && (
            <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full">
              {games.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={20} className="text-slate-600" />
        ) : (
          <ChevronDown size={20} className="text-slate-600" />
        )}
      </button>

      {isExpanded && (
        <div
          className="p-2 min-h-[60px] overflow-hidden"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {games.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <p>No games in edit mode</p>
              <p className="text-xs mt-1">Drag games here or use the "Move to Holding Area" button</p>
            </div>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2" style={{ width: '100%' }}>
            {games.map(game => {
              const home = getTeam(game.homeTeamId);
              const away = getTeam(game.awayTeamId);
              const gameLeagues = getGameLeagues(game);

              if (!home || !away) return null;

              return (
              <div
                key={game.id}
                draggable
                onDragStart={(e) => handleDragStart(e, game.id)}
                onClick={() => onGameClick(game)}
                className="bg-white border border-slate-300 rounded p-1.5 shadow-sm hover:shadow-md transition-shadow cursor-move group shrink-0 relative"
                style={{ width: '200px', flexShrink: 0 }}
              >
                {/* Row 1: League/Series, Teams, Remove button */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center space-x-1 flex-1 min-w-0">
                    {/* League & Game Number */}
                    {(game.seriesName || gameLeagues.length > 0 || game.gameNumber) && (
                      <div className="flex items-center space-x-1 text-[10px] text-slate-500 shrink-0">
                        {game.seriesName && (
                          <span className="bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-semibold">
                            {game.seriesName}
                          </span>
                        )}
                        {gameLeagues.length > 0 && (
                          <span className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">
                            {gameLeagues[0].shortName || gameLeagues[0].name}
                          </span>
                        )}
                        {game.gameNumber && (
                          <span className="text-indigo-500">#{game.gameNumber}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Teams */}
                    <div className="flex items-center space-x-1 flex-1 min-w-0">
                      {away.logoUrl ? (
                        <img
                          src={away.logoUrl}
                          alt={away.abbreviation}
                          className="w-4 h-4 object-contain shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded shrink-0" style={{ display: away.logoUrl ? 'none' : 'block' }}>
                        {away.abbreviation}
                      </span>
                      <span className="text-xs font-bold text-slate-600 shrink-0">@</span>
                      {home.logoUrl ? (
                        <img
                          src={home.logoUrl}
                          alt={home.abbreviation}
                          className="w-4 h-4 object-contain shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded shrink-0" style={{ display: home.logoUrl ? 'none' : 'block' }}>
                        {home.abbreviation}
                      </span>
                    </div>
                  </div>
                  
                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGameRemove(game.id);
                    }}
                    className="p-0.5 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remove from holding area"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Row 2: Date, Time, Location */}
                <div className="flex items-center space-x-1.5 text-[10px] text-slate-600">
                  <Clock size={10} />
                  <span>{game.time}</span>
                  <MapPin size={10} />
                  <span className="truncate max-w-[100px]">{game.location}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-[9px]">{game.date}</span>
                </div>
              </div>
              );
            })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GameHoldingArea;

