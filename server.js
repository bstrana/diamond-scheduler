import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distDir = path.join(__dirname, 'dist');

const pbUrl = process.env.PB_URL || process.env.VITE_PB_URL;
const scheduleCollection = process.env.PB_SCHEDULE_COLLECTION || process.env.VITE_PB_SCHEDULE_COLLECTION;
const appId = process.env.PB_APP_ID || process.env.VITE_APP_ID || 'scheduler';
const defaultDurationMinutes = Number.parseInt(process.env.SCHEDULE_EVENT_DURATION_MINUTES || '120', 10);

const pad = (value) => String(value).padStart(2, '0');
const formatLocalIcsDate = (date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;

const escapeIcs = (value = '') =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const buildIcs = (data) => {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const games = Array.isArray(data?.games) ? data.games : [];
  const teamsById = new Map((data?.teams || []).map((team) => [team.id, team]));

  const events = games.map((game) => {
    const home = teamsById.get(game.homeTeamId);
    const away = teamsById.get(game.awayTeamId);
    const start = new Date(`${game.date}T${game.time || '19:00'}:00`);
    const end = new Date(start.getTime() + defaultDurationMinutes * 60000);
    const summary = `${away?.name || 'Away'} @ ${home?.name || 'Home'}`;
    return [
      'BEGIN:VEVENT',
      `UID:${game.id}@${appId}`,
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
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
};

app.get('/subscribe.ics', async (req, res) => {
  const scheduleKey = req.query.schedule_key;
  if (!pbUrl || !scheduleCollection) {
    res.status(500).send('PocketBase is not configured.');
    return;
  }
  if (!scheduleKey) {
    res.status(400).send('Missing schedule_key');
    return;
  }

  const params = new URLSearchParams({
    filter: `app_id="${appId}" && schedule_key="${scheduleKey}" && active=true`,
    perPage: '1'
  });
  const url = `${pbUrl.replace(/\/$/, '')}/api/collections/${scheduleCollection}/records?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).send(text || 'Schedule lookup failed.');
      return;
    }
    const payload = await response.json();
    const record = payload.items?.[0];
    if (!record?.data) {
      res.status(404).send('Schedule not found.');
      return;
    }
    const ics = buildIcs(record.data);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.send(ics);
  } catch (error) {
    res.status(500).send('Failed to generate calendar feed.');
  }
});

app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number.parseInt(process.env.PORT || '3000', 10);
app.listen(port, () => {
  console.log(`Scheduler server running on port ${port}`);
});
