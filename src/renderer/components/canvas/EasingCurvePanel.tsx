/**
 * EasingCurvePanel — Cubic-bezier easing curve editor and visualizer for Quill.
 *
 * Features:
 *  - Interactive cubic-bezier editor (drag control handles)
 *  - 30+ named presets (ease, ease-in, ease-out, ease-in-out, spring, bounce, etc.)
 *  - Category tabs: Standard, Material, iOS, Spring, Custom
 *  - Live animated preview ball showing the easing in action
 *  - Speed/duration slider
 *  - CSS output: cubic-bezier(x1, y1, x2, y2)
 *  - Apply to selected shape's transitionEasing property
 *  - Show velocity curve (derivative of position)
 *
 * Keyboard: ⌘⌥E
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EasingDef {
  id: string;
  label: string;
  category: EasingCategory;
  x1: number; y1: number;
  x2: number; y2: number;
  description?: string;
}

type EasingCategory = 'standard' | 'material' | 'ios' | 'expressive' | 'custom';

// ─── Easing Presets ────────────────────────────────────────────────────────────

export const EASING_PRESETS: EasingDef[] = [
  // Standard CSS
  { id: 'linear', label: 'Linear', category: 'standard', x1: 0, y1: 0, x2: 1, y2: 1 },
  { id: 'ease', label: 'Ease', category: 'standard', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  { id: 'ease-in', label: 'Ease In', category: 'standard', x1: 0.42, y1: 0, x2: 1, y2: 1 },
  { id: 'ease-out', label: 'Ease Out', category: 'standard', x1: 0, y1: 0, x2: 0.58, y2: 1 },
  { id: 'ease-in-out', label: 'Ease In Out', category: 'standard', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },

  // Material Design
  { id: 'md-standard', label: 'MD Standard', category: 'material', x1: 0.2, y1: 0, x2: 0, y2: 1, description: 'Material Design standard easing' },
  { id: 'md-decelerate', label: 'MD Decelerate', category: 'material', x1: 0, y1: 0, x2: 0, y2: 1, description: 'Entering screen elements' },
  { id: 'md-accelerate', label: 'MD Accelerate', category: 'material', x1: 0.3, y1: 0, x2: 1, y2: 1, description: 'Exiting screen elements' },
  { id: 'md-emphasized', label: 'MD Emphasized', category: 'material', x1: 0.2, y1: 0, x2: 0, y2: 1 },
  { id: 'md-emphasized-decel', label: 'MD Emph. Decel', category: 'material', x1: 0.05, y1: 0.7, x2: 0.1, y2: 1 },
  { id: 'md-emphasized-accel', label: 'MD Emph. Accel', category: 'material', x1: 0.3, y1: 0, x2: 0.8, y2: 0.15 },

  // iOS / Apple HIG
  { id: 'ios-default', label: 'iOS Default', category: 'ios', x1: 0.25, y1: 0.46, x2: 0.45, y2: 0.94 },
  { id: 'ios-in', label: 'iOS Ease In', category: 'ios', x1: 0.42, y1: 0, x2: 1, y2: 1 },
  { id: 'ios-out', label: 'iOS Ease Out', category: 'ios', x1: 0, y1: 0, x2: 0.58, y2: 1 },
  { id: 'ios-spring', label: 'iOS Spring', category: 'ios', x1: 0.5, y1: 1.35, x2: 0.65, y2: 1 },

  // Expressive / Creative
  { id: 'back-in', label: 'Back In', category: 'expressive', x1: 0.6, y1: -0.28, x2: 0.74, y2: 0.05 },
  { id: 'back-out', label: 'Back Out', category: 'expressive', x1: 0.175, y1: 0.885, x2: 0.32, y2: 1.275 },
  { id: 'back-in-out', label: 'Back In Out', category: 'expressive', x1: 0.68, y1: -0.55, x2: 0.265, y2: 1.55 },
  { id: 'elastic-out', label: 'Elastic Out', category: 'expressive', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  { id: 'bounce', label: 'Bounce', category: 'expressive', x1: 0.87, y1: -0.41, x2: 0.19, y2: 1.44 },
  { id: 'snappy', label: 'Snappy', category: 'expressive', x1: 0.5, y1: 0, x2: 0.1, y2: 1 },
  { id: 'overshoot', label: 'Overshoot', category: 'expressive', x1: 0.2, y1: 1.3, x2: 0.6, y2: 1 },
  { id: 'anticipate', label: 'Anticipate', category: 'expressive', x1: 0.18, y1: -0.29, x2: 0.73, y2: 1 },
  { id: 'pop', label: 'Pop', category: 'expressive', x1: 0.4, y1: 0, x2: 0.2, y2: 1.4 },
  { id: 'smooth', label: 'Smooth', category: 'expressive', x1: 0.45, y1: 0.05, x2: 0.55, y2: 0.95 },
  { id: 'crisp', label: 'Crisp', category: 'expressive', x1: 0.0, y1: 0.0, x2: 0.1, y2: 1.0 },
  { id: 'delayed', label: 'Delayed', category: 'expressive', x1: 0.7, y1: 0, x2: 0.84, y2: 0 },
  { id: 'swift', label: 'Swift', category: 'expressive', x1: 0.55, y1: 0, x2: 0.1, y2: 1 },
];

// ─── Cubic Bezier Math ─────────────────────────────────────────────────────────

/** Compute cubic bezier value at t ∈ [0,1] for a 1D bezier with p0=0, p3=1 */
function cubicBezier1D(t: number, p1: number, p2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
}

