/**
 * SmartSpacingAdvisor — Live spacing analysis overlay for selected shapes.
 *
 * Shows:
 *  - Gap arrows between shapes (horizontal and vertical)
 *  - Inconsistency warnings (highlighted in amber)
 *  - One-click equalize / distribute controls
 *  - Auto-detect alignment opportunities
 *
 * Rendered inside the canvas overlay (position: absolute, pointer-events off by default).
 * The control panel is pointer-events: all.
 */

import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SpacingFix {
  axis: 'h' | 'v';
  label: string;
  description: string;
  apply: (shapes: Shape[]) => Partial<Shape>[];
}

interface GapLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  isInconsistent: boolean;
  axis: 'h' | 'v';
}

interface Props {
  shapes: Shape[];                   // ALL shapes on canvas
  selectedIds: string[];             // currently selected shape ids
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  visible: boolean;
  onApplyFix: (patches: Array<{ id: string } & Partial<Shape>>) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert canvas coords to screen coords */
function cx(v: number, zoom: number, pan: number) { return v * zoom + pan; }

/** Check if two numbers are "equal enough" (within threshold) */
function nearEq(a: number, b: number, tol = 1.5) { return Math.abs(a - b) <= tol; }

/** Sort shapes left-to-right */
function sortLR(shapes: Shape[]) {
  return [...shapes].sort((a, b) => a.x - b.x);
}

/** Sort shapes top-to-bottom */
function sortTB(shapes: Shape[]) {
  return [...shapes].sort((a, b) => a.y - b.y);
}

/** Compute horizontal gaps (right edge of s[i] → left edge of s[i+1]) */
function horizontalGaps(sorted: Shape[]): number[] {
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const rightEdge = sorted[i].x + sorted[i].width;
    const leftEdge = sorted[i + 1].x;
    gaps.push(leftEdge - rightEdge);
  }
  return gaps;
}

/** Compute vertical gaps */
function verticalGaps(sorted: Shape[]): number[] {
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const bottomEdge = sorted[i].y + sorted[i].height;
    const topEdge = sorted[i + 1].y;
    gaps.push(topEdge - bottomEdge);
  }
  return gaps;
}

/** Check if all values in an array are equal (within tolerance) */
function allEqual(nums: number[], tol = 1.5): boolean {
  if (nums.length <= 1) return true;
  return nums.every(n => nearEq(n, nums[0], tol));
}

/** Distribute shapes so gaps are equal (keep leftmost/topmost fixed) */
function distributeHorizontally(shapes: Shape[]): Array<{ id: string; x: number }> {
  const sorted = sortLR(shapes);
  if (sorted.length < 2) return [];
  const totalWidth = sorted.reduce((s, sh) => s + sh.width, 0);
  const leftmost = sorted[0].x;
  const rightmost = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
  const totalSpan = rightmost - leftmost;
  const evenGap = Math.max(0, (totalSpan - totalWidth) / (sorted.length - 1));
  const result: Array<{ id: string; x: number }> = [];
  let cursor = leftmost;
  for (const sh of sorted) {
    result.push({ id: sh.id, x: cursor });
    cursor += sh.width + evenGap;
  }
  return result;
}

function distributeVertically(shapes: Shape[]): Array<{ id: string; y: number }> {
  const sorted = sortTB(shapes);
  if (sorted.length < 2) return [];
  const totalHeight = sorted.reduce((s, sh) => s + sh.height, 0);
  const topmost = sorted[0].y;
  const bottommost = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
  const totalSpan = bottommost - topmost;
  const evenGap = Math.max(0, (totalSpan - totalHeight) / (sorted.length - 1));
  const result: Array<{ id: string; y: number }> = [];
  let cursor = topmost;
  for (const sh of sorted) {
    result.push({ id: sh.id, y: cursor });
    cursor += sh.height + evenGap;
  }
  return result;
}

/** Snap all shapes to align their left edges to the leftmost */
function alignLeft(shapes: Shape[]): Array<{ id: string; x: number }> {
  const leftmost = Math.min(...shapes.map(s => s.x));
  return shapes.map(s => ({ id: s.id, x: leftmost }));
}

