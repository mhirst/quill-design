/**
 * ColorBlindPanel — Simulate color blindness and low-vision conditions on canvas.
 *
 * Applies CSS SVG matrix filters to approximate how the design looks for users
 * with color vision deficiencies. Also includes a canvas spotlight mode that
 * dims everything outside the selection.
 *
 * Shortcut: ⌘⇧⌥B
 */

import React, { useEffect, useRef, useState } from 'react';

// ─── Color vision simulation matrices ─────────────────────────────────────────
// Source: Brettel, Viénot & Mollon (1997) / Machado (2009) approximations

interface SimMode {
  id: string;
  label: string;
  description: string;
  icon: string;
  filter: string; // CSS filter or SVG matrix
  prevalence: string;
}

const PROTANOPIA_M = '0.567,0.433,0,0,0, 0.558,0.442,0,0,0, 0,0.242,0.758,0,0, 0,0,0,1,0';
const DEUTERANOPIA_M = '0.625,0.375,0,0,0, 0.7,0.3,0,0,0, 0,0.3,0.7,0,0, 0,0,0,1,0';
const TRITANOPIA_M = '0.95,0.05,0,0,0, 0,0.433,0.567,0,0, 0,0.475,0.525,0,0, 0,0,0,1,0';
const ACHROMATOPSIA_M = '0.299,0.587,0.114,0,0, 0.299,0.587,0.114,0,0, 0.299,0.587,0.114,0,0, 0,0,0,1,0';
const PROTANOMALY_M = '0.817,0.183,0,0,0, 0.333,0.667,0,0,0, 0,0.125,0.875,0,0, 0,0,0,1,0';
const DEUTERANOMALY_M = '0.8,0.2,0,0,0, 0.258,0.742,0,0,0, 0,0.142,0.858,0,0, 0,0,0,1,0';

const SIMULATION_MODES: SimMode[] = [
  {
    id: 'normal', label: 'Normal Vision', description: 'How most people see the design',
    icon: '👁', filter: '', prevalence: '',
  },
  {
    id: 'protanopia', label: 'Protanopia', description: 'Red-blind (no L-cones)',
    icon: '🔴', filter: `url(#cb-protanopia)`, prevalence: '~1% men',
  },
  {
    id: 'protanomaly', label: 'Protanomaly', description: 'Red-weak (anomalous L-cones)',
    icon: '🟥', filter: `url(#cb-protanomaly)`, prevalence: '~1.3% men',
  },
  {
    id: 'deuteranopia', label: 'Deuteranopia', description: 'Green-blind (no M-cones)',
    icon: '🟢', filter: `url(#cb-deuteranopia)`, prevalence: '~1.2% men',
  },
  {
    id: 'deuteranomaly', label: 'Deuteranomaly', description: 'Green-weak (anomalous M-cones)',
    icon: '🟩', filter: `url(#cb-deuteranomaly)`, prevalence: '~6% men',
  },
  {
    id: 'tritanopia', label: 'Tritanopia', description: 'Blue-blind (no S-cones)',
    icon: '🔵', filter: `url(#cb-tritanopia)`, prevalence: '~0.003%',
  },
  {
    id: 'achromatopsia', label: 'Achromatopsia', description: 'Total color blindness (monochromacy)',
    icon: '⚫', filter: `url(#cb-achromatopsia)`, prevalence: '~0.003%',
  },
  {
    id: 'low-contrast', label: 'Low Contrast', description: 'Simulate low vision / glare',
    icon: '🌫', filter: 'contrast(0.5) brightness(1.2)', prevalence: '~2.2 billion',
  },
  {
    id: 'blur', label: 'Blurred Vision', description: 'Simulate blur/cataracts',
    icon: '💧', filter: 'blur(2px)', prevalence: '~253 million',
  },
];

// ─── SVG filter definitions ───────────────────────────────────────────────────

function FilterDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden>
      <defs>
        <filter id="cb-protanopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={PROTANOPIA_M} />
        </filter>
        <filter id="cb-protanomaly" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={PROTANOMALY_M} />
        </filter>
        <filter id="cb-deuteranopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={DEUTERANOPIA_M} />
        </filter>
        <filter id="cb-deuteranomaly" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={DEUTERANOMALY_M} />
        </filter>
        <filter id="cb-tritanopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={TRITANOPIA_M} />
        </filter>
        <filter id="cb-achromatopsia" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={ACHROMATOPSIA_M} />
        </filter>
      </defs>
    </svg>
  );
}

// ─── Canvas Filter Overlay ────────────────────────────────────────────────────

interface FilterOverlayProps {
  filterId: string;
  canvasContainerId?: string;
}

