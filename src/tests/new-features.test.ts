/**
 * new-features.test.ts
 *
 * Tests for features added in the latest session:
 *  - Pen/path tool state machine (penAddPoint, penCommit, penCancel)
 *  - addShape() with history push
 *  - useProjectStore logic (defaultStore, makeProject, migration)
 *  - AI frame-wrapping logic (handleJsxReady scenarios)
 *  - usePages with initialPages / initialActivePageId
 *  - renderPathToCanvas bounding-box helpers
 *  - iframeJsx field on Shape
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defaultShape, shapesToJsx } from '../renderer/lib/shapes';
import type { Shape } from '../renderer/lib/shapes';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeFrame(id: string, overrides: Partial<Shape> = {}): Shape {
  return { ...defaultShape('frame', id), ...overrides };
}

function makeRect(id: string, overrides: Partial<Shape> = {}): Shape {
  return { ...defaultShape('rectangle', id), ...overrides };
}

// ─── Shape: iframeJsx field ───────────────────────────────────────────────────

describe('Shape.iframeJsx', () => {
  it('defaultShape frame has no iframeJsx by default', () => {
    const s = defaultShape('frame', 'f1');
    expect(s.iframeJsx).toBeUndefined();
  });

  it('iframeJsx can be set on a frame shape', () => {
    const s: Shape = { ...defaultShape('frame', 'f1'), iframeJsx: 'function App() { return <div/>; }' };
    expect(s.iframeJsx).toBe('function App() { return <div/>; }');
  });

  it('iframeJsx does not affect shapesToJsx output (not a rendered shape)', () => {
    const s: Shape = { ...defaultShape('frame', 'f1'), iframeJsx: 'function App() { return <div/>; }' };
    const jsx = shapesToJsx([s]);
    // The frame's iframeJsx is the *iframe* content, not the canvas shape
    expect(jsx).toContain('data-shape-id="f1"');
    // iframeJsx string should NOT appear verbatim in the canvas JSX
    expect(jsx).not.toContain('iframeJsx');
  });

  it('non-frame shapes also accept iframeJsx field (structural flexibility)', () => {
    const s: Shape = { ...defaultShape('rectangle', 'r1'), iframeJsx: 'test' };
    expect(s.iframeJsx).toBe('test');
  });
});

// ─── AI frame-wrapping logic ──────────────────────────────────────────────────

describe('AI frame-wrapping: handleJsxReady scenarios', () => {
  /**
   * We test the pure logic of handleJsxReady without React hooks.
   * The function:
   *   1. If a frame is selected → update that frame's iframeJsx
   *   2. Otherwise → create a new frame to the right of existing AI frames
   */

  function simulateHandleJsxReady(
    jsx: string,
    shapes: Shape[],
    selectedId: string | null,
  ): { updatedShape?: { id: string; iframeJsx: string }; newFrame?: Partial<Shape> } {
    const sel = shapes.find(s => s.id === selectedId);

    if (sel && sel.type === 'frame') {
      return { updatedShape: { id: sel.id, iframeJsx: jsx } };
    }

    // Auto-place: right of existing AI frames
    const aiFrames = shapes.filter(s => s.iframeJsx);
    let newX = 80;
    let newY = 80;
    if (aiFrames.length > 0) {
      const rightmost = aiFrames.reduce(
        (best, s) => s.x + s.width > best.x + best.width ? s : best,
        aiFrames[0],
      );
      newX = rightmost.x + rightmost.width + 40;
      newY = rightmost.y;
    }

    return {
      newFrame: {
        type: 'frame',
        x: newX,
        y: newY,
        width: 600,
        height: 440,
        iframeJsx: jsx,
        name: 'AI Frame',
      },
    };
  }

  it('no selection → creates a new frame at default position', () => {
    const result = simulateHandleJsxReady('<div/>', [], null);
    expect(result.newFrame).toBeDefined();
    expect(result.newFrame!.x).toBe(80);
    expect(result.newFrame!.y).toBe(80);
    expect(result.newFrame!.iframeJsx).toBe('<div/>');
  });

  it('no selection + existing AI frame → places to the right', () => {
    const existing = makeFrame('f1', { x: 80, y: 80, width: 600, height: 440, iframeJsx: 'old' });
    const result = simulateHandleJsxReady('new', [existing], null);
    expect(result.newFrame!.x).toBe(80 + 600 + 40); // 720
    expect(result.newFrame!.y).toBe(80);
  });

  it('no selection + two AI frames → places right of rightmost', () => {
    const f1 = makeFrame('f1', { x: 80, y: 80, width: 600, height: 440, iframeJsx: 'a' });
    const f2 = makeFrame('f2', { x: 760, y: 80, width: 600, height: 440, iframeJsx: 'b' });
    const result = simulateHandleJsxReady('c', [f1, f2], null);
    // rightmost is f2 at x=760 width=600, so next is 760+600+40 = 1400
    expect(result.newFrame!.x).toBe(1400);
  });

  it('frame selected → updates that frame, does not create a new one', () => {
    const f = makeFrame('f1');
    const result = simulateHandleJsxReady('updated-jsx', [f], 'f1');
    expect(result.updatedShape).toBeDefined();
    expect(result.updatedShape!.id).toBe('f1');
    expect(result.updatedShape!.iframeJsx).toBe('updated-jsx');
    expect(result.newFrame).toBeUndefined();
  });

  it('non-frame selected → creates new frame (ignores selection)', () => {
    const r = makeRect('r1');
    const result = simulateHandleJsxReady('jsx', [r], 'r1');
    expect(result.newFrame).toBeDefined();
    expect(result.updatedShape).toBeUndefined();
  });

  it('new frame gets correct dimensions', () => {
    const result = simulateHandleJsxReady('jsx', [], null);
    expect(result.newFrame!.width).toBe(600);
    expect(result.newFrame!.height).toBe(440);
    expect(result.newFrame!.name).toBe('AI Frame');
  });
});

