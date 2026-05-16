/**
 * Shape model tests — defaultShape, buildShapeStyle, shapesToJsx
 */

import { describe, it, expect } from 'vitest';
import { defaultShape, buildShapeStyle, shapesToJsx } from '../renderer/lib/shapes';

describe('defaultShape', () => {
  it('rectangle defaults are sensible', () => {
    const s = defaultShape('rectangle', 'r1');
    expect(s.id).toBe('r1');
    expect(s.type).toBe('rectangle');
    expect(s.width).toBe(200);
    expect(s.height).toBe(120);
    expect(s.rotation).toBe(0);
    expect(s.opacity).toBe(1);
    expect(s.fill).toBe('#e2e8f0');
    expect(s.stroke).toBe('transparent');
    expect(s.strokeWidth).toBe(0);
    expect(s.layout).toBe('none');
    expect(s.children).toEqual([]);
  });

  it('frame uses transparent fill and dashed indigo stroke', () => {
    const s = defaultShape('frame', 'f1');
    expect(s.fill).toBe('transparent');
    expect(s.stroke).toBe('#6366f1');
    expect(s.strokeWidth).toBe(1);
  });

  it('ellipse has borderRadius 9999 and square dimensions', () => {
    const s = defaultShape('ellipse', 'e1');
    expect(s.borderRadius).toBe(9999);
    expect(s.width).toBe(120);
    expect(s.height).toBe(120);
  });

  it('text shape has transparent fill and correct typography defaults', () => {
    const s = defaultShape('text', 't1');
    expect(s.fill).toBe('transparent');
    expect(s.stroke).toBe('transparent');
    expect(s.fontSize).toBe(20);
    expect(s.height).toBe(40);
    expect(s.color).toBe('#f0f0f0');
    expect(s.lineHeight).toBe(1.4);
    expect(s.letterSpacing).toBe(0);
    expect(s.textDecoration).toBe('none');
    expect(s.fontStyle).toBe('normal');
  });

  it('every shape type starts with empty children array', () => {
    for (const type of ['frame', 'rectangle', 'ellipse', 'text'] as const) {
      expect(defaultShape(type, 'x').children).toEqual([]);
    }
  });

  it('name matches type (capitalized)', () => {
    expect(defaultShape('rectangle', 'x').name).toBe('Rectangle');
    expect(defaultShape('frame', 'x').name).toBe('Frame');
    expect(defaultShape('ellipse', 'x').name).toBe('Ellipse');
    expect(defaultShape('text', 'x').name).toBe('Text');
  });
});

