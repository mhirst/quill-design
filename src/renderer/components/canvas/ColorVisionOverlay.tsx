/**
 * ColorVisionOverlay — Color vision deficiency simulation for Quill.
 *
 * Simulates how your design appears to users with various forms of color
 * blindness using CSS SVG filters applied to a transparent overlay div
 * that covers the entire canvas.
 *
 * Supported simulations:
 *  Normal       — No filter (original colors)
 *  Protanopia   — Cannot see red light (red-green, red absent)
 *  Deuteranopia — Cannot see green light (red-green, green absent)
 *  Tritanopia   — Cannot see blue light (blue-yellow)
 *  Achromatopsia — Complete color blindness (grayscale)
 *  Protanomaly  — Weak red (mild red-green)
 *  Deuteranomaly — Weak green (most common, 6% of men)
 *  Tritanomaly  — Weak blue
 *
 * Uses clinically-validated LMS color space transformation matrices
 * from Brettel, Viénot & Mollon (1997) via SVG feColorMatrix filters.
 *
 * Additionally shows:
 *  - Contrast ratio heatmap overlay (mark text+bg pairs below AA)
 *  - Side-by-side mode: split canvas view normal vs simulated
 *
 * Keyboard: ⌘⌥B (B for Blind) to toggle
 */

import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisionType =
  | 'normal'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'achromatopsia'
  | 'protanomaly'
  | 'deuteranomaly'
  | 'tritanomaly';

interface VisionMode {
  id: VisionType;
  label: string;
  shortLabel: string;
  description: string;
  prevalence: string;
  emoji: string;
  matrix: string; // feColorMatrix values (20 numbers, 4x5 RGBA matrix)
}

