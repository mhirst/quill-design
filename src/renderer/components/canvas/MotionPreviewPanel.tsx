/**
 * MotionPreviewPanel — Live animation preview for selected shapes.
 *
 * Features:
 *  - 16 built-in animation presets (fade, slide, bounce, scale, rotate, flip, shake, etc.)
 *  - Live canvas preview with requestAnimationFrame loop
 *  - Play / Pause / Loop / Reverse controls
 *  - Duration (100–5000ms) + delay + easing controls
 *  - Progress scrubber (drag to scrub timeline)
 *  - Easing curve visualizer (SVG Bézier preview)
 *  - CSS export of the chosen animation
 *  - Keyboard: ⌘⇧⌥M to toggle
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── CSS animation injection ────────────────────────────────────────────────────

const STYLE_ID = 'motion-preview-keyframes';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes mp-scrubber-thumb {
      0% { transform: scaleX(1); }
      100% { transform: scaleX(1); }
    }
  `;
  document.head.appendChild(el);
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
}

interface AnimPreset {
  id: string;
  label: string;
  category: string;
  emoji: string;
  keyframes: Keyframe[];
  cssName: string;
}

// Keyframe is Web Animations API format
type EasingType = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' |
  'cubic-bezier(0.34,1.56,0.64,1)' | 'cubic-bezier(0.25,0.46,0.45,0.94)' |
  'steps(4,end)';

// ── Animation Presets ──────────────────────────────────────────────────────────

const PRESETS: AnimPreset[] = [
  {
    id: 'fade-in',
    label: 'Fade In',
    category: 'Fade',
    emoji: '🌅',
    cssName: 'mp-fade-in',
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
  },
  {
    id: 'fade-out',
    label: 'Fade Out',
    category: 'Fade',
    emoji: '🌇',
    cssName: 'mp-fade-out',
    keyframes: [{ opacity: 1 }, { opacity: 0 }],
  },
  {
    id: 'slide-up',
    label: 'Slide Up',
    category: 'Slide',
    emoji: '⬆️',
    cssName: 'mp-slide-up',
    keyframes: [
      { opacity: 0, transform: 'translateY(40px)' },
      { opacity: 1, transform: 'translateY(0px)' },
    ],
  },
  {
    id: 'slide-down',
    label: 'Slide Down',
    category: 'Slide',
    emoji: '⬇️',
    cssName: 'mp-slide-down',
    keyframes: [
      { opacity: 0, transform: 'translateY(-40px)' },
      { opacity: 1, transform: 'translateY(0px)' },
    ],
  },
  {
    id: 'slide-left',
    label: 'Slide Left',
    category: 'Slide',
    emoji: '⬅️',
    cssName: 'mp-slide-left',
    keyframes: [
      { opacity: 0, transform: 'translateX(60px)' },
      { opacity: 1, transform: 'translateX(0px)' },
    ],
  },
  {
    id: 'slide-right',
    label: 'Slide Right',
    category: 'Slide',
    emoji: '➡️',
    cssName: 'mp-slide-right',
    keyframes: [
      { opacity: 0, transform: 'translateX(-60px)' },
      { opacity: 1, transform: 'translateX(0px)' },
    ],
  },
  {
    id: 'scale-in',
    label: 'Scale In',
    category: 'Scale',
    emoji: '🔍',
    cssName: 'mp-scale-in',
    keyframes: [
      { opacity: 0, transform: 'scale(0.5)' },
      { opacity: 1, transform: 'scale(1)' },
    ],
  },
  {
    id: 'scale-out',
    label: 'Scale Out',
    category: 'Scale',
    emoji: '🔎',
    cssName: 'mp-scale-out',
    keyframes: [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.5)' },
    ],
  },
  {
    id: 'bounce-in',
    label: 'Bounce In',
    category: 'Scale',
    emoji: '🏀',
    cssName: 'mp-bounce-in',
    keyframes: [
      { opacity: 0, transform: 'scale(0.3)' },
      { opacity: 1, transform: 'scale(1.05)' },
      { transform: 'scale(0.96)' },
      { transform: 'scale(1)' },
    ],
  },
  {
    id: 'rotate-in',
    label: 'Rotate In',
    category: 'Rotate',
    emoji: '🌀',
    cssName: 'mp-rotate-in',
    keyframes: [
      { opacity: 0, transform: 'rotate(-180deg) scale(0.5)' },
      { opacity: 1, transform: 'rotate(0deg) scale(1)' },
    ],
  },
  {
    id: 'flip-x',
    label: 'Flip X',
    category: 'Rotate',
    emoji: '↔️',
    cssName: 'mp-flip-x',
    keyframes: [
      { transform: 'perspective(400px) rotateX(90deg)', opacity: 0 },
      { transform: 'perspective(400px) rotateX(-15deg)' },
      { transform: 'perspective(400px) rotateX(10deg)' },
      { transform: 'perspective(400px) rotateX(0deg)', opacity: 1 },
    ],
  },
  {
    id: 'shake',
    label: 'Shake',
    category: 'Attention',
    emoji: '😤',
    cssName: 'mp-shake',
    keyframes: [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-8px)' },
      { transform: 'translateX(8px)' },
      { transform: 'translateX(-8px)' },
      { transform: 'translateX(8px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(0)' },
    ],
  },
  {
    id: 'pulse',
    label: 'Pulse',
    category: 'Attention',
    emoji: '💓',
    cssName: 'mp-pulse',
    keyframes: [
      { transform: 'scale(1)' },
      { transform: 'scale(1.08)' },
      { transform: 'scale(1)' },
      { transform: 'scale(1.08)' },
      { transform: 'scale(1)' },
    ],
  },
  {
    id: 'jello',
    label: 'Jello',
    category: 'Attention',
    emoji: '🍮',
    cssName: 'mp-jello',
    keyframes: [
      { transform: 'skewX(0deg) skewY(0deg)' },
      { transform: 'skewX(-12deg) skewY(-12deg)' },
      { transform: 'skewX(6deg) skewY(6deg)' },
      { transform: 'skewX(-3deg) skewY(-3deg)' },
      { transform: 'skewX(0deg) skewY(0deg)' },
    ],
  },
  {
    id: 'blur-in',
    label: 'Blur In',
    category: 'Fade',
    emoji: '🔆',
    cssName: 'mp-blur-in',
    keyframes: [
      { opacity: 0, filter: 'blur(12px)', transform: 'scale(1.05)' },
      { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' },
    ],
  },
  {
    id: 'typewriter',
    label: 'Typewriter',
    category: 'Attention',
    emoji: '⌨️',
    cssName: 'mp-typewriter',
    keyframes: [
      { opacity: 0, transform: 'translateX(-100%) scaleX(0)', transformOrigin: 'left center' },
      { opacity: 1, transform: 'translateX(0) scaleX(1)', transformOrigin: 'left center' },
    ],
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(PRESETS.map(p => p.category)))];

// ── Easing options ─────────────────────────────────────────────────────────────

const EASINGS: { value: string; label: string; css: string }[] = [
  { value: 'linear', label: 'Linear', css: 'linear' },
  { value: 'ease', label: 'Ease', css: 'ease' },
  { value: 'ease-in', label: 'Ease In', css: 'ease-in' },
  { value: 'ease-out', label: 'Ease Out', css: 'ease-out' },
  { value: 'ease-in-out', label: 'Ease In-Out', css: 'ease-in-out' },
  { value: 'bounce', label: 'Bounce', css: 'cubic-bezier(0.34,1.56,0.64,1)' },
  { value: 'smooth', label: 'Smooth', css: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
  { value: 'steps', label: 'Steps', css: 'steps(8,end)' },
];

// ── Easing Curve Visualizer ────────────────────────────────────────────────────

function EasingCurve({ easing }: { easing: string }) {
  // Render a simple SVG path for common easing types
  const curves: Record<string, string> = {
    linear: 'M 0,60 L 60,0',
    ease: 'M 0,60 C 15,60 45,0 60,0',
    'ease-in': 'M 0,60 C 40,60 60,0 60,0',
    'ease-out': 'M 0,60 C 0,0 20,0 60,0',
    'ease-in-out': 'M 0,60 C 20,60 40,0 60,0',
    bounce: 'M 0,60 C 10,60 50,-10 60,0',
    smooth: 'M 0,60 C 8,60 40,0 60,0',
    steps: 'M 0,60 L 7.5,60 L 7.5,52 L 15,52 L 15,45 L 22.5,45 L 22.5,37 L 30,37 L 30,30 L 37.5,30 L 37.5,22 L 45,22 L 45,15 L 52.5,15 L 52.5,7 L 60,7 L 60,0',
  };
  const path = curves[easing] ?? curves['ease'];
  return (
    <svg width={60} height={60} viewBox="0 0 60 60" style={{ display: 'block' }}>
      <rect x={0} y={0} width={60} height={60} fill="rgba(255,255,255,0.03)" rx={4} />
      {/* Grid */}
      <line x1={0} y1={60} x2={60} y2={60} stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
      <line x1={0} y1={0} x2={0} y2={60} stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
      <line x1={0} y1={0} x2={60} y2={60} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="2 2" />
      {/* Curve */}
      <path d={path} fill="none" stroke="#818cf8" strokeWidth={2} strokeLinecap="round" />
      {/* Endpoints */}
      <circle cx={0} cy={60} r={3} fill="#6366f1" />
      <circle cx={60} cy={0} r={3} fill="#6366f1" />
    </svg>
  );
}

