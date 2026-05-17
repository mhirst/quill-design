import React, { useState, useCallback, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MixMode = 'rgb' | 'hsl' | 'oklch' | 'lab';

export interface RGBColor { r: number; g: number; b: number; }   // 0-255
export interface HSLColor { h: number; s: number; l: number; }   // 0-360, 0-100, 0-100
export interface OKLabColor { L: number; a: number; b: number; }  // perceptual

export interface MixResult {
  hex: string;
  rgb: RGBColor;
  hsl: HSLColor;
  t: number; // mix weight 0-1
}

export interface MixPreset {
  name: string;
  colorA: string;
  colorB: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const MIX_PRESETS: MixPreset[] = [
  { name: 'Sunrise', colorA: '#ff6b35', colorB: '#ffd166' },
  { name: 'Ocean', colorA: '#023e8a', colorB: '#48cae4' },
  { name: 'Forest', colorA: '#1b4332', colorB: '#95d5b2' },
  { name: 'Dusk', colorA: '#7b2d8b', colorB: '#ff6b9d' },
  { name: 'Monochrome', colorA: '#0f172a', colorB: '#f8fafc' },
  { name: 'Candy', colorA: '#ff006e', colorB: '#ffbe0b' },
  { name: 'Ice', colorA: '#e0f2fe', colorB: '#0369a1' },
  { name: 'Earth', colorA: '#7c4a03', colorB: '#d4a574' },
];

export const MIX_MODE_LABELS: Record<MixMode, string> = {
  rgb: 'RGB Linear',
  hsl: 'HSL',
  oklch: 'OKLCH (Perceptual)',
  lab: 'OKLab',
};

// ── Pure colour math (exported for tests) ────────────────────────────────────

export function hexToRGB(hex: string): RGBColor {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
}

export function rgbToHex(rgb: RGBColor): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return '#' + [rgb.r, rgb.g, rgb.b].map(c => clamp(c).toString(16).padStart(2, '0')).join('');
}

export function rgbToHSL(rgb: RGBColor): HSLColor {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRGB(hsl: HSLColor): RGBColor {
  const { h, s, l } = hsl;
  const sn = s / 100, ln = l / 100;
  if (s === 0) { const v = Math.round(ln * 255); return { r: v, g: v, b: v }; }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hk = h / 360;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(hk + 1/3) * 255),
    g: Math.round(hue2rgb(hk) * 255),
    b: Math.round(hue2rgb(hk - 1/3) * 255),
  };
}

