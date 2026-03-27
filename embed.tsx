import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import EmbeddableCalendar from './components/EmbeddableCalendar';
import EmbeddableGameBar from './components/EmbeddableGameBar';
import EmbeddableStandings from './components/EmbeddableStandings';
import EmbeddableSeries from './components/EmbeddableSeries';
import EmbeddableTeamGames from './components/EmbeddableTeamGames';
import './index.css';
import './i18n';
import {
  loadPublishedScheduleByKey,
  listScoreEditsByScheduleKey,
  StorageData,
} from './services/storage';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const embedType = urlParams.get('type') || 'calendar';
const leagueId = urlParams.get('league') || undefined;
const category = urlParams.get('category') || undefined;
const teamId = urlParams.get('team') || undefined;
const view = (urlParams.get('view') as 'grid' | 'list') || 'grid';
const height = urlParams.get('height') || (embedType === 'gamebar' ? '260px' : '800px');
const stylesParam = urlParams.get('styles');
const scheduleKey = urlParams.get('schedule_key') || undefined;
const hideLeagueFilter = urlParams.get('hide_league_filter') === '1';
const hideCategoryFilter = urlParams.get('hide_category_filter') === '1';
const hideTeamFilter = urlParams.get('hide_team_filter') === '1';
const hideStatusFilter = urlParams.get('hide_status_filter') === '1';
const hideLeagueName = urlParams.get('hide_league_name') === '1';
const hideGameNumber = urlParams.get('hide_game_number') === '1';
const standingsInfoText = urlParams.get('info_text') || undefined;
const orgName = urlParams.get('org_name') || undefined;

// Sanitize CSS property values to prevent CSS injection
const sanitizeCssColor = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  // Allow hex colors, rgb/rgba/hsl/hsla functions, and CSS named colors (letters only)
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*[\d.]+)?\s*\)$/.test(v)) return v;
  if (/^hsla?\(\s*\d{1,3}\s*,\s*[\d.]+%\s*,\s*[\d.]+%(\s*,\s*[\d.]+)?\s*\)$/.test(v)) return v;
  if (/^[a-zA-Z]{2,30}$/.test(v)) return v; // named colors like "red", "transparent"
  return fallback;
};

const sanitizeCssSize = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(v)) return v;
  return fallback;
};

const sanitizeCssShadow = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  // Allow only safe shadow values: digits, spaces, px, rgba(...), commas
  if (/^[\d\s\-.,a-zA-Z%()]+$/.test(v) && v.length < 200) return v;
  return fallback;
};

