import React, { useState, useMemo } from 'react';
import { Palette, Type, Square, Layers } from 'lucide-react';

interface EmbedStylerProps {
  onStyleChange: (styles: EmbedStyles) => void;
  initialStyles?: EmbedStyles;
}

export interface EmbedStyles {
  // Colors
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  
  // Typography
  fontFamily: string;
  fontSize: string;
  
  // Borders & Spacing
  borderRadius: string;
  borderWidth: string;
  padding: string;
  
  // Card Styles
  cardBackgroundColor: string;
  cardBorderColor: string;
  cardBorderRadius: string;
  cardShadow: string;
}

const defaultStyles: EmbedStyles = {
  primaryColor: '#4f46e5',
  secondaryColor: '#7c3aed',
  backgroundColor: '#f8fafc',
  textColor: '#1e293b',
  borderColor: '#e2e8f0',
  fontFamily: 'Inter, sans-serif',
  fontSize: '14px',
  borderRadius: '8px',
  borderWidth: '1px',
  padding: '16px',
  cardBackgroundColor: '#ffffff',
  cardBorderColor: '#e2e8f0',
  cardBorderRadius: '8px',
  cardShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
};

const EmbedStyler: React.FC<EmbedStylerProps> = ({ onStyleChange, initialStyles = defaultStyles }) => {
  const [styles, setStyles] = useState<EmbedStyles>(initialStyles);
  const [activeTab, setActiveTab] = useState<'colors' | 'typography' | 'borders' | 'cards'>('colors');

  const handleStyleChange = (key: keyof EmbedStyles, value: string) => {
    const newStyles = { ...styles, [key]: value };
    setStyles(newStyles);
    onStyleChange(newStyles);
  };

  const resetStyles = () => {
    setStyles(defaultStyles);
    onStyleChange(defaultStyles);
  };

  // Generate CSS string from styles
  const cssString = useMemo(() => {
    return `
:root {
  --embed-primary: ${styles.primaryColor};
  --embed-secondary: ${styles.secondaryColor};
  --embed-bg: ${styles.backgroundColor};
  --embed-text: ${styles.textColor};
  --embed-border: ${styles.borderColor};
  --embed-font: ${styles.fontFamily};
  --embed-font-size: ${styles.fontSize};
  --embed-radius: ${styles.borderRadius};
  --embed-border-width: ${styles.borderWidth};
  --embed-padding: ${styles.padding};
  --embed-card-bg: ${styles.cardBackgroundColor};
  --embed-card-border: ${styles.cardBorderColor};
  --embed-card-radius: ${styles.cardBorderRadius};
  --embed-card-shadow: ${styles.cardShadow};
}
    `.trim();
  }, [styles]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Customize Embed Styles</h3>
        <button
          onClick={resetStyles}
          className="text-sm text-slate-600 hover:text-slate-800 underline"
        >
          Reset to Default
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('colors')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'colors'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Palette size={16} className="inline mr-2" />
          Colors
        </button>
        <button
          onClick={() => setActiveTab('typography')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'typography'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Type size={16} className="inline mr-2" />
          Typography
        </button>
        <button
          onClick={() => setActiveTab('borders')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'borders'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Square size={16} className="inline mr-2" />
          Borders & Spacing
        </button>
        <button
          onClick={() => setActiveTab('cards')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'cards'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Layers size={16} className="inline mr-2" />
          Cards
        </button>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeTab === 'colors' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styles.primaryColor}
                  onChange={(e) => handleStyleChange('primaryColor', e.target.value)}
                  className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={styles.primaryColor}
                  onChange={(e) => handleStyleChange('primaryColor', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  placeholder="#4f46e5"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styles.secondaryColor}
                  onChange={(e) => handleStyleChange('secondaryColor', e.target.value)}
                  className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={styles.secondaryColor}
                  onChange={(e) => handleStyleChange('secondaryColor', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  placeholder="#7c3aed"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Background Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styles.backgroundColor}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={styles.backgroundColor}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  placeholder="#f8fafc"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Text Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styles.textColor}
                  onChange={(e) => handleStyleChange('textColor', e.target.value)}
                  className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={styles.textColor}
                  onChange={(e) => handleStyleChange('textColor', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  placeholder="#1e293b"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Border Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styles.borderColor}
                  onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                  className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={styles.borderColor}
                  onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  placeholder="#e2e8f0"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'typography' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Font Family</label>
              <select
                value={styles.fontFamily}
                onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              >
                <option value="Inter, sans-serif">Inter</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="Open Sans, sans-serif">Open Sans</option>
                <option value="Lato, sans-serif">Lato</option>
                <option value="Montserrat, sans-serif">Montserrat</option>
                <option value="Poppins, sans-serif">Poppins</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Times New Roman, serif">Times New Roman</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Font Size</label>
              <input
                type="text"
                value={styles.fontSize}
                onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                placeholder="14px"
              />
            </div>
          </>
        )}

        {activeTab === 'borders' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Border Radius</label>
              <input
                type="text"
                value={styles.borderRadius}
                onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                placeholder="8px"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Border Width</label>
              <input
                type="text"
                value={styles.borderWidth}
                onChange={(e) => handleStyleChange('borderWidth', e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                placeholder="1px"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Padding</label>
              <input
                type="text"
                value={styles.padding}
                onChange={(e) => handleStyleChange('padding', e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                placeholder="16px"
              />
            </div>
          </>
        )}

        {activeTab === 'cards' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Card Background</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styles.cardBackgroundColor}
                  onChange={(e) => handleStyleChange('cardBackgroundColor', e.target.value)}
                  className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={styles.cardBackgroundColor}
                  onChange={(e) => handleStyleChange('cardBackgroundColor', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  placeholder="#ffffff"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Card Border Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styles.cardBorderColor}
                  onChange={(e) => handleStyleChange('cardBorderColor', e.target.value)}
                  className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={styles.cardBorderColor}
                  onChange={(e) => handleStyleChange('cardBorderColor', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  placeholder="#e2e8f0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Card Border Radius</label>
              <input
                type="text"
                value={styles.cardBorderRadius}
                onChange={(e) => handleStyleChange('cardBorderRadius', e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                placeholder="8px"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Card Shadow</label>
              <input
                type="text"
                value={styles.cardShadow}
                onChange={(e) => handleStyleChange('cardShadow', e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                placeholder="0 1px 3px 0 rgba(0, 0, 0, 0.1)"
              />
            </div>
          </>
        )}
      </div>

      {/* CSS Output */}
      <div className="pt-4 border-t border-slate-200">
        <label className="block text-sm font-medium text-slate-700 mb-2">Custom CSS (add to your website)</label>
        <textarea
          readOnly
          value={cssString}
          className="w-full h-32 p-3 border border-slate-300 rounded-md bg-slate-50 font-mono text-xs"
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <p className="text-xs text-slate-500 mt-2">
          Add this CSS to your website's stylesheet or in a &lt;style&gt; tag to apply these styles to the embed.
        </p>
      </div>
    </div>
  );
};

export default EmbedStyler;

