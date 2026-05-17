/**
 * TypographyAuditPanel — Typography consistency auditor
 *
 * Features:
 *  - Scans all text shapes and builds a typography inventory
 *  - Detects issues: too many font sizes, mixed font families, missing weights
 *  - Shows a "type ramp" of all font sizes in use
 *  - One-click normalize: snap all sizes to nearest 8pt step
 *  - One-click unify: apply a single font family to all text shapes
 *  - Severity coloring (error/warning/ok)
 *  - Preview of each text shape with its current styles
 */

import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TypographyEntry {
  shapeId: string;
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  fill: string;
  text: string;
}

export interface TypographyIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  affectedIds: string[];
}

// ── Utility exports (tested separately) ──────────────────────────────────────

/** Collect all text shapes into TypographyEntry records */
export function collectTypographyEntries(shapes: Shape[]): TypographyEntry[] {
  return shapes
    .filter(s => s.type === 'text' && s.text && s.text.trim())
    .map((s, i) => ({
      shapeId: s.id,
      label: s.name || `Text ${i + 1}`,
      fontFamily: s.fontFamily || 'Inter',
      fontSize: typeof s.fontSize === 'number' ? s.fontSize : 16,
      fontWeight: s.fontWeight || '400',
      lineHeight: s.lineHeight ? String(s.lineHeight) : '',
      letterSpacing: s.letterSpacing ? String(s.letterSpacing) : '',
      fill: s.fill || '#000000',
      text: (s.text || '').slice(0, 60),
    }));
}

/** Find unique font sizes in use, sorted ascending */
export function uniqueFontSizes(entries: TypographyEntry[]): number[] {
  const sizes = new Set(entries.map(e => e.fontSize));
  return [...sizes].sort((a, b) => a - b);
}

/** Find unique font families in use */
export function uniqueFontFamilies(entries: TypographyEntry[]): string[] {
  const fams = new Set(entries.map(e => e.fontFamily));
  return [...fams].sort();
}

/** Snap a font size to the nearest 8pt grid value */
export function snapTo8pt(size: number): number {
  return Math.round(size / 8) * 8 || 8;
}

/** Snap a font size to the nearest value in a modular scale
 *  (base × ratio^n, for n = 0..10) */
export function snapToModularScale(size: number, base: number, ratio: number): number {
  let bestDiff = Infinity;
  let best = base;
  for (let n = -2; n <= 10; n++) {
    const candidate = base * Math.pow(ratio, n);
    const diff = Math.abs(size - candidate);
    if (diff < bestDiff) { bestDiff = diff; best = candidate; }
  }
  return Math.round(best);
}

/** Audit entries and produce a list of issues */
export function auditTypography(entries: TypographyEntry[]): TypographyIssue[] {
  const issues: TypographyIssue[] = [];
  if (entries.length === 0) return issues;

  const sizes = uniqueFontSizes(entries);
  const families = uniqueFontFamilies(entries);

  // Too many font sizes
  if (sizes.length > 6) {
    issues.push({
      severity: 'error',
      code: 'TOO_MANY_SIZES',
      message: `${sizes.length} different font sizes detected. Recommend ≤ 6 for a clean type scale.`,
      affectedIds: entries.map(e => e.shapeId),
    });
  } else if (sizes.length > 4) {
    issues.push({
      severity: 'warning',
      code: 'MANY_SIZES',
      message: `${sizes.length} different font sizes. Consider trimming to 4–5 for consistency.`,
      affectedIds: entries.map(e => e.shapeId),
    });
  }

  // Too many font families
  if (families.length > 3) {
    issues.push({
      severity: 'error',
      code: 'TOO_MANY_FAMILIES',
      message: `${families.length} font families in use. Limit to 2–3 for visual coherence.`,
      affectedIds: entries.map(e => e.shapeId),
    });
  } else if (families.length > 2) {
    issues.push({
      severity: 'warning',
      code: 'MANY_FAMILIES',
      message: `${families.length} font families. A heading + body pair is usually sufficient.`,
      affectedIds: entries.map(e => e.shapeId),
    });
  }

  // Missing line-height
  const noLineHeight = entries.filter(e => !e.lineHeight);
  if (noLineHeight.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_LINE_HEIGHT',
      message: `${noLineHeight.length} text shape(s) have no explicit line-height set.`,
      affectedIds: noLineHeight.map(e => e.shapeId),
    });
  }

  // Tiny text (below 12px)
  const tiny = entries.filter(e => e.fontSize < 12);
  if (tiny.length > 0) {
    issues.push({
      severity: 'error',
      code: 'TINY_TEXT',
      message: `${tiny.length} text shape(s) below 12px — may be unreadable.`,
      affectedIds: tiny.map(e => e.shapeId),
    });
  }

  // Very large text mixed with body text
  const hasVeryLarge = sizes.some(s => s >= 64);
  const hasSmall = sizes.some(s => s <= 14);
  if (hasVeryLarge && hasSmall && sizes.length <= 3) {
    issues.push({
      severity: 'info',
      code: 'MISSING_INTERMEDIATE',
      message: 'Large display text coexists with small body text — consider adding intermediate sizes.',
      affectedIds: [],
    });
  }

  // Not on 8pt grid
  const offGrid = entries.filter(e => e.fontSize % 8 !== 0 && e.fontSize % 4 !== 0);
  if (offGrid.length > 0) {
    issues.push({
      severity: 'info',
      code: 'OFF_GRID',
      message: `${offGrid.length} text shape(s) have font sizes not on a 4pt grid.`,
      affectedIds: offGrid.map(e => e.shapeId),
    });
  }

  return issues;
}

