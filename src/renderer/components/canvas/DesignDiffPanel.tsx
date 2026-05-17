/**
 * DesignDiffPanel — Design version diff tracker for Quill.
 *
 * Records named snapshots of the shapes array at any point in time.
 * Shows a side-by-side or unified diff between any two snapshots:
 *
 *  🟢 Added shapes (new shapes not in baseline)
 *  🔴 Removed shapes (shapes in baseline but not in current)
 *  🟡 Moved shapes (same id, x/y/width/height changed)
 *  🔵 Restyled shapes (fill/stroke/opacity/font changed)
 *  ⬜ Unchanged
 *
 * Statistics: how many shapes changed, % of canvas affected, time elapsed.
 *
 * Keyboard: ⌘⌥V to toggle
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DesignSnapshot {
  id: string;
  label: string;
  takenAt: Date;
  shapes: SnapshotShape[];
  shapeCount: number;
}

interface SnapshotShape {
  id: string;
  name: string;
  type: string;
  x: number; y: number; width: number; height: number;
  fill?: string; fillType?: string; stroke?: string; strokeWidth?: number;
  opacity?: number; fontSize?: number; fontFamily?: string; text?: string;
  rotation?: number;
}

export type DiffChangeType = 'added' | 'removed' | 'moved' | 'restyled' | 'unchanged' | 'renamed';

export interface DiffEntry {
  id: string;
  type: DiffChangeType;
  shapeName: string;
  shapeType: string;
  before?: SnapshotShape;
  after?: SnapshotShape;
  changes: string[]; // human-readable change list
}

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
}

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 8); }

function snapshotShape(s: Shape): SnapshotShape {
  return {
    id: s.id, name: s.name || '', type: s.type,
    x: Math.round(s.x), y: Math.round(s.y),
    width: Math.round(s.width), height: Math.round(s.height),
    fill: s.fill, fillType: s.fillType,
    stroke: s.stroke, strokeWidth: s.strokeWidth,
    opacity: s.opacity, fontSize: s.fontSize,
    fontFamily: s.fontFamily, text: s.text,
    rotation: s.rotation,
  };
}

function takeSnapshot(shapes: Shape[], label: string): DesignSnapshot {
  return {
    id: uid(), label, takenAt: new Date(),
    shapes: shapes.map(snapshotShape),
    shapeCount: shapes.length,
  };
}

// ─── Diff Engine ──────────────────────────────────────────────────────────────

export function computeDiff(before: DesignSnapshot, after: DesignSnapshot): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const beforeMap = new Map(before.shapes.map(s => [s.id, s]));
  const afterMap = new Map(after.shapes.map(s => [s.id, s]));

  // Added shapes
  for (const [id, shape] of afterMap) {
    if (!beforeMap.has(id)) {
      entries.push({
        id: uid(), type: 'added',
        shapeName: shape.name || shape.type, shapeType: shape.type,
        after: shape, changes: [`Added ${shape.type} "${shape.name || shape.id}"`],
      });
    }
  }

  // Removed shapes
  for (const [id, shape] of beforeMap) {
    if (!afterMap.has(id)) {
      entries.push({
        id: uid(), type: 'removed',
        shapeName: shape.name || shape.type, shapeType: shape.type,
        before: shape, changes: [`Removed ${shape.type} "${shape.name || shape.id}"`],
      });
    }
  }

  // Changed shapes (both exist)
  for (const [id, beforeShape] of beforeMap) {
    const afterShape = afterMap.get(id);
    if (!afterShape) continue;

    const changes: string[] = [];
    let moved = false, restyled = false, renamed = false;

    // Position/size changes
    const posThresh = 0.5;
    if (Math.abs(afterShape.x - beforeShape.x) > posThresh || Math.abs(afterShape.y - beforeShape.y) > posThresh) {
      changes.push(`Moved: (${beforeShape.x}, ${beforeShape.y}) → (${afterShape.x}, ${afterShape.y})`);
      moved = true;
    }
    if (Math.abs(afterShape.width - beforeShape.width) > posThresh || Math.abs(afterShape.height - beforeShape.height) > posThresh) {
      changes.push(`Resized: ${beforeShape.width}×${beforeShape.height} → ${afterShape.width}×${afterShape.height}`);
      moved = true;
    }

    // Style changes
    if (afterShape.fill !== beforeShape.fill) {
      changes.push(`Fill: ${beforeShape.fill || 'none'} → ${afterShape.fill || 'none'}`);
      restyled = true;
    }
    if (afterShape.stroke !== beforeShape.stroke) {
      changes.push(`Stroke: ${beforeShape.stroke || 'none'} → ${afterShape.stroke || 'none'}`);
      restyled = true;
    }
    if (afterShape.opacity !== beforeShape.opacity) {
      changes.push(`Opacity: ${Math.round((beforeShape.opacity ?? 1) * 100)}% → ${Math.round((afterShape.opacity ?? 1) * 100)}%`);
      restyled = true;
    }
    if (afterShape.fontSize !== beforeShape.fontSize && afterShape.fontSize !== undefined) {
      changes.push(`Font size: ${beforeShape.fontSize}px → ${afterShape.fontSize}px`);
      restyled = true;
    }
    if (afterShape.fontFamily !== beforeShape.fontFamily && afterShape.fontFamily) {
      changes.push(`Font: ${beforeShape.fontFamily || '—'} → ${afterShape.fontFamily}`);
      restyled = true;
    }
    if (afterShape.rotation !== beforeShape.rotation) {
      changes.push(`Rotation: ${beforeShape.rotation ?? 0}° → ${afterShape.rotation ?? 0}°`);
      moved = true;
    }

    // Name change
    if (afterShape.name !== beforeShape.name) {
      changes.push(`Renamed: "${beforeShape.name}" → "${afterShape.name}"`);
      renamed = true;
    }

    // Text content change
    if (afterShape.text !== beforeShape.text) {
      changes.push(`Text changed`);
      restyled = true;
    }

    if (changes.length === 0) {
      // Truly unchanged
      entries.push({
        id: uid(), type: 'unchanged',
        shapeName: afterShape.name || afterShape.type, shapeType: afterShape.type,
        before: beforeShape, after: afterShape, changes: [],
      });
    } else {
      const type: DiffChangeType = renamed && !moved && !restyled ? 'renamed'
        : moved && restyled ? 'moved'
        : moved ? 'moved' : 'restyled';
      entries.push({
        id: uid(), type,
        shapeName: afterShape.name || afterShape.type, shapeType: afterShape.type,
        before: beforeShape, after: afterShape, changes,
      });
    }
  }

  // Sort: added → removed → moved → restyled → renamed → unchanged
  const ORDER: Record<DiffChangeType, number> = {
    added: 0, removed: 1, moved: 2, restyled: 3, renamed: 4, unchanged: 5,
  };
  return entries.sort((a, b) => ORDER[a.type] - ORDER[b.type]);
}

// ─── Config ────────────────────────────────────────────────────────────────────

const DIFF_STYLE: Record<DiffChangeType, { color: string; bg: string; icon: string; label: string }> = {
  added:     { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  icon: '+', label: 'Added' },
  removed:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: '−', label: 'Removed' },
  moved:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', icon: '↔', label: 'Moved/Resized' },
  restyled:  { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', icon: '●', label: 'Restyled' },
  renamed:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', icon: 'a', label: 'Renamed' },
  unchanged: { color: '#4b5563', bg: 'transparent',           icon: '·', label: 'Unchanged' },
};

// ─── Components ────────────────────────────────────────────────────────────────

function SnapshotCard({ snap, index, isSelected, onClick, onDelete }: {
  snap: DesignSnapshot; index: number; isSelected: boolean;
  onClick: () => void; onDelete: () => void;
}) {
  const elapsed = Date.now() - snap.takenAt.getTime();
  const elapsedStr = elapsed < 60000 ? `${Math.round(elapsed / 1000)}s ago`
    : elapsed < 3600000 ? `${Math.round(elapsed / 60000)}m ago`
    : `${Math.round(elapsed / 3600000)}h ago`;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '7px 10px', cursor: 'pointer',
        background: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
        borderRadius: 6, marginBottom: 4,
        display: 'flex', alignItems: 'center', gap: 8,
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
    >
      {/* Index badge */}
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: isSelected ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color: isSelected ? '#818cf8' : 'var(--muted, #666)',
        flexShrink: 0,
      }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text, #e2e8f0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {snap.label}
        </div>
        <div style={{ fontSize: 8, color: 'var(--muted, #666)' }}>
          {snap.shapeCount} shapes · {elapsedStr}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted, #555)', fontSize: 11, lineHeight: 1,
          padding: '2px 4px', borderRadius: 3, flexShrink: 0,
          opacity: 0.5,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--muted, #555)'; }}
      >
        ×
      </button>
    </div>
  );
}