/** Sample the bezier curve: given x, find y (100 sample points) */
export function sampleCurve(x1: number, y1: number, x2: number, y2: number, steps = 80): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = cubicBezier1D(t, x1, x2);
    const y = cubicBezier1D(t, y1, y2);
    pts.push([x, y]);
  }
  return pts;
}

/** Evaluate y for a given x (Newton-Raphson approximation) */
export function evalCurve(x: number, x1: number, y1: number, x2: number, y2: number): number {
  // Binary search for t given x
  let lo = 0; let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const xMid = cubicBezier1D(mid, x1, x2);
    if (Math.abs(xMid - x) < 0.0001) {
      return cubicBezier1D(mid, y1, y2);
    }
    if (xMid < x) lo = mid; else hi = mid;
  }
  return cubicBezier1D((lo + hi) / 2, y1, y2);
}

/** Format cubic-bezier CSS string */
export function formatCubicBezier(x1: number, y1: number, x2: number, y2: number): string {
  const f = (n: number) => Number(n.toFixed(3)).toString();
  return `cubic-bezier(${f(x1)}, ${f(y1)}, ${f(x2)}, ${f(y2)})`;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const W = 220;
const H = 220;
const PAD = 24;
const PLOT_W = W - PAD * 2;
const PLOT_H = H - PAD * 2;

const CATEGORIES: Array<{ id: EasingCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'standard', label: 'CSS' },
  { id: 'material', label: 'Material' },
  { id: 'ios', label: 'iOS' },
  { id: 'expressive', label: 'Expressive' },
];

