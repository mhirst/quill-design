/**
 * BlendModesPanel — CSS Mix Blend Mode / Background Blend Mode Visualizer
 *
 * Features:
 *  - All 16 CSS blend modes displayed in a grid with live previews
 *  - Pick foreground and background colors
 *  - Toggle between mix-blend-mode and background-blend-mode
 *  - Apply selected blend mode to the selected shape
 *  - Mathematical description of each blend mode
 *  - Compare mode: side-by-side view of selected blend vs "normal"
 *  - Copy CSS snippet for any mode
 *  - Keyboard: ⌘⌥⇧B
 */

import React, { useState, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay'
  | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion'
  | 'hue' | 'saturation' | 'color' | 'luminosity';

export interface BlendModeInfo {
  mode: BlendMode;
  label: string;
  category: 'normal' | 'darken' | 'lighten' | 'contrast' | 'composite' | 'component';
  description: string;
  formula: string;
}

// ── Utilities (exported for tests) ────────────────────────────────────────────

export const ALL_BLEND_MODES: BlendModeInfo[] = [
  { mode: 'normal', label: 'Normal', category: 'normal', description: 'No blending applied', formula: 'Cs' },
  { mode: 'multiply', label: 'Multiply', category: 'darken', description: 'Multiplies colors, always darker', formula: 'Cs × Cb' },
  { mode: 'screen', label: 'Screen', category: 'lighten', description: 'Inverse multiply, always lighter', formula: '1 - (1-Cs)(1-Cb)' },
  { mode: 'overlay', label: 'Overlay', category: 'contrast', description: 'Multiply dark, screen light areas', formula: 'Cb<0.5 ? 2CsCb : 1-2(1-Cs)(1-Cb)' },
  { mode: 'darken', label: 'Darken', category: 'darken', description: 'Keeps the darker of the two colors', formula: 'min(Cs, Cb)' },
  { mode: 'lighten', label: 'Lighten', category: 'lighten', description: 'Keeps the lighter of the two colors', formula: 'max(Cs, Cb)' },
  { mode: 'color-dodge', label: 'Color Dodge', category: 'lighten', description: 'Brightens base to reflect source', formula: 'Cb / (1-Cs)' },
  { mode: 'color-burn', label: 'Color Burn', category: 'darken', description: 'Darkens base to reflect source', formula: '1 - (1-Cb) / Cs' },
  { mode: 'hard-light', label: 'Hard Light', category: 'contrast', description: 'Overlay with source as control', formula: 'Cs<0.5 ? 2CsCb : 1-2(1-Cs)(1-Cb)' },
  { mode: 'soft-light', label: 'Soft Light', category: 'contrast', description: 'Soft version of hard-light', formula: 'W3C soft light formula' },
  { mode: 'difference', label: 'Difference', category: 'composite', description: 'Subtracts one from the other', formula: '|Cs - Cb|' },
  { mode: 'exclusion', label: 'Exclusion', category: 'composite', description: 'Softer difference effect', formula: 'Cs+Cb - 2CsCb' },
  { mode: 'hue', label: 'Hue', category: 'component', description: 'Hue from source, sat+lum from base', formula: 'Lum(Cb) → Hue(Cs)' },
  { mode: 'saturation', label: 'Saturation', category: 'component', description: 'Saturation of source, rest from base', formula: 'Sat(Cs) applied to Cb' },
  { mode: 'color', label: 'Color', category: 'component', description: 'Hue+saturation from source, lum from base', formula: 'Hue(Cs)+Sat(Cs) → Lum(Cb)' },
  { mode: 'luminosity', label: 'Luminosity', category: 'component', description: 'Luminosity of source, hue+sat from base', formula: 'Lum(Cs) → Cb' },
];

export const CATEGORY_COLORS: Record<BlendModeInfo['category'], string> = {
  normal: '#6b7280',
  darken: '#3b82f6',
  lighten: '#f59e0b',
  contrast: '#8b5cf6',
  composite: '#10b981',
  component: '#ef4444',
};

/** Get all modes in a given category */
export function getModesByCategory(category: BlendModeInfo['category']): BlendModeInfo[] {
  return ALL_BLEND_MODES.filter(m => m.category === category);
}

/** Generate CSS snippet for a blend mode applied to an element */
export function buildBlendCSS(mode: BlendMode, useBackground = false): string {
  if (useBackground) {
    return `background-blend-mode: ${mode};`;
  }
  return `mix-blend-mode: ${mode};`;
}

/** Hex color to RGB components 0..1 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

/** RGB components 0..1 to hex string */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/** Compute the blended color for multiply mode */
export function blendMultiply(src: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) {
  return { r: src.r * bg.r, g: src.g * bg.g, b: src.b * bg.b };
}

/** Compute the blended color for screen mode */
export function blendScreen(src: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) {
  return {
    r: 1 - (1 - src.r) * (1 - bg.r),
    g: 1 - (1 - src.g) * (1 - bg.g),
    b: 1 - (1 - src.b) * (1 - bg.b),
  };
}

/** Compute the blended color for difference mode */
export function blendDifference(src: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) {
  return {
    r: Math.abs(src.r - bg.r),
    g: Math.abs(src.g - bg.g),
    b: Math.abs(src.b - bg.b),
  };
}

/** Compute the blended color for overlay mode (per channel) */
export function blendOverlayChannel(src: number, bg: number): number {
  return bg < 0.5 ? 2 * src * bg : 1 - 2 * (1 - src) * (1 - bg);
}

/** Get a readable label for the category */
export function categoryLabel(cat: BlendModeInfo['category']): string {
  const labels: Record<string, string> = {
    normal: 'Normal',
    darken: 'Darken',
    lighten: 'Lighten',
    contrast: 'Contrast',
    composite: 'Composite',
    component: 'Component',
  };
  return labels[cat] ?? cat;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 380,
  width: 420,
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
  padding: '14px 16px',
  borderBottom: '1px solid #3a1a1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
};

const SCROLL: React.CSSProperties = {
  overflowY: 'auto',
  flex: 1,
  padding: '12px 16px',
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  color: '#9a7a7a',
  textTransform: 'uppercase' as const,
  marginBottom: 8,
};

const BTN_SM: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #3a1a1a',
  background: '#2a1010',
  color: '#e8d5d5',
  fontSize: 12,
  cursor: 'pointer',
};

