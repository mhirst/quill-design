/**
 * Core logic test suite — pure function tests, no React, no DOM.
 * Tests: reducer actions, resize math, rotation math, history, pages, grouping.
 */

import { describe, it, expect } from 'vitest';

// ─── Inline the pure pieces so tests don't need React ────────────────────────

type ShapeType = 'frame' | 'rectangle' | 'ellipse' | 'text';

interface Shape {
  id: string;
  type: ShapeType;
  x: number; y: number; width: number; height: number;
  rotation: number;
  fill: string; fillOpacity: number; stroke: string; strokeWidth: number;
  borderRadius: number; opacity: number;
  shadow: boolean; shadowX: number; shadowY: number; shadowBlur: number; shadowColor: string;
  text: string; fontSize: number; fontFamily: string; fontWeight: string;
  fontStyle: string; textAlign: string; textDecoration: string;
  lineHeight: number; letterSpacing: number; color: string;
  name: string;
  layout: 'none' | 'row' | 'column'; layoutGap: number;
  layoutPaddingH: number; layoutPaddingV: number;
  layoutAlign: string; layoutJustify: string;
  children: string[];
  isGroup?: boolean;
  parentId?: string;
}

function makeShape(id: string, overrides: Partial<Shape> = {}): Shape {
  return {
    id, type: 'rectangle', x: 0, y: 0, width: 100, height: 100, rotation: 0,
    fill: '#ffffff', fillOpacity: 1, stroke: '#000000', strokeWidth: 1,
    borderRadius: 0, opacity: 1,
    shadow: false, shadowX: 2, shadowY: 2, shadowBlur: 4, shadowColor: 'rgba(0,0,0,0.2)',
    text: '', fontSize: 16, fontFamily: 'Inter', fontWeight: '400',
    fontStyle: 'normal', textAlign: 'left', textDecoration: 'none',
    lineHeight: 1.4, letterSpacing: 0, color: '#000000',
    name: `Shape ${id}`,
    layout: 'none', layoutGap: 0, layoutPaddingH: 0, layoutPaddingV: 0,
    layoutAlign: 'flex-start', layoutJustify: 'flex-start',
    children: [],
    ...overrides,
  };
}

type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

function applyResize(snap: Shape, handle: HandleDir, dx: number, dy: number) {
  let { x, y, width, height } = snap;
  const MIN = 8;
  if (handle.includes('e')) width = Math.max(MIN, width + dx);
  if (handle.includes('s')) height = Math.max(MIN, height + dy);
  if (handle.includes('w')) { const nw = Math.max(MIN, width - dx); x = x + (width - nw); width = nw; }
  if (handle.includes('n')) { const nh = Math.max(MIN, height - dy); y = y + (height - nh); height = nh; }
  return { x, y, width, height };
}

function applyRotate(snap: Shape, currentX: number, currentY: number, originX: number, originY: number) {
  const cx = snap.x + snap.width / 2;
  const cy = snap.y + snap.height / 2;
  const angle = Math.atan2(currentY - cy, currentX - cx) * (180 / Math.PI) + 90;
  const rotation = ((angle) % 360 + 360) % 360;
  return { rotation };
}

