/**
 * VariableFontPanel — Interactive CSS variable font axis controls.
 *
 * Exposes registered axes (wght, wdth, slnt, opsz, GRAD, CRSV, etc.)
 * and popular variable Google Fonts with preloading.
 *
 * Applies `fontVariationSettings` and `fontWeight` to selected text shapes.
 *
 * Shortcut: Cmd+Shift+Alt+V
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VFAxis {
  tag: string;          // 4-char OpenType axis tag, e.g. 'wght'
  name: string;         // Human-readable name
  min: number;
  max: number;
  defaultValue: number;
  step?: number;
  description: string;
}

interface VFFont {
  name: string;         // font-family value
  displayName: string;
  axes: VFAxis[];
  googleFont: boolean;
  previewText?: string;
  category: 'sans' | 'serif' | 'mono' | 'display';
}

// ── Font Database ─────────────────────────────────────────────────────────────

const VARIABLE_FONTS: VFFont[] = [
  {
    name: 'Inter',
    displayName: 'Inter',
    category: 'sans',
    googleFont: true,
    previewText: 'The quick brown fox',
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1, description: 'Font weight from Thin to Black' },
    ],
  },
  {
    name: 'Roboto Flex',
    displayName: 'Roboto Flex',
    category: 'sans',
    googleFont: true,
    previewText: 'Aa Bb Cc 0123',
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1, description: 'Font weight' },
      { tag: 'wdth', name: 'Width', min: 25, max: 151, defaultValue: 100, step: 1, description: 'Condensed to Extended' },
      { tag: 'slnt', name: 'Slant', min: -10, max: 0, defaultValue: 0, step: 0.1, description: 'Upright to Slanted' },
      { tag: 'opsz', name: 'Optical Size', min: 8, max: 144, defaultValue: 14, step: 1, description: 'Optimized for display size' },
      { tag: 'GRAD', name: 'Grade', min: -200, max: 150, defaultValue: 0, step: 1, description: 'Adjust weight without changing width' },
      { tag: 'XTRA', name: 'Counter Width', min: 323, max: 603, defaultValue: 468, step: 1, description: 'Inner counter spacing' },
      { tag: 'YOPQ', name: 'Thin Stroke', min: 25, max: 135, defaultValue: 79, step: 1, description: 'Thin stroke contrast' },
    ],
  },
  {
    name: 'Fraunces',
    displayName: 'Fraunces',
    category: 'serif',
    googleFont: true,
    previewText: 'Elegant Display Type',
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1, description: 'Font weight' },
      { tag: 'opsz', name: 'Optical Size', min: 9, max: 144, defaultValue: 12, step: 1, description: 'Optimized for optical size' },
      { tag: 'WONK', name: 'Wonk', min: 0, max: 1, defaultValue: 0, step: 1, description: 'Toggle "wonky" character alternates' },
      { tag: 'SOFT', name: 'Softness', min: 0, max: 100, defaultValue: 0, step: 1, description: 'Soften sharp terminal strokes' },
    ],
  },
  {
    name: 'Recursive',
    displayName: 'Recursive',
    category: 'mono',
    googleFont: true,
    previewText: 'code { display: flex; }',
    axes: [
      { tag: 'wght', name: 'Weight', min: 300, max: 1000, defaultValue: 400, step: 1, description: 'Font weight' },
      { tag: 'MONO', name: 'Monospace', min: 0, max: 1, defaultValue: 0, step: 0.01, description: '0 = proportional, 1 = monospace' },
      { tag: 'CASL', name: 'Casual', min: 0, max: 1, defaultValue: 0, step: 0.01, description: '0 = linear, 1 = casual/script' },
      { tag: 'CRSV', name: 'Cursive', min: 0, max: 1, defaultValue: 0.5, step: 0.01, description: '0 = roman, 1 = cursive' },
      { tag: 'slnt', name: 'Slant', min: -15, max: 0, defaultValue: 0, step: 0.1, description: 'Upright to slanted' },
    ],
  },
  {
    name: 'Playfair Display',
    displayName: 'Playfair Display',
    category: 'serif',
    googleFont: true,
    previewText: 'Headline Typography',
    axes: [
      { tag: 'wght', name: 'Weight', min: 400, max: 900, defaultValue: 400, step: 1, description: 'Font weight' },
    ],
  },
  {
    name: 'Syne',
    displayName: 'Syne',
    category: 'display',
    googleFont: true,
    previewText: 'UNIQUE & BOLD',
    axes: [
      { tag: 'wght', name: 'Weight', min: 400, max: 800, defaultValue: 400, step: 1, description: 'Font weight' },
    ],
  },
  {
    name: 'Anybody',
    displayName: 'Anybody',
    category: 'display',
    googleFont: true,
    previewText: 'Wide World Display',
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1, description: 'Font weight' },
      { tag: 'wdth', name: 'Width', min: 50, max: 150, defaultValue: 100, step: 1, description: 'Condensed to Extended' },
    ],
  },
  {
    name: 'Source Sans 3',
    displayName: 'Source Sans 3',
    category: 'sans',
    googleFont: true,
    previewText: 'Clean & Readable',
    axes: [
      { tag: 'wght', name: 'Weight', min: 200, max: 900, defaultValue: 400, step: 1, description: 'Font weight' },
    ],
  },
  {
    name: 'Raleway',
    displayName: 'Raleway',
    category: 'sans',
    googleFont: true,
    previewText: 'Stylish Sans Serif',
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1, description: 'Font weight' },
    ],
  },
  {
    name: 'Montserrat',
    displayName: 'Montserrat',
    category: 'sans',
    googleFont: true,
    previewText: 'Modern Geometric',
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1, description: 'Font weight' },
    ],
  },
  {
    name: 'Nunito',
    displayName: 'Nunito',
    category: 'sans',
    googleFont: true,
    previewText: 'Friendly & Round',
    axes: [
      { tag: 'wght', name: 'Weight', min: 200, max: 1000, defaultValue: 400, step: 1, description: 'Font weight' },
    ],
  },
  {
    name: 'JetBrains Mono',
    displayName: 'JetBrains Mono',
    category: 'mono',
    googleFont: true,
    previewText: 'const x = fn();',
    axes: [
      { tag: 'wght', name: 'Weight', min: 100, max: 800, defaultValue: 400, step: 1, description: 'Font weight' },
    ],
  },
];

// Style expression presets (combos of axes)
const EXPRESSION_PRESETS = [
  { id: 'thin', name: 'Thin', wght: 100, icon: '🪶', description: 'Ultra-thin, airy' },
  { id: 'light', name: 'Light', wght: 300, icon: '✨', description: 'Light and elegant' },
  { id: 'regular', name: 'Regular', wght: 400, icon: '📝', description: 'Body text default' },
  { id: 'medium', name: 'Medium', wght: 500, icon: '⚖️', description: 'Slightly emphasized' },
  { id: 'semibold', name: 'Semibold', wght: 600, icon: '💪', description: 'Strong headings' },
  { id: 'bold', name: 'Bold', wght: 700, icon: '🔴', description: 'High impact' },
  { id: 'extrabold', name: 'Extra Bold', wght: 800, icon: '⚡', description: 'Display hero' },
  { id: 'black', name: 'Black', wght: 900, icon: '🏋️', description: 'Maximum weight' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildVariationSettings(axes: VFAxis[], values: Record<string, number>): string {
  return axes
    .map((axis) => `"${axis.tag}" ${values[axis.tag] ?? axis.defaultValue}`)
    .join(', ');
}

// ── Font loading ──────────────────────────────────────────────────────────────

const loadedFonts = new Set<string>();

function loadGoogleFont(fontName: string): void {
  if (loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  const encoded = encodeURIComponent(fontName);
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:ital,opsz,wght@0,8..144,100..900;1,8..144,100..900&display=swap`;
  document.head.appendChild(link);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onUpdate: (ids: string[], patch: Partial<Shape>) => void;
}

export function VariableFontPanel({ open, onClose, selectedShape, selectedShapeIds, onUpdate }: Props) {
  const [selectedFont, setSelectedFont] = useState<VFFont>(VARIABLE_FONTS[0]);
  const [axisValues, setAxisValues] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<'all' | 'sans' | 'serif' | 'mono' | 'display'>('all');
  const [previewText, setPreviewText] = useState('The quick brown fox jumps');
  const [previewSize, setPreviewSize] = useState(32);
  const [fontsLoaded, setFontsLoaded] = useState<Record<string, boolean>>({});
  const prevFontRef = useRef<string>('');

  const ids = selectedShapeIds.length > 0
    ? selectedShapeIds
    : selectedShape ? [selectedShape.id] : [];
  const hasTextSelection = ids.length > 0 &&
    (selectedShape?.type === 'text' || selectedShapeIds.some(() => true));

  // Initialize axis values when font changes
  useEffect(() => {
    if (prevFontRef.current === selectedFont.name) return;
    prevFontRef.current = selectedFont.name;
    const initial: Record<string, number> = {};
    for (const axis of selectedFont.axes) {
      initial[axis.tag] = axis.defaultValue;
    }
    setAxisValues(initial);
  }, [selectedFont]);

  // Load Google Font when selected
  useEffect(() => {
    if (selectedFont.googleFont) {
      loadGoogleFont(selectedFont.name);
      // Mark as loading and then loaded after a delay
      setTimeout(() => {
        setFontsLoaded((prev) => ({ ...prev, [selectedFont.name]: true }));
      }, 800);
    }
  }, [selectedFont]);

  const handleAxisChange = useCallback((tag: string, value: number) => {
    setAxisValues((prev) => ({ ...prev, [tag]: value }));
  }, []);

  const applyToSelection = useCallback(() => {
    if (!hasTextSelection || ids.length === 0) return;
    const variationSettings = buildVariationSettings(selectedFont.axes, axisValues);
    const wght = axisValues['wght'];
    const patch: Partial<Shape> = {
      fontFamily: selectedFont.name,
      fontVariationSettings: variationSettings,
    };
    if (wght !== undefined) {
      patch.fontWeight = String(Math.round(wght));
    }
    onUpdate(ids, patch);
  }, [hasTextSelection, ids, selectedFont, axisValues, onUpdate]);

  const applyPreset = useCallback((preset: typeof EXPRESSION_PRESETS[0]) => {
    if (!hasTextSelection || ids.length === 0) return;
    const newValues = { ...axisValues, wght: preset.wght };
    setAxisValues(newValues);
    const variationSettings = buildVariationSettings(selectedFont.axes, newValues);
    onUpdate(ids, {
      fontFamily: selectedFont.name,
      fontWeight: String(preset.wght),
      fontVariationSettings: variationSettings,
    });
  }, [hasTextSelection, ids, axisValues, selectedFont, onUpdate]);

  if (!open) return null;

  const filteredFonts = VARIABLE_FONTS.filter(
    (f) => activeCategory === 'all' || f.category === activeCategory,
  );

  const variationSettings = buildVariationSettings(selectedFont.axes, axisValues);
  const previewStyle: React.CSSProperties = {
    fontFamily: `"${selectedFont.name}", sans-serif`,
    fontVariationSettings: variationSettings,
    fontWeight: axisValues['wght'] ?? selectedFont.axes.find((a) => a.tag === 'wght')?.defaultValue ?? 400,
    fontSize: previewSize,
    lineHeight: 1.2,
    color: 'var(--text, #e2e8f0)',
    letterSpacing: '-0.01em',
    transition: 'all 0.15s ease',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        right: 340,
        width: 340,
        maxHeight: 'calc(100vh - 80px)',
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        zIndex: 310,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #e2e8f0)' }}>
            𝑓 Variable Font Studio
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
            {hasTextSelection ? `${ids.length} text shape${ids.length > 1 ? 's' : ''} selected` : 'Select a text shape'}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 4, borderRadius: 4 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Live Preview */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border, #2d2d3d)', background: 'var(--canvas-bg, #0f0f17)' }}>
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setPreviewText(e.currentTarget.textContent || '')}
            style={{ ...previewStyle, outline: 'none', minHeight: 48, cursor: 'text', wordBreak: 'break-word' }}
          >
            {selectedFont.previewText ?? previewText}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Size</span>
            <input type="range" min={12} max={96} step={2} value={previewSize} onChange={(e) => setPreviewSize(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent, #6366f1)', cursor: 'pointer' }} />
            <span style={{ fontSize: 10, color: 'var(--text, #e2e8f0)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{previewSize}px</span>
          </div>
          {/* variation settings readout */}
          <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 8, color: 'var(--subtle, #444)', lineHeight: 1.5, userSelect: 'all', wordBreak: 'break-all' }}>
            font-variation-settings: {variationSettings};
          </div>
        </div>

        {/* Expression Presets */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Weight Presets
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {EXPRESSION_PRESETS.map((preset) => {
              const hasWght = selectedFont.axes.some((a) => a.tag === 'wght');
              if (!hasWght) return null;
              const axis = selectedFont.axes.find((a) => a.tag === 'wght');
              if (!axis) return null;
              if (preset.wght < axis.min || preset.wght > axis.max) return null;
              const isActive = Math.abs((axisValues['wght'] ?? axis.defaultValue) - preset.wght) < 1;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  title={preset.description}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'var(--accent, #6366f1)' : 'var(--panel-alt, #252535)',
                    border: isActive ? 'none' : '1px solid var(--border, #2d2d3d)',
                    color: isActive ? '#fff' : 'var(--muted, #888)',
                    cursor: 'pointer',
                    fontFamily: `"${selectedFont.name}", sans-serif`,
                    fontVariationSettings: `"wght" ${preset.wght}`,
                  }}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Axis controls */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Font Axes — {selectedFont.displayName}
          </div>
          {selectedFont.axes.map((axis) => {
            const value = axisValues[axis.tag] ?? axis.defaultValue;
            const pct = (value - axis.min) / (axis.max - axis.min);
            const hue = Math.round(pct * 240); // blue–red for visual feedback
            return (
              <div key={axis.tag}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text, #e2e8f0)' }}>
                    <code style={{ fontSize: 9, background: 'var(--panel-alt, #252535)', padding: '1px 4px', borderRadius: 3, color: '#a5f3fc', marginRight: 4 }}>
                      {axis.tag}
                    </code>
                    {axis.name}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text, #e2e8f0)', fontVariantNumeric: 'tabular-nums' }}>
                    {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="range"
                    min={axis.min}
                    max={axis.max}
                    step={axis.step ?? 1}
                    value={value}
                    onChange={(e) => handleAxisChange(axis.tag, Number(e.target.value))}
                    style={{ flex: 1, accentColor: `hsl(${hue}, 70%, 60%)`, cursor: 'pointer' }}
                  />
                  <input
                    type="number"
                    min={axis.min}
                    max={axis.max}
                    step={axis.step ?? 1}
                    value={value}
                    onChange={(e) => handleAxisChange(axis.tag, Number(e.target.value))}
                    style={{ width: 52, background: 'var(--input-bg, #13131f)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, padding: '2px 4px', fontSize: 10, color: 'var(--text, #e2e8f0)', textAlign: 'right', outline: 'none' }}
                  />
                </div>
                <div style={{ fontSize: 9, color: 'var(--subtle, #444)', marginTop: 2 }}>
                  {axis.description} · {axis.min}–{axis.max}
                </div>
              </div>
            );
          })}
        </div>

        {/* Apply button */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <button
            onClick={applyToSelection}
            disabled={!hasTextSelection}
            style={{
              width: '100%',
              padding: '8px 0',
              background: hasTextSelection ? 'var(--accent, #6366f1)' : 'var(--panel-alt, #252535)',
              border: 'none',
              borderRadius: 8,
              color: hasTextSelection ? '#fff' : 'var(--muted, #888)',
              fontSize: 12,
              fontWeight: 700,
              cursor: hasTextSelection ? 'pointer' : 'not-allowed',
              transition: 'all 0.12s',
            }}
          >
            {hasTextSelection ? `Apply to ${ids.length} text shape${ids.length > 1 ? 's' : ''}` : 'Select a text shape to apply'}
          </button>
          {hasTextSelection && (
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', textAlign: 'center', marginTop: 4 }}>
              Sets fontFamily + font-variation-settings
            </div>
          )}
        </div>

        {/* Font selector */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Variable Fonts
          </div>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'sans', 'serif', 'mono', 'display'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '2px 7px', borderRadius: 20, fontSize: 9, fontWeight: 600,
                  background: activeCategory === cat ? 'var(--accent, #6366f1)' : 'transparent',
                  border: activeCategory === cat ? 'none' : '1px solid var(--border, #2d2d3d)',
                  color: activeCategory === cat ? '#fff' : 'var(--muted, #888)',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Font list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filteredFonts.map((font) => {
              const isActive = selectedFont.name === font.name;
              const wghtAxis = font.axes.find((a) => a.tag === 'wght');
              return (
                <button
                  key={font.name}
                  onClick={() => {
                    setSelectedFont(font);
                    loadGoogleFont(font.name);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    background: isActive ? 'rgba(99,102,241,0.12)' : 'var(--panel-alt, #252535)',
                    border: isActive ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border, #2d2d3d)',
                    borderRadius: 7,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        fontFamily: `"${font.name}", sans-serif`,
                        fontVariationSettings: `"wght" ${wghtAxis?.defaultValue ?? 400}`,
                        fontSize: 14,
                        color: 'var(--text, #e2e8f0)',
                        lineHeight: 1,
                      }}
                    >
                      {font.displayName}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--muted, #888)' }}>
                      {font.axes.length} axis{font.axes.length > 1 ? 'es' : ''} ·{' '}
                      {font.axes.map((a) => a.tag).join(', ')}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: `"${font.name}", sans-serif`,
                      fontVariationSettings: `"wght" ${wghtAxis?.max ?? 700}`,
                      fontSize: 11,
                      color: isActive ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                      flexShrink: 0,
                    }}
                  >
                    Aa
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border, #2d2d3d)', fontSize: 10, color: 'var(--muted, #888)', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>{VARIABLE_FONTS.length} variable fonts · {filteredFonts.length} shown</span>
        <span>⌘⇧⌥V</span>
      </div>
    </div>
  );
}
