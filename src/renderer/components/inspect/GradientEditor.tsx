/**
 * GradientEditor — a polished stop-strip editor for linear/radial gradients.
 *
 * Features:
 *  - Draggable color stops on a gradient bar
 *  - Click bar to add stop (interpolated color)
 *  - Per-stop color + opacity (RGBA)
 *  - Delete stop (min 2)
 *  - Angle slider + number input (linear only)
 *  - Preset gradient swatches
 *  - Reverse gradient button
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

const BAR_HEIGHT = 28;
const HANDLE_SIZE = 14;

// ── Preset gradients ──────────────────────────────────────────────────────────

const PRESETS: { label: string; stops: GradientStop[]; angle: number }[] = [
  { label: 'Indigo→Purple', stops: [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }], angle: 135 },
  { label: 'Ocean', stops: [{ color: '#0ea5e9', position: 0 }, { color: '#2563eb', position: 1 }], angle: 135 },
  { label: 'Sunset', stops: [{ color: '#f59e0b', position: 0 }, { color: '#ef4444', position: 1 }], angle: 135 },
  { label: 'Rose', stops: [{ color: '#ec4899', position: 0 }, { color: '#f43f5e', position: 1 }], angle: 90 },
  { label: 'Emerald', stops: [{ color: '#10b981', position: 0 }, { color: '#06b6d4', position: 1 }], angle: 135 },
  { label: 'Void', stops: [{ color: '#0f0f1a', position: 0 }, { color: '#1e1b4b', position: 1 }], angle: 135 },
  { label: 'Aurora', stops: [{ color: '#06b6d4', position: 0 }, { color: '#8b5cf6', position: 0.5 }, { color: '#ec4899', position: 1 }], angle: 135 },
  { label: 'Peach', stops: [{ color: '#fbbf24', position: 0 }, { color: '#f472b6', position: 1 }], angle: 90 },
];

function gradientCss(type: Props['type'], stops: GradientStop[], angle: number): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const stopsStr = sorted.map(s => {
    const hasAlpha = s.opacity !== undefined && s.opacity < 1;
    if (hasAlpha) {
      const r = parseInt(s.color.slice(1, 3), 16);
      const g = parseInt(s.color.slice(3, 5), 16);
      const b = parseInt(s.color.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${(s.opacity ?? 1).toFixed(2)}) ${(s.position * 100).toFixed(1)}%`;
    }
    return `${s.color} ${(s.position * 100).toFixed(1)}%`;
  }).join(', ');
  return type === 'linear-gradient'
    ? `linear-gradient(${angle}deg, ${stopsStr})`
    : `radial-gradient(circle, ${stopsStr})`;
}

export function GradientEditor({ type, stops, angle, onPreview, onChange }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const draggingIdx = useRef<number | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const sorted = [...stops].sort((a, b) => a.position - b.position);

  const getPositionFromEvent = (e: React.MouseEvent | MouseEvent): number => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const handleBarClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.dataset.handle) return;
    const pos = getPositionFromEvent(e);
    const newColor = interpolateColor(stops, pos);
    const next = [...stops, { color: newColor, position: pos }].sort((a, b) => a.position - b.position);
    const newIdx = next.findIndex(s => s.position === pos && s.color === newColor);
    setSelectedIdx(Math.max(0, newIdx));
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

  const handleOpacityChange = (opacity: number) => {
    const next = stops.map((s, i) => i === selectedIdx ? { ...s, opacity: Math.max(0, Math.min(1, opacity)) } : s);
    onChange(next, angle);
  };

  const handlePositionChange = (pos: number) => {
    const clamped = Math.max(0, Math.min(1, pos));
    const next = stops.map((s, i) => i === selectedIdx ? { ...s, position: clamped } : s);
    onChange(next, angle);
  };

  const handleRemoveStop = () => {
    if (stops.length <= 2) return;
    const next = stops.filter((_, i) => i !== selectedIdx);
    setSelectedIdx(Math.max(0, selectedIdx - 1));
    onChange(next, angle);
  };

  const handleReverse = () => {
    const next = stops.map(s => ({ ...s, position: 1 - s.position }));
    onChange(next, angle);
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    onChange(preset.stops, preset.angle);
    setShowPresets(false);
  };

  const selectedStop = stops[selectedIdx] ?? stops[0];
  const selectedOpacity = selectedStop?.opacity ?? 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Gradient bar + handles */}
      <div style={{ position: 'relative', paddingBottom: HANDLE_SIZE + 4, userSelect: 'none' }}>
        {/* Checkered background for transparency */}
        <div style={{
          position: 'absolute', inset: 0, height: BAR_HEIGHT, borderRadius: 6,
          backgroundImage: 'linear-gradient(45deg, #555 25%, transparent 25%), linear-gradient(-45deg, #555 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #555 75%), linear-gradient(-45deg, transparent 75%, #555 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
          backgroundColor: '#333',
          border: '1px solid var(--border)',
        }} />
        {/* Gradient overlay */}
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
          }}
        />

        {/* Stop handles (positioned below the bar) */}
        {stops.map((stop, idx) => {
          const isSelected = idx === selectedIdx;
          return (
            <div
              key={idx}
              data-handle="1"
              onMouseDown={(e) => handleHandleMouseDown(e, idx)}
              title={`Stop ${idx + 1}: ${stop.color}`}
              style={{
                position: 'absolute',
                top: BAR_HEIGHT + 3,
                left: `calc(${stop.position * 100}% - ${HANDLE_SIZE / 2}px)`,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                borderRadius: '50%',
                background: stop.color,
                border: `2px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.4)'}`,
                cursor: 'ew-resize',
                boxShadow: isSelected
                  ? '0 0 0 2px var(--accent), 0 2px 6px rgba(0,0,0,0.4)'
                  : '0 1px 4px rgba(0,0,0,0.4)',
                zIndex: isSelected ? 2 : 1,
                transition: 'box-shadow 0.1s',
              }}
            />
          );
        })}
      </div>

      {/* Selected stop controls */}
      {selectedStop && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* Color swatch/picker */}
          <label style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }} title="Stop color">
            <div style={{
              width: 22, height: 22, borderRadius: 4,
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
            onKeyDown={e => e.stopPropagation()}
            title="Stop position (%)"
            style={inputStyle}
          />
          <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>%</span>

          {/* Opacity */}
          <input
            type="number"
            value={Math.round(selectedOpacity * 100)}
            min={0}
            max={100}
            onChange={(e) => handleOpacityChange(Number(e.target.value) / 100)}
            onKeyDown={e => e.stopPropagation()}
            title="Stop opacity (%)"
            style={inputStyle}
          />
          <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>α</span>

          {/* Remove stop */}
          <button
            onClick={handleRemoveStop}
            disabled={stops.length <= 2}
            title="Remove stop"
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: stops.length <= 2 ? 'default' : 'pointer',
              color: stops.length <= 2 ? 'rgba(255,255,255,0.15)' : 'var(--muted)',
              fontSize: 14, padding: '0 2px', display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { if (stops.length > 2) e.currentTarget.style.color = 'var(--error)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = stops.length <= 2 ? 'rgba(255,255,255,0.15)' : 'var(--muted)'; }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Angle control (linear only) */}
      {type === 'linear-gradient' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Angle wheel */}
          <AngleWheel value={angle} onChange={(a) => onPreview(stops, a)} onCommit={(a) => onChange(stops, a)} />
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
            onKeyDown={e => e.stopPropagation()}
            style={{ ...inputStyle, width: 44, textAlign: 'right' }}
          />
          <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>°</span>
        </div>
      )}

      {/* Toolbar: reverse + presets */}
      <div style={{ display: 'flex', gap: 5 }}>
        <button onClick={handleReverse} title="Reverse gradient" style={toolBtnStyle}>
          ⇄ Reverse
        </button>
        <div style={{ position: 'relative', flex: 1 }}>
          <button
            onClick={() => setShowPresets(s => !s)}
            title="Gradient presets"
            style={{ ...toolBtnStyle, width: '100%' }}
          >
            ✦ Presets
          </button>
          {showPresets && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
              background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 6, zIndex: 100,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  title={preset.label}
                  style={{
                    height: 24, borderRadius: 5, border: '1px solid var(--border)',
                    cursor: 'pointer', padding: 0, overflow: 'hidden',
                    backgroundImage: gradientCss('linear-gradient', preset.stops, preset.angle),
                    position: 'relative',
                  }}
                >
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 9, color: 'rgba(255,255,255,0.75)',
                    fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    backdropFilter: 'brightness(0.8)',
                  }}>
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Angle wheel ────────────────────────────────────────────────────────────────

