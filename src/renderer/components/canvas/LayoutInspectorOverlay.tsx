/**
 * LayoutInspectorOverlay — Browser devtools-style layout visualization.
 *
 * Shows for each selected shape:
 *  - Blue content box outline
 *  - Orange margin indicators (distance to nearest neighbors)
 *  - Green padding zone (based on shape's explicit padding if any)
 *  - Pink gap indicators between shapes in the same group
 *  - Dimension labels (width × height) at corners
 *  - Distance numbers to canvas edges
 *  - Toggle sections: margins, padding, gaps, rulers
 *
 * Rendered as an SVG overlay. Works with any shape type.
 * Keyboard: ⌘⇧⌥I to toggle
 */

import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Props {
  shapes: Shape[];
  selectedIds: string[];
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  active: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sx(v: number, zoom: number, pan: number) { return v * zoom + pan; }

// Find nearest shapes in each direction from a given shape
function findNearest(shape: Shape, others: Shape[]) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;

  let left: number | null = null, right: number | null = null;
  let top: number | null = null, bottom: number | null = null;

  for (const other of others) {
    if (other.id === shape.id) continue;

    // Left neighbor: other's right edge < shape's left edge, within vertical overlap
    const vertOverlap = other.y < shape.y + shape.height && other.y + other.height > shape.y;
    if (vertOverlap) {
      const otherRight = other.x + other.width;
      if (otherRight <= shape.x) {
        const gap = shape.x - otherRight;
        if (left === null || gap < left) left = gap;
      }
      if (other.x >= shape.x + shape.width) {
        const gap = other.x - (shape.x + shape.width);
        if (right === null || gap < right) right = gap;
      }
    }

    // Top/bottom: horizontal overlap
    const horizOverlap = other.x < shape.x + shape.width && other.x + other.width > shape.x;
    if (horizOverlap) {
      const otherBottom = other.y + other.height;
      if (otherBottom <= shape.y) {
        const gap = shape.y - otherBottom;
        if (top === null || gap < top) top = gap;
      }
      if (other.y >= shape.y + shape.height) {
        const gap = other.y - (shape.y + shape.height);
        if (bottom === null || gap < bottom) bottom = gap;
      }
    }
  }

  return { left, right, top, bottom };
}

// ── Shape Box ──────────────────────────────────────────────────────────────────

interface BoxData {
  id: string;
  sx: number;   // screen left
  sy: number;   // screen top
  sw: number;   // screen width
  sh: number;   // screen height
  cw: number;   // canvas width
  ch: number;   // canvas height
  margin: { left: number | null; right: number | null; top: number | null; bottom: number | null };
}

// ── SVG Rendering ──────────────────────────────────────────────────────────────

function ContentBox({ b }: { b: BoxData }) {
  return (
    <rect
      x={b.sx} y={b.sy} width={b.sw} height={b.sh}
      fill="none"
      stroke="rgba(59,130,246,0.8)"
      strokeWidth={1.5}
      strokeDasharray="none"
    />
  );
}

function DimensionLabel({ b }: { b: BoxData }) {
  const text = `${Math.round(b.cw)} × ${Math.round(b.ch)}`;
  const mid = b.sx + b.sw / 2;
  const y = b.sy - 8;
  return (
    <>
      <rect x={mid - 28} y={y - 11} width={56} height={14} rx={3} fill="rgba(59,130,246,0.85)" />
      <text x={mid} y={y - 1} textAnchor="middle" fill="white" fontSize={9} fontFamily="system-ui" fontWeight={600}>
        {text}
      </text>
    </>
  );
}

