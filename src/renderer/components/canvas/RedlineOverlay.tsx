/**
 * RedlineOverlay — Live measurement lines between selected and nearby shapes.
 *
 * When a shape is selected, shows:
 * - The shape's own dimensions (W × H label)
 * - Distance to all other shapes (with redline arrows)
 * - Distances to canvas edges (if shape is near edges)
 * - X/Y position
 *
 * Toggle with ⌘D (design specs mode) or hold Alt while hovering shapes.
 */

import React, { useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

interface Props {
  active: boolean;
  shapes: Shape[];
  selectedId: string | null;
  zoom: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
}

interface Rect { x: number; y: number; w: number; h: number; }

function toScreen(cx: number, cy: number, zoom: number, panX: number, panY: number) {
  return { x: cx * zoom + panX, y: cy * zoom + panY };
}

function shapeRect(s: Shape): Rect {
  return { x: s.x, y: s.y, w: s.width, h: s.height };
}

// Distance between two rects (returns 0 if overlapping)
function rectDist(a: Rect, b: Rect): { dx: number; dy: number; gap: number; dir: 'left' | 'right' | 'top' | 'bottom' | 'overlap' } {
  const aRight = a.x + a.w;
  const aBottom = a.y + a.h;
  const bRight = b.x + b.w;
  const bBottom = b.y + b.h;

  const left = b.x - aRight;    // b is to the right of a
  const right = a.x - bRight;   // b is to the left of a
  const top = b.y - aBottom;    // b is below a
  const bottom = a.y - bBottom; // b is above a

  if (left >= 0) return { dx: left, dy: 0, gap: left, dir: 'right' };
  if (right >= 0) return { dx: -right, dy: 0, gap: right, dir: 'left' };
  if (top >= 0) return { dx: 0, dy: top, gap: top, dir: 'bottom' };
  if (bottom >= 0) return { dx: 0, dy: -bottom, gap: bottom, dir: 'top' };
  return { dx: 0, dy: 0, gap: 0, dir: 'overlap' };
}

const RED = '#ff5252';
const BLUE = '#2196f3';
const LABEL_BG = 'rgba(255,82,82,0.9)';
const LABEL_FG = '#fff';
const DIM_BG = 'rgba(16,24,40,0.85)';
const DIM_FG = '#e2e8f0';

function fmt(v: number): string {
  return v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);
}

interface MeasLine {
  x1: number; y1: number; x2: number; y2: number;
  label: string;
  labelX: number; labelY: number;
  color: string;
  labelBg: string;
  labelFg: string;
  dashed?: boolean;
}

