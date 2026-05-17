import React, { useState, useMemo, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedColor {
  hex: string;
  count: number;
  sources: Array<'fill' | 'stroke'>;
  shapeIds: string[];
}

export interface PaletteEntry {
  id: string;
  hex: string;
  name: string;
  locked: boolean;
}

export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'
  | 'monochromatic';

export interface HSL { h: number; s: number; l: number }
export interface RGB { r: number; g: number; b: number }

// ─── Color utilities ──────────────────────────────────────────────────────────

export function hexToRGB(hex: string): RGB | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

export function rgbToHSL({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToRGB({ h, s, l }: HSL): RGB {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1/3) * 255),
  };
}

export function hslToHex(hsl: HSL): string {
  const { r, g, b } = hslToRGB(hsl);
  return rgbToHex(r, g, b);
}

/** Luminance per WCAG 2.1 */
export function relativeLuminance({ r, g, b }: RGB): number {
  const lin = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRGB(hex1);
  const rgb2 = hexToRGB(hex2);
  if (!rgb1 || !rgb2) return 1;
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function textColorForBg(hex: string): string {
  const rgb = hexToRGB(hex);
  if (!rgb) return '#000000';
  return relativeLuminance(rgb) > 0.179 ? '#000000' : '#ffffff';
}

// ─── Color extraction from shapes ────────────────────────────────────────────

function normalizeHex(hex: string): string | null {
  if (!hex || hex === 'transparent' || hex === 'none') return null;
  const clean = hex.trim().replace('#', '').toLowerCase();
  if (clean.length === 3) {
    return '#' + clean.split('').map(c => c + c).join('');
  }
  if (clean.length === 6) return '#' + clean;
  return null;
}

export function extractColorsFromShapes(shapes: Shape[]): ExtractedColor[] {
  const map = new Map<string, ExtractedColor>();

  for (const shape of shapes) {
    const pairs: Array<[string | undefined, 'fill' | 'stroke']> = [
      [shape.fill, 'fill'],
      [shape.stroke, 'stroke'],
    ];
    for (const [raw, source] of pairs) {
      const hex = raw ? normalizeHex(raw) : null;
      if (!hex) continue;
      if (map.has(hex)) {
        const entry = map.get(hex)!;
        entry.count++;
        entry.shapeIds.push(shape.id);
        if (!entry.sources.includes(source)) entry.sources.push(source);
      } else {
        map.set(hex, { hex, count: 1, sources: [source], shapeIds: [shape.id] });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// ─── Harmony generation ───────────────────────────────────────────────────────

export function generateHarmony(baseHex: string, type: HarmonyType): string[] {
  const rgb = hexToRGB(baseHex);
  if (!rgb) return [baseHex];
  const hsl = rgbToHSL(rgb);

  const shift = (deg: number) => hslToHex({ h: (hsl.h + deg + 360) % 360, s: hsl.s, l: hsl.l });
  const lighten = (amount: number) => hslToHex({ h: hsl.h, s: hsl.s, l: Math.min(1, hsl.l + amount) });
  const darken = (amount: number) => hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(0, hsl.l - amount) });

  switch (type) {
    case 'complementary':
      return [baseHex, shift(180)];
    case 'analogous':
      return [shift(-30), baseHex, shift(30)];
    case 'triadic':
      return [baseHex, shift(120), shift(240)];
    case 'split-complementary':
      return [baseHex, shift(150), shift(210)];
    case 'tetradic':
      return [baseHex, shift(90), shift(180), shift(270)];
    case 'monochromatic':
      return [darken(0.3), darken(0.15), baseHex, lighten(0.15), lighten(0.3)];
    default:
      return [baseHex];
  }
}

// ─── Export utilities ─────────────────────────────────────────────────────────

export function exportPaletteCSS(entries: PaletteEntry[]): string {
  const vars = entries.map(e => {
    const name = e.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `  --color-${name}: ${e.hex};`;
  }).join('\n');
  return `:root {\n${vars}\n}`;
}

export function exportPaletteJSON(entries: PaletteEntry[]): string {
  const obj = Object.fromEntries(entries.map(e => [e.name, e.hex]));
  return JSON.stringify({ colors: obj }, null, 2);
}

export function exportPaletteTailwind(entries: PaletteEntry[]): string {
  const colors = entries.map(e => {
    const name = e.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `      '${name}': '${e.hex}',`;
  }).join('\n');
  return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${colors}\n      },\n    },\n  },\n};`;
}

export function exportPaletteASE(entries: PaletteEntry[]): string {
  // Text-based representation since binary ASE isn't practical in a string
  return entries.map(e => {
    const rgb = hexToRGB(e.hex);
    if (!rgb) return `${e.name}: ${e.hex}`;
    const r = (rgb.r / 255).toFixed(4);
    const g = (rgb.g / 255).toFixed(4);
    const b = (rgb.b / 255).toFixed(4);
    return `${e.name}: RGB(${r}, ${g}, ${b})  ${e.hex}`;
  }).join('\n');
}

// ─── Palette entry helpers ────────────────────────────────────────────────────

let _paletteCounter = 0;
export function paletteId(): string { return `pal-${++_paletteCounter}`; }

export function defaultName(hex: string, index: number): string {
  const rgb = hexToRGB(hex);
  if (!rgb) return `Color ${index + 1}`;
  const hsl = rgbToHSL(rgb);
  if (hsl.s < 0.1) {
    if (hsl.l > 0.85) return 'White';
    if (hsl.l < 0.15) return 'Black';
    return 'Gray';
  }
  const h = hsl.h;
  let name = 'Color';
  if (h < 15 || h >= 345) name = 'Red';
  else if (h < 45) name = 'Orange';
  else if (h < 70) name = 'Yellow';
  else if (h < 150) name = 'Green';
  else if (h < 195) name = 'Cyan';
  else if (h < 255) name = 'Blue';
  else if (h < 285) name = 'Indigo';
  else if (h < 345) name = 'Purple';
  if (hsl.l > 0.7) name = 'Light ' + name;
  else if (hsl.l < 0.3) name = 'Dark ' + name;
  return name;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
}

type ExportFormat = 'css' | 'json' | 'tailwind' | 'ase';
type Tab = 'extracted' | 'palette' | 'harmony';

const HARMONY_TYPES: { value: HarmonyType; label: string }[] = [
  { value: 'complementary', label: 'Complementary' },
  { value: 'analogous', label: 'Analogous' },
  { value: 'triadic', label: 'Triadic' },
  { value: 'split-complementary', label: 'Split Comp.' },
  { value: 'tetradic', label: 'Tetradic' },
  { value: 'monochromatic', label: 'Monochromatic' },
];

export function ColorPaletteExtractor({ open, onClose, shapes }: Props) {
  const [tab, setTab] = useState<Tab>('extracted');
  const [palette, setPalette] = useState<PaletteEntry[]>([]);
  const [harmonyBase, setHarmonyBase] = useState('#6366f1');
  const [harmonyType, setHarmonyType] = useState<HarmonyType>('complementary');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (!open) return null;

  const extracted = useMemo(() => extractColorsFromShapes(shapes), [shapes]);
  const harmonyColors = useMemo(() => generateHarmony(harmonyBase, harmonyType), [harmonyBase, harmonyType]);

  const addToPalette = useCallback((hex: string, name?: string) => {
    const id = paletteId();
    const idx = palette.length;
    setPalette(p => [...p, {
      id,
      hex,
      name: name ?? defaultName(hex, idx),
      locked: false,
    }]);
  }, [palette.length]);

  const removeFromPalette = useCallback((id: string) => {
    setPalette(p => p.filter(e => e.id !== id));
  }, []);

  const toggleLock = useCallback((id: string) => {
    setPalette(p => p.map(e => e.id === id ? { ...e, locked: !e.locked } : e));
  }, []);

  const startEdit = (entry: PaletteEntry) => {
    setEditingId(entry.id);
    setEditName(entry.name);
  };

  const commitEdit = () => {
    if (editingId && editName.trim()) {
      setPalette(p => p.map(e => e.id === editingId ? { ...e, name: editName.trim() } : e));
    }
    setEditingId(null);
  };

  const getExportText = () => {
    if (palette.length === 0) return '// Add colors to your palette first';
    switch (exportFormat) {
      case 'css': return exportPaletteCSS(palette);
      case 'json': return exportPaletteJSON(palette);
      case 'tailwind': return exportPaletteTailwind(palette);
      case 'ase': return exportPaletteASE(palette);
    }
  };

  const copyExport = async () => {
    await navigator.clipboard.writeText(getExportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const addHarmonyToPalette = () => {
    harmonyColors.forEach(hex => addToPalette(hex));
  };

  const swatch = (hex: string, size = 40, onClick?: () => void, title?: string) => (
    <button
      key={hex}
      title={title ?? hex}
      onClick={onClick}
      style={{
        width: size, height: size,
        background: hex,
        border: '2px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        transition: 'transform 0.1s',
      }}
      onMouseEnter={e => { if (onClick) (e.target as HTMLElement).style.transform = 'scale(1.1)'; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
    />
  );

  const panel: React.CSSProperties = {
    position: 'fixed', top: 60, right: 16, width: 360,
    background: '#1a1a2e', border: '1px solid #2a2a4a',
    borderRadius: 12, zIndex: 1500, display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden',
    maxHeight: 'calc(100vh - 80px)',
  };

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        flex: 1, padding: '8px 0', fontSize: 13, fontWeight: tab === t ? 700 : 400,
        background: tab === t ? '#2a2a4a' : 'transparent',
        color: tab === t ? '#a78bfa' : '#94a3b8', border: 'none',
        cursor: 'pointer', borderBottom: tab === t ? '2px solid #a78bfa' : '2px solid transparent',
        transition: 'all 0.15s',
      }}
    >{label}</button>
  );

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #2a2a4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#c4b5fd' }}>🎨 Color Palette Extractor</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
          {extracted.length} unique colors from {shapes.length} shapes
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2a4a', flexShrink: 0 }}>
        {tabBtn('extracted', 'Extracted')}
        {tabBtn('palette', `Palette (${palette.length})`)}
        {tabBtn('harmony', 'Harmony')}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {/* ── Extracted tab ── */}
        {tab === 'extracted' && (
          <div>
            {extracted.length === 0 && (
              <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 32 }}>
                No colors found. Add shapes with fills or strokes.
              </div>
            )}
            {extracted.map(ec => {
              const textColor = textColorForBg(ec.hex);
              const rgb = hexToRGB(ec.hex);
              const hsl = rgb ? rgbToHSL(rgb) : null;
              return (
                <div key={ec.hex} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid #1e1e3a',
                }}>
                  <div style={{
                    width: 44, height: 44, background: ec.hex, borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: textColor, fontSize: 10, fontWeight: 700 }}>
                      {ec.count}×
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#e2e8f0' }}>{ec.hex}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {ec.sources.join(' + ')}
                      {hsl && ` · H${Math.round(hsl.h)}° S${Math.round(hsl.s * 100)}% L${Math.round(hsl.l * 100)}%`}
                    </div>
                  </div>
                  <button
                    onClick={() => addToPalette(ec.hex)}
                    title="Add to palette"
                    style={{
                      background: '#2a2a4a', border: '1px solid #3a3a6a',
                      borderRadius: 6, color: '#a78bfa', cursor: 'pointer',
                      padding: '4px 8px', fontSize: 12, flexShrink: 0,
                    }}
                  >+ Add</button>
                </div>
              );
            })}
            {extracted.length > 0 && (
              <button
                onClick={() => extracted.forEach(ec => addToPalette(ec.hex))}
                style={{
                  width: '100%', marginTop: 12, padding: '8px 0',
                  background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                  border: 'none', borderRadius: 8, color: '#fff',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >Add All to Palette</button>
            )}
          </div>
        )}

        {/* ── Palette tab ── */}
        {tab === 'palette' && (
          <div>
            {palette.length === 0 && (
              <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 32 }}>
                Your palette is empty. Extract colors or add from Harmony.
              </div>
            )}

            {/* Swatch row */}
            {palette.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {palette.map(e => swatch(e.hex, 36))}
              </div>
            )}

            {/* Entries */}
            {palette.map(entry => {
              const isEditing = editingId === entry.id;
              return (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', borderBottom: '1px solid #1e1e3a',
                }}>
                  <div style={{
                    width: 32, height: 32, background: entry.hex,
                    borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        style={{
                          background: '#0f0f23', border: '1px solid #7c3aed',
                          borderRadius: 4, color: '#e2e8f0', padding: '2px 6px',
                          fontSize: 13, width: '100%', outline: 'none',
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => startEdit(entry)}
                        style={{ fontSize: 13, color: '#e2e8f0', cursor: 'text' }}
                        title="Click to rename"
                      >{entry.name}</div>
                    )}
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{entry.hex}</div>
                  </div>
                  <button
                    onClick={() => toggleLock(entry.id)}
                    title={entry.locked ? 'Unlock' : 'Lock'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: entry.locked ? '#f59e0b' : '#475569', fontSize: 14,
                    }}
                  >{entry.locked ? '🔒' : '🔓'}</button>
                  <button
                    onClick={() => removeFromPalette(entry.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}
                  >×</button>
                </div>
              );
            })}

            {/* Export section */}
            {palette.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {(['css', 'json', 'tailwind', 'ase'] as ExportFormat[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setExportFormat(f)}
                      style={{
                        padding: '4px 10px', fontSize: 11, borderRadius: 6,
                        background: exportFormat === f ? '#7c3aed' : '#2a2a4a',
                        border: '1px solid ' + (exportFormat === f ? '#a78bfa' : '#3a3a6a'),
                        color: exportFormat === f ? '#fff' : '#94a3b8', cursor: 'pointer',
                      }}
                    >{f.toUpperCase()}</button>
                  ))}
                </div>
                <pre style={{
                  background: '#0f0f23', border: '1px solid #2a2a4a',
                  borderRadius: 8, padding: '10px 12px', fontSize: 11,
                  color: '#a78bfa', overflowX: 'auto', maxHeight: 160,
                  margin: 0, fontFamily: 'monospace',
                }}>{getExportText()}</pre>
                <button
                  onClick={copyExport}
                  style={{
                    width: '100%', marginTop: 8, padding: '8px 0',
                    background: copied ? '#10b981' : '#2a2a4a',
                    border: '1px solid ' + (copied ? '#10b981' : '#3a3a6a'),
                    borderRadius: 8, color: copied ? '#fff' : '#94a3b8',
                    fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >{copied ? '✓ Copied!' : 'Copy to Clipboard'}</button>
              </div>
            )}
          </div>
        )}

        {/* ── Harmony tab ── */}
        {tab === 'harmony' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Base Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={harmonyBase}
                  onChange={e => setHarmonyBase(e.target.value)}
                  style={{ width: 44, height: 36, borderRadius: 6, border: '1px solid #3a3a6a', cursor: 'pointer', padding: 2, background: '#1a1a2e' }}
                />
                <input
                  type="text"
                  value={harmonyBase}
                  onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setHarmonyBase(e.target.value); }}
                  style={{
                    flex: 1, background: '#0f0f23', border: '1px solid #3a3a6a',
                    borderRadius: 6, color: '#e2e8f0', padding: '6px 10px',
                    fontSize: 13, fontFamily: 'monospace', outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>Harmony Type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HARMONY_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setHarmonyType(value)}
                    style={{
                      padding: '5px 10px', fontSize: 11, borderRadius: 6,
                      background: harmonyType === value ? '#7c3aed' : '#2a2a4a',
                      border: '1px solid ' + (harmonyType === value ? '#a78bfa' : '#3a3a6a'),
                      color: harmonyType === value ? '#fff' : '#94a3b8', cursor: 'pointer',
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Harmony preview */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 8 }}>Preview</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {harmonyColors.map((hex, i) => {
                  const textColor = textColorForBg(hex);
                  return (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 56, height: 56, background: hex, borderRadius: 10,
                        border: '2px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ color: textColor, fontSize: 9, fontFamily: 'monospace' }}>{hex}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Color wheel info */}
            <div style={{
              background: '#0f0f23', borderRadius: 8, padding: 10, marginBottom: 14,
              border: '1px solid #2a2a4a',
            }}>
              {harmonyColors.map((hex, i) => {
                const rgb = hexToRGB(hex);
                const hsl = rgb ? rgbToHSL(rgb) : null;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <div style={{ width: 18, height: 18, background: hex, borderRadius: 3, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0', flex: 1 }}>{hex}</span>
                    {hsl && (
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        H{Math.round(hsl.h)}° S{Math.round(hsl.s * 100)}% L{Math.round(hsl.l * 100)}%
                      </span>
                    )}
                    <button
                      onClick={() => addToPalette(hex)}
                      style={{
                        background: '#2a2a4a', border: '1px solid #3a3a6a',
                        borderRadius: 4, color: '#a78bfa', cursor: 'pointer',
                        padding: '2px 6px', fontSize: 11,
                      }}
                    >+</button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addHarmonyToPalette}
              style={{
                width: '100%', padding: '9px 0',
                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                border: 'none', borderRadius: 8, color: '#fff',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >Add All to Palette</button>

            {/* Contrast checker mini */}
            {harmonyColors.length >= 2 && (
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 8 }}>Contrast Matrix</label>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 10, width: '100%' }}>
                    <tbody>
                      {harmonyColors.map((hex1, i) => (
                        <tr key={i}>
                          {harmonyColors.map((hex2, j) => {
                            if (i === j) return (
                              <td key={j} style={{
                                width: 44, height: 28, background: hex1,
                                border: '1px solid #2a2a4a', textAlign: 'center',
                              }} />
                            );
                            const cr = contrastRatio(hex1, hex2);
                            const pass = cr >= 4.5;
                            return (
                              <td key={j} style={{
                                background: hex1, border: '1px solid #2a2a4a',
                                textAlign: 'center', padding: '2px 4px',
                                color: hex2,
                              }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 700,
                                  textShadow: '0 0 2px rgba(0,0,0,0.5)',
                                  color: pass ? '#22c55e' : '#ef4444',
                                  mixBlendMode: 'normal',
                                }}>
                                  {cr.toFixed(1)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                  Green = passes WCAG AA (≥4.5:1), Red = fails
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
