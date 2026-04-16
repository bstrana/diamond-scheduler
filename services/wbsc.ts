/**
 * WBSC live game data integration.
 *
 * Each 5-second poll cycle makes two calls through the server-side proxy
 * (which forwards to game.wbsc.org and avoids browser CORS):
 *
 *   1. GET /wbsc-proxy/last-play?gameId={id}
 *        ← https://game.wbsc.org/gamedata/{gameid}/latest.json
 *        → { latestpn: 42, … }
 *
 *   2. GET /wbsc-proxy/play-data?gameId={id}&playNumber={n}
 *        ← https://game.wbsc.org/gamedata/{gameid}/play{n}.json
 *        → full play record with score, count, runners, pitcher …
 *
 * The mapping functions below convert WBSC field names to the internal
 * model used by score-edit.tsx.  Field names inside WbscPlayDataResponse
 * should be adjusted once you inspect an actual play{n}.json response.
 */

// ── WBSC API response shapes ──────────────────────────────────────────────────

/**
 * Response from https://game.wbsc.org/gamedata/{gameid}/latest.json
 * Confirmed field: latestpn (latest play number).
 */
export interface WbscLastPlayResponse {
  /** Latest play sequence number — use this to fetch the matching play file. */
  latestpn: number;
  /**
   * Game status string if present in latest.json.
   * Adjust the field name and known values once you inspect a real response.
   */
  status?: string;
}

/** Response from the "play data" endpoint. */
export interface WbscPlayDataResponse {
  play_number: number;
  /** Human-readable description of the play, e.g. "Strike swinging". */
  description?: string;
  inning: {
    number: number;          // 1-based inning number
    /** Adjust if WBSC uses 'T'/'B' or 'top'/'bottom' instead. */
    half: 'TOP' | 'BOTTOM';
  };
  count: {
    outs: number;            // 0–3 (we cap at 2 in the UI)
    balls: number;           // 0–4 (we cap at 3 in the UI)
    strikes: number;         // 0–3 (we cap at 2 in the UI)
  };
  /** Which bases are occupied. Adjust field names to match actual API. */
  runners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  score: {
    home: number;
    away: number;
  };
  /** Per-inning line score. One entry per completed or in-progress inning. */
  linescore: Array<{
    inning: number;          // 1-based
    home: number | null;     // null = not yet played
    away: number | null;
  }>;
  /** Defensive lineup — used to extract the current pitcher's name. */
  defense?: {
    pitcher?: {
      name?: string;         // e.g. "Smith, J." — adjust path to actual API
    };
  };
}

// ── Mapped game state (what score-edit.tsx consumes) ─────────────────────────

export interface WbscGameState {
  playNumber: number;
  /** Plain-text play description for display. */
  description?: string;
  status: 'live' | 'final' | 'postponed';
  innings: Array<{ home: number | null; away: number | null }>;
  outs: number;
  balls: number;
  strikes: number;
  baseRunners: { first: boolean; second: boolean; third: boolean };
  pitcher?: string;
}

// ── Internal fetch helpers ────────────────────────────────────────────────────

async function fetchLastPlay(wbscGameId: string): Promise<WbscLastPlayResponse | null> {
  try {
    const res = await fetch(
      `/wbsc-proxy/last-play?gameId=${encodeURIComponent(wbscGameId)}`,
      { signal: AbortSignal.timeout(4_000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    // latest.json uses the field name "latestpn"
    return json as WbscLastPlayResponse;
  } catch {
    return null;
  }
}

async function fetchPlayData(
  wbscGameId: string,
  playNumber: number,
): Promise<WbscPlayDataResponse | null> {
  try {
    const res = await fetch(
      `/wbsc-proxy/play-data?gameId=${encodeURIComponent(wbscGameId)}&playNumber=${playNumber}`,
      { signal: AbortSignal.timeout(4_000) },
    );
    if (!res.ok) return null;
    return (await res.json()) as WbscPlayDataResponse;
  } catch {
    return null;
  }
}

// ── Data mapping ──────────────────────────────────────────────────────────────

function mapStatus(raw: string): WbscGameState['status'] {
  const s = raw.toLowerCase();
  if (s.includes('final') || s.includes('complet') || s.includes('end')) return 'final';
  if (s.includes('postpone') || s.includes('cancel') || s.includes('suspend')) return 'postponed';
  return 'live';
}

function mapPlayDataToState(
  playData: WbscPlayDataResponse,
  rawStatus: string,
): WbscGameState {
  // Build innings array from linescore; always have at least one row.
  const innings: WbscGameState['innings'] =
    playData.linescore.length > 0
      ? playData.linescore.map(row => ({ home: row.home, away: row.away }))
      : [{ home: null, away: null }];

  return {
    playNumber: playData.play_number,  // adjust field name once play{n}.json is inspected
    description: playData.description,
    status: mapStatus(rawStatus),
    innings,
    outs:    Math.min(playData.count.outs,    2),
    balls:   Math.min(playData.count.balls,   3),
    strikes: Math.min(playData.count.strikes, 2),
    baseRunners: {
      first:  !!playData.runners.first,
      second: !!playData.runners.second,
      third:  !!playData.runners.third,
    },
    pitcher: playData.defense?.pitcher?.name,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the latest WBSC game state.
 *
 * Returns `null` when:
 * - Either API call fails (network error, proxy misconfigured, etc.)
 * - The play number has not advanced past `lastKnownPlay` (no new data)
 *
 * @param wbscGameId   WBSC numeric game identifier stored on the Game record.
 * @param lastKnownPlay  Play number from the previous successful fetch (-1 on first call).
 */
export async function fetchWbscGameState(
  wbscGameId: string,
  lastKnownPlay: number,
): Promise<WbscGameState | null> {
  const lastPlay = await fetchLastPlay(wbscGameId);
  if (!lastPlay) return null;
  if (lastPlay.latestpn === lastKnownPlay) return null; // no new play since last tick

  const playData = await fetchPlayData(wbscGameId, lastPlay.latestpn);
  if (!playData) return null;

  return mapPlayDataToState(playData, lastPlay.status ?? '');
}
