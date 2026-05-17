/**
 * AnimationTweenPanel — keyframe animation editor for shapes.
 *
 * Lets users define up to 8 keyframes for a selected shape,
 * then previews the CSS animation in a live mini canvas.
 *
 * Keyframe properties per frame:
 *   - time (0–100%)
 *   - x, y offset (translate)
 *   - scaleX, scaleY
 *   - rotation (degrees)
 *   - opacity (0–1)
 *
 * Output: generates a CSS @keyframes block + animation rule
 * that can be copied or injected into the shape's style.
 *
 * The live preview renders a scaled-down replica of the selected shape
 * inside the panel, animated with the generated CSS.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { buildShapeStyle } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnimKeyframe {
  id: string;
  time: number;     // 0–100 (percentage)
  tx: number;       // translateX in px
  ty: number;       // translateY in px
  scaleX: number;   // 1 = 100%
  scaleY: number;   // 1 = 100%
  rotation: number; // degrees
  opacity: number;  // 0–1
}

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function makeDefaultKeyframes(): AnimKeyframe[] {
  return [
    { id: uid(), time: 0,   tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0,   opacity: 1 },
    { id: uid(), time: 50,  tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0,   opacity: 1 },
    { id: uid(), time: 100, tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0,   opacity: 1 },
  ];
}

const PRESETS: { name: string; frames: Omit<AnimKeyframe, 'id'>[] }[] = [
  {
    name: 'Fade In',
    frames: [
      { time: 0,   tx: 0, ty: 0,  scaleX: 1, scaleY: 1, rotation: 0, opacity: 0 },
      { time: 100, tx: 0, ty: 0,  scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    ],
  },
  {
    name: 'Fade Out',
    frames: [
      { time: 0,   tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      { time: 100, tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0 },
    ],
  },
  {
    name: 'Slide Up',
    frames: [
      { time: 0,   tx: 0, ty: 40, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0 },
      { time: 100, tx: 0, ty: 0,  scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    ],
  },
  {
    name: 'Slide Down',
    frames: [
      { time: 0,   tx: 0, ty: -40, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0 },
      { time: 100, tx: 0, ty: 0,   scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    ],
  },
  {
    name: 'Zoom In',
    frames: [
      { time: 0,   tx: 0, ty: 0, scaleX: 0.5, scaleY: 0.5, rotation: 0, opacity: 0 },
      { time: 100, tx: 0, ty: 0, scaleX: 1,   scaleY: 1,   rotation: 0, opacity: 1 },
    ],
  },
  {
    name: 'Zoom Out',
    frames: [
      { time: 0,   tx: 0, ty: 0, scaleX: 1.5, scaleY: 1.5, rotation: 0, opacity: 1 },
      { time: 100, tx: 0, ty: 0, scaleX: 1,   scaleY: 1,   rotation: 0, opacity: 0 },
    ],
  },
  {
    name: 'Spin',
    frames: [
      { time: 0,   tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0,   opacity: 1 },
      { time: 100, tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 360, opacity: 1 },
    ],
  },
  {
    name: 'Bounce',
    frames: [
      { time: 0,   tx: 0, ty: 0,   scaleX: 1,   scaleY: 1,   rotation: 0, opacity: 1 },
      { time: 30,  tx: 0, ty: -30, scaleX: 0.9, scaleY: 1.1, rotation: 0, opacity: 1 },
      { time: 60,  tx: 0, ty: 0,   scaleX: 1.1, scaleY: 0.9, rotation: 0, opacity: 1 },
      { time: 80,  tx: 0, ty: -10, scaleX: 1,   scaleY: 1,   rotation: 0, opacity: 1 },
      { time: 100, tx: 0, ty: 0,   scaleX: 1,   scaleY: 1,   rotation: 0, opacity: 1 },
    ],
  },
  {
    name: 'Shake',
    frames: [
      { time: 0,   tx: 0,   ty: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      { time: 20,  tx: -12, ty: 0, scaleX: 1, scaleY: 1, rotation: -3, opacity: 1 },
      { time: 40,  tx: 12,  ty: 0, scaleX: 1, scaleY: 1, rotation: 3,  opacity: 1 },
      { time: 60,  tx: -8,  ty: 0, scaleX: 1, scaleY: 1, rotation: -2, opacity: 1 },
      { time: 80,  tx: 8,   ty: 0, scaleX: 1, scaleY: 1, rotation: 2,  opacity: 1 },
      { time: 100, tx: 0,   ty: 0, scaleX: 1, scaleY: 1, rotation: 0,  opacity: 1 },
    ],
  },
  {
    name: 'Pulse',
    frames: [
      { time: 0,   tx: 0, ty: 0, scaleX: 1,    scaleY: 1,    rotation: 0, opacity: 1 },
      { time: 50,  tx: 0, ty: 0, scaleX: 1.1,  scaleY: 1.1,  rotation: 0, opacity: 0.8 },
      { time: 100, tx: 0, ty: 0, scaleX: 1,    scaleY: 1,    rotation: 0, opacity: 1 },
    ],
  },
  {
    name: 'Flip X',
    frames: [
      { time: 0,   tx: 0, ty: 0, scaleX: 1,  scaleY: 1, rotation: 0, opacity: 1 },
      { time: 50,  tx: 0, ty: 0, scaleX: 0,  scaleY: 1, rotation: 0, opacity: 0.5 },
      { time: 100, tx: 0, ty: 0, scaleX: -1, scaleY: 1, rotation: 0, opacity: 1 },
    ],
  },
  {
    name: 'Float',
    frames: [
      { time: 0,   tx: 0, ty: 0,   scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      { time: 50,  tx: 0, ty: -16, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      { time: 100, tx: 0, ty: 0,   scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    ],
  },
];

function kfToTransform(kf: AnimKeyframe): string {
  const parts: string[] = [];
  if (kf.tx !== 0 || kf.ty !== 0) parts.push(`translate(${kf.tx}px,${kf.ty}px)`);
  if (kf.scaleX !== 1 || kf.scaleY !== 1) parts.push(`scale(${kf.scaleX},${kf.scaleY})`);
  if (kf.rotation !== 0) parts.push(`rotate(${kf.rotation}deg)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

function generateCss(keyframes: AnimKeyframe[], animName: string, duration: number, easing: string, iterCount: string | number): string {
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  const kfBlock = sorted.map(kf => {
    const transform = kfToTransform(kf);
    return `  ${kf.time}% {\n    transform: ${transform};\n    opacity: ${kf.opacity};\n  }`;
  }).join('\n');

  const iterStr = iterCount === 'infinite' ? 'infinite' : `${iterCount}`;
  return `@keyframes ${animName} {\n${kfBlock}\n}\n\n.${animName} {\n  animation: ${animName} ${duration}ms ${easing} ${iterStr};\n  transform-origin: center center;\n}`;
}

// ── Easing options ─────────────────────────────────────────────────────────────

const EASINGS = [
  { value: 'ease',            label: 'Ease' },
  { value: 'ease-in',         label: 'Ease In' },
  { value: 'ease-out',        label: 'Ease Out' },
  { value: 'ease-in-out',     label: 'Ease In/Out' },
  { value: 'linear',          label: 'Linear' },
  { value: 'cubic-bezier(0.34,1.56,0.64,1)', label: 'Spring' },
  { value: 'cubic-bezier(0.4,0,0.2,1)',       label: 'Material' },
  { value: 'steps(8)',         label: 'Steps (8)' },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  width: 380,
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 500,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  maxHeight: '90vh',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const labelSt: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--subtle)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  flexShrink: 0,
  minWidth: 54,
};

const inputSt: React.CSSProperties = {
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text)',
  fontSize: 11,
  padding: '2px 5px',
  width: '100%',
};

const btnSt: React.CSSProperties = {
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text)',
  fontSize: 10,
  padding: '2px 6px',
  cursor: 'pointer',
};

// ── Main component ─────────────────────────────────────────────────────────────

export function AnimationTweenPanel({ open, onClose, selectedShape }: Props) {
  const [keyframes, setKeyframes] = useState<AnimKeyframe[]>(makeDefaultKeyframes);
  const [selectedKfId, setSelectedKfId] = useState<string | null>(null);
  const [duration, setDuration] = useState(1000); // ms
  const [easing, setEasing] = useState('ease-in-out');
  const [iterCount, setIterCount] = useState<'infinite' | number>('infinite');
  const [playing, setPlaying] = useState(true);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const animStyleRef = useRef<HTMLStyleElement | null>(null);
  const animNameRef = useRef('quill_anim_' + uid());

  // Sort by time
  const sortedKfs = useMemo(() =>
    [...keyframes].sort((a, b) => a.time - b.time),
    [keyframes]
  );

  const selectedKf = keyframes.find(k => k.id === selectedKfId) ?? null;

  // ── Generate and inject animation CSS ─────────────────────────────────────

  const animName = animNameRef.current;

  useEffect(() => {
    if (!open) return;

    let style = animStyleRef.current;
    if (!style) {
      style = document.createElement('style');
      document.head.appendChild(style);
      animStyleRef.current = style;
    }

    const css = generateCss(sortedKfs, animName, duration, easing, iterCount);
    style.textContent = css;

    return () => {
      if (style && style.parentNode) {
        style.parentNode.removeChild(style);
        animStyleRef.current = null;
      }
    };
  }, [open, sortedKfs, animName, duration, easing, iterCount]);

  // Apply/remove animation class on preview element
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    if (playing) {
      el.classList.remove(animName);
      void el.offsetWidth; // force reflow to restart
      el.classList.add(animName);
    } else {
      el.classList.remove(animName);
    }
  }, [playing, sortedKfs, animName, duration, easing, iterCount]);

  // ── Keyframe CRUD ──────────────────────────────────────────────────────────

  const addKeyframe = useCallback(() => {
    // Insert at midpoint
    const times = sortedKfs.map(k => k.time);
    let newTime = 50;
    // Find the largest gap and insert there
    let maxGap = 0;
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap > maxGap) { maxGap = gap; newTime = (times[i - 1] + times[i]) / 2; }
    }
    // Interpolate values (findLast polyfill: filter then pick last)
    const beforeArr = sortedKfs.filter((k: AnimKeyframe) => k.time <= newTime);
    const before = beforeArr.length > 0 ? beforeArr[beforeArr.length - 1] : sortedKfs[0];
    const after = sortedKfs.find(k => k.time >= newTime) ?? sortedKfs[sortedKfs.length - 1];
    const t = before.time === after.time ? 0 : (newTime - before.time) / (after.time - before.time);
    const newKf: AnimKeyframe = {
      id: uid(),
      time: Math.round(newTime),
      tx: lerp(before.tx, after.tx, t),
      ty: lerp(before.ty, after.ty, t),
      scaleX: lerp(before.scaleX, after.scaleX, t),
      scaleY: lerp(before.scaleY, after.scaleY, t),
      rotation: lerp(before.rotation, after.rotation, t),
      opacity: lerp(before.opacity, after.opacity, t),
    };
    setKeyframes(ks => [...ks, newKf]);
    setSelectedKfId(newKf.id);
  }, [sortedKfs]);

  const deleteKeyframe = useCallback((id: string) => {
    if (keyframes.length <= 2) return; // keep at least 2
    setKeyframes(ks => ks.filter(k => k.id !== id));
    if (selectedKfId === id) setSelectedKfId(null);
  }, [keyframes.length, selectedKfId]);

  const updateKeyframe = useCallback((id: string, patch: Partial<AnimKeyframe>) => {
    setKeyframes(ks => ks.map(k => k.id === id ? { ...k, ...patch } : k));
  }, []);

  const applyPreset = useCallback((preset: typeof PRESETS[0]) => {
    const newKfs = preset.frames.map(f => ({ ...f, id: uid() }));
    setKeyframes(newKfs);
    setSelectedKfId(newKfs[0].id);
  }, []);

  // ── Copy CSS ───────────────────────────────────────────────────────────────

  const copyCss = useCallback(() => {
    const css = generateCss(sortedKfs, animName, duration, easing, iterCount);
    navigator.clipboard.writeText(css).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [sortedKfs, animName, duration, easing, iterCount]);

  if (!open) return null;

  // ── Build preview shape style ──────────────────────────────────────────────

  const previewSize = 64;
  const shapeStyle: React.CSSProperties = selectedShape
    ? (() => {
        const s = buildShapeStyle(selectedShape);
        const scale = Math.min(previewSize / selectedShape.width, previewSize / selectedShape.height, 1);
        return {
          ...s,
          position: 'relative',
          left: 'auto',
          top: 'auto',
          width: Math.round(selectedShape.width * scale),
          height: Math.round(selectedShape.height * scale),
          transformOrigin: 'center center',
          flexShrink: 0,
        };
      })()
    : {
        width: previewSize,
        height: previewSize,
        background: 'var(--accent)',
        borderRadius: 8,
        position: 'relative',
        transformOrigin: 'center center',
        flexShrink: 0,
      };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Animation</span>
          {!selectedShape && (
            <span style={{ fontSize: 10, color: 'var(--subtle)', background: 'var(--input)', borderRadius: 3, padding: '1px 5px' }}>
              No shape selected
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={copyCss}
            style={{ ...btnSt, color: copied ? 'var(--accent)' : 'var(--muted)' }}
            title="Copy CSS animation"
          >
            {copied ? '✓ Copied' : '</> CSS'}
          </button>
          <button onClick={onClose} style={{ ...btnSt, padding: '2px 8px' }}>✕</button>
        </div>
      </div>

      <div style={{ overflow: 'auto', flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Live preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Live Preview
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Checkerboard bg */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%)',
              backgroundSize: '16px 16px',
            }} />
            <div ref={previewRef} style={shapeStyle} />
          </div>

          {/* Playback controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setPlaying(p => !p)}
              style={{
                ...btnSt,
                background: playing ? 'var(--accent-dim)' : 'var(--input)',
                color: playing ? 'var(--accent)' : 'var(--muted)',
                padding: '3px 10px',
                fontSize: 12,
              }}
            >
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
              <span style={labelSt}>Duration</span>
              <input
                type="range"
                min={200} max={5000} step={50}
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 36, textAlign: 'right' }}>{(duration / 1000).toFixed(1)}s</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
              <span style={labelSt}>Easing</span>
              <select
                value={easing}
                onChange={e => setEasing(e.target.value)}
                style={{ ...inputSt }}
                onKeyDown={e => e.stopPropagation()}
              >
                {EASINGS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={labelSt}>Loop</span>
              <select
                value={iterCount === 'infinite' ? 'infinite' : String(iterCount)}
                onChange={e => setIterCount(e.target.value === 'infinite' ? 'infinite' : parseInt(e.target.value))}
                style={{ ...inputSt, width: 60 }}
                onKeyDown={e => e.stopPropagation()}
              >
                <option value="infinite">∞</option>
                <option value="1">1×</option>
                <option value="2">2×</option>
                <option value="3">3×</option>
              </select>
            </div>
          </div>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Presets
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                style={{
                  ...btnSt,
                  fontSize: 10,
                  padding: '3px 7px',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--input)'; e.currentTarget.style.color = 'var(--text)'; }}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Keyframes ({sortedKfs.length})
            </span>
            <button
              onClick={addKeyframe}
              style={{ ...btnSt, fontSize: 11, color: 'var(--accent)' }}
              disabled={keyframes.length >= 8}
            >
              + Add
            </button>
          </div>

          {/* Timeline bar */}
          <div style={{
            position: 'relative',
            height: 28,
            background: 'var(--input)',
            borderRadius: 6,
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            {/* Progress track */}
            <div style={{
              position: 'absolute',
              height: 3,
              top: '50%',
              left: 8,
              right: 8,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 2,
              transform: 'translateY(-50%)',
            }} />

            {/* Keyframe diamonds */}
            {sortedKfs.map((kf, i) => {
              const isSelected = kf.id === selectedKfId;
              const left = `calc(${kf.time}% * 0.85 + 7.5%)`;
              return (
                <div
                  key={kf.id}
                  onClick={() => setSelectedKfId(kf.id)}
                  onDoubleClick={() => i > 0 && i < sortedKfs.length - 1 && deleteKeyframe(kf.id)}
                  title={`${kf.time}% — click to edit, double-click to delete`}
                  style={{
                    position: 'absolute',
                    left,
                    top: '50%',
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    width: isSelected ? 12 : 9,
                    height: isSelected ? 12 : 9,
                    background: isSelected ? 'var(--accent)' : 'rgba(180,180,200,0.8)',
                    border: isSelected ? '2px solid white' : '1.5px solid rgba(255,255,255,0.3)',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                    zIndex: isSelected ? 2 : 1,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Selected keyframe editor */}
        {selectedKf && (
          <div style={{
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 8,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
                Keyframe at {selectedKf.time}%
              </span>
              {sortedKfs.length > 2 && sortedKfs.findIndex(k => k.id === selectedKf.id) > 0 && sortedKfs.findIndex(k => k.id === selectedKf.id) < sortedKfs.length - 1 && (
                <button
                  onClick={() => deleteKeyframe(selectedKf.id)}
                  style={{ ...btnSt, color: 'var(--error, #ef4444)', fontSize: 10 }}
                >
                  Delete
                </button>
              )}
            </div>

            {/* Time slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={labelSt}>Time</span>
              <input
                type="range" min={0} max={100} step={1}
                value={selectedKf.time}
                onChange={e => updateKeyframe(selectedKf.id, { time: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 30, textAlign: 'right' }}>{selectedKf.time}%</span>
            </div>

            {/* Translate X */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={labelSt}>Translate X</span>
              <input
                type="range" min={-200} max={200} step={1}
                value={selectedKf.tx}
                onChange={e => updateKeyframe(selectedKf.id, { tx: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                value={selectedKf.tx}
                onChange={e => updateKeyframe(selectedKf.id, { tx: parseInt(e.target.value) || 0 })}
                onKeyDown={e => e.stopPropagation()}
                style={{ ...inputSt, width: 44, textAlign: 'right' }}
              />
            </div>

            {/* Translate Y */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={labelSt}>Translate Y</span>
              <input
                type="range" min={-200} max={200} step={1}
                value={selectedKf.ty}
                onChange={e => updateKeyframe(selectedKf.id, { ty: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                value={selectedKf.ty}
                onChange={e => updateKeyframe(selectedKf.id, { ty: parseInt(e.target.value) || 0 })}
                onKeyDown={e => e.stopPropagation()}
                style={{ ...inputSt, width: 44, textAlign: 'right' }}
              />
            </div>

            {/* Scale X */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={labelSt}>Scale X</span>
              <input
                type="range" min={0} max={3} step={0.05}
                value={selectedKf.scaleX}
                onChange={e => updateKeyframe(selectedKf.id, { scaleX: parseFloat(e.target.value) })}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                value={selectedKf.scaleX.toFixed(2)}
                onChange={e => updateKeyframe(selectedKf.id, { scaleX: parseFloat(e.target.value) || 1 })}
                onKeyDown={e => e.stopPropagation()}
                style={{ ...inputSt, width: 44, textAlign: 'right' }}
                step={0.1}
              />
            </div>

            {/* Scale Y */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={labelSt}>Scale Y</span>
              <input
                type="range" min={0} max={3} step={0.05}
                value={selectedKf.scaleY}
                onChange={e => updateKeyframe(selectedKf.id, { scaleY: parseFloat(e.target.value) })}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                value={selectedKf.scaleY.toFixed(2)}
                onChange={e => updateKeyframe(selectedKf.id, { scaleY: parseFloat(e.target.value) || 1 })}
                onKeyDown={e => e.stopPropagation()}
                style={{ ...inputSt, width: 44, textAlign: 'right' }}
                step={0.1}
              />
            </div>

            {/* Rotation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={labelSt}>Rotation</span>
              <input
                type="range" min={-360} max={360} step={1}
                value={selectedKf.rotation}
                onChange={e => updateKeyframe(selectedKf.id, { rotation: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                value={selectedKf.rotation}
                onChange={e => updateKeyframe(selectedKf.id, { rotation: parseInt(e.target.value) || 0 })}
                onKeyDown={e => e.stopPropagation()}
                style={{ ...inputSt, width: 44, textAlign: 'right' }}
              />
            </div>

            {/* Opacity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={labelSt}>Opacity</span>
              <input
                type="range" min={0} max={1} step={0.01}
                value={selectedKf.opacity}
                onChange={e => updateKeyframe(selectedKf.id, { opacity: parseFloat(e.target.value) })}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                value={selectedKf.opacity.toFixed(2)}
                onChange={e => updateKeyframe(selectedKf.id, { opacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })}
                onKeyDown={e => e.stopPropagation()}
                style={{ ...inputSt, width: 44, textAlign: 'right' }}
                step={0.1}
              />
            </div>
          </div>
        )}

        {/* CSS output (collapsed) */}
        <details style={{ fontSize: 10 }}>
          <summary style={{ color: 'var(--subtle)', cursor: 'pointer', fontSize: 10, fontWeight: 600, userSelect: 'none' }}>
            Generated CSS
          </summary>
          <pre style={{
            marginTop: 6,
            background: 'var(--input)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 8,
            fontSize: 9.5,
            color: 'var(--muted)',
            overflow: 'auto',
            maxHeight: 160,
            lineHeight: 1.5,
            fontFamily: 'monospace',
          }}>
            {generateCss(sortedKfs, animName, duration, easing, iterCount)}
          </pre>
        </details>
      </div>
    </div>
  );
}
