/**
 * LayerStackPanel — 3D isometric layer stack visualizer for Quill.
 *
 * Shows all shapes as stacked flat cards in an isometric 3D perspective,
 * providing an instant visual of z-order relationships.
 *
 * Features:
 *  - Isometric 3D projection of all layers as flat colored cards
 *  - Layer separation slider (how much vertical gap between layers)
 *  - Tilt angle control (view angle)
 *  - Hovering a card highlights the corresponding shape label
 *  - Click a card to select that shape
 *  - "Bring to front / Send to back" buttons for selected layer
 *  - Opacity per layer shown as card transparency
 *  - Hidden shapes shown with dashed outline + reduced opacity
 *  - Locked shapes shown with lock icon overlay
 *  - Layer count badge
 *  - Mini legend showing shape type icons
 *
 * Keyboard: ⌘⌥3 (for 3D)
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Isometric Math ────────────────────────────────────────────────────────────

/** Convert isometric coordinates to screen coordinates */
export function isoProject(x: number, y: number, z: number, tiltDeg: number): { sx: number; sy: number } {
  const tilt = (tiltDeg * Math.PI) / 180;
  // Standard isometric projection
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const sx = (x - y) * cos;
  const sy = (x + y) * sin - z;
  return { sx, sy };
}

/** Compute apparent color for a face (top, left, right) */
export function faceLighting(hex: string, face: 'top' | 'left' | 'right'): string {
  const rgb = hexToRgbSimple(hex);
  if (!rgb) return hex;
  const factors = { top: 1.0, left: 0.7, right: 0.85 };
  const f = factors[face];
  const r = Math.min(255, Math.round(rgb[0] * f));
  const g = Math.min(255, Math.round(rgb[1] * f));
  const b = Math.min(255, Math.round(rgb[2] * f));
  return `rgb(${r},${g},${b})`;
}

function hexToRgbSimple(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Type label for shape */
function shapeTypeIcon(type: string): string {
  switch (type) {
    case 'rectangle': return '▭';
    case 'ellipse': return '◯';
    case 'text': return 'T';
    case 'frame': return '⬜';
    case 'path': return '〜';
    default: return '?';
  }
}

/** Truncate name */
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ─── Component Props ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  selectedShapeId: string | null;
  onSelectShape: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
}

// ─── Main Component ────────────────────────────────────────────────────────────

const CARD_W = 100;
const CARD_H = 60;
const CANVAS_W = 420;
const CANVAS_H = 380;
const ISO_TILT_DEFAULT = 30;

