/**
 * ComponentsPanel — the "Components" tab in the left panel.
 *
 * Shows a grid of saved components with thumbnails and names.
 * - Click a component to insert an instance centred in the current viewport
 * - Right-click → rename / delete
 * - Top bar: "Save selection as component" button
 */

import { useRef, useState } from 'react';
import type { ComponentDef } from '../../lib/shapes';
import { Package, Trash2, Pencil, Plus } from 'lucide-react';

interface Props {
  components: ComponentDef[];
  /** Called when the user clicks "insert" — returns canvas-centre coords via callback */
  onInsert: (componentId: string, x: number, y: number) => void;
  /** Called when the user clicks "save selection as component" */
  onSaveSelection: (name: string) => void;
  /** True when there is a valid selection (group or multi-select) to save */
  canSave: boolean;
  onDelete: (componentId: string) => void;
  onRename: (componentId: string, name: string) => void;
}

export function ComponentsPanel({
  components,
  onInsert,
  onSaveSelection,
  canSave,
  onDelete,
  onRename,
}: Props) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [nameInputVal, setNameInputVal] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    if (!canSave) return;
    setNameInputVal('Component');
    setShowNameInput(true);
  };

  const confirmSave = () => {
    const name = nameInputVal.trim() || 'Component';
    onSaveSelection(name);
    setShowNameInput(false);
    setNameInputVal('');
  };

  const handleInsert = (id: string) => {
    // Insert at a reasonable default position (200, 200 in canvas coords)
    // The parent will position based on the current viewport centre
    onInsert(id, 200, 200);
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, id });
  };

  const startRename = (id: string, currentName: string) => {
    setRenaming(id);
    setRenameVal(currentName);
    setCtxMenu(null);
  };

  const commitRename = () => {
    if (renaming && renameVal.trim()) {
      onRename(renaming, renameVal.trim());
    }
    setRenaming(null);
  };

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', userSelect: 'none' }}
      onClick={() => setCtxMenu(null)}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Components
        </span>
        <button
          onClick={handleSave}
          disabled={!canSave}
          title={canSave ? 'Save selection as component' : 'Select a group or multiple shapes first'}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)',
            background: canSave ? 'var(--accent-dim)' : 'none',
            color: canSave ? 'var(--accent)' : 'var(--subtle)',
            cursor: canSave ? 'pointer' : 'not-allowed',
            fontSize: 11, fontWeight: 500,
          }}
        >
          <Plus size={11} />
          Save
        </button>
      </div>

      {/* Name input modal */}
      {showNameInput && (
        <div style={{
          padding: 12, borderBottom: '1px solid var(--border)',
          background: 'var(--panel-alt)', flexShrink: 0,
        }}>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Component name:</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              autoFocus
              value={nameInputVal}
              onChange={e => setNameInputVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmSave();
                if (e.key === 'Escape') setShowNameInput(false);
              }}
              style={{
                flex: 1, height: 26, padding: '0 8px',
                borderRadius: 5, border: '1px solid var(--accent)',
                background: 'var(--input-bg)', color: 'var(--text)',
                fontSize: 12, outline: 'none',
              }}
            />
            <button
              onClick={confirmSave}
              style={{
                padding: '0 10px', height: 26, borderRadius: 5, border: 'none',
                background: 'var(--accent)', color: 'white',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Component grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {components.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 8, color: 'var(--muted)', textAlign: 'center',
          }}>
            <Package size={24} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 12, lineHeight: 1.5 }}>
              No components yet.<br />
              Group some shapes, then click Save.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {components.map(c => (
              <ComponentCard
                key={c.id}
                component={c}
                isRenaming={renaming === c.id}
                renameVal={renameVal}
                onRenameChange={setRenameVal}
                onRenameCommit={commitRename}
                onRenameCancel={() => setRenaming(null)}
                onClick={() => handleInsert(c.id)}
                onContextMenu={(e) => handleContextMenu(e, c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          style={{
            position: 'fixed',
            left: ctxMenu.x, top: ctxMenu.y,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '4px 0',
            zIndex: 1000,
            minWidth: 140,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <CtxItem icon={<Pencil size={12} />} label="Rename" onClick={() => {
            const comp = components.find(c => c.id === ctxMenu.id);
            if (comp) startRename(ctxMenu.id, comp.name);
          }} />
          <CtxItem icon={<Trash2 size={12} />} label="Delete" danger onClick={() => {
            onDelete(ctxMenu.id);
            setCtxMenu(null);
          }} />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ComponentCard({
  component, isRenaming, renameVal, onRenameChange, onRenameCommit, onRenameCancel,
  onClick, onContextMenu,
}: {
  component: ComponentDef;
  isRenaming: boolean;
  renameVal: string;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`Insert "${component.name}"`}
      style={{
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--panel-alt)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'border-color 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {/* Thumbnail */}
      <div style={{
        height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {component.thumbnail ? (
          <img
            src={component.thumbnail}
            alt={component.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Package size={20} style={{ opacity: 0.2, color: 'var(--muted)' }} />
        )}
      </div>

      {/* Name */}
      <div style={{ padding: '5px 8px' }}>
        {isRenaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={e => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={e => {
              if (e.key === 'Enter') onRenameCommit();
              if (e.key === 'Escape') onRenameCancel();
              e.stopPropagation();
            }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', background: 'none', border: 'none',
              outline: '1px solid var(--accent)', borderRadius: 2,
              color: 'var(--text)', fontSize: 11, padding: '1px 2px',
            }}
          />
        ) : (
          <span style={{
            fontSize: 11, color: 'var(--muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'block',
          }}>
            {component.name}
          </span>
        )}
      </div>
    </div>
  );
}

function CtxItem({ icon, label, onClick, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', border: 'none', background: 'none',
        color: danger ? 'var(--error)' : 'var(--text)',
        fontSize: 12, cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-alt)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      {icon}
      {label}
    </button>
  );
}
