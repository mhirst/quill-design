/**
 * ComponentAnalyzerPanel — Detects repeated shape patterns & suggests components
 *
 * Features:
 *  - Fingerprints each shape by type + approximate size + color bucket
 *  - Groups shapes with matching fingerprints as "similar"
 *  - Detects clusters of multiple shapes that repeat spatially
 *  - Suggests component names based on shape combination heuristics
 *  - Shows a similarity score between shape groups
 *  - One-click: "Select all similar" to select matching shapes
 *  - Reports: total unique patterns, duplication rate, potential components
 */

import React, { useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { ShapeTypeIcon } from '../ui/ShapeTypeIcon';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShapeFingerprint {
  shapeId: string;
  typeKey: string;       // shape.type
  sizeKey: string;       // bucketed width×height
  colorKey: string;      // bucketed fill color
  fingerprint: string;   // typeKey|sizeKey|colorKey
}

export interface SimilarGroup {
  fingerprint: string;
  ids: string[];
  count: number;
  suggestedName: string;
  similarity: number; // 0..1
}

// ── Utility exports (tested separately) ──────────────────────────────────────

/** Bucket a number to the nearest multiple of `step` */
export function bucketNumber(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Bucket a hex color to a coarse color key */
export function bucketColor(hex: string): string {
  if (!hex || hex === 'transparent' || hex === 'none') return 'none';
  const h = hex.replace(/^#/, '').padEnd(6, '0').slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Determine dominant channel (hue bucket) and luminance bucket
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminance = (max + min) / 2;
  const lumBucket = luminance < 64 ? 'dark' : luminance < 192 ? 'mid' : 'light';
  if (max - min < 30) return `gray-${lumBucket}`;
  if (max === r) return `red-${lumBucket}`;
  if (max === g) return `green-${lumBucket}`;
  return `blue-${lumBucket}`;
}

/** Build a fingerprint for a single shape */
export function buildFingerprint(shape: Shape): ShapeFingerprint {
  const typeKey = shape.type;
  const wBucket = bucketNumber(shape.width, 20);
  const hBucket = bucketNumber(shape.height, 20);
  const sizeKey = `${wBucket}x${hBucket}`;
  const colorKey = bucketColor(shape.fill || '');
  const fingerprint = `${typeKey}|${sizeKey}|${colorKey}`;
  return { shapeId: shape.id, typeKey, sizeKey, colorKey, fingerprint };
}

/** Suggest a component name based on shape type + color */
export function suggestComponentName(typeKey: string, colorKey: string, count: number): string {
  const typeMap: Record<string, string> = {
    rect: 'Box',
    ellipse: 'Circle',
    text: 'Label',
    frame: 'Frame',
    line: 'Divider',
    arrow: 'Arrow',
    star: 'Star',
    polygon: 'Shape',
    image: 'Image',
  };
  const colorMap: Record<string, string> = {
    'red-mid': 'Primary',
    'red-light': 'Light',
    'red-dark': 'Dark',
    'blue-mid': 'Secondary',
    'blue-light': 'Info',
    'blue-dark': 'Navy',
    'green-mid': 'Success',
    'green-light': 'Mint',
    'gray-dark': 'Dark',
    'gray-mid': 'Muted',
    'gray-light': 'Light',
    'none': '',
  };
  const typeName = typeMap[typeKey] ?? 'Component';
  const colorName = colorMap[colorKey] ?? '';
  const countHint = count >= 5 ? 'Repeated' : '';
  return [countHint, colorName, typeName].filter(Boolean).join('');
}

/** Compute similarity between two shapes (0..1) */
export function shapeSimilarity(a: Shape, b: Shape): number {
  let score = 0;
  if (a.type === b.type) score += 0.3;
  const wDiff = Math.abs(a.width - b.width) / Math.max(a.width, b.width, 1);
  const hDiff = Math.abs(a.height - b.height) / Math.max(a.height, b.height, 1);
  score += (1 - wDiff) * 0.2;
  score += (1 - hDiff) * 0.2;
  if (bucketColor(a.fill || '') === bucketColor(b.fill || '')) score += 0.2;
  const fontA = a.fontFamily ?? '';
  const fontB = b.fontFamily ?? '';
  if (fontA && fontB && fontA === fontB) score += 0.1;
  return Math.min(score, 1);
}

/** Group shapes by fingerprint and return SimilarGroups with 2+ members */
export function findSimilarGroups(shapes: Shape[]): SimilarGroup[] {
  const fingerprints = shapes.map(buildFingerprint);
  const byFp: Record<string, string[]> = {};
  for (const fp of fingerprints) {
    if (!byFp[fp.fingerprint]) byFp[fp.fingerprint] = [];
    byFp[fp.fingerprint].push(fp.shapeId);
  }
  return Object.entries(byFp)
    .filter(([, ids]) => ids.length >= 2)
    .map(([fp, ids]) => {
      const [typeKey, , colorKey] = fp.split('|');
      // Compute pairwise avg similarity
      const shapesInGroup = shapes.filter(s => ids.includes(s.id));
      let totalSim = 0;
      let pairs = 0;
      for (let i = 0; i < shapesInGroup.length; i++) {
        for (let j = i + 1; j < shapesInGroup.length; j++) {
          totalSim += shapeSimilarity(shapesInGroup[i], shapesInGroup[j]);
          pairs++;
        }
      }
      const similarity = pairs > 0 ? totalSim / pairs : 1;
      return {
        fingerprint: fp,
        ids,
        count: ids.length,
        suggestedName: suggestComponentName(typeKey, colorKey, ids.length),
        similarity,
      };
    })
    .sort((a, b) => b.count - a.count);
}

/** Compute duplication rate: fraction of shapes that belong to a group */
export function duplicationRate(shapes: Shape[], groups: SimilarGroup[]): number {
  if (shapes.length === 0) return 0;
  const groupedIds = new Set(groups.flatMap(g => g.ids));
  return groupedIds.size / shapes.length;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 380,
  width: 400,
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

const HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid #3a1a1a',
  flexShrink: 0,
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

const CLOSE_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#a08080',
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
};


// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onSelectShapes?: (ids: string[]) => void;
}

export function ComponentAnalyzerPanel({ open, onClose, shapes, onSelectShapes }: Props) {
  const [expandedFp, setExpandedFp] = useState<string | null>(null);
  const [minCount, setMinCount] = useState(2);

  const groups = useMemo(() => findSimilarGroups(shapes), [shapes]);
  const filteredGroups = useMemo(
    () => groups.filter(g => g.count >= minCount),
    [groups, minCount]
  );
  const dupRate = useMemo(() => duplicationRate(shapes, groups), [shapes, groups]);

  if (!open) return null;

  const uniquePatterns = groups.length;
  const totalComponents = filteredGroups.length;

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🧩</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Component Analyzer</span>
          <span style={{
            background: '#3a1a1a',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            color: '#a08080',
          }}>
            {totalComponents} pattern{totalComponents !== 1 ? 's' : ''}
          </span>
        </div>
        <button style={CLOSE_BTN} onClick={onClose}>✕</button>
      </div>

      {/* Stats bar */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #3a1a1a',
        display: 'flex',
        gap: 16,
        flexShrink: 0,
      }}>
        {[
          { label: 'Total shapes', value: shapes.length },
          { label: 'Unique patterns', value: uniquePatterns },
          { label: 'Duplication', value: `${Math.round(dupRate * 100)}%` },
        ].map(stat => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e8d5d5' }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: '#a08080' }}>{stat.label}</div>
          </div>
        ))}

        {/* Min count filter */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#a08080' }}>Min:</span>
          <select
            value={minCount}
            onChange={e => setMinCount(Number(e.target.value))}
            style={{
              background: '#2a1010',
              border: '1px solid #3a1a1a',
              borderRadius: 6,
              color: '#e8d5d5',
              padding: '3px 6px',
              fontSize: 12,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}×</option>)}
          </select>
        </div>
      </div>

      {/* Groups list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
        {shapes.length === 0 && (
          <div style={{ textAlign: 'center', color: '#a08080', fontSize: 13, padding: '32px 0' }}>
            No shapes on canvas.
          </div>
        )}

        {shapes.length > 0 && filteredGroups.length === 0 && (
          <div style={{ textAlign: 'center', color: '#a08080', fontSize: 13, padding: '24px 0' }}>
            No repeated patterns found (min {minCount}× instances).
          </div>
        )}

        {filteredGroups.map(group => {
          const [typeKey] = group.fingerprint.split('|');
          const isExpanded = expandedFp === group.fingerprint;
          const simPct = Math.round(group.similarity * 100);

          return (
            <div
              key={group.fingerprint}
              style={{
                background: '#1e0e0e',
                border: '1px solid #3a1a1a',
                borderRadius: 8,
                marginBottom: 8,
                overflow: 'hidden',
              }}
            >
              {/* Group header */}
              <div
                onClick={() => setExpandedFp(isExpanded ? null : group.fingerprint)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  cursor: 'pointer',
                }}
              >
                {/* Type icon */}
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: '#3a1a1a',
                  color: '#d4a8a8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <ShapeTypeIcon type={typeKey === 'rect' ? 'rectangle' : typeKey} size={14} />
                </div>

                {/* Name + fingerprint */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e8d5d5' }}>
                    {group.suggestedName || 'Component'}
                  </div>
                  <div style={{ fontSize: 10, color: '#a08080', fontFamily: 'monospace', marginTop: 1 }}>
                    {group.fingerprint}
                  </div>
                </div>

                {/* Count badge */}
                <div style={{
                  background: '#b5533c22',
                  border: '1px solid #b5533c44',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#e8a090',
                  flexShrink: 0,
                }}>
                  ×{group.count}
                </div>

                {/* Similarity */}
                <div style={{ fontSize: 11, color: simPct > 80 ? '#22c55e' : simPct > 60 ? '#f59e0b' : '#ef4444', flexShrink: 0 }}>
                  {simPct}%
                </div>

                <span style={{ color: '#a08080', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Expanded: list of shape IDs + select button */}
              {isExpanded && (
                <div style={{ padding: '0 12px 10px', borderTop: '1px solid #2a1010' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#a08080' }}>Shape instances</span>
                    {onSelectShapes && (
                      <button
                        style={{ ...BTN_SM, background: '#b5533c', border: '1px solid #c5634c', fontSize: 11 }}
                        onClick={() => onSelectShapes(group.ids)}
                      >
                        Select all {group.count}
                      </button>
                    )}
                  </div>
                  {group.ids.map((id, i) => {
                    const shape = shapes.find(s => s.id === id);
                    return (
                      <div key={id} style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: '#c0a0a0',
                        padding: '2px 0',
                        display: 'flex',
                        gap: 8,
                      }}>
                        <span style={{ color: '#a08080' }}>{i + 1}.</span>
                        <span>{shape?.name || id.slice(0, 12)}</span>
                        {shape && (
                          <span style={{ color: '#a08080' }}>
                            ({Math.round(shape.x)}, {Math.round(shape.y)}) {Math.round(shape.width)}×{Math.round(shape.height)}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Suggestion */}
                  <div style={{
                    marginTop: 8,
                    padding: '6px 8px',
                    background: '#0d0505',
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#a08080',
                    fontStyle: 'italic',
                  }}>
                    💡 Consider extracting as a "{group.suggestedName}" component ({group.count} instances)
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
        <span>⌘⌥0 to toggle</span>
        <span>Similarity: type + size (20px) + color bucket</span>
      </div>
    </div>
  );
}
