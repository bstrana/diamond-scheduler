import PocketBase from 'pocketbase';
import { Game, League, Team, ScoreLink, ScoreEdit, Tenant, TenantPlan, TenantLimits, PLAN_LIMITS } from '../types';

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

const pocketbaseUrl = import.meta.env.VITE_PB_URL;
const pocketbaseCollection = import.meta.env.VITE_PB_COLLECTION || DEFAULT_COLLECTION;

const scheduleCollection = import.meta.env.VITE_PB_SCHEDULE_COLLECTION;
// Score-link collections – set VITE_PB_SCORE_LINKS_COLLECTION and
// VITE_PB_SCORE_EDITS_COLLECTION in your .env (defaults shown here).
// Both collections must allow unauthenticated API access in PocketBase:
//   score_links  – List/View rules: empty (public read)
//   score_edits  – List/View/Create/Update rules: empty (public read+write)
const scoreLinksCollection = import.meta.env.VITE_PB_SCORE_LINKS_COLLECTION || 'score_links';
const scoreEditsCollection  = import.meta.env.VITE_PB_SCORE_EDITS_COLLECTION  || 'score_edits';
const tenantsCollection     = import.meta.env.VITE_PB_TENANTS_COLLECTION      || 'tenants';
const schedulePublishEnabled =
  (import.meta.env.VITE_PB_SCHEDULE_PUBLISH || 'false').toLowerCase() === 'true';
const scheduleKeyEnv = import.meta.env.VITE_PB_SCHEDULE_KEY;
// Only forward the Keycloak JWT to PocketBase when the OIDC provider has been configured in
// the PocketBase admin UI. Without it, PocketBase rejects the unknown token with a 400 error.
const pbKeycloakAuthEnabled =
  (import.meta.env.VITE_PB_KEYCLOAK_AUTH || 'false').toLowerCase() === 'true';

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

// ─── Keycloak token forwarding ────────────────────────────────────────────────

/**
 * Save the Keycloak access token into the PocketBase auth store so that every
 * subsequent API call carries it in the Authorization header. PocketBase then
 * validates the token against the configured OIDC provider and populates
 * @request.auth.* in collection rules.
 */
export const authenticatePocketBase = (token: string) => {
  if (!pocketbaseClient || !token || !pbKeycloakAuthEnabled) return;
  pocketbaseClient.authStore.save(token, null);
};

let keycloakRefreshFn: (() => Promise<void>) | null = null;

/**
 * Register a callback that refreshes the Keycloak token when it is close to
 * expiry. Call this once from App.tsx after Keycloak initialises. The refresh
 * fn should call keycloak.updateToken() and then authenticatePocketBase().
 */
export const registerKeycloakRefresh = (fn: () => Promise<void>) => {
  keycloakRefreshFn = fn;
};

const withFreshToken = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    await keycloakRefreshFn?.();
  } catch {
    // Refresh failed (Keycloak not yet authenticated or token unavailable) — proceed anyway.
    // Storage functions have their own try/catch; this just prevents an unhandled rejection.
  }
  return fn();
};

const sanitizeFilterValue = (value: string | undefined): string | null => {
  if (!value || typeof value !== 'string') return null;
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 200);
};

const loadFromPocketBase = async (context?: StorageContext): Promise<StorageData | null> => {
  if (!pocketbaseClient) return null;
  return withFreshToken(async () => {
    try {
      const safeOrgId = sanitizeFilterValue(context?.orgId);
      const safeUserId = sanitizeFilterValue(context?.userId);

      let filter = '';
      if (safeOrgId) {
        filter = `org_id="${safeOrgId}"`;
      } else if (safeUserId) {
        filter = `user_id="${safeUserId}"`;
      }

      const record = await pocketbaseClient
        .collection(pocketbaseCollection)
        .getFirstListItem(filter);
      const payload = (record as { payload?: StorageData }).payload;
      if (!payload) return null;
      return payload;
    } catch (error) {
      console.warn('PocketBase load failed, falling back to local storage.', error);
      return null;
    }
  });
};

