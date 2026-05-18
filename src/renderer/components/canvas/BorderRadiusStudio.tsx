import React, { useState, useCallback, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CornerRadius {
  tl: number;  // top-left
  tr: number;  // top-right
  br: number;  // bottom-right
  bl: number;  // bottom-left
}

export interface RadiusPreset {
  name: string;
  description: string;
  corners: CornerRadius;
  emoji: string;
}

export type LinkedMode = 'all' | 'independent';

// ── Constants ─────────────────────────────────────────────────────────────────

export const RADIUS_PRESETS: RadiusPreset[] = [
  { name: 'None', description: 'Sharp corners', corners: { tl: 0, tr: 0, br: 0, bl: 0 }, emoji: '▭' },
  { name: 'Subtle (2px)', description: 'Very slight softening', corners: { tl: 2, tr: 2, br: 2, bl: 2 }, emoji: '▢' },
  { name: 'Small (4px)', description: 'Gentle rounding — inputs, cards', corners: { tl: 4, tr: 4, br: 4, bl: 4 }, emoji: '▣' },
  { name: 'Medium (8px)', description: 'Standard UI rounding', corners: { tl: 8, tr: 8, br: 8, bl: 8 }, emoji: '⬜' },
  { name: 'Large (12px)', description: 'Modern card / button style', corners: { tl: 12, tr: 12, br: 12, bl: 12 }, emoji: '🔲' },
  { name: 'XL (16px)', description: 'Soft, friendly UI', corners: { tl: 16, tr: 16, br: 16, bl: 16 }, emoji: '◻' },
  { name: '2XL (24px)', description: 'Very rounded elements', corners: { tl: 24, tr: 24, br: 24, bl: 24 }, emoji: '⬛' },
  { name: 'Pill (9999px)', description: 'Full pill / badge shape', corners: { tl: 9999, tr: 9999, br: 9999, bl: 9999 }, emoji: '💊' },
  { name: 'Top Only', description: 'Only top corners rounded (e.g. nav items)', corners: { tl: 12, tr: 12, br: 0, bl: 0 }, emoji: '⌒' },
  { name: 'Bottom Only', description: 'Only bottom corners rounded', corners: { tl: 0, tr: 0, br: 12, bl: 12 }, emoji: '⌣' },
  { name: 'Left Only', description: 'Left side rounded', corners: { tl: 12, tr: 0, br: 0, bl: 12 }, emoji: '◐' },
  { name: 'Right Only', description: 'Right side rounded', corners: { tl: 0, tr: 12, br: 12, bl: 0 }, emoji: '◑' },
  { name: 'Squircle-ish (40%)', description: 'iOS-style icon approximation', corners: { tl: 22, tr: 22, br: 22, bl: 22 }, emoji: '◼' },
  { name: 'Asymmetric Wave', description: 'Creative alternating corners', corners: { tl: 24, tr: 4, br: 24, bl: 4 }, emoji: '◈' },
  { name: 'Egg Shape', description: 'Top wider than bottom', corners: { tl: 50, tr: 50, br: 20, bl: 20 }, emoji: '🥚' },
  { name: 'Teardrop', description: 'One sharp corner', corners: { tl: 0, tr: 40, br: 40, bl: 40 }, emoji: '💧' },
  { name: 'Diamond Tab', description: 'Active tab style', corners: { tl: 8, tr: 8, br: 0, bl: 0 }, emoji: '🏷' },
];

const TAILWIND_RADIUS_MAP: Record<number, string> = {
  0: 'rounded-none',
  2: 'rounded-sm',
  4: 'rounded',
  6: 'rounded-md',
  8: 'rounded-lg',
  12: 'rounded-xl',
  16: 'rounded-2xl',
  24: 'rounded-3xl',
  9999: 'rounded-full',
};

// ── Pure functions (exported for tests) ──────────────────────────────────────

export function cornersToCSS(c: CornerRadius): string {
  const { tl, tr, br, bl } = c;
  // Use shorthand if all equal
  if (tl === tr && tr === br && br === bl) return `border-radius: ${tl}px;`;
  // Use 2-value shorthand if diagonals match
  if (tl === br && tr === bl) return `border-radius: ${tl}px ${tr}px;`;
  // Full 4-value
  return `border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`;
}

export function cornersToLongformCSS(c: CornerRadius): string {
  return `border-top-left-radius: ${c.tl}px;\nborder-top-right-radius: ${c.tr}px;\nborder-bottom-right-radius: ${c.br}px;\nborder-bottom-left-radius: ${c.bl}px;`;
}

export function cornersToTailwind(c: CornerRadius, shapeW?: number): string {
  const allEqual = c.tl === c.tr && c.tr === c.br && c.br === c.bl;
  if (allEqual) {
    if (shapeW && c.tl >= shapeW / 2) return 'rounded-full';
    return TAILWIND_RADIUS_MAP[c.tl] ?? `rounded-[${c.tl}px]`;
  }
  // Try corner-specific Tailwind classes
  const cornerClass = (v: number) => TAILWIND_RADIUS_MAP[v] ? TAILWIND_RADIUS_MAP[v] : `[${v}px]`;
  return [
    `rounded-tl-${cornerClass(c.tl)}`,
    `rounded-tr-${cornerClass(c.tr)}`,
    `rounded-br-${cornerClass(c.br)}`,
    `rounded-bl-${cornerClass(c.bl)}`,
  ].join(' ');
}

export function cornersToSVGClipPath(c: CornerRadius, w: number, h: number): string {
  // Clamp radii so they don't exceed half the dimension
  const maxR = Math.min(w, h) / 2;
  const tl = Math.min(c.tl, maxR);
  const tr = Math.min(c.tr, maxR);
  const br = Math.min(c.br, maxR);
  const bl = Math.min(c.bl, maxR);
  // SVG path for rounded rectangle
  return `M ${tl} 0 L ${w - tr} 0 Q ${w} 0 ${w} ${tr} L ${w} ${h - br} Q ${w} ${h} ${w - br} ${h} L ${bl} ${h} Q 0 ${h} 0 ${h - bl} L 0 ${tl} Q 0 0 ${tl} 0 Z`;
}

export function isAllEqual(c: CornerRadius): boolean {
  return c.tl === c.tr && c.tr === c.br && c.br === c.bl;
}

export function clampCorner(v: number, max?: number): number {
  return Math.max(0, Math.min(max ?? 9999, Math.round(v)));
}

export function averageRadius(c: CornerRadius): number {
  return Math.round((c.tl + c.tr + c.br + c.bl) / 4);
}

export function cornersToReactStyle(c: CornerRadius): {
  borderTopLeftRadius: string;
  borderTopRightRadius: string;
  borderBottomRightRadius: string;
  borderBottomLeftRadius: string;
} {
  return {
    borderTopLeftRadius: `${c.tl}px`,
    borderTopRightRadius: `${c.tr}px`,
    borderBottomRightRadius: `${c.br}px`,
    borderBottomLeftRadius: `${c.bl}px`,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  initialRadius?: number;
  onApply?: (radius: number | [number, number, number, number]) => void;
}

type TabId = 'editor' | 'presets' | 'export';

export function BorderRadiusStudio({ open, onClose, initialRadius = 8, onApply }: Props) {
  const [corners, setCorners] = useState<CornerRadius>({
    tl: initialRadius, tr: initialRadius, br: initialRadius, bl: initialRadius,
  });
  const [linked, setLinked] = useState(true);
  const [tab, setTab] = useState<TabId>('editor');
  const [copied, setCopied] = useState<string | null>(null);
  const [previewBg, setPreviewBg] = useState('#6366f1');
  const [previewW, setPreviewW] = useState(160);
  const [previewH, setPreviewH] = useState(80);

  const updateCorner = useCallback((corner: keyof CornerRadius, value: number) => {
    const v = clampCorner(value);
    if (linked) {
      setCorners({ tl: v, tr: v, br: v, bl: v });
    } else {
      setCorners(prev => ({ ...prev, [corner]: v }));
    }
  }, [linked]);

  const handlePresetApply = useCallback((preset: RadiusPreset) => {
    setCorners(preset.corners);
    setLinked(isAllEqual(preset.corners));
    setTab('editor');
  }, []);

  const copyText = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  if (!open) return null;

  const panelBg = '#1e1e2e';
  const surface = '#2a2a3e';
  const border = '#3a3a55';
  const accent = '#6366f1';
  const textPrimary = '#e2e8f0';
  const textMuted = '#94a3b8';

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', background: active ? accent : 'transparent',
    color: active ? '#fff' : textMuted, border: 'none', transition: 'all 0.15s',
  });

  const CSS_SHORTHAND = cornersToCSS(corners);
  const CSS_LONGFORM = cornersToLongformCSS(corners);
  const TAILWIND = cornersToTailwind(corners, previewW);
  const svgPath = cornersToSVGClipPath(corners, previewW, previewH);
  const allEqual = isAllEqual(corners);
  const avg = averageRadius(corners);

  const cornerKeys: { key: keyof CornerRadius; label: string }[] = [
    { key: 'tl', label: 'Top Left' },
    { key: 'tr', label: 'Top Right' },
    { key: 'br', label: 'Bottom Right' },
    { key: 'bl', label: 'Bottom Left' },
  ];

  return (
    <div style={{
      position: 'fixed', left: 16, top: 60, width: 360,
      maxHeight: 'calc(100vh - 80px)', background: panelBg,
      border: `1px solid ${border}`, borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', zIndex: 9024,
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px', borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>Border Radius Studio</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            {allEqual ? `${corners.tl}px uniform` : `tl:${corners.tl} tr:${corners.tr} br:${corners.br} bl:${corners.bl}`}
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
        {(['editor', 'presets', 'export'] as TabId[]).map(t => (
          <button key={t} style={TAB_STYLE(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── Editor Tab ── */}
        {tab === 'editor' && (
          <div>
            {/* Linked toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 12, color: textMuted }}>Corners</span>
              <button
                onClick={() => setLinked(v => !v)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: linked ? `${accent}22` : 'transparent',
                  border: `1px solid ${linked ? accent : border}`,
                  color: linked ? accent : textMuted, cursor: 'pointer',
                }}
              >{linked ? '🔗 Linked' : '🔓 Independent'}</button>
            </div>

            {/* Sliders */}
            {linked ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>All corners</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="range" min={0} max={200} step={1} value={corners.tl}
                    onChange={e => updateCorner('tl', Number(e.target.value))}
                    style={{ flex: 1, accentColor: accent }}
                  />
                  <input
                    type="number" min={0} max={9999} value={corners.tl}
                    onChange={e => updateCorner('tl', Number(e.target.value))}
                    style={{
                      width: 60, background: surface, border: `1px solid ${border}`,
                      borderRadius: 6, color: textPrimary, fontSize: 13, fontWeight: 700,
                      padding: '4px 8px', outline: 'none', fontFamily: 'monospace',
                    }}
                  />
                  <span style={{ fontSize: 11, color: textMuted }}>px</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {cornerKeys.map(({ key, label }) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, color: textMuted, marginBottom: 4 }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="range" min={0} max={200} step={1} value={corners[key]}
                        onChange={e => updateCorner(key, Number(e.target.value))}
                        style={{ flex: 1, accentColor: accent }}
                      />
                      <input
                        type="number" min={0} max={9999} value={corners[key]}
                        onChange={e => updateCorner(key, Number(e.target.value))}
                        style={{
                          width: 52, background: surface, border: `1px solid ${border}`,
                          borderRadius: 6, color: textPrimary, fontSize: 12, fontWeight: 700,
                          padding: '3px 6px', outline: 'none', fontFamily: 'monospace',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Live preview */}
            <div style={{
              background: surface, border: `1px solid ${border}`, borderRadius: 10,
              padding: 16, marginBottom: 14,
            }}>
              {/* Preview controls */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 3 }}>Width</div>
                  <input type="range" min={60} max={280} value={previewW}
                    onChange={e => setPreviewW(Number(e.target.value))}
                    style={{ width: '100%', accentColor: accent }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 3 }}>Height</div>
                  <input type="range" min={40} max={160} value={previewH}
                    onChange={e => setPreviewH(Number(e.target.value))}
                    style={{ width: '100%', accentColor: accent }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 3 }}>Color</div>
                  <input type="color" value={previewBg}
                    onChange={e => setPreviewBg(e.target.value)}
                    style={{ width: 32, height: 28, borderRadius: 4, border: `1px solid ${border}`, cursor: 'pointer' }} />
                </div>
              </div>

              {/* Preview box using SVG for precise rendering */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 100 }}>
                <svg width={previewW} height={previewH} viewBox={`0 0 ${previewW} ${previewH}`}>
                  <path d={svgPath} fill={previewBg} />
                </svg>
              </div>

              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: textMuted }}>
                {previewW} × {previewH}px
              </div>
            </div>

            {/* CSS preview */}
            <div style={{
              background: '#0f0f1a', border: `1px solid ${border}`, borderRadius: 8,
              padding: '10px 14px', marginBottom: 14,
              fontFamily: 'monospace', fontSize: 12, color: '#7dd3fc',
            }}>
              <div>{CSS_SHORTHAND}</div>
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setCorners({ tl: 0, tr: 0, br: 0, bl: 0 })} style={{
                padding: '6px 12px', borderRadius: 6, background: 'transparent',
                border: `1px solid ${border}`, color: textMuted, cursor: 'pointer', fontSize: 11,
              }}>Reset to 0</button>
              <button onClick={() => setCorners({ tl: 9999, tr: 9999, br: 9999, bl: 9999 })} style={{
                padding: '6px 12px', borderRadius: 6, background: 'transparent',
                border: `1px solid ${border}`, color: textMuted, cursor: 'pointer', fontSize: 11,
              }}>Pill</button>
              {onApply && (
                <button onClick={() => onApply(allEqual ? corners.tl : [corners.tl, corners.tr, corners.br, corners.bl])} style={{
                  padding: '6px 12px', borderRadius: 6,
                  background: `${accent}22`, border: `1px solid ${accent}55`,
                  color: accent, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                }}>Apply to shape</button>
              )}
            </div>
          </div>
        )}

        {/* ── Presets Tab ── */}
        {tab === 'presets' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {RADIUS_PRESETS.map(p => {
                const isActive = JSON.stringify(corners) === JSON.stringify(p.corners);
                return (
                  <div
                    key={p.name}
                    onClick={() => handlePresetApply(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                      borderRadius: 8, cursor: 'pointer',
                      background: isActive ? `${accent}11` : surface,
                      border: `1px solid ${isActive ? accent + '55' : border}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Mini preview */}
                    <div style={{ width: 32, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width={28} height={18} viewBox="0 0 28 18">
                        <path d={cornersToSVGClipPath(p.corners, 28, 18)} fill={isActive ? accent : '#475569'} />
                      </svg>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? accent : textPrimary }}>
                        {p.emoji} {p.name}
                      </div>
                      <div style={{ fontSize: 10, color: textMuted, marginTop: 2 }}>{p.description}</div>
                    </div>

                    <div style={{
                      fontSize: 10, color: textMuted, fontFamily: 'monospace', textAlign: 'right',
                    }}>
                      {isAllEqual(p.corners)
                        ? `${p.corners.tl}px`
                        : `${p.corners.tl}/${p.corners.tr}/${p.corners.br}/${p.corners.bl}`
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Export Tab ── */}
        {tab === 'export' && (
          <div>
            {[
              { label: 'CSS Shorthand', content: CSS_SHORTHAND },
              { label: 'CSS Longform', content: CSS_LONGFORM },
              { label: 'Tailwind', content: TAILWIND },
            ].map(({ label, content }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{label}</div>
                  <button
                    onClick={() => copyText(content, label)}
                    style={{
                      padding: '4px 10px', borderRadius: 6,
                      background: copied === label ? '#22c55e' : `${accent}22`,
                      border: `1px solid ${copied === label ? '#22c55e' : accent + '55'}`,
                      color: copied === label ? '#fff' : accent,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >{copied === label ? 'Copied!' : 'Copy'}</button>
                </div>
                <pre style={{
                  background: '#0f0f1a', border: `1px solid ${border}`, borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, color: '#7dd3fc',
                  fontFamily: 'monospace', margin: 0, whiteSpace: 'pre', overflowX: 'auto',
                }}>{content}</pre>
              </div>
            ))}

            {/* Stats */}
            <div style={{
              background: surface, border: `1px solid ${border}`, borderRadius: 8,
              padding: '10px 12px',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            }}>
              {[
                { label: 'TL', value: `${corners.tl}px` },
                { label: 'TR', value: `${corners.tr}px` },
                { label: 'BR', value: `${corners.br}px` },
                { label: 'BL', value: `${corners.bl}px` },
                { label: 'Average', value: `${avg}px` },
                { label: 'Shape', value: allEqual ? 'Uniform' : 'Asymmetric' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: textMuted }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary, fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
