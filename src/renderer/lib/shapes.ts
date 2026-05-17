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

// ── Component definitions ──────────────────────────────────────────────────────

export interface ComponentDef {
  id: string;           // unique component id
  name: string;
  shapes: Shape[];      // master shape tree (group + children)
  thumbnail?: string;   // base64 PNG for the components panel preview
  createdAt: number;
}

// ── Gradient stops ─────────────────────────────────────────────────────────────

export interface ShadowDef {
  x: number;
  y: number;
  blur: number;
  spread?: number; // box-shadow spread
  color: string;
  inset?: boolean; // inner shadow
}

export interface GradientStop {
  color: string;   // hex6, e.g. '#6366f1'
  position: number; // 0–1
  opacity?: number;  // 0–1, default 1
}

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  flipX?: boolean; // mirror horizontally
  flipY?: boolean; // mirror vertically
  // Appearance
  fill: string;
  fillOpacity: number;
  fillType: 'solid' | 'linear-gradient' | 'radial-gradient' | 'image' | 'pattern';
  gradientStops: GradientStop[];
  gradientAngle: number; // degrees (linear only)
  stroke: string;
  strokeWidth: number;
  strokePosition: 'center' | 'inside' | 'outside'; // border positioning
  // Gradient stroke (optional — overrides solid stroke color when set)
  strokeGradientStops?: GradientStop[]; // if set, renders a gradient stroke instead of solid
  strokeGradientAngle?: number; // degrees for the gradient direction, default 135
  /** Uniform radius (number) or per-corner [TL, TR, BR, BL] tuple. 9999 = circle (ellipse). */
  borderRadius: number | [number, number, number, number];
  opacity: number;
  blendMode?: string; // CSS mix-blend-mode value
  // CSS filters
  filterBlur?: number; // px
  filterBrightness?: number; // 0–200 (100 = normal)
  filterContrast?: number; // 0–200 (100 = normal)
  filterSaturate?: number; // 0–200 (100 = normal)
  filterGrayscale?: number; // 0–100 (0 = full color, 100 = grayscale)
  filterSepia?: number; // 0–100 (0 = none, 100 = full sepia)
  filterHueRotate?: number; // 0–360 degrees
  filterInvert?: number; // 0–100 (0 = normal, 100 = inverted)
  filterBackdropBlur?: number; // px — CSS backdrop-filter: blur(Npx), creates glassmorphism
  clipPath?: string; // CSS clip-path value, e.g. polygon(50% 0%, 100% 100%, 0% 100%)
  // Effects
  shadow: boolean;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
  // Multiple shadows (shadow stack — optional, takes priority over single shadow)
  shadows?: ShadowDef[];
  // Typography (text only)
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string; // 'normal' | 'italic'
  fontVariationSettings?: string; // CSS font-variation-settings, e.g. '"wght" 700, "wdth" 80'
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
  // Components / symbols
  componentId?: string;        // if set, this shape is master or an instance of that component
  isMasterComponent?: boolean; // true for the canonical master group in ComponentDef
  // Image fill
  imageUrl?: string; // URL or data: URI for image fill
  imageFit?: 'fill' | 'fit' | 'crop' | 'tile'; // how image is fitted
  // Pattern fill
  patternId?: string; // key from FILL_PATTERNS in shapes.ts
  patternColor?: string; // foreground color for the pattern
  patternBg?: string; // background color for the pattern
  patternScale?: number; // 0.5 – 4× scaling
  // Icon overlay (Lucide icon rendered inside shape)
  iconId?: string; // Lucide icon name e.g. 'Home', 'Settings'
  iconColor?: string; // icon stroke color
  iconSize?: number; // px size of the icon inside the shape
  // Prototype / interaction
  protoLink?: string; // shape id (typically a frame) to navigate to on click in prototype mode
  protoTransition?: 'none' | 'slide-left' | 'slide-right' | 'fade' | 'dissolve'; // transition animation
  protoTrigger?: 'click' | 'hover'; // interaction trigger
  // Path (type === 'path' only)
  points?: BezierPoint[];
  pathClosed?: boolean;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  arrowStart?: boolean;
  arrowEnd?: boolean;
  // Visibility & lock
  hidden?: boolean; // when true, the shape is hidden on canvas (opacity 0, not selectable)
  locked?: boolean; // when true, the shape cannot be moved or resized (click-through)
  // AI-generated iframe content (frame type only)
  iframeJsx?: string; // when set, renders a live iframe inside this frame
  // Clip contents to frame bounds (frame type only)
  clipContents?: boolean; // when true, overflow: hidden is applied to the frame
  // Developer/design notes (shown in inspect panel, included in CSS export comments)
  notes?: string;
  // CSS transition / animation
  transitionDuration?: number;     // ms, e.g. 300
  transitionEasing?: string;       // e.g. 'ease', 'ease-in-out', 'cubic-bezier(0.4,0,0.2,1)'
  transitionProperties?: string[]; // e.g. ['opacity', 'transform', 'background']

  // CSS entrance animation (applied as `animation: ...` in the generated CSS)
  cssAnimation?: string;           // e.g. 'fadeInUp 0.4s ease both'

  // Noise/grain texture overlay (SVG feTurbulence rendered as pseudo-element via inline SVG bg)
  noiseOpacity?: number; // 0–1, default 0 (no noise)
  noiseScale?: number;   // grain size: 0.5–4, default 1

  // Scroll behavior (frames only) — simulates scrollable content areas
  scrollDirection?: 'none' | 'vertical' | 'horizontal' | 'both'; // default 'none'

  // CSS transform extras (applied additively after rotation/flip)
  skewX?: number; // degrees of horizontal skew
  skewY?: number; // degrees of vertical skew
  perspectiveTilt?: number; // 0–1, simulates a 3D tilt using perspective + rotateX/Y
  perspectiveTiltAxis?: 'x' | 'y' | 'xy'; // axis to tilt on
  // Full 3D transform (takes priority over perspectiveTilt when set)
  transform3dRotateX?: number; // degrees around X axis (-180..180)
  transform3dRotateY?: number; // degrees around Y axis (-180..180)
  transform3dRotateZ?: number; // degrees around Z axis (-180..180)
  transform3dPerspective?: number; // perspective distance in px (200–2000)
  transform3dTranslateZ?: number; // depth offset in px (-500..500)
  transform3dScaleZ?: number; // scale along Z axis (0.1–3)

  // Shape tagging — arbitrary keyword labels for organization and filtering
  tags?: string[]; // e.g. ['hero', 'cta', 'mobile-only']

  // Responsive constraints (applies when shape is inside a frame that gets resized)
  // Horizontal: how the shape's x/width relate to the parent frame's width
  constraintH?: 'left' | 'right' | 'center' | 'left-right' | 'scale'; // default 'left'
  // Vertical: how the shape's y/height relate to the parent frame's height
  constraintV?: 'top' | 'bottom' | 'center' | 'top-bottom' | 'scale'; // default 'top'

  // Shape variants — named visual states (Default, Hover, Pressed, Disabled, etc.)
  // Each variant stores a partial override of the shape's visual properties.
  // The "Default" variant is always the shape's base properties.
  variants?: Record<string, ShapeVariant>;
  activeVariant?: string; // name of the currently active variant ('Default' if absent)

  // Hug contents — when true and layout is active, the frame resizes to exactly wrap children.
  layoutHug?: boolean; // resize frame to fit children (like Figma "Hug")

  // Clip mask — when set, this shape is clipped to the path/bounds of the referenced shape.
  // The mask shape acts as a "window": only the area within the mask shape is visible.
  clipMaskId?: string; // id of the shape to use as a clip mask
  isMask?: boolean;    // when true, this shape is acting as a mask (rendered transparent, used only for clip path)
}

