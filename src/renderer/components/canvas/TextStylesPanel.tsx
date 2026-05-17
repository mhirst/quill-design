/**
 * TextStylesPanel — Named text style library for consistent typography.
 *
 * Define reusable text styles (Heading 1, Body, Caption, etc.) with
 * font, size, weight, color, line-height, letter-spacing, and apply
 * them to selected text shapes in one click.
 *
 * Shortcut: ⌘⇧T
 */

import React, { useState, useCallback, useRef } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextStyle {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  lineHeight: number; // multiplier, e.g. 1.5
  letterSpacing: number; // px
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fontStyle: 'normal' | 'italic';
  category: 'heading' | 'body' | 'display' | 'label' | 'code' | 'custom';
}

const CATEGORY_COLORS: Record<TextStyle['category'], string> = {
  heading: '#6366f1',
  body: '#10b981',
  display: '#f59e0b',
  label: '#ec4899',
  code: '#8b5cf6',
  custom: '#6b7280',
};

const CATEGORY_ICONS: Record<TextStyle['category'], string> = {
  heading: 'H',
  body: 'B',
  display: 'D',
  label: 'L',
  code: '</>',
  custom: '✦',
};

// ─── Default styles ───────────────────────────────────────────────────────────

const DEFAULT_STYLES: TextStyle[] = [
  { id: 'display-xl', name: 'Display XL', fontFamily: 'Inter', fontSize: 72, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.1, letterSpacing: -2, textTransform: 'none', fontStyle: 'normal', category: 'display' },
  { id: 'display-lg', name: 'Display LG', fontFamily: 'Inter', fontSize: 56, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.15, letterSpacing: -1.5, textTransform: 'none', fontStyle: 'normal', category: 'display' },
  { id: 'h1', name: 'Heading 1', fontFamily: 'Inter', fontSize: 40, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2, letterSpacing: -0.5, textTransform: 'none', fontStyle: 'normal', category: 'heading' },
  { id: 'h2', name: 'Heading 2', fontFamily: 'Inter', fontSize: 32, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.25, letterSpacing: -0.25, textTransform: 'none', fontStyle: 'normal', category: 'heading' },
  { id: 'h3', name: 'Heading 3', fontFamily: 'Inter', fontSize: 24, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3, letterSpacing: 0, textTransform: 'none', fontStyle: 'normal', category: 'heading' },
  { id: 'h4', name: 'Heading 4', fontFamily: 'Inter', fontSize: 20, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.35, letterSpacing: 0, textTransform: 'none', fontStyle: 'normal', category: 'heading' },
  { id: 'body-lg', name: 'Body Large', fontFamily: 'Inter', fontSize: 18, fontWeight: 400, color: '#cbd5e1', lineHeight: 1.6, letterSpacing: 0, textTransform: 'none', fontStyle: 'normal', category: 'body' },
  { id: 'body-md', name: 'Body', fontFamily: 'Inter', fontSize: 16, fontWeight: 400, color: '#cbd5e1', lineHeight: 1.6, letterSpacing: 0, textTransform: 'none', fontStyle: 'normal', category: 'body' },
  { id: 'body-sm', name: 'Body Small', fontFamily: 'Inter', fontSize: 14, fontWeight: 400, color: '#94a3b8', lineHeight: 1.5, letterSpacing: 0, textTransform: 'none', fontStyle: 'normal', category: 'body' },
  { id: 'label-lg', name: 'Label Large', fontFamily: 'Inter', fontSize: 14, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4, letterSpacing: 0.5, textTransform: 'uppercase', fontStyle: 'normal', category: 'label' },
  { id: 'label-sm', name: 'Label Small', fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: '#94a3b8', lineHeight: 1.4, letterSpacing: 0.8, textTransform: 'uppercase', fontStyle: 'normal', category: 'label' },
  { id: 'caption', name: 'Caption', fontFamily: 'Inter', fontSize: 12, fontWeight: 400, color: '#64748b', lineHeight: 1.4, letterSpacing: 0, textTransform: 'none', fontStyle: 'normal', category: 'body' },
  { id: 'code', name: 'Code', fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 400, color: '#a78bfa', lineHeight: 1.6, letterSpacing: 0, textTransform: 'none', fontStyle: 'normal', category: 'code' },
  { id: 'code-bold', name: 'Code Bold', fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#c4b5fd', lineHeight: 1.6, letterSpacing: 0, textTransform: 'none', fontStyle: 'normal', category: 'code' },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeId() {
  return 'ts-' + Math.random().toString(36).slice(2, 9);
}

const FONT_OPTIONS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Source Sans Pro',
  'Raleway', 'Merriweather', 'Georgia', 'Playfair Display', 'DM Serif Display',
  'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Courier New',
  'system-ui', 'sans-serif', 'serif',
];

