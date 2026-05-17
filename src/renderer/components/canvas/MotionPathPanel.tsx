/**
 * MotionPathPanel — Animate a shape along a custom motion path.
 *
 * Uses CSS `offset-path` / `offset-distance` (Motion Path Level 1 spec)
 * to animate a live preview element along a bezier or polyline path
 * that the user draws interactively.
 *
 * Features:
 * - Draw path: click to add waypoints (straight segments)
 * - Convert to smooth bezier with "Smooth" toggle
 * - Adjust duration, easing, loop
 * - Live preview: a ghost element travels the path in the panel
 * - Copy CSS button: outputs `offset-path` + `offset-distance` keyframes
 * - Export as SVG SMIL animation too
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number }

interface MotionPathPanelProps {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 320;
const CANVAS_H = 220;
const POINT_RADIUS = 5;
const COLORS = {
  path: '#6366f1',
  pathGlow: 'rgba(99,102,241,0.25)',
  point: '#818cf8',
  pointHover: '#c7d2fe',
  pointActive: '#ffffff',
  ghost: '#f59e0b',
  bg: 'rgba(10,10,20,0.95)',
};

const EASING_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'cubic-bezier(0.68,-0.55,0.27,1.55)', label: 'Overshoot' },
  { value: 'steps(6,end)', label: 'Steps (6)' },
];

// ── Bezier helpers ─────────────────────────────────────────────────────────────

/** Catmull-Rom → cubic bezier control points for smooth interpolation */
function catmullRomToBezier(pts: Point[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  }

  let d = `M${pts[0].x},${pts[0].y}`;

  // Generate control points
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x},${p2.y}`;
  }

  return d;
}

function polylinePath(pts: Point[]): string {
  if (pts.length === 0) return '';
  const [first, ...rest] = pts;
  return `M${first.x},${first.y}` + rest.map(p => ` L${p.x},${p.y}`).join('');
}

// ── CSS generator ─────────────────────────────────────────────────────────────

function generateCss(
  pathD: string,
  duration: number,
  easing: string,
  iterations: string,
  shapeName: string,
): string {
  const name = (shapeName || 'element').replace(/\s+/g, '-').toLowerCase();
  return `/* Motion Path Animation */
.${name} {
  offset-path: path('${pathD}');
  offset-distance: 0%;
  animation: ${name}-motion ${duration}ms ${easing} ${iterations};
}