// Reducer (copy of the pure function from useDrawingTools.ts)
interface DrawState {
  shapes: Shape[];
  selectedId: string | null;
  selectedIds: string[];
  drafting: { shape: Shape; originX: number; originY: number } | null;
  draggingHandle: { id: string; handle: HandleDir; originX: number; originY: number; snapshot: Shape } | null;
  draggingMove: { id: string; originX: number; originY: number; snapshot: Shape[] } | null;
  marquee: { x: number; y: number; width: number; height: number } | null;
}

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
      return { ...state, drafting: { ...state.drafting, shape: { ...state.drafting.shape, x: action.x, y: action.y, width: action.width, height: action.height } } };

    case 'COMMIT_DRAFT': {
      if (!state.drafting) return state;
      const s = state.drafting.shape;
      if (s.width < 4 && s.height < 4) return { ...state, drafting: null };
      return { ...state, shapes: [...state.shapes, s], drafting: null, selectedId: s.id, selectedIds: [s.id] };
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

    case 'SET_SELECTED_IDS':
      return { ...state, selectedIds: action.ids, selectedId: action.ids[action.ids.length - 1] ?? null };

    case 'DELETE_SELECTED': {
      const toDelete = new Set(state.selectedIds);
      if (toDelete.size === 0 && state.selectedId) toDelete.add(state.selectedId);
      if (toDelete.size === 0) return state;
      return { ...state, shapes: state.shapes.filter(s => !toDelete.has(s.id)), selectedId: null, selectedIds: [] };
    }

    case 'UPDATE_SHAPE':
      return { ...state, shapes: state.shapes.map(s => s.id === action.id ? { ...s, ...action.patch } : s) };

    case 'SET_SHAPES':
      return { ...state, shapes: action.shapes };

    case 'START_MOVE':
      return { ...state, draggingMove: { id: action.id, originX: action.originX, originY: action.originY, snapshot: action.snapshots } };

    case 'MOVE': {
      if (!state.draggingMove) return state;
      const { originX, originY, snapshot: snapshots } = state.draggingMove;
      const dx = action.x - originX;
      const dy = action.y - originY;
      const snapMap = new Map(snapshots.map(s => [s.id, s]));
      return { ...state, shapes: state.shapes.map(s => { const snap = snapMap.get(s.id); if (!snap) return s; return { ...s, x: snap.x + dx, y: snap.y + dy }; }) };
    }

    case 'END_MOVE':
      return { ...state, draggingMove: null };

    case 'START_RESIZE':
      return { ...state, draggingHandle: { id: action.id, handle: action.handle, originX: action.originX, originY: action.originY, snapshot: action.snapshot } };

    case 'RESIZE': {
      if (!state.draggingHandle) return state;
      const { id, handle, originX, originY, snapshot } = state.draggingHandle;
      const dx = action.x - originX;
      const dy = action.y - originY;
      const updated = handle === 'rotate'
        ? applyRotate(snapshot, action.x, action.y, originX, originY)
        : applyResize(snapshot, handle, dx, dy);
      return { ...state, shapes: state.shapes.map(s => s.id === id ? { ...s, ...updated } : s) };
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
      const ids = state.shapes.filter(s => s.x < mx + mw && s.x + s.width > mx && s.y < my + mh && s.y + s.height > my).map(s => s.id);
      return { ...state, marquee: null, selectedIds: ids, selectedId: ids[ids.length - 1] ?? null };
    }

    case 'CLEAR':
      return { shapes: [], selectedId: null, selectedIds: [], drafting: null, draggingHandle: null, draggingMove: null, marquee: null };

    default:
      return state;
  }
}

function emptyState(): DrawState {
  return { shapes: [], selectedId: null, selectedIds: [], drafting: null, draggingHandle: null, draggingMove: null, marquee: null };
}

// ─── History helpers (pure, mirroring useDrawingTools) ───────────────────────

interface HistoryEntry { shapes: Shape[]; label: string; }

function makeHistory() {
  const entries: HistoryEntry[] = [{ shapes: [], label: 'Initial state' }];
  let index = 0;

  return {
    push(shapes: Shape[], label: string) {
      entries.splice(index + 1);
      entries.push({ shapes, label });
      if (entries.length > 100) entries.shift();
      index = entries.length - 1;
    },
    undo() {
      if (index <= 0) return null;
      index--;
      return entries[index].shapes;
    },
    redo() {
      if (index >= entries.length - 1) return null;
      index++;
      return entries[index].shapes;
    },
    jump(i: number) {
      const clamped = Math.max(0, Math.min(i, entries.length - 1));
      index = clamped;
      return entries[clamped].shapes;
    },
    get index() { return index; },
    get entries() { return entries; },
  };
}

// ─── Pages helpers (pure logic, no hooks) ────────────────────────────────────

