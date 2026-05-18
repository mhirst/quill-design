/**
 * CanvasStatusBar — Persistent bottom status bar showing live canvas info.
 *
 * Displays: zoom level (clickable to reset), cursor position,
 * selected shape count + dimensions, shape type, layer name,
 * and quick toggle buttons for grid/rulers.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

interface Props {
  zoom: number;
  panX: number;
  panY: number;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  totalShapes: number;
  showRulers: boolean;
  onToggleRulers: () => void;
  gridCount: number;
  onToggleGrid: () => void;
  onZoomReset: () => void;
  onZoomFit: () => void;
  cursorX?: number;
  cursorY?: number;
}

// Canvas coordinate from screen coordinate
function screenToCanvas(screenX: number, screenY: number, panX: number, panY: number, zoom: number): [number, number] {
  return [
    Math.round((screenX - panX) / zoom),
    Math.round((screenY - panY) / zoom),
  ];
}

function formatDim(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

function ZoomChip({ zoom, onReset, onFit, onZoomTo }: { zoom: number; onReset: () => void; onFit: () => void; onZoomTo?: (z: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const pct = Math.round(zoom * 100);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: open ? 'rgba(99,102,241,0.15)' : 'transparent',
          border: 'none',
          borderRadius: 4,
          color: 'var(--text, #e2e8f0)',
          fontSize: 11,
          fontWeight: 700,
          padding: '0 6px',
          cursor: 'pointer',
          fontVariantNumeric: 'tabular-nums',
          height: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 44,
          justifyContent: 'center',
        }}
        title="Zoom level — click to change"
      >
        {pct}%
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 26,
            left: 0,
            background: 'var(--panel, #1e1e2e)',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 400,
            overflow: 'hidden',
            minWidth: 120,
          }}
        >
          {[
            { label: '50%', value: 0.5 },
            { label: '75%', value: 0.75 },
            { label: '100%', value: 1 },
            { label: '125%', value: 1.25 },
            { label: '150%', value: 1.5 },
            { label: '200%', value: 2 },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => {
                if (Math.abs(value - 1) < 0.01) { onReset(); }
                else if (onZoomTo) { onZoomTo(value); }
                else { onReset(); }
                setOpen(false);
              }}
              style={{
                width: '100%', display: 'block', padding: '6px 10px',
                background: Math.abs(zoom - value) < 0.01 ? 'rgba(99,102,241,0.15)' : 'none',
                border: 'none', textAlign: 'left', fontSize: 11,
                color: Math.abs(zoom - value) < 0.01 ? 'var(--accent, #6366f1)' : 'var(--text, #e2e8f0)',
                fontWeight: Math.abs(zoom - value) < 0.01 ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border, #2d2d3d)', padding: '2px 0' }}>
            <button onClick={() => { onFit(); setOpen(false); }} style={{ width: '100%', display: 'block', padding: '6px 10px', background: 'none', border: 'none', textAlign: 'left', fontSize: 11, color: 'var(--muted, #888)', cursor: 'pointer' }}>
              Fit to screen (1)
            </button>
            <button onClick={() => { onReset(); setOpen(false); }} style={{ width: '100%', display: 'block', padding: '6px 10px', background: 'none', border: 'none', textAlign: 'left', fontSize: 11, color: 'var(--muted, #888)', cursor: 'pointer' }}>
              Reset to 100% (0)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CanvasStatusBar({
  zoom,
  panX,
  panY,
  selectedShape,
  selectedShapeIds,
  totalShapes,
  showRulers,
  onToggleRulers,
  gridCount,
  onToggleGrid,
  onZoomReset,
  onZoomFit,
  cursorX = 0,
  cursorY = 0,
}: Props) {
  const [canvasCursor, setCanvasCursor] = useState<[number, number]>([0, 0]);
  const [fps, setFps] = useState(60);
  const fpsFrames = useRef<number[]>([]);

  // Track cursor position
  useEffect(() => {
    const [cx, cy] = screenToCanvas(cursorX, cursorY, panX, panY, zoom);
    setCanvasCursor([cx, cy]);
  }, [cursorX, cursorY, panX, panY, zoom]);

  // FPS counter
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    function frame(now: number) {
      const dt = now - lastTime;
      lastTime = now;
      fpsFrames.current.push(1000 / dt);
      if (fpsFrames.current.length > 30) fpsFrames.current.shift();
      const avg = fpsFrames.current.reduce((a, b) => a + b, 0) / fpsFrames.current.length;
      setFps(Math.round(avg));
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const selCount = selectedShapeIds.length || (selectedShape ? 1 : 0);
  const shape = selectedShape;

  const shapeInfo = shape ? (
    <>
      <Divider />
      <span style={{ color: 'var(--muted, #888)', fontSize: 10 }}>
        {shape.type}
      </span>
      {shape.name && shape.name !== shape.type && (
        <>
          <span style={{ color: 'var(--subtle, #444)' }}>·</span>
          <span style={{ color: 'var(--text, #e2e8f0)', fontSize: 10, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shape.name}
          </span>
        </>
      )}
      <Divider />
      <span style={{ fontSize: 10, color: 'var(--text, #e2e8f0)', fontVariantNumeric: 'tabular-nums' }}>
        {formatDim(shape.x)}, {formatDim(shape.y)}
      </span>
      <span style={{ color: 'var(--subtle, #444)' }}>·</span>
      <span style={{ fontSize: 10, color: 'var(--text, #e2e8f0)', fontVariantNumeric: 'tabular-nums' }}>
        {formatDim(shape.width)} × {formatDim(shape.height)}
      </span>
      {shape.rotation !== 0 && (
        <>
          <span style={{ color: 'var(--subtle, #444)' }}>·</span>
          <span style={{ fontSize: 10, color: 'var(--muted, #888)', fontVariantNumeric: 'tabular-nums' }}>
            {shape.rotation}°
          </span>
        </>
      )}
      {selCount > 1 && (
        <>
          <span style={{ color: 'var(--subtle, #444)' }}>·</span>
          <span style={{ fontSize: 10, color: 'var(--accent, #6366f1)', fontWeight: 600 }}>
            +{selCount - 1} more
          </span>
        </>
      )}
    </>
  ) : null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 24,
        background: 'var(--panel, #1e1e2e)',
        borderTop: '1px solid var(--border, #2d2d3d)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 4,
        zIndex: 20,
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Left section: shape info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Shape count */}
        <span style={{ fontSize: 10, color: 'var(--muted, #888)', flexShrink: 0 }}>
          {totalShapes} shape{totalShapes !== 1 ? 's' : ''}
        </span>
        {shapeInfo}
      </div>

      {/* Center: cursor position */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--subtle, #444)' }}>x</span>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)', fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>{canvasCursor[0]}</span>
        <span style={{ fontSize: 10, color: 'var(--subtle, #444)' }}>y</span>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)', fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>{canvasCursor[1]}</span>
      </div>

      <Divider />

      {/* Right section: toggles + zoom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {/* Rulers toggle */}
        <button
          onClick={onToggleRulers}
          style={{
            background: showRulers ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: 'none',
            borderRadius: 4,
            color: showRulers ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
            fontSize: 10,
            fontWeight: 600,
            padding: '0 5px',
            height: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
          title="Toggle rulers (⌘R)"
        >
          ⊢
        </button>

        {/* Grid toggle */}
        <button
          onClick={onToggleGrid}
          style={{
            background: gridCount > 0 ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: 'none',
            borderRadius: 4,
            color: gridCount > 0 ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
            fontSize: 10,
            fontWeight: 600,
            padding: '0 5px',
            height: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Layout grids (⌘⇧⌥L)"
        >
          ⊞{gridCount > 0 ? ` ${gridCount}` : ''}
        </button>

        <Divider />

        {/* Zoom */}
        <ZoomChip
          zoom={zoom}
          onReset={onZoomReset}
          onFit={onZoomFit}
          onZoomTo={(z) => window.dispatchEvent(new CustomEvent('canvas:setzoom', { detail: { zoom: z } }))}
        />

        <Divider />

        {/* FPS */}
        <span
          style={{
            fontSize: 10,
            color: fps >= 55 ? 'var(--subtle, #444)' : fps >= 30 ? '#f59e0b' : '#ef4444',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 32,
            textAlign: 'right',
          }}
          title={`${fps} frames per second`}
        >
          {fps}fps
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 12,
        background: 'var(--border, #2d2d3d)',
        flexShrink: 0,
        margin: '0 2px',
      }}
    />
  );
}
