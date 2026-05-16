/**
 * Parser tests — tailwind-parser, stream-parser, utils
 */

import { describe, it, expect } from 'vitest';
import { parseTailwindClasses, rgbToHex, parseFourSides, parsePx } from '../renderer/lib/tailwind-parser';
import { extractPartialJsx, analyzeStream } from '../renderer/lib/stream-parser';
import { extractJsx, stripJsxBlock, patchTailwindClass } from '../renderer/lib/utils';

// ─── Tailwind parser ──────────────────────────────────────────────────────────

describe('parseTailwindClasses — bucketing', () => {
  it('empty string returns empty buckets', () => {
    const r = parseTailwindClasses('');
    expect(r.layout).toHaveLength(0);
    expect(r.spacing).toHaveLength(0);
    expect(r.typography).toHaveLength(0);
    expect(r.appearance).toHaveLength(0);
    expect(r.other).toHaveLength(0);
  });

  it('layout classes land in layout bucket', () => {
    const r = parseTailwindClasses('flex items-center justify-between w-full h-screen absolute');
    expect(r.layout).toContain('flex');
    expect(r.layout).toContain('items-center');
    expect(r.layout).toContain('justify-between');
    expect(r.layout).toContain('w-full');
    expect(r.layout).toContain('h-screen');
    expect(r.layout).toContain('absolute');
  });

  it('spacing classes land in spacing bucket', () => {
    const r = parseTailwindClasses('p-4 px-6 py-2 mt-8 mb-4 mx-auto ml-2');
    expect(r.spacing).toContain('p-4');
    expect(r.spacing).toContain('px-6');
    expect(r.spacing).toContain('mt-8');
    expect(r.spacing).toContain('mx-auto');
  });

  it('typography classes land in typography bucket', () => {
    const r = parseTailwindClasses('text-lg font-bold italic uppercase leading-tight tracking-wide');
    expect(r.typography).toContain('text-lg');
    expect(r.typography).toContain('font-bold');
    expect(r.typography).toContain('italic');
    expect(r.typography).toContain('uppercase');
  });

  it('appearance classes land in appearance bucket', () => {
    const r = parseTailwindClasses('bg-blue-500 border rounded-lg shadow-md opacity-75');
    expect(r.appearance).toContain('bg-blue-500');
    expect(r.appearance).toContain('border');
    expect(r.appearance).toContain('rounded-lg');
    expect(r.appearance).toContain('shadow-md');
    expect(r.appearance).toContain('opacity-75');
  });

  it('unknown classes land in other bucket', () => {
    // Note: "my-custom-class" starts with "my-" (spacing prefix), so it lands in spacing.
    // Use truly unrecognized class names for the "other" bucket.
    const r = parseTailwindClasses('zz-custom another-unknown');
    expect(r.other).toContain('zz-custom');
    expect(r.other).toContain('another-unknown');
  });

  it('my-* lands in spacing due to "my-" prefix match', () => {
    // The parser correctly categorizes my-* as margin-y spacing
    const r = parseTailwindClasses('my-custom-class');
    expect(r.spacing).toContain('my-custom-class');
  });

  it('variant-prefixed classes are bucketed by base class', () => {
    const r = parseTailwindClasses('hover:bg-blue-500 dark:text-white focus:ring-2');
    expect(r.appearance).toContain('hover:bg-blue-500');
    expect(r.typography).toContain('dark:text-white');
    expect(r.appearance).toContain('focus:ring-2');
  });

  it('mixed class string bucketed correctly', () => {
    const r = parseTailwindClasses('flex flex-col gap-4 p-6 bg-white rounded-xl text-sm font-medium');
    expect(r.layout).toContain('flex');
    expect(r.layout).toContain('flex-col');
    expect(r.layout).toContain('gap-4');
    expect(r.spacing).toContain('p-6');
    expect(r.appearance).toContain('bg-white');
    expect(r.appearance).toContain('rounded-xl');
    expect(r.typography).toContain('text-sm');
    expect(r.typography).toContain('font-medium');
  });

  it('arbitrary value classes are bucketed', () => {
    const r = parseTailwindClasses('w-[320px] h-[200px] text-[14px] bg-[#ff0000]');
    expect(r.layout).toContain('w-[320px]');
    expect(r.layout).toContain('h-[200px]');
    expect(r.typography).toContain('text-[14px]');
    expect(r.appearance).toContain('bg-[#ff0000]');
  });
});

describe('rgbToHex', () => {
  it('converts rgb() to hex', () => {
    expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(rgbToHex('rgb(0, 128, 0)')).toBe('#008000');
    expect(rgbToHex('rgb(0, 0, 255)')).toBe('#0000ff');
  });

  it('converts rgba() to hex (alpha ignored)', () => {
    expect(rgbToHex('rgba(255, 0, 0, 0.5)')).toBe('#ff0000');
  });

  it('handles whitespace variations', () => {
    expect(rgbToHex('rgb(255,0,0)')).toBe('#ff0000');
    expect(rgbToHex('rgb( 255 , 0 , 0 )')).toBe('#ff0000');
  });

  it('passes non-rgb values through unchanged', () => {
    expect(rgbToHex('#ff0000')).toBe('#ff0000');
    expect(rgbToHex('transparent')).toBe('transparent');
  });

  it('pads single-digit hex values', () => {
    expect(rgbToHex('rgb(1, 2, 3)')).toBe('#010203');
  });
});

