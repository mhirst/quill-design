/**
 * BreakpointRulerOverlay — Responsive breakpoint ruler on canvas.
 *
 * Features:
 *  - Renders vertical dashed lines at common breakpoint widths (xs/sm/md/lg/xl/2xl)
 *  - Labeled with viewport name + pixel value
 *  - Highlights which breakpoint range the cursor is in
 *  - Breakpoint chips panel — toggle individual breakpoints
 *  - Custom breakpoint: add your own (px value + name)
 *  - Tailwind, Bootstrap, or custom preset sets
 *  - Shaded region between breakpoints with alternating opacity
 *  - Rendered as SVG overlay inside the canvas container
 *  - Keyboard: ⌘⇧⌥K to toggle
 */

import React, { useCallback, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Breakpoint {
  id: string;
  name: string;
  px: number;
  color: string;
  visible: boolean;
}

export interface Props {
  open: boolean;
  zoom: number;
  panX: number;
  canvasWidth: number;
  canvasHeight: number;
}

// ── Preset sets ────────────────────────────────────────────────────────────────

const TAILWIND_PRESETS: Omit<Breakpoint, 'id' | 'visible'>[] = [
  { name: 'sm', px: 640,  color: '#60a5fa' },
  { name: 'md', px: 768,  color: '#34d399' },
  { name: 'lg', px: 1024, color: '#fbbf24' },
  { name: 'xl', px: 1280, color: '#f87171' },
  { name: '2xl', px: 1536, color: '#a78bfa' },
];

const BOOTSTRAP_PRESETS: Omit<Breakpoint, 'id' | 'visible'>[] = [
  { name: 'xs', px: 0,    color: '#64748b' },
  { name: 'sm', px: 576,  color: '#60a5fa' },
  { name: 'md', px: 768,  color: '#34d399' },
  { name: 'lg', px: 992,  color: '#fbbf24' },
  { name: 'xl', px: 1200, color: '#f87171' },
  { name: 'xxl', px: 1400, color: '#a78bfa' },
];

const DEVICE_PRESETS: Omit<Breakpoint, 'id' | 'visible'>[] = [
  { name: 'iPhone SE', px: 375,  color: '#60a5fa' },
  { name: 'iPhone 14', px: 390,  color: '#818cf8' },
  { name: 'iPad',      px: 768,  color: '#34d399' },
  { name: 'iPad Pro',  px: 1024, color: '#fbbf24' },
  { name: 'Desktop',   px: 1280, color: '#f87171' },
  { name: '4K',        px: 1920, color: '#a78bfa' },
];

function uid() { return Math.random().toString(36).slice(2, 8); }

function makeBreakpoints(presets: Omit<Breakpoint, 'id' | 'visible'>[]): Breakpoint[] {
  return presets.map(p => ({ ...p, id: uid(), visible: true }));
}

// ── SVG Overlay ────────────────────────────────────────────────────────────────

interface OverlayProps {
  breakpoints: Breakpoint[];
  zoom: number;
  panX: number;
  canvasWidth: number;
  canvasHeight: number;
  hoveredBp: string | null;
}

function BreakpointOverlaySVG({ breakpoints, zoom, panX, canvasWidth, canvasHeight, hoveredBp }: OverlayProps) {
  const visible = breakpoints.filter(bp => bp.visible && bp.px > 0);

  return (
    <svg
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        zIndex: 18, overflow: 'visible',
      }}
    >
      {visible.map((bp, i) => {
        const screenX = bp.px * zoom + panX;
        if (screenX < 0 || screenX > canvasWidth + 100) return null;
        const isHovered = hoveredBp === bp.id;

        return (
          <g key={bp.id}>
            {/* Shaded region (between this bp and next) */}
            {i < visible.length - 1 && (() => {
              const nextX = visible[i + 1].px * zoom + panX;
              return (
                <rect
                  x={screenX}
                  y={0}
                  width={Math.max(0, nextX - screenX)}
                  height={canvasHeight}
                  fill={bp.color}
                  opacity={i % 2 === 0 ? 0.025 : 0.015}
                />
              );
            })()}

            {/* Dashed line */}
            <line
              x1={screenX} y1={0}
              x2={screenX} y2={canvasHeight}
              stroke={bp.color}
              strokeWidth={isHovered ? 1.5 : 1}
              strokeDasharray={isHovered ? '4 3' : '6 4'}
              opacity={isHovered ? 0.9 : 0.5}
            />

            {/* Label */}
            <g>
              <rect
                x={screenX + 3}
                y={8}
                width={bp.name.length * 6 + 16}
                height={16}
                rx={3}
                fill={bp.color}
                opacity={0.9}
              />
              <text
                x={screenX + 11}
                y={19}
                fill="white"
                fontSize={8}
                fontFamily="system-ui, monospace"
                fontWeight={700}
                opacity={1}
              >
                {bp.name}
              </text>
            </g>

            {/* Pixel label below */}
            <text
              x={screenX + 3}
              y={30}
              fill={bp.color}
              fontSize={7}
              fontFamily="system-ui, monospace"
              opacity={0.6}
            >
              {bp.px}px
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Control Panel ──────────────────────────────────────────────────────────────

interface ControlProps {
  breakpoints: Breakpoint[];
  onChange: (bps: Breakpoint[]) => void;
  onClose: () => void;
  hoveredBp: string | null;
  setHoveredBp: (id: string | null) => void;
}

function BreakpointControls({ breakpoints, onChange, onClose, hoveredBp, setHoveredBp }: ControlProps) {
  const [preset, setPreset] = useState<'tailwind' | 'bootstrap' | 'device'>('tailwind');
  const [customName, setCustomName] = useState('');
  const [customPx, setCustomPx] = useState('');

  const loadPreset = useCallback((p: typeof preset) => {
    setPreset(p);
    const map: Record<typeof p, Omit<Breakpoint, 'id' | 'visible'>[]> = {
      tailwind: TAILWIND_PRESETS,
      bootstrap: BOOTSTRAP_PRESETS,
      device: DEVICE_PRESETS,
    };
    onChange(makeBreakpoints(map[p]));
  }, [onChange]);

  const toggleBp = useCallback((id: string) => {
    onChange(breakpoints.map(bp => bp.id === id ? { ...bp, visible: !bp.visible } : bp));
  }, [breakpoints, onChange]);

  const deleteBp = useCallback((id: string) => {
    onChange(breakpoints.filter(bp => bp.id !== id));
  }, [breakpoints, onChange]);

  const addCustom = useCallback(() => {
    const px = parseInt(customPx, 10);
    if (!customName.trim() || isNaN(px) || px <= 0) return;
    const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c'];
    const color = colors[breakpoints.length % colors.length];
    onChange([...breakpoints, { id: uid(), name: customName.trim(), px, color, visible: true }]
      .sort((a, b) => a.px - b.px));
    setCustomName('');
    setCustomPx('');
  }, [customName, customPx, breakpoints, onChange]);

  return (
    <div style={{
      position: 'absolute',
      top: 48,
      right: 12,
      width: 240,
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 30,
      pointerEvents: 'all',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12 }}>📐</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
            Breakpoints
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}
        >
          ✕
        </button>
      </div>

      {/* Preset selector */}
      <div style={{ display: 'flex', gap: 3, padding: '6px 10px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
        {(['tailwind', 'bootstrap', 'device'] as const).map(p => (
          <button
            key={p}
            onClick={() => loadPreset(p)}
            style={{
              flex: 1, height: 22, fontSize: 8,
              background: preset === p ? 'rgba(99,102,241,0.2)' : 'transparent',
              border: `1px solid ${preset === p ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
              borderRadius: 4, cursor: 'pointer',
              color: preset === p ? '#818cf8' : 'var(--muted, #888)',
              textTransform: 'capitalize',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Breakpoint list */}
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {[...breakpoints].sort((a, b) => a.px - b.px).map(bp => (
          <div
            key={bp.id}
            onMouseEnter={() => setHoveredBp(bp.id)}
            onMouseLeave={() => setHoveredBp(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px',
              background: hoveredBp === bp.id ? 'rgba(255,255,255,0.04)' : 'transparent',
            }}
          >
            {/* Color dot */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: bp.color, flexShrink: 0,
              opacity: bp.visible ? 1 : 0.3,
            }} />

            {/* Toggle */}
            <input
              type="checkbox"
              checked={bp.visible}
              onChange={() => toggleBp(bp.id)}
              style={{ cursor: 'pointer', accentColor: bp.color, flexShrink: 0 }}
            />

            {/* Name */}
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: bp.visible ? 'var(--text, #e2e8f0)' : 'var(--muted, #888)',
              flex: 1,
            }}>
              {bp.name}
            </span>

            {/* Pixel value */}
            <span style={{ fontSize: 9, color: 'var(--muted, #888)', fontFamily: 'monospace' }}>
              {bp.px}px
            </span>

            {/* Delete */}
            <button
              onClick={() => deleteBp(bp.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted, #888)', fontSize: 10, padding: '0 2px',
                opacity: 0.5, lineHeight: 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--muted, #888)'; }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add custom */}
      <div style={{
        padding: '6px 10px',
        borderTop: '1px solid var(--border, #2d2d3d)',
        display: 'flex', gap: 5,
      }}>
        <input
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          placeholder="Name"
          style={{
            width: 60, background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            color: 'var(--text, #e2e8f0)', fontSize: 9,
            padding: '3px 5px', borderRadius: 4, outline: 'none',
          }}
        />
        <input
          value={customPx}
          onChange={e => setCustomPx(e.target.value)}
          placeholder="px"
          type="number"
          min={1}
          style={{
            width: 55, background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            color: 'var(--text, #e2e8f0)', fontSize: 9,
            padding: '3px 5px', borderRadius: 4, outline: 'none',
          }}
        />
        <button
          onClick={addCustom}
          style={{
            flex: 1, background: 'var(--accent, #6366f1)',
            border: 'none', borderRadius: 4, color: 'white',
            fontSize: 9, fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function BreakpointRulerOverlay({ open, zoom, panX, canvasWidth, canvasHeight }: Props) {
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>(() => makeBreakpoints(TAILWIND_PRESETS));
  const [showControls, setShowControls] = useState(true);
  const [hoveredBp, setHoveredBp] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 18 }}>
      <BreakpointOverlaySVG
        breakpoints={breakpoints}
        zoom={zoom}
        panX={panX}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        hoveredBp={hoveredBp}
      />

      {/* Toggle button (always visible) */}
      <div style={{
        position: 'absolute', top: 8, right: 12,
        pointerEvents: 'all',
        display: 'flex', gap: 5,
      }}>
        <button
          onClick={() => setShowControls(v => !v)}
          style={{
            height: 28, padding: '0 10px',
            background: showControls ? 'rgba(99,102,241,0.2)' : 'var(--panel, #1e1e2e)',
            border: `1px solid ${showControls ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
            borderRadius: 6, cursor: 'pointer',
            color: showControls ? '#818cf8' : 'var(--muted, #888)',
            fontSize: 10, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          📐 Breakpoints ({breakpoints.filter(b => b.visible).length})
        </button>
      </div>

      {/* Controls */}
      {showControls && (
        <div style={{ pointerEvents: 'all' }}>
          <BreakpointControls
            breakpoints={breakpoints}
            onChange={setBreakpoints}
            onClose={() => setShowControls(false)}
            hoveredBp={hoveredBp}
            setHoveredBp={setHoveredBp}
          />
        </div>
      )}
    </div>
  );
}
