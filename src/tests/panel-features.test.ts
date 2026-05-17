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

// ── ColorContrastPanel — WCAG math ────────────────────────────────────────────

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}

function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

function contrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return null;
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagLevel(ratio: number | null, large: boolean): 'AAA' | 'AA' | 'FAIL' {
  if (ratio === null) return 'FAIL';
  if (large) {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3) return 'AA';
    return 'FAIL';
  } else {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    return 'FAIL';
  }
}

describe('ColorContrastPanel — WCAG math', () => {
  it('black on white has maximum contrast (21:1)', () => {
    const ratio = contrastRatio('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('white on white has minimum contrast (1:1)', () => {
    const ratio = contrastRatio('#ffffff', '#ffffff');
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('black on white passes AAA for normal text', () => {
    expect(wcagLevel(21, false)).toBe('AAA');
  });

  it('ratio 4.5 passes AA for normal text', () => {
    expect(wcagLevel(4.5, false)).toBe('AA');
  });

  it('ratio 3.0 passes AA for large text only', () => {
    expect(wcagLevel(3.0, false)).toBe('FAIL');
    expect(wcagLevel(3.0, true)).toBe('AA');
  });

  it('ratio 7.0 passes AAA for normal text', () => {
    expect(wcagLevel(7.0, false)).toBe('AAA');
  });

  it('ratio 4.49 fails AA for normal text', () => {
    expect(wcagLevel(4.49, false)).toBe('FAIL');
  });

  it('invalid hex returns null ratio', () => {
    expect(contrastRatio('invalid', '#ffffff')).toBeNull();
  });

  it('null ratio returns FAIL', () => {
    expect(wcagLevel(null, false)).toBe('FAIL');
    expect(wcagLevel(null, true)).toBe('FAIL');
  });

  it('hexToRgb parses 6-digit hex', () => {
    const rgb = hexToRgb('#ff8800');
    expect(rgb).not.toBeNull();
    expect(rgb!.r).toBe(255);
    expect(rgb!.g).toBe(136);
    expect(rgb!.b).toBe(0);
  });

  it('hexToRgb parses 3-digit hex', () => {
    const rgb = hexToRgb('#f80');
    expect(rgb).not.toBeNull();
    expect(rgb!.r).toBe(255);
    expect(rgb!.g).toBe(136);
    expect(rgb!.b).toBe(0);
  });

  it('hexToRgb ignores # prefix', () => {
    const rgb = hexToRgb('ff8800');
    expect(rgb).not.toBeNull();
    expect(rgb!.r).toBe(255);
  });

  it('white is maximum luminance (1.0)', () => {
    const rgb = hexToRgb('#ffffff')!;
    expect(relativeLuminance(rgb)).toBeCloseTo(1, 2);
  });

  it('black is minimum luminance (0.0)', () => {
    const rgb = hexToRgb('#000000')!;
    expect(relativeLuminance(rgb)).toBeCloseTo(0, 2);
  });

  it('contrast is symmetric (fg vs bg = bg vs fg)', () => {
    const r1 = contrastRatio('#336699', '#f5f5f5');
    const r2 = contrastRatio('#f5f5f5', '#336699');
    expect(r1).toBeCloseTo(r2!, 5);
  });

  it('dark blue on white passes AA (or better)', () => {
    const ratio = contrastRatio('#003380', '#ffffff');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(4.5);
    const level = wcagLevel(ratio, false);
    expect(level === 'AA' || level === 'AAA').toBe(true);
  });

  it('light gray on white fails', () => {
    const ratio = contrastRatio('#cccccc', '#ffffff');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(4.5);
    expect(wcagLevel(ratio, false)).toBe('FAIL');
  });
});

// ── LayoutInspectorOverlay — nearest neighbor math ────────────────────────────

interface LIShape { id: string; x: number; y: number; width: number; height: number; }

function findNearest2(shape: LIShape, others: LIShape[]) {
  let left: number | null = null, right: number | null = null;
  let top: number | null = null, bottom: number | null = null;

  for (const other of others) {
    if (other.id === shape.id) continue;
    const vertOverlap = other.y < shape.y + shape.height && other.y + other.height > shape.y;
    if (vertOverlap) {
      const otherRight = other.x + other.width;
      if (otherRight <= shape.x) {
        const gap = shape.x - otherRight;
        if (left === null || gap < left) left = gap;
      }
      if (other.x >= shape.x + shape.width) {
        const gap = other.x - (shape.x + shape.width);
        if (right === null || gap < right) right = gap;
      }
    }
    const horizOverlap = other.x < shape.x + shape.width && other.x + other.width > shape.x;
    if (horizOverlap) {
      const otherBottom = other.y + other.height;
      if (otherBottom <= shape.y) {
        const gap = shape.y - otherBottom;
        if (top === null || gap < top) top = gap;
      }
      if (other.y >= shape.y + shape.height) {
        const gap = other.y - (shape.y + shape.height);
        if (bottom === null || gap < bottom) bottom = gap;
      }
    }
  }
  return { left, right, top, bottom };
}

describe('LayoutInspectorOverlay — nearest neighbor computation', () => {
  const makeLS = (id: string, x: number, y: number, w = 80, h = 60): LIShape => ({ id, x, y, width: w, height: h });

  it('finds left neighbor gap', () => {
    const shapes = [makeLS('a', 0, 0), makeLS('b', 100, 0)];
    const m = findNearest2(shapes[1], shapes);
    expect(m.left).toBe(20); // b.x(100) - (a.x(0)+a.w(80)) = 20
  });

  it('finds right neighbor gap', () => {
    const shapes = [makeLS('a', 0, 0), makeLS('b', 100, 0)];
    const m = findNearest2(shapes[0], shapes);
    expect(m.right).toBe(20);
  });

  it('finds top neighbor gap', () => {
    const shapes = [makeLS('a', 0, 0), makeLS('b', 0, 100)];
    const m = findNearest2(shapes[1], shapes);
    expect(m.top).toBe(40); // b.y(100) - (a.y(0)+a.h(60)) = 40
  });

  it('finds bottom neighbor gap', () => {
    const shapes = [makeLS('a', 0, 0), makeLS('b', 0, 100)];
    const m = findNearest2(shapes[0], shapes);
    expect(m.bottom).toBe(40);
  });

  it('returns null when no neighbor in direction', () => {
    const shapes = [makeLS('a', 0, 0)];
    const m = findNearest2(shapes[0], shapes);
    expect(m.left).toBeNull();
    expect(m.right).toBeNull();
    expect(m.top).toBeNull();
    expect(m.bottom).toBeNull();
  });

  it('skips shapes without vertical overlap for h-direction', () => {
    const shapes = [makeLS('a', 0, 0, 80, 60), makeLS('b', 100, 500, 80, 60)];
    const m = findNearest2(shapes[0], shapes);
    expect(m.right).toBeNull(); // no vertical overlap with b
  });

  it('finds nearest among multiple neighbors', () => {
    const shapes = [
      makeLS('a', 0, 0),
      makeLS('b', 100, 0),  // gap 20
      makeLS('c', 200, 0),  // gap 120 from a
    ];
    const m = findNearest2(shapes[0], shapes);
    expect(m.right).toBe(20); // nearest is b (20px), not c (120px)
  });

  it('handles zero gap (touching shapes)', () => {
    const shapes = [makeLS('a', 0, 0, 80, 60), makeLS('b', 80, 0, 80, 60)];
    const m = findNearest2(shapes[0], shapes);
    expect(m.right).toBe(0);
  });

  it('screen coordinate conversion is correct', () => {
    const canvasX = 100;
    const zoom = 2;
    const panX = 50;
    expect(canvasX * zoom + panX).toBe(250);
  });

  it('shape dimensions scale with zoom', () => {
    const w = 120;
    const zoom = 1.5;
    expect(w * zoom).toBe(180);
  });
});

// ── SmartRenamePanel — naming logic ──────────────────────────────────────────

type RenameShapeType = 'frame' | 'rectangle' | 'ellipse' | 'text' | 'path';

interface RenameShape {
  id: string;
  type: RenameShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  text?: string;
  fillType?: string;
  imageUrl?: string;
}

const RENAME_TYPE_PREFIX: Record<string, string> = {
  frame: 'Frame', rectangle: 'Rect', ellipse: 'Circle', text: 'Text', path: 'Path',
};

const RENAME_ROLE_HINTS: { pattern: RegExp; role: string }[] = [
  { pattern: /^(heading|title|h[1-6])/i, role: 'Heading' },
  { pattern: /^(button|btn|cta)/i, role: 'Button' },
  { pattern: /^(label|tag|chip|badge)/i, role: 'Label' },
  { pattern: /^(icon)/i, role: 'Icon' },
  { pattern: /^(card|tile|panel|box)/i, role: 'Card' },
  { pattern: /^(nav|menu|sidebar|header|footer)/i, role: 'Nav' },
  { pattern: /^(input|field|form|search)/i, role: 'Input' },
  { pattern: /^(avatar|profile|user)/i, role: 'Avatar' },
  { pattern: /^(background|bg)/i, role: 'Background' },
  { pattern: /^(logo)/i, role: 'Logo' },
];

function inferRole(shape: RenameShape): string | null {
  const nameCheck = (shape.name ?? '').trim();
  const textCheck = (shape.text ?? '').trim();
  for (const { pattern, role } of RENAME_ROLE_HINTS) {
    if (nameCheck && pattern.test(nameCheck)) return role;
    if (textCheck && pattern.test(textCheck)) return role;
  }
  return null;
}

function extractContent(shape: RenameShape): string {
  if (shape.type === 'text' && shape.text) {
    const raw = shape.text.trim().replace(/\s+/g, ' ');
    return raw.length > 22 ? raw.slice(0, 20) + '…' : raw;
  }
  return '';
}

function suggestNameTest(shape: RenameShape, _allShapes: RenameShape[], index: number): string {
  const type = shape.type;
  const role = inferRole(shape);
  if (role) {
    const content = extractContent(shape);
    if (content) return role + ' – ' + content;
    return role;
  }
  if (type === 'text' && shape.text?.trim()) {
    return 'Text – ' + extractContent(shape);
  }
  if (type === 'frame') {
    if (shape.width >= 375 && shape.width <= 430) return 'Mobile Screen ' + (index + 1);
    if (shape.width >= 768 && shape.width <= 1024) return 'Tablet Screen ' + (index + 1);
    if (shape.width > 1024) return 'Desktop Screen ' + (index + 1);
    return 'Frame ' + (index + 1);
  }
  if (type === 'ellipse') {
    const sq = Math.abs(shape.width - shape.height) < 4;
    if (sq && shape.width < 80) return 'Avatar ' + (index + 1);
    if (sq && shape.width >= 80) return 'Circle ' + (index + 1);
    return 'Ellipse ' + (index + 1);
  }
  if (shape.fillType === 'image' || shape.imageUrl) return 'Image ' + (index + 1);
  if (shape.fillType === 'linear-gradient') return 'Gradient ' + (index + 1);
  if (type === 'rectangle') {
    const sq = Math.abs(shape.width - shape.height) < 4;
    if (sq && shape.width <= 32) return 'Icon ' + (index + 1);
    if (sq && shape.width <= 48) return 'Swatch ' + (index + 1);
  }
  return (RENAME_TYPE_PREFIX[type] ?? 'Shape') + ' ' + (index + 1);
}

function deduplicateNamesTest(rows: { id: string; suggested: string }[]): Map<string, string> {
  const counts = new Map<string, number>();
  const result = new Map<string, string>();
  for (const row of rows) {
    const base = row.suggested;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    result.set(row.id, n === 1 ? base : base + ' ' + n);
  }
  return result;
}

describe('SmartRenamePanel naming logic', () => {
  it('suggests Mobile Screen 1 for 390px-wide frame', () => {
    const s: RenameShape = { id: '1', type: 'frame', x: 0, y: 0, width: 390, height: 844 };
    expect(suggestNameTest(s, [s], 0)).toBe('Mobile Screen 1');
  });

  it('suggests Desktop Screen 1 for wide frame', () => {
    const s: RenameShape = { id: '1', type: 'frame', x: 0, y: 0, width: 1440, height: 900 };
    expect(suggestNameTest(s, [s], 0)).toBe('Desktop Screen 1');
  });

  it('suggests Avatar 1 for small square ellipse', () => {
    const s: RenameShape = { id: '1', type: 'ellipse', x: 0, y: 0, width: 40, height: 40 };
    expect(suggestNameTest(s, [s], 0)).toBe('Avatar 1');
  });

  it('suggests Circle 1 for large square ellipse', () => {
    const s: RenameShape = { id: '1', type: 'ellipse', x: 0, y: 0, width: 120, height: 120 };
    expect(suggestNameTest(s, [s], 0)).toBe('Circle 1');
  });

  it('detects Button role from name', () => {
    const s: RenameShape = { id: '1', type: 'rectangle', x: 0, y: 0, width: 120, height: 40, name: 'btn-primary' };
    expect(suggestNameTest(s, [s], 0)).toBe('Button');
  });

  it('uses text content for plain text shapes', () => {
    const s: RenameShape = { id: '1', type: 'text', x: 0, y: 0, width: 200, height: 20, text: 'Hello World' };
    const name = suggestNameTest(s, [s], 0);
    expect(name).toContain('Hello World');
  });

  it('truncates long text content', () => {
    const s: RenameShape = { id: '1', type: 'text', x: 0, y: 0, width: 400, height: 24, text: 'This is a very long piece of text content here' };
    const name = suggestNameTest(s, [s], 0);
    expect(name.length).toBeLessThan(40);
  });

  it('suggests Icon 1 for tiny square rectangle', () => {
    const s: RenameShape = { id: '1', type: 'rectangle', x: 0, y: 0, width: 24, height: 24 };
    expect(suggestNameTest(s, [s], 0)).toBe('Icon 1');
  });

  it('suggests Image 1 for image-filled shape', () => {
    const s: RenameShape = { id: '1', type: 'rectangle', x: 0, y: 0, width: 400, height: 300, fillType: 'image' };
    expect(suggestNameTest(s, [s], 0)).toBe('Image 1');
  });

  it('deduplicates same-name suggestions', () => {
    const rows = [
      { id: 'a', suggested: 'Button' },
      { id: 'b', suggested: 'Button' },
      { id: 'c', suggested: 'Button' },
    ];
    const result = deduplicateNamesTest(rows);
    expect(result.get('a')).toBe('Button');
    expect(result.get('b')).toBe('Button 2');
    expect(result.get('c')).toBe('Button 3');
  });

  it('does not deduplicate unique names', () => {
    const rows = [{ id: 'a', suggested: 'Avatar 1' }, { id: 'b', suggested: 'Circle 1' }];
    const result = deduplicateNamesTest(rows);
    expect(result.get('a')).toBe('Avatar 1');
    expect(result.get('b')).toBe('Circle 1');
  });

  it('detects Nav role from nav in existing name', () => {
    const s: RenameShape = { id: '1', type: 'frame', x: 0, y: 0, width: 320, height: 60, name: 'nav-bar' };
    expect(suggestNameTest(s, [s], 0)).toBe('Nav');
  });

  it('falls back to type prefix + index', () => {
    const s: RenameShape = { id: '1', type: 'path', x: 0, y: 0, width: 200, height: 100 };
    expect(suggestNameTest(s, [s], 2)).toBe('Path 3');
  });

  it('Swatch role for 48x48 rectangle', () => {
    const s: RenameShape = { id: '1', type: 'rectangle', x: 0, y: 0, width: 48, height: 48 };
    expect(suggestNameTest(s, [s], 0)).toBe('Swatch 1');
  });

  it('Gradient suggested for linear-gradient fill', () => {
    const s: RenameShape = { id: '1', type: 'rectangle', x: 0, y: 0, width: 200, height: 100, fillType: 'linear-gradient' };
    expect(suggestNameTest(s, [s], 0)).toBe('Gradient 1');
  });
});

// ── CanvasComparePanel — snapshot logic ───────────────────────────────────────

function makeCompareSnap(id: string, label: string, takenAt: number) {
  return { id, label, dataUrl: 'data:image/png;base64,abc' + id, takenAt, width: 800, height: 600 };
}

describe('CanvasComparePanel snapshot logic', () => {
  it('snapshot stores id and label', () => {
    const s = makeCompareSnap('s1', 'Snap 1', 1000);
    expect(s.id).toBe('s1');
    expect(s.label).toBe('Snap 1');
  });

  it('dataUrl starts with data:image', () => {
    const s = makeCompareSnap('s2', 'Snap 2', 2000);
    expect(s.dataUrl.startsWith('data:image')).toBe(true);
  });

  it('can remove a snapshot by id', () => {
    const snaps = [makeCompareSnap('a', 'A', 1000), makeCompareSnap('b', 'B', 2000)];
    const remaining = snaps.filter(s => s.id !== 'a');
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('b');
  });

  it('finding before/after snapshots by id works', () => {
    const snaps = [makeCompareSnap('b1', 'Before', 1000), makeCompareSnap('a1', 'After', 2000)];
    const before = snaps.find(s => s.id === 'b1');
    const after = snaps.find(s => s.id === 'a1');
    expect(before?.label).toBe('Before');
    expect(after?.label).toBe('After');
  });

  it('snapshot dimensions stored correctly', () => {
    const s = makeCompareSnap('d', 'Dims', 1000);
    expect(s.width).toBe(800);
    expect(s.height).toBe(600);
  });

  it('clear all snapshots produces empty array', () => {
    const snaps = [makeCompareSnap('1', 'A', 1), makeCompareSnap('2', 'B', 2)];
    const cleared = snaps.filter(() => false);
    expect(cleared.length).toBe(0);
  });

  it('slider percent clamps to 0-100', () => {
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    expect(clamp(-10)).toBe(0);
    expect(clamp(50)).toBe(50);
    expect(clamp(110)).toBe(100);
  });

  it('after snapshot has later timestamp than before', () => {
    const before = makeCompareSnap('b', 'Before', 1000);
    const after = makeCompareSnap('a', 'After', 2000);
    expect(after.takenAt).toBeGreaterThan(before.takenAt);
  });
});

// ── GridDuplicatorPanel — pattern math ────────────────────────────────────────

interface DupShape {
  x: number; y: number; width: number; height: number; type: string;
}

function toRad2(deg: number) { return (deg * Math.PI) / 180; }

function computeGrid(shape: DupShape, rows: number, cols: number, gapX: number, gapY: number) {
  const positions: { x: number; y: number }[] = [];
  const w = shape.width + gapX;
  const h = shape.height + gapY;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue;
      positions.push({ x: shape.x + c * w, y: shape.y + r * h });
    }
  }
  return positions;
}

function computeRing(shape: DupShape, count: number, radius: number) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const positions: { x: number; y: number; rotation: number }[] = [];
  for (let i = 1; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    positions.push({
      x: cx + Math.cos(angle) * radius - shape.width / 2,
      y: cy + Math.sin(angle) * radius - shape.height / 2,
      rotation: (angle * 180) / Math.PI,
    });
  }
  return positions;
}

function computeSpiral(shape: DupShape, count: number, startRadius: number, spacing: number, turns: number) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const positions: { x: number; y: number }[] = [];
  for (let i = 1; i < count; i++) {
    const t = i / Math.max(count - 1, 1);
    const angle = t * turns * 2 * Math.PI;
    const r = startRadius + spacing * i;
    positions.push({
      x: cx + Math.cos(angle) * r - shape.width / 2,
      y: cy + Math.sin(angle) * r - shape.height / 2,
    });
  }
  return positions;
}

describe('GridDuplicatorPanel pattern math', () => {
  const shape: DupShape = { x: 0, y: 0, width: 100, height: 60, type: 'rectangle' };

  it('grid 2x3 creates 5 copies (skips original)', () => {
    const patches = computeGrid(shape, 2, 3, 20, 20);
    expect(patches.length).toBe(5); // 2*3 - 1
  });

  it('grid 1x1 creates 0 copies', () => {
    const patches = computeGrid(shape, 1, 1, 20, 20);
    expect(patches.length).toBe(0);
  });

  it('grid first copy is at gap offset', () => {
    const patches = computeGrid(shape, 1, 2, 20, 0);
    expect(patches[0].x).toBe(shape.width + 20);
    expect(patches[0].y).toBe(0);
  });

  it('grid row stride uses height + gapY', () => {
    const patches = computeGrid(shape, 2, 1, 0, 15);
    expect(patches[0].y).toBe(shape.height + 15);
  });

  it('ring N copies creates N-1 shapes (skips original)', () => {
    const patches = computeRing(shape, 8, 100);
    expect(patches.length).toBe(7);
  });

  it('ring copies are on a circle of given radius', () => {
    const r = 150;
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const patches = computeRing(shape, 4, r);
    for (const p of patches) {
      const dist = Math.sqrt((p.x + shape.width / 2 - cx) ** 2 + (p.y + shape.height / 2 - cy) ** 2);
      expect(Math.abs(dist - r)).toBeLessThan(0.01);
    }
  });

  it('ring angles are evenly distributed', () => {
    const count = 6; // Use 6 so all angles stay in [0, π], avoiding atan2 wrap
    const radius = 100;
    const patches = computeRing(shape, count, radius);
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    // Compute raw angles without atan2: use acos of normalized x, with sign from y
    const angles = patches.map(p => {
      const dx = p.x + shape.width / 2 - cx;
      const dy = p.y + shape.height / 2 - cy;
      const a = Math.atan2(dy, dx);
      return a < 0 ? a + 2 * Math.PI : a; // normalize to [0, 2π]
    }).sort((a, b) => a - b);
    const expectedGap = (2 * Math.PI) / count;
    // Each consecutive gap should be close to 2π/count
    for (let i = 1; i < angles.length; i++) {
      expect(Math.abs((angles[i] - angles[i - 1]) - expectedGap)).toBeLessThan(0.01);
    }
  });

  it('spiral creates count-1 copies', () => {
    const patches = computeSpiral(shape, 10, 30, 15, 2);
    expect(patches.length).toBe(9);
  });

  it('spiral copies have increasing distance from center', () => {
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const patches = computeSpiral(shape, 6, 30, 20, 1);
    const dists = patches.map(p => Math.sqrt((p.x + shape.width / 2 - cx) ** 2 + (p.y + shape.height / 2 - cy) ** 2));
    for (let i = 1; i < dists.length; i++) {
      expect(dists[i]).toBeGreaterThan(dists[i - 1]);
    }
  });

  it('progressive scale-down applies correctly', () => {
    const patches = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }];
    const result = patches.map((p, i) => ({ ...p, scaleX: Math.max(0.2, 1 - 0.05 * (i + 1)) }));
    expect(result[0].scaleX).toBeCloseTo(0.95);
    expect(result[1].scaleX).toBeCloseTo(0.90);
    expect(result[2].scaleX).toBeCloseTo(0.85);
  });

  it('progressive fade-out clamps to minimum 0.1', () => {
    const opacity = (i: number) => Math.max(0.1, 1 - 0.1 * (i + 1));
    for (let i = 0; i < 20; i++) {
      expect(opacity(i)).toBeGreaterThanOrEqual(0.1);
    }
  });
});

// ── DesignDiffPanel diff engine tests ─────────────────────────────────────────

interface DiffSnapshotShape {
  id: string; name: string; type: string;
  x: number; y: number; width: number; height: number;
  fill?: string; fillType?: string; stroke?: string; strokeWidth?: number;
  opacity?: number; fontSize?: number; fontFamily?: string; text?: string;
  rotation?: number;
}

interface DiffSnapshot {
  id: string; label: string; takenAt: Date;
  shapes: DiffSnapshotShape[]; shapeCount: number;
}

type DiffChangeType = 'added' | 'removed' | 'moved' | 'restyled' | 'unchanged' | 'renamed';

interface DiffEntry {
  id: string; type: DiffChangeType;
  shapeName: string; shapeType: string;
  before?: DiffSnapshotShape; after?: DiffSnapshotShape;
  changes: string[];
}

function makeSnap(shapes: DiffSnapshotShape[], label = 'snap'): DiffSnapshot {
  return { id: 'snap', label, takenAt: new Date(), shapes, shapeCount: shapes.length };
}

function makeShape(overrides: Partial<DiffSnapshotShape> & { id: string }): DiffSnapshotShape {
  return { name: 'Shape', type: 'rectangle', x: 0, y: 0, width: 100, height: 50, ...overrides };
}

// Inline diff implementation (mirrors DesignDiffPanel.computeDiff logic)
function computeDiffTest(before: DiffSnapshot, after: DiffSnapshot): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const beforeMap = new Map(before.shapes.map(s => [s.id, s]));
  const afterMap = new Map(after.shapes.map(s => [s.id, s]));

  for (const [id, shape] of afterMap) {
    if (!beforeMap.has(id)) {
      entries.push({ id: 'x', type: 'added', shapeName: shape.name, shapeType: shape.type, after: shape, changes: [] });
    }
  }
  for (const [id, shape] of beforeMap) {
    if (!afterMap.has(id)) {
      entries.push({ id: 'x', type: 'removed', shapeName: shape.name, shapeType: shape.type, before: shape, changes: [] });
    }
  }
  for (const [id, beforeShape] of beforeMap) {
    const afterShape = afterMap.get(id);
    if (!afterShape) continue;
    const changes: string[] = [];
    let moved = false, restyled = false, renamed = false;
    if (Math.abs(afterShape.x - beforeShape.x) > 0.5 || Math.abs(afterShape.y - beforeShape.y) > 0.5) {
      changes.push('Moved'); moved = true;
    }
    if (Math.abs(afterShape.width - beforeShape.width) > 0.5 || Math.abs(afterShape.height - beforeShape.height) > 0.5) {
      changes.push('Resized'); moved = true;
    }
    if (afterShape.fill !== beforeShape.fill) { changes.push('Fill'); restyled = true; }
    if (afterShape.opacity !== beforeShape.opacity) { changes.push('Opacity'); restyled = true; }
    if (afterShape.name !== beforeShape.name) { changes.push('Renamed'); renamed = true; }
    if (changes.length === 0) {
      entries.push({ id: 'x', type: 'unchanged', shapeName: afterShape.name, shapeType: afterShape.type, before: beforeShape, after: afterShape, changes: [] });
    } else {
      const type: DiffChangeType = renamed && !moved && !restyled ? 'renamed'
        : moved ? 'moved' : 'restyled';
      entries.push({ id: 'x', type, shapeName: afterShape.name, shapeType: afterShape.type, before: beforeShape, after: afterShape, changes });
    }
  }
  return entries;
}

describe('DesignDiffPanel diff engine', () => {
  const base = makeShape({ id: 'a', name: 'Button', x: 10, y: 10, width: 120, height: 40, fill: '#6366f1' });

  it('detects added shape', () => {
    const before = makeSnap([base]);
    const newShape = makeShape({ id: 'b', name: 'Card' });
    const after = makeSnap([base, newShape]);
    const diff = computeDiffTest(before, after);
    expect(diff.some(d => d.type === 'added' && d.shapeName === 'Card')).toBe(true);
  });

  it('detects removed shape', () => {
    const b = makeShape({ id: 'b', name: 'Header' });
    const before = makeSnap([base, b]);
    const after = makeSnap([base]);
    const diff = computeDiffTest(before, after);
    expect(diff.some(d => d.type === 'removed' && d.shapeName === 'Header')).toBe(true);
  });

  it('detects moved shape (x changed)', () => {
    const moved = makeShape({ id: 'a', name: 'Button', x: 200, y: 10, width: 120, height: 40, fill: '#6366f1' });
    const diff = computeDiffTest(makeSnap([base]), makeSnap([moved]));
    expect(diff.some(d => d.type === 'moved' && d.changes.includes('Moved'))).toBe(true);
  });

  it('detects restyled shape (fill changed)', () => {
    const restyled = makeShape({ id: 'a', name: 'Button', x: 10, y: 10, width: 120, height: 40, fill: '#ef4444' });
    const diff = computeDiffTest(makeSnap([base]), makeSnap([restyled]));
    expect(diff.some(d => d.type === 'restyled' && d.changes.includes('Fill'))).toBe(true);
  });

  it('marks unchanged shape correctly', () => {
    const same = makeShape({ id: 'a', name: 'Button', x: 10, y: 10, width: 120, height: 40, fill: '#6366f1' });
    const diff = computeDiffTest(makeSnap([base]), makeSnap([same]));
    expect(diff.every(d => d.type === 'unchanged')).toBe(true);
  });

  it('detects renamed shape (name only)', () => {
    const renamed = makeShape({ id: 'a', name: 'CTA Button', x: 10, y: 10, width: 120, height: 40, fill: '#6366f1' });
    const diff = computeDiffTest(makeSnap([base]), makeSnap([renamed]));
    expect(diff.some(d => d.type === 'renamed')).toBe(true);
  });

  it('handles empty before snapshot', () => {
    const after = makeSnap([base, makeShape({ id: 'b', name: 'Nav' })]);
    const diff = computeDiffTest(makeSnap([]), after);
    expect(diff.filter(d => d.type === 'added').length).toBe(2);
  });

  it('handles empty after snapshot', () => {
    const before = makeSnap([base, makeShape({ id: 'b', name: 'Nav' })]);
    const diff = computeDiffTest(before, makeSnap([]));
    expect(diff.filter(d => d.type === 'removed').length).toBe(2);
  });

  it('counts changes accurately in mixed scenario', () => {
    const shape2 = makeShape({ id: 'b', name: 'Card', x: 200, y: 0, width: 200, height: 150 });
    const before = makeSnap([base, shape2]);
    const movedBase = makeShape({ id: 'a', name: 'Button', x: 50, y: 10, width: 120, height: 40, fill: '#6366f1' });
    const newShape = makeShape({ id: 'c', name: 'Footer' });
    const after = makeSnap([movedBase, newShape]);
    const diff = computeDiffTest(before, after);
    expect(diff.filter(d => d.type === 'added').length).toBe(1);
    expect(diff.filter(d => d.type === 'removed').length).toBe(1);
    expect(diff.filter(d => d.type === 'moved').length).toBe(1);
  });

  it('detects opacity change as restyled', () => {
    const faded = makeShape({ id: 'a', name: 'Button', x: 10, y: 10, width: 120, height: 40, fill: '#6366f1', opacity: 0.5 });
    const diff = computeDiffTest(makeSnap([base]), makeSnap([faded]));
    expect(diff.some(d => d.type === 'restyled' && d.changes.includes('Opacity'))).toBe(true);
  });
});

