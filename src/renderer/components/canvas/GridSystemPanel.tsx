/**
 * GridSystemPanel — Column / row layout grid overlay system.
 *
 * Renders a configurable column grid (12-col, 8-col, or custom),
 * row baseline grid, and center cross overlay directly on the canvas.
 *
 * Multiple grids can stack. Each grid can be a "column" grid (vertical
 * stripe divisions with gutters) or a "row" baseline grid (horizontal lines).
 *
 * Grid overlay is rendered as a fixed overlay on the canvas pane using
 * CSS background gradients — zero DOM elements per column.
 *
 * Shortcut: Cmd+Shift+Alt+L (L for Layout)
 */

import React, { useState, useCallback, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type GridType = 'columns' | 'rows' | 'grid' | 'center';

interface GridDef {
  id: string;
  type: GridType;
  visible: boolean;
  color: string;
  opacity: number;
  // Column grid
  columns?: number;
  gutter?: number; // px between columns
  margin?: number; // px outer margin
  // Row grid
  rowHeight?: number; // px per row
  // Generic grid (both)
  cellSize?: number;
}

// ── Preset grids ──────────────────────────────────────────────────────────────

const PRESETS: Array<{ name: string; emoji: string; description: string; grids: Omit<GridDef, 'id'>[] }> = [
  {
    name: '12-Column Web',
    emoji: '⬛',
    description: '12-col grid, 24px gutter, 40px margin — standard web layout',
    grids: [
      { type: 'columns', visible: true, color: '#6366f1', opacity: 0.12, columns: 12, gutter: 24, margin: 40 },
    ],
  },
  {
    name: '8-Column Compact',
    emoji: '▦',
    description: '8 columns, 16px gutter, 24px margin',
    grids: [
      { type: 'columns', visible: true, color: '#f472b6', opacity: 0.12, columns: 8, gutter: 16, margin: 24 },
    ],
  },
  {
    name: 'Bootstrap Grid',
    emoji: '🅱',
    description: '12 col, 30px gutter, 15px margin (Bootstrap default)',
    grids: [
      { type: 'columns', visible: true, color: '#3b82f6', opacity: 0.12, columns: 12, gutter: 30, margin: 15 },
    ],
  },
  {
    name: '8pt Baseline',
    emoji: '≡',
    description: '8pt vertical baseline grid for typography alignment',
    grids: [
      { type: 'rows', visible: true, color: '#f59e0b', opacity: 0.2, rowHeight: 8 },
    ],
  },
  {
    name: '4pt Fine Grid',
    emoji: '::',
    description: '4pt micro baseline grid for tight spacing',
    grids: [
      { type: 'rows', visible: true, color: '#22c55e', opacity: 0.12, rowHeight: 4 },
    ],
  },
  {
    name: 'Full System',
    emoji: '⊞',
    description: '12-col + 8pt baseline together',
    grids: [
      { type: 'columns', visible: true, color: '#6366f1', opacity: 0.1, columns: 12, gutter: 24, margin: 40 },
      { type: 'rows', visible: true, color: '#f59e0b', opacity: 0.1, rowHeight: 8 },
    ],
  },
  {
    name: 'Square Grid',
    emoji: '▤',
    description: '24px square grid for iconography',
    grids: [
      { type: 'grid', visible: true, color: '#6366f1', opacity: 0.12, cellSize: 24 },
    ],
  },
  {
    name: 'Center Lines',
    emoji: '✛',
    description: 'Canvas center crosshair for symmetry',
    grids: [
      { type: 'center', visible: true, color: '#ef4444', opacity: 0.4 },
    ],
  },
];

// ── ID generator ─────────────────────────────────────────────────────────────

let _gridIdCounter = 0;
function newGridId() { return `grid-${++_gridIdCounter}`; }

// ── Canvas overlay component ──────────────────────────────────────────────────

interface GridOverlayProps {
  grids: GridDef[];
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
}

export function GridOverlay({ grids, canvasWidth, canvasHeight, zoom, panX, panY }: GridOverlayProps) {
  if (grids.length === 0) return null;
  const visible = grids.filter((g) => g.visible);
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5, // above canvas dots, below shapes
        overflow: 'hidden',
      }}
    >
      {visible.map((grid) => {
        if (grid.type === 'columns' && grid.columns) {
          const cols = grid.columns;
          const gutter = grid.gutter ?? 16;
          const margin = grid.margin ?? 0;
          const scaledW = canvasWidth * zoom;
          const scaledH = canvasHeight * zoom;
          const colW = (scaledW - margin * 2 * zoom - gutter * (cols - 1) * zoom) / cols;
          const stripes: React.ReactNode[] = [];
          for (let i = 0; i < cols; i++) {
            const x = panX + margin * zoom + i * (colW + gutter * zoom);
            stripes.push(
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x,
                  top: panY,
                  width: colW,
                  height: scaledH,
                  background: grid.color,
                  opacity: grid.opacity,
                  pointerEvents: 'none',
                }}
              />
            );
          }
          return <React.Fragment key={grid.id}>{stripes}</React.Fragment>;
        }

        if (grid.type === 'rows' && grid.rowHeight) {
          const rowH = grid.rowHeight * zoom;
          const totalH = canvasHeight * zoom;
          const lineCount = Math.ceil(totalH / rowH) + 1;
          const lines: React.ReactNode[] = [];
          for (let i = 0; i <= lineCount; i++) {
            lines.push(
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: panX,
                  top: panY + i * rowH,
                  width: canvasWidth * zoom,
                  height: 1,
                  background: grid.color,
                  opacity: grid.opacity,
                  pointerEvents: 'none',
                }}
              />
            );
          }
          return <React.Fragment key={grid.id}>{lines}</React.Fragment>;
        }

        if (grid.type === 'grid' && grid.cellSize) {
          const cell = grid.cellSize * zoom;
          const totalW = canvasWidth * zoom;
          const totalH = canvasHeight * zoom;
          const vLines = Math.ceil(totalW / cell) + 1;
          const hLines = Math.ceil(totalH / cell) + 1;
          const lines: React.ReactNode[] = [];
          for (let i = 0; i <= vLines; i++) {
            lines.push(<div key={`v${i}`} style={{ position: 'absolute', left: panX + i * cell, top: panY, width: 1, height: totalH, background: grid.color, opacity: grid.opacity, pointerEvents: 'none' }} />);
          }
          for (let i = 0; i <= hLines; i++) {
            lines.push(<div key={`h${i}`} style={{ position: 'absolute', left: panX, top: panY + i * cell, width: totalW, height: 1, background: grid.color, opacity: grid.opacity, pointerEvents: 'none' }} />);
          }
          return <React.Fragment key={grid.id}>{lines}</React.Fragment>;
        }

        if (grid.type === 'center') {
          const cx = panX + (canvasWidth * zoom) / 2;
          const cy = panY + (canvasHeight * zoom) / 2;
          return (
            <React.Fragment key={grid.id}>
              {/* Vertical */}
              <div style={{ position: 'absolute', left: cx, top: panY, width: 1, height: canvasHeight * zoom, background: grid.color, opacity: grid.opacity, pointerEvents: 'none' }} />
              {/* Horizontal */}
              <div style={{ position: 'absolute', left: panX, top: cy, width: canvasWidth * zoom, height: 1, background: grid.color, opacity: grid.opacity, pointerEvents: 'none' }} />
              {/* Center cross tick */}
              <div style={{ position: 'absolute', left: cx - 8, top: cy - 8, width: 16, height: 16, border: `2px solid ${grid.color}`, borderRadius: '50%', opacity: grid.opacity, pointerEvents: 'none' }} />
            </React.Fragment>
          );
        }

        return null;
      })}
    </div>
  );
}

