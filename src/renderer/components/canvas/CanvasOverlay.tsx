import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Tool } from '../layout/ToolSidebar';
import type { Shape } from '../../lib/shapes';
import { buildShapeStyle, buildPathD, pathBbox, shapeToCss } from '../../lib/shapes';
import type { HandleDir } from '../../hooks/useDrawingTools';
import { isDrawingTool } from '../../hooks/useDrawingTools';
import { ShapeHandles } from './ShapeHandles';
import { CommentPinsOverlay } from './CommentPinsOverlay';
import { Minimap } from './Minimap';
import { StickyNotesOverlay } from './StickyNotesOverlay';
import * as LucideIcons from 'lucide-react';

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
  onGroup?: () => void;
  onUngroup?: () => void;
  onWrapInFrame?: () => void;
  onSelectAll?: () => void;
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
  /** Fires on any pointer-down on the canvas surface — used to auto-collapse the chat bar */
  onCanvasPointerDown?: () => void;
  // Comment pins
  commentPins?: import('./CommentPinsOverlay').CommentPin[];
  commentMode?: boolean;
  onAddCommentPin?: (x: number, y: number) => void;
  onUpdateCommentPin?: (id: string, patch: Partial<import('./CommentPinsOverlay').CommentPin>) => void;
  onDeleteCommentPin?: (id: string) => void;
  onExitCommentMode?: () => void;
  // Sticky notes
  projectId?: string;
  stickyNotesPlacing?: boolean;
  onStickyNotesPlacingComplete?: () => void;
  // Viewport sync (for rulers etc.)
  onViewportChange?: (zoom: number, panX: number, panY: number) => void;
  // Guide snap lines (from rulers) in canvas space
  guideLines?: { x?: number; y?: number }[];
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

/** Whether a snap coordinate corresponds to a center vs edge */
type SnapKind = 'edge' | 'center';

/**
 * Smart snap during shape move: snaps the EDGES of the moving shape to other
 * shapes' edges, rather than snapping the raw cursor position.
 * Returns adjusted (x, y) for the shape's top-left, and which guide lines to show.
 */
