import React, { useState, useEffect, useRef } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { useTranslation } from 'react-i18next';
import { Team, Game, ViewMode, League, Tenant, PLAN_LIMITS } from './types';
import { getMonthDays, formatDate, generateUUID, resolvePoolBracket } from './utils';
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
  GitBranch,
  Menu,
  Link2,
  Building2,
  Download,
} from 'lucide-react';
import LeagueBuilder from './components/LeagueBuilder';
import ScheduleGenerator from './components/ScheduleGenerator';
import EmbedCodeGenerator from './components/EmbedCodeGenerator';
import HelpPage from './components/HelpPage';
import PlayoffBracket from './components/PlayoffBracket';
import LanguageSwitcher from './components/LanguageSwitcher';
import ScoreLinksManager from './components/ScoreLinksManager';
import TenantLimitsTable from './components/TenantLimitsTable';
import SuperAdminDashboard from './components/SuperAdminDashboard';

const App: React.FC = () => {
  const { t } = useTranslation();
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

  const [tenant, setTenant] = useState<Tenant | null>(null);

  // ── Role helpers — checks both realm roles and client roles ────────────────
  const token = keycloak.tokenParsed as any;
  const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID as string | undefined;
  const realmRoles  = (token?.realm_access?.roles as string[] | undefined) ?? [];
  const clientRoles = (clientId
    ? (token?.resource_access?.[clientId]?.roles as string[] | undefined)
    : undefined) ?? [];
  const rolesSet = new Set([...realmRoles, ...clientRoles]);
  const isSystemAdmin  = rolesSet.has('system_admin');
  const isTenantAdmin  = rolesSet.has('tenant_admin') || isSystemAdmin;
  const isEditor       = rolesSet.has('scheduler_editor') || rolesSet.has('scheduler_admin') || isTenantAdmin;
  const isAdminRole    = rolesSet.has('scheduler_admin')  || isTenantAdmin;

  // ── Plan-based limits (tenant record overrides env vars) ──────────────────
  const planLimits     = tenant ? tenant.limits : PLAN_LIMITS['enterprise'];
  // Env-var values act as a secondary override for single-tenant deployments
  const maxLeaguesEnv  = Number.parseInt(import.meta.env.VITE_LEAGUE_LIMIT || '', 10);
  const maxTeamsEnv    = Number.parseInt(import.meta.env.VITE_TEAM_LIMT    || '', 10);
  const leagueLimit    = Number.isFinite(maxLeaguesEnv) ? maxLeaguesEnv : planLimits.leagues;
  const teamLimit      = Number.isFinite(maxTeamsEnv)   ? maxTeamsEnv   : planLimits.teams;

  const navMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const gamesRef = useRef<Game[]>([]);

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
  const userEmail  = keycloak.tokenParsed?.email as string | undefined;
  const userDomain = window.location.hostname;
  // Canonical claim — supports multiple Keycloak mapper configurations:
  //   1. Flat org_id claim: User/Org Attribute mapper → org_id: "value"
  //   2. Organization Membership mapper with "Add organization attributes" ON:
  //        organization: { alias: { org_id: "value", id: "uuid", ... } }
  //      Attributes may also be nested: { alias: { attributes: { org_id: ["value"] } } }
  //   3. Plain Organization Membership mapper (no attributes): falls back to alias key.
  const userId = (keycloak.tokenParsed as any)?.sub as string | undefined;
  // Use the Keycloak organization alias as orgId — it's the key of the
  // organization claim and is always present without any custom attribute mapper.
  const orgId: string | undefined = (() => {
    const orgs = (keycloak.tokenParsed as any)?.organization;
    if (orgs && typeof orgs === 'object' && !Array.isArray(orgs)) {
      const alias = Object.keys(orgs)[0];
      if (alias && typeof alias === 'string') return alias;
    }
    return undefined;
  })();
  // Display name: prefer the tenant record name, then org name field, then org alias
  const orgDisplayName: string | undefined = (() => {
    if (tenant?.name && typeof tenant.name === 'string' && tenant.name) return tenant.name;
    const orgs = (keycloak.tokenParsed as any)?.organization;
    if (orgs && typeof orgs === 'object' && !Array.isArray(orgs)) {
      const alias = Object.keys(orgs)[0];
      const first = Object.values(orgs)[0] as any;
      if (first?.name && typeof first.name === 'string') return first.name;
      if (alias && typeof alias === 'string') return alias;
    }
    return undefined;
  })();

  // Derive a display role from the roles set
  const userRole = ['system_admin', 'tenant_admin', 'scheduler_admin', 'scheduler_editor', 'scheduler_viewer']
    .find(r => rolesSet.has(r)) ?? 'viewer';
  const scheduleScopeLabel = tenant?.name
    ? `${tenant.name} · ${tenant.plan}`
    : orgId
      ? `org:${orgId}`
      : userId
        ? `user:${userId.slice(0, 8)}…`
        : 'app only';

  const loadPublishedSchedules = async () => {
    setIsLoadingSchedules(true);
    const items = storageApi.listPublishedSchedules
      ? await storageApi.listPublishedSchedules({ userId, orgId }, { onlyActive: false })
      : [];
    setPublishedSchedules(items);
    setIsLoadingSchedules(false);
    return items;
  };

  const selectedPublishedSchedule = publishedSchedules.find((item) => item.id === selectedScheduleId);
  const subscriptionUrl = selectedPublishedSchedule
    ? `${window.location.origin}/subscribe.ics?schedule_key=${encodeURIComponent(selectedPublishedSchedule.scheduleKey)}`
    : '';

  const handleLoadSchedule = async () => {
    if (!selectedScheduleId) {
      alert(t('schedule.selectScheduleToLoad'));
      return;
    }
    const selectedSchedule = publishedSchedules.find((item) => item.id === selectedScheduleId);
    if (!selectedSchedule) {
      alert(t('schedule.scheduleNotFound'));
      return;
    }
    if (!storageApi.loadPublishedScheduleById) return;
    const data = await storageApi.loadPublishedScheduleById(selectedScheduleId, { userId, orgId });
    if (!data) {
      alert(t('schedule.accessDenied'));
      return;
    }
    setLeagues(data.leagues);
    setTeams(data.teams);
    setGames(data.games);
    setInterleagueDays(data.interleagueDays || []);
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
    { mode: 'league_builder', label: t('nav.leagueCreator'), icon: Trophy },
    { mode: 'scheduler', label: t('nav.scheduler'), icon: Clock },
    { mode: 'calendar', label: t('nav.calendar'), icon: CalendarIcon },
    { mode: 'bracket', label: t('nav.playoffBracket'), icon: GitBranch },
    { mode: 'embed', label: t('nav.embedCode'), icon: Code }
  ];

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Leagues & Teams State
  const [leagues, setLeagues] = useState<League[]>([]);
  
  // Teams represents the currently active roster being viewed or scheduled
  const [teams, setTeams] = useState<Team[]>([]);

  const [games, setGames] = useState<Game[]>([]);
  useEffect(() => { gamesRef.current = games; }, [games]);
  const [interleagueDays, setInterleagueDays] = useState<string[]>([]);

  // Always-fresh ref for data needed by the score-edit auto-publish callback (populated via useEffect below)
  const publishDataRef = useRef<{ leagues: League[]; teams: Team[]; games: Game[]; gamesInHoldingArea: Game[]; interleagueDays: string[]; scheduleKey: string; scheduleName: string; userId: string | undefined; orgId: string | undefined }>({ leagues: [], teams: [], games: [], gamesInHoldingArea: [], interleagueDays: [], scheduleKey: '', scheduleName: '', userId: undefined, orgId: undefined });

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
  // Keep publishDataRef always current so the score-edit subscription callback never has stale closures
  useEffect(() => {
    publishDataRef.current = { leagues, teams, games, gamesInHoldingArea, interleagueDays, scheduleKey, scheduleName, userId, orgId };
  });
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null);
  const [generatedLinkUrl, setGeneratedLinkUrl] = useState<string | null>(null);

  // New Game Form State
  const [newGameForm, setNewGameForm] = useState<Partial<Game> & { leagueIds?: string[] }>({
    date: formatDate(new Date()),
    time: '15:00',
    location: 'Main Stadium',
    gameNumber: '',
    leagueIds: []
  });

  // Persistence + tenant bootstrap
  useEffect(() => {
    let isActive = true;
    const hydrate = async () => {
      // Load tenant record and published schedules in parallel
      const tenantKey = orgId || userId;
      let [tenantRecord, publishedSchedules] = await Promise.all([
        tenantKey ? storageApi.loadTenant(tenantKey) : Promise.resolve(null),
        storageApi.listPublishedSchedules({ userId, orgId }, { onlyActive: false }),
      ]);

      if (!isActive) return;

      // Diagnostic — log what the token carries so admins can verify claims.
      if (import.meta.env.DEV || (import.meta.env.VITE_DEBUG_AUTH === 'true')) {
        const t = keycloak.tokenParsed as any;
        console.log('[DSA] token claims:', {
          sub: t?.sub,
          preferred_username: t?.preferred_username,
          realm_roles: t?.realm_access?.roles,
          organization: t?.organization,
          org_id: t?.org_id,
        });
      }

      // Auto-provision a free-plan tenant on first login.
      // Works with or without Keycloak Organizations:
      //   • orgId present  → org-scoped tenant (shared across users in the org)
      //   • orgId absent   → user-scoped tenant keyed by sub (single-user install)
      if (!tenantRecord && storageApi.createTenant && (orgId || userId)) {
        const orgs = (keycloak.tokenParsed as any)?.organization;
        const firstOrg = orgs && typeof orgs === 'object' && !Array.isArray(orgs)
          ? Object.values(orgs)[0] as any : null;
        // Name: org.name field → org alias (orgId) → fallback
        const orgName: string = (firstOrg?.name && typeof firstOrg.name === 'string' ? firstOrg.name : '')
          || (typeof orgId === 'string' ? orgId : '')
          || 'My Organisation';
        tenantRecord = await storageApi.createTenant({
          orgId: orgId || userId!,
          name: orgName,
          plan: 'free',
          limits: PLAN_LIMITS['free'],
          active: true,
        });
        if (tenantRecord) {
          console.log('[DSA] tenant auto-provisioned', tenantRecord);
        } else {
          console.warn('[DSA] tenant auto-provisioning failed — check PocketBase "tenants" collection rules');
        }
      }

      setTenant(tenantRecord);

      const hasPublishedSchedules = publishedSchedules && publishedSchedules.length > 0;

      // Only clear local state when PocketBase schedule publishing is configured
      // AND there are no published schedules for this user/org. If PocketBase isn't
      // configured (scheduleCollection missing or client unavailable), listPublishedSchedules
      // returns [] silently — clearing localStorage in that case would destroy local data.
      const schedulePublishConfigured =
        !!(import.meta.env.VITE_PB_SCHEDULE_COLLECTION && import.meta.env.VITE_PB_URL);
      if (schedulePublishConfigured && !hasPublishedSchedules) {
        localStorage.removeItem('dsa_leagues');
        localStorage.removeItem('dsa_teams');
        localStorage.removeItem('dsa_games');
        localStorage.removeItem('dsa_games_holding');
        localStorage.removeItem('dsa_schedule_publish_key');
        localStorage.removeItem('dsa_schedule_publish_name');
        localStorage.removeItem('dsa_seeded');
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
      let data = await storageApi.loadStorageData({
        leagues: [],
        teams: [],
        games: [],
        gamesInHoldingArea: []
      }, { userId, orgId });
      if (!isActive) return;

      // Seed default test league + teams on first install
      if (data.leagues.length === 0 && data.teams.length === 0 && !localStorage.getItem('dsa_seeded')) {
        const teamA: import('./types').Team = {
          id: generateUUID(),
          name: 'Home Hawks',
          city: 'Springfield',
          abbreviation: 'SPH',
          primaryColor: '#4f46e5',
          secondaryColor: '#818cf8',
        };
        const teamB: import('./types').Team = {
          id: generateUUID(),
          name: 'Away Eagles',
          city: 'Shelbyville',
          abbreviation: 'SHE',
          primaryColor: '#0891b2',
          secondaryColor: '#67e8f9',
        };
        const defaultLeague: import('./types').League = {
          id: generateUUID(),
          name: 'Test League',
          shortName: 'TL',
          category: 'Baseball',
          teams: [teamA, teamB],
        };
        data = { leagues: [defaultLeague], teams: [teamA, teamB], games: [], gamesInHoldingArea: [] };
        localStorage.setItem('dsa_seeded', '1');
        await storageApi.persistStorageData(data, { userId, orgId });

      }

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

  // Sync the Keycloak token into PocketBase so @request.auth.* collection rules work.
  useEffect(() => {
    if (keycloak.token) {
      storageApi.authenticatePocketBase(keycloak.token);
    }
  }, [keycloak.token]);

  // Register a refresh callback so storage functions can freshen the token before API calls.
  useEffect(() => {
    storageApi.registerKeycloakRefresh(async () => {
      if (!keycloak.authenticated) return;
      if (keycloak.isTokenExpired(30)) {
        await keycloak.updateToken(30);
        if (keycloak.token) storageApi.authenticatePocketBase(keycloak.token);
      }
    });
  }, [keycloak]);

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
    if (!showScheduleModal) return;
    loadPublishedSchedules();
  }, [showScheduleModal, userId, orgId]);

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
    if (!isHydrated || !initialized || !keycloak.authenticated) return;
    const timeoutId = window.setTimeout(() => {
      storageApi.persistStorageData(
        { leagues, teams, games, gamesInHoldingArea, interleagueDays },
        { userId, orgId }
      );
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [isHydrated, initialized, keycloak.authenticated, leagues, teams, games, gamesInHoldingArea]);

  // Auto-publish when a score-edit link marks a game as final
  useEffect(() => {
    if (!scheduleKey) return;
    const unsub = storageApi.subscribeScoreEdits(scheduleKey, (edit) => {
      if (edit.status !== 'final') return;
      const { leagues: l, teams: t, gamesInHoldingArea: giha, interleagueDays: ild, scheduleKey: sk, scheduleName: sn, userId: uid, orgId: oid } = publishDataRef.current;
      if (!sk) return;
      const currentGames = gamesRef.current;
      const updatedGames = currentGames.map(g => {
        if (g.id !== edit.gameId) return g;
        return {
          ...g,
          status: 'final' as const,
          scores: edit.scores ?? g.scores,
          recap: edit.recap ?? g.recap,
          hits: edit.hits ?? g.hits,
          errors: edit.errors ?? g.errors,
        };
      });
      if (updatedGames === currentGames) return;
      setGames(updatedGames);
      storageApi.publishScheduleNow(
        { leagues: l, teams: t, games: updatedGames, gamesInHoldingArea: giha, interleagueDays: ild },
        { userId: uid, orgId: oid },
        sk,
        sn
      ).catch(() => {});
    });
    return () => unsub();
  }, [scheduleKey]);

  // Auto-resolve pool bracket: when all pool games (bracketRound === 0) for a set
  // of TBD bracket games are final/forfeit, replace TBD slots with real team IDs.
  useEffect(() => {
    const hasTbd = games.some(
      g => g.homeTeamId?.startsWith('__tbd_pool_') || g.awayTeamId?.startsWith('__tbd_pool_')
    );
    if (!hasTbd) return;

    const poolGames = games.filter(g => g.bracketRound === 0);
    if (poolGames.length === 0) return;

    const allPoolDone = poolGames.every(
      g => g.status === 'final' || g.status === 'forfeit'
    );
    if (!allPoolDone) return;

    // All pool games complete — auto-resolve
    const { resolved } = resolvePoolBracket(games);
    // Only update if something actually changed
    const changed = resolved.some((g, i) => {
      const orig = games[i];
      return g.homeTeamId !== orig.homeTeamId || g.awayTeamId !== orig.awayTeamId;
    });
    if (changed) {
      setGames(resolved);
    }
  }, [games]);

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
    if (window.confirm(t('gameForm.validationDeleteGame'))) {
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
    if (window.confirm(t('gameForm.validationDeleteGame'))) {
        setGames(games.filter(g => g.id !== gameId));
    }
  };

  // Remove All Games Logic
  const handleRemoveAllGames = () => {
    if (games.length === 0) {
      alert(t('schedule.noGamesToRemove'));
      return;
    }

    const confirmed = window.confirm(
      t('schedule.removeAllConfirm', { count: games.length })
    );

    if (confirmed) {
      setGames([]);
      alert(t('schedule.allGamesRemoved'));
    }
  };

  const toggleInterleagueDay = (dateStr: string) => {
    const isNowInterleague = !interleagueDays.includes(dateStr);
    setInterleagueDays(prev => isNowInterleague ? [...prev, dateStr] : prev.filter(d => d !== dateStr));
    setGames(prev => prev.map(g => g.date === dateStr ? { ...g, interleague: isNowInterleague || undefined } : g));
  };

  const handleGameClick = (game: Game) => {
    setEditingGame(game);
    // Initialize form with all game's current values so nothing is lost on save
    const gameLeagueIds = getGameLeagueIds(game);
    setNewGameForm({
      date: game.date,
      time: game.time,
      location: game.location,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      leagueIds: gameLeagueIds,
      gameNumber: game.gameNumber,
      seriesName: game.seriesName,
      status: game.status,
      scores: game.scores,
      recap: game.recap,
      streamUrl: game.streamUrl,
      currentInning: game.currentInning,
      inningHalf: game.inningHalf,
      interleague: game.interleague,
      hits: game.hits,
      errors: game.errors,
    });
    setShowEditModal(true);
  };

  const handleGameUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;
    
    if (!newGameForm.leagueIds || newGameForm.leagueIds.length === 0) {
      alert(t('gameForm.validationAtLeastOneLeague'));
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
      currentInning: newGameForm.currentInning !== undefined ? newGameForm.currentInning : editingGame.currentInning,
      inningHalf: newGameForm.inningHalf !== undefined ? newGameForm.inningHalf : editingGame.inningHalf,
      interleague: newGameForm.interleague || undefined,
      hits: newGameForm.hits !== undefined ? newGameForm.hits : editingGame.hits,
      errors: newGameForm.errors !== undefined ? newGameForm.errors : editingGame.errors,
    };

    if (updatedGame.homeTeamId === updatedGame.awayTeamId) {
      alert(t('gameForm.validationDifferentTeams'));
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
      alert(t('gameForm.validationAtLeastOneLeague'));
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
      currentInning: newGameForm.currentInning !== undefined ? newGameForm.currentInning : editingGame.currentInning,
      inningHalf: newGameForm.inningHalf !== undefined ? newGameForm.inningHalf : editingGame.inningHalf,
      interleague: newGameForm.interleague || undefined,
    };

    if (updatedGame.homeTeamId === updatedGame.awayTeamId) {
      alert(t('gameForm.validationDifferentTeams'));
      return;
    }

    if (!scheduleKey) {
      alert(t('schedule.noPublishedSchedule'));
      return;
    }

    const updatedGames = games.map(g => g.id === editingGame.id ? updatedGame : g);
    setGames(updatedGames);
    setShowEditModal(false);
    setEditingGame(null);
    setNewGameForm({ date: formatDate(new Date()), time: '15:00', location: 'Main Stadium', gameNumber: '', leagueIds: [] });

    setIsPublishing(true);
    const result = await storageApi.publishScheduleNow(
      { leagues, teams, games: updatedGames, gamesInHoldingArea, interleagueDays },
      { userId, orgId },
      scheduleKey,
      scheduleName
    );
    setIsPublishing(false);
    if (!result.ok) {
      alert(t('schedule.publishFailed', { reason: result.reason || 'Check PocketBase URL and rules.' }));
    }
  };

  // ── Score links ───────────────────────────────────────────────────────────────

  const handleGenerateScoreLink = async (gameId: string) => {
    if (!scheduleKey) {
      alert('Publish a schedule first to generate score links.');
      return;
    }
    setGeneratingLinkFor(gameId);
    setGeneratedLinkUrl(null);
    const expiresAt = new Date(Date.now() + 48 * 3_600_000).toISOString();
    const link = await storageApi.createScoreLink({
      token: generateUUID(),
      gameId,
      scheduleKey,
      orgId,
      userId,
      disabled: false,
      expiresAt,
    });
    setGeneratingLinkFor(null);
    if (link) {
      const url = `${window.location.origin}/score-edit.html?token=${link.token}`;
      setGeneratedLinkUrl(url);
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    } else {
      alert('Could not create score link. Make sure the score_links collection is configured in PocketBase.');
    }
  };

  const handleGenerateScoreLinksForGames = async (gameIds: string[]) => {
    if (!scheduleKey) {
      alert('Publish a schedule first to generate score links.');
      return;
    }
    const expiresAt = new Date(Date.now() + 48 * 3_600_000).toISOString();
    const created: string[] = [];
    for (const gameId of gameIds) {
      const link = await storageApi.createScoreLink({
        token: generateUUID(),
        gameId,
        scheduleKey,
        orgId,
        userId,
        disabled: false,
        expiresAt,
      });
      if (link) created.push(link.token);
    }
    alert(`Generated ${created.length} score link(s). View and copy them from Score Links in the user menu.`);
  };

  // Real-time score-edit subscriptions + fallback poll every 30 s
  useEffect(() => {
    if (!scheduleKey) return;
    const check = async () => {
      const edits = await storageApi.listScoreEditsByScheduleKey(scheduleKey);
      if (edits.length === 0) return;
      const editMap = new Map(edits.map(e => [e.gameId, e]));

      // Apply edits on top of the current games ref (always-fresh value).
      const currentGames = gamesRef.current;
      let hasStatusChange = false;
      const updatedGames = currentGames.map(g => {
        const edit = editMap.get(g.id);
        if (!edit) return g;
        if (edit.status !== g.status) hasStatusChange = true;
        return {
          ...g,
          status: edit.status as Game['status'],
          scores: edit.scores ?? g.scores,
          ...(edit.recap != null && { recap: edit.recap || undefined }),
        };
      });

      if (!hasStatusChange) return; // nothing changed, skip update + publish
      setGames(updatedGames);

      // Re-publish so the public schedule reflects the latest score-edit statuses.
      // This acts as a fallback for when the SSE auto-publish subscription missed an event.
      const hasFinalEdits = edits.some(e => e.status === 'final');
      if (hasFinalEdits) {
        const { leagues: l, teams: t, gamesInHoldingArea: giha, interleagueDays: ild, scheduleKey: sk, scheduleName: sn, userId: uid, orgId: oid } = publishDataRef.current;
        if (sk && keycloak.authenticated) {
          storageApi.publishScheduleNow(
            { leagues: l, teams: t, games: updatedGames, gamesInHoldingArea: giha, interleagueDays: ild },
            { userId: uid, orgId: oid },
            sk,
            sn
          ).catch(() => {});
        }
      }
    };
    // Initial fetch to pick up any edits that arrived before we subscribed
    check();
    // Real-time: re-run check whenever a score edit arrives for this schedule
    const unsubscribe = storageApi.subscribeScoreEdits(scheduleKey, () => { check(); });
    // Fallback poll every 30 s in case SSE drops or is unavailable
    const id = setInterval(check, 30_000);
    return () => { clearInterval(id); unsubscribe(); };
  }, [scheduleKey, userId, orgId]);

  // ─────────────────────────────────────────────────────────────────────────────

  const handleDateClick = (date: Date) => {
    if (leagues.length === 0) {
      alert(t('schedule.selectLeagueFirst'));
      return;
    }
    const defaultLeague = leagues.find(l => l.teams.some(t => t.id === teams[0]?.id)) || leagues[0];
    const dateStr = formatDate(date);
    setNewGameForm({
        date: dateStr,
        time: '15:00',
        location: 'Main Stadium',
        leagueIds: defaultLeague ? [defaultLeague.id] : [],
        gameNumber: '',
        interleague: interleagueDays.includes(dateStr) || undefined,
    });
    setShowAddModal(true);
  };

  const handleAddGameClick = () => {
    if (leagues.length === 0) {
        alert(t('schedule.createLeagueFirst'));
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
        alert(t('gameForm.validationAtLeastOneLeague'));
        return;
    }
    if (!newGameForm.homeTeamId || !newGameForm.awayTeamId) {
        alert(t('gameForm.validationSelectBothTeams'));
        return;
    }
    if (!newGameForm.date) {
        alert(t('gameForm.validationSelectDate'));
        return;
    }
    if(newGameForm.homeTeamId === newGameForm.awayTeamId) {
        alert(t('gameForm.validationDifferentTeams'));
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
        gameNumber: newGameForm.gameNumber,
        interleague: (newGameForm.interleague || interleagueDays.includes(newGameForm.date || '')) || undefined,
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
        alert(t('league.leagueLimitReached', { limit: leagueLimit }));
        return;
      }
      setLeagues([...leagues, league]);
      // Switch the active team roster to the new league's teams
      setTeams(league.teams);
      alert(t('league.leagueCreated', { name: league.name }));
      setViewMode('scheduler');
  };

  const handleLeagueUpdated = (updatedLeague: League) => {
    setLeagues(leagues.map(l => l.id === updatedLeague.id ? updatedLeague : l));
    // If the active roster belongs to this league, update it immediately
    const isActiveLeague = teams.length > 0 && updatedLeague.teams.some(t => t.id === teams[0].id);
    if (isActiveLeague) {
        setTeams(updatedLeague.teams);
    }
    alert(t('league.leagueUpdated', { name: updatedLeague.name }));
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
      alert(t('league.leagueDeleted', { name: leagueToDelete.name }));
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
          <h1 className="text-xl font-semibold text-slate-800">{t('auth.keycloakConfigMissing')}</h1>
          <p className="text-sm text-slate-600 mt-2">
            {t('auth.setMissingEnvVars')}
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
          <div>{t('auth.loadingAuthentication')}</div>
          {authTimeout && (
            <div className="mt-3 text-sm text-slate-500">
              {t('auth.takingLonger')}
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
          <h1 className="text-xl font-semibold text-slate-800">{t('auth.signInRequired')}</h1>
          <p className="text-sm text-slate-600 mt-2">
            {t('auth.signInWithKeycloak')}
          </p>
          <button
            className="mt-6 bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700 text-sm font-medium"
            onClick={() => keycloak.login()}
          >
            {t('auth.signIn')}
          </button>
        </div>
      </div>
    );
  }

  // ── SuperAdmin gate — system_admin sees only the management dashboard ────────
  if (isSystemAdmin) {
    return (
      <SuperAdminDashboard
        onSignOut={() => keycloak.logout({ redirectUri: window.location.origin + '/logged-out.html' })}
        keycloakToken={keycloak.token}
      />
    );
  }

  // ── Tenant suspension gate ─────────────────────────────────────────────────
  // Shown only when the tenant record has been loaded and is explicitly inactive.
  // System admins bypass this gate so they can always access for support purposes.
  if (tenant && !tenant.active && !isSystemAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-red-200 rounded-xl shadow-lg p-8 text-center max-w-sm space-y-3">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold text-slate-800">Account suspended</h1>
          <p className="text-sm text-slate-500">
            Your organisation's account has been suspended. Please contact support to resolve this.
          </p>
          <p className="text-xs text-slate-400">Org: {tenant.orgId}</p>
          <button
            className="mt-2 text-sm text-indigo-600 underline hover:text-indigo-800"
            onClick={() => keycloak.logout({ redirectUri: window.location.origin + '/logged-out.html' })}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ── Trial expiry warning (non-blocking) ────────────────────────────────────
  const trialDaysLeft = tenant?.trialEndsAt
    ? Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86_400_000)
    : null;

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
        {/* Trial expiry warning banner */}
        {trialDaysLeft !== null && trialDaysLeft <= 7 && trialDaysLeft >= 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between shrink-0">
            <span>
              {trialDaysLeft === 0
                ? 'Your free trial expires today.'
                : `Your free trial expires in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}.`}
              {' '}Upgrade your plan to keep full access.
            </span>
            {isSystemAdmin && tenant && (
              <span className="text-amber-500 font-medium ml-4">[system admin view]</span>
            )}
          </div>
        )}
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0">
            <div className="flex-1 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="relative" ref={navMenuRef}>
                    <button
                      onClick={() => setShowNavMenu((prev) => !prev)}
                      className="flex items-center space-x-2 px-2 py-1 rounded-md hover:bg-slate-100"
                    >
                      <img
                        src="/logo.png"
                        alt="Diamond Manager Scheduler logo"
                        className="h-8 w-8 rounded-lg object-contain bg-slate-100 p-1 flex-shrink-0"
                      />
                      {/* Mobile: menu icon + current section */}
                      <div className="flex items-center space-x-1 md:hidden">
                        <span className="text-sm font-semibold text-slate-700 truncate max-w-[110px]">
                          {viewMode === 'league_builder' ? t('nav.leagueManagement') : viewMode === 'scheduler' ? t('nav.scheduler') : viewMode === 'teams' ? t('nav.teams') : viewMode === 'embed' ? t('nav.embedCode') : viewMode === 'help' ? t('nav.helpGuide') : viewMode === 'bracket' ? t('nav.playoffBracket') : viewMode === 'tenant_settings' ? 'Plan & Limits' : t('nav.calendar')}
                        </span>
                        <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
                      </div>
                      {/* Desktop: full title + subtitle */}
                      <div className="hidden md:block text-left">
                        <div className="text-lg font-bold tracking-tight text-slate-900 flex items-center">
                          <span>{t('app.title')}</span>
                          <ChevronDown size={16} className="ml-2 text-slate-500" />
                        </div>
                        <div className="text-xs text-indigo-500 uppercase tracking-wider">{t('app.subtitle')}</div>
                      </div>
                    </button>
                    {showNavMenu && (
                      <div className="absolute left-0 top-full mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                        <div className="py-2">
                          {navItems.map(({ mode, label, icon: Icon }) => (
                            <button
                              key={mode}
                              onClick={() => {
                                setViewMode(mode);
                                setShowNavMenu(false);
                              }}
                              className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm transition-colors ${
                                viewMode === mode ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700 hover:bg-slate-100'
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
                      {viewMode === 'league_builder' ? t('nav.leagueManagement') : viewMode === 'scheduler' ? t('nav.scheduler') : viewMode === 'teams' ? t('nav.teams') : viewMode === 'embed' ? t('nav.embedCode') : viewMode === 'help' ? t('nav.helpGuide') : viewMode === 'bracket' ? t('nav.playoffBracket') : viewMode === 'tenant_settings' ? 'Plan & Limits' : t('nav.calendar')}
                  </h2>
                </div>

                <div className="flex items-center space-x-3 relative" ref={userMenuRef}>
                  <LanguageSwitcher />
                  <button
                    onClick={toggleDarkMode}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title={darkMode ? t('nav.switchToLight') : t('nav.switchToDark')}
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
                      {/* ── User identity block ── */}
                      <div className="px-3 py-2.5 border-b border-slate-100 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-800 truncate">{userName}</div>
                          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            userRole === 'system_admin'    ? 'bg-red-100 text-red-700' :
                            userRole === 'tenant_admin'    ? 'bg-purple-100 text-purple-700' :
                            userRole === 'scheduler_admin' ? 'bg-indigo-100 text-indigo-700' :
                            userRole === 'scheduler_editor'? 'bg-blue-100 text-blue-700' :
                                                             'bg-slate-100 text-slate-500'
                          }`}>{userRole.replace(/_/g, ' ')}</span>
                        </div>
                        {userEmail && userEmail !== userName && (
                          <div className="text-[11px] text-slate-400 truncate">{userEmail}</div>
                        )}
                        {typeof orgDisplayName === 'string' && orgDisplayName && (
                          <div className="text-[11px] text-slate-500 truncate">
                            <span className="text-slate-400">{t('app.orgLabel')}</span>{orgDisplayName}
                          </div>
                        )}
                        {tenant && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              tenant.plan === 'enterprise' ? 'bg-amber-100 text-amber-700' :
                              tenant.plan === 'pro'        ? 'bg-emerald-100 text-emerald-700' :
                                                             'bg-slate-100 text-slate-500'
                            }`}>{tenant.plan} plan</span>
                            <span className="text-[10px] text-slate-400">
                              {leagues.length}/{tenant.limits.leagues} leagues · {teams.length}/{tenant.limits.teams} teams
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="py-2">
                        {/* Teams section */}
                        <div className="px-3 pb-2 border-b border-slate-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                              {t('nav.teams')} ({allTeams.length})
                            </span>
                            <button
                              onClick={() => { setShowUserMenu(false); setViewMode('teams'); }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              {t('common.manage', 'Manage')} →
                            </button>
                          </div>
                          {allTeams.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-1">{t('teams.noTeams', 'No teams yet')}</p>
                          ) : (
                            <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
                              {allTeams.map(team => (
                                <div key={team.id} className="flex items-center gap-2 py-0.5">
                                  {team.logoUrl ? (
                                    <img src={team.logoUrl} alt={team.name} className="w-5 h-5 rounded-full object-contain flex-shrink-0" />
                                  ) : (
                                    <span className="w-5 h-5 rounded-full flex-shrink-0 inline-block" style={{ background: team.primaryColor || '#94a3b8' }} />
                                  )}
                                  <span className="text-xs text-slate-700 truncate">{team.city} {team.name}</span>
                                  <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{team.abbreviation}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="px-3 pb-2 space-y-2 pt-2">
                          <div className="text-xs font-semibold text-slate-500 uppercase">{t('app.schedule')}</div>
                          <button
                            onClick={async () => {
                              setShowUserMenu(false);
                              await loadPublishedSchedules();
                              setShowScheduleModal(true);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            <span>{t('app.loadPublishedSchedule')}</span>
                            <Send size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              const payload = { leagues, teams, games };
                              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              const label = (scheduleName || scheduleKey || 'schedule').replace(/[^a-z0-9]/gi, '-').toLowerCase();
                              a.href = url;
                              a.download = `${label}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            <span>{t('app.exportSchedule', 'Export schedule')}</span>
                            <Download size={16} />
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
                            <span>{t('app.publishCurrentSchedule')}</span>
                            <Send size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="border-t border-slate-100">
                        {isTenantAdmin && (
                          <button
                            onClick={() => { setShowUserMenu(false); setViewMode('tenant_settings'); }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            <span>Plan &amp; Limits</span>
                            <Building2 size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => { setShowUserMenu(false); setViewMode('score_links'); }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <span>Score Links</span>
                          <Link2 size={16} />
                        </button>
                        <button
                          onClick={() => { setShowUserMenu(false); setViewMode('help'); }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <span>{t('nav.helpGuide')}</span>
                          <HelpCircle size={16} />
                        </button>
                        <button
                          onClick={() => keycloak.logout({ redirectUri: window.location.origin + '/logged-out.html' })}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <span>{t('nav.signOut')}</span>
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
              <div className="hidden md:block sticky top-0 z-20 -mx-6 px-6 pb-1 bg-slate-50 dark:bg-slate-900">
                <GameHoldingArea
                  games={gamesInHoldingArea}
                  teams={teams}
                  leagues={leagues}
                  onGameMove={handleGameMove}
                  onGameRemove={handleRemoveFromHoldingArea}
                  onGameClick={handleGameClick}
                />
              </div>
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
                onGenerateScoreLinks={scheduleKey ? handleGenerateScoreLinksForGames : undefined}
                interleagueDays={interleagueDays}
                onToggleInterleagueDay={toggleInterleagueDay}
              />
            </>
          )}

          {viewMode === 'teams' && (
            <TeamList 
              teams={teams}
              onAddTeam={(newTeam) => {
                if (teamLimit && teams.length >= teamLimit) {
                  alert(t('teams.teamLimitReached', { limit: teamLimit }));
                  return;
                }
                setTeams([...teams, newTeam]);
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
                existingTeams={allTeams}
                maxLeagues={leagueLimit}
                maxTeams={teamLimit}
            />
          )}

          {viewMode === 'scheduler' && (
            <ScheduleGenerator
                leagues={leagues}
                games={games}
                onLeagueSelected={handleLeagueSelectedForSchedule}
                onScheduleGenerated={(g, mode) => {
                    if (mode === 'append') {
                        if (confirm(t('schedule.appendScheduleConfirm'))) {
                            setGames(prev => [...prev, ...g]);
                            setViewMode('calendar');
                        }
                    } else {
                        if (confirm(t('schedule.replaceScheduleConfirm'))) {
                            setGames(g);
                            setViewMode('calendar');
                        }
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
                orgName={tenant?.branding?.orgName || orgDisplayName || tenant?.name || orgId}
            />
          )}

          {viewMode === 'bracket' && (
            <PlayoffBracket games={games} teams={teams} />
          )}

          {viewMode === 'help' && <HelpPage />}

          {viewMode === 'score_links' && (
            <ScoreLinksManager
              scheduleKey={scheduleKey}
              games={games}
              teams={teams}
              leagues={leagues}
              userId={userId}
              orgId={orgId}
            />
          )}

          {viewMode === 'tenant_settings' && (
            <TenantLimitsTable
              tenant={tenant}
              usage={{
                leagues:            leagues.length,
                teams:              teams.length,
                scoreLinks:         0,
                publishedSchedules: publishedSchedules.length,
              }}
              isSystemAdmin={isSystemAdmin}
            />
          )}

        </div>

        {/* Add Game Modal */}
        {showAddModal && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">{t('app.scheduleGameTitle')}</h3>
                        <button onClick={() => setShowAddModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                    </div>
                    <form onSubmit={handleAddGame} className="p-6 space-y-4">

                        {/* League Selection - Multi-select */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t('gameForm.leaguesSelect')}</label>
                            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                {leagues.length === 0 ? (
                                    <p className="text-sm text-slate-400">{t('gameForm.noLeagues')}</p>
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.date')}</label>
                                <input required type="date" className="w-full border rounded-md p-2" value={newGameForm.date} onChange={e => setNewGameForm({...newGameForm, date: e.target.value})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.time')}</label>
                                <input required type="time" className="w-full border rounded-md p-2" value={newGameForm.time} onChange={e => setNewGameForm({...newGameForm, time: e.target.value})} />
                             </div>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.gameNumber')}</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={newGameForm.gameNumber ?? ''}
                                onChange={e => setNewGameForm({...newGameForm, gameNumber: e.target.value})}
                            />
                         </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.homeTeam')}</label>
                                <select required className="w-full border rounded-md p-2" value={newGameForm.homeTeamId || ''} onChange={e => {
                                    setNewGameForm({...newGameForm, homeTeamId: e.target.value});
                                }}>
                                    <option value="">{t('gameForm.selectDots')}</option>
                                    {formTeams.map((tm: Team) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.awayTeam')}</label>
                                <select required className="w-full border rounded-md p-2" value={newGameForm.awayTeamId || ''} onChange={e => setNewGameForm({...newGameForm, awayTeamId: e.target.value})}>
                                    <option value="">{t('gameForm.selectDots')}</option>
                                    {formTeams.map((tm: Team) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.location')}</label>
                             {formFields.length > 0 ? (
                               <select className="w-full border rounded-md p-2" value={newGameForm.location} onChange={e => setNewGameForm({...newGameForm, location: e.target.value})}>
                                 <option value="">{t('gameForm.selectField')}</option>
                                 {formFields.map(f => <option key={f} value={f}>{f}</option>)}
                               </select>
                             ) : (
                               <input className="w-full border rounded-md p-2" placeholder={t('gameForm.stadiumName')} value={newGameForm.location} onChange={e => setNewGameForm({...newGameForm, location: e.target.value})} />
                             )}
                        </div>

                        <div className="pt-2">
                            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                                {t('gameForm.addToSchedule')}
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
            setGeneratedLinkUrl(null);
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
                        <h3 className="font-bold text-slate-800">{t('app.editGameTitle')}</h3>
                        <button onClick={closeEditModal}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                    </div>
                    <form onSubmit={handleGameUpdate} className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">

                        {/* League Selection - Multi-select */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t('gameForm.leaguesSelect')}</label>
                            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                {leagues.length === 0 ? (
                                    <p className="text-sm text-slate-400">{t('gameForm.noLeaguesShort')}</p>
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

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!newGameForm.interleague}
                            onChange={e => setNewGameForm({...newGameForm, interleague: e.target.checked || undefined})}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700">Interleague game (counts toward combined standings)</span>
                        </label>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.date')}</label>
                                <input required type="date" className="w-full border rounded-md p-2" value={newGameForm.date || editingGame.date} onChange={e => setNewGameForm({...newGameForm, date: e.target.value})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.time')}</label>
                                <input required type="time" className="w-full border rounded-md p-2" value={newGameForm.time || editingGame.time} onChange={e => setNewGameForm({...newGameForm, time: e.target.value})} />
                             </div>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.gameNumber')}</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2"
                                value={newGameForm.gameNumber !== undefined ? newGameForm.gameNumber : (editingGame.gameNumber ?? '')}
                                onChange={e => setNewGameForm({...newGameForm, gameNumber: e.target.value})}
                            />
                         </div>

                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.seriesName')}</label>
                             <input
                                 className="w-full border rounded-md p-2"
                                 placeholder={t('gameForm.seriesNamePlaceholder')}
                                 value={newGameForm.seriesName !== undefined ? newGameForm.seriesName : (editingGame.seriesName || '')}
                                 onChange={e => setNewGameForm({...newGameForm, seriesName: e.target.value})}
                             />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.homeTeam')}</label>
                                <select required className="w-full border rounded-md p-2" value={newGameForm.homeTeamId || editingGame.homeTeamId || ''} onChange={e => {
                                    setNewGameForm({...newGameForm, homeTeamId: e.target.value});
                                }}>
                                    <option value="">{t('gameForm.selectDots')}</option>
                                    {editFormTeams.map((tm: Team) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.awayTeam')}</label>
                                <select required className="w-full border rounded-md p-2" value={newGameForm.awayTeamId || editingGame.awayTeamId || ''} onChange={e => setNewGameForm({...newGameForm, awayTeamId: e.target.value})}>
                                    <option value="">{t('gameForm.selectDots')}</option>
                                    {editFormTeams.map((tm: Team) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">{t('gameForm.location')}</label>
                             {editFormFields.length > 0 ? (
                               <select className="w-full border rounded-md p-2" value={newGameForm.location || editingGame.location} onChange={e => setNewGameForm({...newGameForm, location: e.target.value})}>
                                 <option value="">{t('gameForm.selectField')}</option>
                                 {editFormFields.map(f => <option key={f} value={f}>{f}</option>)}
                               </select>
                             ) : (
                               <input className="w-full border rounded-md p-2" placeholder={t('gameForm.stadiumName')} value={newGameForm.location || editingGame.location} onChange={e => setNewGameForm({...newGameForm, location: e.target.value})} />
                             )}
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t('gameForm.status')}</label>
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
                                    const labels: Record<string, string> = { scheduled: t('gameForm.statusScheduled'), live: t('gameForm.statusLive'), final: t('gameForm.statusFinal'), postponed: t('gameForm.statusPostponed') };
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
                                <p className="text-xs text-orange-600 mt-1">{t('gameForm.postponedHint')}</p>
                            )}
                        </div>

                        {/* Current Inning (live games only) */}
                        {(newGameForm.status === 'live' || (!newGameForm.status && editingGame.status === 'live')) && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Inning</label>
                                <div className="flex items-center gap-3">
                                    {/* Top / Bottom toggle */}
                                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                                        {(['top', 'bottom'] as const).map(half => {
                                            const currentHalf = newGameForm.inningHalf !== undefined ? newGameForm.inningHalf : editingGame.inningHalf;
                                            const isActive = currentHalf === half;
                                            return (
                                                <button
                                                    key={half}
                                                    type="button"
                                                    onClick={() => setNewGameForm({...newGameForm, inningHalf: half})}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                                >
                                                    <span className="text-[11px] leading-none">{half === 'top' ? '▲' : '▼'}</span>
                                                    {half.charAt(0).toUpperCase() + half.slice(1)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* Inning number */}
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        placeholder="—"
                                        value={(newGameForm.currentInning !== undefined ? newGameForm.currentInning : editingGame.currentInning) ?? ''}
                                        onChange={e => setNewGameForm({...newGameForm, currentInning: e.target.value === '' ? undefined : parseInt(e.target.value)})}
                                        className="w-16 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                </div>
                            </div>
                        )}

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

                            const currentHits   = newGameForm.hits   !== undefined ? newGameForm.hits   : editingGame.hits;
                            const currentErrors = newGameForm.errors !== undefined ? newGameForm.errors : editingGame.errors;

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
                                                        <th className="px-2 py-1.5 font-bold text-slate-800 w-9 border-l border-slate-300">R</th>
                                                        <th className="px-2 py-1.5 font-bold text-slate-800 w-9 border-l border-slate-200">H</th>
                                                        <th className="px-2 py-1.5 font-bold text-slate-800 w-9 border-l border-slate-200">E</th>
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
                                                            <td className="px-2 py-1 font-bold text-center text-slate-800 border-l border-slate-300">
                                                                {innings.reduce((s, i) => s + (i[side] ?? 0), 0)}
                                                            </td>
                                                            <td className="p-0.5 border-l border-slate-200">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    className="w-8 text-center border border-slate-200 rounded p-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                                    value={currentHits?.[side] ?? ''}
                                                                    onChange={e => {
                                                                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                                                                        setNewGameForm({...newGameForm, hits: { ...(currentHits ?? { away: null, home: null }), [side]: val }});
                                                                    }}
                                                                />
                                                            </td>
                                                            <td className="p-0.5 border-l border-slate-200">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    className="w-8 text-center border border-slate-200 rounded p-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                                    value={currentErrors?.[side] ?? ''}
                                                                    onChange={e => {
                                                                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                                                                        setNewGameForm({...newGameForm, errors: { ...(currentErrors ?? { away: null, home: null }), [side]: val }});
                                                                    }}
                                                                />
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

                            {/* Generate Score Link */}
                            {scheduleKey && (
                              <div className="pt-1 border-t border-slate-100">
                                {generatedLinkUrl && generatingLinkFor === null ? (
                                  <div className="bg-indigo-50 rounded-lg px-3 py-2 space-y-1">
                                    <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1"><Link2 size={12} />Score link copied!</p>
                                    <div className="flex items-center gap-2">
                                      <input readOnly value={generatedLinkUrl} className="flex-1 text-xs font-mono bg-white border border-indigo-200 rounded px-2 py-1 truncate text-slate-600" onClick={e => (e.target as HTMLInputElement).select()} />
                                      <button type="button" onClick={() => navigator.clipboard.writeText(generatedLinkUrl)} className="p-1.5 rounded text-indigo-500 hover:bg-indigo-100"><Copy size={13} /></button>
                                    </div>
                                    <button type="button" className="text-xs text-indigo-500 underline" onClick={() => setGeneratedLinkUrl(null)}>Generate another</button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={generatingLinkFor === editingGame.id}
                                    onClick={() => { setGeneratedLinkUrl(null); handleGenerateScoreLink(editingGame.id); }}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60"
                                  >
                                    <Link2 size={14} />
                                    {generatingLinkFor === editingGame.id ? 'Generating…' : 'Generate Score Link (48h)'}
                                  </button>
                                )}
                              </div>
                            )}
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
                      { leagues, teams, games, gamesInHoldingArea, interleagueDays },
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
                    const items = await loadPublishedSchedules();
                    const published = items.find((s) => s.scheduleKey === trimmedKey);
                    if (published) setSelectedScheduleId(published.id);
                    setShowScheduleModal(true);
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
                    ? t('app.loadingSchedules')
                    : publishedSchedules.length === 0
                      ? t('app.noSchedulesFound')
                      : t('app.selectSchedule')}
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