import type React from 'react';

export type ShapeType = 'frame' | 'rectangle' | 'ellipse' | 'text' | 'path';

/**
 * A node on a bezier path.
 * - (x, y): anchor position
 * - cp1x/cp1y: "in" control handle (from previous segment, reflected from cp2 on smooth nodes)
 * - cp2x/cp2y: "out" control handle (to next segment)
 * When cp1/cp2 are absent the segment is a straight line.
 */
export interface BezierPoint {
  x: number;
  y: number;
  cp1x?: number; // in-handle x
  cp1y?: number; // in-handle y
  cp2x?: number; // out-handle x
  cp2y?: number; // out-handle y
}

export interface GradientStop {
  color: string;   // hex6, e.g. '#6366f1'
  position: number; // 0–1
}

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  // Appearance
  fill: string;
  fillOpacity: number;
  fillType: 'solid' | 'linear-gradient' | 'radial-gradient';
  gradientStops: GradientStop[];
  gradientAngle: number; // degrees (linear only)
  stroke: string;
  strokeWidth: number;
  /** Uniform radius (number) or per-corner [TL, TR, BR, BL] tuple. 9999 = circle (ellipse). */
  borderRadius: number | [number, number, number, number];
  opacity: number;
  // Effects
  shadow: boolean;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
  // Typography (text only)
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string; // 'normal' | 'italic'
  textAlign: string; // 'left' | 'center' | 'right'
  textDecoration: string; // 'none' | 'underline' | 'line-through'
  lineHeight: number; // unitless multiplier e.g. 1.4
  letterSpacing: number; // em units * 100, e.g. 0 = 0em, 10 = 0.1em
  color: string;
  // Frame / layout
  name: string;
  // Auto-layout (frame + rectangle)
  layout: 'none' | 'row' | 'column';
  layoutGap: number;
  layoutPaddingH: number;
  layoutPaddingV: number;
  layoutAlign: string; // flex alignItems: 'flex-start' | 'center' | 'flex-end' | 'stretch'
  layoutJustify: string; // flex justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between'
  // Children (for auto-layout frames)
  children: string[]; // ordered list of child shape IDs
  // Grouping
  isGroup?: boolean;  // true for shapes created via Ctrl+G
  parentId?: string;  // set on children when inside a group
  // Path (type === 'path' only)
  points?: BezierPoint[];
  pathClosed?: boolean;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  arrowStart?: boolean;
  arrowEnd?: boolean;
  // AI-generated iframe content (frame type only)
  iframeJsx?: string; // when set, renders a live iframe inside this frame
}

export function defaultShape(type: ShapeType, id: string): Shape {
  const base: Shape = {
    id,
    type,
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    rotation: 0,
    fill: type === 'frame' ? 'transparent' : '#e2e8f0',
    fillOpacity: 1,
    fillType: 'solid',
    gradientStops: [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }],
    gradientAngle: 135,
    stroke: type === 'frame' ? '#6366f1' : 'transparent',
    strokeWidth: type === 'frame' ? 1 : 0,
    borderRadius: 0,
    opacity: 1,
    shadow: false,
    shadowX: 2,
    shadowY: 4,
    shadowBlur: 12,
    shadowColor: '#00000033',
    text: 'Text',
    fontSize: 16,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: '400',
    fontStyle: 'normal',
    textAlign: 'left',
    textDecoration: 'none',
    lineHeight: 1.4,
    letterSpacing: 0,
    color: type === 'text' ? '#f0f0f0' : '#1e293b',
    name: type.charAt(0).toUpperCase() + type.slice(1),
    layout: 'none',
    layoutGap: 8,
    layoutPaddingH: 16,
    layoutPaddingV: 16,
    layoutAlign: 'flex-start',
    layoutJustify: 'flex-start',
    children: [],
  };

  if (type === 'ellipse') {
    base.borderRadius = 9999;
    base.width = 120;
    base.height = 120;
  }
  if (type === 'text') {
    base.fill = 'transparent';
    base.stroke = 'transparent';
    base.width = 200;
    base.height = 40;
    base.fontSize = 20;
  }
  if (type === 'path') {
    base.fill = 'transparent';
    base.stroke = '#6366f1';
    base.strokeWidth = 2;
    base.points = [];
    base.pathClosed = false;
    base.lineCap = 'round';
    base.lineJoin = 'round';
    base.strokeDash = 'solid';
    base.arrowStart = false;
    base.arrowEnd = false;
    base.width = 0;
    base.height = 0;
  }

  return base;
}

