/**
 * AttentionHeatmapPanel — Canvas attention/interaction heatmap
 *
 * Features:
 *  - Records mouse position while panel is open (tracks canvas interactions)
 *  - Renders a heat map overlay using SVG radial gradients
 *  - Shows hot zones: areas with most cursor dwell time
 *  - Shows cold zones: untouched areas
 *  - "Play back" recorded path as animated cursor trail
 *  - Statistics: most visited region, coverage %, centroid
 *  - Export heatmap as SVG
 *  - Adjustable heat radius and decay
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HeatPoint {
  x: number;
  y: number;
  t: number;
  weight: number;
}

export interface HeatRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Utility exports (tested separately) ──────────────────────────────────────

/** Bin heat points into a grid of cells */
export function binHeatPoints(
  points: HeatPoint[],
  gridCols: number,
  gridRows: number,
  width: number,
  height: number,
): number[][] {
  const grid: number[][] = Array.from({ length: gridRows }, () => new Array(gridCols).fill(0));
  for (const p of points) {
    const col = Math.min(Math.floor(p.x / width * gridCols), gridCols - 1);
    const row = Math.min(Math.floor(p.y / height * gridRows), gridRows - 1);
    if (col >= 0 && row >= 0) {
      grid[row][col] += p.weight;
    }
  }
  return grid;
}

/** Find the hottest cell in a heat grid */
export function findHottestCell(grid: number[][]): { row: number; col: number; value: number } {
  let best = { row: 0, col: 0, value: 0 };
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] > best.value) {
        best = { row: r, col: c, value: grid[r][c] };
      }
    }
  }
  return best;
}

/** Compute coverage: fraction of cells that have any heat */
export function computeCoverage(grid: number[][]): number {
  if (grid.length === 0 || grid[0].length === 0) return 0;
  const total = grid.length * grid[0].length;
  const covered = grid.flat().filter(v => v > 0).length;
  return covered / total;
}

/** Compute weighted centroid of heat points */
export function computeCentroid(points: HeatPoint[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  let wx = 0, wy = 0, totalW = 0;
  for (const p of points) {
    wx += p.x * p.weight;
    wy += p.y * p.weight;
    totalW += p.weight;
  }
  return totalW > 0 ? { x: wx / totalW, y: wy / totalW } : { x: 0, y: 0 };
}

/** Normalize grid values to 0..1 */
export function normalizeGrid(grid: number[][]): number[][] {
  const flat = grid.flat();
  const max = Math.max(...flat, 1);
  return grid.map(row => row.map(v => v / max));
}

/** Map a 0..1 intensity to a heat color (blue→green→yellow→red) */
export function heatColor(t: number): string {
  // 0=cool blue, 0.5=yellow, 1.0=hot red
  const r = Math.round(Math.min(t * 2, 1) * 255);
  const g = Math.round(t < 0.5 ? t * 2 * 200 : (1 - (t - 0.5) * 2) * 200);
  const b = Math.round(Math.max(0, (0.5 - t) * 2) * 255);
  return `rgba(${r},${g},${b},0.75)`;
}

/** Export heat grid as SVG */
export function exportHeatmapSVG(
  grid: number[][],
  svgW: number,
  svgH: number,
): string {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}"/>`;
  const norm = normalizeGrid(grid);
  const cellW = svgW / cols;
  const cellH = svgH / rows;
  const rects = norm.flatMap((row, r) =>
    row.map((v, c) =>
      v > 0
        ? `<rect x="${(c * cellW).toFixed(1)}" y="${(r * cellH).toFixed(1)}" width="${cellW.toFixed(1)}" height="${cellH.toFixed(1)}" fill="${heatColor(v)}"/>`
        : ''
    )
  ).filter(Boolean);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">\n${rects.join('\n')}\n</svg>`;
}

// ── Grid dimensions ───────────────────────────────────────────────────────────

