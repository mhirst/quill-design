/**
 * GridDuplicatorPanel — Duplicate shapes in grid, ring, arc, or spiral patterns.
 *
 * Features:
 *  - Grid: rows × cols with gap X/Y
 *  - Ring: N copies evenly around a circle of radius R
 *  - Arc: N copies along a partial arc (start angle → end angle)
 *  - Spiral: N copies in logarithmic spiral
 *  - Progressive transforms: rotate-with-angle, scale-down, opacity-fade
 *  - SVG preview showing the pattern before placing
 *  - Apply: creates real shapes on canvas
 *  - Keyboard: ⌘⇧⌥D to toggle
 */

import React, { useMemo, useState, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onDuplicate: (copies: ShapePatch[]) => void;
}

export interface ShapePatch {
  x: number;
  y: number;
  rotation?: number;
  opacity?: number;
  scaleX?: number;
  scaleY?: number;
}

type PatternType = 'grid' | 'ring' | 'arc' | 'spiral';

interface GridConfig { rows: number; cols: number; gapX: number; gapY: number; }
interface RingConfig { count: number; radius: number; rotateWithAngle: boolean; }
interface ArcConfig { count: number; radius: number; startAngle: number; endAngle: number; rotateWithAngle: boolean; }
interface SpiralConfig { count: number; startRadius: number; spacing: number; turns: number; }

interface ProgressiveOptions {
  scaleDown: boolean;   // each copy is 5% smaller
  fadeOut: boolean;     // each copy is 10% more transparent
  rotateInc: number;   // extra rotation per copy (degrees)
}

// ── Pattern Computation ────────────────────────────────────────────────────────

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function computeGridPositions(shape: Shape, cfg: GridConfig): ShapePatch[] {
  const positions: ShapePatch[] = [];
  const w = shape.width + cfg.gapX;
  const h = shape.height + cfg.gapY;
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (r === 0 && c === 0) continue; // skip original
      positions.push({
        x: shape.x + c * w,
        y: shape.y + r * h,
      });
    }
  }
  return positions;
}

function computeRingPositions(shape: Shape, cfg: RingConfig): ShapePatch[] {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const positions: ShapePatch[] = [];
  for (let i = 0; i < cfg.count; i++) {
    if (i === 0) continue; // skip original
    const angle = (2 * Math.PI * i) / cfg.count;
    positions.push({
      x: cx + Math.cos(angle) * cfg.radius - shape.width / 2,
      y: cy + Math.sin(angle) * cfg.radius - shape.height / 2,
      rotation: cfg.rotateWithAngle ? (angle * 180) / Math.PI : 0,
    });
  }
  return positions;
}

function computeArcPositions(shape: Shape, cfg: ArcConfig): ShapePatch[] {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const positions: ShapePatch[] = [];
  const startRad = toRad(cfg.startAngle);
  const endRad = toRad(cfg.endAngle);
  const span = endRad - startRad;
  for (let i = 0; i < cfg.count; i++) {
    if (i === 0) continue;
    const t = cfg.count === 1 ? 0.5 : i / (cfg.count - 1);
    const angle = startRad + t * span;
    positions.push({
      x: cx + Math.cos(angle) * cfg.radius - shape.width / 2,
      y: cy + Math.sin(angle) * cfg.radius - shape.height / 2,
      rotation: cfg.rotateWithAngle ? (angle * 180) / Math.PI : 0,
    });
  }
  return positions;
}

function computeSpiralPositions(shape: Shape, cfg: SpiralConfig): ShapePatch[] {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const positions: ShapePatch[] = [];
  for (let i = 0; i < cfg.count; i++) {
    if (i === 0) continue;
    const t = i / Math.max(cfg.count - 1, 1);
    const angle = t * cfg.turns * 2 * Math.PI;
    const radius = cfg.startRadius + cfg.spacing * i;
    positions.push({
      x: cx + Math.cos(angle) * radius - shape.width / 2,
      y: cy + Math.sin(angle) * radius - shape.height / 2,
      rotation: (angle * 180) / Math.PI,
    });
  }
  return positions;
}

function applyProgressive(patches: ShapePatch[], opts: ProgressiveOptions): ShapePatch[] {
  return patches.map((p, i) => {
    const idx = i + 1;
    return {
      ...p,
      rotation: (p.rotation ?? 0) + opts.rotateInc * idx,
      opacity: opts.fadeOut ? Math.max(0.1, 1 - 0.1 * idx) : undefined,
      scaleX: opts.scaleDown ? Math.max(0.2, 1 - 0.05 * idx) : undefined,
      scaleY: opts.scaleDown ? Math.max(0.2, 1 - 0.05 * idx) : undefined,
    };
  });
}

