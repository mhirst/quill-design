/**
 * FluidTypePanel — Responsive fluid typography generator.
 *
 * Generates CSS `clamp()` values for type sizes that scale smoothly
 * between a minimum viewport and maximum viewport — the "fluid type" technique.
 *
 * Features:
 * - Configure min/max viewport widths
 * - Configure min/max font size for each scale step
 * - Preview scale at 4 breakpoints (mobile, tablet, laptop, desktop)
 * - Named steps: xs, sm, base, md, lg, xl, 2xl, 3xl, display
 * - Copy full CSS custom properties block
 * - Apply to selected text shapes
 *
 * Formula: clamp(minSize, minSize + (maxSize - minSize) * (vw - minVw) / (maxVw - minVw), maxSize)
 * CSS: clamp(Xrem, Xcalc, Xrem)
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onApplyFontSize: (ids: string[], fontSize: number) => void;
}

interface TypeStep {
  id: string;
  label: string;
  minPx: number;
  maxPx: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_STEPS: TypeStep[] = [
  { id: 'xs',      label: 'XS',      minPx: 11, maxPx: 12 },
  { id: 'sm',      label: 'SM',      minPx: 13, maxPx: 14 },
  { id: 'base',    label: 'Base',    minPx: 15, maxPx: 16 },
  { id: 'md',      label: 'MD',      minPx: 18, maxPx: 20 },
  { id: 'lg',      label: 'LG',      minPx: 20, maxPx: 24 },
  { id: 'xl',      label: 'XL',      minPx: 24, maxPx: 30 },
  { id: '2xl',     label: '2XL',     minPx: 28, maxPx: 36 },
  { id: '3xl',     label: '3XL',     minPx: 32, maxPx: 48 },
  { id: 'display', label: 'Display', minPx: 40, maxPx: 72 },
];

const BREAKPOINTS = [
  { label: 'Mobile', vw: 375 },
  { label: 'Tablet', vw: 768 },
  { label: 'Laptop', vw: 1280 },
  { label: 'Desktop', vw: 1920 },
];

// ── Fluid formula ─────────────────────────────────────────────────────────────

/**
 * Returns a CSS clamp() string for fluid type.
 * clamp(minRem, preferred, maxRem)
 * preferred = minRem + (maxRem - minRem) * ((100vw - minVw) / (maxVw - minVw))
 */
function fluidClamp(minPx: number, maxPx: number, minVw: number, maxVw: number): string {
  const minRem = (minPx / 16).toFixed(4);
  const maxRem = (maxPx / 16).toFixed(4);

  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = minPx - slope * minVw;

  const slopePct = (slope * 100).toFixed(4);
  const interceptRem = (intercept / 16).toFixed(4);

  const preferredSign = parseFloat(interceptRem) >= 0 ? '+' : '';
  const preferred = `${slopePct}vw ${preferredSign} ${interceptRem}rem`.replace('+ -', '- ');

  return `clamp(${minRem}rem, ${preferred}, ${maxRem}rem)`;
}

/**
 * Compute actual px size at a given viewport width using the fluid formula
 */
