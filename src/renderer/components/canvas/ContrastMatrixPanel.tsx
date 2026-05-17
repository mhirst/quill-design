/**
 * ContrastMatrixPanel — WCAG contrast ratio matrix for all colors in the design.
 *
 * Features:
 *  - Extracts all unique fill/stroke colors from shapes
 *  - Displays an N×N matrix showing the contrast ratio for every color pair
 *  - Color-codes cells: AAA (≥7:1) green, AA (≥4.5:1) yellow, AA Large (≥3:1) orange, Fail red
 *  - Cell hover shows exact ratio and WCAG grades
 *  - "Text preview" column — shows "Aa" text in each color on every background
 *  - Filter: hide passing pairs / show only fails / show only AA / show only AAA
 *  - Export as CSV
 *  - Click cell to highlight both shapes using those colors
 *  - Shows total counts: how many combos pass AA, AAA, fail
 *  - Sort colors by luminance (dark to light)
 *
 * Keyboard: ⌘⌥C (C for Contrast)
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Color Math ────────────────────────────────────────────────────────────────

/** Parse hex color to [r, g, b] ∈ [0, 255] */
export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
  }
  if (h.length === 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return null;
}

/** Linearize sRGB component (0–255 → linearized 0–1) */
export function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance of a hex color */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two colors */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG grade for a ratio */
export type WCAGGrade = 'AAA' | 'AA' | 'AA-Large' | 'Fail';

export function wcagGrade(ratio: number): WCAGGrade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-Large';
  return 'Fail';
}

export function gradeColor(grade: WCAGGrade): string {
  switch (grade) {
    case 'AAA': return '#22c55e';
    case 'AA': return '#86efac';
    case 'AA-Large': return '#f59e0b';
    case 'Fail': return '#ef4444';
  }
}

export function gradeBg(grade: WCAGGrade): string {
  switch (grade) {
    case 'AAA': return '#0a2e1a';
    case 'AA': return '#0d2a1a';
    case 'AA-Large': return '#2a1e08';
    case 'Fail': return '#2a0a0a';
  }
}

// ─── Extract unique colors from shapes ────────────────────────────────────────

