import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import EmbeddableCalendar from './components/EmbeddableCalendar';
import EmbeddableGameBar from './components/EmbeddableGameBar';
import './index.css';
import { loadPublishedScheduleByKey, StorageData } from './services/storage';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const embedType = urlParams.get('type') || 'calendar';
const leagueId = urlParams.get('league') || undefined;
const category = urlParams.get('category') || undefined;
const teamId = urlParams.get('team') || undefined;
const view = (urlParams.get('view') as 'grid' | 'list') || 'grid';
const height = urlParams.get('height') || (embedType === 'gamebar' ? '240px' : '800px');
const stylesParam = urlParams.get('styles');
const scheduleKey = urlParams.get('schedule_key') || undefined;
const hideLeagueFilter = urlParams.get('hide_league_filter') === '1';
const hideCategoryFilter = urlParams.get('hide_category_filter') === '1';
const hideTeamFilter = urlParams.get('hide_team_filter') === '1';

// Parse and apply custom styles
if (stylesParam) {
  try {
    const decodedStyles = decodeURIComponent(stylesParam);
    const customStyles = JSON.parse(decodedStyles);
    // Inject CSS variables into the document
    const style = document.createElement('style');
    style.id = 'embed-custom-styles';
    // Helper to convert hex to rgba with opacity
    const hexToRgba = (hex: string, opacity: number): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };
    
    const primaryColor = customStyles.primaryColor || '#4f46e5';
    const primaryLight = hexToRgba(primaryColor, 0.1);
    
    style.textContent = `
      :root {
        --embed-primary: ${primaryColor};
        --embed-primary-light: ${primaryLight};
        --embed-secondary: ${customStyles.secondaryColor || '#7c3aed'};
        --embed-bg: ${customStyles.backgroundColor || '#f8fafc'};
        --embed-text: ${customStyles.textColor || '#1e293b'};
        --embed-border: ${customStyles.borderColor || '#e2e8f0'};
        --embed-font: ${customStyles.fontFamily || 'Inter, sans-serif'};
        --embed-font-size: ${customStyles.fontSize || '14px'};
        --embed-radius: ${customStyles.borderRadius || '8px'};
        --embed-border-width: ${customStyles.borderWidth || '1px'};
        --embed-padding: ${customStyles.padding || '16px'};
        --embed-card-bg: ${customStyles.cardBackgroundColor || '#ffffff'};
        --embed-card-border: ${customStyles.cardBorderColor || '#e2e8f0'};
        --embed-card-radius: ${customStyles.cardBorderRadius || '8px'};
        --embed-card-shadow: ${customStyles.cardShadow || '0 1px 3px 0 rgba(0, 0, 0, 0.1)'};
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
      if (!scheduleKey) {
        setIsLoading(false);
        return;
      }
      let isActive = true;
      const loadSchedule = async () => {
        const data = await loadPublishedScheduleByKey(scheduleKey);
        if (!isActive) return;
        setScheduleData(data);
        setIsLoading(false);
      };
      loadSchedule();
      return () => {
        isActive = false;
      };
    }, []);

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Loading schedule...
        </div>
      );
    }

    if (scheduleKey && !scheduleData) {
      return (
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Schedule not found.
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

