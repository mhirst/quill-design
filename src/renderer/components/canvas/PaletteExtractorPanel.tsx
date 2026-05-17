/**
 * PaletteExtractorPanel — Extract, name, and export all colors from the design.
 *
 * Scans all shapes and extracts unique fill/stroke/text colors. Groups similar
 * colors, lets you rename each swatch, then exports as CSS variables, Tailwind
 * config, SCSS, JSON, or design tokens.
 *
 * Shortcut: ⌘⇧⌥E
 */

import React, { useMemo, useState, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Color utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    return [parseInt(clean.slice(0,2), 16), parseInt(clean.slice(2,4), 16), parseInt(clean.slice(4,6), 16)];
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a); const rb = hexToRgb(b);
  if (!ra || !rb) return 999;
  return Math.sqrt((ra[0]-rb[0])**2 + (ra[1]-rb[1])**2 + (ra[2]-rb[2])**2);
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{3,6}$/.test(s);
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastOnWhite(hex: string): number {
  const l = luminance(hex);
  return (1 + 0.05) / (l + 0.05);
}

function autoName(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'color';
  const [h, s, l] = rgbToHsl(...rgb);

  if (s < 8) {
    if (l > 90) return 'white';
    if (l > 70) return 'light-gray';
    if (l > 40) return 'gray';
    if (l > 15) return 'dark-gray';
    return 'black';
  }
  const hue = h;
  let name = 'color';
  if (hue < 15 || hue >= 345) name = 'red';
  else if (hue < 45) name = 'orange';
  else if (hue < 65) name = 'yellow';
  else if (hue < 150) name = 'green';
  else if (hue < 195) name = 'cyan';
  else if (hue < 255) name = 'blue';
  else if (hue < 285) name = 'indigo';
  else if (hue < 320) name = 'purple';
  else name = 'pink';

  if (l > 75) return `light-${name}`;
  if (l < 25) return `dark-${name}`;
  return name;
}

// ─── Extract colors from shapes ───────────────────────────────────────────────

interface SwatchEntry {
  hex: string;
  name: string;
  count: number;
  shapes: string[]; // shape ids
  sources: ('fill' | 'stroke' | 'text' | 'gradient')[];
}

function extractColors(shapes: Shape[]): SwatchEntry[] {
  const map = new Map<string, SwatchEntry>();

  const add = (hex: string, shapeId: string, source: SwatchEntry['sources'][number]) => {
    if (!isValidHex(hex) || hex === '#000000' && source === 'stroke') return;
    const key = hex.toLowerCase();
    if (map.has(key)) {
      const e = map.get(key)!;
      e.count++;
      if (!e.shapes.includes(shapeId)) e.shapes.push(shapeId);
      if (!e.sources.includes(source)) e.sources.push(source);
    } else {
      map.set(key, { hex: key, name: autoName(key), count: 1, shapes: [shapeId], sources: [source] });
    }
  };

  for (const s of shapes) {
    if (s.fill && s.fill !== 'transparent' && isValidHex(s.fill)) {
      add(s.fill, s.id, 'fill');
    }
    if (s.gradientStops) {
      for (const stop of s.gradientStops) {
        if (isValidHex(stop.color)) add(stop.color, s.id, 'gradient');
      }
    }
    if (s.stroke && s.stroke !== 'transparent' && isValidHex(s.stroke)) {
      add(s.stroke, s.id, 'stroke');
    }
    if (s.color && isValidHex(s.color)) {
      add(s.color, s.id, 'text');
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const [ah, as_, al] = rgbToHsl(...(hexToRgb(a.hex) ?? [0, 0, 0]));
    const [bh, bs, bl] = rgbToHsl(...(hexToRgb(b.hex) ?? [0, 0, 0]));
    if (Math.abs(ah - bh) > 15) return ah - bh;
    return al - bl;
  });
}

// ─── Export formats ───────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function exportCSSVars(swatches: SwatchEntry[]): string {
  return `:root {\n${swatches.map(s => `  --color-${toSlug(s.name)}: ${s.hex};`).join('\n')}\n}`;
}

function exportSCSS(swatches: SwatchEntry[]): string {
  return swatches.map(s => `$color-${toSlug(s.name)}: ${s.hex};`).join('\n');
}

function exportTailwind(swatches: SwatchEntry[]): string {
  const entries = swatches.map(s => `      '${toSlug(s.name)}': '${s.hex}',`).join('\n');
  return `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${entries}\n      },\n    },\n  },\n}`;
}

