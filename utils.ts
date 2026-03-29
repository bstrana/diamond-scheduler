import { Game, CalendarDay, Team, League } from './types';
import { WEEKDAYS } from './constants';
import i18n from './i18n';

export const generateUUID = (): string => {
  return crypto.randomUUID();
};

/**
 * Copies text to clipboard with a fallback for iframe/non-secure contexts
 * where navigator.clipboard may be unavailable.
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    document.body.appendChild(el);
    el.focus();
    el.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    document.body.removeChild(el);
  }
}

// Input validation utilities
const MAX_NAME_LENGTH = 100;
const MAX_CATEGORY_LENGTH = 50;
const MAX_ABBREVIATION_LENGTH = 10;
const MAX_CITY_LENGTH = 100;
const MAX_LOCATION_LENGTH = 200;

// Sanitize string to prevent XSS
export const sanitizeString = (input: string | undefined | null, maxLength: number = MAX_NAME_LENGTH): string => {
  if (!input || typeof input !== 'string') return '';
  // Remove HTML tags and dangerous characters
  let sanitized = input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove remaining angle brackets
    .trim();
  // Limit length
  return sanitized.slice(0, maxLength);
};

// Validate team name
export const validateTeamName = (name: string | undefined | null): { valid: boolean; error?: string } => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: 'Team name is required' };
  }
  const sanitized = sanitizeString(name, MAX_NAME_LENGTH);
  if (sanitized.length < 1) {
    return { valid: false, error: 'Team name must be at least 1 character' };
  }
  if (sanitized.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Team name must be ${MAX_NAME_LENGTH} characters or less` };
  }
  return { valid: true };
};

// Validate league name
export const validateLeagueName = (name: string | undefined | null): { valid: boolean; error?: string } => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: 'League name is required' };
  }
  const sanitized = sanitizeString(name, MAX_NAME_LENGTH);
  if (sanitized.length < 1) {
    return { valid: false, error: 'League name must be at least 1 character' };
  }
  if (sanitized.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `League name must be ${MAX_NAME_LENGTH} characters or less` };
  }
  return { valid: true };
};

// Validate category
export const validateCategory = (category: string | undefined | null): { valid: boolean; error?: string } => {
  if (!category || category.trim().length === 0) {
    return { valid: true }; // Category is optional
  }
  const sanitized = sanitizeString(category, MAX_CATEGORY_LENGTH);
  if (sanitized.length > MAX_CATEGORY_LENGTH) {
    return { valid: false, error: `Category must be ${MAX_CATEGORY_LENGTH} characters or less` };
  }
  return { valid: true };
};

// Validate abbreviation
export const validateAbbreviation = (abbr: string | undefined | null): { valid: boolean; error?: string } => {
  if (!abbr || typeof abbr !== 'string' || abbr.trim().length === 0) {
    return { valid: false, error: 'Abbreviation is required' };
  }
  const sanitized = sanitizeString(abbr, MAX_ABBREVIATION_LENGTH).toUpperCase();
  if (sanitized.length < 1 || sanitized.length > MAX_ABBREVIATION_LENGTH) {
    return { valid: false, error: `Abbreviation must be 1-${MAX_ABBREVIATION_LENGTH} characters` };
  }
  // Only allow alphanumeric characters
  if (!/^[A-Z0-9]+$/.test(sanitized)) {
    return { valid: false, error: 'Abbreviation can only contain letters and numbers' };
  }
  return { valid: true };
};

// Validate city
export const validateCity = (city: string | undefined | null): { valid: boolean; error?: string } => {
  if (!city || typeof city !== 'string' || city.trim().length === 0) {
    return { valid: false, error: 'City is required' };
  }
  const sanitized = sanitizeString(city, MAX_CITY_LENGTH);
  if (sanitized.length < 1) {
    return { valid: false, error: 'City must be at least 1 character' };
  }
  if (sanitized.length > MAX_CITY_LENGTH) {
    return { valid: false, error: `City must be ${MAX_CITY_LENGTH} characters or less` };
  }
  return { valid: true };
};

// Validate location
export const validateLocation = (location: string | undefined | null): { valid: boolean; error?: string } => {
  if (!location) {
    return { valid: true }; // Location is optional
  }
  const sanitized = sanitizeString(location, MAX_LOCATION_LENGTH);
  if (sanitized.length > MAX_LOCATION_LENGTH) {
    return { valid: false, error: `Location must be ${MAX_LOCATION_LENGTH} characters or less` };
  }
  return { valid: true };
};

export const formatDate = (date: Date): string => {
  // Use local time components to avoid UTC shifting issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMonthDays = (year: number, month: number, games: Game[]): CalendarDay[] => {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const daysInMonth = lastDayOfMonth.getDate();
  // Convert to Monday-first week: Sunday (0) -> 6, Monday (1) -> 0, etc.
  const startingWeekday = (firstDayOfMonth.getDay() + 6) % 7; // 0 (Mon) to 6 (Sun)
  
  const days: CalendarDay[] = [];
  
  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingWeekday - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, new Date()),
      games: getGamesForDate(date, games)
    });
  }
  
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, new Date()),
      games: getGamesForDate(date, games)
    });
  }
  
  // Next month padding (to fill 42 slots for a 6-row grid usually, or just enough to finish the week)
  const remainingSlots = 42 - days.length;
  for (let i = 1; i <= remainingSlots; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, new Date()),
      games: getGamesForDate(date, games)
    });
  }
  
  return days;
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const getGamesForDate = (date: Date, games: Game[]): Game[] => {
  const dateStr = formatDate(date);
  return games.filter(g => g.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
};

export const downloadJSON = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ─── Social share text builders ──────────────────────────────────────────────

/**
 * Builds a plain-text summary of a single game suitable for clipboard sharing.
 */