/** Snap all shapes to align their top edges */
function alignTop(shapes: Shape[]): Array<{ id: string; y: number }> {
  const topmost = Math.min(...shapes.map(s => s.y));
  return shapes.map(s => ({ id: s.id, y: topmost }));
}

/** Align centers horizontally */
function alignCenterH(shapes: Shape[]): Array<{ id: string; y: number }> {
  const midY = shapes.reduce((s, sh) => s + sh.y + sh.height / 2, 0) / shapes.length;
  return shapes.map(s => ({ id: s.id, y: midY - s.height / 2 }));
}

/** Align centers vertically */
function alignCenterV(shapes: Shape[]): Array<{ id: string; x: number }> {
  const midX = shapes.reduce((s, sh) => s + sh.x + sh.width / 2, 0) / shapes.length;
  return shapes.map(s => ({ id: s.id, x: midX - s.width / 2 }));
}

// ── Analysis ───────────────────────────────────────────────────────────────────

interface SpacingAnalysis {
  hGaps: number[];
  vGaps: number[];
  hInconsistent: boolean;
  vInconsistent: boolean;
  hAligned: boolean;   // all left-edges aligned?
  vAligned: boolean;   // all top-edges aligned?
  centerHAligned: boolean; // all vertical centers aligned?
  centerVAligned: boolean; // all horizontal centers aligned?
  fixes: SpacingFix[];
  gapLines: GapLine[];
}

