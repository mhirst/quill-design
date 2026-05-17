import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LayoutMode = 'grid' | 'flex';
export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
export type JustifyContent = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
export type AlignItems = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
export type GridAutoFlow = 'row' | 'column' | 'row dense' | 'column dense';

export interface GridConfig {
  mode: LayoutMode;
  // Grid
  templateColumns: string;
  templateRows: string;
  columnGap: number;
  rowGap: number;
  autoFlow: GridAutoFlow;
  // Flex
  direction: FlexDirection;
  wrap: FlexWrap;
  justifyContent: JustifyContent;
  alignItems: AlignItems;
  flexGap: number;
  // Common
  padding: number;
  containerWidth: number;
  containerHeight: number;
  itemCount: number;
}

export interface ParsedTrack {
  value: string;
  pixels: number;
}

// ─── CSS generation ───────────────────────────────────────────────────────────

export function generateGridCSS(config: GridConfig, selector = '.container'): string {
  const lines: string[] = [`${selector} {`, '  display: grid;'];
  if (config.templateColumns) lines.push(`  grid-template-columns: ${config.templateColumns};`);
  if (config.templateRows) lines.push(`  grid-template-rows: ${config.templateRows};`);
  if (config.columnGap > 0) lines.push(`  column-gap: ${config.columnGap}px;`);
  if (config.rowGap > 0) lines.push(`  row-gap: ${config.rowGap}px;`);
  if (config.autoFlow !== 'row') lines.push(`  grid-auto-flow: ${config.autoFlow};`);
  if (config.padding > 0) lines.push(`  padding: ${config.padding}px;`);
  lines.push('}');
  return lines.join('\n');
}

export function generateFlexCSS(config: GridConfig, selector = '.container'): string {
  const lines: string[] = [`${selector} {`, '  display: flex;'];
  if (config.direction !== 'row') lines.push(`  flex-direction: ${config.direction};`);
  if (config.wrap !== 'nowrap') lines.push(`  flex-wrap: ${config.wrap};`);
  if (config.justifyContent !== 'flex-start') lines.push(`  justify-content: ${config.justifyContent};`);
  if (config.alignItems !== 'stretch') lines.push(`  align-items: ${config.alignItems};`);
  if (config.flexGap > 0) lines.push(`  gap: ${config.flexGap}px;`);
  if (config.padding > 0) lines.push(`  padding: ${config.padding}px;`);
  lines.push('}');
  return lines.join('\n');
}

export function generateCSS(config: GridConfig, selector?: string): string {
  return config.mode === 'grid'
    ? generateGridCSS(config, selector)
    : generateFlexCSS(config, selector);
}

// ─── Track parsing ────────────────────────────────────────────────────────────

export function parseTrackList(template: string, containerSize: number): ParsedTrack[] {
  if (!template.trim()) return [];
  // Handle repeat()
  const expanded = template.replace(/repeat\((\d+),\s*([^)]+)\)/g, (_, count, value) => {
    return Array(parseInt(count)).fill(value.trim()).join(' ');
  });
  const tokens = expanded.split(/\s+/).filter(Boolean);
  const tracks: ParsedTrack[] = [];
  const totalFr = tokens.reduce((sum, t) => sum + (t.endsWith('fr') ? parseFloat(t) : 0), 0);
  const fixedTotal = tokens.reduce((sum, t) => {
    if (t.endsWith('px')) return sum + parseFloat(t);
    if (t.endsWith('%')) return sum + (parseFloat(t) / 100) * containerSize;
    return sum;
  }, 0);
  const frUnit = totalFr > 0 ? (containerSize - fixedTotal) / totalFr : 0;

  for (const token of tokens) {
    let px = 0;
    if (token.endsWith('fr')) px = parseFloat(token) * frUnit;
    else if (token.endsWith('px')) px = parseFloat(token);
    else if (token.endsWith('%')) px = (parseFloat(token) / 100) * containerSize;
    else if (token === 'auto') px = containerSize / tokens.length;
    tracks.push({ value: token, pixels: Math.max(0, px) });
  }
  return tracks;
}