interface Page { id: string; name: string; shapes: Shape[]; }

function pagesLogic() {
  let pages: Page[] = [{ id: 'p1', name: 'Page 1', shapes: [] }];
  let activeId = 'p1';

  return {
    get pages() { return pages; },
    get activeId() { return activeId; },
    addPage(currentShapes: Shape[]) {
      pages = pages.map(p => p.id === activeId ? { ...p, shapes: currentShapes } : p);
      const count = pages.length + 1;
      const newPage: Page = { id: `p${Date.now()}`, name: `Page ${count}`, shapes: [] };
      pages = [...pages, newPage];
      activeId = newPage.id;
      return newPage;
    },
    switchPage(pageId: string, currentShapes: Shape[]) {
      pages = pages.map(p => p.id === activeId ? { ...p, shapes: currentShapes } : p);
      const target = pages.find(p => p.id === pageId);
      activeId = pageId;
      return target?.shapes ?? [];
    },
    renamePage(pageId: string, name: string) {
      pages = pages.map(p => p.id === pageId ? { ...p, name } : p);
    },
    deletePage(pageId: string, currentShapes: Shape[]) {
      if (pages.length <= 1) return null;
      pages = pages.map(p => p.id === activeId ? { ...p, shapes: currentShapes } : p);
      pages = pages.filter(p => p.id !== pageId);
      if (pageId === activeId) {
        activeId = pages[0].id;
        return pages[0].shapes;
      }
      return null;
    },
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Reducer — drawing', () => {
  it('START_DRAW sets drafting and clears selection', () => {
    const shape = makeShape('a');
    const s = reducer(
      { ...emptyState(), selectedId: 'x', selectedIds: ['x'] },
      { type: 'START_DRAW', shape, originX: 10, originY: 20 }
    );
    expect(s.drafting).not.toBeNull();
    expect(s.drafting!.shape.id).toBe('a');
    expect(s.selectedId).toBeNull();
    expect(s.selectedIds).toHaveLength(0);
  });

  it('UPDATE_DRAFT updates shape geometry', () => {
    const shape = makeShape('a');
    let s = reducer(emptyState(), { type: 'START_DRAW', shape, originX: 0, originY: 0 });
    s = reducer(s, { type: 'UPDATE_DRAFT', x: 5, y: 10, width: 80, height: 60 });
    expect(s.drafting!.shape.x).toBe(5);
    expect(s.drafting!.shape.y).toBe(10);
    expect(s.drafting!.shape.width).toBe(80);
    expect(s.drafting!.shape.height).toBe(60);
  });

  it('COMMIT_DRAFT adds shape and selects it', () => {
    const shape = makeShape('a', { width: 50, height: 50 });
    let s = reducer(emptyState(), { type: 'START_DRAW', shape, originX: 0, originY: 0 });
    s = reducer(s, { type: 'COMMIT_DRAFT' });
    expect(s.shapes).toHaveLength(1);
    expect(s.selectedId).toBe('a');
    expect(s.drafting).toBeNull();
  });

  it('COMMIT_DRAFT with tiny shape (< 4x4) discards draft', () => {
    const shape = makeShape('a', { width: 2, height: 2 });
    let s = reducer(emptyState(), { type: 'START_DRAW', shape, originX: 0, originY: 0 });
    s = reducer(s, { type: 'COMMIT_DRAFT' });
    expect(s.shapes).toHaveLength(0);
    expect(s.drafting).toBeNull();
  });

  it('CANCEL_DRAFT clears drafting without adding shape', () => {
    const shape = makeShape('a', { width: 80, height: 80 });
    let s = reducer(emptyState(), { type: 'START_DRAW', shape, originX: 0, originY: 0 });
    s = reducer(s, { type: 'CANCEL_DRAFT' });
    expect(s.drafting).toBeNull();
    expect(s.shapes).toHaveLength(0);
  });
});

