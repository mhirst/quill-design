import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { LayerNode } from '../../hooks/useCanvas';
import type { Shape } from '../../lib/shapes';

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
const SHAPE_ICONS: Record<Shape['type'], string> = {
  frame: '⬜',
  rectangle: '▬',
  ellipse: '◯',
  text: 'T',
  path: '✏',
};

function shapeIcon(shape: Shape): string {
  if (shape.isGroup) return '⊞';
  return SHAPE_ICONS[shape.type] ?? '▪';
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
}

export function LayerTree({ layerTree, onSelectPath, shapes, selectedShapeId, selectedShapeIds, onSelectShape }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── Drawing shapes mode ────────────────────────────────────────────────────
  if (shapes && shapes.length > 0) {
    // Show shapes in reverse order (top of stack = top of list, like Figma)
    // Skip children of groups — they're shown under the group
    const reversed = [...shapes].reverse();

    const renderShape = (shape: Shape, depth: number) => {
      const isSelected = shape.id === selectedShapeId || (selectedShapeIds?.includes(shape.id) ?? false);
      const isDragOver = shape.id === dragOverId;
      const children = shape.isGroup
        ? shape.children.map(id => shapes.find(s => s.id === id)).filter(Boolean) as Shape[]
        : [];
      return (
        <div key={shape.id}>
          <div
            onClick={() => onSelectShape?.(shape.id)}
            draggable
            onDragOver={(e) => { e.preventDefault(); setDragOverId(shape.id); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverId(null);
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
              background: isSelected ? 'var(--accent-dim)' : isDragOver ? 'rgba(99,102,241,0.08)' : 'transparent',
              color: isSelected ? 'var(--accent)' : 'var(--text)',
              borderTop: isDragOver ? '1px solid var(--accent)' : '1px solid transparent',
              borderBottom: '1px solid transparent',
              fontSize: 12,
            }}
            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#ffffff08'; }}
            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 10, color: isSelected ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }}>
              {shapeIcon(shape)}
            </span>
            {/* Fill color swatch */}
            {shape.type !== 'text' && shape.type !== 'path' && shape.fill && shape.fill !== 'transparent' && (
              <span style={{
                width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                background: shape.fill,
                border: '1px solid rgba(255,255,255,0.12)',
              }} />
            )}
            <span style={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}>
              {shape.name}
            </span>
            <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
              {Math.round(shape.width)}×{Math.round(shape.height)}
            </span>
          </div>
          {children.map(child => renderShape(child, depth + 1))}
        </div>
      );
    };

    return (
      <div className="flex-1 overflow-y-auto py-1">
        {reversed
          .filter(shape => !shape.parentId) // only top-level (groups show their children inside)
          .map((shape) => renderShape(shape, 0))}
      </div>
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
