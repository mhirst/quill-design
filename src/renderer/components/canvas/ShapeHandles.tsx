import React, { useCallback, useEffect, useRef } from 'react';
import type { Shape } from '../../lib/shapes';
import { pathBbox, normalizeRadius } from '../../lib/shapes';
import type { HandleDir } from '../../hooks/useDrawingTools';

interface Props {
  shape: Shape;
  zoom: number;
  onResizeStart: (handle: HandleDir, e: React.MouseEvent) => void;
  onGradientAngleChange?: (angle: number) => void;   // live preview
  onGradientAngleCommit?: (angle: number) => void;   // commit to history
}

const HANDLE_SIZE = 8; // visual size — screen pixels, stays constant regardless of zoom
const HIT_EXTRA = 6; // extra px around each handle for easier clicking
const BORDER_COLOR = '#6366f1';

const HANDLES: { dir: HandleDir; cx: number; cy: number; cursor: string }[] = [
  { dir: 'nw', cx: 0,   cy: 0,   cursor: 'nw-resize' },
  { dir: 'n',  cx: 0.5, cy: 0,   cursor: 'n-resize'  },
  { dir: 'ne', cx: 1,   cy: 0,   cursor: 'ne-resize' },
  { dir: 'e',  cx: 1,   cy: 0.5, cursor: 'e-resize'  },
  { dir: 'se', cx: 1,   cy: 1,   cursor: 'se-resize' },
  { dir: 's',  cx: 0.5, cy: 1,   cursor: 's-resize'  },
  { dir: 'sw', cx: 0,   cy: 1,   cursor: 'sw-resize' },
  { dir: 'w',  cx: 0,   cy: 0.5, cursor: 'w-resize'  },
];

export function ShapeHandles({ shape, zoom, onResizeStart, onGradientAngleChange, onGradientAngleCommit }: Props) {
  // For paths, compute exact bbox from bezier extremes (ignores stale s.x/y/width/height)
  const { x, y, width, height } = shape.type === 'path' && shape.points?.length
    ? pathBbox(shape.points, shape.pathClosed ?? false)
    : shape;
  // Handles are in canvas space but need to appear as fixed screen-size.
  // Since the parent transform layer applies scale(zoom), we divide by zoom
  // to counteract it, keeping handles a constant screen size.
  const half = HANDLE_SIZE / zoom / 2;
  const handleSize = HANDLE_SIZE / zoom;
  const borderWidth = 1.5 / zoom;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        pointerEvents: 'none',
        transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
    >
      {/* Selection border */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `${borderWidth}px solid ${BORDER_COLOR}`,
          borderRadius: (() => { const [tl] = normalizeRadius(shape.borderRadius); return tl > 0 ? Math.min(tl, Math.min(width, height) / 2) : 0; })(),
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      />


      {/* Gradient angle dial — shown when shape has a linear gradient fill */}
      {shape.fillType === 'linear-gradient' && onGradientAngleChange && (
        <GradientAngleDial
          shape={shape}
          width={width}
          height={height}
          zoom={zoom}
          onChange={onGradientAngleChange}
          onCommit={onGradientAngleCommit ?? (() => {})}
        />
      )}

      {/* Resize handles */}
      {HANDLES.map(({ dir, cx, cy, cursor }) => {
        const hitExtra = HIT_EXTRA / zoom;
        return (
          <div
            key={dir}
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(dir, e); }}
            title={`Resize ${dir}`}
            style={{
              position: 'absolute',
              left: cx * width - half - hitExtra,
              top: cy * height - half - hitExtra,
              width: handleSize + hitExtra * 2,
              height: handleSize + hitExtra * 2,
              cursor,
              pointerEvents: 'all',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{
              width: handleSize,
              height: handleSize,
              background: 'white',
              border: `${borderWidth}px solid ${BORDER_COLOR}`,
              borderRadius: 2 / zoom,
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }} />
          </div>
        );
      })}
    </div>
  );
}

// ── GradientAngleDial ──────────────────────────────────────────────────────────
// A circular dial rendered at the shape center. The user drags to rotate the gradient angle.
// The dial circle has a "noon" dot that sweeps around as angle changes.

interface DialProps {
  shape: Shape;
  width: number;
  height: number;
  zoom: number;
  onChange: (angle: number) => void;
  onCommit: (angle: number) => void;
}

