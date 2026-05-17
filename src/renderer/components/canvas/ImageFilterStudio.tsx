import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterConfig {
  blur: number;          // px (0-20)
  brightness: number;    // % (0-200)
  contrast: number;      // % (0-200)
  saturation: number;    // % (0-200)
  hueRotate: number;     // deg (0-360)
  sepia: number;         // % (0-100)
  grayscale: number;     // % (0-100)
  invert: number;        // % (0-100)
  opacity: number;       // % (0-100)
  dropShadowX: number;   // px
  dropShadowY: number;   // px
  dropShadowBlur: number;// px
  dropShadowColor: string;
}

export interface FilterPreset {
  name: string;
  category: string;
  config: Partial<FilterConfig>;
  emoji?: string;
}

export const DEFAULT_FILTER: FilterConfig = {
  blur: 0, brightness: 100, contrast: 100, saturation: 100,
  hueRotate: 0, sepia: 0, grayscale: 0, invert: 0, opacity: 100,
  dropShadowX: 0, dropShadowY: 0, dropShadowBlur: 0, dropShadowColor: '#000000',
};

// ─── CSS generation ───────────────────────────────────────────────────────────

export function buildFilterCSS(config: FilterConfig, omitDefaults = false): string {
  const parts: string[] = [];

  if (!omitDefaults || config.blur !== 0)
    parts.push(`blur(${config.blur}px)`);
  if (!omitDefaults || config.brightness !== 100)
    parts.push(`brightness(${config.brightness}%)`);
  if (!omitDefaults || config.contrast !== 100)
    parts.push(`contrast(${config.contrast}%)`);
  if (!omitDefaults || config.saturation !== 100)
    parts.push(`saturate(${config.saturation}%)`);
  if (!omitDefaults || config.hueRotate !== 0)
    parts.push(`hue-rotate(${config.hueRotate}deg)`);
  if (!omitDefaults || config.sepia !== 0)
    parts.push(`sepia(${config.sepia}%)`);
  if (!omitDefaults || config.grayscale !== 0)
    parts.push(`grayscale(${config.grayscale}%)`);
  if (!omitDefaults || config.invert !== 0)
    parts.push(`invert(${config.invert}%)`);
  if (config.dropShadowBlur > 0 || config.dropShadowX !== 0 || config.dropShadowY !== 0)
    parts.push(`drop-shadow(${config.dropShadowX}px ${config.dropShadowY}px ${config.dropShadowBlur}px ${config.dropShadowColor})`);

  return parts.length === 0 ? 'none' : parts.join(' ');
}

export function buildCompactFilterCSS(config: FilterConfig): string {
  const parts: string[] = [];
  if (config.blur !== 0) parts.push(`blur(${config.blur}px)`);
  if (config.brightness !== 100) parts.push(`brightness(${config.brightness}%)`);
  if (config.contrast !== 100) parts.push(`contrast(${config.contrast}%)`);
  if (config.saturation !== 100) parts.push(`saturate(${config.saturation}%)`);
  if (config.hueRotate !== 0) parts.push(`hue-rotate(${config.hueRotate}deg)`);
  if (config.sepia !== 0) parts.push(`sepia(${config.sepia}%)`);
  if (config.grayscale !== 0) parts.push(`grayscale(${config.grayscale}%)`);
  if (config.invert !== 0) parts.push(`invert(${config.invert}%)`);
  if (config.dropShadowBlur > 0 || config.dropShadowX !== 0 || config.dropShadowY !== 0)
    parts.push(`drop-shadow(${config.dropShadowX}px ${config.dropShadowY}px ${config.dropShadowBlur}px ${config.dropShadowColor})`);
  return parts.length === 0 ? 'none' : parts.join('\n  ');
}

export function buildFullCSS(config: FilterConfig, selector = '.element'): string {
  const filter = buildCompactFilterCSS(config);
  const lines = [`${selector} {`, `  filter: ${filter};`];
  if (config.opacity !== 100) lines.push(`  opacity: ${(config.opacity / 100).toFixed(2)};`);
  lines.push('}');
  return lines.join('\n');
}