@keyframes ${name}-motion {
  from { offset-distance: 0%; }
  to   { offset-distance: 100%; }
}`;
}

// ── Path utilities ─────────────────────────────────────────────────────────────

/** Total length approximation for polyline (used for ghost position) */
function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/** Get point along polyline at fraction t ∈ [0,1] */
function polylinePoint(pts: Point[], t: number): Point {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];

  const totalLen = polylineLength(pts);
  const target = t * totalLen;
  let accumulated = 0;

  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (accumulated + segLen >= target) {
      const rem = target - accumulated;
      const frac = segLen > 0 ? rem / segLen : 0;
      return {
        x: pts[i - 1].x + dx * frac,
        y: pts[i - 1].y + dy * frac,
      };
    }
    accumulated += segLen;
  }
  return pts[pts.length - 1];
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        borderRadius: 5,
        border: '1px solid rgba(99,102,241,0.4)',
        background: copied ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.1)',
        color: copied ? '#c7d2fe' : '#818cf8',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {copied ? '✓ Copied' : 'Copy CSS'}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MotionPathPanel({ open, onClose, selectedShape }: MotionPathPanelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Path waypoints
  const [points, setPoints] = useState<Point[]>([
    { x: 40, y: 180 },
    { x: 120, y: 60 },
    { x: 200, y: 140 },
    { x: 280, y: 40 },
  ]);
  const [smooth, setSmooth] = useState(true);
  const [dragging, setDragging] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [mode, setMode] = useState<'edit' | 'draw'>('edit');

  // Animation settings
  const [duration, setDuration] = useState(1500);
  const [easing, setEasing] = useState('ease-in-out');
  const [loop, setLoop] = useState('infinite');

  // Ghost animation (CSS-based via SVG motion)
  const [playing, setPlaying] = useState(true);
  const [ghostT, setGhostT] = useState(0);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Animation loop for ghost
  useEffect(() => {
    if (!playing || points.length < 2) return;

    const tick = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const t = (elapsed % duration) / duration;
      setGhostT(t);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      startTimeRef.current = null;
    };
  }, [playing, duration, points]);

  const pathD = smooth ? catmullRomToBezier(points) : polylinePath(points);

  // Ghost position (for smooth: approx via polyline; exact SVG requires path length API)
  const ghostPt = polylinePoint(points, ghostT);

  // ── Interaction ────────────────────────────────────────────────────────────

  const svgCoordsFromEvent = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(CANVAS_W, e.clientX - rect.left)),
      y: Math.max(0, Math.min(CANVAS_H, e.clientY - rect.top)),
    };
  }, []);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const pt = svgCoordsFromEvent(e);

    if (mode === 'draw') {
      setPoints(prev => [...prev, pt]);
      return;
    }

    // Edit mode: hit test points
    const idx = points.findIndex(p => {
      const dx = p.x - pt.x;
      const dy = p.y - pt.y;
      return Math.sqrt(dx * dx + dy * dy) <= POINT_RADIUS + 4;
    });

    if (idx >= 0) {
      e.preventDefault();
      setDragging(idx);
    }
  }, [mode, points, svgCoordsFromEvent]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging === null) return;
    const pt = svgCoordsFromEvent(e);
    setPoints(prev => prev.map((p, i) => i === dragging ? pt : p));
  }, [dragging, svgCoordsFromEvent]);

  const handleSvgMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handlePointDoubleClick = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (points.length <= 2) return; // keep at least 2
    setPoints(prev => prev.filter((_, i) => i !== idx));
  }, [points]);

  const clearPath = useCallback(() => {
    setPoints([{ x: 40, y: 180 }, { x: 280, y: 40 }]);
  }, []);

  const addPreset = useCallback((preset: string) => {
    switch (preset) {
      case 'wave':
        setPoints([
          { x: 20, y: 110 },
          { x: 80, y: 50 },
          { x: 140, y: 110 },
          { x: 200, y: 50 },
          { x: 260, y: 110 },
          { x: 300, y: 110 },
        ]);
        break;
      case 'circle':
        setPoints(Array.from({ length: 9 }, (_, i) => {
          const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
          return {
            x: CANVAS_W / 2 + Math.cos(angle) * 80,
            y: CANVAS_H / 2 + Math.sin(angle) * 80,
          };
        }));
        setSmooth(true);
        break;
      case 'zigzag':
        setPoints([
          { x: 20, y: 60 },
          { x: 80, y: 170 },
          { x: 140, y: 60 },
          { x: 200, y: 170 },
          { x: 260, y: 60 },
          { x: 300, y: 60 },
        ]);
        setSmooth(false);
        break;
      case 'spiral':
        setPoints(Array.from({ length: 12 }, (_, i) => {
          const t = i / 11;
          const angle = t * Math.PI * 4;
          const radius = 90 - t * 70;
          return {
            x: CANVAS_W / 2 + Math.cos(angle) * radius,
            y: CANVAS_H / 2 + Math.sin(angle) * radius,
          };
        }));
        setSmooth(true);
        break;
      case 'bounce':
        setPoints([
          { x: 20, y: 40 },
          { x: 80, y: 180 },
          { x: 120, y: 80 },
          { x: 160, y: 180 },
          { x: 200, y: 120 },
          { x: 240, y: 180 },
          { x: 300, y: 150 },
        ]);
        setSmooth(true);
        break;
    }
  }, []);

  const cssOutput = pathD
    ? generateCss(pathD, duration, easing, loop, selectedShape?.name ?? 'shape')
    : '';

  if (!open) return null;

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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 700,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'linear-gradient(135deg,rgba(15,15,25,0.98),rgba(20,15,30,0.98))',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          color: '#e2e8f0',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
              ▶ Motion Path
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Draw a path • animate your shape along it • export CSS
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* Left: SVG Canvas */}
          <div style={{ flex: '0 0 auto' }}>
            {/* Toolbar row */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Mode toggle */}
              {(['edit', 'draw'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    borderRadius: 5,
                    border: `1px solid ${mode === m ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: mode === m ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    color: mode === m ? '#c7d2fe' : '#94a3b8',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {m === 'edit' ? '✦ Edit' : '✏ Draw'}
                </button>
              ))}

              <button
                onClick={() => setSmooth(s => !s)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 5,
                  border: `1px solid ${smooth ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  background: smooth ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                  color: smooth ? '#6ee7b7' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                {smooth ? '⌒ Smooth' : '∧ Sharp'}
              </button>

              <button
                onClick={() => { setPlaying(p => !p); startTimeRef.current = null; }}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 5,
                  border: '1px solid rgba(245,158,11,0.35)',
                  background: playing ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                  color: playing ? '#fde68a' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                {playing ? '⏸' : '▶'} Preview
              </button>

              <button
                onClick={clearPath}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 5,
                  border: '1px solid rgba(239,68,68,0.25)',
                  background: 'rgba(239,68,68,0.07)',
                  color: '#f87171',
                  cursor: 'pointer',
                }}
              >
                ✕ Clear
              </button>
            </div>

            {/* Preset paths */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {[
                { id: 'wave', label: '〜 Wave' },
                { id: 'circle', label: '○ Circle' },
                { id: 'zigzag', label: '⌄ Zigzag' },
                { id: 'spiral', label: '@ Spiral' },
                { id: 'bounce', label: '⌇ Bounce' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => addPreset(p.id)}
                  style={{
                    padding: '3px 7px',
                    fontSize: 10,
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* SVG canvas */}
            <svg
              ref={svgRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{
                display: 'block',
                borderRadius: 10,
                border: '1px solid rgba(99,102,241,0.2)',
                background: 'rgba(8,8,18,0.9)',
                cursor: mode === 'draw' ? 'crosshair' : 'default',
                userSelect: 'none',
              }}
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
            >
              {/* Grid lines */}
              {Array.from({ length: Math.ceil(CANVAS_H / 20) + 1 }, (_, i) => (
                <line
                  key={`h${i}`}
                  x1={0} y1={i * 20}
                  x2={CANVAS_W} y2={i * 20}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: Math.ceil(CANVAS_W / 20) + 1 }, (_, i) => (
                <line
                  key={`v${i}`}
                  x1={i * 20} y1={0}
                  x2={i * 20} y2={CANVAS_H}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth={1}
                />
              ))}

              {/* Glow path */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={COLORS.pathGlow}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Main path */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={COLORS.path}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="none"
                />
              )}

              {/* Direction arrows along path */}
              {points.length >= 2 && Array.from({ length: 3 }, (_, i) => {
                const t = (i + 1) / 4;
                const pt1 = polylinePoint(points, Math.max(0, t - 0.02));
                const pt2 = polylinePoint(points, Math.min(1, t + 0.02));
                const angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * 180 / Math.PI;
                const mp = polylinePoint(points, t);
                return (
                  <g key={i} transform={`translate(${mp.x},${mp.y}) rotate(${angle})`} opacity={0.4}>
                    <polygon points="-5,-3 5,0 -5,3" fill={COLORS.path} />
                  </g>
                );
              })}

              {/* Waypoint lines from last to new point in draw mode */}
              {mode === 'draw' && points.length > 0 && (
                <circle
                  cx={points[points.length - 1].x}
                  cy={points[points.length - 1].y}
                  r={8}
                  fill="none"
                  stroke="rgba(99,102,241,0.3)"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              )}

              {/* Control point handles */}
              {points.map((p, i) => (
                <g key={i}>
                  {/* Outer ring on hover */}
                  {hovered === i && (
                    <circle
                      cx={p.x} cy={p.y}
                      r={POINT_RADIUS + 5}
                      fill="none"
                      stroke={COLORS.pointHover}
                      strokeWidth={1}
                      opacity={0.4}
                    />
                  )}
                  {/* Point */}
                  <circle
                    cx={p.x} cy={p.y}
                    r={POINT_RADIUS}
                    fill={dragging === i ? COLORS.pointActive : hovered === i ? COLORS.pointHover : COLORS.point}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={1}
                    style={{ cursor: mode === 'edit' ? 'grab' : 'default' }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onDoubleClick={(e) => handlePointDoubleClick(e, i)}
                  />
                  {/* Index label */}
                  <text
                    x={p.x} y={p.y - 9}
                    textAnchor="middle"
                    fontSize={8}
                    fill="rgba(255,255,255,0.4)"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {i + 1}
                  </text>
                </g>
              ))}

              {/* Ghost element (preview) */}
              {playing && points.length >= 2 && (
                <g transform={`translate(${ghostPt.x},${ghostPt.y})`}>
                  {/* Glow */}
                  <circle r={14} fill={COLORS.ghost} opacity={0.12} />
                  {/* Main dot */}
                  <circle r={8} fill={COLORS.ghost} opacity={0.9} />
                  <circle r={3} fill="#ffffff" opacity={0.8} />
                  {/* Trail */}
                  {Array.from({ length: 5 }, (_, i) => {
                    const t2 = Math.max(0, ghostT - (i + 1) * 0.04);
                    const tp = polylinePoint(points, t2);
                    return (
                      <circle
                        key={i}
                        cx={tp.x - ghostPt.x}
                        cy={tp.y - ghostPt.y}
                        r={5 - i * 0.7}
                        fill={COLORS.ghost}
                        opacity={0.3 - i * 0.05}
                      />
                    );
                  })}
                </g>
              )}

              {/* "Draw mode" hint */}
              {mode === 'draw' && (
                <text x={CANVAS_W / 2} y={CANVAS_H - 8} textAnchor="middle" fontSize={9} fill="rgba(99,102,241,0.5)">
                  Click to add points • double-click point to remove
                </text>
              )}
              {mode === 'edit' && (
                <text x={CANVAS_W / 2} y={CANVAS_H - 8} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.12)">
                  Drag points • double-click to delete • switch to Draw mode to add
                </text>
              )}
            </svg>

            {/* Point count */}
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4, textAlign: 'right' }}>
              {points.length} waypoints · {smooth ? 'smooth bezier' : 'linear'} path
            </div>
          </div>

          {/* Right: Controls */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Duration */}
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>Duration</span>
                <span style={{ color: '#6366f1', fontWeight: 600 }}>{duration}ms</span>
              </div>
              <input
                type="range"
                min={200}
                max={6000}
                step={100}
                value={duration}
                onChange={e => { setDuration(Number(e.target.value)); startTimeRef.current = null; }}
                style={{ width: '100%', accentColor: '#6366f1' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#334155', marginTop: 2 }}>
                <span>0.2s</span>
                <span>6s</span>
              </div>
            </div>

            {/* Easing */}
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Easing</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {EASING_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: 5,
                      background: easing === opt.value ? 'rgba(99,102,241,0.12)' : 'transparent',
                      border: `1px solid ${easing === opt.value ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                      transition: 'all 0.12s',
                    }}
                  >
                    <input
                      type="radio"
                      name="easing"
                      value={opt.value}
                      checked={easing === opt.value}
                      onChange={() => setEasing(opt.value)}
                      style={{ accentColor: '#6366f1' }}
                    />
                    <span style={{ fontSize: 11, color: easing === opt.value ? '#c7d2fe' : '#64748b' }}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Loop */}
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Iterations</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['infinite', '1', '2', '3'].map(v => (
                  <button
                    key={v}
                    onClick={() => setLoop(v)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      borderRadius: 5,
                      border: `1px solid ${loop === v ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      background: loop === v ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                      color: loop === v ? '#c7d2fe' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    {v === 'infinite' ? '∞' : `${v}×`}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected shape info */}
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(99,102,241,0.07)',
              border: '1px solid rgba(99,102,241,0.15)',
            }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Animating shape</div>
              {selectedShape ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  <span style={{ color: '#818cf8', fontWeight: 600 }}>{selectedShape.name || 'Unnamed'}</span>
                  {' '}
                  <span style={{ fontSize: 10, color: '#334155' }}>
                    ({selectedShape.type} · {Math.round(selectedShape.width)}×{Math.round(selectedShape.height)})
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#334155' }}>
                  No shape selected — select one to animate
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CSS output */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              Generated CSS (offset-path)
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CopyButton text={cssOutput} />
            </div>
          </div>
          <pre style={{
            fontSize: 10,
            color: '#64748b',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 8,
            padding: '10px 12px',
            overflowX: 'auto',
            margin: 0,
            lineHeight: 1.6,
            fontFamily: 'ui-monospace,SFMono-Regular,monospace',
            maxHeight: 140,
            overflowY: 'auto',
          }}>
            {cssOutput || '// Add at least 2 waypoints to generate CSS'}
          </pre>
        </div>

        {/* SVG export */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>
            SVG SMIL Animation
          </div>
          <pre style={{
            fontSize: 10,
            color: '#64748b',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 8,
            padding: '10px 12px',
            overflowX: 'auto',
            margin: 0,
            lineHeight: 1.6,
            fontFamily: 'ui-monospace,SFMono-Regular,monospace',
          }}>
            {pathD ? `<animateMotion dur="${(duration / 1000).toFixed(1)}s"
  repeatCount="${loop}"
  calcMode="spline"
  keyTimes="0;1"
  keySplines="0.42 0 0.58 1">
  <mpath href="#motion-path"/>
</animateMotion>

<path id="motion-path" d="${pathD}"
  fill="none" stroke="none"/>` : '// Add waypoints to generate SVG'}
          </pre>
        </div>

        {/* Footer tip */}
        <div style={{
          marginTop: 16,
          padding: '8px 12px',
          borderRadius: 6,
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.12)',
          fontSize: 10,
          color: '#78716c',
          lineHeight: 1.5,
        }}>
          💡 <strong style={{ color: '#92400e' }}>Tip:</strong> Add <code style={{ color: '#a16207' }}>offset-rotate: auto</code> to rotate the element along the path direction.
          Use <strong style={{ color: '#92400e' }}>Draw mode</strong> to click and add waypoints anywhere on the canvas.
          Double-click a point to remove it.
        </div>
      </div>
    </div>
  );
}
