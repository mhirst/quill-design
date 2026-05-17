import React, { useState, useMemo, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WCAGLevel = 'AA' | 'AAA' | 'AA-large' | 'fail';
export type TextSize = 'normal' | 'large';

export interface RGB { r: number; g: number; b: number; }
export interface HSL { h: number; s: number; l: number; }

export interface ColorPair {
  background: string;
  foreground: string;
  contrast: number;
  level: WCAGLevel;
  normalText: WCAGLevel;
  largeText: WCAGLevel;
}

export interface SuggestedColor {
  hex: string;
  name: string;
  family: string;
  contrast: number;
  level: WCAGLevel;
}

// ── Color families (seed colors) ─────────────────────────────────────────────

export const COLOR_SEEDS: { hex: string; name: string; family: string }[] = [
  // Neutrals
  { hex: '#000000', name: 'Black', family: 'neutral' },
  { hex: '#111827', name: 'Gray 900', family: 'neutral' },
  { hex: '#1f2937', name: 'Gray 800', family: 'neutral' },
  { hex: '#374151', name: 'Gray 700', family: 'neutral' },
  { hex: '#4b5563', name: 'Gray 600', family: 'neutral' },
  { hex: '#6b7280', name: 'Gray 500', family: 'neutral' },
  { hex: '#9ca3af', name: 'Gray 400', family: 'neutral' },
  { hex: '#d1d5db', name: 'Gray 300', family: 'neutral' },
  { hex: '#f3f4f6', name: 'Gray 100', family: 'neutral' },
  { hex: '#ffffff', name: 'White', family: 'neutral' },
  // Blues
  { hex: '#1e3a5f', name: 'Navy', family: 'blue' },
  { hex: '#1d4ed8', name: 'Blue 700', family: 'blue' },
  { hex: '#2563eb', name: 'Blue 600', family: 'blue' },
  { hex: '#3b82f6', name: 'Blue 500', family: 'blue' },
  { hex: '#93c5fd', name: 'Blue 300', family: 'blue' },
  { hex: '#dbeafe', name: 'Blue 100', family: 'blue' },
  // Greens
  { hex: '#14532d', name: 'Green 900', family: 'green' },
  { hex: '#15803d', name: 'Green 700', family: 'green' },
  { hex: '#22c55e', name: 'Green 500', family: 'green' },
  { hex: '#86efac', name: 'Green 300', family: 'green' },
  { hex: '#dcfce7', name: 'Green 100', family: 'green' },
  // Reds
  { hex: '#7f1d1d', name: 'Red 900', family: 'red' },
  { hex: '#b91c1c', name: 'Red 700', family: 'red' },
  { hex: '#ef4444', name: 'Red 500', family: 'red' },
  { hex: '#fca5a5', name: 'Red 300', family: 'red' },
  { hex: '#fee2e2', name: 'Red 100', family: 'red' },
  // Purples
  { hex: '#4c1d95', name: 'Purple 900', family: 'purple' },
  { hex: '#7c3aed', name: 'Purple 600', family: 'purple' },
  { hex: '#a78bfa', name: 'Purple 400', family: 'purple' },
  { hex: '#ede9fe', name: 'Purple 100', family: 'purple' },
  // Ambers / Oranges
  { hex: '#78350f', name: 'Amber 900', family: 'warm' },
  { hex: '#b45309', name: 'Amber 700', family: 'warm' },
  { hex: '#f59e0b', name: 'Amber 500', family: 'warm' },
  { hex: '#fde68a', name: 'Amber 200', family: 'warm' },
  { hex: '#fffbeb', name: 'Amber 50', family: 'warm' },
  // Pinks
  { hex: '#831843', name: 'Pink 900', family: 'pink' },
  { hex: '#be185d', name: 'Pink 700', family: 'pink' },
  { hex: '#ec4899', name: 'Pink 500', family: 'pink' },
  { hex: '#fbcfe8', name: 'Pink 200', family: 'pink' },
  // Teals / Cyans
  { hex: '#134e4a', name: 'Teal 900', family: 'teal' },
  { hex: '#0f766e', name: 'Teal 700', family: 'teal' },
  { hex: '#14b8a6', name: 'Teal 500', family: 'teal' },
  { hex: '#99f6e4', name: 'Teal 200', family: 'teal' },
];

const FAMILIES = ['neutral', 'blue', 'green', 'red', 'purple', 'warm', 'pink', 'teal'];

// ── Pure colour math (exported for tests) ────────────────────────────────────

export function hexToRGB(hex: string): RGB {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
}

export function rgbToHex(rgb: RGB): string {
  const cl = (v: number) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + cl(rgb.r) + cl(rgb.g) + cl(rgb.b);
}

export function rgbToHSL(rgb: RGB): HSL {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function relativeLuminance(rgb: RGB): number {
  const chan = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

export function contrastRatio(fg: RGB, bg: RGB): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const bright = Math.max(l1, l2), dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

export function wcagLevel(ratio: number, size: TextSize = 'normal'): WCAGLevel {
  if (size === 'large') {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3) return 'AA';
    return 'fail';
  }
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

export function generateSuggestions(bgHex: string, minLevel: WCAGLevel = 'AA'): SuggestedColor[] {
  const bg = hexToRGB(bgHex);
  const minRatio = minLevel === 'AAA' ? 7 : minLevel === 'AA' ? 4.5 : 3;

  return COLOR_SEEDS
    .map(seed => {
      const fg = hexToRGB(seed.hex);
      const ratio = contrastRatio(fg, bg);
      const level = wcagLevel(ratio);
      return { ...seed, contrast: ratio, level };
    })
    .filter(s => s.contrast >= minRatio)
    .sort((a, b) => b.contrast - a.contrast);
}

export function autoPickForeground(bgHex: string): string {
  // Pick white or black based on which has better contrast
  const bg = hexToRGB(bgHex);
  const white = contrastRatio({ r: 255, g: 255, b: 255 }, bg);
  const black = contrastRatio({ r: 0, g: 0, b: 0 }, bg);
  return white >= black ? '#ffffff' : '#000000';
}

export function adjustLightnessForContrast(bgHex: string, targetRatio: number): string {
  // Iteratively darken or lighten a candidate color until contrast is met
  const bg = hexToRGB(bgHex);
  const bgL = relativeLuminance(bg);

  // Try dark text first
  for (let l = 10; l >= 0; l -= 1) {
    const candidate = { r: Math.round(l * 25.5), g: Math.round(l * 25.5), b: Math.round(l * 25.5) };
    if (contrastRatio(candidate, bg) >= targetRatio) return rgbToHex(candidate);
  }
  // Try light text
  for (let l = 90; l <= 100; l += 1) {
    const candidate = { r: Math.round(l * 2.55), g: Math.round(l * 2.55), b: Math.round(l * 2.55) };
    if (contrastRatio(candidate, bg) >= targetRatio) return rgbToHex(candidate);
  }
  return bgL > 0.5 ? '#000000' : '#ffffff';
}

export function levelColor(level: WCAGLevel): string {
  switch (level) {
    case 'AAA': return '#22c55e';
    case 'AA': return '#3b82f6';
    case 'AA-large': return '#f59e0b';
    case 'fail': return '#ef4444';
  }
}

export function levelBg(level: WCAGLevel): string {
  switch (level) {
    case 'AAA': return '#22c55e22';
    case 'AA': return '#3b82f622';
    case 'AA-large': return '#f59e0b22';
    case 'fail': return '#ef444422';
  }
}

export function isLightColor(hex: string): boolean {
  return relativeLuminance(hexToRGB(hex)) > 0.5;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onPickForeground?: (hex: string) => void;
}

export function WCAGColorPairGenerator({ open, onClose, onPickForeground }: Props) {
  const [bg, setBg] = useState('#1e293b');
  const [fg, setFg] = useState('#ffffff');
  const [minLevel, setMinLevel] = useState<WCAGLevel>('AA');
  const [filterFamily, setFilterFamily] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const all = generateSuggestions(bg, minLevel);
    return filterFamily ? all.filter(s => s.family === filterFamily) : all;
  }, [bg, minLevel, filterFamily]);

  const manualContrast = useMemo(() => {
    const fgRgb = hexToRGB(fg);
    const bgRgb = hexToRGB(bg);
    return contrastRatio(fgRgb, bgRgb);
  }, [fg, bg]);

  const manualLevel = wcagLevel(manualContrast);

  const copy = useCallback((hex: string) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
    });
  }, []);

  if (!open) return null;

  const panelBg = '#1e1e2e';
  const surface = '#2a2a3e';
  const border = '#3a3a55';
  const accent = '#22c55e';
  const textPrimary = '#e2e8f0';
  const textMuted = '#94a3b8';

  const INPUT_STYLE: React.CSSProperties = {
    background: surface, border: `1px solid ${border}`, borderRadius: 6,
    color: textPrimary, fontSize: 12, padding: '4px 8px', outline: 'none',
  };

  const autoFg = autoPickForeground(bg);
  const bgLight = isLightColor(bg);

  return (
    <div style={{
      position: 'fixed', right: 16, top: 60, width: 420,
      maxHeight: 'calc(100vh - 80px)', background: panelBg,
      border: `1px solid ${border}`, borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', zIndex: 9026,
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px', borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>WCAG Color Pairs</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            {suggestions.length} accessible colors for your background
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: textMuted,
          cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
        }}>×</button>
      </div>

      {/* Background picker */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${border}`,
        background: '#1a1a2e', flexShrink: 0,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* BG color */}
          <div>
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>Background</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 32, height: 28 }}>
                <div style={{ width: 32, height: 28, borderRadius: 6, background: bg, border: `2px solid ${border}` }} />
                <input type="color" value={bg} onChange={e => setBg(e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
              </div>
              <input type="text" value={bg} maxLength={7}
                onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setBg(e.target.value); }}
                style={{ ...INPUT_STYLE, flex: 1, fontFamily: 'monospace' }} />
            </div>
          </div>

          {/* FG color manual test */}
          <div>
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>Test foreground</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 32, height: 28 }}>
                <div style={{ width: 32, height: 28, borderRadius: 6, background: fg, border: `2px solid ${border}` }} />
                <input type="color" value={fg} onChange={e => setFg(e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
              </div>
              <input type="text" value={fg} maxLength={7}
                onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setFg(e.target.value); }}
                style={{ ...INPUT_STYLE, flex: 1, fontFamily: 'monospace' }} />
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div style={{
          marginTop: 12, borderRadius: 10, overflow: 'hidden',
          background: bg, padding: '12px 16px',
          border: `1px solid ${border}`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: fg, marginBottom: 4 }}>
            Heading Text
          </div>
          <div style={{ fontSize: 14, color: fg, opacity: 0.9 }}>
            Body text at 14px. The quick brown fox jumps.
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: levelBg(manualLevel), color: levelColor(manualLevel),
              border: `1px solid ${levelColor(manualLevel)}55`,
            }}>
              {manualLevel} — {manualContrast.toFixed(2)}:1
            </div>
            <button onClick={() => { setFg(autoFg); }}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11,
                background: 'transparent', border: `1px solid ${border}`,
                color: textMuted, cursor: 'pointer',
              }}>Auto ({autoFg})</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        padding: '8px 16px', borderBottom: `1px solid ${border}`,
        display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0, alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: textMuted }}>Min level:</span>
        {(['AA', 'AAA'] as WCAGLevel[]).map(l => (
          <button key={l} onClick={() => setMinLevel(l)} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: minLevel === l ? `${levelColor(l)}22` : 'transparent',
            border: `1px solid ${minLevel === l ? levelColor(l) + '88' : border}`,
            color: minLevel === l ? levelColor(l) : textMuted, cursor: 'pointer',
          }}>{l}</button>
        ))}
        <span style={{ fontSize: 11, color: textMuted, marginLeft: 6 }}>Family:</span>
        <button onClick={() => setFilterFamily(null)} style={{
          padding: '4px 8px', borderRadius: 6, fontSize: 10,
          background: !filterFamily ? `${accent}22` : 'transparent',
          border: `1px solid ${!filterFamily ? accent : border}`,
          color: !filterFamily ? accent : textMuted, cursor: 'pointer',
        }}>All</button>
        {FAMILIES.map(f => (
          <button key={f} onClick={() => setFilterFamily(f === filterFamily ? null : f)} style={{
            padding: '4px 8px', borderRadius: 6, fontSize: 10,
            background: filterFamily === f ? `${accent}22` : 'transparent',
            border: `1px solid ${filterFamily === f ? accent : border}`,
            color: filterFamily === f ? accent : textMuted, cursor: 'pointer',
          }}>{f}</button>
        ))}
      </div>

      {/* Suggestions list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {suggestions.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: 24,
            color: textMuted, fontSize: 13,
          }}>
            No colors meet the selected criteria.<br />
            <span style={{ fontSize: 11 }}>Try lowering the minimum level or changing the background.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {suggestions.map(s => (
              <div key={s.hex} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: surface, border: `1px solid ${border}`,
              }}>
                {/* Color swatch */}
                <div style={{
                  width: 48, height: 32, borderRadius: 6, background: s.hex,
                  border: `1px solid ${border}`, flexShrink: 0,
                }} />

                {/* Preview text */}
                <div style={{
                  flex: 1, background: bg, borderRadius: 6, padding: '4px 8px',
                  border: `1px solid ${border}`,
                }}>
                  <span style={{ color: s.hex, fontSize: 13, fontWeight: 600 }}>
                    Aa
                  </span>
                  <span style={{ color: s.hex, fontSize: 11, marginLeft: 8, opacity: 0.8 }}>
                    {s.name}
                  </span>
                </div>

                {/* Info */}
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 70 }}>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: textPrimary, fontWeight: 700 }}>
                    {s.hex.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 3 }}>
                    <span style={{
                      fontSize: 10, padding: '1px 5px', borderRadius: 4,
                      background: levelBg(s.level), color: levelColor(s.level),
                      border: `1px solid ${levelColor(s.level)}55`, fontWeight: 600,
                    }}>{s.level}</span>
                    <span style={{ fontSize: 10, color: textMuted }}>{s.contrast.toFixed(1)}:1</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => copy(s.hex)} style={{
                    width: 28, height: 22, borderRadius: 4,
                    background: copiedHex === s.hex ? '#22c55e22' : 'transparent',
                    border: `1px solid ${copiedHex === s.hex ? '#22c55e' : border}`,
                    color: copiedHex === s.hex ? '#22c55e' : textMuted,
                    cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  }}>{copiedHex === s.hex ? '✓' : '⎘'}</button>
                  {onPickForeground && (
                    <button onClick={() => onPickForeground(s.hex)} style={{
                      width: 28, height: 22, borderRadius: 4,
                      background: 'transparent', border: `1px solid ${border}`,
                      color: textMuted, cursor: 'pointer', fontSize: 10,
                    }}>↑</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        {suggestions.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 11, color: textMuted, lineHeight: 1.5 }}>
            Showing {suggestions.length} colors with {minLevel}+ contrast against {bg}
          </div>
        )}
      </div>
    </div>
  );
}
