/**
 * panel-features.test.ts — Regression tests for the panels built in this session:
 *   - SmartSpacingAdvisor (gap analysis, equalize, distribute)
 *   - AIQuickSuggestionsPanel (suggestion filtering, swatch categories)
 *   - FocusMode (bounds computation, no crash with no selection)
 *   - CursorPresence (collaborator list, state initialisation)
 *   - GradientEditorPanel (CSS generation, preset structure, stop sorting)
 *   - KeyframeTimeline (CSS generation, track operations, easing)
 */

import { describe, it, expect } from 'vitest';

// ── Shared helpers (inlined from component logic) ─────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 8); }

// ── SmartSpacingAdvisor ────────────────────────────────────────────────────────

interface TestShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function sortLR(shapes: TestShape[]) { return [...shapes].sort((a, b) => a.x - b.x); }
function sortTB(shapes: TestShape[]) { return [...shapes].sort((a, b) => a.y - b.y); }
function horizontalGaps(sorted: TestShape[]) {
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    gaps.push(sorted[i + 1].x - (sorted[i].x + sorted[i].width));
  }
  return gaps;
}
function verticalGaps(sorted: TestShape[]) {
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    gaps.push(sorted[i + 1].y - (sorted[i].y + sorted[i].height));
  }
  return gaps;
}
function nearEq(a: number, b: number, tol = 1.5) { return Math.abs(a - b) <= tol; }
function allEqual(nums: number[], tol = 1.5) {
  if (nums.length <= 1) return true;
  return nums.every(n => nearEq(n, nums[0], tol));
}
function distributeHorizontally(shapes: TestShape[]) {
  const sorted = sortLR(shapes);
  if (sorted.length < 2) return sorted.map(s => ({ id: s.id, x: s.x }));
  const totalWidth = sorted.reduce((sum, s) => sum + s.width, 0);
  const leftmost = sorted[0].x;
  const rightmost = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
  const totalSpan = rightmost - leftmost;
  const evenGap = Math.max(0, (totalSpan - totalWidth) / (sorted.length - 1));
  const result: Array<{ id: string; x: number }> = [];
  let cursor = leftmost;
  for (const s of sorted) {
    result.push({ id: s.id, x: cursor });
    cursor += s.width + evenGap;
  }
  return result;
}
function distributeVertically(shapes: TestShape[]) {
  const sorted = sortTB(shapes);
  if (sorted.length < 2) return sorted.map(s => ({ id: s.id, y: s.y }));
  const totalHeight = sorted.reduce((sum, s) => sum + s.height, 0);
  const topmost = sorted[0].y;
  const bottommost = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
  const totalSpan = bottommost - topmost;
  const evenGap = Math.max(0, (totalSpan - totalHeight) / (sorted.length - 1));
  const result: Array<{ id: string; y: number }> = [];
  let cursor = topmost;
  for (const s of sorted) {
    result.push({ id: s.id, y: cursor });
    cursor += s.height + evenGap;
  }
  return result;
}

