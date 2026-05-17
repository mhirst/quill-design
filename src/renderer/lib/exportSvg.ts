/**
 * exportSvg.ts — converts canvas shapes to an SVG string for download.
 *
 * Rendering strategy per shape type:
 *   rectangle / frame  →  <rect> with rx (uniform radius) or <path> for per-corner
 *   ellipse             →  <ellipse>
 *   text                →  <foreignObject> with a <div> (preserves wrap + fonts)
 *   path                →  <path> reusing buildPathD
 *
 * SVG doesn't support per-corner border-radius natively on <rect>, so we use
 * rx = max(corners) as a pragmatic approximation. For truly mixed radii the
 * shape is rendered via <path> with quadratic curves (same approach as the
 * canvas 2D renderer).
 */

import type { Shape } from './shapes';
import { buildPathD, normalizeRadius } from './shapes';

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colorWithOpacity(hex: string, opacity: number): string {
  if (opacity >= 1) return hex;
  return hex; // SVG uses fill-opacity separately
}

/** Build a rounded-rect SVG <path> d attribute for per-corner radii [TL,TR,BR,BL]. */
function roundedRectPath(x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number): string {
  const maxR = Math.min(w, h) / 2;
  const [rtl, rtr, rbr, rbl] = [Math.min(tl, maxR), Math.min(tr, maxR), Math.min(br, maxR), Math.min(bl, maxR)];
  return [
    `M ${x + rtl} ${y}`,
    `L ${x + w - rtr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rtr}`,
    `L ${x + w} ${y + h - rbr}`,
    `Q ${x + w} ${y + h} ${x + w - rbr} ${y + h}`,
    `L ${x + rbl} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - rbl}`,
    `L ${x} ${y + rtl}`,
    `Q ${x} ${y} ${x + rtl} ${y}`,
    'Z',
  ].join(' ');
}

/** Serialise a React CSSProperties-style object to an SVG style string. */
function styleObj(obj: Record<string, string | number>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
    .join(';');
}

// ── Per-shape SVG emitters ─────────────────────────────────────────────────────

function shapeToSvg(s: Shape): string {
  const rot = s.rotation !== 0
    ? ` transform="rotate(${s.rotation} ${s.x + s.width / 2} ${s.y + s.height / 2})"`
    : '';

  const commonFill = s.fill === 'transparent' ? 'none' : esc(s.fill);
  const fillOpAttr = s.fill !== 'transparent' && s.fillOpacity < 1 ? ` fill-opacity="${s.fillOpacity.toFixed(3)}"` : '';
  const strokeAttr = s.stroke !== 'transparent' && s.strokeWidth > 0
    ? ` stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}"`
    : ' stroke="none"';
  const opacityAttr = s.opacity < 1 ? ` opacity="${s.opacity.toFixed(3)}"` : '';
  const shadowAttr = s.shadow
    ? ` filter="drop-shadow(${s.shadowX}px ${s.shadowY}px ${s.shadowBlur}px ${esc(s.shadowColor)})"`
    : '';

  // ── Ellipse ────────────────────────────────────────────────────────────────
  if (s.type === 'ellipse') {
    return `  <ellipse cx="${s.x + s.width / 2}" cy="${s.y + s.height / 2}" rx="${s.width / 2}" ry="${s.height / 2}" fill="${commonFill}"${fillOpAttr}${strokeAttr}${opacityAttr}${shadowAttr}${rot}/>`;
  }

  // ── Path ───────────────────────────────────────────────────────────────────
  if (s.type === 'path') {
    const pts = s.points ?? [];
    if (pts.length < 2) return '';
    const d = buildPathD(pts, s.pathClosed ?? false);
    const dashArr = s.strokeDash === 'dashed'
      ? ` stroke-dasharray="${s.strokeWidth! * 4} ${s.strokeWidth! * 2}"`
      : s.strokeDash === 'dotted'
      ? ` stroke-dasharray="${s.strokeWidth} ${s.strokeWidth * 2}"`
      : '';
    const capAttr = s.lineCap ? ` stroke-linecap="${s.lineCap}"` : '';
    const joinAttr = s.lineJoin ? ` stroke-linejoin="${s.lineJoin}"` : '';
    return `  <path d="${esc(d)}" fill="${s.pathClosed && s.fill !== 'transparent' ? commonFill : 'none'}"${strokeAttr}${opacityAttr}${dashArr}${capAttr}${joinAttr}${shadowAttr}/>`;
  }

  // ── Text ───────────────────────────────────────────────────────────────────
  if (s.type === 'text') {
    const textStyle = styleObj({
      fontFamily: s.fontFamily,
      fontSize: `${s.fontSize}px`,
      fontWeight: s.fontWeight,
      fontStyle: s.fontStyle,
      textAlign: s.textAlign,
      textDecoration: s.textDecoration,
      lineHeight: `${s.lineHeight}`,
      letterSpacing: s.letterSpacing !== 0 ? `${s.letterSpacing / 100}em` : 'normal',
      color: s.color,
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      overflow: 'hidden',
      width: '100%',
      height: '100%',
    });
    return [
      `  <foreignObject x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}"${opacityAttr}${rot}>`,
      `    <div xmlns="http://www.w3.org/1999/xhtml" style="${styleObj({ width: '100%', height: '100%' })}">`,
      `      <div style="${esc(textStyle)}">${esc(s.text)}</div>`,
      `    </div>`,
      `  </foreignObject>`,
    ].join('\n');
  }

  // ── Rectangle / Frame ─────────────────────────────────────────────────────
  const [rTL, rTR, rBR, rBL] = normalizeRadius(s.borderRadius);
  const isCircle = !Array.isArray(s.borderRadius) && s.borderRadius >= 9999;
  const allEqual = rTL === rTR && rTR === rBR && rBR === rBL;
  const rx = isCircle ? Math.min(s.width, s.height) / 2 : (allEqual ? rTL : Math.max(rTL, rTR, rBR, rBL));

  if (!allEqual && !isCircle && (rTL !== rTR || rTR !== rBR || rBR !== rBL)) {
    // True per-corner: use <path>
    const d = roundedRectPath(s.x, s.y, s.width, s.height, rTL, rTR, rBR, rBL);
    return `  <path d="${d}" fill="${commonFill}"${fillOpAttr}${strokeAttr}${opacityAttr}${shadowAttr}${rot}/>`;
  }

  const rxAttr = rx > 0 ? ` rx="${rx}"` : '';
  return `  <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}"${rxAttr} fill="${commonFill}"${fillOpAttr}${strokeAttr}${opacityAttr}${shadowAttr}${rot}/>`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function shapesToSvg(shapes: Shape[]): string {
  if (shapes.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"/>';

  // Compute canvas bounding box
  const minX = Math.min(...shapes.map(s => s.x));
  const minY = Math.min(...shapes.map(s => s.y));
  const maxX = Math.max(...shapes.map(s => s.x + s.width));
  const maxY = Math.max(...shapes.map(s => s.y + s.height));
  const W = maxX - minX;
  const H = maxY - minY;

  const elements = shapes
    .filter(s => s.type !== 'frame' || !s.iframeJsx) // skip iframe-backed frames
    .map(shapeToSvg)
    .filter(Boolean)
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml"`,
    `     width="${W}" height="${H}" viewBox="${minX} ${minY} ${W} ${H}">`,
    elements,
    `</svg>`,
  ].join('\n');
}

colorWithOpacity; // suppress unused warning — kept for future gradient support
