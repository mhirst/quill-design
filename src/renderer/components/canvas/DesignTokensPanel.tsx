/**
 * DesignTokensPanel — Named design token system for Quill.
 *
 * Features:
 * - Create / edit / delete named tokens in categories: Color, Spacing, Radius, Font Size, Shadow, Opacity
 * - Bind tokens to selected shapes (fill, stroke, borderRadius, fontSize, opacity, shadows)
 * - Live preview of bound token values on shapes
 * - Export as: CSS Custom Properties, JSON Design Tokens (W3C format), Tailwind config
 * - Import from JSON
 * - Token search
 * - Reference count per token (how many shapes use it)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { X, Plus, Trash2, Download, Upload, Search, ChevronDown, ChevronRight, Link, Edit3, Copy } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenCategory = 'color' | 'spacing' | 'radius' | 'fontSize' | 'shadow' | 'opacity';

export interface DesignToken {
  id: string;
  name: string;          // e.g. "primary-500"
  category: TokenCategory;
  value: string;         // CSS value: "#6366f1", "16px", "8px", "1rem", "0.8", etc.
  description?: string;
}

export interface TokenBinding {
  shapeId: string;
  property: string;      // "fill" | "stroke" | "borderRadius" | "fontSize" | "opacity"
  tokenId: string;
}

type ExportFormat = 'css' | 'json' | 'tailwind';

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  tokens: DesignToken[];
  bindings: TokenBinding[];
  onTokensChange: (tokens: DesignToken[]) => void;
  onBindingsChange: (bindings: TokenBinding[]) => void;
  onApplyToken: (shapeIds: string[], property: string, value: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<TokenCategory, { label: string; icon: string; placeholder: string; hint: string }> = {
  color:    { label: 'Color',     icon: '●', placeholder: '#6366f1',    hint: 'Hex, rgb(), hsl()' },
  spacing:  { label: 'Spacing',   icon: '↔', placeholder: '16',         hint: 'Number (px)' },
  radius:   { label: 'Radius',    icon: '⌒', placeholder: '8',          hint: 'Number (px)' },
  fontSize: { label: 'Font Size', icon: 'A', placeholder: '16',         hint: 'Number (px)' },
  shadow:   { label: 'Shadow',    icon: '◻', placeholder: '0 2px 8px rgba(0,0,0,0.15)', hint: 'CSS box-shadow' },
  opacity:  { label: 'Opacity',   icon: '◐', placeholder: '1.0',        hint: '0.0 – 1.0' },
};

const BINDABLE_PROPS: Record<TokenCategory, Array<{ key: string; label: string }>> = {
  color:    [{ key: 'fill', label: 'Fill' }, { key: 'stroke', label: 'Stroke' }, { key: 'color', label: 'Text Color' }],
  spacing:  [{ key: 'padding', label: 'Padding' }],
  radius:   [{ key: 'borderRadius', label: 'Border Radius' }],
  fontSize: [{ key: 'fontSize', label: 'Font Size' }],
  shadow:   [],
  opacity:  [{ key: 'opacity', label: 'Opacity' }],
};

const TOKEN_PRESETS: Omit<DesignToken, 'id'>[] = [
  // Colors
  { name: 'primary-50',   category: 'color',    value: '#eef2ff' },
  { name: 'primary-100',  category: 'color',    value: '#e0e7ff' },
  { name: 'primary-200',  category: 'color',    value: '#c7d2fe' },
  { name: 'primary-300',  category: 'color',    value: '#a5b4fc' },
  { name: 'primary-400',  category: 'color',    value: '#818cf8' },
  { name: 'primary-500',  category: 'color',    value: '#6366f1' },
  { name: 'primary-600',  category: 'color',    value: '#4f46e5' },
  { name: 'primary-700',  category: 'color',    value: '#4338ca' },
  { name: 'primary-900',  category: 'color',    value: '#1e1b4b' },
  { name: 'neutral-50',   category: 'color',    value: '#f8fafc' },
  { name: 'neutral-100',  category: 'color',    value: '#f1f5f9' },
  { name: 'neutral-200',  category: 'color',    value: '#e2e8f0' },
  { name: 'neutral-400',  category: 'color',    value: '#94a3b8' },
  { name: 'neutral-600',  category: 'color',    value: '#475569' },
  { name: 'neutral-800',  category: 'color',    value: '#1e293b' },
  { name: 'neutral-900',  category: 'color',    value: '#0f172a' },
  { name: 'success-500',  category: 'color',    value: '#22c55e' },
  { name: 'warning-500',  category: 'color',    value: '#f59e0b' },
  { name: 'error-500',    category: 'color',    value: '#ef4444' },
  { name: 'white',        category: 'color',    value: '#ffffff' },
  { name: 'black',        category: 'color',    value: '#000000' },
  // Spacing (8pt scale)
  { name: 'space-1',  category: 'spacing', value: '4' },
  { name: 'space-2',  category: 'spacing', value: '8' },
  { name: 'space-3',  category: 'spacing', value: '12' },
  { name: 'space-4',  category: 'spacing', value: '16' },
  { name: 'space-5',  category: 'spacing', value: '20' },
  { name: 'space-6',  category: 'spacing', value: '24' },
  { name: 'space-8',  category: 'spacing', value: '32' },
  { name: 'space-10', category: 'spacing', value: '40' },
  { name: 'space-12', category: 'spacing', value: '48' },
  { name: 'space-16', category: 'spacing', value: '64' },
  // Radius
  { name: 'radius-none', category: 'radius', value: '0' },
  { name: 'radius-sm',   category: 'radius', value: '4' },
  { name: 'radius-md',   category: 'radius', value: '8' },
  { name: 'radius-lg',   category: 'radius', value: '12' },
  { name: 'radius-xl',   category: 'radius', value: '16' },
  { name: 'radius-2xl',  category: 'radius', value: '24' },
  { name: 'radius-full', category: 'radius', value: '9999' },
  // Font sizes
  { name: 'text-xs',   category: 'fontSize', value: '12' },
  { name: 'text-sm',   category: 'fontSize', value: '14' },
  { name: 'text-base', category: 'fontSize', value: '16' },
  { name: 'text-lg',   category: 'fontSize', value: '18' },
  { name: 'text-xl',   category: 'fontSize', value: '20' },
  { name: 'text-2xl',  category: 'fontSize', value: '24' },
  { name: 'text-3xl',  category: 'fontSize', value: '30' },
  { name: 'text-4xl',  category: 'fontSize', value: '36' },
  { name: 'text-5xl',  category: 'fontSize', value: '48' },
  // Opacity
  { name: 'opacity-0',   category: 'opacity', value: '0' },
  { name: 'opacity-25',  category: 'opacity', value: '0.25' },
  { name: 'opacity-50',  category: 'opacity', value: '0.5' },
  { name: 'opacity-75',  category: 'opacity', value: '0.75' },
  { name: 'opacity-90',  category: 'opacity', value: '0.9' },
  { name: 'opacity-100', category: 'opacity', value: '1' },
];

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportCSS(tokens: DesignToken[]): string {
  const lines = [':root {'];
  for (const t of tokens) {
    const val = t.category === 'spacing' || t.category === 'radius' || t.category === 'fontSize'
      ? `${t.value}px`
      : t.category === 'opacity'
      ? t.value
      : t.value;
    lines.push(`  --${t.name}: ${val};`);
  }
  lines.push('}');
  return lines.join('\n');
}

function exportJSON(tokens: DesignToken[]): string {
  // W3C Design Tokens format
  const result: Record<string, Record<string, unknown>> = {};
  for (const t of tokens) {
    if (!result[t.category]) result[t.category] = {};
    result[t.category][t.name] = {
      $value: t.value,
      $type: t.category === 'color' ? 'color' : t.category === 'shadow' ? 'shadow' : 'dimension',
      ...(t.description ? { $description: t.description } : {}),
    };
  }
  return JSON.stringify(result, null, 2);
}

function exportTailwind(tokens: DesignToken[]): string {
  const colors: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const borderRadius: Record<string, string> = {};
  const fontSize: Record<string, string> = {};
  const opacity: Record<string, string> = {};

  for (const t of tokens) {
    if (t.category === 'color') colors[t.name] = t.value;
    else if (t.category === 'spacing') spacing[t.name] = `${t.value}px`;
    else if (t.category === 'radius') borderRadius[t.name] = `${t.value}px`;
    else if (t.category === 'fontSize') fontSize[t.name] = `${t.value}px`;
    else if (t.category === 'opacity') opacity[t.name] = t.value;
  }

  const config = {
    theme: {
      extend: {
        colors,
        spacing,
        borderRadius,
        fontSize,
        opacity,
      },
    },
  };

  return `/** @type {import('tailwindcss').Config} */\nmodule.exports = ${JSON.stringify(config, null, 2)}`;
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── TokenRow ─────────────────────────────────────────────────────────────────

function TokenRow({
  token,
  refCount,
  isSelected,
  onEdit,
  onDelete,
  onBind,
  onCopy,
}: {
  token: DesignToken;
  refCount: number;
  isSelected: boolean;
  onEdit: (id: string, field: 'name' | 'value' | 'description', val: string) => void;
  onDelete: (id: string) => void;
  onBind: (token: DesignToken, property: string) => void;
  onCopy: (value: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [editingVal, setEditingVal] = useState(false);
  const [showBindMenu, setShowBindMenu] = useState(false);
  const [tempName, setTempName] = useState(token.name);
  const [tempVal, setTempVal] = useState(token.value);
  const bindableProps = BINDABLE_PROPS[token.category];

  const isColor = token.category === 'color';
  const isPx = token.category === 'spacing' || token.category === 'radius' || token.category === 'fontSize';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
        transition: 'background 0.12s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Color swatch / icon */}
      <div style={{
        width: 20, height: 20, borderRadius: isColor ? 4 : 3, flexShrink: 0,
        background: isColor ? token.value : 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: 'var(--subtle)',
      }}>
        {!isColor && CATEGORY_META[token.category].icon}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingName ? (
          <input
            autoFocus
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            onBlur={() => { onEdit(token.id, 'name', tempName); setEditingName(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onEdit(token.id, 'name', tempName); setEditingName(false); } }}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid #6366f1',
              borderRadius: 4, padding: '1px 4px', fontSize: 12, color: 'var(--text)', outline: 'none',
            }}
          />
        ) : (
          <div
            style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
            onDoubleClick={() => { setTempName(token.name); setEditingName(true); }}
          >
            {token.name}
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{ flexShrink: 0 }}>
        {editingVal ? (
          <input
            autoFocus
            value={tempVal}
            onChange={e => setTempVal(e.target.value)}
            onBlur={() => { onEdit(token.id, 'value', tempVal); setEditingVal(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onEdit(token.id, 'value', tempVal); setEditingVal(false); } }}
            style={{
              width: 90, background: 'rgba(255,255,255,0.06)', border: '1px solid #6366f1',
              borderRadius: 4, padding: '1px 4px', fontSize: 11, color: 'var(--text)', outline: 'none',
            }}
          />
        ) : (
          <div
            style={{ fontSize: 11, color: 'var(--subtle)', fontVariantNumeric: 'tabular-nums', cursor: 'text' }}
            onDoubleClick={() => { setTempVal(token.value); setEditingVal(true); }}
          >
            {token.value}{isPx ? 'px' : ''}
          </div>
        )}
      </div>

      {/* Ref count badge */}
      {refCount > 0 && (
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#6366f1',
          background: 'rgba(99,102,241,0.15)',
          padding: '1px 5px', borderRadius: 100, flexShrink: 0,
        }}>
          {refCount}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => onCopy(isColor ? token.value : isPx ? `${token.value}px` : token.value)}
          style={{ width: 22, height: 22, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Copy value"
        >
          <Copy size={10} />
        </button>

        {bindableProps.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowBindMenu(m => !m)}
              style={{ width: 22, height: 22, borderRadius: 4, background: showBindMenu ? 'rgba(99,102,241,0.2)' : 'transparent', border: 'none', cursor: 'pointer', color: showBindMenu ? '#6366f1' : 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Apply to selection"
            >
              <Link size={10} />
            </button>
            {showBindMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4,
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 8, overflow: 'hidden', zIndex: 100,
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                minWidth: 130,
              }}>
                {bindableProps.map(prop => (
                  <button
                    key={prop.key}
                    onClick={() => { onBind(token, prop.key); setShowBindMenu(false); }}
                    style={{
                      display: 'block', width: '100%', padding: '7px 12px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: 'var(--text)', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Apply as {prop.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onDelete(token.id)}
          style={{ width: 22, height: 22, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Delete token"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function DesignTokensPanel({
  open,
  onClose,
  shapes,
  selectedShape,
  selectedShapeIds,
  tokens,
  bindings,
  onTokensChange,
  onBindingsChange,
  onApplyToken,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<TokenCategory | 'all'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<TokenCategory>>(new Set(['color', 'spacing', 'radius', 'fontSize']));
  const [search, setSearch] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [activeTab, setActiveTab] = useState<'tokens' | 'export'>('tokens');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newToken, setNewToken] = useState<Partial<DesignToken>>({ category: 'color' });
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref counts per token
  const refCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bindings) {
      counts[b.tokenId] = (counts[b.tokenId] || 0) + 1;
    }
    return counts;
  }, [bindings]);

  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.value.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tokens, activeCategory, search]);

  const groupedTokens = useMemo(() => {
    const map: Partial<Record<TokenCategory, DesignToken[]>> = {};
    for (const t of filteredTokens) {
      if (!map[t.category]) map[t.category] = [];
      map[t.category]!.push(t);
    }
    return map;
  }, [filteredTokens]);

  const handleEdit = useCallback((id: string, field: 'name' | 'value' | 'description', val: string) => {
    onTokensChange(tokens.map(t => t.id === id ? { ...t, [field]: val } : t));
  }, [tokens, onTokensChange]);

  const handleDelete = useCallback((id: string) => {
    onTokensChange(tokens.filter(t => t.id !== id));
    onBindingsChange(bindings.filter(b => b.tokenId !== id));
  }, [tokens, bindings, onTokensChange, onBindingsChange]);

  const handleBind = useCallback((token: DesignToken, property: string) => {
    const ids = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShape ? [selectedShape.id] : []);
    if (ids.length === 0) { alert('Select shapes first'); return; }

    const numVal = parseFloat(token.value);
    let applyValue: string | number = token.value;

    if (property === 'borderRadius' || property === 'fontSize') {
      applyValue = isNaN(numVal) ? 0 : numVal;
    } else if (property === 'opacity') {
      applyValue = isNaN(numVal) ? 1 : numVal / 100;
    }

    onApplyToken(ids, property, applyValue as string);

    // Record binding
    const newBindings = bindings.filter(b => !(ids.includes(b.shapeId) && b.property === property));
    const added = ids.map(sid => ({ shapeId: sid, property, tokenId: token.id }));
    onBindingsChange([...newBindings, ...added]);
  }, [selectedShapeIds, selectedShape, bindings, onApplyToken, onBindingsChange]);

  const handleCopy = useCallback((val: string) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopied(val);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const handleAddToken = useCallback(() => {
    if (!newToken.name || !newToken.value || !newToken.category) return;
    const t: DesignToken = {
      id: uid(),
      name: newToken.name,
      category: newToken.category as TokenCategory,
      value: newToken.value,
      description: newToken.description,
    };
    onTokensChange([...tokens, t]);
    setNewToken({ category: newToken.category });
    setShowAddModal(false);
  }, [newToken, tokens, onTokensChange]);

  const handleLoadPresets = useCallback(() => {
    const existing = new Set(tokens.map(t => t.name));
    const toAdd = TOKEN_PRESETS
      .filter(p => !existing.has(p.name))
      .map(p => ({ ...p, id: uid() }));
    onTokensChange([...tokens, ...toAdd]);
  }, [tokens, onTokensChange]);

  const handleExport = useCallback(() => {
    let content = '';
    let filename = '';
    if (exportFormat === 'css') { content = exportCSS(tokens); filename = 'tokens.css'; }
    else if (exportFormat === 'json') { content = exportJSON(tokens); filename = 'tokens.json'; }
    else { content = exportTailwind(tokens); filename = 'tailwind.config.js'; }
    downloadText(content, filename);
  }, [tokens, exportFormat]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const imported: DesignToken[] = [];
        for (const [cat, vals] of Object.entries(raw)) {
          if (typeof vals !== 'object') continue;
          for (const [name, def] of Object.entries(vals as Record<string, { $value?: string; $type?: string }>)) {
            imported.push({
              id: uid(),
              name,
              category: cat as TokenCategory,
              value: def.$value ?? '',
            });
          }
        }
        onTokensChange([...tokens, ...imported]);
      } catch {
        alert('Invalid JSON token file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [tokens, onTokensChange]);

  const toggleCategory = (cat: TokenCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  if (!open) return null;

  const categories = Object.keys(CATEGORY_META) as TokenCategory[];

  return (
    <div
      style={{
        position: 'fixed',
        top: 48,
        left: 56,
        width: 340,
        maxHeight: 'calc(100vh - 64px)',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 300,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>◈</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Design Tokens</span>
          <span style={{ fontSize: 11, color: 'var(--subtle)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 100 }}>
            {tokens.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleLoadPresets}
            style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.06)', color: 'var(--subtle)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
            title="Load default token presets"
          >
            Load Presets
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={11} /> Token
          </button>
          <button
            onClick={onClose}
            style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {(['tokens', 'export'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 0', fontSize: 12, fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? '#6366f1' : 'var(--subtle)',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab === 'tokens' ? 'Tokens' : 'Export'}
          </button>
        ))}
      </div>

      {/* Search (tokens tab) */}
      {activeTab === 'tokens' && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--subtle)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tokens…"
              style={{
                width: '100%', paddingLeft: 26, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                borderRadius: 6, fontSize: 12, color: 'var(--text)', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Category chips */}
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={{
                padding: '2px 8px', borderRadius: 100, fontSize: 11,
                background: activeCategory === 'all' ? '#6366f1' : 'transparent',
                border: activeCategory === 'all' ? 'none' : '1px solid var(--border)',
                color: activeCategory === 'all' ? '#fff' : 'var(--subtle)',
                cursor: 'pointer',
              }}
            >All</button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '2px 8px', borderRadius: 100, fontSize: 11,
                  background: activeCategory === cat ? '#6366f1' : 'transparent',
                  border: activeCategory === cat ? 'none' : '1px solid var(--border)',
                  color: activeCategory === cat ? '#fff' : 'var(--subtle)',
                  cursor: 'pointer',
                }}
              >
                {CATEGORY_META[cat].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Tokens list ── */}
        {activeTab === 'tokens' && (
          <>
            {copied && (
              <div style={{
                padding: '6px 12px', fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.08)',
                borderBottom: '1px solid var(--border)', flexShrink: 0,
              }}>
                ✓ Copied: {copied}
              </div>
            )}

            {Object.keys(groupedTokens).length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--subtle)' }}>
                {tokens.length === 0
                  ? <><div style={{ fontSize: 28, marginBottom: 8 }}>◈</div><div>No tokens yet</div><div style={{ fontSize: 11, marginTop: 4 }}>Click "Load Presets" or "+ Token" to start</div></>
                  : <div>No tokens match your filter</div>
                }
              </div>
            )}

            {(Object.entries(groupedTokens) as [TokenCategory, DesignToken[]][]).map(([cat, catTokens]) => {
              const expanded = expandedCategories.has(cat);
              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCategory(cat)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px', background: 'rgba(255,255,255,0.02)',
                      border: 'none', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', color: 'var(--subtle)',
                    }}
                  >
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                      {CATEGORY_META[cat].label}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--subtle)' }}>({catTokens.length})</span>
                  </button>

                  {expanded && catTokens.map(token => (
                    <TokenRow
                      key={token.id}
                      token={token}
                      refCount={refCounts[token.id] || 0}
                      isSelected={false}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onBind={handleBind}
                      onCopy={handleCopy}
                    />
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* ── Export tab ── */}
        {activeTab === 'export' && (
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--subtle)', marginBottom: 12 }}>
              Export {tokens.length} tokens in your preferred format.
            </div>

            {/* Format picker */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['css', 'json', 'tailwind'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: exportFormat === fmt ? 700 : 400,
                    border: exportFormat === fmt ? '1px solid #6366f1' : '1px solid var(--border)',
                    background: exportFormat === fmt ? 'rgba(99,102,241,0.1)' : 'transparent',
                    color: exportFormat === fmt ? '#a5b4fc' : 'var(--subtle)',
                    cursor: 'pointer',
                  }}
                >
                  {fmt === 'css' ? 'CSS Vars' : fmt === 'json' ? 'JSON (W3C)' : 'Tailwind'}
                </button>
              ))}
            </div>

            {/* Preview */}
            <div style={{
              background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12,
              fontFamily: 'monospace', fontSize: 11, color: '#94a3b8',
              maxHeight: 240, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6,
              border: '1px solid var(--border)', marginBottom: 12,
            }}>
              {exportFormat === 'css' && exportCSS(tokens.slice(0, 8))}
              {exportFormat === 'json' && exportJSON(tokens.slice(0, 5))}
              {exportFormat === 'tailwind' && exportTailwind(tokens.slice(0, 5))}
              {tokens.length > (exportFormat === 'css' ? 8 : 5) && `\n  … ${tokens.length - (exportFormat === 'css' ? 8 : 5)} more tokens`}
            </div>

            <button
              onClick={handleExport}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Download size={14} />
              Export {exportFormat === 'css' ? 'tokens.css' : exportFormat === 'json' ? 'tokens.json' : 'tailwind.config.js'}
            </button>

            {/* Import */}
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'transparent', color: 'var(--subtle)', border: '1px solid var(--border)',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Upload size={11} /> Import JSON tokens
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
            </div>

            {/* Binding summary */}
            {bindings.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Active Bindings ({bindings.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bindings.slice(0, 8).map((b, i) => {
                    const tok = tokens.find(t => t.id === b.tokenId);
                    const shape = shapes.find(s => s.id === b.shapeId);
                    if (!tok || !shape) return null;
                    return (
                      <div key={i} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--subtle)' }}>
                        {tok.category === 'color' && (
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: tok.value, flexShrink: 0 }} />
                        )}
                        <span style={{ color: 'var(--text)' }}>{shape.name || shape.id.slice(0, 8)}</span>
                        <span>.{b.property}</span>
                        <span>→</span>
                        <span style={{ color: '#a5b4fc' }}>{tok.name}</span>
                      </div>
                    );
                  })}
                  {bindings.length > 8 && <div style={{ fontSize: 11, color: 'var(--subtle)' }}>…and {bindings.length - 8} more</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add token modal */}
      {showAddModal && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 20, width: 280,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>New Token</div>

            {[
              { label: 'Name', field: 'name' as const, placeholder: 'e.g. primary-500' },
              { label: 'Value', field: 'value' as const, placeholder: CATEGORY_META[newToken.category as TokenCategory ?? 'color'].placeholder },
              { label: 'Description (optional)', field: 'description' as const, placeholder: 'What is this token for?' },
            ].map(({ label, field, placeholder }) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 4 }}>{label}</div>
                <input
                  value={(newToken[field] as string) ?? ''}
                  onChange={e => setNewToken(t => ({ ...t, [field]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                    color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 4 }}>Category</div>
              <select
                value={newToken.category}
                onChange={e => setNewToken(t => ({ ...t, category: e.target.value as TokenCategory }))}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                  color: 'var(--text)', outline: 'none',
                }}
              >
                {categories.map(cat => <option key={cat} value={cat}>{CATEGORY_META[cat].label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddToken}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                Add Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
