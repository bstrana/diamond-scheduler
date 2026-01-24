import PocketBase from 'pocketbase';
import { Game, League, Team } from '../types';

export type StorageData = {
  leagues: League[];
  teams: Team[];
  games: Game[];
  gamesInHoldingArea: Game[];
};

export type StorageContext = {
  userId?: string;
  orgId?: string;
};

const STORAGE_KEYS = {
  leagues: 'dsa_leagues',
  teams: 'dsa_teams',
  games: 'dsa_games',
  gamesInHoldingArea: 'dsa_games_holding'
};

const DEFAULT_COLLECTION = 'app_state';

const appId = import.meta.env.VITE_APP_ID || 'scheduler';
const pocketbaseUrl = import.meta.env.VITE_PB_URL;
const pocketbaseCollection = import.meta.env.VITE_PB_COLLECTION || DEFAULT_COLLECTION;

const scheduleCollection = import.meta.env.VITE_PB_SCHEDULE_COLLECTION;
const schedulePublishEnabled =
  (import.meta.env.VITE_PB_SCHEDULE_PUBLISH || 'false').toLowerCase() === 'true';
const scheduleTeamsCollection = import.meta.env.VITE_PB_SCHEDULE_TEAMS_COLLECTION || 'teams';
const scheduleRostersCollection = import.meta.env.VITE_PB_SCHEDULE_ROSTERS_COLLECTION || 'rosters';

const parseArray = <T>(value: string | null, fallback: T[]): T[] => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const createPocketBaseClient = () => {
  if (!pocketbaseUrl) return null;
  try {
    return new PocketBase(pocketbaseUrl);
  } catch {
    return null;
  }
};

const pocketbaseClient = createPocketBaseClient();

const loadFromPocketBase = async (): Promise<StorageData | null> => {
  if (!pocketbaseClient) return null;
  try {
    const record = await pocketbaseClient
      .collection(pocketbaseCollection)
      .getFirstListItem(`app_id="${appId}"`);
    const payload = (record as { payload?: StorageData }).payload;
    if (!payload) return null;
    return payload;
  } catch (error) {
    console.warn('PocketBase load failed, falling back to local storage.', error);
    return null;
  }
};

const saveToPocketBase = async (data: StorageData) => {
  if (!pocketbaseClient) return;
  try {
    const existing = await pocketbaseClient
      .collection(pocketbaseCollection)
      .getFirstListItem(`app_id="${appId}"`);
    await pocketbaseClient
      .collection(pocketbaseCollection)
      .update(existing.id, { app_id: appId, payload: data });
  } catch (error) {
    try {
      await pocketbaseClient
        .collection(pocketbaseCollection)
        .create({ app_id: appId, payload: data });
    } catch (createError) {
      console.warn('PocketBase save failed, keeping local storage only.', createError);
    }
  }
};

export const loadStorageData = async (
  defaults: StorageData,
  context?: StorageContext
): Promise<StorageData> => {
  const pocketbaseData = await loadFromPocketBase();
  const localData = {
    leagues: parseArray(localStorage.getItem(STORAGE_KEYS.leagues), defaults.leagues),
    teams: parseArray(localStorage.getItem(STORAGE_KEYS.teams), defaults.teams),
    games: parseArray(localStorage.getItem(STORAGE_KEYS.games), defaults.games),
    gamesInHoldingArea: parseArray(
      localStorage.getItem(STORAGE_KEYS.gamesInHoldingArea),
      defaults.gamesInHoldingArea
    )
  };

  const baseData = pocketbaseData
    ? {
        leagues: pocketbaseData.leagues || defaults.leagues,
        teams: pocketbaseData.teams || defaults.teams,
        games: pocketbaseData.games || defaults.games,
        gamesInHoldingArea: pocketbaseData.gamesInHoldingArea || defaults.gamesInHoldingArea
      }
    : localData;

  return baseData;
};

const formatTeamName = (team?: Team) => {
  if (!team) return 'Unknown';
  return `${team.city} ${team.name}`.trim();
};

const upsertTeamRecord = async (team: Team, context?: StorageContext) => {
  if (!pocketbaseClient) return null;
  const name = formatTeamName(team);
  try {
    const existing = await pocketbaseClient
      .collection(scheduleTeamsCollection)
      .getFirstListItem(`name="${name}"`);
    await pocketbaseClient.collection(scheduleTeamsCollection).update(existing.id, {
      name,
      logo_url: team.logoUrl || '',
      color: team.primaryColor,
      org_id: context?.orgId,
      user_id: context?.userId
    });
    return existing.id;
  } catch (error) {
    try {
      const created = await pocketbaseClient.collection(scheduleTeamsCollection).create({
        name,
        logo_url: team.logoUrl || '',
        color: team.primaryColor,
        org_id: context?.orgId,
        user_id: context?.userId
      });
      return created.id;
    } catch (createError) {
      console.warn('PocketBase team publish failed.', createError);
      return null;
    }
  }
};

const saveScheduleToPocketBase = async (data: StorageData, context?: StorageContext) => {
  if (!pocketbaseClient || !scheduleCollection || !schedulePublishEnabled) return;
  const leagueNameById = new Map(data.leagues.map((league) => [league.id, league.name]));
  const teamById = new Map(data.teams.map((team) => [team.id, team]));

  const upsertedTeams = new Map<string, string>();
  for (const team of data.teams) {
    const recordId = await upsertTeamRecord(team, context);
    if (recordId) {
      upsertedTeams.set(team.id, recordId);
    }
  }

  for (const game of data.games) {
    const homeTeam = teamById.get(game.homeTeamId);
    const awayTeam = teamById.get(game.awayTeamId);
    const homeTeamId = homeTeam ? upsertedTeams.get(homeTeam.id) : null;
    const awayTeamId = awayTeam ? upsertedTeams.get(awayTeam.id) : null;

    const competition =
      (game.leagueIds && game.leagueIds[0] && leagueNameById.get(game.leagueIds[0])) ||
      (game.leagueId && leagueNameById.get(game.leagueId)) ||
      'Schedule';

    const dateTime = new Date(`${game.date}T${game.time || '19:00'}:00`);
    const payload = {
      title: `${formatTeamName(awayTeam)} @ ${formatTeamName(homeTeam)}`,
      date: dateTime.toISOString(),
      competition,
      location: game.location,
      status: 'scheduled',
      home_team: homeTeamId,
      away_team: awayTeamId,
      home_roster: null,
      away_roster: null,
      org_id: context?.orgId,
      user_id: context?.userId,
      app_id: appId
    };

    try {
      const existing = await pocketbaseClient
        .collection(scheduleCollection)
        .getFirstListItem(`title="${payload.title}" && date="${payload.date}"`);
      await pocketbaseClient.collection(scheduleCollection).update(existing.id, payload);
    } catch (error) {
      try {
        await pocketbaseClient.collection(scheduleCollection).create(payload);
      } catch (createError) {
        console.warn('PocketBase schedule publish failed.', createError);
      }
    }
  }
};

export const persistStorageData = async (data: StorageData, context?: StorageContext) => {
  localStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(data.leagues));
  localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(data.teams));
  localStorage.setItem(STORAGE_KEYS.games, JSON.stringify(data.games));
  localStorage.setItem(STORAGE_KEYS.gamesInHoldingArea, JSON.stringify(data.gamesInHoldingArea));

  await saveToPocketBase(data);
  await saveScheduleToPocketBase(data, context);
};
