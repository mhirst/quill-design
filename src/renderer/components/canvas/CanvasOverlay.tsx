import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Tool } from '../layout/ToolSidebar';
import type { Shape } from '../../lib/shapes';
import { buildShapeStyle, buildPathD, pathBbox } from '../../lib/shapes';
import type { HandleDir } from '../../hooks/useDrawingTools';
import { isDrawingTool } from '../../hooks/useDrawingTools';
import { ShapeHandles } from './ShapeHandles';

interface Props {
  activeTool: Tool;
  shapes: Shape[];
  drafting: { shape: Shape } | null;
  selectedId: string | null;
  selectedIds: string[];
  marquee: { x: number; y: number; width: number; height: number } | null;
  isDraggingMove: boolean;
  isDraggingResize: boolean;
  hasIframeContent: boolean; // when true, background is transparent so iframe shows through
  onDrawStart: (canvasX: number, canvasY: number) => void;
  onDrawUpdate: (canvasX: number, canvasY: number, originX: number, originY: number) => void;
  onDrawCommit: () => void;
  onSelect: (id: string | null) => void;
  onAddToSelection: (id: string) => void;
  onRemoveFromSelection: (id: string) => void;
  onSetMarquee: (x: number, y: number, w: number, h: number) => void;
  onCommitMarquee: () => void;
  onMoveStart: (id: string, mouseX: number, mouseY: number, snapshot: Shape) => void;
  onMove: (mouseX: number, mouseY: number) => void;
  onMoveEnd: () => void;
  onResizeStart: (id: string, handle: HandleDir, mouseX: number, mouseY: number, snapshot: Shape) => void;
  onResize: (mouseX: number, mouseY: number) => void;
  onResizeEnd: () => void;
  onDrawCancel?: () => void; // cancel an in-progress draw (e.g. Escape pressed)
  onShapeChange?: (id: string, patch: Partial<Shape>) => void; // commit shape change (adds to history)
  onShapePreview?: (id: string, patch: Partial<Shape>) => void; // live preview (no history)
  autoEditId?: string | null; // when set, immediately enter edit mode for this shape id
  // Context menu actions
  onDuplicate?: () => void;
  onDelete?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  // Pen tool
  penPoints?: import('../../lib/shapes').BezierPoint[];
  penCursor?: { x: number; y: number } | null;
  penDragPointIndex?: number | null;
  penPullingHandleRef?: React.MutableRefObject<boolean>;
  onPenClick?: (x: number, y: number) => void;
  onPenPullHandle?: (x: number, y: number) => void; // drag after placing to set handle
  onPenEndHandlePull?: () => void;
  onPenMove?: (x: number, y: number) => void;
  onPenCommit?: (closed?: boolean) => void;
  onPenCancel?: () => void;
  onPenStartDragPoint?: (index: number) => void;
  onPenDragPoint?: (x: number, y: number) => void;
  onPenEndDragPoint?: () => void;
}

function toolCursor(tool: Tool, isPanning: boolean): string {
  if (isPanning) return 'grabbing';
  switch (tool) {
    case 'pan': return 'grab';
    case 'cursor': return 'default';
    case 'select': return 'crosshair';
    case 'text': return 'text';
    case 'pen': return 'crosshair';
    default: return 'crosshair';
  }
}

// Snap threshold in canvas pixels
const SNAP_THRESHOLD = 6;

function getSnapPoint(
  x: number,
  y: number,
  shapes: Shape[],
  excludeId: string | null,
  zoom: number
): { x: number; y: number; snapX: number | null; snapY: number | null } {
  const threshold = SNAP_THRESHOLD / zoom;
  let snapX: number | null = null;
  let snapY: number | null = null;
  let bestX = threshold + 1;
  let bestY = threshold + 1;

  for (const s of shapes) {
    if (s.id === excludeId) continue;
    const candidates = [s.x, s.x + s.width / 2, s.x + s.width];
    const candidatesY = [s.y, s.y + s.height / 2, s.y + s.height];

    for (const cx of candidates) {
      const d = Math.abs(x - cx);
      if (d < bestX) { bestX = d; snapX = cx; }
    }
    for (const cy of candidatesY) {
      const d = Math.abs(y - cy);
      if (d < bestY) { bestY = d; snapY = cy; }
    }
  }

  return {
    x: snapX !== null ? snapX : x,
    y: snapY !== null ? snapY : y,
    snapX,
    snapY,
  };
}