/** Build patches to snap all text sizes to nearest 8pt */
export function buildSnapPatches(entries: TypographyEntry[]): Array<{ id: string; fontSize: number }> {
  return entries
    .map(e => ({ id: e.shapeId, fontSize: snapTo8pt(e.fontSize) }))
    .filter(p => p.fontSize !== entries.find(e => e.shapeId === p.id)!.fontSize);
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#60a5fa',
};

const SEVERITY_BG = {
  error: '#3a1010',
  warning: '#2a2010',
  info: '#101a2a',
};

const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 380,
  width: 420,
  maxHeight: 'calc(100vh - 80px)',
  background: '#1a0a0a',
  border: '1px solid #3a1a1a',
  borderRadius: 12,
  boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 600,
  fontFamily: 'system-ui, sans-serif',
  color: '#e8d5d5',
  overflow: 'hidden',
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid #3a1a1a',
  flexShrink: 0,
};

const BTN_SM: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #3a1a1a',
  background: '#2a1010',
  color: '#e8d5d5',
  fontSize: 12,
  cursor: 'pointer',
};

const CLOSE_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#a08080',
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
};

const INPUT: React.CSSProperties = {
  background: '#2a1010',
  border: '1px solid #3a1a1a',
  borderRadius: 6,
  color: '#e8d5d5',
  padding: '4px 8px',
  fontSize: 12,
  outline: 'none',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onPatchShapes: (patches: Array<{ id: string; patch: Partial<Shape> }>) => void;
  onSelectShape?: (id: string) => void;
}

type Tab = 'issues' | 'inventory' | 'ramp';

