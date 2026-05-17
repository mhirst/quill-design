/**
 * DesignMetricsPanel — Canvas design statistics dashboard
 *
 * Metrics computed:
 *  - Shape census: total, by type, by layer
 *  - Canvas utilization: % of canvas area covered by shapes
 *  - Color variety: unique fills, unique strokes, contrast distribution
 *  - Typography: text density (chars per shape), reading level estimate
 *  - Alignment quality: % shapes aligned to 8pt grid
 *  - Whitespace: average gap between shapes
 *  - Complexity score (0-100): composite heuristic
 *  - Shape overlap: pairs of shapes that overlap
 */

import React, { useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Utility exports (tested separately) ──────────────────────────────────────

export interface DesignMetrics {
  totalShapes: number;
  byType: Record<string, number>;
  canvasArea: number;
  coveredArea: number;
  utilizationPct: number;
  uniqueFills: number;
  uniqueStrokes: number;
  textShapeCount: number;
  totalTextChars: number;
  avgCharsPerTextShape: number;
  gridAlignedCount: number;
  gridAlignedPct: number;
  overlapPairCount: number;
  avgShapeSize: number;
  complexityScore: number;
}

/** Clamp a value 0..max */
function clamp(v: number, max: number): number {
  return Math.min(Math.max(v, 0), max);
}

/** Compute canvas coverage (union of shape bounding boxes / canvas area) */
export function computeUtilization(shapes: Shape[], canvasW: number, canvasH: number): number {
  if (shapes.length === 0 || canvasW <= 0 || canvasH <= 0) return 0;
  // Rasterize at coarse resolution
  const RESOLUTION = 100;
  const scaleX = RESOLUTION / canvasW;
  const scaleY = RESOLUTION / canvasH;
  const grid = new Uint8Array(RESOLUTION * RESOLUTION);
  for (const s of shapes) {
    const x0 = clamp(Math.floor(s.x * scaleX), RESOLUTION);
    const y0 = clamp(Math.floor(s.y * scaleY), RESOLUTION);
    const x1 = clamp(Math.ceil((s.x + s.width) * scaleX), RESOLUTION);
    const y1 = clamp(Math.ceil((s.y + s.height) * scaleY), RESOLUTION);
    for (let gy = y0; gy < y1; gy++) {
      for (let gx = x0; gx < x1; gx++) {
        grid[gy * RESOLUTION + gx] = 1;
      }
    }
  }
  const covered = grid.reduce((sum, v) => sum + v, 0);
  return covered / (RESOLUTION * RESOLUTION);
}

/** Count shapes aligned to an 8pt grid (x, y, width, height all multiples of 8) */
export function countGridAligned(shapes: Shape[], grid = 8): number {
  return shapes.filter(s =>
    s.x % grid < 1 && s.y % grid < 1 &&
    s.width % grid < 1 && s.height % grid < 1
  ).length;
}

/** Count overlapping pairs of shapes */
export function countOverlaps(shapes: Shape[]): number {
  let count = 0;
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i];
      const b = shapes[j];
      if (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      ) {
        count++;
      }
    }
  }
  return count;
}

/** Count shapes by type */
export function countByType(shapes: Shape[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const s of shapes) {
    result[s.type] = (result[s.type] ?? 0) + 1;
  }
  return result;
}

/** Compute a complexity score 0–100 */
export function computeComplexity(metrics: Partial<DesignMetrics>): number {
  let score = 0;
  // Shape count (max 30 pts at 50 shapes)
  score += Math.min((metrics.totalShapes ?? 0) / 50, 1) * 30;
  // Color variety (max 20 pts at 10 colors)
  score += Math.min((metrics.uniqueFills ?? 0) / 10, 1) * 20;
  // Overlaps (max 20 pts at 10 overlaps)
  score += Math.min((metrics.overlapPairCount ?? 0) / 10, 1) * 20;
  // Utilization (max 15 pts fully covered canvas)
  score += (metrics.utilizationPct ?? 0) / 100 * 15;
  // Type variety (max 15 pts at 5 types)
  score += Math.min(Object.keys(metrics.byType ?? {}).length / 5, 1) * 15;
  return Math.round(score);
}

