import { ChevronRight, ChevronDown, Eye, EyeOff, Lock, Unlock, Focus, Frame, Square, Circle, Type, Pencil, Group } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LayerNode } from '../../hooks/useCanvas';
import type { Shape } from '../../lib/shapes';

// ── Mini shape preview rendered onto a small canvas ─────────────────────────
function renderShapePreview(canvas: HTMLCanvasElement, shape: Shape, allShapes: Shape[]) {
  const SIZE = 80;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, SIZE, SIZE);

  // Compute bounding box of shape + children
  const getShapesForBounds = (s: Shape): Shape[] => {
    const out: Shape[] = [s];
    if (s.isGroup && s.children) {
      s.children.forEach(cid => {
        const child = allShapes.find(x => x.id === cid);
        if (child) out.push(...getShapesForBounds(child));
      });
    }
    return out;
  };

  const shapes = getShapesForBounds(shape);
  const minX = Math.min(...shapes.map(s => s.x));
  const minY = Math.min(...shapes.map(s => s.y));
  const maxX = Math.max(...shapes.map(s => s.x + s.width));
  const maxY = Math.max(...shapes.map(s => s.y + s.height));
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;

  const PAD = 8;
  const scale = Math.min((SIZE - PAD * 2) / bw, (SIZE - PAD * 2) / bh);
  const ox = PAD + ((SIZE - PAD * 2) - bw * scale) / 2 - minX * scale;
  const oy = PAD + ((SIZE - PAD * 2) - bh * scale) / 2 - minY * scale;

  // Draw each shape
  const drawOne = (s: Shape) => {
    if (s.hidden) return;
    ctx.save();
    ctx.globalAlpha = s.opacity != null ? s.opacity : 1;

    const sx = s.x * scale + ox;
    const sy = s.y * scale + oy;
    const sw = s.width * scale;
    const sh = s.height * scale;

    if (s.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
    } else if (s.type === 'path' && s.points && s.points.length > 1) {
      ctx.beginPath();
      const pts = s.points;
      ctx.moveTo(pts[0].x * sw + sx, pts[0].y * sh + sy);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]; const prev = pts[i - 1];
        if (p.cp2x != null && prev.cp1x != null) {
          ctx.bezierCurveTo(
            prev.cp1x * sw + sx, prev.cp1y! * sh + sy,
            p.cp2x * sw + sx, p.cp2y! * sh + sy,
            p.x * sw + sx, p.y * sh + sy
          );
        } else {
          ctx.lineTo(p.x * sw + sx, p.y * sh + sy);
        }
      }
      ctx.closePath();
    } else if (s.type === 'text') {
      // Simple text preview: draw label box
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(8, sh * 0.7)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = (s as any).content || s.name;
      ctx.fillText(label.length > 8 ? label.slice(0, 8) + '…' : label, sx + sw / 2, sy + sh / 2);
      ctx.restore();
      return;
    } else {
      // rectangle / frame
      const r = Math.min((s as any).cornerRadius ?? 0, sw / 2, sh / 2) * scale;
      if (r > 0) {
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, r);
      } else {
        ctx.beginPath();
        ctx.rect(sx, sy, sw, sh);
      }
    }

    // Fill
    const fill = s.fill ?? '#888';
    if (fill && fill !== 'transparent') {
      if (fill.startsWith('linear-gradient') || fill.startsWith('radial-gradient')) {
        // Approximate gradient with first stop color
        const match = fill.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
        ctx.fillStyle = match ? match[0] : '#888';
      } else {
        ctx.fillStyle = fill;
      }
      ctx.fill();
    }

    // Stroke
    if (s.stroke && s.stroke !== 'transparent' && s.strokeWidth) {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = Math.max(0.5, s.strokeWidth * scale);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Group: draw children
  if (shape.isGroup && shape.children) {
    shape.children.forEach(cid => {
      const child = allShapes.find(x => x.id === cid);
      if (child) drawOne(child);
    });
  } else {
    drawOne(shape);
  }
}

// ── Tooltip preview card ─────────────────────────────────────────────────────
interface PreviewTooltipProps {
  shape: Shape;
  allShapes: Shape[];
  anchorRect: DOMRect;
}