export function LayerStackPanel({ open, onClose, shapes, selectedShapeId, onSelectShape, onMoveLayer }: Props) {
  const [separation, setSeparation] = useState(30);
  const [tilt, setTilt] = useState(ISO_TILT_DEFAULT);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!open) return null;

  // Shapes ordered bottom to top by z-index (index 0 = bottom)
  const orderedShapes = useMemo(() => [...shapes], [shapes]);
  const totalLayers = orderedShapes.length;

  // Compute isometric card positions
  const cards = useMemo(() => {
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H * 0.6;
    const tiltRad = (tilt * Math.PI) / 180;
    const cosT = Math.cos(tiltRad);
    const sinT = Math.sin(tiltRad);

    return orderedShapes.map((shape, idx) => {
      const z = idx * separation;
      // Card corners in isometric space — flat card in XY plane at height z
      // Half card dimensions
      const hw = CARD_W / 2;
      const hh = CARD_H / 2;

      // Project all four corners
      const project = (dx: number, dy: number) => {
        const sx = cx + (dx - dy) * cosT;
        const sy = cy + (dx + dy) * sinT - z;
        return { x: sx, y: sy };
      };

      const tl = project(-hw, -hh);
      const tr = project(hw, -hh);
      const br = project(hw, hh);
      const bl = project(-hw, hh);

      // Center for label
      const center = project(0, 0);

      // Left face (from bl to bottom of bl)
      const blBottom = { x: bl.x, y: bl.y + separation * sinT };
      const tlBottom = { x: tl.x, y: tl.y + separation * sinT };

      const fill = shape.fill ?? '#7b7bff';
      const isSelected = shape.id === selectedShapeId;
      const isHovered = shape.id === hoveredId;

      return { shape, idx, tl, tr, br, bl, center, blBottom, tlBottom, fill, isSelected, isHovered };
    });
  }, [orderedShapes, tilt, separation, selectedShapeId, hoveredId]);

  const selectedShape = shapes.find(s => s.id === selectedShapeId);
  const selectedIdx = selectedShapeId ? shapes.findIndex(s => s.id === selectedShapeId) : -1;

  return (
    <div style={{
      position: 'fixed',
      right: 8,
      top: 60,
      width: 460,
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
          <span style={{ fontSize: 15 }}>🗂️</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f8' }}>Layer Stack 3D</span>
          <span style={{ fontSize: 10, color: '#555', background: '#1a1a2e', borderRadius: 4, padding: '1px 5px' }}>⌘⌥3</span>
          <span style={{ fontSize: 10, color: '#555' }}>{totalLayers} layers</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 14px', borderBottom: '1px solid #1e1e3a', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>Separation: {separation}px</div>
          <input type="range" min={8} max={80} step={2} value={separation}
            onChange={e => setSeparation(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#7b7bff' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>Tilt: {tilt}°</div>
          <input type="range" min={10} max={50} step={1} value={tilt}
            onChange={e => setTilt(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#7b7bff' }} />
        </div>
      </div>

      {/* 3D View */}
      <div style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', background: '#0a0a14' }}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ display: 'block' }}>
          {/* Subtle grid floor */}
          {[-2, -1, 0, 1, 2].map(i => {
            const cosT = Math.cos((tilt * Math.PI) / 180);
            const sinT = Math.sin((tilt * Math.PI) / 180);
            const cx = CANVAS_W / 2;
            const cy = CANVAS_H * 0.6;
            const x1 = cx + (i * 40 - 120) * cosT;
            const y1 = cy + (i * 40 + 120) * sinT;
            const x2 = cx + (i * 40 + 120) * cosT;
            const y2 = cy + (i * 40 - 120) * sinT;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1a1a2e" strokeWidth={1} />
              </g>
            );
          })}

          {/* Draw cards from bottom to top */}
          {cards.map(({ shape, idx, tl, tr, br, bl, center, fill, isSelected, isHovered }) => {
            const opacity = (shape.opacity ?? 1) * (shape.hidden ? 0.25 : 1);
            const strokeColor = isSelected ? '#ffffff' : isHovered ? '#aaaaff' : '#2a2a4a';
            const strokeW = isSelected ? 2 : isHovered ? 1.5 : 0.5;
            const fillColor = isSelected ? lightenHex(fill, 0.2) : fill;

            // Top face polygon
            const topPath = `M ${tl.x.toFixed(1)},${tl.y.toFixed(1)} L ${tr.x.toFixed(1)},${tr.y.toFixed(1)} L ${br.x.toFixed(1)},${br.y.toFixed(1)} L ${bl.x.toFixed(1)},${bl.y.toFixed(1)} Z`;

            return (
              <g key={shape.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectShape(shape.id)}
                onMouseEnter={() => setHoveredId(shape.id)}
                onMouseLeave={() => setHoveredId(null)}>

                {/* Card face */}
                <path
                  d={topPath}
                  fill={fillColor}
                  fillOpacity={opacity * 0.9}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                />

                {/* Hidden indicator */}
                {shape.hidden && (
                  <path d={topPath} fill="none" stroke="#ffffff" strokeWidth={0.5} strokeDasharray="3,3" />
                )}

                {/* Label */}
                <text
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="system-ui, sans-serif"
                  fill={luminanceFromHex(fillColor) > 0.4 ? '#000' : '#fff'}
                  fillOpacity={opacity}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {shapeTypeIcon(shape.type)} {truncate(shape.name, 10)}
                </text>

                {/* Lock icon */}
                {shape.locked && (
                  <text x={tr.x - 8} y={tr.y + 4} fontSize={9} fill="#ffcc44" style={{ pointerEvents: 'none' }}>🔒</text>
                )}

                {/* Layer index badge */}
                <text x={tl.x + 3} y={tl.y + 3} fontSize={8} fill={isSelected ? '#ffffff' : '#666'} style={{ pointerEvents: 'none' }}>
                  {idx + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Layer count overlay */}
        {totalLayers === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 13 }}>
            No shapes on canvas
          </div>
        )}
      </div>

      {/* Selected layer controls */}
      {selectedShape && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid #1e1e3a', borderBottom: '1px solid #1e1e3a', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 2, background: selectedShape.fill ?? '#7b7bff', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#e0e0f8', fontSize: 12, flex: 1 }}>{selectedShape.name}</span>
            <span style={{ fontSize: 10, color: '#555' }}>Layer {selectedIdx + 1} of {totalLayers}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => onMoveLayer(selectedShape.id, 'top')}
              style={{ flex: 1, padding: '5px 6px', background: '#1e1e3a', border: 'none', borderRadius: 5, color: '#aaa', cursor: 'pointer', fontSize: 10 }}>
              ⬆️ Bring to Front
            </button>
            <button onClick={() => onMoveLayer(selectedShape.id, 'up')}
              style={{ flex: 1, padding: '5px 6px', background: '#1e1e3a', border: 'none', borderRadius: 5, color: '#aaa', cursor: 'pointer', fontSize: 10 }}>
              ↑ Forward
            </button>
            <button onClick={() => onMoveLayer(selectedShape.id, 'down')}
              style={{ flex: 1, padding: '5px 6px', background: '#1e1e3a', border: 'none', borderRadius: 5, color: '#aaa', cursor: 'pointer', fontSize: 10 }}>
              ↓ Back
            </button>
            <button onClick={() => onMoveLayer(selectedShape.id, 'bottom')}
              style={{ flex: 1, padding: '5px 6px', background: '#1e1e3a', border: 'none', borderRadius: 5, color: '#aaa', cursor: 'pointer', fontSize: 10 }}>
              ⬇️ Send to Back
            </button>
          </div>
        </div>
      )}

      {/* Layer list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {[...orderedShapes].reverse().map((shape, reversedIdx) => {
          const idx = totalLayers - 1 - reversedIdx;
          const isSelected = shape.id === selectedShapeId;
          const isHov = shape.id === hoveredId;
          return (
            <button key={shape.id}
              onClick={() => onSelectShape(shape.id)}
              onMouseEnter={() => setHoveredId(shape.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 14px', background: isSelected ? '#1e1e4a' : isHov ? '#161628' : 'transparent', border: 'none', borderBottom: '1px solid #1a1a2e', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 10, color: '#444', width: 18, flexShrink: 0, textAlign: 'right' }}>{idx + 1}</span>
              <div style={{ width: 16, height: 16, borderRadius: 2, background: shape.fill ?? '#7b7bff', flexShrink: 0, border: '1px solid #2a2a4a', opacity: shape.opacity ?? 1 }} />
              <span style={{ fontSize: 10, color: '#888', flexShrink: 0 }}>{shapeTypeIcon(shape.type)}</span>
              <span style={{ flex: 1, fontSize: 11, color: isSelected ? '#e0e0ff' : '#c8c8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shape.name}
              </span>
              {shape.hidden && <span style={{ fontSize: 9, color: '#555' }}>hidden</span>}
              {shape.locked && <span style={{ fontSize: 9, color: '#ffcc44' }}>🔒</span>}
              <span style={{ fontSize: 9, color: '#444' }}>{shape.type}</span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #1e1e3a', background: '#0f0f1e', fontSize: 10, color: '#333', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>Click card or row to select · Drag separation/tilt to adjust view</span>
        <span>⌘⌥3</span>
      </div>
    </div>
  );
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

function lightenHex(hex: string, amount: number): string {
  const rgb = hexToRgbSimple(hex);
  if (!rgb) return hex;
  const r = Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * amount));
  const g = Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * amount));
  const b = Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function luminanceFromHex(hex: string): number {
  const rgb = hexToRgbSimple(hex);
  if (!rgb) return 0.5;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