function getSnapForMove(
  shapeX: number,    // tentative new x of moving shape
  shapeY: number,    // tentative new y of moving shape
  shapeW: number,
  shapeH: number,
  shapes: Shape[],
  excludeIds: string[],
  zoom: number,
): { x: number; y: number; snapX: number | null; snapY: number | null; snapXKind: SnapKind; snapYKind: SnapKind } {
  const threshold = SNAP_THRESHOLD / zoom;
  // Moving shape's candidate snap edges: left, center, right
  // index 0 = left (edge), 1 = center, 2 = right (edge)
  const myXs = [shapeX, shapeX + shapeW / 2, shapeX + shapeW];
  const myYs = [shapeY, shapeY + shapeH / 2, shapeY + shapeH];

  let snapX: number | null = null;
  let snapY: number | null = null;
  let bestX = threshold + 1;
  let bestY = threshold + 1;
  // offsets from the moving shape's edges to its origin
  let dxOffset = 0;
  let dyOffset = 0;
  // Whether the snap was to a center or edge of a target
  let snapXKind: SnapKind = 'edge';
  let snapYKind: SnapKind = 'edge';

  for (const s of shapes) {
    if (excludeIds.includes(s.id)) continue;
    // index 0 = left (edge), 1 = center, 2 = right (edge)
    const targetXs = [s.x, s.x + s.width / 2, s.x + s.width];
    const targetYs = [s.y, s.y + s.height / 2, s.y + s.height];

    for (let mi = 0; mi < myXs.length; mi++) {
      for (let ti = 0; ti < targetXs.length; ti++) {
        const d = Math.abs(myXs[mi] - targetXs[ti]);
        if (d < bestX) {
          bestX = d;
          snapX = targetXs[ti];
          dxOffset = myXs[mi] - shapeX;
          // "center" if both the moving edge and target edge are centers (index 1)
          snapXKind = (mi === 1 && ti === 1) ? 'center' : 'edge';
        }
      }
    }
    for (let mi = 0; mi < myYs.length; mi++) {
      for (let ti = 0; ti < targetYs.length; ti++) {
        const d = Math.abs(myYs[mi] - targetYs[ti]);
        if (d < bestY) {
          bestY = d;
          snapY = targetYs[ti];
          dyOffset = myYs[mi] - shapeY;
          snapYKind = (mi === 1 && ti === 1) ? 'center' : 'edge';
        }
      }
    }
  }

  return {
    x: snapX !== null ? snapX - dxOffset : shapeX,
    y: snapY !== null ? snapY - dyOffset : shapeY,
    snapX,
    snapY,
    snapXKind,
    snapYKind,
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
  onGroup,
  onUngroup,
  onWrapInFrame,
  onSelectAll,
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
  onCanvasPointerDown,
  commentPins = [],
  commentMode = false,
  onAddCommentPin,
  onUpdateCommentPin,
  onDeleteCommentPin,
  onExitCommentMode,
  projectId,
  stickyNotesPlacing = false,
  onStickyNotesPlacingComplete,
  onViewportChange,
  guideLines = [],
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Context menu ────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; shapeId: string | null } | null>(null);

  // ── Alt key tracking (for alt+drag duplicate & distance measurements) ─────
  const [altKeyDown, setAltKeyDown] = useState(false);
  const altKeyRef = useRef(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.altKey) { setAltKeyDown(true); altKeyRef.current = true; } };
    const onKeyUp = (e: KeyboardEvent) => { if (!e.altKey) { setAltKeyDown(false); altKeyRef.current = false; } };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  // ── Hovered shape tracking (for Alt measurements) ─────────────────────────
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  // ── Copy/paste style clipboard ────────────────────────────────────────────
  type StyleClip = Pick<Shape, 'fill' | 'fillType' | 'fillOpacity' | 'stroke' | 'strokeWidth' | 'strokeDash' | 'opacity' | 'shadow' | 'shadowColor' | 'shadowX' | 'shadowY' | 'shadowBlur' | 'borderRadius' | 'color' | 'fontSize' | 'fontWeight' | 'fontFamily' | 'gradientStops' | 'gradientAngle'>;
  const [styleClipboard, setStyleClipboard] = useState<StyleClip | null>(null);
  const styleClipboardRef = useRef<StyleClip | null>(null);
  styleClipboardRef.current = styleClipboard;

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

  // ── Rulers ────────────────────────────────────────────────────────────────
  const [showRulers, setShowRulers] = useState(false);
  const RULER_SIZE = 20; // px — thickness of the ruler strip

  // ── Guide lines (ruler drag → sticky guides on canvas) ────────────────────
  const [guides, setGuides] = useState<{ id: string; type: 'h' | 'v'; pos: number }[]>([]);
  const [draggingGuide, setDraggingGuide] = useState<{ id: string | null; type: 'h' | 'v'; startScreen: number } | null>(null);

  // ── Focus mode — dims non-selected shapes ─────────────────────────────────
  const [focusMode, setFocusMode] = useState(false);

  // ── Wireframe / outline view mode ─────────────────────────────────────────
  const [wireframeMode, setWireframeMode] = useState(false);

  // ── Pixel grid overlay ────────────────────────────────────────────────────
  // Shows a configurable line grid over the canvas (separate from snap grid)
  const [showPixelGrid, setShowPixelGrid] = useState(false);
  const [pixelGridSize, setPixelGridSize] = useState(8); // canvas units per cell
  const PIXEL_GRID_SIZES = [4, 8, 16, 32, 64];
  const [showPixelGridSizePicker, setShowPixelGridSizePicker] = useState(false);

  // ── Baseline grid overlay ──────────────────────────────────────────────────
  // Shows horizontal baseline lines for typography alignment
  const [showBaselineGrid, setShowBaselineGrid] = useState(false);
  const [baselineGridSize, setBaselineGridSize] = useState(8); // px per baseline unit

  // ── Viewport (zoom + pan) ──────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const spaceDownRef = useRef(false);

  // ── Canvas background color ────────────────────────────────────────────────
  const [canvasBgColor, setCanvasBgColor] = useState<string | null>(null); // null = use CSS var

  // ── Canvas background pattern ──────────────────────────────────────────────
  const [bgPattern, setBgPattern] = useState<'dots' | 'lines' | 'grid' | 'none'>('dots');
  const [showBgPatternPicker, setShowBgPatternPicker] = useState(false);

  // ── Column grid overlay ───────────────────────────────────────────────────
  // Shows vertical column guide overlays for layout alignment (e.g. 12-col Bootstrap)
  const [showColumnGrid, setShowColumnGrid] = useState(false);
  const [columnGridSettings, setColumnGridSettings] = useState({
    columns: 12,
    gutter: 24,   // gap between columns in canvas units
    margin: 80,   // left/right margin in canvas units
    color: 'rgba(99,102,241,0.08)',
  });
  const [showColumnGridSettings, setShowColumnGridSettings] = useState(false);

  // ── Minimap ────────────────────────────────────────────────────────────────
  const [showMinimap, setShowMinimap] = useState(true);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setViewportSize({ w: el.clientWidth, h: el.clientHeight }));
    obs.observe(el);
    setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // ── Snapping state ─────────────────────────────────────────────────────────
  const [snapLines, setSnapLines] = useState<{ x: number | null; y: number | null; xKind?: SnapKind; yKind?: SnapKind }>({ x: null, y: null });
  const [snapToGrid, setSnapToGrid] = useState(false);
  const GRID_SIZE = 8; // grid snap size in canvas units
  const snapToGridRef = useRef(snapToGrid);
  snapToGridRef.current = snapToGrid;

  // Grid-snap a single value to nearest multiple of GRID_SIZE
  const gridSnap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE;

  const dragRef = useRef<{
    type: 'draw' | 'move' | 'resize' | 'marquee';
    originX: number;
    originY: number;
    moved?: boolean; // for move: true once threshold crossed
    shapeId?: string;
    shapeSnapshot?: Shape;
    altDuplicated?: boolean; // true after alt-drag has fired onDuplicate
    altKey?: boolean; // was alt held at drag start
  } | null>(null);

  // Stable refs for pan/zoom so screenToCanvas never needs to recreate
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

  // Stable refs for rotation zone detection in mousemove
  const selectedShapeRef = useRef<Shape | null>(null);
  const activeToolRef = useRef(activeTool);
  selectedShapeRef.current = shapes.find(s => s.id === selectedId) ?? null;
  activeToolRef.current = activeTool;

  // Sync viewport changes to parent (for rulers, etc.)
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  useEffect(() => {
    onViewportChangeRef.current?.(zoom, pan.x, pan.y);
  }, [zoom, pan]);

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

  // ── Stable refs for nudge (arrow keys) ────────────────────────────────────
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const onShapeChangeRef = useRef(onShapeChange);
  onShapeChangeRef.current = onShapeChange;
  const onShapePreviewRef = useRef(onShapePreview);
  onShapePreviewRef.current = onShapePreview;
  // Tracks accumulated nudge delta per shape id: { id -> { x, y } }
  // We accumulate on keydown (preview), then commit final position on keyup
  const nudgeAccRef = useRef<Map<string, { baseX: number; baseY: number; dx: number; dy: number }>>(new Map());
  const nudgePendingRef = useRef(false);

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
      if (e.ctrlKey || e.metaKey || e.altKey) {
        // Ctrl/Meta/Alt+scroll = zoom toward cursor
        // Normalize deltaY: deltaMode 1 = lines (~20px each), 0 = pixels
        const rawDY = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
        // Clamp per-event delta so one mouse tick never jumps more than ~10%
        const clampedDY = Math.max(-60, Math.min(60, rawDY));
        const delta = -clampedDY * 0.0015;
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const z = zoomRef.current;
        const next = Math.min(8, Math.max(0.1, z * (1 + delta)));
        const ratio = next / z;
        setZoom(next);
        setPan(p => ({
          x: mx - (mx - p.x) * ratio,
          y: my - (my - p.y) * ratio,
        }));
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
      // Track cursor canvas position (always update, shown in bottom-left)
      {
        const cvs = screenToCanvas(e.clientX, e.clientY);
        setCursorPos({ x: Math.round(cvs.x), y: Math.round(cvs.y) });
      }

      // Update cursor for rotation zone (uses selectedShapeRef so no stale closure)
      if (overlayRef.current && !panningRef.current) {
        const rotShape = selectedShapeRef.current;
        const activeT = activeToolRef.current;
        if (rotShape && activeT === 'cursor') {
          const el = overlayRef.current;
          const rect = el.getBoundingClientRect();
          const z = zoomRef.current;
          const p = panRef.current;
          const left   = rotShape.x * z + p.x + rect.left;
          const top    = rotShape.y * z + p.y + rect.top;
          const right  = (rotShape.x + rotShape.width)  * z + p.x + rect.left;
          const bottom = (rotShape.y + rotShape.height) * z + p.y + rect.top;
          const OUTER = 20, INNER = 8;
          const inZone = ([
            [left, top], [right, top], [right, bottom], [left, bottom],
          ] as [number, number][]).some(([cx, cy]) => {
            const dx = Math.abs(e.clientX - cx);
            const dy = Math.abs(e.clientY - cy);
            return dx <= OUTER && dy <= OUTER && (dx > INNER || dy > INNER);
          });
          const RCURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpath d='M10 3 A7 7 0 1 1 4 15' fill='none' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M3.5 10 L1 14 L6 14Z' fill='white'/%3E%3C/svg%3E") 10 10, crosshair`;
          if (inZone) {
            el.style.cursor = RCURSOR;
          } else if (el.style.cursor === RCURSOR) {
            el.style.cursor = '';
          }
        }
      }

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
        if (snapToGridRef.current) {
          // Grid snap during draw
          const gx = gridSnap(x);
          const gy = gridSnap(y);
          setSnapLines({ x: gx, y: gy });
          onDrawUpdate(gx, gy, ox, oy);
        } else {
          // Snap current cursor to other shapes' edges while drawing
          const drawSnap = getSnapPoint(x, y, shapes, null, zoomRef.current);
          setSnapLines({ x: drawSnap.snapX, y: drawSnap.snapY });
          onDrawUpdate(drawSnap.x, drawSnap.y, ox, oy);
        }
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
          // Alt+drag: duplicate first, then move the original (duplicate stays at origin)
          if (dragRef.current.altKey && !dragRef.current.altDuplicated && dragRef.current.shapeId) {
            dragRef.current.altDuplicated = true;
            onDuplicate?.();
            // After duplicate, the NEW shape is selected — we want to move the original
            // So we let the normal move proceed; onDuplicate will have added a copy at the same position
          }
          // Start the move now that threshold is crossed
          if (dragRef.current.shapeId && dragRef.current.shapeSnapshot) {
            onMoveStart(dragRef.current.shapeId, dragRef.current.originX, dragRef.current.originY, dragRef.current.shapeSnapshot);
          }
        }
        // Smart edge-to-edge snap while moving
        const moving = shapes.find(s => s.id === selectedId);
        const movingSnapshot = dragRef.current.shapeSnapshot; // single Shape snapshot
        if (moving && movingSnapshot) {
          // Compute tentative new shape position based on cursor delta from drag origin
          const originX = dragRef.current.originX;
          const originY = dragRef.current.originY;
          let tentativeX = movingSnapshot.x + (x - originX);
          let tentativeY = movingSnapshot.y + (y - originY);
          if (snapToGridRef.current) {
            // Grid snap: snap the shape's top-left to grid
            tentativeX = gridSnap(tentativeX);
            tentativeY = gridSnap(tentativeY);
            setSnapLines({ x: tentativeX, y: tentativeY });
            const snappedCursorX = originX + (tentativeX - movingSnapshot.x);
            const snappedCursorY = originY + (tentativeY - movingSnapshot.y);
            onMove(snappedCursorX, snappedCursorY);
          } else {
            // Exclude all currently selected shapes from snap targets
            const excludeIds = selectedIds.length > 1 ? selectedIds : [selectedId ?? movingSnapshot.id];
            const snap = getSnapForMove(tentativeX, tentativeY, moving.width, moving.height, shapes, excludeIds, zoomRef.current);
            setSnapLines({ x: snap.snapX, y: snap.snapY, xKind: snap.snapXKind, yKind: snap.snapYKind });
            // Convert snapped shape position back to cursor space for onMove
            const snappedCursorX = originX + (snap.x - movingSnapshot.x);
            const snappedCursorY = originY + (snap.y - movingSnapshot.y);
            onMove(snappedCursorX, snappedCursorY);
          }
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

  // ── Guide line drag ────────────────────────────────────────────────────────
  const draggingGuideRef = useRef(draggingGuide);
  draggingGuideRef.current = draggingGuide;
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const dg = draggingGuideRef.current;
      if (!dg) return;
      const canvasPos = dg.type === 'h'
        ? (e.clientY - panRef.current.y) / zoomRef.current
        : (e.clientX - panRef.current.x) / zoomRef.current;
      setGuides(gs => gs.map(g => g.id === dg.id ? { ...g, pos: canvasPos } : g));
    };
    const onUp = (e: MouseEvent) => {
      const dg = draggingGuideRef.current;
      if (!dg) return;
      // If dragged off-screen (past 0 in screen space), remove the guide
      const screenPos = dg.type === 'h' ? e.clientY : e.clientX;
      if (screenPos < 20) {
        setGuides(gs => gs.filter(g => g.id !== dg.id));
      }
      setDraggingGuide(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);
  // Note: zoom is read from zoomRef.current (stable ref), so no need to include it in deps


  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      // Notify parent of any canvas interaction (used to auto-collapse chat bar)
      onCanvasPointerDown?.();

      // Space+drag or pan tool = pan
      if (spaceDownRef.current || activeTool === 'pan') {
        panningRef.current = true;
        panStartRef.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
        if (overlayRef.current) overlayRef.current.style.cursor = 'grabbing';
        return;
      }

      // Rotation zone — just outside corners of selected shape
      {
        const rotShape = selectedShapeRef.current;
        const el = overlayRef.current;
        if (rotShape && el) {
          const rect = el.getBoundingClientRect();
          const z = zoomRef.current;
          const p = panRef.current;
          const left   = rotShape.x * z + p.x + rect.left;
          const top    = rotShape.y * z + p.y + rect.top;
          const right  = (rotShape.x + rotShape.width)  * z + p.x + rect.left;
          const bottom = (rotShape.y + rotShape.height) * z + p.y + rect.top;
          const OUTER = 20, INNER = 8;
          const inZone = ([
            [left, top], [right, top], [right, bottom], [left, bottom],
          ] as [number, number][]).some(([cx, cy]) => {
            const dx = Math.abs(e.clientX - cx);
            const dy = Math.abs(e.clientY - cy);
            return dx <= OUTER && dy <= OUTER && (dx > INNER || dy > INNER);
          });
          if (inZone) {
            const { x, y } = screenToCanvas(e.clientX, e.clientY);
            dragRef.current = { type: 'resize', originX: x, originY: y };
            onResizeStart(rotShape.id, 'rotate', x, y, rotShape);
            return;
          }
        }
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
    [activeTool, screenToCanvas, onDrawStart, onSelect, onPenClick, onPenCommit, onCanvasPointerDown, onResizeStart] // pan/zoom/selectedShape read from refs
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
      dragRef.current = { type: 'move', originX: x, originY: y, moved: false, shapeId: shape.id, shapeSnapshot: shape, altKey: e.altKey, altDuplicated: false };
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
  const [zoomInputActive, setZoomInputActive] = useState(false);
  const [zoomInputVal, setZoomInputVal] = useState('');
  const zoomInputRef = useRef<HTMLInputElement>(null);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 300, 400];

  const applyZoomPreset = useCallback((pct: number) => {
    const z = pct / 100;
    setZoom(z);
    setPan(p => {
      const el = overlayRef.current;
      if (!el) return p;
      const rect = el.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return {
        x: cx - (cx - p.x) * (z / zoom),
        y: cy - (cy - p.y) * (z / zoom),
      };
    });
    setShowZoomMenu(false);
  }, [zoom]);

  // Cursor canvas coordinates (shown in bottom-left)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

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

  // Zoom to fit a set of bounding box items in view
  const zoomToBBox = useCallback((items: Shape[], pad = 60) => {
    if (items.length === 0) { zoomReset(); return; }
    const el = overlayRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minX = Math.min(...items.map(s => s.x));
    const minY = Math.min(...items.map(s => s.y));
    const maxX = Math.max(...items.map(s => s.x + s.width));
    const maxY = Math.max(...items.map(s => s.y + s.height));
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
  }, [zoomReset]);

  // Zoom to fit all shapes in view
  const zoomToFit = useCallback(() => {
    zoomToBBox(shapes);
  }, [shapes, zoomToBBox]);

  // Zoom to fit selected shapes
  const zoomToSelection = useCallback(() => {
    const sel = shapes.filter(s => selectedIds.includes(s.id) || s.id === selectedId);
    if (sel.length === 0) zoomToFit();
    else zoomToBBox(sel, 80);
  }, [shapes, selectedIds, selectedId, zoomToBBox, zoomToFit]);

  // Zoom to fit — double-click canvas bg
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== overlayRef.current) return;
    if (shapes.length > 0) zoomToFit();
    else zoomReset();
  }, [shapes, zoomToFit, zoomReset]);

  // Zoom to specific shape — triggered by layers panel focus button via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      const shape = shapes.find(s => s.id === id);
      if (shape) zoomToBBox([shape], 80);
    };
    window.addEventListener('quill:zoom-to-shape', handler);
    return () => window.removeEventListener('quill:zoom-to-shape', handler);
  }, [shapes, zoomToBBox]);

  // canvas:setzoom — used by CanvasStatusBar zoom dropdown
  useEffect(() => {
    const handler = (e: Event) => {
      const z = (e as CustomEvent<{ zoom: number }>).detail?.zoom;
      if (!z || z <= 0) return;
      const el = overlayRef.current;
      if (!el) { setZoom(z); setPan({ x: 0, y: 0 }); return; }
      const rect = el.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      // Zoom toward canvas center
      setPan(p => ({
        x: cx - (cx - p.x) * (z / zoomRef.current),
        y: cy - (cy - p.y) * (z / zoomRef.current),
      }));
      setZoom(z);
    };
    window.addEventListener('canvas:setzoom', handler);
    return () => window.removeEventListener('canvas:setzoom', handler);
  }, []);

  // canvas:panto — used by MinimapNavigator to pan the viewport
  useEffect(() => {
    const handler = (e: Event) => {
      const { panX, panY } = (e as CustomEvent<{ panX: number; panY: number }>).detail ?? {};
      if (panX == null || panY == null) return;
      setPan({ x: panX, y: panY });
    };
    window.addEventListener('canvas:panto', handler);
    return () => window.removeEventListener('canvas:panto', handler);
  }, []);

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

      // ── Arrow-key nudge ──────────────────────────────────────────────────────
      if (!mod && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const ids = selectedIdsRef.current.length > 0 ? selectedIdsRef.current : (selectedIdRef.current ? [selectedIdRef.current] : []);
        if (ids.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          const delta = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
          const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;
          for (const id of ids) {
            const s = shapesRef.current.find(sh => sh.id === id);
            if (!s) continue;
            // On first keydown for this shape, record base position
            if (!nudgeAccRef.current.has(id)) {
              nudgeAccRef.current.set(id, { baseX: s.x, baseY: s.y, dx: 0, dy: 0 });
            }
            const acc = nudgeAccRef.current.get(id)!;
            acc.dx += dx;
            acc.dy += dy;
            onShapePreviewRef.current?.(id, { x: acc.baseX + acc.dx, y: acc.baseY + acc.dy });
          }
          nudgePendingRef.current = true;
          return;
        }
      }

      // ── Copy / Paste Style (Cmd+Alt+C / Cmd+Alt+V) ──────────────────────────
      if (mod && e.altKey) {
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault(); e.stopPropagation();
          const id = selectedIdRef.current;
          const shape = id ? shapesRef.current.find(s => s.id === id) : null;
          if (shape) {
            const clip: StyleClip = {
              fill: shape.fill, fillType: shape.fillType, fillOpacity: shape.fillOpacity,
              stroke: shape.stroke, strokeWidth: shape.strokeWidth, strokeDash: shape.strokeDash,
              opacity: shape.opacity, shadow: shape.shadow, shadowColor: shape.shadowColor,
              shadowX: shape.shadowX, shadowY: shape.shadowY, shadowBlur: shape.shadowBlur,
              borderRadius: shape.borderRadius, color: shape.color, fontSize: shape.fontSize,
              fontWeight: shape.fontWeight, fontFamily: shape.fontFamily,
              gradientStops: shape.gradientStops, gradientAngle: shape.gradientAngle,
            };
            styleClipboardRef.current = clip;
            setStyleClipboard(clip);
          }
          return;
        }
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault(); e.stopPropagation();
          const clip = styleClipboardRef.current;
          if (!clip) return;
          const ids = selectedIdsRef.current.length > 0 ? selectedIdsRef.current : (selectedIdRef.current ? [selectedIdRef.current] : []);
          for (const id of ids) {
            onShapeChangeRef.current?.(id, clip);
          }
          return;
        }
      }

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
          if (e.shiftKey) zoomToFit();
          else zoomToFit();
        } else if (e.key === '2' && e.shiftKey) {
          e.preventDefault();
          zoomToSelection();
        } else if (e.key.toLowerCase() === 'g' && !e.shiftKey) {
          // Toggle grid snap
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            setSnapToGrid(s => !s);
          }
        } else if (e.key.toLowerCase() === 'g' && e.shiftKey) {
          // Shift+G: toggle pixel grid overlay
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault();
            setShowPixelGrid(p => !p);
          }
        } else if (e.key === 'r' && e.shiftKey) {
          // Shift+R: toggle rulers
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault();
            setShowRulers(r => !r);
          }
        } else if (e.key.toLowerCase() === 'c' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
          // Shift+C: toggle column grid overlay
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault();
            setShowColumnGrid(c => !c);
          }
        } else if (e.key.toLowerCase() === 'b' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
          // Shift+B: toggle baseline grid overlay
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault();
            setShowBaselineGrid(b => !b);
          }
        } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'w') {
          // Cmd+Shift+W: toggle wireframe mode
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault();
            setWireframeMode(w => !w);
          }
        } else if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && e.shiftKey) {
          // Shift+F: toggle focus/spotlight mode (dim non-selected shapes)
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault();
            setFocusMode(f => !f);
          }
        } else if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
          // M: toggle minimap
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault();
            setShowMinimap(m => !m);
          }
        }
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        if (overlayRef.current) overlayRef.current.style.cursor = '';
      }
      // Commit nudge to history when arrow key released
      if (nudgePendingRef.current && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        nudgePendingRef.current = false;
        for (const [id, acc] of nudgeAccRef.current.entries()) {
          onShapeChangeRef.current?.(id, { x: acc.baseX + acc.dx, y: acc.baseY + acc.dy });
        }
        nudgeAccRef.current.clear();
      }
    };
    // Use capture:true so this fires before App.tsx's keydown handler, allowing stopImmediatePropagation
    window.addEventListener('keydown', onDown, { capture: true });
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown, { capture: true }); window.removeEventListener('keyup', onUp); };
  }, [zoomIn, zoomOut, zoomReset, zoomToFit, zoomToSelection, onDrawCancel]);

  // Background pattern — moves with pan/zoom
  // When grid snap is active, show 8px tight grid. Otherwise use bgPattern setting.
  const gridSpacing = snapToGrid ? GRID_SIZE : (zoom >= 0.5 ? 24 : 96);
  const gridX = ((pan.x % (gridSpacing * zoom)) + gridSpacing * zoom) % (gridSpacing * zoom);
  const gridY = ((pan.y % (gridSpacing * zoom)) + gridSpacing * zoom) % (gridSpacing * zoom);
  const dotSize = snapToGrid
    ? Math.max(0.5, Math.min(1.5, zoom))
    : zoom < 0.5
      ? Math.max(1, Math.min(2.5, zoom * 5))    // larger dots at very low zoom
      : Math.max(1, Math.min(2.5, zoom * 1.5));  // standard scaling

  // Compute background-image based on pattern type
  const dotColor = canvasBgColor ? 'rgba(0,0,0,0.08)' : 'var(--canvas-dot)';
  const computedBgImage = (() => {
    if (hasIframeContent || bgPattern === 'none') return 'none';
    const lineColor = canvasBgColor ? 'rgba(0,0,0,0.06)' : 'var(--canvas-dot)';
    switch (bgPattern) {
      case 'dots':
        return `radial-gradient(circle, ${dotColor} ${dotSize}px, transparent ${dotSize}px)`;
      case 'lines':
        return `repeating-linear-gradient(0deg, transparent, transparent ${gridSpacing * zoom - 1}px, ${lineColor} ${gridSpacing * zoom - 1}px, ${lineColor} ${gridSpacing * zoom}px)`;
      case 'grid':
        return [
          `repeating-linear-gradient(0deg, transparent, transparent ${gridSpacing * zoom - 1}px, ${lineColor} ${gridSpacing * zoom - 1}px, ${lineColor} ${gridSpacing * zoom}px)`,
          `repeating-linear-gradient(90deg, transparent, transparent ${gridSpacing * zoom - 1}px, ${lineColor} ${gridSpacing * zoom - 1}px, ${lineColor} ${gridSpacing * zoom}px)`,
        ].join(', ');
      default:
        return 'none';
    }
  })();

  // In selection mode, let pointer events pass through to the iframe
  const isSelectionPassthrough = activeTool === 'select';

  return (
    <div
      ref={overlayRef}
      onMouseDown={isSelectionPassthrough ? undefined : handleOverlayMouseDown}
      onDoubleClick={isSelectionPassthrough ? undefined : handleDoubleClick}
      onContextMenu={isSelectionPassthrough ? undefined : handleOverlayContextMenu}
      onMouseLeave={() => setCursorPos(null)}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: isInteracting ? (isDraggingMove ? 'grabbing' : 'crosshair') : toolCursor(activeTool, false),
        zIndex: 10,
        background: hasIframeContent ? 'transparent' : (canvasBgColor ?? 'var(--canvas-bg)'),
        backgroundImage: computedBgImage,
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
            if (s.hidden) return null;
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
            const hr = 3.5 / zoom; // handle dot radius
            const ar = 4.5 / zoom; // anchor dot radius
            // Close-path hover: cursor near first point when ≥3 points placed
            const canClose = penPoints.length >= 3;
            const closeSnapRadius = 12 / zoom;
            const nearFirst = canClose && penCursor && !isPulling && penDragPointIndex === null &&
              Math.hypot(penCursor.x - penPoints[0].x, penCursor.y - penPoints[0].y) < closeSnapRadius;
            // Build preview path — shows the actual curve that would result from clicking at cursor.
            // If the last placed node has an out-handle (cp2), use it as the outgoing control point
            // of the preview segment. The cursor itself has no handles yet so c2 = cursor position.
            let previewPts = penPoints;
            if (showCursor && !nearFirst) {
              previewPts = [...penPoints, { x: penCursor!.x, y: penCursor!.y }];
            }
            const d = buildPathD(previewPts, nearFirst ? true : false);

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
                        cx={pt.x} cy={pt.y} r={i === 0 && nearFirst ? ar * 1.8 : ar}
                        fill={i === 0 && nearFirst ? '#6366f1' : (penDragPointIndex === i ? '#6366f1' : 'white')}
                        stroke={i === 0 && nearFirst ? '#ffffff' : '#6366f1'}
                        strokeWidth={(i === 0 && nearFirst ? 2 : 1.5) / zoom}
                        style={{ pointerEvents: 'all', cursor: i === 0 && canClose ? 'pointer' : 'move' }}
                        onMouseDown={(e) => {
                          e.stopPropagation(); e.preventDefault();
                          if (i === 0 && canClose) { onPenCommit?.(true); }
                          else { onPenStartDragPoint?.(i); }
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as SVGCircleElement).setAttribute('fill', '#a5b4fc'); }}
                        onMouseLeave={(e) => { (e.currentTarget as SVGCircleElement).setAttribute('fill', i === 0 && nearFirst ? '#6366f1' : (penDragPointIndex === i ? '#6366f1' : 'white')); }}
                      />
                    </g>
                  );
                })}

                {/* Cursor ghost dot — hidden when snapping to close */}
                {showCursor && !nearFirst && (
                  <circle cx={penCursor!.x} cy={penCursor!.y} r={ar}
                    fill="#6366f1" opacity={0.5} style={{ pointerEvents: 'none' }} />
                )}
              </g>
            );
          })()}
        </svg>

        {/* Hover outline + name label for non-selected shapes */}
        {activeTool === 'cursor' && hoveredShapeId && hoveredShapeId !== selectedId && !selectedIds.includes(hoveredShapeId) && (() => {
          const h = shapes.find(s => s.id === hoveredShapeId && !s.hidden && !s.locked);
          if (!h || h.type === 'path') return null;
          const br = typeof h.borderRadius === 'number' ? h.borderRadius : 0;
          const labelFontSize = Math.max(8, Math.min(12, 11 / zoom));
          return (
            <>
              {/* Hover outline — 1px screen-space */}
              <div style={{
                position: 'absolute',
                left: h.x, top: h.y, width: h.width, height: h.height,
                border: `${1 / zoom}px solid rgba(99,102,241,0.6)`,
                borderRadius: br + 'px',
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }} />
            </>
          );
        })()}

        {/* Committed shapes — visual render + hit target */}
        {shapes.filter(s => s.type !== 'path').map((shape) => {
          const isEditing = editingId === shape.id;
          const isHidden = shape.hidden ?? false;
          const isLocked = shape.locked ?? false;
          const interactive = activeTool === 'cursor' && !isHidden && !isLocked;
          const isSelected = shape.id === selectedId || selectedIds.includes(shape.id);
          const isFocusDimmed = focusMode && !isSelected && (selectedId !== null || selectedIds.length > 0);
          // ── Clip mask: clip this shape to another shape's bounds ────────────────
          let clipPathStyle: React.CSSProperties = {};
          // Custom clip-path polygon from ClipPathEditor (takes priority over clipMaskId)
          if (shape.clipPath && !wireframeMode) {
            clipPathStyle = { clipPath: shape.clipPath };
          } else if (shape.clipMaskId && !wireframeMode) {
            const maskShape = shapes.find(s => s.id === shape.clipMaskId);
            if (maskShape) {
              // Compute relative offset from shape origin to mask shape
              const relX = maskShape.x - shape.x;
              const relY = maskShape.y - shape.y;
              if (maskShape.type === 'ellipse') {
                // Use SVG ellipse clip via clip-path polygon approximation
                // For ellipse, generate path
                const rx = maskShape.width / 2;
                const ry = maskShape.height / 2;
                const cx = relX + rx;
                const cy = relY + ry;
                const steps = 64;
                const pts = Array.from({ length: steps }, (_, i) => {
                  const angle = (i / steps) * Math.PI * 2;
                  const px = cx + Math.cos(angle) * rx;
                  const py = cy + Math.sin(angle) * ry;
                  return `${px}px ${py}px`;
                });
                clipPathStyle = { clipPath: `polygon(${pts.join(', ')})` };
              } else {
                // Rectangle / rounded rectangle
                const br = typeof maskShape.borderRadius === 'number' ? maskShape.borderRadius : 0;
                const rr = Math.min(br, maskShape.width / 2, maskShape.height / 2);
                // Use inset() for rect clip — relX/Y offset from shape's top-left
                const top = relY;
                const right = shape.width - (relX + maskShape.width);
                const bottom = shape.height - (relY + maskShape.height);
                const left = relX;
                clipPathStyle = { clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round ${rr}px)` };
              }
            }
          }
          // ── Mask shapes: render semi-transparent with dashed outline ──────────
          const isMaskShape = shape.isMask === true;

          return (
            <div
              key={shape.id}
              onMouseDown={interactive ? (e) => handleShapeMouseDown(e, shape) : undefined}
              onDoubleClick={interactive ? (e) => handleShapeDoubleClick(e, shape) : undefined}
              onContextMenu={interactive ? (e) => handleShapeContextMenu(e, shape) : undefined}
              onMouseEnter={!isHidden ? () => setHoveredShapeId(shape.id) : undefined}
              onMouseLeave={!isHidden ? () => setHoveredShapeId(null) : undefined}
              style={{
                ...buildShapeStyle(shape),
                // Clip mask
                ...clipPathStyle,
                // Mask shapes: show as semi-transparent outline (click-through)
                ...(isMaskShape && !wireframeMode ? {
                  opacity: 0.25,
                  background: 'rgba(99,102,241,0.1)',
                  border: `${1.5 / zoom}px dashed rgba(99,102,241,0.6)`,
                  pointerEvents: 'none',
                } : {}),
                // Focus mode: dim non-selected shapes
                ...(isFocusDimmed ? {
                  opacity: (shape.opacity ?? 1) * 0.15,
                  transition: 'opacity 0.2s',
                } : focusMode ? { transition: 'opacity 0.2s' } : {}),
                // Wireframe mode overrides
                ...(wireframeMode ? {
                  background: 'transparent',
                  backgroundColor: 'transparent',
                  backgroundImage: 'none',
                  border: `1px solid var(--accent)`,
                  boxShadow: 'none',
                  filter: 'none',
                  opacity: 1,
                  color: 'var(--accent)',
                } : {}),
                cursor: isLocked ? 'default' : (isEditing ? 'text' : (activeTool === 'cursor' ? (altKeyDown && !isEditing ? 'copy' : 'move') : 'crosshair')),
                pointerEvents: (interactive && !isMaskShape) ? 'all' : 'none',
                visibility: isHidden ? 'hidden' : 'visible',
              }}
            >
              {shape.type === 'text' && !isEditing && (
                <span style={{ pointerEvents: 'none', width: '100%', textAlign: shape.textAlign as 'left' | 'center' | 'right' }}>{shape.text}</span>
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
              {/* Auto-layout badge — fixed screen size, shown when selected */}
              {shape.layout !== 'none' && !isEditing && (selectedId === shape.id || selectedIds.includes(shape.id)) && (
                <div style={{
                  position: 'absolute',
                  bottom: 6 / zoom,
                  right: 6 / zoom,
                  width: 18 / zoom,
                  height: 18 / zoom,
                  background: 'rgba(99,102,241,0.9)',
                  borderRadius: 4 / zoom,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  backdropFilter: 'blur(2px)',
                }}>
                  <svg
                    width={10 / zoom}
                    height={10 / zoom}
                    viewBox="0 0 10 10"
                    fill="none"
                    style={{ pointerEvents: 'none' }}
                  >
                    {shape.layout === 'row' ? (
                      // Horizontal arrows
                      <path d="M1 5h8M6 2l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    ) : (
                      // Vertical arrows
                      <path d="M5 1v8M2 6l3 3 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    )}
                  </svg>
                </div>
              )}
              {/* Notes badge — shown on shapes with developer notes */}
              {shape.notes && !wireframeMode && hoveredShapeId === shape.id && (
                <div
                  style={{
                    position: 'absolute',
                    top: Math.max(2, 4 / zoom),
                    left: Math.max(2, 4 / zoom),
                    background: 'rgba(251,191,36,0.9)',
                    backdropFilter: 'blur(4px)',
                    borderRadius: Math.max(2, 3 / zoom),
                    padding: `${Math.max(1, 2 / zoom)}px ${Math.max(2, 4 / zoom)}px`,
                    pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', gap: Math.max(2, 3 / zoom),
                    maxWidth: Math.max(120, 200 / zoom),
                    zIndex: 5,
                  }}
                >
                  <svg width={Math.max(6, 9 / zoom)} height={Math.max(6, 9 / zoom)} viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M1 9L1.5 6.5L7 1L9 3L3.5 8.5L1 9Z" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 2.5L7.5 4" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                  <span style={{
                    fontSize: Math.max(8, 10 / zoom), color: 'white', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                  }}>
                    {shape.notes.length > 40 ? shape.notes.slice(0, 40) + '…' : shape.notes}
                  </span>
                </div>
              )}

              {/* Prototype link badge — shown on shapes with protoLink */}
              {shape.protoLink && !wireframeMode && (
                <div style={{
                  position: 'absolute',
                  bottom: Math.max(2, 4 / zoom),
                  left: Math.max(2, 4 / zoom),
                  background: 'rgba(99,102,241,0.9)',
                  borderRadius: Math.max(2, 4 / zoom),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: `${Math.max(1, 2 / zoom)}px ${Math.max(2, 4 / zoom)}px`,
                  pointerEvents: 'none',
                  gap: Math.max(1, 2 / zoom),
                }}>
                  <svg width={Math.max(6, 8 / zoom)} height={Math.max(6, 8 / zoom)} viewBox="0 0 8 8" fill="none">
                    <path d="M1 4h6M4 1l3 3-3 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}

              {/* Icon overlay — renders Lucide icon centred in shape */}
              {shape.iconId && !wireframeMode && (() => {
                const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; stroke?: string; style?: React.CSSProperties }>>)[shape.iconId];
                if (!IconComp) return null;
                const iconPx = shape.iconSize ?? Math.min(shape.width, shape.height) * 0.6;
                return (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <IconComp
                      size={iconPx / zoom}
                      stroke={shape.iconColor ?? 'currentColor'}
                      style={{ display: 'block', flexShrink: 0 }}
                    />
                  </div>
                );
              })()}

              {/* Lock badge — shown when locked and hovered, or always visible when very small */}
              {isLocked && hoveredShapeId === shape.id && (
                <div style={{
                  position: 'absolute',
                  top: Math.max(2, 4 / zoom),
                  right: Math.max(2, 4 / zoom),
                  width: Math.max(12, 18 / zoom),
                  height: Math.max(12, 18 / zoom),
                  background: 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: Math.max(2, 4 / zoom),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <svg
                    width={Math.max(8, 11 / zoom)}
                    height={Math.max(8, 11 / zoom)}
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{ color: 'rgba(255,255,255,0.9)' }}
                  >
                    <rect x="2" y="5" width="8" height="6" rx="1.5" fill="currentColor" />
                    <path d="M4 5V3.5a2 2 0 1 1 4 0V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
              )}
              {/* Gradient stroke overlay — SVG rendered on top of shape when strokeGradientStops is set */}
              {shape.strokeGradientStops && shape.strokeGradientStops.length >= 2 && shape.strokeWidth > 0 && !wireframeMode && (() => {
                const sw = shape.strokeWidth;
                const w = shape.width;
                const h = shape.height;
                const gradId = `sg-${shape.id}`;
                const angle = shape.strokeGradientAngle ?? 135;
                const rad = (angle * Math.PI) / 180;
                const gx1 = 50 - Math.cos(rad) * 50;
                const gy1 = 50 - Math.sin(rad) * 50;
                const gx2 = 50 + Math.cos(rad) * 50;
                const gy2 = 50 + Math.sin(rad) * 50;
                const stops = shape.strokeGradientStops;
                // Compute border-radius for SVG rect
                const br = Array.isArray(shape.borderRadius) ? shape.borderRadius[0] : (shape.borderRadius ?? 0);
                const pos = shape.strokePosition ?? 'center';
                const inset = pos === 'inside' ? sw / 2 : pos === 'outside' ? -sw / 2 : 0;
                const rx = Math.max(0, (typeof br === 'number' ? br : 0) - inset);
                return (
                  <svg
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
                    viewBox={`0 0 ${w} ${h}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id={gradId} x1={`${gx1}%`} y1={`${gy1}%`} x2={`${gx2}%`} y2={`${gy2}%`} gradientUnits="userSpaceOnUse">
                        {stops.map((st, i) => (
                          <stop key={i} offset={`${st.position * 100}%`} stopColor={st.color} stopOpacity={st.opacity ?? 1} />
                        ))}
                      </linearGradient>
                    </defs>
                    {shape.type === 'ellipse' ? (
                      <ellipse
                        cx={w / 2} cy={h / 2} rx={w / 2 - (pos === 'inside' ? sw / 2 : pos === 'outside' ? -sw / 2 : 0)} ry={h / 2 - (pos === 'inside' ? sw / 2 : pos === 'outside' ? -sw / 2 : 0)}
                        fill="none"
                        stroke={`url(#${gradId})`}
                        strokeWidth={sw}
                      />
                    ) : (
                      <rect
                        x={pos === 'inside' ? sw / 2 : pos === 'outside' ? -sw / 2 : 0}
                        y={pos === 'inside' ? sw / 2 : pos === 'outside' ? -sw / 2 : 0}
                        width={pos === 'inside' ? w - sw : pos === 'outside' ? w + sw : w}
                        height={pos === 'inside' ? h - sw : pos === 'outside' ? h + sw : h}
                        rx={rx}
                        fill="none"
                        stroke={`url(#${gradId})`}
                        strokeWidth={sw}
                      />
                    )}
                  </svg>
                );
              })()}

              {/* Scroll direction badge — shown on scrollable frames */}
              {shape.type === 'frame' && shape.scrollDirection && shape.scrollDirection !== 'none' && (
                <div style={{
                  position: 'absolute',
                  bottom: Math.max(2, 4 / zoom),
                  left: Math.max(2, 4 / zoom),
                  background: 'rgba(99,102,241,0.75)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: Math.max(2, 3 / zoom),
                  padding: `${Math.max(1, 2 / zoom)}px ${Math.max(2, 4 / zoom)}px`,
                  fontSize: Math.max(7, 9 / zoom),
                  color: 'white',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  pointerEvents: 'none',
                  lineHeight: 1,
                  letterSpacing: '0.03em',
                }}>
                  {shape.scrollDirection === 'vertical' ? '↕' : shape.scrollDirection === 'horizontal' ? '↔' : '⤢'} scroll
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
                onGradientAngleChange={(angle) => onShapePreview?.(selectedShape.id, { gradientAngle: angle })}
                onGradientAngleCommit={(angle) => onShapeChange?.(selectedShape.id, { gradientAngle: angle })}
              />
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

        {/* Snap lines — convert canvas coords → screen coords */}
        {/* Edge snaps: amber (#f59e0b) · Center snaps: purple (#a855f7) */}
        {snapLines.x !== null && (() => {
          const sx = snapLines.x * zoom + pan.x;
          const isCenterSnap = snapLines.xKind === 'center';
          const snapColor = isCenterSnap ? '#a855f7' : '#f59e0b';
          return (
            <>
              <div style={{
                position: 'absolute',
                left: sx,
                top: 0,
                width: isCenterSnap ? 1.5 : 1,
                height: '100%',
                background: snapColor,
                opacity: isCenterSnap ? 0.85 : 0.7,
                pointerEvents: 'none',
                boxShadow: isCenterSnap ? `0 0 4px ${snapColor}` : 'none',
              }} />
              <div style={{
                position: 'absolute',
                left: sx + 5,
                top: 10,
                background: snapColor,
                color: isCenterSnap ? '#fff' : '#000',
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: 3,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}>
                {isCenterSnap ? '⊕ ' : ''}x {Math.round(snapLines.x)}
              </div>
            </>
          );
        })()}
        {snapLines.y !== null && (() => {
          const sy = snapLines.y * zoom + pan.y;
          const isCenterSnap = snapLines.yKind === 'center';
          const snapColor = isCenterSnap ? '#a855f7' : '#f59e0b';
          return (
            <>
              <div style={{
                position: 'absolute',
                left: 0,
                top: sy,
                width: '100%',
                height: isCenterSnap ? 1.5 : 1,
                background: snapColor,
                opacity: isCenterSnap ? 0.85 : 0.7,
                pointerEvents: 'none',
                boxShadow: isCenterSnap ? `0 0 4px ${snapColor}` : 'none',
              }} />
              <div style={{
                position: 'absolute',
                left: 10,
                top: sy + 5,
                background: snapColor,
                color: isCenterSnap ? '#fff' : '#000',
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: 3,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}>
                {isCenterSnap ? '⊕ ' : ''}y {Math.round(snapLines.y)}
              </div>
            </>
          );
        })()}

        {/* ── Alt measurement overlay ────────────────────────────────────── */}
        {altKeyDown && selectedShape && hoveredShapeId && hoveredShapeId !== selectedId && (() => {
          const hover = shapes.find(s => s.id === hoveredShapeId);
          if (!hover) return null;
          const sel = selectedShape;
          // Compute horizontal gap (left or right)
          const selRight = sel.x + sel.width;
          const hoverRight = hover.x + hover.width;
          const gapLeft = sel.x - hoverRight;   // positive = sel is to the right
          const gapRight = hover.x - selRight;  // positive = hover is to the right
          // Compute vertical gap
          const selBottom = sel.y + sel.height;
          const hoverBottom = hover.y + hover.height;
          const gapTop = sel.y - hoverBottom;   // positive = sel is below
          const gapBottom = hover.y - selBottom; // positive = hover is below

          const measurements: React.ReactNode[] = [];
          const lineColor = '#f59e0b';
          const labelBg = '#f59e0b';

          // Helper: measurement line + label
          const measureH = (x1: number, x2: number, midY: number, dist: number, key: string) => {
            if (dist <= 0) return null;
            const midX = (x1 + x2) / 2;
            return (
              <g key={key} style={{ pointerEvents: 'none' }}>
                <line x1={x1} y1={midY} x2={x2} y2={midY} stroke={lineColor} strokeWidth={1 / zoom} strokeDasharray={`${3/zoom},${2/zoom}`} />
                <line x1={x1} y1={midY - 4/zoom} x2={x1} y2={midY + 4/zoom} stroke={lineColor} strokeWidth={1 / zoom} />
                <line x1={x2} y1={midY - 4/zoom} x2={x2} y2={midY + 4/zoom} stroke={lineColor} strokeWidth={1 / zoom} />
                <foreignObject x={midX - 18/zoom} y={midY - 9/zoom} width={36/zoom} height={12/zoom} style={{ pointerEvents: 'none' }}>
                  <div style={{
                    background: labelBg, color: '#000', fontSize: 8/zoom, fontFamily: 'monospace',
                    fontWeight: 700, padding: `${1/zoom}px ${3/zoom}px`, borderRadius: 2/zoom,
                    textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1,
                  }}>
                    {Math.round(dist)}
                  </div>
                </foreignObject>
              </g>
            );
          };

          const measureV = (y1: number, y2: number, midX: number, dist: number, key: string) => {
            if (dist <= 0) return null;
            const midY = (y1 + y2) / 2;
            return (
              <g key={key} style={{ pointerEvents: 'none' }}>
                <line x1={midX} y1={y1} x2={midX} y2={y2} stroke={lineColor} strokeWidth={1 / zoom} strokeDasharray={`${3/zoom},${2/zoom}`} />
                <line x1={midX - 4/zoom} y1={y1} x2={midX + 4/zoom} y2={y1} stroke={lineColor} strokeWidth={1 / zoom} />
                <line x1={midX - 4/zoom} y1={y2} x2={midX + 4/zoom} y2={y2} stroke={lineColor} strokeWidth={1 / zoom} />
                <foreignObject x={midX + 4/zoom} y={midY - 6/zoom} width={36/zoom} height={12/zoom} style={{ pointerEvents: 'none' }}>
                  <div style={{
                    background: labelBg, color: '#000', fontSize: 8/zoom, fontFamily: 'monospace',
                    fontWeight: 700, padding: `${1/zoom}px ${3/zoom}px`, borderRadius: 2/zoom,
                    textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1,
                  }}>
                    {Math.round(dist)}
                  </div>
                </foreignObject>
              </g>
            );
          };

          // Horizontal distance
          const midY = Math.max(sel.y, hover.y) + (Math.min(selBottom, hoverBottom) - Math.max(sel.y, hover.y)) / 2;
          if (gapLeft > 0) measurements.push(measureH(hoverRight, sel.x, midY, gapLeft, 'h-gap-left'));
          if (gapRight > 0) measurements.push(measureH(selRight, hover.x, midY, gapRight, 'h-gap-right'));

          // Vertical distance
          const midX = Math.max(sel.x, hover.x) + (Math.min(selRight, hoverRight) - Math.max(sel.x, hover.x)) / 2;
          if (gapTop > 0) measurements.push(measureV(hoverBottom, sel.y, midX, gapTop, 'v-gap-top'));
          if (gapBottom > 0) measurements.push(measureV(selBottom, hover.y, midX, gapBottom, 'v-gap-bottom'));

          // Highlight the hovered shape outline
          return (
            <>
              <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                {/* Hover outline */}
                <rect x={hover.x} y={hover.y} width={hover.width} height={hover.height}
                  fill="none" stroke={lineColor} strokeWidth={1 / zoom} strokeDasharray={`${4/zoom},${3/zoom}`} opacity={0.8} />
                {measurements}
              </svg>
            </>
          );
        })()}

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

        {/* Position label while moving */}
        {isDraggingMove && selectedShape && (
          <div style={{
            position: 'absolute',
            left: selectedShape.x + selectedShape.width / 2,
            top: selectedShape.y - 20,
            transform: 'translateX(-50%)',
            background: 'rgba(30,30,40,0.92)',
            color: '#a5b4fc',
            fontSize: 11,
            fontFamily: 'monospace',
            padding: '2px 7px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            border: '1px solid rgba(99,102,241,0.3)',
          }}>
            {Math.round(selectedShape.x)}, {Math.round(selectedShape.y)}
          </div>
        )}

        {/* Size label while resizing */}
        {isDraggingResize && selectedShape && (
          <div style={{
            position: 'absolute',
            left: selectedShape.x + selectedShape.width / 2,
            top: selectedShape.y + selectedShape.height + 4,
            transform: 'translateX(-50%)',
            background: 'rgba(30,30,40,0.92)',
            color: '#a5b4fc',
            fontSize: 11,
            fontFamily: 'monospace',
            padding: '2px 7px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            border: '1px solid rgba(99,102,241,0.3)',
          }}>
            {Math.round(selectedShape.width)} × {Math.round(selectedShape.height)}
          </div>
        )}
      </div>

      {/* ── Rulers ──────────────────────────────────────────────────────────── */}
      {showRulers && (
        <CanvasRulers
          zoom={zoom}
          pan={pan}
          rulerSize={RULER_SIZE}
          onStartGuideH={(screenY) => {
            const canvasPos = (screenY - pan.y) / zoom;
            const id = Math.random().toString(36).slice(2);
            setGuides(gs => [...gs, { id, type: 'h', pos: canvasPos }]);
            setDraggingGuide({ id, type: 'h', startScreen: screenY });
          }}
          onStartGuideV={(screenX) => {
            const canvasPos = (screenX - pan.x) / zoom;
            const id = Math.random().toString(36).slice(2);
            setGuides(gs => [...gs, { id, type: 'v', pos: canvasPos }]);
            setDraggingGuide({ id, type: 'v', startScreen: screenX });
          }}
        />
      )}

      {/* ── Guide lines ──────────────────────────────────────────────────────── */}
      {guides.length > 0 && (
        <>
          {guides.map(guide => {
            const screenPos = guide.type === 'h'
              ? guide.pos * zoom + pan.y
              : guide.pos * zoom + pan.x;
            const isDraggingThis = draggingGuide?.id === guide.id;
            return (
              <div
                key={guide.id}
                title={`Guide at ${Math.round(guide.pos)}px — drag to move, double-click to delete`}
                onDoubleClick={() => setGuides(gs => gs.filter(g => g.id !== guide.id))}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingGuide({ id: guide.id, type: guide.type, startScreen: guide.type === 'h' ? e.clientY : e.clientX });
                }}
                style={{
                  position: 'absolute',
                  ...(guide.type === 'h' ? {
                    left: 0, right: 0,
                    top: screenPos - 1,
                    height: 1,
                    cursor: 'ns-resize',
                  } : {
                    top: 0, bottom: 0,
                    left: screenPos - 1,
                    width: 1,
                    cursor: 'ew-resize',
                  }),
                  background: isDraggingThis ? '#f59e0b' : 'rgba(59,130,246,0.7)',
                  pointerEvents: 'all',
                  zIndex: 15,
                  // Extended hit area
                  ...(guide.type === 'h' ? {
                    borderTop: '4px solid transparent',
                    borderBottom: '4px solid transparent',
                    backgroundClip: 'padding-box',
                  } : {
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    backgroundClip: 'padding-box',
                  }),
                }}
              >
                {/* Position label */}
                <div style={{
                  position: 'absolute',
                  ...(guide.type === 'h' ? { left: 28, top: -9 } : { top: 28, left: 3 }),
                  background: 'rgba(59,130,246,0.85)',
                  color: '#fff', fontSize: 9, fontFamily: 'monospace',
                  fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                  pointerEvents: 'none', whiteSpace: 'nowrap',
                  opacity: isDraggingThis ? 1 : 0,
                }}>
                  {Math.round(guide.pos)}
                </div>
              </div>
            );
          })}
          {/* Clear all guides button */}
          {showRulers && (
            <button
              title="Clear all guides"
              onMouseDown={(e) => { e.stopPropagation(); setGuides([]); }}
              style={{
                position: 'absolute', top: RULER_SIZE + 4, left: RULER_SIZE + 4,
                background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)',
                borderRadius: 4, color: 'rgba(59,130,246,0.9)',
                cursor: 'pointer', fontSize: 9, fontWeight: 700,
                padding: '2px 6px', zIndex: 20,
              }}
            >
              ✕ {guides.length} guide{guides.length !== 1 ? 's' : ''}
            </button>
          )}
        </>
      )}

      {/* ── Column grid overlay ──────────────────────────────────────────────── */}
      {showColumnGrid && (() => {
        const { columns, gutter, margin, color } = columnGridSettings;
        // Determine a "canvas width" from the bounding box of all shapes, or fallback to viewport
        const overlayEl = overlayRef.current;
        const viewW = overlayEl ? overlayEl.clientWidth : 1440;
        const viewH = overlayEl ? overlayEl.clientHeight : 900;

        // Compute total usable canvas width for column grid (in screen space)
        // We base the grid on the visible viewport width to keep it practical.
        const totalW = viewW;
        const marginPx = margin * zoom;
        const usableW = totalW - marginPx * 2;
        const gutterPx = gutter * zoom;
        const colW = (usableW - gutterPx * (columns - 1)) / columns;

        if (colW < 2) return null; // too narrow to show

        const cols = Array.from({ length: columns }, (_, i) => i);
        return (
          <svg
            key="column-grid"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: 'none', zIndex: 7,
            }}
          >
            {cols.map(i => {
              const x = marginPx + i * (colW + gutterPx);
              return (
                <rect
                  key={i}
                  x={x} y={0}
                  width={colW} height={viewH}
                  fill={color}
                />
              );
            })}
            {/* Column count label */}
            <text
              x={marginPx} y={14}
              fill="var(--accent)"
              fontSize={9}
              fontFamily="monospace"
              opacity={0.55}
              style={{ userSelect: 'none' }}
            >
              {columns} cols · {gutter}px gutter · {margin}px margin
            </text>
          </svg>
        );
      })()}

      {/* ── Pixel grid overlay ───────────────────────────────────────────────── */}
      {showPixelGrid && (() => {
        const cellPx = pixelGridSize * zoom;
        // Only show when zoomed in enough to see individual cells
        if (cellPx < 4) return null;
        const offX = ((pan.x % cellPx) + cellPx) % cellPx;
        const offY = ((pan.y % cellPx) + cellPx) % cellPx;
        const alpha = Math.min(0.18, Math.max(0.04, (cellPx - 4) / 40 * 0.18));
        return (
          <svg
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: 'none', zIndex: 8,
            }}
          >
            <defs>
              <pattern
                id="pixel-grid-pattern"
                x={offX} y={offY}
                width={cellPx} height={cellPx}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${cellPx} 0 L 0 0 0 ${cellPx}`}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={0.5}
                  strokeOpacity={alpha * 4}
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pixel-grid-pattern)" />
            {/* Grid size label */}
            <text
              x={8} y={20}
              fill="var(--accent)"
              fontSize={10}
              fontFamily="monospace"
              opacity={0.5}
              style={{ userSelect: 'none' }}
            >
              {pixelGridSize}px grid
            </text>
          </svg>
        );
      })()}

      {/* ── Baseline grid overlay ────────────────────────────────────────────── */}
      {showBaselineGrid && (() => {
        const linePx = baselineGridSize * zoom;
        if (linePx < 3) return null;
        const offY = ((pan.y % linePx) + linePx) % linePx;
        const alpha = Math.min(0.25, Math.max(0.06, (linePx - 3) / 30 * 0.25));
        const overlayEl = overlayRef.current;
        const W = overlayEl ? overlayEl.clientWidth : 1200;
        const H = overlayEl ? overlayEl.clientHeight : 900;
        return (
          <svg
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: 'none', zIndex: 8,
            }}
          >
            <defs>
              <pattern
                id="baseline-grid-pattern"
                x={0} y={offY}
                width={W} height={linePx}
                patternUnits="userSpaceOnUse"
              >
                {/* Main baseline */}
                <line x1={0} y1={linePx} x2={W} y2={linePx}
                  stroke="rgba(250,204,21,0.55)" strokeWidth={0.5} strokeOpacity={alpha * 3} />
                {/* Half-line (cap height guide) */}
                <line x1={0} y1={linePx / 2} x2={W} y2={linePx / 2}
                  stroke="rgba(250,204,21,0.3)" strokeWidth={0.5} strokeOpacity={alpha} strokeDasharray="4 4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#baseline-grid-pattern)" />
            {/* Label */}
            <text
              x={8} y={20}
              fill="rgba(250,204,21,0.7)"
              fontSize={10}
              fontFamily="monospace"
              style={{ userSelect: 'none' }}
            >
              {baselineGridSize}px baseline
            </text>
          </svg>
        );
      })()}

      {/* ── Prototype flow lines (protoLink arrows) ────────────────────── */}
      {activeTool === 'cursor' && (() => {
        const protoShapes = shapes.filter(s => s.protoLink && !s.hidden);
        if (protoShapes.length === 0) return null;
        const activeIds = new Set([hoveredShapeId, selectedId].filter(Boolean));
        const lines = protoShapes.flatMap(src => {
          const target = shapes.find(s => s.id === src.protoLink);
          if (!target) return [];
          const isActive = activeIds.has(src.id) || activeIds.has(target.id);
          // source center (right edge mid)
          const sx = (src.x + src.width) * zoom + pan.x;
          const sy = (src.y + src.height / 2) * zoom + pan.y;
          // target center (left edge mid)
          const tx = target.x * zoom + pan.x;
          const ty = (target.y + target.height / 2) * zoom + pan.y;
          // Bezier control points
          const cpDist = Math.max(50, Math.abs(tx - sx) * 0.4);
          const cp1x = sx + cpDist, cp1y = sy;
          const cp2x = tx - cpDist, cp2y = ty;
          const pathD = `M ${sx} ${sy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${tx} ${ty}`;
          return [{ src, target, pathD, isActive }];
        });
        if (lines.length === 0) return null;
        return (
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15, overflow: 'visible' }}
            width="100%" height="100%"
          >
            <defs>
              <marker id="proto-arrow-dim" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7" fill="none" stroke="rgba(99,102,241,0.35)" strokeWidth="1.2"/>
              </marker>
              <marker id="proto-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7" fill="none" stroke="#818cf8" strokeWidth="1.5"/>
              </marker>
            </defs>
            {lines.map(({ src, pathD, isActive }) => (
              <path
                key={src.id + src.protoLink}
                d={pathD}
                fill="none"
                stroke={isActive ? '#818cf8' : 'rgba(99,102,241,0.3)'}
                strokeWidth={isActive ? 1.5 : 1}
                strokeDasharray={isActive ? '6,4' : '4,4'}
                markerEnd={isActive ? 'url(#proto-arrow)' : 'url(#proto-arrow-dim)'}
                style={{
                  opacity: isActive ? 1 : 0.5,
                  transition: 'opacity 0.2s, stroke 0.2s',
                }}
              />
            ))}
          </svg>
        );
      })()}

      {/* ── Sticky notes overlay ─────────────────────────────────────────── */}
      {projectId && (
        <StickyNotesOverlay
          projectId={projectId}
          zoom={zoom}
          panX={pan.x}
          panY={pan.y}
          placingMode={stickyNotesPlacing}
          onPlacingComplete={() => onStickyNotesPlacingComplete?.()}
        />
      )}

      {/* ── Comment pins overlay ──────────────────────────────────────────── */}
      {(commentPins.length > 0 || commentMode) && (
        <CommentPinsOverlay
          pins={commentPins}
          zoom={zoom}
          pan={pan}
          activeMode={commentMode}
          onAdd={(x, y) => onAddCommentPin?.(x, y)}
          onChange={(id, patch) => onUpdateCommentPin?.(id, patch)}
          onDelete={(id) => onDeleteCommentPin?.(id)}
          onExitMode={() => onExitCommentMode?.()}
        />
      )}


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

      {/* ── Mini-map ──────────────────────────────────────────────────────── */}
      {shapes.length > 0 && (
        <CanvasMiniMap
          shapes={shapes}
          zoom={zoom}
          pan={pan}
          overlayRef={overlayRef}
          onNavigate={(newPan) => setPan(newPan)}
        />
      )}

      {/* ── Minimap (bottom-right) ────────────────────────────────────────── */}
      {showMinimap && shapes.length > 0 && (
        <Minimap
          shapes={shapes}
          zoom={zoom}
          pan={pan}
          viewportWidth={viewportSize.w}
          viewportHeight={viewportSize.h}
          onPanTo={(newPan) => setPan(newPan)}
        />
      )}

      {/* ── Cursor coordinates (bottom-left) ─────────────────────────────── */}
      {cursorPos && (
        <div style={{
          position: 'absolute',
          bottom: 32,
          left: 12,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 9px',
          fontSize: 11,
          fontFamily: 'monospace',
          color: 'var(--muted)',
          pointerEvents: 'none',
          userSelect: 'none',
          backdropFilter: 'blur(8px)',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          letterSpacing: '0.01em',
        }}>
          {cursorPos.x}, {cursorPos.y}
        </div>
      )}

      {/* ── Canvas background color picker ─────────────────────────────────── */}
      <CanvasBgPicker color={canvasBgColor} onChange={setCanvasBgColor} />

      {/* ── Background pattern picker ──────────────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 32, right: 260, zIndex: 20, pointerEvents: 'all' }}>
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={(e) => { e.stopPropagation(); setShowBgPatternPicker(p => !p); }}
            title="Canvas background pattern"
            style={{
              background: bgPattern !== 'dots' ? 'rgba(99,102,241,0.15)' : 'var(--panel)',
              border: `1px solid ${bgPattern !== 'dots' ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
              borderRadius: 7, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', userSelect: 'none', cursor: 'pointer',
              color: bgPattern !== 'dots' ? 'var(--accent)' : 'var(--muted)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.12s',
            }}
          >
            {/* Pattern icon varies by current selection */}
            {bgPattern === 'dots' ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                {[0,4,8].map(cx => [0,4,8].map(cy => <circle key={`${cx}-${cy}`} cx={cx+3} cy={cy+3} r={0.9} fill="currentColor"/>))}
              </svg>
            ) : bgPattern === 'lines' ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                {[2,5,8,11].map(y => <line key={y} x1="1" y1={y} x2="13" y2={y} stroke="currentColor" strokeWidth="0.9"/>)}
              </svg>
            ) : bgPattern === 'grid' ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                {[3,7,11].map(x => <line key={`v${x}`} x1={x} y1="1" x2={x} y2="13" stroke="currentColor" strokeWidth="0.9"/>)}
                {[3,7,11].map(y => <line key={`h${y}`} x1="1" y1={y} x2="13" y2={y} stroke="currentColor" strokeWidth="0.9"/>)}
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.1"/>
              </svg>
            )}
          </button>

          {showBgPatternPicker && (
            <div
              style={{
                position: 'absolute', bottom: 38, right: 0,
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 4px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column', gap: 2,
                zIndex: 100, minWidth: 100,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 6px 4px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                Background
              </div>
              {([
                { id: 'dots', label: 'Dots', icon: '· · ·' },
                { id: 'lines', label: 'Lines', icon: '≡' },
                { id: 'grid', label: 'Grid', icon: '⊞' },
                { id: 'none', label: 'None', icon: '□' },
              ] as { id: 'dots' | 'lines' | 'grid' | 'none'; label: string; icon: string }[]).map(opt => (
                <button
                  key={opt.id}
                  onMouseDown={(e) => { e.stopPropagation(); setBgPattern(opt.id); setShowBgPatternPicker(false); }}
                  style={{
                    background: bgPattern === opt.id ? 'rgba(99,102,241,0.15)' : 'none',
                    border: 'none', borderRadius: 5,
                    color: bgPattern === opt.id ? 'var(--accent)' : 'var(--text)',
                    cursor: 'pointer', padding: '4px 8px',
                    fontSize: 11, textAlign: 'left',
                    fontWeight: bgPattern === opt.id ? 700 : 400,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', opacity: 0.7 }}>{opt.icon}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas tool buttons (grid snap + rulers) ─────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 32, right: 130,
        display: 'flex', gap: 4, zIndex: 20, pointerEvents: 'all',
      }}>
        {/* Rulers toggle */}
        <button
          onMouseDown={(e) => { e.stopPropagation(); setShowRulers(r => !r); }}
          title={showRulers ? 'Hide rulers (⇧R)' : 'Show rulers (⇧R)'}
          style={{
            background: showRulers ? 'rgba(99,102,241,0.15)' : 'var(--panel)',
            border: `1px solid ${showRulers ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
            borderRadius: 7,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            userSelect: 'none',
            cursor: 'pointer',
            color: showRulers ? 'var(--accent)' : 'var(--muted)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
            e.currentTarget.style.color = 'var(--accent)';
            if (!showRulers) e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = showRulers ? 'rgba(99,102,241,0.4)' : 'var(--border)';
            e.currentTarget.style.color = showRulers ? 'var(--accent)' : 'var(--muted)';
            e.currentTarget.style.background = showRulers ? 'rgba(99,102,241,0.15)' : 'var(--panel)';
          }}
        >
          {/* Ruler icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="4" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.1"/>
            <line x1="4" y1="4" x2="4" y2="6" stroke="currentColor" strokeWidth="1"/>
            <line x1="7" y1="4" x2="7" y2="7" stroke="currentColor" strokeWidth="1"/>
            <line x1="10" y1="4" x2="10" y2="6" stroke="currentColor" strokeWidth="1"/>
          </svg>
        </button>

        {/* Grid snap toggle */}
        <button
          onMouseDown={(e) => { e.stopPropagation(); setSnapToGrid(s => !s); }}
          title={snapToGrid ? 'Grid snap ON — click to disable (G)' : 'Grid snap OFF — click to enable (G)'}
          style={{
            background: snapToGrid ? 'rgba(99,102,241,0.15)' : 'var(--panel)',
            border: `1px solid ${snapToGrid ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
            borderRadius: 7,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            userSelect: 'none',
            cursor: 'pointer',
            color: snapToGrid ? 'var(--accent)' : 'var(--muted)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
            e.currentTarget.style.color = 'var(--accent)';
            if (!snapToGrid) e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = snapToGrid ? 'rgba(99,102,241,0.4)' : 'var(--border)';
            e.currentTarget.style.color = snapToGrid ? 'var(--accent)' : 'var(--muted)';
            e.currentTarget.style.background = snapToGrid ? 'rgba(99,102,241,0.15)' : 'var(--panel)';
          }}
        >
          {/* Grid icon: 3×3 dot grid */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {[0, 4, 8].map(cx => [0, 4, 8].map(cy => (
              <circle key={`${cx}-${cy}`} cx={cx + 3} cy={cy + 3} r={1} fill="currentColor" />
            )))}
          </svg>
        </button>

        {/* Wireframe toggle */}
        <button
          onMouseDown={(e) => { e.stopPropagation(); setWireframeMode(w => !w); }}
          title={wireframeMode ? 'Exit wireframe mode (⌘⇧W)' : 'Wireframe mode (⌘⇧W)'}
          style={{
            background: wireframeMode ? 'rgba(99,102,241,0.15)' : 'var(--panel)',
            border: `1px solid ${wireframeMode ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
            borderRadius: 7,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            userSelect: 'none',
            cursor: 'pointer',
            color: wireframeMode ? 'var(--accent)' : 'var(--muted)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
            e.currentTarget.style.color = 'var(--accent)';
            if (!wireframeMode) e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = wireframeMode ? 'rgba(99,102,241,0.4)' : 'var(--border)';
            e.currentTarget.style.color = wireframeMode ? 'var(--accent)' : 'var(--muted)';
            e.currentTarget.style.background = wireframeMode ? 'rgba(99,102,241,0.15)' : 'var(--panel)';
          }}
        >
          {/* Wireframe icon: rectangle with inner rectangle */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="4" y="4" width="6" height="6" rx="0.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>

        {/* Focus mode toggle */}
        <button
          onMouseDown={(e) => { e.stopPropagation(); setFocusMode(f => !f); }}
          title={focusMode ? 'Exit focus mode (⇧F)' : 'Focus mode — dim non-selected shapes (⇧F)'}
          style={{
            background: focusMode ? 'rgba(99,102,241,0.15)' : 'var(--panel)',
            border: `1px solid ${focusMode ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
            borderRadius: 7,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            userSelect: 'none',
            cursor: 'pointer',
            color: focusMode ? 'var(--accent)' : 'var(--muted)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
            e.currentTarget.style.color = 'var(--accent)';
            if (!focusMode) e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = focusMode ? 'rgba(99,102,241,0.4)' : 'var(--border)';
            e.currentTarget.style.color = focusMode ? 'var(--accent)' : 'var(--muted)';
            e.currentTarget.style.background = focusMode ? 'rgba(99,102,241,0.15)' : 'var(--panel)';
          }}
        >
          {/* Focus/spotlight icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.3" />
            <line x1="7" y1="1" x2="7" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="7" y1="11.5" x2="7" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="1" y1="7" x2="2.5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="11.5" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Minimap toggle */}
        <button
          onMouseDown={(e) => { e.stopPropagation(); setShowMinimap(m => !m); }}
          title={showMinimap ? 'Hide minimap (M)' : 'Show minimap (M)'}
          style={{
            background: showMinimap ? 'rgba(99,102,241,0.15)' : 'var(--panel)',
            border: `1px solid ${showMinimap ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
            borderRadius: 7,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            userSelect: 'none',
            cursor: 'pointer',
            color: showMinimap ? 'var(--accent)' : 'var(--muted)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
            e.currentTarget.style.color = 'var(--accent)';
            if (!showMinimap) e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = showMinimap ? 'rgba(99,102,241,0.4)' : 'var(--border)';
            e.currentTarget.style.color = showMinimap ? 'var(--accent)' : 'var(--muted)';
            e.currentTarget.style.background = showMinimap ? 'rgba(99,102,241,0.15)' : 'var(--panel)';
          }}
        >
          {/* Minimap icon: small rectangle inside larger rectangle */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <rect x="3" y="7" width="8" height="5" rx="1" fill="currentColor" opacity="0.5" />
            <rect x="7" y="3" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="0.8" />
          </svg>
        </button>

        {/* Pixel grid toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={(e) => { e.stopPropagation(); setShowPixelGrid(p => !p); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setShowPixelGridSizePicker(p => !p); }}
            title={showPixelGrid ? `Pixel grid ON (${pixelGridSize}px) — right-click to change size (⇧G)` : 'Pixel grid OFF (⇧G) — right-click for size options'}
            style={{
              background: showPixelGrid ? 'rgba(99,102,241,0.15)' : 'var(--panel)',
              border: `1px solid ${showPixelGrid ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
              borderRadius: 7,
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              userSelect: 'none',
              cursor: 'pointer',
              color: showPixelGrid ? 'var(--accent)' : 'var(--muted)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
              e.currentTarget.style.color = 'var(--accent)';
              if (!showPixelGrid) e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = showPixelGrid ? 'rgba(99,102,241,0.4)' : 'var(--border)';
              e.currentTarget.style.color = showPixelGrid ? 'var(--accent)' : 'var(--muted)';
              e.currentTarget.style.background = showPixelGrid ? 'rgba(99,102,241,0.15)' : 'var(--panel)';
            }}
          >
            {/* Pixel grid icon: 2×2 squares */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
              <rect x="8" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
              <rect x="1" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
              <rect x="8" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </button>

          {/* Pixel grid size picker popover */}
          {showPixelGridSizePicker && (
            <div
              style={{
                position: 'absolute', bottom: 38, right: 0,
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 4px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column', gap: 2,
                zIndex: 100, minWidth: 80,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 6px 4px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                Grid size
              </div>
              {PIXEL_GRID_SIZES.map(size => (
                <button
                  key={size}
                  onMouseDown={(e) => { e.stopPropagation(); setPixelGridSize(size); setShowPixelGrid(true); setShowPixelGridSizePicker(false); }}
                  style={{
                    background: pixelGridSize === size ? 'rgba(99,102,241,0.15)' : 'none',
                    border: 'none', borderRadius: 5,
                    color: pixelGridSize === size ? 'var(--accent)' : 'var(--text)',
                    cursor: 'pointer', padding: '4px 8px',
                    fontSize: 11, fontFamily: 'monospace',
                    textAlign: 'left', fontWeight: pixelGridSize === size ? 700 : 400,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}
                >
                  <span>{size}px</span>
                  {pixelGridSize === size && <span style={{ fontSize: 9, opacity: 0.7 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Baseline grid toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              setShowBaselineGrid(b => !b);
            }}
            onContextMenu={(e) => {
              e.preventDefault(); e.stopPropagation();
              // Cycle through baseline sizes on right-click
              const SIZES = [4, 6, 8, 10, 12, 16, 20, 24];
              setBaselineGridSize(prev => {
                const idx = SIZES.indexOf(prev);
                return SIZES[(idx + 1) % SIZES.length];
              });
              setShowBaselineGrid(true);
            }}
            title={showBaselineGrid
              ? `Baseline grid ON (${baselineGridSize}px) — right-click to change size (⇧B)`
              : 'Baseline grid (⇧B) — right-click for size'}
            style={{
              background: showBaselineGrid ? 'rgba(250,204,21,0.12)' : 'var(--panel)',
              border: `1px solid ${showBaselineGrid ? 'rgba(250,204,21,0.45)' : 'var(--border)'}`,
              borderRadius: 7,
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              userSelect: 'none',
              cursor: 'pointer',
              color: showBaselineGrid ? 'rgba(250,204,21,0.9)' : 'var(--muted)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(250,204,21,0.5)';
              e.currentTarget.style.color = 'rgba(250,204,21,0.9)';
              if (!showBaselineGrid) e.currentTarget.style.background = 'rgba(250,204,21,0.07)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = showBaselineGrid ? 'rgba(250,204,21,0.45)' : 'var(--border)';
              e.currentTarget.style.color = showBaselineGrid ? 'rgba(250,204,21,0.9)' : 'var(--muted)';
              e.currentTarget.style.background = showBaselineGrid ? 'rgba(250,204,21,0.12)' : 'var(--panel)';
            }}
          >
            {/* Baseline grid icon: horizontal lines at different intervals */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.2" />
              <line x1="1" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.2" />
              <line x1="1" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.2" />
              <line x1="1" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" strokeOpacity="0.5" />
              <line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" strokeOpacity="0.5" />
            </svg>
          </button>
        </div>

        {/* Column grid toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={(e) => { e.stopPropagation(); setShowColumnGrid(c => !c); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setShowColumnGridSettings(s => !s); }}
            title={showColumnGrid ? `Column grid ON (${columnGridSettings.columns} cols) — right-click for settings (⇧C)` : 'Column grid (⇧C) — right-click for settings'}
            style={{
              background: showColumnGrid ? 'rgba(99,102,241,0.15)' : 'var(--panel)',
              border: `1px solid ${showColumnGrid ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
              borderRadius: 7,
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              userSelect: 'none',
              cursor: 'pointer',
              color: showColumnGrid ? 'var(--accent)' : 'var(--muted)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
              e.currentTarget.style.color = 'var(--accent)';
              if (!showColumnGrid) e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = showColumnGrid ? 'rgba(99,102,241,0.4)' : 'var(--border)';
              e.currentTarget.style.color = showColumnGrid ? 'var(--accent)' : 'var(--muted)';
              e.currentTarget.style.background = showColumnGrid ? 'rgba(99,102,241,0.15)' : 'var(--panel)';
            }}
          >
            {/* Column grid icon: 3 vertical bars */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="3" height="10" rx="0.6" fill="currentColor" opacity="0.5"/>
              <rect x="5.5" y="2" width="3" height="10" rx="0.6" fill="currentColor" opacity="0.5"/>
              <rect x="10" y="2" width="3" height="10" rx="0.6" fill="currentColor" opacity="0.5"/>
            </svg>
          </button>

          {/* Column grid settings popover */}
          {showColumnGridSettings && (
            <div
              style={{
                position: 'absolute', bottom: 38, right: 0,
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                zIndex: 100, minWidth: 180,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                Column Grid
              </div>
              {([
                { key: 'columns', label: 'Columns', min: 1, max: 24, step: 1 },
                { key: 'gutter', label: 'Gutter (px)', min: 0, max: 120, step: 4 },
                { key: 'margin', label: 'Margin (px)', min: 0, max: 400, step: 8 },
              ] as { key: keyof typeof columnGridSettings; label: string; min: number; max: number; step: number }[]).map(field => (
                <div key={field.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <label style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{field.label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onMouseDown={(e) => { e.stopPropagation(); setColumnGridSettings(s => ({ ...s, [field.key]: Math.max(field.min, (s[field.key] as number) - field.step) })); }}
                      style={{ width: 20, height: 20, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >−</button>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text)', minWidth: 28, textAlign: 'center' }}>
                      {columnGridSettings[field.key]}
                    </span>
                    <button
                      onMouseDown={(e) => { e.stopPropagation(); setColumnGridSettings(s => ({ ...s, [field.key]: Math.min(field.max, (s[field.key] as number) + field.step) })); }}
                      style={{ width: 20, height: 20, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >+</button>
                  </div>
                </div>
              ))}
              {/* Preset layouts */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--subtle)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Presets</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {([
                    { label: '12', columns: 12, gutter: 24, margin: 80 },
                    { label: '8', columns: 8, gutter: 20, margin: 60 },
                    { label: '4', columns: 4, gutter: 16, margin: 40 },
                    { label: '3', columns: 3, gutter: 24, margin: 40 },
                  ] as { label: string; columns: number; gutter: number; margin: number }[]).map(preset => (
                    <button
                      key={preset.label}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setColumnGridSettings(s => ({ ...s, columns: preset.columns, gutter: preset.gutter, margin: preset.margin }));
                        setShowColumnGrid(true);
                        setShowColumnGridSettings(false);
                      }}
                      style={{
                        padding: '3px 8px', borderRadius: 5, fontSize: 10,
                        border: '1px solid var(--border)', background: 'var(--input-bg)',
                        color: 'var(--text)', cursor: 'pointer', fontFamily: 'monospace',
                      }}
                    >
                      {preset.label} col
                    </button>
                  ))}
                </div>
              </div>
              {/* Color picker row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Color</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['rgba(99,102,241,0.08)', 'rgba(239,68,68,0.08)', 'rgba(34,197,94,0.08)', 'rgba(234,179,8,0.08)'].map(c => (
                    <button
                      key={c}
                      onMouseDown={(e) => { e.stopPropagation(); setColumnGridSettings(s => ({ ...s, color: c })); }}
                      style={{
                        width: 16, height: 16, borderRadius: 4, cursor: 'pointer',
                        background: c.replace(/[\d.]+\)$/, '0.6)'),
                        border: columnGridSettings.color === c ? '2px solid var(--accent)' : '1px solid var(--border)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wireframe mode banner */}
      {wireframeMode && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 6, padding: '3px 12px', fontSize: 11, color: 'var(--accent)',
          fontWeight: 600, letterSpacing: '0.04em', pointerEvents: 'none', zIndex: 25,
          backdropFilter: 'blur(8px)',
        }}>
          Wireframe Mode — ⌘⇧W to exit
        </div>
      )}

      {/* Focus mode banner */}
      {focusMode && (
        <div style={{
          position: 'absolute', top: wireframeMode ? 38 : 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: 6, padding: '3px 12px', fontSize: 11, color: '#a855f7',
          fontWeight: 600, letterSpacing: '0.04em', pointerEvents: 'none', zIndex: 25,
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="5" y1="0.5" x2="5" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="5" y1="8" x2="5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="0.5" y1="5" x2="2" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="8" y1="5" x2="9.5" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Focus Mode — ⇧F to exit
        </div>
      )}

      {/* ── Zoom controls (not transformed) ──────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 32, // above the 24px status bar + 8px gap
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
        {/* Zoom input / display — with quick-set popup on right-click */}
        <div style={{ position: 'relative' }}>
          {zoomInputActive ? (
            <input
              ref={zoomInputRef}
              type="text"
              value={zoomInputVal}
              onChange={(e) => setZoomInputVal(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(zoomInputVal);
                if (!isNaN(parsed) && parsed > 0) {
                  const z = Math.max(0.05, Math.min(8, parsed / 100));
                  setZoom(z);
                  setPan(p => {
                    const el = overlayRef.current;
                    if (!el) return p;
                    const rect = el.getBoundingClientRect();
                    const cx = rect.width / 2;
                    const cy = rect.height / 2;
                    return {
                      x: cx - (cx - p.x) * (z / zoom),
                      y: cy - (cy - p.y) * (z / zoom),
                    };
                  });
                }
                setZoomInputActive(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                if (e.key === 'Escape') { setZoomInputActive(false); }
              }}
              style={{
                background: 'var(--panel-alt)', border: '1px solid var(--accent)',
                color: 'var(--text)', fontSize: 12, fontFamily: 'monospace',
                padding: '0 8px', height: 28, minWidth: 52, textAlign: 'center',
                borderRadius: 4, outline: 'none', boxSizing: 'border-box',
              }}
            />
          ) : (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                if (e.button === 2) { e.preventDefault(); return; } // handled by onContextMenu
                setZoomInputActive(true);
                setZoomInputVal(String(zoomPct));
                setTimeout(() => {
                  zoomInputRef.current?.focus();
                  zoomInputRef.current?.select();
                }, 0);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowZoomMenu(m => !m);
              }}
              title="Click to type zoom % · Right-click for presets · Double-click to fit"
              onDoubleClick={(e) => { e.stopPropagation(); shapes.length > 0 ? zoomToFit() : zoomReset(); }}
              style={{
                background: 'none', border: 'none',
                color: zoomPct === 100 ? 'var(--muted)' : 'var(--text)',
                cursor: 'pointer',
                padding: '0 8px', height: 28, display: 'flex', alignItems: 'center',
                fontSize: 12, fontFamily: 'monospace', fontWeight: zoomPct !== 100 ? 600 : 400,
                borderRadius: 4, minWidth: 52, justifyContent: 'center',
                transition: 'color 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = zoomPct === 100 ? 'var(--muted)' : 'var(--text)'; }}
            >{zoomPct}%</button>
          )}

          {/* Zoom preset menu */}
          {showZoomMenu && !zoomInputActive && (
            <div
              style={{
                position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '4px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                zIndex: 100, minWidth: 90,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 6px 4px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                Zoom
              </div>
              {/* Special entries */}
              {[
                { label: 'Fit to canvas', action: () => { shapes.length > 0 ? zoomToFit() : zoomReset(); setShowZoomMenu(false); } },
                { label: 'Fit to selection', action: () => {
                  const sel = shapes.filter(s => selectedIds.includes(s.id) || s.id === selectedId);
                  if (sel.length > 0) zoomToBBox(sel);
                  setShowZoomMenu(false);
                }},
              ].map(item => (
                <button
                  key={item.label}
                  onMouseDown={(e) => { e.stopPropagation(); item.action(); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', padding: '4px 8px', fontSize: 11, width: '100%',
                    textAlign: 'left', borderRadius: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-alt)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  {item.label}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
              {ZOOM_PRESETS.map(pct => (
                <button
                  key={pct}
                  onMouseDown={(e) => { e.stopPropagation(); applyZoomPreset(pct); }}
                  style={{
                    background: zoomPct === pct ? 'rgba(99,102,241,0.15)' : 'none',
                    border: 'none', cursor: 'pointer',
                    color: zoomPct === pct ? 'var(--accent)' : 'var(--text)',
                    padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', fontWeight: zoomPct === pct ? 700 : 400,
                    width: '100%', textAlign: 'left', borderRadius: 4,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                  onMouseEnter={(e) => { if (zoomPct !== pct) e.currentTarget.style.background = 'var(--panel-alt)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = zoomPct === pct ? 'rgba(99,102,241,0.15)' : 'none'; }}
                >
                  <span>{pct}%</span>
                  {zoomPct === pct && <span style={{ fontSize: 9, opacity: 0.7 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
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
        <CanvasContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          shapeId={ctxMenu.shapeId}
          shapes={shapes}
          selectedIds={selectedIds}
          styleClipboard={styleClipboard}
          onClose={() => setCtxMenu(null)}
          onSetStyleClipboard={setStyleClipboard}
          onShapeChange={onShapeChange}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
          onCopy={onCopy}
          onPaste={onPaste}
          onGroup={onGroup}
          onUngroup={onUngroup}
          onWrapInFrame={onWrapInFrame}
          onSelectAll={onSelectAll}
        />
      )}
    </div>
  );
}

// ── Canvas Mini-Map ────────────────────────────────────────────────────────
// A small overview of all shapes in the bottom-left corner.
// Clicking navigates the canvas to that area.
const MAP_W = 140;
const MAP_H = 90;
const MAP_PAD = 12; // padding from canvas edge

function CanvasMiniMap({
  shapes,
  zoom,
  pan,
  overlayRef,
  onNavigate,
}: {
  shapes: Shape[];
  zoom: number;
  pan: { x: number; y: number };
  overlayRef: React.RefObject<HTMLDivElement | null>;
  onNavigate: (pan: { x: number; y: number }) => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const draggingRef = React.useRef(false);

  // Compute bounding box of all shapes
  const visible = shapes.filter(s => !s.hidden);
  if (visible.length === 0) return null;

  const minX = Math.min(...visible.map(s => s.x));
  const minY = Math.min(...visible.map(s => s.y));
  const maxX = Math.max(...visible.map(s => s.x + s.width));
  const maxY = Math.max(...visible.map(s => s.y + s.height));
  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;

  const pad = 16; // internal padding inside mini-map
  const availW = MAP_W - pad * 2;
  const availH = MAP_H - pad * 2;
  const scale = Math.min(availW / contentW, availH / contentH);

  // Map canvas coords → mini-map screen coords
  const toMapX = (cx: number) => pad + (cx - minX) * scale;
  const toMapY = (cy: number) => pad + (cy - minY) * scale;

  // Compute viewport rect in mini-map coords
  const el = overlayRef.current;
  const vpW = el ? el.clientWidth : 800;
  const vpH = el ? el.clientHeight : 600;

  // Canvas coords of viewport corners
  const vpLeft = (-pan.x) / zoom;
  const vpTop = (-pan.y) / zoom;
  const vpRight = vpLeft + vpW / zoom;
  const vpBottom = vpTop + vpH / zoom;

  const vpMapX = toMapX(vpLeft);
  const vpMapY = toMapY(vpTop);
  const vpMapW = (vpRight - vpLeft) * scale;
  const vpMapH = (vpBottom - vpTop) * scale;

  // Click on mini-map to navigate
  const handleMapClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Canvas coords of clicked point
    const cx = (mx - pad) / scale + minX;
    const cy = (my - pad) / scale + minY;
    // Pan so viewport is centered there
    const el = overlayRef.current;
    if (!el) return;
    onNavigate({
      x: el.clientWidth / 2 - cx * zoom,
      y: el.clientHeight / 2 - cy * zoom,
    });
  };

  const BOTTOM = MAP_PAD + 44; // above cursor coords area

  return (
    <div
      style={{
        position: 'absolute',
        bottom: BOTTOM,
        left: MAP_PAD,
        zIndex: 19,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(8px)',
        overflow: 'hidden',
        userSelect: 'none',
        transition: 'width 0.15s, height 0.15s',
        width: collapsed ? 28 : MAP_W,
        height: collapsed ? 28 : MAP_H + 4,
      }}
    >
      {/* Collapse toggle */}
      <button
        onMouseDown={(e) => { e.stopPropagation(); setCollapsed(c => !c); }}
        title={collapsed ? 'Expand mini-map' : 'Collapse mini-map'}
        style={{
          position: 'absolute', top: 4, right: 4, zIndex: 2,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', padding: 2, borderRadius: 4,
          lineHeight: 1, display: 'flex', alignItems: 'center',
          fontSize: 9,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
      >
        {collapsed ? '⊞' : '⊟'}
      </button>

      {!collapsed && (
        <svg
          width={MAP_W}
          height={MAP_H}
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          style={{ display: 'block', cursor: 'crosshair' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            draggingRef.current = true;
            handleMapClick(e);
          }}
        >
          {/* Shape rectangles */}
          {visible.map(s => {
            const isPath = s.type === 'path';
            if (isPath) return null;
            const mx = toMapX(s.x);
            const my = toMapY(s.y);
            const mw = s.width * scale;
            const mh = s.height * scale;
            if (mw < 0.5 && mh < 0.5) return null;
            const fill = s.fill === 'transparent' ? 'none' : s.fill;
            return (
              <rect
                key={s.id}
                x={mx} y={my} width={Math.max(1, mw)} height={Math.max(1, mh)}
                fill={fill}
                opacity={s.opacity * 0.85}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={0.5}
                rx={Math.min(2, (s.type === 'ellipse' ? Math.min(mw, mh) / 2 : 1))}
              />
            );
          })}

          {/* Viewport indicator */}
          <rect
            x={Math.max(0, vpMapX)}
            y={Math.max(0, vpMapY)}
            width={Math.min(MAP_W, vpMapW)}
            height={Math.min(MAP_H, vpMapH)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.8}
          />
          {/* Dim the area outside viewport */}
          <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="rgba(0,0,0,0.18)" style={{ pointerEvents: 'none' }} />
          <rect
            x={Math.max(0, vpMapX)}
            y={Math.max(0, vpMapY)}
            width={Math.min(MAP_W - Math.max(0, vpMapX), vpMapW)}
            height={Math.min(MAP_H - Math.max(0, vpMapY), vpMapH)}
            fill="rgba(99,102,241,0.06)"
            style={{ pointerEvents: 'none' }}
          />
        </svg>
      )}
    </div>
  );
}

// ── Canvas Rulers ──────────────────────────────────────────────────────────
// Renders top + left rulers that track canvas pan/zoom position.
function CanvasRulers({ zoom, pan, rulerSize, onStartGuideH, onStartGuideV }: {
  zoom: number;
  pan: { x: number; y: number };
  rulerSize: number;
  onStartGuideH?: (screenY: number) => void;
  onStartGuideV?: (screenX: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 800, h: 600 });

  React.useLayoutEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    obs.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  const rulerBg = 'var(--panel)';
  const tickColor = 'var(--border)';
  const labelColor = 'var(--muted)';
  const labelSize = 9;

  // How many canvas units between each major tick
  // Pick a "nice" interval based on zoom
  function niceInterval(zoom: number): number {
    const raw = 100 / zoom; // target ~100 screen pixels per tick
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const frac = raw / pow;
    if (frac < 2) return pow;
    if (frac < 5) return 2 * pow;
    return 5 * pow;
  }

  const interval = niceInterval(zoom);
  const intervalPx = interval * zoom; // screen pixels between ticks

  // Horizontal ruler (top)
  const hTicks: React.ReactNode[] = [];
  // Start from the first visible tick
  const hStart = Math.floor(-pan.x / zoom / interval) * interval;
  const hEnd = hStart + size.w / zoom + interval * 2;
  for (let v = hStart; v <= hEnd; v += interval) {
    const sx = pan.x + v * zoom; // screen x
    if (sx < rulerSize || sx > size.w) continue;
    hTicks.push(
      <React.Fragment key={v}>
        <line x1={sx} y1={rulerSize - 6} x2={sx} y2={rulerSize} stroke={tickColor} strokeWidth={1} />
        <text x={sx + 2} y={rulerSize - 8} fontSize={labelSize} fill={labelColor} fontFamily="monospace">
          {v}
        </text>
      </React.Fragment>
    );
    // Minor ticks
    for (let i = 1; i < 5; i++) {
      const mv = v + i * interval / 5;
      const msx = pan.x + mv * zoom;
      if (msx < rulerSize || msx > size.w) continue;
      hTicks.push(
        <line key={`${v}-m${i}`} x1={msx} y1={rulerSize - 3} x2={msx} y2={rulerSize} stroke={tickColor} strokeWidth={0.5} opacity={0.6} />
      );
    }
  }

  // Vertical ruler (left)
  const vTicks: React.ReactNode[] = [];
  const vStart = Math.floor(-pan.y / zoom / interval) * interval;
  const vEnd = vStart + size.h / zoom + interval * 2;
  for (let v = vStart; v <= vEnd; v += interval) {
    const sy = pan.y + v * zoom; // screen y
    if (sy < rulerSize || sy > size.h) continue;
    vTicks.push(
      <React.Fragment key={v}>
        <line x1={rulerSize - 6} y1={sy} x2={rulerSize} y2={sy} stroke={tickColor} strokeWidth={1} />
        <text
          x={rulerSize - 8} y={sy + 2}
          fontSize={labelSize} fill={labelColor} fontFamily="monospace"
          textAnchor="end" transform={`rotate(-90, ${rulerSize - 8}, ${sy + 2})`}
        >
          {v}
        </text>
      </React.Fragment>
    );
    // Minor ticks
    for (let i = 1; i < 5; i++) {
      const mv = v + i * interval / 5;
      const msy = pan.y + mv * zoom;
      if (msy < rulerSize || msy > size.h) continue;
      vTicks.push(
        <line key={`${v}-m${i}`} x1={rulerSize - 3} y1={msy} x2={rulerSize} y2={msy} stroke={tickColor} strokeWidth={0.5} opacity={0.6} />
      );
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      {/* Horizontal ruler — drag down to create horizontal guide */}
      <svg
        style={{ position: 'absolute', top: 0, left: rulerSize, width: size.w - rulerSize, height: rulerSize, overflow: 'hidden', pointerEvents: onStartGuideH ? 'all' : 'none', cursor: onStartGuideH ? 'ns-resize' : 'default' }}
        onMouseDown={onStartGuideH ? (e) => { e.stopPropagation(); onStartGuideH(e.clientY); } : undefined}
      >
        {onStartGuideH && <title>Drag down to add a horizontal guide</title>}
        <rect x={0} y={0} width={size.w} height={rulerSize} fill={rulerBg} opacity={0.95} />
        {hTicks}
        {/* Bottom border */}
        <line x1={0} y1={rulerSize - 1} x2={size.w} y2={rulerSize - 1} stroke={tickColor} strokeWidth={1} />
      </svg>

      {/* Vertical ruler — drag right to create vertical guide */}
      <svg
        style={{ position: 'absolute', top: rulerSize, left: 0, width: rulerSize, height: size.h - rulerSize, overflow: 'hidden', pointerEvents: onStartGuideV ? 'all' : 'none', cursor: onStartGuideV ? 'ew-resize' : 'default' }}
        onMouseDown={onStartGuideV ? (e) => { e.stopPropagation(); onStartGuideV(e.clientX); } : undefined}
      >
        {onStartGuideV && <title>Drag right to add a vertical guide</title>}
        <rect x={0} y={0} width={rulerSize} height={size.h} fill={rulerBg} opacity={0.95} />
        {vTicks}
        {/* Right border */}
        <line x1={rulerSize - 1} y1={0} x2={rulerSize - 1} y2={size.h} stroke={tickColor} strokeWidth={1} />
      </svg>

      {/* Corner square (top-left) */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: rulerSize, height: rulerSize,
        background: rulerBg,
        borderRight: `1px solid ${tickColor}`,
        borderBottom: `1px solid ${tickColor}`,
        opacity: 0.95,
      }} />
    </div>
  );
}

function CtxItem({ label, shortcut, danger, dim, icon, onClick }: { label: string; shortcut?: string; danger?: boolean; dim?: boolean; icon?: string; onClick: () => void }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'none', border: 'none',
        color: danger ? 'var(--error)' : dim ? 'var(--muted)' : 'var(--text)',
        cursor: 'pointer', padding: '5px 14px', gap: 24, textAlign: 'left',
        fontSize: 12,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-dim)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon && <span style={{ fontSize: 13, opacity: 0.7, width: 16, textAlign: 'center' }}>{icon}</span>}
        {label}
      </span>
      {shortcut && <span style={{ color: 'var(--subtle)', fontFamily: 'monospace', fontSize: 10 }}>{shortcut}</span>}
    </button>
  );
}

function CtxSubHeader({ label }: { label: string }) {
  return (
    <div style={{
      padding: '6px 14px 2px', fontSize: 9.5, color: 'var(--subtle)',
      fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
    }}>
      {label}
    </div>
  );
}

// ── Canvas Context Menu ────────────────────────────────────────────────────

function CanvasContextMenu({
  x, y, shapeId, shapes, selectedIds, styleClipboard,
  onClose, onSetStyleClipboard, onShapeChange,
  onDuplicate, onDelete, onBringToFront, onSendToBack,
  onCopy, onPaste, onGroup, onUngroup, onSelectAll, onWrapInFrame,
}: {
  x: number; y: number;
  shapeId: string | null;
  shapes: Shape[];
  selectedIds: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styleClipboard: any | null;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSetStyleClipboard: (s: any) => void;
  onShapeChange?: (id: string, patch: Partial<Shape>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onSelectAll?: () => void;
  onWrapInFrame?: () => void;
}) {
  const [copyAsExpanded, setCopyAsExpanded] = useState(false);

  // Smart viewport clamping
  const MENU_W = 216;
  const MENU_H_EST = 440;
  const clampedX = Math.min(x, window.innerWidth - MENU_W - 8);
  const clampedY = Math.min(y, window.innerHeight - MENU_H_EST - 8);

  const shape = shapeId ? shapes.find(s => s.id === shapeId) : null;
  const multiSelected = selectedIds.length > 1;
  const isGroup = !!shape?.isGroup;
  const isLocked = !!shape?.locked;
  const isHidden = !!shape?.hidden;
  const isFrame = shape?.type === 'frame';
  const isText = shape?.type === 'text';

  const sep = <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />;

  // ── Style clipboard ──
  const copyStyle = () => {
    if (!shape) return;
    onSetStyleClipboard({
      fill: shape.fill, fillType: shape.fillType, fillOpacity: shape.fillOpacity,
      stroke: shape.stroke, strokeWidth: shape.strokeWidth, strokeDash: shape.strokeDash,
      strokePosition: shape.strokePosition,
      opacity: shape.opacity, shadow: shape.shadow, shadowColor: shape.shadowColor,
      shadowX: shape.shadowX, shadowY: shape.shadowY, shadowBlur: shape.shadowBlur,
      shadows: shape.shadows,
      borderRadius: shape.borderRadius, color: shape.color, fontSize: shape.fontSize,
      fontWeight: shape.fontWeight, fontFamily: shape.fontFamily,
      gradientStops: shape.gradientStops, gradientAngle: shape.gradientAngle,
      filterBlur: shape.filterBlur, filterBrightness: shape.filterBrightness,
      filterContrast: shape.filterContrast, filterSaturate: shape.filterSaturate,
    });
    onClose();
  };

  const pasteStyle = () => {
    if (!styleClipboard || !shapeId) return;
    onShapeChange?.(shapeId, styleClipboard);
    onClose();
  };

  // ── Visibility / lock ──
  const toggleLock = () => {
    if (!shapeId || !shape) return;
    onShapeChange?.(shapeId, { locked: !isLocked });
    onClose();
  };

  const toggleHide = () => {
    if (!shapeId || !shape) return;
    onShapeChange?.(shapeId, { hidden: !isHidden });
    onClose();
  };

  // ── Flip ──
  const flipH = () => {
    if (!shapeId || !shape) return;
    onShapeChange?.(shapeId, { flipX: !shape.flipX });
    onClose();
  };

  const flipV = () => {
    if (!shapeId || !shape) return;
    onShapeChange?.(shapeId, { flipY: !shape.flipY });
    onClose();
  };

  // ── Convert to Frame ──
  const convertToFrame = () => {
    if (!shapeId || !shape || isFrame) return;
    onShapeChange?.(shapeId, {
      type: 'frame',
      fill: 'transparent',
      stroke: '#6366f1',
      strokeWidth: 1,
    });
    onClose();
  };

  // ── Convert Frame to Rectangle ──
  const convertToRect = () => {
    if (!shapeId || !shape || !isFrame) return;
    onShapeChange?.(shapeId, {
      type: 'rectangle',
      fill: shape.fill === 'transparent' ? '#e2e8f0' : shape.fill,
      stroke: 'transparent',
      strokeWidth: 0,
    });
    onClose();
  };

  // ── Copy as CSS ──
  const copyAsCss = () => {
    if (!shape) return;
    navigator.clipboard.writeText(shapeToCss(shape)).catch(() => {});
    onClose();
  };

  // ── Copy as SVG ──
  const copyAsSvg = () => {
    if (!shape) return;
    let svgContent = '';
    if (shape.type === 'path' && shape.points && shape.points.length > 0) {
      const d = buildPathD(shape.points, shape.pathClosed ?? false);
      svgContent = `<path d="${d}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" />`;
    } else if (shape.type === 'ellipse') {
      const cx = shape.width / 2;
      const cy = shape.height / 2;
      svgContent = `<ellipse cx="${cx}" cy="${cy}" rx="${cx}" ry="${cy}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" />`;
    } else if (shape.type === 'text') {
      svgContent = `<text x="0" y="${shape.fontSize}" font-size="${shape.fontSize}" fill="${shape.color}" font-family="${shape.fontFamily}">${shape.text}</text>`;
    } else {
      const r = typeof shape.borderRadius === 'number' ? shape.borderRadius : (shape.borderRadius?.[0] ?? 0);
      svgContent = `<rect width="${shape.width}" height="${shape.height}" rx="${r}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" />`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">\n  ${svgContent}\n</svg>`;
    navigator.clipboard.writeText(svg).catch(() => {});
    onClose();
  };

  // ── Copy name ──
  const copyName = () => {
    if (!shape) return;
    navigator.clipboard.writeText(shape.name).catch(() => {});
    onClose();
  };

  // ── Copy position/size as JSON ──
  const copyAsJson = () => {
    if (!shape) return;
    const data = { id: shape.id, name: shape.name, x: shape.x, y: shape.y, width: shape.width, height: shape.height, type: shape.type };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).catch(() => {});
    onClose();
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: clampedX,
        top: clampedY,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '4px 0',
        minWidth: MENU_W,
        boxShadow: '0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
        zIndex: 9999,
        fontSize: 12,
        color: 'var(--text)',
        userSelect: 'none',
      }}
    >
      {shapeId && shape ? (
        <>
          {/* Shape info header */}
          <div style={{
            padding: '6px 14px 7px', fontSize: 10, color: 'var(--muted)',
            display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: '1px solid var(--border)', marginBottom: 3,
          }}>
            <span style={{ fontSize: 11, opacity: 0.5 }}>
              {isFrame ? '▣' : shape.type === 'ellipse' ? '●' : shape.type === 'text' ? 'T' : shape.type === 'path' ? '✏' : '■'}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--text)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {multiSelected ? `${selectedIds.length} shapes selected` : shape.name}
            </span>
            {!multiSelected && (
              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--subtle)', fontFamily: 'monospace' }}>
                {Math.round(shape.width)}×{Math.round(shape.height)}
              </span>
            )}
          </div>

          {/* Edit actions */}
          <CtxItem label="Duplicate" shortcut="⌘D" icon="⎘" onClick={() => { onClose(); onDuplicate?.(); }} />
          <CtxItem label="Copy" shortcut="⌘C" icon="⌘" onClick={() => { onClose(); onCopy?.(); }} />
          {sep}

          {/* Copy as submenu */}
          <button
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setCopyAsExpanded(v => !v); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none',
              color: 'var(--text)', cursor: 'pointer', padding: '5px 14px',
              fontSize: 12,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 13, opacity: 0.7, width: 16, textAlign: 'center' }}>⬡</span>
              Copy as…
            </span>
            <span style={{ color: 'var(--subtle)', fontSize: 10, transform: copyAsExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s', display: 'inline-block' }}>›</span>
          </button>
          {copyAsExpanded && (
            <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 6, margin: '2px 6px', overflow: 'hidden' }}>
              <CtxItem label="Copy Style" shortcut="⌘⌥C" icon="🎨" onClick={copyStyle} />
              {styleClipboard && <CtxItem label="Paste Style" shortcut="⌘⌥V" icon="📋" onClick={pasteStyle} />}
              <CtxItem label="Copy as CSS" icon="{ }" onClick={copyAsCss} />
              <CtxItem label="Copy as SVG" icon="‹›" onClick={copyAsSvg} />
              <CtxItem label="Copy as JSON" icon="{}" onClick={copyAsJson} />
              <CtxItem label="Copy Layer Name" icon="✎" onClick={copyName} />
            </div>
          )}
          {sep}

          {/* Arrange */}
          <CtxSubHeader label="Arrange" />
          <CtxItem label="Bring to Front" shortcut="⌘]" icon="↑" onClick={() => { onClose(); onBringToFront?.(); }} />
          <CtxItem label="Send to Back" shortcut="⌘[" icon="↓" onClick={() => { onClose(); onSendToBack?.(); }} />
          {!isText && (
            <>
              <CtxItem label="Flip Horizontal" icon="⇄" onClick={flipH} />
              <CtxItem label="Flip Vertical" icon="⇅" onClick={flipV} />
            </>
          )}
          {sep}

          {/* Group / Frame ops */}
          {multiSelected && (
            <CtxItem label="Group Selection" shortcut="⌘G" icon="▤" onClick={() => { onClose(); onGroup?.(); }} />
          )}
          {(multiSelected || (shapeId && !isFrame)) && (
            <CtxItem label="Wrap in Frame" icon="⬜" onClick={() => { onClose(); onWrapInFrame?.(); }} />
          )}
          {isGroup && (
            <CtxItem label="Ungroup" shortcut="⌘⇧G" icon="▦" onClick={() => { onClose(); onUngroup?.(); }} />
          )}
          {!isFrame && !isText && !isGroup && (
            <CtxItem label="Convert to Frame" icon="▣" onClick={convertToFrame} />
          )}
          {isFrame && (
            <CtxItem label="Convert to Rectangle" icon="■" onClick={convertToRect} />
          )}
          {sep}

          {/* Visibility & Lock */}
          <CtxSubHeader label="Layer" />
          <CtxItem
            label={isLocked ? 'Unlock Layer' : 'Lock Layer'}
            shortcut="L"
            icon={isLocked ? '🔓' : '🔒'}
            onClick={toggleLock}
          />
          <CtxItem
            label={isHidden ? 'Show Layer' : 'Hide Layer'}
            shortcut="⇧H"
            icon={isHidden ? '👁' : '🙈'}
            onClick={toggleHide}
          />
          {sep}

          {sep}

          {/* Quick style variants */}
          {shape && !isText && shapeId && (
            <>
              <CtxSubHeader label="Quick Style" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '2px 10px 6px' }}>
                {[
                  { label: 'Ghost', patch: { fill: 'transparent', fillOpacity: 0, stroke: shape.fill && shape.fill !== 'transparent' ? shape.fill : '#6366f1', strokeWidth: 1.5, shadow: false, shadows: undefined } },
                  { label: 'Filled', patch: { fillOpacity: 1, stroke: 'transparent', strokeWidth: 0 } },
                  { label: 'Outlined', patch: { fill: 'transparent', fillOpacity: 0, stroke: shape.fill && shape.fill !== 'transparent' ? shape.fill : '#6366f1', strokeWidth: 2 } },
                  { label: 'Glass', patch: { fill: '#ffffff', fillOpacity: 0.1, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, filterBackdropBlur: 12 } },
                  { label: 'Dark', patch: { fill: '#0f172a', fillOpacity: 1, stroke: 'transparent', strokeWidth: 0, color: '#e2e8f0' } },
                  { label: 'Gradient', patch: { fillType: 'linear-gradient' as const, gradientStops: [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }], gradientAngle: 135 } },
                ].map(({ label, patch }) => (
                  <button
                    key={label}
                    onClick={() => { onShapeChange?.(shapeId, patch); onClose(); }}
                    style={{
                      background: 'var(--panel-alt)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
                      fontSize: 11, color: 'var(--muted)', textAlign: 'left',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          <CtxItem label="Delete" shortcut="⌫" danger icon="✕" onClick={() => { onClose(); onDelete?.(); }} />
        </>
      ) : (
        <>
          {/* Empty canvas right-click */}
          {onPaste && <CtxItem label="Paste" shortcut="⌘V" icon="📋" onClick={() => { onClose(); onPaste(); }} />}
          {onSelectAll && <CtxItem label="Select All" shortcut="⌘A" icon="⊞" onClick={() => { onClose(); onSelectAll(); }} />}
          {sep}
          <div style={{ padding: '4px 14px 6px', fontSize: 10, color: 'var(--subtle)', fontStyle: 'italic' }}>
            Right-click a shape for options
          </div>
        </>
      )}
    </div>
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

// ── Quick Action Button (used in the floating shape toolbar) ──────────────────

function QuickActionBtn({
  children,
  title,
  onClick,
  active,
  danger,
  zoom,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  zoom: number;
}) {
  const [hovered, setHovered] = useState(false);
  const btnColor = danger
    ? (hovered ? '#ef4444' : 'var(--muted)')
    : active
      ? 'var(--accent)'
      : (hovered ? 'var(--text)' : 'var(--muted)');
  const btnBg = danger
    ? (hovered ? 'rgba(239,68,68,0.12)' : 'transparent')
    : active
      ? 'rgba(99,102,241,0.15)'
      : (hovered ? 'var(--panel-alt)' : 'transparent');
  const sz = Math.max(18, 24 / zoom);
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: sz, height: sz,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: btnBg, border: 'none', borderRadius: Math.max(3, 4 / zoom),
        cursor: 'pointer', color: btnColor, padding: 0, flexShrink: 0,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      {children}
    </button>
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

// ── Canvas background color picker ────────────────────────────────────────────

const BG_PRESETS = [
  { label: 'Default', color: null },
  { label: 'White', color: '#ffffff' },
  { label: 'Light gray', color: '#f0f0f4' },
  { label: 'Dark', color: '#111118' },
  { label: 'Midnight', color: '#0a0a14' },
  { label: 'Blue tint', color: '#0f172a' },
  { label: 'Warm', color: '#1a1208' },
  { label: 'Green tint', color: '#0a1a0f' },
];

function CanvasBgPicker({ color, onChange }: { color: string | null; onChange: (c: string | null) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close, { capture: true });
    return () => document.removeEventListener('mousedown', close, { capture: true });
  }, [open]);

  return (
    <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'all' }}>
      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
            marginBottom: 8,
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Canvas background
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {BG_PRESETS.map((preset) => {
              const isActive = color === preset.color;
              return (
                <button
                  key={preset.label}
                  onClick={() => { onChange(preset.color); setOpen(false); }}
                  title={preset.label}
                  style={{
                    width: 24, height: 24, borderRadius: 5,
                    background: preset.color ?? 'linear-gradient(135deg, #18181f 50%, #2a2a3a 50%)',
                    border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer', padding: 0,
                    boxShadow: isActive ? '0 0 0 1px var(--accent)' : 'none',
                    backgroundImage: preset.color === null
                      ? 'linear-gradient(135deg, #18181f 50%, #2a2a3a 50%)'
                      : undefined,
                  }}
                />
              );
            })}
          </div>
          {/* Custom color input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
              <div style={{
                width: 22, height: 22, borderRadius: 4,
                background: color ?? '#18181f',
                border: '1px solid var(--border)',
              }} />
              <input
                type="color"
                value={color ?? '#18181f'}
                onChange={(e) => onChange(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
              />
            </label>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Custom</span>
            {color !== null && (
              <button
                onClick={() => onChange(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}
                title="Reset to default"
              >Reset</button>
            )}
          </div>
        </div>
      )}

      <button
        onMouseDown={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title="Canvas background color"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 7, padding: '5px 10px',
          backdropFilter: 'blur(8px)', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          pointerEvents: 'all',
        }}
      >
        <div style={{
          width: 12, height: 12, borderRadius: 3,
          background: color ?? 'var(--canvas-bg)',
          border: '1px solid rgba(255,255,255,0.2)',
        }} />
        <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Canvas</span>
      </button>
    </div>
  );
}
