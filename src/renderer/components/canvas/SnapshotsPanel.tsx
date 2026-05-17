/**
 * SnapshotsPanel
 * Save named snapshots of the current canvas state and restore them.
 * Snapshots are stored in localStorage, keyed by projectId.
 * Shortcut: ⌘⇧S to open.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, Camera, RotateCcw, Trash2, Clock } from 'lucide-react';
import type { Shape } from '../../lib/shapes';

export interface CanvasSnapshot {
  id: string;
  name: string;
  timestamp: number;
  shapes: Shape[];
  thumbnail?: string; // base64 PNG thumbnail (optional)
}

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  projectId: string;
  onRestore: (shapes: Shape[]) => void;
}

const STORAGE_PREFIX = 'quill_snapshots_v1_';

function loadSnapshots(projectId: string): CanvasSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + projectId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSnapshots(projectId: string, snapshots: CanvasSnapshot[]) {
  try {
    // Keep max 20 snapshots per project
    const trimmed = snapshots.slice(0, 20);
    localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(trimmed));
  } catch {
    // Storage full — skip
  }
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return 'just now';
}

function ShapeCountBadge({ count }: { count: number }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, color: 'var(--muted)',
      background: 'var(--panel-alt)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '1px 6px', flexShrink: 0,
    }}>
      {count} shape{count !== 1 ? 's' : ''}
    </span>
  );
}

export function SnapshotsPanel({ open, onClose, shapes, projectId, onRestore }: Props) {
  const [snapshots, setSnapshots] = useState<CanvasSnapshot[]>([]);
  const [newName, setNewName] = useState('');
  const [naming, setNaming] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Load snapshots when opening
  useEffect(() => {
    if (open) {
      setSnapshots(loadSnapshots(projectId));
    }
  }, [open, projectId]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  const handleSave = useCallback(() => {
    const name = newName.trim() || `Snapshot ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const snap: CanvasSnapshot = {
      id: Math.random().toString(36).slice(2),
      name,
      timestamp: Date.now(),
      shapes: JSON.parse(JSON.stringify(shapes)), // deep clone
    };
    const next = [snap, ...snapshots];
    setSnapshots(next);
    saveSnapshots(projectId, next);
    setNewName('');
    setNaming(false);
  }, [newName, shapes, snapshots, projectId]);

  const handleRestore = useCallback((snap: CanvasSnapshot) => {
    setRestoreId(snap.id);
    setTimeout(() => {
      onRestore(JSON.parse(JSON.stringify(snap.shapes)));
      setRestoreId(null);
    }, 300);
  }, [onRestore]);

  const handleDelete = useCallback((id: string) => {
    const next = snapshots.filter(s => s.id !== id);
    setSnapshots(next);
    saveSnapshots(projectId, next);
    setConfirmDeleteId(null);
  }, [snapshots, projectId]);

  const handleClearAll = useCallback(() => {
    setSnapshots([]);
    saveSnapshots(projectId, []);
  }, [projectId]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 480,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        width: 420,
        maxWidth: 'calc(100vw - 48px)',
        maxHeight: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Camera size={15} style={{ color: 'var(--accent)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                Canvas Snapshots
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                Save and restore named checkpoints of your design
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Save new snapshot */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {naming ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') { setNaming(false); setNewName(''); }
                }}
                placeholder="Snapshot name…"
                style={{
                  flex: 1, height: 30, background: 'var(--input-bg)',
                  border: '1px solid var(--accent)', borderRadius: 6,
                  padding: '0 8px', fontSize: 12, color: 'var(--text)', outline: 'none',
                }}
              />
              <button
                onClick={handleSave}
                style={{
                  height: 30, padding: '0 12px', background: 'var(--accent)', border: 'none',
                  borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Save
              </button>
              <button
                onClick={() => { setNaming(false); setNewName(''); }}
                style={{
                  height: 30, padding: '0 10px', background: 'var(--panel-alt)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--muted)', fontSize: 11, cursor: 'pointer', flexShrink: 0,
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setNaming(true)}
                style={{
                  flex: 1, height: 32, background: 'var(--accent)', border: 'none',
                  borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <Camera size={13} />
                Save current state
              </button>
              {shapes.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {shapes.length} shape{shapes.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Snapshot list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {snapshots.length === 0 ? (
            <div style={{
              padding: '32px 20px', textAlign: 'center',
              color: 'var(--subtle)', fontSize: 12,
            }}>
              <Camera size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No snapshots yet</div>
              <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                Save a snapshot to preserve your current design state.
                You can restore it anytime.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {snapshots.map((snap) => {
                const isRestoring = restoreId === snap.id;
                const confirmingDelete = confirmDeleteId === snap.id;
                return (
                  <div
                    key={snap.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isRestoring ? 'rgba(99,102,241,0.08)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!isRestoring) (e.currentTarget as HTMLElement).style.background = 'var(--panel-alt)';
                    }}
                    onMouseLeave={e => {
                      if (!isRestoring) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                      background: 'var(--panel-alt)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Camera size={13} style={{ color: 'var(--accent)', opacity: 0.8 }} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {snap.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Clock size={9} style={{ color: 'var(--subtle)' }} />
                        <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
                          {formatRelativeTime(snap.timestamp)}
                        </span>
                        <ShapeCountBadge count={snap.shapes.length} />
                      </div>
                    </div>

                    {/* Actions */}
                    {confirmingDelete ? (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => handleDelete(snap.id)}
                          style={{
                            height: 24, padding: '0 8px', background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5,
                            color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            height: 24, padding: '0 8px', background: 'var(--panel-alt)',
                            border: '1px solid var(--border)', borderRadius: 5,
                            color: 'var(--muted)', fontSize: 10, cursor: 'pointer',
                          }}
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => handleRestore(snap)}
                          title="Restore this snapshot"
                          style={{
                            height: 26, padding: '0 10px',
                            background: isRestoring ? 'var(--accent)' : 'var(--panel-alt)',
                            border: `1px solid ${isRestoring ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 5, color: isRestoring ? '#fff' : 'var(--muted)',
                            fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            if (!isRestoring) {
                              e.currentTarget.style.borderColor = 'var(--accent)';
                              e.currentTarget.style.color = 'var(--accent)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isRestoring) {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.color = 'var(--muted)';
                            }
                          }}
                        >
                          <RotateCcw size={10} />
                          {isRestoring ? 'Restoring…' : 'Restore'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(snap.id)}
                          title="Delete snapshot"
                          style={{
                            height: 26, width: 26, background: 'none', border: 'none',
                            borderRadius: 5, cursor: 'pointer', color: 'var(--subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--subtle)'; e.currentTarget.style.background = 'none'; }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {snapshots.length > 0 && (
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
              {snapshots.length} / 20 snapshots saved
            </span>
            <button
              onClick={handleClearAll}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 10, color: 'var(--subtle)', padding: '2px 6px',
                borderRadius: 4,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--subtle)'; }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
