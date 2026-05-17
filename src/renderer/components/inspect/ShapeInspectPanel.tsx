import React, { useEffect, useState, useCallback, useRef, useMemo, type ReactNode, type CSSProperties } from 'react';
import type { Shape, GradientStop, ShadowDef, ShapeVariant } from '../../lib/shapes';
import { normalizeRadius, shapeToCss, shapesToCanvas, shapesToSvg, FILL_PATTERNS } from '../../lib/shapes';
import { GradientEditor } from './GradientEditor';
import { GOOGLE_FONTS, SYSTEM_FONTS, CATEGORY_LABELS, type GoogleFont } from '../../lib/googleFonts';
import { loadGoogleFont } from '../../hooks/useFontLoader';
import { loadStoredFonts } from '../canvas/CustomFontsPanel';
import * as LucideIcons from 'lucide-react';

// ── Lock icon SVG ─────────────────────────────────────────────────────────────
function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" fill="none">
      {locked ? (
        <>
          <rect x="1.5" y="5" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M3.5 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <rect x="1.5" y="5" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M7.5 5V3.5a2 2 0 0 0-4 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </>
      )}
      <circle cx="5.5" cy="8" r="1" fill="currentColor"/>
    </svg>
  );
}

interface Props {
  shape: Shape;
  onPreview: (patch: Partial<Shape>) => void;
  onChange: (patch: Partial<Shape>) => void;
  allShapes?: Shape[]; // for document color extraction
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function ShapeInspectPanel({ shape, onPreview, onChange, allShapes = [] }: Props) {
  const isText = shape.type === 'text';
  const isFrame = shape.type === 'frame';
  const isPath = shape.type === 'path';
  const [cssCopied, setCssCopied] = useState(false);
  const [imgCopied, setImgCopied] = useState(false);
  const [svgCopied, setSvgCopied] = useState(false);

  const copyCss = useCallback(() => {
    const css = shapeToCss(shape);
    navigator.clipboard.writeText(css).then(() => {
      setCssCopied(true);
      setTimeout(() => setCssCopied(false), 1500);
    }).catch(() => {});
  }, [shape]);

  const copySvg = useCallback(() => {
    const svg = shapesToSvg([shape]);
    navigator.clipboard.writeText(svg).then(() => {
      setSvgCopied(true);
      setTimeout(() => setSvgCopied(false), 1500);
    }).catch(() => {});
  }, [shape]);

  const copyAsImage = useCallback(() => {
    const canvas = document.createElement('canvas');
    try {
      shapesToCanvas([shape], canvas);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const item = new ClipboardItem({ 'image/png': blob });
        navigator.clipboard.write([item]).then(() => {
          setImgCopied(true);
          setTimeout(() => setImgCopied(false), 1500);
        }).catch(() => {});
      }, 'image/png');
    } catch {
      // shapesToCanvas may not support all shape types
    }
  }, [shape]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      background: 'var(--panel)', borderLeft: '1px solid var(--border)',
      fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 8px 0 12px', gap: 8, borderBottom: '1px solid var(--border)',
      }}>
        <TypeBadge type={shape.type} />
        <NameInput
          value={shape.name}
          onPreview={(v) => onPreview({ name: v })}
          onCommit={(v) => onChange({ name: v })}
        />
        {/* Lock/Unlock button (L key shortcut visual) */}
        <button
          onClick={() => onChange({ locked: !shape.locked })}
          title={shape.locked ? 'Unlock (L)' : 'Lock (L)'}
          style={{
            flexShrink: 0, background: shape.locked ? 'rgba(251,191,36,0.12)' : 'none',
            border: `1px solid ${shape.locked ? 'rgba(251,191,36,0.35)' : 'transparent'}`,
            borderRadius: 5, color: shape.locked ? '#fbbf24' : 'var(--muted)',
            cursor: 'pointer', padding: '3px 5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { if (!shape.locked) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel-alt)'; } }}
          onMouseLeave={(e) => { if (!shape.locked) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none'; } }}
        >
          <LockIcon locked={!!shape.locked} />
        </button>
        {/* Copy as Image button */}
        <button
          onClick={copyAsImage}
          title="Copy as PNG image"
          style={{
            flexShrink: 0, background: imgCopied ? 'rgba(99,102,241,0.15)' : 'none',
            border: `1px solid ${imgCopied ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
            borderRadius: 5, color: imgCopied ? '#818cf8' : 'var(--muted)',
            cursor: 'pointer', padding: '3px 5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { if (!imgCopied) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel-alt)'; } }}
          onMouseLeave={(e) => { if (!imgCopied) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none'; } }}
        >
          {imgCopied ? (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1" y="3" width="8" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M4 3V2.5A1.5 1.5 0 0 1 5.5 1h5A1.5 1.5 0 0 1 12 2.5v5A1.5 1.5 0 0 1 10.5 9H10" stroke="currentColor" strokeWidth="1.1"/>
              <circle cx="4" cy="6.5" r="0.9" fill="currentColor"/>
              <path d="M1 8.5l2-2 1.5 1.5 2-2.5L9 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        {/* Copy as SVG button */}
        <button
          onClick={copySvg}
          title="Copy as SVG markup"
          style={{
            flexShrink: 0, background: svgCopied ? 'rgba(249,115,22,0.15)' : 'none',
            border: `1px solid ${svgCopied ? 'rgba(249,115,22,0.4)' : 'transparent'}`,
            borderRadius: 5, color: svgCopied ? '#f97316' : 'var(--muted)',
            cursor: 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
            padding: '3px 6px', letterSpacing: '0.04em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { if (!svgCopied) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel-alt)'; } }}
          onMouseLeave={(e) => { if (!svgCopied) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none'; } }}
        >
          {svgCopied ? '✓ SVG' : 'SVG'}
        </button>
        {/* Copy as CSS button */}
        <button
          onClick={copyCss}
          title="Copy as CSS"
          style={{
            flexShrink: 0, background: cssCopied ? 'rgba(34,197,94,0.15)' : 'none',
            border: `1px solid ${cssCopied ? 'rgba(34,197,94,0.4)' : 'transparent'}`,
            borderRadius: 5, color: cssCopied ? '#22c55e' : 'var(--muted)',
            cursor: 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
            padding: '3px 6px', letterSpacing: '0.04em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { if (!cssCopied) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel-alt)'; } }}
          onMouseLeave={(e) => { if (!cssCopied) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none'; } }}
        >
          {cssCopied ? '✓ CSS' : '</> CSS'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Position & Size ── */}
        {!isPath && (
          <PositionSection shape={shape} onPreview={onPreview} onChange={onChange} isText={isText} />
        )}

        {/* ── Auto Layout (frames + rectangles) ── */}
        {(isFrame || shape.type === 'rectangle') && (
          <AutoLayoutSection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

        {/* ── Frame options (clip contents, hug contents, etc.) ── */}
        {isFrame && (
          <PanelSection label="Frame">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={labelSt}>Clip Contents</span>
              <button
                onClick={() => onChange({ clipContents: !shape.clipContents })}
                title="Clip children to frame bounds"
                style={{
                  width: 32, height: 18, borderRadius: 10, border: 'none',
                  cursor: 'pointer', flexShrink: 0,
                  background: shape.clipContents ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.15s',
                  position: 'relative',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, borderRadius: '50%',
                  width: 14, height: 14, background: '#fff',
                  transition: 'left 0.15s',
                  left: shape.clipContents ? 16 : 2,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
            {/* Scroll Direction */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={labelSt}>Scroll</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {(['none', 'vertical', 'horizontal', 'both'] as const).map((dir) => {
                  const icons: Record<string, string> = { none: '⊘', vertical: '↕', horizontal: '↔', both: '⤢' };
                  const labels: Record<string, string> = { none: 'No scroll', vertical: 'Scroll vertically', horizontal: 'Scroll horizontally', both: 'Scroll both' };
                  const active = (shape.scrollDirection ?? 'none') === dir;
                  return (
                    <button
                      key={dir}
                      title={labels[dir]}
                      onClick={() => onChange({ scrollDirection: dir })}
                      style={{
                        width: 26, height: 22, borderRadius: 4, border: '1px solid',
                        borderColor: active ? 'var(--accent)' : 'var(--border)',
                        background: active ? 'var(--accent-dim)' : 'var(--panel-alt)',
                        color: active ? 'var(--accent)' : 'var(--muted)',
                        cursor: 'pointer', fontSize: 11, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.1s',
                      }}
                    >{icons[dir]}</button>
                  );
                })}
              </div>
            </div>
            {/* Hug Contents button */}
            <HugContentsButton shape={shape} allShapes={allShapes} onChange={onChange} />
          </PanelSection>
        )}

        {/* ── Appearance ── */}
        <PanelSection label="Appearance">
          {/* Opacity row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelSt}>Opacity</span>
            <div style={{ flex: 1 }}>
              <input
                type="range" min={0} max={100}
                value={Math.round(shape.opacity * 100)}
                onChange={(e) => onPreview({ opacity: parseFloat(e.target.value) / 100 })}
                onMouseUp={(e) => onChange({ opacity: parseFloat((e.target as HTMLInputElement).value) / 100 })}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
            <span style={{ ...labelSt, width: 32, textAlign: 'right', fontFamily: 'monospace' }}>
              {Math.round(shape.opacity * 100)}%
            </span>
          </div>

          {/* Blend mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelSt}>Blend</span>
            <select
              value={shape.blendMode ?? 'normal'}
              onChange={(e) => { onPreview({ blendMode: e.target.value }); onChange({ blendMode: e.target.value }); }}
              onKeyDown={(e) => { const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z'); if (!isUndo) e.stopPropagation(); }}
              style={{ ...selectSt, flex: 1 }}
            >
              {[
                'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
                'color-dodge', 'color-burn', 'hard-light', 'soft-light',
                'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
              ].map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1).replace(/-/g, ' ')}</option>
              ))}
            </select>
          </div>
        </PanelSection>

        {/* ── Fill ── */}
        {!isText && !isPath && (
          <FillSection shape={shape} onPreview={onPreview} onChange={onChange} allShapes={allShapes} />
        )}

        {/* ── Stroke ── */}
        {!isText && !isPath && (
          <StrokeSection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

        {/* ── Path style (pen tool) ── */}
        {isPath && (
          <PathSection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

        {/* ── Effects (shadow) ── */}
        {!isPath && (
          <ShadowSection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

        {/* ── Filters ── */}
        {!isPath && (
          <FiltersSection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

        {/* ── Constraints ── */}
        {shape.parentId && (
          <ConstraintsSection shape={shape} onChange={onChange} />
        )}

        {/* ── Transform ── */}
        {!isPath && (
          <TransformSection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

        {/* ── Shape Style Presets ── */}
        {!isText && !isPath && (
          <ShapeStylePresetsSection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

        {/* ── Clip Mask ── */}
        {!isPath && (
          <ClipMaskSection shape={shape} onChange={onChange} allShapes={allShapes} />
        )}

        {/* ── Icon overlay ── */}
        {shape.iconId && (
          <IconOverlaySection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

        {/* ── Typography ── */}
        {isText && (
          <TypographySection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

        {/* ── Transition / Animation ── */}
        <TransitionSection shape={shape} onChange={onChange} />

        {/* ── CSS Animation Presets ── */}
        <CssAnimationSection shape={shape} onChange={onChange} />

        {/* ── Notes / Annotations ── */}
        <NotesSection shape={shape} onChange={onChange} />

        {/* ── Shape Tags ── */}
        <TagsSection shape={shape} onChange={onChange} />

        {/* ── Shape Variants ── */}
        <VariantsSection shape={shape} onChange={onChange} />

        {/* ── Prototype / Interactions ── */}
        <PrototypeSection shape={shape} onChange={onChange} allShapes={allShapes} />

        {/* ── CSS Code ── */}
        <CssCodeSection shape={shape} />

      </div>
    </div>
  );
}

// ── CSS Code section ──────────────────────────────────────────────────────────

function syntaxHighlightCss(css: string): React.ReactNode[] {
  // Simple line-by-line CSS highlighting
  const lines = css.split('\n');
  return lines.map((line, i) => {
    // Comments
    if (line.trim().startsWith('/*')) {
      return <div key={i} style={{ color: '#64748b' }}>{line}</div>;
    }
    // Selector lines (contain { or })
    if (line.includes('{') || line.includes('}')) {
      return <div key={i} style={{ color: '#a78bfa' }}>{line}</div>;
    }
    // Property: value; lines
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const prop = line.substring(0, colonIdx + 1);
      const rest = line.substring(colonIdx + 1);
      return (
        <div key={i}>
          <span style={{ color: '#7dd3fc' }}>{prop}</span>
          <span style={{ color: '#86efac' }}>{rest}</span>
        </div>
      );
    }
    return <div key={i} style={{ color: '#e2e8f0' }}>{line}</div>;
  });
}

// ── Prototype / Interactions section ──────────────────────────────────────────

const TRANSITIONS: { id: string; label: string }[] = [
  { id: 'none', label: 'Instant' },
  { id: 'fade', label: 'Fade' },
  { id: 'dissolve', label: 'Dissolve' },
  { id: 'slide-left', label: 'Slide ←' },
  { id: 'slide-right', label: 'Slide →' },
];

function PrototypeSection({ shape, onChange, allShapes }: {
  shape: Shape;
  onChange: (p: Partial<Shape>) => void;
  allShapes: Shape[];
}) {
  const frames = allShapes.filter(s => s.type === 'frame' && s.id !== shape.id);
  const hasLink = !!shape.protoLink;
  const linkedFrame = frames.find(f => f.id === shape.protoLink);
  const trigger = shape.protoTrigger ?? 'click';
  const transition = shape.protoTransition ?? 'none';

  return (
    <CollapsibleSection
      label="Prototype"
      onAdd={!hasLink ? () => onChange({ protoLink: frames[0]?.id ?? '', protoTrigger: 'click', protoTransition: 'fade' }) : undefined}
      onRemove={hasLink ? () => onChange({ protoLink: undefined, protoTrigger: undefined, protoTransition: undefined }) : undefined}
      startCollapsed
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {frames.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 0', fontStyle: 'italic' }}>
            Create frames to add connections
          </div>
        ) : hasLink ? (
          <>
            {/* Arrow icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>
                {trigger === 'click' ? 'On Click' : 'On Hover'}
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}> → </span>
                {linkedFrame?.name ?? 'Unknown frame'}
              </div>
            </div>

            {/* Trigger */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...labelSt, width: 56 }}>Trigger</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {(['click', 'hover'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => onChange({ protoTrigger: t })}
                    style={{
                      padding: '3px 8px', borderRadius: 4, border: '1px solid',
                      borderColor: trigger === t ? 'var(--accent)' : 'var(--border)',
                      background: trigger === t ? 'var(--accent-dim)' : 'transparent',
                      color: trigger === t ? 'var(--accent)' : 'var(--muted)',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...labelSt, width: 56 }}>Navigate</span>
              <select
                value={shape.protoLink ?? ''}
                onChange={(e) => onChange({ protoLink: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ ...selectSt, flex: 1 }}
              >
                {frames.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Transition */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...labelSt, width: 56 }}>Animation</span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {TRANSITIONS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onChange({ protoTransition: t.id as Shape['protoTransition'] })}
                    style={{
                      padding: '2px 7px', borderRadius: 4, border: '1px solid',
                      borderColor: transition === t.id ? 'var(--accent)' : 'var(--border)',
                      background: transition === t.id ? 'var(--accent-dim)' : 'transparent',
                      color: transition === t.id ? 'var(--accent)' : 'var(--muted)',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual link badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 8px', background: 'rgba(99,102,241,0.06)',
              borderRadius: 6, border: '1px dashed rgba(99,102,241,0.25)',
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="var(--accent)" strokeWidth="1"/>
                <path d="M5 3v2l1.5 1" stroke="var(--accent)" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 10, color: 'var(--accent)' }}>
                Visible in prototype preview mode (F5)
              </span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
            Click + to add an interaction
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function CssCodeSection({ shape }: { shape: Shape }) {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'css' | 'tailwind'>('css');
  const css = shapeToCss(shape);

  // Generate approximate Tailwind classes from shape properties
  const tailwind = React.useMemo(() => {
    const classes: string[] = [];
    if (shape.type === 'rectangle' || shape.type === 'frame') {
      if (shape.fill && shape.fill !== 'transparent') classes.push(`bg-[${shape.fill}]`);
    }
    if (shape.borderRadius) {
      const r = Array.isArray(shape.borderRadius) ? shape.borderRadius[0] : shape.borderRadius;
      if (r === 9999) classes.push('rounded-full');
      else if (r >= 16) classes.push(`rounded-2xl`);
      else if (r >= 8) classes.push('rounded-lg');
      else if (r >= 4) classes.push('rounded');
      else if (r > 0) classes.push('rounded-sm');
    }
    if (shape.stroke && shape.stroke !== 'transparent' && shape.strokeWidth > 0) {
      classes.push(`border border-[${shape.stroke}]`);
    }
    if (shape.opacity < 1) classes.push(`opacity-${Math.round(shape.opacity * 100)}`);
    if (shape.shadow) classes.push('shadow-md');
    if (shape.type === 'text') {
      if (shape.fontSize >= 24) classes.push('text-2xl');
      else if (shape.fontSize >= 18) classes.push('text-xl');
      else if (shape.fontSize >= 16) classes.push('text-base');
      else classes.push('text-sm');
      if (shape.fontWeight === '700' || shape.fontWeight === 'bold') classes.push('font-bold');
      else if (shape.fontWeight === '600') classes.push('font-semibold');
      if (shape.color) classes.push(`text-[${shape.color}]`);
    }
    if (shape.filterBlur && shape.filterBlur > 0) classes.push(`blur-${Math.round(shape.filterBlur / 4)}`);
    if (shape.filterBackdropBlur && shape.filterBackdropBlur > 0) classes.push('backdrop-blur-md');
    if (shape.blendMode && shape.blendMode !== 'normal') classes.push(`mix-blend-${shape.blendMode}`);
    return classes.join(' ') || '/* No Tailwind mapping */';
  }, [shape]);

  const content = mode === 'css' ? css : tailwind;

  const copy = () => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <CollapsibleSection label="CSS Code" startCollapsed>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Mode toggle + copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', background: 'var(--panel-alt)', borderRadius: 5, padding: 2, gap: 2 }}>
            {(['css', 'tailwind'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer',
                  background: mode === m ? 'var(--panel)' : 'none',
                  color: mode === m ? 'var(--text)' : 'var(--muted)',
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {m === 'css' ? 'CSS' : 'Tailwind'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={copy}
            style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'var(--panel-alt)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
              borderRadius: 5, cursor: 'pointer',
              color: copied ? '#22c55e' : 'var(--muted)',
              fontSize: 10, fontWeight: 700, padding: '3px 8px',
              display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* Code block */}
        <div style={{
          background: '#0f172a',
          borderRadius: 8, padding: '10px 12px',
          border: '1px solid rgba(255,255,255,0.06)',
          overflow: 'auto', maxHeight: 220,
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
          fontSize: 11, lineHeight: 1.65,
          userSelect: 'text',
        }}>
          {mode === 'css'
            ? syntaxHighlightCss(css)
            : <div style={{ color: '#86efac', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{tailwind}</div>
          }
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ── Type badge ─────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: Shape['type'] }) {
  const icons: Record<Shape['type'], string> = {
    frame: '⬜', rectangle: '▬', ellipse: '◯', text: 'T', path: '✏',
  };
  return (
    <span style={{
      fontSize: 11, color: 'var(--muted)', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
    }}>
      {icons[type] ?? '?'} {type}
    </span>
  );
}

// ── Fill section ───────────────────────────────────────────────────────────

type FillType = 'solid' | 'linear-gradient' | 'radial-gradient' | 'image' | 'pattern';

function FillSection({ shape, onPreview, onChange, allShapes = [] }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void; allShapes?: Shape[] }) {
  const fillType: FillType = (shape.fillType as FillType) ?? 'solid';
  const hasFill = fillType === 'image' ? true : fillType !== 'solid' || shape.fill !== 'transparent';
  const stops: GradientStop[] = shape.gradientStops ?? [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }];
  const angle = shape.gradientAngle ?? 135;
  const [imageUrlInput, setImageUrlInput] = useState(shape.imageUrl ?? '');
  useEffect(() => { setImageUrlInput(shape.imageUrl ?? ''); }, [shape.imageUrl]);

  const FILL_TYPES: { id: FillType; label: string; title: string }[] = [
    { id: 'solid', label: '■', title: 'Solid' },
    { id: 'linear-gradient', label: '▦', title: 'Linear gradient' },
    { id: 'radial-gradient', label: '◎', title: 'Radial gradient' },
    { id: 'image', label: '🖼', title: 'Image fill' },
    { id: 'pattern', label: '⊹', title: 'Pattern fill' },
  ];

  return (
    <CollapsibleSection
      label="Fill"
      onAdd={!hasFill ? () => { onPreview({ fill: '#e2e8f0', fillType: 'solid' }); onChange({ fill: '#e2e8f0', fillType: 'solid' }); } : undefined}
      onRemove={hasFill ? () => { onPreview({ fill: 'transparent', fillType: 'solid', imageUrl: undefined }); onChange({ fill: 'transparent', fillType: 'solid', imageUrl: undefined }); } : undefined}
    >
      {hasFill && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Fill type toggle */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--panel-alt)', borderRadius: 6, padding: 2 }}>
            {FILL_TYPES.map(ft => (
              <button
                key={ft.id}
                title={ft.title}
                onClick={() => { onPreview({ fillType: ft.id }); onChange({ fillType: ft.id }); }}
                style={{
                  flex: 1, height: 22, borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: fillType === ft.id ? 'var(--panel)' : 'none',
                  color: fillType === ft.id ? 'var(--text)' : 'var(--muted)',
                  fontSize: 13, fontWeight: fillType === ft.id ? 700 : 400,
                  boxShadow: fillType === ft.id ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.1s',
                }}
              >
                {ft.label}
              </button>
            ))}
          </div>

          {/* Solid: colour picker */}
          {fillType === 'solid' && (
            <>
              <ColorRow
                color={shape.fill}
                opacity={Math.round(shape.fillOpacity * 100)}
                onColorPreview={(v) => onPreview({ fill: v })}
                onColorCommit={(v) => onChange({ fill: v })}
                onOpacityPreview={(v) => onPreview({ fillOpacity: v / 100 })}
                onOpacityCommit={(v) => onChange({ fillOpacity: v / 100 })}
              />
              {/* Document colors */}
              <DocColors
                shapes={allShapes}
                onPick={(c) => { onPreview({ fill: c }); onChange({ fill: c }); }}
              />
              {/* Color harmony suggestions */}
              {/^#[0-9a-fA-F]{6}$/.test(shape.fill) && shape.fill !== 'transparent' && (
                <ColorHarmony
                  baseColor={shape.fill}
                  onPick={(c) => { onPreview({ fill: c }); onChange({ fill: c }); }}
                />
              )}
            </>
          )}

          {/* Gradient editor */}
          {(fillType === 'linear-gradient' || fillType === 'radial-gradient') && (
            <>
              <GradientEditor
                type={fillType}
                stops={stops}
                angle={angle}
                onPreview={(s, a) => onPreview({ gradientStops: s, gradientAngle: a })}
                onChange={(s, a) => onChange({ gradientStops: s, gradientAngle: a })}
              />
              <GradientPresets
                type={fillType}
                onApply={(stops, angle) => {
                  onPreview({ gradientStops: stops, gradientAngle: angle, fillType });
                  onChange({ gradientStops: stops, gradientAngle: angle, fillType });
                }}
              />
            </>
          )}

          {/* Image fill */}
          {fillType === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* URL input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={labelSt}>Image URL</span>
                <input
                  type="text"
                  placeholder="https://… or paste data:image/…"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  onBlur={(e) => {
                    const url = e.target.value.trim();
                    onPreview({ imageUrl: url, fillType: 'image' });
                    onChange({ imageUrl: url, fillType: 'image' });
                  }}
                  onKeyDown={(e) => {
                    const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z');
                    if (!isUndo) e.stopPropagation();
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') { setImageUrlInput(shape.imageUrl ?? ''); (e.target as HTMLInputElement).blur(); }
                  }}
                  style={{ ...inputSt, fontSize: 11 }}
                />
              </div>

              {/* Upload from file */}
              <div>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: 'var(--accent)', cursor: 'pointer',
                  background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 5, padding: '4px 10px',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload image
                  <input
                    type="file" accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        if (!dataUrl) return;
                        setImageUrlInput(dataUrl);
                        onPreview({ imageUrl: dataUrl, fillType: 'image' });
                        onChange({ imageUrl: dataUrl, fillType: 'image' });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>

              {/* Fit mode */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={labelSt}>Fit</span>
                <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                  {(['fill', 'fit', 'crop', 'tile'] as const).map((fit) => (
                    <button
                      key={fit}
                      onClick={() => { onPreview({ imageFit: fit }); onChange({ imageFit: fit }); }}
                      style={{
                        flex: 1, height: 24, borderRadius: 4,
                        border: '1px solid',
                        borderColor: (shape.imageFit ?? 'fill') === fit ? 'var(--accent)' : 'var(--border)',
                        background: (shape.imageFit ?? 'fill') === fit ? 'var(--accent-dim)' : 'transparent',
                        color: (shape.imageFit ?? 'fill') === fit ? 'var(--accent)' : 'var(--muted)',
                        cursor: 'pointer', fontSize: 10, fontWeight: 600, textTransform: 'capitalize',
                      }}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {shape.imageUrl && (
                <div style={{
                  width: '100%', height: 72, borderRadius: 6,
                  background: `url("${shape.imageUrl}") center/cover no-repeat`,
                  border: '1px solid var(--border)',
                }} />
              )}
            </div>
          )}

          {/* Pattern fill */}
          {fillType === 'pattern' && (
            <PatternFillSection shape={shape} onPreview={onPreview} onChange={onChange} />
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Pattern Fill Section ──────────────────────────────────────────────────────

function PatternFillSection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  const patternId = shape.patternId ?? 'dots';
  const patternColor = shape.patternColor ?? '#000000';
  const patternBg = shape.patternBg ?? 'transparent';
  const patternScale = shape.patternScale ?? 1;

  const CATEGORIES = [...new Set(FILL_PATTERNS.map(p => p.category))];

  const applyPattern = (updates: Partial<{ patternId: string; patternColor: string; patternBg: string; patternScale: number }>) => {
    onPreview(updates);
    onChange(updates);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Pattern grid */}
      {CATEGORIES.map(cat => (
        <div key={cat}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {cat}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {FILL_PATTERNS.filter(p => p.category === cat).map(p => {
              const isActive = patternId === p.id;
              const pat = FILL_PATTERNS.find(x => x.id === p.id);
              const previewBg = pat ? pat.build(patternColor, patternBg === 'transparent' ? '#1e1e2e' : patternBg, patternScale) : '';
              return (
                <button
                  key={p.id}
                  title={p.label}
                  onClick={() => applyPattern({ patternId: p.id })}
                  style={{
                    width: 40, height: 40, borderRadius: 5, border: '2px solid',
                    borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                    cursor: 'pointer', overflow: 'hidden', padding: 0,
                    backgroundImage: previewBg,
                    backgroundRepeat: 'repeat',
                    backgroundSize: 'auto',
                    boxShadow: isActive ? '0 0 0 1px var(--accent)' : 'none',
                    position: 'relative',
                  }}
                >
                  {isActive && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(99,102,241,0.25)',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Colors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...labelSt, width: 60 }}>Foreground</span>
          <ColorSwatchInput
            value={patternColor}
            onPreview={(v) => onPreview({ patternColor: v })}
            onCommit={(v) => onChange({ patternColor: v })}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...labelSt, width: 60 }}>Background</span>
          <ColorSwatchInput
            value={patternBg === 'transparent' ? '#00000000' : patternBg}
            onPreview={(v) => onPreview({ patternBg: v })}
            onCommit={(v) => onChange({ patternBg: v })}
          />
        </div>
      </div>

      {/* Scale */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...labelSt, width: 60 }}>Scale</span>
        <input
          type="range" min="0.5" max="4" step="0.1"
          value={patternScale}
          onChange={(e) => onPreview({ patternScale: parseFloat(e.target.value) })}
          onMouseUp={(e) => onChange({ patternScale: parseFloat((e.target as HTMLInputElement).value) })}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 10, color: 'var(--muted)', width: 28, textAlign: 'right' }}>
          {patternScale.toFixed(1)}×
        </span>
      </div>
    </div>
  );
}

// ── Clip Mask section ─────────────────────────────────────────────────────────

function ClipMaskSection({ shape, onChange, allShapes }: {
  shape: Shape;
  onChange: (p: Partial<Shape>) => void;
  allShapes: Shape[];
}) {
  const hasMask = !!shape.clipMaskId;
  const maskShape = allShapes.find(s => s.id === shape.clipMaskId);
  // Only offer shapes that can act as masks (not self, not the mask itself)
  const maskCandidates = allShapes.filter(s =>
    s.id !== shape.id && !s.isMask && (s.type === 'rectangle' || s.type === 'ellipse' || s.type === 'frame')
  );

  const setMask = (maskId: string | undefined) => {
    if (maskId) {
      // Mark the mask shape as isMask
      onChange({ clipMaskId: maskId });
    } else {
      // Clear mask — also unmark old mask shape
      onChange({ clipMaskId: undefined });
    }
  };

  return (
    <CollapsibleSection label="Clip Mask" startCollapsed={!hasMask}>
      {hasMask ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Mask indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 6, padding: '6px 10px',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="1" width="12" height="12" rx="2" stroke="#6366f1" strokeWidth="1.2" strokeDasharray="2 1.5"/>
              <rect x="3.5" y="3.5" width="7" height="7" rx="1" fill="#6366f1" opacity="0.5"/>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 1 }}>
                Clipped to: {maskShape?.name ?? 'Unknown'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                {maskShape?.type ?? '—'} · {maskShape ? `${Math.round(maskShape.width)}×${Math.round(maskShape.height)}` : '—'}
              </div>
            </div>
          </div>
          {/* Change / Remove */}
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={shape.clipMaskId ?? ''}
              onChange={e => { if (e.target.value) setMask(e.target.value); }}
              style={{
                flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
                borderRadius: 5, color: 'var(--text)', fontSize: 11, padding: '3px 6px', cursor: 'pointer',
              }}
            >
              <option value="">Change mask…</option>
              {maskCandidates.map(s => (
                <option key={s.id} value={s.id}>{s.name || s.type}</option>
              ))}
            </select>
            <button
              onClick={() => setMask(undefined)}
              title="Remove clip mask"
              style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 5, color: '#ef4444', cursor: 'pointer',
                fontSize: 10, padding: '3px 8px', fontWeight: 600,
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
            Clip this shape's visible area to the bounds of another shape on the canvas.
          </div>
          {maskCandidates.length > 0 ? (
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) setMask(e.target.value); }}
              style={{
                width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)',
                borderRadius: 5, color: 'var(--text)', fontSize: 11, padding: '4px 6px', cursor: 'pointer',
              }}
            >
              <option value="">Select mask shape…</option>
              {maskCandidates.map(s => (
                <option key={s.id} value={s.id}>{s.name || s.type} ({Math.round(s.width)}×{Math.round(s.height)})</option>
              ))}
            </select>
          ) : (
            <div style={{
              fontSize: 10.5, color: 'var(--subtle)', background: 'var(--panel-alt)',
              borderRadius: 5, padding: '6px 8px', lineHeight: 1.5,
            }}>
              Add a rectangle, ellipse, or frame to the canvas to use as a mask shape.
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Icon Overlay section ─────────────────────────────────────────────────────

const ICON_SIZES = [12, 16, 20, 24, 32, 40, 48, 64, 96];
const COMMON_COLORS = ['#1e293b', '#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#ffffff', '#64748b'];

function IconOverlaySection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  const iconId = shape.iconId ?? '';
  const iconColor = shape.iconColor ?? '#1e293b';
  const iconSize = shape.iconSize ?? 48;
  const IconComp = iconId ? (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; stroke?: string }>>)[iconId] : null;

  return (
    <CollapsibleSection
      label="Icon"
      onRemove={() => { onPreview({ iconId: undefined }); onChange({ iconId: undefined }); }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Preview */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', background: 'var(--panel-alt)',
          borderRadius: 8, border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {IconComp ? <IconComp size={28} stroke={iconColor} /> : (
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>?</span>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{iconId}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Lucide · {iconSize}px</div>
          </div>
        </div>

        {/* Size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...labelSt, width: 40 }}>Size</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, flex: 1 }}>
            {ICON_SIZES.map(s => (
              <button
                key={s}
                onClick={() => { onPreview({ iconSize: s }); onChange({ iconSize: s }); }}
                style={{
                  padding: '2px 5px', borderRadius: 4, border: '1px solid',
                  borderColor: iconSize === s ? 'var(--accent)' : 'var(--border)',
                  background: iconSize === s ? 'var(--accent-dim)' : 'transparent',
                  color: iconSize === s ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 10, cursor: 'pointer', fontWeight: 600,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...labelSt, width: 40 }}>Color</span>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', flex: 1 }}>
            {COMMON_COLORS.map(c => (
              <button
                key={c}
                onClick={() => { onPreview({ iconColor: c }); onChange({ iconColor: c }); }}
                style={{
                  width: 18, height: 18, borderRadius: '50%', border: '2px solid',
                  borderColor: iconColor === c ? 'var(--accent)' : 'var(--border)',
                  background: c, cursor: 'pointer',
                  boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
                }}
              />
            ))}
            <input
              type="color" value={iconColor}
              onChange={e => { onPreview({ iconColor: e.target.value }); }}
              onBlur={e => { onChange({ iconColor: e.target.value }); }}
              style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', cursor: 'pointer', padding: 0, background: 'none' }}
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ── Stroke section ─────────────────────────────────────────────────────────

const STROKE_GRADIENT_PRESETS = [
  { label: 'Indigo→Purple', stops: [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }], angle: 135 },
  { label: 'Pink→Orange', stops: [{ color: '#ec4899', position: 0 }, { color: '#f97316', position: 1 }], angle: 135 },
  { label: 'Cyan→Blue', stops: [{ color: '#06b6d4', position: 0 }, { color: '#3b82f6', position: 1 }], angle: 135 },
  { label: 'Green→Teal', stops: [{ color: '#22c55e', position: 0 }, { color: '#14b8a6', position: 1 }], angle: 90 },
  { label: 'Gold→Red', stops: [{ color: '#fbbf24', position: 0 }, { color: '#ef4444', position: 1 }], angle: 135 },
  { label: 'Rainbow', stops: [{ color: '#ef4444', position: 0 }, { color: '#f97316', position: 0.25 }, { color: '#22c55e', position: 0.5 }, { color: '#3b82f6', position: 0.75 }, { color: '#a855f7', position: 1 }], angle: 90 },
];

function StrokeSection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  const hasStroke = shape.stroke !== 'transparent' && shape.strokeWidth > 0;
  const hasGradientStroke = !!(shape.strokeGradientStops && shape.strokeGradientStops.length >= 2);
  const strokeMode = hasGradientStroke ? 'gradient' : 'solid';

  return (
    <CollapsibleSection
      label="Stroke"
      onAdd={!hasStroke ? () => { onPreview({ stroke: '#6366f1', strokeWidth: 1 }); onChange({ stroke: '#6366f1', strokeWidth: 1 }); } : undefined}
      onRemove={hasStroke ? () => { onPreview({ stroke: 'transparent', strokeWidth: 0, strokeGradientStops: undefined }); onChange({ stroke: 'transparent', strokeWidth: 0, strokeGradientStops: undefined }); } : undefined}
    >
      {hasStroke && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Stroke type toggle: solid vs gradient */}
          <div style={{ display: 'flex', gap: 3 }}>
            {(['solid', 'gradient'] as const).map(mode => (
              <button key={mode} onClick={() => {
                if (mode === 'gradient') {
                  const preset = STROKE_GRADIENT_PRESETS[0];
                  onPreview({ strokeGradientStops: preset.stops, strokeGradientAngle: preset.angle });
                  onChange({ strokeGradientStops: preset.stops, strokeGradientAngle: preset.angle });
                } else {
                  onPreview({ strokeGradientStops: undefined });
                  onChange({ strokeGradientStops: undefined });
                }
              }}
              style={{
                flex: 1, height: 22, borderRadius: 4, fontSize: 10, fontWeight: 600,
                border: '1px solid', cursor: 'pointer',
                borderColor: strokeMode === mode ? 'var(--accent)' : 'var(--border)',
                background: strokeMode === mode ? 'var(--accent-dim)' : 'transparent',
                color: strokeMode === mode ? 'var(--accent)' : 'var(--muted)',
              }}>
                {mode === 'solid' ? 'Solid' : '⬡ Gradient'}
              </button>
            ))}
          </div>

          {strokeMode === 'solid' ? (
            <ColorRow
              color={shape.stroke === 'transparent' ? '#6366f1' : shape.stroke}
              opacity={100}
              onColorPreview={(v) => onPreview({ stroke: v })}
              onColorCommit={(v) => onChange({ stroke: v })}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Gradient stroke presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {STROKE_GRADIENT_PRESETS.map((preset, i) => {
                  const stops = preset.stops;
                  const gradCss = `linear-gradient(${preset.angle}deg, ${stops.map(s => `${s.color} ${s.position * 100}%`).join(', ')})`;
                  return (
                    <button key={i} title={preset.label} onClick={() => {
                      onPreview({ strokeGradientStops: preset.stops, strokeGradientAngle: preset.angle });
                      onChange({ strokeGradientStops: preset.stops, strokeGradientAngle: preset.angle });
                    }} style={{
                      width: 28, height: 18, borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)',
                      background: gradCss, cursor: 'pointer', padding: 0, flexShrink: 0,
                    }} />
                  );
                })}
              </div>
              {/* Angle control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={labelSt}>Angle</span>
                <FieldBox label="" value={shape.strokeGradientAngle ?? 135} min={0}
                  onPreview={(v) => onPreview({ strokeGradientAngle: v })}
                  onCommit={(v) => onChange({ strokeGradientAngle: v })} />
                <span style={labelSt}>°</span>
              </div>
            </div>
          )}

          {/* Width + position row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={labelSt}>Width</span>
            <FieldBox label="" value={shape.strokeWidth} min={1}
              onPreview={(v) => onPreview({ strokeWidth: v })}
              onCommit={(v) => onChange({ strokeWidth: v })} />
            <span style={labelSt}>px</span>
            <div style={{ flex: 1 }} />
            {/* Stroke position */}
            {(['inside', 'center', 'outside'] as const).map(pos => (
              <button
                key={pos}
                onClick={() => { onPreview({ strokePosition: pos }); onChange({ strokePosition: pos }); }}
                title={`Stroke ${pos}`}
                style={{
                  height: 22, width: 22, borderRadius: 4,
                  border: '1px solid',
                  borderColor: (shape.strokePosition ?? 'center') === pos ? 'var(--accent)' : 'var(--border)',
                  background: (shape.strokePosition ?? 'center') === pos ? 'var(--accent-dim)' : 'transparent',
                  cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="1" width="10" height="10"
                    stroke={(shape.strokePosition ?? 'center') === pos ? 'var(--accent)' : 'var(--muted)'}
                    strokeWidth={pos === 'inside' ? '3' : pos === 'outside' ? '3' : '2'}
                    strokeDasharray={pos === 'inside' ? '10 0' : pos === 'outside' ? '10 0' : undefined}
                    fill="none"
                    style={{
                      clipPath: pos === 'inside' ? 'inset(0)' : pos === 'outside' ? 'none' : 'none',
                    }}
                  />
                </svg>
              </button>
            ))}
          </div>
          {/* Dash pattern */}
          {strokeMode === 'solid' && (
            <div style={{ display: 'flex', gap: 4 }}>
              {(['solid', 'dashed', 'dotted'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => { onPreview({ strokeDash: d }); onChange({ strokeDash: d }); }}
                  title={d.charAt(0).toUpperCase() + d.slice(1)}
                  style={{
                    flex: 1, height: 22, borderRadius: 4,
                    border: '1px solid',
                    borderColor: (shape.strokeDash ?? 'solid') === d ? 'var(--accent)' : 'var(--border)',
                    background: (shape.strokeDash ?? 'solid') === d ? 'var(--accent-dim)' : 'transparent',
                    color: (shape.strokeDash ?? 'solid') === d ? 'var(--accent)' : 'var(--muted)',
                    cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  }}
                >
                  {d === 'solid' ? '——' : d === 'dashed' ? '- -' : '···'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Path section ────────────────────────────────────────────────────────────

function PathSection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  const hasStroke = shape.stroke !== 'transparent' && (shape.strokeWidth ?? 0) > 0;

  return (
    <CollapsibleSection label="Path Style">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Stroke color + width */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ ...labelSt, marginBottom: 2 }}>Stroke</span>
          <ColorRow
            color={shape.stroke === 'transparent' ? '#6366f1' : shape.stroke}
            opacity={100}
            onColorPreview={(v) => onPreview({ stroke: v })}
            onColorCommit={(v) => onChange({ stroke: v })}
          />
          {hasStroke && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={labelSt}>Width</span>
              <FieldBox label="" value={shape.strokeWidth ?? 2} min={1}
                onPreview={(v) => onPreview({ strokeWidth: v })}
                onCommit={(v) => onChange({ strokeWidth: v })} />
              <span style={labelSt}>px</span>
            </div>
          )}
        </div>

        {/* Dash pattern */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={labelSt}>Dash</span>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {(['solid', 'dashed', 'dotted'] as const).map(d => (
              <button
                key={d}
                onClick={() => { onPreview({ strokeDash: d }); onChange({ strokeDash: d }); }}
                title={d.charAt(0).toUpperCase() + d.slice(1)}
                style={{
                  flex: 1, height: 26, borderRadius: 5,
                  border: '1px solid',
                  borderColor: (shape.strokeDash ?? 'solid') === d ? 'var(--accent)' : 'var(--border)',
                  background: (shape.strokeDash ?? 'solid') === d ? 'var(--accent-dim)' : 'transparent',
                  color: (shape.strokeDash ?? 'solid') === d ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer', fontSize: 10, fontWeight: 600,
                }}
              >
                {d === 'solid' ? '——' : d === 'dashed' ? '- - -' : '· · ·'}
              </button>
            ))}
          </div>
        </div>

        {/* Cap style */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={labelSt}>Cap</span>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {(['butt', 'round', 'square'] as const).map(c => (
              <button
                key={c}
                onClick={() => { onPreview({ lineCap: c }); onChange({ lineCap: c }); }}
                title={c.charAt(0).toUpperCase() + c.slice(1)}
                style={{
                  flex: 1, height: 26, borderRadius: 5,
                  border: '1px solid',
                  borderColor: (shape.lineCap ?? 'round') === c ? 'var(--accent)' : 'var(--border)',
                  background: (shape.lineCap ?? 'round') === c ? 'var(--accent-dim)' : 'transparent',
                  color: (shape.lineCap ?? 'round') === c ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer', fontSize: 10, fontWeight: 600,
                }}
              >
                {c === 'butt' ? '|' : c === 'round' ? '(' : '⊓'}
              </button>
            ))}
          </div>
        </div>

        {/* Join style */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={labelSt}>Join</span>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {(['miter', 'round', 'bevel'] as const).map(j => (
              <button
                key={j}
                onClick={() => { onPreview({ lineJoin: j }); onChange({ lineJoin: j }); }}
                title={j.charAt(0).toUpperCase() + j.slice(1)}
                style={{
                  flex: 1, height: 26, borderRadius: 5,
                  border: '1px solid',
                  borderColor: (shape.lineJoin ?? 'round') === j ? 'var(--accent)' : 'var(--border)',
                  background: (shape.lineJoin ?? 'round') === j ? 'var(--accent-dim)' : 'transparent',
                  color: (shape.lineJoin ?? 'round') === j ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer', fontSize: 10, fontWeight: 600,
                }}
              >
                {j === 'miter' ? '∧' : j === 'round' ? '⌒' : '⊿'}
              </button>
            ))}
          </div>
        </div>

        {/* Close path */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={shape.pathClosed ?? false}
            onChange={(e) => { onPreview({ pathClosed: e.target.checked }); onChange({ pathClosed: e.target.checked }); }}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={labelSt}>Close path</span>
        </label>

        {/* Arrows */}
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
            <input
              type="checkbox"
              checked={shape.arrowStart ?? false}
              onChange={(e) => { onPreview({ arrowStart: e.target.checked }); onChange({ arrowStart: e.target.checked }); }}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={labelSt}>← Start</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
            <input
              type="checkbox"
              checked={shape.arrowEnd ?? false}
              onChange={(e) => { onPreview({ arrowEnd: e.target.checked }); onChange({ arrowEnd: e.target.checked }); }}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={labelSt}>End →</span>
          </label>
        </div>

        {/* Point count info */}
        <div style={{ color: 'var(--muted)', fontSize: 11 }}>
          {(shape.points ?? []).length} point{(shape.points ?? []).length !== 1 ? 's' : ''}
        </div>

      </div>
    </CollapsibleSection>
  );
}

// ── Shadow section ─────────────────────────────────────────────────────────

// ── Shadow position pad (drag to set X/Y offset) ──────────────────────────────

function ShadowPositionPad({ x, y, onPreview, onCommit }: {
  x: number;
  y: number;
  onPreview: (x: number, y: number) => void;
  onCommit: (x: number, y: number) => void;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const PAD = 72;
  const MAX_OFFSET = 30;

  // Clamp dot position within pad
  const dotX = PAD / 2 + Math.max(-1, Math.min(1, x / MAX_OFFSET)) * (PAD / 2 - 8);
  const dotY = PAD / 2 + Math.max(-1, Math.min(1, y / MAX_OFFSET)) * (PAD / 2 - 8);

  const update = (cx: number, cy: number, commit: boolean) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rx = (cx - rect.left - PAD / 2) / (PAD / 2 - 8);
    const ry = (cy - rect.top - PAD / 2) / (PAD / 2 - 8);
    const nx = Math.round(Math.max(-1, Math.min(1, rx)) * MAX_OFFSET);
    const ny = Math.round(Math.max(-1, Math.min(1, ry)) * MAX_OFFSET);
    if (commit) onCommit(nx, ny); else onPreview(nx, ny);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    update(e.clientX, e.clientY, false);
    const onMove = (ev: MouseEvent) => { if (dragging.current) update(ev.clientX, ev.clientY, false); };
    const onUp = (ev: MouseEvent) => {
      if (dragging.current) { dragging.current = false; update(ev.clientX, ev.clientY, true); }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        ref={padRef}
        onMouseDown={handleMouseDown}
        title="Drag to set shadow direction and distance"
        style={{
          width: PAD, height: PAD, borderRadius: 8, flexShrink: 0,
          background: 'var(--input-bg)', border: '1px solid var(--border)',
          cursor: 'crosshair', position: 'relative', userSelect: 'none',
        }}
      >
        <svg width={PAD} height={PAD} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {/* Grid lines */}
          <line x1={PAD/2} y1={4} x2={PAD/2} y2={PAD-4} stroke="var(--border)" strokeWidth="1"/>
          <line x1={4} y1={PAD/2} x2={PAD-4} y2={PAD/2} stroke="var(--border)" strokeWidth="1"/>
          {/* Shadow dot */}
          <circle cx={dotX} cy={dotY} r={6} fill={`rgba(0,0,0,0.3)`} />
          {/* Shape preview (center box) */}
          <rect x={PAD/2-8} y={PAD/2-8} width={16} height={16} rx={3} fill="var(--panel-alt)" stroke="var(--accent)" strokeWidth="1"/>
          {/* Direction line */}
          <line x1={PAD/2} y1={PAD/2} x2={dotX} y2={dotY} stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" strokeDasharray="2 2"/>
        </svg>
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text)', display: 'block', fontSize: 10.5 }}>Direction</strong>
        Drag to set shadow position
        <div style={{ fontFamily: 'monospace', color: 'var(--subtle)', fontSize: 9.5, marginTop: 2 }}>
          X: {x}px · Y: {y}px
        </div>
      </div>
    </div>
  );
}

function ShadowSection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  // Normalize: use shadows array if present, else migrate from legacy single shadow
  const shadows: ShadowDef[] = shape.shadows && shape.shadows.length > 0
    ? shape.shadows
    : (shape.shadow
        ? [{ x: shape.shadowX, y: shape.shadowY, blur: shape.shadowBlur, color: shape.shadowColor }]
        : []);

  const [selectedIdx, setSelectedIdx] = useState(0);

  const updateShadows = (next: ShadowDef[]) => {
    onPreview({ shadows: next, shadow: next.length > 0 });
    onChange({ shadows: next, shadow: next.length > 0 });
  };

  const addShadow = () => {
    const next = [...shadows, { x: 2, y: 4, blur: 12, color: '#00000033' }];
    updateShadows(next);
    setSelectedIdx(next.length - 1);
  };

  const removeShadow = (idx: number) => {
    const next = shadows.filter((_, i) => i !== idx);
    updateShadows(next);
    setSelectedIdx(Math.max(0, selectedIdx - 1));
  };

  const updateShadow = (idx: number, patch: Partial<ShadowDef>) => {
    const next = shadows.map((sh, i) => i === idx ? { ...sh, ...patch } : sh);
    updateShadows(next);
  };

  const sel = shadows[selectedIdx];
  const selColor = sel ? (/^#[0-9a-fA-F]{6}/.test(sel.color) ? sel.color.slice(0, 7) : '#000000') : '#000000';
  const selAlpha = sel ? Math.round((parseInt(sel.color.slice(7, 9) || '33', 16) / 255) * 100) : 20;

  // Shadow presets
  const SHADOW_PRESETS: { label: string; title: string; shadows: ShadowDef[] }[] = [
    { label: 'Soft', title: 'Soft shadow', shadows: [{ x: 0, y: 4, blur: 16, color: '#00000020' }, { x: 0, y: 1, blur: 4, color: '#00000010' }] },
    { label: 'Card', title: 'Card shadow', shadows: [{ x: 0, y: 8, blur: 24, color: '#00000030' }, { x: 0, y: 2, blur: 6, color: '#00000018' }] },
    { label: 'Float', title: 'Floating / elevated shadow', shadows: [{ x: 0, y: 20, blur: 48, color: '#00000040' }, { x: 0, y: 4, blur: 12, color: '#00000025' }] },
    { label: 'Glow', title: 'Accent glow', shadows: [{ x: 0, y: 0, blur: 20, color: '#6366f150' }, { x: 0, y: 0, blur: 6, color: '#6366f130' }] },
    { label: 'Neu', title: 'Neumorphic shadow', shadows: [{ x: -6, y: -6, blur: 12, color: '#ffffff08' }, { x: 6, y: 6, blur: 12, color: '#00000040' }] },
    { label: 'None', title: 'Remove all shadows', shadows: [] },
  ];

  return (
    <CollapsibleSection
      label="Effects"
      onAdd={addShadow}
      onRemove={shadows.length > 0 ? () => updateShadows([]) : undefined}
    >
      {/* Shadow presets */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
        {SHADOW_PRESETS.map(({ label, title, shadows: presetShadows }) => {
          const isNone = presetShadows.length === 0;
          return (
            <button
              key={label}
              onClick={() => updateShadows(presetShadows)}
              title={title}
              style={{
                background: 'var(--panel-alt)', border: '1px solid var(--border)',
                borderRadius: 4, cursor: 'pointer',
                fontSize: 9, fontWeight: 600, padding: '3px 7px',
                color: isNone ? 'var(--error)' : 'var(--muted)',
                transition: 'all 0.1s',
                position: 'relative',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = isNone ? 'rgba(239,68,68,0.4)' : 'var(--accent)';
                e.currentTarget.style.color = isNone ? 'var(--error)' : 'var(--accent)';
                e.currentTarget.style.background = isNone ? 'rgba(239,68,68,0.08)' : 'var(--accent-dim)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = isNone ? 'var(--error)' : 'var(--muted)';
                e.currentTarget.style.background = 'var(--panel-alt)';
              }}
            >
              {/* Mini shadow preview box */}
              {!isNone && (
                <span style={{
                  display: 'inline-block',
                  width: 8, height: 8,
                  background: 'rgba(150,150,200,0.4)',
                  borderRadius: 2,
                  boxShadow: presetShadows.map(s => `${s.x}px ${s.y}px ${s.blur}px ${s.color}`).join(', '),
                  marginRight: 4,
                  verticalAlign: 'middle',
                }} />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {shadows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Shadow stack list */}
          {shadows.map((sh, idx) => {
            const isActive = idx === selectedIdx;
            const color = /^#[0-9a-fA-F]{6}/.test(sh.color) ? sh.color.slice(0, 7) : '#000000';
            return (
              <div
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 8px', borderRadius: 5, cursor: 'pointer',
                  background: isActive ? 'rgba(99,102,241,0.1)' : 'var(--panel-alt)',
                  border: '1px solid',
                  borderColor: isActive ? 'rgba(99,102,241,0.3)' : 'var(--border)',
                }}
              >
                {/* Color swatch */}
                <div style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  background: color, border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: `${sh.x}px ${sh.y}px ${sh.blur}px ${sh.color}`,
                }} />
                <span style={{ flex: 1, fontSize: 11, color: isActive ? 'var(--accent)' : 'var(--text)' }}>
                  {sh.inset ? 'Inner shadow' : 'Drop shadow'} {idx + 1}
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>
                  {sh.x},{sh.y} {sh.blur}px
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeShadow(idx); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, padding: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                >✕</button>
              </div>
            );
          })}

          {/* Selected shadow controls */}
          {sel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 0' }}>
              {/* Inner shadow toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: 'var(--muted)' }}>
                  <input
                    type="checkbox"
                    checked={sel.inset ?? false}
                    onChange={(e) => updateShadow(selectedIdx, { inset: e.target.checked })}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  Inner shadow
                </label>
              </div>
              {/* Color + alpha */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <ColorSwatchInput
                  value={selColor}
                  onPreview={(v) => {
                    const alpha = sel.color.length >= 9 ? sel.color.slice(7, 9) : '33';
                    updateShadow(selectedIdx, { color: v + alpha });
                  }}
                  onCommit={(v) => {
                    const alpha = sel.color.length >= 9 ? sel.color.slice(7, 9) : '33';
                    updateShadow(selectedIdx, { color: v + alpha });
                  }}
                />
                <span style={{ ...labelSt, flex: 1 }}>Color</span>
                <FieldBox
                  label=""
                  value={selAlpha}
                  min={0}
                  onPreview={(n) => {
                    const alpha = Math.round(Math.max(0, Math.min(100, n)) / 100 * 255).toString(16).padStart(2, '0');
                    updateShadow(selectedIdx, { color: selColor + alpha });
                  }}
                  onCommit={(n) => {
                    const alpha = Math.round(Math.max(0, Math.min(100, n)) / 100 * 255).toString(16).padStart(2, '0');
                    updateShadow(selectedIdx, { color: selColor + alpha });
                  }}
                />
                <span style={labelSt}>%</span>
              </div>
              {/* ── Shadow position pad ── */}
              <ShadowPositionPad
                x={sel.x} y={sel.y}
                onPreview={(x, y) => updateShadow(selectedIdx, { x, y })}
                onCommit={(x, y) => updateShadow(selectedIdx, { x, y })}
              />
              {/* X / Y / Blur / Spread */}
              <div style={{ display: 'flex', gap: 5 }}>
                <FieldBox label="X" value={sel.x}
                  onPreview={(v) => updateShadow(selectedIdx, { x: v })} onCommit={(v) => updateShadow(selectedIdx, { x: v })} />
                <FieldBox label="Y" value={sel.y}
                  onPreview={(v) => updateShadow(selectedIdx, { y: v })} onCommit={(v) => updateShadow(selectedIdx, { y: v })} />
                <FieldBox label="Blur" value={sel.blur} min={0}
                  onPreview={(v) => updateShadow(selectedIdx, { blur: v })} onCommit={(v) => updateShadow(selectedIdx, { blur: v })} />
                <FieldBox label="Spread" value={sel.spread ?? 0}
                  onPreview={(v) => updateShadow(selectedIdx, { spread: v })} onCommit={(v) => updateShadow(selectedIdx, { spread: v })} />
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Filters section ───────────────────────────────────────────────────────

type FilterSliderProps = {
  label: string;
  value: number;
  defaultVal: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onPreview: (v: number) => void;
  onCommit: (v: number) => void;
};

function FilterSlider({ label, value, defaultVal, min, max, step = 1, unit = '', onPreview, onCommit }: FilterSliderProps) {
  const isDefault = value === defaultVal;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ ...labelSt, width: 70, flexShrink: 0 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onPreview(parseFloat(e.target.value))}
        onMouseUp={(e) => onCommit(parseFloat((e.target as HTMLInputElement).value))}
        style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <span style={{ ...labelSt, width: 38, textAlign: 'right', fontFamily: 'monospace', color: isDefault ? 'var(--subtle)' : 'var(--text)' }}>
        {value}{unit}
      </span>
      {!isDefault && (
        <button
          title="Reset"
          onClick={() => { onPreview(defaultVal); onCommit(defaultVal); }}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2, borderRadius: 3, fontSize: 11 }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
        >↺</button>
      )}
    </div>
  );
}

// ── Color contrast checker ─────────────────────────────────────────────────

function hexToLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return 0.5; // unknown → neutral
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(fg: string, bg: string): number {
  const l1 = hexToLuminance(fg);
  const l2 = hexToLuminance(bg);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

function ContrastBadge({ textColor, bgColor }: { textColor: string; bgColor: string }) {
  if (!/^#[0-9a-fA-F]{6}$/.test(textColor)) return null;
  const bg = /^#[0-9a-fA-F]{6}$/.test(bgColor) ? bgColor : '#ffffff';
  const cr = getContrastRatio(textColor, bg);
  const wcagAA = cr >= 4.5;
  const wcagAAA = cr >= 7;
  const level = wcagAAA ? 'AAA' : wcagAA ? 'AA' : 'Fail';
  const color = wcagAAA ? '#22c55e' : wcagAA ? '#f59e0b' : '#ef4444';
  const bgAlpha = wcagAAA ? 'rgba(34,197,94,0.1)' : wcagAA ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
  const borderAlpha = wcagAAA ? 'rgba(34,197,94,0.3)' : wcagAA ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
      {/* Mini preview */}
      <div style={{
        width: 28, height: 16, borderRadius: 3, background: bg,
        border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 8, fontWeight: 900, color: textColor, lineHeight: 1 }}>Aa</span>
      </div>
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>
        {cr.toFixed(1)}:1
      </span>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
        color, background: bgAlpha, border: `1px solid ${borderAlpha}`,
        borderRadius: 3, padding: '1px 5px', flexShrink: 0,
      }}>
        WCAG {level}
      </div>
      {!wcagAA && (
        <span style={{ fontSize: 9, color: '#ef4444', opacity: 0.8 }}>
          needs ≥ 4.5:1
        </span>
      )}
    </div>
  );
}

// ── Transition / Animation section ────────────────────────────────────────

const EASING_OPTIONS = [
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In/Out' },
  { value: 'linear', label: 'Linear' },
  { value: 'cubic-bezier(0.4,0,0.2,1)', label: 'Material' },
  { value: 'cubic-bezier(0.175,0.885,0.32,1.275)', label: 'Bounce' },
  { value: 'steps(5, end)', label: 'Steps (5)' },
];

const TRANSITION_PROPS = ['all', 'opacity', 'transform', 'background', 'color', 'border', 'box-shadow', 'width', 'height'];

// ── Cubic Bezier visual editor ────────────────────────────────────────────────

function parseCubicBezier(value: string): [number, number, number, number] {
  const m = value.match(/cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (!m) return [0.25, 0.1, 0.25, 1];
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
}

function CubicBezierEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [x1, y1, x2, y2] = parseCubicBezier(value);
  const SIZE = 110;
  const PAD = 14;
  const INNER = SIZE - PAD * 2;

  // Convert bezier coords (0–1 range) to SVG space
  const toSvg = (bx: number, by: number) => ({
    x: PAD + bx * INNER,
    y: PAD + (1 - by) * INNER, // flip Y (SVG y increases downward)
  });

  const p0 = { x: PAD, y: PAD + INNER };         // (0,0) in bezier
  const p3 = { x: PAD + INNER, y: PAD };          // (1,1) in bezier
  const p1 = toSvg(x1, y1);
  const p2 = toSvg(x2, y2);

  const dragging = useRef<'p1' | 'p2' | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getBezierCoords = (clientX: number, clientY: number): [number, number] => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const sx = (clientX - rect.left) / rect.width * SIZE;
    const sy = (clientY - rect.top) / rect.height * SIZE;
    const bx = Math.max(0, Math.min(1, (sx - PAD) / INNER));
    const by = Math.max(-0.5, Math.min(1.5, 1 - (sy - PAD) / INNER));
    return [Math.round(bx * 1000) / 1000, Math.round(by * 1000) / 1000];
  };

  const handleMouseDown = (point: 'p1' | 'p2') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = point;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const [bx, by] = getBezierCoords(ev.clientX, ev.clientY);
      if (dragging.current === 'p1') {
        onChange(`cubic-bezier(${bx},${by},${x2},${y2})`);
      } else {
        onChange(`cubic-bezier(${x1},${y1},${bx},${by})`);
      }
    };
    const onUp = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Build bezier curve path for preview using 20 sample points
  const curvePath = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      // Cubic bezier: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
      const mt = 1 - t;
      const bx = mt * mt * mt * 0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * 1;
      const by = mt * mt * mt * 0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * 1;
      const sv = toSvg(bx, by);
      pts.push(`${i === 0 ? 'M' : 'L'}${sv.x.toFixed(1)},${sv.y.toFixed(1)}`);
    }
    return pts.join(' ');
  })();

  return (
    <div style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--subtle)', textTransform: 'uppercase', marginBottom: 6 }}>
        Bezier Curve
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* SVG editor */}
        <svg
          ref={svgRef}
          width={SIZE} height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, cursor: 'crosshair', flexShrink: 0 }}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(t => {
            const gx = PAD + t * INNER;
            const gy = PAD + t * INNER;
            return (
              <g key={t}>
                <line x1={gx} y1={PAD} x2={gx} y2={PAD + INNER} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                <line x1={PAD} y1={gy} x2={PAD + INNER} y2={gy} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              </g>
            );
          })}
          {/* Border */}
          <rect x={PAD} y={PAD} width={INNER} height={INNER} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          {/* Diagonal reference */}
          <line x1={p0.x} y1={p0.y} x2={p3.x} y2={p3.y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          {/* Control lines */}
          <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#f59e0b" strokeWidth="1" opacity="0.6" />
          <line x1={p3.x} y1={p3.y} x2={p2.x} y2={p2.y} stroke="#f59e0b" strokeWidth="1" opacity="0.6" />
          {/* Bezier curve */}
          <path d={curvePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
          {/* Anchor points */}
          <circle cx={p0.x} cy={p0.y} r="3" fill="#6366f1" />
          <circle cx={p3.x} cy={p3.y} r="3" fill="#6366f1" />
          {/* Control handles */}
          <circle
            cx={p1.x} cy={p1.y} r="5"
            fill="#f59e0b" stroke="#fff" strokeWidth="1.5"
            style={{ cursor: 'grab' }}
            onMouseDown={handleMouseDown('p1')}
          />
          <circle
            cx={p2.x} cy={p2.y} r="5"
            fill="#f59e0b" stroke="#fff" strokeWidth="1.5"
            style={{ cursor: 'grab' }}
            onMouseDown={handleMouseDown('p2')}
          />
        </svg>

        {/* Values */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'x1', val: x1, update: (v: number) => onChange(`cubic-bezier(${v},${y1},${x2},${y2})`) },
            { label: 'y1', val: y1, update: (v: number) => onChange(`cubic-bezier(${x1},${v},${x2},${y2})`) },
            { label: 'x2', val: x2, update: (v: number) => onChange(`cubic-bezier(${x1},${y1},${v},${y2})`) },
            { label: 'y2', val: y2, update: (v: number) => onChange(`cubic-bezier(${x1},${y1},${x2},${v})`) },
          ].map(({ label, val, update }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--subtle)', width: 12, fontFamily: 'monospace' }}>{label}</span>
              <input
                type="number"
                min={label.startsWith('x') ? 0 : -0.5}
                max={label.startsWith('x') ? 1 : 1.5}
                step={0.01}
                value={val}
                onChange={e => update(Math.round(parseFloat(e.target.value) * 1000) / 1000)}
                style={{
                  flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
                  borderRadius: 4, color: 'var(--text)', fontSize: 10, fontFamily: 'monospace',
                  padding: '2px 4px', outline: 'none',
                }}
              />
            </div>
          ))}
          {/* Presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
            {[
              { label: 'ease', v: '0.25,0.1,0.25,1' },
              { label: '⟩', v: '0.4,0,1,1' },
              { label: '⟨', v: '0,0,0.2,1' },
              { label: '↗', v: '0.4,0,0.2,1' },
            ].map(p => (
              <button
                key={p.label}
                onClick={() => onChange(`cubic-bezier(${p.v})`)}
                style={{
                  fontSize: 9, padding: '2px 5px', borderRadius: 4,
                  border: '1px solid var(--border)', background: 'var(--panel)',
                  color: 'var(--muted)', cursor: 'pointer',
                }}
                title={`cubic-bezier(${p.v})`}
              >{p.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CSS Animation presets section ─────────────────────────────────────────

const CSS_ANIMATION_PRESETS: { id: string; label: string; animation: string; keyframes: string }[] = [
  {
    id: 'fadeIn',
    label: 'Fade In',
    animation: 'fadeIn 0.4s ease both',
    keyframes: '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
  },
  {
    id: 'fadeInUp',
    label: 'Fade Up',
    animation: 'fadeInUp 0.5s ease both',
    keyframes: '@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }',
  },
  {
    id: 'fadeInDown',
    label: 'Fade Down',
    animation: 'fadeInDown 0.5s ease both',
    keyframes: '@keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }',
  },
  {
    id: 'fadeInLeft',
    label: 'Fade Left',
    animation: 'fadeInLeft 0.5s ease both',
    keyframes: '@keyframes fadeInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }',
  },
  {
    id: 'fadeInRight',
    label: 'Fade Right',
    animation: 'fadeInRight 0.5s ease both',
    keyframes: '@keyframes fadeInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }',
  },
  {
    id: 'scaleIn',
    label: 'Scale In',
    animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
    keyframes: '@keyframes scaleIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }',
  },
  {
    id: 'bounce',
    label: 'Bounce',
    animation: 'bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
    keyframes: '@keyframes bounceIn { 0% { opacity: 0; transform: scale(0.3); } 50% { transform: scale(1.05); } 70% { transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }',
  },
  {
    id: 'shake',
    label: 'Shake',
    animation: 'shake 0.5s ease both',
    keyframes: '@keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-10px); } 40% { transform: translateX(10px); } 60% { transform: translateX(-8px); } 80% { transform: translateX(8px); } }',
  },
  {
    id: 'pulse',
    label: 'Pulse',
    animation: 'pulseAnim 1s ease-in-out infinite',
    keyframes: '@keyframes pulseAnim { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }',
  },
  {
    id: 'spin',
    label: 'Spin',
    animation: 'spinAnim 1s linear infinite',
    keyframes: '@keyframes spinAnim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
  },
  {
    id: 'slideInLeft',
    label: 'Slide Left',
    animation: 'slideInLeft 0.4s cubic-bezier(0.25,0.46,0.45,0.94) both',
    keyframes: '@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }',
  },
  {
    id: 'slideInUp',
    label: 'Slide Up',
    animation: 'slideInUp 0.4s cubic-bezier(0.25,0.46,0.45,0.94) both',
    keyframes: '@keyframes slideInUp { from { transform: translateY(100%); } to { transform: translateY(0); } }',
  },
  {
    id: 'popIn',
    label: 'Pop In',
    animation: 'popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both',
    keyframes: '@keyframes popIn { 0% { opacity: 0; transform: scale(0.6); } 100% { opacity: 1; transform: scale(1); } }',
  },
  {
    id: 'flipInX',
    label: 'Flip X',
    animation: 'flipInX 0.5s ease both',
    keyframes: '@keyframes flipInX { 0% { opacity: 0; transform: perspective(400px) rotateX(90deg); } 100% { opacity: 1; transform: perspective(400px) rotateX(0deg); } }',
  },
  {
    id: 'flipInY',
    label: 'Flip Y',
    animation: 'flipInY 0.5s ease both',
    keyframes: '@keyframes flipInY { 0% { opacity: 0; transform: perspective(400px) rotateY(90deg); } 100% { opacity: 1; transform: perspective(400px) rotateY(0deg); } }',
  },
  {
    id: 'glowPulse',
    label: 'Glow',
    animation: 'glowPulse 1.5s ease-in-out infinite',
    keyframes: '@keyframes glowPulse { 0%,100% { box-shadow: 0 0 5px rgba(99,102,241,0.4); } 50% { box-shadow: 0 0 20px rgba(99,102,241,0.9), 0 0 40px rgba(99,102,241,0.4); } }',
  },
  {
    id: 'rubberBand',
    label: 'Rubber',
    animation: 'rubberBand 0.7s ease both',
    keyframes: '@keyframes rubberBand { 0% { transform: scale(1); } 30% { transform: scaleX(1.25) scaleY(0.75); } 50% { transform: scaleX(0.85) scaleY(1.15); } 70% { transform: scaleX(1.05) scaleY(0.95); } 100% { transform: scale(1); } }',
  },
  {
    id: 'typewriter',
    label: 'Typewriter',
    animation: 'typewriterReveal 0.5s steps(10) both',
    keyframes: '@keyframes typewriterReveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0% 0 0); } }',
  },
  {
    id: 'morphBlob',
    label: 'Blob',
    animation: 'morphBlob 3s ease-in-out infinite',
    keyframes: '@keyframes morphBlob { 0%,100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; } 50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; } }',
  },
];

function CssAnimationSection({ shape, onChange }: {
  shape: Shape;
  onChange: (p: Partial<Shape>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [customDuration, setCustomDuration] = useState(400);
  const currentPreset = CSS_ANIMATION_PRESETS.find(p => shape.cssAnimation?.includes(p.id.replace('Anim', '')) || (p.id === 'spin' && shape.cssAnimation?.includes('spinAnim')) || (p.id === 'pulse' && shape.cssAnimation?.includes('pulseAnim')));
  const hasAnimation = !!shape.cssAnimation;

  const applyAnimation = (preset: typeof CSS_ANIMATION_PRESETS[0]) => {
    // Inject keyframes into document if not already there
    const styleId = `quill-anim-${preset.id}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = preset.keyframes;
      document.head.appendChild(style);
    }
    onChange({ cssAnimation: preset.animation });
  };

  const triggerPreview = (preset: typeof CSS_ANIMATION_PRESETS[0]) => {
    setPreviewId(preset.id);
    // Inject keyframes
    const styleId = `quill-anim-${preset.id}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = preset.keyframes;
      document.head.appendChild(style);
    }
    setTimeout(() => setPreviewId(null), 800);
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px 8px', color: 'var(--text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7" cy="7" r="5.5"/>
            <path d="M5 5l2.5 2.5L10 4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Animation
          </span>
          {hasAnimation && !expanded && (
            <span style={{
              fontSize: 9, background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
              borderRadius: 3, padding: '1px 4px', fontWeight: 600,
            }}>
              {currentPreset?.label ?? 'custom'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasAnimation && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange({ cssAnimation: undefined }); }}
              title="Remove animation"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--error, #ef4444)', fontSize: 10, padding: '2px 4px', borderRadius: 3,
              }}
            >
              ✕
            </button>
          )}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--muted)" strokeWidth="1.5">
            <path d={expanded ? 'M2 7L5 4L8 7' : 'M2 3L5 6L8 3'} />
          </svg>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Preset grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {CSS_ANIMATION_PRESETS.map(preset => {
              const isActive = shape.cssAnimation?.includes(preset.animation.split(' ')[0]) ?? false;
              const isPreviewing = previewId === preset.id;
              return (
                <div key={preset.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    onClick={() => applyAnimation(preset)}
                    onMouseEnter={() => triggerPreview(preset)}
                    title={`Apply "${preset.label}" animation`}
                    style={{
                      height: 28, borderRadius: 6,
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      background: isActive ? 'rgba(99,102,241,0.12)' : 'var(--input-bg)',
                      color: isActive ? 'var(--accent)' : 'var(--muted)',
                      cursor: 'pointer', fontSize: 10, fontWeight: isActive ? 600 : 400,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.1s',
                      // Preview animation on hover
                      animation: isPreviewing ? preset.animation : 'none',
                    }}
                    onMouseLeave={() => {}}
                  >
                    {preset.label}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Current animation display */}
          {hasAnimation && (
            <div style={{
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '6px 8px',
              fontSize: 10, fontFamily: 'monospace', color: 'var(--muted)',
              wordBreak: 'break-all',
            }}>
              animation: {shape.cssAnimation}
            </div>
          )}

          {/* Duration quick-set */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--subtle)', width: 56 }}>Duration</span>
            <input
              type="range" min={100} max={2000} step={50}
              value={customDuration}
              onChange={e => setCustomDuration(parseInt(e.target.value))}
              onMouseUp={() => {
                if (shape.cssAnimation) {
                  // Replace duration in the animation string
                  const updated = shape.cssAnimation.replace(/[\d.]+s\b/, `${(customDuration / 1000).toFixed(2)}s`);
                  onChange({ cssAnimation: updated });
                }
              }}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 10, color: 'var(--text)', fontFamily: 'monospace', width: 36, textAlign: 'right' }}>
              {customDuration}ms
            </span>
          </div>

          <div style={{ fontSize: 9.5, color: 'var(--subtle)', lineHeight: 1.5 }}>
            Hover a preset to preview · Animation is included in CSS export
          </div>
        </div>
      )}
    </div>
  );
}

function TransitionSection({ shape, onChange }: {
  shape: Shape;
  onChange: (patch: Partial<Shape>) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasTransition = !!(shape.transitionDuration && shape.transitionDuration > 0);
  const [previewing, setPreviewing] = useState(false);

  const selectedProps = shape.transitionProperties ?? ['all'];
  const toggleProp = (prop: string) => {
    if (prop === 'all') {
      onChange({ transitionProperties: ['all'] });
      return;
    }
    const cur = selectedProps.filter(p => p !== 'all');
    const next = cur.includes(prop) ? cur.filter(p => p !== prop) : [...cur, prop];
    onChange({ transitionProperties: next.length === 0 ? ['all'] : next });
  };

  return (
    <PanelSection label="Transition" collapsible collapsed={!open} onToggle={() => setOpen(o => !o)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Enable/disable row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelSt}>Enable</span>
            <button
              onClick={() => onChange({ transitionDuration: hasTransition ? 0 : 300 })}
              style={{
                width: 32, height: 18, borderRadius: 9, padding: 0, border: 'none',
                background: hasTransition ? 'var(--accent)' : 'var(--border)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
                background: '#fff', transition: 'left 0.15s',
                left: hasTransition ? 16 : 2,
              }} />
            </button>
          </div>

          {hasTransition && (
            <>
              {/* Duration */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelSt, flexShrink: 0 }}>Duration</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <input
                    type="range"
                    min={0} max={2000} step={50}
                    value={shape.transitionDuration ?? 300}
                    onChange={(e) => onChange({ transitionDuration: parseInt(e.target.value) })}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace', minWidth: 36, textAlign: 'right' }}>
                    {shape.transitionDuration ?? 300}ms
                  </span>
                </div>
              </div>

              {/* Easing */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelSt, flexShrink: 0 }}>Easing</span>
                <select
                  value={EASING_OPTIONS.some(o => o.value === (shape.transitionEasing ?? 'ease')) ? (shape.transitionEasing ?? 'ease') : 'custom'}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      onChange({ transitionEasing: 'cubic-bezier(0.25,0.1,0.25,1)' });
                    } else {
                      onChange({ transitionEasing: e.target.value });
                    }
                  }}
                  style={{
                    flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
                    borderRadius: 5, color: 'var(--text)', fontSize: 11, padding: '3px 6px',
                    outline: 'none',
                  }}
                >
                  {EASING_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                  <option value="custom">Custom bezier…</option>
                </select>
              </div>

              {/* Cubic bezier editor — shown when easing is custom or a cubic-bezier() value */}
              {(shape.transitionEasing ?? '').startsWith('cubic-bezier') && (
                <CubicBezierEditor
                  value={shape.transitionEasing ?? 'cubic-bezier(0.25,0.1,0.25,1)'}
                  onChange={(v) => onChange({ transitionEasing: v })}
                />
              )}

              {/* Properties */}
              <div>
                <div style={{ ...labelSt, marginBottom: 5 }}>Properties</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {TRANSITION_PROPS.map(prop => {
                    const active = selectedProps.includes(prop) || (prop !== 'all' && selectedProps.includes('all') && prop === 'all');
                    const isSelected = selectedProps.includes(prop);
                    return (
                      <button
                        key={prop}
                        onClick={() => toggleProp(prop)}
                        style={{
                          padding: '2px 7px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSelected ? 'rgba(99,102,241,0.12)' : 'var(--input-bg)',
                          color: isSelected ? 'var(--accent)' : 'var(--muted)',
                          fontFamily: 'monospace', transition: 'all 0.1s',
                        }}
                      >
                        {prop}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview strip */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--subtle)', textTransform: 'uppercase' }}>Preview</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 6,
                      background: previewing ? shape.fill || 'var(--accent)' : 'var(--panel-alt)',
                      border: '1px solid var(--border)',
                      opacity: previewing ? (shape.opacity ?? 1) : 0.3,
                      transform: previewing ? 'scale(1)' : 'scale(0.7)',
                      transition: `all ${shape.transitionDuration ?? 300}ms ${shape.transitionEasing ?? 'ease'}`,
                      flexShrink: 0,
                    }}
                  />
                  <button
                    onClick={() => { setPreviewing(true); setTimeout(() => setPreviewing(false), (shape.transitionDuration ?? 300) * 2 + 100); }}
                    style={{
                      background: 'var(--accent)', border: 'none', borderRadius: 5,
                      color: '#fff', cursor: 'pointer', padding: '4px 10px', fontSize: 10, fontWeight: 600,
                    }}
                  >
                    ▶ Play
                  </button>
                  <span style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'monospace' }}>
                    {shape.transitionDuration}ms {EASING_OPTIONS.find(o => o.value === (shape.transitionEasing ?? 'ease'))?.label ?? 'Ease'}
                  </span>
                </div>
                {/* CSS output */}
                <div style={{
                  fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)',
                  background: 'var(--panel-alt)', border: '1px solid var(--border)',
                  borderRadius: 5, padding: '5px 8px',
                  userSelect: 'all',
                }}>
                  transition: {(shape.transitionProperties ?? ['all']).join(', ')} {shape.transitionDuration}ms {shape.transitionEasing ?? 'ease'};
                </div>
              </div>
            </>
          )}
        </div>
    </PanelSection>
  );
}

// ── Notes / Annotations section ────────────────────────────────────────────

function NotesSection({ shape, onChange }: {
  shape: Shape;
  onChange: (patch: Partial<Shape>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState(shape.notes ?? '');
  const hasNotes = !!(shape.notes && shape.notes.trim().length > 0);

  // Sync if shape changes (different shape selected)
  useEffect(() => { setLocalNotes(shape.notes ?? ''); }, [shape.id, shape.notes]);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px 8px', color: 'var(--text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1" y="1" width="12" height="12" rx="2"/>
            <line x1="4" y1="5" x2="10" y2="5"/>
            <line x1="4" y1="7.5" x2="10" y2="7.5"/>
            <line x1="4" y1="10" x2="7" y2="10"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Notes
          </span>
          {hasNotes && !expanded && (
            <span style={{
              fontSize: 9, background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
              borderRadius: 3, padding: '1px 4px', fontWeight: 600,
            }}>
              {localNotes.length}c
            </span>
          )}
        </div>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--muted)" strokeWidth="1.5">
          <path d={expanded ? 'M2 7L5 4L8 7' : 'M2 3L5 6L8 3'} />
        </svg>
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          <textarea
            value={localNotes}
            placeholder="Add design notes, specs, or handoff instructions…"
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={() => onChange({ notes: localNotes })}
            onKeyDown={(e) => {
              e.stopPropagation(); // Don't let keys trigger canvas shortcuts
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                onChange({ notes: localNotes });
              }
            }}
            style={{
              width: '100%', minHeight: 72, maxHeight: 180,
              background: 'var(--input-bg)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text)', fontSize: 11,
              fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical',
              padding: '8px 10px', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; onChange({ notes: localNotes }); }}
          />
          <div style={{ fontSize: 10, color: 'var(--subtle)', marginTop: 4, textAlign: 'right' }}>
            {localNotes.length} chars · included in CSS export
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shape Tags ─────────────────────────────────────────────────────────────

const SUGGESTED_TAGS = ['hero', 'cta', 'card', 'nav', 'footer', 'mobile', 'desktop', 'placeholder', 'icon', 'background', 'overlay', 'modal', 'button', 'input', 'label'];

function TagsSection({ shape, onChange }: {
  shape: Shape;
  onChange: (patch: Partial<Shape>) => void;
}) {
  const tags = shape.tags ?? [];
  const [inputVal, setInputVal] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!clean || tags.includes(clean)) return;
    onChange({ tags: [...tags, clean] });
    setInputVal('');
  };

  const removeTag = (tag: string) => {
    onChange({ tags: tags.filter(t => t !== tag) });
  };

  const suggestions = SUGGESTED_TAGS.filter(t => !tags.includes(t) && (inputVal === '' || t.startsWith(inputVal.toLowerCase())));

  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 12px 10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round">
          <path d="M1 8L6 13L13 6L8 1L2 1L1 2L1 8Z"/>
          <circle cx="4.5" cy="4.5" r="1" fill="var(--muted)" stroke="none"/>
        </svg>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Tags
        </span>
        {tags.length > 0 && (
          <span style={{ fontSize: 9, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', borderRadius: 3, padding: '1px 4px', fontWeight: 600 }}>
            {tags.length}
          </span>
        )}
      </div>

      {/* Tag chips */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {tags.map(tag => (
            <div
              key={tag}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 4, padding: '2px 6px',
                fontSize: 10, color: 'var(--accent)',
              }}
            >
              <span>#{tag}</span>
              <button
                onClick={() => removeTag(tag)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(99,102,241,0.6)', padding: 0, fontSize: 10, lineHeight: 1, display: 'flex' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Enter' && inputVal.trim()) { addTag(inputVal); }
            if (e.key === 'Backspace' && !inputVal && tags.length > 0) { removeTag(tags[tags.length - 1]); }
            if (e.key === 'Escape') { setInputVal(''); setShowSuggestions(false); }
          }}
          placeholder="Add tag (press Enter)…"
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5,
            color: 'var(--text)', fontSize: 11, padding: '4px 8px', outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlurCapture={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 3,
            background: 'var(--panel-alt)', border: '1px solid var(--border)',
            borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 100, maxHeight: 120, overflowY: 'auto',
          }}>
            {suggestions.slice(0, 8).map(t => (
              <button
                key={t}
                onMouseDown={(e) => { e.preventDefault(); addTag(t); }}
                style={{
                  display: 'block', width: '100%', padding: '4px 8px', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--muted)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Constraints ───────────────────────────────────────────────────────────────

type ConstraintH = 'left' | 'right' | 'center' | 'left-right' | 'scale';
type ConstraintV = 'top' | 'bottom' | 'center' | 'top-bottom' | 'scale';

interface ConstraintOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

const H_OPTIONS: ConstraintOption<ConstraintH>[] = [
  { value: 'left', label: '⟵', description: 'Pin to left edge' },
  { value: 'right', label: '⟶', description: 'Pin to right edge' },
  { value: 'center', label: '↔', description: 'Center horizontally' },
  { value: 'left-right', label: '⟷', description: 'Stretch: pin both edges' },
  { value: 'scale', label: '⤢', description: 'Scale proportionally' },
];

const V_OPTIONS: ConstraintOption<ConstraintV>[] = [
  { value: 'top', label: '⟰', description: 'Pin to top edge' },
  { value: 'bottom', label: '⟱', description: 'Pin to bottom edge' },
  { value: 'center', label: '↕', description: 'Center vertically' },
  { value: 'top-bottom', label: '⥉', description: 'Stretch: pin both edges' },
  { value: 'scale', label: '⤢', description: 'Scale proportionally' },
];

function ConstraintToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ConstraintOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 2, flex: 1 }}>
        {options.map(opt => (
          <button
            key={opt.value}
            title={opt.description}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '4px 2px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
              border: 'none',
              background: value === opt.value ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
              color: value === opt.value ? 'var(--accent)' : 'var(--muted)',
              fontWeight: value === opt.value ? 700 : 400,
              outline: value === opt.value ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConstraintsSection({ shape, onChange }: {
  shape: Shape;
  onChange: (patch: Partial<Shape>) => void;
}) {
  const constraintH = (shape.constraintH ?? 'left') as ConstraintH;
  const constraintV = (shape.constraintV ?? 'top') as ConstraintV;

  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 12px 10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round">
          <rect x="1" y="1" width="12" height="12" rx="2"/>
          <line x1="4" y1="7" x2="10" y2="7"/>
          <line x1="7" y1="4" x2="7" y2="10"/>
        </svg>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Constraints
        </span>
        <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 'auto', opacity: 0.6 }}>
          in parent frame
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ConstraintToggle
          label="H"
          options={H_OPTIONS}
          value={constraintH}
          onChange={(v) => onChange({ constraintH: v })}
        />
        <ConstraintToggle
          label="V"
          options={V_OPTIONS}
          value={constraintV}
          onChange={(v) => onChange({ constraintV: v })}
        />
      </div>

      {/* Description of current combo */}
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)', lineHeight: 1.4, opacity: 0.8 }}>
        {H_OPTIONS.find(o => o.value === constraintH)?.description} ·{' '}
        {V_OPTIONS.find(o => o.value === constraintV)?.description}
      </div>
    </div>
  );
}

// ── Shape Variants ─────────────────────────────────────────────────────────────
const PRESET_VARIANTS = ['Hover', 'Pressed', 'Disabled', 'Focus', 'Active', 'Loading'];

function VariantsSection({ shape, onChange }: {
  shape: Shape;
  onChange: (patch: Partial<Shape>) => void;
}) {
  const variants = shape.variants ?? {};
  const activeVariant = shape.activeVariant ?? 'Default';
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // Capture current visual properties as a variant snapshot
  const captureCurrentAsVariant = (name: string): ShapeVariant => ({
    label: name,
    fill: shape.fill,
    fillOpacity: shape.fillOpacity,
    fillType: shape.fillType,
    gradientStops: shape.gradientStops,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    opacity: shape.opacity,
    shadow: shape.shadow,
    shadowX: shape.shadowX,
    shadowY: shape.shadowY,
    shadowBlur: shape.shadowBlur,
    shadowColor: shape.shadowColor,
    shadows: shape.shadows,
    filterBlur: shape.filterBlur,
    filterBrightness: shape.filterBrightness,
    filterBackdropBlur: shape.filterBackdropBlur,
    color: shape.color,
    fontSize: shape.fontSize,
    fontWeight: shape.fontWeight,
    borderRadius: shape.borderRadius,
    blendMode: shape.blendMode,
  });

  // Apply a variant's properties onto the shape
  const applyVariant = (name: string) => {
    if (name === 'Default') {
      // Revert to the Default variant if stored, otherwise just switch label
      const def = variants['Default'];
      if (def) {
        onChange({ activeVariant: 'Default', ...def });
      } else {
        onChange({ activeVariant: 'Default' });
      }
      return;
    }
    const v = variants[name];
    if (!v) return;
    // Apply all stored properties from the variant
    const patch: Partial<Shape> = { activeVariant: name };
    if (v.fill !== undefined) patch.fill = v.fill;
    if (v.fillOpacity !== undefined) patch.fillOpacity = v.fillOpacity;
    if (v.fillType !== undefined) patch.fillType = v.fillType;
    if (v.gradientStops !== undefined) patch.gradientStops = v.gradientStops;
    if (v.stroke !== undefined) patch.stroke = v.stroke;
    if (v.strokeWidth !== undefined) patch.strokeWidth = v.strokeWidth;
    if (v.opacity !== undefined) patch.opacity = v.opacity;
    if (v.shadow !== undefined) patch.shadow = v.shadow;
    if (v.shadowX !== undefined) patch.shadowX = v.shadowX;
    if (v.shadowY !== undefined) patch.shadowY = v.shadowY;
    if (v.shadowBlur !== undefined) patch.shadowBlur = v.shadowBlur;
    if (v.shadowColor !== undefined) patch.shadowColor = v.shadowColor;
    if (v.shadows !== undefined) patch.shadows = v.shadows;
    if (v.filterBlur !== undefined) patch.filterBlur = v.filterBlur;
    if (v.filterBrightness !== undefined) patch.filterBrightness = v.filterBrightness;
    if (v.filterBackdropBlur !== undefined) patch.filterBackdropBlur = v.filterBackdropBlur;
    if (v.color !== undefined) patch.color = v.color;
    if (v.fontSize !== undefined) patch.fontSize = v.fontSize;
    if (v.fontWeight !== undefined) patch.fontWeight = v.fontWeight;
    if (v.borderRadius !== undefined) patch.borderRadius = v.borderRadius;
    if (v.blendMode !== undefined) patch.blendMode = v.blendMode;
    onChange(patch);
  };

  const addVariant = (name: string) => {
    const clean = name.trim();
    if (!clean || variants[clean]) return;
    // Save current state as Default if no variants yet
    const updated: Record<string, ShapeVariant> = { ...variants };
    if (Object.keys(updated).length === 0) {
      updated['Default'] = captureCurrentAsVariant('Default');
    }
    // Create new variant as a copy of current appearance
    updated[clean] = captureCurrentAsVariant(clean);
    onChange({ variants: updated, activeVariant: clean });
    setNewName('');
    setShowAdd(false);
  };

  const deleteVariant = (name: string) => {
    if (name === 'Default') return;
    const updated = { ...variants };
    delete updated[name];
    // If we deleted the active variant, switch to Default
    const nextActive = activeVariant === name ? 'Default' : activeVariant;
    if (nextActive === 'Default') {
      const def = updated['Default'];
      const patch: Partial<Shape> = { variants: updated, activeVariant: 'Default' };
      if (def) {
        if (def.fill !== undefined) patch.fill = def.fill;
        if (def.opacity !== undefined) patch.opacity = def.opacity;
        // etc — simplified for brevity
      }
      onChange(patch);
    } else {
      onChange({ variants: updated, activeVariant: nextActive });
    }
  };

  // Save current visual state into the active variant
  const saveCurrentToVariant = () => {
    const updated = { ...variants };
    updated[activeVariant] = captureCurrentAsVariant(activeVariant);
    onChange({ variants: updated });
  };

  const variantNames = ['Default', ...Object.keys(variants).filter(k => k !== 'Default')];

  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 12px 10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round">
          <rect x="1" y="1" width="5" height="5" rx="1"/>
          <rect x="8" y="1" width="5" height="5" rx="1"/>
          <rect x="1" y="8" width="5" height="5" rx="1"/>
          <rect x="8" y="8" width="5" height="5" rx="1" opacity="0.4"/>
        </svg>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Variants
        </span>
        {Object.keys(variants).length > 0 && (
          <span style={{ fontSize: 9, background: 'rgba(168,85,247,0.12)', color: '#a855f7', borderRadius: 3, padding: '1px 4px', fontWeight: 600 }}>
            {Object.keys(variants).length + 1}
          </span>
        )}
      </div>

      {/* Variant pills */}
      {variantNames.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {variantNames.map(name => {
            const isActive = name === activeVariant;
            return (
              <div
                key={name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  background: isActive ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isActive ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 5, padding: '3px 7px',
                  fontSize: 10.5, color: isActive ? '#a855f7' : 'var(--muted)',
                  cursor: 'pointer', userSelect: 'none',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.1s',
                }}
                onClick={() => applyVariant(name)}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              >
                {name}
                {name !== 'Default' && (
                  <button
                    onClick={ev => { ev.stopPropagation(); deleteVariant(name); }}
                    title={`Delete "${name}" variant`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,85,247,0.5)', padding: '0 0 0 2px', fontSize: 9, lineHeight: 1, display: 'flex' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 5 }}>
        {/* Save current to active variant */}
        {variantNames.length > 1 && (
          <button
            onClick={saveCurrentToVariant}
            title={`Save current appearance to "${activeVariant}"`}
            style={{
              flex: 1, padding: '4px 7px', borderRadius: 5, fontSize: 10,
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
              color: '#a855f7', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; }}
          >
            Save to "{activeVariant}"
          </button>
        )}

        {/* Add variant button */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            title="Add a new variant"
            style={{
              flex: variantNames.length > 1 ? 'none' : 1,
              padding: '4px 8px', borderRadius: 5, fontSize: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--muted)', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
          >
            + Add variant
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') addVariant(newName);
                if (e.key === 'Escape') { setShowAdd(false); setNewName(''); }
              }}
              placeholder="Variant name…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(168,85,247,0.4)', borderRadius: 5,
                color: 'var(--text)', fontSize: 11, padding: '3px 7px', outline: 'none',
              }}
              list="variant-presets"
            />
            <datalist id="variant-presets">
              {PRESET_VARIANTS.filter(p => !variants[p]).map(p => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <button
              onClick={() => addVariant(newName)}
              style={{
                padding: '3px 7px', borderRadius: 5, fontSize: 10,
                background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)',
                color: '#a855f7', cursor: 'pointer',
              }}
            >✓</button>
            <button
              onClick={() => { setShowAdd(false); setNewName(''); }}
              style={{
                padding: '3px 6px', borderRadius: 5, fontSize: 10,
                background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--muted)', cursor: 'pointer',
              }}
            >✕</button>
          </div>
        )}
      </div>

      {/* Preset quick-add chips (shown when no variants yet) */}
      {variantNames.length === 1 && !showAdd && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {PRESET_VARIANTS.map(p => (
            <button
              key={p}
              onClick={() => addVariant(p)}
              style={{
                padding: '2px 7px', borderRadius: 4, fontSize: 10,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--muted)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#a855f7'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FiltersSection({ shape, onPreview, onChange }: {
  shape: Shape;
  onPreview: (p: Partial<Shape>) => void;
  onChange: (p: Partial<Shape>) => void;
}) {
  const blur = shape.filterBlur ?? 0;
  const brightness = shape.filterBrightness ?? 100;
  const contrast = shape.filterContrast ?? 100;
  const saturate = shape.filterSaturate ?? 100;
  const grayscale = shape.filterGrayscale ?? 0;
  const sepia = shape.filterSepia ?? 0;
  const hueRotate = shape.filterHueRotate ?? 0;
  const invert = shape.filterInvert ?? 0;
  const backdropBlur = shape.filterBackdropBlur ?? 0;
  const noiseOpacity = shape.noiseOpacity ?? 0;
  const noiseScale = shape.noiseScale ?? 1;
  const hasFilters = blur > 0 || brightness !== 100 || contrast !== 100 || saturate !== 100 || backdropBlur > 0 || noiseOpacity > 0 || grayscale > 0 || sepia > 0 || hueRotate !== 0 || invert > 0;

  return (
    <CollapsibleSection
      label="Filters"
      onAdd={!hasFilters ? () => { onPreview({ filterBlur: 4 }); onChange({ filterBlur: 4 }); } : undefined}
      onRemove={hasFilters ? () => {
        const reset = { filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100, filterBackdropBlur: 0, noiseOpacity: 0, filterGrayscale: 0, filterSepia: 0, filterHueRotate: 0, filterInvert: 0 };
        onPreview(reset); onChange(reset);
      } : undefined}
    >
      {/* Filter presets */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: hasFilters ? 4 : 0 }}>
        {[
          { label: 'Glass', title: 'Glassmorphism preset', patch: { filterBackdropBlur: 12, fill: '#ffffff', fillOpacity: 0.08, stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 } },
          { label: 'Frosted', title: 'Frosted glass preset', patch: { filterBackdropBlur: 20, fill: '#ffffff', fillOpacity: 0.15, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, borderRadius: 16 } },
          { label: 'Dark Glass', title: 'Dark glassmorphism', patch: { filterBackdropBlur: 16, fill: '#000000', fillOpacity: 0.2, stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 } },
          { label: 'Grain', title: 'Subtle film grain effect', patch: { noiseOpacity: 0.12, noiseScale: 1 } },
          { label: 'Heavy Grain', title: 'Heavy film grain', patch: { noiseOpacity: 0.28, noiseScale: 1.5 } },
          { label: 'Grayscale', title: 'Full grayscale', patch: { filterGrayscale: 100, filterSaturate: 100 } },
          { label: 'Sepia', title: 'Sepia tone', patch: { filterSepia: 80, filterGrayscale: 0 } },
          { label: 'Invert', title: 'Invert colors', patch: { filterInvert: 100 } },
          { label: 'Clear', title: 'Remove all filters', patch: { filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100, filterBackdropBlur: 0, noiseOpacity: 0, filterGrayscale: 0, filterSepia: 0, filterHueRotate: 0, filterInvert: 0 } },
        ].map(({ label, title, patch }) => (
          <button
            key={label}
            onClick={() => { onPreview(patch); onChange(patch); }}
            title={title}
            style={{
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
              borderRadius: 4, color: label === 'Clear' ? 'var(--error)' : 'var(--muted)', cursor: 'pointer',
              fontSize: 9, fontWeight: 600, padding: '3px 7px',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = label === 'Clear' ? 'rgba(239,68,68,0.4)' : 'var(--accent)';
              e.currentTarget.style.color = label === 'Clear' ? 'var(--error)' : 'var(--accent)';
              e.currentTarget.style.background = label === 'Clear' ? 'rgba(239,68,68,0.08)' : 'var(--accent-dim)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = label === 'Clear' ? 'var(--error)' : 'var(--muted)';
              e.currentTarget.style.background = 'var(--panel-alt)';
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {hasFilters && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <FilterSlider label="Blur" value={blur} defaultVal={0} min={0} max={40} unit="px"
            onPreview={(v) => onPreview({ filterBlur: v })} onCommit={(v) => onChange({ filterBlur: v })} />
          <FilterSlider label="Backdrop" value={backdropBlur} defaultVal={0} min={0} max={60} unit="px"
            onPreview={(v) => onPreview({ filterBackdropBlur: v })} onCommit={(v) => onChange({ filterBackdropBlur: v })} />
          <FilterSlider label="Brightness" value={brightness} defaultVal={100} min={0} max={200} unit="%"
            onPreview={(v) => onPreview({ filterBrightness: v })} onCommit={(v) => onChange({ filterBrightness: v })} />
          <FilterSlider label="Contrast" value={contrast} defaultVal={100} min={0} max={200} unit="%"
            onPreview={(v) => onPreview({ filterContrast: v })} onCommit={(v) => onChange({ filterContrast: v })} />
          <FilterSlider label="Saturate" value={saturate} defaultVal={100} min={0} max={200} unit="%"
            onPreview={(v) => onPreview({ filterSaturate: v })} onCommit={(v) => onChange({ filterSaturate: v })} />
          <FilterSlider label="Grayscale" value={grayscale} defaultVal={0} min={0} max={100} unit="%"
            onPreview={(v) => onPreview({ filterGrayscale: v })} onCommit={(v) => onChange({ filterGrayscale: v })} />
          <FilterSlider label="Sepia" value={sepia} defaultVal={0} min={0} max={100} unit="%"
            onPreview={(v) => onPreview({ filterSepia: v })} onCommit={(v) => onChange({ filterSepia: v })} />
          <FilterSlider label="Hue Shift" value={hueRotate} defaultVal={0} min={0} max={360} unit="°"
            onPreview={(v) => onPreview({ filterHueRotate: v })} onCommit={(v) => onChange({ filterHueRotate: v })} />
          <FilterSlider label="Invert" value={invert} defaultVal={0} min={0} max={100} unit="%"
            onPreview={(v) => onPreview({ filterInvert: v })} onCommit={(v) => onChange({ filterInvert: v })} />
          {/* Noise / grain */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...labelSt, letterSpacing: '0.03em' }}>Noise / Grain</span>
              {noiseOpacity > 0 && (
                <button
                  onClick={() => { onPreview({ noiseOpacity: 0 }); onChange({ noiseOpacity: 0 }); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--error)', padding: 0 }}
                  title="Remove noise"
                >Remove</button>
              )}
            </div>
            <FilterSlider label="Intensity" value={Math.round(noiseOpacity * 100)} defaultVal={0} min={0} max={100} unit="%"
              onPreview={(v) => onPreview({ noiseOpacity: v / 100 })} onCommit={(v) => onChange({ noiseOpacity: v / 100 })} />
            {noiseOpacity > 0 && (
              <FilterSlider label="Scale" value={Math.round(noiseScale * 10)} defaultVal={10} min={5} max={40} step={1}
                onPreview={(v) => onPreview({ noiseScale: v / 10 })} onCommit={(v) => onChange({ noiseScale: v / 10 })} />
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Transform Section ─────────────────────────────────────────────────────

// ── Transform drag pad ────────────────────────────────────────────────────────
function TransformDragPad({ skewX, skewY, onPreview, onChange }: {
  skewX: number;
  skewY: number;
  onPreview: (p: Partial<Shape>) => void;
  onChange: (p: Partial<Shape>) => void;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const PAD = 80; // pad size in px
  const MAX_SKEW = 30; // degrees max

  // Map skew to pad position (center = 0,0)
  const dotX = Math.round(PAD / 2 + (skewX / MAX_SKEW) * (PAD / 2 - 8));
  const dotY = Math.round(PAD / 2 - (skewY / MAX_SKEW) * (PAD / 2 - 8));

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    update(e.clientX, e.clientY, false);

    const onMove = (ev: MouseEvent) => {
      if (dragging.current) update(ev.clientX, ev.clientY, false);
    };
    const onUp = (ev: MouseEvent) => {
      if (dragging.current) { dragging.current = false; update(ev.clientX, ev.clientY, true); }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const update = (cx: number, cy: number, commit: boolean) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rx = (cx - rect.left - PAD / 2) / (PAD / 2 - 8);
    const ry = -(cy - rect.top - PAD / 2) / (PAD / 2 - 8);
    const sx = Math.round(Math.max(-1, Math.min(1, rx)) * MAX_SKEW);
    const sy = Math.round(Math.max(-1, Math.min(1, ry)) * MAX_SKEW);
    const patch = { skewX: sx, skewY: sy };
    if (commit) onChange(patch); else onPreview(patch);
  };

  return (
    <div
      ref={padRef}
      onMouseDown={handleMouseDown}
      title="Drag to skew X/Y. Click center to reset."
      onClick={(e) => {
        const el = padRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const dx = e.clientX - rect.left - PAD / 2;
        const dy = e.clientY - rect.top - PAD / 2;
        if (Math.sqrt(dx * dx + dy * dy) < 10) {
          const p = { skewX: 0, skewY: 0 };
          onPreview(p); onChange(p);
        }
      }}
      style={{
        width: PAD, height: PAD, borderRadius: 8, flexShrink: 0,
        background: 'var(--input-bg)', border: '1px solid var(--border)',
        cursor: 'crosshair', position: 'relative', userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Grid lines */}
      <svg width={PAD} height={PAD} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Crosshair */}
        <line x1={PAD/2} y1={4} x2={PAD/2} y2={PAD-4} stroke="var(--border)" strokeWidth="1"/>
        <line x1={4} y1={PAD/2} x2={PAD-4} y2={PAD/2} stroke="var(--border)" strokeWidth="1"/>
        {/* Quadrant ticks */}
        <circle cx={PAD/2} cy={PAD/2} r={PAD/2 - 8} fill="none" stroke="var(--border)" strokeWidth="0.8" strokeDasharray="2 3" />
        {/* Dot */}
        <circle cx={dotX} cy={dotY} r={5} fill="var(--accent)" />
        <circle cx={dotX} cy={dotY} r={3} fill="white" />
        {/* Center crosshair dot */}
        <circle cx={PAD/2} cy={PAD/2} r={2} fill="var(--border)" />
      </svg>
      {/* Labels */}
      <span style={{ position: 'absolute', bottom: 2, right: 4, fontSize: 7.5, color: 'var(--muted)', fontFamily: 'monospace', pointerEvents: 'none' }}>
        X:{skewX}° Y:{skewY}°
      </span>
    </div>
  );
}

function TransformSection({ shape, onPreview, onChange }: {
  shape: Shape;
  onPreview: (p: Partial<Shape>) => void;
  onChange: (p: Partial<Shape>) => void;
}) {
  const skewX = shape.skewX ?? 0;
  const skewY = shape.skewY ?? 0;
  const perspectiveTilt = shape.perspectiveTilt ?? 0;
  const perspectiveTiltAxis = shape.perspectiveTiltAxis ?? 'y';
  const hasTransform = skewX !== 0 || skewY !== 0 || perspectiveTilt !== 0;

  const clearAll = () => {
    const reset = { skewX: 0, skewY: 0, perspectiveTilt: 0 };
    onPreview(reset); onChange(reset);
  };

  return (
    <CollapsibleSection
      label="Transform"
      onAdd={!hasTransform ? () => { onPreview({ skewX: 10 }); onChange({ skewX: 10 }); } : undefined}
      onRemove={hasTransform ? clearAll : undefined}
    >
      {/* ── Skew drag pad ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
        <TransformDragPad skewX={skewX} skewY={skewY} onPreview={onPreview} onChange={onChange} />
        <div style={{ flex: 1, fontSize: 10, color: 'var(--muted)', lineHeight: 1.6, paddingTop: 4 }}>
          <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 2 }}>Skew Pad</strong>
          Drag to skew horizontally &amp; vertically. Click center to reset.
          <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
            <button
              onClick={() => { const p = { skewX: 0, skewY: 0 }; onPreview(p); onChange(p); }}
              style={{ fontSize: 9, background: 'var(--panel-alt)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--muted)', cursor: 'pointer' }}
            >Reset</button>
          </div>
        </div>
      </div>
      {/* Presets */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: hasTransform ? 6 : 0 }}>
        {[
          { label: 'Skew L', title: 'Lean left', patch: { skewX: -12, skewY: 0 } },
          { label: 'Skew R', title: 'Lean right', patch: { skewX: 12, skewY: 0 } },
          { label: 'Tilt X', title: '3D tilt on X axis', patch: { perspectiveTilt: 0.5, perspectiveTiltAxis: 'x' as const, skewX: 0, skewY: 0 } },
          { label: 'Tilt Y', title: '3D tilt on Y axis', patch: { perspectiveTilt: 0.5, perspectiveTiltAxis: 'y' as const, skewX: 0, skewY: 0 } },
          { label: 'Tilt XY', title: '3D tilt on both axes', patch: { perspectiveTilt: 0.45, perspectiveTiltAxis: 'xy' as const, skewX: 0, skewY: 0 } },
          { label: 'Clear', title: 'Remove all transforms', patch: { skewX: 0, skewY: 0, perspectiveTilt: 0 } },
        ].map(({ label, title, patch }) => (
          <button
            key={label}
            onClick={() => { onPreview(patch); onChange(patch); }}
            title={title}
            style={{
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
              borderRadius: 4, color: label === 'Clear' ? 'var(--error)' : 'var(--muted)', cursor: 'pointer',
              fontSize: 9, fontWeight: 600, padding: '3px 7px', transition: 'all 0.1s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = label === 'Clear' ? 'rgba(239,68,68,0.4)' : 'var(--accent)';
              e.currentTarget.style.color = label === 'Clear' ? 'var(--error)' : 'var(--accent)';
              e.currentTarget.style.background = label === 'Clear' ? 'rgba(239,68,68,0.08)' : 'var(--accent-dim)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = label === 'Clear' ? 'var(--error)' : 'var(--muted)';
              e.currentTarget.style.background = 'var(--panel-alt)';
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {hasTransform && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <FilterSlider label="Skew X" value={skewX} defaultVal={0} min={-45} max={45} unit="°"
            onPreview={(v) => onPreview({ skewX: v })} onCommit={(v) => onChange({ skewX: v })} />
          <FilterSlider label="Skew Y" value={skewY} defaultVal={0} min={-45} max={45} unit="°"
            onPreview={(v) => onPreview({ skewY: v })} onCommit={(v) => onChange({ skewY: v })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
            <FilterSlider label="Perspective" value={Math.round(perspectiveTilt * 100)} defaultVal={0} min={0} max={100} unit="%"
              onPreview={(v) => onPreview({ perspectiveTilt: v / 100 })} onCommit={(v) => onChange({ perspectiveTilt: v / 100 })} />
            {perspectiveTilt > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={labelSt}>Axis</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {(['x', 'y', 'xy'] as const).map(axis => (
                    <button
                      key={axis}
                      onClick={() => { onPreview({ perspectiveTiltAxis: axis }); onChange({ perspectiveTiltAxis: axis }); }}
                      style={{
                        background: perspectiveTiltAxis === axis ? 'var(--accent)' : 'var(--input-bg)',
                        border: `1px solid ${perspectiveTiltAxis === axis ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 4, color: perspectiveTiltAxis === axis ? '#fff' : 'var(--muted)',
                        cursor: 'pointer', fontSize: 10, fontWeight: 600, padding: '2px 8px',
                      }}
                    >
                      {axis.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Shape Style Presets ────────────────────────────────────────────────────

const STORAGE_KEY = 'quill_style_presets_v1';

interface StylePreset {
  id: string;
  name: string;
  // visual properties only
  fill: string;
  fillOpacity: number;
  fillType: Shape['fillType'];
  gradientStops: GradientStop[];
  gradientAngle: number;
  stroke: string;
  strokeWidth: number;
  strokePosition: Shape['strokePosition'];
  shadows?: ShadowDef[];
  shadow: boolean;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
  filterBlur?: number;
  filterBrightness?: number;
  filterContrast?: number;
  filterSaturate?: number;
  opacity: number;
  borderRadius: number | [number, number, number, number];
}

// Extract style-related props from a shape
function extractStyle(shape: Shape): Omit<StylePreset, 'id' | 'name'> {
  return {
    fill: shape.fill,
    fillOpacity: shape.fillOpacity,
    fillType: shape.fillType,
    gradientStops: shape.gradientStops,
    gradientAngle: shape.gradientAngle,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    strokePosition: shape.strokePosition,
    shadows: shape.shadows,
    shadow: shape.shadow,
    shadowX: shape.shadowX,
    shadowY: shape.shadowY,
    shadowBlur: shape.shadowBlur,
    shadowColor: shape.shadowColor,
    filterBlur: shape.filterBlur,
    filterBrightness: shape.filterBrightness,
    filterContrast: shape.filterContrast,
    filterSaturate: shape.filterSaturate,
    opacity: shape.opacity,
    borderRadius: shape.borderRadius,
  };
}

const BUILTIN_PRESETS: StylePreset[] = [
  {
    id: 'builtin-glass',
    name: 'Glass',
    fill: '#ffffff', fillOpacity: 0.1, fillType: 'solid',
    gradientStops: [], gradientAngle: 135,
    stroke: '#ffffff', strokeWidth: 1, strokePosition: 'inside',
    shadows: [{ x: 0, y: 8, blur: 32, spread: 0, color: '#0000004d' }],
    shadow: false, shadowX: 0, shadowY: 8, shadowBlur: 32, shadowColor: '#0000004d',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100,
    opacity: 1, borderRadius: 16,
  },
  {
    id: 'builtin-card',
    name: 'Card',
    fill: '#1e293b', fillOpacity: 1, fillType: 'solid',
    gradientStops: [], gradientAngle: 135,
    stroke: '#334155', strokeWidth: 1, strokePosition: 'inside',
    shadows: [{ x: 0, y: 4, blur: 24, spread: 0, color: '#00000066' }],
    shadow: false, shadowX: 0, shadowY: 4, shadowBlur: 24, shadowColor: '#00000066',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100,
    opacity: 1, borderRadius: 12,
  },
  {
    id: 'builtin-neon',
    name: 'Neon',
    fill: '#0f172a', fillOpacity: 1, fillType: 'solid',
    gradientStops: [], gradientAngle: 135,
    stroke: '#6366f1', strokeWidth: 2, strokePosition: 'outside',
    shadows: [
      { x: 0, y: 0, blur: 12, spread: 2, color: '#6366f180' },
      { x: 0, y: 0, blur: 32, spread: 4, color: '#6366f140' },
    ],
    shadow: false, shadowX: 0, shadowY: 0, shadowBlur: 20, shadowColor: '#6366f180',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 130,
    opacity: 1, borderRadius: 8,
  },
  {
    id: 'builtin-gradient-indigo',
    name: 'Indigo Grad',
    fill: '#6366f1', fillOpacity: 1, fillType: 'linear-gradient',
    gradientStops: [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }],
    gradientAngle: 135,
    stroke: 'transparent', strokeWidth: 0, strokePosition: 'center',
    shadows: [{ x: 0, y: 8, blur: 24, spread: 0, color: '#6366f166' }],
    shadow: false, shadowX: 0, shadowY: 8, shadowBlur: 24, shadowColor: '#6366f166',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100,
    opacity: 1, borderRadius: 12,
  },
  {
    id: 'builtin-gradient-sunset',
    name: 'Sunset',
    fill: '#f97316', fillOpacity: 1, fillType: 'linear-gradient',
    gradientStops: [{ color: '#f97316', position: 0 }, { color: '#ec4899', position: 1 }],
    gradientAngle: 135,
    stroke: 'transparent', strokeWidth: 0, strokePosition: 'center',
    shadows: [{ x: 0, y: 8, blur: 24, spread: 0, color: '#ec489966' }],
    shadow: false, shadowX: 0, shadowY: 8, shadowBlur: 24, shadowColor: '#ec489966',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100,
    opacity: 1, borderRadius: 12,
  },
  {
    id: 'builtin-neumorphic',
    name: 'Neumorphic',
    fill: '#e2e8f0', fillOpacity: 1, fillType: 'solid',
    gradientStops: [], gradientAngle: 135,
    stroke: 'transparent', strokeWidth: 0, strokePosition: 'center',
    shadows: [
      { x: 6, y: 6, blur: 12, spread: 0, color: '#b8c4d0cc' },
      { x: -6, y: -6, blur: 12, spread: 0, color: '#ffffffcc', inset: false },
    ],
    shadow: false, shadowX: 6, shadowY: 6, shadowBlur: 12, shadowColor: '#b8c4d0cc',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100,
    opacity: 1, borderRadius: 16,
  },
  {
    id: 'builtin-ghost',
    name: 'Ghost',
    fill: 'transparent', fillOpacity: 0, fillType: 'solid',
    gradientStops: [], gradientAngle: 135,
    stroke: '#94a3b8', strokeWidth: 1.5, strokePosition: 'center',
    shadows: [],
    shadow: false, shadowX: 0, shadowY: 0, shadowBlur: 0, shadowColor: '#00000033',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100,
    opacity: 1, borderRadius: 8,
  },
  {
    id: 'builtin-flat-success',
    name: 'Success',
    fill: '#22c55e', fillOpacity: 1, fillType: 'solid',
    gradientStops: [], gradientAngle: 135,
    stroke: 'transparent', strokeWidth: 0, strokePosition: 'center',
    shadows: [{ x: 0, y: 4, blur: 16, spread: 0, color: '#22c55e55' }],
    shadow: false, shadowX: 0, shadowY: 4, shadowBlur: 16, shadowColor: '#22c55e55',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100,
    opacity: 1, borderRadius: 8,
  },
  {
    id: 'builtin-aurora',
    name: 'Aurora',
    fill: '#6366f1', fillOpacity: 1, fillType: 'linear-gradient',
    gradientStops: [{ color: '#06b6d4', position: 0 }, { color: '#6366f1', position: 0.5 }, { color: '#ec4899', position: 1 }],
    gradientAngle: 135,
    stroke: 'transparent', strokeWidth: 0, strokePosition: 'center',
    shadows: [{ x: 0, y: 8, blur: 32, spread: 0, color: '#6366f140' }],
    shadow: false, shadowX: 0, shadowY: 8, shadowBlur: 32, shadowColor: '#6366f140',
    filterBlur: 0, filterBrightness: 110, filterContrast: 100, filterSaturate: 130,
    opacity: 1, borderRadius: 16,
  },
  {
    id: 'builtin-terminal',
    name: 'Terminal',
    fill: '#0d1117', fillOpacity: 1, fillType: 'solid',
    gradientStops: [], gradientAngle: 135,
    stroke: '#30363d', strokeWidth: 1, strokePosition: 'inside',
    shadows: [{ x: 0, y: 0, blur: 0, spread: 1, color: '#30363d' }],
    shadow: false, shadowX: 0, shadowY: 0, shadowBlur: 0, shadowColor: '#30363d',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100,
    opacity: 1, borderRadius: 6,
  },
  {
    id: 'builtin-cta',
    name: 'CTA Button',
    fill: '#6366f1', fillOpacity: 1, fillType: 'linear-gradient',
    gradientStops: [{ color: '#6366f1', position: 0 }, { color: '#4f46e5', position: 1 }],
    gradientAngle: 180,
    stroke: 'transparent', strokeWidth: 0, strokePosition: 'center',
    shadows: [
      { x: 0, y: 1, blur: 0, spread: 0, color: '#ffffff33', inset: true },
      { x: 0, y: 4, blur: 14, spread: 0, color: '#6366f155' },
    ],
    shadow: false, shadowX: 0, shadowY: 4, shadowBlur: 14, shadowColor: '#6366f155',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 100,
    opacity: 1, borderRadius: 8,
  },
  {
    id: 'builtin-paper',
    name: 'Paper',
    fill: '#fefce8', fillOpacity: 1, fillType: 'solid',
    gradientStops: [], gradientAngle: 135,
    stroke: '#fef08a', strokeWidth: 1, strokePosition: 'inside',
    shadows: [
      { x: 0, y: 2, blur: 4, spread: 0, color: '#0000001a' },
      { x: 2, y: 0, blur: 4, spread: 0, color: '#0000000d' },
    ],
    shadow: false, shadowX: 0, shadowY: 2, shadowBlur: 4, shadowColor: '#0000001a',
    filterBlur: 0, filterBrightness: 100, filterContrast: 100, filterSaturate: 80,
    opacity: 1, borderRadius: 2,
  },
];

function loadSavedPresets(): StylePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StylePreset[];
  } catch {
    return [];
  }
}

