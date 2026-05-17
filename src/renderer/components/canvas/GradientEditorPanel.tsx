/**
 * GradientEditorPanel — Visual multi-stop gradient builder.
 *
 * Features:
 *  - Live gradient preview bar
 *  - Draggable color stops on the gradient track
 *  - Angle control (radial dial + numeric input)
 *  - Gradient type: linear / radial / conic
 *  - Add stops by clicking the track, remove by dragging off
 *  - Preset gradients library (20+ curated gradients)
 *  - Apply directly to selected shape's fill
 *
 * Keyboard: ⌘⇧G to toggle
 */

import React, { useCallback, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GradientStop {
  id: string;
  color: string;
  position: number; // 0–100
}

export type GradientType = 'linear' | 'radial' | 'conic';

export interface GradientDef {
  type: GradientType;
  angle: number; // degrees (for linear/conic)
  stops: GradientStop[];
}

export interface Props {
  open: boolean;
  onClose: () => void;
  shape: Shape | null;
  onApply: (gradientCss: string, stops: GradientStop[], type: GradientType, angle: number) => void;
}

// ── Preset gradients ───────────────────────────────────────────────────────────

interface Preset {
  name: string;
  type: GradientType;
  angle: number;
  stops: Array<Omit<GradientStop, 'id'>>;
}

const PRESETS: Preset[] = [
  { name: 'Sunset', type: 'linear', angle: 135, stops: [{ color: '#f093fb', position: 0 }, { color: '#f5576c', position: 50 }, { color: '#fda085', position: 100 }] },
  { name: 'Ocean', type: 'linear', angle: 135, stops: [{ color: '#0093E9', position: 0 }, { color: '#80D0C7', position: 100 }] },
  { name: 'Aurora', type: 'linear', angle: 135, stops: [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 50 }, { color: '#f64f59', position: 100 }] },
  { name: 'Peach', type: 'linear', angle: 135, stops: [{ color: '#ffd89b', position: 0 }, { color: '#19547b', position: 100 }] },
  { name: 'Neon', type: 'linear', angle: 90, stops: [{ color: '#f72585', position: 0 }, { color: '#7209b7', position: 50 }, { color: '#3a0ca3', position: 100 }] },
  { name: 'Forest', type: 'linear', angle: 180, stops: [{ color: '#134e5e', position: 0 }, { color: '#71b280', position: 100 }] },
  { name: 'Cotton', type: 'linear', angle: 45, stops: [{ color: '#f3e7e9', position: 0 }, { color: '#e3eeff', position: 100 }] },
  { name: 'Fire', type: 'linear', angle: 0, stops: [{ color: '#f12711', position: 0 }, { color: '#f5af19', position: 100 }] },
  { name: 'Ice', type: 'linear', angle: 135, stops: [{ color: '#74b9ff', position: 0 }, { color: '#a29bfe', position: 100 }] },
  { name: 'Midnight', type: 'linear', angle: 135, stops: [{ color: '#2c3e50', position: 0 }, { color: '#3498db', position: 100 }] },
  { name: 'Rose', type: 'radial', angle: 0, stops: [{ color: '#fddb92', position: 0 }, { color: '#d1fdff', position: 100 }] },
  { name: 'Candy', type: 'linear', angle: 135, stops: [{ color: '#ff9a9e', position: 0 }, { color: '#fad0c4', position: 50 }, { color: '#ffecd2', position: 100 }] },
  { name: 'Sky', type: 'radial', angle: 0, stops: [{ color: '#96fbc4', position: 0 }, { color: '#f9f586', position: 100 }] },
  { name: 'Royal', type: 'linear', angle: 135, stops: [{ color: '#141E30', position: 0 }, { color: '#243B55', position: 100 }] },
  { name: 'Golden', type: 'conic', angle: 0, stops: [{ color: '#f6d365', position: 0 }, { color: '#fda085', position: 50 }, { color: '#f6d365', position: 100 }] },
  { name: 'Holographic', type: 'linear', angle: 45, stops: [{ color: '#ff0080', position: 0 }, { color: '#ff8c00', position: 20 }, { color: '#ffd700', position: 40 }, { color: '#00ff00', position: 60 }, { color: '#00bfff', position: 80 }, { color: '#8a2be2', position: 100 }] },
  { name: 'Emerald', type: 'linear', angle: 135, stops: [{ color: '#11998e', position: 0 }, { color: '#38ef7d', position: 100 }] },
  { name: 'Plum', type: 'linear', angle: 135, stops: [{ color: '#DAE2F8', position: 0 }, { color: '#D6A4A4', position: 100 }] },
  { name: 'Space', type: 'radial', angle: 0, stops: [{ color: '#000000', position: 0 }, { color: '#434343', position: 100 }] },
  { name: 'Tropical', type: 'linear', angle: 90, stops: [{ color: '#f7971e', position: 0 }, { color: '#ffd200', position: 100 }] },
];

