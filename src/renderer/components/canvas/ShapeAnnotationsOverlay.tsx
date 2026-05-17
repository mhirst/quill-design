/**
 * ShapeAnnotationsOverlay — Design spec callout / redline annotation system.
 *
 * Renders above the canvas as an absolutely-positioned SVG + HTML overlay.
 * Designers can add numbered callout bubbles with leader lines that point to
 * any position on the canvas, annotating shapes with spec notes.
 *
 * Features:
 * - Click anywhere on canvas to drop an annotation pin
 * - Each annotation has: number badge, leader line, editable text label
 * - Pins drag-able within the overlay
 * - Numbered automatically (1, 2, 3...)
 * - Panel sidebar lists all annotations with edit/delete
 * - Export as JSON for handoff
 * - Two visual modes: Spec (red/pink) and Note (indigo)
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Annotation {
  id: string;
  /** Canvas-space position of the pin tip */
  x: number;
  y: number;
  /** The annotation text */
  text: string;
  /** Visual variant */
  mode: 'spec' | 'note';
  /** Auto-assigned sequence number */
  num: number;
}

interface Props {
  /** Whether the annotation overlay is active */
  active: boolean;
  /** Current viewport transform from CanvasOverlay */
  zoom: number;
  panX: number;
  panY: number;
  /** Canvas container dimensions */
  width: number;
  height: number;
  annotations: Annotation[];
  onAdd: (ann: Annotation) => void;
  onUpdate: (id: string, changes: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function canvasToScreen(cx: number, cy: number, zoom: number, panX: number, panY: number) {
  return { sx: cx * zoom + panX, sy: cy * zoom + panY };
}

function screenToCanvas(sx: number, sy: number, zoom: number, panX: number, panY: number) {
  return { cx: (sx - panX) / zoom, cy: (sy - panY) / zoom };
}

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Annotation Pin ────────────────────────────────────────────────────────────

const SPEC_COLOR = '#ef4444';
const NOTE_COLOR = '#6366f1';
const BUBBLE_OFFSET = { x: 60, y: -50 }; // label bubble relative to pin tip

interface PinProps {
  ann: Annotation;
  zoom: number;
  panX: number;
  panY: number;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onDragEnd: (cx: number, cy: number) => void;
  onTextChange: (text: string) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onDelete: () => void;
}

function AnnotationPin({
  ann,
  zoom,
  panX,
  panY,
  selected,
  editing,
  onSelect,
  onDragEnd,
  onTextChange,
  onEditStart,
  onEditEnd,
  onDelete,
}: PinProps) {
  const color = ann.mode === 'spec' ? SPEC_COLOR : NOTE_COLOR;
  const { sx, sy } = canvasToScreen(ann.x, ann.y, zoom, panX, panY);
  const bx = sx + BUBBLE_OFFSET.x;
  const by = sy + BUBBLE_OFFSET.y;

  const dragRef = useRef<{ startSx: number; startSy: number; startCx: number; startCy: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();

    dragRef.current = { startSx: e.clientX, startSy: e.clientY, startCx: ann.x, startCy: ann.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startSx;
      const dy = ev.clientY - dragRef.current.startSy;
      const { cx, cy } = screenToCanvas(
        dragRef.current.startSx + dx,
        dragRef.current.startSy + dy,
        zoom, panX, panY
      );
      // Just move pin tip; we'll call onDragEnd on mouseup
      const el = document.getElementById(`ann-tip-${ann.id}`);
      if (el) {
        const newSx = dragRef.current.startSx + dx;
        const newSy = dragRef.current.startSy + dy;
        el.setAttribute('cx', String(newSx));
        el.setAttribute('cy', String(newSy));
      }
    };

    const onUp = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startSx;
      const dy = ev.clientY - dragRef.current.startSy;
      const { cx, cy } = screenToCanvas(
        dragRef.current.startSx + dx,
        dragRef.current.startSy + dy,
        zoom, panX, panY
      );
      onDragEnd(cx, cy);
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [ann.x, ann.y, ann.id, zoom, panX, panY, onSelect, onDragEnd]);

  const labelW = Math.max(100, Math.min(220, ann.text.length * 7 + 24));
  const labelH = editing ? 72 : Math.max(32, Math.ceil(ann.text.length / 20) * 16 + 16);

  return (
    <g>
      {/* Leader line */}
      <line
        x1={sx} y1={sy}
        x2={bx} y2={by + labelH / 2}
        stroke={color}
        strokeWidth={selected ? 2 : 1.5}
        strokeDasharray={ann.mode === 'note' ? '5 3' : 'none'}
        opacity={0.8}
      />

      {/* Endpoint dot on shape */}
      <circle
        id={`ann-tip-${ann.id}`}
        cx={sx} cy={sy}
        r={selected ? 6 : 4}
        fill={color}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1.5}
        style={{ cursor: 'grab' }}
        onMouseDown={handleMouseDown}
      />

      {/* Number badge */}
      <circle cx={sx - 1} cy={sy - 1} r={selected ? 11 : 9} fill="rgba(0,0,0,0.5)" />
      <circle
        cx={sx} cy={sy}
        r={selected ? 10 : 8}
        fill={color}
        style={{ cursor: 'grab' }}
        onMouseDown={handleMouseDown}
      />
      <text
        x={sx} y={sy + 4}
        textAnchor="middle"
        fontSize={selected ? 10 : 9}
        fontWeight={700}
        fill="white"
        style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'system-ui' }}
      >
        {ann.num}
      </text>

