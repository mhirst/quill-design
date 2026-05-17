/**
 * AIQuickSuggestionsPanel — Smart one-click style suggestions for selected shapes.
 *
 * Analyses the selected shape's current style and suggests contextually relevant
 * visual transformations: glass morphism, neon glow, neumorphism, elevation
 * shadow stacks, brutalist frames, retro, etc.
 *
 * Each suggestion shows a mini preview swatch and applies immediately on click.
 * Suggestions are context-aware: e.g., text shapes get typography presets,
 * rectangular shapes get layout presets.
 */

import React, { useMemo, useState, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

interface StylePatch {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  shadow?: string;
  opacity?: number;
  borderRadius?: number;
  rotation?: number;
  blur?: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
}

interface Suggestion {
  id: string;
  label: string;
  category: 'surface' | 'glow' | 'shadow' | 'border' | 'typography' | 'transform';
  emoji: string;
  description: string;
  swatchBackground: string;
  swatchBorder?: string;
  swatchShadow?: string;
  apply: (shape: Shape) => StylePatch;
}

export interface Props {
  shape: Shape | null;
  visible: boolean;
  onClose: () => void;
  onApply: (patch: StylePatch) => void;
  style?: React.CSSProperties;
}

// ── Suggestion Definitions ─────────────────────────────────────────────────────

const SURFACE_SUGGESTIONS: Suggestion[] = [
  {
    id: 'glass',
    label: 'Glass',
    category: 'surface',
    emoji: '🪟',
    description: 'Frosted glass morphism with blur and translucency',
    swatchBackground: 'rgba(255,255,255,0.12)',
    swatchBorder: '1px solid rgba(255,255,255,0.25)',
    swatchShadow: '0 4px 16px rgba(0,0,0,0.2)',
    apply: (s) => ({
      fill: s.fill?.startsWith('#')
        ? hexToRgba(s.fill, 0.15)
        : 'rgba(255,255,255,0.12)',
      stroke: 'rgba(255,255,255,0.25)',
      strokeWidth: 1,
      blur: 8,
      shadow: '0 8px 32px rgba(0,0,0,0.2)',
      opacity: 0.92,
    }),
  },
  {
    id: 'neumorphic',
    label: 'Soft UI',
    category: 'surface',
    emoji: '☁️',
    description: 'Neumorphic soft shadow for light surfaces',
    swatchBackground: '#e0e5ec',
    swatchShadow: '6px 6px 12px #b8bec7, -6px -6px 12px #ffffff',
    apply: () => ({
      fill: '#e0e5ec',
      stroke: 'transparent',
      strokeWidth: 0,
      shadow: '6px 6px 12px #b8bec7, -6px -6px 12px #ffffff',
      borderRadius: 16,
    }),
  },
  {
    id: 'dark-glass',
    label: 'Dark Glass',
    category: 'surface',
    emoji: '🌑',
    description: 'Dark frosted panel with subtle gradient',
    swatchBackground: 'linear-gradient(135deg, rgba(30,30,50,0.85), rgba(15,15,30,0.92))',
    swatchBorder: '1px solid rgba(255,255,255,0.08)',
    swatchShadow: '0 8px 24px rgba(0,0,0,0.5)',
    apply: () => ({
      fill: 'rgba(20,20,40,0.85)',
      stroke: 'rgba(255,255,255,0.08)',
      strokeWidth: 1,
      blur: 12,
      shadow: '0 8px 24px rgba(0,0,0,0.5)',
    }),
  },
  {
    id: 'gradient-aurora',
    label: 'Aurora',
    category: 'surface',
    emoji: '🌌',
    description: 'Northern-lights gradient fill',
    swatchBackground: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
    apply: () => ({
      fill: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
      stroke: 'rgba(255,255,255,0.15)',
      strokeWidth: 1,
      shadow: '0 4px 20px rgba(102,126,234,0.4)',
      opacity: 1,
    }),
  },
  {
    id: 'gradient-sunset',
    label: 'Sunset',
    category: 'surface',
    emoji: '🌅',
    description: 'Warm sunset gradient',
    swatchBackground: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #fda085 100%)',
    apply: () => ({
      fill: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #fda085 100%)',
      stroke: 'rgba(255,255,255,0.2)',
      strokeWidth: 1,
      shadow: '0 4px 20px rgba(245,87,108,0.4)',
    }),
  },
  {
    id: 'gradient-ocean',
    label: 'Ocean',
    category: 'surface',
    emoji: '🌊',
    description: 'Cool ocean gradient',
    swatchBackground: 'linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)',
    apply: () => ({
      fill: 'linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)',
      stroke: 'rgba(255,255,255,0.2)',
      strokeWidth: 1,
      shadow: '0 4px 20px rgba(0,147,233,0.4)',
    }),
  },
  {
    id: 'brutalist',
    label: 'Brutalist',
    category: 'border',
    emoji: '⬛',
    description: 'Bold black border and flat fill',
    swatchBackground: '#fbbf24',
    swatchBorder: '3px solid #000',
    swatchShadow: '4px 4px 0 #000',
    apply: (s) => ({
      fill: s.fill || '#fbbf24',
      stroke: '#000000',
      strokeWidth: 3,
      shadow: '4px 4px 0 #000000',
      borderRadius: 0,
    }),
  },
  {
    id: 'retro-outline',
    label: 'Retro',
    category: 'border',
    emoji: '🕹️',
    description: 'Retro double-border with offset shadow',
    swatchBackground: '#fff',
    swatchBorder: '2px solid #1a1a2e',
    swatchShadow: '3px 3px 0 #e94560, 6px 6px 0 #1a1a2e',
    apply: (s) => ({
      fill: s.fill || '#ffffff',
      stroke: '#1a1a2e',
      strokeWidth: 2,
      shadow: '3px 3px 0 #e94560, 6px 6px 0 #1a1a2e',
    }),
  },
];

const GLOW_SUGGESTIONS: Suggestion[] = [
  {
    id: 'neon-purple',
    label: 'Neon Purple',
    category: 'glow',
    emoji: '💜',
    description: 'Cyberpunk neon purple glow',
    swatchBackground: '#1a0030',
    swatchBorder: '1px solid #a855f7',
    swatchShadow: '0 0 8px #a855f7, 0 0 20px #7c3aed, 0 0 40px rgba(124,58,237,0.3)',
    apply: () => ({
      fill: '#0d0020',
      stroke: '#a855f7',
      strokeWidth: 1.5,
      shadow: '0 0 8px #a855f7, 0 0 20px #7c3aed, 0 0 40px rgba(124,58,237,0.3)',
      color: '#e9d5ff',
    }),
  },
  {
    id: 'neon-cyan',
    label: 'Neon Cyan',
    category: 'glow',
    emoji: '💠',
    description: 'Electric cyan neon glow',
    swatchBackground: '#001a1a',
    swatchBorder: '1px solid #06b6d4',
    swatchShadow: '0 0 8px #06b6d4, 0 0 20px #0891b2, 0 0 40px rgba(6,182,212,0.3)',
    apply: () => ({
      fill: '#001020',
      stroke: '#06b6d4',
      strokeWidth: 1.5,
      shadow: '0 0 8px #06b6d4, 0 0 20px #0891b2, 0 0 40px rgba(6,182,212,0.3)',
      color: '#cffafe',
    }),
  },
  {
    id: 'neon-green',
    label: 'Neon Green',
    category: 'glow',
    emoji: '💚',
    description: 'Matrix-style green glow',
    swatchBackground: '#001400',
    swatchBorder: '1px solid #22c55e',
    swatchShadow: '0 0 8px #22c55e, 0 0 20px #16a34a, 0 0 40px rgba(34,197,94,0.3)',
    apply: () => ({
      fill: '#001a00',
      stroke: '#22c55e',
      strokeWidth: 1.5,
      shadow: '0 0 8px #22c55e, 0 0 20px #16a34a, 0 0 40px rgba(34,197,94,0.3)',
      color: '#dcfce7',
    }),
  },
  {
    id: 'neon-red',
    label: 'Neon Red',
    category: 'glow',
    emoji: '❤️‍🔥',
    description: 'Hot neon red glow',
    swatchBackground: '#1a0000',
    swatchBorder: '1px solid #ef4444',
    swatchShadow: '0 0 8px #ef4444, 0 0 20px #dc2626, 0 0 40px rgba(239,68,68,0.3)',
    apply: () => ({
      fill: '#200000',
      stroke: '#ef4444',
      strokeWidth: 1.5,
      shadow: '0 0 8px #ef4444, 0 0 20px #dc2626, 0 0 40px rgba(239,68,68,0.3)',
      color: '#fee2e2',
    }),
  },
];

const SHADOW_SUGGESTIONS: Suggestion[] = [
  {
    id: 'elevation-1',
    label: 'Elevation 1',
    category: 'shadow',
    emoji: '🪄',
    description: 'Subtle lift shadow (card level)',
    swatchBackground: '#fff',
    swatchShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    apply: () => ({
      shadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    }),
  },
  {
    id: 'elevation-3',
    label: 'Elevation 3',
    category: 'shadow',
    emoji: '🪄',
    description: 'Medium elevation (modal level)',
    swatchBackground: '#fff',
    swatchShadow: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
    apply: () => ({
      shadow: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
    }),
  },
  {
    id: 'elevation-5',
    label: 'Elevation 5',
    category: 'shadow',
    emoji: '🪄',
    description: 'Dramatic depth (hero element)',
    swatchBackground: '#fff',
    swatchShadow: '0 25px 50px rgba(0,0,0,0.25)',
    apply: () => ({
      shadow: '0 25px 50px rgba(0,0,0,0.25)',
    }),
  },
  {
    id: 'colored-shadow',
    label: 'Color Shadow',
    category: 'shadow',
    emoji: '🎨',
    description: 'Shadow tinted to match fill color',
    swatchBackground: '#6366f1',
    swatchShadow: '0 8px 24px rgba(99,102,241,0.5)',
    apply: (s) => {
      const hex = s.fill?.startsWith('#') ? s.fill : '#6366f1';
      return {
        shadow: `0 8px 24px ${hexToRgba(hex, 0.5)}, 0 4px 8px ${hexToRgba(hex, 0.3)}`,
      };
    },
  },
  {
    id: 'inset-shadow',
    label: 'Inset',
    category: 'shadow',
    emoji: '🔲',
    description: 'Pressed-in inset shadow',
    swatchBackground: '#d1d5db',
    swatchShadow: 'inset 4px 4px 8px rgba(0,0,0,0.15), inset -2px -2px 4px rgba(255,255,255,0.7)',
    apply: () => ({
      shadow: 'inset 4px 4px 8px rgba(0,0,0,0.15), inset -2px -2px 4px rgba(255,255,255,0.7)',
    }),
  },
];

const BORDER_SUGGESTIONS: Suggestion[] = [
  {
    id: 'pill',
    label: 'Pill',
    category: 'border',
    emoji: '💊',
    description: 'Maximum border radius (pill shape)',
    swatchBackground: '#6366f1',
    swatchBorder: 'none',
    apply: () => ({
      borderRadius: 9999,
    }),
  },
  {
    id: 'rounded-md',
    label: 'Rounded',
    category: 'border',
    emoji: '⬛',
    description: 'Standard 8px rounded corners',
    swatchBackground: '#6366f1',
    apply: () => ({
      borderRadius: 8,
    }),
  },
  {
    id: 'sharp',
    label: 'Sharp',
    category: 'border',
    emoji: '📐',
    description: 'Remove all border radius',
    swatchBackground: '#6366f1',
    apply: () => ({
      borderRadius: 0,
    }),
  },
  {
    id: 'dashed-border',
    label: 'Dashed',
    category: 'border',
    emoji: '- -',
    description: 'Dashed stroke border',
    swatchBackground: 'transparent',
    swatchBorder: '2px dashed #6366f1',
    apply: (s) => ({
      fill: 'transparent',
      stroke: s.stroke || '#6366f1',
      strokeWidth: 2,
    }),
  },
  {
    id: 'thick-accent',
    label: 'Accent',
    category: 'border',
    emoji: '🖌️',
    description: 'Thick accent color border',
    swatchBackground: 'transparent',
    swatchBorder: '3px solid #6366f1',
    apply: () => ({
      stroke: '#6366f1',
      strokeWidth: 3,
      fill: 'transparent',
    }),
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Determine which categories to show based on shape type
function getSuggestions(shape: Shape): Suggestion[] {
  const isText = shape.type === 'text';
  const suggestions: Suggestion[] = [];

  // Always include surfaces
  suggestions.push(...SURFACE_SUGGESTIONS);

  // Neon glows (especially good for shapes with fills)
  if (!isText) suggestions.push(...GLOW_SUGGESTIONS);

  // Shadow suggestions
  suggestions.push(...SHADOW_SUGGESTIONS);

  // Border suggestions
  if (!isText) suggestions.push(...BORDER_SUGGESTIONS);

  return suggestions;
}

// ── Category Tab ───────────────────────────────────────────────────────────────

type Category = 'all' | 'surface' | 'glow' | 'shadow' | 'border';

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '✦' },
  { id: 'surface', label: 'Surface', emoji: '🎨' },
  { id: 'glow', label: 'Neon', emoji: '✨' },
  { id: 'shadow', label: 'Shadow', emoji: '🌑' },
  { id: 'border', label: 'Border', emoji: '⬜' },
];

// ── Swatch Card ────────────────────────────────────────────────────────────────

function SwatchCard({
  suggestion,
  onApply,
  appliedId,
}: {
  suggestion: Suggestion;
  onApply: (s: Suggestion) => void;
  appliedId: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const isApplied = appliedId === suggestion.id;

  return (
    <div
      onClick={() => onApply(suggestion)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={suggestion.description}
      style={{
        cursor: 'pointer',
        borderRadius: 8,
        overflow: 'hidden',
        border: `1px solid ${isApplied ? 'rgba(34,197,94,0.5)' : hovered ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
        transition: 'all 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
        background: 'var(--bg, #131320)',
        userSelect: 'none',
      }}
    >
      {/* Swatch preview */}
      <div style={{
        height: 48,
        background: suggestion.swatchBackground,
        border: suggestion.swatchBorder ? undefined : 'none',
        boxShadow: suggestion.swatchShadow,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Applied check */}
        {isApplied && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(34,197,94,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            ✓
          </div>
        )}
        <span style={{ fontSize: 16, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
          {suggestion.emoji}
        </span>
      </div>

      {/* Label */}
      <div style={{
        padding: '5px 6px',
        fontSize: 10,
        fontWeight: 500,
        color: isApplied ? '#22c55e' : 'var(--text, #e2e8f0)',
        textAlign: 'center',
        lineHeight: 1.2,
        fontFamily: 'system-ui, sans-serif',
      }}>
        {isApplied ? '✓ Applied' : suggestion.label}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AIQuickSuggestionsPanel({ shape, visible, onClose, onApply, style }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const suggestions = useMemo(() => {
    if (!shape) return [];
    return getSuggestions(shape);
  }, [shape]);

  const filtered = useMemo(() => {
    let list = suggestions;
    if (activeCategory !== 'all') {
      list = list.filter(s => s.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [suggestions, activeCategory, searchQuery]);

  const handleApply = useCallback((suggestion: Suggestion) => {
    if (!shape) return;
    const patch = suggestion.apply(shape);
    onApply(patch);
    setAppliedId(suggestion.id);
    setTimeout(() => setAppliedId(null), 1500);
  }, [shape, onApply]);

  if (!visible || !shape) return null;

  return (
    <div
      style={{
        width: 300,
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh',
        ...style,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>✨</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
              Quick Styles
            </span>
            <span style={{
              fontSize: 9, background: 'rgba(99,102,241,0.2)',
              color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)',
              padding: '1px 5px', borderRadius: 4, fontWeight: 600,
            }}>
              AI
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted, #888)', fontSize: 14, lineHeight: 1, padding: 2,
            }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search styles…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 6,
            color: 'var(--text, #e2e8f0)',
            fontSize: 11,
            padding: '5px 8px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '6px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              height: 22,
              padding: '0 7px',
              background: activeCategory === cat.id
                ? 'rgba(99,102,241,0.2)'
                : 'transparent',
              border: `1px solid ${activeCategory === cat.id
                ? 'rgba(99,102,241,0.4)'
                : 'transparent'}`,
              borderRadius: 5,
              color: activeCategory === cat.id
                ? '#818cf8'
                : 'var(--muted, #888)',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 3,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 10 }}>{cat.emoji}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid of suggestions */}
      <div style={{
        padding: '8px',
        overflowY: 'auto',
        flex: 1,
      }}>
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '20px 0',
            color: 'var(--muted, #888)', fontSize: 12,
          }}>
            No styles match "{searchQuery}"
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
          }}>
            {filtered.map(s => (
              <SwatchCard
                key={s.id}
                suggestion={s}
                onApply={handleApply}
                appliedId={appliedId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '6px 12px',
        borderTop: '1px solid var(--border, #2d2d3d)',
        fontSize: 9,
        color: 'var(--muted, #888)',
        flexShrink: 0,
        fontStyle: 'italic',
      }}>
        Click any style to apply • Changes can be undone with ⌘Z
      </div>
    </div>
  );
}