const WEIGHT_OPTIONS = [
  { value: 100, label: 'Thin 100' },
  { value: 200, label: 'ExtraLight 200' },
  { value: 300, label: 'Light 300' },
  { value: 400, label: 'Regular 400' },
  { value: 500, label: 'Medium 500' },
  { value: 600, label: 'SemiBold 600' },
  { value: 700, label: 'Bold 700' },
  { value: 800, label: 'ExtraBold 800' },
  { value: 900, label: 'Black 900' },
];

// ─── StylePreviewCard ─────────────────────────────────────────────────────────

function StyleCard({
  style, isSelected, onSelect, onApply, onEdit, onDelete,
}: {
  style: TextStyle;
  isSelected: boolean;
  onSelect: () => void;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  const color = CATEGORY_COLORS[style.category];

  const previewStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: Math.min(style.fontSize, 28),
    fontWeight: style.fontWeight,
    color: style.color,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
    fontStyle: style.fontStyle,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onApply}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '8px 10px',
        background: isSelected ? 'rgba(99,102,241,0.1)' : hover ? 'rgba(255,255,255,0.03)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {/* Category badge */}
      <div style={{
        width: 24, height: 24, borderRadius: 4,
        background: `${color}22`,
        border: `1px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 700, color, flexShrink: 0,
      }}>
        {CATEGORY_ICONS[style.category]}
      </div>

      {/* Name + preview */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 1 }}>{style.name}</div>
        <div style={previewStyle}>{style.name}</div>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 9, color: 'var(--subtle, #444)', textAlign: 'right', flexShrink: 0 }}>
        <div>{style.fontFamily.split(' ')[0]}</div>
        <div>{style.fontSize}px · {style.fontWeight}</div>
      </div>

      {/* Actions (on hover) */}
      {(hover || isSelected) && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={onApply}
            title="Apply to selected shape"
            style={{ background: 'rgba(99,102,241,0.15)', border: 'none', borderRadius: 3, color: 'var(--accent, #6366f1)', cursor: 'pointer', fontSize: 10, padding: '2px 5px' }}
          >
            Apply
          </button>
          <button
            onClick={onEdit}
            title="Edit style"
            style={{ background: 'transparent', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }}
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            title="Delete style"
            style={{ background: 'transparent', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Style Editor Form ────────────────────────────────────────────────────────

function StyleEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: TextStyle | null;
  onSave: (s: TextStyle) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TextStyle>(initial ?? {
    id: makeId(),
    name: 'Custom Style',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 400,
    color: '#e2e8f0',
    lineHeight: 1.5,
    letterSpacing: 0,
    textTransform: 'none',
    fontStyle: 'normal',
    category: 'custom',
  });

  const set = (patch: Partial<TextStyle>) => setForm(f => ({ ...f, ...patch }));

  const previewStyle: React.CSSProperties = {
    fontFamily: form.fontFamily,
    fontSize: Math.min(form.fontSize, 36),
    fontWeight: form.fontWeight,
    color: form.color,
    lineHeight: form.lineHeight,
    letterSpacing: form.letterSpacing,
    textTransform: form.textTransform,
    fontStyle: form.fontStyle,
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Live preview */}
      <div style={{
        padding: '12px', background: 'var(--bg, #161622)',
        borderRadius: 6, border: '1px solid var(--border, #2d2d3d)',
        minHeight: 50, display: 'flex', alignItems: 'center',
        overflow: 'hidden',
      }}>
        <span style={previewStyle}>{form.name || 'Preview'}</span>
      </div>

      {/* Name */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Style name</div>
        <input
          value={form.name}
          onChange={e => set({ name: e.target.value })}
          style={{
            width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 4, color: 'var(--text)', fontSize: 12, padding: '4px 8px', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Category */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Category</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['heading', 'body', 'display', 'label', 'code', 'custom'] as TextStyle['category'][]).map(cat => (
            <button key={cat} onClick={() => set({ category: cat })}
              style={{
                padding: '3px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                border: `1px solid ${form.category === cat ? CATEGORY_COLORS[cat] : 'var(--border, #2d2d3d)'}`,
                background: form.category === cat ? `${CATEGORY_COLORS[cat]}22` : 'transparent',
                color: form.category === cat ? CATEGORY_COLORS[cat] : 'var(--muted, #888)',
              }}
            >{cat}</button>
          ))}
        </div>
      </div>

      {/* Font family */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Font family</div>
        <select
          value={form.fontFamily}
          onChange={e => set({ fontFamily: e.target.value })}
          style={{ width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '4px 6px' }}
        >
          {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Font size + weight */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Size</div>
          <input
            type="number" value={form.fontSize} min={6} max={200} step={1}
            onChange={e => set({ fontSize: Number(e.target.value) })}
            style={{ width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '4px 6px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Weight</div>
          <select
            value={form.fontWeight}
            onChange={e => set({ fontWeight: Number(e.target.value) })}
            style={{ width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '4px 6px' }}
          >
            {WEIGHT_OPTIONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      </div>

      {/* Color + font style */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Color</div>
          <input
            type="color" value={form.color} onChange={e => set({ color: e.target.value })}
            style={{ width: '100%', height: 30, cursor: 'pointer', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Style</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => set({ fontStyle: form.fontStyle === 'italic' ? 'normal' : 'italic' })}
              style={{
                flex: 1, padding: '4px', borderRadius: 4, fontSize: 12, fontStyle: 'italic',
                background: form.fontStyle === 'italic' ? 'rgba(99,102,241,0.2)' : 'var(--surface2, #2a2a3a)',
                border: `1px solid ${form.fontStyle === 'italic' ? 'rgba(99,102,241,0.5)' : 'var(--border, #2d2d3d)'}`,
                color: form.fontStyle === 'italic' ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                cursor: 'pointer',
              }}
            >I</button>
          </div>
        </div>
      </div>

      {/* Line height + letter spacing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Line height</div>
          <input
            type="number" value={form.lineHeight} min={0.8} max={3} step={0.05}
            onChange={e => set({ lineHeight: Number(e.target.value) })}
            style={{ width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '4px 6px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Letter spacing</div>
          <input
            type="number" value={form.letterSpacing} min={-5} max={20} step={0.1}
            onChange={e => set({ letterSpacing: Number(e.target.value) })}
            style={{ width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '4px 6px' }}
          />
        </div>
      </div>

      {/* Text transform */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 3 }}>Transform</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['none', 'uppercase', 'lowercase', 'capitalize'] as TextStyle['textTransform'][]).map(t => (
            <button
              key={t}
              onClick={() => set({ textTransform: t })}
              style={{
                flex: 1, padding: '3px 0', fontSize: 9, borderRadius: 4,
                background: form.textTransform === t ? 'rgba(99,102,241,0.2)' : 'var(--surface2, #2a2a3a)',
                border: `1px solid ${form.textTransform === t ? 'rgba(99,102,241,0.5)' : 'var(--border, #2d2d3d)'}`,
                color: form.textTransform === t ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                cursor: 'pointer',
                textTransform: t,
              }}
            >
              {t === 'none' ? 'Aa' : t === 'uppercase' ? 'AA' : t === 'lowercase' ? 'aa' : 'Aa'}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '6px', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 5, color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 11 }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          style={{ flex: 1, padding: '6px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 5, color: 'var(--accent, #6366f1)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
        >
          Save Style
        </button>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  styles: TextStyle[];
  onStylesChange: (styles: TextStyle[]) => void;
  selectedShapeIds: string[];
  shapes: Shape[];
  onApplyStyle: (shapeIds: string[], style: TextStyle) => void;
}

export function TextStylesPanel({ open, onClose, styles, onStylesChange, selectedShapeIds, shapes, onApplyStyle }: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TextStyle | null | 'new'>(null);
  const [filterCategory, setFilterCategory] = useState<TextStyle['category'] | 'all'>('all');

  const allStyles = styles.length > 0 ? styles : DEFAULT_STYLES;

  const filtered = allStyles.filter(s => {
    if (filterCategory !== 'all' && s.category !== filterCategory) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by category
  const grouped = (['display', 'heading', 'body', 'label', 'code', 'custom'] as TextStyle['category'][]).reduce<Record<string, TextStyle[]>>((acc, cat) => {
    const items = filtered.filter(s => s.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const handleApply = useCallback((style: TextStyle) => {
    const ids = selectedShapeIds.length > 0 ? selectedShapeIds : [];
    if (ids.length === 0) return;
    onApplyStyle(ids, style);
  }, [selectedShapeIds, onApplyStyle]);

  const handleSave = useCallback((style: TextStyle) => {
    if (editing === 'new') {
      const updated = styles.length > 0
        ? [...styles, style]
        : [...DEFAULT_STYLES, style];
      onStylesChange(updated);
    } else {
      const base = styles.length > 0 ? styles : DEFAULT_STYLES;
      onStylesChange(base.map(s => s.id === style.id ? style : s));
    }
    setEditing(null);
  }, [editing, styles, onStylesChange]);

  const handleDelete = useCallback((id: string) => {
    const base = styles.length > 0 ? styles : DEFAULT_STYLES;
    onStylesChange(base.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [styles, onStylesChange, selectedId]);

  const handleCaptureFromShape = useCallback(() => {
    const id = selectedShapeIds[0];
    const shape = shapes.find(s => s.id === id);
    if (!shape || shape.type !== 'text') return;
    const captured: TextStyle = {
      id: makeId(),
      name: shape.name || 'Captured Style',
      fontFamily: shape.fontFamily || 'Inter',
      fontSize: shape.fontSize || 16,
      fontWeight: Number(shape.fontWeight) || 400,
      color: shape.color || '#e2e8f0',
      lineHeight: shape.lineHeight || 1.5,
      letterSpacing: (shape.letterSpacing ?? 0) / 100,
      textTransform: 'none',
      fontStyle: (shape.fontStyle as TextStyle['fontStyle']) || 'normal',
      category: 'custom',
    };
    setEditing(captured);
  }, [selectedShapeIds, shapes]);

  const selectedTextShapes = shapes.filter(s => selectedShapeIds.includes(s.id) && s.type === 'text');

  if (!open) return null;

  return (
    <div style={{
      position: 'absolute', top: 48, right: 8, width: 290,
      maxHeight: 'calc(100vh - 120px)',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      zIndex: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>T</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>Text Styles</span>
        {selectedTextShapes.length > 0 && (
          <button
            onClick={handleCaptureFromShape}
            title="Capture style from selected text"
            style={{ padding: '2px 8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 4, color: '#10b981', fontSize: 10, cursor: 'pointer' }}
          >
            ✦ Capture
          </button>
        )}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
      </div>

      {/* Editing form */}
      {editing !== null ? (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--muted, #888)' }}>
              {editing === 'new' ? 'Create new style' : `Edit "${(editing as TextStyle).name}"`}
            </span>
          </div>
          <StyleEditor
            initial={editing === 'new' ? null : editing as TextStyle}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <>
          {/* Search + add */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', gap: 6, flexShrink: 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search styles…"
              style={{
                flex: 1, background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)',
                borderRadius: 5, color: 'var(--text)', fontSize: 11, padding: '4px 8px',
              }}
            />
            <button
              onClick={() => setEditing('new')}
              style={{ padding: '4px 10px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 5, color: 'var(--accent, #6366f1)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
            >
              + New
            </button>
          </div>

          {/* Category filter */}
          <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', gap: 3, flexWrap: 'wrap', flexShrink: 0 }}>
            <button
              onClick={() => setFilterCategory('all')}
              style={{ padding: '2px 7px', borderRadius: 10, fontSize: 9, cursor: 'pointer', border: `1px solid ${filterCategory === 'all' ? 'var(--accent, #6366f1)' : 'transparent'}`, background: filterCategory === 'all' ? 'rgba(99,102,241,0.15)' : 'transparent', color: filterCategory === 'all' ? 'var(--accent, #6366f1)' : 'var(--muted, #888)' }}
            >All</button>
            {(['display', 'heading', 'body', 'label', 'code', 'custom'] as TextStyle['category'][]).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  padding: '2px 7px', borderRadius: 10, fontSize: 9, cursor: 'pointer',
                  border: `1px solid ${filterCategory === cat ? CATEGORY_COLORS[cat] : 'transparent'}`,
                  background: filterCategory === cat ? `${CATEGORY_COLORS[cat]}22` : 'transparent',
                  color: filterCategory === cat ? CATEGORY_COLORS[cat] : 'var(--muted, #888)',
                }}
              >{cat}</button>
            ))}
          </div>

          {/* Selection context */}
          {selectedTextShapes.length > 0 && (
            <div style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid var(--border, #2d2d3d)', fontSize: 11, color: 'var(--accent, #6366f1)', flexShrink: 0 }}>
              {selectedTextShapes.length} text shape{selectedTextShapes.length > 1 ? 's' : ''} selected — double-click or "Apply" to style
            </div>
          )}

          {selectedShapeIds.length > 0 && selectedTextShapes.length === 0 && (
            <div style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid var(--border, #2d2d3d)', fontSize: 11, color: '#f59e0b', flexShrink: 0 }}>
              ⚠ Selected shapes are not text shapes
            </div>
          )}

          {/* Style list grouped */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 8px 8px' }}>
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} style={{ marginBottom: 4 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                  color: CATEGORY_COLORS[category as TextStyle['category']],
                  padding: '6px 2px 3px',
                }}>
                  {category}
                </div>
                {items.map(style => (
                  <StyleCard
                    key={style.id}
                    style={style}
                    isSelected={selectedId === style.id}
                    onSelect={() => setSelectedId(style.id === selectedId ? null : style.id)}
                    onApply={() => handleApply(style)}
                    onEdit={() => setEditing(style)}
                    onDelete={() => handleDelete(style.id)}
                  />
                ))}
              </div>
            ))}

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 24 }}>T</div>
                <div style={{ fontSize: 12, color: 'var(--muted, #888)', marginTop: 8 }}>No styles match</div>
              </div>
            )}
          </div>

          {/* Export CSS */}
          <div style={{ borderTop: '1px solid var(--border, #2d2d3d)', padding: '6px 10px', flexShrink: 0 }}>
            <button
              onClick={() => {
                const css = allStyles.map(s => {
                  const className = s.name.toLowerCase().replace(/\s+/g, '-');
                  return `.${className} {\n  font-family: '${s.fontFamily}', sans-serif;\n  font-size: ${s.fontSize}px;\n  font-weight: ${s.fontWeight};\n  color: ${s.color};\n  line-height: ${s.lineHeight};\n  letter-spacing: ${s.letterSpacing}px;\n  text-transform: ${s.textTransform};\n  font-style: ${s.fontStyle};\n}`;
                }).join('\n\n');
                navigator.clipboard.writeText(css).catch(() => {});
              }}
              style={{ width: '100%', padding: '5px', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 5, color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 10 }}
            >
              Copy all as CSS
            </button>
          </div>
        </>
      )}
    </div>
  );
}