// ─── Component Props ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onApplyEasing: (easing: string, duration: number) => void;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function EasingCurvePanel({ open, onClose, selectedShape, onApplyEasing }: Props) {
  const [x1, setX1] = useState(0.25);
  const [y1, setY1] = useState(0.1);
  const [x2, setX2] = useState(0.25);
  const [y2, setY2] = useState(1.0);
  const [duration, setDuration] = useState(400);
  const [animProgress, setAnimProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [category, setCategory] = useState<EasingCategory | 'all'>('all');
  const [copiedText, setCopiedText] = useState(false);
  const [dragging, setDragging] = useState<'cp1' | 'cp2' | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number | null>(null);
  const animStartRef = useRef<number>(0);

  if (!open) return null;

  const cssValue = formatCubicBezier(x1, y1, x2, y2);
  const curvePoints = sampleCurve(x1, y1, x2, y2);

  // SVG coordinate helpers
  const toSvgX = (x: number) => PAD + x * PLOT_W;
  const toSvgY = (y: number) => PAD + (1 - y) * PLOT_H; // invert Y
  const fromSvgX = (svgX: number) => Math.max(0, Math.min(1, (svgX - PAD) / PLOT_W));
  const fromSvgY = (svgY: number) => 1 - (svgY - PAD) / PLOT_H; // y can be outside [0,1]

  // Build SVG path from sampled curve
  const pathD = curvePoints.map(([x, y], i) => {
    const sx = toSvgX(x);
    const sy = toSvgY(y);
    return `${i === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
  }).join(' ');

  // Animated preview ball
  const startAnimation = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setIsAnimating(true);
    animStartRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - animStartRef.current;
      const t = Math.min(elapsed / duration, 1);
      const progress = evalCurve(t, x1, y1, x2, y2);
      setAnimProgress(progress);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setIsAnimating(false);
        setAnimProgress(0);
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, [x1, y1, x2, y2, duration]);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Mouse drag for control points
  const handleMouseDown = useCallback((handle: 'cp1' | 'cp2') => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(handle);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;
    const nx = fromSvgX(svgX);
    const ny = fromSvgY(svgY);
    if (dragging === 'cp1') { setX1(Math.round(nx * 1000) / 1000); setY1(Math.round(ny * 1000) / 1000); }
    else { setX2(Math.round(nx * 1000) / 1000); setY2(Math.round(ny * 1000) / 1000); }
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  // Load a preset
  const loadPreset = useCallback((preset: EasingDef) => {
    setX1(preset.x1); setY1(preset.y1);
    setX2(preset.x2); setY2(preset.y2);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(cssValue).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 1500);
    });
  }, [cssValue]);

  // Filter presets
  const filteredPresets = category === 'all'
    ? EASING_PRESETS
    : EASING_PRESETS.filter(p => p.category === category);

  // Ball position for preview
  const ballY = 1 - animProgress; // 0 = bottom, 1 = top

  // Velocity curve (approximate derivative)
  const velocityPts = curvePoints.slice(1).map(([x, y], i) => {
    const [px, py] = curvePoints[i];
    const dx = x - px;
    const dy = y - py;
    const vel = dx > 0.001 ? Math.abs(dy / dx) : 0;
    return [x, vel] as [number, number];
  });
  const maxVel = Math.max(...velocityPts.map(([, v]) => v), 1);

  return (
    <div style={{
      position: 'fixed',
      right: 8,
      top: 60,
      width: 480,
      maxHeight: 'calc(100vh - 80px)',
      background: '#13131f',
      borderRadius: 12,
      border: '1px solid #2a2a4a',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      zIndex: 3100,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      color: '#c8c8e8',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0f0f1e', borderBottom: '1px solid #2a2a4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>〜</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f8', letterSpacing: 0.3 }}>Easing Curve Editor</span>
          <span style={{ fontSize: 10, color: '#555', background: '#1a1a2e', borderRadius: 4, padding: '1px 5px' }}>⌘⌥E</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Editor + preview */}
        <div style={{ width: W + 60, flexShrink: 0, borderRight: '1px solid #2a2a4a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Curve editor */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e1e3a' }}>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Curve Editor — drag handles</div>
            <svg
              ref={svgRef}
              width={W}
              height={H}
              style={{ display: 'block', background: '#0d0d1a', borderRadius: 8, border: '1px solid #1e1e3a', cursor: dragging ? 'grabbing' : 'default', userSelect: 'none' }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Grid */}
              {[0, 0.25, 0.5, 0.75, 1].map(v => (
                <g key={v}>
                  <line x1={toSvgX(v)} y1={PAD} x2={toSvgX(v)} y2={H - PAD} stroke="#1e1e3a" strokeWidth={1} />
                  <line x1={PAD} y1={toSvgY(v)} x2={W - PAD} y2={toSvgY(v)} stroke="#1e1e3a" strokeWidth={1} />
                </g>
              ))}

              {/* Linear reference diagonal */}
              <line x1={toSvgX(0)} y1={toSvgY(0)} x2={toSvgX(1)} y2={toSvgY(1)} stroke="#2a2a4a" strokeWidth={1} strokeDasharray="4,4" />

              {/* Easing curve */}
              <path d={pathD} fill="none" stroke="#7b7bff" strokeWidth={2} />

              {/* Control handle lines */}
              <line x1={toSvgX(0)} y1={toSvgY(0)} x2={toSvgX(x1)} y2={toSvgY(y1)} stroke="#ff9b4a" strokeWidth={1} strokeDasharray="3,2" />
              <line x1={toSvgX(1)} y1={toSvgY(1)} x2={toSvgX(x2)} y2={toSvgY(y2)} stroke="#4affaa" strokeWidth={1} strokeDasharray="3,2" />

              {/* Fixed anchor points */}
              <circle cx={toSvgX(0)} cy={toSvgY(0)} r={4} fill="#fff" />
              <circle cx={toSvgX(1)} cy={toSvgY(1)} r={4} fill="#fff" />

              {/* Control point 1 (orange) */}
              <circle
                cx={toSvgX(x1)} cy={toSvgY(y1)} r={7}
                fill="#ff9b4a" fillOpacity={0.3} stroke="#ff9b4a" strokeWidth={2}
                style={{ cursor: 'grab' }}
                onMouseDown={handleMouseDown('cp1')}
              />

              {/* Control point 2 (green) */}
              <circle
                cx={toSvgX(x2)} cy={toSvgY(y2)} r={7}
                fill="#4affaa" fillOpacity={0.3} stroke="#4affaa" strokeWidth={2}
                style={{ cursor: 'grab' }}
                onMouseDown={handleMouseDown('cp2')}
              />

              {/* Axis labels */}
              <text x={PAD} y={H - 4} fontSize={9} fill="#333" textAnchor="start">0</text>
              <text x={W - PAD} y={H - 4} fontSize={9} fill="#333" textAnchor="end">1</text>
              <text x={4} y={PAD} fontSize={9} fill="#333" textAnchor="start">1</text>
              <text x={4} y={H - PAD + 4} fontSize={9} fill="#333" textAnchor="start">0</text>
            </svg>
          </div>

          {/* Coordinate inputs */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #1e1e3a' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <InputField label="X1 (🟠)" value={x1} onChange={setX1} min={0} max={1} step={0.01} />
              <InputField label="Y1" value={y1} onChange={setY1} min={-2} max={2} step={0.01} />
              <InputField label="X2 (🟢)" value={x2} onChange={setX2} min={0} max={1} step={0.01} />
              <InputField label="Y2" value={y2} onChange={setY2} min={-2} max={2} step={0.01} />
            </div>
          </div>

          {/* CSS output */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #1e1e3a' }}>
            <div style={{ fontSize: 9, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>CSS</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ flex: 1, background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: 5, padding: '4px 8px', fontSize: 11, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cssValue}
              </div>
              <button onClick={handleCopy} style={{ padding: '4px 10px', background: '#2a2a4a', border: 'none', borderRadius: 5, color: '#bbbfff', cursor: 'pointer', fontSize: 10 }}>
                {copiedText ? '✓' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Animated preview */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #1e1e3a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Preview</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 9, color: '#555' }}>{duration}ms</label>
                <input type="range" min={100} max={2000} step={50} value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  style={{ width: 70, accentColor: '#7b7bff' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Ball track */}
              <div style={{ position: 'relative', width: 24, height: 80, background: '#0d0d1a', borderRadius: 4, border: '1px solid #1e1e3a' }}>
                <div style={{
                  position: 'absolute',
                  left: 4, right: 4,
                  height: 14, borderRadius: 7,
                  background: '#7b7bff',
                  top: `${(1 - animProgress) * (80 - 14)}px`,
                  transition: 'none',
                  boxShadow: '0 0 8px #7b7bff',
                }} />
              </div>
              {/* Horizontal track */}
              <div style={{ position: 'relative', height: 24, flex: 1, background: '#0d0d1a', borderRadius: 4, border: '1px solid #1e1e3a' }}>
                <div style={{
                  position: 'absolute',
                  top: 4, bottom: 4,
                  width: 14, borderRadius: 7,
                  background: '#ff9b4a',
                  left: `calc(${animProgress * 100}% - 7px)`,
                  transition: 'none',
                  boxShadow: '0 0 8px #ff9b4a',
                }} />
              </div>
              <button onClick={startAnimation} disabled={isAnimating}
                style={{ padding: '6px 12px', background: isAnimating ? '#1a1a3a' : '#2a2a5a', border: 'none', borderRadius: 6, color: isAnimating ? '#555' : '#bbbfff', cursor: isAnimating ? 'default' : 'pointer', fontSize: 11 }}>
                {isAnimating ? '▶' : '▶ Play'}
              </button>
            </div>
          </div>

          {/* Velocity curve mini */}
          <div style={{ padding: '8px 14px' }}>
            <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Velocity</div>
            <svg width="100%" height={40} style={{ display: 'block' }}>
              <polyline
                points={velocityPts.map(([x, v]) => `${x * 100}%,${(1 - v / maxVel) * 38 + 1}`).join(' ')}
                fill="none" stroke="#ff6b9b" strokeWidth={1.5}
              />
            </svg>
          </div>

          {/* Apply to shape */}
          {selectedShape && (
            <div style={{ padding: '6px 14px 10px', borderTop: '1px solid #1e1e3a' }}>
              <button onClick={() => onApplyEasing(cssValue, duration)}
                style={{ width: '100%', padding: '7px', background: '#2a2a5a', border: 'none', borderRadius: 6, color: '#bbbfff', cursor: 'pointer', fontSize: 11 }}>
                Apply to "{selectedShape.name}" (transition: {duration}ms)
              </button>
            </div>
          )}
        </div>

        {/* Right: Presets */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 2, padding: '8px 8px 4px', flexWrap: 'wrap', borderBottom: '1px solid #1e1e3a', flexShrink: 0 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id as EasingCategory | 'all')}
                style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: 'none', cursor: 'pointer', background: category === cat.id ? '#3a3a8a' : '#1e1e3a', color: category === cat.id ? '#bbbfff' : '#666' }}>
                {cat.label}
              </button>
            ))}
          </div>
          {/* Preset list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredPresets.map(preset => {
              const pts = sampleCurve(preset.x1, preset.y1, preset.x2, preset.y2, 30);
              const isActive = Math.abs(preset.x1 - x1) < 0.01 && Math.abs(preset.y1 - y1) < 0.01 && Math.abs(preset.x2 - x2) < 0.01 && Math.abs(preset.y2 - y2) < 0.01;
              const miniD = pts.map(([x, y], i) => {
                const sx = 4 + x * 52;
                const sy = 4 + (1 - Math.max(-0.5, Math.min(1.5, y))) * 52;
                return `${i === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
              }).join(' ');

              return (
                <button key={preset.id} onClick={() => loadPreset(preset)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 8px', background: isActive ? '#1e1e4a' : 'transparent', border: 'none', borderBottom: '1px solid #1a1a2e', cursor: 'pointer', color: isActive ? '#bbbfff' : '#c8c8e8' }}>
                  {/* Mini curve */}
                  <svg width={60} height={60} style={{ flexShrink: 0 }}>
                    <rect width={60} height={60} fill="#0d0d1a" rx={4} />
                    <line x1={4} y1={56} x2={56} y2={4} stroke="#1e1e3a" strokeWidth={1} strokeDasharray="2,2" />
                    <path d={miniD} fill="none" stroke={isActive ? '#bbbfff' : '#7b7bff'} strokeWidth={1.5} />
                    <circle cx={4} cy={56} r={2} fill="#fff" />
                    <circle cx={56} cy={4} r={2} fill="#fff" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 11, color: isActive ? '#e0e0ff' : '#bbbfff', marginBottom: 2 }}>{preset.label}</div>
                    <div style={{ fontSize: 9, color: '#555', fontFamily: 'ui-monospace, monospace' }}>{preset.x1},{preset.y1} → {preset.x2},{preset.y2}</div>
                    {preset.description && <div style={{ fontSize: 9, color: '#444', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.description}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #1e1e3a', background: '#0f0f1e', fontSize: 10, color: '#333', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>🟠 = CP1 (from start) · 🟢 = CP2 (from end)</span>
        <span>⌘⌥E</span>
      </div>
    </div>
  );
}

// ─── InputField sub-component ─────────────────────────────────────────────────

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}

function InputField({ label, value, onChange, min, max, step }: InputFieldProps) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>{label}</div>
      <input
        type="number"
        value={Number(value.toFixed(3))}
        min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: 4, color: '#c8c8e8', fontSize: 11, padding: '3px 5px', fontFamily: 'inherit', outline: 'none' }}
      />
    </div>
  );
}