export function shapesToJsx(shapes: Shape[]): string {
  if (shapes.length === 0) return '';

  const shapeElements = shapes.map(shapeToJsxElement).join('\n');

  return `function App() {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>
${shapeElements}
    </div>
  );
}`;
}

function shapeToJsxElement(s: Shape): string {
  if (s.type === 'path') {
    return pathToSvgJsx(s);
  }

  const style = buildShapeStyle(s);
  const styleStr = JSON.stringify(style)
    .replace(/^{/, '{{')
    .replace(/}$/, '}}')
    .replace(/"([^"]+)":/g, '$1:')
    .replace(/,/g, ', ');

  if (s.type === 'text') {
    return `      <div data-shape-id="${s.id}" style=${styleStr}>${s.text}</div>`;
  }

  return `      <div data-shape-id="${s.id}" style=${styleStr}></div>`;
}

function pathToSvgJsx(s: Shape): string {
  const pts = s.points ?? [];
  if (pts.length < 2) return '';
  const d = buildPathD(pts, s.pathClosed ?? false);
  const dashArray = s.strokeDash === 'dashed' ? `strokeDasharray="${s.strokeWidth! * 4} ${s.strokeWidth! * 2}"` :
                    s.strokeDash === 'dotted' ? `strokeDasharray="${s.strokeWidth} ${s.strokeWidth * 2}"` : '';
  const allX = pts.flatMap(p => [p.x, ...(p.cp1x != null ? [p.cp1x] : []), ...(p.cp2x != null ? [p.cp2x] : [])]);
  const allY = pts.flatMap(p => [p.y, ...(p.cp1y != null ? [p.cp1y] : []), ...(p.cp2y != null ? [p.cp2y] : [])]);
  const minX = Math.min(...allX);
  const minY = Math.min(...allY);
  const maxX = Math.max(...allX);
  const maxY = Math.max(...allY);
  const pad = (s.strokeWidth ?? 2) * 4;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  return `      <svg data-shape-id="${s.id}" style={{position:'absolute',left:${minX - pad},top:${minY - pad},width:${w},height:${h},overflow:'visible',opacity:${s.opacity}}}>
        <path d="${d}" fill="${s.fill === 'transparent' ? 'none' : s.fill}" stroke="${s.stroke}" strokeWidth="${s.strokeWidth}" strokeLinecap="${s.lineCap}" strokeLinejoin="${s.lineJoin}" ${dashArray}/>
      </svg>`;
}

/**
 * Normalise borderRadius to a 4-tuple [TL, TR, BR, BL].
 * Handles both the legacy scalar form and the new per-corner tuple.
 */
export function normalizeRadius(r: Shape['borderRadius']): [number, number, number, number] {
  if (Array.isArray(r)) return r;
  return [r, r, r, r];
}

/**
 * Convert borderRadius to a CSS string.
 * - 9999 (scalar) → '50%' (circle)
 * - uniform n → 'npx'
 * - per-corner tuple → 'TLpx TRpx BRpx BLpx'
 */
export function radiusToCss(r: Shape['borderRadius']): string {
  if (!Array.isArray(r)) {
    if (r === 9999) return '50%';
    return r > 0 ? `${r}px` : '0';
  }
  const [tl, tr, br, bl] = r;
  // Collapse back to a single value if all equal (cleaner output)
  if (tl === tr && tr === br && br === bl) {
    return tl > 0 ? `${tl}px` : '0';
  }
  return `${tl}px ${tr}px ${br}px ${bl}px`;
}

