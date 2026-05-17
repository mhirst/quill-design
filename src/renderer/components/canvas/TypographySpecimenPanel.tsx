/**
 * TypographySpecimenPanel — Font specimen viewer and applier.
 *
 * Features:
 *  - Curated list of 40+ design-friendly fonts (system + Google)
 *  - Live editable sample text
 *  - Size scale preview (12px → 96px)
 *  - Filter by category: Serif, Sans, Mono, Display, Handwriting
 *  - Search by font name
 *  - Apply font to selected text shape(s)
 *  - Pair suggestions: shows harmonious body/heading combos
 *  - Copy font name to clipboard
 *  - Keyboard: ⌘⇧⌥Y to toggle
 */

import React, { useCallback, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onApplyFont: (fontFamily: string, fontWeight?: number) => void;
}

type FontCategory = 'all' | 'serif' | 'sans' | 'mono' | 'display' | 'handwriting';

interface FontEntry {
  name: string;
  category: FontCategory;
  weights: number[];
  specimen: string;  // custom specimen text if any
}

// ── Font Library ───────────────────────────────────────────────────────────────

const FONTS: FontEntry[] = [
  // Sans-serif
  { name: 'Inter', category: 'sans', weights: [400, 500, 600, 700, 900], specimen: '' },
  { name: 'DM Sans', category: 'sans', weights: [400, 500, 700], specimen: '' },
  { name: 'Poppins', category: 'sans', weights: [400, 500, 600, 700, 800], specimen: '' },
  { name: 'Nunito', category: 'sans', weights: [400, 600, 700, 800], specimen: '' },
  { name: 'Outfit', category: 'sans', weights: [400, 600, 700], specimen: '' },
  { name: 'Plus Jakarta Sans', category: 'sans', weights: [400, 600, 700], specimen: '' },
  { name: 'Geist', category: 'sans', weights: [400, 500, 600, 700], specimen: '' },
  { name: 'Space Grotesk', category: 'sans', weights: [400, 500, 700], specimen: '' },
  { name: 'Manrope', category: 'sans', weights: [400, 500, 600, 700, 800], specimen: '' },
  { name: 'Figtree', category: 'sans', weights: [400, 500, 600, 700], specimen: '' },
  { name: 'Sora', category: 'sans', weights: [400, 600, 700], specimen: '' },
  { name: 'Lexend', category: 'sans', weights: [400, 500, 600, 700], specimen: '' },
  // Serif
  { name: 'Playfair Display', category: 'serif', weights: [400, 700, 900], specimen: 'The quick brown fox' },
  { name: 'Lora', category: 'serif', weights: [400, 500, 600, 700], specimen: '' },
  { name: 'Merriweather', category: 'serif', weights: [400, 700, 900], specimen: '' },
  { name: 'Libre Baskerville', category: 'serif', weights: [400, 700], specimen: '' },
  { name: 'Cormorant Garamond', category: 'serif', weights: [400, 500, 600, 700], specimen: 'Aa Bb Cc' },
  { name: 'DM Serif Display', category: 'serif', weights: [400], specimen: '' },
  { name: 'Fraunces', category: 'serif', weights: [400, 700, 900], specimen: '' },
  { name: 'Source Serif 4', category: 'serif', weights: [400, 600, 700], specimen: '' },
  { name: 'Spectral', category: 'serif', weights: [400, 500, 700], specimen: '' },
  { name: 'EB Garamond', category: 'serif', weights: [400, 500, 700, 800], specimen: '' },
  // Monospace
  { name: 'JetBrains Mono', category: 'mono', weights: [400, 700], specimen: 'const x = 42;' },
  { name: 'Fira Code', category: 'mono', weights: [400, 500, 700], specimen: 'fn main() {}' },
  { name: 'Source Code Pro', category: 'mono', weights: [400, 600], specimen: '' },
  { name: 'Roboto Mono', category: 'mono', weights: [400, 500, 700], specimen: '' },
  { name: 'IBM Plex Mono', category: 'mono', weights: [400, 500, 700], specimen: '' },
  { name: 'Space Mono', category: 'mono', weights: [400, 700], specimen: '01001011' },
  { name: 'Inconsolata', category: 'mono', weights: [400, 700], specimen: '' },
  // Display
  { name: 'Bebas Neue', category: 'display', weights: [400], specimen: 'BOLD IMPACT' },
  { name: 'Oswald', category: 'display', weights: [400, 500, 600, 700], specimen: 'STRONG TITLE' },
  { name: 'Montserrat', category: 'display', weights: [400, 600, 700, 800, 900], specimen: '' },
  { name: 'Raleway', category: 'display', weights: [400, 600, 700, 800], specimen: '' },
  { name: 'Exo 2', category: 'display', weights: [400, 600, 700], specimen: '' },
  { name: 'Barlow', category: 'display', weights: [400, 500, 600, 700, 800], specimen: '' },
  { name: 'Righteous', category: 'display', weights: [400], specimen: 'GROOVY VIBES' },
  { name: 'Comfortaa', category: 'display', weights: [400, 600, 700], specimen: '' },
  { name: 'Fredoka', category: 'display', weights: [400, 600, 700], specimen: 'Fun & Round' },
  // Handwriting
  { name: 'Pacifico', category: 'handwriting', weights: [400], specimen: 'Hello World' },
  { name: 'Quicksand', category: 'handwriting', weights: [400, 600, 700], specimen: '' },
  { name: 'Dancing Script', category: 'handwriting', weights: [400, 700], specimen: 'Beautiful Script' },
  { name: 'Caveat', category: 'handwriting', weights: [400, 600, 700], specimen: 'Handwritten' },
];

