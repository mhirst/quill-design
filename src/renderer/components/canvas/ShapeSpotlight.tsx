/**
 * ShapeSpotlight — ⌘F floating search overlay.
 * Searches all shapes by name, type, text content, fill color, tag.
 * Arrow keys to navigate, Enter to jump-to + select, Escape to close.
 */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ── helpers ───────────────────────────────────────────────────────────────────

function shapeIcon(type: Shape['type']): string {
  switch (type) {
    case 'frame':     return '⬜';
    case 'rectangle': return '▭';
    case 'ellipse':   return '◯';
    case 'text':      return 'T';
    case 'path':      return '✒';
    default:          return '□';
  }
}

const TYPE_LABELS: Record<Shape['type'], string> = {
  frame: 'Frame', rectangle: 'Rect', ellipse: 'Ellipse', text: 'Text', path: 'Path',
};

function scoreMatch(shape: Shape, q: string): number {
  if (!q) return 1;
  const lq = q.toLowerCase();
  const fields = [
    shape.name.toLowerCase(),
    shape.type.toLowerCase(),
    (shape.text ?? '').toLowerCase(),
    (shape.fill ?? '').toLowerCase(),
    (shape.notes ?? '').toLowerCase(),
  ];
  let score = 0;
  for (const f of fields) {
    if (f === lq) score += 10;
    else if (f.startsWith(lq)) score += 6;
    else if (f.includes(lq)) score += 3;
  }
  return score;
}

function colorSwatch(color: string) {
  if (!color || color === 'transparent') return null;
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: 2,
      background: color, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0,
    }} />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  /** Called when user selects a result — caller should select the shape and pan to it */
  onSelect: (shapeId: string) => void;
}

interface SearchFilter {
  type: Shape['type'] | 'all';
  onlyHidden: boolean;
  onlyLocked: boolean;
}

