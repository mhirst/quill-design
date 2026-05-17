/**
 * DesignSystemPanel — shows extracted design tokens from the current document.
 * Opens via command palette or Ctrl+Shift+D.
 * Shows: color palette, text styles, spacing values, shape type inventory.
 */
import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onApplyColor?: (color: string) => void;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

function ColorSwatch({ color, onCopy }: { color: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  const cr = contrastRatio(color, '#ffffff');
  const wcagAA = cr >= 4.5;
  const wcagAAA = cr >= 7;
  const textColor = luminance(color) > 0.4 ? '#000' : '#fff';

  const copy = () => {
    navigator.clipboard.writeText(color).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    onCopy();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 56 }}>
      <button
        onClick={copy}
        title={`${color} · CR: ${cr.toFixed(1)}:1 with white`}
        style={{
          width: 56, height: 40, background: color, borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer', position: 'relative',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {copied && (
          <span style={{ fontSize: 10, fontWeight: 700, color: textColor }}>✓</span>
        )}
        {/* WCAG badge */}
        <div style={{
          position: 'absolute', bottom: 2, right: 2,
          fontSize: 7, fontWeight: 800, letterSpacing: '0.03em',
          color: textColor, opacity: 0.7,
        }}>
          {wcagAAA ? 'AAA' : wcagAA ? 'AA' : ''}
        </div>
      </button>
      <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {color}
      </span>
    </div>
  );
}

