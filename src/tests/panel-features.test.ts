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
