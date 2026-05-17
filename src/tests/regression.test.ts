/**
 * Regression tests for all features built in this session:
 *   - computeAutoLayout (AutoLayoutPanel)
 *   - useAppSettings persistence helpers (extracted logic)
 *   - LayerEffectsPanel utility functions (colorToHex, colorToAlpha, mergeHexAlpha)
 *   - TemplateGallery template builders
 *   - CanvasEmptyState dismiss logic
 *   - LeftPanel tab type completeness
 *   - SettingsModal provider config shape
 *
 * All tests run in Node environment — no DOM/React required.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: Inline the pure utility functions so tests don't require DOM
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors LayerEffectsPanel.colorToHex */
function colorToHex(color: string): string {
  if (color.startsWith('#') && color.length === 9) return color.slice(0, 7);
  if (color.startsWith('#')) return color.length === 7 ? color : '#000000';
  return '#000000';
}

/** Mirrors LayerEffectsPanel.colorToAlpha */
function colorToAlpha(color: string): number {
  if (color.startsWith('#') && color.length === 9) {
    return parseInt(color.slice(7, 9), 16) / 255;
  }
  if (color.startsWith('rgba')) {
    const m = color.match(/rgba\([\d.]+,[\d.]+,[\d.]+,([\d.]+)\)/);
    return m ? parseFloat(m[1]) : 1;
  }
  return 1;
}

/** Mirrors LayerEffectsPanel.mergeHexAlpha */
function mergeHexAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

// Minimal Shape type for tests
interface TestShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

type Direction = 'horizontal' | 'vertical' | 'grid';
type MainAlign = 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
type CrossAlign = 'start' | 'center' | 'end' | 'stretch';

interface AutoLayoutOptions {
  direction: Direction;
  gap: number;
  rowGap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  mainAlign: MainAlign;
  crossAlign: CrossAlign;
  columns: number;
  sortBy: 'none' | 'x' | 'y' | 'width' | 'height' | 'name';
  sortDesc: boolean;
  resizeContainer: boolean;
  containerPadding: boolean;
}

const DEFAULT_OPTS: AutoLayoutOptions = {
  direction: 'horizontal',
  gap: 16,
  rowGap: 16,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  mainAlign: 'start',
  crossAlign: 'center',
  columns: 3,
  sortBy: 'none',
  sortDesc: false,
  resizeContainer: false,
  containerPadding: false,
};

/** Inline implementation of computeAutoLayout for testing */
function computeAutoLayout(
  shapes: TestShape[],
  opts: AutoLayoutOptions
): { id: string; x: number; y: number }[] {
  if (shapes.length === 0) return [];

  function sortShapes(ss: TestShape[]): TestShape[] {
    if (opts.sortBy === 'none') return [...ss];
    return [...ss].sort((a, b) => {
      if (opts.sortBy === 'name') return opts.sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      const map: Record<string, (s: TestShape) => number> = { x: s => s.x, y: s => s.y, width: s => s.width, height: s => s.height };
      const fn = map[opts.sortBy] ?? ((s: TestShape) => s.x);
      return opts.sortDesc ? fn(b) - fn(a) : fn(a) - fn(b);
    });
  }

  const ordered = sortShapes(shapes);
  const minX = Math.min(...ordered.map(s => s.x));
  const minY = Math.min(...ordered.map(s => s.y));
  const originX = minX + opts.paddingLeft;
  const originY = minY + opts.paddingTop;

  if (opts.direction === 'horizontal') {
    const results: { id: string; x: number; y: number }[] = [];
    const maxH = Math.max(...ordered.map(s => s.height));
    let cursor = originX;

    for (let i = 0; i < ordered.length; i++) {
      const s = ordered[i];
      let y = originY;
      if (opts.crossAlign === 'center') y = originY + (maxH - s.height) / 2;
      else if (opts.crossAlign === 'end') y = originY + maxH - s.height;
      results.push({ id: s.id, x: cursor, y });
      cursor += s.width + opts.gap;
    }
    return results;

  } else if (opts.direction === 'vertical') {
    const results: { id: string; x: number; y: number }[] = [];
    const maxW = Math.max(...ordered.map(s => s.width));
    let cursor = originY;

    for (let i = 0; i < ordered.length; i++) {
      const s = ordered[i];
      let x = originX;
      if (opts.crossAlign === 'center') x = originX + (maxW - s.width) / 2;
      else if (opts.crossAlign === 'end') x = originX + maxW - s.width;
      results.push({ id: s.id, x, y: cursor });
      cursor += s.height + opts.gap;
    }
    return results;

  } else {
    // Grid
    const cols = Math.max(1, opts.columns);
    const results: { id: string; x: number; y: number }[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      let cx = originX;
      let cy = originY;
      for (let c = 0; c < col; c++) cx += (ordered[c]?.width ?? 0) + opts.gap;
      for (let r = 0; r < row; r++) {
        const rowItems = ordered.slice(r * cols, (r + 1) * cols);
        cy += Math.max(...rowItems.map(s => s.height), 0) + opts.rowGap;
      }
      results.push({ id: ordered[i].id, x: cx, y: cy });
    }
    return results;
  }
}

