/**
 * StylePresetsPanel — One-click visual style presets.
 *
 * Applies a curated set of beautiful visual styles to the selected shape(s):
 * Glassmorphism, Neumorphism, Neon, Brutalist, Minimalist, Gradient Wave,
 * Material Design, Retro Pixel, Pastel Soft, Dark Premium, etc.
 *
 * Each preset is a Partial<Shape> patch that sets fill, stroke, shadow,
 * border radius, filters, and blend modes.
 *
 * The panel shows a 3×N grid of visual swatches with live preview on hover.
 */

import React, { useCallback, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Preset definitions ─────────────────────────────────────────────────────────

export interface StylePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  // Swatch preview colors for the 2-tone thumbnail
  previewBg: string;
  previewAccent: string;
  // The actual patch applied to shape
  patch: Partial<Shape>;
}

export const STYLE_PRESETS: StylePreset[] = [
  // ── Glass & Blur ────────────────────────────────────────────────────────────
  {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    category: 'Modern',
    description: 'Frosted glass effect with blur and transparency',
    previewBg: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.2))',
    previewAccent: 'rgba(255,255,255,0.6)',
    patch: {
      fill: '#ffffff',
      fillOpacity: 0.12,
      fillType: 'solid',
      stroke: 'rgba(255,255,255,0.25)',
      strokeWidth: 1,
      borderRadius: 16,
      filterBackdropBlur: 18,
      shadow: false,
    },
  },
  {
    id: 'dark-glass',
    name: 'Dark Glass',
    category: 'Modern',
    description: 'Dark frosted glass for dark backgrounds',
    previewBg: 'linear-gradient(135deg,#0f0f1a,#1a1a2e)',
    previewAccent: 'rgba(255,255,255,0.15)',
    patch: {
      fill: '#000000',
      fillOpacity: 0.25,
      fillType: 'solid',
      stroke: 'rgba(255,255,255,0.08)',
      strokeWidth: 1,
      borderRadius: 12,
      filterBackdropBlur: 24,
      shadow: false,
    },
  },
  {
    id: 'frosted-light',
    name: 'Frosted Light',
    category: 'Modern',
    description: 'Light frosted glass with subtle shadow',
    previewBg: 'linear-gradient(135deg,#e0e8ff,#f8f0ff)',
    previewAccent: 'rgba(255,255,255,0.8)',
    patch: {
      fill: '#ffffff',
      fillOpacity: 0.6,
      fillType: 'solid',
      stroke: 'rgba(255,255,255,0.5)',
      strokeWidth: 1,
      borderRadius: 20,
      filterBackdropBlur: 12,
      shadow: true,
      shadowX: 0,
      shadowY: 8,
      shadowBlur: 32,
      shadowColor: '#0000001a',
    },
  },

  // ── Neumorphism ─────────────────────────────────────────────────────────────
  {
    id: 'neumorphism-light',
    name: 'Neumorphic',
    category: 'Neumorphism',
    description: 'Soft 3D raised effect on light background',
    previewBg: '#e0e5ec',
    previewAccent: '#ffffff',
    patch: {
      fill: '#e0e5ec',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 16,
      shadow: false,
      shadows: [
        { x: 8, y: 8, blur: 16, spread: 0, color: '#b8bec7', inset: false },
        { x: -8, y: -8, blur: 16, spread: 0, color: '#ffffff', inset: false },
      ],
    },
  },
  {
    id: 'neumorphism-inset',
    name: 'Neumorphic Inset',
    category: 'Neumorphism',
    description: 'Pressed/inset neumorphic button effect',
    previewBg: '#e0e5ec',
    previewAccent: '#c8cfd8',
    patch: {
      fill: '#e0e5ec',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 12,
      shadow: false,
      shadows: [
        { x: 4, y: 4, blur: 8, spread: 0, color: '#b8bec7', inset: true },
        { x: -4, y: -4, blur: 8, spread: 0, color: '#ffffff', inset: true },
      ],
    },
  },
  {
    id: 'neumorphism-dark',
    name: 'Dark Neumorphic',
    category: 'Neumorphism',
    description: 'Dark mode neumorphism',
    previewBg: '#2a2d3e',
    previewAccent: '#3d4158',
    patch: {
      fill: '#2a2d3e',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 16,
      shadow: false,
      shadows: [
        { x: 6, y: 6, blur: 12, spread: 0, color: '#1a1c28', inset: false },
        { x: -6, y: -6, blur: 12, spread: 0, color: '#3a3e55', inset: false },
      ],
    },
  },

  // ── Gradients ───────────────────────────────────────────────────────────────
  {
    id: 'gradient-indigo',
    name: 'Indigo Wave',
    category: 'Gradients',
    description: 'Deep indigo to purple gradient',
    previewBg: 'linear-gradient(135deg,#6366f1,#a855f7)',
    previewAccent: 'rgba(255,255,255,0.4)',
    patch: {
      fillType: 'linear-gradient',
      gradientStops: [
        { color: '#6366f1', position: 0 },
        { color: '#a855f7', position: 1 },
      ],
      gradientAngle: 135,
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 12,
      shadow: true,
      shadowX: 0,
      shadowY: 8,
      shadowBlur: 24,
      shadowColor: '#6366f140',
    },
  },
  {
    id: 'gradient-sunset',
    name: 'Sunset',
    category: 'Gradients',
    description: 'Warm sunset orange-pink gradient',
    previewBg: 'linear-gradient(135deg,#f59e0b,#ef4444)',
    previewAccent: 'rgba(255,255,255,0.4)',
    patch: {
      fillType: 'linear-gradient',
      gradientStops: [
        { color: '#f59e0b', position: 0 },
        { color: '#ef4444', position: 1 },
      ],
      gradientAngle: 135,
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 12,
      shadow: true,
      shadowX: 0,
      shadowY: 8,
      shadowBlur: 24,
      shadowColor: '#ef444440',
    },
  },
  {
    id: 'gradient-ocean',
    name: 'Ocean',
    category: 'Gradients',
    description: 'Ocean blue to teal gradient',
    previewBg: 'linear-gradient(135deg,#0ea5e9,#14b8a6)',
    previewAccent: 'rgba(255,255,255,0.4)',
    patch: {
      fillType: 'linear-gradient',
      gradientStops: [
        { color: '#0ea5e9', position: 0 },
        { color: '#14b8a6', position: 1 },
      ],
      gradientAngle: 135,
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 12,
      shadow: true,
      shadowX: 0,
      shadowY: 8,
      shadowBlur: 24,
      shadowColor: '#0ea5e940',
    },
  },
  {
    id: 'gradient-aurora',
    name: 'Aurora',
    category: 'Gradients',
    description: 'Northern lights green to blue',
    previewBg: 'linear-gradient(135deg,#10b981,#6366f1)',
    previewAccent: 'rgba(255,255,255,0.4)',
    patch: {
      fillType: 'linear-gradient',
      gradientStops: [
        { color: '#10b981', position: 0 },
        { color: '#6366f1', position: 1 },
      ],
      gradientAngle: 135,
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 12,
      shadow: true,
      shadowX: 0,
      shadowY: 6,
      shadowBlur: 20,
      shadowColor: '#10b98140',
    },
  },
  {
    id: 'gradient-candy',
    name: 'Candy',
    category: 'Gradients',
    description: 'Pastel pink to lavender',
    previewBg: 'linear-gradient(135deg,#f9a8d4,#c4b5fd)',
    previewAccent: 'rgba(255,255,255,0.6)',
    patch: {
      fillType: 'linear-gradient',
      gradientStops: [
        { color: '#f9a8d4', position: 0 },
        { color: '#c4b5fd', position: 1 },
      ],
      gradientAngle: 135,
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 16,
      shadow: true,
      shadowX: 0,
      shadowY: 6,
      shadowBlur: 18,
      shadowColor: '#f9a8d430',
    },
  },

  // ── Neon / Glow ─────────────────────────────────────────────────────────────
  {
    id: 'neon-purple',
    name: 'Neon Purple',
    category: 'Neon',
    description: 'Glowing purple neon outline',
    previewBg: '#0d0d1a',
    previewAccent: '#a855f7',
    patch: {
      fill: 'transparent',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: '#a855f7',
      strokeWidth: 2,
      borderRadius: 8,
      shadow: false,
      shadows: [
        { x: 0, y: 0, blur: 10, spread: 2, color: '#a855f780', inset: false },
        { x: 0, y: 0, blur: 30, spread: 5, color: '#a855f740', inset: false },
      ],
    },
  },
  {
    id: 'neon-cyan',
    name: 'Neon Cyan',
    category: 'Neon',
    description: 'Electric cyan glow',
    previewBg: '#001a1a',
    previewAccent: '#06b6d4',
    patch: {
      fill: 'transparent',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: '#06b6d4',
      strokeWidth: 2,
      borderRadius: 4,
      shadow: false,
      shadows: [
        { x: 0, y: 0, blur: 12, spread: 2, color: '#06b6d480', inset: false },
        { x: 0, y: 0, blur: 35, spread: 5, color: '#06b6d440', inset: false },
      ],
    },
  },
  {
    id: 'neon-pink',
    name: 'Neon Pink',
    category: 'Neon',
    description: 'Hot pink retro neon',
    previewBg: '#1a001a',
    previewAccent: '#f472b6',
    patch: {
      fill: 'rgba(244,114,182,0.05)',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: '#f472b6',
      strokeWidth: 1.5,
      borderRadius: 6,
      shadow: false,
      shadows: [
        { x: 0, y: 0, blur: 14, spread: 2, color: '#f472b680', inset: false },
        { x: 0, y: 0, blur: 40, spread: 6, color: '#f472b430', inset: false },
        { x: 0, y: 0, blur: 8, spread: 1, color: '#f472b6cc', inset: true },
      ],
    },
  },

  // ── Brutalist ───────────────────────────────────────────────────────────────
  {
    id: 'brutalist-black',
    name: 'Brutalist',
    category: 'Brutalist',
    description: 'Bold black border, thick offset shadow',
    previewBg: '#fff8f0',
    previewAccent: '#000000',
    patch: {
      fill: '#fff8f0',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: '#000000',
      strokeWidth: 3,
      borderRadius: 0,
      shadow: false,
      shadows: [
        { x: 6, y: 6, blur: 0, spread: 0, color: '#000000', inset: false },
      ],
    },
  },
  {
    id: 'brutalist-yellow',
    name: 'Brutalist Yellow',
    category: 'Brutalist',
    description: 'Bold yellow brutalist card',
    previewBg: '#fbbf24',
    previewAccent: '#000000',
    patch: {
      fill: '#fbbf24',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: '#000000',
      strokeWidth: 3,
      borderRadius: 0,
      shadow: false,
      shadows: [
        { x: 5, y: 5, blur: 0, spread: 0, color: '#000000', inset: false },
      ],
    },
  },
  {
    id: 'brutalist-neo',
    name: 'Neo Brutalist',
    category: 'Brutalist',
    description: 'Colorful neo-brutalism',
    previewBg: '#e8f5e9',
    previewAccent: '#000000',
    patch: {
      fill: '#a8edbb',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: '#000000',
      strokeWidth: 2.5,
      borderRadius: 4,
      shadow: false,
      shadows: [
        { x: 4, y: 4, blur: 0, spread: 0, color: '#000000', inset: false },
      ],
    },
  },

  // ── Minimalist ──────────────────────────────────────────────────────────────
  {
    id: 'minimal-white',
    name: 'Minimal White',
    category: 'Minimalist',
    description: 'Clean white card with subtle shadow',
    previewBg: '#f8f9fa',
    previewAccent: '#ffffff',
    patch: {
      fill: '#ffffff',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 12,
      shadow: true,
      shadowX: 0,
      shadowY: 4,
      shadowBlur: 16,
      shadowColor: '#00000012',
    },
  },
  {
    id: 'minimal-border',
    name: 'Border Only',
    category: 'Minimalist',
    description: 'Transparent with light border',
    previewBg: 'transparent',
    previewAccent: '#e2e8f0',
    patch: {
      fill: 'transparent',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: '#e2e8f0',
      strokeWidth: 1.5,
      borderRadius: 8,
      shadow: false,
    },
  },
  {
    id: 'minimal-dark',
    name: 'Dark Card',
    category: 'Minimalist',
    description: 'Dark elevated card',
    previewBg: '#1e1e2e',
    previewAccent: '#2a2a3e',
    patch: {
      fill: '#1e1e2e',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: 'rgba(255,255,255,0.06)',
      strokeWidth: 1,
      borderRadius: 14,
      shadow: true,
      shadowX: 0,
      shadowY: 16,
      shadowBlur: 48,
      shadowColor: '#00000060',
    },
  },

  // ── Material ─────────────────────────────────────────────────────────────────
  {
    id: 'material-elevated',
    name: 'Material Elevated',
    category: 'Material',
    description: 'Google Material Design elevation 3',
    previewBg: '#fef7ff',
    previewAccent: '#e8def8',
    patch: {
      fill: '#fef7ff',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 28,
      shadow: false,
      shadows: [
        { x: 0, y: 1, blur: 2, spread: 0, color: '#00000026', inset: false },
        { x: 0, y: 4, blur: 8, spread: 3, color: '#00000026', inset: false },
      ],
    },
  },
  {
    id: 'material-filled',
    name: 'Material Filled',
    category: 'Material',
    description: 'Material filled tonal button/card',
    previewBg: '#e8def8',
    previewAccent: '#6750a4',
    patch: {
      fill: '#e8def8',
      fillOpacity: 1,
      fillType: 'solid',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 28,
      shadow: false,
    },
  },
];

