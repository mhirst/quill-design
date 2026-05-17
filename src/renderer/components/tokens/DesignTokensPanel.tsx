/**
 * Design Tokens Panel
 *
 * Extracts all colors, font sizes, and border-radius values used across shapes
 * and presents them as a browsable token library. Click any token to copy it,
 * or drag it onto a selected shape to apply.
 */
import { useMemo, useState, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

interface TokenBase {
  value: string;
  count: number; // how many shapes use this
  shapeIds: string[];
}

interface ColorToken extends TokenBase {
  kind: 'color';
  role: 'fill' | 'stroke' | 'text';
}

interface FontToken extends TokenBase {
  kind: 'font';
  role: 'size' | 'family' | 'weight';
}

interface RadiusToken extends TokenBase {
  kind: 'radius';
}

type Token = ColorToken | FontToken | RadiusToken;

function extractTokens(shapes: Shape[]): Token[] {
  const colorMap = new Map<string, { count: number; shapeIds: string[]; role: 'fill' | 'stroke' | 'text' }>();
  const fontSizeMap = new Map<string, { count: number; shapeIds: string[] }>();
  const fontFamilyMap = new Map<string, { count: number; shapeIds: string[] }>();
  const radiusMap = new Map<string, { count: number; shapeIds: string[] }>();

  const addColor = (val: string, id: string, role: 'fill' | 'stroke' | 'text') => {
    if (!val || val === 'transparent' || val.startsWith('linear-gradient') || val.startsWith('radial-gradient')) return;
    // normalize hex to lowercase
    const norm = val.toLowerCase().trim();
    const existing = colorMap.get(norm);
    if (existing) {
      existing.count++;
      if (!existing.shapeIds.includes(id)) existing.shapeIds.push(id);
    } else {
      colorMap.set(norm, { count: 1, shapeIds: [id], role });
    }
  };

  for (const s of shapes) {
    // Fill colors
    if (s.fill) addColor(s.fill, s.id, 'fill');
    if (s.stroke && s.stroke !== 'transparent') addColor(s.stroke, s.id, 'stroke');

    // Text colors + font properties
    if (s.type === 'text') {
      const t = s as any;
      if (t.color) addColor(t.color, s.id, 'text');
      if (t.fontSize) {
        const key = `${Math.round(t.fontSize)}px`;
        const ex = fontSizeMap.get(key);
        if (ex) { ex.count++; ex.shapeIds.push(s.id); }
        else fontSizeMap.set(key, { count: 1, shapeIds: [s.id] });
      }
      if (t.fontFamily) {
        const key = String(t.fontFamily);
        const ex = fontFamilyMap.get(key);
        if (ex) { ex.count++; ex.shapeIds.push(s.id); }
        else fontFamilyMap.set(key, { count: 1, shapeIds: [s.id] });
      }
    }

    // Border radius
    const r = (s as any).cornerRadius ?? (s as any).borderRadius;
    if (r && r > 0) {
      const key = `${Math.round(r)}px`;
      const ex = radiusMap.get(key);
      if (ex) { ex.count++; ex.shapeIds.push(s.id); }
      else radiusMap.set(key, { count: 1, shapeIds: [s.id] });
    }
  }

  const tokens: Token[] = [];

  // Colors — sort by count desc
  for (const [value, data] of colorMap) {
    tokens.push({ kind: 'color', value, count: data.count, shapeIds: data.shapeIds, role: data.role });
  }

  // Font sizes
  for (const [value, data] of fontSizeMap) {
    tokens.push({ kind: 'font', value, count: data.count, shapeIds: data.shapeIds, role: 'size' });
  }

  // Font families
  for (const [value, data] of fontFamilyMap) {
    tokens.push({ kind: 'font', value, count: data.count, shapeIds: data.shapeIds, role: 'family' });
  }

  // Border radius
  for (const [value, data] of radiusMap) {
    tokens.push({ kind: 'radius', value, count: data.count, shapeIds: data.shapeIds });
  }

  // Sort each group by count
  return tokens.sort((a, b) => b.count - a.count);
}

function isValidCSSColor(str: string): boolean {
  if (str.startsWith('#') || str.startsWith('rgb') || str.startsWith('hsl') || str.startsWith('oklch')) return true;
  const named = ['red', 'blue', 'green', 'white', 'black', 'transparent'];
  return named.includes(str.toLowerCase());
}

// A little pill/chip for each token
function TokenChip({
  token,
  onCopy,
  onSelectShapes,
  copiedValue,
}: {
  token: Token;
  onCopy: (val: string) => void;
  onSelectShapes: (ids: string[]) => void;
  copiedValue: string | null;
}) {
  const isCopied = copiedValue === token.value;

  return (
    <div
      title={`${token.value} — used ${token.count} time${token.count === 1 ? '' : 's'}\nClick to copy • Double-click to select layers`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        borderRadius: 6,
        cursor: 'pointer',
        background: isCopied ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isCopied ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
        transition: 'all 0.12s',
        userSelect: 'none',
        minWidth: 0,
      }}
      onClick={() => onCopy(token.value)}
      onDoubleClick={() => onSelectShapes(token.shapeIds)}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isCopied ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)'; }}
    >
      {token.kind === 'color' && isValidCSSColor(token.value) && (
        <span style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          background: token.value,
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)',
        }} />
      )}
      {token.kind === 'font' && (
        <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, fontFamily: 'monospace' }}>
          {token.role === 'size' ? 'Aa' : token.role === 'family' ? 'F' : 'B'}
        </span>
      )}
      {token.kind === 'radius' && (
        <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>⌒</span>
      )}
      <span style={{
        fontSize: 11,
        fontFamily: 'monospace',
        color: 'var(--text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        minWidth: 0,
      }}>
        {isCopied ? '✓ copied' : token.value}
      </span>
      <span style={{
        fontSize: 10,
        color: 'var(--muted)',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
        padding: '1px 4px',
        borderRadius: 3,
      }}>
        ×{token.count}
      </span>
    </div>
  );
}

