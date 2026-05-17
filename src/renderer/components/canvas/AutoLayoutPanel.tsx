/**
 * AutoLayoutPanel — Smart auto-layout for design tool.
 *
 * Arranges selected shapes with configurable direction, gap, padding, alignment,
 * and wrapping. Also supports equal spacing distribution and "stack" presets.
 *
 * Shortcut: ⌘⇧⌥L
 */

import React, { useState, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

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

const DEFAULT_OPTIONS: AutoLayoutOptions = {
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

// ─── Apply logic ──────────────────────────────────────────────────────────────

function sortShapes(shapes: Shape[], sortBy: AutoLayoutOptions['sortBy'], desc: boolean): Shape[] {
  if (sortBy === 'none') return [...shapes];
  const sorted = [...shapes].sort((a, b) => {
    let va = 0, vb = 0;
    if (sortBy === 'x') { va = a.x; vb = b.x; }
    else if (sortBy === 'y') { va = a.y; vb = b.y; }
    else if (sortBy === 'width') { va = a.width; vb = b.width; }
    else if (sortBy === 'height') { va = a.height; vb = b.height; }
    else if (sortBy === 'name') { return desc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name); }
    return desc ? vb - va : va - vb;
  });
  return sorted;
}

export function computeAutoLayout(
  shapes: Shape[],
  opts: AutoLayoutOptions
): { id: string; x: number; y: number }[] {
  if (shapes.length === 0) return [];

  // Sort
  const ordered = sortShapes(shapes, opts.sortBy, opts.sortDesc);

  // Find bounding box origin
  const minX = Math.min(...ordered.map(s => s.x));
  const minY = Math.min(...ordered.map(s => s.y));
  const originX = minX + opts.paddingLeft;
  const originY = minY + opts.paddingTop;

  if (opts.direction === 'horizontal') {
    let cursor = originX;
    const results: { id: string; x: number; y: number }[] = [];
    const maxH = Math.max(...ordered.map(s => s.height));

    // Compute total content width for alignment
    const totalW = ordered.reduce((sum, s) => sum + s.width, 0) + opts.gap * (ordered.length - 1);
    const containerW = Math.max(...ordered.map(s => s.x)) + Math.max(...ordered.map(s => s.width)) - minX + opts.paddingLeft + opts.paddingRight;

    let startX = originX;
    if (opts.mainAlign === 'center') startX = originX + (containerW - totalW) / 2;
    else if (opts.mainAlign === 'end') startX = originX + containerW - totalW - opts.paddingRight;

    cursor = startX;
    for (let i = 0; i < ordered.length; i++) {
      const s = ordered[i];
      let y = originY;
      if (opts.crossAlign === 'center') y = originY + (maxH - s.height) / 2;
      else if (opts.crossAlign === 'end') y = originY + maxH - s.height;
      else if (opts.crossAlign === 'stretch') y = originY;

      if (opts.mainAlign === 'space-between') {
        const spacing = ordered.length > 1 ? (containerW - ordered.reduce((sum, sh) => sum + sh.width, 0) - opts.paddingLeft - opts.paddingRight) / (ordered.length - 1) : 0;
        cursor = i === 0 ? originX : results[i - 1].x + ordered[i - 1].width + spacing;
      } else if (opts.mainAlign === 'space-around') {
        const spacing = (containerW - ordered.reduce((sum, sh) => sum + sh.width, 0)) / ordered.length;
        cursor = originX + spacing / 2 + i * (ordered[i - 1]?.width ?? 0 + spacing);
      }

      results.push({ id: s.id, x: cursor, y });
      if (opts.mainAlign !== 'space-between' && opts.mainAlign !== 'space-around' && opts.mainAlign !== 'space-evenly') {
        cursor += s.width + opts.gap;
      }
    }
    return results;

  } else if (opts.direction === 'vertical') {
    let cursor = originY;
    const results: { id: string; x: number; y: number }[] = [];
    const maxW = Math.max(...ordered.map(s => s.width));
    const totalH = ordered.reduce((sum, s) => sum + s.height, 0) + opts.gap * (ordered.length - 1);
    const containerH = Math.max(...ordered.map(s => s.y)) + Math.max(...ordered.map(s => s.height)) - minY + opts.paddingTop + opts.paddingBottom;

    let startY = originY;
    if (opts.mainAlign === 'center') startY = originY + (containerH - totalH) / 2;
    else if (opts.mainAlign === 'end') startY = originY + containerH - totalH - opts.paddingBottom;

    cursor = startY;
    for (let i = 0; i < ordered.length; i++) {
      const s = ordered[i];
      let x = originX;
      if (opts.crossAlign === 'center') x = originX + (maxW - s.width) / 2;
      else if (opts.crossAlign === 'end') x = originX + maxW - s.width;

      if (opts.mainAlign === 'space-between') {
        const spacing = ordered.length > 1 ? (containerH - ordered.reduce((sum, sh) => sum + sh.height, 0) - opts.paddingTop - opts.paddingBottom) / (ordered.length - 1) : 0;
        cursor = i === 0 ? originY : results[i - 1].y + ordered[i - 1].height + spacing;
      }

      results.push({ id: s.id, x, y: cursor });
      if (opts.mainAlign !== 'space-between' && opts.mainAlign !== 'space-around' && opts.mainAlign !== 'space-evenly') {
        cursor += s.height + opts.gap;
      }
    }
    return results;

  } else {
    // Grid
    const cols = Math.max(1, opts.columns);
    const results: { id: string; x: number; y: number }[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const colW = ordered[col] ? ordered[col].width : 0;
      const rowH = ordered[row * cols] ? ordered[row * cols].height : 0;
      let cx = originX;
      let cy = originY;
      // Simple grid: each cell uses the item's own size + gap
      for (let c = 0; c < col; c++) {
        cx += (ordered[c]?.width ?? 0) + opts.gap;
      }
      for (let r = 0; r < row; r++) {
        const rowItems = ordered.slice(r * cols, (r + 1) * cols);
        cy += Math.max(...rowItems.map(s => s.height), 0) + opts.rowGap;
      }
      results.push({ id: ordered[i].id, x: cx, y: cy });
    }
    return results;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer', border: 'none',
        background: active ? 'rgba(99,102,241,0.2)' : 'var(--surface2, #2a2a3a)',
        color: active ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
        fontWeight: active ? 700 : 400,
        outline: active ? '1px solid rgba(99,102,241,0.4)' : 'none',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}

function NumInput({ value, onChange, label, min = 0, max = 999 }: {
  value: number; onChange: (v: number) => void; label: string; min?: number; max?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
      <span style={{ fontSize: 9, color: 'var(--subtle, #555)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        style={{
          width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)',
          borderRadius: 5, color: 'var(--text, #e2e8f0)', fontSize: 12, padding: '4px 6px',
          textAlign: 'center', outline: 'none',
        }}
      />
    </div>
  );
}

// ─── Direction icon SVG strings ────────────────────────────────────────────────

const DirIcons: Record<Direction, React.ReactNode> = {
  horizontal: (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <rect x="1" y="3" width="4" height="8" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="7" y="3" width="4" height="8" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="13" y="3" width="4" height="8" rx="1" fill="currentColor" opacity="0.7"/>
      <line x1="5" y1="7" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 1"/>
      <line x1="11" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 1"/>
    </svg>
  ),
  vertical: (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
      <rect x="3" y="1" width="8" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="3" y="7" width="8" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="3" y="13" width="8" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <line x1="7" y1="5" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 1"/>
      <line x1="7" y1="11" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 1"/>
    </svg>
  ),
  grid: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
};

// ─── Preset configs ────────────────────────────────────────────────────────────

const PRESETS: { label: string; icon: string; opts: Partial<AutoLayoutOptions> }[] = [
  { label: 'Row', icon: '⇔', opts: { direction: 'horizontal', gap: 16, mainAlign: 'start', crossAlign: 'center' } },
  { label: 'Column', icon: '⇕', opts: { direction: 'vertical', gap: 16, mainAlign: 'start', crossAlign: 'start' } },
  { label: 'Center', icon: '◎', opts: { direction: 'horizontal', mainAlign: 'center', crossAlign: 'center' } },
  { label: 'Spread', icon: '⟺', opts: { direction: 'horizontal', mainAlign: 'space-between', crossAlign: 'center' } },
  { label: 'Grid 3', icon: '⊞', opts: { direction: 'grid', columns: 3, gap: 16, rowGap: 16 } },
  { label: 'Grid 4', icon: '⊟', opts: { direction: 'grid', columns: 4, gap: 12, rowGap: 12 } },
];

// ─── Main align icons ─────────────────────────────────────────────────────────

const MAIN_ALIGNS: { id: MainAlign; label: string }[] = [
  { id: 'start', label: '▏Start' },
  { id: 'center', label: '┼ Center' },
  { id: 'end', label: 'End ▕' },
  { id: 'space-between', label: '↔ Between' },
  { id: 'space-around', label: '↔ Around' },
  { id: 'space-evenly', label: '↔ Even' },
];

const CROSS_ALIGNS: { id: CrossAlign; label: string }[] = [
  { id: 'start', label: '↑ Start' },
  { id: 'center', label: '⊕ Center' },
  { id: 'end', label: '↓ End' },
  { id: 'stretch', label: '↕ Stretch' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShapes: Shape[];
  onUpdateShapes: (updates: { id: string; x: number; y: number }[]) => void;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function AutoLayoutPanel({ open, onClose, selectedShapes, onUpdateShapes }: Props) {
  const [opts, setOpts] = useState<AutoLayoutOptions>(DEFAULT_OPTIONS);
  const [linkedPadding, setLinkedPadding] = useState(true);
  const [applied, setApplied] = useState(false);

  const set = useCallback(<K extends keyof AutoLayoutOptions>(key: K, value: AutoLayoutOptions[K]) => {
    setOpts(o => ({ ...o, [key]: value }));
    setApplied(false);
  }, []);

  const applyPreset = useCallback((partial: Partial<AutoLayoutOptions>) => {
    setOpts(o => ({ ...o, ...partial }));
    setApplied(false);
  }, []);

  const handleApply = useCallback(() => {
    if (selectedShapes.length < 2) return;
    const updates = computeAutoLayout(selectedShapes, opts);
    onUpdateShapes(updates);
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  }, [selectedShapes, opts, onUpdateShapes]);

  const setPad = useCallback((v: number) => {
    if (linkedPadding) {
      setOpts(o => ({ ...o, paddingTop: v, paddingRight: v, paddingBottom: v, paddingLeft: v }));
    }
  }, [linkedPadding]);

  if (!open) return null;

  const count = selectedShapes.length;

  return (
    <div style={{
      position: 'absolute', top: 48, right: 8, width: 300,
      maxHeight: 'calc(100vh - 120px)',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      zIndex: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 13 }}>⟺</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>Auto Layout</span>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)', background: 'var(--surface2, #2a2a3a)', padding: '2px 7px', borderRadius: 8 }}>
          {count} shape{count !== 1 ? 's' : ''}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {/* No selection warning */}
        {count < 2 && (
          <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--muted, #888)', textAlign: 'center', lineHeight: 1.5 }}>
            Select 2 or more shapes to use Auto Layout
          </div>
        )}

        {/* Presets */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Presets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.opts)}
                style={{
                  padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                  background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)',
                  color: 'var(--text, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 13 }}>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Direction */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Direction</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['horizontal', 'vertical', 'grid'] as Direction[]).map(dir => (
              <button
                key={dir}
                onClick={() => set('direction', dir)}
                title={dir.charAt(0).toUpperCase() + dir.slice(1)}
                style={{
                  flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', border: 'none',
                  background: opts.direction === dir ? 'rgba(99,102,241,0.2)' : 'var(--surface2, #2a2a3a)',
                  color: opts.direction === dir ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                  outline: opts.direction === dir ? '1px solid rgba(99,102,241,0.4)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}
              >
                {DirIcons[dir]}
              </button>
            ))}
          </div>
        </div>

        {/* Gap */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Spacing</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <NumInput value={opts.gap} onChange={v => set('gap', v)} label="Gap" />
            {opts.direction === 'grid' && (
              <NumInput value={opts.rowGap} onChange={v => set('rowGap', v)} label="Row Gap" />
            )}
            {opts.direction === 'grid' && (
              <NumInput value={opts.columns} onChange={v => set('columns', v)} label="Columns" min={1} max={20} />
            )}
          </div>
          {/* Gap presets */}
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {[0, 4, 8, 12, 16, 24, 32, 48].map(g => (
              <button
                key={g}
                onClick={() => { set('gap', g); if (opts.direction === 'grid') set('rowGap', g); }}
                style={{
                  flex: 1, padding: '3px 0', fontSize: 10, borderRadius: 4, cursor: 'pointer', border: 'none',
                  background: opts.gap === g ? 'rgba(99,102,241,0.15)' : 'var(--surface2, #2a2a3a)',
                  color: opts.gap === g ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                  outline: opts.gap === g ? '1px solid rgba(99,102,241,0.3)' : 'none',
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Alignment */}
        {opts.direction !== 'grid' && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Main Axis</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {MAIN_ALIGNS.map(a => (
                <Chip key={a.id} label={a.label} active={opts.mainAlign === a.id} onClick={() => set('mainAlign', a.id)} />
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 10, marginBottom: 8 }}>Cross Axis</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {CROSS_ALIGNS.map(a => (
                <Chip key={a.id} label={a.label} active={opts.crossAlign === a.id} onClick={() => set('crossAlign', a.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Padding */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>Padding</span>
            <button
              onClick={() => setLinkedPadding(l => !l)}
              title="Link padding"
              style={{
                background: linkedPadding ? 'rgba(99,102,241,0.15)' : 'var(--surface2, #2a2a3a)',
                border: 'none', borderRadius: 4, cursor: 'pointer',
                color: linkedPadding ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                fontSize: 12, padding: '2px 6px',
              }}
            >
              {linkedPadding ? '🔗' : '🔓'}
            </button>
          </div>
          {linkedPadding ? (
            <NumInput value={opts.paddingTop} onChange={setPad} label="All sides" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <NumInput value={opts.paddingTop} onChange={v => set('paddingTop', v)} label="Top" />
                <NumInput value={opts.paddingBottom} onChange={v => set('paddingBottom', v)} label="Bottom" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <NumInput value={opts.paddingLeft} onChange={v => set('paddingLeft', v)} label="Left" />
                <NumInput value={opts.paddingRight} onChange={v => set('paddingRight', v)} label="Right" />
              </div>
            </div>
          )}
        </div>

        {/* Sort */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>Sort Before Layout</span>
            <button
              onClick={() => set('sortDesc', !opts.sortDesc)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted, #888)', fontSize: 11,
              }}
            >
              {opts.sortDesc ? '↓ Desc' : '↑ Asc'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(['none', 'x', 'y', 'width', 'height', 'name'] as const).map(s => (
              <Chip key={s} label={s === 'none' ? 'Original' : s.charAt(0).toUpperCase() + s.slice(1)} active={opts.sortBy === s} onClick={() => set('sortBy', s)} />
            ))}
          </div>
        </div>

        {/* Visual preview */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Preview</div>
          <AutoLayoutPreview direction={opts.direction} gap={opts.gap} mainAlign={opts.mainAlign} crossAlign={opts.crossAlign} columns={opts.columns} count={Math.min(count, 6)} />
        </div>

        {/* Apply */}
        <div style={{ padding: '10px 12px' }}>
          <button
            onClick={handleApply}
            disabled={count < 2}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, cursor: count < 2 ? 'not-allowed' : 'pointer',
              background: applied ? '#10b981' : count < 2 ? 'var(--surface2, #2a2a3a)' : 'var(--accent, #6366f1)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
              opacity: count < 2 ? 0.5 : 1,
              transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {applied ? '✓ Applied!' : '⟺ Apply Layout'}
          </button>
          {count >= 2 && (
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted, #888)', textAlign: 'center' }}>
              Will arrange {count} shapes · positions update immediately
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Visual preview component ─────────────────────────────────────────────────

function AutoLayoutPreview({ direction, gap, mainAlign, crossAlign, columns, count }: {
  direction: Direction; gap: number; mainAlign: MainAlign; crossAlign: CrossAlign; columns: number; count: number;
}) {
  const W = 260, H = 72;
  const n = Math.max(2, Math.min(count, direction === 'grid' ? 6 : 5));
  const itemW = direction === 'vertical' ? 40 : 28;
  const itemH = direction === 'horizontal' ? 36 : 18;
  const g = Math.max(2, Math.min(gap / 4, 12));

  let items: { x: number; y: number; w: number; h: number }[] = [];

  if (direction === 'horizontal') {
    const totalW = n * itemW + (n - 1) * g;
    let startX = 4;
    if (mainAlign === 'center') startX = (W - totalW) / 2;
    else if (mainAlign === 'end') startX = W - totalW - 4;
    const spaceX = mainAlign === 'space-between' ? (W - 8 - n * itemW) / (n - 1) : g;
    for (let i = 0; i < n; i++) {
      const x = mainAlign === 'space-between' ? 4 + i * (itemW + spaceX) : startX + i * (itemW + g);
      let y = (H - itemH) / 2;
      if (crossAlign === 'start') y = 8;
      else if (crossAlign === 'end') y = H - itemH - 8;
      items.push({ x, y, w: itemW, h: itemH });
    }
  } else if (direction === 'vertical') {
    const totalH = n * itemH + (n - 1) * g;
    let startY = (H - totalH) / 2;
    if (mainAlign === 'start') startY = 4;
    else if (mainAlign === 'end') startY = H - totalH - 4;
    const spaceY = mainAlign === 'space-between' ? (H - 8 - n * itemH) / (n - 1) : g;
    for (let i = 0; i < n; i++) {
      const y = mainAlign === 'space-between' ? 4 + i * (itemH + spaceY) : startY + i * (itemH + g);
      let x = (W - itemW) / 2;
      if (crossAlign === 'start') x = 20;
      else if (crossAlign === 'end') x = W - itemW - 20;
      items.push({ x, y, w: itemW, h: itemH });
    }
  } else {
    const cols = Math.max(1, Math.min(columns, n));
    const cellW = (W - 8 - (cols - 1) * g) / cols;
    const rows = Math.ceil(n / cols);
    const cellH = (H - 8 - (rows - 1) * g) / rows;
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      items.push({ x: 4 + col * (cellW + g), y: 4 + row * (cellH + g), w: cellW, h: cellH });
    }
  }

  return (
    <svg width={W} height={H} style={{ background: 'var(--surface2, #1a1a2e)', borderRadius: 8, display: 'block', border: '1px solid var(--border, #2d2d3d)' }}>
      {/* Gap indicator lines */}
      {items.length > 1 && direction !== 'grid' && items.slice(0, -1).map((item, i) => {
        const next = items[i + 1];
        if (direction === 'horizontal') {
          const mx = item.x + item.w + (next.x - item.x - item.w) / 2;
          return <line key={i} x1={item.x + item.w} y1={H / 2} x2={next.x} y2={H / 2} stroke="rgba(99,102,241,0.3)" strokeWidth="1" strokeDasharray="2 2" />;
        }
        return <line key={i} x1={W / 2} y1={item.y + item.h} x2={W / 2} y2={next.y} stroke="rgba(99,102,241,0.3)" strokeWidth="1" strokeDasharray="2 2" />;
      })}
      {/* Shapes */}
      {items.map((item, i) => (
        <rect
          key={i}
          x={item.x}
          y={item.y}
          width={Math.max(4, item.w)}
          height={Math.max(4, item.h)}
          rx={3}
          fill="rgba(99,102,241,0.3)"
          stroke="rgba(99,102,241,0.6)"
          strokeWidth="1"
        />
      ))}
      {/* Direction arrow */}
      <text x={W - 6} y={H - 5} textAnchor="end" fontSize="9" fill="rgba(99,102,241,0.5)">
        {direction === 'horizontal' ? '→' : direction === 'vertical' ? '↓' : '⊞'}
      </text>
    </svg>
  );
}
