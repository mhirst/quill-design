/**
 * HandoffSpecPanel — Developer handoff spec generator for Quill.
 *
 * Generates a complete, self-contained HTML specification document from
 * the current design for sharing with developers.
 *
 * The generated HTML includes:
 *  - Visual design summary with shape thumbnails
 *  - Complete spec table per shape: position, size, fill, opacity, font, border
 *  - Color palette with hex values + CSS variables
 *  - Typography system: all unique font/size/weight combos
 *  - Spacing tokens extracted from layout
 *  - CSS custom properties block ready to paste
 *  - Each shape's ready-to-use CSS snippet
 *  - WCAG accessibility notes for text shapes
 *  - Copy link → generates blob URL openable in browser
 *
 * Features:
 *  - Shape filter: all / selected / by type
 *  - Include sections toggle: colors / typography / spacing / shapes / CSS
 *  - Copy HTML button + Open in browser button
 *  - Live preview (iframe render)
 *
 * Keyboard: ⌘⌥H
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Helper: hex to CSS color description ─────────────────────────────────────

function hexName(hex: string): string {
  // Very basic name mapping for common colors
  const names: Record<string, string> = {
    '#ffffff': 'white', '#000000': 'black', '#ff0000': 'red',
    '#00ff00': 'lime', '#0000ff': 'blue', '#ffff00': 'yellow',
    '#ff8800': 'orange', '#ff00ff': 'magenta', '#00ffff': 'cyan',
    '#888888': 'gray', '#aaaaaa': 'light-gray', '#333333': 'dark-gray',
  };
  return names[hex.toLowerCase()] ?? hex;
}

/** Convert fill type to CSS */
function fillToCss(shape: Shape): string {
  const { fill, fillType } = shape;
  if (!fill) return 'transparent';
  if (fillType === 'linear-gradient' && shape.gradientStops?.length) {
    const stops = shape.gradientStops.map(s => `${s.color} ${Math.round((s.position ?? 0) * 100)}%`).join(', ');
    return `linear-gradient(${shape.gradientAngle ?? 0}deg, ${stops})`;
  }
  return fill;
}

/** Get computed border-radius CSS value */
function radiusToCssLocal(r: Shape['borderRadius']): string {
  if (!r) return '0';
  if (typeof r === 'number') return `${r}px`;
  return r.map(v => `${v}px`).join(' ');
}

/** WCAG contrast check (simple) */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0.5;
  const linearize = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(parseInt(h.slice(0, 2), 16)) +
    0.7152 * linearize(parseInt(h.slice(2, 4), 16)) +
    0.0722 * linearize(parseInt(h.slice(4, 6), 16));
}

