import React, { useState, useMemo, useEffect } from 'react';
import { League, Team, Game } from '../types';
import { Copy, Check, Code, ExternalLink } from 'lucide-react';
import EmbedStyler, { EmbedStyles } from './EmbedStyler';
import EmbeddableCalendar from './EmbeddableCalendar';
import EmbeddableGameBar from './EmbeddableGameBar';
import EmbeddableStandings from './EmbeddableStandings';
import EmbeddableSeries from './EmbeddableSeries';
import * as storageApi from '../services/storage';
import { useTranslation } from 'react-i18next';

interface EmbedCodeGeneratorProps {
  leagues: League[];
  teams: Team[];
  games: Game[];
  currentUrl: string;
  loadedScheduleKey?: string;
  isPublishedScheduleLoaded: boolean;
  userId?: string;
  orgId?: string;
  orgName?: string;
}

const EmbedCodeGenerator: React.FC<EmbedCodeGeneratorProps> = ({
  leagues,
  teams,
  games,
  currentUrl,
  loadedScheduleKey,
  isPublishedScheduleLoaded,
  userId,
  orgId,
  orgName,
}) => {
  const { t } = useTranslation();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [embedView, setEmbedView] = useState<'calendar' | 'gamebar' | 'standings' | 'series'>('calendar');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [height, setHeight] = useState<string>('800');
  const [scheduleKey, setScheduleKey] = useState<string>(loadedScheduleKey || '');
  const [publishedSchedules, setPublishedSchedules] = useState<{ id: string; scheduleKey: string; scheduleName?: string; active: boolean }[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [hideLeagueFilter, setHideLeagueFilter] = useState(false);
  const [hideCategoryFilter, setHideCategoryFilter] = useState(false);
  const [hideTeamFilter, setHideTeamFilter] = useState(false);
  const [hideStatusFilter, setHideStatusFilter] = useState(false);
  const [hideLeagueName, setHideLeagueName] = useState(false);
  const [hideGameNumber, setHideGameNumber] = useState(false);
  const [standingsInfoText, setStandingsInfoText] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showStyler, setShowStyler] = useState(false);
  const [embedStyles, setEmbedStyles] = useState<EmbedStyles | null>(null);

  // Update height when embed view changes
  useEffect(() => {
    if (embedView === 'gamebar') {
      setHeight('260');
    } else if (embedView === 'standings') {
      setHeight('500');
    } else if (embedView === 'series') {
      setHeight('500');
    } else {
      setHeight('800');
    }
  }, [embedView]);

  // Update scheduleKey when loadedScheduleKey changes
  useEffect(() => {
    if (loadedScheduleKey) {
      setScheduleKey(loadedScheduleKey);
    }
  }, [loadedScheduleKey]);

  useEffect(() => {
    let isActive = true;
    const loadSchedules = async () => {
      if (!storageApi.listPublishedSchedules) return;
      setIsLoadingSchedules(true);
      const items = await storageApi.listPublishedSchedules({ userId, orgId }, { onlyActive: true });
      if (!isActive) return;
      setPublishedSchedules(items);
      setIsLoadingSchedules(false);
    };
    loadSchedules();
    return () => {
      isActive = false;
    };
  }, [userId, orgId]);

  // Get base URL (remove hash/query if present)
  const baseUrl = useMemo(() => {
    try {
      const url = new URL(currentUrl);
      return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '');
    } catch {
      return window.location.origin;
    }
  }, [currentUrl]);

  // Build embed URL - only if scheduleKey is set (published schedule required)
  const embedUrl = useMemo(() => {
    if (!scheduleKey) return '';
    const params = new URLSearchParams();
    params.set('type', embedView);
    if (selectedLeagueId !== 'all') params.set('league', selectedLeagueId);
    params.set('schedule_key', scheduleKey);
    if (embedView === 'standings' && standingsInfoText.trim()) {
      params.set('info_text', standingsInfoText.trim());
    }
    if (embedView !== 'standings' && embedView !== 'series') {
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedTeamId !== 'all') params.set('team', selectedTeamId);
      if (hideLeagueFilter) params.set('hide_league_filter', '1');
      if (hideCategoryFilter) params.set('hide_category_filter', '1');
      if (hideTeamFilter) params.set('hide_team_filter', '1');
      if (embedView === 'gamebar' && hideStatusFilter) params.set('hide_status_filter', '1');
      if (embedView === 'gamebar' && hideLeagueName) params.set('hide_league_name', '1');
      if (embedView === 'gamebar' && hideGameNumber) params.set('hide_game_number', '1');
      if (embedView === 'gamebar' && orgName) params.set('org_name', orgName);
      if (embedView === 'calendar' && viewType !== 'grid') params.set('view', viewType);
    }
    params.set('height', `${height}px`);

    if (embedStyles) {
      try {
        const stylesJson = JSON.stringify(embedStyles);
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
    hideTeamFilter,
    hideStatusFilter,
    hideLeagueName,
    hideGameNumber,
    standingsInfoText,
  ]);

  // Generate embed code
  const embedCode = useMemo(() => {
    const defaultHeight = embedView === 'gamebar' ? '260' : (embedView === 'standings' || embedView === 'series') ? '500' : '800';
    const finalHeight = height || defaultHeight;
    const borderColor = embedStyles?.borderColor || '#e2e8f0';
    const borderRadius = embedStyles?.borderRadius || '8px';
    const isTransparentBg = embedStyles?.backgroundColor === 'transparent';
    const transparencyAttr = isTransparentBg ? '\n  allowtransparency="true"' : '';
    const bgStyle = isTransparentBg ? 'background: transparent; ' : '';
    return `<iframe
  src="${embedUrl}"
  width="100%"
  height="${finalHeight}px"
  frameborder="0"
  scrolling="auto"
  allowfullscreen${transparencyAttr}
  style="${bgStyle}border: 1px solid ${borderColor}; border-radius: ${borderRadius};">
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
          <h2 className="text-2xl font-bold">{t('embed.title')}</h2>
        </div>
        <p className="opacity-90 text-sm">
          {t('embed.subtitle')}
        </p>
      </div>

      {!isPublishedScheduleLoaded && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800 mb-1">{t('embed.publishedScheduleRequired')}</h3>
              <p className="text-sm text-amber-700">
                {t('embed.publishedScheduleInfo')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-slate-800">{t('embed.configureSettings')}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Schedule Source */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('embed.scheduleSource')}</label>
            <select
              value={scheduleKey}
              onChange={(e) => setScheduleKey(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">
                {isLoadingSchedules ? t('embed.loadingSchedules') : t('embed.selectPublishedSchedule')}
              </option>
              {publishedSchedules
                .filter((schedule) => schedule.active)
                .map((schedule) => (
                  <option key={schedule.id} value={schedule.scheduleKey}>
                    {schedule.scheduleName || schedule.scheduleKey} {schedule.active ? `(${t('common.active')})` : ''}
                  </option>
                ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {t('embed.selectActiveSchedule')}
            </p>
          </div>

          {/* Filter Visibility (not applicable for standings/series) */}
          {embedView !== 'standings' && embedView !== 'series' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('embed.showFilters')}</label>
              <div className="space-y-2 rounded-md border border-slate-200 p-3 text-sm">
                <label className="flex items-center space-x-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={!hideLeagueFilter}
                    onChange={(e) => setHideLeagueFilter(!e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{t('embed.leagueFilter')}</span>
                </label>
                <label className="flex items-center space-x-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={!hideCategoryFilter}
                    onChange={(e) => setHideCategoryFilter(!e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{t('embed.categoryFilter')}</span>
                </label>
                <label className="flex items-center space-x-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={!hideTeamFilter}
                    onChange={(e) => setHideTeamFilter(!e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{t('embed.teamFilter')}</span>
                </label>
                {embedView === 'gamebar' && (
                  <label className="flex items-center space-x-2 text-slate-600">
                    <input
                      type="checkbox"
                      checked={!hideStatusFilter}
                      onChange={(e) => setHideStatusFilter(!e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{t('embed.statusFilter')}</span>
                  </label>
                )}
                {embedView === 'gamebar' && (
                  <>
                    <label className="flex items-center space-x-2 text-slate-600">
                      <input
                        type="checkbox"
                        checked={!hideLeagueName}
                        onChange={(e) => setHideLeagueName(!e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{t('embed.showLeagueName')}</span>
                    </label>
                    <label className="flex items-center space-x-2 text-slate-600">
                      <input
                        type="checkbox"
                        checked={!hideGameNumber}
                        onChange={(e) => setHideGameNumber(!e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{t('embed.showGameNumber')}</span>
                    </label>
                  </>
                )}
              </div>
            </div>
          )}

          {/* League Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('embed.filterByLeague')}</label>
            <select
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">{t('embed.allLeagues')}</option>
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('embed.filterByCategory')}</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">{t('embed.allCategories')}</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {/* Team Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('embed.filterByTeam')}</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">{t('embed.allTeams')}</option>
              <option disabled>──────────</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.city} {t.name}</option>
              ))}
            </select>
          </div>

          {/* Embed Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('embed.embedType')}</label>
            <select
              value={embedView}
              onChange={(e) => setEmbedView(e.target.value as 'calendar' | 'gamebar' | 'standings' | 'series')}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="calendar">{t('embed.calendarView')}</option>
              <option value="gamebar">{t('embed.gameBar')}</option>
              <option value="standings">{t('embed.leagueStandings')}</option>
              <option value="series">{t('embed.seriesBracket')}</option>
            </select>
          </div>

          {/* View Type (only for calendar) */}
          {embedView === 'calendar' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('embed.calendarViewLabel')}</label>
              <select
                value={viewType}
                onChange={(e) => setViewType(e.target.value as 'grid' | 'list')}
                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="grid">{t('embed.gridView')}</option>
                <option value="list">{t('embed.listView')}</option>
              </select>
            </div>
          )}

          {/* Standings options */}
          {embedView === 'standings' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('embed.standingsInfoText', 'Info text')}</label>
                <input
                  type="text"
                  value={standingsInfoText}
                  onChange={(e) => setStandingsInfoText(e.target.value)}
                  placeholder={t('embed.standingsInfoTextPlaceholder', 'e.g. Last updated: March 2026')}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">{t('embed.standingsInfoTextHelp', 'Shown at the bottom left of the standings table.')}</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3 text-sm text-indigo-800">
                {t('embed.standingsNote')}
              </div>
            </div>
          )}

          {/* Series note */}
          {embedView === 'series' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3 text-sm text-indigo-800">
              {t('embed.seriesNote')}
            </div>
          )}

          {/* Height */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('embed.heightPx')}</label>
            <input
              type="number"
              min={embedView === 'gamebar' ? '260' : (embedView === 'standings' || embedView === 'series') ? '300' : '400'}
              max="2000"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder={embedView === 'gamebar' ? '260' : (embedView === 'standings' || embedView === 'series') ? '500' : '800'}
            />
            <p className="text-xs text-slate-500 mt-1">
              {t('embed.recommended')} {embedView === 'gamebar' ? '260–400px' : (embedView === 'standings' || embedView === 'series') ? '400–700px' : '600–1000px'}
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
            <span>{showStyler ? t('embed.hideStyleCustomization') : t('embed.showStyleCustomization')}</span>
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
            <label className="block text-sm font-medium text-slate-700">{t('embed.embedCode')}</label>
            <button
              onClick={handleCopy}
              disabled={!scheduleKey || !embedUrl}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md transition-colors text-sm ${
                scheduleKey && embedUrl
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>{t('common.copied')}</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>{t('embed.copyCode')}</span>
                </>
              )}
            </button>
          </div>
          <textarea
            readOnly
            value={scheduleKey && embedUrl ? embedCode : t('embed.noScheduleComment')}
            className={`w-full h-32 p-3 border border-slate-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
              scheduleKey && embedUrl ? 'bg-slate-50' : 'bg-slate-100 text-slate-500'
            }`}
            onClick={(e) => {
              if (scheduleKey && embedUrl) {
                (e.target as HTMLTextAreaElement).select();
              }
            }}
          />
          {!scheduleKey && (
            <p className="text-xs text-amber-600 mt-1">
              {t('embed.selectScheduleComment')}
            </p>
          )}

          {/* Per-team deep-link */}
          {selectedTeamId !== 'all' && scheduleKey && embedUrl && (() => {
            const selectedTeam = teams.find(t => t.id === selectedTeamId);
            return selectedTeam ? (
              <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-md">
                <p className="text-xs font-semibold text-indigo-800 mb-1">
                  {t('embed.teamDeepLink', { team: `${selectedTeam.city} ${selectedTeam.name}` })}
                </p>
                <p className="text-xs text-indigo-600 mb-2">
                  {t('embed.teamDeepLinkHelp')}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-indigo-200 rounded px-2 py-1.5 break-all font-mono text-slate-700">
                    {embedUrl}
                  </code>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(embedUrl);
                    }}
                    className="flex-shrink-0 p-1.5 text-indigo-600 hover:bg-indigo-100 rounded"
                    title="Copy team deep-link"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            ) : null;
          })()}
        </div>

        {/* Preview */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">{t('embed.previewEmbed')}</p>
              <p className="text-xs text-slate-500">{t('embed.previewDescription')}</p>
            </div>
            <a
              href={scheduleKey && embedUrl ? embedUrl : '#'}
              onClick={(e) => { if (!scheduleKey || !embedUrl) e.preventDefault(); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors text-sm ${
                scheduleKey && embedUrl
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed pointer-events-none'
              }`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} />
              <span>{t('embed.openInNewTab')}</span>
            </a>
          </div>
          <div
            className="rounded-lg overflow-hidden border border-slate-200"
            style={{ height: `${Math.min(parseInt(height) || 800, 600)}px` }}
          >
            {embedView === 'gamebar' ? (
              <EmbeddableGameBar
                initialLeagueId={selectedLeagueId !== 'all' ? selectedLeagueId : undefined}
                initialCategory={selectedCategory !== 'all' ? selectedCategory : undefined}
                initialTeamId={selectedTeamId !== 'all' ? selectedTeamId : undefined}
                height={`${Math.min(parseInt(height) || 260, 600)}px`}
                dataOverride={{ leagues, teams, games }}
                hideLeagueFilter={hideLeagueFilter}
                hideCategoryFilter={hideCategoryFilter}
                hideTeamFilter={hideTeamFilter}
                hideStatusFilter={hideStatusFilter}
                hideLeagueName={hideLeagueName}
                hideGameNumber={hideGameNumber}
              />
            ) : embedView === 'standings' ? (
              <EmbeddableStandings
                leagueId={selectedLeagueId !== 'all' ? selectedLeagueId : undefined}
                dataOverride={{ leagues, teams, games }}
                infoText={standingsInfoText.trim() || undefined}
              />
            ) : embedView === 'series' ? (
              <EmbeddableSeries
                leagueId={selectedLeagueId !== 'all' ? selectedLeagueId : undefined}
                dataOverride={{ leagues, teams, games }}
              />
            ) : (
              <EmbeddableCalendar
                initialLeagueId={selectedLeagueId !== 'all' ? selectedLeagueId : undefined}
                initialCategory={selectedCategory !== 'all' ? selectedCategory : undefined}
                initialTeamId={selectedTeamId !== 'all' ? selectedTeamId : undefined}
                initialView={viewType}
                height={`${Math.min(parseInt(height) || 800, 600)}px`}
                dataOverride={{ leagues, teams, games }}
                hideLeagueFilter={hideLeagueFilter}
                hideCategoryFilter={hideCategoryFilter}
                hideTeamFilter={hideTeamFilter}
              />
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">{t('embed.howToUse')}</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>{t('embed.step1')}</li>
            <li>{t('embed.step2')}</li>
            <li>{t('embed.step3')}</li>
            <li>{t('embed.step4')}</li>
          </ol>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-700 font-medium mb-1">{t('embed.embedFeatures')}</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-600">
              <li>{t('embed.feature1')}</li>
              <li>{t('embed.feature2')}</li>
              <li>{t('embed.feature3')}</li>
              <li>{t('embed.feature4')}</li>
              <li>{t('embed.feature5')}</li>
              <li>{t('embed.feature6')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedCodeGenerator;