export function TypographyAuditPanel({ open, onClose, shapes, onPatchShapes, onSelectShape }: Props) {
  const [tab, setTab] = useState<Tab>('issues');
  const [unifyFamily, setUnifyFamily] = useState('');
  const [unifyApplied, setUnifyApplied] = useState(false);

  const entries = useMemo(() => collectTypographyEntries(shapes), [shapes]);
  const issues = useMemo(() => auditTypography(entries), [entries]);
  const sizes = useMemo(() => uniqueFontSizes(entries), [entries]);
  const families = useMemo(() => uniqueFontFamilies(entries), [entries]);

  if (!open) return null;

  const handleSnapTo8pt = () => {
    const patches = buildSnapPatches(entries);
    onPatchShapes(patches.map(p => ({ id: p.id, patch: { fontSize: p.fontSize } })));
  };

  const handleUnify = () => {
    const family = unifyFamily.trim();
    if (!family) return;
    onPatchShapes(entries.map(e => ({ id: e.shapeId, patch: { fontFamily: family } })));
    setUnifyApplied(true);
    setTimeout(() => setUnifyApplied(false), 1500);
  };

  const issueCount = issues.filter(i => i.severity === 'error' || i.severity === 'warning').length;

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>Tz</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Typography Audit</span>
          {issueCount > 0 && (
            <span style={{
              background: '#4a1a1a',
              color: '#ef4444',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 700,
            }}>
              {issueCount} issue{issueCount !== 1 ? 's' : ''}
            </span>
          )}
          {issueCount === 0 && entries.length > 0 && (
            <span style={{ background: '#1a3a1a', color: '#22c55e', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
              ✓ Clean
            </span>
          )}
        </div>
        <button style={CLOSE_BTN} onClick={onClose}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
        {(['issues', 'inventory', 'ramp'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #b5533c' : '2px solid transparent',
              color: tab === t ? '#e8d5d5' : '#a08080',
              fontSize: 12,
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t === 'ramp' ? 'Type Ramp' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {entries.length === 0 && (
          <div style={{ textAlign: 'center', color: '#a08080', fontSize: 13, padding: '32px 0' }}>
            No text shapes on canvas.
          </div>
        )}

        {/* ── Issues tab ── */}
        {tab === 'issues' && entries.length > 0 && (
          <div>
            {issues.length === 0 && (
              <div style={{ textAlign: 'center', color: '#22c55e', fontSize: 13, padding: '24px 0' }}>
                ✓ No typography issues detected.
              </div>
            )}
            {issues.map((issue, i) => (
              <div
                key={i}
                style={{
                  background: SEVERITY_BG[issue.severity],
                  border: `1px solid ${SEVERITY_COLOR[issue.severity]}33`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: SEVERITY_COLOR[issue.severity], fontSize: 11, fontWeight: 700 }}>
                    {issue.severity.toUpperCase()}
                  </span>
                  <span style={{ color: '#a08080', fontSize: 10, fontFamily: 'monospace' }}>
                    {issue.code}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#e8d5d5', lineHeight: 1.4 }}>{issue.message}</div>
                {issue.affectedIds.length > 0 && onSelectShape && (
                  <div style={{ fontSize: 11, color: '#a08080', marginTop: 4 }}>
                    {issue.affectedIds.length} shape{issue.affectedIds.length !== 1 ? 's' : ''} affected
                  </div>
                )}
              </div>
            ))}

            {/* Quick fixes */}
            {issues.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid #3a1a1a', paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e8d5d5', marginBottom: 8 }}>Quick Fixes</div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button style={BTN_SM} onClick={handleSnapTo8pt}>
                    Snap all sizes to 8pt grid
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...INPUT, flex: 1 }}
                    placeholder="Font family (e.g. Inter)"
                    value={unifyFamily}
                    onChange={e => setUnifyFamily(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUnify(); }}
                  />
                  <button
                    style={{
                      ...BTN_SM,
                      background: unifyApplied ? '#1a3a1a' : '#2a1010',
                      color: unifyApplied ? '#22c55e' : '#e8d5d5',
                    }}
                    onClick={handleUnify}
                  >
                    {unifyApplied ? '✓ Applied' : 'Unify family'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Inventory tab ── */}
        {tab === 'inventory' && entries.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#a08080' }}>
                {families.length} famil{families.length !== 1 ? 'ies' : 'y'} · {sizes.length} sizes · {entries.length} text shapes
              </div>
            </div>
            {entries.map(entry => (
              <div
                key={entry.shapeId}
                onClick={() => onSelectShape?.(entry.shapeId)}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px solid #2a1010',
                  cursor: onSelectShape ? 'pointer' : 'default',
                  alignItems: 'flex-start',
                }}
              >
                {/* Color dot */}
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: entry.fill || '#e8d5d5',
                  border: '1px solid rgba(255,255,255,0.15)',
                  marginTop: 4,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#e8d5d5', fontWeight: 600, marginBottom: 2 }}>
                    {entry.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#a08080', fontFamily: 'monospace', marginBottom: 2 }}>
                    {entry.fontFamily} · {entry.fontSize}px · w{entry.fontWeight}
                    {entry.lineHeight ? ` · lh ${entry.lineHeight}` : ''}
                  </div>
                  <div style={{
                    fontSize: entry.fontSize > 28 ? 18 : 12,
                    fontFamily: entry.fontFamily,
                    color: '#c0a0a0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {entry.text || '(empty)'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Type Ramp tab ── */}
        {tab === 'ramp' && entries.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#a08080', marginBottom: 12 }}>
              All font sizes in use — largest to smallest
            </div>
            {[...sizes].sort((a, b) => b - a).map(size => {
              const entry = entries.find(e => e.fontSize === size);
              const onGrid = size % 8 === 0;
              const on4pt = size % 4 === 0;
              return (
                <div key={size} style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '6px 0',
                  borderBottom: '1px solid #2a1010',
                }}>
                  <div style={{ fontSize: 11, color: '#a08080', fontFamily: 'monospace', width: 38, flexShrink: 0, textAlign: 'right' }}>
                    {size}px
                  </div>
                  <div style={{
                    fontSize: Math.min(size, 36),
                    fontFamily: entry?.fontFamily || 'Inter',
                    color: '#e8d5d5',
                    overflow: 'hidden',
                    flex: 1,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}>
                    {entry?.text || 'The quick brown fox'}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: onGrid ? '#22c55e' : on4pt ? '#f59e0b' : '#ef4444',
                    flexShrink: 0,
                  }}>
                    {onGrid ? '8pt' : on4pt ? '4pt' : 'off'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #3a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: '#a08080',
        flexShrink: 0,
      }}>
        <span>⌘⌥7 to toggle</span>
        <span>{entries.length} text shapes · {families.length} famil{families.length !== 1 ? 'ies' : 'y'} · {sizes.length} sizes</span>
      </div>
    </div>
  );
}
