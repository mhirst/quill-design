/**
 * GenerativeArtPanel — Algorithmic / generative art pattern generator.
 *
 * Generates beautiful SVG-based patterns using classic generative algorithms:
 * Truchet tiles, Lissajous curves, spirograph, flow fields, fractal trees,
 * wave interference, Islamic geometry, Voronoi, and more.
 *
 * Outputs are applied as `imageUrl` SVG data URIs on selected shapes.
 *
 * Shortcut: Cmd+Shift+Alt+G
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GenPattern {
  id: string;
  name: string;
  emoji: string;
  category: string;
  description: string;
  params: GenParam[];
  generate: (params: Record<string, number>, colors: string[]) => string; // returns SVG string
}

interface GenParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

// ── Math helpers ──────────────────────────────────────────────────────────────

const TWO_PI = Math.PI * 2;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ── SVG builders ──────────────────────────────────────────────────────────────

function svgWrap(content: string, w: number, h: number, bg?: string): string {
  const bgRect = bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bgRect}${content}</svg>`;
}

function svgToDataUri(svg: string): string {
  const encoded = svg
    .replace(/&/g, '&amp;')
    .replace(/"/g, "'")
    .replace(/#/g, '%23')
    .replace(/\s+/g, ' ')
    .trim();
  return `url("data:image/svg+xml,${encoded}")`;
}

// ── PATTERN GENERATORS ────────────────────────────────────────────────────────

// 1. Truchet Tiles
function truchet(params: Record<string, number>, colors: string[]): string {
  const size = Math.round(params.size ?? 40);
  const cols = Math.round(400 / size);
  const rows = Math.round(400 / size);
  const strokeW = params.strokeWidth ?? 2;
  const c1 = colors[0] || '#6366f1';
  const c2 = colors[1] || '#1e1e2e';
  let paths = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * size;
      const y = r * size;
      // pseudo-random based on position
      const flip = ((r * 7 + c * 13) % 3 === 0) || ((r + c) % 2 === 0);
      if (flip) {
        paths += `<path d="M${x},${y + size} Q${x},${y} ${x + size},${y}" fill="none" stroke="${c1}" stroke-width="${strokeW}" stroke-linecap="round"/>`;
      } else {
        paths += `<path d="M${x},${y} Q${x + size},${y} ${x + size},${y + size}" fill="none" stroke="${c1}" stroke-width="${strokeW}" stroke-linecap="round"/>`;
      }
    }
  }
  return svgToDataUri(svgWrap(paths, 400, 400, c2));
}

// 2. Lissajous Curve
function lissajous(params: Record<string, number>, colors: string[]): string {
  const a = params.a ?? 3;
  const b = params.b ?? 2;
  const delta = (params.delta ?? 45) * (Math.PI / 180);
  const steps = 500;
  const r = 180;
  const cx = 200, cy = 200;
  const strokeW = params.strokeWidth ?? 2;
  const c1 = colors[0] || '#6366f1';
  const c2 = colors[1] || '#0f0f17';
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TWO_PI;
    const x = cx + r * Math.sin(a * t + delta);
    const y = cy + r * Math.sin(b * t);
    d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`;
  }
  const svg = `<path d="${d}Z" fill="none" stroke="${c1}" stroke-width="${strokeW}" stroke-opacity="0.9"/>`;
  return svgToDataUri(svgWrap(svg, 400, 400, c2));
}

// 3. Spirograph (hypotrochoid)
function spirograph(params: Record<string, number>, colors: string[]): string {
  const R = params.R ?? 120;
  const r = params.r ?? 85;
  const d = params.d ?? 95;
  const steps = 800;
  const cx = 200, cy = 200;
  const strokeW = params.strokeWidth ?? 1.5;
  const c1 = colors[0] || '#f472b6';
  const c2 = colors[1] || '#0f0f17';
  let path = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TWO_PI * (r / gcd(Math.round(R), Math.round(r)));
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    path += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`;
  }
  const svg = `<path d="${path}Z" fill="none" stroke="${c1}" stroke-width="${strokeW}"/>`;
  return svgToDataUri(svgWrap(svg, 400, 400, c2));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// 4. Fractal Tree
function fractalTree(params: Record<string, number>, colors: string[]): string {
  const depth = Math.round(clamp(params.depth ?? 8, 3, 12));
  const angle = (params.angle ?? 25) * (Math.PI / 180);
  const ratio = params.ratio ?? 0.72;
  const c1 = colors[0] || '#10b981';
  const c2 = colors[1] || '#0f0f17';
  const lines: string[] = [];

  function branch(x: number, y: number, len: number, ang: number, dep: number) {
    if (dep === 0 || len < 1) return;
    const x2 = x + len * Math.sin(ang);
    const y2 = y - len * Math.cos(ang);
    const sw = Math.max(0.5, dep * 0.6);
    const opacity = dep / depth;
    lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c1}" stroke-width="${sw.toFixed(1)}" stroke-opacity="${opacity.toFixed(2)}" stroke-linecap="round"/>`);
    branch(x2, y2, len * ratio, ang - angle, dep - 1);
    branch(x2, y2, len * ratio, ang + angle, dep - 1);
  }

  branch(200, 380, 80, 0, depth);
  return svgToDataUri(svgWrap(lines.join(''), 400, 400, c2));
}

// 5. Flow Field (Perlin-like)
function flowField(params: Record<string, number>, colors: string[]): string {
  const lines = Math.round(params.lines ?? 60);
  const steps = Math.round(params.steps ?? 40);
  const scale = params.scale ?? 0.008;
  const len = params.stepLen ?? 6;
  const strokeW = params.strokeWidth ?? 0.8;
  const c1 = colors[0] || '#6366f1';
  const c2 = colors[1] || '#0a0a1a';

  // Pseudo-Perlin via trigonometric hash
  function noise(x: number, y: number): number {
    return Math.sin(x * 2.3 + y * 1.7) * Math.cos(x * 1.1 - y * 2.9) * Math.PI;
  }

  const paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    const startX = (i / lines) * 400;
    for (let seed = 0; seed < 3; seed++) {
      let x = startX;
      let y = (seed / 3 + (i % 5) / 15) * 400;
      let d = `M${x.toFixed(2)},${y.toFixed(2)}`;
      for (let s = 0; s < steps; s++) {
        const angle = noise(x * scale, y * scale);
        x += Math.cos(angle) * len;
        y += Math.sin(angle) * len;
        if (x < 0 || x > 400 || y < 0 || y > 400) break;
        d += `L${x.toFixed(2)},${y.toFixed(2)}`;
      }
      const opacity = 0.3 + Math.random() * 0.4;
      paths.push(`<path d="${d}" fill="none" stroke="${c1}" stroke-width="${strokeW}" stroke-opacity="${opacity.toFixed(2)}"/>`);
    }
  }
  return svgToDataUri(svgWrap(paths.join(''), 400, 400, c2));
}

// 6. Wave Interference
function waveInterference(params: Record<string, number>, colors: string[]): string {
  const freq1 = params.freq1 ?? 3;
  const freq2 = params.freq2 ?? 5;
  const amp = params.amp ?? 20;
  const rows = Math.round(params.rows ?? 24);
  const c1 = colors[0] || '#f59e0b';
  const c2 = colors[1] || '#0f0f17';
  const paths: string[] = [];

  for (let r = 0; r < rows; r++) {
    const baseY = (r + 0.5) * (400 / rows);
    let d = '';
    const pts = 200;
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * 400;
      const t = (x / 400) * TWO_PI;
      const wave1 = Math.sin(t * freq1 + r * 0.4) * amp;
      const wave2 = Math.sin(t * freq2 - r * 0.3) * (amp * 0.5);
      const y = baseY + wave1 + wave2;
      d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`;
    }
    const opacity = 0.4 + (r / rows) * 0.4;
    paths.push(`<path d="${d}" fill="none" stroke="${c1}" stroke-width="1.2" stroke-opacity="${opacity.toFixed(2)}"/>`);
  }
  return svgToDataUri(svgWrap(paths.join(''), 400, 400, c2));
}

// 7. Islamic Geometry (8-fold star)
function islamicStar(params: Record<string, number>, colors: string[]): string {
  const tileSize = Math.round(params.tileSize ?? 100);
  const cols = Math.ceil(400 / tileSize) + 1;
  const rows = Math.ceil(400 / tileSize) + 1;
  const strokeW = params.strokeWidth ?? 1.2;
  const c1 = colors[0] || '#f59e0b';
  const c2 = colors[1] || '#1a1a1a';
  const c3 = colors[2] || '#7c3aed';
  const shapes: string[] = [];

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const cx = c * tileSize + tileSize / 2;
      const cy = r * tileSize + tileSize / 2;
      const R = tileSize * 0.45;
      // 8-pointed star
      const points8: string[] = [];
      for (let k = 0; k < 8; k++) {
        const angle1 = (k / 8) * TWO_PI - Math.PI / 8;
        const angle2 = ((k + 0.5) / 8) * TWO_PI - Math.PI / 8;
        points8.push(`${(cx + R * Math.cos(angle1)).toFixed(2)},${(cy + R * Math.sin(angle1)).toFixed(2)}`);
        points8.push(`${(cx + R * 0.4 * Math.cos(angle2)).toFixed(2)},${(cy + R * 0.4 * Math.sin(angle2)).toFixed(2)}`);
      }
      shapes.push(`<polygon points="${points8.join(' ')}" fill="${c3}" fill-opacity="0.3" stroke="${c1}" stroke-width="${strokeW}"/>`);
      // Inner octagon
      const octPts: string[] = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TWO_PI + Math.PI / 8;
        octPts.push(`${(cx + R * 0.38 * Math.cos(a)).toFixed(2)},${(cy + R * 0.38 * Math.sin(a)).toFixed(2)}`);
      }
      shapes.push(`<polygon points="${octPts.join(' ')}" fill="${c3}" fill-opacity="0.5" stroke="${c1}" stroke-width="${strokeW * 0.6}"/>`);
    }
  }
  return svgToDataUri(svgWrap(shapes.join(''), 400, 400, c2));
}

// 8. Voronoi-like (stippled cells)
function voronoiStipple(params: Record<string, number>, colors: string[]): string {
  const count = Math.round(params.count ?? 30);
  const c1 = colors[0] || '#6366f1';
  const c2 = colors[1] || '#0f0f17';

  // Pseudo-random but deterministic points
  const pts: [number, number][] = Array.from({ length: count }, (_, i) => [
    ((i * 173 + 41) % 397) + 1,
    ((i * 127 + 83) % 397) + 1,
  ]);

  const cells: string[] = [];

  // Draw colored voronoi-like regions using a crude nearest-point scan
  // Instead, we draw circles at each point with varying sizes and opacity
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    // Find nearest other point for sizing
    let minDist = 400;
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const dx = pts[j][0] - x;
      const dy = pts[j][1] - y;
      minDist = Math.min(minDist, Math.sqrt(dx * dx + dy * dy));
    }
    const r = minDist * 0.45;
    const opacity = 0.15 + (i % 5) * 0.07;
    cells.push(`<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${c1}" fill-opacity="${opacity.toFixed(2)}" stroke="${c1}" stroke-width="0.5" stroke-opacity="0.4"/>`);
    // Center dot
    cells.push(`<circle cx="${x}" cy="${y}" r="2" fill="${c1}" fill-opacity="0.8"/>`);
  }

  // Delaunay-style edges (connect each point to its neighbors)
  for (let i = 0; i < pts.length; i++) {
    const neighbors = [...pts]
      .map((p, j) => ({ j, d: Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) }))
      .filter((e) => e.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);
    for (const { j } of neighbors) {
      if (j > i) {
        cells.push(`<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[j][0]}" y2="${pts[j][1]}" stroke="${c1}" stroke-width="0.5" stroke-opacity="0.25"/>`);
      }
    }
  }

  return svgToDataUri(svgWrap(cells.join(''), 400, 400, c2));
}

// 9. Concentric Rings
function concentricRings(params: Record<string, number>, colors: string[]): string {
  const rings = Math.round(params.rings ?? 16);
  const wobble = params.wobble ?? 8;
  const strokeW = params.strokeWidth ?? 1.5;
  const c1 = colors[0] || '#06b6d4';
  const c2 = colors[1] || '#0f0f17';
  const paths: string[] = [];

  for (let ring = 1; ring <= rings; ring++) {
    const r = (ring / rings) * 190;
    const pts = 120;
    let d = '';
    for (let i = 0; i <= pts; i++) {
      const angle = (i / pts) * TWO_PI;
      const noise = Math.sin(angle * 3 + ring * 1.4) * wobble * 0.3 +
                    Math.cos(angle * 5 - ring * 0.7) * wobble * 0.2;
      const x = 200 + (r + noise) * Math.cos(angle);
      const y = 200 + (r + noise) * Math.sin(angle);
      d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`;
    }
    const opacity = 0.3 + (ring / rings) * 0.5;
    paths.push(`<path d="${d}Z" fill="none" stroke="${c1}" stroke-width="${strokeW}" stroke-opacity="${opacity.toFixed(2)}"/>`);
  }
  return svgToDataUri(svgWrap(paths.join(''), 400, 400, c2));
}

// 10. Hex Grid with fill variance
function hexGrid(params: Record<string, number>, colors: string[]): string {
  const size = params.size ?? 28;
  const c1 = colors[0] || '#6366f1';
  const c2 = colors[1] || '#0f0f17';
  const c3 = colors[2] || '#8b5cf6';
  const shapes: string[] = [];
  const hexW = size * 2;
  const hexH = Math.sqrt(3) * size;
  const cols = Math.ceil(420 / hexW) + 2;
  const rows = Math.ceil(420 / hexH) + 2;

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const offset = (r % 2) * (hexW * 0.5);
      const cx = c * hexW + offset;
      const cy = r * hexH;
      const pts: string[] = [];
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TWO_PI + Math.PI / 6;
        pts.push(`${(cx + size * Math.cos(ang)).toFixed(2)},${(cy + size * Math.sin(ang)).toFixed(2)}`);
      }
      const hash = (r * 7 + c * 13) % 10;
      const fill = hash < 2 ? c3 : hash < 5 ? c1 : 'none';
      const fillOp = hash < 2 ? '0.7' : hash < 5 ? '0.35' : '0';
      shapes.push(`<polygon points="${pts.join(' ')}" fill="${fill}" fill-opacity="${fillOp}" stroke="${c1}" stroke-width="0.8" stroke-opacity="0.4"/>`);
    }
  }
  return svgToDataUri(svgWrap(shapes.join(''), 400, 400, c2));
}

// 11. Sunburst
function sunburst(params: Record<string, number>, colors: string[]): string {
  const rays = Math.round(params.rays ?? 24);
  const c1 = colors[0] || '#f59e0b';
  const c2 = colors[1] || '#0f0f17';
  const paths: string[] = [];
  const innerR = params.innerR ?? 60;
  const outerR = 195;

  for (let i = 0; i < rays; i++) {
    const angle1 = (i / rays) * TWO_PI - Math.PI / 2;
    const angle2 = ((i + 0.5) / rays) * TWO_PI - Math.PI / 2;
    const angle3 = ((i + 1) / rays) * TWO_PI - Math.PI / 2;
    const cx = 200, cy = 200;

    // Alternating ray widths
    const isMain = i % 2 === 0;
    const tipR = isMain ? outerR : outerR * 0.7;
    const opacity = isMain ? '0.8' : '0.4';

    const x1 = cx + innerR * Math.cos(angle1);
    const y1 = cy + innerR * Math.sin(angle1);
    const x2 = cx + tipR * Math.cos(angle2);
    const y2 = cy + tipR * Math.sin(angle2);
    const x3 = cx + innerR * Math.cos(angle3);
    const y3 = cy + innerR * Math.sin(angle3);

    paths.push(`<path d="M${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} Z" fill="${c1}" fill-opacity="${opacity}" stroke="${c1}" stroke-width="0.5" stroke-opacity="0.3"/>`);
  }
  // Center circle
  paths.push(`<circle cx="200" cy="200" r="${innerR * 0.6}" fill="${c1}" fill-opacity="0.9"/>`);

  return svgToDataUri(svgWrap(paths.join(''), 400, 400, c2));
}

// 12. Diamond Grid
function diamondGrid(params: Record<string, number>, colors: string[]): string {
  const size = params.size ?? 30;
  const cols = Math.ceil(450 / size) + 2;
  const rows = Math.ceil(450 / size) + 2;
  const c1 = colors[0] || '#a78bfa';
  const c2 = colors[1] || '#0f0f17';
  const shapes: string[] = [];

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const cx = c * size + (r % 2) * (size / 2);
      const cy = r * size * 0.5;
      const hash = (r * 5 + c * 11) % 7;
      const fill = hash < 2 ? c1 : 'none';
      const opacity = hash < 2 ? (0.4 + hash * 0.2).toFixed(2) : '0';
      shapes.push(
        `<polygon points="${cx},${cy - size / 2} ${cx + size / 2},${cy} ${cx},${cy + size / 2} ${cx - size / 2},${cy}" fill="${fill}" fill-opacity="${opacity}" stroke="${c1}" stroke-width="0.5" stroke-opacity="0.3"/>`
      );
    }
  }
  return svgToDataUri(svgWrap(shapes.join(''), 400, 400, c2));
}

// ── Pattern Database ──────────────────────────────────────────────────────────

const PATTERNS: GenPattern[] = [
  {
    id: 'truchet',
    name: 'Truchet Tiles',
    emoji: '⊕',
    category: 'Geometric',
    description: 'Curved quarter-circle tiles with random orientation — classic generative art',
    params: [
      { key: 'size', label: 'Tile Size', min: 20, max: 80, step: 5, defaultValue: 40 },
      { key: 'strokeWidth', label: 'Stroke', min: 1, max: 6, step: 0.5, defaultValue: 2 },
    ],
    generate: truchet,
  },
  {
    id: 'lissajous',
    name: 'Lissajous',
    emoji: '∞',
    category: 'Mathematical',
    description: 'Lissajous figures — parametric curves from harmonic oscillation',
    params: [
      { key: 'a', label: 'Freq A', min: 1, max: 8, step: 1, defaultValue: 3 },
      { key: 'b', label: 'Freq B', min: 1, max: 8, step: 1, defaultValue: 2 },
      { key: 'delta', label: 'Phase °', min: 0, max: 360, step: 15, defaultValue: 45 },
      { key: 'strokeWidth', label: 'Stroke', min: 0.5, max: 5, step: 0.5, defaultValue: 2 },
    ],
    generate: lissajous,
  },
  {
    id: 'spirograph',
    name: 'Spirograph',
    emoji: '🌀',
    category: 'Mathematical',
    description: 'Hypotrochoid spirograph curves — like the classic drawing toy',
    params: [
      { key: 'R', label: 'Outer R', min: 60, max: 180, step: 5, defaultValue: 120 },
      { key: 'r', label: 'Inner R', min: 20, max: 150, step: 5, defaultValue: 85 },
      { key: 'd', label: 'Offset', min: 10, max: 150, step: 5, defaultValue: 95 },
      { key: 'strokeWidth', label: 'Stroke', min: 0.5, max: 4, step: 0.5, defaultValue: 1.5 },
    ],
    generate: spirograph,
  },
  {
    id: 'fractal-tree',
    name: 'Fractal Tree',
    emoji: '🌲',
    category: 'Fractal',
    description: 'Recursive binary branching tree — depth controls detail',
    params: [
      { key: 'depth', label: 'Depth', min: 3, max: 11, step: 1, defaultValue: 8 },
      { key: 'angle', label: 'Branch °', min: 10, max: 60, step: 5, defaultValue: 25 },
      { key: 'ratio', label: 'Length Ratio', min: 0.5, max: 0.9, step: 0.05, defaultValue: 0.72 },
    ],
    generate: fractalTree,
  },
  {
    id: 'flow-field',
    name: 'Flow Field',
    emoji: '〰️',
    category: 'Organic',
    description: 'Particle flow field driven by trigonometric noise — organic, fluid look',
    params: [
      { key: 'lines', label: 'Particles', min: 20, max: 100, step: 10, defaultValue: 60 },
      { key: 'steps', label: 'Steps', min: 20, max: 80, step: 10, defaultValue: 40 },
      { key: 'scale', label: 'Field Scale', min: 1, max: 20, step: 1, defaultValue: 8 },
      { key: 'stepLen', label: 'Step Length', min: 3, max: 12, step: 1, defaultValue: 6 },
    ],
    generate: (p, c) => flowField({ ...p, scale: p.scale / 1000 }, c),
  },
  {
    id: 'wave-interference',
    name: 'Wave Interference',
    emoji: '〜',
    category: 'Organic',
    description: 'Overlapping sine waves creating moiré-like interference patterns',
    params: [
      { key: 'freq1', label: 'Freq 1', min: 1, max: 10, step: 0.5, defaultValue: 3 },
      { key: 'freq2', label: 'Freq 2', min: 1, max: 10, step: 0.5, defaultValue: 5 },
      { key: 'amp', label: 'Amplitude', min: 5, max: 40, step: 5, defaultValue: 20 },
      { key: 'rows', label: 'Rows', min: 8, max: 40, step: 4, defaultValue: 24 },
    ],
    generate: waveInterference,
  },
  {
    id: 'islamic-star',
    name: 'Islamic Geometry',
    emoji: '✡',
    category: 'Geometric',
    description: '8-fold Islamic star tile pattern — mathematically precise sacred geometry',
    params: [
      { key: 'tileSize', label: 'Tile Size', min: 60, max: 160, step: 10, defaultValue: 100 },
      { key: 'strokeWidth', label: 'Stroke', min: 0.5, max: 3, step: 0.5, defaultValue: 1.2 },
    ],
    generate: islamicStar,
  },
  {
    id: 'voronoi',
    name: 'Voronoi',
    emoji: '⬡',
    category: 'Organic',
    description: 'Voronoi-inspired cell diagram with Delaunay-style edges',
    params: [
      { key: 'count', label: 'Seeds', min: 10, max: 60, step: 5, defaultValue: 30 },
    ],
    generate: voronoiStipple,
  },
  {
    id: 'concentric-rings',
    name: 'Wobbly Rings',
    emoji: '◎',
    category: 'Organic',
    description: 'Concentric rings with sinusoidal wobble — topographic-map aesthetic',
    params: [
      { key: 'rings', label: 'Ring Count', min: 6, max: 28, step: 2, defaultValue: 16 },
      { key: 'wobble', label: 'Wobble', min: 0, max: 30, step: 2, defaultValue: 8 },
      { key: 'strokeWidth', label: 'Stroke', min: 0.5, max: 3, step: 0.5, defaultValue: 1.5 },
    ],
    generate: concentricRings,
  },
  {
    id: 'hex-grid',
    name: 'Hex Grid',
    emoji: '🔷',
    category: 'Geometric',
    description: 'Hexagonal grid with pseudo-random fill variance',
    params: [
      { key: 'size', label: 'Hex Size', min: 14, max: 60, step: 4, defaultValue: 28 },
    ],
    generate: hexGrid,
  },
  {
    id: 'sunburst',
    name: 'Sunburst',
    emoji: '☀️',
    category: 'Geometric',
    description: 'Radial sunburst rays with alternating lengths — retro / art deco',
    params: [
      { key: 'rays', label: 'Ray Count', min: 8, max: 48, step: 4, defaultValue: 24 },
      { key: 'innerR', label: 'Inner Radius', min: 20, max: 100, step: 10, defaultValue: 60 },
    ],
    generate: sunburst,
  },
  {
    id: 'diamond-grid',
    name: 'Diamond Grid',
    emoji: '💎',
    category: 'Geometric',
    description: 'Isometric diamond tessellation with random fills',
    params: [
      { key: 'size', label: 'Diamond Size', min: 16, max: 64, step: 4, defaultValue: 30 },
    ],
    generate: diamondGrid,
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(PATTERNS.map((p) => p.category)))];

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onApply: (ids: string[], patch: Partial<Shape>) => void;
}

export function GenerativeArtPanel({ open, onClose, selectedShape, selectedShapeIds, onApply }: Props) {
  const [activePattern, setActivePattern] = useState(PATTERNS[0]);
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
  const [colors, setColors] = useState(['#6366f1', '#0f0f17', '#8b5cf6']);
  const [category, setCategory] = useState('All');
  const [previewUri, setPreviewUri] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const previewCanvasRef = useRef<HTMLDivElement>(null);

  const ids = selectedShapeIds.length > 0
    ? selectedShapeIds
    : selectedShape ? [selectedShape.id] : [];

  // Get current param values with defaults
  const getParams = useCallback((pattern: GenPattern): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const param of pattern.params) {
      result[param.key] = paramValues[`${pattern.id}-${param.key}`] ?? param.defaultValue;
    }
    return result;
  }, [paramValues]);

  const setParam = useCallback((pattern: GenPattern, key: string, value: number) => {
    setParamValues((prev) => ({ ...prev, [`${pattern.id}-${key}`]: value }));
  }, []);

  // Regenerate preview whenever pattern/params/colors change
  useEffect(() => {
    setIsGenerating(true);
    const params = getParams(activePattern);
    try {
      const uri = activePattern.generate(params, colors);
      setPreviewUri(uri);
    } catch (e) {
      // generation failed silently
    }
    setIsGenerating(false);
  }, [activePattern, paramValues, colors, getParams]);

  const handleApply = useCallback(() => {
    if (ids.length === 0 || !previewUri) return;
    // Extract raw SVG data URI (strip `url("...")` wrapper)
    const raw = previewUri.replace(/^url\("/, '').replace(/"\)$/, '');
    onApply(ids, {
      fillType: 'image',
      imageUrl: raw,
      imageFit: 'fill',
      fillOpacity: 1,
    });
  }, [ids, previewUri, onApply]);

  const randomize = useCallback(() => {
    const newValues: Record<string, number> = {};
    for (const param of activePattern.params) {
      const range = param.max - param.min;
      const raw = param.min + Math.random() * range;
      const steps = Math.round(raw / param.step);
      newValues[`${activePattern.id}-${param.key}`] = clamp(
        Math.round(steps * param.step * 100) / 100,
        param.min,
        param.max,
      );
    }
    setParamValues((prev) => ({ ...prev, ...newValues }));
  }, [activePattern]);

  if (!open) return null;

  const filteredPatterns = PATTERNS.filter((p) => category === 'All' || p.category === category);
  const hasSelection = ids.length > 0;

  // Extract the background style from the previewUri to show in the mini preview
  const previewBg = previewUri
    ? previewUri
    : 'var(--canvas-bg, #0f0f17)';

  return (
    <div
      style={{
        position: 'fixed', top: 56, right: 340, width: 330,
        maxHeight: 'calc(100vh - 80px)',
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        zIndex: 310,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #e2e8f0)' }}>
            🎲 Generative Art
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
            {hasSelection ? `Apply to ${ids.length} shape${ids.length > 1 ? 's' : ''}` : 'Select a shape to apply'}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 4, borderRadius: 4 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Live Preview */}
        <div
          ref={previewCanvasRef}
          style={{
            height: 160,
            backgroundImage: previewBg,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: 8,
            position: 'relative',
            borderBottom: '1px solid var(--border, #2d2d3d)',
          }}
        >
          {isGenerating && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
              <div style={{ color: '#fff', fontSize: 11 }}>Generating…</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={randomize}
              style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 8px', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
            >
              🎲 Random
            </button>
            <button
              onClick={handleApply}
              disabled={!hasSelection}
              style={{
                background: hasSelection ? 'var(--accent, #6366f1)' : 'rgba(0,0,0,0.6)',
                border: 'none', borderRadius: 6,
                color: hasSelection ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: 10, fontWeight: 700, padding: '4px 10px',
                cursor: hasSelection ? 'pointer' : 'not-allowed',
              }}
            >
              Apply →
            </button>
          </div>
        </div>

        {/* Color controls */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Colors</span>
          {colors.map((col, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: col, border: '1px solid rgba(255,255,255,0.15)' }} />
              <input
                type="color"
                value={col}
                onChange={(e) => setColors((prev) => { const next = [...prev]; next[i] = e.target.value; return next; })}
                style={{ width: 24, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'none', padding: 0 }}
              />
            </div>
          ))}
          <span style={{ fontSize: 9, color: 'var(--muted, #888)' }}>fg · bg · accent</span>
        </div>

        {/* Pattern parameters */}
        {activePattern.params.length > 0 && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activePattern.name} Parameters
            </div>
            {activePattern.params.map((param) => {
              const value = paramValues[`${activePattern.id}-${param.key}`] ?? param.defaultValue;
              return (
                <div key={param.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--text, #e2e8f0)', fontWeight: 600 }}>{param.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text, #e2e8f0)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{value}</span>
                  </div>
                  <input
                    type="range"
                    min={param.min} max={param.max} step={param.step}
                    value={value}
                    onChange={(e) => setParam(activePattern, param.key, Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent, #6366f1)', cursor: 'pointer' }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Pattern selector */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  flexShrink: 0, padding: '2px 8px', borderRadius: 20,
                  fontSize: 9, fontWeight: 700,
                  background: category === cat ? 'var(--accent, #6366f1)' : 'transparent',
                  border: category === cat ? 'none' : '1px solid var(--border, #2d2d3d)',
                  color: category === cat ? '#fff' : 'var(--muted, #888)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Pattern grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {filteredPatterns.map((pattern) => (
              <button
                key={pattern.id}
                onClick={() => setActivePattern(pattern)}
                title={pattern.description}
                style={{
                  background: activePattern.id === pattern.id ? 'rgba(99,102,241,0.15)' : 'var(--panel-alt, #252535)',
                  border: activePattern.id === pattern.id ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border, #2d2d3d)',
                  borderRadius: 8, padding: '7px 4px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  transition: 'all 0.1s',
                }}
              >
                <span style={{ fontSize: 18 }}>{pattern.emoji}</span>
                <span style={{ fontSize: 8, fontWeight: 600, color: activePattern.id === pattern.id ? 'var(--accent, #6366f1)' : 'var(--muted, #888)', textAlign: 'center', lineHeight: 1.2 }}>
                  {pattern.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border, #2d2d3d)', fontSize: 10, color: 'var(--muted, #888)', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>{PATTERNS.length} algorithms · SVG-based</span>
        <span>⌘⇧⌥G</span>
      </div>
    </div>
  );
}
