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

/**
 * latest.json returns a plain JSON number — the current play sequence number.
 * (No wrapper object.)
 */

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
  /** Index 0 is null (placeholder); indices 1…N are runs for innings 1…N.
   *  WBSC uses "x" when the home team did not bat in the last inning. */
  awayruns: (number | string | null)[];
  homeruns: (number | string | null)[];
  awaytotals: { R: number; H: number; E: number; LOB: number };
  hometotals: { R: number; H: number; E: number; LOB: number };
}

/** play{n}.json — single entry in the playdata array */
interface WbscPlayEntry {
  t: string;   // timestamp ms
  p: string;   // play id
  n: string;   // play description  ← what we display
  b: string;   // numeric WBSC player ID (not a display name)
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

/** play{n}.json — single boxscore player entry (keyed by numeric player ID) */
interface WbscBoxscorePlayer {
  NAME?:   string;
  PITCHES?: number;
  [key: string]: unknown;
}

/** Full play{n}.json response */
export interface WbscPlayDataResponse {
  situation: WbscSituation;
  linescore: WbscLinescore;
  playdata:  WbscPlayEntry[];
  /** Flat map of player-id → stats; present for pitch counts and batting lines */
  boxscore?: Record<string, WbscBoxscorePlayer>;
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
  inningNumber?: number;
  inningHalf?:   'top' | 'bottom';
  pitcher?:    string;
  pitchCount?: number;
  batter?:     string;
  batting?:    string;  // e.g. "1 for 4"
  avg?:        string;  // e.g. ".250"
  hits?:   { away: number | null; home: number | null };
  errors?: { away: number | null; home: number | null };
}

// ── Internal fetch helpers ────────────────────────────────────────────────────

async function fetchLastPlay(wbscGameId: string): Promise<number> {
  const res = await fetch(
    `/wbsc-proxy/last-play?gameId=${encodeURIComponent(wbscGameId)}`,
    { signal: AbortSignal.timeout(3_000) },
  );
  if (!res.ok) throw new Error(`last-play ${res.status}`);
  const data = await res.json();
  const n = typeof data === 'number' ? data : Number(data?.number ?? data?.latestpn ?? NaN);
  if (!Number.isFinite(n)) throw new Error('last-play: unexpected response shape');
  return n;
}

async function fetchPlayData(
  wbscGameId: string,
  playNumber: number,
): Promise<WbscPlayDataResponse> {
  const res = await fetch(
    `/wbsc-proxy/play-data?gameId=${encodeURIComponent(wbscGameId)}&playNumber=${playNumber}`,
    { signal: AbortSignal.timeout(3_000) },
  );
  if (!res.ok) throw new Error(`play-data ${res.status}`);
  return (await res.json()) as WbscPlayDataResponse;
}

// ── Data mapping ──────────────────────────────────────────────────────────────

/** Strip HTML tags from a WBSC description string.
 *  <br> tags become " · " so multi-line descriptions stay readable as one line. */
const stripHtml = (s: string): string =>
  s.replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim();

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

/** Convert a WBSC linescore cell to a number or null.
 *  "x" means the home team did not bat — treat as null (not scored). */
const toScore = (v: number | string | null | undefined): number | null => {
  if (v == null || v === 'x' || v === 'X') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Build innings array from WBSC linescore arrays.
 * WBSC uses index 0 as a null placeholder; innings start at index 1.
 */
function buildInnings(
  awayruns: (number | string | null)[],
  homeruns: (number | string | null)[],
): Array<{ home: number | null; away: number | null }> {
  const len = Math.max(awayruns.length, homeruns.length);
  const innings: Array<{ home: number | null; away: number | null }> = [];
  for (let i = 1; i < len; i++) {
    innings.push({
      away: toScore(awayruns[i]),
      home: toScore(homeruns[i]),
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
  const { situation, linescore, playdata, boxscore } = data;

  // Play description: first entry in playdata array, field "n" (strip HTML tags)
  const description = playdata[0]?.n ? stripHtml(playdata[0].n) || undefined : undefined;

  // Inning — derived from currentinning string (e.g. "BOT 10", "TOP 5")
  const parsedInning = parseCurrentInning(situation.currentinning ?? '');
  const inningNumber = parsedInning.number ? Number(parsedInning.number) : undefined;
  const inningHalf: 'top' | 'bottom' | undefined =
    parsedInning.half === 'TOP'    ? 'top' :
    parsedInning.half === 'BOTTOM' ? 'bottom' :
    undefined;

  // Linescore → innings array
  const innings = buildInnings(linescore.awayruns, linescore.homeruns);

  // Pitch count — find the current pitcher's entry in the boxscore by name match
  let pitchCount: number | undefined;
  const pitcherName = (situation.pitcher || '').trim().toUpperCase();
  if (boxscore && pitcherName) {
    for (const entry of Object.values(boxscore)) {
      if (!entry || typeof entry !== 'object') continue;
      const entryName = (entry.NAME ?? '').toString().trim().toUpperCase();
      const pWords = pitcherName.split(/\s+/).filter(w => w.length > 2);
      const eWords = entryName.split(/\s+/).filter(w => w.length > 2);
      if (entryName && pWords.length && eWords.length && pWords.some(w => eWords.includes(w))) {
        const raw = entry.PITCHES ?? entry['NP'];
        const count = typeof raw === 'number' ? raw
          : typeof raw === 'string' ? parseInt(raw, 10)
          : NaN;
        if (Number.isFinite(count) && count > 0) {
          pitchCount = count;
          break;
        }
      }
    }
  }

  return {
    playNumber:  latestpn,
    description,
    status: mapStatus(rawStatus ?? situation.currentinning),
    innings,
    outs:    Math.min(situation.outs,    2),
    balls:   Math.min(situation.balls,   3),
    strikes: Math.min(situation.strikes, 2),
    baseRunners: {
      first:  situation.runner1 !== 0,
      second: situation.runner2 !== 0,
      third:  situation.runner3 !== 0,
    },
    inningNumber: Number.isFinite(inningNumber) ? inningNumber : undefined,
    inningHalf,
    pitcher:    situation.pitcher || undefined,
    pitchCount,
    batter:     situation.batter  || undefined,
    batting:    situation.batting || undefined,
    avg:        situation.avg     || undefined,
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
  // fetchLastPlay throws on any HTTP / network / parse error; returns plain number
  const playNumber = await fetchLastPlay(wbscGameId);
  if (playNumber === lastKnownPlay) return null; // no new play since last tick

  // fetchPlayData throws on any HTTP / network / parse error
  const playData = await fetchPlayData(wbscGameId, playNumber);
  return mapPlayData(playNumber, playData, undefined);
}

/**
 * Parse the playdata array for extra-base hits (HR, 3B, 2B).
 * Returns a formatted string like "HR: Smith · 3B: Jones · 2B: Williams, Davis"
 * or an empty string if none found.
 *
 * play.b is a numeric WBSC player ID — not usable as a display name.
 * The name is extracted from play.n: if the hit keyword appears mid-segment
 * (e.g. "Smith J. HOME RUN (1)") the text before the keyword is the name;
 * otherwise the first segment that doesn't contain a hit keyword is used.
 */
function parseHittingHighlights(plays: WbscPlayEntry[]): string {
  const hr: string[] = [], triples: string[] = [], doubles: string[] = [];

  plays.forEach(play => {
    const upper = (play.n ?? '').toUpperCase();
    if (!upper.includes('HOME RUN') && !upper.includes('TRIPLE') && !upper.includes('DOUBLE')) return;

    const segments = (play.n ?? '')
      .replace(/<br\s*\/?>/gi, '|')
      .replace(/<[^>]+>/g, '')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);

    // Find the player name from description segments only (play.b is a numeric ID).
    // Strategy: if a segment contains the hit keyword, the name precedes it.
    // Otherwise use the first segment that doesn't look like a stat or keyword line.
    const HIT_KEYWORDS = /\b(HOME RUN|TRIPLE|DOUBLE|SINGLE|BALL|STRIKE|FOUL|SCORE|WALK|OUT|INNING|GAME|WIN|LOSS)\b/i;
    let player = '';
    for (const seg of segments) {
      const segUpper = seg.toUpperCase();
      const kwIdx = segUpper.search(/\b(HOME RUN|TRIPLE|DOUBLE)\b/);
      if (kwIdx > 0) {
        // Name is before the keyword on the same line
        player = seg.slice(0, kwIdx).trim();
        break;
      }
      if (!HIT_KEYWORDS.test(seg) && !/^\d/.test(seg) && seg.length > 1) {
        player = seg;
        break;
      }
    }

    if (upper.includes('HOME RUN')) {
      if (player) hr.push(player);
    } else if (upper.includes('TRIPLE')) {
      if (player) triples.push(player);
    } else if (upper.includes('DOUBLE') && !upper.includes('DOUBLE PLAY') && !upper.includes('DOUBLE STEAL')) {
      if (player) doubles.push(player);
    }
  });

  const unique = (arr: string[]) => [...new Set(arr)];
  const parts: string[] = [];
  if (hr.length)      parts.push(`HR: ${unique(hr).join(', ')}`);
  if (triples.length) parts.push(`3B: ${unique(triples).join(', ')}`);
  if (doubles.length) parts.push(`2B: ${unique(doubles).join(', ')}`);
  return parts.join(' · ');
}

/**
 * Fetch extra-base hitting highlights for a WBSC game.
 * Returns a formatted string or empty string if no hits found or on error.
 */
export async function fetchWbscHittingHighlights(wbscGameId: string): Promise<string> {
  const playNumber = await fetchLastPlay(wbscGameId);
  const playData   = await fetchPlayData(wbscGameId, playNumber);
  return parseHittingHighlights(playData.playdata);
}
