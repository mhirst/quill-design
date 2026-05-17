/**
 * AnnotationOverlayPanel — Freehand annotation overlay for design review
 *
 * Features:
 *  - Draws directly on top of the canvas (pointer-events overlay)
 *  - 4 tools: pen (freehand), arrow, highlight, text callout
 *  - Color picker (6 preset colors) + stroke width control
 *  - Undo / clear all
 *  - Opacity control for highlight tool
 *  - Export all annotations as SVG string
 *  - Fade-out mode: annotations auto-fade after N seconds
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnnotationTool = 'pen' | 'arrow' | 'highlight' | 'text';

export interface AnnotationStroke {
  id: string;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  opacity: number;
  points?: Array<{ x: number; y: number }>;  // for pen / highlight
  from?: { x: number; y: number };           // for arrow
  to?: { x: number; y: number };             // for arrow
  text?: string;                             // for text callout
  textX?: number;
  textY?: number;
  createdAt: number;
}

// ── Utility exports (tested separately) ──────────────────────────────────────

/** Simplify a polyline using Ramer-Douglas-Peucker */
export function rdpSimplify(points: Array<{ x: number; y: number }>, epsilon: number): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;
  // Find max distance
  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    let dist: number;
    if (len === 0) {
      dist = Math.sqrt((p.x - start.x) ** 2 + (p.y - start.y) ** 2);
    } else {
      dist = Math.abs((p.x - start.x) * dy - (p.y - start.y) * dx) / len;
    }
    if (dist > maxDist) { maxDist = dist; maxIdx = i; }
  }
  if (maxDist <= epsilon) return [start, end];
  const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
  const right = rdpSimplify(points.slice(maxIdx), epsilon);
  return [...left.slice(0, -1), ...right];
}

/** Convert a points array to an SVG path d string */
export function pointsToSVGPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const parts = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`);
  }
  return parts.join(' ');
}

/** Export all strokes as an SVG fragment */
export function exportAnnotationsSVG(
  strokes: AnnotationStroke[],
  width: number,
  height: number,
): string {
  const inner = strokes.map(s => {
    if (s.tool === 'pen' && s.points && s.points.length > 1) {
      const d = pointsToSVGPath(s.points);
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.opacity}"/>`;
    }
    if (s.tool === 'highlight' && s.points && s.points.length > 1) {
      const d = pointsToSVGPath(s.points);
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.strokeWidth * 4}" stroke-linecap="round" opacity="${s.opacity * 0.4}"/>`;
    }
    if (s.tool === 'arrow' && s.from && s.to) {
      const dx = s.to.x - s.from.x;
      const dy = s.to.y - s.from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 2) return '';
      const ux = dx / len;
      const uy = dy / len;
      const arrowSize = Math.max(s.strokeWidth * 3, 10);
      const ax = s.to.x - ux * arrowSize;
      const ay = s.to.y - uy * arrowSize;
      const lx = ax + uy * arrowSize * 0.5;
      const ly = ay - ux * arrowSize * 0.5;
      const rx = ax - uy * arrowSize * 0.5;
      const ry = ay + ux * arrowSize * 0.5;
      return [
        `<line x1="${s.from.x.toFixed(1)}" y1="${s.from.y.toFixed(1)}" x2="${s.to.x.toFixed(1)}" y2="${s.to.y.toFixed(1)}" stroke="${s.color}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}"/>`,
        `<polygon points="${s.to.x.toFixed(1)},${s.to.y.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${rx.toFixed(1)},${ry.toFixed(1)}" fill="${s.color}" opacity="${s.opacity}"/>`,
      ].join('\n');
    }
    if (s.tool === 'text' && s.text && s.textX != null && s.textY != null) {
      return `<text x="${s.textX.toFixed(1)}" y="${s.textY.toFixed(1)}" fill="${s.color}" font-size="14" font-family="system-ui" opacity="${s.opacity}">${s.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
    }
    return '';
  }).filter(Boolean).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="position:absolute;top:0;left:0;pointer-events:none">\n${inner}\n</svg>`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'];

// ── Toolbar ───────────────────────────────────────────────────────────────────

interface ToolbarProps {
  tool: AnnotationTool;
  setTool: (t: AnnotationTool) => void;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onClose: () => void;
  strokeCount: number;
  onExport: () => void;
}

function AnnotationToolbar({
  tool, setTool, color, setColor, strokeWidth, setStrokeWidth,
  opacity, setOpacity, onUndo, onClear, onClose, strokeCount, onExport,
}: ToolbarProps) {
  const TOOLBAR: React.CSSProperties = {
    position: 'fixed',
    top: 60,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#1a0a0a',
    border: '1px solid #3a1a1a',
    borderRadius: 40,
    padding: '6px 14px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
    zIndex: 800,
    fontFamily: 'system-ui, sans-serif',
    userSelect: 'none',
  };

  const toolBtn = (t: AnnotationTool, icon: string, label: string) => (
    <button
      title={label}
      onClick={() => setTool(t)}
      style={{
        background: tool === t ? '#b5533c' : 'none',
        border: 'none',
        borderRadius: 20,
        color: '#e8d5d5',
        fontSize: 16,
        cursor: 'pointer',
        padding: '4px 8px',
        transition: 'background 0.15s',
      }}
    >
      {icon}
    </button>
  );

  return (
    <div style={TOOLBAR}>
      {toolBtn('pen', '✏️', 'Pen')}
      {toolBtn('arrow', '➡️', 'Arrow')}
      {toolBtn('highlight', '🖌️', 'Highlight')}
      {toolBtn('text', 'T', 'Text')}

      <div style={{ width: 1, height: 20, background: '#3a1a1a' }} />

      {/* Colors */}
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          onClick={() => setColor(c)}
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: c,
            border: color === c ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
            padding: 0,
          }}
        />
      ))}

      <div style={{ width: 1, height: 20, background: '#3a1a1a' }} />

      {/* Stroke width */}
      <input
        type="range"
        min={1}
        max={12}
        value={strokeWidth}
        onChange={e => setStrokeWidth(Number(e.target.value))}
        style={{ width: 60 }}
        title="Stroke width"
      />

      {/* Opacity (only for highlight) */}
      {tool === 'highlight' && (
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={e => setOpacity(Number(e.target.value))}
          style={{ width: 50 }}
          title="Opacity"
        />
      )}

      <div style={{ width: 1, height: 20, background: '#3a1a1a' }} />

      <button
        onClick={onUndo}
        disabled={strokeCount === 0}
        style={{ background: 'none', border: 'none', color: strokeCount === 0 ? '#5a3a3a' : '#e8d5d5', cursor: strokeCount === 0 ? 'default' : 'pointer', fontSize: 14 }}
        title="Undo"
      >
        ↩
      </button>
      <button
        onClick={onClear}
        disabled={strokeCount === 0}
        style={{ background: 'none', border: 'none', color: strokeCount === 0 ? '#5a3a3a' : '#ef4444', cursor: strokeCount === 0 ? 'default' : 'pointer', fontSize: 12 }}
        title="Clear all"
      >
        ✕ Clear
      </button>
      <button
        onClick={onExport}
        style={{ background: 'none', border: 'none', color: '#a08080', cursor: 'pointer', fontSize: 12 }}
        title="Export SVG"
      >
        ↓SVG
      </button>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: '#a08080', cursor: 'pointer', fontSize: 14 }}
        title="Close"
      >
        ✕
      </button>
    </div>
  );
}

