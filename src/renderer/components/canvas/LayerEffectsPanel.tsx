/**
 * LayerEffectsPanel — Stackable visual effects for selected shapes.
 *
 * Controls: multiple drop/inner shadows, CSS blur, backdrop blur,
 * blend mode, and color overlay. Each effect is toggleable and
 * reorderable. Changes are applied live via onUpdate.
 *
 * Shortcut: ⌘⇧⌥X
 */

import React, { useState, useCallback } from 'react';
import type { Shape, ShadowDef } from '../../lib/shapes';

// ─── Blend modes ──────────────────────────────────────────────────────────────

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
  'exclusion', 'hue', 'saturation', 'color', 'luminosity',
];

// ─── Default shadow presets ────────────────────────────────────────────────────

const SHADOW_PRESETS: { label: string; value: ShadowDef }[] = [
  { label: 'Soft', value: { x: 0, y: 4, blur: 16, spread: 0, color: '#00000033', inset: false } },
  { label: 'Hard', value: { x: 4, y: 4, blur: 0, spread: 0, color: '#00000080', inset: false } },
  { label: 'Neon', value: { x: 0, y: 0, blur: 20, spread: 4, color: '#6366f180', inset: false } },
  { label: 'Glow', value: { x: 0, y: 0, blur: 32, spread: 8, color: '#6366f140', inset: false } },
  { label: 'Deep', value: { x: 0, y: 24, blur: 48, spread: -8, color: '#00000060', inset: false } },
  { label: 'Inner', value: { x: 0, y: 4, blur: 12, spread: 0, color: '#00000060', inset: true } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function colorToHex(color: string): string {
  // Handle hex with alpha (#rrggbbaa)
  if (color.startsWith('#') && color.length === 9) return color.slice(0, 7);
  if (color.startsWith('#')) return color.length === 7 ? color : '#000000';
  return '#000000';
}

function colorToAlpha(color: string): number {
  if (color.startsWith('#') && color.length === 9) {
    return parseInt(color.slice(7, 9), 16) / 255;
  }
  if (color.startsWith('rgba')) {
    const m = color.match(/rgba\([\d.]+,[\d.]+,[\d.]+,([\d.]+)\)/);
    return m ? parseFloat(m[1]) : 1;
  }
  return 1;
}

function mergeHexAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

// ─── Shadow row component ─────────────────────────────────────────────────────

function ShadowRow({
  shadow,
  index,
  onChange,
  onRemove,
  onToggle,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  shadow: ShadowDef & { disabled?: boolean };
  index: number;
  onChange: (patch: Partial<ShadowDef>) => void;
  onRemove: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hex = colorToHex(shadow.color);
  const alpha = colorToAlpha(shadow.color);
  const disabled = (shadow as { disabled?: boolean }).disabled ?? false;

  return (
    <div style={{
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 8,
      overflow: 'hidden',
      opacity: disabled ? 0.45 : 1,
      transition: 'opacity 0.15s',
    }}>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', background: 'var(--surface2, #2a2a3a)', gap: 6, cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <button onClick={(ev) => { ev.stopPropagation(); onToggle(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: disabled ? 'var(--subtle, #555)' : 'var(--accent, #6366f1)' }}>
          {disabled ? '◯' : '●'}
        </button>
        <div style={{
          width: 14, height: 14, borderRadius: 3,
          background: shadow.color, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text, #e2e8f0)', flex: 1 }}>
          {shadow.inset ? 'Inner Shadow' : 'Drop Shadow'} {index + 1}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {!isFirst && <button onClick={(ev) => { ev.stopPropagation(); onMoveUp(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted, #888)', fontSize: 11, padding: '1px 3px' }}>↑</button>}
          {!isLast && <button onClick={(ev) => { ev.stopPropagation(); onMoveDown(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted, #888)', fontSize: 11, padding: '1px 3px' }}>↓</button>}
          <button onClick={(ev) => { ev.stopPropagation(); onRemove(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted, #888)', fontSize: 14, padding: '0 3px' }}>×</button>
        </div>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* X / Y */}
          <div style={{ display: 'flex', gap: 8 }}>
            <ShadowInput label="X" value={shadow.x} onChange={v => onChange({ x: v })} min={-200} max={200} />
            <ShadowInput label="Y" value={shadow.y} onChange={v => onChange({ y: v })} min={-200} max={200} />
            <ShadowInput label="Blur" value={shadow.blur} onChange={v => onChange({ blur: v })} min={0} max={200} />
            <ShadowInput label="Spread" value={shadow.spread ?? 0} onChange={v => onChange({ spread: v })} min={-100} max={100} />
          </div>

          {/* Color + alpha */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: 'var(--subtle, #555)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Color</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="color" value={hex}
                  onChange={e => onChange({ color: mergeHexAlpha(e.target.value, alpha) })}
                  style={{ width: 28, height: 28, padding: 0, border: 'none', cursor: 'pointer', background: 'none', borderRadius: 4 }} />
                <input type="text" value={hex}
                  onChange={e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange({ color: mergeHexAlpha(e.target.value, alpha) }); }}
                  style={{ flex: 1, background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 5, color: 'var(--text, #e2e8f0)', fontSize: 11, padding: '4px 6px', fontFamily: 'monospace', outline: 'none' }} />
              </div>
            </div>
            <div style={{ width: 80 }}>
              <div style={{ fontSize: 9, color: 'var(--subtle, #555)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Opacity %</div>
              <input type="number" value={Math.round(alpha * 100)} min={0} max={100}
                onChange={e => onChange({ color: mergeHexAlpha(hex, Number(e.target.value) / 100) })}
                style={{ width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 5, color: 'var(--text, #e2e8f0)', fontSize: 11, padding: '4px 6px', outline: 'none', textAlign: 'center' }} />
            </div>
          </div>

          {/* Alpha slider */}
          <div>
            <input type="range" min={0} max={100} value={Math.round(alpha * 100)}
              onChange={e => onChange({ color: mergeHexAlpha(hex, Number(e.target.value) / 100) })}
              style={{ width: '100%', accentColor: 'var(--accent, #6366f1)' }} />
          </div>

          {/* Inner shadow toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 11, color: 'var(--muted, #888)' }}>
            <input type="checkbox" checked={!!shadow.inset}
              onChange={e => onChange({ inset: e.target.checked })}
              style={{ accentColor: 'var(--accent, #6366f1)', cursor: 'pointer' }} />
            Inner shadow (inset)
          </label>
        </div>
      )}
    </div>
  );
}

function ShadowInput({ label, value, onChange, min = -999, max = 999 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 9, color: 'var(--subtle, #555)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <input type="number" value={value} min={min} max={max}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        style={{ width: '100%', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 5, color: 'var(--text, #e2e8f0)', fontSize: 11, padding: '4px 4px', outline: 'none', textAlign: 'center' }} />
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>{label}</span>
      {children}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shape: Shape | null;
  onUpdate: (patch: Partial<Shape>) => void;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function LayerEffectsPanel({ open, onClose, shape, onUpdate }: Props) {
  const shadows: (ShadowDef & { disabled?: boolean })[] = shape?.shadows ?? (shape?.shadow ? [{ x: shape.shadowX, y: shape.shadowY, blur: shape.shadowBlur, color: shape.shadowColor, inset: false }] : []);
  const blendMode = shape?.blendMode ?? 'normal';
  const filterBlur = shape?.filterBlur ?? 0;
  const backdropBlur = shape?.filterBackdropBlur ?? 0;

  const updateShadows = useCallback((newShadows: ShadowDef[]) => {
    onUpdate({ shadows: newShadows, shadow: newShadows.length > 0 });
  }, [onUpdate]);

  const updateShadow = useCallback((i: number, patch: Partial<ShadowDef>) => {
    const next = [...shadows];
    next[i] = { ...next[i], ...patch };
    updateShadows(next);
  }, [shadows, updateShadows]);

  const removeShadow = useCallback((i: number) => {
    const next = shadows.filter((_, idx) => idx !== i);
    updateShadows(next);
  }, [shadows, updateShadows]);

  const toggleShadow = useCallback((i: number) => {
    const next = [...shadows];
    const s = next[i] as ShadowDef & { disabled?: boolean };
    next[i] = { ...s, disabled: !s.disabled } as ShadowDef & { disabled?: boolean };
    updateShadows(next);
  }, [shadows, updateShadows]);

  const moveShadow = useCallback((i: number, dir: -1 | 1) => {
    const next = [...shadows];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    updateShadows(next);
  }, [shadows, updateShadows]);

  const addShadow = useCallback((preset?: ShadowDef) => {
    const newShadow: ShadowDef = preset ?? { x: 0, y: 4, blur: 16, spread: 0, color: '#00000033', inset: false };
    updateShadows([...shadows, newShadow]);
  }, [shadows, updateShadows]);

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
        <span style={{ fontSize: 14 }}>✦</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>Layer Effects</span>
        {shape && <span style={{ fontSize: 10, color: 'var(--muted, #888)', background: 'var(--surface2, #2a2a3a)', padding: '2px 7px', borderRadius: 8, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shape.name || shape.type}</span>}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
      </div>

      {!shape ? (
        <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--muted, #888)', textAlign: 'center', lineHeight: 1.5 }}>
          Select a shape to edit its layer effects
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Shadows ─────────────────────────────────────────────────── */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
            <SectionHeader label={`Shadows (${shadows.length})`}>
              <button
                onClick={() => addShadow()}
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 5, color: 'var(--accent, #6366f1)', fontSize: 16, cursor: 'pointer', padding: '1px 8px', lineHeight: 1 }}
              >+</button>
            </SectionHeader>

            {/* Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: shadows.length > 0 ? 8 : 0 }}>
              {SHADOW_PRESETS.map(p => (
                <button key={p.label} onClick={() => addShadow(p.value)}
                  style={{ padding: '3px 8px', fontSize: 10, borderRadius: 5, cursor: 'pointer', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', color: 'var(--muted, #888)', transition: 'all 0.1s' }}>
                  + {p.label}
                </button>
              ))}
            </div>

            {/* Shadow list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shadows.map((sh, i) => (
                <ShadowRow
                  key={i}
                  shadow={sh}
                  index={i}
                  onChange={(patch) => updateShadow(i, patch)}
                  onRemove={() => removeShadow(i)}
                  onToggle={() => toggleShadow(i)}
                  onMoveUp={() => moveShadow(i, -1)}
                  onMoveDown={() => moveShadow(i, 1)}
                  isFirst={i === 0}
                  isLast={i === shadows.length - 1}
                />
              ))}
              {shadows.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--subtle, #555)', textAlign: 'center', padding: '8px 0' }}>
                  No shadows — click + or use a preset
                </div>
              )}
            </div>
          </div>

          {/* ── Live preview ─────────────────────────────────────────────── */}
          {shadows.length > 0 && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
              <SectionHeader label="Shadow Preview" />
              <ShadowPreview shadows={shadows} fill={shape.fill} borderRadius={typeof shape.borderRadius === 'number' ? shape.borderRadius : 0} />
            </div>
          )}

          {/* ── Blur ─────────────────────────────────────────────────────── */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
            <SectionHeader label="Blur" />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Layer Blur (px)</div>
                <input type="range" min={0} max={50} step={0.5} value={filterBlur}
                  onChange={e => onUpdate({ filterBlur: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent, #6366f1)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--subtle, #555)' }}>
                  <span>0</span>
                  <span style={{ color: filterBlur > 0 ? 'var(--accent, #6366f1)' : 'var(--subtle, #555)', fontWeight: filterBlur > 0 ? 700 : 400 }}>{filterBlur}px</span>
                  <span>50</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Backdrop Blur (px)</div>
                <input type="range" min={0} max={50} step={0.5} value={backdropBlur}
                  onChange={e => onUpdate({ filterBackdropBlur: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent, #6366f1)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--subtle, #555)' }}>
                  <span>0</span>
                  <span style={{ color: backdropBlur > 0 ? 'var(--accent, #6366f1)' : 'var(--subtle, #555)', fontWeight: backdropBlur > 0 ? 700 : 400 }}>{backdropBlur}px</span>
                  <span>50</span>
                </div>
              </div>
            </div>
            {(filterBlur > 0 || backdropBlur > 0) && (
              <button
                onClick={() => onUpdate({ filterBlur: 0, filterBackdropBlur: 0 })}
                style={{ marginTop: 6, padding: '3px 8px', fontSize: 10, borderRadius: 5, cursor: 'pointer', background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)', color: 'var(--muted, #888)' }}>
                Clear blur
              </button>
            )}
          </div>

          {/* ── Blend mode ───────────────────────────────────────────────── */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
            <SectionHeader label="Blend Mode" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {BLEND_MODES.map(m => (
                <button
                  key={m}
                  onClick={() => onUpdate({ blendMode: m })}
                  style={{
                    padding: '3px 7px', fontSize: 10, borderRadius: 5, cursor: 'pointer', border: 'none',
                    background: blendMode === m ? 'rgba(99,102,241,0.2)' : 'var(--surface2, #2a2a3a)',
                    color: blendMode === m ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                    outline: blendMode === m ? '1px solid rgba(99,102,241,0.4)' : 'none',
                    fontWeight: blendMode === m ? 700 : 400,
                    transition: 'all 0.1s',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Blend mode visual grid */}
            <div style={{ marginTop: 10 }}>
              <BlendModeGrid activeMode={blendMode} onSelect={m => onUpdate({ blendMode: m })} />
            </div>
          </div>

          {/* ── CSS export ───────────────────────────────────────────────── */}
          <div style={{ padding: '10px 12px' }}>
            <SectionHeader label="CSS Output" />
            <CssExport shadows={shadows} filterBlur={filterBlur} backdropBlur={backdropBlur} blendMode={blendMode} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shadow preview card ───────────────────────────────────────────────────────

function ShadowPreview({ shadows, fill, borderRadius }: { shadows: (ShadowDef & { disabled?: boolean })[]; fill: string; borderRadius: number }) {
  const activeShadows = shadows.filter(s => !s.disabled);
  const boxShadow = activeShadows.map(sh => {
    const inset = sh.inset ? 'inset ' : '';
    const spread = sh.spread ? ` ${sh.spread}px` : '';
    return `${inset}${sh.x}px ${sh.y}px ${sh.blur}px${spread} ${sh.color}`;
  }).join(', ');

  return (
    <div style={{ height: 80, background: 'var(--surface2, #1a1a2e)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border, #2d2d3d)' }}>
      <div style={{
        width: 64, height: 40,
        background: fill || '#6366f1',
        borderRadius: Math.min(borderRadius, 12),
        boxShadow: boxShadow || 'none',
      }} />
    </div>
  );
}

// ─── Blend mode visual grid ────────────────────────────────────────────────────

function BlendModeGrid({ activeMode, onSelect }: { activeMode: string; onSelect: (m: string) => void }) {
  // Show a mini visual for top blend modes
  const VISUAL = ['multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge'];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {VISUAL.map(m => (
        <div
          key={m}
          onClick={() => onSelect(m)}
          title={m}
          style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}
        >
          <div style={{
            height: 28, borderRadius: 5, overflow: 'hidden', position: 'relative',
            border: `1px solid ${activeMode === m ? 'var(--accent, #6366f1)' : 'var(--border, #2d2d3d)'}`,
          }}>
            {/* Background rect */}
            <div style={{ position: 'absolute', inset: 0, background: '#6366f1' }} />
            {/* Blend rect */}
            <div style={{ position: 'absolute', left: '25%', right: 0, top: 0, bottom: 0, background: '#f59e0b', mixBlendMode: m as React.CSSProperties['mixBlendMode'] }} />
          </div>
          <div style={{ fontSize: 8, color: activeMode === m ? 'var(--accent, #6366f1)' : 'var(--subtle, #555)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.replace('-', '‑')}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CSS export ───────────────────────────────────────────────────────────────

function CssExport({ shadows, filterBlur, backdropBlur, blendMode }: {
  shadows: (ShadowDef & { disabled?: boolean })[];
  filterBlur: number;
  backdropBlur: number;
  blendMode: string;
}) {
  const [copied, setCopied] = useState(false);

  const lines: string[] = [];
  const active = shadows.filter(s => !s.disabled);
  if (active.length > 0) {
    const boxShadow = active.map(sh => {
      const inset = sh.inset ? 'inset ' : '';
      const spread = sh.spread ? ` ${sh.spread}px` : '';
      return `  ${inset}${sh.x}px ${sh.y}px ${sh.blur}px${spread} ${sh.color}`;
    }).join(',\n');
    lines.push(`box-shadow:\n${boxShadow};`);
  }
  if (filterBlur > 0) lines.push(`filter: blur(${filterBlur}px);`);
  if (backdropBlur > 0) lines.push(`backdrop-filter: blur(${backdropBlur}px);`);
  if (blendMode && blendMode !== 'normal') lines.push(`mix-blend-mode: ${blendMode};`);

  const css = lines.join('\n') || '/* No effects applied */';

  const copy = () => {
    navigator.clipboard.writeText(css).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{ position: 'relative' }}>
      <pre style={{
        background: 'var(--surface2, #2a2a3a)', border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 7, padding: '8px 10px', fontSize: 10, color: 'var(--text, #e2e8f0)',
        fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        maxHeight: 120, overflowY: 'auto', lineHeight: 1.5,
      }}>
        {css}
      </pre>
      <button onClick={copy} style={{
        position: 'absolute', top: 6, right: 6, padding: '2px 8px', fontSize: 9,
        background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
        border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
        borderRadius: 4, color: copied ? '#10b981' : 'var(--accent, #6366f1)',
        cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s',
      }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
