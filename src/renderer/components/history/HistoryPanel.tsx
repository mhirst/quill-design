import { useEffect, useRef } from 'react';

interface HistoryEntry {
  label: string;
  index: number;
}

interface Props {
  entries: HistoryEntry[];
  currentIndex: number;
  onJump: (index: number) => void;
}

// Action-type → icon mapping
const ACTION_ICONS: Record<string, string> = {
  'Add': '＋',
  'Delete': '✕',
  'Move': '⤢',
  'Resize': '⇲',
  'Rotate': '↻',
  'Edit': '✎',
  'Duplicate': '⎘',
  'Paste': '⎘',
  'Group': '⊞',
  'Ungroup': '⊟',
  'Bring': '⬆',
  'Send': '⬇',
  'Load': '⬛',
  'Initial': '⬛',
};

function getIcon(label: string): string {
  for (const [key, icon] of Object.entries(ACTION_ICONS)) {
    if (label.startsWith(key)) return icon;
  }
  return '●';
}

export function HistoryPanel({ entries, currentIndex, onJump }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll current item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${currentIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  return (
    <div
      ref={listRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 0',
      }}
    >
      {entries.length === 0 && (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
          No history yet
        </div>
      )}
      {/* Show newest at top — reversed */}
      {[...entries].reverse().map((entry) => {
        const isCurrent = entry.index === currentIndex;
        const isFuture = entry.index > currentIndex;
        return (
          <button
            key={entry.index}
            data-index={entry.index}
            onClick={() => onJump(entry.index)}
            title={`Jump to: ${entry.label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '5px 12px',
              background: isCurrent ? 'rgba(99,102,241,0.18)' : 'transparent',
              border: 'none',
              borderLeft: isCurrent
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              color: isFuture ? 'var(--muted)' : isCurrent ? 'var(--accent)' : 'var(--text)',
              opacity: isFuture ? 0.4 : 1,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 12,
              fontFamily: 'inherit',
              transition: 'background 0.08s',
            }}
            onMouseEnter={(e) => {
              if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              if (!isCurrent) e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Step number */}
            <span style={{
              fontSize: 10,
              color: 'var(--muted)',
              fontFamily: 'monospace',
              flexShrink: 0,
              width: 20,
              textAlign: 'right',
            }}>
              {entry.index}
            </span>
            {/* Icon */}
            <span style={{ fontSize: 13, flexShrink: 0, width: 16, textAlign: 'center' }}>
              {getIcon(entry.label)}
            </span>
            {/* Label */}
            <span style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {entry.label}
            </span>
            {/* Current marker */}
            {isCurrent && (
              <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>
                ●
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