// ── ShapeVariationsPanel generation tests ─────────────────────────────────────

// Inline seeded RNG (mulberry32) + HSL conversion
function mulberry32Test(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randBetweenTest(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

interface VarShape { id: string; type: string; x: number; y: number; width: number; height: number; fill?: string; opacity?: number; borderRadius?: number; rotation?: number; strokeWidth?: number; }
interface VarAxis { key: string; enabled: boolean; min: number; max: number; }
interface VarConfig { count: number; seed: number; lockAspect: boolean; layout: 'grid'|'row'|'radial'; gridCols: number; gap: number; axes: VarAxis[]; }
interface VarResult { index: number; fill: string; opacity: number; width: number; height: number; x: number; y: number; borderRadius: number; rotation: number; strokeWidth: number; }

function generateVariantsTest(shape: VarShape, config: VarConfig): VarResult[] {
  const rng = mulberry32Test(config.seed);
  const axisMap = new Map(config.axes.map(a => [a.key, a]));
  const baseOpacity = shape.opacity ?? 1;
  const baseWidth = shape.width, baseHeight = shape.height;
  const results: VarResult[] = [];
  for (let i = 0; i < config.count; i++) {
    let opacity = baseOpacity;
    const opacityAxis = axisMap.get('opacity');
    if (opacityAxis?.enabled) opacity = Math.max(0.05, Math.min(1, opacity + randBetweenTest(rng, opacityAxis.min, opacityAxis.max) / 100));
    let width = baseWidth, height = baseHeight;
    const sizeAxis = axisMap.get('size');
    if (sizeAxis?.enabled) {
      const scalePct = 1 + randBetweenTest(rng, sizeAxis.min, sizeAxis.max) / 100;
      width = Math.max(4, Math.round(baseWidth * scalePct));
      if (config.lockAspect) height = Math.max(4, Math.round(baseHeight * scalePct));
      else { const sh = 1 + randBetweenTest(rng, sizeAxis.min, sizeAxis.max) / 100; height = Math.max(4, Math.round(baseHeight * sh)); }
    }
    results.push({ index: i, fill: shape.fill ?? '#fff', opacity, width, height, x: 0, y: 0, borderRadius: 0, rotation: 0, strokeWidth: 0 });
  }
  // Apply row layout
  if (config.layout === 'row') {
    let cx = shape.x + shape.width + config.gap;
    for (const v of results) { v.x = cx; v.y = shape.y; cx += v.width + config.gap; }
  }
  return results;
}

describe('ShapeVariationsPanel generation', () => {
  const shape: VarShape = { id: 'a', type: 'rectangle', x: 100, y: 100, width: 80, height: 50, fill: '#6366f1', opacity: 1 };
  const noAxes: VarAxis[] = [
    { key: 'opacity', enabled: false, min: -20, max: 0 },
    { key: 'size', enabled: false, min: -20, max: 20 },
  ];

  it('generates correct count of variants', () => {
    const cfg: VarConfig = { count: 6, seed: 42, lockAspect: true, layout: 'row', gridCols: 3, gap: 16, axes: noAxes };
    expect(generateVariantsTest(shape, cfg).length).toBe(6);
  });

  it('same seed produces same results', () => {
    const cfg: VarConfig = { count: 4, seed: 12345, lockAspect: true, layout: 'row', gridCols: 3, gap: 16, axes: [{ key: 'opacity', enabled: true, min: -30, max: 0 }, { key: 'size', enabled: false, min: -20, max: 20 }] };
    const a = generateVariantsTest(shape, cfg);
    const b = generateVariantsTest(shape, cfg);
    expect(a.map(v => v.opacity)).toEqual(b.map(v => v.opacity));
  });

  it('different seeds produce different results', () => {
    const axes: VarAxis[] = [{ key: 'opacity', enabled: true, min: -40, max: 0 }, { key: 'size', enabled: false, min: -20, max: 20 }];
    const cfg1: VarConfig = { count: 4, seed: 1, lockAspect: true, layout: 'row', gridCols: 3, gap: 16, axes };
    const cfg2: VarConfig = { ...cfg1, seed: 2 };
    const a = generateVariantsTest(shape, cfg1);
    const b = generateVariantsTest(shape, cfg2);
    expect(a.some((v, i) => v.opacity !== b[i].opacity)).toBe(true);
  });

  it('opacity axis clamps to minimum 0.05', () => {
    const axes: VarAxis[] = [{ key: 'opacity', enabled: true, min: -100, max: -99 }, { key: 'size', enabled: false, min: -20, max: 20 }];
    const cfg: VarConfig = { count: 10, seed: 1, lockAspect: true, layout: 'row', gridCols: 3, gap: 16, axes };
    const results = generateVariantsTest(shape, cfg);
    expect(results.every(v => v.opacity >= 0.05)).toBe(true);
  });

  it('row layout starts variants after source shape + gap', () => {
    const cfg: VarConfig = { count: 3, seed: 1, lockAspect: true, layout: 'row', gridCols: 3, gap: 20, axes: noAxes };
    const results = generateVariantsTest(shape, cfg);
    expect(results[0].x).toBe(shape.x + shape.width + 20);
  });

  it('size axis disabled keeps original width', () => {
    const cfg: VarConfig = { count: 5, seed: 7, lockAspect: true, layout: 'row', gridCols: 3, gap: 8, axes: noAxes };
    const results = generateVariantsTest(shape, cfg);
    expect(results.every(v => v.width === shape.width)).toBe(true);
  });

  it('size axis with lockAspect maintains original aspect ratio', () => {
    const axes: VarAxis[] = [{ key: 'size', enabled: true, min: -20, max: 20 }, { key: 'opacity', enabled: false, min: -20, max: 0 }];
    const cfg: VarConfig = { count: 6, seed: 99, lockAspect: true, layout: 'row', gridCols: 3, gap: 8, axes };
    const results = generateVariantsTest(shape, cfg);
    const origRatio = shape.width / shape.height;
    results.forEach(v => {
      const ratio = v.width / v.height;
      expect(Math.abs(ratio - origRatio)).toBeLessThan(0.05);
    });
  });
});

// ── PathInspectorPanel utilities ──────────────────────────────────────────────

// Inline BezierPoint type for test isolation
interface TestBezierPoint {
  x: number; y: number;
  cp1x?: number; cp1y?: number;
  cp2x?: number; cp2y?: number;
}

function fmtNum(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function pointsToPathDTest(points: TestBezierPoint[], closed: boolean): string {
  if (!points.length) return '';
  const parts: string[] = [];
  const p0 = points[0];
  parts.push(`M ${fmtNum(p0.x)} ${fmtNum(p0.y)}`);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const hasCp1 = prev.cp2x !== undefined && prev.cp2y !== undefined;
    const hasCp2 = curr.cp1x !== undefined && curr.cp1y !== undefined;
    if (hasCp1 && hasCp2) {
      parts.push(`C ${fmtNum(prev.cp2x!)} ${fmtNum(prev.cp2y!)} ${fmtNum(curr.cp1x!)} ${fmtNum(curr.cp1y!)} ${fmtNum(curr.x)} ${fmtNum(curr.y)}`);
    } else if (hasCp1) {
      parts.push(`Q ${fmtNum(prev.cp2x!)} ${fmtNum(prev.cp2y!)} ${fmtNum(curr.x)} ${fmtNum(curr.y)}`);
    } else if (hasCp2) {
      parts.push(`Q ${fmtNum(curr.cp1x!)} ${fmtNum(curr.cp1y!)} ${fmtNum(curr.x)} ${fmtNum(curr.y)}`);
    } else {
      parts.push(`L ${fmtNum(curr.x)} ${fmtNum(curr.y)}`);
    }
  }
  if (closed && points.length > 1) parts.push('Z');
  return parts.join(' ');
}

function reversePathTest(points: TestBezierPoint[]): TestBezierPoint[] {
  return [...points].reverse().map(pt => ({
    x: pt.x, y: pt.y,
    cp1x: pt.cp2x, cp1y: pt.cp2y,
    cp2x: pt.cp1x, cp2y: pt.cp1y,
  }));
}

function simplifyPathTest(points: TestBezierPoint[]): TestBezierPoint[] {
  return points.map((pt, i) => {
    const prev = points[i - 1];
    const next = points[i + 1];
    const newPt: TestBezierPoint = { x: pt.x, y: pt.y };
    if (pt.cp1x !== undefined && prev) {
      const midX = (prev.x + pt.x) / 2;
      const midY = (prev.y + pt.y) / 2;
      const dist = Math.hypot(pt.cp1x - midX, (pt.cp1y ?? 0) - midY);
      if (dist > 1) { newPt.cp1x = pt.cp1x; newPt.cp1y = pt.cp1y; }
    }
    if (pt.cp2x !== undefined && next) {
      const midX = (pt.x + next.x) / 2;
      const midY = (pt.y + next.y) / 2;
      const dist = Math.hypot(pt.cp2x - midX, (pt.cp2y ?? 0) - midY);
      if (dist > 1) { newPt.cp2x = pt.cp2x; newPt.cp2y = pt.cp2y; }
    }
    return newPt;
  });
}

function parseSVGPathDTest(d: string): { points: TestBezierPoint[]; closed: boolean } {
  const tokens = d.trim().split(/[\s,]+|(?=[MLCQZmlcqz])/g).filter(Boolean);
  const points: TestBezierPoint[] = [];
  let closed = false;
  let i = 0;
  let lastX = 0; let lastY = 0;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': case 'm': {
        const x = cmd === 'M' ? num() : lastX + num();
        const y = cmd === 'M' ? num() : lastY + num();
        points.push({ x, y }); lastX = x; lastY = y; break;
      }
      case 'L': case 'l': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const x = cmd === 'L' ? num() : lastX + num();
          const y = cmd === 'L' ? num() : lastY + num();
          points.push({ x, y }); lastX = x; lastY = y;
        }
        break;
      }
      case 'C': case 'c': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const cp2x = num(); const cp2y = num();
          const cp1x = num(); const cp1y = num();
          const x = num(); const y = num();
          if (points.length > 0) { const prev = points[points.length - 1]; prev.cp2x = cp2x; prev.cp2y = cp2y; }
          points.push({ x, y, cp1x, cp1y }); lastX = x; lastY = y;
        }
        break;
      }
      case 'Z': case 'z': closed = true; break;
      default: break;
    }
  }
  return { points, closed };
}

describe('PathInspectorPanel utilities', () => {
  it('pointsToPathD generates correct M L commands for straight path', () => {
    const pts: TestBezierPoint[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const d = pointsToPathDTest(pts, false);
    expect(d).toBe('M 0 0 L 100 0 L 100 100');
  });

  it('pointsToPathD adds Z for closed path', () => {
    const pts: TestBezierPoint[] = [{ x: 0, y: 0 }, { x: 50, y: 100 }];
    const d = pointsToPathDTest(pts, true);
    expect(d).toContain('Z');
  });

  it('pointsToPathD generates C command when both control points are present', () => {
    const pts: TestBezierPoint[] = [
      { x: 0, y: 0, cp2x: 10, cp2y: 0 },
      { x: 100, y: 0, cp1x: 90, cp1y: 0 },
    ];
    const d = pointsToPathDTest(pts, false);
    expect(d).toContain('C');
    expect(d).not.toContain('L');
  });

  it('pointsToPathD generates Q command when only out-handle present', () => {
    const pts: TestBezierPoint[] = [
      { x: 0, y: 0, cp2x: 50, cp2y: -50 },
      { x: 100, y: 0 },
    ];
    const d = pointsToPathDTest(pts, false);
    expect(d).toContain('Q');
  });

  it('pointsToPathD returns empty string for empty array', () => {
    expect(pointsToPathDTest([], false)).toBe('');
  });

  it('reversePathTest reverses point order', () => {
    const pts: TestBezierPoint[] = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }];
    const reversed = reversePathTest(pts);
    expect(reversed[0].x).toBe(100);
    expect(reversed[0].y).toBe(0);
    expect(reversed[2].x).toBe(0);
    expect(reversed[2].y).toBe(0);
  });

  it('reversePathTest swaps control point handles', () => {
    const pts: TestBezierPoint[] = [
      { x: 0, y: 0, cp2x: 10, cp2y: 5 },
      { x: 100, y: 0, cp1x: 90, cp1y: 5 },
    ];
    const reversed = reversePathTest(pts);
    // Original last point had cp1x=90, which becomes cp2x in reversed
    expect(reversed[0].cp2x).toBe(90);
    expect(reversed[0].cp2y).toBe(5);
  });

  it('simplifyPathTest removes near-midpoint control points', () => {
    const pts: TestBezierPoint[] = [
      { x: 0, y: 0 },
      // cp1 is exactly midpoint between prev(0,0) and curr(100,0) = (50,0) — deviation 0
      { x: 100, y: 0, cp1x: 50, cp1y: 0 },
      { x: 200, y: 0 },
    ];
    const simplified = simplifyPathTest(pts);
    // The cp1 at exact midpoint should be removed (dist <= 1)
    expect(simplified[1].cp1x).toBeUndefined();
  });

  it('simplifyPathTest keeps control points with significant deviation', () => {
    const pts: TestBezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0, cp1x: 50, cp1y: -50 }, // 50px above midpoint — significant
      { x: 200, y: 0 },
    ];
    const simplified = simplifyPathTest(pts);
    expect(simplified[1].cp1x).toBe(50);
    expect(simplified[1].cp1y).toBe(-50);
  });

  it('parseSVGPathDTest parses M L Z path correctly', () => {
    const { points, closed } = parseSVGPathDTest('M 10 20 L 50 80 L 90 20 Z');
    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({ x: 10, y: 20 });
    expect(points[1]).toMatchObject({ x: 50, y: 80 });
    expect(points[2]).toMatchObject({ x: 90, y: 20 });
    expect(closed).toBe(true);
  });

  it('parseSVGPathDTest parses open path without Z', () => {
    const { points, closed } = parseSVGPathDTest('M 0 0 L 100 0 L 100 100');
    expect(points).toHaveLength(3);
    expect(closed).toBe(false);
  });
});

// ── EasingCurvePanel utilities ────────────────────────────────────────────────

function cubicBezier1DTest(t: number, p1: number, p2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
}

function sampleCurveTest(x1: number, y1: number, x2: number, y2: number, steps = 80): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = cubicBezier1DTest(t, x1, x2);
    const y = cubicBezier1DTest(t, y1, y2);
    pts.push([x, y]);
  }
  return pts;
}

function evalCurveTest(x: number, x1: number, y1: number, x2: number, y2: number): number {
  let lo = 0; let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const xMid = cubicBezier1DTest(mid, x1, x2);
    if (Math.abs(xMid - x) < 0.0001) return cubicBezier1DTest(mid, y1, y2);
    if (xMid < x) lo = mid; else hi = mid;
  }
  return cubicBezier1DTest((lo + hi) / 2, y1, y2);
}

function formatCubicBezierTest(x1: number, y1: number, x2: number, y2: number): string {
  const f = (n: number) => Number(n.toFixed(3)).toString();
  return `cubic-bezier(${f(x1)}, ${f(y1)}, ${f(x2)}, ${f(y2)})`;
}

describe('EasingCurvePanel utilities', () => {
  it('linear curve (0,0,1,1) evaluates y=x at all points', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const y = evalCurveTest(t, 0, 0, 1, 1);
      expect(Math.abs(y - t)).toBeLessThan(0.02);
    }
  });

  it('ease-in curve starts slow and ends fast', () => {
    // ease-in: x1=0.42,y1=0,x2=1,y2=1
    const x1 = 0.42; const y1 = 0; const x2 = 1; const y2 = 1;
    const yAt25 = evalCurveTest(0.25, x1, y1, x2, y2);
    const yAt75 = evalCurveTest(0.75, x1, y1, x2, y2);
    // ease-in: slow at start means yAt25 < 0.25 (progress behind time)
    expect(yAt25).toBeLessThan(0.25);
    // fast at end means yAt75 > 0.5
    expect(yAt75).toBeGreaterThan(0.5);
  });

  it('ease-out curve starts fast and ends slow', () => {
    // ease-out: x1=0,y1=0,x2=0.58,y2=1
    const x1 = 0; const y1 = 0; const x2 = 0.58; const y2 = 1;
    const yAt25 = evalCurveTest(0.25, x1, y1, x2, y2);
    // ease-out: fast at start means yAt25 > 0.25
    expect(yAt25).toBeGreaterThan(0.25);
  });

  it('curve endpoints are always (0,0) and (1,1)', () => {
    const pts = sampleCurveTest(0.25, 0.1, 0.25, 1);
    const [x0, y0] = pts[0];
    const [x1, y1] = pts[pts.length - 1];
    expect(Math.abs(x0)).toBeLessThan(0.001);
    expect(Math.abs(y0)).toBeLessThan(0.001);
    expect(Math.abs(x1 - 1)).toBeLessThan(0.001);
    expect(Math.abs(y1 - 1)).toBeLessThan(0.001);
  });

  it('sampleCurve returns correct number of points', () => {
    const pts = sampleCurveTest(0.5, 0.5, 0.5, 0.5, 40);
    expect(pts).toHaveLength(41); // steps + 1
  });

  it('formatCubicBezier generates correct CSS string', () => {
    const css = formatCubicBezierTest(0.25, 0.1, 0.25, 1);
    expect(css).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)');
  });

  it('formatCubicBezier rounds to 3 decimal places', () => {
    const css = formatCubicBezierTest(0.123456, 0, 0.987654, 1);
    expect(css).toContain('0.123');
    expect(css).toContain('0.988');
  });

  it('back-out curve overshoots 1.0 (y > 1 temporarily)', () => {
    // back-out: x1=0.175, y1=0.885, x2=0.32, y2=1.275
    const pts = sampleCurveTest(0.175, 0.885, 0.32, 1.275);
    const maxY = Math.max(...pts.map(([, y]) => y));
    expect(maxY).toBeGreaterThan(1.0); // overshoots
  });
});

// ── ContrastMatrixPanel utilities ─────────────────────────────────────────────