// ── Font Pairing Suggestions ───────────────────────────────────────────────────

const PAIRS: { display: string; body: string; label: string }[] = [
  { display: 'Playfair Display', body: 'Inter', label: 'Classic Editorial' },
  { display: 'Bebas Neue', body: 'Poppins', label: 'Modern Bold' },
  { display: 'DM Serif Display', body: 'DM Sans', label: 'DM System' },
  { display: 'Cormorant Garamond', body: 'Lato', label: 'Luxury Minimal' },
  { display: 'Space Grotesk', body: 'Space Mono', label: 'Space System' },
  { display: 'Fraunces', body: 'Nunito', label: 'Warm & Playful' },
  { display: 'Montserrat', body: 'Source Serif 4', label: 'Contemporary' },
  { display: 'Oswald', body: 'Merriweather', label: 'Bold & Readable' },
];

// ── Size scale ─────────────────────────────────────────────────────────────────

const SIZE_SCALE = [12, 14, 16, 20, 24, 32, 48, 64, 96];

// ── Category tab ──────────────────────────────────────────────────────────────

const CATEGORIES: { id: FontCategory; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '🔤' },
  { id: 'sans', label: 'Sans', emoji: '🅰' },
  { id: 'serif', label: 'Serif', emoji: '𝐴' },
  { id: 'mono', label: 'Mono', emoji: '⌨' },
  { id: 'display', label: 'Display', emoji: '🖥' },
  { id: 'handwriting', label: 'Script', emoji: '✍' },
];

// ── Font Card ─────────────────────────────────────────────────────────────────

