/**
 * MeasurementOverlay — Shows live distance measurements between the hovered
 * shape and its nearest neighbours when the user holds Alt/Option.
 *
 * Renders as a position:fixed SVG that covers the full viewport.
 * It reads canvas coordinates via the `zoom` and `pan` props.
 *
 * Usage:
 *   <MeasurementOverlay
 *     shapes={shapes}
 *     zoom={zoom}
 *     pan={{ x, y }}
 *     selectedId={selectedId}
 *     enabled={altKeyHeld}
 *   />
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  shapes: Shape[];
  zoom: number;
  pan: { x: number; y: number };
  selectedId: string | null;
  canvasOrigin: { x: number; y: number }; // pixel position of canvas top-left in viewport
}

interface Rect {
  x: number; y: number; w: number; h: number; id: string; name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert canvas coords to screen (viewport) coords */
function toScreen(cx: number, cy: number, zoom: number, pan: { x: number; y: number }, origin: { x: number; y: number }) {
  return {
    sx: origin.x + (cx + pan.x) * zoom,
    sy: origin.y + (cy + pan.y) * zoom,
  };
}

function shapeToRect(s: Shape): Rect {
  return { x: s.x, y: s.y, w: s.width, h: s.height, id: s.id, name: s.name || s.type };
}

/** Shortest horizontal and vertical gaps between two rects (can be negative if overlapping) */
function gaps(a: Rect, b: Rect) {
  const gapRight  = b.x - (a.x + a.w);
  const gapLeft   = a.x - (b.x + b.w);
  const gapBottom = b.y - (a.y + a.h);
  const gapTop    = a.y - (b.y + b.h);
  return { gapRight, gapLeft, gapBottom, gapTop };
}

/** Find the nearest shape in each of the 4 axis directions */
function findNeighbours(target: Rect, others: Rect[]) {
  let right:  { shape: Rect; dist: number } | null = null;
  let left:   { shape: Rect; dist: number } | null = null;
  let bottom: { shape: Rect; dist: number } | null = null;
  let top:    { shape: Rect; dist: number } | null = null;

  for (const o of others) {
    if (o.id === target.id) continue;
    const { gapRight, gapLeft, gapBottom, gapTop } = gaps(target, o);

    // Right neighbour — must be to the right (gapRight ≥ 0) and y-ranges overlap
    if (gapRight >= 0 && o.y < target.y + target.h && o.y + o.h > target.y) {
      if (!right || gapRight < right.dist) right = { shape: o, dist: gapRight };
    }
    // Left neighbour
    if (gapLeft >= 0 && o.y < target.y + target.h && o.y + o.h > target.y) {
      if (!left || gapLeft < left.dist) left = { shape: o, dist: gapLeft };
    }
    // Bottom neighbour
    if (gapBottom >= 0 && o.x < target.x + target.w && o.x + o.w > target.x) {
      if (!bottom || gapBottom < bottom.dist) bottom = { shape: o, dist: gapBottom };
    }
    // Top neighbour
    if (gapTop >= 0 && o.x < target.x + target.w && o.x + o.w > target.x) {
      if (!top || gapTop < top.dist) top = { shape: o, dist: gapTop };
    }
  }

  return { right, left, bottom, top };
}

// ── Label component ───────────────────────────────────────────────────────────

interface MeasureLineProps {
  x1: number; y1: number; x2: number; y2: number;
  label: string;
  labelX: number; labelY: number;
  axis: 'h' | 'v';
}

