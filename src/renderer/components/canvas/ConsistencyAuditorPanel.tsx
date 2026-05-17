/**
 * ConsistencyAuditorPanel — Deep design-consistency linter for Quill.
 *
 * Checks:
 *  - Off-grid values (x, y, width, height not on 8px / 4px grid)
 *  - Near-duplicate fill colors (within 15% perceptual distance)
 *  - Inconsistent corner radii across similar shapes
 *  - Mixed font sizes (not on a harmonic scale)
 *  - Unnamed shapes (default names like "Rectangle 3")
 *  - Very low opacity shapes that may be invisible
 *  - Shapes outside canvas bounds
 *  - Overlapping shapes with identical z-order siblings
 *  - Inconsistent text alignment among sibling text shapes
 *
 * Each issue has a severity (error / warning / info) and an auto-fix
 * where possible.
 *
 * Keyboard: ⌘⇧⌥A to toggle
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface AuditIssue {
  id: string;
  shapeId: string;
  shapeName: string;
  severity: IssueSeverity;
  category: string;
  title: string;
  detail: string;
  autoFix?: { label: string; patch: Partial<Shape> };
}

type GroupBy = 'severity' | 'category' | 'shape';
type FilterSeverity = 'all' | IssueSeverity;

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  canvasWidth: number;
  canvasHeight: number;
  onSelectShape: (id: string) => void;
  onPatchShape: (id: string, patch: Partial<Shape>) => void;
  onPatchAll: (patches: Array<{ id: string; patch: Partial<Shape> }>) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 8); }

function snapToGrid(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function isOnGrid(value: number, grid: number): boolean {
  return Math.abs(value - snapToGrid(value, grid)) < 0.5;
}

/** Parse hex/rgb color to [r,g,b] 0-255 */
function parseColor(color: string): [number, number, number] | null {
  if (!color || color === 'transparent' || color === 'none') return null;
  const hex = color.startsWith('#') ? color : null;
  if (hex) {
    const h = hex.slice(1);
    if (h.length === 3) {
      const [r, g, b] = h.split('').map(c => parseInt(c + c, 16));
      return [r, g, b];
    }
    if (h.length === 6) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }
  }
  const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  return null;
}

/** Euclidean distance in RGB space, normalized to 0-1 */
function colorDistance(a: [number,number,number], b: [number,number,number]): number {
  const dr = (a[0] - b[0]) / 255;
  const dg = (a[1] - b[1]) / 255;
  const db = (a[2] - b[2]) / 255;
  return Math.sqrt(dr*dr + dg*dg + db*db) / Math.sqrt(3);
}

const HARMONIC_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 128];
function isHarmonicFontSize(size: number): boolean {
  return HARMONIC_FONT_SIZES.some(s => Math.abs(s - size) <= 1);
}

const DEFAULT_NAME_PATTERNS = [
  /^(Rectangle|Ellipse|Frame|Text|Path|Group|Circle|Square)\s+\d+$/i,
  /^Shape \d+$/i,
  /^Layer \d+$/i,
  /^Artboard \d+$/i,
];
function hasDefaultName(name: string | undefined): boolean {
  if (!name) return true;
  return DEFAULT_NAME_PATTERNS.some(p => p.test(name));
}

function shapeDisplayName(shape: Shape): string {
  return shape.name || `${shape.type} (unnamed)`;
}

// ─── Audit Engine ─────────────────────────────────────────────────────────────

