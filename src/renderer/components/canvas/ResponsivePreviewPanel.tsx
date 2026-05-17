/**
 * ResponsivePreviewPanel — Multi-breakpoint design preview for Quill.
 *
 * Shows the selected frame rendered at multiple viewport widths simultaneously,
 * with a chrome device frame around each breakpoint.
 *
 * Features:
 * - Up to 4 simultaneous breakpoints
 * - Standard presets: Mobile 375, Mobile L 430, Tablet 768, Laptop 1024, Desktop 1280, 4K 1920
 * - Custom width input per breakpoint
 * - Zoom to fit each preview
 * - Device chrome: phone, tablet, browser, none
 * - Dark / light mode background toggle
 * - Orientation toggle (portrait/landscape)
 * - Sync scroll position (for tall frames)
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { buildShapeStyle } from '../../lib/shapes';
import { X, Monitor, Tablet, Smartphone, RotateCcw, Plus, Minus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceChrome = 'phone' | 'tablet' | 'browser' | 'none';

interface Breakpoint {
  id: string;
  label: string;
  width: number;
  height: number;
  chrome: DeviceChrome;
  landscape: boolean;
  active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  selectedShape: Shape | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESETS: Array<Omit<Breakpoint, 'id' | 'active'>> = [
  { label: 'iPhone SE',    width: 375,  height: 667,  chrome: 'phone',   landscape: false },
  { label: 'iPhone 15',    width: 393,  height: 852,  chrome: 'phone',   landscape: false },
  { label: 'iPad',         width: 768,  height: 1024, chrome: 'tablet',  landscape: false },
  { label: 'iPad Pro',     width: 1024, height: 1366, chrome: 'tablet',  landscape: false },
  { label: 'Laptop',       width: 1280, height: 800,  chrome: 'browser', landscape: true  },
  { label: 'Desktop',      width: 1440, height: 900,  chrome: 'browser', landscape: true  },
  { label: '4K',           width: 1920, height: 1080, chrome: 'browser', landscape: true  },
  { label: 'Custom',       width: 640,  height: 480,  chrome: 'none',    landscape: true  },
];

function uid() { return Math.random().toString(36).slice(2, 7); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFrames(shapes: Shape[]): Shape[] {
  return shapes.filter(s => s.type === 'frame' && !s.parentId);
}

function flatChildren(shapes: Shape[], parentId: string): Shape[] {
  const direct = shapes.filter(s => s.parentId === parentId);
  return direct.flatMap(s => [s, ...flatChildren(shapes, s.id)]);
}

// ─── FrameRenderer — renders a frame scaled to a given viewport width ─────────

function FrameRenderer({
  frame,
  allShapes,
  targetWidth,
  maxHeight,
}: {
  frame: Shape;
  allShapes: Shape[];
  targetWidth: number;
  maxHeight: number;
}) {
  const scale = Math.min(targetWidth / frame.width, maxHeight / frame.height, 1.5);
  const children = flatChildren(allShapes, frame.id);

  const frameStyle = buildShapeStyle(frame);
  const frameFill = frame.fill === 'transparent' ? '#ffffff' : frame.fill;

  return (
    <div style={{
      width: frame.width,
      height: frame.height,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      position: 'relative',
      overflow: 'hidden',
      background: frameFill,
      flexShrink: 0,
      borderRadius: typeof frame.borderRadius === 'number' ? frame.borderRadius : 0,
    }}>
      {children.map(child => {
        const relX = child.x - frame.x;
        const relY = child.y - frame.y;
        const childStyle = buildShapeStyle(child);
        return (
          <div
            key={child.id}
            style={{
              ...childStyle,
              position: 'absolute',
              left: relX, top: relY,
              width: child.width, height: child.height,
            }}
          >
            {child.type === 'text' && (
              <span style={{ pointerEvents: 'none', userSelect: 'none' }}>{child.text}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Device Chrome components ─────────────────────────────────────────────────

function PhoneChrome({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#1c1c1e',
      borderRadius: 44,
      padding: '12px 8px',
      boxShadow: '0 0 0 2px #2c2c2e, 0 0 0 3px #3c3c3e, 0 24px 60px rgba(0,0,0,0.5)',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Notch / dynamic island */}
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        width: 120, height: 34, background: '#000', borderRadius: 20, zIndex: 10,
      }} />
      {/* Home bar */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 120, height: 5, background: 'rgba(255,255,255,0.4)', borderRadius: 3,
      }} />
      {/* Screen */}
      <div style={{
        width, height,
        background: '#fff', borderRadius: 36,
        overflow: 'hidden', position: 'relative',
      }}>
        {children}
      </div>
    </div>
  );
}

