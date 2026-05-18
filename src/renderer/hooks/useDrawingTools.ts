import { useCallback, useReducer, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Tool } from '../components/layout/ToolSidebar';
import { type Shape, type ShapeType, type BezierPoint, defaultShape, shapesToJsx, pathBbox, applyAutoLayout } from '../lib/shapes';

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
      const updatedShapes = state.shapes.map((s) => {
        if (s.id !== action.id) return s;
        const merged = { ...s, ...action.patch };
        // Recompute bbox for paths whenever points change
        if (merged.type === 'path' && action.patch.points && merged.points && merged.points.length >= 2) {
          const bb = pathBbox(merged.points, merged.pathClosed ?? false);
          merged.x = bb.x; merged.y = bb.y; merged.width = bb.width; merged.height = bb.height;
        }
        return merged;
      });
      return { ...state, shapes: applyAutoLayout(updatedShapes) };
    }

    case 'SET_SHAPES':
      return { ...state, shapes: applyAutoLayout(action.shapes) };

    case 'START_MOVE':
      return { ...state, draggingMove: { id: action.id, originX: action.originX, originY: action.originY, snapshot: action.snapshots } };

    case 'MOVE': {
      if (!state.draggingMove) return state;
      const { originX, originY, snapshot: snapshots } = state.draggingMove;
      const dx = action.x - originX;
      const dy = action.y - originY;
      // Build a lookup map from snapshots
      const snapMap = new Map(snapshots.map(s => [s.id, s]));
      const movedShapes = state.shapes.map((s) => {
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
      });
      return { ...state, shapes: applyAutoLayout(movedShapes) };
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
      // Apply constraints to children if this is a frame/group being resized
      const parentShape = state.shapes.find(s => s.id === id);
      const newParentSize = updated as { x?: number; y?: number; width?: number; height?: number };
      const constrainedChildren = (parentShape && !handle.includes('rotate') && parentShape.children?.length)
        ? applyConstraintsToChildren(state.shapes, id, parentShape, newParentSize)
        : null;
      const resizedShapes = state.shapes.map((s) => {
        if (s.id === id) return { ...s, ...updated };
        if (constrainedChildren) {
          const constrained = constrainedChildren.get(s.id);
          if (constrained) return { ...s, ...constrained };
        }
        return s;
      });
      return { ...state, shapes: applyAutoLayout(resizedShapes) };
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

/**
 * Apply responsive constraints to child shapes when their parent frame is resized.
 * Returns a Map of childId → position/size patch.
 */
function applyConstraintsToChildren(
  allShapes: Shape[],
  parentId: string,
  oldParent: Shape,
  newParent: { x?: number; y?: number; width?: number; height?: number }
): Map<string, Partial<Pick<Shape, 'x' | 'y' | 'width' | 'height'>>> {
  const result = new Map<string, Partial<Pick<Shape, 'x' | 'y' | 'width' | 'height'>>>();
  const nw = newParent.width ?? oldParent.width;
  const nh = newParent.height ?? oldParent.height;
  const dw = nw - oldParent.width;
  const dh = nh - oldParent.height;
  if (dw === 0 && dh === 0) return result;

  const children = allShapes.filter(s => s.parentId === parentId);
  for (const child of children) {
    const patch: Partial<Pick<Shape, 'x' | 'y' | 'width' | 'height'>> = {};
    const cH = child.constraintH ?? 'left';
    const cV = child.constraintV ?? 'top';

    // Relative position within parent (local space)
    const relX = child.x - oldParent.x;
    const relY = child.y - oldParent.y;

    // Horizontal constraint
    if (cH === 'left') {
      // x stays fixed from left — no change needed
    } else if (cH === 'right') {
      // maintain distance from right edge
      const distRight = oldParent.width - (relX + child.width);
      patch.x = (newParent.x ?? oldParent.x) + nw - distRight - child.width;
    } else if (cH === 'center') {
      // maintain horizontal center offset from parent center
      const offsetFromCenter = relX + child.width / 2 - oldParent.width / 2;
      patch.x = (newParent.x ?? oldParent.x) + nw / 2 + offsetFromCenter - child.width / 2;
    } else if (cH === 'left-right') {
      // stretch: pin both left and right
      const distLeft = relX;
      const distRight = oldParent.width - (relX + child.width);
      const newRelX = distLeft;
      const newWidth = Math.max(8, nw - distLeft - distRight);
      patch.x = (newParent.x ?? oldParent.x) + newRelX;
      patch.width = newWidth;
    } else if (cH === 'scale') {
      const scaleX = nw / (oldParent.width || 1);
      patch.x = (newParent.x ?? oldParent.x) + relX * scaleX;
      patch.width = child.width * scaleX;
    }

    // Vertical constraint
    if (cV === 'top') {
      // y stays fixed from top — no change needed
    } else if (cV === 'bottom') {
      const distBottom = oldParent.height - (relY + child.height);
      patch.y = (newParent.y ?? oldParent.y) + nh - distBottom - child.height;
    } else if (cV === 'center') {
      const offsetFromCenter = relY + child.height / 2 - oldParent.height / 2;
      patch.y = (newParent.y ?? oldParent.y) + nh / 2 + offsetFromCenter - child.height / 2;
    } else if (cV === 'top-bottom') {
      const distTop = relY;
      const distBottom = oldParent.height - (relY + child.height);
      const newRelY = distTop;
      const newHeight = Math.max(8, nh - distTop - distBottom);
      patch.y = (newParent.y ?? oldParent.y) + newRelY;
      patch.height = newHeight;
    } else if (cV === 'scale') {
      const scaleY = nh / (oldParent.height || 1);
      patch.y = (newParent.y ?? oldParent.y) + relY * scaleY;
      patch.height = child.height * scaleY;
    }

    if (Object.keys(patch).length > 0) result.set(child.id, patch);
  }
  return result;
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
    // Delta angle from grab point to current point — no jump on first move
    const startAngle = Math.atan2(originY - cy, originX - cx) * (180 / Math.PI);
    const currentAngle = Math.atan2(currentY - cy, currentX - cx) * (180 / Math.PI);
    const delta = currentAngle - startAngle;
    const rotation = ((snap.rotation + delta) % 360 + 360) % 360;
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
  const clipboardRef = useRef<Shape[]>([]);
  const pasteCountRef = useRef(0); // increments each paste so each lands offset from the last
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
    const { shapes, selectedId, selectedIds } = stateRef.current;
    // Copy all selected shapes (multi-select aware)
    const ids = selectedIds.length > 1 ? selectedIds : (selectedId ? [selectedId] : []);
    const copied = ids.map(id => shapes.find(s => s.id === id)).filter(Boolean) as Shape[];
    if (copied.length > 0) {
      clipboardRef.current = copied;
      pasteCountRef.current = 0; // reset cascade on fresh copy
    }
  }, []);

  const paste = useCallback(() => {
    const srcs = clipboardRef.current;
    if (!srcs || srcs.length === 0) return;
    const { shapes } = stateRef.current;
    pasteCountRef.current += 1;
    const offset = pasteCountRef.current * 20;

    // Build id mapping so group children stay linked to their new parent
    const idMap = new Map<string, string>();
    srcs.forEach(s => idMap.set(s.id, uuid()));

    const newShapes: Shape[] = srcs.map(s => ({
      ...s,
      id: idMap.get(s.id)!,
      x: s.x + offset,
      y: s.y + offset,
      name: s.name,
      // Remap children ids if this is a group
      children: (s.children ?? []).map(cid => idMap.get(cid) ?? cid),
      parentId: s.parentId ? (idMap.get(s.parentId) ?? s.parentId) : undefined,
    }));

    const next = [...shapes, ...newShapes];
    dispatch({ type: 'SET_SHAPES', shapes: next });

    if (newShapes.length === 1) {
      dispatch({ type: 'SELECT', id: newShapes[0].id });
    } else {
      dispatch({ type: 'SELECT', id: newShapes[newShapes.length - 1].id });
      dispatch({ type: 'SET_SELECTED_IDS', ids: newShapes.map(s => s.id) });
    }
    emit(next, `Paste (${newShapes.length})`);
  }, [emit]);

  // Paste in place — at original copied position (no offset)
  const pasteInPlace = useCallback(() => {
    const srcs = clipboardRef.current;
    if (!srcs || srcs.length === 0) return;
    const { shapes } = stateRef.current;

    const idMap = new Map<string, string>();
    srcs.forEach(s => idMap.set(s.id, uuid()));

    const newShapes: Shape[] = srcs.map(s => ({
      ...s,
      id: idMap.get(s.id)!,
      // Same position as original — no offset
      children: (s.children ?? []).map(cid => idMap.get(cid) ?? cid),
      parentId: s.parentId ? (idMap.get(s.parentId) ?? s.parentId) : undefined,
    }));

    const next = [...shapes, ...newShapes];
    dispatch({ type: 'SET_SHAPES', shapes: next });

    if (newShapes.length === 1) {
      dispatch({ type: 'SELECT', id: newShapes[0].id });
    } else {
      dispatch({ type: 'SELECT', id: newShapes[newShapes.length - 1].id });
      dispatch({ type: 'SET_SELECTED_IDS', ids: newShapes.map(s => s.id) });
    }
    emit(next, `Paste in place (${newShapes.length})`);
  }, [emit]);

  const duplicate = useCallback(() => {
    const { shapes, selectedId, selectedIds } = stateRef.current;
    const ids = selectedIds.length > 1 ? selectedIds : (selectedId ? [selectedId] : []);
    const srcs = ids.map(id => shapes.find(s => s.id === id)).filter(Boolean) as Shape[];
    if (srcs.length === 0) return;

    const idMap = new Map<string, string>();
    srcs.forEach(s => idMap.set(s.id, uuid()));

    const newShapes: Shape[] = srcs.map(s => ({
      ...s,
      id: idMap.get(s.id)!,
      x: s.x + 20,
      y: s.y + 20,
      children: (s.children ?? []).map(cid => idMap.get(cid) ?? cid),
      parentId: s.parentId ? (idMap.get(s.parentId) ?? s.parentId) : undefined,
    }));

    const next = [...shapes, ...newShapes];
    dispatch({ type: 'SET_SHAPES', shapes: next });
    if (newShapes.length === 1) {
      dispatch({ type: 'SELECT', id: newShapes[0].id });
    } else {
      dispatch({ type: 'SELECT', id: newShapes[newShapes.length - 1].id });
      dispatch({ type: 'SET_SELECTED_IDS', ids: newShapes.map(s => s.id) });
    }
    const label = srcs.length === 1 ? `Duplicate ${srcs[0].name}` : `Duplicate ${srcs.length} shapes`;
    emit(next, label);
  }, [emit]);

  // ── Reorder shapes (drag in layer panel) ──────────────────────────────────

  const reorderShapes = useCallback((newOrder: Shape[]) => {
    dispatch({ type: 'SET_SHAPES', shapes: newOrder });
    emit(newOrder, 'Reorder layers');
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

  // ── Center on canvas ──────────────────────────────────────────────────────
  // Centers selected shapes at origin (0, 0) or within the bounding box of all shapes.

  const centerOnCanvas = useCallback((viewportW?: number, viewportH?: number, zoom?: number, pan?: { x: number; y: number }) => {
    const { shapes, selectedIds, selectedId } = stateRef.current;
    const ids = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : []);
    const toCenter = ids.length > 0 ? shapes.filter(s => ids.includes(s.id)) : shapes.filter(s => !s.hidden);
    if (toCenter.length === 0) return;

    let canvasCX: number;
    let canvasCY: number;

    if (viewportW !== undefined && viewportH !== undefined && zoom !== undefined && pan !== undefined) {
      // Viewport center in canvas coordinates
      canvasCX = (viewportW / 2 - pan.x) / zoom;
      canvasCY = (viewportH / 2 - pan.y) / zoom;
    } else {
      // Fallback: center within all shapes' bounding box
      const allNonSelected = shapes.filter(s => !toCenter.some(tc => tc.id === s.id) && !s.hidden);
      if (allNonSelected.length > 0) {
        const allMinX = Math.min(...allNonSelected.map(s => s.x));
        const allMinY = Math.min(...allNonSelected.map(s => s.y));
        const allMaxX = Math.max(...allNonSelected.map(s => s.x + s.width));
        const allMaxY = Math.max(...allNonSelected.map(s => s.y + s.height));
        canvasCX = (allMinX + allMaxX) / 2;
        canvasCY = (allMinY + allMaxY) / 2;
      } else {
        canvasCX = 400;
        canvasCY = 300;
      }
    }

    // Selection bounding box center
    const selMinX = Math.min(...toCenter.map(s => s.x));
    const selMinY = Math.min(...toCenter.map(s => s.y));
    const selMaxX = Math.max(...toCenter.map(s => s.x + s.width));
    const selMaxY = Math.max(...toCenter.map(s => s.y + s.height));
    const selCX = (selMinX + selMaxX) / 2;
    const selCY = (selMinY + selMaxY) / 2;

    const dx = canvasCX - selCX;
    const dy = canvasCY - selCY;

    const next = shapes.map(s =>
      toCenter.some(tc => tc.id === s.id) ? { ...s, x: Math.round(s.x + dx), y: Math.round(s.y + dy) } : s
    );

    dispatch({ type: 'SET_SHAPES', shapes: next });
    if (selectedId) dispatch({ type: 'SELECT', id: selectedId });
    emit(next, 'Center on canvas');
  }, [emit]);

  // ── Tidy Up — arrange selected shapes in a neat grid ─────────────────────

  const tidyUp = useCallback((gap = 20) => {
    const { shapes, selectedIds, selectedId } = stateRef.current;
    const toArrange = selectedIds.length > 1
      ? shapes.filter(s => selectedIds.includes(s.id) && !s.parentId)
      : shapes.filter(s => !s.parentId && !s.hidden);

    if (toArrange.length < 2) return;

    // Sort by original reading order (top-to-bottom, left-to-right)
    const sorted = [...toArrange].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

    // Compute grid: aim for roughly sqrt(n) columns
    const cols = Math.ceil(Math.sqrt(sorted.length));
    const maxW = Math.max(...sorted.map(s => s.width));
    const maxH = Math.max(...sorted.map(s => s.height));

    // Anchor to top-left of current bounding box
    const anchorX = Math.min(...toArrange.map(s => s.x));
    const anchorY = Math.min(...toArrange.map(s => s.y));

    const stepX = maxW + gap;
    const stepY = maxH + gap;

    const patches: { id: string; x: number; y: number }[] = sorted.map((s, i) => ({
      id: s.id,
      x: anchorX + (i % cols) * stepX,
      y: anchorY + Math.floor(i / cols) * stepY,
    }));

    const next = shapes.map(s => {
      const patch = patches.find(p => p.id === s.id);
      return patch ? { ...s, x: patch.x, y: patch.y } : s;
    });

    dispatch({ type: 'SET_SHAPES', shapes: next });
    if (selectedId) dispatch({ type: 'SELECT', id: selectedId });
    emit(next, 'Tidy up');
  }, [emit]);

  // ── Wrap in Frame ─────────────────────────────────────────────────────────

  const wrapInFrame = useCallback((padding = 16) => {
    const { shapes, selectedIds, selectedId } = stateRef.current;
    const toWrap = selectedIds.length > 0
      ? shapes.filter(s => selectedIds.includes(s.id) && !s.parentId)
      : selectedId ? shapes.filter(s => s.id === selectedId && !s.parentId) : [];
    if (toWrap.length === 0) return;

    // Compute bounding box with padding
    const minX = Math.min(...toWrap.map(s => s.x)) - padding;
    const minY = Math.min(...toWrap.map(s => s.y)) - padding;
    const maxX = Math.max(...toWrap.map(s => s.x + s.width)) + padding;
    const maxY = Math.max(...toWrap.map(s => s.y + s.height)) + padding;

    const frameId = uuid();
    const frame: Shape = {
      ...defaultShape('frame', frameId),
      x: minX, y: minY,
      width: maxX - minX, height: maxY - minY,
      name: `Frame ${shapes.filter(s => s.type === 'frame').length + 1}`,
      fill: 'transparent',
      stroke: '#6366f1',
      strokeWidth: 1,
      children: toWrap.map(s => s.id),
    };

    // Mark children with parentId
    const withParents = shapes.map(s =>
      toWrap.some(sel => sel.id === s.id) ? { ...s, parentId: frameId } : s
    );
    // Insert frame before its first child
    const firstChildIdx = withParents.findIndex(s => s.parentId === frameId);
    const next = [...withParents];
    next.splice(firstChildIdx, 0, frame);

    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SELECT', id: frameId });
    emit(next, 'Wrap in frame');
  }, [emit]);

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

  // ── Align shapes (used by AlignmentBar) ──────────────────────────────────

  const alignShapes = useCallback((patches: { id: string; x: number; y: number }[]) => {
    const { shapes } = stateRef.current;
    const next = shapes.map(s => {
      const patch = patches.find(p => p.id === s.id);
      return patch ? { ...s, x: patch.x, y: patch.y } : s;
    });
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Align shapes');
  }, [emit]);

  // ── Add a single shape (used by AI frame injection) ───────────────────────

  const addShape = useCallback((shape: Shape) => {
    const { shapes } = stateRef.current;
    const next = [...shapes, shape];
    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SELECT', id: shape.id });
    emit(next, `Add ${shape.name}`);
  }, [emit]);

  // ── Layout Arrangers ─────────────────────────────────────────────────────
  /** Arrange selected shapes in a radial (circle) layout centered on their bbox center */
  const arrangeRadial = useCallback((radius?: number) => {
    const { shapes, selectedIds } = stateRef.current;
    const sel = shapes.filter(s => selectedIds.includes(s.id));
    if (sel.length < 2) return;
    const cx = sel.reduce((s, sh) => s + sh.x + sh.width / 2, 0) / sel.length;
    const cy = sel.reduce((s, sh) => s + sh.y + sh.height / 2, 0) / sel.length;
    const r = radius ?? Math.max(100, sel.length * 30);
    const next = shapes.map(s => {
      const idx = sel.findIndex(sh => sh.id === s.id);
      if (idx < 0) return s;
      const angle = (idx / sel.length) * Math.PI * 2 - Math.PI / 2;
      return { ...s, x: Math.round(cx + Math.cos(angle) * r - s.width / 2), y: Math.round(cy + Math.sin(angle) * r - s.height / 2) };
    });
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Radial arrange');
  }, [emit]);

  /** Arrange selected shapes in a golden-ratio spiral */
  const arrangeSpiral = useCallback(() => {
    const { shapes, selectedIds } = stateRef.current;
    const sel = shapes.filter(s => selectedIds.includes(s.id));
    if (sel.length < 2) return;
    const cx = sel.reduce((s, sh) => s + sh.x + sh.width / 2, 0) / sel.length;
    const cy = sel.reduce((s, sh) => s + sh.y + sh.height / 2, 0) / sel.length;
    const PHI = 2.39996; // golden angle in radians
    const next = shapes.map(s => {
      const idx = sel.findIndex(sh => sh.id === s.id);
      if (idx < 0) return s;
      const r = 24 * Math.sqrt(idx + 1);
      const angle = idx * PHI;
      return { ...s, x: Math.round(cx + Math.cos(angle) * r - s.width / 2), y: Math.round(cy + Math.sin(angle) * r - s.height / 2) };
    });
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Spiral arrange');
  }, [emit]);

  /**
   * Swap the positions (x, y) of exactly 2 selected shapes.
   * Each shape jumps to where the other was.
   */
  const swapPositions = useCallback(() => {
    const { shapes, selectedIds } = stateRef.current;
    if (selectedIds.length !== 2) return;
    const [a, b] = selectedIds.map(id => shapes.find(s => s.id === id)).filter(Boolean) as Shape[];
    if (!a || !b) return;
    const next = shapes.map(s => {
      if (s.id === a.id) return { ...s, x: b.x, y: b.y };
      if (s.id === b.id) return { ...s, x: a.x, y: a.y };
      return s;
    });
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Swap positions');
  }, [emit]);

  /** Scatter selected shapes randomly within their current bounding box */
  const scatterRandom = useCallback((seed = Date.now()) => {
    const { shapes, selectedIds } = stateRef.current;
    const sel = shapes.filter(s => selectedIds.includes(s.id));
    if (sel.length < 2) return;
    const minX = Math.min(...sel.map(s => s.x));
    const minY = Math.min(...sel.map(s => s.y));
    const maxX = Math.max(...sel.map(s => s.x + s.width));
    const maxY = Math.max(...sel.map(s => s.y + s.height));
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    // Simple LCG random from seed
    let rng = seed;
    const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 4294967296; };
    const next = shapes.map(s => {
      if (!selectedIds.includes(s.id)) return s;
      return { ...s, x: Math.round(minX + rand() * (rangeX - s.width)), y: Math.round(minY + rand() * (rangeY - s.height)) };
    });
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Scatter shapes');
  }, [emit]);

  // ── Shape Tween / Morph ───────────────────────────────────────────────────
  /**
   * Creates N intermediate shapes between the two selected shapes,
   * interpolating position, size, fill color, opacity, and border radius.
   * Result shapes are placed on canvas between the originals.
   */
  const morphShapes = useCallback((steps = 5) => {
    const { shapes, selectedIds } = stateRef.current;
    if (selectedIds.length !== 2) return;
    const [a, b] = selectedIds.map(id => shapes.find(s => s.id === id)).filter(Boolean) as Shape[];
    if (!a || !b) return;

    // Lerp helpers
    const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
    const lerpColor = (ca: string, cb: string, t: number): string => {
      const parseHex = (h: string) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
      const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
      if (!/^#[0-9a-fA-F]{6}$/.test(ca) || !/^#[0-9a-fA-F]{6}$/.test(cb)) return ca;
      const pa = parseHex(ca), pb = parseHex(cb);
      return `#${toHex(lerp(pa.r, pb.r, t))}${toHex(lerp(pa.g, pb.g, t))}${toHex(lerp(pa.b, pb.b, t))}`;
    };

    const newShapes: Shape[] = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      const base = { ...a, id: uuid() };
      base.x = lerp(a.x, b.x, t);
      base.y = lerp(a.y, b.y, t);
      base.width = lerp(a.width, b.width, t);
      base.height = lerp(a.height, b.height, t);
      base.opacity = lerp(a.opacity, b.opacity, t);
      base.rotation = lerp(a.rotation, b.rotation, t);
      if (a.fillType === 'solid' && b.fillType === 'solid') {
        base.fill = lerpColor(a.fill, b.fill, t);
      }
      const ra = Array.isArray(a.borderRadius) ? a.borderRadius[0] : (typeof a.borderRadius === 'number' ? a.borderRadius : 0);
      const rb = Array.isArray(b.borderRadius) ? b.borderRadius[0] : (typeof b.borderRadius === 'number' ? b.borderRadius : 0);
      base.borderRadius = lerp(ra, rb, t);
      base.name = `Morph ${i}/${steps}`;
      newShapes.push(base);
    }

    const next = [...shapes, ...newShapes];
    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SET_SELECTED_IDS', ids: newShapes.map(s => s.id) });
    emit(next, `Morph ${steps} steps`);
  }, [emit]);

  // ── Auto-layout / Stack / Distribute ────────────────────────────────────────

  /**
   * Stack selected shapes horizontally — left-to-right with a uniform gap.
   * Maintains original vertical positions.
   */
  const stackHorizontal = useCallback((gap = 16) => {
    const { shapes, selectedIds } = stateRef.current;
    const sel = shapes.filter(s => selectedIds.includes(s.id));
    if (sel.length < 2) return;
    // Sort by current X
    const sorted = [...sel].sort((a, b) => a.x - b.x);
    let cursor = sorted[0].x;
    const idToX: Record<string, number> = {};
    for (const s of sorted) {
      idToX[s.id] = cursor;
      cursor += s.width + gap;
    }
    const next = shapes.map(s => idToX[s.id] !== undefined ? { ...s, x: Math.round(idToX[s.id]) } : s);
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Stack horizontal');
  }, [emit]);

  /**
   * Stack selected shapes vertically — top-to-bottom with a uniform gap.
   * Maintains original horizontal positions.
   */
  const stackVertical = useCallback((gap = 16) => {
    const { shapes, selectedIds } = stateRef.current;
    const sel = shapes.filter(s => selectedIds.includes(s.id));
    if (sel.length < 2) return;
    const sorted = [...sel].sort((a, b) => a.y - b.y);
    let cursor = sorted[0].y;
    const idToY: Record<string, number> = {};
    for (const s of sorted) {
      idToY[s.id] = cursor;
      cursor += s.height + gap;
    }
    const next = shapes.map(s => idToY[s.id] !== undefined ? { ...s, y: Math.round(idToY[s.id]) } : s);
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Stack vertical');
  }, [emit]);

  /**
   * Distribute selected shapes with equal spacing horizontally (between their edges).
   */
  const distributeHorizontal = useCallback(() => {
    const { shapes, selectedIds } = stateRef.current;
    const sel = shapes.filter(s => selectedIds.includes(s.id));
    if (sel.length < 3) return;
    const sorted = [...sel].sort((a, b) => a.x - b.x);
    const totalWidth = sorted.reduce((s, sh) => s + sh.width, 0);
    const span = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width - sorted[0].x;
    const gap = (span - totalWidth) / (sorted.length - 1);
    let cursor = sorted[0].x;
    const idToX: Record<string, number> = {};
    for (const s of sorted) {
      idToX[s.id] = cursor;
      cursor += s.width + gap;
    }
    const next = shapes.map(s => idToX[s.id] !== undefined ? { ...s, x: Math.round(idToX[s.id]) } : s);
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Distribute horizontal');
  }, [emit]);

  /**
   * Distribute selected shapes with equal spacing vertically (between their edges).
   */
  const distributeVertical = useCallback(() => {
    const { shapes, selectedIds } = stateRef.current;
    const sel = shapes.filter(s => selectedIds.includes(s.id));
    if (sel.length < 3) return;
    const sorted = [...sel].sort((a, b) => a.y - b.y);
    const totalHeight = sorted.reduce((s, sh) => s + sh.height, 0);
    const span = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height - sorted[0].y;
    const gap = (span - totalHeight) / (sorted.length - 1);
    let cursor = sorted[0].y;
    const idToY: Record<string, number> = {};
    for (const s of sorted) {
      idToY[s.id] = cursor;
      cursor += s.height + gap;
    }
    const next = shapes.map(s => idToY[s.id] !== undefined ? { ...s, y: Math.round(idToY[s.id]) } : s);
    dispatch({ type: 'SET_SHAPES', shapes: next });
    emit(next, 'Distribute vertical');
  }, [emit]);

  /**
   * Tile the selected shape(s) into an N×M grid with a given gap.
   * If multiple shapes are selected, tiles each one as a cell.
   * If a single shape is selected, repeats it N×M times.
   */
  const gridRepeat = useCallback((cols = 3, rows = 3, gapX = 16, gapY = 16) => {
    const { shapes, selectedIds } = stateRef.current;
    const sel = shapes.filter(s => selectedIds.includes(s.id));
    if (sel.length === 0) return;

    // Use the first selected shape as the template
    const template = sel[0];
    const startX = template.x;
    const startY = template.y;
    const cellW = template.width;
    const cellH = template.height;

    const newShapes: Shape[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === 0 && c === 0) continue; // skip the original
        const clone: Shape = {
          ...template,
          id: uuid(),
          x: startX + c * (cellW + gapX),
          y: startY + r * (cellH + gapY),
          name: `${template.name} ${r * cols + c + 1}`,
        };
        newShapes.push(clone);
      }
    }

    // Move original to (0,0) grid position
    const movedTemplate = { ...template, x: startX, y: startY };
    const next = [
      ...shapes.map(s => s.id === template.id ? movedTemplate : s),
      ...newShapes,
    ];
    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SET_SELECTED_IDS', ids: [template.id, ...newShapes.map(s => s.id)] });
    emit(next, `Grid ${cols}×${rows}`);
  }, [emit]);

  /**
   * Detect if selected shapes form a row or column layout, then wrap them
   * in an auto-layout frame with appropriate direction and gap.
   * Returns 'row' | 'column' | 'none' (for toasts).
   */
  const autoDetectLayout = useCallback((): 'row' | 'column' | 'none' => {
    const { shapes, selectedIds } = stateRef.current;
    const sel = shapes.filter(s => selectedIds.includes(s.id) && !s.parentId);
    if (sel.length < 2) return 'none';

    const sorted = [...sel].sort((a, b) => a.x - b.x);

    // Check if all shapes are roughly on the same horizontal line (row)
    const minY = Math.min(...sel.map(s => s.y));
    const maxY = Math.max(...sel.map(s => s.y + s.height));
    const minX = Math.min(...sel.map(s => s.x));
    const maxX = Math.max(...sel.map(s => s.x + s.width));
    const totalH = maxY - minY;
    const totalW = maxX - minX;

    // Heuristic: if shapes are wider than tall in spread, it's a row
    const isRow = totalW > totalH;
    const direction: 'row' | 'column' = isRow ? 'row' : 'column';

    const sortedForDir = direction === 'row'
      ? [...sel].sort((a, b) => a.x - b.x)
      : [...sel].sort((a, b) => a.y - b.y);

    // Compute gap from spacing between first two shapes
    const gap = direction === 'row'
      ? Math.max(0, Math.round(sortedForDir[1].x - (sortedForDir[0].x + sortedForDir[0].width)))
      : Math.max(0, Math.round(sortedForDir[1].y - (sortedForDir[0].y + sortedForDir[0].height)));

    const pad = 16;

    // Create wrapping frame
    const frameId = uuid();
    const fr: Shape = {
      ...defaultShape('frame', frameId),
      x: minX - pad,
      y: minY - pad,
      width: totalW + pad * 2,
      height: totalH + pad * 2,
      fill: 'transparent',
      fillType: 'solid',
      stroke: '#6366f1',
      strokeWidth: 1,
      layout: direction,
      layoutGap: gap,
      layoutPaddingH: pad,
      layoutPaddingV: pad,
      layoutAlign: 'flex-start',
      layoutJustify: 'flex-start',
      name: direction === 'row' ? 'Row Layout' : 'Column Layout',
      children: sortedForDir.map(s => s.id),
    };

    // Re-parent selected shapes to the new frame
    const childIds = new Set(sortedForDir.map(s => s.id));
    const updatedChildren = shapes
      .filter(s => childIds.has(s.id))
      .map(s => ({ ...s, parentId: frameId }));

    const next = [
      ...shapes.filter(s => !childIds.has(s.id)),
      fr,
      ...updatedChildren,
    ];

    dispatch({ type: 'SET_SHAPES', shapes: next });
    dispatch({ type: 'SET_SELECTED_IDS', ids: [frameId] });
    emit(next, `Auto-layout (${direction})`);
    return direction;
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
    // Open paths render as strokes; closed paths render as filled shapes
    if (!closed) {
      shape.fill = 'transparent';
      shape.stroke = '#e2e8f0';
      shape.strokeWidth = 2;
    }
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
    pasteInPlace,
    duplicate,
    reorderShapes,
    bringToFront,
    sendToBack,
    group,
    ungroup,
    wrapInFrame,
    tidyUp,
    centerOnCanvas,
    alignShapes,
    addShape,
    arrangeRadial,
    arrangeSpiral,
    scatterRandom,
    morphShapes,
    stackHorizontal,
    stackVertical,
    distributeHorizontal,
    distributeVertical,
    gridRepeat,
    swapPositions,
    autoDetectLayout,
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
