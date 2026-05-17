/**
 * ShapeTimelinePanel — Multi-shape animation sequencer
 *
 * Features:
 *  - Add shapes to a timeline
 *  - Per-shape keyframes with time (ms), property (opacity/x/y/scale/rotate), value
 *  - Visual timeline scrubber (drag to preview frame)
 *  - Duration control + playback speed
 *  - Easing per keyframe: linear, ease-in, ease-out, ease-in-out, spring
 *  - Delay per shape (stagger animations)
 *  - Export as CSS @keyframes, GSAP timeline code, Framer Motion variants
 *  - Clear, copy, remove tracks
 *  - ⌘⌥⇧T shortcut
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnimProperty = 'opacity' | 'x' | 'y' | 'scale' | 'scaleX' | 'scaleY' | 'rotate' | 'width' | 'height';
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';

export interface Keyframe {
  id: string;
  time: number;       // ms from start of this track
  property: AnimProperty;
  value: number;
  easing: EasingType;
}

export interface AnimTrack {
  id: string;
  shapeId: string;
  shapeName: string;
  delay: number;      // ms delay before animation starts
  keyframes: Keyframe[];
  color: string;
}

export type ExportFormat = 'css' | 'gsap' | 'framer';

// ── Utilities (exported for tests) ────────────────────────────────────────────

/** Generate a unique id */
export function trackId(): string {
  return 'trk-' + Math.random().toString(36).slice(2, 8);
}

/** Create a new animation track for a shape */
export function createTrack(shapeId: string, shapeName: string, color = '#b5533c'): AnimTrack {
  return { id: trackId(), shapeId, shapeName, delay: 0, keyframes: [], color };
}

/** Add a keyframe to a track */
export function addKeyframe(track: AnimTrack, kf: Omit<Keyframe, 'id'>): AnimTrack {
  const newKf: Keyframe = { ...kf, id: 'kf-' + Math.random().toString(36).slice(2, 8) };
  const keyframes = [...track.keyframes, newKf].sort((a, b) => a.time - b.time);
  return { ...track, keyframes };
}

/** Remove a keyframe by id */
export function removeKeyframe(track: AnimTrack, kfId: string): AnimTrack {
  return { ...track, keyframes: track.keyframes.filter(k => k.id !== kfId) };
}

/** Get all unique properties animated in a track */
export function trackProperties(track: AnimTrack): AnimProperty[] {
  return [...new Set(track.keyframes.map(k => k.property))];
}

/** Compute interpolated value for a property at a given time */
export function interpolateValue(track: AnimTrack, property: AnimProperty, time: number): number | null {
  const kfs = track.keyframes.filter(k => k.property === property).sort((a, b) => a.time - b.time);
  if (kfs.length === 0) return null;
  if (time <= kfs[0].time) return kfs[0].value;
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]; const b = kfs[i + 1];
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * applyEasing(t, b.easing);
    }
  }
  return null;
}

/** Apply easing function to normalized t (0..1) */
export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'ease-in': return t * t * t;
    case 'ease-out': return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'spring': {
      // Simple spring: overshoot
      const c4 = (2 * Math.PI) / 3;
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    default: return t;
  }
}

/** Get total duration of a track (last keyframe + delay) */
export function trackDuration(track: AnimTrack): number {
  if (track.keyframes.length === 0) return 0;
  const lastTime = Math.max(...track.keyframes.map(k => k.time));
  return track.delay + lastTime;
}

/** Get total duration of all tracks */
export function totalDuration(tracks: AnimTrack[]): number {
  return Math.max(0, ...tracks.map(trackDuration));
}

/** Export tracks as CSS @keyframes */
export function exportCSS(tracks: AnimTrack[], totalMs: number): string {
  const blocks: string[] = [];
  for (const track of tracks) {
    const props = trackProperties(track);
    for (const prop of props) {
      const kfs = track.keyframes.filter(k => k.property === prop).sort((a, b) => a.time - b.time);
      if (kfs.length === 0) continue;
      const animName = `${track.shapeName.replace(/\s+/g, '-').toLowerCase()}-${prop}`;
      const stops = kfs.map(kf => {
        const pct = Math.round((kf.time / (totalMs || 1)) * 100);
        const cssVal = propToCSS(prop, kf.value);
        return `  ${pct}% { ${cssVal} }`;
      }).join('\n');
      blocks.push(`@keyframes ${animName} {\n${stops}\n}`);
      blocks.push(`.${track.shapeName.replace(/\s+/g, '-').toLowerCase()} {\n  animation: ${animName} ${totalMs}ms ${kfs[0].easing} ${track.delay}ms forwards;\n}`);
    }
  }
  return blocks.join('\n\n') || '/* No tracks added */';
}

