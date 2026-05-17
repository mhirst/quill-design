/**
 * SVGPatternLibrary — SVG background pattern generator
 *
 * Features:
 *  - 20+ geometric patterns: dots, lines, grid, chevron, triangles, hexagons,
 *    diamonds, waves, crosshatch, herringbone, bricks, isometric grid, etc.
 *  - Control: color, background color, size, spacing, rotation, opacity
 *  - Live preview at multiple canvas sizes
 *  - Export as SVG data-URI, CSS background-image, raw SVG string
 *  - Apply pattern as fill to selected shape
 *  - Copy CSS snippet to clipboard
 *  - ⌘⌥⇧W shortcut
 */

import React, { useState, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PatternType =
  | 'dots' | 'grid' | 'lines-h' | 'lines-v' | 'lines-diagonal'
  | 'crosshatch' | 'chevron' | 'triangles' | 'hexagons'
  | 'diamonds' | 'waves' | 'herringbone' | 'bricks'
  | 'isometric' | 'circles' | 'squares' | 'plus' | 'zigzag'
  | 'polka' | 'confetti';

export interface PatternConfig {
  type: PatternType;
  color: string;
  bgColor: string;
  size: number;       // base size in px (tile size)
  spacing: number;    // spacing between elements
  rotation: number;   // degrees
  opacity: number;    // 0..1
  strokeWidth: number;
}

// ── Utilities (exported for tests) ────────────────────────────────────────────

export const DEFAULT_PATTERN_CONFIG: PatternConfig = {
  type: 'dots',
  color: '#b5533c',
  bgColor: '#1a0a0a',
  size: 20,
  spacing: 4,
  rotation: 0,
  opacity: 1,
  strokeWidth: 1,
};

/** Escape a string for safe use in SVG attributes */
export function escapeSVGAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Generate an SVG pattern element string */
export function generatePatternSVG(config: PatternConfig): string {
  const { type, color, bgColor, size, spacing, strokeWidth, opacity } = config;
  const c = escapeSVGAttr(color);
  const bg = escapeSVGAttr(bgColor);
  const sw = strokeWidth;
  const s = size;
  const gap = spacing;

  switch (type) {
    case 'dots': {
      const r = (s - gap * 2) / 4;
      const tile = s;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}">
  <rect width="${tile}" height="${tile}" fill="${bg}" />
  <circle cx="${tile/2}" cy="${tile/2}" r="${Math.max(1, r)}" fill="${c}" opacity="${opacity}" />
</svg>`;
    }
    case 'grid': {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'lines-h': {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <line x1="0" y1="${s/2}" x2="${s}" y2="${s/2}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'lines-v': {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <line x1="${s/2}" y1="0" x2="${s/2}" y2="${s}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'lines-diagonal': {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <line x1="0" y1="${s}" x2="${s}" y2="0" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'crosshatch': {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <line x1="0" y1="${s}" x2="${s}" y2="0" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <line x1="0" y1="0" x2="${s}" y2="${s}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'chevron': {
      const h = s / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <polyline points="0,${h} ${s/2},0 ${s},${h}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <polyline points="0,${s} ${s/2},${h} ${s},${s}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'triangles': {
      const h2 = s * Math.sqrt(3) / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${h2.toFixed(1)}">
  <rect width="${s}" height="${h2}" fill="${bg}" />
  <polygon points="${s/2},0 ${s},${h2} 0,${h2}" fill="${c}" opacity="${opacity}" />
</svg>`;
    }
    case 'hexagons': {
      const a = s / 2;
      const h3 = a * Math.sqrt(3);
      const pts = [
        [a, 0], [s, h3/2], [s, h3 * 1.5], [a, h3 * 2], [0, h3 * 1.5], [0, h3/2]
      ].map(p => p.join(',')).join(' ');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${(h3*2).toFixed(1)}">
  <rect width="${s}" height="${(h3*2).toFixed(1)}" fill="${bg}" />
  <polygon points="${pts}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'diamonds': {
      const h4 = s;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${h4}">
  <rect width="${s}" height="${h4}" fill="${bg}" />
  <polygon points="${s/2},0 ${s},${h4/2} ${s/2},${h4} 0,${h4/2}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'waves': {
      const amp = s / 4;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s/2}">
  <rect width="${s}" height="${s/2}" fill="${bg}" />
  <path d="M 0 ${s/4} Q ${s/4} ${s/4 - amp} ${s/2} ${s/4} Q ${s*3/4} ${s/4 + amp} ${s} ${s/4}"
    fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'herringbone': {
      const h5 = s / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <line x1="0" y1="0" x2="${s/2}" y2="${h5}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <line x1="${s/2}" y1="${h5}" x2="${s}" y2="0" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <line x1="0" y1="${s}" x2="${s/2}" y2="${h5+s/2}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <line x1="${s/2}" y1="${h5+s/2}" x2="${s}" y2="${s}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'bricks': {
      const bw = s;
      const bh = s / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${bw*2}" height="${bh*2}">
  <rect width="${bw*2}" height="${bh*2}" fill="${bg}" />
  <rect x="0" y="0" width="${bw}" height="${bh}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <rect x="${bw}" y="0" width="${bw}" height="${bh}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <rect x="${bw/2}" y="${bh}" width="${bw}" height="${bh}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'isometric': {
      const h6 = s * Math.sqrt(3) / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s*2}" height="${(h6*2).toFixed(1)}">
  <rect width="${s*2}" height="${(h6*2).toFixed(1)}" fill="${bg}" />
  <line x1="0" y1="${h6}" x2="${s}" y2="0" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <line x1="${s}" y1="0" x2="${s*2}" y2="${h6}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <line x1="0" y1="${h6}" x2="${s*2}" y2="${h6}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <line x1="${s}" y1="${h6*2}" x2="${s*2}" y2="${h6}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
  <line x1="0" y1="${h6}" x2="${s}" y2="${h6*2}" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'circles': {
      const r2 = s / 2 - gap;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <circle cx="${s/2}" cy="${s/2}" r="${Math.max(1, r2)}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'squares': {
      const sq = s - gap * 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <rect x="${gap}" y="${gap}" width="${Math.max(1, sq)}" height="${Math.max(1, sq)}" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'plus': {
      const arm = s / 4;
      const center = s / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <path d="M ${center-arm} ${center} L ${center+arm} ${center} M ${center} ${center-arm} L ${center} ${center+arm}"
    stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'zigzag': {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s/2}">
  <rect width="${s}" height="${s/2}" fill="${bg}" />
  <polyline points="0,0 ${s/4},${s/2} ${s/2},0 ${s*3/4},${s/2} ${s},0"
    fill="none" stroke="${c}" stroke-width="${sw}" opacity="${opacity}" />
</svg>`;
    }
    case 'polka': {
      const r3 = s / 5;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  <circle cx="${s/4}" cy="${s/4}" r="${r3}" fill="${c}" opacity="${opacity}" />
  <circle cx="${s*3/4}" cy="${s*3/4}" r="${r3}" fill="${c}" opacity="${opacity}" />
</svg>`;
    }
    case 'confetti': {
      const items = [
        `<rect x="2" y="2" width="${s/6}" height="${s/10}" fill="${c}" opacity="${opacity}" transform="rotate(30 ${s/6} ${s/6})" />`,
        `<circle cx="${s*2/3}" cy="${s/3}" r="${s/10}" fill="${c}" opacity="${opacity*0.7}" />`,
        `<rect x="${s/2}" y="${s*2/3}" width="${s/8}" height="${s/8}" fill="${c}" opacity="${opacity*0.8}" transform="rotate(-20 ${s/2} ${s*2/3})" />`,
      ].join('\n  ');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${bg}" />
  ${items}
</svg>`;
    }
    default: return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/></svg>`;
  }
}

/** Convert SVG string to data URI */
export function svgToDataURI(svg: string): string {
  const encoded = encodeURIComponent(svg.trim());
  return `data:image/svg+xml,${encoded}`;
}

/** Generate CSS background-image property */
export function generateCSSBackground(config: PatternConfig): string {
  const svg = generatePatternSVG(config);
  const uri = svgToDataURI(svg);
  const rotate = config.rotation !== 0 ? `\n  transform: rotate(${config.rotation}deg);` : '';
  return `background-image: url("${uri}");
background-repeat: repeat;
background-size: ${config.size}px ${config.size}px;${rotate}`;
}

/** Get human-readable name for pattern type */
export function patternLabel(type: PatternType): string {
  const labels: Record<PatternType, string> = {
    dots: 'Dots', grid: 'Grid', 'lines-h': 'H Lines', 'lines-v': 'V Lines',
    'lines-diagonal': 'Diagonal', crosshatch: 'Crosshatch', chevron: 'Chevron',
    triangles: 'Triangles', hexagons: 'Hexagons', diamonds: 'Diamonds', waves: 'Waves',
    herringbone: 'Herringbone', bricks: 'Bricks', isometric: 'Isometric', circles: 'Circles',
    squares: 'Squares', plus: 'Plus', zigzag: 'Zigzag', polka: 'Polka', confetti: 'Confetti',
  };
  return labels[type] ?? type;
}

export const ALL_PATTERN_TYPES: PatternType[] = [
  'dots', 'grid', 'lines-h', 'lines-v', 'lines-diagonal', 'crosshatch',
  'chevron', 'triangles', 'hexagons', 'diamonds', 'waves', 'herringbone',
  'bricks', 'isometric', 'circles', 'squares', 'plus', 'zigzag', 'polka', 'confetti',
];

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed', top: 60, right: 380, width: 420,
  maxHeight: 'calc(100vh - 80px)',
  background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 12,
  boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
  display: 'flex', flexDirection: 'column',
  zIndex: 600, fontFamily: 'system-ui, sans-serif', color: '#e8d5d5', overflow: 'hidden',
};

const BTN_SM: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid #3a1a1a',
  background: '#2a1010', color: '#e8d5d5', fontSize: 12, cursor: 'pointer',
};

