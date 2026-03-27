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
const formatLocalIcsDate = (date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;

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
    const start = new Date(`${game.date}T${game.time || '15:00'}:00`);
    const end = new Date(start.getTime() + defaultDurationMinutes * 60000);
    const summary = `${away?.name || 'Away'} @ ${home?.name || 'Home'}`;
    return [
      'BEGIN:VEVENT',
      `UID:${game.id}@diamond-scheduler`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatLocalIcsDate(start)}`,
      `DTEND:${formatLocalIcsDate(end)}`,
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

app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number.parseInt(process.env.PORT || '3000', 10);
app.listen(port, () => {
  console.log(`Scheduler server running on port ${port}`);
});