/** Export tracks as GSAP timeline */
export function exportGSAP(tracks: AnimTrack[]): string {
  const lines: string[] = ['const tl = gsap.timeline();', ''];
  for (const track of tracks) {
    const byTime: Record<number, Array<{ property: AnimProperty; value: number; easing: EasingType }>> = {};
    for (const kf of track.keyframes) {
      if (!byTime[kf.time]) byTime[kf.time] = [];
      byTime[kf.time].push({ property: kf.property, value: kf.value, easing: kf.easing });
    }
    const times = Object.keys(byTime).map(Number).sort((a, b) => a - b);
    for (const time of times) {
      const props = byTime[time];
      const gsapProps: Record<string, unknown> = { ease: props[0].easing };
      for (const p of props) { gsapProps[gsapPropertyName(p.property)] = p.value; }
      const position = (track.delay + time) / 1000;
      lines.push(`tl.to('#${track.shapeId}', ${JSON.stringify(gsapProps)}, ${position.toFixed(3)});`);
    }
  }
  return lines.join('\n');
}

/** Export tracks as Framer Motion variants */
export function exportFramerMotion(tracks: AnimTrack[]): string {
  const lines: string[] = [];
  for (const track of tracks) {
    const name = track.shapeName.replace(/\s+/g, '');
    const initial: Record<string, number> = {};
    const animate: Record<string, number> = {};
    for (const kf of track.keyframes.filter(k => k.time === 0)) {
      initial[framerProperty(kf.property)] = kf.value;
    }
    const lastKfs: Record<AnimProperty, Keyframe> = {} as Record<AnimProperty, Keyframe>;
    for (const kf of track.keyframes) { lastKfs[kf.property] = kf; }
    for (const [, kf] of Object.entries(lastKfs)) {
      animate[framerProperty(kf.property)] = kf.value;
    }
    lines.push(`// ${track.shapeName}`);
    lines.push(`const ${name}Variants = {`);
    lines.push(`  initial: ${JSON.stringify(initial)},`);
    lines.push(`  animate: ${JSON.stringify(animate)},`);
    lines.push(`  transition: { duration: ${trackDuration(track) / 1000}, delay: ${track.delay / 1000}, ease: "${track.keyframes[0]?.easing ?? 'linear'}" },`);
    lines.push(`};\n`);
  }
  return lines.join('\n') || '// No tracks added';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function propToCSS(prop: AnimProperty, value: number): string {
  switch (prop) {
    case 'opacity': return `opacity: ${value}`;
    case 'x': return `transform: translateX(${value}px)`;
    case 'y': return `transform: translateY(${value}px)`;
    case 'scale': return `transform: scale(${value})`;
    case 'scaleX': return `transform: scaleX(${value})`;
    case 'scaleY': return `transform: scaleY(${value})`;
    case 'rotate': return `transform: rotate(${value}deg)`;
    case 'width': return `width: ${value}px`;
    case 'height': return `height: ${value}px`;
    default: return '';
  }
}

function gsapPropertyName(prop: AnimProperty): string {
  switch (prop) {
    case 'x': return 'x';
    case 'y': return 'y';
    case 'scale': return 'scale';
    case 'scaleX': return 'scaleX';
    case 'scaleY': return 'scaleY';
    case 'rotate': return 'rotation';
    case 'opacity': return 'opacity';
    case 'width': return 'width';
    case 'height': return 'height';
    default: return prop;
  }
}

function framerProperty(prop: AnimProperty): string {
  switch (prop) {
    case 'rotate': return 'rotate';
    case 'scale': return 'scale';
    default: return prop;
  }
}

// ── Default properties per animatable prop ────────────────────────────────────

const PROP_DEFAULTS: Record<AnimProperty, { min: number; max: number; default: number; unit: string }> = {
  opacity: { min: 0, max: 1, default: 1, unit: '' },
  x: { min: -1000, max: 1000, default: 0, unit: 'px' },
  y: { min: -1000, max: 1000, default: 0, unit: 'px' },
  scale: { min: 0, max: 5, default: 1, unit: 'x' },
  scaleX: { min: 0, max: 5, default: 1, unit: 'x' },
  scaleY: { min: 0, max: 5, default: 1, unit: 'x' },
  rotate: { min: -360, max: 360, default: 0, unit: '°' },
  width: { min: 0, max: 2000, default: 100, unit: 'px' },
  height: { min: 0, max: 2000, default: 100, unit: 'px' },
};

const TRACK_COLORS = ['#b5533c', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed', bottom: 0, left: 0, right: 0,
  height: 320,
  background: '#1a0a0a', borderTop: '1px solid #3a1a1a',
  display: 'flex', flexDirection: 'column',
  zIndex: 600, fontFamily: 'system-ui, sans-serif', color: '#e8d5d5',
};

const BTN_SM: React.CSSProperties = {
  padding: '3px 8px', borderRadius: 5, border: '1px solid #3a1a1a',
  background: '#2a1010', color: '#e8d5d5', fontSize: 11, cursor: 'pointer',
};

const BTN_ACCENT: React.CSSProperties = {
  ...BTN_SM, background: '#b5533c', border: '1px solid #c4644d', color: '#fff',
};

const ANIM_PROPERTIES: AnimProperty[] = ['opacity', 'x', 'y', 'scale', 'rotate', 'scaleX', 'scaleY', 'width', 'height'];
const EASINGS: EasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring'];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
}

