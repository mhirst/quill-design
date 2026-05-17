/**
 * VariantsPanel — Figma-style component variant states editor.
 *
 * Lets you define named visual states (Default, Hover, Pressed, Disabled,
 * Dark, Focus, Error, Success, Loading…) and switch the active variant.
 * Each variant stores visual overrides — fill, stroke, opacity, shadow, color.
 *
 * Shortcut: Cmd+Shift+Alt+W
 */

import React, { useState, useCallback } from 'react';
import type { Shape, ShapeVariant, ShadowDef } from '../../lib/shapes';

// ── Preset variant templates ──────────────────────────────────────────────────

interface VariantTemplate {
  label: string;
  emoji: string;
  description: string;
  patch: Partial<ShapeVariant>;
}

const VARIANT_TEMPLATES: VariantTemplate[] = [
  {
    label: 'Default',
    emoji: '⬜',
    description: 'Base / resting state',
    patch: {},
  },
  {
    label: 'Hover',
    emoji: '🖱️',
    description: 'Mouse over — slightly elevated',
    patch: {
      filterBrightness: 110,
      shadows: [{ x: 0, y: 8, blur: 20, spread: 0, color: 'rgba(0,0,0,0.2)', inset: false }],
    },
  },
  {
    label: 'Pressed',
    emoji: '👆',
    description: 'Mouse down / active tap',
    patch: {
      filterBrightness: 90,
      shadows: [{ x: 0, y: 2, blur: 4, spread: 0, color: 'rgba(0,0,0,0.15)', inset: false }],
      opacity: 0.9,
    },
  },
  {
    label: 'Disabled',
    emoji: '🚫',
    description: 'Non-interactive / grayed out',
    patch: {
      opacity: 0.4,
      filterBrightness: 80,
    },
  },
  {
    label: 'Focus',
    emoji: '🔲',
    description: 'Keyboard-focused state',
    patch: {
      stroke: '#6366f1',
      strokeWidth: 2,
      shadows: [{ x: 0, y: 0, blur: 0, spread: 3, color: 'rgba(99,102,241,0.4)', inset: false }],
    },
  },
  {
    label: 'Error',
    emoji: '❌',
    description: 'Validation error state',
    patch: {
      stroke: '#ef4444',
      strokeWidth: 2,
      shadows: [{ x: 0, y: 0, blur: 0, spread: 2, color: 'rgba(239,68,68,0.3)', inset: false }],
    },
  },
  {
    label: 'Success',
    emoji: '✅',
    description: 'Validation success state',
    patch: {
      stroke: '#22c55e',
      strokeWidth: 2,
      shadows: [{ x: 0, y: 0, blur: 0, spread: 2, color: 'rgba(34,197,94,0.3)', inset: false }],
    },
  },
  {
    label: 'Dark',
    emoji: '🌙',
    description: 'Dark mode visual override',
    patch: {
      fill: '#1e1e2e',
      color: '#e2e8f0',
      stroke: '#2d2d3d',
    },
  },
  {
    label: 'Light',
    emoji: '☀️',
    description: 'Light mode override',
    patch: {
      fill: '#ffffff',
      color: '#1f2937',
      stroke: '#e5e7eb',
    },
  },
  {
    label: 'Loading',
    emoji: '⏳',
    description: 'In-progress / skeleton state',
    patch: {
      fill: '#e5e7eb',
      opacity: 0.7,
      filterBrightness: 95,
    },
  },
  {
    label: 'Selected',
    emoji: '✔️',
    description: 'Checked / selected state',
    patch: {
      fill: '#6366f1',
      color: '#ffffff',
      stroke: '#4338ca',
    },
  },
  {
    label: 'Warning',
    emoji: '⚠️',
    description: 'Warning / caution state',
    patch: {
      stroke: '#f59e0b',
      strokeWidth: 2,
      shadows: [{ x: 0, y: 0, blur: 0, spread: 2, color: 'rgba(245,158,11,0.3)', inset: false }],
    },
  },
];