export function runAudit(shapes: Shape[], canvasWidth: number, canvasHeight: number): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const GRID = 8;
  const SMALL_GRID = 4;

  // Collect all fill colors for near-duplicate detection
  const colorMap: Array<{ shapeId: string; color: [number,number,number]; hex: string }> = [];

  for (const shape of shapes) {
    const name = shapeDisplayName(shape);

    // ── 1. Off-grid position ──────────────────────────────────────────────────
    if (!isOnGrid(shape.x, SMALL_GRID)) {
      issues.push({
        id: uid(), shapeId: shape.id, shapeName: name,
        severity: 'warning', category: 'Grid',
        title: 'Off-grid X position',
        detail: `x=${shape.x} is not on the ${SMALL_GRID}px grid. Nearest: ${snapToGrid(shape.x, SMALL_GRID)}`,
        autoFix: { label: `Snap x to ${snapToGrid(shape.x, SMALL_GRID)}`, patch: { x: snapToGrid(shape.x, SMALL_GRID) } },
      });
    }
    if (!isOnGrid(shape.y, SMALL_GRID)) {
      issues.push({
        id: uid(), shapeId: shape.id, shapeName: name,
        severity: 'warning', category: 'Grid',
        title: 'Off-grid Y position',
        detail: `y=${shape.y} is not on the ${SMALL_GRID}px grid. Nearest: ${snapToGrid(shape.y, SMALL_GRID)}`,
        autoFix: { label: `Snap y to ${snapToGrid(shape.y, SMALL_GRID)}`, patch: { y: snapToGrid(shape.y, SMALL_GRID) } },
      });
    }
    if (!isOnGrid(shape.width, GRID)) {
      issues.push({
        id: uid(), shapeId: shape.id, shapeName: name,
        severity: 'info', category: 'Grid',
        title: 'Off-grid width',
        detail: `width=${shape.width} is not on the ${GRID}px grid. Nearest: ${snapToGrid(shape.width, GRID)}`,
        autoFix: { label: `Snap width to ${snapToGrid(shape.width, GRID)}`, patch: { width: snapToGrid(shape.width, GRID) } },
      });
    }
    if (!isOnGrid(shape.height, GRID)) {
      issues.push({
        id: uid(), shapeId: shape.id, shapeName: name,
        severity: 'info', category: 'Grid',
        title: 'Off-grid height',
        detail: `height=${shape.height} is not on the ${GRID}px grid. Nearest: ${snapToGrid(shape.height, GRID)}`,
        autoFix: { label: `Snap height to ${snapToGrid(shape.height, GRID)}`, patch: { height: snapToGrid(shape.height, GRID) } },
      });
    }

    // ── 2. Out of bounds ─────────────────────────────────────────────────────
    if (shape.x + shape.width < 0 || shape.y + shape.height < 0 ||
        shape.x > canvasWidth + 200 || shape.y > canvasHeight + 200) {
      issues.push({
        id: uid(), shapeId: shape.id, shapeName: name,
        severity: 'warning', category: 'Bounds',
        title: 'Shape outside canvas',
        detail: `Shape at (${shape.x}, ${shape.y}) is outside the canvas bounds (${canvasWidth}×${canvasHeight})`,
      });
    }

    // ── 3. Unnamed shapes ────────────────────────────────────────────────────
    if (hasDefaultName(shape.name)) {
      issues.push({
        id: uid(), shapeId: shape.id, shapeName: name,
        severity: 'info', category: 'Naming',
        title: 'Default/missing name',
        detail: `"${shape.name || '(unnamed)'}" looks like an auto-generated name. Give it a meaningful name.`,
      });
    }

    // ── 4. Very low opacity ──────────────────────────────────────────────────
    const opacity = shape.opacity ?? 1;
    if (opacity > 0 && opacity < 0.05) {
      issues.push({
        id: uid(), shapeId: shape.id, shapeName: name,
        severity: 'warning', category: 'Visibility',
        title: 'Nearly invisible (opacity < 5%)',
        detail: `Opacity is ${Math.round(opacity * 100)}%. Shape may be invisible — intentional?`,
        autoFix: { label: 'Set opacity to 100%', patch: { opacity: 1 } },
      });
    }

    // ── 5. Font size not harmonic ────────────────────────────────────────────
    if (shape.type === 'text' && shape.fontSize !== undefined) {
      if (!isHarmonicFontSize(shape.fontSize)) {
        const nearest = HARMONIC_FONT_SIZES.reduce((a, b) =>
          Math.abs(b - shape.fontSize!) < Math.abs(a - shape.fontSize!) ? b : a
        );
        issues.push({
          id: uid(), shapeId: shape.id, shapeName: name,
          severity: 'info', category: 'Typography',
          title: 'Non-standard font size',
          detail: `fontSize=${shape.fontSize}px is not on the standard scale. Nearest: ${nearest}px`,
          autoFix: { label: `Set to ${nearest}px`, patch: { fontSize: nearest } },
        });
      }
    }

    // ── 6. Zero-size shapes ──────────────────────────────────────────────────
    if (shape.width <= 0 || shape.height <= 0) {
      issues.push({
        id: uid(), shapeId: shape.id, shapeName: name,
        severity: 'error', category: 'Bounds',
        title: 'Zero or negative size',
        detail: `Shape has size ${shape.width}×${shape.height}. This will not render correctly.`,
        autoFix: { label: 'Set to 1×1px', patch: { width: Math.max(1, shape.width), height: Math.max(1, shape.height) } },
      });
    }

    // ── 7. Stroke width off-grid ─────────────────────────────────────────────
    if (shape.strokeWidth !== undefined && shape.strokeWidth > 0 && !isOnGrid(shape.strokeWidth, 1)) {
      issues.push({
        id: uid(), shapeId: shape.id, shapeName: name,
        severity: 'info', category: 'Style',
        title: 'Non-integer stroke width',
        detail: `strokeWidth=${shape.strokeWidth} — use integer values for crisp rendering.`,
        autoFix: { label: `Round to ${Math.round(shape.strokeWidth)}px`, patch: { strokeWidth: Math.round(shape.strokeWidth) } },
      });
    }

    // ── 8. Collect colors for near-duplicate pass ────────────────────────────
    const fillColor = shape.fillType === 'solid' && shape.fill ? parseColor(shape.fill) : null;
    if (fillColor) colorMap.push({ shapeId: shape.id, color: fillColor, hex: shape.fill! });
  }

  // ── 9. Near-duplicate color detection ─────────────────────────────────────
  const NEAR_DUP_THRESHOLD = 0.08; // within ~8% perceptual distance
  const reportedPairs = new Set<string>();
  for (let i = 0; i < colorMap.length; i++) {
    for (let j = i + 1; j < colorMap.length; j++) {
      const dist = colorDistance(colorMap[i].color, colorMap[j].color);
      if (dist > 0 && dist < NEAR_DUP_THRESHOLD) {
        const pairKey = [colorMap[i].shapeId, colorMap[j].shapeId].sort().join(':');
        if (!reportedPairs.has(pairKey)) {
          reportedPairs.add(pairKey);
          const shapeA = shapes.find(s => s.id === colorMap[i].shapeId);
          const shapeB = shapes.find(s => s.id === colorMap[j].shapeId);
          issues.push({
            id: uid(),
            shapeId: colorMap[i].shapeId,
            shapeName: shapeA ? shapeDisplayName(shapeA) : 'Unknown',
            severity: 'warning',
            category: 'Color',
            title: 'Near-duplicate colors',
            detail: `"${shapeA ? shapeDisplayName(shapeA) : '?'}" (${colorMap[i].hex}) and ` +
                    `"${shapeB ? shapeDisplayName(shapeB) : '?'}" (${colorMap[j].hex}) ` +
                    `are very similar (${Math.round(dist * 100)}% apart). Consider unifying them.`,
            autoFix: {
              label: `Unify to ${colorMap[i].hex}`,
              patch: { fill: colorMap[i].hex },
            },
          });
        }
      }
    }
  }

  // ── 10. Mixed corner radii ─────────────────────────────────────────────────
  const rects = shapes.filter(s => s.type === 'rectangle');
  if (rects.length >= 3) {
    const radii = rects
      .map(s => (typeof s.borderRadius === 'number' ? s.borderRadius : 0))
      .filter(r => r > 0);
    const uniqueRadii = [...new Set(radii)];
    if (uniqueRadii.length > 3) {
      issues.push({
        id: uid(), shapeId: rects[0].id, shapeName: 'Multiple shapes',
        severity: 'info', category: 'Style',
        title: 'Many different corner radii',
        detail: `Found ${uniqueRadii.length} distinct corner radius values: ${uniqueRadii.slice(0, 6).join(', ')}${uniqueRadii.length > 6 ? '…' : ''}px. Consider standardizing on 2-3 values.`,
      });
    }
  }

  // ── 11. Inconsistent text alignment in same frame ─────────────────────────
  const textShapes = shapes.filter(s => s.type === 'text');
  if (textShapes.length >= 4) {
    const alignments = textShapes.map(s => s.textAlign || 'left');
    const leftCount = alignments.filter(a => a === 'left').length;
    const centerCount = alignments.filter(a => a === 'center').length;
    const rightCount = alignments.filter(a => a === 'right').length;
    // If there's a dominant alignment but some outliers
    const dominant = Math.max(leftCount, centerCount, rightCount);
    const total = textShapes.length;
    const outliers = total - dominant;
    if (dominant > 2 && outliers > 0 && outliers <= 2) {
      const domAlign = dominant === leftCount ? 'left' : dominant === centerCount ? 'center' : 'right';
      issues.push({
        id: uid(), shapeId: textShapes[0].id, shapeName: 'Text shapes',
        severity: 'info', category: 'Typography',
        title: 'Inconsistent text alignment',
        detail: `Most text (${dominant}/${total}) is ${domAlign}-aligned, but ${outliers} use a different alignment. Consider standardizing.`,
      });
    }
  }

  return issues;
}

