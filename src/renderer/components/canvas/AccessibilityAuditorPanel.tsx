import React, { useState, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WCAGLevel = 'A' | 'AA' | 'AAA';
export type IssueSeverity = 'error' | 'warning' | 'info';

export interface A11yIssue {
  id: string;
  shapeId: string;
  shapeName: string;
  severity: IssueSeverity;
  wcagCriteria: string;
  wcagLevel: WCAGLevel;
  description: string;
  suggestion: string;
  value?: string | number;
  threshold?: string | number;
}

export interface A11yReport {
  issues: A11yIssue[];
  score: number; // 0-100
  passCount: number;
  totalChecks: number;
  level: WCAGLevel; // highest level achieved
}

// ─── Color utilities ──────────────────────────────────────────────────────────

export function hexToRGBArr(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

export function a11yLuminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function a11yContrastRatio(hex1: string, hex2: string): number {
  const c1 = hexToRGBArr(hex1);
  const c2 = hexToRGBArr(hex2);
  if (!c1 || !c2) return 1;
  const l1 = a11yLuminance(...c1);
  const l2 = a11yLuminance(...c2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrastAA(ratio: number, isLargeText: boolean): boolean {
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

export function meetsContrastAAA(ratio: number, isLargeText: boolean): boolean {
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

// WCAG 2.1: Large text = 18pt or 14pt bold (~24px or ~18.67px bold)
export function isLargeText(fontSize: number, fontWeight: string | number | undefined): boolean {
  const weightNum = typeof fontWeight === 'string' ? parseInt(fontWeight) || 400 : (fontWeight ?? 400);
  if (fontSize >= 24) return true;
  if (fontSize >= 18.67 && weightNum >= 700) return true;
  return false;
}

// ─── Checks ───────────────────────────────────────────────────────────────────

let _issueCounter = 0;
function issueId() { return `a11y-${++_issueCounter}`; }

export function checkContrastRatio(shape: Shape): A11yIssue[] {
  const issues: A11yIssue[] = [];
  if (shape.type !== 'text') return issues;
  const fill = shape.fill ?? '#000000';
  // Treat frame background as white if unspecified
  const bg = '#ffffff';
  const cr = a11yContrastRatio(fill, bg);
  const fs = shape.fontSize ?? 16;
  const fw = shape.fontWeight;
  const large = isLargeText(fs, fw);
  const aaMin = large ? 3 : 4.5;
  const aaaMin = large ? 4.5 : 7;

  if (cr < aaMin) {
    issues.push({
      id: issueId(), shapeId: shape.id, shapeName: shape.name ?? shape.id,
      severity: 'error', wcagCriteria: '1.4.3', wcagLevel: 'AA',
      description: `Text contrast ratio ${cr.toFixed(2)}:1 fails WCAG AA (requires ${aaMin}:1${large ? ' for large text' : ''})`,
      suggestion: 'Increase contrast between text and background colors.',
      value: cr.toFixed(2), threshold: aaMin,
    });
  } else if (cr < aaaMin) {
    issues.push({
      id: issueId(), shapeId: shape.id, shapeName: shape.name ?? shape.id,
      severity: 'warning', wcagCriteria: '1.4.6', wcagLevel: 'AAA',
      description: `Text contrast ${cr.toFixed(2)}:1 passes AA but not AAA (requires ${aaaMin}:1)`,
      suggestion: 'Increase contrast further to meet WCAG AAA.',
      value: cr.toFixed(2), threshold: aaaMin,
    });
  }
  return issues;
}

export function checkMinTouchTarget(shape: Shape): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const MIN_SIZE = 44; // WCAG 2.5.5 AAA: 44×44px
  const MIN_SIZE_AA = 24; // WCAG 2.5.8 AA (2.2): 24×24px
  if (shape.type !== 'rectangle' && shape.type !== 'ellipse') return issues;
  const w = shape.width ?? 0, h = shape.height ?? 0;
  const smallestDim = Math.min(w, h);
  if (smallestDim < MIN_SIZE_AA) {
    issues.push({
      id: issueId(), shapeId: shape.id, shapeName: shape.name ?? shape.id,
      severity: 'error', wcagCriteria: '2.5.8', wcagLevel: 'AA',
      description: `Touch target ${w}×${h}px is smaller than minimum 24×24px (WCAG 2.5.8)`,
      suggestion: `Increase to at least ${MIN_SIZE_AA}×${MIN_SIZE_AA}px.`,
      value: `${w}×${h}px`, threshold: `${MIN_SIZE_AA}×${MIN_SIZE_AA}px`,
    });
  } else if (smallestDim < MIN_SIZE) {
    issues.push({
      id: issueId(), shapeId: shape.id, shapeName: shape.name ?? shape.id,
      severity: 'warning', wcagCriteria: '2.5.5', wcagLevel: 'AAA',
      description: `Touch target ${w}×${h}px is smaller than recommended 44×44px (WCAG 2.5.5)`,
      suggestion: `Increase to ${MIN_SIZE}×${MIN_SIZE}px for best accessibility.`,
      value: `${w}×${h}px`, threshold: `${MIN_SIZE}×${MIN_SIZE}px`,
    });
  }
  return issues;
}

export function checkTextSize(shape: Shape): A11yIssue[] {
  const issues: A11yIssue[] = [];
  if (shape.type !== 'text') return issues;
  const fs = shape.fontSize ?? 16;
  if (fs < 12) {
    issues.push({
      id: issueId(), shapeId: shape.id, shapeName: shape.name ?? shape.id,
      severity: 'error', wcagCriteria: '1.4.4', wcagLevel: 'AA',
      description: `Text size ${fs}px is too small to resize to 200% without loss of content`,
      suggestion: 'Use a minimum font size of 12px (16px recommended).',
      value: fs, threshold: 12,
    });
  } else if (fs < 16) {
    issues.push({
      id: issueId(), shapeId: shape.id, shapeName: shape.name ?? shape.id,
      severity: 'warning', wcagCriteria: '1.4.4', wcagLevel: 'AA',
      description: `Text size ${fs}px is below recommended 16px minimum for body text`,
      suggestion: 'Consider increasing to 16px for better readability.',
      value: fs, threshold: 16,
    });
  }
  return issues;
}

export function checkMissingName(shape: Shape): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const hasName = shape.name && shape.name.trim() && !shape.name.match(/^(rectangle|ellipse|frame|path|text)\s*\d*$/i);
  if (!hasName) {
    issues.push({
      id: issueId(), shapeId: shape.id, shapeName: shape.name ?? shape.id,
      severity: 'info', wcagCriteria: '4.1.2', wcagLevel: 'A',
      description: `Shape "${shape.name ?? shape.id}" has no meaningful accessible name`,
      suggestion: 'Add a descriptive name to this layer for better handoff documentation.',
      value: shape.name ?? '(unnamed)',
    });
  }
  return issues;
}

export function checkLineHeight(shape: Shape): A11yIssue[] {
  const issues: A11yIssue[] = [];
  if (shape.type !== 'text') return issues;
  const lh = shape.lineHeight ?? 1.5;
  if (lh < 1.5) {
    issues.push({
      id: issueId(), shapeId: shape.id, shapeName: shape.name ?? shape.id,
      severity: 'warning', wcagCriteria: '1.4.12', wcagLevel: 'AA',
      description: `Line height ${lh} is below WCAG minimum of 1.5 for body text`,
      suggestion: 'Set line height to at least 1.5 (150%) for readability.',
      value: lh, threshold: 1.5,
    });
  }
  return issues;
}

export function checkLetterSpacing(shape: Shape): A11yIssue[] {
  const issues: A11yIssue[] = [];
  if (shape.type !== 'text') return issues;
  const ls = shape.letterSpacing ?? 0;
  if (ls < -0.5) {
    issues.push({
      id: issueId(), shapeId: shape.id, shapeName: shape.name ?? shape.id,
      severity: 'warning', wcagCriteria: '1.4.12', wcagLevel: 'AA',
      description: `Negative letter spacing ${ls}px may hurt readability`,
      suggestion: 'Avoid negative letter spacing for body text (WCAG 1.4.12).',
      value: ls, threshold: 0,
    });
  }
  return issues;
}

export function auditShapes(shapes: Shape[]): A11yReport {
  const allIssues: A11yIssue[] = [];
  let totalChecks = 0;

  for (const shape of shapes) {
    // Per shape checks
    const checks = [
      checkContrastRatio(shape),
      checkMinTouchTarget(shape),
      checkTextSize(shape),
      checkMissingName(shape),
      checkLineHeight(shape),
      checkLetterSpacing(shape),
    ];
    for (const results of checks) {
      if (results.length > 0 || true) totalChecks++; // count every check
      allIssues.push(...results);
    }
  }

  const errors = allIssues.filter(i => i.severity === 'error').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;
  const infos = allIssues.filter(i => i.severity === 'info').length;

  // Score: start at 100, deduct points
  const score = Math.max(0, Math.min(100,
    100 - errors * 15 - warnings * 5 - infos * 1
  ));

  const passCount = totalChecks - allIssues.length;

  // Determine highest achieved WCAG level (with no errors at that level)
  const aaErrors = allIssues.filter(i => i.wcagLevel === 'AA' && i.severity === 'error').length;
  const aErrors = allIssues.filter(i => i.wcagLevel === 'A' && i.severity === 'error').length;
  const level: WCAGLevel = aErrors > 0 ? 'A' : aaErrors > 0 ? 'A' : errors === 0 ? 'AA' : 'A';

  return { issues: allIssues, score, passCount, totalChecks, level };
}

// ─── Grouping helpers ─────────────────────────────────────────────────────────

export function groupBySeverity(issues: A11yIssue[]): Record<IssueSeverity, A11yIssue[]> {
  return {
    error: issues.filter(i => i.severity === 'error'),
    warning: issues.filter(i => i.severity === 'warning'),
    info: issues.filter(i => i.severity === 'info'),
  };
}

export function groupByShape(issues: A11yIssue[]): Map<string, A11yIssue[]> {
  const map = new Map<string, A11yIssue[]>();
  for (const issue of issues) {
    if (!map.has(issue.shapeId)) map.set(issue.shapeId, []);
    map.get(issue.shapeId)!.push(issue);
  }
  return map;
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Poor';
}

export function wcagLevelColor(level: WCAGLevel): string {
  return level === 'AAA' ? '#10b981' : level === 'AA' ? '#3b82f6' : '#f59e0b';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onSelectShape?: (id: string) => void;
}

const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#64748b',
};
const SEVERITY_ICON: Record<IssueSeverity, string> = { error: '✕', warning: '⚠', info: 'ℹ' };

type ViewMode = 'summary' | 'issues' | 'byShape';

export function AccessibilityAuditorPanel({ open, onClose, shapes, onSelectShape }: Props) {
  const [view, setView] = useState<ViewMode>('summary');
  const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | 'all'>('all');
  const [expandedShapes, setExpandedShapes] = useState<Set<string>>(new Set());

  if (!open) return null;

  const report = useMemo(() => auditShapes(shapes), [shapes]);
  const grouped = useMemo(() => groupBySeverity(report.issues), [report.issues]);
  const byShape = useMemo(() => groupByShape(report.issues), [report.issues]);

  const filteredIssues = filterSeverity === 'all'
    ? report.issues
    : report.issues.filter(i => i.severity === filterSeverity);

  const toggleShape = (id: string) => {
    setExpandedShapes(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const scoreColor = report.score >= 80 ? '#10b981' : report.score >= 60 ? '#f59e0b' : '#ef4444';
  const arcAngle = (report.score / 100) * 251.2; // SVG arc for 80px radius circle

  const panel: React.CSSProperties = {
    position: 'fixed', top: 60, right: 16, width: 370,
    background: '#0f1224', border: '1px solid #1e2540',
    borderRadius: 12, zIndex: 1500, display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
    maxHeight: 'calc(100vh - 80px)',
  };

  const tabBtn = (v: ViewMode, label: string) => (
    <button onClick={() => setView(v)} style={{
      flex: 1, padding: '7px 0', fontSize: 12, fontWeight: view === v ? 700 : 400,
      background: view === v ? '#1e2a45' : 'transparent',
      color: view === v ? '#60a5fa' : '#64748b', border: 'none',
      borderBottom: view === v ? '2px solid #60a5fa' : '2px solid transparent',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>{label}</button>
  );

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #1e2540', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#93c5fd' }}>♿ Accessibility Auditor</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
          {shapes.length} shapes audited · WCAG 2.1/2.2 criteria
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2540', flexShrink: 0 }}>
        {tabBtn('summary', 'Summary')}
        {tabBtn('issues', `Issues (${report.issues.length})`)}
        {tabBtn('byShape', 'By Shape')}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Summary ── */}
        {view === 'summary' && (
          <div style={{ padding: 16 }}>
            {/* Score gauge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ position: 'relative', width: 140, height: 100 }}>
                <svg width="140" height="100" viewBox="0 0 140 100">
                  <path d="M 20 90 A 60 60 0 0 1 120 90" fill="none" stroke="#1e2540" strokeWidth="12" strokeLinecap="round" />
                  <path d="M 20 90 A 60 60 0 0 1 120 90" fill="none" stroke={scoreColor} strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${(report.score / 100) * 188} 188`} />
                  <text x="70" y="78" textAnchor="middle" fill={scoreColor} fontSize="28" fontWeight="bold">{report.score}</text>
                  <text x="70" y="94" textAnchor="middle" fill="#64748b" fontSize="11">{scoreLabel(report.score)}</text>
                </svg>
              </div>
            </div>

            {/* WCAG level badge */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              {(['A', 'AA', 'AAA'] as WCAGLevel[]).map(level => {
                const achieved = level === 'A'
                  ? grouped.error.filter(i => i.wcagLevel === 'A').length === 0
                  : level === 'AA'
                  ? grouped.error.filter(i => i.wcagLevel === 'AA').length === 0
                  : report.issues.filter(i => i.severity !== 'info').length === 0;
                return (
                  <div key={level} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: achieved ? wcagLevelColor(level) + '22' : '#1e2540',
                    color: achieved ? wcagLevelColor(level) : '#334155',
                    border: '1px solid ' + (achieved ? wcagLevelColor(level) : '#334155'),
                  }}>WCAG {level} {achieved ? '✓' : '✗'}</div>
                );
              })}
            </div>

            {/* Issue counts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {([['error', 'Errors', '#ef4444'], ['warning', 'Warnings', '#f59e0b'], ['info', 'Info', '#64748b']] as const).map(([sev, label, color]) => (
                <div key={sev} style={{
                  background: '#0a0f1e', border: '1px solid #1e2540', borderRadius: 8,
                  padding: '10px 6px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color }}>{grouped[sev].length}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Pass rate */}
            <div style={{ background: '#0a0f1e', borderRadius: 8, padding: '10px 12px', border: '1px solid #1e2540' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Checks passed</span>
                <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700 }}>
                  {report.passCount} / {report.totalChecks}
                </span>
              </div>
              <div style={{ height: 6, background: '#1e2540', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${report.totalChecks > 0 ? (report.passCount / report.totalChecks) * 100 : 0}%`,
                  background: `linear-gradient(90deg, #3b82f6, #60a5fa)`,
                  transition: 'width 0.5s',
                }} />
              </div>
            </div>

            {/* WCAG criteria covered */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>CRITERIA CHECKED</div>
              {[
                ['1.4.3', 'Contrast (Minimum)', 'AA'],
                ['1.4.6', 'Contrast (Enhanced)', 'AAA'],
                ['1.4.12', 'Text Spacing', 'AA'],
                ['2.5.5', 'Target Size (44×44px)', 'AAA'],
                ['2.5.8', 'Target Size (24×24px)', 'AA'],
                ['4.1.2', 'Name, Role, Value', 'A'],
              ].map(([id, desc, level]) => {
                const criteriaIssues = report.issues.filter(i => i.wcagCriteria === id);
                const pass = criteriaIssues.filter(i => i.severity === 'error').length === 0;
                return (
                  <div key={id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                    borderBottom: '1px solid #0f1629',
                  }}>
                    <span style={{ color: pass ? '#10b981' : '#ef4444', fontSize: 14, flexShrink: 0 }}>
                      {pass ? '✓' : '✕'}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{id} — {desc}</span>
                    <span style={{ fontSize: 10, color: wcagLevelColor(level as WCAGLevel), fontWeight: 700 }}>
                      {level}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Issues list ── */}
        {view === 'issues' && (
          <div>
            {/* Filter */}
            <div style={{ padding: '8px 14px', borderBottom: '1px solid #1e2540', display: 'flex', gap: 6 }}>
              {(['all', 'error', 'warning', 'info'] as const).map(sev => (
                <button key={sev} onClick={() => setFilterSeverity(sev)} style={{
                  padding: '3px 8px', fontSize: 11, borderRadius: 6,
                  background: filterSeverity === sev ? '#1e2a45' : 'transparent',
                  border: '1px solid ' + (filterSeverity === sev ? '#60a5fa' : '#334155'),
                  color: filterSeverity === sev ? '#60a5fa' : '#64748b', cursor: 'pointer',
                }}>
                  {sev === 'all' ? `All (${report.issues.length})` : `${SEVERITY_ICON[sev]} ${sev === 'error' ? grouped.error.length : sev === 'warning' ? grouped.warning.length : grouped.info.length}`}
                </button>
              ))}
            </div>

            {filteredIssues.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                {report.issues.length === 0 ? '🎉 No accessibility issues found!' : 'No issues match this filter.'}
              </div>
            )}

            {filteredIssues.map(issue => (
              <div key={issue.id} style={{
                padding: '10px 14px', borderBottom: '1px solid #0f1629',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{
                    color: SEVERITY_COLOR[issue.severity], fontSize: 13, marginTop: 1, flexShrink: 0,
                  }}>{SEVERITY_ICON[issue.severity]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 2 }}>{issue.description}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>
                      Layer: <span style={{ color: '#94a3b8' }}>{issue.shapeName}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#3b82f6', marginBottom: 3 }}>
                      WCAG {issue.wcagCriteria} ({issue.wcagLevel})
                      {issue.value !== undefined && (
                        <span style={{ color: '#64748b', marginLeft: 8 }}>
                          Got: {issue.value}
                          {issue.threshold !== undefined && ` / Need: ${issue.threshold}`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#10b981', fontStyle: 'italic' }}>
                      💡 {issue.suggestion}
                    </div>
                  </div>
                  {onSelectShape && (
                    <button
                      onClick={() => onSelectShape(issue.shapeId)}
                      style={{
                        background: '#1e2540', border: '1px solid #334155', borderRadius: 4,
                        color: '#60a5fa', cursor: 'pointer', padding: '2px 6px', fontSize: 10, flexShrink: 0,
                      }}
                    >Select</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── By shape ── */}
        {view === 'byShape' && (
          <div>
            {shapes.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                No shapes on canvas.
              </div>
            )}
            {shapes.map(shape => {
              const shapeIssues = byShape.get(shape.id) ?? [];
              const errors = shapeIssues.filter(i => i.severity === 'error').length;
              const warnings = shapeIssues.filter(i => i.severity === 'warning').length;
              const expanded = expandedShapes.has(shape.id);
              const statusColor = errors > 0 ? '#ef4444' : warnings > 0 ? '#f59e0b' : '#10b981';
              return (
                <div key={shape.id} style={{ borderBottom: '1px solid #0f1629' }}>
                  <button
                    onClick={() => toggleShape(shape.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ color: statusColor, fontSize: 12, flexShrink: 0 }}>
                      {errors > 0 ? '✕' : warnings > 0 ? '⚠' : '✓'}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shape.name ?? shape.id}
                    </span>
                    <span style={{ fontSize: 10, color: '#475569' }}>{shape.type}</span>
                    {shapeIssues.length > 0 && (
                      <span style={{ fontSize: 10, color: statusColor, fontWeight: 700, marginLeft: 4 }}>
                        {shapeIssues.length}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#475569' }}>{expanded ? '▲' : '▼'}</span>
                  </button>
                  {expanded && shapeIssues.length > 0 && (
                    <div style={{ padding: '0 14px 10px 36px' }}>
                      {shapeIssues.map(issue => (
                        <div key={issue.id} style={{ padding: '5px 0', borderTop: '1px solid #0a0f1e' }}>
                          <div style={{ fontSize: 11, color: SEVERITY_COLOR[issue.severity] }}>
                            {SEVERITY_ICON[issue.severity]} {issue.description}
                          </div>
                          <div style={{ fontSize: 10, color: '#10b981', marginTop: 2, fontStyle: 'italic' }}>
                            {issue.suggestion}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {expanded && shapeIssues.length === 0 && (
                    <div style={{ padding: '0 14px 8px 36px', fontSize: 11, color: '#10b981' }}>
                      ✓ No accessibility issues found
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