// Color palette grid view
function ColorPaletteGrid({
  tokens,
  onCopy,
  onSelectShapes,
  copiedValue,
}: {
  tokens: ColorToken[];
  onCopy: (val: string) => void;
  onSelectShapes: (ids: string[]) => void;
  copiedValue: string | null;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 12px 8px' }}>
      {tokens.map((t) => (
        <div
          key={t.value}
          title={`${t.value} (×${t.count})\nClick to copy • Double-click to select layers`}
          style={{
            width: 28, height: 28,
            borderRadius: 5,
            background: t.value,
            border: `2px solid ${copiedValue === t.value ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'transform 0.1s, border-color 0.1s',
          }}
          onClick={() => onCopy(t.value)}
          onDoubleClick={() => onSelectShapes(t.shapeIds)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        />
      ))}
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────
interface Props {
  shapes: Shape[];
  onSelectShapes: (ids: string[]) => void;
  selectedShapeId?: string | null;
  selectedShapeIds?: string[];
  onApplyToken?: (token: Token, targetIds: string[]) => void;
}

// Build a safe CSS variable name from a value
function toCSSVarName(kind: string, role: string, value: string, idx: number): string {
  // For colors: --color-1, --color-fill-1 etc.
  // For font-size: --font-size-1
  if (kind === 'color') return `--color-${role}-${idx + 1}`;
  if (kind === 'font' && role === 'size') return `--font-size-${idx + 1}`;
  if (kind === 'font' && role === 'family') return `--font-family-${idx + 1}`;
  if (kind === 'radius') return `--radius-${idx + 1}`;
  return `--token-${idx + 1}`;
}

function generateCSSVars(tokens: Token[]): string {
  const lines: string[] = [':root {'];
  const counters: Record<string, number> = {};
  for (const t of tokens) {
    const key = `${t.kind}-${(t as any).role ?? ''}`;
    counters[key] = (counters[key] ?? 0);
    const name = toCSSVarName(t.kind, (t as any).role ?? '', t.value, counters[key]);
    counters[key]++;
    lines.push(`  ${name}: ${t.value};`);
  }
  lines.push('}');
  return lines.join('\n');
}

function generateJSON(tokens: Token[]): string {
  const out: Record<string, Record<string, string>> = {};
  const counters: Record<string, number> = {};
  for (const t of tokens) {
    const section = t.kind === 'color' ? 'colors' : t.kind === 'font' ? `typography.${(t as any).role}` : 'radius';
    if (!out[section]) out[section] = {};
    const key = `${t.kind}-${(t as any).role ?? ''}-`;
    counters[key] = (counters[key] ?? 0);
    out[section][`token-${counters[key]++}`] = t.value;
  }
  return JSON.stringify(out, null, 2);
}

export function DesignTokensPanel({ shapes, onSelectShapes }: Props) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [colorView, setColorView] = useState<'list' | 'palette'>('palette');
  const [activeSection, setActiveSection] = useState<'all' | 'colors' | 'typography' | 'radius'>('all');
  const [exportCopied, setExportCopied] = useState<'css' | 'json' | null>(null);

  const tokens = useMemo(() => extractTokens(shapes), [shapes]);

  const colors = tokens.filter((t): t is ColorToken => t.kind === 'color');
  const fonts = tokens.filter((t): t is FontToken => t.kind === 'font');
  const radii = tokens.filter((t): t is RadiusToken => t.kind === 'radius');

  const handleCopy = useCallback((val: string) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopiedValue(val);
    setTimeout(() => setCopiedValue(null), 1500);
  }, []);

  const handleExportCSS = useCallback(() => {
    const css = generateCSSVars(tokens);
    navigator.clipboard.writeText(css).catch(() => {});
    setExportCopied('css');
    setTimeout(() => setExportCopied(null), 2000);
  }, [tokens]);

  const handleExportJSON = useCallback(() => {
    const json = generateJSON(tokens);
    navigator.clipboard.writeText(json).catch(() => {});
    setExportCopied('json');
    setTimeout(() => setExportCopied(null), 2000);
  }, [tokens]);

  const showColors = activeSection === 'all' || activeSection === 'colors';
  const showFonts = activeSection === 'all' || activeSection === 'typography';
  const showRadius = activeSection === 'all' || activeSection === 'radius';

  if (shapes.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 8, padding: '24px 16px',
      }}>
        <div style={{ fontSize: 28 }}>🎨</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          Draw shapes to see<br />design tokens here
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Section filter pills */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 12px 6px',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}>
        {(['all', 'colors', 'typography', 'radius'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            style={{
              padding: '3px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
              border: 'none',
              background: activeSection === s ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: activeSection === s ? '#fff' : 'var(--muted)',
              fontWeight: activeSection === s ? 600 : 400,
              textTransform: 'capitalize',
              transition: 'background 0.12s',
            }}
          >
            {s}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Token counts */}
        <span style={{ fontSize: 10, color: 'var(--muted)', alignSelf: 'center' }}>
          {tokens.length} tokens
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>

        {/* ── Colors ─────────────────────────────────────────────────── */}
        {showColors && colors.length > 0 && (
          <section>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px 6px',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Colors · {colors.length}
              </span>
              <button
                onClick={() => setColorView(v => v === 'list' ? 'palette' : 'list')}
                title={colorView === 'list' ? 'Switch to palette view' : 'Switch to list view'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 14, padding: '2px 4px',
                  borderRadius: 3,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
              >
                {colorView === 'list' ? '⊞' : '≡'}
              </button>
            </div>
            {colorView === 'palette' ? (
              <ColorPaletteGrid
                tokens={colors}
                onCopy={handleCopy}
                onSelectShapes={onSelectShapes}
                copiedValue={copiedValue}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 12px 8px' }}>
                {colors.map(t => (
                  <TokenChip
                    key={t.value + t.role}
                    token={t}
                    onCopy={handleCopy}
                    onSelectShapes={onSelectShapes}
                    copiedValue={copiedValue}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Typography ─────────────────────────────────────────────── */}
        {showFonts && fonts.length > 0 && (
          <section>
            <div style={{ padding: '10px 12px 6px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Typography · {fonts.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 12px 8px' }}>
              {fonts.map(t => (
                <TokenChip
                  key={t.value + t.role}
                  token={t}
                  onCopy={handleCopy}
                  onSelectShapes={onSelectShapes}
                  copiedValue={copiedValue}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Border Radius ───────────────────────────────────────────── */}
        {showRadius && radii.length > 0 && (
          <section>
            <div style={{ padding: '10px 12px 6px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Border Radius · {radii.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 12px 8px' }}>
              {radii.map(t => (
                <TokenChip
                  key={t.value}
                  token={t}
                  onCopy={handleCopy}
                  onSelectShapes={onSelectShapes}
                  copiedValue={copiedValue}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state for filtered sections */}
        {tokens.length > 0 && !showColors && !showFonts && !showRadius && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
            No tokens found in this category
          </div>
        )}

        {/* Export buttons */}
        {tokens.length > 0 && (
          <div style={{ margin: '8px 12px 0', display: 'flex', gap: 6 }}>
            <button
              onClick={handleExportCSS}
              title="Copy all tokens as CSS custom properties (:root { --color-1: ...; })"
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 6,
                background: exportCopied === 'css' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${exportCopied === 'css' ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: exportCopied === 'css' ? 'var(--accent)' : 'var(--text)',
                fontSize: 10, cursor: 'pointer', fontFamily: 'monospace',
                transition: 'all 0.12s',
              }}
            >
              {exportCopied === 'css' ? '✓ Copied!' : 'Copy CSS vars'}
            </button>
            <button
              onClick={handleExportJSON}
              title="Copy all tokens as a JSON design token file"
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 6,
                background: exportCopied === 'json' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${exportCopied === 'json' ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: exportCopied === 'json' ? 'var(--accent)' : 'var(--text)',
                fontSize: 10, cursor: 'pointer', fontFamily: 'monospace',
                transition: 'all 0.12s',
              }}
            >
              {exportCopied === 'json' ? '✓ Copied!' : 'Copy JSON'}
            </button>
          </div>
        )}

        {/* Info footer */}
        <div style={{
          margin: '6px 12px 0',
          padding: '6px 10px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
            Click to copy value · Double-click to select all layers using that token
          </p>
        </div>
      </div>
    </div>
  );
}
