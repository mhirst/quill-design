/**
 * KeyframeTimeline — Visual CSS animation keyframe editor.
 *
 * Features:
 *  - Timeline ruler (0–100%) with draggable keyframe diamonds
 *  - Multiple tracks: position (x, y), size (w, h), opacity, rotation, fill
 *  - Add keyframes by clicking the ruler or using "+" button
 *  - Easing selector per keyframe pair (ease, linear, cubic-bezier presets)
 *  - Generates CSS @keyframes code
 *  - Live preview: applies animation to selected shape on canvas (via inline style)
 *  - Duration, delay, iteration count controls
 *
 * Keyboard: ⌘⇧⌥T to toggle
 */

import React, { useCallback, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TrackProp = 'opacity' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'borderRadius';

export interface Keyframe {
  id: string;
  percent: number;  // 0–100
  value: number;
  easing: string;   // for the segment AFTER this keyframe
}

export interface Track {
  id: string;
  prop: TrackProp;
  label: string;
  unit: string;
  keyframes: Keyframe[];
  defaultValue: number;
  min: number;
  max: number;
}

export interface AnimationConfig {
  name: string;
  duration: number;  // ms
  delay: number;     // ms
  iterations: number | 'infinite';
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode: 'none' | 'forwards' | 'backwards' | 'both';
  tracks: Track[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  shapeName?: string;
  onExportCSS: (css: string) => void;
  onPreview: (animName: string, duration: number, delay: number, iterations: number | string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 8); }

const EASING_PRESETS = [
  { label: 'Ease', value: 'ease' },
  { label: 'Linear', value: 'linear' },
  { label: 'Ease In', value: 'ease-in' },
  { label: 'Ease Out', value: 'ease-out' },
  { label: 'Ease In Out', value: 'ease-in-out' },
  { label: 'Spring', value: 'cubic-bezier(0.34,1.56,0.64,1)' },
  { label: 'Bounce', value: 'cubic-bezier(0.68,-0.55,0.265,1.55)' },
  { label: 'Snap', value: 'cubic-bezier(0,0,0.2,1)' },
];

function defaultTrack(prop: TrackProp): Track {
  const map: Record<TrackProp, Omit<Track, 'id'>> = {
    opacity: { prop: 'opacity', label: 'Opacity', unit: '', keyframes: [
      { id: uid(), percent: 0, value: 0, easing: 'ease-in-out' },
      { id: uid(), percent: 100, value: 1, easing: 'ease-in-out' },
    ], defaultValue: 1, min: 0, max: 1 },
    x: { prop: 'x', label: 'X Offset', unit: 'px', keyframes: [
      { id: uid(), percent: 0, value: -40, easing: 'ease-out' },
      { id: uid(), percent: 100, value: 0, easing: 'ease-out' },
    ], defaultValue: 0, min: -500, max: 500 },
    y: { prop: 'y', label: 'Y Offset', unit: 'px', keyframes: [
      { id: uid(), percent: 0, value: 40, easing: 'ease-out' },
      { id: uid(), percent: 100, value: 0, easing: 'ease-out' },
    ], defaultValue: 0, min: -500, max: 500 },
    width: { prop: 'width', label: 'Scale X', unit: '%', keyframes: [
      { id: uid(), percent: 0, value: 0, easing: 'ease-out' },
      { id: uid(), percent: 100, value: 100, easing: 'ease-out' },
    ], defaultValue: 100, min: 0, max: 200 },
    height: { prop: 'height', label: 'Scale Y', unit: '%', keyframes: [
      { id: uid(), percent: 0, value: 0, easing: 'ease-out' },
      { id: uid(), percent: 100, value: 100, easing: 'ease-out' },
    ], defaultValue: 100, min: 0, max: 200 },
    rotation: { prop: 'rotation', label: 'Rotation', unit: '°', keyframes: [
      { id: uid(), percent: 0, value: 0, easing: 'linear' },
      { id: uid(), percent: 100, value: 360, easing: 'linear' },
    ], defaultValue: 0, min: -360, max: 360 },
    borderRadius: { prop: 'borderRadius', label: 'Radius', unit: 'px', keyframes: [
      { id: uid(), percent: 0, value: 0, easing: 'ease-in-out' },
      { id: uid(), percent: 50, value: 9999, easing: 'ease-in-out' },
      { id: uid(), percent: 100, value: 0, easing: 'ease-in-out' },
    ], defaultValue: 0, min: 0, max: 9999 },
  };
  return { id: uid(), ...map[prop] };
}

function generateCSS(config: AnimationConfig): string {
  const lines: string[] = [];
  const name = config.name.replace(/\s+/g, '-').toLowerCase();

  lines.push(`@keyframes ${name} {`);

  // Collect all percentages
  const allPercents = new Set<number>();
  for (const track of config.tracks) {
    for (const kf of track.keyframes) allPercents.add(kf.percent);
  }

  const sortedPercents = [...allPercents].sort((a, b) => a - b);

  for (const pct of sortedPercents) {
    const props: string[] = [];
    const easings: string[] = [];

    for (const track of config.tracks) {
      const kf = track.keyframes.find(k => k.percent === pct);
      if (!kf) continue;
      if (track.prop === 'opacity') {
        props.push(`opacity: ${kf.value}`);
        easings.push(kf.easing);
      } else if (track.prop === 'x' || track.prop === 'y') {
        // Collected below — combine into single translate
      } else if (track.prop === 'width' || track.prop === 'height') {
        // Scale — collect below
      } else if (track.prop === 'rotation') {
        // Collected below
      } else if (track.prop === 'borderRadius') {
        props.push(`border-radius: ${Math.min(kf.value, 9999)}px`);
        if (kf.easing) easings.push(kf.easing);
      }
    }

    // Build transform
    const xTrack = config.tracks.find(t => t.prop === 'x');
    const yTrack = config.tracks.find(t => t.prop === 'y');
    const rotTrack = config.tracks.find(t => t.prop === 'rotation');
    const wTrack = config.tracks.find(t => t.prop === 'width');
    const hTrack = config.tracks.find(t => t.prop === 'height');

    const transforms: string[] = [];
    const xKf = xTrack?.keyframes.find(k => k.percent === pct);
    const yKf = yTrack?.keyframes.find(k => k.percent === pct);
    const rotKf = rotTrack?.keyframes.find(k => k.percent === pct);
    const wKf = wTrack?.keyframes.find(k => k.percent === pct);
    const hKf = hTrack?.keyframes.find(k => k.percent === pct);

    if (xKf || yKf) transforms.push(`translate(${xKf?.value ?? 0}px, ${yKf?.value ?? 0}px)`);
    if (rotKf) transforms.push(`rotate(${rotKf.value}deg)`);
    if (wKf || hKf) transforms.push(`scale(${((wKf?.value ?? 100) / 100).toFixed(3)}, ${((hKf?.value ?? 100) / 100).toFixed(3)})`);

    if (transforms.length > 0) props.push(`transform: ${transforms.join(' ')}`);
    const easing = easings[0] ?? 'ease';
    if (easing && easing !== 'ease') props.push(`animation-timing-function: ${easing}`);

    if (props.length > 0) {
      lines.push(`  ${pct}% {`);
      for (const p of props) lines.push(`    ${p};`);
      lines.push(`  }`);
    }
  }

  lines.push(`}`);
  lines.push('');

  const iterVal = config.iterations === 'infinite' ? 'infinite' : String(config.iterations);
  lines.push(`.animated-${name} {`);
  lines.push(`  animation: ${name} ${config.duration}ms ${config.delay ? `${config.delay}ms ` : ''}${iterVal} ${config.direction} ${config.fillMode};`);
  lines.push(`}`);

  return lines.join('\n');
}

// ── Keyframe Diamond ───────────────────────────────────────────────────────────

function KeyframeDiamond({
  kf, isSelected, trackId, trackWidth,
  onSelect, onDrag,
}: {
  kf: Keyframe;
  isSelected: boolean;
  trackId: string;
  trackWidth: number;
  onSelect: () => void;
  onDrag: (pct: number) => void;
}) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const startX = e.clientX;
    const startPct = kf.percent;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newPct = Math.max(0, Math.min(100, startPct + (dx / trackWidth) * 100));
      onDrag(Math.round(newPct));
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
      onMouseDown={handleMouseDown}
      title={`${kf.percent}%`}
      style={{
        position: 'absolute',
        left: `${kf.percent}%`,
        top: '50%',
        transform: 'translate(-50%, -50%) rotate(45deg)',
        width: 10, height: 10,
        background: isSelected ? 'var(--accent, #6366f1)' : '#818cf8',
        border: `2px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.4)'}`,
        cursor: 'grab',
        zIndex: 2,
        boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.5)' : 'none',
      }}
    />
  );
}

