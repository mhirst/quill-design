import React, { useEffect, useState, useCallback, useRef, type ReactNode, type CSSProperties } from 'react';
import type { Shape, GradientStop } from '../../lib/shapes';
import { normalizeRadius } from '../../lib/shapes';
import { GradientEditor } from './GradientEditor';
import { GOOGLE_FONTS, SYSTEM_FONTS, CATEGORY_LABELS, type GoogleFont } from '../../lib/googleFonts';
import { loadGoogleFont } from '../../hooks/useFontLoader';

interface Props {
  shape: Shape;
  onPreview: (patch: Partial<Shape>) => void;
  onChange: (patch: Partial<Shape>) => void;
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function ShapeInspectPanel({ shape, onPreview, onChange }: Props) {
  const isText = shape.type === 'text';
  const isFrame = shape.type === 'frame';
  const isPath = shape.type === 'path';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      background: 'var(--panel)', borderLeft: '1px solid var(--border)',
      fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 8, borderBottom: '1px solid var(--border)',
      }}>
        <TypeBadge type={shape.type} />
        <NameInput
          value={shape.name}
          onPreview={(v) => onPreview({ name: v })}
          onCommit={(v) => onChange({ name: v })}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Position & Size ── */}
        {!isPath && (
          <PanelSection label="Position">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <FieldBox label="X" value={shape.x}
                  onPreview={(v) => onPreview({ x: v })} onCommit={(v) => onChange({ x: v })} />
                <FieldBox label="Y" value={shape.y}
                  onPreview={(v) => onPreview({ y: v })} onCommit={(v) => onChange({ y: v })} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <FieldBox label="W" value={shape.width} min={8}
                  onPreview={(v) => onPreview({ width: v })} onCommit={(v) => onChange({ width: v })} />
                <FieldBox label="H" value={shape.height} min={8}
                  onPreview={(v) => onPreview({ height: v })} onCommit={(v) => onChange({ height: v })} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <FieldBox label="R°" value={Math.round(shape.rotation)}
                  onPreview={(v) => onPreview({ rotation: ((v % 360) + 360) % 360 })}
                  onCommit={(v) => onChange({ rotation: ((v % 360) + 360) % 360 })} />
              </div>
              {!isText && shape.type !== 'ellipse' && (
                <CornerRadiusRow shape={shape} onPreview={onPreview} onChange={onChange} />
              )}
            </div>
          </PanelSection>
        )}

        {/* ── Auto Layout (frames + rectangles) ── */}
        {(isFrame || shape.type === 'rectangle') && (
          <AutoLayoutSection shape={shape} onPreview={onPreview} onChange={onChange} />
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
        </PanelSection>

        {/* ── Fill ── */}
        {!isText && !isPath && (
          <FillSection shape={shape} onPreview={onPreview} onChange={onChange} />
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

        {/* ── Typography ── */}
        {isText && (
          <TypographySection shape={shape} onPreview={onPreview} onChange={onChange} />
        )}

      </div>
    </div>
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

type FillType = 'solid' | 'linear-gradient' | 'radial-gradient';

function FillSection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  const fillType: FillType = (shape.fillType as FillType) ?? 'solid';
  const hasFill = fillType !== 'solid' || shape.fill !== 'transparent';
  const stops: GradientStop[] = shape.gradientStops ?? [{ color: '#6366f1', position: 0 }, { color: '#a855f7', position: 1 }];
  const angle = shape.gradientAngle ?? 135;

  const FILL_TYPES: { id: FillType; label: string; title: string }[] = [
    { id: 'solid', label: '■', title: 'Solid' },
    { id: 'linear-gradient', label: '▦', title: 'Linear gradient' },
    { id: 'radial-gradient', label: '◎', title: 'Radial gradient' },
  ];

  return (
    <CollapsibleSection
      label="Fill"
      onAdd={!hasFill ? () => { onPreview({ fill: '#e2e8f0', fillType: 'solid' }); onChange({ fill: '#e2e8f0', fillType: 'solid' }); } : undefined}
      onRemove={hasFill ? () => { onPreview({ fill: 'transparent', fillType: 'solid' }); onChange({ fill: 'transparent', fillType: 'solid' }); } : undefined}
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
            <ColorRow
              color={shape.fill}
              opacity={Math.round(shape.fillOpacity * 100)}
              onColorPreview={(v) => onPreview({ fill: v })}
              onColorCommit={(v) => onChange({ fill: v })}
              onOpacityPreview={(v) => onPreview({ fillOpacity: v / 100 })}
              onOpacityCommit={(v) => onChange({ fillOpacity: v / 100 })}
            />
          )}

          {/* Gradient editor */}
          {(fillType === 'linear-gradient' || fillType === 'radial-gradient') && (
            <GradientEditor
              type={fillType}
              stops={stops}
              angle={angle}
              onPreview={(s, a) => onPreview({ gradientStops: s, gradientAngle: a })}
              onChange={(s, a) => onChange({ gradientStops: s, gradientAngle: a })}
            />
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Stroke section ─────────────────────────────────────────────────────────

function StrokeSection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  const hasStroke = shape.stroke !== 'transparent' && shape.strokeWidth > 0;

  return (
    <CollapsibleSection
      label="Stroke"
      onAdd={!hasStroke ? () => { onPreview({ stroke: '#6366f1', strokeWidth: 1 }); onChange({ stroke: '#6366f1', strokeWidth: 1 }); } : undefined}
      onRemove={hasStroke ? () => { onPreview({ stroke: 'transparent', strokeWidth: 0 }); onChange({ stroke: 'transparent', strokeWidth: 0 }); } : undefined}
    >
      {hasStroke && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ColorRow
            color={shape.stroke === 'transparent' ? '#6366f1' : shape.stroke}
            opacity={100}
            onColorPreview={(v) => onPreview({ stroke: v })}
            onColorCommit={(v) => onChange({ stroke: v })}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelSt}>Width</span>
            <FieldBox label="" value={shape.strokeWidth} min={1}
              onPreview={(v) => onPreview({ strokeWidth: v })}
              onCommit={(v) => onChange({ strokeWidth: v })} />
            <span style={labelSt}>px</span>
          </div>
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

function ShadowSection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  const getShadowColor = () =>
    /^#[0-9a-fA-F]{6}/.test(shape.shadowColor) ? shape.shadowColor.slice(0, 7) : '#000000';
  const getShadowAlpha = () =>
    Math.round((parseInt(shape.shadowColor.slice(7, 9) || '66', 16) / 255) * 100);

  return (
    <CollapsibleSection
      label="Effects"
      onAdd={!shape.shadow ? () => { onPreview({ shadow: true }); onChange({ shadow: true }); } : undefined}
      onRemove={shape.shadow ? () => { onPreview({ shadow: false }); onChange({ shadow: false }); } : undefined}
    >
      {shape.shadow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Color + opacity row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <ColorSwatchInput
              value={getShadowColor()}
              onPreview={(v) => {
                const alpha = shape.shadowColor.length === 9 ? shape.shadowColor.slice(7) : '66';
                onPreview({ shadowColor: v + alpha });
              }}
              onCommit={(v) => {
                const alpha = shape.shadowColor.length === 9 ? shape.shadowColor.slice(7) : '66';
                onChange({ shadowColor: v + alpha });
              }}
            />
            <span style={{ ...labelSt, flex: 1, color: 'var(--text)' }}>Drop shadow</span>
            <FieldBox
              label=""
              value={getShadowAlpha()}
              min={0}
              onPreview={(n) => {
                const alpha = Math.round(Math.max(0, Math.min(100, n)) / 100 * 255).toString(16).padStart(2, '0');
                onPreview({ shadowColor: getShadowColor() + alpha });
              }}
              onCommit={(n) => {
                const alpha = Math.round(Math.max(0, Math.min(100, n)) / 100 * 255).toString(16).padStart(2, '0');
                onChange({ shadowColor: getShadowColor() + alpha });
              }}
            />
            <span style={labelSt}>%</span>
          </div>
          {/* Offset + blur row */}
          <div style={{ display: 'flex', gap: 6 }}>
            <FieldBox label="X" value={shape.shadowX}
              onPreview={(v) => onPreview({ shadowX: v })} onCommit={(v) => onChange({ shadowX: v })} />
            <FieldBox label="Y" value={shape.shadowY}
              onPreview={(v) => onPreview({ shadowY: v })} onCommit={(v) => onChange({ shadowY: v })} />
            <FieldBox label="Blur" value={shape.shadowBlur} min={0}
              onPreview={(v) => onPreview({ shadowBlur: v })} onCommit={(v) => onChange({ shadowBlur: v })} />
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Typography section ─────────────────────────────────────────────────────

function TypographySection({ shape, onPreview, onChange }: { shape: Shape; onPreview: (p: Partial<Shape>) => void; onChange: (p: Partial<Shape>) => void }) {
  return (
    <PanelSection label="Typography">

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

            {filteredSystem.length === 0 && filteredGoogle.length === 0 && (
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
      onMouseEnter={onHover}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '6px 10px',
        background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text)',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => e.preventDefault()} // prevent blur on search input
    >
      {label}
    </button>
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

// ── Color row (swatch + hex + opacity%) ───────────────────────────────────

function ColorRow({
  color, opacity,
  onColorPreview, onColorCommit,
  onOpacityPreview, onOpacityCommit,
}: {
  color: string;
  opacity: number;
  onColorPreview: (v: string) => void;
  onColorCommit: (v: string) => void;
  onOpacityPreview?: (v: number) => void;
  onOpacityCommit?: (v: number) => void;
}) {
  const [localColor, setLocalColor] = useState(color);
  const [localOpacity, setLocalOpacity] = useState(opacity);

  useEffect(() => { setLocalColor(color); }, [color]);
  useEffect(() => { setLocalOpacity(opacity); }, [opacity]);

  const commitColor = useCallback((raw: string) => {
    const v = raw.startsWith('#') ? raw : '#' + raw;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { setLocalColor(v); onColorCommit(v); }
    else setLocalColor(color);
  }, [color, onColorCommit]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* Color swatch (native picker) */}
      <ColorSwatchInput value={localColor} onPreview={onColorPreview} onCommit={onColorCommit} />

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
  );
}

// ── Collapsible section with + / − button ──────────────────────────────────

function CollapsibleSection({
  label, children, onAdd, onRemove,
}: {
  label: string;
  children: ReactNode;
  onAdd?: () => void;
  onRemove?: () => void;
}) {
  const hasContent = !!children && (Array.isArray(children) ? children.some(Boolean) : true);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: hasContent ? '10px 12px 6px' : '10px 12px',
      }}>
        <span style={sectionLabelSt}>{label}</span>
        <button
          onClick={onAdd ?? onRemove}
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
      </div>
      {hasContent && (
        <div style={{ padding: '0 12px 12px' }}>{children}</div>
      )}
    </div>
  );
}

// ── Panel section (always visible) ────────────────────────────────────────

function PanelSection({ label, children }: { label: string; children: ReactNode }) {
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
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={labelSt}>Corner radius</span>
          <button
            onClick={handleTogglePerCorner}
            title="Switch to uniform radius"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--accent)', display: 'flex' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="8" y="1" width="5" height="5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="1" y="8" width="5" height="5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="8" y="8" width="5" height="5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {corners.map(([lbl, val, idx]) => (
            <CornerInput key={lbl} label={lbl} value={val}
              onChange={(v) => handleCornerChange(idx, v)}
            />
          ))}
        </div>
      </div>
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
