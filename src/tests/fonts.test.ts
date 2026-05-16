/**
 * Google Fonts catalog and font-picker logic tests
 */

import { describe, it, expect } from 'vitest';
import { GOOGLE_FONTS, SYSTEM_FONTS, CATEGORY_LABELS } from '../renderer/lib/googleFonts';

describe('GOOGLE_FONTS catalog', () => {
  it('has entries', () => {
    expect(GOOGLE_FONTS.length).toBeGreaterThan(0);
  });

  it('every entry has a family and a valid category', () => {
    const validCategories = new Set(['sans-serif', 'serif', 'monospace', 'display', 'handwriting']);
    for (const font of GOOGLE_FONTS) {
      expect(font.family).toBeTruthy();
      expect(validCategories.has(font.category)).toBe(true);
    }
  });

  it('contains well-known popular fonts', () => {
    const families = GOOGLE_FONTS.map(f => f.family);
    expect(families).toContain('Roboto');
    expect(families).toContain('Inter');
    expect(families).toContain('Open Sans');
    expect(families).toContain('Montserrat');
    expect(families).toContain('Merriweather');
    expect(families).toContain('Fira Code');
    expect(families).toContain('Oswald');
    expect(families).toContain('Dancing Script');
  });

  it('all categories have at least one font', () => {
    const seen = new Set(GOOGLE_FONTS.map(f => f.category));
    expect(seen.has('sans-serif')).toBe(true);
    expect(seen.has('serif')).toBe(true);
    expect(seen.has('monospace')).toBe(true);
    expect(seen.has('display')).toBe(true);
    expect(seen.has('handwriting')).toBe(true);
  });

  it('no duplicate family names', () => {
    const names = GOOGLE_FONTS.map(f => f.family);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

describe('SYSTEM_FONTS', () => {
  it('has at least a few system fonts', () => {
    expect(SYSTEM_FONTS.length).toBeGreaterThan(0);
  });

  it('every entry has family and stack', () => {
    for (const font of SYSTEM_FONTS) {
      expect(font.family).toBeTruthy();
      expect(font.stack).toBeTruthy();
    }
  });

  it('Inter is in system fonts (primary UI font)', () => {
    expect(SYSTEM_FONTS.some(f => f.family === 'Inter')).toBe(true);
  });
});

describe('CATEGORY_LABELS', () => {
  it('has a label for every category', () => {
    const categories = ['sans-serif', 'serif', 'monospace', 'display', 'handwriting'] as const;
    for (const cat of categories) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it('labels are human-readable strings', () => {
    expect(CATEGORY_LABELS['sans-serif']).toBe('Sans Serif');
    expect(CATEGORY_LABELS['monospace']).toBe('Monospace');
  });
});

describe('Font search logic (simulated)', () => {
  function searchFonts(query: string) {
    const q = query.toLowerCase().trim();
    if (!q) return GOOGLE_FONTS;
    return GOOGLE_FONTS.filter(f => f.family.toLowerCase().includes(q));
  }

  it('empty query returns all fonts', () => {
    expect(searchFonts('').length).toBe(GOOGLE_FONTS.length);
  });

  it('exact match returns that font', () => {
    const result = searchFonts('Roboto');
    expect(result.some(f => f.family === 'Roboto')).toBe(true);
  });

  it('partial match works case-insensitively', () => {
    const result = searchFonts('sans');
    expect(result.some(f => f.family.toLowerCase().includes('sans'))).toBe(true);
  });

  it('no match returns empty array', () => {
    expect(searchFonts('xyzzy_not_a_font_zzyxq')).toHaveLength(0);
  });

  it('category filter works', () => {
    const monospace = GOOGLE_FONTS.filter(f => f.category === 'monospace');
    expect(monospace.every(f => f.category === 'monospace')).toBe(true);
    expect(monospace.length).toBeGreaterThan(0);
  });
});
