/**
 * StickyNotesOverlay — canvas-level sticky notes (annotation pins).
 *
 * Notes live at canvas coordinates but render as fixed-size elements
 * using the same zoom/pan transform as the canvas.
 *
 * Each note has: position (x, y), text, color, size (compact vs expanded),
 * and can be dragged, edited, and deleted.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string; // one of NOTE_COLORS
  width: number;
  minimized: boolean;
  createdAt: number;
}

const NOTE_COLORS = [
  '#fef08a', // yellow
  '#fed7aa', // orange
  '#fca5a5', // red
  '#c4b5fd', // purple
  '#86efac', // green
  '#7dd3fc', // blue
] as const;

const NOTE_TEXT_COLORS: Record<string, string> = {
  '#fef08a': '#713f12',
  '#fed7aa': '#7c2d12',
  '#fca5a5': '#7f1d1d',
  '#c4b5fd': '#2e1065',
  '#86efac': '#14532d',
  '#7dd3fc': '#0c4a6e',
};

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'quill_sticky_notes_v1_';

function loadNotes(projectId: string): StickyNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + projectId);
    if (!raw) return [];
    return JSON.parse(raw) as StickyNote[];
  } catch {
    return [];
  }
}

function saveNotes(projectId: string, notes: StickyNote[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(notes));
  } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  zoom: number;
  panX: number;
  panY: number;
  /** If true, clicking the canvas (outside notes) places a new note */
  placingMode: boolean;
  onPlacingComplete: () => void;
}

