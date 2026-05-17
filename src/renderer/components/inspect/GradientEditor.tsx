/**
 * GradientEditor — a compact stop-strip editor for linear/radial gradients.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────┐
 *   │  gradient preview bar (click to add stop)        │
 *   │  ◆     ◆                                         │  ← stop handles
 *   └──────────────────────────────────────────────────┘
 *   Selected stop: [color swatch] [position %] [✕ remove]
 *   (for linear) angle: [____°]
 *
 * The component is fully controlled — all changes call onPreview / onChange.
 */

import { useRef, useState } from 'react';
import type { GradientStop } from '../../lib/shapes';

interface Props {
  type: 'linear-gradient' | 'radial-gradient';
  stops: GradientStop[];
  angle: number; // degrees, linear only
  onPreview: (stops: GradientStop[], angle: number) => void;
  onChange: (stops: GradientStop[], angle: number) => void;
}

const BAR_HEIGHT = 24;
const HANDLE_SIZE = 12;

function gradientCss(type: Props['type'], stops: GradientStop[], angle: number): string {
  const stopsStr = stops.map(s => `${s.color} ${(s.position * 100).toFixed(1)}%`).join(', ');
  return type === 'linear-gradient'
    ? `linear-gradient(${angle}deg, ${stopsStr})`
    : `radial-gradient(circle, ${stopsStr})`;
}

export function GradientEditor({ type, stops, angle, onPreview, onChange }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const draggingIdx = useRef<number | null>(null);

  const sorted = [...stops].sort((a, b) => a.position - b.position);

  const getPositionFromEvent = (e: React.MouseEvent | MouseEvent): number => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const handleBarClick = (e: React.MouseEvent) => {
    // Don't add a stop if clicking an existing handle
    const target = e.target as HTMLElement;
    if (target.dataset.handle) return;
    const pos = getPositionFromEvent(e);
    // Interpolate color at click position
    const newColor = interpolateColor(stops, pos);
    const next = [...stops, { color: newColor, position: pos }].sort((a, b) => a.position - b.position);
    const newIdx = next.findIndex(s => s.position === pos && s.color === newColor);
    setSelectedIdx(newIdx);
    onChange(next, angle);
  };

  const handleHandleMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setSelectedIdx(idx);
    draggingIdx.current = idx;

    const onMove = (me: MouseEvent) => {
      if (draggingIdx.current === null) return;
      const pos = getPositionFromEvent(me);
      const next = stops.map((s, i) => i === draggingIdx.current ? { ...s, position: pos } : s);
      onPreview(next, angle);
    };
    const onUp = (me: MouseEvent) => {
      if (draggingIdx.current === null) { draggingIdx.current = null; return; }
      const pos = getPositionFromEvent(me);
      const next = stops.map((s, i) => i === draggingIdx.current ? { ...s, position: pos } : s);
      draggingIdx.current = null;
      onChange(next, angle);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleColorChange = (color: string) => {
    const next = stops.map((s, i) => i === selectedIdx ? { ...s, color } : s);
    onChange(next, angle);
  };

  const handlePositionChange = (pos: number) => {
    const clamped = Math.max(0, Math.min(1, pos));
    const next = stops.map((s, i) => i === selectedIdx ? { ...s, position: clamped } : s);
    onChange(next, angle);
  };

  const handleRemoveStop = () => {
    if (stops.length <= 2) return; // minimum 2 stops
    const next = stops.filter((_, i) => i !== selectedIdx);
    setSelectedIdx(Math.max(0, selectedIdx - 1));
    onChange(next, angle);
  };

  const selectedStop = stops[selectedIdx] ?? stops[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Gradient bar + handles */}
      <div style={{ position: 'relative', paddingBottom: HANDLE_SIZE + 4 }}>
        {/* Bar */}
        <div
          ref={barRef}
          onClick={handleBarClick}
          style={{
            height: BAR_HEIGHT,
            borderRadius: 6,
            backgroundImage: gradientCss(type, sorted, angle),
            cursor: 'crosshair',
            border: '1px solid var(--border)',
            position: 'relative',
            userSelect: 'none',
          }}
        />

        {/* Stop handles (positioned below the bar) */}
        {stops.map((stop, idx) => (
          <div
            key={idx}
            data-handle="1"
            onMouseDown={(e) => handleHandleMouseDown(e, idx)}
            style={{
              position: 'absolute',
              top: BAR_HEIGHT + 2,
              left: `calc(${stop.position * 100}% - ${HANDLE_SIZE / 2}px)`,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              borderRadius: '50%',
              background: stop.color,
              border: `2px solid ${idx === selectedIdx ? 'var(--text)' : 'var(--border)'}`,
              cursor: 'ew-resize',
              boxShadow: idx === selectedIdx ? '0 0 0 1px var(--accent)' : 'none',
              zIndex: idx === selectedIdx ? 2 : 1,
            }}
          />
        ))}
      </div>

      {/* Selected stop controls */}
      {selectedStop && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Color swatch/picker */}
          <label style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
            <div style={{
              width: 24, height: 24, borderRadius: 5,
              background: selectedStop.color,
              border: '1px solid var(--border)',
            }} />
            <input
              type="color"
              value={selectedStop.color}
              onChange={(e) => handleColorChange(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
            />
          </label>

          {/* Position % */}
          <input
            type="number"
            value={Math.round(selectedStop.position * 100)}
            min={0}
            max={100}
            onChange={(e) => handlePositionChange(Number(e.target.value) / 100)}
            style={{
              width: 52, height: 24, padding: '0 6px',
              borderRadius: 5, border: '1px solid var(--border)',
              background: 'var(--input-bg)', color: 'var(--text)',
              fontSize: 12, outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>%</span>

          {/* Remove stop */}
          <button
            onClick={handleRemoveStop}
            disabled={stops.length <= 2}
            title="Remove stop"
            style={{
              marginLeft: 'auto',
              background: 'none', border: 'none', cursor: stops.length <= 2 ? 'default' : 'pointer',
              color: stops.length <= 2 ? 'var(--subtle)' : 'var(--muted)',
              fontSize: 14, padding: '0 2px',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { if (stops.length > 2) e.currentTarget.style.color = 'var(--error)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = stops.length <= 2 ? 'var(--subtle)' : 'var(--muted)'; }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Angle control (linear only) */}
      {type === 'linear-gradient' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>Angle</span>
          <input
            type="range"
            min={0}
            max={359}
            value={angle}
            onChange={(e) => onPreview(stops, Number(e.target.value))}
            onMouseUp={(e) => onChange(stops, Number((e.target as HTMLInputElement).value))}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <input
            type="number"
            value={angle}
            min={0}
            max={359}
            onChange={(e) => onChange(stops, Number(e.target.value))}
            style={{
              width: 48, height: 24, padding: '0 4px',
              borderRadius: 5, border: '1px solid var(--border)',
              background: 'var(--input-bg)', color: 'var(--text)',
              fontSize: 12, outline: 'none', textAlign: 'right',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>°</span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Interpolate a colour at a given position across a stop list. */
function interpolateColor(stops: GradientStop[], pos: number): string {
  if (stops.length === 0) return '#ffffff';
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  if (pos <= sorted[0].position) return sorted[0].color;
  if (pos >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (pos >= a.position && pos <= b.position) {
      const t = (pos - a.position) / (b.position - a.position);
      return lerpHex(a.color, b.color, t);
    }
  }
  return sorted[0].color;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.padEnd(6, '0'), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
