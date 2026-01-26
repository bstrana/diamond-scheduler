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

export type PublishedScheduleSummary = {
  id: string;
  scheduleKey: string;
  scheduleName?: string;
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
const scheduleKeyEnv = import.meta.env.VITE_PB_SCHEDULE_KEY;

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
    const client = new PocketBase(pocketbaseUrl);
    client.autoCancellation(false);
    return client;
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

type PublishResult = { ok: boolean; reason?: string };

const formatPocketbaseError = (error: unknown) => {
  if (!error) return 'Unknown PocketBase error.';
  const err = error as { status?: number; message?: string; data?: any };
  if (err.data?.message) {
    return `PocketBase ${err.status || ''} ${err.data.message}`.trim();
  }
  if (err.message) {
    return `PocketBase ${err.status || ''} ${err.message}`.trim();
  }
  try {
    return `PocketBase error: ${JSON.stringify(err)}`;
  } catch {
    return 'PocketBase error (unserializable).';
  }
};

const saveScheduleToPocketBase = async (
  data: StorageData,
  context?: StorageContext,
  scheduleKey?: string,
  scheduleName?: string
): Promise<PublishResult> => {
  if (!schedulePublishEnabled) {
    return { ok: false, reason: 'Publish disabled. Set VITE_PB_SCHEDULE_PUBLISH=true.' };
  }
  if (!pocketbaseUrl) {
    return { ok: false, reason: 'Missing VITE_PB_URL.' };
  }
  if (!scheduleCollection) {
    return { ok: false, reason: 'Missing VITE_PB_SCHEDULE_COLLECTION.' };
  }
  if (!pocketbaseClient) {
    return { ok: false, reason: 'PocketBase client not initialized.' };
  }
  const payload = {
    app_id: appId,
    active: true,
    org_id: context?.orgId,
    user_id: context?.userId,
    schedule_key: scheduleKey || scheduleKeyEnv || 'default',
    schedule_name: scheduleName,
    data: {
      leagues: data.leagues,
      teams: data.teams,
      games: data.games
    }
  };

  try {
    const record = await pocketbaseClient
      .collection(scheduleCollection)
      .getFirstListItem(`app_id="${appId}" && schedule_key="${payload.schedule_key}"`);
    await pocketbaseClient.collection(scheduleCollection).update(record.id, payload);
    return { ok: true };
  } catch (error) {
    try {
      await pocketbaseClient.collection(scheduleCollection).create(payload);
      return { ok: true };
    } catch (createError) {
      console.warn('PocketBase schedule publish failed.', createError);
      return {
        ok: false,
        reason: formatPocketbaseError(createError)
      };
    }
  }
};

export const persistStorageData = async (
  data: StorageData,
  context?: StorageContext,
  scheduleKey?: string,
  scheduleName?: string
): Promise<boolean> => {
  localStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(data.leagues));
  localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(data.teams));
  localStorage.setItem(STORAGE_KEYS.games, JSON.stringify(data.games));
  localStorage.setItem(STORAGE_KEYS.gamesInHoldingArea, JSON.stringify(data.gamesInHoldingArea));

  await saveToPocketBase(data);
  const result = await saveScheduleToPocketBase(data, context, scheduleKey, scheduleName);
  return result.ok;
};

export const publishScheduleNow = async (
  data: StorageData,
  context?: StorageContext,
  scheduleKey?: string,
  scheduleName?: string
): Promise<PublishResult> => saveScheduleToPocketBase(data, context, scheduleKey, scheduleName);

export const listPublishedSchedules = async (
  context?: StorageContext
): Promise<PublishedScheduleSummary[]> => {
  if (!pocketbaseClient || !scheduleCollection) return [];
  const baseFilters = [`app_id="${appId}"`, 'active=true'];
  const scopedFilters = [...baseFilters];
  if (context?.orgId) {
    scopedFilters.push(`org_id="${context.orgId}"`);
  }
  if (context?.userId) {
    scopedFilters.push(`user_id="${context.userId}"`);
  }
  const scopedFilter = scopedFilters.join(' && ');
  try {
    const data = await pocketbaseClient
      .collection(scheduleCollection)
      .getList(1, 200, { filter: scopedFilter, sort: '-updated' });
    let items = data.items || [];
    if (items.length === 0 && scopedFilters.length > baseFilters.length) {
      const fallback = await pocketbaseClient
        .collection(scheduleCollection)
        .getList(1, 200, { filter: baseFilters.join(' && '), sort: '-updated' });
      items = fallback.items || [];
    }
    return items
      .map((item: any) => ({
        id: item.id,
        scheduleKey: item.schedule_key || 'default',
        scheduleName: item.schedule_name || undefined
      }))
      .filter((item) => item.scheduleKey);
  } catch (error) {
    console.warn('PocketBase schedule list failed.', error);
    return [];
  }
};

export const loadPublishedScheduleByKey = async (
  scheduleKey: string
): Promise<StorageData | null> => {
  if (!pocketbaseClient || !scheduleCollection || !scheduleKey) return null;
  try {
    const record = await pocketbaseClient
      .collection(scheduleCollection)
      .getFirstListItem(`app_id="${appId}" && schedule_key="${scheduleKey}" && active=true`);
    const data = (record as { data?: Partial<StorageData> }).data;
    if (!data) return null;
    return {
      leagues: data.leagues || [],
      teams: data.teams || [],
      games: data.games || [],
      gamesInHoldingArea: []
    };
  } catch (error) {
    console.warn('PocketBase schedule fetch failed.', error);
    return null;
  }
};
