import { useCallback, useReducer, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Tool } from '../components/layout/ToolSidebar';
import { type Shape, type ShapeType, type BezierPoint, defaultShape, shapesToJsx, pathBbox } from '../lib/shapes';

interface DrawState {
  shapes: Shape[];
  selectedId: string | null;       // "primary" selected — last clicked, used for inspect panel
  selectedIds: string[];           // all selected ids (multi-select)
  drafting: {
    shape: Shape;
    originX: number;
    originY: number;
  } | null;
  draggingHandle:
    | { id: string; handle: HandleDir; originX: number; originY: number; snapshot: Shape }
    | null;
  draggingMove:
    | { id: string; originX: number; originY: number; snapshot: Shape[] }  // snapshot is array for multi-move
    | null;
  marquee: { x: number; y: number; width: number; height: number } | null;
}

export type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

type Action =
  | { type: 'START_DRAW'; shape: Shape; originX: number; originY: number }
  | { type: 'UPDATE_DRAFT'; x: number; y: number; width: number; height: number }
  | { type: 'COMMIT_DRAFT' }
  | { type: 'CANCEL_DRAFT' }
  | { type: 'SELECT'; id: string | null }
  | { type: 'ADD_TO_SELECTION'; id: string }
  | { type: 'REMOVE_FROM_SELECTION'; id: string }
  | { type: 'SELECT_ALL' }
  | { type: 'SET_SELECTED_IDS'; ids: string[] }
  | { type: 'DELETE_SELECTED' }
  | { type: 'UPDATE_SHAPE'; id: string; patch: Partial<Shape> }
  | { type: 'SET_SHAPES'; shapes: Shape[] }
  | { type: 'START_MOVE'; id: string; originX: number; originY: number; snapshots: Shape[] }
  | { type: 'MOVE'; x: number; y: number }
  | { type: 'END_MOVE' }
  | { type: 'START_RESIZE'; id: string; handle: HandleDir; originX: number; originY: number; snapshot: Shape }
  | { type: 'RESIZE'; x: number; y: number }
  | { type: 'END_RESIZE' }
  | { type: 'SET_MARQUEE'; x: number; y: number; width: number; height: number }
  | { type: 'COMMIT_MARQUEE' }
  | { type: 'CLEAR' };