function ShapePreviewTooltip({ shape, allShapes, anchorRect }: PreviewTooltipProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderShapePreview(canvasRef.current, shape, allShapes);
    }
  }, [shape, allShapes]);

  // Position to the right of the layers panel
  const top = Math.min(anchorRect.top - 4, window.innerHeight - 140);

  return (
    <div
      style={{
        position: 'fixed',
        left: anchorRect.right + 8,
        top,
        zIndex: 99999,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        pointerEvents: 'none',
        width: 120,
      }}
    >
      <div style={{
        width: 80, height: 80, margin: '0 auto',
        background: 'repeating-conic-gradient(#ffffff08 0% 25%, transparent 0% 50%) 0 0 / 8px 8px',
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <canvas ref={canvasRef} style={{ maxWidth: 80, maxHeight: 80 }} />
      </div>
      <div style={{ marginTop: 6, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shape.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
          {Math.round(shape.width)} × {Math.round(shape.height)}
        </div>
        {shape.type === 'path' && shape.points && (
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{shape.points.length} pts</div>
        )}
        {shape.isGroup && shape.children && (
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{shape.children.length} layers</div>
        )}
      </div>
    </div>
  );
}

interface NodeProps {
  node: LayerNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function getLabel(node: LayerNode): string {
  const id = node.id ? `#${node.id}` : '';
  const classes = node.className
    ? '.' + node.className.split(/\s+/).slice(0, 2).join('.')
    : '';
  return `${node.tag}${id}${classes}`;
}

function LayerNodeRow({ node, depth, selectedPath, onSelect }: NodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 cursor-pointer select-none rounded"
        style={{
          paddingLeft: 8 + depth * 14,
          paddingTop: 5,
          paddingBottom: 5,
          paddingRight: 8,
          background: isSelected ? 'var(--accent-dim)' : 'transparent',
          color: isSelected ? 'var(--accent)' : 'var(--text)',
          border: isSelected ? '1px solid color-mix(in srgb, var(--accent) 19%, transparent)' : '1px solid transparent',
        }}
        onClick={() => onSelect(node.path)}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'var(--panel-alt)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent';
        }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            style={{ color: 'var(--muted)', flexShrink: 0 }}
            className="hover:text-white transition-colors"
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {getLabel(node)}
        </span>
      </div>

      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <LayerNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Shape type icons
function ShapeTypeIcon({ shape, size = 12 }: { shape: Shape; size?: number }) {
  if (shape.isGroup) return <Group size={size} />;
  switch (shape.type) {
    case 'frame': return <Frame size={size} />;
    case 'rectangle': return <Square size={size} />;
    case 'ellipse': return <Circle size={size} />;
    case 'text': return <Type size={size} />;
    case 'path': return <Pencil size={size} />;
    default: return <Square size={size} />;
  }
}

interface Props {
  layerTree: LayerNode | null;
  selection?: unknown; // kept for API compatibility but not used here
  onSelectPath: (path: string) => void;
  // Drawing shapes (takes priority when present)
  shapes?: Shape[];
  selectedShapeId?: string | null;
  selectedShapeIds?: string[];
  onSelectShape?: (id: string | null) => void;
  onReorderShapes?: (newOrder: Shape[]) => void;
  onRenameShape?: (id: string, name: string) => void;
  onToggleHidden?: (id: string) => void;
  onToggleLocked?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  filterQuery?: string;
}

export function LayerTree({ layerTree, onSelectPath, shapes, selectedShapeId, selectedShapeIds, onSelectShape, onReorderShapes, onRenameShape, onToggleHidden, onToggleLocked, onDuplicate, onDelete, filterQuery }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Hover preview ──────────────────────────────────────────────────────────
  const [previewShape, setPreviewShape] = useState<{ shape: Shape; rect: DOMRect } | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowMouseEnter = (shape: Shape, e: React.MouseEvent<HTMLDivElement>) => {
    setHoveredId(shape.id);
    if (!shape.hidden) e.currentTarget.style.background = '#ffffff08';
    const rect = e.currentTarget.getBoundingClientRect();
    previewTimer.current = setTimeout(() => {
      setPreviewShape({ shape, rect });
    }, 400);
  };

  const handleRowMouseLeave = (isSelected: boolean, isDragOver: boolean, e: React.MouseEvent<HTMLDivElement>) => {
    setHoveredId(null);
    if (!isSelected && !isDragOver) e.currentTarget.style.background = 'transparent';
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreviewShape(null);
  };

  // ── Context menu ───────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; shapeId: string } | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('mousedown', close, { capture: true });
    document.addEventListener('keydown', close, { capture: true });
    return () => {
      document.removeEventListener('mousedown', close, { capture: true });
      document.removeEventListener('keydown', close, { capture: true });
    };
  }, [!!ctxMenu]);

  const startRename = (shape: Shape) => {
    setRenamingId(shape.id);
    setRenameVal(shape.name);
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select(); }, 0);
  };

  const commitRename = () => {
    if (renamingId && renameVal.trim()) {
      onRenameShape?.(renamingId, renameVal.trim());
    }
    setRenamingId(null);
  };

  // ── Drawing shapes mode ────────────────────────────────────────────────────
  if (shapes && shapes.length > 0) {
    // Show shapes in reverse order (top of stack = top of list, like Figma)
    // Skip children of groups — they're shown under the group
    const reversed = [...shapes].reverse();

    // Filter: when query active, flatten + match by name, type, or id
    const q = filterQuery?.trim().toLowerCase() ?? '';
    const matchesQuery = (s: Shape) => !q
      || s.name.toLowerCase().includes(q)
      || s.type.toLowerCase().includes(q)
      || s.id.toLowerCase().includes(q);

    // When filtering, show flat list of all matches (ignore hierarchy)
    const isFiltering = q.length > 0;

    const renderShape = (shape: Shape, depth: number) => {
      const isSelected = shape.id === selectedShapeId || (selectedShapeIds?.includes(shape.id) ?? false);
      const isDragOver = shape.id === dragOverId;
      const isDragSource = shape.id === dragSourceId;
      const isRenaming = renamingId === shape.id;
      const children = shape.isGroup
        ? shape.children.map(id => shapes.find(s => s.id === id)).filter(Boolean) as Shape[]
        : [];
      return (
        <div key={shape.id}>
          <div
            onClick={() => { if (!isRenaming) onSelectShape?.(shape.id); }}
            onDoubleClick={(e) => { e.stopPropagation(); startRename(shape); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, shapeId: shape.id }); }}
            draggable={!isRenaming}
            onDragStart={() => setDragSourceId(shape.id)}
            onDragEnd={() => { setDragSourceId(null); setDragOverId(null); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(shape.id); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverId(null);
              if (!dragSourceId || !onReorderShapes || dragSourceId === shape.id) return;
              // Layers shown in reversed order — reorder in the actual shapes array
              const topLevel = shapes!.filter(s => !s.parentId);
              const src = topLevel.find(s => s.id === dragSourceId);
              const dst = topLevel.find(s => s.id === shape.id);
              if (!src || !dst) return;
              const srcIdx = topLevel.indexOf(src);
              const dstIdx = topLevel.indexOf(dst);
              const reordered = [...topLevel];
              reordered.splice(srcIdx, 1);
              reordered.splice(dstIdx, 0, src);
              // Children of groups are still in shapes but maintain their parentId linkage
              const nonTopLevel = shapes!.filter(s => s.parentId);
              onReorderShapes([...reordered, ...nonTopLevel]);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              paddingLeft: 10 + depth * 14,
              paddingRight: 10,
              paddingTop: 5,
              paddingBottom: 5,
              cursor: 'pointer',
              userSelect: 'none',
              background: isSelected ? 'var(--accent-dim)' : isDragOver ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: isSelected ? 'var(--accent)' : 'var(--text)',
              borderTop: isDragOver ? '2px solid var(--accent)' : '2px solid transparent',
              borderBottom: '1px solid transparent',
              fontSize: 12,
              opacity: isDragSource ? 0.4 : shape.hidden ? 0.45 : 1,
              transition: 'opacity 0.1s',
            }}
            onMouseEnter={(e) => handleRowMouseEnter(shape, e)}
            onMouseLeave={(e) => handleRowMouseLeave(isSelected, isDragOver, e)}
          >
            <span style={{ color: isSelected ? 'var(--accent)' : 'var(--muted)', flexShrink: 0, display: 'flex' }}>
              <ShapeTypeIcon shape={shape} size={12} />
            </span>
            {/* Fill color swatch */}
            {shape.type !== 'text' && shape.type !== 'path' && shape.fill && shape.fill !== 'transparent' && (
              <span style={{
                width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                background: shape.fill,
                border: '1px solid rgba(255,255,255,0.12)',
              }} />
            )}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { commitRename(); e.preventDefault(); }
                  if (e.key === 'Escape') { setRenamingId(null); e.preventDefault(); }
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.5)',
                  borderRadius: 3, color: 'var(--accent)', fontSize: 12,
                  padding: '1px 4px', outline: 'none', minWidth: 0,
                }}
              />
            ) : (
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {shape.name}
              </span>
            )}
            {!isRenaming && (
              <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, minWidth: 44, textAlign: 'right' }}>
                {Math.round(shape.width)}×{Math.round(shape.height)}
              </span>
            )}
            {/* Layer action buttons — appear on hover or when active */}
            {!isRenaming && (onToggleLocked || onToggleHidden) && hoveredId === shape.id && (
              <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                {/* Zoom to shape */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('quill:zoom-to-shape', { detail: { id: shape.id } }));
                  }}
                  title="Zoom canvas to this shape"
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--muted)', cursor: 'pointer', padding: '2px',
                    display: 'flex', alignItems: 'center', borderRadius: 3,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
                >
                  <Focus size={10} />
                </button>
                {onToggleLocked && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleLocked(shape.id); }}
                    title={shape.locked ? 'Unlock layer' : 'Lock layer'}
                    style={{
                      background: 'none', border: 'none',
                      color: shape.locked ? 'var(--accent)' : 'var(--muted)',
                      cursor: 'pointer', padding: '2px', display: 'flex',
                      alignItems: 'center', borderRadius: 3,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = shape.locked ? 'var(--accent)' : 'var(--muted)'; }}
                  >
                    {shape.locked ? <Lock size={10} /> : <Unlock size={10} />}
                  </button>
                )}
                {onToggleHidden && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleHidden(shape.id); }}
                    title={shape.hidden ? 'Show layer' : 'Hide layer'}
                    style={{
                      background: 'none', border: 'none',
                      color: shape.hidden ? 'rgba(239,68,68,0.7)' : 'var(--muted)',
                      cursor: 'pointer', padding: '2px', display: 'flex',
                      alignItems: 'center', borderRadius: 3,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = shape.hidden ? 'rgba(239,68,68,0.7)' : 'var(--muted)'; }}
                  >
                    {shape.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                  </button>
                )}
              </div>
            )}
            {/* Always show lock/eye icon when active (even not hovered) */}
            {!isRenaming && hoveredId !== shape.id && (shape.locked || shape.hidden) && (
              <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                {shape.locked && <Lock size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                {shape.hidden && <EyeOff size={10} style={{ color: 'rgba(239,68,68,0.7)', flexShrink: 0 }} />}
              </div>
            )}
          </div>
          {children.map(child => renderShape(child, depth + 1))}
        </div>
      );
    };

    return (
      <>
        <div className="flex-1 overflow-y-auto py-1">
          {isFiltering ? (
            // Flat filtered list — show all matching shapes regardless of hierarchy
            reversed.filter(matchesQuery).length === 0
              ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                  No layers match "{filterQuery}"
                </div>
              )
              : reversed.filter(matchesQuery).map((shape) => renderShape(shape, 0))
          ) : (
            reversed
              .filter(shape => !shape.parentId) // only top-level (groups show their children inside)
              .map((shape) => renderShape(shape, 0))
          )}
        </div>

        {/* ── Shape hover preview tooltip ───────────────────────────────────── */}
        {previewShape && (
          <ShapePreviewTooltip
            shape={previewShape.shape}
            allShapes={shapes}
            anchorRect={previewShape.rect}
          />
        )}

        {/* ── Layer context menu ────────────────────────────────────────────── */}
        {ctxMenu && (() => {
          const shape = shapes.find(s => s.id === ctxMenu.shapeId);
          if (!shape) return null;
          const menuW = 168;
          // Clamp to viewport
          const x = Math.min(ctxMenu.x, window.innerWidth - menuW - 8);
          const y = Math.min(ctxMenu.y, window.innerHeight - 220);
          return (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: 'fixed', left: x, top: y, zIndex: 9999,
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '4px 0', minWidth: menuW,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                fontSize: 12, color: 'var(--text)', userSelect: 'none',
              }}
            >
              <LayerCtxItem
                label="Rename"
                onClick={() => { setCtxMenu(null); startRename(shape); }}
              />
              <LayerCtxItem
                label={shape.hidden ? 'Show layer' : 'Hide layer'}
                shortcut="⇧H"
                onClick={() => { setCtxMenu(null); onToggleHidden?.(shape.id); }}
              />
              <LayerCtxItem
                label={shape.locked ? 'Unlock layer' : 'Lock layer'}
                shortcut="L"
                onClick={() => { setCtxMenu(null); onToggleLocked?.(shape.id); }}
              />
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <LayerCtxItem
                label="Duplicate"
                shortcut="⌘D"
                onClick={() => { setCtxMenu(null); onDuplicate?.(shape.id); }}
              />
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <LayerCtxItem
                label="Delete"
                shortcut="⌫"
                danger
                onClick={() => { setCtxMenu(null); onDelete?.(shape.id); }}
              />
            </div>
          );
        })()}
      </>
    );
  }

  // ── DOM layer tree mode (iframe content) ──────────────────────────────────
  if (!layerTree) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '0 16px' }}>
          Draw shapes or load a component to see layers
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-1">
      <LayerNodeRow
        node={layerTree}
        depth={0}
        selectedPath={selectedPath}
        onSelect={(path) => { setSelectedPath(path); onSelectPath(path); }}
      />
    </div>
  );
}

// ── Layer context menu item ─────────────────────────────────────────────────
function LayerCtxItem({ label, shortcut, danger, onClick }: {
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'none', border: 'none',
        color: danger ? 'var(--error)' : 'var(--text)',
        cursor: 'pointer', padding: '6px 12px', gap: 20, textAlign: 'left',
        fontSize: 12,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <span>{label}</span>
      {shortcut && <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 11 }}>{shortcut}</span>}
    </button>
  );
}