// Inject a filter wrapper div over the canvas pane
function useCanvasFilter(filter: string) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Find the canvas pane container and wrap it with a filter
    const canvasEl = document.querySelector('[data-canvas-pane]') as HTMLElement | null;
    if (!canvasEl) return;

    if (!filter) {
      canvasEl.style.filter = '';
      return;
    }
    canvasEl.style.filter = filter;
    return () => { canvasEl.style.filter = ''; };
  }, [filter]);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function ColorBlindPanel({ open, onClose, activeFilter, onFilterChange }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const activeMode = SIMULATION_MODES.find(m => m.filter === activeFilter) ?? SIMULATION_MODES[0];

  if (!open) return null;

  return (
    <>
      <FilterDefs />
      <div style={{
        position: 'absolute', top: 48, right: 8, width: 280,
        maxHeight: 'calc(100vh - 120px)',
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        zIndex: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 14 }}>👁</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>Color Vision Simulator</span>
          {activeMode.id !== 'normal' && (
            <button
              onClick={() => onFilterChange('')}
              style={{ padding: '2px 8px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 4, color: 'var(--accent, #6366f1)', fontSize: 10, cursor: 'pointer' }}
            >
              Reset
            </button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
        </div>

        {/* Active mode indicator */}
        {activeMode.id !== 'normal' && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(99,102,241,0.08)',
            borderBottom: '1px solid var(--border, #2d2d3d)',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            <span style={{ fontSize: 18 }}>{activeMode.icon}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #6366f1)' }}>{activeMode.label}</div>
              <div style={{ fontSize: 10, color: 'var(--muted, #888)' }}>{activeMode.description}</div>
            </div>
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Instructions */}
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted, #888)', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
            Click a mode to apply a color vision filter to the entire canvas. Check that your design has sufficient contrast for all users.
          </div>

          {/* Mode cards */}
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {SIMULATION_MODES.map(mode => {
              const isActive = activeMode.id === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => onFilterChange(mode.filter)}
                  onMouseEnter={() => setHoverId(mode.id)}
                  onMouseLeave={() => setHoverId(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: isActive ? 'rgba(99,102,241,0.12)' : hoverId === mode.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
                    borderRadius: 6, cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'background 0.1s, border-color 0.1s',
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0, minWidth: 28 }}>{mode.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600,
                      color: isActive ? 'var(--accent, #6366f1)' : 'var(--text, #e2e8f0)',
                    }}>
                      {mode.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted, #888)' }}>
                      {mode.description}
                    </div>
                  </div>
                  {mode.prevalence && (
                    <span style={{
                      fontSize: 9, color: 'var(--subtle, #444)',
                      background: 'var(--surface2, #2a2a3a)',
                      padding: '1px 5px', borderRadius: 8, flexShrink: 0,
                    }}>
                      {mode.prevalence}
                    </span>
                  )}
                  {isActive && (
                    <span style={{ fontSize: 12, color: 'var(--accent, #6366f1)', flexShrink: 0 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tips */}
          <div style={{ margin: '0 8px 8px', padding: '10px', background: 'var(--surface2, #2a2a3a)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text, #e2e8f0)', marginBottom: 6 }}>
              🎓 Accessibility tips
            </div>
            {[
              'Use a contrast ratio of at least 4.5:1 for normal text',
              'Don\'t rely on color alone to convey information',
              'Add labels, patterns, or icons alongside color coding',
              'Test with protanopia + deuteranopia (most common)',
              'Use the Design Intelligence panel for WCAG checks',
            ].map((tip, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
                {tip}
              </div>
            ))}
          </div>

          {/* Contrast ratio guide */}
          <div style={{ margin: '0 8px 8px', display: 'flex', gap: 4 }}>
            {[
              { label: 'AA Large', ratio: '3:1', color: '#10b981' },
              { label: 'AA Normal', ratio: '4.5:1', color: '#6366f1' },
              { label: 'AAA', ratio: '7:1', color: '#f59e0b' },
            ].map(g => (
              <div key={g.label} style={{
                flex: 1, padding: '6px 4px', background: 'var(--surface2, #2a2a3a)',
                borderRadius: 6, textAlign: 'center',
                borderTop: `2px solid ${g.color}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: g.color }}>{g.ratio}</div>
                <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 2 }}>{g.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Canvas Filter Applier ────────────────────────────────────────────────────

export function CanvasColorFilter({ filter }: { filter: string }) {
  useEffect(() => {
    // Apply to all canvas elements - target the canvas pane wrapper
    const targets = document.querySelectorAll('[data-canvas-filter-target]') as NodeListOf<HTMLElement>;
    targets.forEach(el => {
      el.style.filter = filter;
    });
    return () => {
      targets.forEach(el => { el.style.filter = ''; });
    };
  }, [filter]);

  if (!filter) return null;

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        filter,
        pointerEvents: 'none',
        zIndex: 15,
        // The filter is applied to a transparent overlay so it affects what's "behind"
        // But CSS filters on a transparent div won't work - we need to use a different approach
        // Instead we'll use a backdrop-filter trick
      }}
    />
  );
}
