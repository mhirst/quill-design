/**
 * DesignLintPanel — "Design Linter"
 * A floating panel that analyzes your canvas shapes and provides actionable
 * design improvement suggestions (spacing consistency, color contrast, font sizing,
 * alignment issues, etc.) — all computed client-side without an AI call.
 *
 * Shortcut: ⇧L
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { X, AlertTriangle, CheckCircle, Info, Zap } from 'lucide-react';
import type { Shape } from '../../lib/shapes';

// ─── Lint rule types ──────────────────────────────────────────────────────────

type Severity = 'error' | 'warning' | 'info';

interface LintIssue {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  shapeIds?: string[];
  fix?: string;
  fixAction?: () => void;
}

// ─── Contrast helpers ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 21;
  const l1 = luminance(rgb1);
  const l2 = luminance(rgb2);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

// ─── Lint rules ────────────────────────────────────────────────────────────────

function computeIssues(shapes: Shape[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const visibleShapes = shapes.filter(s => !s.hidden);

  // ── Rule 1: Low contrast text ──────────────────────────────────────────────
  const textShapes = visibleShapes.filter(s => s.type === 'text');
  for (const text of textShapes) {
    const textColor = text.color ?? '#000000';
    // Find the shape underneath (approximate: check fill of overlapping shapes)
    const bgColor = text.fill !== 'transparent' ? text.fill : '#ffffff';
    const ratio = contrastRatio(textColor, bgColor);
    if (ratio < 3.0) {
      issues.push({
        id: `low-contrast-${text.id}`,
        severity: 'error',
        title: 'Low text contrast',
        description: `"${text.name || text.text?.slice(0, 20) || 'Text'}" has a contrast ratio of ${ratio.toFixed(1)}:1. WCAG AA requires at least 4.5:1.`,
        shapeIds: [text.id],
        fix: 'Darken text or lighten background',
      });
    } else if (ratio < 4.5) {
      issues.push({
        id: `medium-contrast-${text.id}`,
        severity: 'warning',
        title: 'Text contrast below AA',
        description: `"${text.name || text.text?.slice(0, 20) || 'Text'}" has contrast ${ratio.toFixed(1)}:1. WCAG AA requires 4.5:1 for normal text.`,
        shapeIds: [text.id],
        fix: 'Increase contrast to meet WCAG AA',
      });
    }
  }

  // ── Rule 2: Inconsistent border radius ──────────────────────────────────────
  const rectShapes = visibleShapes.filter(s => s.type === 'rectangle' && s.fill !== 'transparent');
  const radii = rectShapes
    .map(s => (Array.isArray(s.borderRadius) ? s.borderRadius[0] : s.borderRadius))
    .filter(r => r > 0);
  if (radii.length > 2) {
    const uniqueRadii = [...new Set(radii)];
    if (uniqueRadii.length > 3) {
      issues.push({
        id: 'inconsistent-radius',
        severity: 'warning',
        title: 'Inconsistent border radii',
        description: `Found ${uniqueRadii.length} different border radius values (${uniqueRadii.slice(0, 4).join('px, ')}px…). Consider using a consistent scale like 4, 8, 12, or 16px.`,
        fix: 'Standardize border radius to 2-3 values',
      });
    }
  }

  // ── Rule 3: Off-pixel positioning (subpixel rendering) ─────────────────────
  const offPixel = visibleShapes.filter(s => {
    return s.x % 1 !== 0 || s.y % 1 !== 0 || s.width % 1 !== 0 || s.height % 1 !== 0;
  });
  if (offPixel.length > 0) {
    issues.push({
      id: 'off-pixel',
      severity: 'warning',
      title: `${offPixel.length} shape${offPixel.length > 1 ? 's' : ''} not on pixel grid`,
      description: `Sub-pixel positions cause blurry rendering. Shapes should have whole-number positions and dimensions.`,
      shapeIds: offPixel.map(s => s.id),
      fix: 'Round positions to nearest pixel',
    });
  }

  // ── Rule 4: Very small text (below 10px) ───────────────────────────────────
  const tinyText = textShapes.filter(s => (s.fontSize ?? 16) < 10);
  if (tinyText.length > 0) {
    issues.push({
      id: 'tiny-text',
      severity: 'error',
      title: `${tinyText.length} text element${tinyText.length > 1 ? 's' : ''} below 10px`,
      description: `Very small text is unreadable on screen. Minimum recommended size is 12px.`,
      shapeIds: tinyText.map(s => s.id),
      fix: 'Increase font size to at least 12px',
    });
  }

  // ── Rule 5: Overlapping shapes (potential z-order issues) ──────────────────
  let overlaps = 0;
  for (let i = 0; i < visibleShapes.length; i++) {
    for (let j = i + 1; j < visibleShapes.length; j++) {
      const a = visibleShapes[i];
      const b = visibleShapes[j];
      if (a.type === 'frame' || b.type === 'frame') continue; // ignore frames
      const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
      if (overlapX && overlapY) overlaps++;
    }
  }
  if (overlaps > 4) {
    issues.push({
      id: 'many-overlaps',
      severity: 'info',
      title: `${overlaps} shape overlaps detected`,
      description: `Many shapes overlap. If unintentional, check layer order and positioning. Otherwise this is normal for layered designs.`,
      fix: 'Review layer order or use frames to group content',
    });
  }

  // ── Rule 6: Inconsistent font sizes ────────────────────────────────────────
  const fontSizes = textShapes.map(s => s.fontSize ?? 16);
  const uniqueSizes = [...new Set(fontSizes)];
  if (uniqueSizes.length > 5 && textShapes.length > 3) {
    issues.push({
      id: 'inconsistent-sizes',
      severity: 'info',
      title: 'Many different font sizes',
      description: `${uniqueSizes.length} unique font sizes found: ${uniqueSizes.sort((a, b) => a - b).slice(0, 6).join(', ')}… Consider using a type scale (e.g. 12/14/16/20/24/32px).`,
      fix: 'Adopt a consistent type scale',
    });
  }

  // ── Rule 7: No frames (missing structure) ──────────────────────────────────
  const frames = visibleShapes.filter(s => s.type === 'frame');
  if (visibleShapes.length > 8 && frames.length === 0) {
    issues.push({
      id: 'no-frames',
      severity: 'info',
      title: 'No frames defined',
      description: `You have ${visibleShapes.length} shapes but no frames. Frames help organize layouts and are required for prototype navigation and export.`,
      fix: 'Add frames (F key) to organize your design',
    });
  }

  // ── Rule 8: Empty or untitled shapes ──────────────────────────────────────
  const untitled = visibleShapes.filter(s => {
    const defaultNames = ['Rectangle', 'Ellipse', 'Frame', 'Text', 'Path'];
    return defaultNames.some(n => s.name === n || s.name.startsWith(`${n} `));
  });
  if (untitled.length > 3 && visibleShapes.length > 5) {
    issues.push({
      id: 'untitled-shapes',
      severity: 'info',
      title: `${untitled.length} unnamed shapes`,
      description: `Generic names like "Rectangle 1" make collaboration harder. Double-click layer names to rename.`,
      fix: 'Rename shapes with meaningful labels',
    });
  }

  // ── Rule 9: Very large opacity changes ──────────────────────────────────────
  const oddOpacity = visibleShapes.filter(s => s.opacity > 0 && s.opacity < 0.1);
  if (oddOpacity.length > 0) {
    issues.push({
      id: 'very-low-opacity',
      severity: 'warning',
      title: `${oddOpacity.length} shape${oddOpacity.length > 1 ? 's' : ''} nearly invisible`,
      description: `Shape opacity below 10% is almost invisible. These may be accidentally hidden or leftover from editing.`,
      shapeIds: oddOpacity.map(s => s.id),
      fix: 'Delete or increase opacity',
    });
  }

  // ── Rule 10: Shapes outside frame bounds ───────────────────────────────────
  if (frames.length > 0) {
    let outsideCount = 0;
    for (const s of visibleShapes.filter(s => s.type !== 'frame')) {
      const insideAnyFrame = frames.some(f =>
        s.x >= f.x && s.y >= f.y && s.x + s.width <= f.x + f.width && s.y + s.height <= f.y + f.height
      );
      if (!insideAnyFrame) outsideCount++;
    }
    if (outsideCount > 0) {
      issues.push({
        id: 'outside-frame',
        severity: 'info',
        title: `${outsideCount} shape${outsideCount > 1 ? 's' : ''} outside frames`,
        description: `These shapes are not inside any frame and won't appear in prototype mode or frame exports.`,
        fix: 'Move shapes inside a frame',
      });
    }
  }

  // ── Rule 11: Missing fill on frame ─────────────────────────────────────────
  const emptyFrames = frames.filter(f => f.fill === 'transparent' || !f.fill);
  if (emptyFrames.length > 0) {
    issues.push({
      id: 'transparent-frame',
      severity: 'info',
      title: `${emptyFrames.length} frame${emptyFrames.length > 1 ? 's' : ''} with no background`,
      description: `Frames without a background may look unintentional. Add a white or colored fill.`,
      shapeIds: emptyFrames.map(f => f.id),
      fix: 'Add a fill color to frames',
    });
  }

  // ── Rule 12: Perfectly clean design ───────────────────────────────────────
  if (issues.length === 0 && visibleShapes.length > 0) {
    issues.push({
      id: 'all-good',
      severity: 'info',
      title: 'Looking good! No issues found',
      description: 'Your design passes all lint checks. Great work!',
    });
  }

  return issues;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onSelectShape?: (id: string) => void;
}

const SEVERITY_CONFIG = {
  error: { icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', label: 'Error' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', label: 'Warning' },
  info: { icon: Info, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)', label: 'Info' },
};

export function DesignLintPanel({ open, onClose, shapes, onSelectShape }: Props) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const issues = useMemo(() => computeIssues(shapes), [shapes, refreshKey]);

  const filtered = filter === 'all' ? issues : issues.filter(i => i.severity === filter);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 440,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />
      <div style={{
        position: 'relative',
        marginTop: 48, marginRight: 8,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        width: 340,
        maxHeight: 'calc(100vh - 64px)',
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Zap size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
              Design Lint
            </span>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              title="Re-run lint"
              style={{
                background: 'var(--panel-alt)', border: '1px solid var(--border)',
                borderRadius: 5, cursor: 'pointer', color: 'var(--muted)',
                fontSize: 10, fontWeight: 600, padding: '3px 7px',
              }}
            >
              ↻ Refresh
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Summary badges */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'All', value: 'all' as const, count: issues.length },
              { label: 'Errors', value: 'error' as const, count: errorCount, color: '#ef4444' },
              { label: 'Warnings', value: 'warning' as const, count: warnCount, color: '#f59e0b' },
              { label: 'Info', value: 'info' as const, count: infoCount, color: '#6366f1' },
            ].map(({ label, value, count, color }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 20, border: '1px solid',
                  borderColor: filter === value ? (color ?? 'var(--accent)') : 'var(--border)',
                  background: filter === value ? `${color ?? 'var(--accent)'}18` : 'var(--panel-alt)',
                  color: filter === value ? (color ?? 'var(--accent)') : 'var(--muted)',
                  cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  transition: 'all 0.1s',
                }}
              >
                {count > 0 && (
                  <span style={{
                    background: filter === value ? (color ?? 'var(--accent)') : 'var(--border)',
                    color: filter === value ? '#fff' : 'var(--muted)',
                    borderRadius: 10, padding: '0 4px', fontSize: 9, fontWeight: 700,
                    minWidth: 14, textAlign: 'center',
                  }}>
                    {count}
                  </span>
                )}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Issues list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '32px 0', color: 'var(--muted)', gap: 8,
            }}>
              <CheckCircle size={32} style={{ color: '#22c55e' }} />
              <span style={{ fontSize: 12 }}>No {filter === 'all' ? '' : filter + ' '}issues</span>
            </div>
          ) : (
            filtered.map(issue => {
              const cfg = SEVERITY_CONFIG[issue.severity];
              const Icon = cfg.icon;
              return (
                <div
                  key={issue.id}
                  style={{
                    marginBottom: 8, padding: '10px 12px',
                    borderRadius: 8, border: `1px solid ${cfg.border}`,
                    background: cfg.bg,
                  }}
                >
                  {/* Issue header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <Icon size={13} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flex: 1, lineHeight: 1.3 }}>
                      {issue.title}
                    </span>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 6px 21px', lineHeight: 1.5 }}>
                    {issue.description}
                  </p>

                  {/* Fix suggestion */}
                  {issue.fix && (
                    <div style={{
                      fontSize: 10, color: cfg.color,
                      fontWeight: 600, marginLeft: 21,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span>→</span> {issue.fix}
                    </div>
                  )}

                  {/* Select affected shapes */}
                  {issue.shapeIds && issue.shapeIds.length > 0 && onSelectShape && (
                    <div style={{ marginTop: 6, marginLeft: 21, display: 'flex', gap: 4 }}>
                      {issue.shapeIds.slice(0, 3).map(id => {
                        const shape = shapes.find(s => s.id === id);
                        return shape ? (
                          <button
                            key={id}
                            onClick={() => onSelectShape(id)}
                            style={{
                              padding: '2px 6px', borderRadius: 4,
                              border: `1px solid ${cfg.border}`,
                              background: 'transparent',
                              color: cfg.color, cursor: 'pointer',
                              fontSize: 9, fontWeight: 600,
                            }}
                          >
                            {shape.name || shape.type}
                          </button>
                        ) : null;
                      })}
                      {issue.shapeIds.length > 3 && (
                        <span style={{ fontSize: 9, color: 'var(--muted)', alignSelf: 'center' }}>
                          +{issue.shapeIds.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 14px', borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--subtle)', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{shapes.filter(s => !s.hidden).length} visible shapes analyzed</span>
          <span style={{ color: errorCount > 0 ? '#ef4444' : warnCount > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
            {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : warnCount > 0 ? `${warnCount} warning${warnCount > 1 ? 's' : ''}` : '✓ Clean'}
          </span>
        </div>
      </div>
    </div>
  );
}
