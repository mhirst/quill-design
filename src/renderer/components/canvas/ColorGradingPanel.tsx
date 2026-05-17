/**
 * ColorGradingPanel — Lightroom-style color grading for shapes.
 *
 * Exposes all CSS filter properties as sliders with:
 * - Named preset "looks" (Vivid, Matte, Noir, Warm, Cool, Faded, Duotone...)
 * - Individual sliders for Brightness, Contrast, Saturation, Hue, Sepia, Grayscale, Invert, Blur
 * - Live preview on selected shape(s)
 * - Reset individual + reset all
 * - Copy CSS filter string
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

type FilterPatch = {
  filterBrightness?: number;
  filterContrast?: number;
  filterSaturate?: number;
  filterHueRotate?: number;
  filterSepia?: number;
  filterGrayscale?: number;
  filterInvert?: number;
  filterBlur?: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onApply: (ids: string[], patch: FilterPatch) => void;
}

// ── Presets ────────────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  name: string;
  emoji: string;
  patch: FilterPatch;
}

const PRESETS: Preset[] = [
  {
    id: 'vivid',
    name: 'Vivid',
    emoji: '🌈',
    patch: { filterBrightness: 110, filterContrast: 120, filterSaturate: 160 },
  },
  {
    id: 'matte',
    name: 'Matte',
    emoji: '🌫',
    patch: { filterBrightness: 110, filterContrast: 85, filterSaturate: 75 },
  },
  {
    id: 'noir',
    name: 'Noir',
    emoji: '⬛',
    patch: { filterGrayscale: 100, filterContrast: 130, filterBrightness: 90 },
  },
  {
    id: 'warm',
    name: 'Warm',
    emoji: '🔆',
    patch: { filterSepia: 30, filterBrightness: 105, filterSaturate: 120, filterHueRotate: 15 },
  },
  {
    id: 'cool',
    name: 'Cool',
    emoji: '❄',
    patch: { filterBrightness: 100, filterSaturate: 90, filterHueRotate: 200 },
  },
  {
    id: 'faded',
    name: 'Faded',
    emoji: '🌅',
    patch: { filterBrightness: 115, filterContrast: 80, filterSaturate: 60, filterSepia: 15 },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    emoji: '📜',
    patch: { filterSepia: 80, filterBrightness: 105 },
  },
  {
    id: 'duotone-purple',
    name: 'Purple',
    emoji: '💜',
    patch: { filterHueRotate: 260, filterSaturate: 200, filterContrast: 110 },
  },
  {
    id: 'duotone-teal',
    name: 'Teal',
    emoji: '🌊',
    patch: { filterHueRotate: 160, filterSaturate: 180, filterContrast: 110 },
  },
  {
    id: 'overexposed',
    name: 'Bright',
    emoji: '☀',
    patch: { filterBrightness: 145, filterContrast: 90, filterSaturate: 110 },
  },
  {
    id: 'drama',
    name: 'Drama',
    emoji: '🎭',
    patch: { filterContrast: 150, filterSaturate: 130, filterBrightness: 90 },
  },
  {
    id: 'invert',
    name: 'Invert',
    emoji: '⊘',
    patch: { filterInvert: 100 },
  },
  {
    id: 'x-process',
    name: 'X-Pro',
    emoji: '📷',
    patch: { filterContrast: 115, filterSaturate: 140, filterHueRotate: -20, filterSepia: 10 },
  },
  {
    id: 'dreamy',
    name: 'Dreamy',
    emoji: '☁',
    patch: { filterBlur: 2, filterBrightness: 115, filterSaturate: 120, filterContrast: 80 },
  },
  {
    id: 'reset',
    name: 'Reset',
    emoji: '↺',
    patch: {
      filterBrightness: undefined,
      filterContrast: undefined,
      filterSaturate: undefined,
      filterHueRotate: undefined,
      filterSepia: undefined,
      filterGrayscale: undefined,
      filterInvert: undefined,
      filterBlur: undefined,
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function filtersToCss(vals: FilterPatch): string {
  const parts: string[] = [];
  if (vals.filterBrightness !== undefined && vals.filterBrightness !== 100)
    parts.push(`brightness(${vals.filterBrightness}%)`);
  if (vals.filterContrast !== undefined && vals.filterContrast !== 100)
    parts.push(`contrast(${vals.filterContrast}%)`);
  if (vals.filterSaturate !== undefined && vals.filterSaturate !== 100)
    parts.push(`saturate(${vals.filterSaturate}%)`);
  if (vals.filterHueRotate !== undefined && vals.filterHueRotate !== 0)
    parts.push(`hue-rotate(${vals.filterHueRotate}deg)`);
  if (vals.filterSepia !== undefined && vals.filterSepia !== 0)
    parts.push(`sepia(${vals.filterSepia}%)`);
  if (vals.filterGrayscale !== undefined && vals.filterGrayscale !== 0)
    parts.push(`grayscale(${vals.filterGrayscale}%)`);
  if (vals.filterInvert !== undefined && vals.filterInvert !== 0)
    parts.push(`invert(${vals.filterInvert}%)`);
  if (vals.filterBlur !== undefined && vals.filterBlur !== 0)
    parts.push(`blur(${vals.filterBlur}px)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

// ── Slider ─────────────────────────────────────────────────────────────────────

function FilterSlider({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  unit,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  const isDefault = Math.abs(value - defaultValue) < 0.5;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: isDefault ? '#475569' : '#94a3b8' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11,
            fontFamily: 'ui-monospace,monospace',
            color: isDefault ? '#334155' : '#818cf8',
            minWidth: 36,
            textAlign: 'right',
          }}>
            {Math.round(value)}{unit}
          </span>
          {!isDefault && (
            <button
              onClick={onReset}
              title="Reset to default"
              style={{
                background: 'none',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                fontSize: 10,
                padding: '0 2px',
                lineHeight: 1,
              }}
            >
              ↺
            </button>
          )}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        {/* Track background with gradient hint */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          transform: 'translateY(-50%)',
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(to right, rgba(99,102,241,0.5) ${pct}%, rgba(255,255,255,0.06) ${pct}%)`,
          pointerEvents: 'none',
        }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: '100%',
            accentColor: '#6366f1',
            position: 'relative',
            zIndex: 1,
            background: 'transparent',
          }}
        />
      </div>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
      style={{
        padding: '4px 10px',
        fontSize: 10,
        borderRadius: 5,
        border: '1px solid rgba(99,102,241,0.35)',
        background: copied ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
        color: copied ? '#c7d2fe' : '#818cf8',
        cursor: 'pointer',
      }}
    >
      {copied ? '✓ Copied' : 'Copy CSS'}
    </button>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

const DEFAULT_VALS: Required<FilterPatch> = {
  filterBrightness: 100,
  filterContrast: 100,
  filterSaturate: 100,
  filterHueRotate: 0,
  filterSepia: 0,
  filterGrayscale: 0,
  filterInvert: 0,
  filterBlur: 0,
};

export function ColorGradingPanel({
  open,
  onClose,
  selectedShape,
  selectedShapeIds,
  onApply,
}: Props) {
  // Read initial values from selected shape
  const initVals = useMemo<Required<FilterPatch>>(() => ({
    filterBrightness: selectedShape?.filterBrightness ?? 100,
    filterContrast: selectedShape?.filterContrast ?? 100,
    filterSaturate: selectedShape?.filterSaturate ?? 100,
    filterHueRotate: selectedShape?.filterHueRotate ?? 0,
    filterSepia: selectedShape?.filterSepia ?? 0,
    filterGrayscale: selectedShape?.filterGrayscale ?? 0,
    filterInvert: selectedShape?.filterInvert ?? 0,
    filterBlur: selectedShape?.filterBlur ?? 0,
  }), [selectedShape]);

  const [vals, setVals] = useState<Required<FilterPatch>>(initVals);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const getIds = useCallback(() => {
    if (selectedShapeIds.length > 0) return selectedShapeIds;
    if (selectedShape) return [selectedShape.id];
    return [];
  }, [selectedShape, selectedShapeIds]);

  const apply = useCallback((patch: FilterPatch) => {
    const ids = getIds();
    if (ids.length === 0) return;
    onApply(ids, patch);
  }, [getIds, onApply]);

  const setVal = useCallback(<K extends keyof Required<FilterPatch>>(key: K, value: number) => {
    const next = { ...vals, [key]: value };
    setVals(next);
    apply(next);
    setActivePreset(null);
  }, [vals, apply]);

  const resetVal = useCallback(<K extends keyof Required<FilterPatch>>(key: K) => {
    const next = { ...vals, [key]: DEFAULT_VALS[key] };
    setVals(next);
    apply(next);
    setActivePreset(null);
  }, [vals, apply]);

  const applyPreset = useCallback((preset: Preset) => {
    const next: Required<FilterPatch> = { ...DEFAULT_VALS };
    for (const [k, v] of Object.entries(preset.patch)) {
      if (v !== undefined) (next as Record<string, number>)[k] = v;
    }
    setVals(next);
    apply(preset.patch.filterBrightness !== undefined ? next : { ...next });
    setActivePreset(preset.id);
  }, [apply]);

  const resetAll = useCallback(() => {
    setVals(DEFAULT_VALS);
    apply(DEFAULT_VALS);
    setActivePreset('reset');
  }, [apply]);

  const cssFilter = useMemo(() => filtersToCss(vals), [vals]);

  const hasChanges = useMemo(() =>
    Object.entries(vals).some(([k, v]) => v !== DEFAULT_VALS[k as keyof typeof DEFAULT_VALS]),
    [vals]
  );

  if (!open) return null;

  const targetCount = getIds().length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '60px 16px 16px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 280,
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: 'linear-gradient(135deg,rgba(12,12,22,0.98),rgba(18,12,28,0.98))',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          color: '#e2e8f0',
          pointerEvents: 'all',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>🎞 Color Grading</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
              {targetCount > 0 ? `${targetCount} shape${targetCount > 1 ? 's' : ''} selected` : 'No shape selected'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {hasChanges && (
              <button
                onClick={resetAll}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  borderRadius: 5,
                  border: '1px solid rgba(239,68,68,0.25)',
                  background: 'rgba(239,68,68,0.06)',
                  color: '#f87171',
                  cursor: 'pointer',
                }}
              >
                ↺ Reset
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Preset grid */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Presets
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 4,
          }}>
            {PRESETS.filter(p => p.id !== 'reset').map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                title={preset.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '6px 4px',
                  borderRadius: 6,
                  border: `1px solid ${activePreset === preset.id ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.05)'}`,
                  background: activePreset === preset.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 14 }}>{preset.emoji}</span>
                <span style={{
                  fontSize: 8,
                  color: activePreset === preset.id ? '#c7d2fe' : '#475569',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}>
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Fine Tune
          </div>

          <FilterSlider
            label="Brightness"
            value={vals.filterBrightness}
            min={0} max={200} step={1}
            defaultValue={100} unit="%"
            onChange={v => setVal('filterBrightness', v)}
            onReset={() => resetVal('filterBrightness')}
          />
          <FilterSlider
            label="Contrast"
            value={vals.filterContrast}
            min={0} max={200} step={1}
            defaultValue={100} unit="%"
            onChange={v => setVal('filterContrast', v)}
            onReset={() => resetVal('filterContrast')}
          />
          <FilterSlider
            label="Saturation"
            value={vals.filterSaturate}
            min={0} max={200} step={1}
            defaultValue={100} unit="%"
            onChange={v => setVal('filterSaturate', v)}
            onReset={() => resetVal('filterSaturate')}
          />
          <FilterSlider
            label="Hue Rotate"
            value={vals.filterHueRotate}
            min={0} max={360} step={1}
            defaultValue={0} unit="°"
            onChange={v => setVal('filterHueRotate', v)}
            onReset={() => resetVal('filterHueRotate')}
          />

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '8px 0' }} />

          <FilterSlider
            label="Sepia"
            value={vals.filterSepia}
            min={0} max={100} step={1}
            defaultValue={0} unit="%"
            onChange={v => setVal('filterSepia', v)}
            onReset={() => resetVal('filterSepia')}
          />
          <FilterSlider
            label="Grayscale"
            value={vals.filterGrayscale}
            min={0} max={100} step={1}
            defaultValue={0} unit="%"
            onChange={v => setVal('filterGrayscale', v)}
            onReset={() => resetVal('filterGrayscale')}
          />
          <FilterSlider
            label="Invert"
            value={vals.filterInvert}
            min={0} max={100} step={1}
            defaultValue={0} unit="%"
            onChange={v => setVal('filterInvert', v)}
            onReset={() => resetVal('filterInvert')}
          />

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '8px 0' }} />

          <FilterSlider
            label="Blur"
            value={vals.filterBlur}
            min={0} max={20} step={0.5}
            defaultValue={0} unit="px"
            onChange={v => setVal('filterBlur', v)}
            onReset={() => resetVal('filterBlur')}
          />
        </div>

        {/* CSS output */}
        <div style={{
          padding: '0 12px 14px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          paddingTop: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>CSS filter</span>
            <CopyButton text={`filter: ${cssFilter};`} />
          </div>
          <div style={{
            fontSize: 10,
            color: '#64748b',
            fontFamily: 'ui-monospace,monospace',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 6,
            padding: '6px 8px',
            wordBreak: 'break-all',
            lineHeight: 1.6,
          }}>
            {cssFilter}
          </div>
        </div>
      </div>
    </div>
  );
}
