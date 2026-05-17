/**
 * ThemeEditorPanel — Live CSS custom property editor for Quill's UI.
 *
 * Lets you edit every CSS variable that themes the app itself —
 * panels, borders, accent colors, canvas backgrounds — and see
 * changes instantly across the entire UI.
 *
 * Features:
 * - All CSS vars listed with color pickers where appropriate
 * - Dark / Light mode toggle
 * - Reset to defaults per-variable or all at once
 * - Save as named theme
 * - Copy as CSS :root { ... } block
 * - Export/import JSON theme files
 * - Live preview strip showing all colors
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, RotateCcw, Copy, Download, Upload, Sun, Moon, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CssVar {
  name: string;
  label: string;
  defaultDark: string;
  defaultLight: string;
  type: 'color' | 'other';
  group: string;
}

interface SavedTheme {
  name: string;
  vars: Record<string, string>;
  mode: 'dark' | 'light';
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── CSS Variable definitions ─────────────────────────────────────────────────

const CSS_VARS: CssVar[] = [
  // Surfaces
  { name: '--bg',         label: 'App Background',    defaultDark: '#111111', defaultLight: '#f0f0f0', type: 'color', group: 'Surfaces' },
  { name: '--panel',      label: 'Panel',             defaultDark: '#1c1c1c', defaultLight: '#ffffff', type: 'color', group: 'Surfaces' },
  { name: '--panel-alt',  label: 'Panel Alt',         defaultDark: '#222222', defaultLight: '#f7f7f7', type: 'color', group: 'Surfaces' },
  { name: '--border',     label: 'Border',            defaultDark: '#333333', defaultLight: '#e0e0e0', type: 'color', group: 'Surfaces' },
  { name: '--input-bg',   label: 'Input Background',  defaultDark: '#161616', defaultLight: '#f5f5f5', type: 'color', group: 'Surfaces' },
  // Text
  { name: '--text',       label: 'Primary Text',      defaultDark: '#f0f0f0', defaultLight: '#1a1a1a', type: 'color', group: 'Typography' },
  { name: '--muted',      label: 'Muted Text',        defaultDark: '#a0a0a0', defaultLight: '#666666', type: 'color', group: 'Typography' },
  { name: '--subtle',     label: 'Subtle Text',       defaultDark: '#6b6b6b', defaultLight: '#999999', type: 'color', group: 'Typography' },
  // Accent
  { name: '--accent',     label: 'Accent',            defaultDark: '#9d8ff9', defaultLight: '#6252d4', type: 'color', group: 'Accent' },
  { name: '--accent-dim', label: 'Accent Dim',        defaultDark: '#9d8ff918', defaultLight: '#6252d414', type: 'color', group: 'Accent' },
  // Canvas
  { name: '--canvas-bg',  label: 'Canvas Background', defaultDark: '#18181f', defaultLight: '#e8e8ed', type: 'color', group: 'Canvas' },
  { name: '--canvas-dot', label: 'Canvas Dot/Grid',   defaultDark: '#4a4a60', defaultLight: '#b0b0c0', type: 'color', group: 'Canvas' },
  // Status
  { name: '--error',      label: 'Error',             defaultDark: '#f87171', defaultLight: '#dc2626', type: 'color', group: 'Status' },
  { name: '--success',    label: 'Success',           defaultDark: '#34d399', defaultLight: '#059669', type: 'color', group: 'Status' },
];

const GROUPS = Array.from(new Set(CSS_VARS.map(v => v.group)));

const DARK_DEFAULTS: Record<string, string> = Object.fromEntries(CSS_VARS.map(v => [v.name, v.defaultDark]));
const LIGHT_DEFAULTS: Record<string, string> = Object.fromEntries(CSS_VARS.map(v => [v.name, v.defaultLight]));

// Premade theme palettes
const PRESET_THEMES: SavedTheme[] = [
  {
    name: '🌌 Midnight',
    mode: 'dark',
    vars: {
      '--bg': '#050510', '--panel': '#0f0f20', '--panel-alt': '#141428',
      '--border': '#1e1e3f', '--input-bg': '#0a0a18',
      '--text': '#e8e8ff', '--muted': '#8888cc', '--subtle': '#5555aa',
      '--accent': '#7c6df9', '--accent-dim': '#7c6df918',
      '--canvas-bg': '#080816', '--canvas-dot': '#1e1e3f',
      '--error': '#f87171', '--success': '#34d399',
    },
  },
  {
    name: '🌿 Forest',
    mode: 'dark',
    vars: {
      '--bg': '#0a1208', '--panel': '#111a0f', '--panel-alt': '#162014',
      '--border': '#253320', '--input-bg': '#0c1509',
      '--text': '#e4f0e2', '--muted': '#7aa872', '--subtle': '#4d7545',
      '--accent': '#5bbf52', '--accent-dim': '#5bbf5218',
      '--canvas-bg': '#0d1a0a', '--canvas-dot': '#253320',
      '--error': '#f87171', '--success': '#34d399',
    },
  },
  {
    name: '🌅 Sunset',
    mode: 'dark',
    vars: {
      '--bg': '#150a05', '--panel': '#1f1008', '--panel-alt': '#26140a',
      '--border': '#3d2010', '--input-bg': '#180c06',
      '--text': '#fff0e8', '--muted': '#c49070', '--subtle': '#8a6050',
      '--accent': '#f97b3c', '--accent-dim': '#f97b3c18',
      '--canvas-bg': '#120a06', '--canvas-dot': '#3d2010',
      '--error': '#f87171', '--success': '#34d399',
    },
  },
  {
    name: '❄️ Arctic',
    mode: 'light',
    vars: {
      '--bg': '#e8f4f8', '--panel': '#f4fafe', '--panel-alt': '#edf7fc',
      '--border': '#b8d8e8', '--input-bg': '#edf7fc',
      '--text': '#0a1e2e', '--muted': '#446688', '--subtle': '#7098b8',
      '--accent': '#0077cc', '--accent-dim': '#0077cc14',
      '--canvas-bg': '#ddeef8', '--canvas-dot': '#b8d8e8',
      '--error': '#dc2626', '--success': '#059669',
    },
  },
  {
    name: '🌸 Rose',
    mode: 'light',
    vars: {
      '--bg': '#fff0f4', '--panel': '#fff8fa', '--panel-alt': '#fef2f5',
      '--border': '#f0c8d4', '--input-bg': '#fef5f7',
      '--text': '#2d0a14', '--muted': '#884455', '--subtle': '#bb8899',
      '--accent': '#d4467a', '--accent-dim': '#d4467a14',
      '--canvas-bg': '#fde8ee', '--canvas-dot': '#f0c8d4',
      '--error': '#dc2626', '--success': '#059669',
    },
  },
];

// ─── Read current CSS var value from DOM ──────────────────────────────────────

function readVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function resetVar(name: string) {
  document.documentElement.style.removeProperty(name);
}

// ─── ColorVarRow ──────────────────────────────────────────────────────────────

function ColorVarRow({
  cssVar,
  currentValue,
  defaultValue,
  onChange,
  onReset,
}: {
  cssVar: CssVar;
  currentValue: string;
  defaultValue: string;
  onChange: (name: string, val: string) => void;
  onReset: (name: string) => void;
}) {
  const [hex, setHex] = useState(currentValue);
  const isModified = currentValue !== defaultValue;

  useEffect(() => {
    setHex(currentValue);
  }, [currentValue]);

  const handleChange = (val: string) => {
    setHex(val);
    onChange(cssVar.name, val);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: isModified ? 'rgba(99,102,241,0.04)' : 'transparent',
    }}>
      {/* Color picker */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <input
          type="color"
          value={hex.length <= 7 && hex.startsWith('#') ? hex : '#888888'}
          onChange={e => handleChange(e.target.value)}
          style={{
            width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
            border: '1px solid var(--border)', padding: 2, background: 'none',
            opacity: hex.includes('18') || hex === 'transparent' ? 0.5 : 1,
          }}
        />
        {/* Modified dot */}
        {isModified && (
          <div style={{
            position: 'absolute', top: -3, right: -3,
            width: 7, height: 7, borderRadius: '50%', background: '#6366f1',
            border: '1.5px solid var(--panel)',
          }} />
        )}
      </div>

      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{cssVar.label}</div>
        <div style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'monospace' }}>{cssVar.name}</div>
      </div>

      {/* Hex input */}
      <input
        value={hex}
        onChange={e => handleChange(e.target.value)}
        style={{
          width: 76, padding: '3px 6px', borderRadius: 5, fontSize: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          color: 'var(--text)', outline: 'none', fontFamily: 'monospace',
        }}
      />

      {/* Reset button */}
      <button
        onClick={() => onReset(cssVar.name)}
        disabled={!isModified}
        style={{
          width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: isModified ? 'pointer' : 'default',
          color: isModified ? 'var(--accent)' : 'var(--subtle)', opacity: isModified ? 1 : 0.3,
          flexShrink: 0,
        }}
        title="Reset to default"
      >
        <RotateCcw size={11} />
      </button>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ThemeEditorPanel({ open, onClose }: Props) {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(PRESET_THEMES);
  const [newThemeName, setNewThemeName] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'themes'>('themes');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(GROUPS));
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read current values from DOM on mount / open
  useEffect(() => {
    if (!open) return;
    const current: Record<string, string> = {};
    for (const v of CSS_VARS) {
      current[v.name] = readVar(v.name) || (mode === 'dark' ? v.defaultDark : v.defaultLight);
    }
    setValues(current);
  }, [open, mode]);

  const handleChange = useCallback((name: string, val: string) => {
    setVar(name, val);
    setValues(v => ({ ...v, [name]: val }));
  }, []);

  const handleReset = useCallback((name: string) => {
    resetVar(name);
    const cssVar = CSS_VARS.find(v => v.name === name)!;
    const def = mode === 'dark' ? cssVar.defaultDark : cssVar.defaultLight;
    setValues(v => ({ ...v, [name]: def }));
  }, [mode]);

  const handleResetAll = useCallback(() => {
    for (const v of CSS_VARS) {
      resetVar(v.name);
    }
    const defaults = mode === 'dark' ? DARK_DEFAULTS : LIGHT_DEFAULTS;
    setValues({ ...defaults });
  }, [mode]);

  const handleModeToggle = useCallback(() => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    // Apply appropriate theme mode
    if (newMode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    // Read new computed values
    const current: Record<string, string> = {};
    for (const v of CSS_VARS) {
      current[v.name] = readVar(v.name) || (newMode === 'dark' ? v.defaultDark : v.defaultLight);
    }
    setValues(current);
  }, [mode]);

  const applyTheme = useCallback((theme: SavedTheme) => {
    // Set mode
    if (theme.mode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      setMode('light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      setMode('dark');
    }
    // Apply vars
    for (const [name, val] of Object.entries(theme.vars)) {
      setVar(name, val);
    }
    setValues({ ...theme.vars });
    setActiveTab('editor');
  }, []);

  const saveTheme = useCallback(() => {
    if (!newThemeName.trim()) return;
    setSavedThemes(ts => [...ts, { name: newThemeName.trim(), vars: { ...values }, mode }]);
    setNewThemeName('');
  }, [newThemeName, values, mode]);

  const copyCSS = useCallback(() => {
    const lines = [`:root {`];
    for (const [k, v] of Object.entries(values)) {
      lines.push(`  ${k}: ${v};`);
    }
    lines.push('}');
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [values]);

  const exportJSON = useCallback(() => {
    const content = JSON.stringify({ name: 'Quill Theme', mode, vars: values }, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'quill-theme.json'; a.click();
    URL.revokeObjectURL(url);
  }, [values, mode]);

  const importJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const theme: SavedTheme = JSON.parse(ev.target?.result as string);
        if (theme.vars) applyTheme(theme);
      } catch { alert('Invalid theme file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [applyTheme]);

  if (!open) return null;

  const modifiedCount = CSS_VARS.filter(v => {
    const def = mode === 'dark' ? v.defaultDark : v.defaultLight;
    return values[v.name] && values[v.name] !== def;
  }).length;

  return (
    <div style={{
      position: 'fixed',
      top: 48,
      right: 8,
      width: 340,
      maxHeight: 'calc(100vh - 64px)',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 300,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🎨</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Theme Editor</span>
          {modifiedCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.15)', padding: '1px 6px', borderRadius: 100 }}>
              {modifiedCount} modified
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Dark/Light toggle */}
          <button
            onClick={handleModeToggle}
            style={{
              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--muted)',
            }}
            title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          >
            {mode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={onClose}
            style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Color preview strip */}
      <div style={{ display: 'flex', height: 12, flexShrink: 0, overflow: 'hidden' }}>
        {CSS_VARS.filter(v => v.type === 'color' && !values[v.name]?.includes('18')).map(v => (
          <div key={v.name} style={{ flex: 1, background: values[v.name] || v.defaultDark }} />
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {(['themes', 'editor'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 0', fontSize: 12, fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? '#6366f1' : 'var(--subtle)',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab === 'themes' ? 'Themes' : 'CSS Variables'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Themes tab ── */}
        {activeTab === 'themes' && (
          <div style={{ padding: '10px 0' }}>
            {savedThemes.map((theme, i) => (
              <button
                key={i}
                onClick={() => applyTheme(theme)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 16px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Color strip preview */}
                  <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', width: 48, height: 20, flexShrink: 0 }}>
                    {['--bg', '--panel', '--accent', '--text'].map(k => (
                      <div key={k} style={{ flex: 1, background: theme.vars[k] || '#888' }} />
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>{theme.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--subtle)' }}>{theme.mode === 'dark' ? '🌙 Dark' : '☀️ Light'}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#6366f1' }}>Apply →</div>
              </button>
            ))}

            {/* Save current as theme */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 6 }}>Save current as theme</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={newThemeName}
                  onChange={e => setNewThemeName(e.target.value)}
                  placeholder="Theme name…"
                  onKeyDown={e => e.key === 'Enter' && saveTheme()}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: 12,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                    color: 'var(--text)', outline: 'none',
                  }}
                />
                <button
                  onClick={saveTheme}
                  disabled={!newThemeName.trim()}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: newThemeName.trim() ? '#6366f1' : 'rgba(255,255,255,0.06)',
                    color: newThemeName.trim() ? '#fff' : 'var(--subtle)',
                    border: 'none', cursor: newThemeName.trim() ? 'pointer' : 'default',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CSS Variables editor tab ── */}
        {activeTab === 'editor' && (
          <>
            {/* Action bar */}
            <div style={{
              display: 'flex', gap: 6, padding: '8px 14px',
              borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap',
            }}>
              <button
                onClick={handleResetAll}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <RotateCcw size={10} /> Reset all
              </button>
              <button
                onClick={copyCSS}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, color: copied ? '#22c55e' : 'var(--subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? 'Copied!' : 'Copy CSS'}
              </button>
              <button
                onClick={exportJSON}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Download size={10} /> Export
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Upload size={10} /> Import
              </button>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} />
            </div>

            {/* Variable groups */}
            {GROUPS.map(group => {
              const groupVars = CSS_VARS.filter(v => v.group === group);
              const expanded = expandedGroups.has(group);
              const groupModified = groupVars.filter(v => {
                const def = mode === 'dark' ? v.defaultDark : v.defaultLight;
                return values[v.name] && values[v.name] !== def;
              }).length;

              return (
                <div key={group}>
                  <button
                    onClick={() => {
                      setExpandedGroups(prev => {
                        const next = new Set(prev);
                        if (next.has(group)) next.delete(group); else next.add(group);
                        return next;
                      });
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', background: 'rgba(255,255,255,0.02)',
                      border: 'none', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', color: 'var(--subtle)',
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--subtle)' }}>{expanded ? '▾' : '▸'}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{group}</span>
                    {groupModified > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: 100 }}>{groupModified}</span>
                    )}
                  </button>

                  {expanded && groupVars.map(cssVar => (
                    <ColorVarRow
                      key={cssVar.name}
                      cssVar={cssVar}
                      currentValue={values[cssVar.name] || (mode === 'dark' ? cssVar.defaultDark : cssVar.defaultLight)}
                      defaultValue={mode === 'dark' ? cssVar.defaultDark : cssVar.defaultLight}
                      onChange={handleChange}
                      onReset={handleReset}
                    />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
