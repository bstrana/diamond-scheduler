import React, { useState } from 'react';
import {
  Trophy, Users, Calendar, Clock, Send, Code, Star,
  CheckCircle, ChevronDown, ChevronUp, Radio, MapPin,
  BarChart2, Layers, Palette, RefreshCw, Globe, Zap,
  Moon, Printer, GitBranch, QrCode, Wand2, PlusCircle,
  Download, Upload, FileText, Info, Link2, Monitor, Activity
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  content: React.ReactNode;
}

const HelpPage: React.FC = () => {
  const { t } = useTranslation();
  const [openSection, setOpenSection] = useState<string | null>('workflow');

  const toggle = (id: string) => setOpenSection(prev => prev === id ? null : id);

  const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
    <div className="flex space-x-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">{n}</div>
      <div className="pb-6 border-l-2 border-indigo-100 pl-4 flex-1 -mt-1">
        <p className="font-semibold text-slate-800 mb-1">{title}</p>
        <div className="text-sm text-slate-600 space-y-1">{children}</div>
      </div>
    </div>
  );

  const Chip: React.FC<{ label: string; color?: string }> = ({ label, color = 'bg-indigo-100 text-indigo-700' }) => (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${color}`}>{label}</span>
  );

  const sections: Section[] = [
    {
      id: 'what',
      icon: <Star size={18} />,
      title: 'What is Diamond Manager Scheduler?',
      color: 'text-amber-600',
      content: (
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            <strong className="text-slate-800">Diamond Manager Scheduler</strong> is a sports schedule management platform designed for league administrators, tournament directors, and club managers. It lets you build leagues, roster teams, generate full schedules, record live scores, and publish everything to embeddable widgets on your own website — all from one place.
          </p>
          <p>Whether you run a baseball weekend tournament, a multi-division soccer season, or any bracketed competition, Diamond Manager Scheduler handles the full lifecycle:</p>
          <ul className="space-y-1.5 mt-2">
            {[
              'Build leagues with custom categories, playing fields, and announcements',
              'Roster teams with primary + secondary colors, logos, and player lists',
              'Generate round-robin or playoff series schedules in seconds with automatic conflict detection',
              'Create playoff matchups manually or automatically based on current standings',
              'Append new games to an existing calendar instead of replacing the whole schedule',
              'Update scores inning-by-inning in real time; mark games Live, Final, or Postponed',
              'View a visual playoff bracket auto-built from series-named games',
              'Print a clean table-format schedule (with game numbers) directly from the calendar',
              'Publish and embed live standings, calendars, a game bar, and a playoff bracket on any website',
            ].map((item, i) => (
              <li key={i} className="flex items-start space-x-2">
                <CheckCircle size={14} className="mt-0.5 text-emerald-500 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: 'workflow',
      icon: <Zap size={18} />,
      title: 'Getting Started — 5 Steps',
      color: 'text-indigo-600',
      content: (
        <div className="space-y-0 mt-2">
          <Step n={1} title="Create a League">
            <p>Go to <strong>League Creator</strong> in the top navigation. Fill in the league name, short name, category (e.g. "U12", "Division A"), and optionally a logo and cover image.</p>
            <p className="mt-1">Under <strong>Playing Fields</strong>, add the field names used by this league (e.g. "Field 1", "North Diamond"). These will appear as location options when scheduling games.</p>
            <p className="mt-1">Hit <strong>Save League</strong>. You can edit or delete the league at any time from the same screen.</p>
          </Step>
          <Step n={2} title="Add Teams">
            <p>Still in the League Creator, use the <strong>right panel</strong> to add teams directly to the league. Give each team a city, name, abbreviation, color, and optional logo URL.</p>
            <p className="mt-1">You can also import teams from the global <strong>Teams</strong> view (user menu → Teams) and then attach them to a league, or let the Schedule Generator create sample teams automatically.</p>
          </Step>
          <Step n={3} title="Build the Schedule">
            <p>Open the <strong>Scheduler</strong> tab. Choose a league, set the start date, number of rounds, and time slots, then click <strong>Generate Schedule</strong>. The app creates a full round-robin matchup list instantly.</p>
            <p className="mt-1">Choose a <strong>Game Format</strong>: Single Game, Double Header, Back-to-Back Series, or <em>Playoff Series</em>. In Playoff Series mode you define matchups manually or let the app pick teams automatically <strong>By Standings</strong> (1st vs 4th, 2nd vs 3rd, etc.).</p>
            <p className="mt-1">Use the <strong>Replace / Append</strong> toggle to either overwrite the calendar or add the new games on top of an existing schedule.</p>
            <p className="mt-1">Switch to the <strong>Calendar</strong> view to drag games to different dates, add individual games manually, or move games to the <em>Edit Mode</em> holding area while you reorganize.</p>
          </Step>
          <Step n={4} title="Record Results">
            <p>Click any game card on the Calendar to open the <strong>Edit Game</strong> modal. Change the status to <Chip label="Live" color="bg-green-100 text-green-700" /> or <Chip label="Final" color="bg-slate-200 text-slate-700" />, then enter runs per inning using the <strong>+ Inning</strong> buttons. Totals are calculated automatically.</p>
            <p className="mt-1">You can also add a game recap and a <strong>Live Stream URL</strong> — a Watch link will appear on every embedded view.</p>
          </Step>
          <Step n={5} title="Publish">
            <p>When you're ready to go live, open the user menu and click <strong>Publish Current Schedule</strong>. Enter a short schedule key (e.g. <code className="bg-slate-100 px-1 rounded text-xs">summer-2025</code>) and a display name, then hit Publish.</p>
            <p className="mt-1">A <strong>QR code</strong> for the embed URL is shown live in the publish dialog as soon as you type a key — scan it to preview on mobile or share it instantly.</p>
            <p className="mt-1">The schedule is pushed to the server and your embedded widgets will update automatically. You can re-publish at any time — for example, after recording a final score. The <strong>Save &amp; Publish</strong> button in the game edit modal does both in one click.</p>
          </Step>
        </div>
      ),
    },
    {
      id: 'saving',
      icon: <RefreshCw size={18} />,
      title: 'Saving & Publishing',
      color: 'text-emerald-600',
      content: (
        <div className="space-y-4 text-sm text-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-800 mb-1 flex items-center gap-1.5"><RefreshCw size={14} /> Auto-Save (local)</p>
              <p>Every change you make — adding a game, editing a score, creating a league — is saved automatically to your browser's local storage. Nothing is lost if you close the tab.</p>
              <p className="mt-1.5 text-xs text-blue-600">Data is per-device and per-browser. Use <strong>Publish</strong> to sync across devices.</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="font-semibold text-emerald-800 mb-1 flex items-center gap-1.5"><Send size={14} /> Publish to server</p>
              <p>Publishing pushes your full schedule — leagues, teams, games, and scores — to the connected database server under a unique <strong>schedule key</strong>.</p>
              <p className="mt-1.5 text-xs text-emerald-600">Once published, any iframe embed on your website reads data live from the server.</p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-slate-700">Schedule Keys</p>
            <p>A schedule key is a short unique identifier for your published schedule (e.g. <code className="bg-white border border-slate-200 px-1 rounded text-xs">fall-league-2025</code>). It appears in every embed URL. You can have multiple keys (one per season, per tournament, etc.) and load any of them at any time from <strong>Load Published Schedule</strong> in the user menu.</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="font-semibold text-amber-800 mb-1">Save &amp; Publish shortcut</p>
            <p>In the <strong>Edit Game</strong> modal, the green <Chip label="Save &amp; Publish" color="bg-emerald-100 text-emerald-800" /> button saves the game and immediately re-publishes the full schedule in one step. Perfect for updating live scores during a game.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'embedding',
      icon: <Code size={18} />,
      title: 'Embedding on Your Website',
      color: 'text-purple-600',
      content: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>Go to the <strong>Embed Code</strong> tab. Configure the embed, then copy the <code className="bg-slate-100 px-1 rounded text-xs">&lt;iframe&gt;</code> snippet and paste it into any webpage — WordPress, Squarespace, plain HTML, etc.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: <Calendar size={16} />, label: 'Calendar', color: 'bg-indigo-50 border-indigo-200', text: 'Full month grid or upcoming-games list. When a single team is selected, both teams are displayed on each card (not just the opponent).' },
              { icon: <Layers size={16} />, label: 'Game Bar', color: 'bg-sky-50 border-sky-200', text: 'Compact horizontal ticker showing upcoming and live games. Shows W-L records on each card. Single-team filter shows both teams\' logos and names.' },
              { icon: <BarChart2 size={16} />, label: 'Standings', color: 'bg-violet-50 border-violet-200', text: 'Live GP/W/L table with PCT, GB, RS, RA, and DIFF. Category filter lets visitors narrow by division. Watch Live button appears during live games. Optional info text appears at the bottom left next to the share icon.' },
              { icon: <GitBranch size={16} />, label: 'Series / Playoff Bracket', color: 'bg-emerald-50 border-emerald-200', text: 'Horizontal bracket showing all playoff series (Quarterfinal, Semifinal, Final, etc.) with team rows, win tallies, and per-game scores. Ordered by first game date. Filter by league for a focused bracket.' },
            ].map(({ icon, label, color, text }) => (
              <div key={label} className={`border rounded-lg p-3 ${color}`}>
                <p className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">{icon}{label}</p>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-700">Embed settings</p>
            <ul className="space-y-1.5">
              {[
                { icon: <Globe size={13} />, text: 'Filter by specific league, category, or team to show a focused view' },
                { icon: <Palette size={13} />, text: 'Style Customization — pick colors, font family, font size, border radius, and card shadow to match your site\'s look' },
                { icon: <Users size={13} />, text: 'Show/hide individual filter controls (league, category, team, status) inside the embedded widget' },
                { icon: <Star size={13} />, text: 'When a single team is selected, a Team Deep-link URL is shown — share it so fans can embed or bookmark just their team\'s schedule' },
                { icon: <Calendar size={13} />, text: 'Calendar embeds in List view hide the grid/list toggle so visitors stay in list mode' },
                { icon: <Radio size={13} />, text: 'Announcement banners (set per-league in League Creator) appear automatically at the top of every embedded Calendar, Game Bar, and Standings widget. Visitors can dismiss them.' },
                { icon: <Info size={13} />, text: 'Standings embed — optional Info Text field lets you add a short note (e.g. "Last updated: March 2026") that appears inline at the bottom left of the standings table, next to the share icon.' },
              ].map(({ icon, text }, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-slate-400 flex-shrink-0">{icon}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'games',
      icon: <Clock size={18} />,
      title: 'Game Statuses & Live Scoring',
      color: 'text-green-600',
      content: (
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Scheduled', color: 'bg-indigo-100 text-indigo-700', desc: 'Default state. Game is on the calendar but hasn\'t started.' },
              { label: '● Live', color: 'bg-green-500 text-white', desc: 'Game is in progress. A pulsing green badge appears on all views and embeds.' },
              { label: 'Final', color: 'bg-slate-700 text-white', desc: 'Game is complete. Score is locked and counted toward standings.' },
              { label: 'PPD', color: 'bg-orange-500 text-white', desc: 'Postponed. Shows an orange PPD badge. Change the date/time and set status back to Scheduled to reschedule.' },
            ].map(({ label, color, desc }) => (
              <div key={label} className="flex-1 min-w-[180px] border border-slate-200 rounded-lg p-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                <p className="mt-2">{desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-slate-700">Score by Inning</p>
            <p>In the Edit Game modal, once status is <em>Live</em> or <em>Final</em>, use <strong>+ Inning</strong> to add inning columns. Enter runs per inning for each team — total runs are calculated automatically. The inning-by-inning box score is displayed on Calendar list cards and in the Game Bar embed.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-slate-700">Count &amp; Outs</p>
              <p>Enter current <strong>balls</strong> (0–3), <strong>strikes</strong> (0–2), and <strong>outs</strong> (0–2). These are shown in the linescore area of the stream overlay.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-slate-700">Base Runners</p>
              <p>Toggle first, second, and third base to mark occupied bases. The base diamond in the overlay updates in real time.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-slate-700">Current Pitcher</p>
              <p>Entering a pitcher name causes a <strong>NOW PITCHING</strong> bar to appear at the top of the stream overlay. Clear the field to hide it.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-slate-700">Current Batter</p>
              <p>Entering a batter name (and optionally a batting line such as "1 for 4") displays an <strong>AT BAT</strong> bar at the bottom of the stream overlay.</p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5"><Radio size={14} className="text-indigo-500" /> Live Stream URL</p>
            <p>Add a stream URL to any game. A <strong>Watch</strong> link with a radio icon appears on Calendar cards and Game Bar cards. Clicking it opens the stream in a new tab without leaving the schedule page.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'scorelinks',
      icon: <Link2 size={18} />,
      title: 'Score Links & Live Score Entry',
      color: 'text-sky-600',
      content: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            <strong>Score Links</strong> let any authorised person update a game's score directly from a browser — no app login required. They're ideal for scorekeepers in the stands or tablet operators at the field.
          </p>
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-sky-800 flex items-center gap-1.5"><Link2 size={14} /> Generating a Score Link</p>
            <ol className="list-decimal list-inside space-y-1 text-sky-700">
              <li>Open the <strong>Score Links</strong> manager (link icon in the top navigation).</li>
              <li>Find the game and click <strong>Generate Link</strong>.</li>
              <li>Share the unique URL with your scorekeeper — no login required to use it.</li>
            </ol>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-slate-700">What the scorekeeper can enter</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { label: 'Game status', text: 'Set to Live, Final, or Postponed.' },
                { label: 'Innings', text: 'Add innings with + and enter runs for each team.' },
                { label: 'Outs / Balls / Strikes', text: 'Current count in a simple 3-field row.' },
                { label: 'Base runners', text: 'Toggle first, second, and third base on/off.' },
                { label: 'Current Pitcher', text: 'Name shown in the stream overlay top bar.' },
                { label: 'Current Batter', text: 'Name and batting line (e.g. "1 for 4") shown in the stream overlay bottom bar.' },
                { label: "Today's Scores", text: "Auto-populate the recap with all of today's results from this schedule." },
                { label: 'Best Hitters', text: 'Append HR/3B/2B leaders from the WBSC play log (requires WBSC Game ID).' },
              ].map(({ label, text }) => (
                <div key={label} className="bg-white border border-slate-200 rounded p-2">
                  <p className="font-semibold text-slate-700 text-xs">{label}</p>
                  <p className="text-xs">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="font-semibold text-amber-800 mb-1">Auto-save</p>
            <p className="text-amber-700 text-sm">Every field saves automatically after a short pause. Changes appear in the stream overlay and embedded widgets within seconds — no Save button needed.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'overlay',
      icon: <Monitor size={18} />,
      title: 'Stream Overlay',
      color: 'text-violet-600',
      content: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            The <strong>Stream Overlay</strong> is a browser-source page for OBS, Streamlabs, or any broadcast tool that supports browser sources. It renders real-time game data over your video feed with a transparent background.
          </p>
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-violet-800 flex items-center gap-1.5"><Monitor size={14} /> Adding to OBS</p>
            <ol className="list-decimal list-inside space-y-1 text-violet-700">
              <li>In the Score Links manager, copy the <strong>Overlay URL</strong> for the game.</li>
              <li>In OBS, add a new <strong>Browser Source</strong>.</li>
              <li>Paste the URL, set the resolution to match your stream (e.g. 1920 × 1080), and enable <em>Transparent background</em>.</li>
              <li>Position the layer above your video source. It updates automatically as scores are entered.</li>
            </ol>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { title: 'Pitcher bar (top)', text: 'Shows NOW PITCHING with the pitcher\'s name, right-aligned. Visible only during live games when a pitcher name is set.' },
              { title: 'Batter bar (bottom)', text: 'Shows AT BAT with the batter\'s name and optional batting line (e.g. "1 for 4"), right-aligned. Visible during live games when a batter is set.' },
              { title: 'Linescore', text: 'Inning-by-inning box score, count (balls-strikes-outs), and base runner diamond. Toggle on/off via Overlay Settings on the Score Entry page.' },
              { title: 'Recap ticker', text: 'Scrolls the recap text across the bottom. Toggle independently with the Show Recap switch in Overlay Settings — hide during play, reveal at the end.' },
            ].map(({ title, text }) => (
              <div key={title} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-slate-700">{title}</p>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
            <strong>Live polling:</strong> The overlay polls for updates every 5 seconds and stays in sync with the score entry page in near real-time.
          </div>
        </div>
      ),
    },
    {
      id: 'wbsc',
      icon: <Activity size={18} />,
      title: 'WBSC Live Game Tracker',
      color: 'text-green-600',
      content: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            Games on the <strong>WBSC platform</strong> (game.wbsc.org) can be tracked automatically. When a WBSC Game ID is set, the Score Entry page polls the WBSC API every 5 seconds and fills in scores, count, base runners, pitcher, batter, and play descriptions — no manual entry needed.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-green-800">Enabling WBSC tracking</p>
            <ol className="list-decimal list-inside space-y-1 text-green-700">
              <li>Find the WBSC numeric game ID in the game.wbsc.org URL for that game.</li>
              <li>Open the <strong>Edit Game</strong> modal and enter it in the <strong>WBSC Game ID</strong> field.</li>
              <li>Open the Score Entry page (Score Link). Tracking starts automatically.</li>
            </ol>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: 'Scores', text: 'Inning-by-inning runs for both teams sync automatically, including the "x" marker when the home team doesn\'t bat in the final inning.' },
              { label: 'Game situation', text: 'Balls, strikes, outs, and base runners update in real time from the WBSC feed.' },
              { label: 'Pitcher & batter', text: 'Current pitcher and batter names are pulled from WBSC and displayed in the stream overlay bars automatically.' },
              { label: 'Play description', text: 'The latest play description is shown in the linescore area of the overlay during live play.' },
              { label: 'Auto-Final', text: 'When WBSC marks the game as FINAL, the status is automatically changed to Final in the schedule and standings.' },
              { label: 'Best Hitters', text: 'Click the Best Hitters button on the Score Entry page to fetch HR/3B/2B leaders from the WBSC play log and append them to the recap.' },
            ].map(({ label, text }) => (
              <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="font-semibold text-slate-700 mb-0.5">{label}</p>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'bracket',
      icon: <GitBranch size={18} />,
      title: 'Playoff Bracket & Series Scheduling',
      color: 'text-violet-600',
      content: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            The <strong>Playoff Bracket</strong> view (GitBranch icon in the nav) automatically builds a visual bracket from any games that have a <strong>Series Name</strong> set. You can tag games individually or generate a full playoff series schedule in one go from the Scheduler.
          </p>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-indigo-800">Option A — Tag games manually</p>
            <ol className="list-decimal list-inside space-y-1 text-indigo-700">
              <li>Open the Edit Game modal for a playoff game.</li>
              <li>Enter a <strong>Series Name</strong> (e.g. <code className="bg-white px-1 rounded text-xs">Quarterfinal</code>, <code className="bg-white px-1 rounded text-xs">Semifinal</code>, <code className="bg-white px-1 rounded text-xs">Championship</code>).</li>
              <li>Repeat for all bracket games. Games with the same series name and same pair of teams are grouped into one matchup card.</li>
            </ol>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-emerald-800 flex items-center gap-1.5"><Wand2 size={14} /> Option B — Generate with the Scheduler (Playoff Series mode)</p>
            <ol className="list-decimal list-inside space-y-1 text-emerald-700">
              <li>Open the <strong>Scheduler</strong> tab and select <em>Playoff Series (Best of N)</em> as the Game Format.</li>
              <li>Choose Best of 3, 5, or 7, and pick Alternate Games or Back-to-Back Games mode.</li>
              <li>Under <strong>Series Matchups</strong>, add one row per matchup. Give each matchup a Series Name (e.g. "Semifinal") and pick the two teams.</li>
              <li>Click <strong>Generate Schedule</strong>. All games are created with the Series Name pre-filled and scheduled on consecutive days from your chosen start date.</li>
            </ol>
            <div className="mt-2 bg-white border border-emerald-200 rounded p-3 space-y-1">
              <p className="font-semibold text-emerald-700 flex items-center gap-1.5"><Trophy size={13} /> By Standings (automatic team placement)</p>
              <p className="text-emerald-700">Instead of picking team names manually, switch the matchup mode to <strong>By Standings</strong>. Each team slot becomes a standings position (1st Place, 2nd Place, etc.) showing the current W-L record. When you click Generate, the app resolves those positions to the actual teams at that moment — so 1st vs 4th and 2nd vs 3rd are filled in automatically based on the live table.</p>
              <p className="text-xs text-emerald-600 mt-1">Note: positions are resolved once at generation time, not updated dynamically afterwards.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="font-semibold text-slate-700 mb-1">Rounds in the bracket</p>
              <p>Rounds are ordered by the date of the first game in each series. Each round is a column. Filter the bracket by league using the selector at the top.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="font-semibold text-slate-700 mb-1">Scores &amp; results</p>
              <p>Completed games show per-game scores. The team leading the series is highlighted in green. Individual game details (date, score, status) appear inside each matchup card.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5"><Code size={13} /> Bracket embed</p>
              <p>The <em>Series / Playoff Bracket</em> embed type in the Embed Code tab lets you put the bracket directly on your website. It updates live as scores are recorded and published.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="font-semibold text-slate-700 mb-1">Append to calendar</p>
              <p>Use the <strong>Replace / Append</strong> toggle in the Scheduler to add playoff games on top of your existing regular-season schedule instead of overwriting it.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'leagues',
      icon: <Trophy size={18} />,
      title: 'Leagues, Teams & Fields',
      color: 'text-amber-600',
      content: (
        <div className="space-y-3 text-sm text-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5"><Trophy size={14} /> Leagues</p>
              <p>Each league has a name, short name (shown in compact views), category, logo, and cover image. A game can belong to multiple leagues simultaneously, which is useful for cross-divisional play.</p>
              <p>Leagues also support an optional <strong>Announcement</strong> — a short banner message (up to 500 characters) shown at the top of every embedded Calendar, Game Bar, and Standings widget for that league.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5"><Users size={14} /> Teams</p>
              <p>Teams have a city, name, abbreviation, <strong>primary and secondary colors</strong>, logo URL, country, and an optional player roster. They live inside leagues. The same team can be added to multiple leagues.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5"><MapPin size={14} /> Playing Fields</p>
              <p>Fields are managed at the <em>league</em> level (not the team level). Add field names in the League Creator. When editing or scheduling a game, the Location dropdown is populated with the selected leagues' fields.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5"><BarChart2 size={14} /> Standings</p>
              <p>Standings are calculated automatically from all <em>Final</em> games with recorded scores. They include <strong>GP</strong> (games played), W, L, PCT, GB (games behind), RS (runs scored), RA (runs allowed), and DIFF.</p>
              <p>The embedded Standings widget also shows a <strong>Watch Live</strong> button when a game in that league is live with a stream URL.</p>
              <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-700 mt-1"><strong>League-scoped W-L records:</strong> W-L records shown on Game Bar and Calendar cards are calculated only from games in the same league(s) as that game. A game tagged to two leagues counts wins and losses toward both.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'scheduler',
      icon: <Wand2 size={18} />,
      title: 'Game Scheduler',
      color: 'text-emerald-600',
      content: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>The Scheduler generates a complete game calendar automatically. Open it from the <strong>Scheduler</strong> tab in the navigation.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: 'Single Game (Standard)', text: 'One game per matchup per round. The classic round-robin format.' },
              { label: 'Double Header (Same Day)', text: 'Two games between the same pair of teams on the same day.' },
              { label: 'Back-to-Back Series', text: 'Two games on consecutive days (e.g. Saturday + Sunday). Select the start day and the second game is placed the following day automatically.' },
              { label: 'Playoff Series (Best of N)', text: 'A best-of-3, 5, or 7 series between defined pairs. Games are spread across consecutive days from the series start date.' },
            ].map(({ label, text }) => (
              <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="font-semibold text-slate-700 mb-0.5">{label}</p>
                <p>{text}</p>
              </div>
            ))}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-emerald-800">Playoff Series — Series Matchups</p>
            <p>For Playoff Series mode, define one row per matchup under <strong>Series Matchups</strong>. Each row has a Series Name (e.g. "Quarterfinal", "Semifinal") and two team slots.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white border border-emerald-200 rounded p-3">
                <p className="font-semibold text-slate-700 mb-1">Manual mode</p>
                <p>Pick team names directly from the league roster for each slot.</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded p-3">
                <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1"><Trophy size={12} className="text-emerald-600" /> By Standings mode</p>
                <p>Each slot becomes a standings position (1st Place, 2nd Place…) with the current W-L shown. Positions resolve to real teams when you click Generate.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-slate-700">Game Mode (Playoff Series only)</p>
            <ul className="space-y-1">
              <li><strong>Alternate Games</strong> — Home/away alternates each game (Game 1 at Team 1, Game 2 at Team 2, Game 3 at Team 1…).</li>
              <li><strong>Back-to-Back Games</strong> — All games in the series are played at Team 1's home field.</li>
            </ul>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-indigo-800 flex items-center gap-1.5"><PlusCircle size={14} /> Replace vs Append</p>
            <p>The toggle just above the Generate button controls what happens to your existing calendar:</p>
            <ul className="space-y-1 text-indigo-700">
              <li><strong>Replace Existing</strong> — The generated games overwrite the current schedule entirely.</li>
              <li><strong>Append to Existing</strong> — The new games are added on top of whatever is already in the calendar. Use this to bolt playoff games onto a finished regular season.</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Conflict detection:</strong> After generating, the Scheduler warns you if any team ends up with two games on the same date. Review the calendar and drag games to resolve any clashes.
          </div>
        </div>
      ),
    },
    {
      id: 'print',
      icon: <Printer size={18} />,
      title: 'Printing the Schedule',
      color: 'text-slate-600',
      content: (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Click the <strong>printer icon</strong> in the Calendar toolbar to open the <strong>Print Preview</strong> modal. It shows all currently-filtered games in a clean table grouped by date — exactly what will be printed.</p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-slate-700">Table columns</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {[
                { col: '#', desc: 'Sequential row number' },
                { col: 'Game #', desc: 'Game number from the game record (if set)' },
                { col: 'Time', desc: 'Scheduled start time; series name shown in parentheses' },
                { col: 'Away / Home', desc: 'Team name with logo or colour dot' },
                { col: 'Location', desc: 'Playing field' },
                { col: 'League', desc: 'League name(s)' },
                { col: 'Result / Status', desc: 'Score for finished games, LIVE, PPD, or time for upcoming' },
              ].map(({ col, desc }) => (
                <div key={col} className="bg-white border border-slate-200 rounded p-2">
                  <p className="font-semibold text-slate-700">{col}</p>
                  <p className="text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <ul className="space-y-1.5">
            {[
              'The print view respects all active filters — only the games visible in the calendar are printed.',
              'Games are grouped under bold date headers and sorted by date then time.',
              'Press Escape or click the backdrop to close without printing.',
              'The "Print / Save PDF" button sends only the table to the printer — all app UI is hidden on the printed page.',
            ].map((item, i) => (
              <li key={i} className="flex items-start space-x-2">
                <CheckCircle size={14} className="mt-0.5 text-emerald-500 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: 'importexport',
      icon: <Download size={18} />,
      title: 'Import & Export',
      color: 'text-sky-600',
      content: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>Use the <strong>Import / Export</strong> buttons in the Calendar toolbar to move game data in and out of the app.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-sky-800 flex items-center gap-1.5"><Upload size={14} /> Import CSV</p>
              <p>Upload a <code className="bg-white border border-sky-200 px-1 rounded text-xs">.csv</code> file to bulk-add games. Each row maps to a game — team names are matched against your existing roster. Unrecognised teams are skipped with a warning.</p>
              <p className="text-xs text-sky-600">Useful for migrating a schedule built in a spreadsheet into Diamond Manager.</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-emerald-800 flex items-center gap-1.5"><Download size={14} /> Export CSV</p>
              <p>Downloads all currently visible games as a <code className="bg-white border border-emerald-200 px-1 rounded text-xs">.csv</code> file. Respects active filters — so you can export just one league's schedule if needed.</p>
              <p className="text-xs text-emerald-600">Open in Excel, Google Sheets, or any spreadsheet app.</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-violet-800 flex items-center gap-1.5"><FileText size={14} /> Export ICS</p>
              <p>Downloads a standard <code className="bg-white border border-violet-200 px-1 rounded text-xs">.ics</code> calendar file. Import it once into Google Calendar, Apple Calendar, or Outlook.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-amber-800 flex items-center gap-1.5"><RefreshCw size={14} /> iCal Subscription</p>
              <p>Use the live subscription URL (<code className="bg-white border border-amber-200 px-1 rounded text-xs">/subscribe.ics?key=…</code>) in your calendar app instead of importing a one-time file. The calendar app checks for updates automatically — new games and score changes appear without re-importing.</p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5"><Globe size={14} /> Public Schedule API</p>
            <p>Every published schedule is available as a machine-readable JSON feed at <code className="bg-white border border-slate-200 px-1 rounded text-xs">/schedule.json?key=your-key</code>. Use it to build custom integrations, scoreboards, or mobile apps that read live schedule data directly.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'tips',
      icon: <Star size={18} />,
      title: 'Tips & Shortcuts',
      color: 'text-rose-600',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
          {[
            { title: 'Drag & drop games', text: 'On the Calendar grid view, drag any game card to a new date to reschedule it instantly.' },
            { title: 'Playoff Bracket view', text: 'Tag games with a Series Name (e.g. "Quarterfinal", "Semifinal", "Final") in the Edit Game modal or generate them via the Playoff Series scheduler. The Bracket tab auto-builds a visual bracket with W-L tallies and per-game scores.' },
            { title: 'Playoff series by standings', text: 'In the Scheduler → Playoff Series mode, switch matchups to "By Standings" to let the app fill team slots from the current standings table automatically (1st vs 4th, 2nd vs 3rd, etc.).' },
            { title: 'Append games to calendar', text: 'Use the Replace / Append toggle in the Scheduler to add playoff or extra games on top of an existing schedule without overwriting it.' },
            { title: 'Print table view', text: 'Click the printer icon to open a full print preview modal. Games are listed in a table grouped by date, with game numbers, team names, locations, and scores. Only the table is sent to the printer.' },
            { title: 'Sticky Edit Mode tray', text: 'The "Games in Edit Mode" holding area sticks to the top of the calendar as you scroll — your staged games stay visible no matter how far down the page you go.' },
            { title: 'Bracket embed', text: 'Use the "Series / Playoff Bracket" embed type in the Embed Code tab to put a live, updating bracket on your website — rounds are ordered automatically by first game date.' },
            { title: 'Dark mode', text: 'Toggle dark mode with the Moon/Sun button in the top-right header. Your preference is saved across sessions.' },
            { title: 'Conflict detection', text: 'After generating a schedule, the Scheduler shows a warning if any team has two games on the same date.' },
            { title: 'W-L record on cards', text: 'Game Bar and Calendar list cards show each team\'s W-L record scoped to the league(s) of that game — not a combined total across all leagues.' },
            { title: 'Both teams in single-team view', text: 'When a team filter is active, embeds and calendar cards show both the selected team AND the opponent — not just the opponent.' },
            { title: 'Multi-league games', text: 'A single game can be tagged to multiple leagues at once — useful for playoff rounds spanning divisions.' },
            { title: 'Game Bar quick-update', text: 'Open a game from any embedded Game Bar widget and use Save & Publish to push score updates live without leaving the page.' },
            { title: 'Mobile list view', text: 'On small screens the Calendar automatically switches to list view — the month grid is desktop-only.' },
            { title: 'Schedule key per season', text: 'Use a different schedule key for each season or tournament so you can load historical schedules later without overwriting the current one.' },
            { title: 'Export to calendar apps', text: 'Use Export ICS (Calendar toolbar) to push your schedule to Google Calendar, Apple Calendar, or Outlook — each game becomes a calendar event with time, location, and team names.' },
            { title: 'Standings info text', text: 'In the Embed Code tab for Standings, type an Info Text note (e.g. "Updated after each game") — it appears inline at the bottom left of the embedded table next to the share button.' },
            { title: 'iCal subscription vs. export', text: 'Use the /subscribe.ics?key=… URL in your calendar app (Google Calendar → "Other calendars → From URL") to get live updates whenever games change. One-time ICS export doesn\'t stay in sync.' },
            { title: 'Pitcher & batter in overlay', text: 'Enter pitcher and batter names on the Score Entry page to show NOW PITCHING and AT BAT bars on the stream overlay. WBSC tracking fills these in automatically.' },
            { title: 'Show/hide recap ticker', text: 'Use the Show Recap toggle in Overlay Settings to hide the scrolling recap ticker during active play and reveal it at the end of the game or between innings.' },
            { title: 'WBSC Best Hitters', text: 'After a WBSC-tracked game, click Best Hitters on the Score Entry page to append a list of home run, triple, and double hitters to the recap text automatically.' },
            { title: 'Public schedule API', text: 'The /schedule.json?key=… endpoint returns your full published schedule as JSON — use it for custom scoreboards, mobile apps, or any external integration.' },
          ].map(({ title, text }) => (
            <div key={title} className="flex items-start space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <CheckCircle size={14} className="mt-0.5 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-700">{title}</p>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white shadow-xl mb-8">
        <div className="flex items-center space-x-3 mb-3">
          <div className="bg-white/20 rounded-lg p-2">
            <Star size={24} />
          </div>
          <h1 className="text-3xl font-bold">{t('help.title')}</h1>
        </div>
        <p className="text-indigo-100 text-base max-w-xl">
          {t('help.subtitle')}
        </p>
      </div>

      {/* Accordion sections */}
      <div className="space-y-3">
        {sections.map(({ id, icon, title, color, content }) => {
          const isOpen = openSection === id;
          return (
            <div
              key={id}
              className={`bg-white rounded-xl border transition-shadow ${isOpen ? 'border-indigo-200 shadow-md' : 'border-slate-200 shadow-sm'}`}
            >
              <button
                onClick={() => toggle(id)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center space-x-3">
                  <span className={color}>{icon}</span>
                  <span className="font-semibold text-slate-800">{title}</span>
                </div>
                {isOpen
                  ? <ChevronUp size={18} className="text-slate-400 flex-shrink-0" />
                  : <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                  {content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HelpPage;
