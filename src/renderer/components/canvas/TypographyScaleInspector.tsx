import React, { useState, useCallback, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScaleRatio {
  name: string;
  value: number;
}

export interface ScaleStep {
  label: string;    // e.g. "xs", "sm", "base", "lg", "xl", "2xl", …
  size: number;     // px value
  rem: string;      // rem string (base 16px)
  ratio: string;    // multiplier display string
}

export interface TypeScaleConfig {
  baseSize: number;          // px (default 16)
  ratio: number;             // scale ratio
  stepsUp: number;           // steps above base
  stepsDown: number;         // steps below base
  fontFamily: string;
  lineHeightRatio: number;   // e.g. 1.5
  letterSpacingScale: boolean; // auto scale letter-spacing
}

export interface TypeScaleExport {
  css: string;
  tailwind: string;
  json: string;
  scss: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const SCALE_RATIOS: ScaleRatio[] = [
  { name: 'Minor Second (1.067)', value: 1.067 },
  { name: 'Major Second (1.125)', value: 1.125 },
  { name: 'Minor Third (1.200)', value: 1.200 },
  { name: 'Major Third (1.250)', value: 1.250 },
  { name: 'Perfect Fourth (1.333)', value: 1.333 },
  { name: 'Augmented Fourth (1.414)', value: 1.414 },
  { name: 'Perfect Fifth (1.500)', value: 1.500 },
  { name: 'Golden Ratio (1.618)', value: 1.618 },
  { name: 'Double Octave (2.000)', value: 2.000 },
];

export const STEP_LABELS_UP = ['base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl'];
export const STEP_LABELS_DOWN = ['sm', 'xs', '2xs', '3xs'];

export const DEFAULT_CONFIG: TypeScaleConfig = {
  baseSize: 16,
  ratio: 1.25,
  stepsUp: 5,
  stepsDown: 2,
  fontFamily: 'system-ui, sans-serif',
  lineHeightRatio: 1.5,
  letterSpacingScale: false,
};

const FONT_FAMILIES = [
  'system-ui, sans-serif',
  'Georgia, serif',
  'ui-monospace, monospace',
  'Inter, sans-serif',
  'Playfair Display, serif',
  'DM Sans, sans-serif',
  'Space Grotesk, sans-serif',
];

// ── Pure functions (exported for tests) ──────────────────────────────────────

export function generateScale(config: TypeScaleConfig): ScaleStep[] {
  const { baseSize, ratio, stepsUp, stepsDown } = config;
  const steps: ScaleStep[] = [];

  // Steps below base (in ascending order so array goes small → large)
  for (let i = stepsDown; i >= 1; i--) {
    const size = baseSize / Math.pow(ratio, i);
    const labelIdx = i - 1;
    const label = STEP_LABELS_DOWN[labelIdx] ?? `${i}xs`;
    steps.push({
      label,
      size: Math.round(size * 100) / 100,
      rem: `${(size / 16).toFixed(4)}rem`,
      ratio: `÷${ratio.toFixed(3)}^${i}`,
    });
  }

  // Base
  steps.push({
    label: 'base',
    size: baseSize,
    rem: `${(baseSize / 16).toFixed(4)}rem`,
    ratio: '1×',
  });

  // Steps above base
  for (let i = 1; i <= stepsUp; i++) {
    const size = baseSize * Math.pow(ratio, i);
    const labelIdx = i; // skip 'base' at index 0
    const label = STEP_LABELS_UP[labelIdx] ?? `${i}xl`;
    steps.push({
      label,
      size: Math.round(size * 100) / 100,
      rem: `${(size / 16).toFixed(4)}rem`,
      ratio: `×${ratio.toFixed(3)}^${i}`,
    });
  }

  return steps;
}

export function lineHeightForSize(size: number, ratio: number): number {
  return Math.round(size * ratio * 10) / 10;
}

export function letterSpacingForSize(size: number, baseSize: number): string {
  // Larger text → tighter letter spacing (editorial convention)
  if (size <= baseSize) return '0em';
  const factor = (size - baseSize) / baseSize;
  const em = -(factor * 0.02); // up to -0.04em for large headings
  return `${em.toFixed(4)}em`;
}

export function scaleStepToCSSVar(step: ScaleStep): string {
  return `--fs-${step.label}: ${step.rem};`;
}

export function exportScaleCSS(steps: ScaleStep[], config: TypeScaleConfig): string {
  const vars = steps.map(s => `  ${scaleStepToCSSVar(s)}`).join('\n');
  const lhVars = steps.map(s =>
    `  --lh-${s.label}: ${lineHeightForSize(s.size, config.lineHeightRatio)}px;`
  ).join('\n');
  return `:root {\n${vars}\n\n${lhVars}\n}`;
}

export function exportScaleSCSS(steps: ScaleStep[], config: TypeScaleConfig): string {
  const vars = steps.map(s => `$fs-${s.label}: ${s.rem};`).join('\n');
  const lhVars = steps.map(s =>
    `$lh-${s.label}: ${lineHeightForSize(s.size, config.lineHeightRatio)}px;`
  ).join('\n');
  return `// Font size scale (ratio: ${config.ratio})\n${vars}\n\n// Line heights\n${lhVars}`;
}

export function exportScaleTailwind(steps: ScaleStep[], config: TypeScaleConfig): string {
  const entries = steps.map(s =>
    `      '${s.label}': ['${s.rem}', { lineHeight: '${lineHeightForSize(s.size, config.lineHeightRatio)}px' }]`
  ).join(',\n');
  return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      fontSize: {\n${entries}\n      }\n    }\n  }\n}`;
}

export function exportScaleJSON(steps: ScaleStep[], config: TypeScaleConfig): string {
  const obj: Record<string, object> = {};
  steps.forEach(s => {
    obj[s.label] = {
      size: s.rem,
      sizePx: s.size,
      lineHeight: `${lineHeightForSize(s.size, config.lineHeightRatio)}px`,
    };
  });
  return JSON.stringify({ typography: { scale: obj }, meta: { ratio: config.ratio, base: config.baseSize } }, null, 2);
}

export function closestStep(targetPx: number, steps: ScaleStep[]): ScaleStep {
  return steps.reduce((best, s) =>
    Math.abs(s.size - targetPx) < Math.abs(best.size - targetPx) ? s : best
  );
}

export function ratioName(ratio: number): string {
  const found = SCALE_RATIOS.find(r => Math.abs(r.value - ratio) < 0.001);
  return found ? found.name : `Custom (${ratio})`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShapeFontSize?: number;
  onApplyFontSize?: (px: number) => void;
}

type TabId = 'scale' | 'preview' | 'export';
type ExportFormat = 'css' | 'scss' | 'tailwind' | 'json';

export function TypographyScaleInspector({ open, onClose, selectedShapeFontSize, onApplyFontSize }: Props) {
  const [config, setConfig] = useState<TypeScaleConfig>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<TabId>('scale');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [copied, setCopied] = useState(false);
  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog');
  const [darkPreview, setDarkPreview] = useState(false);

  const steps = useMemo(() => generateScale(config), [config]);

  const exportContent = useMemo((): string => {
    switch (exportFormat) {
      case 'css': return exportScaleCSS(steps, config);
      case 'scss': return exportScaleSCSS(steps, config);
      case 'tailwind': return exportScaleTailwind(steps, config);
      case 'json': return exportScaleJSON(steps, config);
    }
  }, [steps, config, exportFormat]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(exportContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [exportContent]);

  const updateConfig = useCallback(<K extends keyof TypeScaleConfig>(key: K, value: TypeScaleConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  if (!open) return null;

  const highlightStep = selectedShapeFontSize !== undefined
    ? closestStep(selectedShapeFontSize, steps)
    : null;

  const panelBg = '#1e1e2e';
  const surface = '#2a2a3e';
  const border = '#3a3a55';
  const accent = '#a78bfa';
  const textPrimary = '#e2e8f0';
  const textMuted = '#94a3b8';

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? accent : 'transparent',
    color: active ? '#1e1e2e' : textMuted,
    border: 'none',
    transition: 'all 0.15s',
  });

  const INPUT_STYLE: React.CSSProperties = {
    background: surface,
    border: `1px solid ${border}`,
    borderRadius: 6,
    color: textPrimary,
    fontSize: 12,
    padding: '4px 8px',
    width: '100%',
    outline: 'none',
  };

  const LABEL_STYLE: React.CSSProperties = {
    fontSize: 11,
    color: textMuted,
    marginBottom: 4,
    display: 'block',
  };

  return (
    <div style={{
      position: 'fixed',
      right: 16,
      top: 60,
      width: 420,
      maxHeight: 'calc(100vh - 80px)',
      background: panelBg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9020,
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>Typography Scale</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            {ratioName(config.ratio)} · {steps.length} steps
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
        background: panelBg,
      }}>
        {(['scale', 'preview', 'export'] as TabId[]).map(t => (
          <button key={t} style={TAB_STYLE(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Config row */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${border}`,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10,
        flexShrink: 0,
        background: '#1a1a2e',
      }}>
        <div>
          <label style={LABEL_STYLE}>Base (px)</label>
          <input
            type="number" min={8} max={32} step={1}
            value={config.baseSize}
            onChange={e => updateConfig('baseSize', Number(e.target.value))}
            style={INPUT_STYLE}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Ratio</label>
          <select
            value={config.ratio}
            onChange={e => updateConfig('ratio', Number(e.target.value))}
            style={{ ...INPUT_STYLE, cursor: 'pointer' }}
          >
            {SCALE_RATIOS.map(r => (
              <option key={r.value} value={r.value}>{r.name}</option>
            ))}
            <option value={config.ratio} disabled>Custom</option>
          </select>
        </div>
        <div>
          <label style={LABEL_STYLE}>Line-h ratio</label>
          <input
            type="number" min={1} max={2.5} step={0.05}
            value={config.lineHeightRatio}
            onChange={e => updateConfig('lineHeightRatio', Number(e.target.value))}
            style={INPUT_STYLE}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Steps up</label>
          <input
            type="number" min={0} max={9} step={1}
            value={config.stepsUp}
            onChange={e => updateConfig('stepsUp', Number(e.target.value))}
            style={INPUT_STYLE}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Steps down</label>
          <input
            type="number" min={0} max={3} step={1}
            value={config.stepsDown}
            onChange={e => updateConfig('stepsDown', Number(e.target.value))}
            style={INPUT_STYLE}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Auto LS</label>
          <button
            onClick={() => updateConfig('letterSpacingScale', !config.letterSpacingScale)}
            style={{
              width: '100%',
              padding: '4px 0',
              borderRadius: 6,
              border: `1px solid ${config.letterSpacingScale ? accent : border}`,
              background: config.letterSpacingScale ? `${accent}22` : 'transparent',
              color: config.letterSpacingScale ? accent : textMuted,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {config.letterSpacingScale ? '✓ On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── Scale Tab ── */}
        {tab === 'scale' && (
          <div>
            {selectedShapeFontSize !== undefined && highlightStep && (
              <div style={{
                background: `${accent}22`,
                border: `1px solid ${accent}55`,
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 12,
                fontSize: 12,
                color: accent,
              }}>
                Selected shape: <strong>{selectedShapeFontSize}px</strong> → closest step: <strong>{highlightStep.label}</strong> ({highlightStep.size}px)
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[...steps].reverse().map(step => {
                const isHighlighted = highlightStep?.label === step.label;
                const lh = lineHeightForSize(step.size, config.lineHeightRatio);
                const ls = config.letterSpacingScale ? letterSpacingForSize(step.size, config.baseSize) : '0em';
                return (
                  <div key={step.label} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: isHighlighted ? `${accent}22` : 'transparent',
                    border: `1px solid ${isHighlighted ? accent + '55' : 'transparent'}`,
                    transition: 'background 0.15s',
                  }}>
                    {/* Label */}
                    <div style={{ width: 36, fontSize: 11, color: isHighlighted ? accent : textMuted, fontWeight: 600, flexShrink: 0 }}>
                      {step.label}
                    </div>

                    {/* Size bar */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        height: 4,
                        borderRadius: 2,
                        background: isHighlighted ? accent : border,
                        width: `${Math.min(100, (step.size / (config.baseSize * Math.pow(config.ratio, config.stepsUp))) * 100)}%`,
                        minWidth: 8,
                        transition: 'width 0.3s',
                      }} />
                    </div>

                    {/* Values */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{step.size}px</div>
                      <div style={{ fontSize: 10, color: textMuted }}>{step.rem} · lh {lh}px</div>
                    </div>

                    {/* Apply button */}
                    {onApplyFontSize && (
                      <button
                        onClick={() => onApplyFontSize(step.size)}
                        title={`Apply ${step.size}px to selected shape`}
                        style={{
                          width: 24, height: 24, borderRadius: 4,
                          background: 'transparent', border: `1px solid ${border}`,
                          color: textMuted, cursor: 'pointer', fontSize: 12,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >↑</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reset */}
            <button
              onClick={() => setConfig(DEFAULT_CONFIG)}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '8px 0',
                borderRadius: 8,
                border: `1px solid ${border}`,
                background: 'transparent',
                color: textMuted,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >Reset to defaults</button>
          </div>
        )}

        {/* ── Preview Tab ── */}
        {tab === 'preview' && (
          <div>
            {/* Controls */}
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={LABEL_STYLE}>Preview font</label>
                <select
                  value={config.fontFamily}
                  onChange={e => updateConfig('fontFamily', e.target.value)}
                  style={{ ...INPUT_STYLE, cursor: 'pointer' }}
                >
                  {FONT_FAMILIES.map(f => (
                    <option key={f} value={f}>{f.split(',')[0]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Preview text</label>
                <input
                  type="text"
                  value={previewText}
                  onChange={e => setPreviewText(e.target.value)}
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ ...LABEL_STYLE, marginBottom: 0 }}>Dark preview</label>
                <button
                  onClick={() => setDarkPreview(v => !v)}
                  style={{
                    width: 32, height: 18, borderRadius: 9,
                    background: darkPreview ? accent : border,
                    border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3, left: darkPreview ? 17 : 3,
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            </div>

            {/* Preview area */}
            <div style={{
              background: darkPreview ? '#0f0f1a' : '#f8fafc',
              border: `1px solid ${border}`,
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              {[...steps].reverse().map(step => {
                const lh = lineHeightForSize(step.size, config.lineHeightRatio);
                const ls = config.letterSpacingScale ? letterSpacingForSize(step.size, config.baseSize) : '0em';
                return (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <div style={{
                      width: 36, fontSize: 10,
                      color: darkPreview ? '#475569' : '#94a3b8',
                      flexShrink: 0, textAlign: 'right', fontFamily: 'monospace',
                    }}>{step.label}</div>
                    <div style={{
                      fontSize: step.size,
                      lineHeight: `${lh}px`,
                      letterSpacing: ls,
                      fontFamily: config.fontFamily,
                      color: darkPreview ? '#e2e8f0' : '#0f172a',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      flex: 1,
                    }}>{previewText}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Export Tab ── */}
        {tab === 'export' && (
          <div>
            {/* Format selector */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {(['css', 'scss', 'tailwind', 'json'] as ExportFormat[]).map(f => (
                <button key={f} style={TAB_STYLE(exportFormat === f)} onClick={() => setExportFormat(f)}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Code block */}
            <div style={{ position: 'relative' }}>
              <pre style={{
                background: '#0f0f1a',
                border: `1px solid ${border}`,
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 11,
                color: '#7dd3fc',
                fontFamily: 'ui-monospace, monospace',
                overflowX: 'auto',
                overflowY: 'auto',
                maxHeight: 380,
                margin: 0,
                whiteSpace: 'pre',
                lineHeight: 1.6,
              }}>
                {exportContent}
              </pre>
              <button
                onClick={handleCopy}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  padding: '4px 10px', borderRadius: 6,
                  background: copied ? '#22c55e' : accent,
                  border: 'none', color: '#fff',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >{copied ? 'Copied!' : 'Copy'}</button>
            </div>

            {/* Stats */}
            <div style={{
              marginTop: 12,
              background: surface,
              border: `1px solid ${border}`,
              borderRadius: 8,
              padding: '10px 12px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
            }}>
              {[
                { label: 'Steps', value: steps.length },
                { label: 'Base', value: `${config.baseSize}px` },
                { label: 'Ratio', value: config.ratio.toFixed(3) },
                { label: 'Min', value: `${Math.min(...steps.map(s => s.size)).toFixed(1)}px` },
                { label: 'Max', value: `${Math.max(...steps.map(s => s.size)).toFixed(1)}px` },
                { label: 'Span', value: `${(Math.max(...steps.map(s => s.size)) / Math.min(...steps.map(s => s.size))).toFixed(1)}×` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>{value}</div>
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
