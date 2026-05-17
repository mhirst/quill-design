/**
 * ShapeVariationsPanel — Generative shape variation explorer for Quill.
 *
 * Takes a selected shape and generates N controlled variations by randomizing
 * properties within user-defined bounds. Like a "design dice roll" for rapid
 * exploration of color, size, spacing, and style options.
 *
 * Variation axes (each independently toggleable):
 *  - Hue shift: rotate fill color hue ±N degrees
 *  - Saturation jitter: ±N%
 *  - Lightness jitter: ±N%
 *  - Size scale: width/height ±N% (maintains aspect ratio optionally)
 *  - Corner radius: randomize within range
 *  - Opacity: ±N%
 *  - Rotation: ±N degrees
 *  - Stroke width: ±N px
 *
 * Layout modes for generated copies:
 *  - Grid: N×M layout with gap
 *  - Row: horizontal strip
 *  - Radial: around the original
 *
 * Preview: shows all variants as colored swatches before committing.
 * Commit: places all variants on canvas as real shapes.
 * Seed: set a random seed for reproducible results.
 *
 * Keyboard: ⌘⌥Z to toggle
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VariationAxis {
  key: string;
  label: string;
  enabled: boolean;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export interface VariationConfig {
  count: number;
  seed: number;
  lockAspect: boolean;
  layout: 'grid' | 'row' | 'radial';
  gridCols: number;
  gap: number;
  axes: VariationAxis[];
}

export interface ShapeVariant {
  index: number;
  fill: string;
  opacity: number;
  width: number;
  height: number;
  borderRadius: number;
  rotation: number;
  strokeWidth: number;
  x: number;
  y: number;
}

export interface ShapePatch {
  x: number; y: number;
  width?: number; height?: number;
  fill?: string; opacity?: number;
  borderRadius?: number; rotation?: number;
  strokeWidth?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onCommit: (variants: ShapePatch[]) => void;
}

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// ─── Color Utilities ──────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0,2),16)/255;
  const g = parseInt(h.slice(2,4),16)/255;
  const b = parseInt(h.slice(4,6),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let hue = 0, sat = 0;
  const lit = (max+min)/2;
  if (max !== min) {
    const d = max - min;
    sat = lit > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: hue = ((g-b)/d + (g<b?6:0))/6; break;
      case g: hue = ((b-r)/d + 2)/6; break;
      case b: hue = ((r-g)/d + 4)/6; break;
    }
  }
  return [hue*360, sat*100, lit*100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));
  const sn = s/100, ln = l/100;
  const c = (1 - Math.abs(2*ln - 1)) * sn;
  const x = c * (1 - Math.abs((h/60)%2 - 1));
  const m = ln - c/2;
  let r=0,g=0,b=0;
  if (h < 60)      { r=c; g=x; b=0; }
  else if (h < 120){ r=x; g=c; b=0; }
  else if (h < 180){ r=0; g=c; b=x; }
  else if (h < 240){ r=0; g=x; b=c; }
  else if (h < 300){ r=x; g=0; b=c; }
  else             { r=c; g=0; b=x; }
  const toHex = (v: number) => Math.round((v+m)*255).toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── Variant Generator ────────────────────────────────────────────────────────

export function generateVariants(shape: Shape, config: VariationConfig): ShapeVariant[] {
  const rng = mulberry32(config.seed);
  const axisMap = new Map(config.axes.map(a => [a.key, a]));

  const baseFill = shape.fill || '#6366f1';
  const baseHsl = hexToHsl(baseFill) ?? [240, 70, 60];
  const baseOpacity = shape.opacity ?? 1;
  const baseWidth = shape.width;
  const baseHeight = shape.height;
  const baseBR = typeof shape.borderRadius === 'number' ? shape.borderRadius : 0;
  const baseRotation = shape.rotation ?? 0;
  const baseStrokeWidth = shape.strokeWidth ?? 0;

  const variants: ShapeVariant[] = [];

  for (let i = 0; i < config.count; i++) {
    // Color variations
    let [h, s, l] = baseHsl;
    const hueAxis = axisMap.get('hue');
    if (hueAxis?.enabled) h += randBetween(rng, hueAxis.min, hueAxis.max);
    const satAxis = axisMap.get('saturation');
    if (satAxis?.enabled) s += randBetween(rng, satAxis.min, satAxis.max);
    const litAxis = axisMap.get('lightness');
    if (litAxis?.enabled) l += randBetween(rng, litAxis.min, litAxis.max);
    const fill = hslToHex(h, s, l);

    // Opacity
    let opacity = baseOpacity;
    const opacityAxis = axisMap.get('opacity');
    if (opacityAxis?.enabled) opacity = Math.max(0.05, Math.min(1, opacity + randBetween(rng, opacityAxis.min, opacityAxis.max) / 100));

    // Size
    let width = baseWidth, height = baseHeight;
    const sizeAxis = axisMap.get('size');
    if (sizeAxis?.enabled) {
      const scalePct = 1 + randBetween(rng, sizeAxis.min, sizeAxis.max) / 100;
      width = Math.max(4, Math.round(baseWidth * scalePct));
      if (config.lockAspect) {
        height = Math.max(4, Math.round(baseHeight * scalePct));
      } else {
        const scaleH = 1 + randBetween(rng, sizeAxis.min, sizeAxis.max) / 100;
        height = Math.max(4, Math.round(baseHeight * scaleH));
      }
    }

    // Border radius
    let borderRadius = baseBR;
    const brAxis = axisMap.get('radius');
    if (brAxis?.enabled) borderRadius = Math.max(0, Math.round(baseBR + randBetween(rng, brAxis.min, brAxis.max)));

    // Rotation
    let rotation = baseRotation;
    const rotAxis = axisMap.get('rotation');
    if (rotAxis?.enabled) rotation = baseRotation + randBetween(rng, rotAxis.min, rotAxis.max);

    // Stroke width
    let strokeWidth = baseStrokeWidth;
    const swAxis = axisMap.get('strokeWidth');
    if (swAxis?.enabled) strokeWidth = Math.max(0, Math.round(baseStrokeWidth + randBetween(rng, swAxis.min, swAxis.max)));

    // Position (computed after, based on layout)
    variants.push({ index: i, fill, opacity, width, height, borderRadius, rotation, strokeWidth, x: 0, y: 0 });
  }

  // Apply layout positions
  const startX = shape.x + shape.width + config.gap;
  const startY = shape.y;

  if (config.layout === 'row') {
    let cx = startX;
    for (const v of variants) {
      v.x = cx; v.y = startY + (baseHeight - v.height) / 2;
      cx += v.width + config.gap;
    }
  } else if (config.layout === 'grid') {
    const cols = config.gridCols;
    for (let i = 0; i < variants.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      variants[i].x = shape.x + col * (baseWidth + config.gap);
      variants[i].y = shape.y + shape.height + config.gap + row * (baseHeight + config.gap);
    }
  } else if (config.layout === 'radial') {
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const radius = Math.max(shape.width, shape.height) * 1.5 + config.gap;
    for (let i = 0; i < variants.length; i++) {
      const angle = (2 * Math.PI * i) / variants.length;
      variants[i].x = Math.round(cx + Math.cos(angle) * radius - variants[i].width / 2);
      variants[i].y = Math.round(cy + Math.sin(angle) * radius - variants[i].height / 2);
    }
  }

  return variants;
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_AXES: VariationAxis[] = [
  { key: 'hue',        label: 'Hue shift',      enabled: true,  min: -30, max: 30,   step: 5,  unit: '°' },
  { key: 'saturation', label: 'Saturation',      enabled: false, min: -20, max: 20,   step: 5,  unit: '%' },
  { key: 'lightness',  label: 'Lightness',       enabled: false, min: -15, max: 15,   step: 5,  unit: '%' },
  { key: 'size',       label: 'Size scale',      enabled: false, min: -20, max: 20,   step: 5,  unit: '%' },
  { key: 'radius',     label: 'Corner radius',   enabled: false, min: -4,  max: 8,    step: 1,  unit: 'px' },
  { key: 'opacity',    label: 'Opacity jitter',  enabled: false, min: -20, max: 0,    step: 5,  unit: '%' },
  { key: 'rotation',   label: 'Rotation jitter', enabled: false, min: -15, max: 15,   step: 5,  unit: '°' },
  { key: 'strokeWidth',label: 'Stroke width',    enabled: false, min: -1,  max: 3,    step: 1,  unit: 'px' },
];

function defaultConfig(): VariationConfig {
  return {
    count: 8, seed: 42, lockAspect: true,
    layout: 'row', gridCols: 4, gap: 16,
    axes: DEFAULT_AXES.map(a => ({ ...a })),
  };
}

// ─── Components ────────────────────────────────────────────────────────────────

function AxisControl({ axis, onChange }: {
  axis: VariationAxis;
  onChange: (updated: Partial<VariationAxis>) => void;
}) {
  return (
    <div style={{
      padding: '5px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: axis.enabled ? 5 : 0 }}>
        <input
          type="checkbox" checked={axis.enabled}
          onChange={e => onChange({ enabled: e.target.checked })}
          style={{ accentColor: '#818cf8', cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={{
          fontSize: 10, fontWeight: 600, flex: 1,
          color: axis.enabled ? 'var(--text, #e2e8f0)' : 'var(--muted, #666)',
        }}>
          {axis.label}
        </span>
        {axis.enabled && (
          <span style={{ fontSize: 8, color: 'var(--muted, #666)', fontFamily: 'monospace' }}>
            {axis.min > 0 ? '+' : ''}{axis.min}{axis.unit} to {axis.max > 0 ? '+' : ''}{axis.max}{axis.unit}
          </span>
        )}
      </div>

      {axis.enabled && (
        <div style={{ display: 'flex', gap: 8, paddingLeft: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 7, color: 'var(--muted, #555)', marginBottom: 2 }}>Min</div>
            <input
              type="range" min={-100} max={0} step={axis.step} value={axis.min}
              onChange={e => onChange({ min: +e.target.value })}
              style={{ width: '100%', accentColor: '#f87171', cursor: 'pointer' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 7, color: 'var(--muted, #555)', marginBottom: 2 }}>Max</div>
            <input
              type="range" min={0} max={100} step={axis.step} value={axis.max}
              onChange={e => onChange({ max: +e.target.value })}
              style={{ width: '100%', accentColor: '#34d399', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export function ShapeVariationsPanel({ open, onClose, selectedShape, onCommit }: Props) {
  const [config, setConfig] = useState<VariationConfig>(defaultConfig);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const updateAxis = useCallback((key: string, patch: Partial<VariationAxis>) => {
    setConfig(prev => ({
      ...prev,
      axes: prev.axes.map(a => a.key === key ? { ...a, ...patch } : a),
    }));
  }, []);

  const variants = useMemo(() => {
    if (!selectedShape) return [];
    return generateVariants(selectedShape, config);
  }, [selectedShape, config]);

  const randomizeSeed = useCallback(() => {
    setConfig(prev => ({ ...prev, seed: Math.floor(Math.random() * 99999) }));
  }, []);

  const commitVariants = useCallback(() => {
    const patches: ShapePatch[] = variants.map(v => ({
      x: v.x, y: v.y,
      width: v.width, height: v.height,
      fill: v.fill, opacity: v.opacity,
      borderRadius: v.borderRadius,
      rotation: v.rotation,
      strokeWidth: v.strokeWidth,
    }));
    onCommit(patches);
    onClose();
  }, [variants, onCommit, onClose]);

  if (!open) return null;

  const hasAnyEnabled = config.axes.some(a => a.enabled);

  return (
    <div style={{
      position: 'absolute', top: 48, right: 12,
      width: 300, maxHeight: 'calc(100vh - 80px)',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 40, display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>🎲</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
            Shape Variations
          </span>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>
          ×
        </button>
      </div>

      {!selectedShape ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted, #666)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🖱️</div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>No shape selected</div>
          <div style={{ fontSize: 9 }}>Select a shape to generate variations.</div>
        </div>
      ) : (
        <>
          {/* Preview strip */}
          <div style={{
            padding: '10px',
            borderBottom: '1px solid var(--border, #2d2d3d)',
            background: 'rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 8, color: 'var(--muted, #666)', marginBottom: 6 }}>
              Preview · {variants.length} variants
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 36,
            }}>
              {variants.map((v, i) => {
                const isCircle = selectedShape.type === 'ellipse';
                const previewSize = 32;
                const br = isCircle ? '50%' : `${Math.min(v.borderRadius, previewSize / 2)}px`;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    title={`#${i+1}: ${v.fill}, ${Math.round(v.opacity*100)}% opacity`}
                    style={{
                      width: previewSize, height: previewSize,
                      background: v.fill,
                      borderRadius: br,
                      opacity: v.opacity,
                      transform: `rotate(${v.rotation}deg) ${hoveredIdx === i ? 'scale(1.15)' : 'scale(1)'}`,
                      transition: 'transform 0.15s',
                      border: hoveredIdx === i ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
                      boxSizing: 'border-box',
                      cursor: 'default',
                      flexShrink: 0,
                    }}
                  />
                );
              })}
              {!hasAnyEnabled && (
                <div style={{ fontSize: 9, color: 'var(--muted, #555)', paddingTop: 8 }}>
                  Enable axes below to see variations.
                </div>
              )}
            </div>

            {/* Hovered variant info */}
            {hoveredIdx !== null && variants[hoveredIdx] && (
              <div style={{
                marginTop: 6, fontSize: 8, color: 'var(--muted, #888)', fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.2)', borderRadius: 4, padding: '3px 6px',
              }}>
                #{hoveredIdx+1}: fill={variants[hoveredIdx].fill}
                {' '}opacity={Math.round(variants[hoveredIdx].opacity*100)}%
                {' '}{variants[hoveredIdx].width}×{variants[hoveredIdx].height}px
                {variants[hoveredIdx].rotation ? ` rot=${Math.round(variants[hoveredIdx].rotation)}°` : ''}
              </div>
            )}
          </div>

          {/* Settings scroll area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>

            {/* Count + seed + layout */}
            <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Count</span>
                    <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>{config.count}</span>
                  </div>
                  <input type="range" min={2} max={24} value={config.count}
                    onChange={e => setConfig(c => ({ ...c, count: +e.target.value }))}
                    style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: 'var(--muted, #888)', flexShrink: 0 }}>Seed:</span>
                <input
                  type="number" value={config.seed}
                  onChange={e => setConfig(c => ({ ...c, seed: +e.target.value }))}
                  style={{
                    width: 60, background: 'var(--bg, #131320)',
                    border: '1px solid var(--border, #2d2d3d)',
                    color: 'var(--text, #e2e8f0)', fontSize: 9,
                    padding: '2px 5px', borderRadius: 4, outline: 'none',
                  }}
                />
                <button onClick={randomizeSeed}
                  style={{
                    fontSize: 9, padding: '2px 7px', borderRadius: 4,
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    color: '#818cf8', cursor: 'pointer',
                  }}>
                  🎲 Random
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', marginLeft: 'auto' }}>
                  <input type="checkbox" checked={config.lockAspect}
                    onChange={e => setConfig(c => ({ ...c, lockAspect: e.target.checked }))}
                    style={{ accentColor: '#818cf8', cursor: 'pointer' }} />
                  <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Lock ratio</span>
                </label>
              </div>

              {/* Layout */}
              <div>
                <div style={{ fontSize: 8, color: 'var(--muted, #666)', marginBottom: 4 }}>Layout</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['row', 'grid', 'radial'] as const).map(l => (
                    <button key={l} onClick={() => setConfig(c => ({ ...c, layout: l }))}
                      style={{
                        flex: 1, fontSize: 8, padding: '3px 0', borderRadius: 4,
                        background: config.layout === l ? 'rgba(99,102,241,0.2)' : 'transparent',
                        border: `1px solid ${config.layout === l ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                        color: config.layout === l ? '#818cf8' : 'var(--muted, #666)',
                        cursor: 'pointer', textTransform: 'capitalize',
                      }}>
                      {l === 'row' ? '▬▬▬' : l === 'grid' ? '⊞' : '◎'} {l}
                    </button>
                  ))}
                </div>
              </div>

              {config.layout === 'grid' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Columns</span>
                      <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)' }}>{config.gridCols}</span>
                    </div>
                    <input type="range" min={2} max={8} value={config.gridCols}
                      onChange={e => setConfig(c => ({ ...c, gridCols: +e.target.value }))}
                      style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Gap</span>
                      <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)' }}>{config.gap}px</span>
                    </div>
                    <input type="range" min={4} max={64} step={4} value={config.gap}
                      onChange={e => setConfig(c => ({ ...c, gap: +e.target.value }))}
                      style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--border, #2d2d3d)', paddingTop: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--muted, #666)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Variation Axes
              </div>
              {config.axes.map(axis => (
                <AxisControl
                  key={axis.key}
                  axis={axis}
                  onChange={patch => updateAxis(axis.key, patch)}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 10px', borderTop: '1px solid var(--border, #2d2d3d)',
            flexShrink: 0, display: 'flex', gap: 6,
          }}>
            <button
              onClick={randomizeSeed}
              style={{
                fontSize: 9, padding: '5px 10px', borderRadius: 5,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border, #2d2d3d)',
                color: 'var(--muted, #888)', cursor: 'pointer',
              }}
            >
              🎲 Re-roll
            </button>
            <button
              onClick={commitVariants}
              disabled={!hasAnyEnabled || variants.length === 0}
              style={{
                flex: 1, fontSize: 10, padding: '5px 10px', borderRadius: 5,
                background: hasAnyEnabled ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${hasAnyEnabled ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                color: hasAnyEnabled ? '#818cf8' : 'var(--muted, #666)',
                cursor: hasAnyEnabled ? 'pointer' : 'not-allowed',
                fontWeight: 600,
              }}
            >
              ✦ Place {variants.length} variants on canvas
            </button>
          </div>
        </>
      )}
    </div>
  );
}
