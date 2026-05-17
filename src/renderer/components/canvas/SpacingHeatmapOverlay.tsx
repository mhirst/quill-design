/**
 * SpacingHeatmapOverlay — Visual density / spacing analysis overlay for Quill.
 *
 * Renders two complementary visualizations toggled in the control panel:
 *
 * 1. Spacing Heatmap
 *    - Divides canvas into cells, counts shape coverage per cell
 *    - Renders a color gradient: blue (empty) → green (sparse) → yellow (dense) → red (very dense)
 *    - Reveals crowded regions at a glance
 *    - Cell size control (16–128px)
 *
 * 2. Gap Arrows
 *    - For each adjacent pair of shapes (by proximity), draws a labeled arrow
 *      showing the pixel gap between their closest edges
 *    - Color codes: green (aligned to 8px grid) / yellow (close but off-grid) / red (overlap!)
 *    - Only shows gaps ≤ 400px to avoid clutter
 *
 * 3. Alignment Guides
 *    - Highlights which shapes share the same left/top/right/bottom/center edges
 *    - Color coded by axis (blue = horizontal center, orange = vertical center, etc.)
 *
 * Controls: Toggle mode, cell size, opacity, show/hide labels
 * Keyboard: ⌘⌥H to toggle
 */

import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HeatmapMode = 'density' | 'gaps' | 'alignment';

interface Props {
  open: boolean;
  shapes: Shape[];
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
}

// ─── Color Helpers ────────────────────────────────────────────────────────────

/** Hot-cold color: 0 = blue, 0.5 = green/yellow, 1 = red */
function heatColor(t: number, alpha: number): string {
  // Interpolate: blue → cyan → green → yellow → red
  const clamp = Math.max(0, Math.min(1, t));
  let r: number, g: number, b: number;
  if (clamp < 0.25) {
    // blue → cyan
    const f = clamp / 0.25;
    r = 0; g = Math.round(255 * f); b = 255;
  } else if (clamp < 0.5) {
    // cyan → green
    const f = (clamp - 0.25) / 0.25;
    r = 0; g = 255; b = Math.round(255 * (1 - f));
  } else if (clamp < 0.75) {
    // green → yellow
    const f = (clamp - 0.5) / 0.25;
    r = Math.round(255 * f); g = 255; b = 0;
  } else {
    // yellow → red
    const f = (clamp - 0.75) / 0.25;
    r = 255; g = Math.round(255 * (1 - f)); b = 0;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Density Heatmap ──────────────────────────────────────────────────────────

interface Cell { col: number; row: number; coverage: number }

function computeHeatCells(shapes: Shape[], cellSize: number, canvasW: number, canvasH: number): Cell[] {
  const cols = Math.ceil(canvasW / cellSize);
  const rows = Math.ceil(canvasH / cellSize);
  const grid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (const shape of shapes) {
    // Which cells does this shape cover?
    const c0 = Math.max(0, Math.floor(shape.x / cellSize));
    const c1 = Math.min(cols - 1, Math.ceil((shape.x + shape.width) / cellSize));
    const r0 = Math.max(0, Math.floor(shape.y / cellSize));
    const r1 = Math.min(rows - 1, Math.ceil((shape.y + shape.height) / cellSize));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        // Compute actual overlap area
        const cx0 = c * cellSize, cx1 = cx0 + cellSize;
        const cy0 = r * cellSize, cy1 = cy0 + cellSize;
        const overlapW = Math.max(0, Math.min(shape.x + shape.width, cx1) - Math.max(shape.x, cx0));
        const overlapH = Math.max(0, Math.min(shape.y + shape.height, cy1) - Math.max(shape.y, cy0));
        const area = overlapW * overlapH;
        const cellArea = cellSize * cellSize;
        grid[r][c] += area / cellArea;
      }
    }
  }

  const maxCoverage = Math.max(1, ...grid.flat());
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] > 0.01) {
        cells.push({ col: c, row: r, coverage: grid[r][c] / maxCoverage });
      }
    }
  }
  return cells;
}