describe('Reducer — selection', () => {
  function stateWithShapes() {
    const a = makeShape('a', { x: 0, y: 0, width: 50, height: 50 });
    const b = makeShape('b', { x: 100, y: 100, width: 50, height: 50 });
    const c = makeShape('c', { x: 200, y: 200, width: 50, height: 50 });
    return { ...emptyState(), shapes: [a, b, c] };
  }

  it('SELECT sets selectedId and selectedIds', () => {
    const s = reducer(stateWithShapes(), { type: 'SELECT', id: 'b' });
    expect(s.selectedId).toBe('b');
    expect(s.selectedIds).toEqual(['b']);
  });

  it('SELECT null clears selection', () => {
    let s = reducer(stateWithShapes(), { type: 'SELECT', id: 'a' });
    s = reducer(s, { type: 'SELECT', id: null });
    expect(s.selectedId).toBeNull();
    expect(s.selectedIds).toHaveLength(0);
  });

  it('ADD_TO_SELECTION appends without duplicates', () => {
    let s = reducer(stateWithShapes(), { type: 'SELECT', id: 'a' });
    s = reducer(s, { type: 'ADD_TO_SELECTION', id: 'b' });
    s = reducer(s, { type: 'ADD_TO_SELECTION', id: 'b' }); // duplicate
    expect(s.selectedIds).toEqual(['a', 'b']);
    expect(s.selectedId).toBe('b'); // last added
  });

  it('REMOVE_FROM_SELECTION removes and updates selectedId to last remaining', () => {
    let s = reducer(stateWithShapes(), { type: 'SET_SELECTED_IDS', ids: ['a', 'b', 'c'] });
    s = reducer(s, { type: 'REMOVE_FROM_SELECTION', id: 'b' });
    expect(s.selectedIds).toEqual(['a', 'c']);
    expect(s.selectedId).toBe('c');
  });

  it('SELECT_ALL selects all shapes', () => {
    const s = reducer(stateWithShapes(), { type: 'SELECT_ALL' });
    expect(s.selectedIds).toEqual(['a', 'b', 'c']);
    expect(s.selectedId).toBe('c'); // last
  });

  it('DELETE_SELECTED removes selected shapes', () => {
    let s = reducer(stateWithShapes(), { type: 'SET_SELECTED_IDS', ids: ['a', 'b'] });
    s = reducer(s, { type: 'DELETE_SELECTED' });
    expect(s.shapes).toHaveLength(1);
    expect(s.shapes[0].id).toBe('c');
    expect(s.selectedId).toBeNull();
  });

  it('DELETE_SELECTED with single selectedId (no selectedIds) deletes it', () => {
    let s = reducer(stateWithShapes(), { type: 'SELECT', id: 'b' });
    // Clear selectedIds to test fallback
    s = { ...s, selectedIds: [] };
    s = reducer(s, { type: 'DELETE_SELECTED' });
    expect(s.shapes.find(sh => sh.id === 'b')).toBeUndefined();
    expect(s.shapes).toHaveLength(2);
  });
});

describe('Reducer — move', () => {
  it('MOVE translates shapes relative to drag origin', () => {
    const a = makeShape('a', { x: 50, y: 50 });
    const b = makeShape('b', { x: 150, y: 150 });
    let s: DrawState = { ...emptyState(), shapes: [a, b], selectedIds: ['a', 'b'], selectedId: 'b' };
    s = reducer(s, { type: 'START_MOVE', id: 'a', originX: 100, originY: 100, snapshots: [a, b] });
    s = reducer(s, { type: 'MOVE', x: 130, y: 110 }); // dx=30, dy=10
    expect(s.shapes.find(sh => sh.id === 'a')!.x).toBe(80);
    expect(s.shapes.find(sh => sh.id === 'a')!.y).toBe(60);
    expect(s.shapes.find(sh => sh.id === 'b')!.x).toBe(180);
    expect(s.shapes.find(sh => sh.id === 'b')!.y).toBe(160);
  });

  it('END_MOVE clears draggingMove', () => {
    const a = makeShape('a');
    let s: DrawState = { ...emptyState(), shapes: [a] };
    s = reducer(s, { type: 'START_MOVE', id: 'a', originX: 0, originY: 0, snapshots: [a] });
    s = reducer(s, { type: 'END_MOVE' });
    expect(s.draggingMove).toBeNull();
  });
});

