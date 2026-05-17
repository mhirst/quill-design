/**
 * GeometryPanel — Precision geometry calculator for Quill.
 *
 * A designer's math companion for computing and applying precise geometric
 * values. Never guess dimensions again.
 *
 * Calculator modes:
 *  1. Golden Ratio — input one dimension, get the other (width/height/both)
 *  2. Rule of Thirds — compute grid lines for a given canvas size
 *  3. Regular Polygon — compute vertices for N-gon (triangle, pentagon, etc.)
 *  4. Circle Fit — inscribed/circumscribed circle for a given rect
 *  5. Aspect Ratio — maintain ratio while scaling (any target dimension)
 *  6. Spacing Scale — generate a spacing scale (4px base, or Fibonacci, or custom)
 *  7. Screen Size Calculator — device px → pt → physical mm at given PPI
 *
 * Apply buttons push the computed value to the selected shape.
 *
 * Keyboard: ⌘⌥G (was PerspectiveGrid — reassigned)
 *   Actually uses ⌘⌥` (backtick) to avoid conflicts.
 *   Panel opened via command palette or ⌘⇧⌥G.
 *
 * Keyboard: ⌘⌥5
 */

import React, { useState, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Math Utilities ────────────────────────────────────────────────────────────

export const PHI = (1 + Math.sqrt(5)) / 2; // 1.6180339...

/** Given one dimension, return golden ratio partner */
export function goldenRatio(value: number, mode: 'longer' | 'shorter'): number {
  if (mode === 'longer') return Number((value * PHI).toFixed(2));
  return Number((value / PHI).toFixed(2));
}

/** Rule of thirds lines for a rectangle */
export function ruleOfThirds(width: number, height: number): { x: number[]; y: number[] } {
  return {
    x: [width / 3, (2 * width) / 3],
    y: [height / 3, (2 * height) / 3],
  };
}

/** Regular polygon vertices (centered at origin, radius r) */
export function polygonVertices(sides: number, radius: number, rotationDeg = 0): Array<{ x: number; y: number }> {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2 + (rotationDeg * Math.PI) / 180;
    pts.push({
      x: Number((radius * Math.cos(angle)).toFixed(3)),
      y: Number((radius * Math.sin(angle)).toFixed(3)),
    });
  }
  return pts;
}

/** Compute the inscribed circle radius for a rectangle */
export function inscribedCircle(width: number, height: number): number {
  return Math.min(width, height) / 2;
}

/** Compute the circumscribed circle radius for a rectangle */
export function circumscribedCircle(width: number, height: number): number {
  return Math.sqrt(width * width + height * height) / 2;
}

/** Scale dimensions to fit target while maintaining aspect ratio */
export function aspectRatioScale(
  w: number, h: number,
  target: number,
  mode: 'width' | 'height' | 'diagonal' | 'area'
): { width: number; height: number } {
  const ratio = w / h;
  switch (mode) {
    case 'width': return { width: target, height: Number((target / ratio).toFixed(2)) };
    case 'height': return { width: Number((target * ratio).toFixed(2)), height: target };
    case 'diagonal': {
      const diagOrig = Math.sqrt(w * w + h * h);
      const scale = target / diagOrig;
      return { width: Number((w * scale).toFixed(2)), height: Number((h * scale).toFixed(2)) };
    }
    case 'area': {
      const scale = Math.sqrt(target / (w * h));
      return { width: Number((w * scale).toFixed(2)), height: Number((h * scale).toFixed(2)) };
    }
  }
}

/** Generate spacing scale */
export function spacingScale(base: number, type: 'linear' | 'fibonacci' | '8pt' | 'golden', steps: number): number[] {
  const result: number[] = [];
  if (type === 'linear') {
    for (let i = 1; i <= steps; i++) result.push(base * i);
  } else if (type === 'fibonacci') {
    let a = 1; let b = 1;
    for (let i = 0; i < steps; i++) {
      result.push(a * base);
      [a, b] = [b, a + b];
    }
  } else if (type === '8pt') {
    for (let i = 1; i <= steps; i++) result.push(8 * i);
  } else if (type === 'golden') {
    let v = base;
    for (let i = 0; i < steps; i++) {
      result.push(Number(v.toFixed(1)));
      v = Number((v * PHI).toFixed(1));
    }
  }
  return result;
}

