/**
 * DesignIntelPanel — Contextual design intelligence & suggestions.
 *
 * Analyzes the current selection and canvas holistically to surface
 * actionable design improvement tips: spacing, contrast, typography,
 * alignment, color harmony, visual hierarchy, and accessibility.
 *
 * Shortcut: Cmd+Shift+Alt+I
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Shape, ShadowDef } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

type SuggestionSeverity = 'info' | 'tip' | 'warning' | 'error';
type SuggestionCategory =
  | 'spacing'
  | 'typography'
  | 'color'
  | 'contrast'
  | 'alignment'
  | 'hierarchy'
  | 'consistency'
  | 'accessibility'
  | 'performance';

interface Suggestion {
  id: string;
  severity: SuggestionSeverity;
  category: SuggestionCategory;
  title: string;
  body: string;
  action?: {
    label: string;
    apply: () => void;
  };
  relatedShapeIds?: string[];
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [128, 128, 128];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex2rgb(hex1));
  const l2 = luminance(hex2rgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorBrightness(hex: string): number {
  const [r, g, b] = hex2rgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function isDark(hex: string): boolean {
  return colorBrightness(hex) < 128;
}

// ── Analysis functions ────────────────────────────────────────────────────────

function analyzeShapes(shapes: Shape[], selectedIds: string[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const selected = selectedIds.length > 0
    ? shapes.filter((s) => selectedIds.includes(s.id))
    : shapes;

  if (shapes.length === 0) return suggestions;

  // ── 1. ALIGNMENT ANALYSIS ──────────────────────────────────────────────────
  if (selected.length >= 2) {
    // Check if shapes could be aligned on X axis (left edges within 4px)
    const xs = selected.map((s) => s.x);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const ys = selected.map((s) => s.y);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);

    const notAlignedLeft = xs.some((x) => Math.abs(x - xMin) > 0 && Math.abs(x - xMin) < 8);
    if (notAlignedLeft && selected.length >= 2) {
      suggestions.push({
        id: 'align-left-snap',
        severity: 'tip',
        category: 'alignment',
        title: 'Almost left-aligned',
        body: `${selected.length} shapes are nearly left-aligned (within 8px). Snapping to the leftmost edge at x=${xMin} would create a crisper visual baseline.`,
        relatedShapeIds: selected.map((s) => s.id),
      });
    }

    // Check for consistent spacing
    if (selected.length >= 3) {
      const sortedByX = [...selected].sort((a, b) => a.x - b.x);
      const gaps: number[] = [];
      for (let i = 1; i < sortedByX.length; i++) {
        gaps.push(sortedByX[i].x - (sortedByX[i - 1].x + sortedByX[i - 1].width));
      }
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const maxDeviation = Math.max(...gaps.map((g) => Math.abs(g - avgGap)));
      if (maxDeviation > 4 && maxDeviation < 40) {
        suggestions.push({
          id: 'spacing-consistency',
          severity: 'tip',
          category: 'spacing',
          title: 'Uneven spacing detected',
          body: `The horizontal gaps between ${selected.length} shapes vary by up to ${Math.round(maxDeviation)}px. Using the "Distribute Horizontally" command (in Arrange menu) gives equal spacing.`,
          relatedShapeIds: selected.map((s) => s.id),
        });
      }
    }

    // Detect overlapping shapes
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const a = selected[i];
        const b = selected[j];
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        if (overlapX && overlapY) {
          suggestions.push({
            id: `overlap-${a.id}-${b.id}`,
            severity: 'warning',
            category: 'spacing',
            title: 'Overlapping shapes',
            body: `"${a.name || a.type}" and "${b.name || b.type}" are overlapping. Unless intentional (e.g. badge over avatar), this usually indicates a layout issue.`,
            relatedShapeIds: [a.id, b.id],
          });
          break; // Only report one overlap pair
        }
      }
    }
  }

  // ── 2. TYPOGRAPHY ANALYSIS ────────────────────────────────────────────────
  const textShapes = shapes.filter((s) => s.type === 'text');
  if (textShapes.length > 0) {
    // Check for too many font sizes
    const fontSizes = [...new Set(textShapes.map((s) => s.fontSize))];
    if (fontSizes.length > 5) {
      suggestions.push({
        id: 'too-many-font-sizes',
        severity: 'warning',
        category: 'typography',
        title: `${fontSizes.length} different font sizes`,
        body: `Using ${fontSizes.length} distinct font sizes (${fontSizes.sort((a, b) => a - b).join(', ')}px) creates visual noise. A 3–4 step type scale (e.g. 12/16/24/48px) gives better hierarchy.`,
      });
    }

    // Check for too many font weights
    const fontWeights = [...new Set(textShapes.map((s) => s.fontWeight))];
    if (fontWeights.length > 4) {
      suggestions.push({
        id: 'too-many-font-weights',
        severity: 'tip',
        category: 'typography',
        title: `${fontWeights.length} font weights in use`,
        body: `Mixing ${fontWeights.length} weights (${fontWeights.join(', ')}) can feel inconsistent. 2–3 weights (regular + medium + bold) usually covers all hierarchy needs.`,
      });
    }

    // Check for tiny text
    const tinyText = textShapes.filter((s) => s.fontSize < 11);
    if (tinyText.length > 0) {
      suggestions.push({
        id: 'text-too-small',
        severity: 'warning',
        category: 'accessibility',
        title: `${tinyText.length} text element${tinyText.length > 1 ? 's' : ''} below 11px`,
        body: `Text smaller than 11px is hard to read for most users. WCAG recommends minimum 14px for body text. Smallest found: ${Math.min(...tinyText.map(s => s.fontSize))}px.`,
        relatedShapeIds: tinyText.map((s) => s.id),
      });
    }

    // Line height check
    const poorLineHeight = textShapes.filter((s) => s.lineHeight < 1.2 || s.lineHeight > 2.0);
    if (poorLineHeight.length > 0) {
      suggestions.push({
        id: 'line-height',
        severity: 'info',
        category: 'typography',
        title: 'Line height outside recommended range',
        body: `${poorLineHeight.length} text element${poorLineHeight.length > 1 ? 's have' : ' has'} line height outside 1.2–2.0× range. Body text reads best at 1.4–1.6×; headings at 1.1–1.25×.`,
        relatedShapeIds: poorLineHeight.map((s) => s.id),
      });
    }
  }

  // ── 3. COLOR & CONTRAST ANALYSIS ─────────────────────────────────────────
  for (const shape of textShapes) {
    // Find the parent or overlapping shape to check background contrast
    const bgShapes = shapes.filter(
      (s) =>
        s !== shape &&
        s.type !== 'text' &&
        s.x <= shape.x && s.y <= shape.y &&
        s.x + s.width >= shape.x + shape.width &&
        s.y + s.height >= shape.y + shape.height,
    );
    if (bgShapes.length > 0) {
      const bg = bgShapes[bgShapes.length - 1]; // topmost background
      const ratio = contrastRatio(shape.color || '#000000', bg.fill || '#ffffff');
      if (ratio < 3) {
        suggestions.push({
          id: `contrast-fail-${shape.id}`,
          severity: 'error',
          category: 'contrast',
          title: `Low contrast: ${ratio.toFixed(1)}:1 (fail)`,
          body: `Text "${(shape.text || '').slice(0, 30)}" against its background has ${ratio.toFixed(1)}:1 contrast. WCAG AA requires 4.5:1 for normal text, 3:1 for large (18px+ or 14px+ bold).`,
          relatedShapeIds: [shape.id, bg.id],
        });
      } else if (ratio < 4.5) {
        suggestions.push({
          id: `contrast-warn-${shape.id}`,
          severity: 'warning',
          category: 'contrast',
          title: `Low contrast: ${ratio.toFixed(1)}:1 (WCAG AA)`,
          body: `Text "${(shape.text || '').slice(0, 30)}" has ${ratio.toFixed(1)}:1 contrast — passes AA only if text is 18px+ or 14px+ bold. Aim for 4.5:1 or higher for full AA compliance.`,
          relatedShapeIds: [shape.id, bg.id],
        });
      }
    }

    // Check if text color matches background darkness
    const textIsDark = isDark(shape.color || '#000000');
    const bgFill = shape.fill;
    if (bgFill && bgFill !== 'transparent') {
      const bgIsDark = isDark(bgFill);
      if (textIsDark === bgIsDark) {
        suggestions.push({
          id: `same-tone-${shape.id}`,
          severity: 'tip',
          category: 'color',
          title: 'Text and background similar tone',
          body: `Both text and background of "${shape.name || 'text element'}" are ${textIsDark ? 'dark' : 'light'}. High-contrast text/background combinations aid readability significantly.`,
          relatedShapeIds: [shape.id],
        });
      }
    }
  }

  // ── 4. VISUAL HIERARCHY ───────────────────────────────────────────────────
  if (textShapes.length >= 2) {
    const sizes = textShapes.map((s) => s.fontSize).sort((a, b) => b - a);
    const largest = sizes[0];
    const secondLargest = sizes[1];
    const ratio = largest / secondLargest;
    if (ratio < 1.15 && ratio > 1) {
      suggestions.push({
        id: 'hierarchy-ratio',
        severity: 'tip',
        category: 'hierarchy',
        title: 'Weak typographic scale',
        body: `The two largest text sizes (${largest}px and ${secondLargest}px) are very close. A minimum 1.25× step ratio between heading levels creates stronger visual hierarchy.`,
      });
    }
  }

  // ── 5. CONSISTENCY CHECKS ─────────────────────────────────────────────────
  // Border radius consistency
  const nonTextShapes = shapes.filter((s) => s.type !== 'text' && s.type !== 'path');
  if (nonTextShapes.length >= 3) {
    const radii = nonTextShapes.map((s) =>
      typeof s.borderRadius === 'number' ? s.borderRadius : (s.borderRadius?.[0] ?? 0)
    );
    const uniqueRadii = [...new Set(radii)];
    if (uniqueRadii.length > 4) {
      suggestions.push({
        id: 'border-radius-inconsistency',
        severity: 'tip',
        category: 'consistency',
        title: `${uniqueRadii.length} different border radii`,
        body: `Using ${uniqueRadii.length} different corner radii (${uniqueRadii.sort((a, b) => a - b).slice(0, 5).join(', ')}px…) can feel inconsistent. Define 2–3 radius tokens (e.g. 4px/8px/16px) and stick to them.`,
      });
    }

    // Opacity consistency
    const opacities = nonTextShapes.map((s) => s.opacity).filter((o) => o < 1);
    const uniqueOpacities = [...new Set(opacities.map((o) => Math.round(o * 10) / 10))];
    if (uniqueOpacities.length > 3) {
      suggestions.push({
        id: 'opacity-inconsistency',
        severity: 'info',
        category: 'consistency',
        title: 'Multiple opacity levels',
        body: `${opacities.length} shapes use varying transparency. Standardizing to a few opacity steps (10%, 25%, 50%, 75%) keeps the design more cohesive.`,
      });
    }
  }

  // ── 6. LAYOUT & SIZING ────────────────────────────────────────────────────
  // Non-8pt grid values
  const offGrid = selected.filter(
    (s) =>
      s.type !== 'path' &&
      (s.x % 4 !== 0 || s.y % 4 !== 0 || s.width % 4 !== 0 || s.height % 4 !== 0),
  );
  if (offGrid.length > 0 && selected.length > 0) {
    suggestions.push({
      id: 'off-grid',
      severity: 'info',
      category: 'spacing',
      title: `${offGrid.length} shape${offGrid.length > 1 ? 's' : ''} off 4pt grid`,
      body: `Using a 4pt or 8pt baseline grid (multiples of 4/8px for x, y, width, height) makes spacing consistent and designs more systematic. Consider using Snap to Grid.`,
      relatedShapeIds: offGrid.map((s) => s.id),
    });
  }

  // ── 7. MISSING SHADOWS ────────────────────────────────────────────────────
  const frameLike = shapes.filter(
    (s) =>
      s.type === 'frame' || (s.type === 'rectangle' && s.width > 200 && s.height > 100),
  );
  const noShadow = frameLike.filter(
    (s) =>
      !s.shadow &&
      (!s.shadows || (s.shadows as ShadowDef[]).length === 0) &&
      (s.fillOpacity ?? 1) > 0.5 &&
      s.fill !== 'transparent',
  );
  if (noShadow.length > 0 && shapes.length > 1) {
    suggestions.push({
      id: 'add-shadow',
      severity: 'info',
      category: 'hierarchy',
      title: 'Cards/frames without elevation',
      body: `${noShadow.length} large element${noShadow.length > 1 ? 's' : ''} lack a drop shadow. A subtle shadow (0 2px 8px rgba(0,0,0,0.12)) creates depth and separates cards from the background.`,
      relatedShapeIds: noShadow.map((s) => s.id),
    });
  }

  // ── 8. ACCESSIBILITY — touch targets ──────────────────────────────────────
  const smallInteractives = shapes.filter(
    (s) =>
      s.protoLink &&
      (s.width < 44 || s.height < 44),
  );
  if (smallInteractives.length > 0) {
    suggestions.push({
      id: 'touch-target',
      severity: 'warning',
      category: 'accessibility',
      title: `${smallInteractives.length} small interactive target${smallInteractives.length > 1 ? 's' : ''}`,
      body: `Shapes with prototype links should have a minimum 44×44px tap target (Apple HIG / WCAG 2.5.5). Found targets as small as ${Math.min(...smallInteractives.map((s) => Math.min(s.width, s.height)))}px.`,
      relatedShapeIds: smallInteractives.map((s) => s.id),
    });
  }

  // ── 9. PERFORMANCE ────────────────────────────────────────────────────────
  const heavyBlur = shapes.filter((s) => (s.filterBlur ?? 0) > 20 || (s.filterBackdropBlur ?? 0) > 40);
  if (heavyBlur.length > 2) {
    suggestions.push({
      id: 'heavy-blur',
      severity: 'info',
      category: 'performance',
      title: 'Multiple heavy blur effects',
      body: `${heavyBlur.length} shapes use large blur values. In production CSS, multiple backdrop-filter or filter: blur() on the same page can impact GPU performance, especially on mobile.`,
      relatedShapeIds: heavyBlur.map((s) => s.id),
    });
  }

  // ── 10. POSITIVE FEEDBACK ─────────────────────────────────────────────────
  if (suggestions.filter((s) => s.severity === 'error' || s.severity === 'warning').length === 0 && shapes.length > 3) {
    suggestions.push({
      id: 'looking-good',
      severity: 'info',
      category: 'consistency',
      title: '✨ Looking good!',
      body: 'No critical issues detected. Your design passes the basic spacing, contrast, and consistency checks. Keep going!',
    });
  }

  return suggestions;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<SuggestionSeverity, { color: string; bg: string; label: string; icon: string }> = {
  error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: 'Error',   icon: '🔴' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Warning', icon: '🟡' },
  tip:     { color: '#6366f1', bg: 'rgba(99,102,241,0.08)', label: 'Tip',     icon: '💡' },
  info:    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  label: 'Info',    icon: 'ℹ️' },
};

const CATEGORY_ICONS: Record<SuggestionCategory, string> = {
  spacing: '↔',
  typography: 'T',
  color: '🎨',
  contrast: '◑',
  alignment: '⊢',
  hierarchy: '≡',
  consistency: '◎',
  accessibility: '♿',
  performance: '⚡',
};

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  spacing: 'Spacing',
  typography: 'Typography',
  color: 'Color',
  contrast: 'Contrast',
  alignment: 'Alignment',
  hierarchy: 'Hierarchy',
  consistency: 'Consistency',
  accessibility: 'Accessibility',
  performance: 'Performance',
};

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  selectedShapeIds: string[];
  onSelectShape?: (id: string) => void;
}

export function DesignIntelPanel({ open, onClose, shapes, selectedShapeIds, onSelectShape }: Props) {
  const [filterCategory, setFilterCategory] = useState<SuggestionCategory | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<SuggestionSeverity | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastScanned, setLastScanned] = useState(0);

  const suggestions = useMemo(() => {
    return analyzeShapes(shapes, selectedShapeIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, selectedShapeIds, lastScanned]);

  const rescan = useCallback(() => {
    setLastScanned(Date.now());
  }, []);

  if (!open) return null;

  const filteredSugs = suggestions.filter(
    (s) =>
      (filterCategory === 'all' || s.category === filterCategory) &&
      (filterSeverity === 'all' || s.severity === filterSeverity),
  );

  const errorCount = suggestions.filter((s) => s.severity === 'error').length;
  const warnCount = suggestions.filter((s) => s.severity === 'warning').length;
  const tipCount = suggestions.filter((s) => s.severity === 'tip').length;

  const score = Math.max(0, 100 - errorCount * 20 - warnCount * 8 - tipCount * 2);
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  const usedCategories = [...new Set(suggestions.map((s) => s.category))];

  return (
    <div
      style={{
        position: 'fixed', top: 56, right: 340, width: 320,
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
            🧠 Design Intelligence
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
            {shapes.length} shapes · {selectedShapeIds.length > 0 ? `${selectedShapeIds.length} selected` : 'entire canvas'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={rescan}
            style={{ background: 'var(--panel-alt, #252535)', border: '1px solid var(--border, #2d2d3d)', borderRadius: 6, color: 'var(--muted, #888)', fontSize: 10, fontWeight: 600, padding: '3px 8px', cursor: 'pointer' }}
            title="Re-run analysis"
          >
            ↺ Scan
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 4, borderRadius: 4 }}>×</button>
        </div>
      </div>

      {/* Score banner */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border, #2d2d3d)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: `rgba(${scoreColor === '#22c55e' ? '34,197,94' : scoreColor === '#f59e0b' ? '245,158,11' : '239,68,68'},0.06)`,
          flexShrink: 0,
        }}
      >
        {/* Score circle */}
        <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
          <svg viewBox="0 0 48 48" style={{ width: 48, height: 48, transform: 'rotate(-90deg)' }}>
            <circle cx={24} cy={24} r={20} fill="none" stroke="var(--border, #2d2d3d)" strokeWidth={4} />
            <circle
              cx={24} cy={24} r={20}
              fill="none"
              stroke={scoreColor}
              strokeWidth={4}
              strokeDasharray={`${(score / 100) * 125.6} 125.6`}
              strokeLinecap="round"
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: scoreColor }}>
            {score}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)', marginBottom: 4 }}>
            Design Score
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {errorCount > 0 && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>🔴 {errorCount} error{errorCount > 1 ? 's' : ''}</span>}
            {warnCount > 0 && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>🟡 {warnCount} warning{warnCount > 1 ? 's' : ''}</span>}
            {tipCount > 0 && <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>💡 {tipCount} tip{tipCount > 1 ? 's' : ''}</span>}
            {errorCount === 0 && warnCount === 0 && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>✓ No issues</span>}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border, #2d2d3d)', display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
        <button
          onClick={() => setFilterCategory('all')}
          style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: filterCategory === 'all' ? 'var(--accent, #6366f1)' : 'transparent', border: filterCategory === 'all' ? 'none' : '1px solid var(--border, #2d2d3d)', color: filterCategory === 'all' ? '#fff' : 'var(--muted, #888)', cursor: 'pointer' }}
        >
          All ({suggestions.length})
        </button>
        {usedCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: filterCategory === cat ? 'var(--accent, #6366f1)' : 'transparent', border: filterCategory === cat ? 'none' : '1px solid var(--border, #2d2d3d)', color: filterCategory === cat ? '#fff' : 'var(--muted, #888)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Suggestions list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filteredSugs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted, #888)', fontSize: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
            No {filterCategory !== 'all' ? CATEGORY_LABELS[filterCategory] + ' ' : ''}issues found
          </div>
        )}
        {filteredSugs.map((sug) => {
          const cfg = SEVERITY_CONFIG[sug.severity];
          const isExpanded = expanded.has(sug.id);
          return (
            <div
              key={sug.id}
              style={{
                background: cfg.bg,
                border: `1px solid ${cfg.color}33`,
                borderLeft: `3px solid ${cfg.color}`,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(sug.id)) next.delete(sug.id);
                    else next.add(sug.id);
                    return next;
                  });
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 10px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)', lineHeight: 1.3 }}>{sug.title}</div>
                  <div style={{ fontSize: 9, color: cfg.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
                    {CATEGORY_ICONS[sug.category]} {CATEGORY_LABELS[sug.category]}
                    {sug.relatedShapeIds && sug.relatedShapeIds.length > 0 && (
                      <span style={{ color: 'var(--muted, #888)', fontWeight: 400, textTransform: 'none', marginLeft: 4 }}>
                        · {sug.relatedShapeIds.length} shape{sug.relatedShapeIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ color: 'var(--muted, #888)', fontSize: 10, flexShrink: 0 }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>
              {isExpanded && (
                <div style={{ padding: '0 10px 10px 31px', borderTop: `1px solid ${cfg.color}22` }}>
                  <p style={{ fontSize: 11, color: 'var(--muted, #888)', lineHeight: 1.55, margin: '8px 0 0', padding: 0 }}>
                    {sug.body}
                  </p>
                  {sug.relatedShapeIds && sug.relatedShapeIds.length > 0 && onSelectShape && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {sug.relatedShapeIds.slice(0, 4).map((id) => {
                        const s = shapes.find((sh) => sh.id === id);
                        return s ? (
                          <button
                            key={id}
                            onClick={() => onSelectShape(id)}
                            style={{
                              padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                              background: 'var(--panel, #1e1e2e)', border: `1px solid ${cfg.color}44`,
                              color: cfg.color, cursor: 'pointer',
                            }}
                          >
                            Select: {s.name || s.type}
                          </button>
                        ) : null;
                      })}
                    </div>
                  )}
                  {sug.action && (
                    <button
                      onClick={sug.action.apply}
                      style={{
                        marginTop: 8, padding: '4px 10px', borderRadius: 6,
                        background: cfg.color, border: 'none',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {sug.action.label}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border, #2d2d3d)', fontSize: 10, color: 'var(--muted, #888)', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>10 check categories · {suggestions.length} finding{suggestions.length !== 1 ? 's' : ''}</span>
        <span>⌘⇧⌥I</span>
      </div>
    </div>
  );
}
