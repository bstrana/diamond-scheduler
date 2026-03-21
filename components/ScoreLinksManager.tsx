import React, { useEffect, useState, useCallback } from 'react';
import { Link2, Copy, Check, Ban, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { ScoreLink, Game, Team, League } from '../types';
import * as storageApi from '../services/storage';

interface ScoreLinksManagerProps {
  scheduleKey: string;
  games: Game[];
  teams: Team[];
  leagues: League[];
  userId?: string;
  orgId?: string;
}

function hoursLeft(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
}

function scoreEditUrl(token: string): string {
  return `${window.location.origin}/score-edit.html?token=${token}`;
}

function gameLabel(game: Game, teams: Team[]): string {
  const home = teams.find(t => t.id === game.homeTeamId);
  const away = teams.find(t => t.id === game.awayTeamId);
  const homeName = home ? `${home.city} ${home.name}` : 'Home';
  const awayName = away ? `${away.city} ${away.name}` : 'Away';
  return `${awayName} @ ${homeName}`;
}

const ScoreLinksManager: React.FC<ScoreLinksManagerProps> = ({
  scheduleKey,
  games,
  teams,
  leagues,
  userId,
  orgId,
}) => {
  const [links, setLinks]           = useState<ScoreLink[]>([]);
  const [loading, setLoading]       = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [disabling, setDisabling]   = useState<string | null>(null);

  // flatten all teams from leagues + prop
  const allTeams: Team[] = React.useMemo(() => {
    const map = new Map<string, Team>(teams.map(t => [t.id, t]));
    leagues.forEach(l => l.teams.forEach(t => map.set(t.id, t)));
    return Array.from(map.values());
  }, [teams, leagues]);

  const load = useCallback(async () => {
    setLoading(true);
    const items = await storageApi.listScoreLinks({ userId, orgId }, scheduleKey || undefined);
    setLinks(items);
    setLoading(false);
  }, [scheduleKey, userId, orgId]);

  useEffect(() => { load(); }, [load]);

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(scoreEditUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch { /* ignore */ }
  };

  const handleDisable = async (link: ScoreLink) => {
    if (!link.id) return;
    setDisabling(link.id);
    await storageApi.updateScoreLink(link.id, { disabled: true });
    setLinks(prev => prev.map(l => l.id === link.id ? { ...l, disabled: true } : l));
    setDisabling(null);
  };

  // separate active vs disabled/expired
  const now = new Date();
  const active   = links.filter(l => !l.disabled && new Date(l.expiresAt) > now);
  const inactive = links.filter(l => l.disabled || new Date(l.expiresAt) <= now);

  if (!scheduleKey) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">No published schedule loaded</p>
            <p className="text-sm text-amber-700 mt-1">Load or publish a schedule first — score links are tied to a specific published schedule key.</p>
          </div>
        </div>
      </div>
    );
  }

  const renderLink = (link: ScoreLink, isActive: boolean) => {
    const game = games.find(g => g.id === link.gameId);
    const label = game ? gameLabel(game, allTeams) : `Game ${link.gameId.slice(0, 8)}…`;
    const gameDate = game?.date || '';
    const expires = hoursLeft(link.expiresAt);
    const isCopied = copiedToken === link.token;
    const url = scoreEditUrl(link.token);

    return (
      <div
        key={link.id || link.token}
        className={`border rounded-xl p-4 space-y-2 ${isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{label}</p>
            {gameDate && <p className="text-xs text-slate-500">{gameDate}{game?.time ? ` · ${game.time}` : ''}{game?.gameNumber ? ` · #${game.gameNumber}` : ''}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isActive ? (
              <>
                <button
                  onClick={() => handleCopy(link.token)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  {isCopied ? <Check size={13} /> : <Copy size={13} />}
                  {isCopied ? 'Copied' : 'Copy link'}
                </button>
                <button
                  onClick={() => handleDisable(link)}
                  disabled={disabling === link.id}
                  title="Disable this link"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <Ban size={15} />
                </button>
              </>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                {link.disabled ? 'Disabled' : 'Expired'}
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock size={12} />
            <span>Expires in {expires}h</span>
            <span className="text-slate-300">·</span>
            <span className="font-mono truncate text-slate-400 max-w-[200px]">{url.replace(window.location.origin, '')}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-xl text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link2 size={22} />
            <div>
              <h2 className="text-2xl font-bold">Score Links</h2>
              <p className="text-indigo-100 text-sm mt-0.5">Expiring links that allow outside users to enter scores</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="mt-3 text-xs text-indigo-200">
          Schedule: <span className="font-mono font-semibold text-white">{scheduleKey}</span>
          {' · '}{active.length} active link{active.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">How score links work</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 text-xs">
          <li>Each link gives access to the score-entry form for one game — no login required.</li>
          <li>Links expire after 48 hours. Generate new ones when needed.</li>
          <li>Submissions are stored as a separate overlay. Use <strong>Sync Remote Scores</strong> in the calendar to absorb them into your local schedule.</li>
          <li>Disable a link at any time to immediately revoke access.</li>
        </ul>
      </div>

      {/* Active links */}
      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
      ) : active.length === 0 ? (
        <div className="text-center py-10 text-slate-400 space-y-2">
          <Link2 size={32} className="mx-auto opacity-30" />
          <p className="text-sm">No active links.</p>
          <p className="text-xs">Generate links from the game edit modal or by selecting games in the calendar list view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Active ({active.length})</h3>
          {active.map(l => renderLink(l, true))}
        </div>
      )}

      {/* Inactive / expired */}
      {inactive.length > 0 && (
        <details className="group">
          <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-600 select-none list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            Expired / disabled ({inactive.length})
          </summary>
          <div className="mt-3 space-y-2">
            {inactive.map(l => renderLink(l, false))}
          </div>
        </details>
      )}
    </div>
  );
};

export default ScoreLinksManager;