function analyzeSpacing(selectedShapes: Shape[], zoom: number, panX: number, panY: number): SpacingAnalysis {
  if (selectedShapes.length < 2) {
    return { hGaps: [], vGaps: [], hInconsistent: false, vInconsistent: false,
             hAligned: true, vAligned: true, centerHAligned: true, centerVAligned: true,
             fixes: [], gapLines: [] };
  }

  const hSorted = sortLR(selectedShapes);
  const vSorted = sortTB(selectedShapes);
  const hGaps = horizontalGaps(hSorted);
  const vGaps = verticalGaps(vSorted);

  const hInconsistent = hGaps.length > 1 && !allEqual(hGaps);
  const vInconsistent = vGaps.length > 1 && !allEqual(vGaps);

  const hAligned = allEqual(selectedShapes.map(s => s.x));
  const vAligned = allEqual(selectedShapes.map(s => s.y));
  const centerHAligned = allEqual(selectedShapes.map(s => s.y + s.height / 2));
  const centerVAligned = allEqual(selectedShapes.map(s => s.x + s.width / 2));

  // Build gap lines for visual overlay
  const gapLines: GapLine[] = [];

  // Horizontal gap lines (between shape right edge and next shape left edge)
  for (let i = 0; i < hSorted.length - 1; i++) {
    const a = hSorted[i];
    const b = hSorted[i + 1];
    const gap = b.x - (a.x + a.width);
    if (gap > 2) {
      const midY = (Math.max(a.y, b.y) + Math.min(a.y + a.height, b.y + b.height)) / 2;
      const screenY = cx(midY, zoom, panY);
      gapLines.push({
        x1: cx(a.x + a.width, zoom, panX),
        y1: screenY,
        x2: cx(b.x, zoom, panX),
        y2: screenY,
        label: `${Math.round(gap)}px`,
        isInconsistent: hInconsistent && !nearEq(gap, hGaps[0]),
        axis: 'h',
      });
    }
  }

  // Vertical gap lines
  for (let i = 0; i < vSorted.length - 1; i++) {
    const a = vSorted[i];
    const b = vSorted[i + 1];
    const gap = b.y - (a.y + a.height);
    if (gap > 2) {
      const midX = (Math.max(a.x, b.x) + Math.min(a.x + a.width, b.x + b.width)) / 2;
      const screenX = cx(midX, zoom, panX);
      gapLines.push({
        x1: screenX,
        y1: cx(a.y + a.height, zoom, panY),
        x2: screenX,
        y2: cx(b.y, zoom, panY),
        label: `${Math.round(gap)}px`,
        isInconsistent: vInconsistent && !nearEq(gap, vGaps[0]),
        axis: 'v',
      });
    }
  }

  // Build available fixes
  const fixes: SpacingFix[] = [];

  if (hInconsistent) {
    fixes.push({
      axis: 'h',
      label: 'Equalize H gaps',
      description: `Even out ${hGaps.length} horizontal gaps`,
      apply: (shapes) => {
        const patches = distributeHorizontally(shapes);
        return patches.map(p => p as Partial<Shape>);
      },
    });
  }

  if (vInconsistent) {
    fixes.push({
      axis: 'v',
      label: 'Equalize V gaps',
      description: `Even out ${vGaps.length} vertical gaps`,
      apply: (shapes) => {
        const patches = distributeVertically(shapes);
        return patches.map(p => p as Partial<Shape>);
      },
    });
  }

  if (!hAligned && !centerHAligned) {
    fixes.push({
      axis: 'v',
      label: 'Align tops',
      description: 'Snap all top edges to align',
      apply: (shapes) => alignTop(shapes).map(p => p as Partial<Shape>),
    });
    fixes.push({
      axis: 'v',
      label: 'Center H',
      description: 'Align vertical centers',
      apply: (shapes) => alignCenterH(shapes).map(p => p as Partial<Shape>),
    });
  }

  if (!vAligned && !centerVAligned) {
    fixes.push({
      axis: 'h',
      label: 'Align left',
      description: 'Snap all left edges to align',
      apply: (shapes) => alignLeft(shapes).map(p => p as Partial<Shape>),
    });
    fixes.push({
      axis: 'h',
      label: 'Center V',
      description: 'Align horizontal centers',
      apply: (shapes) => alignCenterV(shapes).map(p => p as Partial<Shape>),
    });
  }

  // Always offer distribute if 3+ shapes
  if (selectedShapes.length >= 3) {
    if (!hInconsistent) {
      fixes.push({
        axis: 'h',
        label: 'Space H evenly',
        description: 'Distribute with equal horizontal spacing',
        apply: (shapes) => distributeHorizontally(shapes).map(p => p as Partial<Shape>),
      });
    }
    if (!vInconsistent) {
      fixes.push({
        axis: 'v',
        label: 'Space V evenly',
        description: 'Distribute with equal vertical spacing',
        apply: (shapes) => distributeVertically(shapes).map(p => p as Partial<Shape>),
      });
    }
  }

  return { hGaps, vGaps, hInconsistent, vInconsistent, hAligned, vAligned,
           centerHAligned, centerVAligned, fixes, gapLines };
}

// ── Gap Line Overlay ───────────────────────────────────────────────────────────