function DensityHeatmap({ shapes, cellSize, opacity, zoom, panX, panY, cw, ch }: {
  shapes: Shape[]; cellSize: number; opacity: number;
  zoom: number; panX: number; panY: number; cw: number; ch: number;
}) {
  // Transform to screen coords
  const toScreenX = (x: number) => x * zoom + panX;
  const toScreenY = (y: number) => y * zoom + panY;
  const screenCellSize = cellSize * zoom;

  const cells = useMemo(() => computeHeatCells(shapes, cellSize, 4000, 3000), [shapes, cellSize]);

  return (
    <g>
      {cells.map((cell, i) => {
        const sx = toScreenX(cell.col * cellSize);
        const sy = toScreenY(cell.row * cellSize);
        if (sx + screenCellSize < 0 || sx > cw || sy + screenCellSize < 0 || sy > ch) return null;
        return (
          <rect
            key={i}
            x={sx} y={sy}
            width={screenCellSize} height={screenCellSize}
            fill={heatColor(cell.coverage, opacity * 0.7)}
            stroke={heatColor(cell.coverage, opacity * 0.1)}
            strokeWidth={0.5}
          />
        );
      })}
    </g>
  );
}

// ─── Gap Arrows ───────────────────────────────────────────────────────────────

interface Gap {
  ax: number; ay: number; bx: number; by: number;
  gap: number; onGrid: boolean; isOverlap: boolean;
}

function computeGaps(shapes: Shape[], maxGap: number): Gap[] {
  const gaps: Gap[] = [];
  const n = shapes.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = shapes[i], b = shapes[j];

      // Find closest edges between a and b
      // Horizontal gap
      const aRight = a.x + a.width, bRight = b.x + b.width;
      const aBottom = a.y + a.height, bBottom = b.y + b.height;

      // Check if vertically overlapping (horizontal gap possible)
      const vertOverlap = a.y < bBottom && aBottom > b.y;
      if (vertOverlap) {
        const hGap = b.x > aRight ? b.x - aRight : a.x > bRight ? a.x - bRight : -(Math.min(aRight, bRight) - Math.max(a.x, b.x));
        if (Math.abs(hGap) <= maxGap) {
          const midY = (Math.max(a.y, b.y) + Math.min(aBottom, bBottom)) / 2;
          const ax = b.x > aRight ? aRight : bRight;
          const bx = b.x > aRight ? b.x : a.x;
          gaps.push({
            ax, ay: midY, bx, by: midY,
            gap: hGap, onGrid: Math.abs(hGap) % 8 === 0, isOverlap: hGap < 0,
          });
          continue; // Only report one gap per pair
        }
      }

      // Check if horizontally overlapping (vertical gap possible)
      const horizOverlap = a.x < bRight && aRight > b.x;
      if (horizOverlap) {
        const vGap = b.y > aBottom ? b.y - aBottom : a.y > bBottom ? a.y - bBottom : -(Math.min(aBottom, bBottom) - Math.max(a.y, b.y));
        if (Math.abs(vGap) <= maxGap) {
          const midX = (Math.max(a.x, b.x) + Math.min(aRight, bRight)) / 2;
          const ay = b.y > aBottom ? aBottom : bBottom;
          const by = b.y > aBottom ? b.y : a.y;
          gaps.push({
            ax: midX, ay, bx: midX, by,
            gap: vGap, onGrid: Math.abs(vGap) % 8 === 0, isOverlap: vGap < 0,
          });
        }
      }
    }
  }

  return gaps;
}

