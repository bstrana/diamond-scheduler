import React, { useState, useMemo, useEffect } from 'react';
import { League, Team } from '../types';
import { Copy, Check, Code, ExternalLink } from 'lucide-react';
import EmbedStyler, { EmbedStyles } from './EmbedStyler';
import * as storageApi from '../services/storage';

interface EmbedCodeGeneratorProps {
  leagues: League[];
  teams: Team[];
  currentUrl: string;
}

const EmbedCodeGenerator: React.FC<EmbedCodeGeneratorProps> = ({ leagues, teams, currentUrl }) => {
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [embedView, setEmbedView] = useState<'calendar' | 'gamebar'>('calendar');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [height, setHeight] = useState<string>('800');
  const [scheduleKey, setScheduleKey] = useState<string>('');
  const [publishedSchedules, setPublishedSchedules] = useState<{ id: string; scheduleKey: string; scheduleName?: string }[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [hideLeagueFilter, setHideLeagueFilter] = useState(false);
  const [hideCategoryFilter, setHideCategoryFilter] = useState(false);
  const [hideTeamFilter, setHideTeamFilter] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showStyler, setShowStyler] = useState(false);
  const [embedStyles, setEmbedStyles] = useState<EmbedStyles | null>(null);

  // Update height when embed view changes
  useEffect(() => {
    if (embedView === 'gamebar') {
      setHeight('400');
    } else if (embedView === 'calendar') {
      setHeight('800');
    }
  }, [embedView]);

  useEffect(() => {
    let isActive = true;
    const loadSchedules = async () => {
      if (!storageApi.listPublishedSchedules) return;
      setIsLoadingSchedules(true);
      const items = await storageApi.listPublishedSchedules();
      if (!isActive) return;
      setPublishedSchedules(items);
      setIsLoadingSchedules(false);
    };
    loadSchedules();
    return () => {
      isActive = false;
    };
  }, []);

  // Get base URL (remove hash/query if present)
  const baseUrl = useMemo(() => {
    try {
      const url = new URL(currentUrl);
      return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '');
    } catch {
      return window.location.origin;
    }
  }, [currentUrl]);

  // Build embed URL
  const embedUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('type', embedView);
    if (selectedLeagueId !== 'all') params.set('league', selectedLeagueId);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (selectedTeamId !== 'all') params.set('team', selectedTeamId);
    if (scheduleKey) params.set('schedule_key', scheduleKey);
    if (hideLeagueFilter) params.set('hide_league_filter', '1');
    if (hideCategoryFilter) params.set('hide_category_filter', '1');
    if (hideTeamFilter) params.set('hide_team_filter', '1');
    if (embedView === 'calendar' && viewType !== 'grid') params.set('view', viewType);
    params.set('height', `${height}px`);
    
    // Add style parameters if custom styles are set
    // Note: For very long style strings, consider using localStorage or a different approach
    if (embedStyles) {
      try {
        const stylesJson = JSON.stringify(embedStyles);
        // Only add if it's not too long (URLs have length limits)
        if (stylesJson.length < 2000) {
          params.set('styles', encodeURIComponent(stylesJson));
        }
      } catch (e) {
        console.error('Failed to stringify styles:', e);
      }
    }
    
    return `${baseUrl}/embed.html${params.toString() ? '?' + params.toString() : ''}`;
  }, [
    baseUrl,
    embedView,
    selectedLeagueId,
    selectedCategory,
    selectedTeamId,
    viewType,
    height,
    embedStyles,
    scheduleKey,
    hideLeagueFilter,
    hideCategoryFilter,
    hideTeamFilter
  ]);

  // Generate embed code
  const embedCode = useMemo(() => {
    const defaultHeight = embedView === 'gamebar' ? '400' : '800';
    const finalHeight = height || defaultHeight;
    const borderColor = embedStyles?.borderColor || '#e2e8f0';
    const borderRadius = embedStyles?.borderRadius || '8px';
    return `<iframe 
  src="${embedUrl}" 
  width="100%" 
  height="${finalHeight}px" 
  frameborder="0" 
  scrolling="auto"
  style="border: 1px solid ${borderColor}; border-radius: ${borderRadius};">
</iframe>`;
  }, [embedUrl, height, embedView, embedStyles]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const categories = useMemo(() => {
    return Array.from(new Set(leagues.map(l => l.category).filter(Boolean)));
  }, [leagues]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-xl text-white shadow-xl">
        <div className="flex items-center space-x-3 mb-2">
          <Code className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Embed Calendar</h2>
        </div>
        <p className="opacity-90 text-sm">
          Generate embed code to display your calendar on WordPress, Squarespace, or any website.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-slate-800">Configure Embed Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Schedule Source */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Source</label>
            <select
              value={scheduleKey}
              onChange={(e) => setScheduleKey(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">
                {isLoadingSchedules ? 'Loading schedules...' : 'Local (current data)'}
              </option>
              {publishedSchedules.map((schedule) => (
                <option key={schedule.id} value={schedule.scheduleKey}>
                  {schedule.scheduleName || schedule.scheduleKey}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Select an active schedule published to the database.
            </p>
          </div>

          {/* Filter Visibility */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Show Filters</label>
            <div className="space-y-2 rounded-md border border-slate-200 p-3 text-sm">
              <label className="flex items-center space-x-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={!hideLeagueFilter}
                  onChange={(e) => setHideLeagueFilter(!e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>League filter</span>
              </label>
              <label className="flex items-center space-x-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={!hideCategoryFilter}
                  onChange={(e) => setHideCategoryFilter(!e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Category filter</span>
              </label>
              <label className="flex items-center space-x-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={!hideTeamFilter}
                  onChange={(e) => setHideTeamFilter(!e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Team filter</span>
              </label>
            </div>
          </div>

          {/* League Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Filter by League</label>
            <select 
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Leagues</option>
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Category</label>
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {/* Team Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Team</label>
            <select 
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Teams</option>
              <option disabled>──────────</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.city} {t.name}</option>
              ))}
            </select>
          </div>

          {/* Embed Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Embed Type</label>
            <select 
              value={embedView}
              onChange={(e) => setEmbedView(e.target.value as 'calendar' | 'gamebar')}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="calendar">Calendar View</option>
              <option value="gamebar">Game Bar</option>
            </select>
          </div>

          {/* View Type (only for calendar) */}
          {embedView === 'calendar' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Calendar View</label>
              <select 
                value={viewType}
                onChange={(e) => setViewType(e.target.value as 'grid' | 'list')}
                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="grid">Grid View</option>
                <option value="list">List View</option>
              </select>
            </div>
          )}

          {/* Height */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Height (px)</label>
            <input 
              type="number"
              min={embedView === 'gamebar' ? '300' : '400'}
              max="2000"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder={embedView === 'gamebar' ? '400' : '800'}
            />
            <p className="text-xs text-slate-500 mt-1">
              Recommended: {embedView === 'gamebar' ? '300-500px' : '600-1000px'}
            </p>
          </div>
        </div>

        {/* Style Customization */}
        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={() => setShowStyler(!showStyler)}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors text-sm font-medium"
          >
            <Code size={16} />
            <span>{showStyler ? 'Hide' : 'Show'} Style Customization</span>
          </button>
          {showStyler && (
            <div className="mt-4">
              <EmbedStyler
                onStyleChange={setEmbedStyles}
                initialStyles={embedStyles || undefined}
              />
            </div>
          )}
        </div>

        {/* Embed Code Preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">Embed Code</label>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm"
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          <textarea
            readOnly
            value={embedCode}
            className="w-full h-32 p-3 border border-slate-300 rounded-md bg-slate-50 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </div>

        {/* Preview Link */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Preview Embed</p>
              <p className="text-xs text-slate-500">Open in a new tab to see how it looks</p>
            </div>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors text-sm"
            >
              <ExternalLink size={16} />
              <span>Open Preview</span>
            </a>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">How to Use:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Configure your filters and settings above</li>
            <li>Copy the embed code</li>
            <li>Paste it into your WordPress page/post (use HTML block or code editor)</li>
            <li>Or paste it into any website that supports iframes</li>
          </ol>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-700 font-medium mb-1">Embed Features:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-600">
              <li>Shows all game information including series names (Semifinal, Final, etc.)</li>
              <li>Displays team logos, game times, and locations</li>
              <li>Supports filtering by league, category, and team</li>
              <li>Calendar view supports both grid and list layouts</li>
              <li>Game bar shows upcoming scheduled games in a horizontal timeline</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedCodeGenerator;

