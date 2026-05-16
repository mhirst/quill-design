import { useCallback, useRef, useState } from 'react';
import type { Page } from '../../hooks/usePages';

interface Props {
  pages: Page[];
  activePageId: string;
  onSwitch: (pageId: string) => void;
  onAdd: () => void;
  onRename: (pageId: string, name: string) => void;
  onDelete: (pageId: string) => void;
}

export function PageTabs({ pages, activePageId, onSwitch, onAdd, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((page: Page) => {
    setEditingId(page.id);
    setEditValue(page.name);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, onRename]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: 'var(--panel)',
        borderTop: '1px solid var(--border)',
        padding: '0 8px',
        height: 36,
        flexShrink: 0,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Page tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, overflow: 'auto', height: '100%' }}>
        {pages.map((page) => {
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
                gap: 4,
                padding: '0 10px',
                height: 28,
                borderRadius: 6,
                cursor: 'pointer',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                border: isActive ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' : '1px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                fontSize: 12,
                fontWeight: isActive ? 500 : 400,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--panel-alt)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { commitRename(); e.preventDefault(); }
                    if (e.key === 'Escape') { setEditingId(null); e.preventDefault(); }
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'var(--accent-dim)',
                    border: '1px solid color-mix(in srgb, var(--accent) 50%, transparent)',
                    borderRadius: 3,
                    color: 'var(--accent)',
                    fontSize: 12,
                    padding: '0 4px',
                    height: 20,
                    width: Math.max(60, editValue.length * 8),
                    outline: 'none',
                  }}
                  autoFocus
                />
              ) : (
                <span>{page.name}</span>
              )}
              {/* Delete button — only shown when multiple pages exist */}
              {pages.length > 1 && !isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
                  title="Delete page"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 0,
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 2,
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 15%, transparent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {/* Add page button */}
        <button
          onClick={onAdd}
          title="Add page"
          style={{
            background: 'none',
            border: '1px solid transparent',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontSize: 16,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            flexShrink: 0,
            lineHeight: 1,
            transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'transparent'; }}
        >
          +
        </button>
      </div>
    </div>
  );
}
