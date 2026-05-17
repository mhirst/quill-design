/**
 * ClipPathEditor — Visual CSS clip-path polygon editor.
 *
 * Drag control points to define a custom polygon clip-path on any shape.
 * The result is a CSS `clip-path: polygon(...)` string that can be applied
 * as a custom CSS style override on selected shapes.
 *
 * Features:
 * - Drag control points on an interactive SVG canvas
 * - Preset shapes: triangle, diamond, pentagon, hexagon, arrow, chevron, star, parallelogram
 * - Add/remove control points
 * - Live preview showing the clip shape
 * - Copy CSS string
 * - Reset to rectangle (no clip)
 *
 * Note: clip-path is stored as `clipPath` on the Shape for future rendering support.
 * For now the tool primarily serves as a CSS generator for dev handoff.
 */

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onApplyClipPath: (ids: string[], clipPath: string) => void;
}

interface ControlPoint {
  id: string;
  x: number; // 0–100 percentage
  y: number;
}

// ── Preset shapes ─────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  name: string;
  emoji: string;
  points: Array<[number, number]>; // [x%, y%] pairs
}

const PRESETS: Preset[] = [
  {
    id: 'rectangle',
    name: 'Rectangle',
    emoji: '▭',
    points: [[0, 0], [100, 0], [100, 100], [0, 100]],
  },
  {
    id: 'triangle',
    name: 'Triangle',
    emoji: '△',
    points: [[50, 0], [100, 100], [0, 100]],
  },
  {
    id: 'diamond',
    name: 'Diamond',
    emoji: '◇',
    points: [[50, 0], [100, 50], [50, 100], [0, 50]],
  },
  {
    id: 'pentagon',
    name: 'Pentagon',
    emoji: '⬠',
    points: Array.from({ length: 5 }, (_, i) => {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return [50 + Math.cos(angle) * 50, 50 + Math.sin(angle) * 50] as [number, number];
    }),
  },
  {
    id: 'hexagon',
    name: 'Hexagon',
    emoji: '⬡',
    points: Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
      return [50 + Math.cos(angle) * 50, 50 + Math.sin(angle) * 50] as [number, number];
    }),
  },
  {
    id: 'arrow-right',
    name: 'Arrow →',
    emoji: '→',
    points: [[0, 20], [65, 20], [65, 0], [100, 50], [65, 100], [65, 80], [0, 80]],
  },
  {
    id: 'chevron',
    name: 'Chevron',
    emoji: '❯',
    points: [[0, 0], [75, 0], [100, 50], [75, 100], [0, 100], [25, 50]],
  },
  {
    id: 'star-5',
    name: 'Star',
    emoji: '★',
    points: Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 50 : 21;
      return [50 + Math.cos(angle) * r, 50 + Math.sin(angle) * r] as [number, number];
    }),
  },
  {
    id: 'trapezoid',
    name: 'Trapezoid',
    emoji: '⏢',
    points: [[15, 0], [85, 0], [100, 100], [0, 100]],
  },
  {
    id: 'parallelogram',
    name: 'Parallelgram',
    emoji: '▱',
    points: [[20, 0], [100, 0], [80, 100], [0, 100]],
  },
  {
    id: 'rounded-top',
    name: 'Message',
    emoji: '💬',
    points: [[0, 0], [100, 0], [100, 80], [30, 80], [0, 100], [20, 80], [0, 80]],
  },
  {
    id: 'cross',
    name: 'Plus',
    emoji: '✚',
    points: [
      [30, 0], [70, 0], [70, 30], [100, 30], [100, 70], [70, 70],
      [70, 100], [30, 100], [30, 70], [0, 70], [0, 30], [30, 30],
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2, 8); }

function pointsToCss(points: ControlPoint[]): string {
  return `polygon(${points.map(p => `${p.x.toFixed(1)}% ${p.y.toFixed(1)}%`).join(', ')})`;
}

