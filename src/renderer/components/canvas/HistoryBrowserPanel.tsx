/**
 * HistoryBrowserPanel — visual undo history browser.
 *
 * Shows the full undo stack with:
 *  - Labels (action names)
 *  - Shape count at each step
 *  - Time indicator (relative)
 *  - Click to jump to any point in history
 *  - Current position highlighted
 *
 * Like Photoshop's History panel.
 */

import React, { useEffect, useRef } from 'react';

export interface HistoryEntry {
  label: string;
  index: number;
}

interface Props {
  entries: HistoryEntry[];
  currentIndex: number;
  onJump: (index: number) => void;
  onClose: () => void;
}

const actionIconMap: Record<string, string> = {
  'Initial state': '◉',
  'Undo': '↩',
  'Redo': '↪',
  'Shape created': '＋',
  'Move': '✥',
  'Resize': '⤡',
  'Duplicate': '⧉',
  'Delete': '✕',
  'Group': '⊞',
  'Ungroup': '⊟',
  'Wrap in frame': '⬜',
  'Paste': '⎘',
  'Copy': '⧉',
  'Align': '⊢',
  'Distribute': '↔',
  'Color': '●',
  'Tidy up': '⊞',
  'Stack': '≡',
  'Grid': '⊞',
  'Scatter': '✦',
  'Radial': '◎',
  'Spiral': '🌀',
  'Morph': '↔',
  'Draw': '✏',
  'Text': 'T',
};

function getActionIcon(label: string): string {
  for (const [key, icon] of Object.entries(actionIconMap)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '◈';
}

export function HistoryBrowserPanel({ entries, currentIndex, onJump, onClose }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  // Scroll to current entry on open
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentIndex]);

  const total = entries.length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        right: 320,
        width: 240,
        maxHeight: 420,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 50,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>History</span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: 'var(--accent)',
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 4, padding: '1px 5px',
          }}>
            {total} {total === 1 ? 'state' : 'states'}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', fontSize: 14, padding: 2, borderRadius: 4,
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-alt)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          ✕
        </button>
      </div>

      {/* Description */}
      <div style={{
        padding: '5px 12px',
        fontSize: 10,
        color: 'var(--subtle)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0,
      }}>
        Click any state to jump there
      </div>

      {/* History list */}
      <div
        ref={listRef}
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: '4px 0',
        }}
      >
        {entries.map((entry, i) => {
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;
          const isFirst = i === 0;

          return (
            <div
              key={i}
              ref={isCurrent ? currentRef : undefined}
              onClick={() => onJump(entry.index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
                cursor: 'pointer',
                background: isCurrent ? 'rgba(99,102,241,0.12)' : 'transparent',
                borderLeft: isCurrent ? '2px solid var(--accent)' : '2px solid transparent',
                opacity: isFuture ? 0.4 : 1,
                transition: 'background 0.1s',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={e => {
                if (!isCurrent) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Timeline line */}
              {!isFirst && (
                <div style={{
                  position: 'absolute',
                  left: 19, top: 0,
                  width: 1,
                  height: 6,
                  background: isFuture ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.25)',
                }} />
              )}

              {/* Icon dot */}
              <div style={{
                width: 20, height: 20, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                background: isCurrent
                  ? 'rgba(99,102,241,0.25)'
                  : isFirst
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(255,255,255,0.04)',
                border: isCurrent ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
                fontSize: 9,
                color: isCurrent ? 'var(--accent)' : 'var(--muted)',
              }}>
                {getActionIcon(entry.label)}
              </div>

              {/* Label */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11,
                  color: isCurrent ? 'var(--text)' : 'var(--muted)',
                  fontWeight: isCurrent ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entry.label}
                </div>
                <div style={{
                  fontSize: 9,
                  color: 'var(--subtle)',
                  marginTop: 1,
                }}>
                  state {i + 1} of {total}
                </div>
              </div>

              {/* Current badge */}
              {isCurrent && (
                <div style={{
                  fontSize: 8, fontWeight: 700, color: 'var(--accent)',
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 3, padding: '1px 4px', flexShrink: 0,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  now
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer with stats */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, color: 'var(--subtle)' }}>
          {currentIndex + 1} / {total}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => currentIndex > 0 && onJump(currentIndex - 1)}
            disabled={currentIndex === 0}
            title="Previous state (Cmd+Z)"
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 4,
              cursor: currentIndex === 0 ? 'default' : 'pointer',
              color: currentIndex === 0 ? 'var(--subtle)' : 'var(--muted)',
              fontSize: 10, padding: '2px 6px',
            }}
          >
            ↩ Undo
          </button>
          <button
            onClick={() => currentIndex < total - 1 && onJump(currentIndex + 1)}
            disabled={currentIndex >= total - 1}
            title="Next state (Cmd+Shift+Z)"
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 4,
              cursor: currentIndex >= total - 1 ? 'default' : 'pointer',
              color: currentIndex >= total - 1 ? 'var(--subtle)' : 'var(--muted)',
              fontSize: 10, padding: '2px 6px',
            }}
          >
            Redo ↪
          </button>
        </div>
      </div>
    </div>
  );
}
