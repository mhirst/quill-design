/**
 * VariableFontExplorerPanel — Interactive variable font axis explorer
 *
 * Features:
 *  - Predefined common variable font axes: wght, wdth, ital, slnt, opsz
 *  - Custom axis support (4-char tag)
 *  - Sliders for each axis with min/max/step from font spec
 *  - Live CSS font-variation-settings output
 *  - Apply to selected text shape
 *  - Preset combinations (Thin, Light, Regular, Medium, Bold, Black, Condensed, Wide)
 *  - Preview text with the current axis settings
 *  - Copy CSS to clipboard
 */

import React, { useState, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FontAxis {
  tag: string;       // 4-char OpenType tag e.g. 'wght'
  name: string;      // Human-readable name
  min: number;
  max: number;
  defaultValue: number;
  step: number;
  value: number;
}

export interface AxisPreset {
  name: string;
  axes: Record<string, number>; // tag → value
}

// ── Utilities (exported for tests) ────────────────────────────────────────────

/** Build font-variation-settings CSS string from axis values */
export function buildVariationSettings(axes: FontAxis[]): string {
  const active = axes.filter(a => a.value !== a.defaultValue || a.tag === 'wght');
  if (active.length === 0) return 'normal';
  return active.map(a => `"${a.tag}" ${a.value}`).join(', ');
}

/** Parse font-variation-settings string into tag→value map */
export function parseVariationSettings(css: string): Record<string, number> {
  if (!css || css.trim() === 'normal') return {};
  const result: Record<string, number> = {};
  const pairs = css.split(',');
  for (const pair of pairs) {
    const m = pair.trim().match(/^["']([a-zA-Z ]{4})["']\s+([\d.-]+)$/);
    if (m) result[m[1]] = Number(m[2]);
  }
  return result;
}

/** Apply a preset to the current axis list */
export function applyPreset(axes: FontAxis[], preset: AxisPreset): FontAxis[] {
  return axes.map(a => ({
    ...a,
    value: preset.axes[a.tag] !== undefined ? preset.axes[a.tag] : a.defaultValue,
  }));
}

/** Clamp a value within axis bounds */
export function clampAxisValue(value: number, axis: FontAxis): number {
  return Math.min(axis.max, Math.max(axis.min, value));
}

/** Build full CSS snippet for a text element */
export function buildFullCSS(axes: FontAxis[], fontFamily: string): string {
  const settings = buildVariationSettings(axes);
  const lines: string[] = [
    `font-family: "${fontFamily}", sans-serif;`,
    `font-variation-settings: ${settings};`,
  ];
  // Add conventional CSS properties where axes map to them
  const wght = axes.find(a => a.tag === 'wght');
  const wdth = axes.find(a => a.tag === 'wdth');
  const ital = axes.find(a => a.tag === 'ital');
  const slnt = axes.find(a => a.tag === 'slnt');
  if (wght) lines.push(`font-weight: ${Math.round(wght.value)};`);
  if (wdth) lines.push(`font-stretch: ${Math.round(wdth.value)}%;`);
  if (ital && ital.value >= 0.5) lines.push(`font-style: italic;`);
  else if (slnt && slnt.value !== 0) lines.push(`font-style: oblique ${slnt.value}deg;`);
  return lines.join('\n');
}

/** Get axis description for tooltip */
export function axisDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    wght: 'Controls font weight from thin (100) to black (900+)',
    wdth: 'Controls font width from condensed (50%) to expanded (200%)',
    ital: 'Switches between upright (0) and italic (1)',
    slnt: 'Controls slant angle in degrees (negative = forward lean)',
    opsz: 'Optimizes letterforms for specific text sizes',
    GRAD: 'Adjusts visual weight without changing metrics',
    XTRA: 'Controls counter width / x-transparent',
    XOPQ: 'Controls x-opaque stroke weight',
    YOPQ: 'Controls y-opaque stroke weight',
    YTLC: 'Controls lowercase letter height',
    YTUC: 'Controls uppercase letter height',
  };
  return descriptions[tag] ?? `OpenType axis tag: ${tag}`;
}

// ── Default axes ──────────────────────────────────────────────────────────────

export const DEFAULT_AXES: FontAxis[] = [
  { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1, value: 400 },
  { tag: 'wdth', name: 'Width', min: 50, max: 200, defaultValue: 100, step: 1, value: 100 },
  { tag: 'ital', name: 'Italic', min: 0, max: 1, defaultValue: 0, step: 0.01, value: 0 },
  { tag: 'slnt', name: 'Slant', min: -15, max: 15, defaultValue: 0, step: 0.1, value: 0 },
  { tag: 'opsz', name: 'Optical Size', min: 8, max: 144, defaultValue: 14, step: 1, value: 14 },
];

export const AXIS_PRESETS: AxisPreset[] = [
  { name: 'Thin', axes: { wght: 100, wdth: 100, ital: 0, slnt: 0 } },
  { name: 'Light', axes: { wght: 300, wdth: 100, ital: 0, slnt: 0 } },
  { name: 'Regular', axes: { wght: 400, wdth: 100, ital: 0, slnt: 0 } },
  { name: 'Medium', axes: { wght: 500, wdth: 100, ital: 0, slnt: 0 } },
  { name: 'SemiBold', axes: { wght: 600, wdth: 100, ital: 0, slnt: 0 } },
  { name: 'Bold', axes: { wght: 700, wdth: 100, ital: 0, slnt: 0 } },
  { name: 'Black', axes: { wght: 900, wdth: 100, ital: 0, slnt: 0 } },
  { name: 'Condensed', axes: { wght: 400, wdth: 75, ital: 0, slnt: 0 } },
  { name: 'Wide', axes: { wght: 400, wdth: 150, ital: 0, slnt: 0 } },
  { name: 'Italic', axes: { wght: 400, wdth: 100, ital: 1, slnt: 0 } },
  { name: 'Bold Italic', axes: { wght: 700, wdth: 100, ital: 1, slnt: 0 } },
  { name: 'Oblique', axes: { wght: 400, wdth: 100, ital: 0, slnt: -12 } },
];

// ── Styles ────────────────────────────────────────────────────────────────────

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

// ── Axis slider row ───────────────────────────────────────────────────────────

function AxisRow({
  axis,
  onChange,
}: {
  axis: FontAxis;
  onChange: (tag: string, value: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8d5d5' }}>{axis.name}</span>
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#9a7a7a',
            background: '#2a1010',
            padding: '1px 5px',
            borderRadius: 3,
          }}>
            {axis.tag}
          </span>
        </div>
        <input
          type="number"
          value={axis.value}
          min={axis.min}
          max={axis.max}
          step={axis.step}
          onChange={e => onChange(axis.tag, clampAxisValue(Number(e.target.value), axis))}
          style={{
            width: 64,
            padding: '2px 6px',
            background: '#2a1010',
            border: '1px solid #3a1a1a',
            borderRadius: 4,
            color: '#e8d5d5',
            fontSize: 12,
            textAlign: 'right' as const,
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: '#9a7a7a', minWidth: 28 }}>{axis.min}</span>
        <input
          type="range"
          min={axis.min}
          max={axis.max}
          step={axis.step}
          value={axis.value}
          onChange={e => onChange(axis.tag, Number(e.target.value))}
          style={{ flex: 1, accentColor: '#b5533c', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 10, color: '#9a7a7a', minWidth: 28, textAlign: 'right' as const }}>{axis.max}</span>
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

export function VariableFontExplorerPanel({ open, onClose, selectedShape, onApplyToShape }: Props) {
  const [axes, setAxes] = useState<FontAxis[]>(() => DEFAULT_AXES.map(a => ({ ...a })));
  const [previewText, setPreviewText] = useState('The quick brown fox');
  const [previewSize, setPreviewSize] = useState(32);
  const [fontFamily, setFontFamily] = useState(
    selectedShape?.fontFamily || 'Inter'
  );
  const [copied, setCopied] = useState(false);
  const [showCustomAxis, setShowCustomAxis] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [customMin, setCustomMin] = useState(0);
  const [customMax, setCustomMax] = useState(100);
  const [customDefault, setCustomDefault] = useState(50);
  const [customName, setCustomName] = useState('');

  const variationSettings = useMemo(() => buildVariationSettings(axes), [axes]);
  const fullCSS = useMemo(() => buildFullCSS(axes, fontFamily), [axes, fontFamily]);

  if (!open) return null;

  const updateAxis = (tag: string, value: number) => {
    setAxes(prev => prev.map(a => a.tag === tag ? { ...a, value } : a));
  };

  const applyPresetHandler = (preset: AxisPreset) => {
    setAxes(prev => applyPreset(prev, preset));
  };

  const resetAll = () => {
    setAxes(DEFAULT_AXES.map(a => ({ ...a })));
  };

  const handleApply = () => {
    if (!selectedShape) return;
    onApplyToShape({
      fontFamily,
      fontVariationSettings: variationSettings,
    } as Partial<Shape>);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fullCSS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const addCustomAxis = () => {
    if (!customTag.trim() || axes.find(a => a.tag === customTag)) return;
    const tag = customTag.trim().padEnd(4, ' ').slice(0, 4);
    setAxes(prev => [...prev, {
      tag,
      name: customName || tag.trim(),
      min: customMin,
      max: customMax,
      defaultValue: customDefault,
      step: 1,
      value: customDefault,
    }]);
    setCustomTag('');
    setCustomName('');
    setShowCustomAxis(false);
  };

  const removeAxis = (tag: string) => {
    if (DEFAULT_AXES.find(a => a.tag === tag)) return; // can't remove built-ins
    setAxes(prev => prev.filter(a => a.tag !== tag));
  };

  const wghtAxis = axes.find(a => a.tag === 'wght');
  const wdthAxis = axes.find(a => a.tag === 'wdth');
  const italAxis = axes.find(a => a.tag === 'ital');
  const slntAxis = axes.find(a => a.tag === 'slnt');

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e8d5d5' }}>Variable Font Explorer</div>
          <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 1 }}>
            Adjust axes · ⌘⌥⇧V
          </div>
        </div>
        <button onClick={onClose} style={{ ...BTN_SM, padding: '4px 8px', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>

      <div style={SCROLL}>
        {/* Preview */}
        <div style={{ marginBottom: 16 }}>
          <div style={SECTION_LABEL}>Preview</div>
          <div style={{
            background: '#0d0505',
            border: '1px solid #3a1a1a',
            borderRadius: 8,
            padding: '16px 12px',
            marginBottom: 8,
            minHeight: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              fontFamily: `"${fontFamily}", system-ui, sans-serif`,
              fontVariationSettings: variationSettings,
              fontSize: previewSize,
              color: '#e8d5d5',
              fontWeight: wghtAxis?.value ?? 400,
              fontStyle: italAxis && italAxis.value >= 0.5 ? 'italic' : (slntAxis && slntAxis.value !== 0 ? `oblique ${slntAxis.value}deg` : 'normal'),
              fontStretch: wdthAxis ? `${wdthAxis.value}%` : 'normal',
              lineHeight: 1.2,
              textAlign: 'center' as const,
              wordBreak: 'break-word' as const,
              maxWidth: '100%',
              transition: 'all 0.1s ease',
            }}>
              {previewText}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={previewText}
              onChange={e => setPreviewText(e.target.value)}
              placeholder="Preview text..."
              style={{
                flex: 1,
                padding: '4px 8px',
                background: '#2a1010',
                border: '1px solid #3a1a1a',
                borderRadius: 6,
                color: '#e8d5d5',
                fontSize: 12,
              }}
            />
            <input
              type="number"
              value={previewSize}
              min={8}
              max={120}
              onChange={e => setPreviewSize(Number(e.target.value))}
              style={{
                width: 52,
                padding: '4px 6px',
                background: '#2a1010',
                border: '1px solid #3a1a1a',
                borderRadius: 6,
                color: '#e8d5d5',
                fontSize: 12,
                textAlign: 'right' as const,
              }}
            />
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: '#9a7a7a' }}>px</span>
          </div>
        </div>

        {/* Font family */}
        <div style={{ marginBottom: 16 }}>
          <div style={SECTION_LABEL}>Font Family</div>
          <input
            value={fontFamily}
            onChange={e => setFontFamily(e.target.value)}
            placeholder="Font name..."
            style={{
              width: '100%',
              padding: '6px 10px',
              background: '#2a1010',
              border: '1px solid #3a1a1a',
              borderRadius: 6,
              color: '#e8d5d5',
              fontSize: 13,
              boxSizing: 'border-box' as const,
            }}
          />
        </div>

        {/* Presets */}
        <div style={{ marginBottom: 16 }}>
          <div style={SECTION_LABEL}>Presets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {AXIS_PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => applyPresetHandler(preset)}
                style={{
                  ...BTN_SM,
                  fontSize: 11,
                  padding: '3px 8px',
                }}
              >
                {preset.name}
              </button>
            ))}
            <button
              onClick={resetAll}
              style={{
                ...BTN_SM,
                fontSize: 11,
                padding: '3px 8px',
                color: '#ff6b6b',
                borderColor: '#4a1a1a',
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Axes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={SECTION_LABEL}>Axes</div>
            <button
              onClick={() => setShowCustomAxis(v => !v)}
              style={{ ...BTN_SM, fontSize: 11, padding: '2px 8px' }}
            >
              + Custom
            </button>
          </div>

          {showCustomAxis && (
            <div style={{
              background: '#2a1010',
              border: '1px solid #3a1a1a',
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 11, color: '#9a7a7a', marginBottom: 8 }}>Add Custom Axis</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <input
                  value={customTag}
                  onChange={e => setCustomTag(e.target.value.slice(0, 4))}
                  placeholder="Tag (4 chars)"
                  maxLength={4}
                  style={{ padding: '4px 8px', background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 4, color: '#e8d5d5', fontSize: 12 }}
                />
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Display name"
                  style={{ padding: '4px 8px', background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 4, color: '#e8d5d5', fontSize: 12 }}
                />
                <input type="number" placeholder="Min" value={customMin} onChange={e => setCustomMin(Number(e.target.value))}
                  style={{ padding: '4px 8px', background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 4, color: '#e8d5d5', fontSize: 12 }} />
                <input type="number" placeholder="Max" value={customMax} onChange={e => setCustomMax(Number(e.target.value))}
                  style={{ padding: '4px 8px', background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 4, color: '#e8d5d5', fontSize: 12 }} />
              </div>
              <button onClick={addCustomAxis} style={{ ...BTN_ACCENT, width: '100%', textAlign: 'center' as const }}>
                Add Axis
              </button>
            </div>
          )}

          {axes.map(axis => (
            <div key={axis.tag} style={{ position: 'relative' }}>
              <AxisRow axis={axis} onChange={updateAxis} />
              {!DEFAULT_AXES.find(a => a.tag === axis.tag) && (
                <button
                  onClick={() => removeAxis(axis.tag)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: 'none',
                    border: 'none',
                    color: '#ff6b6b',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* CSS Output */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={SECTION_LABEL}>CSS Output</div>
            <button onClick={handleCopy} style={{ ...BTN_SM, fontSize: 11, padding: '2px 8px' }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre style={{
            background: '#0d0505',
            border: '1px solid #3a1a1a',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 11,
            color: '#c9b5b5',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap' as const,
            wordBreak: 'break-all' as const,
            margin: 0,
          }}>
            {fullCSS}
          </pre>
        </div>

        {/* Apply button */}
        <div style={{ paddingBottom: 8 }}>
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
            }}
          >
            {selectedShape ? `Apply to "${selectedShape.name || selectedShape.type}"` : 'No shape selected'}
          </button>
        </div>
      </div>
    </div>
  );
}