function reducer(state: DrawState, action: Action): DrawState {
  switch (action.type) {
    case 'START_DRAW':
      return { ...state, drafting: { shape: action.shape, originX: action.originX, originY: action.originY }, selectedId: null, selectedIds: [] };

    case 'UPDATE_DRAFT':
      if (!state.drafting) return state;
      return {
        ...state,
        drafting: {
          ...state.drafting,
          shape: { ...state.drafting.shape, x: action.x, y: action.y, width: action.width, height: action.height },
        },
      };

    case 'COMMIT_DRAFT': {
      if (!state.drafting) return state;
      let s = state.drafting.shape;
      // Text shapes: a single click (width/height ≈ 0) → give a default size so they actually appear
      if (s.type === 'text' && s.width < 4 && s.height < 4) {
        s = { ...s, width: 200, height: 40 };
      } else if (s.width < 4 && s.height < 4) {
        return { ...state, drafting: null };
      }
      return {
        ...state,
        shapes: [...state.shapes, s],
        drafting: null,
        selectedId: s.id,
        selectedIds: [s.id],
      };
    }

    case 'CANCEL_DRAFT':
      return { ...state, drafting: null };

    case 'SELECT':
      return { ...state, selectedId: action.id, selectedIds: action.id ? [action.id] : [] };

    case 'ADD_TO_SELECTION': {
      if (state.selectedIds.includes(action.id)) return state;
      const ids = [...state.selectedIds, action.id];
      return { ...state, selectedIds: ids, selectedId: action.id };
    }

    case 'REMOVE_FROM_SELECTION': {
      const ids = state.selectedIds.filter(id => id !== action.id);
      return { ...state, selectedIds: ids, selectedId: ids[ids.length - 1] ?? null };
    }

    case 'SELECT_ALL': {
      const ids = state.shapes.map(s => s.id);
      return { ...state, selectedIds: ids, selectedId: ids[ids.length - 1] ?? null };
    }

    case 'SET_SELECTED_IDS': {
      return { ...state, selectedIds: action.ids, selectedId: action.ids[action.ids.length - 1] ?? null };
    }

    case 'DELETE_SELECTED': {
      const toDelete = new Set(state.selectedIds);
      if (toDelete.size === 0 && state.selectedId) toDelete.add(state.selectedId);
      if (toDelete.size === 0) return state;
      return { ...state, shapes: state.shapes.filter((s) => !toDelete.has(s.id)), selectedId: null, selectedIds: [] };
    }

    case 'UPDATE_SHAPE': {
      return {
        ...state,
        shapes: state.shapes.map((s) => {
          if (s.id !== action.id) return s;
          const merged = { ...s, ...action.patch };
          // Recompute bbox for paths whenever points change
          if (merged.type === 'path' && action.patch.points && merged.points && merged.points.length >= 2) {
            const bb = pathBbox(merged.points, merged.pathClosed ?? false);
            merged.x = bb.x; merged.y = bb.y; merged.width = bb.width; merged.height = bb.height;
          }
          return merged;
        }),
      };
    }

    case 'SET_SHAPES':
      return { ...state, shapes: action.shapes };

    case 'START_MOVE':
      return { ...state, draggingMove: { id: action.id, originX: action.originX, originY: action.originY, snapshot: action.snapshots } };

    case 'MOVE': {
      if (!state.draggingMove) return state;
      const { originX, originY, snapshot: snapshots } = state.draggingMove;
      const dx = action.x - originX;
      const dy = action.y - originY;
      // Build a lookup map from snapshots
      const snapMap = new Map(snapshots.map(s => [s.id, s]));
      return {
        ...state,
        shapes: state.shapes.map((s) => {
          const snap = snapMap.get(s.id);
          if (!snap) return s;
          // Path shapes: translate all points, keep x/y in sync with bounding box
          if (s.type === 'path' && snap.points) {
            const movedPoints = snap.points.map(p => ({
              ...p,
              x: p.x + dx,
              y: p.y + dy,
              ...(p.cp1x != null ? { cp1x: p.cp1x + dx, cp1y: p.cp1y! + dy } : {}),
              ...(p.cp2x != null ? { cp2x: p.cp2x + dx, cp2y: p.cp2y! + dy } : {}),
            }));
            return { ...s, x: snap.x + dx, y: snap.y + dy, points: movedPoints };
          }
          return { ...s, x: snap.x + dx, y: snap.y + dy };
        }),
      };
    }

    case 'END_MOVE':
      return { ...state, draggingMove: null };

    case 'START_RESIZE':
      return {
        ...state,
        draggingHandle: { id: action.id, handle: action.handle, originX: action.originX, originY: action.originY, snapshot: action.snapshot },
      };

    case 'RESIZE': {
      if (!state.draggingHandle) return state;
      const { id, handle, originX, originY, snapshot } = state.draggingHandle;
      const dx = action.x - originX;
      const dy = action.y - originY;
      const updated = handle === 'rotate'
        ? applyRotate(snapshot, dx, dy, action.x, action.y, originX, originY)
        : applyResize(snapshot, handle, dx, dy);
      return {
        ...state,
        shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updated } : s)),
      };
    }

    case 'END_RESIZE':
      return { ...state, draggingHandle: null };

    case 'SET_MARQUEE':
      return { ...state, marquee: { x: action.x, y: action.y, width: action.width, height: action.height } };

    case 'COMMIT_MARQUEE': {
      if (!state.marquee) return state;
      const { x, y, width, height } = state.marquee;
      const mx = Math.min(x, x + width);
      const my = Math.min(y, y + height);
      const mw = Math.abs(width);
      const mh = Math.abs(height);
      const ids = state.shapes
        .filter(s => s.x < mx + mw && s.x + s.width > mx && s.y < my + mh && s.y + s.height > my)
        .map(s => s.id);
      return { ...state, marquee: null, selectedIds: ids, selectedId: ids[ids.length - 1] ?? null };
    }

    case 'CLEAR':
      return { shapes: [], selectedId: null, selectedIds: [], drafting: null, draggingHandle: null, draggingMove: null, marquee: null };

    default:
      return state;
  }
}