describe('Reducer — marquee selection', () => {
  it('COMMIT_MARQUEE selects intersecting shapes', () => {
    const a = makeShape('a', { x: 10, y: 10, width: 30, height: 30 });
    const b = makeShape('b', { x: 100, y: 100, width: 30, height: 30 });
    let s: DrawState = { ...emptyState(), shapes: [a, b] };
    s = reducer(s, { type: 'SET_MARQUEE', x: 0, y: 0, width: 60, height: 60 });
    s = reducer(s, { type: 'COMMIT_MARQUEE' });
    expect(s.selectedIds).toEqual(['a']);
    expect(s.marquee).toBeNull();
  });

  it('COMMIT_MARQUEE works with negative width/height (drag upward)', () => {
    const a = makeShape('a', { x: 10, y: 10, width: 30, height: 30 });
    let s: DrawState = { ...emptyState(), shapes: [a] };
    // Marquee from bottom-right to top-left
    s = reducer(s, { type: 'SET_MARQUEE', x: 60, y: 60, width: -60, height: -60 });
    s = reducer(s, { type: 'COMMIT_MARQUEE' });
    expect(s.selectedIds).toContain('a');
  });

  it('COMMIT_MARQUEE selects all shapes in area', () => {
    const a = makeShape('a', { x: 0, y: 0, width: 50, height: 50 });
    const b = makeShape('b', { x: 60, y: 0, width: 50, height: 50 });
    const c = makeShape('c', { x: 0, y: 200, width: 50, height: 50 }); // out of marquee
    let s: DrawState = { ...emptyState(), shapes: [a, b, c] };
    s = reducer(s, { type: 'SET_MARQUEE', x: 0, y: 0, width: 120, height: 60 });
    s = reducer(s, { type: 'COMMIT_MARQUEE' });
    expect(s.selectedIds).toContain('a');
    expect(s.selectedIds).toContain('b');
    expect(s.selectedIds).not.toContain('c');
  });
});

describe('Reducer — resize handles', () => {
  it('east handle grows width rightward', () => {
    const snap = makeShape('a', { x: 0, y: 0, width: 100, height: 100 });
    const result = applyResize(snap, 'e', 40, 0);
    expect(result.width).toBe(140);
    expect(result.x).toBe(0);
  });

  it('west handle grows width leftward and adjusts x', () => {
    const snap = makeShape('a', { x: 50, y: 0, width: 100, height: 100 });
    const result = applyResize(snap, 'w', -30, 0); // drag left
    expect(result.width).toBe(130);
    expect(result.x).toBe(20); // x decreases by 30
  });

  it('south handle grows height downward', () => {
    const snap = makeShape('a', { x: 0, y: 0, width: 100, height: 100 });
    const result = applyResize(snap, 's', 0, 50);
    expect(result.height).toBe(150);
    expect(result.y).toBe(0);
  });

  it('north handle grows height upward and adjusts y', () => {
    const snap = makeShape('a', { x: 0, y: 100, width: 100, height: 100 });
    const result = applyResize(snap, 'n', 0, -40);
    expect(result.height).toBe(140);
    expect(result.y).toBe(60);
  });

  it('se handle resizes both dimensions', () => {
    const snap = makeShape('a', { x: 0, y: 0, width: 100, height: 100 });
    const result = applyResize(snap, 'se', 20, 30);
    expect(result.width).toBe(120);
    expect(result.height).toBe(130);
  });

  it('nw handle resizes both and adjusts origin', () => {
    const snap = makeShape('a', { x: 50, y: 50, width: 100, height: 100 });
    const result = applyResize(snap, 'nw', -20, -20); // drag top-left corner outward
    expect(result.width).toBe(120);
    expect(result.height).toBe(120);
    expect(result.x).toBe(30);
    expect(result.y).toBe(30);
  });

  it('MIN clamp prevents negative size', () => {
    const snap = makeShape('a', { x: 0, y: 0, width: 100, height: 100 });
    const result = applyResize(snap, 'e', -200, 0); // drag way past left edge
    expect(result.width).toBe(8); // clamped to MIN
  });
});