function AngleWheel({ value, onChange, onCommit }: { value: number; onChange: (a: number) => void; onCommit: (a: number) => void }) {
  const elRef = useRef<HTMLDivElement>(null);

  const getAngle = (e: MouseEvent | React.MouseEvent): number => {
    const el = elRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rad = Math.atan2(e.clientY - cy, e.clientX - cx);
    let deg = (rad * 180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    return Math.round(deg) % 360;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (me: MouseEvent) => onChange(getAngle(me));
    const onUp = (me: MouseEvent) => {
      onCommit(getAngle(me));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    onChange(getAngle(e));
  };

  const rad = ((value - 90) * Math.PI) / 180;
  const r = 7;
  const dotX = 10 + r * Math.cos(rad);
  const dotY = 10 + r * Math.sin(rad);

  return (
    <div
      ref={elRef}
      onMouseDown={handleMouseDown}
      title={`Angle: ${value}°`}
      style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        border: '1px solid var(--border)', background: 'var(--input-bg)',
        cursor: 'crosshair', position: 'relative', overflow: 'visible',
      }}
    >
      <svg width="20" height="20" style={{ position: 'absolute', inset: 0 }}>
        <line x1={10} y1={10} x2={dotX} y2={dotY} stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={dotX} cy={dotY} r={2.5} fill="var(--accent)" />
      </svg>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: 44, height: 22, padding: '0 5px',
  borderRadius: 4, border: '1px solid var(--border)',
  background: 'var(--input-bg)', color: 'var(--text)',
  fontSize: 11, outline: 'none', textAlign: 'center',
  fontFamily: 'monospace',
};

const toolBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  borderRadius: 5, color: 'var(--muted)', cursor: 'pointer',
  fontSize: 10, padding: '4px 8px', display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 4, transition: 'all 0.1s',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

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
