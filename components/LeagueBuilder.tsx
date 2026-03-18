import React, { useState, useEffect } from 'react';
import { Team, League } from '../types';
import { Plus, Trash2, Trophy, Save, Shield, Check, Settings2, FolderOpen, Pencil, X, MapPin } from 'lucide-react';
import { generateUUID, validateLeagueName, validateCategory, validateTeamName, validateAbbreviation, validateCity, sanitizeString } from '../utils';

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
  // Mode State
  const [editingLeagueId, setEditingLeagueId] = useState<string>('');

  // League Details State
  const [leagueName, setLeagueName] = useState('');
  const [shortName, setShortName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [category, setCategory] = useState('');
  const [announcement, setAnnouncement] = useState('');
  
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
      alert(`Team limit reached (${maxTeams}).`);
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
          alert(`Team limit reached (${maxTeams}).`);
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
      alert("Please add at least 2 teams to the league.");
      return;
    }
    if (!editingLeagueId && maxLeagues && leagues.length >= maxLeagues) {
      alert(`League limit reached (${maxLeagues}).`);
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
            teams: teams,
            fields: fields,
            announcement: sanitizedAnnouncement,
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
            teams: teams,
            fields: fields,
            announcement: sanitizedAnnouncement,
        };
        onLeagueCreated(newLeague);
        // Reset form after create
        setLeagueName('');
        setShortName('');
        setLogoUrl('');
        setCoverImageUrl('');
        setCategory('');
        setAnnouncement('');
        setTeams([]);
        setFields([]);
    }
  };

  const handleDeleteLeague = () => {
    if (!editingLeagueId) return;
    const league = leagues.find(l => l.id === editingLeagueId);
    const leagueLabel = league ? `${league.name}${league.category ? ` - ${league.category}` : ''}` : 'this league';
    if (window.confirm(`Delete ${leagueLabel}? This cannot be undone.`)) {
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
                    <h2 className="text-3xl font-bold">{editingLeagueId ? 'Edit League' : 'League Creator'}</h2>
                </div>
                <p className="opacity-90 max-w-xl">
                    {editingLeagueId 
                        ? 'Update branding, settings, and modify the team roster for this league.' 
                        : 'Set up your league details, configure branding, and manage your roster of teams manually.'}
                </p>
            </div>

            {/* League Selector */}
            <div className="bg-white/10 p-1.5 rounded-xl backdrop-blur-sm border border-white/20 min-w-[250px]">
                <label className="block text-xs font-semibold text-blue-100 uppercase tracking-wider mb-1 px-2">Select Action</label>
                <div className="relative">
                    <select 
                        value={editingLeagueId} 
                        onChange={(e) => handleModeChange(e.target.value)}
                        className="w-full bg-white text-slate-800 rounded-lg p-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-white font-medium cursor-pointer"
                    >
                        <option value="">+ Create New League</option>
                        {leagues.length > 0 && <option disabled>──────────</option>}
                        {leagues.map(l => (
                            <option key={l.id} value={l.id}>Edit: {l.name}</option>
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
              League Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">League Name</label>
                <input
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Major League Baseball"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Short Name <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  maxLength={20}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. MLB"
                />
                <p className="text-xs text-slate-500 mt-1">Used in embed views where space is limited.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input 
                  type="text" 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Majors, AAA, High School"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="https://..."
                />
                <p className="text-xs text-slate-500 mt-1">Square image recommended · 128 × 128 px minimum</p>
                {logoUrl && (
                  <div className="mt-2 p-2 border border-slate-100 rounded bg-slate-50 flex justify-center">
                    <img src={logoUrl} alt="Preview" className="h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cover Image URL</label>
                <input 
                  type="url" 
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="https://..."
                />
                <p className="text-xs text-slate-500 mt-1">Used as background for game cards · Wide image recommended · 1280 × 720 px or larger</p>
                {coverImageUrl && (
                  <div className="mt-2 p-2 border border-slate-100 rounded bg-slate-50 flex justify-center">
                    <img src={coverImageUrl} alt="Cover Preview" className="h-24 w-full object-cover rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>
            </div>
            {/* Announcement */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Announcement (optional)</label>
              <textarea
                rows={2}
                className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm resize-none"
                placeholder="e.g. Playoffs start June 20 — check the schedule for bracket updates."
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-slate-500 mt-1">Shown as a banner in all embedded views for this league. Max 500 characters.</p>
            </div>

            {/* Playing Fields */}
            <div className="pt-4 mt-4 border-t border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center">
                <MapPin size={14} className="mr-1.5 text-indigo-500" />
                Playing Fields
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
                    placeholder="e.g. Yankee Stadium"
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
                    Add
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
                  <span>Delete League</span>
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
            {editingLeagueId ? 'Update League' : 'Save League'}
          </button>
        </div>

        {/* Right Column: Team Management */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Manual Creation */}
              <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                    <Plus size={20} className="mr-2 text-indigo-600" />
                    {editingTeamId ? 'Edit Team' : 'Create New Team'}
                </h3>
                <form onSubmit={handleAddTeam} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">City</label>
                        <input required placeholder="City" className="w-full border p-2 rounded text-sm" value={newTeam.city || ''} onChange={e => setNewTeam({...newTeam, city: e.target.value})} />
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                        <input required placeholder="Name" className="w-full border p-2 rounded text-sm" value={newTeam.name || ''} onChange={e => setNewTeam({...newTeam, name: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Country</label>
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
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Abbr</label>
                        <input required maxLength={3} placeholder="ABC" className="w-full border p-2 rounded uppercase text-sm" value={newTeam.abbreviation || ''} onChange={e => setNewTeam({...newTeam, abbreviation: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Primary Color</label>
                        <input type="color" className="w-full h-9 border p-0.5 rounded cursor-pointer" value={newTeam.primaryColor} onChange={e => setNewTeam({...newTeam, primaryColor: e.target.value})} />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Secondary Color</label>
                        <input type="color" className="w-full h-9 border p-0.5 rounded cursor-pointer" value={newTeam.secondaryColor || '#ffffff'} onChange={e => setNewTeam({...newTeam, secondaryColor: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Logo URL</label>
                        <input
                            type="url"
                            placeholder="https://..."
                            className="w-full border p-2 rounded text-sm"
                            value={newTeam.logoUrl || ''}
                            onChange={e => setNewTeam({...newTeam, logoUrl: e.target.value})}
                        />
                        <p className="text-xs text-slate-500 mt-1">Square · 128 × 128 px min</p>
                        {newTeam.logoUrl && (
                            <div className="mt-1 p-1 border border-slate-100 rounded bg-slate-50 flex justify-center">
                                <img src={newTeam.logoUrl} alt="Logo preview" className="h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                            </div>
                        )}
                    </div>
                    <div className="md:col-span-12">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Roster (Number, Name, Position)</label>
                        <textarea
                          rows={4}
                          className="w-full border p-2 rounded text-sm"
                          placeholder="12, Alex Smith, 1B"
                          value={rosterText}
                          onChange={e => setRosterText(e.target.value)}
                        />
                        <p className="text-xs text-slate-500 mt-1">One player per line.</p>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <button type="submit" className="w-full h-9 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium">
                          {editingTeamId ? 'Update' : 'Add'}
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