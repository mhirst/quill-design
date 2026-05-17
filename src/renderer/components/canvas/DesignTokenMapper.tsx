import React, { useState, useMemo, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenCategory = 'color' | 'spacing' | 'typography' | 'border' | 'shadow' | 'opacity';

export type ShapeProperty =
  | 'fill'
  | 'stroke'
  | 'opacity'
  | 'fontSize'
  | 'fontFamily'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
  | 'borderRadius'
  | 'width'
  | 'height';

export interface DesignTokenDef {
  id: string;
  name: string;
  category: TokenCategory;
  value: string | number;
  description?: string;
  group?: string;
}

export interface TokenBinding {
  shapeId: string;
  property: ShapeProperty;
  tokenId: string;
}

// ─── Token utilities ──────────────────────────────────────────────────────────

export function tokenId(): string {
  return 'tk-' + Math.random().toString(36).slice(2, 8);
}

export function getTokensByCategory(tokens: DesignTokenDef[], category: TokenCategory): DesignTokenDef[] {
  return tokens.filter(t => t.category === category);
}

export function getTokensByGroup(tokens: DesignTokenDef[]): Map<string, DesignTokenDef[]> {
  const map = new Map<string, DesignTokenDef[]>();
  for (const token of tokens) {
    const group = token.group ?? 'Default';
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(token);
  }
  return map;
}

export function findBinding(bindings: TokenBinding[], shapeId: string, property: ShapeProperty): TokenBinding | undefined {
  return bindings.find(b => b.shapeId === shapeId && b.property === property);
}

export function unboundProperties(shape: Shape, bindings: TokenBinding[]): ShapeProperty[] {
  const bound = new Set(bindings.filter(b => b.shapeId === shape.id).map(b => b.property));
  const allProps: ShapeProperty[] = ['fill', 'stroke', 'opacity', 'fontSize', 'fontFamily'];
  return allProps.filter(p => !bound.has(p));
}

export function countBindings(bindings: TokenBinding[], shapeId: string): number {
  return bindings.filter(b => b.shapeId === shapeId).length;
}

// ─── Export utilities ─────────────────────────────────────────────────────────

export function exportTokensCSS(tokens: DesignTokenDef[], prefix = 'dt'): string {
  const lines = [':root {'];
  for (const token of tokens) {
    const name = token.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const val = typeof token.value === 'number'
      ? (token.category === 'spacing' || token.category === 'typography' ? `${token.value}px` : String(token.value))
      : token.value;
    lines.push(`  --${prefix}-${name}: ${val};`);
  }
  lines.push('}');
  return lines.join('\n');
}

export function exportTokensJSON(tokens: DesignTokenDef[]): string {
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const token of tokens) {
    if (!grouped[token.category]) grouped[token.category] = {};
    grouped[token.category][token.name] = {
      value: token.value,
      type: token.category,
      description: token.description,
    };
  }
  return JSON.stringify(grouped, null, 2);
}

export function exportTokensFigmaJSON(tokens: DesignTokenDef[]): string {
  // W3C Design Token format
  const result: Record<string, unknown> = {};
  for (const token of tokens) {
    const group = token.group ?? token.category;
    if (!result[group]) result[group] = {};
    (result[group] as Record<string, unknown>)[token.name] = {
      $value: token.value,
      $type: token.category,
      $description: token.description ?? '',
    };
  }
  return JSON.stringify(result, null, 2);
}

export function exportBindingsCSS(bindings: TokenBinding[], tokens: DesignTokenDef[], shapes: Shape[]): string {
  const lines: string[] = [];
  const tokenMap = new Map(tokens.map(t => [t.id, t]));

  for (const shape of shapes) {
    const shapeBindings = bindings.filter(b => b.shapeId === shape.id);
    if (shapeBindings.length === 0) continue;
    const sel = `.shape-${shape.id.slice(-6)}`;
    lines.push(`${sel} {`);
    for (const binding of shapeBindings) {
      const token = tokenMap.get(binding.tokenId);
      if (!token) continue;
      const cssProperty = PROPERTY_TO_CSS[binding.property] ?? binding.property;
      const name = token.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      lines.push(`  ${cssProperty}: var(--dt-${name});`);
    }
    lines.push('}');
  }
  return lines.join('\n');
}