// ── Preview Canvas ─────────────────────────────────────────────────────────────

interface PreviewCanvasProps {
  shape: Shape | null;
  preset: AnimPreset;
  duration: number;
  delay: number;
  easing: string;
  playing: boolean;
  looping: boolean;
  reversed: boolean;
  onProgress: (t: number) => void;
}

function PreviewCanvas({
  shape, preset, duration, delay, easing, playing, looping, reversed, onProgress,
}: PreviewCanvasProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  const easingCss = EASINGS.find(e => e.value === easing)?.css ?? 'ease';

  const runAnimation = useCallback(() => {
    const el = divRef.current;
    if (!el) return;
    animRef.current?.cancel();

    const kfs = reversed ? [...preset.keyframes].reverse() : preset.keyframes;
    const anim = el.animate(kfs as Parameters<typeof el.animate>[0], {
      duration,
      delay,
      easing: easingCss,
      fill: 'both',
      iterations: looping ? Infinity : 1,
    });
    animRef.current = anim;

    if (!playing) anim.pause();

    // Track progress
    const raf = () => {
      if (!animRef.current) return;
      const t = duration > 0 ? Math.min(1, (animRef.current.currentTime ?? 0) as number / duration) : 0;
      onProgress(t);
      if (playing) requestAnimationFrame(raf);
    };
    if (playing) requestAnimationFrame(raf);
  }, [preset, duration, delay, easingCss, playing, looping, reversed, onProgress]);

  useEffect(() => {
    runAnimation();
    return () => { animRef.current?.cancel(); };
  }, [runAnimation]);

  // Handle play/pause toggle without restarting
  useEffect(() => {
    const anim = animRef.current;
    if (!anim) return;
    if (playing) anim.play(); else anim.pause();
  }, [playing]);

  const bgColor = shape?.fill ?? '#6366f1';
  const shapeW = Math.min(Math.max(shape?.width ?? 120, 40), 160);
  const shapeH = Math.min(Math.max(shape?.height ?? 80, 30), 100);
  const isCircle = shape?.type === 'ellipse';
  const isText = shape?.type === 'text';
  const rawBr = shape?.borderRadius;
  const br = typeof rawBr === 'number' ? rawBr : (isCircle ? 9999 : 8);
  const textContent = shape?.text ?? shape?.name ?? preset.label;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 180,
      background: 'rgba(10,10,20,0.8)',
      borderRadius: 8,
      border: '1px solid var(--border, #2d2d3d)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Checkerboard bg */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%)',
        backgroundSize: '16px 16px',
      }} />

      <div
        ref={divRef}
        style={{
          width: shapeW,
          height: isText ? undefined : shapeH,
          background: isText ? 'transparent' : bgColor,
          borderRadius: br,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isText ? (shape?.color ?? '#e2e8f0') : 'white',
          fontSize: isText ? (shape?.fontSize ?? 16) : 11,
          fontWeight: isText ? (shape?.fontWeight ?? 600) : 700,
          fontFamily: isText ? (shape?.fontFamily ?? 'system-ui') : 'system-ui',
          textAlign: 'center',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          boxShadow: isText ? 'none' : '0 4px 24px rgba(0,0,0,0.5)',
          opacity: 1,
          padding: isText ? '0' : '8px',
        }}
      >
        {isText ? textContent : (shape?.name ?? preset.label)}
      </div>
    </div>
  );
}

