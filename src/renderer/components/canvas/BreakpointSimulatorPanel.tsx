/**
 * BreakpointSimulatorPanel — Multi-viewport canvas preview
 *
 * Features:
 *  - Shows current canvas design at configurable breakpoint widths
 *  - Common presets: mobile (375), tablet (768), laptop (1280), desktop (1920)
 *  - User can add/remove/rename custom breakpoints
 *  - Scales the canvas SVG-preview proportionally within each viewport frame
 *  - Shows which shapes would be clipped or hidden at each breakpoint
 *  - Export breakpoint config as CSS media queries
 */

import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Breakpoint {
  id: string;
  name: string;
  width: number;
  height: number;
  active: boolean;
}

// ── Utility exports (tested separately) ──────────────────────────────────────

/** Built-in breakpoint presets */
export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { id: 'mobile', name: 'Mobile', width: 375, height: 667, active: true },
  { id: 'tablet', name: 'Tablet', width: 768, height: 1024, active: true },
  { id: 'laptop', name: 'Laptop', width: 1280, height: 800, active: true },
  { id: 'desktop', name: 'Desktop', width: 1920, height: 1080, active: false },
];

/** Get which shapes exceed the viewport width */
export function getClippedShapes(shapes: Shape[], viewportWidth: number): string[] {
  return shapes
    .filter(s => s.x + s.width > viewportWidth)
    .map(s => s.id);
}

/** Get which shapes are fully hidden (start past viewport right edge) */
export function getHiddenShapes(shapes: Shape[], viewportWidth: number): string[] {
  return shapes
    .filter(s => s.x >= viewportWidth)
    .map(s => s.id);
}

/** Export breakpoints as CSS media queries */
export function exportMediaQueries(breakpoints: Breakpoint[], containerClass = '.container'): string {
  const active = [...breakpoints].filter(b => b.active).sort((a, b) => a.width - b.width);
  if (active.length === 0) return '/* No active breakpoints */';
  const lines: string[] = [];
  lines.push(`/* Auto-generated breakpoint media queries */`);
  lines.push('');
  // Mobile-first approach
  lines.push(`/* Default — mobile (< ${active[0].width}px) */`);
  lines.push(`${containerClass} { width: 100%; padding: 0 16px; }`);
  lines.push('');
  for (let i = 0; i < active.length; i++) {
    const bp = active[i];
    lines.push(`/* ${bp.name} — ${bp.width}px and up */`);
    lines.push(`@media (min-width: ${bp.width}px) {`);
    lines.push(`  ${containerClass} { max-width: ${bp.width}px; margin: 0 auto; }`);
    lines.push(`}`);
    if (i < active.length - 1) lines.push('');
  }
  return lines.join('\n');
}

/** Sort breakpoints by width ascending */
export function sortBreakpoints(bps: Breakpoint[]): Breakpoint[] {
  return [...bps].sort((a, b) => a.width - b.width);
}

