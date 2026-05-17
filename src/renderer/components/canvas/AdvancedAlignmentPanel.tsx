import React, { useState, useCallback, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlignTarget = 'selection' | 'canvas' | 'key-object' | 'anchor';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface AlignedShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GapInfo {
  between: number[];    // gaps between consecutive sorted shapes
  uniform: boolean;
  min: number;
  max: number;
  avg: number;
}

// ── Pure functions (exported for tests) ──────────────────────────────────────

export function shapeToBounds(shape: AlignedShape): Bounds {
  return {
    left: shape.x,
    top: shape.y,
    right: shape.x + shape.width,
    bottom: shape.y + shape.height,
    width: shape.width,
    height: shape.height,
    centerX: shape.x + shape.width / 2,
    centerY: shape.y + shape.height / 2,
  };
}

export function selectionBounds(shapes: AlignedShape[]): Bounds | null {
  if (shapes.length === 0) return null;
  const left = Math.min(...shapes.map(s => s.x));
  const top = Math.min(...shapes.map(s => s.y));
  const right = Math.max(...shapes.map(s => s.x + s.width));
  const bottom = Math.max(...shapes.map(s => s.y + s.height));
  return {
    left, top, right, bottom,
    width: right - left, height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

// ── Alignment functions ─────────────────────────────────────────────────────

export function alignLeft(shapes: AlignedShape[], target: Bounds): AlignedShape[] {
  return shapes.map(s => ({ ...s, x: target.left }));
}

export function alignRight(shapes: AlignedShape[], target: Bounds): AlignedShape[] {
  return shapes.map(s => ({ ...s, x: target.right - s.width }));
}

export function alignHCenter(shapes: AlignedShape[], target: Bounds): AlignedShape[] {
  return shapes.map(s => ({ ...s, x: target.centerX - s.width / 2 }));
}

export function alignTop(shapes: AlignedShape[], target: Bounds): AlignedShape[] {
  return shapes.map(s => ({ ...s, y: target.top }));
}

export function alignBottom(shapes: AlignedShape[], target: Bounds): AlignedShape[] {
  return shapes.map(s => ({ ...s, y: target.bottom - s.height }));
}

export function alignVCenter(shapes: AlignedShape[], target: Bounds): AlignedShape[] {
  return shapes.map(s => ({ ...s, y: target.centerY - s.height / 2 }));
}

// ── Distribution functions ──────────────────────────────────────────────────

export function distributeHorizontal(shapes: AlignedShape[]): AlignedShape[] {
  if (shapes.length < 3) return shapes;
  const sorted = [...shapes].sort((a, b) => a.x - b.x);
  const totalWidth = sorted.reduce((sum, s) => sum + s.width, 0);
  const spanWidth = (sorted[sorted.length - 1].x + sorted[sorted.length - 1].width) - sorted[0].x;
  const gap = (spanWidth - totalWidth) / (sorted.length - 1);
  let x = sorted[0].x;
  return sorted.map(s => {
    const result = { ...s, x };
    x += s.width + gap;
    return result;
  });
}

export function distributeVertical(shapes: AlignedShape[]): AlignedShape[] {
  if (shapes.length < 3) return shapes;
  const sorted = [...shapes].sort((a, b) => a.y - b.y);
  const totalHeight = sorted.reduce((sum, s) => sum + s.height, 0);
  const spanHeight = (sorted[sorted.length - 1].y + sorted[sorted.length - 1].height) - sorted[0].y;
  const gap = (spanHeight - totalHeight) / (sorted.length - 1);
  let y = sorted[0].y;
  return sorted.map(s => {
    const result = { ...s, y };
    y += s.height + gap;
    return result;
  });
}

export function distributeHorizontalWithGap(shapes: AlignedShape[], gap: number): AlignedShape[] {
  if (shapes.length === 0) return shapes;
  const sorted = [...shapes].sort((a, b) => a.x - b.x);
  let x = sorted[0].x;
  return sorted.map(s => {
    const result = { ...s, x };
    x += s.width + gap;
    return result;
  });
}

export function distributeVerticalWithGap(shapes: AlignedShape[], gap: number): AlignedShape[] {
  if (shapes.length === 0) return shapes;
  const sorted = [...shapes].sort((a, b) => a.y - b.y);
  let y = sorted[0].y;
  return sorted.map(s => {
    const result = { ...s, y };
    y += s.height + gap;
    return result;
  });
}

export function measureHorizontalGaps(shapes: AlignedShape[]): GapInfo {
  if (shapes.length < 2) return { between: [], uniform: true, min: 0, max: 0, avg: 0 };
  const sorted = [...shapes].sort((a, b) => a.x - b.x);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width));
  }
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return { between: gaps, uniform: max - min < 1, min, max, avg };
}