function FontCard({
  font, sampleText, selectedWeight, isActive, onApply, onCopy,
}: {
  font: FontEntry;
  sampleText: string;
  selectedWeight: number;
  isActive: boolean;
  onApply: (name: string, weight: number) => void;
  onCopy: (name: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const text = font.specimen || sampleText || 'The quick brown fox';
  const displayWeight = font.weights.includes(selectedWeight)
    ? selectedWeight
    : font.weights[0];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        background: isActive ? 'rgba(99,102,241,0.05)' : hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background 0.1s',
        position: 'relative',
      }}
    >
      {/* Font name + meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: isActive ? '#818cf8' : 'var(--text, #e2e8f0)',
        }}>
          {font.name}
        </span>
        <span style={{ fontSize: 9, color: 'var(--muted, #888)' }}>
          {font.category} · {font.weights.join(', ')}
        </span>

        {/* Hover actions */}
        {(hovered || isActive) && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button
              onClick={() => onCopy(font.name)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border, #2d2d3d)',
                borderRadius: 4, color: 'var(--muted, #888)',
                fontSize: 8, padding: '1px 5px', cursor: 'pointer',
              }}
            >
              Copy
            </button>
            <button
              onClick={() => onApply(font.name, displayWeight)}
              style={{
                background: 'var(--accent, #6366f1)',
                border: 'none', borderRadius: 4, color: 'white',
                fontSize: 8, padding: '1px 7px', cursor: 'pointer', fontWeight: 700,
              }}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Specimen text */}
      <div
        style={{
          fontFamily: `"${font.name}", ${font.category === 'mono' ? 'monospace' : font.category === 'serif' ? 'serif' : 'sans-serif'}`,
          fontSize: 24,
          fontWeight: displayWeight,
          color: 'var(--text, #e2e8f0)',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: font.category === 'display' ? '-0.02em' : 'normal',
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ── Pairing Card ──────────────────────────────────────────────────────────────

function PairingCard({
  pair, sampleText, onApplyDisplay, onApplyBody,
}: {
  pair: typeof PAIRS[0];
  sampleText: string;
  onApplyDisplay: (name: string) => void;
  onApplyBody: (name: string) => void;
}) {
  return (
    <div style={{
      padding: '10px 12px',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 8, marginBottom: 8,
      background: 'var(--bg, #131320)',
    }}>
      <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 6, fontWeight: 600 }}>
        {pair.label}
      </div>
      {/* Display */}
      <div style={{
        fontFamily: `"${pair.display}", serif`,
        fontSize: 22, fontWeight: 700,
        color: 'var(--text, #e2e8f0)', lineHeight: 1.2, marginBottom: 4,
        letterSpacing: '-0.01em',
      }}>
        {sampleText || 'Heading Text'}
      </div>
      {/* Body */}
      <div style={{
        fontFamily: `"${pair.body}", sans-serif`,
        fontSize: 12, fontWeight: 400,
        color: 'var(--muted, #888)', lineHeight: 1.5,
      }}>
        Body copy in {pair.body}. Clean and readable alongside {pair.display}.
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          onClick={() => onApplyDisplay(pair.display)}
          style={{
            flex: 1, height: 22, fontSize: 9, cursor: 'pointer',
            background: 'transparent',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 4, color: 'var(--muted, #888)',
          }}
        >
          ↑ {pair.display}
        </button>
        <button
          onClick={() => onApplyBody(pair.body)}
          style={{
            flex: 1, height: 22, fontSize: 9, cursor: 'pointer',
            background: 'transparent',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 4, color: 'var(--muted, #888)',
          }}
        >
          ↓ {pair.body}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TypographySpecimenPanel({ open, onClose, selectedShape, onApplyFont }: Props) {
  const [category, setCategory] = useState<FontCategory>('all');
  const [search, setSearch] = useState('');
  const [sampleText, setSampleText] = useState('The quick brown fox');
  const [selectedWeight, setSelectedWeight] = useState(400);
  const [activeFont, setActiveFont] = useState<string | null>(null);
  const [showPairings, setShowPairings] = useState(false);
  const [showSizeScale, setShowSizeScale] = useState(false);
  const [sizeScaleFont, setSizeScaleFont] = useState('Inter');
  const [copiedFont, setCopiedFont] = useState<string | null>(null);

  const filtered = FONTS.filter(f => {
    if (category !== 'all' && f.category !== category) return false;
    if (search.trim() && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleApply = useCallback((fontName: string, weight?: number) => {
    setActiveFont(fontName);
    onApplyFont(fontName, weight);
  }, [onApplyFont]);

  const handleCopy = useCallback((fontName: string) => {
    navigator.clipboard.writeText(fontName).catch(() => {});
    setCopiedFont(fontName);
    setTimeout(() => setCopiedFont(null), 1500);
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 20,
      width: 360,
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
          <span style={{ fontSize: 14 }}>🔤</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>Typography Specimen</span>
          <span style={{
            fontSize: 9, background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.25)',
            color: '#818cf8', padding: '1px 5px', borderRadius: 4, fontWeight: 600,
          }}>
            {FONTS.length} fonts
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {/* ── Sample text input ── */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
        <input
          type="text"
          value={sampleText}
          onChange={e => setSampleText(e.target.value)}
          placeholder="Type sample text…"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            color: 'var(--text, #e2e8f0)', fontSize: 11,
            padding: '5px 8px', borderRadius: 6, outline: 'none',
          }}
        />
      </div>

      {/* ── Weight + search row ── */}
      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        display: 'flex', gap: 8, alignItems: 'center',
        flexShrink: 0,
      }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            flex: 1,
            background: 'var(--bg, #131320)',
            border: '1px solid var(--border, #2d2d3d)',
            color: 'var(--text, #e2e8f0)', fontSize: 10,
            padding: '3px 7px', borderRadius: 5, outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 2 }}>
          {[400, 600, 700, 900].map(w => (
            <button
              key={w}
              onClick={() => setSelectedWeight(w)}
              style={{
                height: 22, width: 32,
                background: selectedWeight === w ? 'rgba(99,102,241,0.2)' : 'transparent',
                border: `1px solid ${selectedWeight === w ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
                borderRadius: 4, cursor: 'pointer', fontSize: 9,
                color: selectedWeight === w ? '#818cf8' : 'var(--muted, #888)',
                fontWeight: w,
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 12px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            style={{
              height: 22, padding: '0 8px',
              background: category === cat.id ? 'rgba(99,102,241,0.2)' : 'transparent',
              border: `1px solid ${category === cat.id ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
              borderRadius: 4, cursor: 'pointer', fontSize: 9,
              color: category === cat.id ? '#818cf8' : 'var(--muted, #888)',
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            <span>{cat.emoji}</span>
            {cat.label}
            <span style={{ opacity: 0.6, fontSize: 8 }}>
              ({FONTS.filter(f => cat.id === 'all' || f.category === cat.id).length})
            </span>
          </button>
        ))}

        {/* View toggles */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button
            onClick={() => { setShowPairings(v => !v); setShowSizeScale(false); }}
            style={{
              height: 22, padding: '0 7px',
              background: showPairings ? 'rgba(249,115,22,0.15)' : 'transparent',
              border: `1px solid ${showPairings ? 'rgba(249,115,22,0.4)' : 'var(--border, #2d2d3d)'}`,
              borderRadius: 4, cursor: 'pointer', fontSize: 9,
              color: showPairings ? '#fb923c' : 'var(--muted, #888)',
            }}
          >
            Pairs
          </button>
          <button
            onClick={() => { setShowSizeScale(v => !v); setShowPairings(false); }}
            style={{
              height: 22, padding: '0 7px',
              background: showSizeScale ? 'rgba(34,197,94,0.15)' : 'transparent',
              border: `1px solid ${showSizeScale ? 'rgba(34,197,94,0.4)' : 'var(--border, #2d2d3d)'}`,
              borderRadius: 4, cursor: 'pointer', fontSize: 9,
              color: showSizeScale ? '#22c55e' : 'var(--muted, #888)',
            }}
          >
            Scale
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {showPairings && (
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 8, fontWeight: 600 }}>
              CURATED FONT PAIRINGS
            </div>
            {PAIRS.map(pair => (
              <PairingCard
                key={pair.label}
                pair={pair}
                sampleText={sampleText}
                onApplyDisplay={(name) => handleApply(name, 700)}
                onApplyBody={(name) => handleApply(name, 400)}
              />
            ))}
          </div>
        )}

        {showSizeScale && (
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: 'var(--muted, #888)', fontWeight: 600 }}>
                SIZE SCALE
              </div>
              <select
                value={sizeScaleFont}
                onChange={e => setSizeScaleFont(e.target.value)}
                style={{
                  background: 'var(--bg, #131320)',
                  border: '1px solid var(--border, #2d2d3d)',
                  color: 'var(--text, #e2e8f0)', fontSize: 9,
                  padding: '2px 6px', borderRadius: 4, outline: 'none',
                }}
              >
                {FONTS.map(f => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
            {SIZE_SCALE.map(size => (
              <div
                key={size}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 10,
                  marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)',
                  paddingBottom: 8,
                }}
              >
                <span style={{
                  fontSize: 9, color: 'var(--muted, #888)',
                  width: 28, flexShrink: 0, textAlign: 'right',
                }}>
                  {size}px
                </span>
                <span style={{
                  fontFamily: `"${sizeScaleFont}", sans-serif`,
                  fontSize: size,
                  fontWeight: selectedWeight,
                  color: 'var(--text, #e2e8f0)',
                  lineHeight: 1.1,
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  flex: 1,
                }}>
                  {sampleText}
                </span>
              </div>
            ))}
          </div>
        )}

        {!showPairings && !showSizeScale && (
          <>
            {/* Selected shape info */}
            {selectedShape && (
              <div style={{
                padding: '6px 12px',
                background: 'rgba(99,102,241,0.05)',
                borderBottom: '1px solid var(--border, #2d2d3d)',
                fontSize: 9, color: '#818cf8',
              }}>
                Selected: <strong>{selectedShape.name || selectedShape.type}</strong>
                {selectedShape.fontFamily && ` · Current: ${selectedShape.fontFamily}`}
              </div>
            )}

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted, #888)', fontSize: 11 }}>
                No fonts match "{search}"
              </div>
            )}

            {filtered.map(font => (
              <FontCard
                key={font.name}
                font={font}
                sampleText={sampleText}
                selectedWeight={selectedWeight}
                isActive={font.name === activeFont}
                onApply={handleApply}
                onCopy={handleCopy}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      {copiedFont && (
        <div style={{
          padding: '5px 12px',
          borderTop: '1px solid var(--border, #2d2d3d)',
          fontSize: 9, color: '#22c55e', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          ✓ Copied "{copiedFont}"
        </div>
      )}
      {!copiedFont && activeFont && (
        <div style={{
          padding: '5px 12px',
          borderTop: '1px solid var(--border, #2d2d3d)',
          fontSize: 9, color: '#818cf8', flexShrink: 0,
        }}>
          Applied <strong>{activeFont}</strong> to shape
        </div>
      )}
    </div>
  );
}