/** Scale factor to fit a canvas width into a preview pane width */
export function previewScale(canvasWidth: number, viewportWidth: number, paneWidth: number): number {
  if (canvasWidth <= 0 || paneWidth <= 0) return 1;
  const factor = Math.min(paneWidth / viewportWidth, 1);
  return factor;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 380,
  width: 480,
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

function uid() { return Math.random().toString(36).slice(2, 8); }

// ── Mini canvas renderer ──────────────────────────────────────────────────────

function ShapeSVG({ shape, scale, clipped, hidden }: {
  shape: Shape;
  scale: number;
  clipped: boolean;
  hidden: boolean;
}) {
  const sx = shape.x * scale;
  const sy = shape.y * scale;
  const sw = shape.width * scale;
  const sh = shape.height * scale;
  const rx = Array.isArray(shape.borderRadius) ? shape.borderRadius[0] * scale : (shape.borderRadius ?? 0) * scale;

  const fill = hidden ? 'transparent' : (clipped ? '#ef444444' : (shape.fill || '#888888'));
  const stroke = clipped ? '#ef4444' : (shape.stroke || 'none');

  return (
    <rect
      x={sx}
      y={sy}
      width={Math.max(sw, 0)}
      height={Math.max(sh, 0)}
      rx={Math.min(rx, Math.min(sw, sh) / 2)}
      fill={fill}
      stroke={stroke}
      strokeWidth={clipped ? 1 : 0}
      opacity={hidden ? 0.15 : (shape.opacity ?? 1)}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  canvasWidth?: number;
  canvasHeight?: number;
}

export function BreakpointSimulatorPanel({ open, onClose, shapes, canvasWidth = 1440, canvasHeight = 900 }: Props) {
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>(DEFAULT_BREAKPOINTS);
  const [showCSS, setShowCSS] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWidth, setNewWidth] = useState('');
  const [newHeight, setNewHeight] = useState('');

  const activeBreakpoints = useMemo(
    () => breakpoints.filter(b => b.active),
    [breakpoints]
  );

  const cssCode = useMemo(() => exportMediaQueries(breakpoints), [breakpoints]);

  const toggleActive = (id: string) => {
    setBreakpoints(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
  };

  const removeBreakpoint = (id: string) => {
    setBreakpoints(prev => prev.filter(b => b.id !== id));
  };

  const addBreakpoint = () => {
    const w = parseInt(newWidth);
    const h = parseInt(newHeight) || 800;
    if (!newName.trim() || !w || w < 200) return;
    setBreakpoints(prev => sortBreakpoints([...prev, {
      id: uid(),
      name: newName.trim(),
      width: w,
      height: h,
      active: true,
    }]));
    setNewName('');
    setNewWidth('');
    setNewHeight('');
  };

  const copyCSS = async () => {
    try {
      await navigator.clipboard.writeText(cssCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (!open) return null;

  // Preview pane dimensions
  const PANE_W = 140;
  const PANE_H = 90;

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Breakpoint Simulator</span>
          <span style={{
            background: '#3a1a1a',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            color: '#a08080',
          }}>
            {activeBreakpoints.length} active
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{ ...BTN_SM, background: showCSS ? '#4a1a1a' : '#2a1010' }}
            onClick={() => setShowCSS(v => !v)}
          >
            CSS
          </button>
          <button style={CLOSE_BTN} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* CSS export */}
      {showCSS && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#a08080' }}>Mobile-first @media queries</span>
            <button
              style={{ ...BTN_SM, background: copied ? '#1a3a1a' : '#2a1010', color: copied ? '#22c55e' : '#e8d5d5' }}
              onClick={copyCSS}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            readOnly
            value={cssCode}
            style={{
              ...INPUT,
              width: '100%',
              height: 110,
              resize: 'none',
              fontFamily: 'monospace',
              fontSize: 11,
              lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Breakpoint list + toggles */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#a08080', marginBottom: 8 }}>Breakpoints</div>
          {breakpoints.map(bp => (
            <div key={bp.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 0',
              borderBottom: '1px solid #2a1010',
            }}>
              <input
                type="checkbox"
                checked={bp.active}
                onChange={() => toggleActive(bp.id)}
                style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, flex: 1, color: bp.active ? '#e8d5d5' : '#6a4a4a' }}>
                {bp.name}
              </span>
              <span style={{ fontSize: 11, color: '#a08080', fontFamily: 'monospace' }}>
                {bp.width}×{bp.height}
              </span>
              {/* Clipped indicator */}
              {bp.active && (() => {
                const clipped = getClippedShapes(shapes, bp.width).length;
                return clipped > 0 ? (
                  <span style={{ fontSize: 10, color: '#ef4444', background: '#3a1010', borderRadius: 4, padding: '1px 5px' }}>
                    {clipped} clipped
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: '#22c55e', background: '#0a2a0a', borderRadius: 4, padding: '1px 5px' }}>
                    ✓ fits
                  </span>
                );
              })()}
              {!['mobile', 'tablet', 'laptop', 'desktop'].includes(bp.id) && (
                <button
                  onClick={() => removeBreakpoint(bp.id)}
                  style={{ ...BTN_SM, padding: '2px 6px', fontSize: 11, color: '#a08080' }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Add custom breakpoint */}
          <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ ...INPUT, width: 90 }}
              placeholder="Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              style={{ ...INPUT, width: 68 }}
              placeholder="Width px"
              value={newWidth}
              type="number"
              min={200}
              onChange={e => setNewWidth(e.target.value)}
            />
            <input
              style={{ ...INPUT, width: 68 }}
              placeholder="Height px"
              value={newHeight}
              type="number"
              min={200}
              onChange={e => setNewHeight(e.target.value)}
            />
            <button style={{ ...BTN_SM, background: '#b5533c', border: '1px solid #c5634c' }} onClick={addBreakpoint}>
              + Add
            </button>
          </div>
        </div>

        {/* Multi-viewport previews */}
        {activeBreakpoints.length > 0 && shapes.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#a08080', marginBottom: 8 }}>
              Canvas preview at each breakpoint
              <span style={{ marginLeft: 8, color: '#ef4444' }}>■ clipped</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {activeBreakpoints.map(bp => {
                const scale = previewScale(canvasWidth, bp.width, PANE_W);
                const clippedIds = new Set(getClippedShapes(shapes, bp.width));
                const hiddenIds = new Set(getHiddenShapes(shapes, bp.width));
                const displayH = Math.min(PANE_H, bp.height * scale);
                const clippedCount = clippedIds.size - hiddenIds.size;

                return (
                  <div key={bp.id}>
                    <div style={{ fontSize: 10, color: '#a08080', marginBottom: 4 }}>
                      {bp.name} — {bp.width}px
                    </div>
                    <div style={{
                      width: PANE_W,
                      height: PANE_H,
                      background: '#0d0505',
                      border: `1px solid ${clippedCount > 0 ? '#ef444466' : '#3a1a1a'}`,
                      borderRadius: 6,
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      {/* Device frame indicator */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        border: `2px solid ${clippedCount > 0 ? '#ef444433' : '#3a1a1a22'}`,
                        borderRadius: 6,
                        pointerEvents: 'none',
                        zIndex: 1,
                      }} />

                      <svg
                        width={PANE_W}
                        height={PANE_H}
                        viewBox={`0 0 ${bp.width * scale} ${displayH}`}
                        preserveAspectRatio="xMinYMin meet"
                      >
                        {/* Viewport bound line */}
                        <rect
                          x={0}
                          y={0}
                          width={bp.width * scale}
                          height={displayH}
                          fill="#1a0808"
                        />
                        {shapes.map(shape => (
                          <ShapeSVG
                            key={shape.id}
                            shape={shape}
                            scale={scale}
                            clipped={clippedIds.has(shape.id) && !hiddenIds.has(shape.id)}
                            hidden={hiddenIds.has(shape.id)}
                          />
                        ))}
                      </svg>
                    </div>
                    <div style={{ fontSize: 10, textAlign: 'center', marginTop: 3, color: clippedCount > 0 ? '#ef4444' : '#22c55e' }}>
                      {clippedCount > 0 ? `${clippedCount} overflow` : 'ok'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {shapes.length === 0 && (
          <div style={{ textAlign: 'center', color: '#a08080', fontSize: 13, padding: '24px 0' }}>
            Add shapes to the canvas to preview them at each breakpoint.
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
        <span>⌘⌥9 to toggle</span>
        <span>{shapes.length} shapes · canvas {canvasWidth}×{canvasHeight}</span>
      </div>
    </div>
  );
}