function saveSavedPresets(presets: StylePreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch { /* ignore */ }
}

/** Small swatch showing a preset's fill color/gradient */
function PresetSwatch({ preset }: { preset: StylePreset }) {
  let bg = preset.fill;
  if (preset.fillType === 'linear-gradient' && preset.gradientStops.length >= 2) {
    const stops = preset.gradientStops.map(s => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
    bg = `linear-gradient(${preset.gradientAngle}deg, ${stops})`;
  } else if (preset.fillType === 'radial-gradient' && preset.gradientStops.length >= 2) {
    const stops = preset.gradientStops.map(s => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
    bg = `radial-gradient(circle, ${stops})`;
  }
  const br = typeof preset.borderRadius === 'number' ? Math.min(preset.borderRadius, 6) : 4;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: br,
      background: bg === 'transparent' ? undefined : bg,
      border: preset.stroke !== 'transparent' && preset.strokeWidth > 0
        ? `1.5px solid ${preset.stroke}`
        : '1px solid var(--border)',
      flexShrink: 0,
      ...(bg === 'transparent' ? {
        backgroundImage: 'repeating-conic-gradient(#444 0% 25%, #222 0% 50%)',
        backgroundSize: '8px 8px',
      } : {}),
    }} />
  );
}

function ShapeStylePresetsSection({ shape, onPreview, onChange }: {
  shape: Shape;
  onPreview: (p: Partial<Shape>) => void;
  onChange: (p: Partial<Shape>) => void;
}) {
  const [saved, setSaved] = useState<StylePreset[]>(loadSavedPresets);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allPresets = [...BUILTIN_PRESETS, ...saved];

  const applyPreset = (p: StylePreset) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, name, ...style } = p;
    onPreview(style);
    onChange(style);
  };

  const startSave = () => {
    setSaving(true);
    setNameInput('My Style');
    setTimeout(() => nameInputRef.current?.select(), 30);
  };

  const confirmSave = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setSaving(false); return; }
    const newPreset: StylePreset = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      ...extractStyle(shape),
    };
    const updated = [...saved, newPreset];
    setSaved(updated);
    saveSavedPresets(updated);
    setSaving(false);
    setNameInput('');
  };

  const deletePreset = (id: string) => {
    const updated = saved.filter(p => p.id !== id);
    setSaved(updated);
    saveSavedPresets(updated);
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
      }}>
        <span style={sectionLabelSt}>Style Presets</span>
        <button
          onClick={startSave}
          title="Save current style as preset"
          style={{
            background: 'none', border: '1px solid transparent', cursor: 'pointer',
            color: 'var(--muted)', fontSize: 14, lineHeight: 1,
            width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 5, padding: 0, flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none'; }}
        >+</button>
      </div>

      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Save-as-preset row */}
        {saving && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Preset name…"
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') confirmSave();
                if (e.key === 'Escape') { setSaving(false); setNameInput(''); }
              }}
              style={{
                ...inputSt, flex: 1, fontSize: 11, padding: '4px 8px',
              }}
            />
            <button
              onClick={confirmSave}
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: 5,
                color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                padding: '4px 10px', flexShrink: 0,
              }}
            >Save</button>
            <button
              onClick={() => { setSaving(false); setNameInput(''); }}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 5,
                color: 'var(--muted)', cursor: 'pointer', fontSize: 11,
                padding: '4px 8px', flexShrink: 0,
              }}
            >✕</button>
          </div>
        )}

        {/* Preset list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {allPresets.map(preset => {
            const isCustom = !preset.id.startsWith('builtin-');
            const isHovered = hoveredId === preset.id;
            return (
              <div
                key={preset.id}
                onMouseEnter={() => setHoveredId(preset.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 6px', borderRadius: 6,
                  background: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.08s',
                }}
                onClick={() => applyPreset(preset)}
              >
                <PresetSwatch preset={preset} />
                <span style={{
                  flex: 1, fontSize: 12, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {preset.name}
                </span>
                {/* Apply button (visible on hover) */}
                {isHovered && (
                  <button
                    onClick={(e) => { e.stopPropagation(); applyPreset(preset); }}
                    title="Apply style"
                    style={{
                      background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: 4, color: 'var(--accent)', cursor: 'pointer',
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', flexShrink: 0,
                    }}
                  >Apply</button>
                )}
                {/* Delete button for custom presets */}
                {isCustom && isHovered && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                    title="Delete preset"
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 4, color: 'var(--muted)', cursor: 'pointer',
                      fontSize: 10, padding: '2px 6px', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >✕</button>
                )}
              </div>
            );
          })}
        </div>

        {allPresets.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, padding: '8px 0' }}>
            No presets yet. Click + to save current style.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typography section ─────────────────────────────────────────────────────