const saveToPocketBase = async (data: StorageData, context?: StorageContext) => {
  if (!pocketbaseClient) return;
  return withFreshToken(async () => {
    try {
      const safeOrgId = sanitizeFilterValue(context?.orgId);
      const safeUserId = sanitizeFilterValue(context?.userId);

      let filter = '';
      if (safeOrgId) {
        filter = `org_id="${safeOrgId}"`;
      } else if (safeUserId) {
        filter = `user_id="${safeUserId}"`;
      }

      const existing = await pocketbaseClient
        .collection(pocketbaseCollection)
        .getFirstListItem(filter);
      await pocketbaseClient
        .collection(pocketbaseCollection)
        .update(existing.id, {
          org_id: safeOrgId || undefined,
          user_id: safeUserId || undefined,
          payload: data
        });
    } catch (error) {
      try {
        const safeOrgId = sanitizeFilterValue(context?.orgId);
        const safeUserId = sanitizeFilterValue(context?.userId);
        await pocketbaseClient
          .collection(pocketbaseCollection)
          .create({
            org_id: safeOrgId || undefined,
            user_id: safeUserId || undefined,
            payload: data
          });
      } catch (createError) {
        console.warn('PocketBase save failed, keeping local storage only.', createError);
      }
    }
  });
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
  // PocketBase JS SDK v0.21+ stores the response body in `response`,
  // field-level validation errors in `data` (= response.data), and
  // the human-readable message in `message` (getter → response.message).
  const err = error as {
    status?: number;
    message?: string;
    data?: Record<string, any>;
    response?: Record<string, any>;
  };
  const status = typeof err.status === 'number' ? err.status : 0;
  // Prefer the server-level message; fall back to SDK network-error message.
  const msg =
    err.response?.message ||
    err.data?.message ||
    err.message ||
    '';
  // Collect field-level validation errors (e.g. { title: { code, message } }).
  const fieldErrors =
    err.data && typeof err.data === 'object' && !err.data.message
      ? Object.entries(err.data)
          .map(([k, v]) => `${k}: ${(v as any)?.message ?? JSON.stringify(v)}`)
          .join(', ')
      : '';
  const detail = [msg, fieldErrors].filter(Boolean).join(' — ');
  return `PocketBase ${status} ${detail || '(no detail)'}`.trim();
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
    active: true,
    org_id: sanitizeFilterValue(context?.orgId) || undefined,
    user_id: sanitizeFilterValue(context?.userId) || undefined,
    schedule_key: finalKey,
    schedule_name: scheduleName ? scheduleName.slice(0, 200) : undefined,
    data: isDefaultKey
      ? { leagues: [], teams: [], games: [] }
      : { leagues: data.leagues, teams: data.teams, games: data.games }
  };

  return withFreshToken(async () => {
    try {
      const record = await pocketbaseClient!
        .collection(scheduleCollection!)
        .getFirstListItem(`schedule_key="${finalKey}"`);

      // Verify the record belongs to the calling user's org before updating.
      // Records with empty org_id/user_id are legacy (published before auth was
      // configured) and are treated as belonging to the app, not blocked.
      const safeOrgIdCheck = sanitizeFilterValue(context?.orgId);
      if (safeOrgIdCheck && record.org_id !== '' && record.org_id !== safeOrgIdCheck) {
        return { ok: false, reason: 'Schedule not found or access denied.' };
      }
      if (!safeOrgIdCheck && context?.userId) {
        const safeUserIdCheck = sanitizeFilterValue(context.userId);
        if (safeUserIdCheck && record.user_id !== '' && record.user_id !== safeUserIdCheck) {
          return { ok: false, reason: 'Schedule not found or access denied.' };
        }
      }

      // Preserve existing org_id/user_id on update if context doesn't supply them,
      // so an unauthenticated auto-save never clears ownership fields.
      const updatePayload: Record<string, unknown> = { ...payload };
      if (updatePayload.org_id === undefined && record.org_id) {
        delete updatePayload.org_id;
      }
      if (updatePayload.user_id === undefined && record.user_id) {
        delete updatePayload.user_id;
      }
      await pocketbaseClient!.collection(scheduleCollection!).update(record.id, updatePayload);
      return { ok: true };
    } catch (error) {
      try {
        await pocketbaseClient!.collection(scheduleCollection!).create(payload);
        return { ok: true };
      } catch (createError) {
        console.warn('PocketBase schedule publish failed.', createError);
        return { ok: false, reason: formatPocketbaseError(createError) };
      }
    }
  });
};