/**
 * A named visual state override for a shape.
 * Only visual properties differ between variants — layout and position are shared.
 */
export interface ShapeVariant {
  label: string; // display name e.g. 'Hover', 'Pressed', 'Disabled'
  fill?: string;
  fillOpacity?: number;
  fillType?: Shape['fillType'];
  gradientStops?: GradientStop[];
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  shadow?: boolean;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  shadows?: ShadowDef[];
  filterBlur?: number;
  filterBrightness?: number;
  filterBackdropBlur?: number;
  color?: string; // text color
  fontSize?: number;
  fontWeight?: string;
  borderRadius?: number | [number, number, number, number];
  blendMode?: string;
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
    strokePosition: 'center',
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

// ── Auto-layout enforcement ────────────────────────────────────────────────────
/**
 * Given the full flat shapes array, reposition the children of every auto-layout
 * frame (layout === 'row' | 'column') so they stack with proper gap/padding/align.
 *
 * This is a pure function — it returns a new array with child positions updated.
 * Call it after any shape mutation that could affect child positions.
 *
 * Alignment semantics (mirrors CSS flexbox):
 *   layoutAlign  → cross-axis  (alignItems)  flex-start | center | flex-end | stretch
 *   layoutJustify → main-axis  (justifyContent) flex-start | center | flex-end | space-between
 */
export function applyAutoLayout(shapes: Shape[]): Shape[] {
  // Build id→shape map for fast lookup
  const byId = new Map<string, Shape>(shapes.map(s => [s.id, s]));

  // Collect patches: id → partial shape update
  const patches = new Map<string, Partial<Shape>>();

  for (const frame of shapes) {
    if (frame.layout === 'none') continue;
    const childIds = frame.children ?? [];
    if (childIds.length === 0) continue;

    const children = childIds.map(id => byId.get(id)).filter(Boolean) as Shape[];
    if (children.length === 0) continue;

    const isRow = frame.layout === 'row';
    const gap = frame.layoutGap ?? 0;
    const padH = frame.layoutPaddingH ?? 0;
    const padV = frame.layoutPaddingV ?? 0;
    const align = frame.layoutAlign ?? 'flex-start';
    const justify = frame.layoutJustify ?? 'flex-start';

    // Available space on the main axis (inside padding)
    const mainAxisSpace = isRow ? frame.width - padH * 2 : frame.height - padV * 2;
    // Available cross-axis space
    const crossAxisSpace = isRow ? frame.height - padV * 2 : frame.width - padH * 2;

    // Total size of all children on the main axis
    const childrenMainSize = children.reduce((sum, c, i) =>
      sum + (isRow ? c.width : c.height) + (i < children.length - 1 ? gap : 0), 0);

    // Starting offset on main axis (depends on justifyContent)
    let mainOffset: number;
    let dynamicGap = gap;
    if (justify === 'center') {
      mainOffset = (mainAxisSpace - childrenMainSize) / 2;
    } else if (justify === 'flex-end') {
      mainOffset = mainAxisSpace - childrenMainSize;
    } else if (justify === 'space-between' && children.length > 1) {
      mainOffset = 0;
      dynamicGap = (mainAxisSpace - children.reduce((sum, c) =>
        sum + (isRow ? c.width : c.height), 0)) / (children.length - 1);
    } else {
      // flex-start (default)
      mainOffset = 0;
    }

    // Max cross-axis size of children (for hug computation)
    const maxChildCross = Math.max(...children.map(c => isRow ? c.height : c.width));

    let cursor = mainOffset;
    for (const child of children) {
      const childMain = isRow ? child.width : child.height;
      const childCross = isRow ? child.height : child.width;

      // Cross-axis position
      let crossPos: number;
      if (align === 'center') {
        crossPos = (crossAxisSpace - childCross) / 2;
      } else if (align === 'flex-end') {
        crossPos = crossAxisSpace - childCross;
      } else if (align === 'stretch') {
        crossPos = 0;
        // For stretch: expand cross size to fill (preserve main size)
        const stretchPatch: Partial<Shape> = isRow
          ? { x: frame.x + padH + cursor, y: frame.y + padV, height: crossAxisSpace }
          : { y: frame.y + padV + cursor, x: frame.x + padH, width: crossAxisSpace };
        patches.set(child.id, stretchPatch);
        cursor += childMain + dynamicGap;
        continue;
      } else {
        // flex-start
        crossPos = 0;
      }

      const patch: Partial<Shape> = isRow
        ? { x: frame.x + padH + cursor, y: frame.y + padV + crossPos }
        : { y: frame.y + padV + cursor, x: frame.x + padH + crossPos };

      patches.set(child.id, patch);
      cursor += childMain + dynamicGap;
    }

    // ── Hug contents: resize frame to exactly wrap children ───────────────────
    if (frame.layoutHug) {
      // Main axis size = total children size + gaps + 2× padding
      const hugMain = childrenMainSize + padH * 2;  // reuse childrenMainSize computed above
      // Cross axis size = max child cross + 2× cross padding
      const hugCross = maxChildCross + (isRow ? padV * 2 : padH * 2);
      const hugPatch: Partial<Shape> = isRow
        ? { width: hugMain, height: hugCross }
        : { width: hugCross, height: hugMain };
      patches.set(frame.id, { ...(patches.get(frame.id) ?? {}), ...hugPatch });
    }
  }

  if (patches.size === 0) return shapes;

  return shapes.map(s => {
    const p = patches.get(s.id);
    return p ? { ...s, ...p } : s;
  });
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

// ─── Fill Patterns ────────────────────────────────────────────────────────────
// Each pattern is a function (fg, bg, scale) → CSS background-image data URI
// so color and scale are user-controllable at runtime.

export interface FillPattern {
  id: string;
  label: string;
  category: string;
  preview: string; // a fixed-color preview for the UI
  build: (fg: string, bg: string, scale: number) => string; // returns CSS background-image value
}

function encSvg(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const FILL_PATTERNS: FillPattern[] = [
  {
    id: 'dots',
    label: 'Dots',
    category: 'Geometric',
    preview: '#6366f120',
    build: (fg, bg, scale) => {
      const s = Math.round(8 * scale);
      const r = Math.max(1, Math.round(scale * 1.5));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><circle cx="${s/2}" cy="${s/2}" r="${r}" fill="${fg}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'grid',
    label: 'Grid',
    category: 'Geometric',
    preview: '#6366f115',
    build: (fg, bg, scale) => {
      const s = Math.round(16 * scale);
      const w = Math.max(1, scale * 0.8);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><path d="M${s} 0L0 0 0 ${s}" fill="none" stroke="${fg}" stroke-width="${w}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'lines-h',
    label: 'Lines H',
    category: 'Lines',
    preview: '#6366f118',
    build: (fg, bg, scale) => {
      const s = Math.round(8 * scale);
      const w = Math.max(0.5, scale * 0.6);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><line x1="0" y1="0" x2="${s}" y2="0" stroke="${fg}" stroke-width="${w}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'lines-v',
    label: 'Lines V',
    category: 'Lines',
    preview: '#6366f118',
    build: (fg, bg, scale) => {
      const s = Math.round(8 * scale);
      const w = Math.max(0.5, scale * 0.6);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><line x1="0" y1="0" x2="0" y2="${s}" stroke="${fg}" stroke-width="${w}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'lines-diag',
    label: 'Diagonal',
    category: 'Lines',
    preview: '#6366f118',
    build: (fg, bg, scale) => {
      const s = Math.round(8 * scale);
      const w = Math.max(0.5, scale * 0.8);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><line x1="0" y1="${s}" x2="${s}" y2="0" stroke="${fg}" stroke-width="${w}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'crosshatch',
    label: 'Crosshatch',
    category: 'Lines',
    preview: '#6366f118',
    build: (fg, bg, scale) => {
      const s = Math.round(8 * scale);
      const w = Math.max(0.5, scale * 0.6);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><line x1="0" y1="${s}" x2="${s}" y2="0" stroke="${fg}" stroke-width="${w}"/><line x1="0" y1="0" x2="${s}" y2="${s}" stroke="${fg}" stroke-width="${w}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'checkerboard',
    label: 'Checker',
    category: 'Geometric',
    preview: '#6366f125',
    build: (fg, bg, scale) => {
      const s = Math.round(8 * scale);
      const h = s / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><rect x="0" y="0" width="${h}" height="${h}" fill="${fg}"/><rect x="${h}" y="${h}" width="${h}" height="${h}" fill="${fg}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'triangles',
    label: 'Triangles',
    category: 'Geometric',
    preview: '#6366f120',
    build: (fg, bg, scale) => {
      const s = Math.round(16 * scale);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><polygon points="0,${s} ${s/2},0 ${s},${s}" fill="${fg}" fill-opacity="0.6"/><polygon points="0,0 ${s/2},${s} ${s},0" fill="${fg}" fill-opacity="0.4"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'waves',
    label: 'Waves',
    category: 'Organic',
    preview: '#6366f118',
    build: (fg, bg, scale) => {
      const s = Math.round(16 * scale);
      const a = Math.round(3 * scale); // amplitude
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><path d="M0 ${s/2} Q${s/4} ${s/2-a} ${s/2} ${s/2} Q${s*3/4} ${s/2+a} ${s} ${s/2}" fill="none" stroke="${fg}" stroke-width="${Math.max(0.5, scale * 0.8)}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'hexagons',
    label: 'Hexagons',
    category: 'Geometric',
    preview: '#6366f120',
    build: (fg, bg, scale) => {
      const r = Math.round(10 * scale);
      const h = Math.round(r * Math.sqrt(3));
      const w = r * 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/><polygon points="${r},0 ${w},${h/4} ${w},${h*3/4} ${r},${h} 0,${h*3/4} 0,${h/4}" fill="none" stroke="${fg}" stroke-width="${Math.max(0.5, scale * 0.7)}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'noise-fine',
    label: 'Noise Fine',
    category: 'Texture',
    preview: '#6366f112',
    build: (fg, bg, scale) => {
      // Simulate noise with many tiny rects at random positions
      const s = Math.round(40 * scale);
      const count = Math.round(80 * scale * scale);
      let rects = '';
      // Deterministic pseudo-random using LCG
      let seed = 42;
      const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
      for (let i = 0; i < count; i++) {
        const x = Math.floor(rand() * s);
        const y = Math.floor(rand() * s);
        const a = (rand() * 0.4 + 0.05).toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fg}" fill-opacity="${a}"/>`;
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/>${rects}</svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'noise-coarse',
    label: 'Noise Coarse',
    category: 'Texture',
    preview: '#6366f118',
    build: (fg, bg, scale) => {
      const s = Math.round(24 * scale);
      const count = Math.round(20 * scale * scale);
      let rects = '';
      let seed = 7;
      const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
      for (let i = 0; i < count; i++) {
        const x = Math.floor(rand() * s);
        const y = Math.floor(rand() * s);
        const sz = Math.floor(rand() * 3 * scale) + 1;
        const a = (rand() * 0.5 + 0.1).toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${sz}" height="${sz}" fill="${fg}" fill-opacity="${a}"/>`;
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/>${rects}</svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'polka',
    label: 'Polka Dots',
    category: 'Geometric',
    preview: '#6366f120',
    build: (fg, bg, scale) => {
      const s = Math.round(20 * scale);
      const r = Math.max(2, Math.round(4 * scale));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><circle cx="${s/4}" cy="${s/4}" r="${r}" fill="${fg}"/><circle cx="${s*3/4}" cy="${s*3/4}" r="${r}" fill="${fg}"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'brick',
    label: 'Brick',
    category: 'Geometric',
    preview: '#6366f120',
    build: (fg, bg, scale) => {
      const bw = Math.round(24 * scale);
      const bh = Math.round(12 * scale);
      const stroke = Math.max(0.5, scale * 0.8);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh * 2}">` +
        `<rect width="${bw}" height="${bh * 2}" fill="${bg}"/>` +
        // Row 1: full brick
        `<rect x="${stroke/2}" y="${stroke/2}" width="${bw - stroke}" height="${bh - stroke}" fill="${fg}" fill-opacity="0.12" stroke="${fg}" stroke-width="${stroke}"/>` +
        // Row 2: half brick left
        `<rect x="${stroke/2}" y="${bh + stroke/2}" width="${bw/2 - stroke}" height="${bh - stroke}" fill="${fg}" fill-opacity="0.12" stroke="${fg}" stroke-width="${stroke}"/>` +
        // Row 2: half brick right
        `<rect x="${bw/2 + stroke/2}" y="${bh + stroke/2}" width="${bw/2 - stroke}" height="${bh - stroke}" fill="${fg}" fill-opacity="0.12" stroke="${fg}" stroke-width="${stroke}"/>` +
        `</svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'circuit',
    label: 'Circuit',
    category: 'Tech',
    preview: '#6366f118',
    build: (fg, bg, scale) => {
      const s = Math.round(32 * scale);
      const w = Math.max(0.8, scale * 0.8);
      const pad = Math.round(4 * scale);
      // Circuit board: L-shaped traces and pads
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
        `<rect width="${s}" height="${s}" fill="${bg}"/>` +
        // Horizontal trace
        `<line x1="0" y1="${s/4}" x2="${s*3/4}" y2="${s/4}" stroke="${fg}" stroke-width="${w}"/>` +
        // Vertical trace
        `<line x1="${s*3/4}" y1="${s/4}" x2="${s*3/4}" y2="${s*3/4}" stroke="${fg}" stroke-width="${w}"/>` +
        // Cross trace
        `<line x1="${s/2}" y1="0" x2="${s/2}" y2="${s/2}" stroke="${fg}" stroke-width="${w}"/>` +
        `<line x1="${s/4}" y1="${s*3/4}" x2="${s}" y2="${s*3/4}" stroke="${fg}" stroke-width="${w}"/>` +
        // Solder pads (circles)
        `<circle cx="${s*3/4}" cy="${s/4}" r="${pad}" fill="${bg}" stroke="${fg}" stroke-width="${w}"/>` +
        `<circle cx="${s/4}" cy="${s*3/4}" r="${pad}" fill="${fg}" fill-opacity="0.3" stroke="${fg}" stroke-width="${w}"/>` +
        `<circle cx="${s/2}" cy="${s/2}" r="${Math.max(1, pad * 0.6)}" fill="${fg}" fill-opacity="0.5"/>` +
        `</svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'stars',
    label: 'Stars',
    category: 'Geometric',
    preview: '#6366f120',
    build: (fg, bg, scale) => {
      const s = Math.round(24 * scale);
      const cx = s / 2, cy = s / 2;
      const outer = Math.round(8 * scale);
      const inner = Math.round(3.5 * scale);
      // 5-pointed star polygon
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI / 5) - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/><polygon points="${pts.join(' ')}" fill="${fg}" fill-opacity="0.7"/></svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'confetti',
    label: 'Confetti',
    category: 'Organic',
    preview: '#6366f125',
    build: (fg, bg, scale) => {
      const s = Math.round(36 * scale);
      let seed = 13;
      const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
      let shapes = '';
      for (let i = 0; i < 10; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const w = Math.max(3, rand() * 8 * scale);
        const h = Math.max(2, rand() * 4 * scale);
        const rot = rand() * 360;
        const opacity = (0.4 + rand() * 0.6).toFixed(2);
        shapes += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${fg}" fill-opacity="${opacity}" transform="rotate(${rot.toFixed(0)},${x.toFixed(1)},${y.toFixed(1)})"/>`;
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${bg}"/>${shapes}</svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'japanese-wave',
    label: 'J. Wave',
    category: 'Organic',
    preview: '#6366f118',
    build: (fg, bg, scale) => {
      const s = Math.round(24 * scale);
      const sw = Math.max(0.8, scale * 0.9);
      // Seigaiha (overlapping semi-circles)
      const r = s / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s * 2}" height="${s}">` +
        `<rect width="${s * 2}" height="${s}" fill="${bg}"/>` +
        // Row of 2 semi-circles side by side
        `<path d="M0,${s} A${r},${r} 0 0,1 ${s},${s}" fill="${bg}" stroke="${fg}" stroke-width="${sw}"/>` +
        `<path d="M${s},${s} A${r},${r} 0 0,1 ${s * 2},${s}" fill="${bg}" stroke="${fg}" stroke-width="${sw}"/>` +
        // Offset row above
        `<path d="M${-s/2},0 A${r},${r} 0 0,1 ${s/2},0" fill="${bg}" stroke="${fg}" stroke-width="${sw}"/>` +
        `<path d="M${s/2},0 A${r},${r} 0 0,1 ${s*3/2},0" fill="${bg}" stroke="${fg}" stroke-width="${sw}"/>` +
        `</svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'isometric',
    label: 'Isometric',
    category: 'Geometric',
    preview: '#6366f115',
    build: (fg, bg, scale) => {
      const w = Math.round(20 * scale);
      const h = Math.round(12 * scale);
      const sw = Math.max(0.5, scale * 0.6);
      // Isometric grid: two sets of diagonal lines
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<rect width="${w}" height="${h}" fill="${bg}"/>` +
        // Bottom-right diagonals
        `<line x1="0" y1="0" x2="${w}" y2="${h}" stroke="${fg}" stroke-width="${sw}"/>` +
        // Bottom-left diagonals
        `<line x1="${w}" y1="0" x2="0" y2="${h}" stroke="${fg}" stroke-width="${sw}"/>` +
        // Horizontal midline
        `<line x1="0" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="${fg}" stroke-width="${sw}"/>` +
        `</svg>`;
      return encSvg(svg);
    },
  },
  {
    id: 'diamonds',
    label: 'Diamonds',
    category: 'Geometric',
    preview: '#6366f120',
    build: (fg, bg, scale) => {
      const s = Math.round(16 * scale);
      const sw = Math.max(0.5, scale * 0.7);
      const h = s / 2;
      // Diamond rotated square
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
        `<rect width="${s}" height="${s}" fill="${bg}"/>` +
        `<polygon points="${s/2},${(s/2)-h} ${s/2+h},${s/2} ${s/2},${(s/2)+h} ${s/2-h},${s/2}" fill="none" stroke="${fg}" stroke-width="${sw}"/>` +
        `</svg>`;
      return encSvg(svg);
    },
  },
];

export function buildPatternStyle(s: Shape): React.CSSProperties | null {
  if ((s.fillType ?? 'solid') !== 'pattern') return null;
  const pattern = FILL_PATTERNS.find(p => p.id === (s.patternId ?? 'dots'));
  if (!pattern) return null;
  const fg = s.patternColor ?? '#000000';
  const bg = s.patternBg ?? 'transparent';
  const scale = s.patternScale ?? 1;
  return {
    backgroundImage: pattern.build(fg, bg, scale),
    backgroundRepeat: 'repeat',
    backgroundSize: 'auto',
  };
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

  // Build transform: rotation + flip + skew + perspective tilt / full 3D
  {
    const parts: string[] = [];
    if (s.rotation !== 0) parts.push(`rotate(${s.rotation}deg)`);
    const sx = s.flipX ? -1 : 1;
    const sy = s.flipY ? -1 : 1;
    if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
    if (s.skewX && s.skewX !== 0) parts.push(`skewX(${s.skewX}deg)`);
    if (s.skewY && s.skewY !== 0) parts.push(`skewY(${s.skewY}deg)`);
    // Full 3D transform (takes priority over perspectiveTilt legacy prop)
    const has3d = (s.transform3dRotateX ?? 0) !== 0 ||
                  (s.transform3dRotateY ?? 0) !== 0 ||
                  (s.transform3dRotateZ ?? 0) !== 0 ||
                  (s.transform3dTranslateZ ?? 0) !== 0 ||
                  (s.transform3dScaleZ != null && s.transform3dScaleZ !== 1);
    if (has3d) {
      const p = s.transform3dPerspective ?? 800;
      parts.push(`perspective(${p}px)`);
      if ((s.transform3dRotateX ?? 0) !== 0) parts.push(`rotateX(${s.transform3dRotateX}deg)`);
      if ((s.transform3dRotateY ?? 0) !== 0) parts.push(`rotateY(${s.transform3dRotateY}deg)`);
      if ((s.transform3dRotateZ ?? 0) !== 0) parts.push(`rotateZ(${s.transform3dRotateZ}deg)`);
      if ((s.transform3dTranslateZ ?? 0) !== 0) parts.push(`translateZ(${s.transform3dTranslateZ}px)`);
      if (s.transform3dScaleZ != null && s.transform3dScaleZ !== 1) parts.push(`scaleZ(${s.transform3dScaleZ})`);
      // Enable 3D rendering context
      style.transformStyle = 'preserve-3d';
    } else if (s.perspectiveTilt && s.perspectiveTilt !== 0) {
      const deg = s.perspectiveTilt * 35; // max ~35deg
      const axis = s.perspectiveTiltAxis ?? 'y';
      if (axis === 'x') parts.push(`perspective(600px) rotateX(${deg}deg)`);
      else if (axis === 'y') parts.push(`perspective(600px) rotateY(${deg}deg)`);
      else parts.push(`perspective(600px) rotateX(${deg * 0.5}deg) rotateY(${deg * 0.5}deg)`);
    }
    if (parts.length > 0) style.transform = parts.join(' ');
  }

  if (s.blendMode && s.blendMode !== 'normal') {
    style.mixBlendMode = s.blendMode;
  }

  // CSS filters
  {
    const parts: string[] = [];
    if (s.filterBlur && s.filterBlur > 0) parts.push(`blur(${s.filterBlur}px)`);
    if (s.filterBrightness !== undefined && s.filterBrightness !== 100) parts.push(`brightness(${s.filterBrightness}%)`);
    if (s.filterContrast !== undefined && s.filterContrast !== 100) parts.push(`contrast(${s.filterContrast}%)`);
    if (s.filterSaturate !== undefined && s.filterSaturate !== 100) parts.push(`saturate(${s.filterSaturate}%)`);
    if (s.filterGrayscale && s.filterGrayscale > 0) parts.push(`grayscale(${s.filterGrayscale}%)`);
    if (s.filterSepia && s.filterSepia > 0) parts.push(`sepia(${s.filterSepia}%)`);
    if (s.filterHueRotate && s.filterHueRotate !== 0) parts.push(`hue-rotate(${s.filterHueRotate}deg)`);
    if (s.filterInvert && s.filterInvert > 0) parts.push(`invert(${s.filterInvert}%)`);
    if (parts.length > 0) style.filter = parts.join(' ');
  }

  // Backdrop filter (glassmorphism)
  if (s.filterBackdropBlur && s.filterBackdropBlur > 0) {
    style.backdropFilter = `blur(${s.filterBackdropBlur}px)`;
    style.WebkitBackdropFilter = `blur(${s.filterBackdropBlur}px)`;
  }

  const fillType = s.fillType ?? 'solid';
  if (fillType === 'linear-gradient' || fillType === 'radial-gradient') {
    const stops = (s.gradientStops ?? []).map(st => {
      const hasAlpha = st.opacity !== undefined && st.opacity < 1;
      if (hasAlpha) {
        const r = parseInt(st.color.slice(1, 3), 16);
        const g = parseInt(st.color.slice(3, 5), 16);
        const b = parseInt(st.color.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${(st.opacity ?? 1).toFixed(2)}) ${(st.position * 100).toFixed(1)}%`;
      }
      return `${st.color} ${(st.position * 100).toFixed(1)}%`;
    }).join(', ');
    if (fillType === 'linear-gradient') {
      style.backgroundImage = `linear-gradient(${s.gradientAngle ?? 135}deg, ${stops})`;
    } else {
      style.backgroundImage = `radial-gradient(circle, ${stops})`;
    }
  } else if (fillType === 'image' && s.imageUrl) {
    style.backgroundImage = `url("${s.imageUrl}")`;
    const fit = s.imageFit ?? 'fill';
    if (fit === 'fill') {
      style.backgroundSize = '100% 100%';
      style.backgroundRepeat = 'no-repeat';
    } else if (fit === 'fit') {
      style.backgroundSize = 'contain';
      style.backgroundRepeat = 'no-repeat';
      style.backgroundPosition = 'center';
    } else if (fit === 'crop') {
      style.backgroundSize = 'cover';
      style.backgroundRepeat = 'no-repeat';
      style.backgroundPosition = 'center';
    } else if (fit === 'tile') {
      style.backgroundSize = 'auto';
      style.backgroundRepeat = 'repeat';
    }
  } else if (fillType === 'pattern') {
    const ps = buildPatternStyle(s);
    if (ps) {
      if (ps.backgroundImage) style.backgroundImage = ps.backgroundImage as string;
      if (ps.backgroundRepeat) style.backgroundRepeat = ps.backgroundRepeat as string;
      if (ps.backgroundSize) style.backgroundSize = ps.backgroundSize as string;
    }
    // Apply background color (bg color of pattern)
    if (s.patternBg && s.patternBg !== 'transparent') {
      style.backgroundColor = s.patternBg;
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

  // Build box-shadow string from shadow stack (takes priority) or legacy single shadow
  const shadowParts: string[] = [];
  if (s.shadows && s.shadows.length > 0) {
    for (const sh of s.shadows) {
      const spread = sh.spread ? ` ${sh.spread}px` : '';
      const inset = sh.inset ? 'inset ' : '';
      shadowParts.push(`${inset}${sh.x}px ${sh.y}px ${sh.blur}px${spread} ${sh.color}`);
    }
  } else if (s.shadow) {
    shadowParts.push(`${s.shadowX}px ${s.shadowY}px ${s.shadowBlur}px ${s.shadowColor}`);
  }

  // Skip solid stroke if gradient stroke is set (gradient stroke is rendered as SVG overlay in CanvasOverlay)
  const hasGradientStroke = !!(s.strokeGradientStops && s.strokeGradientStops.length >= 2 && s.strokeWidth > 0);
  if (!hasGradientStroke && s.stroke !== 'transparent' && s.strokeWidth > 0) {
    const pos = s.strokePosition ?? 'center';
    const dashStyle = s.type === 'frame' ? 'dashed' : (s.strokeDash === 'dashed' ? 'dashed' : s.strokeDash === 'dotted' ? 'dotted' : 'solid');
    if (pos === 'inside') {
      // Inset box-shadow simulates inside stroke without growing the element
      const parts = [`inset 0 0 0 ${s.strokeWidth}px ${s.stroke}`, ...shadowParts];
      style.boxShadow = parts.join(', ');
    } else if (pos === 'outside') {
      // Outline simulates outside stroke without affecting layout
      style.outline = `${s.strokeWidth}px ${dashStyle} ${s.stroke}`;
      style.outlineOffset = '0px';
      if (shadowParts.length > 0) style.boxShadow = shadowParts.join(', ');
    } else {
      // center (default)
      style.border = `${s.strokeWidth}px ${dashStyle} ${s.stroke}`;
      if (shadowParts.length > 0) style.boxShadow = shadowParts.join(', ');
    }
  } else if (shadowParts.length > 0) {
    style.boxShadow = shadowParts.join(', ');
  }

  const radiusCss = radiusToCss(s.borderRadius);
  if (radiusCss !== '0') {
    style.borderRadius = radiusCss;
  }

  // Frame clip contents
  if (s.type === 'frame' && s.clipContents) {
    style.overflow = 'hidden';
  }

  // Frame scroll direction
  if (s.type === 'frame' && s.scrollDirection && s.scrollDirection !== 'none') {
    if (s.scrollDirection === 'vertical') {
      style.overflowY = 'auto';
      style.overflowX = 'hidden';
    } else if (s.scrollDirection === 'horizontal') {
      style.overflowX = 'auto';
      style.overflowY = 'hidden';
    } else if (s.scrollDirection === 'both') {
      style.overflow = 'auto';
    }
  }

  if (s.type === 'text') {
    style.fontSize = s.fontSize;
    style.fontFamily = s.fontFamily;
    style.fontWeight = s.fontWeight;
    style.fontStyle = s.fontStyle;
    if (s.fontVariationSettings) style.fontVariationSettings = s.fontVariationSettings;
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

  // CSS transition
  if (s.transitionDuration && s.transitionDuration > 0) {
    const props = (s.transitionProperties && s.transitionProperties.length > 0)
      ? s.transitionProperties.join(', ')
      : 'all';
    const easing = s.transitionEasing ?? 'ease';
    style.transition = `${props} ${s.transitionDuration}ms ${easing}`;
  }

  if (s.cssAnimation) {
    style.animation = s.cssAnimation;
  }

  // Noise / grain texture overlay — layered on top of the existing background
  if (s.noiseOpacity && s.noiseOpacity > 0) {
    const freq = (0.65 / Math.max(0.5, Math.min(4, s.noiseScale ?? 1))).toFixed(3);
    const alpha = Math.round(Math.min(1, s.noiseOpacity) * 255).toString(16).padStart(2, '0');
    // Build SVG feTurbulence noise as a data URI
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='${s.noiseOpacity.toFixed(2)}'/></feComponentTransfer></filter><rect width='200' height='200' filter='url(%23n)'/></svg>`;
    const noiseUrl = `url("data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/"/g, "'")}")`;
    // Layer noise on top of existing backgroundImage (if any)
    const existing = style.backgroundImage as string | undefined;
    style.backgroundImage = existing ? `${noiseUrl}, ${existing}` : noiseUrl;
  }

  return style;
}

/**
 * Convert a shape's visual style to a CSS string suitable for copying.
 * Excludes position/size (left/top/width/height) so it can be applied to any element.
 */
export function shapeToCss(s: Shape): string {
  const style = buildShapeStyle(s);
  // Remove layout properties not relevant to "copy as CSS"
  const skip = new Set(['position', 'left', 'top', 'width', 'height', 'boxSizing', 'userSelect']);
  const camelToKebab = (str: string) => str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
  const lines: string[] = [
    `/* ${s.name} — ${s.width}×${s.height} */`,
    ...(s.notes ? [`/* Note: ${s.notes} */`] : []),
    `width: ${s.width}px;`,
    `height: ${s.height}px;`,
  ];
  for (const [prop, val] of Object.entries(style)) {
    if (skip.has(prop)) continue;
    if (val === undefined || val === null || val === '') continue;
    lines.push(`${camelToKebab(prop)}: ${typeof val === 'number' && !['opacity', 'fontWeight', 'lineHeight', 'zIndex', 'flexGrow', 'flexShrink', 'order'].includes(prop) ? `${val}px` : val};`);
  }
  return lines.join('\n');
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
    } else if (shapeFillType === 'image' && s.imageUrl) {
      // Image fill on canvas — synchronous only if image already loaded
      const img = new Image();
      img.src = s.imageUrl;
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.clip();
        const fit = s.imageFit ?? 'fill';
        if (fit === 'fill') {
          ctx.drawImage(img, sx, sy, s.width, s.height);
        } else if (fit === 'fit') {
          const scaleX = s.width / img.naturalWidth;
          const scaleY = s.height / img.naturalHeight;
          const scale2 = Math.min(scaleX, scaleY);
          const dw = img.naturalWidth * scale2;
          const dh = img.naturalHeight * scale2;
          ctx.drawImage(img, sx + (s.width - dw) / 2, sy + (s.height - dh) / 2, dw, dh);
        } else { // crop / tile
          const scaleX = s.width / img.naturalWidth;
          const scaleY = s.height / img.naturalHeight;
          const scale2 = Math.max(scaleX, scaleY);
          const dw = img.naturalWidth * scale2;
          const dh = img.naturalHeight * scale2;
          ctx.drawImage(img, sx + (s.width - dw) / 2, sy + (s.height - dh) / 2, dw, dh);
        }
        ctx.restore();
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
      }
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

// ── SVG export helper (full implementation in lib/exportSvg.ts) ───────────────

/**
 * Converts a single Shape to an SVG element string.
 * Handles rectangles, ellipses, text, and paths.
 * Frames are rendered as groups with clipping.
 * @internal used only by shapes.ts shapesToSvg
 */
function shapeToSvgEl(s: Shape, ox: number, oy: number): string {
  const x = s.x - ox;
  const y = s.y - oy;
  const op = s.opacity !== undefined && s.opacity !== 1 ? ` opacity="${s.opacity}"` : '';

  // Build transform
  const transforms: string[] = [];
  if (s.rotation !== 0) {
    transforms.push(`rotate(${s.rotation} ${x + s.width / 2} ${y + s.height / 2})`);
  }
  const transformAttr = transforms.length > 0 ? ` transform="${transforms.join(' ')}"` : '';

  // Fill
  const fillType = s.fillType ?? 'solid';
  let fill = s.fill === 'transparent' ? 'none' : s.fill;
  let defs = '';
  let gradientRef = '';

  if (fillType === 'linear-gradient' || fillType === 'radial-gradient') {
    const gradId = `grad-${s.id}`;
    const stops = (s.gradientStops ?? []).map(st => {
      const alpha = st.opacity !== undefined && st.opacity < 1 ? ` stop-opacity="${st.opacity}"` : '';
      return `  <stop offset="${(st.position * 100).toFixed(1)}%" stop-color="${st.color}"${alpha}/>`;
    }).join('\n');
    if (fillType === 'linear-gradient') {
      const angle = (s.gradientAngle ?? 135) * (Math.PI / 180);
      const x1 = 50 - Math.cos(angle) * 50;
      const y1 = 50 - Math.sin(angle) * 50;
      const x2 = 50 + Math.cos(angle) * 50;
      const y2 = 50 + Math.sin(angle) * 50;
      defs = `<linearGradient id="${gradId}" x1="${x1.toFixed(1)}%" y1="${y1.toFixed(1)}%" x2="${x2.toFixed(1)}%" y2="${y2.toFixed(1)}%">\n${stops}\n</linearGradient>`;
    } else {
      defs = `<radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">\n${stops}\n</radialGradient>`;
    }
    fill = `url(#${gradId})`;
    gradientRef = `<defs>${defs}</defs>`;
  }

  const fillOpacity = (s.fillOpacity !== undefined && s.fillOpacity < 1 && fillType === 'solid')
    ? ` fill-opacity="${s.fillOpacity}"`
    : '';

  const stroke = s.stroke !== 'transparent' && s.strokeWidth > 0
    ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth}"`
    : ` stroke="none"`;

  const [rTL, rTR, rBR, rBL] = normalizeRadius(s.borderRadius);
  const isEllipse = !Array.isArray(s.borderRadius) && s.borderRadius >= 9999;

  let el = '';

  if (s.type === 'path' && s.points?.length) {
    const d = buildPathD(s.points, s.pathClosed ?? false);
    el = `<path d="${d}" fill="${fill}"${fillOpacity}${stroke}${op}${transformAttr}/>`;
  } else if (s.type === 'ellipse' || isEllipse) {
    const rx = s.width / 2;
    const ry = s.height / 2;
    el = `<ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" fill="${fill}"${fillOpacity}${stroke}${op}${transformAttr}/>`;
  } else if (s.type === 'text') {
    const textAnchor = s.textAlign === 'center' ? 'middle' : s.textAlign === 'right' ? 'end' : 'start';
    const tx = s.textAlign === 'center' ? x + s.width / 2 : s.textAlign === 'right' ? x + s.width : x;
    el = `<text x="${tx}" y="${y + s.height / 2}" text-anchor="${textAnchor}" dominant-baseline="middle" ` +
      `font-family="${s.fontFamily}" font-size="${s.fontSize}" font-weight="${s.fontWeight}" ` +
      `font-style="${s.fontStyle}" fill="${s.color ?? '#000000'}"${op}${transformAttr}>${s.text ?? ''}</text>`;
  } else {
    // Rectangle / Frame
    const hasRadius = rTL > 0 || rTR > 0 || rBR > 0 || rBL > 0;
    const rrAttr = hasRadius ? (rTL === rTR && rTR === rBR && rBR === rBL
      ? ` rx="${rTL}"`
      : ` rx="${rTL} ${rTR} ${rBR} ${rBL}"`)
      : '';
    el = `<rect x="${x}" y="${y}" width="${s.width}" height="${s.height}"${rrAttr} fill="${fill}"${fillOpacity}${stroke}${op}${transformAttr}/>`;
  }

  if (gradientRef) el = gradientRef + el;

  // Named comment
  return `<!-- ${s.name} -->\n${el}`;
}

/**
 * Exports an array of shapes as a standalone SVG string.
 * Adds 20px padding around the bounding box.
 */
export function shapesToSvg(shapes: Shape[]): string {
  if (shapes.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';

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
  const ox = minX - pad;
  const oy = minY - pad;

  const elements = shapes
    .filter(s => !s.hidden)
    .map(s => shapeToSvgEl(s, ox, oy))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- Generated by Quill Design Tool -->
${elements}
</svg>`;
}

// ── Quick Shape Generators ─────────────────────────────────────────────────────
// These produce BezierPoint[] arrays for common geometric shapes.
// All coords are normalized 0-1 (scale × size when inserting).

/** n-pointed regular polygon centered at 0.5, 0.5 in a 1×1 box */
function regularPolygon(n: number, cx = 0.5, cy = 0.5, r = 0.5, startAngle = -Math.PI / 2): BezierPoint[] {
  const pts: BezierPoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = startAngle + (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Star with `points` outer tips and inner radius `innerR` */
function starPoints(points: number, outerR = 0.5, innerR = 0.2, cx = 0.5, cy = 0.5): BezierPoint[] {
  const pts: BezierPoint[] = [];
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const a = -Math.PI / 2 + (i / total) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/**
 * Create a path Shape from a normalized BezierPoint[] generator.
 * @param id   shape id
 * @param name display name
 * @param rawPts normalized 0-1 points
 * @param size size in canvas px (width = height = size)
 * @param x canvas X position
 * @param y canvas Y position
 * @param fill hex color
 */
export function quickPathShape(
  id: string,
  name: string,
  rawPts: BezierPoint[],
  size: number,
  x: number,
  y: number,
  fill: string,
): Shape {
  const points = rawPts.map(p => ({ ...p, x: p.x * size, y: p.y * size }));
  const base = defaultShape('path', id);
  return {
    ...base,
    name,
    x, y,
    width: size, height: size,
    fill,
    fillType: 'solid',
    stroke: 'transparent',
    strokeWidth: 0,
    points,
    pathClosed: true,
  };
}

// Named generators (export for use in command palette / quick insert)

export const QUICK_SHAPE_DEFS = [
  {
    id: 'star-5',
    label: '⭐ 5-Point Star',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, 'Star', starPoints(5, 0.5, 0.2), 120, x, y, '#f59e0b'),
  },
  {
    id: 'star-6',
    label: '✡ 6-Point Star',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, '6-Point Star', starPoints(6, 0.5, 0.25), 120, x, y, '#6366f1'),
  },
  {
    id: 'triangle',
    label: '▲ Triangle',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, 'Triangle', regularPolygon(3, 0.5, 0.5, 0.5), 120, x, y, '#10b981'),
  },
  {
    id: 'pentagon',
    label: '⬠ Pentagon',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, 'Pentagon', regularPolygon(5, 0.5, 0.5, 0.5), 120, x, y, '#8b5cf6'),
  },
  {
    id: 'hexagon',
    label: '⬡ Hexagon',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, 'Hexagon', regularPolygon(6, 0.5, 0.5, 0.5, 0), 120, x, y, '#06b6d4'),
  },
  {
    id: 'octagon',
    label: '⯃ Octagon',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, 'Octagon', regularPolygon(8, 0.5, 0.5, 0.5), 120, x, y, '#ec4899'),
  },
  {
    id: 'diamond',
    label: '◆ Diamond',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, 'Diamond', regularPolygon(4, 0.5, 0.5, 0.5), 120, x, y, '#ef4444'),
  },
  {
    id: 'arrow-right',
    label: '➤ Arrow Right',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, 'Arrow Right', [
        { x: 0, y: 0.3 },
        { x: 0.6, y: 0.3 },
        { x: 0.6, y: 0.0 },
        { x: 1.0, y: 0.5 },
        { x: 0.6, y: 1.0 },
        { x: 0.6, y: 0.7 },
        { x: 0, y: 0.7 },
      ], 120, x, y, '#3b82f6'),
  },
  {
    id: 'cross',
    label: '✚ Cross / Plus',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, 'Cross', [
        { x: 0.33, y: 0 }, { x: 0.67, y: 0 },
        { x: 0.67, y: 0.33 }, { x: 1, y: 0.33 },
        { x: 1, y: 0.67 }, { x: 0.67, y: 0.67 },
        { x: 0.67, y: 1 }, { x: 0.33, y: 1 },
        { x: 0.33, y: 0.67 }, { x: 0, y: 0.67 },
        { x: 0, y: 0.33 }, { x: 0.33, y: 0.33 },
      ], 120, x, y, '#f97316'),
  },
  {
    id: 'callout',
    label: '💬 Speech Bubble',
    group: 'Shapes',
    make: (id: string, x: number, y: number) =>
      quickPathShape(id, 'Speech Bubble', [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 0.75 },
        { x: 0.5, y: 0.75 },
        { x: 0.35, y: 1 },
        { x: 0.3, y: 0.75 },
        { x: 0, y: 0.75 },
      ], 120, x, y, '#a855f7'),
  },
] as const;