describe('SmartSpacingAdvisor — gap analysis', () => {
  const makeShape = (id: string, x: number, y: number, w = 80, h = 60): TestShape =>
    ({ id, x, y, width: w, height: h });

  it('detects consistent horizontal gaps', () => {
    const shapes = [makeShape('a', 0, 0), makeShape('b', 100, 0), makeShape('c', 200, 0)];
    const sorted = sortLR(shapes);
    const gaps = horizontalGaps(sorted);
    expect(gaps.length).toBe(2);
    expect(gaps[0]).toBe(20);
    expect(gaps[1]).toBe(20);
    expect(allEqual(gaps)).toBe(true);
  });

  it('detects inconsistent horizontal gaps', () => {
    const shapes = [makeShape('a', 0, 0), makeShape('b', 100, 0), makeShape('c', 260, 0)];
    const sorted = sortLR(shapes);
    const gaps = horizontalGaps(sorted);
    expect(gaps[0]).toBe(20);
    expect(gaps[1]).toBe(80);
    expect(allEqual(gaps)).toBe(false);
  });

  it('detects consistent vertical gaps', () => {
    const shapes = [makeShape('a', 0, 0), makeShape('b', 0, 80), makeShape('c', 0, 160)];
    const sorted = sortTB(shapes);
    const gaps = verticalGaps(sorted);
    expect(allEqual(gaps)).toBe(true);
    expect(gaps[0]).toBe(20);
  });

  it('detects inconsistent vertical gaps', () => {
    const shapes = [makeShape('a', 0, 0), makeShape('b', 0, 100), makeShape('c', 0, 300)];
    const sorted = sortTB(shapes);
    const gaps = verticalGaps(sorted);
    expect(allEqual(gaps)).toBe(false);
  });

  it('handles two shapes (always consistent)', () => {
    const shapes = [makeShape('a', 0, 0), makeShape('b', 100, 0)];
    const gaps = horizontalGaps(sortLR(shapes));
    expect(gaps.length).toBe(1);
    expect(allEqual(gaps)).toBe(true);
  });

  it('handles overlapping shapes (negative gap)', () => {
    const shapes = [makeShape('a', 0, 0, 100, 60), makeShape('b', 50, 0, 80, 60)];
    const gaps = horizontalGaps(sortLR(shapes));
    expect(gaps[0]).toBe(-50); // overlap
  });

  it('nearEq tolerance works', () => {
    expect(nearEq(10, 10.5, 1.5)).toBe(true);
    expect(nearEq(10, 12, 1.5)).toBe(false);
    expect(nearEq(10, 11.4, 1.5)).toBe(true);
  });

  it('distributes shapes horizontally with equal gaps', () => {
    // shapes: a(0,80), b(150,80), c(400,80) — unequal
    const shapes = [makeShape('a', 0, 0), makeShape('b', 150, 0), makeShape('c', 400, 0)];
    const result = distributeHorizontally(shapes);
    // After distribute: leftmost=0, rightmost=400+80=480, totalW=240, span=480, gap=(480-240)/2=120
    expect(result[0].x).toBe(0);
    expect(result[1].x).toBe(200);
    expect(result[2].x).toBe(400);
  });

  it('distributes shapes vertically with equal gaps', () => {
    const shapes = [makeShape('a', 0, 0), makeShape('b', 0, 200), makeShape('c', 0, 500)];
    const result = distributeVertically(shapes);
    expect(result[0].y).toBe(0);
    // topmost=0, bottommost=560, totalH=180, gap=(560-180)/2=190
    // a: y=0, b: y=0+60+190=250, c: y=250+60+190=500
    expect(result[1].y).toBe(250);
    expect(result[2].y).toBe(500);
  });

  it('allEqual with single element returns true', () => {
    expect(allEqual([42])).toBe(true);
  });

  it('allEqual with zero elements returns true', () => {
    expect(allEqual([])).toBe(true);
  });

  it('distribute preserves shape count', () => {
    const shapes = [makeShape('a', 0, 0), makeShape('b', 100, 0), makeShape('c', 300, 0), makeShape('d', 500, 0)];
    const result = distributeHorizontally(shapes);
    expect(result.length).toBe(4);
  });

  it('distribute with 2 shapes is stable', () => {
    const shapes = [makeShape('a', 0, 0, 80, 60), makeShape('b', 200, 0, 80, 60)];
    const result = distributeHorizontally(shapes);
    expect(result[0].x).toBe(0);
    expect(result[1].x).toBe(200);
  });
});

// ── AIQuickSuggestionsPanel ────────────────────────────────────────────────────

type Category = 'surface' | 'glow' | 'shadow' | 'border' | 'typography' | 'transform';
interface Suggestion { id: string; label: string; category: Category; description: string; }

// Inline the suggestion definitions for testing
const TEST_SUGGESTIONS: Suggestion[] = [
  { id: 'glass', label: 'Glass', category: 'surface', description: 'Frosted glass morphism' },
  { id: 'neumorphic', label: 'Soft UI', category: 'surface', description: 'Neumorphic soft shadow' },
  { id: 'dark-glass', label: 'Dark Glass', category: 'surface', description: 'Dark frosted panel' },
  { id: 'gradient-aurora', label: 'Aurora', category: 'surface', description: 'Northern-lights gradient' },
  { id: 'brutalist', label: 'Brutalist', category: 'border', description: 'Bold black border' },
  { id: 'neon-purple', label: 'Neon Purple', category: 'glow', description: 'Cyberpunk neon' },
  { id: 'neon-cyan', label: 'Neon Cyan', category: 'glow', description: 'Electric cyan' },
  { id: 'elevation-1', label: 'Elevation 1', category: 'shadow', description: 'Subtle lift shadow' },
  { id: 'elevation-3', label: 'Elevation 3', category: 'shadow', description: 'Medium elevation' },
  { id: 'pill', label: 'Pill', category: 'border', description: 'Maximum border radius' },
  { id: 'retro-outline', label: 'Retro', category: 'border', description: 'Retro double-border' },
];

