/**
 * ThemeCustomizerPanel
 * Customize the app's UI theme by modifying CSS custom properties.
 * Changes are saved to localStorage and applied on load.
 * Shortcut: ⌘⇧, (Cmd+Shift+Comma — like VS Code settings)
 */
import React, { useState, useCallback, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';

// ── Default themes ────────────────────────────────────────────────────────────

interface ThemeVars {
  '--bg': string;
  '--panel': string;
  '--panel-alt': string;
  '--border': string;
  '--accent': string;
  '--canvas-bg': string;
}

const DARK_DEFAULTS: ThemeVars = {
  '--bg': '#111111',
  '--panel': '#1c1c1c',
  '--panel-alt': '#222222',
  '--border': '#333333',
  '--accent': '#9d8ff9',
  '--canvas-bg': '#18181f',
};

const LIGHT_DEFAULTS: ThemeVars = {
  '--bg': '#f0f0f0',
  '--panel': '#ffffff',
  '--panel-alt': '#f7f7f7',
  '--border': '#e0e0e0',
  '--accent': '#6252d4',
  '--canvas-bg': '#e8e8ed',
};

const STORAGE_KEY_DARK = 'quill-theme-vars-dark';
const STORAGE_KEY_LIGHT = 'quill-theme-vars-light';

// Pre-built accent themes
const ACCENT_PRESETS = [
  { name: 'Indigo', dark: '#9d8ff9', light: '#6252d4' },
  { name: 'Blue', dark: '#60a5fa', light: '#2563eb' },
  { name: 'Cyan', dark: '#22d3ee', light: '#0891b2' },
  { name: 'Green', dark: '#34d399', light: '#059669' },
  { name: 'Amber', dark: '#fbbf24', light: '#d97706' },
  { name: 'Orange', dark: '#fb923c', light: '#ea580c' },
  { name: 'Rose', dark: '#fb7185', light: '#e11d48' },
  { name: 'Pink', dark: '#f472b6', light: '#db2777' },
];

// Full UI theme presets (dark mode)
const THEME_PRESETS = [
  {
    name: 'Midnight', description: 'Default dark',
    vars: { '--bg': '#111111', '--panel': '#1c1c1c', '--panel-alt': '#222222', '--border': '#333333', '--canvas-bg': '#18181f' },
  },
  {
    name: 'Obsidian', description: 'Deep black',
    vars: { '--bg': '#000000', '--panel': '#0d0d0d', '--panel-alt': '#141414', '--border': '#222222', '--canvas-bg': '#080808' },
  },
  {
    name: 'Slate', description: 'Cool blue-grey',
    vars: { '--bg': '#0f172a', '--panel': '#1e293b', '--panel-alt': '#273549', '--border': '#334155', '--canvas-bg': '#0a1020' },
  },
  {
    name: 'Forest', description: 'Deep green tones',
    vars: { '--bg': '#0d1f0e', '--panel': '#1a2e1b', '--panel-alt': '#203522', '--border': '#2d4a2f', '--canvas-bg': '#0a180b' },
  },
  {
    name: 'Midnight Blue', description: 'Dark navy',
    vars: { '--bg': '#0d1117', '--panel': '#161b22', '--panel-alt': '#1c2128', '--border': '#30363d', '--canvas-bg': '#090d12' },
  },
  {
    name: 'Warm Dark', description: 'Warm tones',
    vars: { '--bg': '#1a1510', '--panel': '#221d16', '--panel-alt': '#2a231b', '--border': '#3d3226', '--canvas-bg': '#14110d' },
  },
];

// ── Load/save helpers ─────────────────────────────────────────────────────────

function getStorageKey(isDark: boolean) {
  return isDark ? STORAGE_KEY_DARK : STORAGE_KEY_LIGHT;
}

export function loadSavedThemeVars(isDark: boolean): Partial<ThemeVars> {
  try {
    const stored = localStorage.getItem(getStorageKey(isDark));
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {};
}

export function applyThemeVars(vars: Partial<ThemeVars>) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
    // Compute accent-dim from accent
    if (key === '--accent') {
      root.style.setProperty('--accent-dim', value + '18');
    }
  }
}

function saveThemeVars(vars: Partial<ThemeVars>, isDark: boolean) {
  try {
    localStorage.setItem(getStorageKey(isDark), JSON.stringify(vars));
  } catch { /* ignore */ }
}