export function buildShapeStyle(s: Shape): React.CSSProperties {
  const style: Record<string, string | number> = {
    position: 'absolute',
    left: s.x,
    top: s.y,
    width: s.width,
    height: s.height,
    opacity: s.opacity,
    boxSizing: 'border-box',
  };

  if (s.rotation !== 0) {
    style.transform = `rotate(${s.rotation}deg)`;
  }

  const fillType = s.fillType ?? 'solid';
  if (fillType === 'linear-gradient' || fillType === 'radial-gradient') {
    const stops = (s.gradientStops ?? []).map(st => `${st.color} ${(st.position * 100).toFixed(1)}%`).join(', ');
    if (fillType === 'linear-gradient') {
      style.backgroundImage = `linear-gradient(${s.gradientAngle ?? 135}deg, ${stops})`;
    } else {
      style.backgroundImage = `radial-gradient(circle, ${stops})`;
    }
  } else if (s.fill !== 'transparent') {
    // Encode fillOpacity into the color alpha channel so it doesn't affect stroke/children
    if (s.fillOpacity < 1 && /^#[0-9a-fA-F]{6}$/.test(s.fill)) {
      const alpha = Math.round(s.fillOpacity * 255).toString(16).padStart(2, '0');
      style.backgroundColor = s.fill + alpha;
    } else {
      style.backgroundColor = s.fill;
    }
  }

  if (s.stroke !== 'transparent' && s.strokeWidth > 0) {
    style.border = `${s.strokeWidth}px solid ${s.stroke}`;
    if (s.type === 'frame') style.border = `${s.strokeWidth}px dashed ${s.stroke}`;
  }

  const radiusCss = radiusToCss(s.borderRadius);
  if (radiusCss !== '0') {
    style.borderRadius = radiusCss;
  }

  if (s.shadow) {
    style.boxShadow = `${s.shadowX}px ${s.shadowY}px ${s.shadowBlur}px ${s.shadowColor}`;
  }

  if (s.type === 'text') {
    style.fontSize = s.fontSize;
    style.fontFamily = s.fontFamily;
    style.fontWeight = s.fontWeight;
    style.fontStyle = s.fontStyle;
    style.textAlign = s.textAlign;
    style.textDecoration = s.textDecoration;
    style.lineHeight = s.lineHeight;
    style.letterSpacing = s.letterSpacing !== 0 ? `${s.letterSpacing / 100}em` : 'normal';
    style.color = s.color;
    style.display = 'flex';
    style.alignItems = 'center';
    style.userSelect = 'none';
    style.whiteSpace = 'pre-wrap';
    style.wordBreak = 'break-word';
    style.overflow = 'hidden';
  }

  // Auto-layout: apply flexbox to frame/rectangle when layout is enabled
  if (s.layout !== 'none') {
    style.display = 'flex';
    style.flexDirection = s.layout === 'row' ? 'row' : 'column';
    style.gap = s.layoutGap;
    style.padding = `${s.layoutPaddingV}px ${s.layoutPaddingH}px`;
    style.alignItems = s.layoutAlign;
    style.justifyContent = s.layoutJustify;
    // Override position to relative for children to flow naturally
    // (children are rendered as flex items, not absolutely positioned)
    style.boxSizing = 'border-box';
  }

  return style;
}

/**
 * Compute the tight axis-aligned bounding box of a bezier path by finding
 * the exact extremes of each cubic/linear segment.
 */
