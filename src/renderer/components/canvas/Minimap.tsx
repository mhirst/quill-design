/**
 * Minimap — bird's-eye overview of all canvas shapes.
 *
 * Shows in the bottom-right corner of the canvas. The viewport indicator
 * (white rectangle) shows the currently visible area. Clicking/dragging
 * on the minimap pans the canvas view.
 *
 * Features:
 * - All shapes rendered as colored rectangles (color = shape fill or stroke)
 * - Viewport indicator follows zoom/pan
 * - Click to jump to canvas position
 * - Drag viewport rect to pan
 * - Toggle via 'M' key or minimap corner button
 * - Scales content to fit the minimap container
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';

interface Props {
  shapes: Shape[];
  zoom: number;
  pan: { x: number; y: number };
  viewportWidth: number;   // canvas container width in screen px
  viewportHeight: number;  // canvas container height in screen px
  onPanTo: (pan: { x: number; y: number }) => void; // update pan (screen coords)
}

const MINIMAP_W = 180;
const MINIMAP_H = 120;
const PADDING = 8; // canvas units padding around all shapes

function getShapeBounds(shapes: Shape[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (shapes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
  }
  return { minX, minY, maxX, maxY };
}

function shapeColor(shape: Shape): string {
  if (shape.fillType === 'linear-gradient' || shape.fillType === 'radial-gradient') {
    return shape.gradientStops?.[0]?.color ?? '#6366f1';
  }
  if (shape.fill && shape.fill !== 'transparent') return shape.fill;
  if (shape.stroke && shape.stroke !== 'transparent') return shape.stroke;
  if (shape.color) return shape.color;
  return '#475569';
}

export function Minimap({ shapes, zoom, pan, viewportWidth, viewportHeight, onPanTo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const scaleRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, worldMinX: 0, worldMinY: 0 });

  // Render the minimap to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_W * dpr;
    canvas.height = MINIMAP_H * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

    // Background
    ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

    if (shapes.length === 0) {
      // Empty state
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No shapes', MINIMAP_W / 2, MINIMAP_H / 2);
      return;
    }

    const bounds = getShapeBounds(shapes);
    if (!bounds) return;

    const { minX, minY, maxX, maxY } = bounds;
    const worldW = maxX - minX + PADDING * 2;
    const worldH = maxY - minY + PADDING * 2;

    // Fit world into minimap
    const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH) * 0.92;
    const offsetX = (MINIMAP_W - worldW * scale) / 2;
    const offsetY = (MINIMAP_H - worldH * scale) / 2;

    // Store transform for click/drag mapping
    scaleRef.current = {
      scale,
      offsetX,
      offsetY,
      worldMinX: minX - PADDING,
      worldMinY: minY - PADDING,
    };

    // Draw shapes
    for (const shape of shapes) {
      if (shape.hidden) continue;
      const sx = (shape.x - (minX - PADDING)) * scale + offsetX;
      const sy = (shape.y - (minY - PADDING)) * scale + offsetY;
      const sw = Math.max(1, shape.width * scale);
      const sh = Math.max(1, shape.height * scale);

      const color = shapeColor(shape);
      ctx.globalAlpha = shape.opacity ?? 1;

      if (shape.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        const radius = shape.type !== 'path' ? Math.min(
          typeof shape.borderRadius === 'number' ? shape.borderRadius * scale : 0,
          sw / 2, sh / 2
        ) : 0;

        if (radius > 0) {
          ctx.beginPath();
          ctx.moveTo(sx + radius, sy);
          ctx.arcTo(sx + sw, sy, sx + sw, sy + sh, radius);
          ctx.arcTo(sx + sw, sy + sh, sx, sy + sh, radius);
          ctx.arcTo(sx, sy + sh, sx, sy, radius);
          ctx.arcTo(sx, sy, sx + sw, sy, radius);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(sx, sy, sw, sh);
        }
      }

      // Frame border
      if (shape.type === 'frame' || shape.stroke !== 'transparent') {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = shape.stroke !== 'transparent' ? shape.stroke : 'rgba(99,102,241,0.5)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, sw, sh);
      }
    }

    ctx.globalAlpha = 1;

    // Draw viewport indicator
    // Viewport covers: canvas coords from (-pan.x/zoom, -pan.y/zoom) to ((-pan.x + vw) / zoom, (-pan.y + vh) / zoom)
    const vpLeft = (-pan.x / zoom - (minX - PADDING)) * scale + offsetX;
    const vpTop = (-pan.y / zoom - (minY - PADDING)) * scale + offsetY;
    const vpRight = ((-pan.x + viewportWidth) / zoom - (minX - PADDING)) * scale + offsetX;
    const vpBottom = ((-pan.y + viewportHeight) / zoom - (minY - PADDING)) * scale + offsetY;
    const vpW = vpRight - vpLeft;
    const vpH = vpBottom - vpTop;

    // Semi-transparent fill
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(vpLeft, vpTop, vpW, vpH);

    // Viewport border
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vpLeft, vpTop, vpW, vpH);

    // Corner handles
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const cs = 2.5; // corner handle size
    [[vpLeft, vpTop], [vpLeft + vpW, vpTop], [vpLeft, vpTop + vpH], [vpLeft + vpW, vpTop + vpH]].forEach(([cx, cy]) => {
      ctx.fillRect(cx - cs, cy - cs, cs * 2, cs * 2);
    });

  }, [shapes, zoom, pan, viewportWidth, viewportHeight]);

  // Convert minimap click position → world canvas position → pan offset
  const minimapToWorld = useCallback((mx: number, my: number): { x: number; y: number } => {
    const { scale, offsetX, offsetY, worldMinX, worldMinY } = scaleRef.current;
    const worldX = (mx - offsetX) / scale + worldMinX;
    const worldY = (my - offsetY) / scale + worldMinY;
    return { x: worldX, y: worldY };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const world = minimapToWorld(mx, my);
    // Center the viewport on the clicked world position
    onPanTo({
      x: -(world.x * zoom) + viewportWidth / 2,
      y: -(world.y * zoom) + viewportHeight / 2,
    });
  }, [minimapToWorld, zoom, viewportWidth, viewportHeight, onPanTo]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    handleClick(e);

    const onMove = (ev: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const world = minimapToWorld(mx, my);
      onPanTo({
        x: -(world.x * zoom) + viewportWidth / 2,
        y: -(world.y * zoom) + viewportHeight / 2,
      });
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [handleClick, minimapToWorld, zoom, viewportWidth, viewportHeight, onPanTo]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 48, // above cursor coords display
        right: 12,
        width: MINIMAP_W,
        height: MINIMAP_H,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        cursor: isDragging ? 'grabbing' : 'crosshair',
        opacity: isHovered ? 1 : 0.78,
        transition: 'opacity 0.2s',
        zIndex: 20,
        userSelect: 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        style={{ display: 'block', width: MINIMAP_W, height: MINIMAP_H }}
        onMouseDown={handleMouseDown}
      />
      {/* Label */}
      <div style={{
        position: 'absolute',
        bottom: 4,
        left: 6,
        fontSize: 8,
        color: 'rgba(255,255,255,0.3)',
        fontFamily: 'monospace',
        letterSpacing: '0.06em',
        pointerEvents: 'none',
        fontWeight: 600,
        textTransform: 'uppercase',
      }}>
        Map
      </div>
    </div>
  );
}
