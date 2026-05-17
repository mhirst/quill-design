/**
 * TypeScalePanel
 * Choose a typographic scale (modular or custom), preview the sizes,
 * and apply them to text shapes on the canvas.
 *
 * Shortcut: ⇧T
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Type } from 'lucide-react';
import type { Shape } from '../../lib/shapes';

// ── Scale definitions ─────────────────────────────────────────────────────────

interface TypeScale {
  id: string;
  name: string;
  ratio: number;
  description: string;
}

const SCALES: TypeScale[] = [
  { id: 'minor-second',   name: 'Minor Second',   ratio: 1.067, description: '1.067 · Tight' },
  { id: 'major-second',   name: 'Major Second',   ratio: 1.125, description: '1.125 · Classic' },
  { id: 'minor-third',    name: 'Minor Third',    ratio: 1.200, description: '1.200 · Web standard' },
  { id: 'major-third',    name: 'Major Third',    ratio: 1.250, description: '1.250 · Comfortable' },
  { id: 'perfect-fourth', name: 'Perfect Fourth', ratio: 1.333, description: '1.333 · Figma default' },
  { id: 'augmented',      name: 'Augmented Fourth', ratio: 1.414, description: '1.414 · √2' },
  { id: 'perfect-fifth',  name: 'Perfect Fifth',  ratio: 1.500, description: '1.500 · Bold contrast' },
  { id: 'golden',         name: 'Golden Ratio',   ratio: 1.618, description: '1.618 · φ · High contrast' },
  { id: 'custom',         name: 'Custom',         ratio: 1.25,  description: 'Set your own ratio' },
];

// Tailwind-inspired named sizes
const STEP_LABELS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'];

function buildScale(base: number, ratio: number, steps: number): number[] {
  const sizes: number[] = [];
  for (let i = 0; i < steps; i++) {
    sizes.push(Math.round(base * Math.pow(ratio, i)));
  }
  return sizes;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onApplyToShape: (shapeId: string, fontSize: number) => void;
  onApplyToSelected: (fontSize: number) => void;
  selectedId?: string | null;
}

export function TypeScalePanel({ open, onClose, shapes, onApplyToShape, onApplyToSelected, selectedId }: Props) {
  const [scaleId, setScaleId] = useState('perfect-fourth');
  const [customRatio, setCustomRatio] = useState(1.25);
  const [baseSize, setBaseSize] = useState(16);
  const [steps, setSteps] = useState(8);
  const [hoveredSize, setHoveredSize] = useState<number | null>(null);

  const currentScale = SCALES.find(s => s.id === scaleId) ?? SCALES[4];
  const ratio = scaleId === 'custom' ? customRatio : currentScale.ratio;

  const scaleSizes = useMemo(() => buildScale(baseSize, ratio, steps), [baseSize, ratio, steps]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const textShapes = shapes.filter(s => s.type === 'text');
  const selectedShape = selectedId ? shapes.find(s => s.id === selectedId && s.type === 'text') : null;

  const handleApplyToSelected = useCallback((size: number) => {
    onApplyToSelected(size);
  }, [onApplyToSelected]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        left: 60,
        zIndex: 420,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        width: 320,
        maxHeight: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          Typography Scale
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

      {/* Scale selector */}
      <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
        <label style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
          Scale
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
          {SCALES.map(scale => (
            <button
              key={scale.id}
              onClick={() => setScaleId(scale.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 8px', borderRadius: 6, border: 'none',
                background: scaleId === scale.id ? 'var(--accent-dim)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                borderLeft: `2px solid ${scaleId === scale.id ? 'var(--accent)' : 'transparent'}`,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (scaleId !== scale.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (scaleId !== scale.id) e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ fontSize: 11, fontWeight: scaleId === scale.id ? 700 : 400, color: scaleId === scale.id ? 'var(--accent)' : 'var(--text)' }}>
                {scale.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'monospace' }}>
                {scale.description}
              </span>
            </button>
          ))}
        </div>

        {/* Custom ratio input */}
        {scaleId === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 8px', background: 'var(--panel-alt)', borderRadius: 6, border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Ratio</span>
            <input
              type="number"
              min={1.01}
              max={3}
              step={0.001}
              value={customRatio}
              onChange={e => setCustomRatio(Math.max(1.01, Math.min(3, parseFloat(e.target.value) || 1.25)))}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: 12, fontFamily: 'monospace', textAlign: 'right',
              }}
            />
          </div>
        )}
      </div>

      {/* Config row */}
      <div style={{ display: 'flex', gap: 8, padding: '0 12px 10px', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Base (px)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--panel-alt)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px' }}>
            <button
              onClick={() => setBaseSize(s => Math.max(8, s - 1))}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
            >−</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontFamily: 'monospace', color: 'var(--text)' }}>{baseSize}</span>
            <button
              onClick={() => setBaseSize(s => Math.min(48, s + 1))}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
            >+</button>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Steps</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--panel-alt)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px' }}>
            <button
              onClick={() => setSteps(s => Math.max(3, s - 1))}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
            >−</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontFamily: 'monospace', color: 'var(--text)' }}>{steps}</span>
            <button
              onClick={() => setSteps(s => Math.min(12, s + 1))}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
            >+</button>
          </div>
        </div>
      </div>

      {/* Scale preview */}
      <div style={{ borderTop: '1px solid var(--border)', flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '8px 12px 4px', fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Scale Preview — click to apply
        </div>
        {[...scaleSizes].reverse().map((size, ri) => {
          const i = steps - 1 - ri;
          const label = STEP_LABELS[i] ?? `${i + 1}`;
          const isHovered = hoveredSize === size;
          const canApply = !!selectedShape;

          return (
            <div
              key={size}
              onMouseEnter={() => setHoveredSize(size)}
              onMouseLeave={() => setHoveredSize(null)}
              onClick={() => canApply && handleApplyToSelected(size)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '4px 12px',
                background: isHovered ? 'var(--accent-dim)' : 'none',
                cursor: canApply ? 'pointer' : 'default',
                transition: 'background 0.1s',
                minHeight: Math.min(size + 12, 64),
              }}
            >
              {/* Label */}
              <div style={{ width: 32, flexShrink: 0, textAlign: 'right' }}>
                <span style={{ fontSize: 9, color: 'var(--subtle)', fontFamily: 'monospace', fontWeight: 600 }}>{label}</span>
              </div>
              {/* Size px */}
              <div style={{ width: 28, flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>{size}px</span>
              </div>
              {/* Preview text */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <span style={{
                  fontSize: Math.min(size, 36),
                  lineHeight: 1,
                  color: isHovered && canApply ? 'var(--accent)' : 'var(--text)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.1s',
                  display: 'block',
                  overflow: 'hidden',
                }}>
                  {i >= 5 ? 'A' : i >= 3 ? 'Ag' : 'Quill'}
                </span>
              </div>
              {/* Apply button hint */}
              {isHovered && canApply && (
                <div style={{
                  fontSize: 9, color: 'var(--accent)', fontWeight: 700,
                  background: 'rgba(99,102,241,0.12)', borderRadius: 4,
                  padding: '2px 5px', flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  Apply
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Text shapes list */}
      {textShapes.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ padding: '8px 12px 4px', fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Apply to layer
          </div>
          <div style={{ maxHeight: 120, overflowY: 'auto', padding: '0 12px 8px' }}>
            {textShapes.map(shape => (
              <div key={shape.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  flex: 1, fontSize: 11, color: shape.id === selectedId ? 'var(--accent)' : 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: shape.id === selectedId ? 600 : 400,
                }}>
                  <span style={{ opacity: 0.5, marginRight: 4 }}>T</span>{shape.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'monospace', flexShrink: 0 }}>
                  {shape.fontSize}px
                </span>
                {/* Size picker for this layer */}
                <select
                  value=""
                  onChange={e => {
                    const size = parseInt(e.target.value);
                    if (!isNaN(size)) onApplyToShape(shape.id, size);
                    e.target.value = '';
                  }}
                  style={{
                    background: 'var(--panel-alt)', border: '1px solid var(--border)',
                    borderRadius: 5, color: 'var(--muted)', fontSize: 10,
                    cursor: 'pointer', padding: '2px 4px', maxWidth: 52,
                  }}
                >
                  <option value="">set…</option>
                  {scaleSizes.map(size => (
                    <option key={size} value={size}>{size}px</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border)', flexShrink: 0,
        fontSize: 10, color: 'var(--subtle)',
      }}>
        {selectedShape
          ? <>Selected: <strong style={{ color: 'var(--muted)' }}>{selectedShape.name}</strong> — click a size to apply</>
          : <>Select a text layer to apply a size directly</>}
      </div>
    </div>
  );
}