const PROPERTY_TO_CSS: Record<ShapeProperty, string> = {
  fill: 'background-color',
  stroke: 'border-color',
  opacity: 'opacity',
  fontSize: 'font-size',
  fontFamily: 'font-family',
  fontWeight: 'font-weight',
  lineHeight: 'line-height',
  letterSpacing: 'letter-spacing',
  borderRadius: 'border-radius',
  width: 'width',
  height: 'height',
};

// ─── Seed token library ───────────────────────────────────────────────────────

export const DEFAULT_TOKENS: DesignTokenDef[] = [
  // Colors
  { id: tokenId(), name: 'Primary', category: 'color', value: '#6366f1', group: 'Brand', description: 'Brand primary color' },
  { id: tokenId(), name: 'Primary Light', category: 'color', value: '#a5b4fc', group: 'Brand' },
  { id: tokenId(), name: 'Primary Dark', category: 'color', value: '#4338ca', group: 'Brand' },
  { id: tokenId(), name: 'Secondary', category: 'color', value: '#ec4899', group: 'Brand' },
  { id: tokenId(), name: 'Success', category: 'color', value: '#10b981', group: 'Semantic' },
  { id: tokenId(), name: 'Warning', category: 'color', value: '#f59e0b', group: 'Semantic' },
  { id: tokenId(), name: 'Error', category: 'color', value: '#ef4444', group: 'Semantic' },
  { id: tokenId(), name: 'Info', category: 'color', value: '#3b82f6', group: 'Semantic' },
  { id: tokenId(), name: 'Surface', category: 'color', value: '#1e293b', group: 'Neutral' },
  { id: tokenId(), name: 'Background', category: 'color', value: '#0f172a', group: 'Neutral' },
  { id: tokenId(), name: 'Text', category: 'color', value: '#e2e8f0', group: 'Neutral' },
  { id: tokenId(), name: 'Text Muted', category: 'color', value: '#94a3b8', group: 'Neutral' },
  // Spacing
  { id: tokenId(), name: 'xs', category: 'spacing', value: 4, group: 'Scale' },
  { id: tokenId(), name: 'sm', category: 'spacing', value: 8, group: 'Scale' },
  { id: tokenId(), name: 'md', category: 'spacing', value: 16, group: 'Scale' },
  { id: tokenId(), name: 'lg', category: 'spacing', value: 24, group: 'Scale' },
  { id: tokenId(), name: 'xl', category: 'spacing', value: 32, group: 'Scale' },
  { id: tokenId(), name: '2xl', category: 'spacing', value: 48, group: 'Scale' },
  // Typography
  { id: tokenId(), name: 'text-xs', category: 'typography', value: 12, group: 'Size', description: '12px' },
  { id: tokenId(), name: 'text-sm', category: 'typography', value: 14, group: 'Size' },
  { id: tokenId(), name: 'text-base', category: 'typography', value: 16, group: 'Size' },
  { id: tokenId(), name: 'text-lg', category: 'typography', value: 18, group: 'Size' },
  { id: tokenId(), name: 'text-xl', category: 'typography', value: 20, group: 'Size' },
  { id: tokenId(), name: 'text-2xl', category: 'typography', value: 24, group: 'Size' },
  { id: tokenId(), name: 'text-3xl', category: 'typography', value: 30, group: 'Size' },
  { id: tokenId(), name: 'font-normal', category: 'typography', value: 400, group: 'Weight' },
  { id: tokenId(), name: 'font-medium', category: 'typography', value: 500, group: 'Weight' },
  { id: tokenId(), name: 'font-semibold', category: 'typography', value: 600, group: 'Weight' },
  { id: tokenId(), name: 'font-bold', category: 'typography', value: 700, group: 'Weight' },
  // Border
  { id: tokenId(), name: 'radius-sm', category: 'border', value: 4, group: 'Radius' },
  { id: tokenId(), name: 'radius-md', category: 'border', value: 8, group: 'Radius' },
  { id: tokenId(), name: 'radius-lg', category: 'border', value: 12, group: 'Radius' },
  { id: tokenId(), name: 'radius-xl', category: 'border', value: 16, group: 'Radius' },
  { id: tokenId(), name: 'radius-full', category: 'border', value: 9999, group: 'Radius' },
  // Opacity
  { id: tokenId(), name: 'opacity-0', category: 'opacity', value: 0, group: 'Scale' },
  { id: tokenId(), name: 'opacity-50', category: 'opacity', value: 0.5, group: 'Scale' },
  { id: tokenId(), name: 'opacity-75', category: 'opacity', value: 0.75, group: 'Scale' },
  { id: tokenId(), name: 'opacity-100', category: 'opacity', value: 1, group: 'Scale' },
];