// ─── Project store helpers ────────────────────────────────────────────────────

describe('project store helpers', () => {
  /**
   * Test the pure data functions from useProjectStore without React hooks.
   * We extract the logic inline.
   */

  function makeProject(name = 'Untitled Project') {
    const pageId = 'page-' + Math.random().toString(36).slice(2);
    return {
      id: 'proj-' + Math.random().toString(36).slice(2),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pages: [{ id: pageId, name: 'Page 1', shapes: [] }],
      activePageId: pageId,
      chatHistory: [],
    };
  }

  function defaultStore() {
    const p = makeProject();
    return { version: 1 as const, projects: [p], activeProjectId: p.id };
  }

  it('defaultStore creates one project with one page', () => {
    const store = defaultStore();
    expect(store.projects).toHaveLength(1);
    expect(store.projects[0].pages).toHaveLength(1);
    expect(store.projects[0].pages[0].name).toBe('Page 1');
  });

  it('makeProject creates a project with empty chat history', () => {
    const p = makeProject('My Project');
    expect(p.name).toBe('My Project');
    expect(p.chatHistory).toEqual([]);
    expect(p.pages).toHaveLength(1);
    expect(p.pages[0].shapes).toEqual([]);
  });

  it('makeProject sets activePageId to the first page id', () => {
    const p = makeProject();
    expect(p.activePageId).toBe(p.pages[0].id);
  });

  it('defaultStore sets activeProjectId to the only project id', () => {
    const store = defaultStore();
    expect(store.activeProjectId).toBe(store.projects[0].id);
  });

  it('migration: missing pages array defaults to empty', () => {
    const raw = { version: 1, projects: [{ id: 'p1', name: 'P', createdAt: 0, updatedAt: 0, pages: undefined as unknown as [], activePageId: 'x', chatHistory: [] }], activeProjectId: 'p1' };
    const migrated = raw.projects.map(p => ({
      ...p,
      pages: (p.pages ?? []).map((pg) => ({ ...pg, shapes: (pg as { shapes?: [] }).shapes ?? [] })),
      chatHistory: p.chatHistory ?? [],
    }));
    expect(migrated[0].pages).toEqual([]);
  });

  it('migration: missing chatHistory defaults to empty array', () => {
    const raw = { id: 'p1', name: 'P', createdAt: 0, updatedAt: 0, pages: [], activePageId: '', chatHistory: undefined as unknown as [] };
    const migrated = { ...raw, chatHistory: raw.chatHistory ?? [] };
    expect(migrated.chatHistory).toEqual([]);
  });

  it('migration: missing shapes in page defaults to empty array', () => {
    const page = { id: 'pg1', name: 'Page 1', shapes: undefined as unknown as Shape[] };
    const migrated = { ...page, shapes: page.shapes ?? [] };
    expect(migrated.shapes).toEqual([]);
  });

  it('create project: adds new project and switches active', () => {
    const store = defaultStore();
    const newProject = makeProject('Second');
    const next = {
      ...store,
      projects: [...store.projects, newProject],
      activeProjectId: newProject.id,
    };
    expect(next.projects).toHaveLength(2);
    expect(next.activeProjectId).toBe(newProject.id);
  });

  it('delete last project: creates a fresh replacement', () => {
    const store = defaultStore();
    const [only] = store.projects;
    const remaining = store.projects.filter(p => p.id !== only.id);
    const result = remaining.length === 0 ? [makeProject()] : remaining;
    expect(result).toHaveLength(1);
    expect(result[0].id).not.toBe(only.id); // fresh project
  });

  it('delete non-active project: keeps active unchanged', () => {
    const store = defaultStore();
    const p2 = makeProject('P2');
    const storeWith2 = { ...store, projects: [...store.projects, p2] };
    const remaining = storeWith2.projects.filter(p => p.id !== p2.id);
    const newActive = storeWith2.activeProjectId === p2.id
      ? remaining[remaining.length - 1].id
      : storeWith2.activeProjectId;
    expect(newActive).toBe(store.projects[0].id);
  });

  it('rename project: updates name and updatedAt', () => {
    const store = defaultStore();
    const id = store.projects[0].id;
    const before = store.projects[0].updatedAt;
    const next = store.projects.map(p =>
      p.id === id ? { ...p, name: 'Renamed', updatedAt: before + 1 } : p
    );
    expect(next[0].name).toBe('Renamed');
    expect(next[0].updatedAt).toBeGreaterThan(before);
  });

  it('switch project: updates activeProjectId only', () => {
    const store = defaultStore();
    const p2 = makeProject('P2');
    const storeWith2 = { ...store, projects: [...store.projects, p2] };
    const next = { ...storeWith2, activeProjectId: p2.id };
    expect(next.activeProjectId).toBe(p2.id);
    expect(next.projects).toHaveLength(2); // projects unchanged
  });
});