function exportJSON(swatches: SwatchEntry[]): string {
  return JSON.stringify(
    Object.fromEntries(swatches.map(s => [toSlug(s.name), s.hex])),
    null, 2
  );
}

function exportTokens(swatches: SwatchEntry[]): string {
  const tokens = Object.fromEntries(swatches.map(s => [
    `color.${toSlug(s.name)}`,
    { value: s.hex, type: 'color' }
  ]));
  return JSON.stringify(tokens, null, 2);
}

type ExportFormat = 'css' | 'scss' | 'tailwind' | 'json' | 'tokens';

const FORMAT_LABELS: Record<ExportFormat, string> = {
  css: 'CSS Variables', scss: 'SCSS Variables', tailwind: 'Tailwind Config', json: 'JSON', tokens: 'Design Tokens',
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onSelectShapes: (ids: string[]) => void;
}

export function PaletteExtractorPanel({ open, onClose, shapes, onSelectShapes }: Props) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [editingHex, setEditingHex] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mergeThreshold, setMergeThreshold] = useState(20);

  const rawSwatches = useMemo(() => extractColors(shapes), [shapes]);

  // Merge similar colors
  const swatches = useMemo(() => {
    if (mergeThreshold === 0) return rawSwatches;
    const merged: SwatchEntry[] = [];
    const used = new Set<number>();
    for (let i = 0; i < rawSwatches.length; i++) {
      if (used.has(i)) continue;
      const base = { ...rawSwatches[i], shapes: [...rawSwatches[i].shapes], sources: [...rawSwatches[i].sources] };
      for (let j = i + 1; j < rawSwatches.length; j++) {
        if (used.has(j)) continue;
        if (colorDistance(base.hex, rawSwatches[j].hex) < mergeThreshold) {
          used.add(j);
          base.count += rawSwatches[j].count;
          base.shapes.push(...rawSwatches[j].shapes.filter(id => !base.shapes.includes(id)));
          rawSwatches[j].sources.forEach(s => { if (!base.sources.includes(s)) base.sources.push(s); });
        }
      }
      merged.push(base);
      used.add(i);
    }
    return merged;
  }, [rawSwatches, mergeThreshold]);

  const displaySwatches = swatches.map(s => ({ ...s, name: names[s.hex] ?? s.name }));

  const getExportText = useCallback(() => {
    switch (exportFormat) {
      case 'css': return exportCSSVars(displaySwatches);
      case 'scss': return exportSCSS(displaySwatches);
      case 'tailwind': return exportTailwind(displaySwatches);
      case 'json': return exportJSON(displaySwatches);
      case 'tokens': return exportTokens(displaySwatches);
    }
  }, [displaySwatches, exportFormat]);

  const copyExport = useCallback(() => {
    navigator.clipboard.writeText(getExportText()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [getExportText]);

  const startEdit = (hex: string, currentName: string) => {
    setEditingHex(hex);
    setEditingName(currentName);
  };

  const commitEdit = () => {
    if (editingHex && editingName.trim()) {
      setNames(n => ({ ...n, [editingHex]: editingName.trim() }));
    }
    setEditingHex(null);
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'absolute', top: 48, right: 8, width: 300,
      maxHeight: 'calc(100vh - 120px)',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      zIndex: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>◐</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>Color Extractor</span>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>{displaySwatches.length} colors</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
      </div>

      {/* Controls */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--muted, #888)', flex: 1 }}>Merge similar (distance: {mergeThreshold})</span>
          <input
            type="range" min={0} max={60} value={mergeThreshold}
            onChange={e => setMergeThreshold(Number(e.target.value))}
            style={{ width: 80, accentColor: 'var(--accent, #6366f1)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setShowExport(false); }}
            style={{ flex: 1, padding: '4px', background: !showExport ? 'rgba(99,102,241,0.15)' : 'var(--surface2, #2a2a3a)', border: `1px solid ${!showExport ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`, borderRadius: 5, color: !showExport ? 'var(--accent, #6366f1)' : 'var(--muted, #888)', cursor: 'pointer', fontSize: 11 }}
          >Palette</button>
          <button
            onClick={() => setShowExport(true)}
            style={{ flex: 1, padding: '4px', background: showExport ? 'rgba(99,102,241,0.15)' : 'var(--surface2, #2a2a3a)', border: `1px solid ${showExport ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`, borderRadius: 5, color: showExport ? 'var(--accent, #6366f1)' : 'var(--muted, #888)', cursor: 'pointer', fontSize: 11 }}
          >Export</button>
        </div>
      </div>

      {showExport ? (
        /* ── Export view ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
            {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map(f => (
              <button
                key={f}
                onClick={() => setExportFormat(f)}
                style={{
                  padding: '3px 8px', borderRadius: 10, fontSize: 9, cursor: 'pointer',
                  border: `1px solid ${exportFormat === f ? 'var(--accent, #6366f1)' : 'var(--border, #2d2d3d)'}`,
                  background: exportFormat === f ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: exportFormat === f ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                }}
              >{FORMAT_LABELS[f]}</button>
            ))}
          </div>
          <pre style={{
            flex: 1, margin: 0, padding: 12, overflowY: 'auto',
            fontFamily: 'monospace', fontSize: 10, color: 'var(--text, #e2e8f0)',
            background: 'var(--bg, #161622)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {getExportText()}
          </pre>
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
            <button
              onClick={copyExport}
              style={{
                width: '100%', padding: '7px', background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.3)'}`,
                borderRadius: 6, color: copied ? '#10b981' : 'var(--accent, #6366f1)',
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
              }}
            >
              {copied ? '✓ Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Palette view ── */
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {displaySwatches.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>◐</div>
              <div style={{ fontSize: 12, color: 'var(--muted, #888)' }}>No colors found</div>
              <div style={{ fontSize: 11, color: 'var(--subtle, #444)', marginTop: 4 }}>Add shapes with fill or stroke colors</div>
            </div>
          ) : (
            <div style={{ padding: 8 }}>
              {/* Big swatch grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 12 }}>
                {displaySwatches.map(s => (
                  <div
                    key={s.hex}
                    title={`${s.name}\n${s.hex}\nUsed ${s.count}× in ${s.shapes.length} shape${s.shapes.length !== 1 ? 's' : ''}`}
                    onClick={() => onSelectShapes(s.shapes)}
                    style={{
                      aspectRatio: '1', borderRadius: 6,
                      background: s.hex,
                      cursor: 'pointer',
                      border: '2px solid var(--border, #2d2d3d)',
                      position: 'relative',
                      transition: 'transform 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {s.count > 1 && (
                      <div style={{
                        position: 'absolute', bottom: 2, right: 2,
                        width: 14, height: 14, borderRadius: '50%',
                        background: contrastOnWhite(s.hex) > 4 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                        fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: contrastOnWhite(s.hex) > 4 ? '#fff' : '#000',
                        fontWeight: 700,
                      }}>
                        {s.count}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Detailed list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {displaySwatches.map(s => (
                  <div
                    key={s.hex}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
                      borderRadius: 5, cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => onSelectShapes(s.shapes)}
                  >
                    {/* Color swatch */}
                    <div style={{ width: 28, height: 28, borderRadius: 5, background: s.hex, flexShrink: 0, border: '1px solid var(--border, #2d2d3d)' }} />

                    {/* Name (editable) */}
                    {editingHex === s.hex ? (
                      <input
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingHex(null); }}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        style={{
                          flex: 1, background: 'var(--surface2, #2a2a3a)',
                          border: '1px solid var(--accent, #6366f1)', borderRadius: 4,
                          color: 'var(--text)', fontSize: 11, padding: '2px 6px',
                        }}
                      />
                    ) : (
                      <div
                        style={{ flex: 1, minWidth: 0 }}
                        onClick={e => { e.stopPropagation(); startEdit(s.hex, s.name); }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text, #e2e8f0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontFamily: 'monospace' }}>{s.hex}</div>
                      </div>
                    )}

                    {/* Sources */}
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      {s.sources.map(src => (
                        <span key={src} style={{
                          fontSize: 8, padding: '1px 4px', borderRadius: 3,
                          background: src === 'fill' ? 'rgba(99,102,241,0.2)' : src === 'stroke' ? 'rgba(16,185,129,0.2)' : src === 'text' ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.2)',
                          color: src === 'fill' ? '#6366f1' : src === 'stroke' ? '#10b981' : src === 'text' ? '#f59e0b' : '#8b5cf6',
                        }}>{src}</span>
                      ))}
                    </div>

                    {/* Count */}
                    <span style={{ fontSize: 10, color: 'var(--subtle, #444)', minWidth: 16, textAlign: 'right', flexShrink: 0 }}>
                      ×{s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
