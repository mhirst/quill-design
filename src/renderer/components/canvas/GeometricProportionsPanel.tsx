import React, { useState, useMemo, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PHI = 1.6180339887;          // Golden ratio
export const SQRT2 = 1.4142135623;        // √2 (ISO paper)
export const SQRT3 = 1.7320508076;        // √3
export const SILVER = 2.4142135623;       // Silver ratio
export const BRONZE = 3.3027756377;       // Bronze ratio

export const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

export type ProportionTarget = 'width' | 'height' | 'both';

export interface ProportionPreset {
  name: string;
  ratio: number;
  description: string;
  emoji: string;
}

export interface FibSnap {
  value: number;
  index: number;
}

export interface ProportionAnalysis {
  ratio: number;                 // w/h
  nearestPreset: ProportionPreset | null;
  nearestPresetDiff: number;
  nearestFibW: FibSnap;
  nearestFibH: FibSnap;
  isSquare: boolean;
  goldenArea: number;            // area if golden rect from given width
  silverArea: number;
  diagonalPx: number;
  perimeter: number;
  aspectLabel: string;           // e.g. "16:9"
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const PROPORTION_PRESETS: ProportionPreset[] = [
  { name: 'Golden Rectangle', ratio: PHI, description: '1:1.618 — found in art, nature, design', emoji: '✦' },
  { name: 'Silver Rectangle', ratio: SILVER, description: '1:2.414 — A-series paper, Japanese design', emoji: '◇' },
  { name: 'Bronze Rectangle', ratio: BRONZE, description: '1:3.303 — tall formats, banners', emoji: '◉' },
  { name: 'Square', ratio: 1, description: '1:1 — equal sides', emoji: '□' },
  { name: '√2 (ISO Paper)', ratio: SQRT2, description: '1:1.414 — A4/A3/A2 paper', emoji: '📄' },
  { name: '√3', ratio: SQRT3, description: '1:1.732 — equilateral triangle proportion', emoji: '△' },
  { name: '4:3 (Classic)', ratio: 4 / 3, description: 'Traditional screen ratio', emoji: '🖥' },
  { name: '16:9 (Widescreen)', ratio: 16 / 9, description: 'HD video / modern screens', emoji: '📺' },
  { name: '3:2 (Photo)', ratio: 3 / 2, description: '35mm film / DSLR sensors', emoji: '📷' },
  { name: '2:1 (Univisium)', ratio: 2 / 1, description: 'Wide cinematic format', emoji: '🎬' },
  { name: '21:9 (Ultra-wide)', ratio: 21 / 9, description: 'Ultrawide monitor / anamorphic', emoji: '🎦' },
  { name: '1:√φ', ratio: 1 / Math.sqrt(PHI), description: 'Reciprocal golden proportion', emoji: '⊹' },
];

// ── Pure math (exported for tests) ───────────────────────────────────────────

export function nearestFib(value: number): FibSnap {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < FIBONACCI.length; i++) {
    const diff = Math.abs(FIBONACCI[i] - value);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return { value: FIBONACCI[best], index: best };
}

export function ratioToAspectLabel(ratio: number): string {
  // Try common aspect ratios
  const candidates: [number, number][] = [
    [1, 1], [4, 3], [3, 2], [16, 9], [2, 1], [21, 9], [16, 10],
    [5, 4], [5, 3], [7, 4], [9, 16], [3, 4], [2, 3], [9, 21],
  ];
  let bestLabel = '';
  let bestDiff = 0.02; // threshold
  for (const [w, h] of candidates) {
    const diff = Math.abs(ratio - w / h);
    if (diff < bestDiff) { bestDiff = diff; bestLabel = `${w}:${h}`; }
  }
  return bestLabel || `${ratio.toFixed(3)}:1`;
}

export function nearestPreset(ratio: number): { preset: ProportionPreset; diff: number } | null {
  let best: ProportionPreset | null = null;
  let bestDiff = Infinity;
  for (const p of PROPORTION_PRESETS) {
    const diff = Math.abs(ratio - p.ratio);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return best ? { preset: best, diff: bestDiff } : null;
}

export function analyzeShape(width: number, height: number): ProportionAnalysis {
  const ratio = width / height;
  const np = nearestPreset(ratio);
  return {
    ratio,
    nearestPreset: np?.preset ?? null,
    nearestPresetDiff: np?.diff ?? 0,
    nearestFibW: nearestFib(width),
    nearestFibH: nearestFib(height),
    isSquare: Math.abs(ratio - 1) < 0.02,
    goldenArea: width * (width / PHI),
    silverArea: width * (width / SILVER),
    diagonalPx: Math.sqrt(width * width + height * height),
    perimeter: 2 * (width + height),
    aspectLabel: ratioToAspectLabel(ratio),
  };
}

export function goldenDimensions(base: number, fixed: 'width' | 'height'): { width: number; height: number } {
  if (fixed === 'width') return { width: Math.round(base), height: Math.round(base / PHI) };
  return { width: Math.round(base * PHI), height: Math.round(base) };
}

export function fibSeries(count: number, start?: number): number[] {
  if (start !== undefined) {
    // Find the Fibonacci number ≥ start
    let idx = FIBONACCI.findIndex(f => f >= start);
    if (idx === -1) idx = FIBONACCI.length - 1;
    return FIBONACCI.slice(idx, idx + count);
  }
  return FIBONACCI.slice(0, count);
}

export function snapToFib(value: number): number {
  return nearestFib(value).value;
}

export function proportionDiffPercent(actual: number, target: number): number {
  return Math.abs((actual - target) / target) * 100;
}

export function suggestGoldenHeight(width: number): number {
  return Math.round(width / PHI);
}

export function suggestGoldenWidth(height: number): number {
  return Math.round(height * PHI);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape?: Shape | null;
  onResize?: (width: number, height: number) => void;
}

type TabId = 'analyze' | 'snap' | 'presets';

export function GeometricProportionsPanel({ open, onClose, selectedShape, onResize }: Props) {
  const [tab, setTab] = useState<TabId>('analyze');
  const [manualW, setManualW] = useState(400);
  const [manualH, setManualH] = useState(300);
  const [fibCount, setFibCount] = useState(8);

  const shapeW = selectedShape?.width ?? manualW;
  const shapeH = selectedShape?.height ?? manualH;

  const analysis = useMemo(() => analyzeShape(shapeW, shapeH), [shapeW, shapeH]);

  const handleApplyPreset = useCallback((preset: ProportionPreset) => {
    const newH = Math.round(shapeW / preset.ratio);
    onResize?.(shapeW, newH);
  }, [shapeW, onResize]);

  const handleSnapFib = useCallback((dimension: 'width' | 'height') => {
    const val = dimension === 'width' ? shapeW : shapeH;
    const snapped = snapToFib(val);
    onResize?.(
      dimension === 'width' ? snapped : shapeW,
      dimension === 'height' ? snapped : shapeH,
    );
  }, [shapeW, shapeH, onResize]);

  const handleMakeGolden = useCallback((anchor: 'width' | 'height') => {
    const dims = goldenDimensions(anchor === 'width' ? shapeW : shapeH, anchor);
    onResize?.(dims.width, dims.height);
  }, [shapeW, shapeH, onResize]);

  if (!open) return null;

  const panelBg = '#1e1e2e';
  const surface = '#2a2a3e';
  const border = '#3a3a55';
  const accent = '#f59e0b';
  const textPrimary = '#e2e8f0';
  const textMuted = '#94a3b8';
  const green = '#22c55e';
  const orange = '#f97316';

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', background: active ? accent : 'transparent',
    color: active ? '#1e1e2e' : textMuted, border: 'none', transition: 'all 0.15s',
  });

  const STAT_STYLE: React.CSSProperties = {
    background: surface, border: `1px solid ${border}`, borderRadius: 8,
    padding: '10px 12px',
  };

  const matchScore = 100 - Math.min(100, analysis.nearestPresetDiff * 200);
  const isGoodMatch = analysis.nearestPresetDiff < 0.05;

  return (
    <div style={{
      position: 'fixed', left: 16, top: 60, width: 360,
      maxHeight: 'calc(100vh - 80px)', background: panelBg,
      border: `1px solid ${border}`, borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', zIndex: 9022,
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px', borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>Geometric Proportions</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            Golden ratio, Fibonacci & proportion snapping
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: textMuted,
          cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
        }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 16px',
        borderBottom: `1px solid ${border}`, flexShrink: 0,
      }}>
        {(['analyze', 'snap', 'presets'] as TabId[]).map(t => (
          <button key={t} style={TAB_STYLE(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Dimension row */}
      <div style={{
        padding: '10px 16px', borderBottom: `1px solid ${border}`,
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center',
        flexShrink: 0, background: '#1a1a2e',
      }}>
        <div>
          <div style={{ fontSize: 10, color: textMuted, marginBottom: 3 }}>WIDTH</div>
          {selectedShape ? (
            <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary }}>{Math.round(shapeW)}px</div>
          ) : (
            <input
              type="number" value={manualW} min={1} max={9999}
              onChange={e => setManualW(Number(e.target.value))}
              style={{
                background: surface, border: `1px solid ${border}`, borderRadius: 6,
                color: textPrimary, fontSize: 14, fontWeight: 700, padding: '4px 8px',
                width: '100%', outline: 'none',
              }}
            />
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: textMuted }}>×</div>
          <div style={{ fontSize: 11, color: accent, fontWeight: 600, marginTop: 2 }}>
            {analysis.ratio.toFixed(3)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: textMuted, marginBottom: 3 }}>HEIGHT</div>
          {selectedShape ? (
            <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary }}>{Math.round(shapeH)}px</div>
          ) : (
            <input
              type="number" value={manualH} min={1} max={9999}
              onChange={e => setManualH(Number(e.target.value))}
              style={{
                background: surface, border: `1px solid ${border}`, borderRadius: 6,
                color: textPrimary, fontSize: 14, fontWeight: 700, padding: '4px 8px',
                width: '100%', outline: 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── Analyze Tab ── */}
        {tab === 'analyze' && (
          <div>
            {/* Nearest proportion match */}
            {analysis.nearestPreset && (
              <div style={{
                ...STAT_STYLE,
                marginBottom: 12,
                border: `1px solid ${isGoodMatch ? accent + '66' : border}`,
                background: isGoodMatch ? `${accent}11` : surface,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isGoodMatch ? accent : textPrimary }}>
                    {analysis.nearestPreset.emoji} {analysis.nearestPreset.name}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: isGoodMatch ? green : orange,
                  }}>
                    {isGoodMatch ? `${matchScore.toFixed(0)}% match` : `${(analysis.nearestPresetDiff * 100).toFixed(1)}% off`}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: textMuted }}>{analysis.nearestPreset.description}</div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: border, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: isGoodMatch ? accent : orange, width: `${matchScore}%`, borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Aspect', value: analysis.aspectLabel },
                { label: 'Ratio (w÷h)', value: analysis.ratio.toFixed(4) },
                { label: 'Diagonal', value: `${analysis.diagonalPx.toFixed(1)}px` },
                { label: 'Perimeter', value: `${analysis.perimeter}px` },
                { label: 'Area', value: `${(shapeW * shapeH).toLocaleString()}px²` },
                { label: 'Is square?', value: analysis.isSquare ? '✓ Yes' : '✗ No' },
              ].map(({ label, value }) => (
                <div key={label} style={STAT_STYLE}>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Fibonacci proximity */}
            <div style={{ ...STAT_STYLE, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 8 }}>Fibonacci proximity</div>
              {[
                { label: 'Width', actual: shapeW, snap: analysis.nearestFibW },
                { label: 'Height', actual: shapeH, snap: analysis.nearestFibH },
              ].map(({ label, actual, snap }) => {
                const diff = Math.abs(actual - snap.value);
                const isClose = diff <= 2;
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: textMuted }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: textPrimary, fontFamily: 'monospace' }}>{Math.round(actual)}px</span>
                      <span style={{ fontSize: 11, color: textMuted }}>→</span>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: isClose ? green : orange }}>
                        F{snap.index}: {snap.value}px {isClose ? '✓' : `(${diff > 0 ? '+' : ''}${diff.toFixed(0)})`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Golden ratio suggestions */}
            {onResize && (
              <div style={STAT_STYLE}>
                <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 8 }}>
                  ✦ Make golden (φ = {PHI.toFixed(3)})
                </div>
                {[
                  { label: 'Fix width, resize height', dims: goldenDimensions(shapeW, 'width') },
                  { label: 'Fix height, resize width', dims: goldenDimensions(shapeH, 'height') },
                ].map(({ label, dims }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: textMuted }}>{label}</span>
                    <button
                      onClick={() => onResize(dims.width, dims.height)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: `${accent}22`, border: `1px solid ${accent}55`,
                        color: accent, cursor: 'pointer',
                      }}
                    >{dims.width} × {dims.height}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Snap Tab ── */}
        {tab === 'snap' && (
          <div>
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 14 }}>
              Snap dimensions to nearby Fibonacci numbers or golden proportions.
            </div>

            {/* Fibonacci snapping */}
            <div style={{ ...STAT_STYLE, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 10 }}>Fibonacci snap</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['width', 'height'] as const).map(dim => {
                  const val = dim === 'width' ? shapeW : shapeH;
                  const snapped = snapToFib(val);
                  const diff = snapped - Math.round(val);
                  return (
                    <button
                      key={dim}
                      onClick={() => handleSnapFib(dim)}
                      disabled={!onResize}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 8,
                        background: onResize ? `${accent}22` : 'transparent',
                        border: `1px solid ${onResize ? accent + '55' : border}`,
                        color: onResize ? accent : textMuted,
                        cursor: onResize ? 'pointer' : 'not-allowed',
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      <div>{dim.charAt(0).toUpperCase() + dim.slice(1)}</div>
                      <div style={{ fontSize: 10, marginTop: 2, fontWeight: 400, color: textMuted }}>
                        {Math.round(val)} → {snapped} ({diff >= 0 ? '+' : ''}{diff})
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fib series display */}
            <div style={{ ...STAT_STYLE, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>Fibonacci series</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: textMuted }}>Show</span>
                  <input
                    type="number" min={4} max={15} value={fibCount}
                    onChange={e => setFibCount(Number(e.target.value))}
                    style={{
                      width: 48, background: surface, border: `1px solid ${border}`,
                      borderRadius: 4, color: textPrimary, fontSize: 11, padding: '2px 6px', outline: 'none',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {FIBONACCI.slice(0, Math.min(fibCount, FIBONACCI.length)).map((f, i) => {
                  const isCloseW = Math.abs(f - shapeW) <= 2;
                  const isCloseH = Math.abs(f - shapeH) <= 2;
                  return (
                    <div key={i} style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 11,
                      fontFamily: 'monospace', fontWeight: 600,
                      background: (isCloseW || isCloseH) ? `${accent}22` : surface,
                      color: (isCloseW || isCloseH) ? accent : textMuted,
                      border: `1px solid ${(isCloseW || isCloseH) ? accent + '55' : border}`,
                    }}>
                      {isCloseW && <span title="near width">W</span>}
                      {isCloseH && <span title="near height">H</span>}
                      {!isCloseW && !isCloseH ? '' : ' '}
                      {f}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Golden ratio variants */}
            <div style={STAT_STYLE}>
              <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 10 }}>Key ratios</div>
              {[
                { label: 'φ (golden)', ratio: PHI, color: '#f59e0b' },
                { label: '√2 (ISO)', ratio: SQRT2, color: '#a78bfa' },
                { label: '√3', ratio: SQRT3, color: '#34d399' },
                { label: 'Silver', ratio: SILVER, color: '#94a3b8' },
              ].map(({ label, ratio, color }) => {
                const targetH = Math.round(shapeW / ratio);
                return (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
                  }}>
                    <div>
                      <span style={{ fontSize: 12, color: textPrimary, fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 11, color: textMuted, marginLeft: 6 }}>{ratio.toFixed(3)}</span>
                    </div>
                    {onResize ? (
                      <button
                        onClick={() => onResize(shapeW, targetH)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: `${color}22`, border: `1px solid ${color}55`,
                          color: color, cursor: 'pointer',
                        }}
                      >{shapeW} × {targetH}</button>
                    ) : (
                      <span style={{ fontSize: 11, color: textMuted, fontFamily: 'monospace' }}>
                        → {targetH}px height
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Presets Tab ── */}
        {tab === 'presets' && (
          <div>
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 12 }}>
              Apply a proportion preset. Uses current width, adjusts height.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PROPORTION_PRESETS.map(p => {
                const targetH = Math.round(shapeW / p.ratio);
                const diff = proportionDiffPercent(analysis.ratio, p.ratio);
                const isActive = diff < 5;
                return (
                  <div key={p.name} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 8,
                    background: isActive ? `${accent}11` : surface,
                    border: `1px solid ${isActive ? accent + '55' : border}`,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? accent : textPrimary }}>
                        {p.emoji} {p.name} {isActive && '✓'}
                      </div>
                      <div style={{ fontSize: 10, color: textMuted, marginTop: 2 }}>{p.description}</div>
                      <div style={{ fontSize: 10, color: textMuted, marginTop: 2 }}>
                        Ratio: {p.ratio.toFixed(4)} · {diff.toFixed(1)}% from current
                      </div>
                    </div>
                    {onResize && (
                      <button
                        onClick={() => handleApplyPreset(p)}
                        style={{
                          marginLeft: 10, padding: '6px 12px', borderRadius: 6,
                          background: isActive ? accent : 'transparent',
                          border: `1px solid ${isActive ? accent : border}`,
                          color: isActive ? '#1e1e2e' : textMuted,
                          cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0,
                        }}
                      >
                        {shapeW}×{targetH}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
