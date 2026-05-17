/**
 * ShapeMorphPanel — Morphing interpolator between two shapes
 *
 * Features:
 *  - Select a "from" and "to" shape by ID
 *  - Adjustable step count (2–12 steps)
 *  - Interpolates: x, y, width, height, opacity, fill (hex blend),
 *    borderRadius, fontSize, rotation
 *  - SVG preview showing the morph sequence
 *  - Easing selection (linear, ease-in, ease-out, ease-in-out, custom)
 *  - CSS @keyframes export of the morph animation
 *  - "Insert all frames" button to add intermediate shapes to canvas
 */

import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Utility exports (tested separately) ──────────────────────────────────────

export interface MorphStep {
  t: number; // 0..1
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  fill: string;
  borderRadius: number;
  fontSize: number;
  rotation: number;
}

/** Linear interpolation between two numbers */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Blend two hex colors by t (0=a, 1=b) */
export function blendHex(hexA: string, hexB: string, t: number): string {
  const parse = (h: string): [number, number, number] => {
    const c = h.replace(/^#/, '');
    const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c.padEnd(6, '0').slice(0, 6);
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(hexA || '#000000');
  const [r2, g2, b2] = parse(hexB || '#ffffff');
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Apply easing to a linear 0..1 t value */
export function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - (1 - t) * (1 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    case 'bounce': {
      if (t < 0.364) return 7.5625 * t * t;
      if (t < 0.727) return 7.5625 * (t -= 0.545) * t + 0.75;
      if (t < 0.909) return 7.5625 * (t -= 0.818) * t + 0.9375;
      return 7.5625 * (t -= 0.955) * t + 0.984375;
    }
    default: return t; // linear
  }
}

/** Generate morph steps from two shapes */
export function generateMorphSteps(
  from: Shape,
  to: Shape,
  steps: number,
  easing: string,
): MorphStep[] {
  const result: MorphStep[] = [];
  const fromRadius = Array.isArray(from.borderRadius) ? from.borderRadius[0] : (from.borderRadius ?? 0);
  const toRadius = Array.isArray(to.borderRadius) ? to.borderRadius[0] : (to.borderRadius ?? 0);
  const fromFontSize = typeof from.fontSize === 'number' ? from.fontSize : 16;
  const toFontSize = typeof to.fontSize === 'number' ? to.fontSize : 16;
  const fromRotation = from.rotation ?? 0;
  const toRotation = to.rotation ?? 0;

  for (let i = 0; i < steps; i++) {
    const tLinear = steps === 1 ? 0 : i / (steps - 1);
    const t = applyEasing(tLinear, easing);
    result.push({
      t: tLinear,
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      width: lerp(from.width, to.width, t),
      height: lerp(from.height, to.height, t),
      opacity: lerp(from.opacity ?? 1, to.opacity ?? 1, t),
      fill: blendHex(from.fill || '#cccccc', to.fill || '#333333', t),
      borderRadius: lerp(fromRadius, toRadius, t),
      fontSize: lerp(fromFontSize, toFontSize, t),
      rotation: lerp(fromRotation, toRotation, t),
    });
  }
  return result;
}

/** Generate CSS @keyframes for the morph */
export function generateKeyframesCSS(
  steps: MorphStep[],
  animName: string,
  duration: number,
): string {
  const frames = steps.map(s => {
    const pct = Math.round(s.t * 100);
    return `  ${pct}% {\n    left: ${Math.round(s.x)}px;\n    top: ${Math.round(s.y)}px;\n    width: ${Math.round(s.width)}px;\n    height: ${Math.round(s.height)}px;\n    opacity: ${s.opacity.toFixed(2)};\n    background: ${s.fill};\n    border-radius: ${Math.round(s.borderRadius)}px;\n    transform: rotate(${s.rotation.toFixed(1)}deg);\n  }`;
  });
  return `@keyframes ${animName} {\n${frames.join('\n')}\n}\n\n.morph-element {\n  position: absolute;\n  animation: ${animName} ${duration}ms linear infinite;\n}`;
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

const BTN_SM: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  border: '1px solid #3a1a1a',
  background: '#2a1010',
  color: '#e8d5d5',
  fontSize: 12,
  cursor: 'pointer',
};

const BTN_PRIMARY: React.CSSProperties = {
  ...BTN_SM,
  background: '#b5533c',
  border: '1px solid #c5634c',
  fontWeight: 600,
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

const SELECT: React.CSSProperties = {
  background: '#2a1010',
  border: '1px solid #3a1a1a',
  borderRadius: 6,
  color: '#e8d5d5',
  padding: '4px 8px',
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
};

const LABEL: React.CSSProperties = {
  fontSize: 11,
  color: '#a08080',
  marginBottom: 4,
  display: 'block',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onInsertShapes: (shapeDefs: Array<Partial<Shape>>) => void;
}

export function ShapeMorphPanel({ open, onClose, shapes, onInsertShapes }: Props) {
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [steps, setSteps] = useState(5);
  const [easing, setEasing] = useState('linear');
  const [duration, setDuration] = useState(600);
  const [showCSS, setShowCSS] = useState(false);
  const [copied, setCopied] = useState(false);

  const fromShape = shapes.find(s => s.id === fromId) ?? null;
  const toShape = shapes.find(s => s.id === toId) ?? null;

  const morphSteps = useMemo(() => {
    if (!fromShape || !toShape) return [];
    return generateMorphSteps(fromShape, toShape, steps, easing);
  }, [fromShape, toShape, steps, easing]);

  const cssCode = useMemo(() => {
    if (morphSteps.length === 0) return '';
    return generateKeyframesCSS(morphSteps, 'shapeMorph', duration);
  }, [morphSteps, duration]);

  const handleInsert = () => {
    if (!fromShape) return;
    const defs: Array<Partial<Shape>> = morphSteps.slice(1, -1).map(step => ({
      type: fromShape.type,
      x: step.x,
      y: step.y,
      width: step.width,
      height: step.height,
      opacity: step.opacity,
      fill: step.fill,
      borderRadius: step.borderRadius,
      fontSize: step.fontSize,
      rotation: step.rotation,
    }));
    onInsertShapes(defs);
  };

  const copyCSS = async () => {
    try {
      await navigator.clipboard.writeText(cssCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (!open) return null;

  // Preview dimensions
  const PREVIEW_W = 368;
  const PREVIEW_H = 100;

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⇌</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Shape Morpher</span>
        </div>
        <button style={CLOSE_BTN} onClick={onClose}>✕</button>
      </div>

      {/* Controls */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* From shape */}
          <div>
            <label style={LABEL}>From shape</label>
            <select
              style={{ ...SELECT, width: '100%' }}
              value={fromId}
              onChange={e => setFromId(e.target.value)}
            >
              <option value="">— select —</option>
              {shapes.filter(s => s.id !== toId).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name || `${s.type} (${Math.round(s.width)}×${Math.round(s.height)})`}
                </option>
              ))}
            </select>
          </div>

          {/* To shape */}
          <div>
            <label style={LABEL}>To shape</label>
            <select
              style={{ ...SELECT, width: '100%' }}
              value={toId}
              onChange={e => setToId(e.target.value)}
            >
              <option value="">— select —</option>
              {shapes.filter(s => s.id !== fromId).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name || `${s.type} (${Math.round(s.width)}×${Math.round(s.height)})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {/* Steps */}
          <div>
            <label style={LABEL}>Steps ({steps})</label>
            <input
              type="range"
              min={2}
              max={12}
              value={steps}
              onChange={e => setSteps(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Easing */}
          <div>
            <label style={LABEL}>Easing</label>
            <select style={{ ...SELECT, width: '100%' }} value={easing} onChange={e => setEasing(e.target.value)}>
              <option value="linear">Linear</option>
              <option value="ease-in">Ease In</option>
              <option value="ease-out">Ease Out</option>
              <option value="ease-in-out">Ease In-Out</option>
              <option value="bounce">Bounce</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label style={LABEL}>Duration (ms)</label>
            <select style={{ ...SELECT, width: '100%' }} value={duration} onChange={e => setDuration(Number(e.target.value))}>
              {[200, 400, 600, 800, 1000, 1500, 2000].map(d => (
                <option key={d} value={d}>{d}ms</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {!fromShape || !toShape ? (
          <div style={{ textAlign: 'center', color: '#a08080', fontSize: 13, padding: '32px 0' }}>
            Select two shapes above to preview the morph.
          </div>
        ) : (
          <>
            {/* SVG preview */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#a08080', marginBottom: 6 }}>Preview — {steps} steps</div>
              <div style={{
                background: '#0d0505',
                borderRadius: 8,
                border: '1px solid #3a1a1a',
                overflow: 'hidden',
              }}>
                <svg width={PREVIEW_W} height={PREVIEW_H} viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}>
                  {morphSteps.map((step, i) => {
                    const cellW = PREVIEW_W / steps;
                    const cx = i * cellW + cellW / 2;
                    const scale = Math.min((cellW - 8) / Math.max(step.width, 1), (PREVIEW_H - 16) / Math.max(step.height, 1), 1);
                    const dispW = step.width * scale;
                    const dispH = step.height * scale;
                    const x = cx - dispW / 2;
                    const y = PREVIEW_H / 2 - dispH / 2;
                    const r = Math.min(step.borderRadius * scale, Math.min(dispW, dispH) / 2);
                    return (
                      <g key={i} transform={`rotate(${step.rotation.toFixed(1)}, ${cx}, ${PREVIEW_H / 2})`}>
                        <rect
                          x={x}
                          y={y}
                          width={dispW}
                          height={dispH}
                          rx={r}
                          ry={r}
                          fill={step.fill}
                          opacity={step.opacity}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Steps table */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#a08080', marginBottom: 6 }}>Interpolated values</div>
              <div style={{
                background: '#0d0505',
                borderRadius: 8,
                border: '1px solid #3a1a1a',
                overflow: 'hidden',
                fontSize: 11,
                fontFamily: 'monospace',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 60px 60px 60px 60px 60px 50px',
                  gap: 0,
                  borderBottom: '1px solid #2a1010',
                  padding: '5px 8px',
                  color: '#a08080',
                }}>
                  <span>#</span><span>x</span><span>y</span><span>w</span><span>h</span><span>fill</span><span>op</span>
                </div>
                {morphSteps.map((step, i) => (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 60px 60px 60px 60px 60px 50px',
                    gap: 0,
                    padding: '4px 8px',
                    borderBottom: i < morphSteps.length - 1 ? '1px solid #1a0a0a' : 'none',
                    alignItems: 'center',
                  }}>
                    <span style={{ color: '#a08080' }}>{i + 1}</span>
                    <span>{Math.round(step.x)}</span>
                    <span>{Math.round(step.y)}</span>
                    <span>{Math.round(step.width)}</span>
                    <span>{Math.round(step.height)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: step.fill,
                        border: '1px solid rgba(255,255,255,0.1)',
                        flexShrink: 0,
                      }} />
                    </span>
                    <span>{step.opacity.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={BTN_PRIMARY} onClick={handleInsert}>
                Insert {steps - 2} intermediate shape{steps - 2 !== 1 ? 's' : ''}
              </button>
              <button
                style={{ ...BTN_SM, background: showCSS ? '#4a1a1a' : '#2a1010' }}
                onClick={() => setShowCSS(v => !v)}
              >
                {showCSS ? 'Hide' : 'Show'} CSS
              </button>
            </div>

            {/* CSS export */}
            {showCSS && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#a08080' }}>@keyframes CSS</span>
                  <button
                    style={{ ...BTN_SM, background: copied ? '#1a4a1a' : '#2a1010' }}
                    onClick={copyCSS}
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={cssCode}
                  style={{
                    width: '100%',
                    height: 160,
                    background: '#0d0505',
                    border: '1px solid #3a1a1a',
                    borderRadius: 6,
                    color: '#e8d5d5',
                    padding: '8px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    lineHeight: 1.6,
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </>
        )}
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
        <span>⌘⌥8 to toggle</span>
        <span>Interpolates x, y, w, h, fill, opacity, radius, rotation</span>
      </div>
    </div>
  );
}