export function isDefaultFilter(config: FilterConfig): boolean {
  return config.blur === 0 && config.brightness === 100 && config.contrast === 100 &&
    config.saturation === 100 && config.hueRotate === 0 && config.sepia === 0 &&
    config.grayscale === 0 && config.invert === 0 && config.opacity === 100 &&
    config.dropShadowX === 0 && config.dropShadowY === 0 && config.dropShadowBlur === 0;
}

export function mergeFilter(base: FilterConfig, patch: Partial<FilterConfig>): FilterConfig {
  return { ...base, ...patch };
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export const FILTER_PRESETS: FilterPreset[] = [
  // Vintage
  { name: 'Sepia', category: 'Vintage', emoji: '🟤', config: { sepia: 100, contrast: 110, brightness: 90 } },
  { name: 'Faded', category: 'Vintage', emoji: '🌅', config: { brightness: 120, contrast: 80, saturation: 80, sepia: 20 } },
  { name: 'Aged', category: 'Vintage', emoji: '📷', config: { sepia: 60, contrast: 90, brightness: 95, saturation: 70 } },
  // Mono
  { name: 'B&W', category: 'Mono', emoji: '⬛', config: { grayscale: 100 } },
  { name: 'High Contrast B&W', category: 'Mono', emoji: '◼', config: { grayscale: 100, contrast: 180 } },
  { name: 'Muted', category: 'Mono', emoji: '🩶', config: { grayscale: 60, brightness: 105 } },
  // Creative
  { name: 'Neon', category: 'Creative', emoji: '🌈', config: { saturation: 200, brightness: 120, contrast: 130 } },
  { name: 'Dreamy', category: 'Creative', emoji: '💭', config: { blur: 2, brightness: 115, saturation: 140 } },
  { name: 'Psychedelic', category: 'Creative', emoji: '🎨', config: { hueRotate: 180, saturation: 200, contrast: 120 } },
  { name: 'Inverted', category: 'Creative', emoji: '🔄', config: { invert: 100 } },
  { name: 'X-Ray', category: 'Creative', emoji: '🩻', config: { invert: 100, grayscale: 100, contrast: 150 } },
  // Photo
  { name: 'Clarity', category: 'Photo', emoji: '✨', config: { contrast: 120, saturation: 115, brightness: 105 } },
  { name: 'Cool', category: 'Photo', emoji: '🔵', config: { hueRotate: 20, saturation: 110, brightness: 105 } },
  { name: 'Warm', category: 'Photo', emoji: '🟠', config: { hueRotate: -20, saturation: 120, brightness: 110 } },
  { name: 'Sunset', category: 'Photo', emoji: '🌇', config: { hueRotate: 30, saturation: 150, brightness: 115, contrast: 110 } },
  { name: 'Underwater', category: 'Photo', emoji: '🌊', config: { hueRotate: 180, saturation: 130, brightness: 90 } },
  // Blur
  { name: 'Soft Blur', category: 'Blur', emoji: '🌫️', config: { blur: 3 } },
  { name: 'Heavy Blur', category: 'Blur', emoji: '💨', config: { blur: 8 } },
  { name: 'Frosted Glass', category: 'Blur', emoji: '🪟', config: { blur: 6, brightness: 110, saturation: 120 } },
];

// ─── Slider helper ────────────────────────────────────────────────────────────

export function filterDiffCount(config: FilterConfig): number {
  return [
    config.blur !== 0, config.brightness !== 100, config.contrast !== 100,
    config.saturation !== 100, config.hueRotate !== 0, config.sepia !== 0,
    config.grayscale !== 0, config.invert !== 0, config.opacity !== 100,
    config.dropShadowBlur > 0 || config.dropShadowX !== 0 || config.dropShadowY !== 0,
  ].filter(Boolean).length;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESET_CATEGORIES = ['Vintage', 'Mono', 'Creative', 'Photo', 'Blur'];

export function ImageFilterStudio({ open, onClose }: Props) {
  const [config, setConfig] = useState<FilterConfig>(DEFAULT_FILTER);
  const [catFilter, setCatFilter] = useState('Vintage');
  const [copied, setCopied] = useState(false);
  const [previewImage, setPreviewImage] = useState<'gradient' | 'shapes' | 'text'>('gradient');

  if (!open) return null;

  const set = <K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) =>
    setConfig(c => ({ ...c, [key]: value }));

  const applyPreset = (preset: FilterPreset) => {
    setConfig(c => mergeFilter({ ...DEFAULT_FILTER }, preset.config as FilterConfig));
  };

  const reset = () => setConfig(DEFAULT_FILTER);

  const cssValue = useMemo(() => buildCompactFilterCSS(config), [config]);
  const fullCSS = useMemo(() => buildFullCSS(config), [config]);
  const diffCount = useMemo(() => filterDiffCount(config), [config]);

  const filterStyle = buildFilterCSS(config);
  const opacityStyle = config.opacity !== 100 ? config.opacity / 100 : undefined;

  const copyCSS = async () => {
    await navigator.clipboard.writeText(fullCSS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const panel: React.CSSProperties = {
    position: 'fixed', top: 60, right: 16, width: 370,
    background: '#0d1117', border: '1px solid #21262d',
    borderRadius: 12, zIndex: 1500, display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.7)', overflow: 'hidden',
    maxHeight: 'calc(100vh - 80px)',
  };

  const sliderRow = (
    label: string,
    key: keyof FilterConfig,
    min: number, max: number, step = 1,
    defaultVal: number,
    unit: string
  ) => {
    const val = config[key] as number;
    const isChanged = val !== defaultVal;
    return (
      <div key={key} style={{ padding: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <label style={{ fontSize: 11, color: isChanged ? '#f472b6' : '#64748b' }}>{label}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: isChanged ? '#f472b6' : '#94a3b8', fontFamily: 'monospace' }}>
              {typeof val === 'number' ? val.toFixed(step < 1 ? 1 : 0) : val}{unit}
            </span>
            {isChanged && (
              <button onClick={() => set(key, defaultVal as FilterConfig[typeof key])} style={{
                background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 10, padding: 0,
              }}>↺</button>
            )}
          </div>
        </div>
        <input
          type="range" min={min} max={max} step={step}
          value={val}
          onChange={e => set(key, Number(e.target.value) as FilterConfig[typeof key])}
          style={{ width: '100%', accentColor: isChanged ? '#f472b6' : '#334155' }}
        />
      </div>
    );
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #21262d', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#f472b6' }}>✦ Image Filter Studio</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {diffCount > 0 && (
              <button onClick={reset} style={{
                padding: '3px 8px', fontSize: 10, borderRadius: 5, cursor: 'pointer',
                background: '#1e293b', border: '1px solid #334155', color: '#94a3b8',
              }}>Reset ({diffCount})</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Preview */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #21262d' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
            {(['gradient', 'shapes', 'text'] as const).map(t => (
              <button key={t} onClick={() => setPreviewImage(t)} style={{
                flex: 1, padding: '4px 0', fontSize: 10, borderRadius: 5,
                background: previewImage === t ? '#1e293b' : 'transparent',
                border: '1px solid ' + (previewImage === t ? '#f472b6' : 'transparent'),
                color: previewImage === t ? '#f472b6' : '#64748b', cursor: 'pointer',
              }}>{t}</button>
            ))}
          </div>
          <div style={{
            height: 120, borderRadius: 8, overflow: 'hidden',
            border: '1px solid #21262d', position: 'relative',
          }}>
            <div style={{
              width: '100%', height: '100%',
              filter: filterStyle,
              opacity: opacityStyle,
            }}>
              {previewImage === 'gradient' && (
                <div style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 33%, #f59e0b 66%, #10b981 100%)',
                }} />
              )}
              {previewImage === 'shapes' && (
                <div style={{ width: '100%', height: '100%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <div style={{ width: 60, height: 60, background: '#6366f1', borderRadius: 8 }} />
                  <div style={{ width: 60, height: 60, background: '#ec4899', borderRadius: '50%' }} />
                  <div style={{ width: 0, height: 0, borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: '52px solid #f59e0b' }} />
                </div>
              )}
              {previewImage === 'text' && (
                <div style={{ width: '100%', height: '100%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', letterSpacing: -1 }}>Quill</div>
                  <div style={{ fontSize: 14, color: '#94a3b8' }}>Design Tool</div>
                  <div style={{ width: 80, height: 3, background: 'linear-gradient(90deg, #6366f1, #ec4899)', borderRadius: 2, marginTop: 4 }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Presets */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #21262d' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 7, overflowX: 'auto' }}>
            {PRESET_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{
                padding: '3px 8px', fontSize: 10, borderRadius: 5, flexShrink: 0,
                background: catFilter === cat ? '#1e293b' : 'transparent',
                border: '1px solid ' + (catFilter === cat ? '#f472b6' : 'transparent'),
                color: catFilter === cat ? '#f472b6' : '#64748b', cursor: 'pointer',
              }}>{cat}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {FILTER_PRESETS.filter(p => p.category === catFilter).map(preset => (
              <button key={preset.name} onClick={() => applyPreset(preset)} style={{
                padding: '5px 8px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                background: '#161b22', border: '1px solid #21262d', color: '#94a3b8',
              }}>
                {preset.emoji} {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #21262d' }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>ADJUSTMENTS</div>
          {sliderRow('Blur', 'blur', 0, 20, 1, 0, 'px')}
          {sliderRow('Brightness', 'brightness', 0, 200, 1, 100, '%')}
          {sliderRow('Contrast', 'contrast', 0, 200, 1, 100, '%')}
          {sliderRow('Saturation', 'saturation', 0, 200, 1, 100, '%')}
          {sliderRow('Hue Rotate', 'hueRotate', 0, 360, 1, 0, '°')}
          {sliderRow('Sepia', 'sepia', 0, 100, 1, 0, '%')}
          {sliderRow('Grayscale', 'grayscale', 0, 100, 1, 0, '%')}
          {sliderRow('Invert', 'invert', 0, 100, 1, 0, '%')}
          {sliderRow('Opacity', 'opacity', 0, 100, 1, 100, '%')}
        </div>

        {/* Drop shadow */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #21262d' }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>DROP SHADOW</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            {[
              { key: 'dropShadowX' as const, label: 'X' },
              { key: 'dropShadowY' as const, label: 'Y' },
              { key: 'dropShadowBlur' as const, label: 'Blur' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 2 }}>{label} (px)</label>
                <input type="number" value={config[key]} onChange={e => set(key, Number(e.target.value))}
                  style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 4, color: '#e2e8f0', padding: '4px 6px', fontSize: 11, width: '100%', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            ))}
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3 }}>Shadow Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={config.dropShadowColor} onChange={e => set('dropShadowColor', e.target.value)}
                style={{ width: 36, height: 28, border: '1px solid #21262d', borderRadius: 4, cursor: 'pointer', padding: 2, background: '#161b22' }}
              />
              <input type="text" value={config.dropShadowColor} onChange={e => set('dropShadowColor', e.target.value)}
                style={{ flex: 1, background: '#161b22', border: '1px solid #21262d', borderRadius: 4, color: '#e2e8f0', padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* CSS output */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 5 }}>CSS OUTPUT</div>
          <pre style={{
            background: '#0a0d12', border: '1px solid #21262d', borderRadius: 8,
            padding: '10px 12px', fontSize: 10, color: '#f472b6', fontFamily: 'monospace',
            overflowX: 'auto', margin: '0 0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>{fullCSS}</pre>
          <button onClick={copyCSS} style={{
            width: '100%', padding: '8px 0',
            background: copied ? '#14532d' : '#161b22',
            border: '1px solid ' + (copied ? '#10b981' : '#21262d'),
            borderRadius: 8, color: copied ? '#6ee7b7' : '#94a3b8',
            fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
          }}>{copied ? '✓ Copied!' : 'Copy CSS'}</button>
        </div>
      </div>
    </div>
  );
}