// Visual properties that can be overridden per variant
const VISUAL_PROPS = [
  { key: 'fill', label: 'Fill Color', type: 'color' },
  { key: 'fillOpacity', label: 'Fill Opacity', type: 'opacity' },
  { key: 'stroke', label: 'Stroke Color', type: 'color' },
  { key: 'strokeWidth', label: 'Stroke Width', type: 'number', min: 0, max: 20 },
  { key: 'opacity', label: 'Opacity', type: 'opacity' },
  { key: 'filterBrightness', label: 'Brightness', type: 'number', min: 0, max: 200 },
  { key: 'filterBlur', label: 'Blur', type: 'number', min: 0, max: 40 },
  { key: 'color', label: 'Text Color', type: 'color' },
  { key: 'fontWeight', label: 'Font Weight', type: 'text' },
  { key: 'fontSize', label: 'Font Size', type: 'number', min: 8, max: 200 },
  { key: 'borderRadius', label: 'Border Radius', type: 'number', min: 0, max: 9999 },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ColorSwatch({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        background: color,
        border: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}
    />
  );
}

// Merge a variant's overrides onto the base shape for preview
function previewProps(base: Shape, variant: ShapeVariant): Partial<Shape> {
  const result: Partial<Shape> = {};
  if (variant.fill !== undefined) result.fill = variant.fill;
  if (variant.fillOpacity !== undefined) result.fillOpacity = variant.fillOpacity;
  if (variant.stroke !== undefined) result.stroke = variant.stroke;
  if (variant.strokeWidth !== undefined) result.strokeWidth = variant.strokeWidth;
  if (variant.opacity !== undefined) result.opacity = variant.opacity;
  if (variant.filterBrightness !== undefined) result.filterBrightness = variant.filterBrightness;
  if (variant.filterBlur !== undefined) result.filterBlur = variant.filterBlur;
  if (variant.color !== undefined) result.color = variant.color;
  if (variant.fontWeight !== undefined) result.fontWeight = variant.fontWeight;
  if (variant.fontSize !== undefined) result.fontSize = variant.fontSize;
  if (variant.shadows !== undefined) result.shadows = variant.shadows;
  if (variant.borderRadius !== undefined) result.borderRadius = variant.borderRadius;
  return result;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VariantSwatch({
  base,
  variantName,
  variant,
  isActive,
  onClick,
  onDelete,
}: {
  base: Shape;
  variantName: string;
  variant: ShapeVariant;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const merged = { ...base, ...previewProps(base, variant) };
  const bg = merged.fillType === 'solid' ? merged.fill : (merged.fill || '#6366f1');
  const br = typeof merged.borderRadius === 'number' ? Math.min(merged.borderRadius, 12) : 6;
  const opacity = merged.opacity ?? 1;
  const brightness = merged.filterBrightness !== undefined && merged.filterBrightness !== 100
    ? `brightness(${merged.filterBrightness}%)`
    : '';
  const blur = merged.filterBlur ? `blur(${merged.filterBlur}px)` : '';
  const filterStr = [brightness, blur].filter(Boolean).join(' ');
  const stroke = merged.stroke !== 'transparent' && merged.strokeWidth ? `${merged.stroke}` : 'transparent';
  const strokeW = merged.strokeWidth ?? 0;

  const shadows = (merged.shadows ?? [])
    .map((s: ShadowDef) => `${s.inset ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread ?? 0}px ${s.color}`)
    .join(', ');

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        style={{
          width: '100%',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '7px 10px',
          background: isActive ? 'rgba(99,102,241,0.12)' : 'var(--panel-alt, #252535)',
          border: isActive ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border, #2d2d3d)',
          borderRadius: 7,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.12s',
        }}
      >
        {/* Mini preview swatch */}
        <div
          style={{
            width: 32,
            height: 22,
            borderRadius: br,
            background: bg,
            opacity,
            filter: filterStr || undefined,
            boxShadow: shadows || (strokeW > 0 ? `0 0 0 ${strokeW}px ${stroke}` : 'none'),
            flexShrink: 0,
            border: strokeW > 0 ? `${strokeW}px solid ${stroke}` : 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--accent, #6366f1)' : 'var(--text, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {variant.label}
            {isActive && <span style={{ fontSize: 8, background: 'var(--accent, #6366f1)', color: '#fff', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>ACTIVE</span>}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 1 }}>
            {variantName === 'Default'
              ? 'Base state'
              : `${Object.keys(variant).filter(k => k !== 'label').length} override${Object.keys(variant).filter(k => k !== 'label').length !== 1 ? 's' : ''}`}
          </div>
        </div>
        {isActive && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent, #6366f1)', flexShrink: 0 }} />
        )}
      </button>
      {variantName !== 'Default' && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: 'none',
            border: 'none',
            color: 'var(--muted, #888)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '1px 3px',
            borderRadius: 3,
            lineHeight: 1,
            opacity: 0.6,
          }}
          title="Delete variant"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onUpdate: (id: string, patch: Partial<Shape>) => void;
}

export function VariantsPanel({ open, onClose, selectedShape, onUpdate }: Props) {
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [newVariantName, setNewVariantName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);

  if (!open) return null;

  const shape = selectedShape;
  if (!shape) {
    return (
      <div
        style={{
          position: 'fixed', top: 56, right: 340, width: 300,
          background: 'var(--panel, #1e1e2e)', border: '1px solid var(--border, #2d2d3d)',
          borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 310,
          padding: 24, textAlign: 'center', fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎭</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #e2e8f0)', marginBottom: 6 }}>Variants Panel</div>
        <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginBottom: 16 }}>Select a shape to manage its visual state variants</div>
        <button onClick={onClose} style={{ background: 'var(--panel-alt, #252535)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 6, color: 'var(--text, #e2e8f0)', fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}>Close</button>
      </div>
    );
  }

  const variants = shape.variants ?? {};
  const activeVariant = shape.activeVariant ?? 'Default';
  const allVariantKeys = ['Default', ...Object.keys(variants).filter(k => k !== 'Default')];

  const activateVariant = useCallback((variantKey: string) => {
    if (!shape) return;
    onUpdate(shape.id, { activeVariant: variantKey });
  }, [shape, onUpdate]);

  const addVariantFromTemplate = useCallback((template: VariantTemplate) => {
    if (!shape) return;
    const key = template.label;
    const existing = shape.variants ?? {};
    if (existing[key]) { activateVariant(key); setShowTemplates(false); return; }
    const newVariant: ShapeVariant = { label: template.label, ...template.patch };
    onUpdate(shape.id, {
      variants: { ...existing, [key]: newVariant },
      activeVariant: key,
    });
    setShowTemplates(false);
  }, [shape, onUpdate, activateVariant]);

  const addCustomVariant = useCallback(() => {
    const name = newVariantName.trim();
    if (!name || !shape) return;
    const existing = shape.variants ?? {};
    if (existing[name]) { activateVariant(name); setNewVariantName(''); setShowAddInput(false); return; }
    const newVariant: ShapeVariant = { label: name };
    onUpdate(shape.id, {
      variants: { ...existing, [name]: newVariant },
      activeVariant: name,
    });
    setNewVariantName('');
    setShowAddInput(false);
    setEditingVariant(name);
  }, [newVariantName, shape, onUpdate, activateVariant]);

  const deleteVariant = useCallback((key: string) => {
    if (!shape || key === 'Default') return;
    const existing = { ...shape.variants };
    delete existing[key];
    const newActive = activeVariant === key ? 'Default' : activeVariant;
    onUpdate(shape.id, { variants: existing, activeVariant: newActive });
    if (editingVariant === key) setEditingVariant(null);
  }, [shape, onUpdate, activeVariant, editingVariant]);

  const updateVariantProp = useCallback(
    (variantKey: string, propKey: string, value: unknown) => {
      if (!shape) return;
      const existing = { ...(shape.variants ?? {}) };
      const existingVariant = { ...(existing[variantKey] ?? { label: variantKey }) };
      (existingVariant as Record<string, unknown>)[propKey] = value;
      existing[variantKey] = existingVariant as ShapeVariant;
      onUpdate(shape.id, { variants: existing });
    },
    [shape, onUpdate],
  );

  const clearVariantProp = useCallback(
    (variantKey: string, propKey: string) => {
      if (!shape) return;
      const existing = { ...(shape.variants ?? {}) };
      const existingVariant = { ...(existing[variantKey] ?? { label: variantKey }) };
      delete (existingVariant as Record<string, unknown>)[propKey];
      existing[variantKey] = existingVariant as ShapeVariant;
      onUpdate(shape.id, { variants: existing });
    },
    [shape, onUpdate],
  );

  const editingVariantData = editingVariant && editingVariant !== 'Default'
    ? (variants[editingVariant] ?? { label: editingVariant })
    : null;

  return (
    <div
      style={{
        position: 'fixed', top: 56, right: 340, width: 308,
        maxHeight: 'calc(100vh - 80px)',
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        zIndex: 310,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #e2e8f0)' }}>
            🎭 Component Variants
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
            {shape.name || shape.type} · {allVariantKeys.length} state{allVariantKeys.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 4, borderRadius: 4 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Active variant indicator */}
        <div style={{ padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent, #6366f1)' }} />
          <span style={{ fontSize: 11, color: 'var(--text, #e2e8f0)', fontWeight: 600 }}>
            Active: <strong style={{ color: 'var(--accent, #6366f1)' }}>{activeVariant}</strong>
          </span>
          {activeVariant !== 'Default' && (
            <button
              onClick={() => activateVariant('Default')}
              style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--muted, #888)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
            >
              Reset to Default
            </button>
          )}
        </div>

        {/* Variants list */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            States
          </div>

          {/* Default state */}
          <VariantSwatch
            base={shape}
            variantName="Default"
            variant={{ label: 'Default' }}
            isActive={activeVariant === 'Default'}
            onClick={() => activateVariant('Default')}
            onDelete={() => {}}
          />

          {/* Custom variants */}
          {Object.entries(variants).filter(([k]) => k !== 'Default').map(([key, variant]) => (
            <div key={key}>
              <VariantSwatch
                base={shape}
                variantName={key}
                variant={variant}
                isActive={activeVariant === key}
                onClick={() => {
                  activateVariant(key);
                  setEditingVariant(editingVariant === key ? null : key);
                }}
                onDelete={() => deleteVariant(key)}
              />
              {/* Inline property editor */}
              {editingVariant === key && (
                <div
                  style={{
                    background: 'var(--panel-alt, #252535)',
                    border: '1px solid var(--accent, #6366f1)',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    padding: '10px 10px',
                    marginTop: -4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent, #6366f1)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                    Override Properties
                  </div>
                  {VISUAL_PROPS.map(({ key: propKey, label, type, ...rest }) => {
                    const currentVal = (editingVariantData as Record<string, unknown> | null)?.[propKey];
                    const hasOverride = currentVal !== undefined;
                    return (
                      <div key={propKey} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: hasOverride ? 'var(--text, #e2e8f0)' : 'var(--muted, #888)', fontWeight: hasOverride ? 700 : 400, flex: 1, minWidth: 0 }}>
                          {label}
                        </span>
                        {type === 'color' && (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {hasOverride && <ColorSwatch color={String(currentVal)} />}
                            <input
                              type="color"
                              value={hasOverride ? String(currentVal) : ((shape as unknown as Record<string, unknown>)[propKey] as string) || '#ffffff'}
                              onChange={(e) => updateVariantProp(key, propKey, e.target.value)}
                              style={{ width: 24, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'none', padding: 0 }}
                            />
                          </div>
                        )}
                        {type === 'opacity' && (
                          <input
                            type="number"
                            min={0} max={1} step={0.05}
                            value={hasOverride ? Number(currentVal) : ''}
                            placeholder="—"
                            onChange={(e) => updateVariantProp(key, propKey, Number(e.target.value))}
                            style={{ width: 48, background: 'var(--panel, #1e1e2e)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, padding: '2px 4px', fontSize: 9, color: 'var(--text, #e2e8f0)', textAlign: 'right', outline: 'none' }}
                          />
                        )}
                        {(type === 'number') && (
                          <input
                            type="number"
                            min={(rest as { min?: number }).min} max={(rest as { max?: number }).max}
                            value={hasOverride ? Number(currentVal) : ''}
                            placeholder="—"
                            onChange={(e) => updateVariantProp(key, propKey, Number(e.target.value))}
                            style={{ width: 48, background: 'var(--panel, #1e1e2e)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, padding: '2px 4px', fontSize: 9, color: 'var(--text, #e2e8f0)', textAlign: 'right', outline: 'none' }}
                          />
                        )}
                        {type === 'text' && (
                          <input
                            type="text"
                            value={hasOverride ? String(currentVal) : ''}
                            placeholder="inherit"
                            onChange={(e) => updateVariantProp(key, propKey, e.target.value)}
                            style={{ width: 56, background: 'var(--panel, #1e1e2e)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4, padding: '2px 4px', fontSize: 9, color: 'var(--text, #e2e8f0)', outline: 'none' }}
                          />
                        )}
                        {hasOverride && (
                          <button
                            onClick={() => clearVariantProp(key, propKey)}
                            title="Remove override"
                            style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Add variant */}
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              onClick={() => { setShowTemplates(t => !t); setShowAddInput(false); }}
              style={{
                flex: 1, padding: '6px 0', background: 'transparent', border: '1px dashed var(--border, #2d2d3d)',
                borderRadius: 7, color: 'var(--muted, #888)', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              }}
            >
              + From template
            </button>
            <button
              onClick={() => { setShowAddInput(a => !a); setShowTemplates(false); }}
              style={{
                flex: 1, padding: '6px 0', background: 'transparent', border: '1px dashed var(--border, #2d2d3d)',
                borderRadius: 7, color: 'var(--muted, #888)', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              }}
            >
              + Custom name
            </button>
          </div>

          {/* Custom name input */}
          {showAddInput && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                autoFocus
                type="text"
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustomVariant(); if (e.key === 'Escape') { setShowAddInput(false); setNewVariantName(''); } }}
                placeholder="Variant name…"
                style={{ flex: 1, background: 'var(--input-bg, #13131f)', border: '1px solid var(--accent, #6366f1)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: 'var(--text, #e2e8f0)', outline: 'none' }}
              />
              <button
                onClick={addCustomVariant}
                style={{ padding: '5px 10px', background: 'var(--accent, #6366f1)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Add
              </button>
            </div>
          )}

          {/* Template picker */}
          {showTemplates && (
            <div style={{ background: 'var(--panel-alt, #252535)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '6px 10px', fontSize: 9, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
                Choose a state template
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {VARIANT_TEMPLATES.filter(t => t.label !== 'Default').map((template) => {
                  const exists = !!variants[template.label];
                  return (
                    <button
                      key={template.label}
                      onClick={() => addVariantFromTemplate(template)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px',
                        background: 'none', border: 'none', borderBottom: '1px solid var(--border, #2d2d3d)',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{template.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text, #e2e8f0)' }}>{template.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--muted, #888)' }}>{template.description}</div>
                      </div>
                      {exists && <span style={{ fontSize: 9, color: 'var(--accent, #6366f1)', fontWeight: 700 }}>exists</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Usage hint */}
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '8px 10px', fontSize: 9, color: 'var(--muted, #888)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--accent, #6366f1)' }}>How it works:</strong> Click a state to activate it. In code export, all variants generate CSS overrides. Use in prototype mode to show state transitions.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border, #2d2d3d)', fontSize: 10, color: 'var(--muted, #888)', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>{allVariantKeys.length} state{allVariantKeys.length !== 1 ? 's' : ''} · {VARIANT_TEMPLATES.length - 1} templates</span>
        <span>⌘⇧⌥W</span>
      </div>
    </div>
  );
}