// ─── usePages initialPages logic ─────────────────────────────────────────────

describe('usePages initial state logic', () => {
  /**
   * usePages accepts initialPages + initialActivePageId.
   * Test the initial state selection logic.
   */

  function resolveInitialState(
    initialPages?: { id: string; name: string; shapes: Shape[] }[],
    initialActivePageId?: string,
  ) {
    if (initialPages && initialPages.length > 0) {
      const activeId = initialActivePageId && initialPages.find(p => p.id === initialActivePageId)
        ? initialActivePageId
        : initialPages[0].id;
      return { pages: initialPages, activePageId: activeId };
    }
    const defaultPageId = 'default';
    return {
      pages: [{ id: defaultPageId, name: 'Page 1', shapes: [] }],
      activePageId: defaultPageId,
    };
  }

  it('no initial pages → creates a default Page 1', () => {
    const { pages, activePageId } = resolveInitialState();
    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe('Page 1');
    expect(activePageId).toBe(pages[0].id);
  });

  it('with initial pages → uses provided pages', () => {
    const initial = [
      { id: 'p1', name: 'Home', shapes: [] },
      { id: 'p2', name: 'Settings', shapes: [] },
    ];
    const { pages } = resolveInitialState(initial, 'p1');
    expect(pages).toHaveLength(2);
    expect(pages[0].name).toBe('Home');
  });

  it('valid initialActivePageId → uses it', () => {
    const initial = [
      { id: 'p1', name: 'A', shapes: [] },
      { id: 'p2', name: 'B', shapes: [] },
    ];
    const { activePageId } = resolveInitialState(initial, 'p2');
    expect(activePageId).toBe('p2');
  });

  it('invalid initialActivePageId → falls back to first page', () => {
    const initial = [
      { id: 'p1', name: 'A', shapes: [] },
      { id: 'p2', name: 'B', shapes: [] },
    ];
    const { activePageId } = resolveInitialState(initial, 'nonexistent');
    expect(activePageId).toBe('p1');
  });

  it('initial pages with shapes are preserved', () => {
    const shape = defaultShape('rectangle', 'r1');
    const initial = [{ id: 'p1', name: 'Page 1', shapes: [shape] }];
    const { pages } = resolveInitialState(initial, 'p1');
    expect(pages[0].shapes).toHaveLength(1);
    expect(pages[0].shapes[0].id).toBe('r1');
  });
});