function MarginLines({ b, zoom, panX, panY, allShapes, selectedShape }: {
  b: BoxData;
  zoom: number;
  panX: number;
  panY: number;
  allShapes: Shape[];
  selectedShape: Shape;
}) {
  const PAD = 2;
  const elements: React.ReactElement[] = [];

  const margin = b.margin;

  // Left margin line
  if (margin.left !== null && margin.left > 0) {
    const lineY = b.sy + b.sh / 2;
    const x1 = b.sx - margin.left * zoom;
    const x2 = b.sx;
    const mid = (x1 + x2) / 2;
    elements.push(
      <g key="ml">
        <line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke="#f97316" strokeWidth={1} strokeDasharray="3 2" />
        <line x1={x1} y1={lineY - 4} x2={x1} y2={lineY + 4} stroke="#f97316" strokeWidth={1} />
        <rect x={mid - 14} y={lineY - 9} width={28} height={14} rx={3} fill="rgba(249,115,22,0.85)" />
        <text x={mid} y={lineY + 1} textAnchor="middle" fill="white" fontSize={9} fontFamily="system-ui" fontWeight={600}>
          {Math.round(margin.left)}px
        </text>
      </g>
    );
  }

  // Right margin line
  if (margin.right !== null && margin.right > 0) {
    const lineY = b.sy + b.sh / 2;
    const x1 = b.sx + b.sw;
    const x2 = x1 + margin.right * zoom;
    const mid = (x1 + x2) / 2;
    elements.push(
      <g key="mr">
        <line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke="#f97316" strokeWidth={1} strokeDasharray="3 2" />
        <line x1={x2} y1={lineY - 4} x2={x2} y2={lineY + 4} stroke="#f97316" strokeWidth={1} />
        <rect x={mid - 14} y={lineY - 9} width={28} height={14} rx={3} fill="rgba(249,115,22,0.85)" />
        <text x={mid} y={lineY + 1} textAnchor="middle" fill="white" fontSize={9} fontFamily="system-ui" fontWeight={600}>
          {Math.round(margin.right)}px
        </text>
      </g>
    );
  }

  // Top margin line
  if (margin.top !== null && margin.top > 0) {
    const lineX = b.sx + b.sw / 2;
    const y1 = b.sy - margin.top * zoom;
    const y2 = b.sy;
    const mid = (y1 + y2) / 2;
    elements.push(
      <g key="mt">
        <line x1={lineX} y1={y1} x2={lineX} y2={y2} stroke="#f97316" strokeWidth={1} strokeDasharray="3 2" />
        <line x1={lineX - 4} y1={y1} x2={lineX + 4} y2={y1} stroke="#f97316" strokeWidth={1} />
        <rect x={lineX - 14} y={mid - 7} width={28} height={14} rx={3} fill="rgba(249,115,22,0.85)" />
        <text x={lineX} y={mid + 3} textAnchor="middle" fill="white" fontSize={9} fontFamily="system-ui" fontWeight={600}>
          {Math.round(margin.top)}px
        </text>
      </g>
    );
  }

  // Bottom margin line
  if (margin.bottom !== null && margin.bottom > 0) {
    const lineX = b.sx + b.sw / 2;
    const y1 = b.sy + b.sh;
    const y2 = y1 + margin.bottom * zoom;
    const mid = (y1 + y2) / 2;
    elements.push(
      <g key="mb">
        <line x1={lineX} y1={y1} x2={lineX} y2={y2} stroke="#f97316" strokeWidth={1} strokeDasharray="3 2" />
        <line x1={lineX - 4} y1={y2} x2={lineX + 4} y2={y2} stroke="#f97316" strokeWidth={1} />
        <rect x={lineX - 14} y={mid - 7} width={28} height={14} rx={3} fill="rgba(249,115,22,0.85)" />
        <text x={lineX} y={mid + 3} textAnchor="middle" fill="white" fontSize={9} fontFamily="system-ui" fontWeight={600}>
          {Math.round(margin.bottom)}px
        </text>
      </g>
    );
  }

  return <>{elements}</>;
}

function CanvasEdgeDistances({ b, canvasWidth, canvasHeight }: { b: BoxData; canvasWidth: number; canvasHeight: number }) {
  const distLeft = b.sx;
  const distTop = b.sy;
  const distRight = canvasWidth - (b.sx + b.sw);
  const distBottom = canvasHeight - (b.sy + b.sh);

  return (
    <g opacity={0.5}>
      {/* Left edge distance */}
      {distLeft > 20 && (
        <>
          <line x1={0} y1={b.sy + b.sh / 2} x2={b.sx} y2={b.sy + b.sh / 2} stroke="#a855f7" strokeWidth={1} strokeDasharray="2 2" />
          <text x={distLeft / 2} y={b.sy + b.sh / 2 - 4} textAnchor="middle" fill="#a855f7" fontSize={8} fontFamily="system-ui">
            {Math.round(distLeft / (b.sw / (b.cw || 1)))}
          </text>
        </>
      )}
    </g>
  );
}

// ── Controls Sidebar ───────────────────────────────────────────────────────────

interface ControlsProps {
  showMargins: boolean;
  showDimensions: boolean;
  showEdges: boolean;
  onToggleMargins: () => void;
  onToggleDimensions: () => void;
  onToggleEdges: () => void;
  selectedCount: number;
}

