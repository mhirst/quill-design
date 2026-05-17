import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import type { Shape, ComponentDef } from '../../lib/shapes';
import type { Page } from '../../hooks/usePages';
import type { LayerNode } from '../../hooks/useCanvas';
import { LayerTree } from '../layers/LayerTree';
import { HistoryPanel } from '../history/HistoryPanel';
import { ComponentsPanel } from '../components/ComponentsPanel';
import { CommentPinsPanel, type CommentPin } from '../canvas/CommentPinsOverlay';
import { DesignTokensPanel } from '../tokens/DesignTokensPanel';

export type LeftTab = 'layers' | 'pages' | 'history' | 'components' | 'comments' | 'tokens';

interface Props {
  // Panel visibility
  collapsed: boolean;
  onCollapse: () => void;
  activeTab: LeftTab;
  onTabChange: (tab: LeftTab) => void;

  // Layers
  layerTree: LayerNode | null;
  shapes: Shape[];
  selectedShapeId: string | null;
  selectedShapeIds: string[];
  onSelectShape: (id: string | null) => void;
  onSelectPath: (path: string) => void;
  onRenameShape: (id: string, name: string) => void;
  onReorderShapes: (newOrder: Shape[]) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDuplicateShape?: (id: string) => void;
  onDeleteShape?: (id: string) => void;
  canvasSelection: unknown;

  // Pages
  pages: Page[];
  activePageId: string;
  onSwitchPage: (id: string) => void;
  onAddPage: () => void;
  onRenamePage: (id: string, name: string) => void;
  onDeletePage: (id: string) => void;

  // History
  historyEntries: { label: string; index: number }[];
  historyIndex: number;
  onJumpHistory: (index: number) => void;

  // Components
  components: ComponentDef[];
  canSaveComponent: boolean;
  onInsertComponent: (componentId: string, x: number, y: number) => void;
  onSaveSelectionAsComponent: (name: string) => void;
  onDeleteComponent: (id: string) => void;
  onRenameComponent: (id: string, name: string) => void;

  // Comments
  commentPins?: CommentPin[];
  onCommentPinChange?: (id: string, patch: Partial<CommentPin>) => void;
  onCommentPinDelete?: (id: string) => void;
  onCommentPinFocus?: (pin: CommentPin) => void;
  onCommentAddMode?: () => void;
}

// All tabs with SVG icons — all visible at once in the icon strip
const TABS: { id: LeftTab; label: string; icon: ReactNode }[] = [
  {
    id: 'layers', label: 'Layers',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="4" width="11" height="2" rx="1" fill="currentColor" opacity="0.9"/>
        <rect x="2" y="7" width="11" height="2" rx="1" fill="currentColor" opacity="0.6"/>
        <rect x="2" y="10" width="11" height="2" rx="1" fill="currentColor" opacity="0.3"/>
      </svg>
    ),
  },
  {
    id: 'pages', label: 'Pages',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="3" y="2" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
        <rect x="5" y="5" width="5" height="1" rx="0.5" fill="currentColor"/>
        <rect x="5" y="7.5" width="5" height="1" rx="0.5" fill="currentColor"/>
        <rect x="5" y="10" width="3" height="1" rx="0.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'components', label: 'Assets',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.8"/>
        <rect x="8" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.5"/>
        <rect x="2" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.5"/>
        <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.8"/>
      </svg>
    ),
  },
  {
    id: 'history', label: 'History',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M7.5 4.5V7.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M2 7.5A5.5 5.5 0 017.5 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 1.5"/>
      </svg>
    ),
  },
  {
    id: 'tokens', label: 'Tokens',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="5" cy="5" r="2.2" fill="currentColor" opacity="0.9"/>
        <circle cx="10" cy="5" r="2.2" fill="currentColor" opacity="0.5"/>
        <circle cx="5" cy="10" r="2.2" fill="currentColor" opacity="0.5"/>
        <circle cx="10" cy="10" r="2.2" fill="currentColor" opacity="0.2"/>
      </svg>
    ),
  },
  {
    id: 'comments', label: 'Comments',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2.5 2.5h10a1 1 0 011 1v6a1 1 0 01-1 1H5l-3 2.5V3.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
        <rect x="5" y="5.5" width="5" height="1" rx="0.5" fill="currentColor"/>
        <rect x="5" y="7.5" width="3" height="1" rx="0.5" fill="currentColor"/>
      </svg>
    ),
  },
];


