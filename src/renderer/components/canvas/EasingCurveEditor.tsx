import React, { useState, useRef, useCallback, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Point { x: number; y: number }

export interface CubicBezier {
  x1: number; y1: number;
  x2: number; y2: number;
}

export interface SpringConfig {
  stiffness: number;  // 0-2000
  damping: number;    // 0-100
  mass: number;       // 0.1-10
  velocity: number;   // initial velocity
}

export type EasingType = 'cubic-bezier' | 'spring' | 'steps';

export interface EasingPreset {
  name: string;
  category: string;
  type: EasingType;
  bezier?: CubicBezier;
  spring?: SpringConfig;
  steps?: number;
}

// ─── Bezier math ──────────────────────────────────────────────────────────────

/** Cubic Bezier value at parameter t (0-1) */
export function cubicBezier1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Evaluate CSS cubic-bezier(x1,y1,x2,y2) at time t using Newton's method */
export function evaluateCubicBezier(bezier: CubicBezier, t: number): number {
  // Find u such that cubicBezier1D(0, x1, x2, 1, u) = t
  // Then return cubicBezier1D(0, y1, y2, 1, u)
  const { x1, y1, x2, y2 } = bezier;
  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = cubicBezier1D(0, x1, x2, 1, u) - t;
    const dx = cubicBezierDerivative1D(0, x1, x2, 1, u);
    if (Math.abs(dx) < 1e-8) break;
    u -= x / dx;
    u = Math.max(0, Math.min(1, u));
  }
  return cubicBezier1D(0, y1, y2, 1, u);
}

export function cubicBezierDerivative1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

/** Sample n+1 points along a bezier curve */
export function sampleBezier(bezier: CubicBezier, n = 40): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = evaluateCubicBezier(bezier, t);
    points.push({ x: t, y });
  }
  return points;
}

// ─── Spring math ──────────────────────────────────────────────────────────────

export function sampleSpring(spring: SpringConfig, n = 60): Point[] {
  const { stiffness, damping, mass, velocity: v0 } = spring;
  const points: Point[] = [];
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const duration = 3; // seconds

  for (let i = 0; i <= n; i++) {
    const t = (i / n) * duration;
    let y: number;
    if (zeta < 1) {
      // Underdamped
      const wd = omega * Math.sqrt(1 - zeta * zeta);
      const A = 1;
      const B = (zeta * omega + v0) / wd;
      y = 1 - Math.exp(-zeta * omega * t) * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
    } else if (zeta === 1) {
      // Critically damped
      y = 1 - (1 + omega * t) * Math.exp(-omega * t);
    } else {
      // Overdamped
      const r1 = -zeta * omega + omega * Math.sqrt(zeta * zeta - 1);
      const r2 = -zeta * omega - omega * Math.sqrt(zeta * zeta - 1);
      const A = r2 / (r2 - r1);
      const B = -r1 / (r2 - r1);
      y = 1 - (A * Math.exp(r1 * t) + B * Math.exp(r2 * t));
    }
    points.push({ x: i / n, y: Math.max(-0.5, Math.min(1.5, y)) });
  }
  return points;
}

// ─── Steps ────────────────────────────────────────────────────────────────────

export function sampleSteps(steps: number, n = 40): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const step = Math.floor(t * steps) / steps;
    points.push({ x: t, y: step });
  }
  return points;
}

// ─── CSS generation ───────────────────────────────────────────────────────────

export function bezierToCSS(bezier: CubicBezier): string {
  const { x1, y1, x2, y2 } = bezier;
  return `cubic-bezier(${x1.toFixed(3)}, ${y1.toFixed(3)}, ${x2.toFixed(3)}, ${y2.toFixed(3)})`;
}

export function springToCSS(spring: SpringConfig): string {
  // CSS linear() approximation
  const pts = sampleSpring(spring, 20);
  const vals = pts.map((p, i) => {
    const pct = (p.x * 100).toFixed(1);
    const val = p.y.toFixed(3);
    return i === 0 || i === pts.length - 1 ? val : `${val} ${pct}%`;
  }).join(', ');
  return `linear(${vals})`;
}

