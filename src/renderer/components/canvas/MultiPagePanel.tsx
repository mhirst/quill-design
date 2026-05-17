/**
 * MultiPagePanel — Multi-page canvas document manager
 *
 * Features:
 *  - Create/rename/reorder/delete pages
 *  - Thumbnail preview of each page's shapes (SVG minimap)
 *  - Navigate between pages (selecting page replaces canvas state)
 *  - Duplicate page (copies all shapes)
 *  - Export all pages as a spec HTML document with one section per page
 *  - Keyboard: ⌘⌥[ and ⌘⌥] to cycle pages
 *  - Shows current page indicator
 */

import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageDef {
  id: string;
  name: string;
  shapes: Shape[];
  createdAt: number;
  updatedAt: number;
}

// ── Utility exports (tested separately) ──────────────────────────────────────

/** Generate a unique page ID */
export function pageId(): string {
  return 'page-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

/** Create a new empty page */
export function createPage(name: string): PageDef {
  const now = Date.now();
  return { id: pageId(), name, shapes: [], createdAt: now, updatedAt: now };
}

/** Rename a page */
export function renamePage(pages: PageDef[], id: string, newName: string): PageDef[] {
  return pages.map(p => p.id === id ? { ...p, name: newName, updatedAt: Date.now() } : p);
}

/** Duplicate a page */
export function duplicatePage(page: PageDef, newName?: string): PageDef {
  const now = Date.now();
  return {
    ...page,
    id: pageId(),
    name: newName ?? `${page.name} (copy)`,
    shapes: page.shapes.map(s => ({ ...s })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Move a page in the pages array */
export function movePage(pages: PageDef[], id: string, direction: 'left' | 'right'): PageDef[] {
  const idx = pages.findIndex(p => p.id === id);
  if (idx === -1) return pages;
  const newPages = [...pages];
  if (direction === 'left' && idx > 0) {
    [newPages[idx], newPages[idx - 1]] = [newPages[idx - 1], newPages[idx]];
  } else if (direction === 'right' && idx < pages.length - 1) {
    [newPages[idx], newPages[idx + 1]] = [newPages[idx + 1], newPages[idx]];
  }
  return newPages;
}

/** Delete a page and return the new active page index */
export function deletePage(pages: PageDef[], id: string, activeId: string): { pages: PageDef[]; newActiveId: string } {
  if (pages.length <= 1) return { pages, newActiveId: activeId };
  const idx = pages.findIndex(p => p.id === id);
  const filtered = pages.filter(p => p.id !== id);
  const newActiveIdx = Math.min(idx, filtered.length - 1);
  const newActiveId = id === activeId ? filtered[newActiveIdx].id : activeId;
  return { pages: filtered, newActiveId };
}

/** Export all pages as an HTML spec document */
export function exportPagesHTML(pages: PageDef[], title: string): string {
  const pagesSections = pages.map((page, i) => {
    const shapeRows = page.shapes.map(s => `
      <tr>
        <td>${s.name || s.type}</td>
        <td>${s.type}</td>
        <td>${Math.round(s.x)}, ${Math.round(s.y)}</td>
        <td>${Math.round(s.width)} × ${Math.round(s.height)}</td>
        <td style="background:${s.fill || '#ccc'};width:20px;">&nbsp;</td>
      </tr>`).join('');
    return `
    <section style="page-break-before:${i > 0 ? 'always' : 'auto'};margin-bottom:40px">
      <h2 style="color:#b5533c;border-bottom:2px solid #b5533c;padding-bottom:8px">
        Page ${i + 1}: ${page.name}
      </h2>
      <p style="color:#666;font-size:13px">${page.shapes.length} shape${page.shapes.length !== 1 ? 's' : ''}</p>
      ${page.shapes.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
        <thead><tr style="background:#f5f5f5">
          <th style="padding:6px 10px;text-align:left">Name</th>
          <th style="padding:6px 10px;text-align:left">Type</th>
          <th style="padding:6px 10px;text-align:left">Position</th>
          <th style="padding:6px 10px;text-align:left">Size</th>
          <th style="padding:6px 10px;text-align:left">Fill</th>
        </tr></thead>
        <tbody>${shapeRows}</tbody>
      </table>` : '<p style="color:#999;font-style:italic">Empty page</p>'}
    </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 24px; color: #333; }
  table td { padding: 5px 10px; border-bottom: 1px solid #eee; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .meta { color: #999; font-size: 13px; margin-bottom: 32px; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Generated ${new Date().toLocaleString()} · ${pages.length} page${pages.length !== 1 ? 's' : ''}</div>
  ${pagesSections}
</body>
</html>`;
}

/** Get shape count stats per page */
export function pageStats(pages: PageDef[]): Array<{ id: string; count: number; types: string[] }> {
  return pages.map(p => ({
    id: p.id,
    count: p.shapes.length,
    types: [...new Set(p.shapes.map(s => s.type))],
  }));
}

// ── Mini shape renderer ───────────────────────────────────────────────────────

function PageThumbnail({ shapes, selected }: { shapes: Shape[]; selected: boolean }) {
  const W = 100;
  const H = 64;

  if (shapes.length === 0) {
    return (
      <div style={{
        width: W,
        height: H,
        background: '#0d0505',
        border: `1.5px solid ${selected ? '#b5533c' : '#3a1a1a'}`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#5a3a3a',
        fontSize: 11,
        flexShrink: 0,
      }}>
        empty
      </div>
    );
  }

  // Compute bounding box
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
  }
  const cw = Math.max(maxX - minX, 1);
  const ch = Math.max(maxY - minY, 1);
  const scale = Math.min(W / cw, H / ch) * 0.85;
  const offsetX = (W - cw * scale) / 2 - minX * scale;
  const offsetY = (H - ch * scale) / 2 - minY * scale;

  return (
    <div style={{
      width: W,
      height: H,
      border: `1.5px solid ${selected ? '#b5533c' : '#3a1a1a'}`,
      borderRadius: 4,
      overflow: 'hidden',
      background: '#0d0505',
      flexShrink: 0,
    }}>
      <svg width={W} height={H}>
        {shapes.map(s => {
          const x = s.x * scale + offsetX;
          const y = s.y * scale + offsetY;
          const w = Math.max(s.width * scale, 1);
          const h = Math.max(s.height * scale, 1);
          const rx = Math.min(
            (Array.isArray(s.borderRadius) ? s.borderRadius[0] : (s.borderRadius ?? 0)) * scale,
            Math.min(w, h) / 2
          );
          return (
            <rect
              key={s.id}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={rx}
              fill={s.fill || '#888'}
              opacity={s.opacity ?? 1}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 380,
  width: 380,
  maxHeight: 'calc(100vh - 80px)',
  background: '#1a0a0a',
  border: '1px solid #3a1a1a',
  borderRadius: 12,
  boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 600,
  fontFamily: 'system-ui, sans-serif',
  color: '#e8d5d5',
  overflow: 'hidden',
};

const BTN_SM: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #3a1a1a',
  background: '#2a1010',
  color: '#e8d5d5',
  fontSize: 12,
  cursor: 'pointer',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  /** The current canvas shapes — used to save onto the active page */
  currentShapes: Shape[];
  onPageChange: (page: PageDef) => void;
}

export function MultiPagePanel({ open, onClose, currentShapes, onPageChange }: Props) {
  const [pages, setPages] = useState<PageDef[]>(() => [createPage('Page 1')]);
  const [activeId, setActiveId] = useState<string>(() => pages[0].id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [exported, setExported] = useState(false);

  // Sync current shapes into active page whenever open
  const syncCurrentPage = () => {
    setPages(prev => prev.map(p =>
      p.id === activeId ? { ...p, shapes: currentShapes, updatedAt: Date.now() } : p
    ));
  };

  const addPage = () => {
    syncCurrentPage();
    const newPage = createPage(`Page ${pages.length + 1}`);
    setPages(prev => [...prev, newPage]);
    setActiveId(newPage.id);
    onPageChange(newPage);
  };

  const switchPage = (id: string) => {
    // Save current shapes to current page
    syncCurrentPage();
    setActiveId(id);
    const target = pages.find(p => p.id === id);
    if (target) onPageChange(target);
  };

  const handleDuplicate = (id: string) => {
    const source = pages.find(p => p.id === id);
    if (!source) return;
    const dup = duplicatePage(source);
    setPages(prev => {
      const idx = prev.findIndex(p => p.id === id);
      const arr = [...prev];
      arr.splice(idx + 1, 0, dup);
      return arr;
    });
  };

  const handleDelete = (id: string) => {
    const result = deletePage(pages, id, activeId);
    setPages(result.pages);
    if (result.newActiveId !== activeId) {
      setActiveId(result.newActiveId);
      const target = result.pages.find(p => p.id === result.newActiveId);
      if (target) onPageChange(target);
    }
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const commitEdit = () => {
    if (!editingId) return;
    setPages(prev => renamePage(prev, editingId, editName.trim() || 'Untitled'));
    setEditingId(null);
  };

  const handleMove = (id: string, dir: 'left' | 'right') => {
    setPages(prev => movePage(prev, id, dir));
  };

  const handleExport = () => {
    // Save current first
    const withCurrent = pages.map(p =>
      p.id === activeId ? { ...p, shapes: currentShapes } : p
    );
    const html = exportPagesHTML(withCurrent, 'Design Document');
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-spec.html';
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 1500);
  };

  const stats = useMemo(() => pageStats(pages), [pages]);
  const activePage = pages.find(p => p.id === activeId);
  const activeIdx = pages.findIndex(p => p.id === activeId);

  if (!open) return null;

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📄</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Pages</span>
          <span style={{
            background: '#3a1a1a',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            color: '#a08080',
          }}>
            {pages.length} · {activeIdx + 1} active
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{ ...BTN_SM, background: exported ? '#1a3a1a' : '#b5533c', border: '1px solid #c5634c' }}
            onClick={handleExport}
          >
            {exported ? '✓ Exported' : '↓ Export HTML'}
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#a08080', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Page grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {pages.map((page, i) => {
          const isActive = page.id === activeId;
          const stat = stats.find(s => s.id === page.id);
          return (
            <div
              key={page.id}
              style={{
                background: isActive ? '#2a1010' : '#1e0e0e',
                border: `1px solid ${isActive ? '#b5533c' : '#3a1a1a'}`,
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 8,
                cursor: 'pointer',
              }}
              onClick={() => switchPage(page.id)}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {/* Thumbnail */}
                <PageThumbnail
                  shapes={isActive ? currentShapes : page.shapes}
                  selected={isActive}
                />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name / edit */}
                  {editingId === page.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        background: '#2a1010',
                        border: '1px solid #b5533c',
                        borderRadius: 4,
                        color: '#e8d5d5',
                        fontSize: 13,
                        padding: '2px 6px',
                        width: '100%',
                        outline: 'none',
                        marginBottom: 4,
                      }}
                    />
                  ) : (
                    <div
                      style={{ fontSize: 13, fontWeight: isActive ? 700 : 400, color: isActive ? '#e8d5d5' : '#c0a0a0', marginBottom: 2 }}
                      onDoubleClick={e => { e.stopPropagation(); startEdit(page.id, page.name); }}
                      title="Double-click to rename"
                    >
                      {i + 1}. {page.name}
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{ fontSize: 10, color: '#a08080' }}>
                    {(isActive ? currentShapes : page.shapes).length} shapes
                    {stat && stat.types.length > 0 && (
                      <span style={{ marginLeft: 6 }}>· {stat.types.join(', ')}</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 5, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                    <button
                      style={{ ...BTN_SM, padding: '2px 6px', fontSize: 10 }}
                      title="Rename"
                      onClick={() => startEdit(page.id, page.name)}
                    >✏</button>
                    <button
                      style={{ ...BTN_SM, padding: '2px 6px', fontSize: 10 }}
                      title="Duplicate"
                      onClick={() => handleDuplicate(page.id)}
                    >⧉</button>
                    <button
                      style={{ ...BTN_SM, padding: '2px 6px', fontSize: 10 }}
                      title="Move left"
                      disabled={i === 0}
                      onClick={() => handleMove(page.id, 'left')}
                    >←</button>
                    <button
                      style={{ ...BTN_SM, padding: '2px 6px', fontSize: 10 }}
                      title="Move right"
                      disabled={i === pages.length - 1}
                      onClick={() => handleMove(page.id, 'right')}
                    >→</button>
                    <button
                      style={{ ...BTN_SM, padding: '2px 6px', fontSize: 10, color: pages.length <= 1 ? '#5a3a3a' : '#ef4444' }}
                      title="Delete"
                      disabled={pages.length <= 1}
                      onClick={() => handleDelete(page.id)}
                    >✕</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add page button */}
        <button
          onClick={addPage}
          style={{
            width: '100%',
            padding: '10px',
            background: 'none',
            border: '1px dashed #3a1a1a',
            borderRadius: 8,
            color: '#a08080',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          Add page
        </button>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #3a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: '#a08080',
        flexShrink: 0,
      }}>
        <span>⌘⌥⇧P to toggle</span>
        <span>Double-click page name to rename</span>
      </div>
    </div>
  );
}
