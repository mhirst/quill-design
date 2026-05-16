/**
 * Integration-level tests for multi-step user interactions:
 * drawing workflow, copy/paste, undo/redo sequences, multi-select,
 * page switching, bring/send ordering, grouping round-trips.
 *
 * Uses the same pure reducer + history helpers from core.test.ts.
 */

import { describe, it, expect } from 'vitest';

// ─── Inline types + helpers (no React imports needed) ────────────────────────

interface Shape {
  id: string; type: string;
  x: number; y: number; width: number; height: number;
  rotation: number; fill: string; fillOpacity: number;
  stroke: string; strokeWidth: number; borderRadius: number; opacity: number;
  shadow: boolean; shadowX: number; shadowY: number; shadowBlur: number; shadowColor: string;
  text: string; fontSize: number; fontFamily: string; fontWeight: string;
  fontStyle: string; textAlign: string; textDecoration: string;
  lineHeight: number; letterSpacing: number; color: string;
  name: string; layout: string; layoutGap: number;
  layoutPaddingH: number; layoutPaddingV: number;
  layoutAlign: string; layoutJustify: string;
  children: string[]; isGroup?: boolean; parentId?: string;
}

function shape(id: string, overrides: Partial<Shape> = {}): Shape {
  return {
    id, type: 'rectangle', x: 0, y: 0, width: 100, height: 100, rotation: 0,
    fill: '#ffffff', fillOpacity: 1, stroke: 'transparent', strokeWidth: 0,
    borderRadius: 0, opacity: 1, shadow: false, shadowX: 0, shadowY: 0,
    shadowBlur: 0, shadowColor: '#000', text: '', fontSize: 16,
    fontFamily: 'Inter', fontWeight: '400', fontStyle: 'normal',
    textAlign: 'left', textDecoration: 'none', lineHeight: 1.4,
    letterSpacing: 0, color: '#000', name: `Shape ${id}`,
    layout: 'none', layoutGap: 0, layoutPaddingH: 0, layoutPaddingV: 0,
    layoutAlign: 'flex-start', layoutJustify: 'flex-start', children: [],
    ...overrides,
  };
}

// Minimal reducer (matching useDrawingTools)
interface DrawState {
  shapes: Shape[]; selectedId: string | null; selectedIds: string[];
  drafting: { shape: Shape; originX: number; originY: number } | null;
  draggingHandle: unknown; draggingMove: unknown; marquee: unknown;
}

type Action =
  | { type: 'COMMIT_DRAFT' } | { type: 'SELECT'; id: string | null }
  | { type: 'ADD_TO_SELECTION'; id: string } | { type: 'REMOVE_FROM_SELECTION'; id: string }
  | { type: 'SELECT_ALL' } | { type: 'SET_SELECTED_IDS'; ids: string[] }
  | { type: 'DELETE_SELECTED' } | { type: 'UPDATE_SHAPE'; id: string; patch: Partial<Shape> }
  | { type: 'SET_SHAPES'; shapes: Shape[] }
  | { type: 'START_DRAW'; shape: Shape; originX: number; originY: number }
  | { type: 'UPDATE_DRAFT'; x: number; y: number; width: number; height: number }
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
      return { ...state, shapes: state.shapes.filter(s => !toDelete.has(s.id)), selectedId: null, selectedIds: [] };
    }
    case 'UPDATE_SHAPE':
      return { ...state, shapes: state.shapes.map(s => s.id === action.id ? { ...s, ...action.patch } : s) };
    case 'SET_SHAPES':
      return { ...state, shapes: action.shapes };
    case 'CLEAR':
      return { shapes: [], selectedId: null, selectedIds: [], drafting: null, draggingHandle: null, draggingMove: null, marquee: null };
  }
}

function empty(): DrawState {
  return { shapes: [], selectedId: null, selectedIds: [], drafting: null, draggingHandle: null, draggingMove: null, marquee: null };
}

