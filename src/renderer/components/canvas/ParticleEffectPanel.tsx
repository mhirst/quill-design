/**
 * ParticleEffectPanel — Animated particle system generator.
 *
 * Creates beautiful animated SVG particle effects that can be:
 * - Previewed live in the panel
 * - Exported as SVG + CSS (copy to clipboard)
 * - Applied as a background image (data URI) to the selected shape
 *
 * Particle types: Dots, Stars, Bubbles, Fireflies, Snow, Confetti, Lines, Hexagons
 * Controls: count, size, speed, spread, color palette, opacity, gravity, drift
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onApplyBackground: (ids: string[], cssBackground: string) => void;
}

type ParticleType = 'dots' | 'stars' | 'bubbles' | 'snow' | 'confetti' | 'fireflies' | 'lines' | 'hexagons';

interface ParticleConfig {
  type: ParticleType;
  count: number;
  minSize: number;
  maxSize: number;
  speed: number;       // animation duration factor
  opacity: number;     // 0-1
  colors: string[];
  spread: number;      // how spread out particles are
  drift: number;       // horizontal drift factor
  gravity: number;     // vertical gravity factor
  blur: number;        // blur px for glow effect
  rotation: boolean;   // spin particles
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
  delay: number;
  duration: number;
  driftX: number;
  driftY: number;
  rotation: number;
  rotationSpeed: number;
  phase: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CANVAS_W = 280;
const CANVAS_H = 200;

const TYPE_PRESETS: Array<{ id: ParticleType; label: string; emoji: string }> = [
  { id: 'dots', label: 'Dots', emoji: '●' },
  { id: 'stars', label: 'Stars', emoji: '★' },
  { id: 'bubbles', label: 'Bubbles', emoji: '○' },
  { id: 'snow', label: 'Snow', emoji: '❄' },
  { id: 'confetti', label: 'Confetti', emoji: '🎊' },
  { id: 'fireflies', label: 'Fireflies', emoji: '✦' },
  { id: 'lines', label: 'Lines', emoji: '—' },
  { id: 'hexagons', label: 'Hex', emoji: '⬡' },
];

const COLOR_PALETTES: Array<{ id: string; label: string; colors: string[] }> = [
  { id: 'indigo', label: 'Indigo', colors: ['#818cf8', '#6366f1', '#4f46e5', '#c7d2fe'] },
  { id: 'aurora', label: 'Aurora', colors: ['#34d399', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6'] },
  { id: 'sunset', label: 'Sunset', colors: ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'] },
  { id: 'ocean', label: 'Ocean', colors: ['#06b6d4', '#0ea5e9', '#3b82f6', '#38bdf8'] },
  { id: 'gold', label: 'Gold', colors: ['#fbbf24', '#f59e0b', '#d97706', '#fde68a'] },
  { id: 'neon', label: 'Neon', colors: ['#4ade80', '#22d3ee', '#f472b6', '#facc15'] },
  { id: 'mono', label: 'White', colors: ['#ffffff', '#e2e8f0', '#cbd5e1', '#94a3b8'] },
  { id: 'rose', label: 'Rose', colors: ['#fb7185', '#f43f5e', '#fda4af', '#fecdd3'] },
];

// ── Particle generation ────────────────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateParticles(config: ParticleConfig, seed: number = 42): Particle[] {
  const rand = seededRandom(seed);
  return Array.from({ length: config.count }, (_, i) => {
    const colorIdx = Math.floor(rand() * config.colors.length);
    return {
      id: i,
      x: rand() * CANVAS_W,
      y: rand() * CANVAS_H,
      size: config.minSize + rand() * (config.maxSize - config.minSize),
      opacity: config.opacity * (0.5 + rand() * 0.5),
      color: config.colors[colorIdx],
      delay: -(rand() * config.speed * 2000), // negative = start partway through
      duration: config.speed * 1000 * (0.7 + rand() * 0.6),
      driftX: (rand() - 0.5) * config.drift * 60,
      driftY: config.gravity * (20 + rand() * 40),
      rotation: rand() * 360,
      rotationSpeed: (rand() - 0.5) * 360,
      phase: rand() * Math.PI * 2,
    };
  });
}

// ── SVG particle shape ─────────────────────────────────────────────────────────

function particlePath(type: ParticleType, size: number): React.ReactNode {
  const s = size;
  const h = s / 2;

  switch (type) {
    case 'stars': {
      // 5-pointed star
      const pts = Array.from({ length: 10 }, (_, i) => {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? s : s * 0.4;
        return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
      }).join(' ');
      return <polygon points={pts} />;
    }
    case 'bubbles':
      return <circle r={h} />;
    case 'snow':
      return (
        <g>
          <line x1={-h} y1={0} x2={h} y2={0} strokeWidth={size * 0.2} stroke="currentColor" />
          <line x1={0} y1={-h} x2={0} y2={h} strokeWidth={size * 0.2} stroke="currentColor" />
          <line x1={-h * 0.7} y1={-h * 0.7} x2={h * 0.7} y2={h * 0.7} strokeWidth={size * 0.15} stroke="currentColor" />
          <line x1={h * 0.7} y1={-h * 0.7} x2={-h * 0.7} y2={h * 0.7} strokeWidth={size * 0.15} stroke="currentColor" />
        </g>
      );
    case 'confetti':
      return <rect x={-h} y={-h * 0.5} width={s} height={s * 0.5} rx={1} />;
    case 'fireflies':
      return <circle r={h * 0.6} />;
    case 'lines':
      return <line x1={-h * 1.5} y1={0} x2={h * 1.5} y2={0} strokeWidth={size * 0.3} strokeLinecap="round" stroke="currentColor" />;
    case 'hexagons': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const angle = (i * Math.PI) / 3;
        return `${Math.cos(angle) * h},${Math.sin(angle) * h}`;
      }).join(' ');
      return <polygon points={pts} fill="none" strokeWidth={size * 0.15} stroke="currentColor" />;
    }
    default: // dots
      return <circle r={h} />;
  }
}

// ── CSS animation name ─────────────────────────────────────────────────────────

let _panelId = 0;
const PANEL_ID = ++_panelId;

// ── Preview Canvas ─────────────────────────────────────────────────────────────

interface PreviewProps {
  particles: Particle[];
  config: ParticleConfig;
  playing: boolean;
}

function ParticlePreview({ particles, config, playing }: PreviewProps) {
  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        display: 'block',
        borderRadius: 8,
        background: 'rgba(8,8,18,0.92)',
        border: '1px solid rgba(99,102,241,0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Embedded keyframes */}
      <defs>
        <style>{`
          @keyframes pfloat-${PANEL_ID} {
            0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translate(var(--dx), var(--dy)) rotate(var(--dr)); opacity: 0; }
          }
          @keyframes ppulse-${PANEL_ID} {
            0%, 100% { opacity: var(--base-op); transform: scale(1); }
            50% { opacity: calc(var(--base-op) * 1.8); transform: scale(1.4); }
          }
        `}</style>
        {/* Glow filter */}
        <filter id={`pglow-${PANEL_ID}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={config.blur} result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {particles.map(p => {
        const isFirefly = config.type === 'fireflies';
        const animName = isFirefly ? `ppulse-${PANEL_ID}` : `pfloat-${PANEL_ID}`;
        const style: React.CSSProperties = {
          '--dx': `${p.driftX}px`,
          '--dy': `${p.driftY * -1}px`,
          '--dr': `${p.rotationSpeed}deg`,
          '--base-op': p.opacity,
          animation: playing
            ? `${animName} ${(p.duration / 1000).toFixed(2)}s ${p.delay < 0 ? `${(p.delay / 1000).toFixed(2)}s` : `${(p.delay / 1000).toFixed(2)}s`} ease-in-out infinite`
            : 'none',
        } as React.CSSProperties;

        const needsGlow = config.blur > 0;

        return (
          <g
            key={p.id}
            transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.rotation.toFixed(1)})`}
            fill={p.color}
            color={p.color}
            opacity={p.opacity}
            filter={needsGlow ? `url(#pglow-${PANEL_ID})` : undefined}
            style={style}
          >
            {particlePath(config.type, p.size)}
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ParticleConfig = {
  type: 'dots',
  count: 30,
  minSize: 3,
  maxSize: 8,
  speed: 4,
  opacity: 0.7,
  colors: COLOR_PALETTES[0].colors,
  spread: 1,
  drift: 0.5,
  gravity: 0.3,
  blur: 0,
  rotation: false,
};