/** Convert px to mm given PPI */
export function pxToMm(px: number, ppi: number): number {
  return Number((px * 25.4 / ppi).toFixed(2));
}

/** Convert px to pt */
export function pxToPt(px: number): number {
  return Number((px * 0.75).toFixed(2));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CalcMode = 'golden' | 'thirds' | 'polygon' | 'circle' | 'ratio' | 'spacing' | 'screen';

// ─── Component Props ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onApplyToShape: (patch: Partial<Shape>) => void;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function GeometryPanel({ open, onClose, selectedShape, onApplyToShape }: Props) {
  const [mode, setMode] = useState<CalcMode>('golden');

  // Golden ratio state
  const [goldenInput, setGoldenInput] = useState(selectedShape?.width ?? 200);
  const [goldenMode, setGoldenMode] = useState<'longer' | 'shorter'>('longer');

  // Polygon state
  const [polySides, setPolySides] = useState(5);
  const [polyRadius, setPolyRadius] = useState(100);
  const [polyRotation, setPolyRotation] = useState(0);

  // Ratio state
  const [ratioW, setRatioW] = useState(selectedShape?.width ?? 16);
  const [ratioH, setRatioH] = useState(selectedShape?.height ?? 9);
  const [ratioTarget, setRatioTarget] = useState(1920);
  const [ratioMode, setRatioMode] = useState<'width' | 'height' | 'diagonal' | 'area'>('width');

  // Spacing state
  const [spacingBase, setSpacingBase] = useState(4);
  const [spacingType, setSpacingType] = useState<'linear' | 'fibonacci' | '8pt' | 'golden'>('8pt');
  const [spacingSteps, setSpacingSteps] = useState(8);

  // Screen state
  const [screenPx, setScreenPx] = useState(selectedShape?.width ?? 375);
  const [screenPpi, setScreenPpi] = useState(460);

  // Canvas size for rule of thirds
  const [thirdsW, setThirdsW] = useState(selectedShape?.width ?? 1440);
  const [thirdsH, setThirdsH] = useState(selectedShape?.height ?? 900);

  if (!open) return null;

  // Computed values
  const goldenResult = goldenRatio(goldenInput, goldenMode);
  const thirdsResult = ruleOfThirds(thirdsW, thirdsH);
  const polyVerts = useMemo(() => polygonVertices(polySides, polyRadius, polyRotation), [polySides, polyRadius, polyRotation]);
  const inscribed = inscribedCircle(selectedShape?.width ?? 200, selectedShape?.height ?? 200);
  const circumscribed = circumscribedCircle(selectedShape?.width ?? 200, selectedShape?.height ?? 200);
  const ratioResult = aspectRatioScale(ratioW, ratioH, ratioTarget, ratioMode);
  const spacingResult = useMemo(() => spacingScale(spacingBase, spacingType, spacingSteps), [spacingBase, spacingType, spacingSteps]);
  const mmResult = pxToMm(screenPx, screenPpi);
  const ptResult = pxToPt(screenPx);

  // Polygon SVG preview
  const polyMin = Math.min(...polyVerts.map(v => v.x), ...polyVerts.map(v => v.y));
  const polyMax = Math.max(...polyVerts.map(v => v.x), ...polyVerts.map(v => v.y));
  const polyRange = polyMax - polyMin || 1;
  const polySvgSize = 100;
  const polyScale = (polySvgSize - 16) / polyRange;
  const polyOffset = polySvgSize / 2;
  const polyPointsStr = polyVerts.map(v => `${(v.x * polyScale + polyOffset).toFixed(1)},${(v.y * polyScale + polyOffset).toFixed(1)}`).join(' ');

  return (
    <div style={{
      position: 'fixed',
      right: 8,
      top: 60,
      width: 400,
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
          <span style={{ fontSize: 15 }}>📐</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f8', letterSpacing: 0.3 }}>Geometry Calculator</span>
          <span style={{ fontSize: 10, color: '#555', background: '#1a1a2e', borderRadius: 4, padding: '1px 5px' }}>⌘⌥5</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '8px 10px', borderBottom: '1px solid #1e1e3a', flexShrink: 0 }}>
        {([
          ['golden', '𝜑 Golden'],
          ['thirds', '⅓ Thirds'],
          ['polygon', '⬡ Polygon'],
          ['circle', '◯ Circle'],
          ['ratio', '↔ Ratio'],
          ['spacing', '↕ Spacing'],
          ['screen', '📱 Screen'],
        ] as [CalcMode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding: '3px 9px', borderRadius: 5, fontSize: 10, border: 'none', cursor: 'pointer', background: mode === m ? '#3a3a8a' : '#1e1e3a', color: mode === m ? '#e0e0ff' : '#666', fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ── Golden Ratio ── */}
        {mode === 'golden' && (
          <CalcSection>
            <CalcTitle>Golden Ratio  φ = {PHI.toFixed(6)}</CalcTitle>
            <CalcDesc>Given one side length, compute the harmonious other dimension based on φ (1.618…)</CalcDesc>
            <Row>
              <Field label="Input dimension (px)">
                <input type="number" value={goldenInput} onChange={e => setGoldenInput(Number(e.target.value))} style={inputStyle} />
              </Field>
              <Field label="Compute">
                <select value={goldenMode} onChange={e => setGoldenMode(e.target.value as typeof goldenMode)} style={selectStyle}>
                  <option value="longer">Longer side (× φ)</option>
                  <option value="shorter">Shorter side (÷ φ)</option>
                </select>
              </Field>
            </Row>
            <ResultBox>
              <span style={{ color: '#aaa' }}>Result:</span>
              <span style={{ color: '#7bffcc', fontWeight: 700, fontSize: 18, marginLeft: 8 }}>{goldenResult} px</span>
            </ResultBox>
            <ResultBox style={{ background: '#0a1a12' }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Full golden rectangle: {Math.min(goldenInput, goldenResult)} × {Math.max(goldenInput, goldenResult)}</div>
              <div style={{ fontSize: 10, color: '#555' }}>Ratio: {(Math.max(goldenInput, goldenResult) / Math.min(goldenInput, goldenResult)).toFixed(4)} : 1</div>
            </ResultBox>
            {selectedShape && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <ApplyButton onClick={() => onApplyToShape({ width: goldenInput, height: goldenResult })}>
                  Apply {goldenInput}×{goldenResult} to shape
                </ApplyButton>
                <ApplyButton onClick={() => onApplyToShape({ width: goldenResult, height: goldenInput })}>
                  Apply {goldenResult}×{goldenInput}
                </ApplyButton>
              </div>
            )}
          </CalcSection>
        )}

        {/* ── Rule of Thirds ── */}
        {mode === 'thirds' && (
          <CalcSection>
            <CalcTitle>Rule of Thirds</CalcTitle>
            <CalcDesc>Divide your frame into thirds — intersection points are ideal focal areas</CalcDesc>
            <Row>
              <Field label="Canvas Width (px)">
                <input type="number" value={thirdsW} onChange={e => setThirdsW(Number(e.target.value))} style={inputStyle} />
              </Field>
              <Field label="Canvas Height (px)">
                <input type="number" value={thirdsH} onChange={e => setThirdsH(Number(e.target.value))} style={inputStyle} />
              </Field>
            </Row>
            <ResultBox>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ color: '#888', fontSize: 10, marginBottom: 3 }}>Vertical lines (X)</div>
                  {thirdsResult.x.map((v, i) => (
                    <div key={i} style={{ color: '#7bffcc', fontSize: 14, fontWeight: 600 }}>{v.toFixed(1)} px</div>
                  ))}
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: 10, marginBottom: 3 }}>Horizontal lines (Y)</div>
                  {thirdsResult.y.map((v, i) => (
                    <div key={i} style={{ color: '#7bffcc', fontSize: 14, fontWeight: 600 }}>{v.toFixed(1)} px</div>
                  ))}
                </div>
              </div>
            </ResultBox>
            {/* Mini thirds preview */}
            <svg width="100%" height={60} viewBox={`0 0 ${thirdsW} ${thirdsH}`} preserveAspectRatio="none" style={{ marginTop: 8, background: '#0d0d1a', borderRadius: 6, border: '1px solid #1e1e3a' }}>
              {thirdsResult.x.map((x, i) => <line key={`x${i}`} x1={x} y1={0} x2={x} y2={thirdsH} stroke="#7bffcc" strokeWidth={Math.max(thirdsW, thirdsH) * 0.005} />)}
              {thirdsResult.y.map((y, i) => <line key={`y${i}`} x1={0} y1={y} x2={thirdsW} y2={y} stroke="#7bffcc" strokeWidth={Math.max(thirdsW, thirdsH) * 0.005} />)}
              {thirdsResult.x.flatMap(x => thirdsResult.y.map(y => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r={Math.max(thirdsW, thirdsH) * 0.02} fill="#ff9b4a" />
              )))}
            </svg>
          </CalcSection>
        )}

        {/* ── Polygon ── */}
        {mode === 'polygon' && (
          <CalcSection>
            <CalcTitle>Regular Polygon Vertices</CalcTitle>
            <CalcDesc>Generate evenly-spaced vertices for any regular polygon</CalcDesc>
            <Row>
              <Field label="Sides">
                <input type="number" min={3} max={32} value={polySides} onChange={e => setPolySides(Math.max(3, Number(e.target.value)))} style={inputStyle} />
              </Field>
              <Field label="Radius (px)">
                <input type="number" value={polyRadius} onChange={e => setPolyRadius(Number(e.target.value))} style={inputStyle} />
              </Field>
              <Field label="Rotation (°)">
                <input type="number" value={polyRotation} onChange={e => setPolyRotation(Number(e.target.value))} style={inputStyle} />
              </Field>
            </Row>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
              {/* SVG preview */}
              <svg width={polySvgSize} height={polySvgSize} style={{ flexShrink: 0, background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 6 }}>
                <polygon points={polyPointsStr} fill="#7b7bff" fillOpacity={0.2} stroke="#7b7bff" strokeWidth={1.5} />
                {polyVerts.map((v, i) => (
                  <circle key={i} cx={v.x * polyScale + polyOffset} cy={v.y * polyScale + polyOffset} r={3} fill="#ff9b4a" />
                ))}
              </svg>
              {/* Vertex list */}
              <div style={{ flex: 1, maxHeight: 120, overflowY: 'auto' }}>
                <div style={{ fontSize: 9, color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Vertices (centered at 0,0)</div>
                {polyVerts.map((v, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#9999cc', lineHeight: 1.6 }}>
                    <span style={{ color: '#555', width: 16, display: 'inline-block' }}>{i}:</span>
                    ({v.x}, {v.y})
                  </div>
                ))}
              </div>
            </div>
            <ResultBox style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>Bounding box: {(polyRadius * 2).toFixed(1)} × {(polyRadius * 2).toFixed(1)}</div>
              <div style={{ fontSize: 10, color: '#666' }}>Side length: {(2 * polyRadius * Math.sin(Math.PI / polySides)).toFixed(2)} px</div>
              <div style={{ fontSize: 10, color: '#666' }}>Interior angle: {(((polySides - 2) * 180) / polySides).toFixed(2)}°</div>
            </ResultBox>
            {selectedShape && (
              <ApplyButton onClick={() => onApplyToShape({ width: polyRadius * 2, height: polyRadius * 2 })} style={{ marginTop: 8 }}>
                Resize shape to {polyRadius * 2} × {polyRadius * 2}
              </ApplyButton>
            )}
          </CalcSection>
        )}

        {/* ── Circle Fit ── */}
        {mode === 'circle' && (
          <CalcSection>
            <CalcTitle>Circle Fit</CalcTitle>
            <CalcDesc>Inscribed (fits inside) and circumscribed (encloses) circles for the selected shape</CalcDesc>
            {!selectedShape ? (
              <div style={{ color: '#555', fontSize: 11, padding: '12px 0' }}>Select a shape to compute circles</div>
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 11, color: '#888' }}>
                  Shape: <strong style={{ color: '#bbbfff' }}>{selectedShape.name}</strong> ({selectedShape.width.toFixed(0)} × {selectedShape.height.toFixed(0)} px)
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  {/* SVG preview */}
                  <svg width={100} height={100} style={{ flexShrink: 0, background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 6 }}>
                    {/* Rectangle */}
                    {(() => {
                      const sw = selectedShape.width; const sh = selectedShape.height;
                      const maxD = Math.max(sw, sh);
                      const sc = 90 / maxD;
                      const rw = sw * sc; const rh = sh * sc;
                      const rx = (100 - rw) / 2; const ry = (100 - rh) / 2;
                      const ins = (Math.min(sw, sh) / 2) * sc;
                      const circ = (Math.sqrt(sw * sw + sh * sh) / 2) * sc;
                      const cx = 50; const cy = 50;
                      return (
                        <>
                          <rect x={rx} y={ry} width={rw} height={rh} fill="none" stroke="#555" strokeWidth={1} strokeDasharray="2,2" />
                          <circle cx={cx} cy={cy} r={ins} fill="#7b7bff" fillOpacity={0.15} stroke="#7b7bff" strokeWidth={1.5} />
                          <circle cx={cx} cy={cy} r={circ} fill="none" stroke="#ff9b4a" strokeWidth={1} strokeDasharray="2,2" />
                        </>
                      );
                    })()}
                  </svg>
                  <div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>Inscribed (max circle inside)</div>
                      <div style={{ color: '#7b7bff', fontWeight: 700, fontSize: 16 }}>r = {inscribed.toFixed(2)} px</div>
                      <div style={{ fontSize: 10, color: '#666' }}>diameter = {(inscribed * 2).toFixed(2)} px</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>Circumscribed (min circle outside)</div>
                      <div style={{ color: '#ff9b4a', fontWeight: 700, fontSize: 16 }}>r = {circumscribed.toFixed(2)} px</div>
                      <div style={{ fontSize: 10, color: '#666' }}>diameter = {(circumscribed * 2).toFixed(2)} px</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <ApplyButton onClick={() => onApplyToShape({ width: inscribed * 2, height: inscribed * 2, borderRadius: 9999 })}>
                    Apply inscribed circle
                  </ApplyButton>
                  <ApplyButton onClick={() => onApplyToShape({ width: circumscribed * 2, height: circumscribed * 2, borderRadius: 9999 })}>
                    Apply circumscribed
                  </ApplyButton>
                </div>
              </>
            )}
          </CalcSection>
        )}

        {/* ── Aspect Ratio ── */}
        {mode === 'ratio' && (
          <CalcSection>
            <CalcTitle>Aspect Ratio Scaler</CalcTitle>
            <CalcDesc>Scale any dimension while maintaining the exact aspect ratio</CalcDesc>
            <Row>
              <Field label="Width (px)">
                <input type="number" value={ratioW} onChange={e => setRatioW(Number(e.target.value))} style={inputStyle} />
              </Field>
              <Field label="Height (px)">
                <input type="number" value={ratioH} onChange={e => setRatioH(Number(e.target.value))} style={inputStyle} />
              </Field>
            </Row>
            {selectedShape && (
              <button onClick={() => { setRatioW(selectedShape.width); setRatioH(selectedShape.height); }}
                style={{ fontSize: 10, color: '#7b7bff', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginTop: 4 }}>
                ← Use selected shape ({selectedShape.width.toFixed(0)} × {selectedShape.height.toFixed(0)})
              </button>
            )}
            <div style={{ fontSize: 10, color: '#555', margin: '6px 0 2px' }}>
              Current ratio: {(ratioW / ratioH).toFixed(4)} : 1 ({simplifyRatio(ratioW, ratioH)})
            </div>
            <Row>
              <Field label="Target value">
                <input type="number" value={ratioTarget} onChange={e => setRatioTarget(Number(e.target.value))} style={inputStyle} />
              </Field>
              <Field label="Constrain by">
                <select value={ratioMode} onChange={e => setRatioMode(e.target.value as typeof ratioMode)} style={selectStyle}>
                  <option value="width">Width</option>
                  <option value="height">Height</option>
                  <option value="diagonal">Diagonal</option>
                  <option value="area">Area (px²)</option>
                </select>
              </Field>
            </Row>
            <ResultBox>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#555' }}>Width</div>
                  <div style={{ color: '#7bffcc', fontWeight: 700, fontSize: 18 }}>{ratioResult.width} px</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#555' }}>Height</div>
                  <div style={{ color: '#7bffcc', fontWeight: 700, fontSize: 18 }}>{ratioResult.height} px</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#555' }}>Diagonal</div>
                  <div style={{ fontSize: 13, color: '#aaa', marginTop: 2 }}>{Math.sqrt(ratioResult.width ** 2 + ratioResult.height ** 2).toFixed(1)} px</div>
                </div>
              </div>
            </ResultBox>
            {selectedShape && (
              <ApplyButton onClick={() => onApplyToShape({ width: ratioResult.width, height: ratioResult.height })} style={{ marginTop: 8 }}>
                Apply {ratioResult.width} × {ratioResult.height} to shape
              </ApplyButton>
            )}
          </CalcSection>
        )}

        {/* ── Spacing Scale ── */}
        {mode === 'spacing' && (
          <CalcSection>
            <CalcTitle>Spacing Scale Generator</CalcTitle>
            <CalcDesc>Generate a consistent spacing system for padding, margin, and gap values</CalcDesc>
            <Row>
              <Field label="Base unit (px)">
                <input type="number" min={1} value={spacingBase} onChange={e => setSpacingBase(Number(e.target.value))} style={inputStyle} />
              </Field>
              <Field label="Type">
                <select value={spacingType} onChange={e => setSpacingType(e.target.value as typeof spacingType)} style={selectStyle}>
                  <option value="8pt">8pt Grid</option>
                  <option value="linear">Linear (n×base)</option>
                  <option value="fibonacci">Fibonacci</option>
                  <option value="golden">Golden Ratio</option>
                </select>
              </Field>
              <Field label="Steps">
                <input type="number" min={3} max={20} value={spacingSteps} onChange={e => setSpacingSteps(Number(e.target.value))} style={inputStyle} />
              </Field>
            </Row>
            <div style={{ marginTop: 10 }}>
              {spacingResult.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: '#444', width: 18, textAlign: 'right' }}>t{i + 1}</span>
                  <div style={{ background: '#7b7bff', height: 10, borderRadius: 2, width: Math.min(v * 0.7, 200) }} />
                  <span style={{ fontSize: 11, color: '#bbbfff', fontWeight: 600 }}>{v}px</span>
                  <span style={{ fontSize: 9, color: '#444' }}>= {pxToMm(v, 96)}mm</span>
                </div>
              ))}
            </div>
            <ResultBox style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>CSS Custom Properties</div>
              <pre style={{ fontSize: 10, color: '#7a9a7a', margin: 0 }}>
                {':root {\n' + spacingResult.map((v, i) => `  --space-${i + 1}: ${v}px;`).join('\n') + '\n}'}
              </pre>
            </ResultBox>
          </CalcSection>
        )}

        {/* ── Screen Calculator ── */}
        {mode === 'screen' && (
          <CalcSection>
            <CalcTitle>Screen Size Calculator</CalcTitle>
            <CalcDesc>Convert between CSS pixels, physical points, and millimeters</CalcDesc>
            <Row>
              <Field label="Pixels (px)">
                <input type="number" value={screenPx} onChange={e => setScreenPx(Number(e.target.value))} style={inputStyle} />
              </Field>
              <Field label="PPI (device)">
                <input type="number" value={screenPpi} onChange={e => setScreenPpi(Number(e.target.value))} style={inputStyle} />
              </Field>
            </Row>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, marginTop: 4 }}>
              {[
                { label: 'iPhone 15 Pro', ppi: 460 },
                { label: 'iPhone 14', ppi: 460 },
                { label: 'iPad Air', ppi: 264 },
                { label: 'MacBook Retina', ppi: 227 },
                { label: '4K Monitor', ppi: 163 },
                { label: 'Standard HD', ppi: 96 },
              ].map(d => (
                <button key={d.label} onClick={() => setScreenPpi(d.ppi)}
                  style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, border: `1px solid ${screenPpi === d.ppi ? '#4a4a8a' : '#2a2a4a'}`, background: screenPpi === d.ppi ? '#2a2a5a' : 'transparent', color: screenPpi === d.ppi ? '#bbbfff' : '#666', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {d.label}
                </button>
              ))}
            </div>
            <ResultBox>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#555' }}>CSS px</div>
                  <div style={{ color: '#7bffcc', fontWeight: 700, fontSize: 20 }}>{screenPx}</div>
                  <div style={{ fontSize: 9, color: '#444' }}>pixels</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#555' }}>Points (pt)</div>
                  <div style={{ color: '#7bffcc', fontWeight: 700, fontSize: 20 }}>{ptResult}</div>
                  <div style={{ fontSize: 9, color: '#444' }}>1pt = 1.333px</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#555' }}>Physical</div>
                  <div style={{ color: '#7bffcc', fontWeight: 700, fontSize: 20 }}>{mmResult}</div>
                  <div style={{ fontSize: 9, color: '#444' }}>mm @ {screenPpi}ppi</div>
                </div>
              </div>
            </ResultBox>
            <ResultBox style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Common breakpoints at {screenPpi}ppi</div>
              {[320, 375, 414, 768, 1024, 1280, 1440, 1920].map(px => (
                <div key={px} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: '#7b7bff' }}>{px}px</span>
                  <span style={{ color: '#888' }}>{pxToMm(px, screenPpi)}mm</span>
                  <span style={{ color: '#555' }}>{pxToPt(px)}pt</span>
                </div>
              ))}
            </ResultBox>
          </CalcSection>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #1e1e3a', background: '#0f0f1e', fontSize: 10, color: '#333', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>Precision geometry for perfect designs</span>
        <span>⌘⌥5</span>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CalcSection({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '14px 14px' }}>{children}</div>;
}

function CalcTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f8', marginBottom: 4 }}>{children}</div>;
}

function CalcDesc({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#666', marginBottom: 12, lineHeight: 1.4 }}>{children}</div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 9, color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      {children}
    </div>
  );
}

function ResultBox({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 6, padding: '10px 12px', marginBottom: 4, ...style }}>
      {children}
    </div>
  );
}

function ApplyButton({ onClick, children, style }: { onClick: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick}
      style={{ flex: 1, padding: '6px 10px', background: '#2a2a5a', border: 'none', borderRadius: 6, color: '#bbbfff', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', ...style }}>
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box' as const, background: '#0d0d1a', border: '1px solid #2a2a4a',
  borderRadius: 5, color: '#c8c8e8', fontSize: 11, padding: '5px 7px', fontFamily: 'inherit', outline: 'none',
};

const selectStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box' as const, background: '#0d0d1a', border: '1px solid #2a2a4a',
  borderRadius: 5, color: '#c8c8e8', fontSize: 11, padding: '5px 7px', fontFamily: 'inherit', outline: 'none',
};

function simplifyRatio(w: number, h: number): string {
  const g = gcd(Math.round(w), Math.round(h));
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
