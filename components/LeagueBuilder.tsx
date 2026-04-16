import React, { useState, useEffect, useRef } from 'react';
import { Team, League } from '../types';
import { Plus, Trash2, Trophy, Save, Shield, Check, Settings2, FolderOpen, Pencil, X, MapPin, Upload, Link } from 'lucide-react';
import { generateUUID, validateLeagueName, validateCategory, validateTeamName, validateAbbreviation, validateCity, sanitizeString } from '../utils';
import { useTranslation } from 'react-i18next';

interface LeagueBuilderProps {
  leagues: League[];
  onLeagueCreated: (league: League) => void;
  onLeagueUpdated: (league: League) => void;
  onLeagueDeleted: (leagueId: string) => void;
  existingTeams: Team[];
  maxLeagues?: number;
  maxTeams?: number;
}

const LeagueBuilder: React.FC<LeagueBuilderProps> = ({
  leagues,
  onLeagueCreated,
  onLeagueUpdated,
  onLeagueDeleted,
  existingTeams,
  maxLeagues,
  maxTeams
}) => {
  const { t } = useTranslation();
  // Mode State
  const [editingLeagueId, setEditingLeagueId] = useState<string>('');

  // League Details State
  const [leagueName, setLeagueName] = useState('');
  const [shortName, setShortName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [category, setCategory] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [leagueColor, setLeagueColor] = useState('#4f46e5');
  const [wbscTracker, setWbscTracker] = useState(false);
  
  // Fields State
  const [fields, setFields] = useState<string[]>([]);
  const [newFieldName, setNewFieldName] = useState('');

  // Teams State
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  
  // New Team Form State
  const [newTeam, setNewTeam] = useState<Partial<Team>>({
    primaryColor: '#000000',
    logoUrl: '',
    country: 'USA'
  });
  const [rosterText, setRosterText] = useState('');
  const [rosterImportUrl, setRosterImportUrl] = useState('');
  const [rosterImportStatus, setRosterImportStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [rosterImportMsg, setRosterImportMsg] = useState('');
  const rosterFileRef = useRef<HTMLInputElement>(null);

  const countryOptions = [
    'USA',
    'Canada',
    'Mexico',
    // Europe
    'Albania',
    'Andorra',
    'Armenia',
    'Austria',
    'Azerbaijan',
    'Belarus',
    'Belgium',
    'Bosnia and Herzegovina',
    'Bulgaria',
    'Croatia',
    'Cyprus',
    'Czechia',
    'Denmark',
    'Estonia',
    'Finland',
    'France',
    'Georgia',
    'Germany',
    'Greece',
    'Hungary',
    'Iceland',
    'Ireland',
    'Italy',
    'Kosovo',
    'Latvia',
    'Liechtenstein',
    'Lithuania',
    'Luxembourg',
    'Malta',
    'Moldova',
    'Monaco',
    'Montenegro',
    'Netherlands',
    'North Macedonia',
    'Norway',
    'Poland',
    'Portugal',
    'Romania',
    'Russia',
    'San Marino',
    'Serbia',
    'Slovakia',
    'Slovenia',
    'Spain',
    'Sweden',
    'Switzerland',
    'Turkey',
    'Ukraine',
    'United Kingdom',
    'Vatican City',
    // Asia-Pacific
    'Australia',
    'New Zealand',
    'China',
    'India',
    'Japan',
    'Philippines',
    'South Korea',
    'Taiwan',
    // Africa & Americas
    'South Africa',
    'Argentina',
    'Brazil',
    'Chile',
    'Colombia',
    'Cuba',
    'Dominican Republic',
    'Venezuela',
  ];

  const parseRosterText = (value: string): Team['roster'] => {
    if (!value.trim()) return [];
    return value
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(',').map(part => part.trim());
        const number = Number.parseInt(parts[0] || '', 10);
        return {
          number: Number.isFinite(number) && number >= 0 && number <= 999 ? number : 0,
          name: sanitizeString(parts[1] || '', 100),
          position: sanitizeString(parts[2] || '', 50)
        };
      })
      .filter(player => player.name);
  };

  const formatRosterText = (roster?: Team['roster']) => {
    if (!roster || roster.length === 0) return '';
    return roster.map(player => `${player.number}, ${player.name}, ${player.position}`).join('\n');
  };

  // Convert parsed roster array to text lines and append/replace rosterText
  const applyImportedRoster = (players: Team['roster'], append: boolean) => {
    if (!players || players.length === 0) return 0;
    const lines = players.map(p => `${p.number}, ${p.name}, ${p.position}`).join('\n');
    setRosterText(prev => append && prev.trim() ? prev.trim() + '\n' + lines : lines);
    return players.length;
  };

  // Parse a JSON value that may be an array of player objects or {players:[]}
  const parseRosterJson = (raw: unknown): Team['roster'] => {
    const arr: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.players) ? (raw as any).players : [];
    return arr
      .map((item: any) => ({
        number: Number.isFinite(Number(item?.number ?? item?.num ?? item?.jersey)) ? Number(item.number ?? item.num ?? item.jersey) : 0,
        name: String(item?.name ?? item?.fullName ?? item?.playerName ?? '').trim().slice(0, 100),
        position: String(item?.position ?? item?.pos ?? '').trim().slice(0, 50),
      }))
      .filter(p => p.name);
  };

  // Parse CSV text (with or without header row)
  const parseRosterCsv = (text: string): Team['roster'] => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    // Detect header: first row has non-numeric first cell
    const firstCell = lines[0]?.split(',')[0]?.trim() ?? '';
    const start = Number.isNaN(Number(firstCell)) && firstCell !== '' ? 1 : 0;
    return lines.slice(start).map(line => {
      const parts = line.split(',').map(p => p.trim());
      const number = Number.parseInt(parts[0] ?? '', 10);
      return {
        number: Number.isFinite(number) && number >= 0 && number <= 999 ? number : 0,
        name: (parts[1] ?? '').slice(0, 100),
        position: (parts[2] ?? '').slice(0, 50),
      };
    }).filter(p => p.name);
  };

  const handleRosterUrlImport = async () => {
    const url = rosterImportUrl.trim();
    if (!url) return;
    setRosterImportStatus('loading');
    setRosterImportMsg('');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const players = parseRosterJson(json);
      if (players.length === 0) throw new Error(t('league.rosterImportNoPlayers'));
      const count = applyImportedRoster(players, true);
      setRosterImportStatus('ok');
      setRosterImportMsg(t('league.rosterImportSuccess', { count }));
    } catch (err: any) {
      setRosterImportStatus('error');
      setRosterImportMsg(err.message || t('league.rosterImportFailed'));
    }
  };

  const handleRosterFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        let players: Team['roster'];
        if (file.name.endsWith('.csv')) {
          players = parseRosterCsv(text);
        } else {
          players = parseRosterJson(JSON.parse(text));
        }
        if (!players || players.length === 0) throw new Error(t('league.rosterImportNoPlayers'));
        const count = applyImportedRoster(players, true);
        setRosterImportStatus('ok');
        setRosterImportMsg(t('league.rosterImportSuccess', { count }));
      } catch (err: any) {
        setRosterImportStatus('error');
        setRosterImportMsg(err.message || t('league.rosterImportFailed'));
      }
      // Reset file input so same file can be re-selected
      if (rosterFileRef.current) rosterFileRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Handle switching between Create New and Edit Existing
  const handleModeChange = (id: string) => {
    setEditingLeagueId(id);
    
    if (id === '') {
        // Create Mode - Reset
        setLeagueName('');
        setShortName('');
        setLogoUrl('');
        setCoverImageUrl('');
        setCategory('');
        setLeagueColor('#4f46e5');
        setTeams([]);
        setFields([]);
    } else {
        // Edit Mode - Load Data
        const league = leagues.find(l => l.id === id);
        if (league) {
            setLeagueName(league.name);
            setShortName(league.shortName || '');
            setLogoUrl(league.logoUrl || '');
            setCoverImageUrl(league.coverImageUrl || '');
            setCategory(league.category);
            setAnnouncement(league.announcement || '');
            setLeagueColor(league.color || '#4f46e5');
            setWbscTracker(league.wbscTracker || false);
            setTeams([...league.teams]);
            setFields([...(league.fields || [])]);
        }
    }
  };

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const nameValidation = validateTeamName(newTeam.name);
    if (!nameValidation.valid) {
      alert(nameValidation.error);
      return;
    }
    
    const cityValidation = validateCity(newTeam.city);
    if (!cityValidation.valid) {
      alert(cityValidation.error);
      return;
    }
    
    const abbrValidation = validateAbbreviation(newTeam.abbreviation);
    if (!abbrValidation.valid) {
      alert(abbrValidation.error);
      return;
    }

    if (!editingTeamId && maxTeams && teams.length >= maxTeams) {
      alert(t('league.teamLimitReached', { limit: maxTeams }));
      return;
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(newTeam.name);
    const sanitizedCity = sanitizeString(newTeam.city);
    const sanitizedAbbr = sanitizeString(newTeam.abbreviation)?.toUpperCase();
    const sanitizedLogoUrl = newTeam.logoUrl ? sanitizeString(newTeam.logoUrl, 500) : undefined;

    const team: Team = {
      id: editingTeamId || generateUUID(),
      name: sanitizedName,
      city: sanitizedCity,
      abbreviation: sanitizedAbbr,
      country: newTeam.country,
      roster: parseRosterText(rosterText),
      primaryColor: newTeam.primaryColor || '#000000',
      secondaryColor: newTeam.secondaryColor,
      logoUrl: sanitizedLogoUrl
    };
    if (editingTeamId) {
      setTeams(teams.map((existing) => (existing.id === editingTeamId ? team : existing)));
    } else {
      setTeams([...teams, team]);
    }
    setNewTeam({ 
      name: '', 
      city: '', 
      abbreviation: '', 
      primaryColor: '#000000', 
      logoUrl: '',
      country: 'USA'
    });
    setRosterText('');
    setEditingTeamId(null);
  };

  const addExistingTeam = (team: Team) => {
    // Avoid duplicates
    if (!teams.some(t => t.id === team.id)) {
        if (maxTeams && teams.length >= maxTeams) {
          alert(t('league.teamLimitReached', { limit: maxTeams }));
          return;
        }
        setTeams([...teams, team]);
    }
  };

  const removeTeam = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
    if (editingTeamId === id) {
      setEditingTeamId(null);
      setNewTeam({ name: '', city: '', abbreviation: '', primaryColor: '#000000', logoUrl: '' });
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setNewTeam({
      name: team.name,
      city: team.city,
      abbreviation: team.abbreviation,
      country: team.country || 'USA',
      primaryColor: team.primaryColor,
      logoUrl: team.logoUrl || ''
    });
    setRosterText(formatRosterText(team.roster));
  };

  const cancelEditTeam = () => {
    setEditingTeamId(null);
    setNewTeam({ name: '', city: '', abbreviation: '', primaryColor: '#000000', logoUrl: '', country: 'USA' });
    setRosterText('');
  };

  const handleSaveLeague = () => {
    // Validate league name
    const nameValidation = validateLeagueName(leagueName);
    if (!nameValidation.valid) {
      alert(nameValidation.error);
      return;
    }
    
    // Validate category
    const categoryValidation = validateCategory(category);
    if (!categoryValidation.valid) {
      alert(categoryValidation.error);
      return;
    }
    
    if (teams.length < 2) {
      alert(t('league.needTwoTeamsAlert'));
      return;
    }
    if (!editingLeagueId && maxLeagues && leagues.length >= maxLeagues) {
      alert(t('league.leagueLimitReached', { limit: maxLeagues }));
      return;
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(leagueName);
    const sanitizedShortName = shortName ? sanitizeString(shortName, 20) : undefined;
    const sanitizedCategory = category ? sanitizeString(category) : 'General';
    const sanitizedLogoUrl = logoUrl ? sanitizeString(logoUrl, 500) : undefined;
    const sanitizedCoverImageUrl = coverImageUrl ? sanitizeString(coverImageUrl, 500) : undefined;
    const sanitizedAnnouncement = announcement ? sanitizeString(announcement, 500) : undefined;

    if (editingLeagueId) {
        // Update
        const updatedLeague: League = {
            id: editingLeagueId,
            name: sanitizedName,
            shortName: sanitizedShortName,
            logoUrl: sanitizedLogoUrl,
            coverImageUrl: sanitizedCoverImageUrl,
            category: sanitizedCategory,
            color: leagueColor || undefined,
            teams: teams,
            fields: fields,
            announcement: sanitizedAnnouncement,
            wbscTracker: wbscTracker || undefined,
        };
        onLeagueUpdated(updatedLeague);
    } else {
        // Create
        const newLeague: League = {
            id: generateUUID(),
            name: sanitizedName,
            shortName: sanitizedShortName,
            logoUrl: sanitizedLogoUrl,
            coverImageUrl: sanitizedCoverImageUrl,
            category: sanitizedCategory,
            color: leagueColor || undefined,
            teams: teams,
            fields: fields,
            announcement: sanitizedAnnouncement,
            wbscTracker: wbscTracker || undefined,
        };
        onLeagueCreated(newLeague);
        // Reset form after create
        setLeagueName('');
        setShortName('');
        setLogoUrl('');
        setCoverImageUrl('');
        setCategory('');
        setAnnouncement('');
        setLeagueColor('#4f46e5');
        setWbscTracker(false);
        setTeams([]);
        setFields([]);
    }
  };

  const handleDeleteLeague = () => {
    if (!editingLeagueId) return;
    const league = leagues.find(l => l.id === editingLeagueId);
    const leagueLabel = league ? `${league.name}${league.category ? ` - ${league.category}` : ''}` : 'this league';
    if (window.confirm(t('league.deleteLeagueConfirm', { label: leagueLabel }))) {
      onLeagueDeleted(editingLeagueId);
      handleModeChange('');
    }
  };

  // Filter existing teams to show only those not yet added
  const availableTeams = existingTeams.filter(et => !teams.some(t => t.id === et.id));

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
                <div className="flex items-center space-x-4 mb-2">
                    {editingLeagueId ? <Settings2 className="w-8 h-8" /> : <Trophy className="w-8 h-8" />}
                    <h2 className="text-3xl font-bold">{editingLeagueId ? `${t('common.edit')} League` : t('league.leagueCreatorTitle')}</h2>
                </div>
                <p className="opacity-90 max-w-xl">
                    {editingLeagueId
                        ? t('league.editSubtitle')
                        : t('league.createSubtitle')}
                </p>
            </div>

            {/* League Selector */}
            <div className="bg-white/10 p-1.5 rounded-xl backdrop-blur-sm border border-white/20 min-w-[250px]">
                <label className="block text-xs font-semibold text-blue-100 uppercase tracking-wider mb-1 px-2">{t('league.selectAction')}</label>
                <div className="relative">
                    <select 
                        value={editingLeagueId} 
                        onChange={(e) => handleModeChange(e.target.value)}
                        className="w-full bg-white text-slate-800 rounded-lg p-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-white font-medium cursor-pointer"
                    >
                        <option value="">{t('league.createNew')}</option>
                        {leagues.length > 0 && <option disabled>──────────</option>}
                        {leagues.map(l => (
                            <option key={l.id} value={l.id}>{t('league.editLeagueName', { name: l.name })}</option>
                        ))}
                    </select>
                    <FolderOpen size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: League Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <Shield size={20} className="mr-2 text-indigo-600" />
              {t('league.leagueDetails')}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('league.leagueName')}</label>
                <input
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder={t('league.leagueNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('league.shortName')} <span className="text-slate-400 font-normal">{t('league.shortNameOptional')}</span></label>
                <input
                  type="text"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  maxLength={20}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder={t('league.shortNamePlaceholder')}
                />
                <p className="text-xs text-slate-500 mt-1">{t('league.shortNameHelp')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('league.category')}</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder={t('league.categoryPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('league.logoUrl')}</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder={t('league.logoUrlPlaceholder')}
                />
                <p className="text-xs text-slate-500 mt-1">{t('league.logoUrlHelp')}</p>
                {logoUrl && (
                  <div className="mt-2 p-2 border border-slate-100 rounded bg-slate-50 flex justify-center">
                    <img src={logoUrl} alt="Preview" className="h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('league.coverImageUrl')}</label>
                <input
                  type="url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder={t('league.coverImagePlaceholder')}
                />
                <p className="text-xs text-slate-500 mt-1">{t('league.coverImageHelp')}</p>
                {coverImageUrl && (
                  <div className="mt-2 p-2 border border-slate-100 rounded bg-slate-50 flex justify-center">
                    <img src={coverImageUrl} alt="Cover Preview" className="h-24 w-full object-cover rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>
            </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('league.leagueColor')}</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={leagueColor}
                    onChange={(e) => setLeagueColor(e.target.value)}
                    className="h-9 w-14 rounded border border-slate-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={leagueColor}
                    onChange={(e) => setLeagueColor(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
                    placeholder="#4f46e5"
                    maxLength={7}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('league.leagueColorHelp')}</p>
              </div>
            {/* Announcement */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('league.announcement')}</label>
              <textarea
                rows={2}
                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm resize-none"
                placeholder={t('league.announcementPlaceholder')}
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-slate-500 mt-1">{t('league.announcementHelp')}</p>
            </div>

            {/* WBSC Game Tracker */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <input
                id="wbsc-tracker"
                type="checkbox"
                checked={wbscTracker}
                onChange={e => setWbscTracker(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <label htmlFor="wbsc-tracker" className="text-sm font-medium text-slate-700 cursor-pointer">
                  WBSC Game Tracker
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  When enabled, a WBSC game ID field appears on each game in this league for linking to external score and play-by-play data.
                </p>
              </div>
            </div>

            {/* Playing Fields */}
            <div className="pt-4 mt-4 border-t border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center">
                <MapPin size={14} className="mr-1.5 text-indigo-500" />
                {t('league.playingFields')}
              </label>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                    <span className="text-sm text-slate-700 truncate">{field}</span>
                    <button type="button" onClick={() => setFields(fields.filter((_, i) => i !== idx))} className="ml-2 shrink-0 text-slate-300 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('league.fieldPlaceholder')}
                    className="flex-1 border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={newFieldName}
                    onChange={e => setNewFieldName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newFieldName.trim();
                        if (trimmed && !fields.includes(trimmed)) { setFields([...fields, trimmed]); setNewFieldName(''); }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newFieldName.trim();
                      if (trimmed && !fields.includes(trimmed)) { setFields([...fields, trimmed]); setNewFieldName(''); }
                    }}
                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm font-medium"
                  >
                    {t('league.addField')}
                  </button>
                </div>
              </div>
            </div>

            {editingLeagueId && (
              <div className="pt-4 mt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleDeleteLeague}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <Trash2 size={16} />
                  <span>{t('league.deleteLeague')}</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleSaveLeague}
            disabled={teams.length < 2 || !leagueName}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all shadow-lg flex justify-center items-center
              ${teams.length < 2 || !leagueName
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700 hover:shadow-green-500/30'
              }`}
          >
            <Save className="mr-2" size={20} />
            {editingLeagueId ? t('league.updateLeague') : t('league.saveLeague')}
          </button>
        </div>

        {/* Right Column: Team Management */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Manual Creation */}
              <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                    <Plus size={20} className="mr-2 text-indigo-600" />
                    {editingTeamId ? t('league.editTeam') : t('league.createNewTeam')}
                </h3>
                <form onSubmit={handleAddTeam} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('league.teamCity')}</label>
                        <input required placeholder="City" className="w-full border p-2 rounded text-sm" value={newTeam.city || ''} onChange={e => setNewTeam({...newTeam, city: e.target.value})} />
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('league.teamName')}</label>
                        <input required placeholder="Name" className="w-full border p-2 rounded text-sm" value={newTeam.name || ''} onChange={e => setNewTeam({...newTeam, name: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('league.teamCountry')}</label>
                        <select
                            className="w-full border p-2 rounded text-sm"
                            value={newTeam.country || 'USA'}
                            onChange={e => setNewTeam({...newTeam, country: e.target.value})}
                        >
                            {countryOptions.map((country) => (
                                <option key={country} value={country}>
                                    {country}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('league.teamAbbr')}</label>
                        <input required maxLength={3} placeholder={t('league.teamAbbrPlaceholder')} className="w-full border p-2 rounded uppercase text-sm" value={newTeam.abbreviation || ''} onChange={e => setNewTeam({...newTeam, abbreviation: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('league.primaryColor')}</label>
                        <input type="color" className="w-full h-9 border p-0.5 rounded cursor-pointer" value={newTeam.primaryColor} onChange={e => setNewTeam({...newTeam, primaryColor: e.target.value})} />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('league.secondaryColor')}</label>
                        <input type="color" className="w-full h-9 border p-0.5 rounded cursor-pointer" value={newTeam.secondaryColor || '#ffffff'} onChange={e => setNewTeam({...newTeam, secondaryColor: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('league.logoUrlShort')}</label>
                        <input
                            type="url"
                            placeholder={t('league.logoUrlPlaceholder')}
                            className="w-full border p-2 rounded text-sm"
                            value={newTeam.logoUrl || ''}
                            onChange={e => setNewTeam({...newTeam, logoUrl: e.target.value})}
                        />
                        <p className="text-xs text-slate-500 mt-1">{t('league.logoUrlHelpShort')}</p>
                        {newTeam.logoUrl && (
                            <div className="mt-1 p-1 border border-slate-100 rounded bg-slate-50 flex justify-center">
                                <img src={newTeam.logoUrl} alt="Logo preview" className="h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                            </div>
                        )}
                    </div>
                    <div className="md:col-span-12">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('league.roster')}</label>
                        <textarea
                          rows={4}
                          className="w-full border p-2 rounded text-sm"
                          placeholder={t('league.rosterPlaceholder')}
                          value={rosterText}
                          onChange={e => setRosterText(e.target.value)}
                        />
                        <p className="text-xs text-slate-500 mt-1">{t('league.rosterHelp')}</p>

                        {/* Roster Import */}
                        <div className="mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase">{t('league.rosterImportTitle')}</p>

                          {/* URL import */}
                          <div className="flex gap-2">
                            <div className="flex items-center text-slate-400 shrink-0"><Link size={14} /></div>
                            <input
                              type="url"
                              className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm bg-white"
                              placeholder={t('league.rosterImportUrlPlaceholder')}
                              value={rosterImportUrl}
                              onChange={e => { setRosterImportUrl(e.target.value); setRosterImportStatus('idle'); }}
                            />
                            <button
                              type="button"
                              disabled={!rosterImportUrl.trim() || rosterImportStatus === 'loading'}
                              onClick={handleRosterUrlImport}
                              className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50 shrink-0"
                            >
                              {rosterImportStatus === 'loading' ? t('common.loading') : t('league.rosterImportFetch')}
                            </button>
                          </div>

                          {/* File import */}
                          <div className="flex gap-2 items-center">
                            <div className="flex items-center text-slate-400 shrink-0"><Upload size={14} /></div>
                            <label className="flex-1 cursor-pointer flex items-center gap-2 border border-dashed border-slate-300 rounded px-2 py-1.5 bg-white hover:border-indigo-400 transition-colors">
                              <span className="text-xs text-slate-500">{t('league.rosterImportFileLabel')}</span>
                              <input
                                ref={rosterFileRef}
                                type="file"
                                accept=".json,.csv"
                                className="hidden"
                                onChange={handleRosterFileImport}
                              />
                            </label>
                          </div>

                          {/* Status message */}
                          {rosterImportStatus !== 'idle' && (
                            <p className={`text-xs font-medium ${rosterImportStatus === 'ok' ? 'text-emerald-600' : rosterImportStatus === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
                              {rosterImportMsg}
                            </p>
                          )}
                          <p className="text-xs text-slate-400">{t('league.rosterImportHint')}</p>
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <button type="submit" className="w-full h-9 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium">
                          {editingTeamId ? t('common.update') : t('common.add')}
                        </button>
                        {editingTeamId && (
                          <button
                            type="button"
                            onClick={cancelEditTeam}
                            className="w-full h-9 border border-slate-200 text-slate-600 rounded hover:bg-slate-50 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        )}
                    </div>
                </form>
              </div>

              {/* Select Existing */}
              {availableTeams.length > 0 && (
                <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3 flex items-center">
                        <Shield size={16} className="mr-2" />
                        Add from Existing Roster
                    </h3>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {availableTeams.map(team => (
                            <button
                                key={team.id}
                                onClick={() => addExistingTeam(team)}
                                className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-indigo-300 hover:shadow-sm transition-all"
                            >
                                {team.logoUrl ? (
                                    <img src={team.logoUrl} alt={`${team.name} logo`} className="w-5 h-5 object-contain" onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const parent = e.currentTarget.parentElement;
                                        if (parent) {
                                            const span = document.createElement('span');
                                            span.className = 'text-sm';
                                            span.textContent = '⚾';
                                            parent.insertBefore(span, e.currentTarget.nextSibling);
                                        }
                                    }} />
                                ) : (
                                    <span className="text-sm">⚾</span>
                                )}
                                <span className="text-xs font-medium text-slate-700">{team.city} {team.name}</span>
                                <Plus size={14} className="text-indigo-500" />
                            </button>
                        ))}
                    </div>
                </div>
              )}
          </div>

          {/* Team List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-700">Roster ({teams.length})</h3>
              {teams.length < 2 && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">Need 2+ teams</span>}
            </div>
            
            {teams.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Shield size={48} className="mx-auto mb-2 opacity-20" />
                <p>No teams added yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {teams.map(team => (
                  <div key={team.id} className="p-4 flex items-center justify-between hover:bg-slate-50 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm overflow-hidden" style={{ backgroundColor: `${team.primaryColor}20` }}>
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt={`${team.name} logo`} className="w-full h-full object-contain" onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) parent.innerHTML = '<span class="text-lg">⚾</span>';
                          }} />
                        ) : (
                          <span className="text-lg">⚾</span>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{team.city} {team.name}</div>
                        <div className="text-xs text-slate-500 flex items-center">
                            <span className="font-mono">{team.abbreviation}</span>
                            <span className="mx-1.5 w-2 h-2 rounded-full" style={{backgroundColor: team.primaryColor}}></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleEditTeam(team)}
                        className="text-slate-400 hover:text-indigo-600 p-2"
                        title="Edit Team"
                      >
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => removeTeam(team.id)} className="text-slate-300 hover:text-red-500 p-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default LeagueBuilder;