export function ShapeTimelinePanel({ open, onClose, shapes }: Props) {
  const [tracks, setTracks] = useState<AnimTrack[]>([]);
  const [duration, setDuration] = useState(1000); // ms
  const [currentTime, setCurrentTime] = useState(0); // ms
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [showExport, setShowExport] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  // New keyframe form state
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [kfTime, setKfTime] = useState(500);
  const [kfProp, setKfProp] = useState<AnimProperty>('opacity');
  const [kfValue, setKfValue] = useState(1);
  const [kfEasing, setKfEasing] = useState<EasingType>('ease-out');

  if (!open) return null;

  const addTrack = (shape: Shape) => {
    const colorIndex = tracks.length % TRACK_COLORS.length;
    const track = createTrack(shape.id, shape.name || shape.type, TRACK_COLORS[colorIndex]);
    setTracks(prev => [...prev, track]);
    setSelectedTrackId(track.id);
  };

  const removeTrack = (trackId: string) => {
    setTracks(prev => prev.filter(t => t.id !== trackId));
    if (selectedTrackId === trackId) setSelectedTrackId(null);
  };

  const handleAddKeyframe = () => {
    if (!selectedTrackId) return;
    setTracks(prev => prev.map(t => t.id === selectedTrackId
      ? addKeyframe(t, { time: kfTime, property: kfProp, value: kfValue, easing: kfEasing })
      : t
    ));
  };

  const handleRemoveKeyframe = (trackId: string, kfId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? removeKeyframe(t, kfId) : t));
  };

  const handleSetDelay = (trackId: string, delay: number) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, delay } : t));
  };

  const calcDuration = Math.max(duration, totalDuration(tracks));

  const exportCode = useMemo(() => {
    if (exportFormat === 'css') return exportCSS(tracks, calcDuration);
    if (exportFormat === 'gsap') return exportGSAP(tracks);
    return exportFramerMotion(tracks);
  }, [tracks, exportFormat, calcDuration]);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportCode).then(() => {
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 1500);
    });
  };

  const selectedTrack = tracks.find(t => t.id === selectedTrackId) ?? null;

  // Simple play simulation
  const handlePlay = () => {
    if (isPlaying) { setIsPlaying(false); return; }
    setIsPlaying(true);
    setCurrentTime(0);
    const startMs = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startMs;
      if (elapsed >= calcDuration) {
        setCurrentTime(calcDuration);
        setIsPlaying(false);
        return;
      }
      setCurrentTime(elapsed);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const unusedShapes = shapes.filter(s => !tracks.find(t => t.shapeId === s.id));

  return (
    <div style={PANEL}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
        borderBottom: '1px solid #3a1a1a', flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginRight: 4 }}>Timeline</div>

        {/* Playback */}
        <button onClick={handlePlay} style={{ ...BTN_ACCENT, padding: '3px 10px' }}>
          {isPlaying ? '⏸' : '▶'} {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => setCurrentTime(0)} style={BTN_SM}>↩ Reset</button>

        {/* Scrubber */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="range"
            min={0}
            max={calcDuration}
            step={10}
            value={currentTime}
            onChange={e => { setCurrentTime(Number(e.target.value)); setIsPlaying(false); }}
            style={{ flex: 1, accentColor: '#b5533c' }}
          />
          <span style={{ fontSize: 11, color: '#9a7a7a', minWidth: 70, textAlign: 'right' as const }}>
            {currentTime}ms / {calcDuration}ms
          </span>
        </div>

        {/* Duration */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9a7a7a' }}>
          dur
          <input type="number" value={duration} min={100} max={10000} step={100}
            onChange={e => setDuration(Number(e.target.value))}
            style={{ width: 64, ...BTN_SM, padding: '2px 6px', textAlign: 'right' as const }} />
          ms
        </label>

        {/* Export */}
        <button onClick={() => setShowExport(v => !v)} style={BTN_SM}>
          {showExport ? 'Hide' : 'Export'}
        </button>
        <button onClick={onClose} style={{ ...BTN_SM, fontSize: 14, lineHeight: 1 }}>×</button>
      </div>

      {showExport ? (
        /* Export panel */
        <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden' }}>
          <div style={{ width: 140, flexShrink: 0, borderRight: '1px solid #3a1a1a', padding: '8px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9a7a7a', marginBottom: 6 }}>FORMAT</div>
            {(['css', 'gsap', 'framer'] as ExportFormat[]).map(f => (
              <button key={f} onClick={() => setExportFormat(f)} style={{
                ...BTN_SM, display: 'block', width: '100%', marginBottom: 4,
                textAlign: 'left' as const,
                ...(exportFormat === f ? { background: '#b5533c', borderColor: '#c4644d', color: '#fff' } : {}),
              }}>
                {f === 'css' ? '🎨 CSS' : f === 'gsap' ? '⚡ GSAP' : '🎭 Framer'}
              </button>
            ))}
            <button onClick={handleCopyExport} style={{ ...BTN_ACCENT, display: 'block', width: '100%', marginTop: 8 }}>
              {copiedExport ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre style={{
            flex: 1, overflow: 'auto', margin: 0, padding: '8px 12px',
            fontSize: 11, color: '#c9b5b5', fontFamily: 'monospace',
            background: '#0d0505', whiteSpace: 'pre' as const,
          }}>
            {exportCode}
          </pre>
        </div>
      ) : (
        /* Timeline editor */
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: track list + shape picker */}
          <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid #3a1a1a', overflowY: 'auto', padding: '8px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9a7a7a', marginBottom: 6 }}>TRACKS ({tracks.length})</div>
            {tracks.map(t => (
              <div key={t.id}
                onClick={() => setSelectedTrackId(t.id)}
                style={{
                  padding: '5px 8px', borderRadius: 5, marginBottom: 3, cursor: 'pointer',
                  background: selectedTrackId === t.id ? '#2a1010' : '#0d0505',
                  border: `1px solid ${selectedTrackId === t.id ? t.color : '#2a1a1a'}`,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {t.shapeName}
                </div>
                <button onClick={e => { e.stopPropagation(); removeTrack(t.id); }}
                  style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: 0, fontSize: 12 }}>
                  ×
                </button>
              </div>
            ))}

            {unusedShapes.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9a7a7a', margin: '8px 0 4px' }}>ADD SHAPE</div>
                {unusedShapes.slice(0, 6).map(s => (
                  <button key={s.id} onClick={() => addTrack(s)} style={{
                    ...BTN_SM, display: 'block', width: '100%', marginBottom: 3,
                    textAlign: 'left' as const, fontSize: 10, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    + {s.name || s.type}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Center: keyframe editor for selected track */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            {!selectedTrack ? (
              <div style={{ color: '#5a3a3a', fontSize: 13, textAlign: 'center' as const, padding: '32px 0' }}>
                Select a track to edit keyframes
              </div>
            ) : (
              <div>
                {/* Track header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedTrack.color }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedTrack.shapeName}</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9a7a7a', marginLeft: 'auto' }}>
                    Delay
                    <input type="number" value={selectedTrack.delay} min={0} max={5000} step={50}
                      onChange={e => handleSetDelay(selectedTrack.id, Number(e.target.value))}
                      style={{ width: 56, ...BTN_SM, padding: '2px 5px', textAlign: 'right' as const }} />
                    ms
                  </label>
                </div>

                {/* Add keyframe */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' as const }}>
                  <input type="number" value={kfTime} min={0} max={10000} step={50}
                    onChange={e => setKfTime(Number(e.target.value))}
                    placeholder="Time ms"
                    style={{ ...BTN_SM, width: 72, textAlign: 'right' as const }} />
                  <select value={kfProp} onChange={e => { setKfProp(e.target.value as AnimProperty); setKfValue(PROP_DEFAULTS[e.target.value as AnimProperty].default); }}
                    style={{ ...BTN_SM, appearance: 'none' as const }}>
                    {ANIM_PROPERTIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input type="number" value={kfValue}
                    min={PROP_DEFAULTS[kfProp].min} max={PROP_DEFAULTS[kfProp].max} step={kfProp === 'opacity' ? 0.05 : 1}
                    onChange={e => setKfValue(Number(e.target.value))}
                    style={{ ...BTN_SM, width: 64, textAlign: 'right' as const }} />
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: 10, color: '#9a7a7a' }}>{PROP_DEFAULTS[kfProp].unit}</span>
                  <select value={kfEasing} onChange={e => setKfEasing(e.target.value as EasingType)}
                    style={{ ...BTN_SM, appearance: 'none' as const }}>
                    {EASINGS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <button onClick={handleAddKeyframe} style={{ ...BTN_ACCENT }}>+ KF</button>
                </div>

                {/* Current time interpolated values */}
                {selectedTrack.keyframes.length > 0 && (
                  <div style={{ background: '#0d0505', border: '1px solid #2a1a1a', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#9a7a7a', marginBottom: 4 }}>
                      Values at {currentTime}ms
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                      {trackProperties(selectedTrack).map(prop => {
                        const val = interpolateValue(selectedTrack, prop, currentTime - selectedTrack.delay);
                        return (
                          <div key={prop} style={{ fontSize: 11 }}>
                            <span style={{ color: '#9a7a7a' }}>{prop}: </span>
                            <span style={{ color: '#b5533c', fontWeight: 600 }}>{val !== null ? val.toFixed(2) : '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Keyframe list */}
                {selectedTrack.keyframes.length === 0 ? (
                  <div style={{ color: '#5a3a3a', fontSize: 12, textAlign: 'center' as const, padding: '16px 0' }}>
                    No keyframes yet
                  </div>
                ) : (
                  <div>
                    {selectedTrack.keyframes.map(kf => (
                      <div key={kf.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 8px', borderRadius: 5, marginBottom: 2,
                        background: '#0d0505', border: '1px solid #2a1a1a',
                      }}>
                        <div style={{
                          width: 36, fontSize: 10, color: '#b5533c', fontWeight: 600, textAlign: 'right' as const,
                        }}>
                          {kf.time}ms
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#9a7a7a' }}>{kf.property}</span>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {kf.value}{PROP_DEFAULTS[kf.property].unit}
                          </span>
                          <span style={{ fontSize: 10, color: '#9a7a7a' }}>{kf.easing}</span>
                        </div>
                        <button onClick={() => handleRemoveKeyframe(selectedTrack.id, kf.id)}
                          style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 12 }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: mini visual timeline */}
          <div style={{ width: 200, flexShrink: 0, borderLeft: '1px solid #3a1a1a', padding: '8px', overflowY: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9a7a7a', marginBottom: 6 }}>TIMELINE</div>
            {tracks.length === 0 && (
              <div style={{ color: '#5a3a3a', fontSize: 11 }}>Add tracks to see timeline</div>
            )}
            {tracks.map(t => {
              const dur = trackDuration(t);
              const delayPct = (t.delay / calcDuration) * 100;
              const durPct = (dur / calcDuration) * 100;
              const currentPct = (currentTime / calcDuration) * 100;
              return (
                <div key={t.id} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: '#9a7a7a', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.shapeName}
                  </div>
                  <div style={{ height: 12, background: '#0d0505', borderRadius: 3, position: 'relative', border: '1px solid #2a1a1a' }}>
                    {/* Track bar */}
                    <div style={{
                      position: 'absolute', top: 1, bottom: 1,
                      left: `${delayPct}%`,
                      width: `${Math.min(100 - delayPct, durPct - delayPct)}%`,
                      background: t.color + '66', borderRadius: 2,
                    }} />
                    {/* Keyframe dots */}
                    {t.keyframes.map(kf => {
                      const kfPct = ((t.delay + kf.time) / calcDuration) * 100;
                      return (
                        <div key={kf.id} style={{
                          position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
                          left: `${kfPct}%`, width: 5, height: 5,
                          borderRadius: '50%', background: t.color, border: '1px solid #fff',
                        }} />
                      );
                    })}
                    {/* Playhead */}
                    <div style={{
                      position: 'absolute', top: -2, bottom: -2, width: 1.5,
                      background: '#fff', left: `${currentPct}%`,
                    }} />
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