function computePxAtVw(minPx: number, maxPx: number, minVw: number, maxVw: number, vw: number): number {
  if (vw <= minVw) return minPx;
  if (vw >= maxVw) return maxPx;
  const t = (vw - minVw) / (maxVw - minVw);
  return minPx + t * (maxPx - minPx);
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy CSS' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
      style={{
        padding: '5px 10px', fontSize: 10, borderRadius: 5,
        border: '1px solid rgba(99,102,241,0.35)',
        background: copied ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
        color: copied ? '#c7d2fe' : '#818cf8', cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copied!' : label}
    </button>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function FluidTypePanel({ open, onClose, selectedShape, selectedShapeIds, onApplyFontSize }: Props) {
  const [steps, setSteps] = useState<TypeStep[]>(DEFAULT_STEPS);
  const [minVw, setMinVw] = useState(375);
  const [maxVw, setMaxVw] = useState(1440);
  const [rootPx, setRootPx] = useState(16);
  const [previewVw, setPreviewVw] = useState(1280);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const getIds = useCallback(() => {
    if (selectedShapeIds.length > 0) return selectedShapeIds;
    if (selectedShape) return [selectedShape.id];
    return [];
  }, [selectedShape, selectedShapeIds]);

  const updateStep = useCallback((id: string, field: 'minPx' | 'maxPx', value: number) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }, []);

  const cssOutput = useMemo(() => {
    const lines = steps.map(s => {
      const clamp = fluidClamp(s.minPx, s.maxPx, minVw, maxVw);
      return `  --font-${s.id}: ${clamp};`;
    });
    return `:root {\n${lines.join('\n')}\n}`;
  }, [steps, minVw, maxVw]);

  const tailwindOutput = useMemo(() => {
    const entries = steps.map(s => {
      const clamp = fluidClamp(s.minPx, s.maxPx, minVw, maxVw);
      return `      '${s.id}': ['${clamp}', { lineHeight: '1.4' }],`;
    });
    return `// tailwind.config.js\ntheme: {\n  fontSize: {\n${entries.join('\n')}\n  }\n}`;
  }, [steps, minVw, maxVw]);

  const applySelected = useCallback(() => {
    if (!selectedStep) return;
    const step = steps.find(s => s.id === selectedStep);
    if (!step) return;
    const ids = getIds();
    if (ids.length === 0) return;
    // Apply the midpoint size (between min and max)
    const midPx = Math.round((step.minPx + step.maxPx) / 2);
    onApplyFontSize(ids, midPx);
  }, [selectedStep, steps, getIds, onApplyFontSize]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 780,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'linear-gradient(135deg,rgba(12,12,22,0.99),rgba(18,10,28,0.99))',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          color: '#e2e8f0',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>⟳ Fluid Typography</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              Generate responsive type with CSS clamp() · scales smoothly between viewports
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
        </div>

        {/* Viewport config */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 10,
          background: 'rgba(99,102,241,0.05)',
          border: '1px solid rgba(99,102,241,0.12)',
        }}>
          {[
            { label: 'Min Viewport', value: minVw, set: setMinVw, unit: 'px', hint: 'Mobile breakpoint' },
            { label: 'Max Viewport', value: maxVw, set: setMaxVw, unit: 'px', hint: 'Desktop breakpoint' },
            { label: 'Root Font Size', value: rootPx, set: setRootPx, unit: 'px', hint: 'Usually 16px' },
          ].map(({ label, value, set, unit, hint }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{label} <span style={{ color: '#334155' }}>· {hint}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  value={value}
                  min={0}
                  onChange={e => set(Number(e.target.value))}
                  style={{
                    width: 80,
                    padding: '5px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#f1f5f9',
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 10, color: '#475569' }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* Scale editor */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Type Scale · click to select &amp; apply
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {steps.map(step => {
                const previewPx = computePxAtVw(step.minPx, step.maxPx, minVw, maxVw, previewVw);
                const isSelected = selectedStep === step.id;
                return (
                  <div
                    key={step.id}
                    onClick={() => setSelectedStep(isSelected ? null : step.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.05)'}`,
                      background: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {/* Label */}
                    <div style={{ width: 44, fontSize: 10, color: '#64748b', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}>
                      {step.label}
                    </div>

                    {/* Preview text */}
                    <div style={{
                      flex: 1,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}>
                      <span style={{ fontSize: Math.min(previewPx, 36), color: '#f1f5f9', lineHeight: 1, fontWeight: step.id === 'display' || step.id === '3xl' ? 800 : 400 }}>
                        Aa
                      </span>
                    </div>

                    {/* Size at preview vw */}
                    <div style={{ fontSize: 10, color: '#6366f1', fontFamily: 'monospace', flexShrink: 0 }}>
                      {previewPx.toFixed(1)}px
                    </div>

                    {/* Min / Max inputs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <input
                        type="number"
                        value={step.minPx}
                        min={6}
                        max={200}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateStep(step.id, 'minPx', Number(e.target.value))}
                        style={{
                          width: 44,
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.04)',
                          color: '#94a3b8',
                          fontSize: 10,
                          fontFamily: 'monospace',
                          textAlign: 'center',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 9, color: '#334155' }}>→</span>
                      <input
                        type="number"
                        value={step.maxPx}
                        min={6}
                        max={200}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateStep(step.id, 'maxPx', Number(e.target.value))}
                        style={{
                          width: 44,
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.04)',
                          color: '#94a3b8',
                          fontSize: 10,
                          fontFamily: 'monospace',
                          textAlign: 'center',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 9, color: '#334155' }}>px</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview viewport slider */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#64748b' }}>Preview at viewport width</span>
                <span style={{ fontSize: 11, color: '#6366f1', fontFamily: 'monospace', fontWeight: 700 }}>{previewVw}px</span>
              </div>
              <input
                type="range"
                min={minVw}
                max={maxVw}
                value={previewVw}
                onChange={e => setPreviewVw(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#6366f1' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#334155', marginTop: 2 }}>
                {BREAKPOINTS.map(bp => (
                  <button
                    key={bp.label}
                    onClick={() => setPreviewVw(bp.vw)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: previewVw === bp.vw ? '#818cf8' : '#334155',
                      cursor: 'pointer',
                      fontSize: 9,
                      padding: 0,
                    }}
                  >
                    {bp.label} ({bp.vw})
                  </button>
                ))}
              </div>
            </div>

            {/* Apply selected */}
            {selectedStep && getIds().length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={applySelected}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: '1px solid rgba(99,102,241,0.4)',
                    background: 'rgba(99,102,241,0.15)',
                    color: '#c7d2fe',
                    cursor: 'pointer',
                  }}
                >
                  Apply "{steps.find(s => s.id === selectedStep)?.label}" to {getIds().length} shape{getIds().length > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>

          {/* Right: CSS output */}
          <div style={{ width: 260 }}>
            {/* Breakpoint comparison table */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Size at Breakpoints
              </div>
              <div style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: 44, fontSize: 9, color: '#334155' }}>Step</div>
                  {BREAKPOINTS.map(bp => (
                    <div key={bp.label} style={{ flex: 1, fontSize: 9, color: '#334155', textAlign: 'right' }}>{bp.label}</div>
                  ))}
                </div>
                {steps.map((step, si) => (
                  <div
                    key={step.id}
                    style={{
                      display: 'flex',
                      padding: '3px 8px',
                      background: si % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ width: 44, fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>{step.label}</div>
                    {BREAKPOINTS.map(bp => {
                      const px = computePxAtVw(step.minPx, step.maxPx, minVw, maxVw, bp.vw);
                      return (
                        <div key={bp.label} style={{ flex: 1, fontSize: 9, color: '#818cf8', textAlign: 'right', fontFamily: 'monospace' }}>
                          {px.toFixed(0)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* CSS Custom Properties */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>CSS Custom Properties</span>
                <CopyButton text={cssOutput} />
              </div>
              <pre style={{
                fontSize: 9,
                color: '#64748b',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 6,
                padding: '8px 10px',
                overflow: 'auto',
                maxHeight: 200,
                margin: 0,
                lineHeight: 1.7,
              }}>
                {cssOutput}
              </pre>
            </div>

            {/* Tailwind */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Tailwind Config</span>
                <CopyButton text={tailwindOutput} label="Copy Tailwind" />
              </div>
              <pre style={{
                fontSize: 9,
                color: '#64748b',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 6,
                padding: '8px 10px',
                overflow: 'auto',
                maxHeight: 120,
                margin: 0,
                lineHeight: 1.7,
              }}>
                {tailwindOutput}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