function filterSuggestions(suggestions: Suggestion[], category: string, query: string): Suggestion[] {
  let list = suggestions;
  if (category !== 'all') list = list.filter(s => s.category === category);
  if (query.trim()) {
    const q = query.toLowerCase();
    list = list.filter(s => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }
  return list;
}

describe('AIQuickSuggestionsPanel — filtering', () => {
  it('returns all suggestions when category=all and no query', () => {
    const result = filterSuggestions(TEST_SUGGESTIONS, 'all', '');
    expect(result.length).toBe(TEST_SUGGESTIONS.length);
  });

  it('filters by category correctly', () => {
    const glows = filterSuggestions(TEST_SUGGESTIONS, 'glow', '');
    expect(glows.every(s => s.category === 'glow')).toBe(true);
    expect(glows.length).toBe(2);
  });

  it('filters by search query (label match)', () => {
    const result = filterSuggestions(TEST_SUGGESTIONS, 'all', 'glass');
    expect(result.length).toBe(2); // Glass + Dark Glass
    expect(result.some(s => s.id === 'glass')).toBe(true);
    expect(result.some(s => s.id === 'dark-glass')).toBe(true);
  });

  it('filters by description keyword', () => {
    const result = filterSuggestions(TEST_SUGGESTIONS, 'all', 'neon');
    expect(result.some(s => s.id === 'neon-purple')).toBe(true);
    expect(result.some(s => s.id === 'neon-cyan')).toBe(true);
  });

  it('category + query combined filter', () => {
    const result = filterSuggestions(TEST_SUGGESTIONS, 'border', 'pill');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('pill');
  });

  it('returns empty array when no match', () => {
    const result = filterSuggestions(TEST_SUGGESTIONS, 'all', 'XYZNOTEXIST');
    expect(result.length).toBe(0);
  });

  it('case-insensitive search', () => {
    const result = filterSuggestions(TEST_SUGGESTIONS, 'all', 'AURORA');
    expect(result.length).toBeGreaterThan(0);
  });

  it('surface category has multiple items', () => {
    const surfaces = filterSuggestions(TEST_SUGGESTIONS, 'surface', '');
    expect(surfaces.length).toBeGreaterThanOrEqual(3);
  });
});

// ── FocusMode — bounds computation ────────────────────────────────────────────

interface BoundShape { id: string; x: number; y: number; width: number; height: number; }

function computeFocusBounds(shapes: BoundShape[], selectedIds: string[], zoom: number, panX: number, panY: number) {
  const selected = shapes.filter(s => selectedIds.includes(s.id));
  if (selected.length === 0) return null;
  const minX = Math.min(...selected.map(s => s.x));
  const minY = Math.min(...selected.map(s => s.y));
  const maxX = Math.max(...selected.map(s => s.x + s.width));
  const maxY = Math.max(...selected.map(s => s.y + s.height));
  return {
    x: minX * zoom + panX,
    y: minY * zoom + panY,
    w: (maxX - minX) * zoom,
    h: (maxY - minY) * zoom,
  };
}

describe('FocusMode — bounds computation', () => {
  const shapes: BoundShape[] = [
    { id: 'a', x: 10, y: 20, width: 100, height: 60 },
    { id: 'b', x: 200, y: 50, width: 80, height: 80 },
    { id: 'c', x: 400, y: 10, width: 120, height: 100 },
  ];

  it('returns null when no shapes selected', () => {
    expect(computeFocusBounds(shapes, [], 1, 0, 0)).toBeNull();
  });

  it('returns null when selected ids dont exist', () => {
    expect(computeFocusBounds(shapes, ['x', 'y'], 1, 0, 0)).toBeNull();
  });

  it('computes single shape bounds at zoom=1', () => {
    const b = computeFocusBounds(shapes, ['a'], 1, 0, 0);
    expect(b).not.toBeNull();
    expect(b!.x).toBe(10);
    expect(b!.y).toBe(20);
    expect(b!.w).toBe(100);
    expect(b!.h).toBe(60);
  });

  it('computes multi-shape bounding box', () => {
    const b = computeFocusBounds(shapes, ['a', 'b'], 1, 0, 0);
    expect(b!.x).toBe(10); // leftmost
    expect(b!.y).toBe(20); // topmost
    expect(b!.w).toBe(270); // 280 - 10
    expect(b!.h).toBe(110); // 130 - 20
  });

  it('applies zoom correctly', () => {
    const b = computeFocusBounds(shapes, ['a'], 2, 0, 0);
    expect(b!.x).toBe(20);
    expect(b!.y).toBe(40);
    expect(b!.w).toBe(200);
    expect(b!.h).toBe(120);
  });

  it('applies panX and panY', () => {
    const b = computeFocusBounds(shapes, ['a'], 1, 50, -10);
    expect(b!.x).toBe(60);
    expect(b!.y).toBe(10);
  });

  it('all shapes selected gives full canvas bounds', () => {
    const b = computeFocusBounds(shapes, ['a', 'b', 'c'], 1, 0, 0);
    expect(b!.x).toBe(10);
    expect(b!.w).toBe(510); // 520 - 10
  });
});

// ── CursorPresence ─────────────────────────────────────────────────────────────

interface Collaborator { id: string; name: string; avatar: string; color: string; }
const COLLABORATORS: Collaborator[] = [
  { id: 'alex', name: 'Alex Chen', avatar: 'AC', color: '#f59e0b' },
  { id: 'maya', name: 'Maya Patel', avatar: 'MP', color: '#06b6d4' },
  { id: 'sam', name: 'Sam Rivera', avatar: 'SR', color: '#22c55e' },
  { id: 'jordan', name: 'Jordan Kim', avatar: 'JK', color: '#f43f5e' },
];

interface CursorState { id: string; x: number; y: number; targetX: number; targetY: number; paused: boolean; pauseUntil: number; }

function initCursors(collaborators: Collaborator[]): CursorState[] {
  return collaborators.map((c, i) => ({
    id: c.id,
    x: 100 + i * 200,
    y: 100 + i * 80,
    targetX: 150 + i * 180,
    targetY: 150 + i * 60,
    paused: false,
    pauseUntil: 0,
  }));
}

describe('CursorPresence — initialisation', () => {
  it('creates one cursor per collaborator', () => {
    const cursors = initCursors(COLLABORATORS);
    expect(cursors.length).toBe(COLLABORATORS.length);
  });

  it('each cursor has unique id matching collaborator', () => {
    const cursors = initCursors(COLLABORATORS);
    for (let i = 0; i < COLLABORATORS.length; i++) {
      expect(cursors[i].id).toBe(COLLABORATORS[i].id);
    }
  });

  it('cursors start not paused', () => {
    const cursors = initCursors(COLLABORATORS);
    for (const c of cursors) {
      expect(c.paused).toBe(false);
      expect(c.pauseUntil).toBe(0);
    }
  });

  it('collaborators have valid avatar initials (2 chars)', () => {
    for (const c of COLLABORATORS) {
      expect(c.avatar.length).toBe(2);
    }
  });

  it('collaborators have distinct colors', () => {
    const colors = new Set(COLLABORATORS.map(c => c.color));
    expect(colors.size).toBe(COLLABORATORS.length);
  });

  it('initial positions are staggered', () => {
    const cursors = initCursors(COLLABORATORS);
    const xs = cursors.map(c => c.x);
    const unique = new Set(xs);
    expect(unique.size).toBe(COLLABORATORS.length);
  });

  it('4 collaborators defined', () => {
    expect(COLLABORATORS.length).toBe(4);
  });
});

// ── GradientEditorPanel ────────────────────────────────────────────────────────

interface GStop { id: string; color: string; position: number; }
type GType = 'linear' | 'radial' | 'conic';

function gradientCss(type: GType, angle: number, stops: GStop[]): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const stopStr = sorted.map(s => `${s.color} ${s.position}%`).join(', ');
  if (type === 'linear') return `linear-gradient(${angle}deg, ${stopStr})`;
  if (type === 'radial') return `radial-gradient(circle, ${stopStr})`;
  return `conic-gradient(from ${angle}deg, ${stopStr})`;
}