export function LeftPanel({
  collapsed,
  onCollapse,
  activeTab,
  onTabChange,
  layerTree,
  shapes,
  selectedShapeId,
  selectedShapeIds,
  onSelectShape,
  onSelectPath,
  onRenameShape,
  onReorderShapes,
  onToggleHidden,
  onToggleLocked,
  onDuplicateShape,
  onDeleteShape,
  canvasSelection,
  pages,
  activePageId,
  onSwitchPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  historyEntries,
  historyIndex,
  onJumpHistory,
  components,
  canSaveComponent,
  onInsertComponent,
  onSaveSelectionAsComponent,
  onDeleteComponent,
  onRenameComponent,
  commentPins = [],
  onCommentPinChange,
  onCommentPinDelete,
  onCommentPinFocus,
  onCommentAddMode,
}: Props) {
  const [layerSearch, setLayerSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+F focuses the layer search when the layers tab is active
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && activeTab === 'layers') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab]);

  // Clear search when switching tabs
  useEffect(() => {
    if (activeTab !== 'layers') setLayerSearch('');
  }, [activeTab]);

  const activeTabLabel = TABS.find(t => t.id === activeTab)?.label ?? '';

  return (
    <div style={{
      width: collapsed ? 0 : 256,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'row',
      background: 'var(--panel)',
      borderRight: collapsed ? 'none' : '1px solid var(--border)',
      overflow: 'hidden',
      transition: 'width 0.18s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* ── Icon rail ───────────────────────────────────────────────────────── */}
      <div style={{
        width: 36,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderRight: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.12)',
        paddingTop: 6,
        paddingBottom: 6,
        gap: 1,
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              style={{
                width: 30,
                height: 30,
                background: isActive ? 'rgba(99,102,241,0.15)' : 'none',
                border: 'none',
                borderRadius: 7,
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.1s, color 0.1s',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--muted)';
                }
              }}
            >
              {/* Active indicator bar on left edge */}
              {isActive && (
                <div style={{
                  position: 'absolute', left: -1, top: 5, bottom: 5,
                  width: 2, borderRadius: 1,
                  background: 'var(--accent)',
                }} />
              )}
              {tab.icon}
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Collapse button at bottom of rail */}
        <button
          onClick={onCollapse}
          title="Hide panel"
          style={{
            width: 30, height: 30,
            background: 'none', border: 'none',
            color: 'var(--subtle)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 7, transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--subtle)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M7.5 2.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Content column ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Section header */}
        <div style={{
          height: 36, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          paddingLeft: 10, paddingRight: 8,
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', flex: 1, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {activeTabLabel}
          </span>
        </div>{/* end section header */}

        {/* Tab content fills remaining space */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'layers' && (
          <>
            {/* Layer search bar */}
            {shapes.length > 0 && (
              <div style={{
                padding: '5px 8px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  transition: 'border-color 0.15s',
                }}
                onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <Search size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search layers…"
                    value={layerSearch}
                    onChange={(e) => setLayerSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setLayerSearch(''); e.currentTarget.blur(); }
                      e.stopPropagation();
                    }}
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      color: 'var(--text)', fontSize: 11, minWidth: 0,
                    }}
                  />
                  {layerSearch && (
                    <button
                      onClick={() => { setLayerSearch(''); searchInputRef.current?.focus(); }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--muted)',
                        cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>
            )}
            <LayerTree
              layerTree={layerTree}
              selection={canvasSelection}
              onSelectPath={onSelectPath}
              shapes={shapes.length > 0 ? shapes : undefined}
              selectedShapeId={selectedShapeId}
              selectedShapeIds={selectedShapeIds}
              onSelectShape={onSelectShape}
              onRenameShape={onRenameShape}
              onReorderShapes={onReorderShapes}
              onToggleHidden={onToggleHidden}
              onToggleLocked={onToggleLocked}
              onDuplicate={onDuplicateShape}
              onDelete={onDeleteShape}
              filterQuery={layerSearch}
            />
          </>
        )}

        {activeTab === 'pages' && (
          <PageTabsInline
            pages={pages}
            activePageId={activePageId}
            currentShapes={shapes}
            onSwitch={onSwitchPage}
            onAdd={onAddPage}
            onRename={onRenamePage}
            onDelete={onDeletePage}
          />
        )}

        {activeTab === 'components' && (
          <ComponentsPanel
            components={components}
            onInsert={onInsertComponent}
            onSaveSelection={onSaveSelectionAsComponent}
            canSave={canSaveComponent}
            onDelete={onDeleteComponent}
            onRename={onRenameComponent}
          />
        )}

        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '4px 10px',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {historyIndex + 1} / {historyEntries.length}
              </span>
            </div>
            <HistoryPanel
              entries={historyEntries}
              currentIndex={historyIndex}
              onJump={onJumpHistory}
            />
          </div>
        )}

        {activeTab === 'tokens' && (
          <DesignTokensPanel
            shapes={shapes}
            onSelectShapes={(ids) => {
              // Select first shape in list (future: multi-select support)
              if (ids.length > 0) onSelectShape(ids[0]);
            }}
            selectedShapeId={selectedShapeId}
            selectedShapeIds={selectedShapeIds}
          />
        )}

        {activeTab === 'comments' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <CommentPinsPanel
              pins={commentPins}
              onChange={(id, patch) => onCommentPinChange?.(id, patch)}
              onDelete={(id) => onCommentPinDelete?.(id)}
              onFocus={(pin) => onCommentPinFocus?.(pin)}
              onAddMode={() => onCommentAddMode?.()}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ── Page thumbnail canvas ─────────────────────────────────────────────────────

const THUMB_W = 88;
const THUMB_H = 62;

function PageThumbnail({ shapes, isActive }: { shapes: Shape[]; isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = THUMB_W * dpr;
    canvas.height = THUMB_H * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);

    if (shapes.length === 0) {
      // Empty page hint
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.font = `9px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Empty', THUMB_W / 2, THUMB_H / 2);
      return;
    }

    // Compute world bounding box
    const allBounds = shapes.map(s => ({ x1: s.x, y1: s.y, x2: s.x + s.width, y2: s.y + s.height }));
    const minX = Math.min(...allBounds.map(b => b.x1));
    const minY = Math.min(...allBounds.map(b => b.y1));
    const maxX = Math.max(...allBounds.map(b => b.x2));
    const maxY = Math.max(...allBounds.map(b => b.y2));
    const worldW = maxX - minX;
    const worldH = maxY - minY;

    if (worldW <= 0 || worldH <= 0) return;

    const pad = 8;
    const scaleX = (THUMB_W - pad * 2) / worldW;
    const scaleY = (THUMB_H - pad * 2) / worldH;
    const scale = Math.min(scaleX, scaleY, 1);

    const drawW = worldW * scale;
    const drawH = worldH * scale;
    const offX = (THUMB_W - drawW) / 2;
    const offY = (THUMB_H - drawH) / 2;

    // Draw each shape as a simplified rect/ellipse
    for (const s of shapes) {
      if (s.hidden) continue;
      const sx = (s.x - minX) * scale + offX;
      const sy = (s.y - minY) * scale + offY;
      const sw = Math.max(1, s.width * scale);
      const sh = Math.max(1, s.height * scale);

      ctx.save();
      ctx.globalAlpha = (s.opacity ?? 1) * 0.95;

      // Color
      let color = '#475569';
      if (s.fillType === 'linear-gradient' || s.fillType === 'radial-gradient') {
        color = s.gradientStops?.[0]?.color ?? '#6366f1';
      } else if (s.fill && s.fill !== 'transparent') {
        color = s.fill;
      } else if (s.stroke && s.stroke !== 'transparent') {
        color = s.stroke;
      } else if (s.color) {
        color = s.color;
      }

      // Draw shape
      if (s.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      } else if (s.type === 'frame') {
        // Frame: draw as a card with white bg
        ctx.fillStyle = '#ffffff';
        const r = Math.min(2, sw / 4, sh / 4);
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, r);
        ctx.fill();
        ctx.strokeStyle = color !== '#475569' ? color : 'rgba(99,102,241,0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      } else {
        const r = Math.min(
          typeof s.borderRadius === 'number' ? s.borderRadius * scale : 0,
          sw / 2, sh / 2
        );
        if (r > 0) {
          ctx.beginPath();
          ctx.roundRect(sx, sy, sw, sh, r);
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(sx, sy, sw, sh);
        }
      }

      // Stroke
      if (s.stroke && s.stroke !== 'transparent' && s.strokeWidth > 0) {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = Math.max(0.5, s.strokeWidth * scale);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Active page: accent ring hint on canvas border
    if (isActive) {
      ctx.strokeStyle = 'rgba(99,102,241,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.75, 0.75, THUMB_W - 1.5, THUMB_H - 1.5);
    }
  }, [shapes, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={THUMB_W}
      height={THUMB_H}
      style={{
        display: 'block',
        width: THUMB_W,
        height: THUMB_H,
        borderRadius: 4,
      }}
    />
  );
}

// ── Inline pages list with visual thumbnails ──────────────────────────────────

function PageTabsInline({ pages, activePageId, currentShapes, onSwitch, onAdd, onRename, onDelete }: {
  pages: Page[];
  activePageId: string;
  currentShapes: Shape[];
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((page: Page) => {
    setEditingId(page.id);
    setEditValue(page.name);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) onRename(editingId, editValue.trim());
    setEditingId(null);
  }, [editingId, editValue, onRename]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px 4px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--muted)', textTransform: 'uppercase' }}>
          {pages.length} {pages.length === 1 ? 'Page' : 'Pages'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
        {pages.map((page, i) => {
          const isActive = page.id === activePageId;
          const isEditing = editingId === page.id;
          const isHovered = hoveredId === page.id;
          // Use live shapes for the active page so thumbnail updates in real-time
          const thumbShapes = isActive ? currentShapes : page.shapes;

          return (
            <div
              key={page.id}
              onClick={() => { if (!isEditing) onSwitch(page.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); startRename(page); }}
              onMouseEnter={() => setHoveredId(page.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                padding: '7px 6px 6px',
                cursor: 'pointer',
                background: isActive
                  ? 'rgba(99,102,241,0.1)'
                  : isHovered
                    ? 'rgba(255,255,255,0.04)'
                    : 'transparent',
                borderRadius: 7,
                border: isActive
                  ? '1px solid rgba(99,102,241,0.3)'
                  : '1px solid transparent',
                marginBottom: 4,
                userSelect: 'none',
                position: 'relative',
                transition: 'background 0.1s, border-color 0.1s',
              }}
            >
              {/* Thumbnail */}
              <div style={{
                position: 'relative',
                borderRadius: 5,
                overflow: 'hidden',
                border: isActive
                  ? '1.5px solid rgba(99,102,241,0.5)'
                  : '1.5px solid rgba(255,255,255,0.08)',
                background: '#1e1e2e',
                boxShadow: isActive ? '0 0 0 2px rgba(99,102,241,0.15)' : '0 1px 4px rgba(0,0,0,0.3)',
                transition: 'border-color 0.1s, box-shadow 0.1s',
              }}>
                <PageThumbnail shapes={thumbShapes} isActive={isActive} />
                {/* Page number overlay */}
                <div style={{
                  position: 'absolute',
                  top: 3,
                  right: 4,
                  fontSize: 8,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: isActive ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.25)',
                  lineHeight: 1,
                  pointerEvents: 'none',
                }}>
                  {i + 1}
                </div>
              </div>

              {/* Name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 1 }}>
                {isEditing ? (
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { commitRename(); e.preventDefault(); }
                      if (e.key === 'Escape') { setEditingId(null); e.preventDefault(); }
                      e.stopPropagation();
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      flex: 1, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.4)',
                      borderRadius: 3, color: 'var(--accent)', fontSize: 11, padding: '1px 4px',
                      outline: 'none', minWidth: 0,
                    }}
                  />
                ) : (
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--accent)' : 'var(--muted)',
                  }}>
                    {page.name}
                  </span>
                )}

                {/* Shape count badge */}
                {!isEditing && thumbShapes.length > 0 && (
                  <span style={{
                    fontSize: 9,
                    color: 'var(--subtle)',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 3,
                    padding: '1px 3px',
                    flexShrink: 0,
                    fontFamily: 'monospace',
                  }}>
                    {thumbShapes.length}
                  </span>
                )}

                {/* Delete button */}
                {pages.length > 1 && !isEditing && isHovered && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(page.id); }}
                    title="Delete page"
                    style={{
                      background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
                      fontSize: 13, lineHeight: 1, padding: '0 2px', display: 'flex', alignItems: 'center',
                      borderRadius: 3, flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'var(--error)';
                      e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 12%, transparent)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'var(--muted)';
                      e.currentTarget.style.background = 'none';
                    }}
                  >×</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add page */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '6px 8px', flexShrink: 0 }}>
        <button
          onClick={onAdd}
          style={{
            width: '100%', padding: '6px 8px', background: 'none', border: '1px dashed var(--border)',
            borderRadius: 6, color: 'var(--muted)', cursor: 'pointer', fontSize: 11,
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.background = 'rgba(99,102,241,0.06)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--muted)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          New page
        </button>
      </div>
    </div>
  );
}