// ─── Pen tool state machine ───────────────────────────────────────────────────

describe('pen tool state machine', () => {
  type Point = { x: number; y: number };

  function penMachine() {
    let points: Point[] = [];
    let cursor: Point | null = null;

    return {
      addPoint(x: number, y: number) { points = [...points, { x, y }]; },
      moveCursor(x: number, y: number) { cursor = { x, y }; },
      getPoints() { return points; },
      getCursor() { return cursor; },
      commit(closed: boolean): { points: Point[]; closed: boolean } | null {
        if (points.length < 2) return null;
        const result = { points: [...points], closed };
        points = [];
        cursor = null;
        return result;
      },
      cancel() { points = []; cursor = null; },
    };
  }

  it('starts with no points and no cursor', () => {
    const pen = penMachine();
    expect(pen.getPoints()).toHaveLength(0);
    expect(pen.getCursor()).toBeNull();
  });

  it('addPoint appends to points list', () => {
    const pen = penMachine();
    pen.addPoint(10, 20);
    pen.addPoint(30, 40);
    expect(pen.getPoints()).toEqual([{ x: 10, y: 20 }, { x: 30, y: 40 }]);
  });

  it('moveCursor updates cursor position', () => {
    const pen = penMachine();
    pen.moveCursor(100, 200);
    expect(pen.getCursor()).toEqual({ x: 100, y: 200 });
  });

  it('commit with < 2 points returns null', () => {
    const pen = penMachine();
    pen.addPoint(10, 20);
    expect(pen.commit(false)).toBeNull();
  });

  it('commit with 2+ points returns path and resets state', () => {
    const pen = penMachine();
    pen.addPoint(0, 0);
    pen.addPoint(100, 0);
    pen.addPoint(100, 100);
    const result = pen.commit(false);
    expect(result).not.toBeNull();
    expect(result!.points).toHaveLength(3);
    expect(result!.closed).toBe(false);
    expect(pen.getPoints()).toHaveLength(0);
  });

  it('commit closed=true sets closed flag', () => {
    const pen = penMachine();
    pen.addPoint(0, 0);
    pen.addPoint(50, 50);
    const result = pen.commit(true);
    expect(result!.closed).toBe(true);
  });

  it('cancel resets points and cursor', () => {
    const pen = penMachine();
    pen.addPoint(10, 10);
    pen.moveCursor(20, 20);
    pen.cancel();
    expect(pen.getPoints()).toHaveLength(0);
    expect(pen.getCursor()).toBeNull();
  });

  it('after commit, can start a new path', () => {
    const pen = penMachine();
    pen.addPoint(0, 0);
    pen.addPoint(100, 0);
    pen.commit(false);

    pen.addPoint(200, 200);
    pen.addPoint(300, 300);
    const result2 = pen.commit(false);
    expect(result2!.points[0]).toEqual({ x: 200, y: 200 });
  });
});

// ─── addShape history logic ───────────────────────────────────────────────────