const BTN_ACCENT: React.CSSProperties = {
  ...BTN_SM, background: '#b5533c', border: '1px solid #c4644d', color: '#fff',
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
  color: '#9a7a7a', textTransform: 'uppercase' as const, marginBottom: 6,
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onApplyToShape: (patch: Partial<Shape>) => void;
}

export function SVGPatternLibrary({ open, onClose, selectedShape, onApplyToShape }: Props) {
  const [config, setConfig] = useState<PatternConfig>({ ...DEFAULT_PATTERN_CONFIG });
  const [copied, setCopied] = useState(false);
  const [exportMode, setExportMode] = useState<'css' | 'svg' | 'uri'>('css');

  if (!open) return null;

  const svg = useMemo(() => generatePatternSVG(config), [config]);
  const dataUri = useMemo(() => svgToDataURI(svg), [svg]);
  const css = useMemo(() => generateCSSBackground(config), [config]);

  const update = (patch: Partial<PatternConfig>) => setConfig(c => ({ ...c, ...patch }));

  const handleCopy = () => {
    const text = exportMode === 'css' ? css : exportMode === 'uri' ? dataUri : svg;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleApply = () => {
    if (!selectedShape) return;
    onApplyToShape({ fill: `url("${dataUri}")` } as Partial<Shape>);
  };

  const SLIDER_STYLE: React.CSSProperties = { width: '100%', accentColor: '#b5533c' };
  const INPUT_STYLE: React.CSSProperties = { ...BTN_SM, width: '100%', padding: '4px 8px', textAlign: 'right' as const };

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #3a1a1a', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>SVG Pattern Library</div>
          <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 1 }}>Background patterns · ⌘⌥⇧W</div>
        </div>
        <button onClick={onClose} style={{ ...BTN_SM, padding: '4px 8px', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
        {/* Preview */}
        <div style={{ marginBottom: 14 }}>
          <div style={SECTION_LABEL}>Preview</div>
          <div style={{
            width: '100%', height: 120, borderRadius: 8, border: '1px solid #3a1a1a',
            backgroundImage: `url("${dataUri}")`,
            backgroundRepeat: 'repeat',
            backgroundSize: `${config.size}px`,
            transform: config.rotation ? `rotate(${config.rotation}deg)` : undefined,
            overflow: 'hidden',
          }} />
        </div>

        {/* Pattern grid */}
        <div style={{ marginBottom: 14 }}>
          <div style={SECTION_LABEL}>Pattern ({ALL_PATTERN_TYPES.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
            {ALL_PATTERN_TYPES.map(type => {
              const previewSvg = generatePatternSVG({ ...config, type, size: 20 });
              const previewUri = svgToDataURI(previewSvg);
              return (
                <button
                  key={type}
                  onClick={() => update({ type })}
                  title={patternLabel(type)}
                  style={{
                    border: `2px solid ${config.type === type ? '#b5533c' : '#3a1a1a'}`,
                    borderRadius: 6,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    padding: 0,
                    background: 'none',
                  }}
                >
                  <div style={{
                    height: 36,
                    backgroundImage: `url("${previewUri}")`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '20px',
                  }} />
                  <div style={{
                    fontSize: 9, padding: '2px 3px', textAlign: 'center' as const,
                    color: config.type === type ? '#b5533c' : '#9a7a7a',
                    background: '#0d0505',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {patternLabel(type)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div style={{ marginBottom: 14 }}>
          <div style={SECTION_LABEL}>Controls</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ fontSize: 11, color: '#9a7a7a' }}>
              Foreground
              <input type="color" value={config.color} onChange={e => update({ color: e.target.value })}
                style={{ display: 'block', width: '100%', height: 28, marginTop: 3, borderRadius: 4, border: '1px solid #3a1a1a', cursor: 'pointer' }} />
            </label>
            <label style={{ fontSize: 11, color: '#9a7a7a' }}>
              Background
              <input type="color" value={config.bgColor} onChange={e => update({ bgColor: e.target.value })}
                style={{ display: 'block', width: '100%', height: 28, marginTop: 3, borderRadius: 4, border: '1px solid #3a1a1a', cursor: 'pointer' }} />
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            {[
              { label: `Size: ${config.size}px`, key: 'size', min: 8, max: 80, step: 2 },
              { label: `Spacing: ${config.spacing}px`, key: 'spacing', min: 0, max: 20, step: 1 },
              { label: `Stroke: ${config.strokeWidth}px`, key: 'strokeWidth', min: 0.5, max: 8, step: 0.5 },
              { label: `Rotation: ${config.rotation}°`, key: 'rotation', min: -90, max: 90, step: 5 },
              { label: `Opacity: ${(config.opacity * 100).toFixed(0)}%`, key: 'opacity', min: 0.05, max: 1, step: 0.05 },
            ].map(({ label, key, min, max, step }) => (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9a7a7a', marginBottom: 2 }}>
                  <span>{label}</span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={config[key as keyof PatternConfig] as number}
                  onChange={e => update({ [key]: Number(e.target.value) })}
                  style={SLIDER_STYLE}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Export */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={SECTION_LABEL}>Export</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['css', 'svg', 'uri'] as const).map(m => (
                <button key={m} onClick={() => setExportMode(m)} style={{
                  ...BTN_SM, fontSize: 10, padding: '2px 7px',
                  ...(exportMode === m ? { background: '#3a1a1a', color: '#b5533c', borderColor: '#b5533c44' } : {}),
                }}>
                  {m.toUpperCase()}
                </button>
              ))}
              <button onClick={handleCopy} style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px' }}>
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
          <pre style={{
            background: '#0d0505', border: '1px solid #3a1a1a', borderRadius: 6,
            padding: '8px 10px', fontSize: 10, color: '#c9b5b5', fontFamily: 'monospace',
            whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const, margin: 0,
            maxHeight: 100, overflowY: 'auto',
          }}>
            {exportMode === 'css' ? css : exportMode === 'uri' ? dataUri : svg.slice(0, 400) + (svg.length > 400 ? '...' : '')}
          </pre>
        </div>

        {/* Apply */}
        <button
          onClick={handleApply}
          disabled={!selectedShape}
          style={{
            ...BTN_ACCENT, width: '100%', padding: '8px', textAlign: 'center' as const,
            opacity: selectedShape ? 1 : 0.5, cursor: selectedShape ? 'pointer' : 'not-allowed',
            marginBottom: 4,
          }}
        >
          {selectedShape ? `Apply to "${selectedShape.name || selectedShape.type}"` : 'No shape selected'}
        </button>
      </div>
    </div>
  );
}