export function StickyNotesOverlay({ projectId, zoom, panX, panY, placingMode, onPlacingComplete }: Props) {
  const [notes, setNotes] = useState<StickyNote[]>(() => loadNotes(projectId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingRef = useRef<{ startX: number; startY: number; noteX: number; noteY: number } | null>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  // Persist whenever notes change
  useEffect(() => {
    saveNotes(projectId, notes);
  }, [notes, projectId]);

  // Focus textarea when editing
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  // Handle canvas click to place new note
  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingMode) return;
    if ((e.target as HTMLElement).closest('[data-sticky-note]')) return;
    e.preventDefault();
    e.stopPropagation();
    // Convert screen coords → canvas coords
    const canvasX = (e.clientX - panX) / zoom;
    const canvasY = (e.clientY - panY) / zoom;
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const color = NOTE_COLORS[notes.length % NOTE_COLORS.length];
    const newNote: StickyNote = {
      id,
      x: canvasX - 80,
      y: canvasY - 40,
      text: '',
      color,
      width: 200,
      minimized: false,
      createdAt: Date.now(),
    };
    setNotes(ns => [...ns, newNote]);
    setEditingId(id);
    onPlacingComplete();
  }, [placingMode, zoom, panX, panY, notes.length, onPlacingComplete]);

  // Drag handling
  const onDragStart = useCallback((e: React.PointerEvent, note: StickyNote) => {
    if (editingId === note.id) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(note.id);
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      noteX: note.x,
      noteY: note.y,
    };
  }, [editingId]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !draggingId) return;
    const dx = (e.clientX - draggingRef.current.startX) / zoom;
    const dy = (e.clientY - draggingRef.current.startY) / zoom;
    setNotes(ns => ns.map(n =>
      n.id === draggingId
        ? { ...n, x: draggingRef.current!.noteX + dx, y: draggingRef.current!.noteY + dy }
        : n
    ));
  }, [draggingId, zoom]);

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    draggingRef.current = null;
  }, []);

  const updateNote = useCallback((id: string, patch: Partial<StickyNote>) => {
    setNotes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(ns => ns.filter(n => n.id !== id));
    if (editingId === id) setEditingId(null);
  }, [editingId]);

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: placingMode ? 'all' : 'none', zIndex: 50 }}
      onClick={handleOverlayClick}
    >
      {notes.map(note => {
        const screenX = note.x * zoom + panX;
        const screenY = note.y * zoom + panY;
        const isEditing = editingId === note.id;
        const isDragging = draggingId === note.id;
        const textColor = NOTE_TEXT_COLORS[note.color] ?? '#1a1a1a';

        return (
          <div
            key={note.id}
            data-sticky-note="true"
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: note.minimized ? 32 : note.width * zoom,
              pointerEvents: 'all',
              zIndex: isDragging ? 200 : (isEditing ? 150 : 100),
              transition: isDragging ? 'none' : 'none',
            }}
          >
            {/* Note card */}
            <div
              style={{
                background: note.color,
                borderRadius: 6,
                boxShadow: isDragging
                  ? '0 12px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15)'
                  : '0 4px 12px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                transform: isDragging ? 'rotate(1.5deg) scale(1.02)' : 'none',
                transition: isDragging ? 'box-shadow 0.1s, transform 0.1s' : 'box-shadow 0.15s, transform 0.15s',
                minWidth: 32,
                userSelect: isEditing ? 'text' : 'none',
              }}
              onPointerDown={(e) => { e.stopPropagation(); onDragStart(e, note); }}
              onPointerMove={(e) => { e.stopPropagation(); onDragMove(e); }}
              onPointerUp={(e) => { e.stopPropagation(); onDragEnd(); }}
            >
              {/* Header bar */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 6px',
                  background: `${note.color}cc`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  backdropFilter: 'brightness(0.92)',
                }}
              >
                {/* Color picker dots */}
                {!note.minimized && (
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {NOTE_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={(e) => { e.stopPropagation(); updateNote(note.id, { color: c }); }}
                        style={{
                          width: 8, height: 8, borderRadius: '50%', background: c,
                          border: c === note.color ? `2px solid ${textColor}` : '1px solid rgba(0,0,0,0.2)',
                          cursor: 'pointer', padding: 0, flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                )}
                <div style={{ flex: 1 }} />
                {/* Minimize toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); updateNote(note.id, { minimized: !note.minimized }); }}
                  title={note.minimized ? 'Expand note' : 'Minimize note'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: textColor, opacity: 0.6, padding: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, fontSize: 10,
                  }}
                >
                  {note.minimized ? '▢' : '−'}
                </button>
                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                  title="Delete note"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: textColor, opacity: 0.6, padding: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Body */}
              {!note.minimized && (
                <div style={{ padding: '6px 8px 8px' }}>
                  {isEditing ? (
                    <textarea
                      ref={editRef}
                      value={note.text}
                      onChange={(e) => updateNote(note.id, { text: e.target.value })}
                      onBlur={() => { if (!note.text.trim()) deleteNote(note.id); else setEditingId(null); }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') { if (!note.text.trim()) deleteNote(note.id); else setEditingId(null); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Type a note…"
                      style={{
                        width: '100%', minHeight: 60, maxHeight: 200,
                        background: 'none', border: 'none', outline: 'none',
                        resize: 'vertical', fontFamily: 'inherit', fontSize: 12,
                        color: textColor, lineHeight: 1.45,
                        boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingId(note.id); }}
                      style={{
                        fontSize: 12, color: textColor, lineHeight: 1.45,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        minHeight: 28, cursor: 'default',
                        fontFamily: 'inherit',
                      }}
                    >
                      {note.text || (
                        <span style={{ opacity: 0.45, fontStyle: 'italic' }}>Double-click to edit</span>
                      )}
                    </div>
                  )}

                  {/* Resize handle */}
                  {!isEditing && (
                    <div
                      style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: 12, height: 12, cursor: 'se-resize', opacity: 0.3,
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const startW = note.width;
                        const onMove = (ev: PointerEvent) => {
                          const dw = (ev.clientX - startX) / zoom;
                          updateNote(note.id, { width: Math.max(120, startW + dw) });
                        };
                        const onUp = () => {
                          window.removeEventListener('pointermove', onMove);
                          window.removeEventListener('pointerup', onUp);
                        };
                        window.addEventListener('pointermove', onMove);
                        window.addEventListener('pointerup', onUp);
                      }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M2 8L8 2M5 8L8 5" stroke={textColor} strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              )}

              {/* Minimized: just show first line of text as tooltip */}
              {note.minimized && (
                <div style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, cursor: 'pointer',
                }}
                  title={note.text || 'Note (double-click to expand)'}
                  onDoubleClick={(e) => { e.stopPropagation(); updateNote(note.id, { minimized: false }); setEditingId(note.id); }}
                >
                  📝
                </div>
              )}
            </div>

            {/* Canvas-coord pin indicator (tiny triangle at bottom center) */}
            <div style={{
              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: `6px solid ${note.color}`,
              filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))',
              pointerEvents: 'none',
            }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Hook for external control ─────────────────────────────────────────────────

export function useStickyNotes() {
  const [placingMode, setPlacingMode] = useState(false);
  const startPlacing = useCallback(() => setPlacingMode(true), []);
  const stopPlacing = useCallback(() => setPlacingMode(false), []);
  return { placingMode, startPlacing, stopPlacing };
}
