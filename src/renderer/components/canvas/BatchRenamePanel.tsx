/**
 * BatchRenamePanel — rename multiple layers at once with pattern support.
 *
 * Supports:
 *   %n  → auto-incrementing number (1, 2, 3 …)
 *   %N  → zero-padded number (01, 02, 03 …)
 *   %t  → shape type (rectangle, ellipse, …)
 *   %i  → shape id (first 4 chars)
 *   %o  → original name (keep existing)
 *
 * Example:
 *   Pattern: "Card %n"  → "Card 1", "Card 2", "Card 3"
 *   Pattern: "Item %N"  → "Item 01", "Item 02", …
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

interface Props {
  shapes: Shape[];
  selectedIds: string[];
  onRename: (patches: { id: string; name: string }[]) => void;
  onClose: () => void;
}

const QUICK_PATTERNS = [
  { label: 'Numbered', pattern: '%o %n' },
  { label: 'Card %n', pattern: 'Card %n' },
  { label: 'Item %n', pattern: 'Item %n' },
  { label: 'Layer %N', pattern: 'Layer %N' },
  { label: 'Component %n', pattern: 'Component %n' },
  { label: 'Section %n', pattern: 'Section %n' },
  { label: 'Type + #', pattern: '%t %n' },
  { label: 'Frame %N', pattern: 'Frame %N' },
];

function applyPattern(pattern: string, shape: Shape, index: number): string {
  return pattern
    .replace(/%n/g, String(index + 1))
    .replace(/%N/g, String(index + 1).padStart(2, '0'))
    .replace(/%t/g, shape.type)
    .replace(/%i/g, shape.id.slice(0, 4))
    .replace(/%o/g, shape.name);
}

export function BatchRenamePanel({ shapes, selectedIds, onRename, onClose }: Props) {
  const [pattern, setPattern] = useState('%o');
  const [startIndex, setStartIndex] = useState(1);
  const [scope, setScope] = useState<'selected' | 'all' | 'type'>('selected');
  const [typeFilter, setTypeFilter] = useState<Shape['type']>('rectangle');

  const targetShapes = useMemo(() => {
    if (scope === 'selected') {
      return shapes.filter(s => selectedIds.includes(s.id));
    } else if (scope === 'type') {
      return shapes.filter(s => s.type === typeFilter);
    } else {
      return shapes;
    }
  }, [shapes, selectedIds, scope, typeFilter]);

  const previews = useMemo(() => {
    return targetShapes.map((shape, i) => ({
      id: shape.id,
      original: shape.name,
      newName: applyPattern(pattern, shape, i + startIndex - 1),
    }));
  }, [targetShapes, pattern, startIndex]);

  const handleApply = useCallback(() => {
    const patches = previews
      .filter(p => p.newName !== p.original && p.newName.trim() !== '')
      .map(p => ({ id: p.id, name: p.newName.trim() }));
    if (patches.length === 0) { onClose(); return; }
    onRename(patches);
    onClose();
  }, [previews, onRename, onClose]);

  const inputSt: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5,
    color: 'var(--text)',
    fontSize: 12,
    padding: '5px 8px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const changedCount = previews.filter(p => p.newName !== p.original).length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 360,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 60,
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Batch Rename</div>
          <div style={{ fontSize: 10, color: 'var(--subtle)', marginTop: 1 }}>
            {targetShapes.length} layer{targetShapes.length !== 1 ? 's' : ''} · {changedCount} will change
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, padding: 3 }}
        >✕</button>
      </div>

      {/* Controls */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Scope selector */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Apply to</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['selected', 'all', 'type'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                style={{
                  flex: 1, padding: '4px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 11,
                  border: scope === s ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: scope === s ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                  color: scope === s ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: scope === s ? 600 : 400,
                }}
              >
                {s === 'selected' ? `Selection (${selectedIds.length})` : s === 'all' ? `All (${shapes.length})` : 'By type'}
              </button>
            ))}
          </div>
          {scope === 'type' && (
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as Shape['type'])}
              style={{ ...inputSt, marginTop: 6 }}
            >
              <option value="rectangle">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="text">Text</option>
              <option value="frame">Frame</option>
              <option value="path">Path</option>
            </select>
          )}
        </div>

        {/* Pattern input */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Name pattern
          </div>
          <input
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') handleApply();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="e.g. Card %n"
            style={inputSt}
            autoFocus
          />
          <div style={{ fontSize: 9, color: 'var(--subtle)', marginTop: 5, lineHeight: 1.6 }}>
            <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>%n</span> = number &nbsp;
            <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>%N</span> = 0-padded &nbsp;
            <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>%t</span> = type &nbsp;
            <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>%o</span> = original
          </div>
        </div>

        {/* Start number */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--subtle)', whiteSpace: 'nowrap' }}>Start at</div>
          <input
            type="number"
            min={0}
            value={startIndex}
            onChange={e => setStartIndex(parseInt(e.target.value) || 1)}
            onKeyDown={e => e.stopPropagation()}
            style={{ ...inputSt, width: 60, flex: 'none', textAlign: 'center' }}
          />
        </div>

        {/* Quick patterns */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Quick patterns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {QUICK_PATTERNS.map(qp => (
              <button
                key={qp.pattern}
                onClick={() => setPattern(qp.pattern)}
                style={{
                  padding: '3px 7px', borderRadius: 4, cursor: 'pointer', fontSize: 10,
                  border: pattern === qp.pattern ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: pattern === qp.pattern ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                  color: pattern === qp.pattern ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview list */}
      <div style={{ borderTop: '1px solid var(--border)', maxHeight: 160, overflowY: 'auto' }}>
        <div style={{ padding: '6px 14px 4px', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Preview</div>
        {previews.slice(0, 12).map(p => {
          const changed = p.newName !== p.original;
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '3px 14px',
              borderLeft: changed ? '2px solid rgba(99,102,241,0.5)' : '2px solid transparent',
              opacity: changed ? 1 : 0.45,
            }}>
              <div style={{
                flex: 1, fontSize: 10, color: 'var(--muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: changed ? 'line-through' : 'none',
              }}>
                {p.original}
              </div>
              {changed && (
                <>
                  <div style={{ fontSize: 9, color: 'var(--subtle)', flexShrink: 0 }}>→</div>
                  <div style={{
                    flex: 1, fontSize: 10, color: 'var(--accent)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}>
                    {p.newName}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {previews.length > 12 && (
          <div style={{ padding: '3px 14px 6px', fontSize: 9, color: 'var(--subtle)' }}>
            …and {previews.length - 12} more
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 14px',
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '7px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--muted)',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={changedCount === 0}
          style={{
            flex: 2, padding: '7px', borderRadius: 6, cursor: changedCount === 0 ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 600,
            background: changedCount === 0 ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.85)',
            border: '1px solid rgba(99,102,241,0.5)',
            color: changedCount === 0 ? 'var(--muted)' : 'white',
          }}
        >
          Rename {changedCount > 0 ? `${changedCount} layer${changedCount !== 1 ? 's' : ''}` : '(no changes)'}
        </button>
      </div>
    </div>
  );
}
