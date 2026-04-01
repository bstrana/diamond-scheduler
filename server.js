import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distDir = path.join(__dirname, 'dist');

// Rate limiting for ICS endpoint
const icsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const pbUrl = process.env.PB_URL || process.env.VITE_PB_URL;
const scheduleCollection = process.env.PB_SCHEDULE_COLLECTION || process.env.VITE_PB_SCHEDULE_COLLECTION;
const defaultDurationMinutes = Number.parseInt(process.env.SCHEDULE_EVENT_DURATION_MINUTES || '120', 10);

const pad = (value) => String(value).padStart(2, '0');

/**
 * Build an ICS floating-time timestamp (YYYYMMDDTHHMMSS, no Z / no TZID)
 * directly from stored date (YYYY-MM-DD) and time (HH:MM) strings.
 * Works independently of server timezone.
 */
const icsDateTime = (dateStr, timeStr) => {
  const [h, m] = (timeStr || '15:00').split(':').map(Number);
  return `${dateStr.replace(/-/g, '')}T${pad(h)}${pad(m)}00`;
};

/**
 * Add minutes to a date+time pair, returning a new { dateStr, timeStr }.
 * Handles overflow past midnight using only UTC arithmetic on the date part.
 */
const addMinutesToDateTime = (dateStr, timeStr, minutes) => {
  const [h, m] = (timeStr || '15:00').split(':').map(Number);
  const totalMins = h * 60 + m + minutes;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  let endDate = dateStr;
  if (totalMins >= 24 * 60) {
    // Advance the date by the number of full days overflowed
    const overflowDays = Math.floor(totalMins / (24 * 60));
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + overflowDays);
    endDate = d.toISOString().slice(0, 10);
  }
  return `${endDate.replace(/-/g, '')}T${pad(endH)}${pad(endM)}00`;
};

const escapeIcs = (value = '') =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const sanitizeScheduleKey = (key) => {
  if (!key || typeof key !== 'string') return null;
  return key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
};

const buildIcs = (data) => {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const games = Array.isArray(data?.games) ? data.games : [];
  const teamsById = new Map((data?.teams || []).map((team) => [team.id, team]));

  const events = games.map((game) => {
    const home = teamsById.get(game.homeTeamId);
    const away = teamsById.get(game.awayTeamId);
    const gameTime = game.time || '15:00';
    const dtStart = icsDateTime(game.date, gameTime);
    const dtEnd = addMinutesToDateTime(game.date, gameTime, defaultDurationMinutes);
    const summary = `${away?.name || 'Away'} @ ${home?.name || 'Home'}`;
    return [
      'BEGIN:VEVENT',
      `UID:${game.id}@diamond-scheduler`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `LOCATION:${escapeIcs(game.location || '')}`,
      'END:VEVENT'
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Diamond Manager//Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Diamond Schedule',
    ...events,
    'END:VCALENDAR',
    ''
  ].join('\r\n');
};

// Security headers middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // X-XSS-Protection removed: deprecated and harmful in some older browsers; rely on CSP instead.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; frame-ancestors 'self';"
  );
  // HSTS: instruct browsers to always use HTTPS for this origin (1 year)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.get('/subscribe.ics', icsRateLimiter, async (req, res) => {
  // Require schedule_key parameter
  const scheduleKey = req.query.schedule_key;
  if (!scheduleKey) {
    res.status(400).send('Schedule key required.');
    return;
  }
  
  if (!pbUrl || !scheduleCollection) {
    res.status(503).send('Service unavailable.');
    return;
  }
  
  // Sanitize and validate schedule_key
  const sanitizedKey = sanitizeScheduleKey(scheduleKey);
  if (!sanitizedKey) {
    res.status(400).send('Invalid schedule_key');
    return;
  }

  // Only fetch active published schedules - never serve inactive or unpublished schedules
  const params = new URLSearchParams();
  params.append('filter', `schedule_key="${sanitizedKey}" && active=true`);
  params.append('perPage', '1');
  const url = `${pbUrl.replace(/\/$/, '')}/api/collections/${scheduleCollection}/records?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(404).send('Schedule not found.');
      return;
    }
    const payload = await response.json();
    const record = payload.items?.[0];
    
    // Verify record exists and is active
    if (!record) {
      res.status(404).send('Schedule not found.');
      return;
    }
    
    // Double-check active status (defense in depth)
    if (record.active !== true) {
      res.status(404).send('Schedule not found.');
      return;
    }
    
    if (!record?.data) {
      res.status(404).send('Schedule not found.');
      return;
    }
    
    const ics = buildIcs(record.data);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="schedule.ics"');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(ics);
  } catch (error) {
    res.status(500).send('Service error.');
  }
});

app.get('/health', (_req, res) => res.sendStatus(200));

// embed.html must be embeddable in cross-origin iframes – override the default
// frame-ancestors 'self' restriction set by the security headers middleware above.
app.use((req, res, next) => {
  if (req.path === '/embed.html') {
    res.removeHeader('X-Frame-Options');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; frame-ancestors *;"
    );
  }
  next();
});

app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number.parseInt(process.env.PORT || '3000', 10);
app.listen(port, () => {
  console.log(`Scheduler server running on port ${port}`);
});
