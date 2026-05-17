/**
 * PatternFillPanel — SVG pattern generator for Quill.
 *
 * Generates crisp SVG patterns as data URIs and applies them as
 * CSS background-image fills to selected shapes, or sets the global
 * canvas background pattern.
 *
 * Patterns:
 *  dots · grid · lines · diagonal · cross · hexagonal · triangles
 *  diamonds · waves · circuits · noise · checkerboard · plus signs
 *  zigzag · leaves
 *
 * Controls per pattern:
 *  - Foreground color
 *  - Background color (transparent option)
 *  - Scale / spacing
 *  - Line weight / dot size
 *  - Rotation (for directional patterns)
 *  - Opacity
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { X, RefreshCw, Copy, Download } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatternConfig {
  type: PatternType;
  fg: string;
  bg: string;
  bgTransparent: boolean;
  size: number;        // spacing / cell size
  weight: number;      // stroke width / dot radius
  rotation: number;    // deg, for directional patterns
  opacity: number;     // 0–1
  gap: number;         // secondary spacing for some patterns
}

type PatternType =
  | 'dots' | 'grid' | 'lines' | 'diagonal' | 'cross'
  | 'hexagonal' | 'triangles' | 'diamonds' | 'waves'
  | 'circuits' | 'checkerboard' | 'plus' | 'zigzag' | 'noise';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onApplyToShape: (ids: string[], cssBackground: string) => void;
  onApplyToCanvas: (cssBackground: string) => void;
}

// ─── Pattern generators ───────────────────────────────────────────────────────

function enc(s: string): string {
  // Encode SVG for use as CSS data URI
  return s
    .replace(/"/g, "'")
    .replace(/#/g, '%23')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function svgToCss(svgStr: string): string {
  return `url("data:image/svg+xml,${enc(svgStr)}")`;
}

function generatePattern(cfg: PatternConfig): string {
  const { fg, bg, bgTransparent, size, weight, rotation, opacity, gap } = cfg;
  const bgFill = bgTransparent ? 'transparent' : bg;
  const alpha = opacity.toFixed(2);

  const wrap = (inner: string, w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  ${bgFill !== 'transparent' ? `<rect width="${w}" height="${h}" fill="${bgFill}"/>` : ''}
  <g opacity="${alpha}">
    ${inner}
  </g>
</svg>`;

  const s = Math.max(4, size);
  const r = rotation;

  switch (cfg.type) {
    case 'dots': {
      const rad = Math.max(0.5, weight);
      return svgToCss(wrap(
        `<circle cx="${s / 2}" cy="${s / 2}" r="${rad}" fill="${fg}"/>`,
        s, s
      ));
    }

    case 'grid': {
      const w = Math.max(0.5, weight);
      return svgToCss(wrap(
        `<path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="${fg}" stroke-width="${w}"/>`,
        s, s
      ));
    }

    case 'lines': {
      const w = Math.max(0.5, weight);
      return svgToCss(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  ${bgFill !== 'transparent' ? `<rect width="${s}" height="${s}" fill="${bgFill}"/>` : ''}
  <g opacity="${alpha}" transform="rotate(${r} ${s / 2} ${s / 2})">
    <line x1="0" y1="0" x2="${s}" y2="0" stroke="${fg}" stroke-width="${w}"/>
  </g>
</svg>`
      );
    }

    case 'diagonal': {
      const w = Math.max(0.5, weight);
      return svgToCss(wrap(
        `<line x1="0" y1="0" x2="${s}" y2="${s}" stroke="${fg}" stroke-width="${w}"/>
         <line x1="${s}" y1="0" x2="${s * 2}" y2="${s}" stroke="${fg}" stroke-width="${w}"/>
         <line x1="${-s}" y1="0" x2="0" y2="${s}" stroke="${fg}" stroke-width="${w}"/>`,
        s, s
      ));
    }

    case 'cross': {
      const w = Math.max(0.5, weight);
      const half = s / 2;
      return svgToCss(wrap(
        `<line x1="${half}" y1="0" x2="${half}" y2="${s}" stroke="${fg}" stroke-width="${w}"/>
         <line x1="0" y1="${half}" x2="${s}" y2="${half}" stroke="${fg}" stroke-width="${w}"/>`,
        s, s
      ));
    }

    case 'hexagonal': {
      const w = Math.max(0.5, weight);
      const hw = s * 0.866; // sqrt(3)/2
      const hh = s;
      const x1 = s / 4; const x2 = (3 * s) / 4; const x3 = s;
      const y1 = 0; const y2 = hh / 4; const y3 = (3 * hh) / 4; const y4 = hh;
      const hex = `M${s / 2},${y1} L${x3},${y2} L${x3},${y3} L${s / 2},${y4} L${x1 - s / 4 + s / 4},${y3}`;
      return svgToCss(wrap(
        `<path d="M${s / 2},0 L${s},${s / 4} L${s},${(3 * s) / 4} L${s / 2},${s} L0,${(3 * s) / 4} L0,${s / 4} Z" fill="none" stroke="${fg}" stroke-width="${w}"/>`,
        s, s
      ));
    }

    case 'triangles': {
      const w = Math.max(0.5, weight);
      const h2 = s * 0.866;
      return svgToCss(wrap(
        `<path d="M0,${h2} L${s / 2},0 L${s},${h2} Z" fill="none" stroke="${fg}" stroke-width="${w}"/>
         <path d="M${s / 2},0 L${s},${h2} L${s * 1.5},0 Z" fill="none" stroke="${fg}" stroke-width="${w}"/>`,
        s, h2
      ));
    }

    case 'diamonds': {
      const w = Math.max(0.5, weight);
      const h = s * 0.6;
      return svgToCss(wrap(
        `<path d="M${s / 2},0 L${s},${h / 2} L${s / 2},${h} L0,${h / 2} Z" fill="none" stroke="${fg}" stroke-width="${w}"/>`,
        s, h
      ));
    }

    case 'waves': {
      const w = Math.max(0.5, weight);
      const amp = weight * 2 + 2;
      const ww = s * 2;
      return svgToCss(wrap(
        `<path d="M0,${s / 2} Q${s / 4},${s / 2 - amp} ${s / 2},${s / 2} T${s},${s / 2}" fill="none" stroke="${fg}" stroke-width="${w}"/>
         <path d="M0,${s / 2 + gap + amp * 2} Q${s / 4},${s / 2 + gap + amp * 2 - amp} ${s / 2},${s / 2 + gap + amp * 2} T${s},${s / 2 + gap + amp * 2}" fill="none" stroke="${fg}" stroke-width="${w}"/>`,
        s, s
      ));
    }

    case 'circuits': {
      const w = Math.max(0.5, weight);
      const g = s;
      // L-shaped traces + nodes
      return svgToCss(wrap(
        `<path d="M0,${g / 2} H${g / 3} V${g / 4} H${g * 2 / 3} V${g / 2} H${g}" fill="none" stroke="${fg}" stroke-width="${w}"/>
         <circle cx="${g / 3}" cy="${g / 2}" r="${w * 1.5}" fill="${fg}"/>
         <circle cx="${g * 2 / 3}" cy="${g / 2}" r="${w * 1.5}" fill="${fg}"/>
         <path d="M${g / 2},${g / 2} V${g * 3 / 4} H${g / 4}" fill="none" stroke="${fg}" stroke-width="${w}"/>
         <circle cx="${g / 4}" cy="${g * 3 / 4}" r="${w * 1.5}" fill="${fg}"/>`,
        g, g
      ));
    }

    case 'checkerboard': {
      const half = s / 2;
      return svgToCss(wrap(
        `<rect width="${half}" height="${half}" fill="${fg}" opacity="${alpha}"/>
         <rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${fg}" opacity="${alpha}"/>`,
        s, s
      ));
    }

    case 'plus': {
      const w = Math.max(1, weight);
      const arm = s / 3;
      const c = s / 2;
      return svgToCss(wrap(
        `<path d="M${c - w / 2},${c - arm} v${arm * 2} M${c - arm},${c - w / 2} h${arm * 2}" stroke="${fg}" stroke-width="${w}" fill="none"/>`,
        s, s
      ));
    }

    case 'zigzag': {
      const w = Math.max(0.5, weight);
      const h = s / 2;
      return svgToCss(wrap(
        `<polyline points="0,${h} ${s / 4},0 ${s / 2},${h} ${s * 3 / 4},0 ${s},${h}" fill="none" stroke="${fg}" stroke-width="${w}"/>`,
        s, h
      ));
    }

    case 'noise': {
      // Pseudo-noise using multiple overlapping shapes with seeded positions
      const items = Array.from({ length: 8 }, (_, i) => {
        const x = ((i * 37 + 17) % s);
        const y = ((i * 23 + 7) % s);
        const r = Math.max(0.5, weight * (0.5 + (i % 3) * 0.5));
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fg}"/>`;
      }).join('\n');
      return svgToCss(wrap(items, s, s));
    }

    default:
      return '';
  }
}

// ─── Pattern metadata ─────────────────────────────────────────────────────────

const PATTERNS: Array<{ type: PatternType; label: string; hasRotation: boolean; hasGap: boolean }> = [
  { type: 'dots',         label: 'Dots',         hasRotation: false, hasGap: false },
  { type: 'grid',         label: 'Grid',         hasRotation: false, hasGap: false },
  { type: 'lines',        label: 'Lines',        hasRotation: true,  hasGap: false },
  { type: 'diagonal',     label: 'Diagonal',     hasRotation: false, hasGap: false },
  { type: 'cross',        label: 'Cross',        hasRotation: false, hasGap: false },
  { type: 'hexagonal',    label: 'Hex',          hasRotation: false, hasGap: false },
  { type: 'triangles',    label: 'Triangles',    hasRotation: false, hasGap: false },
  { type: 'diamonds',     label: 'Diamonds',     hasRotation: false, hasGap: false },
  { type: 'waves',        label: 'Waves',        hasRotation: false, hasGap: true  },
  { type: 'circuits',     label: 'Circuits',     hasRotation: false, hasGap: false },
  { type: 'checkerboard', label: 'Checker',      hasRotation: false, hasGap: false },
  { type: 'plus',         label: 'Plus',         hasRotation: false, hasGap: false },
  { type: 'zigzag',       label: 'Zigzag',       hasRotation: false, hasGap: false },
  { type: 'noise',        label: 'Noise',        hasRotation: false, hasGap: false },
];

// ─── PatternThumb ─────────────────────────────────────────────────────────────

function PatternThumb({ cfg, active, onClick }: {
  cfg: PatternConfig;
  active: boolean;
  onClick: () => void;
}) {
  const bg = useMemo(() => generatePattern(cfg), [cfg]);
  return (
    <button
      onClick={onClick}
      style={{
        width: 52, height: 52, borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
        border: active ? '2px solid #6366f1' : '2px solid var(--border)',
        background: bg ? `${bg}, ${cfg.bgTransparent ? 'rgba(255,255,255,0.05)' : cfg.bg}` : 'rgba(255,255,255,0.05)',
        backgroundSize: `${cfg.size}px ${cfg.size}px`,
        boxShadow: active ? '0 0 0 1px #6366f1' : 'none',
        transition: 'all 0.15s',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(99,102,241,0.15)',
          borderRadius: 6,
        }} />
      )}
    </button>
  );
}

// ─── Slider control ───────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step, unit, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--subtle)', width: 64, flexShrink: 0 }}>{label}</div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
      />
      <div style={{ fontSize: 11, color: 'var(--text)', width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value}{unit ?? ''}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

const DEFAULT_CFG: PatternConfig = {
  type: 'dots',
  fg: '#6366f1',
  bg: '#ffffff',
  bgTransparent: true,
  size: 20,
  weight: 2,
  rotation: 0,
  opacity: 1,
  gap: 4,
};

// Dark-theme preset configs per pattern type
const PATTERN_DEFAULTS: Partial<Record<PatternType, Partial<PatternConfig>>> = {
  dots:         { size: 20, weight: 1.5 },
  grid:         { size: 24, weight: 0.5 },
  lines:        { size: 16, weight: 1, rotation: 0 },
  diagonal:     { size: 20, weight: 1 },
  cross:        { size: 28, weight: 0.8 },
  hexagonal:    { size: 30, weight: 1 },
  triangles:    { size: 28, weight: 1 },
  diamonds:     { size: 24, weight: 1 },
  waves:        { size: 20, weight: 1.5, gap: 8 },
  circuits:     { size: 48, weight: 1.5 },
  checkerboard: { size: 20, weight: 1 },
  plus:         { size: 24, weight: 1.5 },
  zigzag:       { size: 24, weight: 1.5 },
  noise:        { size: 40, weight: 2 },
};

export function PatternFillPanel({
  open,
  onClose,
  selectedShape,
  selectedShapeIds,
  onApplyToShape,
  onApplyToCanvas,
}: Props) {
  const [cfg, setCfg] = useState<PatternConfig>(DEFAULT_CFG);
  const [copied, setCopied] = useState(false);

  const patchCfg = useCallback((patch: Partial<PatternConfig>) => {
    setCfg(c => ({ ...c, ...patch }));
  }, []);

  const selectPattern = useCallback((type: PatternType) => {
    const defaults = PATTERN_DEFAULTS[type] ?? {};
    setCfg(c => ({ ...c, type, ...defaults }));
  }, []);

  const cssValue = useMemo(() => generatePattern(cfg), [cfg]);

  const bgCss = useMemo(() => {
    if (!cssValue) return 'transparent';
    const base = cfg.bgTransparent ? 'rgba(15,15,20,1)' : cfg.bg;
    return `${cssValue}, ${base}`;
  }, [cssValue, cfg.bg, cfg.bgTransparent]);

  const patternMeta = PATTERNS.find(p => p.type === cfg.type)!;

  const handleApplyToShape = useCallback(() => {
    const ids = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShape ? [selectedShape.id] : []);
    if (ids.length === 0) return;
    if (!cssValue) return;
    // We pass the full background shorthand; the caller should set it as imageUrl (data URI approach)
    // Build a full CSS background value
    const fullBg = `${cssValue}, ${cfg.bgTransparent ? 'transparent' : cfg.bg}`;
    onApplyToShape(ids, fullBg);
  }, [selectedShapeIds, selectedShape, cssValue, cfg.bg, cfg.bgTransparent, onApplyToShape]);

  const handleCopy = useCallback(() => {
    const css = `background: ${cssValue};\nbackground-size: ${cfg.size}px ${cfg.size}px;`;
    navigator.clipboard.writeText(css).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [cssValue, cfg.size]);

  const handleDownloadSvg = useCallback(() => {
    const svgContent = generatePattern({ ...cfg, bgTransparent: false });
    // Extract the raw SVG from the data URI
    const match = svgContent.match(/url\("data:image\/svg\+xml,(.+)"\)/);
    if (!match) return;
    const decoded = decodeURIComponent(match[1].replace(/'/g, '"'));
    const blob = new Blob([decoded], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${cfg.type}-pattern.svg`; a.click();
    URL.revokeObjectURL(url);
  }, [cfg]);

  if (!open) return null;

  const hasSelection = selectedShapeIds.length > 0 || selectedShape !== null;

  return (
    <div style={{
      position: 'fixed',
      top: 48,
      left: 56,
      width: 320,
      maxHeight: 'calc(100vh - 64px)',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 300,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⊞</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Pattern Fill</span>
        </div>
        <button onClick={onClose} style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={14} />
        </button>
      </div>

      {/* Live preview */}
      <div style={{
        height: 100, flexShrink: 0,
        background: bgCss,
        backgroundSize: `${cfg.size}px ${cfg.size}px`,
        borderBottom: '1px solid var(--border)',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          borderRadius: 6, padding: '4px 10px',
          fontSize: 11, color: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {cfg.size}px · {patternMeta?.label}
        </div>
      </div>

      {/* Pattern grid */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pattern Type
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PATTERNS.map(p => (
            <div key={p.type} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <PatternThumb
                cfg={{ ...cfg, type: p.type, ...(PATTERN_DEFAULTS[p.type] ?? {}) }}
                active={cfg.type === p.type}
                onClick={() => selectPattern(p.type)}
              />
              <div style={{ fontSize: 9, color: cfg.type === p.type ? '#a5b4fc' : 'var(--subtle)', textAlign: 'center' }}>
                {p.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Colors */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 4 }}>Foreground</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="color"
                value={cfg.fg}
                onChange={e => patchCfg({ fg: e.target.value })}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'none', padding: 1 }}
              />
              <input
                value={cfg.fg}
                onChange={e => patchCfg({ fg: e.target.value })}
                style={{ flex: 1, padding: '4px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, color: 'var(--text)', outline: 'none', fontFamily: 'monospace' }}
              />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              Background
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.bgTransparent} onChange={e => patchCfg({ bgTransparent: e.target.checked })} style={{ accentColor: '#6366f1' }} />
                <span style={{ fontSize: 10 }}>None</span>
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="color"
                value={cfg.bg}
                disabled={cfg.bgTransparent}
                onChange={e => patchCfg({ bg: e.target.value })}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: cfg.bgTransparent ? 'default' : 'pointer', background: 'none', padding: 1, opacity: cfg.bgTransparent ? 0.4 : 1 }}
              />
              <input
                value={cfg.bgTransparent ? 'transparent' : cfg.bg}
                disabled={cfg.bgTransparent}
                onChange={e => patchCfg({ bg: e.target.value })}
                style={{ flex: 1, padding: '4px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, color: 'var(--text)', outline: 'none', fontFamily: 'monospace', opacity: cfg.bgTransparent ? 0.4 : 1 }}
              />
            </div>
          </div>
        </div>

        <SliderRow label="Size" value={cfg.size} min={4} max={120} step={2} unit="px" onChange={v => patchCfg({ size: v })} />
        <SliderRow label="Weight" value={cfg.weight} min={0.5} max={8} step={0.5} unit="px" onChange={v => patchCfg({ weight: v })} />
        {patternMeta?.hasRotation && (
          <SliderRow label="Rotation" value={cfg.rotation} min={0} max={180} step={5} unit="°" onChange={v => patchCfg({ rotation: v })} />
        )}
        {patternMeta?.hasGap && (
          <SliderRow label="Gap" value={cfg.gap} min={0} max={32} step={1} unit="px" onChange={v => patchCfg({ gap: v })} />
        )}
        <SliderRow label="Opacity" value={Math.round(cfg.opacity * 100)} min={5} max={100} step={5} unit="%" onChange={v => patchCfg({ opacity: v / 100 })} />

        {/* CSS output */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CSS Output</div>
          <div style={{
            background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '8px 10px',
            fontFamily: 'monospace', fontSize: 10, color: '#94a3b8',
            lineHeight: 1.6, border: '1px solid var(--border)',
            position: 'relative',
          }}>
            <div style={{ overflow: 'hidden', maxHeight: 60 }}>
              {`background: ${cssValue};\nbackground-size: ${cfg.size}px ${cfg.size}px;`}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Apply to shape */}
        <button
          onClick={handleApplyToShape}
          disabled={!hasSelection}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: hasSelection ? '#6366f1' : 'rgba(255,255,255,0.06)',
            color: hasSelection ? '#fff' : 'var(--subtle)', border: 'none',
            cursor: hasSelection ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          Apply to {selectedShapeIds.length > 1 ? `${selectedShapeIds.length} shapes` : selectedShape ? 'selected shape' : 'selection'}
        </button>

        {/* Secondary actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onApplyToCanvas(cssValue ? `${cssValue}, ${cfg.bgTransparent ? 'rgba(0,0,0,0)' : cfg.bg}` : '')}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', color: 'var(--subtle)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            Set Canvas BG
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
              color: copied ? '#22c55e' : 'var(--subtle)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Copy size={11} /> {copied ? 'Copied!' : 'Copy CSS'}
          </button>
          <button
            onClick={handleDownloadSvg}
            style={{
              padding: '7px 10px', borderRadius: 7, fontSize: 11,
              background: 'rgba(255,255,255,0.04)', color: 'var(--subtle)',
              border: '1px solid var(--border)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            title="Download pattern as SVG"
          >
            <Download size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