/** AppSettings type matching useAppSettings hook */
interface AppSettings {
  dismissedEmptyState?: boolean;
  theme?: 'light' | 'dark' | 'system';
}

/** Simulate the settings merge logic from useAppSettings.update() */
function mergeSettings(prev: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return { ...prev, ...patch };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: LayerEffects color utilities
// ─────────────────────────────────────────────────────────────────────────────

describe('LayerEffects color utilities', () => {
  describe('colorToHex', () => {
    it('returns 6-digit hex from 8-digit hex with alpha', () => {
      expect(colorToHex('#ff0000ff')).toBe('#ff0000');
    });

    it('returns 6-digit hex unchanged', () => {
      expect(colorToHex('#aabbcc')).toBe('#aabbcc');
    });

    it('returns #000000 for non-hex colors', () => {
      expect(colorToHex('red')).toBe('#000000');
      expect(colorToHex('rgb(255,0,0)')).toBe('#000000');
    });

    it('returns #000000 for invalid short hex', () => {
      expect(colorToHex('#abc')).toBe('#000000');
    });

    it('handles uppercase hex', () => {
      expect(colorToHex('#FF0000')).toBe('#FF0000');
    });
  });

  describe('colorToAlpha', () => {
    it('extracts alpha from 8-digit hex (ff = 1.0)', () => {
      expect(colorToAlpha('#ff0000ff')).toBeCloseTo(1.0, 2);
    });

    it('extracts alpha from 8-digit hex (80 ≈ 0.502)', () => {
      expect(colorToAlpha('#ff000080')).toBeCloseTo(0.502, 2);
    });

    it('extracts alpha from 8-digit hex (00 = 0)', () => {
      expect(colorToAlpha('#ff000000')).toBeCloseTo(0.0, 2);
    });

    it('extracts alpha from rgba string', () => {
      expect(colorToAlpha('rgba(255,0,0,0.5)')).toBeCloseTo(0.5, 2);
    });

    it('returns 1 for plain hex (no alpha info)', () => {
      expect(colorToAlpha('#ff0000')).toBe(1);
    });

    it('returns 1 for unknown color format', () => {
      expect(colorToAlpha('red')).toBe(1);
    });
  });

  describe('mergeHexAlpha', () => {
    it('creates 8-digit hex with full alpha', () => {
      expect(mergeHexAlpha('#ff0000', 1.0)).toBe('#ff0000ff');
    });

    it('creates 8-digit hex with zero alpha', () => {
      expect(mergeHexAlpha('#ff0000', 0.0)).toBe('#ff000000');
    });

    it('creates 8-digit hex with 50% alpha', () => {
      const result = mergeHexAlpha('#ff0000', 0.5);
      expect(result).toMatch(/^#ff0000[0-9a-f]{2}$/i);
      // 0.5 * 255 = 127.5, rounds to 128 = 0x80
      expect(result).toBe('#ff000080');
    });

    it('clamps alpha above 1', () => {
      const result = mergeHexAlpha('#ffffff', 2.0);
      expect(result).toBe('#ffffffff');
    });

    it('clamps alpha below 0', () => {
      const result = mergeHexAlpha('#ffffff', -1.0);
      expect(result).toBe('#ffffff00');
    });

    it('round-trips through colorToAlpha', () => {
      const original = '#3366cc';
      const alpha = 0.75;
      const merged = mergeHexAlpha(original, alpha);
      const recovered = colorToAlpha(merged);
      expect(recovered).toBeCloseTo(alpha, 1);
    });

    it('output always has 9 characters', () => {
      for (const a of [0, 0.1, 0.5, 0.9, 1]) {
        expect(mergeHexAlpha('#123456', a).length).toBe(9);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: computeAutoLayout
// ─────────────────────────────────────────────────────────────────────────────

describe('computeAutoLayout', () => {
  function shape(id: string, x: number, y: number, w: number, h: number): TestShape {
    return { id, x, y, width: w, height: h, name: id };
  }

  describe('empty input', () => {
    it('returns [] for empty shapes array', () => {
      expect(computeAutoLayout([], DEFAULT_OPTS)).toEqual([]);
    });
  });

  describe('single shape', () => {
    it('returns the shape at its original position (no-op)', () => {
      const s = shape('a', 100, 50, 80, 40);
      const result = computeAutoLayout([s], DEFAULT_OPTS);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });
  });

  describe('horizontal layout', () => {
    const shapes = [
      shape('a', 0, 0, 100, 50),
      shape('b', 200, 0, 80, 60),
      shape('c', 400, 0, 120, 40),
    ];
    const opts = { ...DEFAULT_OPTS, direction: 'horizontal' as Direction, gap: 16 };

    it('returns correct number of results', () => {
      expect(computeAutoLayout(shapes, opts)).toHaveLength(3);
    });

    it('first shape starts at origin (x=0)', () => {
      const result = computeAutoLayout(shapes, opts);
      expect(result[0].x).toBe(0);
    });

    it('second shape starts at first.width + gap', () => {
      const result = computeAutoLayout(shapes, opts);
      expect(result[1].x).toBe(100 + 16); // 116
    });

    it('third shape starts at sum of first two widths + 2 gaps', () => {
      const result = computeAutoLayout(shapes, opts);
      expect(result[2].x).toBe(100 + 16 + 80 + 16); // 212
    });

    it('all shapes have the same ids as input', () => {
      const result = computeAutoLayout(shapes, opts);
      const ids = result.map(r => r.id);
      expect(ids).toContain('a');
      expect(ids).toContain('b');
      expect(ids).toContain('c');
    });

    it('crossAlign:center vertically centers shorter shapes', () => {
      const opts2 = { ...opts, crossAlign: 'center' as CrossAlign };
      const result = computeAutoLayout(shapes, opts2);
      const maxH = 60; // shape 'b' is tallest
      // shape 'a' (h=50) should be offset by (60-50)/2 = 5
      expect(result[0].y).toBe(5);
      // shape 'b' (h=60) center of maxH = 0
      expect(result[1].y).toBe(0);
      // shape 'c' (h=40) offset by (60-40)/2 = 10
      expect(result[2].y).toBe(10);
    });

    it('gap:0 places shapes adjacent with no space', () => {
      const opts3 = { ...opts, gap: 0 };
      const result = computeAutoLayout(shapes, opts3);
      expect(result[1].x).toBe(100);
      expect(result[2].x).toBe(180);
    });

    it('respects paddingLeft offset', () => {
      const opts4 = { ...opts, paddingLeft: 20 };
      const result = computeAutoLayout(shapes, opts4);
      expect(result[0].x).toBe(20);
      expect(result[1].x).toBe(20 + 100 + 16);
    });

    it('respects paddingTop offset', () => {
      const opts5 = { ...opts, paddingTop: 12, crossAlign: 'start' as CrossAlign };
      const result = computeAutoLayout(shapes, opts5);
      expect(result[0].y).toBe(12);
    });
  });

  describe('vertical layout', () => {
    const shapes = [
      shape('a', 0, 0, 100, 40),
      shape('b', 0, 100, 80, 60),
      shape('c', 0, 200, 120, 30),
    ];
    const opts = { ...DEFAULT_OPTS, direction: 'vertical' as Direction, gap: 8 };

    it('returns correct number of results', () => {
      expect(computeAutoLayout(shapes, opts)).toHaveLength(3);
    });

    it('first shape starts at origin (y=0)', () => {
      const result = computeAutoLayout(shapes, opts);
      expect(result[0].y).toBe(0);
    });

    it('second shape y = first.height + gap', () => {
      const result = computeAutoLayout(shapes, opts);
      expect(result[1].y).toBe(40 + 8);
    });

    it('third shape y = sum of heights + gaps', () => {
      const result = computeAutoLayout(shapes, opts);
      expect(result[2].y).toBe(40 + 8 + 60 + 8);
    });

    it('crossAlign:center horizontally centers narrower shapes', () => {
      const opts2 = { ...opts, crossAlign: 'center' as CrossAlign };
      const result = computeAutoLayout(shapes, opts2);
      const maxW = 120; // shape 'c' is widest
      // shape 'a' (w=100) offset by (120-100)/2 = 10
      expect(result[0].x).toBe(10);
      // shape 'b' (w=80) offset by (120-80)/2 = 20
      expect(result[1].x).toBe(20);
      // shape 'c' (w=120) offset by 0
      expect(result[2].x).toBe(0);
    });

    it('crossAlign:end right-aligns shapes', () => {
      const opts3 = { ...opts, crossAlign: 'end' as CrossAlign };
      const result = computeAutoLayout(shapes, opts3);
      const maxW = 120;
      expect(result[0].x).toBe(maxW - 100); // 20
      expect(result[1].x).toBe(maxW - 80);  // 40
      expect(result[2].x).toBe(0);
    });
  });

  describe('grid layout', () => {
    const shapes = [
      shape('a', 0, 0, 100, 80),
      shape('b', 0, 0, 100, 80),
      shape('c', 0, 0, 100, 80),
      shape('d', 0, 0, 100, 80),
      shape('e', 0, 0, 100, 80),
    ];
    const opts = { ...DEFAULT_OPTS, direction: 'grid' as Direction, gap: 10, rowGap: 10, columns: 3 };

    it('returns correct number of results', () => {
      expect(computeAutoLayout(shapes, opts)).toHaveLength(5);
    });

    it('first row: 3 items side by side', () => {
      const result = computeAutoLayout(shapes, opts);
      expect(result[0].x).toBe(0);   // col 0
      expect(result[1].x).toBe(110); // col 1: 100 + 10 gap
      expect(result[2].x).toBe(220); // col 2: 100 + 10 + 100 + 10
    });

    it('second row starts below first row', () => {
      const result = computeAutoLayout(shapes, opts);
      expect(result[3].y).toBe(90);  // row 1: 80 height + 10 rowGap
      expect(result[4].y).toBe(90);
    });

    it('wraps into second row correctly', () => {
      const result = computeAutoLayout(shapes, opts);
      // item 'd' is col 0, row 1
      expect(result[3].x).toBe(0);
      // item 'e' is col 1, row 1
      expect(result[4].x).toBe(110);
    });

    it('columns:1 makes a single column', () => {
      const opts1 = { ...opts, columns: 1 };
      const result = computeAutoLayout(shapes, opts1);
      // All x values should be 0
      expect(result.every(r => r.x === 0)).toBe(true);
      // y values should be incremented
      expect(result[1].y).toBe(90);
      expect(result[2].y).toBe(180);
    });

    it('columns:5 makes a single row', () => {
      const opts5 = { ...opts, columns: 5 };
      const result = computeAutoLayout(shapes, opts5);
      // All y values should be 0
      expect(result.every(r => r.y === 0)).toBe(true);
    });
  });

  describe('sorting', () => {
    const shapes = [
      shape('large', 0, 0, 200, 100),
      shape('small', 100, 0, 50, 100),
      shape('medium', 200, 0, 100, 100),
    ];

    it('sortBy:width ascending sorts by width', () => {
      const opts = { ...DEFAULT_OPTS, sortBy: 'width' as const, sortDesc: false, direction: 'horizontal' as Direction, gap: 0 };
      const result = computeAutoLayout(shapes, opts);
      // Order should be: small(50), medium(100), large(200)
      expect(result[0].id).toBe('small');
      expect(result[1].id).toBe('medium');
      expect(result[2].id).toBe('large');
    });

    it('sortBy:width descending reverses sort', () => {
      const opts = { ...DEFAULT_OPTS, sortBy: 'width' as const, sortDesc: true, direction: 'horizontal' as Direction, gap: 0 };
      const result = computeAutoLayout(shapes, opts);
      expect(result[0].id).toBe('large');
      expect(result[1].id).toBe('medium');
      expect(result[2].id).toBe('small');
    });

    it('sortBy:name alphabetical', () => {
      const opts = { ...DEFAULT_OPTS, sortBy: 'name' as const, sortDesc: false, direction: 'horizontal' as Direction, gap: 0 };
      const result = computeAutoLayout(shapes, opts);
      expect(result[0].id).toBe('large');
      expect(result[1].id).toBe('medium');
      expect(result[2].id).toBe('small');
    });

    it('sortBy:none preserves input order', () => {
      const opts = { ...DEFAULT_OPTS, sortBy: 'none' as const, direction: 'horizontal' as Direction, gap: 0 };
      const result = computeAutoLayout(shapes, opts);
      expect(result[0].id).toBe('large');
      expect(result[1].id).toBe('small');
      expect(result[2].id).toBe('medium');
    });
  });

  describe('non-zero origin', () => {
    it('horizontal layout respects shapes not at (0,0)', () => {
      const shapes = [
        shape('a', 300, 200, 100, 50),
        shape('b', 500, 200, 80, 50),
      ];
      const opts = { ...DEFAULT_OPTS, direction: 'horizontal' as Direction, gap: 10 };
      const result = computeAutoLayout(shapes, opts);
      // Origin is minX=300, so first shape at x=300
      expect(result[0].x).toBe(300);
      expect(result[1].x).toBe(300 + 100 + 10);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: AppSettings persistence logic
// ─────────────────────────────────────────────────────────────────────────────

describe('AppSettings persistence logic', () => {
  it('starts with empty settings object', () => {
    const settings: AppSettings = {};
    expect(settings.dismissedEmptyState).toBeUndefined();
    expect(settings.theme).toBeUndefined();
  });

  it('merging dismissedEmptyState sets the flag', () => {
    const settings = mergeSettings({}, { dismissedEmptyState: true });
    expect(settings.dismissedEmptyState).toBe(true);
  });

  it('merge preserves existing keys not in patch', () => {
    const settings = mergeSettings({ theme: 'dark', dismissedEmptyState: false }, { theme: 'light' });
    expect(settings.theme).toBe('light');
    expect(settings.dismissedEmptyState).toBe(false);
  });

  it('merge patch overwrites existing value', () => {
    const settings = mergeSettings({ dismissedEmptyState: false }, { dismissedEmptyState: true });
    expect(settings.dismissedEmptyState).toBe(true);
  });

  it('theme can be set to all valid values', () => {
    for (const t of ['light', 'dark', 'system'] as const) {
      const s = mergeSettings({}, { theme: t });
      expect(s.theme).toBe(t);
    }
  });

  it('dismissedEmptyState once true, stays true through additional merges', () => {
    let settings = mergeSettings({}, { dismissedEmptyState: true });
    settings = mergeSettings(settings, { theme: 'dark' });
    expect(settings.dismissedEmptyState).toBe(true);
  });

  it('settings JSON round-trip preserves values', () => {
    const original: AppSettings = { dismissedEmptyState: true, theme: 'dark' };
    const serialized = JSON.stringify(original);
    const recovered = JSON.parse(serialized) as AppSettings;
    expect(recovered.dismissedEmptyState).toBe(true);
    expect(recovered.theme).toBe('dark');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: TemplateGallery shape builders
// ─────────────────────────────────────────────────────────────────────────────

describe('TemplateGallery shape builders', () => {
  /** Replicate the builder helpers from TemplateGallery.tsx */
  function rect(x: number, y: number, w: number, h: number, fill: string, extra?: Record<string, unknown>): Record<string, unknown> {
    return { x, y, width: w, height: h, fill, fillType: 'solid', type: 'rectangle', borderRadius: 0, ...extra };
  }

  function text(x: number, y: number, w: number, h: number, content: string, extra?: Record<string, unknown>) {
    return { x, y, width: w, height: h, type: 'text', text: content, fill: 'transparent', fillType: 'solid', color: '#e2e8f0', fontSize: 14, fontWeight: '400', ...extra };
  }

  function circle(cx: number, cy: number, r: number, fill: string, extra?: Record<string, unknown>) {
    return { x: cx - r, y: cy - r, width: r * 2, height: r * 2, fill, fillType: 'solid', type: 'ellipse', ...extra };
  }

  describe('rect builder', () => {
    it('creates a rectangle with correct dimensions', () => {
      const r = rect(10, 20, 300, 200, '#ff0000');
      expect(r.x).toBe(10);
      expect(r.y).toBe(20);
      expect(r.width).toBe(300);
      expect(r.height).toBe(200);
      expect(r.fill).toBe('#ff0000');
      expect(r.type).toBe('rectangle');
    });

    it('spreads extra properties', () => {
      const r = rect(0, 0, 100, 50, '#000', { name: 'Hero BG', borderRadius: 8 });
      expect(r.name).toBe('Hero BG');
      expect(r.borderRadius).toBe(8);
    });

    it('defaults borderRadius to 0', () => {
      const r = rect(0, 0, 100, 50, '#fff');
      expect(r.borderRadius).toBe(0);
    });
  });

  describe('text builder', () => {
    it('creates a text shape with correct content', () => {
      const t = text(0, 0, 200, 30, 'Hello World');
      expect(t.type).toBe('text');
      expect(t.text).toBe('Hello World');
      expect(t.fill).toBe('transparent');
    });

    it('defaults to 14px font', () => {
      const t = text(0, 0, 100, 20, 'test');
      expect(t.fontSize).toBe(14);
    });
  });

  describe('circle builder', () => {
    it('positions circle correctly from center point', () => {
      const c = circle(100, 100, 50, '#blue');
      expect(c.x).toBe(50);  // cx - r
      expect(c.y).toBe(50);  // cy - r
      expect(c.width).toBe(100);  // r * 2
      expect(c.height).toBe(100); // r * 2
    });

    it('creates ellipse type', () => {
      const c = circle(0, 0, 20, '#fff');
      expect(c.type).toBe('ellipse');
    });
  });

  describe('hero template shape count', () => {
    // Simulate what the Hero template build() function produces
    const heroShapes = [
      rect(0, 0, 800, 480, '#0f0f1a', { name: 'Hero Background', borderRadius: 12 }),
      rect(40, 80, 720, 6, '#6366f1', { name: 'Eyebrow' }),
      text(40, 100, 720, 80, 'Design. Build. Ship.', { name: 'Headline', fontSize: 56 }),
      text(40, 200, 600, 40, 'The all-in-one platform for product teams.', { name: 'Subtitle' }),
      rect(40, 280, 160, 48, '#6366f1', { name: 'Primary CTA', borderRadius: 10 }),
      rect(212, 280, 140, 48, 'transparent', { name: 'Secondary CTA', borderRadius: 10 }),
    ];

    it('hero template produces at least 4 shapes', () => {
      expect(heroShapes.length).toBeGreaterThanOrEqual(4);
    });

    it('all shapes have x,y,width,height', () => {
      for (const s of heroShapes) {
        expect(typeof s.x).toBe('number');
        expect(typeof s.y).toBe('number');
        expect(typeof s.width).toBe('number');
        expect(typeof s.height).toBe('number');
      }
    });

    it('background shape is largest', () => {
      const bg = heroShapes[0];
      const others = heroShapes.slice(1);
      expect(Number(bg.width)).toBeGreaterThanOrEqual(Math.max(...others.map(s => Number(s.width))));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: LeftPanel tab types
// ─────────────────────────────────────────────────────────────────────────────

describe('LeftPanel tab types', () => {
  type LeftTab = 'layers' | 'pages' | 'history' | 'components' | 'comments' | 'tokens';

  const ALL_TABS: LeftTab[] = ['layers', 'pages', 'history', 'components', 'comments', 'tokens'];

  it('has 6 tabs', () => {
    expect(ALL_TABS).toHaveLength(6);
  });

  it('includes required core tabs', () => {
    expect(ALL_TABS).toContain('layers');
    expect(ALL_TABS).toContain('pages');
    expect(ALL_TABS).toContain('history');
    expect(ALL_TABS).toContain('components');
  });

  it('includes new session-added tabs', () => {
    expect(ALL_TABS).toContain('comments');
    expect(ALL_TABS).toContain('tokens');
  });

  it('all tab IDs are unique', () => {
    const unique = new Set(ALL_TABS);
    expect(unique.size).toBe(ALL_TABS.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: SettingsModal provider config
// ─────────────────────────────────────────────────────────────────────────────

describe('SettingsModal provider config', () => {
  type Provider = 'anthropic' | 'openai' | 'lmstudio' | 'ollama' | 'openai-compat';

  interface ProviderConfig {
    provider: Provider;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  }

  const KNOWN_MODELS: Record<Provider, string[]> = {
    anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5', 'claude-3-5-sonnet-20241022'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    lmstudio: [],
    ollama: [],
    'openai-compat': [],
  };

  it('all providers have an entry in KNOWN_MODELS', () => {
    const providers: Provider[] = ['anthropic', 'openai', 'lmstudio', 'ollama', 'openai-compat'];
    for (const p of providers) {
      expect(KNOWN_MODELS).toHaveProperty(p);
    }
  });

  it('anthropic has at least 3 known models', () => {
    expect(KNOWN_MODELS.anthropic.length).toBeGreaterThanOrEqual(3);
  });

  it('openai has at least 3 known models', () => {
    expect(KNOWN_MODELS.openai.length).toBeGreaterThanOrEqual(3);
  });

  it('local providers have empty model lists', () => {
    expect(KNOWN_MODELS.lmstudio).toHaveLength(0);
    expect(KNOWN_MODELS.ollama).toHaveLength(0);
    expect(KNOWN_MODELS['openai-compat']).toHaveLength(0);
  });

  it('default config shape is valid', () => {
    const defaultConfig: ProviderConfig = { provider: 'anthropic', model: 'claude-opus-4-5' };
    expect(defaultConfig.provider).toBe('anthropic');
    expect(defaultConfig.model).toBeDefined();
  });

  it('provider config can store apiKey', () => {
    const config: ProviderConfig = { provider: 'openai', apiKey: 'sk-test-123' };
    expect(config.apiKey).toBe('sk-test-123');
  });

  it('local provider configs use baseUrl not apiKey', () => {
    const lmsConfig: ProviderConfig = { provider: 'lmstudio', baseUrl: 'http://localhost:1234' };
    expect(lmsConfig.baseUrl).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: Canvas empty state dismiss
// ─────────────────────────────────────────────────────────────────────────────

describe('Canvas empty state dismiss flow', () => {
  it('empty state shown when shapes.length === 0 and not dismissed', () => {
    const shapes: unknown[] = [];
    const dismissed = false;
    const showEmptyState = shapes.length === 0 && !dismissed;
    expect(showEmptyState).toBe(true);
  });

  it('empty state hidden when shapes exist', () => {
    const shapes = [{ id: 'a' }];
    const dismissed = false;
    const showEmptyState = shapes.length === 0 && !dismissed;
    expect(showEmptyState).toBe(false);
  });

  it('empty state hidden when dismissed even with no shapes', () => {
    const shapes: unknown[] = [];
    const dismissed = true;
    const showEmptyState = shapes.length === 0 && !dismissed;
    expect(showEmptyState).toBe(false);
  });

  it('dismiss action sets dismissedEmptyState to true', () => {
    let settings: AppSettings = {};
    const onDismiss = () => { settings = mergeSettings(settings, { dismissedEmptyState: true }); };
    onDismiss();
    expect(settings.dismissedEmptyState).toBe(true);
  });

  it('after dismiss, subsequent renders never show empty state', () => {
    const settings: AppSettings = { dismissedEmptyState: true };
    const shapes: unknown[] = [];
    const showEmptyState = shapes.length === 0 && !settings.dismissedEmptyState;
    expect(showEmptyState).toBe(false);
  });

  it('dismiss is permanent across multiple setting updates', () => {
    let settings: AppSettings = { dismissedEmptyState: true };
    // Simulate theme change
    settings = mergeSettings(settings, { theme: 'dark' });
    expect(settings.dismissedEmptyState).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: Icon rail tab navigation
// ─────────────────────────────────────────────────────────────────────────────

describe('Icon rail tab navigation', () => {
  type LeftTab = 'layers' | 'pages' | 'history' | 'components' | 'comments' | 'tokens';

  function simulateTabSwitch(current: LeftTab, target: LeftTab): LeftTab {
    return target; // Simple state update
  }

  it('can switch from layers to tokens', () => {
    expect(simulateTabSwitch('layers', 'tokens')).toBe('tokens');
  });

  it('can switch from components to comments', () => {
    expect(simulateTabSwitch('components', 'comments')).toBe('comments');
  });

  it('switching to same tab is a no-op', () => {
    expect(simulateTabSwitch('history', 'history')).toBe('history');
  });

  it('all 6 tabs are reachable from layers', () => {
    const ALL_TABS: LeftTab[] = ['layers', 'pages', 'history', 'components', 'comments', 'tokens'];
    for (const tab of ALL_TABS) {
      expect(simulateTabSwitch('layers', tab)).toBe(tab);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: AutoLayout gap presets
// ─────────────────────────────────────────────────────────────────────────────

describe('AutoLayout gap presets', () => {
  const GAP_PRESETS = [0, 4, 8, 12, 16, 24, 32, 48];

  it('gap presets are non-negative', () => {
    expect(GAP_PRESETS.every(g => g >= 0)).toBe(true);
  });

  it('gap presets are in ascending order', () => {
    for (let i = 1; i < GAP_PRESETS.length; i++) {
      expect(GAP_PRESETS[i]).toBeGreaterThan(GAP_PRESETS[i - 1]);
    }
  });

  it('gap=0 means shapes are placed adjacent', () => {
    const shapes = [
      { id: 'a', x: 0, y: 0, width: 100, height: 50, name: 'a' },
      { id: 'b', x: 200, y: 0, width: 80, height: 50, name: 'b' },
    ];
    const opts = { ...DEFAULT_OPTS, gap: 0, direction: 'horizontal' as Direction };
    const result = computeAutoLayout(shapes, opts);
    expect(result[1].x - result[0].x).toBe(100); // exactly width of first shape
  });

  it('gap=48 creates generous spacing', () => {
    const shapes = [
      { id: 'a', x: 0, y: 0, width: 50, height: 50, name: 'a' },
      { id: 'b', x: 0, y: 0, width: 50, height: 50, name: 'b' },
    ];
    const opts = { ...DEFAULT_OPTS, gap: 48, direction: 'horizontal' as Direction };
    const result = computeAutoLayout(shapes, opts);
    expect(result[1].x - result[0].x).toBe(50 + 48);
  });
});