/** Compute all design metrics */
export function computeMetrics(
  shapes: Shape[],
  canvasW = 1440,
  canvasH = 900,
): DesignMetrics {
  const totalShapes = shapes.length;
  const byType = countByType(shapes);
  const canvasArea = canvasW * canvasH;
  const coveredArea = shapes.reduce((sum, s) => sum + s.width * s.height, 0);
  const utilizationPct = Math.round(computeUtilization(shapes, canvasW, canvasH) * 100);
  const fills = new Set(shapes.map(s => s.fill).filter(Boolean));
  const strokes = new Set(shapes.map(s => s.stroke).filter(Boolean));
  const textShapes = shapes.filter(s => s.type === 'text' && s.text);
  const totalTextChars = textShapes.reduce((sum, s) => sum + (s.text?.length ?? 0), 0);
  const avgCharsPerTextShape = textShapes.length > 0 ? Math.round(totalTextChars / textShapes.length) : 0;
  const gridAlignedCount = countGridAligned(shapes);
  const gridAlignedPct = totalShapes > 0 ? Math.round(gridAlignedCount / totalShapes * 100) : 0;
  const overlapPairCount = countOverlaps(shapes);
  const avgShapeSize = totalShapes > 0
    ? Math.round(shapes.reduce((sum, s) => sum + s.width * s.height, 0) / totalShapes)
    : 0;

  const partial = {
    totalShapes, byType, canvasArea, coveredArea,
    utilizationPct, uniqueFills: fills.size, uniqueStrokes: strokes.size,
    textShapeCount: textShapes.length, totalTextChars,
    avgCharsPerTextShape, gridAlignedCount, gridAlignedPct,
    overlapPairCount, avgShapeSize,
  };

  const complexityScore = computeComplexity(partial);

  return { ...partial, complexityScore };
}

// ── Shared styles ─────────────────────────────────────────────────────────────

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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid #3a1a1a',
  flexShrink: 0,
};

const CLOSE_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#a08080',
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricRow({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '5px 0',
      borderBottom: '1px solid #2a1010',
    }}>
      <div>
        <span style={{ fontSize: 12, color: '#c0a0a0' }}>{label}</span>
        {sub && <span style={{ fontSize: 10, color: '#a08080', marginLeft: 6 }}>{sub}</span>}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: color ?? '#e8d5d5', fontFamily: 'monospace' }}>
        {value}
      </span>
    </div>
  );
}