// ── Utils ──────────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function gradientCss(type: GradientType, angle: number, stops: GradientStop[]): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const stopStr = sorted.map(s => `${s.color} ${s.position}%`).join(', ');
  if (type === 'linear') return `linear-gradient(${angle}deg, ${stopStr})`;
  if (type === 'radial') return `radial-gradient(circle, ${stopStr})`;
  return `conic-gradient(from ${angle}deg, ${stopStr})`;
}

// ── Angle Dial ─────────────────────────────────────────────────────────────────

function AngleDial({ angle, onChange }: { angle: number; onChange: (a: number) => void }) {
  const dialRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rad = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      const deg = Math.round((rad * 180 / Math.PI + 90 + 360) % 360);
      onChange(deg);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const rad = (angle - 90) * Math.PI / 180;
  const cx = 20, cy = 20, r = 14;
  const endX = cx + r * Math.cos(rad);
  const endY = cy + r * Math.sin(rad);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        ref={dialRef}
        onMouseDown={handleMouseDown}
        style={{
          width: 40, height: 40,
          borderRadius: '50%',
          background: 'var(--bg, #131320)',
          border: '1px solid var(--border, #2d2d3d)',
          cursor: 'crosshair',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="20" cy="20" r="1.5" fill="rgba(255,255,255,0.3)" />
          <line
            x1="20" y1="20"
            x2={endX} y2={endY}
            stroke="var(--accent, #6366f1)" strokeWidth="2" strokeLinecap="round"
          />
          <circle cx={endX} cy={endY} r="3" fill="var(--accent, #6366f1)" />
        </svg>
      </div>
      <input
        type="number"
        min={0} max={359}
        value={angle}
        onChange={e => onChange(Number(e.target.value) % 360)}
        style={{
          width: 52, background: 'var(--bg, #131320)',
          border: '1px solid var(--border, #2d2d3d)',
          color: 'var(--text, #e2e8f0)', fontSize: 12,
          padding: '3px 6px', borderRadius: 5, textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--muted, #888)' }}>°</span>
    </div>
  );
}

// ── Stop Handle ────────────────────────────────────────────────────────────────

function StopHandle({
  stop, isSelected, onSelect, onDrag, onRemove,
}: {
  stop: GradientStop;
  isSelected: boolean;
  onSelect: () => void;
  onDrag: (pos: number) => void;
  onRemove: () => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const track = handleRef.current?.parentElement;
    if (!track) return;
    const rect = track.getBoundingClientRect();

    const onMove = (ev: MouseEvent) => {
      const rel = (ev.clientX - rect.left) / rect.width;
      const pos = Math.max(0, Math.min(100, rel * 100));
      onDrag(pos);
      // Remove if dragged way off
      if (ev.clientY > rect.bottom + 40 || ev.clientY < rect.top - 40) {
        onRemove();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={handleRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: `${stop.position}%`,
        top: '100%',
        transform: 'translate(-50%, 2px)',
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: stop.color,
        border: `2px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.5)'}`,
        boxShadow: isSelected ? '0 0 0 2px var(--accent, #6366f1)' : '0 1px 4px rgba(0,0,0,0.5)',
        cursor: 'grab',
        zIndex: 2,
        transition: 'box-shadow 0.1s',
      }}
    />
  );
}

// ── Gradient Track ─────────────────────────────────────────────────────────────

function GradientTrack({
  stops, type, angle, selectedId,
  onSelectStop, onDragStop, onRemoveStop, onAddStop,
}: {
  stops: GradientStop[];
  type: GradientType;
  angle: number;
  selectedId: string | null;
  onSelectStop: (id: string) => void;
  onDragStop: (id: string, pos: number) => void;
  onRemoveStop: (id: string) => void;
  onAddStop: (pos: number, color: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const css = gradientCss(type, angle, stops);

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pos = ((e.clientX - rect.left) / rect.width) * 100;
    // Interpolate color at click position
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    let color = sorted[0]?.color ?? '#6366f1';
    for (let i = 0; i < sorted.length - 1; i++) {
      if (pos >= sorted[i].position && pos <= sorted[i + 1].position) {
        color = sorted[i].color; // simplistic — just pick nearest
        break;
      }
    }
    onAddStop(Math.round(pos), color);
  };

  return (
    <div style={{ position: 'relative', paddingBottom: 20 }}>
      {/* Gradient bar */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{
          height: 24,
          borderRadius: 6,
          background: css,
          cursor: 'crosshair',
          border: '1px solid var(--border, #2d2d3d)',
          position: 'relative',
        }}
      >
        {stops.map(stop => (
          <StopHandle
            key={stop.id}
            stop={stop}
            isSelected={stop.id === selectedId}
            onSelect={() => onSelectStop(stop.id)}
            onDrag={(pos) => onDragStop(stop.id, pos)}
            onRemove={() => onRemoveStop(stop.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function GradientEditorPanel({ open, onClose, shape, onApply }: Props) {
  const [type, setType] = useState<GradientType>('linear');
  const [angle, setAngle] = useState(135);
  const [stops, setStops] = useState<GradientStop[]>([
    { id: uid(), color: '#6366f1', position: 0 },
    { id: uid(), color: '#a855f7', position: 100 },
  ]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(stops[0].id);
  const [activeTab, setActiveTab] = useState<'editor' | 'presets'>('editor');

  const selectedStop = stops.find(s => s.id === selectedStopId) ?? null;

  const css = gradientCss(type, angle, stops);

  const updateStopColor = useCallback((id: string, color: string) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, color } : s));
  }, []);

  const updateStopPosition = useCallback((id: string, pos: number) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, position: pos } : s));
  }, []);

  const removeStop = useCallback((id: string) => {
    setStops(prev => {
      if (prev.length <= 2) return prev;
      const next = prev.filter(s => s.id !== id);
      if (selectedStopId === id) setSelectedStopId(next[0]?.id ?? null);
      return next;
    });
  }, [selectedStopId]);

  const addStop = useCallback((pos: number, color: string) => {
    const id = uid();
    setStops(prev => [...prev, { id, color, position: pos }]);
    setSelectedStopId(id);
  }, []);

  const applyPreset = useCallback((preset: Preset) => {
    setType(preset.type);
    setAngle(preset.angle);
    setStops(preset.stops.map(s => ({ ...s, id: uid() })));
    setSelectedStopId(null);
    setActiveTab('editor');
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 360,
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 12,
      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      zIndex: 40,
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>🌈</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
            Gradient Editor
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted, #888)', fontSize: 14 }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
        {(['editor', 'presets'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, height: 32, border: 'none', cursor: 'pointer',
              background: activeTab === tab ? 'rgba(99,102,241,0.1)' : 'transparent',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--accent, #6366f1)' : 'transparent'}`,
              color: activeTab === tab ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
              fontSize: 11, fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'editor' ? (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Large preview */}
          <div style={{
            height: 60,
            borderRadius: 8,
            background: css,
            border: '1px solid var(--border, #2d2d3d)',
          }} />

          {/* Type selector */}
          <div>
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.06em' }}>TYPE</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['linear', 'radial', 'conic'] as GradientType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    flex: 1, height: 28,
                    background: type === t ? 'rgba(99,102,241,0.2)' : 'var(--bg, #131320)',
                    border: `1px solid ${type === t ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                    borderRadius: 5, cursor: 'pointer',
                    color: type === t ? '#818cf8' : 'var(--muted, #888)',
                    fontSize: 11, fontWeight: 500,
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Angle (only for linear/conic) */}
          {type !== 'radial' && (
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.06em' }}>ANGLE</div>
              <AngleDial angle={angle} onChange={setAngle} />
            </div>
          )}

          {/* Gradient track */}
          <div>
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.06em' }}>
              STOPS — click track to add, drag handle off to remove
            </div>
            <GradientTrack
              stops={stops}
              type={type}
              angle={angle}
              selectedId={selectedStopId}
              onSelectStop={setSelectedStopId}
              onDragStop={updateStopPosition}
              onRemoveStop={removeStop}
              onAddStop={addStop}
            />
          </div>

          {/* Selected stop editor */}
          {selectedStop && (
            <div style={{
              background: 'var(--bg, #131320)',
              border: '1px solid var(--border, #2d2d3d)',
              borderRadius: 8, padding: 10,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <input
                type="color"
                value={selectedStop.color.startsWith('#') ? selectedStop.color.slice(0, 7) : '#6366f1'}
                onChange={e => updateStopColor(selectedStop.id, e.target.value)}
                style={{
                  width: 36, height: 36, border: 'none', padding: 0,
                  borderRadius: 6, cursor: 'pointer', background: 'none',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 4 }}>COLOR</div>
                <input
                  type="text"
                  value={selectedStop.color}
                  onChange={e => updateStopColor(selectedStop.id, e.target.value)}
                  style={{
                    width: '100%', background: 'transparent',
                    border: '1px solid var(--border, #2d2d3d)',
                    color: 'var(--text)', fontSize: 11,
                    padding: '3px 6px', borderRadius: 5, fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 4 }}>POS</div>
                <input
                  type="number" min={0} max={100}
                  value={Math.round(selectedStop.position)}
                  onChange={e => updateStopPosition(selectedStop.id, Number(e.target.value))}
                  style={{
                    width: 48, background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)', fontSize: 11,
                    padding: '3px 6px', borderRadius: 5, textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              </div>
            </div>
          )}

          {/* CSS output */}
          <div>
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.06em' }}>CSS</div>
            <div
              onClick={() => navigator.clipboard.writeText(css).catch(() => {})}
              title="Click to copy"
              style={{
                background: 'var(--bg, #131320)',
                border: '1px solid var(--border, #2d2d3d)',
                borderRadius: 6, padding: '6px 8px',
                fontSize: 10, color: 'var(--muted, #888)',
                fontFamily: 'monospace',
                cursor: 'pointer',
                wordBreak: 'break-all',
                lineHeight: 1.4,
              }}
            >
              {css}
            </div>
          </div>

          {/* Apply button */}
          <button
            onClick={() => onApply(css, stops, type, angle)}
            disabled={!shape}
            style={{
              height: 36,
              background: shape ? 'var(--accent, #6366f1)' : 'var(--bg)',
              border: 'none', borderRadius: 8,
              color: shape ? 'white' : 'var(--muted)',
              fontSize: 13, fontWeight: 600, cursor: shape ? 'pointer' : 'not-allowed',
              width: '100%',
            }}
          >
            {shape ? `Apply to "${shape.name ?? 'shape'}"` : 'Select a shape first'}
          </button>
        </div>
      ) : (
        /* Presets grid */
        <div style={{ padding: 10, maxHeight: 400, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {PRESETS.map(preset => {
              const presetCss = gradientCss(preset.type, preset.angle, preset.stops.map((s, i) => ({ ...s, id: String(i) })));
              return (
                <div
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  title={preset.name}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--border, #2d2d3d)',
                    transition: 'transform 0.1s, box-shadow 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                >
                  <div style={{ height: 44, background: presetCss }} />
                  <div style={{ padding: '4px 4px 5px', fontSize: 9, fontWeight: 500, color: 'var(--muted, #888)', textAlign: 'center', background: 'var(--bg, #131320)' }}>
                    {preset.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
