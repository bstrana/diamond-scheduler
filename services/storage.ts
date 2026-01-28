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
  active: boolean;
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

const sanitizeFilterValue = (value: string | undefined): string | null => {
  if (!value || typeof value !== 'string') return null;
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 200);
};

const loadFromPocketBase = async (context?: StorageContext): Promise<StorageData | null> => {
  if (!pocketbaseClient) return null;
  try {
    const baseFilter = `app_id="${appId}"`;
    const safeOrgId = sanitizeFilterValue(context?.orgId);
    const safeUserId = sanitizeFilterValue(context?.userId);
    
    // Try with org_id/user_id filter first
    let filter = baseFilter;
    if (safeOrgId) {
      filter = `${baseFilter} && org_id="${safeOrgId}"`;
    } else if (safeUserId) {
      filter = `${baseFilter} && user_id="${safeUserId}"`;
    }
    
    try {
      const record = await pocketbaseClient
        .collection(pocketbaseCollection)
        .getFirstListItem(filter);
      const payload = (record as { payload?: StorageData }).payload;
      if (!payload) return null;
      return payload;
    } catch (filterError: any) {
      // If filter fails (e.g., field doesn't exist), try without org_id/user_id
      // This handles cases where the schema hasn't been updated yet
      if (filterError?.status === 400 && (safeOrgId || safeUserId)) {
        console.warn('PocketBase filter failed, trying without org_id/user_id filter.', filterError);
        const record = await pocketbaseClient
          .collection(pocketbaseCollection)
          .getFirstListItem(baseFilter);
        const payload = (record as { payload?: StorageData }).payload;
        if (!payload) return null;
        return payload;
      }
      throw filterError;
    }
  } catch (error) {
    console.warn('PocketBase load failed, falling back to local storage.', error);
    return null;
  }
};

const saveToPocketBase = async (data: StorageData, context?: StorageContext) => {
  if (!pocketbaseClient) return;
  try {
    const baseFilter = `app_id="${appId}"`;
    const safeOrgId = sanitizeFilterValue(context?.orgId);
    const safeUserId = sanitizeFilterValue(context?.userId);
    
    // Try with org_id/user_id filter first
    let filter = baseFilter;
    if (safeOrgId) {
      filter = `${baseFilter} && org_id="${safeOrgId}"`;
    } else if (safeUserId) {
      filter = `${baseFilter} && user_id="${safeUserId}"`;
    }
    
    try {
      const existing = await pocketbaseClient
        .collection(pocketbaseCollection)
        .getFirstListItem(filter);
      await pocketbaseClient
        .collection(pocketbaseCollection)
        .update(existing.id, { 
          app_id: appId,
          org_id: safeOrgId || undefined,
          user_id: safeUserId || undefined,
          payload: data 
        });
    } catch (filterError: any) {
      // If filter fails (e.g., field doesn't exist), try without org_id/user_id
      if (filterError?.status === 400 && (safeOrgId || safeUserId)) {
        console.warn('PocketBase filter failed, trying without org_id/user_id filter.', filterError);
        const existing = await pocketbaseClient
          .collection(pocketbaseCollection)
          .getFirstListItem(baseFilter);
        await pocketbaseClient
          .collection(pocketbaseCollection)
          .update(existing.id, { 
            app_id: appId,
            org_id: safeOrgId || undefined,
            user_id: safeUserId || undefined,
            payload: data 
          });
        return;
      }
      throw filterError;
    }
  } catch (error) {
    try {
      const safeOrgId = sanitizeFilterValue(context?.orgId);
      const safeUserId = sanitizeFilterValue(context?.userId);
      await pocketbaseClient
        .collection(pocketbaseCollection)
        .create({ 
          app_id: appId,
          org_id: safeOrgId || undefined,
          user_id: safeUserId || undefined,
          payload: data 
        });
    } catch (createError) {
      console.warn('PocketBase save failed, keeping local storage only.', createError);
    }
  }
};