export function CanvasOverlay({
  activeTool,
  shapes,
  drafting,
  selectedId,
  selectedIds,
  marquee,
  isDraggingMove,
  isDraggingResize,
  hasIframeContent,
  onDrawStart,
  onDrawUpdate,
  onDrawCommit,
  onSelect,
  onAddToSelection,
  onRemoveFromSelection,
  onSetMarquee,
  onCommitMarquee,
  onMoveStart,
  onMove,
  onMoveEnd,
  onResizeStart,
  onResize,
  onResizeEnd,
  onDrawCancel,
  onShapeChange,
  onShapePreview,
  autoEditId,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
  onCopy,
  onPaste,
  penPoints = [],
  penCursor = null,
  penDragPointIndex = null,
  penPullingHandleRef,
  onPenClick,
  onPenPullHandle,
  onPenEndHandlePull,
  onPenMove,
  onPenCommit,
  onPenCancel,
  onPenStartDragPoint,
  onPenDragPoint,
  onPenEndDragPoint,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Context menu ────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; shapeId: string | null } | null>(null);

  // Close context menu on any mousedown outside it
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('mousedown', close, { capture: true });
    window.addEventListener('keydown', close, { capture: true });
    return () => {
      window.removeEventListener('mousedown', close, { capture: true });
      window.removeEventListener('keydown', close, { capture: true });
    };
  }, [ctxMenu]);

  // ── Inline text editing ────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);

  // Auto-enter edit mode when autoEditId changes (e.g. after drawing a text shape)
  useEffect(() => {
    if (autoEditId) setEditingId(autoEditId);
  }, [autoEditId]);

  // Clear text edit mode and node edit mode when switching away from cursor tool
  useEffect(() => {
    if (activeTool !== 'cursor') {
      setEditingId(null);
      setNodeEditId(null);
    }
  }, [activeTool]);

  // ── Viewport (zoom + pan) ──────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const spaceDownRef = useRef(false);

  // ── Snapping state ─────────────────────────────────────────────────────────
  const [snapLines, setSnapLines] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const dragRef = useRef<{
    type: 'draw' | 'move' | 'resize' | 'marquee';
    originX: number;
    originY: number;
    moved?: boolean; // for move: true once threshold crossed
    shapeId?: string;
    shapeSnapshot?: Shape;
  } | null>(null);

  // Stable refs for pan/zoom so screenToCanvas never needs to recreate
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

  // Pen tool refs — stable references to avoid re-registering global listeners
  const activePenRef = useRef(false);
  activePenRef.current = activeTool === 'pen';
  const onPenMoveRef = useRef(onPenMove);
  onPenMoveRef.current = onPenMove;
  const onPenCancelRef = useRef(onPenCancel);
  onPenCancelRef.current = onPenCancel;
  const onPenCommitRef = useRef(onPenCommit);
  onPenCommitRef.current = onPenCommit;
  const onPenDragPointRef = useRef(onPenDragPoint);
  onPenDragPointRef.current = onPenDragPoint;
  const onPenEndDragPointRef = useRef(onPenEndDragPoint);
  onPenEndDragPointRef.current = onPenEndDragPoint;
  const onPenPullHandleRef = useRef(onPenPullHandle);
  onPenPullHandleRef.current = onPenPullHandle;
  const onPenEndHandlePullRef = useRef(onPenEndHandlePull);
  onPenEndHandlePullRef.current = onPenEndHandlePull;
  // Track whether we're currently dragging a pen point (read in global mousemove/mouseup)
  const penDraggingPointRef = useRef(false);
  penDraggingPointRef.current = penDragPointIndex !== null;

  // Committed path point dragging (cursor tool, editing existing path nodes)
  const pathPointDragRef = useRef<{ shapeId: string; pointIndex: number; points: import('../../lib/shapes').BezierPoint[] } | null>(null);

  // Bezier handle dragging (in node-edit mode)
  type HandleDragTarget = { shapeId: string; pointIndex: number; handle: 'cp1' | 'cp2'; points: import('../../lib/shapes').BezierPoint[] };
  const handleDragRef = useRef<HandleDragTarget | null>(null);

  // Node edit mode — which path shape is being edited at node level
  const [nodeEditId, setNodeEditId] = useState<string | null>(null);
  const nodeEditIdRef = useRef<string | null>(null);
  nodeEditIdRef.current = nodeEditId;

  // Convert screen coords → canvas coords — stable (reads pan/zoom from refs)
  const screenToCanvas = useCallback((sx: number, sy: number): { x: number; y: number } => {
    const el = overlayRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (sx - rect.left - panRef.current.x) / zoomRef.current,
      y: (sy - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []); // stable — reads from refs

  // ── Wheel: zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+scroll — zoom toward cursor
        const delta = -e.deltaY * 0.005;
        setZoom(z => {
          const next = Math.min(8, Math.max(0.1, z * (1 + delta)));
          const rect = el.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          setPan(p => ({
            x: mx - (mx - p.x) * (next / z),
            y: my - (my - p.y) * (next / z),
          }));
          return next;
        });
      } else if (e.altKey) {
        // Alt+scroll = zoom (alternative for trackpad users)
        const delta = -e.deltaY * 0.005;
        setZoom(z => {
          const next = Math.min(8, Math.max(0.1, z * (1 + delta)));
          const rect = el.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          setPan(p => ({
            x: mx - (mx - p.x) * (next / z),
            y: my - (my - p.y) * (next / z),
          }));
          return next;
        });
      } else {
        // Plain scroll = pan (like Figma)
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Global mouse events ────────────────────────────────────────────────────
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      // Pan
      if (panningRef.current) {
        const dx = e.clientX - panStartRef.current.mx;
        const dy = e.clientY - panStartRef.current.my;
        setPan({ x: panStartRef.current.px + dx, y: panStartRef.current.py + dy });
        return;
      }

      // Bezier handle dragging (node-edit mode)
      if (handleDragRef.current) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        const drag = handleDragRef.current;
        const newPoints = drag.points.map((p, i) => {
          if (i !== drag.pointIndex) return p;
          if (drag.handle === 'cp2') {
            // Moving out-handle: mirror the in-handle (smooth node)
            return {
              ...p,
              cp2x: x, cp2y: y,
              cp1x: 2 * p.x - x, cp1y: 2 * p.y - y,
            };
          } else {
            // Moving in-handle: mirror the out-handle
            return {
              ...p,
              cp1x: x, cp1y: y,
              cp2x: 2 * p.x - x, cp2y: 2 * p.y - y,
            };
          }
        });
        handleDragRef.current = { ...drag, points: newPoints };
        onShapePreview?.(drag.shapeId, { points: newPoints });
        return;
      }

      // Committed path point dragging takes priority — move anchor + its handles together
      if (pathPointDragRef.current) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        const drag = pathPointDragRef.current;
        const newPoints = drag.points.map((p, i) => {
          if (i !== drag.pointIndex) return p;
          const dx = x - p.x;
          const dy = y - p.y;
          return {
            ...p,
            x, y,
            ...(p.cp1x != null ? { cp1x: p.cp1x + dx, cp1y: p.cp1y! + dy } : {}),
            ...(p.cp2x != null ? { cp2x: p.cp2x + dx, cp2y: p.cp2y! + dy } : {}),
          };
        });
        pathPointDragRef.current = { ...drag, points: newPoints };
        onShapePreview?.(drag.shapeId, { points: newPoints });
        return;
      }

      // Pen handle-pulling (drag immediately after placing a new anchor point)
      if (activePenRef.current && penPullingHandleRef?.current) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        onPenPullHandleRef.current?.(x, y);
        return;
      }

      // Pen anchor point dragging
      if (penDraggingPointRef.current) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        onPenDragPointRef.current?.(x, y);
        return;
      }

      // Pen cursor tracking (no point drag active)
      if (activePenRef.current) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        onPenMoveRef.current?.(x, y);
        return;
      }

      if (!dragRef.current) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);

      if (dragRef.current.type === 'draw') {
        const ox = dragRef.current.originX;
        const oy = dragRef.current.originY;
        onDrawUpdate(x, y, ox, oy);
      } else if (dragRef.current.type === 'marquee') {
        const ox = dragRef.current.originX;
        const oy = dragRef.current.originY;
        onSetMarquee(Math.min(x, ox), Math.min(y, oy), Math.abs(x - ox), Math.abs(y - oy));
      } else if (dragRef.current.type === 'move') {
        // Apply 3px threshold before starting move (prevents accidental moves on click)
        const dx = Math.abs(x - dragRef.current.originX);
        const dy = Math.abs(y - dragRef.current.originY);
        if (!dragRef.current.moved && dx < 3 / zoomRef.current && dy < 3 / zoomRef.current) return;
        if (!dragRef.current.moved) {
          dragRef.current.moved = true;
          // Start the move now that threshold is crossed
          if (dragRef.current.shapeId && dragRef.current.shapeSnapshot) {
            onMoveStart(dragRef.current.shapeId, dragRef.current.originX, dragRef.current.originY, dragRef.current.shapeSnapshot);
          }
        }
        // Snap while moving
        const moving = shapes.find(s => s.id === selectedId);
        if (moving) {
          const snap = getSnapPoint(x, y, shapes, selectedId, zoomRef.current);
          setSnapLines({ x: snap.snapX, y: snap.snapY });
          onMove(snap.x, snap.y);
        } else {
          onMove(x, y);
        }
      } else if (dragRef.current.type === 'resize') {
        onResize(x, y);
      }
    }

    function onMouseUp() {
      if (panningRef.current) {
        panningRef.current = false;
        if (overlayRef.current) overlayRef.current.style.cursor = spaceDownRef.current ? 'grab' : '';
        return;
      }

      // End bezier handle drag — commit to history
      if (handleDragRef.current) {
        const drag = handleDragRef.current;
        handleDragRef.current = null;
        onShapeChange?.(drag.shapeId, { points: drag.points });
        return;
      }

      // End committed path point drag — commit to history
      if (pathPointDragRef.current) {
        const drag = pathPointDragRef.current;
        pathPointDragRef.current = null;
        onShapeChange?.(drag.shapeId, { points: drag.points });
        return;
      }

      // End pen handle-pull (user released mouse after placing+dragging new anchor)
      if (activePenRef.current && penPullingHandleRef?.current) {
        onPenEndHandlePullRef.current?.();
        return;
      }

      // End pen point drag
      if (penDraggingPointRef.current) {
        onPenEndDragPointRef.current?.();
        return;
      }

      if (!dragRef.current) return;
      const type = dragRef.current.type;
      const moved = dragRef.current.moved;
      dragRef.current = null;
      setSnapLines({ x: null, y: null });
      if (type === 'draw') onDrawCommit();
      else if (type === 'marquee') onCommitMarquee();
      else if (type === 'move' && moved) onMoveEnd();
      else if (type === 'resize') onResizeEnd();
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [screenToCanvas, onDrawUpdate, onDrawCommit, onMove, onMoveEnd, onMoveStart, onResize, onResizeEnd, onSetMarquee, onCommitMarquee, shapes, selectedId]);
  // Note: zoom is read from zoomRef.current (stable ref), so no need to include it in deps

  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      // Space+drag or pan tool = pan
      if (spaceDownRef.current || activeTool === 'pan') {
        panningRef.current = true;
        panStartRef.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
        if (overlayRef.current) overlayRef.current.style.cursor = 'grabbing';
        return;
      }

      const { x, y } = screenToCanvas(e.clientX, e.clientY);

      // Pen tool: click to add points, double-click to finish
      if (activeTool === 'pen') {
        if (e.detail === 2) {
          // Double-click: commit the path
          onPenCommit?.(false);
        } else {
          onPenClick?.(x, y);
        }
        return;
      }

      if (isDrawingTool(activeTool)) {
        dragRef.current = { type: 'draw', originX: x, originY: y };
        onDrawStart(x, y);
        return;
      }

      // Cursor/select mode clicking empty space → deselect + exit text edit + exit node edit, or start marquee
      onSelect(null);
      setEditingId(null);
      setNodeEditId(null);
      // Start marquee selection drag
      dragRef.current = { type: 'marquee', originX: x, originY: y };
    },
    [activeTool, screenToCanvas, onDrawStart, onSelect, onPenClick, onPenCommit] // pan removed — read from panRef
  );

  const handleShapeContextMenu = useCallback(
    (e: React.MouseEvent, shape: Shape) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeTool !== 'cursor') return;
      onSelect(shape.id);
      setCtxMenu({ x: e.clientX, y: e.clientY, shapeId: shape.id });
    },
    [activeTool, onSelect]
  );

  const handleOverlayContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Right-click on empty canvas: show paste-only menu
      setCtxMenu({ x: e.clientX, y: e.clientY, shapeId: null });
    },
    []
  );

  const handleShapeMouseDown = useCallback(
    (e: React.MouseEvent, shape: Shape) => {
      if (activeTool !== 'cursor') return;
      if (editingId === shape.id) return; // already editing
      e.stopPropagation();
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      if (e.shiftKey) {
        // Shift+click: toggle in selection
        const isSelected = selectedIds.includes(shape.id);
        if (isSelected) {
          onRemoveFromSelection(shape.id);
        } else {
          onAddToSelection(shape.id);
        }
      } else {
        // Normal click: select only this shape
        onSelect(shape.id);
        // Exit node edit if clicking a different shape
        if (nodeEditIdRef.current && nodeEditIdRef.current !== shape.id) {
          setNodeEditId(null);
        }
      }
      // Start move drag for this shape (unless in node edit mode for this path)
      if (nodeEditIdRef.current === shape.id) return; // let node handles handle it
      dragRef.current = { type: 'move', originX: x, originY: y, moved: false, shapeId: shape.id, shapeSnapshot: shape };
    },
    [activeTool, editingId, screenToCanvas, onSelect, onAddToSelection, onRemoveFromSelection, selectedIds]
  );

  const handleShapeDoubleClick = useCallback(
    (e: React.MouseEvent, shape: Shape) => {
      if (activeTool !== 'cursor') return;
      e.stopPropagation();
      if (shape.type === 'text') {
        setEditingId(shape.id);
      } else if (shape.type === 'path') {
        setNodeEditId(shape.id);
      }
    },
    [activeTool]
  );

  const handleResizeStart = useCallback(
    (shape: Shape, handle: HandleDir, e: React.MouseEvent) => {
      e.stopPropagation();
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      dragRef.current = { type: 'resize', originX: x, originY: y };
      onResizeStart(shape.id, handle, x, y, shape);
    },
    [screenToCanvas, onResizeStart]
  );

  const isInteracting = isDraggingMove || isDraggingResize;
  const selectedShape = shapes.find((s) => s.id === selectedId) ?? null;

  // Multi-select bounding box (when 2+ shapes selected)
  const isMultiSelect = selectedIds.length > 1;
  const multiBBox = isMultiSelect ? (() => {
    const sel = shapes.filter(s => selectedIds.includes(s.id));
    if (sel.length === 0) return null;
    const x = Math.min(...sel.map(s => s.x));
    const y = Math.min(...sel.map(s => s.y));
    const x2 = Math.max(...sel.map(s => s.x + s.width));
    const y2 = Math.max(...sel.map(s => s.y + s.height));
    return { x, y, width: x2 - x, height: y2 - y };
  })() : null;

  // Zoom level display
  const zoomPct = Math.round(zoom * 100);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setZoom(z => {
      const next = Math.min(8, z * 1.25);
      const el = overlayRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const mx = rect.width / 2;
        const my = rect.height / 2;
        setPan(p => ({
          x: mx - (mx - p.x) * (next / z),
          y: my - (my - p.y) * (next / z),
        }));
      }
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(z => {
      const next = Math.max(0.1, z / 1.25);
      const el = overlayRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const mx = rect.width / 2;
        const my = rect.height / 2;
        setPan(p => ({
          x: mx - (mx - p.x) * (next / z),
          y: my - (my - p.y) * (next / z),
        }));
      }
      return next;
    });
  }, []);

  const zoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Zoom to fit all shapes in view
  const zoomToFit = useCallback(() => {
    if (shapes.length === 0) { zoomReset(); return; }
    const el = overlayRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 60;
    const minX = Math.min(...shapes.map(s => s.x));
    const minY = Math.min(...shapes.map(s => s.y));
    const maxX = Math.max(...shapes.map(s => s.x + s.width));
    const maxY = Math.max(...shapes.map(s => s.y + s.height));
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw <= 0 || bh <= 0) { zoomReset(); return; }
    const z = Math.min(8, Math.max(0.05, Math.min(
      (rect.width - pad * 2) / bw,
      (rect.height - pad * 2) / bh
    )));
    setZoom(z);
    setPan({
      x: rect.width / 2 - (minX + bw / 2) * z,
      y: rect.height / 2 - (minY + bh / 2) * z,
    });
  }, [shapes, zoomReset]);

  // Zoom to fit — double-click canvas bg
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== overlayRef.current) return;
    if (shapes.length > 0) zoomToFit();
    else zoomReset();
  }, [shapes, zoomToFit, zoomReset]);

  // ── Keyboard: space = pan mode, = / - / 0 / 1 = zoom ─────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space' && !e.repeat) {
        spaceDownRef.current = true;
        if (overlayRef.current) overlayRef.current.style.cursor = 'grab';
        e.preventDefault();
        return;
      }

      // Escape: exit node edit mode, cancel draw, or cancel pen
      if (e.key === 'Escape') {
        if (nodeEditIdRef.current) {
          setNodeEditId(null);
          e.stopPropagation();
          e.stopImmediatePropagation(); // prevent App.tsx handler from also clearing selection
          return;
        }
        if (dragRef.current?.type === 'draw') {
          dragRef.current = null;
          onDrawCancel?.();
          e.stopPropagation();
          return;
        }
        if (activePenRef.current) {
          onPenCancelRef.current?.();
          e.stopPropagation();
          return;
        }
      }

      // While in node-edit mode, block Delete/Backspace so we don't delete the whole shape
      if (nodeEditIdRef.current && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // Enter: commit pen path
      if (e.key === 'Enter' && activePenRef.current) {
        onPenCommitRef.current?.(false);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      // Zoom shortcuts (no modifier needed, like Figma)
      if (!mod) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          zoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          zoomReset();
        } else if (e.key === '1') {
          e.preventDefault();
          zoomToFit();
        }
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        if (overlayRef.current) overlayRef.current.style.cursor = '';
      }
    };
    // Use capture:true so this fires before App.tsx's keydown handler, allowing stopImmediatePropagation
    window.addEventListener('keydown', onDown, { capture: true });
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown, { capture: true }); window.removeEventListener('keyup', onUp); };
  }, [zoomIn, zoomOut, zoomReset, zoomToFit, onDrawCancel]);

  // Dot grid background — moves with pan/zoom
  const gridSpacing = 24;
  const gridX = ((pan.x % (gridSpacing * zoom)) + gridSpacing * zoom) % (gridSpacing * zoom);
  const gridY = ((pan.y % (gridSpacing * zoom)) + gridSpacing * zoom) % (gridSpacing * zoom);
  const dotSize = Math.max(1, Math.min(3, zoom * 1.8));

  // In selection mode, let pointer events pass through to the iframe
  const isSelectionPassthrough = activeTool === 'select';

  return (
    <div
      ref={overlayRef}
      onMouseDown={isSelectionPassthrough ? undefined : handleOverlayMouseDown}
      onDoubleClick={isSelectionPassthrough ? undefined : handleDoubleClick}
      onContextMenu={isSelectionPassthrough ? undefined : handleOverlayContextMenu}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: isInteracting ? (isDraggingMove ? 'grabbing' : 'crosshair') : toolCursor(activeTool, false),
        zIndex: 10,
        background: hasIframeContent ? 'transparent' : 'var(--canvas-bg)',
        backgroundImage: hasIframeContent ? 'none' : `radial-gradient(circle, var(--canvas-dot) ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${gridSpacing * zoom}px ${gridSpacing * zoom}px`,
        backgroundPosition: `${gridX}px ${gridY}px`,
        pointerEvents: isSelectionPassthrough ? 'none' : 'all',
      }}
    >
      {/* ── Transform layer ──────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: '100%',
          height: '100%',
          pointerEvents: 'none', // children opt in
        }}
      >
        {/* SVG layer: committed path shapes */}
        <svg
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        >
          {shapes.filter(s => s.type === 'path').map(s => {
            const pts = s.points ?? [];
            if (pts.length < 2) return null;
            const d = buildPathD(pts, s.pathClosed ?? false);
            const sw = s.strokeWidth ?? 2;
            const dashArray = s.strokeDash === 'dashed' ? `${sw * 4},${sw * 2}` :
                              s.strokeDash === 'dotted' ? `${sw},${sw * 2}` : undefined;
            const arrowSize = sw * 4 + 6;
            const isSelected = selectedIds.includes(s.id) || selectedId === s.id;
            return (
              <g key={s.id} opacity={s.opacity}
                style={{ pointerEvents: activeTool === 'cursor' ? 'all' : 'none', cursor: nodeEditId === s.id ? 'default' : (activeTool === 'cursor' ? 'move' : 'default') }}
                onMouseDown={(e) => {
                  if (activeTool !== 'cursor') return;
                  e.stopPropagation();
                  const { x, y } = screenToCanvas(e.clientX, e.clientY);
                  if (e.shiftKey) {
                    selectedIds.includes(s.id) ? onRemoveFromSelection(s.id) : onAddToSelection(s.id);
                  } else {
                    onSelect(s.id);
                    if (nodeEditIdRef.current && nodeEditIdRef.current !== s.id) setNodeEditId(null);
                  }
                  // Don't start a move drag when in node edit mode (nodes handle their own drags)
                  if (nodeEditId === s.id) return;
                  dragRef.current = { type: 'move', originX: x, originY: y, moved: false, shapeId: s.id, shapeSnapshot: s };
                }}
                onDoubleClick={(e) => {
                  if (activeTool !== 'cursor') return;
                  e.stopPropagation();
                  onSelect(s.id);
                  setNodeEditId(s.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (activeTool !== 'cursor') return;
                  onSelect(s.id);
                  setCtxMenu({ x: e.clientX, y: e.clientY, shapeId: s.id });
                }}
              >
                {/* Transparent wide hit-catcher — makes thin paths much easier to click */}
                <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(12 / zoom, sw + 8)}
                  strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'stroke' }} />
                {/* Selection highlight */}
                {isSelected && activeTool === 'cursor' && (
                  <path d={d} fill="none" stroke="#6366f1" strokeWidth={sw + 6} strokeOpacity={0.25}
                    strokeLinecap={s.lineCap ?? 'round'} strokeLinejoin={s.lineJoin ?? 'round'} />
                )}
                <path
                  d={d}
                  fill={s.fill === 'transparent' ? 'none' : s.fill}
                  stroke={s.stroke}
                  strokeWidth={sw}
                  strokeLinecap={s.lineCap ?? 'round'}
                  strokeLinejoin={s.lineJoin ?? 'round'}
                  strokeDasharray={dashArray}
                />
                {/* Arrowhead at end */}
                {s.arrowEnd && pts.length >= 2 && (() => {
                  const p1 = pts[pts.length - 2], p2 = pts[pts.length - 1];
                  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
                  return <polygon
                    points={`0,0 ${-arrowSize},${arrowSize / 2} ${-arrowSize},${-arrowSize / 2}`}
                    fill={s.stroke}
                    transform={`translate(${p2.x},${p2.y}) rotate(${angle})`}
                  />;
                })()}
                {/* Arrowhead at start */}
                {s.arrowStart && pts.length >= 2 && (() => {
                  const p1 = pts[1], p2 = pts[0];
                  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
                  return <polygon
                    points={`0,0 ${-arrowSize},${arrowSize / 2} ${-arrowSize},${-arrowSize / 2}`}
                    fill={s.stroke}
                    transform={`translate(${p2.x},${p2.y}) rotate(${angle})`}
                  />;
                })()}
                {/* Node handles — shown in full node-edit mode (double-click) */}
                {nodeEditId === s.id && pts.map((pt, i) => {
                  const hr = 4 / zoom;   // handle dot radius
                  const ar = 5 / zoom;   // anchor dot radius
                  const hitR = 8 / zoom; // transparent hit area radius
                  return (
                    <g key={i}>
                      {/* In-handle arm + dot */}
                      {pt.cp1x != null && (
                        <>
                          <line x1={pt.x} y1={pt.y} x2={pt.cp1x} y2={pt.cp1y}
                            stroke="var(--accent)" strokeWidth={1 / zoom} strokeOpacity={0.5} style={{ pointerEvents: 'none' }} />
                          {/* Visible handle dot — hollow (in-handle) */}
                          <circle cx={pt.cp1x} cy={pt.cp1y} r={hr}
                            fill="white" stroke="var(--accent)" strokeWidth={2 / zoom} style={{ pointerEvents: 'none' }} />
                          {/* Large transparent hit area */}
                          <circle cx={pt.cp1x} cy={pt.cp1y} r={hitR}
                            fill="transparent" style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                            onMouseDown={(e) => {
                              e.stopPropagation(); e.preventDefault();
                              handleDragRef.current = { shapeId: s.id, pointIndex: i, handle: 'cp1', points: pts };
                            }}
                          />
                        </>
                      )}
                      {/* Out-handle arm + dot */}
                      {pt.cp2x != null && (
                        <>
                          <line x1={pt.x} y1={pt.y} x2={pt.cp2x} y2={pt.cp2y}
                            stroke="var(--accent)" strokeWidth={1 / zoom} strokeOpacity={0.5} style={{ pointerEvents: 'none' }} />
                          <circle cx={pt.cp2x} cy={pt.cp2y} r={hr}
                            fill="var(--accent)" stroke="white" strokeWidth={1 / zoom} style={{ pointerEvents: 'none' }} />
                          <circle cx={pt.cp2x} cy={pt.cp2y} r={hitR}
                            fill="transparent" style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                            onMouseDown={(e) => {
                              e.stopPropagation(); e.preventDefault();
                              handleDragRef.current = { shapeId: s.id, pointIndex: i, handle: 'cp2', points: pts };
                            }}
                          />
                        </>
                      )}
                      {/* Anchor point — filled accent so it's visible on any background */}
                      <circle
                        cx={pt.x} cy={pt.y} r={ar}
                        fill="var(--accent)" stroke="white" strokeWidth={1.5 / zoom}
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* Large transparent hit area for anchor */}
                      <circle
                        cx={pt.x} cy={pt.y} r={hitR}
                        fill="transparent" style={{ pointerEvents: 'all', cursor: 'move' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          pathPointDragRef.current = { shapeId: s.id, pointIndex: i, points: pts };
                        }}
                        onMouseEnter={(e) => {
                          const prev = e.currentTarget.previousElementSibling as SVGCircleElement | null;
                          if (prev) prev.setAttribute('fill', 'white');
                        }}
                        onMouseLeave={(e) => {
                          const prev = e.currentTarget.previousElementSibling as SVGCircleElement | null;
                          if (prev) prev.setAttribute('fill', 'var(--accent)');
                        }}
                      />
                    </g>
                  );
                })}
                {/* Anchor dots shown when just selected (not in node edit) — subtle visual cue */}
                {isSelected && activeTool === 'cursor' && nodeEditId !== s.id && pts.map((pt, i) => {
                  const ar = 3 / zoom;
                  return (
                    <circle key={i}
                      cx={pt.x} cy={pt.y} r={ar}
                      fill="var(--accent)" stroke="white" strokeWidth={1 / zoom}
                      style={{ pointerEvents: 'none', opacity: 0.7 }}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Live pen draft preview — Illustrator-style bezier */}
          {activeTool === 'pen' && penPoints.length > 0 && (() => {
            const isPulling = penPullingHandleRef?.current ?? false;
            // For cursor ghost: show when not pulling a handle and not dragging an anchor
            const showCursor = penCursor && !isPulling && penDragPointIndex === null;
            // Build preview path — shows the actual curve that would result from clicking at cursor.
            // If the last placed node has an out-handle (cp2), use it as the outgoing control point
            // of the preview segment. The cursor itself has no handles yet so c2 = cursor position.
            let previewPts = penPoints;
            if (showCursor) {
              previewPts = [...penPoints, { x: penCursor!.x, y: penCursor!.y }];
            }
            const d = buildPathD(previewPts, false);
            const hr = 3.5 / zoom; // handle dot radius
            const ar = 4.5 / zoom; // anchor dot radius

            return (
              <g>
                {/* Draft path */}
                <path d={d} fill="none" stroke="#6366f1" strokeWidth={2 / zoom}
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={`${4 / zoom},${3 / zoom}`} style={{ pointerEvents: 'none' }} />

                {/* Control handle lines + dots for each placed node */}
                {penPoints.map((pt, i) => {
                  const isLast = i === penPoints.length - 1;
                  const showCp1 = pt.cp1x != null && (isLast ? isPulling : true);
                  const showCp2 = pt.cp2x != null;
                  return (
                    <g key={i}>
                      {/* In-handle line */}
                      {showCp1 && (
                        <line x1={pt.x} y1={pt.y} x2={pt.cp1x} y2={pt.cp1y}
                          stroke="#6366f1" strokeWidth={1 / zoom} strokeOpacity={0.5} style={{ pointerEvents: 'none' }} />
                      )}
                      {/* Out-handle line */}
                      {showCp2 && (
                        <line x1={pt.x} y1={pt.y} x2={pt.cp2x} y2={pt.cp2y}
                          stroke="#6366f1" strokeWidth={1 / zoom} strokeOpacity={0.5} style={{ pointerEvents: 'none' }} />
                      )}
                      {/* In-handle dot */}
                      {showCp1 && (
                        <circle cx={pt.cp1x} cy={pt.cp1y} r={hr}
                          fill="white" stroke="#6366f1" strokeWidth={1.5 / zoom}
                          style={{ pointerEvents: 'none' }} />
                      )}
                      {/* Out-handle dot */}
                      {showCp2 && (
                        <circle cx={pt.cp2x} cy={pt.cp2y} r={hr}
                          fill="#6366f1" stroke="white" strokeWidth={1 / zoom}
                          style={{ pointerEvents: 'none' }} />
                      )}
                      {/* Anchor point */}
                      <circle
                        cx={pt.x} cy={pt.y} r={ar}
                        fill={penDragPointIndex === i ? '#6366f1' : 'white'}
                        stroke="#6366f1" strokeWidth={1.5 / zoom}
                        style={{ pointerEvents: 'all', cursor: 'move' }}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onPenStartDragPoint?.(i); }}
                        onMouseEnter={(e) => { (e.currentTarget as SVGCircleElement).setAttribute('fill', '#a5b4fc'); }}
                        onMouseLeave={(e) => { (e.currentTarget as SVGCircleElement).setAttribute('fill', penDragPointIndex === i ? '#6366f1' : 'white'); }}
                      />
                    </g>
                  );
                })}

                {/* Cursor ghost dot */}
                {showCursor && (
                  <circle cx={penCursor!.x} cy={penCursor!.y} r={ar}
                    fill="#6366f1" opacity={0.5} style={{ pointerEvents: 'none' }} />
                )}
              </g>
            );
          })()}
        </svg>

        {/* Committed shapes — visual render + hit target */}
        {shapes.filter(s => s.type !== 'path').map((shape) => {
          const isEditing = editingId === shape.id;
          return (
            <div
              key={shape.id}
              onMouseDown={(e) => handleShapeMouseDown(e, shape)}
              onDoubleClick={(e) => handleShapeDoubleClick(e, shape)}
              onContextMenu={(e) => handleShapeContextMenu(e, shape)}
              style={{
                ...buildShapeStyle(shape),
                cursor: isEditing ? 'text' : (activeTool === 'cursor' ? 'move' : 'crosshair'),
                pointerEvents: activeTool === 'cursor' ? 'all' : 'none',
              }}
            >
              {shape.type === 'text' && !isEditing && (
                <span style={{ pointerEvents: 'none' }}>{shape.text}</span>
              )}
              {shape.type === 'text' && isEditing && (
                <TextareaEditor
                  shape={shape}
                  onCommit={(text) => {
                    onShapeChange?.(shape.id, { text });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}
              {/* Auto-layout badge */}
              {shape.layout !== 'none' && !isEditing && (
                <div style={{
                  position: 'absolute',
                  bottom: 4 / zoom,
                  right: 4 / zoom,
                  width: 16 / zoom,
                  height: 16 / zoom,
                  background: 'rgba(99,102,241,0.85)',
                  borderRadius: 3 / zoom,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10 / zoom,
                  color: 'white',
                  pointerEvents: 'none',
                  lineHeight: 1,
                }}>
                  {shape.layout === 'row' ? '→' : '↓'}
                </div>
              )}
            </div>
          );
        })}

        {/* Multi-select bounding box */}
        {multiBBox && activeTool === 'cursor' && (
          <div
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              // Allow dragging the group — use first selected shape's snapshot
              const { x, y } = screenToCanvas(e.clientX, e.clientY);
              const anyShape = shapes.find(s => selectedIds.includes(s.id));
              if (anyShape) {
                dragRef.current = { type: 'move', originX: x, originY: y, moved: false, shapeId: anyShape.id, shapeSnapshot: anyShape };
              }
            }}
            style={{
              position: 'absolute',
              left: multiBBox.x,
              top: multiBBox.y,
              width: multiBBox.width,
              height: multiBBox.height,
              border: `${1.5 / zoom}px dashed #6366f1`,
              borderRadius: 2 / zoom,
              boxSizing: 'border-box',
              pointerEvents: 'all',
              cursor: 'move',
              background: 'rgba(99,102,241,0.04)',
            }}
          />
        )}

        {/* Selection handles (scaled with zoom) — only for single selection, hidden in node-edit mode */}
        {selectedShape && !isMultiSelect && activeTool === 'cursor' && nodeEditId !== selectedShape.id && (() => {
          // Use exact bezier bbox for paths, otherwise use shape bounds directly
          const bb = selectedShape.type === 'path' && selectedShape.points?.length
            ? pathBbox(selectedShape.points, selectedShape.pathClosed ?? false)
            : { x: selectedShape.x, y: selectedShape.y, width: selectedShape.width, height: selectedShape.height };
          return (
            <>
              <ShapeHandles
                shape={selectedShape}
                zoom={zoom}
                onResizeStart={(handle, e) => handleResizeStart(selectedShape, handle, e)}
              />
              {/* Dimension label above selection */}
              <div style={{
                position: 'absolute',
                left: bb.x + bb.width / 2,
                top: bb.y - 28 / zoom,
                transform: 'translateX(-50%)',
                background: '#6366f1',
                color: 'white',
                fontSize: 11 / zoom,
                fontFamily: 'monospace',
                padding: `${2 / zoom}px ${6 / zoom}px`,
                borderRadius: 4 / zoom,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                lineHeight: 1.4,
              }}>
                {selectedShape.name !== selectedShape.type.charAt(0).toUpperCase() + selectedShape.type.slice(1) && selectedShape.name
                  ? `${selectedShape.name}  `
                  : ''}
                {Math.round(bb.width)} × {Math.round(bb.height)}
              </div>
            </>
          );
        })()}

        {/* Marquee selection rectangle */}
        {marquee && (
          <div style={{
            position: 'absolute',
            left: marquee.x,
            top: marquee.y,
            width: marquee.width,
            height: marquee.height,
            border: `${1 / zoom}px solid #6366f1`,
            background: 'rgba(99,102,241,0.08)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }} />
        )}

        {/* Draft preview */}
        {drafting && <DraftPreview shape={drafting.shape} />}

        {/* Snap lines */}
        {snapLines.x !== null && (
          <div style={{
            position: 'absolute',
            left: snapLines.x,
            top: -9999,
            width: 1,
            height: 99999,
            background: '#f59e0b',
            opacity: 0.8,
            pointerEvents: 'none',
          }} />
        )}
        {snapLines.y !== null && (
          <div style={{
            position: 'absolute',
            left: -9999,
            top: snapLines.y,
            width: 99999,
            height: 1,
            background: '#f59e0b',
            opacity: 0.8,
            pointerEvents: 'none',
          }} />
        )}

        {/* Dimension label on drafting */}
        {drafting && drafting.shape.width > 20 && drafting.shape.height > 20 && (
          <div style={{
            position: 'absolute',
            left: drafting.shape.x + drafting.shape.width / 2,
            top: drafting.shape.y + drafting.shape.height + 4,
            transform: 'translateX(-50%)',
            background: '#6366f1',
            color: 'white',
            fontSize: 11,
            fontFamily: 'monospace',
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {Math.round(drafting.shape.width)} × {Math.round(drafting.shape.height)}
          </div>
        )}
      </div>

      {/* ── Pen tool hint bar ────────────────────────────────────────────── */}
      {activeTool === 'pen' && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 11,
          color: 'var(--muted)',
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          backdropFilter: 'blur(8px)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}>
          {penPoints.length === 0 ? (
            <>Click to place anchor · Click + drag to create curve</>
          ) : penPoints.length === 1 ? (
            <>
              Click to add straight
              <span style={{ color: 'var(--subtle)' }}>·</span>
              Click+drag to curve
              <span style={{ color: 'var(--subtle)' }}>·</span>
              <KbdChip>Esc</KbdChip>
              {' '}to cancel
            </>
          ) : (
            <>
              Click straight · Click+drag curve
              <span style={{ color: 'var(--subtle)' }}>·</span>
              Double-click or{' '}
              <KbdChip>Enter</KbdChip>
              {' '}to finish
            </>
          )}
        </div>
      )}

      {/* ── Path hint bars ───────────────────────────────────────────────── */}
      {activeTool === 'cursor' && selectedId && shapes.find(s => s.id === selectedId)?.type === 'path' && !nodeEditId && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '6px 14px', fontSize: 11, color: 'var(--muted)',
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
          backdropFilter: 'blur(8px)', zIndex: 20, display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}>
          Double-click to edit nodes
          <span style={{ color: 'var(--subtle)' }}>·</span>
          Drag to move
        </div>
      )}
      {nodeEditId && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--panel)', border: '1px solid color-mix(in srgb, var(--accent) 40%, var(--border))',
          borderRadius: 8, padding: '6px 14px', fontSize: 11, color: 'var(--muted)',
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
          backdropFilter: 'blur(8px)', zIndex: 20, display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Node Edit</span>
          <span style={{ color: 'var(--subtle)' }}>·</span>
          Drag anchors or handles
          <span style={{ color: 'var(--subtle)' }}>·</span>
          <KbdChip>Esc</KbdChip> to exit
        </div>
      )}

      {/* ── Zoom controls (not transformed) ──────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '2px 4px',
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
        zIndex: 20,
        pointerEvents: 'all', // always interactive even in passthrough mode
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <button
          onMouseDown={(e) => { e.stopPropagation(); zoomOut(); }}
          title="Zoom out (−)"
          style={{
            background: 'none', border: '1px solid transparent', color: 'var(--muted)', cursor: 'pointer',
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, borderRadius: 5, lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
        >−</button>
        <button
          onMouseDown={(e) => { e.stopPropagation(); shapes.length > 0 ? zoomToFit() : zoomReset(); }}
          title="Zoom to fit (1 / dbl-click)"
          style={{
            background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer',
            padding: '0 8px', height: 28, display: 'flex', alignItems: 'center',
            fontSize: 12, fontFamily: 'monospace', borderRadius: 4, minWidth: 52, justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-alt)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >{zoomPct}%</button>
        <button
          onMouseDown={(e) => { e.stopPropagation(); zoomIn(); }}
          title="Zoom in (=)"
          style={{
            background: 'none', border: '1px solid transparent', color: 'var(--muted)', cursor: 'pointer',
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, borderRadius: 5, lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
        >+</button>
      </div>

      {/* ── Context menu ────────────────────────────────────────────────────── */}
      {ctxMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '4px 0',
            minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 9999,
            fontSize: 12,
            color: 'var(--text)',
            userSelect: 'none',
          }}
        >
          {ctxMenu.shapeId && (<>
            <CtxItem label="Duplicate" shortcut="⌘D" onClick={() => { setCtxMenu(null); onDuplicate?.(); }} />
            <CtxItem label="Copy" shortcut="⌘C" onClick={() => { setCtxMenu(null); onCopy?.(); }} />
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <CtxItem label="Bring to Front" shortcut="⌘]" onClick={() => { setCtxMenu(null); onBringToFront?.(); }} />
            <CtxItem label="Send to Back" shortcut="⌘[" onClick={() => { setCtxMenu(null); onSendToBack?.(); }} />
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <CtxItem label="Delete" shortcut="⌫" danger onClick={() => { setCtxMenu(null); onDelete?.(); }} />
          </>)}
          {!ctxMenu.shapeId && (
            <CtxItem label="Paste" shortcut="⌘V" onClick={() => { setCtxMenu(null); onPaste?.(); }} />
          )}
        </div>
      )}
    </div>
  );
}

