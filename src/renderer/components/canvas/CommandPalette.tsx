/**
 * CommandPalette — Cmd+K quick-action overlay.
 *
 * Supports:
 *  - Tool switching (Cursor, Rectangle, Ellipse, Frame, Text, Pen)
 *  - Canvas actions (Undo, Redo, Duplicate, Delete, Group, Ungroup, etc.)
 *  - View actions (Zoom to fit, Zoom to selection, Toggle rulers, etc.)
 *  - Shape operations (Bring to front, Send to back, Align left, etc.)
 *  - Fuzzy-filter as you type
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  icon?: string;
  action: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export function CommandPalette({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Fuzzy filter
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q) ||
      c.shortcut?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Clamp selectedIndex when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) { cmd.action(); onClose(); }
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [open, filtered, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  // Group items
  const groups: Record<string, CommandItem[]> = {};
  for (const item of filtered) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }

  let flatIdx = 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(3px)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 520,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '60vh',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--muted)', flexShrink: 0 }}>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 14, padding: '14px 0',
              fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            background: 'var(--panel-alt)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--muted)', fontSize: 10, padding: '2px 6px',
            fontFamily: 'monospace', flexShrink: 0,
          }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div style={{
                padding: '8px 14px 4px',
                fontSize: 10, fontWeight: 700,
                color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {group}
              </div>
              {items.map((item) => {
                const idx = flatIdx++;
                const isActive = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    data-idx={idx}
                    onClick={() => { item.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 14px',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                      transition: 'background 0.08s',
                    }}
                  >
                    {/* Icon */}
                    {item.icon && (
                      <span style={{
                        width: 24, height: 24, borderRadius: 5,
                        background: isActive ? 'rgba(99,102,241,0.15)' : 'var(--panel-alt)',
                        border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, flexShrink: 0,
                      }}>
                        {item.icon}
                      </span>
                    )}
                    {/* Label */}
                    <span style={{
                      flex: 1, fontSize: 13,
                      color: isActive ? 'var(--text)' : 'var(--text)',
                      fontWeight: isActive ? 500 : 400,
                    }}>
                      {highlightMatch(item.label, query)}
                    </span>
                    {/* Shortcut */}
                    {item.shortcut && (
                      <kbd style={{
                        background: 'var(--panel-alt)', border: '1px solid var(--border)',
                        borderRadius: 4, color: 'var(--muted)',
                        fontSize: 10, padding: '2px 6px',
                        fontFamily: 'monospace', flexShrink: 0, whiteSpace: 'nowrap',
                      }}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
        }}>
          {[['↑↓', 'Navigate'], ['↵', 'Select'], ['Esc', 'Close']].map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <kbd style={{
                background: 'var(--panel-alt)', border: '1px solid var(--border)',
                borderRadius: 3, color: 'var(--muted)',
                fontSize: 9, padding: '1px 5px', fontFamily: 'monospace',
              }}>{key}</kbd>
              <span style={{ fontSize: 10, color: 'var(--subtle)' }}>{desc}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
            {filtered.length} command{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Highlight matching substring ───────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}