export function measureVerticalGaps(shapes: AlignedShape[]): GapInfo {
  if (shapes.length < 2) return { between: [], uniform: true, min: 0, max: 0, avg: 0 };
  const sorted = [...shapes].sort((a, b) => a.y - b.y);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].y - (sorted[i - 1].y + sorted[i - 1].height));
  }
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return { between: gaps, uniform: max - min < 1, min, max, avg };
}

export function tileShapes(shapes: AlignedShape[], cols: number, gap: number): AlignedShape[] {
  if (shapes.length === 0) return shapes;
  const startX = Math.min(...shapes.map(s => s.x));
  const startY = Math.min(...shapes.map(s => s.y));
  const maxW = Math.max(...shapes.map(s => s.width));
  const maxH = Math.max(...shapes.map(s => s.height));
  return shapes.map((s, i) => ({
    ...s,
    x: startX + (i % cols) * (maxW + gap),
    y: startY + Math.floor(i / cols) * (maxH + gap),
  }));
}

export function stackHorizontally(shapes: AlignedShape[], gap: number): AlignedShape[] {
  if (shapes.length === 0) return shapes;
  let x = Math.min(...shapes.map(s => s.x));
  const top = Math.min(...shapes.map(s => s.y));
  return shapes.map(s => {
    const result = { ...s, x, y: top };
    x += s.width + gap;
    return result;
  });
}

export function stackVertically(shapes: AlignedShape[], gap: number): AlignedShape[] {
  if (shapes.length === 0) return shapes;
  const left = Math.min(...shapes.map(s => s.x));
  let y = Math.min(...shapes.map(s => s.y));
  return shapes.map(s => {
    const result = { ...s, x: left, y };
    y += s.height + gap;
    return result;
  });
}

export function equalizeWidths(shapes: AlignedShape[]): AlignedShape[] {
  if (shapes.length === 0) return shapes;
  const avgW = Math.round(shapes.reduce((sum, s) => sum + s.width, 0) / shapes.length);
  return shapes.map(s => ({ ...s, width: avgW }));
}

export function equalizeHeights(shapes: AlignedShape[]): AlignedShape[] {
  if (shapes.length === 0) return shapes;
  const avgH = Math.round(shapes.reduce((sum, s) => sum + s.height, 0) / shapes.length);
  return shapes.map(s => ({ ...s, height: avgH }));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  selectedIds: string[];
  canvasW?: number;
  canvasH?: number;
  onUpdate?: (updates: { id: string; x?: number; y?: number; width?: number; height?: number }[]) => void;
}

