/**
 * MoodboardPanel — Moodboard / mood palette generator.
 *
 * Features:
 *  - 12 curated aesthetic themes: Twilight, Cyber, Desert, Ocean, Forest, Candy, etc.
 *  - Each theme: 5-color palette + 3 font pairings + mood tags
 *  - Apply palette to selected shapes (distributes colors across shapes)
 *  - Generate: creates sample shapes in theme colors
 *  - "Vibe" chips for filtering by mood (calm, energetic, dark, playful, minimal, bold)
 *  - Color swatch row with click-to-copy hex
 *  - Export palette as CSS custom properties or Tailwind config
 *  - Keyboard: ⌘⇧⌥B to toggle
 */

import React, { useCallback, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  onApplyPalette: (colorMap: { shapeId: string; color: string }[]) => void;
  onGenerateShapes: (theme: MoodTheme) => void;
}

export interface MoodTheme {
  id: string;
  name: string;
  emoji: string;
  palette: string[];           // 5 hex colors: bg, primary, secondary, accent, text
  fonts: [string, string];     // [display, body]
  vibes: string[];             // e.g. ['calm', 'minimal']
  description: string;
}

// ── Theme Library ──────────────────────────────────────────────────────────────

export const THEMES: MoodTheme[] = [
  {
    id: 'twilight',
    name: 'Twilight',
    emoji: '🌆',
    palette: ['#1a1035', '#7c3aed', '#a78bfa', '#fbbf24', '#e5e7eb'],
    fonts: ['Playfair Display', 'Inter'],
    vibes: ['dark', 'elegant', 'bold'],
    description: 'Deep purples and warm gold — sophisticated dusk energy.',
  },
  {
    id: 'cyber',
    name: 'Cyber',
    emoji: '⚡',
    palette: ['#030712', '#06b6d4', '#22d3ee', '#f97316', '#f1f5f9'],
    fonts: ['Space Grotesk', 'JetBrains Mono'],
    vibes: ['dark', 'energetic', 'bold'],
    description: 'Electric cyan on deep dark — futuristic tech aesthetic.',
  },
  {
    id: 'desert',
    name: 'Desert',
    emoji: '🏜',
    palette: ['#fef3c7', '#d97706', '#92400e', '#78350f', '#1c1917'],
    fonts: ['Cormorant Garamond', 'Source Serif 4'],
    vibes: ['warm', 'calm', 'elegant'],
    description: 'Warm amber and earth tones — timeless desert warmth.',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    palette: ['#ecfeff', '#06b6d4', '#0891b2', '#164e63', '#0c1a2e'],
    fonts: ['Nunito', 'Open Sans'],
    vibes: ['calm', 'cool', 'minimal'],
    description: 'Cool aquas and deep navy — serene coastal vibes.',
  },
  {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    palette: ['#f0fdf4', '#22c55e', '#16a34a', '#14532d', '#052e16'],
    fonts: ['Merriweather', 'Lato'],
    vibes: ['calm', 'natural', 'minimal'],
    description: 'Lush greens and earthy depths — grounded in nature.',
  },
  {
    id: 'candy',
    name: 'Candy',
    emoji: '🍭',
    palette: ['#fdf4ff', '#e879f9', '#a855f7', '#ec4899', '#1e1b4b'],
    fonts: ['Pacifico', 'Poppins'],
    vibes: ['playful', 'energetic', 'bold'],
    description: 'Electric pinks and purples — unapologetically fun.',
  },
  {
    id: 'matcha',
    name: 'Matcha',
    emoji: '🍵',
    palette: ['#f7fee7', '#84cc16', '#4d7c0f', '#365314', '#1a2e05'],
    fonts: ['Zen Kaku Gothic Antique', 'Noto Serif'],
    vibes: ['calm', 'natural', 'minimal'],
    description: 'Soft greens and earthy warmth — Japanese zen aesthetic.',
  },
  {
    id: 'nordic',
    name: 'Nordic',
    emoji: '❄️',
    palette: ['#f8fafc', '#e2e8f0', '#94a3b8', '#334155', '#0f172a'],
    fonts: ['DM Sans', 'DM Serif Display'],
    vibes: ['minimal', 'cool', 'calm'],
    description: 'Pure greys and dark navy — clean Scandinavian clarity.',
  },
  {
    id: 'volcano',
    name: 'Volcano',
    emoji: '🌋',
    palette: ['#0c0a09', '#ef4444', '#f97316', '#fbbf24', '#fef9c3'],
    fonts: ['Black Han Sans', 'Oswald'],
    vibes: ['dark', 'bold', 'energetic'],
    description: 'Fiery reds and deep black — raw volcanic power.',
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    emoji: '💗',
    palette: ['#fff0f5', '#f472b6', '#ec4899', '#be185d', '#1f0a14'],
    fonts: ['Quicksand', 'Nunito'],
    vibes: ['playful', 'warm', 'energetic'],
    description: 'Soft pinks and hot magenta — sweet and playful.',
  },
  {
    id: 'vapor',
    name: 'Vapor',
    emoji: '🌸',
    palette: ['#ffe4e6', '#fb7185', '#818cf8', '#6366f1', '#1e1b4b'],
    fonts: ['VT323', 'Share Tech Mono'],
    vibes: ['playful', 'energetic', 'dark'],
    description: 'Retro pinks and purples — nostalgic vaporwave energy.',
  },
  {
    id: 'ink',
    name: 'Ink',
    emoji: '🖋',
    palette: ['#fafaf9', '#e7e5e4', '#78716c', '#292524', '#0c0a09'],
    fonts: ['Libre Baskerville', 'Source Sans 3'],
    vibes: ['minimal', 'elegant', 'calm'],
    description: 'Warm grays and rich charcoal — editorial sophistication.',
  },
];