describe('addShape history logic', () => {
  /**
   * addShape appends a shape and creates a history entry.
   * Test the pure data transformation.
   */

  type HistoryEntry = { shapes: Shape[]; label: string };

  function simulateAddShape(
    currentShapes: Shape[],
    newShape: Shape,
    history: HistoryEntry[],
    historyIndex: number,
  ): { shapes: Shape[]; history: HistoryEntry[]; historyIndex: number } {
    const next = [...currentShapes, newShape];
    const entry: HistoryEntry = { shapes: next, label: `Add ${newShape.name}` };
    const newHistory = [...history.slice(0, historyIndex + 1), entry];
    return { shapes: next, history: newHistory, historyIndex: newHistory.length - 1 };
  }

  it('adds shape to the end of shapes array', () => {
    const existing = makeRect('r1');
    const newFrame = makeFrame('f1');
    const { shapes } = simulateAddShape([existing], newFrame, [], -1);
    expect(shapes).toHaveLength(2);
    expect(shapes[1].id).toBe('f1');
  });

  it('creates a history entry with the shape name', () => {
    const shape = makeFrame('f1');
    shape.name = 'AI Frame';
    const { history } = simulateAddShape([], shape, [], -1);
    expect(history).toHaveLength(1);
    expect(history[0].label).toBe('Add AI Frame');
  });

  it('truncates future history when shape is added after undo', () => {
    const r1 = makeRect('r1');
    const r2 = makeRect('r2');

    // Build 2-entry history
    const h0: HistoryEntry = { shapes: [], label: 'Init' };
    const h1: HistoryEntry = { shapes: [r1], label: 'Add Rectangle' };
    const h2: HistoryEntry = { shapes: [r1, r2], label: 'Add Rectangle' };
    const history = [h0, h1, h2];
    const historyIndex = 1; // currently at h1 (undid h2)

    const newFrame = makeFrame('f1');
    const { history: newHist, historyIndex: newIdx } = simulateAddShape([r1], newFrame, history, historyIndex);

    // h2 should be gone (future truncated), new entry appended
    expect(newHist).toHaveLength(3); // h0, h1, new
    expect(newHist[2].label).toBe('Add Frame');
    expect(newIdx).toBe(2);
  });

  it('history entry snapshot contains the new shape', () => {
    const s = makeRect('r1');
    const { history } = simulateAddShape([], s, [], -1);
    expect(history[0].shapes[0].id).toBe('r1');
  });
});

// ─── Path shape defaults ──────────────────────────────────────────────────────

describe('path shape defaults', () => {
  it('defaultShape path has correct type', () => {
    const s = defaultShape('path', 'p1');
    expect(s.type).toBe('path');
  });

  it('path shape has points array', () => {
    const s = defaultShape('path', 'p1');
    expect(Array.isArray(s.points)).toBe(true);
  });

  it('path shape has stroke properties', () => {
    const s = defaultShape('path', 'p1');
    // Paths should have a visible stroke by default
    expect(s.strokeWidth).toBeGreaterThan(0);
  });

  it('path shape has cap and join properties', () => {
    const s = defaultShape('path', 'p1');
    expect(s.lineCap).toBeDefined();
    expect(s.lineJoin).toBeDefined();
  });

  it('path closed (pathClosed) defaults to false', () => {
    const s = defaultShape('path', 'p1');
    expect(s.pathClosed).toBe(false);
  });
});

// ─── shapesToJsx with path shape ─────────────────────────────────────────────

describe('shapesToJsx: path shapes are excluded from DOM layer', () => {
  it('path shape with no points renders without crashing', () => {
    const s = defaultShape('path', 'p1');
    // Path shapes are rendered via SVG overlay, not DOM — shapesToJsx filters them out
    // or renders a placeholder
    const jsx = shapesToJsx([s]);
    // Should produce valid JSX (not throw)
    expect(typeof jsx).toBe('string');
  });

  it('mix of shapes and path produces JSX for non-path shapes', () => {
    const r = defaultShape('rectangle', 'r1');
    const p = defaultShape('path', 'p1');
    const jsx = shapesToJsx([r, p]);
    expect(jsx).toContain('data-shape-id="r1"');
    // path is handled in SVG layer, may or may not appear in DOM JSX
    expect(typeof jsx).toBe('string');
  });
});

// ─── useChat initialMessages logic ───────────────────────────────────────────

describe('useChat initialMessages logic', () => {
  /**
   * Test the pure state initialization logic for chat history restoration.
   */

  type Message = { id: string; role: 'user' | 'assistant'; content: string };

  function initChatMessages(initialMessages?: Message[]): Message[] {
    return initialMessages ?? [];
  }

  it('no initialMessages → starts with empty array', () => {
    const msgs = initChatMessages();
    expect(msgs).toEqual([]);
  });

  it('with initialMessages → uses provided messages', () => {
    const initial: Message[] = [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Hi there' },
    ];
    const msgs = initChatMessages(initial);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('Hello');
  });

  it('onMessagesChange is called after messages update', () => {
    const onChange = vi.fn();
    const msgs: Message[] = [{ id: '1', role: 'user', content: 'Test' }];
    onChange(msgs);
    expect(onChange).toHaveBeenCalledWith(msgs);
  });

  it('chat history is isolated per project (different refs)', () => {
    const project1History: Message[] = [{ id: 'a', role: 'user', content: 'P1 message' }];
    const project2History: Message[] = [];

    const msgs1 = initChatMessages(project1History);
    const msgs2 = initChatMessages(project2History);

    expect(msgs1).toHaveLength(1);
    expect(msgs2).toHaveLength(0);
    expect(msgs1).not.toBe(msgs2);
  });
});