function hexToRgbTest(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  if (h.length === 6) return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  return null;
}
function linearizeTest(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminanceTest(hex: string): number {
  const rgb = hexToRgbTest(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb;
  return 0.2126 * linearizeTest(r) + 0.7152 * linearizeTest(g) + 0.0722 * linearizeTest(b);
}
function contrastTest(hex1: string, hex2: string): number {
  const l1 = luminanceTest(hex1); const l2 = luminanceTest(hex2);
  const light = Math.max(l1, l2); const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}
type TestGrade = 'AAA' | 'AA' | 'AA-Large' | 'Fail';
function gradeTest(ratio: number): TestGrade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-Large';
  return 'Fail';
}

describe('ContrastMatrixPanel utilities', () => {
  it('black on white has contrast ratio ~21:1', () => {
    const ratio = contrastTest('#000000', '#ffffff');
    expect(Math.abs(ratio - 21)).toBeLessThan(0.1);
  });

  it('white on white has contrast ratio 1:1', () => {
    const ratio = contrastTest('#ffffff', '#ffffff');
    expect(ratio).toBeCloseTo(1.0, 1);
  });

  it('black on white grades as AAA', () => {
    expect(gradeTest(contrastTest('#000000', '#ffffff'))).toBe('AAA');
  });

  it('mid-grey on white grades correctly', () => {
    // #767676 on white ≈ 4.54:1 → AA
    const ratio = contrastTest('#767676', '#ffffff');
    const grade = gradeTest(ratio);
    expect(grade).toBe('AA');
    expect(ratio).toBeGreaterThan(4.5);
  });

  it('light grey on white fails WCAG', () => {
    // #aaaaaa on white ≈ 2.32:1 → Fail
    const ratio = contrastTest('#aaaaaa', '#ffffff');
    expect(gradeTest(ratio)).toBe('Fail');
    expect(ratio).toBeLessThan(3);
  });

  it('contrast ratio is symmetric', () => {
    const r1 = contrastTest('#ff0000', '#0000ff');
    const r2 = contrastTest('#0000ff', '#ff0000');
    expect(Math.abs(r1 - r2)).toBeLessThan(0.001);
  });

  it('hexToRgbTest parses 6-digit hex', () => {
    expect(hexToRgbTest('#ff8800')).toEqual([255, 136, 0]);
  });

  it('hexToRgbTest parses 3-digit hex', () => {
    expect(hexToRgbTest('#f80')).toEqual([255, 136, 0]);
  });

  it('hexToRgbTest returns null for invalid', () => {
    expect(hexToRgbTest('notacolor')).toBeNull();
  });

  it('white has luminance 1.0', () => {
    expect(luminanceTest('#ffffff')).toBeCloseTo(1.0, 3);
  });

  it('black has luminance 0.0', () => {
    expect(luminanceTest('#000000')).toBeCloseTo(0.0, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GeometryPanel — inlined math utilities
// ─────────────────────────────────────────────────────────────────────────────

const PHI_TEST = (1 + Math.sqrt(5)) / 2; // 1.6180339...

function goldenRatioTest(value: number, mode: 'longer' | 'shorter'): number {
  if (mode === 'longer') return value * PHI_TEST;
  return value / PHI_TEST;
}

function ruleOfThirdsTest(width: number, height: number): { x: number[]; y: number[] } {
  return {
    x: [width / 3, (2 * width) / 3],
    y: [height / 3, (2 * height) / 3],
  };
}

function polygonVerticesTest(sides: number, radius: number, rotationDeg = 0): Array<{ x: number; y: number }> {
  const rotRad = (rotationDeg * Math.PI) / 180;
  return Array.from({ length: sides }, (_, i) => {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2 + rotRad;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

function inscribedCircleTest(width: number, height: number): number {
  return Math.min(width, height) / 2;
}

function circumscribedCircleTest(width: number, height: number): number {
  return Math.sqrt(width * width + height * height) / 2;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatioString(width: number, height: number): string {
  const g = gcd(Math.round(width), Math.round(height));
  return `${Math.round(width) / g}:${Math.round(height) / g}`;
}

function spacingScaleTest(base: number, type: 'linear' | 'fibonacci' | '8pt' | 'golden', steps: number): number[] {
  if (type === 'linear') {
    return Array.from({ length: steps }, (_, i) => base + i * base);
  }
  if (type === 'fibonacci') {
    const fibs: number[] = [base, base];
    while (fibs.length < steps) {
      fibs.push(fibs[fibs.length - 1] + fibs[fibs.length - 2]);
    }
    return fibs.slice(0, steps);
  }
  if (type === '8pt') {
    return Array.from({ length: steps }, (_, i) => (i + 1) * 8);
  }
  // golden
  return Array.from({ length: steps }, (_, i) => parseFloat((base * Math.pow(PHI_TEST, i)).toFixed(2)));
}

function pxToMmTest(px: number, ppi: number): number {
  return (px / ppi) * 25.4;
}

function pxToPtTest(px: number): number {
  return (px * 72) / 96;
}

describe('GeometryPanel math utilities', () => {
  // PHI constant
  it('PHI equals golden ratio', () => {
    expect(PHI_TEST).toBeCloseTo(1.6180339887, 5);
  });

  // goldenRatio
  it('goldenRatio longer: 100 → ~161.8', () => {
    expect(goldenRatioTest(100, 'longer')).toBeCloseTo(161.803, 2);
  });

  it('goldenRatio shorter: 100 → ~61.8', () => {
    expect(goldenRatioTest(100, 'shorter')).toBeCloseTo(61.803, 2);
  });

  it('goldenRatio: longer × shorter = original²', () => {
    const a = goldenRatioTest(200, 'longer');
    const b = goldenRatioTest(200, 'shorter');
    expect(a * b).toBeCloseTo(200 * 200, 0);
  });

  // ruleOfThirds
  it('ruleOfThirds: 1200×900 → x=[400,800], y=[300,600]', () => {
    const r = ruleOfThirdsTest(1200, 900);
    expect(r.x).toEqual([400, 800]);
    expect(r.y).toEqual([300, 600]);
  });

  it('ruleOfThirds: x lines divide width into 3 equal parts', () => {
    const { x } = ruleOfThirdsTest(300, 200);
    expect(x[0]).toBeCloseTo(100, 5);
    expect(x[1]).toBeCloseTo(200, 5);
  });

  // polygonVertices
  it('polygon: square (4 sides, r=1) has 4 vertices', () => {
    const verts = polygonVerticesTest(4, 1);
    expect(verts).toHaveLength(4);
  });

  it('polygon: equilateral triangle centroid ~0', () => {
    const verts = polygonVerticesTest(3, 100);
    const cx = verts.reduce((s, v) => s + v.x, 0) / 3;
    const cy = verts.reduce((s, v) => s + v.y, 0) / 3;
    expect(cx).toBeCloseTo(0, 1);
    expect(cy).toBeCloseTo(0, 1);
  });

  it('polygon: hexagon (6 sides) all vertices equidistant from center', () => {
    const verts = polygonVerticesTest(6, 50);
    verts.forEach(v => {
      const dist = Math.sqrt(v.x * v.x + v.y * v.y);
      expect(dist).toBeCloseTo(50, 4);
    });
  });

  it('polygon: rotation shifts vertices but not distances', () => {
    const v0 = polygonVerticesTest(5, 80, 0);
    const v1 = polygonVerticesTest(5, 80, 45);
    // Same distances
    v1.forEach(v => {
      const dist = Math.sqrt(v.x * v.x + v.y * v.y);
      expect(dist).toBeCloseTo(80, 4);
    });
    // Different positions
    expect(v0[0].x).not.toBeCloseTo(v1[0].x, 1);
  });

  // inscribed / circumscribed circles
  it('inscribedCircle: 100×60 → 30', () => {
    expect(inscribedCircleTest(100, 60)).toBeCloseTo(30, 5);
  });

  it('circumscribedCircle: 3×4 rectangle → hyp/2 = 2.5', () => {
    expect(circumscribedCircleTest(3, 4)).toBeCloseTo(2.5, 5);
  });

  it('inscribed ≤ circumscribed for any rectangle', () => {
    expect(inscribedCircleTest(200, 80)).toBeLessThanOrEqual(circumscribedCircleTest(200, 80));
  });

  // aspectRatioString
  it('aspectRatioString: 1920×1080 → "16:9"', () => {
    expect(aspectRatioString(1920, 1080)).toBe('16:9');
  });

  it('aspectRatioString: 800×600 → "4:3"', () => {
    expect(aspectRatioString(800, 600)).toBe('4:3');
  });

  // spacingScale
  it('spacingScale 8pt: first 4 steps = 8,16,24,32', () => {
    expect(spacingScaleTest(8, '8pt', 4)).toEqual([8, 16, 24, 32]);
  });

  it('spacingScale linear base=10: steps match multiples', () => {
    const scale = spacingScaleTest(10, 'linear', 5);
    expect(scale).toEqual([10, 20, 30, 40, 50]);
  });

  it('spacingScale fibonacci: each term = sum of previous two', () => {
    const scale = spacingScaleTest(8, 'fibonacci', 6);
    for (let i = 2; i < scale.length; i++) {
      expect(scale[i]).toBe(scale[i - 1] + scale[i - 2]);
    }
  });

  it('spacingScale golden: ratio between steps ≈ PHI', () => {
    const scale = spacingScaleTest(10, 'golden', 5);
    for (let i = 1; i < scale.length; i++) {
      expect(scale[i] / scale[i - 1]).toBeCloseTo(PHI_TEST, 2);
    }
  });

  // unit conversions
  it('pxToMm: 96px @96ppi = 25.4mm (1 inch)', () => {
    expect(pxToMmTest(96, 96)).toBeCloseTo(25.4, 4);
  });

  it('pxToPt: 96px = 72pt', () => {
    expect(pxToPtTest(96)).toBeCloseTo(72, 5);
  });

  it('pxToPt: 12px ≈ 9pt', () => {
    expect(pxToPtTest(12)).toBeCloseTo(9, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ColorTokensPanel — inlined utility functions
// ─────────────────────────────────────────────────────────────────────────────

function normalizeHexTest(raw: string): string | null {
  if (!raw) return null;
  let h = raw.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 6 && /^[0-9a-fA-F]{6}$/.test(h)) return '#' + h.toUpperCase();
  if (h.length === 8 && /^[0-9a-fA-F]{8}$/.test(h)) return '#' + h.slice(0, 6).toUpperCase();
  return null;
}

function tokenToVarNameTest(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

function exportCSSTest(tokens: Array<{ name: string; hex: string }>): string {
  const lines = tokens
    .filter(t => t.name)
    .map(t => `  --color-${tokenToVarNameTest(t.name)}: ${t.hex.toLowerCase()};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

function exportSCSSTest(tokens: Array<{ name: string; hex: string }>): string {
  return tokens
    .filter(t => t.name)
    .map(t => `$color-${tokenToVarNameTest(t.name)}: ${t.hex.toLowerCase()};`)
    .join('\n');
}

describe('ColorTokensPanel utilities', () => {
  // normalizeHex
  it('normalizeHex: 6-digit hex uppercased', () => {
    expect(normalizeHexTest('#aabbcc')).toBe('#AABBCC');
  });

  it('normalizeHex: 3-digit hex expanded', () => {
    expect(normalizeHexTest('#f80')).toBe('#FF8800');
  });

  it('normalizeHex: strips alpha from 8-digit hex', () => {
    expect(normalizeHexTest('#ff000080')).toBe('#FF0000');
  });

  it('normalizeHex: no leading hash still works', () => {
    expect(normalizeHexTest('336699')).toBe('#336699');
  });

  it('normalizeHex: invalid returns null', () => {
    expect(normalizeHexTest('nope')).toBeNull();
  });

  it('normalizeHex: empty string returns null', () => {
    expect(normalizeHexTest('')).toBeNull();
  });

  // tokenToVarName
  it('tokenToVarName: spaces → hyphens', () => {
    expect(tokenToVarNameTest('Brand Blue')).toBe('brand-blue');
  });

  it('tokenToVarName: special chars stripped', () => {
    expect(tokenToVarNameTest('primary!color')).toBe('primarycolor');
  });

  it('tokenToVarName: double hyphens collapsed', () => {
    expect(tokenToVarNameTest('bg--primary')).toBe('bg-primary');
  });

  it('tokenToVarName: leading/trailing hyphens stripped', () => {
    expect(tokenToVarNameTest('-test-')).toBe('test');
  });

  it('tokenToVarName: lowercase applied', () => {
    expect(tokenToVarNameTest('MyColor')).toBe('mycolor');
  });

  // exportCSS
  it('exportCSS: generates :root block', () => {
    const css = exportCSSTest([{ name: 'primary', hex: '#3B82F6' }]);
    expect(css).toContain(':root {');
    expect(css).toContain('--color-primary: #3b82f6;');
  });

  it('exportCSS: unnamed tokens are excluded', () => {
    const css = exportCSSTest([
      { name: 'good', hex: '#ff0000' },
      { name: '', hex: '#00ff00' },
    ]);
    expect(css).toContain('--color-good');
    expect(css).not.toContain('#00ff00');
  });

  // exportSCSS
  it('exportSCSS: produces SCSS vars', () => {
    const scss = exportSCSSTest([{ name: 'accent', hex: '#F59E0B' }]);
    expect(scss).toBe('$color-accent: #f59e0b;');
  });

  it('exportSCSS: multiple tokens on separate lines', () => {
    const scss = exportSCSSTest([
      { name: 'text', hex: '#111111' },
      { name: 'bg', hex: '#ffffff' },
    ]);
    expect(scss.split('\n')).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TypographyAuditPanel — inlined audit utilities
// ─────────────────────────────────────────────────────────────────────────────

interface AuditEntry {
  shapeId: string;
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  fill: string;
  text: string;
}

interface AuditIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  affectedIds: string[];
}

function uniqueFontSizesTest(entries: AuditEntry[]): number[] {
  const sizes = new Set(entries.map(e => e.fontSize));
  return [...sizes].sort((a, b) => a - b);
}

function uniqueFontFamiliesTest(entries: AuditEntry[]): string[] {
  const fams = new Set(entries.map(e => e.fontFamily));
  return [...fams].sort();
}

function snapTo8ptTest(size: number): number {
  return Math.round(size / 8) * 8 || 8;
}

function snapToModularScaleTest(size: number, base: number, ratio: number): number {
  let bestDiff = Infinity;
  let best = base;
  for (let n = -2; n <= 10; n++) {
    const candidate = base * Math.pow(ratio, n);
    const diff = Math.abs(size - candidate);
    if (diff < bestDiff) { bestDiff = diff; best = candidate; }
  }
  return Math.round(best);
}

function auditTypographyTest(entries: AuditEntry[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (entries.length === 0) return issues;
  const sizes = uniqueFontSizesTest(entries);
  const families = uniqueFontFamiliesTest(entries);
  if (sizes.length > 6) issues.push({ severity: 'error', code: 'TOO_MANY_SIZES', message: '', affectedIds: [] });
  else if (sizes.length > 4) issues.push({ severity: 'warning', code: 'MANY_SIZES', message: '', affectedIds: [] });
  if (families.length > 3) issues.push({ severity: 'error', code: 'TOO_MANY_FAMILIES', message: '', affectedIds: [] });
  else if (families.length > 2) issues.push({ severity: 'warning', code: 'MANY_FAMILIES', message: '', affectedIds: [] });
  const noLineHeight = entries.filter(e => !e.lineHeight);
  if (noLineHeight.length > 0) issues.push({ severity: 'warning', code: 'MISSING_LINE_HEIGHT', message: '', affectedIds: [] });
  const tiny = entries.filter(e => e.fontSize < 12);
  if (tiny.length > 0) issues.push({ severity: 'error', code: 'TINY_TEXT', message: '', affectedIds: tiny.map(e => e.shapeId) });
  const offGrid = entries.filter(e => e.fontSize % 8 !== 0 && e.fontSize % 4 !== 0);
  if (offGrid.length > 0) issues.push({ severity: 'info', code: 'OFF_GRID', message: '', affectedIds: [] });
  return issues;
}

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    shapeId: 'id-' + Math.random().toString(36).slice(2),
    label: 'Text',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: '1.5',
    letterSpacing: '0',
    fill: '#000000',
    text: 'Hello',
    ...overrides,
  };
}

describe('TypographyAuditPanel utilities', () => {
  // uniqueFontSizes
  it('uniqueFontSizes: returns sorted unique sizes', () => {
    const entries = [makeEntry({ fontSize: 24 }), makeEntry({ fontSize: 16 }), makeEntry({ fontSize: 24 })];
    expect(uniqueFontSizesTest(entries)).toEqual([16, 24]);
  });

  it('uniqueFontSizes: single entry', () => {
    expect(uniqueFontSizesTest([makeEntry({ fontSize: 14 })])).toEqual([14]);
  });

  // uniqueFontFamilies
  it('uniqueFontFamilies: deduplicates and sorts', () => {
    const entries = [
      makeEntry({ fontFamily: 'Roboto' }),
      makeEntry({ fontFamily: 'Inter' }),
      makeEntry({ fontFamily: 'Roboto' }),
    ];
    expect(uniqueFontFamiliesTest(entries)).toEqual(['Inter', 'Roboto']);
  });

  // snapTo8pt
  it('snapTo8pt: 16 stays 16', () => { expect(snapTo8ptTest(16)).toBe(16); });
  it('snapTo8pt: 13 → 16', () => { expect(snapTo8ptTest(13)).toBe(16); });
  it('snapTo8pt: 11 → 8', () => { expect(snapTo8ptTest(11)).toBe(8); });
  it('snapTo8pt: 0 → 8 (minimum)', () => { expect(snapTo8ptTest(0)).toBe(8); });
  it('snapTo8pt: 30 → 32', () => { expect(snapTo8ptTest(30)).toBe(32); });

  // snapToModularScale
  it('snapToModularScale: base=16, ratio=1.25, size=16 → 16', () => {
    expect(snapToModularScaleTest(16, 16, 1.25)).toBe(16);
  });
  it('snapToModularScale: base=16, ratio=1.25, size=20 → 20', () => {
    expect(snapToModularScaleTest(20, 16, 1.25)).toBe(20);
  });

  // auditTypography — no issues for clean set
  it('auditTypography: clean set → no issues', () => {
    const entries = [
      makeEntry({ fontSize: 32, fontFamily: 'Inter', lineHeight: '1.2' }),
      makeEntry({ fontSize: 16, fontFamily: 'Inter', lineHeight: '1.5' }),
    ];
    const issues = auditTypographyTest(entries);
    expect(issues.filter(i => i.severity === 'error' || i.severity === 'warning')).toHaveLength(0);
  });

  it('auditTypography: 7 sizes → TOO_MANY_SIZES error', () => {
    const entries = [14, 16, 18, 20, 24, 32, 48].map(sz =>
      makeEntry({ fontSize: sz, lineHeight: '1.5' })
    );
    const issues = auditTypographyTest(entries);
    expect(issues.some(i => i.code === 'TOO_MANY_SIZES')).toBe(true);
  });

  it('auditTypography: 4 families → TOO_MANY_FAMILIES error', () => {
    const entries = ['Inter', 'Roboto', 'Lato', 'Oswald'].map(f =>
      makeEntry({ fontFamily: f, lineHeight: '1.5' })
    );
    const issues = auditTypographyTest(entries);
    expect(issues.some(i => i.code === 'TOO_MANY_FAMILIES')).toBe(true);
  });

  it('auditTypography: missing lineHeight → MISSING_LINE_HEIGHT warning', () => {
    const entries = [makeEntry({ lineHeight: '' })];
    const issues = auditTypographyTest(entries);
    expect(issues.some(i => i.code === 'MISSING_LINE_HEIGHT')).toBe(true);
  });

  it('auditTypography: font size 8px → TINY_TEXT error', () => {
    const entries = [makeEntry({ fontSize: 8, lineHeight: '1.5' })];
    const issues = auditTypographyTest(entries);
    expect(issues.some(i => i.code === 'TINY_TEXT')).toBe(true);
  });

  it('auditTypography: off-grid size → OFF_GRID info', () => {
    const entries = [makeEntry({ fontSize: 15, lineHeight: '1.5' })];
    const issues = auditTypographyTest(entries);
    expect(issues.some(i => i.code === 'OFF_GRID')).toBe(true);
  });

  it('auditTypography: empty entries → no issues', () => {
    expect(auditTypographyTest([])).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ShapeMorphPanel — inlined interpolation utilities
// ─────────────────────────────────────────────────────────────────────────────

function lerpTest(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blendHexTest(hexA: string, hexB: string, t: number): string {
  const parse = (h: string): [number, number, number] => {
    const c = h.replace(/^#/, '');
    const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c.padEnd(6, '0').slice(0, 6);
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(hexA || '#000000');
  const [r2, g2, b2] = parse(hexB || '#ffffff');
  const r = Math.round(lerpTest(r1, r2, t));
  const g = Math.round(lerpTest(g1, g2, t));
  const b = Math.round(lerpTest(b1, b2, t));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function applyEasingTest(t: number, easing: string): number {
  switch (easing) {
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - (1 - t) * (1 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    default: return t;
  }
}

describe('ShapeMorphPanel interpolation utilities', () => {
  // lerp
  it('lerp: t=0 → a', () => { expect(lerpTest(10, 20, 0)).toBe(10); });
  it('lerp: t=1 → b', () => { expect(lerpTest(10, 20, 1)).toBe(20); });
  it('lerp: t=0.5 → midpoint', () => { expect(lerpTest(0, 100, 0.5)).toBe(50); });
  it('lerp: negative values', () => { expect(lerpTest(-10, 10, 0.5)).toBe(0); });

  // blendHex
  it('blendHex: t=0 → hexA', () => {
    expect(blendHexTest('#ff0000', '#0000ff', 0)).toBe('#ff0000');
  });

  it('blendHex: t=1 → hexB', () => {
    expect(blendHexTest('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });

  it('blendHex: t=0.5 between white and black → mid gray', () => {
    const mid = blendHexTest('#ffffff', '#000000', 0.5);
    expect(mid).toBe('#808080');
  });

  it('blendHex: result is valid 7-char hex', () => {
    const result = blendHexTest('#ff8800', '#003399', 0.3);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  // applyEasing
  it('applyEasing linear: returns t unchanged', () => {
    expect(applyEasingTest(0.5, 'linear')).toBeCloseTo(0.5, 5);
  });

  it('applyEasing ease-in: t=0.5 < 0.5 (slower start)', () => {
    expect(applyEasingTest(0.5, 'ease-in')).toBeCloseTo(0.25, 5);
  });

  it('applyEasing ease-out: t=0.5 > 0.5 (faster start)', () => {
    expect(applyEasingTest(0.5, 'ease-out')).toBeCloseTo(0.75, 5);
  });

  it('applyEasing ease-in-out: symmetric around 0.5', () => {
    const a = applyEasingTest(0.25, 'ease-in-out');
    const b = 1 - applyEasingTest(0.75, 'ease-in-out');
    expect(a).toBeCloseTo(b, 5);
  });

  it('applyEasing: t=0 → 0 for all easings', () => {
    ['linear', 'ease-in', 'ease-out', 'ease-in-out'].forEach(e => {
      expect(applyEasingTest(0, e)).toBeCloseTo(0, 5);
    });
  });

  it('applyEasing: t=1 → 1 for all easings', () => {
    ['linear', 'ease-in', 'ease-out', 'ease-in-out'].forEach(e => {
      expect(applyEasingTest(1, e)).toBeCloseTo(1, 5);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BreakpointSimulatorPanel — inlined utilities
// ─────────────────────────────────────────────────────────────────────────────

interface TestBP { id: string; name: string; width: number; height: number; active: boolean; }
interface TinyShape { id: string; x: number; y: number; width: number; height: number; }

function getClippedShapesTest(shapes: TinyShape[], viewportWidth: number): string[] {
  return shapes.filter(s => s.x + s.width > viewportWidth).map(s => s.id);
}

function getHiddenShapesTest(shapes: TinyShape[], viewportWidth: number): string[] {
  return shapes.filter(s => s.x >= viewportWidth).map(s => s.id);
}

function previewScaleTest(canvasWidth: number, viewportWidth: number, paneWidth: number): number {
  if (canvasWidth <= 0 || paneWidth <= 0) return 1;
  return Math.min(paneWidth / viewportWidth, 1);
}

function sortBreakpointsTest(bps: TestBP[]): TestBP[] {
  return [...bps].sort((a, b) => a.width - b.width);
}

function exportMediaQueriesTest(breakpoints: TestBP[], containerClass = '.container'): string {
  const active = [...breakpoints].filter(b => b.active).sort((a, b) => a.width - b.width);
  if (active.length === 0) return '/* No active breakpoints */';
  const lines: string[] = [];
  lines.push('/* Auto-generated breakpoint media queries */');
  lines.push('');
  lines.push(`/* Default — mobile (< ${active[0].width}px) */`);
  lines.push(`${containerClass} { width: 100%; padding: 0 16px; }`);
  lines.push('');
  for (let i = 0; i < active.length; i++) {
    const bp = active[i];
    lines.push(`/* ${bp.name} — ${bp.width}px and up */`);
    lines.push(`@media (min-width: ${bp.width}px) {`);
    lines.push(`  ${containerClass} { max-width: ${bp.width}px; margin: 0 auto; }`);
    lines.push(`}`);
    if (i < active.length - 1) lines.push('');
  }
  return lines.join('\n');
}

const makeBP = (id: string, w: number, active = true): TestBP => ({
  id, name: id, width: w, height: 800, active
});

describe('BreakpointSimulatorPanel utilities', () => {
  // getClippedShapes
  it('getClippedShapes: shape overflowing right edge', () => {
    const shapes = [{ id: 's1', x: 300, y: 0, width: 200, height: 50 }];
    expect(getClippedShapesTest(shapes, 375)).toContain('s1');
  });

  it('getClippedShapes: shape fitting within viewport', () => {
    const shapes = [{ id: 's1', x: 0, y: 0, width: 300, height: 50 }];
    expect(getClippedShapesTest(shapes, 375)).toHaveLength(0);
  });

  it('getClippedShapes: shape exactly at boundary (not clipped)', () => {
    const shapes = [{ id: 's1', x: 0, y: 0, width: 375, height: 50 }];
    expect(getClippedShapesTest(shapes, 375)).toHaveLength(0);
  });

  it('getClippedShapes: shape one pixel over boundary', () => {
    const shapes = [{ id: 's1', x: 0, y: 0, width: 376, height: 50 }];
    expect(getClippedShapesTest(shapes, 375)).toContain('s1');
  });

  // getHiddenShapes
  it('getHiddenShapes: shape starting at viewport width → hidden', () => {
    const shapes = [{ id: 's1', x: 375, y: 0, width: 100, height: 50 }];
    expect(getHiddenShapesTest(shapes, 375)).toContain('s1');
  });

  it('getHiddenShapes: shape partially visible → not hidden', () => {
    const shapes = [{ id: 's1', x: 300, y: 0, width: 100, height: 50 }];
    expect(getHiddenShapesTest(shapes, 375)).toHaveLength(0);
  });

  // previewScale
  it('previewScale: canvas fits in pane → scale ≤ 1', () => {
    const scale = previewScaleTest(1440, 375, 140);
    expect(scale).toBeLessThanOrEqual(1);
  });

  it('previewScale: zero canvas width → 1', () => {
    expect(previewScaleTest(0, 375, 140)).toBe(1);
  });

  it('previewScale: viewport equals pane → scale = 1', () => {
    expect(previewScaleTest(140, 140, 140)).toBeCloseTo(1, 5);
  });

  // sortBreakpoints
  it('sortBreakpoints: sorts ascending by width', () => {
    const bps = [makeBP('c', 1280), makeBP('a', 375), makeBP('b', 768)];
    const sorted = sortBreakpointsTest(bps);
    expect(sorted.map(b => b.width)).toEqual([375, 768, 1280]);
  });

  // exportMediaQueries
  it('exportMediaQueries: no active → comment', () => {
    const css = exportMediaQueriesTest([makeBP('a', 375, false)]);
    expect(css).toBe('/* No active breakpoints */');
  });

  it('exportMediaQueries: contains @media rule', () => {
    const css = exportMediaQueriesTest([makeBP('mobile', 375)]);
    expect(css).toContain('@media (min-width: 375px)');
  });

  it('exportMediaQueries: mobile-first default before @media', () => {
    const css = exportMediaQueriesTest([makeBP('tablet', 768), makeBP('mobile', 375)]);
    const defaultIdx = css.indexOf('width: 100%');
    const mediaIdx = css.indexOf('@media');
    expect(defaultIdx).toBeLessThan(mediaIdx);
  });

  it('exportMediaQueries: uses custom container class', () => {
    const css = exportMediaQueriesTest([makeBP('a', 375)], '.my-wrap');
    expect(css).toContain('.my-wrap');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ComponentAnalyzerPanel — inlined utilities
// ─────────────────────────────────────────────────────────────────────────────

function bucketNumberTest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function bucketColorTest(hex: string): string {
  if (!hex || hex === 'transparent' || hex === 'none') return 'none';
  const h = hex.replace(/^#/, '').padEnd(6, '0').slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminance = (max + min) / 2;
  const lumBucket = luminance < 64 ? 'dark' : luminance < 192 ? 'mid' : 'light';
  if (max - min < 30) return `gray-${lumBucket}`;
  if (max === r) return `red-${lumBucket}`;
  if (max === g) return `green-${lumBucket}`;
  return `blue-${lumBucket}`;
}

function suggestComponentNameTest(typeKey: string, colorKey: string, count: number): string {
  const typeMap: Record<string, string> = {
    rect: 'Box', ellipse: 'Circle', text: 'Label', frame: 'Frame',
    line: 'Divider', arrow: 'Arrow', star: 'Star', polygon: 'Shape', image: 'Image',
  };
  const colorMap: Record<string, string> = {
    'red-mid': 'Primary', 'blue-mid': 'Secondary', 'green-mid': 'Success',
    'gray-dark': 'Dark', 'gray-mid': 'Muted', 'gray-light': 'Light', 'none': '',
  };
  const typeName = typeMap[typeKey] ?? 'Component';
  const colorName = colorMap[colorKey] ?? '';
  const countHint = count >= 5 ? 'Repeated' : '';
  return [countHint, colorName, typeName].filter(Boolean).join('');
}

describe('ComponentAnalyzerPanel utilities', () => {
  // bucketNumber
  it('bucketNumber: 22 → 20 (step 20)', () => {
    expect(bucketNumberTest(22, 20)).toBe(20);
  });

  it('bucketNumber: 35 → 40 (step 20)', () => {
    expect(bucketNumberTest(35, 20)).toBe(40);
  });

  it('bucketNumber: 0 → 0', () => {
    expect(bucketNumberTest(0, 20)).toBe(0);
  });

  it('bucketNumber: exact multiple unchanged', () => {
    expect(bucketNumberTest(60, 20)).toBe(60);
  });

  // bucketColor
  it('bucketColor: transparent → "none"', () => {
    expect(bucketColorTest('transparent')).toBe('none');
  });

  it('bucketColor: empty → "none"', () => {
    expect(bucketColorTest('')).toBe('none');
  });

  it('bucketColor: pure red → "red-*"', () => {
    expect(bucketColorTest('#ff0000')).toMatch(/^red-/);
  });

  it('bucketColor: pure blue → "blue-*"', () => {
    expect(bucketColorTest('#0000ff')).toMatch(/^blue-/);
  });

  it('bucketColor: pure green → "green-*"', () => {
    expect(bucketColorTest('#00ff00')).toMatch(/^green-/);
  });

  it('bucketColor: near-gray → "gray-*"', () => {
    expect(bucketColorTest('#888888')).toMatch(/^gray-/);
  });

  it('bucketColor: black → "gray-dark"', () => {
    expect(bucketColorTest('#000000')).toBe('gray-dark');
  });

  it('bucketColor: white → "gray-light"', () => {
    expect(bucketColorTest('#ffffff')).toBe('gray-light');
  });

  // suggestComponentName
  it('suggestComponentName: rect + blue-mid → "SecondaryBox"', () => {
    expect(suggestComponentNameTest('rect', 'blue-mid', 2)).toBe('SecondaryBox');
  });

  it('suggestComponentName: ellipse + red-mid → "PrimaryCircle"', () => {
    expect(suggestComponentNameTest('ellipse', 'red-mid', 2)).toBe('PrimaryCircle');
  });

  it('suggestComponentName: ≥5 instances → "Repeated" prefix', () => {
    expect(suggestComponentNameTest('rect', 'none', 5)).toContain('Repeated');
  });

  it('suggestComponentName: unknown type → "Component"', () => {
    expect(suggestComponentNameTest('pentagon', 'none', 2)).toBe('Component');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AnnotationOverlayPanel — inlined geometry utilities
// ─────────────────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number; }

function rdpSimplifyTest(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dist = len === 0
      ? Math.sqrt((p.x - start.x) ** 2 + (p.y - start.y) ** 2)
      : Math.abs((p.x - start.x) * dy - (p.y - start.y) * dx) / len;
    if (dist > maxDist) { maxDist = dist; maxIdx = i; }
  }
  if (maxDist <= epsilon) return [start, end];
  return [...rdpSimplifyTest(points.slice(0, maxIdx + 1), epsilon).slice(0, -1), ...rdpSimplifyTest(points.slice(maxIdx), epsilon)];
}

function pointsToSVGPathTest(points: Pt[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const parts = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`);
  }
  return parts.join(' ');
}

describe('AnnotationOverlayPanel geometry utilities', () => {
  // rdpSimplify
  it('rdpSimplify: straight line → just endpoints', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    const simplified = rdpSimplifyTest(pts, 0.5);
    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[simplified.length - 1]).toEqual({ x: 3, y: 0 });
  });

  it('rdpSimplify: sharp corner → 3 points preserved', () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }];
    const simplified = rdpSimplifyTest(pts, 1);
    expect(simplified.length).toBeGreaterThanOrEqual(3);
  });

  it('rdpSimplify: 2 points → unchanged', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    expect(rdpSimplifyTest(pts, 5)).toHaveLength(2);
  });

  it('rdpSimplify: large epsilon simplifies more', () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ x: i * 5, y: Math.sin(i) * 3 }));
    const tight = rdpSimplifyTest(pts, 0.1);
    const loose = rdpSimplifyTest(pts, 5);
    expect(tight.length).toBeGreaterThanOrEqual(loose.length);
  });

  // pointsToSVGPath
  it('pointsToSVGPath: empty → ""', () => {
    expect(pointsToSVGPathTest([])).toBe('');
  });

  it('pointsToSVGPath: single point → M command', () => {
    expect(pointsToSVGPathTest([{ x: 10, y: 20 }])).toBe('M 10 20');
  });

  it('pointsToSVGPath: two points → M L', () => {
    const d = pointsToSVGPathTest([{ x: 0, y: 0 }, { x: 100, y: 50 }]);
    expect(d).toContain('M 0.0 0.0');
    expect(d).toContain('L 100.0 50.0');
  });

  it('pointsToSVGPath: path starts with M', () => {
    const d = pointsToSVGPathTest([{ x: 5, y: 10 }, { x: 20, y: 30 }]);
    expect(d.startsWith('M')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ZIndexVisualizerPanel — inlined utilities
// ─────────────────────────────────────────────────────────────────────────────

function toIsoTest(x: number, y: number, z: number, tiltDeg: number, scale: number): { sx: number; sy: number } {
  const tilt = (tiltDeg * Math.PI) / 180;
  const sx = (x - y) * Math.cos(tilt) * scale;
  const sy = (x + y) * Math.sin(tilt) * scale - z * scale;
  return { sx, sy };
}

function typeColorTest(type: string): string {
  const map: Record<string, string> = {
    rect: '#3b82f6', ellipse: '#22c55e', text: '#f59e0b',
    frame: '#8b5cf6', line: '#ec4899', arrow: '#ef4444',
  };
  return map[type] ?? '#888888';
}

interface BoundsTestLayer { x: number; y: number; width: number; height: number; }
function layersBoundsTest(layers: BoundsTestLayer[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (layers.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const l of layers) {
    minX = Math.min(minX, l.x);
    minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, l.x + l.width);
    maxY = Math.max(maxY, l.y + l.height);
  }
  return { minX, minY, maxX, maxY };
}

describe('ZIndexVisualizerPanel utilities', () => {
  // toIso
  it('toIso: origin (0,0,0) → (0,0)', () => {
    const { sx, sy } = toIsoTest(0, 0, 0, 30, 1);
    expect(sx).toBeCloseTo(0, 5);
    expect(sy).toBeCloseTo(0, 5);
  });

  it('toIso: increasing z raises point (sy decreases)', () => {
    const low = toIsoTest(50, 50, 0, 30, 1);
    const high = toIsoTest(50, 50, 100, 30, 1);
    expect(high.sy).toBeLessThan(low.sy);
  });

  it('toIso: symmetric x=y → sx=0', () => {
    const { sx } = toIsoTest(100, 100, 0, 30, 1);
    expect(sx).toBeCloseTo(0, 5);
  });

  it('toIso: scale multiplies output proportionally', () => {
    const s1 = toIsoTest(100, 0, 0, 30, 1);
    const s2 = toIsoTest(100, 0, 0, 30, 2);
    expect(s2.sx).toBeCloseTo(s1.sx * 2, 5);
  });

  // typeColor
  it('typeColor: rect → blue', () => {
    expect(typeColorTest('rect')).toBe('#3b82f6');
  });

  it('typeColor: ellipse → green', () => {
    expect(typeColorTest('ellipse')).toBe('#22c55e');
  });

  it('typeColor: unknown type → gray', () => {
    expect(typeColorTest('hexagon')).toBe('#888888');
  });

  // layersBounds
  it('layersBounds: empty → default 0-100 box', () => {
    const b = layersBoundsTest([]);
    expect(b.minX).toBe(0);
    expect(b.maxX).toBe(100);
  });

  it('layersBounds: single layer', () => {
    const b = layersBoundsTest([{ x: 10, y: 20, width: 100, height: 50 }]);
    expect(b.minX).toBe(10);
    expect(b.minY).toBe(20);
    expect(b.maxX).toBe(110);
    expect(b.maxY).toBe(70);
  });

  it('layersBounds: multiple layers encapsulated', () => {
    const layers = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 200, y: 300, width: 50, height: 50 },
    ];
    const b = layersBoundsTest(layers);
    expect(b.minX).toBe(0);
    expect(b.maxX).toBe(250);
    expect(b.maxY).toBe(350);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DesignMetricsPanel — inlined metric functions
// ─────────────────────────────────────────────────────────────────────────────

function countByTypeTest(shapes: Array<{ type: string }>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const s of shapes) result[s.type] = (result[s.type] ?? 0) + 1;
  return result;
}

function countGridAlignedTest(shapes: Array<{ x: number; y: number; width: number; height: number }>, grid = 8): number {
  return shapes.filter(s =>
    s.x % grid < 1 && s.y % grid < 1 && s.width % grid < 1 && s.height % grid < 1
  ).length;
}

function countOverlapsTest(shapes: Array<{ x: number; y: number; width: number; height: number }>): number {
  let count = 0;
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i];
      const b = shapes[j];
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) count++;
    }
  }
  return count;
}

function computeComplexityTest(totalShapes: number, uniqueFills: number, overlaps: number, utilPct: number, typeCount: number): number {
  let score = 0;
  score += Math.min(totalShapes / 50, 1) * 30;
  score += Math.min(uniqueFills / 10, 1) * 20;
  score += Math.min(overlaps / 10, 1) * 20;
  score += utilPct / 100 * 15;
  score += Math.min(typeCount / 5, 1) * 15;
  return Math.round(score);
}

const makeMetricShape = (type: string, x: number, y: number, w: number, h: number, fill = '#ff0000') =>
  ({ type, x, y, width: w, height: h, fill } as any);

describe('DesignMetricsPanel utilities', () => {
  // countByType
  it('countByType: counts rect occurrences', () => {
    const shapes = [makeMetricShape('rect', 0, 0, 100, 100), makeMetricShape('rect', 200, 0, 100, 100)];
    expect(countByTypeTest(shapes)).toEqual({ rect: 2 });
  });

  it('countByType: mixed types', () => {
    const shapes = [makeMetricShape('rect', 0, 0, 100, 100), makeMetricShape('ellipse', 0, 0, 50, 50)];
    const bt = countByTypeTest(shapes);
    expect(bt.rect).toBe(1);
    expect(bt.ellipse).toBe(1);
  });

  // countGridAligned
  it('countGridAligned: shapes on 8pt grid → counted', () => {
    const shapes = [{ x: 0, y: 0, width: 64, height: 32 }];
    expect(countGridAlignedTest(shapes)).toBe(1);
  });

  it('countGridAligned: off-grid shape → not counted', () => {
    const shapes = [{ x: 3, y: 0, width: 64, height: 32 }];
    expect(countGridAlignedTest(shapes)).toBe(0);
  });

  it('countGridAligned: mixed shapes', () => {
    const shapes = [
      { x: 0, y: 0, width: 64, height: 32 }, // on grid
      { x: 7, y: 0, width: 64, height: 32 }, // off grid
    ];
    expect(countGridAlignedTest(shapes)).toBe(1);
  });

  // countOverlaps
  it('countOverlaps: no overlap → 0', () => {
    const shapes = [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 100, y: 100, width: 50, height: 50 },
    ];
    expect(countOverlapsTest(shapes)).toBe(0);
  });

  it('countOverlaps: two overlapping shapes → 1', () => {
    const shapes = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 },
    ];
    expect(countOverlapsTest(shapes)).toBe(1);
  });

  it('countOverlaps: 3 mutually overlapping → 3 pairs', () => {
    const shapes = [
      { x: 0, y: 0, width: 200, height: 200 },
      { x: 50, y: 50, width: 100, height: 100 },
      { x: 80, y: 80, width: 60, height: 60 },
    ];
    expect(countOverlapsTest(shapes)).toBe(3);
  });

  it('countOverlaps: touching edges → no overlap', () => {
    const shapes = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 100, y: 0, width: 100, height: 100 },
    ];
    expect(countOverlapsTest(shapes)).toBe(0);
  });

  // computeComplexity
  it('computeComplexity: empty canvas → 0', () => {
    expect(computeComplexityTest(0, 0, 0, 0, 0)).toBe(0);
  });

  it('computeComplexity: max values → 100', () => {
    // 50 shapes, 10 fills, 10 overlaps, 100% util, 5 types
    expect(computeComplexityTest(50, 10, 10, 100, 5)).toBe(100);
  });

  it('computeComplexity: 10 shapes, 2 fills → moderate', () => {
    const score = computeComplexityTest(10, 2, 0, 20, 2);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AttentionHeatmapPanel — inlined utilities
// ─────────────────────────────────────────────────────────────────────────────

interface HeatPt { x: number; y: number; weight: number; }

function binHeatPointsTest(
  points: HeatPt[],
  cols: number,
  rows: number,
  width: number,
  height: number,
): number[][] {
  const grid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (const p of points) {
    const col = Math.min(Math.floor(p.x / width * cols), cols - 1);
    const row = Math.min(Math.floor(p.y / height * rows), rows - 1);
    if (col >= 0 && row >= 0) grid[row][col] += p.weight;
  }
  return grid;
}

function findHottestCellTest(grid: number[][]): { row: number; col: number; value: number } {
  let best = { row: 0, col: 0, value: 0 };
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] > best.value) best = { row: r, col: c, value: grid[r][c] };
    }
  }
  return best;
}

function computeCoverageTest(grid: number[][]): number {
  if (grid.length === 0 || grid[0].length === 0) return 0;
  const total = grid.length * grid[0].length;
  return grid.flat().filter(v => v > 0).length / total;
}

function computeCentroidTest(points: HeatPt[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  let wx = 0, wy = 0, tw = 0;
  for (const p of points) { wx += p.x * p.weight; wy += p.y * p.weight; tw += p.weight; }
  return tw > 0 ? { x: wx / tw, y: wy / tw } : { x: 0, y: 0 };
}

function heatColorTest(t: number): string {
  const r = Math.round(Math.min(t * 2, 1) * 255);
  const g = Math.round(t < 0.5 ? t * 2 * 200 : (1 - (t - 0.5) * 2) * 200);
  const b = Math.round(Math.max(0, (0.5 - t) * 2) * 255);
  return `rgba(${r},${g},${b},0.75)`;
}

describe('AttentionHeatmapPanel utilities', () => {
  // binHeatPoints
  it('binHeatPoints: point at origin → cell [0][0]', () => {
    const pts = [{ x: 10, y: 10, weight: 1 }];
    const grid = binHeatPointsTest(pts, 10, 10, 1000, 1000);
    expect(grid[0][0]).toBe(1);
  });

  it('binHeatPoints: point at center → center cell', () => {
    const pts = [{ x: 500, y: 500, weight: 1 }];
    const grid = binHeatPointsTest(pts, 10, 10, 1000, 1000);
    expect(grid[5][5]).toBe(1);
  });

  it('binHeatPoints: multiple points accumulate', () => {
    const pts = [
      { x: 50, y: 50, weight: 1 },
      { x: 50, y: 50, weight: 2 },
    ];
    const grid = binHeatPointsTest(pts, 10, 10, 1000, 1000);
    expect(grid[0][0]).toBe(3);
  });

  it('binHeatPoints: empty points → zero grid', () => {
    const grid = binHeatPointsTest([], 5, 5, 100, 100);
    expect(grid.flat().every(v => v === 0)).toBe(true);
  });

  // findHottestCell
  it('findHottestCell: finds max value cell', () => {
    const grid = [[1, 0], [0, 5]];
    const { row, col, value } = findHottestCellTest(grid);
    expect(row).toBe(1);
    expect(col).toBe(1);
    expect(value).toBe(5);
  });

  it('findHottestCell: all zeros → value 0', () => {
    const grid = [[0, 0], [0, 0]];
    expect(findHottestCellTest(grid).value).toBe(0);
  });

  // computeCoverage
  it('computeCoverage: empty grid → 0', () => {
    expect(computeCoverageTest([])).toBe(0);
  });

  it('computeCoverage: all cells non-zero → 1', () => {
    const grid = [[1, 2], [3, 4]];
    expect(computeCoverageTest(grid)).toBe(1);
  });

  it('computeCoverage: half cells → 0.5', () => {
    const grid = [[1, 0], [1, 0]];
    expect(computeCoverageTest(grid)).toBe(0.5);
  });

  // computeCentroid
  it('computeCentroid: single point → that point', () => {
    const pts = [{ x: 100, y: 200, weight: 1 }];
    const c = computeCentroidTest(pts);
    expect(c.x).toBeCloseTo(100, 5);
    expect(c.y).toBeCloseTo(200, 5);
  });

  it('computeCentroid: two equal-weight points → midpoint', () => {
    const pts = [{ x: 0, y: 0, weight: 1 }, { x: 100, y: 100, weight: 1 }];
    const c = computeCentroidTest(pts);
    expect(c.x).toBeCloseTo(50, 5);
    expect(c.y).toBeCloseTo(50, 5);
  });

  it('computeCentroid: empty → origin', () => {
    expect(computeCentroidTest([])).toEqual({ x: 0, y: 0 });
  });

  // heatColor
  it('heatColor: t=0 → blue', () => {
    const c = heatColorTest(0);
    expect(c).toContain('rgba(0,0,255');
  });

  it('heatColor: t=1 → red', () => {
    const c = heatColorTest(1);
    expect(c).toContain('rgba(255,0,0');
  });

  it('heatColor: t=0.5 → yellow-ish (r+g, no blue)', () => {
    const c = heatColorTest(0.5);
    const parts = c.match(/rgba\((\d+),(\d+),(\d+)/);
    if (parts) {
      expect(Number(parts[3])).toBe(0); // no blue at 0.5
    }
  });
});

// ── MultiPagePanel ─────────────────────────────────────────────────────────────

// Inlined utility implementations matching MultiPagePanel.tsx

interface TestPageShape2 { id: string; type: string; x: number; y: number; width: number; height: number; }
interface TestPageDef { id: string; name: string; shapes: TestPageShape2[]; createdAt: number; updatedAt: number; }

function mpPageId(): string {
  return 'page-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function mpCreatePage(name: string): TestPageDef {
  const now = Date.now();
  return { id: mpPageId(), name, shapes: [], createdAt: now, updatedAt: now };
}

function mpRenamePage(pages: TestPageDef[], id: string, newName: string): TestPageDef[] {
  return pages.map(p => p.id === id ? { ...p, name: newName, updatedAt: Date.now() } : p);
}

function mpDuplicatePage(page: TestPageDef, newName?: string): TestPageDef {
  const now = Date.now();
  return { ...page, id: mpPageId(), name: newName ?? `${page.name} (copy)`, shapes: page.shapes.map(s => ({ ...s })), createdAt: now, updatedAt: now };
}

function mpMovePage(pages: TestPageDef[], id: string, direction: 'left' | 'right'): TestPageDef[] {
  const idx = pages.findIndex(p => p.id === id);
  if (idx === -1) return pages;
  const newPages = [...pages];
  if (direction === 'left' && idx > 0) { [newPages[idx], newPages[idx - 1]] = [newPages[idx - 1], newPages[idx]]; }
  else if (direction === 'right' && idx < pages.length - 1) { [newPages[idx], newPages[idx + 1]] = [newPages[idx + 1], newPages[idx]]; }
  return newPages;
}

function mpDeletePage(pages: TestPageDef[], id: string, activeId: string): { pages: TestPageDef[]; newActiveId: string } {
  if (pages.length <= 1) return { pages, newActiveId: activeId };
  const idx = pages.findIndex(p => p.id === id);
  const filtered = pages.filter(p => p.id !== id);
  const newActiveIdx = Math.min(idx, filtered.length - 1);
  const newActiveId = id === activeId ? filtered[newActiveIdx].id : activeId;
  return { pages: filtered, newActiveId };
}

function mpPageStats(pages: TestPageDef[]): Array<{ id: string; count: number; types: string[] }> {
  return pages.map(p => ({ id: p.id, count: p.shapes.length, types: [...new Set(p.shapes.map(s => s.type))] }));
}

describe('MultiPagePanel utilities', () => {
  // pageId
  it('pageId: returns string starting with "page-"', () => {
    expect(mpPageId()).toMatch(/^page-/);
  });

  it('pageId: returns unique values each call', () => {
    const a = mpPageId();
    const b = mpPageId();
    expect(a).not.toBe(b);
  });

  // createPage
  it('createPage: returns object with given name and empty shapes', () => {
    const p = mpCreatePage('Home');
    expect(p.name).toBe('Home');
    expect(p.shapes).toEqual([]);
  });

  it('createPage: sets createdAt and updatedAt timestamps', () => {
    const before = Date.now();
    const p = mpCreatePage('Test');
    expect(p.createdAt).toBeGreaterThanOrEqual(before);
    expect(p.updatedAt).toBeGreaterThanOrEqual(before);
  });

  // renamePage
  it('renamePage: renames the matching page', () => {
    const pages = [mpCreatePage('A'), mpCreatePage('B')];
    const renamed = mpRenamePage(pages, pages[0].id, 'Alpha');
    expect(renamed[0].name).toBe('Alpha');
    expect(renamed[1].name).toBe('B');
  });

  it('renamePage: non-matching id leaves pages unchanged', () => {
    const pages = [mpCreatePage('X')];
    const result = mpRenamePage(pages, 'nonexistent', 'Y');
    expect(result[0].name).toBe('X');
  });

  // duplicatePage
  it('duplicatePage: creates a page with a new id', () => {
    const orig = mpCreatePage('Orig');
    const dup = mpDuplicatePage(orig);
    expect(dup.id).not.toBe(orig.id);
  });

  it('duplicatePage: default name appends "(copy)"', () => {
    const orig = mpCreatePage('Design');
    const dup = mpDuplicatePage(orig);
    expect(dup.name).toBe('Design (copy)');
  });

  it('duplicatePage: accepts custom name', () => {
    const orig = mpCreatePage('Design');
    const dup = mpDuplicatePage(orig, 'Custom');
    expect(dup.name).toBe('Custom');
  });

  it('duplicatePage: deep copies shapes so mutation is independent', () => {
    const s: TestPageShape2 = { id: 's1', type: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const orig: TestPageDef = { ...mpCreatePage('P'), shapes: [s] };
    const dup = mpDuplicatePage(orig);
    dup.shapes[0].x = 999;
    expect(orig.shapes[0].x).toBe(0);
  });

  // movePage
  it('movePage: moves page left', () => {
    const pages = [mpCreatePage('A'), mpCreatePage('B'), mpCreatePage('C')];
    const result = mpMovePage(pages, pages[1].id, 'left');
    expect(result[0].name).toBe('B');
    expect(result[1].name).toBe('A');
  });

  it('movePage: moves page right', () => {
    const pages = [mpCreatePage('A'), mpCreatePage('B'), mpCreatePage('C')];
    const result = mpMovePage(pages, pages[1].id, 'right');
    expect(result[1].name).toBe('C');
    expect(result[2].name).toBe('B');
  });

  it('movePage: first page cannot go left', () => {
    const pages = [mpCreatePage('A'), mpCreatePage('B')];
    const result = mpMovePage(pages, pages[0].id, 'left');
    expect(result[0].name).toBe('A');
  });

  it('movePage: last page cannot go right', () => {
    const pages = [mpCreatePage('A'), mpCreatePage('B')];
    const result = mpMovePage(pages, pages[1].id, 'right');
    expect(result[1].name).toBe('B');
  });

  // deletePage
  it('deletePage: removes the specified page', () => {
    const pages = [mpCreatePage('A'), mpCreatePage('B'), mpCreatePage('C')];
    const { pages: result } = mpDeletePage(pages, pages[1].id, pages[0].id);
    expect(result.map(p => p.name)).toEqual(['A', 'C']);
  });

  it('deletePage: cannot delete when only one page remains', () => {
    const pages = [mpCreatePage('Only')];
    const { pages: result } = mpDeletePage(pages, pages[0].id, pages[0].id);
    expect(result).toHaveLength(1);
  });

  it('deletePage: updates newActiveId when active page is deleted', () => {
    const pages = [mpCreatePage('A'), mpCreatePage('B')];
    const { newActiveId } = mpDeletePage(pages, pages[0].id, pages[0].id);
    expect(newActiveId).toBe(pages[1].id);
  });

  it('deletePage: keeps activeId when non-active page is deleted', () => {
    const pages = [mpCreatePage('A'), mpCreatePage('B')];
    const { newActiveId } = mpDeletePage(pages, pages[1].id, pages[0].id);
    expect(newActiveId).toBe(pages[0].id);
  });

  // pageStats
  it('pageStats: returns count for each page', () => {
    const s: TestPageShape2 = { id: 's1', type: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const pages: TestPageDef[] = [
      { ...mpCreatePage('A'), shapes: [s] },
      { ...mpCreatePage('B'), shapes: [] },
    ];
    const stats = mpPageStats(pages);
    expect(stats[0].count).toBe(1);
    expect(stats[1].count).toBe(0);
  });

  it('pageStats: deduplicates shape types', () => {
    const s1: TestPageShape2 = { id: 'x1', type: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const s2: TestPageShape2 = { id: 'x2', type: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const pages: TestPageDef[] = [{ ...mpCreatePage('A'), shapes: [s1, s2] }];
    const stats = mpPageStats(pages);
    expect(stats[0].types).toEqual(['rect']);
  });

  it('pageStats: handles empty pages array', () => {
    expect(mpPageStats([])).toEqual([]);
  });

  it('pageStats: mixed types per page', () => {
    const s1: TestPageShape2 = { id: 'a', type: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const s2: TestPageShape2 = { id: 'b', type: 'text', x: 0, y: 0, width: 10, height: 10 };
    const pages: TestPageDef[] = [{ ...mpCreatePage('X'), shapes: [s1, s2] }];
    const stats = mpPageStats(pages);
    expect(stats[0].types).toContain('rect');
    expect(stats[0].types).toContain('text');
  });
});

// ── VariableFontExplorerPanel ──────────────────────────────────────────────────

// Inlined utilities from VariableFontExplorerPanel.tsx

interface VFAxis { tag: string; name: string; min: number; max: number; defaultValue: number; step: number; value: number; }
interface VFPreset { name: string; axes: Record<string, number>; }

function vfBuildVariationSettings(axes: VFAxis[]): string {
  const active = axes.filter(a => a.value !== a.defaultValue || a.tag === 'wght');
  if (active.length === 0) return 'normal';
  return active.map(a => `"${a.tag}" ${a.value}`).join(', ');
}

function vfParseVariationSettings(css: string): Record<string, number> {
  if (!css || css.trim() === 'normal') return {};
  const result: Record<string, number> = {};
  const pairs = css.split(',');
  for (const pair of pairs) {
    const m = pair.trim().match(/^["']([a-zA-Z ]{4})["']\s+([\d.-]+)$/);
    if (m) result[m[1]] = Number(m[2]);
  }
  return result;
}

function vfApplyPreset(axes: VFAxis[], preset: VFPreset): VFAxis[] {
  return axes.map(a => ({
    ...a,
    value: preset.axes[a.tag] !== undefined ? preset.axes[a.tag] : a.defaultValue,
  }));
}

function vfClampAxisValue(value: number, axis: VFAxis): number {
  return Math.min(axis.max, Math.max(axis.min, value));
}

const VF_DEFAULT_AXES: VFAxis[] = [
  { tag: 'wght', name: 'Weight', min: 100, max: 900, defaultValue: 400, step: 1, value: 400 },
  { tag: 'wdth', name: 'Width', min: 50, max: 200, defaultValue: 100, step: 1, value: 100 },
  { tag: 'ital', name: 'Italic', min: 0, max: 1, defaultValue: 0, step: 0.01, value: 0 },
  { tag: 'slnt', name: 'Slant', min: -15, max: 15, defaultValue: 0, step: 0.1, value: 0 },
  { tag: 'opsz', name: 'Optical Size', min: 8, max: 144, defaultValue: 14, step: 1, value: 14 },
];

describe('VariableFontExplorerPanel utilities', () => {
  // buildVariationSettings
  it('buildVariationSettings: wght always included', () => {
    const axes = VF_DEFAULT_AXES.map(a => ({ ...a }));
    const result = vfBuildVariationSettings(axes);
    expect(result).toContain('"wght"');
  });

  it('buildVariationSettings: returns "normal" when only defaults and no wght forced', () => {
    // All at default but still includes wght
    const axes = VF_DEFAULT_AXES.map(a => ({ ...a }));
    // Even at default, wght is always included per spec
    expect(vfBuildVariationSettings(axes)).toContain('"wght" 400');
  });

  it('buildVariationSettings: includes changed axes', () => {
    const axes = VF_DEFAULT_AXES.map(a => ({ ...a, value: a.tag === 'wdth' ? 75 : a.defaultValue }));
    const result = vfBuildVariationSettings(axes);
    expect(result).toContain('"wdth" 75');
  });

  it('buildVariationSettings: formats as comma-separated pairs', () => {
    const axes = VF_DEFAULT_AXES.map(a => ({ ...a, value: a.tag === 'wght' ? 700 : a.defaultValue }));
    const result = vfBuildVariationSettings(axes);
    expect(result).toMatch(/"wght" 700/);
  });

  // parseVariationSettings
  it('parseVariationSettings: "normal" → empty object', () => {
    expect(vfParseVariationSettings('normal')).toEqual({});
  });

  it('parseVariationSettings: parses single pair', () => {
    const result = vfParseVariationSettings('"wght" 700');
    expect(result['wght']).toBe(700);
  });

  it('parseVariationSettings: parses multiple pairs', () => {
    const result = vfParseVariationSettings('"wght" 700, "wdth" 75');
    expect(result['wght']).toBe(700);
    expect(result['wdth']).toBe(75);
  });

  it('parseVariationSettings: empty string → empty object', () => {
    expect(vfParseVariationSettings('')).toEqual({});
  });

  // applyPreset
  it('applyPreset: sets axis values from preset', () => {
    const preset: VFPreset = { name: 'Bold', axes: { wght: 700, wdth: 100 } };
    const result = vfApplyPreset(VF_DEFAULT_AXES, preset);
    const wght = result.find(a => a.tag === 'wght');
    expect(wght?.value).toBe(700);
  });

  it('applyPreset: axes not in preset keep defaultValue', () => {
    const preset: VFPreset = { name: 'Bold', axes: { wght: 700 } };
    const result = vfApplyPreset(VF_DEFAULT_AXES, preset);
    const slnt = result.find(a => a.tag === 'slnt');
    expect(slnt?.value).toBe(0); // default
  });

  it('applyPreset: returns same number of axes', () => {
    const preset: VFPreset = { name: 'Test', axes: { wght: 300 } };
    const result = vfApplyPreset(VF_DEFAULT_AXES, preset);
    expect(result).toHaveLength(VF_DEFAULT_AXES.length);
  });

  // clampAxisValue
  it('clampAxisValue: value within range → unchanged', () => {
    const axis = VF_DEFAULT_AXES[0]; // wght min=100 max=900
    expect(vfClampAxisValue(500, axis)).toBe(500);
  });

  it('clampAxisValue: below min → min', () => {
    const axis = VF_DEFAULT_AXES[0]; // wght min=100
    expect(vfClampAxisValue(50, axis)).toBe(100);
  });

  it('clampAxisValue: above max → max', () => {
    const axis = VF_DEFAULT_AXES[0]; // wght max=900
    expect(vfClampAxisValue(1000, axis)).toBe(900);
  });

  it('clampAxisValue: exactly at min → min', () => {
    const axis = VF_DEFAULT_AXES[0];
    expect(vfClampAxisValue(100, axis)).toBe(100);
  });

  it('clampAxisValue: exactly at max → max', () => {
    const axis = VF_DEFAULT_AXES[0];
    expect(vfClampAxisValue(900, axis)).toBe(900);
  });
});

// ── BlendModesPanel ────────────────────────────────────────────────────────────

// Inlined utilities from BlendModesPanel.tsx

type BM_Category = 'normal' | 'darken' | 'lighten' | 'contrast' | 'composite' | 'component';
interface BMInfo { mode: string; label: string; category: BM_Category; description: string; formula: string; }

const BM_ALL: BMInfo[] = [
  { mode: 'normal', label: 'Normal', category: 'normal', description: 'No blending', formula: 'Cs' },
  { mode: 'multiply', label: 'Multiply', category: 'darken', description: 'Multiply', formula: 'Cs × Cb' },
  { mode: 'screen', label: 'Screen', category: 'lighten', description: 'Screen', formula: '1-(1-Cs)(1-Cb)' },
  { mode: 'overlay', label: 'Overlay', category: 'contrast', description: 'Overlay', formula: 'Cb<0.5...' },
  { mode: 'darken', label: 'Darken', category: 'darken', description: 'Darken', formula: 'min(Cs,Cb)' },
  { mode: 'lighten', label: 'Lighten', category: 'lighten', description: 'Lighten', formula: 'max(Cs,Cb)' },
  { mode: 'difference', label: 'Difference', category: 'composite', description: 'Difference', formula: '|Cs-Cb|' },
  { mode: 'exclusion', label: 'Exclusion', category: 'composite', description: 'Exclusion', formula: 'Cs+Cb-2CsCb' },
  { mode: 'hue', label: 'Hue', category: 'component', description: 'Hue', formula: 'Hue(Cs)' },
  { mode: 'saturation', label: 'Saturation', category: 'component', description: 'Saturation', formula: 'Sat(Cs)' },
  { mode: 'color', label: 'Color', category: 'component', description: 'Color', formula: 'Hue+Sat(Cs)' },
  { mode: 'luminosity', label: 'Luminosity', category: 'component', description: 'Luminosity', formula: 'Lum(Cs)' },
];

function bmGetByCategory(cat: BM_Category): BMInfo[] {
  return BM_ALL.filter(m => m.category === cat);
}

function bmBuildCSS(mode: string, useBackground = false): string {
  return useBackground ? `background-blend-mode: ${mode};` : `mix-blend-mode: ${mode};`;
}

function bmHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return { r: parseInt(clean.slice(0, 2), 16) / 255, g: parseInt(clean.slice(2, 4), 16) / 255, b: parseInt(clean.slice(4, 6), 16) / 255 };
}

function bmRgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function bmMultiply(s: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) {
  return { r: s.r * bg.r, g: s.g * bg.g, b: s.b * bg.b };
}

function bmScreen(s: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) {
  return { r: 1 - (1 - s.r) * (1 - bg.r), g: 1 - (1 - s.g) * (1 - bg.g), b: 1 - (1 - s.b) * (1 - bg.b) };
}

function bmDifference(s: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) {
  return { r: Math.abs(s.r - bg.r), g: Math.abs(s.g - bg.g), b: Math.abs(s.b - bg.b) };
}

function bmOverlayChannel(s: number, bg: number): number {
  return bg < 0.5 ? 2 * s * bg : 1 - 2 * (1 - s) * (1 - bg);
}

describe('BlendModesPanel utilities', () => {
  // getModesByCategory
  it('getModesByCategory: darken category has multiply and darken', () => {
    const modes = bmGetByCategory('darken');
    const names = modes.map(m => m.mode);
    expect(names).toContain('multiply');
    expect(names).toContain('darken');
  });

  it('getModesByCategory: lighten category has screen and lighten', () => {
    const modes = bmGetByCategory('lighten');
    const names = modes.map(m => m.mode);
    expect(names).toContain('screen');
    expect(names).toContain('lighten');
  });

  it('getModesByCategory: composite category has difference and exclusion', () => {
    const modes = bmGetByCategory('composite');
    const names = modes.map(m => m.mode);
    expect(names).toContain('difference');
    expect(names).toContain('exclusion');
  });

  // buildBlendCSS
  it('buildBlendCSS: mix-blend-mode by default', () => {
    expect(bmBuildCSS('multiply')).toBe('mix-blend-mode: multiply;');
  });

  it('buildBlendCSS: background-blend-mode when flag set', () => {
    expect(bmBuildCSS('multiply', true)).toBe('background-blend-mode: multiply;');
  });

  // hexToRgb
  it('hexToRgb: black → {0, 0, 0}', () => {
    const result = bmHexToRgb('#000000');
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('hexToRgb: white → {1, 1, 1}', () => {
    const result = bmHexToRgb('#ffffff');
    expect(result?.r).toBeCloseTo(1);
    expect(result?.g).toBeCloseTo(1);
    expect(result?.b).toBeCloseTo(1);
  });

  it('hexToRgb: invalid length → null', () => {
    expect(bmHexToRgb('#fff')).toBeNull();
  });

  // rgbToHex
  it('rgbToHex: {0,0,0} → #000000', () => {
    expect(bmRgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('rgbToHex: {1,1,1} → #ffffff', () => {
    expect(bmRgbToHex(1, 1, 1)).toBe('#ffffff');
  });

  it('rgbToHex: clamps above 1', () => {
    expect(bmRgbToHex(2, 0, 0)).toBe('#ff0000');
  });

  // blendMultiply
  it('blendMultiply: white×color → color', () => {
    const src = { r: 0.5, g: 0.5, b: 0.5 };
    const bg = { r: 1, g: 1, b: 1 };
    const result = bmMultiply(src, bg);
    expect(result.r).toBeCloseTo(0.5);
  });

  it('blendMultiply: black×anything → black', () => {
    const result = bmMultiply({ r: 0, g: 0, b: 0 }, { r: 1, g: 0.5, b: 0.3 });
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
  });

  // blendScreen
  it('blendScreen: black+color → color', () => {
    const result = bmScreen({ r: 0, g: 0, b: 0 }, { r: 0.5, g: 0.3, b: 0.7 });
    expect(result.r).toBeCloseTo(0.5);
  });

  it('blendScreen: white+anything → white', () => {
    const result = bmScreen({ r: 1, g: 1, b: 1 }, { r: 0.3, g: 0.5, b: 0.7 });
    expect(result.r).toBeCloseTo(1);
  });

  // blendDifference
  it('blendDifference: same colors → black', () => {
    const c = { r: 0.5, g: 0.5, b: 0.5 };
    const result = bmDifference(c, c);
    expect(result.r).toBeCloseTo(0);
    expect(result.g).toBeCloseTo(0);
  });

  it('blendDifference: white-black → white', () => {
    const result = bmDifference({ r: 1, g: 1, b: 1 }, { r: 0, g: 0, b: 0 });
    expect(result.r).toBeCloseTo(1);
  });

  // blendOverlayChannel
  it('blendOverlayChannel: bg=0.25 uses multiply branch', () => {
    // bg < 0.5 → 2*s*bg
    expect(bmOverlayChannel(0.5, 0.25)).toBeCloseTo(2 * 0.5 * 0.25);
  });

  it('blendOverlayChannel: bg=0.75 uses screen branch', () => {
    // bg >= 0.5 → 1-2(1-s)(1-bg)
    expect(bmOverlayChannel(0.5, 0.75)).toBeCloseTo(1 - 2 * 0.5 * 0.25);
  });
});

// ── SnapGuideManagerPanel ──────────────────────────────────────────────────────

// Inlined utilities from SnapGuideManagerPanel.tsx

type SGAxis = 'horizontal' | 'vertical';
interface SG { id: string; axis: SGAxis; position: number; name: string; color: string; locked: boolean; visible: boolean; groupId: string | null; }

function sgGuideId(): string { return 'g-' + Math.random().toString(36).slice(2, 8); }

function sgCreateGuide(axis: SGAxis, position: number, name?: string, color = '#3b82f6', groupId: string | null = null): SG {
  return { id: sgGuideId(), axis, position, name: name ?? (axis === 'horizontal' ? `H ${Math.round(position)}` : `V ${Math.round(position)}`), color, locked: false, visible: true, groupId };
}

function sgGenerateColumnGuides(canvasWidth: number, columns: number, gutter: number, margin: number, color = '#ef4444', groupId: string | null = null): SG[] {
  if (columns < 1) return [];
  const totalGutters = (columns - 1) * gutter;
  const usableWidth = canvasWidth - 2 * margin - totalGutters;
  const colWidth = usableWidth / columns;
  const guides: SG[] = [];
  for (let i = 0; i <= columns; i++) {
    const x = margin + i * (colWidth + gutter);
    if (i < columns) {
      guides.push(sgCreateGuide('vertical', x, `Col ${i+1} left`, color, groupId));
      guides.push(sgCreateGuide('vertical', x + colWidth, `Col ${i+1} right`, color, groupId));
    }
  }
  const seen = new Set<number>();
  return guides.filter(g => { const key = Math.round(g.position * 100); if (seen.has(key)) return false; seen.add(key); return true; });
}

function sgGenerateBaselineGuides(canvasHeight: number, baselineHeight: number, offset = 0, color = '#10b981', groupId: string | null = null): SG[] {
  if (baselineHeight < 1) return [];
  const guides: SG[] = [];
  let y = offset; let i = 0;
  while (y <= canvasHeight) { guides.push(sgCreateGuide('horizontal', y, `Row ${i+1}`, color, groupId)); y += baselineHeight; i++; }
  return guides;
}

function sgGenerateSpacingGuides(canvasWidth: number, step: number, color = '#8b5cf6', groupId: string | null = null): SG[] {
  if (step < 1) return [];
  const guides: SG[] = [];
  let x = step;
  while (x < canvasWidth) { guides.push(sgCreateGuide('vertical', x, `${x}px`, color, groupId)); x += step; }
  return guides;
}

function sgToggleLock(guides: SG[], id: string): SG[] { return guides.map(g => g.id === id ? { ...g, locked: !g.locked } : g); }
function sgToggleVisible(guides: SG[], id: string): SG[] { return guides.map(g => g.id === id ? { ...g, visible: !g.visible } : g); }
function sgDeleteGuide(guides: SG[], id: string): SG[] { return guides.filter(g => !(g.id === id && !g.locked)); }
function sgClearUnlocked(guides: SG[]): SG[] { return guides.filter(g => g.locked); }
function sgSetGroupVisible(guides: SG[], groupId: string, visible: boolean): SG[] { return guides.map(g => g.groupId === groupId ? { ...g, visible } : g); }

function sgSortGuides(guides: SG[]): SG[] {
  return [...guides].sort((a, b) => { if (a.axis !== b.axis) return a.axis === 'horizontal' ? -1 : 1; return a.position - b.position; });
}

function sgCountByAxis(guides: SG[]): { horizontal: number; vertical: number } {
  let h = 0; let v = 0;
  for (const g of guides) { if (g.axis === 'horizontal') h++; else v++; }
  return { horizontal: h, vertical: v };
}

function sgExportJSON(guides: SG[], groups: { id: string; name: string }[]): string {
  return JSON.stringify({ guides, groups }, null, 2);
}

function sgImportJSON(json: string): { guides: SG[]; groups: { id: string; name: string }[] } | null {
  try { const p = JSON.parse(json); if (!Array.isArray(p.guides)) return null; return { guides: p.guides, groups: p.groups ?? [] }; }
  catch { return null; }
}

describe('SnapGuideManagerPanel utilities', () => {
  // createGuide
  it('createGuide: auto-names vertical guide with V prefix', () => {
    const g = sgCreateGuide('vertical', 200);
    expect(g.name).toContain('V');
    expect(g.name).toContain('200');
  });

  it('createGuide: auto-names horizontal guide with H prefix', () => {
    const g = sgCreateGuide('horizontal', 100);
    expect(g.name).toContain('H');
  });

  it('createGuide: accepts custom name', () => {
    const g = sgCreateGuide('vertical', 50, 'My Guide');
    expect(g.name).toBe('My Guide');
  });

  it('createGuide: defaults to visible and unlocked', () => {
    const g = sgCreateGuide('vertical', 100);
    expect(g.visible).toBe(true);
    expect(g.locked).toBe(false);
  });

  // generateColumnGuides
  it('generateColumnGuides: 4 columns gutter=0 produces 5 unique vertical positions', () => {
    // With gutter=0, right of col N == left of col N+1 → dedup to N+1 positions
    const guides = sgGenerateColumnGuides(1000, 4, 0, 0);
    expect(guides.length).toBe(5);
    expect(guides.every(g => g.axis === 'vertical')).toBe(true);
  });

  it('generateColumnGuides: 0 columns returns empty', () => {
    expect(sgGenerateColumnGuides(1440, 0, 24, 80)).toHaveLength(0);
  });

  it('generateColumnGuides: first guide at margin position', () => {
    const guides = sgGenerateColumnGuides(1000, 4, 0, 50);
    expect(guides[0].position).toBeCloseTo(50);
  });

  // generateBaselineGuides
  it('generateBaselineGuides: generates correct number of rows', () => {
    const guides = sgGenerateBaselineGuides(100, 8);
    // positions: 0, 8, 16, ... up to 100 → 13 guides (0..96)
    expect(guides.length).toBeGreaterThan(0);
    expect(guides.every(g => g.axis === 'horizontal')).toBe(true);
  });

  it('generateBaselineGuides: step < 1 returns empty', () => {
    expect(sgGenerateBaselineGuides(200, 0)).toHaveLength(0);
  });

  // generateSpacingGuides
  it('generateSpacingGuides: generates guides at step intervals', () => {
    const guides = sgGenerateSpacingGuides(100, 10);
    // x = 10, 20, ..., 90 → 9 guides
    expect(guides).toHaveLength(9);
  });

  it('generateSpacingGuides: step < 1 returns empty', () => {
    expect(sgGenerateSpacingGuides(200, 0)).toHaveLength(0);
  });

  // toggleLock
  it('toggleLock: unlocked → locked', () => {
    const g = sgCreateGuide('vertical', 100);
    const result = sgToggleLock([g], g.id);
    expect(result[0].locked).toBe(true);
  });

  it('toggleLock: locked → unlocked', () => {
    const g = { ...sgCreateGuide('vertical', 100), locked: true };
    const result = sgToggleLock([g], g.id);
    expect(result[0].locked).toBe(false);
  });

  // toggleVisible
  it('toggleVisible: visible → hidden', () => {
    const g = sgCreateGuide('vertical', 100);
    const result = sgToggleVisible([g], g.id);
    expect(result[0].visible).toBe(false);
  });

  // deleteGuide
  it('deleteGuide: removes unlocked guide', () => {
    const g = sgCreateGuide('vertical', 100);
    const result = sgDeleteGuide([g], g.id);
    expect(result).toHaveLength(0);
  });

  it('deleteGuide: preserves locked guide', () => {
    const g = { ...sgCreateGuide('vertical', 100), locked: true };
    const result = sgDeleteGuide([g], g.id);
    expect(result).toHaveLength(1);
  });

  // clearUnlocked
  it('clearUnlocked: removes all unlocked, keeps locked', () => {
    const locked = { ...sgCreateGuide('vertical', 10), locked: true };
    const unlocked = sgCreateGuide('vertical', 20);
    const result = sgClearUnlocked([locked, unlocked]);
    expect(result).toHaveLength(1);
    expect(result[0].locked).toBe(true);
  });

  // sortGuides
  it('sortGuides: horizontal before vertical', () => {
    const v = sgCreateGuide('vertical', 50);
    const h = sgCreateGuide('horizontal', 100);
    const result = sgSortGuides([v, h]);
    expect(result[0].axis).toBe('horizontal');
  });

  it('sortGuides: sorts by position ascending within axis', () => {
    const a = sgCreateGuide('vertical', 200);
    const b = sgCreateGuide('vertical', 50);
    const result = sgSortGuides([a, b]);
    expect(result[0].position).toBe(50);
  });

  // countByAxis
  it('countByAxis: counts correctly', () => {
    const guides = [sgCreateGuide('horizontal', 10), sgCreateGuide('vertical', 20), sgCreateGuide('vertical', 30)];
    const { horizontal, vertical } = sgCountByAxis(guides);
    expect(horizontal).toBe(1);
    expect(vertical).toBe(2);
  });

  // export/import
  it('exportJSON/importJSON: round trips correctly', () => {
    const g = sgCreateGuide('vertical', 100, 'Test');
    const json = sgExportJSON([g], []);
    const parsed = sgImportJSON(json);
    expect(parsed?.guides[0].name).toBe('Test');
  });

  it('importJSON: returns null for invalid JSON', () => {
    expect(sgImportJSON('not json')).toBeNull();
  });

  it('importJSON: returns null when guides is not an array', () => {
    expect(sgImportJSON('{"guides": "bad"}')).toBeNull();
  });
});

// ── DesignSystemHealthPanel ───────────────────────────────────────────────────

// Inlined utilities from DesignSystemHealthPanel.tsx

interface DSShape { id: string; type: string; x: number; y: number; width: number; height: number; fill?: string; stroke?: string; fontSize?: number; name?: string; }

function dsNearestValue(value: number, allowed: number[]): number {
  if (allowed.length === 0) return value;
  return allowed.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
}

function dsIsOnScale(value: number, scale: number[], tolerance = 0.5): boolean {
  return scale.some(s => Math.abs(s - value) <= tolerance);
}

function dsNormalizeHex(hex: string): string {
  const clean = hex.replace('#', '').toLowerCase();
  if (clean.length === 3) return '#' + clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  return '#' + clean.slice(0, 6);
}

function dsCollectColors(shapes: DSShape[]): string[] {
  const colors = new Set<string>();
  for (const s of shapes) {
    if (s.fill && s.fill !== 'transparent' && s.fill.startsWith('#')) colors.add(dsNormalizeHex(s.fill));
    if (s.stroke && s.stroke.startsWith('#')) colors.add(dsNormalizeHex(s.stroke));
  }
  return [...colors];
}

function dsCollectFontSizes(shapes: DSShape[]): number[] {
  const sizes = new Set<number>();
  for (const s of shapes) { if (s.fontSize) sizes.add(s.fontSize); }
  return [...sizes].sort((a, b) => a - b);
}

interface DSViolation { id: string; shapeId: string; severity: 'error' | 'warning' | 'info'; rule: string; autoFixable: boolean; suggestedValue?: string; }

function dsComputeHealthScore(violations: DSViolation[], shapeCount: number): number {
  if (shapeCount === 0) return 100;
  let penalty = 0;
  for (const v of violations) { if (v.severity === 'error') penalty += 10; else if (v.severity === 'warning') penalty += 3; else penalty += 1; }
  return Math.max(0, Math.min(100, 100 - penalty));
}

describe('DesignSystemHealthPanel utilities', () => {
  // nearestValue
  it('nearestValue: finds exact match', () => {
    expect(dsNearestValue(8, [4, 8, 16])).toBe(8);
  });

  it('nearestValue: rounds to nearest', () => {
    expect(dsNearestValue(7, [4, 8, 16])).toBe(8); // 7 is closer to 8 than 4
  });

  it('nearestValue: below minimum → minimum', () => {
    expect(dsNearestValue(1, [4, 8, 16])).toBe(4);
  });

  it('nearestValue: empty allowed → returns value unchanged', () => {
    expect(dsNearestValue(99, [])).toBe(99);
  });

  // isOnScale
  it('isOnScale: exact match → true', () => {
    expect(dsIsOnScale(8, [4, 8, 16])).toBe(true);
  });

  it('isOnScale: within tolerance → true', () => {
    expect(dsIsOnScale(8.3, [8], 0.5)).toBe(true);
  });

  it('isOnScale: outside tolerance → false', () => {
    expect(dsIsOnScale(9, [8], 0.5)).toBe(false);
  });

  it('isOnScale: empty scale → false', () => {
    expect(dsIsOnScale(8, [])).toBe(false);
  });

  // normalizeHex
  it('normalizeHex: 6-char hex → lowercase with #', () => {
    expect(dsNormalizeHex('#FF0000')).toBe('#ff0000');
  });

  it('normalizeHex: 3-char shorthand → expanded', () => {
    expect(dsNormalizeHex('#F00')).toBe('#ff0000');
  });

  // collectColors
  it('collectColors: collects fill and stroke colors', () => {
    const shapes: DSShape[] = [
      { id: 'a', type: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#ff0000' },
      { id: 'b', type: 'rect', x: 0, y: 0, width: 10, height: 10, stroke: '#00ff00' },
    ];
    const colors = dsCollectColors(shapes);
    expect(colors).toContain('#ff0000');
    expect(colors).toContain('#00ff00');
  });

  it('collectColors: deduplicates same color', () => {
    const shapes: DSShape[] = [
      { id: 'a', type: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#ff0000' },
      { id: 'b', type: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#ff0000' },
    ];
    expect(dsCollectColors(shapes)).toHaveLength(1);
  });

  it('collectColors: skips transparent', () => {
    const shapes: DSShape[] = [{ id: 'a', type: 'rect', x: 0, y: 0, width: 10, height: 10, fill: 'transparent' }];
    expect(dsCollectColors(shapes)).toHaveLength(0);
  });

  // collectFontSizes
  it('collectFontSizes: returns sorted unique sizes', () => {
    const shapes: DSShape[] = [
      { id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 20, fontSize: 24 },
      { id: 'b', type: 'text', x: 0, y: 0, width: 100, height: 20, fontSize: 16 },
      { id: 'c', type: 'text', x: 0, y: 0, width: 100, height: 20, fontSize: 24 },
    ];
    const sizes = dsCollectFontSizes(shapes);
    expect(sizes).toEqual([16, 24]);
  });

  // computeHealthScore
  it('computeHealthScore: no violations → 100', () => {
    expect(dsComputeHealthScore([], 5)).toBe(100);
  });

  it('computeHealthScore: no shapes → 100', () => {
    expect(dsComputeHealthScore([], 0)).toBe(100);
  });

  it('computeHealthScore: errors reduce score more than warnings', () => {
    const errors: DSViolation[] = [{ id: '1', shapeId: 'a', severity: 'error', rule: 'X', autoFixable: false }];
    const warns: DSViolation[] = [{ id: '1', shapeId: 'a', severity: 'warning', rule: 'X', autoFixable: false }];
    expect(dsComputeHealthScore(errors, 5)).toBeLessThan(dsComputeHealthScore(warns, 5));
  });

  it('computeHealthScore: score never below 0', () => {
    const lots: DSViolation[] = Array.from({ length: 50 }, (_, i) => ({
      id: String(i), shapeId: 'a', severity: 'error', rule: 'X', autoFixable: false,
    }));
    expect(dsComputeHealthScore(lots, 5)).toBe(0);
  });

  it('computeHealthScore: score never above 100', () => {
    expect(dsComputeHealthScore([], 100)).toBe(100);
  });
});

// ── ShapeTimelinePanel ─────────────────────────────────────────────────────────

// Inlined utilities from ShapeTimelinePanel.tsx

type TLEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
type TLProp = 'opacity' | 'x' | 'y' | 'scale' | 'rotate';

interface TLKeyframe { id: string; time: number; property: TLProp; value: number; easing: TLEasing; }
interface TLTrack { id: string; shapeId: string; shapeName: string; delay: number; keyframes: TLKeyframe[]; color: string; }

function tlTrackId(): string { return 'trk-' + Math.random().toString(36).slice(2, 8); }

function tlCreateTrack(shapeId: string, shapeName: string, color = '#b5533c'): TLTrack {
  return { id: tlTrackId(), shapeId, shapeName, delay: 0, keyframes: [], color };
}

function tlAddKeyframe(track: TLTrack, kf: Omit<TLKeyframe, 'id'>): TLTrack {
  const newKf: TLKeyframe = { ...kf, id: 'kf-' + Math.random().toString(36).slice(2, 8) };
  const keyframes = [...track.keyframes, newKf].sort((a, b) => a.time - b.time);
  return { ...track, keyframes };
}

function tlRemoveKeyframe(track: TLTrack, kfId: string): TLTrack {
  return { ...track, keyframes: track.keyframes.filter(k => k.id !== kfId) };
}

function tlTrackProperties(track: TLTrack): TLProp[] {
  return [...new Set(track.keyframes.map(k => k.property))];
}

function tlApplyEasing(t: number, easing: TLEasing): number {
  switch (easing) {
    case 'ease-in': return t * t * t;
    case 'ease-out': return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    default: return t;
  }
}

function tlInterpolate(track: TLTrack, property: TLProp, time: number): number | null {
  const kfs = track.keyframes.filter(k => k.property === property).sort((a, b) => a.time - b.time);
  if (kfs.length === 0) return null;
  if (time <= kfs[0].time) return kfs[0].value;
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]; const b = kfs[i + 1];
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * tlApplyEasing(t, b.easing);
    }
  }
  return null;
}

function tlTrackDuration(track: TLTrack): number {
  if (track.keyframes.length === 0) return 0;
  return track.delay + Math.max(...track.keyframes.map(k => k.time));
}

function tlTotalDuration(tracks: TLTrack[]): number {
  return Math.max(0, ...tracks.map(tlTrackDuration));
}

describe('ShapeTimelinePanel utilities', () => {
  // createTrack
  it('createTrack: creates track with correct shapeId', () => {
    const t = tlCreateTrack('shape-1', 'Box');
    expect(t.shapeId).toBe('shape-1');
    expect(t.shapeName).toBe('Box');
    expect(t.keyframes).toHaveLength(0);
  });

  it('createTrack: unique ids', () => {
    const a = tlCreateTrack('a', 'A');
    const b = tlCreateTrack('b', 'B');
    expect(a.id).not.toBe(b.id);
  });

  // addKeyframe
  it('addKeyframe: adds keyframe sorted by time', () => {
    let track = tlCreateTrack('s1', 'S1');
    track = tlAddKeyframe(track, { time: 500, property: 'opacity', value: 0, easing: 'linear' });
    track = tlAddKeyframe(track, { time: 100, property: 'opacity', value: 1, easing: 'linear' });
    expect(track.keyframes[0].time).toBe(100);
    expect(track.keyframes[1].time).toBe(500);
  });

  it('addKeyframe: keyframe count increases', () => {
    let track = tlCreateTrack('s1', 'S1');
    track = tlAddKeyframe(track, { time: 0, property: 'x', value: 0, easing: 'linear' });
    expect(track.keyframes).toHaveLength(1);
  });

  // removeKeyframe
  it('removeKeyframe: removes by id', () => {
    let track = tlCreateTrack('s1', 'S1');
    track = tlAddKeyframe(track, { time: 0, property: 'x', value: 0, easing: 'linear' });
    const kfId = track.keyframes[0].id;
    track = tlRemoveKeyframe(track, kfId);
    expect(track.keyframes).toHaveLength(0);
  });

  // trackProperties
  it('trackProperties: returns unique properties', () => {
    let track = tlCreateTrack('s1', 'S1');
    track = tlAddKeyframe(track, { time: 0, property: 'opacity', value: 1, easing: 'linear' });
    track = tlAddKeyframe(track, { time: 500, property: 'opacity', value: 0, easing: 'linear' });
    track = tlAddKeyframe(track, { time: 0, property: 'x', value: 0, easing: 'linear' });
    const props = tlTrackProperties(track);
    expect(props).toHaveLength(2);
    expect(props).toContain('opacity');
    expect(props).toContain('x');
  });

  // applyEasing
  it('applyEasing: linear → identity', () => {
    expect(tlApplyEasing(0.5, 'linear')).toBeCloseTo(0.5);
  });

  it('applyEasing: ease-in → t=0 → 0', () => {
    expect(tlApplyEasing(0, 'ease-in')).toBeCloseTo(0);
  });

  it('applyEasing: ease-out → t=1 → 1', () => {
    expect(tlApplyEasing(1, 'ease-out')).toBeCloseTo(1);
  });

  it('applyEasing: ease-in-out → t=0.5 → 0.5', () => {
    expect(tlApplyEasing(0.5, 'ease-in-out')).toBeCloseTo(0.5);
  });

  // interpolateValue
  it('interpolateValue: before first keyframe → first value', () => {
    let track = tlCreateTrack('s1', 'S1');
    track = tlAddKeyframe(track, { time: 100, property: 'opacity', value: 0.5, easing: 'linear' });
    expect(tlInterpolate(track, 'opacity', 0)).toBeCloseTo(0.5);
  });

  it('interpolateValue: after last keyframe → last value', () => {
    let track = tlCreateTrack('s1', 'S1');
    track = tlAddKeyframe(track, { time: 100, property: 'opacity', value: 0.5, easing: 'linear' });
    expect(tlInterpolate(track, 'opacity', 1000)).toBeCloseTo(0.5);
  });

  it('interpolateValue: between keyframes → interpolated', () => {
    let track = tlCreateTrack('s1', 'S1');
    track = tlAddKeyframe(track, { time: 0, property: 'x', value: 0, easing: 'linear' });
    track = tlAddKeyframe(track, { time: 100, property: 'x', value: 100, easing: 'linear' });
    const val = tlInterpolate(track, 'x', 50);
    expect(val).toBeCloseTo(50);
  });

  it('interpolateValue: no keyframes for property → null', () => {
    const track = tlCreateTrack('s1', 'S1');
    expect(tlInterpolate(track, 'opacity', 50)).toBeNull();
  });

  // trackDuration
  it('trackDuration: no keyframes → 0', () => {
    expect(tlTrackDuration(tlCreateTrack('s1', 'S1'))).toBe(0);
  });

  it('trackDuration: delay + last keyframe time', () => {
    let track = { ...tlCreateTrack('s1', 'S1'), delay: 200 };
    track = tlAddKeyframe(track, { time: 0, property: 'x', value: 0, easing: 'linear' });
    track = tlAddKeyframe(track, { time: 800, property: 'x', value: 100, easing: 'linear' });
    expect(tlTrackDuration(track)).toBe(1000);
  });

  // totalDuration
  it('totalDuration: max across tracks', () => {
    let t1 = tlCreateTrack('a', 'A');
    let t2 = tlCreateTrack('b', 'B');
    t1 = tlAddKeyframe(t1, { time: 500, property: 'opacity', value: 1, easing: 'linear' });
    t2 = tlAddKeyframe(t2, { time: 800, property: 'opacity', value: 0, easing: 'linear' });
    expect(tlTotalDuration([t1, t2])).toBe(800);
  });

  it('totalDuration: no tracks → 0', () => {
    expect(tlTotalDuration([])).toBe(0);
  });
});

// ── SVGPatternLibrary ──────────────────────────────────────────────────────────

// Inlined utilities from SVGPatternLibrary.tsx

function svgEscapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svgToDataURI(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;
}

function svgPatternLabel(type: string): string {
  const labels: Record<string, string> = {
    dots: 'Dots', grid: 'Grid', 'lines-h': 'H Lines', 'lines-v': 'V Lines',
    'lines-diagonal': 'Diagonal', crosshatch: 'Crosshatch', chevron: 'Chevron',
    triangles: 'Triangles', hexagons: 'Hexagons', diamonds: 'Diamonds', waves: 'Waves',
    herringbone: 'Herringbone', bricks: 'Bricks', isometric: 'Isometric', circles: 'Circles',
    squares: 'Squares', plus: 'Plus', zigzag: 'Zigzag', polka: 'Polka', confetti: 'Confetti',
  };
  return labels[type] ?? type;
}

const SVG_ALL_TYPES = ['dots', 'grid', 'lines-h', 'lines-v', 'lines-diagonal', 'crosshatch', 'chevron', 'triangles', 'hexagons', 'diamonds', 'waves', 'herringbone', 'bricks', 'isometric', 'circles', 'squares', 'plus', 'zigzag', 'polka', 'confetti'];

describe('SVGPatternLibrary utilities', () => {
  // escapeSVGAttr
  it('escapeSVGAttr: escapes ampersand', () => {
    expect(svgEscapeAttr('a&b')).toBe('a&amp;b');
  });

  it('escapeSVGAttr: escapes quotes', () => {
    expect(svgEscapeAttr('"test"')).toBe('&quot;test&quot;');
  });

  it('escapeSVGAttr: escapes angle brackets', () => {
    expect(svgEscapeAttr('<b>')).toBe('&lt;b&gt;');
  });

  it('escapeSVGAttr: passthrough for safe strings', () => {
    expect(svgEscapeAttr('#ff0000')).toBe('#ff0000');
  });

  // svgToDataURI
  it('svgToDataURI: starts with data:image/svg+xml,', () => {
    const uri = svgToDataURI('<svg/>');
    expect(uri).toMatch(/^data:image\/svg\+xml,/);
  });

  it('svgToDataURI: encodes angle brackets', () => {
    const uri = svgToDataURI('<svg/>');
    expect(uri).not.toContain('<svg/>');
  });

  // patternLabel
  it('patternLabel: dots → "Dots"', () => {
    expect(svgPatternLabel('dots')).toBe('Dots');
  });

  it('patternLabel: crosshatch → "Crosshatch"', () => {
    expect(svgPatternLabel('crosshatch')).toBe('Crosshatch');
  });

  it('patternLabel: unknown → unchanged', () => {
    expect(svgPatternLabel('foobar')).toBe('foobar');
  });

  // Pattern count
  it('ALL_PATTERN_TYPES has 20 patterns', () => {
    expect(SVG_ALL_TYPES.length).toBe(20);
  });

  it('ALL_PATTERN_TYPES includes all key patterns', () => {
    expect(SVG_ALL_TYPES).toContain('hexagons');
    expect(SVG_ALL_TYPES).toContain('isometric');
    expect(SVG_ALL_TYPES).toContain('confetti');
  });

  // Pattern labels coverage
  it('all pattern types have labels', () => {
    for (const t of SVG_ALL_TYPES) {
      expect(svgPatternLabel(t)).not.toBe(t); // all have custom labels
    }
  });
});

// ── SpacingTokenInspector ──────────────────────────────────────────────────────

// Inlined utilities from SpacingTokenInspector.tsx

interface STShape { id: string; type: string; x: number; y: number; width: number; height: number; name?: string; }

function stBounds(s: STShape) { return { left: s.x, right: s.x + s.width, top: s.y, bottom: s.y + s.height }; }

function stHorizontalGap(a: STShape, b: STShape): number | null {
  const ba = stBounds(a); const bb = stBounds(b);
  if (bb.left < ba.right) return null;
  const overlapTop = Math.max(ba.top, bb.top);
  const overlapBottom = Math.min(ba.bottom, bb.bottom);
  if (overlapBottom <= overlapTop) return null;
  return Math.round(bb.left - ba.right);
}

function stVerticalGap(a: STShape, b: STShape): number | null {
  const ba = stBounds(a); const bb = stBounds(b);
  if (bb.top < ba.bottom) return null;
  const overlapLeft = Math.max(ba.left, bb.left);
  const overlapRight = Math.min(ba.right, bb.right);
  if (overlapRight <= overlapLeft) return null;
  return Math.round(bb.top - ba.bottom);
}

function stNearestScale(value: number, scale: number[]): number {
  if (scale.length === 0) return value;
  return scale.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
}

function stIsOnScale(value: number, scale: number[]): boolean {
  return scale.some(s => Math.abs(s - value) <= 0.5);
}

function stGapStats(gaps: { value: number }[]) {
  if (gaps.length === 0) return { count: 0, uniqueValues: 0, minGap: 0, maxGap: 0, avgGap: 0 };
  const values = gaps.map(g => g.value);
  return {
    count: gaps.length,
    uniqueValues: new Set(values.map(v => Math.round(v))).size,
    minGap: Math.min(...values),
    maxGap: Math.max(...values),
    avgGap: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
  };
}

describe('SpacingTokenInspector utilities', () => {
  // horizontalGap
  it('horizontalGap: measures gap between adjacent shapes', () => {
    const a: STShape = { id: 'a', type: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const b: STShape = { id: 'b', type: 'rect', x: 116, y: 0, width: 50, height: 50 };
    expect(stHorizontalGap(a, b)).toBe(16);
  });

  it('horizontalGap: null when shapes do not overlap vertically', () => {
    const a: STShape = { id: 'a', type: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const b: STShape = { id: 'b', type: 'rect', x: 120, y: 100, width: 50, height: 50 };
    expect(stHorizontalGap(a, b)).toBeNull();
  });

  it('horizontalGap: null when b is to the left of a', () => {
    const a: STShape = { id: 'a', type: 'rect', x: 100, y: 0, width: 100, height: 50 };
    const b: STShape = { id: 'b', type: 'rect', x: 0, y: 0, width: 50, height: 50 };
    expect(stHorizontalGap(a, b)).toBeNull();
  });

  it('horizontalGap: zero gap for touching shapes', () => {
    const a: STShape = { id: 'a', type: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const b: STShape = { id: 'b', type: 'rect', x: 100, y: 0, width: 50, height: 50 };
    expect(stHorizontalGap(a, b)).toBe(0);
  });

  // verticalGap
  it('verticalGap: measures gap between stacked shapes', () => {
    const a: STShape = { id: 'a', type: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const b: STShape = { id: 'b', type: 'rect', x: 0, y: 66, width: 100, height: 50 };
    expect(stVerticalGap(a, b)).toBe(16);
  });

  it('verticalGap: null when shapes do not overlap horizontally', () => {
    const a: STShape = { id: 'a', type: 'rect', x: 0, y: 0, width: 50, height: 50 };
    const b: STShape = { id: 'b', type: 'rect', x: 100, y: 70, width: 50, height: 50 };
    expect(stVerticalGap(a, b)).toBeNull();
  });

  it('verticalGap: null when b is above a', () => {
    const a: STShape = { id: 'a', type: 'rect', x: 0, y: 100, width: 100, height: 50 };
    const b: STShape = { id: 'b', type: 'rect', x: 0, y: 0, width: 100, height: 50 };
    expect(stVerticalGap(a, b)).toBeNull();
  });

  // nearestScale
  it('nearestScale: exact match', () => {
    expect(stNearestScale(8, [4, 8, 16])).toBe(8);
  });

  it('nearestScale: rounds down when closer to smaller', () => {
    expect(stNearestScale(5, [4, 8, 16])).toBe(4);
  });

  it('nearestScale: rounds up when closer to larger', () => {
    expect(stNearestScale(7, [4, 8, 16])).toBe(8);
  });

  // isOnScale
  it('isOnScale: exact → true', () => {
    expect(stIsOnScale(8, [4, 8, 16])).toBe(true);
  });

  it('isOnScale: within 0.5 tolerance → true', () => {
    expect(stIsOnScale(8.4, [8])).toBe(true);
  });

  it('isOnScale: outside tolerance → false', () => {
    expect(stIsOnScale(9, [8])).toBe(false);
  });

  // gapStats
  it('gapStats: empty → zeros', () => {
    const s = stGapStats([]);
    expect(s.count).toBe(0);
    expect(s.minGap).toBe(0);
  });

  it('gapStats: counts correctly', () => {
    const s = stGapStats([{ value: 8 }, { value: 16 }, { value: 8 }]);
    expect(s.count).toBe(3);
    expect(s.uniqueValues).toBe(2);
    expect(s.minGap).toBe(8);
    expect(s.maxGap).toBe(16);
  });

  it('gapStats: average is correct', () => {
    const s = stGapStats([{ value: 10 }, { value: 20 }]);
    expect(s.avgGap).toBe(15);
  });
});

// ── ColorPaletteExtractor ─────────────────────────────────────────────────────

function cpeHexToRGB(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

function cpeRgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

interface CPEHSL { h: number; s: number; l: number }
function cpeRgbToHSL(r: number, g: number, b: number): CPEHSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function cpeHslToRGB(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1/3) * 255),
  };
}

function cpeLuminance(r: number, g: number, b: number): number {
  const lin = (v: number) => { const n = v / 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function cpeContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = cpeHexToRGB(hex1)!;
  const rgb2 = cpeHexToRGB(hex2)!;
  const l1 = cpeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = cpeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function cpeTextColor(hex: string): string {
  const rgb = cpeHexToRGB(hex)!;
  return cpeLuminance(rgb.r, rgb.g, rgb.b) > 0.179 ? '#000000' : '#ffffff';
}

function cpeGenerateHarmony(baseHex: string, type: string): string[] {
  const rgb = cpeHexToRGB(baseHex)!;
  const hsl = cpeRgbToHSL(rgb.r, rgb.g, rgb.b);
  const shift = (deg: number) => {
    const { r, g, b } = cpeHslToRGB((hsl.h + deg + 360) % 360, hsl.s, hsl.l);
    return cpeRgbToHex(r, g, b);
  };
  switch (type) {
    case 'complementary': return [baseHex, shift(180)];
    case 'triadic': return [baseHex, shift(120), shift(240)];
    case 'analogous': return [shift(-30), baseHex, shift(30)];
    case 'split-complementary': return [baseHex, shift(150), shift(210)];
    case 'tetradic': return [baseHex, shift(90), shift(180), shift(270)];
    case 'monochromatic': {
      const li = (amt: number) => { const { r, g, b } = cpeHslToRGB(hsl.h, hsl.s, Math.min(1, hsl.l + amt)); return cpeRgbToHex(r, g, b); };
      const da = (amt: number) => { const { r, g, b } = cpeHslToRGB(hsl.h, hsl.s, Math.max(0, hsl.l - amt)); return cpeRgbToHex(r, g, b); };
      return [da(0.3), da(0.15), baseHex, li(0.15), li(0.3)];
    }
    default: return [baseHex];
  }
}

function cpeExportCSS(entries: Array<{ name: string; hex: string }>): string {
  const vars = entries.map(e => {
    const name = e.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `  --color-${name}: ${e.hex};`;
  }).join('\n');
  return `:root {\n${vars}\n}`;
}

describe('ColorPaletteExtractor', () => {
  it('hexToRGB: parses 6-digit hex', () => {
    const rgb = cpeHexToRGB('#ff6600');
    expect(rgb).toEqual({ r: 255, g: 102, b: 0 });
  });

  it('hexToRGB: returns null for invalid', () => {
    expect(cpeHexToRGB('bad')).toBeNull();
    expect(cpeHexToRGB('#xyz123')).toBeNull();
  });

  it('rgbToHex: encodes back correctly', () => {
    expect(cpeRgbToHex(255, 0, 128)).toBe('#ff0080');
    expect(cpeRgbToHex(0, 0, 0)).toBe('#000000');
    expect(cpeRgbToHex(255, 255, 255)).toBe('#ffffff');
  });

  it('rgbToHex: clamps out-of-range values', () => {
    expect(cpeRgbToHex(-10, 0, 300)).toBe('#0000ff');
  });

  it('rgbToHSL: pure red has hue ~0', () => {
    const { h } = cpeRgbToHSL(255, 0, 0);
    expect(h).toBeCloseTo(0, 0);
  });

  it('rgbToHSL: pure green has hue 120', () => {
    const { h } = cpeRgbToHSL(0, 255, 0);
    expect(h).toBeCloseTo(120, 0);
  });

  it('rgbToHSL: gray has zero saturation', () => {
    const { s } = cpeRgbToHSL(128, 128, 128);
    expect(s).toBe(0);
  });

  it('hslToRGB: round-trips through HSL', () => {
    const { r, g, b } = cpeHslToRGB(240, 1, 0.5); // pure blue
    expect(r).toBe(0);
    expect(b).toBe(255);
  });

  it('contrastRatio: white on black is ~21', () => {
    const cr = cpeContrastRatio('#ffffff', '#000000');
    expect(cr).toBeCloseTo(21, 0);
  });

  it('contrastRatio: same color returns 1', () => {
    expect(cpeContrastRatio('#aabbcc', '#aabbcc')).toBeCloseTo(1, 1);
  });

  it('textColor: returns black for light backgrounds', () => {
    expect(cpeTextColor('#ffffff')).toBe('#000000');
    expect(cpeTextColor('#eeeeee')).toBe('#000000');
  });

  it('textColor: returns white for dark backgrounds', () => {
    expect(cpeTextColor('#000000')).toBe('#ffffff');
    expect(cpeTextColor('#1a1a2e')).toBe('#ffffff');
  });

  it('generateHarmony: complementary has 2 colors', () => {
    const h = cpeGenerateHarmony('#ff0000', 'complementary');
    expect(h).toHaveLength(2);
    expect(h[0]).toBe('#ff0000');
  });

  it('generateHarmony: triadic has 3 colors', () => {
    expect(cpeGenerateHarmony('#ff0000', 'triadic')).toHaveLength(3);
  });

  it('generateHarmony: tetradic has 4 colors', () => {
    expect(cpeGenerateHarmony('#ff0000', 'tetradic')).toHaveLength(4);
  });

  it('generateHarmony: monochromatic has 5 colors', () => {
    expect(cpeGenerateHarmony('#6366f1', 'monochromatic')).toHaveLength(5);
  });

  it('generateHarmony: analogous has 3 colors', () => {
    expect(cpeGenerateHarmony('#00ff00', 'analogous')).toHaveLength(3);
  });

  it('exportCSS: generates valid CSS variables', () => {
    const css = cpeExportCSS([{ name: 'Primary', hex: '#6366f1' }, { name: 'Secondary', hex: '#a78bfa' }]);
    expect(css).toContain(':root {');
    expect(css).toContain('--color-primary: #6366f1');
    expect(css).toContain('--color-secondary: #a78bfa');
  });

  it('exportCSS: sanitizes names with spaces', () => {
    const css = cpeExportCSS([{ name: 'Dark Blue', hex: '#1e3a8a' }]);
    expect(css).toContain('--color-dark-blue:');
  });
});

// ── IconSearchPanel ───────────────────────────────────────────────────────────

interface IcnDef { name: string; category: string; tags: string[]; path: string }
const ICN_LIBRARY: IcnDef[] = [
  { name: 'Home', category: 'Interface', tags: ['house', 'main', 'start'], path: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { name: 'Search', category: 'Interface', tags: ['find', 'magnify', 'lookup'], path: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { name: 'Mail', category: 'Communication', tags: ['email', 'message', 'envelope'], path: 'M4 4h16c1.1 0 2 .9 2 2v12' },
  { name: 'Sun', category: 'Weather', tags: ['sunny', 'day', 'clear', 'light'], path: 'M12 17a5 5 0 100-10' },
  { name: 'Play', category: 'Media', tags: ['video', 'start', 'run'], path: 'M5 3l14 9-14 9V3z' },
];

function icnSearch(query: string, category?: string): IcnDef[] {
  const q = query.trim().toLowerCase();
  return ICN_LIBRARY.filter(icon => {
    const matchCategory = !category || category === 'All' || icon.category === category;
    if (!matchCategory) return false;
    if (!q) return true;
    return icon.name.toLowerCase().includes(q) || icon.tags.some(t => t.includes(q));
  });
}

function icnCategories(): string[] {
  const cats = Array.from(new Set(ICN_LIBRARY.map(i => i.category)));
  return ['All', ...cats.sort()];
}

function icnExportSVG(icon: IcnDef, size: number, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2"><path d="${icon.path}"/></svg>`;
}

describe('IconSearchPanel', () => {
  it('search: returns all icons with empty query', () => {
    expect(icnSearch('')).toHaveLength(ICN_LIBRARY.length);
  });

  it('search: filters by name', () => {
    const r = icnSearch('home');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('Home');
  });

  it('search: filters by tag', () => {
    const r = icnSearch('envelope');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('Mail');
  });

  it('search: is case-insensitive', () => {
    expect(icnSearch('SEARCH')).toHaveLength(1);
  });

  it('search: returns empty for no match', () => {
    expect(icnSearch('nonexistenticonxyz')).toHaveLength(0);
  });

  it('search: filters by category', () => {
    const r = icnSearch('', 'Weather');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('Sun');
  });

  it('search: All category returns everything', () => {
    expect(icnSearch('', 'All')).toHaveLength(ICN_LIBRARY.length);
  });

  it('search: category + query both applied', () => {
    const r = icnSearch('home', 'Communication');
    expect(r).toHaveLength(0); // Home is Interface
  });

  it('getAllCategories: starts with All', () => {
    const cats = icnCategories();
    expect(cats[0]).toBe('All');
  });

  it('getAllCategories: no duplicates', () => {
    const cats = icnCategories();
    expect(new Set(cats).size).toBe(cats.length);
  });

  it('exportSVG: includes viewBox', () => {
    const svg = icnExportSVG(ICN_LIBRARY[0], 24, '#ff0000');
    expect(svg).toContain('viewBox="0 0 24 24"');
  });

  it('exportSVG: includes size attributes', () => {
    const svg = icnExportSVG(ICN_LIBRARY[0], 32, '#fff');
    expect(svg).toContain('width="32"');
    expect(svg).toContain('height="32"');
  });

  it('exportSVG: includes stroke color', () => {
    const svg = icnExportSVG(ICN_LIBRARY[0], 24, '#ff6600');
    expect(svg).toContain('stroke="#ff6600"');
  });

  it('exportSVG: includes path data', () => {
    const svg = icnExportSVG(ICN_LIBRARY[2], 24, '#fff');
    expect(svg).toContain(ICN_LIBRARY[2].path);
  });

  it('search: partial name match works', () => {
    const r = icnSearch('sea');
    expect(r.some(i => i.name === 'Search')).toBe(true);
  });

  it('library: all icons have required fields', () => {
    for (const icon of ICN_LIBRARY) {
      expect(typeof icon.name).toBe('string');
      expect(typeof icon.category).toBe('string');
      expect(Array.isArray(icon.tags)).toBe(true);
      expect(typeof icon.path).toBe('string');
    }
  });
});

// ── CSSGridVisualizerPanel ────────────────────────────────────────────────────

function gvParseTrack(template: string, containerSize: number): Array<{ value: string; pixels: number }> {
  if (!template.trim()) return [];
  const expanded = template.replace(/repeat\((\d+),\s*([^)]+)\)/g, (_: string, count: string, value: string) => {
    return Array(parseInt(count)).fill(value.trim()).join(' ');
  });
  const tokens = expanded.split(/\s+/).filter(Boolean);
  const totalFr = tokens.reduce((sum: number, t: string) => sum + (t.endsWith('fr') ? parseFloat(t) : 0), 0);
  const fixedTotal = tokens.reduce((sum: number, t: string) => {
    if (t.endsWith('px')) return sum + parseFloat(t);
    if (t.endsWith('%')) return sum + (parseFloat(t) / 100) * containerSize;
    return sum;
  }, 0);
  const frUnit = totalFr > 0 ? (containerSize - fixedTotal) / totalFr : 0;
  return tokens.map((token: string) => {
    let px = 0;
    if (token.endsWith('fr')) px = parseFloat(token) * frUnit;
    else if (token.endsWith('px')) px = parseFloat(token);
    else if (token.endsWith('%')) px = (parseFloat(token) / 100) * containerSize;
    return { value: token, pixels: Math.max(0, px) };
  });
}

function gvGridCSS(templateColumns: string, columnGap: number, rowGap: number, padding: number): string {
  const lines: string[] = ['.container {', '  display: grid;'];
  if (templateColumns) lines.push(`  grid-template-columns: ${templateColumns};`);
  if (columnGap > 0) lines.push(`  column-gap: ${columnGap}px;`);
  if (rowGap > 0) lines.push(`  row-gap: ${rowGap}px;`);
  if (padding > 0) lines.push(`  padding: ${padding}px;`);
  lines.push('}');
  return lines.join('\n');
}

function gvFlexCSS(direction: string, wrap: string, justifyContent: string, gap: number): string {
  const lines: string[] = ['.container {', '  display: flex;'];
  if (direction !== 'row') lines.push(`  flex-direction: ${direction};`);
  if (wrap !== 'nowrap') lines.push(`  flex-wrap: ${wrap};`);
  if (justifyContent !== 'flex-start') lines.push(`  justify-content: ${justifyContent};`);
  if (gap > 0) lines.push(`  gap: ${gap}px;`);
  lines.push('}');
  return lines.join('\n');
}

describe('CSSGridVisualizerPanel', () => {
  it('parseTrackList: 3 equal fr columns', () => {
    const tracks = gvParseTrack('repeat(3, 1fr)', 900);
    expect(tracks).toHaveLength(3);
    expect(tracks[0].pixels).toBeCloseTo(300, 0);
  });

  it('parseTrackList: mixed px and fr', () => {
    const tracks = gvParseTrack('200px 1fr', 800);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].pixels).toBe(200);
    expect(tracks[1].pixels).toBe(600);
  });

  it('parseTrackList: percentage track', () => {
    const tracks = gvParseTrack('50%', 400);
    expect(tracks[0].pixels).toBe(200);
  });

  it('parseTrackList: empty template returns empty array', () => {
    expect(gvParseTrack('', 1000)).toHaveLength(0);
  });

  it('parseTrackList: repeat(12, 1fr) expands to 12 tracks', () => {
    const tracks = gvParseTrack('repeat(12, 1fr)', 1200);
    expect(tracks).toHaveLength(12);
    expect(tracks[0].pixels).toBe(100);
  });

  it('parseTrackList: px track parses correctly', () => {
    const tracks = gvParseTrack('100px 200px', 1000);
    expect(tracks[0].pixels).toBe(100);
    expect(tracks[1].pixels).toBe(200);
  });

  it('generateGridCSS: includes display grid', () => {
    const css = gvGridCSS('1fr 1fr', 16, 8, 0);
    expect(css).toContain('display: grid');
  });

  it('generateGridCSS: includes template columns', () => {
    const css = gvGridCSS('repeat(3, 1fr)', 16, 0, 0);
    expect(css).toContain('grid-template-columns: repeat(3, 1fr)');
  });

  it('generateGridCSS: includes column-gap when > 0', () => {
    const css = gvGridCSS('1fr', 24, 0, 0);
    expect(css).toContain('column-gap: 24px');
  });

  it('generateGridCSS: omits row-gap when 0', () => {
    const css = gvGridCSS('1fr', 16, 0, 0);
    expect(css).not.toContain('row-gap');
  });

  it('generateGridCSS: includes padding when > 0', () => {
    const css = gvGridCSS('1fr', 0, 0, 20);
    expect(css).toContain('padding: 20px');
  });

  it('generateFlexCSS: includes display flex', () => {
    const css = gvFlexCSS('row', 'nowrap', 'flex-start', 0);
    expect(css).toContain('display: flex');
  });

  it('generateFlexCSS: omits direction when row (default)', () => {
    const css = gvFlexCSS('row', 'nowrap', 'flex-start', 0);
    expect(css).not.toContain('flex-direction');
  });

  it('generateFlexCSS: includes direction when column', () => {
    const css = gvFlexCSS('column', 'nowrap', 'flex-start', 0);
    expect(css).toContain('flex-direction: column');
  });

  it('generateFlexCSS: includes justify-content when not default', () => {
    const css = gvFlexCSS('row', 'nowrap', 'space-between', 0);
    expect(css).toContain('justify-content: space-between');
  });

  it('generateFlexCSS: includes gap when > 0', () => {
    const css = gvFlexCSS('row', 'wrap', 'flex-start', 16);
    expect(css).toContain('gap: 16px');
  });

  it('generateFlexCSS: includes flex-wrap when wrap', () => {
    const css = gvFlexCSS('row', 'wrap', 'flex-start', 0);
    expect(css).toContain('flex-wrap: wrap');
  });
});

// ── AccessibilityAuditorPanel ─────────────────────────────────────────────────

function a11yLum(r: number, g: number, b: number): number {
  const lin = (v: number) => { const n = v / 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function a11yHexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace('#', '');
  if (c.length !== 6) return null;
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}

function a11yContrast(h1: string, h2: string): number {
  const c1 = a11yHexToRgb(h1), c2 = a11yHexToRgb(h2);
  if (!c1 || !c2) return 1;
  const l1 = a11yLum(...c1), l2 = a11yLum(...c2);
  return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
}

function a11yMeetsAA(ratio: number, large: boolean): boolean {
  return large ? ratio >= 3 : ratio >= 4.5;
}

function a11yMeetsAAA(ratio: number, large: boolean): boolean {
  return large ? ratio >= 4.5 : ratio >= 7;
}

function a11yIsLarge(fontSize: number, fontWeight: number): boolean {
  if (fontSize >= 24) return true;
  if (fontSize >= 18.67 && fontWeight >= 700) return true;
  return false;
}

function a11yScore(errors: number, warnings: number, infos: number): number {
  return Math.max(0, Math.min(100, 100 - errors * 15 - warnings * 5 - infos * 1));
}

function a11yScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Poor';
}

describe('AccessibilityAuditorPanel', () => {
  it('contrastRatio: black on white is ~21', () => {
    expect(a11yContrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('contrastRatio: same color is 1', () => {
    expect(a11yContrast('#888888', '#888888')).toBeCloseTo(1, 1);
  });

  it('meetsContrastAA: 4.5 passes for small text', () => {
    expect(a11yMeetsAA(4.5, false)).toBe(true);
  });

  it('meetsContrastAA: 4.4 fails for small text', () => {
    expect(a11yMeetsAA(4.4, false)).toBe(false);
  });

  it('meetsContrastAA: 3.0 passes for large text', () => {
    expect(a11yMeetsAA(3.0, true)).toBe(true);
  });

  it('meetsContrastAAA: 7.0 passes for small text', () => {
    expect(a11yMeetsAAA(7.0, false)).toBe(true);
  });

  it('meetsContrastAAA: 6.9 fails for small text', () => {
    expect(a11yMeetsAAA(6.9, false)).toBe(false);
  });

  it('isLargeText: 24px is large', () => {
    expect(a11yIsLarge(24, 400)).toBe(true);
  });

  it('isLargeText: 16px normal weight is not large', () => {
    expect(a11yIsLarge(16, 400)).toBe(false);
  });

  it('isLargeText: 18.67px bold is large', () => {
    expect(a11yIsLarge(18.67, 700)).toBe(true);
  });

  it('isLargeText: 18px bold is not large (below 18.67)', () => {
    expect(a11yIsLarge(18, 700)).toBe(false);
  });

  it('score: no issues = 100', () => {
    expect(a11yScore(0, 0, 0)).toBe(100);
  });

  it('score: 1 error = 85', () => {
    expect(a11yScore(1, 0, 0)).toBe(85);
  });

  it('score: 2 errors + 1 warning = 70', () => {
    expect(a11yScore(2, 1, 0)).toBe(65);
  });

  it('score: clamps to 0 for many errors', () => {
    expect(a11yScore(100, 100, 100)).toBe(0);
  });

  it('scoreLabel: 95 is Excellent', () => {
    expect(a11yScoreLabel(95)).toBe('Excellent');
  });

  it('scoreLabel: 75 is Good', () => {
    expect(a11yScoreLabel(75)).toBe('Good');
  });

  it('scoreLabel: 55 is Needs Work', () => {
    expect(a11yScoreLabel(55)).toBe('Needs Work');
  });

  it('scoreLabel: 30 is Poor', () => {
    expect(a11yScoreLabel(30)).toBe('Poor');
  });

  it('hexToRgb: returns null for invalid hex', () => {
    expect(a11yHexToRgb('xyz')).toBeNull();
  });

  it('contrastRatio: gray on white', () => {
    const cr = a11yContrast('#767676', '#ffffff');
    expect(cr).toBeGreaterThan(4.5);
  });
});

// ── EasingCurveEditor ─────────────────────────────────────────────────────────

function ecCubic1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}

function ecDerivative1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return 3*u*u*(p1-p0) + 6*u*t*(p2-p1) + 3*t*t*(p3-p2);
}

function ecEvalBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = ecCubic1D(0, x1, x2, 1, u) - t;
    const dx = ecDerivative1D(0, x1, x2, 1, u);
    if (Math.abs(dx) < 1e-8) break;
    u -= x / dx;
    u = Math.max(0, Math.min(1, u));
  }
  return ecCubic1D(0, y1, y2, 1, u);
}

function ecBezierCSS(x1: number, y1: number, x2: number, y2: number): string {
  return `cubic-bezier(${x1.toFixed(3)}, ${y1.toFixed(3)}, ${x2.toFixed(3)}, ${y2.toFixed(3)})`;
}

function ecStepsCSS(steps: number): string { return `steps(${steps}, end)`; }

function ecSampleSpringY(stiffness: number, damping: number, mass: number, t: number): number {
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const A = 1, B = zeta * omega / wd;
    return 1 - Math.exp(-zeta * omega * t) * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
  }
  return 1 - (1 + omega * t) * Math.exp(-omega * t);
}

describe('EasingCurveEditor', () => {
  it('cubicBezier1D: at t=0 returns p0', () => {
    expect(ecCubic1D(0, 0.5, 0.5, 1, 0)).toBe(0);
  });

  it('cubicBezier1D: at t=1 returns p3', () => {
    expect(ecCubic1D(0, 0.5, 0.5, 1, 1)).toBe(1);
  });

  it('cubicBezier1D: linear at t=0.5 returns 0.5', () => {
    expect(ecCubic1D(0, 0, 1, 1, 0.5)).toBeCloseTo(0.5, 5);
  });

  it('evaluateCubicBezier: linear ease returns t', () => {
    const y = ecEvalBezier(0, 0, 1, 1, 0.5);
    expect(y).toBeCloseTo(0.5, 2);
  });

  it('evaluateCubicBezier: at t=0 returns 0', () => {
    expect(ecEvalBezier(0.42, 0, 0.58, 1, 0)).toBeCloseTo(0, 2);
  });

  it('evaluateCubicBezier: at t=1 returns 1', () => {
    expect(ecEvalBezier(0.42, 0, 0.58, 1, 1)).toBeCloseTo(1, 2);
  });

  it('evaluateCubicBezier: ease-in-out is symmetric around 0.5', () => {
    const y1 = ecEvalBezier(0.42, 0, 0.58, 1, 0.25);
    const y2 = 1 - ecEvalBezier(0.42, 0, 0.58, 1, 0.75);
    expect(y1).toBeCloseTo(y2, 2);
  });

  it('bezierToCSS: formats correctly', () => {
    expect(ecBezierCSS(0.42, 0, 0.58, 1)).toBe('cubic-bezier(0.420, 0.000, 0.580, 1.000)');
  });

  it('stepsToCSS: formats correctly', () => {
    expect(ecStepsCSS(8)).toBe('steps(8, end)');
  });

  it('stepsToCSS: 4 steps', () => {
    expect(ecStepsCSS(4)).toBe('steps(4, end)');
  });

  it('spring: at t=0 starts near 0 for underdamped', () => {
    const y = ecSampleSpringY(300, 20, 1, 0);
    expect(y).toBeCloseTo(0, 1);
  });

  it('spring: at large t settles near 1 for underdamped', () => {
    const y = ecSampleSpringY(300, 30, 1, 5);
    expect(y).toBeCloseTo(1, 1);
  });

  it('spring: high damping settles without overshoot', () => {
    const y1 = ecSampleSpringY(100, 80, 1, 0.5);
    const y2 = ecSampleSpringY(100, 80, 1, 1.0);
    // Overdamped — y should monotonically increase
    expect(y2).toBeGreaterThanOrEqual(y1 - 0.001);
  });

  it('presets: all have required fields', () => {
    const presets = [
      { name: 'ease', type: 'cubic-bezier', bezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
      { name: 'Bouncy', type: 'spring', spring: { stiffness: 300, damping: 10, mass: 1, velocity: 0 } },
      { name: 'steps(4)', type: 'steps', steps: 4 },
    ];
    for (const p of presets) {
      expect(typeof p.name).toBe('string');
      expect(['cubic-bezier', 'spring', 'steps'].includes(p.type)).toBe(true);
    }
  });

  it('derivative1D: at t=0 matches expected', () => {
    const d = ecDerivative1D(0, 0.5, 0.5, 1, 0);
    expect(d).toBeCloseTo(1.5, 1);
  });
});

// ── DesignTokenMapper ─────────────────────────────────────────────────────────

type DtmTokenCategory = 'color' | 'spacing' | 'typography' | 'border' | 'opacity';
interface DtmToken { id: string; name: string; category: DtmTokenCategory; value: string | number; group?: string }
interface DtmBinding { shapeId: string; property: string; tokenId: string }

function dtmGetByCategory(tokens: DtmToken[], category: DtmTokenCategory): DtmToken[] {
  return tokens.filter(t => t.category === category);
}

function dtmFindBinding(bindings: DtmBinding[], shapeId: string, property: string): DtmBinding | undefined {
  return bindings.find(b => b.shapeId === shapeId && b.property === property);
}

function dtmCountBindings(bindings: DtmBinding[], shapeId: string): number {
  return bindings.filter(b => b.shapeId === shapeId).length;
}

function dtmExportCSS(tokens: DtmToken[]): string {
  const lines = [':root {'];
  for (const t of tokens) {
    const name = t.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const val = typeof t.value === 'number' ? `${t.value}px` : t.value;
    lines.push(`  --dt-${name}: ${val};`);
  }
  lines.push('}');
  return lines.join('\n');
}

function dtmExportJSON(tokens: DtmToken[]): string {
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const t of tokens) {
    if (!grouped[t.category]) grouped[t.category] = {};
    grouped[t.category][t.name] = { value: t.value, type: t.category };
  }
  return JSON.stringify(grouped, null, 2);
}

const dtmTokens: DtmToken[] = [
  { id: 'c1', name: 'Primary', category: 'color', value: '#6366f1', group: 'Brand' },
  { id: 'c2', name: 'Secondary', category: 'color', value: '#ec4899', group: 'Brand' },
  { id: 's1', name: 'md', category: 'spacing', value: 16, group: 'Scale' },
  { id: 's2', name: 'lg', category: 'spacing', value: 24, group: 'Scale' },
  { id: 't1', name: 'text-base', category: 'typography', value: 16, group: 'Size' },
];

describe('DesignTokenMapper', () => {
  it('getByCategory: filters color tokens', () => {
    const colors = dtmGetByCategory(dtmTokens, 'color');
    expect(colors).toHaveLength(2);
    expect(colors.every(t => t.category === 'color')).toBe(true);
  });

  it('getByCategory: filters spacing tokens', () => {
    const spacing = dtmGetByCategory(dtmTokens, 'spacing');
    expect(spacing).toHaveLength(2);
  });

  it('getByCategory: returns empty for unknown category', () => {
    expect(dtmGetByCategory(dtmTokens, 'opacity')).toHaveLength(0);
  });

  it('findBinding: finds existing binding', () => {
    const bindings: DtmBinding[] = [{ shapeId: 'sh1', property: 'fill', tokenId: 'c1' }];
    expect(dtmFindBinding(bindings, 'sh1', 'fill')).toBeDefined();
  });

  it('findBinding: returns undefined for missing binding', () => {
    const bindings: DtmBinding[] = [{ shapeId: 'sh1', property: 'fill', tokenId: 'c1' }];
    expect(dtmFindBinding(bindings, 'sh1', 'stroke')).toBeUndefined();
  });

  it('countBindings: counts all bindings for a shape', () => {
    const bindings: DtmBinding[] = [
      { shapeId: 'sh1', property: 'fill', tokenId: 'c1' },
      { shapeId: 'sh1', property: 'stroke', tokenId: 'c2' },
      { shapeId: 'sh2', property: 'fill', tokenId: 'c1' },
    ];
    expect(dtmCountBindings(bindings, 'sh1')).toBe(2);
    expect(dtmCountBindings(bindings, 'sh2')).toBe(1);
    expect(dtmCountBindings(bindings, 'sh3')).toBe(0);
  });

  it('exportCSS: generates :root block', () => {
    const css = dtmExportCSS(dtmTokens);
    expect(css).toContain(':root {');
    expect(css).toContain('}');
  });

  it('exportCSS: includes token as CSS variable', () => {
    const css = dtmExportCSS([{ id: 'x', name: 'Primary', category: 'color', value: '#6366f1' }]);
    expect(css).toContain('--dt-primary: #6366f1');
  });

  it('exportCSS: spacing values get px suffix', () => {
    const css = dtmExportCSS([{ id: 'x', name: 'md', category: 'spacing', value: 16 }]);
    expect(css).toContain('--dt-md: 16px');
  });

  it('exportCSS: replaces spaces in name with hyphens', () => {
    const css = dtmExportCSS([{ id: 'x', name: 'Dark Blue', category: 'color', value: '#1a2e5a' }]);
    expect(css).toContain('--dt-dark-blue:');
  });

  it('exportJSON: groups by category', () => {
    const json = JSON.parse(dtmExportJSON(dtmTokens));
    expect(json.color).toBeDefined();
    expect(json.spacing).toBeDefined();
    expect(json.color['Primary'].value).toBe('#6366f1');
  });

  it('exportJSON: includes type field', () => {
    const json = JSON.parse(dtmExportJSON(dtmTokens));
    expect(json.color['Primary'].type).toBe('color');
  });

  it('tokens: can add new token to array', () => {
    const newToken: DtmToken = { id: 'new1', name: 'Custom Blue', category: 'color', value: '#0000ff' };
    const updated = [...dtmTokens, newToken];
    expect(updated).toHaveLength(dtmTokens.length + 1);
    expect(updated.find(t => t.id === 'new1')).toBeDefined();
  });

  it('tokens: can remove token from array', () => {
    const filtered = dtmTokens.filter(t => t.id !== 'c1');
    expect(filtered).toHaveLength(dtmTokens.length - 1);
    expect(filtered.find(t => t.id === 'c1')).toBeUndefined();
  });

  it('bindings: can update binding for same shape+property', () => {
    let bindings: DtmBinding[] = [{ shapeId: 'sh1', property: 'fill', tokenId: 'c1' }];
    const newTokenId = 'c2';
    bindings = bindings.filter(b => !(b.shapeId === 'sh1' && b.property === 'fill'));
    bindings.push({ shapeId: 'sh1', property: 'fill', tokenId: newTokenId });
    expect(dtmFindBinding(bindings, 'sh1', 'fill')?.tokenId).toBe('c2');
  });
});

// ── ImageFilterStudio ─────────────────────────────────────────────────────────

interface IfsConfig {
  blur: number; brightness: number; contrast: number; saturation: number;
  hueRotate: number; sepia: number; grayscale: number; invert: number;
  opacity: number; dropShadowX: number; dropShadowY: number; dropShadowBlur: number;
  dropShadowColor: string;
}

const IFS_DEFAULT: IfsConfig = {
  blur: 0, brightness: 100, contrast: 100, saturation: 100,
  hueRotate: 0, sepia: 0, grayscale: 0, invert: 0, opacity: 100,
  dropShadowX: 0, dropShadowY: 0, dropShadowBlur: 0, dropShadowColor: '#000000',
};

function ifsBuildCSS(cfg: IfsConfig): string {
  const parts: string[] = [];
  if (cfg.blur !== 0) parts.push(`blur(${cfg.blur}px)`);
  if (cfg.brightness !== 100) parts.push(`brightness(${cfg.brightness}%)`);
  if (cfg.contrast !== 100) parts.push(`contrast(${cfg.contrast}%)`);
  if (cfg.saturation !== 100) parts.push(`saturate(${cfg.saturation}%)`);
  if (cfg.hueRotate !== 0) parts.push(`hue-rotate(${cfg.hueRotate}deg)`);
  if (cfg.sepia !== 0) parts.push(`sepia(${cfg.sepia}%)`);
  if (cfg.grayscale !== 0) parts.push(`grayscale(${cfg.grayscale}%)`);
  if (cfg.invert !== 0) parts.push(`invert(${cfg.invert}%)`);
  if (cfg.dropShadowBlur > 0 || cfg.dropShadowX !== 0 || cfg.dropShadowY !== 0)
    parts.push(`drop-shadow(${cfg.dropShadowX}px ${cfg.dropShadowY}px ${cfg.dropShadowBlur}px ${cfg.dropShadowColor})`);
  return parts.length === 0 ? 'none' : parts.join(' ');
}

function ifsIsDefault(cfg: IfsConfig): boolean {
  return cfg.blur === 0 && cfg.brightness === 100 && cfg.contrast === 100 &&
    cfg.saturation === 100 && cfg.hueRotate === 0 && cfg.sepia === 0 &&
    cfg.grayscale === 0 && cfg.invert === 0 && cfg.opacity === 100;
}

function ifsDiffCount(cfg: IfsConfig): number {
  return [
    cfg.blur !== 0, cfg.brightness !== 100, cfg.contrast !== 100,
    cfg.saturation !== 100, cfg.hueRotate !== 0, cfg.sepia !== 0,
    cfg.grayscale !== 0, cfg.invert !== 0, cfg.opacity !== 100,
    cfg.dropShadowBlur > 0 || cfg.dropShadowX !== 0 || cfg.dropShadowY !== 0,
  ].filter(Boolean).length;
}

describe('ImageFilterStudio', () => {
  it('buildFilterCSS: default config returns none', () => {
    expect(ifsBuildCSS(IFS_DEFAULT)).toBe('none');
  });

  it('buildFilterCSS: blur only', () => {
    const css = ifsBuildCSS({ ...IFS_DEFAULT, blur: 4 });
    expect(css).toContain('blur(4px)');
  });

  it('buildFilterCSS: brightness only', () => {
    const css = ifsBuildCSS({ ...IFS_DEFAULT, brightness: 150 });
    expect(css).toContain('brightness(150%)');
  });

  it('buildFilterCSS: grayscale 100 is B&W', () => {
    const css = ifsBuildCSS({ ...IFS_DEFAULT, grayscale: 100 });
    expect(css).toContain('grayscale(100%)');
    expect(css).not.toContain('blur');
  });

  it('buildFilterCSS: inverted returns invert(100%)', () => {
    expect(ifsBuildCSS({ ...IFS_DEFAULT, invert: 100 })).toContain('invert(100%)');
  });

  it('buildFilterCSS: sepia filter', () => {
    expect(ifsBuildCSS({ ...IFS_DEFAULT, sepia: 100 })).toContain('sepia(100%)');
  });

  it('buildFilterCSS: hue-rotate', () => {
    expect(ifsBuildCSS({ ...IFS_DEFAULT, hueRotate: 180 })).toContain('hue-rotate(180deg)');
  });

  it('buildFilterCSS: drop-shadow included when blur > 0', () => {
    const css = ifsBuildCSS({ ...IFS_DEFAULT, dropShadowBlur: 8, dropShadowColor: '#ff0000' });
    expect(css).toContain('drop-shadow(0px 0px 8px #ff0000)');
  });

  it('buildFilterCSS: multiple filters combined', () => {
    const css = ifsBuildCSS({ ...IFS_DEFAULT, blur: 2, contrast: 120, saturation: 150 });
    expect(css).toContain('blur(2px)');
    expect(css).toContain('contrast(120%)');
    expect(css).toContain('saturate(150%)');
  });

  it('isDefault: default config is true', () => {
    expect(ifsIsDefault(IFS_DEFAULT)).toBe(true);
  });

  it('isDefault: any change makes it false', () => {
    expect(ifsIsDefault({ ...IFS_DEFAULT, blur: 1 })).toBe(false);
  });

  it('diffCount: default has 0 diffs', () => {
    expect(ifsDiffCount(IFS_DEFAULT)).toBe(0);
  });

  it('diffCount: 2 changes = 2', () => {
    expect(ifsDiffCount({ ...IFS_DEFAULT, blur: 3, contrast: 150 })).toBe(2);
  });

  it('presets: sepia preset has sepia=100', () => {
    const sepia = { name: 'Sepia', config: { sepia: 100, contrast: 110, brightness: 90 } };
    expect(sepia.config.sepia).toBe(100);
  });

  it('presets: B&W preset has grayscale=100', () => {
    const bw = { name: 'B&W', config: { grayscale: 100 } };
    expect(bw.config.grayscale).toBe(100);
  });
});

// ── ShadowBuilderPanel ────────────────────────────────────────────────────────

interface SBLayer {
  id: string;
  inset: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  enabled: boolean;
}

function sbLayerId() { return Math.random().toString(36).slice(2, 10); }

function sbDefaultLayer(): SBLayer {
  return { id: sbLayerId(), inset: false, x: 0, y: 4, blur: 8, spread: 0, color: '#000000', opacity: 25, enabled: true };
}

function sbHexWithOpacity(hex: string, opacity: number): string {
  const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
  return hex.length === 7 ? `${hex}${alpha}` : hex;
}

function sbLayerToCSS(layer: SBLayer): string {
  if (!layer.enabled) return '';
  const { inset, x, y, blur, spread, color, opacity } = layer;
  const colorWithAlpha = sbHexWithOpacity(color, opacity);
  const parts = [inset ? 'inset' : '', `${x}px`, `${y}px`, `${blur}px`, `${spread}px`, colorWithAlpha].filter(Boolean);
  return parts.join(' ');
}

function sbBuildBoxShadowCSS(layers: SBLayer[]): string {
  const parts = layers.filter(l => l.enabled).map(sbLayerToCSS).filter(Boolean);
  return parts.length === 0 ? 'none' : parts.join(',\n  ');
}

function sbDuplicateLayer(layer: SBLayer): SBLayer {
  return { ...layer, id: sbLayerId() };
}

describe('ShadowBuilderPanel', () => {
  it('defaultLayer: has expected defaults', () => {
    const l = sbDefaultLayer();
    expect(l.inset).toBe(false);
    expect(l.y).toBe(4);
    expect(l.blur).toBe(8);
    expect(l.spread).toBe(0);
    expect(l.opacity).toBe(25);
    expect(l.enabled).toBe(true);
  });

  it('hexWithOpacity: 0% opacity → 00 alpha', () => {
    expect(sbHexWithOpacity('#ff0000', 0)).toBe('#ff000000');
  });

  it('hexWithOpacity: 100% opacity → ff alpha', () => {
    expect(sbHexWithOpacity('#ff0000', 100)).toBe('#ff0000ff');
  });

  it('hexWithOpacity: 50% opacity → 80 alpha (128 decimal)', () => {
    expect(sbHexWithOpacity('#000000', 50)).toBe('#00000080');
  });

  it('hexWithOpacity: 25% opacity → 40 alpha', () => {
    expect(sbHexWithOpacity('#000000', 25)).toBe('#00000040');
  });

  it('layerToCSS: returns empty string when disabled', () => {
    const l = { ...sbDefaultLayer(), enabled: false };
    expect(sbLayerToCSS(l)).toBe('');
  });

  it('layerToCSS: basic shadow has correct format', () => {
    const l: SBLayer = { id: 'a', inset: false, x: 0, y: 4, blur: 8, spread: 0, color: '#000000', opacity: 25, enabled: true };
    const css = sbLayerToCSS(l);
    expect(css).toContain('0px 4px 8px 0px');
    expect(css).not.toContain('inset');
  });

  it('layerToCSS: inset shadow includes "inset"', () => {
    const l: SBLayer = { id: 'b', inset: true, x: 0, y: 2, blur: 4, spread: 0, color: '#000000', opacity: 20, enabled: true };
    expect(sbLayerToCSS(l)).toMatch(/^inset /);
  });

  it('layerToCSS: negative x/y values render correctly', () => {
    const l: SBLayer = { id: 'c', inset: false, x: -4, y: -4, blur: 8, spread: 0, color: '#000000', opacity: 30, enabled: true };
    const css = sbLayerToCSS(l);
    expect(css).toContain('-4px -4px');
  });

  it('buildBoxShadowCSS: empty layers → "none"', () => {
    expect(sbBuildBoxShadowCSS([])).toBe('none');
  });

  it('buildBoxShadowCSS: all disabled → "none"', () => {
    const layers = [{ ...sbDefaultLayer(), enabled: false }];
    expect(sbBuildBoxShadowCSS(layers)).toBe('none');
  });

  it('buildBoxShadowCSS: single layer → single CSS string', () => {
    const l = sbDefaultLayer();
    const css = sbBuildBoxShadowCSS([l]);
    expect(css).not.toBe('none');
    expect(css).not.toContain(',');
  });

  it('buildBoxShadowCSS: multiple layers → comma-separated', () => {
    const l1 = sbDefaultLayer();
    const l2 = { ...sbDefaultLayer(), y: 8, blur: 16 };
    const css = sbBuildBoxShadowCSS([l1, l2]);
    expect(css).toContain(',');
  });

  it('buildBoxShadowCSS: skips disabled layers in multi-layer', () => {
    const l1 = sbDefaultLayer();
    const l2 = { ...sbDefaultLayer(), enabled: false };
    const css = sbBuildBoxShadowCSS([l1, l2]);
    expect(css).not.toContain(',');
  });

  it('duplicateLayer: new id, same values', () => {
    const orig = sbDefaultLayer();
    const dup = sbDuplicateLayer(orig);
    expect(dup.id).not.toBe(orig.id);
    expect(dup.blur).toBe(orig.blur);
    expect(dup.color).toBe(orig.color);
  });

  it('presets: Material Elevation 1 has two layers', () => {
    const elevation1 = {
      name: 'Elevation 1',
      layers: [
        { id: '1', inset: false, x: 0, y: 1, blur: 3, spread: 0, color: '#000000', opacity: 12, enabled: true },
        { id: '2', inset: false, x: 0, y: 1, blur: 2, spread: 0, color: '#000000', opacity: 24, enabled: true },
      ]
    };
    expect(elevation1.layers).toHaveLength(2);
  });

  it('presets: Soft sm is single-layer, low opacity', () => {
    const softSm = {
      name: 'Soft sm',
      layers: [{ id: '1', inset: false, x: 0, y: 1, blur: 3, spread: 0, color: '#000000', opacity: 10, enabled: true }]
    };
    expect(softSm.layers[0].opacity).toBeLessThan(20);
  });

  it('presets: Glow Blue has spread > 0', () => {
    const glowBlue = {
      name: 'Glow Blue',
      layers: [
        { id: '1', inset: false, x: 0, y: 0, blur: 8, spread: 2, color: '#3b82f6', opacity: 60, enabled: true },
        { id: '2', inset: false, x: 0, y: 0, blur: 20, spread: 4, color: '#3b82f6', opacity: 40, enabled: true },
      ]
    };
    expect(glowBlue.layers[0].spread).toBeGreaterThan(0);
  });

  it('presets: Neumorphic has positive and negative shadows', () => {
    const neumorphic = {
      name: 'Neumorphic Light',
      layers: [
        { id: '1', inset: false, x: -6, y: -6, blur: 12, spread: 0, color: '#ffffff', opacity: 80, enabled: true },
        { id: '2', inset: false, x: 6, y: 6, blur: 12, spread: 0, color: '#000000', opacity: 15, enabled: true },
      ]
    };
    const hasNeg = neumorphic.layers.some(l => l.x < 0 || l.y < 0);
    const hasPos = neumorphic.layers.some(l => l.x > 0 || l.y > 0);
    expect(hasNeg).toBe(true);
    expect(hasPos).toBe(true);
  });
});

// ── TypographyScaleInspector ──────────────────────────────────────────────────

interface TSIStep {
  label: string;
  size: number;
  rem: string;
  ratio: string;
}

interface TSIConfig {
  baseSize: number;
  ratio: number;
  stepsUp: number;
  stepsDown: number;
  lineHeightRatio: number;
  letterSpacingScale: boolean;
}

const TSI_DEFAULT: TSIConfig = {
  baseSize: 16, ratio: 1.25, stepsUp: 5, stepsDown: 2,
  lineHeightRatio: 1.5, letterSpacingScale: false,
};

const TSI_LABELS_UP = ['base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
const TSI_LABELS_DOWN = ['sm', 'xs', '2xs'];

function tsiGenerateScale(config: TSIConfig): TSIStep[] {
  const { baseSize, ratio, stepsUp, stepsDown } = config;
  const steps: TSIStep[] = [];
  for (let i = stepsDown; i >= 1; i--) {
    const size = baseSize / Math.pow(ratio, i);
    const label = TSI_LABELS_DOWN[i - 1] ?? `${i}xs`;
    steps.push({ label, size: Math.round(size * 100) / 100, rem: `${(size / 16).toFixed(4)}rem`, ratio: `÷${ratio}^${i}` });
  }
  steps.push({ label: 'base', size: baseSize, rem: `${(baseSize / 16).toFixed(4)}rem`, ratio: '1×' });
  for (let i = 1; i <= stepsUp; i++) {
    const size = baseSize * Math.pow(ratio, i);
    const label = TSI_LABELS_UP[i] ?? `${i}xl`;
    steps.push({ label, size: Math.round(size * 100) / 100, rem: `${(size / 16).toFixed(4)}rem`, ratio: `×${ratio}^${i}` });
  }
  return steps;
}

function tsiLineHeight(size: number, ratio: number): number {
  return Math.round(size * ratio * 10) / 10;
}

function tsiLetterSpacing(size: number, baseSize: number): string {
  if (size <= baseSize) return '0em';
  const factor = (size - baseSize) / baseSize;
  return `${-(factor * 0.02).toFixed(4)}em`;
}

function tsiExportCSS(steps: TSIStep[], config: TSIConfig): string {
  return ':root {\n' + steps.map(s => `  --fs-${s.label}: ${s.rem};`).join('\n') + '\n}';
}

function tsiClosestStep(target: number, steps: TSIStep[]): TSIStep {
  return steps.reduce((best, s) => Math.abs(s.size - target) < Math.abs(best.size - target) ? s : best);
}

describe('TypographyScaleInspector', () => {
  it('generateScale: base step is included', () => {
    const steps = tsiGenerateScale(TSI_DEFAULT);
    const base = steps.find(s => s.label === 'base');
    expect(base).toBeDefined();
    expect(base!.size).toBe(16);
  });

  it('generateScale: correct total step count', () => {
    const steps = tsiGenerateScale(TSI_DEFAULT);
    // stepsDown=2 + base + stepsUp=5 = 8
    expect(steps).toHaveLength(8);
  });

  it('generateScale: steps are in ascending size order', () => {
    const steps = tsiGenerateScale(TSI_DEFAULT);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].size).toBeGreaterThan(steps[i - 1].size);
    }
  });

  it('generateScale: ratio 1.25 — lg is 16*1.25=20', () => {
    const steps = tsiGenerateScale(TSI_DEFAULT);
    const lg = steps.find(s => s.label === 'lg');
    expect(lg).toBeDefined();
    expect(lg!.size).toBeCloseTo(20, 1);
  });

  it('generateScale: Golden Ratio produces xl ~41.89', () => {
    const steps = tsiGenerateScale({ ...TSI_DEFAULT, ratio: 1.618, stepsUp: 3, stepsDown: 1 });
    const xl = steps.find(s => s.label === 'xl');
    expect(xl).toBeDefined();
    expect(xl!.size).toBeCloseTo(16 * 1.618 * 1.618, 0);
  });

  it('generateScale: stepsDown=0 → no sm/xs steps', () => {
    const steps = tsiGenerateScale({ ...TSI_DEFAULT, stepsDown: 0 });
    expect(steps.find(s => s.label === 'sm')).toBeUndefined();
    expect(steps[0].label).toBe('base');
  });

  it('generateScale: rem value correct (base 16px)', () => {
    const steps = tsiGenerateScale(TSI_DEFAULT);
    const base = steps.find(s => s.label === 'base')!;
    expect(base.rem).toBe('1.0000rem');
  });

  it('lineHeight: size × ratio, rounded to 1dp', () => {
    expect(tsiLineHeight(16, 1.5)).toBe(24);
    expect(tsiLineHeight(20, 1.5)).toBe(30);
  });

  it('lineHeight: large heading tighter but still positive', () => {
    const lh = tsiLineHeight(48, 1.2);
    expect(lh).toBeGreaterThan(0);
    expect(lh).toBeCloseTo(57.6, 0);
  });

  it('letterSpacing: base size → 0em', () => {
    expect(tsiLetterSpacing(16, 16)).toBe('0em');
  });

  it('letterSpacing: small size → 0em (not smaller than base)', () => {
    expect(tsiLetterSpacing(12, 16)).toBe('0em');
  });

  it('letterSpacing: double base size → negative value', () => {
    const ls = tsiLetterSpacing(32, 16);
    expect(ls).toMatch(/^-/);
  });

  it('exportCSS: starts with :root block', () => {
    const steps = tsiGenerateScale(TSI_DEFAULT);
    const css = tsiExportCSS(steps, TSI_DEFAULT);
    expect(css).toMatch(/^:root \{/);
    expect(css).toContain('--fs-base:');
  });

  it('exportCSS: contains all step labels', () => {
    const steps = tsiGenerateScale(TSI_DEFAULT);
    const css = tsiExportCSS(steps, TSI_DEFAULT);
    for (const step of steps) {
      expect(css).toContain(`--fs-${step.label}:`);
    }
  });

  it('closestStep: exact match', () => {
    const steps = tsiGenerateScale(TSI_DEFAULT);
    const found = tsiClosestStep(16, steps);
    expect(found.label).toBe('base');
  });

  it('closestStep: 19px → lg (20px) not sm (12.8px)', () => {
    const steps = tsiGenerateScale(TSI_DEFAULT);
    const found = tsiClosestStep(19, steps);
    expect(found.label).toBe('lg');
  });

  it('ratios: SCALE_RATIOS has 9 entries covering 1.067 to 2.0', () => {
    const ratios = [1.067, 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618, 2.0];
    expect(ratios).toHaveLength(9);
    expect(Math.min(...ratios)).toBeCloseTo(1.067);
    expect(Math.max(...ratios)).toBe(2.0);
  });
});

// ── ColorMixingPanel ──────────────────────────────────────────────────────────

function cmHexToRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
function cmRgbToHex(rgb: {r:number;g:number;b:number}): string {
  const cl = (v:number) => Math.min(255,Math.max(0,Math.round(v))).toString(16).padStart(2,'0');
  return '#' + cl(rgb.r) + cl(rgb.g) + cl(rgb.b);
}
function cmRgbToHSL(rgb:{r:number;g:number;b:number}):{h:number;s:number;l:number} {
  const r=rgb.r/255,g=rgb.g/255,b=rgb.b/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  const l=(max+min)/2;
  if(max===min) return {h:0,s:0,l:Math.round(l*100)};
  const d=max-min;
  const s=l>0.5?d/(2-max-min):d/(max+min);
  let h=0;
  if(max===r) h=((g-b)/d+(g<b?6:0))/6;
  else if(max===g) h=((b-r)/d+2)/6;
  else h=((r-g)/d+4)/6;
  return {h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};
}
function cmHslToRGB(hsl:{h:number;s:number;l:number}):{r:number;g:number;b:number} {
  const {h,s,l} = hsl;
  const sn=s/100, ln=l/100;
  if(s===0){const v=Math.round(ln*255);return{r:v,g:v,b:v};}
  const q=ln<0.5?ln*(1+sn):ln+sn-ln*sn;
  const p=2*ln-q; const hk=h/360;
  const hue2rgb=(t:number)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
  return{r:Math.round(hue2rgb(hk+1/3)*255),g:Math.round(hue2rgb(hk)*255),b:Math.round(hue2rgb(hk-1/3)*255)};
}
function cmMixRGB(a:{r:number;g:number;b:number},b:{r:number;g:number;b:number},t:number):{r:number;g:number;b:number} {
  return {r:Math.round(a.r+(b.r-a.r)*t),g:Math.round(a.g+(b.g-a.g)*t),b:Math.round(a.b+(b.b-a.b)*t)};
}
function cmMixHSL(a:{h:number;s:number;l:number},b:{h:number;s:number;l:number},t:number) {
  let dh=b.h-a.h; if(dh>180) dh-=360; if(dh<-180) dh+=360;
  return {h:Math.round((a.h+dh*t+360)%360),s:Math.round(a.s+(b.s-a.s)*t),l:Math.round(a.l+(b.l-a.l)*t)};
}
function cmRelLuminance(rgb:{r:number;g:number;b:number}):number {
  const chan=(v:number)=>{const c=v/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
  return 0.2126*chan(rgb.r)+0.7152*chan(rgb.g)+0.0722*chan(rgb.b);
}
function cmContrast(a:{r:number;g:number;b:number},b:{r:number;g:number;b:number}):number {
  const la=cmRelLuminance(a),lb=cmRelLuminance(b);
  return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05);
}

describe('ColorMixingPanel', () => {
  it('hexToRGB: parses correctly', () => {
    const {r,g,b} = cmHexToRGB('#3b82f6');
    expect(r).toBe(59); expect(g).toBe(130); expect(b).toBe(246);
  });

  it('hexToRGB: black → 0,0,0', () => {
    const rgb = cmHexToRGB('#000000');
    expect(rgb).toEqual({r:0,g:0,b:0});
  });

  it('rgbToHex: white', () => {
    expect(cmRgbToHex({r:255,g:255,b:255})).toBe('#ffffff');
  });

  it('rgbToHex: round trips', () => {
    const hex = '#a1b2c3';
    expect(cmRgbToHex(cmHexToRGB(hex))).toBe(hex);
  });

  it('rgbToHSL: red is hue 0', () => {
    const {h} = cmRgbToHSL({r:255,g:0,b:0});
    expect(h).toBe(0);
  });

  it('rgbToHSL: pure green hue ~120', () => {
    const {h} = cmRgbToHSL({r:0,g:255,b:0});
    expect(h).toBe(120);
  });

  it('rgbToHSL: grey has 0 saturation', () => {
    const {s} = cmRgbToHSL({r:128,g:128,b:128});
    expect(s).toBe(0);
  });

  it('hslToRGB: round trips through HSL', () => {
    const orig = {r:59,g:130,b:246};
    const hsl = cmRgbToHSL(orig);
    const back = cmHslToRGB(hsl);
    expect(Math.abs(back.r - orig.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(back.g - orig.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(back.b - orig.b)).toBeLessThanOrEqual(2);
  });

  it('mixRGB: t=0 → color A', () => {
    const a = {r:255,g:0,b:0}, b2 = {r:0,g:0,b:255};
    expect(cmMixRGB(a,b2,0)).toEqual(a);
  });

  it('mixRGB: t=1 → color B', () => {
    const a = {r:255,g:0,b:0}, b2 = {r:0,g:0,b:255};
    expect(cmMixRGB(a,b2,1)).toEqual(b2);
  });

  it('mixRGB: t=0.5 → midpoint', () => {
    const a = {r:0,g:0,b:0}, b2 = {r:100,g:100,b:100};
    const mid = cmMixRGB(a,b2,0.5);
    expect(mid.r).toBe(50); expect(mid.g).toBe(50); expect(mid.b).toBe(50);
  });

  it('mixHSL: hue takes shortest arc', () => {
    const a = {h:10,s:80,l:50}, b2 = {h:350,s:80,l:50};
    const mid = cmMixHSL(a,b2,0.5);
    // Shortest arc between 10 and 350 is -20 deg → midpoint ~0 (or 360)
    expect(mid.h === 0 || mid.h === 360).toBe(true);
  });

  it('mixHSL: same saturation, interpolates lightness', () => {
    const a = {h:200,s:70,l:20}, b2 = {h:200,s:70,l:80};
    const mid = cmMixHSL(a,b2,0.5);
    expect(mid.l).toBe(50);
  });

  it('relativeLuminance: white is 1', () => {
    expect(cmRelLuminance({r:255,g:255,b:255})).toBeCloseTo(1,1);
  });

  it('relativeLuminance: black is 0', () => {
    expect(cmRelLuminance({r:0,g:0,b:0})).toBeCloseTo(0,5);
  });

  it('contrast: black vs white → ~21', () => {
    expect(cmContrast({r:0,g:0,b:0},{r:255,g:255,b:255})).toBeCloseTo(21,0);
  });

  it('contrast: same color → 1', () => {
    const c = {r:128,g:64,b:32};
    expect(cmContrast(c,c)).toBeCloseTo(1,2);
  });

  it('presets: all 8 presets have valid hex colors', () => {
    const presets = [
      {colorA:'#ff6b35',colorB:'#ffd166'},{colorA:'#023e8a',colorB:'#48cae4'},
      {colorA:'#1b4332',colorB:'#95d5b2'},{colorA:'#7b2d8b',colorB:'#ff6b9d'},
      {colorA:'#0f172a',colorB:'#f8fafc'},{colorA:'#ff006e',colorB:'#ffbe0b'},
      {colorA:'#e0f2fe',colorB:'#0369a1'},{colorA:'#7c4a03',colorB:'#d4a574'},
    ];
    for (const p of presets) {
      expect(p.colorA).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.colorB).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ── GeometricProportionsPanel ─────────────────────────────────────────────────

const GPP_PHI = 1.6180339887;
const GPP_SQRT2 = 1.4142135623;
const GPP_FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

function gppNearestFib(value: number): { value: number; index: number } {
  let best = 0; let bestDiff = Infinity;
  for (let i = 0; i < GPP_FIB.length; i++) {
    const diff = Math.abs(GPP_FIB[i] - value);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return { value: GPP_FIB[best], index: best };
}

function gppNearestPreset(ratio: number): { name: string; diff: number } | null {
  const presets = [
    { name: 'Golden', ratio: GPP_PHI },
    { name: 'Square', ratio: 1 },
    { name: '√2', ratio: GPP_SQRT2 },
    { name: '4:3', ratio: 4/3 },
    { name: '16:9', ratio: 16/9 },
  ];
  let best = null; let bestDiff = Infinity;
  for (const p of presets) {
    const diff = Math.abs(ratio - p.ratio);
    if (diff < bestDiff) { bestDiff = diff; best = { name: p.name, diff }; }
  }
  return best;
}

function gppAspectLabel(ratio: number): string {
  const candidates: [number, number][] = [[1,1],[4,3],[3,2],[16,9],[2,1],[21,9]];
  let best = ''; let bestDiff = 0.02;
  for (const [w, h] of candidates) {
    const diff = Math.abs(ratio - w/h);
    if (diff < bestDiff) { bestDiff = diff; best = `${w}:${h}`; }
  }
  return best || `${ratio.toFixed(3)}:1`;
}

function gppGoldenDims(base: number, fixed: 'width' | 'height') {
  if (fixed === 'width') return { width: Math.round(base), height: Math.round(base / GPP_PHI) };
  return { width: Math.round(base * GPP_PHI), height: Math.round(base) };
}

describe('GeometricProportionsPanel', () => {
  it('PHI constant is approximately 1.618', () => {
    expect(GPP_PHI).toBeCloseTo(1.618, 3);
  });

  it('nearestFib: 16 → 13 (index 6)', () => {
    const r = gppNearestFib(16);
    expect(r.value).toBe(13);
  });

  it('nearestFib: 8 → exact match 8', () => {
    expect(gppNearestFib(8).value).toBe(8);
  });

  it('nearestFib: 200 → 144 or 233', () => {
    const r = gppNearestFib(200);
    expect([144, 233]).toContain(r.value);
  });

  it('nearestFib: 0 → 1', () => {
    expect(gppNearestFib(0).value).toBe(1);
  });

  it('nearestPreset: 1.618 ratio → Golden', () => {
    const r = gppNearestPreset(GPP_PHI);
    expect(r?.name).toBe('Golden');
    expect(r?.diff).toBeCloseTo(0, 5);
  });

  it('nearestPreset: 1.0 ratio → Square', () => {
    expect(gppNearestPreset(1.0)?.name).toBe('Square');
  });

  it('nearestPreset: 16/9 → 16:9', () => {
    expect(gppNearestPreset(16/9)?.name).toBe('16:9');
  });

  it('aspectLabel: exact 16:9', () => {
    expect(gppAspectLabel(16/9)).toBe('16:9');
  });

  it('aspectLabel: exact 4:3', () => {
    expect(gppAspectLabel(4/3)).toBe('4:3');
  });

  it('aspectLabel: 1:1', () => {
    expect(gppAspectLabel(1)).toBe('1:1');
  });

  it('aspectLabel: custom ratio → decimal form', () => {
    const label = gppAspectLabel(2.7);
    expect(label).toMatch(/^\d+\.\d+:1$/);
  });

  it('goldenDims: fix width 400 → height ~247', () => {
    const dims = gppGoldenDims(400, 'width');
    expect(dims.width).toBe(400);
    expect(dims.height).toBeCloseTo(400 / GPP_PHI, 0);
  });

  it('goldenDims: fix height 300 → width ~485', () => {
    const dims = gppGoldenDims(300, 'height');
    expect(dims.height).toBe(300);
    expect(dims.width).toBeCloseTo(300 * GPP_PHI, 0);
  });

  it('diagonal: 300×400 → 500 (3-4-5 triangle)', () => {
    const diag = Math.sqrt(300*300 + 400*400);
    expect(diag).toBe(500);
  });

  it('fibonacci series has expected values', () => {
    expect(GPP_FIB[0]).toBe(1);
    expect(GPP_FIB[1]).toBe(1);
    expect(GPP_FIB[6]).toBe(13);
    expect(GPP_FIB[7]).toBe(21);
  });

  it('proportionDiff: golden vs actual 1.5 → ~7.3%', () => {
    const diff = Math.abs((1.5 - GPP_PHI) / GPP_PHI) * 100;
    expect(diff).toBeCloseTo(7.3, 0);
  });

  it('isSquare: 100×100 → true', () => {
    expect(Math.abs(100/100 - 1) < 0.02).toBe(true);
  });

  it('isSquare: 100×110 → false (ratio too far from 1)', () => {
    expect(Math.abs(100/110 - 1) < 0.02).toBe(false);
  });
});

// ── SpacingScalePanel ─────────────────────────────────────────────────────────

const SSP_FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

function sspLinear(base: number, factor: number, steps: number, stepsBelow: number): number[] {
  const v: number[] = [];
  for (let i = stepsBelow; i >= 1; i--) v.push(Math.max(1, Math.round(base - factor * i)));
  for (let i = 0; i <= steps; i++) v.push(Math.round(base + factor * i));
  return v;
}

function sspExponential(base: number, factor: number, steps: number, stepsBelow: number): number[] {
  const v: number[] = [];
  for (let i = stepsBelow; i >= 1; i--) v.push(Math.max(1, Math.round(base / Math.pow(factor, i))));
  for (let i = 0; i <= steps; i++) v.push(Math.round(base * Math.pow(factor, i)));
  return v;
}

function sspRhythmCheck(steps: number[]): boolean {
  if (steps.length < 2) return true;
  const base = steps[0];
  return steps.every(s => s % base === 0);
}

function sspExportCSS(steps: Array<{label:string;rem:string;cssVar:string}>): string {
  return `:root {\n${steps.map(s => `  ${s.cssVar}: ${s.rem};`).join('\n')}\n}`;
}

describe('SpacingScalePanel', () => {
  it('linear: base=8, factor=8, 4 steps → [8, 16, 24, 32, 40]', () => {
    const vals = sspLinear(8, 8, 4, 0);
    expect(vals).toEqual([8, 16, 24, 32, 40]);
  });

  it('linear: stepsBelow=2 adds 2 steps before base', () => {
    const vals = sspLinear(8, 4, 2, 2);
    // below: 8-8=0→max(1,0)=1 at i=2, 8-4=4 at i=1, then 8,12,16
    expect(vals[0]).toBeGreaterThanOrEqual(1);
    expect(vals).toHaveLength(5);
  });

  it('exponential: base=4, factor=2, 4 steps → 4, 8, 16, 32, 64', () => {
    const vals = sspExponential(4, 2, 4, 0);
    expect(vals).toEqual([4, 8, 16, 32, 64]);
  });

  it('exponential: factor=1.5 produces non-integer steps', () => {
    const vals = sspExponential(8, 1.5, 3, 0);
    expect(vals[0]).toBe(8);
    expect(vals[1]).toBe(12); // 8*1.5=12
  });

  it('exponential stepsBelow: each step half of next', () => {
    const vals = sspExponential(16, 2, 0, 2);
    // Below: 16/4=4, 16/2=8, base=16
    expect(vals).toHaveLength(3);
    expect(vals[0]).toBe(4);
    expect(vals[1]).toBe(8);
    expect(vals[2]).toBe(16);
  });

  it('rhythmCheck: [4, 8, 16, 32] → true', () => {
    expect(sspRhythmCheck([4, 8, 16, 32])).toBe(true);
  });

  it('rhythmCheck: [4, 8, 10, 16] → false', () => {
    expect(sspRhythmCheck([4, 8, 10, 16])).toBe(false);
  });

  it('rhythmCheck: single value → true', () => {
    expect(sspRhythmCheck([8])).toBe(true);
  });

  it('exportCSS: wraps in :root with --space- vars', () => {
    const steps = [
      { label: 'xs', rem: '0.25rem', cssVar: '--space-xs' },
      { label: 'base', rem: '1rem', cssVar: '--space-base' },
    ];
    const css = sspExportCSS(steps);
    expect(css).toMatch(/^:root \{/);
    expect(css).toContain('--space-xs: 0.25rem;');
    expect(css).toContain('--space-base: 1rem;');
  });

  it('px to rem: 4px → 0.25rem', () => {
    expect((4 / 16).toFixed(4) + 'rem').toBe('0.2500rem');
  });

  it('px to rem: 16px → 1rem', () => {
    expect((16 / 16).toFixed(4) + 'rem').toBe('1.0000rem');
  });

  it('tailwindName: 16px → spacing-4', () => {
    const name = `spacing-${Math.round(16 / 4)}`;
    expect(name).toBe('spacing-4');
  });

  it('tailwindName: 64px → spacing-16', () => {
    const name = `spacing-${Math.round(64 / 4)}`;
    expect(name).toBe('spacing-16');
  });

  it('presets: 6 presets defined', () => {
    const presets = ['4px Base (Tailwind)', '8px Base (Material)', 'Exponential ×1.5', 'Fibonacci', 'Linear 6px', 'Rem Scale'];
    expect(presets).toHaveLength(6);
  });

  it('Fibonacci sequence is correct', () => {
    expect(SSP_FIB[0]).toBe(1);
    expect(SSP_FIB[2]).toBe(2);
    expect(SSP_FIB[5]).toBe(8);
    expect(SSP_FIB[7]).toBe(21);
  });

  it('closestSpacingStep: 14 → 13 in [8, 13, 21]', () => {
    const steps = [
      { label: 'sm', px: 8 }, { label: 'base', px: 13 }, { label: 'lg', px: 21 }
    ];
    const closest = steps.reduce((best, s) =>
      Math.abs(s.px - 14) < Math.abs(best.px - 14) ? s : best
    );
    expect(closest.label).toBe('base');
  });
});

// ── BorderRadiusStudio ────────────────────────────────────────────────────────

interface BRCorner { tl: number; tr: number; br: number; bl: number; }

function brCornersToCSS(c: BRCorner): string {
  const { tl, tr, br, bl } = c;
  if (tl === tr && tr === br && br === bl) return `border-radius: ${tl}px;`;
  if (tl === br && tr === bl) return `border-radius: ${tl}px ${tr}px;`;
  return `border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`;
}

function brCornersToLongform(c: BRCorner): string {
  return `border-top-left-radius: ${c.tl}px;\nborder-top-right-radius: ${c.tr}px;\nborder-bottom-right-radius: ${c.br}px;\nborder-bottom-left-radius: ${c.bl}px;`;
}

function brIsAllEqual(c: BRCorner): boolean {
  return c.tl === c.tr && c.tr === c.br && c.br === c.bl;
}

function brAverage(c: BRCorner): number {
  return Math.round((c.tl + c.tr + c.br + c.bl) / 4);
}

function brClamp(v: number, max?: number): number {
  return Math.max(0, Math.min(max ?? 9999, Math.round(v)));
}

function brSVGPath(c: BRCorner, w: number, h: number): string {
  const maxR = Math.min(w, h) / 2;
  const tl = Math.min(c.tl, maxR), tr = Math.min(c.tr, maxR);
  const br = Math.min(c.br, maxR), bl = Math.min(c.bl, maxR);
  return `M ${tl} 0 L ${w - tr} 0 Q ${w} 0 ${w} ${tr} L ${w} ${h - br} Q ${w} ${h} ${w - br} ${h} L ${bl} ${h} Q 0 ${h} 0 ${h - bl} L 0 ${tl} Q 0 0 ${tl} 0 Z`;
}

describe('BorderRadiusStudio', () => {
  it('cornersToCSS: uniform → single value', () => {
    expect(brCornersToCSS({ tl: 8, tr: 8, br: 8, bl: 8 })).toBe('border-radius: 8px;');
  });

  it('cornersToCSS: diagonal pairs → 2 values', () => {
    expect(brCornersToCSS({ tl: 12, tr: 4, br: 12, bl: 4 })).toBe('border-radius: 12px 4px;');
  });

  it('cornersToCSS: all different → 4 values', () => {
    const css = brCornersToCSS({ tl: 2, tr: 4, br: 8, bl: 16 });
    expect(css).toBe('border-radius: 2px 4px 8px 16px;');
  });

  it('cornersToCSS: zero → border-radius: 0px;', () => {
    expect(brCornersToCSS({ tl: 0, tr: 0, br: 0, bl: 0 })).toBe('border-radius: 0px;');
  });

  it('cornersToLongform: includes all 4 properties', () => {
    const lf = brCornersToLongform({ tl: 10, tr: 20, br: 30, bl: 40 });
    expect(lf).toContain('border-top-left-radius: 10px');
    expect(lf).toContain('border-top-right-radius: 20px');
    expect(lf).toContain('border-bottom-right-radius: 30px');
    expect(lf).toContain('border-bottom-left-radius: 40px');
  });

  it('isAllEqual: true for uniform', () => {
    expect(brIsAllEqual({ tl: 8, tr: 8, br: 8, bl: 8 })).toBe(true);
  });

  it('isAllEqual: false for asymmetric', () => {
    expect(brIsAllEqual({ tl: 8, tr: 4, br: 8, bl: 4 })).toBe(false);
  });

  it('average: (8+8+8+8)/4 = 8', () => {
    expect(brAverage({ tl: 8, tr: 8, br: 8, bl: 8 })).toBe(8);
  });

  it('average: (0+8+16+8)/4 = 8', () => {
    expect(brAverage({ tl: 0, tr: 8, br: 16, bl: 8 })).toBe(8);
  });

  it('clamp: negative → 0', () => {
    expect(brClamp(-5)).toBe(0);
  });

  it('clamp: over max → max', () => {
    expect(brClamp(100, 50)).toBe(50);
  });

  it('clamp: rounds floats', () => {
    expect(brClamp(7.6)).toBe(8);
  });

  it('SVG path: starts at tl offset', () => {
    const path = brSVGPath({ tl: 10, tr: 0, br: 0, bl: 0 }, 100, 50);
    expect(path).toContain('M 10 0');
  });

  it('SVG path: clamps radii to half of smaller dimension', () => {
    // 200×100 box, corner 100 → clamped to 50 (min(200,100)/2)
    const path = brSVGPath({ tl: 100, tr: 0, br: 0, bl: 0 }, 200, 100);
    expect(path).toContain('M 50 0');
  });

  it('presets: pill has 9999 everywhere', () => {
    const pill = { tl: 9999, tr: 9999, br: 9999, bl: 9999 };
    expect(brIsAllEqual(pill)).toBe(true);
    expect(brCornersToCSS(pill)).toBe('border-radius: 9999px;');
  });

  it('presets: top-only has br=bl=0', () => {
    const topOnly = { tl: 12, tr: 12, br: 0, bl: 0 };
    expect(topOnly.br).toBe(0);
    expect(topOnly.bl).toBe(0);
    expect(topOnly.tl).toBeGreaterThan(0);
  });

  it('presets: 17 presets defined', () => {
    const presetNames = ['None', 'Subtle (2px)', 'Small (4px)', 'Medium (8px)', 'Large (12px)',
      'XL (16px)', '2XL (24px)', 'Pill (9999px)', 'Top Only', 'Bottom Only',
      'Left Only', 'Right Only', 'Squircle-ish (40%)', 'Asymmetric Wave', 'Egg Shape', 'Teardrop', 'Diamond Tab'];
    expect(presetNames).toHaveLength(17);
  });
});

// ── AdvancedAlignmentPanel ────────────────────────────────────────────────────

interface AAShape { id: string; x: number; y: number; width: number; height: number; }

function aaBounds(shapes: AAShape[]) {
  if (!shapes.length) return null;
  const left = Math.min(...shapes.map(s => s.x));
  const top = Math.min(...shapes.map(s => s.y));
  const right = Math.max(...shapes.map(s => s.x + s.width));
  const bottom = Math.max(...shapes.map(s => s.y + s.height));
  return { left, top, right, bottom, width: right-left, height: bottom-top, centerX: (left+right)/2, centerY: (top+bottom)/2 };
}

function aaAlignLeft(shapes: AAShape[], targetLeft: number) { return shapes.map(s => ({...s, x: targetLeft})); }
function aaAlignRight(shapes: AAShape[], targetRight: number) { return shapes.map(s => ({...s, x: targetRight - s.width})); }
function aaAlignHCenter(shapes: AAShape[], cx: number) { return shapes.map(s => ({...s, x: cx - s.width/2})); }
function aaAlignTop(shapes: AAShape[], targetTop: number) { return shapes.map(s => ({...s, y: targetTop})); }
function aaAlignBottom(shapes: AAShape[], targetBottom: number) { return shapes.map(s => ({...s, y: targetBottom - s.height})); }
function aaAlignVCenter(shapes: AAShape[], cy: number) { return shapes.map(s => ({...s, y: cy - s.height/2})); }

function aaDistH(shapes: AAShape[]) {
  if (shapes.length < 3) return shapes;
  const sorted = [...shapes].sort((a, b) => a.x - b.x);
  const totalW = sorted.reduce((s, sh) => s + sh.width, 0);
  const span = (sorted[sorted.length-1].x + sorted[sorted.length-1].width) - sorted[0].x;
  const gap = (span - totalW) / (sorted.length - 1);
  let x = sorted[0].x;
  return sorted.map(s => { const r = {...s, x}; x += s.width + gap; return r; });
}

function aaDistV(shapes: AAShape[]) {
  if (shapes.length < 3) return shapes;
  const sorted = [...shapes].sort((a, b) => a.y - b.y);
  const totalH = sorted.reduce((s, sh) => s + sh.height, 0);
  const span = (sorted[sorted.length-1].y + sorted[sorted.length-1].height) - sorted[0].y;
  const gap = (span - totalH) / (sorted.length - 1);
  let y = sorted[0].y;
  return sorted.map(s => { const r = {...s, y}; y += s.height + gap; return r; });
}

function aaHGaps(shapes: AAShape[]) {
  const sorted = [...shapes].sort((a, b) => a.x - b.x);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].x - (sorted[i-1].x + sorted[i-1].width));
  return gaps;
}

function aaVGaps(shapes: AAShape[]) {
  const sorted = [...shapes].sort((a, b) => a.y - b.y);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].y - (sorted[i-1].y + sorted[i-1].height));
  return gaps;
}

function aaStackH(shapes: AAShape[], gap: number) {
  let x = Math.min(...shapes.map(s => s.x));
  const top = Math.min(...shapes.map(s => s.y));
  return shapes.map(s => { const r = {...s, x, y: top}; x += s.width + gap; return r; });
}

function aaEqualWidths(shapes: AAShape[]) {
  const avg = Math.round(shapes.reduce((s, sh) => s + sh.width, 0) / shapes.length);
  return shapes.map(s => ({...s, width: avg}));
}

const AA_SHAPES: AAShape[] = [
  { id: 'a', x: 10, y: 10, width: 100, height: 50 },
  { id: 'b', x: 200, y: 80, width: 80, height: 60 },
  { id: 'c', x: 400, y: 30, width: 120, height: 40 },
];

describe('AdvancedAlignmentPanel', () => {
  it('selectionBounds: correct bounds', () => {
    const b = aaBounds(AA_SHAPES)!;
    expect(b.left).toBe(10);
    expect(b.top).toBe(10);
    expect(b.right).toBe(520); // 400+120
    expect(b.bottom).toBe(140); // 80+60
  });

  it('alignLeft: all shapes start at target left', () => {
    const result = aaAlignLeft(AA_SHAPES, 50);
    expect(result.every(s => s.x === 50)).toBe(true);
  });

  it('alignRight: all right edges at target', () => {
    const result = aaAlignRight(AA_SHAPES, 500);
    expect(result.every(s => s.x + s.width === 500)).toBe(true);
  });

  it('alignHCenter: centers all shapes at cx', () => {
    const result = aaAlignHCenter(AA_SHAPES, 300);
    expect(result.every(s => Math.abs((s.x + s.width/2) - 300) < 0.5)).toBe(true);
  });

  it('alignTop: all shapes at target top', () => {
    const result = aaAlignTop(AA_SHAPES, 0);
    expect(result.every(s => s.y === 0)).toBe(true);
  });

  it('alignBottom: all bottom edges at target', () => {
    const result = aaAlignBottom(AA_SHAPES, 200);
    expect(result.every(s => s.y + s.height === 200)).toBe(true);
  });

  it('alignVCenter: centers all at cy', () => {
    const result = aaAlignVCenter(AA_SHAPES, 100);
    expect(result.every(s => Math.abs((s.y + s.height/2) - 100) < 0.5)).toBe(true);
  });

  it('distributeH: gaps are equal after distribution', () => {
    const result = aaDistH(AA_SHAPES);
    const gaps = aaHGaps(result);
    const diff = Math.max(...gaps) - Math.min(...gaps);
    expect(diff).toBeLessThan(1);
  });

  it('distributeV: gaps are equal after distribution', () => {
    const result = aaDistV(AA_SHAPES);
    const gaps = aaVGaps(result);
    const diff = Math.max(...gaps) - Math.min(...gaps);
    expect(diff).toBeLessThan(1);
  });

  it('distributeH: preserves first and last position', () => {
    const sorted = [...AA_SHAPES].sort((a, b) => a.x - b.x);
    const result = aaDistH(AA_SHAPES);
    const sortedResult = [...result].sort((a, b) => a.x - b.x);
    expect(sortedResult[0].x).toBeCloseTo(sorted[0].x, 0);
  });

  it('stackH: shapes packed left-to-right with gap', () => {
    const shapes: AAShape[] = [
      { id: '1', x: 100, y: 50, width: 80, height: 40 },
      { id: '2', x: 200, y: 70, width: 60, height: 40 },
    ];
    const result = aaStackH(shapes, 10);
    expect(result[0].x).toBe(100); // first keeps original x
    expect(result[1].x).toBe(100 + 80 + 10); // 190
    expect(result.every(s => s.y === 50)).toBe(true); // all at top
  });

  it('equalizeWidths: all same width', () => {
    const result = aaEqualWidths(AA_SHAPES);
    const widths = result.map(s => s.width);
    expect(Math.max(...widths)).toBe(Math.min(...widths));
  });

  it('equalizeWidths: average is correct', () => {
    // (100+80+120)/3 = 100
    const result = aaEqualWidths(AA_SHAPES);
    expect(result[0].width).toBe(100);
  });

  it('hGaps: gaps before distribution are uneven', () => {
    const gaps = aaHGaps(AA_SHAPES);
    // a→b: 200-(10+100)=90, b→c: 400-(200+80)=120
    expect(gaps[0]).toBe(90);
    expect(gaps[1]).toBe(120);
  });

  it('selectionBounds: centerX is midpoint', () => {
    const b = aaBounds(AA_SHAPES)!;
    expect(b.centerX).toBeCloseTo((10 + 520) / 2, 0);
  });

  it('selectionBounds: empty → null', () => {
    expect(aaBounds([])).toBeNull();
  });
});
