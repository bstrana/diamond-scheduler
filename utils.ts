import { Game, CalendarDay, Team } from './types';
import { WEEKDAYS } from './constants';

export const generateUUID = (): string => {
  return crypto.randomUUID();
};

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

export const generateRoundRobinSchedule = (
  teams: Team[],
  startDateStr: string,
  gamesPerTeam: number,
  allowedDays: string[],
  dayTimes: Record<string, string>,
  doubleHeaderMode: 'none' | 'same_day' | 'consecutive' | 'series',
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
            const time = dayTimes[dayName] || '19:00';
            
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
          const time = dayTimes[dayName] || '19:00';
          
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
      const time1 = dayTimes[dayName1] || '19:00';

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
        const time3 = dayTimes[dayName2] || '19:00';

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