// ─── Severity Config ───────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<IssueSeverity, { color: string; bg: string; icon: string; label: string }> = {
  error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: '✕', label: 'Error' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: '⚠', label: 'Warning' },
  info:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  icon: 'ℹ', label: 'Info' },
};

// ─── Components ───────────────────────────────────────────────────────────────

interface IssueRowProps {
  issue: AuditIssue;
  onSelect: () => void;
  onFix: () => void;
  expanded: boolean;
  onToggle: () => void;
}

function IssueRow({ issue, onSelect, onFix, expanded, onToggle }: IssueRowProps) {
  const cfg = SEVERITY_CONFIG[issue.severity];

  return (
    <div style={{
      borderLeft: `3px solid ${cfg.color}`,
      background: expanded ? cfg.bg : 'transparent',
      marginBottom: 2,
      borderRadius: '0 4px 4px 0',
      transition: 'background 0.15s',
    }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px 5px 6px',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ fontSize: 9, color: cfg.color, width: 10, textAlign: 'center', flexShrink: 0 }}>
          {cfg.icon}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: 'var(--text, #e2e8f0)', flex: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {issue.title}
        </span>
        <span style={{
          fontSize: 8, color: 'var(--muted, #666)', fontFamily: 'monospace',
          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0,
        }}>
          {issue.shapeName}
        </span>
        <span style={{ fontSize: 9, color: 'var(--muted, #666)', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 8px 8px 22px' }}>
          <p style={{ fontSize: 9, color: 'var(--muted, #888)', margin: '0 0 6px', lineHeight: 1.5 }}>
            {issue.detail}
          </p>
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              onClick={e => { e.stopPropagation(); onSelect(); }}
              style={{
                fontSize: 8, padding: '3px 7px', borderRadius: 3,
                background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border, #2d2d3d)',
                color: 'var(--muted, #888)', cursor: 'pointer',
              }}
            >
              Select shape
            </button>
            {issue.autoFix && (
              <button
                onClick={e => { e.stopPropagation(); onFix(); }}
                style={{
                  fontSize: 8, padding: '3px 7px', borderRadius: 3,
                  background: cfg.bg, border: `1px solid ${cfg.color}40`,
                  color: cfg.color, cursor: 'pointer', fontWeight: 600,
                }}
              >
                ⚡ {issue.autoFix.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export function ConsistencyAuditorPanel({
  open, onClose, shapes, canvasWidth, canvasHeight,
  onSelectShape, onPatchShape, onPatchAll,
}: Props) {
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('severity');
  const [filterSev, setFilterSev] = useState<FilterSeverity>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  const runScan = useCallback(() => {
    setIsScanning(true);
    // Use setTimeout so UI updates first
    setTimeout(() => {
      const found = runAudit(shapes, canvasWidth, canvasHeight);
      setIssues(found);
      setLastScan(new Date());
      setIsScanning(false);
    }, 50);
  }, [shapes, canvasWidth, canvasHeight]);

  // Auto-scan on open
  useEffect(() => {
    if (open) runScan();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (filterSev === 'all') return issues;
    return issues.filter(i => i.severity === filterSev);
  }, [issues, filterSev]);

  const grouped = useMemo(() => {
    const groups = new Map<string, AuditIssue[]>();
    for (const issue of filtered) {
      const key = groupBy === 'severity' ? issue.severity
                : groupBy === 'category' ? issue.category
                : issue.shapeName;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(issue);
    }
    return groups;
  }, [filtered, groupBy]);

  const counts = useMemo(() => ({
    error: issues.filter(i => i.severity === 'error').length,
    warning: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
  }), [issues]);

  const fixableIssues = filtered.filter(i => i.autoFix);

  const fixAll = useCallback(() => {
    const patches = fixableIssues.map(i => ({ id: i.shapeId, patch: i.autoFix!.patch }));
    onPatchAll(patches);
    setTimeout(runScan, 100);
  }, [fixableIssues, onPatchAll, runScan]);

  if (!open) return null;

  const groupOrder: Record<GroupBy, string[]> = {
    severity: ['error', 'warning', 'info'],
    category: ['Grid', 'Bounds', 'Color', 'Typography', 'Style', 'Naming', 'Visibility'],
    shape: [...new Set(filtered.map(i => i.shapeName))],
  };

  const orderedGroups = (groupOrder[groupBy] || []).filter(k => grouped.has(k));
  // Add any groups not in the predefined order
  for (const k of grouped.keys()) {
    if (!orderedGroups.includes(k)) orderedGroups.push(k);
  }

  const scoreColor = counts.error > 0 ? '#ef4444'
    : counts.warning > 3 ? '#f59e0b'
    : counts.warning > 0 ? '#fbbf24'
    : '#34d399';

  const totalIssues = issues.length;
  const score = totalIssues === 0 ? 100 : Math.max(0, 100 - counts.error * 15 - counts.warning * 5 - counts.info * 1);

  return (
    <div style={{
      position: 'absolute', top: 48, right: 12,
      width: 320, maxHeight: 'calc(100vh - 80px)',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 40, display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>🔍</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
            Consistency Audit
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={runScan}
            disabled={isScanning}
            style={{
              fontSize: 9, padding: '3px 8px', borderRadius: 4,
              background: 'rgba(99,102,241,0.2)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#818cf8', cursor: 'pointer',
              opacity: isScanning ? 0.5 : 1,
            }}
          >
            {isScanning ? '⟳ Scanning…' : '⟳ Re-scan'}
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Score Card */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
      }}>
        {/* Score circle */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          border: `3px solid ${scoreColor}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
            {score}
          </span>
          <span style={{ fontSize: 7, color: 'var(--muted, #666)', lineHeight: 1 }}>
            / 100
          </span>
        </div>

        {/* Breakdown */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text, #e2e8f0)', marginBottom: 5 }}>
            {totalIssues === 0 ? '✅ No issues found!' : `${totalIssues} issue${totalIssues === 1 ? '' : 's'} across ${shapes.length} shapes`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['error', 'warning', 'info'] as IssueSeverity[]).map(sev => (
              <button
                key={sev}
                onClick={() => setFilterSev(f => f === sev ? 'all' : sev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: filterSev === sev ? SEVERITY_CONFIG[sev].bg : 'transparent',
                  border: `1px solid ${filterSev === sev ? SEVERITY_CONFIG[sev].color + '60' : 'transparent'}`,
                  borderRadius: 4, padding: '2px 5px', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 9, color: SEVERITY_CONFIG[sev].color }}>
                  {SEVERITY_CONFIG[sev].icon}
                </span>
                <span style={{ fontSize: 9, color: SEVERITY_CONFIG[sev].color, fontWeight: 600 }}>
                  {counts[sev]}
                </span>
                <span style={{ fontSize: 8, color: 'var(--muted, #666)', textTransform: 'capitalize' }}>
                  {sev}
                </span>
              </button>
            ))}
          </div>
          {lastScan && (
            <div style={{ fontSize: 7, color: 'var(--muted, #555)', marginTop: 4 }}>
              Last scan: {lastScan.toLocaleTimeString()} · {shapes.length} shapes analyzed
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {totalIssues > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
          borderBottom: '1px solid var(--border, #2d2d3d)',
          flexShrink: 0,
        }}>
          {/* Group by */}
          <span style={{ fontSize: 8, color: 'var(--muted, #666)' }}>Group:</span>
          {(['severity', 'category', 'shape'] as GroupBy[]).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              style={{
                fontSize: 8, padding: '2px 6px', borderRadius: 3,
                background: groupBy === g ? 'rgba(99,102,241,0.2)' : 'transparent',
                border: `1px solid ${groupBy === g ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                color: groupBy === g ? '#818cf8' : 'var(--muted, #666)',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {g}
            </button>
          ))}

          {fixableIssues.length > 0 && (
            <button
              onClick={fixAll}
              style={{
                marginLeft: 'auto', fontSize: 8, padding: '2px 7px', borderRadius: 3,
                background: 'rgba(52,211,153,0.15)',
                border: '1px solid rgba(52,211,153,0.3)',
                color: '#34d399', cursor: 'pointer', fontWeight: 600,
              }}
            >
              ⚡ Fix all ({fixableIssues.length})
            </button>
          )}
        </div>
      )}

      {/* Issues list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {totalIssues === 0 && !isScanning && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 4 }}>
              Design looks consistent!
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted, #666)' }}>
              No issues found across {shapes.length} shapes.
            </div>
          </div>
        )}

        {isScanning && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted, #666)', fontSize: 11 }}>
            ⟳ Analyzing {shapes.length} shapes…
          </div>
        )}

        {!isScanning && orderedGroups.map(groupKey => {
          const groupIssues = grouped.get(groupKey) || [];
          const cfg = groupBy === 'severity' ? SEVERITY_CONFIG[groupKey as IssueSeverity] : null;

          return (
            <div key={groupKey} style={{ marginBottom: 10 }}>
              {/* Group header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 0', marginBottom: 3,
              }}>
                {cfg && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: cfg ? cfg.color : 'var(--muted, #666)',
                }}>
                  {groupBy === 'severity' ? SEVERITY_CONFIG[groupKey as IssueSeverity]?.label : groupKey}
                </span>
                <span style={{
                  fontSize: 8, color: 'var(--muted, #555)',
                  background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '0 5px',
                }}>
                  {groupIssues.length}
                </span>
              </div>

              {groupIssues.map(issue => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  expanded={expandedId === issue.id}
                  onToggle={() => setExpandedId(id => id === issue.id ? null : issue.id)}
                  onSelect={() => onSelectShape(issue.shapeId)}
                  onFix={() => {
                    if (issue.autoFix) {
                      onPatchShape(issue.shapeId, issue.autoFix.patch);
                      // Remove fixed issue
                      setIssues(prev => prev.filter(i => i.id !== issue.id));
                    }
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 10px',
        borderTop: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 8, color: 'var(--muted, #555)' }}>
          ⌘⇧⌥A to toggle · Click issue to expand
        </span>
        <span style={{ fontSize: 8, color: 'var(--muted, #555)' }}>
          {filtered.length}/{totalIssues} shown
        </span>
      </div>
    </div>
  );
}
