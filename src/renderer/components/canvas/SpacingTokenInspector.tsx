/**
 * SpacingTokenInspector — Visual spacing gap analyzer and token enforcer
 *
 * Features:
 *  - Measures all horizontal and vertical gaps between adjacent shapes
 *  - Groups by proximity (shapes within vertical/horizontal alignment band)
 *  - Groups identical gaps as "tokens" with frequency count
 *  - Compares against a user-defined spacing scale
 *  - Flags off-scale gaps with suggested snaps
 *  - Define named spacing tokens (xs, sm, md, lg, xl, etc.)
 *  - Export spacing tokens as CSS variables, Tailwind config, JSON
 *  - Select a gap → highlights both shapes
 *  - Sort by frequency or by value
 *  - ⌘⌥⇧X shortcut (note: ⌘⌥⇧X = Accessibility was remapped)
 *
 * Note: ⌘⌥⇧X is actually already used by Accessibility panel
 * So we use ⌘⌥⇧I instead (free combination)
 */

import React, { useState, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Gap {
  id: string;
  axis: 'horizontal' | 'vertical';
  value: number;           // px
  shapeAId: string;
  shapeBId: string;
  shapeAName: string;
  shapeBName: string;
}

export interface SpacingToken {
  id: string;
  name: string;           // e.g. "xs", "sm", "md"
  value: number;          // px
  aliases: string[];      // other names for same value
}

// ── Utilities (exported for tests) ────────────────────────────────────────────

/** Get AABB for a shape */
export function shapeBounds(s: Shape): { left: number; right: number; top: number; bottom: number } {
  return { left: s.x, right: s.x + s.width, top: s.y, bottom: s.y + s.height };
}

/** Measure horizontal gap between two shapes (A is left of B) */
export function horizontalGap(a: Shape, b: Shape): number | null {
  const ba = shapeBounds(a); const bb = shapeBounds(b);
  // b must be to the right
  if (bb.left < ba.right) return null;
  // They must overlap vertically
  const overlapTop = Math.max(ba.top, bb.top);
  const overlapBottom = Math.min(ba.bottom, bb.bottom);
  if (overlapBottom <= overlapTop) return null;
  return Math.round(bb.left - ba.right);
}

/** Measure vertical gap between two shapes (A is above B) */
export function verticalGap(a: Shape, b: Shape): number | null {
  const ba = shapeBounds(a); const bb = shapeBounds(b);
  // b must be below
  if (bb.top < ba.bottom) return null;
  // They must overlap horizontally
  const overlapLeft = Math.max(ba.left, bb.left);
  const overlapRight = Math.min(ba.right, bb.right);
  if (overlapRight <= overlapLeft) return null;
  return Math.round(bb.top - ba.bottom);
}

/** Compute all gaps between all pairs of shapes */
export function computeAllGaps(shapes: Shape[]): Gap[] {
  const gaps: Gap[] = [];
  let gid = 0;
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i]; const b = shapes[j];
      const hg = horizontalGap(a, b);
      if (hg !== null && hg >= 0 && hg < 400) {
        gaps.push({
          id: `g-${gid++}`, axis: 'horizontal', value: hg,
          shapeAId: a.id, shapeBId: b.id,
          shapeAName: a.name || a.type, shapeBName: b.name || b.type,
        });
      }
      const hg2 = horizontalGap(b, a);
      if (hg2 !== null && hg2 >= 0 && hg2 < 400) {
        gaps.push({
          id: `g-${gid++}`, axis: 'horizontal', value: hg2,
          shapeAId: b.id, shapeBId: a.id,
          shapeAName: b.name || b.type, shapeBName: a.name || a.type,
        });
      }
      const vg = verticalGap(a, b);
      if (vg !== null && vg >= 0 && vg < 400) {
        gaps.push({
          id: `g-${gid++}`, axis: 'vertical', value: vg,
          shapeAId: a.id, shapeBId: b.id,
          shapeAName: a.name || a.type, shapeBName: b.name || b.type,
        });
      }
      const vg2 = verticalGap(b, a);
      if (vg2 !== null && vg2 >= 0 && vg2 < 400) {
        gaps.push({
          id: `g-${gid++}`, axis: 'vertical', value: vg2,
          shapeAId: b.id, shapeBId: a.id,
          shapeAName: b.name || b.type, shapeBName: a.name || a.type,
        });
      }
    }
  }
  return gaps;
}

