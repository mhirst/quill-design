/**
 * SmartRenamePanel — AI-style auto-rename shapes by type, content, and position.
 *
 * Features:
 *  - Analyzes each shape and suggests a descriptive name
 *  - Rules-based naming: type + content + role + position
 *  - Preview table: current name → suggested name with diff highlighting
 *  - Editable suggestions — click to edit before applying
 *  - Apply all / apply selected / revert
 *  - Custom prefix/suffix support
 *  - Duplicate-detection: appends _2, _3 etc.
 *  - Keyboard: ⌘⇧R to toggle
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onRenameShapes: (renames: { id: string; name: string }[]) => void;
}

interface RenameRow {
  id: string;
  current: string;
  suggested: string;
  editing: string;          // live editable value
  isEditing: boolean;
  selected: boolean;
  type: Shape['type'];
  changed: boolean;         // suggested !== current
}

// ── Smart Naming Logic ─────────────────────────────────────────────────────────

const TYPE_PREFIX: Record<string, string> = {
  frame: 'Frame',
  rectangle: 'Rect',
  ellipse: 'Circle',
  text: 'Text',
  path: 'Path',
};

const ROLE_HINTS: { pattern: RegExp; role: string }[] = [
  // Color patterns
  { pattern: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i, role: 'Swatch' },
  // Text content role detection
  { pattern: /^(heading|title|h[1-6])/i, role: 'Heading' },
  { pattern: /^(body|paragraph|p|text|copy)/i, role: 'Body' },
  { pattern: /^(button|btn|cta)/i, role: 'Button' },
  { pattern: /^(label|tag|chip|badge)/i, role: 'Label' },
  { pattern: /^(icon)/i, role: 'Icon' },
  { pattern: /^(card|tile|panel|box)/i, role: 'Card' },
  { pattern: /^(nav|menu|sidebar|header|footer)/i, role: 'Nav' },
  { pattern: /^(input|field|form|search)/i, role: 'Input' },
  { pattern: /^(avatar|profile|user)/i, role: 'Avatar' },
  { pattern: /^(divider|separator|hr)/i, role: 'Divider' },
  { pattern: /^(background|bg)/i, role: 'Background' },
  { pattern: /^(container|wrapper|section|group)/i, role: 'Container' },
  { pattern: /^(image|img|photo|thumbnail)/i, role: 'Image' },
  { pattern: /^(logo)/i, role: 'Logo' },
  { pattern: /^(tooltip|popover|dropdown|modal)/i, role: 'Overlay' },
  { pattern: /^(chart|graph|diagram)/i, role: 'Chart' },
  { pattern: /^(progress|bar|track)/i, role: 'Progress' },
  { pattern: /^(toggle|switch|checkbox|radio)/i, role: 'Control' },
];

/** Infer a role hint from existing name or text content */
function inferRole(shape: Shape): string | null {
  const nameCheck = (shape.name ?? '').trim();
  const textCheck = (shape.text ?? '').trim();

  for (const { pattern, role } of ROLE_HINTS) {
    if (nameCheck && pattern.test(nameCheck)) return role;
    if (textCheck && pattern.test(textCheck)) return role;
  }
  return null;
}

/** Extract meaningful content from a shape */
function extractContent(shape: Shape): string {
  if (shape.type === 'text' && shape.text) {
    // Take first ~20 chars of text content, title-case first word
    const raw = shape.text.trim().replace(/\s+/g, ' ');
    const snippet = raw.length > 22 ? raw.slice(0, 20) + '…' : raw;
    return snippet;
  }
  if (shape.type === 'frame') {
    // Frames often hold page-level content
    return '';
  }
  return '';
}

/** Describe shape dimensions as a rough aspect ratio hint */
function aspectHint(shape: Shape): string {
  const r = shape.width / Math.max(shape.height, 1);
  if (r > 4) return 'Banner';
  if (r < 0.4) return 'Tall';
  if (shape.width < 40 && shape.height < 40) return 'Sm';
  if (shape.width > 600 || shape.height > 600) return 'Lg';
  return '';
}

