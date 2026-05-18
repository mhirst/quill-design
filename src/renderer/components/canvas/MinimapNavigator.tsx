/**
 * MinimapNavigator — Compact canvas overview with draggable viewport indicator.
 *
 * Shows a miniature view of all shapes on canvas, with a semi-transparent
 * viewport rectangle that can be dragged to pan the canvas. Click anywhere
 * on the minimap to jump there. Toggle with ⌘M or the button in the status bar.
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import type { Shape } from '../../lib/shapes';

interface Props {
  shapes: Shape[];
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  visible: boolean;
  onToggle: () => void;
  onPanTo: (panX: number, panY: number) => void;
}

const MINIMAP_W = 180;
const MINIMAP_H = 120;
const PAD = 16;

function getBounds(shapes: Shape[]) {
  if (shapes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600, w: 800, h: 600 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
  }
  // Add padding
  const padX = (maxX - minX) * 0.1 || 40;
  const padY = (maxY - minY) * 0.1 || 40;
  return {
    minX: minX - padX,
    minY: minY - padY,
    maxX: maxX + padX,
    maxY: maxY + padY,
    w: (maxX - minX) + padX * 2,
    h: (maxY - minY) + padY * 2,
  };
}

// Get a simple color for a shape's minimap representation
function shapeColor(s: Shape): string {
  if (s.fillType === 'linear-gradient' || s.fillType === 'radial-gradient') {
    return s.gradientStops?.[0]?.color ?? '#6366f1';
  }
  if (s.fillType === 'image') return '#4a5568';
  if (s.type === 'text') return 'rgba(226,232,240,0.4)';
  if (!s.fill || s.fill === 'transparent') return 'rgba(99,102,241,0.3)';
  return s.fill;
}

export function MinimapNavigator({
  shapes, zoom, panX, panY, canvasWidth, canvasHeight, visible, onToggle, onPanTo,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const bounds = getBounds(shapes);
  const scaleX = MINIMAP_W / bounds.w;
  const scaleY = MINIMAP_H / bounds.h;
  const scale = Math.min(scaleX, scaleY);

  // Actual minimap render dimensions (centered if aspect doesn't match)
  const renderW = bounds.w * scale;
  const renderH = bounds.h * scale;
  const offsetX = (MINIMAP_W - renderW) / 2;
  const offsetY = (MINIMAP_H - renderH) / 2;

  function canvasToMinimap(cx: number, cy: number) {
    return {
      x: (cx - bounds.minX) * scale + offsetX,
      y: (cy - bounds.minY) * scale + offsetY,
    };
  }

  // Viewport rectangle in canvas coordinates
  const vpLeft = -panX / zoom;
  const vpTop = -panY / zoom;
  const vpRight = vpLeft + canvasWidth / zoom;
  const vpBottom = vpTop + canvasHeight / zoom;

  const vp1 = canvasToMinimap(vpLeft, vpTop);
  const vp2 = canvasToMinimap(vpRight, vpBottom);

  const vpRect = {
    x: Math.max(0, vp1.x),
    y: Math.max(0, vp1.y),
    w: Math.min(MINIMAP_W, vp2.x) - Math.max(0, vp1.x),
    h: Math.min(MINIMAP_H, vp2.y) - Math.max(0, vp1.y),
  };

  const minimapToCanvas = useCallback((mx: number, my: number) => {
    const cx = (mx - offsetX) / scale + bounds.minX;
    const cy = (my - offsetY) / scale + bounds.minY;
    return { cx, cy };
  }, [offsetX, offsetY, scale, bounds]);

  const panToMinimap = useCallback((mx: number, my: number) => {
    const { cx, cy } = minimapToCanvas(mx, my);
    // Center viewport on this canvas point
    const newPanX = canvasWidth / 2 - cx * zoom;
    const newPanY = canvasHeight / 2 - cy * zoom;
    onPanTo(newPanX, newPanY);
  }, [minimapToCanvas, canvasWidth, canvasHeight, zoom, onPanTo]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    draggingRef.current = true;
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    panToMinimap(e.clientX - rect.left, e.clientY - rect.top);
  }, [panToMinimap]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      panToMinimap(e.clientX - rect.left, e.clientY - rect.top);
    };
    const onUp = () => { draggingRef.current = false; setIsDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, panToMinimap]);

  if (!visible) {
    return (
      <button
        onClick={onToggle}
        title="Toggle minimap (⌘M)"
        style={{
          position: 'absolute',
          bottom: 80,
          right: 8,
          width: 26,
          height: 26,
          background: 'var(--panel, #1e1e2e)',
          border: '1px solid var(--border, #2d2d3d)',
          borderRadius: 5,
          color: 'var(--muted, #888)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          zIndex: 19,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent, #6366f1)';
          e.currentTarget.style.color = 'var(--accent, #6366f1)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)';
          e.currentTarget.style.color = 'var(--muted, #888)';
        }}
      >
        ⊕
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 32,
        right: 8,
        width: MINIMAP_W + PAD * 2,
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        zIndex: 19,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '5px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
      }}>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)', flex: 1 }}>
          {Math.round(zoom * 100)}% · {shapes.length} shape{shapes.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
        >×</button>
      </div>

      {/* SVG minimap */}
      <div style={{ padding: `${PAD / 2}px ${PAD}px ${PAD / 2}px` }}>
        <svg
          ref={svgRef}
          width={MINIMAP_W}
          height={MINIMAP_H}
          style={{
            display: 'block',
            cursor: isDragging ? 'grabbing' : 'crosshair',
            borderRadius: 4,
            background: 'var(--bg, #161622)',
            border: '1px solid var(--border, #2d2d3d)',
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Shapes */}
          {shapes.map(s => {
            const p = canvasToMinimap(s.x, s.y);
            const w = s.width * scale;
            const h = s.height * scale;
            const color = shapeColor(s);
            const opacity = s.opacity ?? 1;

            if (w < 0.5 || h < 0.5) return null;

            if (s.type === 'ellipse') {
              return (
                <ellipse
                  key={s.id}
                  cx={p.x + w / 2} cy={p.y + h / 2}
                  rx={w / 2} ry={h / 2}
                  fill={color}
                  fillOpacity={Math.min(opacity, 0.85)}
                  stroke={s.stroke && s.stroke !== 'transparent' ? s.stroke : 'none'}
                  strokeWidth={Math.max(0.5, (s.strokeWidth ?? 0) * scale * 0.5)}
                />
              );
            }

            if (s.type === 'text') {
              return (
                <rect
                  key={s.id}
                  x={p.x} y={p.y} width={Math.max(1, w)} height={Math.max(1, h)}
                  fill="rgba(226,232,240,0.2)"
                  rx={1}
                />
              );
            }

            return (
              <rect
                key={s.id}
                x={p.x} y={p.y}
                width={Math.max(1, w)} height={Math.max(1, h)}
                fill={color}
                fillOpacity={Math.min(opacity, 0.85)}
                rx={Math.min((s.borderRadius as number || 0) * scale * 0.5, w / 2, h / 2)}
                stroke={s.stroke && s.stroke !== 'transparent' ? s.stroke : 'none'}
                strokeWidth={Math.max(0.5, (s.strokeWidth ?? 0) * scale * 0.5)}
              />
            );
          })}

          {/* Viewport rect */}
          {vpRect.w > 0 && vpRect.h > 0 && (
            <>
              <rect
                x={vpRect.x} y={vpRect.y}
                width={vpRect.w} height={vpRect.h}
                fill="rgba(99,102,241,0.1)"
                stroke="rgba(99,102,241,0.8)"
                strokeWidth={1.5}
                rx={2}
                style={{ pointerEvents: 'none' }}
              />
              {/* Crosshair center dot */}
              <circle
                cx={vpRect.x + vpRect.w / 2}
                cy={vpRect.y + vpRect.h / 2}
                r={2}
                fill="rgba(99,102,241,0.6)"
                style={{ pointerEvents: 'none' }}
              />
            </>
          )}
        </svg>
      </div>

      {/* Coordinates */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '2px 10px 6px',
      }}>
        <span style={{ fontSize: 9, color: 'var(--subtle, #444)', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(-panX / zoom)}, {Math.round(-panY / zoom)}
        </span>
        <span style={{ fontSize: 9, color: 'var(--subtle, #444)', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(canvasWidth / zoom)} × {Math.round(canvasHeight / zoom)}
        </span>
      </div>
    </div>
  );
}
