/**
 * NoiseTexturePanel — Film grain, halftone, crosshatch, paper, and other
 * procedural texture overlays applied to shapes via SVG feTurbulence + pattern fills.
 *
 * Uses the existing `noiseOpacity` / `noiseScale` Shape props for fractal noise,
 * and `imageUrl` + `imageFit: 'tile'` for SVG pattern overlays.
 *
 * Shortcut: Cmd+Shift+Alt+N
 */

import React, { useState, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

type TextureMode = 'noise' | 'pattern';

interface TexturePreset {
  id: string;
  name: string;
  emoji: string;
  category: string;
  description: string;
  /** Returns the noiseOpacity/noiseScale patch OR a pattern imageUrl patch */
  apply: (opacity: number, scale: number, color: string) => Partial<Shape>;
}

// ── SVG Pattern helpers ───────────────────────────────────────────────────────

function enc(s: string): string {
  return s.replace(/#/g, '%23').replace(/"/g, "'").replace(/\s+/g, ' ').trim();
}

function svgDataUri(svg: string): string {
  return `url("data:image/svg+xml,${enc(svg)}")`;
}

function halftone(size: number, color: string): string {
  const r = size * 0.38;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='${color}'/>
  </svg>`;
  return svgDataUri(svg);
}

function crosshatch(size: number, color: string, strokeWidth = 0.8): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <line x1='0' y1='0' x2='${size}' y2='${size}' stroke='${color}' stroke-width='${strokeWidth}'/>
    <line x1='${size}' y1='0' x2='0' y2='${size}' stroke='${color}' stroke-width='${strokeWidth}'/>
  </svg>`;
  return svgDataUri(svg);
}

function hatch(size: number, color: string, angle: number, strokeWidth = 0.8): string {
  // Diagonal lines at a given angle
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <line x1='0' y1='${size / 2}' x2='${size}' y2='${size / 2}' stroke='${color}' stroke-width='${strokeWidth}'
      transform='rotate(${angle} ${size / 2} ${size / 2})'/>
  </svg>`;
  return svgDataUri(svg);
}

function gridPattern(size: number, color: string, strokeWidth = 0.5): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <rect width='${size}' height='${size}' fill='none' stroke='${color}' stroke-width='${strokeWidth}'/>
  </svg>`;
  return svgDataUri(svg);
}

function dotsPattern(size: number, color: string): string {
  const r = Math.max(0.5, size * 0.12);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='${color}'/>
  </svg>`;
  return svgDataUri(svg);
}

function wavyLines(size: number, color: string, strokeWidth = 0.8): string {
  const mid = size / 2;
  const amp = size * 0.15;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <path d='M0,${mid} Q${size / 4},${mid - amp} ${mid},${mid} T${size},${mid}' fill='none' stroke='${color}' stroke-width='${strokeWidth}'/>
  </svg>`;
  return svgDataUri(svg);
}

function brickPattern(size: number, color: string): string {
  const h = size * 0.5;
  const sw = 0.6;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <rect x='0' y='0' width='${size}' height='${h}' fill='none' stroke='${color}' stroke-width='${sw}'/>
    <rect x='${size / 2}' y='${h}' width='${size / 2}' height='${h}' fill='none' stroke='${color}' stroke-width='${sw}'/>
    <rect x='0' y='${h}' width='${size / 2}' height='${h}' fill='none' stroke='${color}' stroke-width='${sw}'/>
  </svg>`;
  return svgDataUri(svg);
}

function herringbone(size: number, color: string): string {
  const sw = 0.8;
  const h = size;
  const w = size;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w * 2}' height='${h}'>
    <line x1='0' y1='${h}' x2='${w}' y2='0' stroke='${color}' stroke-width='${sw}'/>
    <line x1='${w}' y1='0' x2='${w * 2}' y2='${h}' stroke='${color}' stroke-width='${sw}'/>
    <line x1='0' y1='0' x2='${w}' y2='${h}' stroke='${color}' stroke-width='${sw}'/>
    <line x1='${w}' y1='${h}' x2='${w * 2}' y2='0' stroke='${color}' stroke-width='${sw}'/>
  </svg>`;
  return svgDataUri(svg);
}

function triPattern(size: number, color: string): string {
  const sw = 0.7;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <polygon points='${size / 2},0 ${size},${size} 0,${size}' fill='none' stroke='${color}' stroke-width='${sw}'/>
  </svg>`;
  return svgDataUri(svg);
}

function plusPattern(size: number, color: string): string {
  const sw = 1;
  const mid = size / 2;
  const arm = size * 0.32;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <line x1='${mid}' y1='${mid - arm}' x2='${mid}' y2='${mid + arm}' stroke='${color}' stroke-width='${sw}'/>
    <line x1='${mid - arm}' y1='${mid}' x2='${mid + arm}' y2='${mid}' stroke='${color}' stroke-width='${sw}'/>
  </svg>`;
  return svgDataUri(svg);
}

// ── Texture Presets ────────────────────────────────────────────────────────────

const TEXTURE_PRESETS: TexturePreset[] = [
  // ── Noise / Grain ──
  {
    id: 'film-grain',
    name: 'Film Grain',
    emoji: '🎞️',
    category: 'Grain',
    description: 'Fine film grain — adds organic imperfection',
    apply: (opacity, scale, _color) => ({
      noiseOpacity: opacity * 0.4,
      noiseScale: scale * 0.3,
      imageUrl: undefined,
    }),
  },
  {
    id: 'coarse-grain',
    name: 'Coarse Grain',
    emoji: '🌾',
    category: 'Grain',
    description: 'Large-grain texture for a rough paper feel',
    apply: (opacity, scale, _color) => ({
      noiseOpacity: opacity * 0.6,
      noiseScale: scale * 2,
      imageUrl: undefined,
    }),
  },
  {
    id: 'smooth-noise',
    name: 'Smooth Noise',
    emoji: '🌊',
    category: 'Grain',
    description: 'Large-scale smooth perlin-like noise',
    apply: (opacity, scale, _color) => ({
      noiseOpacity: opacity * 0.5,
      noiseScale: scale * 4,
      imageUrl: undefined,
    }),
  },
  {
    id: 'stucco',
    name: 'Stucco',
    emoji: '🪨',
    category: 'Grain',
    description: 'Heavy stucco / plaster texture',
    apply: (opacity, scale, _color) => ({
      noiseOpacity: opacity * 0.8,
      noiseScale: scale * 1.5,
      imageUrl: undefined,
    }),
  },

  // ── Halftone ──
  {
    id: 'halftone-sm',
    name: 'Halftone Fine',
    emoji: '🔵',
    category: 'Halftone',
    description: 'Fine halftone dot pattern',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: halftone(Math.round(scale * 8), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },
  {
    id: 'halftone-lg',
    name: 'Halftone Bold',
    emoji: '🔴',
    category: 'Halftone',
    description: 'Large bold halftone dots',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: halftone(Math.round(scale * 20), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },

  // ── Crosshatch / Lines ──
  {
    id: 'crosshatch',
    name: 'Crosshatch',
    emoji: '✖️',
    category: 'Lines',
    description: 'Fine diagonal crosshatch lines',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: crosshatch(Math.round(scale * 8), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },
  {
    id: 'hatch-45',
    name: 'Hatch 45°',
    emoji: '////',
    category: 'Lines',
    description: 'Diagonal 45° hatching lines',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: hatch(Math.round(scale * 10), color, 45),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },
  {
    id: 'hatch-horizontal',
    name: 'Lines H',
    emoji: '≡',
    category: 'Lines',
    description: 'Horizontal lined paper effect',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: hatch(Math.round(scale * 12), color, 0),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },
  {
    id: 'wavy',
    name: 'Wavy',
    emoji: '〜',
    category: 'Lines',
    description: 'Wavy organic line texture',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: wavyLines(Math.round(scale * 16), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },

  // ── Grid ──
  {
    id: 'grid',
    name: 'Grid',
    emoji: '⊞',
    category: 'Grid',
    description: 'Square grid overlay',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: gridPattern(Math.round(scale * 16), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },
  {
    id: 'dots-grid',
    name: 'Dot Grid',
    emoji: '·',
    category: 'Grid',
    description: 'Minimal dot-grid Notion-style overlay',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: dotsPattern(Math.round(scale * 20), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },
  {
    id: 'plus-grid',
    name: 'Plus Grid',
    emoji: '+',
    category: 'Grid',
    description: 'Plus / cross mark grid',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: plusPattern(Math.round(scale * 24), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },

  // ── Geometric ──
  {
    id: 'brick',
    name: 'Brick',
    emoji: '🧱',
    category: 'Geometric',
    description: 'Brick / masonry bond pattern',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: brickPattern(Math.round(scale * 20), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },
  {
    id: 'herringbone',
    name: 'Herringbone',
    emoji: '〉',
    category: 'Geometric',
    description: 'Herringbone V-stripe pattern',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: herringbone(Math.round(scale * 16), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },
  {
    id: 'triangles',
    name: 'Triangles',
    emoji: '△',
    category: 'Geometric',
    description: 'Triangle tessellation',
    apply: (opacity, scale, color) => ({
      noiseOpacity: 0,
      fillType: 'image' as const,
      imageUrl: triPattern(Math.round(scale * 20), color),
      imageFit: 'tile' as const,
      fillOpacity: opacity,
    }),
  },
];

const ALL_CATS = ['All', ...Array.from(new Set(TEXTURE_PRESETS.map((t) => t.category)))];

// ── Mini live preview ─────────────────────────────────────────────────────────

function TexturePreview({
  preset,
  opacity,
  scale,
  color,
}: {
  preset: TexturePreset;
  opacity: number;
  scale: number;
  color: string;
}) {
  const patch = preset.apply(opacity, scale, color);
  let previewStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
    background: '#6366f1',
  };

  if (patch.noiseOpacity && patch.noiseOpacity > 0) {
    const freq = (0.65 / Math.max(0.5, Math.min(4, patch.noiseScale ?? 1))).toFixed(3);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='${patch.noiseOpacity.toFixed(2)}'/></feComponentTransfer></filter><rect width='200' height='200' filter='url(%23n)'/></svg>`;
    const noiseUrl = `url("data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/"/g, "'")}")`;
    previewStyle.backgroundImage = noiseUrl;
    previewStyle.backgroundSize = '200px 200px';
  } else if (patch.imageUrl) {
    previewStyle.backgroundImage = patch.imageUrl;
    previewStyle.backgroundRepeat = 'repeat';
    previewStyle.backgroundSize = `${Math.round(scale * 16)}px ${Math.round(scale * 16)}px`;
    previewStyle.opacity = opacity;
  }

  return <div style={previewStyle} />;
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onUpdate: (ids: string[], patch: Partial<Shape>) => void;
}

export function NoiseTexturePanel({ open, onClose, selectedShape, selectedShapeIds, onUpdate }: Props) {
  const [activeCat, setActiveCat] = useState('All');
  const [search, setSearch] = useState('');
  const [opacity, setOpacity] = useState(0.3);
  const [scale, setScale] = useState(1);
  const [color, setColor] = useState('#000000');
  const [lastApplied, setLastApplied] = useState<string | null>(null);

  const ids = selectedShapeIds.length > 0
    ? selectedShapeIds
    : selectedShape ? [selectedShape.id] : [];
  const hasSelection = ids.length > 0;

  const applyTexture = useCallback((preset: TexturePreset) => {
    if (!hasSelection) return;
    const patch = preset.apply(opacity, scale, color);
    onUpdate(ids, patch);
    setLastApplied(preset.id);
  }, [hasSelection, ids, opacity, scale, color, onUpdate]);

  const clearTexture = useCallback(() => {
    if (!hasSelection) return;
    onUpdate(ids, { noiseOpacity: 0, noiseScale: 1 });
    setLastApplied(null);
  }, [hasSelection, ids, onUpdate]);

  if (!open) return null;

  const q = search.trim().toLowerCase();
  const filtered = TEXTURE_PRESETS.filter(
    (t) =>
      (activeCat === 'All' || t.category === activeCat) &&
      (!q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)),
  );

  const hasNoise = (selectedShape?.noiseOpacity ?? 0) > 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        right: 340,
        width: 310,
        maxHeight: 'calc(100vh - 80px)',
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        zIndex: 310,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border, #2d2d3d)',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🌾 Noise & Texture
            {hasNoise && (
              <span style={{ background: 'var(--accent, #6366f1)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>
                ACTIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
            {hasSelection ? `${ids.length} shape${ids.length > 1 ? 's' : ''} selected` : 'Select a shape to apply'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {hasNoise && (
            <button
              onClick={clearTexture}
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: 10, fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 4, borderRadius: 4 }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {/* Opacity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opacity</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>{Math.round(opacity * 100)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.02} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent, #6366f1)', cursor: 'pointer' }} />
        </div>
        {/* Scale */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scale</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>{scale.toFixed(1)}×</span>
          </div>
          <input type="range" min={0.3} max={4} step={0.1} value={scale} onChange={(e) => setScale(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }} />
        </div>
        {/* Color (for pattern textures) */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Pattern Color</span>
          <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
              style={{ width: 28, height: 22, border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0 }} />
            <input type="text" value={color} onChange={(e) => setColor(e.target.value)} maxLength={7}
              style={{ flex: 1, background: 'var(--input-bg, #13131f)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, padding: '3px 6px', fontSize: 10, color: 'var(--text, #e2e8f0)', outline: 'none', fontFamily: 'monospace' }} />
            {/* Quick colors */}
            {['#000000', '#ffffff', '#6366f1', '#ef4444', '#f59e0b'].map((c) => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: 16, height: 16, borderRadius: 3, background: c, border: color === c ? '2px solid var(--accent, #6366f1)' : '1px solid var(--border, #2d2d3d)', cursor: 'pointer', flexShrink: 0 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search textures…"
          style={{ width: '100%', background: 'var(--input-bg, #13131f)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--text, #e2e8f0)', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 4, padding: '5px 10px', overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--border, #2d2d3d)', scrollbarWidth: 'none' }}>
        {ALL_CATS.map((cat) => (
          <button key={cat} onClick={() => setActiveCat(cat)}
            style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, border: activeCat === cat ? 'none' : '1px solid var(--border, #2d2d3d)', background: activeCat === cat ? 'var(--accent, #6366f1)' : 'transparent', color: activeCat === cat ? '#fff' : 'var(--muted, #888)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Texture grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, alignContent: 'start' }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--muted, #888)', fontSize: 12, padding: 24 }}>
            No textures found
          </div>
        )}
        {filtered.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyTexture(preset)}
            title={preset.description}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              background: lastApplied === preset.id ? 'rgba(99,102,241,0.12)' : 'var(--panel-alt, #252535)',
              border: lastApplied === preset.id ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border, #2d2d3d)',
              borderRadius: 8,
              padding: 6,
              cursor: hasSelection ? 'pointer' : 'not-allowed',
              opacity: hasSelection ? 1 : 0.4,
              textAlign: 'left',
              transition: 'all 0.12s',
            }}
          >
            <TexturePreview preset={preset} opacity={opacity} scale={scale} color={color} />
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text, #e2e8f0)', lineHeight: 1.2 }}>
              {preset.emoji} {preset.name}
            </span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border, #2d2d3d)', fontSize: 10, color: 'var(--muted, #888)', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>{TEXTURE_PRESETS.length} textures · {filtered.length} shown</span>
        <span>⌘⇧⌥N</span>
      </div>
    </div>
  );
}
