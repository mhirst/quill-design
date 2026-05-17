/**
 * GradientMeshPanel — generate beautiful gradient mesh backgrounds.
 *
 * A gradient mesh is a grid of colored control points that blends into a smooth
 * multi-color gradient — far richer than a two-stop CSS linear gradient.
 *
 * This panel renders an SVG preview and lets the user:
 *  - Choose mesh size (2×2 to 5×5)
 *  - Pick colors for each control point
 *  - Randomize the mesh
 *  - Apply as an image fill to the selected shape (or insert as a new rectangle)
 *  - Use preset "mood" palettes
 */

import React, { useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeshPoint {
  r: number;
  g: number;
  b: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function bilerp(
  tl: number, tr: number, bl: number, br: number,
  tx: number, ty: number
): number {
  const top = lerp(tl, tr, tx);
  const bot = lerp(bl, br, tx);
  return lerp(top, bot, ty);
}

/** Bilinearly interpolate a single channel in a mesh cell */
function sampleMesh(
  grid: MeshPoint[][],
  px: number,
  py: number,
  rows: number,
  cols: number,
  channel: 'r' | 'g' | 'b'
): number {
  const cellW = 1 / (cols - 1);
  const cellH = 1 / (rows - 1);
  const col = Math.min(Math.floor(px / cellW), cols - 2);
  const row = Math.min(Math.floor(py / cellH), rows - 2);
  const tx = (px - col * cellW) / cellW;
  const ty = (py - row * cellH) / cellH;
  return bilerp(
    grid[row][col][channel],
    grid[row][col + 1][channel],
    grid[row + 1][col][channel],
    grid[row + 1][col + 1][channel],
    tx, ty
  );
}

/** Render the mesh grid into an off-screen canvas and return a data URL */
function renderMeshToCanvas(
  grid: MeshPoint[][],
  rows: number,
  cols: number,
  w: number,
  h: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x / (w - 1);
      const py = y / (h - 1);
      const r = sampleMesh(grid, px, py, rows, cols, 'r');
      const g = sampleMesh(grid, px, py, rows, cols, 'g');
      const b = sampleMesh(grid, px, py, rows, cols, 'b');
      const idx = (y * w + x) * 4;
      data[idx] = Math.round(r);
      data[idx + 1] = Math.round(g);
      data[idx + 2] = Math.round(b);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

// ── Presets ───────────────────────────────────────────────────────────────────

const MESH_PALETTES: { label: string; colors: string[][]; emoji: string }[] = [
  {
    label: 'Aurora', emoji: '🌌',
    colors: [
      ['#0f172a', '#1e1b4b', '#312e81'],
      ['#1e3a5f', '#4c1d95', '#7c3aed'],
      ['#064e3b', '#065f46', '#10b981'],
    ],
  },
  {
    label: 'Sunset', emoji: '🌅',
    colors: [
      ['#1e1b4b', '#4338ca', '#7c3aed'],
      ['#9d174d', '#db2777', '#f97316'],
      ['#7c2d12', '#ea580c', '#fbbf24'],
    ],
  },
  {
    label: 'Ocean', emoji: '🌊',
    colors: [
      ['#0c4a6e', '#0369a1', '#0284c7'],
      ['#164e63', '#0e7490', '#06b6d4'],
      ['#042f2e', '#115e59', '#0d9488'],
    ],
  },
  {
    label: 'Rose Garden', emoji: '🌹',
    colors: [
      ['#450a0a', '#7f1d1d', '#991b1b'],
      ['#831843', '#9d174d', '#db2777'],
      ['#4a044e', '#86198f', '#d946ef'],
    ],
  },
  {
    label: 'Forest', emoji: '🌲',
    colors: [
      ['#052e16', '#14532d', '#166534'],
      ['#064e3b', '#065f46', '#047857'],
      ['#1a2e05', '#365314', '#4d7c0f'],
    ],
  },
  {
    label: 'Cotton Candy', emoji: '🍬',
    colors: [
      ['#fdf2f8', '#fce7f3', '#fbcfe8'],
      ['#ede9fe', '#ddd6fe', '#c4b5fd'],
      ['#e0f2fe', '#bae6fd', '#7dd3fc'],
    ],
  },
  {
    label: 'Lava', emoji: '🌋',
    colors: [
      ['#1c0500', '#450a0a', '#7f1d1d'],
      ['#431407', '#7c2d12', '#c2410c'],
      ['#422006', '#92400e', '#d97706'],
    ],
  },
  {
    label: 'Holo', emoji: '✨',
    colors: [
      ['#6366f1', '#8b5cf6', '#a855f7'],
      ['#06b6d4', '#0284c7', '#3b82f6'],
      ['#ec4899', '#f43f5e', '#f97316'],
    ],
  },
];

const MESH_SIZES: { rows: number; cols: number; label: string }[] = [
  { rows: 2, cols: 2, label: '2×2' },
  { rows: 3, cols: 3, label: '3×3' },
  { rows: 4, cols: 4, label: '4×4' },
  { rows: 2, cols: 3, label: '2×3' },
  { rows: 3, cols: 2, label: '3×2' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
}

export function GradientMeshPanel({ open, onClose, onApply }: Props) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [grid, setGrid] = useState<MeshPoint[][]>(() => makeGrid(3, 3, MESH_PALETTES[0].colors));
  const [selectedPoint, setSelectedPoint] = useState<{ r: number; c: number } | null>(null);
  const [previewSize] = useState(240);
  const [rendering, setRendering] = useState(false);


  const applyPalette = (palette: typeof MESH_PALETTES[0]) => {
    setGrid(makeGrid(rows, cols, palette.colors));
    setSelectedPoint(null);
  };

  const changeSize = (newRows: number, newCols: number) => {
    setRows(newRows);
    setCols(newCols);
    // Rebuild grid with current colors scaled
    setGrid(resizeGrid(grid, rows, cols, newRows, newCols));
    setSelectedPoint(null);
  };

  const randomize = () => {
    const newGrid: MeshPoint[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => {
        const hue = Math.random() * 360;
        const [r, g, b] = hslToRgb(hue, 0.6 + Math.random() * 0.4, 0.35 + Math.random() * 0.3);
        return { r, g, b };
      })
    );
    setGrid(newGrid);
    setSelectedPoint(null);
  };

  const setPointColor = (row: number, col: number, hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    setGrid(prev => {
      const next = prev.map(row2 => [...row2]);
      next[row][col] = { r, g, b };
      return next;
    });
  };

  const handleApply = () => {
    setRendering(true);
    // Render at higher resolution for quality
    const dataUrl = renderMeshToCanvas(grid, rows, cols, 800, 600);
    setRendering(false);
    onApply(dataUrl);
  };

  if (!open) return null;

  const selPoint = selectedPoint ? grid[selectedPoint.r]?.[selectedPoint.c] : null;
  const selHex = selPoint ? rgbToHex(selPoint.r, selPoint.g, selPoint.b) : '#000000';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9990,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          width: 560,
          maxWidth: '96vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border)', gap: 10, flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <defs>
              <linearGradient id="mhg1" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="mhg2" x1="0" y1="1" x2="1" y2="0">
                <stop stopColor="#06b6d4" />
                <stop offset="1" stopColor="#f97316" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="7.5" height="7.5" rx="1.5" fill="url(#mhg1)" />
            <rect x="9.5" y="1" width="7.5" height="7.5" rx="1.5" fill="url(#mhg2)" />
            <rect x="1" y="9.5" width="7.5" height="7.5" rx="1.5" fill="url(#mhg2)" opacity="0.8" />
            <rect x="9.5" y="9.5" width="7.5" height="7.5" rx="1.5" fill="url(#mhg1)" opacity="0.8" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            Gradient Mesh Generator
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', width: 26, height: 26,
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', gap: 16 }}>
          {/* Left: preview + controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '0 0 auto' }}>
            {/* Mesh preview with point handles */}
            <div style={{ position: 'relative', width: previewSize, height: previewSize, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
              <MeshPreview grid={grid} rows={rows} cols={cols} size={previewSize} />
              {/* Control points */}
              {Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => {
                  const x = (c / (cols - 1)) * previewSize;
                  const y = (r / (rows - 1)) * previewSize;
                  const pt = grid[r][c];
                  const hex = rgbToHex(pt.r, pt.g, pt.b);
                  const isSelected = selectedPoint?.r === r && selectedPoint?.c === c;
                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => setSelectedPoint({ r, c })}
                      style={{
                        position: 'absolute',
                        left: x - 8, top: y - 8,
                        width: 16, height: 16,
                        borderRadius: '50%',
                        background: hex,
                        border: `2.5px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.7)'}`,
                        boxShadow: isSelected
                          ? `0 0 0 2px var(--accent), 0 2px 8px rgba(0,0,0,0.4)`
                          : '0 1px 4px rgba(0,0,0,0.4)',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.12s, border-color 0.12s, transform 0.1s',
                        transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                        zIndex: isSelected ? 2 : 1,
                      }}
                    />
                  );
                })
              )}
            </div>

            {/* Selected point color picker */}
            {selectedPoint && (
              <div style={{
                background: 'var(--panel-alt)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: selHex,
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                    Point [{selectedPoint.r},{selectedPoint.c}]
                  </div>
                  <input
                    type="color"
                    value={selHex}
                    onChange={e => setPointColor(selectedPoint.r, selectedPoint.c, e.target.value)}
                    style={{
                      width: '100%', height: 28, border: '1px solid var(--border)',
                      borderRadius: 5, cursor: 'pointer', background: 'none', padding: 2,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>
                  {selHex}
                </div>
              </div>
            )}

            {/* Size selector */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Mesh Size
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {MESH_SIZES.map(({ rows: r, cols: c, label }) => {
                  const isActive = rows === r && cols === c;
                  return (
                    <button
                      key={label}
                      onClick={() => changeSize(r, c)}
                      style={{
                        height: 26, paddingInline: 10, borderRadius: 5,
                        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                        background: isActive ? 'var(--accent-dim)' : 'var(--panel-alt)',
                        color: isActive ? 'var(--accent)' : 'var(--muted)',
                        cursor: 'pointer', fontSize: 10.5, fontWeight: isActive ? 700 : 400,
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; } }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={randomize}
                style={{
                  flex: 1, height: 32, borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--panel-alt)',
                  color: 'var(--text)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.color = 'var(--text)'; }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M1 4h7a3 3 0 0 1 0 6H7M11 4l-2-2M11 4l-2 2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 8H1m0 0L3 6M1 8l2 2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Randomize
              </button>
              <button
                onClick={handleApply}
                disabled={rendering}
                style={{
                  flex: 1, height: 32, borderRadius: 6,
                  border: '1px solid rgba(99,102,241,0.5)',
                  background: rendering ? 'var(--panel-alt)' : 'var(--accent)',
                  color: rendering ? 'var(--muted)' : '#fff',
                  cursor: rendering ? 'default' : 'pointer', fontSize: 11, fontWeight: 700,
                  transition: 'all 0.12s',
                }}
              >
                {rendering ? 'Rendering…' : 'Apply to Shape'}
              </button>
            </div>
          </div>

          {/* Right: palette presets */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Palettes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MESH_PALETTES.map(palette => (
                <button
                  key={palette.label}
                  onClick={() => applyPalette(palette)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--panel-alt)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                    textAlign: 'left', width: '100%', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
                >
                  {/* Mini mesh preview */}
                  <div style={{ width: 40, height: 28, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                    <MeshPreview
                      grid={makeGrid(3, 3, palette.colors)}
                      rows={3} cols={3} size={40}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {palette.emoji} {palette.label}
                    </div>
                    {/* Color dots */}
                    <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
                      {palette.colors.flat().slice(0, 6).map((c, i) => (
                        <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MeshPreview — renders mesh via inline SVG radial gradients ────────────────

function MeshPreview({ grid, rows, cols, size }: {
  grid: MeshPoint[][];
  rows: number;
  cols: number;
  size: number;
}) {
  // Render bilinearly interpolated mesh as a grid of tiny rects
  const STEPS = 32; // resolution
  const cellW = size / STEPS;
  const cellH = size / STEPS;

  const cells: { x: number; y: number; fill: string }[] = [];
  for (let y = 0; y < STEPS; y++) {
    for (let x = 0; x < STEPS; x++) {
      const px = x / (STEPS - 1);
      const py = y / (STEPS - 1);
      const r = sampleMesh(grid, px, py, rows, cols, 'r');
      const g = sampleMesh(grid, px, py, rows, cols, 'g');
      const b = sampleMesh(grid, px, py, rows, cols, 'b');
      cells.push({
        x: x * cellW,
        y: y * cellH,
        fill: `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`,
      });
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {cells.map((cell, i) => (
        <rect
          key={i}
          x={cell.x} y={cell.y}
          width={cellW + 0.5} height={cellH + 0.5}
          fill={cell.fill}
        />
      ))}
    </svg>
  );
}

// ── Utility functions ─────────────────────────────────────────────────────────

function makeGrid(rows: number, cols: number, palette: string[][]): MeshPoint[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      // Sample palette bilinearly
      const pr = palette.length - 1;
      const pc = (palette[0]?.length ?? 1) - 1;
      const palR = Math.min(Math.floor(r * (pr / Math.max(1, rows - 1))), pr);
      const palC = Math.min(Math.floor(c * (pc / Math.max(1, cols - 1))), pc);
      const hex = palette[palR]?.[palC] ?? '#6366f1';
      const [rv, gv, bv] = hexToRgb(hex);
      return { r: rv, g: gv, b: bv };
    })
  );
}

function resizeGrid(
  old: MeshPoint[][],
  oldRows: number,
  oldCols: number,
  newRows: number,
  newCols: number
): MeshPoint[][] {
  return Array.from({ length: newRows }, (_, r) =>
    Array.from({ length: newCols }, (_, c) => {
      const pr = (r / Math.max(1, newRows - 1)) * (oldRows - 1);
      const pc = (c / Math.max(1, newCols - 1)) * (oldCols - 1);
      const fr = Math.floor(pr), fc = Math.floor(pc);
      const tr = pr - fr, tc = pc - fc;
      const r0 = Math.min(fr, oldRows - 2);
      const c0 = Math.min(fc, oldCols - 2);
      const r1 = Math.min(r0 + 1, oldRows - 1);
      const c1 = Math.min(c0 + 1, oldCols - 1);
      const blend = (ch: 'r' | 'g' | 'b') =>
        Math.round(bilerp(old[r0][c0][ch], old[r0][c1][ch], old[r1][c0][ch], old[r1][c1][ch], tc, tr));
      return { r: blend('r'), g: blend('g'), b: blend('b') };
    })
  );
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
