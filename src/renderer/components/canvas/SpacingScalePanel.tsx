import React, { useState, useMemo, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScaleMethod = 'linear' | 'exponential' | 'fibonacci' | 'custom';
export type SpacingUnit = 'px' | 'rem' | 'em';

export interface SpacingStep {
  label: string;       // xs, sm, base, lg, xl, 2xl, 3xl…
  px: number;
  rem: string;
  tailwindName: string; // e.g. "spacing-4"
  cssVar: string;       // e.g. "--space-sm"
}

export interface SpacingScaleConfig {
  base: number;         // base unit in px (e.g. 4 or 8)
  method: ScaleMethod;
  factor: number;       // for exponential: multiplier (e.g. 1.5 or 2)
  steps: number;        // number of steps to generate (above base)
  stepsBelow: number;   // steps below base
  unit: SpacingUnit;    // display unit
}

export interface SpacingPreset {
  name: string;
  description: string;
  config: SpacingScaleConfig;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const SCALE_LABELS_UP = ['base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl'];
export const SCALE_LABELS_DOWN = ['sm', 'xs', '2xs', '3xs'];

export const SPACING_PRESETS: SpacingPreset[] = [
  {
    name: '4px Base (Tailwind)',
    description: '4px base unit, ×2 factor — matches Tailwind default spacing',
    config: { base: 4, method: 'linear', factor: 2, steps: 8, stepsBelow: 2, unit: 'px' },
  },
  {
    name: '8px Base (Material)',
    description: '8px base unit — Material Design grid system',
    config: { base: 8, method: 'linear', factor: 2, steps: 6, stepsBelow: 2, unit: 'px' },
  },
  {
    name: 'Exponential ×1.5',
    description: 'Exponential growth at 1.5× per step — compact and harmonious',
    config: { base: 4, method: 'exponential', factor: 1.5, steps: 8, stepsBelow: 2, unit: 'px' },
  },
  {
    name: 'Fibonacci',
    description: 'Fibonacci sequence spacing: 1, 1, 2, 3, 5, 8, 13, 21…',
    config: { base: 8, method: 'fibonacci', factor: 1.618, steps: 8, stepsBelow: 3, unit: 'px' },
  },
  {
    name: 'Linear 6px',
    description: 'Simple 6px increments for dense UIs',
    config: { base: 6, method: 'linear', factor: 6, steps: 7, stepsBelow: 1, unit: 'px' },
  },
  {
    name: 'Rem Scale',
    description: '0.25rem base (4px), exponential — good for rem-first systems',
    config: { base: 4, method: 'exponential', factor: 2, steps: 7, stepsBelow: 2, unit: 'rem' },
  },
];

const FIBONACCI_SEQ = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

// ── Pure functions (exported for tests) ──────────────────────────────────────

export function generateLinearScale(base: number, factor: number, steps: number, stepsBelow: number): number[] {
  const values: number[] = [];
  // Below
  for (let i = stepsBelow; i >= 1; i--) {
    values.push(Math.max(1, Math.round(base - factor * i)));
  }
  // Base + above
  for (let i = 0; i <= steps; i++) {
    values.push(Math.round(base + factor * i));
  }
  return values;
}

export function generateExponentialScale(base: number, factor: number, steps: number, stepsBelow: number): number[] {
  const values: number[] = [];
  for (let i = stepsBelow; i >= 1; i--) {
    values.push(Math.max(1, Math.round(base / Math.pow(factor, i))));
  }
  for (let i = 0; i <= steps; i++) {
    values.push(Math.round(base * Math.pow(factor, i)));
  }
  return values;
}

export function generateFibonacciScale(base: number, steps: number, stepsBelow: number): number[] {
  // Find closest Fibonacci multiplier for base
  const scale = base / 8; // normalize to 8px base
  const values: number[] = [];
  const startIdx = stepsBelow;
  const endIdx = startIdx + steps;
  for (let i = 0; i <= endIdx; i++) {
    const fibIdx = Math.max(0, i);
    const fib = FIBONACCI_SEQ[Math.min(fibIdx, FIBONACCI_SEQ.length - 1)];
    values.push(Math.max(1, Math.round(fib * scale)));
  }
  // Trim to correct length (stepsBelow from end going backwards isn't straightforward)
  return values;
}

export function generateSpacingScale(config: SpacingScaleConfig): SpacingStep[] {
  const { base, method, factor, steps, stepsBelow } = config;

  let pxValues: number[];
  switch (method) {
    case 'linear':
      pxValues = generateLinearScale(base, factor, steps, stepsBelow);
      break;
    case 'exponential':
      pxValues = generateExponentialScale(base, factor, steps, stepsBelow);
      break;
    case 'fibonacci':
      pxValues = generateFibonacciScale(base, steps, stepsBelow);
      break;
    case 'custom':
      pxValues = generateLinearScale(base, factor, steps, stepsBelow);
      break;
  }

  // Generate labels
  const totalSteps = pxValues.length;
  const baseIdx = stepsBelow; // index of the "base" label
  const labels: string[] = pxValues.map((_, i) => {
    const diff = i - baseIdx;
    if (diff < 0) {
      return SCALE_LABELS_DOWN[Math.abs(diff) - 1] ?? `${Math.abs(diff)}xs`;
    }
    return SCALE_LABELS_UP[diff] ?? `${diff}xl`;
  });

  return pxValues.map((px, i) => ({
    label: labels[i],
    px,
    rem: `${(px / 16).toFixed(4)}rem`,
    tailwindName: `spacing-${Math.round(px / 4)}`,
    cssVar: `--space-${labels[i]}`,
  }));
}

export function exportSpacingCSS(steps: SpacingStep[]): string {
  return `:root {\n${steps.map(s => `  ${s.cssVar}: ${s.rem};`).join('\n')}\n}`;
}

export function exportSpacingSCSS(steps: SpacingStep[]): string {
  return `// Spacing scale\n${steps.map(s => `$space-${s.label}: ${s.rem};`).join('\n')}`;
}

export function exportSpacingTailwind(steps: SpacingStep[]): string {
  const entries = steps.map(s => `      '${s.label}': '${s.rem}'`).join(',\n');
  return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      spacing: {\n${entries}\n      }\n    }\n  }\n}`;
}

export function exportSpacingJSON(steps: SpacingStep[]): string {
  const obj: Record<string, { rem: string; px: number }> = {};
  steps.forEach(s => { obj[s.label] = { rem: s.rem, px: s.px }; });
  return JSON.stringify({ spacing: obj }, null, 2);
}

export function closestSpacingStep(targetPx: number, steps: SpacingStep[]): SpacingStep {
  return steps.reduce((best, s) =>
    Math.abs(s.px - targetPx) < Math.abs(best.px - targetPx) ? s : best
  );
}

export function spacingRhythmCheck(steps: SpacingStep[]): boolean {
  // True if all steps are multiples of the smallest step
  if (steps.length < 2) return true;
  const base = steps[0].px;
  return steps.every(s => s.px % base === 0);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

type TabId = 'scale' | 'preview' | 'export';
type ExportFmt = 'css' | 'scss' | 'tailwind' | 'json';

export function SpacingScalePanel({ open, onClose }: Props) {
  const [config, setConfig] = useState<SpacingScaleConfig>(SPACING_PRESETS[0].config);
  const [tab, setTab] = useState<TabId>('scale');
  const [exportFmt, setExportFmt] = useState<ExportFmt>('css');
  const [copied, setCopied] = useState(false);
  const [highlightLabel, setHighlightLabel] = useState<string | null>(null);

  const steps = useMemo(() => generateSpacingScale(config), [config]);

  const exportContent = useMemo(() => {
    switch (exportFmt) {
      case 'css': return exportSpacingCSS(steps);
      case 'scss': return exportSpacingSCSS(steps);
      case 'tailwind': return exportSpacingTailwind(steps);
      case 'json': return exportSpacingJSON(steps);
    }
  }, [steps, exportFmt]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(exportContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [exportContent]);

  const loadPreset = useCallback((preset: SpacingPreset) => {
    setConfig(preset.config);
  }, []);

  const updateConfig = useCallback(<K extends keyof SpacingScaleConfig>(key: K, value: SpacingScaleConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  if (!open) return null;

  const panelBg = '#1e1e2e';
  const surface = '#2a2a3e';
  const border = '#3a3a55';
  const accent = '#10b981';
  const textPrimary = '#e2e8f0';
  const textMuted = '#94a3b8';

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', background: active ? accent : 'transparent',
    color: active ? '#fff' : textMuted, border: 'none', transition: 'all 0.15s',
  });

  const INPUT_STYLE: React.CSSProperties = {
    background: surface, border: `1px solid ${border}`, borderRadius: 6,
    color: textPrimary, fontSize: 12, padding: '4px 8px', outline: 'none',
  };

  const maxPx = Math.max(...steps.map(s => s.px));
  const isRhythmic = spacingRhythmCheck(steps);

  return (
    <div style={{
      position: 'fixed', right: 16, top: 60, width: 400,
      maxHeight: 'calc(100vh - 80px)', background: panelBg,
      border: `1px solid ${border}`, borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', zIndex: 9023,
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px', borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>Spacing Scale</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            {steps.length} steps · base {config.base}px
            {isRhythmic && <span style={{ color: accent, marginLeft: 6 }}>✓ Rhythmic</span>}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: textMuted,
          cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
        }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 16px',
        borderBottom: `1px solid ${border}`, flexShrink: 0,
      }}>
        {(['scale', 'preview', 'export'] as TabId[]).map(t => (
          <button key={t} style={TAB_STYLE(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Config row */}
      <div style={{
        padding: '10px 16px', borderBottom: `1px solid ${border}`,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8,
        flexShrink: 0, background: '#1a1a2e',
      }}>
        <div>
          <div style={{ fontSize: 10, color: textMuted, marginBottom: 3 }}>Base (px)</div>
          <input type="number" min={1} max={64} step={1} value={config.base}
            onChange={e => updateConfig('base', Number(e.target.value))}
            style={{ ...INPUT_STYLE, width: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: textMuted, marginBottom: 3 }}>Method</div>
          <select value={config.method} onChange={e => updateConfig('method', e.target.value as ScaleMethod)}
            style={{ ...INPUT_STYLE, width: '100%', cursor: 'pointer' }}>
            <option value="linear">Linear</option>
            <option value="exponential">Expo</option>
            <option value="fibonacci">Fib</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: textMuted, marginBottom: 3 }}>
            {config.method === 'linear' ? 'Step (px)' : 'Factor'}
          </div>
          <input type="number" min={0.1} max={8} step={config.method === 'linear' ? 1 : 0.1}
            value={config.factor}
            onChange={e => updateConfig('factor', Number(e.target.value))}
            style={{ ...INPUT_STYLE, width: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: textMuted, marginBottom: 3 }}>Steps up</div>
          <input type="number" min={1} max={12} step={1} value={config.steps}
            onChange={e => updateConfig('steps', Number(e.target.value))}
            style={{ ...INPUT_STYLE, width: '100%' }} />
        </div>
      </div>

      {/* Presets */}
      <div style={{
        padding: '8px 16px', borderBottom: `1px solid ${border}`,
        display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0,
      }}>
        {SPACING_PRESETS.map(p => (
          <button key={p.name} onClick={() => loadPreset(p)} title={p.description}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, whiteSpace: 'nowrap',
              background: surface, border: `1px solid ${border}`,
              color: textMuted, cursor: 'pointer', flexShrink: 0,
            }}>{p.name}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── Scale Tab ── */}
        {tab === 'scale' && (
          <div>
            {steps.map((step) => {
              const barWidth = `${(step.px / maxPx) * 100}%`;
              const isBase = step.label === 'base';
              const isHighlight = highlightLabel === step.label;
              return (
                <div
                  key={step.label}
                  onMouseEnter={() => setHighlightLabel(step.label)}
                  onMouseLeave={() => setHighlightLabel(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 8, marginBottom: 2,
                    background: isHighlight ? `${accent}11` : 'transparent',
                    border: `1px solid ${isHighlight ? accent + '44' : 'transparent'}`,
                    transition: 'all 0.1s',
                  }}
                >
                  {/* Label */}
                  <div style={{
                    width: 32, fontSize: 11, fontWeight: 600, flexShrink: 0,
                    color: isBase ? accent : (isHighlight ? textPrimary : textMuted),
                  }}>
                    {step.label}
                  </div>

                  {/* Bar */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{
                      height: isBase ? 6 : 4, borderRadius: 3,
                      background: isBase ? accent : (isHighlight ? `${accent}88` : border),
                      width: barWidth, minWidth: 4,
                      transition: 'width 0.3s',
                    }} />
                  </div>

                  {/* Values */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, fontFamily: 'monospace' }}>
                      {step.px}px
                    </div>
                    <div style={{ fontSize: 10, color: textMuted, fontFamily: 'monospace' }}>{step.rem}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Preview Tab ── */}
        {tab === 'preview' && (
          <div>
            <div style={{ marginBottom: 12, fontSize: 12, color: textMuted }}>
              Visualize spacing values as colored blocks at actual size.
            </div>
            {steps.map((step) => (
              <div key={step.label} style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
              }}>
                {/* Label */}
                <div style={{ width: 32, fontSize: 11, color: textMuted, fontWeight: 600, flexShrink: 0 }}>
                  {step.label}
                </div>

                {/* Block */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    height: step.label === 'base' ? step.px : Math.min(step.px, 60),
                    width: Math.min(step.px, 200),
                    background: `${accent}44`,
                    border: `1px solid ${accent}66`,
                    borderRadius: 3,
                    flexShrink: 0,
                  }} />
                  <div style={{ fontSize: 11, color: textMuted, fontFamily: 'monospace' }}>
                    {step.px}px
                  </div>
                </div>
              </div>
            ))}

            {/* Rhythm checker */}
            <div style={{
              marginTop: 16, padding: '10px 12px', borderRadius: 8,
              background: isRhythmic ? `${accent}11` : '#ef444411',
              border: `1px solid ${isRhythmic ? accent + '44' : '#ef444444'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isRhythmic ? accent : '#ef4444' }}>
                {isRhythmic ? '✓ Vertical rhythm maintained' : '⚠ Not all steps are multiples of base'}
              </div>
              <div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>
                Consistent rhythm helps create visual harmony in layouts.
              </div>
            </div>
          </div>
        )}

        {/* ── Export Tab ── */}
        {tab === 'export' && (
          <div>
            {/* Format selector */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {(['css', 'scss', 'tailwind', 'json'] as ExportFmt[]).map(f => (
                <button key={f} style={TAB_STYLE(exportFmt === f)} onClick={() => setExportFmt(f)}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <pre style={{
                background: '#0f0f1a', border: `1px solid ${border}`, borderRadius: 8,
                padding: '12px 14px', fontSize: 11, color: '#7dd3fc',
                fontFamily: 'ui-monospace, monospace', overflowX: 'auto', overflowY: 'auto',
                maxHeight: 320, margin: 0, whiteSpace: 'pre', lineHeight: 1.6,
              }}>
                {exportContent}
              </pre>
              <button onClick={handleCopy} style={{
                position: 'absolute', top: 8, right: 8, padding: '4px 10px', borderRadius: 6,
                background: copied ? '#22c55e' : accent, border: 'none',
                color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>

            {/* Stats */}
            <div style={{
              marginTop: 12, background: surface, border: `1px solid ${border}`,
              borderRadius: 8, padding: '10px 12px',
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            }}>
              {[
                { label: 'Steps', value: steps.length },
                { label: 'Base', value: `${config.base}px` },
                { label: 'Max', value: `${maxPx}px` },
                { label: 'Min', value: `${steps[0]?.px ?? 0}px` },
                { label: 'Method', value: config.method },
                { label: 'Rhythmic', value: isRhythmic ? '✓' : '✗' },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>{value}</div>
                  <div style={{ fontSize: 10, color: textMuted }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