export function extractColors(shapes: Shape[]): string[] {
  const seen = new Set<string>();
  for (const shape of shapes) {
    if (shape.fill && shape.fill.startsWith('#') && shape.fillType !== 'image') {
      seen.add(shape.fill.toLowerCase());
    }
    if (shape.stroke && shape.stroke.startsWith('#')) {
      seen.add(shape.stroke.toLowerCase());
    }
  }
  // Filter out very light colors that are near-white (likely backgrounds)
  const colors = [...seen].filter(c => hexToRgb(c) !== null);
  // Sort by luminance dark → light
  return colors.sort((a, b) => relativeLuminance(a) - relativeLuminance(b));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'fail' | 'aa' | 'aaa' | 'pass';

// ─── Component Props ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ContrastMatrixPanel({ open, onClose, shapes }: Props) {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [hoveredCell, setHoveredCell] = useState<{ fg: string; bg: string } | null>(null);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());

  if (!open) return null;

  const colors = useMemo(() => extractColors(shapes), [shapes]);

  // Compute all pairs
  const pairs = useMemo(() => {
    const result: Array<{ fg: string; bg: string; ratio: number; grade: WCAGGrade }> = [];
    for (const bg of colors) {
      for (const fg of colors) {
        if (fg === bg) continue;
        const ratio = contrastRatio(fg, bg);
        result.push({ fg, bg, ratio, grade: wcagGrade(ratio) });
      }
    }
    return result;
  }, [colors]);

  // Stats
  const stats = useMemo(() => {
    const total = pairs.length;
    const aaa = pairs.filter(p => p.grade === 'AAA').length;
    const aa = pairs.filter(p => p.grade === 'AA').length;
    const aalarge = pairs.filter(p => p.grade === 'AA-Large').length;
    const fail = pairs.filter(p => p.grade === 'Fail').length;
    return { total, aaa, aa, aalarge, fail, pass: aaa + aa + aalarge };
  }, [pairs]);

  // Toggle color selection
  const toggleColor = useCallback((c: string) => {
    setSelectedColors(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  const exportCSV = useCallback(() => {
    const rows = [['Foreground', 'Background', 'Contrast Ratio', 'WCAG Grade']];
    for (const p of pairs) {
      rows.push([p.fg, p.bg, p.ratio.toFixed(2), p.grade]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contrast-matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [pairs]);

  const displayColors = useMemo(() => {
    if (selectedColors.size === 0) return colors;
    return colors.filter(c => selectedColors.has(c));
  }, [colors, selectedColors]);

  // Get ratio for a specific pair
  const getRatio = useCallback((fg: string, bg: string) => contrastRatio(fg, bg), []);

  // Should we show a cell?
  const shouldShow = useCallback((ratio: number, grade: WCAGGrade) => {
    switch (filterMode) {
      case 'all': return true;
      case 'fail': return grade === 'Fail';
      case 'aa': return grade === 'AA' || grade === 'AAA';
      case 'aaa': return grade === 'AAA';
      case 'pass': return grade !== 'Fail';
    }
  }, [filterMode]);

  const hovered = hoveredCell;
  const hoveredRatio = hovered ? getRatio(hovered.fg, hovered.bg) : null;
  const hoveredGrade = hoveredRatio !== null ? wcagGrade(hoveredRatio) : null;

  return (
    <div style={{
      position: 'fixed',
      right: 8,
      top: 60,
      width: 560,
      maxHeight: 'calc(100vh - 80px)',
      background: '#13131f',
      borderRadius: 12,
      border: '1px solid #2a2a4a',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      zIndex: 3100,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
      color: '#c8c8e8',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0f0f1e', borderBottom: '1px solid #2a2a4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>♿</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f8' }}>Contrast Matrix</span>
          <span style={{ fontSize: 10, color: '#555', background: '#1a1a2e', borderRadius: 4, padding: '1px 5px' }}>⌘⌥C</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={exportCSV} style={{ padding: '3px 8px', background: '#1a1a2e', border: 'none', borderRadius: 5, color: '#888', cursor: 'pointer', fontSize: 10 }}>Export CSV</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 0, flexShrink: 0, borderBottom: '1px solid #2a2a4a' }}>
        {[
          { label: 'AAA', count: stats.aaa, color: '#22c55e', bg: '#0a2e1a' },
          { label: 'AA', count: stats.aa, color: '#86efac', bg: '#0d2a1a' },
          { label: 'AA Large', count: stats.aalarge, color: '#f59e0b', bg: '#2a1e08' },
          { label: 'Fail', count: stats.fail, color: '#ef4444', bg: '#2a0a0a' },
        ].map(item => (
          <div key={item.label} style={{ flex: 1, padding: '6px 8px', background: item.bg, borderRight: '1px solid #2a2a4a', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.count}</div>
            <div style={{ fontSize: 9, color: '#666' }}>{item.label}</div>
          </div>
        ))}
        <div style={{ flex: 1, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#c8c8e8' }}>{colors.length}</div>
          <div style={{ fontSize: 9, color: '#666' }}>Colors</div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 14px', borderBottom: '1px solid #1e1e3a', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#555', marginRight: 4 }}>Show:</span>
        {([['all', 'All'], ['fail', 'Fails only'], ['pass', 'Passes only'], ['aa', 'AA+'], ['aaa', 'AAA only']] as [FilterMode, string][]).map(([mode, label]) => (
          <button key={mode} onClick={() => setFilterMode(mode)}
            style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, border: 'none', cursor: 'pointer', background: filterMode === mode ? '#3a3a8a' : '#1e1e3a', color: filterMode === mode ? '#bbbfff' : '#666' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {colors.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#555' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎨</div>
            <div>No colors found in design. Add some shapes with fill colors.</div>
          </div>
        ) : (
          <div style={{ padding: '10px 14px' }}>
            {/* Color legend row */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Colors in design (click to filter):</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {colors.map(c => {
                  const lum = relativeLuminance(c);
                  const textColor = lum > 0.35 ? '#000' : '#fff';
                  const isSelected = selectedColors.has(c);
                  return (
                    <button key={c} onClick={() => toggleColor(c)} title={c}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 12, background: c, border: `2px solid ${isSelected ? '#ffffff' : 'transparent'}`, cursor: 'pointer', color: textColor, fontSize: 10, fontFamily: 'ui-monospace, monospace', fontWeight: isSelected ? 700 : 400 }}>
                      {c}
                    </button>
                  );
                })}
                {selectedColors.size > 0 && (
                  <button onClick={() => setSelectedColors(new Set())}
                    style={{ padding: '3px 7px', borderRadius: 12, background: '#1e1e3a', border: 'none', cursor: 'pointer', color: '#888', fontSize: 10 }}>
                    Clear filter
                  </button>
                )}
              </div>
            </div>

            {/* Matrix */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 6px', color: '#555', fontSize: 9, textAlign: 'left', fontWeight: 'normal', whiteSpace: 'nowrap' }}>
                      FG →<br />BG ↓
                    </th>
                    {displayColors.map(fg => (
                      <th key={fg} style={{ padding: '4px 3px', textAlign: 'center', minWidth: 44 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 4, background: fg, margin: '0 auto 2px', border: '1px solid #2a2a4a' }} title={fg} />
                        <div style={{ fontSize: 8, color: '#444', fontFamily: 'ui-monospace, monospace' }}>{fg.slice(1, 5)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayColors.map(bg => (
                    <tr key={bg}>
                      {/* Row header — background color */}
                      <td style={{ padding: '3px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 3, background: bg, border: '1px solid #2a2a4a', flexShrink: 0 }} />
                          <span style={{ fontSize: 8, color: '#444', fontFamily: 'ui-monospace, monospace' }}>{bg.slice(1, 5)}</span>
                        </div>
                      </td>
                      {/* Cells */}
                      {displayColors.map(fg => {
                        if (fg === bg) {
                          return (
                            <td key={fg} style={{ textAlign: 'center', padding: 3 }}>
                              <div style={{ width: 40, height: 32, background: '#1e1e1e', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 14 }}>
                                —
                              </div>
                            </td>
                          );
                        }
                        const ratio = getRatio(fg, bg);
                        const grade = wcagGrade(ratio);
                        const show = shouldShow(ratio, grade);
                        const isHovered = hovered?.fg === fg && hovered?.bg === bg;

                        return (
                          <td key={fg} style={{ textAlign: 'center', padding: 2 }}>
                            {show ? (
                              <div
                                onMouseEnter={() => setHoveredCell({ fg, bg })}
                                onMouseLeave={() => setHoveredCell(null)}
                                style={{
                                  width: 40, height: 32,
                                  background: bg,
                                  borderRadius: 4,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexDirection: 'column',
                                  cursor: 'pointer',
                                  border: `2px solid ${isHovered ? '#ffffff' : gradeBg(grade)}`,
                                  transition: 'border-color 0.1s',
                                  position: 'relative',
                                  overflow: 'hidden',
                                }}>
                                <span style={{ fontSize: 11, color: fg, fontWeight: 700, lineHeight: 1 }}>Aa</span>
                                <span style={{ fontSize: 7, color: gradeColor(grade), fontWeight: 600, lineHeight: 1.2 }}>{ratio.toFixed(1)}</span>
                              </div>
                            ) : (
                              <div style={{ width: 40, height: 32, background: '#0d0d1a', borderRadius: 4, border: '1px solid #1a1a2e' }} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hovered cell details */}
            {hovered && hoveredRatio !== null && hoveredGrade !== null && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: gradeBg(hoveredGrade), borderRadius: 8, border: `1px solid ${gradeColor(hoveredGrade)}33`, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, background: hovered.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #333' }}>
                  <span style={{ fontSize: 20, color: hovered.fg, fontWeight: 700 }}>Aa</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: gradeColor(hoveredGrade), fontSize: 14 }}>
                    {hoveredGrade} · {hoveredRatio.toFixed(2)}:1
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', color: hovered.fg }}>FG: {hovered.fg}</span>
                    {' '}on{' '}
                    <span style={{ fontFamily: 'ui-monospace, monospace', color: hovered.bg === '#ffffff' || relativeLuminance(hovered.bg) > 0.5 ? '#aaa' : hovered.bg }}>BG: {hovered.bg}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 3 }}>
                    Normal text: {hoveredRatio >= 4.5 ? '✅ AA' : '❌ AA'} · {hoveredRatio >= 7 ? '✅ AAA' : '❌ AAA'} · Large text (18pt+): {hoveredRatio >= 3 ? '✅ AA' : '❌ AA'}
                  </div>
                </div>
              </div>
            )}

            {/* Grade legend */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['AAA', 'AA', 'AA-Large', 'Fail'] as WCAGGrade[]).map(grade => (
                <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: gradeBg(grade), border: `1px solid ${gradeColor(grade)}` }} />
                  <span style={{ fontSize: 10, color: gradeColor(grade) }}>{grade}</span>
                  <span style={{ fontSize: 10, color: '#444' }}>
                    {grade === 'AAA' ? '≥7:1' : grade === 'AA' ? '≥4.5:1' : grade === 'AA-Large' ? '≥3:1' : '<3:1'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #1e1e3a', background: '#0f0f1e', fontSize: 10, color: '#333', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>{stats.pass}/{stats.total} pairs pass WCAG ({stats.aaa} AAA, {stats.aa} AA, {stats.aalarge} AA Large)</span>
        <span>⌘⌥C</span>
      </div>
    </div>
  );
}
