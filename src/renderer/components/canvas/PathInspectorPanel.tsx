/**
 * PathInspectorPanel — SVG Path data inspector and editor for Quill.
 *
 * For path-type shapes, this panel shows:
 *  - Live SVG preview of the path
 *  - Editable table of bezier anchor + control points
 *  - Toggle for open/closed path
 *  - Line cap / join selectors
 *  - Import: paste a raw SVG "d" attribute string and parse to BezierPoints
 *  - Export: generate clean SVG path "d" string and full <svg> snippet
 *  - Path stats: total points, segments, approximate path length
 *  - "Simplify" — removes control points from straight segments
 *  - "Reverse" — reverses point order
 *
 * Keyboard: ⌘⌥P
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { BezierPoint, Shape } from '../../lib/shapes';

// ─── SVG Path Utilities ────────────────────────────────────────────────────────

/** Convert BezierPoint array to SVG path "d" string */
export function pointsToPathD(points: BezierPoint[], closed: boolean): string {
  if (!points.length) return '';
  const parts: string[] = [];
  const p0 = points[0];
  parts.push(`M ${fmt(p0.x)} ${fmt(p0.y)}`);

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const hasCp1 = prev.cp2x !== undefined && prev.cp2y !== undefined;
    const hasCp2 = curr.cp1x !== undefined && curr.cp1y !== undefined;

    if (hasCp1 && hasCp2) {
      parts.push(`C ${fmt(prev.cp2x!)} ${fmt(prev.cp2y!)} ${fmt(curr.cp1x!)} ${fmt(curr.cp1y!)} ${fmt(curr.x)} ${fmt(curr.y)}`);
    } else if (hasCp1) {
      parts.push(`Q ${fmt(prev.cp2x!)} ${fmt(prev.cp2y!)} ${fmt(curr.x)} ${fmt(curr.y)}`);
    } else if (hasCp2) {
      parts.push(`Q ${fmt(curr.cp1x!)} ${fmt(curr.cp1y!)} ${fmt(curr.x)} ${fmt(curr.y)}`);
    } else {
      parts.push(`L ${fmt(curr.x)} ${fmt(curr.y)}`);
    }
  }

  if (closed && points.length > 1) {
    // Closing segment
    const last = points[points.length - 1];
    const first = points[0];
    const hasCp = last.cp2x !== undefined && last.cp2y !== undefined;
    const hasReturn = first.cp1x !== undefined && first.cp1y !== undefined;
    if (hasCp && hasReturn) {
      parts.push(`C ${fmt(last.cp2x!)} ${fmt(last.cp2y!)} ${fmt(first.cp1x!)} ${fmt(first.cp1y!)} ${fmt(first.x)} ${fmt(first.y)}`);
    }
    parts.push('Z');
  }

  return parts.join(' ');
}

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

/** Approximate path length via cubic bezier sampling */
function estimatePathLength(points: BezierPoint[], closed: boolean): number {
  if (points.length < 2) return 0;
  let total = 0;
  const allPts = closed ? [...points, points[0]] : points;
  for (let i = 1; i < allPts.length; i++) {
    const a = allPts[i - 1];
    const b = allPts[i];
    const steps = 20;
    let prev = { x: a.x, y: a.y };
    for (let t = 1; t <= steps; t++) {
      const tt = t / steps;
      const tt2 = tt * tt;
      const tt3 = tt2 * tt;
      const mt = 1 - tt;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const hasCp1 = a.cp2x !== undefined;
      const hasCp2 = b.cp1x !== undefined;
      let cx: number, cy: number;
      if (hasCp1 && hasCp2) {
        cx = mt3 * a.x + 3 * mt2 * tt * a.cp2x! + 3 * mt * tt2 * b.cp1x! + tt3 * b.x;
        cy = mt3 * a.y + 3 * mt2 * tt * a.cp2y! + 3 * mt * tt2 * b.cp1y! + tt3 * b.y;
      } else {
        cx = mt * a.x + tt * b.x;
        cy = mt * a.y + tt * b.y;
      }
      const dx = cx - prev.x;
      const dy = cy - prev.y;
      total += Math.sqrt(dx * dx + dy * dy);
      prev = { x: cx, y: cy };
    }
  }
  return total;
}