// ── Saved text styles ──────────────────────────────────────────────────────────
const TEXT_STYLES_STORAGE = 'quill_text_styles_v1';

interface SavedTextStyle {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  letterSpacing: number;
  lineHeight: number;
  color: string;
}

function loadSavedTextStyles(): SavedTextStyle[] {
  try {
    const raw = localStorage.getItem(TEXT_STYLES_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSavedTextStyles(styles: SavedTextStyle[]): void {
  try { localStorage.setItem(TEXT_STYLES_STORAGE, JSON.stringify(styles)); } catch {}
}

function SavedTextStylesRow({ shape, onApply }: {
  shape: Shape;
  onApply: (patch: Partial<Shape>) => void;
}) {
  const [styles, setStyles] = useState<SavedTextStyle[]>(() => loadSavedTextStyles());
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSave = () => {
    const name = newName.trim() || `Style ${styles.length + 1}`;
    const s: SavedTextStyle = {
      id: `ts_${Date.now()}`,
      name,
      fontFamily: shape.fontFamily,
      fontSize: shape.fontSize,
      fontWeight: shape.fontWeight,
      fontStyle: shape.fontStyle,
      letterSpacing: shape.letterSpacing,
      lineHeight: shape.lineHeight,
      color: shape.color,
    };
    const next = [...styles, s];
    setStyles(next);
    saveSavedTextStyles(next);
    setSaving(false);
    setNewName('');
  };

  const handleDelete = (id: string) => {
    const next = styles.filter(s => s.id !== id);
    setStyles(next);
    saveSavedTextStyles(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Saved styles list */}
      {styles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {styles.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <button
                onClick={() => onApply({
                  fontFamily: s.fontFamily, fontSize: s.fontSize,
                  fontWeight: s.fontWeight, fontStyle: s.fontStyle,
                  letterSpacing: s.letterSpacing, lineHeight: s.lineHeight,
                  color: s.color,
                })}
                title={`${s.fontFamily} ${s.fontSize}px / ${s.fontWeight}`}
                style={{
                  background: 'var(--panel-alt)', border: '1px solid var(--border)',
                  borderRadius: '4px 0 0 4px', color: 'var(--text)', cursor: 'pointer',
                  fontSize: 10, fontWeight: 600, padding: '3px 7px',
                  fontFamily: s.fontFamily, transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
              >
                {s.name}
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                title="Delete style"
                style={{
                  background: 'var(--panel-alt)', border: '1px solid var(--border)', borderLeft: 'none',
                  borderRadius: '0 4px 4px 0', color: 'var(--muted)', cursor: 'pointer',
                  fontSize: 9, padding: '3px 5px', transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Save current style */}
      {saving ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="text"
            placeholder={`Style ${styles.length + 1}`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setSaving(false); setNewName(''); }
            }}
            autoFocus
            style={{ ...inputSt, flex: 1, height: 24, padding: '2px 6px', fontSize: 11 }}
          />
          <button
            onClick={handleSave}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 4,
              color: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600,
              padding: '3px 8px', flexShrink: 0,
            }}
          >Save</button>
          <button
            onClick={() => { setSaving(false); setNewName(''); }}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 4,
              color: 'var(--muted)', cursor: 'pointer', fontSize: 10, padding: '3px 6px',
            }}
          >Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setSaving(true)}
          title="Save current text style"
          style={{
            background: 'none', border: '1px dashed var(--border)',
            borderRadius: 4, color: 'var(--muted)', cursor: 'pointer',
            fontSize: 10, padding: '3px 8px', alignSelf: 'flex-start',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
        >+ Save Style</button>
      )}
    </div>
  );
}

// ── Text style presets ─────────────────────────────────────────────────────────
const TEXT_STYLE_PRESETS: { label: string; preset: Partial<Shape> }[] = [
  { label: 'Display', preset: { fontSize: 64, fontWeight: '800', lineHeight: 1.1, letterSpacing: -2 } },
  { label: 'H1', preset: { fontSize: 40, fontWeight: '700', lineHeight: 1.2, letterSpacing: -1 } },
  { label: 'H2', preset: { fontSize: 28, fontWeight: '600', lineHeight: 1.3, letterSpacing: -0.5 } },
  { label: 'H3', preset: { fontSize: 20, fontWeight: '600', lineHeight: 1.4, letterSpacing: 0 } },
  { label: 'Body', preset: { fontSize: 16, fontWeight: '400', lineHeight: 1.6, letterSpacing: 0 } },
  { label: 'Small', preset: { fontSize: 13, fontWeight: '400', lineHeight: 1.5, letterSpacing: 0 } },
  { label: 'Caption', preset: { fontSize: 11, fontWeight: '400', lineHeight: 1.4, letterSpacing: 20 } },
  { label: 'Code', preset: { fontSize: 13, fontWeight: '400', fontFamily: 'monospace', lineHeight: 1.6, letterSpacing: 0 } },
];

function TypographySection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  return (
    <PanelSection label="Typography">

      {/* Text style presets */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 2 }}>
        {TEXT_STYLE_PRESETS.map(({ label, preset }) => (
          <button
            key={label}
            onClick={() => { onPreview(preset); onChange(preset); }}
            title={`Apply ${label} style`}
            style={{
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
              borderRadius: 4, color: 'var(--muted)', cursor: 'pointer',
              fontSize: 10, fontWeight: 600, padding: '3px 7px',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Saved text styles */}
      <SavedTextStylesRow
        shape={shape}
        onApply={(patch) => { onPreview(patch); onChange(patch); }}
      />

      {/* Text content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelSt}>Content</span>
        <textarea
          value={shape.text}
          rows={3}
          onChange={(e) => onPreview({ text: e.target.value })}
          onBlur={(e) => onChange({ text: e.target.value })}
          onKeyDown={(e) => {
            const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y');
            if (!isUndo) e.stopPropagation(); // prevent canvas shortcuts while typing
            if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
          }}
          style={{
            ...inputSt, resize: 'vertical', minHeight: 56,
            fontFamily: shape.fontFamily,
            fontSize: shape.fontSize,
            lineHeight: shape.lineHeight,
          }}
        />
      </div>

      {/* Font family */}
      <FontPicker
        value={shape.fontFamily}
        onPreview={(v) => onPreview({ fontFamily: v })}
        onCommit={(v) => onChange({ fontFamily: v })}
      />

      {/* Color + size + weight */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelSt}>Color</span>
          <ColorSwatchInput
            value={shape.color}
            onPreview={(v) => onPreview({ color: v })}
            onCommit={(v) => onChange({ color: v })}
          />
        </div>
        <FieldBox label="Size" value={shape.fontSize} min={8}
          onPreview={(v) => onPreview({ fontSize: v })}
          onCommit={(v) => onChange({ fontSize: v })} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelSt}>Weight</span>
          <select
            value={shape.fontWeight}
            onChange={(e) => { onPreview({ fontWeight: e.target.value }); onChange({ fontWeight: e.target.value }); }}
            style={selectSt}
          >
            {[
              ['100', 'Thin'],
              ['200', 'ExtraLight'],
              ['300', 'Light'],
              ['400', 'Regular'],
              ['500', 'Medium'],
              ['600', 'SemiBold'],
              ['700', 'Bold'],
              ['800', 'ExtraBold'],
              ['900', 'Black'],
            ].map(([w, label]) => (
              <option key={w} value={w}>{w} – {label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Variable font weight slider — for variable fonts, this enables fine-grained weight between 100–900 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...labelSt, fontSize: 10 }}>Variable weight</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--muted)' }}>{shape.fontWeight}</span>
        </div>
        <input
          type="range"
          min={100}
          max={900}
          step={1}
          value={parseInt(shape.fontWeight) || 400}
          onChange={(e) => onPreview({ fontWeight: e.target.value })}
          onMouseUp={(e) => onChange({ fontWeight: (e.target as HTMLInputElement).value })}
          onTouchEnd={(e) => onChange({ fontWeight: (e.target as HTMLInputElement).value })}
          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
          title="Drag for fine-grained weight control (useful for variable fonts)"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 0 }}>
          <span style={{ fontSize: 9, color: 'var(--subtle)' }}>Thin</span>
          <span style={{ fontSize: 9, color: 'var(--subtle)' }}>Regular</span>
          <span style={{ fontSize: 9, color: 'var(--subtle)' }}>Black</span>
        </div>
      </div>

      {/* Contrast ratio indicator */}
      <ContrastBadge textColor={shape.color} bgColor={shape.fill !== 'transparent' ? shape.fill : '#ffffff'} />

      {/* Line height + letter spacing */}
      <div style={{ display: 'flex', gap: 6 }}>
        <FieldBoxFloat label="Line H" value={shape.lineHeight} min={0.5} step={0.05} decimals={2}
          onPreview={(v) => onPreview({ lineHeight: v })}
          onCommit={(v) => onChange({ lineHeight: v })} />
        <FieldBoxFloat label="Tracking" value={shape.letterSpacing} step={1} decimals={0}
          onPreview={(v) => onPreview({ letterSpacing: v })}
          onCommit={(v) => onChange({ letterSpacing: v })} />
      </div>

      {/* Style toggles: italic, underline, strikethrough */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelSt}>Style</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* Italic */}
          <ToggleBtn
            active={shape.fontStyle === 'italic'}
            title="Italic"
            onClick={() => {
              const v = shape.fontStyle === 'italic' ? 'normal' : 'italic';
              onPreview({ fontStyle: v }); onChange({ fontStyle: v });
            }}
          ><em style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>I</em></ToggleBtn>

          {/* Underline */}
          <ToggleBtn
            active={shape.textDecoration === 'underline'}
            title="Underline"
            onClick={() => {
              const v = shape.textDecoration === 'underline' ? 'none' : 'underline';
              onPreview({ textDecoration: v }); onChange({ textDecoration: v });
            }}
          ><span style={{ textDecoration: 'underline' }}>U</span></ToggleBtn>

          {/* Strikethrough */}
          <ToggleBtn
            active={shape.textDecoration === 'line-through'}
            title="Strikethrough"
            onClick={() => {
              const v = shape.textDecoration === 'line-through' ? 'none' : 'line-through';
              onPreview({ textDecoration: v }); onChange({ textDecoration: v });
            }}
          ><span style={{ textDecoration: 'line-through' }}>S</span></ToggleBtn>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Align: left / center / right / justify */}
          {(['left', 'center', 'right'] as const).map((val) => (
            <ToggleBtn
              key={val}
              active={shape.textAlign === val}
              title={`Align ${val}`}
              onClick={() => { onPreview({ textAlign: val }); onChange({ textAlign: val }); }}
            >
              <AlignIcon type={val} />
            </ToggleBtn>
          ))}
        </div>
      </div>

    </PanelSection>
  );
}