/** Describe fill type */
function fillHint(shape: Shape): string {
  if (shape.fillType === 'image' || shape.imageUrl) return 'Img';
  if (shape.fillType === 'linear-gradient' || shape.fillType === 'radial-gradient') return 'Grad';
  if (shape.fillType === 'pattern') return 'Pattern';
  return '';
}

/** Generate a smart suggested name for a shape */
function suggestName(shape: Shape, allShapes: Shape[], index: number): string {
  const type = shape.type;
  const prefix = TYPE_PREFIX[type] ?? 'Shape';

  // 1. Check for role hint from current name / text
  const role = inferRole(shape);
  if (role) {
    const content = extractContent(shape);
    if (content) return `${role} – ${content}`;
    return role;
  }

  // 2. Text shapes: use their content
  if (type === 'text' && shape.text?.trim()) {
    const content = extractContent(shape);
    return `Text – ${content}`;
  }

  // 3. Frame shapes: Artboard or Screen
  if (type === 'frame') {
    const ah = aspectHint(shape);
    if (shape.width >= 375 && shape.width <= 430) return `Mobile Screen ${index + 1}`;
    if (shape.width >= 768 && shape.width <= 1024) return `Tablet Screen ${index + 1}`;
    if (shape.width > 1024) return `Desktop Screen ${index + 1}`;
    return `Frame ${index + 1}`;
  }

  // 4. Ellipse: check if it looks like an avatar
  if (type === 'ellipse') {
    const sq = Math.abs(shape.width - shape.height) < 4;
    if (sq && shape.width < 80) return `Avatar ${index + 1}`;
    if (sq && shape.width >= 80) return `Circle ${index + 1}`;
    return `Ellipse ${index + 1}`;
  }

  // 5. Image fill
  const fh = fillHint(shape);
  if (fh === 'Img') return `Image ${index + 1}`;
  if (fh === 'Grad') return `Gradient ${index + 1}`;

  // 6. Aspect ratio hints for rectangles
  const ah = aspectHint(shape);
  if (ah === 'Banner') return `Banner ${index + 1}`;

  // 7. Tiny square rectangles — likely icons or swatches
  if (type === 'rectangle') {
    const sq = Math.abs(shape.width - shape.height) < 4;
    if (sq && shape.width <= 32) return `Icon ${index + 1}`;
    if (sq && shape.width <= 48) return `Swatch ${index + 1}`;
  }

  // 8. Fall back: prefix + index
  return `${prefix} ${index + 1}`;
}

/** De-duplicate suggested names: if collision, append _2, _3 etc. */
function deduplicateNames(rows: { id: string; suggested: string }[]): Map<string, string> {
  const counts = new Map<string, number>();
  const result = new Map<string, string>();

  for (const row of rows) {
    const base = row.suggested;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    result.set(row.id, n === 1 ? base : `${base} ${n}`);
  }
  return result;
}

// ── Diff Highlight ─────────────────────────────────────────────────────────────