export function ShapeSpotlight({ open, onClose, shapes, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [filter, setFilter] = useState<SearchFilter>({ type: 'all', onlyHidden: false, onlyLocked: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setFilter({ type: 'all', onlyHidden: false, onlyLocked: false });
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Filtered + ranked results
  const results = useMemo(() => {
    if (!open) return [];
    let list = shapes.filter(s => !s.isMasterComponent); // exclude master components from results
    if (filter.type !== 'all') list = list.filter(s => s.type === filter.type);
    if (filter.onlyHidden) list = list.filter(s => s.hidden);
    if (filter.onlyLocked) list = list.filter(s => s.locked);
    if (!query.trim()) return list.slice(0, 50);
    return list
      .map(s => ({ shape: s, score: scoreMatch(s, query.trim()) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(({ shape }) => shape);
  }, [shapes, query, filter, open]);

  // Clamp activeIdx when results change
  useEffect(() => {
    setActiveIdx(i => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const commit = useCallback((idx: number) => {
    const shape = results[idx];
    if (!shape) return;
    onSelect(shape.id);
    onClose();
  }, [results, onSelect, onClose]);

  // Keyboard handler for the overlay
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter')     { e.preventDefault(); commit(activeIdx); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) setActiveIdx(i => Math.max(i - 1, 0));
      else setActiveIdx(i => Math.min(i + 1, results.length - 1));
    }
  }, [results.length, activeIdx, commit, onClose]);

  if (!open) return null;

  const TYPES: Array<Shape['type'] | 'all'> = ['all', 'frame', 'rectangle', 'ellipse', 'text', 'path'];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 520, maxWidth: 'calc(100vw - 32px)',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--muted)' }}>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Search shapes by name, type, text…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setActiveIdx(0); inputRef.current?.focus(); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', padding: 2, flexShrink: 0,
                display: 'flex', alignItems: 'center', borderRadius: 4,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <span style={{
            fontSize: 10, color: 'var(--subtle)', background: 'var(--panel-alt)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px',
            fontFamily: 'monospace', flexShrink: 0,
          }}>esc</span>
        </div>

        {/* Filters row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '8px 14px 6px',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
        }}>
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => { setFilter(f => ({ ...f, type: t })); setActiveIdx(0); }}
              style={{
                flexShrink: 0,
                background: filter.type === t ? 'var(--accent)' : 'var(--panel-alt)',
                border: `1px solid ${filter.type === t ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 5,
                color: filter.type === t ? '#fff' : 'var(--muted)',
                cursor: 'pointer', fontSize: 10, fontWeight: 600,
                padding: '2px 8px',
                transition: 'all 0.12s',
              }}
            >
              {t === 'all' ? 'All' : TYPE_LABELS[t]}
            </button>
          ))}
          <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
          <button
            onClick={() => { setFilter(f => ({ ...f, onlyHidden: !f.onlyHidden })); setActiveIdx(0); }}
            style={{
              flexShrink: 0,
              background: filter.onlyHidden ? 'rgba(251,191,36,0.15)' : 'var(--panel-alt)',
              border: `1px solid ${filter.onlyHidden ? 'rgba(251,191,36,0.4)' : 'var(--border)'}`,
              borderRadius: 5, color: filter.onlyHidden ? '#fbbf24' : 'var(--muted)',
              cursor: 'pointer', fontSize: 10, fontWeight: 600, padding: '2px 8px',
            }}
          >
            Hidden
          </button>
          <button
            onClick={() => { setFilter(f => ({ ...f, onlyLocked: !f.onlyLocked })); setActiveIdx(0); }}
            style={{
              flexShrink: 0,
              background: filter.onlyLocked ? 'rgba(99,102,241,0.15)' : 'var(--panel-alt)',
              border: `1px solid ${filter.onlyLocked ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
              borderRadius: 5, color: filter.onlyLocked ? '#818cf8' : 'var(--muted)',
              cursor: 'pointer', fontSize: 10, fontWeight: 600, padding: '2px 8px',
            }}
          >
            Locked
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--subtle)', flexShrink: 0 }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{ maxHeight: 340, overflowY: 'auto', padding: '4px 0' }}
        >
          {results.length === 0 ? (
            <div style={{
              padding: '32px 14px', textAlign: 'center',
              color: 'var(--subtle)', fontSize: 12,
            }}>
              {shapes.length === 0 ? 'Canvas is empty — draw some shapes first' : 'No shapes match your search'}
            </div>
          ) : (
            results.map((shape, idx) => {
              const isActive = idx === activeIdx;
              const label = shape.name || `${TYPE_LABELS[shape.type]} ${shape.id.slice(0, 4)}`;
              const textPreview = shape.text ? shape.text.slice(0, 40) + (shape.text.length > 40 ? '…' : '') : null;
              const fillColor = shape.fillType === 'solid' ? shape.fill : null;

              return (
                <div
                  key={shape.id}
                  data-idx={idx}
                  onClick={() => commit(idx)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 14px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--panel-alt)' : 'transparent',
                    borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                    transition: 'background 0.08s',
                  }}
                >
                  {/* Type icon badge */}
                  <span style={{
                    flexShrink: 0, width: 24, height: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? 'rgba(99,102,241,0.15)' : 'var(--panel-alt)',
                    border: '1px solid var(--border)',
                    borderRadius: 6, fontSize: 11, color: isActive ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: 700,
                  }}>
                    {shapeIcon(shape.type)}
                  </span>

                  {/* Name + preview */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600,
                      color: isActive ? 'var(--text)' : 'var(--text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {label}
                    </div>
                    {textPreview && (
                      <div style={{
                        fontSize: 10, color: 'var(--muted)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        marginTop: 1,
                      }}>
                        "{textPreview}"
                      </div>
                    )}
                  </div>

                  {/* Right side: type label + color + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {fillColor && colorSwatch(fillColor)}
                    <span style={{
                      fontSize: 9, fontWeight: 600, letterSpacing: '0.05em',
                      color: 'var(--subtle)', textTransform: 'uppercase',
                    }}>
                      {TYPE_LABELS[shape.type]}
                    </span>
                    {shape.hidden && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 4px',
                        background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                        border: '1px solid rgba(251,191,36,0.3)', borderRadius: 3,
                      }}>HIDDEN</span>
                    )}
                    {shape.locked && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 4px',
                        background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                        border: '1px solid rgba(99,102,241,0.3)', borderRadius: 3,
                      }}>LOCK</span>
                    )}
                    {/* Dimensions */}
                    <span style={{ fontSize: 9, color: 'var(--subtle)', fontFamily: 'monospace' }}>
                      {Math.round(shape.width)}×{Math.round(shape.height)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div style={{
            padding: '6px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
            fontSize: 10, color: 'var(--subtle)',
          }}>
            <span>↑↓ navigate</span>
            <span>↵ jump to &amp; select</span>
            <span>esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