function MeasureLine({ x1, y1, x2, y2, label, labelX, labelY }: MeasureLineProps) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="3 2" />
      {/* end caps */}
      <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1}
        stroke="#f43f5e" strokeWidth={1.5} />
      <line x1={x2 - 4} y1={y2} x2={x2 + 4} y2={y2}
        stroke="#f43f5e" strokeWidth={1.5} />
      {/* label pill */}
      <rect x={labelX - 16} y={labelY - 9} width={32} height={16}
        rx={4} fill="#f43f5e" opacity={0.95} />
      <text x={labelX} y={labelY + 4}
        fill="white" fontSize={10} fontWeight="600" textAnchor="middle"
        fontFamily="'JetBrains Mono', 'Fira Code', monospace">
        {label}
      </text>
    </g>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MeasurementOverlay({ shapes, zoom, pan, selectedId, canvasOrigin }: Props) {
  const [altHeld, setAltHeld] = useState(false);
  const [mouseCanvas, setMouseCanvas] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Track Alt key
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.altKey && e.key === 'Alt') setAltHeld(true); };
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltHeld(false); };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
    };
  }, []);

  // Track mouse position, convert to canvas coords
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!altHeld) return;
    const cx = (e.clientX - canvasOrigin.x) / zoom - pan.x;
    const cy = (e.clientY - canvasOrigin.y) / zoom - pan.y;
    setMouseCanvas({ x: cx, y: cy });
  }, [altHeld, zoom, pan, canvasOrigin]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove, true);
    return () => window.removeEventListener('mousemove', onMouseMove, true);
  }, [onMouseMove]);

  if (!altHeld || !mouseCanvas) return null;

  // Find hovered shape
  const visible = shapes.filter(s => !s.hidden && !s.locked);
  const hovered = [...visible].reverse().find(s =>
    mouseCanvas.x >= s.x && mouseCanvas.x <= s.x + s.width &&
    mouseCanvas.y >= s.y && mouseCanvas.y <= s.y + s.height
  );

  // Fallback to selectedId if no hover
  const targetShape = hovered || (selectedId ? shapes.find(s => s.id === selectedId) : null);
  if (!targetShape) return null;

  const target = shapeToRect(targetShape);
  const others = visible.map(shapeToRect);
  const { right, left, bottom, top } = findNeighbours(target, others);

  // Convert target rect to screen coords
  const tl = toScreen(target.x, target.y, zoom, pan, canvasOrigin);
  const tr = toScreen(target.x + target.w, target.y, zoom, pan, canvasOrigin);
  const bl = toScreen(target.x, target.y + target.h, zoom, pan, canvasOrigin);
  const br = toScreen(target.x + target.w, target.y + target.h, zoom, pan, canvasOrigin);

  const lines: React.ReactNode[] = [];

  // Target highlight box
  lines.push(
    <rect key="target-box"
      x={tl.sx} y={tl.sy}
      width={br.sx - tl.sx} height={br.sy - tl.sy}
      fill="none"
      stroke="#f43f5e"
      strokeWidth={1.5}
      strokeDasharray="4 2"
      opacity={0.8}
    />
  );

  // Dimension label (W×H inside box)
  const midX = (tl.sx + br.sx) / 2;
  const midY = (tl.sy + br.sy) / 2;
  const dimLabel = `${Math.round(target.w)} × ${Math.round(target.h)}`;
  const dimW = dimLabel.length * 6.5 + 12;
  lines.push(
    <g key="dim-label">
      <rect x={midX - dimW / 2} y={midY - 9} width={dimW} height={16} rx={4}
        fill="#1e1e2e" opacity={0.85} />
      <text x={midX} y={midY + 4} fill="#f43f5e" fontSize={10} fontWeight="700"
        textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
        {dimLabel}
      </text>
    </g>
  );

  // Shape name label above the box
  const nameW = (targetShape.name || targetShape.type).length * 6.5 + 12;
  const nameX = tl.sx;
  const nameY = tl.sy - 20;
  lines.push(
    <g key="name-label">
      <rect x={nameX} y={nameY} width={nameW} height={16} rx={3} fill="#f43f5e" opacity={0.9} />
      <text x={nameX + 6} y={nameY + 11} fill="white" fontSize={10} fontWeight="600"
        fontFamily="sans-serif">
        {targetShape.name || targetShape.type}
      </text>
    </g>
  );

  // Measurement lines to neighbours
  if (right) {
    const nRect = right.shape;
    const nTL = toScreen(nRect.x, nRect.y, zoom, pan, canvasOrigin);
    const nBR = toScreen(nRect.x + nRect.w, nRect.y + nRect.h, zoom, pan, canvasOrigin);
    const midY2 = (Math.max(tl.sy, nTL.sy) + Math.min(br.sy, nBR.sy)) / 2;
    const dist = Math.round(right.dist);
    lines.push(
      <MeasureLine key="right"
        x1={tr.sx} y1={midY2} x2={nTL.sx} y2={midY2}
        label={`${dist}`} labelX={(tr.sx + nTL.sx) / 2} labelY={midY2} axis="h"
      />
    );
  }

  if (left) {
    const nRect = left.shape;
    const nTL = toScreen(nRect.x, nRect.y, zoom, pan, canvasOrigin);
    const nBR = toScreen(nRect.x + nRect.w, nRect.y + nRect.h, zoom, pan, canvasOrigin);
    const midY2 = (Math.max(tl.sy, nTL.sy) + Math.min(br.sy, nBR.sy)) / 2;
    const dist = Math.round(left.dist);
    lines.push(
      <MeasureLine key="left"
        x1={tl.sx} y1={midY2} x2={nBR.sx} y2={midY2}
        label={`${dist}`} labelX={(tl.sx + nBR.sx) / 2} labelY={midY2} axis="h"
      />
    );
  }

  if (bottom) {
    const nRect = bottom.shape;
    const nTL = toScreen(nRect.x, nRect.y, zoom, pan, canvasOrigin);
    const nBR = toScreen(nRect.x + nRect.w, nRect.y + nRect.h, zoom, pan, canvasOrigin);
    const midX2 = (Math.max(tl.sx, nTL.sx) + Math.min(br.sx, nBR.sx)) / 2;
    const dist = Math.round(bottom.dist);
    lines.push(
      <MeasureLine key="bottom"
        x1={midX2} y1={br.sy} x2={midX2} y2={nTL.sy}
        label={`${dist}`} labelX={midX2} labelY={(br.sy + nTL.sy) / 2} axis="v"
      />
    );
  }

  if (top) {
    const nRect = top.shape;
    const nTL = toScreen(nRect.x, nRect.y, zoom, pan, canvasOrigin);
    const nBR = toScreen(nRect.x + nRect.w, nRect.y + nRect.h, zoom, pan, canvasOrigin);
    const midX2 = (Math.max(tl.sx, nTL.sx) + Math.min(br.sx, nBR.sx)) / 2;
    const dist = Math.round(top.dist);
    lines.push(
      <MeasureLine key="top"
        x1={midX2} y1={tl.sy} x2={midX2} y2={nBR.sy}
        label={`${dist}`} labelX={midX2} labelY={(tl.sy + nBR.sy) / 2} axis="v"
      />
    );
  }

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 8000,
      }}
    >
      {lines}
    </svg>
  );
}