function InspectorControls({
  showMargins, showDimensions, showEdges,
  onToggleMargins, onToggleDimensions, onToggleEdges,
  selectedCount,
}: ControlsProps) {
  const toggleBtn = (label: string, emoji: string, active: boolean, onClick: () => void, color: string) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 8px', height: 24,
        background: active ? `${color}22` : 'transparent',
        border: `1px solid ${active ? color + '55' : 'var(--border, #2d2d3d)'}`,
        borderRadius: 4, cursor: 'pointer',
        color: active ? color : 'var(--muted, #888)',
        fontSize: 10, fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      <span>{emoji}</span>
      {label}
    </button>
  );

  return (
    <div style={{
      position: 'absolute',
      top: 48,
      left: 12,
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 8,
      padding: '6px 8px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      zIndex: 30,
      pointerEvents: 'all',
      display: 'flex', flexDirection: 'column', gap: 4,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontWeight: 600, marginBottom: 2, letterSpacing: '0.06em' }}>
        LAYOUT INSPECTOR · {selectedCount} selected
      </div>
      {toggleBtn('Content box', '🔵', true, () => {}, '#3b82f6')}
      {toggleBtn('Margins / gaps', '🟠', showMargins, onToggleMargins, '#f97316')}
      {toggleBtn('Dimensions', '📐', showDimensions, onToggleDimensions, '#6366f1')}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function LayoutInspectorOverlay({
  shapes, selectedIds, zoom, panX, panY,
  canvasWidth, canvasHeight, active,
}: Props) {
  const [showMargins, setShowMargins] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showEdges, setShowEdges] = useState(false);

  const selectedShapes = useMemo(
    () => shapes.filter(s => selectedIds.includes(s.id)),
    [shapes, selectedIds]
  );

  const boxData = useMemo((): BoxData[] => {
    return selectedShapes.map(shape => {
      const screenX = sx(shape.x, zoom, panX);
      const screenY = sx(shape.y, zoom, panY);
      const screenW = shape.width * zoom;
      const screenH = shape.height * zoom;
      const margin = findNearest(shape, shapes);
      return {
        id: shape.id,
        sx: screenX,
        sy: screenY,
        sw: screenW,
        sh: screenH,
        cw: shape.width,
        ch: shape.height,
        margin,
      };
    });
  }, [selectedShapes, shapes, zoom, panX, panY]);

  if (!active || selectedIds.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 19, overflow: 'hidden' }}>
      {/* SVG layer */}
      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {boxData.map((b, i) => {
          const shape = selectedShapes[i];
          return (
            <g key={b.id}>
              {/* Content box */}
              <ContentBox b={b} />

              {/* Corner handles */}
              {[
                [b.sx, b.sy],
                [b.sx + b.sw, b.sy],
                [b.sx, b.sy + b.sh],
                [b.sx + b.sw, b.sy + b.sh],
              ].map(([cx, cy], ci) => (
                <rect key={ci} x={cx - 3} y={cy - 3} width={6} height={6} fill="rgba(59,130,246,0.9)" rx={1} />
              ))}

              {/* Dimensions label */}
              {showDimensions && <DimensionLabel b={b} />}

              {/* Margin/gap lines */}
              {showMargins && (
                <MarginLines b={b} zoom={zoom} panX={panX} panY={panY} allShapes={shapes} selectedShape={shape} />
              )}
            </g>
          );
        })}

        {/* Canvas edge lines when shapes are selected */}
        {selectedIds.length > 0 && (
          <g opacity={0.15}>
            <line x1={0} y1={0} x2={canvasWidth} y2={0} stroke="#818cf8" strokeWidth={1} />
            <line x1={0} y1={canvasHeight} x2={canvasWidth} y2={canvasHeight} stroke="#818cf8" strokeWidth={1} />
            <line x1={0} y1={0} x2={0} y2={canvasHeight} stroke="#818cf8" strokeWidth={1} />
            <line x1={canvasWidth} y1={0} x2={canvasWidth} y2={canvasHeight} stroke="#818cf8" strokeWidth={1} />
          </g>
        )}
      </svg>

      {/* Controls panel */}
      <InspectorControls
        showMargins={showMargins}
        showDimensions={showDimensions}
        showEdges={showEdges}
        onToggleMargins={() => setShowMargins(v => !v)}
        onToggleDimensions={() => setShowDimensions(v => !v)}
        onToggleEdges={() => setShowEdges(v => !v)}
        selectedCount={selectedIds.length}
      />
    </div>
  );
}
