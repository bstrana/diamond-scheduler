/**
 * WBSC live game data integration.
 *
 * Each 5-second poll cycle makes two calls through the server-side proxy
 * (which forwards to game.wbsc.org and avoids browser CORS):
 *
 *   1. GET /wbsc-proxy/last-play?gameId={id}
 *        ← https://game.wbsc.org/gamedata/{gameid}/latest.json
 *        Response field: latestpn  (latest play sequence number)
 *
 *   2. GET /wbsc-proxy/play-data?gameId={id}&playNumber={n}
 *        ← https://game.wbsc.org/gamedata/{gameid}/play{n}.json
 *        Relevant sections: situation, linescore, playdata[0].n
 */

// ── WBSC API response shapes ──────────────────────────────────────────────────

/** latest.json */
export interface WbscLastPlayResponse {
  latestpn: number;   // confirmed field name
  status?: string;    // present only in some tournament setups
}

/** play{n}.json — situation block */
interface WbscSituation {
  currentinning: string;  // e.g. "BOT 10", "TOP 5"
  pitcher:  string;       // "ĆURKOVIĆ Ante"  (defense — current pitcher)
  batter:   string;       // "CRNJAK Bartol"  (offense — current batter)
  batting:  string;       // "1 for 4"
  avg:      string;       // ".250"
  runner1:  number;       // 0 = empty, non-zero = runner on first
  runner2:  number;       // 0 = empty, non-zero = runner on second
  runner3:  number;       // 0 = empty, non-zero = runner on third
  outs:     number;       // 0-3
  balls:    number;       // 0-4
  strikes:  number;       // 0-3
  inning:   string;       // "10.1" (inning.out notation — informational)
  extrainnings: string | null;
}

/** play{n}.json — linescore block */
interface WbscLinescore {
  /** Index 0 is null (placeholder); indices 1…N are runs for innings 1…N */
  awayruns: (number | null)[];
  homeruns: (number | null)[];
  awaytotals: { R: number; H: number; E: number; LOB: number };
  hometotals: { R: number; H: number; E: number; LOB: number };
}

/** play{n}.json — single entry in the playdata array */
interface WbscPlayEntry {
  t: string;   // timestamp ms
  p: string;   // play id
  n: string;   // play description  ← what we display
  b: string;
  a: string;
  r1: string;
  r2: string;
  i: string;
  x: string;
  y: string;
  hd: string;
  hp: string;
  hl: string;
}

/** Full play{n}.json response */
export interface WbscPlayDataResponse {
  situation: WbscSituation;
  linescore: WbscLinescore;
  playdata:  WbscPlayEntry[];
}

// ── Mapped game state (what score-edit.tsx consumes) ─────────────────────────

export interface WbscGameState {
  playNumber:  number;
  description?: string;
  status: 'live' | 'final' | 'postponed';
  innings: Array<{ home: number | null; away: number | null }>;
  outs:    number;
  balls:   number;
  strikes: number;
  baseRunners: { first: boolean; second: boolean; third: boolean };
  pitcher?: string;
  hits?:   { away: number | null; home: number | null };
  errors?: { away: number | null; home: number | null };
}

// ── Internal fetch helpers ────────────────────────────────────────────────────

async function fetchLastPlay(wbscGameId: string): Promise<WbscLastPlayResponse | null> {
  try {
    const res = await fetch(
      `/wbsc-proxy/last-play?gameId=${encodeURIComponent(wbscGameId)}`,
      { signal: AbortSignal.timeout(4_000) },
    );
    if (!res.ok) return null;
    return (await res.json()) as WbscLastPlayResponse;
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

/**
 * Parse "BOT 10" / "TOP 5" → { half: 'BOTTOM'|'TOP', number: 10 }
 * Falls back gracefully when the string has an unexpected format.
 */
function parseCurrentInning(raw: string): { number: string; half: 'TOP' | 'BOTTOM' | null } {
  const parts = raw.trim().toUpperCase().split(/\s+/);
  const halfStr = parts[0] ?? '';
  const numStr  = parts[1] ?? '';
  const half: 'TOP' | 'BOTTOM' | null =
    halfStr === 'TOP' ? 'TOP' :
    halfStr === 'BOT' ? 'BOTTOM' :
    null;
  return { number: numStr || '—', half };
}

/**
 * Build innings array from WBSC linescore arrays.
 * WBSC uses index 0 as a null placeholder; innings start at index 1.
 */
function buildInnings(
  awayruns: (number | null)[],
  homeruns: (number | null)[],
): Array<{ home: number | null; away: number | null }> {
  const len = Math.max(awayruns.length, homeruns.length);
  const innings: Array<{ home: number | null; away: number | null }> = [];
  for (let i = 1; i < len; i++) {
    innings.push({
      away: awayruns[i] ?? null,
      home: homeruns[i] ?? null,
    });
  }
  return innings.length > 0 ? innings : [{ home: null, away: null }];
}

function mapStatus(raw: string | undefined): WbscGameState['status'] {
  if (!raw) return 'live';
  const s = raw.toLowerCase();
  if (s.includes('final') || s.includes('complet') || s.includes('end')) return 'final';
  if (s.includes('postpone') || s.includes('cancel') || s.includes('suspend')) return 'postponed';
  return 'live';
}

function mapPlayData(
  latestpn: number,
  data: WbscPlayDataResponse,
  rawStatus: string | undefined,
): WbscGameState {
  const { situation, linescore, playdata } = data;

  // Play description: first entry in playdata array, field "n"
  const description = playdata[0]?.n?.trim() || undefined;

  // Inning — derived from currentinning string (e.g. "BOT 10")
  // (Not stored in WbscGameState directly; used only for future extension.)
  const _inning = parseCurrentInning(situation.currentinning ?? '');
  void _inning; // currently informational; remove void if you add it to the state shape

  // Linescore → innings array
  const innings = buildInnings(linescore.awayruns, linescore.homeruns);

  return {
    playNumber:  latestpn,
    description,
    status: mapStatus(rawStatus),
    innings,
    outs:    Math.min(situation.outs,    2),
    balls:   Math.min(situation.balls,   3),
    strikes: Math.min(situation.strikes, 2),
    baseRunners: {
      first:  situation.runner1 !== 0,
      second: situation.runner2 !== 0,
      third:  situation.runner3 !== 0,
    },
    pitcher: situation.pitcher || undefined,
    hits: {
      away: linescore.awaytotals.H ?? null,
      home: linescore.hometotals.H ?? null,
    },
    errors: {
      away: linescore.awaytotals.E ?? null,
      home: linescore.hometotals.E ?? null,
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the latest WBSC game state.
 *
 * Returns null when:
 * - Either API call fails (network / proxy error)
 * - The play number has not advanced past lastKnownPlay (no new play yet)
 *
 * @param wbscGameId     WBSC numeric game ID stored on the Game record.
 * @param lastKnownPlay  Play number from the previous successful fetch (-1 on first call).
 */
export async function fetchWbscGameState(
  wbscGameId: string,
  lastKnownPlay: number,
): Promise<WbscGameState | null> {
  const latest = await fetchLastPlay(wbscGameId);
  if (!latest) return null;
  if (latest.latestpn === lastKnownPlay) return null; // no new play since last tick

  const playData = await fetchPlayData(wbscGameId, latest.latestpn);
  if (!playData) return null;

  return mapPlayData(latest.latestpn, playData, latest.status);
}