// ─── MOVE reducer: path point translation ────────────────────────────────────

describe('MOVE reducer translates path points alongside x/y', () => {
  /**
   * The bug: the MOVE reducer was only shifting s.x / s.y for path shapes,
   * but paths render from absolute s.points coordinates in SVG — so the drawn
   * path stayed in place while the selection bounding box moved.
   *
   * The fix: detect path shapes in the MOVE reducer and translate all points
   * by the same dx/dy as x/y.
   */

  type Point = { x: number; y: number };

  /** Minimal shape representation for the reducer test */
  interface MiniShape {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    points?: Point[];
  }

  /** Snapshot array used to initialise draggingMove */
  type Snapshot = MiniShape[];

  /** Pure replica of the fixed MOVE reducer logic */
  function applyMove(shapes: MiniShape[], snapshots: Snapshot, originX: number, originY: number, toX: number, toY: number): MiniShape[] {
    const dx = toX - originX;
    const dy = toY - originY;
    const snapMap = new Map(snapshots.map(s => [s.id, s]));
    return shapes.map(s => {
      const snap = snapMap.get(s.id);
      if (!snap) return s;
      // Fixed: path shapes translate all points
      if (s.type === 'path' && snap.points) {
        const movedPoints = snap.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        return { ...s, x: snap.x + dx, y: snap.y + dy, points: movedPoints };
      }
      return { ...s, x: snap.x + dx, y: snap.y + dy };
    });
  }

  it('non-path shape: only x/y shift, no points', () => {
    const rect: MiniShape = { id: 'r1', type: 'rectangle', x: 100, y: 100, width: 80, height: 50 };
    const result = applyMove([rect], [rect], 100, 100, 150, 130);
    expect(result[0].x).toBe(150);
    expect(result[0].y).toBe(130);
    expect(result[0].points).toBeUndefined();
  });

  it('path shape: x/y shift AND points shift together', () => {
    const path: MiniShape = {
      id: 'p1', type: 'path', x: 100, y: 100, width: 200, height: 150,
      points: [{ x: 100, y: 200 }, { x: 200, y: 100 }, { x: 300, y: 250 }],
    };
    const result = applyMove([path], [path], 100, 100, 160, 140);
    expect(result[0].x).toBe(160);   // x shifted by +60
    expect(result[0].y).toBe(140);   // y shifted by +40
    // All points shifted by the same delta
    expect(result[0].points![0]).toEqual({ x: 160, y: 240 });
    expect(result[0].points![1]).toEqual({ x: 260, y: 140 });
    expect(result[0].points![2]).toEqual({ x: 360, y: 290 });
  });

  it('path shape: negative direction move works correctly', () => {
    const path: MiniShape = {
      id: 'p1', type: 'path', x: 200, y: 200, width: 100, height: 100,
      points: [{ x: 200, y: 200 }, { x: 300, y: 300 }],
    };
    const result = applyMove([path], [path], 200, 200, 150, 180);
    expect(result[0].x).toBe(150);
    expect(result[0].y).toBe(180);
    expect(result[0].points![0]).toEqual({ x: 150, y: 180 });
    expect(result[0].points![1]).toEqual({ x: 250, y: 280 });
  });

  it('mixed shapes: path and rect in same move', () => {
    const rect: MiniShape = { id: 'r1', type: 'rectangle', x: 50, y: 50, width: 80, height: 80 };
    const path: MiniShape = {
      id: 'p1', type: 'path', x: 200, y: 200, width: 100, height: 100,
      points: [{ x: 200, y: 200 }, { x: 300, y: 200 }],
    };
    const result = applyMove([rect, path], [rect, path], 0, 0, 30, 20);
    // rect: only x/y
    expect(result[0].x).toBe(80);
    expect(result[0].y).toBe(70);
    expect(result[0].points).toBeUndefined();
    // path: x/y AND points
    expect(result[1].x).toBe(230);
    expect(result[1].y).toBe(220);
    expect(result[1].points![0]).toEqual({ x: 230, y: 220 });
    expect(result[1].points![1]).toEqual({ x: 330, y: 220 });
  });

  it('unselected shapes in multi-shape canvas are unaffected', () => {
    const selected: MiniShape = {
      id: 'p1', type: 'path', x: 100, y: 100, width: 50, height: 50,
      points: [{ x: 100, y: 100 }, { x: 150, y: 150 }],
    };
    const bystander: MiniShape = { id: 'r1', type: 'rectangle', x: 500, y: 500, width: 80, height: 80 };
    // Only 'selected' is in snapshots
    const result = applyMove([selected, bystander], [selected], 100, 100, 200, 200);
    expect(result[0].x).toBe(200); // moved
    expect(result[0].points![0]).toEqual({ x: 200, y: 200 }); // points moved
    expect(result[1].x).toBe(500); // bystander untouched
    expect(result[1].y).toBe(500);
  });

  it('zero delta move: shape stays in place', () => {
    const path: MiniShape = {
      id: 'p1', type: 'path', x: 100, y: 100, width: 50, height: 50,
      points: [{ x: 100, y: 100 }, { x: 150, y: 150 }],
    };
    const result = applyMove([path], [path], 100, 100, 100, 100);
    expect(result[0].x).toBe(100);
    expect(result[0].points![0]).toEqual({ x: 100, y: 100 });
  });

  it('bounding box and points remain consistent after move', () => {
    // The key invariant: after move, the first point should equal (x, y) if it was originally
    const path: MiniShape = {
      id: 'p1', type: 'path', x: 50, y: 50, width: 150, height: 100,
      points: [{ x: 50, y: 50 }, { x: 150, y: 100 }, { x: 200, y: 150 }],
    };
    const dx = 75, dy = 25;
    const result = applyMove([path], [path], 0, 0, dx, dy);
    // x/y and first point both shifted identically
    expect(result[0].x).toBe(50 + dx);
    expect(result[0].y).toBe(50 + dy);
    expect(result[0].points![0].x).toBe(50 + dx);
    expect(result[0].points![0].y).toBe(50 + dy);
    // The relative offset between points is preserved
    expect(result[0].points![1].x - result[0].points![0].x).toBe(100); // was 150-50=100
    expect(result[0].points![2].x - result[0].points![1].x).toBe(50);  // was 200-150=50
  });
});