export function pathBbox(points: BezierPoint[], closed: boolean): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  // Collect all extreme x/y values across every segment
  const xs: number[] = [];
  const ys: number[] = [];

  const n = points.length;
  const segments = closed ? n : n - 1;

  for (let i = 0; i < segments; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    const ax = p0.x, ay = p0.y;
    const bx = p0.cp2x ?? p0.x, by = p0.cp2y ?? p0.y;
    const cx = p1.cp1x ?? p1.x, cy = p1.cp1y ?? p1.y;
    const dx = p1.x, dy = p1.y;

    // Always include segment endpoints
    xs.push(ax, dx);
    ys.push(ay, dy);

    // For cubic bezier B(t) = (1-t)^3*P0 + 3(1-t)^2*t*P1 + 3(1-t)*t^2*P2 + t^3*P3
    // dB/dt = 0 gives the extremes. Solve the quadratic for each axis.
    const cubicExtremes = (a: number, b: number, c: number, d: number, out: number[]) => {
      // Coefficients of derivative: 3(-a+3b-3c+d)t^2 + 6(a-2b+c)t + 3(b-a)
      const qa = -a + 3 * b - 3 * c + d;
      const qb = a - 2 * b + c;
      const qc = b - a;
      if (Math.abs(qa) < 1e-10) {
        // Linear — one root
        if (Math.abs(qb) > 1e-10) {
          const t = -qc / (2 * qb);
          if (t > 0 && t < 1) {
            const mt = 1 - t;
            out.push(mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d);
          }
        }
        return;
      }
      const disc = qb * qb - qa * qc;
      if (disc < 0) return;
      const sq = Math.sqrt(disc);
      for (const t of [(-qb + sq) / (3 * qa), (-qb - sq) / (3 * qa)]) {
        if (t > 0 && t < 1) {
          const mt = 1 - t;
          out.push(mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d);
        }
      }
    };

    cubicExtremes(ax, bx, cx, dx, xs);
    cubicExtremes(ay, by, cy, dy, ys);
  }

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Build SVG path `d` attribute from bezier nodes.
 *  Uses cubic bezier (C) when either endpoint has control handles, otherwise line (L).
 */
export function buildPathD(points: BezierPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  const n = points.length;
  const parts: string[] = [`M ${r(points[0].x)} ${r(points[0].y)}`];

  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    const c1x = p0.cp2x ?? p0.x;
    const c1y = p0.cp2y ?? p0.y;
    const c2x = p1.cp1x ?? p1.x;
    const c2y = p1.cp1y ?? p1.y;
    const isStraight = c1x === p0.x && c1y === p0.y && c2x === p1.x && c2y === p1.y;
    if (isStraight) {
      parts.push(`L ${r(p1.x)} ${r(p1.y)}`);
    } else {
      parts.push(`C ${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(p1.x)} ${r(p1.y)}`);
    }
  }

  if (closed) parts.push('Z');
  return parts.join(' ');
}

function r(n: number): number { return Math.round(n * 100) / 100; }

/** Re-parse shapes from generated JSX (for persistence) */
export function jsxToShapes(_jsx: string): Shape[] {
  return [];
}

