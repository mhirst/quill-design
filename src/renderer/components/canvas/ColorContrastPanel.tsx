/**
 * ColorContrastPanel — WCAG AA/AAA contrast ratio checker.
 *
 * Features:
 *  - Pick foreground and background colors (color picker + hex input)
 *  - Live contrast ratio display with WCAG AA/AAA pass/fail badges
 *  - Normal and large text thresholds
 *  - Auto-extract colors from selected shapes (text color vs fill)
 *  - Suggestions: darker/lighter variants that pass WCAG AA
 *  - Compare against all shapes on canvas for a global audit view
 *
 * Keyboard: ⌘⇧⌥C to toggle
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Color math ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

function contrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return null;
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagLevel(ratio: number | null, large: boolean): 'AAA' | 'AA' | 'FAIL' {
  if (ratio === null) return 'FAIL';
  if (large) {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3) return 'AA';
    return 'FAIL';
  } else {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    return 'FAIL';
  }
}

/** Adjust a hex color toward white or black to reach a target contrast ratio */
function adjustToContrast(fg: string, bg: string, targetRatio: number): string {
  const bgRgb = hexToRgb(bg);
  const fgRgb = hexToRgb(fg);
  if (!bgRgb || !fgRgb) return fg;

  const bgLum = relativeLuminance(bgRgb);
  // Determine if we need to make fg lighter or darker
  const currentRatio = contrastRatio(fg, bg);
  if (currentRatio !== null && currentRatio >= targetRatio) return fg;

  // If bg is dark, make fg lighter; if bg is light, make fg darker
  const goLighter = bgLum < 0.5;
  let r = fgRgb.r;
  let g = fgRgb.g;
  let b = fgRgb.b;

  for (let step = 0; step < 128; step++) {
    if (goLighter) {
      r = Math.min(255, r + 2);
      g = Math.min(255, g + 2);
      b = Math.min(255, b + 2);
    } else {
      r = Math.max(0, r - 2);
      g = Math.max(0, g - 2);
      b = Math.max(0, b - 2);
    }
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    const ratio = contrastRatio(hex, bg);
    if (ratio !== null && ratio >= targetRatio) return hex;
  }

  return goLighter ? '#ffffff' : '#000000';
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuditResult {
  shapeName: string;
  shapeId: string;
  fg: string;
  bg: string;
  ratio: number | null;
  normalLevel: 'AAA' | 'AA' | 'FAIL';
  largeLevel: 'AAA' | 'AA' | 'FAIL';
}

export interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  selectedShape: Shape | null;
}

// ── Level Badge ────────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: 'AAA' | 'AA' | 'FAIL' }) {
  const colors = {
    AAA: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#22c55e' },
    AA: { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)', text: '#fbbf24' },
    FAIL: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#ef4444' },
  }[level];

  return (
    <span style={{
      padding: '2px 7px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 4,
      color: colors.text,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.04em',
    }}>
      {level}
    </span>
  );
}

