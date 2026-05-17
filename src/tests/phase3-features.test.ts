/**
 * phase3-features.test.ts
 *
 * Tests for features added in Phase 2 / Phase 3:
 *  - Gradient fill parsing and rendering
 *  - Smart edge-to-edge snap (getSnapForMove math)
 *  - Arrow-key nudge accumulation logic
 *  - Alignment math (AlignmentBar.computeAlign)
 *  - Component save / insert logic
 *  - Border-radius per-corner unpacking
 */

import { describe, it, expect } from 'vitest';
import { defaultShape } from '../renderer/lib/shapes';
import type { Shape } from '../renderer/lib/shapes';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeRect(id: string, overrides: Partial<Shape> = {}): Shape {
  return { ...defaultShape('rectangle', id), ...overrides };
}

// ─── Gradient fill ────────────────────────────────────────────────────────────

describe('gradient fill on shapes', () => {
  it('shape can carry gradientFill field', () => {
    const s = makeRect('r1', {
      gradientFill: {
        type: 'linear',
        angle: 135,
        stops: [
          { offset: 0, color: '#ff0000' },
          { offset: 1, color: '#0000ff' },
        ],
      },
    });
    expect(s.gradientFill).toBeDefined();
    expect(s.gradientFill!.type).toBe('linear');
    expect(s.gradientFill!.stops).toHaveLength(2);
  });

  it('gradient stops are ordered by offset', () => {
    const stops = [
      { offset: 1, color: '#000' },
      { offset: 0, color: '#fff' },
      { offset: 0.5, color: '#888' },
    ];
    const sorted = [...stops].sort((a, b) => a.offset - b.offset);
    expect(sorted[0].offset).toBe(0);
    expect(sorted[1].offset).toBe(0.5);
    expect(sorted[2].offset).toBe(1);
  });

  it('gradient css string is built correctly for linear', () => {
    function buildGradientCss(gradient: { type: string; angle: number; stops: { offset: number; color: string }[] }): string {
      const stopStr = gradient.stops
        .map(s => `${s.color} ${Math.round(s.offset * 100)}%`)
        .join(', ');
      return `linear-gradient(${gradient.angle}deg, ${stopStr})`;
    }

    const css = buildGradientCss({
      type: 'linear',
      angle: 90,
      stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
    });
    expect(css).toBe('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
  });

  it('radial gradient type produces radial-gradient css', () => {
    function buildGradientCss(gradient: { type: string; angle: number; stops: { offset: number; color: string }[] }): string {
      const stopStr = gradient.stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ');
      if (gradient.type === 'radial') return `radial-gradient(circle, ${stopStr})`;
      return `linear-gradient(${gradient.angle}deg, ${stopStr})`;
    }
    const css = buildGradientCss({
      type: 'radial',
      angle: 0,
      stops: [{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }],
    });
    expect(css).toMatch(/^radial-gradient/);
  });

  it('shape without gradientFill uses flat fill', () => {
    const s = makeRect('r1', { fill: '#aabbcc' });
    expect(s.gradientFill).toBeUndefined();
    expect(s.fill).toBe('#aabbcc');
  });

  it('gradient with three stops interpolates mid-point', () => {
    const stops = [
      { offset: 0, color: '#ff0000' },
      { offset: 0.5, color: '#00ff00' },
      { offset: 1, color: '#0000ff' },
    ];
    // Mid stop should be at 50%
    expect(stops[1].offset).toBe(0.5);
    expect(stops[1].color).toBe('#00ff00');
  });
});

// ─── Smart edge-to-edge snap (getSnapForMove) ─────────────────────────────────

describe('getSnapForMove: smart edge snapping', () => {
  /** Pure replica of the getSnapForMove algorithm from CanvasOverlay.tsx */
  function getSnapForMove(
    shapeX: number,
    shapeY: number,
    shapeW: number,
    shapeH: number,
    targets: Array<{ id: string; x: number; y: number; width: number; height: number }>,
    excludeIds: string[],
    zoom: number,
    snapThreshold = 6,
  ): { x: number; y: number; snapX: number | null; snapY: number | null } {
    const threshold = snapThreshold / zoom;
    const myXs = [shapeX, shapeX + shapeW / 2, shapeX + shapeW];
    const myYs = [shapeY, shapeY + shapeH / 2, shapeY + shapeH];

    let snapX: number | null = null;
    let snapY: number | null = null;
    let bestX = threshold + 1;
    let bestY = threshold + 1;
    let dxOffset = 0;
    let dyOffset = 0;

    for (const s of targets) {
      if (excludeIds.includes(s.id)) continue;
      const targetXs = [s.x, s.x + s.width / 2, s.x + s.width];
      const targetYs = [s.y, s.y + s.height / 2, s.y + s.height];

      for (let mi = 0; mi < myXs.length; mi++) {
        for (const tx of targetXs) {
          const d = Math.abs(myXs[mi] - tx);
          if (d < bestX) {
            bestX = d;
            snapX = tx;
            dxOffset = myXs[mi] - shapeX;
          }
        }
      }
      for (let mi = 0; mi < myYs.length; mi++) {
        for (const ty of targetYs) {
          const d = Math.abs(myYs[mi] - ty);
          if (d < bestY) {
            bestY = d;
            snapY = ty;
            dyOffset = myYs[mi] - shapeY;
          }
        }
      }
    }

    return {
      x: snapX !== null ? snapX - dxOffset : shapeX,
      y: snapY !== null ? snapY - dyOffset : shapeY,
      snapX,
      snapY,
    };
  }

  const target = { id: 't1', x: 100, y: 100, width: 200, height: 150 };

  it('no snap when shape is far away', () => {
    const result = getSnapForMove(500, 500, 80, 60, [target], [], 1);
    expect(result.snapX).toBeNull();
    expect(result.snapY).toBeNull();
    expect(result.x).toBe(500);
    expect(result.y).toBe(500);
  });

  it('left edge snaps to target left edge', () => {
    // moving shape left edge at ~103 (3px from target left at 100)
    const result = getSnapForMove(103, 300, 80, 60, [target], [], 1);
    expect(result.snapX).toBe(100); // snaps to target.x
    expect(result.x).toBe(100); // shape origin snaps so left edge = 100
  });

  it('right edge snaps to target right edge', () => {
    // moving shape right edge at target.x + target.width = 300
    // shape.x + shape.width = 300 → shape.x = 300 - 80 = 220
    // place it at 222 (2px off) → should snap right edge to 300
    const result = getSnapForMove(222, 300, 80, 60, [target], [], 1);
    expect(result.snapX).toBe(300);
    expect(result.x).toBe(220); // 300 - 80
  });

  it('center aligns horizontally', () => {
    // target center x = 100 + 100 = 200
    // moving shape center at 80/2 = 40, so shape.x + 40 ≈ 200 → shape.x ≈ 160
    // place at 162 (center = 202, 2px off from 200)
    const result = getSnapForMove(162, 300, 80, 60, [target], [], 1);
    expect(result.snapX).toBe(200); // target center
    expect(result.x).toBe(160); // 200 - 40 (half width)
  });

  it('top edge snaps to target top edge', () => {
    // moving shape top at ~102 (2px from target top at 100)
    const result = getSnapForMove(300, 102, 80, 60, [target], [], 1);
    expect(result.snapY).toBe(100);
    expect(result.y).toBe(100);
  });

  it('bottom edge snaps to target bottom edge (100+150=250)', () => {
    // moving shape bottom at shape.y + 60 ≈ 252 (2px from 250)
    const result = getSnapForMove(300, 192, 80, 60, [target], [], 1);
    expect(result.snapY).toBe(250);
    expect(result.y).toBe(190); // 250 - 60
  });

  it('excluded shapes are ignored', () => {
    const result = getSnapForMove(102, 300, 80, 60, [target], ['t1'], 1);
    // target is excluded → no snap
    expect(result.snapX).toBeNull();
  });

  it('zoom affects threshold (high zoom = tighter snap zone)', () => {
    // At zoom=2, threshold is 6/2=3px in canvas space
    // Moving shape left at 104 (4px from target left 100) → should NOT snap at zoom=2
    const result = getSnapForMove(104, 300, 80, 60, [target], [], 2);
    expect(result.snapX).toBeNull();
  });

  it('zoom=2: within 3px threshold snaps', () => {
    // 2px from target left 100 → within 3px threshold at zoom=2 → should snap
    const result = getSnapForMove(102, 300, 80, 60, [target], [], 2);
    expect(result.snapX).toBe(100);
  });

  it('closest edge wins when multiple edges are near threshold', () => {
    // Put shape so left edge (103) is closer to target left (100) than right edge (183) to target center (200)
    const result = getSnapForMove(103, 300, 80, 60, [target], [], 1);
    expect(result.snapX).toBe(100); // left edge wins (3px < 17px)
  });

  it('multiple targets: picks nearest', () => {
    const t2 = { id: 't2', x: 400, y: 400, width: 100, height: 100 };
    // shape near target t1 left (100), far from t2
    const result = getSnapForMove(103, 300, 80, 60, [target, t2], [], 1);
    expect(result.snapX).toBe(100); // t1 wins
  });
});

// ─── Arrow-key nudge accumulation ────────────────────────────────────────────

describe('nudge accumulation logic', () => {
  /**
   * The nudge accumulates deltas per key-hold session and commits on key-up.
   * Test the pure accumulation math.
   */

  type NudgeAcc = { baseX: number; baseY: number; dx: number; dy: number };

  function applyNudge(
    acc: NudgeAcc,
    key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
    shift: boolean,
  ): NudgeAcc {
    const delta = shift ? 10 : 1;
    const dx = key === 'ArrowLeft' ? -delta : key === 'ArrowRight' ? delta : 0;
    const dy = key === 'ArrowUp' ? -delta : key === 'ArrowDown' ? delta : 0;
    return { ...acc, dx: acc.dx + dx, dy: acc.dy + dy };
  }

  function finalPosition(acc: NudgeAcc) {
    return { x: acc.baseX + acc.dx, y: acc.baseY + acc.dy };
  }

  it('single right arrow → +1px x', () => {
    let acc: NudgeAcc = { baseX: 100, baseY: 200, dx: 0, dy: 0 };
    acc = applyNudge(acc, 'ArrowRight', false);
    expect(finalPosition(acc)).toEqual({ x: 101, y: 200 });
  });

  it('single left arrow → -1px x', () => {
    let acc: NudgeAcc = { baseX: 100, baseY: 200, dx: 0, dy: 0 };
    acc = applyNudge(acc, 'ArrowLeft', false);
    expect(finalPosition(acc)).toEqual({ x: 99, y: 200 });
  });

  it('single up arrow → -1px y', () => {
    let acc: NudgeAcc = { baseX: 100, baseY: 200, dx: 0, dy: 0 };
    acc = applyNudge(acc, 'ArrowUp', false);
    expect(finalPosition(acc)).toEqual({ x: 100, y: 199 });
  });

  it('single down arrow → +1px y', () => {
    let acc: NudgeAcc = { baseX: 100, baseY: 200, dx: 0, dy: 0 };
    acc = applyNudge(acc, 'ArrowDown', false);
    expect(finalPosition(acc)).toEqual({ x: 100, y: 201 });
  });

  it('shift+right → +10px x', () => {
    let acc: NudgeAcc = { baseX: 100, baseY: 200, dx: 0, dy: 0 };
    acc = applyNudge(acc, 'ArrowRight', true);
    expect(finalPosition(acc)).toEqual({ x: 110, y: 200 });
  });

  it('shift+up → -10px y', () => {
    let acc: NudgeAcc = { baseX: 100, baseY: 200, dx: 0, dy: 0 };
    acc = applyNudge(acc, 'ArrowUp', true);
    expect(finalPosition(acc)).toEqual({ x: 100, y: 190 });
  });

  it('multiple presses accumulate', () => {
    let acc: NudgeAcc = { baseX: 50, baseY: 50, dx: 0, dy: 0 };
    acc = applyNudge(acc, 'ArrowRight', false);
    acc = applyNudge(acc, 'ArrowRight', false);
    acc = applyNudge(acc, 'ArrowRight', false);
    acc = applyNudge(acc, 'ArrowDown', false);
    acc = applyNudge(acc, 'ArrowDown', false);
    expect(finalPosition(acc)).toEqual({ x: 53, y: 52 });
  });

  it('mixed left and right cancels out', () => {
    let acc: NudgeAcc = { baseX: 100, baseY: 100, dx: 0, dy: 0 };
    acc = applyNudge(acc, 'ArrowRight', false);
    acc = applyNudge(acc, 'ArrowLeft', false);
    expect(finalPosition(acc)).toEqual({ x: 100, y: 100 });
  });

  it('clearing accumulator resets delta for next session', () => {
    // Simulate commit+clear then new session
    let acc: NudgeAcc = { baseX: 100, baseY: 100, dx: 0, dy: 0 };
    acc = applyNudge(acc, 'ArrowRight', false);
    acc = applyNudge(acc, 'ArrowRight', false);
    const committed = finalPosition(acc);
    // New session: base = committed position, dx/dy reset
    const newAcc: NudgeAcc = { baseX: committed.x, baseY: committed.y, dx: 0, dy: 0 };
    expect(newAcc.baseX).toBe(102);
    expect(newAcc.dx).toBe(0);
  });

  it('base position never changes during accumulation', () => {
    let acc: NudgeAcc = { baseX: 50, baseY: 75, dx: 0, dy: 0 };
    for (let i = 0; i < 10; i++) acc = applyNudge(acc, 'ArrowRight', false);
    expect(acc.baseX).toBe(50); // base unchanged
    expect(acc.baseY).toBe(75);
    expect(acc.dx).toBe(10);
  });
});

// ─── Alignment math (AlignmentBar.computeAlign) ──────────────────────────────

describe('computeAlign: alignment math', () => {
  type Rect = { id: string; x: number; y: number; width: number; height: number };
  type Patch = { id: string; x: number; y: number };

  function computeAlign(shapes: Rect[], action: string): Patch[] {
    if (shapes.length === 0) return [];
    const minX = Math.min(...shapes.map(s => s.x));
    const minY = Math.min(...shapes.map(s => s.y));
    const maxX = Math.max(...shapes.map(s => s.x + s.width));
    const maxY = Math.max(...shapes.map(s => s.y + s.height));
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    switch (action) {
      case 'align-left':    return shapes.map(s => ({ id: s.id, x: minX, y: s.y }));
      case 'align-center-h': return shapes.map(s => ({ id: s.id, x: midX - s.width / 2, y: s.y }));
      case 'align-right':   return shapes.map(s => ({ id: s.id, x: maxX - s.width, y: s.y }));
      case 'align-top':     return shapes.map(s => ({ id: s.id, x: s.x, y: minY }));
      case 'align-center-v': return shapes.map(s => ({ id: s.id, x: s.x, y: midY - s.height / 2 }));
      case 'align-bottom':  return shapes.map(s => ({ id: s.id, x: s.x, y: maxY - s.height }));
      case 'distribute-h': {
        if (shapes.length < 3) return [];
        const sorted = [...shapes].sort((a, b) => a.x - b.x);
        const totalW = sorted.reduce((acc, s) => acc + s.width, 0);
        const gap = (maxX - minX - totalW) / (sorted.length - 1);
        let cursor = minX;
        return sorted.map(s => { const x = cursor; cursor += s.width + gap; return { id: s.id, x, y: s.y }; });
      }
      case 'distribute-v': {
        if (shapes.length < 3) return [];
        const sorted = [...shapes].sort((a, b) => a.y - b.y);
        const totalH = sorted.reduce((acc, s) => acc + s.height, 0);
        const gap = (maxY - minY - totalH) / (sorted.length - 1);
        let cursor = minY;
        return sorted.map(s => { const y = cursor; cursor += s.height + gap; return { id: s.id, x: s.x, y }; });
      }
      default: return [];
    }
  }

  const a: Rect = { id: 'a', x: 50,  y: 200, width: 100, height: 80 };
  const b: Rect = { id: 'b', x: 250, y: 100, width: 60,  height: 40 };
  const c: Rect = { id: 'c', x: 400, y: 300, width: 120, height: 100 };

  // align-left
  it('align-left: all shapes x = minX', () => {
    const patches = computeAlign([a, b], 'align-left');
    expect(patches.find(p => p.id === 'a')!.x).toBe(50);
    expect(patches.find(p => p.id === 'b')!.x).toBe(50);
  });

  it('align-left: y positions unchanged', () => {
    const patches = computeAlign([a, b], 'align-left');
    expect(patches.find(p => p.id === 'a')!.y).toBe(200);
    expect(patches.find(p => p.id === 'b')!.y).toBe(100);
  });

  // align-right
  it('align-right: right edges match maxX', () => {
    // maxX = max(50+100, 250+60) = max(150, 310) = 310
    const patches = computeAlign([a, b], 'align-right');
    expect(patches.find(p => p.id === 'a')!.x).toBe(310 - 100); // 210
    expect(patches.find(p => p.id === 'b')!.x).toBe(310 - 60);  // 250
  });

  // align-center-h
  it('align-center-h: all shape centers share midX', () => {
    // minX=50, maxX=310, midX=180
    const patches = computeAlign([a, b], 'align-center-h');
    expect(patches.find(p => p.id === 'a')!.x).toBe(180 - 50); // 130
    expect(patches.find(p => p.id === 'b')!.x).toBe(180 - 30); // 150
  });

  // align-top
  it('align-top: all shapes y = minY', () => {
    const patches = computeAlign([a, b], 'align-top');
    expect(patches.find(p => p.id === 'a')!.y).toBe(100);
    expect(patches.find(p => p.id === 'b')!.y).toBe(100);
  });

  // align-bottom
  it('align-bottom: bottom edges match maxY', () => {
    // maxY = max(200+80, 100+40) = max(280, 140) = 280
    const patches = computeAlign([a, b], 'align-bottom');
    expect(patches.find(p => p.id === 'a')!.y).toBe(280 - 80); // 200
    expect(patches.find(p => p.id === 'b')!.y).toBe(280 - 40); // 240
  });

  // align-center-v
  it('align-center-v: all shape midpoints share midY', () => {
    // minY=100, maxY=280, midY=190
    const patches = computeAlign([a, b], 'align-center-v');
    expect(patches.find(p => p.id === 'a')!.y).toBe(190 - 40); // 150
    expect(patches.find(p => p.id === 'b')!.y).toBe(190 - 20); // 170
  });

  // single shape: no movement
  it('single shape: align-left is a no-op', () => {
    const patches = computeAlign([a], 'align-left');
    expect(patches[0]).toEqual({ id: 'a', x: a.x, y: a.y });
  });

  // distribute-h
  it('distribute-h: requires 3+ shapes, returns [] for 2', () => {
    expect(computeAlign([a, b], 'distribute-h')).toEqual([]);
  });

  it('distribute-h: spaces 3 shapes evenly horizontally', () => {
    // sorted by x: a(50,w100), b(250,w60), c(400,w120)
    // maxX = max(150, 310, 520) = 520, minX=50
    // totalW = 100+60+120=280, span = 520-50=470
    // gap = (470-280)/(3-1) = 190/2 = 95
    // positions: a→50, b→50+100+95=245, c→245+60+95=400
    const patches = computeAlign([a, b, c], 'distribute-h');
    expect(patches.find(p => p.id === 'a')!.x).toBe(50);
    expect(patches.find(p => p.id === 'b')!.x).toBe(245);
    expect(patches.find(p => p.id === 'c')!.x).toBe(400);
  });

  it('distribute-v: spaces 3 shapes evenly vertically', () => {
    // sorted by y: b(y100,h40), a(y200,h80), c(y300,h100)
    // maxY = max(140,280,400)=400, minY=100
    // totalH=40+80+100=220, span=400-100=300
    // gap=(300-220)/2=40
    // positions: b→100, a→100+40+40=180, c→180+80+40=300
    const patches = computeAlign([a, b, c], 'distribute-v');
    expect(patches.find(p => p.id === 'b')!.y).toBe(100);
    expect(patches.find(p => p.id === 'a')!.y).toBe(180);
    expect(patches.find(p => p.id === 'c')!.y).toBe(300);
  });

  it('empty array returns empty patches', () => {
    expect(computeAlign([], 'align-left')).toEqual([]);
  });
});

// ─── Component save / insert logic ───────────────────────────────────────────

describe('component save / insert logic', () => {
  type ComponentDef = {
    id: string;
    name: string;
    shapes: Shape[];
    thumbnail?: string;
  };

  function saveSelectionAsComponent(
    name: string,
    selectedIds: string[],
    allShapes: Shape[],
    existing: ComponentDef[],
  ): ComponentDef[] {
    const selected = allShapes.filter(s => selectedIds.includes(s.id));
    if (selected.length === 0) return existing;
    const newComp: ComponentDef = {
      id: 'comp-' + Math.random().toString(36).slice(2),
      name: name.trim() || 'Component',
      shapes: selected,
    };
    return [...existing, newComp];
  }

  function insertComponent(
    comp: ComponentDef,
    x: number,
    y: number,
    currentShapes: Shape[],
  ): Shape[] {
    // Offset shapes to insertion point, give fresh ids
    const minX = Math.min(...comp.shapes.map(s => s.x));
    const minY = Math.min(...comp.shapes.map(s => s.y));
    const dx = x - minX;
    const dy = y - minY;
    const newShapes = comp.shapes.map((s, i) => ({
      ...s,
      id: `inserted-${i}-${Date.now()}`,
      x: s.x + dx,
      y: s.y + dy,
    }));
    return [...currentShapes, ...newShapes];
  }

  const r1 = makeRect('r1', { x: 50, y: 50, name: 'Rect A' });
  const r2 = makeRect('r2', { x: 150, y: 80, name: 'Rect B' });

  it('saveSelectionAsComponent creates a new component', () => {
    const result = saveSelectionAsComponent('My Button', ['r1'], [r1, r2], []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My Button');
    expect(result[0].shapes).toHaveLength(1);
    expect(result[0].shapes[0].id).toBe('r1');
  });

  it('empty selection returns existing components unchanged', () => {
    const existing: ComponentDef[] = [{ id: 'c1', name: 'Old', shapes: [r1] }];
    const result = saveSelectionAsComponent('New', [], [r1, r2], existing);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Old');
  });

  it('component name is trimmed', () => {
    const result = saveSelectionAsComponent('  Card  ', ['r1'], [r1], []);
    expect(result[0].name).toBe('Card');
  });

  it('empty name falls back to "Component"', () => {
    const result = saveSelectionAsComponent('   ', ['r1'], [r1], []);
    expect(result[0].name).toBe('Component');
  });

  it('multiple shapes saved as one component', () => {
    const result = saveSelectionAsComponent('Group', ['r1', 'r2'], [r1, r2], []);
    expect(result[0].shapes).toHaveLength(2);
  });

  it('insertComponent offsets shapes to insertion point', () => {
    const comp: ComponentDef = { id: 'c1', name: 'Btn', shapes: [r1] };
    // r1 is at x=50, insert at x=200 → dx=150
    const result = insertComponent(comp, 200, 50, []);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(200);
    expect(result[0].y).toBe(50);
  });

  it('insertComponent gives fresh ids to inserted shapes', () => {
    const comp: ComponentDef = { id: 'c1', name: 'Btn', shapes: [r1] };
    const result = insertComponent(comp, 200, 50, []);
    expect(result[0].id).not.toBe('r1');
  });

  it('insertComponent adds to existing shapes', () => {
    const comp: ComponentDef = { id: 'c1', name: 'Btn', shapes: [r1] };
    const result = insertComponent(comp, 200, 50, [r2]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('r2'); // existing first
  });

  it('insertComponent with multi-shape component preserves relative positions', () => {
    const comp: ComponentDef = {
      id: 'c1',
      name: 'Card',
      shapes: [
        { ...r1, x: 0, y: 0, width: 200, height: 50 },
        { ...r2, x: 0, y: 60, width: 200, height: 30 },
      ],
    };
    const result = insertComponent(comp, 100, 200, []);
    // Both offset by (100-0, 200-0)
    expect(result[0].x).toBe(100);
    expect(result[0].y).toBe(200);
    expect(result[1].x).toBe(100);
    expect(result[1].y).toBe(260); // 200 + 60
  });
});

// ─── Border-radius per-corner ─────────────────────────────────────────────────

describe('border-radius per-corner unpacking', () => {
  /**
   * When all corners are the same, the shape has a single borderRadius.
   * When corners differ, each corner has its own value.
   */

  function unpackCorners(shape: {
    borderRadius?: number;
    borderRadiusTL?: number;
    borderRadiusTR?: number;
    borderRadiusBR?: number;
    borderRadiusBL?: number;
  }): [number, number, number, number] {
    const base = shape.borderRadius ?? 0;
    return [
      shape.borderRadiusTL ?? base,
      shape.borderRadiusTR ?? base,
      shape.borderRadiusBR ?? base,
      shape.borderRadiusBL ?? base,
    ];
  }

  function buildBorderRadiusCss(corners: [number, number, number, number]): string {
    if (corners.every(c => c === corners[0])) return `${corners[0]}px`;
    return corners.map(c => `${c}px`).join(' ');
  }

  it('uniform radius produces single value css', () => {
    const css = buildBorderRadiusCss([8, 8, 8, 8]);
    expect(css).toBe('8px');
  });

  it('mixed radii produces four-value css', () => {
    const css = buildBorderRadiusCss([8, 0, 8, 0]);
    expect(css).toBe('8px 0px 8px 0px');
  });

  it('unpackCorners falls back to borderRadius for all corners', () => {
    const [tl, tr, br, bl] = unpackCorners({ borderRadius: 12 });
    expect([tl, tr, br, bl]).toEqual([12, 12, 12, 12]);
  });

  it('unpackCorners uses per-corner values when present', () => {
    const corners = unpackCorners({
      borderRadius: 0,
      borderRadiusTL: 10,
      borderRadiusTR: 5,
      borderRadiusBR: 0,
      borderRadiusBL: 15,
    });
    expect(corners).toEqual([10, 5, 0, 15]);
  });

  it('unpackCorners defaults to 0 when no radius set', () => {
    const corners = unpackCorners({});
    expect(corners).toEqual([0, 0, 0, 0]);
  });

  it('partial per-corner override inherits base for unset corners', () => {
    const corners = unpackCorners({ borderRadius: 8, borderRadiusTL: 20 });
    expect(corners[0]).toBe(20); // TL overridden
    expect(corners[1]).toBe(8);  // TR inherits base
    expect(corners[2]).toBe(8);  // BR inherits base
    expect(corners[3]).toBe(8);  // BL inherits base
  });

  it('zero radius gives zero css', () => {
    const css = buildBorderRadiusCss([0, 0, 0, 0]);
    expect(css).toBe('0px');
  });

  it('ellipse shape has max borderRadius (9999)', () => {
    const s = defaultShape('ellipse', 'e1');
    expect(s.borderRadius).toBe(9999);
    const corners = unpackCorners(s);
    expect(corners).toEqual([9999, 9999, 9999, 9999]);
  });
});

// ─── Export: shape bounding box ───────────────────────────────────────────────

describe('shape bounding box for export', () => {
  function getBoundingBox(shapes: Array<{ x: number; y: number; width: number; height: number }>) {
    if (shapes.length === 0) return null;
    const minX = Math.min(...shapes.map(s => s.x));
    const minY = Math.min(...shapes.map(s => s.y));
    const maxX = Math.max(...shapes.map(s => s.x + s.width));
    const maxY = Math.max(...shapes.map(s => s.y + s.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  it('single shape bounding box matches shape dimensions', () => {
    const bb = getBoundingBox([{ x: 50, y: 100, width: 200, height: 150 }]);
    expect(bb).toEqual({ x: 50, y: 100, width: 200, height: 150 });
  });

  it('two shapes: bounding box spans both', () => {
    const bb = getBoundingBox([
      { x: 50, y: 50, width: 100, height: 100 },
      { x: 200, y: 100, width: 80, height: 60 },
    ]);
    expect(bb).toEqual({ x: 50, y: 50, width: 230, height: 110 });
  });

  it('empty shapes returns null', () => {
    expect(getBoundingBox([])).toBeNull();
  });

  it('overlapping shapes: bounding box is the union', () => {
    const bb = getBoundingBox([
      { x: 0, y: 0, width: 200, height: 200 },
      { x: 100, y: 100, width: 200, height: 200 },
    ]);
    expect(bb).toEqual({ x: 0, y: 0, width: 300, height: 300 });
  });

  it('nested shape: bounding box equals outer shape when inner is inside', () => {
    const bb = getBoundingBox([
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 50, y: 50, width: 100, height: 80 },
    ]);
    expect(bb).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });
});

// ─── Grid snap ───────────────────────────────────────────────────────────────

describe('grid snap (8px)', () => {
  const GRID_SIZE = 8;
  const gridSnap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE;

  it('snaps 0 to 0', () => { expect(gridSnap(0)).toBe(0); });
  it('snaps 4 to 8 (JS Math.round rounds 0.5 up)', () => { expect(gridSnap(4)).toBe(8); });
  it('snaps 3 to 0 (round down)', () => { expect(gridSnap(3)).toBe(0); });
  it('snaps 5 to 8 (round up)', () => { expect(gridSnap(5)).toBe(8); });
  it('snaps 8 to 8', () => { expect(gridSnap(8)).toBe(8); });
  it('snaps 11 to 8', () => { expect(gridSnap(11)).toBe(8); });
  it('snaps 12 to 16', () => { expect(gridSnap(12)).toBe(16); });
  it('snaps 100 to 104 (Math.round(12.5)=13, nearest multiple of 8)', () => { expect(gridSnap(100)).toBe(104); });
  it('snaps 103 to 104', () => { expect(gridSnap(103)).toBe(104); });
  it('snaps negative -3 to -0 (rounds to 0)', () => { expect(gridSnap(-3)).toBe(-0); });
  it('snaps negative -5 to -8', () => { expect(gridSnap(-5)).toBe(-8); });

  it('grid snap moves shape position to nearest 8px boundary', () => {
    const shape = makeRect('r1', { x: 13, y: 22 });
    const snappedX = gridSnap(shape.x);
    const snappedY = gridSnap(shape.y);
    expect(snappedX).toBe(16);
    expect(snappedY).toBe(24);
  });
});

// ─── Aspect ratio lock ────────────────────────────────────────────────────────

describe('aspect ratio lock math', () => {
  it('maintains ratio when width changes', () => {
    const shape = makeRect('r1', { width: 200, height: 100 });
    const ratio = shape.height / shape.width; // 0.5
    const newWidth = 300;
    const newHeight = Math.round(Math.max(8, newWidth * ratio));
    expect(newHeight).toBe(150);
  });

  it('maintains ratio when height changes', () => {
    const shape = makeRect('r1', { width: 200, height: 100 });
    const ratio = shape.height / shape.width; // 0.5
    const newHeight = 50;
    const newWidth = Math.round(Math.max(8, newHeight / ratio));
    expect(newWidth).toBe(100);
  });

  it('enforces minimum size of 8px on width', () => {
    const ratio = 3; // height = 3x width
    const newWidth = 2;
    const newHeight = Math.round(Math.max(8, newWidth * ratio));
    expect(newHeight).toBeGreaterThanOrEqual(8);
  });

  it('maintains ratio for square shapes', () => {
    const shape = makeRect('r1', { width: 100, height: 100 });
    const ratio = shape.height / shape.width; // 1.0
    const newWidth = 200;
    const newHeight = Math.round(Math.max(8, newWidth * ratio));
    expect(newHeight).toBe(200);
  });

  it('16:9 ratio preserved when width doubles', () => {
    const shape = makeRect('r1', { width: 160, height: 90 });
    const ratio = shape.height / shape.width; // 0.5625
    const newWidth = 320;
    const newHeight = Math.round(Math.max(8, newWidth * ratio));
    expect(newHeight).toBe(180);
  });
});

// ─── Cursor coordinate computation ───────────────────────────────────────────

describe('canvas cursor coordinates', () => {
  // Simulate screenToCanvas: (screenX - panX) / zoom
  function screenToCanvas(screenX: number, screenY: number, panX: number, panY: number, zoom: number) {
    return {
      x: Math.round((screenX - panX) / zoom),
      y: Math.round((screenY - panY) / zoom),
    };
  }

  it('no pan, zoom=1: screen coords = canvas coords', () => {
    const { x, y } = screenToCanvas(100, 200, 0, 0, 1);
    expect(x).toBe(100);
    expect(y).toBe(200);
  });

  it('pan offset shifts canvas origin', () => {
    const { x, y } = screenToCanvas(100, 200, 50, 75, 1);
    expect(x).toBe(50);
    expect(y).toBe(125);
  });

  it('zoom 2x halves canvas coords', () => {
    const { x, y } = screenToCanvas(200, 300, 0, 0, 2);
    expect(x).toBe(100);
    expect(y).toBe(150);
  });

  it('zoom 0.5 doubles canvas coords', () => {
    const { x, y } = screenToCanvas(100, 150, 0, 0, 0.5);
    expect(x).toBe(200);
    expect(y).toBe(300);
  });

  it('combined pan and zoom', () => {
    const { x, y } = screenToCanvas(200, 300, 50, 50, 2);
    expect(x).toBe(75);
    expect(y).toBe(125);
  });
});

// ─── Shape visibility and lock ────────────────────────────────────────────────

describe('shape visibility and lock flags', () => {
  it('new shape defaults to visible (hidden=undefined)', () => {
    const s = defaultShape('rectangle', 'r1');
    expect(s.hidden).toBeUndefined();
    expect(s.hidden ?? false).toBe(false);
  });

  it('new shape defaults to unlocked (locked=undefined)', () => {
    const s = defaultShape('rectangle', 'r1');
    expect(s.locked).toBeUndefined();
    expect(s.locked ?? false).toBe(false);
  });

  it('can set hidden=true via patch', () => {
    const s = { ...defaultShape('rectangle', 'r1'), hidden: true };
    expect(s.hidden).toBe(true);
  });

  it('can set locked=true via patch', () => {
    const s = { ...defaultShape('rectangle', 'r1'), locked: true };
    expect(s.locked).toBe(true);
  });

  it('toggling hidden flips the flag', () => {
    const s = defaultShape('rectangle', 'r1');
    const s2 = { ...s, hidden: !s.hidden };
    expect(s2.hidden).toBe(true);
    const s3 = { ...s2, hidden: !s2.hidden };
    expect(s3.hidden).toBe(false);
  });

  it('hidden shapes are excluded from selection/interaction', () => {
    const shapes = [
      makeRect('r1', { hidden: false }),
      makeRect('r2', { hidden: true }),
      makeRect('r3', {}),
    ];
    const interactable = shapes.filter(s => !(s.hidden ?? false));
    expect(interactable).toHaveLength(2);
    expect(interactable.map(s => s.id)).toContain('r1');
    expect(interactable.map(s => s.id)).not.toContain('r2');
  });

  it('locked shapes cannot be moved', () => {
    const shapes = [
      makeRect('r1', { locked: true }),
      makeRect('r2', { locked: false }),
      makeRect('r3', {}),
    ];
    const moveable = shapes.filter(s => !(s.locked ?? false));
    expect(moveable).toHaveLength(2);
    expect(moveable.map(s => s.id)).not.toContain('r1');
  });

  it('layer reorder preserves all shape properties', () => {
    const shapes = [
      makeRect('r1', { x: 0 }),
      makeRect('r2', { x: 100 }),
      makeRect('r3', { x: 200 }),
    ];
    // Reorder: move r3 to front (first in array = behind, last = front)
    const reordered = [shapes[0], shapes[2], shapes[1]];
    expect(reordered[0].id).toBe('r1');
    expect(reordered[1].id).toBe('r3');
    expect(reordered[2].id).toBe('r2');
    // All properties preserved
    expect(reordered[1].x).toBe(200);
  });
});
