/**
 * CustomFontsPanel — Import local font files (TTF, OTF, WOFF, WOFF2) and
 * make them available in the font picker.
 *
 * Uses the FontFace API to register fonts in the browser context so they
 * render live on the canvas. The font list is persisted to localStorage
 * so imported fonts survive app restarts (for the data URI path).
 *
 * Open via: ⌘⇧F  or  Command Palette → "Import fonts"
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, Trash2, CheckCircle, AlertCircle, Type } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomFont {
  id: string;
  family: string;           // CSS font-family name (user can edit)
  fileName: string;
  mimeType: string;
  dataUri: string;          // base64 data URI — for re-loading on restart
  loadedAt: number;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'quill_custom_fonts_v1';

export function loadStoredFonts(): CustomFont[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomFont[]) : [];
  } catch {
    return [];
  }
}

function saveFontsToStorage(fonts: CustomFont[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fonts));
  } catch {
    // Quota exceeded — silently ignore
  }
}

// ── Font registration via FontFace API ────────────────────────────────────────

const registeredFamilies = new Set<string>();

export function registerFont(font: CustomFont): Promise<void> {
  if (registeredFamilies.has(font.family)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    try {
      const ff = new FontFace(font.family, `url(${font.dataUri})`);
      ff.load().then((loaded) => {
        (document.fonts as FontFaceSet).add(loaded);
        registeredFamilies.add(font.family);
        resolve();
      }).catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

export async function registerAllStoredFonts(): Promise<void> {
  const fonts = loadStoredFonts();
  await Promise.allSettled(fonts.map(registerFont));
}

// ── File → data URI helper ────────────────────────────────────────────────────

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function guessFamilyName(fileName: string): string {
  return fileName
    .replace(/\.(ttf|otf|woff2?)/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

const ALLOWED_TYPES = ['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/x-font-ttf', 'application/x-font-opentype', 'application/font-woff', 'application/font-woff2'];
const ALLOWED_EXTS = /\.(ttf|otf|woff|woff2)$/i;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  fonts: CustomFont[];
  onFontsChange: (fonts: CustomFont[]) => void;
}

type FontStatus = 'loading' | 'ready' | 'error';

export function CustomFontsPanel({ open, onClose, fonts, onFontsChange }: Props) {
  const [statuses, setStatuses] = useState<Record<string, FontStatus>>({});
  const [dragging, setDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-register fonts on open (they may have been registered already, but this is a no-op if so)
  useEffect(() => {
    if (!open) return;
    fonts.forEach(f => {
      registerFont(f)
        .then(() => setStatuses(s => ({ ...s, [f.id]: 'ready' })))
        .catch(() => setStatuses(s => ({ ...s, [f.id]: 'error' })));
    });
  }, [open, fonts]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid = arr.filter(f => ALLOWED_EXTS.test(f.name) || ALLOWED_TYPES.includes(f.type));
    if (valid.length === 0) return;

    const newFonts: CustomFont[] = [];
    for (const file of valid) {
      const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const family = guessFamilyName(file.name);
      const dataUri = await fileToDataUri(file);
      const font: CustomFont = {
        id,
        family,
        fileName: file.name,
        mimeType: file.type || 'font/ttf',
        dataUri,
        loadedAt: Date.now(),
      };
      newFonts.push(font);
      setStatuses(s => ({ ...s, [id]: 'loading' }));

      registerFont(font)
        .then(() => setStatuses(s => ({ ...s, [id]: 'ready' })))
        .catch(() => setStatuses(s => ({ ...s, [id]: 'error' })));
    }

    const updated = [...fonts, ...newFonts];
    onFontsChange(updated);
    saveFontsToStorage(updated);
  }, [fonts, onFontsChange]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  }, [processFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleDelete = useCallback((id: string) => {
    const updated = fonts.filter(f => f.id !== id);
    onFontsChange(updated);
    saveFontsToStorage(updated);
    setStatuses(s => { const n = { ...s }; delete n[id]; return n; });
  }, [fonts, onFontsChange]);

  const startRename = useCallback((font: CustomFont) => {
    setEditingId(font.id);
    setEditName(font.family);
  }, []);

  const commitRename = useCallback((id: string) => {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    // Re-register with new family name by forcing re-load
    const font = fonts.find(f => f.id === id);
    if (font && name !== font.family) {
      const updated = fonts.map(f => f.id === id ? { ...f, family: name } : f);
      onFontsChange(updated);
      saveFontsToStorage(updated);
      // Register new family name
      const newFont = { ...font, family: name };
      registerFont(newFont)
        .then(() => setStatuses(s => ({ ...s, [id]: 'ready' })))
        .catch(() => setStatuses(s => ({ ...s, [id]: 'error' })));
    }
    setEditingId(null);
  }, [editName, fonts, onFontsChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 510,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        width: 500, maxWidth: 'calc(100vw - 48px)',
        maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Custom Fonts
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Import TTF, OTF, WOFF, or WOFF2 files · {fonts.length} loaded
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '28px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              background: dragging ? 'rgba(99,102,241,0.06)' : 'var(--panel-alt)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <Upload size={24} color={dragging ? 'var(--accent)' : 'var(--muted)'} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: dragging ? 'var(--accent)' : 'var(--text)' }}>
                Drop font files here
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                or click to browse · TTF, OTF, WOFF, WOFF2
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              multiple
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
          </div>

          {/* Font list */}
          {fonts.length === 0 ? (
            <div style={{
              textAlign: 'center', color: 'var(--subtle)', fontSize: 12,
              padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <Type size={28} color="var(--subtle)" />
              <span>No custom fonts imported yet</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                Imported Fonts
              </div>
              {fonts.map(font => {
                const status = statuses[font.id];
                return (
                  <div
                    key={font.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8,
                      background: 'var(--panel-alt)', border: '1px solid var(--border)',
                    }}
                  >
                    {/* Status icon */}
                    <div style={{ flexShrink: 0 }}>
                      {status === 'loading' && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                          <circle cx="8" cy="8" r="6" stroke="var(--muted)" strokeWidth="2" strokeDasharray="25 10" />
                        </svg>
                      )}
                      {status === 'ready' && <CheckCircle size={16} color="#22c55e" />}
                      {status === 'error' && <AlertCircle size={16} color="#ef4444" />}
                      {!status && <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--border)' }} />}
                    </div>

                    {/* Font info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingId === font.id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onBlur={() => commitRename(font.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitRename(font.id);
                            if (e.key === 'Escape') setEditingId(null);
                            e.stopPropagation();
                          }}
                          style={{
                            background: 'var(--input-bg)', border: '1px solid var(--accent)',
                            borderRadius: 4, color: 'var(--text)', fontSize: 12,
                            padding: '2px 6px', outline: 'none', width: '100%',
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => startRename(font)}
                          title="Click to rename family"
                          style={{ cursor: 'text' }}
                        >
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: 'var(--text)',
                            fontFamily: font.family,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {font.family}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--subtle)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {font.fileName}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Preview text */}
                    {status === 'ready' && editingId !== font.id && (
                      <div style={{
                        fontSize: 14,
                        fontFamily: font.family,
                        color: 'var(--muted)',
                        flexShrink: 0,
                        letterSpacing: '0.02em',
                      }}>
                        Aa
                      </div>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(font.id)}
                      title="Remove font"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--subtle)', padding: 4, borderRadius: 4,
                        display: 'flex', alignItems: 'center', flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--subtle)'; e.currentTarget.style.background = 'none'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--panel)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--subtle)' }}>
            Fonts are saved and reload automatically · Click a name to rename
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 7,
              color: '#fff', cursor: 'pointer', padding: '6px 16px', fontSize: 11, fontWeight: 700,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