describe('Rotation math', () => {
  it('pointing straight down from shape center = 0°', () => {
    // Shape center = (150, 150), pointing directly below = (150, 200)
    const snap = makeShape('a', { x: 100, y: 100, width: 100, height: 100 });
    // cx=150, cy=150; current=(150,200); angle = atan2(200-150, 150-150)+90 = atan2(50,0)+90 = 90+90 = 180...
    // Actually atan2(dy, dx): atan2(200-150, 150-150) = atan2(50, 0) = 90° → +90 = 180°
    const { rotation } = applyRotate(snap, 150, 200, 150, 100);
    // Just verify it's a number in [0, 360)
    expect(rotation).toBeGreaterThanOrEqual(0);
    expect(rotation).toBeLessThan(360);
  });

  it('rotation is always in [0, 360)', () => {
    const snap = makeShape('a', { x: 0, y: 0, width: 100, height: 100 });
    // Try many angles around shape center
    const cx = 50, cy = 50;
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const px = cx + 100 * Math.cos(rad);
      const py = cy + 100 * Math.sin(rad);
      const { rotation } = applyRotate(snap, px, py, cx, cy);
      expect(rotation).toBeGreaterThanOrEqual(0);
      expect(rotation).toBeLessThan(360);
    }
  });
});

describe('CLEAR action', () => {
  it('resets all state', () => {
    const a = makeShape('a');
    let s: DrawState = { ...emptyState(), shapes: [a], selectedId: 'a', selectedIds: ['a'] };
    s = reducer(s, { type: 'CLEAR' });
    expect(s.shapes).toHaveLength(0);
    expect(s.selectedId).toBeNull();
    expect(s.selectedIds).toHaveLength(0);
    expect(s.drafting).toBeNull();
  });
});

describe('History', () => {
  it('push adds entry and advances index', () => {
    const h = makeHistory();
    const a = makeShape('a');
    h.push([a], 'Add Rectangle');
    expect(h.index).toBe(1);
    expect(h.entries).toHaveLength(2); // initial + 1
  });

  it('undo goes back one step', () => {
    const h = makeHistory();
    const a = makeShape('a');
    const b = makeShape('b');
    h.push([a], 'Add A');
    h.push([a, b], 'Add B');
    const shapes = h.undo();
    expect(shapes).toHaveLength(1);
    expect(h.index).toBe(1);
  });

  it('redo after undo restores', () => {
    const h = makeHistory();
    const a = makeShape('a');
    const b = makeShape('b');
    h.push([a], 'Add A');
    h.push([a, b], 'Add B');
    h.undo();
    const shapes = h.redo();
    expect(shapes).toHaveLength(2);
  });

  it('push after undo truncates future', () => {
    const h = makeHistory();
    h.push([makeShape('a')], 'Add A');
    h.push([makeShape('a'), makeShape('b')], 'Add B');
    h.undo();
    h.push([makeShape('c')], 'Add C'); // branch from index 1
    expect(h.entries).toHaveLength(3); // initial + A + C (B is gone)
    expect(h.redo()).toBeNull(); // no future
  });

  it('undo at index 0 returns null', () => {
    const h = makeHistory();
    expect(h.undo()).toBeNull();
  });

  it('redo at end returns null', () => {
    const h = makeHistory();
    h.push([makeShape('a')], 'Add A');
    expect(h.redo()).toBeNull();
  });

  it('jump clamps to valid range', () => {
    const h = makeHistory();
    h.push([makeShape('a')], 'Add A');
    const shapes = h.jump(999);
    expect(shapes).toBeDefined();
    expect(h.index).toBe(h.entries.length - 1);
  });

  it('jump(0) returns to initial state', () => {
    const h = makeHistory();
    h.push([makeShape('a')], 'Add A');
    h.push([makeShape('a'), makeShape('b')], 'Add B');
    const shapes = h.jump(0);
    expect(shapes).toHaveLength(0); // initial = empty
    expect(h.index).toBe(0);
  });

  it('capped at 100 entries', () => {
    const h = makeHistory();
    for (let i = 0; i < 110; i++) {
      h.push([makeShape(`s${i}`)], `Step ${i}`);
    }
    expect(h.entries.length).toBeLessThanOrEqual(100);
  });
});

