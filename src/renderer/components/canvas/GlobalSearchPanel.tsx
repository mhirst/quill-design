/**
 * GlobalSearchPanel — Full-text shape search with bulk operations for Quill.
 *
 * Search across:
 *  - Shape name (contains, starts with, regex)
 *  - Fill color (exact hex or contains)
 *  - Text content (for text shapes)
 *  - Shape type (rectangle, ellipse, text, frame, path)
 *  - Size range (width/height min/max)
 *  - Layer depth (top-level, nested, any)
 *
 * Results:
 *  - Live-filtered as you type
 *  - Click to select individual result
 *  - Checkbox multi-select
 *  - Select all / deselect all
 *
 * Bulk operations on selected results:
 *  - Change fill color
 *  - Set opacity
 *  - Rename with prefix/suffix/pattern
 *  - Delete all
 *  - Snap all to 8px grid
 *
 * Keyboard: ⌘⇧F to toggle (augments existing FindReplace)
 * Actually uses ⌘⌥F
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchField = 'name' | 'fill' | 'text' | 'type' | 'size';
export type SearchMode = 'contains' | 'exact' | 'regex' | 'startsWith';

export interface SearchFilter {
  query: string;
  field: SearchField;
  mode: SearchMode;
  typeFilter: string; // '' = all
  minWidth: number | null;
  maxWidth: number | null;
  minHeight: number | null;
  maxHeight: number | null;
}

export interface BulkOp {
  type: 'fill' | 'opacity' | 'rename' | 'delete' | 'snapGrid';
  fill?: string;
  opacity?: number;
  renameMode?: 'prefix' | 'suffix' | 'replace';
  renameValue?: string;
  renameFrom?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onSelectShapes: (ids: string[]) => void;
  onPatchShapes: (patches: Array<{ id: string; patch: Partial<Shape> }>) => void;
  onDeleteShapes: (ids: string[]) => void;
}

// ─── Search Logic ─────────────────────────────────────────────────────────────

function matchesFilter(shape: Shape, filter: SearchFilter): boolean {
  const { query, field, mode, typeFilter, minWidth, maxWidth, minHeight, maxHeight } = filter;

  // Type filter
  if (typeFilter && shape.type !== typeFilter) return false;

  // Size filters
  if (minWidth !== null && shape.width < minWidth) return false;
  if (maxWidth !== null && shape.width > maxWidth) return false;
  if (minHeight !== null && shape.height < minHeight) return false;
  if (maxHeight !== null && shape.height > maxHeight) return false;

  // Query filter
  if (!query.trim()) return true;

  let haystack = '';
  switch (field) {
    case 'name': haystack = shape.name || ''; break;
    case 'fill': haystack = shape.fill || ''; break;
    case 'text': haystack = shape.text || shape.name || ''; break;
    case 'type': haystack = shape.type; break;
    case 'size': haystack = `${shape.width}x${shape.height}`; break;
  }

  haystack = haystack.toLowerCase();
  const q = query.toLowerCase();

  try {
    switch (mode) {
      case 'contains': return haystack.includes(q);
      case 'exact': return haystack === q;
      case 'startsWith': return haystack.startsWith(q);
      case 'regex': return new RegExp(query, 'i').test(haystack);
    }
  } catch {
    return false; // invalid regex
  }
  return false;
}

// ─── Color Swatch ─────────────────────────────────────────────────────────────

function ColorSwatch({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <div style={{
      width: 10, height: 10, borderRadius: 2, flexShrink: 0,
      background: color, border: '1px solid rgba(255,255,255,0.1)',
    }} />
  );
}

// ─── Shape Row ────────────────────────────────────────────────────────────────

function ShapeRow({ shape, selected, onToggle, onClick }: {
  shape: Shape; selected: boolean;
  onToggle: () => void; onClick: () => void;
}) {
  const ICON: Record<string, string> = {
    rectangle: '▭', ellipse: '○', text: 'T', frame: '⬜', path: '✒',
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', cursor: 'pointer',
        background: selected ? 'rgba(99,102,241,0.12)' : 'transparent',
        borderLeft: `2px solid ${selected ? 'rgba(99,102,241,0.6)' : 'transparent'}`,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <input
        type="checkbox" checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        style={{ accentColor: '#818cf8', cursor: 'pointer', flexShrink: 0 }}
      />
      <span style={{ fontSize: 9, color: 'var(--muted, #666)', flexShrink: 0, width: 12, textAlign: 'center' }}>
        {ICON[shape.type] || '◻'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }} onClick={onClick}>
        <div style={{ fontSize: 10, color: 'var(--text, #e2e8f0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shape.name || `(${shape.type})`}
        </div>
        {shape.text && (
          <div style={{ fontSize: 8, color: 'var(--muted, #666)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{shape.text.slice(0, 40)}"
          </div>
        )}
      </div>
      <ColorSwatch color={shape.fillType === 'solid' ? shape.fill : undefined} />
      <span style={{ fontSize: 8, color: 'var(--muted, #555)', flexShrink: 0, fontFamily: 'monospace' }}>
        {shape.width}×{shape.height}
      </span>
    </div>
  );
}

// ─── Bulk Op Panel ────────────────────────────────────────────────────────────

function BulkOpPanel({ count, onApply, onDelete }: {
  count: number;
  onApply: (op: BulkOp) => void;
  onDelete: () => void;
}) {
  const [activeOp, setActiveOp] = useState<BulkOp['type'] | null>(null);
  const [fillColor, setFillColor] = useState('#6366f1');
  const [opacity, setOpacity] = useState(1);
  const [renameMode, setRenameMode] = useState<'prefix' | 'suffix' | 'replace'>('prefix');
  const [renameValue, setRenameValue] = useState('');
  const [renameFrom, setRenameFrom] = useState('');

  if (count === 0) return null;

  return (
    <div style={{
      padding: '8px 10px', borderTop: '1px solid var(--border, #2d2d3d)',
      background: 'rgba(99,102,241,0.05)', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: activeOp ? 8 : 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#818cf8', flex: 1 }}>
          {count} selected
        </span>
        {(['fill', 'opacity', 'rename', 'snapGrid'] as const).map(op => (
          <button key={op}
            onClick={() => setActiveOp(a => a === op ? null : op)}
            style={{
              fontSize: 7, padding: '2px 6px', borderRadius: 4,
              background: activeOp === op ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${activeOp === op ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
              color: activeOp === op ? '#818cf8' : 'var(--muted, #888)',
              cursor: 'pointer',
            }}>
            {op === 'fill' ? '🎨' : op === 'opacity' ? '💧' : op === 'rename' ? '✏️' : '📐'}
            {' '}{op === 'snapGrid' ? 'Snap' : op.charAt(0).toUpperCase() + op.slice(1)}
          </button>
        ))}
        <button onClick={onDelete}
          style={{
            fontSize: 7, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444', cursor: 'pointer',
          }}>
          🗑 Delete
        </button>
      </div>

      {activeOp === 'fill' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)}
            style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }} />
          <input value={fillColor} onChange={e => setFillColor(e.target.value)}
            style={{ flex: 1, background: 'var(--bg, #131320)', border: '1px solid var(--border, #2d2d3d)', color: 'var(--text, #e2e8f0)', fontSize: 9, padding: '3px 6px', borderRadius: 4, outline: 'none', fontFamily: 'monospace' }} />
          <button onClick={() => { onApply({ type: 'fill', fill: fillColor }); setActiveOp(null); }}
            style={{ fontSize: 8, padding: '3px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>
            Apply
          </button>
        </div>
      )}

      {activeOp === 'opacity' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="range" min={0.05} max={1} step={0.05} value={opacity}
            onChange={e => setOpacity(+e.target.value)}
            style={{ flex: 1, accentColor: '#818cf8', cursor: 'pointer' }} />
          <span style={{ fontSize: 9, color: 'var(--text, #e2e8f0)', width: 32, textAlign: 'right', fontFamily: 'monospace' }}>
            {Math.round(opacity * 100)}%
          </span>
          <button onClick={() => { onApply({ type: 'opacity', opacity }); setActiveOp(null); }}
            style={{ fontSize: 8, padding: '3px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>
            Apply
          </button>
        </div>
      )}

      {activeOp === 'rename' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {(['prefix', 'suffix', 'replace'] as const).map(m => (
              <button key={m} onClick={() => setRenameMode(m)}
                style={{ fontSize: 7, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                  background: renameMode === m ? 'rgba(99,102,241,0.2)' : 'transparent',
                  border: `1px solid ${renameMode === m ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                  color: renameMode === m ? '#818cf8' : 'var(--muted, #666)',
                }}>
                {m}
              </button>
            ))}
          </div>
          {renameMode === 'replace' && (
            <input value={renameFrom} onChange={e => setRenameFrom(e.target.value)}
              placeholder="Find text…"
              style={{ width: '100%', background: 'var(--bg, #131320)', border: '1px solid var(--border, #2d2d3d)', color: 'var(--text, #e2e8f0)', fontSize: 9, padding: '3px 6px', borderRadius: 4, outline: 'none', boxSizing: 'border-box' }} />
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
              placeholder={renameMode === 'prefix' ? 'Add prefix…' : renameMode === 'suffix' ? 'Add suffix…' : 'Replace with…'}
              style={{ flex: 1, background: 'var(--bg, #131320)', border: '1px solid var(--border, #2d2d3d)', color: 'var(--text, #e2e8f0)', fontSize: 9, padding: '3px 6px', borderRadius: 4, outline: 'none' }} />
            <button onClick={() => { onApply({ type: 'rename', renameMode, renameValue, renameFrom }); setActiveOp(null); }}
              style={{ fontSize: 8, padding: '3px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>
              Apply
            </button>
          </div>
        </div>
      )}

      {activeOp === 'snapGrid' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--muted, #888)', flex: 1 }}>
            Snap x, y, width, height to 8px grid
          </span>
          <button onClick={() => { onApply({ type: 'snapGrid' }); setActiveOp(null); }}
            style={{ fontSize: 8, padding: '3px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>
            Snap all
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export function GlobalSearchPanel({ open, onClose, shapes, onSelectShapes, onPatchShapes, onDeleteShapes }: Props) {
  const [filter, setFilter] = useState<SearchFilter>({
    query: '', field: 'name', mode: 'contains',
    typeFilter: '', minWidth: null, maxWidth: null, minHeight: null, maxHeight: null,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    return shapes.filter(s => matchesFilter(s, filter));
  }, [shapes, filter]);

  const allSelected = results.length > 0 && results.every(s => selectedIds.has(s.id));
  const someSelected = results.some(s => selectedIds.has(s.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(s => s.id)));
    }
  }, [allSelected, results]);

  const toggleShape = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAndFocus = useCallback((id: string) => {
    onSelectShapes([id]);
  }, [onSelectShapes]);

  const applyBulkOp = useCallback((op: BulkOp) => {
    const ids = [...selectedIds];
    if (op.type === 'delete') {
      onDeleteShapes(ids);
      setSelectedIds(new Set());
      return;
    }

    const patches = ids.map(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return null;
      let patch: Partial<Shape> = {};

      if (op.type === 'fill' && op.fill) {
        patch = { fill: op.fill, fillType: 'solid' as const };
      } else if (op.type === 'opacity' && op.opacity !== undefined) {
        patch = { opacity: op.opacity };
      } else if (op.type === 'rename') {
        const name = shape.name || '';
        let newName = name;
        if (op.renameMode === 'prefix') newName = `${op.renameValue}${name}`;
        else if (op.renameMode === 'suffix') newName = `${name}${op.renameValue}`;
        else if (op.renameMode === 'replace') newName = name.replaceAll(op.renameFrom ?? '', op.renameValue ?? '');
        patch = { name: newName };
      } else if (op.type === 'snapGrid') {
        const snap = (v: number) => Math.round(v / 8) * 8;
        patch = { x: snap(shape.x), y: snap(shape.y), width: Math.max(8, snap(shape.width)), height: Math.max(8, snap(shape.height)) };
      }

      return { id, patch };
    }).filter(Boolean) as Array<{ id: string; patch: Partial<Shape> }>;

    onPatchShapes(patches);
  }, [selectedIds, shapes, onPatchShapes, onDeleteShapes]);

  // Sync selection to canvas
  const syncToCanvas = useCallback(() => {
    onSelectShapes([...selectedIds]);
  }, [selectedIds, onSelectShapes]);

  if (!open) return null;

  const FIELDS: { id: SearchField; label: string }[] = [
    { id: 'name', label: 'Name' },
    { id: 'fill', label: 'Color' },
    { id: 'text', label: 'Text' },
    { id: 'type', label: 'Type' },
    { id: 'size', label: 'Size' },
  ];

  const MODES: { id: SearchMode; label: string }[] = [
    { id: 'contains', label: 'Contains' },
    { id: 'exact', label: 'Exact' },
    { id: 'startsWith', label: 'Starts with' },
    { id: 'regex', label: 'Regex' },
  ];

  const TYPES = ['', 'rectangle', 'ellipse', 'text', 'frame', 'path'];

  const selectedInResults = results.filter(s => selectedIds.has(s.id)).length;

  return (
    <div style={{
      position: 'absolute', top: 48, left: 60,
      width: 320, maxHeight: 'calc(100vh - 80px)',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 40, display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>🔎</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
            Global Shape Search
          </span>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>
          ×
        </button>
      </div>

      {/* Search input */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
          <input
            ref={inputRef}
            value={filter.query}
            onChange={e => setFilter(f => ({ ...f, query: e.target.value }))}
            placeholder={`Search by ${filter.field}…`}
            autoFocus
            style={{
              flex: 1, background: 'var(--bg, #131320)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: 'var(--text, #e2e8f0)', fontSize: 10,
              padding: '5px 8px', borderRadius: 6, outline: 'none',
            }}
          />
          <button
            onClick={() => setFilter(f => ({ ...f, query: '' }))}
            disabled={!filter.query}
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 6,
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border, #2d2d3d)',
              color: 'var(--muted, #666)', cursor: filter.query ? 'pointer' : 'default',
              opacity: filter.query ? 1 : 0.3,
            }}
          >
            ✕
          </button>
        </div>

        {/* Field + mode selectors */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {FIELDS.map(f => (
              <button key={f.id} onClick={() => setFilter(fi => ({ ...fi, field: f.id }))}
                style={{
                  fontSize: 7, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                  background: filter.field === f.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                  border: `1px solid ${filter.field === f.id ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                  color: filter.field === f.id ? '#818cf8' : 'var(--muted, #666)',
                }}>
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 2 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setFilter(fi => ({ ...fi, mode: m.id }))}
                style={{
                  fontSize: 7, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                  background: filter.mode === m.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                  border: `1px solid ${filter.mode === m.id ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                  color: filter.mode === m.id ? '#818cf8' : 'var(--muted, #555)',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(v => !v)}
          style={{
            marginTop: 5, fontSize: 8, color: 'var(--muted, #666)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          {showAdvanced ? '▲' : '▼'} Advanced filters
        </button>

        {showAdvanced && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {/* Type filter */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #666)', alignSelf: 'center' }}>Type:</span>
              {TYPES.map(t => (
                <button key={t || 'all'} onClick={() => setFilter(f => ({ ...f, typeFilter: t }))}
                  style={{
                    fontSize: 7, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                    background: filter.typeFilter === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                    border: `1px solid ${filter.typeFilter === t ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                    color: filter.typeFilter === t ? '#818cf8' : 'var(--muted, #666)',
                  }}>
                  {t || 'All'}
                </button>
              ))}
            </div>

            {/* Size range */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #666)', flexShrink: 0 }}>W:</span>
              <input type="number" placeholder="min" value={filter.minWidth ?? ''}
                onChange={e => setFilter(f => ({ ...f, minWidth: e.target.value ? +e.target.value : null }))}
                style={{ width: 40, background: 'var(--bg, #131320)', border: '1px solid var(--border, #2d2d3d)', color: 'var(--text, #e2e8f0)', fontSize: 8, padding: '2px 4px', borderRadius: 3, outline: 'none' }} />
              <span style={{ fontSize: 8, color: 'var(--muted, #555)' }}>–</span>
              <input type="number" placeholder="max" value={filter.maxWidth ?? ''}
                onChange={e => setFilter(f => ({ ...f, maxWidth: e.target.value ? +e.target.value : null }))}
                style={{ width: 40, background: 'var(--bg, #131320)', border: '1px solid var(--border, #2d2d3d)', color: 'var(--text, #e2e8f0)', fontSize: 8, padding: '2px 4px', borderRadius: 3, outline: 'none' }} />
              <span style={{ fontSize: 8, color: 'var(--muted, #666)', flexShrink: 0, marginLeft: 4 }}>H:</span>
              <input type="number" placeholder="min" value={filter.minHeight ?? ''}
                onChange={e => setFilter(f => ({ ...f, minHeight: e.target.value ? +e.target.value : null }))}
                style={{ width: 40, background: 'var(--bg, #131320)', border: '1px solid var(--border, #2d2d3d)', color: 'var(--text, #e2e8f0)', fontSize: 8, padding: '2px 4px', borderRadius: 3, outline: 'none' }} />
              <span style={{ fontSize: 8, color: 'var(--muted, #555)' }}>–</span>
              <input type="number" placeholder="max" value={filter.maxHeight ?? ''}
                onChange={e => setFilter(f => ({ ...f, maxHeight: e.target.value ? +e.target.value : null }))}
                style={{ width: 40, background: 'var(--bg, #131320)', border: '1px solid var(--border, #2d2d3d)', color: 'var(--text, #e2e8f0)', fontSize: 8, padding: '2px 4px', borderRadius: 3, outline: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {/* Results header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0,
        background: 'rgba(255,255,255,0.01)',
      }}>
        <input type="checkbox"
          checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleAll}
          style={{ accentColor: '#818cf8', cursor: 'pointer' }} />
        <span style={{ fontSize: 9, color: 'var(--muted, #666)', flex: 1 }}>
          {results.length} match{results.length !== 1 ? 'es' : ''} of {shapes.length} shapes
        </span>
        {selectedInResults > 0 && (
          <button
            onClick={syncToCanvas}
            style={{
              fontSize: 8, padding: '2px 7px', borderRadius: 4,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#818cf8', cursor: 'pointer',
            }}
          >
            ↗ Select on canvas ({selectedInResults})
          </button>
        )}
      </div>

      {/* Results list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {results.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--muted, #666)' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🔍</div>
            <div style={{ fontSize: 10, fontWeight: 600 }}>No matches</div>
            <div style={{ fontSize: 9, marginTop: 2 }}>Try a different search term or mode.</div>
          </div>
        ) : (
          results.map(shape => (
            <ShapeRow
              key={shape.id}
              shape={shape}
              selected={selectedIds.has(shape.id)}
              onToggle={() => toggleShape(shape.id)}
              onClick={() => selectAndFocus(shape.id)}
            />
          ))
        )}
      </div>

      {/* Bulk operations */}
      <BulkOpPanel
        count={selectedInResults}
        onApply={applyBulkOp}
        onDelete={() => {
          onDeleteShapes([...selectedIds].filter(id => results.some(s => s.id === id)));
          setSelectedIds(new Set());
        }}
      />

      {/* Footer */}
      <div style={{
        padding: '4px 10px', borderTop: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0, display: 'flex', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 7, color: 'var(--muted, #555)' }}>
          Click row to focus · Checkbox to multi-select
        </span>
        <span style={{ fontSize: 7, color: 'var(--muted, #555)' }}>⌘⌥F</span>
      </div>
    </div>
  );
}