export function ParticleEffectPanel({
  open,
  onClose,
  selectedShape,
  selectedShapeIds,
  onApplyBackground,
}: Props) {
  const [config, setConfig] = useState<ParticleConfig>(DEFAULT_CONFIG);
  const [playing, setPlaying] = useState(true);
  const [seed, setSeed] = useState(42);
  const [selectedPalette, setSelectedPalette] = useState(COLOR_PALETTES[0].id);

  const particles = useMemo(() => generateParticles(config, seed), [config, seed]);

  const getIds = useCallback(() => {
    if (selectedShapeIds.length > 0) return selectedShapeIds;
    if (selectedShape) return [selectedShape.id];
    return [];
  }, [selectedShape, selectedShapeIds]);

  const updateConfig = useCallback(<K extends keyof ParticleConfig>(key: K, value: ParticleConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const randomize = useCallback(() => {
    setSeed(Math.floor(Math.random() * 100000));
  }, []);

  const generateSvgString = useCallback(() => {
    const svgParts = particles.map(p => {
      const isFirefly = config.type === 'fireflies';
      const animName = isFirefly ? 'ppulse' : 'pfloat';
      return `<g transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.rotation.toFixed(1)})" fill="${p.color}" opacity="${p.opacity.toFixed(2)}" style="animation:${animName} ${(p.duration/1000).toFixed(2)}s ${(p.delay/1000).toFixed(2)}s ease-in-out infinite">
  <circle r="${(p.size/2).toFixed(1)}"/>
</g>`;
    }).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <style>
    @keyframes pfloat { 0%{opacity:0;transform:translate(0,0)} 10%,90%{opacity:1} 100%{opacity:0;transform:translate(0,-40px)} }
    @keyframes ppulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.5)} }
  </style>
${svgParts}
</svg>`;
  }, [particles, config]);

  const [copied, setCopied] = useState(false);
  const copyCSS = useCallback(() => {
    const svgStr = generateSvgString();
    const encoded = btoa(svgStr);
    const dataUri = `url("data:image/svg+xml;base64,${encoded}")`;
    navigator.clipboard.writeText(`background: ${dataUri};`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [generateSvgString]);

  const applyToShape = useCallback(() => {
    const ids = getIds();
    if (ids.length === 0) return;
    const svgStr = generateSvgString();
    const encoded = btoa(svgStr);
    const dataUri = `url("data:image/svg+xml;base64,${encoded}")`;
    onApplyBackground(ids, dataUri);
  }, [getIds, generateSvgString, onApplyBackground]);

  if (!open) return null;

  const targetCount = getIds().length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'linear-gradient(135deg,rgba(12,12,22,0.99),rgba(18,10,30,0.99))',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          color: '#e2e8f0',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>✦ Particle Effects</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Generate animated particle systems for backgrounds
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* Left: Preview */}
          <div style={{ flex: '0 0 auto' }}>
            {/* Type selector */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {TYPE_PRESETS.map(tp => (
                <button
                  key={tp.id}
                  onClick={() => updateConfig('type', tp.id)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    borderRadius: 5,
                    border: `1px solid ${config.type === tp.id ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'}`,
                    background: config.type === tp.id ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.02)',
                    color: config.type === tp.id ? '#c7d2fe' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {tp.emoji} {tp.label}
                </button>
              ))}
            </div>

            {/* Preview */}
            <ParticlePreview particles={particles} config={config} playing={playing} />

            {/* Preview controls */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                onClick={() => setPlaying(p => !p)}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: 10,
                  borderRadius: 5,
                  border: `1px solid ${playing ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  background: playing ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                  color: playing ? '#fde68a' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={randomize}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: 10,
                  borderRadius: 5,
                  border: '1px solid rgba(99,102,241,0.2)',
                  background: 'rgba(99,102,241,0.06)',
                  color: '#818cf8',
                  cursor: 'pointer',
                }}
              >
                ↻ Randomize
              </button>
            </div>

            {/* Apply button */}
            <button
              onClick={applyToShape}
              disabled={targetCount === 0}
              style={{
                width: '100%',
                marginTop: 8,
                padding: '8px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid rgba(99,102,241,0.4)',
                background: targetCount > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.05)',
                color: targetCount > 0 ? '#c7d2fe' : '#334155',
                cursor: targetCount > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              {targetCount > 0 ? `↓ Apply to ${targetCount} shape${targetCount > 1 ? 's' : ''}` : 'Select a shape first'}
            </button>
          </div>

          {/* Right: Controls */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Color palette */}
            <div>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Color Palette</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {COLOR_PALETTES.map(pal => (
                  <button
                    key={pal.id}
                    onClick={() => { setSelectedPalette(pal.id); updateConfig('colors', pal.colors); }}
                    style={{
                      padding: '6px 4px',
                      borderRadius: 6,
                      border: `1px solid ${selectedPalette === pal.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)'}`,
                      background: selectedPalette === pal.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {/* Color dots */}
                    <div style={{ display: 'flex', gap: 2 }}>
                      {pal.colors.slice(0, 4).map((c, i) => (
                        <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 8, color: '#475569' }}>{pal.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            {[
              { key: 'count', label: 'Count', min: 5, max: 80, step: 1, unit: '' },
              { key: 'minSize', label: 'Min Size', min: 1, max: 20, step: 0.5, unit: 'px' },
              { key: 'maxSize', label: 'Max Size', min: 2, max: 40, step: 0.5, unit: 'px' },
              { key: 'speed', label: 'Speed', min: 0.5, max: 10, step: 0.1, unit: 's' },
              { key: 'opacity', label: 'Opacity', min: 0.05, max: 1, step: 0.01, unit: '' },
              { key: 'drift', label: 'Drift', min: 0, max: 2, step: 0.05, unit: '' },
              { key: 'gravity', label: 'Rise', min: 0, max: 2, step: 0.05, unit: '' },
              { key: 'blur', label: 'Glow', min: 0, max: 8, step: 0.5, unit: 'px' },
            ].map(({ key, label, min, max, step, unit }) => {
              const val = config[key as keyof ParticleConfig] as number;
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
                    <span style={{ fontSize: 11, color: '#818cf8', fontFamily: 'monospace' }}>
                      {typeof val === 'number' ? (step < 1 ? val.toFixed(2) : Math.round(val)) : val}{unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={val}
                    onChange={e => updateConfig(key as keyof ParticleConfig, Number(e.target.value) as ParticleConfig[keyof ParticleConfig])}
                    style={{ width: '100%', accentColor: '#6366f1' }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer: Copy CSS */}
        <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={copyCSS}
            style={{
              padding: '7px 14px',
              fontSize: 11,
              borderRadius: 7,
              border: '1px solid rgba(99,102,241,0.35)',
              background: copied ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.1)',
              color: copied ? '#c7d2fe' : '#818cf8',
              cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied SVG CSS' : '⊕ Copy as CSS background'}
          </button>
        </div>
      </div>
    </div>
  );
}