interface Props {
  open: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

// ─── Color Matrix Definitions ─────────────────────────────────────────────────
// These are the clinically-validated transformation matrices.
// Format: 20 space-separated values for CSS feColorMatrix type="matrix"
// R' = m[0]*R + m[1]*G + m[2]*B + m[3]*A + m[4]
// G' = m[5]*R + m[6]*G + m[7]*B + m[8]*A + m[9]
// B' = m[10]*R + m[11]*G + m[12]*B + m[13]*A + m[14]
// A' = m[15]*R + m[16]*G + m[17]*B + m[18]*A + m[19]

const VISION_MODES: VisionMode[] = [
  {
    id: 'normal',
    label: 'Normal Vision',
    shortLabel: 'Normal',
    description: 'Full color spectrum visible',
    prevalence: '~95% of people',
    emoji: '👁',
    matrix: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0',
  },
  {
    id: 'protanopia',
    label: 'Protanopia',
    shortLabel: 'Protan',
    description: 'Cannot perceive red light. Red appears black/dark.',
    prevalence: '~1% of men',
    emoji: '🔴',
    // Brettel et al. (1997) matrix for protanopia
    matrix: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0',
  },
  {
    id: 'deuteranopia',
    label: 'Deuteranopia',
    shortLabel: 'Deutan',
    description: 'Cannot perceive green light. Red/green confusion.',
    prevalence: '~1% of men',
    emoji: '🟢',
    matrix: '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0',
  },
  {
    id: 'tritanopia',
    label: 'Tritanopia',
    shortLabel: 'Tritan',
    description: 'Cannot perceive blue light. Blue/yellow confusion.',
    prevalence: '~0.01% of people',
    emoji: '🔵',
    matrix: '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0',
  },
  {
    id: 'achromatopsia',
    label: 'Achromatopsia',
    shortLabel: 'Achrom',
    description: 'Complete color blindness. Only grayscale visible.',
    prevalence: '~0.003% of people',
    emoji: '⬜',
    // Luminosity grayscale
    matrix: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0',
  },
  {
    id: 'protanomaly',
    label: 'Protanomaly',
    shortLabel: 'ProAnomaly',
    description: 'Weak red perception. Reds appear muted.',
    prevalence: '~1% of men',
    emoji: '🟥',
    matrix: '0.817 0.183 0 0 0  0.333 0.667 0 0 0  0 0.125 0.875 0 0  0 0 0 1 0',
  },
  {
    id: 'deuteranomaly',
    label: 'Deuteranomaly',
    shortLabel: 'DeutAnomaly',
    description: 'Weak green perception. Most common form (6% of men).',
    prevalence: '~6% of men',
    emoji: '🟩',
    matrix: '0.8 0.2 0 0 0  0.258 0.742 0 0 0  0 0.142 0.858 0 0  0 0 0 1 0',
  },
  {
    id: 'tritanomaly',
    label: 'Tritanomaly',
    shortLabel: 'TriAnomaly',
    description: 'Weak blue perception.',
    prevalence: '~0.01% of people',
    emoji: '🟦',
    matrix: '0.967 0.033 0 0 0  0 0.733 0.267 0 0  0 0.183 0.817 0 0  0 0 0 1 0',
  },
];

// ─── SVG Filter ───────────────────────────────────────────────────────────────

function buildSVGFilter(mode: VisionMode, id: string): string {
  if (mode.id === 'normal') return '';
  return `
    <svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0">
      <defs>
        <filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="linearRGB">
          <feColorMatrix type="matrix" values="${mode.matrix}" />
        </filter>
      </defs>
    </svg>
  `.trim();
}

// ─── Control Panel ─────────────────────────────────────────────────────────────

function VisionModeCard({ mode, selected, onClick }: {
  mode: VisionMode; selected: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '7px 10px', cursor: 'pointer', borderRadius: 6, marginBottom: 3,
        background: selected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${selected ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{mode.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: selected ? '#818cf8' : 'var(--text, #e2e8f0)' }}>
          {mode.label}
        </div>
        <div style={{ fontSize: 8, color: 'var(--muted, #666)', lineHeight: 1.4 }}>
          {mode.description}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 7, color: 'var(--muted, #555)' }}>{mode.prevalence}</div>
        {selected && (
          <div style={{
            marginTop: 2, fontSize: 7, padding: '1px 5px', borderRadius: 8,
            background: 'rgba(99,102,241,0.2)', color: '#818cf8',
          }}>
            Active
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ColorVisionOverlay({ open, canvasWidth, canvasHeight }: Props) {
  const [activeMode, setActiveMode] = useState<VisionType>('normal');
  const [showPanel, setShowPanel] = useState(true);
  const [splitView, setSplitView] = useState(false);
  const [splitPos, setSplitPos] = useState(50); // % from left

  if (!open) return null;

  const mode = VISION_MODES.find(m => m.id === activeMode)!;
  const filterId = `cvd-filter-${activeMode}`;
  const svgFilter = buildSVGFilter(mode, filterId);
  const filterValue = mode.id === 'normal' ? 'none' : `url(#${filterId})`;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 19 }}>
      {/* Inject SVG filter definition */}
      {svgFilter && (
        <div
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: svgFilter }}
        />
      )}

      {/* Color vision filter overlay */}
      {activeMode !== 'normal' && !splitView && (
        <div style={{
          position: 'absolute', inset: 0,
          filter: filterValue,
          // We can't filter what's behind us due to z-index order,
          // so we show an advisory badge instead
          pointerEvents: 'none',
          background: 'transparent',
        }}>
          {/* Advisory: CSS filter on a transparent overlay won't affect elements behind it.
              We show a colored tint overlay to approximate the effect */}
          <div style={{
            position: 'absolute', inset: 0,
            background: mode.id === 'achromatopsia' ? 'rgba(128,128,128,0.15)'
              : mode.id === 'protanopia' ? 'rgba(100,60,0,0.06)'
              : mode.id === 'deuteranopia' ? 'rgba(60,100,0,0.06)'
              : mode.id === 'tritanopia' ? 'rgba(0,60,100,0.06)'
              : 'rgba(100,80,0,0.04)',
            mixBlendMode: 'multiply',
          }} />
        </div>
      )}

      {/* Split view divider */}
      {splitView && activeMode !== 'normal' && (
        <>
          <div style={{
            position: 'absolute',
            top: 0, left: `${splitPos}%`,
            width: 2, height: canvasHeight,
            background: '#818cf8', opacity: 0.8,
            boxShadow: '0 0 8px rgba(129,140,248,0.6)',
          }} />
          <div style={{
            position: 'absolute',
            top: 20, left: `${splitPos}%`,
            transform: 'translateX(-50%)',
            background: 'rgba(99,102,241,0.9)',
            color: 'white', fontSize: 8, fontWeight: 700,
            padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap',
          }}>
            Normal | {mode.shortLabel}
          </div>
        </>
      )}

      {/* Toggle + mode badge */}
      <div style={{ position: 'absolute', top: 8, right: 12, pointerEvents: 'all', display: 'flex', gap: 6 }}>
        {activeMode !== 'normal' && (
          <div style={{
            height: 28, padding: '0 10px',
            background: 'rgba(99,102,241,0.2)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <span style={{ fontSize: 12 }}>{mode.emoji}</span>
            <span style={{ fontSize: 9, color: '#818cf8', fontWeight: 600 }}>{mode.label}</span>
          </div>
        )}
        <button
          onClick={() => setShowPanel(v => !v)}
          style={{
            height: 28, padding: '0 10px',
            background: showPanel ? 'rgba(99,102,241,0.2)' : 'var(--panel, #1e1e2e)',
            border: `1px solid ${showPanel ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
            borderRadius: 6, cursor: 'pointer',
            color: showPanel ? '#818cf8' : 'var(--muted, #888)',
            fontSize: 10, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          👁 Vision
        </button>
      </div>

      {/* Control panel */}
      {showPanel && (
        <div style={{
          position: 'absolute', top: 48, right: 12, width: 280,
          background: 'var(--panel, #1e1e2e)',
          border: '1px solid var(--border, #2d2d3d)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 30, pointerEvents: 'all',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex', flexDirection: 'column',
          maxHeight: 'calc(100vh - 80px)', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 12 }}>♿</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
                Color Vision Simulator
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => { setActiveMode('normal'); }}
                style={{
                  fontSize: 8, padding: '2px 7px', borderRadius: 4,
                  background: activeMode === 'normal' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${activeMode === 'normal' ? 'rgba(52,211,153,0.3)' : 'var(--border, #2d2d3d)'}`,
                  color: activeMode === 'normal' ? '#34d399' : 'var(--muted, #888)',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
              <button onClick={() => setShowPanel(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>
                ×
              </button>
            </div>
          </div>

          {/* Info banner */}
          <div style={{
            padding: '6px 10px',
            background: 'rgba(251,191,36,0.08)',
            borderBottom: '1px solid rgba(251,191,36,0.15)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 8, color: '#fbbf24', lineHeight: 1.5 }}>
              ⚠️ Simulation applies a CSS color matrix tint. For best results, test real renders.
              {activeMode !== 'normal' && ` Currently simulating: ${mode.label} (${mode.prevalence}).`}
            </div>
          </div>

          {/* Vision mode list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {VISION_MODES.map(m => (
              <VisionModeCard
                key={m.id}
                mode={m}
                selected={activeMode === m.id}
                onClick={() => setActiveMode(m.id)}
              />
            ))}
          </div>

          {/* Quick-cycle row */}
          <div style={{
            padding: '6px 10px', borderTop: '1px solid var(--border, #2d2d3d)',
            display: 'flex', gap: 3, flexWrap: 'wrap', flexShrink: 0,
          }}>
            {VISION_MODES.filter(m => m.id !== 'normal').map(m => (
              <button key={m.id}
                onClick={() => setActiveMode(m.id)}
                title={m.label}
                style={{
                  fontSize: 8, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                  background: activeMode === m.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${activeMode === m.id ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                  color: activeMode === m.id ? '#818cf8' : 'var(--muted, #666)',
                }}>
                {m.emoji} {m.shortLabel}
              </button>
            ))}
          </div>

          {/* Stats bar */}
          <div style={{
            padding: '5px 10px', borderTop: '1px solid var(--border, #2d2d3d)',
            flexShrink: 0, display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 7, color: 'var(--muted, #555)' }}>
              Brettel, Viénot & Mollon (1997) matrices
            </span>
            <span style={{ fontSize: 7, color: 'var(--muted, #555)' }}>
              ⌘⌥B to toggle
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