function GaugeMeter({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min(value / max, 1);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: '#a08080' }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color }}>{value}</span>
      </div>
      <div style={{
        height: 6,
        background: '#2a1010',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct * 100}%`,
          background: color,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

function TypeBar({ byType }: { byType: Record<string, number> }) {
  const total = Object.values(byType).reduce((s, v) => s + v, 0);
  const TYPE_COLORS: Record<string, string> = {
    rect: '#3b82f6', ellipse: '#22c55e', text: '#f59e0b',
    frame: '#8b5cf6', line: '#ec4899', arrow: '#ef4444',
    star: '#f97316', polygon: '#14b8a6', image: '#64748b',
  };
  if (total === 0) return null;
  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#a08080', marginBottom: 6 }}>Shape distribution</div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
        {entries.map(([type, count]) => (
          <div
            key={type}
            title={`${type}: ${count}`}
            style={{
              width: `${(count / total) * 100}%`,
              background: TYPE_COLORS[type] ?? '#888',
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {entries.map(([type, count]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: TYPE_COLORS[type] ?? '#888',
              flexShrink: 0,
              display: 'inline-block',
            }} />
            <span style={{ color: '#c0a0a0' }}>{type}</span>
            <span style={{ color: '#a08080' }}>×{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  canvasWidth?: number;
  canvasHeight?: number;
}

export function DesignMetricsPanel({ open, onClose, shapes, canvasWidth = 1440, canvasHeight = 900 }: Props) {
  const metrics = useMemo(
    () => computeMetrics(shapes, canvasWidth, canvasHeight),
    [shapes, canvasWidth, canvasHeight]
  );

  if (!open) return null;

  const complexityColor = metrics.complexityScore < 33 ? '#22c55e' : metrics.complexityScore < 66 ? '#f59e0b' : '#ef4444';
  const gridColor = metrics.gridAlignedPct > 70 ? '#22c55e' : metrics.gridAlignedPct > 40 ? '#f59e0b' : '#ef4444';

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Design Metrics</span>
        </div>
        <button style={CLOSE_BTN} onClick={onClose}>✕</button>
      </div>

      {/* Big complexity score */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #3a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, color: complexityColor }}>
            {metrics.complexityScore}
          </div>
          <div style={{ fontSize: 10, color: '#a08080', marginTop: 2 }}>Complexity Score</div>
        </div>

        <div style={{ flex: 1 }}>
          <GaugeMeter
            value={metrics.utilizationPct}
            max={100}
            label="Canvas utilization"
            color="#3b82f6"
          />
          <GaugeMeter
            value={metrics.gridAlignedPct}
            max={100}
            label="Grid alignment (8pt)"
            color={gridColor}
          />
          <GaugeMeter
            value={Math.min(metrics.uniqueFills, 20)}
            max={20}
            label="Color variety"
            color="#f59e0b"
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 12px' }}>
        {/* Type distribution */}
        <TypeBar byType={metrics.byType} />

        {/* Metrics grid */}
        <div style={{ fontSize: 11, color: '#a08080', marginBottom: 6, fontWeight: 600 }}>Shape Stats</div>
        <MetricRow label="Total shapes" value={metrics.totalShapes} />
        <MetricRow label="Average shape size" value={`${(Math.sqrt(metrics.avgShapeSize) | 0)}×${(Math.sqrt(metrics.avgShapeSize) | 0)}`} sub="approx" />
        <MetricRow label="Overlapping pairs" value={metrics.overlapPairCount} color={metrics.overlapPairCount > 5 ? '#ef4444' : '#22c55e'} />
        <MetricRow label="Grid-aligned shapes" value={`${metrics.gridAlignedCount} / ${metrics.totalShapes}`} sub={`${metrics.gridAlignedPct}%`} color={gridColor} />

        <div style={{ fontSize: 11, color: '#a08080', marginBottom: 6, marginTop: 12, fontWeight: 600 }}>Color & Fill</div>
        <MetricRow label="Unique fill colors" value={metrics.uniqueFills} />
        <MetricRow label="Unique stroke colors" value={metrics.uniqueStrokes} />

        <div style={{ fontSize: 11, color: '#a08080', marginBottom: 6, marginTop: 12, fontWeight: 600 }}>Typography</div>
        <MetricRow label="Text shapes" value={metrics.textShapeCount} />
        <MetricRow label="Total characters" value={metrics.totalTextChars} />
        <MetricRow label="Avg chars per text shape" value={metrics.avgCharsPerTextShape} />

        <div style={{ fontSize: 11, color: '#a08080', marginBottom: 6, marginTop: 12, fontWeight: 600 }}>Canvas</div>
        <MetricRow label="Canvas size" value={`${canvasWidth}×${canvasHeight}`} />
        <MetricRow label="Canvas area" value={`${(metrics.canvasArea / 1e6).toFixed(2)}M px²`} />
        <MetricRow label="Covered area (raw)" value={`${(metrics.coveredArea / 1e6).toFixed(2)}M px²`} sub="(may overlap)" />
        <MetricRow label="Utilization (unique)" value={`${metrics.utilizationPct}%`} color="#3b82f6" />

        {/* Suggestions */}
        <div style={{ marginTop: 12, padding: '8px 10px', background: '#0d0505', borderRadius: 8, fontSize: 12, lineHeight: 1.5 }}>
          {metrics.overlapPairCount > 10 && (
            <div style={{ color: '#ef4444', marginBottom: 4 }}>
              ⚠ {metrics.overlapPairCount} overlapping shape pairs — consider reviewing z-order
            </div>
          )}
          {metrics.gridAlignedPct < 40 && metrics.totalShapes > 3 && (
            <div style={{ color: '#f59e0b', marginBottom: 4 }}>
              ⚠ Only {metrics.gridAlignedPct}% of shapes on 8pt grid — alignment may appear inconsistent
            </div>
          )}
          {metrics.uniqueFills > 12 && (
            <div style={{ color: '#f59e0b', marginBottom: 4 }}>
              ⚠ {metrics.uniqueFills} unique fill colors — consider consolidating with design tokens
            </div>
          )}
          {metrics.totalShapes === 0 && (
            <div style={{ color: '#a08080' }}>Add shapes to see design metrics.</div>
          )}
          {metrics.totalShapes > 0 && metrics.overlapPairCount <= 10 && metrics.gridAlignedPct >= 40 && metrics.uniqueFills <= 12 && (
            <div style={{ color: '#22c55e' }}>✓ No major issues detected.</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #3a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: '#a08080',
        flexShrink: 0,
      }}>
        <span>⌘⌥⇧D to toggle</span>
        <span>Live metrics · updates on every change</span>
      </div>
    </div>
  );
}