function GapLineOverlay({ lines }: { lines: GapLine[] }) {
  return (
    <svg
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 18,
        overflow: 'visible',
      }}
    >
      {lines.map((line, i) => {
        const isH = line.axis === 'h';
        const color = line.isInconsistent ? '#f59e0b' : '#818cf8';
        const mid = isH
          ? { x: (line.x1 + line.x2) / 2, y: line.y1 }
          : { x: line.x1, y: (line.y1 + line.y2) / 2 };

        return (
          <g key={i}>
            {/* Main gap line */}
            <line
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke={color} strokeWidth={1.5} strokeDasharray="3 2"
              opacity={0.9}
            />
            {/* End caps */}
            {isH ? (
              <>
                <line x1={line.x1} y1={line.y1 - 5} x2={line.x1} y2={line.y1 + 5}
                      stroke={color} strokeWidth={1.5} opacity={0.7} />
                <line x1={line.x2} y1={line.y2 - 5} x2={line.x2} y2={line.y2 + 5}
                      stroke={color} strokeWidth={1.5} opacity={0.7} />
              </>
            ) : (
              <>
                <line x1={line.x1 - 5} y1={line.y1} x2={line.x1 + 5} y2={line.y1}
                      stroke={color} strokeWidth={1.5} opacity={0.7} />
                <line x1={line.x2 - 5} y1={line.y2} x2={line.x2 + 5} y2={line.y2}
                      stroke={color} strokeWidth={1.5} opacity={0.7} />
              </>
            )}
            {/* Label pill */}
            <rect
              x={mid.x - 14} y={mid.y - 8}
              width={28} height={16}
              rx={4}
              fill={line.isInconsistent ? 'rgba(245,158,11,0.9)' : 'rgba(99,102,241,0.85)'}
            />
            <text
              x={mid.x} y={mid.y + 4}
              textAnchor="middle"
              fill="white"
              fontSize={9}
              fontFamily="system-ui, sans-serif"
              fontWeight={600}
            >
              {line.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Control Panel ──────────────────────────────────────────────────────────────

interface ControlPanelProps {
  analysis: SpacingAnalysis;
  selectedShapes: Shape[];
  onApplyFix: (patches: Array<{ id: string } & Partial<Shape>>) => void;
  onClose: () => void;
  panelY: number;
  panelX: number;
}

function ControlPanel({ analysis, selectedShapes, onApplyFix, onClose, panelX, panelY }: ControlPanelProps) {
  const [applied, setApplied] = useState<string | null>(null);

  const { hGaps, vGaps, hInconsistent, vInconsistent, fixes } = analysis;
  const hasIssues = hInconsistent || vInconsistent;

  function applyFix(fix: SpacingFix) {
    const partials = fix.apply(selectedShapes);
    const patches = selectedShapes.map((s, i) => ({ id: s.id, ...partials[i] }));
    onApplyFix(patches);
    setApplied(fix.label);
    setTimeout(() => setApplied(null), 1200);
  }

  const avgH = hGaps.length > 0 ? Math.round(hGaps.reduce((a, b) => a + b, 0) / hGaps.length) : null;
  const avgV = vGaps.length > 0 ? Math.round(vGaps.reduce((a, b) => a + b, 0) / vGaps.length) : null;

  return (
    <div
      style={{
        position: 'absolute',
        left: Math.max(8, Math.min(panelX, (window.innerWidth || 1200) - 260)),
        top: Math.max(8, panelY),
        width: 240,
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 30,
        pointerEvents: 'all',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px 6px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>📐</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #e2e8f0)' }}>
            Spacing Advisor
          </span>
          {hasIssues && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              background: '#f59e0b', color: '#000',
              padding: '1px 5px', borderRadius: 4,
            }}>
              ISSUES
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted, #888)', fontSize: 14, lineHeight: 1,
            padding: 2, borderRadius: 3,
          }}
        >
          ✕
        </button>
      </div>

      {/* Gap stats */}
      <div style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
        {avgH !== null && (
          <div style={{
            flex: 1, background: 'var(--bg, #131320)',
            border: `1px solid ${hInconsistent ? '#f59e0b44' : 'var(--border, #2d2d3d)'}`,
            borderRadius: 6, padding: '5px 8px',
          }}>
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 2 }}>H GAPS</div>
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: hInconsistent ? '#f59e0b' : 'var(--text, #e2e8f0)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {hInconsistent
                ? `${Math.min(...hGaps).toFixed(0)}–${Math.max(...hGaps).toFixed(0)}`
                : `${avgH}px`}
            </div>
            {hInconsistent && (
              <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 1 }}>
                ⚠ Uneven
              </div>
            )}
          </div>
        )}
        {avgV !== null && (
          <div style={{
            flex: 1, background: 'var(--bg, #131320)',
            border: `1px solid ${vInconsistent ? '#f59e0b44' : 'var(--border, #2d2d3d)'}`,
            borderRadius: 6, padding: '5px 8px',
          }}>
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 2 }}>V GAPS</div>
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: vInconsistent ? '#f59e0b' : 'var(--text, #e2e8f0)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {vInconsistent
                ? `${Math.min(...vGaps).toFixed(0)}–${Math.max(...vGaps).toFixed(0)}`
                : `${avgV}px`}
            </div>
            {vInconsistent && (
              <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 1 }}>
                ⚠ Uneven
              </div>
            )}
          </div>
        )}
        {avgH === null && avgV === null && (
          <div style={{ fontSize: 11, color: 'var(--muted, #888)', padding: '4px 0' }}>
            Shapes are touching or overlapping
          </div>
        )}
      </div>

      {/* Fixes */}
      {fixes.length > 0 && (
        <div style={{ padding: '0 10px 10px' }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.06em' }}>
            SUGGESTED FIXES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {fixes.map(fix => (
              <button
                key={fix.label}
                onClick={() => applyFix(fix)}
                title={fix.description}
                style={{
                  height: 26,
                  padding: '0 8px',
                  background: applied === fix.label
                    ? 'rgba(34,197,94,0.2)'
                    : fix.axis === 'h'
                      ? 'rgba(99,102,241,0.12)'
                      : 'rgba(168,85,247,0.12)',
                  border: `1px solid ${applied === fix.label
                    ? 'rgba(34,197,94,0.4)'
                    : fix.axis === 'h'
                      ? 'rgba(99,102,241,0.25)'
                      : 'rgba(168,85,247,0.25)'}`,
                  borderRadius: 5,
                  color: applied === fix.label
                    ? '#22c55e'
                    : fix.axis === 'h'
                      ? '#818cf8'
                      : '#c084fc',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {applied === fix.label ? '✓ Applied' : fix.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasIssues && fixes.length === 0 && (
        <div style={{
          padding: '4px 10px 10px',
          fontSize: 11,
          color: '#22c55e',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span>✓</span>
          <span>Spacing looks consistent!</span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SmartSpacingAdvisor({
  shapes,
  selectedIds,
  zoom,
  panX,
  panY,
  canvasWidth,
  canvasHeight,
  visible,
  onApplyFix,
}: Props) {
  const [panelDismissed, setPanelDismissed] = useState(false);

  const selectedShapes = useMemo(
    () => shapes.filter(s => selectedIds.includes(s.id)),
    [shapes, selectedIds]
  );

  const analysis = useMemo(
    () => analyzeSpacing(selectedShapes, zoom, panX, panY),
    [selectedShapes, zoom, panX, panY]
  );

  // Reset dismiss when selection changes
  const selKey = selectedIds.join(',');
  const [lastSelKey, setLastSelKey] = React.useState(selKey);
  if (selKey !== lastSelKey) {
    setLastSelKey(selKey);
    if (panelDismissed) setPanelDismissed(false);
  }

  if (!visible || selectedIds.length < 2) return null;

  // Position the control panel below or to the right of the selection bounding box
  const minX = Math.min(...selectedShapes.map(s => s.x));
  const maxX = Math.max(...selectedShapes.map(s => s.x + s.width));
  const minY = Math.min(...selectedShapes.map(s => s.y));
  const maxY = Math.max(...selectedShapes.map(s => s.y + s.height));

  const screenMinX = cx(minX, zoom, panX);
  const screenMaxY = cx(maxY, zoom, panY);
  const screenMinY = cx(minY, zoom, panY);

  // Prefer below selection, else above
  const panelX = screenMinX;
  const panelY = screenMaxY + 12 < canvasHeight - 160 ? screenMaxY + 12 : screenMinY - 180;

  const handleApplyFix = (patches: Array<{ id: string } & Partial<Shape>>) => {
    onApplyFix(patches);
  };

  return (
    <>
      {/* Gap measurement lines (always visible) */}
      {analysis.gapLines.length > 0 && (
        <GapLineOverlay lines={analysis.gapLines} />
      )}

      {/* Control panel */}
      {!panelDismissed && (
        <ControlPanel
          analysis={analysis}
          selectedShapes={selectedShapes}
          onApplyFix={handleApplyFix}
          onClose={() => setPanelDismissed(true)}
          panelX={panelX}
          panelY={panelY}
        />
      )}
    </>
  );
}