export function stepsToCSS(steps: number): string {
  return `steps(${steps}, end)`;
}

export function easingToCSS(type: EasingType, bezier?: CubicBezier, spring?: SpringConfig, steps?: number): string {
  if (type === 'cubic-bezier' && bezier) return bezierToCSS(bezier);
  if (type === 'spring' && spring) return springToCSS(spring);
  if (type === 'steps' && steps) return stepsToCSS(steps);
  return 'ease';
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export const EASING_PRESETS: EasingPreset[] = [
  // CSS standard
  { name: 'ease', category: 'CSS', type: 'cubic-bezier', bezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
  { name: 'ease-in', category: 'CSS', type: 'cubic-bezier', bezier: { x1: 0.42, y1: 0, x2: 1, y2: 1 } },
  { name: 'ease-out', category: 'CSS', type: 'cubic-bezier', bezier: { x1: 0, y1: 0, x2: 0.58, y2: 1 } },
  { name: 'ease-in-out', category: 'CSS', type: 'cubic-bezier', bezier: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
  { name: 'linear', category: 'CSS', type: 'cubic-bezier', bezier: { x1: 0, y1: 0, x2: 1, y2: 1 } },
  // Penner easings
  { name: 'easeInSine', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.12, y1: 0, x2: 0.39, y2: 0 } },
  { name: 'easeOutSine', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.61, y1: 1, x2: 0.88, y2: 1 } },
  { name: 'easeInOutSine', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.37, y1: 0, x2: 0.63, y2: 1 } },
  { name: 'easeInCubic', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.32, y1: 0, x2: 0.67, y2: 0 } },
  { name: 'easeOutCubic', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.33, y1: 1, x2: 0.68, y2: 1 } },
  { name: 'easeInOutCubic', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.65, y1: 0, x2: 0.35, y2: 1 } },
  { name: 'easeInQuart', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.5, y1: 0, x2: 0.75, y2: 0 } },
  { name: 'easeOutQuart', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.25, y1: 1, x2: 0.5, y2: 1 } },
  { name: 'easeInOutQuart', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.76, y1: 0, x2: 0.24, y2: 1 } },
  { name: 'easeInBack', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 } },
  { name: 'easeOutBack', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 } },
  { name: 'easeInOutBack', category: 'Penner', type: 'cubic-bezier', bezier: { x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6 } },
  // Springs
  { name: 'Gentle', category: 'Spring', type: 'spring', spring: { stiffness: 100, damping: 20, mass: 1, velocity: 0 } },
  { name: 'Snappy', category: 'Spring', type: 'spring', spring: { stiffness: 400, damping: 30, mass: 1, velocity: 0 } },
  { name: 'Bouncy', category: 'Spring', type: 'spring', spring: { stiffness: 300, damping: 10, mass: 1, velocity: 0 } },
  { name: 'Stiff', category: 'Spring', type: 'spring', spring: { stiffness: 800, damping: 40, mass: 1, velocity: 0 } },
  // Steps
  { name: 'steps(4)', category: 'Steps', type: 'steps', steps: 4 },
  { name: 'steps(8)', category: 'Steps', type: 'steps', steps: 8 },
  { name: 'steps(16)', category: 'Steps', type: 'steps', steps: 16 },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_BEZIER: CubicBezier = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
const DEFAULT_SPRING: SpringConfig = { stiffness: 300, damping: 20, mass: 1, velocity: 0 };
const CATEGORIES = ['CSS', 'Penner', 'Spring', 'Steps'];