// ── Panel component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  grids: GridDef[];
  onGridsChange: (grids: GridDef[]) => void;
}

function GridRow({
  grid,
  onChange,
  onDelete,
  onToggle,
}: {
  grid: GridDef;
  onChange: (patch: Partial<GridDef>) => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeLabels: Record<GridType, string> = {
    columns: '⬛ Columns',
    rows: '≡ Rows',
    grid: '▤ Grid',
    center: '✛ Center',
  };

  return (
    <div
      style={{
        background: 'var(--panel-alt, #252535)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}>
        {/* Visibility toggle */}
        <button
          onClick={onToggle}
          style={{
            width: 16, height: 16, borderRadius: 3, flexShrink: 0,
            background: grid.visible ? grid.color : 'transparent',
            border: `2px solid ${grid.color}`,
            cursor: 'pointer',
          }}
          title={grid.visible ? 'Hide grid' : 'Show grid'}
        />
        {/* Color */}
        <input
          type="color"
          value={grid.color}
          onChange={(e) => onChange({ color: e.target.value })}
          style={{ width: 22, height: 18, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'none', padding: 0, flexShrink: 0 }}
        />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: grid.visible ? 'var(--text, #e2e8f0)' : 'var(--muted, #888)' }}>
          {typeLabels[grid.type]}
          {grid.type === 'columns' && grid.columns && <span style={{ fontWeight: 400, color: 'var(--muted, #888)' }}> · {grid.columns} col</span>}
          {grid.type === 'rows' && grid.rowHeight && <span style={{ fontWeight: 400, color: 'var(--muted, #888)' }}> · {grid.rowHeight}px</span>}
          {grid.type === 'grid' && grid.cellSize && <span style={{ fontWeight: 400, color: 'var(--muted, #888)' }}> · {grid.cellSize}px</span>}
        </span>
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 10, padding: 2 }}
        >
          {expanded ? '▲' : '▼'}
        </button>
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border, #2d2d3d)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Opacity */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Opacity</span>
            <input type="range" min={0.02} max={0.8} step={0.02} value={grid.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })}
              style={{ flex: 1, accentColor: grid.color, cursor: 'pointer' }} />
            <span style={{ fontSize: 9, color: 'var(--text, #e2e8f0)', width: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(grid.opacity * 100)}%</span>
          </div>

          {grid.type === 'columns' && (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Columns</span>
                <input type="range" min={1} max={24} step={1} value={grid.columns ?? 12} onChange={(e) => onChange({ columns: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: grid.color }} />
                <span style={{ fontSize: 9, color: 'var(--text, #e2e8f0)', width: 28, textAlign: 'right' }}>{grid.columns ?? 12}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Gutter</span>
                <input type="range" min={0} max={64} step={2} value={grid.gutter ?? 16} onChange={(e) => onChange({ gutter: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: grid.color }} />
                <span style={{ fontSize: 9, color: 'var(--text, #e2e8f0)', width: 28, textAlign: 'right' }}>{grid.gutter ?? 16}px</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Margin</span>
                <input type="range" min={0} max={120} step={4} value={grid.margin ?? 0} onChange={(e) => onChange({ margin: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: grid.color }} />
                <span style={{ fontSize: 9, color: 'var(--text, #e2e8f0)', width: 28, textAlign: 'right' }}>{grid.margin ?? 0}px</span>
              </div>
            </>
          )}

          {grid.type === 'rows' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Height</span>
              <input type="range" min={2} max={64} step={2} value={grid.rowHeight ?? 8} onChange={(e) => onChange({ rowHeight: Number(e.target.value) })}
                style={{ flex: 1, accentColor: grid.color }} />
              <span style={{ fontSize: 9, color: 'var(--text, #e2e8f0)', width: 28, textAlign: 'right' }}>{grid.rowHeight ?? 8}px</span>
            </div>
          )}

          {grid.type === 'grid' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Cell</span>
              <input type="range" min={4} max={128} step={4} value={grid.cellSize ?? 24} onChange={(e) => onChange({ cellSize: Number(e.target.value) })}
                style={{ flex: 1, accentColor: grid.color }} />
              <span style={{ fontSize: 9, color: 'var(--text, #e2e8f0)', width: 28, textAlign: 'right' }}>{grid.cellSize ?? 24}px</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GridSystemPanel({ open, onClose, grids, onGridsChange }: Props) {
  const [showPresets, setShowPresets] = useState(false);

  const addGrid = useCallback((type: GridType) => {
    const defaults: Record<GridType, Omit<GridDef, 'id' | 'type' | 'visible'>> = {
      columns: { color: '#6366f1', opacity: 0.12, columns: 12, gutter: 24, margin: 40 },
      rows: { color: '#f59e0b', opacity: 0.15, rowHeight: 8 },
      grid: { color: '#6366f1', opacity: 0.1, cellSize: 24 },
      center: { color: '#ef4444', opacity: 0.4 },
    };
    onGridsChange([...grids, { id: newGridId(), type, visible: true, ...defaults[type] }]);
  }, [grids, onGridsChange]);

  const updateGrid = useCallback((id: string, patch: Partial<GridDef>) => {
    onGridsChange(grids.map((g) => g.id === id ? { ...g, ...patch } : g));
  }, [grids, onGridsChange]);

  const deleteGrid = useCallback((id: string) => {
    onGridsChange(grids.filter((g) => g.id !== id));
  }, [grids, onGridsChange]);

  const toggleGrid = useCallback((id: string) => {
    onGridsChange(grids.map((g) => g.id === id ? { ...g, visible: !g.visible } : g));
  }, [grids, onGridsChange]);

  const applyPreset = useCallback((preset: typeof PRESETS[0]) => {
    const newGrids = preset.grids.map((g) => ({ ...g, id: newGridId() }));
    onGridsChange([...grids, ...newGrids]);
    setShowPresets(false);
  }, [grids, onGridsChange]);

  const hideAll = useCallback(() => {
    onGridsChange(grids.map((g) => ({ ...g, visible: false })));
  }, [grids, onGridsChange]);

  const showAll = useCallback(() => {
    onGridsChange(grids.map((g) => ({ ...g, visible: true })));
  }, [grids, onGridsChange]);

  const clearAll = useCallback(() => {
    onGridsChange([]);
  }, [onGridsChange]);

  if (!open) return null;

  const visibleCount = grids.filter((g) => g.visible).length;

  return (
    <div
      style={{
        position: 'fixed', top: 56, right: 340, width: 300,
        maxHeight: 'calc(100vh - 80px)',
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        zIndex: 310,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⊞ Grid System
            {visibleCount > 0 && (
              <span style={{ background: 'var(--accent, #6366f1)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>
                {visibleCount} active
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
            {grids.length} grid{grids.length !== 1 ? 's' : ''} defined · column/row/square overlays
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 4, borderRadius: 4 }}>×</button>
      </div>

      {/* Controls bar */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', gap: 4, flexShrink: 0 }}>
        {visibleCount > 0 ? (
          <button onClick={hideAll} style={{ flex: 1, padding: '4px 0', background: 'var(--panel-alt, #252535)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 6, color: 'var(--muted, #888)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Hide All</button>
        ) : (
          <button onClick={showAll} style={{ flex: 1, padding: '4px 0', background: 'var(--panel-alt, #252535)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 6, color: 'var(--muted, #888)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Show All</button>
        )}
        <button onClick={() => setShowPresets((s) => !s)} style={{ flex: 1, padding: '4px 0', background: showPresets ? 'var(--accent, #6366f1)' : 'var(--panel-alt, #252535)', border: showPresets ? 'none' : '1px solid var(--border, #2d2d3d)', borderRadius: 6, color: showPresets ? '#fff' : 'var(--muted, #888)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Presets</button>
        {grids.length > 0 && <button onClick={clearAll} style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Clear</button>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Presets */}
        {showPresets && (
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Presets</div>
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--panel-alt, #252535)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: 14 }}>{preset.emoji}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text, #e2e8f0)' }}>{preset.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>{preset.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Add grid buttons */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Add Grid</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {(['columns', 'rows', 'grid', 'center'] as GridType[]).map((type) => (
              <button
                key={type}
                onClick={() => addGrid(type)}
                style={{ padding: '6px 4px', background: 'var(--panel-alt, #252535)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
              >
                <span style={{ fontSize: 14 }}>{type === 'columns' ? '⬛' : type === 'rows' ? '≡' : type === 'grid' ? '▤' : '✛'}</span>
                <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'capitalize' }}>{type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grid list */}
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {grids.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted, #888)', fontSize: 11 }}>
              No grids yet. Add one above or choose a preset.
            </div>
          )}
          {grids.map((grid) => (
            <GridRow
              key={grid.id}
              grid={grid}
              onChange={(patch) => updateGrid(grid.id, patch)}
              onDelete={() => deleteGrid(grid.id)}
              onToggle={() => toggleGrid(grid.id)}
            />
          ))}
        </div>

        {/* Hint */}
        {grids.length > 0 && (
          <div style={{ padding: '0 10px 10px' }}>
            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 6, padding: '7px 9px', fontSize: 9, color: 'var(--muted, #888)', lineHeight: 1.6 }}>
              Grid lines are rendered at canvas scale and update in real-time as you zoom and pan. Toggle visibility with the color dot on each row.
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border, #2d2d3d)', fontSize: 10, color: 'var(--muted, #888)', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>{PRESETS.length} presets · column/row/square/center</span>
        <span>⌘⇧⌥L</span>
      </div>
    </div>
  );
}

export type { GridDef };