const ALL_VIBES = ['All', 'calm', 'dark', 'bold', 'minimal', 'playful', 'energetic', 'warm', 'cool', 'elegant', 'natural'];

// ── Color Swatch ───────────────────────────────────────────────────────────────

function ColorSwatch({ hex, size = 28 }: { hex: string; size?: number }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      onClick={() => {
        navigator.clipboard.writeText(hex).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={copied ? 'Copied!' : hex}
      style={{
        width: size, height: size,
        borderRadius: 5,
        background: hex,
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.1)',
        transition: 'transform 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {copied && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', borderRadius: 5,
          fontSize: 9, color: 'white', fontWeight: 700,
        }}>
          ✓
        </div>
      )}
    </div>
  );
}

// ── Theme Card ─────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  isActive,
  onSelect,
}: {
  theme: MoodTheme;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 8,
        border: `2px solid ${isActive ? 'var(--accent, #6366f1)' : hovered ? 'rgba(99,102,241,0.3)' : 'var(--border, #2d2d3d)'}`,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.12s',
        background: 'var(--bg, #131320)',
      }}
    >
      {/* Color bars */}
      <div style={{ display: 'flex', height: 36 }}>
        {theme.palette.map((color, i) => (
          <div
            key={i}
            style={{
              flex: hovered && i === 1 ? 2 : 1,
              background: color,
              transition: 'flex 0.2s',
            }}
          />
        ))}
      </div>

      {/* Info */}
      <div style={{ padding: '6px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ fontSize: 12 }}>{theme.emoji}</span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: isActive ? '#818cf8' : 'var(--text, #e2e8f0)',
          }}>
            {theme.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {theme.vibes.map(v => (
            <span
              key={v}
              style={{
                fontSize: 8, padding: '1px 4px',
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 3,
                color: '#818cf8',
                fontWeight: 500,
              }}
            >
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CSS Export ─────────────────────────────────────────────────────────────────

function exportCSSVars(theme: MoodTheme): string {
  const labels = ['background', 'primary', 'secondary', 'accent', 'text'];
  const vars = theme.palette.map((hex, i) => `  --color-${labels[i]}: ${hex};`).join('\n');
  return `:root {\n  /* ${theme.name} Theme */\n${vars}\n  --font-display: "${theme.fonts[0]}", sans-serif;\n  --font-body: "${theme.fonts[1]}", sans-serif;\n}`;
}

function exportTailwind(theme: MoodTheme): string {
  const labels = ['bg', 'primary', 'secondary', 'accent', 'text'];
  const colors = theme.palette.map((hex, i) => `      '${labels[i]}': '${hex}',`).join('\n');
  return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        ${theme.name.toLowerCase()}: {\n${colors}\n        },\n      },\n    },\n  },\n};`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function MoodboardPanel({ open, onClose, shapes, onApplyPalette, onGenerateShapes }: Props) {
  const [activeTheme, setActiveTheme] = useState<MoodTheme>(THEMES[0]);
  const [activeVibe, setActiveVibe] = useState('All');
  const [exportMode, setExportMode] = useState<'css' | 'tailwind' | null>(null);
  const [copiedExport, setCopiedExport] = useState(false);
  const [applied, setApplied] = useState(false);

  const filteredThemes = activeVibe === 'All'
    ? THEMES
    : THEMES.filter(t => t.vibes.includes(activeVibe));

  const handleApply = useCallback(() => {
    if (shapes.length === 0) return;
    // Distribute colors from the active palette across shapes
    const colorMap = shapes.map((shape, i) => {
      const colorIndex = i % activeTheme.palette.length;
      return { shapeId: shape.id, color: activeTheme.palette[colorIndex] };
    });
    onApplyPalette(colorMap);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }, [shapes, activeTheme, onApplyPalette]);

  const exportCode = exportMode === 'css'
    ? exportCSSVars(activeTheme)
    : exportMode === 'tailwind'
      ? exportTailwind(activeTheme)
      : '';

  const handleCopyExport = useCallback(() => {
    navigator.clipboard.writeText(exportCode).catch(() => {});
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  }, [exportCode]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      left: 60,
      width: 340,
      maxHeight: '88vh',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      zIndex: 40,
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🎨</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>Moodboard</span>
          <span style={{
            fontSize: 9, background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.25)',
            color: '#818cf8', padding: '1px 5px', borderRadius: 4, fontWeight: 600,
          }}>
            {THEMES.length} themes
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {/* ── Active theme hero ── */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        {/* Color bar */}
        <div style={{ display: 'flex', height: 48, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
          {activeTheme.palette.map((color, i) => (
            <div
              key={i}
              style={{ flex: 1, background: color, position: 'relative' }}
              title={color}
            >
              {i === 0 && (
                <span style={{
                  position: 'absolute', bottom: 2, left: 4,
                  fontSize: 8, color: 'rgba(255,255,255,0.5)',
                  fontWeight: 700, letterSpacing: '0.05em',
                }}>
                  bg
                </span>
              )}
              {i === 1 && (
                <span style={{
                  position: 'absolute', bottom: 2, left: 4,
                  fontSize: 8, color: 'rgba(255,255,255,0.5)',
                  fontWeight: 700,
                }}>
                  1°
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Swatches row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          {activeTheme.palette.map((hex, i) => (
            <ColorSwatch key={i} hex={hex} size={32} />
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <span style={{ fontSize: 13 }}>{activeTheme.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
              {activeTheme.name}
            </span>
          </div>
        </div>

        {/* Description */}
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 8, lineHeight: 1.4 }}>
          {activeTheme.description}
        </div>

        {/* Fonts */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <div style={{
            flex: 1, padding: '4px 8px',
            background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 5,
            fontSize: 9,
          }}>
            <div style={{ color: 'var(--muted, #888)', marginBottom: 1 }}>Display</div>
            <div style={{ color: 'var(--text, #e2e8f0)', fontWeight: 600 }}>{activeTheme.fonts[0]}</div>
          </div>
          <div style={{
            flex: 1, padding: '4px 8px',
            background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 5,
            fontSize: 9,
          }}>
            <div style={{ color: 'var(--muted, #888)', marginBottom: 1 }}>Body</div>
            <div style={{ color: 'var(--text, #e2e8f0)' }}>{activeTheme.fonts[1]}</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleApply}
            disabled={shapes.length === 0}
            style={{
              flex: 1, height: 28,
              background: applied ? 'rgba(34,197,94,0.2)' : shapes.length > 0 ? 'var(--accent, #6366f1)' : 'rgba(99,102,241,0.2)',
              border: 'none', borderRadius: 6,
              color: applied ? '#22c55e' : shapes.length > 0 ? 'white' : 'rgba(255,255,255,0.3)',
              fontSize: 10, fontWeight: 600, cursor: shapes.length > 0 ? 'pointer' : 'default',
            }}
          >
            {applied ? '✓ Applied!' : `Apply to ${shapes.length} shape${shapes.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={() => onGenerateShapes(activeTheme)}
            style={{
              flex: 1, height: 28,
              background: 'transparent',
              border: '1px solid var(--border, #2d2d3d)',
              borderRadius: 6, color: 'var(--muted, #888)',
              fontSize: 10, cursor: 'pointer',
            }}
          >
            ✦ Generate
          </button>
        </div>
      </div>

      {/* ── Vibe filter ── */}
      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
          {ALL_VIBES.map(vibe => (
            <button
              key={vibe}
              onClick={() => setActiveVibe(vibe)}
              style={{
                height: 20, padding: '0 7px',
                background: activeVibe === vibe ? 'rgba(99,102,241,0.2)' : 'transparent',
                border: `1px solid ${activeVibe === vibe ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                borderRadius: 4, cursor: 'pointer', fontSize: 9,
                color: activeVibe === vibe ? '#818cf8' : 'var(--muted, #888)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {vibe}
            </button>
          ))}
        </div>
      </div>

      {/* ── Theme grid ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 12px' }}>
        {filteredThemes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted, #888)', fontSize: 11 }}>
            No themes match "{activeVibe}"
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {filteredThemes.map(theme => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === activeTheme.id}
              onSelect={() => setActiveTheme(theme)}
            />
          ))}
        </div>

        {/* ── Export section ── */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 6, fontWeight: 600 }}>EXPORT PALETTE</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: exportMode ? 8 : 0 }}>
            {(['css', 'tailwind'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setExportMode(prev => prev === mode ? null : mode)}
                style={{
                  flex: 1, height: 26,
                  background: exportMode === mode ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: `1px solid ${exportMode === mode ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                  borderRadius: 5, cursor: 'pointer',
                  color: exportMode === mode ? '#818cf8' : 'var(--muted, #888)',
                  fontSize: 9, fontWeight: 500,
                }}
              >
                {mode === 'css' ? 'CSS Variables' : 'Tailwind Config'}
              </button>
            ))}
          </div>

          {exportMode && (
            <div style={{ position: 'relative' }}>
              <pre style={{
                background: 'var(--bg, #131320)',
                border: '1px solid var(--border, #2d2d3d)',
                borderRadius: 6, padding: '8px 10px',
                fontSize: 9, color: '#a5b4fc',
                fontFamily: 'monospace',
                overflow: 'auto', maxHeight: 140,
                margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {exportCode}
              </pre>
              <button
                onClick={handleCopyExport}
                style={{
                  position: 'absolute', top: 6, right: 6,
                  background: copiedExport ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)',
                  border: `1px solid ${copiedExport ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.3)'}`,
                  borderRadius: 4, cursor: 'pointer',
                  color: copiedExport ? '#22c55e' : '#818cf8',
                  fontSize: 9, padding: '2px 8px',
                }}
              >
                {copiedExport ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