describe('parseFourSides', () => {
  it('single value expands to all four sides', () => {
    expect(parseFourSides('16px')).toEqual(['16px', '16px', '16px', '16px']);
  });

  it('two values: vertical horizontal', () => {
    expect(parseFourSides('8px 16px')).toEqual(['8px', '16px', '8px', '16px']);
  });

  it('three values: top h-sides bottom', () => {
    expect(parseFourSides('4px 8px 12px')).toEqual(['4px', '8px', '12px', '8px']);
  });

  it('four values: top right bottom left', () => {
    expect(parseFourSides('4px 8px 12px 16px')).toEqual(['4px', '8px', '12px', '16px']);
  });
});

describe('parsePx', () => {
  it('parses integer px', () => expect(parsePx('16px')).toBe(16));
  it('parses float px', () => expect(parsePx('1.5px')).toBe(1.5));
  it('returns 0 for non-numeric', () => expect(parsePx('auto')).toBe(0));
  it('returns 0 for empty string', () => expect(parsePx('')).toBe(0));
});

// ─── Stream parser ────────────────────────────────────────────────────────────

describe('extractPartialJsx', () => {
  it('returns null when no code block', () => {
    expect(extractPartialJsx('Just some text')).toBeNull();
    expect(extractPartialJsx('')).toBeNull();
  });

  it('extracts content from closed jsx block', () => {
    const text = 'Here is code:\n```jsx\nfunction App() { return <div /> }\n```\nDone.';
    expect(extractPartialJsx(text)).toBe('function App() { return <div /> }');
  });

  it('extracts partial content from open block (still streaming)', () => {
    const text = '```jsx\nfunction App() {\n  return <div>';
    const result = extractPartialJsx(text);
    expect(result).toContain('function App()');
    expect(result).toContain('<div>');
  });

  it('handles tsx fence', () => {
    const text = '```tsx\nconst x = 1;\n```';
    expect(extractPartialJsx(text)).toBe('const x = 1;');
  });

  it('handles js fence', () => {
    const text = '```js\nconst y = 2;\n```';
    expect(extractPartialJsx(text)).toBe('const y = 2;');
  });

  it('trims closed block content', () => {
    const text = '```jsx\n\n  function App() {}\n\n```';
    expect(extractPartialJsx(text)).toBe('function App() {}');
  });
});

describe('analyzeStream', () => {
  it('thinking phase when no code block present', () => {
    const r = analyzeStream('Let me think about this...');
    expect(r.phase).toBe('thinking');
    expect(r.partialJsx).toBeNull();
    expect(r.linesWritten).toBe(0);
  });

  it('writing phase when block is open', () => {
    const r = analyzeStream('```jsx\nfunction App() {\n  return <div>');
    expect(r.phase).toBe('writing');
    expect(r.partialJsx).toContain('function App');
    expect(r.linesWritten).toBeGreaterThan(0);
  });

  it('finishing phase when block is closed', () => {
    const r = analyzeStream('```jsx\nfunction App() { return null; }\n```');
    expect(r.phase).toBe('finishing');
    expect(r.partialJsx).toContain('function App');
  });

  it('counts lines correctly', () => {
    const r = analyzeStream('```jsx\nline1\nline2\nline3\n```');
    expect(r.linesWritten).toBe(3);
  });

  it('counts chars correctly', () => {
    const content = 'abc';
    const r = analyzeStream(`\`\`\`jsx\n${content}\n\`\`\``);
    expect(r.charsWritten).toBe(content.length);
  });
});

// ─── Utils ────────────────────────────────────────────────────────────────────

describe('extractJsx', () => {
  it('returns null when no block', () => {
    expect(extractJsx('no code here')).toBeNull();
  });

  it('extracts from closed block', () => {
    expect(extractJsx('```jsx\nconst x = 1;\n```')).toBe('const x = 1;');
  });

  it('returns null for open (unclosed) block', () => {
    expect(extractJsx('```jsx\nconst x = 1;')).toBeNull();
  });
});

describe('stripJsxBlock', () => {
  it('removes code block, leaves surrounding text', () => {
    const text = 'Here is the component:\n```jsx\nfunction App() {}\n```\nLet me know if you have questions.';
    const stripped = stripJsxBlock(text);
    expect(stripped).toContain('Here is the component:');
    expect(stripped).toContain('Let me know');
    expect(stripped).not.toContain('function App');
    expect(stripped).not.toContain('```');
  });

  it('strips multiple code blocks', () => {
    const text = '```jsx\nfoo\n```\nand\n```tsx\nbar\n```';
    const stripped = stripJsxBlock(text);
    expect(stripped).not.toContain('foo');
    expect(stripped).not.toContain('bar');
  });

  it('returns plain text unchanged', () => {
    expect(stripJsxBlock('no code here')).toBe('no code here');
  });
});

describe('patchTailwindClass', () => {
  it('adds a new class', () => {
    const result = patchTailwindClass('text-sm font-bold', 'text-lg');
    expect(result).toContain('text-lg');
    expect(result).not.toContain('text-sm');
  });

  it('replaces conflicting background colors', () => {
    const result = patchTailwindClass('bg-red-500 text-white', 'bg-blue-300');
    expect(result).toContain('bg-blue-300');
    expect(result).not.toContain('bg-red-500');
    expect(result).toContain('text-white'); // preserved
  });

  it('handles empty current classes', () => {
    expect(patchTailwindClass('', 'font-bold')).toBe('font-bold');
  });

  it('replaces padding', () => {
    const result = patchTailwindClass('p-4 m-2', 'p-8');
    expect(result).toContain('p-8');
    expect(result).not.toContain('p-4');
    expect(result).toContain('m-2');
  });

  it('preserves non-conflicting classes', () => {
    const result = patchTailwindClass('flex items-center gap-4', 'justify-between');
    expect(result).toContain('flex');
    expect(result).toContain('items-center');
    expect(result).toContain('gap-4');
    expect(result).toContain('justify-between');
  });
});