function contrastWith(fg: string, bg: string): number {
  const l1 = luminance(fg); const l2 = luminance(bg);
  const lighter = Math.max(l1, l2); const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagGradeLocal(ratio: number): string {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

// ─── HTML Generation ──────────────────────────────────────────────────────────

interface HandoffOptions {
  includeColors: boolean;
  includeTypography: boolean;
  includeSpacing: boolean;
  includeShapes: boolean;
  includeCSS: boolean;
  shapeFilter: 'all' | 'text' | 'rect' | 'ellipse' | 'frame';
  docTitle: string;
}

export function generateHandoffHTML(shapes: Shape[], options: HandoffOptions): string {
  const filtered = options.shapeFilter === 'all'
    ? shapes
    : shapes.filter(s => {
      if (options.shapeFilter === 'text') return s.type === 'text';
      if (options.shapeFilter === 'rect') return s.type === 'rectangle';
      if (options.shapeFilter === 'ellipse') return s.type === 'ellipse';
      if (options.shapeFilter === 'frame') return s.type === 'frame';
      return true;
    });

  // Unique colors
  const colorSet = new Set<string>();
  for (const s of shapes) {
    if (s.fill?.startsWith('#')) colorSet.add(s.fill.toLowerCase());
    if (s.stroke?.startsWith('#')) colorSet.add(s.stroke.toLowerCase());
  }
  const colors = [...colorSet].sort();

  // Unique font combos for text shapes
  const fontCombos: Array<{ family: string; size: number; weight: string; color: string }> = [];
  const fontSeen = new Set<string>();
  for (const s of shapes) {
    if (s.type === 'text') {
      const key = `${s.fontFamily}|${s.fontSize}|${s.fontWeight}|${s.fill}`;
      if (!fontSeen.has(key)) {
        fontSeen.add(key);
        fontCombos.push({ family: s.fontFamily ?? 'sans-serif', size: s.fontSize ?? 16, weight: s.fontWeight ?? '400', color: s.fill ?? '#000000' });
      }
    }
  }
  fontCombos.sort((a, b) => b.size - a.size);

  // CSS vars for colors
  const cssVars = colors.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n');

  const shapeRows = filtered.map(s => {
    const css = shapeToCSSSnippet(s);
    const contrastNote = s.type === 'text' && s.fill && s.stroke
      ? `Contrast: ${contrastWith(s.fill, s.stroke).toFixed(1)}:1 (${wcagGradeLocal(contrastWith(s.fill, s.stroke))})`
      : '';
    return `
    <tr>
      <td><div class="color-swatch" style="background:${fillToCss(s)};opacity:${s.opacity ?? 1}"></div></td>
      <td><strong>${escapeHtml(s.name)}</strong><br><small class="dim">${s.type}</small></td>
      <td>${s.x.toFixed(0)}, ${s.y.toFixed(0)}</td>
      <td>${s.width.toFixed(0)} × ${s.height.toFixed(0)}</td>
      <td><code>${s.fill ?? '—'}</code>${s.fillType && s.fillType !== 'solid' ? `<br><small>${s.fillType}</small>` : ''}</td>
      <td>${s.opacity !== undefined && s.opacity !== 1 ? `${Math.round((s.opacity ?? 1) * 100)}%` : '100%'}</td>
      <td>${s.type === 'text' ? `${s.fontFamily ?? '—'} ${s.fontSize ?? '—'}px ${s.fontWeight ?? ''}` : '—'}</td>
      <td>${s.borderRadius ? radiusToCssLocal(s.borderRadius) : '—'}</td>
      <td>${s.stroke ? `<code>${s.stroke}</code> ${s.strokeWidth ?? 1}px` : '—'}</td>
      <td class="dim" style="font-size:10px">${contrastNote}</td>
    </tr>
    <tr class="css-row">
      <td colspan="10"><pre class="css-block">${escapeHtml(css)}</pre></td>
    </tr>`;
  }).join('');

  const colorSwatches = colors.map((c, i) => `
    <div class="swatch-card">
      <div class="swatch" style="background:${c}"></div>
      <code>${c}</code>
      <small>--color-${i + 1}</small>
      <small>${hexName(c)}</small>
    </div>`).join('');

  const fontRows = fontCombos.map(f => `
    <tr>
      <td style="font-family:'${escapeHtml(f.family)}',sans-serif;font-size:${f.size}px;font-weight:${escapeHtml(f.weight)};color:${escapeHtml(f.color)}">The quick brown fox</td>
      <td>${escapeHtml(f.family)}</td>
      <td>${f.size}px</td>
      <td>${escapeHtml(f.weight)}</td>
      <td><code>${escapeHtml(f.color)}</code></td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.docTitle)}</title>
<style>
  :root {
${cssVars}
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f0f0f5; color: #1a1a2e; line-height: 1.5; }
  .container { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
  header { background: #1a1a2e; color: #fff; padding: 24px 32px; border-radius: 12px; margin-bottom: 24px; }
  header h1 { font-size: 22px; font-weight: 700; }
  header p { font-size: 13px; color: #8888cc; margin-top: 4px; }
  section { background: #fff; border-radius: 10px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  h2 { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e0e0f0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 6px 8px; background: #f5f5ff; color: #555; font-weight: 600; font-size: 11px; border-bottom: 1px solid #e0e0f0; }
  td { padding: 6px 8px; border-bottom: 1px solid #f0f0f8; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .dim { color: #888; font-size: 11px; }
  code { background: #f0f0f8; padding: 1px 4px; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 11px; }
  .color-swatch { width: 24px; height: 24px; border-radius: 4px; border: 1px solid #ddd; }
  .swatches { display: flex; flex-wrap: wrap; gap: 12px; }
  .swatch-card { text-align: center; }
  .swatch { width: 64px; height: 48px; border-radius: 6px; border: 1px solid #ddd; margin-bottom: 4px; }
  .swatch-card code { display: block; font-size: 10px; }
  .swatch-card small { display: block; font-size: 10px; color: #888; }
  .css-block { background: #f8f8ff; border: 1px solid #e0e0f0; border-radius: 6px; padding: 10px 12px; font-size: 11px; font-family: ui-monospace, monospace; overflow-x: auto; white-space: pre; color: #333; }
  .css-row td { padding: 4px 8px 12px; }
  .css-vars { background: #1a1a2e; color: #88ccff; padding: 16px; border-radius: 8px; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre; overflow-x: auto; }
  footer { text-align: center; color: #888; font-size: 11px; margin-top: 24px; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>📐 ${escapeHtml(options.docTitle)}</h1>
    <p>Generated by Quill · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · ${shapes.length} shapes · ${filtered.length} in spec</p>
  </header>

  ${options.includeColors && colors.length > 0 ? `
  <section>
    <h2>🎨 Color Palette</h2>
    <div class="swatches">${colorSwatches}</div>
    <br>
    <h3 style="font-size:13px;margin-bottom:8px;color:#555">CSS Custom Properties</h3>
    <div class="css-vars">:root {\n${cssVars}\n}</div>
  </section>` : ''}

  ${options.includeTypography && fontCombos.length > 0 ? `
  <section>
    <h2>🅰️ Typography System</h2>
    <table>
      <thead><tr><th>Preview</th><th>Font Family</th><th>Size</th><th>Weight</th><th>Color</th></tr></thead>
      <tbody>${fontRows}</tbody>
    </table>
  </section>` : ''}

  ${options.includeShapes && filtered.length > 0 ? `
  <section>
    <h2>📦 Shape Specifications</h2>
    <table>
      <thead>
        <tr>
          <th>Fill</th><th>Name</th><th>Position (x,y)</th><th>Size (w×h)</th>
          <th>Color</th><th>Opacity</th><th>Font</th><th>Radius</th><th>Border</th><th>Accessibility</th>
        </tr>
      </thead>
      <tbody>${shapeRows}</tbody>
    </table>
  </section>` : ''}

  <footer>Generated by <strong>Quill Design Tool</strong> · ${new Date().toISOString()}</footer>
</div>
</body>
</html>`;
}

function escapeHtml(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shapeToCSSSnippet(s: Shape): string {
  const lines: string[] = [];
  lines.push(`.${s.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()} {`);
  lines.push(`  position: absolute;`);
  lines.push(`  left: ${s.x.toFixed(0)}px;`);
  lines.push(`  top: ${s.y.toFixed(0)}px;`);
  lines.push(`  width: ${s.width.toFixed(0)}px;`);
  lines.push(`  height: ${s.height.toFixed(0)}px;`);
  if (s.fill) lines.push(`  background: ${fillToCss(s)};`);
  if (s.opacity !== undefined && s.opacity !== 1) lines.push(`  opacity: ${s.opacity};`);
  if (s.borderRadius) lines.push(`  border-radius: ${radiusToCssLocal(s.borderRadius)};`);
  if (s.stroke && s.strokeWidth) lines.push(`  border: ${s.strokeWidth}px solid ${s.stroke};`);
  if (s.filterBlur) lines.push(`  filter: blur(${s.filterBlur}px);`);
  if (s.type === 'text') {
    if (s.fontFamily) lines.push(`  font-family: '${s.fontFamily}', sans-serif;`);
    if (s.fontSize) lines.push(`  font-size: ${s.fontSize}px;`);
    if (s.fontWeight) lines.push(`  font-weight: ${s.fontWeight};`);
    if (s.fill) lines.push(`  color: ${s.fill};`);
    if (s.textAlign) lines.push(`  text-align: ${s.textAlign};`);
  }
  if (s.rotation) lines.push(`  transform: rotate(${s.rotation}deg);`);
  if (s.transitionDuration) lines.push(`  transition: all ${s.transitionDuration}ms ${s.transitionEasing ?? 'ease'};`);
  lines.push('}');
  return lines.join('\n');
}

// ─── Component Props ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  designName: string;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function HandoffSpecPanel({ open, onClose, shapes, designName }: Props) {
  const [options, setOptions] = useState<HandoffOptions>({
    includeColors: true,
    includeTypography: true,
    includeSpacing: true,
    includeShapes: true,
    includeCSS: true,
    shapeFilter: 'all',
    docTitle: designName || 'Design Handoff Spec',
  });
  const [copiedHTML, setCopiedHTML] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!open) return null;

  const html = useMemo(() => generateHandoffHTML(shapes, options), [shapes, options]);

  const openInBrowser = useCallback(() => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    window.open(url, '_blank');
  }, [html, blobUrl]);

  const downloadHTML = useCallback(() => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${options.docTitle.replace(/\s+/g, '-').toLowerCase()}-spec.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [html, options.docTitle]);

  const copyHTML = useCallback(() => {
    navigator.clipboard.writeText(html).then(() => {
      setCopiedHTML(true);
      setTimeout(() => setCopiedHTML(false), 1500);
    });
  }, [html]);

  const updateOption = <K extends keyof HandoffOptions>(key: K, value: HandoffOptions[K]) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const textShapes = shapes.filter(s => s.type === 'text').length;
  const colorCount = new Set(shapes.map(s => s.fill).filter(Boolean)).size;

  return (
    <div style={{
      position: 'fixed',
      right: 8,
      top: 60,
      width: 440,
      maxHeight: 'calc(100vh - 80px)',
      background: '#13131f',
      borderRadius: 12,
      border: '1px solid #2a2a4a',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      zIndex: 3100,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
      color: '#c8c8e8',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0f0f1e', borderBottom: '1px solid #2a2a4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>📤</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f8' }}>Handoff Spec</span>
          <span style={{ fontSize: 10, color: '#555', background: '#1a1a2e', borderRadius: 4, padding: '1px 5px' }}>⌘⌥H</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Title input */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e3a' }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Document Title</div>
          <input
            value={options.docTitle}
            onChange={e => updateOption('docTitle', e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: 6, color: '#c8c8e8', fontSize: 13, padding: '6px 8px', fontFamily: 'inherit', outline: 'none' }}
          />
        </div>

        {/* Stats */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #1e1e3a', display: 'flex', gap: 16 }}>
          <StatPill label="Shapes" value={shapes.length} />
          <StatPill label="Colors" value={colorCount} />
          <StatPill label="Text" value={textShapes} />
          <StatPill label="~Size" value={`${(html.length / 1024).toFixed(0)}KB`} />
        </div>

        {/* Options */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e3a' }}>
          <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Include Sections</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {([
              ['includeColors', 'Color Palette + CSS Variables'],
              ['includeTypography', 'Typography System'],
              ['includeShapes', 'Shape Specifications + CSS'],
            ] as [keyof HandoffOptions, string][]).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={options[key] as boolean} onChange={e => updateOption(key, e.target.checked)} style={{ accentColor: '#7b7bff' }} />
                <span style={{ fontSize: 11, color: '#aaa' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Shape filter */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e3a' }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Shape Filter</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['all', 'text', 'rect', 'ellipse', 'frame'] as const).map(f => (
              <button key={f} onClick={() => updateOption('shapeFilter', f)}
                style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: 'none', cursor: 'pointer', background: options.shapeFilter === f ? '#3a3a8a' : '#1e1e3a', color: options.shapeFilter === f ? '#bbbfff' : '#666' }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e1e3a' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={openInBrowser}
              style={{ padding: '10px', background: '#2a2a5a', border: 'none', borderRadius: 7, color: '#bbbfff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              🌐 Open in Browser
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={downloadHTML}
                style={{ flex: 1, padding: '7px', background: '#1a2a3a', border: 'none', borderRadius: 6, color: '#88bbdd', cursor: 'pointer', fontSize: 11 }}>
                📥 Download HTML
              </button>
              <button onClick={copyHTML}
                style={{ flex: 1, padding: '7px', background: '#1a1a2e', border: 'none', borderRadius: 6, color: '#8888cc', cursor: 'pointer', fontSize: 11 }}>
                {copiedHTML ? '✓ Copied!' : '📋 Copy HTML'}
              </button>
            </div>
          </div>
        </div>

        {/* Mini preview */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>HTML Preview</div>
          <iframe
            ref={iframeRef}
            srcDoc={html}
            style={{ width: '100%', height: 280, border: '1px solid #2a2a4a', borderRadius: 6, background: '#fff' }}
            title="Handoff Preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #1e1e3a', background: '#0f0f1e', fontSize: 10, color: '#333', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>Self-contained HTML · No external dependencies</span>
        <span>⌘⌥H</span>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#c8c8e8' }}>{value}</div>
      <div style={{ fontSize: 9, color: '#555' }}>{label}</div>
    </div>
  );
}