function renderPathToCanvas(
  s: Shape,
  ctx: CanvasRenderingContext2D,
  minX: number,
  minY: number,
  pad: number
): void {
  const pts = s.points ?? [];
  if (pts.length < 2) return;

  ctx.save();
  ctx.globalAlpha = s.opacity;

  const ox = -minX + pad;
  const oy = -minY + pad;
  ctx.beginPath();
  ctx.moveTo(pts[0].x + ox, pts[0].y + oy);
  const segCount = s.pathClosed ? pts.length : pts.length - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % pts.length];
    const c1x = p0.cp2x ?? p0.x;
    const c1y = p0.cp2y ?? p0.y;
    const c2x = p1.cp1x ?? p1.x;
    const c2y = p1.cp1y ?? p1.y;
    const isStraight = c1x === p0.x && c1y === p0.y && c2x === p1.x && c2y === p1.y;
    if (isStraight) {
      ctx.lineTo(p1.x + ox, p1.y + oy);
    } else {
      ctx.bezierCurveTo(c1x + ox, c1y + oy, c2x + ox, c2y + oy, p1.x + ox, p1.y + oy);
    }
  }
  if (s.pathClosed) ctx.closePath();

  if (s.fill !== 'transparent') {
    ctx.fillStyle = s.fill;
    ctx.fill();
  }

  if (s.stroke !== 'transparent' && (s.strokeWidth ?? 0) > 0) {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.strokeWidth ?? 2;
    ctx.lineCap = (s.lineCap ?? 'round') as CanvasLineCap;
    ctx.lineJoin = (s.lineJoin ?? 'round') as CanvasLineJoin;

    if (s.strokeDash === 'dashed') {
      ctx.setLineDash([(s.strokeWidth ?? 2) * 4, (s.strokeWidth ?? 2) * 2]);
    } else if (s.strokeDash === 'dotted') {
      ctx.setLineDash([(s.strokeWidth ?? 2), (s.strokeWidth ?? 2) * 2]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowheads
    const sw = s.strokeWidth ?? 2;
    const arrowSize = sw * 4 + 6;
    ctx.fillStyle = s.stroke;

    if (s.arrowEnd && pts.length >= 2) {
      const p1 = pts[pts.length - 2];
      const p2 = pts[pts.length - 1];
      drawArrowhead(ctx, p1.x - minX + pad, p1.y - minY + pad, p2.x - minX + pad, p2.y - minY + pad, arrowSize);
    }
    if (s.arrowStart && pts.length >= 2) {
      const p1 = pts[1];
      const p2 = pts[0];
      drawArrowhead(ctx, p1.x - minX + pad, p1.y - minY + pad, p2.x - minX + pad, p2.y - minY + pad, arrowSize);
    }
  }

  ctx.restore();
}

function drawArrowhead(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, size: number) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const spread = Math.PI / 6; // 30°
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle - spread), toY - size * Math.sin(angle - spread));
  ctx.lineTo(toX - size * Math.cos(angle + spread), toY - size * Math.sin(angle + spread));
  ctx.closePath();
  ctx.fill();
}

