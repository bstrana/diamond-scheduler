import React, { useState } from 'react';
import {
  Trophy, Users, Calendar, Clock, Send, Code, Star,
  CheckCircle, ChevronDown, ChevronUp, Radio, MapPin,
  BarChart2, Layers, Palette, RefreshCw, Globe, Zap
} from 'lucide-react';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  content: React.ReactNode;
}

const HelpPage: React.FC = () => {
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
              'Build leagues with custom categories and playing fields',
              'Roster teams with colors, logos, and player lists',
              'Generate round-robin or custom schedules in seconds',
              'Update scores inning-by-inning in real time',
              'Publish and embed live standings, calendars, and a game bar on any website',
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
            <p className="mt-1">Switch to the <strong>Calendar</strong> view to drag games to different dates, add individual games manually, or move games to the <em>Edit Mode</em> holding area while you reorganize.</p>
          </Step>
          <Step n={4} title="Record Results">
            <p>Click any game card on the Calendar to open the <strong>Edit Game</strong> modal. Change the status to <Chip label="Live" color="bg-green-100 text-green-700" /> or <Chip label="Final" color="bg-slate-200 text-slate-700" />, then enter runs per inning using the <strong>+ Inning</strong> buttons. Totals are calculated automatically.</p>
            <p className="mt-1">You can also add a game recap and a <strong>Live Stream URL</strong> — a Watch link will appear on every embedded view.</p>
          </Step>
          <Step n={5} title="Publish">
            <p>When you're ready to go live, open the user menu and click <strong>Publish Current Schedule</strong>. Enter a short schedule key (e.g. <code className="bg-slate-100 px-1 rounded text-xs">summer-2025</code>) and a display name, then hit Publish.</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: <Calendar size={16} />, label: 'Calendar', color: 'bg-indigo-50 border-indigo-200', text: 'Full month grid or upcoming-games list. Supports team, league, and category filters.' },
              { icon: <Layers size={16} />, label: 'Game Bar', color: 'bg-sky-50 border-sky-200', text: 'Compact horizontal ticker showing upcoming and live games. Great for a site header.' },
              { icon: <BarChart2 size={16} />, label: 'Standings', color: 'bg-violet-50 border-violet-200', text: 'Live W-L table with PCT, GB, RS, RA, and DIFF, auto-calculated from final game scores.' },
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
                { icon: <Star size={13} />, text: 'When a single league is pre-selected for a Standings embed, the league dropdown is automatically hidden' },
                { icon: <Calendar size={13} />, text: 'Calendar embeds in List view hide the grid/list toggle so visitors stay in list mode' },
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
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5"><Radio size={14} className="text-indigo-500" /> Live Stream URL</p>
            <p>Add a stream URL to any game. A <strong>Watch</strong> link with a radio icon appears on Calendar cards and Game Bar cards. Clicking it opens the stream in a new tab without leaving the schedule page.</p>
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
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5"><Users size={14} /> Teams</p>
              <p>Teams have a city, name, abbreviation, primary color, logo URL, country, and an optional player roster. They live inside leagues. The same team can be added to multiple leagues.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5"><MapPin size={14} /> Playing Fields</p>
              <p>Fields are managed at the <em>league</em> level (not the team level). Add field names in the League Creator. When editing or scheduling a game, the Location dropdown is populated with the selected leagues' fields.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5"><BarChart2 size={14} /> Standings</p>
              <p>Standings are calculated automatically from all <em>Final</em> games with recorded scores. They include W, L, PCT, GB (games behind), RS (runs scored), RA (runs allowed), and DIFF.</p>
            </div>
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
            { title: 'Multi-league games', text: 'A single game can be tagged to multiple leagues at once — useful for playoff rounds spanning divisions.' },
            { title: 'Game Bar quick-update', text: 'Open a game from any embedded Game Bar widget and use Save & Publish to push score updates live without leaving the page.' },
            { title: 'W-L record on cards', text: 'Calendar list view shows each team\'s win-loss record (e.g. 3-2) calculated from all final games in the current filtered view.' },
            { title: 'Mobile list view', text: 'On small screens the Calendar automatically switches to list view — the month grid is desktop-only.' },
            { title: 'Edit Mode holding area', text: 'Drag games into the "Games in Edit Mode" tray to temporarily remove them from the calendar while reorganizing the schedule.' },
            { title: 'Series names', text: 'Tag games with a series name (e.g. "Semifinal", "Final") to highlight them on calendar cards and in embeds.' },
            { title: 'Schedule key per season', text: 'Use a different schedule key for each season or tournament so you can load historical schedules later without overwriting the current one.' },
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
          <h1 className="text-3xl font-bold">Help & Guide</h1>
        </div>
        <p className="text-indigo-100 text-base max-w-xl">
          Everything you need to know about Diamond Manager Scheduler — from setting up your first league to embedding live standings on your website.
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