export const loadStorageData = async (
  defaults: StorageData,
  context?: StorageContext
): Promise<StorageData> => {
  const pocketbaseData = await loadFromPocketBase(context);
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
  const safeKey = scheduleKey ? sanitizeFilterValue(scheduleKey) : null;
  const envKey = scheduleKeyEnv ? sanitizeFilterValue(scheduleKeyEnv) : null;
  const finalKey = safeKey || envKey || 'default';
  
  // If schedule_key is "default", use empty data
  const isDefaultKey = finalKey === 'default';
  const payload = {
    app_id: appId,
    active: true,
    org_id: sanitizeFilterValue(context?.orgId) || undefined,
    user_id: sanitizeFilterValue(context?.userId) || undefined,
    schedule_key: finalKey,
    schedule_name: scheduleName ? scheduleName.slice(0, 200) : undefined,
    data: isDefaultKey
      ? {
          leagues: [],
          teams: [],
          games: []
        }
      : {
          leagues: data.leagues,
          teams: data.teams,
          games: data.games
        }
  };

  try {
    const record = await pocketbaseClient
      .collection(scheduleCollection)
      .getFirstListItem(`app_id="${appId}" && schedule_key="${finalKey}"`);
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

  await saveToPocketBase(data, context);
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
  context?: StorageContext,
  options?: { onlyActive?: boolean }
): Promise<PublishedScheduleSummary[]> => {
  if (!pocketbaseClient || !scheduleCollection) return [];
  const baseFilters = [`app_id="${appId}"`];
  if (options?.onlyActive) {
    baseFilters.push('active=true');
  }
  const scopedFilters = [...baseFilters];
  // For logged-in users, enforce org_id filtering - no fallback to all schedules
  const safeOrgId = sanitizeFilterValue(context?.orgId);
  if (safeOrgId) {
    scopedFilters.push(`org_id="${safeOrgId}"`);
  } else if (context?.userId) {
    // If user has userId but no orgId, filter by userId only
    const safeUserId = sanitizeFilterValue(context.userId);
    if (safeUserId) {
      scopedFilters.push(`user_id="${safeUserId}"`);
    }
  }
  const scopedFilter = scopedFilters.join(' && ');
  try {
    const data = await pocketbaseClient
      .collection(scheduleCollection)
      .getList(1, 200, { filter: scopedFilter, sort: '-updated' });
    const items = data.items || [];
    return items
      .map((item: any) => ({
        id: item.id,
        scheduleKey: item.schedule_key || 'default',
        scheduleName: item.schedule_name || undefined,
        active: item.active !== false
      }))
      .filter((item) => item.scheduleKey);
  } catch (error) {
    console.warn('PocketBase schedule list failed.', error);
    return [];
  }
};

export const deletePublishedSchedule = async (
  recordId: string,
  context?: StorageContext
): Promise<{ ok: boolean; reason?: string }> => {
  if (!pocketbaseClient || !scheduleCollection) {
    return { ok: false, reason: 'PocketBase is not configured.' };
  }
  try {
    // First verify the schedule belongs to the user's org
    const record = await pocketbaseClient.collection(scheduleCollection).getOne(recordId);
    const safeOrgId = sanitizeFilterValue(context?.orgId);
    if (safeOrgId && record.org_id !== safeOrgId) {
      return { ok: false, reason: 'Schedule not found or access denied.' };
    }
    // If user has userId but no orgId, verify by userId
    if (!safeOrgId && context?.userId) {
      const safeUserId = sanitizeFilterValue(context.userId);
      if (safeUserId && record.user_id !== safeUserId) {
        return { ok: false, reason: 'Schedule not found or access denied.' };
      }
    }
    await pocketbaseClient.collection(scheduleCollection).delete(recordId);
    return { ok: true };
  } catch (error) {
    console.warn('PocketBase schedule delete failed.', error);
    return {
      ok: false,
      reason: formatPocketbaseError(error)
    };
  }
};

export const updatePublishedScheduleActive = async (
  recordId: string,
  active: boolean,
  context?: StorageContext
): Promise<{ ok: boolean; reason?: string }> => {
  if (!pocketbaseClient || !scheduleCollection) {
    return { ok: false, reason: 'PocketBase is not configured.' };
  }
  try {
    // First verify the schedule belongs to the user's org
    const record = await pocketbaseClient.collection(scheduleCollection).getOne(recordId);
    const safeOrgId = sanitizeFilterValue(context?.orgId);
    if (safeOrgId && record.org_id !== safeOrgId) {
      return { ok: false, reason: 'Schedule not found or access denied.' };
    }
    // If user has userId but no orgId, verify by userId
    if (!safeOrgId && context?.userId) {
      const safeUserId = sanitizeFilterValue(context.userId);
      if (safeUserId && record.user_id !== safeUserId) {
        return { ok: false, reason: 'Schedule not found or access denied.' };
      }
    }
    await pocketbaseClient.collection(scheduleCollection).update(recordId, { active });
    return { ok: true };
  } catch (error) {
    console.warn('PocketBase schedule update failed.', error);
    return {
      ok: false,
      reason: formatPocketbaseError(error)
    };
  }
};

export const loadPublishedScheduleByKey = async (
  scheduleKey: string
): Promise<StorageData | null> => {
  if (!pocketbaseClient || !scheduleCollection || !scheduleKey) return null;
  const safeKey = sanitizeFilterValue(scheduleKey);
  if (!safeKey) return null;
  try {
    const record = await pocketbaseClient
      .collection(scheduleCollection)
      .getFirstListItem(`app_id="${appId}" && schedule_key="${safeKey}" && active=true`);
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

export const loadPublishedScheduleById = async (
  recordId: string,
  context?: StorageContext
): Promise<StorageData | null> => {
  if (!pocketbaseClient || !scheduleCollection || !recordId) return null;
  try {
    const record = await pocketbaseClient
      .collection(scheduleCollection)
      .getOne(recordId);
    
    // Verify the schedule belongs to the user's org
    const safeOrgId = sanitizeFilterValue(context?.orgId);
    if (safeOrgId && record.org_id !== safeOrgId) {
      console.warn('Schedule access denied: org_id mismatch');
      return null;
    }
    // If user has userId but no orgId, verify by userId
    if (!safeOrgId && context?.userId) {
      const safeUserId = sanitizeFilterValue(context.userId);
      if (safeUserId && record.user_id !== safeUserId) {
        console.warn('Schedule access denied: user_id mismatch');
        return null;
      }
    }
    
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