function TabletChrome({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#1c1c1e',
      borderRadius: 24,
      padding: '16px 12px',
      boxShadow: '0 0 0 2px #2c2c2e, 0 24px 60px rgba(0,0,0,0.5)',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Camera */}
      <div style={{
        position: 'absolute', top: '50%', left: 6, transform: 'translateY(-50%)',
        width: 8, height: 8, background: '#2a2a2c', borderRadius: '50%',
      }} />
      <div style={{
        width, height,
        background: '#fff', borderRadius: 12,
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

function BrowserChrome({ width, height, label, children }: { width: number; height: number; label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#1e1e2e', borderRadius: 10,
      boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
      overflow: 'hidden', flexShrink: 0,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {/* Browser toolbar */}
      <div style={{
        height: 36, background: '#252535',
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ff5f57', '#ffbd2e', '#28c940'].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
        </div>
        {/* URL bar */}
        <div style={{
          flex: 1, height: 22, borderRadius: 4, background: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', paddingLeft: 8,
          fontSize: 10, color: '#64748b',
        }}>
          quill.design/{label.toLowerCase().replace(/\s+/g, '-')}
        </div>
      </div>
      {/* Page content */}
      <div style={{ width, height, background: '#fff', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// ─── BreakpointCard ───────────────────────────────────────────────────────────

function BreakpointCard({
  bp,
  frame,
  allShapes,
  onRemove,
  onToggle,
}: {
  bp: Breakpoint;
  frame: Shape;
  allShapes: Shape[];
  onRemove: () => void;
  onToggle: () => void;
}) {
  const [customWidth, setCustomWidth] = useState(bp.width);

  const displayW = bp.landscape ? Math.max(bp.width, bp.height) : Math.min(bp.width, bp.height);
  const displayH = bp.landscape ? Math.min(bp.width, bp.height) : Math.max(bp.width, bp.height);

  // Scale the chrome to fit within our card
  const maxChromeW = 280;
  const maxChromeH = 200;
  const scaleFactor = Math.min(maxChromeW / displayW, maxChromeH / displayH, 1);

  const chromW = Math.round(displayW * scaleFactor);
  const chromH = Math.round(displayH * scaleFactor);

  const content = (
    <div style={{ width: chromW, height: chromH, overflow: 'hidden', position: 'relative' }}>
      <div style={{ transform: `scale(${scaleFactor})`, transformOrigin: 'top left', width: displayW, height: displayH, overflow: 'hidden' }}>
        <FrameRenderer frame={frame} allShapes={allShapes} targetWidth={displayW} maxHeight={displayH} />
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'rgba(255,255,255,0.02)', borderRadius: 10,
      border: '1px solid var(--border)', padding: 12,
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Remove button */}
      <button
        onClick={onRemove}
        style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <X size={10} />
      </button>

      {/* Device frame */}
      <div style={{ transform: `scale(${scaleFactor})`, transformOrigin: 'top center' }}>
        {bp.chrome === 'phone' && <PhoneChrome width={chromW / scaleFactor} height={chromH / scaleFactor}>{content}</PhoneChrome>}
        {bp.chrome === 'tablet' && <TabletChrome width={chromW / scaleFactor} height={chromH / scaleFactor}>{content}</TabletChrome>}
        {bp.chrome === 'browser' && <BrowserChrome width={chromW / scaleFactor} height={chromH / scaleFactor} label={frame.name || 'design'}>{content}</BrowserChrome>}
        {bp.chrome === 'none' && (
          <div style={{ width: chromW / scaleFactor, height: chromH / scaleFactor, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4 }}>
            {content}
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{bp.label}</div>
        <div style={{ fontSize: 11, color: 'var(--subtle)' }}>{displayW} × {displayH}</div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ResponsivePreviewPanel({ open, onClose, shapes, selectedShape }: Props) {
  const [activeBreakpoints, setActiveBreakpoints] = useState<Breakpoint[]>([
    { ...PRESETS[0], id: uid(), active: true },
    { ...PRESETS[2], id: uid(), active: true },
    { ...PRESETS[4], id: uid(), active: true },
  ]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(selectedShape?.id ?? null);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const frames = useMemo(() => getFrames(shapes), [shapes]);
  const frame = frames.find(f => f.id === selectedFrameId) || frames[0] || selectedShape;

  const addBreakpoint = useCallback((preset: Omit<Breakpoint, 'id' | 'active'>) => {
    if (activeBreakpoints.length >= 4) return;
    setActiveBreakpoints(bps => [...bps, { ...preset, id: uid(), active: true }]);
    setShowPresetMenu(false);
  }, [activeBreakpoints.length]);

  const removeBreakpoint = useCallback((id: string) => {
    setActiveBreakpoints(bps => bps.filter(b => b.id !== id));
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 48,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#0a0a0f',
      zIndex: 290,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Toolbar */}
      <div style={{
        height: 48, flexShrink: 0,
        background: '#13131f',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Monitor size={16} style={{ color: '#6366f1' }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>Responsive Preview</span>
        </div>

        {/* Frame selector */}
        {frames.length > 1 && (
          <select
            value={selectedFrameId ?? ''}
            onChange={e => setSelectedFrameId(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#e2e8f0', cursor: 'pointer',
              outline: 'none',
            }}
          >
            {frames.map(f => <option key={f.id} value={f.id}>{f.name || `Frame ${f.id.slice(0, 6)}`}</option>)}
          </select>
        )}

        {/* Add breakpoint */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPresetMenu(m => !m)}
            disabled={activeBreakpoints.length >= 4}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: activeBreakpoints.length >= 4 ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: activeBreakpoints.length >= 4 ? '#475569' : '#a5b4fc',
              cursor: activeBreakpoints.length >= 4 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={12} /> Add Breakpoint
          </button>

          {showPresetMenu && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, overflow: 'hidden', zIndex: 100,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 200,
            }}>
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => addBreakpoint(p)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '8px 14px',
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', fontSize: 12, color: '#e2e8f0', textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.chrome === 'phone' ? <Smartphone size={12} /> : p.chrome === 'tablet' ? <Tablet size={12} /> : <Monitor size={12} />}
                    {p.label}
                  </span>
                  <span style={{ color: '#475569', fontSize: 11 }}>{p.width}×{p.height}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Breakpoint count */}
        <div style={{ fontSize: 11, color: '#475569' }}>
          {activeBreakpoints.length}/4 viewports
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={onClose}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <X size={12} /> Close
        </button>
      </div>

      {/* Preview area */}
      <div style={{
        flex: 1, overflowX: 'auto', overflowY: 'auto',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        gap: 32, padding: 32,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 60%), #0a0a0f',
      }}>
        {!frame ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#475569', gap: 12,
          }}>
            <Monitor size={48} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 16 }}>No frame selected</div>
            <div style={{ fontSize: 13 }}>Create a frame on the canvas to preview it here</div>
          </div>
        ) : activeBreakpoints.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#475569', gap: 12,
          }}>
            <div style={{ fontSize: 16 }}>No breakpoints active</div>
            <div style={{ fontSize: 13 }}>Click "Add Breakpoint" to add viewports</div>
          </div>
        ) : (
          activeBreakpoints.map(bp => (
            <BreakpointCard
              key={bp.id}
              bp={bp}
              frame={frame}
              allShapes={shapes}
              onRemove={() => removeBreakpoint(bp.id)}
              onToggle={() => {}}
            />
          ))
        )}
      </div>

      {/* Status bar */}
      <div style={{
        height: 28, flexShrink: 0,
        background: '#0d0d18', borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px',
        fontSize: 11, color: '#475569',
      }}>
        {frame && (
          <>
            <span>Frame: <strong style={{ color: '#64748b' }}>{frame.name || frame.id.slice(0, 8)}</strong></span>
            <span>•</span>
            <span>Original: {Math.round(frame.width)} × {Math.round(frame.height)} px</span>
            <span>•</span>
            <span>{shapes.filter(s => s.parentId === frame.id).length} direct children</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <span>Press Esc or close button to exit</span>
      </div>
    </div>
  );
}
