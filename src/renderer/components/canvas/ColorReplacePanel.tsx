/**
 * ColorReplacePanel
 * Find & Replace Colors across all shapes in the document.
 * Opens via command palette ("Replace colors") or Cmd+Shift+R.
 *
 * Features:
 * - Lists all unique colors in the document with shape count
 * - Click a source color to select it for replacement
 * - Pick the replacement color
 * - Preview affected shapes count
 * - Apply replaces fills, strokes, text colors, gradient stops
 */
import React, { useMemo, useState, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onReplaceColor: (fromColor: string, toColor: string) => void;
}

/** Extract all unique color values from a shape (fill, stroke, text, gradient stops) */
function extractShapeColors(s: Shape): string[] {
  const colors = new Set<string>();
  if (s.fill && s.fill !== 'transparent') colors.add(s.fill.slice(0, 7).toLowerCase());
  if (s.stroke && s.stroke !== 'transparent') colors.add(s.stroke.slice(0, 7).toLowerCase());
  if (s.color) colors.add(s.color.slice(0, 7).toLowerCase());
  if (s.gradientStops) {
    for (const stop of s.gradientStops) {
      colors.add(stop.color.slice(0, 7).toLowerCase());
    }
  }
  return [...colors].filter(c => /^#[0-9a-f]{6}$/i.test(c));
}

function luminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return 0;
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function ColorReplacePanel({ open, onClose, shapes, onReplaceColor }: Props) {
  const [fromColor, setFromColor] = useState<string | null>(null);
  const [toColor, setToColor] = useState('#000000');
  const [applied, setApplied] = useState(false);

  // Build color → shape count map
  const colorMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shapes) {
      const colors = extractShapeColors(s);
      for (const c of colors) {
        map.set(c, (map.get(c) ?? 0) + 1);
      }
    }
    // Sort by usage count desc
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [shapes]);

  // Count shapes affected by the current fromColor
  const affectedCount = useMemo(() => {
    if (!fromColor) return 0;
    return shapes.filter(s => extractShapeColors(s).includes(fromColor)).length;
  }, [fromColor, shapes]);

  const handleApply = useCallback(() => {
    if (!fromColor) return;
    onReplaceColor(fromColor, toColor);
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      setFromColor(null);
    }, 1200);
  }, [fromColor, toColor, onReplaceColor]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 510,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        width: 480, maxWidth: 'calc(100vw - 48px)',
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
              Find & Replace Colors
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              {colorMap.length} unique color{colorMap.length !== 1 ? 's' : ''} in document
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1: Choose source color */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              1. Select color to replace
            </div>
            {colorMap.length === 0 ? (
              <div style={{ color: 'var(--subtle)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                No shapes in document
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {colorMap.map(([color, count]) => {
                  const selected = fromColor === color;
                  const textColor = luminance(color) > 0.4 ? '#000' : '#fff';
                  return (
                    <button
                      key={color}
                      onClick={() => { setFromColor(color); if (!fromColor) setToColor(color); }}
                      title={`${color} — used in ${count} shape${count !== 1 ? 's' : ''}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', borderRadius: 8,
                        border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: selected ? 'rgba(99,102,241,0.1)' : 'var(--panel-alt)',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 5, background: color,
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke={textColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text)' }}>{color}</span>
                      <span style={{
                        fontSize: 9, color: 'var(--muted)',
                        background: 'var(--panel)', borderRadius: 3, padding: '1px 5px',
                        border: '1px solid var(--border)',
                      }}>×{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Choose replacement color */}
          {fromColor && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                2. Replace with
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* From swatch */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: fromColor, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
                  <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>{fromColor}</span>
                  <span style={{ fontSize: 9, color: 'var(--subtle)' }}>Original</span>
                </div>

                {/* Arrow */}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                  <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>

                {/* To color picker */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 8, background: toColor,
                      border: '2px solid var(--accent)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      cursor: 'pointer', overflow: 'hidden',
                    }}>
                      <input
                        type="color"
                        value={toColor}
                        onChange={(e) => setToColor(e.target.value)}
                        style={{
                          width: '200%', height: '200%', opacity: 0,
                          position: 'absolute', top: '-50%', left: '-50%',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>{toColor}</span>
                  <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>New color</span>
                </div>

                {/* Quick preset swatches from palette */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginLeft: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--subtle)' }}>Quick</span>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 90 }}>
                    {colorMap.filter(([c]) => c !== fromColor).slice(0, 6).map(([c]) => (
                      <button
                        key={c}
                        onClick={() => setToColor(c)}
                        style={{
                          width: 18, height: 18, borderRadius: 4, background: c,
                          border: toColor === c ? '2px solid var(--accent)' : '1px solid var(--border)',
                          cursor: 'pointer', padding: 0,
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Hex input */}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Hex:</span>
                <input
                  type="text"
                  value={toColor}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setToColor(v);
                  }}
                  style={{
                    background: 'var(--input-bg)', border: '1px solid var(--border)',
                    borderRadius: 5, color: 'var(--text)', fontSize: 11, fontFamily: 'monospace',
                    padding: '4px 8px', outline: 'none', width: 90,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {fromColor && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--panel)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Will update{' '}
              <strong style={{ color: 'var(--text)' }}>{affectedCount}</strong>
              {' '}shape{affectedCount !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setFromColor(null)}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 7,
                  color: 'var(--muted)', cursor: 'pointer', padding: '6px 14px', fontSize: 11,
                }}
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                disabled={!fromColor || toColor === fromColor || applied}
                style={{
                  background: applied ? 'rgba(34,197,94,0.15)' : 'var(--accent)',
                  border: applied ? '1px solid rgba(34,197,94,0.4)' : 'none',
                  borderRadius: 7, color: applied ? '#22c55e' : '#fff',
                  cursor: fromColor && toColor !== fromColor ? 'pointer' : 'default',
                  padding: '6px 16px', fontSize: 11, fontWeight: 700,
                  opacity: (!fromColor || toColor === fromColor) ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {applied ? '✓ Replaced!' : `Replace in ${affectedCount} shape${affectedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
