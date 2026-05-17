/**
 * AssetLibraryPanel — Drag-and-drop image and icon asset management.
 *
 * Features:
 *  - Upload images (drag-over or click-to-browse)
 *  - Displays thumbnails in a masonry-style grid
 *  - Search/filter assets by name
 *  - Click to insert as shape on canvas
 *  - Delete assets from library
 *  - Persistent storage via localStorage (base64 data URLs)
 *  - Collections: "All", "Images", "Icons", "Backgrounds"
 *  - EXIF-free display: shows filename + dimensions
 *  - Recent assets section
 *
 * Keyboard: ⌘⇧⌥L to toggle
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  type: 'image' | 'icon' | 'background';
  addedAt: number;
  tags: string[];
}

export interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (asset: Asset) => void;
}

// ── Storage ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'quill-asset-library';

function loadAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAssets(assets: Asset[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(assets)); } catch { /* ignore */ }
}

function uid() { return Math.random().toString(36).slice(2, 10); }

// Auto-classify asset based on dimensions and name
function classifyAsset(name: string, width: number, height: number): Asset['type'] {
  if (name.toLowerCase().includes('bg') || name.toLowerCase().includes('background') || (width > 1200 && height > 600)) return 'background';
  if (width === height && width < 128) return 'icon';
  return 'image';
}

// ── Drop Zone ──────────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) onFiles(files);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        margin: '8px 10px',
        height: 64,
        border: `2px dashed ${dragging ? 'var(--accent, #6366f1)' : 'var(--border, #2d2d3d)'}`,
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 4,
        cursor: 'pointer',
        background: dragging ? 'rgba(99,102,241,0.05)' : 'transparent',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 18 }}>🖼</span>
      <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>
        {dragging ? 'Drop images here' : 'Drop images or click to browse'}
      </span>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
          if (files.length > 0) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ── Asset Thumbnail ────────────────────────────────────────────────────────────

function AssetThumb({
  asset, onInsert, onDelete,
}: {
  asset: Asset;
  onInsert: (a: Asset) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false); }}
      style={{
        position: 'relative',
        borderRadius: 6,
        overflow: 'hidden',
        border: `1px solid ${hovered ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
        cursor: 'pointer',
        transition: 'border-color 0.12s',
        background: 'var(--bg, #131320)',
        aspectRatio: '1',
      }}
      onClick={() => onInsert(asset)}
    >
      <img
        src={asset.dataUrl}
        alt={asset.name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transition: 'transform 0.12s',
          transform: hovered ? 'scale(1.04)' : 'none',
        }}
      />

      {/* Hover overlay */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(10,10,20,0.7)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4,
        }}>
          <button
            onClick={e => { e.stopPropagation(); onInsert(asset); }}
            style={{
              background: 'var(--accent, #6366f1)',
              border: 'none', borderRadius: 5,
              color: 'white', fontSize: 10, fontWeight: 600,
              padding: '4px 10px', cursor: 'pointer',
            }}
          >
            + Insert
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(asset.id); }}
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 5, color: '#ef4444',
              fontSize: 9, padding: '2px 8px', cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Type badge */}
      <div style={{
        position: 'absolute', bottom: 3, left: 3,
        background: 'rgba(0,0,0,0.7)',
        borderRadius: 3, padding: '1px 4px',
        fontSize: 8, color: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(4px)',
      }}>
        {asset.width}×{asset.height}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type TabId = 'all' | 'image' | 'icon' | 'background';

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '🗃' },
  { id: 'image', label: 'Images', emoji: '🖼' },
  { id: 'icon', label: 'Icons', emoji: '⭐' },
  { id: 'background', label: 'BGs', emoji: '🌄' },
];

export function AssetLibraryPanel({ open, onClose, onInsert }: Props) {
  const [assets, setAssets] = useState<Asset[]>(() => loadAssets());
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  // Persist whenever assets change
  useEffect(() => { saveAssets(assets); }, [assets]);

  const handleFiles = useCallback(async (files: File[]) => {
    setLoading(true);
    const newAssets: Asset[] = [];
    for (const file of files) {
      await new Promise<void>(resolve => {
        const reader = new FileReader();
        reader.onload = ev => {
          const dataUrl = ev.target?.result as string;
          if (!dataUrl) { resolve(); return; }
          const img = new Image();
          img.onload = () => {
            const asset: Asset = {
              id: uid(),
              name: file.name.replace(/\.[^.]+$/, ''),
              dataUrl,
              width: img.naturalWidth,
              height: img.naturalHeight,
              type: classifyAsset(file.name, img.naturalWidth, img.naturalHeight),
              addedAt: Date.now(),
              tags: [],
            };
            newAssets.push(asset);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
    }
    setAssets(prev => [...prev, ...newAssets]);
    setUploadCount(c => c + newAssets.length);
    setLoading(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  const filtered = assets.filter(a => {
    if (activeTab !== 'all' && a.type !== activeTab) return false;
    if (search.trim() && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const recent = [...assets].sort((a, b) => b.addedAt - a.addedAt).slice(0, 4);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      left: 60,
      width: 280,
      maxHeight: '75vh',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      zIndex: 40,
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🗃</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>Asset Library</span>
          {assets.length > 0 && (
            <span style={{
              fontSize: 9, background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#818cf8', padding: '1px 5px', borderRadius: 4, fontWeight: 600,
            }}>
              {assets.length}
            </span>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>✕</button>
      </div>

      {/* Upload zone */}
      <DropZone onFiles={handleFiles} />

      {/* Search */}
      <div style={{ padding: '0 10px 8px', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search assets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            color: 'var(--text, #e2e8f0)', fontSize: 11,
            padding: '5px 8px', borderRadius: 6, outline: 'none',
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '0 10px 8px', flexShrink: 0, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              height: 22, padding: '0 8px',
              background: activeTab === tab.id ? 'rgba(99,102,241,0.2)' : 'transparent',
              border: `1px solid ${activeTab === tab.id ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
              borderRadius: 4, cursor: 'pointer', fontSize: 10,
              color: activeTab === tab.id ? '#818cf8' : 'var(--muted, #888)',
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            <span style={{ fontSize: 10 }}>{tab.emoji}</span>
            {tab.label}
            {tab.id !== 'all' && (
              <span style={{ fontSize: 9, opacity: 0.6 }}>
                ({assets.filter(a => a.type === tab.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--muted, #888)', fontSize: 11 }}>
            Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '20px 0',
            color: 'var(--muted, #888)', fontSize: 11,
          }}>
            {assets.length === 0
              ? 'Drop images above to add them to your library'
              : search
                ? `No assets match "${search}"`
                : `No ${activeTab === 'all' ? '' : activeTab + ' '}assets yet`}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
          }}>
            {filtered.map(asset => (
              <AssetThumb
                key={asset.id}
                asset={asset}
                onInsert={onInsert}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {uploadCount > 0 && (
        <div style={{
          padding: '5px 12px',
          borderTop: '1px solid var(--border, #2d2d3d)',
          fontSize: 9, color: '#22c55e', flexShrink: 0,
        }}>
          ✓ {uploadCount} asset{uploadCount !== 1 ? 's' : ''} added this session
        </div>
      )}
    </div>
  );
}
