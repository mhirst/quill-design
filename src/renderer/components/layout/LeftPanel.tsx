import { useCallback, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Shape, ComponentDef } from '../../lib/shapes';
import type { Page } from '../../hooks/usePages';
import type { LayerNode } from '../../hooks/useCanvas';
import { LayerTree } from '../layers/LayerTree';
import { HistoryPanel } from '../history/HistoryPanel';
import { ComponentsPanel } from '../components/ComponentsPanel';

export type LeftTab = 'layers' | 'pages' | 'history' | 'components';

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
}

const TABS: { id: LeftTab; label: string }[] = [
  { id: 'layers', label: 'Layers' },
  { id: 'pages', label: 'Pages' },
  { id: 'history', label: 'History' },
  { id: 'components', label: 'Components' },
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
}: Props) {
  if (collapsed) {
    return (
      <div style={{
        width: 0,
        overflow: 'visible',
        position: 'relative',
        flexShrink: 0,
        zIndex: 5,
      }}>
        {/* Expand button — floats over the canvas edge */}
        <button
          onClick={onCollapse}
          title="Show panel"
          style={{
            position: 'absolute',
            top: 10,
            left: 0,
            width: 20,
            height: 32,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderLeft: 'none',
            borderRadius: '0 6px 6px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--muted)',
            zIndex: 10,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
        >
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
            <path d="M2 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--panel)',
      borderRight: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        height: 36,
        paddingLeft: 4,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '0 10px',
              height: '100%',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--muted)',
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'color 0.1s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--muted)'; }}
          >
            {tab.label}
          </button>
        ))}

        {/* Spacer + collapse button */}
        <div style={{ flex: 1 }} />
        <button
          onClick={onCollapse}
          title="Hide panel"
          style={{
            width: 28,
            height: 28,
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 5,
            marginRight: 4,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'layers' && (
          <LayerTree
            layerTree={layerTree}
            selection={canvasSelection}
            onSelectPath={onSelectPath}
            shapes={shapes.length > 0 ? shapes : undefined}
            selectedShapeId={selectedShapeId}
            selectedShapeIds={selectedShapeIds}
            onSelectShape={onSelectShape}
          />
        )}

        {activeTab === 'pages' && (
          <PageTabsInline
            pages={pages}
            activePageId={activePageId}
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
      </div>
    </div>
  );
}

// ── Inline pages list (vertical, not a horizontal tab strip) ─────────────────

function PageTabsInline({ pages, activePageId, onSwitch, onAdd, onRename, onDelete }: {
  pages: Page[];
  activePageId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {pages.map((page, i) => {
          const isActive = page.id === activePageId;
          const isEditing = editingId === page.id;
          return (
            <div
              key={page.id}
              onClick={() => { if (!isEditing) onSwitch(page.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); startRename(page); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text)',
                fontSize: 13,
                userSelect: 'none',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Page icon */}
              <svg width="12" height="14" viewBox="0 0 12 14" fill="none" style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--muted)' }}>
                <rect x="0.5" y="0.5" width="11" height="13" rx="1.5" stroke="currentColor" />
              </svg>

              {/* Name / edit input */}
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
                    borderRadius: 3, color: 'var(--accent)', fontSize: 13, padding: '1px 4px',
                    outline: 'none', minWidth: 0,
                  }}
                />
              ) : (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                  {page.name}
                </span>
              )}

              {/* Page number */}
              {!isEditing && (
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{i + 1}</span>
              )}

              {/* Delete */}
              {pages.length > 1 && !isEditing && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(page.id); }}
                  title="Delete page"
                  style={{
                    background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
                    fontSize: 15, lineHeight: 1, padding: '0 2px', display: 'flex', alignItems: 'center',
                    borderRadius: 3, flexShrink: 0, opacity: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.color = 'var(--error)';
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 12%, transparent)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = '0';
                    e.currentTarget.style.color = 'var(--muted)';
                    e.currentTarget.style.background = 'none';
                  }}
                >×</button>
              )}
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
            borderRadius: 6, color: 'var(--muted)', cursor: 'pointer', fontSize: 12,
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
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          New page
        </button>
      </div>
    </div>
  );
}