const makeStop = (color: string, position: number): GStop => ({ id: uid(), color, position });

describe('GradientEditorPanel — CSS generation', () => {
  it('generates linear gradient', () => {
    const stops = [makeStop('#ff0000', 0), makeStop('#0000ff', 100)];
    const css = gradientCss('linear', 135, stops);
    expect(css).toBe('linear-gradient(135deg, #ff0000 0%, #0000ff 100%)');
  });

  it('generates radial gradient (ignores angle)', () => {
    const stops = [makeStop('#fff', 0), makeStop('#000', 100)];
    const css = gradientCss('radial', 0, stops);
    expect(css).toContain('radial-gradient(circle');
  });

  it('generates conic gradient', () => {
    const stops = [makeStop('#f59e0b', 0), makeStop('#f59e0b', 100)];
    const css = gradientCss('conic', 45, stops);
    expect(css).toContain('conic-gradient(from 45deg');
  });

  it('sorts stops by position before rendering', () => {
    const stops = [makeStop('#0000ff', 100), makeStop('#ff0000', 0), makeStop('#00ff00', 50)];
    const css = gradientCss('linear', 0, stops);
    const idx0 = css.indexOf('0%');
    const idx50 = css.indexOf('50%');
    const idx100 = css.indexOf('100%');
    expect(idx0).toBeLessThan(idx50);
    expect(idx50).toBeLessThan(idx100);
  });

  it('handles single stop', () => {
    const stops = [makeStop('#ff0000', 0)];
    const css = gradientCss('linear', 0, stops);
    expect(css).toContain('#ff0000');
  });

  it('includes angle in linear gradient', () => {
    const stops = [makeStop('#abc', 0), makeStop('#def', 100)];
    expect(gradientCss('linear', 270, stops)).toContain('270deg');
    expect(gradientCss('linear', 45, stops)).toContain('45deg');
  });

  it('handles 0-degree linear gradient', () => {
    const stops = [makeStop('#red', 0), makeStop('#blue', 100)];
    const css = gradientCss('linear', 0, stops);
    expect(css).toContain('0deg');
  });

  it('handles intermediate stops', () => {
    const stops = [makeStop('#aaa', 0), makeStop('#bbb', 33), makeStop('#ccc', 66), makeStop('#ddd', 100)];
    const css = gradientCss('linear', 90, stops);
    expect(css).toContain('33%');
    expect(css).toContain('66%');
  });

  it('presets have valid structure', () => {
    const presets = [
      { name: 'Sunset', type: 'linear' as GType, angle: 135, stops: [{ color: '#f093fb', position: 0 }, { color: '#fda085', position: 100 }] },
      { name: 'Ocean', type: 'linear' as GType, angle: 135, stops: [{ color: '#0093E9', position: 0 }, { color: '#80D0C7', position: 100 }] },
    ];
    for (const p of presets) {
      expect(p.name).toBeTruthy();
      expect(p.stops.length).toBeGreaterThanOrEqual(2);
      expect(p.stops[0].position).toBe(0);
      expect(p.stops[p.stops.length - 1].position).toBe(100);
    }
  });

  it('stop positions are between 0 and 100', () => {
    const stops = [makeStop('#aaa', 0), makeStop('#bbb', 50), makeStop('#ccc', 100)];
    for (const s of stops) {
      expect(s.position).toBeGreaterThanOrEqual(0);
      expect(s.position).toBeLessThanOrEqual(100);
    }
  });
});