const CANVAS_SIZE = 260;
const POINT_RADIUS = 7;
const COLORS = {
  fill: 'rgba(99,102,241,0.2)',
  stroke: '#6366f1',
  point: '#818cf8',
  pointHover: '#c7d2fe',
  pointActive: '#ffffff',
  bg: 'rgba(10,10,22,0.9)',
  preview: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
};

// ── Copy button ───────────────────────────────────────────────────────────────

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

export function ClipPathEditor({ open, onClose, selectedShape, selectedShapeIds, onApplyClipPath }: Props) {
  const [points, setPoints] = useState<ControlPoint[]>([
    { id: genId(), x: 0, y: 0 },
    { id: genId(), x: 100, y: 0 },
    { id: genId(), x: 100, y: 100 },
    { id: genId(), x: 0, y: 100 },
  ]);

  const [dragging, setDragging] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>('rectangle');

  const svgRef = useRef<SVGSVGElement>(null);

  const getIds = useCallback(() => {
    if (selectedShapeIds.length > 0) return selectedShapeIds;
    if (selectedShape) return [selectedShape.id];
    return [];
  }, [selectedShape, selectedShapeIds]);

  const cssPoly = useMemo(() => pointsToCss(points), [points]);

  // Convert SVG canvas coords to %-based control point
  const svgToPercent = useCallback((sx: number, sy: number): { x: number; y: number } => ({
    x: Math.max(0, Math.min(100, (sx / CANVAS_SIZE) * 100)),
    y: Math.max(0, Math.min(100, (sy / CANVAS_SIZE) * 100)),
  }), []);

  const svgCoordsFromEvent = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { sx: 0, sy: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
    };
  }, []);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const { sx, sy } = svgCoordsFromEvent(e);
    const target = e.target as SVGElement;

    // Check if clicking a control point
    const pointId = target.dataset.pointId;
    if (pointId) {
      e.preventDefault();
      setDragging(pointId);
      setAddMode(false);
      return;
    }

    // Add new point in add mode
    if (addMode && (target.tagName === 'svg' || target.tagName === 'polygon' || target.tagName === 'rect')) {
      const { x, y } = svgToPercent(sx, sy);
      // Insert after the nearest segment
      const nearest = findNearestSegment(points, x, y);
      const newPoint: ControlPoint = { id: genId(), x, y };
      const next = [...points];
      next.splice(nearest + 1, 0, newPoint);
      setPoints(next);
      setActivePreset(null);
    }
  }, [addMode, points, svgCoordsFromEvent, svgToPercent]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const { sx, sy } = svgCoordsFromEvent(e);
    const { x, y } = svgToPercent(sx, sy);
    setPoints(prev => prev.map(p => p.id === dragging ? { ...p, x, y } : p));
    setActivePreset(null);
  }, [dragging, svgCoordsFromEvent, svgToPercent]);

  const handleSvgMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const deletePoint = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (points.length <= 3) return; // keep at least 3
    setPoints(prev => prev.filter(p => p.id !== id));
    setActivePreset(null);
  }, [points]);

  const applyPreset = useCallback((preset: Preset) => {
    setPoints(preset.points.map(([x, y]) => ({ id: genId(), x, y })));
    setActivePreset(preset.id);
  }, []);

  const applyToShape = useCallback(() => {
    const ids = getIds();
    if (ids.length === 0) return;
    onApplyClipPath(ids, cssPoly);
  }, [getIds, cssPoly, onApplyClipPath]);

  // SVG polygon points string
  const svgPolygonPoints = useMemo(() =>
    points.map(p => `${(p.x / 100) * CANVAS_SIZE},${(p.y / 100) * CANVAS_SIZE}`).join(' '),
    [points]
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
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 660,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'linear-gradient(135deg,rgba(12,12,22,0.99),rgba(18,10,28,0.99))',
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
            <div style={{ fontSize: 16, fontWeight: 700 }}>✦ Clip Path Editor</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              Drag points to define a polygon clip mask · copy CSS for dev handoff
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* Left: Editor canvas */}
          <div style={{ flex: '0 0 auto' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                onClick={() => setAddMode(a => !a)}
                style={{
                  padding: '4px 10px', fontSize: 10, borderRadius: 5,
                  border: `1px solid ${addMode ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  background: addMode ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)',
                  color: addMode ? '#6ee7b7' : '#64748b', cursor: 'pointer',
                }}
              >
                {addMode ? '✓ Click to add' : '+ Add Point'}
              </button>
              <button
                onClick={() => applyPreset(PRESETS[0])}
                style={{
                  padding: '4px 10px', fontSize: 10, borderRadius: 5,
                  border: '1px solid rgba(239,68,68,0.2)',
                  background: 'rgba(239,68,68,0.06)',
                  color: '#f87171', cursor: 'pointer',
                }}
              >
                ↺ Reset
              </button>
            </div>

            {/* Canvas */}
            <svg
              ref={svgRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              style={{
                display: 'block',
                borderRadius: 10,
                border: '1px solid rgba(99,102,241,0.2)',
                background: COLORS.bg,
                cursor: addMode ? 'crosshair' : 'default',
                userSelect: 'none',
              }}
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
            >
              {/* Background grid */}
              {Array.from({ length: 5 }, (_, i) => [
                <line key={`h${i}`} x1={0} y1={(i + 1) * CANVAS_SIZE / 5} x2={CANVAS_SIZE} y2={(i + 1) * CANVAS_SIZE / 5} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />,
                <line key={`v${i}`} x1={(i + 1) * CANVAS_SIZE / 5} y1={0} x2={(i + 1) * CANVAS_SIZE / 5} y2={CANVAS_SIZE} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />,
              ])}

              {/* Center crosshair */}
              <line x1={CANVAS_SIZE / 2} y1={0} x2={CANVAS_SIZE / 2} y2={CANVAS_SIZE} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} strokeDasharray="4 4" />
              <line x1={0} y1={CANVAS_SIZE / 2} x2={CANVAS_SIZE} y2={CANVAS_SIZE / 2} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} strokeDasharray="4 4" />

              {/* Preview background (checkerboard for transparent context) */}
              <rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} fill="rgba(255,255,255,0.02)" />

              {/* Clipped preview shape */}
              <defs>
                <clipPath id="cp-preview">
                  <polygon points={svgPolygonPoints} />
                </clipPath>
                <linearGradient id="cp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>

              {/* Shape fill */}
              <rect
                x={0} y={0}
                width={CANVAS_SIZE} height={CANVAS_SIZE}
                fill="url(#cp-grad)"
                opacity={0.25}
                clipPath="url(#cp-preview)"
              />

              {/* Polygon outline */}
              <polygon
                points={svgPolygonPoints}
                fill={COLORS.fill}
                stroke={COLORS.stroke}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Segment lines */}
              {points.map((p, i) => {
                const next = points[(i + 1) % points.length];
                const sx = (p.x / 100) * CANVAS_SIZE;
                const sy = (p.y / 100) * CANVAS_SIZE;
                const ex = (next.x / 100) * CANVAS_SIZE;
                const ey = (next.y / 100) * CANVAS_SIZE;
                return (
                  <line key={p.id} x1={sx} y1={sy} x2={ex} y2={ey}
                    stroke={COLORS.stroke} strokeWidth={1} opacity={0.5} />
                );
              })}

              {/* Control points */}
              {points.map((p) => {
                const sx = (p.x / 100) * CANVAS_SIZE;
                const sy = (p.y / 100) * CANVAS_SIZE;
                const isActive = dragging === p.id;
                const isHov = hovered === p.id;
                return (
                  <g key={p.id}>
                    {isHov && (
                      <circle cx={sx} cy={sy} r={POINT_RADIUS + 5} fill="none" stroke={COLORS.pointHover} strokeWidth={1} opacity={0.4} />
                    )}
                    <circle
                      cx={sx} cy={sy}
                      r={POINT_RADIUS}
                      fill={isActive ? COLORS.pointActive : isHov ? COLORS.pointHover : COLORS.point}
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth={1.5}
                      style={{ cursor: 'grab' }}
                      data-point-id={p.id}
                      onMouseEnter={() => setHovered(p.id)}
                      onMouseLeave={() => setHovered(null)}
                      onDoubleClick={e => deletePoint(p.id, e)}
                    />
                    {/* Coords label */}
                    <text
                      x={sx + 10} y={sy - 6}
                      fontSize={7}
                      fill="rgba(255,255,255,0.3)"
                      style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'monospace' }}
                    >
                      {p.x.toFixed(0)},{p.y.toFixed(0)}%
                    </text>
                  </g>
                );
              })}

              {/* Instructions */}
              <text x={CANVAS_SIZE / 2} y={CANVAS_SIZE - 6} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.12)">
                {addMode ? 'Click to add point' : 'Drag points · double-click to delete'}
              </text>
            </svg>

            {/* Point count */}
            <div style={{ fontSize: 10, color: '#334155', marginTop: 4, textAlign: 'right' }}>
              {points.length} points
            </div>
          </div>

          {/* Right: Presets + output */}
          <div style={{ flex: 1 }}>
            {/* Presets */}
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Presets
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 16 }}>
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  style={{
                    padding: '6px 4px',
                    borderRadius: 6,
                    border: `1px solid ${activePreset === preset.id ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.05)'}`,
                    background: activePreset === preset.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'all 0.12s',
                  }}
                >
                  {/* Mini polygon preview */}
                  <svg width={32} height={24} style={{ overflow: 'visible' }}>
                    <polygon
                      points={preset.points.map(([x, y]) => `${x * 0.32},${y * 0.24}`).join(' ')}
                      fill={activePreset === preset.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}
                      stroke={activePreset === preset.id ? '#818cf8' : 'rgba(255,255,255,0.15)'}
                      strokeWidth={1}
                    />
                  </svg>
                  <span style={{ fontSize: 8, color: activePreset === preset.id ? '#c7d2fe' : '#475569', textAlign: 'center' }}>
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Apply to shape */}
            <button
              onClick={applyToShape}
              disabled={targetCount === 0}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: 12, fontWeight: 600,
                borderRadius: 8,
                border: '1px solid rgba(99,102,241,0.4)',
                background: targetCount > 0 ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.04)',
                color: targetCount > 0 ? '#c7d2fe' : '#334155',
                cursor: targetCount > 0 ? 'pointer' : 'not-allowed',
                marginBottom: 16,
                transition: 'all 0.15s',
              }}
            >
              {targetCount > 0 ? `Apply clip-path to ${targetCount} shape${targetCount > 1 ? 's' : ''}` : 'Select a shape first'}
            </button>

            {/* CSS output */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>CSS clip-path</span>
                <CopyButton text={`clip-path: ${cssPoly};`} />
              </div>
              <div style={{
                fontSize: 10,
                color: '#64748b',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 6,
                padding: '8px 10px',
                wordBreak: 'break-all',
                lineHeight: 1.6,
                maxHeight: 120,
                overflowY: 'auto',
              }}>
                clip-path: {cssPoly};
              </div>

              {/* Point table */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>Point coordinates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 100, overflowY: 'auto' }}>
                  {points.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: 'monospace', color: '#64748b' }}>
                      <span style={{ color: '#334155', width: 16 }}>{i + 1}.</span>
                      <span style={{ color: '#6366f1' }}>{p.x.toFixed(1)}%</span>
                      <span>{p.y.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Geometry helper ───────────────────────────────────────────────────────────

function findNearestSegment(points: ControlPoint[], x: number, y: number): number {
  let minDist = Infinity;
  let nearest = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dist = Math.hypot(x - mx, y - my);
    if (dist < minDist) {
      minDist = dist;
      nearest = i;
    }
  }
  return nearest;
}