export function columnCount(template: string): number {
  return parseTrackList(template, 1000).length;
}

// ─── Preset templates ─────────────────────────────────────────────────────────

export interface GridPreset {
  name: string;
  mode: LayoutMode;
  templateColumns?: string;
  templateRows?: string;
  direction?: FlexDirection;
  wrap?: FlexWrap;
  justifyContent?: JustifyContent;
  columnGap?: number;
  rowGap?: number;
  flexGap?: number;
}

export const GRID_PRESETS: GridPreset[] = [
  { name: '12-Col Grid', mode: 'grid', templateColumns: 'repeat(12, 1fr)', columnGap: 16 },
  { name: '3-Col Equal', mode: 'grid', templateColumns: 'repeat(3, 1fr)', columnGap: 24 },
  { name: 'Holy Grail', mode: 'grid', templateColumns: '200px 1fr 200px', columnGap: 16 },
  { name: 'Card Grid', mode: 'grid', templateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', columnGap: 20, rowGap: 20 },
  { name: '2-Col Asymm', mode: 'grid', templateColumns: '2fr 1fr', columnGap: 24 },
  { name: 'Flex Row', mode: 'flex', direction: 'row', wrap: 'wrap', justifyContent: 'flex-start', flexGap: 16 },
  { name: 'Flex Center', mode: 'flex', direction: 'row', justifyContent: 'center', flexGap: 16 },
  { name: 'Flex Space-Between', mode: 'flex', direction: 'row', justifyContent: 'space-between' },
  { name: 'Flex Column', mode: 'flex', direction: 'column', flexGap: 12 },
  { name: 'Sidebar Layout', mode: 'grid', templateColumns: '280px 1fr', columnGap: 0 },
];

export const DEFAULT_CONFIG: GridConfig = {
  mode: 'grid',
  templateColumns: 'repeat(3, 1fr)',
  templateRows: '',
  columnGap: 16,
  rowGap: 16,
  autoFlow: 'row',
  direction: 'row',
  wrap: 'wrap',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  flexGap: 16,
  padding: 0,
  containerWidth: 800,
  containerHeight: 400,
  itemCount: 6,
};

// ─── Visual preview helpers ───────────────────────────────────────────────────

export function computeGridCells(config: GridConfig): Array<{ x: number; y: number; w: number; h: number }> {
  const cols = parseTrackList(config.templateColumns, config.containerWidth - config.padding * 2);
  const defaultRowH = 80;
  const cells: Array<{ x: number; y: number; w: number; h: number }> = [];
  const colCount = cols.length || 1;
  const rowCount = Math.ceil(config.itemCount / colCount);
  let x = config.padding, y = config.padding;

  for (let r = 0; r < rowCount; r++) {
    x = config.padding;
    for (let c = 0; c < colCount; c++) {
      const idx = r * colCount + c;
      if (idx >= config.itemCount) break;
      const colW = cols[c]?.pixels ?? 0;
      cells.push({ x, y, w: colW, h: defaultRowH });
      x += colW + config.columnGap;
    }
    y += defaultRowH + config.rowGap;
  }
  return cells;
}

export function computeFlexCells(config: GridConfig): Array<{ x: number; y: number; w: number; h: number }> {
  const itemW = 100, itemH = 60;
  const totalW = config.containerWidth - config.padding * 2;
  const cells: Array<{ x: number; y: number; w: number; h: number }> = [];
  let x = config.padding, y = config.padding;

  for (let i = 0; i < config.itemCount; i++) {
    if (config.wrap !== 'nowrap' && x + itemW > totalW + config.padding && i > 0) {
      x = config.padding;
      y += itemH + config.flexGap;
    }
    cells.push({ x, y, w: itemW, h: itemH });
    x += itemW + config.flexGap;
  }
  return cells;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

const ITEM_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

export function CSSGridVisualizerPanel({ open, onClose }: Props) {
  const [config, setConfig] = useState<GridConfig>(DEFAULT_CONFIG);
  const [copied, setCopied] = useState(false);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  if (!open) return null;

  const set = <K extends keyof GridConfig>(key: K, value: GridConfig[K]) =>
    setConfig(c => ({ ...c, [key]: value }));

  const applyPreset = (preset: GridPreset) => {
    setConfig(c => ({
      ...c,
      mode: preset.mode,
      templateColumns: preset.templateColumns ?? c.templateColumns,
      templateRows: preset.templateRows ?? c.templateRows,
      direction: preset.direction ?? c.direction,
      wrap: preset.wrap ?? c.wrap,
      justifyContent: preset.justifyContent ?? c.justifyContent,
      columnGap: preset.columnGap ?? c.columnGap,
      rowGap: preset.rowGap ?? c.rowGap,
      flexGap: preset.flexGap ?? c.flexGap,
    }));
  };

  const cssCode = useMemo(() => generateCSS(config), [config]);

  const cells = useMemo(() => {
    return config.mode === 'grid'
      ? computeGridCells(config)
      : computeFlexCells(config);
  }, [config]);

  const previewScale = Math.min(1, 310 / config.containerWidth);
  const previewW = config.containerWidth * previewScale;
  const previewH = Math.max(120, (cells.reduce((m, c) => Math.max(m, c.y + c.h), 0) + config.padding) * previewScale);

  const copyCSS = async () => {
    await navigator.clipboard.writeText(cssCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const panel: React.CSSProperties = {
    position: 'fixed', top: 60, left: 16, width: 360,
    background: '#0f1629', border: '1px solid #1e2a45',
    borderRadius: 12, zIndex: 1500, display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
    maxHeight: 'calc(100vh - 80px)',
  };

  const label: React.CSSProperties = { fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3 };
  const input: React.CSSProperties = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', padding: '5px 8px', fontSize: 12,
    fontFamily: 'monospace', outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const select: React.CSSProperties = { ...input, cursor: 'pointer' };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #1e2a45', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#67e8f9' }}>⊞ CSS Grid Visualizer</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Mode toggle */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2a45' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['grid', 'flex'] as LayoutMode[]).map(m => (
              <button key={m} onClick={() => set('mode', m)} style={{
                flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 700,
                borderRadius: 8, border: '1px solid ' + (config.mode === m ? '#67e8f9' : '#334155'),
                background: config.mode === m ? '#0e4e5e' : '#1e293b',
                color: config.mode === m ? '#67e8f9' : '#94a3b8', cursor: 'pointer',
              }}>{m === 'grid' ? '⊞ Grid' : '⇌ Flex'}</button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2a45' }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>PRESETS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {GRID_PRESETS.filter(p => p.mode === config.mode).map(preset => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                onMouseEnter={() => setHoveredPreset(preset.name)}
                onMouseLeave={() => setHoveredPreset(null)}
                style={{
                  padding: '4px 8px', fontSize: 10, borderRadius: 6,
                  background: hoveredPreset === preset.name ? '#0e4e5e' : '#1e293b',
                  border: '1px solid ' + (hoveredPreset === preset.name ? '#67e8f9' : '#334155'),
                  color: hoveredPreset === preset.name ? '#67e8f9' : '#94a3b8', cursor: 'pointer',
                }}
              >{preset.name}</button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2a45' }}>
          {config.mode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={label}>grid-template-columns</label>
                <input value={config.templateColumns} onChange={e => set('templateColumns', e.target.value)} style={input} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={label}>grid-template-rows (optional)</label>
                <input value={config.templateRows} onChange={e => set('templateRows', e.target.value)} style={input} placeholder="auto" />
              </div>
              <div>
                <label style={label}>column-gap (px)</label>
                <input type="number" min={0} value={config.columnGap} onChange={e => set('columnGap', Number(e.target.value))} style={input} />
              </div>
              <div>
                <label style={label}>row-gap (px)</label>
                <input type="number" min={0} value={config.rowGap} onChange={e => set('rowGap', Number(e.target.value))} style={input} />
              </div>
              <div>
                <label style={label}>grid-auto-flow</label>
                <select value={config.autoFlow} onChange={e => set('autoFlow', e.target.value as GridAutoFlow)} style={select}>
                  {['row', 'column', 'row dense', 'column dense'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>padding (px)</label>
                <input type="number" min={0} value={config.padding} onChange={e => set('padding', Number(e.target.value))} style={input} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={label}>flex-direction</label>
                <select value={config.direction} onChange={e => set('direction', e.target.value as FlexDirection)} style={select}>
                  {['row', 'column', 'row-reverse', 'column-reverse'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>flex-wrap</label>
                <select value={config.wrap} onChange={e => set('wrap', e.target.value as FlexWrap)} style={select}>
                  {['nowrap', 'wrap', 'wrap-reverse'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>justify-content</label>
                <select value={config.justifyContent} onChange={e => set('justifyContent', e.target.value as JustifyContent)} style={select}>
                  {['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>align-items</label>
                <select value={config.alignItems} onChange={e => set('alignItems', e.target.value as AlignItems)} style={select}>
                  {['flex-start', 'flex-end', 'center', 'stretch', 'baseline'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>gap (px)</label>
                <input type="number" min={0} value={config.flexGap} onChange={e => set('flexGap', Number(e.target.value))} style={input} />
              </div>
              <div>
                <label style={label}>padding (px)</label>
                <input type="number" min={0} value={config.padding} onChange={e => set('padding', Number(e.target.value))} style={input} />
              </div>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <label style={label}>Items preview count</label>
            <input type="range" min={1} max={24} value={config.itemCount}
              onChange={e => set('itemCount', Number(e.target.value))}
              style={{ width: '100%', accentColor: '#67e8f9' }}
            />
            <div style={{ fontSize: 10, color: '#64748b', textAlign: 'right' }}>{config.itemCount} items</div>
          </div>
        </div>

        {/* Visual preview */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2a45' }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>PREVIEW</div>
          <div style={{
            position: 'relative', width: previewW, height: Math.max(80, previewH),
            background: '#1e293b', borderRadius: 8, overflow: 'hidden',
            border: '1px solid #334155', margin: '0 auto',
          }}>
            {cells.map((cell, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: cell.x * previewScale,
                top: cell.y * previewScale,
                width: Math.max(0, cell.w * previewScale - 1),
                height: Math.max(0, cell.h * previewScale - 1),
                background: ITEM_COLORS[i % ITEM_COLORS.length] + '33',
                border: '1px solid ' + ITEM_COLORS[i % ITEM_COLORS.length] + '88',
                borderRadius: 3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 8, color: ITEM_COLORS[i % ITEM_COLORS.length], fontWeight: 700 }}>
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
          {/* Track labels */}
          {config.mode === 'grid' && (() => {
            const cols = parseTrackList(config.templateColumns, config.containerWidth - config.padding * 2);
            return cols.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {cols.map((col, i) => (
                  <span key={i} style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3,
                    background: '#0e4e5e', color: '#67e8f9', fontFamily: 'monospace',
                  }}>{col.value} ({Math.round(col.pixels)}px)</span>
                ))}
              </div>
            );
          })()}
        </div>

        {/* CSS output */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>GENERATED CSS</div>
          <pre style={{
            background: '#0a0f1e', border: '1px solid #1e2a45', borderRadius: 8,
            padding: '10px 12px', fontSize: 11, color: '#67e8f9',
            fontFamily: 'monospace', overflowX: 'auto', margin: '0 0 8px',
            whiteSpace: 'pre-wrap',
          }}>{cssCode}</pre>
          <button onClick={copyCSS} style={{
            width: '100%', padding: '8px 0',
            background: copied ? '#065f46' : '#1e293b',
            border: '1px solid ' + (copied ? '#10b981' : '#334155'),
            borderRadius: 8, color: copied ? '#6ee7b7' : '#94a3b8',
            fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
          }}>{copied ? '✓ Copied!' : 'Copy CSS'}</button>
        </div>
      </div>
    </div>
  );
}
