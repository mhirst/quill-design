/**
 * CommentPinsOverlay
 * Renders sticky-note style annotation pins on the canvas in screen space.
 * Designers can add pins by clicking in "comment mode", type a note, and
 * the pin stays anchored to the canvas coordinate it was placed on.
 *
 * Props: zoom + pan from the canvas so pins follow zoom/pan correctly.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface CommentPin {
  id: string;
  x: number;      // canvas coordinate
  y: number;      // canvas coordinate
  text: string;
  author: string;
  color: string;
  resolved: boolean;
  createdAt: number;
  replies: { text: string; author: string; createdAt: number }[];
}

interface Props {
  pins: CommentPin[];
  zoom: number;
  pan: { x: number; y: number };
  activeMode: boolean;            // when true, next canvas click creates a pin
  onAdd: (x: number, y: number) => void;
  onChange: (id: string, patch: Partial<CommentPin>) => void;
  onDelete: (id: string) => void;
  onExitMode: () => void;
}

const PIN_COLORS = [
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#3b82f6', // blue
];

export function CommentPinsOverlay({
  pins,
  zoom,
  pan,
  activeMode,
  onAdd,
  onChange,
  onDelete,
  onExitMode,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftReply, setDraftReply] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle canvas click in comment mode
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (!activeMode) return;
    if ((e.target as HTMLElement).closest('[data-pin]')) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    // Convert screen → canvas coords
    const canvasX = Math.round((screenX - pan.x) / zoom);
    const canvasY = Math.round((screenY - pan.y) / zoom);
    onAdd(canvasX, canvasY);
  }, [activeMode, pan, zoom, onAdd]);

  // ESC closes expanded and exits mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expandedId) { setExpandedId(null); return; }
        if (activeMode) onExitMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expandedId, activeMode, onExitMode]);

  // Close popover on click outside
  useEffect(() => {
    if (!expandedId) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-pin]')) {
        setExpandedId(null);
        setDraftReply('');
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [expandedId]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: activeMode ? 'all' : 'none',
        cursor: activeMode ? 'crosshair' : 'default',
        zIndex: 30,
      }}
      onClick={handleContainerClick}
    >
      {/* Active mode banner */}
      {activeMode && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 8, padding: '5px 14px', fontSize: 11, color: '#f59e0b',
          fontWeight: 600, letterSpacing: '0.04em', pointerEvents: 'none', userSelect: 'none',
          backdropFilter: 'blur(6px)', zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M6 4v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="6" cy="8.5" r="0.6" fill="currentColor"/>
          </svg>
          Comment mode — click canvas to place a pin · Esc to exit
        </div>
      )}

      {/* Render pins */}
      {pins.map((pin, index) => {
        const screenX = pin.x * zoom + pan.x;
        const screenY = pin.y * zoom + pan.y;
        const isExpanded = expandedId === pin.id;
        const number = index + 1;

        return (
          <div
            key={pin.id}
            data-pin="1"
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'all',
              zIndex: isExpanded ? 45 : 31,
            }}
          >
            {/* Pin marker */}
            <div
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: 'pointer', userSelect: 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedId(isExpanded ? null : pin.id);
                setDraftReply('');
              }}
            >
              {/* Bubble */}
              <div style={{
                width: 24, height: 24, borderRadius: '50% 50% 50% 0',
                transform: 'rotate(-45deg)',
                background: pin.resolved ? '#6b7280' : pin.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                transition: 'transform 0.12s, box-shadow 0.12s',
                opacity: pin.resolved ? 0.5 : 1,
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(-45deg) scale(1.15)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.45)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'rotate(-45deg)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)'; }}
              >
                <span style={{
                  transform: 'rotate(45deg)',
                  fontSize: 9, fontWeight: 800, color: '#fff',
                  lineHeight: 1, fontFamily: 'monospace',
                }}>
                  {number}
                </span>
              </div>
            </div>

            {/* Expanded popover */}
            {isExpanded && (
              <div style={{
                position: 'absolute',
                top: -8, left: 28,
                width: 240,
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                pointerEvents: 'all',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: pin.resolved ? 'rgba(107,114,128,0.12)' : `${pin.color}18`,
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: pin.resolved ? '#6b7280' : pin.color,
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                      Pin #{number}
                    </span>
                    {pin.resolved && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', background: 'rgba(107,114,128,0.15)', padding: '1px 5px', borderRadius: 4 }}>
                        RESOLVED
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {/* Resolve toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onChange(pin.id, { resolved: !pin.resolved }); }}
                      title={pin.resolved ? 'Re-open' : 'Mark resolved'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: pin.resolved ? '#10b981' : 'var(--muted)',
                        padding: '2px 4px', borderRadius: 4,
                        fontSize: 11, display: 'flex', alignItems: 'center',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M4 6.5l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(pin.id); setExpandedId(null); }}
                      title="Delete pin"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--muted)', padding: '2px 4px', borderRadius: 4,
                        fontSize: 11, display: 'flex', alignItems: 'center',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Main comment (editable) */}
                <div style={{ padding: '8px 10px', borderBottom: pin.replies.length > 0 ? '1px solid var(--border)' : 'none' }}>
                  <PinTextEdit
                    value={pin.text}
                    onChange={(v) => onChange(pin.id, { text: v })}
                    placeholder="Add a note…"
                  />
                  <div style={{ fontSize: 9, color: 'var(--subtle)', marginTop: 4 }}>
                    {new Date(pin.createdAt).toLocaleDateString()} · {pin.author}
                  </div>
                </div>

                {/* Replies */}
                {pin.replies.map((r, i) => (
                  <div key={i} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
                    <div style={{ color: 'var(--text)', marginBottom: 2 }}>{r.text}</div>
                    <div style={{ fontSize: 9, color: 'var(--subtle)' }}>
                      {new Date(r.createdAt).toLocaleDateString()} · {r.author}
                    </div>
                  </div>
                ))}

                {/* Reply box */}
                <div style={{ padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                  <textarea
                    value={draftReply}
                    onChange={(e) => setDraftReply(e.target.value)}
                    placeholder="Reply…"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && draftReply.trim()) {
                        e.preventDefault();
                        onChange(pin.id, {
                          replies: [...pin.replies, {
                            text: draftReply.trim(),
                            author: 'You',
                            createdAt: Date.now(),
                          }],
                        });
                        setDraftReply('');
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '4px 7px', fontSize: 11, color: 'var(--text)',
                      resize: 'none', outline: 'none', fontFamily: 'inherit',
                      minHeight: 28,
                    }}
                  />
                  <button
                    disabled={!draftReply.trim()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!draftReply.trim()) return;
                      onChange(pin.id, {
                        replies: [...pin.replies, {
                          text: draftReply.trim(),
                          author: 'You',
                          createdAt: Date.now(),
                        }],
                      });
                      setDraftReply('');
                    }}
                    style={{
                      background: 'var(--accent)', border: 'none', borderRadius: 6,
                      color: '#fff', cursor: draftReply.trim() ? 'pointer' : 'default',
                      padding: '4px 8px', fontSize: 11, fontWeight: 600,
                      opacity: draftReply.trim() ? 1 : 0.4, transition: 'opacity 0.12s',
                    }}
                  >
                    Send
                  </button>
                </div>

                {/* Color picker row */}
                <div style={{ padding: '4px 10px 8px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: 'var(--subtle)', marginRight: 4 }}>Color</span>
                  {PIN_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={(e) => { e.stopPropagation(); onChange(pin.id, { color: c }); }}
                      style={{
                        width: 14, height: 14, borderRadius: '50%', cursor: 'pointer',
                        background: c, border: pin.color === c ? '2px solid #fff' : '1px solid transparent',
                        boxSizing: 'border-box', transition: 'border 0.1s',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Inline editable text for pin main body
function PinTextEdit({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [editing, setEditing] = useState(!value);
  const [draft, setDraft] = useState(value);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && taRef.current) taRef.current.focus();
  }, [editing]);

  if (!editing) {
    return (
      <div
        onClick={() => { setDraft(value); setEditing(true); }}
        style={{
          fontSize: 12, color: value ? 'var(--text)' : 'var(--subtle)',
          cursor: 'text', minHeight: 18, lineHeight: 1.5,
          wordBreak: 'break-word',
        }}
      >
        {value || placeholder}
      </div>
    );
  }

  return (
    <textarea
      ref={taRef}
      value={draft}
      rows={3}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onChange(draft); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          onChange(draft);
          setEditing(false);
        }
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%', background: 'var(--input-bg)', border: '1px solid var(--accent)',
        borderRadius: 5, padding: '4px 6px', fontSize: 12, color: 'var(--text)',
        resize: 'none', outline: 'none', fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ── Comment pins sidebar panel ────────────────────────────────────────────────

interface PanelProps {
  pins: CommentPin[];
  onChange: (id: string, patch: Partial<CommentPin>) => void;
  onDelete: (id: string) => void;
  onFocus: (pin: CommentPin) => void;
  onAddMode: () => void;
}

export function CommentPinsPanel({ pins, onChange, onDelete, onFocus, onAddMode }: PanelProps) {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const visible = pins.filter(p => filter === 'all' || (filter === 'open' ? !p.resolved : p.resolved));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--panel)' }}>
      {/* Header */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 8, borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          Comments
          {pins.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>
              {pins.filter(p => !p.resolved).length} open
            </span>
          )}
        </span>
        <button
          onClick={onAddMode}
          title="Add comment pin"
          style={{
            background: 'var(--accent)', border: 'none', borderRadius: 6,
            color: '#fff', cursor: 'pointer', padding: '3px 8px',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Add
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
        {(['all', 'open', 'resolved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 8px', fontSize: 10, fontWeight: filter === f ? 700 : 400,
              color: filter === f ? 'var(--accent)' : 'var(--muted)',
              borderBottom: filter === f ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, textTransform: 'capitalize', transition: 'all 0.12s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Pin list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {visible.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--subtle)', fontSize: 11, marginTop: 32 }}>
            {filter === 'all' ? (
              <>
                <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
                <div style={{ fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>No comments yet</div>
                <div>Click "Add" or press <kbd style={{ fontSize: 9, background: 'var(--panel-alt)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px' }}>⌘⇧N</kbd> to place a pin</div>
              </>
            ) : `No ${filter} comments`}
          </div>
        )}
        {visible.map((pin, index) => {
          const number = pins.indexOf(pin) + 1;
          return (
            <div
              key={pin.id}
              style={{
                background: 'var(--panel-alt)', borderRadius: 8,
                border: `1px solid ${pin.resolved ? 'var(--border)' : pin.color + '40'}`,
                marginBottom: 6, overflow: 'hidden',
                opacity: pin.resolved ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {/* Pin header row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
                background: `${pin.color}10`,
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: pin.resolved ? '#6b7280' : pin.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{number}</span>
                </div>
                <span style={{ flex: 1, fontSize: 10, color: 'var(--muted)' }}>
                  {new Date(pin.createdAt).toLocaleDateString()}
                  {pin.replies.length > 0 && ` · ${pin.replies.length} repl${pin.replies.length === 1 ? 'y' : 'ies'}`}
                </span>
                <button
                  onClick={() => onFocus(pin)}
                  title="Jump to pin"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1C3 1 1 3 1 5.5S3 10 5.5 10 10 8 10 5.5 8 1 5.5 1z" stroke="currentColor" strokeWidth="1.1"/>
                    <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor"/>
                  </svg>
                </button>
                <button
                  onClick={() => onChange(pin.id, { resolved: !pin.resolved })}
                  title={pin.resolved ? 'Re-open' : 'Resolve'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: pin.resolved ? '#10b981' : 'var(--muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1"/>
                    <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(pin.id)}
                  title="Delete"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              {/* Comment text */}
              <div style={{ padding: '7px 10px', fontSize: 11, color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {pin.text || <span style={{ color: 'var(--subtle)', fontStyle: 'italic' }}>No note</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