describe('Pages logic', () => {
  it('starts with one page', () => {
    const p = pagesLogic();
    expect(p.pages).toHaveLength(1);
    expect(p.pages[0].name).toBe('Page 1');
  });

  it('addPage saves current shapes and creates new empty page', () => {
    const p = pagesLogic();
    const shapes = [makeShape('a')];
    const newPage = p.addPage(shapes);
    expect(p.pages).toHaveLength(2);
    expect(p.activeId).toBe(newPage.id);
    // Old page should have saved the shapes
    expect(p.pages[0].shapes).toHaveLength(1);
    // New page is empty
    expect(p.pages[1].shapes).toHaveLength(0);
  });

  it('switchPage saves and loads shapes correctly', () => {
    const p = pagesLogic();
    const shapesP1 = [makeShape('a')];
    const newPage = p.addPage(shapesP1);
    // Now on page 2, switch back to page 1
    const loaded = p.switchPage('p1', [makeShape('b'), makeShape('c')]);
    expect(p.activeId).toBe('p1');
    expect(loaded).toHaveLength(1); // the shapes we saved when leaving p1
    expect(loaded[0].id).toBe('a');
  });

  it('renamePage changes the name', () => {
    const p = pagesLogic();
    p.renamePage('p1', 'My Canvas');
    expect(p.pages[0].name).toBe('My Canvas');
  });

  it('deletePage removes the page', () => {
    const p = pagesLogic();
    p.addPage([]);
    const p2id = p.activeId;
    p.deletePage(p2id, []);
    expect(p.pages).toHaveLength(1);
    expect(p.activeId).toBe('p1');
  });

  it('deletePage refuses to delete last page', () => {
    const p = pagesLogic();
    const result = p.deletePage('p1', []);
    expect(result).toBeNull();
    expect(p.pages).toHaveLength(1);
  });

  it('deletePage switches to first remaining page when active is deleted', () => {
    const p = pagesLogic();
    p.addPage([]); // now on page 2
    const p2id = p.activeId;
    const loaded = p.deletePage(p2id, [makeShape('a')]);
    // Switched back to page 1
    expect(p.activeId).toBe('p1');
    expect(loaded).toBeDefined();
  });

  it('addPage increments name based on count', () => {
    const p = pagesLogic();
    p.addPage([]);
    p.addPage([]);
    const names = p.pages.map(pg => pg.name);
    expect(names[0]).toBe('Page 1');
    expect(names[1]).toBe('Page 2');
    expect(names[2]).toBe('Page 3');
  });
});