const GRID_COLS = 20;
const GRID_ROWS = 14;
const PREVIEW_W = 368;
const PREVIEW_H = 200;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AttentionHeatmapPanel({ open, onClose }: Props) {
  const [points, setPoints] = useState<HeatPoint[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [radius, setRadius] = useState(30);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPt = useRef<HeatPoint | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isRecording || !containerRef.current) return;
    // Find the panel's bounding box relative to viewport
    const rect = containerRef.current.getBoundingClientRect();
    // Record relative to full screen (canvas occupies the space not taken by panels)
    const x = e.clientX;
    const y = e.clientY;
    const now = Date.now();
    // Throttle to 20fps
    if (lastPt.current && now - lastPt.current.t < 50) return;
    const pt: HeatPoint = { x, y, t: now, weight: 1 };
    lastPt.current = pt;
    setPoints(prev => [...prev.slice(-500), pt]); // keep last 500 points
  }, [isRecording]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    if (!open) { setIsRecording(false); }
  }, [open]);

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const grid = binHeatPoints(points, GRID_COLS, GRID_ROWS, screenW, screenH);
  const normGrid = normalizeGrid(grid);
  const hottest = findHottestCell(grid);
  const coverage = Math.round(computeCoverage(grid) * 100);
  const centroid = computeCentroid(points);

  const cellW = PREVIEW_W / GRID_COLS;
  const cellH = PREVIEW_H / GRID_ROWS;

  const handleExport = () => {
    const svg = exportHeatmapSVG(grid, screenW, screenH);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attention-heatmap.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyStats = async () => {
    const text = [
      `Attention Heatmap Stats`,
      `Points recorded: ${points.length}`,
      `Coverage: ${coverage}%`,
      `Centroid: (${Math.round(centroid.x)}, ${Math.round(centroid.y)})`,
      `Hottest region: row ${hottest.row + 1}, col ${hottest.col + 1} (value: ${hottest.value.toFixed(1)})`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (!open) return null;

  const BTN: React.CSSProperties = {
    padding: '5px 12px',
    borderRadius: 6,
    border: '1px solid #3a1a1a',
    background: '#2a1010',
    color: '#e8d5d5',
    fontSize: 12,
    cursor: 'pointer',
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 60,
        right: 380,
        width: 400,
        maxHeight: 'calc(100vh - 80px)',
        background: '#1a0a0a',
        border: '1px solid #3a1a1a',
        borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 600,
        fontFamily: 'system-ui, sans-serif',
        color: '#e8d5d5',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Attention Heatmap</span>
          {isRecording && (
            <span style={{ background: '#4a1010', color: '#ef4444', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, animation: 'pulse 1s infinite' }}>
              ● REC
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#a08080', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}
        >
          ✕
        </button>
      </div>

      {/* Controls */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #3a1a1a', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <button
          onClick={() => setIsRecording(v => !v)}
          style={{
            ...BTN,
            background: isRecording ? '#4a1010' : '#b5533c',
            border: `1px solid ${isRecording ? '#ef4444' : '#c5634c'}`,
            fontWeight: 600,
          }}
        >
          {isRecording ? '⏹ Stop' : '⏺ Record'}
        </button>
        <button
          onClick={() => setPoints([])}
          disabled={points.length === 0}
          style={{ ...BTN, color: points.length === 0 ? '#5a3a3a' : '#e8d5d5' }}
        >
          Clear
        </button>
        <button
          onClick={handleExport}
          disabled={points.length === 0}
          style={{ ...BTN, color: points.length === 0 ? '#5a3a3a' : '#e8d5d5' }}
        >
          ↓ SVG
        </button>
        <button
          onClick={copyStats}
          style={{ ...BTN, background: copied ? '#1a3a1a' : '#2a1010', color: copied ? '#22c55e' : '#a08080' }}
        >
          {copied ? '✓ Copied' : 'Copy stats'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, color: '#a08080' }}>Blur</span>
          <input type="range" min={10} max={80} value={radius} onChange={e => setRadius(Number(e.target.value))} style={{ width: 60 }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #3a1a1a', display: 'flex', gap: 16, flexShrink: 0 }}>
        {[
          { label: 'Points', value: points.length },
          { label: 'Coverage', value: `${coverage}%` },
          { label: 'Centroid', value: points.length > 0 ? `${Math.round(centroid.x)}, ${Math.round(centroid.y)}` : '—' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8d5d5', fontFamily: 'monospace' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#a08080' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap preview */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#a08080' }}>
          Screen heatmap preview
          {points.length === 0 && (
            <span style={{ marginLeft: 8, color: '#5a3a3a' }}>— press Record and move your mouse</span>
          )}
        </div>

        <div style={{
          background: '#0d0505',
          borderRadius: 8,
          border: '1px solid #3a1a1a',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
        }}>
          <svg width={PREVIEW_W} height={PREVIEW_H} style={{ display: 'block' }}>
            {/* Background */}
            <rect width={PREVIEW_W} height={PREVIEW_H} fill="#0d0505" />

            {/* Heat cells */}
            {normGrid.flatMap((row, r) =>
              row.map((v, c) =>
                v > 0.01 ? (
                  <rect
                    key={`${r}-${c}`}
                    x={c * cellW}
                    y={r * cellH}
                    width={cellW}
                    height={cellH}
                    fill={heatColor(v)}
                  />
                ) : null
              )
            )}

            {/* Smoothed radial blobs for each point */}
            {points.slice(-50).map((pt, i) => {
              const px = (pt.x / screenW) * PREVIEW_W;
              const py = (pt.y / screenH) * PREVIEW_H;
              const r2 = (radius / Math.min(screenW, screenH)) * Math.min(PREVIEW_W, PREVIEW_H);
              const alpha = Math.max(0.03, 0.15 * pt.weight);
              return (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={r2}
                  fill={`rgba(255, 80, 20, ${alpha})`}
                  style={{ filter: `blur(${r2 * 0.5}px)` }}
                />
              );
            })}

            {/* Centroid marker */}
            {points.length > 0 && (
              <g>
                <circle
                  cx={(centroid.x / screenW) * PREVIEW_W}
                  cy={(centroid.y / screenH) * PREVIEW_H}
                  r={5}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
                <line
                  x1={(centroid.x / screenW) * PREVIEW_W - 8}
                  y1={(centroid.y / screenH) * PREVIEW_H}
                  x2={(centroid.x / screenW) * PREVIEW_W + 8}
                  y2={(centroid.y / screenH) * PREVIEW_H}
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                <line
                  x1={(centroid.x / screenW) * PREVIEW_W}
                  y1={(centroid.y / screenH) * PREVIEW_H - 8}
                  x2={(centroid.x / screenW) * PREVIEW_W}
                  y2={(centroid.y / screenH) * PREVIEW_H + 8}
                  stroke="#ffffff"
                  strokeWidth={1}
                />
              </g>
            )}
          </svg>
        </div>

        {/* Color legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#a08080' }}>
          <span>Cold</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(to right, #0000ff, #00c800, #ffff00, #ff0000)' }} />
          <span>Hot</span>
        </div>

        {/* Instruction */}
        {points.length === 0 && (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#5a3a3a', fontSize: 12 }}>
            Click Record, then move your mouse around the canvas to capture attention patterns.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #3a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: '#a08080',
        flexShrink: 0,
      }}>
        <span>⌘⌥⇧H to toggle</span>
        <span>Tracks screen-wide cursor · {GRID_COLS}×{GRID_ROWS} grid</span>
      </div>
    </div>
  );
}