// ── SVG Preview ────────────────────────────────────────────────────────────────

interface PreviewProps {
  shape: Shape | null;
  patches: ShapePatch[];
}

function PatternPreview({ shape, patches }: PreviewProps) {
  const PREVIEW_W = 280;
  const PREVIEW_H = 160;

  const allPoints = useMemo(() => {
    if (!shape) return [];
    const orig = { x: shape.x, y: shape.y };
    return [orig, ...patches.map(p => ({ x: p.x, y: p.y }))];
  }, [shape, patches]);

  const bounds = useMemo(() => {
    if (allPoints.length === 0) return { minX: 0, minY: 0, rangeX: 1, rangeY: 1 };
    const xs = allPoints.map(p => p.x);
    const ys = allPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + (shape?.width ?? 60);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + (shape?.height ?? 40);
    return {
      minX, minY,
      rangeX: Math.max(maxX - minX, 1),
      rangeY: Math.max(maxY - minY, 1),
    };
  }, [allPoints, shape]);

  const toScreen = (x: number, y: number) => {
    const pad = 12;
    const sx = pad + ((x - bounds.minX) / bounds.rangeX) * (PREVIEW_W - pad * 2);
    const sy = pad + ((y - bounds.minY) / bounds.rangeY) * (PREVIEW_H - pad * 2);
    return { sx, sy };
  };

  const sw = shape ? (shape.width / bounds.rangeX) * (PREVIEW_W - 24) : 20;
  const sh = shape ? (shape.height / bounds.rangeY) * (PREVIEW_H - 24) : 14;
  const displayW = Math.max(8, Math.min(sw, 60));
  const displayH = Math.max(5, Math.min(sh, 40));

  const shapeColor = shape?.fill ?? '#6366f1';
  const isCircle = shape?.type === 'ellipse';

  return (
    <svg
      width={PREVIEW_W}
      height={PREVIEW_H}
      style={{ display: 'block', borderRadius: 6, background: 'rgba(10,10,20,0.6)' }}
    >
      {/* Copies */}
      {patches.map((p, i) => {
        const { sx, sy } = toScreen(p.x, p.y);
        const opacity = p.opacity ?? (1 - i * 0.03);
        const scale = p.scaleX ?? 1;
        return (
          <g
            key={i}
            transform={`translate(${sx + displayW / 2}, ${sy + displayH / 2}) rotate(${p.rotation ?? 0}) scale(${scale}) translate(${-displayW / 2}, ${-displayH / 2})`}
          >
            {isCircle ? (
              <ellipse
                cx={displayW / 2} cy={displayH / 2}
                rx={displayW / 2} ry={displayH / 2}
                fill={shapeColor}
                opacity={opacity * 0.4}
                stroke={shapeColor}
                strokeWidth={0.5}
                strokeOpacity={opacity * 0.6}
              />
            ) : (
              <rect
                width={displayW} height={displayH}
                rx={3}
                fill={shapeColor}
                opacity={opacity * 0.4}
                stroke={shapeColor}
                strokeWidth={0.5}
                strokeOpacity={opacity * 0.6}
              />
            )}
          </g>
        );
      })}

      {/* Original (highlighted) */}
      {shape && (() => {
        const { sx, sy } = toScreen(shape.x, shape.y);
        return (
          <g transform={`translate(${sx}, ${sy})`}>
            {isCircle ? (
              <ellipse
                cx={displayW / 2} cy={displayH / 2}
                rx={displayW / 2} ry={displayH / 2}
                fill={shapeColor}
                opacity={0.9}
              />
            ) : (
              <rect width={displayW} height={displayH} rx={3} fill={shapeColor} opacity={0.9} />
            )}
            <text
              x={displayW / 2} y={displayH / 2 + 3}
              textAnchor="middle" fill="white"
              fontSize={7} fontFamily="system-ui" fontWeight={700}
            >
              ★
            </text>
          </g>
        );
      })()}

      {/* Copy count label */}
      <text x={PREVIEW_W - 6} y={PREVIEW_H - 6} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="system-ui">
        {patches.length} copies
      </text>
    </svg>
  );
}

// ── Number Input ───────────────────────────────────────────────────────────────

