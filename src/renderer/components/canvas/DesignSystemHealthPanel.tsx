/**
 * DesignSystemHealthPanel — Design system compliance auditor
 *
 * Features:
 *  - Configurable design system rules (spacing scale, type scale, color palette)
 *  - Auto-scan all shapes on open
 *  - Violations grouped by severity: Error, Warning, Info
 *  - Click violation → select offending shape
 *  - Auto-fix suggestions: snap to nearest allowed value
 *  - Overall health score (0–100) with gauge visualization
 *  - Export full audit report as JSON
 *  - Rule categories: Spacing, Typography, Color, Sizing, Naming
 *  - Filter by category or severity
 *  - ⌘⌥⇧D shortcut
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ViolationSeverity = 'error' | 'warning' | 'info';
export type ViolationCategory = 'spacing' | 'typography' | 'color' | 'sizing' | 'naming';

export interface DesignViolation {
  id: string;
  shapeId: string;
  shapeName: string;
  category: ViolationCategory;
  severity: ViolationSeverity;
  rule: string;
  message: string;
  currentValue: string;
  suggestedValue?: string;
  autoFixable: boolean;
}

export interface DesignSystemConfig {
  spacingScale: number[];      // allowed spacing values e.g. [4,8,12,16,24,32,48,64]
  typeSizes: number[];         // allowed font sizes
  colorPalette: string[];      // allowed hex colors (lowercase)
  maxColors: number;           // max distinct colors in design
  maxFontSizes: number;        // max distinct font sizes
  requireNames: boolean;       // shapes must have a non-default name
  maxShapeCount: number;       // warn if too many shapes
}

// ── Utilities (exported for tests) ────────────────────────────────────────────

export const DEFAULT_CONFIG: DesignSystemConfig = {
  spacingScale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128],
  typeSizes: [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72],
  colorPalette: [],   // empty = no palette restrictions
  maxColors: 8,
  maxFontSizes: 6,
  requireNames: false,
  maxShapeCount: 200,
};

/** Find the nearest value in an array */
export function nearestValue(value: number, allowed: number[]): number {
  if (allowed.length === 0) return value;
  return allowed.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

/** Check if a value is within tolerance of any allowed value */
export function isOnScale(value: number, scale: number[], tolerance = 0.5): boolean {
  return scale.some(s => Math.abs(s - value) <= tolerance);
}

/** Normalize a hex color to lowercase 6-char form */
export function normalizeHexColor(hex: string): string {
  const clean = hex.replace('#', '').toLowerCase();
  if (clean.length === 3) {
    return '#' + clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  return '#' + clean.slice(0, 6);
}

/** Get all distinct colors used across shapes */
export function collectColors(shapes: Shape[]): string[] {
  const colors = new Set<string>();
  for (const s of shapes) {
    if (s.fill && s.fill !== 'transparent' && s.fill.startsWith('#')) {
      colors.add(normalizeHexColor(s.fill));
    }
    if (s.stroke && s.stroke.startsWith('#')) {
      colors.add(normalizeHexColor(s.stroke));
    }
  }
  return [...colors];
}

/** Get all distinct font sizes used across shapes */
export function collectFontSizes(shapes: Shape[]): number[] {
  const sizes = new Set<number>();
  for (const s of shapes) {
    if (s.fontSize && typeof s.fontSize === 'number') sizes.add(s.fontSize);
  }
  return [...sizes].sort((a, b) => a - b);
}

/** Run all design system audits */
export function auditDesignSystem(shapes: Shape[], config: DesignSystemConfig): DesignViolation[] {
  const violations: DesignViolation[] = [];
  let vid = 0;
  const nextId = () => `v-${vid++}`;

  // Shape count check
  if (shapes.length > config.maxShapeCount) {
    violations.push({
      id: nextId(), shapeId: '', shapeName: 'Canvas', category: 'sizing',
      severity: 'warning', rule: 'MAX_SHAPES',
      message: `Canvas has ${shapes.length} shapes (limit: ${config.maxShapeCount})`,
      currentValue: String(shapes.length), autoFixable: false,
    });
  }

  // Color variety check
  const allColors = collectColors(shapes);
  if (allColors.length > config.maxColors) {
    violations.push({
      id: nextId(), shapeId: '', shapeName: 'Canvas', category: 'color',
      severity: 'warning', rule: 'TOO_MANY_COLORS',
      message: `${allColors.length} distinct colors (limit: ${config.maxColors})`,
      currentValue: String(allColors.length), autoFixable: false,
    });
  }

  // Font size variety check
  const allFontSizes = collectFontSizes(shapes);
  if (allFontSizes.length > config.maxFontSizes) {
    violations.push({
      id: nextId(), shapeId: '', shapeName: 'Canvas', category: 'typography',
      severity: 'warning', rule: 'TOO_MANY_FONT_SIZES',
      message: `${allFontSizes.length} distinct font sizes (limit: ${config.maxFontSizes})`,
      currentValue: allFontSizes.join(', '), autoFixable: false,
    });
  }

  for (const shape of shapes) {
    const name = shape.name || `${shape.type} (unnamed)`;

    // Naming rule
    if (config.requireNames && (!shape.name || shape.name === shape.type)) {
      violations.push({
        id: nextId(), shapeId: shape.id, shapeName: name, category: 'naming',
        severity: 'info', rule: 'MISSING_NAME',
        message: 'Shape has no custom name',
        currentValue: shape.name || '(none)', autoFixable: false,
      });
    }

    // Spacing: x position on scale
    if (config.spacingScale.length > 0 && !isOnScale(shape.x, config.spacingScale)) {
      const snap = nearestValue(shape.x, config.spacingScale);
      violations.push({
        id: nextId(), shapeId: shape.id, shapeName: name, category: 'spacing',
        severity: 'info', rule: 'X_OFF_SCALE',
        message: `X position ${Math.round(shape.x)}px is not on spacing scale`,
        currentValue: String(Math.round(shape.x)), suggestedValue: String(snap), autoFixable: true,
      });
    }

    // Spacing: y position on scale
    if (config.spacingScale.length > 0 && !isOnScale(shape.y, config.spacingScale)) {
      const snap = nearestValue(shape.y, config.spacingScale);
      violations.push({
        id: nextId(), shapeId: shape.id, shapeName: name, category: 'spacing',
        severity: 'info', rule: 'Y_OFF_SCALE',
        message: `Y position ${Math.round(shape.y)}px is not on spacing scale`,
        currentValue: String(Math.round(shape.y)), suggestedValue: String(snap), autoFixable: true,
      });
    }

    // Typography: font size on scale
    if (shape.fontSize && config.typeSizes.length > 0) {
      if (!isOnScale(shape.fontSize, config.typeSizes)) {
        const snap = nearestValue(shape.fontSize, config.typeSizes);
        violations.push({
          id: nextId(), shapeId: shape.id, shapeName: name, category: 'typography',
          severity: 'warning', rule: 'FONT_SIZE_OFF_SCALE',
          message: `Font size ${shape.fontSize}px is not in type scale`,
          currentValue: String(shape.fontSize), suggestedValue: String(snap), autoFixable: true,
        });
      }
    }

    // Color: fill in palette
    if (config.colorPalette.length > 0 && shape.fill && shape.fill.startsWith('#')) {
      const norm = normalizeHexColor(shape.fill);
      if (!config.colorPalette.map(c => normalizeHexColor(c)).includes(norm)) {
        violations.push({
          id: nextId(), shapeId: shape.id, shapeName: name, category: 'color',
          severity: 'warning', rule: 'COLOR_NOT_IN_PALETTE',
          message: `Fill color ${shape.fill} is not in color palette`,
          currentValue: shape.fill, autoFixable: false,
        });
      }
    }

    // Sizing: width on scale
    if (config.spacingScale.length > 0 && shape.type !== 'text') {
      if (!isOnScale(shape.width, config.spacingScale, 1)) {
        const snap = nearestValue(shape.width, config.spacingScale);
        violations.push({
          id: nextId(), shapeId: shape.id, shapeName: name, category: 'sizing',
          severity: 'info', rule: 'WIDTH_OFF_SCALE',
          message: `Width ${Math.round(shape.width)}px not on spacing scale`,
          currentValue: String(Math.round(shape.width)), suggestedValue: String(snap), autoFixable: true,
        });
      }
    }
  }

  return violations;
}

/** Compute health score 0–100 */
export function computeHealthScore(violations: DesignViolation[], shapeCount: number): number {
  if (shapeCount === 0) return 100;
  let penalty = 0;
  for (const v of violations) {
    if (v.severity === 'error') penalty += 10;
    else if (v.severity === 'warning') penalty += 3;
    else penalty += 1;
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}

/** Group violations by category */
export function groupViolationsByCategory(violations: DesignViolation[]): Record<ViolationCategory, DesignViolation[]> {
  const groups: Record<ViolationCategory, DesignViolation[]> = {
    spacing: [], typography: [], color: [], sizing: [], naming: [],
  };
  for (const v of violations) { groups[v.category].push(v); }
  return groups;
}

/** Get auto-fix patches for violations */
export function buildAutoFixes(violations: DesignViolation[]): Array<{ shapeId: string; field: string; value: number }> {
  const fixes: Array<{ shapeId: string; field: string; value: number }> = [];
  for (const v of violations) {
    if (!v.autoFixable || !v.shapeId || !v.suggestedValue) continue;
    const field = v.rule === 'X_OFF_SCALE' ? 'x' : v.rule === 'Y_OFF_SCALE' ? 'y' :
      v.rule === 'FONT_SIZE_OFF_SCALE' ? 'fontSize' : v.rule === 'WIDTH_OFF_SCALE' ? 'width' : null;
    if (field) fixes.push({ shapeId: v.shapeId, field, value: Number(v.suggestedValue) });
  }
  return fixes;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 380,
  width: 420,
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

const SEV_COLOR: Record<ViolationSeverity, string> = {
  error: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
};

const CAT_ICON: Record<ViolationCategory, string> = {
  spacing: '📐', typography: '🔤', color: '🎨', sizing: '📏', naming: '🏷️',
};

const BTN_SM: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid #3a1a1a',
  background: '#2a1010', color: '#e8d5d5', fontSize: 12, cursor: 'pointer',
};

const BTN_ACCENT: React.CSSProperties = {
  ...BTN_SM, background: '#b5533c', border: '1px solid #c4644d', color: '#fff',
};

// ── Health gauge ──────────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Fair' : 'Needs Work';
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  const dash = pct * circ * 0.75; // 3/4 arc
  const gap = circ - dash;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
        <svg width={88} height={88} viewBox="0 0 100 100">
          {/* Background arc */}
          <circle cx={50} cy={50} r={r} fill="none" stroke="#3a1a1a" strokeWidth={8}
            strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
            strokeDashoffset={circ * 0.125}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${dash} ${gap + circ * 0.25}`}
            strokeDashoffset={circ * 0.125}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          paddingBottom: 8,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 9, color: '#9a7a7a' }}>/100</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 2 }}>Design System Health</div>
      </div>
    </div>
  );
}

// ── Violation row ─────────────────────────────────────────────────────────────

function ViolationRow({
  v,
  onSelectShape,
  onAutoFix,
}: {
  v: DesignViolation;
  onSelectShape?: (id: string) => void;
  onAutoFix?: (v: DesignViolation) => void;
}) {
  return (
    <div style={{
      background: '#0d0505',
      border: `1px solid ${SEV_COLOR[v.severity]}22`,
      borderLeft: `3px solid ${SEV_COLOR[v.severity]}`,
      borderRadius: 6,
      padding: '7px 10px',
      marginBottom: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <span style={{ fontSize: 11 }}>{CAT_ICON[v.category]}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, color: SEV_COLOR[v.severity],
              textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            }}>
              {v.severity}
            </span>
            {v.shapeId && (
              <button
                onClick={() => onSelectShape?.(v.shapeId)}
                style={{
                  background: 'none', border: 'none', color: '#9a7a7a',
                  fontSize: 10, cursor: 'pointer', padding: 0, textDecoration: 'underline',
                }}
              >
                {v.shapeName}
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#e8d5d5', marginBottom: 2 }}>{v.message}</div>
          {v.suggestedValue && (
            <div style={{ fontSize: 11, color: '#9a7a7a' }}>
              {v.currentValue} → <span style={{ color: '#10b981' }}>{v.suggestedValue}</span>
            </div>
          )}
        </div>
        {v.autoFixable && onAutoFix && (
          <button
            onClick={() => onAutoFix(v)}
            style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px', color: '#10b981', borderColor: '#10b98133', flexShrink: 0 }}
          >
            Fix
          </button>
        )}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onSelectShape?: (id: string) => void;
  onAutoFix?: (shapeId: string, field: string, value: number) => void;
}

const CATEGORIES: ViolationCategory[] = ['spacing', 'typography', 'color', 'sizing', 'naming'];
const SEVERITIES: ViolationSeverity[] = ['error', 'warning', 'info'];

export function DesignSystemHealthPanel({ open, onClose, shapes, onSelectShape, onAutoFix }: Props) {
  const [config, setConfig] = useState<DesignSystemConfig>(DEFAULT_CONFIG);
  const [filterCategory, setFilterCategory] = useState<ViolationCategory | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<ViolationSeverity | 'all'>('all');
  const [tab, setTab] = useState<'audit' | 'config'>('audit');
  const [exported, setExported] = useState(false);
  const [spacingInput, setSpacingInput] = useState(config.spacingScale.join(', '));
  const [typeInput, setTypeInput] = useState(config.typeSizes.join(', '));

  if (!open) return null;

  const violations = useMemo(() => auditDesignSystem(shapes, config), [shapes, config]);
  const score = useMemo(() => computeHealthScore(violations, shapes.length), [violations, shapes.length]);
  const grouped = useMemo(() => groupViolationsByCategory(violations), [violations]);

  const visible = violations.filter(v => {
    if (filterCategory !== 'all' && v.category !== filterCategory) return false;
    if (filterSeverity !== 'all' && v.severity !== filterSeverity) return false;
    return true;
  });

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warnCount = violations.filter(v => v.severity === 'warning').length;
  const infoCount = violations.filter(v => v.severity === 'info').length;

  const handleExport = () => {
    const report = { score, violations, config, generatedAt: new Date().toISOString(), shapeCount: shapes.length };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
      setExported(true);
      setTimeout(() => setExported(false), 1500);
    });
  };

  const handleAutoFixAll = () => {
    if (!onAutoFix) return;
    const fixes = buildAutoFixes(visible.filter(v => v.autoFixable));
    for (const fix of fixes) {
      onAutoFix(fix.shapeId, fix.field, fix.value);
    }
  };

  const applyScaleInputs = () => {
    const spacing = spacingInput.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n >= 0);
    const types = typeInput.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
    setConfig(prev => ({ ...prev, spacingScale: spacing, typeSizes: types }));
  };

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Design System Health</div>
            <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 1 }}>⌘⌥⇧D · {shapes.length} shapes</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleExport} style={{ ...BTN_SM, fontSize: 11 }}>
              {exported ? '✓' : 'Export'}
            </button>
            <button onClick={onClose} style={{ ...BTN_SM, padding: '4px 8px', fontSize: 14, lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Health gauge */}
        <div style={{ marginTop: 12 }}>
          <HealthGauge score={score} />
        </div>

        {/* Counts */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          {[
            { label: 'Errors', count: errorCount, color: '#ef4444' },
            { label: 'Warnings', count: warnCount, color: '#f59e0b' },
            { label: 'Info', count: infoCount, color: '#3b82f6' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              flex: 1, background: '#2a1010', borderRadius: 6, padding: '6px 10px',
              textAlign: 'center' as const, border: `1px solid ${color}22`,
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: 10, color: '#9a7a7a' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
        {(['audit', 'config'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid #b5533c' : '2px solid transparent',
            color: tab === t ? '#b5533c' : '#9a7a7a', fontSize: 12,
            fontWeight: tab === t ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' as const,
          }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
        {/* ── AUDIT TAB ── */}
        {tab === 'audit' && (
          <div>
            {/* Filters */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                <button onClick={() => setFilterCategory('all')}
                  style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px', ...(filterCategory === 'all' ? { background: '#b5533c', color: '#fff', borderColor: '#c4644d' } : {}) }}>
                  All
                </button>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setFilterCategory(c)}
                    style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px', ...(filterCategory === c ? { background: '#b5533c', color: '#fff', borderColor: '#c4644d' } : {}) }}>
                    {CAT_ICON[c]} {grouped[c].length}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setFilterSeverity('all')}
                  style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px', ...(filterSeverity === 'all' ? { background: '#3a1a1a' } : {}) }}>
                  All
                </button>
                {SEVERITIES.map(s => (
                  <button key={s} onClick={() => setFilterSeverity(s)}
                    style={{ ...BTN_SM, fontSize: 10, padding: '2px 7px', color: filterSeverity === s ? SEV_COLOR[s] : '#9a7a7a', borderColor: filterSeverity === s ? SEV_COLOR[s] + '44' : '#3a1a1a' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Fix all button */}
            {visible.some(v => v.autoFixable) && onAutoFix && (
              <button onClick={handleAutoFixAll} style={{ ...BTN_ACCENT, width: '100%', textAlign: 'center' as const, marginBottom: 10, fontSize: 12 }}>
                Auto-Fix {visible.filter(v => v.autoFixable).length} Violations
              </button>
            )}

            {/* Violation list */}
            {visible.length === 0 ? (
              <div style={{ color: '#10b981', fontSize: 14, textAlign: 'center' as const, padding: '24px 0' }}>
                ✓ No violations found
              </div>
            ) : (
              visible.map(v => (
                <ViolationRow
                  key={v.id}
                  v={v}
                  onSelectShape={onSelectShape}
                  onAutoFix={onAutoFix ? (violation) => {
                    const fixes = buildAutoFixes([violation]);
                    for (const fix of fixes) onAutoFix(fix.shapeId, fix.field, fix.value);
                  } : undefined}
                />
              ))
            )}
          </div>
        )}

        {/* ── CONFIG TAB ── */}
        {tab === 'config' && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#9a7a7a', display: 'block', marginBottom: 4 }}>
                Spacing Scale (comma-separated px values)
              </label>
              <textarea
                value={spacingInput}
                onChange={e => setSpacingInput(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '6px 8px', background: '#2a1010',
                  border: '1px solid #3a1a1a', borderRadius: 6, color: '#e8d5d5',
                  fontSize: 12, fontFamily: 'monospace', resize: 'vertical' as const, boxSizing: 'border-box' as const,
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#9a7a7a', display: 'block', marginBottom: 4 }}>
                Type Scale (comma-separated px values)
              </label>
              <textarea
                value={typeInput}
                onChange={e => setTypeInput(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '6px 8px', background: '#2a1010',
                  border: '1px solid #3a1a1a', borderRadius: 6, color: '#e8d5d5',
                  fontSize: 12, fontFamily: 'monospace', resize: 'vertical' as const, boxSizing: 'border-box' as const,
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                Max Colors
                <input type="number" value={config.maxColors} min={1} max={32}
                  onChange={e => setConfig(c => ({ ...c, maxColors: Number(e.target.value) }))}
                  style={{ display: 'block', width: '100%', marginTop: 3, padding: '4px 8px', background: '#2a1010', border: '1px solid #3a1a1a', borderRadius: 6, color: '#e8d5d5', fontSize: 12 }} />
              </label>
              <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                Max Font Sizes
                <input type="number" value={config.maxFontSizes} min={1} max={12}
                  onChange={e => setConfig(c => ({ ...c, maxFontSizes: Number(e.target.value) }))}
                  style={{ display: 'block', width: '100%', marginTop: 3, padding: '4px 8px', background: '#2a1010', border: '1px solid #3a1a1a', borderRadius: 6, color: '#e8d5d5', fontSize: 12 }} />
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <input type="checkbox" id="req-names" checked={config.requireNames}
                onChange={e => setConfig(c => ({ ...c, requireNames: e.target.checked }))}
                style={{ cursor: 'pointer' }} />
              <label htmlFor="req-names" style={{ fontSize: 12, color: '#e8d5d5', cursor: 'pointer' }}>
                Require named shapes
              </label>
            </div>

            <button onClick={applyScaleInputs} style={{ ...BTN_ACCENT, width: '100%', textAlign: 'center' as const }}>
              Apply Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