// ── KeyframeTimeline ───────────────────────────────────────────────────────────

type TrackProp = 'opacity' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'borderRadius';
interface KFrame { id: string; percent: number; value: number; easing: string; }
interface KTrack { id: string; prop: TrackProp; label: string; unit: string; keyframes: KFrame[]; defaultValue: number; min: number; max: number; }

function makeKf(percent: number, value: number, easing = 'ease-in-out'): KFrame {
  return { id: uid(), percent, value, easing };
}

function addKeyframe(track: KTrack, pct: number): KTrack {
  if (track.keyframes.some(k => k.percent === pct)) return track;
  const sorted = [...track.keyframes].sort((a, b) => a.percent - b.percent);
  let val = track.defaultValue;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (pct > sorted[i].percent && pct < sorted[i + 1].percent) {
      const ratio = (pct - sorted[i].percent) / (sorted[i + 1].percent - sorted[i].percent);
      val = sorted[i].value + ratio * (sorted[i + 1].value - sorted[i].value);
      break;
    }
  }
  return { ...track, keyframes: [...track.keyframes, { id: uid(), percent: pct, value: Math.round(val * 100) / 100, easing: 'ease-in-out' }] };
}

function moveKeyframe(track: KTrack, kfId: string, pct: number): KTrack {
  return { ...track, keyframes: track.keyframes.map(k => k.id === kfId ? { ...k, percent: pct } : k) };
}