// Compact SVG alignment icons
function AlignIcon({ type }: { type: 'left' | 'center' | 'right' }) {
  // Each entry: [x, width] for a line, rendered at y = i*3.5
  const lines: [number, number][] =
    type === 'left'   ? [[0, 10], [0, 7], [0, 8]] :
    type === 'center' ? [[1, 10], [2, 6], [1, 8]] :
                        [[0, 10], [3, 7], [2, 8]];
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
      {lines.map(([x, w], i) => (
        <rect key={i} x={x} y={i * 3.2} width={w} height={1.5} rx={0.75} fill="currentColor" />
      ))}
    </svg>
  );
}

// Toggle button (for italic/underline/strikethrough/align)
function ToggleBtn({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'rgba(99,102,241,0.15)' : 'var(--input-bg)',
        color: active ? 'var(--accent)' : 'var(--muted)',
        borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700,
        flexShrink: 0,
        transition: 'all 0.1s',
      }}
    >{children}</button>
  );
}

// Float field box — supports decimals and step
function FieldBoxFloat({ label, value, min, step = 0.1, decimals = 1, onPreview, onCommit }: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  decimals?: number;
  onPreview: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(value.toFixed(decimals));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setLocal(value.toFixed(decimals)); }, [value, focused, decimals]);

  const clamp = (n: number) => min !== undefined ? Math.max(min, n) : n;

  const commit = (raw: string) => {
    let n = parseFloat(raw);
    if (isNaN(n)) n = value;
    n = clamp(parseFloat(n.toFixed(decimals)));
    setLocal(n.toFixed(decimals));
    onCommit(n);
  };

  const stepBy = (delta: number) => {
    const n = clamp(parseFloat(local || '0') + delta);
    const rounded = parseFloat(n.toFixed(decimals));
    setLocal(rounded.toFixed(decimals));
    onPreview(rounded);
    onCommit(rounded);
  };

  const stepBtnSt: React.CSSProperties = {
    flexShrink: 0,
    width: 28,
    height: 18,
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    userSelect: 'none',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      {label && <span style={labelSt}>{label}</span>}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        background: 'var(--input-bg)', border: '1px solid var(--border)',
        borderRadius: 5, overflow: 'hidden',
        ...(focused ? { borderColor: 'var(--accent)', outline: '1px solid rgba(99,102,241,0.3)' } : {}),
      }}>
        <input
          type="number"
          value={local}
          min={min}
          step={step}
          onChange={(e) => {
            setLocal(e.target.value);
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) onPreview(clamp(n));
          }}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { setFocused(false); commit(e.target.value); }}
          onKeyDown={(e) => {
            const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y');
            if (!isUndo) e.stopPropagation();
            if (e.key === 'Escape') { (e.target as HTMLInputElement).blur(); return; }
            if (e.key === 'Enter') { commit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); return; }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              stepBy((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1) * step);
            }
          }}
          onWheel={(e) => {
            e.preventDefault();
            stepBy((e.deltaY < 0 ? 1 : -1) * step);
          }}
          style={{
            flex: 1, width: '100%', background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 12, padding: '6px 6px', minWidth: 0, alignSelf: 'center',
          }}
        />
        {/* Stepper buttons — larger hit targets than native browser spinners */}
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, alignSelf: 'stretch', borderLeft: '1px solid var(--border)' }}>
          <button
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); stepBy(step); }}
            style={{ ...stepBtnSt, flex: 1, borderBottom: '1px solid var(--border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
            title="Increase (scroll to adjust)"
          >▲</button>
          <button
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); stepBy(-step); }}
            style={{ ...stepBtnSt, flex: 1 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
            title="Decrease (scroll to adjust)"
          >▼</button>
        </div>
      </div>
    </div>
  );
}