// ── SVG Render of strokes ─────────────────────────────────────────────────────

function StrokesLayer({ strokes }: { strokes: AnnotationStroke[] }) {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
      width="100%"
      height="100%"
    >
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 Z" fill="currentColor" />
        </marker>
      </defs>
      {strokes.map(s => {
        if (s.tool === 'pen' && s.points && s.points.length > 1) {
          return (
            <path
              key={s.id}
              d={pointsToSVGPath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={s.opacity}
            />
          );
        }
        if (s.tool === 'highlight' && s.points && s.points.length > 1) {
          return (
            <path
              key={s.id}
              d={pointsToSVGPath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.strokeWidth * 4}
              strokeLinecap="round"
              opacity={s.opacity * 0.4}
            />
          );
        }
        if (s.tool === 'arrow' && s.from && s.to) {
          const dx = s.to.x - s.from.x;
          const dy = s.to.y - s.from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 2) return null;
          const ux = dx / len;
          const uy = dy / len;
          const arrowSize = Math.max(s.strokeWidth * 3, 10);
          const ax = s.to.x - ux * arrowSize;
          const ay = s.to.y - uy * arrowSize;
          const lx = ax + uy * arrowSize * 0.5;
          const ly = ay - ux * arrowSize * 0.5;
          const rx = ax - uy * arrowSize * 0.5;
          const ry = ay + ux * arrowSize * 0.5;
          return (
            <g key={s.id} opacity={s.opacity}>
              <line
                x1={s.from.x}
                y1={s.from.y}
                x2={ax}
                y2={ay}
                stroke={s.color}
                strokeWidth={s.strokeWidth}
              />
              <polygon
                points={`${s.to.x},${s.to.y} ${lx},${ly} ${rx},${ry}`}
                fill={s.color}
              />
            </g>
          );
        }
        if (s.tool === 'text' && s.text && s.textX != null && s.textY != null) {
          return (
            <g key={s.id} opacity={s.opacity}>
              <rect
                x={s.textX - 4}
                y={s.textY - 14}
                width={s.text.length * 8 + 8}
                height={20}
                rx={4}
                fill={s.color}
                opacity={0.9}
              />
              <text
                x={s.textX}
                y={s.textY}
                fill={s.color === '#ffffff' ? '#000000' : '#ffffff'}
                fontSize={13}
                fontFamily="system-ui, sans-serif"
              >
                {s.text}
              </text>
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  canvasWidth: number;
  canvasHeight: number;
}

let _strokeCounter = 0;
function makeId() { return `ann-${++_strokeCounter}-${Date.now()}`; }

export function AnnotationOverlayPanel({ open, onClose, canvasWidth, canvasHeight }: Props) {
  const [tool, setTool] = useState<AnnotationTool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<AnnotationStroke | null>(null);
  const [pendingText, setPendingText] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getPos = (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const pos = getPos(e);

    if (tool === 'text') {
      setTextPos(pos);
      setPendingText('');
      return;
    }

    const stroke: AnnotationStroke = {
      id: makeId(),
      tool,
      color,
      strokeWidth,
      opacity,
      createdAt: Date.now(),
      ...(tool === 'pen' || tool === 'highlight' ? { points: [pos] } : {}),
      ...(tool === 'arrow' ? { from: pos, to: pos } : {}),
    };
    setCurrentStroke(stroke);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!currentStroke) return;
    const pos = getPos(e);
    if (currentStroke.tool === 'pen' || currentStroke.tool === 'highlight') {
      setCurrentStroke(prev => prev ? { ...prev, points: [...(prev.points ?? []), pos] } : null);
    } else if (currentStroke.tool === 'arrow') {
      setCurrentStroke(prev => prev ? { ...prev, to: pos } : null);
    }
  };

  const handleMouseUp = () => {
    if (!currentStroke) return;
    // Simplify pen strokes
    if ((currentStroke.tool === 'pen' || currentStroke.tool === 'highlight') && currentStroke.points) {
      const simplified = rdpSimplify(currentStroke.points, 2);
      setStrokes(prev => [...prev, { ...currentStroke, points: simplified }]);
    } else {
      setStrokes(prev => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
  };

  const commitText = useCallback(() => {
    if (!textPos || !pendingText.trim()) { setTextPos(null); return; }
    setStrokes(prev => [...prev, {
      id: makeId(),
      tool: 'text',
      color,
      strokeWidth,
      opacity,
      text: pendingText.trim(),
      textX: textPos.x,
      textY: textPos.y,
      createdAt: Date.now(),
    }]);
    setTextPos(null);
    setPendingText('');
  }, [textPos, pendingText, color, strokeWidth, opacity]);

  const handleUndo = () => setStrokes(prev => prev.slice(0, -1));
  const handleClear = () => { setStrokes([]); setCurrentStroke(null); };

  const handleExport = () => {
    const svg = exportAnnotationsSVG(strokes, canvasWidth, canvasHeight);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!open) {
      setCurrentStroke(null);
      setTextPos(null);
    }
  }, [open]);

  if (!open) return null;

  const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

  const getCursor = () => {
    if (tool === 'text') return 'text';
    if (tool === 'arrow') return 'crosshair';
    return 'crosshair';
  };

  return (
    <>
      <AnnotationToolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        opacity={opacity}
        setOpacity={setOpacity}
        onUndo={handleUndo}
        onClear={handleClear}
        onClose={onClose}
        strokeCount={strokes.length}
        onExport={handleExport}
      />

      {/* Full-screen drawing overlay */}
      <svg
        ref={svgRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 700,
          cursor: getCursor(),
          // Only intercept if not text mode waiting for input
          pointerEvents: textPos ? 'none' : 'all',
        }}
        onMouseDown={tool !== 'text' || !textPos ? handleMouseDown : undefined}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <StrokesLayer strokes={allStrokes} />
      </svg>

      {/* Text input popup */}
      {textPos && (
        <div style={{
          position: 'fixed',
          left: textPos.x,
          top: textPos.y - 30,
          zIndex: 800,
          display: 'flex',
          gap: 4,
          alignItems: 'center',
        }}>
          <input
            autoFocus
            value={pendingText}
            onChange={e => setPendingText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitText();
              if (e.key === 'Escape') { setTextPos(null); setPendingText(''); }
            }}
            placeholder="Type annotation…"
            style={{
              background: '#1a0a0a',
              border: `1px solid ${color}`,
              borderRadius: 6,
              color: '#e8d5d5',
              padding: '4px 8px',
              fontSize: 13,
              outline: 'none',
              minWidth: 160,
            }}
          />
          <button
            onClick={commitText}
            style={{
              background: color,
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Add
          </button>
        </div>
      )}
    </>
  );
}