export function buildGameShareText(
  game: Game,
  home: Team,
  away: Team,
  leagueNames?: string[]
): string {
  const gameDate = new Date(game.date + 'T00:00:00');
  const dateStr = gameDate.toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' });

  const isScored = (game.status === 'live' || game.status === 'final') && game.scores != null;
  let line1: string;
  if (isScored) {
    const label = game.status === 'live' ? 'LIVE' : 'Final';
    line1 = `⚾ ${away.abbreviation} ${game.scores!.away} – ${home.abbreviation} ${game.scores!.home} | ${label}`;
  } else {
    line1 = `⚾ ${away.abbreviation} @ ${home.abbreviation}`;
  }

  const lines: string[] = [line1];
  const timePart = !isScored ? ` · ${game.time}` : '';
  lines.push(`${dateStr}${timePart}`);
  if (game.location) lines.push(game.location);
  if (game.seriesName) lines.push(game.seriesName);
  if (leagueNames && leagueNames.length > 0) lines.push(leagueNames.join(', '));

  // Inning-by-inning box score
  const innings = game.scores?.innings;
  if (isScored && innings && innings.length > 0) {
    const pad = (v: number | null, fallback = ' x') => v === null ? fallback : String(v).padStart(2);
    const header = '      ' + innings.map((_, i) => String(i + 1).padStart(2)).join('') + '   R';
    const awayRow = away.abbreviation.padEnd(6) + innings.map(inn => pad(inn.away, ' 0')).join('') + '  ' + String(game.scores!.away).padStart(2);
    const homeRow = home.abbreviation.padEnd(6) + innings.map(inn => pad(inn.home)).join('') + '  ' + String(game.scores!.home).padStart(2);
    lines.push('');
    lines.push(header);
    lines.push(awayRow);
    lines.push(homeRow);
  }

  if (game.recap) {
    lines.push('');
    lines.push(game.recap);
  }

  return lines.join('\n');
}

interface ShareStandingsRow {
  team: { abbreviation: string };
  w: number;
  l: number;
  pct: number;
  gb: number | null;
}

/**
 * Builds a plain-text standings table suitable for clipboard sharing.
 */
