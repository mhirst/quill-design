/**
 * ColorSchemePanel — Apply full color schemes to your design.
 *
 * Curated palettes: each scheme has 6 semantic roles:
 *   background, surface, border, primary, accent, text
 *
 * When applied, shapes are re-mapped based on their closest
 * matching role in the current scheme.
 *
 * Open via command palette → "Apply color scheme"
 * Shortcut: ⌘⇧C
 */

import { useState, useMemo, useCallback } from 'react';
import { X, Check, Palette } from 'lucide-react';
import type { Shape } from '../../lib/shapes';

// ── Color scheme definition ───────────────────────────────────────────────────

interface ColorScheme {
  id: string;
  name: string;
  category: 'dark' | 'light' | 'colorful' | 'pastel';
  description: string;
  colors: {
    background: string;
    surface: string;
    border: string;
    primary: string;
    accent: string;
    text: string;
    muted: string;
  };
}

const SCHEMES: ColorScheme[] = [
  // ── Dark themes ────────────────────────────────────────────────────────────
  {
    id: 'dark-indigo',
    name: 'Midnight Indigo',
    category: 'dark',
    description: 'Deep dark with indigo accents',
    colors: { background: '#0f0f1a', surface: '#1a1a2e', border: '#2e2e4a', primary: '#6366f1', accent: '#a855f7', text: '#f1f5f9', muted: '#94a3b8' },
  },
  {
    id: 'dark-emerald',
    name: 'Dark Forest',
    category: 'dark',
    description: 'Dark theme with emerald accents',
    colors: { background: '#0a0f0d', surface: '#111b14', border: '#1f3028', primary: '#10b981', accent: '#34d399', text: '#f0fdf4', muted: '#86efac' },
  },
  {
    id: 'dark-rose',
    name: 'Dark Rose',
    category: 'dark',
    description: 'Sophisticated dark with rose tones',
    colors: { background: '#0f0a0c', surface: '#1a1014', border: '#2e1a20', primary: '#f43f5e', accent: '#fb7185', text: '#fff1f2', muted: '#fda4af' },
  },
  {
    id: 'dark-amber',
    name: 'Dark Amber',
    category: 'dark',
    description: 'Warm dark with amber highlights',
    colors: { background: '#0f0c06', surface: '#1a1508', border: '#2e240d', primary: '#f59e0b', accent: '#fbbf24', text: '#fffbeb', muted: '#fde68a' },
  },
  {
    id: 'dark-slate',
    name: 'Obsidian',
    category: 'dark',
    description: 'Pure dark slate design',
    colors: { background: '#020617', surface: '#0f172a', border: '#1e293b', primary: '#818cf8', accent: '#93c5fd', text: '#e2e8f0', muted: '#94a3b8' },
  },
  {
    id: 'dark-teal',
    name: 'Cyber Teal',
    category: 'dark',
    description: 'Dark with cyan/teal accents',
    colors: { background: '#030a0a', surface: '#071518', border: '#0d2a2e', primary: '#06b6d4', accent: '#22d3ee', text: '#ecfeff', muted: '#67e8f9' },
  },

  // ── Light themes ───────────────────────────────────────────────────────────
  {
    id: 'light-clean',
    name: 'Clean White',
    category: 'light',
    description: 'Minimal clean white design',
    colors: { background: '#ffffff', surface: '#f8fafc', border: '#e2e8f0', primary: '#6366f1', accent: '#8b5cf6', text: '#1e293b', muted: '#64748b' },
  },
  {
    id: 'light-warm',
    name: 'Warm Cream',
    category: 'light',
    description: 'Warm off-white with earthy tones',
    colors: { background: '#fafaf8', surface: '#f5f0eb', border: '#e5ddd5', primary: '#b45309', accent: '#d97706', text: '#1c1917', muted: '#78716c' },
  },
  {
    id: 'light-blue',
    name: 'Sky Blue',
    category: 'light',
    description: 'Light with cool blue tones',
    colors: { background: '#f0f9ff', surface: '#e0f2fe', border: '#bae6fd', primary: '#0284c7', accent: '#0ea5e9', text: '#0c4a6e', muted: '#38bdf8' },
  },
  {
    id: 'light-green',
    name: 'Fresh Mint',
    category: 'light',
    description: 'Light with green/mint accents',
    colors: { background: '#f0fdf4', surface: '#dcfce7', border: '#bbf7d0', primary: '#16a34a', accent: '#22c55e', text: '#14532d', muted: '#4ade80' },
  },

  // ── Colorful themes ────────────────────────────────────────────────────────
  {
    id: 'colorful-neon',
    name: 'Neon Night',
    category: 'colorful',
    description: 'Bold neon colors on dark',
    colors: { background: '#0a0014', surface: '#14001e', border: '#2a004a', primary: '#d946ef', accent: '#22d3ee', text: '#f5f3ff', muted: '#c4b5fd' },
  },
  {
    id: 'colorful-coral',
    name: 'Tropical Coral',
    category: 'colorful',
    description: 'Vibrant coral and teal',
    colors: { background: '#fff7f5', surface: '#ffe4de', border: '#ffc9bf', primary: '#ef4444', accent: '#14b8a6', text: '#1c0a08', muted: '#f87171' },
  },
  {
    id: 'colorful-grape',
    name: 'Electric Grape',
    category: 'colorful',
    description: 'Deep purple with electric accents',
    colors: { background: '#1a0030', surface: '#2d0050', border: '#4a0080', primary: '#a855f7', accent: '#f0abfc', text: '#faf5ff', muted: '#d8b4fe' },
  },
  {
    id: 'colorful-sunset',
    name: 'Sunset Strip',
    category: 'colorful',
    description: 'Warm sunset gradient palette',
    colors: { background: '#1a0a00', surface: '#2d1500', border: '#4a2500', primary: '#f97316', accent: '#fbbf24', text: '#fff7ed', muted: '#fdba74' },
  },

  // ── Pastel themes ──────────────────────────────────────────────────────────
  {
    id: 'pastel-candy',
    name: 'Candy Pastel',
    category: 'pastel',
    description: 'Soft pastel candy colors',
    colors: { background: '#fff5fc', surface: '#fce7f8', border: '#f9d0f1', primary: '#d946ef', accent: '#f472b6', text: '#4a044e', muted: '#e879f9' },
  },
  {
    id: 'pastel-spring',
    name: 'Spring Bloom',
    category: 'pastel',
    description: 'Fresh spring pastel tones',
    colors: { background: '#f7fef4', surface: '#edfce7', border: '#d4f7cc', primary: '#86efac', accent: '#4ade80', text: '#14532d', muted: '#a3e635' },
  },
  {
    id: 'pastel-lavender',
    name: 'Lavender Dream',
    category: 'pastel',
    description: 'Soft lavender and lilac',
    colors: { background: '#f5f3ff', surface: '#ede9fe', border: '#ddd6fe', primary: '#8b5cf6', accent: '#a78bfa', text: '#2e1065', muted: '#c4b5fd' },
  },
  {
    id: 'pastel-peach',
    name: 'Peach Bliss',
    category: 'pastel',
    description: 'Warm peach and cream tones',
    colors: { background: '#fff8f5', surface: '#fff1eb', border: '#ffe4d6', primary: '#fb923c', accent: '#fdba74', text: '#431407', muted: '#fed7aa' },
  },
];