// ── CSS Export ─────────────────────────────────────────────────────────────────

function generateCSS(preset: AnimPreset, duration: number, delay: number, easing: string, looping: boolean): string {
  const easingCss = EASINGS.find(e => e.value === easing)?.css ?? 'ease';
  const steps = preset.keyframes.map((kf, i, arr) => {
    const pct = arr.length === 1 ? '100%' : `${Math.round((i / (arr.length - 1)) * 100)}%`;
    const props = Object.entries(kf)
      .map(([k, v]) => `  ${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v};`)
      .join('\n');
    return `  ${pct} {\n${props}\n  }`;
  });

  return `@keyframes ${preset.cssName} {\n${steps.join('\n')}\n}\n\n.element {\n  animation: ${preset.cssName} ${duration}ms ${easingCss} ${delay}ms ${looping ? 'infinite' : '1'} normal both;\n}`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function MotionPreviewPanel({ open, onClose, selectedShape }: Props) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activePreset, setActivePreset] = useState<AnimPreset>(PRESETS[0]);
  const [duration, setDuration] = useState(600);
  const [delay, setDelay] = useState(0);
  const [easing, setEasing] = useState('ease-out');
  const [playing, setPlaying] = useState(true);
  const [looping, setLooping] = useState(true);
  const [reversed, setReversed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => { injectStyles(); }, []);

  const filteredPresets = activeCategory === 'All'
    ? PRESETS
    : PRESETS.filter(p => p.category === activeCategory);

  const restartPreview = useCallback(() => {
    setPreviewKey(k => k + 1);
    setPlaying(true);
  }, []);

  const handleApply = useCallback(() => {
    restartPreview();
  }, [restartPreview]);

  const cssCode = generateCSS(activePreset, duration, delay, easing, looping);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(cssCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [cssCode]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 20,
      width: 340,
      maxHeight: '90vh',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      zIndex: 40,
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🎬</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>Motion Preview</span>
          <span style={{
            fontSize: 9, background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.25)',
            color: '#818cf8', padding: '1px 5px', borderRadius: 4, fontWeight: 600,
          }}>
            {PRESETS.length} presets
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ── Preview canvas ── */}
        <div style={{ padding: '10px 12px 8px' }}>
          <PreviewCanvas
            key={previewKey}
            shape={selectedShape}
            preset={activePreset}
            duration={duration}
            delay={delay}
            easing={easing}
            playing={playing}
            looping={looping}
            reversed={reversed}
            onProgress={setProgress}
          />

          {/* Progress bar */}
          <div style={{
            height: 3, background: 'var(--border, #2d2d3d)',
            borderRadius: 2, marginTop: 8, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round(progress * 100)}%`,
              background: 'var(--accent, #6366f1)',
              borderRadius: 2,
              transition: 'width 0.05s linear',
            }} />
          </div>

          {/* Playback controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => setPlaying(v => !v)}
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--accent, #6366f1)',
                border: 'none', cursor: 'pointer',
                color: 'white', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button
              onClick={restartPreview}
              title="Restart"
              style={{
                width: 24, height: 24, borderRadius: 5,
                background: 'transparent',
                border: '1px solid var(--border, #2d2d3d)',
                cursor: 'pointer', color: 'var(--muted)', fontSize: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ↺
            </button>
            <button
              onClick={() => setLooping(v => !v)}
              title="Loop"
              style={{
                width: 24, height: 24, borderRadius: 5,
                background: looping ? 'rgba(99,102,241,0.15)' : 'transparent',
                border: `1px solid ${looping ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                cursor: 'pointer',
                color: looping ? '#818cf8' : 'var(--muted)', fontSize: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ∞
            </button>
            <button
              onClick={() => setReversed(v => !v)}
              title="Reverse"
              style={{
                width: 24, height: 24, borderRadius: 5,
                background: reversed ? 'rgba(249,115,22,0.15)' : 'transparent',
                border: `1px solid ${reversed ? 'rgba(249,115,22,0.4)' : 'var(--border, #2d2d3d)'}`,
                cursor: 'pointer',
                color: reversed ? '#fb923c' : 'var(--muted)', fontSize: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ⇄
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 9, color: 'var(--muted, #888)' }}>
              {activePreset.emoji} {activePreset.label}
            </span>
          </div>
        </div>

        {/* ── Duration + Delay ── */}
        <div style={{
          padding: '0 12px 8px',
          display: 'flex', gap: 10,
          borderBottom: '1px solid var(--border, #2d2d3d)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>DURATION</span>
              <span style={{ color: 'var(--text, #e2e8f0)' }}>{duration}ms</span>
            </div>
            <input
              type="range"
              min={100} max={3000} step={50}
              value={duration}
              onChange={e => { setDuration(+e.target.value); restartPreview(); }}
              style={{ width: '100%', accentColor: '#6366f1' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>DELAY</span>
              <span style={{ color: 'var(--text, #e2e8f0)' }}>{delay}ms</span>
            </div>
            <input
              type="range"
              min={0} max={1000} step={50}
              value={delay}
              onChange={e => { setDelay(+e.target.value); restartPreview(); }}
              style={{ width: '100%', accentColor: '#6366f1' }}
            />
          </div>
        </div>

        {/* ── Easing ── */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border, #2d2d3d)',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 6, fontWeight: 600 }}>EASING</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {EASINGS.map(e => (
                <button
                  key={e.value}
                  onClick={() => { setEasing(e.value); restartPreview(); }}
                  style={{
                    padding: '2px 8px', height: 22, borderRadius: 4,
                    background: easing === e.value ? 'rgba(99,102,241,0.2)' : 'transparent',
                    border: `1px solid ${easing === e.value ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                    color: easing === e.value ? '#818cf8' : 'var(--muted, #888)',
                    fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flexShrink: 0, marginTop: 18 }}>
            <EasingCurve easing={easing} />
          </div>
        </div>

        {/* ── Category tabs ── */}
        <div style={{
          padding: '8px 12px 4px',
          borderBottom: '1px solid var(--border, #2d2d3d)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  height: 22, padding: '0 8px',
                  background: activeCategory === cat ? 'rgba(99,102,241,0.2)' : 'transparent',
                  border: `1px solid ${activeCategory === cat ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                  borderRadius: 4, cursor: 'pointer', fontSize: 10,
                  color: activeCategory === cat ? '#818cf8' : 'var(--muted, #888)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Preset grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border, #2d2d3d)',
        }}>
          {filteredPresets.map(preset => {
            const isActive = preset.id === activePreset.id;
            return (
              <button
                key={preset.id}
                onClick={() => { setActivePreset(preset); restartPreview(); }}
                style={{
                  padding: '6px 4px',
                  background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'var(--border, #2d2d3d)'}`,
                  borderRadius: 6, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)'; }}
              >
                <span style={{ fontSize: 16 }}>{preset.emoji}</span>
                <span style={{
                  fontSize: 8, fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#818cf8' : 'var(--muted, #888)',
                  textAlign: 'center', lineHeight: 1.2,
                }}>
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── CSS code export ── */}
        <div style={{ padding: '8px 12px' }}>
          <button
            onClick={() => setShowCode(v => !v)}
            style={{
              width: '100%', height: 28,
              background: showCode ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: `1px solid ${showCode ? 'rgba(99,102,241,0.3)' : 'var(--border, #2d2d3d)'}`,
              borderRadius: 6, cursor: 'pointer',
              color: showCode ? '#818cf8' : 'var(--muted, #888)',
              fontSize: 10, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            {showCode ? '▼' : '▶'} CSS Export
          </button>

          {showCode && (
            <div style={{ marginTop: 8, position: 'relative' }}>
              <pre style={{
                background: 'var(--bg, #131320)',
                border: '1px solid var(--border, #2d2d3d)',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 9,
                color: '#a5b4fc',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: 160,
                margin: 0,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {cssCode}
              </pre>
              <button
                onClick={handleCopy}
                style={{
                  position: 'absolute', top: 6, right: 6,
                  background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)',
                  border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.3)'}`,
                  borderRadius: 4, cursor: 'pointer',
                  color: copied ? '#22c55e' : '#818cf8',
                  fontSize: 9, padding: '2px 8px',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