// ── Font Picker ────────────────────────────────────────────────────────────

function FontPicker({ value, onPreview, onCommit }: {
  value: string;
  onPreview: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Derive the display name from the full CSS font stack
  const displayName = (() => {
    // Check system fonts first
    for (const sf of SYSTEM_FONTS) {
      if (sf.stack === value) return sf.family;
    }
    // Otherwise take the first comma-separated token
    return value.split(',')[0].trim().replace(/^["']|["']$/g, '');
  })();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 30);
    } else {
      setQuery('');
    }
  }, [open]);

  const q = query.toLowerCase();

  // Custom imported fonts (from localStorage via CustomFontsPanel)
  const customFonts = useMemo(() => loadStoredFonts(), []);
  const filteredCustom = customFonts.filter(f =>
    !q || f.family.toLowerCase().includes(q)
  );

  const filteredSystem = SYSTEM_FONTS.filter(sf =>
    !q || sf.family.toLowerCase().includes(q)
  );

  const filteredGoogle = GOOGLE_FONTS.filter(gf =>
    !q || gf.family.toLowerCase().includes(q)
  );

  // Group filtered google fonts by category
  const categories = Array.from(new Set(filteredGoogle.map(gf => gf.category)));

  const pickFont = (stack: string, family?: string) => {
    if (family) loadGoogleFont(family);
    onPreview(stack);
    onCommit(stack);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelSt}>Font</span>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputSt,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: value,
          color: 'var(--text)',
          border: open ? '1px solid var(--accent)' : '1px solid var(--border)',
          padding: '5px 7px',
          background: 'var(--input-bg)',
          borderRadius: 5,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {displayName}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, marginLeft: 4, color: 'var(--muted)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 7,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          marginTop: 3,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: 320,
        }}>
          {/* Search */}
          <div style={{ padding: '8px 8px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search fonts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                ...inputSt,
                width: '100%',
                boxSizing: 'border-box',
                fontSize: 12,
                padding: '4px 8px',
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>

            {/* Custom imported fonts */}
            {filteredCustom.length > 0 && (
              <>
                <div style={{ padding: '6px 10px 2px', fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>✦</span> Custom
                </div>
                {filteredCustom.map(cf => {
                  const isActive = value === cf.family || value.startsWith(`'${cf.family}'`);
                  return (
                    <FontOption
                      key={cf.id}
                      label={cf.family}
                      fontFamily={cf.family}
                      active={isActive}
                      onClick={() => pickFont(cf.family)}
                    />
                  );
                })}
              </>
            )}

            {/* System fonts */}
            {filteredSystem.length > 0 && (
              <>
                <div style={{ padding: '6px 10px 2px', fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  System
                </div>
                {filteredSystem.map(sf => {
                  const isActive = sf.stack === value;
                  return (
                    <FontOption
                      key={sf.stack}
                      label={sf.family}
                      fontFamily={sf.stack}
                      active={isActive}
                      onClick={() => pickFont(sf.stack)}
                    />
                  );
                })}
              </>
            )}

            {/* Google fonts by category */}
            {categories.map(cat => {
              const fonts = filteredGoogle.filter(gf => gf.category === cat);
              if (!fonts.length) return null;
              return (
                <React.Fragment key={cat}>
                  <div style={{ padding: '6px 10px 2px', fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {CATEGORY_LABELS[cat]}
                  </div>
                  {fonts.map(gf => {
                    const stack = `'${gf.family}', ${gf.category}`;
                    const isActive = value.includes(gf.family);
                    return (
                      <FontOption
                        key={gf.family}
                        label={gf.family}
                        fontFamily={stack}
                        active={isActive}
                        onClick={() => pickFont(stack, gf.family)}
                        onHover={() => loadGoogleFont(gf.family)}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}

            {filteredCustom.length === 0 && filteredSystem.length === 0 && filteredGoogle.length === 0 && (
              <div style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                No fonts match "{query}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FontOption({ label, fontFamily, active, onClick, onHover }: {
  label: string;
  fontFamily: string;
  active: boolean;
  onClick: () => void;
  onHover?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        width: '100%',
        textAlign: 'left',
        padding: '5px 10px',
        background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text)',
        border: 'none',
        cursor: 'pointer',
        boxSizing: 'border-box',
        transition: 'background 0.08s',
      }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      onMouseEnter={(e) => { onHover?.(); if (!active) e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; }}
      onMouseDown={(e) => e.preventDefault()} // prevent blur on search input
    >
      {/* Font name in that font — the preview */}
      <span style={{
        fontFamily,
        fontSize: 15,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: active ? 'var(--accent)' : 'var(--text)',
      }}>
        Aa — {label}
      </span>
      {/* Small label in system font */}
      <span style={{
        fontSize: 9, color: 'var(--subtle)', fontFamily: 'system-ui',
        letterSpacing: '0.02em',
      }}>
        {label}
      </span>
    </button>
  );
}

// ── Position & Size section (with aspect ratio lock) ──────────────────────

function PositionSection({ shape, onPreview, onChange, isText }: {
  shape: Shape;
  onPreview: (p: Partial<Shape>) => void;
  onChange: (p: Partial<Shape>) => void;
  isText: boolean;
}) {
  const [locked, setLocked] = useState(false);
  const ratio = shape.width > 0 ? shape.height / shape.width : 1;

  const handleWidthChange = (v: number, preview: boolean) => {
    if (locked) {
      const h = Math.round(Math.max(8, v * ratio));
      if (preview) onPreview({ width: v, height: h });
      else onChange({ width: v, height: h });
    } else {
      if (preview) onPreview({ width: v });
      else onChange({ width: v });
    }
  };

  const handleHeightChange = (v: number, preview: boolean) => {
    if (locked) {
      const w = Math.round(Math.max(8, v / ratio));
      if (preview) onPreview({ width: w, height: v });
      else onChange({ width: w, height: v });
    } else {
      if (preview) onPreview({ height: v });
      else onChange({ height: v });
    }
  };

  return (
    <PanelSection label="Position">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <FieldBox label="X" value={shape.x}
            onPreview={(v) => onPreview({ x: v })} onCommit={(v) => onChange({ x: v })} />
          <FieldBox label="Y" value={shape.y}
            onPreview={(v) => onPreview({ y: v })} onCommit={(v) => onChange({ y: v })} />
        </div>
        {/* W + H with aspect ratio lock */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <FieldBox label="W" value={shape.width} min={8}
            onPreview={(v) => handleWidthChange(v, true)}
            onCommit={(v) => handleWidthChange(v, false)} />
          {/* Lock button */}
          <button
            onClick={() => setLocked(l => !l)}
            title={locked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            style={{
              flexShrink: 0, width: 22, height: 28, marginBottom: 0,
              background: locked ? 'rgba(99,102,241,0.12)' : 'var(--input-bg)',
              border: `1px solid ${locked ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 5, cursor: 'pointer',
              color: locked ? 'var(--accent)' : 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.background = 'rgba(99,102,241,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = locked ? 'var(--accent)' : 'var(--border)';
              e.currentTarget.style.color = locked ? 'var(--accent)' : 'var(--muted)';
              e.currentTarget.style.background = locked ? 'rgba(99,102,241,0.12)' : 'var(--input-bg)';
            }}
          >
            <LockIcon locked={locked} />
          </button>
          <FieldBox label="H" value={shape.height} min={8}
            onPreview={(v) => handleHeightChange(v, true)}
            onCommit={(v) => handleHeightChange(v, false)} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <FieldBox label="R°" value={Math.round(shape.rotation)}
            onPreview={(v) => onPreview({ rotation: ((v % 360) + 360) % 360 })}
            onCommit={(v) => onChange({ rotation: ((v % 360) + 360) % 360 })} />
          {/* Transform quick actions: rotate 90, flip H, flip V */}
          <div style={{ display: 'flex', gap: 2, paddingBottom: 1 }}>
            {([
              {
                title: 'Rotate 90° CW',
                onClick: () => onChange({ rotation: ((Math.round(shape.rotation) + 90) % 360 + 360) % 360 }),
                icon: (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M9.5 6A3.5 3.5 0 1 1 6 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <polyline points="6,1 8.5,2.5 6,4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
              },
              {
                title: `Flip horizontal${shape.flipX ? ' (active)' : ''}`,
                active: shape.flipX,
                onClick: () => onChange({ flipX: !shape.flipX }),
                icon: (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5"/>
                    <polyline points="3,4 1,6 3,8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="9,4 11,6 9,8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
              },
              {
                title: `Flip vertical${shape.flipY ? ' (active)' : ''}`,
                active: shape.flipY,
                onClick: () => onChange({ flipY: !shape.flipY }),
                icon: (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5"/>
                    <polyline points="4,3 6,1 8,3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="4,9 6,11 8,9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
              },
            ] as { title: string; active?: boolean; onClick: () => void; icon: React.ReactNode }[]).map((btn, i) => (
              <button
                key={i}
                title={btn.title}
                onClick={btn.onClick}
                style={{
                  width: 26, height: 26, borderRadius: 5, border: '1px solid',
                  borderColor: btn.active ? 'var(--accent)' : 'var(--border)',
                  background: btn.active ? 'rgba(99,102,241,0.12)' : 'var(--input-bg)',
                  color: btn.active ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = btn.active ? 'var(--accent)' : 'var(--muted)';
                  e.currentTarget.style.borderColor = btn.active ? 'var(--accent)' : 'var(--border)';
                }}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        </div>
        {!isText && shape.type !== 'ellipse' && (
          <CornerRadiusRow shape={shape} onPreview={onPreview} onChange={onChange} />
        )}
      </div>
    </PanelSection>
  );
}

// ── Auto layout presets ────────────────────────────────────────────────────

type LayoutPreset = {
  label: string;
  title: string;
  icon: React.ReactNode;
  patch: Partial<Shape>;
};

function AutoLayoutPresets({ shape, onChange, onPreview }: {
  shape: Shape;
  onChange: (p: Partial<Shape>) => void;
  onPreview: (p: Partial<Shape>) => void;
}) {
  const presets: LayoutPreset[] = [
    {
      label: 'Card',
      title: 'Card — column, padding 16, gap 12',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.1"/>
          <line x1="3" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1"/>
          <line x1="3" y1="7.5" x2="9" y2="7.5" stroke="currentColor" strokeWidth="1"/>
          <line x1="3" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="1"/>
        </svg>
      ),
      patch: { layout: 'column', layoutGap: 12, layoutPaddingH: 16, layoutPaddingV: 16, layoutAlign: 'flex-start', layoutJustify: 'flex-start' },
    },
    {
      label: 'Nav',
      title: 'Navbar — row, space-between, padding 16/8',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="4" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.1"/>
          <line x1="3" y1="7" x2="5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="9" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ),
      patch: { layout: 'row', layoutGap: 16, layoutPaddingH: 16, layoutPaddingV: 8, layoutAlign: 'center', layoutJustify: 'space-between' },
    },
    {
      label: 'Center',
      title: 'Centered — row, centered both axes',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
          <rect x="4.5" y="4.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1"/>
        </svg>
      ),
      patch: { layout: 'row', layoutGap: 8, layoutPaddingH: 12, layoutPaddingV: 12, layoutAlign: 'center', layoutJustify: 'center' },
    },
    {
      label: 'List',
      title: 'List — column, tight, no padding',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <line x1="2" y1="3.5" x2="12" y2="3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="2" y1="10.5" x2="12" y2="10.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
      ),
      patch: { layout: 'column', layoutGap: 1, layoutPaddingH: 0, layoutPaddingV: 0, layoutAlign: 'flex-start', layoutJustify: 'flex-start' },
    },
    {
      label: 'Pills',
      title: 'Pill row — row, gap 8, wrap-friendly',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="4" width="5" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
          <rect x="7.5" y="4" width="5.5" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
          <rect x="1" y="9" width="3.5" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
        </svg>
      ),
      patch: { layout: 'row', layoutGap: 8, layoutPaddingH: 12, layoutPaddingV: 8, layoutAlign: 'center', layoutJustify: 'flex-start' },
    },
  ];

  const [applied, setApplied] = useState<string | null>(null);

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: 6 }}>
        Presets
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {presets.map(preset => (
          <button
            key={preset.label}
            title={preset.title}
            onClick={() => {
              const full = { ...preset.patch };
              onPreview(full);
              onChange(full);
              setApplied(preset.label);
              setTimeout(() => setApplied(null), 900);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 7px', borderRadius: 5,
              border: `1px solid ${applied === preset.label ? 'var(--accent)' : 'var(--border)'}`,
              background: applied === preset.label ? 'rgba(99,102,241,0.12)' : 'var(--input-bg)',
              color: applied === preset.label ? 'var(--accent)' : 'var(--muted)',
              cursor: 'pointer', fontSize: 10, fontWeight: 500,
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              if (applied !== preset.label) {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
              }
            }}
            onMouseLeave={(e) => {
              if (applied !== preset.label) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--muted)';
                e.currentTarget.style.background = 'var(--input-bg)';
              }
            }}
          >
            {preset.icon}
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Hug Contents button ────────────────────────────────────────────────────

function HugContentsButton({ shape, allShapes, onChange }: {
  shape: Shape;
  allShapes: Shape[];
  onChange: (p: Partial<Shape>) => void;
}) {
  const PAD = 16; // default padding around children

  const children = allShapes.filter(s => s.parentId === shape.id);

  if (children.length === 0) {
    return (
      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--subtle)', fontStyle: 'italic' }}>
        No children to hug
      </div>
    );
  }

  const hugContents = (padding: number) => {
    // Compute bounding box of all children in frame-local coords
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const child of children) {
      minX = Math.min(minX, child.x);
      minY = Math.min(minY, child.y);
      maxX = Math.max(maxX, child.x + child.width);
      maxY = Math.max(maxY, child.y + child.height);
    }

    const newW = Math.max(8, maxX - minX + padding * 2);
    const newH = Math.max(8, maxY - minY + padding * 2);

    // Offset to keep children visually in place: shift the frame origin,
    // and also adjust children's local positions so they land with `padding` gap
    const shiftX = minX - padding;
    const shiftY = minY - padding;

    onChange({ width: newW, height: newH, x: shape.x + shiftX, y: shape.y + shiftY });
  };

  return (
    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
      <button
        onClick={() => hugContents(PAD)}
        title={`Resize frame to tightly wrap ${children.length} child${children.length === 1 ? '' : 'ren'} (${PAD}px padding)`}
        style={{
          flex: 1, height: 26, borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer',
          fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 5, transition: 'all 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text)';
          e.currentTarget.style.background = 'var(--input-bg)';
        }}
      >
        {/* Hug icon: arrows pointing inward */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 3V1h2M9 1h2v2M1 9v2h2M11 9v2H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.5 1"/>
        </svg>
        Hug Contents
      </button>
      {/* Padding variant: zero padding */}
      <button
        onClick={() => hugContents(0)}
        title="Hug contents with no padding"
        style={{
          height: 26, paddingInline: 8, borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--input-bg)', color: 'var(--muted)', cursor: 'pointer',
          fontSize: 10, fontWeight: 500, transition: 'all 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--muted)';
          e.currentTarget.style.background = 'var(--input-bg)';
        }}
      >
        0px
      </button>
      <button
        onClick={() => hugContents(8)}
        title="Hug contents with 8px padding"
        style={{
          height: 26, paddingInline: 8, borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--input-bg)', color: 'var(--muted)', cursor: 'pointer',
          fontSize: 10, fontWeight: 500, transition: 'all 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--muted)';
          e.currentTarget.style.background = 'var(--input-bg)';
        }}
      >
        8px
      </button>
    </div>
  );
}

// ── Auto layout section ────────────────────────────────────────────────────

function AutoLayoutSection({ shape, onPreview, onChange }: {
  shape: Shape;
  onPreview: (p: Partial<Shape>) => void;
  onChange: (p: Partial<Shape>) => void;
}) {
  const isActive = shape.layout !== 'none';

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 6px',
      }}>
        <span style={sectionLabelSt}>Auto layout</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {isActive && (
            <>
              <IconBtn
                active={shape.layout === 'row'}
                onClick={() => { onPreview({ layout: 'row' }); onChange({ layout: 'row' }); }}
                title="Horizontal"
              >→</IconBtn>
              <IconBtn
                active={shape.layout === 'column'}
                onClick={() => { onPreview({ layout: 'column' }); onChange({ layout: 'column' }); }}
                title="Vertical"
              >↓</IconBtn>
            </>
          )}
          <IconBtn
            active={isActive}
            onClick={() => {
              const next: Partial<Shape> = { layout: isActive ? 'none' : 'row' };
              onPreview(next); onChange(next);
            }}
            title={isActive ? 'Remove auto layout' : 'Add auto layout'}
          >{isActive ? '✕' : '+'}</IconBtn>
        </div>
      </div>

      {isActive && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Gap + Padding */}
          <div style={{ display: 'flex', gap: 6 }}>
            <FieldBox label="Gap" value={shape.layoutGap} min={0}
              onPreview={(v) => onPreview({ layoutGap: v })} onCommit={(v) => onChange({ layoutGap: v })} />
            <FieldBox label="Pad H" value={shape.layoutPaddingH} min={0}
              onPreview={(v) => onPreview({ layoutPaddingH: v })} onCommit={(v) => onChange({ layoutPaddingH: v })} />
            <FieldBox label="Pad V" value={shape.layoutPaddingV} min={0}
              onPreview={(v) => onPreview({ layoutPaddingV: v })} onCommit={(v) => onChange({ layoutPaddingV: v })} />
          </div>

          {/* Alignment grid — 3×3 like Figma + space-between option */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <AlignmentGrid
                layout={shape.layout as 'row' | 'column'}
                align={shape.layoutAlign}
                justify={shape.layoutJustify}
                onAlignChange={(a) => { onPreview({ layoutAlign: a }); onChange({ layoutAlign: a }); }}
                onJustifyChange={(j) => { onPreview({ layoutJustify: j }); onChange({ layoutJustify: j }); }}
              />
              {/* Space-between toggle */}
              <IconBtn
                active={shape.layoutJustify === 'space-between'}
                onClick={() => {
                  const j = shape.layoutJustify === 'space-between' ? 'flex-start' : 'space-between';
                  onPreview({ layoutJustify: j }); onChange({ layoutJustify: j });
                }}
                title="Space between"
              >
                {shape.layout === 'row' ? '⇼' : '⇕'}
              </IconBtn>
            </div>
          </div>

          {/* ── Hug Contents toggle ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 3V1h2M9 1h2v2M1 9v2h2M11 9v2H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.5 1"/>
              </svg>
              <span style={labelSt}>Hug Contents</span>
            </div>
            <button
              onClick={() => {
                const next = !shape.layoutHug;
                onPreview({ layoutHug: next }); onChange({ layoutHug: next });
              }}
              title={shape.layoutHug ? 'Disable hug — fixed frame size' : 'Enable hug — frame resizes to wrap children'}
              style={{
                width: 32, height: 18, borderRadius: 10, border: 'none',
                cursor: 'pointer', flexShrink: 0,
                background: shape.layoutHug ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.15s', position: 'relative',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, borderRadius: '50%',
                width: 14, height: 14, background: '#fff',
                transition: 'left 0.15s',
                left: shape.layoutHug ? 16 : 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>

          {/* ── Layout presets ── */}
          <AutoLayoutPresets shape={shape} onChange={onChange} onPreview={onPreview} />
        </div>
      )}
    </div>
  );
}

// ── Alignment grid (Figma-style 3×3) ──────────────────────────────────────

type AlignVal = 'flex-start' | 'center' | 'flex-end';
type JustifyVal = 'flex-start' | 'center' | 'flex-end' | 'space-between';

function AlignmentGrid({ layout, align, justify, onAlignChange, onJustifyChange }: {
  layout: 'row' | 'column';
  align: string;
  justify: string;
  onAlignChange: (v: string) => void;
  onJustifyChange: (v: string) => void;
}) {
  // Map main axis (justify) and cross axis (align) to grid col/row
  const justifyVals: AlignVal[] = ['flex-start', 'center', 'flex-end'];
  const alignVals: AlignVal[] = ['flex-start', 'center', 'flex-end'];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 24px)',
      gridTemplateRows: 'repeat(3, 24px)',
      gap: 2,
    }}>
      {alignVals.map((av) =>
        justifyVals.map((jv) => {
          // In row layout: columns = justify (main), rows = align (cross)
          // In column layout: rows = justify (main), columns = align (cross)
          const [cellJustify, cellAlign] = layout === 'row' ? [jv, av] : [av, jv];
          const isActive = cellAlign === align && cellJustify === justify;

          return (
            <button
              key={`${av}-${jv}`}
              title={`align: ${cellAlign}, justify: ${cellJustify}`}
              onClick={() => {
                onAlignChange(cellAlign);
                onJustifyChange(cellJustify);
              }}
              style={{
                width: 24, height: 24,
                background: isActive ? 'rgba(99,102,241,0.25)' : 'var(--input-bg)',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 3,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: 1,
                background: isActive ? 'var(--accent)' : 'var(--muted)',
              }} />
            </button>
          );
        })
      )}
    </div>
  );
}

// ── Recent color history ───────────────────────────────────────────────────

const RECENT_COLORS_KEY = 'quill_recent_colors';
const MAX_RECENT = 12;

/** Global recent colors shared across all color pickers in the session. */
const recentColorsListeners: Set<() => void> = new Set();

function readRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addRecentColor(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const prev = readRecentColors();
  const next = [hex, ...prev.filter(c => c.toLowerCase() !== hex.toLowerCase())].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
  recentColorsListeners.forEach(fn => fn());
}

function useRecentColors() {
  const [colors, setColors] = useState<string[]>(readRecentColors);
  useEffect(() => {
    const refresh = () => setColors(readRecentColors());
    recentColorsListeners.add(refresh);
    return () => { recentColorsListeners.delete(refresh); };
  }, []);
  return colors;
}

// ── Preset palette ─────────────────────────────────────────────────────────

const PALETTE: string[] = [
  '#ffffff', '#000000', '#f87171', '#fb923c', '#fbbf24',
  '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa',
  '#f472b6', '#94a3b8',
];

// ── Color row (swatch + hex + opacity%) ───────────────────────────────────

function ColorRow({
  color, opacity,
  onColorPreview, onColorCommit,
  onOpacityPreview, onOpacityCommit,
  docColors = [],
}: {
  color: string;
  opacity: number;
  onColorPreview: (v: string) => void;
  onColorCommit: (v: string) => void;
  onOpacityPreview?: (v: number) => void;
  onOpacityCommit?: (v: number) => void;
  docColors?: string[];
}) {
  const [localColor, setLocalColor] = useState(color);
  const [localOpacity, setLocalOpacity] = useState(opacity);
  const recentColors = useRecentColors();

  useEffect(() => { setLocalColor(color); }, [color]);
  useEffect(() => { setLocalOpacity(opacity); }, [opacity]);

  const commitColor = useCallback((raw: string) => {
    const v = raw.startsWith('#') ? raw : '#' + raw;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      setLocalColor(v);
      onColorCommit(v);
      addRecentColor(v);
    } else {
      setLocalColor(color);
    }
  }, [color, onColorCommit]);

  const pickColor = useCallback((hex: string) => {
    setLocalColor(hex);
    onColorPreview(hex);
    onColorCommit(hex);
    addRecentColor(hex);
  }, [onColorPreview, onColorCommit]);

  // All swatches: recent first, then palette (deduplicated)
  const swatches = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [...recentColors, ...PALETTE]) {
      const key = c.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(c); }
      if (out.length >= MAX_RECENT) break;
    }
    return out;
  }, [recentColors]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Row 1: swatch + hex + opacity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Color swatch (native picker) */}
        <ColorSwatchInput
          value={localColor}
          onPreview={onColorPreview}
          onCommit={(v) => { onColorCommit(v); addRecentColor(v); }}
        />

        {/* EyeDropper button (Chrome/Edge only) */}
        {'EyeDropper' in window && (
          <button
            title="Pick color from screen (EyeDropper)"
            onClick={async () => {
              try {
                const dropper = new (window as any).EyeDropper();
                const result = await dropper.open();
                if (result?.sRGBHex) {
                  commitColor(result.sRGBHex);
                  addRecentColor(result.sRGBHex);
                }
              } catch {
                // user cancelled or not supported
              }
            }}
            style={{
              width: 24, height: 24, borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
              color: 'rgba(255,255,255,0.7)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 2.5a2.12 2.12 0 0 0-3 0L2 11l-.5 3.5 3.5-.5 8.5-8.5a2.12 2.12 0 0 0 0-3z"/>
              <path d="m10.5 4.5 1 1"/>
              <circle cx="3" cy="13" r=".5" fill="currentColor" stroke="none"/>
            </svg>
          </button>
        )}

        {/* Hex input */}
        <input
          type="text"
          value={localColor}
          onChange={(e) => {
            setLocalColor(e.target.value);
            const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onColorPreview(v);
          }}
          onBlur={(e) => commitColor(e.target.value)}
          onKeyDown={(e) => {
            const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y');
            if (!isUndo) e.stopPropagation();
            if (e.key === 'Escape') { (e.target as HTMLInputElement).blur(); return; }
            if (e.key === 'Enter') { commitColor((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); }
          }}
          style={{ ...inputSt, flex: 1, fontFamily: 'monospace', minWidth: 0, textTransform: 'uppercase' }}
        />

        {/* Opacity % */}
        {onOpacityPreview && onOpacityCommit && (
          <>
            <input
              type="number" min={0} max={100}
              value={Math.round(localOpacity)}
              onChange={(e) => {
                const n = parseInt(e.target.value);
                if (!isNaN(n)) { setLocalOpacity(n); onOpacityPreview(Math.max(0, Math.min(100, n))); }
              }}
              onBlur={(e) => {
                const n = parseInt(e.target.value);
                if (!isNaN(n)) onOpacityCommit(Math.max(0, Math.min(100, n)));
              }}
              onKeyDown={(e) => {
                const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y');
                if (!isUndo) e.stopPropagation();
                if (e.key === 'Escape' || e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              style={{ ...inputSt, width: 52, textAlign: 'right', paddingRight: 2 }}
            />
            <span style={{ ...labelSt, flexShrink: 0 }}>%</span>
          </>
        )}
      </div>

      {/* Row 2: color swatches (recent + palette) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {swatches.map((hex) => {
          const isActive = hex.toLowerCase() === localColor.toLowerCase();
          return (
            <button
              key={hex}
              title={hex}
              onClick={() => pickColor(hex)}
              style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                background: hex,
                border: isActive
                  ? '2px solid var(--accent)'
                  : '1px solid rgba(255,255,255,0.12)',
                boxShadow: isActive
                  ? '0 0 0 1px rgba(99,102,241,0.4)'
                  : 'inset 0 0 0 1px rgba(0,0,0,0.25)',
                cursor: 'pointer',
                padding: 0,
                transition: 'transform 0.07s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            />
          );
        })}
      </div>

      {/* Row 3: document colors (if available and different from recent) */}
      {docColors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 9, color: 'var(--subtle)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Document
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {docColors.slice(0, 24).map((hex) => {
              const isActive = hex.toLowerCase() === localColor.toLowerCase();
              return (
                <button
                  key={hex}
                  title={hex}
                  onClick={() => pickColor(hex)}
                  style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: hex,
                    border: isActive
                      ? '2px solid var(--accent)'
                      : '1px solid rgba(255,255,255,0.12)',
                    boxShadow: isActive
                      ? '0 0 0 1px rgba(99,102,241,0.4)'
                      : 'inset 0 0 0 1px rgba(0,0,0,0.25)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'transform 0.07s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Eyedropper button ────────────────────────────────────────────────────────

function EyedropperButton({ onPick }: { onPick: (hex: string) => void }) {
  const [active, setActive] = useState(false);

  const activate = useCallback(async () => {
    // EyeDropper API — available in Electron/Chromium
    const ED = (window as unknown as Record<string, unknown>).EyeDropper as
      (new () => { open: () => Promise<{ sRGBHex: string }> }) | undefined;
    if (!ED) return;
    setActive(true);
    try {
      const eyedropper = new ED();
      const { sRGBHex } = await eyedropper.open();
      onPick(sRGBHex);
    } catch {
      // User cancelled
    } finally {
      setActive(false);
    }
  }, [onPick]);

  // Don't render if EyeDropper API not available
  const hasApi = typeof window !== 'undefined' && 'EyeDropper' in window;
  if (!hasApi) return null;

  return (
    <button
      onClick={activate}
      title="Eyedropper — pick color from screen"
      style={{
        background: active ? 'rgba(99,102,241,0.15)' : 'none',
        border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
        borderRadius: 5,
        color: active ? 'var(--accent)' : 'var(--muted)',
        cursor: 'crosshair',
        padding: '3px 5px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; } }}
    >
      {/* Eyedropper icon */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M9.5 1.5 L10.5 2.5 C11 3 11 3.8 10.5 4.3 L9 5.8 L6.2 3 L7.7 1.5 C8.2 1 9 1 9.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
        <path d="M6.2 3 L2.5 6.7 C2 7.2 1.8 8 2 8.7 L1.2 10.5 L3 9.7 C3.7 9.9 4.5 9.7 5 9.2 L8.7 5.5 L6.2 3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
        <circle cx="2.2" cy="9.8" r="0.7" fill="currentColor"/>
      </svg>
    </button>
  );
}

// ── Color swatch (native color picker trigger) ─────────────────────────────

function ColorSwatchInput({
  value, onPreview, onCommit,
}: {
  value: string;
  onPreview: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#e2e8f0';
  // Track whether the color actually changed so we only commit when it did
  const lastCommittedRef = useRef(safeValue);
  // Keep ref in sync when the prop changes (e.g. undo/redo updates value from outside)
  useEffect(() => { lastCommittedRef.current = safeValue; }, [safeValue]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 28, height: 28 }}>
        <input
          type="color"
          value={safeValue}
          onChange={(e) => {
            onPreview(e.target.value);
          }}
          onBlur={(e) => {
            // Only commit if the value actually changed from what was committed before
            if (e.target.value !== lastCommittedRef.current) {
              lastCommittedRef.current = e.target.value;
              onCommit(e.target.value);
            }
          }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', padding: 0, border: 'none',
          }}
        />
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: safeValue,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
        }} />
      </div>
      <EyedropperButton onPick={(hex) => { onPreview(hex); onCommit(hex); }} />
    </div>
  );
}

// ── Collapsible section with + / − button ──────────────────────────────────

function CollapsibleSection({
  label, children, onAdd, onRemove, startCollapsed,
}: {
  label: string;
  children: ReactNode;
  onAdd?: () => void;
  onRemove?: () => void;
  startCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(startCollapsed ?? false);
  const hasContent = !!children && (Array.isArray(children) ? children.some(Boolean) : true);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: hasContent && !collapsed ? '10px 12px 6px' : '10px 12px',
          cursor: startCollapsed !== undefined ? 'pointer' : 'default',
        }}
        onClick={startCollapsed !== undefined ? () => setCollapsed(c => !c) : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {startCollapsed !== undefined && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
              <path d="M1 2.5L4 5.5L7 2.5" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
          <span style={sectionLabelSt}>{label}</span>
        </div>
        {(onAdd || onRemove) && (
          <button
            onClick={(e) => { e.stopPropagation(); (onAdd ?? onRemove)?.(); }}
            style={{
              background: 'none', border: '1px solid transparent', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 14, lineHeight: 1,
              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 5, padding: 0, flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none'; }}
            title={onAdd ? `Add ${label.toLowerCase()}` : `Remove ${label.toLowerCase()}`}
          >
            {onAdd ? '+' : '−'}
          </button>
        )}
      </div>
      {hasContent && !collapsed && (
        <div style={{ padding: '0 12px 12px' }}>{children}</div>
      )}
    </div>
  );
}

// ── Panel section (always visible, optionally collapsible) ────────────────

function PanelSection({ label, children, collapsible, collapsed, onToggle }: {
  label: string;
  children: ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  if (collapsible) {
    return (
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={onToggle}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 12px 8px', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ ...sectionLabelSt, flex: 1, textAlign: 'left' }}>{label}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0, color: 'var(--muted)' }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {!collapsed && (
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {children}
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 12px 12px' }}>
      <div style={{ marginBottom: 8 }}>
        <span style={sectionLabelSt}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

// ── Field box (compact label + number input) ───────────────────────────────

// ── Corner Radius Row ──────────────────────────────────────────────────────

// ── Visual Corner Radius Picker ───────────────────────────────────────────────
/**
 * Shows a mini rectangle diagram with 4 interactive corner handles.
 * Click a corner to select it, then drag the active-corner slider.
 */
function VisualCornerRadiusPicker({
  tl, tr, br, bl,
  onCornerChange,
  onTogglePerCorner,
}: {
  tl: number; tr: number; br: number; bl: number;
  onCornerChange: (idx: number, v: number) => void;
  onTogglePerCorner: () => void;
}) {
  const [activeCorner, setActiveCorner] = useState<0 | 1 | 2 | 3>(0);
  const values = [tl, tr, br, bl];
  const labels = ['Top-left', 'Top-right', 'Bot-right', 'Bot-left'];
  const activeVal = values[activeCorner];
  const maxR = 60;

  // Build the path for a rounded rectangle with per-corner radius
  // We'll render in a 60×40 preview box
  const W = 60, H = 40;
  const scale = 0.4; // scale down big radii for preview
  const r0 = Math.min(tl * scale, W / 2, H / 2);
  const r1 = Math.min(tr * scale, W / 2, H / 2);
  const r2 = Math.min(br * scale, W / 2, H / 2);
  const r3 = Math.min(bl * scale, W / 2, H / 2);
  const previewPath = [
    `M ${r0} 0`,
    `H ${W - r1}`, r1 > 0 ? `Q ${W} 0 ${W} ${r1}` : '',
    `V ${H - r2}`, r2 > 0 ? `Q ${W} ${H} ${W - r2} ${H}` : '',
    `H ${r3}`,     r3 > 0 ? `Q 0 ${H} 0 ${H - r3}` : '',
    `V ${r0}`,     r0 > 0 ? `Q 0 0 ${r0} 0` : '',
    'Z',
  ].join(' ');

  // Corner dot positions [x, y, idx]
  const dotPositions: [number, number, 0 | 1 | 2 | 3][] = [
    [0, 0, 0], [W, 0, 1], [W, H, 2], [0, H, 3],
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={labelSt}>Corner radius</span>
        <button
          onClick={onTogglePerCorner}
          title="Switch to uniform radius"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--accent)', fontSize: 10, fontWeight: 700 }}
        >
          Uniform
        </button>
      </div>

      {/* Visual diagram row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {/* Mini SVG preview */}
        <div style={{
          flexShrink: 0, background: 'var(--panel-alt)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '6px 8px', position: 'relative',
        }}>
          <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
            {/* Shape fill */}
            <path d={previewPath} fill="var(--accent)" fillOpacity={0.15} stroke="var(--accent)" strokeWidth={0.8} />
            {/* Corner hit targets */}
            {dotPositions.map(([cx, cy, idx]) => {
              const isActive = idx === activeCorner;
              // radius indicators: small arcs at each corner
              const rv = values[idx] * scale;
              const clampedRv = Math.min(rv, W / 2, H / 2);
              return (
                <g key={idx}>
                  {/* corner touch target */}
                  <rect
                    x={cx - 8} y={cy - 8} width={16} height={16}
                    fill="transparent" style={{ cursor: 'pointer' }}
                    onClick={() => setActiveCorner(idx)}
                  />
                  {/* dot */}
                  <circle
                    cx={cx} cy={cy} r={isActive ? 3.5 : 2.5}
                    fill={isActive ? 'var(--accent)' : 'var(--muted)'}
                    stroke={isActive ? 'white' : 'none'}
                    strokeWidth={isActive ? 1 : 0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveCorner(idx)}
                  />
                  {/* radius arc indicator */}
                  {clampedRv > 1 && (
                    <g opacity={isActive ? 1 : 0.35}>
                      {idx === 0 && <path d={`M ${clampedRv} 0 Q 0 0 0 ${clampedRv}`} fill="none" stroke="var(--accent)" strokeWidth={1} strokeDasharray={isActive ? 'none' : '2,2'}/>}
                      {idx === 1 && <path d={`M ${W - clampedRv} 0 Q ${W} 0 ${W} ${clampedRv}`} fill="none" stroke="var(--accent)" strokeWidth={1} strokeDasharray={isActive ? 'none' : '2,2'}/>}
                      {idx === 2 && <path d={`M ${W} ${H - clampedRv} Q ${W} ${H} ${W - clampedRv} ${H}`} fill="none" stroke="var(--accent)" strokeWidth={1} strokeDasharray={isActive ? 'none' : '2,2'}/>}
                      {idx === 3 && <path d={`M ${clampedRv} ${H} Q 0 ${H} 0 ${H - clampedRv}`} fill="none" stroke="var(--accent)" strokeWidth={1} strokeDasharray={isActive ? 'none' : '2,2'}/>}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Active corner editor */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 3 }}>
            {labels[activeCorner]}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="range" min={0} max={maxR} step={1} value={activeVal}
              onChange={(e) => onCornerChange(activeCorner, Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <input
              type="number" min={0} max={999} value={activeVal}
              onChange={(e) => onCornerChange(activeCorner, Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: 38, textAlign: 'center', background: 'var(--input-bg)',
                border: '1px solid var(--border)', borderRadius: 4,
                color: 'var(--text)', fontSize: 11, padding: '2px 4px',
              }}
            />
          </div>
          {/* All-corners quick set */}
          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
            {[0, 4, 8, 12, 20, 50].map(v => (
              <button key={v} onClick={() => { [0, 1, 2, 3].forEach(i => onCornerChange(i, v)); }}
                style={{
                  flex: 1, fontSize: 9, padding: '2px 0', cursor: 'pointer', fontWeight: 600,
                  background: values.every(x => x === v) ? 'var(--accent)' : 'var(--panel-alt)',
                  border: `1px solid ${values.every(x => x === v) ? 'var(--accent)' : 'var(--border)'}`,
                  color: values.every(x => x === v) ? '#fff' : 'var(--muted)',
                  borderRadius: 3,
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* All 4 corner values as compact mini-inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
        {dotPositions.map(([, , idx]) => (
          <button
            key={idx}
            onClick={() => setActiveCorner(idx)}
            style={{
              background: activeCorner === idx ? 'rgba(99,102,241,0.12)' : 'var(--panel-alt)',
              border: `1px solid ${activeCorner === idx ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 4, padding: '3px 4px', cursor: 'pointer', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 8, color: activeCorner === idx ? 'var(--accent)' : 'var(--subtle)', fontWeight: 700, letterSpacing: '0.03em' }}>
              {['TL', 'TR', 'BR', 'BL'][idx]}
            </div>
            <div style={{ fontSize: 11, color: activeCorner === idx ? 'var(--text)' : 'var(--muted)', fontWeight: 600 }}>
              {values[idx]}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CornerRadiusRow({ shape, onPreview, onChange }: {
  shape: Shape;
  onPreview: (patch: Partial<Shape>) => void;
  onChange: (patch: Partial<Shape>) => void;
}) {
  // Derive per-corner mode from the stored value: if it's a tuple with unequal values, use per-corner mode
  const [tl, tr, br, bl] = normalizeRadius(shape.borderRadius);
  const isUniform = tl === tr && tr === br && br === bl;
  const perCorner = Array.isArray(shape.borderRadius) && !isUniform;

  const uniformValue = isUniform ? tl : Math.max(tl, tr, br, bl);

  const corners: [string, number, number][] = [
    ['TL', tl, 0],
    ['TR', tr, 1],
    ['BR', br, 2],
    ['BL', bl, 3],
  ];

  const handleCornerChange = (cornerIndex: number, v: number) => {
    const next: [number, number, number, number] = [tl, tr, br, bl];
    next[cornerIndex] = v;
    // If all equal after this change, collapse back to scalar
    const [a, b, c, d] = next;
    const allEqual = a === b && b === c && c === d;
    onPreview({ borderRadius: allEqual ? a : next });
    onChange({ borderRadius: allEqual ? a : next });
  };

  const handleTogglePerCorner = () => {
    if (perCorner) {
      // Collapse to uniform (use max of current values)
      onChange({ borderRadius: uniformValue });
    } else {
      // Expand to per-corner (all same as current uniform)
      onChange({ borderRadius: [uniformValue, uniformValue, uniformValue, uniformValue] });
    }
  };

  if (perCorner) {
    return (
      <VisualCornerRadiusPicker
        tl={tl} tr={tr} br={br} bl={bl}
        onCornerChange={handleCornerChange}
        onTogglePerCorner={handleTogglePerCorner}
      />
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
      <div style={{ flex: 1 }}>
        <FieldBox
          label="Corner radius"
          value={uniformValue}
          min={0}
          onPreview={(v) => onPreview({ borderRadius: v })}
          onCommit={(v) => onChange({ borderRadius: v })}
        />
      </div>
      <button
        onClick={handleTogglePerCorner}
        title="Set each corner individually"
        style={{
          width: 28, height: 28, flexShrink: 0, marginBottom: 1,
          background: 'var(--input-bg)', border: '1px solid var(--border)',
          borderRadius: 5, cursor: 'pointer', color: 'var(--muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="8" y="1" width="5" height="5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="1" y="8" width="5" height="5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="8" y="8" width="5" height="5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      </button>
    </div>
  );
}

function CornerInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(String(Math.round(value)));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setLocal(String(Math.round(value))); }, [value, focused]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={labelSt}>{label}</span>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--input-bg)', border: '1px solid var(--border)',
        borderRadius: 5, overflow: 'hidden',
        ...(focused ? { borderColor: 'var(--accent)', outline: '1px solid rgba(99,102,241,0.3)' } : {}),
      }}>
        <input
          type="number" value={local} min={0}
          style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, padding: '5px 6px', outline: 'none', width: 0, minWidth: 0 }}
          onFocus={(e) => { setFocused(true); e.target.select(); }}
          onBlur={() => { setFocused(false); const n = Math.max(0, parseFloat(local) || 0); setLocal(String(n)); onChange(n); }}
          onChange={(e) => { setLocal(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(Math.max(0, n)); }}
          onKeyDown={(e) => {
            const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y');
            if (!isUndo) e.stopPropagation();
            if (e.key === 'Escape' || e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
    </div>
  );
}

function FieldBox({ label, value, min, onPreview, onCommit }: {
  label: string;
  value: number;
  min?: number;
  onPreview: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(Math.round(value)));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setLocal(String(Math.round(value))); }, [value, focused]);

  const clamp = (n: number) => min !== undefined ? Math.max(min, n) : n;

  const commit = (raw: string) => {
    let n = parseFloat(raw);
    if (isNaN(n)) n = value;
    n = clamp(n);
    setLocal(String(Math.round(n)));
    onCommit(n);
  };

  const step = (delta: number) => {
    const n = clamp(Math.round(parseFloat(local || '0') + delta));
    setLocal(String(n));
    onPreview(n);
    onCommit(n);
  };

  const stepBtnSt: React.CSSProperties = {
    flexShrink: 0,
    width: 28,
    height: 18,
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    userSelect: 'none',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      {label && <span style={labelSt}>{label}</span>}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        background: 'var(--input-bg)', border: '1px solid var(--border)',
        borderRadius: 5, overflow: 'hidden',
        ...(focused ? { borderColor: 'var(--accent)', outline: '1px solid rgba(99,102,241,0.3)' } : {}),
      }}>
        <input
          type="number"
          value={local}
          min={min}
          onChange={(e) => {
            setLocal(e.target.value);
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) onPreview(clamp(n));
          }}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { setFocused(false); commit(e.target.value); }}
          onKeyDown={(e) => {
            const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y');
            if (!isUndo) e.stopPropagation();
            if (e.key === 'Escape') { (e.target as HTMLInputElement).blur(); return; }
            if (e.key === 'Enter') { commit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); return; }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              step((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
            }
          }}
          onWheel={(e) => {
            e.preventDefault();
            step(e.deltaY < 0 ? 1 : -1);
          }}
          style={{
            flex: 1, width: '100%', background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 12, padding: '6px 6px', minWidth: 0, alignSelf: 'center',
          }}
        />
        {/* Stepper buttons — larger hit targets than native browser spinners */}
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, alignSelf: 'stretch', borderLeft: '1px solid var(--border)' }}>
          <button
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); step(1); }}
            style={{ ...stepBtnSt, flex: 1, borderBottom: '1px solid var(--border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
            title="Increase (scroll to adjust)"
          >▲</button>
          <button
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); step(-1); }}
            style={{ ...stepBtnSt, flex: 1 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
            title="Decrease (scroll to adjust)"
          >▼</button>
        </div>
      </div>
    </div>
  );
}

// ── Icon button ────────────────────────────────────────────────────────────

function IconBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title?: string; children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'rgba(99,102,241,0.15)' : 'var(--input-bg)',
        color: active ? 'var(--accent)' : 'var(--muted)',
        borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700,
        transition: 'all 0.1s',
      }}
    >{children}</button>
  );
}

// ── Name input (header) ────────────────────────────────────────────────────

function NameInput({ value, onPreview, onCommit }: { value: string; onPreview: (v: string) => void; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setLocal(value); }, [value, focused]);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => { setLocal(e.target.value); onPreview(e.target.value); }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { setFocused(false); onCommit(e.target.value); }}
      onKeyDown={(e) => {
        const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y');
        if (!isUndo) e.stopPropagation();
        if (e.key === 'Escape') { (e.target as HTMLInputElement).blur(); return; }
        if (e.key === 'Enter') { onCommit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); }
      }}
      style={{
        flex: 1, fontSize: 13, fontWeight: 500,
        background: focused ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: 'var(--text)', border: focused ? '1px solid var(--border)' : '1px solid transparent',
        outline: 'none', padding: '2px 4px', borderRadius: 4, minWidth: 0,
        transition: 'background 0.1s, border-color 0.1s',
      }}
    />
  );
}