const CATEGORY_COLORS: Record<TokenCategory, string> = {
  color: '#f472b6',
  spacing: '#60a5fa',
  typography: '#a78bfa',
  border: '#34d399',
  shadow: '#fbbf24',
  opacity: '#94a3b8',
};

const CATEGORY_ICONS: Record<TokenCategory, string> = {
  color: '●',
  spacing: '↔',
  typography: 'T',
  border: '◻',
  shadow: '◈',
  opacity: '◐',
};

const APPLICABLE_CATEGORIES: Record<ShapeProperty, TokenCategory[]> = {
  fill: ['color'],
  stroke: ['color'],
  opacity: ['opacity'],
  fontSize: ['typography'],
  fontFamily: ['typography'],
  fontWeight: ['typography'],
  lineHeight: ['typography'],
  letterSpacing: ['typography'],
  borderRadius: ['border'],
  width: ['spacing'],
  height: ['spacing'],
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onApplyToken?: (shapeId: string, property: ShapeProperty, value: string | number) => void;
}

type ExportFmt = 'css' | 'json' | 'w3c';
type TabType = 'tokens' | 'bindings' | 'export';

export function DesignTokenMapper({ open, onClose, shapes, onApplyToken }: Props) {
  const [tokens, setTokens] = useState<DesignTokenDef[]>(DEFAULT_TOKENS);
  const [bindings, setBindings] = useState<TokenBinding[]>([]);
  const [tab, setTab] = useState<TabType>('tokens');
  const [catFilter, setCatFilter] = useState<TokenCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [exportFmt, setExportFmt] = useState<ExportFmt>('css');
  const [copied, setCopied] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenValue, setNewTokenValue] = useState('');
  const [newTokenCat, setNewTokenCat] = useState<TokenCategory>('color');

  if (!open) return null;

  const filteredTokens = useMemo(() => {
    let list = catFilter === 'all' ? tokens : tokens.filter(t => t.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || String(t.value).toLowerCase().includes(q));
    }
    return list;
  }, [tokens, catFilter, search]);

  const tokenMap = useMemo(() => new Map(tokens.map(t => [t.id, t])), [tokens]);

  const addToken = () => {
    if (!newTokenName.trim() || !newTokenValue.trim()) return;
    const val = isNaN(Number(newTokenValue)) ? newTokenValue : Number(newTokenValue);
    setTokens(ts => [...ts, {
      id: tokenId(), name: newTokenName.trim(), category: newTokenCat,
      value: val, group: newTokenCat.charAt(0).toUpperCase() + newTokenCat.slice(1),
    }]);
    setNewTokenName('');
    setNewTokenValue('');
  };

  const deleteToken = (id: string) => {
    setTokens(ts => ts.filter(t => t.id !== id));
    setBindings(bs => bs.filter(b => b.tokenId !== id));
  };

  const startEditToken = (token: DesignTokenDef) => {
    setEditingToken(token.id);
    setEditValue(String(token.value));
  };

  const commitEdit = () => {
    if (!editingToken) return;
    const val = isNaN(Number(editValue)) ? editValue : Number(editValue);
    setTokens(ts => ts.map(t => t.id === editingToken ? { ...t, value: val } : t));
    setEditingToken(null);
  };

  const bindToken = useCallback((shapeId: string, property: ShapeProperty, tokenId: string) => {
    setBindings(bs => {
      const filtered = bs.filter(b => !(b.shapeId === shapeId && b.property === property));
      if (!tokenId) return filtered;
      return [...filtered, { shapeId, property, tokenId }];
    });
    const token = tokenMap.get(tokenId);
    if (token && onApplyToken) {
      onApplyToken(shapeId, property, token.value);
    }
  }, [tokenMap, onApplyToken]);

  const getExportText = () => {
    switch (exportFmt) {
      case 'css': return exportTokensCSS(tokens);
      case 'json': return exportTokensJSON(tokens);
      case 'w3c': return exportTokensFigmaJSON(tokens);
    }
  };

  const copyExport = async () => {
    await navigator.clipboard.writeText(getExportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const CATEGORIES: TokenCategory[] = ['color', 'spacing', 'typography', 'border', 'opacity'];
  const PROPERTIES: ShapeProperty[] = ['fill', 'stroke', 'opacity', 'fontSize', 'fontFamily', 'fontWeight', 'borderRadius'];

  const panel: React.CSSProperties = {
    position: 'fixed', top: 60, left: 16, width: 360,
    background: '#0a1020', border: '1px solid #1a2a3a',
    borderRadius: 12, zIndex: 1500, display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
    maxHeight: 'calc(100vh - 80px)',
  };

  const tabBtn = (t: TabType, label: string) => (
    <button onClick={() => setTab(t)} style={{
      flex: 1, padding: '7px 0', fontSize: 12, fontWeight: tab === t ? 700 : 400,
      background: tab === t ? '#1e2a3a' : 'transparent',
      color: tab === t ? '#38bdf8' : '#64748b', border: 'none',
      borderBottom: tab === t ? '2px solid #38bdf8' : '2px solid transparent',
      cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #1a2a3a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#38bdf8' }}>⬡ Design Token Mapper</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
          {tokens.length} tokens · {bindings.length} binding{bindings.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a2a3a', flexShrink: 0 }}>
        {tabBtn('tokens', `Tokens (${tokens.length})`)}
        {tabBtn('bindings', `Bindings (${bindings.length})`)}
        {tabBtn('export', 'Export')}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Tokens tab ── */}
        {tab === 'tokens' && (
          <div>
            {/* Search + filter */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a2a3a' }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tokens…"
                style={{
                  width: '100%', background: '#1e293b', border: '1px solid #334155',
                  borderRadius: 6, color: '#e2e8f0', padding: '5px 10px',
                  fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 6,
                }}
              />
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button onClick={() => setCatFilter('all')} style={{
                  padding: '3px 8px', fontSize: 10, borderRadius: 5,
                  background: catFilter === 'all' ? '#0e4e5e' : '#1e293b',
                  border: '1px solid ' + (catFilter === 'all' ? '#38bdf8' : '#334155'),
                  color: catFilter === 'all' ? '#38bdf8' : '#64748b', cursor: 'pointer',
                }}>All</button>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCatFilter(cat)} style={{
                    padding: '3px 8px', fontSize: 10, borderRadius: 5,
                    background: catFilter === cat ? '#0e4e5e' : '#1e293b',
                    border: '1px solid ' + (catFilter === cat ? CATEGORY_COLORS[cat] : '#334155'),
                    color: catFilter === cat ? CATEGORY_COLORS[cat] : '#64748b', cursor: 'pointer',
                  }}>{CATEGORY_ICONS[cat]} {cat}</button>
                ))}
              </div>
            </div>

            {/* Token list */}
            <div>
              {filteredTokens.map(token => (
                <div key={token.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                  borderBottom: '1px solid #0f1620',
                }}>
                  {/* Value preview */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: token.category === 'color' ? String(token.value) : '#1e293b',
                    border: '1px solid #334155', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {token.category !== 'color' && (
                      <span style={{ fontSize: 9, color: CATEGORY_COLORS[token.category], fontWeight: 700 }}>
                        {CATEGORY_ICONS[token.category]}
                      </span>
                    )}
                  </div>
                  {/* Name + value */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {token.name}
                    </div>
                    {editingToken === token.id ? (
                      <input
                        autoFocus value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingToken(null); }}
                        style={{
                          background: '#0f1629', border: '1px solid #38bdf8', borderRadius: 3,
                          color: '#e2e8f0', padding: '1px 5px', fontSize: 11, outline: 'none',
                          width: '100%', fontFamily: 'monospace',
                        }}
                      />
                    ) : (
                      <div onClick={() => startEditToken(token)} style={{
                        fontSize: 11, color: CATEGORY_COLORS[token.category], fontFamily: 'monospace',
                        cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {String(token.value)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => deleteToken(token.id)} style={{
                    background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, flexShrink: 0,
                  }}>×</button>
                </div>
              ))}
            </div>

            {/* Add new token */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid #1a2a3a' }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>ADD TOKEN</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <input value={newTokenName} onChange={e => setNewTokenName(e.target.value)} placeholder="Name"
                  style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 5, color: '#e2e8f0', padding: '5px 8px', fontSize: 11, outline: 'none' }}
                />
                <input value={newTokenValue} onChange={e => setNewTokenValue(e.target.value)} placeholder="Value"
                  style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 5, color: '#e2e8f0', padding: '5px 8px', fontSize: 11, outline: 'none', fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={newTokenCat} onChange={e => setNewTokenCat(e.target.value as TokenCategory)}
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 5, color: '#e2e8f0', padding: '5px 8px', fontSize: 11 }}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={addToken} disabled={!newTokenName.trim() || !newTokenValue.trim()} style={{
                  padding: '5px 14px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                  background: newTokenName && newTokenValue ? '#0e4e5e' : '#1e293b',
                  border: '1px solid ' + (newTokenName && newTokenValue ? '#38bdf8' : '#334155'),
                  color: newTokenName && newTokenValue ? '#38bdf8' : '#475569', cursor: 'pointer',
                }}>Add</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Bindings tab ── */}
        {tab === 'bindings' && (
          <div>
            {shapes.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                No shapes on canvas.
              </div>
            )}
            {shapes.map(shape => {
              const shapeBindings = bindings.filter(b => b.shapeId === shape.id);
              const isSelected = selectedShape === shape.id;
              return (
                <div key={shape.id} style={{ borderBottom: '1px solid #0f1620' }}>
                  <button
                    onClick={() => setSelectedShape(isSelected ? null : shape.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 12px', background: isSelected ? '#0e4e5e22' : 'none',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shape.name ?? shape.id}
                    </span>
                    <span style={{ fontSize: 10, color: '#475569' }}>{shape.type}</span>
                    {shapeBindings.length > 0 && (
                      <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700 }}>
                        {shapeBindings.length}⬡
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#475569' }}>{isSelected ? '▲' : '▼'}</span>
                  </button>
                  {isSelected && (
                    <div style={{ padding: '4px 12px 10px' }}>
                      {PROPERTIES.map(prop => {
                        const existing = findBinding(bindings, shape.id, prop);
                        const boundToken = existing ? tokenMap.get(existing.tokenId) : null;
                        const applicableCats = APPLICABLE_CATEGORIES[prop] ?? [];
                        const applicableTokens = tokens.filter(t => applicableCats.includes(t.category));
                        return (
                          <div key={prop} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                            <span style={{ fontSize: 10, color: '#64748b', width: 80, flexShrink: 0, fontFamily: 'monospace' }}>{prop}</span>
                            <select
                              value={existing?.tokenId ?? ''}
                              onChange={e => bindToken(shape.id, prop, e.target.value)}
                              style={{
                                flex: 1, background: '#1e293b', border: '1px solid ' + (boundToken ? '#38bdf8' : '#334155'),
                                borderRadius: 4, color: boundToken ? '#38bdf8' : '#94a3b8', padding: '3px 6px', fontSize: 11,
                              }}
                            >
                              <option value="">— unbound —</option>
                              {applicableTokens.map(t => (
                                <option key={t.id} value={t.id}>{t.name}: {t.value}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Export tab ── */}
        {tab === 'export' && (
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['css', 'json', 'w3c'] as ExportFmt[]).map(f => (
                <button key={f} onClick={() => setExportFmt(f)} style={{
                  flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 6,
                  background: exportFmt === f ? '#0e4e5e' : '#1e293b',
                  border: '1px solid ' + (exportFmt === f ? '#38bdf8' : '#334155'),
                  color: exportFmt === f ? '#38bdf8' : '#64748b', cursor: 'pointer',
                }}>{f === 'w3c' ? 'W3C / Figma' : f.toUpperCase()}</button>
              ))}
            </div>
            <pre style={{
              background: '#050a12', border: '1px solid #1a2a3a', borderRadius: 8,
              padding: '10px 12px', fontSize: 10, color: '#38bdf8', fontFamily: 'monospace',
              overflowX: 'auto', maxHeight: 400, margin: '0 0 8px', whiteSpace: 'pre-wrap',
            }}>{getExportText()}</pre>
            <button onClick={copyExport} style={{
              width: '100%', padding: '8px 0',
              background: copied ? '#065f46' : '#1e293b',
              border: '1px solid ' + (copied ? '#10b981' : '#334155'),
              borderRadius: 8, color: copied ? '#6ee7b7' : '#94a3b8',
              fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
            }}>{copied ? '✓ Copied!' : 'Copy to Clipboard'}</button>

            {bindings.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>BINDING CSS</div>
                <pre style={{
                  background: '#050a12', border: '1px solid #1a2a3a', borderRadius: 8,
                  padding: '10px 12px', fontSize: 10, color: '#7dd3fc', fontFamily: 'monospace',
                  overflowX: 'auto', maxHeight: 200, margin: 0, whiteSpace: 'pre-wrap',
                }}>{exportBindingsCSS(bindings, tokens, shapes)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
