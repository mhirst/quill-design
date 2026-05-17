/**
 * ShadowStudioPanel — Multi-layer shadow editor.
 *
 * A full visual shadow studio with:
 * - Multiple shadow layers (add/remove/reorder)
 * - Per-layer controls: X, Y, Blur, Spread, Color, Inset toggle
 * - Live CSS preview element showing the combined shadow effect
 * - Preset shadow collections (Elevated, Brutal, Glow, Neumorphic, etc.)
 * - Copy CSS output (box-shadow string)
 * - Apply to selected shape(s) via `shadows[]` property
 *
 * The preview square renders in a dark panel so shadows are clearly visible.
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { Shape, ShadowDef } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onApply: (ids: string[], shadows: ShadowDef[]) => void;
}

type LayeredShadow = ShadowDef & { id: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2, 8); }

function shadowsToCss(shadows: ShadowDef[]): string {
  if (shadows.length === 0) return 'none';
  return shadows.map(s => {
    const parts = [
      s.inset ? 'inset' : '',
      `${s.x}px`,
      `${s.y}px`,
      `${s.blur}px`,
      `${(s.spread ?? 0)}px`,
      s.color,
    ].filter(Boolean);
    return parts.join(' ');
  }).join(', ');
}

function defaultLayer(overrides: Partial<ShadowDef> = {}): LayeredShadow {
  return {
    id: genId(),
    x: 0,
    y: 8,
    blur: 24,
    spread: 0,
    color: 'rgba(0,0,0,0.3)',
    inset: false,
    ...overrides,
  };
}

// ── Presets ────────────────────────────────────────────────────────────────────

interface ShadowPreset {
  id: string;
  name: string;
  emoji: string;
  shadows: ShadowDef[];
}

const SHADOW_PRESETS: ShadowPreset[] = [
  {
    id: 'sm',
    name: 'Small',
    emoji: '·',
    shadows: [{ x: 0, y: 1, blur: 3, spread: 0, color: 'rgba(0,0,0,0.12)' }],
  },
  {
    id: 'md',
    name: 'Medium',
    emoji: '▪',
    shadows: [
      { x: 0, y: 4, blur: 6, spread: -1, color: 'rgba(0,0,0,0.1)' },
      { x: 0, y: 2, blur: 4, spread: -1, color: 'rgba(0,0,0,0.06)' },
    ],
  },
  {
    id: 'lg',
    name: 'Large',
    emoji: '■',
    shadows: [
      { x: 0, y: 10, blur: 15, spread: -3, color: 'rgba(0,0,0,0.1)' },
      { x: 0, y: 4, blur: 6, spread: -2, color: 'rgba(0,0,0,0.05)' },
    ],
  },
  {
    id: 'xl',
    name: 'XL',
    emoji: '▮',
    shadows: [
      { x: 0, y: 20, blur: 25, spread: -5, color: 'rgba(0,0,0,0.1)' },
      { x: 0, y: 10, blur: 10, spread: -5, color: 'rgba(0,0,0,0.04)' },
    ],
  },
  {
    id: 'floating',
    name: 'Floating',
    emoji: '⬆',
    shadows: [
      { x: 0, y: 32, blur: 64, spread: -12, color: 'rgba(0,0,0,0.25)' },
      { x: 0, y: 16, blur: 32, spread: -8, color: 'rgba(0,0,0,0.15)' },
    ],
  },
  {
    id: 'brutal',
    name: 'Brutal',
    emoji: '▣',
    shadows: [
      { x: 4, y: 4, blur: 0, spread: 0, color: '#000000' },
      { x: 8, y: 8, blur: 0, spread: 0, color: 'rgba(0,0,0,0.3)' },
    ],
  },
  {
    id: 'glow-purple',
    name: 'Purple Glow',
    emoji: '💜',
    shadows: [
      { x: 0, y: 0, blur: 20, spread: 5, color: 'rgba(99,102,241,0.6)' },
      { x: 0, y: 0, blur: 40, spread: 10, color: 'rgba(99,102,241,0.3)' },
    ],
  },
  {
    id: 'glow-teal',
    name: 'Teal Glow',
    emoji: '🌊',
    shadows: [
      { x: 0, y: 0, blur: 20, spread: 5, color: 'rgba(20,184,166,0.6)' },
      { x: 0, y: 0, blur: 40, spread: 10, color: 'rgba(20,184,166,0.3)' },
    ],
  },
  {
    id: 'glow-gold',
    name: 'Gold Glow',
    emoji: '✨',
    shadows: [
      { x: 0, y: 0, blur: 15, spread: 3, color: 'rgba(245,158,11,0.7)' },
      { x: 0, y: 0, blur: 30, spread: 8, color: 'rgba(245,158,11,0.3)' },
    ],
  },
  {
    id: 'glow-red',
    name: 'Red Glow',
    emoji: '🔴',
    shadows: [
      { x: 0, y: 0, blur: 20, spread: 4, color: 'rgba(239,68,68,0.6)' },
      { x: 0, y: 0, blur: 40, spread: 10, color: 'rgba(239,68,68,0.3)' },
    ],
  },
  {
    id: 'neumorphic-light',
    name: 'Neumorphic L',
    emoji: '○',
    shadows: [
      { x: 6, y: 6, blur: 12, spread: 0, color: 'rgba(0,0,0,0.15)' },
      { x: -6, y: -6, blur: 12, spread: 0, color: 'rgba(255,255,255,0.8)' },
    ],
  },
  {
    id: 'neumorphic-dark',
    name: 'Neumorphic D',
    emoji: '●',
    shadows: [
      { x: 5, y: 5, blur: 10, spread: 0, color: 'rgba(0,0,0,0.5)' },
      { x: -5, y: -5, blur: 10, spread: 0, color: 'rgba(255,255,255,0.05)' },
    ],
  },
  {
    id: 'inset-deep',
    name: 'Inset Deep',
    emoji: '◉',
    shadows: [
      { x: 0, y: 4, blur: 8, spread: 0, color: 'rgba(0,0,0,0.3)', inset: true },
      { x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(0,0,0,0.2)', inset: true },
    ],
  },
  {
    id: 'soft-lift',
    name: 'Soft Lift',
    emoji: '↑',
    shadows: [
      { x: 0, y: 2, blur: 4, spread: 0, color: 'rgba(0,0,0,0.06)' },
      { x: 0, y: 8, blur: 16, spread: -4, color: 'rgba(0,0,0,0.12)' },
      { x: 0, y: 24, blur: 48, spread: -12, color: 'rgba(0,0,0,0.08)' },
    ],
  },
  {
    id: 'none',
    name: 'No Shadow',
    emoji: '×',
    shadows: [],
  },
];

// ── Color picker helper ───────────────────────────────────────────────────────

const QUICK_COLORS = [
  'rgba(0,0,0,0.3)',
  'rgba(0,0,0,0.5)',
  'rgba(0,0,0,0.8)',
  'rgba(255,255,255,0.3)',
  'rgba(99,102,241,0.6)',
  'rgba(20,184,166,0.6)',
  'rgba(245,158,11,0.7)',
  'rgba(239,68,68,0.6)',
  'rgba(236,72,153,0.6)',
  '#000000',
  '#ffffff',
  '#6366f1',
];

// ── Shadow Layer Row ──────────────────────────────────────────────────────────

function ShadowLayerRow({
  shadow,
  index,
  total,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  shadow: LayeredShadow;
  index: number;
  total: number;
  onUpdate: (s: Partial<ShadowDef>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8,
      background: 'rgba(255,255,255,0.02)',
      marginBottom: 6,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        cursor: 'pointer',
      }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Color swatch */}
        <div style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: shadow.color,
          border: '1px solid rgba(255,255,255,0.15)',
          flexShrink: 0,
        }} />

        <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>
          {shadow.inset ? 'Inner' : 'Drop'} Shadow #{index + 1}
          <span style={{ fontSize: 10, color: '#475569', marginLeft: 6 }}>
            {shadow.x}px {shadow.y}px {shadow.blur}px
          </span>
        </span>

        {/* Move buttons */}
        <button
          onClick={e => { e.stopPropagation(); onMoveUp(); }}
          disabled={index === 0}
          style={{ background: 'none', border: 'none', color: index === 0 ? '#1e293b' : '#475569', cursor: index === 0 ? 'default' : 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}
        >▲</button>
        <button
          onClick={e => { e.stopPropagation(); onMoveDown(); }}
          disabled={index === total - 1}
          style={{ background: 'none', border: 'none', color: index === total - 1 ? '#1e293b' : '#475569', cursor: index === total - 1 ? 'default' : 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}
        >▼</button>

        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
        >×</button>

        <span style={{ fontSize: 10, color: '#334155' }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {/* Controls */}
      {expanded && (
        <div style={{ padding: '4px 10px 10px' }}>
          {/* X Y Blur Spread grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
            {([
              { key: 'x', label: 'X', min: -80, max: 80 },
              { key: 'y', label: 'Y', min: -80, max: 80 },
              { key: 'blur', label: 'Blur', min: 0, max: 80 },
              { key: 'spread', label: 'Spread', min: -40, max: 40 },
            ] as const).map(({ key, label, min, max }) => (
              <div key={key}>
                <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textAlign: 'center' }}>{label}</div>
                <input
                  type="number"
                  min={min} max={max}
                  value={key === 'spread' ? (shadow.spread ?? 0) : shadow[key]}
                  onChange={e => onUpdate({ [key]: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '4px 4px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#e2e8f0',
                    fontSize: 11,
                    textAlign: 'center',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Color */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 4 }}>Color</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {QUICK_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => onUpdate({ color: c })}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    border: `2px solid ${shadow.color === c ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    background: c,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
              <input
                type="color"
                value={shadow.color.startsWith('#') ? shadow.color : '#000000'}
                onChange={e => onUpdate({ color: e.target.value })}
                style={{ width: 18, height: 18, border: 'none', borderRadius: 3, cursor: 'pointer', padding: 0, background: 'none' }}
                title="Custom color"
              />
            </div>
            {/* Custom color text input */}
            <input
              type="text"
              value={shadow.color}
              onChange={e => onUpdate({ color: e.target.value })}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '3px 6px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.03)',
                color: '#94a3b8',
                fontSize: 10,
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="rgba(0,0,0,0.3)"
            />
          </div>

          {/* Inset toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={shadow.inset ?? false}
              onChange={e => onUpdate({ inset: e.target.checked })}
              style={{ accentColor: '#6366f1' }}
            />
            <span style={{ fontSize: 11, color: '#64748b' }}>Inner shadow (inset)</span>
          </label>
        </div>
      )}
    </div>
  );
}

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
      style={{
        padding: '5px 10px', fontSize: 10, borderRadius: 5,
        border: '1px solid rgba(99,102,241,0.35)',
        background: copied ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
        color: copied ? '#c7d2fe' : '#818cf8', cursor: 'pointer',
      }}
    >
      {copied ? '✓ Copied' : 'Copy CSS'}
    </button>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ShadowStudioPanel({ open, onClose, selectedShape, selectedShapeIds, onApply }: Props) {
  // Initialize from selected shape
  const initShadows = useMemo((): LayeredShadow[] => {
    if (selectedShape?.shadows && selectedShape.shadows.length > 0) {
      return selectedShape.shadows.map(s => ({ ...s, id: genId() }));
    }
    if (selectedShape?.shadow) {
      return [defaultLayer({
        x: selectedShape.shadowX ?? 0,
        y: selectedShape.shadowY ?? 4,
        blur: selectedShape.shadowBlur ?? 8,
        color: selectedShape.shadowColor ?? 'rgba(0,0,0,0.3)',
      })];
    }
    return [defaultLayer()];
  }, [selectedShape]);

  const [layers, setLayers] = useState<LayeredShadow[]>(initShadows);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const getIds = useCallback(() => {
    if (selectedShapeIds.length > 0) return selectedShapeIds;
    if (selectedShape) return [selectedShape.id];
    return [];
  }, [selectedShape, selectedShapeIds]);

  const applyLayers = useCallback((newLayers: LayeredShadow[]) => {
    const ids = getIds();
    if (ids.length === 0) return;
    onApply(ids, newLayers.map(({ id: _id, ...rest }) => rest));
  }, [getIds, onApply]);

  const updateLayer = useCallback((id: string, changes: Partial<ShadowDef>) => {
    const next = layers.map(l => l.id === id ? { ...l, ...changes } : l);
    setLayers(next);
    applyLayers(next);
  }, [layers, applyLayers]);

  const deleteLayer = useCallback((id: string) => {
    const next = layers.filter(l => l.id !== id);
    setLayers(next);
    applyLayers(next);
  }, [layers, applyLayers]);

  const addLayer = useCallback(() => {
    const next = [...layers, defaultLayer()];
    setLayers(next);
    applyLayers(next);
  }, [layers, applyLayers]);

  const moveLayer = useCallback((idx: number, dir: -1 | 1) => {
    const next = [...layers];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setLayers(next);
    applyLayers(next);
  }, [layers, applyLayers]);

  const applyPreset = useCallback((preset: ShadowPreset) => {
    const next = preset.shadows.map(s => ({ ...s, id: genId() }));
    setLayers(next);
    applyLayers(next);
    setActivePreset(preset.id);
  }, [applyLayers]);

  const cssShadow = useMemo(() => shadowsToCss(layers), [layers]);

  if (!open) return null;

  const targetCount = getIds().length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'linear-gradient(135deg,rgba(12,12,22,0.99),rgba(20,10,32,0.99))',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          color: '#e2e8f0',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>◈ Shadow Studio</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              Stack multiple shadows with full control · {targetCount > 0 ? `${targetCount} shape${targetCount > 1 ? 's' : ''} selected` : 'No shape selected'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* Left: Live preview */}
          <div style={{ flex: '0 0 auto', width: 200 }}>
            {/* Preview box */}
            <div style={{
              width: 200,
              height: 160,
              borderRadius: 10,
              background: 'rgba(15,15,28,0.95)',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}>
              <div style={{
                width: 100,
                height: 72,
                borderRadius: 10,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                boxShadow: cssShadow,
                transition: 'box-shadow 0.2s',
              }} />
            </div>

            {/* Preview presets */}
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Presets
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {SHADOW_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  title={preset.name}
                  style={{
                    padding: '6px 4px',
                    borderRadius: 6,
                    border: `1px solid ${activePreset === preset.id ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.04)'}`,
                    background: activePreset === preset.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'all 0.12s',
                  }}
                >
                  {/* Mini shadow demo */}
                  <div style={{
                    width: 24,
                    height: 16,
                    borderRadius: 3,
                    background: '#6366f1',
                    boxShadow: shadowsToCss(preset.shadows),
                  }} />
                  <span style={{ fontSize: 8, color: activePreset === preset.id ? '#c7d2fe' : '#475569', textAlign: 'center', lineHeight: 1.2 }}>
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>

            {/* CSS output */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>CSS</span>
                <CopyButton text={`box-shadow: ${cssShadow};`} />
              </div>
              <div style={{
                fontSize: 9,
                color: '#475569',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 5,
                padding: '5px 6px',
                wordBreak: 'break-all',
                lineHeight: 1.5,
                maxHeight: 80,
                overflowY: 'auto',
              }}>
                {cssShadow}
              </div>
            </div>
          </div>

          {/* Right: Layer editor */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                Shadow Layers ({layers.length})
              </span>
              <button
                onClick={addLayer}
                style={{
                  padding: '5px 10px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: '1px solid rgba(99,102,241,0.4)',
                  background: 'rgba(99,102,241,0.1)',
                  color: '#818cf8',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                + Add Layer
              </button>
            </div>

            {/* Layer rows */}
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {layers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '24px 0',
                  color: '#334155',
                  fontSize: 11,
                }}>
                  No shadow layers. Click "Add Layer" or choose a preset.
                </div>
              ) : (
                layers.map((layer, i) => (
                  <ShadowLayerRow
                    key={layer.id}
                    shadow={layer}
                    index={i}
                    total={layers.length}
                    onUpdate={changes => updateLayer(layer.id, changes)}
                    onDelete={() => deleteLayer(layer.id)}
                    onMoveUp={() => moveLayer(i, -1)}
                    onMoveDown={() => moveLayer(i, 1)}
                  />
                ))
              )}
            </div>

            {/* No selection warning */}
            {targetCount === 0 && (
              <div style={{
                marginTop: 12,
                padding: '8px 10px',
                borderRadius: 6,
                background: 'rgba(245,158,11,0.07)',
                border: '1px solid rgba(245,158,11,0.15)',
                fontSize: 10,
                color: '#92400e',
              }}>
                ⚠ Select a shape to apply shadows. Changes preview in the panel above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
