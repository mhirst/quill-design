import type { Shape } from '../../lib/shapes';
import { pathBbox } from '../../lib/shapes';
import type { HandleDir } from '../../hooks/useDrawingTools';

interface Props {
  shape: Shape;
  zoom: number;
  onResizeStart: (handle: HandleDir, e: React.MouseEvent) => void;
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

export function ShapeHandles({ shape, zoom, onResizeStart }: Props) {
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

  // Rotation handle: sits above center-top, 28px above in screen space
  const rotOffset = 28 / zoom;

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
          borderRadius: shape.borderRadius > 0 ? Math.min(shape.borderRadius, Math.min(width, height) / 2) : 0,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Rotation handle — line + circle above center-top */}
      <>
        {/* Stem line */}
        <div
          style={{
            position: 'absolute',
            left: width / 2 - borderWidth / 2,
            top: -rotOffset,
            width: borderWidth,
            height: rotOffset,
            background: BORDER_COLOR,
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        />
        {/* Circle — larger transparent hit area wraps the visible dot */}
        <div
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart('rotate', e); }}
          style={{
            position: 'absolute',
            left: width / 2 - handleSize / 2 - HIT_EXTRA / zoom,
            top: -rotOffset - handleSize - HIT_EXTRA / zoom,
            width: handleSize + (HIT_EXTRA * 2) / zoom,
            height: handleSize + (HIT_EXTRA * 2) / zoom,
            cursor: 'grab',
            pointerEvents: 'all',
            zIndex: 20,
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
            borderRadius: '50%',
            pointerEvents: 'none',
          }} />
        </div>
      </>

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
