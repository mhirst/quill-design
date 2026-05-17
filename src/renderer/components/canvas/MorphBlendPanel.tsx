/**
 * MorphBlendPanel — Shape Blend / Morph tool for Quill.
 *
 * Select exactly 2 shapes, choose N steps, and generate intermediate
 * "blend" shapes that smoothly interpolate:
 *   - Position (x, y)
 *   - Size (width, height)
 *   - Fill color (hex interpolation)
 *   - Stroke color
 *   - Border radius
 *   - Opacity
 *   - Rotation
 *   - Font size (for text shapes)
 *
 * Easing functions: linear, ease-in, ease-out, ease-in-out, spring
 * Distribution: row / scatter (follow direct path) / arc
 * Option to group the result shapes as a new frame
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { defaultShape } from '../../lib/shapes';
import { X, GitMerge, RefreshCw, Layers } from 'lucide-react';
import { v4 as uuid } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring' | 'bounce';
type DistMode = 'direct' | 'arc-up' | 'arc-down' | 'scatter';

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  selectedShapeIds: string[];
  onInsertShapes: (shapes: Shape[]) => void;
}

// ─── Easing functions ─────────────────────────────────────────────────────────

function applyEasing(t: number, easing: EasingName): number {
  switch (easing) {
    case 'linear': return t;
    case 'ease-in': return t * t * t;
    case 'ease-out': return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'spring': {
      const c4 = (2 * Math.PI) / 3;
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    case 'bounce': {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
    default: return t;
  }
}

// ─── Color interpolation ──────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace('#', '');
  if (c.length === 6) {
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  return rgbToHex(
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  // Shortest path around 360°
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return a + diff * t;
}

// ─── Generate blend shapes ────────────────────────────────────────────────────

function generateBlend(
  from: Shape,
  to: Shape,
  steps: number,
  easing: EasingName,
  distribution: DistMode,
  includeEndpoints: boolean,
): Shape[] {
  const result: Shape[] = [];

  // Total slots including or excluding endpoints
  const totalSteps = steps + 2; // includes from + to
  const start = includeEndpoints ? 0 : 1;
  const end = includeEndpoints ? totalSteps - 1 : totalSteps - 2;

  for (let i = start; i <= end; i++) {
    const rawT = i / (totalSteps - 1);
    const t = applyEasing(rawT, easing);

    // Interpolate position
    let x = lerp(from.x, to.x, t);
    let y = lerp(from.y, to.y, t);

    // Arc distribution modifies Y
    if (distribution === 'arc-up') {
      const arcHeight = Math.abs(to.x - from.x) * 0.3;
      y -= Math.sin(rawT * Math.PI) * arcHeight;
    } else if (distribution === 'arc-down') {
      const arcHeight = Math.abs(to.x - from.x) * 0.3;
      y += Math.sin(rawT * Math.PI) * arcHeight;
    } else if (distribution === 'scatter') {
      // Small perpendicular offset using a Lissajous-like curve
      const perp = Math.sin(rawT * Math.PI * 3) * 20;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      x += (-dy / len) * perp;
      y += (dx / len) * perp;
    }

    // Interpolate shape properties
    const w = lerp(from.width, to.width, t);
    const h = lerp(from.height, to.height, t);
    const op = lerp(from.opacity, to.opacity, t);
    const rot = lerpAngle(from.rotation ?? 0, to.rotation ?? 0, t);
    const br = typeof from.borderRadius === 'number' && typeof to.borderRadius === 'number'
      ? lerp(from.borderRadius, to.borderRadius, t)
      : typeof from.borderRadius === 'number' ? from.borderRadius : 0;

    const fill = from.fill && to.fill && from.fill !== 'transparent' && to.fill !== 'transparent'
      ? lerpColor(from.fill, to.fill, t)
      : t < 0.5 ? from.fill : to.fill;

    const stroke = from.stroke && to.stroke && from.stroke !== 'transparent' && to.stroke !== 'transparent'
      ? lerpColor(from.stroke, to.stroke, t)
      : t < 0.5 ? from.stroke : to.stroke;

    const strokeWidth = lerp(from.strokeWidth, to.strokeWidth, t);
    const fontSize = lerp(from.fontSize ?? 16, to.fontSize ?? 16, t);

    const base = defaultShape(from.type, uuid());
    const blended: Shape = {
      ...base,
      ...from,
      id: uuid(),
      x, y, width: w, height: h,
      opacity: op,
      rotation: rot,
      borderRadius: br,
      fill,
      stroke,
      strokeWidth,
      fontSize: Math.round(fontSize),
      // Don't inherit parent
      parentId: undefined,
    };

    // Interpolate text
    if (from.type === 'text' && from.text && to.text) {
      // Show from text for first half, to text for second half
      blended.text = rawT < 0.5 ? from.text : to.text;
    }

    result.push(blended);
  }

  return result;
}

// ─── EasingPreview — tiny SVG curve preview ───────────────────────────────────

function EasingPreview({ easing, active }: { easing: EasingName; active: boolean }) {
  const pts = Array.from({ length: 20 }, (_, i) => {
    const t = i / 19;
    const y = 1 - applyEasing(t, easing);
    return `${(t * 36).toFixed(1)},${(y * 20).toFixed(1)}`;
  }).join(' ');

  return (
    <button
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '6px 8px', borderRadius: 7,
        border: active ? '1px solid #6366f1' : '1px solid var(--border)',
        background: active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer', minWidth: 56,
      }}
    >
      <svg width="36" height="20" style={{ overflow: 'visible' }}>
        <polyline
          points={pts}
          fill="none"
          stroke={active ? '#6366f1' : '#475569'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div style={{ fontSize: 9, color: active ? '#a5b4fc' : 'var(--subtle)', fontWeight: active ? 700 : 400 }}>
        {easing.replace(/-/g, '‑')}
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MorphBlendPanel({ open, onClose, shapes, selectedShapeIds, onInsertShapes }: Props) {
  const [steps, setSteps] = useState(5);
  const [easing, setEasing] = useState<EasingName>('ease-in-out');
  const [distribution, setDistribution] = useState<DistMode>('direct');
  const [includeEndpoints, setIncludeEndpoints] = useState(false);
  const [wrapInFrame, setWrapInFrame] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Reset when selection changes
  useEffect(() => {
    setGenerated(false);
  }, [selectedShapeIds]);

  const twoSelected = selectedShapeIds.length === 2;
  const fromShape = shapes.find(s => s.id === selectedShapeIds[0]);
  const toShape = shapes.find(s => s.id === selectedShapeIds[1]);

  // Live preview blend shapes (computed for preview only)
  const previewBlend = useMemo(() => {
    if (!fromShape || !toShape || !twoSelected) return [];
    return generateBlend(fromShape, toShape, steps, easing, distribution, includeEndpoints);
  }, [fromShape, toShape, twoSelected, steps, easing, distribution, includeEndpoints]);

  const handleGenerate = useCallback(() => {
    if (!fromShape || !toShape) return;
    const blended = generateBlend(fromShape, toShape, steps, easing, distribution, includeEndpoints);

    if (wrapInFrame) {
      // Compute bounding box of all blended shapes
      const xs = blended.map(s => s.x);
      const ys = blended.map(s => s.y);
      const x2s = blended.map(s => s.x + s.width);
      const y2s = blended.map(s => s.y + s.height);
      const minX = Math.min(...xs) - 24;
      const minY = Math.min(...ys) - 24;
      const maxX = Math.max(...x2s) + 24;
      const maxY = Math.max(...y2s) + 24;

      const frameId = uuid();
      const frame = defaultShape('frame', frameId);
      const framedFrame: Shape = {
        ...frame,
        id: frameId,
        name: 'Blend Group',
        x: minX, y: minY,
        width: maxX - minX, height: maxY - minY,
        fill: 'transparent', stroke: '#6366f1', strokeWidth: 1,
      };

      const framedShapes = blended.map(s => ({
        ...s,
        x: s.x - minX, y: s.y - minY,
        parentId: frameId,
      }));

      onInsertShapes([framedFrame, ...framedShapes]);
    } else {
      onInsertShapes(blended);
    }

    setGenerated(true);
    setTimeout(() => setGenerated(false), 2000);
  }, [fromShape, toShape, steps, easing, distribution, includeEndpoints, wrapInFrame, onInsertShapes]);

  if (!open) return null;

  const EASINGS: EasingName[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring', 'bounce'];
  const DISTRIBUTIONS: Array<{ key: DistMode; label: string; desc: string }> = [
    { key: 'direct', label: 'Direct', desc: 'Straight line' },
    { key: 'arc-up', label: 'Arc ↑', desc: 'Upward curve' },
    { key: 'arc-down', label: 'Arc ↓', desc: 'Downward curve' },
    { key: 'scatter', label: 'Wave', desc: 'Sinuous path' },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 48,
      right: 8,
      width: 340,
      maxHeight: 'calc(100vh - 64px)',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 300,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitMerge size={16} style={{ color: '#6366f1' }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Morph Blend</span>
        </div>
        <button onClick={onClose} style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={14} />
        </button>
      </div>

      {/* Selection status */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        background: twoSelected ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
      }}>
        {!twoSelected ? (
          <div style={{ fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>⚠</span>
            <div>
              <div style={{ fontWeight: 600 }}>Select exactly 2 shapes</div>
              <div style={{ fontSize: 11, color: 'var(--subtle)' }}>
                {selectedShapeIds.length === 0 ? 'No shapes selected' : selectedShapeIds.length === 1 ? 'Select one more shape' : `${selectedShapeIds.length} shapes selected — please select exactly 2`}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* From shape */}
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: fromShape?.fill || 'transparent', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{fromShape?.name || fromShape?.type}</div>
                  <div style={{ fontSize: 10, color: 'var(--subtle)' }}>{Math.round(fromShape?.width || 0)}×{Math.round(fromShape?.height || 0)}</div>
                </div>
              </div>
            </div>

            <div style={{ color: 'var(--subtle)', fontSize: 18 }}>→</div>

            {/* To shape */}
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: toShape?.fill || 'transparent', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{toShape?.name || toShape?.type}</div>
                  <div style={{ fontSize: 10, color: 'var(--subtle)' }}>{Math.round(toShape?.width || 0)}×{Math.round(toShape?.height || 0)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* Steps */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Blend Steps</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#6366f1' }}>{steps}</div>
          </div>
          <input
            type="range" min={1} max={24} step={1} value={steps}
            onChange={e => setSteps(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--subtle)', marginTop: 2 }}>
            <span>1</span><span>Total: {steps + (includeEndpoints ? 2 : 0)} shapes</span><span>24</span>
          </div>
        </div>

        {/* Easing */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Easing</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EASINGS.map(e => (
              <div key={e} onClick={() => setEasing(e)} style={{ cursor: 'pointer' }}>
                <EasingPreview easing={e} active={easing === e} />
              </div>
            ))}
          </div>
        </div>

        {/* Distribution */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Path</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {DISTRIBUTIONS.map(d => (
              <button
                key={d.key}
                onClick={() => setDistribution(d.key)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 7, cursor: 'pointer',
                  border: distribution === d.key ? '1px solid #6366f1' : '1px solid var(--border)',
                  background: distribution === d.key ? 'rgba(99,102,241,0.1)' : 'transparent',
                  color: distribution === d.key ? '#a5b4fc' : 'var(--subtle)',
                  fontSize: 11, fontWeight: distribution === d.key ? 700 : 400,
                  textAlign: 'center',
                }}
                title={d.desc}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mini preview strip */}
        {twoSelected && previewBlend.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Preview</div>
            <div style={{
              height: 64, background: 'rgba(0,0,0,0.2)', borderRadius: 8,
              border: '1px solid var(--border)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
              position: 'relative',
            }}>
              {previewBlend.map((s, i) => {
                const totalW = previewBlend.reduce((sum, sh) => sum + sh.width, 0);
                const scale = Math.min(40 / (s.width || 1), 40 / (s.height || 1), 1);
                const w = Math.max(4, s.width * scale);
                const h = Math.max(4, s.height * scale);
                const br = typeof s.borderRadius === 'number' ? s.borderRadius * scale : 0;
                return (
                  <div
                    key={s.id}
                    style={{
                      width: w, height: h,
                      borderRadius: Math.min(br, w / 2, h / 2),
                      background: s.fill || '#6366f1',
                      opacity: s.opacity,
                      flexShrink: 0,
                      border: s.strokeWidth > 0 ? `${Math.max(1, s.strokeWidth * scale)}px solid ${s.stroke}` : 'none',
                      transform: `rotate(${s.rotation || 0}deg)`,
                      margin: '0 2px',
                      transition: 'all 0.2s',
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={includeEndpoints}
              onChange={e => setIncludeEndpoints(e.target.checked)}
              style={{ accentColor: '#6366f1' }}
            />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>Include endpoint shapes</div>
              <div style={{ fontSize: 11, color: 'var(--subtle)' }}>Also insert copies of the from/to shapes</div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={wrapInFrame}
              onChange={e => setWrapInFrame(e.target.checked)}
              style={{ accentColor: '#6366f1' }}
            />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>Wrap in frame</div>
              <div style={{ fontSize: 11, color: 'var(--subtle)' }}>Group all blend shapes in a new frame</div>
            </div>
          </label>
        </div>
      </div>

      {/* Generate button */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={handleGenerate}
          disabled={!twoSelected}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 8,
            fontSize: 13, fontWeight: 700,
            background: generated ? '#22c55e' : twoSelected ? '#6366f1' : 'rgba(255,255,255,0.06)',
            color: twoSelected || generated ? '#fff' : 'var(--subtle)',
            border: 'none', cursor: twoSelected ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.2s',
          }}
        >
          {generated ? (
            <><RefreshCw size={14} /> Generated!</>
          ) : (
            <><GitMerge size={14} /> Generate {steps} blend shapes</>
          )}
        </button>
        <div style={{ fontSize: 10, color: 'var(--subtle)', textAlign: 'center', marginTop: 6 }}>
          Shapes are inserted at original positions · use Undo to revert
        </div>
      </div>
    </div>
  );
}