export function EasingCurveEditor({ open, onClose }: Props) {
  const [type, setType] = useState<EasingType>('cubic-bezier');
  const [bezier, setBezier] = useState<CubicBezier>(DEFAULT_BEZIER);
  const [spring, setSpring] = useState<SpringConfig>(DEFAULT_SPRING);
  const [steps, setSteps] = useState(8);
  const [dragging, setDragging] = useState<'p1' | 'p2' | null>(null);
  const [catFilter, setCatFilter] = useState('CSS');
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number | null>(null);
  const [ballPos, setBallPos] = useState(0); // 0-1

  if (!open) return null;

  const SZ = 200; // SVG canvas size
  const PAD = 20;
  const INNER = SZ - PAD * 2;

  // Graph coordinates (y is flipped: 0 = top, 1 = bottom in SVG)
  const toSVG = (p: Point) => ({
    x: PAD + p.x * INNER,
    y: PAD + (1 - p.y) * INNER,
  });

  const fromSVG = (sx: number, sy: number): Point => ({
    x: Math.max(0, Math.min(1, (sx - PAD) / INNER)),
    y: Math.max(-0.5, Math.min(1.5, 1 - (sy - PAD) / INNER)),
  });

  const curve = useMemo(() => {
    if (type === 'cubic-bezier') return sampleBezier(bezier, 60);
    if (type === 'spring') return sampleSpring(spring, 80);
    return sampleSteps(steps, 60);
  }, [type, bezier, spring, steps]);

  const pathD = useMemo(() => {
    if (curve.length === 0) return '';
    const pts = curve.map(p => toSVG(p));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }, [curve, bezier, spring, steps]);

  // Bezier control points
  const p0svg = toSVG({ x: 0, y: 0 });
  const p1svg = toSVG({ x: bezier.x1, y: bezier.y1 });
  const p2svg = toSVG({ x: bezier.x2, y: bezier.y2 });
  const p3svg = toSVG({ x: 1, y: 1 });

  const handleSVGMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (SZ / rect.width);
    const sy = (e.clientY - rect.top) * (SZ / rect.height);
    const p = fromSVG(sx, sy);
    if (dragging === 'p1') {
      setBezier(b => ({ ...b, x1: Math.max(0, Math.min(1, p.x)), y1: p.y }));
    } else {
      setBezier(b => ({ ...b, x2: Math.max(0, Math.min(1, p.x)), y2: p.y }));
    }
  }, [dragging]);

  const applyPreset = (preset: EasingPreset) => {
    setType(preset.type);
    if (preset.bezier) setBezier(preset.bezier);
    if (preset.spring) setSpring(preset.spring);
    if (preset.steps) setSteps(preset.steps);
  };

  const playAnimation = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setBallPos(t);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
        setTimeout(() => setBallPos(0), 300);
      }
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const cssValue = useMemo(() => easingToCSS(type, bezier, spring, steps), [type, bezier, spring, steps]);

  // Ball position on animation track using easing value
  const ballY = useMemo(() => {
    if (type === 'cubic-bezier') return evaluateCubicBezier(bezier, ballPos);
    const pts = type === 'spring' ? sampleSpring(spring, 60) : sampleSteps(steps, 60);
    const idx = Math.min(pts.length - 1, Math.round(ballPos * (pts.length - 1)));
    return pts[idx]?.y ?? 0;
  }, [ballPos, type, bezier, spring, steps]);

  const copyCSS = async () => {
    await navigator.clipboard.writeText(cssValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const panel: React.CSSProperties = {
    position: 'fixed', top: 60, right: 16, width: 380,
    background: '#0c1220', border: '1px solid #1a2540',
    borderRadius: 12, zIndex: 1500, display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
    maxHeight: 'calc(100vh - 80px)',
  };

  const input: React.CSSProperties = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 5,
    color: '#e2e8f0', padding: '4px 7px', fontSize: 11, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #1a2540', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fb923c' }}>〜 Easing Curve Editor</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Type selector */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #1a2540', display: 'flex', gap: 6 }}>
          {(['cubic-bezier', 'spring', 'steps'] as EasingType[]).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6,
              background: type === t ? '#7c2d0e' : '#1e293b',
              border: '1px solid ' + (type === t ? '#fb923c' : '#334155'),
              color: type === t ? '#fb923c' : '#94a3b8', cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>

        {/* SVG Canvas */}
        <div style={{ padding: 14, borderBottom: '1px solid #1a2540' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Curve editor */}
            <div style={{ position: 'relative' }}>
              <svg
                ref={svgRef}
                width={SZ} height={SZ}
                style={{ background: '#0a0f1e', borderRadius: 8, border: '1px solid #1a2540', cursor: dragging ? 'grabbing' : 'default', display: 'block' }}
                onMouseMove={handleSVGMouseMove}
                onMouseUp={() => setDragging(null)}
                onMouseLeave={() => setDragging(null)}
              >
                {/* Grid */}
                {[0.25, 0.5, 0.75].map(v => (
                  <g key={v}>
                    <line x1={PAD + v * INNER} y1={PAD} x2={PAD + v * INNER} y2={PAD + INNER} stroke="#1a2540" strokeWidth="1" />
                    <line x1={PAD} y1={PAD + (1 - v) * INNER} x2={PAD + INNER} y2={PAD + (1 - v) * INNER} stroke="#1a2540" strokeWidth="1" />
                  </g>
                ))}

                {/* Bounds */}
                <rect x={PAD} y={PAD} width={INNER} height={INNER} fill="none" stroke="#1e293b" strokeWidth="1" />

                {/* Reference diagonal */}
                <line x1={p0svg.x} y1={p0svg.y} x2={p3svg.x} y2={p3svg.y} stroke="#1e2540" strokeWidth="1" strokeDasharray="4 4" />

                {/* Curve path */}
                <path d={pathD} fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" />

                {type === 'cubic-bezier' && (
                  <>
                    {/* Control lines */}
                    <line x1={p0svg.x} y1={p0svg.y} x2={p1svg.x} y2={p1svg.y} stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 2" />
                    <line x1={p3svg.x} y1={p3svg.y} x2={p2svg.x} y2={p2svg.y} stroke="#a78bfa" strokeWidth="1" strokeDasharray="3 2" />
                    {/* Anchor points */}
                    <circle cx={p0svg.x} cy={p0svg.y} r="4" fill="#1a2540" stroke="#475569" strokeWidth="2" />
                    <circle cx={p3svg.x} cy={p3svg.y} r="4" fill="#1a2540" stroke="#475569" strokeWidth="2" />
                    {/* Control handle P1 */}
                    <circle cx={p1svg.x} cy={p1svg.y} r="7" fill="#3b82f6" stroke="#60a5fa" strokeWidth="1.5" style={{ cursor: 'grab' }}
                      onMouseDown={e => { e.preventDefault(); setDragging('p1'); }} />
                    {/* Control handle P2 */}
                    <circle cx={p2svg.x} cy={p2svg.y} r="7" fill="#a78bfa" stroke="#c4b5fd" strokeWidth="1.5" style={{ cursor: 'grab' }}
                      onMouseDown={e => { e.preventDefault(); setDragging('p2'); }} />
                  </>
                )}
              </svg>
              <div style={{ fontSize: 9, color: '#334155', marginTop: 3, textAlign: 'center' }}>
                {type === 'cubic-bezier' ? 'Drag blue/purple handles' : type === 'spring' ? 'Spring curve preview' : 'Step function preview'}
              </div>
            </div>

            {/* Animation preview track */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', paddingTop: PAD, paddingBottom: PAD }}>
              <div style={{
                width: 20, height: INNER, background: '#0a0f1e', border: '1px solid #1a2540',
                borderRadius: 4, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  top: `${(1 - Math.max(0, Math.min(1, ballY))) * 100}%`,
                  left: '50%', transform: 'translate(-50%, -50%)',
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fb923c, #f97316)',
                  boxShadow: '0 0 8px #fb923c66',
                  transition: 'top 0.016s linear',
                }} />
              </div>
              <button onClick={playAnimation} disabled={isPlaying} style={{
                marginTop: 6, width: 32, height: 24, fontSize: 10,
                background: isPlaying ? '#1e293b' : '#7c2d0e',
                border: '1px solid ' + (isPlaying ? '#334155' : '#fb923c'),
                borderRadius: 4, color: isPlaying ? '#475569' : '#fb923c', cursor: isPlaying ? 'not-allowed' : 'pointer',
              }}>▶</button>
            </div>
          </div>
        </div>

        {/* Controls per type */}
        {type === 'cubic-bezier' && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a2540' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              {(['x1', 'y1', 'x2', 'y2'] as const).map((key) => (
                <div key={key}>
                  <label style={{ fontSize: 9, color: '#64748b', display: 'block', marginBottom: 2 }}>{key}</label>
                  <input
                    type="number" step="0.01" min={key.startsWith('x') ? 0 : -2} max={key.startsWith('x') ? 1 : 2}
                    value={bezier[key].toFixed(2)}
                    onChange={e => setBezier(b => ({ ...b, [key]: parseFloat(e.target.value) || 0 }))}
                    style={input}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {type === 'spring' && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a2540' }}>
            {([
              { key: 'stiffness' as const, min: 0, max: 2000, label: 'Stiffness', step: 1 },
              { key: 'damping' as const, min: 0, max: 100, label: 'Damping', step: 1 },
              { key: 'mass' as const, min: 0.1, max: 10, label: 'Mass', step: 0.1 },
              { key: 'velocity' as const, min: 0, max: 20, label: 'Init Velocity', step: 1 },
            ]).map(({ key, min, max, label, step }) => (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <label style={{ fontSize: 10, color: '#64748b' }}>{label}</label>
                  <span style={{ fontSize: 10, color: '#fb923c', fontFamily: 'monospace' }}>{spring[key]}</span>
                </div>
                <input type="range" min={min} max={max} step={step ?? 1}
                  value={spring[key]}
                  onChange={e => setSpring(s => ({ ...s, [key]: parseFloat(e.target.value) }))}
                  style={{ width: '100%', accentColor: '#fb923c' }}
                />
              </div>
            ))}
          </div>
        )}

        {type === 'steps' && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a2540' }}>
            <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 4 }}>Step Count</label>
            <input type="range" min={2} max={24} value={steps}
              onChange={e => setSteps(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#fb923c' }}
            />
            <div style={{ fontSize: 11, color: '#fb923c', textAlign: 'center', marginTop: 2 }}>{steps} steps</div>
          </div>
        )}

        {/* Presets */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a2540' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{
                padding: '3px 8px', fontSize: 10, borderRadius: 5,
                background: catFilter === cat ? '#7c2d0e' : '#1e293b',
                border: '1px solid ' + (catFilter === cat ? '#fb923c' : '#334155'),
                color: catFilter === cat ? '#fb923c' : '#64748b', cursor: 'pointer',
              }}>{cat}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {EASING_PRESETS.filter(p => p.category === catFilter).map(preset => (
              <button key={preset.name} onClick={() => applyPreset(preset)} style={{
                padding: '4px 8px', fontSize: 10, borderRadius: 5,
                background: '#1e293b', border: '1px solid #334155',
                color: '#94a3b8', cursor: 'pointer',
              }}>{preset.name}</button>
            ))}
          </div>
        </div>

        {/* CSS output */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>CSS VALUE</div>
          <div style={{
            background: '#0a0f1e', border: '1px solid #1a2540', borderRadius: 8,
            padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#fb923c',
            wordBreak: 'break-all', marginBottom: 8,
          }}>{cssValue}</div>
          <button onClick={copyCSS} style={{
            width: '100%', padding: '7px 0',
            background: copied ? '#14532d' : '#1e293b',
            border: '1px solid ' + (copied ? '#10b981' : '#334155'),
            borderRadius: 8, color: copied ? '#6ee7b7' : '#94a3b8',
            fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
          }}>{copied ? '✓ Copied!' : 'Copy CSS Value'}</button>

          {/* Usage hint */}
          <div style={{ marginTop: 10, background: '#0a0f1e', borderRadius: 6, padding: '8px 10px', border: '1px solid #1a2540' }}>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>USAGE</div>
            <pre style={{ fontSize: 10, color: '#64748b', margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {`.element {\n  transition: all 0.3s ${bezierToCSS(bezier)};\n}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
