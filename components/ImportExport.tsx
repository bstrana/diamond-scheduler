import React, { useRef } from 'react';
import { Game, Team } from '../types';
import { Upload, Download, FileJson } from 'lucide-react';
import { generateUUID } from '../utils';

interface ImportExportProps {
  teams: Team[];
  onImportGames: (games: Game[]) => void;
  allGames: Game[];
}

const ImportExport: React.FC<ImportExportProps> = ({ teams, onImportGames, allGames }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        // Simple CSV parser: Date,Time,Home,Away,Location
        const lines = text.split('\n');
        const newGames: Game[] = [];

        lines.forEach((line, idx) => {
          if (idx === 0 && line.toLowerCase().includes('date')) return; // Skip header
          if (!line.trim()) return;

          const [date, time, homeName, awayName, location] = line.split(',').map(s => s.trim());
          
          const homeTeam = teams.find(t => t.name.toLowerCase() === homeName?.toLowerCase() || t.abbreviation === homeName);
          const awayTeam = teams.find(t => t.name.toLowerCase() === awayName?.toLowerCase() || t.abbreviation === awayName);

          if (homeTeam && awayTeam && date) {
            newGames.push({
              id: generateUUID(),
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              date,
              time: time || '19:00',
              location: location || 'Main Stadium',
              status: 'scheduled'
            });
          }
        });

        if (newGames.length > 0) {
          onImportGames(newGames);
          alert(`Successfully imported ${newGames.length} games.`);
        } else {
            alert("No matching teams found. Ensure Team Names match your roster.");
        }
      } catch (err) {
        alert("Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadCSV = () => {
    const headers = "Date,Time,Home,Away,Location\n";
    const rows = allGames.map(g => {
        const h = teams.find(t => t.id === g.homeTeamId)?.name || 'Unknown';
        const a = teams.find(t => t.id === g.awayTeamId)?.name || 'Unknown';
        return `${g.date},${g.time},${h},${a},${g.location}`;
    }).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex items-center space-x-2">
        <input 
            type="file" 
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
        />
        <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-sm font-medium transition-colors"
        >
            <Upload size={16} />
            <span>Import CSV</span>
        </button>
        <button 
            onClick={downloadCSV}
            className="flex items-center space-x-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-sm font-medium transition-colors"
        >
            <Download size={16} />
            <span>Export CSV</span>
        </button>
    </div>
  );
};

export default ImportExport;