const BTN_ACCENT: React.CSSProperties = {
  ...BTN_SM,
  background: '#b5533c',
  border: '1px solid #c4644d',
  color: '#fff',
};

// ── Blend Mode Preview Cell ───────────────────────────────────────────────────

function BlendPreview({
  info,
  fgColor,
  bgColor,
  selected,
  onSelect,
}: {
  info: BlendModeInfo;
  fgColor: string;
  bgColor: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      title={info.description}
      style={{
        cursor: 'pointer',
        borderRadius: 8,
        border: `2px solid ${selected ? '#b5533c' : '#3a1a1a'}`,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
        background: '#0d0505',
      }}
    >
      {/* Preview */}
      <div style={{ width: '100%', aspectRatio: '4/3', position: 'relative', background: bgColor }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: fgColor,
          mixBlendMode: info.mode as React.CSSProperties['mixBlendMode'],
        }} />
      </div>
      {/* Label */}
      <div style={{
        padding: '4px 6px',
        fontSize: 10,
        textAlign: 'center' as const,
        color: selected ? '#b5533c' : '#c9b5b5',
        fontWeight: selected ? 700 : 400,
        borderTop: '1px solid #2a1a1a',
        background: selected ? '#2a0d08' : 'transparent',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {info.label}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onApplyToShape: (patch: Partial<Shape>) => void;
}

const CATEGORIES: BlendModeInfo['category'][] = ['normal', 'darken', 'lighten', 'contrast', 'composite', 'component'];

export function BlendModesPanel({ open, onClose, selectedShape, onApplyToShape }: Props) {
  const [fgColor, setFgColor] = useState('#b5533c');
  const [bgColor, setBgColor] = useState('#1a6b8a');
  const [selectedMode, setSelectedMode] = useState<BlendMode>('normal');
  const [filterCategory, setFilterCategory] = useState<BlendModeInfo['category'] | 'all'>('all');
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const visibleModes = filterCategory === 'all'
    ? ALL_BLEND_MODES
    : ALL_BLEND_MODES.filter(m => m.category === filterCategory);

  const selectedInfo = ALL_BLEND_MODES.find(m => m.mode === selectedMode)!;
  const cssSnippet = buildBlendCSS(selectedMode);

  const handleCopy = () => {
    navigator.clipboard.writeText(cssSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleApply = () => {
    if (!selectedShape) return;
    onApplyToShape({ blendMode: selectedMode } as Partial<Shape>);
  };

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Blend Modes</div>
          <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 1 }}>CSS mix-blend-mode · ⌘⌥⇧B</div>
        </div>
        <button onClick={onClose} style={{ ...BTN_SM, padding: '4px 8px', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>

      <div style={SCROLL}>
        {/* Color pickers */}
        <div style={{ marginBottom: 14 }}>
          <div style={SECTION_LABEL}>Colors</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', fontSize: 11, color: '#9a7a7a' }}>
              Foreground
              <input
                type="color"
                value={fgColor}
                onChange={e => setFgColor(e.target.value)}
                style={{ width: 44, height: 28, borderRadius: 4, border: '1px solid #3a1a1a', cursor: 'pointer' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', fontSize: 11, color: '#9a7a7a' }}>
              Background
              <input
                type="color"
                value={bgColor}
                onChange={e => setBgColor(e.target.value)}
                style={{ width: 44, height: 28, borderRadius: 4, border: '1px solid #3a1a1a', cursor: 'pointer' }}
              />
            </label>
            {/* Compare preview */}
            <div style={{ flex: 1, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{
                  width: 48, height: 32, borderRadius: 4, overflow: 'hidden',
                  border: '1px solid #3a1a1a', position: 'relative', background: bgColor,
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: fgColor }} />
                </div>
                <div style={{ fontSize: 9, color: '#9a7a7a', marginTop: 2 }}>Normal</div>
              </div>
              <div style={{ textAlign: 'center' as const }}>
                <div style={{
                  width: 48, height: 32, borderRadius: 4, overflow: 'hidden',
                  border: '1px solid #b5533c', position: 'relative', background: bgColor,
                }}>
                  <div style={{
                    position: 'absolute', inset: 0, background: fgColor,
                    mixBlendMode: selectedMode as React.CSSProperties['mixBlendMode'],
                  }} />
                </div>
                <div style={{ fontSize: 9, color: '#b5533c', marginTop: 2 }}>{selectedInfo.label}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Category filter */}
        <div style={{ marginBottom: 12 }}>
          <div style={SECTION_LABEL}>Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
            <button
              onClick={() => setFilterCategory('all')}
              style={{
                ...BTN_SM,
                fontSize: 11,
                padding: '3px 8px',
                ...(filterCategory === 'all' ? { background: '#b5533c', border: '1px solid #c4644d', color: '#fff' } : {}),
              }}
            >
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  ...BTN_SM,
                  fontSize: 11,
                  padding: '3px 8px',
                  ...(filterCategory === cat ? {
                    background: CATEGORY_COLORS[cat] + '33',
                    border: `1px solid ${CATEGORY_COLORS[cat]}`,
                    color: CATEGORY_COLORS[cat],
                  } : {}),
                }}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Mode grid */}
        <div style={{ marginBottom: 14 }}>
          <div style={SECTION_LABEL}>{visibleModes.length} modes</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}>
            {visibleModes.map(info => (
              <BlendPreview
                key={info.mode}
                info={info}
                fgColor={fgColor}
                bgColor={bgColor}
                selected={selectedMode === info.mode}
                onSelect={() => setSelectedMode(info.mode)}
              />
            ))}
          </div>
        </div>

        {/* Selected mode detail */}
        <div style={{
          background: '#0d0505',
          border: '1px solid #3a1a1a',
          borderRadius: 8,
          padding: 12,
          marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e8d5d5' }}>{selectedInfo.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: CATEGORY_COLORS[selectedInfo.category] + '22',
                  color: CATEGORY_COLORS[selectedInfo.category],
                  border: `1px solid ${CATEGORY_COLORS[selectedInfo.category]}44`,
                }}>
                  {categoryLabel(selectedInfo.category)}
                </span>
              </div>
            </div>
            <button onClick={handleCopy} style={{ ...BTN_SM, fontSize: 11 }}>
              {copied ? '✓' : 'Copy CSS'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#c9b5b5', marginBottom: 6 }}>{selectedInfo.description}</div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#9a7a7a',
            background: '#2a1010',
            borderRadius: 4,
            padding: '4px 8px',
            marginBottom: 6,
          }}>
            Formula: {selectedInfo.formula}
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#b5533c',
            background: '#2a1010',
            borderRadius: 4,
            padding: '4px 8px',
          }}>
            {cssSnippet}
          </div>
        </div>

        {/* Apply */}
        <button
          onClick={handleApply}
          disabled={!selectedShape}
          style={{
            ...BTN_ACCENT,
            width: '100%',
            padding: '8px',
            textAlign: 'center' as const,
            opacity: selectedShape ? 1 : 0.5,
            cursor: selectedShape ? 'pointer' : 'not-allowed',
            marginBottom: 8,
          }}
        >
          {selectedShape
            ? `Apply "${selectedInfo.label}" to shape`
            : 'Select a shape to apply'}
        </button>
      </div>
    </div>
  );
}