// ── Color Picker Input ─────────────────────────────────────────────────────────

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontWeight: 600, letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          value={value.startsWith('#') && value.length >= 7 ? value.slice(0, 7) : '#000000'}
          onChange={e => onChange(e.target.value)}
          style={{ width: 36, height: 36, border: 'none', padding: 0, borderRadius: 6, cursor: 'pointer', background: 'none' }}
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          style={{
            flex: 1, background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            color: 'var(--text, #e2e8f0)', fontSize: 12,
            padding: '4px 8px', borderRadius: 6, fontFamily: 'monospace',
          }}
        />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ColorContrastPanel({ open, onClose, shapes, selectedShape }: Props) {
  const [fg, setFg] = useState('#1e1e2e');
  const [bg, setBg] = useState('#ffffff');
  const [activeTab, setActiveTab] = useState<'checker' | 'audit'>('checker');

  // Auto-fill from selected shape
  useEffect(() => {
    if (!selectedShape) return;
    if (selectedShape.type === 'text' && selectedShape.color) {
      setFg(selectedShape.color.startsWith('#') ? selectedShape.color : '#1e1e2e');
    }
    if (selectedShape.fill && selectedShape.fill.startsWith('#')) {
      setBg(selectedShape.fill.slice(0, 7));
    }
  }, [selectedShape?.id]);

  const ratio = contrastRatio(fg, bg);
  const normalLevel = wcagLevel(ratio, false);
  const largeLevel = wcagLevel(ratio, true);

  const aaFix = adjustToContrast(fg, bg, 4.5);
  const aaaFix = adjustToContrast(fg, bg, 7);
  const aaRatio = contrastRatio(aaFix, bg);
  const aaaRatio = contrastRatio(aaaFix, bg);

  // Canvas-wide audit
  const auditResults: AuditResult[] = shapes
    .filter(s => s.type === 'text' && s.color && s.fill)
    .map(s => {
      const fgColor = s.color ?? '#000000';
      const bgColor = s.fill.startsWith('#') ? s.fill.slice(0, 7) : '#ffffff';
      const r = contrastRatio(fgColor, bgColor);
      return {
        shapeName: s.name || 'Text',
        shapeId: s.id,
        fg: fgColor,
        bg: bgColor,
        ratio: r,
        normalLevel: wcagLevel(r, false),
        largeLevel: wcagLevel(r, true),
      };
    });

  const failCount = auditResults.filter(r => r.normalLevel === 'FAIL').length;
  const passCount = auditResults.length - failCount;

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 300,
      width: 300,
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      zIndex: 40,
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>♿</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>Contrast Checker</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8',
          }}>WCAG</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
        {(['checker', 'audit'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, height: 30, border: 'none', cursor: 'pointer',
            background: activeTab === tab ? 'rgba(99,102,241,0.1)' : 'transparent',
            borderBottom: `2px solid ${activeTab === tab ? 'var(--accent, #6366f1)' : 'transparent'}`,
            color: activeTab === tab ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
            fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
            position: 'relative',
          }}>
            {tab}
            {tab === 'audit' && failCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 8,
                background: '#ef4444', color: 'white',
                fontSize: 8, fontWeight: 700, borderRadius: '50%',
                width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{failCount}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'checker' ? (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Preview */}
          <div style={{
            borderRadius: 8, padding: '16px 12px',
            background: bg, border: '1px solid rgba(255,255,255,0.05)',
            minHeight: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 4,
          }}>
            <div style={{ color: fg, fontSize: 16, fontWeight: 700 }}>
              The quick brown fox
            </div>
            <div style={{ color: fg, fontSize: 12, opacity: 0.85 }}>
              Normal body text • Small size
            </div>
          </div>

          {/* Color pickers */}
          <ColorInput label="FOREGROUND (TEXT)" value={fg} onChange={setFg} />
          <ColorInput label="BACKGROUND" value={bg} onChange={setBg} />

          {/* Contrast ratio */}
          <div style={{
            background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{
                fontSize: 28, fontWeight: 800,
                color: normalLevel === 'FAIL' ? '#ef4444' : normalLevel === 'AA' ? '#fbbf24' : '#22c55e',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}>
                {ratio !== null ? ratio.toFixed(2) : 'N/A'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--muted, #888)' }}>: 1</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Normal</span>
                <LevelBadge level={normalLevel} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Large</span>
                <LevelBadge level={largeLevel} />
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 9, color: 'var(--muted, #888)', lineHeight: 1.5 }}>
              AA requires 4.5:1 (normal) · 3:1 (large)<br />
              AAA requires 7:1 (normal) · 4.5:1 (large)
            </div>
          </div>

          {/* Suggestions */}
          {normalLevel !== 'AAA' && (
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.06em' }}>SUGGESTED FIXES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {normalLevel === 'FAIL' && aaFix !== fg && (
                  <button
                    onClick={() => setFg(aaFix)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px',
                      background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                      borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: aaFix, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>Apply for AA ({aaRatio?.toFixed(1)}:1)</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>{aaFix}</div>
                    </div>
                  </button>
                )}
                {aaaFix !== fg && (
                  <button
                    onClick={() => setFg(aaaFix)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px',
                      background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: aaaFix, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Apply for AAA ({aaaRatio?.toFixed(1)}:1)</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>{aaaFix}</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Swap button */}
          <button
            onClick={() => { const tmp = fg; setFg(bg); setBg(tmp); }}
            style={{
              height: 28, background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 6, cursor: 'pointer', color: 'var(--muted)', fontSize: 11,
            }}
          >
            ⇅ Swap colors
          </button>
        </div>
      ) : (
        /* Audit tab */
        <div style={{ padding: '8px 0', maxHeight: 400, overflowY: 'auto' }}>
          {/* Summary */}
          <div style={{
            margin: '0 10px 8px',
            padding: '8px 10px',
            background: 'var(--bg, #131320)',
            borderRadius: 6,
            display: 'flex', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e', lineHeight: 1 }}>{passCount}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)' }}>passing</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: failCount > 0 ? '#ef4444' : '#22c55e', lineHeight: 1 }}>{failCount}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)' }}>failing</div>
            </div>
            <div style={{ flex: 1, textAlign: 'right', fontSize: 9, color: 'var(--muted)', alignSelf: 'flex-end' }}>
              {auditResults.length} text layers
            </div>
          </div>

          {auditResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted, #888)', fontSize: 11 }}>
              No text shapes found on canvas
            </div>
          ) : (
            auditResults.map(res => (
              <div
                key={res.shapeId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
              >
                {/* Color swatch pair */}
                <div style={{ position: 'relative', width: 24, height: 24, flexShrink: 0 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: res.bg, border: '1px solid rgba(255,255,255,0.1)' }} />
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 12, height: 12, borderRadius: '50%',
                    background: res.fg, border: '1.5px solid var(--panel)',
                  }} />
                </div>

                {/* Name + ratio */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {res.shapeName}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {res.ratio !== null ? `${res.ratio.toFixed(2)}:1` : 'N/A'}
                  </div>
                </div>

                {/* Level badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <LevelBadge level={res.normalLevel} />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