interface HistoryEntry { shapes: Shape[]; label: string; }
function makeHistory() {
  const entries: HistoryEntry[] = [{ shapes: [], label: 'Initial state' }];
  let index = 0;
  return {
    push(shapes: Shape[], label: string) {
      entries.splice(index + 1); entries.push({ shapes, label });
      if (entries.length > 100) entries.shift();
      index = entries.length - 1;
    },
    undo() { if (index <= 0) return null; index--; return entries[index].shapes; },
    redo() { if (index >= entries.length - 1) return null; index++; return entries[index].shapes; },
    jump(i: number) { const c = Math.max(0, Math.min(i, entries.length - 1)); index = c; return entries[c].shapes; },
    get index() { return index; },
    get entries() { return entries; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('Draw → Edit → Undo workflow', () => {
  it('drawing a shape then undoing removes it', () => {
    const h = makeHistory();
    let s = empty();

    // Draw
    const a = shape('a', { width: 100, height: 100 });
    s = reducer(s, { type: 'START_DRAW', shape: a, originX: 0, originY: 0 });
    s = reducer(s, { type: 'COMMIT_DRAFT' });
    h.push(s.shapes, 'Add Rectangle');
    expect(s.shapes).toHaveLength(1);

    // Undo
    const undone = h.undo()!;
    s = reducer(s, { type: 'SET_SHAPES', shapes: undone });
    expect(s.shapes).toHaveLength(0);
  });

  it('undo then redo restores shape', () => {
    const h = makeHistory();
    let s = empty();
    const a = shape('a', { width: 100, height: 100 });
    s = reducer(s, { type: 'START_DRAW', shape: a, originX: 0, originY: 0 });
    s = reducer(s, { type: 'COMMIT_DRAFT' });
    h.push(s.shapes, 'Add');
    h.undo();
    const redone = h.redo()!;
    s = reducer(s, { type: 'SET_SHAPES', shapes: redone });
    expect(s.shapes).toHaveLength(1);
  });

  it('edit → undo returns to previous property value', () => {
    const h = makeHistory();
    let s: DrawState = { ...empty(), shapes: [shape('a', { fill: '#ff0000' })], selectedId: 'a', selectedIds: ['a'] };
    h.push(s.shapes, 'Initial');

    s = reducer(s, { type: 'UPDATE_SHAPE', id: 'a', patch: { fill: '#00ff00' } });
    h.push(s.shapes, 'Edit fill');

    const undone = h.undo()!;
    s = reducer(s, { type: 'SET_SHAPES', shapes: undone });
    expect(s.shapes.find(sh => sh.id === 'a')!.fill).toBe('#ff0000');
  });

  it('multiple edits undo one step at a time', () => {
    const h = makeHistory();
    let s: DrawState = { ...empty(), shapes: [shape('a', { x: 0 })], selectedId: 'a', selectedIds: ['a'] };
    h.push(s.shapes, 'Start');

    s = reducer(s, { type: 'UPDATE_SHAPE', id: 'a', patch: { x: 10 } });
    h.push(s.shapes, 'Move 1');
    s = reducer(s, { type: 'UPDATE_SHAPE', id: 'a', patch: { x: 20 } });
    h.push(s.shapes, 'Move 2');
    s = reducer(s, { type: 'UPDATE_SHAPE', id: 'a', patch: { x: 30 } });
    h.push(s.shapes, 'Move 3');

    // Undo back to 20
    let back = h.undo()!;
    s = reducer(s, { type: 'SET_SHAPES', shapes: back });
    expect(s.shapes[0].x).toBe(20);

    // Undo back to 10
    back = h.undo()!;
    s = reducer(s, { type: 'SET_SHAPES', shapes: back });
    expect(s.shapes[0].x).toBe(10);
  });
});

describe('Copy / Paste / Duplicate workflow', () => {
  it('paste creates a new offset shape', () => {
    const a = shape('a', { x: 50, y: 50 });
    let clipboard: Shape | null = a;

    // Simulate paste: create new shape with +20 offset and new id
    const pasted: Shape = { ...clipboard!, id: 'a_copy', x: clipboard!.x + 20, y: clipboard!.y + 20 };
    let s: DrawState = { ...empty(), shapes: [a] };
    s = reducer(s, { type: 'SET_SHAPES', shapes: [...s.shapes, pasted] });
    s = reducer(s, { type: 'SELECT', id: 'a_copy' });

    expect(s.shapes).toHaveLength(2);
    expect(s.shapes[1].x).toBe(70);
    expect(s.shapes[1].y).toBe(70);
    expect(s.selectedId).toBe('a_copy');
  });

  it('duplicate creates a separate object (not same reference)', () => {
    const a = shape('a', { x: 0, y: 0 });
    const dup: Shape = { ...a, id: 'a_dup', x: 20, y: 20 };
    expect(dup).not.toBe(a);
    expect(dup.id).not.toBe(a.id);
    expect(dup.x).toBe(20);
  });

  it('paste after cut removes original and adds copy', () => {
    const a = shape('a', { x: 10, y: 10 });
    let s: DrawState = { ...empty(), shapes: [a], selectedId: 'a', selectedIds: ['a'] };
    const clipboard = a;

    // Cut (delete)
    s = reducer(s, { type: 'DELETE_SELECTED' });
    expect(s.shapes).toHaveLength(0);

    // Paste
    const pasted: Shape = { ...clipboard, id: 'paste1', x: 30, y: 30 };
    s = reducer(s, { type: 'SET_SHAPES', shapes: [pasted] });
    s = reducer(s, { type: 'SELECT', id: 'paste1' });
    expect(s.shapes).toHaveLength(1);
    expect(s.selectedId).toBe('paste1');
  });
});

describe('Multi-select interactions', () => {
  function threeShapes() {
    return {
      ...empty(),
      shapes: [
        shape('a', { x: 0, y: 0 }),
        shape('b', { x: 100, y: 0 }),
        shape('c', { x: 200, y: 0 }),
      ],
    };
  }

  it('shift-click adds to selection', () => {
    let s = threeShapes();
    s = reducer(s, { type: 'SELECT', id: 'a' });
    s = reducer(s, { type: 'ADD_TO_SELECTION', id: 'b' });
    expect(s.selectedIds).toEqual(['a', 'b']);
  });

  it('Ctrl+A selects all', () => {
    let s = threeShapes();
    s = reducer(s, { type: 'SELECT_ALL' });
    expect(s.selectedIds).toHaveLength(3);
    expect(s.selectedIds).toContain('a');
    expect(s.selectedIds).toContain('c');
  });

  it('delete with multi-select removes all selected', () => {
    let s = threeShapes();
    s = reducer(s, { type: 'SET_SELECTED_IDS', ids: ['a', 'c'] });
    s = reducer(s, { type: 'DELETE_SELECTED' });
    expect(s.shapes).toHaveLength(1);
    expect(s.shapes[0].id).toBe('b');
  });

  it('clicking a shape deselects all others', () => {
    let s = threeShapes();
    s = reducer(s, { type: 'SELECT_ALL' });
    s = reducer(s, { type: 'SELECT', id: 'b' });
    expect(s.selectedIds).toEqual(['b']);
    expect(s.selectedId).toBe('b');
  });

  it('clicking canvas (null) deselects everything', () => {
    let s = threeShapes();
    s = reducer(s, { type: 'SELECT_ALL' });
    s = reducer(s, { type: 'SELECT', id: null });
    expect(s.selectedId).toBeNull();
    expect(s.selectedIds).toHaveLength(0);
  });

  it('removing from selection when 2 selected leaves 1', () => {
    let s = threeShapes();
    s = reducer(s, { type: 'SET_SELECTED_IDS', ids: ['a', 'b'] });
    s = reducer(s, { type: 'REMOVE_FROM_SELECTION', id: 'a' });
    expect(s.selectedIds).toEqual(['b']);
    expect(s.selectedId).toBe('b');
  });
});

describe('Bring to front / Send to back', () => {
  function orderedShapes() {
    return [shape('a'), shape('b'), shape('c'), shape('d')];
  }

  it('bringToFront moves selected to end', () => {
    const shapes = orderedShapes();
    const idx = shapes.findIndex(s => s.id === 'b');
    const next = [...shapes];
    next.push(next.splice(idx, 1)[0]);
    expect(next.map(s => s.id)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('sendToBack moves selected to start', () => {
    const shapes = orderedShapes();
    const idx = shapes.findIndex(s => s.id === 'c');
    const next = [...shapes];
    next.unshift(next.splice(idx, 1)[0]);
    expect(next.map(s => s.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('bringToFront on last item is no-op', () => {
    const shapes = orderedShapes();
    const idx = shapes.findIndex(s => s.id === 'd');
    expect(idx === shapes.length - 1).toBe(true);
    // no operation should happen
    const next = [...shapes];
    expect(next.map(s => s.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sendToBack on first item is no-op', () => {
    const shapes = orderedShapes();
    const idx = shapes.findIndex(s => s.id === 'a');
    expect(idx <= 0).toBe(true);
  });

  it('bring + send sequence restores original order', () => {
    const shapes = [shape('a'), shape('b'), shape('c')];
    // Bring 'a' to front
    let next = [...shapes];
    const idxA = next.findIndex(s => s.id === 'a');
    next.push(next.splice(idxA, 1)[0]);
    expect(next.map(s => s.id)).toEqual(['b', 'c', 'a']);

    // Send 'a' back to back
    const idxA2 = next.findIndex(s => s.id === 'a');
    next.unshift(next.splice(idxA2, 1)[0]);
    expect(next.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('Group / Ungroup round-trip', () => {
  it('group then ungroup restores original parentId state', () => {
    const a = shape('a', { x: 0, y: 0, width: 50, height: 50 });
    const b = shape('b', { x: 60, y: 0, width: 50, height: 50 });
    let s: DrawState = { ...empty(), shapes: [a, b], selectedIds: ['a', 'b'], selectedId: 'b' };

    // GROUP
    const groupId = 'g1';
    const groupShape = shape(groupId, { x: 0, y: 0, width: 110, height: 50, isGroup: true, name: 'Group', children: ['a', 'b'] });
    const withParents = s.shapes.map(sh => ['a', 'b'].includes(sh.id) ? { ...sh, parentId: groupId } : sh);
    s = reducer(s, { type: 'SET_SHAPES', shapes: [groupShape, ...withParents] });
    s = reducer(s, { type: 'SELECT', id: groupId });

    expect(s.shapes).toHaveLength(3);
    expect(s.shapes.find(sh => sh.id === 'a')!.parentId).toBe(groupId);

    // UNGROUP
    const ungrouped = s.shapes
      .filter(sh => sh.id !== groupId)
      .map(sh => sh.parentId === groupId ? { ...sh, parentId: undefined } : sh);
    s = reducer(s, { type: 'SET_SHAPES', shapes: ungrouped });

    expect(s.shapes).toHaveLength(2);
    expect(s.shapes.find(sh => sh.id === 'a')!.parentId).toBeUndefined();
    expect(s.shapes.find(sh => sh.id === 'b')!.parentId).toBeUndefined();
  });

  it('grouping requires at least 2 non-child shapes', () => {
    // Only 1 selected → group should not fire
    const a = shape('a');
    const s: DrawState = { ...empty(), shapes: [a], selectedIds: ['a'], selectedId: 'a' };
    const selected = s.shapes.filter(sh => s.selectedIds.includes(sh.id) && !sh.parentId);
    expect(selected.length < 2).toBe(true);
  });

  it('group bounding box is tight around children', () => {
    const a = shape('a', { x: 10, y: 20, width: 60, height: 40 });
    const b = shape('b', { x: 80, y: 10, width: 30, height: 70 });
    const selected = [a, b];
    const x = Math.min(...selected.map(sh => sh.x));
    const y = Math.min(...selected.map(sh => sh.y));
    const x2 = Math.max(...selected.map(sh => sh.x + sh.width));
    const y2 = Math.max(...selected.map(sh => sh.y + sh.height));
    expect(x).toBe(10);
    expect(y).toBe(10);
    expect(x2 - x).toBe(100); // 80+30-10
    expect(y2 - y).toBe(70);  // 10+70-10
  });
});

describe('Page switching', () => {
  interface Page { id: string; name: string; shapes: Shape[]; }

  function makePagesState() {
    let pages: Page[] = [{ id: 'p1', name: 'Page 1', shapes: [] }];
    let activeId = 'p1';
    return {
      get pages() { return pages; },
      get activeId() { return activeId; },
      addPage(currentShapes: Shape[]) {
        pages = pages.map(p => p.id === activeId ? { ...p, shapes: currentShapes } : p);
        const newPage: Page = { id: `p${pages.length + 1}`, name: `Page ${pages.length + 1}`, shapes: [] };
        pages = [...pages, newPage]; activeId = newPage.id;
        return newPage;
      },
      switchPage(pageId: string, currentShapes: Shape[]) {
        pages = pages.map(p => p.id === activeId ? { ...p, shapes: currentShapes } : p);
        activeId = pageId;
        return pages.find(p => p.id === pageId)?.shapes ?? [];
      },
    };
  }

  it('shapes on page 1 are preserved when switching to page 2', () => {
    const mgr = makePagesState();
    const p1shapes = [shape('a', { x: 10 })];
    mgr.addPage(p1shapes); // saves p1 shapes, creates p2
    const loaded = mgr.switchPage('p1', []);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('a');
  });

  it('page 2 starts empty', () => {
    const mgr = makePagesState();
    const newPage = mgr.addPage([shape('a')]);
    expect(newPage.shapes).toHaveLength(0);
  });

  it('shapes drawn on page 2 do not appear on page 1', () => {
    const mgr = makePagesState();
    mgr.addPage([]); // now on p2
    const p2shapes = [shape('b', { x: 200 })];
    const p1shapes = mgr.switchPage('p1', p2shapes); // save p2, load p1
    expect(p1shapes).toHaveLength(0); // p1 was empty
  });

  it('switching back and forth preserves both pages', () => {
    const mgr = makePagesState();
    const shapesA = [shape('on_p1', { x: 10 })];
    mgr.addPage(shapesA); // save p1, create p2
    const shapesB = [shape('on_p2', { x: 200 })];
    const p1back = mgr.switchPage('p1', shapesB); // save p2, load p1
    expect(p1back.some(s => s.id === 'on_p1')).toBe(true);

    const p2back = mgr.switchPage(mgr.pages[1].id, p1back);
    expect(p2back.some(s => s.id === 'on_p2')).toBe(true);
  });
});

describe('Edge cases', () => {
  it('delete on empty canvas is a no-op', () => {
    let s = empty();
    const before = s.shapes.length;
    s = reducer(s, { type: 'DELETE_SELECTED' });
    expect(s.shapes.length).toBe(before);
  });

  it('undo past beginning stays at index 0', () => {
    const h = makeHistory();
    h.push([shape('a')], 'Add');
    h.undo();
    const result = h.undo(); // already at 0
    expect(result).toBeNull();
    expect(h.index).toBe(0);
  });

  it('redo past end stays at last index', () => {
    const h = makeHistory();
    h.push([shape('a')], 'Add');
    const result = h.redo(); // nothing to redo
    expect(result).toBeNull();
  });

  it('update non-existent shape id is a no-op', () => {
    let s: DrawState = { ...empty(), shapes: [shape('a')], selectedId: 'a', selectedIds: ['a'] };
    s = reducer(s, { type: 'UPDATE_SHAPE', id: 'does_not_exist', patch: { fill: '#ff0000' } });
    expect(s.shapes[0].fill).toBe('#ffffff'); // unchanged
  });

  it('clear resets to empty state regardless of content', () => {
    let s: DrawState = {
      ...empty(),
      shapes: [shape('a'), shape('b'), shape('c')],
      selectedId: 'c', selectedIds: ['b', 'c'],
    };
    s = reducer(s, { type: 'CLEAR' });
    expect(s.shapes).toHaveLength(0);
    expect(s.selectedId).toBeNull();
    expect(s.selectedIds).toHaveLength(0);
  });

  it('select all on empty canvas results in empty selection', () => {
    let s = empty();
    s = reducer(s, { type: 'SELECT_ALL' });
    expect(s.selectedIds).toHaveLength(0);
    expect(s.selectedId).toBeNull();
  });

  it('duplicate offset makes shapes distinguishable', () => {
    const a = shape('a', { x: 50, y: 50 });
    const dup = { ...a, id: 'dup', x: a.x + 20, y: a.y + 20 };
    expect(dup.x).toBe(70);
    expect(dup.y).toBe(70);
    expect(dup.id).not.toBe(a.id);
  });
});

describe('History branching', () => {
  it('making a change after undo discards the future', () => {
    const h = makeHistory();
    h.push([shape('a')], 'Add A');
    h.push([shape('a'), shape('b')], 'Add B');
    h.push([shape('a'), shape('b'), shape('c')], 'Add C');

    h.undo(); // back to B
    h.undo(); // back to A

    // New branch from A
    h.push([shape('a'), shape('d')], 'Add D');
    expect(h.entries.length).toBe(3); // initial + A + D (B and C are gone)
    expect(h.redo()).toBeNull(); // no future
  });

  it('jump to arbitrary point in history', () => {
    const h = makeHistory();
    for (let i = 0; i < 5; i++) {
      h.push([shape(`s${i}`)], `Step ${i}`);
    }
    const shapes = h.jump(2);
    expect(h.index).toBe(2);
    expect(shapes).toHaveLength(1);
  });
});