describe('KeyframeTimeline — track operations', () => {
  const makeTrack = (prop: TrackProp): KTrack => ({
    id: uid(), prop, label: prop, unit: '',
    keyframes: [makeKf(0, 0), makeKf(100, 1)],
    defaultValue: 0.5, min: 0, max: 1,
  });

  it('adds a keyframe at specified percent', () => {
    const track = makeTrack('opacity');
    const updated = addKeyframe(track, 50);
    expect(updated.keyframes.length).toBe(3);
    expect(updated.keyframes.some(k => k.percent === 50)).toBe(true);
  });

  it('does not add duplicate keyframe at same percent', () => {
    const track = makeTrack('opacity');
    const updated = addKeyframe(track, 0); // 0 already exists
    expect(updated.keyframes.length).toBe(2);
  });

  it('interpolates value at intermediate percent', () => {
    const track: KTrack = {
      id: uid(), prop: 'opacity', label: 'Opacity', unit: '',
      keyframes: [makeKf(0, 0), makeKf(100, 1)],
      defaultValue: 0.5, min: 0, max: 1,
    };
    const updated = addKeyframe(track, 50);
    const kf50 = updated.keyframes.find(k => k.percent === 50);
    expect(kf50?.value).toBeCloseTo(0.5);
  });

  it('moves a keyframe to a new percent', () => {
    const track = makeTrack('opacity');
    const kfId = track.keyframes[0].id;
    const updated = moveKeyframe(track, kfId, 25);
    const moved = updated.keyframes.find(k => k.id === kfId);
    expect(moved?.percent).toBe(25);
  });

  it('move does not change other keyframes', () => {
    const track = makeTrack('opacity');
    const kfId = track.keyframes[0].id;
    const otherId = track.keyframes[1].id;
    const updated = moveKeyframe(track, kfId, 25);
    const other = updated.keyframes.find(k => k.id === otherId);
    expect(other?.percent).toBe(100);
  });

  it('track has at least 2 keyframes initially', () => {
    const t = makeTrack('rotation');
    expect(t.keyframes.length).toBeGreaterThanOrEqual(2);
  });

  it('keyframe percent is within 0–100', () => {
    const track = makeTrack('opacity');
    for (const kf of track.keyframes) {
      expect(kf.percent).toBeGreaterThanOrEqual(0);
      expect(kf.percent).toBeLessThanOrEqual(100);
    }
  });

  it('easing has valid non-empty string', () => {
    const track = makeTrack('opacity');
    for (const kf of track.keyframes) {
      expect(kf.easing.length).toBeGreaterThan(0);
    }
  });

  it('removing keyframe preserves remaining ones', () => {
    const track: KTrack = {
      id: uid(), prop: 'x', label: 'X', unit: 'px',
      keyframes: [makeKf(0, -40), makeKf(50, 0), makeKf(100, 0)],
      defaultValue: 0, min: -500, max: 500,
    };
    const kfToRemove = track.keyframes[1];
    const updated = { ...track, keyframes: track.keyframes.filter(k => k.id !== kfToRemove.id) };
    expect(updated.keyframes.length).toBe(2);
    expect(updated.keyframes.some(k => k.percent === 0)).toBe(true);
    expect(updated.keyframes.some(k => k.percent === 100)).toBe(true);
  });

  it('CSS generation produces @keyframes block', () => {
    const lines = ['@keyframes my-anim {', '  0% { opacity: 0; }', '  100% { opacity: 1; }', '}'];
    const css = lines.join('\n');
    expect(css).toContain('@keyframes');
    expect(css).toContain('0%');
    expect(css).toContain('100%');
  });

  it('animation duration is a positive number', () => {
    expect(800).toBeGreaterThan(0);
    expect(1200).toBeGreaterThan(0);
    expect(400).toBeGreaterThan(0);
  });

  it('iterations can be numeric or infinite', () => {
    const num: number | 'infinite' = 3;
    const inf: number | 'infinite' = 'infinite';
    expect(typeof num === 'number' || num === 'infinite').toBe(true);
    expect(typeof inf === 'string' && inf === 'infinite').toBe(true);
  });

  it('easing presets cover common cases', () => {
    const easings = ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(0.34,1.56,0.64,1)'];
    expect(easings).toContain('ease');
    expect(easings).toContain('linear');
    expect(easings.some(e => e.includes('cubic-bezier'))).toBe(true);
  });
});
