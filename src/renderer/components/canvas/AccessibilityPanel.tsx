/**
 * AccessibilityPanel — WCAG design audit tool built into Quill.
 *
 * Checks:
 * 1. Text contrast ratio against background (WCAG AA / AAA)
 * 2. Font size legibility (< 12px warning, < 10px fail)
 * 3. Touch target size (< 44px warning, < 24px fail)
 * 4. Color blindness simulation (Protanopia, Deuteranopia, Tritanopia, Achromatopsia)
 * 5. Focus order / tab index visualization
 * 6. Reduced motion flag (shapes with animation properties)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { X, Eye, AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, ChevronRight, Zap } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'pass' | 'warn' | 'fail' | 'info';

interface Issue {
  id: string;
  shapeId: string;
  shapeName: string;
  category: 'contrast' | 'font-size' | 'touch-target' | 'motion' | 'empty-text';
  severity: Severity;
  message: string;
  wcag?: string;
  suggestion?: string;
}

type CBMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onSelectShape?: (id: string) => void;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function rgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * rgbToLinear(r) + 0.7152 * rgbToLinear(g) + 0.0722 * rgbToLinear(b);
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const L1 = relativeLuminance(...rgb1);
  const L2 = relativeLuminance(...rgb2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColor(color: string): [number, number, number] | null {
  if (!color || color === 'transparent' || color === 'none') return null;
  if (color.startsWith('#')) return hexToRgb(color);
  // Handle rgb/rgba strings
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  // Named colors (common ones)
  const namedColors: Record<string, [number, number, number]> = {
    white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0],
    green: [0, 128, 0], blue: [0, 0, 255], transparent: [255, 255, 255],
  };
  return namedColors[color.toLowerCase()] || null;
}

function wcagGrade(ratio: number, fontSize: number, isBold: boolean): { aa: boolean; aaa: boolean; large: boolean } {
  const large = fontSize >= 18 || (fontSize >= 14 && isBold);
  const aa = large ? ratio >= 3 : ratio >= 4.5;
  const aaa = large ? ratio >= 4.5 : ratio >= 7;
  return { aa, aaa, large };
}

// ─── Color blindness simulation matrices ─────────────────────────────────────

const CB_MATRICES: Record<CBMode, number[]> = {
  none: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protanopia:    [0.567, 0.433, 0,     0.558, 0.442, 0,     0,     0.242, 0.758],
  deuteranopia:  [0.625, 0.375, 0,     0.700, 0.300, 0,     0,     0.300, 0.700],
  tritanopia:    [0.950, 0.050, 0,     0,     0.433, 0.567, 0,     0.475, 0.525],
  achromatopsia: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
};

function cbFilterValue(mode: CBMode): string {
  if (mode === 'none') return 'none';
  const m = CB_MATRICES[mode];
  return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><filter id='cb'><feColorMatrix type='matrix' values='${m[0]} ${m[1]} ${m[2]} 0 0 ${m[3]} ${m[4]} ${m[5]} 0 0 ${m[6]} ${m[7]} ${m[8]} 0 0 0 0 0 1 0'/></filter></svg>#cb")`;
}

// ─── Audit function ───────────────────────────────────────────────────────────

function auditShapes(shapes: Shape[]): Issue[] {
  const issues: Issue[] = [];

  // Only check top-level and visible shapes
  const visible = shapes.filter(s => !s.hidden && s.type !== 'path');

  for (const shape of visible) {
    const name = shape.name || `${shape.type} ${shape.id.slice(0, 6)}`;

    // ── 1. Text contrast ──────────────────────────────────────────────────────
    if (shape.type === 'text') {
      const textColor = parseColor(shape.color ?? '#000000');
      const bgColor = parseColor(shape.fill !== 'transparent' ? shape.fill : '#ffffff');

      if (textColor && bgColor) {
        const ratio = contrastRatio(textColor, bgColor);
        const isBold = shape.fontWeight === 'bold' || shape.fontWeight === '700' || shape.fontWeight === '800' || shape.fontWeight === '900';
        const grade = wcagGrade(ratio, shape.fontSize ?? 16, isBold);
        const ratioStr = ratio.toFixed(2);

        if (!grade.aa) {
          issues.push({
            id: `${shape.id}-contrast`,
            shapeId: shape.id,
            shapeName: name,
            category: 'contrast',
            severity: 'fail',
            message: `Contrast ratio ${ratioStr}:1 — fails WCAG AA (needs ${grade.large ? '3' : '4.5'}:1)`,
            wcag: 'WCAG 1.4.3',
            suggestion: 'Increase contrast between text and background colors',
          });
        } else if (!grade.aaa) {
          issues.push({
            id: `${shape.id}-contrast`,
            shapeId: shape.id,
            shapeName: name,
            category: 'contrast',
            severity: 'warn',
            message: `Contrast ratio ${ratioStr}:1 — passes AA, fails AAA (needs ${grade.large ? '4.5' : '7'}:1)`,
            wcag: 'WCAG 1.4.6',
            suggestion: 'Consider higher contrast for enhanced accessibility',
          });
        } else {
          issues.push({
            id: `${shape.id}-contrast`,
            shapeId: shape.id,
            shapeName: name,
            category: 'contrast',
            severity: 'pass',
            message: `Contrast ratio ${ratioStr}:1 — passes WCAG AAA ✓`,
            wcag: 'WCAG 1.4.6',
          });
        }
      }

      // ── 2. Font size ────────────────────────────────────────────────────────
      const fs = shape.fontSize ?? 16;
      if (fs < 10) {
        issues.push({
          id: `${shape.id}-fontsize`,
          shapeId: shape.id,
          shapeName: name,
          category: 'font-size',
          severity: 'fail',
          message: `Font size ${fs}px — extremely small, unreadable for most users`,
          wcag: 'WCAG 1.4.4',
          suggestion: 'Use at least 12px for body text, 16px+ for optimal readability',
        });
      } else if (fs < 12) {
        issues.push({
          id: `${shape.id}-fontsize`,
          shapeId: shape.id,
          shapeName: name,
          category: 'font-size',
          severity: 'warn',
          message: `Font size ${fs}px — may be difficult to read`,
          wcag: 'WCAG 1.4.4',
          suggestion: 'Consider 12px minimum; 16px recommended for body text',
        });
      }

      // ── 3. Empty text ───────────────────────────────────────────────────────
      if (!shape.text || shape.text.trim() === '') {
        issues.push({
          id: `${shape.id}-empty`,
          shapeId: shape.id,
          shapeName: name,
          category: 'empty-text',
          severity: 'warn',
          message: 'Empty text element — no accessible content',
          wcag: 'WCAG 1.1.1',
          suggestion: 'Add text content or remove the element',
        });
      }
    }

    // ── 4. Touch target size ──────────────────────────────────────────────────
    // Flag interactive-looking small shapes (rectangles/ellipses that could be buttons)
    if (shape.type === 'rectangle' || shape.type === 'ellipse') {
      const minDim = Math.min(shape.width, shape.height);
      if (minDim < 24) {
        issues.push({
          id: `${shape.id}-touch`,
          shapeId: shape.id,
          shapeName: name,
          category: 'touch-target',
          severity: 'fail',
          message: `Touch target ${Math.round(shape.width)}×${Math.round(shape.height)}px — too small for reliable tap`,
          wcag: 'WCAG 2.5.5',
          suggestion: 'Minimum 44×44px for touch targets (24px WCAG 2.2 minimum)',
        });
      } else if (minDim < 44) {
        issues.push({
          id: `${shape.id}-touch`,
          shapeId: shape.id,
          shapeName: name,
          category: 'touch-target',
          severity: 'warn',
          message: `Touch target ${Math.round(shape.width)}×${Math.round(shape.height)}px — below 44px recommendation`,
          wcag: 'WCAG 2.5.5',
          suggestion: 'Recommended 44×44px minimum for comfortable touch targets',
        });
      }
    }

    // ── 5. Reduced motion ─────────────────────────────────────────────────────
    if ((shape as Shape & { motionPath?: unknown; animationDuration?: number }).motionPath || (shape as Shape & { animationDuration?: number }).animationDuration || shape.transitionDuration) {
      issues.push({
        id: `${shape.id}-motion`,
        shapeId: shape.id,
        shapeName: name,
        category: 'motion',
        severity: 'info',
        message: 'Element has motion/animation — consider prefers-reduced-motion',
        wcag: 'WCAG 2.3.3',
        suggestion: 'Wrap animations in @media (prefers-reduced-motion: no-preference)',
      });
    }
  }

  return issues;
}

// ─── UI components ────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: Severity }) {
  const props = { size: 14, strokeWidth: 2 };
  if (severity === 'pass') return <CheckCircle {...props} style={{ color: '#22c55e' }} />;
  if (severity === 'fail') return <XCircle {...props} style={{ color: '#ef4444' }} />;
  if (severity === 'warn') return <AlertTriangle {...props} style={{ color: '#f59e0b' }} />;
  return <Info {...props} style={{ color: '#6366f1' }} />;
}

function severityColor(s: Severity): string {
  if (s === 'pass') return '#22c55e';
  if (s === 'fail') return '#ef4444';
  if (s === 'warn') return '#f59e0b';
  return '#6366f1';
}

const CATEGORY_LABELS: Record<string, string> = {
  'contrast': 'Color Contrast',
  'font-size': 'Font Size',
  'touch-target': 'Touch Targets',
  'motion': 'Motion & Animation',
  'empty-text': 'Empty Elements',
};

// ─── Main panel ───────────────────────────────────────────────────────────────

export function AccessibilityPanel({ open, onClose, shapes, onSelectShape }: Props) {
  const [cbMode, setCbMode] = useState<CBMode>('none');
  const [activeTab, setActiveTab] = useState<'issues' | 'simulate'>('issues');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['contrast', 'font-size', 'touch-target']));
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all');
  const [running, setRunning] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [lastRunCount, setLastRunCount] = useState(0);

  const runAudit = useCallback(() => {
    setRunning(true);
    // Small delay for visual feedback
    setTimeout(() => {
      const found = auditShapes(shapes);
      setIssues(found);
      setLastRunCount(shapes.length);
      setRunning(false);
    }, 400);
  }, [shapes]);

  // Auto-run on open
  useEffect(() => {
    if (open) runAudit();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    for (const issue of issues) {
      if (filterSeverity !== 'all' && issue.severity !== filterSeverity) continue;
      if (!map[issue.category]) map[issue.category] = [];
      map[issue.category].push(issue);
    }
    return map;
  }, [issues, filterSeverity]);

  const counts = useMemo(() => ({
    fail: issues.filter(i => i.severity === 'fail').length,
    warn: issues.filter(i => i.severity === 'warn').length,
    pass: issues.filter(i => i.severity === 'pass').length,
    info: issues.filter(i => i.severity === 'info').length,
  }), [issues]);

  const score = useMemo(() => {
    if (issues.length === 0) return 100;
    const weighted = counts.fail * 3 + counts.warn * 1;
    const max = issues.length * 3;
    return Math.max(0, Math.round(100 - (weighted / max) * 100));
  }, [issues, counts]);

  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  if (!open) return null;

  const CB_MODES: { key: CBMode; label: string; desc: string }[] = [
    { key: 'none', label: 'Normal', desc: 'No simulation' },
    { key: 'protanopia', label: 'Protanopia', desc: 'Red-blind (~1% males)' },
    { key: 'deuteranopia', label: 'Deuteranopia', desc: 'Green-blind (~6% males)' },
    { key: 'tritanopia', label: 'Tritanopia', desc: 'Blue-blind (rare)' },
    { key: 'achromatopsia', label: 'Achromatopsia', desc: 'Total color blindness' },
  ];

  return (
    <>
      {/* Global color blindness filter applied to the whole page */}
      {cbMode !== 'none' && (
        <style>{`
          #canvas-area {
            filter: ${cbMode === 'protanopia'
              ? 'url(#cb-filter)'
              : cbMode === 'deuteranopia'
              ? 'url(#cb-filter)'
              : cbMode === 'tritanopia'
              ? 'url(#cb-filter)'
              : 'grayscale(1)'};
          }
        `}</style>
      )}

      <div
        style={{
          position: 'fixed',
          top: 48,
          right: 8,
          width: 360,
          maxHeight: 'calc(100vh - 64px)',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 300,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={16} style={{ color: '#6366f1' }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Accessibility</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={runAudit}
              disabled={running}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: '#6366f1', color: '#fff', border: 'none', cursor: running ? 'wait' : 'pointer',
                opacity: running ? 0.7 : 1,
              }}
            >
              {running ? 'Auditing…' : 'Re-run'}
            </button>
            <button
              onClick={onClose}
              style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Score bar */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: 'rgba(99,102,241,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 2 }}>
                Accessibility Score · {lastRunCount} shapes audited
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                {counts.fail > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>✕ {counts.fail} errors</span>}
                {counts.warn > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ {counts.warn} warnings</span>}
                {counts.pass > 0 && <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ {counts.pass} passing</span>}
              </div>
            </div>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `conic-gradient(${scoreColor} ${score}%, rgba(255,255,255,0.08) 0%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--panel)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, color: scoreColor,
              }}>
                {score}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, background: scoreColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['issues', 'simulate'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 12, fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? '#6366f1' : 'var(--subtle)',
                background: 'transparent', border: 'none',
                borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {tab === 'issues' ? `Issues (${issues.filter(i => i.severity !== 'pass').length})` : 'Color Blindness'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

          {/* ── Issues tab ── */}
          {activeTab === 'issues' && (
            <>
              {/* Severity filter */}
              <div style={{ display: 'flex', gap: 6, padding: '8px 16px', flexWrap: 'wrap' }}>
                {(['all', 'fail', 'warn', 'pass', 'info'] as const).map(sev => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    style={{
                      padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                      border: filterSeverity === sev ? 'none' : '1px solid var(--border)',
                      background: filterSeverity === sev
                        ? sev === 'all' ? '#6366f1'
                        : sev === 'fail' ? '#ef4444'
                        : sev === 'warn' ? '#f59e0b'
                        : sev === 'pass' ? '#22c55e'
                        : '#6366f1'
                        : 'transparent',
                      color: filterSeverity === sev ? '#fff' : 'var(--subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    {sev === 'all' ? 'All' : sev === 'fail' ? `Errors (${counts.fail})` : sev === 'warn' ? `Warnings (${counts.warn})` : sev === 'pass' ? `Passing (${counts.pass})` : `Info (${counts.info})`}
                  </button>
                ))}
              </div>

              {Object.keys(grouped).length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--subtle)' }}>
                  {issues.length === 0
                    ? <><div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div><div>No issues found!</div><div style={{ fontSize: 11, marginTop: 4 }}>Your design looks accessible</div></>
                    : <><div>No issues matching filter</div></>
                  }
                </div>
              )}

              {Object.entries(grouped).map(([cat, catIssues]) => {
                const expanded = expandedCategories.has(cat);
                const failCount = catIssues.filter(i => i.severity === 'fail').length;
                const warnCount = catIssues.filter(i => i.severity === 'warn').length;
                return (
                  <div key={cat}>
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(cat)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {expanded ? <ChevronDown size={12} style={{ color: 'var(--subtle)' }} /> : <ChevronRight size={12} style={{ color: 'var(--subtle)' }} />}
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{CATEGORY_LABELS[cat] ?? cat}</span>
                        <span style={{ fontSize: 11, color: 'var(--subtle)' }}>({catIssues.length})</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {failCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 100 }}>{failCount}</span>}
                        {warnCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 100 }}>{warnCount}</span>}
                      </div>
                    </button>

                    {/* Issues list */}
                    {expanded && catIssues.map(issue => (
                      <div
                        key={issue.id}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          cursor: onSelectShape ? 'pointer' : 'default',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => onSelectShape?.(issue.shapeId)}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flexShrink: 0, marginTop: 1 }}>
                            <SeverityIcon severity={issue.severity} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{
                                fontSize: 11, fontWeight: 600,
                                color: severityColor(issue.severity),
                                padding: '1px 6px', borderRadius: 4,
                                background: `${severityColor(issue.severity)}15`,
                                flexShrink: 0,
                              }}>
                                {issue.severity.toUpperCase()}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {issue.shapeName}
                              </span>
                              {issue.wcag && (
                                <span style={{ fontSize: 10, color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                                  {issue.wcag}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: issue.suggestion ? 4 : 0, lineHeight: 1.4 }}>
                              {issue.message}
                            </div>
                            {issue.suggestion && (
                              <div style={{ fontSize: 11, color: 'var(--subtle)', fontStyle: 'italic', lineHeight: 1.3 }}>
                                💡 {issue.suggestion}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}

          {/* ── Color blindness simulation tab ── */}
          {activeTab === 'simulate' && (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--subtle)', marginBottom: 12, lineHeight: 1.5 }}>
                Simulate how your design appears to users with color vision deficiencies. The simulation is applied as a CSS filter to the canvas area.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CB_MODES.map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => setCbMode(key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: cbMode === key ? '1px solid #6366f1' : '1px solid var(--border)',
                      background: cbMode === key ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.15s',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: cbMode === key ? 700 : 400, color: cbMode === key ? '#a5b4fc' : 'var(--text)' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--subtle)' }}>{desc}</div>
                    </div>
                    {cbMode === key && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>

              {cbMode !== 'none' && (
                <div style={{
                  marginTop: 16, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Eye size={12} style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc' }}>Simulation active</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--subtle)' }}>
                    The canvas is now filtered to simulate {CB_MODES.find(m => m.key === cbMode)?.label}.
                    Look for elements that lose meaning when colors shift.
                  </div>
                </div>
              )}

              {/* Color blindness stats */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Global Statistics
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Red-green color blind', pct: 8, color: '#ef4444' },
                    { label: 'Blue-yellow color blind', pct: 0.01, color: '#3b82f6' },
                    { label: 'Total color blindness', pct: 0.003, color: '#64748b' },
                  ].map(stat => (
                    <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(stat.pct * 10, 100)}%`, background: stat.color, borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--subtle)', whiteSpace: 'nowrap', width: 160 }}>
                        {stat.label} (~{stat.pct}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  WCAG Quick Reference
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Normal text AA', val: '4.5:1' },
                    { label: 'Large text AA (18pt+ / 14pt bold)', val: '3:1' },
                    { label: 'Normal text AAA', val: '7:1' },
                    { label: 'Large text AAA', val: '4.5:1' },
                    { label: 'UI components / graphics', val: '3:1' },
                    { label: 'Touch target minimum', val: '24×24px' },
                    { label: 'Touch target recommended', val: '44×44px' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: 'var(--subtle)' }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden SVG filter definitions for color blindness simulation */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="cb-filter">
            {cbMode === 'protanopia' && (
              <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0" />
            )}
            {cbMode === 'deuteranopia' && (
              <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0" />
            )}
            {cbMode === 'tritanopia' && (
              <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0" />
            )}
          </filter>
        </defs>
      </svg>
    </>
  );
}