function applyResize(
  snap: Shape,
  handle: HandleDir,
  dx: number,
  dy: number
): Pick<Shape, 'x' | 'y' | 'width' | 'height'> {
  let { x, y, width, height } = snap;
  const MIN = 8;

  if (handle.includes('e')) width = Math.max(MIN, width + dx);
  if (handle.includes('s')) height = Math.max(MIN, height + dy);
  if (handle.includes('w')) { const nw = Math.max(MIN, width - dx); x = x + (width - nw); width = nw; }
  if (handle.includes('n')) { const nh = Math.max(MIN, height - dy); y = y + (height - nh); height = nh; }

  return { x, y, width, height };
}

function applyRotate(snap: Shape, _dx: number, _dy: number, currentX?: number, currentY?: number, originX?: number, originY?: number): Pick<Shape, 'rotation'> {
  const cx = snap.x + snap.width / 2;
  const cy = snap.y + snap.height / 2;

  if (currentX !== undefined && currentY !== undefined && originX !== undefined && originY !== undefined) {
    // Angle from shape center to current mouse position
    const angle = Math.atan2(currentY - cy, currentX - cx) * (180 / Math.PI) + 90;
    const rotation = ((angle) % 360 + 360) % 360;
    return { rotation };
  }

  // Fallback: drag delta approximation
  const rotation = ((snap.rotation + _dx * 0.5) % 360 + 360) % 360;
  return { rotation };
}