      {/* Label bubble (HTML foreignObject for text editing) */}
      <foreignObject
        x={bx}
        y={by}
        width={labelW}
        height={labelH + 8}
        style={{ overflow: 'visible' }}
      >
        <div
          style={{
            width: labelW,
            minHeight: labelH,
            background: ann.mode === 'spec' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
            border: `1.5px solid ${selected ? color : color + '80'}`,
            borderRadius: 8,
            padding: '6px 10px',
            backdropFilter: 'blur(8px)',
            boxShadow: selected ? `0 0 0 2px ${color}30, 0 4px 12px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            position: 'relative',
          }}
          onClick={onSelect}
          onDoubleClick={onEditStart}
        >
          {/* Mode badge */}
          <div style={{
            position: 'absolute',
            top: -8,
            left: 8,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: color,
            background: 'rgba(10,10,20,0.9)',
            padding: '1px 5px',
            borderRadius: 3,
            textTransform: 'uppercase',
          }}>
            {ann.mode === 'spec' ? '⊟ SPEC' : '◈ NOTE'} #{ann.num}
          </div>

          {editing ? (
            <textarea
              ref={inputRef}
              value={ann.text}
              onChange={e => onTextChange(e.target.value)}
              onBlur={onEditEnd}
              onKeyDown={e => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); onEditEnd(); } }}
              style={{
                width: '100%',
                minHeight: 50,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f1f5f9',
                fontSize: 11,
                lineHeight: 1.5,
                resize: 'none',
                fontFamily: 'system-ui,-apple-system,sans-serif',
              }}
            />
          ) : (
            <div style={{
              fontSize: 11,
              color: '#e2e8f0',
              lineHeight: 1.5,
              wordBreak: 'break-word',
              minHeight: 16,
              userSelect: 'none',
            }}>
              {ann.text || <span style={{ color: '#475569', fontStyle: 'italic' }}>Double-click to add note</span>}
            </div>
          )}

          {/* Delete button (show on select) */}
          {selected && !editing && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 12,
                padding: '0 2px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      </foreignObject>
    </g>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ShapeAnnotationsOverlay({
  active,
  zoom,
  panX,
  panY,
  width,
  height,
  annotations,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<'spec' | 'note'>('spec');

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!active) return;
    // Deselect if clicking empty space
    const tag = (e.target as SVGElement).tagName;
    if (tag === 'svg' || tag === 'rect') {
      setSelectedId(null);
      setEditingId(null);

      // Add a new annotation at the click position
      if (e.detail === 1) { // single click
        const rect = e.currentTarget.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const { cx, cy } = screenToCanvas(sx, sy, zoom, panX, panY);

        const maxNum = annotations.reduce((m, a) => Math.max(m, a.num), 0);
        const newAnn: Annotation = {
          id: genId(),
          x: cx,
          y: cy,
          text: '',
          mode: addMode,
          num: maxNum + 1,
        };
        onAdd(newAnn);
        setSelectedId(newAnn.id);
        setTimeout(() => setEditingId(newAnn.id), 50);
      }
    }
  }, [active, addMode, zoom, panX, panY, annotations, onAdd]);

  if (!active && annotations.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width,
        height,
        pointerEvents: active ? 'all' : 'none',
        cursor: active ? 'crosshair' : 'default',
        zIndex: 25,
        overflow: 'visible',
      }}
      onClick={handleSvgClick}
    >
      {/* Translucent overlay when in add mode */}
      {active && (
        <rect
          x={0} y={0}
          width={width} height={height}
          fill="rgba(99,102,241,0.02)"
          stroke="rgba(99,102,241,0.15)"
          strokeWidth={1}
          strokeDasharray="6 4"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Annotations */}
      {annotations.map(ann => (
        <AnnotationPin
          key={ann.id}
          ann={ann}
          zoom={zoom}
          panX={panX}
          panY={panY}
          selected={selectedId === ann.id}
          editing={editingId === ann.id}
          onSelect={() => { setSelectedId(ann.id); setEditingId(null); }}
          onDragEnd={(cx, cy) => onUpdate(ann.id, { x: cx, y: cy })}
          onTextChange={(text) => onUpdate(ann.id, { text })}
          onEditStart={() => setEditingId(ann.id)}
          onEditEnd={() => setEditingId(null)}
          onDelete={() => { onDelete(ann.id); setSelectedId(null); setEditingId(null); }}
        />
      ))}

      {/* Mode indicator when active */}
      {active && (
        <foreignObject x={8} y={8} width={280} height={36}>
          <div style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}>
            <div style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(10,10,20,0.85)',
              border: '1px solid rgba(99,102,241,0.3)',
              fontSize: 10,
              color: '#94a3b8',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ color: '#6366f1' }}>✦ Annotation mode</span>
              <span style={{ color: '#334155' }}>Click canvas to add</span>
            </div>
            {(['spec', 'note'] as const).map(m => (
              <button
                key={m}
                onClick={(e) => { e.stopPropagation(); setAddMode(m); }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 5,
                  border: `1px solid ${addMode === m ? (m === 'spec' ? '#ef4444' : '#6366f1') : 'rgba(255,255,255,0.08)'}`,
                  background: addMode === m
                    ? (m === 'spec' ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)')
                    : 'rgba(10,10,20,0.8)',
                  color: addMode === m ? (m === 'spec' ? '#fca5a5' : '#c7d2fe') : '#64748b',
                  cursor: 'pointer',
                  fontSize: 10,
                  backdropFilter: 'blur(8px)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                }}
              >
                {m === 'spec' ? '⊟' : '◈'} {m}
              </button>
            ))}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

// ── Annotations List Panel ────────────────────────────────────────────────────

interface ListPanelProps {
  annotations: Annotation[];
  active: boolean;
  onToggleActive: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, changes: Partial<Annotation>) => void;
  onClear: () => void;
  onExport: () => void;
}

export function AnnotationsListPanel({
  annotations,
  active,
  onToggleActive,
  onDelete,
  onUpdate,
  onClear,
  onExport,
}: ListPanelProps) {
  const [open, setOpen] = useState(false);

  if (annotations.length === 0 && !active) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 100,
        right: 12,
        zIndex: 30,
        width: open ? 260 : 'auto',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Annotations panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 8,
          border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
          background: active ? 'rgba(99,102,241,0.15)' : 'rgba(10,10,20,0.85)',
          color: active ? '#c7d2fe' : '#94a3b8',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          width: '100%',
          justifyContent: open ? 'space-between' : 'center',
        }}
      >
        <span>◈ Annotations{annotations.length > 0 ? ` (${annotations.length})` : ''}</span>
        {open && <span style={{ opacity: 0.5, fontSize: 10 }}>▾</span>}
      </button>

      {/* Expanded panel */}
      {open && (
        <div style={{
          marginTop: 4,
          background: 'rgba(10,10,20,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: 12,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button
              onClick={onToggleActive}
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: 10,
                borderRadius: 5,
                border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                background: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                color: active ? '#c7d2fe' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {active ? '⏸ Stop Adding' : '+ Add Annotation'}
            </button>
            {annotations.length > 0 && (
              <>
                <button
                  onClick={onExport}
                  style={{
                    padding: '5px 8px',
                    fontSize: 10,
                    borderRadius: 5,
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                  title="Export annotations as JSON"
                >
                  ↓ JSON
                </button>
                <button
                  onClick={onClear}
                  style={{
                    padding: '5px 8px',
                    fontSize: 10,
                    borderRadius: 5,
                    border: '1px solid rgba(239,68,68,0.2)',
                    background: 'rgba(239,68,68,0.06)',
                    color: '#f87171',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </>
            )}
          </div>

          {/* List */}
          {annotations.length === 0 ? (
            <div style={{ fontSize: 10, color: '#334155', textAlign: 'center', padding: '12px 0' }}>
              Click the canvas to drop annotation pins
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
              {annotations.map(ann => (
                <div
                  key={ann.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Number badge */}
                  <div style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: ann.mode === 'spec' ? SPEC_COLOR : NOTE_COLOR,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'white',
                  }}>
                    {ann.num}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                      {ann.mode === 'spec' ? '⊟ Spec' : '◈ Note'} · {Math.round(ann.x)},{Math.round(ann.y)}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      wordBreak: 'break-word',
                      fontStyle: ann.text ? 'normal' : 'italic',
                    }}>
                      {ann.text || 'Empty annotation'}
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => onDelete(ann.id)}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      color: '#475569',
                      cursor: 'pointer',
                      fontSize: 13,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
