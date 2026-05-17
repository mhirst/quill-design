/**
 * ZIndexVisualizerPanel — Isometric 3D layer stack visualizer
 *
 * Features:
 *  - Renders all shapes as a 3D isometric stack (deeper = lower z-index)
 *  - Each layer shows shape color, name, type, and depth number
 *  - Click a layer to select that shape on canvas
 *  - Drag layers up/down to reorder z-index
 *  - Adjustable layer gap (z-spread) and tilt angle
 *  - Shows bounding box outlines in the 3D view
 *  - Color-coded by shape type
 */

import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Utility exports (tested separately) ──────────────────────────────────────

export interface IsoLayer {
  shapeId: string;
  label: string;
  type: string;
  fill: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number; // 0 = bottom, n = top
  zIndex: number;
}

/** Convert canvas coordinates to isometric screen coordinates */
export function toIso(
  x: number, y: number, z: number,
  tiltDeg: number, scale: number,
): { sx: number; sy: number } {
  const tilt = (tiltDeg * Math.PI) / 180;
  const sx = (x - y) * Math.cos(tilt) * scale;
  const sy = (x + y) * Math.sin(tilt) * scale - z * scale;
  return { sx, sy };
}

/** Build IsoLayer records from shapes */
export function buildIsoLayers(shapes: Shape[]): IsoLayer[] {
  return shapes.map((shape, idx) => ({
    shapeId: shape.id,
    label: shape.name || `${shape.type} ${idx + 1}`,
    type: shape.type,
    fill: shape.fill || '#888888',
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    depth: idx,
    zIndex: idx,
  }));
}

/** Compute bounding box of all layers in canvas space */
export function layersBounds(layers: IsoLayer[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (layers.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const l of layers) {
    minX = Math.min(minX, l.x);
    minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, l.x + l.width);
    maxY = Math.max(maxY, l.y + l.height);
  }
  return { minX, minY, maxX, maxY };
}

/** Returns a good color for a shape type */
export function typeColor(type: string): string {
  const map: Record<string, string> = {
    rect: '#3b82f6',
    ellipse: '#22c55e',
    text: '#f59e0b',
    frame: '#8b5cf6',
    line: '#ec4899',
    arrow: '#ef4444',
    star: '#f97316',
    polygon: '#14b8a6',
    image: '#64748b',
  };
  return map[type] ?? '#888888';
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 380,
  width: 460,
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

const CLOSE_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#a08080',
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
};

// ── Isometric Renderer ────────────────────────────────────────────────────────

interface IsoViewProps {
  layers: IsoLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zSpread: number;
  tilt: number;
}

