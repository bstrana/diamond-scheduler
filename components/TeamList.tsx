import React, { useState, useRef } from 'react';
import { Team } from '../types';
import { Plus, Trash2, Shield, Pencil, X } from 'lucide-react';
import { generateUUID, validateTeamName, validateAbbreviation, validateCity, validateLocation, sanitizeString } from '../utils';

interface TeamListProps {
  teams: Team[];
  onAddTeam: (team: Team) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (id: string) => void;
  maxTeams?: number;
}

const TeamList: React.FC<TeamListProps> = ({ teams, onAddTeam, onUpdateTeam, onDeleteTeam, maxTeams }) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const formRef = useRef<HTMLDivElement>(null);

  const [formTeam, setFormTeam] = useState<Partial<Team>>({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const nameValidation = validateTeamName(formTeam.name);
    if (!nameValidation.valid) {
      alert(nameValidation.error);
      return;
    }
    
    const cityValidation = validateCity(formTeam.city);
    if (!cityValidation.valid) {
      alert(cityValidation.error);
      return;
    }
    
    const abbrValidation = validateAbbreviation(formTeam.abbreviation);
    if (!abbrValidation.valid) {
      alert(abbrValidation.error);
      return;
    }

    const fieldValidation = validateLocation(formTeam.field);
    if (!fieldValidation.valid) {
      alert(fieldValidation.error);
      return;
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(formTeam.name);
    const sanitizedCity = sanitizeString(formTeam.city);
    const sanitizedAbbr = sanitizeString(formTeam.abbreviation)?.toUpperCase();
    const sanitizedLogoUrl = formTeam.logoUrl ? sanitizeString(formTeam.logoUrl, 500) : undefined;
    const sanitizedField = formTeam.field ? sanitizeString(formTeam.field, 200) : undefined;

    const roster = parseRosterText(rosterText);
    if (editingId) {
      // Update existing team
      onUpdateTeam({
        id: editingId,
        name: sanitizedName,
        city: sanitizedCity,
        abbreviation: sanitizedAbbr,
        country: formTeam.country,
        field: sanitizedField,
        roster,
        primaryColor: formTeam.primaryColor || '#000000',
        logoUrl: sanitizedLogoUrl
      });
      setEditingId(null);
    } else {
      if (maxTeams && teams.length >= maxTeams) {
        alert(`Team limit reached (${maxTeams}).`);
        return;
      }
      // Add new team
      onAddTeam({
        id: generateUUID(),
        name: sanitizedName,
        city: sanitizedCity,
        abbreviation: sanitizedAbbr,
        country: formTeam.country,
        field: sanitizedField,
        roster,
        primaryColor: formTeam.primaryColor || '#000000',
        logoUrl: sanitizedLogoUrl
      });
    }
    
    setIsFormVisible(false);
    setFormTeam({ primaryColor: '#000000', logoUrl: '', country: 'USA' });
    setRosterText('');
  };

  const handleEditClick = (team: Team) => {
    setEditingId(team.id);
    setFormTeam({ ...team, country: team.country || 'USA' });
    setRosterText(formatRosterText(team.roster));
    setIsFormVisible(true);
    // Smooth scroll to form
    setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCancel = () => {
    setIsFormVisible(false);
    setEditingId(null);
    setFormTeam({ primaryColor: '#000000', logoUrl: '', country: 'USA' });
    setRosterText('');
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">League Teams</h2>
        {!isFormVisible && (
          <button 
            onClick={() => { setIsFormVisible(true); setEditingId(null); setFormTeam({ primaryColor: '#000000', logoUrl: '', country: 'USA' }); }}
            className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
              maxTeams && teams.length >= maxTeams
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
            disabled={!!maxTeams && teams.length >= maxTeams}
          >
            <Plus size={18} className="mr-2" />
            Add Manual Team
          </button>
        )}
      </div>

      {isFormVisible && (
        <div ref={formRef} className="bg-white p-6 rounded-xl shadow-md border border-indigo-100 mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-700">{editingId ? 'Edit Team' : 'New Team'}</h3>
              <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
              </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">City</label>
              <input required placeholder="e.g. New York" className="w-full border p-2 rounded" value={formTeam.city || ''} onChange={e => setFormTeam({...formTeam, city: e.target.value})} />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
              <input required placeholder="e.g. Yankees" className="w-full border p-2 rounded" value={formTeam.name || ''} onChange={e => setFormTeam({...formTeam, name: e.target.value})} />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Country</label>
              <select
                className="w-full border p-2 rounded text-sm"
                value={formTeam.country || 'USA'}
                onChange={(e) => setFormTeam({ ...formTeam, country: e.target.value })}
              >
                {countryOptions.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Abbr</label>
              <input required maxLength={3} placeholder="NYY" className="w-full border p-2 rounded uppercase" value={formTeam.abbreviation || ''} onChange={e => setFormTeam({...formTeam, abbreviation: e.target.value.toUpperCase()})} />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Color</label>
              <input type="color" className="w-full h-10 border p-1 rounded cursor-pointer" value={formTeam.primaryColor} onChange={e => setFormTeam({...formTeam, primaryColor: e.target.value})} />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Logo URL</label>
              <input 
                type="url" 
                placeholder="https://example.com/logo.png" 
                className="w-full border p-2 rounded text-sm" 
                value={formTeam.logoUrl || ''} 
                onChange={e => setFormTeam({...formTeam, logoUrl: e.target.value})} 
              />
              {formTeam.logoUrl && (
                <div className="mt-2 p-2 border border-slate-100 rounded bg-slate-50 flex justify-center">
                  <img src={formTeam.logoUrl} alt="Logo preview" className="h-12 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Home Field</label>
              <input
                type="text"
                placeholder="e.g. Yankee Stadium"
                className="w-full border p-2 rounded text-sm"
                value={formTeam.field || ''}
                onChange={e => setFormTeam({...formTeam, field: e.target.value})}
              />
            </div>
            <div className="lg:col-span-6">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Roster (Number, Name, Position)</label>
              <textarea
                rows={4}
                className="w-full border p-2 rounded text-sm"
                placeholder="12, Alex Smith, 1B"
                value={rosterText}
                onChange={(e) => setRosterText(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">One player per line.</p>
            </div>
            <div className="flex space-x-2 lg:col-span-1">
              <button type="button" onClick={handleCancel} className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 text-sm">Cancel</button>
              <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium">
                  {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <Shield className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No teams yet</h3>
          <p className="text-slate-500">Add a team manually or create a league in the League Creator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <div key={team.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between hover:shadow-md transition-shadow group relative">
              <div className="flex items-center space-x-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center shadow-inner overflow-hidden"
                  style={{ backgroundColor: `${team.primaryColor}20` }}
                >
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt={`${team.name} logo`} className="w-full h-full object-contain" onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) parent.innerHTML = '<span class="text-2xl">⚾</span>';
                    }} />
                  ) : (
                    <span className="text-2xl">⚾</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{team.city} {team.name}</h3>
                  <div className="flex items-center space-x-2 text-sm text-slate-500">
                    <span className="font-mono bg-slate-100 px-1.5 rounded">{team.abbreviation}</span>
                    <span className="w-3 h-3 rounded-full border border-slate-300" style={{backgroundColor: team.primaryColor}}></span>
                  </div>
                  {team.field && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]" title={team.field}>{team.field}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                    onClick={() => handleEditClick(team)}
                    className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50"
                    title="Edit Team"
                >
                    <Pencil size={18} />
                </button>
                <button 
                    onClick={() => onDeleteTeam(team.id)}
                    className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50"
                    title="Delete Team"
                >
                    <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamList;