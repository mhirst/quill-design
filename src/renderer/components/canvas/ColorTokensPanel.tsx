/**
 * ColorTokensPanel — Design token extractor + exporter
 *
 * Features:
 *  - Auto-scans all shapes for fill/stroke/gradient colors
 *  - Shows frequency count per unique color
 *  - User can name each color as a design token
 *  - Export formats: CSS custom properties, JSON (Figma-style), Tailwind config
 *  - Quick palette groups (primary, secondary, neutral, semantic)
 *  - One-click copy to clipboard
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ColorToken {
  hex: string;
  name: string;
  group: 'primary' | 'secondary' | 'neutral' | 'semantic' | 'accent' | 'custom';
  count: number; // how many shapes use this color
}

export type ExportFormat = 'css' | 'json' | 'tailwind' | 'scss';

// ── Utility exports (tested separately) ──────────────────────────────────────

/** Normalize hex to uppercase 6-char form, returns null if invalid */
export function normalizeHex(raw: string): string | null {
  if (!raw) return null;
  let h = raw.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 6 && /^[0-9a-fA-F]{6}$/.test(h)) return '#' + h.toUpperCase();
  if (h.length === 8 && /^[0-9a-fA-F]{8}$/.test(h)) return '#' + h.slice(0, 6).toUpperCase();
  return null;
}

/** Extract all unique colors from shapes array with usage counts */
export function extractColorTokens(shapes: Shape[]): Array<{ hex: string; count: number }> {
  const freq: Record<string, number> = {};
  for (const s of shapes) {
    const addHex = (raw?: string | null) => {
      const h = normalizeHex(raw ?? '');
      if (h) freq[h] = (freq[h] ?? 0) + 1;
    };
    addHex(s.fill);
    addHex(s.stroke);
    // Gradient stops
    if (Array.isArray((s as any).gradientStops)) {
      for (const stop of (s as any).gradientStops) addHex(stop.color);
    }
  }
  return Object.entries(freq)
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count);
}