// ── Document Colors ────────────────────────────────────────────────────────

// ── Color Harmony generator ─────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const hN = ((h % 360) + 360) % 360;
  const sN = Math.max(0, Math.min(100, s)) / 100;
  const lN = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((hN / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if (hN < 60) { r = c; g = x; }
  else if (hN < 120) { r = x; g = c; }
  else if (hN < 180) { g = c; b = x; }
  else if (hN < 240) { g = x; b = c; }
  else if (hN < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ColorHarmony({ baseColor, onPick }: { baseColor: string; onPick: (color: string) => void }) {
  const [hue, sat, lig] = hexToHsl(baseColor);

  const harmonies: { label: string; colors: string[] }[] = [
    {
      label: 'Complementary',
      colors: [
        hslToHex(hue + 180, sat, lig),
        hslToHex(hue + 180, sat, Math.min(lig + 15, 90)),
        hslToHex(hue + 180, Math.max(sat - 15, 10), lig),
      ],
    },
    {
      label: 'Analogous',
      colors: [
        hslToHex(hue - 30, sat, lig),
        hslToHex(hue - 15, sat, lig),
        hslToHex(hue + 15, sat, lig),
        hslToHex(hue + 30, sat, lig),
      ],
    },
    {
      label: 'Triadic',
      colors: [
        hslToHex(hue + 120, sat, lig),
        hslToHex(hue + 240, sat, lig),
      ],
    },
    {
      label: 'Shades',
      colors: [
        hslToHex(hue, sat, Math.max(lig - 30, 5)),
        hslToHex(hue, sat, Math.max(lig - 15, 5)),
        hslToHex(hue, sat, Math.min(lig + 15, 95)),
        hslToHex(hue, sat, Math.min(lig + 30, 95)),
      ],
    },
  ];

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
        Harmony
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {harmonies.map(({ label, colors }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--subtle)', width: 68, flexShrink: 0 }}>{label}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {colors.map(c => (
                <button
                  key={c}
                  title={c}
                  onClick={() => onPick(c)}
                  style={{
                    width: 18, height: 18, borderRadius: 3, border: '1px solid rgba(255,255,255,0.12)',
                    background: c, cursor: 'pointer', padding: 0, flexShrink: 0,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset',
                    transition: 'transform 0.08s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.25)'; e.currentTarget.style.zIndex = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '0'; }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocColors({ shapes, onPick }: { shapes: Shape[]; onPick: (color: string) => void }) {
  // Extract unique solid fills and strokes, filtering out transparent
  const colors = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of shapes) {
      for (const c of [s.fill, s.stroke, s.color]) {
        if (c && c !== 'transparent' && /^#[0-9a-fA-F]{6}$/.test(c)) {
          const normalized = c.toLowerCase();
          if (!seen.has(normalized)) { seen.add(normalized); out.push(normalized); }
        }
      }
      // Gradient stops
      if (s.fillType === 'linear-gradient' || s.fillType === 'radial-gradient') {
        for (const st of s.gradientStops ?? []) {
          const normalized = st.color.toLowerCase();
          if (!seen.has(normalized)) { seen.add(normalized); out.push(normalized); }
        }
      }
    }
    return out.slice(0, 24); // max 24
  }, [shapes]);

  if (colors.length === 0) return null;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
        Document
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {colors.map(c => (
          <button
            key={c}
            title={c}
            onClick={() => onPick(c)}
            style={{
              width: 18, height: 18, borderRadius: 3, border: '1px solid rgba(255,255,255,0.12)',
              background: c, cursor: 'pointer', padding: 0, flexShrink: 0,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset',
              transition: 'transform 0.08s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.zIndex = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '0'; }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────

const labelSt: CSSProperties = { fontSize: 11, color: 'var(--muted)', fontWeight: 500, flexShrink: 0 };

const sectionLabelSt: CSSProperties = {
  fontSize: 10, color: 'var(--text)', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.10em',
  opacity: 0.65,
};

const inputSt: CSSProperties = {
  fontSize: 12, background: 'var(--input-bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 5,
  padding: '5px 7px', outline: 'none', boxSizing: 'border-box', width: '100%',
};

const selectSt: CSSProperties = {
  ...inputSt,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 7px center',
  paddingRight: 24,
};

// ── Gradient Presets ──────────────────────────────────────────────────────────

interface GradientPreset {
  name: string;
  stops: GradientStop[];
  angle: number;
}

const GRADIENT_PRESETS: GradientPreset[] = [
  // Vibrant
  { name: 'Aurora',    stops: [{ color: '#06b6d4', position: 0 }, { color: '#8b5cf6', position: 0.5 }, { color: '#ec4899', position: 1 }], angle: 135 },
  { name: 'Sunset',   stops: [{ color: '#f97316', position: 0 }, { color: '#ef4444', position: 0.5 }, { color: '#a855f7', position: 1 }], angle: 135 },
  { name: 'Ocean',    stops: [{ color: '#0ea5e9', position: 0 }, { color: '#06b6d4', position: 0.5 }, { color: '#14b8a6', position: 1 }], angle: 180 },
  { name: 'Lime',     stops: [{ color: '#84cc16', position: 0 }, { color: '#22c55e', position: 1 }], angle: 135 },
  { name: 'Rose',     stops: [{ color: '#f43f5e', position: 0 }, { color: '#ec4899', position: 1 }], angle: 135 },
  { name: 'Indigo',   stops: [{ color: '#6366f1', position: 0 }, { color: '#818cf8', position: 1 }], angle: 135 },
  // Muted
  { name: 'Slate',    stops: [{ color: '#64748b', position: 0 }, { color: '#94a3b8', position: 1 }], angle: 135 },
  { name: 'Stone',    stops: [{ color: '#78716c', position: 0 }, { color: '#d6d3d1', position: 1 }], angle: 135 },
  // Dark
  { name: 'Night',    stops: [{ color: '#0f172a', position: 0 }, { color: '#1e293b', position: 1 }], angle: 135 },
  { name: 'Charcoal', stops: [{ color: '#111111', position: 0 }, { color: '#374151', position: 1 }], angle: 135 },
  // Brand
  { name: 'Brand',    stops: [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }], angle: 135 },
  { name: 'Candy',    stops: [{ color: '#f472b6', position: 0 }, { color: '#fb7185', position: 0.5 }, { color: '#fbbf24', position: 1 }], angle: 90 },
  // Nature
  { name: 'Forest',   stops: [{ color: '#166534', position: 0 }, { color: '#4ade80', position: 1 }], angle: 135 },
  { name: 'Desert',   stops: [{ color: '#b45309', position: 0 }, { color: '#fbbf24', position: 1 }], angle: 135 },
  { name: 'Arctic',   stops: [{ color: '#bae6fd', position: 0 }, { color: '#e0f2fe', position: 1 }], angle: 180 },
  // Glass
  { name: 'Glass',    stops: [{ color: '#ffffff', position: 0, opacity: 0.15 }, { color: '#ffffff', position: 1, opacity: 0.05 }], angle: 135 },
  { name: 'Midnight', stops: [{ color: '#1e1b4b', position: 0 }, { color: '#312e81', position: 1 }], angle: 135 },
  { name: 'Heatmap',  stops: [{ color: '#fef08a', position: 0 }, { color: '#f97316', position: 0.5 }, { color: '#be123c', position: 1 }], angle: 90 },
];

function GradientPresets({
  type,
  onApply,
}: {
  type: 'linear-gradient' | 'radial-gradient';
  onApply: (stops: GradientStop[], angle: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const buildCss = (preset: GradientPreset, t: 'linear-gradient' | 'radial-gradient') => {
    const stops = preset.stops
      .map(s => {
        const hex = s.color;
        const op = s.opacity ?? 1;
        const color = op < 1 ? `${hex}${Math.round(op * 255).toString(16).padStart(2, '0')}` : hex;
        return `${color} ${Math.round(s.position * 100)}%`;
      })
      .join(', ');
    return t === 'radial-gradient'
      ? `radial-gradient(circle, ${stops})`
      : `linear-gradient(${preset.angle}deg, ${stops})`;
  };

  return (
    <div style={{ marginTop: 4 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', fontSize: 10, padding: '2px 0',
          fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}
      >
        <span style={{ fontSize: 8, opacity: 0.7 }}>{expanded ? '▾' : '▸'}</span>
        Presets
      </button>
      {expanded && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginTop: 6,
        }}>
          {GRADIENT_PRESETS.map(preset => (
            <button
              key={preset.name}
              title={preset.name}
              onClick={() => onApply(preset.stops, preset.angle)}
              style={{
                height: 24, borderRadius: 5, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)',
                background: buildCss(preset, type),
                padding: 0,
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