export function useDrawingTools(onShapesChange: (jsx: string, shapes: Shape[]) => void) {
  const [state, dispatch] = useReducer(reducer, {
    shapes: [],
    selectedId: null,
    selectedIds: [],
    drafting: null,
    draggingHandle: null,
    draggingMove: null,
    marquee: null,
  });

  // Always-current ref so callbacks can read latest shapes without stale closures
  // Updated during render, so reflects the shapes from the most recent completed render.
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Undo/Redo history ──────────────────────────────────────────────────────
  interface HistoryEntry { shapes: Shape[]; label: string; }
  const historyRef = useRef<HistoryEntry[]>([{ shapes: [], label: 'Initial state' }]);
  const historyIndexRef = useRef(0);
  const clipboardRef = useRef<Shape | null>(null);
  // Expose history as state so components can re-render when it changes
  const [historyVersion, setHistoryVersion] = useState(0);

  const pushHistory = useCallback((shapes: Shape[], label: string) => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push({ shapes, label });
    if (historyRef.current.length > 100) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    setHistoryVersion(v => v + 1);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const { shapes } = historyRef.current[historyIndexRef.current];
    dispatch({ type: 'SET_SHAPES', shapes });
    onShapesChange(shapesToJsx(shapes), shapes);
    setHistoryVersion(v => v + 1);
  }, [onShapesChange]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const { shapes } = historyRef.current[historyIndexRef.current];
    dispatch({ type: 'SET_SHAPES', shapes });
    onShapesChange(shapesToJsx(shapes), shapes);
    setHistoryVersion(v => v + 1);
  }, [onShapesChange]);

  const jumpToHistory = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, historyRef.current.length - 1));
    historyIndexRef.current = clamped;
    const { shapes } = historyRef.current[clamped];
    dispatch({ type: 'SET_SHAPES', shapes });
    onShapesChange(shapesToJsx(shapes), shapes);
    setHistoryVersion(v => v + 1);
  }, [onShapesChange]);

  const emit = useCallback(
    (shapes: Shape[], label = 'Change', saveHistory = true) => {
      if (saveHistory) pushHistory(shapes, label);
      onShapesChange(shapesToJsx(shapes), shapes);
    },
    [onShapesChange, pushHistory]
  );

  // ── Copy / Paste / Duplicate ───────────────────────────────────────────────

  const copy = useCallback(() => {
    const { shapes, selectedId } = stateRef.current;
    const shape = shapes.find(s => s.id === selectedId);
    if (shape) clipboardRef.current = shape;
  }, []);

  const paste = useCallback(() => {
    const src = clipboardRef.current;
    if (!src) return;
    const { shapes } = stateRef.current;
    const newShape: Shape = { ...src, id: uuid(), x: src.x + 20, y: src.y + 20 };
    const next = [...shapes, newShape];
    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SELECT', id: newShape.id });
    emit(next, 'Paste');
  }, [emit]);

  const duplicate = useCallback(() => {
    const { shapes, selectedId } = stateRef.current;
    const shape = shapes.find(s => s.id === selectedId);
    if (!shape) return;
    const newShape: Shape = { ...shape, id: uuid(), x: shape.x + 20, y: shape.y + 20 };
    const next = [...shapes, newShape];
    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SELECT', id: newShape.id });
    emit(next, `Duplicate ${shape.name}`);
  }, [emit]);

  // ── Bring to front / Send to back ─────────────────────────────────────────

  const bringToFront = useCallback(() => {
    const { shapes, selectedId } = stateRef.current;
    const idx = shapes.findIndex(s => s.id === selectedId);
    if (idx < 0 || idx === shapes.length - 1) return;
    const next = [...shapes];
    next.push(next.splice(idx, 1)[0]);
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Bring to front');
  }, [emit]);

  const sendToBack = useCallback(() => {
    const { shapes, selectedId } = stateRef.current;
    const idx = shapes.findIndex(s => s.id === selectedId);
    if (idx <= 0) return;
    const next = [...shapes];
    next.unshift(next.splice(idx, 1)[0]);
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Send to back');
  }, [emit]);

  // ── Drawing ────────────────────────────────────────────────────────────────

  const startDraw = useCallback(
    (tool: Tool, canvasX: number, canvasY: number) => {
      if (!isDrawingTool(tool)) return;
      const shape = defaultShape(tool as ShapeType, uuid());
      shape.x = canvasX;
      shape.y = canvasY;
      shape.width = 0;
      shape.height = 0;
      dispatch({ type: 'START_DRAW', shape, originX: canvasX, originY: canvasY });
    },
    []
  );

  const updateDraft = useCallback((canvasX: number, canvasY: number, originX: number, originY: number) => {
    const x = Math.min(canvasX, originX);
    const y = Math.min(canvasY, originY);
    const width = Math.abs(canvasX - originX);
    const height = Math.abs(canvasY - originY);
    dispatch({ type: 'UPDATE_DRAFT', x, y, width, height });
  }, []);

  const commitDraft = useCallback(
    () => {
      const { shapes, drafting } = stateRef.current;
      dispatch({ type: 'COMMIT_DRAFT' });
      if (!drafting) return;
      const s = drafting.shape;
      // Text shape created by single click gets default size (see reducer) — still commit to history
      const isTextClick = s.type === 'text' && s.width < 4 && s.height < 4;
      const finalShape = isTextClick ? { ...s, width: 200, height: 40 } : s;
      if (isTextClick || (s.width >= 4 && s.height >= 4)) {
        const next = [...shapes, finalShape];
        const typeLabel = finalShape.type.charAt(0).toUpperCase() + finalShape.type.slice(1);
        emit(next, `Add ${typeLabel}`);
      }
    },
    [emit]
  );

  const cancelDraft = useCallback(() => dispatch({ type: 'CANCEL_DRAFT' }), []);

  // ── Selection ──────────────────────────────────────────────────────────────

  const select = useCallback((id: string | null) => dispatch({ type: 'SELECT', id }), []);

  const addToSelection = useCallback((id: string) => dispatch({ type: 'ADD_TO_SELECTION', id }), []);
  const removeFromSelection = useCallback((id: string) => dispatch({ type: 'REMOVE_FROM_SELECTION', id }), []);
  const selectAll = useCallback(() => dispatch({ type: 'SELECT_ALL' }), []);
  const setSelectedIds = useCallback((ids: string[]) => dispatch({ type: 'SET_SELECTED_IDS', ids }), []);

  const setMarquee = useCallback((x: number, y: number, width: number, height: number) => {
    dispatch({ type: 'SET_MARQUEE', x, y, width, height });
  }, []);
  const commitMarquee = useCallback(() => dispatch({ type: 'COMMIT_MARQUEE' }), []);

  const deleteSelected = useCallback(
    () => {
      const { shapes, selectedIds, selectedId } = stateRef.current;
      const toDelete = new Set(selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : []));
      dispatch({ type: 'DELETE_SELECTED' });
      if (toDelete.size > 0) {
        const next = shapes.filter((s) => !toDelete.has(s.id));
        const label = toDelete.size > 1 ? `Delete ${toDelete.size} shapes` : `Delete ${shapes.find(s => toDelete.has(s.id))?.name ?? 'shape'}`;
        emit(next, label);
      }
    },
    [emit]
  );

  // ── Move ───────────────────────────────────────────────────────────────────

  const startMove = useCallback((id: string, mouseX: number, mouseY: number, _snapshot: Shape) => {
    // When moving, capture all selected shapes as snapshots
    const { shapes, selectedIds } = stateRef.current;
    const ids = selectedIds.includes(id) ? selectedIds : [id];
    const snapshots = shapes.filter(s => ids.includes(s.id));
    dispatch({ type: 'START_MOVE', id, originX: mouseX, originY: mouseY, snapshots });
  }, []);

  const move = useCallback((mouseX: number, mouseY: number) => {
    dispatch({ type: 'MOVE', x: mouseX, y: mouseY });
  }, []);

  const endMove = useCallback(
    () => {
      const shapes = stateRef.current.shapes;
      const { selectedIds, selectedId } = stateRef.current;
      const movedCount = selectedIds.length > 1 ? selectedIds.length : 1;
      const movedName = movedCount > 1 ? `${movedCount} shapes` : (shapes.find(s => s.id === selectedId)?.name ?? 'shape');
      dispatch({ type: 'END_MOVE' });
      emit(shapes, `Move ${movedName}`);
    },
    [emit]
  );

  // ── Resize ─────────────────────────────────────────────────────────────────

  const startResize = useCallback(
    (id: string, handle: HandleDir, mouseX: number, mouseY: number, snapshot: Shape) => {
      dispatch({ type: 'START_RESIZE', id, handle, originX: mouseX, originY: mouseY, snapshot });
    },
    []
  );

  const resize = useCallback((mouseX: number, mouseY: number) => {
    dispatch({ type: 'RESIZE', x: mouseX, y: mouseY });
  }, []);

  const endResize = useCallback(
    () => {
      const shapes = stateRef.current.shapes;
      const { selectedId, draggingHandle } = stateRef.current;
      const shapeName = shapes.find(s => s.id === selectedId)?.name ?? 'shape';
      const action = draggingHandle?.handle === 'rotate' ? 'Rotate' : 'Resize';
      dispatch({ type: 'END_RESIZE' });
      emit(shapes, `${action} ${shapeName}`);
    },
    [emit]
  );

  // ── Property editing ───────────────────────────────────────────────────────

  /** Live preview — updates overlay instantly, no history/emit (use commitShape after) */
  const previewShape = useCallback(
    (id: string, patch: Partial<Shape>) => {
      dispatch({ type: 'UPDATE_SHAPE', id, patch });
    },
    []
  );

  /** Commit — updates overlay + saves to history + emits JSX */
  const updateShape = useCallback(
    (id: string, patch: Partial<Shape>) => {
      const shapes = stateRef.current.shapes;
      dispatch({ type: 'UPDATE_SHAPE', id, patch });
      const next = shapes.map((s) => (s.id === id ? { ...s, ...patch } : s));
      const shapeName = shapes.find(s => s.id === id)?.name ?? 'shape';
      const propLabel = Object.keys(patch).length === 1
        ? Object.keys(patch)[0].replace(/([A-Z])/g, ' $1').toLowerCase()
        : 'properties';
      emit(next, `Edit ${shapeName} ${propLabel}`);
    },
    [emit]
  );

  // ── Group / Ungroup ───────────────────────────────────────────────────────

  const group = useCallback(() => {
    const { shapes, selectedIds } = stateRef.current;
    if (selectedIds.length < 2) return;

    // Only group top-level shapes (skip already-grouped children)
    const selected = shapes.filter(s => selectedIds.includes(s.id) && !s.parentId);
    if (selected.length < 2) return;

    // Compute bounding box
    const x = Math.min(...selected.map(s => s.x));
    const y = Math.min(...selected.map(s => s.y));
    const x2 = Math.max(...selected.map(s => s.x + s.width));
    const y2 = Math.max(...selected.map(s => s.y + s.height));
    const width = x2 - x;
    const height = y2 - y;

    const groupId = uuid();
    const groupShape: Shape = {
      ...defaultShape('frame', groupId),
      x, y, width, height,
      name: 'Group',
      isGroup: true,
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      children: selected.map(s => s.id),
    };

    // Mark children with parentId, keep them in the flat shapes array
    const withParents = shapes.map(s =>
      selected.some(sel => sel.id === s.id) ? { ...s, parentId: groupId } : s
    );
    // Insert group before its first child so it renders behind children
    const firstChildIdx = withParents.findIndex(s => s.parentId === groupId);
    const next = [...withParents];
    next.splice(firstChildIdx, 0, groupShape);

    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SELECT', id: groupId });
    emit(next, `Group ${selected.length} shapes`);
  }, [emit]);

  const ungroup = useCallback(() => {
    const { shapes, selectedId } = stateRef.current;
    const groupShape = shapes.find(s => s.id === selectedId && s.isGroup);
    if (!groupShape) return;

    const next = shapes
      .filter(s => s.id !== groupShape.id)
      .map(s => s.parentId === groupShape.id ? { ...s, parentId: undefined } : s);

    const childIds = next.filter(s => groupShape.children.includes(s.id)).map(s => s.id);
    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SET_SELECTED_IDS', ids: childIds });
    emit(next, 'Ungroup');
  }, [emit]);

  // ── Add a single shape (used by AI frame injection) ───────────────────────

  const addShape = useCallback((shape: Shape) => {
    const { shapes } = stateRef.current;
    const next = [...shapes, shape];
    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SELECT', id: shape.id });
    emit(next, `Add ${shape.name}`);
  }, [emit]);

  // ── Pen tool (Illustrator-style bezier) ───────────────────────────────────
  // Pen state lives outside of reducer — ephemeral drawing state, not committed shape state.
  //
  // Each node: { x, y, cp1x?, cp1y?, cp2x?, cp2y? }
  //   cp2 = outgoing handle (set while dragging on mouse-down for a new point)
  //   cp1 = incoming handle (mirrored from cp2 at placement time, for smooth nodes)
  //
  // penDragState: non-null while the user is dragging a handle after placing the latest point.
  //   { mode: 'new-point' }  — dragging the out-handle of the freshly-placed last node
  //   { mode: 'existing', index, handle: 'cp1'|'cp2' } — adjusting a committed node's handle
  const [penPoints, setPenPoints] = useState<BezierPoint[]>([]);
  const [penCursor, setPenCursor] = useState<{ x: number; y: number } | null>(null);
  const [penDragPointIndex, setPenDragPointIndex] = useState<number | null>(null); // kept for API compat
  const penPointsRef = useRef<BezierPoint[]>([]);
  penPointsRef.current = penPoints;

  // While the user holds the mouse button down after clicking a new anchor point,
  // we track that we're pulling out the "out" bezier handle for the last node.
  const penPullingHandleRef = useRef(false);

  /** Called on mouse-down (click) at canvas position (x,y). Adds a new anchor. */
  const penAddPoint = useCallback((x: number, y: number) => {
    setPenPoints(pts => {
      const next: BezierPoint[] = [...pts, { x, y }];
      penPointsRef.current = next;
      return next;
    });
    penPullingHandleRef.current = true; // mouse is still held — user may drag to set handle
  }, []);

  /** Called while mouse is held after placing a new point — drag sets the out-handle. */
  const penPullHandle = useCallback((x: number, y: number) => {
    setPenPoints(pts => {
      if (pts.length === 0) return pts;
      const last = pts[pts.length - 1];
      // Out-handle: from anchor toward cursor
      const cp2x = x;
      const cp2y = y;
      // In-handle: mirrored (smooth node)
      const cp1x = 2 * last.x - x;
      const cp1y = 2 * last.y - y;
      const updated: BezierPoint = { ...last, cp2x, cp2y, cp1x, cp1y };
      const next = [...pts.slice(0, -1), updated];
      penPointsRef.current = next;
      return next;
    });
  }, []);

  /** Called on mouse-up after placing a point (ends handle-pull). */
  const penEndHandlePull = useCallback(() => {
    penPullingHandleRef.current = false;
  }, []);

  /** Called when user drags an existing anchor node (repositioning it). */
  const penStartDragPoint = useCallback((index: number) => {
    setPenDragPointIndex(index);
  }, []);

  const penDragPointIndexRef = useRef<number | null>(null);
  penDragPointIndexRef.current = penDragPointIndex;

  const penDragPoint = useCallback((x: number, y: number) => {
    const idx = penDragPointIndexRef.current;
    if (idx === null) return;
    setPenPoints(pts => {
      const p = pts[idx];
      const dx = x - p.x;
      const dy = y - p.y;
      const moved: BezierPoint = {
        ...p,
        x, y,
        ...(p.cp1x != null ? { cp1x: p.cp1x + dx, cp1y: p.cp1y! + dy } : {}),
        ...(p.cp2x != null ? { cp2x: p.cp2x + dx, cp2y: p.cp2y! + dy } : {}),
      };
      const next = pts.map((pt, i) => i === idx ? moved : pt);
      penPointsRef.current = next;
      return next;
    });
  }, []);

  const penEndDragPoint = useCallback(() => {
    setPenDragPointIndex(null);
  }, []);

  const penMoveCursor = useCallback((x: number, y: number) => {
    setPenCursor({ x, y });
  }, []);

  const penCommit = useCallback((closed = false) => {
    const pts = penPointsRef.current;
    if (pts.length < 2) {
      setPenPoints([]);
      setPenCursor(null);
      penPullingHandleRef.current = false;
      return;
    }
    const { shapes } = stateRef.current;
    const shape = defaultShape('path', uuid());
    shape.points = pts;
    shape.pathClosed = closed;
    // Exact bounding box from cubic bezier extremes
    const bb = pathBbox(pts, closed);
    shape.x = bb.x; shape.y = bb.y; shape.width = bb.width; shape.height = bb.height;
    const next = [...shapes, shape];
    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SELECT', id: shape.id });
    emit(next, 'Add Path');
    setPenPoints([]);
    setPenCursor(null);
    penPullingHandleRef.current = false;
  }, [emit]);

  const penCancel = useCallback(() => {
    setPenPoints([]);
    setPenCursor(null);
    penPullingHandleRef.current = false;
  }, []);

  // ── Clear ──────────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    historyRef.current = [{ shapes: [], label: 'Initial state' }];
    historyIndexRef.current = 0;
    setHistoryVersion(v => v + 1);
  }, []);

  // ── Load shapes (for page switching) ──────────────────────────────────────

  const loadShapes = useCallback((shapes: Shape[]) => {
    dispatch({ type: 'SET_SHAPES', shapes });
    dispatch({ type: 'SELECT', id: null });
    dispatch({ type: 'SET_SELECTED_IDS', ids: [] });
    historyRef.current = [{ shapes, label: 'Load page' }];
    historyIndexRef.current = 0;
    setHistoryVersion(v => v + 1);
    onShapesChange(shapesToJsx(shapes), shapes);
  }, [onShapesChange]);

  // Expose history for the history panel — derived from historyVersion so it re-renders
  const historyEntries = historyRef.current.map((e, i) => ({ label: e.label, index: i }));
  const historyIndex = historyIndexRef.current;

  return {
    state,
    startDraw,
    updateDraft,
    commitDraft,
    cancelDraft,
    select,
    addToSelection,
    removeFromSelection,
    selectAll,
    setSelectedIds,
    setMarquee,
    commitMarquee,
    deleteSelected,
    startMove,
    move,
    endMove,
    startResize,
    resize,
    endResize,
    previewShape,
    updateShape,
    clearAll,
    loadShapes,
    undo,
    redo,
    jumpToHistory,
    historyEntries,
    historyIndex,
    copy,
    paste,
    duplicate,
    bringToFront,
    sendToBack,
    group,
    ungroup,
    addShape,
    // Pen tool
    penPoints,
    penCursor,
    penDragPointIndex,
    penPullingHandleRef, // expose ref so CanvasOverlay can read it
    penAddPoint,
    penPullHandle,
    penEndHandlePull,
    penMoveCursor,
    penStartDragPoint,
    penDragPoint,
    penEndDragPoint,
    penCommit,
    penCancel,
  };
}

export function isDrawingTool(tool: Tool): boolean {
  return tool === 'frame' || tool === 'rectangle' || tool === 'ellipse' || tool === 'text';
}

export function isPenTool(tool: Tool): boolean {
  return tool === 'pen';
}