/** Group gaps by value (rounded to nearest 1px) and count frequency */
export function groupGapsByValue(gaps: Gap[]): Array<{ value: number; count: number; ids: string[] }> {
  const map = new Map<number, { count: number; ids: string[] }>();
  for (const g of gaps) {
    const v = Math.round(g.value);
    const entry = map.get(v) ?? { count: 0, ids: [] };
    entry.count++;
    entry.ids.push(g.id);
    map.set(v, entry);
  }
  return [...map.entries()]
    .map(([value, { count, ids }]) => ({ value, count, ids }))
    .sort((a, b) => b.count - a.count);
}

/** Find the nearest value in a spacing scale */
export function nearestScale(value: number, scale: number[]): number {
  if (scale.length === 0) return value;
  return scale.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

/** Check if a gap value is on a spacing scale (within 0.5px tolerance) */
export function isOnSpacingScale(value: number, scale: number[]): boolean {
  return scale.some(s => Math.abs(s - value) <= 0.5);
}

/** Suggest token names based on scale position */
export function suggestTokenName(value: number, scale: number[]): string {
  const sorted = [...scale].sort((a, b) => a - b);
  const idx = sorted.indexOf(value);
  if (idx === -1) return `custom-${value}`;
  const names = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
  return names[idx] ?? `scale-${idx}`;
}

/** Export spacing tokens as CSS variables */
export function exportTokensCSS(tokens: SpacingToken[]): string {
  const vars = tokens.map(t => `  --spacing-${t.name}: ${t.value}px;`).join('\n');
  return `:root {\n${vars}\n}`;
}

/** Export spacing tokens as Tailwind extend config */
export function exportTokensTailwind(tokens: SpacingToken[]): string {
  const entries = tokens.map(t => `    '${t.name}': '${t.value}px',`).join('\n');
  return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      spacing: {\n${entries}\n      }\n    }\n  }\n}`;
}

/** Export spacing tokens as JSON */
export function exportTokensJSON(tokens: SpacingToken[]): string {
  const obj: Record<string, string> = {};
  for (const t of tokens) { obj[t.name] = `${t.value}px`; }
  return JSON.stringify(obj, null, 2);
}

/** Get statistics about gaps */
export function gapStats(gaps: Gap[]): {
  count: number;
  uniqueValues: number;
  minGap: number;
  maxGap: number;
  avgGap: number;
} {
  if (gaps.length === 0) return { count: 0, uniqueValues: 0, minGap: 0, maxGap: 0, avgGap: 0 };
  const values = gaps.map(g => g.value);
  return {
    count: gaps.length,
    uniqueValues: new Set(values.map(v => Math.round(v))).size,
    minGap: Math.min(...values),
    maxGap: Math.max(...values),
    avgGap: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
  };
}

// ── Default spacing scale ─────────────────────────────────────────────────────

const DEFAULT_SCALE = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128];

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed', top: 60, right: 380, width: 400,
  maxHeight: 'calc(100vh - 80px)',
  background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 12,
  boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
  display: 'flex', flexDirection: 'column',
  zIndex: 600, fontFamily: 'system-ui, sans-serif', color: '#e8d5d5', overflow: 'hidden',
};

const BTN_SM: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid #3a1a1a',
  background: '#2a1010', color: '#e8d5d5', fontSize: 12, cursor: 'pointer',
};

const BTN_ACCENT: React.CSSProperties = {
  ...BTN_SM, background: '#b5533c', border: '1px solid #c4644d', color: '#fff',
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
  color: '#9a7a7a', textTransform: 'uppercase' as const, marginBottom: 6,
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onSelectShapes?: (ids: string[]) => void;
}

export function SpacingTokenInspector({ open, onClose, shapes, onSelectShapes }: Props) {
  const [scale, setScale] = useState<number[]>(DEFAULT_SCALE);
  const [scaleInput, setScaleInput] = useState(DEFAULT_SCALE.join(', '));
  const [tokens, setTokens] = useState<SpacingToken[]>([]);
  const [sortBy, setSortBy] = useState<'frequency' | 'value'>('frequency');
  const [filterAxis, setFilterAxis] = useState<'all' | 'horizontal' | 'vertical'>('all');
  const [tab, setTab] = useState<'gaps' | 'tokens' | 'export'>('gaps');
  const [exportFormat, setExportFormat] = useState<'css' | 'tailwind' | 'json'>('css');
  const [copied, setCopied] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenValue, setNewTokenValue] = useState(8);

  if (!open) return null;

  const allGaps = useMemo(() => computeAllGaps(shapes), [shapes]);
  const filteredGaps = filterAxis === 'all' ? allGaps : allGaps.filter(g => g.axis === filterAxis);
  const grouped = useMemo(() => groupGapsByValue(filteredGaps), [filteredGaps]);

  const sorted = sortBy === 'value'
    ? [...grouped].sort((a, b) => a.value - b.value)
    : grouped;

  const stats = useMemo(() => gapStats(allGaps), [allGaps]);

  const exportCode = tab === 'export' ? (
    exportFormat === 'css' ? exportTokensCSS(tokens) :
    exportFormat === 'tailwind' ? exportTokensTailwind(tokens) :
    exportTokensJSON(tokens)
  ) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(exportCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const applyScale = () => {
    const vals = scaleInput.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n >= 0);
    setScale(vals);
  };

  const addToken = () => {
    if (!newTokenName.trim()) return;
    const existing = tokens.find(t => t.name === newTokenName.trim() || t.value === newTokenValue);
    if (existing) return;
    const token: SpacingToken = {
      id: 'tok-' + Math.random().toString(36).slice(2, 6),
      name: newTokenName.trim(),
      value: newTokenValue,
      aliases: [],
    };
    setTokens(prev => [...prev, token].sort((a, b) => a.value - b.value));
    setNewTokenName('');
    setNewTokenValue(newTokenValue + 8);
  };

  const removeToken = (id: string) => setTokens(prev => prev.filter(t => t.id !== id));

  const addFromGap = (value: number) => {
    const name = suggestTokenName(value, scale);
    const exists = tokens.find(t => t.value === value);
    if (!exists) {
      setTokens(prev => [...prev, { id: 'tok-' + Math.random().toString(36).slice(2, 6), name, value, aliases: [] }].sort((a, b) => a.value - b.value));
    }
    setTab('tokens');
  };

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Spacing Inspector</div>
            <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 1 }}>⌘⌥⇧I · {shapes.length} shapes · {allGaps.length} gaps</div>
          </div>
          <button onClick={onClose} style={{ ...BTN_SM, padding: '4px 8px', fontSize: 14, lineHeight: 1 }}>×</button>
        </div>

        {/* Stats row */}
        {allGaps.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[
              { label: 'Gaps', value: stats.count },
              { label: 'Unique', value: stats.uniqueValues },
              { label: 'Min', value: `${stats.minGap}px` },
              { label: 'Max', value: `${stats.maxGap}px` },
              { label: 'Avg', value: `${stats.avgGap}px` },
            ].map(({ label, value }) => (
              <div key={label} style={{ flex: 1, background: '#2a1010', borderRadius: 5, padding: '5px 6px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#b5533c' }}>{value}</div>
                <div style={{ fontSize: 9, color: '#9a7a7a' }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
        {(['gaps', 'tokens', 'export'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid #b5533c' : '2px solid transparent',
            color: tab === t ? '#b5533c' : '#9a7a7a', fontSize: 12,
            fontWeight: tab === t ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' as const,
          }}>
            {t} {t === 'tokens' && tokens.length > 0 ? `(${tokens.length})` : ''}
          </button>
        ))}
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
        {/* ── GAPS TAB ── */}
        {tab === 'gaps' && (
          <div>
            {/* Scale config */}
            <div style={{ marginBottom: 12 }}>
              <div style={SECTION_LABEL}>Spacing Scale</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={scaleInput}
                  onChange={e => setScaleInput(e.target.value)}
                  style={{ flex: 1, padding: '4px 8px', background: '#2a1010', border: '1px solid #3a1a1a', borderRadius: 6, color: '#e8d5d5', fontSize: 11, fontFamily: 'monospace' }}
                />
                <button onClick={applyScale} style={{ ...BTN_SM, fontSize: 11 }}>Apply</button>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
              <button onClick={() => setSortBy('frequency')}
                style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px', ...(sortBy === 'frequency' ? { background: '#3a1a1a' } : {}) }}>
                By Freq
              </button>
              <button onClick={() => setSortBy('value')}
                style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px', ...(sortBy === 'value' ? { background: '#3a1a1a' } : {}) }}>
                By Value
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {(['all', 'horizontal', 'vertical'] as const).map(a => (
                  <button key={a} onClick={() => setFilterAxis(a)}
                    style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px', ...(filterAxis === a ? { background: '#3a1a1a' } : {}) }}>
                    {a === 'all' ? 'All' : a === 'horizontal' ? '→' : '↓'}
                  </button>
                ))}
              </div>
            </div>

            {/* Gap groups */}
            {sorted.length === 0 ? (
              <div style={{ color: '#5a3a3a', fontSize: 13, textAlign: 'center' as const, padding: '24px 0' }}>
                No gaps detected between shapes.<br />
                <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>Shapes need to be adjacent and overlapping in one axis.</span>
              </div>
            ) : (
              sorted.map(({ value, count }) => {
                const onScale = isOnSpacingScale(value, scale);
                const snap = nearestScale(value, scale);
                const deviation = Math.abs(value - snap);
                const token = tokens.find(t => t.value === value);
                return (
                  <div key={value} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6, marginBottom: 3,
                    background: '#0d0505', border: `1px solid ${onScale ? '#10b98122' : '#f59e0b22'}`,
                    borderLeft: `3px solid ${onScale ? '#10b981' : '#f59e0b'}`,
                  }}>
                    {/* Value pill */}
                    <div style={{
                      minWidth: 52, textAlign: 'center' as const, padding: '3px 6px',
                      background: onScale ? '#10b98122' : '#f59e0b22',
                      borderRadius: 5, fontSize: 13, fontWeight: 700,
                      color: onScale ? '#10b981' : '#f59e0b',
                    }}>
                      {value}px
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#9a7a7a' }}>×{count}</span>
                        {token && <span style={{ fontSize: 10, color: '#b5533c', background: '#b5533c22', padding: '1px 5px', borderRadius: 3 }}>{token.name}</span>}
                        {!onScale && scale.length > 0 && (
                          <span style={{ fontSize: 10, color: '#f59e0b' }}>→ {snap}px ({deviation > 0 ? '+' : ''}{value - snap}px)</span>
                        )}
                        {onScale && <span style={{ fontSize: 10, color: '#10b981' }}>✓ on scale</span>}
                      </div>
                    </div>
                    <button onClick={() => addFromGap(value)}
                      title="Add as token"
                      style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px', flexShrink: 0 }}>
                      + Token
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TOKENS TAB ── */}
        {tab === 'tokens' && (
          <div>
            {/* Add token */}
            <div style={{ marginBottom: 14 }}>
              <div style={SECTION_LABEL}>Add Token</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={newTokenName}
                  onChange={e => setNewTokenName(e.target.value)}
                  placeholder="Name (e.g. sm)"
                  onKeyDown={e => { if (e.key === 'Enter') addToken(); }}
                  style={{ flex: 1, padding: '4px 8px', background: '#2a1010', border: '1px solid #3a1a1a', borderRadius: 6, color: '#e8d5d5', fontSize: 12 }}
                />
                <input
                  type="number"
                  value={newTokenValue}
                  min={0}
                  max={512}
                  onChange={e => setNewTokenValue(Number(e.target.value))}
                  style={{ width: 64, padding: '4px 8px', background: '#2a1010', border: '1px solid #3a1a1a', borderRadius: 6, color: '#e8d5d5', fontSize: 12, textAlign: 'right' as const }}
                />
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: '#9a7a7a' }}>px</span>
                <button onClick={addToken} style={BTN_ACCENT}>Add</button>
              </div>
            </div>

            {/* Quick-add from scale */}
            {scale.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={SECTION_LABEL}>Quick Add from Scale</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                  {scale.filter(v => v > 0).slice(0, 12).map(v => (
                    <button
                      key={v}
                      onClick={() => {
                        const name = suggestTokenName(v, scale);
                        const exists = tokens.find(t => t.value === v);
                        if (!exists) {
                          setTokens(prev => [...prev, { id: 'tok-' + Math.random().toString(36).slice(2, 6), name, value: v, aliases: [] }].sort((a, b) => a.value - b.value));
                        }
                      }}
                      style={{
                        ...BTN_SM, fontSize: 11, padding: '3px 8px',
                        ...(tokens.find(t => t.value === v) ? { background: '#10b98122', borderColor: '#10b98144', color: '#10b981' } : {}),
                      }}
                    >
                      {v}px
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Token list */}
            {tokens.length === 0 ? (
              <div style={{ color: '#5a3a3a', fontSize: 13, textAlign: 'center' as const, padding: '24px 0' }}>
                No tokens defined yet.<br />
                <span style={{ fontSize: 11 }}>Use the Gaps tab to add gap values as tokens.</span>
              </div>
            ) : (
              tokens.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', background: '#0d0505', border: '1px solid #2a1a1a',
                  borderRadius: 6, marginBottom: 3,
                }}>
                  <div style={{
                    width: 36, height: 10, borderRadius: 2,
                    background: '#b5533c', marginRight: 2,
                    maxWidth: Math.min(t.value * 0.5, 36),
                  }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#b5533c' }}>--spacing-{t.name}</span>
                    <span style={{ fontSize: 12, color: '#9a7a7a', marginLeft: 8 }}>{t.value}px</span>
                  </div>
                  <button onClick={() => removeToken(t.id)}
                    style={{ ...BTN_SM, fontSize: 11, padding: '2px 6px', color: '#ff6b6b', border: 'none', background: 'none' }}>
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── EXPORT TAB ── */}
        {tab === 'export' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['css', 'tailwind', 'json'] as const).map(f => (
                <button key={f} onClick={() => setExportFormat(f)} style={{
                  ...BTN_SM, flex: 1, fontSize: 11,
                  ...(exportFormat === f ? { background: '#b5533c', borderColor: '#c4644d', color: '#fff' } : {}),
                }}>
                  {f === 'css' ? 'CSS Vars' : f === 'tailwind' ? 'Tailwind' : 'JSON'}
                </button>
              ))}
              <button onClick={handleCopy} style={{ ...BTN_SM, fontSize: 11 }}>
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
            {tokens.length === 0 ? (
              <div style={{ color: '#5a3a3a', fontSize: 13, textAlign: 'center' as const, padding: '20px 0' }}>
                Define tokens first in the Tokens tab.
              </div>
            ) : (
              <pre style={{
                background: '#0d0505', border: '1px solid #3a1a1a', borderRadius: 6,
                padding: '10px 12px', fontSize: 11, color: '#c9b5b5', fontFamily: 'monospace',
                whiteSpace: 'pre-wrap' as const, margin: 0,
              }}>
                {exportCode}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