const sanitizeCssFontFamily = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  // Allow letters, digits, spaces, commas, hyphens, underscores, and quotes
  if (/^[a-zA-Z0-9,\s\-_'"]{1,100}$/.test(v)) return v;
  return fallback;
};

// Helper to convert hex to rgba with opacity
const hexToRgba = (hex: string, opacity: number): string => {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return `rgba(79, 70, 229, ${opacity})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Parse and apply custom styles
if (stylesParam) {
  try {
    const decodedStyles = decodeURIComponent(stylesParam);
    const customStyles = JSON.parse(decodedStyles);
    // Inject CSS variables into the document
    const style = document.createElement('style');
    style.id = 'embed-custom-styles';

    const primaryColor = sanitizeCssColor(customStyles.primaryColor, '#4f46e5');
    const primaryLight = hexToRgba(primaryColor, 0.1);

    style.textContent = `
      :root {
        --embed-primary: ${primaryColor};
        --embed-primary-light: ${primaryLight};
        --embed-secondary: ${sanitizeCssColor(customStyles.secondaryColor, '#7c3aed')};
        --embed-bg: ${sanitizeCssColor(customStyles.backgroundColor, '#f8fafc')};
        --embed-text: ${sanitizeCssColor(customStyles.textColor, '#1e293b')};
        --embed-border: ${sanitizeCssColor(customStyles.borderColor, '#e2e8f0')};
        --embed-font: ${sanitizeCssFontFamily(customStyles.fontFamily, 'Inter, sans-serif')};
        --embed-font-size: ${sanitizeCssSize(customStyles.fontSize, '14px')};
        --embed-radius: ${sanitizeCssSize(customStyles.borderRadius, '8px')};
        --embed-border-width: ${sanitizeCssSize(customStyles.borderWidth, '1px')};
        --embed-padding: ${sanitizeCssSize(customStyles.padding, '16px')};
        --embed-card-bg: ${sanitizeCssColor(customStyles.cardBackgroundColor, '#ffffff')};
        --embed-card-border: ${sanitizeCssColor(customStyles.cardBorderColor, '#e2e8f0')};
        --embed-card-radius: ${sanitizeCssSize(customStyles.cardBorderRadius, '8px')};
        --embed-card-shadow: ${sanitizeCssShadow(customStyles.cardShadow, '0 1px 3px 0 rgba(0, 0, 0, 0.1)')};
        --embed-announcement-bg: ${sanitizeCssColor(customStyles.announcementBackgroundColor, '#fef3c7')};
        --embed-announcement-text: ${sanitizeCssColor(customStyles.announcementTextColor, '#92400e')};
        --embed-announcement-border: ${sanitizeCssColor(customStyles.announcementBorderColor, '#fcd34d')};
      }
      body {
        font-family: var(--embed-font);
        font-size: var(--embed-font-size);
        background-color: var(--embed-bg);
        color: var(--embed-text);
      }
    `;
    document.head.appendChild(style);
  } catch (e) {
    console.error('Failed to parse styles:', e);
  }
}

const rootElement = document.getElementById('embed-root');
if (!rootElement) {
  console.error("Could not find root element to mount to");
} else {
  const root = ReactDOM.createRoot(rootElement);

  const EmbeddedApp: React.FC = () => {
    const [scheduleData, setScheduleData] = useState<StorageData | null>(null);
    const [isLoading, setIsLoading] = useState(!!scheduleKey);

    useEffect(() => {
      // Require schedule_key parameter - no data without it
      if (!scheduleKey) {
        setIsLoading(false);
        return;
      }

      const applyEditsOverlay = (data: StorageData, scoreEdits: Awaited<ReturnType<typeof listScoreEditsByScheduleKey>>) => {
        const editMap = new Map(scoreEdits.map(e => [e.gameId, e]));
        return {
          ...data,
          games: data.games.map(g => {
            const edit = editMap.get(g.id);
            if (!edit) return g;
            return { ...g, status: edit.status, scores: edit.scores ?? g.scores };
          }),
        };
      };

      let isActive = true;

      // Full reload — re-fetches both base schedule and all current score edits
      const reload = async () => {
        const [data, scoreEdits] = await Promise.all([
          loadPublishedScheduleByKey(scheduleKey),
          listScoreEditsByScheduleKey(scheduleKey),
        ]);
        if (!isActive || !data) return;
        setScheduleData(applyEditsOverlay(data, scoreEdits));
        setIsLoading(false);
      };

      reload();

      // Poll every 15 s — sufficient for a public scoreboard display.
      // SSE is intentionally not used here: the browser logs a native
      // console error when EventSource gets the wrong MIME type, which
      // cannot be suppressed from JS even with a .catch() handler.
      const interval = setInterval(reload, 15_000);

      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [scheduleKey]);

    // Require schedule_key - show error if missing
    if (!scheduleKey) {
      return (
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Schedule key required. Please provide a valid schedule_key parameter.
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Loading schedule...
        </div>
      );
    }

    // Require valid published schedule - show error if not found
    if (!scheduleData) {
      return (
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Schedule not found or not available.
        </div>
      );
    }

    if (embedType === 'gamebar') {
      return (
        <EmbeddableGameBar
          initialLeagueId={leagueId}
          initialCategory={category}
          initialTeamId={teamId}
          height={height}
          dataOverride={scheduleData ? {
            leagues: scheduleData.leagues,
            teams: scheduleData.teams,
            games: scheduleData.games
          } : null}
          hideLeagueFilter={hideLeagueFilter}
          hideCategoryFilter={hideCategoryFilter}
          hideTeamFilter={hideTeamFilter}
          hideStatusFilter={hideStatusFilter}
          hideLeagueName={hideLeagueName}
          hideGameNumber={hideGameNumber}
          orgName={orgName}
        />
      );
    }

    if (embedType === 'standings') {
      return (
        <EmbeddableStandings
          leagueId={leagueId}
          scheduleKey={scheduleKey}
          dataOverride={scheduleData ? {
            leagues: scheduleData.leagues,
            teams: scheduleData.teams,
            games: scheduleData.games
          } : null}
          infoText={standingsInfoText}
        />
      );
    }

    if (embedType === 'series') {
      return (
        <EmbeddableSeries
          leagueId={leagueId}
          scheduleKey={scheduleKey}
          dataOverride={scheduleData ? {
            leagues: scheduleData.leagues,
            teams: scheduleData.teams,
            games: scheduleData.games
          } : null}
        />
      );
    }

    if (embedType === 'teamgames') {
      return (
        <EmbeddableTeamGames
          teamId={teamId}
          height={height}
          dataOverride={scheduleData ? {
            leagues: scheduleData.leagues,
            teams: scheduleData.teams,
            games: scheduleData.games
          } : null}
          orgName={orgName}
        />
      );
    }

    return (
      <EmbeddableCalendar
        initialLeagueId={leagueId}
        initialCategory={category}
        initialTeamId={teamId}
        initialView={view}
        height={height}
        dataOverride={scheduleData ? {
          leagues: scheduleData.leagues,
          teams: scheduleData.teams,
          games: scheduleData.games
        } : null}
        hideLeagueFilter={hideLeagueFilter}
        hideCategoryFilter={hideCategoryFilter}
        hideTeamFilter={hideTeamFilter}
      />
    );
  };

  root.render(
    <React.StrictMode>
      <EmbeddedApp />
    </React.StrictMode>
  );
}