export function DesignSystemPanel({ open, onClose, shapes, onApplyColor }: Props) {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const tokens = useMemo(() => {
    const colorSet = new Set<string>();
    const fontSizes = new Set<number>();
    const fontFamilies = new Set<string>();
    const spacings = new Set<number>();

    for (const s of shapes) {
      // Colors from fills
      if (s.fillType === 'solid' && s.fill && s.fill !== 'transparent' && /^#[0-9a-fA-F]{6}$/.test(s.fill)) {
        colorSet.add(s.fill.toLowerCase());
      }
      // Colors from gradient stops
      if ((s.fillType === 'linear-gradient' || s.fillType === 'radial-gradient') && s.gradientStops) {
        for (const stop of s.gradientStops) {
          if (/^#[0-9a-fA-F]{6}$/.test(stop.color)) colorSet.add(stop.color.toLowerCase());
        }
      }
      // Colors from stroke
      if (s.stroke && s.stroke !== 'transparent' && /^#[0-9a-fA-F]{6}$/.test(s.stroke)) {
        colorSet.add(s.stroke.toLowerCase());
      }
      // Text color
      if (s.type === 'text' && s.color && /^#[0-9a-fA-F]{6}$/.test(s.color)) {
        colorSet.add(s.color.toLowerCase());
      }
      // Font sizes & families from text shapes
      if (s.type === 'text') {
        fontSizes.add(s.fontSize);
        fontFamilies.add(s.fontFamily);
      }
      // Extract spacing from dimensions (rounded to nearest 4)
      const w = Math.round(s.width / 4) * 4;
      const h = Math.round(s.height / 4) * 4;
      if (w > 0 && w <= 512) spacings.add(w);
      if (h > 0 && h <= 512) spacings.add(h);
    }

    const colors = Array.from(colorSet).slice(0, 48);
    const sizes = Array.from(fontSizes).sort((a, b) => a - b);
    const families = Array.from(fontFamilies).sort();
    const dims = Array.from(spacings).sort((a, b) => a - b).slice(0, 20);

    return { colors, sizes, families, dims };
  }, [shapes]);

  // Type breakdown
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of shapes) counts[s.type] = (counts[s.type] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [shapes]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 0,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        width: 640,
        maxWidth: 'calc(100vw - 48px)',
        maxHeight: 'calc(100vh - 80px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Design System
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Extracted from {shapes.length} shape{shapes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {copiedColor && (
              <span style={{
                fontSize: 11, color: '#22c55e', fontFamily: 'monospace',
                background: 'rgba(34,197,94,0.1)', borderRadius: 4, padding: '2px 8px',
                border: '1px solid rgba(34,197,94,0.3)',
              }}>
                Copied {copiedColor}
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none', border: '1px solid transparent', cursor: 'pointer',
                color: 'var(--muted)', padding: '4px 8px', borderRadius: 6, fontSize: 11,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
          {shapes.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '48px 0', color: 'var(--muted)', gap: 8,
            }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity={0.3}>
                <rect x="5" y="5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="22" y="5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="5" y="22" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="28.5" cy="28.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span style={{ fontSize: 13 }}>No shapes on canvas yet</span>
              <span style={{ fontSize: 11, color: 'var(--subtle)' }}>Add shapes to see extracted design tokens</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Color Palette */}
              {tokens.colors.length > 0 && (
                <section>
                  <SectionHeader
                    title="Color Palette"
                    count={tokens.colors.length}
                    description="Click any swatch to copy hex"
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {tokens.colors.map(color => (
                      <ColorSwatch
                        key={color}
                        color={color}
                        onCopy={() => {
                          setCopiedColor(color);
                          setTimeout(() => setCopiedColor(null), 2000);
                          onApplyColor?.(color);
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 10, color: 'var(--subtle)' }}>
                    WCAG badges show contrast ratio with white. AA ≥ 4.5:1 · AAA ≥ 7:1
                  </div>
                </section>
              )}

              {/* Typography */}
              {tokens.sizes.length > 0 && (
                <section>
                  <SectionHeader
                    title="Typography"
                    count={tokens.sizes.length}
                    description="Font sizes used in text shapes"
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    {tokens.families.map(family => (
                      <div key={family} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          fontSize: 13, fontFamily: family, color: 'var(--text)',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          Ag — {family}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                          {family}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {tokens.sizes.map(size => (
                      <div key={size} style={{
                        background: 'var(--panel-alt)', border: '1px solid var(--border)',
                        borderRadius: 5, padding: '3px 8px',
                        fontSize: 11, color: 'var(--text)', fontFamily: 'monospace',
                      }}>
                        {size}px
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Shape Inventory */}
              <section>
                <SectionHeader
                  title="Shape Inventory"
                  count={shapes.length}
                  description="Type breakdown"
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginTop: 10 }}>
                  {typeCounts.map(([type, count]) => (
                    <div key={type} style={{
                      background: 'var(--panel-alt)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '8px 12px',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>
                        {type === 'frame' ? '⬜' : type === 'rectangle' ? '▬' : type === 'ellipse' ? '◯' : type === 'text' ? 'T' : '✏'}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.2 }}>{count}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>{type}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* CSS Variables Export */}
              {tokens.colors.length > 0 && (
                <section>
                  <SectionHeader
                    title="CSS Variables"
                    description="Copy to use in your project"
                  />
                  <div style={{ marginTop: 10, position: 'relative' }}>
                    <CssVarsBlock colors={tokens.colors} sizes={tokens.sizes} />
                  </div>
                </section>
              )}

              {/* JSON Token Export */}
              {tokens.colors.length > 0 && (
                <section>
                  <SectionHeader
                    title="JSON Tokens"
                    description="W3C Design Token format"
                  />
                  <div style={{ marginTop: 10 }}>
                    <JsonTokensBlock colors={tokens.colors} sizes={tokens.sizes} families={tokens.families} />
                  </div>
                </section>
              )}

              {/* Tailwind Config Export */}
              {tokens.colors.length > 0 && (
                <section>
                  <SectionHeader
                    title="Tailwind Config"
                    description="Paste into tailwind.config.js"
                  />
                  <div style={{ marginTop: 10 }}>
                    <TailwindBlock colors={tokens.colors} sizes={tokens.sizes} families={tokens.families} />
                  </div>
                </section>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count, description }: { title: string; count?: number; description?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--muted)', background: 'rgba(99,102,241,0.08)', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
          {count}
        </span>
      )}
      {description && (
        <span style={{ fontSize: 10, color: 'var(--subtle)', marginLeft: 'auto' }}>
          {description}
        </span>
      )}
    </div>
  );
}

function CssVarsBlock({ colors, sizes }: { colors: string[]; sizes: number[] }) {
  const [copied, setCopied] = useState(false);
  // Custom names: maps index -> custom name (without --)
  const [colorNames, setColorNames] = useState<Record<number, string>>({});
  const [sizeNames, setSizeNames] = useState<Record<number, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [prefix, setPrefix] = useState('');
  const [showPrefixEdit, setShowPrefixEdit] = useState(false);

  const getColorName = (i: number) => colorNames[i] ?? `${prefix ? prefix + '-' : ''}color-${i + 1}`;
  const getSizeName = (i: number) => sizeNames[i] ?? `${prefix ? prefix + '-' : ''}font-size-${i + 1}`;

  const cssLines = [
    ':root {',
    ...colors.map((c, i) => `  --${getColorName(i)}: ${c};`),
    ...(sizes.length > 0 ? ['', '  /* Font sizes */'] : []),
    ...sizes.map((s, i) => `  --${getSizeName(i)}: ${s}px;`),
    '}',
  ];
  const css = cssLines.join('\n');

  const copy = () => {
    navigator.clipboard.writeText(css).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const startEdit = (key: string, current: string) => {
    setEditingKey(key);
    setEditDraft(current);
  };

  const commitEdit = (key: string) => {
    const clean = editDraft.replace(/^--/, '').trim();
    if (key.startsWith('c-')) {
      const i = parseInt(key.slice(2));
      setColorNames(n => ({ ...n, [i]: clean || getColorName(i) }));
    } else if (key.startsWith('s-')) {
      const i = parseInt(key.slice(2));
      setSizeNames(n => ({ ...n, [i]: clean || getSizeName(i) }));
    }
    setEditingKey(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Prefix + hint row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Prefix:</span>
        {showPrefixEdit ? (
          <input
            autoFocus
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.replace(/[^a-z0-9-]/gi, ''))}
            onBlur={() => setShowPrefixEdit(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setShowPrefixEdit(false); }}
            placeholder="e.g. brand"
            style={{
              background: 'var(--input-bg)', border: '1px solid var(--accent)',
              borderRadius: 4, color: 'var(--text)', fontSize: 10, fontFamily: 'monospace',
              padding: '2px 6px', outline: 'none', width: 80,
            }}
          />
        ) : (
          <button
            onClick={() => setShowPrefixEdit(true)}
            style={{
              background: prefix ? 'rgba(99,102,241,0.12)' : 'var(--panel-alt)',
              border: `1px solid ${prefix ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 4, color: prefix ? 'var(--accent)' : 'var(--subtle)',
              cursor: 'pointer', fontSize: 10, fontFamily: 'monospace', padding: '2px 7px',
            }}
          >
            {prefix || '(none)'}
          </button>
        )}
        <span style={{ fontSize: 9, color: 'var(--subtle)', flex: 1 }}>Click variable names below to rename</span>
      </div>

      {/* Editable variable list */}
      <div style={{
        background: 'var(--panel-alt)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 12px',
        fontSize: 11, fontFamily: 'monospace', lineHeight: 1.8,
        maxHeight: 220, overflowY: 'auto',
      }}>
        <span style={{ color: 'var(--muted)' }}>:root {'{'}</span>
        {colors.map((c, i) => {
          const key = `c-${i}`;
          const name = getColorName(i);
          return (
            <div key={key} style={{ paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--subtle)' }}>--</span>
              {editingKey === key ? (
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onBlur={() => commitEdit(key)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(key); if (e.key === 'Escape') setEditingKey(null); e.stopPropagation(); }}
                  style={{
                    background: 'var(--input-bg)', border: '1px solid var(--accent)',
                    borderRadius: 3, color: 'var(--accent)', fontSize: 11, fontFamily: 'monospace',
                    padding: '0 4px', outline: 'none', width: 130,
                  }}
                />
              ) : (
                <button
                  onClick={() => startEdit(key, name)}
                  title="Click to rename"
                  style={{
                    background: 'none', border: '1px dashed transparent', borderRadius: 3,
                    cursor: 'text', color: 'var(--accent)', fontSize: 11, fontFamily: 'monospace',
                    padding: '0 2px',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  {name}
                </button>
              )}
              <span style={{ color: 'var(--muted)' }}>:</span>
              <span style={{
                display: 'inline-block', width: 12, height: 12, borderRadius: 2,
                background: c, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, marginLeft: 2,
              }} />
              <span style={{ color: 'var(--text)' }}>{c};</span>
            </div>
          );
        })}
        {sizes.length > 0 && (
          <>
            <div style={{ paddingLeft: 16, color: 'var(--subtle)', opacity: 0.6 }}>{'/* Font sizes */'}</div>
            {sizes.map((s, i) => {
              const key = `s-${i}`;
              const name = getSizeName(i);
              return (
                <div key={key} style={{ paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--subtle)' }}>--</span>
                  {editingKey === key ? (
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={() => commitEdit(key)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(key); if (e.key === 'Escape') setEditingKey(null); e.stopPropagation(); }}
                      style={{
                        background: 'var(--input-bg)', border: '1px solid var(--accent)',
                        borderRadius: 3, color: 'var(--accent)', fontSize: 11, fontFamily: 'monospace',
                        padding: '0 4px', outline: 'none', width: 130,
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(key, name)}
                      title="Click to rename"
                      style={{
                        background: 'none', border: '1px dashed transparent', borderRadius: 3,
                        cursor: 'text', color: 'var(--accent)', fontSize: 11, fontFamily: 'monospace',
                        padding: '0 2px',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                      {name}
                    </button>
                  )}
                  <span style={{ color: 'var(--muted)' }}>: <span style={{ color: 'var(--text)' }}>{s}px;</span></span>
                </div>
              );
            })}
          </>
        )}
        <span style={{ color: 'var(--muted)' }}>{'}'}</span>
      </div>

      {/* Copy button */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={copy}
          style={{
            background: copied ? 'rgba(34,197,94,0.15)' : 'var(--panel-alt)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
            borderRadius: 6, color: copied ? '#22c55e' : 'var(--muted)',
            cursor: 'pointer', fontSize: 10, fontWeight: 600,
            padding: '5px 12px', transition: 'all 0.15s', flex: 1,
          }}
        >
          {copied ? '✓ Copied!' : '⬆ Copy CSS Variables'}
        </button>
        <button
          onClick={() => { setColorNames({}); setSizeNames({}); setPrefix(''); }}
          title="Reset all names to defaults"
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--muted)', cursor: 'pointer', fontSize: 10, padding: '5px 8px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ── JSON Tokens Block (W3C Design Token Format) ────────────────────────────

function JsonTokensBlock({ colors, sizes, families }: { colors: string[]; sizes: number[]; families: string[] }) {
  const [copied, setCopied] = useState(false);

  const tokens: Record<string, unknown> = {};

  // Colors
  if (colors.length > 0) {
    const colorTokens: Record<string, unknown> = {};
    colors.forEach((c, i) => {
      colorTokens[`color-${i + 1}`] = { $value: c, $type: 'color' };
    });
    tokens['colors'] = colorTokens;
  }

  // Typography
  if (sizes.length > 0) {
    const sizeTokens: Record<string, unknown> = {};
    sizes.forEach((s, i) => {
      sizeTokens[`font-size-${i + 1}`] = { $value: `${s}px`, $type: 'dimension' };
    });
    tokens['typography'] = sizeTokens;
  }

  // Font families
  if (families.length > 0) {
    const familyTokens: Record<string, unknown> = {};
    families.forEach((f) => {
      const key = f.toLowerCase().replace(/\s+/g, '-');
      familyTokens[key] = { $value: f, $type: 'fontFamily' };
    });
    tokens['fontFamilies'] = familyTokens;
  }

  const json = JSON.stringify(tokens, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(json).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        background: 'var(--panel-alt)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 12px',
        fontSize: 10.5, fontFamily: 'monospace', lineHeight: 1.7,
        maxHeight: 200, overflowY: 'auto',
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
      }}>
        {json}
      </div>
      <button
        onClick={copy}
        style={{
          background: copied ? 'rgba(34,197,94,0.15)' : 'var(--panel-alt)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
          borderRadius: 6, color: copied ? '#22c55e' : 'var(--muted)',
          cursor: 'pointer', fontSize: 10, fontWeight: 600,
          padding: '5px 12px', transition: 'all 0.15s',
        }}
      >
        {copied ? '✓ Copied!' : '⬆ Copy JSON Tokens'}
      </button>
    </div>
  );
}

// ── Tailwind Config Block ──────────────────────────────────────────────────

function TailwindBlock({ colors, sizes, families }: { colors: string[]; sizes: number[]; families: string[] }) {
  const [copied, setCopied] = useState(false);

  const colorEntries = colors
    .map((c, i) => `      'brand-${i + 1}': '${c}',`)
    .join('\n');

  const sizeEntries = sizes
    .map((s) => `      '${s}': '${s}px',`)
    .join('\n');

  const familyEntries = families
    .map((f) => {
      const key = f.toLowerCase().replace(/\s+/g, '-');
      return `      '${key}': ['${f}', 'sans-serif'],`;
    })
    .join('\n');

  const lines = [
    '// tailwind.config.js — paste into theme.extend',
    'module.exports = {',
    '  theme: {',
    '    extend: {',
    '      colors: {',
    colorEntries,
    '      },',
    ...(sizes.length > 0 ? [
      '      fontSize: {',
      sizeEntries,
      '      },',
    ] : []),
    ...(families.length > 0 ? [
      '      fontFamily: {',
      familyEntries,
      '      },',
    ] : []),
    '    },',
    '  },',
    '};',
  ];

  const config = lines.join('\n');

  const copy = () => {
    navigator.clipboard.writeText(config).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        background: 'var(--panel-alt)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 12px',
        fontSize: 10.5, fontFamily: 'monospace', lineHeight: 1.7,
        maxHeight: 200, overflowY: 'auto',
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
      }}>
        {config}
      </div>
      <button
        onClick={copy}
        style={{
          background: copied ? 'rgba(34,197,94,0.15)' : 'var(--panel-alt)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
          borderRadius: 6, color: copied ? '#22c55e' : 'var(--muted)',
          cursor: 'pointer', fontSize: 10, fontWeight: 600,
          padding: '5px 12px', transition: 'all 0.15s',
        }}
      >
        {copied ? '✓ Copied!' : '⬆ Copy Tailwind Config'}
      </button>
    </div>
  );
}