export const persistStorageData = async (
  data: StorageData,
  context?: StorageContext,
): Promise<boolean> => {
  localStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(data.leagues));
  localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(data.teams));
  localStorage.setItem(STORAGE_KEYS.games, JSON.stringify(data.games));
  localStorage.setItem(STORAGE_KEYS.gamesInHoldingArea, JSON.stringify(data.gamesInHoldingArea));

  // Only persist the working copy (app_state). The published schedule is only
  // updated when the user explicitly clicks Publish — not on every auto-save.
  // Auto-syncing overwrote published games whenever the local state was empty.
  await saveToPocketBase(data, context);
  return true;
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
  const baseFilters: string[] = [];
  if (options?.onlyActive) {
    baseFilters.push('active=true');
  }
  const scopedFilters = [...baseFilters];
  const safeOrgId = sanitizeFilterValue(context?.orgId);
  if (safeOrgId) {
    scopedFilters.push(`(org_id="${safeOrgId}" || org_id="")`);
  } else if (context?.userId) {
    // If user has userId but no orgId, filter by userId only
    const safeUserId = sanitizeFilterValue(context.userId);
    if (safeUserId) {
      scopedFilters.push(`(user_id="${safeUserId}" || user_id="")`);
    }
  }
  const scopedFilter = scopedFilters.join(' && ');
  return withFreshToken(async () => {
    try {
      const data = await pocketbaseClient!
        .collection(scheduleCollection!)
        .getList(1, 200, { filter: scopedFilter });
      const items = data.items || [];
      return items
        .map((item: any) => ({
          id: item.id,
          scheduleKey: item.schedule_key || 'default',
          scheduleName: item.schedule_name || undefined,
          active: item.active !== false
        }))
        .filter((item: PublishedScheduleSummary) => item.scheduleKey)
        .sort((a, b) => (a.scheduleName || a.scheduleKey).localeCompare(b.scheduleName || b.scheduleKey));
    } catch (error) {
      console.warn('PocketBase schedule list failed.', error);
      return [];
    }
  });
};