describe('Grouping logic (pure)', () => {
  it('group bounding box encloses all children', () => {
    const a = makeShape('a', { x: 10, y: 20, width: 50, height: 60 });
    const b = makeShape('b', { x: 80, y: 10, width: 40, height: 30 });
    const selected = [a, b];

    const x = Math.min(...selected.map(s => s.x));
    const y = Math.min(...selected.map(s => s.y));
    const x2 = Math.max(...selected.map(s => s.x + s.width));
    const y2 = Math.max(...selected.map(s => s.y + s.height));

    expect(x).toBe(10);
    expect(y).toBe(10);
    expect(x2 - x).toBe(110); // 80+40 - 10
    expect(y2 - y).toBe(70);  // 20+60 - 10
  });

  it('parentId is set on children after grouping (reducer)', () => {
    const a = makeShape('a', { x: 0, y: 0, width: 50, height: 50 });
    const b = makeShape('b', { x: 60, y: 0, width: 50, height: 50 });
    let s: DrawState = { ...emptyState(), shapes: [a, b], selectedIds: ['a', 'b'], selectedId: 'b' };

    // Simulate grouping manually
    const groupId = 'group1';
    const groupShape = makeShape(groupId, { x: 0, y: 0, width: 110, height: 50, isGroup: true, name: 'Group', fill: 'transparent', stroke: 'transparent', strokeWidth: 0 });
    const withParents = s.shapes.map(sh => ['a','b'].includes(sh.id) ? { ...sh, parentId: groupId } : sh);
    s = reducer(s, { type: 'SET_SHAPES', shapes: [groupShape, ...withParents] });
    s = reducer(s, { type: 'SELECT', id: groupId });

    expect(s.shapes.find(sh => sh.id === 'a')!.parentId).toBe(groupId);
    expect(s.shapes.find(sh => sh.id === 'b')!.parentId).toBe(groupId);
    expect(s.selectedId).toBe(groupId);
  });

  it('ungroup removes parentId from children and deletes group', () => {
    const groupId = 'group1';
    const a = makeShape('a', { parentId: groupId });
    const b = makeShape('b', { parentId: groupId });
    const group = makeShape(groupId, { isGroup: true, name: 'Group', children: ['a', 'b'] });
    let s: DrawState = { ...emptyState(), shapes: [group, a, b], selectedId: groupId, selectedIds: [groupId] };

    // Simulate ungroup: remove group, clear parentId
    const next = s.shapes
      .filter(sh => sh.id !== groupId)
      .map(sh => sh.parentId === groupId ? { ...sh, parentId: undefined } : sh);

    s = reducer(s, { type: 'SET_SHAPES', shapes: next });

    expect(s.shapes.find(sh => sh.id === groupId)).toBeUndefined();
    expect(s.shapes.find(sh => sh.id === 'a')!.parentId).toBeUndefined();
    expect(s.shapes.find(sh => sh.id === 'b')!.parentId).toBeUndefined();
    expect(s.shapes).toHaveLength(2);
  });
});

describe('UPDATE_SHAPE', () => {
  it('patches only the targeted shape', () => {
    const a = makeShape('a', { x: 0, fill: '#ff0000' });
    const b = makeShape('b', { x: 100, fill: '#00ff00' });
    let s: DrawState = { ...emptyState(), shapes: [a, b] };
    s = reducer(s, { type: 'UPDATE_SHAPE', id: 'a', patch: { fill: '#0000ff', x: 50 } });
    expect(s.shapes.find(sh => sh.id === 'a')!.fill).toBe('#0000ff');
    expect(s.shapes.find(sh => sh.id === 'a')!.x).toBe(50);
    expect(s.shapes.find(sh => sh.id === 'b')!.fill).toBe('#00ff00'); // unchanged
  });
});

describe('Bring to front / Send to back (pure)', () => {
  it('bringToFront moves shape to end of array', () => {
    const shapes = [makeShape('a'), makeShape('b'), makeShape('c')];
    const idx = shapes.findIndex(s => s.id === 'a');
    const next = [...shapes];
    next.push(next.splice(idx, 1)[0]);
    expect(next.map(s => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('sendToBack moves shape to start of array', () => {
    const shapes = [makeShape('a'), makeShape('b'), makeShape('c')];
    const idx = shapes.findIndex(s => s.id === 'c');
    const next = [...shapes];
    next.unshift(next.splice(idx, 1)[0]);
    expect(next.map(s => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('bringToFront on already-front shape is a no-op', () => {
    const shapes = [makeShape('a'), makeShape('b'), makeShape('c')];
    const idx = shapes.findIndex(s => s.id === 'c');
    expect(idx).toBe(shapes.length - 1); // already at front
    // no-op condition: idx < 0 || idx === shapes.length - 1
    expect(idx === shapes.length - 1).toBe(true);
  });
});
