/**
 * CanvasRulers — pixel-accurate rulers + draggable guides
 *
 * Renders:
 *  - A 20px horizontal ruler along the top
 *  - A 20px vertical ruler along the left
 *  - A corner square at (0,0) to clear/toggle guides
 *  - Draggable cyan guide lines (H from top ruler, V from left ruler)
 *  - Guide labels showing canvas-space position
 *
 * Coordinate system:
 *   canvasX = (screenX - panX) / zoom
 *   canvasY = (screenY - panY) / zoom
 *
 * Usage: wrap around CanvasOverlay so it receives pointer events above the canvas.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Guide {
  id: string;
  axis: 'h' | 'v'; // h = horizontal line (fixed Y), v = vertical line (fixed X)
  position: number; // canvas-space px
}

interface RulerProps {
  zoom: number;
  panX: number;
  panY: number;
  width: number;   // container width
  height: number;  // container height
  guides: Guide[];
  onAddGuide: (guide: Guide) => void;
  onMoveGuide: (id: string, position: number) => void;
  onDeleteGuide: (id: string) => void;
  onClearGuides: () => void;
  visible: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const RULER_SIZE = 20; // px
const GUIDE_COLOR = 'rgba(0,210,210,0.85)';
const GUIDE_DRAG_COLOR = 'rgba(0,240,240,1)';
const TICK_COLOR = 'rgba(180,180,190,0.55)';
const LABEL_COLOR = 'rgba(180,180,190,0.8)';
const RULER_BG = 'rgba(20,20,28,0.92)';

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Tick step calculator ───────────────────────────────────────────────────────

function calcTickStep(zoom: number): { major: number; minor: number } {
  // We want ~60-120px between major ticks in screen space
  const targetScreenPx = 80;
  const rawCanvasPx = targetScreenPx / zoom;

  // Round up to nearest "nice" number
  const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const major = niceSteps.find(s => s >= rawCanvasPx) ?? 5000;
  const minor = major / 5;
  return { major, minor };
}

// ── Single ruler canvas ────────────────────────────────────────────────────────

function drawRuler(
  ctx: CanvasRenderingContext2D,
  axis: 'h' | 'v',
  zoom: number,
  pan: number, // panX for h, panY for v
  length: number, // width for h, height for v
  size: number,
  hoverPos: number | null,
  mouseDownPos: number | null,
) {
  ctx.clearRect(0, 0, axis === 'h' ? length : size, axis === 'h' ? size : length);

  // Background
  ctx.fillStyle = RULER_BG;
  ctx.fillRect(0, 0, axis === 'h' ? length : size, axis === 'h' ? size : length);

  const { major, minor } = calcTickStep(zoom);

  // Canvas position of screen origin
  const originCanvas = -pan / zoom;
  // First tick at or before screen left/top
  const firstMajor = Math.floor(originCanvas / major) * major;

  ctx.strokeStyle = TICK_COLOR;
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = '9px system-ui, sans-serif';
  ctx.textBaseline = 'top';

  for (let c = firstMajor; c < originCanvas + length / zoom; c += minor) {
    const screen = (c - originCanvas) * zoom;
    const isMajor = Math.abs(Math.round(c / minor) % 5) < 0.001;

    const tickLen = isMajor ? size * 0.55 : size * 0.3;

    ctx.lineWidth = 0.75;
    ctx.beginPath();
    if (axis === 'h') {
      ctx.moveTo(screen, size);
      ctx.lineTo(screen, size - tickLen);
    } else {
      ctx.moveTo(size, screen);
      ctx.lineTo(size - tickLen, screen);
    }
    ctx.stroke();

    if (isMajor && zoom > 0.08) {
      const label = String(Math.round(c));
      ctx.save();
      if (axis === 'v') {
        ctx.translate(2, screen);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(label, -label.length * 4.5, 0);
      } else {
        ctx.fillText(label, screen + 2, 2);
      }
      ctx.restore();
    }
  }

  // Hover highlight
  if (hoverPos !== null) {
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (axis === 'h') {
      ctx.moveTo(hoverPos, 0);
      ctx.lineTo(hoverPos, size);
    } else {
      ctx.moveTo(0, hoverPos);
      ctx.lineTo(size, hoverPos);
    }
    ctx.stroke();
  }

  // Active drag highlight
  if (mouseDownPos !== null) {
    ctx.strokeStyle = GUIDE_DRAG_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (axis === 'h') {
      ctx.moveTo(mouseDownPos, 0);
      ctx.lineTo(mouseDownPos, size);
    } else {
      ctx.moveTo(0, mouseDownPos);
      ctx.lineTo(size, mouseDownPos);
    }
    ctx.stroke();
  }

  // Border line
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (axis === 'h') { ctx.moveTo(0, size - 0.5); ctx.lineTo(length, size - 0.5); }
  else { ctx.moveTo(size - 0.5, 0); ctx.lineTo(size - 0.5, length); }
  ctx.stroke();
}

// ── Main export ────────────────────────────────────────────────────────────────

export function CanvasRulers({
  zoom,
  panX,
  panY,
  width,
  height,
  guides,
  onAddGuide,
  onMoveGuide,
  onDeleteGuide,
  onClearGuides,
  visible,
}: RulerProps) {
  const hRulerRef = useRef<HTMLCanvasElement>(null);
  const vRulerRef = useRef<HTMLCanvasElement>(null);

  // Hover positions in screen space
  const [hHover, setHHover] = useState<number | null>(null);
  const [vHover, setVHover] = useState<number | null>(null);

  // Drag state: dragging a guide from a ruler (new) or an existing guide
  const draggingRef = useRef<{
    guideId: string | null; // null = new guide being dragged out
    axis: 'h' | 'v';
    startCanvasPos: number;
    currentPos: number; // screen space Y (h) or X (v)
  } | null>(null);

  const [draggingScreenPos, setDraggingScreenPos] = useState<number | null>(null);
  const [draggingAxis, setDraggingAxis] = useState<'h' | 'v' | null>(null);

  // ── Render rulers ──────────────────────────────────────────────────────────

  useEffect(() => {
    const hCanvas = hRulerRef.current;
    const vCanvas = vRulerRef.current;
    if (!hCanvas || !vCanvas || !visible) return;

    const hCtx = hCanvas.getContext('2d');
    const vCtx = vCanvas.getContext('2d');
    if (!hCtx || !vCtx) return;

    const hoverH = hHover;
    const hoverV = vHover;
    const drgPos = draggingScreenPos;
    const drgAxis = draggingAxis;

    drawRuler(hCtx, 'h', zoom, panX, width, RULER_SIZE, hoverH, drgAxis === 'h' ? drgPos : null);
    drawRuler(vCtx, 'v', zoom, panY, height, RULER_SIZE, hoverV, drgAxis === 'v' ? drgPos : null);
  }, [zoom, panX, panY, width, height, hHover, vHover, draggingScreenPos, draggingAxis, visible]);

  // ── Convert screen ↔ canvas ────────────────────────────────────────────────

  const screenToCanvas = useCallback((screenPos: number, axis: 'h' | 'v') => {
    return axis === 'h'
      ? (screenPos - RULER_SIZE - panY) / zoom
      : (screenPos - RULER_SIZE - panX) / zoom;
  }, [panX, panY, zoom]);

  const canvasToScreen = useCallback((canvasPos: number, axis: 'h' | 'v') => {
    return axis === 'h'
      ? canvasPos * zoom + panY + RULER_SIZE
      : canvasPos * zoom + panX + RULER_SIZE;
  }, [panX, panY, zoom]);

  // ── Pointer handlers for H ruler ───────────────────────────────────────────

  const onHRulerMouseDown = useCallback((e: React.MouseEvent) => {
    const screenX = e.clientX;
    const canvasX = (screenX - RULER_SIZE - panX) / zoom;
    const newGuideId = uid();
    draggingRef.current = {
      guideId: newGuideId, // will be added when dropped
      axis: 'v',
      startCanvasPos: canvasX,
      currentPos: screenX,
    };
    setDraggingAxis('v');
    setDraggingScreenPos(screenX);
  }, [panX, zoom]);

  const onVRulerMouseDown = useCallback((e: React.MouseEvent) => {
    const screenY = e.clientY;
    const canvasY = (screenY - RULER_SIZE - panY) / zoom;
    const newGuideId = uid();
    draggingRef.current = {
      guideId: newGuideId,
      axis: 'h',
      startCanvasPos: canvasY,
      currentPos: screenY,
    };
    setDraggingAxis('h');
    setDraggingScreenPos(screenY);
  }, [panY, zoom]);

  // ── Global mouse move/up for guide dragging ────────────────────────────────

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = draggingRef.current;
      if (!drag) return;

      const { axis } = drag;
      const pos = axis === 'v' ? e.clientX : e.clientY;
      drag.currentPos = pos;
      setDraggingScreenPos(pos);
    };

    const onMouseUp = (e: MouseEvent) => {
      const drag = draggingRef.current;
      if (!drag) {
        draggingRef.current = null;
        return;
      }

      const { axis, guideId, currentPos } = drag;

      // Convert final screen pos to canvas pos
      const canvasPos = axis === 'v'
        ? (currentPos - RULER_SIZE - panX) / zoom
        : (currentPos - RULER_SIZE - panY) / zoom;

      // If dragged out of ruler zone: add / move guide
      const inRulerZone = axis === 'v'
        ? e.clientX < RULER_SIZE + RULER_SIZE
        : e.clientY < RULER_SIZE + RULER_SIZE;

      if (!inRulerZone && guideId !== null) {
        // Check if this is an existing guide being moved
        const existing = guides.find(g => g.id === guideId);
        if (existing) {
          onMoveGuide(guideId, Math.round(canvasPos));
        } else {
          // New guide
          onAddGuide({ id: guideId, axis, position: Math.round(canvasPos) });
        }
      }

      draggingRef.current = null;
      setDraggingScreenPos(null);
      setDraggingAxis(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [panX, panY, zoom, guides, onAddGuide, onMoveGuide]);

  // ── Guide drag from canvas ─────────────────────────────────────────────────

  const startGuideDrag = useCallback((guideId: string, axis: 'h' | 'v', startScreenPos: number) => {
    draggingRef.current = {
      guideId,
      axis,
      startCanvasPos: screenToCanvas(startScreenPos, axis),
      currentPos: startScreenPos,
    };
    setDraggingAxis(axis);
    setDraggingScreenPos(startScreenPos);
  }, [screenToCanvas]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {/* ── Horizontal ruler (top) ── */}
      <canvas
        ref={hRulerRef}
        width={width}
        height={RULER_SIZE}
        style={{
          position: 'absolute',
          left: RULER_SIZE,
          top: 0,
          width: width - RULER_SIZE,
          height: RULER_SIZE,
          cursor: 'col-resize',
          pointerEvents: 'all',
          display: 'block',
        }}
        onMouseMove={e => setHHover(e.clientX - RULER_SIZE)}
        onMouseLeave={() => setHHover(null)}
        onMouseDown={onHRulerMouseDown}
      />

      {/* ── Vertical ruler (left) ── */}
      <canvas
        ref={vRulerRef}
        width={RULER_SIZE}
        height={height}
        style={{
          position: 'absolute',
          left: 0,
          top: RULER_SIZE,
          width: RULER_SIZE,
          height: height - RULER_SIZE,
          cursor: 'row-resize',
          pointerEvents: 'all',
          display: 'block',
        }}
        onMouseMove={e => setVHover(e.clientY - RULER_SIZE)}
        onMouseLeave={() => setVHover(null)}
        onMouseDown={onVRulerMouseDown}
      />

      {/* ── Corner box ── */}
      <div
        style={{
          position: 'absolute',
          left: 0, top: 0,
          width: RULER_SIZE, height: RULER_SIZE,
          background: RULER_BG,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'all',
          zIndex: 2,
        }}
        onClick={onClearGuides}
        title="Clear all guides"
      >
        <svg width="8" height="8" viewBox="0 0 8 8">
          <line x1="0" y1="4" x2="8" y2="4" stroke="rgba(180,180,190,0.5)" strokeWidth="0.8"/>
          <line x1="4" y1="0" x2="4" y2="8" stroke="rgba(180,180,190,0.5)" strokeWidth="0.8"/>
        </svg>
      </div>

      {/* ── Guide lines ── */}
      {guides.map(guide => {
        const isDragging = draggingRef.current?.guideId === guide.id;
        const screenPos = isDragging && draggingScreenPos !== null
          ? draggingScreenPos
          : canvasToScreen(guide.position, guide.axis);

        const isOutOfBounds = guide.axis === 'h'
          ? (screenPos < RULER_SIZE || screenPos > height)
          : (screenPos < RULER_SIZE || screenPos > width);
        if (isOutOfBounds && !isDragging) return null;

        const labelText = `${Math.round(guide.position)}px`;

        return (
          <React.Fragment key={guide.id}>
            {/* Line */}
            <div
              style={{
                position: 'absolute',
                background: isDragging ? GUIDE_DRAG_COLOR : GUIDE_COLOR,
                pointerEvents: 'all',
                cursor: guide.axis === 'h' ? 'row-resize' : 'col-resize',
                zIndex: 3,
                ...(guide.axis === 'h' ? {
                  left: RULER_SIZE,
                  top: screenPos - 0.5,
                  width: width - RULER_SIZE,
                  height: 1,
                } : {
                  left: screenPos - 0.5,
                  top: RULER_SIZE,
                  width: 1,
                  height: height - RULER_SIZE,
                }),
              }}
              onMouseDown={e => {
                e.stopPropagation();
                startGuideDrag(guide.id, guide.axis, guide.axis === 'h' ? e.clientY : e.clientX);
              }}
              onDoubleClick={() => onDeleteGuide(guide.id)}
              title={`${guide.axis === 'h' ? 'Y' : 'X'}: ${guide.position}px — drag to move, dbl-click to delete`}
            />

            {/* Position label */}
            <div
              style={{
                position: 'absolute',
                pointerEvents: 'none',
                fontSize: 9,
                color: isDragging ? '#fff' : GUIDE_COLOR,
                background: 'rgba(0,0,0,0.5)',
                borderRadius: 2,
                padding: '1px 3px',
                lineHeight: 1.4,
                zIndex: 4,
                ...(guide.axis === 'h' ? {
                  left: RULER_SIZE + 4,
                  top: screenPos + 2,
                } : {
                  left: screenPos + 2,
                  top: RULER_SIZE + 4,
                }),
              }}
            >
              {labelText}
            </div>
          </React.Fragment>
        );
      })}

      {/* ── New guide being dragged ── */}
      {draggingScreenPos !== null && draggingAxis !== null && (() => {
        const isNew = draggingRef.current && !guides.find(g => g.id === draggingRef.current?.guideId);
        if (!isNew) return null;

        const canvasPos = draggingAxis === 'h'
          ? Math.round((draggingScreenPos - RULER_SIZE - panY) / zoom)
          : Math.round((draggingScreenPos - RULER_SIZE - panX) / zoom);

        return (
          <>
            <div
              style={{
                position: 'absolute',
                background: GUIDE_DRAG_COLOR,
                opacity: 0.8,
                pointerEvents: 'none',
                zIndex: 3,
                ...(draggingAxis === 'h' ? {
                  left: RULER_SIZE,
                  top: draggingScreenPos - 0.5,
                  width: width - RULER_SIZE,
                  height: 1,
                } : {
                  left: draggingScreenPos - 0.5,
                  top: RULER_SIZE,
                  width: 1,
                  height: height - RULER_SIZE,
                }),
              }}
            />
            <div
              style={{
                position: 'absolute',
                pointerEvents: 'none',
                fontSize: 9,
                color: '#fff',
                background: 'rgba(0,150,160,0.85)',
                borderRadius: 2,
                padding: '1px 3px',
                lineHeight: 1.4,
                zIndex: 4,
                ...(draggingAxis === 'h' ? {
                  left: RULER_SIZE + 4,
                  top: draggingScreenPos + 2,
                } : {
                  left: draggingScreenPos + 2,
                  top: RULER_SIZE + 4,
                }),
              }}
            >
              {canvasPos}px
            </div>
          </>
        );
      })()}
    </div>
  );
}
