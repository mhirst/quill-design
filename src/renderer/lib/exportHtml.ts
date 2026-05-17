/**
 * exportHtml.ts — wraps canvas shapes in a standalone HTML file.
 *
 * Uses buildShapeStyle() for CSS (same as the live canvas renderer) and
 * serialises each shape as a <div> with inline styles. Includes Tailwind CDN
 * so any Tailwind classes would also resolve, but all positioning/appearance
 * is done via inline styles so no Tailwind dependency is strictly needed.
 */

import type { Shape } from './shapes';
import { buildShapeStyle } from './shapes';

// ── Style object → inline CSS string ──────────────────────────────────────────

function styleToInline(obj: Record<string, string | number>): string {
  return Object.entries(obj)
    .map(([k, v]) => {
      // camelCase → kebab-case
      const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${prop}:${typeof v === 'number' && !['opacity', 'lineHeight', 'fontWeight', 'zIndex', 'flexGrow', 'flexShrink'].includes(k) ? `${v}px` : v}`;
    })
    .join(';');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Per-shape HTML emitter ────────────────────────────────────────────────────

function shapeToHtml(s: Shape): string {
  const styleObj = buildShapeStyle(s) as Record<string, string | number>;
  const inline = styleToInline(styleObj);

  if (s.type === 'text') {
    return `  <div style="${inline}">${esc(s.text)}</div>`;
  }

  return `  <div style="${inline}"></div>`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function shapesToHtml(shapes: Shape[]): string {
  if (shapes.length === 0) return '<!DOCTYPE html><html><body></body></html>';

  const maxX = Math.max(...shapes.map(s => s.x + s.width));
  const maxY = Math.max(...shapes.map(s => s.y + s.height));

  const divs = shapes
    .filter(s => s.type !== 'frame' || !s.iframeJsx) // skip iframe-backed frames
    .map(shapeToHtml)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quill Export</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; }
  </style>
</head>
<body>
<div style="position:relative;width:${maxX}px;height:${maxY}px;">
${divs}
</div>
</body>
</html>`;
}