/** Parse a basic SVG path "d" string into BezierPoints.
 * Supports: M, L, C, Q, Z (absolute only — normalization handled by simplification).
 */
export function parseSVGPathD(d: string): { points: BezierPoint[]; closed: boolean } {
  const tokens = d.trim().split(/[\s,]+|(?=[MLCQZmlcqz])/g).filter(Boolean);
  const points: BezierPoint[] = [];
  let closed = false;
  let i = 0;
  let lastX = 0;
  let lastY = 0;

  const num = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': case 'm': {
        const x = cmd === 'M' ? num() : lastX + num();
        const y = cmd === 'M' ? num() : lastY + num();
        points.push({ x, y });
        lastX = x; lastY = y;
        break;
      }
      case 'L': case 'l': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const x = cmd === 'L' ? num() : lastX + num();
          const y = cmd === 'L' ? num() : lastY + num();
          points.push({ x, y });
          lastX = x; lastY = y;
        }
        break;
      }
      case 'C': case 'c': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const cp2x = cmd === 'C' ? num() : lastX + num();
          const cp2y = cmd === 'C' ? num() : lastY + num();
          const cp1x = cmd === 'C' ? num() : lastX + num();
          const cp1y = cmd === 'C' ? num() : lastY + num();
          const x = cmd === 'C' ? num() : lastX + num();
          const y = cmd === 'C' ? num() : lastY + num();
          // Attach cp2 to the previous point
          if (points.length > 0) {
            const prev = points[points.length - 1];
            prev.cp2x = cp2x;
            prev.cp2y = cp2y;
          }
          points.push({ x, y, cp1x, cp1y });
          lastX = x; lastY = y;
        }
        break;
      }
      case 'Q': case 'q': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const qx = cmd === 'Q' ? num() : lastX + num();
          const qy = cmd === 'Q' ? num() : lastY + num();
          const x = cmd === 'Q' ? num() : lastX + num();
          const y = cmd === 'Q' ? num() : lastY + num();
          if (points.length > 0) {
            const prev = points[points.length - 1];
            prev.cp2x = qx;
            prev.cp2y = qy;
          }
          points.push({ x, y, cp1x: qx, cp1y: qy });
          lastX = x; lastY = y;
        }
        break;
      }
      case 'Z': case 'z':
        closed = true;
        break;
      default:
        break;
    }
  }

  return { points, closed };
}

/** Remove control points from segments that are effectively straight (< 1px deviation) */
export function simplifyPath(points: BezierPoint[]): BezierPoint[] {
  return points.map((pt, i) => {
    const prev = points[i - 1];
    const next = points[i + 1];
    const newPt: BezierPoint = { x: pt.x, y: pt.y };

    // Keep cp1 only if it meaningfully affects the curve to the previous point
    if (pt.cp1x !== undefined && prev) {
      const midX = (prev.x + pt.x) / 2;
      const midY = (prev.y + pt.y) / 2;
      const dist = Math.hypot(pt.cp1x - midX, pt.cp1y! - midY);
      if (dist > 1) {
        newPt.cp1x = pt.cp1x;
        newPt.cp1y = pt.cp1y;
      }
    }

    // Keep cp2 only if it meaningfully affects the curve to the next point
    if (pt.cp2x !== undefined && next) {
      const midX = (pt.x + next.x) / 2;
      const midY = (pt.y + next.y) / 2;
      const dist = Math.hypot(pt.cp2x - midX, pt.cp2y! - midY);
      if (dist > 1) {
        newPt.cp2x = pt.cp2x;
        newPt.cp2y = pt.cp2y;
      }
    }

    return newPt;
  });
}

/** Reverse path point order */
export function reversePath(points: BezierPoint[]): BezierPoint[] {
  return [...points].reverse().map(pt => ({
    x: pt.x,
    y: pt.y,
    // Swap in/out handles
    cp1x: pt.cp2x,
    cp1y: pt.cp2y,
    cp2x: pt.cp1x,
    cp2y: pt.cp1y,
  }));
}

