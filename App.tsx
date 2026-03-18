import React, { useState, useEffect, useRef } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { Team, Game, ViewMode, League } from './types';
import { getMonthDays, formatDate, generateUUID } from './utils';
import * as storageApi from './services/storage';
import Calendar from './components/Calendar';
import GameHoldingArea from './components/GameHoldingArea';
import TeamList from './components/TeamList';
import {
  Calendar as CalendarIcon,
  Users,
  Trophy,
  PlusCircle,
  Code,
  Trash2,
  UserCircle,
  ChevronDown,
  LogOut,
  Send,
  X,
  Copy,
  Check,
  Clock,
  HelpCircle,
  Moon,
  Sun,
  GitBranch
} from 'lucide-react';
import LeagueBuilder from './components/LeagueBuilder';
import ScheduleGenerator from './components/ScheduleGenerator';
import EmbedCodeGenerator from './components/EmbedCodeGenerator';
import HelpPage from './components/HelpPage';
import PlayoffBracket from './components/PlayoffBracket';

const App: React.FC = () => {
  const { keycloak, initialized } = useKeycloak();
  const [authTimeout, setAuthTimeout] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [publishedSchedules, setPublishedSchedules] = useState<{ id: string; scheduleKey: string; scheduleName?: string; active: boolean }[]>([]);
  const [scheduleKey, setScheduleKey] = useState('');
  const [scheduleName, setScheduleName] = useState('');
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [scheduleLeagueId, setScheduleLeagueId] = useState<string>('');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishKeyDraft, setPublishKeyDraft] = useState('');
  const [publishNameDraft, setPublishNameDraft] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedSubscribeUrl, setCopiedSubscribeUrl] = useState(false);

  const maxLeagues = Number.parseInt(import.meta.env.VITE_LEAGUE_LIMIT || '', 10);
  const maxTeams = Number.parseInt(import.meta.env.VITE_TEAM_LIMT || '', 10);
  const leagueLimit = Number.isFinite(maxLeagues) ? maxLeagues : undefined;
  const teamLimit = Number.isFinite(maxTeams) ? maxTeams : undefined;
  const navMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const keycloakEnv = {
    url: import.meta.env.VITE_KEYCLOAK_URL,
    realm: import.meta.env.VITE_KEYCLOAK_REALM,
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  };
  const missingKeycloakEnv = Object.entries(keycloakEnv)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const userName =
    keycloak.tokenParsed?.preferred_username ||
    keycloak.tokenParsed?.email ||
    'Signed in';
  const userEmail = keycloak.tokenParsed?.email as string | undefined;
  const userDomain = window.location.hostname;
  const realmRoles = (keycloak.tokenParsed as any)?.realm_access?.roles as string[] | undefined;
  const userRole =
    realmRoles?.find((role) => !role.startsWith('default-roles-') && role !== 'offline_access' && role !== 'uma_authorization') ||
    realmRoles?.[0] ||
    'unknown';
  const userId = (keycloak.tokenParsed as any)?.sub as string | undefined;
  const orgId =
    (keycloak.tokenParsed as any)?.org_id ||
    (keycloak.tokenParsed as any)?.organization ||
    (keycloak.tokenParsed as any)?.tenant ||
    (keycloak.tokenParsed as any)?.org;
  const scheduleScopeLabel = orgId
    ? `org:${orgId}`
    : userId
      ? `user:${userId}`
      : 'app only';

  const loadPublishedSchedules = async () => {
    setIsLoadingSchedules(true);
    const items = storageApi.listPublishedSchedules
      ? await storageApi.listPublishedSchedules({ userId, orgId }, { onlyActive: false })
      : [];
    setPublishedSchedules(items);
    setIsLoadingSchedules(false);
  };

  const selectedPublishedSchedule = publishedSchedules.find((item) => item.id === selectedScheduleId);
  const subscriptionUrl = selectedPublishedSchedule
    ? `${window.location.origin}/subscribe.ics?schedule_key=${encodeURIComponent(selectedPublishedSchedule.scheduleKey)}`
    : '';

  const handleLoadSchedule = async () => {
    if (!selectedScheduleId) {
      alert('Select a schedule to load.');
      return;
    }
    const selectedSchedule = publishedSchedules.find((item) => item.id === selectedScheduleId);
    if (!selectedSchedule) {
      alert('Selected schedule not found.');
      return;
    }
    if (!selectedSchedule.active) {
      alert('Only active schedules can be loaded.');
      return;
    }
    if (!storageApi.loadPublishedScheduleById) return;
    const data = await storageApi.loadPublishedScheduleById(selectedScheduleId, { userId, orgId });
    if (!data) {
      alert('Schedule not found or access denied.');
      return;
    }
    setLeagues(data.leagues);
    setTeams(data.teams);
    setGames(data.games);
    setGamesInHoldingArea([]);
    setSelectedLeagueId('all');
    setSelectedCategory('all');
    setSelectedTeamId('all');
    setScheduleLeagueId(data.leagues[0]?.id || '');
    setScheduleKey(selectedSchedule.scheduleKey);
    setScheduleName(selectedSchedule.scheduleName || '');
    setViewMode('calendar');
  };

  const navItems: { mode: ViewMode; label: string; icon: any }[] = [
    { mode: 'league_builder', label: 'League Creator', icon: Trophy },
    { mode: 'scheduler', label: 'Scheduler', icon: Clock },
    { mode: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { mode: 'bracket', label: 'Playoff Bracket', icon: GitBranch },
    { mode: 'embed', label: 'Embed Code', icon: Code }
  ];

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Leagues & Teams State
  const [leagues, setLeagues] = useState<League[]>([]);
  
  // Teams represents the currently active roster being viewed or scheduled
  const [teams, setTeams] = useState<Team[]>([]);

  const [games, setGames] = useState<Game[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  
  // Calendar Specific State
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [calendarView, setCalendarView] = useState<'grid' | 'list'>('grid');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dsa_dark_mode') === '1');
  
  // Game Holding Area State (for games in edit mode)
  const [gamesInHoldingArea, setGamesInHoldingArea] = useState<Game[]>([]);

  // New Game Form State
  const [newGameForm, setNewGameForm] = useState<Partial<Game> & { leagueIds?: string[] }>({
    date: formatDate(new Date()),
    time: '15:00',
    location: 'Main Stadium',
    gameNumber: '',
    leagueIds: []
  });

  // Persistence
  useEffect(() => {
    let isActive = true;
    const hydrate = async () => {
      // Check if user has any published schedules
      const publishedSchedules = await storageApi.listPublishedSchedules({ userId, orgId }, { onlyActive: false });
      const hasPublishedSchedules = publishedSchedules && publishedSchedules.length > 0;
      
      // If no published schedules, clear local storage for teams, leagues, and schedule keys
      if (!hasPublishedSchedules) {
        localStorage.removeItem('dsa_leagues');
        localStorage.removeItem('dsa_teams');
        localStorage.removeItem('dsa_games');
        localStorage.removeItem('dsa_games_holding');
        localStorage.removeItem('dsa_schedule_publish_key');
        localStorage.removeItem('dsa_schedule_publish_name');
      } else {
        // Restore schedule key from localStorage so the Publish button stays enabled after reload
        const savedKey = localStorage.getItem('dsa_schedule_publish_key') || '';
        const savedName = localStorage.getItem('dsa_schedule_publish_name') || '';
        if (savedKey) {
          setScheduleKey(savedKey);
          setScheduleName(savedName);
        }
      }
      
      // Always start with empty data by default
      const data = await storageApi.loadStorageData({
        leagues: [],
        teams: [],
        games: [],
        gamesInHoldingArea: []
      }, { userId, orgId });
      if (!isActive) return;
      setLeagues(data.leagues);
      setTeams(data.teams);
      setGames(data.games);
      setGamesInHoldingArea(data.gamesInHoldingArea);
      setIsHydrated(true);
    };
    hydrate();
    return () => {
      isActive = false;
    };
  }, [userId, orgId]);

  useEffect(() => {
    if (initialized) return;
    const timeoutId = window.setTimeout(() => {
      setAuthTimeout(true);
    }, 10000);
    return () => window.clearTimeout(timeoutId);
  }, [initialized]);

  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  useEffect(() => {
    if (!showUserMenu) return;
    const loadSchedules = async () => {
      await loadPublishedSchedules();
    };
    loadSchedules();
    return () => {};
  }, [showUserMenu, userId, orgId]);

  useEffect(() => {
    if (!showNavMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
        setShowNavMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNavMenu]);

  useEffect(() => {
    if (!isHydrated) return;
    const timeoutId = window.setTimeout(() => {
      storageApi.persistStorageData(
        {
          leagues,
          teams,
          games,
          gamesInHoldingArea
        },
        { userId, orgId }
      );
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [isHydrated, leagues, teams, games, gamesInHoldingArea]);

  // Helper to get league IDs from a game (handles both old and new format)
  const getGameLeagueIds = (game: Game): string[] => {
    if (game.leagueIds && game.leagueIds.length > 0) {
      return game.leagueIds;
    }
    // Backward compatibility: if leagueIds is empty/undefined but leagueId exists
    if (game.leagueId) {
      return [game.leagueId];
    }
    return [];
  };

  // Derived State for Filtering
  const filteredGames = React.useMemo(() => games.filter(g => {
    // Team filter
    if (selectedTeamId !== 'all') {
      if (g.homeTeamId !== selectedTeamId && g.awayTeamId !== selectedTeamId) {
        return false;
      }
    }
    
    // League filter
    if (selectedLeagueId !== 'all') {
      const gameLeagueIds = getGameLeagueIds(g);
      if (!gameLeagueIds.includes(selectedLeagueId)) {
        return false;
      }
    }
    
    // Category filter
    if (selectedCategory !== 'all') {
      const gameLeagueIds = getGameLeagueIds(g);
      const gameLeagues = gameLeagueIds.map(id => leagues.find(l => l.id === id)).filter(Boolean);
      const hasMatchingCategory = gameLeagues.some(l => l && l.category === selectedCategory);
      if (!hasMatchingCategory) {
        return false;
      }
    }
    
    return true;
  }), [games, selectedTeamId, selectedLeagueId, selectedCategory, leagues]);

  // Calendar Helpers (Grid view depends on filtered games)
  const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth(), filteredGames);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Game Move Logic (Drag and Drop)
  const handleGameMove = (gameId: string, newDate: Date | null) => {
    // Check if game is in holding area
    const gameInHolding = gamesInHoldingArea.find(g => g.id === gameId);
    
    if (gameInHolding) {
      // Move from holding area to calendar with new date
      if (newDate) {
        const updatedGame = { ...gameInHolding, date: formatDate(newDate) };
        setGames([...games, updatedGame]);
        setGamesInHoldingArea(gamesInHoldingArea.filter(g => g.id !== gameId));
      }
    } else {
      // Check if moving to holding area (newDate is null)
      if (!newDate) {
        handleAddToHoldingArea(gameId);
      } else {
        // Move within calendar (update date)
        const updatedGames = games.map(g => {
          if (g.id === gameId) {
            return { ...g, date: formatDate(newDate) };
          }
          return g;
        });
        setGames(updatedGames);
      }
    }
  };

  // Add game to holding area
  const handleAddToHoldingArea = (gameId: string) => {
    const game = games.find(g => g.id === gameId);
    if (game) {
      setGamesInHoldingArea([...gamesInHoldingArea, game]);
      setGames(games.filter(g => g.id !== gameId));
    }
  };

  // Remove game from holding area (back to calendar with original date)
  const handleRemoveFromHoldingArea = (gameId: string) => {
    const game = gamesInHoldingArea.find(g => g.id === gameId);
    if (game) {
      setGames([...games, game]);
      setGamesInHoldingArea(gamesInHoldingArea.filter(g => g.id !== gameId));
    }
  };

  // Delete game from holding area
  const handleDeleteFromHoldingArea = (gameId: string) => {
    if (window.confirm("Are you sure you want to delete this game?")) {
      setGamesInHoldingArea(gamesInHoldingArea.filter(g => g.id !== gameId));
    }
  };

  // Game Copy Logic
  const handleGameCopy = (game: Game) => {
    const newGame: Game = {
        ...game,
        id: generateUUID(),
        gameNumber: game.gameNumber
    };
    setGames([...games, newGame]);
  };

  // Game Delete Logic
  const handleDeleteGame = (gameId: string) => {
    if (window.confirm("Are you sure you want to delete this game?")) {
        setGames(games.filter(g => g.id !== gameId));
    }
  };

  // Remove All Games Logic
  const handleRemoveAllGames = () => {
    if (games.length === 0) {
      alert("There are no games to remove.");
      return;
    }
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ALL ${games.length} game(s)?\n\nThis action cannot be undone.`
    );
    
    if (confirmed) {
      setGames([]);
      alert("All games have been removed.");
    }
  };

  const handleGameClick = (game: Game) => {
    setEditingGame(game);
    // Initialize form with game's current values
    const gameLeagueIds = getGameLeagueIds(game);
    setNewGameForm({
      date: game.date,
      time: game.time,
      location: game.location,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      leagueIds: gameLeagueIds,
      gameNumber: game.gameNumber,
      seriesName: game.seriesName
    });
    setShowEditModal(true);
  };

  const handleGameUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;
    
    if (!newGameForm.leagueIds || newGameForm.leagueIds.length === 0) {
      alert("Please select at least one league.");
      return;
    }
    
    const updatedGame: Game = {
      ...editingGame,
      date: newGameForm.date || editingGame.date,
      time: newGameForm.time || editingGame.time,
      location: newGameForm.location || editingGame.location,
      homeTeamId: newGameForm.homeTeamId || editingGame.homeTeamId,
      awayTeamId: newGameForm.awayTeamId || editingGame.awayTeamId,
      leagueIds: newGameForm.leagueIds || getGameLeagueIds(editingGame),
      gameNumber: newGameForm.gameNumber || editingGame.gameNumber,
      seriesName: newGameForm.seriesName !== undefined ? newGameForm.seriesName : editingGame.seriesName,
      status: (newGameForm.status || editingGame.status) as Game['status'],
      scores: newGameForm.scores !== undefined ? newGameForm.scores : editingGame.scores,
      recap: newGameForm.recap !== undefined ? newGameForm.recap : editingGame.recap,
      streamUrl: newGameForm.streamUrl !== undefined ? newGameForm.streamUrl : editingGame.streamUrl,
    };

    if (updatedGame.homeTeamId === updatedGame.awayTeamId) {
      alert("Home and Away teams must be different.");
      return;
    }

    setGames(games.map(g => g.id === editingGame.id ? updatedGame : g));
    setShowEditModal(false);
    setEditingGame(null);
    // Reset form
    setNewGameForm({
      date: formatDate(new Date()),
      time: '15:00',
      location: 'Main Stadium',
      gameNumber: '',
      leagueIds: []
    });
  };

  const handleGameUpdateAndPublish = async () => {
    if (!editingGame) return;

    if (!newGameForm.leagueIds || newGameForm.leagueIds.length === 0) {
      alert("Please select at least one league.");
      return;
    }

    const updatedGame: Game = {
      ...editingGame,
      date: newGameForm.date || editingGame.date,
      time: newGameForm.time || editingGame.time,
      location: newGameForm.location || editingGame.location,
      homeTeamId: newGameForm.homeTeamId || editingGame.homeTeamId,
      awayTeamId: newGameForm.awayTeamId || editingGame.awayTeamId,
      leagueIds: newGameForm.leagueIds || getGameLeagueIds(editingGame),
      gameNumber: newGameForm.gameNumber || editingGame.gameNumber,
      seriesName: newGameForm.seriesName !== undefined ? newGameForm.seriesName : editingGame.seriesName,
      status: (newGameForm.status || editingGame.status) as Game['status'],
      scores: newGameForm.scores !== undefined ? newGameForm.scores : editingGame.scores,
      recap: newGameForm.recap !== undefined ? newGameForm.recap : editingGame.recap,
      streamUrl: newGameForm.streamUrl !== undefined ? newGameForm.streamUrl : editingGame.streamUrl,
    };

    if (updatedGame.homeTeamId === updatedGame.awayTeamId) {
      alert("Home and Away teams must be different.");
      return;
    }

    if (!scheduleKey) {
      alert("No published schedule found. Please publish the schedule first using the Publish button.");
      return;
    }

    const updatedGames = games.map(g => g.id === editingGame.id ? updatedGame : g);
    setGames(updatedGames);
    setShowEditModal(false);
    setEditingGame(null);
    setNewGameForm({ date: formatDate(new Date()), time: '15:00', location: 'Main Stadium', gameNumber: '', leagueIds: [] });

    setIsPublishing(true);
    const result = await storageApi.publishScheduleNow(
      { leagues, teams, games: updatedGames, gamesInHoldingArea },
      { userId, orgId },
      scheduleKey,
      scheduleName
    );
    setIsPublishing(false);
    if (!result.ok) {
      alert(`Publish failed. ${result.reason || 'Check PocketBase URL and rules.'}`);
    }
  };

  const handleDateClick = (date: Date) => {
    if (leagues.length === 0) {
      alert("Please create a league first before scheduling games.");
      return;
    }
    const defaultLeague = leagues.find(l => l.teams.some(t => t.id === teams[0]?.id)) || leagues[0];
    setNewGameForm({
        date: formatDate(date),
        time: '15:00',
        location: 'Main Stadium',
        leagueIds: defaultLeague ? [defaultLeague.id] : [],
        gameNumber: ''
    });
    setShowAddModal(true);
  };

  const handleAddGameClick = () => {
    if (leagues.length === 0) {
        alert("Please create a league first before adding games.");
        return;
    }
    const defaultLeague = leagues.find(l => l.teams.some(t => t.id === teams[0]?.id)) || leagues[0];
    setNewGameForm({
        date: formatDate(new Date()),
        time: '15:00',
        location: 'Main Stadium',
        leagueIds: defaultLeague ? [defaultLeague.id] : [],
        gameNumber: ''
    });
    setShowAddModal(true);
  };

  const handleAddGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameForm.leagueIds || newGameForm.leagueIds.length === 0) {
        alert("Please select at least one league.");
        return;
    }
    if (!newGameForm.homeTeamId || !newGameForm.awayTeamId) {
        alert("Please select both a home team and an away team.");
        return;
    }
    if (!newGameForm.date) {
        alert("Please select a date.");
        return;
    }
    if(newGameForm.homeTeamId === newGameForm.awayTeamId) {
        alert("Home and Away teams must be different.");
        return;
    }
    const game: Game = {
        id: generateUUID(),
        homeTeamId: newGameForm.homeTeamId,
        awayTeamId: newGameForm.awayTeamId,
        date: newGameForm.date,
        time: newGameForm.time || '15:00',
        location: newGameForm.location || 'Stadium',
        status: 'scheduled',
        leagueIds: newGameForm.leagueIds,
        gameNumber: newGameForm.gameNumber
    };
    setGames([...games, game]);
    setShowAddModal(false);
  };

  // Team Logic
  const handleUpdateTeam = (updatedTeam: Team) => {
    setTeams(teams.map(t => t.id === updatedTeam.id ? updatedTeam : t));
  };

  // League Handlers
  const handleLeagueCreated = (league: League) => {
      if (leagueLimit && leagues.length >= leagueLimit) {
        alert(`League limit reached (${leagueLimit}).`);
        return;
      }
      setLeagues([...leagues, league]);
      // Automatically switch to this league's teams
      setTeams(league.teams);
      setGames([]); // Clear games when switching to a fresh league context
      alert(`League "${league.name}" created! You can now generate a schedule for it.`);
      setViewMode('scheduler');
  };

  const handleLeagueUpdated = (updatedLeague: League) => {
    setLeagues(leagues.map(l => l.id === updatedLeague.id ? updatedLeague : l));
    // If the active roster belongs to this league, update it immediately
    const isActiveLeague = teams.length > 0 && updatedLeague.teams.some(t => t.id === teams[0].id);
    if (isActiveLeague) {
        setTeams(updatedLeague.teams);
    }
    alert(`League "${updatedLeague.name}" updated successfully.`);
  };

  const handleLeagueDeleted = (leagueId: string) => {
    const leagueToDelete = leagues.find(l => l.id === leagueId);
    const updatedLeagues = leagues.filter(l => l.id !== leagueId);
    setLeagues(updatedLeagues);

    const isActiveLeague = teams.length > 0 && leagueToDelete?.teams.some(t => t.id === teams[0].id);
    if (isActiveLeague) {
      setTeams([]);
      setGames([]);
      setViewMode('league_builder');
    }

    const updatedGames = games.filter(g => {
      const gameLeagueIds = g.leagueIds && g.leagueIds.length > 0
        ? g.leagueIds
        : g.leagueId
          ? [g.leagueId]
          : [];
      return !gameLeagueIds.includes(leagueId);
    });
    setGames(updatedGames);

    if (selectedLeagueId === leagueId) {
      setSelectedLeagueId('all');
    }
    if (scheduleLeagueId === leagueId) {
      setScheduleLeagueId('');
    }

    if (leagueToDelete) {
      alert(`League "${leagueToDelete.name}" deleted.`);
    }
  };

  const handleLeagueSelectedForSchedule = (leagueId: string) => {
      const league = leagues.find(l => l.id === leagueId);
      if (league) {
          setTeams(league.teams);
      }
      setScheduleLeagueId(leagueId);
  };

  // Filter teams for manual add modal based on selected leagues
  const formLeagues = newGameForm.leagueIds
    ? leagues.filter(l => newGameForm.leagueIds!.includes(l.id))
    : [];
  const formTeams = formLeagues.length > 0
    ? Array.from(new Map(formLeagues.flatMap(l => l.teams).map(t => [t.id, t])).values())
    : [];
  const formFields = Array.from(new Set(formLeagues.flatMap(l => l.fields || [])));

  // All teams across all leagues (used by Calendar so games from any league render correctly)
  const allTeams = React.useMemo(() => {
    const leagueTeams = leagues.flatMap(l => l.teams || []);
    const merged = [...teams, ...leagueTeams];
    return Array.from(new Map(merged.map(t => [t.id, t])).values());
  }, [teams, leagues]);

  if (missingKeycloakEnv.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-8 text-center max-w-md">
          <h1 className="text-xl font-semibold text-slate-800">Keycloak config missing</h1>
          <p className="text-sm text-slate-600 mt-2">
            Set the missing environment variables in `.env.local`, then restart the dev server.
          </p>
          <div className="mt-4 text-left text-sm text-slate-700 space-y-1">
            {missingKeycloakEnv.map((envKey) => (
              <div key={envKey}>{envKey}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-center">
          <div>Loading authentication...</div>
          {authTimeout && (
            <div className="mt-3 text-sm text-slate-500">
              Taking longer than expected. Check that the Keycloak URL is reachable and
              the realm/client are correct, then refresh the page.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!keycloak.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-8 text-center max-w-sm">
          <h1 className="text-xl font-semibold text-slate-800">Sign in required</h1>
          <p className="text-sm text-slate-600 mt-2">
            Please sign in with your Keycloak account to continue.
          </p>
          <button
            className="mt-6 bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700 text-sm font-medium"
            onClick={() => keycloak.login()}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('dsa_dark_mode', next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0">
            <div className="flex-1 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="relative" ref={navMenuRef}>
                    <button
                      onClick={() => setShowNavMenu((prev) => !prev)}
                      className="flex items-center space-x-3 px-2 py-1 rounded-md hover:bg-slate-100"
                    >
                      <img
                        src="/logo.png"
                        alt="Diamond Manager Scheduler logo"
                        className="h-8 w-8 rounded-lg object-contain bg-slate-100 p-1"
                      />
                      <div className="text-left">
                        <div className="text-lg font-bold tracking-tight text-slate-900 flex items-center">
                          <span>Diamond Manager Scheduler</span>
                          <ChevronDown size={16} className="ml-2 text-slate-500" />
                        </div>
                        <div className="text-xs text-indigo-500 uppercase tracking-wider">Scheduler</div>
                      </div>
                    </button>
                    {showNavMenu && (
                      <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                        <div className="py-2">
                          {navItems.map(({ mode, label, icon: Icon }) => (
                            <button
                              key={mode}
                              onClick={() => {
                                setViewMode(mode);
                                setShowNavMenu(false);
                              }}
                              className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors ${
                                viewMode === mode ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <Icon size={18} />
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="hidden md:flex items-center space-x-1">
                    {navItems.map(({ mode, label, icon: Icon }) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`p-2 rounded-md transition-colors ${
                          viewMode === mode
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title={label}
                        aria-label={label}
                      >
                        <Icon size={18} />
                      </button>
                    ))}
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800 capitalize hidden md:block">
                      {viewMode === 'league_builder' ? 'League Management' : viewMode === 'scheduler' ? 'Scheduler' : viewMode === 'teams' ? 'Teams' : viewMode === 'embed' ? 'Embed Code' : viewMode === 'help' ? 'Help & Guide' : viewMode === 'bracket' ? 'Playoff Bracket' : 'Calendar'}
                  </h2>
                </div>

                <div className="flex items-center space-x-3 relative" ref={userMenuRef}>
                  <button
                    onClick={toggleDarkMode}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                  <button
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    className="flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium text-slate-700"
                  >
                    <UserCircle size={18} />
                    <span className="hidden sm:inline">{userName}</span>
                    <ChevronDown size={16} className="text-slate-500" />
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <div className="text-sm font-semibold text-slate-800">{userName}</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Org: {orgId || 'none'}
                        </div>
                      </div>
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            setViewMode('teams');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <span>Teams</span>
                          <Users size={16} />
                        </button>
                        <div className="px-3 pb-2 space-y-2">
                          <div className="text-xs font-semibold text-slate-500 uppercase">Schedule</div>
                          <button
                            onClick={async () => {
                              setShowUserMenu(false);
                              await loadPublishedSchedules();
                              setShowScheduleModal(true);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            <span>Load Published Schedule</span>
                            <Send size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setPublishKeyDraft(scheduleKey);
                              setPublishNameDraft(scheduleName);
                              setShowPublishModal(true);
                            }}
                            disabled={gamesInHoldingArea.length > 0}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm text-white rounded ${
                              gamesInHoldingArea.length === 0
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-emerald-300 cursor-not-allowed'
                            }`}
                          >
                            <span>Publish Current Schedule</span>
                            <Send size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="border-t border-slate-100">
                        <button
                          onClick={() => { setShowUserMenu(false); setViewMode('help'); }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <span>Help & Guide</span>
                          <HelpCircle size={16} />
                        </button>
                        <button
                          onClick={() => keycloak.logout()}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <span>Sign out</span>
                          <LogOut size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
            </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6 relative">
          {viewMode === 'calendar' && (
            <>
              <GameHoldingArea
                games={gamesInHoldingArea}
                teams={teams}
                leagues={leagues}
                onGameMove={handleGameMove}
                onGameRemove={handleRemoveFromHoldingArea}
                onGameClick={handleGameClick}
              />
              <Calendar
                currentDate={currentDate}
                days={days} // Contains filtered games for Grid
                filteredGames={filteredGames} // Contains filtered games for List
                teams={allTeams}
                leagues={leagues}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onGameClick={handleGameClick}
                onDateClick={handleDateClick}
                onAddGame={handleAddGameClick}
                onGameMove={handleGameMove}
                onGameCopy={handleGameCopy}
                onDeleteGame={handleDeleteGame}
                onAddToHoldingArea={handleAddToHoldingArea}
                onRemoveAllGames={handleRemoveAllGames}
                // View Controls
                viewType={calendarView}
                onViewTypeChange={setCalendarView}
                selectedTeamId={selectedTeamId}
                onTeamFilterChange={setSelectedTeamId}
                selectedLeagueId={selectedLeagueId}
                onLeagueFilterChange={setSelectedLeagueId}
                selectedCategory={selectedCategory}
                onCategoryFilterChange={setSelectedCategory}
              />
            </>
          )}

          {viewMode === 'teams' && (
            <TeamList 
              teams={teams}
              onAddTeam={(t) => {
                if (teamLimit && teams.length >= teamLimit) {
                  alert(`Team limit reached (${teamLimit}).`);
                  return;
                }
                setTeams([...teams, t]);
              }}
              onUpdateTeam={handleUpdateTeam}
              onDeleteTeam={(id) => {
                 setTeams(teams.filter(t => t.id !== id));
                 setGames(games.filter(g => g.homeTeamId !== id && g.awayTeamId !== id)); // Cascade delete
              }}
              maxTeams={teamLimit}
            />
          )}

          {viewMode === 'league_builder' && (
            <LeagueBuilder 
                leagues={leagues}
                onLeagueCreated={handleLeagueCreated}
                onLeagueUpdated={handleLeagueUpdated}
                onLeagueDeleted={handleLeagueDeleted}
                existingTeams={teams}
                maxLeagues={leagueLimit}
                maxTeams={teamLimit}
            />
          )}

          {viewMode === 'scheduler' && (
            <ScheduleGenerator
                leagues={leagues}
                onLeagueSelected={handleLeagueSelectedForSchedule}
                onScheduleGenerated={(g) => {
                    if(confirm("This will replace the current schedule for this view. Continue?")) {
                        setGames(g);
                        setViewMode('calendar');
                    }
                }}
            />
          )}

          {viewMode === 'embed' && (
            <EmbedCodeGenerator
                leagues={leagues}
                teams={teams}
                games={games}
                currentUrl={window.location.href}
                loadedScheduleKey={scheduleKey}
                isPublishedScheduleLoaded={!!scheduleKey && scheduleKey.trim() !== ''}
                userId={userId}
                orgId={orgId}
            />
          )}

          {viewMode === 'bracket' && (
            <PlayoffBracket games={games} teams={teams} />
          )}

          {viewMode === 'help' && <HelpPage />}

        </div>

        {/* Add Game Modal */}
        {showAddModal && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">Schedule Game</h3>
                        <button onClick={() => setShowAddModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                    </div>
                    <form onSubmit={handleAddGame} className="p-6 space-y-4">
                        
                        {/* League Selection - Multi-select */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Leagues (select one or more)</label>
                            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                {leagues.length === 0 ? (
                                    <p className="text-sm text-slate-400">No leagues available. Create a league first.</p>
                                ) : (
                                    leagues.map(l => (
                                        <label key={l.id} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={newGameForm.leagueIds?.includes(l.id) || false}
                                                onChange={(e) => {
                                                    const currentIds = newGameForm.leagueIds || [];
                                                    if (e.target.checked) {
                                                        setNewGameForm({...newGameForm, leagueIds: [...currentIds, l.id]});
                                                    } else {
                                                        setNewGameForm({...newGameForm, leagueIds: currentIds.filter(id => id !== l.id)});
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-slate-700">{l.name} {l.category && <span className="text-slate-400">({l.category})</span>}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                <input required type="date" className="w-full border rounded-md p-2" value={newGameForm.date} onChange={e => setNewGameForm({...newGameForm, date: e.target.value})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                                <input required type="time" className="w-full border rounded-md p-2" value={newGameForm.time} onChange={e => setNewGameForm({...newGameForm, time: e.target.value})} />
                             </div>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Game Number</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={newGameForm.gameNumber ?? ''}
                                onChange={e => setNewGameForm({...newGameForm, gameNumber: e.target.value})}
                            />
                         </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Home Team</label>
                                <select required className="w-full border rounded-md p-2" value={newGameForm.homeTeamId || ''} onChange={e => {
                                    setNewGameForm({...newGameForm, homeTeamId: e.target.value});
                                }}>
                                    <option value="">Select...</option>
                                    {formTeams.map((t: Team) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Away Team</label>
                                <select required className="w-full border rounded-md p-2" value={newGameForm.awayTeamId || ''} onChange={e => setNewGameForm({...newGameForm, awayTeamId: e.target.value})}>
                                    <option value="">Select...</option>
                                    {formTeams.map((t: Team) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                             {formFields.length > 0 ? (
                               <select className="w-full border rounded-md p-2" value={newGameForm.location} onChange={e => setNewGameForm({...newGameForm, location: e.target.value})}>
                                 <option value="">Select field...</option>
                                 {formFields.map(f => <option key={f} value={f}>{f}</option>)}
                               </select>
                             ) : (
                               <input className="w-full border rounded-md p-2" placeholder="Stadium Name" value={newGameForm.location} onChange={e => setNewGameForm({...newGameForm, location: e.target.value})} />
                             )}
                        </div>

                        <div className="pt-2">
                            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                                Add to Schedule
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Edit Game Modal */}
        {showEditModal && editingGame && (() => {
          const editFormLeagueIds = newGameForm.leagueIds || getGameLeagueIds(editingGame);
          const editFormLeagues = leagues.filter(l => editFormLeagueIds.includes(l.id));
          const editFormTeams = editFormLeagues.length > 0
            ? Array.from(new Map(editFormLeagues.flatMap(l => l.teams).map(t => [t.id, t])).values())
            : [];
          const editFormFields = Array.from(new Set(editFormLeagues.flatMap(l => l.fields || [])));
          
          const closeEditModal = () => {
            setShowEditModal(false);
            setEditingGame(null);
            setNewGameForm({
              date: formatDate(new Date()),
              time: '15:00',
              location: 'Main Stadium',
              gameNumber: '',
              leagueIds: []
            });
          };
          
          return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={closeEditModal}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-slate-800">Edit Game</h3>
                        <button onClick={closeEditModal}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                    </div>
                    <form onSubmit={handleGameUpdate} className="p-6 space-y-4 overflow-y-auto">
                        
                        {/* League Selection - Multi-select */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Leagues (select one or more)</label>
                            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                {leagues.length === 0 ? (
                                    <p className="text-sm text-slate-400">No leagues available.</p>
                                ) : (
                                    leagues.map(l => (
                                        <label key={l.id} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={editFormLeagueIds.includes(l.id)}
                                                onChange={(e) => {
                                                    const currentIds = newGameForm.leagueIds || getGameLeagueIds(editingGame);
                                                    if (e.target.checked) {
                                                        setNewGameForm({...newGameForm, leagueIds: [...currentIds, l.id]});
                                                    } else {
                                                        setNewGameForm({...newGameForm, leagueIds: currentIds.filter(id => id !== l.id)});
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-slate-700">{l.name} {l.category && <span className="text-slate-400">({l.category})</span>}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                <input required type="date" className="w-full border rounded-md p-2" value={newGameForm.date || editingGame.date} onChange={e => setNewGameForm({...newGameForm, date: e.target.value})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                                <input required type="time" className="w-full border rounded-md p-2" value={newGameForm.time || editingGame.time} onChange={e => setNewGameForm({...newGameForm, time: e.target.value})} />
                             </div>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Game Number</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={newGameForm.gameNumber !== undefined ? newGameForm.gameNumber : (editingGame.gameNumber ?? '')}
                                onChange={e => setNewGameForm({...newGameForm, gameNumber: e.target.value})}
                            />
                         </div>

                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Series Name (optional)</label>
                             <input 
                                 className="w-full border rounded-md p-2" 
                                 placeholder="e.g., Semifinal, Final" 
                                 value={newGameForm.seriesName !== undefined ? newGameForm.seriesName : (editingGame.seriesName || '')} 
                                 onChange={e => setNewGameForm({...newGameForm, seriesName: e.target.value})} 
                             />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Home Team</label>
                                <select required className="w-full border rounded-md p-2" value={newGameForm.homeTeamId || editingGame.homeTeamId || ''} onChange={e => {
                                    setNewGameForm({...newGameForm, homeTeamId: e.target.value});
                                }}>
                                    <option value="">Select...</option>
                                    {editFormTeams.map((t: Team) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Away Team</label>
                                <select required className="w-full border rounded-md p-2" value={newGameForm.awayTeamId || editingGame.awayTeamId || ''} onChange={e => setNewGameForm({...newGameForm, awayTeamId: e.target.value})}>
                                    <option value="">Select...</option>
                                    {editFormTeams.map((t: Team) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                             {editFormFields.length > 0 ? (
                               <select className="w-full border rounded-md p-2" value={newGameForm.location || editingGame.location} onChange={e => setNewGameForm({...newGameForm, location: e.target.value})}>
                                 <option value="">Select field...</option>
                                 {editFormFields.map(f => <option key={f} value={f}>{f}</option>)}
                               </select>
                             ) : (
                               <input className="w-full border rounded-md p-2" placeholder="Stadium Name" value={newGameForm.location || editingGame.location} onChange={e => setNewGameForm({...newGameForm, location: e.target.value})} />
                             )}
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                            <div className="flex rounded-md border overflow-hidden divide-x flex-wrap">
                                {(['scheduled', 'live', 'final', 'postponed'] as const).map(s => {
                                    const current = newGameForm.status !== undefined ? newGameForm.status : editingGame.status;
                                    const isActive = current === s;
                                    const activeClass = s === 'live'
                                        ? 'bg-green-500 text-white'
                                        : s === 'final'
                                            ? 'bg-slate-700 text-white'
                                            : s === 'postponed'
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-indigo-600 text-white';
                                    const labels: Record<string, string> = { scheduled: 'Scheduled', live: '● Live', final: 'Final', postponed: 'Postponed' };
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setNewGameForm({...newGameForm, status: s})}
                                            className={`flex-1 py-2 text-sm font-medium transition-colors ${isActive ? activeClass : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {labels[s]}
                                        </button>
                                    );
                                })}
                            </div>
                            {(newGameForm.status === 'postponed' || (!newGameForm.status && editingGame.status === 'postponed')) && (
                                <p className="text-xs text-orange-600 mt-1">Change the date/time above to reschedule, then set status back to Scheduled.</p>
                            )}
                        </div>

                        {/* Score by Inning */}
                        {(() => {
                            const currentStatus = newGameForm.status !== undefined ? newGameForm.status : editingGame.status;
                            if (currentStatus !== 'live' && currentStatus !== 'final') return null;
                            const currentScores = newGameForm.scores !== undefined ? newGameForm.scores : editingGame.scores;
                            const innings = currentScores?.innings || [];
                            const homeTeamId = newGameForm.homeTeamId || editingGame.homeTeamId;
                            const awayTeamId = newGameForm.awayTeamId || editingGame.awayTeamId;
                            const homeTeam = teams.find((t: Team) => t.id === homeTeamId);
                            const awayTeam = teams.find((t: Team) => t.id === awayTeamId);

                            const updateInning = (idx: number, side: 'home' | 'away', val: string) => {
                                const newInnings = [...innings];
                                if (!newInnings[idx]) newInnings[idx] = { home: null, away: null };
                                newInnings[idx] = { ...newInnings[idx], [side]: val === '' ? null : parseInt(val) };
                                const totalHome = newInnings.reduce((s, i) => s + (i?.home ?? 0), 0);
                                const totalAway = newInnings.reduce((s, i) => s + (i?.away ?? 0), 0);
                                setNewGameForm({...newGameForm, scores: { home: totalHome, away: totalAway, innings: newInnings }});
                            };
                            const addInning = () => {
                                const newInnings = [...innings, { home: null, away: null }];
                                const totalHome = newInnings.reduce((s, i) => s + (i?.home ?? 0), 0);
                                const totalAway = newInnings.reduce((s, i) => s + (i?.away ?? 0), 0);
                                setNewGameForm({...newGameForm, scores: { home: totalHome, away: totalAway, innings: newInnings }});
                            };
                            const removeLastInning = () => {
                                const newInnings = innings.slice(0, -1);
                                const totalHome = newInnings.reduce((s, i) => s + (i?.home ?? 0), 0);
                                const totalAway = newInnings.reduce((s, i) => s + (i?.away ?? 0), 0);
                                setNewGameForm({...newGameForm, scores: newInnings.length > 0 ? { home: totalHome, away: totalAway, innings: newInnings } : undefined});
                            };

                            return (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-slate-700">Score by Inning</label>
                                        <div className="flex gap-1">
                                            <button type="button" onClick={removeLastInning} disabled={innings.length === 0} className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 disabled:opacity-40">− Inning</button>
                                            <button type="button" onClick={addInning} className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">+ Inning</button>
                                        </div>
                                    </div>
                                    {innings.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-3 border rounded-md bg-slate-50">Click "+ Inning" to start entering scores</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs border-collapse border border-slate-200 rounded-md overflow-hidden">
                                                <thead>
                                                    <tr className="bg-slate-100">
                                                        <th className="text-left px-2 py-1.5 font-semibold text-slate-600 w-16 border-r border-slate-200">Team</th>
                                                        {innings.map((_, i) => <th key={i} className="px-1 py-1.5 font-medium text-slate-500 w-9 border-r border-slate-200">{i + 1}</th>)}
                                                        <th className="px-2 py-1.5 font-bold text-slate-800 w-9">R</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {([{team: awayTeam, side: 'away'}, {team: homeTeam, side: 'home'}] as const).map(({team, side}) => (
                                                        <tr key={side} className="border-t border-slate-200">
                                                            <td className="px-2 py-1 font-semibold text-slate-700 border-r border-slate-200">{team?.abbreviation || side}</td>
                                                            {innings.map((inning, i) => (
                                                                <td key={i} className="p-0.5 border-r border-slate-200">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        className="w-8 text-center border border-slate-200 rounded p-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                                        value={inning[side] ?? ''}
                                                                        onChange={e => updateInning(i, side, e.target.value)}
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="px-2 py-1 font-bold text-center text-slate-800">
                                                                {innings.reduce((s, i) => s + (i[side] ?? 0), 0)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Recap */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Recap (optional)</label>
                            <textarea
                                className="w-full border rounded-md p-2 text-sm resize-none"
                                rows={3}
                                placeholder="Game recap..."
                                value={newGameForm.recap !== undefined ? newGameForm.recap : (editingGame.recap || '')}
                                onChange={e => setNewGameForm({...newGameForm, recap: e.target.value})}
                            />
                        </div>

                        {/* Live Stream URL */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Live Stream URL (optional)</label>
                            <input
                                type="url"
                                className="w-full border rounded-md p-2 text-sm"
                                placeholder="https://..."
                                value={newGameForm.streamUrl !== undefined ? newGameForm.streamUrl : (editingGame.streamUrl || '')}
                                onChange={e => setNewGameForm({...newGameForm, streamUrl: e.target.value})}
                            />
                        </div>

                        <div className="pt-2 space-y-2">
                            <div className="flex space-x-2">
                                <button type="button" onClick={closeEditModal} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-300 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                                    Save Changes
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleGameUpdateAndPublish}
                                disabled={isPublishing || !scheduleKey}
                                title={!scheduleKey ? 'Publish the schedule first to enable this button' : ''}
                                className={`w-full py-2 rounded-lg font-medium transition-colors text-white ${scheduleKey && !isPublishing ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-300 cursor-not-allowed'}`}
                            >
                                {isPublishing ? 'Publishing...' : 'Save & Publish'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
          );
        })()}

      </main>
      {showPublishModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">Publish Schedule</h3>
              <button onClick={() => setShowPublishModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Schedule Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={publishKeyDraft}
                  onChange={(e) => setPublishKeyDraft(e.target.value)}
                  placeholder="e.g. summer-2025"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  A unique identifier for this schedule (letters, numbers, hyphens). Used in embed URLs and ICS subscriptions.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Name</label>
                <input
                  type="text"
                  value={publishNameDraft}
                  onChange={(e) => setPublishNameDraft(e.target.value)}
                  placeholder="e.g. Summer League 2025"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              {publishKeyDraft.trim() && (
                <div className="flex flex-col items-center gap-1 py-2">
                  <p className="text-xs text-slate-500">Embed QR code preview</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${window.location.origin}/embed.html?schedule_key=${publishKeyDraft.trim()}`)}`}
                    alt="QR code for embed URL"
                    className="rounded border border-slate-200 p-1"
                    width={120}
                    height={120}
                  />
                  <p className="text-[10px] text-slate-400 break-all text-center max-w-full">
                    {`${window.location.origin}/embed.html?schedule_key=${publishKeyDraft.trim()}`}
                  </p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowPublishModal(false)}
                  className="flex-1 border border-slate-200 px-4 py-2 rounded-md text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={!publishKeyDraft.trim() || isPublishing}
                  onClick={async () => {
                    const trimmedKey = publishKeyDraft.trim();
                    if (!trimmedKey) return;
                    const finalName = publishNameDraft.trim() || trimmedKey;
                    setIsPublishing(true);
                    localStorage.setItem('dsa_schedule_publish_key', trimmedKey);
                    localStorage.setItem('dsa_schedule_publish_name', finalName);
                    const result = await storageApi.publishScheduleNow(
                      { leagues, teams, games, gamesInHoldingArea },
                      { userId, orgId },
                      trimmedKey,
                      finalName
                    );
                    setIsPublishing(false);
                    if (!result.ok) {
                      alert(`Publish failed. ${result.reason || 'Check PocketBase URL and rules.'}`);
                      return;
                    }
                    setScheduleKey(trimmedKey);
                    setScheduleName(finalName);
                    setShowPublishModal(false);
                    alert('Schedule published successfully.');
                  }}
                  className={`flex-1 px-4 py-2 rounded-md text-sm text-white font-medium ${
                    publishKeyDraft.trim() && !isPublishing
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-emerald-300 cursor-not-allowed'
                  }`}
                >
                  {isPublishing ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">Published Schedules</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Scope: {scheduleScopeLabel} · {publishedSchedules.length} schedules</span>
                <button
                  type="button"
                  onClick={loadPublishedSchedules}
                  className="text-indigo-500 hover:text-indigo-600"
                >
                  Refresh
                </button>
              </div>
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={selectedScheduleId}
                onChange={(e) => {
                  const selected = publishedSchedules.find((item) => item.id === e.target.value);
                  if (selected) {
                    setScheduleKey(selected.scheduleKey);
                    setScheduleName(selected.scheduleName || '');
                    setSelectedScheduleId(selected.id);
                  }
                }}
              >
                <option value="" disabled>
                  {isLoadingSchedules
                    ? 'Loading schedules...'
                    : publishedSchedules.length === 0
                      ? 'No schedules found'
                      : 'Select schedule'}
                </option>
                {publishedSchedules.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.scheduleName || item.scheduleKey}
                  </option>
                ))}
              </select>

              {selectedPublishedSchedule && (
                <div className="space-y-3 text-xs">
                  <div className="text-slate-500 space-y-1">
                    <div>Key: {selectedPublishedSchedule.scheduleKey}</div>
                    <div>Status: {selectedPublishedSchedule.active ? 'Active' : 'Inactive'}</div>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Calendar Subscription (ICS)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={subscriptionUrl}
                        className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-600 bg-slate-50"
                        placeholder="Subscription URL will appear here"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!subscriptionUrl) return;
                          try {
                            await navigator.clipboard.writeText(subscriptionUrl);
                            setCopiedSubscribeUrl(true);
                            setTimeout(() => setCopiedSubscribeUrl(false), 2000);
                          } catch {
                            alert('Copy failed.');
                          }
                        }}
                        disabled={!subscriptionUrl}
                        className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                          subscriptionUrl
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                        }`}
                        title="Copy subscription URL"
                      >
                        {copiedSubscribeUrl ? (
                          <>
                            <Check size={14} />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Use this URL to subscribe to the schedule in Google Calendar, Outlook, or other calendar apps.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={async () => {
                    await handleLoadSchedule();
                    setShowScheduleModal(false);
                  }}
                  className="flex-1 min-w-[120px] bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!selectedScheduleId) {
                      alert('Select a schedule to toggle.');
                      return;
                    }
                    const nextActive = !selectedPublishedSchedule?.active;
                    const result = await storageApi.updatePublishedScheduleActive(
                      selectedScheduleId,
                      nextActive,
                      { userId, orgId }
                    );
                    if (!result.ok) {
                      alert(`Update failed. ${result.reason || 'Check PocketBase rules.'}`);
                      return;
                    }
                    await loadPublishedSchedules();
                  }}
                  className="flex-1 min-w-[160px] border border-slate-200 px-4 py-2 rounded-md text-sm hover:bg-slate-50"
                >
                  {selectedPublishedSchedule?.active ? 'Set Inactive' : 'Set Active'}
                </button>
                <button
                  onClick={async () => {
                    if (!selectedScheduleId) {
                      alert('Select a schedule to delete.');
                      return;
                    }
                    if (!confirm('Delete this published schedule? This cannot be undone.')) return;
                    const result = await storageApi.deletePublishedSchedule(selectedScheduleId, { userId, orgId });
                    if (!result.ok) {
                      alert(`Delete failed. ${result.reason || 'Check PocketBase rules.'}`);
                      return;
                    }
                    setSelectedScheduleId('');
                    setScheduleKey('');
                    setScheduleName('');
                    await loadPublishedSchedules();
                  }}
                  className="flex-1 min-w-[120px] border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;