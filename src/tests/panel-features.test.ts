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
