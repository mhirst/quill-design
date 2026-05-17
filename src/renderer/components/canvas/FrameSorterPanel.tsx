/**
 * FrameSorterPanel — Slide sorter for frames.
 *
 * Shows all frames on the canvas as a horizontal strip of mini-thumbnails.
 * Drag-and-drop to reorder them. Click to navigate to a frame.
 * Shortcut: ⌘⇧[ (toggled from App.tsx)
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, GripVertical } from 'lucide-react';
import type { Shape } from '../../lib/shapes';
import { shapesToCanvas } from '../../lib/shapes';

interface Props {
  shapes: Shape[];
  onClose: () => void;
  onReorder: (newOrder: Shape[]) => void;
  onFocusFrame: (frameId: string) => void;
  selectedId?: string | null;
}

// Render a mini canvas thumbnail of a frame and its children
function FrameThumbnail({ frame, allShapes }: { frame: Shape; allShapes: Shape[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 80, H = 60;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Compute scale to fit frame into thumbnail
    const scaleX = W / (frame.width || 1);
    const scaleY = H / (frame.height || 1);
    const scale = Math.min(scaleX, scaleY) * 0.9;

    // Collect frame + children
    const children = allShapes.filter(s => s.parentId === frame.id);
    const framesToDraw = [frame, ...children];

    // Draw shapes
    const offX = (W - frame.width * scale) / 2 - frame.x * scale;
    const offY = (H - frame.height * scale) / 2 - frame.y * scale;

    for (const s of framesToDraw) {
      if (s.hidden) continue;
      ctx.save();
      ctx.globalAlpha = s.opacity ?? 1;

      const sx = s.x * scale + offX;
      const sy = s.y * scale + offY;
      const sw = s.width * scale;
      const sh = s.height * scale;

      const fill = s.fill ?? '#444';
      if (fill && fill !== 'transparent') {
        if (fill.startsWith('linear-gradient') || fill.startsWith('radial-gradient')) {
          const match = fill.match(/#[0-9a-fA-F]{3,8}/);
          ctx.fillStyle = match ? match[0] : '#6366f1';
        } else {
          ctx.fillStyle = fill;
        }
        if (s.type === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(sx, sy, sw, sh);
        }
      }

      if (s.type === 'text' && s.text) {
        ctx.fillStyle = s.color || '#fff';
        ctx.font = `${Math.max(4, (s.fontSize || 14) * scale)}px sans-serif`;
        ctx.fillText(s.text.slice(0, 20), sx + 2, sy + Math.max(6, (s.fontSize || 14) * scale));
      }

      ctx.restore();
    }
  }, [frame, allShapes]);

  return <canvas ref={canvasRef} style={{ width: 80, height: 60, display: 'block' }} />;
}

export function FrameSorterPanel({ shapes, onClose, onReorder, onFocusFrame, selectedId }: Props) {
  const frames = shapes.filter(s => s.type === 'frame');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const nonFrames = shapes.filter(s => s.type !== 'frame');

  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const reordered = [...frames];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    onReorder([...nonFrames, ...reordered]);
    setDragIdx(null);
    setDropIdx(null);
  }, [dragIdx, frames, nonFrames, onReorder]);

  if (frames.length === 0) {
    return (
      <div style={{
        position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px 24px', zIndex: 9000,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        color: 'var(--muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span>No frames on canvas — draw a frame (F) first</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
        background: 'var(--panel)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
      }}
      onMouseLeave={() => setDropIdx(null)}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            Frame Sorter
          </span>
          <span style={{
            fontSize: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)',
            borderRadius: 4, padding: '1px 6px', fontWeight: 600,
          }}>
            {frames.length} frame{frames.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
            Drag to reorder · Click to navigate
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
            display: 'flex', alignItems: 'center', borderRadius: 4, padding: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
          title="Close frame sorter (⌘⇧[)"
        >
          <X size={14} />
        </button>
      </div>

      {/* Frame strip */}
      <div style={{
        display: 'flex', gap: 0, overflowX: 'auto', padding: '12px 16px',
        alignItems: 'flex-start',
      }}>
        {frames.map((frame, idx) => {
          const isSelected = frame.id === selectedId;
          const isDragging = dragIdx === idx;
          const isDropTarget = dropIdx === idx;

          return (
            <div
              key={frame.id}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '4px',
                marginRight: 4,
                borderRadius: 8,
                border: `2px solid ${isSelected ? 'var(--accent)' : isDropTarget ? 'rgba(99,102,241,0.5)' : 'transparent'}`,
                background: isSelected ? 'rgba(99,102,241,0.08)' : isDragging ? 'rgba(255,255,255,0.05)' : 'transparent',
                opacity: isDragging ? 0.4 : 1,
                cursor: 'grab',
                flexShrink: 0,
                transition: 'border-color 0.1s, background 0.1s',
                userSelect: 'none',
              }}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
              onDragOver={e => { e.preventDefault(); setDropIdx(idx); }}
              onDrop={e => { e.preventDefault(); handleDrop(idx); }}
              onClick={() => onFocusFrame(frame.id)}
              onMouseEnter={e => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Slide number */}
              <div style={{ fontSize: 9, color: 'var(--muted)', alignSelf: 'flex-start', paddingLeft: 2 }}>
                {idx + 1}
              </div>

              {/* Thumbnail */}
              <div style={{
                width: 80, height: 60, borderRadius: 4, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                background: '#0f0f1a',
              }}>
                <FrameThumbnail frame={frame} allShapes={shapes} />
              </div>

              {/* Frame name */}
              <div style={{
                fontSize: 9, color: isSelected ? 'var(--accent)' : 'var(--muted)',
                maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textAlign: 'center',
              }}>
                {frame.name}
              </div>

              {/* Dimensions */}
              <div style={{ fontSize: 8, color: 'var(--muted)', opacity: 0.6 }}>
                {Math.round(frame.width)}×{Math.round(frame.height)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
