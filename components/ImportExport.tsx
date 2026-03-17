import React, { useRef } from 'react';
import { Game, Team } from '../types';
import { Upload, Download, Calendar } from 'lucide-react';
import { generateUUID } from '../utils';

interface ImportExportProps {
  teams: Team[];
  onImportGames: (games: Game[]) => void;
  allGames: Game[];
  variant?: 'buttons' | 'menu';
  onAfterAction?: () => void;
}

const ImportExport: React.FC<ImportExportProps> = ({
  teams,
  onImportGames,
  allGames,
  variant = 'buttons',
  onAfterAction
}) => {
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
              time: time || '15:00',
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
        onAfterAction?.();
      } catch (err) {
        alert("Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const csvEscape = (value: string): string => {
    // If value contains comma, double-quote, newline, or starts with a formula character, quote it
    const needsQuoting = /[,"\n\r]/.test(value) || /^[=+\-@\t]/.test(value);
    if (needsQuoting) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const downloadCSV = () => {
    const headers = "Date,Time,Home,Away,Location\n";
    const rows = allGames.map(g => {
        const h = teams.find(t => t.id === g.homeTeamId)?.name || 'Unknown';
        const a = teams.find(t => t.id === g.awayTeamId)?.name || 'Unknown';
        return [g.date, g.time, h, a, g.location || ''].map(csvEscape).join(',');
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onAfterAction?.();
  };

  const formatICSDate = (date: string, time: string) => {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = (time || '15:00').split(':').map(Number);
    const dt = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  };

  const escapeICSText = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  const downloadICS = () => {
    const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const events = allGames.map((g) => {
      const home = teams.find(t => t.id === g.homeTeamId)?.name || 'Unknown';
      const away = teams.find(t => t.id === g.awayTeamId)?.name || 'Unknown';
      const start = formatICSDate(g.date, g.time || '15:00');
      const endDate = new Date(`${g.date}T${g.time || '15:00'}:00`);
      endDate.setHours(endDate.getHours() + 2);
      const pad = (value: number) => String(value).padStart(2, '0');
      const end = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
      const summary = `${away} @ ${home}`;
      return [
        'BEGIN:VEVENT',
        `UID:${g.id}@diamond-manager`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeICSText(summary)}`,
        `LOCATION:${escapeICSText(g.location || '')}`,
        'END:VEVENT'
      ].join('\r\n');
    });

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Diamond Manager//Scheduler//EN',
      'CALSCALE:GREGORIAN',
      ...events,
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onAfterAction?.();
  };

  const menuButtonClass =
    'w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100';

  if (variant === 'menu') {
    return (
      <div className="space-y-1">
        <input 
          type="file" 
          ref={fileInputRef}
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button 
          onClick={() => {
            fileInputRef.current?.click();
            onAfterAction?.();
          }}
          className={menuButtonClass}
        >
          <span>Import CSV</span>
          <Upload size={16} />
        </button>
        <button 
          onClick={downloadCSV}
          className={menuButtonClass}
        >
          <span>Export CSV</span>
          <Download size={16} />
        </button>
        <button 
          onClick={downloadICS}
          className={menuButtonClass}
        >
          <span>Export ICS</span>
          <Calendar size={16} />
        </button>
      </div>
    );
  }

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
      <button 
        onClick={downloadICS}
        className="flex items-center space-x-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-sm font-medium transition-colors"
      >
        <Calendar size={16} />
        <span>Export ICS</span>
      </button>
    </div>
  );
};

export default ImportExport;