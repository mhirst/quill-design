/**
 * FindReplacePanel
 * Search text content across all text shapes on the canvas.
 * Supports case-sensitive toggle, regex toggle, and bulk replace.
 * Shortcut: ⌘⇧H (find & replace text)
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { X, Search, Replace, ChevronUp, ChevronDown } from 'lucide-react';
import type { Shape } from '../../lib/shapes';

interface Match {
  shapeId: string;
  shapeName: string;
  text: string;
  matchStart: number;
  matchEnd: number;
  /** Pre, highlight, post segments for display */
  before: string;
  match: string;
  after: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onReplaceOne: (shapeId: string, newText: string) => void;
  onReplaceAll: (patches: { id: string; text: string }[]) => void;
  onSelectShape?: (id: string) => void;
}

export function FindReplacePanel({ open, onClose, shapes, onReplaceOne, onReplaceAll, onSelectShape }: Props) {
  const [query, setQuery] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [replaced, setReplaced] = useState<Set<string>>(new Set());
  const queryRef = useRef<HTMLInputElement>(null);

  // Focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => queryRef.current?.focus(), 50);
      setReplaced(new Set());
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ── Build matches ────────────────────────────────────────────────────────────
  const matches = useMemo<Match[]>(() => {
    if (!query) return [];

    const textShapes = shapes.filter(s => s.type === 'text' && s.text);

    const results: Match[] = [];
    for (const shape of textShapes) {
      const text = shape.text;
      try {
        let rx: RegExp;
        if (useRegex) {
          rx = new RegExp(query, caseSensitive ? 'g' : 'gi');
        } else {
          const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          rx = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
        }

        let m: RegExpExecArray | null;
        while ((m = rx.exec(text)) !== null) {
          const start = m.index;
          const end = start + m[0].length;
          const ctxStart = Math.max(0, start - 20);
          const ctxEnd = Math.min(text.length, end + 30);
          results.push({
            shapeId: shape.id,
            shapeName: shape.name,
            text,
            matchStart: start,
            matchEnd: end,
            before: (ctxStart > 0 ? '…' : '') + text.slice(ctxStart, start),
            match: m[0],
            after: text.slice(end, ctxEnd) + (ctxEnd < text.length ? '…' : ''),
          });
          if (!rx.global) break;
        }
      } catch {
        // invalid regex — skip
      }
    }
    return results;
  }, [query, shapes, caseSensitive, useRegex]);

  // Clamp activeMatchIdx
  useEffect(() => {
    setActiveMatchIdx(0);
    setReplaced(new Set());
  }, [query, matches.length]);

  const activeMatch = matches[activeMatchIdx] ?? null;

  // Navigate matches
  const prevMatch = useCallback(() => {
    setActiveMatchIdx(i => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const nextMatch = useCallback(() => {
    setActiveMatchIdx(i => (i + 1) % matches.length);
  }, [matches.length]);

  // Keyboard navigation
  const handleQueryKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.shiftKey ? prevMatch() : nextMatch();
    }
  }, [prevMatch, nextMatch]);

  // Select active match shape in canvas
  useEffect(() => {
    if (activeMatch) {
      onSelectShape?.(activeMatch.shapeId);
    }
  }, [activeMatch, onSelectShape]);

  // ── Replace helpers ──────────────────────────────────────────────────────────
  const buildReplaced = useCallback((text: string): string => {
    try {
      let rx: RegExp;
      if (useRegex) {
        rx = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        rx = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
      }
      return text.replace(rx, replaceWith);
    } catch {
      return text;
    }
  }, [query, replaceWith, caseSensitive, useRegex]);

  const replaceOne = useCallback(() => {
    if (!activeMatch) return;
    const shape = shapes.find(s => s.id === activeMatch.shapeId);
    if (!shape) return;
    const newText = buildReplaced(shape.text);
    onReplaceOne(activeMatch.shapeId, newText);
    setReplaced(r => new Set([...r, activeMatch.shapeId + ':' + activeMatchIdx]));
    nextMatch();
  }, [activeMatch, shapes, buildReplaced, onReplaceOne, nextMatch, activeMatchIdx]);

  const replaceAll = useCallback(() => {
    if (!query || matches.length === 0) return;
    // Group by shape — only need to replace each shape once
    const shapeIds = [...new Set(matches.map(m => m.shapeId))];
    const patches = shapeIds.map(id => {
      const shape = shapes.find(s => s.id === id)!;
      return { id, text: buildReplaced(shape.text) };
    });
    onReplaceAll(patches);
    setReplaced(new Set(shapeIds.map((_, i) => i.toString())));
  }, [query, matches, shapes, buildReplaced, onReplaceAll]);

  if (!open) return null;

  const hasQuery = query.length > 0;
  const matchCount = matches.length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        right: 320,
        zIndex: 420,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        width: 340,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          Find &amp; Replace Text
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Find row */}
      <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--panel-alt)',
          border: `1px solid ${hasQuery && matchCount === 0 ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
          borderRadius: 8, padding: '5px 8px',
        }}>
          <Search size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input
            ref={queryRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleQueryKeyDown}
            placeholder="Find text…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
            }}
          />
          {/* Match counter */}
          {hasQuery && (
            <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              {matchCount === 0 ? 'No results' : `${activeMatchIdx + 1}/${matchCount}`}
            </span>
          )}
          {/* Prev / Next */}
          <button
            onClick={prevMatch}
            disabled={matchCount === 0}
            title="Previous match (Shift+Enter)"
            style={{
              background: 'none', border: 'none', cursor: matchCount > 0 ? 'pointer' : 'default',
              color: matchCount > 0 ? 'var(--muted)' : 'var(--subtle)',
              padding: 2, borderRadius: 4, display: 'flex',
            }}
            onMouseEnter={e => { if (matchCount > 0) e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = matchCount > 0 ? 'var(--muted)' : 'var(--subtle)'; }}
          >
            <ChevronUp size={13} />
          </button>
          <button
            onClick={nextMatch}
            disabled={matchCount === 0}
            title="Next match (Enter)"
            style={{
              background: 'none', border: 'none', cursor: matchCount > 0 ? 'pointer' : 'default',
              color: matchCount > 0 ? 'var(--muted)' : 'var(--subtle)',
              padding: 2, borderRadius: 4, display: 'flex',
            }}
            onMouseEnter={e => { if (matchCount > 0) e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = matchCount > 0 ? 'var(--muted)' : 'var(--subtle)'; }}
          >
            <ChevronDown size={13} />
          </button>
        </div>

        {/* Options row */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <ToggleChip active={caseSensitive} onClick={() => setCaseSensitive(v => !v)} label="Aa" title="Case sensitive" />
          <ToggleChip active={useRegex} onClick={() => setUseRegex(v => !v)} label=".*" title="Use regular expression" monospace />
          {hasQuery && matchCount > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--subtle)', lineHeight: '20px' }}>
              {[...new Set(matches.map(m => m.shapeId))].length} layers
            </span>
          )}
        </div>
      </div>

      {/* Replace row */}
      <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--panel-alt)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: '5px 8px',
        }}>
          <Replace size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input
            value={replaceWith}
            onChange={e => setReplaceWith(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') replaceOne(); }}
            placeholder="Replace with…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <ActionBtn
            label="Replace"
            disabled={matchCount === 0}
            onClick={replaceOne}
          />
          <ActionBtn
            label={`Replace all (${[...new Set(matches.map(m => m.shapeId))].length})`}
            disabled={matchCount === 0}
            primary
            onClick={replaceAll}
          />
        </div>
      </div>

      {/* Match list */}
      {hasQuery && matchCount > 0 && (
        <div style={{
          flex: 1, overflowY: 'auto',
          borderTop: '1px solid var(--border)',
          maxHeight: 240,
        }}>
          {matches.map((m, i) => (
            <button
              key={`${m.shapeId}-${m.matchStart}`}
              onClick={() => { setActiveMatchIdx(i); onSelectShape?.(m.shapeId); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 12px', border: 'none',
                background: i === activeMatchIdx ? 'var(--accent-dim)' : 'none',
                borderLeft: `2px solid ${i === activeMatchIdx ? 'var(--accent)' : 'transparent'}`,
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={e => { if (i !== activeMatchIdx) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (i !== activeMatchIdx) e.currentTarget.style.background = 'none'; }}
            >
              {/* Layer name */}
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, opacity: 0.6 }}>T</span>
                {m.shapeName}
              </div>
              {/* Text context with highlighted match */}
              <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5, fontFamily: 'monospace' }}>
                <span style={{ color: 'var(--muted)' }}>{m.before}</span>
                <mark style={{
                  background: i === activeMatchIdx ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.15)',
                  color: 'var(--text)',
                  borderRadius: 2,
                  padding: '0 1px',
                }}>
                  {m.match}
                </mark>
                <span style={{ color: 'var(--muted)' }}>{m.after}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {hasQuery && matchCount === 0 && (
        <div style={{
          padding: '16px 12px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center', fontSize: 11, color: 'var(--subtle)',
        }}>
          No text matches found
        </div>
      )}

      {!hasQuery && (
        <div style={{
          padding: '12px', borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--subtle)',
        }}>
          Searches all <strong style={{ color: 'var(--muted)' }}>text</strong> layers on the canvas ·{' '}
          Press <kbd style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', borderRadius: 3, padding: '0 4px', fontFamily: 'monospace', fontSize: 9 }}>Enter</kbd> to jump between matches
        </div>
      )}
    </div>
  );
}

function ToggleChip({ active, onClick, label, title, monospace }: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
  monospace?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'rgba(99,102,241,0.15)' : 'var(--panel-alt)',
        border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
        color: active ? 'var(--accent)' : 'var(--muted)',
        borderRadius: 5,
        padding: '2px 7px',
        fontSize: 11,
        fontFamily: monospace ? 'monospace' : 'inherit',
        fontWeight: 600,
        cursor: 'pointer',
        lineHeight: '16px',
        transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  );
}

function ActionBtn({ label, onClick, disabled, primary }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: primary ? 1 : undefined,
        background: primary
          ? (disabled ? 'rgba(99,102,241,0.2)' : 'var(--accent)')
          : 'var(--panel-alt)',
        border: `1px solid ${primary ? 'transparent' : 'var(--border)'}`,
        color: disabled ? 'var(--subtle)' : (primary ? '#fff' : 'var(--text)'),
        borderRadius: 7,
        padding: '5px 10px',
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.1s',
      }}
      onMouseEnter={e => { if (!disabled && !primary) e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
      onMouseLeave={e => { if (!disabled && !primary) e.currentTarget.style.background = 'var(--panel-alt)'; }}
    >
      {label}
    </button>
  );
}