function GapArrows({ shapes, maxGap, showLabels, opacity, zoom, panX, panY }: {
  shapes: Shape[]; maxGap: number; showLabels: boolean; opacity: number;
  zoom: number; panX: number; panY: number;
}) {
  const gaps = useMemo(() => computeGaps(shapes, maxGap), [shapes, maxGap]);
  const toSX = (x: number) => x * zoom + panX;
  const toSY = (y: number) => y * zoom + panY;

  return (
    <g opacity={opacity}>
      {gaps.map((gap, i) => {
        const x1 = toSX(gap.ax), y1 = toSY(gap.ay);
        const x2 = toSX(gap.bx), y2 = toSY(gap.by);
        const color = gap.isOverlap ? '#ef4444' : gap.onGrid ? '#34d399' : '#fbbf24';
        const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
        const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        if (len < 3) return null;

        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth={1.5}
              strokeDasharray={gap.isOverlap ? '4 2' : 'none'}
              markerEnd={`url(#arrow-${color.replace('#','')})`}
              markerStart={`url(#arrow-${color.replace('#','')})`}
            />
            {showLabels && len > 20 && (
              <g>
                <rect x={midX-14} y={midY-7} width={28} height={13} rx={3}
                  fill="rgba(0,0,0,0.75)" />
                <text x={midX} y={midY+4}
                  fill={color} fontSize={8} fontFamily="monospace"
                  textAnchor="middle" fontWeight={700}>
                  {gap.isOverlap ? `⚠${Math.abs(gap.gap)}` : `${gap.gap}px`}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ─── Alignment Guides ─────────────────────────────────────────────────────────

interface AlignGroup { axis: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV'; value: number; shapeIds: string[] }

function computeAlignGroups(shapes: Shape[], tolerance: number): AlignGroup[] {
  const groups: AlignGroup[] = [];
  const addGroup = (axis: AlignGroup['axis'], value: number, ids: string[]) => {
    if (ids.length >= 2) groups.push({ axis, value, shapeIds: ids });
  };

  // Group by each axis
  const axes: Array<{ axis: AlignGroup['axis']; fn: (s: Shape) => number }> = [
    { axis: 'left', fn: s => s.x },
    { axis: 'right', fn: s => s.x + s.width },
    { axis: 'top', fn: s => s.y },
    { axis: 'bottom', fn: s => s.y + s.height },
    { axis: 'centerH', fn: s => s.x + s.width / 2 },
    { axis: 'centerV', fn: s => s.y + s.height / 2 },
  ];

  for (const { axis, fn } of axes) {
    const values = shapes.map(s => ({ id: s.id, v: fn(s) }));
    const seen = new Set<string>();
    for (let i = 0; i < values.length; i++) {
      if (seen.has(values[i].id)) continue;
      const group = [values[i].id];
      for (let j = i + 1; j < values.length; j++) {
        if (Math.abs(values[j].v - values[i].v) <= tolerance) {
          group.push(values[j].id);
          seen.add(values[j].id);
        }
      }
      if (group.length >= 2) {
        seen.add(values[i].id);
        addGroup(axis, values[i].v, group);
      }
    }
  }

  return groups;
}

const AXIS_COLORS: Record<AlignGroup['axis'], string> = {
  left: '#60a5fa', right: '#3b82f6',
  top: '#fb923c', bottom: '#ea580c',
  centerH: '#a78bfa', centerV: '#8b5cf6',
};

function AlignmentGuides({ shapes, tolerance, opacity, zoom, panX, panY, cw, ch }: {
  shapes: Shape[]; tolerance: number; opacity: number;
  zoom: number; panX: number; panY: number; cw: number; ch: number;
}) {
  const groups = useMemo(() => computeAlignGroups(shapes, tolerance), [shapes, tolerance]);
  const toSX = (x: number) => x * zoom + panX;
  const toSY = (y: number) => y * zoom + panY;

  return (
    <g opacity={opacity}>
      {groups.map((group, i) => {
        const color = AXIS_COLORS[group.axis];
        const isVertical = group.axis === 'left' || group.axis === 'right' || group.axis === 'centerH';
        const screenVal = isVertical ? toSX(group.value) : toSY(group.value);
        const key = `${group.axis}-${i}`;

        // Only render if on screen
        if (isVertical && (screenVal < 0 || screenVal > cw)) return null;
        if (!isVertical && (screenVal < 0 || screenVal > ch)) return null;

        return (
          <g key={key}>
            {isVertical ? (
              <line x1={screenVal} y1={0} x2={screenVal} y2={ch}
                stroke={color} strokeWidth={1} opacity={0.6}
                strokeDasharray="3 3" />
            ) : (
              <line x1={0} y1={screenVal} x2={cw} y2={screenVal}
                stroke={color} strokeWidth={1} opacity={0.6}
                strokeDasharray="3 3" />
            )}
            {/* Dots on each aligned shape */}
            {group.shapeIds.map(id => {
              const shape = shapes.find(s => s.id === id);
              if (!shape) return null;
              const dotX = isVertical ? screenVal : toSX(shape.x + shape.width / 2);
              const dotY = isVertical ? toSY(shape.y + shape.height / 2) : screenVal;
              return (
                <circle key={id} cx={dotX} cy={dotY} r={3}
                  fill={color} opacity={0.9} />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

// ─── Control Panel ─────────────────────────────────────────────────────────────

interface ControlProps {
  mode: HeatmapMode;
  onModeChange: (m: HeatmapMode) => void;
  cellSize: number;
  onCellSizeChange: (n: number) => void;
  opacity: number;
  onOpacityChange: (n: number) => void;
  maxGap: number;
  onMaxGapChange: (n: number) => void;
  showLabels: boolean;
  onShowLabelsChange: (v: boolean) => void;
  tolerance: number;
  onToleranceChange: (n: number) => void;
  onClose: () => void;
  shapeCount: number;
}

function HeatmapControls({
  mode, onModeChange, cellSize, onCellSizeChange, opacity, onOpacityChange,
  maxGap, onMaxGapChange, showLabels, onShowLabelsChange,
  tolerance, onToleranceChange, onClose, shapeCount,
}: ControlProps) {
  const MODES: { id: HeatmapMode; label: string; emoji: string; desc: string }[] = [
    { id: 'density', label: 'Density', emoji: '🌡️', desc: 'Shape coverage heatmap' },
    { id: 'gaps', label: 'Gaps', emoji: '↔️', desc: 'Spacing between shapes' },
    { id: 'alignment', label: 'Alignment', emoji: '⟺', desc: 'Shared edge guides' },
  ];

  return (
    <div style={{
      position: 'absolute', top: 48, left: 12, width: 220,
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 30, pointerEvents: 'all',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12 }}>🗺️</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
            Spacing Heatmap
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 8, color: 'var(--muted, #666)' }}>{shapeCount} shapes</span>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>
            ×
          </button>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => onModeChange(m.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 6px', marginBottom: 3, borderRadius: 5, textAlign: 'left',
              background: mode === m.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: `1px solid ${mode === m.id ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
              cursor: 'pointer',
            }}>
            <span style={{ fontSize: 14 }}>{m.emoji}</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: mode === m.id ? '#818cf8' : 'var(--text, #e2e8f0)' }}>
                {m.label}
              </div>
              <div style={{ fontSize: 8, color: 'var(--muted, #666)' }}>{m.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Opacity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Overlay opacity</span>
            <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <input type="range" min={0.1} max={1} step={0.05} value={opacity}
            onChange={e => onOpacityChange(+e.target.value)}
            style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }} />
        </div>

        {mode === 'density' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Cell size</span>
              <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>{cellSize}px</span>
            </div>
            <input type="range" min={16} max={128} step={8} value={cellSize}
              onChange={e => onCellSizeChange(+e.target.value)}
              style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }} />
          </div>
        )}

        {mode === 'gaps' && (
          <>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Max gap shown</span>
                <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>{maxGap}px</span>
              </div>
              <input type="range" min={50} max={500} step={50} value={maxGap}
                onChange={e => onMaxGapChange(+e.target.value)}
                style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={showLabels}
                onChange={e => onShowLabelsChange(e.target.checked)}
                id="show-labels" style={{ accentColor: '#818cf8', cursor: 'pointer' }} />
              <label htmlFor="show-labels" style={{ fontSize: 9, color: 'var(--muted, #888)', cursor: 'pointer' }}>
                Show pixel labels
              </label>
            </div>
            {/* Legend */}
            <div style={{ fontSize: 8, color: 'var(--muted, #666)', lineHeight: 1.6, borderTop: '1px solid var(--border, #2d2d3d)', paddingTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 2, background: '#34d399', borderRadius: 1 }} />
                <span>On 8px grid (consistent)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 2, background: '#fbbf24', borderRadius: 1 }} />
                <span>Off-grid (inconsistent)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 2, background: '#ef4444', borderRadius: 1, border: 'none' }} />
                <span>Overlap detected!</span>
              </div>
            </div>
          </>
        )}

        {mode === 'alignment' && (
          <>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Snap tolerance</span>
                <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>±{tolerance}px</span>
              </div>
              <input type="range" min={0} max={10} step={1} value={tolerance}
                onChange={e => onToleranceChange(+e.target.value)}
                style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }} />
            </div>
            {/* Legend */}
            <div style={{ fontSize: 8, color: 'var(--muted, #666)', lineHeight: 1.8, borderTop: '1px solid var(--border, #2d2d3d)', paddingTop: 6 }}>
              {Object.entries(AXIS_COLORS).map(([axis, color]) => (
                <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 2, background: color, borderRadius: 1 }} />
                  <span style={{ textTransform: 'capitalize' }}>
                    {axis === 'centerH' ? 'H-center' : axis === 'centerV' ? 'V-center' : axis}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function SpacingHeatmapOverlay({ open, shapes, zoom, panX, panY, canvasWidth, canvasHeight }: Props) {
  const [mode, setMode] = useState<HeatmapMode>('gaps');
  const [showControls, setShowControls] = useState(true);
  const [cellSize, setCellSize] = useState(48);
  const [opacity, setOpacity] = useState(0.6);
  const [maxGap, setMaxGap] = useState(200);
  const [showLabels, setShowLabels] = useState(true);
  const [tolerance, setTolerance] = useState(2);

  if (!open) return null;

  const LABEL: Record<HeatmapMode, string> = {
    density: '🌡️ Density',
    gaps: '↔️ Gaps',
    alignment: '⟺ Alignment',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        {/* Arrowhead markers for gap mode */}
        <defs>
          {['34d399', 'fbbf24', 'ef4444'].map(hex => (
            <marker key={hex} id={`arrow-${hex}`} markerWidth={6} markerHeight={6}
              refX={3} refY={3} orient="auto">
              <path d="M0,0 L0,6 L6,3 Z" fill={`#${hex}`} />
            </marker>
          ))}
        </defs>

        {mode === 'density' && (
          <DensityHeatmap
            shapes={shapes} cellSize={cellSize} opacity={opacity}
            zoom={zoom} panX={panX} panY={panY} cw={canvasWidth} ch={canvasHeight}
          />
        )}
        {mode === 'gaps' && (
          <GapArrows
            shapes={shapes} maxGap={maxGap} showLabels={showLabels} opacity={opacity}
            zoom={zoom} panX={panX} panY={panY}
          />
        )}
        {mode === 'alignment' && (
          <AlignmentGuides
            shapes={shapes} tolerance={tolerance} opacity={opacity}
            zoom={zoom} panX={panX} panY={panY}
            cw={canvasWidth} ch={canvasHeight}
          />
        )}
      </svg>

      {/* Toggle button */}
      <div style={{ position: 'absolute', top: 8, left: 12, pointerEvents: 'all' }}>
        <button
          onClick={() => setShowControls(v => !v)}
          style={{
            height: 28, padding: '0 10px',
            background: showControls ? 'rgba(99,102,241,0.2)' : 'var(--panel, #1e1e2e)',
            border: `1px solid ${showControls ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
            borderRadius: 6, cursor: 'pointer',
            color: showControls ? '#818cf8' : 'var(--muted, #888)',
            fontSize: 10, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {LABEL[mode]}
        </button>
      </div>

      {/* Controls panel */}
      {showControls && (
        <div style={{ pointerEvents: 'all' }}>
          <HeatmapControls
            mode={mode} onModeChange={setMode}
            cellSize={cellSize} onCellSizeChange={setCellSize}
            opacity={opacity} onOpacityChange={setOpacity}
            maxGap={maxGap} onMaxGapChange={setMaxGap}
            showLabels={showLabels} onShowLabelsChange={setShowLabels}
            tolerance={tolerance} onToleranceChange={setTolerance}
            onClose={() => setShowControls(false)}
            shapeCount={shapes.length}
          />
        </div>
      )}
    </div>
  );
}