function DiffEntryRow({ entry, expanded, onToggle }: {
  entry: DiffEntry; expanded: boolean; onToggle: () => void;
}) {
  if (entry.type === 'unchanged') return null;
  const style = DIFF_STYLE[entry.type];

  return (
    <div style={{
      borderLeft: `3px solid ${style.color}`,
      background: expanded ? style.bg : 'transparent',
      marginBottom: 2, borderRadius: '0 4px 4px 0',
    }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px 5px 6px', cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          width: 14, height: 14, borderRadius: 3,
          background: style.bg, border: `1px solid ${style.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, color: style.color, fontWeight: 700, flexShrink: 0,
        }}>
          {style.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text, #e2e8f0)' }}>
            {entry.shapeName}
          </span>
          <span style={{ fontSize: 8, color: 'var(--muted, #666)', marginLeft: 5 }}>
            {entry.shapeType}
          </span>
        </div>
        <span style={{ fontSize: 8, color: style.color, flexShrink: 0 }}>
          {style.label}
        </span>
        <span style={{ fontSize: 9, color: 'var(--muted, #555)', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && entry.changes.length > 0 && (
        <div style={{ padding: '0 8px 8px 26px' }}>
          {entry.changes.map((change, i) => (
            <div key={i} style={{ fontSize: 9, color: 'var(--muted, #888)', lineHeight: 1.6 }}>
              {change}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export function DesignDiffPanel({ open, onClose, shapes }: Props) {
  const [snapshots, setSnapshots] = useState<DesignSnapshot[]>([]);
  const [baselineIdx, setBaselineIdx] = useState<number | null>(null);
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [selecting, setSelecting] = useState<'baseline' | 'compare' | null>(null);

  const takeSnap = useCallback(() => {
    const label = labelInput.trim() || `Snapshot ${snapshots.length + 1}`;
    const snap = takeSnapshot(shapes, label);
    setSnapshots(prev => {
      const next = [...prev, snap];
      // Auto-set baseline/compare
      if (next.length === 1) setBaselineIdx(0);
      else setCompareIdx(next.length - 1);
      return next;
    });
    setLabelInput('');
  }, [shapes, snapshots.length, labelInput]);

  const deleteSnap = useCallback((idx: number) => {
    setSnapshots(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (baselineIdx === idx) setBaselineIdx(null);
      else if (baselineIdx !== null && baselineIdx > idx) setBaselineIdx(baselineIdx - 1);
      if (compareIdx === idx) setCompareIdx(null);
      else if (compareIdx !== null && compareIdx > idx) setCompareIdx(compareIdx - 1);
      return next;
    });
  }, [baselineIdx, compareIdx]);

  const diff = useMemo(() => {
    if (baselineIdx === null || compareIdx === null) return null;
    if (baselineIdx === compareIdx) return [];
    const baseline = snapshots[baselineIdx];
    const compare = snapshots[compareIdx];
    if (!baseline || !compare) return null;
    return computeDiff(baseline, compare);
  }, [snapshots, baselineIdx, compareIdx]);

  const diffStats = useMemo(() => {
    if (!diff) return null;
    return {
      added: diff.filter(d => d.type === 'added').length,
      removed: diff.filter(d => d.type === 'removed').length,
      moved: diff.filter(d => d.type === 'moved').length,
      restyled: diff.filter(d => d.type === 'restyled').length,
      renamed: diff.filter(d => d.type === 'renamed').length,
      unchanged: diff.filter(d => d.type === 'unchanged').length,
      total: diff.length,
    };
  }, [diff]);

  const visibleDiff = useMemo(() => {
    if (!diff) return [];
    return showUnchanged ? diff : diff.filter(d => d.type !== 'unchanged');
  }, [diff, showUnchanged]);

  if (!open) return null;

  return (
    <div style={{
      position: 'absolute', top: 48, right: 12,
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
          <span style={{ fontSize: 13 }}>📸</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
            Design Diff
          </span>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>
          ×
        </button>
      </div>

      {/* Snapshot input */}
      <div style={{
        padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <input
          value={labelInput}
          onChange={e => setLabelInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && takeSnap()}
          placeholder={`Snapshot ${snapshots.length + 1}`}
          style={{
            flex: 1, background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            color: 'var(--text, #e2e8f0)', fontSize: 9,
            padding: '4px 7px', borderRadius: 5, outline: 'none',
          }}
        />
        <button
          onClick={takeSnap}
          style={{
            fontSize: 9, padding: '4px 10px', borderRadius: 5,
            background: 'rgba(99,102,241,0.2)',
            border: '1px solid rgba(99,102,241,0.3)',
            color: '#818cf8', cursor: 'pointer', fontWeight: 600, flexShrink: 0,
          }}
        >
          📸 Snap
        </button>
      </div>

      {/* Snapshots list */}
      {snapshots.length === 0 ? (
        <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--muted, #666)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📷</div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--muted, #888)' }}>
            No snapshots yet
          </div>
          <div style={{ fontSize: 9, lineHeight: 1.5 }}>
            Take snapshots before and after making changes to see a visual diff of what changed.
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Snapshots section */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--muted, #666)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Snapshots ({snapshots.length})
            </div>

            {/* Baseline / Compare picker */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
              {(['baseline', 'compare'] as const).map(role => {
                const idx = role === 'baseline' ? baselineIdx : compareIdx;
                const snap = idx !== null ? snapshots[idx] : null;
                return (
                  <div
                    key={role}
                    style={{ flex: 1 }}
                  >
                    <div style={{ fontSize: 7, color: 'var(--muted, #555)', marginBottom: 2, textTransform: 'uppercase' }}>
                      {role === 'baseline' ? '⬤ Before' : '⬤ After'}
                    </div>
                    <button
                      onClick={() => setSelecting(s => s === role ? null : role)}
                      style={{
                        width: '100%', padding: '4px 7px', borderRadius: 4, textAlign: 'left',
                        background: selecting === role ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${selecting === role ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                        cursor: 'pointer',
                        color: snap ? 'var(--text, #e2e8f0)' : 'var(--muted, #555)',
                        fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {snap ? snap.label : 'Select…'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Snapshot list */}
            <div style={{ maxHeight: 140, overflowY: 'auto' }}>
              {snapshots.map((snap, i) => (
                <SnapshotCard
                  key={snap.id}
                  snap={snap}
                  index={i}
                  isSelected={i === (selecting === 'baseline' ? baselineIdx : selecting === 'compare' ? compareIdx : -1)}
                  onClick={() => {
                    if (selecting === 'baseline') { setBaselineIdx(i); setSelecting(null); }
                    else if (selecting === 'compare') { setCompareIdx(i); setSelecting(null); }
                    else {
                      // Default: set as compare if baseline already set
                      if (baselineIdx === null) setBaselineIdx(i);
                      else setCompareIdx(i);
                    }
                  }}
                  onDelete={() => deleteSnap(i)}
                />
              ))}
            </div>
          </div>

          {/* Diff view */}
          {diff !== null && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Stats bar */}
              {diffStats && (
                <div style={{
                  padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)',
                  display: 'flex', gap: 6, flexWrap: 'wrap',
                }}>
                  {(Object.entries(diffStats) as Array<[string, number]>)
                    .filter(([key, val]) => key !== 'total' && key !== 'unchanged' && val > 0)
                    .map(([key, val]) => {
                      const s = DIFF_STYLE[key as DiffChangeType];
                      return (
                        <div key={key} style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          background: s.bg, border: `1px solid ${s.color}40`,
                          borderRadius: 4, padding: '2px 6px',
                        }}>
                          <span style={{ fontSize: 9, color: s.color, fontWeight: 700 }}>{val}</span>
                          <span style={{ fontSize: 8, color: s.color }}>{s.label}</span>
                        </div>
                      );
                    })}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={showUnchanged}
                      onChange={e => setShowUnchanged(e.target.checked)}
                      id="show-unchanged" style={{ accentColor: '#818cf8', cursor: 'pointer' }} />
                    <label htmlFor="show-unchanged" style={{ fontSize: 8, color: 'var(--muted, #666)', cursor: 'pointer' }}>
                      Show unchanged
                    </label>
                  </div>
                </div>
              )}

              {/* Diff entries */}
              <div style={{ padding: '8px 10px' }}>
                {visibleDiff.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted, #666)' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>✅</div>
                    <div style={{ fontSize: 10, fontWeight: 600 }}>No changes detected</div>
                    <div style={{ fontSize: 9, marginTop: 2 }}>The two snapshots are identical.</div>
                  </div>
                ) : (
                  visibleDiff.map(entry => (
                    <DiffEntryRow
                      key={entry.id}
                      entry={entry}
                      expanded={expandedId === entry.id}
                      onToggle={() => setExpandedId(id => id === entry.id ? null : entry.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {diff === null && snapshots.length >= 1 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted, #666)' }}>
              <div style={{ fontSize: 9 }}>
                Select two snapshots above to compare them.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '5px 10px', borderTop: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0, display: 'flex', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 8, color: 'var(--muted, #555)' }}>
          {shapes.length} shapes on canvas
        </span>
        <span style={{ fontSize: 8, color: 'var(--muted, #555)' }}>⌘⌥V to toggle</span>
      </div>
    </div>
  );
}