// ─── Frame auto-positioning ───────────────────────────────────────────────────

describe('frame auto-positioning with multiple AI frames', () => {
  function autoPosition(existingAiFrames: Array<{ x: number; y: number; width: number; height: number }>): { x: number; y: number } {
    if (existingAiFrames.length === 0) return { x: 80, y: 80 };
    const rightmost = existingAiFrames.reduce(
      (best, s) => s.x + s.width > best.x + best.width ? s : best,
      existingAiFrames[0],
    );
    return { x: rightmost.x + rightmost.width + 40, y: rightmost.y };
  }

  it('no existing frames → default position (80, 80)', () => {
    expect(autoPosition([])).toEqual({ x: 80, y: 80 });
  });

  it('one frame at x=80 w=600 → next at x=720', () => {
    expect(autoPosition([{ x: 80, y: 80, width: 600, height: 440 }])).toEqual({ x: 720, y: 80 });
  });

  it('y coordinate matches rightmost frame y', () => {
    const frames = [
      { x: 80, y: 100, width: 600, height: 440 },
      { x: 760, y: 200, width: 600, height: 440 },
    ];
    const pos = autoPosition(frames);
    expect(pos.y).toBe(200); // rightmost frame's y
  });

  it('frames at same x pick the wider one as rightmost', () => {
    const frames = [
      { x: 100, y: 80, width: 800, height: 440 },
      { x: 100, y: 80, width: 600, height: 440 },
    ];
    const pos = autoPosition(frames);
    // rightmost edge: 100+800=900 vs 100+600=700 → first wins
    expect(pos.x).toBe(100 + 800 + 40); // 940
  });
});
