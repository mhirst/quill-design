/**
 * DevSpecPanel — Developer Handoff / Spec View
 * Shows a comprehensive specification view of the selected shape:
 * dimensions, position, colors, typography, shadows, borders, and more.
 * Includes one-click copy for CSS, JSON spec, and Markdown table.
 *
 * Shortcut: ⌘⇧E (or accessible from context menu / command palette)
 */
import React, { useState, useCallback } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { Shape } from '../../lib/shapes';

// ── Helper: px → rem ─────────────────────────────────────────────────────────
function pxToRem(px: number, base = 16): string {
  return (px / base).toFixed(3).replace(/\.?0+$/, '') + 'rem';
}

// ── Helper: build spec record from shape ─────────────────────────────────────
interface SpecEntry {
  label: string;
  value: string;
  category: string;
  cssVar?: string;
}

function buildSpec(shape: Shape): SpecEntry[] {
  const entries: SpecEntry[] = [];

  // ── Dimensions ──────────────────────────────────────────────────────────────
  entries.push({ category: 'Dimensions', label: 'Width', value: `${Math.round(shape.width)}px / ${pxToRem(shape.width)}`, cssVar: `width: ${Math.round(shape.width)}px;` });
  entries.push({ category: 'Dimensions', label: 'Height', value: `${Math.round(shape.height)}px / ${pxToRem(shape.height)}`, cssVar: `height: ${Math.round(shape.height)}px;` });
  entries.push({ category: 'Dimensions', label: 'Position X', value: `${Math.round(shape.x)}px`, cssVar: `left: ${Math.round(shape.x)}px;` });
  entries.push({ category: 'Dimensions', label: 'Position Y', value: `${Math.round(shape.y)}px`, cssVar: `top: ${Math.round(shape.y)}px;` });
  if (shape.rotation) {
    entries.push({ category: 'Dimensions', label: 'Rotation', value: `${Math.round(shape.rotation)}°`, cssVar: `transform: rotate(${Math.round(shape.rotation)}deg);` });
  }

  // ── Appearance ──────────────────────────────────────────────────────────────
  const opacity = Math.round(shape.opacity * 100);
  if (opacity !== 100) {
    entries.push({ category: 'Appearance', label: 'Opacity', value: `${opacity}%`, cssVar: `opacity: ${shape.opacity};` });
  }
  if (shape.blendMode && shape.blendMode !== 'normal') {
    entries.push({ category: 'Appearance', label: 'Blend Mode', value: shape.blendMode, cssVar: `mix-blend-mode: ${shape.blendMode};` });
  }

  // ── Fill ────────────────────────────────────────────────────────────────────
  if (shape.fillType === 'solid' && shape.fill && shape.fill !== 'transparent') {
    entries.push({ category: 'Fill', label: 'Color', value: shape.fill.toUpperCase(), cssVar: `background-color: ${shape.fill};` });
  } else if (shape.fillType === 'linear-gradient' && shape.gradientStops?.length) {
    const stops = shape.gradientStops.map(s => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
    const angle = shape.gradientAngle ?? 180;
    const gradCss = `linear-gradient(${angle}deg, ${stops})`;
    entries.push({ category: 'Fill', label: 'Gradient', value: gradCss, cssVar: `background: ${gradCss};` });
  } else if (shape.fillType === 'radial-gradient' && shape.gradientStops?.length) {
    const stops = shape.gradientStops.map(s => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
    const gradCss = `radial-gradient(circle, ${stops})`;
    entries.push({ category: 'Fill', label: 'Radial Gradient', value: gradCss, cssVar: `background: ${gradCss};` });
  } else if (shape.fill === 'transparent') {
    entries.push({ category: 'Fill', label: 'Fill', value: 'None / transparent', cssVar: `background: transparent;` });
  }

  // ── Border / Stroke ─────────────────────────────────────────────────────────
  if (shape.strokeWidth && shape.strokeWidth > 0 && shape.stroke && shape.stroke !== 'transparent') {
    entries.push({ category: 'Border', label: 'Width', value: `${shape.strokeWidth}px`, cssVar: `border-width: ${shape.strokeWidth}px;` });
    entries.push({ category: 'Border', label: 'Color', value: shape.stroke.toUpperCase(), cssVar: `border-color: ${shape.stroke};` });
    const strokeStyle = shape.strokeDash ?? 'solid';
    entries.push({ category: 'Border', label: 'Style', value: strokeStyle, cssVar: `border-style: ${strokeStyle};` });
  }

  // ── Border Radius ───────────────────────────────────────────────────────────
  const br = shape.borderRadius;
  if (typeof br === 'number' && br > 0) {
    entries.push({ category: 'Border Radius', label: 'Radius', value: `${br}px`, cssVar: `border-radius: ${br}px;` });
  } else if (Array.isArray(br)) {
    const [tl, tr, brr, bl] = br as number[];
    entries.push({ category: 'Border Radius', label: 'Corners', value: `${tl}px ${tr}px ${brr}px ${bl}px`, cssVar: `border-radius: ${tl}px ${tr}px ${brr}px ${bl}px;` });
  }

  // ── Shadow ─────────────────────────────────────────────────────────────────
  if (shape.shadowX != null && (shape.shadowBlur ?? 0) > 0) {
    const shadowCss = `${shape.shadowX ?? 0}px ${shape.shadowY ?? 0}px ${shape.shadowBlur ?? 0}px ${shape.shadowColor ?? '#000000'}`;
    entries.push({ category: 'Shadow', label: 'Box Shadow', value: shadowCss, cssVar: `box-shadow: ${shadowCss};` });
  }

  // ── Multiple shadows stack ─────────────────────────────────────────────────
  if (shape.shadows && shape.shadows.length > 0) {
    shape.shadows.forEach((sh, i) => {
      const shd = sh as unknown as { x?: number; y?: number; blur?: number; color?: string };
      const shadowCss = `${shd.x ?? 0}px ${shd.y ?? 0}px ${shd.blur ?? 0}px ${shd.color ?? '#000000'}`;
      entries.push({ category: 'Shadow', label: `Shadow ${i + 1}`, value: shadowCss, cssVar: '' });
    });
  }

  // ── Typography (text shapes) ────────────────────────────────────────────────
  if (shape.type === 'text') {
    entries.push({ category: 'Typography', label: 'Font Family', value: shape.fontFamily ?? 'Inter', cssVar: `font-family: '${shape.fontFamily ?? 'Inter'}';` });
    entries.push({ category: 'Typography', label: 'Font Size', value: `${shape.fontSize ?? 16}px / ${pxToRem(shape.fontSize ?? 16)}`, cssVar: `font-size: ${shape.fontSize ?? 16}px;` });
    entries.push({ category: 'Typography', label: 'Font Weight', value: String(shape.fontWeight ?? 400), cssVar: `font-weight: ${shape.fontWeight ?? 400};` });
    if (shape.lineHeight) {
      entries.push({ category: 'Typography', label: 'Line Height', value: String(shape.lineHeight), cssVar: `line-height: ${shape.lineHeight};` });
    }
    if (shape.letterSpacing) {
      entries.push({ category: 'Typography', label: 'Letter Spacing', value: `${shape.letterSpacing}em`, cssVar: `letter-spacing: ${shape.letterSpacing}em;` });
    }
    if (shape.textAlign) {
      entries.push({ category: 'Typography', label: 'Text Align', value: shape.textAlign, cssVar: `text-align: ${shape.textAlign};` });
    }
    if (shape.color) {
      entries.push({ category: 'Typography', label: 'Color', value: shape.color.toUpperCase(), cssVar: `color: ${shape.color};` });
    }
    if (shape.fontStyle === 'italic') {
      entries.push({ category: 'Typography', label: 'Style', value: 'italic', cssVar: `font-style: italic;` });
    }
    if (shape.textDecoration && shape.textDecoration !== 'none') {
      entries.push({ category: 'Typography', label: 'Decoration', value: shape.textDecoration, cssVar: `text-decoration: ${shape.textDecoration};` });
    }
  }

  return entries;
}

// ── Build CSS block from entries ─────────────────────────────────────────────
function buildCss(shape: Shape, entries: SpecEntry[]): string {
  const name = (shape.name ?? 'shape').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const lines = [`.${name} {`];
  const seen = new Set<string>();
  for (const e of entries) {
    if (e.cssVar && !seen.has(e.cssVar)) {
      seen.add(e.cssVar);
      lines.push(`  ${e.cssVar}`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

// ── Build Markdown spec table ────────────────────────────────────────────────
function buildMarkdown(shape: Shape, entries: SpecEntry[]): string {
  const lines = [`## ${shape.name ?? 'Shape'} Spec`, ''];
  const grouped: Record<string, SpecEntry[]> = {};
  for (const e of entries) {
    (grouped[e.category] ??= []).push(e);
  }
  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`### ${cat}`, '| Property | Value |', '|---|---|');
    for (const item of items) {
      lines.push(`| ${item.label} | \`${item.value}\` |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── Build React TSX component ─────────────────────────────────────────────────
function buildReactTsx(shape: Shape): string {
  const name = shape.name
    ? shape.name.replace(/[^a-zA-Z0-9]/g, '_').replace(/^[0-9]/, '_$&')
    : `Shape${shape.type.charAt(0).toUpperCase() + shape.type.slice(1)}`;
  const componentName = name.charAt(0).toUpperCase() + name.slice(1);

  const styleLines: string[] = [];

  // Dimensions
  styleLines.push(`  width: '${Math.round(shape.width)}px'`);
  styleLines.push(`  height: '${Math.round(shape.height)}px'`);

  // Fill
  if (shape.fillType === 'solid' && shape.fill && shape.fill !== 'transparent') {
    styleLines.push(`  backgroundColor: '${shape.fill}'`);
  } else if (shape.fillType === 'linear-gradient' && shape.gradientStops?.length) {
    const stops = shape.gradientStops.map(s => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
    styleLines.push(`  backgroundImage: 'linear-gradient(${shape.gradientAngle ?? 135}deg, ${stops})'`);
  }

  // Border radius
  if (shape.borderRadius) {
    const r = Array.isArray(shape.borderRadius)
      ? shape.borderRadius.join('px ') + 'px'
      : `${shape.borderRadius}px`;
    styleLines.push(`  borderRadius: '${r}'`);
  }

  // Stroke
  if (shape.stroke && shape.stroke !== 'transparent' && shape.strokeWidth > 0) {
    styleLines.push(`  border: '${shape.strokeWidth}px solid ${shape.stroke}'`);
  }

  // Opacity
  if (shape.opacity !== 1) {
    styleLines.push(`  opacity: ${shape.opacity}`);
  }

  // Shadow
  if (shape.shadows && shape.shadows.length > 0) {
    const shadowStr = shape.shadows.map(sh => {
      const spread = sh.spread ? ` ${sh.spread}px` : '';
      const inset = sh.inset ? 'inset ' : '';
      return `${inset}${sh.x}px ${sh.y}px ${sh.blur}px${spread} ${sh.color}`;
    }).join(', ');
    styleLines.push(`  boxShadow: '${shadowStr}'`);
  }

  // Text styles
  if (shape.type === 'text') {
    styleLines.push(`  fontFamily: '${shape.fontFamily}'`);
    styleLines.push(`  fontSize: '${shape.fontSize}px'`);
    styleLines.push(`  fontWeight: ${shape.fontWeight}`);
    styleLines.push(`  color: '${shape.color}'`);
    styleLines.push(`  lineHeight: ${shape.lineHeight}`);
    if (shape.textAlign !== 'left') styleLines.push(`  textAlign: '${shape.textAlign}'`);
    if (shape.letterSpacing) styleLines.push(`  letterSpacing: '${(shape.letterSpacing / 100).toFixed(2)}em'`);
    if (shape.fontStyle === 'italic') styleLines.push(`  fontStyle: 'italic'`);
    if (shape.textDecoration !== 'none') styleLines.push(`  textDecoration: '${shape.textDecoration}'`);
  }

  // Filters
  const filterParts: string[] = [];
  if (shape.filterBlur && shape.filterBlur > 0) filterParts.push(`blur(${shape.filterBlur}px)`);
  if (shape.filterBrightness !== undefined && shape.filterBrightness !== 100) filterParts.push(`brightness(${shape.filterBrightness}%)`);
  if (shape.filterContrast !== undefined && shape.filterContrast !== 100) filterParts.push(`contrast(${shape.filterContrast}%)`);
  if (filterParts.length > 0) styleLines.push(`  filter: '${filterParts.join(' ')}'`);

  const styleObj = `{\n${styleLines.map(l => `    ${l},`).join('\n')}\n  }`;

  const childContent = shape.type === 'text'
    ? `\n    {/* ${shape.text || 'Text content'} */}\n    <span>{children ?? \`${shape.text || 'Text content'}\`}</span>\n  `
    : '\n    {children}\n  ';

  return `import React from 'react';

interface ${componentName}Props {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

const ${componentName}_styles: React.CSSProperties = ${styleObj};

export function ${componentName}({ children, style, className }: ${componentName}Props) {
  return (
    <div
      className={className}
      style={{ ...${componentName}_styles, ...style }}
    >${childContent}</div>
  );
}

export default ${componentName};
`;
}

// ── Build JSON spec ──────────────────────────────────────────────────────────
function buildJsonSpec(shape: Shape): string {
  const spec: Record<string, unknown> = {
    id: shape.id,
    name: shape.name,
    type: shape.type,
    dimensions: { width: Math.round(shape.width), height: Math.round(shape.height), x: Math.round(shape.x), y: Math.round(shape.y) },
    opacity: shape.opacity,
  };
  if (shape.fillType === 'solid' && shape.fill) spec.fill = shape.fill;
  if (shape.type === 'text') {
    spec.typography = {
      fontFamily: shape.fontFamily,
      fontSize: shape.fontSize,
      fontWeight: shape.fontWeight,
      lineHeight: shape.lineHeight,
      color: shape.color,
    };
  }
  if (shape.strokeWidth) {
    spec.border = { width: shape.strokeWidth, color: shape.stroke, style: shape.strokeDash ?? 'solid' };
  }
  return JSON.stringify(spec, null, 2);
}

// ── CopyButton helper ────────────────────────────────────────────────────────
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, height: 26, paddingInline: 10,
        borderRadius: 6, border: `1px solid ${copied ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
        background: copied ? 'rgba(34,197,94,0.12)' : 'var(--panel-alt)',
        color: copied ? '#22c55e' : 'var(--muted)', cursor: 'pointer',
        fontSize: 10, fontWeight: 600, transition: 'all 0.15s', flexShrink: 0,
      }}
      onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; } }}
      onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; } }}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ── Color Swatch ────────────────────────────────────────────────────────────
function ColorDot({ hex }: { hex: string }) {
  if (!hex.startsWith('#') || hex.length < 4) return null;
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: 2,
      background: hex, border: '1px solid rgba(255,255,255,0.15)',
      flexShrink: 0, verticalAlign: 'middle', marginRight: 4,
    }} />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shape: Shape | null;
}

export function DevSpecPanel({ open, onClose, shape }: Props) {
  const [activeTab, setActiveTab] = useState<'spec' | 'css' | 'json' | 'markdown' | 'react'>('spec');

  const entries = shape ? buildSpec(shape) : [];
  const css = shape ? buildCss(shape, entries) : '';
  const markdown = shape ? buildMarkdown(shape, entries) : '';
  const json = shape ? buildJsonSpec(shape) : '';
  const tsx = shape ? buildReactTsx(shape) : '';

  if (!open || !shape) return null;

  // Group entries by category
  const grouped: Record<string, SpecEntry[]> = {};
  for (const e of entries) {
    (grouped[e.category] ??= []).push(e);
  }

  const CATEGORY_COLORS: Record<string, string> = {
    Dimensions: '#60a5fa',
    Appearance: '#c084fc',
    Fill: '#f472b6',
    Border: '#34d399',
    'Border Radius': '#34d399',
    Shadow: '#94a3b8',
    Typography: '#fbbf24',
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 284,
        top: 60,
        bottom: 0,
        width: 280,
        zIndex: 300,
        background: 'var(--panel)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        fontSize: 12,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.25)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {/* Type badge */}
        <div style={{
          fontSize: 9, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase',
          letterSpacing: '0.07em', background: 'rgba(99,102,241,0.1)', borderRadius: 4,
          padding: '2px 6px', flexShrink: 0,
        }}>
          {shape.type}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shape.name || 'Unnamed'}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 5, display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Dimension summary bar */}
      <div style={{
        display: 'flex', gap: 0, padding: '6px 12px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
        background: 'var(--panel-alt)',
      }}>
        {[
          { label: 'W', value: Math.round(shape.width) },
          { label: 'H', value: Math.round(shape.height) },
          { label: 'X', value: Math.round(shape.x) },
          { label: 'Y', value: Math.round(shape.y) },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {(['spec', 'css', 'json', 'markdown', 'react'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, height: 32, border: 'none', cursor: 'pointer',
              background: activeTab === tab ? 'var(--bg)' : 'var(--panel)',
              color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
              fontSize: 10, fontWeight: activeTab === tab ? 700 : 500,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => { if (activeTab !== tab) e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { if (activeTab !== tab) e.currentTarget.style.color = 'var(--muted)'; }}
          >
            {tab === 'markdown' ? 'MD' : tab === 'react' ? 'TSX' : tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {activeTab === 'spec' && (
          <div style={{ padding: '8px 0' }}>
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} style={{ marginBottom: 4 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px 6px', position: 'sticky', top: 0,
                  background: 'var(--panel)', zIndex: 1,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: 1,
                    background: CATEGORY_COLORS[category] ?? 'var(--accent)',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {category}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {items.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 12px',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                        borderBottom: '1px solid transparent',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'; }}
                    >
                      <span style={{ fontSize: 10, color: 'var(--subtle)', width: 90, flexShrink: 0 }}>{item.label}</span>
                      <span style={{
                        fontSize: 10.5, color: 'var(--text)', flex: 1, fontFamily: 'monospace',
                        display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap',
                        wordBreak: 'break-all',
                      }}>
                        {/^#[0-9a-fA-F]{3,8}$/i.test(item.value) && <ColorDot hex={item.value} />}
                        {item.value}
                      </span>
                      {item.cssVar && (
                        <button
                          onClick={() => navigator.clipboard.writeText(item.value).catch(() => {})}
                          title={`Copy: ${item.value}`}
                          style={{
                            flexShrink: 0, background: 'none', border: 'none',
                            cursor: 'pointer', color: 'var(--subtle)', padding: 2, borderRadius: 3,
                            opacity: 0, transition: 'opacity 0.1s',
                            display: 'flex', alignItems: 'center',
                          }}
                          className="spec-copy-btn"
                        >
                          <Copy size={9} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {entries.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--subtle)', fontSize: 11 }}>
                No spec available for this shape
              </div>
            )}
          </div>
        )}

        {activeTab === 'css' && (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <CopyButton text={css} label="Copy CSS" />
            </div>
            <pre style={{
              margin: 0, padding: '10px 12px',
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 11, fontFamily: 'monospace',
              color: 'var(--text)', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {css}
            </pre>
          </div>
        )}

        {activeTab === 'json' && (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <CopyButton text={json} label="Copy JSON" />
            </div>
            <pre style={{
              margin: 0, padding: '10px 12px',
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 11, fontFamily: 'monospace',
              color: 'var(--text)', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {json}
            </pre>
          </div>
        )}

        {activeTab === 'markdown' && (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <CopyButton text={markdown} label="Copy Markdown" />
            </div>
            <pre style={{
              margin: 0, padding: '10px 12px',
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 11, fontFamily: 'monospace',
              color: 'var(--text)', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {markdown}
            </pre>
          </div>
        )}

        {activeTab === 'react' && (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: 'var(--subtle)' }}>Functional React component with inline styles</span>
              <CopyButton text={tsx} label="Copy TSX" />
            </div>
            <pre style={{
              margin: 0, padding: '10px 12px',
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 10.5, fontFamily: 'monospace',
              color: 'var(--text)', lineHeight: 1.65,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              overflowX: 'auto',
            }}>
              {tsx}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 12px', borderTop: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 9.5, color: 'var(--subtle)' }}>Developer Handoff</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <CopyButton text={css} label="CSS" />
          <CopyButton text={json} label="JSON" />
        </div>
      </div>
    </div>
  );
}
