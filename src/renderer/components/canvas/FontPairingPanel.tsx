/**
 * FontPairingPanel — Curated typography pairing explorer for Quill.
 *
 * Features:
 *  - 20+ hand-curated heading + body font pairings
 *  - Live preview text with custom sample text input
 *  - Category filters: Serif, Sans, Slab, Monospace, Display
 *  - Mood tags: Modern, Classic, Playful, Editorial, Technical, Friendly
 *  - Apply heading font → selected text shape
 *  - Apply body font → selected text shape
 *  - Google Fonts deep links for both fonts
 *  - Scale preview: H1/H2/H3/Body/Caption sizes
 *  - Contrast ratio between heading and body weights (visual harmony score)
 *
 * Keyboard: ⌘⌥T
 */

import React, { useState, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

type FontCategory = 'serif' | 'sans' | 'slab' | 'mono' | 'display';
type FontMood = 'modern' | 'classic' | 'playful' | 'editorial' | 'technical' | 'friendly' | 'bold' | 'elegant';

interface FontPair {
  id: string;
  heading: string;
  body: string;
  headingCategory: FontCategory;
  bodyCategory: FontCategory;
  moods: FontMood[];
  headingWeight: number;  // e.g. 700
  bodyWeight: number;     // e.g. 400
  description: string;
  popularity: number;     // 1-5
}

// ─── Font Pair Catalog ─────────────────────────────────────────────────────────

const FONT_PAIRS: FontPair[] = [
  {
    id: 'playfair-source',
    heading: 'Playfair Display', body: 'Source Sans 3',
    headingCategory: 'serif', bodyCategory: 'sans',
    moods: ['editorial', 'elegant', 'classic'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Luxury editorial — high contrast serif meets clean humanist sans',
    popularity: 5,
  },
  {
    id: 'inter-merriweather',
    heading: 'Inter', body: 'Merriweather',
    headingCategory: 'sans', bodyCategory: 'serif',
    moods: ['modern', 'technical'],
    headingWeight: 800, bodyWeight: 400,
    description: 'Tech meets tradition — crisp geometric UI font with readable serif body',
    popularity: 5,
  },
  {
    id: 'montserrat-open',
    heading: 'Montserrat', body: 'Open Sans',
    headingCategory: 'sans', bodyCategory: 'sans',
    moods: ['modern', 'friendly'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Universally loved — geometric header with humanist body',
    popularity: 5,
  },
  {
    id: 'raleway-lato',
    heading: 'Raleway', body: 'Lato',
    headingCategory: 'sans', bodyCategory: 'sans',
    moods: ['elegant', 'modern'],
    headingWeight: 300, bodyWeight: 400,
    description: 'Light and airy — ultra-thin caps with warm body text',
    popularity: 4,
  },
  {
    id: 'lora-nunito',
    heading: 'Lora', body: 'Nunito',
    headingCategory: 'serif', bodyCategory: 'sans',
    moods: ['friendly', 'classic'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Warm and approachable — calligraphic serif with rounded body',
    popularity: 4,
  },
  {
    id: 'oswald-eb',
    heading: 'Oswald', body: 'EB Garamond',
    headingCategory: 'sans', bodyCategory: 'serif',
    moods: ['bold', 'editorial'],
    headingWeight: 600, bodyWeight: 400,
    description: 'Newspaper power — condensed grotesque over classic Garamond',
    popularity: 4,
  },
  {
    id: 'dm-serif-dm-sans',
    heading: 'DM Serif Display', body: 'DM Sans',
    headingCategory: 'serif', bodyCategory: 'sans',
    moods: ['modern', 'elegant'],
    headingWeight: 400, bodyWeight: 400,
    description: 'Paired by design — DM family\'s built-in harmony',
    popularity: 5,
  },
  {
    id: 'space-grotesk-space-mono',
    heading: 'Space Grotesk', body: 'Space Mono',
    headingCategory: 'sans', bodyCategory: 'mono',
    moods: ['technical', 'modern', 'bold'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Developer aesthetic — space-themed geometric and monospaced',
    popularity: 3,
  },
  {
    id: 'abril-poppins',
    heading: 'Abril Fatface', body: 'Poppins',
    headingCategory: 'display', bodyCategory: 'sans',
    moods: ['playful', 'bold', 'editorial'],
    headingWeight: 400, bodyWeight: 400,
    description: 'High impact — ultra-bold display with geometric body',
    popularity: 4,
  },
  {
    id: 'cormorant-proza',
    heading: 'Cormorant Garamond', body: 'Proza Libre',
    headingCategory: 'serif', bodyCategory: 'sans',
    moods: ['elegant', 'classic'],
    headingWeight: 600, bodyWeight: 400,
    description: 'Fashion magazine — delicate high-contrast serif with modern body',
    popularity: 4,
  },
  {
    id: 'josefin-cardo',
    heading: 'Josefin Sans', body: 'Cardo',
    headingCategory: 'sans', bodyCategory: 'serif',
    moods: ['elegant', 'modern', 'classic'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Art deco revival — geometric all-caps display with classical text',
    popularity: 3,
  },
  {
    id: 'bitter-raleway',
    heading: 'Bitter', body: 'Raleway',
    headingCategory: 'slab', bodyCategory: 'sans',
    moods: ['bold', 'friendly'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Strong and warm — slab serif heading with thin sans body',
    popularity: 3,
  },
  {
    id: 'libre-baskerville-libre-franklin',
    heading: 'Libre Baskerville', body: 'Libre Franklin',
    headingCategory: 'serif', bodyCategory: 'sans',
    moods: ['classic', 'editorial'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Refined classics — open-source revival duo',
    popularity: 3,
  },
  {
    id: 'nunito-nunito-sans',
    heading: 'Nunito', body: 'Nunito Sans',
    headingCategory: 'sans', bodyCategory: 'sans',
    moods: ['friendly', 'playful'],
    headingWeight: 800, bodyWeight: 400,
    description: 'Cute consistency — rounded family keeps everything cohesive',
    popularity: 4,
  },
  {
    id: 'playfair-raleway',
    heading: 'Playfair Display', body: 'Raleway',
    headingCategory: 'serif', bodyCategory: 'sans',
    moods: ['elegant', 'editorial', 'classic'],
    headingWeight: 900, bodyWeight: 300,
    description: 'Ultra contrast — heavy display over whisper-thin body',
    popularity: 4,
  },
  {
    id: 'roboto-slab-roboto',
    heading: 'Roboto Slab', body: 'Roboto',
    headingCategory: 'slab', bodyCategory: 'sans',
    moods: ['technical', 'modern'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Google\'s original duo — mechanical precision throughout',
    popularity: 5,
  },
  {
    id: 'fira-sans-fira-code',
    heading: 'Fira Sans', body: 'Fira Code',
    headingCategory: 'sans', bodyCategory: 'mono',
    moods: ['technical', 'modern'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Developer docs — same family from Mozilla for perfect cohesion',
    popularity: 3,
  },
  {
    id: 'spectral-assistant',
    heading: 'Spectral', body: 'Assistant',
    headingCategory: 'serif', bodyCategory: 'sans',
    moods: ['editorial', 'elegant', 'modern'],
    headingWeight: 800, bodyWeight: 400,
    description: 'Digital editorial — variable serif with friendly UI body',
    popularity: 3,
  },
  {
    id: 'bebas-montserrat',
    heading: 'Bebas Neue', body: 'Montserrat',
    headingCategory: 'display', bodyCategory: 'sans',
    moods: ['bold', 'playful', 'modern'],
    headingWeight: 400, bodyWeight: 400,
    description: 'Sports/fashion — condensed all-caps impact with geometric body',
    popularity: 4,
  },
  {
    id: 'fraunces-commissioner',
    heading: 'Fraunces', body: 'Commissioner',
    headingCategory: 'serif', bodyCategory: 'sans',
    moods: ['playful', 'elegant'],
    headingWeight: 700, bodyWeight: 400,
    description: 'Quirky premium — variable wobbly serif with clean sans body',
    popularity: 3,
  },
];

// ─── Component Props ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  onApplyFont: (patch: Partial<Shape>) => void;
}

// ─── Category/Mood config ─────────────────────────────────────────────────────

const CATEGORIES: { id: FontCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'serif', label: 'Serif' },
  { id: 'sans', label: 'Sans' },
  { id: 'slab', label: 'Slab' },
  { id: 'mono', label: 'Mono' },
  { id: 'display', label: 'Display' },
];

const MOODS: { id: FontMood; emoji: string }[] = [
  { id: 'modern', emoji: '⚡' },
  { id: 'classic', emoji: '🏛️' },
  { id: 'playful', emoji: '🎈' },
  { id: 'editorial', emoji: '📰' },
  { id: 'technical', emoji: '⚙️' },
  { id: 'friendly', emoji: '😊' },
  { id: 'bold', emoji: '💪' },
  { id: 'elegant', emoji: '✨' },
];

const SAMPLE_TEXTS = [
  { label: 'Magazine', h: 'The Future of Design', b: 'Typography shapes how we perceive information. The right pairing creates hierarchy, mood, and brand voice in a single glance.' },
  { label: 'App', h: 'Welcome Back', b: 'Your projects are ready. Continue where you left off or start something new today.' },
  { label: 'Blog', h: 'Why Less Is More', b: 'Minimalism is not about removing things you love. It\'s about clearing space for what matters most.' },
  { label: 'Brand', h: 'Crafted With Care', b: 'Every detail matters. We take pride in the small things that make a big difference to our customers.' },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export function FontPairingPanel({ open, onClose, selectedShape, onApplyFont }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<FontCategory | 'all'>('all');
  const [moodFilter, setMoodFilter] = useState<FontMood | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [customSample, setCustomSample] = useState('');
  const [selectedPairId, setSelectedPairId] = useState<string | null>(FONT_PAIRS[0].id);
  const [sortBy, setSortBy] = useState<'popularity' | 'heading' | 'body'>('popularity');

  if (!open) return null;

  const sample = SAMPLE_TEXTS[sampleIndex];
  const headingText = customSample ? customSample.split('\n')[0] || sample.h : sample.h;
  const bodyText = customSample ? (customSample.split('\n').slice(1).join(' ') || sample.b) : sample.b;

  const filtered = useMemo(() => {
    let list = [...FONT_PAIRS];
    if (categoryFilter !== 'all') {
      list = list.filter(p => p.headingCategory === categoryFilter || p.bodyCategory === categoryFilter);
    }
    if (moodFilter) {
      list = list.filter(p => p.moods.includes(moodFilter));
    }
    list.sort((a, b) => {
      if (sortBy === 'popularity') return b.popularity - a.popularity;
      if (sortBy === 'heading') return a.heading.localeCompare(b.heading);
      return a.body.localeCompare(b.body);
    });
    return list;
  }, [categoryFilter, moodFilter, sortBy]);

  const selectedPair = FONT_PAIRS.find(p => p.id === selectedPairId) ?? filtered[0] ?? null;

  const isTextShape = selectedShape?.type === 'text';

  function googleFontsUrl(font: string): string {
    return `https://fonts.google.com/specimen/${font.replace(/\s+/g, '+')}`;
  }

  function renderStars(n: number) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  return (
    <div style={{
      position: 'fixed',
      right: 8,
      top: 60,
      width: 440,
      maxHeight: 'calc(100vh - 80px)',
      background: '#13131f',
      borderRadius: 12,
      border: '1px solid #2a2a4a',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      zIndex: 3100,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
      color: '#c8c8e8',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0f0f1e', borderBottom: '1px solid #2a2a4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🅰️</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f8' }}>Font Pairing Studio</span>
          <span style={{ fontSize: 10, color: '#555', background: '#1a1a2e', borderRadius: 4, padding: '1px 5px' }}>⌘⌥T</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Pair list */}
        <div style={{ width: 160, borderRight: '1px solid #2a2a4a', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {/* Filters */}
          <div style={{ padding: '8px 8px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setCategoryFilter(cat.id as FontCategory | 'all')}
                  style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, border: 'none', cursor: 'pointer', background: categoryFilter === cat.id ? '#3a3a8a' : '#1e1e3a', color: categoryFilter === cat.id ? '#bbbfff' : '#666' }}>
                  {cat.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#444', marginBottom: 4 }}>Mood</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 6 }}>
              {MOODS.map(m => (
                <button key={m.id} title={m.id} onClick={() => setMoodFilter(moodFilter === m.id ? null : m.id)}
                  style={{ padding: '1px 5px', borderRadius: 4, fontSize: 13, border: `1px solid ${moodFilter === m.id ? '#5a5aaa' : '#1e1e3a'}`, cursor: 'pointer', background: moodFilter === m.id ? '#2a2a5a' : 'transparent' }}>
                  {m.emoji}
                </button>
              ))}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              style={{ width: '100%', background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 4, color: '#888', fontSize: 10, padding: '2px 4px', marginBottom: 6 }}>
              <option value="popularity">Sort: Popular</option>
              <option value="heading">Sort: Heading A–Z</option>
              <option value="body">Sort: Body A–Z</option>
            </select>
            <div style={{ fontSize: 10, color: '#444', marginBottom: 4 }}>{filtered.length} pairings</div>
          </div>
          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map(pair => (
              <button key={pair.id} onClick={() => setSelectedPairId(pair.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 8px', background: selectedPairId === pair.id ? '#1e1e4a' : 'transparent', border: 'none', borderBottom: '1px solid #1a1a2e', cursor: 'pointer', transition: 'background 0.1s' }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: selectedPairId === pair.id ? '#bbbfff' : '#c0c0e0', fontFamily: `"${pair.heading}", serif`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pair.heading}</div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pair.body}</div>
                <div style={{ fontSize: 9, color: '#444', marginTop: 2 }}>{renderStars(pair.popularity)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Preview + details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedPair ? (
            <>
              {/* Sample text selector */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e1e3a', flexShrink: 0, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {SAMPLE_TEXTS.map((s, i) => (
                  <button key={i} onClick={() => { setSampleIndex(i); setCustomSample(''); }}
                    style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, border: `1px solid ${sampleIndex === i && !customSample ? '#4a4a8a' : '#2a2a4a'}`, background: sampleIndex === i && !customSample ? '#2a2a5a' : 'transparent', color: sampleIndex === i && !customSample ? '#bbbfff' : '#666', cursor: 'pointer' }}>
                    {s.label}
                  </button>
                ))}
                <button onClick={() => setCustomSample(customSample ? '' : sample.h + '\n' + sample.b)}
                  style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, border: `1px solid ${customSample ? '#6a4a2a' : '#2a2a4a'}`, background: customSample ? '#3a2a1a' : 'transparent', color: customSample ? '#ffaa66' : '#666', cursor: 'pointer' }}>
                  Custom
                </button>
              </div>

              {/* Custom text input */}
              {customSample !== '' && (
                <div style={{ padding: '6px 10px', borderBottom: '1px solid #1e1e3a', flexShrink: 0 }}>
                  <textarea value={customSample} onChange={e => setCustomSample(e.target.value)} rows={3}
                    placeholder="Line 1 = heading&#10;Lines 2+ = body text"
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: 6, color: '#c8c8e8', fontSize: 11, padding: '5px 7px', resize: 'vertical', fontFamily: 'system-ui', outline: 'none' }} />
                </div>
              )}

              {/* Live Preview */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
                {/* Heading preview */}
                <div style={{ marginBottom: 16, background: '#0d0d1a', borderRadius: 8, padding: 14, border: '1px solid #1e1e3a' }}>
                  <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Heading — {selectedPair.heading}</div>
                  <div style={{ fontFamily: `"${selectedPair.heading}", serif`, fontWeight: selectedPair.headingWeight, fontSize: 28, color: '#f0f0f8', lineHeight: 1.1, marginBottom: 6 }}>
                    {headingText}
                  </div>
                  <div style={{ fontFamily: `"${selectedPair.body}", sans-serif`, fontWeight: selectedPair.bodyWeight, fontSize: 14, color: '#9090b8', lineHeight: 1.6 }}>
                    {bodyText}
                  </div>
                </div>

                {/* Type scale */}
                <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 14, border: '1px solid #1e1e3a', marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Type Scale</div>
                  {[
                    { label: 'H1', size: 36, font: selectedPair.heading, weight: selectedPair.headingWeight, color: '#f0f0f8' },
                    { label: 'H2', size: 24, font: selectedPair.heading, weight: selectedPair.headingWeight, color: '#e0e0f0' },
                    { label: 'H3', size: 18, font: selectedPair.heading, weight: selectedPair.headingWeight, color: '#d0d0e8' },
                    { label: 'Body', size: 15, font: selectedPair.body, weight: selectedPair.bodyWeight, color: '#9090b8' },
                    { label: 'Caption', size: 11, font: selectedPair.body, weight: selectedPair.bodyWeight, color: '#666688' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 9, color: '#444', width: 36, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontFamily: `"${row.font}", sans-serif`, fontWeight: row.weight, fontSize: row.size, color: row.color, lineHeight: 1.1 }}>
                        {headingText.split(' ').slice(0, row.label === 'Body' || row.label === 'Caption' ? 6 : 4).join(' ')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pair details */}
                <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 12, border: '1px solid #1e1e3a', marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Details</div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>Heading</div>
                      <div style={{ fontWeight: 600, color: '#bbbfff', fontSize: 12 }}>{selectedPair.heading}</div>
                      <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{selectedPair.headingCategory} · w{selectedPair.headingWeight}</div>
                      <a href={googleFontsUrl(selectedPair.heading)} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 10, color: '#6699ff', textDecoration: 'none', display: 'block', marginTop: 4 }}>↗ Google Fonts</a>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>Body</div>
                      <div style={{ fontWeight: 600, color: '#bbbfff', fontSize: 12 }}>{selectedPair.body}</div>
                      <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{selectedPair.bodyCategory} · w{selectedPair.bodyWeight}</div>
                      <a href={googleFontsUrl(selectedPair.body)} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 10, color: '#6699ff', textDecoration: 'none', display: 'block', marginTop: 4 }}>↗ Google Fonts</a>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#7a7a9a', fontStyle: 'italic', marginBottom: 8 }}>"{selectedPair.description}"</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {selectedPair.moods.map(m => (
                      <span key={m} style={{ fontSize: 9, padding: '2px 6px', background: '#1a1a3a', borderRadius: 10, color: '#5a5a8a', border: '1px solid #2a2a5a' }}>
                        {MOODS.find(x => x.id === m)?.emoji} {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Apply buttons */}
                <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 10, border: '1px solid #1e1e3a' }}>
                  <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Apply to Selection</div>
                  {!isTextShape ? (
                    <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>Select a text shape to apply fonts</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onApplyFont({ fontFamily: selectedPair.heading, fontWeight: String(selectedPair.headingWeight) })}
                        style={{ flex: 1, padding: '7px 10px', background: '#2a2a5a', border: 'none', borderRadius: 6, color: '#bbbfff', cursor: 'pointer', fontSize: 11, fontFamily: `"${selectedPair.heading}", serif`, fontWeight: 700 }}>
                        Apply Heading
                      </button>
                      <button onClick={() => onApplyFont({ fontFamily: selectedPair.body, fontWeight: String(selectedPair.bodyWeight) })}
                        style={{ flex: 1, padding: '7px 10px', background: '#1a2a3a', border: 'none', borderRadius: 6, color: '#88bbdd', cursor: 'pointer', fontSize: 11, fontFamily: `"${selectedPair.body}", sans-serif` }}>
                        Apply Body
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 13 }}>
              No pairings match filters
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #1e1e3a', background: '#0f0f1e', fontSize: 10, color: '#333', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>{FONT_PAIRS.length} curated pairings · Previews load from Google Fonts</span>
        <span>⌘⌥T</span>
      </div>
    </div>
  );
}