// ── Color math helpers ────────────────────────────────────────────────────────

/** Parse hex color to [r, g, b] 0-255 */
function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length < 6) return null;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

/** Color distance (simple Euclidean in RGB space) */
function colorDist(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 9999;
  return Math.sqrt((ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2);
}

/** Perceived luminance (0=dark, 1=bright) */
function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Find the closest color in the target scheme for a given source color,
 * by finding which role in the current scheme it best matches, then
 * returning that role's color in the target scheme.
 */
function mapColor(
  sourceColor: string,
  fromScheme: ColorScheme,
  toScheme: ColorScheme
): string {
  const roles = Object.keys(fromScheme.colors) as (keyof ColorScheme['colors'])[];

  let bestRole: keyof ColorScheme['colors'] = 'surface';
  let bestDist = Infinity;

  for (const role of roles) {
    const d = colorDist(sourceColor, fromScheme.colors[role]);
    if (d < bestDist) {
      bestDist = d;
      bestRole = role;
    }
  }

  // Map to new scheme's same role, but if very different luminance, pick by luminance
  const sourceLum = luminance(sourceColor);
  const fromColors = Object.values(fromScheme.colors);
  const toColors = Object.values(toScheme.colors) as string[];

  // If the color matches nothing well, map by luminance
  if (bestDist > 60) {
    const toColorObjects = roles.map(r => ({ role: r, color: toScheme.colors[r] }));
    let closestByLum = toColorObjects[0];
    let bestLumDiff = Math.abs(luminance(closestByLum.color) - sourceLum);
    for (const obj of toColorObjects) {
      const diff = Math.abs(luminance(obj.color) - sourceLum);
      if (diff < bestLumDiff) { bestLumDiff = diff; closestByLum = obj; }
    }
    return toScheme.colors[closestByLum.role];
  }

  return toScheme.colors[bestRole];
}

// ── Detect current scheme ─────────────────────────────────────────────────────

/** Try to detect which scheme the design most closely resembles */
function detectCurrentScheme(shapes: Shape[]): ColorScheme {
  const colors = shapes
    .flatMap(s => [s.fill, s.color, s.stroke])
    .filter(Boolean) as string[];

  if (colors.length === 0) return SCHEMES[0];

  let bestScheme = SCHEMES[0];
  let bestScore = Infinity;

  for (const scheme of SCHEMES) {
    const schemeColors = Object.values(scheme.colors);
    let totalDist = 0;
    for (const color of colors.slice(0, 20)) {
      const minDist = Math.min(...schemeColors.map(sc => colorDist(color, sc)));
      totalDist += minDist;
    }
    if (totalDist < bestScore) {
      bestScore = totalDist;
      bestScheme = scheme;
    }
  }
  return bestScheme;
}

// ── Apply scheme to shapes ────────────────────────────────────────────────────

function applyScheme(
  shapes: Shape[],
  fromScheme: ColorScheme,
  toScheme: ColorScheme
): { id: string; patch: Partial<Shape> }[] {
  const patches: { id: string; patch: Partial<Shape> }[] = [];

  for (const shape of shapes) {
    const patch: Partial<Shape> = {};

    // Map fill color
    if (shape.fill && shape.fill !== 'transparent' && shape.fillType === 'solid') {
      patch.fill = mapColor(shape.fill, fromScheme, toScheme);
    }

    // Map gradient stops
    if ((shape.fillType === 'linear-gradient' || shape.fillType === 'radial-gradient') && shape.gradientStops?.length) {
      patch.gradientStops = shape.gradientStops.map(stop => ({
        ...stop,
        color: mapColor(stop.color, fromScheme, toScheme),
      }));
    }

    // Map stroke color
    if (shape.stroke && shape.stroke !== 'transparent' && shape.strokeWidth > 0) {
      patch.stroke = mapColor(shape.stroke, fromScheme, toScheme);
    }

    // Map text color
    if (shape.type === 'text' && shape.color) {
      patch.color = mapColor(shape.color, fromScheme, toScheme);
    }

    // Map shadow color
    if (shape.shadow && shape.shadowColor) {
      patch.shadowColor = mapColor(shape.shadowColor, fromScheme, toScheme);
    }
    if (shape.shadows?.length) {
      patch.shadows = shape.shadows.map(s => ({
        ...s,
        color: mapColor(s.color, fromScheme, toScheme),
      }));
    }

    if (Object.keys(patch).length > 0) {
      patches.push({ id: shape.id, patch });
    }
  }

  return patches;
}

// ── Panel Component ───────────────────────────────────────────────────────────

interface Props {
  shapes: Shape[];
  onApplyPatches: (patches: { id: string; patch: Partial<Shape> }[]) => void;
  onClose: () => void;
}

const CATEGORIES = ['all', 'dark', 'light', 'colorful', 'pastel'] as const;

export function ColorSchemePanel({ shapes, onApplyPatches, onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('all');
  const [hoveredScheme, setHoveredScheme] = useState<string | null>(null);
  const [appliedScheme, setAppliedScheme] = useState<string | null>(null);
  const [fromSchemeId, setFromSchemeId] = useState<string | null>(null);

  const currentScheme = useMemo(() => detectCurrentScheme(shapes), [shapes]);

  const filteredSchemes = useMemo(() =>
    activeCategory === 'all'
      ? SCHEMES
      : SCHEMES.filter(s => s.category === activeCategory),
    [activeCategory]
  );

  const handleApply = useCallback((toScheme: ColorScheme) => {
    const from = fromSchemeId
      ? SCHEMES.find(s => s.id === fromSchemeId) ?? currentScheme
      : currentScheme;
    const patches = applyScheme(shapes, from, toScheme);
    if (patches.length === 0) return;
    onApplyPatches(patches);
    setAppliedScheme(toScheme.id);
    setFromSchemeId(toScheme.id); // next apply will map from this scheme
  }, [shapes, currentScheme, fromSchemeId, onApplyPatches]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 48,
        right: 280,
        width: 440,
        maxHeight: 'calc(100vh - 80px)',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        zIndex: 8600,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Palette size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Color Schemes</span>
          <span style={{
            fontSize: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)',
            borderRadius: 4, padding: '1px 6px', fontWeight: 600,
          }}>
            {SCHEMES.length} palettes
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 4 }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Current scheme detection */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(99,102,241,0.04)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Detected:</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {Object.values(currentScheme.colors).map((c, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
          ))}
        </div>
        <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>{currentScheme.name}</span>
        <span style={{ fontSize: 10, color: 'var(--subtle)', marginLeft: 'auto' }}>
          Click a scheme to apply
        </span>
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        padding: '0 12px', flexShrink: 0, overflowX: 'auto',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '7px 10px',
              fontSize: 11, fontWeight: activeCategory === cat ? 700 : 400,
              color: activeCategory === cat ? 'var(--accent)' : 'var(--muted)',
              borderBottom: `2px solid ${activeCategory === cat ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, whiteSpace: 'nowrap',
              textTransform: 'capitalize',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Scheme grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {filteredSchemes.map(scheme => {
            const isApplied = appliedScheme === scheme.id;
            const isHovered = hoveredScheme === scheme.id;
            return (
              <button
                key={scheme.id}
                onClick={() => handleApply(scheme)}
                onMouseEnter={() => setHoveredScheme(scheme.id)}
                onMouseLeave={() => setHoveredScheme(null)}
                style={{
                  background: isHovered ? 'var(--panel-alt)' : 'var(--canvas-bg, #0f0f1a)',
                  border: `1.5px solid ${isApplied ? 'var(--accent)' : isHovered ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  borderRadius: 10, cursor: 'pointer',
                  padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start',
                  textAlign: 'left',
                  transition: 'border-color 0.15s, background 0.15s',
                  position: 'relative',
                }}
              >
                {/* Applied checkmark */}
                {isApplied && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'var(--accent)', borderRadius: '50%',
                    width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={10} color="white" />
                  </div>
                )}

                {/* Color swatches */}
                <div style={{ display: 'flex', gap: 3, width: '100%' }}>
                  {Object.values(scheme.colors).map((color, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1, height: 20, borderRadius: 4,
                        background: color,
                        border: '1px solid rgba(255,255,255,0.08)',
                        transition: 'transform 0.15s',
                        transform: isHovered ? 'scaleY(1.2)' : 'scaleY(1)',
                        transformOrigin: 'bottom',
                      }}
                    />
                  ))}
                </div>

                {/* Preview bar using scheme colors */}
                <div style={{
                  width: '100%', height: 36, borderRadius: 6,
                  background: scheme.colors.background,
                  border: `1px solid ${scheme.colors.border}`,
                  display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6,
                  overflow: 'hidden',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: scheme.colors.primary, flexShrink: 0 }} />
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: scheme.colors.surface }} />
                  <div style={{ width: 24, height: 14, borderRadius: 3, background: scheme.colors.primary, flexShrink: 0 }} />
                </div>

                {/* Name */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                    {scheme.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                    {scheme.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
      }}>
        {fromSchemeId && (
          <button
            onClick={() => { setFromSchemeId(null); setAppliedScheme(null); }}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--muted)', cursor: 'pointer', fontSize: 10, padding: '3px 8px',
            }}
          >
            Reset mapping
          </button>
        )}
        <span style={{ fontSize: 10, color: 'var(--subtle)', marginLeft: 'auto' }}>
          Maps colors by role • ⌘Z to undo
        </span>
      </div>
    </div>
  );
}