/** Render current/suggested with changed highlight */
function NameDiff({ current, suggested }: { current: string; suggested: string }) {
  const changed = current !== suggested;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <span style={{
        fontSize: 11, color: 'var(--muted, #888)',
        textDecoration: changed ? 'line-through' : 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: 100, flexShrink: 0,
        opacity: changed ? 0.6 : 1,
      }}>
        {current || '(unnamed)'}
      </span>
      {changed && (
        <>
          <span style={{ color: 'var(--muted, #888)', fontSize: 10, flexShrink: 0 }}>→</span>
          <span style={{
            fontSize: 11, color: '#22c55e', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {suggested}
          </span>
        </>
      )}
      {!changed && (
        <span style={{ fontSize: 10, color: 'var(--muted, #888)', opacity: 0.5 }}>same</span>
      )}
    </div>
  );
}

// ── Type Icon ──────────────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: Shape['type'] }) {
  const icons: Record<string, string> = {
    frame: '▣',
    rectangle: '▬',
    ellipse: '●',
    text: 'T',
    path: '⟋',
  };
  const colors: Record<string, string> = {
    frame: '#818cf8',
    rectangle: '#60a5fa',
    ellipse: '#34d399',
    text: '#fb923c',
    path: '#f472b6',
  };
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 3,
      background: `${colors[type] ?? '#888'}22`,
      color: colors[type] ?? '#888',
      fontSize: type === 'text' ? 10 : 9,
      fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icons[type] ?? '■'}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SmartRenamePanel({ open, onClose, shapes, onRenameShapes }: Props) {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [filterChanged, setFilterChanged] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [applied, setApplied] = useState(false);

  // Compute suggested names from shapes
  const suggested = useMemo(() => {
    const raw = shapes.map((s, i) => ({ id: s.id, suggested: suggestName(s, shapes, i) }));
    return deduplicateNames(raw);
  }, [shapes]);

  const rows = useMemo((): RenameRow[] => {
    return shapes.map((s, i) => {
      const base = overrides.get(s.id) ?? suggested.get(s.id) ?? s.name ?? `Shape ${i + 1}`;
      const withPfx = (prefix ? prefix + ' ' : '') + base + (suffix ? ' ' + suffix : '');
      return {
        id: s.id,
        current: s.name ?? '',
        suggested: withPfx,
        editing: editingId === s.id ? editingVal : withPfx,
        isEditing: editingId === s.id,
        selected: true,
        type: s.type,
        changed: (s.name ?? '') !== withPfx,
      };
    });
  }, [shapes, suggested, overrides, prefix, suffix, editingId, editingVal]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(shapes.map(s => s.id)));

  const visibleRows = filterChanged ? rows.filter(r => r.changed) : rows;
  const changedCount = rows.filter(r => r.changed && selectedIds.has(r.id)).length;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map(r => r.id)));
  }, [selectedIds, rows]);

  const startEdit = useCallback((row: RenameRow) => {
    setEditingId(row.id);
    setEditingVal(row.suggested);
  }, []);

  const commitEdit = useCallback((id: string) => {
    if (editingVal.trim()) {
      setOverrides(prev => { const n = new Map(prev); n.set(id, editingVal.trim()); return n; });
    }
    setEditingId(null);
  }, [editingVal]);

  const handleApply = useCallback(() => {
    const toRename = rows
      .filter(r => r.changed && selectedIds.has(r.id))
      .map(r => ({ id: r.id, name: r.suggested }));
    if (toRename.length > 0) {
      onRenameShapes(toRename);
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    }
  }, [rows, selectedIds, onRenameShapes]);

  const handleReset = useCallback(() => {
    setOverrides(new Map());
    setPrefix('');
    setSuffix('');
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      left: 60,
      width: 420,
      maxHeight: '80vh',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      zIndex: 40,
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>✏️</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>Smart Rename</span>
          <span style={{
            fontSize: 9, background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.25)',
            color: '#818cf8', padding: '1px 5px', borderRadius: 4, fontWeight: 600,
          }}>
            {shapes.length} shapes
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {/* ── Prefix / Suffix controls ── */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 3, fontWeight: 600 }}>PREFIX</div>
          <input
            value={prefix}
            onChange={e => setPrefix(e.target.value)}
            placeholder="e.g. App"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg, #131320)',
              border: '1px solid var(--border, #2d2d3d)',
              color: 'var(--text, #e2e8f0)', fontSize: 11,
              padding: '4px 7px', borderRadius: 5, outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 3, fontWeight: 600 }}>SUFFIX</div>
          <input
            value={suffix}
            onChange={e => setSuffix(e.target.value)}
            placeholder="e.g. v2"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg, #131320)',
              border: '1px solid var(--border, #2d2d3d)',
              color: 'var(--text, #e2e8f0)', fontSize: 11,
              padding: '4px 7px', borderRadius: 5, outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <button
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: '1px solid var(--border, #2d2d3d)',
              borderRadius: 5, color: 'var(--muted, #888)',
              fontSize: 10, padding: '4px 8px', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        padding: '6px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0, gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            id="sr-all"
            checked={selectedIds.size === rows.length}
            onChange={toggleAll}
            style={{ cursor: 'pointer', accentColor: '#6366f1' }}
          />
          <label htmlFor="sr-all" style={{ fontSize: 10, color: 'var(--muted, #888)', cursor: 'pointer' }}>
            Select all
          </label>
        </div>
        <button
          onClick={() => setFilterChanged(v => !v)}
          style={{
            background: filterChanged ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: `1px solid ${filterChanged ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
            borderRadius: 4, cursor: 'pointer', fontSize: 10,
            color: filterChanged ? '#818cf8' : 'var(--muted, #888)',
            padding: '2px 8px', height: 22,
          }}
        >
          {filterChanged ? '✓ ' : ''}Changed only ({rows.filter(r => r.changed).length})
        </button>
      </div>

      {/* ── Rename rows ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {visibleRows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted, #888)', fontSize: 11 }}>
            {shapes.length === 0 ? 'No shapes on canvas' : 'All names are already up to date'}
          </div>
        )}
        {visibleRows.map(row => (
          <div
            key={row.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px',
              background: selectedIds.has(row.id) && row.changed ? 'rgba(34,197,94,0.03)' : 'transparent',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}
          >
            {/* Select checkbox */}
            <input
              type="checkbox"
              checked={selectedIds.has(row.id)}
              onChange={() => toggleSelect(row.id)}
              style={{ cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }}
            />

            {/* Type icon */}
            <TypeIcon type={row.type} />

            {/* Name diff or edit field */}
            {row.isEditing ? (
              <input
                autoFocus
                value={editingVal}
                onChange={e => setEditingVal(e.target.value)}
                onBlur={() => commitEdit(row.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(row.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                style={{
                  flex: 1, background: 'var(--bg, #131320)',
                  border: '1px solid rgba(99,102,241,0.5)',
                  color: 'var(--text, #e2e8f0)', fontSize: 11,
                  padding: '3px 7px', borderRadius: 4, outline: 'none',
                }}
              />
            ) : (
              <div
                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                onDoubleClick={() => startEdit(row)}
                title="Double-click to edit"
              >
                <NameDiff current={row.current} suggested={row.suggested} />
              </div>
            )}

            {/* Edit button */}
            {!row.isEditing && (
              <button
                onClick={() => startEdit(row)}
                title="Edit name"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted, #888)', fontSize: 12, padding: '0 2px',
                  flexShrink: 0, opacity: 0.5,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; }}
              >
                ✎
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border, #2d2d3d)',
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
      }}>
        {applied ? (
          <div style={{
            flex: 1, fontSize: 11, color: '#22c55e', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            ✓ {changedCount} shape{changedCount !== 1 ? 's' : ''} renamed
          </div>
        ) : (
          <div style={{ flex: 1, fontSize: 10, color: 'var(--muted, #888)' }}>
            {changedCount} rename{changedCount !== 1 ? 's' : ''} pending
            {' · '}
            <span style={{ opacity: 0.6 }}>double-click to edit</span>
          </div>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 6, color: 'var(--muted, #888)',
            fontSize: 11, padding: '5px 12px', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={changedCount === 0}
          style={{
            background: changedCount > 0 ? 'var(--accent, #6366f1)' : 'rgba(99,102,241,0.2)',
            border: 'none', borderRadius: 6,
            color: changedCount > 0 ? 'white' : 'rgba(255,255,255,0.3)',
            fontSize: 11, fontWeight: 600,
            padding: '5px 14px', cursor: changedCount > 0 ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          Apply {changedCount > 0 ? `(${changedCount})` : ''}
        </button>
      </div>
    </div>
  );
}