describe('buildShapeStyle', () => {
  function base(overrides = {}) {
    return { ...defaultShape('rectangle', 'x'), ...overrides };
  }

  it('position is always absolute', () => {
    const style = buildShapeStyle(base()) as Record<string, unknown>;
    expect(style.position).toBe('absolute');
  });

  it('x/y map to left/top', () => {
    const style = buildShapeStyle(base({ x: 42, y: 77 })) as Record<string, unknown>;
    expect(style.left).toBe(42);
    expect(style.top).toBe(77);
  });

  it('rotation produces transform string', () => {
    const style = buildShapeStyle(base({ rotation: 45 })) as Record<string, unknown>;
    expect(style.transform).toBe('rotate(45deg)');
  });

  it('rotation 0 omits transform', () => {
    const style = buildShapeStyle(base({ rotation: 0 })) as Record<string, unknown>;
    expect(style.transform).toBeUndefined();
  });

  it('transparent fill omits backgroundColor', () => {
    const style = buildShapeStyle(base({ fill: 'transparent' })) as Record<string, unknown>;
    expect(style.backgroundColor).toBeUndefined();
  });

  it('solid fill sets backgroundColor', () => {
    const style = buildShapeStyle(base({ fill: '#ff0000' })) as Record<string, unknown>;
    expect(style.backgroundColor).toBe('#ff0000');
  });

  it('fillOpacity < 1 encodes alpha into hex color', () => {
    const style = buildShapeStyle(base({ fill: '#ff0000', fillOpacity: 0.5 })) as Record<string, unknown>;
    // 0.5 * 255 = 127.5 → 128 = 0x80
    expect((style.backgroundColor as string).toLowerCase()).toBe('#ff000080');
  });

  it('ellipse (borderRadius 9999) uses 50% borderRadius', () => {
    const style = buildShapeStyle(base({ borderRadius: 9999 })) as Record<string, unknown>;
    expect(style.borderRadius).toBe('50%');
  });

  it('borderRadius > 0 uses px suffix', () => {
    const style = buildShapeStyle(base({ borderRadius: 12 })) as Record<string, unknown>;
    expect(style.borderRadius).toBe('12px');
  });

  it('borderRadius 0 omits the property', () => {
    const style = buildShapeStyle(base({ borderRadius: 0 })) as Record<string, unknown>;
    expect(style.borderRadius).toBeUndefined();
  });

  it('shadow on adds boxShadow', () => {
    const style = buildShapeStyle(base({
      shadow: true, shadowX: 2, shadowY: 4, shadowBlur: 8, shadowColor: '#000000'
    })) as Record<string, unknown>;
    expect(style.boxShadow).toBe('2px 4px 8px #000000');
  });

  it('shadow off omits boxShadow', () => {
    const style = buildShapeStyle(base({ shadow: false })) as Record<string, unknown>;
    expect(style.boxShadow).toBeUndefined();
  });

  it('frame gets dashed border', () => {
    const s = { ...defaultShape('frame', 'x'), stroke: '#6366f1', strokeWidth: 1 };
    const style = buildShapeStyle(s) as Record<string, unknown>;
    expect(String(style.border)).toContain('dashed');
  });

  it('rectangle gets solid border', () => {
    const s = base({ stroke: '#000000', strokeWidth: 2 });
    const style = buildShapeStyle(s) as Record<string, unknown>;
    expect(String(style.border)).toContain('solid');
    expect(String(style.border)).not.toContain('dashed');
  });

  it('transparent stroke omits border', () => {
    const style = buildShapeStyle(base({ stroke: 'transparent' })) as Record<string, unknown>;
    expect(style.border).toBeUndefined();
  });

  it('text shape adds typography styles', () => {
    const s = { ...defaultShape('text', 'x'), fontSize: 24, fontFamily: 'Georgia', color: '#ff0000' };
    const style = buildShapeStyle(s) as Record<string, unknown>;
    expect(style.fontSize).toBe(24);
    expect(style.fontFamily).toBe('Georgia');
    expect(style.color).toBe('#ff0000');
    expect(style.display).toBe('flex');
    expect(style.userSelect).toBe('none');
  });

  it('non-zero letterSpacing uses em units', () => {
    const s = { ...defaultShape('text', 'x'), letterSpacing: 10 };
    const style = buildShapeStyle(s) as Record<string, unknown>;
    expect(style.letterSpacing).toBe('0.1em');
  });

  it('zero letterSpacing uses "normal"', () => {
    const s = { ...defaultShape('text', 'x'), letterSpacing: 0 };
    const style = buildShapeStyle(s) as Record<string, unknown>;
    expect(style.letterSpacing).toBe('normal');
  });

  it('layout row adds flexbox styles', () => {
    const s = base({ layout: 'row', layoutGap: 16, layoutPaddingH: 12, layoutPaddingV: 8 });
    const style = buildShapeStyle(s) as Record<string, unknown>;
    expect(style.display).toBe('flex');
    expect(style.flexDirection).toBe('row');
    expect(style.gap).toBe(16);
  });

  it('layout column uses column flexDirection', () => {
    const s = base({ layout: 'column' });
    const style = buildShapeStyle(s) as Record<string, unknown>;
    expect(style.flexDirection).toBe('column');
  });

  it('layout none does not add flex', () => {
    const s = base({ layout: 'none' });
    const style = buildShapeStyle(s) as Record<string, unknown>;
    // flex display only added for text (from text branch) or layout
    expect(style.display).toBeUndefined();
  });
});

describe('shapesToJsx', () => {
  it('empty array returns empty string', () => {
    expect(shapesToJsx([])).toBe('');
  });

  it('single shape produces valid JSX string', () => {
    const s = defaultShape('rectangle', 'r1');
    const jsx = shapesToJsx([s]);
    expect(jsx).toContain('function App()');
    expect(jsx).toContain('data-shape-id="r1"');
    // Style is serialized as JSON so keys appear as e.g. position:"absolute"
    expect(jsx).toContain('position');
    expect(jsx).toContain('absolute');
  });

  it('multiple shapes all appear in output', () => {
    const a = defaultShape('rectangle', 'a');
    const b = defaultShape('ellipse', 'b');
    const c = defaultShape('text', 'c');
    const jsx = shapesToJsx([a, b, c]);
    expect(jsx).toContain('data-shape-id="a"');
    expect(jsx).toContain('data-shape-id="b"');
    expect(jsx).toContain('data-shape-id="c"');
  });

  it('text shape renders text content inline', () => {
    const s = { ...defaultShape('text', 't'), text: 'Hello world' };
    const jsx = shapesToJsx([s]);
    expect(jsx).toContain('Hello world');
  });

  it('output is parseable (no syntax errors in string structure)', () => {
    const s = defaultShape('rectangle', 'r1');
    const jsx = shapesToJsx([s]);
    // Should start with function and end with closing brace
    expect(jsx.trim()).toMatch(/^function App\(\)/);
    expect(jsx.trim()).toMatch(/\}$/);
  });
});