export const deletePublishedSchedule = async (
  recordId: string,
  context?: StorageContext
): Promise<{ ok: boolean; reason?: string }> => {
  if (!pocketbaseClient || !scheduleCollection) {
    return { ok: false, reason: 'PocketBase is not configured.' };
  }
  try {
    // First verify the schedule belongs to the user's org.
    // Legacy records with empty org_id/user_id are accessible to any app user.
    const record = await pocketbaseClient.collection(scheduleCollection).getOne(recordId);
    const safeOrgId = sanitizeFilterValue(context?.orgId);
    if (safeOrgId && record.org_id !== '' && record.org_id !== safeOrgId) {
      return { ok: false, reason: 'Schedule not found or access denied.' };
    }
    // If user has userId but no orgId, verify by userId
    if (!safeOrgId && context?.userId) {
      const safeUserId = sanitizeFilterValue(context.userId);
      if (safeUserId && record.user_id !== '' && record.user_id !== safeUserId) {
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
    // First verify the schedule belongs to the user's org.
    // Legacy records with empty org_id/user_id are accessible to any app user.
    const record = await pocketbaseClient.collection(scheduleCollection).getOne(recordId);
    const safeOrgId = sanitizeFilterValue(context?.orgId);
    if (safeOrgId && record.org_id !== '' && record.org_id !== safeOrgId) {
      return { ok: false, reason: 'Schedule not found or access denied.' };
    }
    // If user has userId but no orgId, verify by userId
    if (!safeOrgId && context?.userId) {
      const safeUserId = sanitizeFilterValue(context.userId);
      if (safeUserId && record.user_id !== '' && record.user_id !== safeUserId) {
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
      .getFirstListItem(`schedule_key="${safeKey}" && active=true`);
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
    
    // Verify the schedule belongs to the user's org.
    // Records with empty org_id/user_id are legacy (published before auth was
    // configured) and are treated as belonging to the app, not blocked.
    const safeOrgId = sanitizeFilterValue(context?.orgId);
    if (safeOrgId && record.org_id !== '' && record.org_id !== safeOrgId) {
      console.warn('Schedule access denied: org_id mismatch');
      return null;
    }
    // If user has userId but no orgId, verify by userId
    if (!safeOrgId && context?.userId) {
      const safeUserId = sanitizeFilterValue(context.userId);
      if (safeUserId && record.user_id !== '' && record.user_id !== safeUserId) {
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

// ─── Score Links ─────────────────────────────────────────────────────────────

const scoreLinkFromRecord = (r: any): ScoreLink => ({
  id:          r.id,
  token:       r.token,
  gameId:      r.game_id,
  scheduleKey: r.schedule_key,
  orgId:       r.org_id || undefined,
  userId:      r.user_id || undefined,
  disabled:    r.disabled === true,
  expiresAt:   r.expires_at,
  created:     r.created,
});

export const createScoreLink = async (
  link: Omit<ScoreLink, 'id' | 'created'>
): Promise<ScoreLink | null> => {
  if (!pocketbaseClient) return null;
  try {
    const record = await pocketbaseClient.collection(scoreLinksCollection).create({
      token:        link.token,
      game_id:      link.gameId,
      schedule_key: link.scheduleKey,
      org_id:       link.orgId || '',
      user_id:      link.userId || '',
      disabled:     false,
      expires_at:   link.expiresAt.replace('T', ' '),
    });
    return scoreLinkFromRecord(record);
  } catch (error: any) {
    console.warn('createScoreLink failed', error);
    return null;
  }
};

export const listScoreLinks = async (
  context?: StorageContext,
  scheduleKey?: string
): Promise<ScoreLink[]> => {
  if (!pocketbaseClient) return [];
  try {
    const filters: string[] = [];
    const safeOrgId  = sanitizeFilterValue(context?.orgId);
    const safeUserId = sanitizeFilterValue(context?.userId);
    if (safeOrgId)       filters.push(`org_id="${safeOrgId}"`);
    else if (safeUserId) filters.push(`user_id="${safeUserId}"`);
    if (scheduleKey) {
      const safeKey = sanitizeFilterValue(scheduleKey);
      if (safeKey) filters.push(`schedule_key="${safeKey}"`);
    }
    const filter = filters.join(' && ');
    const result = await pocketbaseClient
      .collection(scoreLinksCollection)
      .getList(1, 500, { filter });
    return (result.items || []).map(scoreLinkFromRecord);
  } catch (error) {
    console.warn('listScoreLinks failed', error);
    return [];
  }
};

export const updateScoreLink = async (
  id: string,
  data: Partial<Pick<ScoreLink, 'disabled'>>,
  context?: StorageContext
): Promise<boolean> => {
  if (!pocketbaseClient) return false;
  try {
    // Verify the record belongs to the calling user's org before modifying
    const record = await pocketbaseClient.collection(scoreLinksCollection).getOne(id);
    const safeOrgId = sanitizeFilterValue(context?.orgId);
    if (safeOrgId && record.org_id !== safeOrgId) {
      console.warn('updateScoreLink: access denied (org_id mismatch)');
      return false;
    }
    if (!safeOrgId && context?.userId) {
      const safeUserId = sanitizeFilterValue(context.userId);
      if (safeUserId && record.user_id !== safeUserId) {
        console.warn('updateScoreLink: access denied (user_id mismatch)');
        return false;
      }
    }
    const payload: Record<string, unknown> = {};
    if (data.disabled !== undefined) payload.disabled = data.disabled;
    await pocketbaseClient.collection(scoreLinksCollection).update(id, payload);
    return true;
  } catch (error) {
    console.warn('updateScoreLink failed', error);
    return false;
  }
};

export const validateScoreLink = async (token: string): Promise<ScoreLink | null> => {
  if (!pocketbaseClient || !token) return null;
  const safeToken = token.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  if (!safeToken) return null;
  try {
    const record = await pocketbaseClient
      .collection(scoreLinksCollection)
      .getFirstListItem(`token="${safeToken}" && disabled=false`);
    const link = scoreLinkFromRecord(record);
    if (new Date(link.expiresAt) < new Date()) return null;
    return link;
  } catch {
    return null;
  }
};

// ─── Score Edits (overlay) ────────────────────────────────────────────────────

const scoreEditFromRecord = (r: any): ScoreEdit => ({
  id:          r.id,
  gameId:      r.game_id,
  scheduleKey: r.schedule_key,
  token:       r.token,
  status:      r.status,
  scores:      r.scores || undefined,
  recap:       r.recap || undefined,
  linescore:   !!r.linescore,
  hits:        { away: r.hits_away   ?? null, home: r.hits_home   ?? null },
  errors:      { away: r.errors_away ?? null, home: r.errors_home ?? null },
  updated:     r.updated,
});

export const saveScoreEdit = async (edit: Omit<ScoreEdit, 'id' | 'updated'>): Promise<boolean> => {
  if (!pocketbaseClient) return false;
  const safeKey    = sanitizeFilterValue(edit.scheduleKey);
  const safeGameId = edit.gameId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  const safeToken  = edit.token.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  if (!safeKey || !safeGameId || !safeToken) return false;

  // Re-validate the token server-side: verify it exists, is not disabled, not expired,
  // and actually corresponds to the game and schedule being edited.
  try {
    const linkRecord = await pocketbaseClient
      .collection(scoreLinksCollection)
      .getFirstListItem(`token="${safeToken}" && disabled=false`);
    if (
      linkRecord.game_id !== safeGameId ||
      linkRecord.schedule_key !== safeKey ||
      new Date(linkRecord.expires_at) < new Date()
    ) {
      console.warn('saveScoreEdit: token mismatch or expired');
      return false;
    }
  } catch {
    console.warn('saveScoreEdit: invalid or unknown token');
    return false;
  }

  try {
    let existingId: string | null = null;
    try {
      const existing = await pocketbaseClient
        .collection(scoreEditsCollection)
        .getFirstListItem(`game_id="${safeGameId}" && schedule_key="${safeKey}"`);
      existingId = existing.id;
    } catch { /* no existing record – will create */ }

    const payload = {
      game_id:      safeGameId,
      schedule_key: safeKey,
      token:        safeToken,
      status:       edit.status,
      scores:       edit.scores ?? null,
      recap:        edit.recap ?? '',
      linescore:    edit.linescore ?? false,
      hits_away:    edit.hits?.away   ?? null,
      hits_home:    edit.hits?.home   ?? null,
      errors_away:  edit.errors?.away ?? null,
      errors_home:  edit.errors?.home ?? null,
    };
    if (existingId) {
      await pocketbaseClient.collection(scoreEditsCollection).update(existingId, payload);
    } else {
      await pocketbaseClient.collection(scoreEditsCollection).create(payload);
    }
    return true;
  } catch (error) {
    console.warn('saveScoreEdit failed', error);
    return false;
  }
};

export const listScoreEditsByScheduleKey = async (scheduleKey: string): Promise<ScoreEdit[]> => {
  if (!pocketbaseClient || !scheduleKey) return [];
  const safeKey = sanitizeFilterValue(scheduleKey);
  if (!safeKey) return [];
  try {
    const result = await pocketbaseClient
      .collection(scoreEditsCollection)
      .getList(1, 1000, { filter: `schedule_key="${safeKey}"` });
    return (result.items || []).map(scoreEditFromRecord);
  } catch (error) {
    console.warn('listScoreEditsByScheduleKey failed', error);
    return [];
  }
};

// ─── Tenant / SaaS ────────────────────────────────────────────────────────────

const tenantFromRecord = (r: any): Tenant => {
  const plan: TenantPlan = (['free', 'starter', 'pro', 'enterprise'].includes(r.plan)
    ? r.plan
    : 'free') as TenantPlan;
  const planDefaults = PLAN_LIMITS[plan];
  return {
    id:          r.id,
    orgId:       r.org_id,
    name:        r.name || '',
    plan,
    limits: {
      leagues:            r.limits?.leagues            ?? planDefaults.leagues,
      teams:              r.limits?.teams              ?? planDefaults.teams,
      scoreLinks:         r.limits?.scoreLinks         ?? planDefaults.scoreLinks,
      publishedSchedules: r.limits?.publishedSchedules ?? planDefaults.publishedSchedules,
    },
    active:      r.active !== false,
    trialEndsAt: r.trial_ends_at || undefined,
    branding:    r.branding     || undefined,
    created:     r.created,
  };
};

/**
 * Load the tenant record for a given org_id.
 * Returns null if the tenant is not found or PocketBase is not configured.
 */
export const loadTenant = async (orgId: string): Promise<Tenant | null> => {
  if (!pocketbaseClient || !orgId) return null;
  const safeOrgId = sanitizeFilterValue(orgId);
  if (!safeOrgId) return null;
  return withFreshToken(async () => {
    try {
      const record = await pocketbaseClient!
        .collection(tenantsCollection)
        .getFirstListItem(`org_id="${safeOrgId}"`);
      return tenantFromRecord(record);
    } catch {
      return null;
    }
  });
};

/**
 * Create a new tenant record. Intended for system admins / onboarding flow.
 */
export const createTenant = async (
  tenant: Omit<Tenant, 'id' | 'created'>
): Promise<Tenant | null> => {
  if (!pocketbaseClient) return null;
  const safeOrgId = sanitizeFilterValue(tenant.orgId);
  if (!safeOrgId) return null;
  try {
    const record = await pocketbaseClient.collection(tenantsCollection).create({
      org_id:        safeOrgId,
      name:          tenant.name.slice(0, 200),
      plan:          tenant.plan,
      limits:        tenant.limits,
      active:        tenant.active,
      trial_ends_at: tenant.trialEndsAt || null,
      branding:      tenant.branding    || null,
    });
    return tenantFromRecord(record);
  } catch (error) {
    console.warn('createTenant failed', error);
    return null;
  }
};

/**
 * Update mutable tenant fields (plan, limits, active, branding, trialEndsAt).
 * The record id must be known (from a previous loadTenant call).
 */
export const updateTenant = async (
  id: string,
  patch: Partial<Pick<Tenant, 'plan' | 'limits' | 'active' | 'trialEndsAt' | 'branding' | 'name'>>
): Promise<Tenant | null> => {
  if (!pocketbaseClient || !id) return null;
  const payload: Record<string, unknown> = {};
  if (patch.name          !== undefined) payload.name           = patch.name.slice(0, 200);
  if (patch.plan          !== undefined) payload.plan           = patch.plan;
  if (patch.limits        !== undefined) payload.limits         = patch.limits;
  if (patch.active        !== undefined) payload.active         = patch.active;
  if (patch.trialEndsAt   !== undefined) payload.trial_ends_at  = patch.trialEndsAt || null;
  if (patch.branding      !== undefined) payload.branding       = patch.branding    || null;
  try {
    const record = await pocketbaseClient.collection(tenantsCollection).update(id, payload);
    return tenantFromRecord(record);
  } catch (error) {
    console.warn('updateTenant failed', error);
    return null;
  }
};

/**
 * List ALL tenants — for system admins only.
 * No org/user scoping applied.
 */
export const listAllTenants = async (): Promise<Tenant[]> => {
  if (!pocketbaseClient) return [];
  return withFreshToken(async () => {
    try {
      const result = await pocketbaseClient!
        .collection(tenantsCollection)
        .getList(1, 500, { sort: '-created' });
      return (result.items || []).map(tenantFromRecord);
    } catch (error) {
      console.warn('listAllTenants failed', error);
      return [];
    }
  });
};

// ─── Real-time subscriptions ──────────────────────────────────────────────────

/**
 * Subscribe to score_edits for a given scheduleKey.
 * Fires callback immediately on create or update for matching records.
 * Returns a cleanup function — call it on unmount.
 * Silently degrades to no-op if SSE is unavailable (e.g. nginx not yet
 * configured for HTTP/1.1 keep-alive); callers should use a fallback poll.
 */
export const subscribeScoreEdits = (
  scheduleKey: string,
  callback: (edit: ScoreEdit) => void,
): (() => void) => {
  if (!pocketbaseClient || !scoreEditsCollection) return () => {};
  let unsubFn: (() => Promise<void>) | null = null;
  pocketbaseClient
    .collection(scoreEditsCollection)
    .subscribe('*', (e) => {
      if (
        (e.action === 'create' || e.action === 'update') &&
        e.record.schedule_key === scheduleKey
      ) {
        callback(scoreEditFromRecord(e.record));
      }
    })
    .then(fn => { unsubFn = fn; })
    .catch(() => { /* SSE unavailable — fallback poll handles updates */ });
  return () => { unsubFn?.(); };
};

/**
 * Subscribe to published_schedules for a given scheduleKey.
 * Fires callback with fresh StorageData whenever the schedule record is updated.
 * Returns a cleanup function — call it on unmount.
 * Silently degrades to no-op if SSE is unavailable.
 */
export const subscribePublishedSchedule = (
  scheduleKey: string,
  callback: (data: StorageData) => void,
): (() => void) => {
  if (!pocketbaseClient || !scheduleCollection) return () => {};
  const safeKey = sanitizeFilterValue(scheduleKey);
  if (!safeKey) return () => {};
  let unsubFn: (() => Promise<void>) | null = null;
  pocketbaseClient
    .collection(scheduleCollection)
    .subscribe('*', (e) => {
      if (
        e.action === 'update' &&
        e.record.schedule_key === safeKey &&
        e.record.active === true
      ) {
        const data = (e.record as any).data as Partial<StorageData> | undefined;
        if (data) {
          callback({
            leagues: data.leagues || [],
            teams:   data.teams   || [],
            games:   data.games   || [],
            gamesInHoldingArea: [],
          });
        }
      }
    })
    .then(fn => { unsubFn = fn; })
    .catch(() => { /* SSE unavailable — fallback poll handles updates */ });
  return () => { unsubFn?.(); };
};