// ── Group presets by category ──────────────────────────────────────────────────

const CATEGORY_ORDER = ['Modern', 'Neumorphism', 'Gradients', 'Neon', 'Brutalist', 'Minimalist', 'Material'];

function groupByCategory(presets: StylePreset[]): Map<string, StylePreset[]> {
  const map = new Map<string, StylePreset[]>();
  for (const cat of CATEGORY_ORDER) map.set(cat, []);
  for (const p of presets) {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category)!.push(p);
  }
  return map;
}

// ── Swatch component ───────────────────────────────────────────────────────────

function PresetSwatch({
  preset,
  onApply,
  onPreview,
  onPreviewEnd,
}: {
  preset: StylePreset;
  onApply: (p: StylePreset) => void;
  onPreview: (p: StylePreset) => void;
  onPreviewEnd: () => void;
}) {
  return (
    <div
      onClick={() => onApply(preset)}
      onMouseEnter={() => onPreview(preset)}
      onMouseLeave={onPreviewEnd}
      title={`${preset.name}: ${preset.description}`}
      style={{
        cursor: 'pointer',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        transition: 'transform 0.1s, box-shadow 0.1s',
        userSelect: 'none',
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = ''; }}
    >
      {/* Preview swatch */}
      <div style={{
        height: 44,
        background: preset.previewBg,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <div style={{
          width: 28, height: 28,
          borderRadius: 6,
          background: preset.previewAccent,
          boxShadow: preset.id.includes('neon') ? `0 0 8px ${preset.previewAccent}` : 'none',
        }} />
      </div>
      {/* Name */}
      <div style={{
        padding: '4px 6px',
        fontSize: 9.5,
        fontWeight: 600,
        color: 'var(--muted)',
        textAlign: 'center',
        background: 'var(--panel)',
        borderTop: '1px solid var(--border)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {preset.name}
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onApply: (ids: string[], patch: Partial<Shape>) => void;
  onPreview: (ids: string[], patch: Partial<Shape>) => void;
  onPreviewEnd: (ids: string[]) => void;
}

export function StylePresetsPanel({
  open,
  onClose,
  selectedShape,
  selectedShapeIds,
  onApply,
  onPreview,
  onPreviewEnd,
}: Props) {
  const [filter, setFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const grouped = groupByCategory(STYLE_PRESETS);

  const getApplyIds = useCallback(() => {
    if (selectedShapeIds.length > 0) return selectedShapeIds;
    if (selectedShape) return [selectedShape.id];
    return [];
  }, [selectedShape, selectedShapeIds]);

  const handleApply = useCallback((preset: StylePreset) => {
    const ids = getApplyIds();
    if (ids.length === 0) return;
    onApply(ids, preset.patch);
  }, [getApplyIds, onApply]);

  const handlePreview = useCallback((preset: StylePreset) => {
    const ids = getApplyIds();
    if (ids.length === 0) return;
    onPreview(ids, preset.patch);
  }, [getApplyIds, onPreview]);

  const handlePreviewEnd = useCallback(() => {
    const ids = getApplyIds();
    if (ids.length === 0) return;
    onPreviewEnd(ids);
  }, [getApplyIds, onPreviewEnd]);

  if (!open) return null;

  const searchLower = filter.toLowerCase();
  const filteredPresets = STYLE_PRESETS.filter(p =>
    !searchLower ||
    p.name.toLowerCase().includes(searchLower) ||
    p.category.toLowerCase().includes(searchLower) ||
    p.description.toLowerCase().includes(searchLower)
  );

  const categories = CATEGORY_ORDER.filter(c =>
    filteredPresets.some(p => p.category === c)
  );

  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: 480,
      maxHeight: '80vh',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      zIndex: 600,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Style Presets</span>
        {!selectedShape && selectedShapeIds.length === 0 && (
          <span style={{
            fontSize: 10, color: 'var(--subtle)',
            background: 'var(--input)', borderRadius: 3, padding: '1px 5px',
          }}>
            No shape selected — select a shape to apply
          </span>
        )}
        {selectedShapeIds.length > 1 && (
          <span style={{
            fontSize: 10, color: 'var(--accent)',
            background: 'var(--accent-dim)', borderRadius: 3, padding: '1px 5px',
          }}>
            Applying to {selectedShapeIds.length} shapes
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--input)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search styles…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          style={{
            width: '100%',
            background: 'var(--input)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text)',
            fontSize: 12,
            padding: '6px 10px',
            boxSizing: 'border-box',
            outline: 'none',
          }}
          autoFocus
        />
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '6px 14px',
        overflow: 'auto',
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            background: activeCategory === null ? 'var(--accent-dim)' : 'var(--input)',
            color: activeCategory === null ? 'var(--accent)' : 'var(--muted)',
            border: `1px solid ${activeCategory === null ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
            borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 600,
            padding: '2px 8px', whiteSpace: 'nowrap',
          }}
        >
          All
        </button>
        {CATEGORY_ORDER.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
            style={{
              background: activeCategory === cat ? 'var(--accent-dim)' : 'var(--input)',
              color: activeCategory === cat ? 'var(--accent)' : 'var(--muted)',
              border: `1px solid ${activeCategory === cat ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
              borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 600,
              padding: '2px 8px', whiteSpace: 'nowrap',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Preset grid */}
      <div style={{ overflow: 'auto', flex: 1, padding: '10px 14px' }}>
        {categories
          .filter(cat => !activeCategory || cat === activeCategory)
          .map(cat => {
            const catPresets = filteredPresets.filter(p => p.category === cat);
            if (catPresets.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--subtle)',
                  marginBottom: 8,
                }}>
                  {cat}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                  gap: 8,
                }}>
                  {catPresets.map(preset => (
                    <PresetSwatch
                      key={preset.id}
                      preset={preset}
                      onApply={handleApply}
                      onPreview={handlePreview}
                      onPreviewEnd={handlePreviewEnd}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        {filteredPresets.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--subtle)', fontSize: 12, padding: '24px 0' }}>
            No styles match "{filter}"
          </div>
        )}
      </div>
    </div>
  );
}