// ── Track Row ──────────────────────────────────────────────────────────────────

function TrackRow({
  track, selectedKfId, onSelectKf, onMoveKf, onRemoveTrack, onAddKf,
}: {
  track: Track;
  selectedKfId: string | null;
  onSelectKf: (id: string) => void;
  onMoveKf: (trackId: string, kfId: string, pct: number) => void;
  onRemoveTrack: (id: string) => void;
  onAddKf: (trackId: string, pct: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const obsRef = useRef<ResizeObserver | null>(null);

  React.useEffect(() => {
    if (!trackRef.current) return;
    obsRef.current = new ResizeObserver(() => {
      if (trackRef.current) setW(trackRef.current.clientWidth);
    });
    obsRef.current.observe(trackRef.current);
    setW(trackRef.current.clientWidth);
    return () => obsRef.current?.disconnect();
  }, []);

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    onAddKf(track.id, pct);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 32, gap: 0 }}>
      {/* Label */}
      <div style={{
        width: 80, flexShrink: 0,
        fontSize: 10, fontWeight: 500, color: 'var(--muted, #888)',
        paddingLeft: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingRight: 6,
      }}>
        <span>{track.label}</span>
        <button
          onClick={() => onRemoveTrack(track.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 10, padding: 0, opacity: 0.5 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}
        >
          ✕
        </button>
      </div>

      {/* Timeline lane */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{
          flex: 1, height: 24, position: 'relative',
          background: 'var(--bg, #131320)',
          borderTop: '1px solid var(--border, #2d2d3d)',
          borderBottom: '1px solid var(--border, #2d2d3d)',
          cursor: 'crosshair',
        }}
      >
        {/* Dashed center line */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: 1, background: 'rgba(255,255,255,0.05)',
        }} />

        {/* Keyframe diamonds */}
        {track.keyframes.map(kf => (
          <KeyframeDiamond
            key={kf.id}
            kf={kf}
            isSelected={kf.id === selectedKfId}
            trackId={track.id}
            trackWidth={w}
            onSelect={() => onSelectKf(kf.id)}
            onDrag={(pct) => onMoveKf(track.id, kf.id, pct)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function KeyframeTimeline({ open, onClose, shapeName, onExportCSS, onPreview }: Props) {
  const [config, setConfig] = useState<AnimationConfig>({
    name: 'my-animation',
    duration: 800,
    delay: 0,
    iterations: 1,
    direction: 'normal',
    fillMode: 'both',
    tracks: [defaultTrack('opacity'), defaultTrack('y')],
  });

  const [selectedKfId, setSelectedKfId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'code'>('timeline');

  const selectedTrack = config.tracks.find(t => t.id === selectedTrackId);
  const selectedKf = selectedTrack?.keyframes.find(k => k.id === selectedKfId);

  const updateConfig = useCallback((patch: Partial<AnimationConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const addTrack = useCallback((prop: TrackProp) => {
    if (config.tracks.find(t => t.prop === prop)) return;
    setConfig(prev => ({ ...prev, tracks: [...prev.tracks, defaultTrack(prop)] }));
  }, [config.tracks]);

  const removeTrack = useCallback((id: string) => {
    setConfig(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.id !== id) }));
  }, []);

  const addKeyframe = useCallback((trackId: string, pct: number) => {
    setConfig(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        if (t.keyframes.some(k => k.percent === pct)) return t;
        const sorted = [...t.keyframes].sort((a, b) => a.percent - b.percent);
        // Interpolate value
        let val = t.defaultValue;
        for (let i = 0; i < sorted.length - 1; i++) {
          if (pct > sorted[i].percent && pct < sorted[i + 1].percent) {
            const ratio = (pct - sorted[i].percent) / (sorted[i + 1].percent - sorted[i].percent);
            val = sorted[i].value + ratio * (sorted[i + 1].value - sorted[i].value);
            break;
          }
        }
        const newKf: Keyframe = { id: uid(), percent: pct, value: Math.round(val * 100) / 100, easing: 'ease-in-out' };
        return { ...t, keyframes: [...t.keyframes, newKf] };
      }),
    }));
  }, []);

  const moveKeyframe = useCallback((trackId: string, kfId: string, pct: number) => {
    setConfig(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        return { ...t, keyframes: t.keyframes.map(k => k.id === kfId ? { ...k, percent: pct } : k) };
      }),
    }));
  }, []);

  const updateKeyframe = useCallback((trackId: string, kfId: string, patch: Partial<Keyframe>) => {
    setConfig(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        return { ...t, keyframes: t.keyframes.map(k => k.id === kfId ? { ...k, ...patch } : k) };
      }),
    }));
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    const name = config.name.replace(/\s+/g, '-').toLowerCase();
    onPreview(name, config.duration, config.delay, config.iterations);
    setTimeout(() => setPlaying(false), config.duration * (config.iterations === 'infinite' ? 3 : (config.iterations as number)) + 200);
  }, [config, onPreview]);

  const css = generateCSS(config);

  if (!open) return null;

  const AVAILABLE_TRACKS: TrackProp[] = ['opacity', 'x', 'y', 'width', 'height', 'rotation', 'borderRadius'];
  const usedProps = new Set(config.tracks.map(t => t.prop));

  return (
    <div style={{
      position: 'fixed',
      bottom: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 560,
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 12,
      boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
      zIndex: 40,
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
      }}>
        <span style={{ fontSize: 14 }}>⏱</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>
          Keyframe Timeline
          {shapeName && <span style={{ color: 'var(--muted, #888)', fontWeight: 400 }}> — {shapeName}</span>}
        </span>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['timeline', 'code'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              height: 22, padding: '0 8px',
              background: activeTab === tab ? 'rgba(99,102,241,0.2)' : 'transparent',
              border: `1px solid ${activeTab === tab ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
              borderRadius: 4, cursor: 'pointer', fontSize: 10,
              color: activeTab === tab ? '#818cf8' : 'var(--muted, #888)',
              fontWeight: 600, textTransform: 'capitalize',
            }}>{tab}</button>
          ))}
        </div>

        {/* Play */}
        <button
          onClick={handlePlay}
          disabled={playing}
          style={{
            height: 26, padding: '0 10px',
            background: playing ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)',
            border: `1px solid ${playing ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.4)'}`,
            borderRadius: 5, cursor: playing ? 'not-allowed' : 'pointer',
            color: playing ? '#22c55e' : '#818cf8',
            fontSize: 11, fontWeight: 600,
          }}
        >
          {playing ? '▶ Playing…' : '▶ Preview'}
        </button>

        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted, #888)', fontSize: 14, padding: 2 }}>✕</button>
      </div>

      {activeTab === 'timeline' ? (
        <div>
          {/* Config bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            borderBottom: '1px solid var(--border, #2d2d3d)',
            flexWrap: 'wrap',
          }}>
            {/* Duration */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted, #888)' }}>
              Duration
              <input
                type="number" min={100} max={10000} step={100}
                value={config.duration}
                onChange={e => updateConfig({ duration: Number(e.target.value) })}
                style={{ width: 54, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, padding: '2px 4px', borderRadius: 4 }}
              />
              ms
            </label>

            {/* Delay */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted, #888)' }}>
              Delay
              <input
                type="number" min={0} max={5000} step={100}
                value={config.delay}
                onChange={e => updateConfig({ delay: Number(e.target.value) })}
                style={{ width: 48, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, padding: '2px 4px', borderRadius: 4 }}
              />
              ms
            </label>

            {/* Iterations */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted, #888)' }}>
              Loop
              <select
                value={config.iterations === 'infinite' ? 'infinite' : String(config.iterations)}
                onChange={e => updateConfig({ iterations: e.target.value === 'infinite' ? 'infinite' : Number(e.target.value) })}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, borderRadius: 4 }}
              >
                <option value="1">1×</option>
                <option value="2">2×</option>
                <option value="3">3×</option>
                <option value="infinite">∞</option>
              </select>
            </label>

            {/* Direction */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted, #888)' }}>
              Dir
              <select
                value={config.direction}
                onChange={e => updateConfig({ direction: e.target.value as AnimationConfig['direction'] })}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10, borderRadius: 4 }}
              >
                <option value="normal">Normal</option>
                <option value="reverse">Reverse</option>
                <option value="alternate">Alternate</option>
                <option value="alternate-reverse">Alt-Rev</option>
              </select>
            </label>
          </div>

          {/* Ruler */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border, #2d2d3d)',
          }}>
            <div style={{ width: 80, flexShrink: 0 }} />
            <div style={{
              flex: 1, height: 20, position: 'relative',
              background: 'var(--bg, #131320)',
            }}>
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(pct => (
                <div key={pct} style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: 0, bottom: 0,
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                  paddingLeft: 2,
                  fontSize: 8, color: 'rgba(255,255,255,0.25)',
                  lineHeight: '20px',
                  transform: pct > 0 ? 'translateX(-50%)' : 'none',
                }}>
                  {pct > 0 && pct < 100 ? `${pct}%` : pct === 0 ? '0' : '100%'}
                </div>
              ))}
            </div>
          </div>

          {/* Tracks */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {config.tracks.map(track => (
              <TrackRow
                key={track.id}
                track={track}
                selectedKfId={selectedTrackId === track.id ? selectedKfId : null}
                onSelectKf={(id) => { setSelectedKfId(id); setSelectedTrackId(track.id); }}
                onMoveKf={moveKeyframe}
                onRemoveTrack={removeTrack}
                onAddKf={addKeyframe}
              />
            ))}

            {/* Add track button */}
            <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {AVAILABLE_TRACKS.filter(p => !usedProps.has(p)).map(prop => (
                <button
                  key={prop}
                  onClick={() => addTrack(prop)}
                  style={{
                    height: 22, padding: '0 8px',
                    background: 'transparent',
                    border: '1px dashed var(--border, #2d2d3d)',
                    borderRadius: 4, cursor: 'pointer',
                    color: 'var(--muted, #888)', fontSize: 10,
                  }}
                >
                  + {defaultTrack(prop).label}
                </button>
              ))}
            </div>
          </div>

          {/* Selected keyframe editor */}
          {selectedKf && selectedTrack && (
            <div style={{
              borderTop: '1px solid var(--border, #2d2d3d)',
              padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(99,102,241,0.04)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--muted, #888)', flexShrink: 0 }}>
                {selectedTrack.label} @ {selectedKf.percent}%
              </div>
              <input
                type="number"
                value={selectedKf.value}
                min={selectedTrack.min}
                max={selectedTrack.max}
                onChange={e => updateKeyframe(selectedTrack.id, selectedKf.id, { value: Number(e.target.value) })}
                style={{
                  width: 64, background: 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 11, padding: '3px 6px', borderRadius: 4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{selectedTrack.unit}</span>
              <select
                value={selectedKf.easing}
                onChange={e => updateKeyframe(selectedTrack.id, selectedKf.id, { easing: e.target.value })}
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 10, borderRadius: 4, flex: 1,
                }}
              >
                {EASING_PRESETS.map(ep => (
                  <option key={ep.value} value={ep.value}>{ep.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        /* Code tab */
        <div style={{ padding: 12 }}>
          <div style={{
            background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 8, padding: '10px 12px',
            maxHeight: 260, overflowY: 'auto',
            fontFamily: 'monospace', fontSize: 11,
            color: 'var(--text, #e2e8f0)', lineHeight: 1.6,
            whiteSpace: 'pre',
          }}>
            {css}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => navigator.clipboard.writeText(css).catch(() => {})}
              style={{
                flex: 1, height: 32,
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 6, cursor: 'pointer',
                color: '#818cf8', fontSize: 11, fontWeight: 600,
              }}
            >
              Copy CSS
            </button>
            <button
              onClick={() => onExportCSS(css)}
              style={{
                flex: 1, height: 32,
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 6, cursor: 'pointer',
                color: '#22c55e', fontSize: 11, fontWeight: 600,
              }}
            >
              Export
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