function GradientAngleDial({ shape, width, height, zoom, onChange, onCommit }: DialProps) {
  // Dial visual size in screen pixels — stays fixed regardless of zoom
  const DIAL_SCREEN_SIZE = 36; // px
  const dialSize = DIAL_SCREEN_SIZE / zoom;
  const dialRadius = dialSize / 2;

  const dragging = useRef(false);
  const startAngle = useRef(shape.gradientAngle ?? 135);
  const lastAngle = useRef(shape.gradientAngle ?? 135);

  // The "noon" indicator line: angle 0 = pointing up (north)
  // CSS gradients: 0deg = top-to-bottom, but visually we want 0=up
  // gradientAngle 0 = vertical, 90 = left-to-right, 135 = diagonal
  const angleRad = ((shape.gradientAngle ?? 135) - 90) * (Math.PI / 180);
  const dotRadius = dialRadius * 0.62;
  const dotX = dialRadius + Math.cos(angleRad) * dotRadius;
  const dotY = dialRadius + Math.sin(angleRad) * dotRadius;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    startAngle.current = shape.gradientAngle ?? 135;
    lastAngle.current = startAngle.current;

    const getAngleFromEvent = (ev: MouseEvent): number => {
      // Get the center of the dial in screen coords
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = ev.clientX - centerX;
      const dy = ev.clientY - centerY;
      // atan2 gives angle from east, we want from north (top) = +90°
      const radians = Math.atan2(dy, dx);
      const deg = (radians * 180 / Math.PI + 90 + 360) % 360;
      return Math.round(deg);
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const angle = getAngleFromEvent(ev);
      lastAngle.current = angle;
      onChange(angle);
    };
    const onUp = (ev: MouseEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      const angle = getAngleFromEvent(ev);
      onCommit(angle);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [shape.gradientAngle, onChange, onCommit]);

  return (
    <div
      onMouseDown={onMouseDown}
      title={`Gradient angle: ${Math.round(shape.gradientAngle ?? 135)}°\nDrag to rotate`}
      style={{
        position: 'absolute',
        // Center the dial on the shape
        left: width / 2 - dialRadius,
        top: height / 2 - dialRadius,
        width: dialSize,
        height: dialSize,
        cursor: 'crosshair',
        pointerEvents: 'all',
        zIndex: 15,
        userSelect: 'none',
      }}
    >
      <svg
        width={dialSize}
        height={dialSize}
        viewBox={`0 0 ${DIAL_SCREEN_SIZE} ${DIAL_SCREEN_SIZE}`}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {/* Outer ring */}
        <circle
          cx={DIAL_SCREEN_SIZE / 2}
          cy={DIAL_SCREEN_SIZE / 2}
          r={DIAL_SCREEN_SIZE / 2 - 1}
          fill="rgba(0,0,0,0.55)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1"
        />
        {/* Gradient direction line */}
        <line
          x1={DIAL_SCREEN_SIZE / 2}
          y1={DIAL_SCREEN_SIZE / 2}
          x2={DIAL_SCREEN_SIZE / 2 + Math.cos(angleRad) * dotRadius * (DIAL_SCREEN_SIZE / dialSize)}
          y2={DIAL_SCREEN_SIZE / 2 + Math.sin(angleRad) * dotRadius * (DIAL_SCREEN_SIZE / dialSize)}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        {/* Moving dot */}
        <circle
          cx={DIAL_SCREEN_SIZE / 2 + Math.cos(angleRad) * dotRadius * (DIAL_SCREEN_SIZE / dialSize)}
          cy={DIAL_SCREEN_SIZE / 2 + Math.sin(angleRad) * dotRadius * (DIAL_SCREEN_SIZE / dialSize)}
          r="3.5"
          fill="white"
        />
        {/* Center dot */}
        <circle
          cx={DIAL_SCREEN_SIZE / 2}
          cy={DIAL_SCREEN_SIZE / 2}
          r="2"
          fill="rgba(255,255,255,0.6)"
        />
        {/* Angle label */}
        <text
          x={DIAL_SCREEN_SIZE / 2}
          y={DIAL_SCREEN_SIZE / 2 + 14}
          textAnchor="middle"
          fill="rgba(255,255,255,0.75)"
          fontSize="7"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {Math.round(shape.gradientAngle ?? 135)}°
        </text>
      </svg>
    </div>
  );
}