function isDarkMode() {
  return !document.documentElement.hasAttribute('data-theme');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ThemeCustomizerPanel({ open, onClose }: Props) {
  const [dark, setDark] = useState(isDarkMode);
  const [customVars, setCustomVars] = useState<Partial<ThemeVars>>(() => loadSavedThemeVars(isDarkMode()));
  const [previewPreset, setPreviewPreset] = useState<string | null>(null);

  const defaults = dark ? DARK_DEFAULTS : LIGHT_DEFAULTS;

  // Track theme mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const nowDark = isDarkMode();
      setDark(nowDark);
      setCustomVars(loadSavedThemeVars(nowDark));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const setVar = useCallback((key: keyof ThemeVars, value: string) => {
    const next = { ...customVars, [key]: value };
    setCustomVars(next);
    applyThemeVars({ [key]: value });
    saveThemeVars(next, dark);
  }, [customVars, dark]);

  const applyPreset = useCallback((preset: typeof THEME_PRESETS[0]) => {
    const next = { ...customVars, ...preset.vars };
    setCustomVars(next);
    applyThemeVars(preset.vars);
    saveThemeVars(next, dark);
    setPreviewPreset(null);
  }, [customVars, dark]);

  const applyAccent = useCallback((accentDark: string, accentLight: string) => {
    const value = dark ? accentDark : accentLight;
    setVar('--accent', value);
  }, [dark, setVar]);

  const resetAll = useCallback(() => {
    setCustomVars({});
    // Reset all vars to empty (CSS defaults will take over)
    const root = document.documentElement;
    for (const key of Object.keys(defaults) as (keyof ThemeVars)[]) {
      root.style.removeProperty(key);
      if (key === '--accent') root.style.removeProperty('--accent-dim');
    }
    localStorage.removeItem(getStorageKey(dark));
  }, [dark, defaults]);

  if (!open) return null;

  const currentVars = { ...defaults, ...customVars };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 48,
        left: 64,
        zIndex: 420,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        width: 280,
        maxHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: `conic-gradient(var(--accent), #f59e0b, #10b981, var(--accent))`,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          Theme Customizer
        </span>
        <button
          onClick={resetAll}
          title="Reset to defaults"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
        >
          <RotateCcw size={12} />
        </button>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <X size={13} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Accent color presets */}
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
            Accent Color
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {ACCENT_PRESETS.map(preset => {
              const presetColor = dark ? preset.dark : preset.light;
              const isCurrent = (customVars['--accent'] ?? defaults['--accent']) === presetColor;
              return (
                <button
                  key={preset.name}
                  onClick={() => applyAccent(preset.dark, preset.light)}
                  title={preset.name}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: presetColor,
                    border: `2px solid ${isCurrent ? 'white' : 'transparent'}`,
                    cursor: 'pointer', padding: 0,
                    boxShadow: isCurrent ? `0 0 0 2px ${presetColor}` : 'none',
                    transition: 'transform 0.1s, box-shadow 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                />
              );
            })}
            {/* Custom accent color picker */}
            <div style={{ position: 'relative', width: 24, height: 24 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: `conic-gradient(red, yellow, green, cyan, blue, magenta, red)`,
                border: '2px solid var(--border)', cursor: 'pointer',
              }} />
              <input
                type="color"
                value={currentVars['--accent']}
                onChange={e => setVar('--accent', e.target.value)}
                style={{
                  position: 'absolute', inset: 0, opacity: 0,
                  width: '100%', height: '100%', cursor: 'pointer', borderRadius: '50%',
                }}
                title="Custom accent color"
              />
            </div>
          </div>
        </div>

        {/* Panel theme presets */}
        <div style={{ padding: '0 12px 10px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
            Panel Theme {!dark && <span style={{ opacity: 0.5 }}>(dark mode only)</span>}
          </div>
          {dark ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {THEME_PRESETS.map(preset => {
                const isActive = previewPreset === preset.name;
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    onMouseEnter={() => {
                      setPreviewPreset(preset.name);
                      applyThemeVars(preset.vars);
                    }}
                    onMouseLeave={() => {
                      setPreviewPreset(null);
                      // Revert to current
                      applyThemeVars(customVars);
                    }}
                    style={{
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                      background: preset.vars['--panel'],
                      textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                  >
                    {/* Mini preview swatches */}
                    <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                      {['--bg', '--panel', '--panel-alt', '--border'].map(v => (
                        <div key={v} style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: preset.vars[v as keyof typeof preset.vars] ?? '#fff',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#f0f0f0' }}>{preset.name}</span>
                    <span style={{ fontSize: 9, color: '#777' }}>{preset.description}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--subtle)', margin: 0 }}>
              Switch to dark mode to access panel themes.
            </p>
          )}
        </div>

        {/* Individual controls */}
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
            Fine-tune
          </div>
          {([
            { key: '--bg' as const, label: 'Background' },
            { key: '--panel' as const, label: 'Panel' },
            { key: '--panel-alt' as const, label: 'Panel Alt' },
            { key: '--border' as const, label: 'Border' },
            { key: '--canvas-bg' as const, label: 'Canvas' },
          ]).map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 4,
                  background: currentVars[key],
                  border: '1px solid var(--border)',
                }} />
                <input
                  type="color"
                  value={currentVars[key]}
                  onChange={e => setVar(key, e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                />
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>{label}</span>
              <span style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'monospace' }}>
                {currentVars[key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border)', flexShrink: 0,
        fontSize: 10, color: 'var(--subtle)',
      }}>
        Changes apply instantly and persist across sessions
      </div>
    </div>
  );
}