function CtxItem({ label, shortcut, danger, onClick }: { label: string; shortcut?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'none', border: 'none',
        color: danger ? 'var(--error)' : 'var(--text)',
        cursor: 'pointer', padding: '6px 14px', gap: 24, textAlign: 'left',
        fontSize: 12,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-dim)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <span>{label}</span>
      {shortcut && <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 11 }}>{shortcut}</span>}
    </button>
  );
}

/** Keyboard shortcut chip used in hint bars */
function KbdChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'var(--panel-alt)', border: '1px solid var(--border)',
      borderRadius: 3, padding: '0 4px', fontSize: 10,
      color: 'var(--text)', fontFamily: 'monospace', lineHeight: '16px',
    }}>{children}</span>
  );
}

// Controlled textarea for inline text editing (supports undo-sync and commit on blur)
function TextareaEditor({
  shape,
  onCommit,
  onCancel,
}: {
  shape: Shape;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(shape.text);

  // If shape.text changes externally (e.g. undo), sync the local value
  useEffect(() => {
    setValue(shape.text);
  }, [shape.text]);

  return (
    <textarea
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => {
        // Select all on first focus so user can immediately type over placeholder
        e.target.select();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={() => {
        onCommit(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { onCommit(value); e.stopPropagation(); e.preventDefault(); }
        if (e.key === 'Enter' && !e.shiftKey) {
          onCommit(value);
          e.preventDefault();
        }
        e.stopPropagation(); // don't fire global shortcuts while typing
      }}
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        resize: 'none',
        color: shape.color,
        fontSize: shape.fontSize,
        fontFamily: shape.fontFamily || 'inherit',
        fontWeight: shape.fontWeight,
        fontStyle: shape.fontStyle,
        textAlign: shape.textAlign as 'left' | 'center' | 'right',
        textDecoration: shape.textDecoration,
        lineHeight: shape.lineHeight,
        letterSpacing: shape.letterSpacing !== 0 ? `${shape.letterSpacing / 100}em` : 'normal',
        padding: 0,
        cursor: 'text',
      }}
    />
  );
}

function DraftPreview({ shape }: { shape: Shape }) {
  const borderStyle = shape.type === 'frame' ? 'dashed' : 'solid';
  return (
    <div
      style={{
        position: 'absolute',
        left: shape.x,
        top: shape.y,
        width: Math.max(shape.width, 1),
        height: Math.max(shape.height, 1),
        border: `1.5px ${borderStyle} #6366f1`,
        borderRadius: shape.type === 'ellipse' ? '50%' : 0,
        background: shape.type === 'frame' ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.15)',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}