// sRGB → linear
function linearize(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function delinearize(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1/2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

// RGB → OKLab (simplified but accurate)
export function rgbToOKLab(rgb: RGBColor): OKLabColor {
  const lr = linearize(rgb.r), lg = linearize(rgb.g), lb = linearize(rgb.b);
  // sRGB → XYZ D65 (standard matrix)
  const X = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const Y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  const Z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;
  // XYZ → OKLab (Björn Ottosson's method via LMS intermediate)
  const l = Math.cbrt(0.8189330101 * X + 0.3618667424 * Y - 0.1288597137 * Z);
  const m = Math.cbrt(0.0329845436 * X + 0.9293118715 * Y + 0.0361456387 * Z);
  const s = Math.cbrt(0.0482003018 * X + 0.2643662691 * Y + 0.6338517070 * Z);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

export function okLabToRGB(lab: OKLabColor): RGBColor {
  const l = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s = lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b;
  const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
  const X = 1.2270138511 * l3 - 0.5577999807 * m3 + 0.2812561490 * s3;
  const Y = -0.0405801784 * l3 + 1.1122568696 * m3 - 0.0716766787 * s3;
  const Z = -0.0763812845 * l3 - 0.4214819784 * m3 + 1.5861632204 * s3;
  const lr =  3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const lg = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
  const lb =  0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  return { r: delinearize(lr), g: delinearize(lg), b: delinearize(lb) };
}

export function mixRGB(a: RGBColor, b: RGBColor, t: number): RGBColor {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

export function mixHSL(a: HSLColor, b: HSLColor, t: number): HSLColor {
  // Hue interpolation: take shortest arc
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = (a.h + dh * t + 360) % 360;
  return {
    h: Math.round(h),
    s: Math.round(a.s + (b.s - a.s) * t),
    l: Math.round(a.l + (b.l - a.l) * t),
  };
}

export function mixOKLab(hexA: string, hexB: string, t: number): RGBColor {
  const labA = rgbToOKLab(hexToRGB(hexA));
  const labB = rgbToOKLab(hexToRGB(hexB));
  const mixed: OKLabColor = {
    L: labA.L + (labB.L - labA.L) * t,
    a: labA.a + (labB.a - labA.a) * t,
    b: labA.b + (labB.b - labA.b) * t,
  };
  return okLabToRGB(mixed);
}

export function generateMixSteps(hexA: string, hexB: string, steps: number, mode: MixMode): MixResult[] {
  const rgbA = hexToRGB(hexA);
  const rgbB = hexToRGB(hexB);
  const hslA = rgbToHSL(rgbA);
  const hslB = rgbToHSL(rgbB);
  const results: MixResult[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0.5 : i / steps;
    let rgb: RGBColor;
    switch (mode) {
      case 'rgb': rgb = mixRGB(rgbA, rgbB, t); break;
      case 'hsl': rgb = hslToRGB(mixHSL(hslA, hslB, t)); break;
      case 'oklch':
      case 'lab': rgb = mixOKLab(hexA, hexB, t); break;
    }
    results.push({ hex: rgbToHex(rgb), rgb, hsl: rgbToHSL(rgb), t });
  }
  return results;
}

export function relativeLuminance(rgb: RGBColor): number {
  const chan = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

export function contrastRatio(a: RGBColor, b: RGBColor): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const bright = Math.max(la, lb), dark = Math.min(la, lb);
  return (bright + 0.05) / (dark + 0.05);
}

export function contrastLabel(ratio: number): string {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

export function hexToHSLString(hex: string): string {
  const hsl = rgbToHSL(hexToRGB(hex));
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

export function hexToRGBString(hex: string): string {
  const { r, g, b } = hexToRGB(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onPickColor?: (hex: string) => void;
}

type TabId = 'mixer' | 'swatch' | 'harmony';

export function ColorMixingPanel({ open, onClose, onPickColor }: Props) {
  const [colorA, setColorA] = useState('#3b82f6');
  const [colorB, setColorB] = useState('#ec4899');
  const [steps, setSteps] = useState(8);
  const [mixMode, setMixMode] = useState<MixMode>('oklch');
  const [tab, setTab] = useState<TabId>('mixer');
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const mixResults = useMemo(
    () => generateMixSteps(colorA, colorB, steps, mixMode),
    [colorA, colorB, steps, mixMode]
  );

  const handleCopy = useCallback((hex: string) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
    });
  }, []);

  const loadPreset = useCallback((p: MixPreset) => {
    setColorA(p.colorA);
    setColorB(p.colorB);
  }, []);

  if (!open) return null;

  const panelBg = '#1e1e2e';
  const surface = '#2a2a3e';
  const border = '#3a3a55';
  const accent = '#ec4899';
  const textPrimary = '#e2e8f0';
  const textMuted = '#94a3b8';

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', background: active ? accent : 'transparent',
    color: active ? '#fff' : textMuted, border: 'none', transition: 'all 0.15s',
  });

  const INPUT_STYLE: React.CSSProperties = {
    background: surface, border: `1px solid ${border}`, borderRadius: 6,
    color: textPrimary, fontSize: 12, padding: '4px 8px', outline: 'none',
  };

  const rgbA = hexToRGB(colorA);
  const rgbB = hexToRGB(colorB);
  const contrast = contrastRatio(rgbA, rgbB);
  const hslA = rgbToHSL(rgbA);
  const hslB = rgbToHSL(rgbB);

  // Swatch blend: compare across all 4 modes at 0.5
  const allModeBlends: { mode: MixMode; hex: string }[] = (['rgb', 'hsl', 'oklch', 'lab'] as MixMode[]).map(m => ({
    mode: m,
    hex: generateMixSteps(colorA, colorB, 1, m)[Math.round(steps / 2) === 0 ? 0 : 0].hex,
  }));

  return (
    <div style={{
      position: 'fixed', right: 16, top: 60, width: 400,
      maxHeight: 'calc(100vh - 80px)', background: panelBg,
      border: `1px solid ${border}`, borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', zIndex: 9021,
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px', borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>Color Mixer</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            Blend two colors across color spaces
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: textMuted,
          cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
        }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 16px',
        borderBottom: `1px solid ${border}`, flexShrink: 0,
      }}>
        {(['mixer', 'swatch', 'harmony'] as TabId[]).map(t => (
          <button key={t} style={TAB_STYLE(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Color pickers */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${border}`,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        flexShrink: 0, background: '#1a1a2e',
      }}>
        {[
          { label: 'Color A', hex: colorA, set: setColorA },
          { label: 'Color B', hex: colorB, set: setColorB },
        ].map(({ label, hex, set }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', width: 36, height: 28, flexShrink: 0 }}>
                <div style={{
                  width: 36, height: 28, borderRadius: 6, background: hex,
                  border: `2px solid ${border}`, cursor: 'pointer',
                }} />
                <input
                  type="color" value={hex}
                  onChange={e => set(e.target.value)}
                  style={{
                    position: 'absolute', inset: 0, opacity: 0,
                    width: '100%', height: '100%', cursor: 'pointer', border: 'none',
                  }}
                />
              </div>
              <input
                type="text" value={hex}
                onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) set(e.target.value); }}
                style={{ ...INPUT_STYLE, flex: 1, fontFamily: 'monospace' }}
                maxLength={7}
              />
            </div>
            <div style={{ marginTop: 4, fontSize: 10, color: textMuted }}>
              {hexToHSLString(hex)}
            </div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── Mixer Tab ── */}
        {tab === 'mixer' && (
          <div>
            {/* Mode + Steps controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>Mix mode</div>
                <select
                  value={mixMode}
                  onChange={e => setMixMode(e.target.value as MixMode)}
                  style={{ ...INPUT_STYLE, width: '100%', cursor: 'pointer' }}
                >
                  {(Object.keys(MIX_MODE_LABELS) as MixMode[]).map(m => (
                    <option key={m} value={m}>{MIX_MODE_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>Steps</div>
                <input
                  type="number" min={2} max={20} step={1} value={steps}
                  onChange={e => setSteps(Number(e.target.value))}
                  style={{ ...INPUT_STYLE, width: 64 }}
                />
              </div>
            </div>

            {/* Gradient strip */}
            <div style={{
              height: 56, borderRadius: 10, overflow: 'hidden',
              display: 'flex', marginBottom: 10,
              border: `1px solid ${border}`,
              background: `linear-gradient(to right, ${colorA}, ${colorB})`,
            }} />

            {/* Swatch row */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {mixResults.map((r, i) => (
                <div
                  key={i}
                  title={`${r.hex}\nClick to copy${onPickColor ? '\nCtrl+click to use' : ''}`}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) { onPickColor?.(r.hex); }
                    else { handleCopy(r.hex); }
                  }}
                  style={{
                    flex: 1, height: 48, borderRadius: 6,
                    background: r.hex,
                    cursor: 'pointer',
                    border: copiedHex === r.hex ? '2px solid #fff' : `1px solid ${border}`,
                    transition: 'transform 0.1s',
                    transform: copiedHex === r.hex ? 'scale(1.05)' : 'scale(1)',
                  }}
                />
              ))}
            </div>

            {/* Swatch labels */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {mixResults.map((r, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: textMuted, fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
                    {r.hex.slice(1).toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Contrast info */}
            <div style={{
              background: surface, border: `1px solid ${border}`, borderRadius: 8,
              padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 12, color: textPrimary, fontWeight: 500 }}>A vs B contrast</div>
                <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{contrast.toFixed(2)}:1</div>
              </div>
              <div style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: contrast >= 4.5 ? '#22c55e22' : contrast >= 3 ? '#eab30822' : '#ef444422',
                color: contrast >= 4.5 ? '#22c55e' : contrast >= 3 ? '#eab308' : '#ef4444',
                border: `1px solid currentColor`,
              }}>
                {contrastLabel(contrast)}
              </div>
            </div>

            {/* Presets */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: textMuted, marginBottom: 8 }}>Presets</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {MIX_PRESETS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => loadPreset(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', borderRadius: 6,
                      background: surface, border: `1px solid ${border}`,
                      color: textPrimary, cursor: 'pointer', fontSize: 11,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 2 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: p.colorA }} />
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: p.colorB }} />
                    </div>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Swatch Tab (compare modes) ── */}
        {tab === 'swatch' && (
          <div>
            <div style={{ marginBottom: 12, fontSize: 12, color: textMuted }}>
              Compare how different color spaces interpolate the same two colors.
            </div>

            {(['rgb', 'hsl', 'oklch', 'lab'] as MixMode[]).map(mode => {
              const modeResults = generateMixSteps(colorA, colorB, 9, mode);
              return (
                <div key={mode} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 6,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {MIX_MODE_LABELS[mode]}
                  </div>
                  <div style={{ display: 'flex', gap: 3, height: 36 }}>
                    {modeResults.map((r, i) => (
                      <div
                        key={i}
                        onClick={() => handleCopy(r.hex)}
                        title={r.hex}
                        style={{
                          flex: 1, borderRadius: 4, background: r.hex,
                          cursor: 'pointer', border: `1px solid ${border}`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            <div style={{
              background: surface, border: `1px solid ${border}`, borderRadius: 8,
              padding: 12, fontSize: 11, color: textMuted, lineHeight: 1.6,
            }}>
              <strong style={{ color: textPrimary }}>OKLCH / OKLab</strong> produce perceptually uniform blends with
              consistent apparent lightness. <strong style={{ color: textPrimary }}>HSL</strong> can produce vibrant mid-point
              hues. <strong style={{ color: textPrimary }}>RGB</strong> is the most predictable for UI.
            </div>
          </div>
        )}

        {/* ── Harmony Tab ── */}
        {tab === 'harmony' && (
          <div>
            {[colorA, colorB].map((hex, ci) => {
              const rgb = hexToRGB(hex);
              const hsl = rgbToHSL(rgb);
              const complementH = (hsl.h + 180) % 360;
              const triad1H = (hsl.h + 120) % 360;
              const triad2H = (hsl.h + 240) % 360;
              const analogous1H = (hsl.h + 30) % 360;
              const analogous2H = (hsl.h - 30 + 360) % 360;

              const mkHex = (h: number) => rgbToHex(hslToRGB({ h, s: hsl.s, l: hsl.l }));

              return (
                <div key={ci} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: hex, border: `1px solid ${border}` }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>
                      Color {ci === 0 ? 'A' : 'B'}: {hex.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: textMuted }}>HSL({hsl.h}°, {hsl.s}%, {hsl.l}%)</span>
                  </div>

                  {[
                    { label: 'Complement', swatches: [hex, mkHex(complementH)] },
                    { label: 'Triadic', swatches: [hex, mkHex(triad1H), mkHex(triad2H)] },
                    { label: 'Analogous', swatches: [mkHex(analogous2H), hex, mkHex(analogous1H)] },
                  ].map(({ label, swatches }) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>{label}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {swatches.map((sw, si) => (
                          <div
                            key={si}
                            onClick={() => handleCopy(sw)}
                            title={sw}
                            style={{
                              flex: 1, height: 32, borderRadius: 6,
                              background: sw, cursor: 'pointer',
                              border: copiedHex === sw ? '2px solid #fff' : `1px solid ${border}`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px', borderTop: `1px solid ${border}`,
        fontSize: 11, color: textMuted, flexShrink: 0,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Click swatch to copy · ⌘+click to apply</span>
        {copiedHex && <span style={{ color: '#22c55e', fontWeight: 600 }}>Copied {copiedHex}!</span>}
      </div>
    </div>
  );
}