export function buildStandingsShareText(rows: ShareStandingsRow[], leagueName: string): string {
  const header = `🏆 ${leagueName} Standings`;
  const tableRows = rows.map((r, i) => {
    const rank = String(i + 1).padStart(2);
    const abbr = r.team.abbreviation.padEnd(6);
    const wl = `${r.w}-${r.l}`.padEnd(6);
    const pct = (r.w + r.l === 0 ? '.000' : r.pct.toFixed(3).replace(/^0/, '')).padStart(5);
    const gb = (r.gb === null || r.gb === 0
      ? '—'
      : r.gb % 1 === 0 ? String(r.gb) : r.gb.toFixed(1)
    ).padStart(4);
    return `${rank}. ${abbr} ${wl} ${pct}  ${gb}`;
  });
  return [header, '', ...tableRows].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────

export interface StandingsRow {
  team: Team;
  gp: number;
  w: number;
  l: number;
  pct: number;
  gb: number | null;
  rs: number;
  ra: number;
  diff: number;
}

function getGameLeagueIds(game: Game): string[] {
  if (game.leagueIds && game.leagueIds.length > 0) return game.leagueIds;
  if (game.leagueId) return [game.leagueId];
  return [];
}

export function calculateStandings(league: League, games: Game[]): StandingsRow[] {
  const completedGames = games.filter(game => {
    const isCompleted = game.status === 'final' || (game.status as string) === 'completed' || game.status === 'forfeit';
    const isExhibition = game.status === 'exhibition';
    return isCompleted && !isExhibition && game.scores != null && getGameLeagueIds(game).includes(league.id);
  });

  const stats = new Map<string, { w: number; l: number; rs: number; ra: number }>();
  league.teams.forEach(team => stats.set(team.id, { w: 0, l: 0, rs: 0, ra: 0 }));

  completedGames.forEach(game => {
    const home = stats.get(game.homeTeamId);
    const away = stats.get(game.awayTeamId);
    if (!home || !away || !game.scores) return;
    const hr = game.scores.home;
    const ar = game.scores.away;
    home.rs += hr; home.ra += ar;
    away.rs += ar; away.ra += hr;
    if (hr > ar) { home.w++; away.l++; }
    else if (ar > hr) { away.w++; home.l++; }
  });

  const rows: StandingsRow[] = league.teams
    .filter(team => stats.has(team.id))
    .map(team => {
      const s = stats.get(team.id)!;
      const gp = s.w + s.l;
      return { team, gp, w: s.w, l: s.l, pct: gp > 0 ? s.w / gp : 0, gb: 0, rs: s.rs, ra: s.ra, diff: s.rs - s.ra };
    })
    .sort((a, b) => b.w - a.w || a.l - b.l || b.diff - a.diff);

  if (rows.length > 0) {
    const leader = rows[0];
    rows.forEach((row, idx) => {
      row.gb = idx === 0 ? null : ((leader.w - row.w) + (row.l - leader.l)) / 2;
    });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── Bracket / Tournament helpers ────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function getBracketRoundNames(totalRounds: number): string[] {
  if (totalRounds === 1) return ['Final'];
  if (totalRounds === 2) return ['Semifinal', 'Final'];
  if (totalRounds === 3) return ['Quarterfinal', 'Semifinal', 'Final'];
  if (totalRounds === 4) return ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'];
  // 5+: Round 1, Round 2, ..., Semifinal, Final
  const names: string[] = [];
  for (let i = 1; i <= totalRounds - 2; i++) names.push(`Round ${i}`);
  names.push('Semifinal');
  names.push('Final');
  return names;
}

/** Given a date string and roundGapDays, return a new date string that is roundGapDays after it */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Get the day name (Mon/Tue/...) for a date string */
function getDayNameFromStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const jsDay = d.getDay();
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return weekdays[idx];
}

/** Advance dateStr forward until it lands on an allowed day */
function nextAllowedDate(dateStr: string, allowedDays: string[]): string {
  let cur = dateStr;
  for (let safety = 0; safety < 365; safety++) {
    if (allowedDays.includes(getDayNameFromStr(cur))) return cur;
    cur = addDays(cur, 1);
  }
  return cur;
}

/**
 * Schedule `gamesCount` games for a given matchup starting from `startDate`,
 * on consecutive allowed days. Returns { games, lastDate }.
 */
function scheduleMatchupGames(
  homeId: string,
  awayId: string,
  homeLocation: string,
  startDate: string,
  allowedDays: string[],
  dayTimes: Record<string, string>,
  gamesCount: number,
  seriesNameStr: string,
  bracketRound: number,
  bracketPosition: number,
  leagueGames: Game[]
): { games: Game[]; lastDate: string } {
  const result: Game[] = [];
  let cur = nextAllowedDate(startDate, allowedDays);
  for (let i = 0; i < gamesCount; i++) {
    const dayName = getDayNameFromStr(cur);
    const time = dayTimes[dayName] || '15:00';
    result.push({
      id: generateUUID(),
      homeTeamId: homeId,
      awayTeamId: awayId,
      date: cur,
      time,
      location: homeLocation,
      status: 'scheduled',
      gameNumber: String(leagueGames.length + result.length + 1),
      seriesName: seriesNameStr,
      bracketRound,
      bracketPosition,
    });
    // Advance to next allowed day
    cur = nextAllowedDate(addDays(cur, 1), allowedDays);
  }
  const lastDate = result.length > 0 ? result[result.length - 1].date : startDate;
  return { games: result, lastDate };
}

export const generateSingleEliminationBracket = (
  teams: Team[],
  startDate: string,
  allowedDays: string[],
  dayTimes: Record<string, string>,
  bestOf: number = 1,
  seeding: string[] = [],
  roundGapDays: number = 3
): Game[] => {
  if (teams.length < 2) return [];

  // Build seed order: use provided seeding or teams in order
  const seedIds: (string | null)[] = seeding.length > 0
    ? seeding.slice()
    : teams.map(t => t.id);

  // Pad to next power of 2 with nulls (BYEs)
  const bracketSize = nextPowerOf2(seedIds.length);
  while (seedIds.length < bracketSize) seedIds.push(null);

  const totalRounds = Math.log2(bracketSize);
  const roundNames = getBracketRoundNames(totalRounds);

  const allGames: Game[] = [];
  let roundStartDate = nextAllowedDate(startDate, allowedDays);
  let lastDateOfRound = roundStartDate;

  for (let round = 0; round < totalRounds; round++) {
    const numMatchups = bracketSize / Math.pow(2, round + 1);
    const rName = roundNames[round];
    const isFirstRound = round === 0;

    // Standard seeding: seed 1 vs last, seed 2 vs second-to-last, etc.
    const matchups: { home: string | null; away: string | null }[] = [];
    if (isFirstRound) {
      for (let i = 0; i < numMatchups; i++) {
        const topSeed = seedIds[i];
        const bottomSeed = seedIds[bracketSize - 1 - i];
        matchups.push({ home: topSeed, away: bottomSeed });
      }
    } else {
      // TBD placeholders for subsequent rounds
      for (let i = 0; i < numMatchups; i++) {
        matchups.push({
          home: `__tbd_r${round + 1}_p${i * 2}__`,
          away: `__tbd_r${round + 1}_p${i * 2 + 1}__`,
        });
      }
    }

    let roundLastDate = roundStartDate;

    for (let mi = 0; mi < matchups.length; mi++) {
      const { home, away } = matchups[mi];

      // Skip BYE matchups (either slot null in round 1)
      if (home === null || away === null) continue;

      const homeTeam = teams.find(t => t.id === home);
      const homeLocation = homeTeam ? (homeTeam.field || `${homeTeam.city} Field`) : 'TBD Field';

      const { games: mGames, lastDate } = scheduleMatchupGames(
        home,
        away,
        homeLocation,
        roundStartDate,
        allowedDays,
        dayTimes,
        bestOf,
        rName,
        round + 1,
        mi + 1,
        allGames
      );
      allGames.push(...mGames);
      if (lastDate > roundLastDate) roundLastDate = lastDate;
    }

    lastDateOfRound = roundLastDate;
    // Next round starts roundGapDays after the last game of this round
    roundStartDate = nextAllowedDate(addDays(lastDateOfRound, roundGapDays), allowedDays);
  }

  return allGames;
};

export const generateDoubleEliminationBracket = (
  teams: Team[],
  startDate: string,
  allowedDays: string[],
  dayTimes: Record<string, string>,
  bestOf: number = 1,
  seeding: string[] = [],
  roundGapDays: number = 3
): Game[] => {
  if (teams.length < 2) return [];

  const seedIds: (string | null)[] = seeding.length > 0
    ? seeding.slice()
    : teams.map(t => t.id);

  const bracketSize = nextPowerOf2(seedIds.length);
  while (seedIds.length < bracketSize) seedIds.push(null);

  const wbTotalRounds = Math.log2(bracketSize);

  // WB round names
  const getWBName = (roundIdx: number): string => {
    if (wbTotalRounds === 1) return 'WB Final';
    if (wbTotalRounds === 2) return roundIdx === 0 ? 'WB Semifinal' : 'WB Final';
    if (wbTotalRounds === 3) {
      return ['WB Quarterfinal', 'WB Semifinal', 'WB Final'][roundIdx] ?? `WB Round ${roundIdx + 1}`;
    }
    if (roundIdx === wbTotalRounds - 1) return 'WB Final';
    if (roundIdx === wbTotalRounds - 2) return 'WB Semifinal';
    if (roundIdx === wbTotalRounds - 3) return 'WB Quarterfinal';
    return `WB Round ${roundIdx + 1}`;
  };

  const allGames: Game[] = [];
  let currentDate = nextAllowedDate(startDate, allowedDays);
  let bracketRoundCounter = 0;

  // Schedule WB and LB rounds in interleaved fashion
  // For each WB round i (0-indexed), schedule WB round i then LB round i
  const lbRoundCount = wbTotalRounds > 1 ? (wbTotalRounds - 1) * 2 : 0;

  for (let wbRound = 0; wbRound < wbTotalRounds; wbRound++) {
    bracketRoundCounter++;
    const numWBMatchups = bracketSize / Math.pow(2, wbRound + 1);
    const wbName = getWBName(wbRound);
    let roundLastDate = currentDate;

    for (let mi = 0; mi < numWBMatchups; mi++) {
      let homeId: string;
      let awayId: string;

      if (wbRound === 0) {
        // Use actual seeding for first round
        const topSeed = seedIds[mi];
        const bottomSeed = seedIds[bracketSize - 1 - mi];
        if (topSeed === null || bottomSeed === null) continue;
        homeId = topSeed;
        awayId = bottomSeed;
      } else {
        homeId = `__tbd_wb_r${wbRound + 1}_p${mi * 2}__`;
        awayId = `__tbd_wb_r${wbRound + 1}_p${mi * 2 + 1}__`;
      }

      const homeTeam = teams.find(t => t.id === homeId);
      const homeLocation = homeTeam ? (homeTeam.field || `${homeTeam.city} Field`) : 'TBD Field';

      const { games: mGames, lastDate } = scheduleMatchupGames(
        homeId, awayId, homeLocation,
        currentDate, allowedDays, dayTimes,
        bestOf, wbName, bracketRoundCounter, mi + 1, allGames
      );
      allGames.push(...mGames);
      if (lastDate > roundLastDate) roundLastDate = lastDate;
    }

    currentDate = nextAllowedDate(addDays(roundLastDate, roundGapDays), allowedDays);

    // Schedule corresponding LB round after each WB round (except the last WB round)
    if (wbRound < wbTotalRounds - 1) {
      bracketRoundCounter++;
      const lbRoundIdx = wbRound * 2; // LB has 2 rounds per WB round (drop-in + consolidation)
      const lbName = `LB Round ${lbRoundIdx + 1}`;
      const numLBMatchups = Math.max(1, numWBMatchups / 2);
      let lbRoundLastDate = currentDate;

      for (let mi = 0; mi < numLBMatchups; mi++) {
        const lbHomeId = `__tbd_lb_r${lbRoundIdx + 1}_p${mi * 2}__`;
        const lbAwayId = `__tbd_lb_r${lbRoundIdx + 1}_p${mi * 2 + 1}__`;

        const { games: lbGames, lastDate: lbLastDate } = scheduleMatchupGames(
          lbHomeId, lbAwayId, 'TBD Field',
          currentDate, allowedDays, dayTimes,
          bestOf, lbName, bracketRoundCounter, mi + 1, allGames
        );
        allGames.push(...lbGames);
        if (lbLastDate > lbRoundLastDate) lbRoundLastDate = lbLastDate;
      }

      currentDate = nextAllowedDate(addDays(lbRoundLastDate, roundGapDays), allowedDays);

      // Second LB round (consolidation) for rounds after the first WB round
      if (wbRound > 0) {
        bracketRoundCounter++;
        const lbName2 = `LB Round ${lbRoundIdx + 2}`;
        let lb2RoundLastDate = currentDate;

        for (let mi = 0; mi < numLBMatchups; mi++) {
          const lb2HomeId = `__tbd_lb_r${lbRoundIdx + 2}_p${mi * 2}__`;
          const lb2AwayId = `__tbd_lb_r${lbRoundIdx + 2}_p${mi * 2 + 1}__`;

          const { games: lb2Games, lastDate: lb2LastDate } = scheduleMatchupGames(
            lb2HomeId, lb2AwayId, 'TBD Field',
            currentDate, allowedDays, dayTimes,
            bestOf, lbName2, bracketRoundCounter, mi + 1, allGames
          );
          allGames.push(...lb2Games);
          if (lb2LastDate > lb2RoundLastDate) lb2RoundLastDate = lb2LastDate;
        }

        currentDate = nextAllowedDate(addDays(lb2RoundLastDate, roundGapDays), allowedDays);
      }
    }
  }

  // Championship game
  bracketRoundCounter++;
  const { games: champGames } = scheduleMatchupGames(
    '__tbd_champ_home__',
    '__tbd_champ_away__',
    'TBD Field',
    currentDate, allowedDays, dayTimes,
    bestOf, 'Championship', bracketRoundCounter, 1, allGames
  );
  allGames.push(...champGames);

  return allGames;
};

export const generatePoolKnockout = (
  teams: Team[],
  poolSize: number,
  advancingPerPool: number,
  startDate: string,
  allowedDays: string[],
  dayTimes: Record<string, string>,
  bestOf: number = 1,
  roundGapDays: number = 3
): Game[] => {
  if (teams.length < 2) return [];

  const allGames: Game[] = [];
  const poolNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Divide teams into pools
  const pools: Team[][] = [];
  for (let i = 0; i < teams.length; i += poolSize) {
    pools.push(teams.slice(i, i + poolSize));
  }

  let currentDate = nextAllowedDate(startDate, allowedDays);
  let poolPhaseLastDate = currentDate;

  // Pool round-robin games
  pools.forEach((poolTeams, poolIdx) => {
    const poolLabel = `Pool ${poolNames[poolIdx] ?? poolIdx + 1}`;
    // All pairs play once
    for (let i = 0; i < poolTeams.length; i++) {
      for (let j = i + 1; j < poolTeams.length; j++) {
        const homeTeam = poolTeams[i];
        const awayTeam = poolTeams[j];
        const homeLocation = homeTeam.field || `${homeTeam.city} Field`;
        const dayName = getDayNameFromStr(currentDate);
        const time = dayTimes[dayName] || '15:00';

        allGames.push({
          id: generateUUID(),
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          date: currentDate,
          time,
          location: homeLocation,
          status: 'scheduled',
          gameNumber: String(allGames.length + 1),
          seriesName: poolLabel,
          bracketRound: 0,
          bracketPosition: allGames.length + 1,
        });

        if (currentDate > poolPhaseLastDate) poolPhaseLastDate = currentDate;
        currentDate = nextAllowedDate(addDays(currentDate, 1), allowedDays);
      }
    }
  });

  // Bracket phase with TBD team IDs
  const numAdvancing = pools.length * advancingPerPool;
  if (numAdvancing < 2) return allGames;

  const bracketStartDate = nextAllowedDate(addDays(poolPhaseLastDate, roundGapDays), allowedDays);

  const bracketSize = nextPowerOf2(numAdvancing);
  const totalBracketRounds = Math.log2(bracketSize);
  const roundNames = getBracketRoundNames(totalBracketRounds);

  // Build TBD seed slots for bracket
  const tbdSeeds: string[] = [];
  for (let i = 0; i < numAdvancing; i++) {
    tbdSeeds.push(`__tbd_pool_seed${i + 1}__`);
  }
  // Pad with nulls for BYEs
  const bracketSlots: (string | null)[] = [...tbdSeeds];
  while (bracketSlots.length < bracketSize) bracketSlots.push(null);

  let roundStartDate = bracketStartDate;
  let lastDateOfRound = bracketStartDate;

  for (let round = 0; round < totalBracketRounds; round++) {
    const numMatchups = bracketSize / Math.pow(2, round + 1);
    const rName = roundNames[round];
    let roundLastDate = roundStartDate;

    for (let mi = 0; mi < numMatchups; mi++) {
      let homeId: string | null;
      let awayId: string | null;

      if (round === 0) {
        homeId = bracketSlots[mi];
        awayId = bracketSlots[bracketSize - 1 - mi];
      } else {
        homeId = `__tbd_bracket_r${round + 1}_p${mi * 2}__`;
        awayId = `__tbd_bracket_r${round + 1}_p${mi * 2 + 1}__`;
      }

      if (homeId === null || awayId === null) continue;

      const { games: mGames, lastDate } = scheduleMatchupGames(
        homeId, awayId, 'TBD Field',
        roundStartDate, allowedDays, dayTimes,
        bestOf, rName, round + 1, mi + 1, allGames
      );
      allGames.push(...mGames);
      if (lastDate > roundLastDate) roundLastDate = lastDate;
    }

    lastDateOfRound = roundLastDate;
    roundStartDate = nextAllowedDate(addDays(lastDateOfRound, roundGapDays), allowedDays);
  }

  return allGames;
};

/**
 * Resolves TBD pool bracket slots (`__tbd_pool_seed{n}__`) to real team IDs
 * based on pool standings calculated from completed pool games.
 *
 * Seeding is interleaved across pools so pool winners don't meet until the final:
 *   seed1 = Pool A #1, seed2 = Pool B #1, seed3 = Pool A #2, seed4 = Pool B #2 …
 *
 * Returns the updated games array and a map of seed → teamId for display.
 */
export function resolvePoolBracket(
  games: Game[],
): { resolved: Game[]; seedMap: Record<string, string>; poolStandings: Record<string, string[]> } {
  // Pool games have bracketRound === 0
  const poolGames = games.filter(g => g.bracketRound === 0);

  // Group by seriesName (Pool A, Pool B, …)
  const poolMap = new Map<string, Game[]>();
  poolGames.forEach(g => {
    const key = g.seriesName || 'Pool A';
    if (!poolMap.has(key)) poolMap.set(key, []);
    poolMap.get(key)!.push(g);
  });

  // Calculate standings per pool
  const poolStandingMap = new Map<string, string[]>();
  poolMap.forEach((pgames, poolName) => {
    const wins   = new Map<string, number>();
    const losses = new Map<string, number>();
    const rdiff  = new Map<string, number>();

    pgames.forEach(g => {
      [g.homeTeamId, g.awayTeamId].forEach(id => {
        if (!wins.has(id)) { wins.set(id, 0); losses.set(id, 0); rdiff.set(id, 0); }
      });
      const done = g.status === 'final' || g.status === 'forfeit';
      if (!done || !g.scores) return;
      const hr = g.scores.home;
      const ar = g.scores.away;
      rdiff.set(g.homeTeamId, (rdiff.get(g.homeTeamId) || 0) + (hr - ar));
      rdiff.set(g.awayTeamId, (rdiff.get(g.awayTeamId) || 0) + (ar - hr));
      if (hr > ar) {
        wins.set(g.homeTeamId, (wins.get(g.homeTeamId) || 0) + 1);
        losses.set(g.awayTeamId, (losses.get(g.awayTeamId) || 0) + 1);
      } else if (ar > hr) {
        wins.set(g.awayTeamId, (wins.get(g.awayTeamId) || 0) + 1);
        losses.set(g.homeTeamId, (losses.get(g.homeTeamId) || 0) + 1);
      }
    });

    const teamIds = Array.from(wins.keys()).sort((a, b) => {
      const wDiff = (wins.get(b) || 0) - (wins.get(a) || 0);
      return wDiff !== 0 ? wDiff : (rdiff.get(b) || 0) - (rdiff.get(a) || 0);
    });
    poolStandingMap.set(poolName, teamIds);
  });

  // Sort pools alphabetically
  const sortedPools = Array.from(poolStandingMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // Build interleaved seed map: rank 0 across all pools, then rank 1, …
  const maxRank = Math.max(...sortedPools.map(([, ids]) => ids.length));
  const seedMap: Record<string, string> = {};
  let seedIdx = 1;
  for (let rank = 0; rank < maxRank; rank++) {
    for (const [, teamIds] of sortedPools) {
      if (rank < teamIds.length) {
        seedMap[`__tbd_pool_seed${seedIdx}__`] = teamIds[rank];
        seedIdx++;
      }
    }
  }

  // Apply replacements
  const resolved = games.map(g => {
    const homeTeamId = seedMap[g.homeTeamId] ?? g.homeTeamId;
    const awayTeamId = seedMap[g.awayTeamId] ?? g.awayTeamId;
    if (homeTeamId === g.homeTeamId && awayTeamId === g.awayTeamId) return g;
    return { ...g, homeTeamId, awayTeamId };
  });

  const poolStandings: Record<string, string[]> = {};
  poolStandingMap.forEach((ids, name) => { poolStandings[name] = ids; });

  return { resolved, seedMap, poolStandings };
}


export const generateRoundRobinSchedule = (
  teams: Team[],
  startDateStr: string,
  gamesPerTeam: number,
  allowedDays: string[],
  dayTimes: Record<string, string>,
  doubleHeaderMode: 'none' | 'same_day' | 'consecutive' | 'series' | 'single_elim' | 'double_elim' | 'pool_bracket',
  bestOf: number = 3,
  seriesMatchups?: Array<{team1Id: string, team2Id: string, seriesName?: string}>,
  seriesGameMode: 'alternate' | 'back_to_back' = 'alternate'
): Game[] => {
  if (teams.length < 2) return [];

  const games: Game[] = [];
  const teamIds = teams.map(t => t.id);

  // Helper to convert JavaScript getDay() (0=Sun, 6=Sat) to WEEKDAYS index (0=Mon, 6=Sun)
  const getDayName = (date: Date): string => {
    const jsDay = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    // Convert to WEEKDAYS index: 0=Mon, 1=Tue, ..., 6=Sun
    const weekdaysIndex = jsDay === 0 ? 6 : jsDay - 1;
    return WEEKDAYS[weekdaysIndex];
  };

  // Helper to find next valid date
  const getNextValidDate = (fromDate: Date): Date => {
     let d = new Date(fromDate);
     // Safety break
     let safety = 0;
     while (safety < 365) {
        const dayName = getDayName(d);
        if (allowedDays.includes(dayName)) return d;
        d.setDate(d.getDate() + 1);
        safety++;
     }
     return d;
  };

  // Generate all unique team pairs
  const allPairs: {team1: string, team2: string}[] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      allPairs.push({ team1: teamIds[i], team2: teamIds[j] });
    }
  }

  // For back-to-back mode, each team plays each other team twice:
  // 1. Series at Team 1's home (2 games back-to-back)
  // 2. Series at Team 2's home (2 games back-to-back)
  // This ensures each team plays back-to-back both at home and as visitor with each opponent
  
  let currentDate = new Date(startDateStr + 'T00:00:00');
  
  // Ensure we start on a valid day
  if (!allowedDays.includes(getDayName(currentDate))) {
      currentDate = getNextValidDate(currentDate);
  }

  // Handle Series format separately
  if (doubleHeaderMode === 'series') {
    // For series format, generate best-of-N games for each pair
    // Games alternate home/away: Game 1 at Team 1, Game 2 at Team 2, Game 3 at Team 1, etc.
    let currentDate = new Date(startDateStr + 'T00:00:00');
    
    // Ensure we start on a valid day
    if (!allowedDays.includes(getDayName(currentDate))) {
      currentDate = getNextValidDate(currentDate);
    }

    // Use provided matchups or fall back to all pairs
    const matchupsToSchedule = seriesMatchups && seriesMatchups.length > 0 
      ? seriesMatchups.filter(m => m.team1Id && m.team2Id)
      : allPairs.map(p => ({ team1Id: p.team1, team2Id: p.team2, seriesName: undefined }));

    for (const matchup of matchupsToSchedule) {
      const team1 = teams.find(t => t.id === matchup.team1Id);
      const team2 = teams.find(t => t.id === matchup.team2Id);
      
      if (!team1 || !team2) continue;
      
      if (seriesGameMode === 'back_to_back') {
        // For back-to-back, follow the same principle as consecutive mode:
        // Each team plays back-to-back games at home (2 games per series)
        // Split games into pairs: Team 1 gets pairs, Team 2 gets pairs
        // Only schedule on allowed days
        
        let remainingGames = bestOf;
        let currentSeries = 1; // Start with Team 1
        
        while (remainingGames > 0) {
          const homeTeam = currentSeries % 2 === 1 ? team1 : team2;
          const awayTeam = currentSeries % 2 === 1 ? team2 : team1;
          const location = homeTeam.field || `${homeTeam.city} Field`;
          
          // Schedule 2 games at this location (back-to-back)
          const gamesThisSeries = Math.min(2, remainingGames);
          
          for (let gameNum = 1; gameNum <= gamesThisSeries; gameNum++) {
            // Ensure we're on an allowed day
            if (!allowedDays.includes(getDayName(currentDate))) {
              currentDate = getNextValidDate(currentDate);
            }
            
            const dayName = getDayName(currentDate);
            const time = dayTimes[dayName] || '15:00';
            
            games.push({
              id: generateUUID(),
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              date: formatDate(currentDate),
              time: time,
              location: location,
              status: 'scheduled',
              gameNumber: String(games.length + 1),
              seriesName: matchup.seriesName
            });
            
            // Advance to next day for next game in series, then find next valid day
            if (gameNum < gamesThisSeries) {
              currentDate.setDate(currentDate.getDate() + 1);
              currentDate = getNextValidDate(currentDate);
            }
          }
          
          remainingGames -= gamesThisSeries;
          currentSeries++;
          
          // Advance to next series location, then find next valid day
          if (remainingGames > 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate = getNextValidDate(currentDate);
          }
        }
      } else {
        // Alternate mode: Games alternate home/away
        // Only schedule on allowed days
        for (let gameNum = 1; gameNum <= bestOf; gameNum++) {
          // Ensure we're on an allowed day
          if (!allowedDays.includes(getDayName(currentDate))) {
            currentDate = getNextValidDate(currentDate);
          }
          
          // Alternate home team: odd games (1, 3, 5...) at Team 1, even games (2, 4, 6...) at Team 2
          const isTeam1Home = gameNum % 2 === 1;
          const homeTeam = isTeam1Home ? team1 : team2;
          const awayTeam = isTeam1Home ? team2 : team1;
          
          const location = homeTeam.field || `${homeTeam.city} Field`;
          const dayName = getDayName(currentDate);
          const time = dayTimes[dayName] || '15:00';
          
          games.push({
            id: generateUUID(),
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            date: formatDate(currentDate),
            time: time,
            location: location,
            status: 'scheduled',
            gameNumber: String(games.length + 1),
            seriesName: matchup.seriesName
          });
          
          // Advance to next day for next game in series, then find next valid day
          currentDate.setDate(currentDate.getDate() + 1);
          currentDate = getNextValidDate(currentDate);
        }
      }
      
      // Add a day break between series
      currentDate.setDate(currentDate.getDate() + 1);
      if (!allowedDays.includes(getDayName(currentDate))) {
        currentDate = getNextValidDate(currentDate);
      }
    }
    
    return games;
  }

  // Calculate how many series we need per pair
  const gamesPerMatchup = doubleHeaderMode === 'none' ? 1 : 2;
  const seriesPerPair = doubleHeaderMode === 'consecutive' ? 2 : 1; // 2 series (home/away) for consecutive mode
  
  // Calculate how many times we need to cycle through pairs
  const gamesPerPair = seriesPerPair * gamesPerMatchup;
  const totalGamesPerTeam = allPairs.length * gamesPerPair;
  const cyclesNeeded = Math.ceil(gamesPerTeam / (totalGamesPerTeam / teams.length));

  // Schedule all pairs
  for (let cycle = 0; cycle < cyclesNeeded; cycle++) {
    for (const pair of allPairs) {
      // Series 1: Team 1 at home
      const homeTeam1 = teams.find(t => t.id === pair.team1);
      const location1 = homeTeam1 ? (homeTeam1.field || `${homeTeam1.city} Field`) : 'Stadium';
      const dayName1 = getDayName(currentDate);
      const time1 = dayTimes[dayName1] || '15:00';

      // Game 1 of Series 1
      games.push({
        id: generateUUID(),
        homeTeamId: pair.team1,
        awayTeamId: pair.team2,
        date: formatDate(currentDate),
        time: time1,
        location: location1,
        status: 'scheduled',
        gameNumber: String(games.length + 1)
      });

      if (doubleHeaderMode === 'same_day') {
        // Game 2 on same day, 3 hours later
        let [h, m] = time1.split(':').map(Number);
        let h2 = (h + 3) % 24;
        const time2 = `${String(h2).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        
        games.push({
          id: generateUUID(),
          homeTeamId: pair.team1, // Same home team
          awayTeamId: pair.team2,
          date: formatDate(currentDate),
          time: time2,
          location: location1,
          status: 'scheduled',
          gameNumber: String(games.length + 1)
        });
      } else if (doubleHeaderMode === 'consecutive') {
        // Game 2 on next calendar day (same home team, same location)
        const nextDay1 = new Date(currentDate);
        nextDay1.setDate(nextDay1.getDate() + 1);
        const nextDayName1 = getDayName(nextDay1);
        const time2 = dayTimes[nextDayName1] || time1;
        
        games.push({
          id: generateUUID(),
          homeTeamId: pair.team1, // Same home team for Game 2
          awayTeamId: pair.team2,
          date: formatDate(nextDay1),
          time: time2,
          location: location1, // Same location
          status: 'scheduled',
          gameNumber: String(games.length + 1)
        });
      }

      // Advance date after Series 1
      if (doubleHeaderMode === 'consecutive') {
        const originalDate = new Date(currentDate);
        originalDate.setDate(originalDate.getDate() + 2);
        currentDate = getNextValidDate(originalDate);
      } else {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate = getNextValidDate(currentDate);
      }

      // Series 2: Team 2 at home (only for consecutive mode to ensure home/away balance)
      if (doubleHeaderMode === 'consecutive') {
        const homeTeam2 = teams.find(t => t.id === pair.team2);
        const location2 = homeTeam2 ? (homeTeam2.field || `${homeTeam2.city} Field`) : 'Stadium';
        const dayName2 = getDayName(currentDate);
        const time3 = dayTimes[dayName2] || '15:00';

        // Game 1 of Series 2
        games.push({
          id: generateUUID(),
          homeTeamId: pair.team2,
          awayTeamId: pair.team1,
          date: formatDate(currentDate),
          time: time3,
          location: location2,
          status: 'scheduled',
          gameNumber: String(games.length + 1)
        });

        // Game 2 of Series 2 on next day
        const nextDay2 = new Date(currentDate);
        nextDay2.setDate(nextDay2.getDate() + 1);
        const nextDayName2 = getDayName(nextDay2);
        const time4 = dayTimes[nextDayName2] || time3;
        
        games.push({
          id: generateUUID(),
          homeTeamId: pair.team2, // Same home team for Game 2
          awayTeamId: pair.team1,
          date: formatDate(nextDay2),
          time: time4,
          location: location2, // Same location
          status: 'scheduled',
          gameNumber: String(games.length + 1)
        });

        // Advance date after Series 2
        const originalDate2 = new Date(currentDate);
        originalDate2.setDate(originalDate2.getDate() + 2);
        currentDate = getNextValidDate(originalDate2);
      }
    }
  }

  return games;
};