function NumInput({
  label, value, onChange, min, max, step, unit,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 8, color: 'var(--muted, #888)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {unit && <span style={{ color: 'var(--text, #e2e8f0)', opacity: 0.6 }}>{value}{unit}</span>}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bg, #131320)',
          border: '1px solid var(--border, #2d2d3d)',
          color: 'var(--text, #e2e8f0)', fontSize: 10,
          padding: '3px 6px', borderRadius: 4, outline: 'none',
        }}
      />
    </label>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const PATTERN_TABS: { id: PatternType; label: string; emoji: string }[] = [
  { id: 'grid',   label: 'Grid',   emoji: '⊞' },
  { id: 'ring',   label: 'Ring',   emoji: '⊙' },
  { id: 'arc',    label: 'Arc',    emoji: '⌢' },
  { id: 'spiral', label: 'Spiral', emoji: '🌀' },
];

export function GridDuplicatorPanel({ open, onClose, selectedShape, onDuplicate }: Props) {
  const [pattern, setPattern] = useState<PatternType>('grid');

  const [grid, setGrid] = useState<GridConfig>({ rows: 3, cols: 4, gapX: 20, gapY: 20 });
  const [ring, setRing] = useState<RingConfig>({ count: 8, radius: 120, rotateWithAngle: false });
  const [arc, setArc] = useState<ArcConfig>({ count: 7, radius: 150, startAngle: -90, endAngle: 90, rotateWithAngle: true });
  const [spiral, setSpiral] = useState<SpiralConfig>({ count: 12, startRadius: 30, spacing: 18, turns: 2 });

  const [progressive, setProgressive] = useState<ProgressiveOptions>({
    scaleDown: false, fadeOut: false, rotateInc: 0,
  });

  const [applied, setApplied] = useState(false);

  const rawPatches = useMemo(() => {
    if (!selectedShape) return [];
    switch (pattern) {
      case 'grid':   return computeGridPositions(selectedShape, grid);
      case 'ring':   return computeRingPositions(selectedShape, ring);
      case 'arc':    return computeArcPositions(selectedShape, arc);
      case 'spiral': return computeSpiralPositions(selectedShape, spiral);
    }
  }, [selectedShape, pattern, grid, ring, arc, spiral]);

  const patches = useMemo(() => {
    if (progressive.scaleDown || progressive.fadeOut || progressive.rotateInc !== 0) {
      return applyProgressive(rawPatches, progressive);
    }
    return rawPatches;
  }, [rawPatches, progressive]);

  const handleApply = useCallback(() => {
    if (patches.length === 0) return;
    onDuplicate(patches);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }, [patches, onDuplicate]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 20,
      width: 320,
      maxHeight: '88vh',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      zIndex: 40,
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>⊞</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>Grid Duplicator</span>
          {selectedShape && (
            <span style={{
              fontSize: 9, background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#818cf8', padding: '1px 5px', borderRadius: 4, fontWeight: 600,
            }}>
              {selectedShape.name || selectedShape.type}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ── No shape ── */}
        {!selectedShape && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--muted, #888)', fontSize: 11 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⊞</div>
            <div style={{ fontWeight: 600, color: 'var(--text, #e2e8f0)', marginBottom: 4 }}>No shape selected</div>
            <div>Select a shape on the canvas to duplicate it in a pattern.</div>
          </div>
        )}

        {selectedShape && (
          <>
            {/* ── Pattern preview ── */}
            <div style={{ padding: '10px 12px 8px' }}>
              <PatternPreview shape={selectedShape} patches={patches} />
            </div>

            {/* ── Pattern tabs ── */}
            <div style={{
              display: 'flex', gap: 4, padding: '0 12px 8px',
              borderBottom: '1px solid var(--border, #2d2d3d)',
              flexShrink: 0,
            }}>
              {PATTERN_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPattern(tab.id)}
                  style={{
                    flex: 1, height: 28, fontSize: 10,
                    background: pattern === tab.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                    border: `1px solid ${pattern === tab.id ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                    borderRadius: 5, cursor: 'pointer',
                    color: pattern === tab.id ? '#818cf8' : 'var(--muted, #888)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  <span>{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Pattern controls ── */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
              {pattern === 'grid' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <NumInput label="Rows" value={grid.rows} onChange={v => setGrid(g => ({ ...g, rows: Math.max(1, v) }))} min={1} max={20} />
                  <NumInput label="Columns" value={grid.cols} onChange={v => setGrid(g => ({ ...g, cols: Math.max(1, v) }))} min={1} max={20} />
                  <NumInput label="Gap X" value={grid.gapX} onChange={v => setGrid(g => ({ ...g, gapX: v }))} unit="px" />
                  <NumInput label="Gap Y" value={grid.gapY} onChange={v => setGrid(g => ({ ...g, gapY: v }))} unit="px" />
                </div>
              )}

              {pattern === 'ring' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <NumInput label="Count" value={ring.count} onChange={v => setRing(r => ({ ...r, count: Math.max(2, v) }))} min={2} max={36} />
                  <NumInput label="Radius" value={ring.radius} onChange={v => setRing(r => ({ ...r, radius: Math.max(1, v) }))} unit="px" min={10} />
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={ring.rotateWithAngle}
                      onChange={e => setRing(r => ({ ...r, rotateWithAngle: e.target.checked }))}
                      style={{ accentColor: '#6366f1', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>Rotate with angle</span>
                  </div>
                </div>
              )}

              {pattern === 'arc' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <NumInput label="Count" value={arc.count} onChange={v => setArc(a => ({ ...a, count: Math.max(2, v) }))} min={2} max={36} />
                  <NumInput label="Radius" value={arc.radius} onChange={v => setArc(a => ({ ...a, radius: Math.max(1, v) }))} unit="px" min={10} />
                  <NumInput label="Start angle" value={arc.startAngle} onChange={v => setArc(a => ({ ...a, startAngle: v }))} unit="°" />
                  <NumInput label="End angle" value={arc.endAngle} onChange={v => setArc(a => ({ ...a, endAngle: v }))} unit="°" />
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={arc.rotateWithAngle}
                      onChange={e => setArc(a => ({ ...a, rotateWithAngle: e.target.checked }))}
                      style={{ accentColor: '#6366f1', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>Rotate with angle</span>
                  </div>
                </div>
              )}

              {pattern === 'spiral' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <NumInput label="Count" value={spiral.count} onChange={v => setSpiral(s => ({ ...s, count: Math.max(2, v) }))} min={2} max={64} />
                  <NumInput label="Start radius" value={spiral.startRadius} onChange={v => setSpiral(s => ({ ...s, startRadius: Math.max(1, v) }))} unit="px" />
                  <NumInput label="Spacing" value={spiral.spacing} onChange={v => setSpiral(s => ({ ...s, spacing: Math.max(0, v) }))} unit="px" />
                  <NumInput label="Turns" value={spiral.turns} onChange={v => setSpiral(s => ({ ...s, turns: Math.max(0.5, v) }))} step={0.5} />
                </div>
              )}
            </div>

            {/* ── Progressive options ── */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 6, fontWeight: 600 }}>
                PROGRESSIVE TRANSFORMS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={progressive.scaleDown}
                    onChange={e => setProgressive(p => ({ ...p, scaleDown: e.target.checked }))}
                    style={{ accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>Scale down (−5% per copy)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={progressive.fadeOut}
                    onChange={e => setProgressive(p => ({ ...p, fadeOut: e.target.checked }))}
                    style={{ accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>Fade out (−10% opacity per copy)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted, #888)', flexShrink: 0 }}>Extra rotation:</span>
                  <input
                    type="number"
                    value={progressive.rotateInc}
                    step={5}
                    onChange={e => setProgressive(p => ({ ...p, rotateInc: +e.target.value }))}
                    style={{
                      width: 60,
                      background: 'var(--bg, #131320)',
                      border: '1px solid var(--border, #2d2d3d)',
                      color: 'var(--text, #e2e8f0)', fontSize: 10,
                      padding: '2px 6px', borderRadius: 4, outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 9, color: 'var(--muted, #888)' }}>° per copy</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      {selectedShape && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border, #2d2d3d)',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: 'var(--muted, #888)', flex: 1 }}>
            {patches.length} shape{patches.length !== 1 ? 's' : ''} will be created
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--border, #2d2d3d)',
              borderRadius: 6, color: 'var(--muted, #888)',
              fontSize: 11, padding: '5px 12px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={patches.length === 0}
            style={{
              background: applied ? 'rgba(34,197,94,0.2)' : patches.length > 0 ? 'var(--accent, #6366f1)' : 'rgba(99,102,241,0.2)',
              border: 'none', borderRadius: 6,
              color: applied ? '#22c55e' : patches.length > 0 ? 'white' : 'rgba(255,255,255,0.3)',
              fontSize: 11, fontWeight: 600,
              padding: '5px 14px', cursor: patches.length > 0 ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            {applied ? '✓ Created!' : `Apply ${patches.length > 0 ? `(${patches.length})` : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