export function AdvancedAlignmentPanel({ open, onClose, shapes, selectedIds, canvasW = 1200, canvasH = 800, onUpdate }: Props) {
  const [gap, setGap] = useState(16);
  const [tileColumns, setTileColumns] = useState(3);
  const [alignTarget, setAlignTarget] = useState<AlignTarget>('selection');

  const selectedShapes = useMemo<AlignedShape[]>(() =>
    shapes
      .filter(s => selectedIds.includes(s.id))
      .map(s => ({ id: s.id, x: s.x ?? 0, y: s.y ?? 0, width: s.width ?? 100, height: s.height ?? 100 })),
    [shapes, selectedIds]
  );

  const selBounds = useMemo(() => selectionBounds(selectedShapes), [selectedShapes]);

  const canvasBounds: Bounds = useMemo(() => ({
    left: 0, top: 0, right: canvasW, bottom: canvasH,
    width: canvasW, height: canvasH, centerX: canvasW / 2, centerY: canvasH / 2,
  }), [canvasW, canvasH]);

  const targetBounds = alignTarget === 'canvas' ? canvasBounds : (selBounds ?? canvasBounds);

  const hGaps = useMemo(() => measureHorizontalGaps(selectedShapes), [selectedShapes]);
  const vGaps = useMemo(() => measureVerticalGaps(selectedShapes), [selectedShapes]);

  const applyUpdates = useCallback((result: AlignedShape[]) => {
    if (!onUpdate) return;
    onUpdate(result.map(r => ({ id: r.id, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) })));
  }, [onUpdate]);

  if (!open) return null;

  const panelBg = '#1e1e2e';
  const surface = '#2a2a3e';
  const border = '#3a3a55';
  const accent = '#8b5cf6';
  const textPrimary = '#e2e8f0';
  const textMuted = '#94a3b8';

  const count = selectedShapes.length;
  const hasSelection = count > 0;
  const canDistribute = count >= 3;
  const canAlign = count >= 1;

  const BTN_STYLE = (enabled: boolean): React.CSSProperties => ({
    padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: enabled ? `${accent}22` : 'transparent',
    border: `1px solid ${enabled ? accent + '55' : border}`,
    color: enabled ? accent : textMuted,
    cursor: enabled ? 'pointer' : 'not-allowed',
    textAlign: 'center',
  });

  const SECTION_TITLE: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: 8, marginTop: 14,
  };

  const SVG_BTN: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 6, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: surface, border: `1px solid ${border}`,
    cursor: canAlign && onUpdate ? 'pointer' : 'not-allowed',
    color: canAlign && onUpdate ? textPrimary : textMuted,
    flexShrink: 0,
  };

  const alignIcon = (label: string, onClick: () => void, title: string) => (
    <button key={label} onClick={onClick} title={title} disabled={!canAlign || !onUpdate} style={SVG_BTN}>
      <span style={{ fontSize: 14 }}>{label}</span>
    </button>
  );

  return (
    <div style={{
      position: 'fixed', left: 16, top: 60, width: 320,
      maxHeight: 'calc(100vh - 80px)', background: panelBg,
      border: `1px solid ${border}`, borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', zIndex: 9025,
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px', borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>Advanced Alignment</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            {count === 0 ? 'No selection' : `${count} shape${count > 1 ? 's' : ''} selected`}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: textMuted,
          cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
        }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Align target */}
        <div>
          <div style={SECTION_TITLE}>Align to</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['selection', 'canvas'] as AlignTarget[]).map(t => (
              <button
                key={t}
                onClick={() => setAlignTarget(t)}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: alignTarget === t ? `${accent}22` : 'transparent',
                  border: `1px solid ${alignTarget === t ? accent : border}`,
                  color: alignTarget === t ? accent : textMuted,
                  cursor: 'pointer',
                }}
              >{t === 'selection' ? 'Selection' : 'Canvas'}</button>
            ))}
          </div>
        </div>

        {/* Alignment buttons */}
        <div style={SECTION_TITLE}>Align</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
          {[
            { icon: '⇤', title: 'Align Left', action: () => applyUpdates(alignLeft(selectedShapes, targetBounds)) },
            { icon: '⬤', title: 'Align Center H', action: () => applyUpdates(alignHCenter(selectedShapes, targetBounds)) },
            { icon: '⇥', title: 'Align Right', action: () => applyUpdates(alignRight(selectedShapes, targetBounds)) },
            { icon: '⇡', title: 'Align Top', action: () => applyUpdates(alignTop(selectedShapes, targetBounds)) },
            { icon: '◎', title: 'Align Center V', action: () => applyUpdates(alignVCenter(selectedShapes, targetBounds)) },
            { icon: '⇣', title: 'Align Bottom', action: () => applyUpdates(alignBottom(selectedShapes, targetBounds)) },
          ].map(({ icon, title, action }) => (
            <button key={title} onClick={canAlign && onUpdate ? action : undefined}
              title={title} disabled={!canAlign || !onUpdate}
              style={SVG_BTN}
            >{icon}</button>
          ))}
        </div>

        {/* Distribution */}
        <div style={SECTION_TITLE}>Distribute</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={canDistribute && onUpdate ? () => applyUpdates(distributeHorizontal(selectedShapes)) : undefined}
            disabled={!canDistribute || !onUpdate}
            style={BTN_STYLE(canDistribute && !!onUpdate)}>⇔ Horizontal</button>
          <button onClick={canDistribute && onUpdate ? () => applyUpdates(distributeVertical(selectedShapes)) : undefined}
            disabled={!canDistribute || !onUpdate}
            style={BTN_STYLE(canDistribute && !!onUpdate)}>⇕ Vertical</button>
        </div>

        {/* Gap controls */}
        <div style={SECTION_TITLE}>With Gap</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input type="range" min={0} max={100} step={1} value={gap}
            onChange={e => setGap(Number(e.target.value))}
            style={{ flex: 1, accentColor: accent }} />
          <input type="number" min={0} max={500} value={gap}
            onChange={e => setGap(Number(e.target.value))}
            style={{
              width: 52, background: surface, border: `1px solid ${border}`,
              borderRadius: 6, color: textPrimary, fontSize: 12, fontWeight: 700,
              padding: '4px 6px', outline: 'none', fontFamily: 'monospace',
            }} />
          <span style={{ fontSize: 11, color: textMuted }}>px</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <button onClick={hasSelection && onUpdate ? () => applyUpdates(distributeHorizontalWithGap(selectedShapes, gap)) : undefined}
            disabled={!hasSelection || !onUpdate}
            style={BTN_STYLE(hasSelection && !!onUpdate)}>→ H Gap</button>
          <button onClick={hasSelection && onUpdate ? () => applyUpdates(distributeVerticalWithGap(selectedShapes, gap)) : undefined}
            disabled={!hasSelection || !onUpdate}
            style={BTN_STYLE(hasSelection && !!onUpdate)}>↓ V Gap</button>
          <button onClick={hasSelection && onUpdate ? () => applyUpdates(stackHorizontally(selectedShapes, gap)) : undefined}
            disabled={!hasSelection || !onUpdate}
            style={BTN_STYLE(hasSelection && !!onUpdate)}>→ Stack H</button>
          <button onClick={hasSelection && onUpdate ? () => applyUpdates(stackVertically(selectedShapes, gap)) : undefined}
            disabled={!hasSelection || !onUpdate}
            style={BTN_STYLE(hasSelection && !!onUpdate)}>↓ Stack V</button>
        </div>

        {/* Tile */}
        <div style={SECTION_TITLE}>Tile / Grid</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: textMuted }}>Columns</span>
          <input type="number" min={1} max={12} value={tileColumns}
            onChange={e => setTileColumns(Number(e.target.value))}
            style={{
              width: 52, background: surface, border: `1px solid ${border}`,
              borderRadius: 6, color: textPrimary, fontSize: 12, fontWeight: 700,
              padding: '4px 6px', outline: 'none', fontFamily: 'monospace',
            }} />
          <button onClick={hasSelection && onUpdate ? () => applyUpdates(tileShapes(selectedShapes, tileColumns, gap)) : undefined}
            disabled={!hasSelection || !onUpdate}
            style={{
              flex: 1, ...BTN_STYLE(hasSelection && !!onUpdate), padding: '8px 0',
            }}>⊞ Tile Grid</button>
        </div>

        {/* Size equalization */}
        <div style={SECTION_TITLE}>Equalize Size</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <button onClick={hasSelection && onUpdate ? () => applyUpdates(equalizeWidths(selectedShapes)) : undefined}
            disabled={!hasSelection || !onUpdate}
            style={BTN_STYLE(hasSelection && !!onUpdate)}>= Width</button>
          <button onClick={hasSelection && onUpdate ? () => applyUpdates(equalizeHeights(selectedShapes)) : undefined}
            disabled={!hasSelection || !onUpdate}
            style={BTN_STYLE(hasSelection && !!onUpdate)}>= Height</button>
        </div>

        {/* Gap measurement */}
        {count >= 2 && (
          <div>
            <div style={SECTION_TITLE}>Gap Analysis</div>
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 12px' }}>
              {[
                { label: 'H gaps', info: hGaps },
                { label: 'V gaps', info: vGaps },
              ].map(({ label, info }) => (
                <div key={label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: textPrimary, fontWeight: 500 }}>{label}</span>
                    {info.between.length > 0 && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4,
                        background: info.uniform ? '#22c55e22' : '#f9731622',
                        color: info.uniform ? '#22c55e' : '#f97316',
                        border: `1px solid ${info.uniform ? '#22c55e44' : '#f9731644'}`,
                      }}>
                        {info.uniform ? '✓ Uniform' : '⚠ Uneven'}
                      </span>
                    )}
                  </div>
                  {info.between.length > 0 ? (
                    <div style={{ fontSize: 10, color: textMuted, fontFamily: 'monospace' }}>
                      gaps: [{info.between.map(g => Math.round(g)).join(', ')}]
                      {!info.uniform && ` · avg: ${info.avg.toFixed(1)}px`}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: textMuted }}>Need ≥2 shapes to measure</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selection bounds */}
        {selBounds && (
          <div>
            <div style={SECTION_TITLE}>Selection Bounds</div>
            <div style={{
              background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 12px',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
            }}>
              {[
                { label: 'L', value: `${Math.round(selBounds.left)}px` },
                { label: 'T', value: `${Math.round(selBounds.top)}px` },
                { label: 'W', value: `${Math.round(selBounds.width)}px` },
                { label: 'H', value: `${Math.round(selBounds.height)}px` },
                { label: 'CX', value: `${Math.round(selBounds.centerX)}px` },
                { label: 'CY', value: `${Math.round(selBounds.centerY)}px` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: textMuted }}>{label}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: textPrimary, fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasSelection && (
          <div style={{
            marginTop: 20, padding: '16px', textAlign: 'center',
            background: surface, border: `1px solid ${border}`, borderRadius: 8,
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⟁</div>
            <div style={{ fontSize: 12, color: textMuted }}>Select shapes on the canvas to enable alignment tools</div>
          </div>
        )}
      </div>
    </div>
  );
}
