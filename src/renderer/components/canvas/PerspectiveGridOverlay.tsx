/**
 * PerspectiveGridOverlay — Perspective and isometric grid overlay for Quill.
 *
 * Modes:
 *  - 1-Point Perspective: single vanishing point, horizontal/vertical guides
 *  - 2-Point Perspective: two vanishing points on horizon line
 *  - Isometric: 30° / 60° diamond grid (game-dev / flat design staple)
 *  - Cabinet: oblique projection at 45° for depth
 *
 * Controls:
 *  - Drag vanishing points on canvas
 *  - Horizon line height
 *  - Grid line count / density
 *  - Color / opacity
 *  - Snap-to-grid toggle
 *
 * Rendered as pure SVG overlay on canvas.
 * Keyboard: ⌘⇧⌥P to toggle
 */

import React, { useCallback, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GridMode = '1-point' | '2-point' | 'isometric' | 'cabinet';

interface VanishingPoint { x: number; y: number }

interface Props {
  open: boolean;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
}

// ─── Grid Renderers ────────────────────────────────────────────────────────────

/** Generate lines from a vanishing point to the edges of the canvas */
function linesFromVP(
  vp: VanishingPoint, count: number, cw: number, ch: number, color: string, opacity: number,
): React.ReactElement[] {
  const lines: React.ReactElement[] = [];

  // Spread anchor points evenly across the canvas bottom (and top for variety)
  const anchors: [number, number][] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    anchors.push([t * cw, 0]);
    anchors.push([t * cw, ch]);
    anchors.push([0, t * ch]);
    anchors.push([cw, t * ch]);
  }

  const seen = new Set<string>();
  for (const [ax, ay] of anchors) {
    const dx = ax - vp.x;
    const dy = ay - vp.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) continue;

    // Extend to canvas bounds
    const tMax = Math.max(cw / Math.max(Math.abs(dx), 0.001), ch / Math.max(Math.abs(dy), 0.001)) * 1.5;
    const x2 = vp.x + dx * tMax;
    const y2 = vp.y + dy * tMax;
    const x1 = vp.x - dx * tMax;
    const y1 = vp.y - dy * tMax;

    const key = `${Math.round(dx / len * 100)},${Math.round(dy / len * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    lines.push(
      <line key={`${ax},${ay}`}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={0.5} opacity={opacity}
        strokeDasharray="none"
      />
    );
  }
  return lines;
}

/** 1-Point perspective SVG */
function OnePointGrid({ vp, count, cw, ch, color, opacity, horizonY }: {
  vp: VanishingPoint; count: number; cw: number; ch: number;
  color: string; opacity: number; horizonY: number;
}): React.ReactElement {
  const convergingLines = linesFromVP(vp, count, cw, ch, color, opacity * 0.7);

  // Horizontal lines
  const hLines: React.ReactElement[] = [];
  const step = ch / (count + 1);
  for (let i = 1; i <= count; i++) {
    const y = i * step;
    hLines.push(
      <line key={`h${i}`} x1={0} y1={y} x2={cw} y2={y}
        stroke={color} strokeWidth={0.5} opacity={opacity * 0.4} />
    );
  }

  return (
    <>
      {convergingLines}
      {hLines}
      {/* Horizon line */}
      <line x1={0} y1={horizonY} x2={cw} y2={horizonY}
        stroke={color} strokeWidth={1.5} opacity={opacity} />
      {/* VP marker */}
      <circle cx={vp.x} cy={vp.y} r={5} fill={color} opacity={0.8} />
      <circle cx={vp.x} cy={vp.y} r={9} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
    </>
  );
}

/** 2-Point perspective SVG */
function TwoPointGrid({ vp1, vp2, count, cw, ch, color, opacity, horizonY }: {
  vp1: VanishingPoint; vp2: VanishingPoint;
  count: number; cw: number; ch: number;
  color: string; opacity: number; horizonY: number;
}): React.ReactElement {
  const lines1 = linesFromVP(vp1, Math.floor(count / 2), cw, ch, color, opacity * 0.5);
  const lines2 = linesFromVP(vp2, Math.floor(count / 2), cw, ch, color, opacity * 0.5);

  // Vertical lines for structure
  const vLines: React.ReactElement[] = [];
  const step = cw / (count + 1);
  for (let i = 1; i <= count; i++) {
    const x = i * step;
    vLines.push(
      <line key={`v${i}`} x1={x} y1={0} x2={x} y2={ch}
        stroke={color} strokeWidth={0.3} opacity={opacity * 0.25} />
    );
  }

  return (
    <>
      {lines1}
      {lines2}
      {vLines}
      {/* Horizon line */}
      <line x1={0} y1={horizonY} x2={cw} y2={horizonY}
        stroke={color} strokeWidth={1.5} opacity={opacity} />
      {/* VP markers */}
      {[vp1, vp2].map((vp, i) => (
        <g key={i}>
          <circle cx={vp.x} cy={vp.y} r={5} fill={color} opacity={0.8} />
          <circle cx={vp.x} cy={vp.y} r={9} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
          <text x={vp.x + 12} y={vp.y + 4} fill={color} fontSize={9} opacity={0.8} fontWeight={700}>
            VP{i + 1}
          </text>
        </g>
      ))}
    </>
  );
}

/** Isometric grid SVG */
function IsometricGrid({ cw, ch, cellSize, color, opacity }: {
  cw: number; ch: number; cellSize: number; color: string; opacity: number;
}): React.ReactElement {
  const lines: React.ReactElement[] = [];
  const angle = Math.PI / 6; // 30°
  const tanA = Math.tan(angle);

  // Horizontal lines
  const hStep = cellSize * Math.sin(angle) * 2;
  const numH = Math.ceil(ch / hStep) + 2;
  for (let i = -2; i < numH; i++) {
    const y = i * hStep;
    lines.push(
      <line key={`h${i}`} x1={0} y1={y} x2={cw} y2={y}
        stroke={color} strokeWidth={0.5} opacity={opacity * 0.3} />
    );
  }

  // Left-leaning lines (30° from horizontal going right)
  const diagStep = cellSize;
  const numDiag = Math.ceil((cw + ch) / diagStep) + 4;
  for (let i = -numDiag; i < numDiag; i++) {
    const startX = i * diagStep;
    const endX = startX + ch / tanA;
    lines.push(
      <line key={`dl${i}`}
        x1={startX} y1={0} x2={endX} y2={ch}
        stroke={color} strokeWidth={0.5} opacity={opacity * 0.6}
      />
    );
  }

  // Right-leaning lines (150° from horizontal going right)
  for (let i = -numDiag; i < numDiag; i++) {
    const startX = i * diagStep;
    const endX = startX - ch / tanA;
    lines.push(
      <line key={`dr${i}`}
        x1={startX} y1={0} x2={endX} y2={ch}
        stroke={color} strokeWidth={0.5} opacity={opacity * 0.6}
      />
    );
  }

  return <>{lines}</>;
}

/** Cabinet (oblique) projection grid */
function CabinetGrid({ cw, ch, cellSize, color, opacity, angle }: {
  cw: number; ch: number; cellSize: number; color: string; opacity: number; angle: number;
}): React.ReactElement {
  const lines: React.ReactElement[] = [];
  const rad = (angle * Math.PI) / 180;
  const depthX = Math.cos(rad) * cellSize * 0.5;
  const depthY = -Math.sin(rad) * cellSize * 0.5;

  // Vertical grid lines
  const numV = Math.ceil(cw / cellSize) + 2;
  for (let i = 0; i < numV; i++) {
    const x = i * cellSize;
    lines.push(
      <line key={`v${i}`} x1={x} y1={0} x2={x} y2={ch}
        stroke={color} strokeWidth={0.5} opacity={opacity * 0.5} />
    );
  }

  // Horizontal grid lines
  const numH = Math.ceil(ch / cellSize) + 2;
  for (let i = 0; i < numH; i++) {
    const y = i * cellSize;
    lines.push(
      <line key={`h${i}`} x1={0} y1={y} x2={cw} y2={y}
        stroke={color} strokeWidth={0.5} opacity={opacity * 0.5} />
    );
  }

  // Depth lines (oblique)
  const numDepth = Math.ceil(Math.max(cw, ch) / cellSize) * 3;
  for (let i = -numDepth; i < numDepth; i++) {
    for (let j = -numDepth; j < numDepth; j++) {
      const x = i * cellSize;
      const y = j * cellSize;
      lines.push(
        <line key={`d${i},${j}`}
          x1={x} y1={y} x2={x + depthX * numDepth} y2={y + depthY * numDepth}
          stroke={color} strokeWidth={0.3} opacity={opacity * 0.3}
        />
      );
    }
  }

  return <>{lines}</>;
}

// ─── Control Panel ─────────────────────────────────────────────────────────────

interface ControlsProps {
  mode: GridMode;
  onModeChange: (m: GridMode) => void;
  count: number;
  onCountChange: (n: number) => void;
  cellSize: number;
  onCellSizeChange: (n: number) => void;
  color: string;
  onColorChange: (c: string) => void;
  opacity: number;
  onOpacityChange: (n: number) => void;
  horizonY: number;
  onHorizonYChange: (n: number) => void;
  cabinetAngle: number;
  onCabinetAngleChange: (n: number) => void;
  onClose: () => void;
  canvasHeight: number;
}

function PerspectiveControls({
  mode, onModeChange, count, onCountChange,
  cellSize, onCellSizeChange, color, onColorChange,
  opacity, onOpacityChange, horizonY, onHorizonYChange,
  cabinetAngle, onCabinetAngleChange, onClose, canvasHeight,
}: ControlsProps) {
  const MODES: { id: GridMode; label: string; emoji: string }[] = [
    { id: '1-point', label: '1-Point', emoji: '📐' },
    { id: '2-point', label: '2-Point', emoji: '🏛' },
    { id: 'isometric', label: 'Isometric', emoji: '🔷' },
    { id: 'cabinet', label: 'Cabinet', emoji: '📦' },
  ];

  const PRESETS: { label: string; color: string }[] = [
    { label: 'Indigo', color: '#818cf8' },
    { label: 'Cyan', color: '#22d3ee' },
    { label: 'Rose', color: '#fb7185' },
    { label: 'Amber', color: '#fbbf24' },
    { label: 'White', color: '#ffffff' },
  ];

  return (
    <div style={{
      position: 'absolute', top: 48, left: 12, width: 220,
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 30, pointerEvents: 'all',
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12 }}>🔭</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
            Perspective Grid
          </span>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>
          ×
        </button>
      </div>

      {/* Mode selector */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
        <div style={{ fontSize: 8, color: 'var(--muted, #666)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Grid Mode
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => onModeChange(m.id)}
              style={{
                padding: '5px 4px', borderRadius: 5,
                background: mode === m.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${mode === m.id ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                color: mode === m.id ? '#818cf8' : 'var(--muted, #888)',
                fontSize: 9, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              }}
            >
              <span style={{ fontSize: 14 }}>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Line count / density */}
        {(mode === '1-point' || mode === '2-point') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Lines per side</span>
              <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>{count}</span>
            </div>
            <input type="range" min={3} max={20} value={count}
              onChange={e => onCountChange(+e.target.value)}
              style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
            />
          </div>
        )}

        {/* Cell size for iso/cabinet */}
        {(mode === 'isometric' || mode === 'cabinet') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Cell size</span>
              <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>{cellSize}px</span>
            </div>
            <input type="range" min={20} max={200} step={4} value={cellSize}
              onChange={e => onCellSizeChange(+e.target.value)}
              style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
            />
          </div>
        )}

        {/* Horizon height */}
        {(mode === '1-point' || mode === '2-point') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Horizon height</span>
              <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>
                {Math.round((horizonY / canvasHeight) * 100)}%
              </span>
            </div>
            <input type="range" min={0} max={canvasHeight} value={horizonY}
              onChange={e => onHorizonYChange(+e.target.value)}
              style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
            />
          </div>
        )}

        {/* Cabinet angle */}
        {mode === 'cabinet' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Depth angle</span>
              <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>{cabinetAngle}°</span>
            </div>
            <input type="range" min={15} max={75} step={5} value={cabinetAngle}
              onChange={e => onCabinetAngleChange(+e.target.value)}
              style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
            />
          </div>
        )}

        {/* Opacity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Grid opacity</span>
            <span style={{ fontSize: 8, color: 'var(--text, #e2e8f0)', fontFamily: 'monospace' }}>
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <input type="range" min={0.05} max={1} step={0.05} value={opacity}
            onChange={e => onOpacityChange(+e.target.value)}
            style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
          />
        </div>

        {/* Color presets */}
        <div>
          <div style={{ fontSize: 8, color: 'var(--muted, #888)', marginBottom: 5 }}>Grid color</div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => onColorChange(p.color)}
                title={p.label}
                style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: p.color, border: `2px solid ${color === p.color ? 'white' : 'transparent'}`,
                  cursor: 'pointer', flexShrink: 0,
                }}
              />
            ))}
            <input type="color" value={color}
              onChange={e => onColorChange(e.target.value)}
              style={{
                width: 22, height: 22, borderRadius: 4,
                border: '1px solid var(--border, #2d2d3d)',
                cursor: 'pointer', background: 'none', padding: 0,
              }}
            />
          </div>
        </div>

        {/* Mode-specific tips */}
        <div style={{
          fontSize: 8, color: 'var(--muted, #555)', lineHeight: 1.5,
          borderTop: '1px solid var(--border, #2d2d3d)', paddingTop: 6,
        }}>
          {mode === '1-point' && '💡 1-point: objects face you head-on. Lines converge at one VP.'}
          {mode === '2-point' && '💡 2-point: view a corner. Lines converge to two VPs on the horizon.'}
          {mode === 'isometric' && '💡 Isometric: no perspective distortion. Equal scale in all directions.'}
          {mode === 'cabinet' && '💡 Cabinet: front face real-scale, depth lines at 45° at half-scale.'}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function PerspectiveGridOverlay({ open, canvasWidth, canvasHeight, zoom, panX, panY }: Props) {
  const [mode, setMode] = useState<GridMode>('1-point');
  const [showControls, setShowControls] = useState(true);
  const [count, setCount] = useState(10);
  const [cellSize, setCellSize] = useState(60);
  const [color, setColor] = useState('#818cf8');
  const [opacity, setOpacity] = useState(0.4);
  const [horizonY, setHorizonY] = useState(Math.round(canvasHeight / 3));
  const [cabinetAngle, setCabinetAngle] = useState(45);

  // VP positions (in screen coords for SVG overlay)
  const [vp1, setVp1] = useState<VanishingPoint>({ x: canvasWidth / 2, y: canvasHeight / 3 });
  const [vp2, setVp2] = useState<VanishingPoint>({ x: canvasWidth * 0.15, y: canvasHeight / 3 });
  const [vp3] = useState<VanishingPoint>({ x: canvasWidth * 0.85, y: canvasHeight / 3 });

  const [dragging, setDragging] = useState<'vp1' | 'vp2' | 'vp3' | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseDown = useCallback((vp: 'vp1' | 'vp2' | 'vp3') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(vp);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (dragging === 'vp1') setVp1({ x, y });
    else if (dragging === 'vp2') setVp2({ x, y });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  if (!open) return null;

  const vp2x = mode === '2-point' ? vp2 : vp1;
  const vp3current = { x: vp3.x, y: vp1.y };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 16 }}>
      {/* SVG overlay */}
      <svg
        ref={svgRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: dragging ? 'all' : 'none',
          cursor: dragging ? 'grabbing' : 'default',
          overflow: 'visible',
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <clipPath id="canvas-clip">
            <rect x={0} y={0} width={canvasWidth} height={canvasHeight} />
          </clipPath>
        </defs>

        <g clipPath="url(#canvas-clip)">
          {mode === '1-point' && (
            <OnePointGrid
              vp={vp1} count={count} cw={canvasWidth} ch={canvasHeight}
              color={color} opacity={opacity} horizonY={horizonY}
            />
          )}
          {mode === '2-point' && (
            <TwoPointGrid
              vp1={vp2x} vp2={vp3current} count={count}
              cw={canvasWidth} ch={canvasHeight}
              color={color} opacity={opacity} horizonY={vp1.y}
            />
          )}
          {mode === 'isometric' && (
            <IsometricGrid
              cw={canvasWidth} ch={canvasHeight} cellSize={cellSize}
              color={color} opacity={opacity}
            />
          )}
          {mode === 'cabinet' && (
            <CabinetGrid
              cw={canvasWidth} ch={canvasHeight} cellSize={cellSize}
              color={color} opacity={opacity} angle={cabinetAngle}
            />
          )}
        </g>

        {/* Draggable VP handles for 1-point */}
        {mode === '1-point' && (
          <g style={{ pointerEvents: 'all', cursor: dragging === 'vp1' ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown('vp1')}>
            <circle cx={vp1.x} cy={vp1.y} r={12} fill="transparent" />
          </g>
        )}

        {/* Draggable VP handles for 2-point */}
        {mode === '2-point' && (
          <>
            <g style={{ pointerEvents: 'all', cursor: dragging === 'vp2' ? 'grabbing' : 'grab' }}
              onMouseDown={handleMouseDown('vp2')}>
              <circle cx={vp2x.x} cy={vp2x.y} r={12} fill="transparent" />
            </g>
            <g style={{ pointerEvents: 'all', cursor: dragging === 'vp1' ? 'grabbing' : 'grab' }}
              onMouseDown={handleMouseDown('vp1')}>
              <circle cx={vp1.x} cy={vp1.y} r={12} fill="transparent" />
            </g>
          </>
        )}
      </svg>

      {/* Toggle button */}
      <div style={{ position: 'absolute', top: 8, left: 12, pointerEvents: 'all' }}>
        <button
          onClick={() => setShowControls(v => !v)}
          style={{
            height: 28, padding: '0 10px',
            background: showControls ? 'rgba(99,102,241,0.2)' : 'var(--panel, #1e1e2e)',
            border: `1px solid ${showControls ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
            borderRadius: 6, cursor: 'pointer',
            color: showControls ? '#818cf8' : 'var(--muted, #888)',
            fontSize: 10, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          🔭 {mode === '1-point' ? '1-Point' : mode === '2-point' ? '2-Point' : mode === 'isometric' ? 'Isometric' : 'Cabinet'}
        </button>
      </div>

      {/* Controls panel */}
      {showControls && (
        <div style={{ pointerEvents: 'all' }}>
          <PerspectiveControls
            mode={mode} onModeChange={setMode}
            count={count} onCountChange={setCount}
            cellSize={cellSize} onCellSizeChange={setCellSize}
            color={color} onColorChange={setColor}
            opacity={opacity} onOpacityChange={setOpacity}
            horizonY={horizonY} onHorizonYChange={setHorizonYChange => setHorizonY(setHorizonYChange)}
            cabinetAngle={cabinetAngle} onCabinetAngleChange={setCabinetAngle}
            onClose={() => setShowControls(false)}
            canvasHeight={canvasHeight}
          />
        </div>
      )}
    </div>
  );
}
