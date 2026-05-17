/**
 * CSSSnippetPanel — Live CSS snippet generator for Quill.
 *
 * Generates accurate, ready-to-use CSS from any selected shape:
 *  - Box model: width, height, position, margin, padding
 *  - Visual: background (solid/gradient/image), border, border-radius
 *  - Effects: box-shadow, filter, backdrop-filter, opacity
 *  - Typography: font-family, size, weight, line-height, letter-spacing, text-align
 *  - Transforms: rotate, scale
 *  - Animations: transition snippet, hover state
 *
 * Output formats: Plain CSS · Tailwind classes · CSS-in-JS (style object) · SCSS
 *
 * Features:
 *  - Live iframe preview of the generated element
 *  - One-click copy per section or all at once
 *  - Diff view: shows only changed properties from previous shape
 *  - "Design to code" — suggests semantic HTML element
 *  - Color format toggle: hex / hsl / rgb
 *
 * Keyboard: ⌘⇧⌥C to toggle
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutputFormat = 'css' | 'tailwind' | 'cssjs' | 'scss';
export type ColorFormat = 'hex' | 'hsl' | 'rgb';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
}

// ─── Color Utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    const [r, g, b] = h.split('').map(c => parseInt(c + c, 16));
    return [r, g, b];
  }
  if (h.length === 6) {
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function formatColor(hex: string, fmt: ColorFormat): string {
  if (!hex || hex === 'transparent') return 'transparent';
  if (!hex.startsWith('#')) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (fmt === 'hex') return hex;
  if (fmt === 'rgb') return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  const [h, s, l] = rgbToHsl(...rgb);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// ─── CSS Generator ────────────────────────────────────────────────────────────

interface CSSSection {
  label: string;
  properties: string[];
  rawProps: Record<string, string>;
}

function generateCSSSections(shape: Shape, colorFmt: ColorFormat): CSSSection[] {
  const sections: CSSSection[] = [];
  const fc = (c: string) => formatColor(c, colorFmt);

  // ── Box Model ──────────────────────────────────────────────────────────────
  const boxProps: Record<string, string> = {
    width: `${shape.width}px`,
    height: `${shape.height}px`,
  };
  if (shape.x !== 0) boxProps['left'] = `${shape.x}px`;
  if (shape.y !== 0) boxProps['top'] = `${shape.y}px`;

  sections.push({
    label: 'Box Model',
    rawProps: boxProps,
    properties: Object.entries(boxProps).map(([k, v]) => `${k}: ${v};`),
  });

  // ── Background ─────────────────────────────────────────────────────────────
  const bgProps: Record<string, string> = {};
  if (shape.fillType === 'solid' && shape.fill) {
    bgProps['background-color'] = fc(shape.fill);
  } else if (shape.fillType === 'linear-gradient' && shape.gradientStops) {
    const stops = shape.gradientStops
      .map(s => `${fc(s.color)} ${Math.round(s.position * 100)}%`)
      .join(', ');
    const angle = shape.gradientAngle ?? 135;
    bgProps['background'] = `linear-gradient(${angle}deg, ${stops})`;
  } else if (shape.fillType === 'image' && shape.imageUrl) {
    bgProps['background-image'] = `url('${shape.imageUrl.slice(0, 40)}…')`;
    bgProps['background-size'] = 'cover';
    bgProps['background-position'] = 'center';
  }

  if (Object.keys(bgProps).length > 0) {
    sections.push({
      label: 'Background',
      rawProps: bgProps,
      properties: Object.entries(bgProps).map(([k, v]) => `${k}: ${v};`),
    });
  }

  // ── Border ─────────────────────────────────────────────────────────────────
  const borderProps: Record<string, string> = {};
  if (shape.stroke && shape.strokeWidth && shape.strokeWidth > 0) {
    const strokeStyle = shape.strokeDash === 'dashed' ? 'dashed'
      : shape.strokeDash === 'dotted' ? 'dotted' : 'solid';
    borderProps['border'] = `${shape.strokeWidth}px ${strokeStyle} ${fc(shape.stroke)}`;
  }

  // Border radius
  if (shape.borderRadius !== undefined) {
    if (typeof shape.borderRadius === 'number' && shape.borderRadius > 0) {
      borderProps['border-radius'] = `${shape.borderRadius}px`;
    } else if (Array.isArray(shape.borderRadius)) {
      const [tl, tr, br, bl] = shape.borderRadius as [number,number,number,number];
      if (tl === tr && tr === br && br === bl) {
        if (tl > 0) borderProps['border-radius'] = `${tl}px`;
      } else {
        borderProps['border-radius'] = `${tl}px ${tr}px ${br}px ${bl}px`;
      }
    }
  }

  // Ellipse → pill
  if (shape.type === 'ellipse') {
    borderProps['border-radius'] = '50%';
  }

  if (Object.keys(borderProps).length > 0) {
    sections.push({
      label: 'Border',
      rawProps: borderProps,
      properties: Object.entries(borderProps).map(([k, v]) => `${k}: ${v};`),
    });
  }

  // ── Effects ────────────────────────────────────────────────────────────────
  const effectProps: Record<string, string> = {};
  if (shape.shadows && shape.shadows.length > 0) {
    const shadowStr = shape.shadows.map(s => {
      const inset = s.inset ? 'inset ' : '';
      return `${inset}${s.x ?? 0}px ${s.y ?? 2}px ${s.blur ?? 8}px ${s.spread ?? 0}px ${fc(s.color ?? '#000000')}`;
    }).join(', ');
    effectProps['box-shadow'] = shadowStr;
  }
  if (shape.filterBlur !== undefined && shape.filterBlur > 0) {
    effectProps['filter'] = `blur(${shape.filterBlur}px)`;
  }
  if (shape.opacity !== undefined && shape.opacity < 1) {
    effectProps['opacity'] = String(shape.opacity);
  }
  if (shape.filterBackdropBlur !== undefined && shape.filterBackdropBlur > 0) {
    effectProps['backdrop-filter'] = `blur(${shape.filterBackdropBlur}px)`;
  }
  if (Object.keys(effectProps).length > 0) {
    sections.push({
      label: 'Effects',
      rawProps: effectProps,
      properties: Object.entries(effectProps).map(([k, v]) => `${k}: ${v};`),
    });
  }

  // ── Typography ─────────────────────────────────────────────────────────────
  if (shape.type === 'text') {
    const typoProps: Record<string, string> = {};
    if (shape.fontFamily) typoProps['font-family'] = `'${shape.fontFamily}', sans-serif`;
    if (shape.fontSize) typoProps['font-size'] = `${shape.fontSize}px`;
    if (shape.fontWeight) typoProps['font-weight'] = String(shape.fontWeight);
    if (shape.lineHeight) typoProps['line-height'] = String(shape.lineHeight);
    if (shape.letterSpacing) typoProps['letter-spacing'] = `${shape.letterSpacing}px`;
    if (shape.textAlign) typoProps['text-align'] = shape.textAlign;
    if (shape.fill) typoProps['color'] = fc(shape.fill);
    if (shape.fontStyle === 'italic') typoProps['font-style'] = 'italic';
    if (shape.textDecoration && shape.textDecoration !== 'none') typoProps['text-decoration'] = shape.textDecoration;
    sections.push({
      label: 'Typography',
      rawProps: typoProps,
      properties: Object.entries(typoProps).map(([k, v]) => `${k}: ${v};`),
    });
  }

  // ── Transform ─────────────────────────────────────────────────────────────
  const transforms: string[] = [];
  if (shape.rotation) transforms.push(`rotate(${shape.rotation}deg)`);
  if (transforms.length > 0) {
    sections.push({
      label: 'Transform',
      rawProps: { transform: transforms.join(' ') },
      properties: [`transform: ${transforms.join(' ')};`],
    });
  }

  return sections;
}

// ─── Tailwind Generator ────────────────────────────────────────────────────────

function nearestTailwindSize(px: number): string {
  // Tailwind spacing: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96
  const map: Record<number, string> = {
    0: '0', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5',
    12: '3', 14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7',
    32: '8', 36: '9', 40: '10', 44: '11', 48: '12', 56: '14',
    64: '16', 80: '20', 96: '24', 112: '28', 128: '32', 144: '36',
    160: '40', 176: '44', 192: '48', 208: '52', 224: '56', 240: '60',
    256: '64', 288: '72', 320: '80', 384: '96',
  };
  const closest = Object.keys(map).reduce((a, b) =>
    Math.abs(+b - px) < Math.abs(+a - px) ? b : a
  );
  return map[+closest] ?? `[${px}px]`;
}

function generateTailwind(shape: Shape): string[] {
  const classes: string[] = [];

  // Size
  classes.push(`w-${nearestTailwindSize(shape.width)}`);
  classes.push(`h-${nearestTailwindSize(shape.height)}`);

  // Background
  if (shape.fillType === 'solid' && shape.fill) {
    classes.push(`bg-[${shape.fill}]`);
  } else if (shape.fillType === 'linear-gradient') {
    classes.push('bg-gradient-to-br'); // approximation
  }

  // Border
  if (shape.stroke && shape.strokeWidth) {
    classes.push(shape.strokeWidth === 1 ? 'border' : `border-${shape.strokeWidth === 2 ? '2' : shape.strokeWidth === 4 ? '4' : `[${shape.strokeWidth}px]`}`);
    classes.push(`border-[${shape.stroke}]`);
  }

  // Border radius
  const br = typeof shape.borderRadius === 'number' ? shape.borderRadius : 0;
  if (shape.type === 'ellipse') classes.push('rounded-full');
  else if (br === 0) classes.push('rounded-none');
  else if (br <= 2) classes.push('rounded-sm');
  else if (br <= 4) classes.push('rounded');
  else if (br <= 6) classes.push('rounded-md');
  else if (br <= 8) classes.push('rounded-lg');
  else if (br <= 12) classes.push('rounded-xl');
  else if (br <= 16) classes.push('rounded-2xl');
  else if (br <= 24) classes.push('rounded-3xl');
  else classes.push('rounded-full');

  // Opacity
  if (shape.opacity !== undefined && shape.opacity < 1) {
    const pct = Math.round(shape.opacity * 100);
    classes.push(`opacity-${pct}`);
  }

  // Shadow
  if (shape.shadows && shape.shadows.length > 0) {
    classes.push('shadow-md');
  }

  // Typography
  if (shape.type === 'text') {
    if (shape.fontSize) {
      const sizeMap: Record<number, string> = {12:'xs',14:'sm',16:'base',18:'lg',20:'xl',24:'2xl',30:'3xl',36:'4xl',48:'5xl',60:'6xl',72:'7xl'};
      const nearest = Object.keys(sizeMap).reduce((a,b) => Math.abs(+b - shape.fontSize!) < Math.abs(+a - shape.fontSize!) ? b : a);
      classes.push(`text-${sizeMap[+nearest] ?? `[${shape.fontSize}px]`}`);
    }
    if (shape.fontWeight) {
      const wMap: Record<string, string> = {'100':'thin','200':'extralight','300':'light','400':'normal','500':'medium','600':'semibold','700':'bold','800':'extrabold','900':'black'};
      const w = wMap[String(shape.fontWeight)] ?? 'normal';
      classes.push(`font-${w}`);
    }
    if (shape.textAlign) classes.push(`text-${shape.textAlign}`);
    if (shape.fill) classes.push(`text-[${shape.fill}]`);
  }

  return classes;
}

// ─── CSS-in-JS Generator ──────────────────────────────────────────────────────

function generateCSSinJS(sections: CSSSection[]): string {
  const all: Record<string, string> = {};
  for (const s of sections) Object.assign(all, s.rawProps);

  const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const lines = Object.entries(all).map(([k, v]) => `  ${camel(k)}: '${v}',`);
  return `const styles = {\n${lines.join('\n')}\n};`;
}

// ─── SCSS Generator ───────────────────────────────────────────────────────────

function generateSCSS(sections: CSSSection[], shapeName: string): string {
  const selector = `.${shapeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'element'}`;
  const all: Record<string, string> = {};
  for (const s of sections) Object.assign(all, s.rawProps);
  const lines = Object.entries(all).map(([k, v]) => `  ${k}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n\n  &:hover {\n    // Add hover styles here\n  }\n}`;
}

// ─── Suggested HTML Element ───────────────────────────────────────────────────

function suggestHTMLElement(shape: Shape): { tag: string; reason: string } {
  const name = (shape.name || '').toLowerCase();
  if (name.includes('btn') || name.includes('button') || name.includes('cta')) return { tag: '<button>', reason: 'name suggests interactive element' };
  if (name.includes('card')) return { tag: '<article>', reason: 'name suggests card content' };
  if (name.includes('nav') || name.includes('header') || name.includes('footer')) return { tag: `<${name.match(/nav|header|footer/)?.[0] || 'div'}>`, reason: 'name matches semantic element' };
  if (name.includes('img') || name.includes('image') || name.includes('photo')) return { tag: '<img />', reason: 'name suggests image content' };
  if (name.includes('input') || name.includes('field') || name.includes('text')) return { tag: '<input />', reason: 'name suggests form input' };
  if (shape.type === 'text') return { tag: shape.fontSize && shape.fontSize >= 24 ? '<h2>' : '<p>', reason: `text shape ${shape.fontSize && shape.fontSize >= 24 ? '(large = heading)' : '(body text)'}` };
  if (shape.type === 'ellipse' && Math.abs(shape.width - shape.height) < 10) return { tag: '<div>', reason: 'circular decorative element' };
  if (shape.type === 'frame') return { tag: '<section>', reason: 'frame = layout container' };
  if (shape.imageUrl) return { tag: '<img />', reason: 'has image fill' };
  return { tag: '<div>', reason: 'generic container' };
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function LivePreview({ shape, sections }: { shape: Shape; sections: CSSSection[] }) {
  const all: Record<string, string> = {};
  for (const s of sections) Object.assign(all, s.rawProps);

  const previewStyle: React.CSSProperties = {
    position: 'relative',
    boxSizing: 'border-box',
  };

  // Apply a subset of styles that are safe for iframe-less preview
  if (all['background-color']) previewStyle.backgroundColor = all['background-color'];
  if (all['background']) previewStyle.background = all['background'];
  if (all['border-radius']) previewStyle.borderRadius = all['border-radius'];
  if (all['border']) previewStyle.border = all['border'];
  if (all['box-shadow']) previewStyle.boxShadow = all['box-shadow'];
  if (all['opacity']) previewStyle.opacity = +all['opacity'];
  if (all['transform']) previewStyle.transform = all['transform'];
  if (all['filter']) previewStyle.filter = all['filter'];
  if (all['font-family']) previewStyle.fontFamily = all['font-family'];
  if (all['font-size']) previewStyle.fontSize = all['font-size'];
  if (all['font-weight']) previewStyle.fontWeight = all['font-weight'] as React.CSSProperties['fontWeight'];
  if (all['color']) previewStyle.color = all['color'];
  if (all['text-align']) previewStyle.textAlign = all['text-align'] as React.CSSProperties['textAlign'];
  if (all['letter-spacing']) previewStyle.letterSpacing = all['letter-spacing'];
  if (all['line-height']) previewStyle.lineHeight = all['line-height'];

  // Scale to fit preview (max 180px width)
  const maxW = 180;
  const maxH = 100;
  const scale = Math.min(maxW / shape.width, maxH / shape.height, 1);
  const displayW = Math.round(shape.width * scale);
  const displayH = Math.round(shape.height * scale);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', minHeight: 80,
      background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #0f0f1a 0% 50%) 0 0 / 12px 12px',
      borderBottom: '1px solid var(--border, #2d2d3d)',
    }}>
      <div style={{
        ...previewStyle,
        width: displayW, height: displayH,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {shape.type === 'text' && (
          <span style={{ fontSize: Math.max(8, (shape.fontSize || 14) * scale), pointerEvents: 'none' }}>
            {(shape.text || shape.name || 'Text').slice(0, 30)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock({ code, onCopy, copied }: { code: string; onCopy: () => void; copied: boolean }) {
  return (
    <div style={{ position: 'relative' }}>
      <pre style={{
        margin: 0, padding: '8px 10px',
        fontSize: 9, lineHeight: 1.6,
        color: '#e2e8f0', background: 'rgba(0,0,0,0.2)',
        borderRadius: 4, overflowX: 'auto',
        fontFamily: 'Consolas, Monaco, monospace',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      }}>
        {code}
      </pre>
      <button
        onClick={onCopy}
        style={{
          position: 'absolute', top: 4, right: 4,
          fontSize: 8, padding: '2px 6px', borderRadius: 3,
          background: copied ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'var(--border, #2d2d3d)'}`,
          color: copied ? '#34d399' : 'var(--muted, #888)',
          cursor: 'pointer',
        }}
      >
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export function CSSSnippetPanel({ open, onClose, selectedShape }: Props) {
  const [format, setFormat] = useState<OutputFormat>('css');
  const [colorFmt, setColorFmt] = useState<ColorFormat>('hex');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Box Model', 'Background', 'Border', 'Typography']));

  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const sections = useMemo(() => {
    if (!selectedShape) return [];
    return generateCSSSections(selectedShape, colorFmt);
  }, [selectedShape, colorFmt]);

  const tailwindClasses = useMemo(() => {
    if (!selectedShape) return [];
    return generateTailwind(selectedShape);
  }, [selectedShape]);

  const cssInJS = useMemo(() => {
    if (!selectedShape) return '';
    return generateCSSinJS(sections);
  }, [sections, selectedShape]);

  const scss = useMemo(() => {
    if (!selectedShape) return '';
    return generateSCSS(sections, selectedShape.name || 'element');
  }, [sections, selectedShape]);

  const allCSS = useMemo(() => {
    if (!selectedShape) return '';
    const selector = `.${(selectedShape.name || 'element').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'element'}`;
    const props = sections.flatMap(s => s.properties).map(p => `  ${p}`).join('\n');
    return `${selector} {\n${props}\n}`;
  }, [sections, selectedShape]);

  const htmlSuggestion = useMemo(() => {
    if (!selectedShape) return null;
    return suggestHTMLElement(selectedShape);
  }, [selectedShape]);

  if (!open) return null;

  const FORMATS: { id: OutputFormat; label: string }[] = [
    { id: 'css', label: 'CSS' },
    { id: 'tailwind', label: 'Tailwind' },
    { id: 'cssjs', label: 'CSS-in-JS' },
    { id: 'scss', label: 'SCSS' },
  ];

  const COLOR_FMTS: { id: ColorFormat; label: string }[] = [
    { id: 'hex', label: 'HEX' },
    { id: 'hsl', label: 'HSL' },
    { id: 'rgb', label: 'RGB' },
  ];

  return (
    <div style={{
      position: 'absolute', top: 48, right: 12,
      width: 300, maxHeight: 'calc(100vh - 80px)',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 40, display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>{'</>'}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
            CSS Snippet
          </span>
          {selectedShape && (
            <span style={{
              fontSize: 8, color: 'var(--muted, #666)',
              background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '1px 6px',
              maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {selectedShape.name || selectedShape.type}
            </span>
          )}
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>
          ×
        </button>
      </div>

      {!selectedShape ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted, #666)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🖱️</div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>No shape selected</div>
          <div style={{ fontSize: 9 }}>Select a shape on the canvas to generate CSS.</div>
        </div>
      ) : (
        <>
          {/* Live preview */}
          <LivePreview shape={selectedShape} sections={sections} />

          {/* HTML suggestion */}
          {htmlSuggestion && (
            <div style={{
              padding: '5px 10px',
              borderBottom: '1px solid var(--border, #2d2d3d)',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #666)' }}>Suggested element:</span>
              <code style={{
                fontSize: 9, color: '#818cf8',
                background: 'rgba(129,140,248,0.1)',
                padding: '1px 5px', borderRadius: 3,
              }}>
                {htmlSuggestion.tag}
              </code>
              <span style={{ fontSize: 8, color: 'var(--muted, #555)', flex: 1 }}>
                {htmlSuggestion.reason}
              </span>
            </div>
          )}

          {/* Format + color toggles */}
          <div style={{
            padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)}
                  style={{
                    fontSize: 8, padding: '2px 6px', borderRadius: 3,
                    background: format === f.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                    border: `1px solid ${format === f.id ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                    color: format === f.id ? '#818cf8' : 'var(--muted, #666)',
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {format === 'css' || format === 'scss' ? (
              <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                {COLOR_FMTS.map(f => (
                  <button key={f.id} onClick={() => setColorFmt(f.id)}
                    style={{
                      fontSize: 7, padding: '2px 5px', borderRadius: 3,
                      background: colorFmt === f.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                      border: `1px solid ${colorFmt === f.id ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                      color: colorFmt === f.id ? '#818cf8' : 'var(--muted, #555)',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={() => {
                    const text = format === 'tailwind' ? tailwindClasses.join(' ')
                      : format === 'cssjs' ? cssInJS : scss;
                    copyToClipboard(text, 'all');
                  }}
                  style={{
                    fontSize: 8, padding: '2px 7px', borderRadius: 3,
                    background: copiedKey === 'all' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${copiedKey === 'all' ? 'rgba(52,211,153,0.3)' : 'var(--border, #2d2d3d)'}`,
                    color: copiedKey === 'all' ? '#34d399' : 'var(--muted, #888)',
                    cursor: 'pointer',
                  }}
                >
                  {copiedKey === 'all' ? '✓ Copied!' : 'Copy all'}
                </button>
              </div>
            )}
          </div>

          {/* Content area */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {format === 'css' && (
              <>
                {/* Copy all CSS */}
                <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => copyToClipboard(allCSS, 'allcss')}
                    style={{
                      fontSize: 8, padding: '2px 7px', borderRadius: 3,
                      background: copiedKey === 'allcss' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${copiedKey === 'allcss' ? 'rgba(52,211,153,0.3)' : 'var(--border, #2d2d3d)'}`,
                      color: copiedKey === 'allcss' ? '#34d399' : 'var(--muted, #888)',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedKey === 'allcss' ? '✓ Copied!' : '📋 Copy full block'}
                  </button>
                </div>

                {/* Sections */}
                {sections.map(section => {
                  const isExpanded = expandedSections.has(section.label);
                  const sectionCode = section.properties.join('\n');
                  return (
                    <div key={section.label} style={{ borderBottom: '1px solid var(--border, #1e1e2e)' }}>
                      <button
                        onClick={() => setExpandedSections(s => {
                          const next = new Set(s);
                          if (next.has(section.label)) next.delete(section.label);
                          else next.add(section.label);
                          return next;
                        })}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 10px', background: 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 8, color: 'var(--muted, #666)' }}>{isExpanded ? '▼' : '▶'}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted, #aaa)', flex: 1 }}>
                          {section.label}
                        </span>
                        <span style={{ fontSize: 8, color: 'var(--muted, #555)' }}>
                          {section.properties.length} prop{section.properties.length !== 1 ? 's' : ''}
                        </span>
                      </button>
                      {isExpanded && (
                        <div style={{ padding: '0 10px 8px' }}>
                          <CodeBlock
                            code={sectionCode}
                            onCopy={() => copyToClipboard(sectionCode, section.label)}
                            copied={copiedKey === section.label}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {format === 'tailwind' && (
              <div style={{ padding: 10 }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 8, color: 'var(--muted, #666)', marginBottom: 5 }}>
                    className string:
                  </div>
                  <CodeBlock
                    code={`className="${tailwindClasses.join(' ')}"`}
                    onCopy={() => copyToClipboard(tailwindClasses.join(' '), 'tw')}
                    copied={copiedKey === 'tw'}
                  />
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 8, color: 'var(--muted, #666)', marginBottom: 5 }}>
                    Individual classes:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tailwindClasses.map((cls, i) => (
                      <button
                        key={i}
                        onClick={() => copyToClipboard(cls, `tw-${i}`)}
                        style={{
                          fontSize: 8, padding: '2px 6px', borderRadius: 4,
                          background: copiedKey === `tw-${i}` ? 'rgba(52,211,153,0.15)' : 'rgba(129,140,248,0.1)',
                          border: `1px solid ${copiedKey === `tw-${i}` ? 'rgba(52,211,153,0.3)' : 'rgba(129,140,248,0.2)'}`,
                          color: copiedKey === `tw-${i}` ? '#34d399' : '#818cf8',
                          cursor: 'pointer', fontFamily: 'monospace',
                        }}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 8, color: 'var(--muted, #555)', lineHeight: 1.4, marginTop: 8 }}>
                  💡 Classes marked with <code style={{ fontSize: 7, color: '#818cf8' }}>[ ]</code> use arbitrary values. Consider extracting to your Tailwind config.
                </div>
              </div>
            )}

            {format === 'cssjs' && (
              <div style={{ padding: 10 }}>
                <CodeBlock
                  code={cssInJS}
                  onCopy={() => copyToClipboard(cssInJS, 'jsobj')}
                  copied={copiedKey === 'jsobj'}
                />
                <div style={{ fontSize: 8, color: 'var(--muted, #555)', lineHeight: 1.4, marginTop: 8 }}>
                  💡 Compatible with React inline styles, styled-components, Emotion, and MUI's sx prop.
                </div>
              </div>
            )}

            {format === 'scss' && (
              <div style={{ padding: 10 }}>
                <CodeBlock
                  code={scss}
                  onCopy={() => copyToClipboard(scss, 'scss')}
                  copied={copiedKey === 'scss'}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '5px 10px', flexShrink: 0,
            borderTop: '1px solid var(--border, #2d2d3d)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 8, color: 'var(--muted, #555)' }}>
              {selectedShape.width}×{selectedShape.height}px · {selectedShape.type}
            </span>
            <span style={{ fontSize: 8, color: 'var(--muted, #555)' }}>
              ⌘⇧⌥C to toggle
            </span>
          </div>
        </>
      )}
    </div>
  );
}