export function RedlineOverlay({ active, shapes, selectedId, zoom, panX, panY, width, height }: Props) {
  const lines = useMemo<MeasLine[]>(() => {
    if (!active || !selectedId) return [];

    const sel = shapes.find(s => s.id === selectedId);
    if (!sel) return [];

    const result: MeasLine[] = [];
    const sr = shapeRect(sel);

    const s2 = (cx: number, cy: number) => toScreen(cx, cy, zoom, panX, panY);

    // ── Own dimensions ──────────────────────────────────────────────
    // Width line (top of shape)
    const topY = sel.y - 20;
    const p1 = s2(sel.x, topY);
    const p2 = s2(sel.x + sel.width, topY);
    result.push({
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      label: `${fmt(sel.width)}`,
      labelX: (p1.x + p2.x) / 2,
      labelY: p1.y - 1,
      color: BLUE, labelBg: DIM_BG, labelFg: DIM_FG,
    });

    // Height line (right of shape)
    const rightX = sel.x + sel.width + 20;
    const p3 = s2(rightX, sel.y);
    const p4 = s2(rightX, sel.y + sel.height);
    result.push({
      x1: p3.x, y1: p3.y, x2: p4.x, y2: p4.y,
      label: `${fmt(sel.height)}`,
      labelX: p3.x + 4,
      labelY: (p3.y + p4.y) / 2,
      color: BLUE, labelBg: DIM_BG, labelFg: DIM_FG,
    });

    // ── Position ────────────────────────────────────────────────────
    // X from canvas origin
    if (sel.x > 0) {
      const py = s2(sel.x / 2, sel.y + sel.height / 2);
      const pa = s2(0, sel.y + sel.height / 2);
      const pb = s2(sel.x, sel.y + sel.height / 2);
      result.push({
        x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
        label: `x: ${fmt(sel.x)}`,
        labelX: py.x, labelY: pa.y - 1,
        color: 'rgba(99,102,241,0.7)', labelBg: 'rgba(99,102,241,0.85)', labelFg: '#fff',
        dashed: true,
      });
    }

    // ── Distances to other shapes ───────────────────────────────────
    const others = shapes.filter(s => s.id !== selectedId);
    const MAX_SHAPES = 8; // limit for performance

    for (const other of others.slice(0, MAX_SHAPES)) {
      const or = shapeRect(other);
      const dist = rectDist(sr, or);

      if (dist.dir === 'overlap' || dist.gap > 400) continue;

      // Draw measurement line between the nearest edges
      let x1: number, y1: number, x2: number, y2: number, lx: number, ly: number;

      if (dist.dir === 'right') {
        // b is to the right of a
        const midY = Math.max(sr.y, or.y) + Math.abs(Math.min(sr.y + sr.h, or.y + or.h) - Math.max(sr.y, or.y)) / 2;
        const py = Math.min(Math.max(midY, Math.max(sr.y, or.y)), Math.min(sr.y + sr.h, or.y + or.h));
        const clamped = isFinite(py) ? py : (sr.y + sr.h / 2);
        const pa = s2(sr.x + sr.w, clamped);
        const pb = s2(or.x, clamped);
        x1 = pa.x; y1 = pa.y; x2 = pb.x; y2 = pb.y;
        lx = (x1 + x2) / 2; ly = y1 - 1;
      } else if (dist.dir === 'left') {
        const midY = sr.y + sr.h / 2;
        const pa = s2(sr.x, midY);
        const pb = s2(or.x + or.w, midY);
        x1 = pa.x; y1 = pa.y; x2 = pb.x; y2 = pb.y;
        lx = (x1 + x2) / 2; ly = y1 - 1;
      } else if (dist.dir === 'bottom') {
        // b is below a
        const midX = sr.x + sr.w / 2;
        const pa = s2(midX, sr.y + sr.h);
        const pb = s2(midX, or.y);
        x1 = pa.x; y1 = pa.y; x2 = pb.x; y2 = pb.y;
        lx = x1 + 4; ly = (y1 + y2) / 2;
      } else {
        // top: b is above a
        const midX = sr.x + sr.w / 2;
        const pa = s2(midX, sr.y);
        const pb = s2(midX, or.y + or.h);
        x1 = pa.x; y1 = pa.y; x2 = pb.x; y2 = pb.y;
        lx = x1 + 4; ly = (y1 + y2) / 2;
      }

      result.push({
        x1, y1, x2, y2,
        label: fmt(dist.gap),
        labelX: lx, labelY: ly,
        color: RED, labelBg: LABEL_BG, labelFg: LABEL_FG,
      });
    }

    return result;
  }, [active, shapes, selectedId, zoom, panX, panY]);

  const sel = selectedId ? shapes.find(s => s.id === selectedId) : null;

  if (!active || !selectedId || !sel) return null;

  const selScreen = toScreen(sel.x, sel.y, zoom, panX, panY);
  const selW = sel.width * zoom;
  const selH = sel.height * zoom;

  return (
    <svg
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        zIndex: 16, overflow: 'visible',
      }}
      width={width}
      height={height}
    >
      <defs>
        <marker id="redline-arrow-start" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse">
          <line x1="1" y1="1" x2="1" y2="5" stroke={RED} strokeWidth="1"/>
        </marker>
        <marker id="redline-arrow-end" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <line x1="5" y1="1" x2="5" y2="5" stroke={RED} strokeWidth="1"/>
        </marker>
        <marker id="blue-arrow-start" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse">
          <line x1="1" y1="1" x2="1" y2="5" stroke={BLUE} strokeWidth="1"/>
        </marker>
        <marker id="blue-arrow-end" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <line x1="5" y1="1" x2="5" y2="5" stroke={BLUE} strokeWidth="1"/>
        </marker>
      </defs>

      {/* Selected shape outline */}
      <rect
        x={selScreen.x - 1}
        y={selScreen.y - 1}
        width={selW + 2}
        height={selH + 2}
        fill="none"
        stroke={BLUE}
        strokeWidth={1}
        strokeDasharray="4 2"
        opacity={0.6}
      />

      {/* Measurement lines */}
      {lines.map((line, i) => {
        const isHoriz = Math.abs(line.y2 - line.y1) < 2;
        const isDim = line.color === BLUE;
        const markerStart = isDim ? 'url(#blue-arrow-start)' : 'url(#redline-arrow-start)';
        const markerEnd = isDim ? 'url(#blue-arrow-end)' : 'url(#redline-arrow-end)';

        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 4) return null;

        return (
          <g key={i}>
            <line
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke={line.color}
              strokeWidth={1}
              strokeDasharray={line.dashed ? '4 3' : undefined}
              markerStart={len > 12 ? markerStart : undefined}
              markerEnd={len > 12 ? markerEnd : undefined}
              opacity={0.85}
            />

            {/* Tick marks at ends */}
            {isHoriz ? (
              <>
                <line x1={line.x1} y1={line.y1 - 4} x2={line.x1} y2={line.y1 + 4} stroke={line.color} strokeWidth={1} opacity={0.7}/>
                <line x1={line.x2} y1={line.y2 - 4} x2={line.x2} y2={line.y2 + 4} stroke={line.color} strokeWidth={1} opacity={0.7}/>
              </>
            ) : (
              <>
                <line x1={line.x1 - 4} y1={line.y1} x2={line.x1 + 4} y2={line.y1} stroke={line.color} strokeWidth={1} opacity={0.7}/>
                <line x1={line.x2 - 4} y1={line.y2} x2={line.x2 + 4} y2={line.y2} stroke={line.color} strokeWidth={1} opacity={0.7}/>
              </>
            )}

            {/* Label */}
            <g transform={`translate(${line.labelX}, ${line.labelY})`}>
              <rect
                x={-20} y={-9} width={40} height={14}
                rx={3} fill={line.labelBg}
              />
              <text
                x={0} y={1}
                textAnchor="middle"
                fontSize={9}
                fontFamily="monospace"
                fill={line.labelFg}
                style={{ userSelect: 'none' }}
              >
                {line.label}
              </text>
            </g>
          </g>
        );
      })}

      {/* Shape info badge */}
      <g transform={`translate(${selScreen.x}, ${selScreen.y + selH + 6})`}>
        <rect
          x={0} y={0} width={120} height={18}
          rx={4} fill="rgba(33,150,243,0.85)"
        />
        <text x={6} y={12} fontSize={9} fontFamily="monospace" fill="white" style={{ userSelect: 'none' }}>
          {sel.type} · {fmt(sel.x)},{fmt(sel.y)} · {fmt(sel.width)}×{fmt(sel.height)}
        </text>
      </g>
    </svg>
  );
}