// ─── Component Props ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onPatchShape: (patch: Partial<Shape>) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp2(n: number): number {
  return Math.round(n * 100) / 100;
}

const PREVIEW_SIZE = 200;

// ─── Main Component ────────────────────────────────────────────────────────────

export function PathInspectorPanel({ open, onClose, selectedShape, onPatchShape }: Props) {
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);

  if (!open) return null;

  const isPath = selectedShape?.type === 'path';
  const points: BezierPoint[] = selectedShape?.points ?? [];
  const closed = selectedShape?.pathClosed ?? false;
  const lineCap = selectedShape?.lineCap ?? 'round';
  const lineJoin = selectedShape?.lineJoin ?? 'round';

  // Compute SVG preview bounding box
  const previewData = useMemo(() => {
    if (!points.length) return null;
    const xs = points.flatMap(p => [p.x, p.cp1x ?? p.x, p.cp2x ?? p.x]);
    const ys = points.flatMap(p => [p.y, p.cp1y ?? p.y, p.cp2y ?? p.y]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pw = maxX - minX || 1;
    const ph = maxY - minY || 1;
    const scale = Math.min((PREVIEW_SIZE - 20) / pw, (PREVIEW_SIZE - 20) / ph);
    const ox = 10 - minX * scale;
    const oy = 10 - minY * scale;
    const scaledPoints = points.map(p => ({
      x: p.x * scale + ox,
      y: p.y * scale + oy,
      cp1x: p.cp1x !== undefined ? p.cp1x * scale + ox : undefined,
      cp1y: p.cp1y !== undefined ? p.cp1y * scale + oy : undefined,
      cp2x: p.cp2x !== undefined ? p.cp2x * scale + ox : undefined,
      cp2y: p.cp2y !== undefined ? p.cp2y * scale + oy : undefined,
    }));
    return { scaledPoints, pathD: pointsToPathD(scaledPoints, closed) };
  }, [points, closed]);

  const pathD = useMemo(() => pointsToPathD(points, closed), [points, closed]);
  const pathLength = useMemo(() => Math.round(estimatePathLength(points, closed)), [points, closed]);
  const segmentCount = points.length > 1 ? points.length - (closed ? 0 : 1) : 0;

  const exportSVG = useMemo(() => {
    if (!pathD) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${selectedShape?.width ?? 100}" height="${selectedShape?.height ?? 100}">\n  <path d="${pathD}" fill="${selectedShape?.fill ?? 'none'}" stroke="${selectedShape?.stroke ?? '#000000'}" stroke-width="${selectedShape?.strokeWidth ?? 1}"/>\n</svg>`;
  }, [pathD, selectedShape]);

  const updatePoint = useCallback((idx: number, field: keyof BezierPoint, value: string) => {
    const n = parseFloat(value);
    if (isNaN(n)) return;
    const newPoints = points.map((pt, i) => {
      if (i !== idx) return pt;
      return { ...pt, [field]: clamp2(n) };
    });
    onPatchShape({ points: newPoints });
  }, [points, onPatchShape]);

  const deletePoint = useCallback((idx: number) => {
    const newPoints = points.filter((_, i) => i !== idx);
    onPatchShape({ points: newPoints });
    if (selectedPointIdx === idx) setSelectedPointIdx(null);
  }, [points, onPatchShape, selectedPointIdx]);

  const handleSimplify = useCallback(() => {
    onPatchShape({ points: simplifyPath(points) });
  }, [points, onPatchShape]);

  const handleReverse = useCallback(() => {
    onPatchShape({ points: reversePath(points) });
  }, [points, onPatchShape]);

  const handleImport = useCallback(() => {
    try {
      setImportError('');
      const { points: newPoints, closed: newClosed } = parseSVGPathD(importText);
      if (!newPoints.length) { setImportError('No points found in path'); return; }
      onPatchShape({ points: newPoints, pathClosed: newClosed });
      setImportText('');
      setShowImport(false);
    } catch (e) {
      setImportError('Could not parse path data. Use absolute M, L, C, Q, Z commands.');
    }
  }, [importText, onPatchShape]);

  const handleCopyExport = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 1500);
    });
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed',
      right: 8,
      top: 100,
      width: 420,
      maxHeight: 'calc(100vh - 120px)',
      background: '#1a1a2e',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#16162a', borderBottom: '1px solid #2a2a4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>✏️</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f8', letterSpacing: 0.3 }}>Path Inspector</span>
          <span style={{ fontSize: 10, color: '#666', background: '#222', borderRadius: 4, padding: '1px 5px' }}>⌘⌥P</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {!isPath ? (
          /* No path selected */
          <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>〰️</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>No path shape selected</div>
            <div style={{ fontSize: 11, color: '#555' }}>Select a path-type shape to inspect and edit its bezier points</div>
          </div>
        ) : (
          <>
            {/* SVG Preview */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e1e3a' }}>
              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Preview</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ background: '#0d0d1a', borderRadius: 8, border: '1px solid #2a2a4a', flexShrink: 0 }}>
                  <svg width={PREVIEW_SIZE} height={PREVIEW_SIZE} style={{ display: 'block' }}>
                    {/* Grid dots */}
                    {Array.from({ length: 5 }).map((_, r) =>
                      Array.from({ length: 5 }).map((__, c) => (
                        <circle key={`${r}-${c}`} cx={10 + c * 45} cy={10 + r * 45} r={1} fill="#2a2a4a" />
                      ))
                    )}
                    {previewData && (
                      <>
                        {/* Control handle lines */}
                        {previewData.scaledPoints.map((pt, i) => (
                          <g key={i}>
                            {pt.cp1x !== undefined && (
                              <line x1={pt.x} y1={pt.y} x2={pt.cp1x} y2={pt.cp1y!} stroke="#4a4a8a" strokeWidth={1} strokeDasharray="2,2" />
                            )}
                            {pt.cp2x !== undefined && (
                              <line x1={pt.x} y1={pt.y} x2={pt.cp2x} y2={pt.cp2y!} stroke="#4a4a8a" strokeWidth={1} strokeDasharray="2,2" />
                            )}
                          </g>
                        ))}
                        {/* Path */}
                        <path
                          d={previewData.pathD}
                          fill={closed ? (selectedShape.fill ?? 'none') : 'none'}
                          fillOpacity={0.3}
                          stroke="#7b7bff"
                          strokeWidth={1.5}
                        />
                        {/* Control handles */}
                        {previewData.scaledPoints.map((pt, i) => (
                          <g key={`cp-${i}`}>
                            {pt.cp1x !== undefined && (
                              <circle cx={pt.cp1x} cy={pt.cp1y!} r={3} fill="none" stroke="#9b9bff" strokeWidth={1} />
                            )}
                            {pt.cp2x !== undefined && (
                              <circle cx={pt.cp2x} cy={pt.cp2y!} r={3} fill="none" stroke="#9b9bff" strokeWidth={1} />
                            )}
                          </g>
                        ))}
                        {/* Anchor points */}
                        {previewData.scaledPoints.map((pt, i) => (
                          <circle
                            key={`a-${i}`}
                            cx={pt.x}
                            cy={pt.y}
                            r={selectedPointIdx === i ? 5 : 4}
                            fill={selectedPointIdx === i ? '#7b7bff' : '#1a1a2e'}
                            stroke={selectedPointIdx === i ? '#ffffff' : '#7b7bff'}
                            strokeWidth={1.5}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedPointIdx(selectedPointIdx === i ? null : i)}
                          />
                        ))}
                      </>
                    )}
                    {!previewData && (
                      <text x={PREVIEW_SIZE / 2} y={PREVIEW_SIZE / 2} textAnchor="middle" fill="#444" fontSize={11}>No points</text>
                    )}
                  </svg>
                </div>

                {/* Stats */}
                <div style={{ flex: 1 }}>
                  <StatRow label="Points" value={points.length.toString()} />
                  <StatRow label="Segments" value={segmentCount.toString()} />
                  <StatRow label="~Length" value={`${pathLength}px`} />
                  <StatRow label="Closed" value={closed ? 'Yes' : 'No'} />
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={closed} onChange={e => onPatchShape({ pathClosed: e.target.checked })}
                        style={{ accentColor: '#7b7bff' }} />
                      <span style={{ color: '#aaa' }}>Closed path</span>
                    </label>
                  </div>
                  {/* Line cap/join */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Line Cap</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['butt', 'round', 'square'] as const).map(cap => (
                        <button key={cap} onClick={() => onPatchShape({ lineCap: cap })}
                          style={{ padding: '2px 7px', borderRadius: 4, border: `1px solid ${lineCap === cap ? '#7b7bff' : '#333'}`, background: lineCap === cap ? '#2a2a5a' : 'transparent', color: lineCap === cap ? '#bbbfff' : '#666', cursor: 'pointer', fontSize: 10 }}>
                          {cap}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Line Join</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['miter', 'round', 'bevel'] as const).map(join => (
                        <button key={join} onClick={() => onPatchShape({ lineJoin: join })}
                          style={{ padding: '2px 7px', borderRadius: 4, border: `1px solid ${lineJoin === join ? '#7b7bff' : '#333'}`, background: lineJoin === join ? '#2a2a5a' : 'transparent', color: lineJoin === join ? '#bbbfff' : '#666', cursor: 'pointer', fontSize: 10 }}>
                          {join}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Path operations */}
            <div style={{ padding: '8px 14px', borderBottom: '1px solid #1e1e3a', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <OpButton onClick={handleSimplify} title="Remove unnecessary control points" emoji="✂️" label="Simplify" />
              <OpButton onClick={handleReverse} title="Reverse point order" emoji="↩️" label="Reverse" />
              <OpButton onClick={() => setShowImport(v => !v)} title="Import SVG path d attribute" emoji="📥" label="Import" active={showImport} />
              <OpButton onClick={() => setShowExport(v => !v)} title="Export SVG path d attribute" emoji="📤" label="Export" active={showExport} />
            </div>

            {/* Import panel */}
            {showImport && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e3a', background: '#12122a' }}>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Import SVG Path</div>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder="Paste SVG path d attribute: M 10 20 L 50 80 C ..."
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d1a', border: `1px solid ${importError ? '#ff6b6b' : '#2a2a4a'}`, borderRadius: 6, color: '#c8c8e8', fontSize: 11, padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }}
                />
                {importError && <div style={{ color: '#ff6b6b', fontSize: 10, marginTop: 4 }}>{importError}</div>}
                <button
                  onClick={handleImport}
                  disabled={!importText.trim()}
                  style={{ marginTop: 6, padding: '5px 14px', background: importText.trim() ? '#3a3a8a' : '#222', border: 'none', borderRadius: 6, color: importText.trim() ? '#bbbfff' : '#555', cursor: importText.trim() ? 'pointer' : 'default', fontSize: 11, fontFamily: 'inherit' }}>
                  Apply to Shape
                </button>
              </div>
            )}

            {/* Export panel */}
            {showExport && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e3a', background: '#12122a' }}>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Export Path</div>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>SVG d attribute</div>
                <div style={{ background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '6px 8px', fontSize: 10, color: '#aaa', wordBreak: 'break-all', marginBottom: 8 }}>
                  {pathD || '(empty)'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleCopyExport(pathD)} style={{ padding: '4px 10px', background: '#2a2a5a', border: 'none', borderRadius: 5, color: '#bbbfff', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>
                    {copiedExport ? '✓ Copied!' : 'Copy d attr'}
                  </button>
                  <button onClick={() => handleCopyExport(exportSVG)} style={{ padding: '4px 10px', background: '#1a2a3a', border: 'none', borderRadius: 5, color: '#88bbdd', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>
                    Copy full SVG
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: '#555', marginBottom: 4 }}>SVG snippet</div>
                <pre style={{ margin: 0, background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: 6, padding: '6px 8px', fontSize: 10, color: '#7a9a7a', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {exportSVG}
                </pre>
              </div>
            )}

            {/* Points table */}
            <div style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Bezier Points ({points.length})</div>
                {selectedPointIdx !== null && (
                  <button onClick={() => deletePoint(selectedPointIdx)}
                    style={{ fontSize: 10, color: '#ff6b6b', background: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, border: '1px solid #4a1a1a' }}>
                    Delete selected
                  </button>
                )}
              </div>

              {points.length === 0 ? (
                <div style={{ color: '#444', fontSize: 11, textAlign: 'center', padding: '16px 0' }}>No points — add points using the path tool</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '20px 60px 60px 60px 60px 60px 60px', gap: 4, color: '#555', fontSize: 10, paddingBottom: 4, borderBottom: '1px solid #1e1e3a' }}>
                    <span>#</span>
                    <span>X</span>
                    <span>Y</span>
                    <span>CP1 X</span>
                    <span>CP1 Y</span>
                    <span>CP2 X</span>
                    <span>CP2 Y</span>
                  </div>
                  {points.map((pt, i) => (
                    <PointRow
                      key={i}
                      index={i}
                      pt={pt}
                      selected={selectedPointIdx === i}
                      onSelect={() => setSelectedPointIdx(selectedPointIdx === i ? null : i)}
                      onUpdate={(field, val) => updatePoint(i, field, val)}
                      onDelete={() => deletePoint(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 14px', borderTop: '1px solid #1e1e3a', background: '#13131f', flexShrink: 0, fontSize: 10, color: '#444', display: 'flex', justifyContent: 'space-between' }}>
        <span>Click preview anchor to select</span>
        <span>⌘⌥P to close</span>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
      <span style={{ color: '#555' }}>{label}</span>
      <span style={{ color: '#aaa', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function OpButton({ onClick, emoji, label, title, active }: { onClick: () => void; emoji: string; label: string; title: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={title}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: active ? '#2a2a5a' : '#1a1a2e', border: `1px solid ${active ? '#4a4a9a' : '#2a2a4a'}`, borderRadius: 6, color: active ? '#bbbfff' : '#888', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

interface PointRowProps {
  index: number;
  pt: BezierPoint;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (field: keyof BezierPoint, val: string) => void;
  onDelete: () => void;
}

function PointRow({ index, pt, selected, onSelect, onUpdate, onDelete }: PointRowProps) {
  const bg = selected ? '#1e1e4a' : index % 2 === 0 ? '#13131f' : '#16162a';
  return (
    <div
      onClick={onSelect}
      style={{ display: 'grid', gridTemplateColumns: '20px 60px 60px 60px 60px 60px 60px', gap: 4, background: bg, borderRadius: 4, padding: '3px 2px', cursor: 'pointer', border: selected ? '1px solid #3a3a7a' : '1px solid transparent' }}
    >
      <span style={{ color: '#555', display: 'flex', alignItems: 'center', paddingLeft: 2, fontSize: 10 }}>{index}</span>
      <CoordInput value={pt.x} onChange={v => onUpdate('x', v)} />
      <CoordInput value={pt.y} onChange={v => onUpdate('y', v)} />
      <CoordInput value={pt.cp1x} onChange={v => onUpdate('cp1x', v)} placeholder="—" dim />
      <CoordInput value={pt.cp1y} onChange={v => onUpdate('cp1y', v)} placeholder="—" dim />
      <CoordInput value={pt.cp2x} onChange={v => onUpdate('cp2x', v)} placeholder="—" dim />
      <CoordInput value={pt.cp2y} onChange={v => onUpdate('cp2y', v)} placeholder="—" dim />
    </div>
  );
}

interface CoordInputProps {
  value: number | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  dim?: boolean;
}

function CoordInput({ value, onChange, placeholder = '', dim = false }: CoordInputProps) {
  return (
    <input
      type="number"
      step={0.5}
      value={value !== undefined ? value : ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      style={{
        background: value !== undefined ? '#1a1a30' : 'transparent',
        border: '1px solid transparent',
        borderRadius: 3,
        color: dim && value === undefined ? '#333' : dim ? '#7a7a9a' : '#c8c8e8',
        fontSize: 10,
        padding: '2px 4px',
        width: '100%',
        boxSizing: 'border-box',
        outline: 'none',
        fontFamily: 'inherit',
        textAlign: 'right',
      }}
      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#4a4a8a'; }}
      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'transparent'; }}
    />
  );
}