function IsoView({ layers, selectedId, onSelect, zSpread, tilt }: IsoViewProps) {
  const VIEW_W = 428;
  const VIEW_H = 240;

  const bounds = useMemo(() => layersBounds(layers), [layers]);
  const cw = Math.max(bounds.maxX - bounds.minX, 1);
  const ch = Math.max(bounds.maxY - bounds.minY, 1);

  // Compute a scale that fits everything into the view
  const scale = Math.min((VIEW_W * 0.35) / cw, (VIEW_H * 0.35) / ch, 0.15);
  const totalZ = layers.length * zSpread;

  // Project all corners and find screen bounds to center
  const allIsoPoints: Array<{ sx: number; sy: number }> = [];
  for (const l of layers) {
    const z = l.depth * zSpread;
    const nx = (l.x - bounds.minX) / cw;
    const ny = (l.y - bounds.minY) / ch;
    const nw = l.width / cw;
    const nh = l.height / ch;
    const corners = [
      { x: nx, y: ny },
      { x: nx + nw, y: ny },
      { x: nx + nw, y: ny + nh },
      { x: nx, y: ny + nh },
    ];
    for (const c of corners) {
      allIsoPoints.push(toIso(c.x * VIEW_W * 0.4, c.y * VIEW_H * 0.4, z, tilt, 1));
    }
  }
  if (allIsoPoints.length === 0) return null;
  const minSx = Math.min(...allIsoPoints.map(p => p.sx));
  const maxSx = Math.max(...allIsoPoints.map(p => p.sx));
  const minSy = Math.min(...allIsoPoints.map(p => p.sy));
  const maxSy = Math.max(...allIsoPoints.map(p => p.sy));
  const offsetX = VIEW_W / 2 - (minSx + maxSx) / 2;
  const offsetY = VIEW_H / 2 - (minSy + maxSy) / 2 + totalZ * 0.3;

  return (
    <svg width={VIEW_W} height={VIEW_H} style={{ display: 'block' }}>
      {/* Render bottom-to-top so top layers are drawn last (front) */}
      {[...layers].sort((a, b) => a.depth - b.depth).map(layer => {
        const z = layer.depth * zSpread;
        const nx = (layer.x - bounds.minX) / cw;
        const ny = (layer.y - bounds.minY) / ch;
        const nw = layer.width / cw;
        const nh = layer.height / ch;

        const project = (lx: number, ly: number, lz: number) => {
          const iso = toIso(lx * VIEW_W * 0.4, ly * VIEW_H * 0.4, lz, tilt, 1);
          return { x: iso.sx + offsetX, y: iso.sy + offsetY };
        };

        const tl = project(nx, ny, z);
        const tr = project(nx + nw, ny, z);
        const br = project(nx + nw, ny + nh, z);
        const bl = project(nx, ny + nh, z);

        // Top face
        const topPts = [tl, tr, br, bl].map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

        // Left face (visible only if tilt > 0)
        const blBot = project(nx, ny + nh, z - zSpread);
        const tlBot = project(nx, ny, z - zSpread);
        const leftPts = [bl, tl, tlBot, blBot].map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

        // Right face
        const trBot = project(nx + nw, ny, z - zSpread);
        const brBot = project(nx + nw, ny + nh, z - zSpread);
        const rightPts = [br, tr, trBot, brBot].map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

        const fillColor = layer.fill === 'transparent' ? '#888' : layer.fill;
        const isSelected = layer.shapeId === selectedId;
        const alpha = 0.85;

        // Darken fill for side faces
        const darken = (hex: string, factor: number) => {
          const c = hex.replace(/^#/, '').padEnd(6, '0').slice(0, 6);
          const r = Math.round(parseInt(c.slice(0, 2), 16) * factor);
          const g = Math.round(parseInt(c.slice(2, 4), 16) * factor);
          const b = Math.round(parseInt(c.slice(4, 6), 16) * factor);
          return '#' + [r, g, b].map(v => Math.min(v, 255).toString(16).padStart(2, '0')).join('');
        };

        return (
          <g
            key={layer.shapeId}
            onClick={() => onSelect(layer.shapeId)}
            style={{ cursor: 'pointer' }}
          >
            {/* Left face */}
            <polygon
              points={leftPts}
              fill={darken(fillColor, 0.5)}
              opacity={alpha}
            />
            {/* Right face */}
            <polygon
              points={rightPts}
              fill={darken(fillColor, 0.7)}
              opacity={alpha}
            />
            {/* Top face */}
            <polygon
              points={topPts}
              fill={fillColor}
              opacity={alpha}
              stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.2)'}
              strokeWidth={isSelected ? 1.5 : 0.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

interface LayerListProps {
  layers: IsoLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
}

function LayerList({ layers, selectedId, onSelect, onMove }: LayerListProps) {
  // Show top-to-bottom (highest z-index first)
  const sorted = [...layers].sort((a, b) => b.depth - a.depth);

  return (
    <div>
      {sorted.map((layer, i) => {
        const isSelected = layer.shapeId === selectedId;
        return (
          <div
            key={layer.shapeId}
            onClick={() => onSelect(layer.shapeId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid #2a1010',
              cursor: 'pointer',
              background: isSelected ? '#3a1010' : 'transparent',
              borderRadius: isSelected ? 6 : 0,
            }}
          >
            {/* Depth indicator */}
            <div style={{
              width: 28,
              textAlign: 'right',
              fontSize: 10,
              color: '#a08080',
              fontFamily: 'monospace',
              flexShrink: 0,
            }}>
              z{layer.depth}
            </div>

            {/* Color swatch */}
            <div style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: layer.fill === 'transparent' ? '#888' : layer.fill,
              border: '1px solid rgba(255,255,255,0.1)',
              flexShrink: 0,
            }} />

            {/* Type badge */}
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: typeColor(layer.type),
              background: typeColor(layer.type) + '22',
              borderRadius: 4,
              padding: '1px 5px',
              flexShrink: 0,
            }}>
              {layer.type}
            </div>

            {/* Name */}
            <div style={{
              flex: 1,
              fontSize: 12,
              color: isSelected ? '#e8d5d5' : '#c0a0a0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {layer.label}
            </div>

            {/* Size */}
            <div style={{ fontSize: 10, color: '#a08080', fontFamily: 'monospace', flexShrink: 0 }}>
              {Math.round(layer.width)}×{Math.round(layer.height)}
            </div>

            {/* Move buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
              <button
                disabled={i === 0}
                onClick={ev => { ev.stopPropagation(); onMove(layer.shapeId, 'up'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: i === 0 ? '#3a1a1a' : '#a08080',
                  cursor: i === 0 ? 'default' : 'pointer',
                  fontSize: 10,
                  lineHeight: 1,
                  padding: '1px 2px',
                }}
              >
                ▲
              </button>
              <button
                disabled={i === sorted.length - 1}
                onClick={ev => { ev.stopPropagation(); onMove(layer.shapeId, 'down'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: i === sorted.length - 1 ? '#3a1a1a' : '#a08080',
                  cursor: i === sorted.length - 1 ? 'default' : 'pointer',
                  fontSize: 10,
                  lineHeight: 1,
                  padding: '1px 2px',
                }}
              >
                ▼
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  selectedShapeId: string | null;
  onSelectShape: (id: string) => void;
  onMoveLayer: (id: string, dir: 'up' | 'down') => void;
}

export function ZIndexVisualizerPanel({
  open, onClose, shapes, selectedShapeId, onSelectShape, onMoveLayer,
}: Props) {
  const [zSpread, setZSpread] = useState(18);
  const [tilt, setTilt] = useState(30);

  const layers = useMemo(() => buildIsoLayers(shapes), [shapes]);

  if (!open) return null;

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📐</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Z-Index Visualizer</span>
          <span style={{
            background: '#3a1a1a',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            color: '#a08080',
          }}>
            {layers.length} layer{layers.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button style={CLOSE_BTN} onClick={onClose}>✕</button>
      </div>

      {/* Controls */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #3a1a1a',
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#a08080' }}>Spread</span>
          <input
            type="range"
            min={6}
            max={40}
            value={zSpread}
            onChange={e => setZSpread(Number(e.target.value))}
            style={{ width: 70 }}
          />
          <span style={{ fontSize: 11, color: '#a08080', fontFamily: 'monospace', width: 22 }}>{zSpread}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#a08080' }}>Tilt</span>
          <input
            type="range"
            min={10}
            max={50}
            value={tilt}
            onChange={e => setTilt(Number(e.target.value))}
            style={{ width: 70 }}
          />
          <span style={{ fontSize: 11, color: '#a08080', fontFamily: 'monospace', width: 22 }}>{tilt}°</span>
        </div>
      </div>

      {/* 3D preview */}
      {layers.length > 0 ? (
        <div style={{
          background: '#0d0505',
          borderBottom: '1px solid #3a1a1a',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          <IsoView
            layers={layers}
            selectedId={selectedShapeId}
            onSelect={onSelectShape}
            zSpread={zSpread}
            tilt={tilt}
          />
        </div>
      ) : (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#a08080', fontSize: 13, flexShrink: 0 }}>
          No shapes on canvas.
        </div>
      )}

      {/* Layer list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        <div style={{ fontSize: 11, color: '#a08080', marginBottom: 6 }}>Layers (top → bottom)</div>
        <LayerList
          layers={layers}
          selectedId={selectedShapeId}
          onSelect={onSelectShape}
          onMove={onMoveLayer}
        />
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
        <span>⌘⌥⇧Z to toggle</span>
        <span>Click layer to select · ▲▼ to reorder</span>
      </div>
    </div>
  );
}
