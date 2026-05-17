import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShadowLayer {
  id: string;
  inset: boolean;
  x: number;       // px
  y: number;       // px
  blur: number;    // px
  spread: number;  // px
  color: string;   // hex
  opacity: number; // 0-100
  enabled: boolean;
}

export type ShadowPresetCategory = 'Material' | 'Elevation' | 'Soft' | 'Neumorphism' | 'Glow' | 'Custom';

export interface ShadowPreset {
  name: string;
  category: ShadowPresetCategory;
  layers: Omit<ShadowLayer, 'id'>[];
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _shadowCounter = 0;
export function shadowLayerId(): string { return `sl-${++_shadowCounter}`; }

// ─── CSS generation ───────────────────────────────────────────────────────────

export function layerToCSS(layer: ShadowLayer): string {
  if (!layer.enabled) return '';
  const { inset, x, y, blur, spread, color, opacity } = layer;
  const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
  const colorWithAlpha = color.length === 7 ? `${color}${alpha}` : color;
  const parts = [
    inset ? 'inset' : '',
    `${x}px`,
    `${y}px`,
    `${blur}px`,
    `${spread}px`,
    colorWithAlpha,
  ].filter(Boolean);
  return parts.join(' ');
}

export function buildBoxShadowCSS(layers: ShadowLayer[]): string {
  const parts = layers.filter(l => l.enabled).map(layerToCSS).filter(Boolean);
  return parts.length === 0 ? 'none' : parts.join(',\n  ');
}

export function buildFullCSSRule(layers: ShadowLayer[], selector = '.element'): string {
  const shadow = buildBoxShadowCSS(layers);
  return `${selector} {\n  box-shadow: ${shadow};\n}`;
}

export function hexWithOpacity(hex: string, opacity: number): string {
  const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
  return hex.length === 7 ? `${hex}${alpha}` : hex;
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export const SHADOW_PRESETS: ShadowPreset[] = [
  // Material Design elevations
  {
    name: 'Elevation 1', category: 'Material',
    layers: [
      { inset: false, x: 0, y: 1, blur: 3, spread: 0, color: '#000000', opacity: 12, enabled: true },
      { inset: false, x: 0, y: 1, blur: 2, spread: 0, color: '#000000', opacity: 24, enabled: true },
    ],
  },
  {
    name: 'Elevation 2', category: 'Material',
    layers: [
      { inset: false, x: 0, y: 3, blur: 6, spread: -1, color: '#000000', opacity: 12, enabled: true },
      { inset: false, x: 0, y: 3, blur: 4, spread: 0, color: '#000000', opacity: 17, enabled: true },
    ],
  },
  {
    name: 'Elevation 4', category: 'Material',
    layers: [
      { inset: false, x: 0, y: 6, blur: 12, spread: -2, color: '#000000', opacity: 15, enabled: true },
      { inset: false, x: 0, y: 4, blur: 8, spread: 0, color: '#000000', opacity: 20, enabled: true },
    ],
  },
  {
    name: 'Elevation 8', category: 'Material',
    layers: [
      { inset: false, x: 0, y: 12, blur: 24, spread: -4, color: '#000000', opacity: 20, enabled: true },
      { inset: false, x: 0, y: 8, blur: 16, spread: 0, color: '#000000', opacity: 25, enabled: true },
    ],
  },
  {
    name: 'Elevation 16', category: 'Material',
    layers: [
      { inset: false, x: 0, y: 24, blur: 48, spread: -8, color: '#000000', opacity: 25, enabled: true },
      { inset: false, x: 0, y: 16, blur: 32, spread: 0, color: '#000000', opacity: 30, enabled: true },
    ],
  },
  // Soft / Tailwind-style
  { name: 'sm', category: 'Soft', layers: [{ inset: false, x: 0, y: 1, blur: 2, spread: 0, color: '#000000', opacity: 5, enabled: true }, { inset: false, x: 0, y: 1, blur: 3, spread: 1, color: '#000000', opacity: 10, enabled: true }] },
  { name: 'md', category: 'Soft', layers: [{ inset: false, x: 0, y: 4, blur: 6, spread: -1, color: '#000000', opacity: 10, enabled: true }, { inset: false, x: 0, y: 2, blur: 4, spread: -1, color: '#000000', opacity: 6, enabled: true }] },
  { name: 'lg', category: 'Soft', layers: [{ inset: false, x: 0, y: 10, blur: 15, spread: -3, color: '#000000', opacity: 10, enabled: true }, { inset: false, x: 0, y: 4, blur: 6, spread: -2, color: '#000000', opacity: 5, enabled: true }] },
  { name: 'xl', category: 'Soft', layers: [{ inset: false, x: 0, y: 20, blur: 25, spread: -5, color: '#000000', opacity: 10, enabled: true }, { inset: false, x: 0, y: 8, blur: 10, spread: -6, color: '#000000', opacity: 4, enabled: true }] },
  { name: '2xl', category: 'Soft', layers: [{ inset: false, x: 0, y: 25, blur: 50, spread: -12, color: '#000000', opacity: 25, enabled: true }] },
  // Neumorphism
  {
    name: 'Neumorphic Light', category: 'Neumorphism',
    layers: [
      { inset: false, x: -6, y: -6, blur: 14, spread: 0, color: '#ffffff', opacity: 70, enabled: true },
      { inset: false, x: 6, y: 6, blur: 14, spread: 0, color: '#a3b1c6', opacity: 60, enabled: true },
    ],
  },
  {
    name: 'Neumorphic Dark', category: 'Neumorphism',
    layers: [
      { inset: false, x: -4, y: -4, blur: 10, spread: 0, color: '#2d2d3a', opacity: 50, enabled: true },
      { inset: false, x: 4, y: 4, blur: 10, spread: 0, color: '#0a0a14', opacity: 70, enabled: true },
    ],
  },
  {
    name: 'Pressed', category: 'Neumorphism',
    layers: [
      { inset: true, x: 2, y: 2, blur: 5, spread: 0, color: '#a3b1c6', opacity: 50, enabled: true },
      { inset: true, x: -2, y: -2, blur: 5, spread: 0, color: '#ffffff', opacity: 70, enabled: true },
    ],
  },
  // Glow effects
  { name: 'Blue Glow', category: 'Glow', layers: [{ inset: false, x: 0, y: 0, blur: 20, spread: 0, color: '#3b82f6', opacity: 60, enabled: true }, { inset: false, x: 0, y: 0, blur: 40, spread: 0, color: '#3b82f6', opacity: 30, enabled: true }] },
  { name: 'Purple Glow', category: 'Glow', layers: [{ inset: false, x: 0, y: 0, blur: 20, spread: 0, color: '#8b5cf6', opacity: 60, enabled: true }, { inset: false, x: 0, y: 0, blur: 40, spread: 0, color: '#8b5cf6', opacity: 30, enabled: true }] },
  { name: 'Green Glow', category: 'Glow', layers: [{ inset: false, x: 0, y: 0, blur: 20, spread: 0, color: '#10b981', opacity: 60, enabled: true }, { inset: false, x: 0, y: 0, blur: 40, spread: 0, color: '#10b981', opacity: 30, enabled: true }] },
  { name: 'Pink Glow', category: 'Glow', layers: [{ inset: false, x: 0, y: 0, blur: 20, spread: 0, color: '#ec4899', opacity: 60, enabled: true }, { inset: false, x: 0, y: 0, blur: 40, spread: 0, color: '#ec4899', opacity: 30, enabled: true }] },
  // Elevation
  { name: 'Float', category: 'Elevation', layers: [{ inset: false, x: 0, y: 8, blur: 30, spread: -10, color: '#000000', opacity: 40, enabled: true }] },
  { name: 'Hover', category: 'Elevation', layers: [{ inset: false, x: 0, y: 16, blur: 40, spread: -10, color: '#000000', opacity: 50, enabled: true }] },
  { name: 'Pressed', category: 'Elevation', layers: [{ inset: false, x: 0, y: 2, blur: 8, spread: -2, color: '#000000', opacity: 30, enabled: true }] },
  { name: 'Sharp', category: 'Elevation', layers: [{ inset: false, x: 4, y: 4, blur: 0, spread: 0, color: '#000000', opacity: 40, enabled: true }] },
];

// ─── Layer utilities ──────────────────────────────────────────────────────────

export function defaultLayer(): ShadowLayer {
  return {
    id: shadowLayerId(),
    inset: false,
    x: 0,
    y: 4,
    blur: 8,
    spread: 0,
    color: '#000000',
    opacity: 25,
    enabled: true,
  };
}

export function duplicateLayer(layer: ShadowLayer): ShadowLayer {
  return { ...layer, id: shadowLayerId() };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESET_CATS: ShadowPresetCategory[] = ['Material', 'Elevation', 'Soft', 'Neumorphism', 'Glow'];

export function ShadowBuilderPanel({ open, onClose }: Props) {
  const [layers, setLayers] = useState<ShadowLayer[]>([defaultLayer()]);
  const [selectedLayerIdx, setSelectedLayerIdx] = useState(0);
  const [catFilter, setCatFilter] = useState<ShadowPresetCategory>('Soft');
  const [copied, setCopied] = useState(false);
  const [bgColor, setBgColor] = useState('#1e293b');
  const [shapeColor, setShapeColor] = useState('#334155');

  if (!open) return null;

  const cssValue = useMemo(() => buildBoxShadowCSS(layers), [layers]);
  const fullCSS = useMemo(() => buildFullCSSRule(layers), [layers]);

  const addLayer = () => {
    const newLayer = defaultLayer();
    setLayers(l => [...l, newLayer]);
    setSelectedLayerIdx(layers.length);
  };

  const removeLayer = (idx: number) => {
    setLayers(l => l.filter((_, i) => i !== idx));
    setSelectedLayerIdx(Math.max(0, selectedLayerIdx - 1));
  };

  const updateLayer = <K extends keyof ShadowLayer>(idx: number, key: K, value: ShadowLayer[K]) => {
    setLayers(l => l.map((layer, i) => i === idx ? { ...layer, [key]: value } : layer));
  };

  const applyPreset = (preset: ShadowPreset) => {
    setLayers(preset.layers.map(l => ({ ...l, id: shadowLayerId() })));
    setSelectedLayerIdx(0);
  };

  const copyCSS = async () => {
    await navigator.clipboard.writeText(fullCSS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const selected = layers[selectedLayerIdx];

  const panel: React.CSSProperties = {
    position: 'fixed', top: 60, right: 16, width: 370,
    background: '#0c1018', border: '1px solid #1c2330',
    borderRadius: 12, zIndex: 1500, display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.7)', overflow: 'hidden',
    maxHeight: 'calc(100vh - 80px)',
  };

  const input: React.CSSProperties = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 5,
    color: '#e2e8f0', padding: '4px 7px', fontSize: 11, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #1c2330', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#7dd3fc' }}>◈ Shadow Builder</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
          {layers.length} layer{layers.length !== 1 ? 's' : ''} · {layers.filter(l => l.enabled).length} active
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Live preview */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1c2330', background: bgColor }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 110 }}>
            <div style={{
              width: 140, height: 80, background: shapeColor, borderRadius: 10,
              boxShadow: cssValue === 'none' ? 'none' : cssValue.replace(/\n\s*/g, ' '),
            }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <label style={{ fontSize: 10, color: '#475569' }}>BG</label>
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                style={{ width: 24, height: 20, border: '1px solid #334155', borderRadius: 3, cursor: 'pointer', padding: 1, background: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <label style={{ fontSize: 10, color: '#475569' }}>Shape</label>
              <input type="color" value={shapeColor} onChange={e => setShapeColor(e.target.value)}
                style={{ width: 24, height: 20, border: '1px solid #334155', borderRadius: 3, cursor: 'pointer', padding: 1, background: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Presets */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #1c2330' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 7, overflowX: 'auto' }}>
            {PRESET_CATS.map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{
                padding: '3px 8px', fontSize: 10, borderRadius: 5, flexShrink: 0,
                background: catFilter === cat ? '#0e2a3a' : '#1e293b',
                border: '1px solid ' + (catFilter === cat ? '#7dd3fc' : '#334155'),
                color: catFilter === cat ? '#7dd3fc' : '#64748b', cursor: 'pointer',
              }}>{cat}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {SHADOW_PRESETS.filter(p => p.category === catFilter).map(preset => (
              <button key={preset.name} onClick={() => applyPreset(preset)} style={{
                padding: '4px 8px', fontSize: 10, borderRadius: 5,
                background: '#1e293b', border: '1px solid #334155',
                color: '#94a3b8', cursor: 'pointer',
              }}>{preset.name}</button>
            ))}
          </div>
        </div>

        {/* Layer list */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #1c2330' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: '#475569' }}>LAYERS</span>
            <button onClick={addLayer} style={{
              padding: '3px 8px', fontSize: 10, borderRadius: 5,
              background: '#0e2a3a', border: '1px solid #7dd3fc',
              color: '#7dd3fc', cursor: 'pointer',
            }}>+ Add Layer</button>
          </div>
          {layers.map((layer, idx) => (
            <div
              key={layer.id}
              onClick={() => setSelectedLayerIdx(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                borderRadius: 6, cursor: 'pointer', marginBottom: 3,
                background: selectedLayerIdx === idx ? '#0e2a3a' : 'transparent',
                border: '1px solid ' + (selectedLayerIdx === idx ? '#7dd3fc' : 'transparent'),
              }}
            >
              <button
                onClick={e => { e.stopPropagation(); updateLayer(idx, 'enabled', !layer.enabled); }}
                style={{
                  width: 14, height: 14, borderRadius: 3, border: '1px solid #334155',
                  background: layer.enabled ? '#7dd3fc' : '#1e293b', cursor: 'pointer', padding: 0,
                }}
              />
              <div style={{ width: 16, height: 16, background: hexWithOpacity(layer.color, layer.opacity), borderRadius: 3, border: '1px solid #334155', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: layer.enabled ? '#e2e8f0' : '#475569' }}>
                {layer.inset ? 'inset ' : ''}{layer.x}px {layer.y}px {layer.blur}px
              </span>
              <button
                onClick={e => { e.stopPropagation(); setLayers(l => { const nl = [...l]; nl.splice(idx, 0, duplicateLayer(layer)); return nl; }); }}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}
              >⎘</button>
              <button
                onClick={e => { e.stopPropagation(); if (layers.length > 1) removeLayer(idx); }}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }}
              >×</button>
            </div>
          ))}
        </div>

        {/* Selected layer editor */}
        {selected && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1c2330' }}>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>LAYER {selectedLayerIdx + 1} SETTINGS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[
                { key: 'x' as const, label: 'X Offset', min: -50, max: 50 },
                { key: 'y' as const, label: 'Y Offset', min: -50, max: 50 },
                { key: 'blur' as const, label: 'Blur', min: 0, max: 100 },
                { key: 'spread' as const, label: 'Spread', min: -30, max: 50 },
              ].map(({ key, label, min, max }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 2 }}>{label} (px)</label>
                  <input type="range" min={min} max={max} value={selected[key]}
                    onChange={e => updateLayer(selectedLayerIdx, key, Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#7dd3fc', marginBottom: 2 }}
                  />
                  <div style={{ fontSize: 10, color: '#7dd3fc', textAlign: 'center', fontFamily: 'monospace' }}>
                    {selected[key]}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3 }}>Color</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="color" value={selected.color}
                    onChange={e => updateLayer(selectedLayerIdx, 'color', e.target.value)}
                    style={{ width: 32, height: 28, border: '1px solid #334155', borderRadius: 4, cursor: 'pointer', padding: 1, background: 'none' }}
                  />
                  <input type="text" value={selected.color}
                    onChange={e => updateLayer(selectedLayerIdx, 'color', e.target.value)}
                    style={{ ...input, flex: 1, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3 }}>Opacity ({selected.opacity}%)</label>
                <input type="range" min={0} max={100} value={selected.opacity}
                  onChange={e => updateLayer(selectedLayerIdx, 'opacity', Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#7dd3fc', marginTop: 6 }}
                />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#94a3b8' }}>
              <input type="checkbox" checked={selected.inset}
                onChange={e => updateLayer(selectedLayerIdx, 'inset', e.target.checked)}
                style={{ accentColor: '#7dd3fc' }}
              />
              Inset shadow
            </label>
          </div>
        )}

        {/* CSS output */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 5 }}>CSS OUTPUT</div>
          <pre style={{
            background: '#060a10', border: '1px solid #1c2330', borderRadius: 8,
            padding: '10px 12px', fontSize: 10, color: '#7dd3fc', fontFamily: 'monospace',
            overflowX: 'auto', margin: '0 0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{fullCSS}</pre>
          <button onClick={copyCSS} style={{
            width: '100%', padding: '8px 0',
            background: copied ? '#14532d' : '#1e293b',
            border: '1px solid ' + (copied ? '#10b981' : '#334155'),
            borderRadius: 8, color: copied ? '#6ee7b7' : '#94a3b8',
            fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
          }}>{copied ? '✓ Copied!' : 'Copy CSS'}</button>
        </div>
      </div>
    </div>
  );
}