/** Generate a slug-friendly CSS variable name from a display name */
export function tokenToVarName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Export tokens as CSS custom properties */
export function exportCSS(tokens: ColorToken[]): string {
  const lines = tokens
    .filter(t => t.name)
    .map(t => `  --color-${tokenToVarName(t.name)}: ${t.hex.toLowerCase()};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

/** Export tokens as Figma-style JSON */
export function exportJSON(tokens: ColorToken[]): string {
  const obj: Record<string, { value: string; type: string; group: string }> = {};
  for (const t of tokens.filter(t => t.name)) {
    obj[tokenToVarName(t.name)] = { value: t.hex.toLowerCase(), type: 'color', group: t.group };
  }
  return JSON.stringify({ colors: obj }, null, 2);
}

/** Export tokens as Tailwind config colors section */
export function exportTailwind(tokens: ColorToken[]): string {
  const entries = tokens
    .filter(t => t.name)
    .map(t => `    '${tokenToVarName(t.name)}': '${t.hex.toLowerCase()}',`);
  return `// tailwind.config.js — extend colors\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${entries.join('\n')}\n      },\n    },\n  },\n};`;
}

/** Export tokens as SCSS variables */
export function exportSCSS(tokens: ColorToken[]): string {
  return tokens
    .filter(t => t.name)
    .map(t => `$color-${tokenToVarName(t.name)}: ${t.hex.toLowerCase()};`)
    .join('\n');
}

/** Guess a group from a hex color (heuristic) */
export function guessGroup(hex: string): ColorToken['group'] {
  const h = normalizeHex(hex);
  if (!h) return 'custom';
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / (2 * 255);
  const saturation = max === min ? 0 : (max - min) / (max + min < 255 ? max + min : 510 - max - min);
  if (lightness > 0.85 || lightness < 0.15) return 'neutral';
  if (saturation < 0.15) return 'neutral';
  const hue = max === min ? 0
    : max === r ? ((g - b) / (max - min) + (g < b ? 6 : 0)) * 60
    : max === g ? ((b - r) / (max - min) + 2) * 60
    : ((r - g) / (max - min) + 4) * 60;
  if (hue >= 0 && hue < 30) return 'semantic'; // reds → error/danger
  if (hue >= 30 && hue < 70) return 'accent';  // orange/yellow
  if (hue >= 70 && hue < 150) return 'secondary'; // green
  if (hue >= 150 && hue < 260) return 'primary'; // blue/indigo
  return 'accent';
}

// ── Luminance helpers ─────────────────────────────────────────────────────────

function hexLuminance(hex: string): number {
  const h = normalizeHex(hex);
  if (!h) return 0;
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const lin = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function textColorFor(hex: string): string {
  return hexLuminance(hex) > 0.179 ? '#111111' : '#FFFFFF';
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 380,
  width: 400,
  maxHeight: 'calc(100vh - 80px)',
  background: '#1a0a0a',
  border: '1px solid #3a1a1a',
  borderRadius: 12,
  boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 600,
  fontFamily: 'system-ui, sans-serif',
  color: '#e8d5d5',
  overflow: 'hidden',
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid #3a1a1a',
  flexShrink: 0,
};

const BTN_SM: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #3a1a1a',
  background: '#2a1010',
  color: '#e8d5d5',
  fontSize: 12,
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const CLOSE_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#a08080',
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
};

const INPUT: React.CSSProperties = {
  background: '#2a1010',
  border: '1px solid #3a1a1a',
  borderRadius: 6,
  color: '#e8d5d5',
  padding: '4px 8px',
  fontSize: 12,
  width: '100%',
  outline: 'none',
};

const SELECT: React.CSSProperties = {
  ...INPUT,
  width: 'auto',
  cursor: 'pointer',
};

const GROUP_COLORS: Record<ColorToken['group'], string> = {
  primary: '#3b82f6',
  secondary: '#22c55e',
  neutral: '#9ca3af',
  semantic: '#ef4444',
  accent: '#f59e0b',
  custom: '#a855f7',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
}

export function ColorTokensPanel({ open, onClose, shapes }: Props) {
  const [tokens, setTokens] = useState<ColorToken[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [copied, setCopied] = useState(false);
  const [filterGroup, setFilterGroup] = useState<ColorToken['group'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showExport, setShowExport] = useState(false);

  // Sync tokens when shapes change
  useEffect(() => {
    if (!open) return;
    const extracted = extractColorTokens(shapes);
    setTokens(prev => {
      return extracted.map(({ hex, count }) => {
        const existing = prev.find(t => t.hex === hex);
        return existing
          ? { ...existing, count }
          : {
              hex,
              count,
              name: '',
              group: guessGroup(hex),
            };
      });
    });
  }, [open, shapes]);

  const filtered = useMemo(() => {
    return tokens.filter(t => {
      if (filterGroup !== 'all' && t.group !== filterGroup) return false;
      if (search && !t.hex.toLowerCase().includes(search.toLowerCase()) &&
          !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tokens, filterGroup, search]);

  const namedTokens = useMemo(() => tokens.filter(t => t.name.trim()), [tokens]);

  const exportedCode = useMemo(() => {
    if (!showExport) return '';
    switch (exportFormat) {
      case 'css': return exportCSS(namedTokens);
      case 'json': return exportJSON(namedTokens);
      case 'tailwind': return exportTailwind(namedTokens);
      case 'scss': return exportSCSS(namedTokens);
    }
  }, [showExport, exportFormat, namedTokens]);

  const updateToken = (hex: string, patch: Partial<ColorToken>) => {
    setTokens(prev => prev.map(t => t.hex === hex ? { ...t, ...patch } : t));
  };

  const autoNameAll = () => {
    setTokens(prev => prev.map((t, i) => {
      if (t.name) return t;
      const gname = t.group === 'custom' ? 'color' : t.group;
      const idx = prev.filter((x, j) => j <= i && x.group === t.group).length;
      return { ...t, name: `${gname}-${idx}` };
    }));
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (!open) return null;

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🎨</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Color Tokens</span>
          <span style={{
            background: '#3a1a1a',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            color: '#a08080',
          }}>
            {tokens.length} colors · {namedTokens.length} named
          </span>
        </div>
        <button style={CLOSE_BTN} onClick={onClose}>✕</button>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #3a1a1a', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <input
          style={{ ...INPUT, flex: 1, minWidth: 100 }}
          placeholder="Search colors or names…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          style={SELECT}
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value as any)}
        >
          <option value="all">All groups</option>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="neutral">Neutral</option>
          <option value="semantic">Semantic</option>
          <option value="accent">Accent</option>
          <option value="custom">Custom</option>
        </select>
        <button style={BTN_SM} onClick={autoNameAll}>Auto-name</button>
        <button
          style={{ ...BTN_SM, background: showExport ? '#4a1a1a' : '#2a1010' }}
          onClick={() => setShowExport(v => !v)}
        >
          Export
        </button>
      </div>

      {/* Export area */}
      {showExport && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#a08080' }}>Format:</span>
            {(['css', 'scss', 'json', 'tailwind'] as ExportFormat[]).map(f => (
              <button
                key={f}
                onClick={() => setExportFormat(f)}
                style={{
                  ...BTN_SM,
                  background: exportFormat === f ? '#b5533c' : '#2a1010',
                  borderColor: exportFormat === f ? '#b5533c' : '#3a1a1a',
                }}
              >
                {f.toUpperCase()}
              </button>
            ))}
            <button
              style={{ ...BTN_SM, marginLeft: 'auto', background: copied ? '#1a4a1a' : '#2a1010' }}
              onClick={copyToClipboard}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          {namedTokens.length === 0 ? (
            <div style={{ fontSize: 12, color: '#a08080', textAlign: 'center', padding: 8 }}>
              Name some colors below to export them.
            </div>
          ) : (
            <textarea
              readOnly
              value={exportedCode}
              style={{
                ...INPUT,
                height: 140,
                resize: 'none',
                fontFamily: 'monospace',
                fontSize: 11,
                lineHeight: 1.6,
              }}
            />
          )}
        </div>
      )}

      {/* Color token list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 12px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#a08080', fontSize: 13, padding: '32px 0' }}>
            {tokens.length === 0
              ? 'No shapes on canvas. Add some shapes first.'
              : 'No colors match your filter.'}
          </div>
        )}

        {filtered.map(token => (
          <div
            key={token.hex}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 0',
              borderBottom: '1px solid #2a1010',
            }}
          >
            {/* Swatch */}
            <div
              title={token.hex}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: token.hex,
                border: '1px solid rgba(255,255,255,0.1)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: textColorFor(token.hex),
                fontWeight: 700,
              }}
            >
              {token.count}
            </div>

            {/* Info column */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Hex + group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#e8d5d5' }}>
                  {token.hex.toLowerCase()}
                </span>
                <select
                  value={token.group}
                  onChange={e => updateToken(token.hex, { group: e.target.value as ColorToken['group'] })}
                  style={{
                    ...SELECT,
                    padding: '1px 4px',
                    fontSize: 10,
                    background: GROUP_COLORS[token.group] + '22',
                    borderColor: GROUP_COLORS[token.group] + '66',
                    color: GROUP_COLORS[token.group],
                  }}
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="neutral">Neutral</option>
                  <option value="semantic">Semantic</option>
                  <option value="accent">Accent</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Name input */}
              <input
                style={{ ...INPUT, padding: '3px 7px', fontSize: 12 }}
                placeholder="Token name (e.g. brand-blue)"
                value={token.name}
                onChange={e => updateToken(token.hex, { name: e.target.value })}
              />
              {token.name && (
                <div style={{ fontSize: 10, color: '#a08080', marginTop: 2, fontFamily: 'monospace' }}>
                  --color-{tokenToVarName(token.name)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #3a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: '#a08080',
        flexShrink: 0,
      }}>
        <span>⌘⌥6 to toggle</span>
        <span>{namedTokens.length} of {tokens.length} named</span>
      </div>
    </div>
  );
}