/** Draw all shapes onto a Canvas 2D context for PNG export */
export function shapesToCanvas(shapes: Shape[], canvas: HTMLCanvasElement): void {
  if (shapes.length === 0) return;

  // Compute tight bounding box using exact bezier extremes for paths
  const allBounds = shapes.map(s => {
    if (s.type === 'path' && s.points?.length) {
      const bb = pathBbox(s.points, s.pathClosed ?? false);
      return { x1: bb.x, y1: bb.y, x2: bb.x + bb.width, y2: bb.y + bb.height };
    }
    return { x1: s.x, y1: s.y, x2: s.x + s.width, y2: s.y + s.height };
  });
  const minX = Math.min(...allBounds.map(b => b.x1));
  const minY = Math.min(...allBounds.map(b => b.y1));
  const maxX = Math.max(...allBounds.map(b => b.x2));
  const maxY = Math.max(...allBounds.map(b => b.y2));
  const pad = 20;

  const W = maxX - minX + pad * 2;
  const H = maxY - minY + pad * 2;
  const dpr = window.devicePixelRatio ?? 1;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  for (const s of shapes) {
    if (s.type === 'path') {
      renderPathToCanvas(s, ctx, minX, minY, pad);
      continue;
    }

    const sx = s.x - minX + pad;
    const sy = s.y - minY + pad;

    ctx.save();
    ctx.globalAlpha = s.opacity;

    // Apply rotation around shape center
    if (s.rotation !== 0) {
      const cx = sx + s.width / 2;
      const cy = sy + s.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    // Shadow
    if (s.shadow) {
      ctx.shadowOffsetX = s.shadowX;
      ctx.shadowOffsetY = s.shadowY;
      ctx.shadowBlur = s.shadowBlur;
      ctx.shadowColor = s.shadowColor;
    }

    const [rTL_raw, rTR_raw, rBR_raw, rBL_raw] = normalizeRadius(s.borderRadius);
    const isEllipse = !Array.isArray(s.borderRadius) && s.borderRadius >= 9999;

    // Build fill path
    if (isEllipse) {
      ctx.beginPath();
      ctx.ellipse(sx + s.width / 2, sy + s.height / 2, s.width / 2, s.height / 2, 0, 0, Math.PI * 2);
    } else {
      const maxR = Math.min(s.width, s.height) / 2;
      const rTL = Math.min(rTL_raw, maxR);
      const rTR = Math.min(rTR_raw, maxR);
      const rBR = Math.min(rBR_raw, maxR);
      const rBL = Math.min(rBL_raw, maxR);
      const hasRadius = rTL > 0 || rTR > 0 || rBR > 0 || rBL > 0;
      if (hasRadius) {
        ctx.beginPath();
        ctx.moveTo(sx + rTL, sy);
        ctx.lineTo(sx + s.width - rTR, sy);
        ctx.quadraticCurveTo(sx + s.width, sy, sx + s.width, sy + rTR);
        ctx.lineTo(sx + s.width, sy + s.height - rBR);
        ctx.quadraticCurveTo(sx + s.width, sy + s.height, sx + s.width - rBR, sy + s.height);
        ctx.lineTo(sx + rBL, sy + s.height);
        ctx.quadraticCurveTo(sx, sy + s.height, sx, sy + s.height - rBL);
        ctx.lineTo(sx, sy + rTL);
        ctx.quadraticCurveTo(sx, sy, sx + rTL, sy);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.rect(sx, sy, s.width, s.height);
      }
    }

    // Fill
    const shapeFillType = s.fillType ?? 'solid';
    if (shapeFillType === 'linear-gradient' || shapeFillType === 'radial-gradient') {
      const stops = s.gradientStops ?? [];
      let grad: CanvasGradient;
      if (shapeFillType === 'linear-gradient') {
        const angle = ((s.gradientAngle ?? 135) * Math.PI) / 180;
        const halfDiag = Math.sqrt(s.width * s.width + s.height * s.height) / 2;
        const cx2 = sx + s.width / 2, cy2 = sy + s.height / 2;
        grad = ctx.createLinearGradient(
          cx2 - Math.cos(angle) * halfDiag, cy2 - Math.sin(angle) * halfDiag,
          cx2 + Math.cos(angle) * halfDiag, cy2 + Math.sin(angle) * halfDiag,
        );
      } else {
        grad = ctx.createRadialGradient(sx + s.width / 2, sy + s.height / 2, 0, sx + s.width / 2, sy + s.height / 2, Math.max(s.width, s.height) / 2);
      }
      for (const st of stops) grad.addColorStop(Math.max(0, Math.min(1, st.position)), st.color);
      ctx.fillStyle = grad;
      ctx.fill();
    } else if (s.fill !== 'transparent') {
      if (s.fillOpacity < 1 && /^#[0-9a-fA-F]{6}$/.test(s.fill)) {
        const alpha = Math.round(s.fillOpacity * 255).toString(16).padStart(2, '0');
        ctx.fillStyle = s.fill + alpha;
      } else {
        ctx.fillStyle = s.fill;
      }
      ctx.fill();
    }

    // Clear shadow for stroke (to avoid double shadow)
    ctx.shadowColor = 'transparent';

    // Stroke
    if (s.stroke !== 'transparent' && s.strokeWidth > 0) {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = s.strokeWidth;
      if (s.type === 'frame') ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Text
    if (s.type === 'text' && s.text) {
      ctx.fillStyle = s.color;
      ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
      ctx.textAlign = s.textAlign as CanvasTextAlign;
      ctx.textBaseline = 'middle';
      const textX = s.textAlign === 'center' ? sx + s.width / 2
        : s.textAlign === 'right' ? sx + s.width
        : sx;
      // Simple single-line render (wrap not supported in canvas easily)
      ctx.fillText(s.text, textX, sy + s.height / 2, s.width);
    }

    ctx.restore();
  }
}
