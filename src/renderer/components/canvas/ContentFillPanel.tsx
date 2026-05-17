/**
 * ContentFillPanel — Fill selected shapes with realistic placeholder content.
 *
 * Categories: Photos, Avatars, Icons, Text (Lorem), Data, Maps, Colors.
 * Uses picsum.photos (no API key), DiceBear avatars, and local generators.
 *
 * Shortcut: ⌘⇧⌥C
 */

import React, { useState, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Content categories ───────────────────────────────────────────────────────

type Category = 'photos' | 'avatars' | 'icons' | 'text' | 'data' | 'gradients' | 'patterns';

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'photos', label: 'Photos', icon: '🖼' },
  { id: 'avatars', label: 'Avatars', icon: '👤' },
  { id: 'icons', label: 'Icons', icon: '⬟' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'data', label: 'Data', icon: '📊' },
  { id: 'gradients', label: 'Gradients', icon: '◐' },
  { id: 'patterns', label: 'Patterns', icon: '⬡' },
];

// ─── Photo topics ─────────────────────────────────────────────────────────────

const PHOTO_TOPICS = [
  { label: 'Nature', seed: 'nature' },
  { label: 'City', seed: 'city' },
  { label: 'Architecture', seed: 'architecture' },
  { label: 'Food', seed: 'food' },
  { label: 'Tech', seed: 'technology' },
  { label: 'People', seed: 'people' },
  { label: 'Abstract', seed: 'abstract' },
  { label: 'Fashion', seed: 'fashion' },
  { label: 'Travel', seed: 'travel' },
  { label: 'Animals', seed: 'animals' },
  { label: 'Random', seed: '' },
];

// Picsum (uses sequential IDs) - seed offset changes the image
function picsumUrl(w: number, h: number, seed: number, grayscale = false) {
  const base = `https://picsum.photos/seed/${seed}/${Math.round(w)}/${Math.round(h)}`;
  return grayscale ? `${base}?grayscale` : base;
}

// ─── Avatar styles ────────────────────────────────────────────────────────────

const AVATAR_STYLES = [
  { label: 'Pixel Art', style: 'pixel-art' },
  { label: 'Avataaars', style: 'avataaars' },
  { label: 'Bottts', style: 'bottts' },
  { label: 'Initials', style: 'initials' },
  { label: 'Identicon', style: 'identicon' },
  { label: 'Shapes', style: 'shapes' },
  { label: 'Lorelei', style: 'lorelei' },
  { label: 'Notionists', style: 'notionists' },
];

function avatarUrl(style: string, seed: string | number, size: number = 128) {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&size=${size}`;
}

// ─── Lorem ipsum generator ────────────────────────────────────────────────────

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation',
  'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo', 'consequat',
  'duis', 'aute', 'irure', 'reprehenderit', 'in', 'voluptate', 'velit', 'esse',
  'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint', 'occaecat', 'cupidatat',
  'non', 'proident', 'sunt', 'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim',
];

const REAL_NAMES = [
  'Emma Johnson', 'Liam Williams', 'Olivia Brown', 'Noah Jones', 'Ava Davis',
  'Elijah Miller', 'Sophia Wilson', 'James Moore', 'Isabella Taylor', 'Oliver Anderson',
  'Mia Thomas', 'Benjamin Jackson', 'Charlotte White', 'Lucas Harris', 'Amelia Martin',
];

const PRODUCT_NAMES = [
  'Wireless Headphones Pro', 'Smart Watch Series X', 'Running Shoes Elite',
  'Coffee Maker Deluxe', 'Backpack Ultra', 'Laptop Stand Pro', 'Desk Organizer',
  'Mechanical Keyboard', 'Ergonomic Mouse', 'Monitor Light Bar',
];

const PRICES = ['$19.99', '$29.99', '$49.99', '$79.99', '$99.99', '$149.99', '$199.99', '$299.99'];

function lorem(words: number): string {
  const result: string[] = [];
  for (let i = 0; i < words; i++) {
    result.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]);
  }
  const text = result.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Text presets ─────────────────────────────────────────────────────────────

const TEXT_PRESETS = [
  { label: 'Heading', fn: () => lorem(Math.floor(Math.random() * 3) + 2) },
  { label: 'Subheading', fn: () => lorem(Math.floor(Math.random() * 5) + 4) },
  { label: 'Body text', fn: () => lorem(Math.floor(Math.random() * 20) + 15) },
  { label: 'Short para', fn: () => lorem(Math.floor(Math.random() * 10) + 8) },
  { label: 'Full name', fn: () => pick(REAL_NAMES) },
  { label: 'First name', fn: () => pick(REAL_NAMES).split(' ')[0] },
  { label: 'Product', fn: () => pick(PRODUCT_NAMES) },
  { label: 'Price', fn: () => pick(PRICES) },
  { label: 'Email', fn: () => `${pick(REAL_NAMES).split(' ')[0].toLowerCase()}@example.com` },
  { label: 'Phone', fn: () => `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}` },
  { label: 'Date', fn: () => new Date(Date.now() - Math.random() * 1e10).toLocaleDateString() },
  { label: 'URL', fn: () => `https://example.com/${lorem(1).toLowerCase()}` },
  { label: 'Badge text', fn: () => pick(['New', 'Sale', 'Hot', 'Featured', 'Pro', 'Beta', 'Free']) },
  { label: 'Button', fn: () => pick(['Get Started', 'Learn More', 'Sign Up', 'Try Free', 'Buy Now', 'Download']) },
];

// ─── Gradient presets ─────────────────────────────────────────────────────────

const GRADIENT_PRESETS = [
  { label: 'Sunset', stops: ['#ff6b6b', '#feca57', '#ff9ff3'] },
  { label: 'Ocean', stops: ['#0652dd', '#1289a7', '#c4e538'] },
  { label: 'Forest', stops: ['#00b894', '#00cec9', '#fdcb6e'] },
  { label: 'Candy', stops: ['#fd79a8', '#e17055', '#fdcb6e'] },
  { label: 'Night', stops: ['#2c3e50', '#3498db', '#9b59b6'] },
  { label: 'Aurora', stops: ['#00c6ff', '#0072ff', '#6c3483'] },
  { label: 'Peach', stops: ['#FFDDE1', '#EE9CA7', '#F3904F'] },
  { label: 'Mint', stops: ['#00b09b', '#96c93d'] },
  { label: 'Fire', stops: ['#f83600', '#f9d423'] },
  { label: 'Lavender', stops: ['#c471ed', '#12c2e9', '#f64f59'] },
  { label: 'Gold', stops: ['#F7971E', '#FFD200'] },
  { label: 'Rose', stops: ['#F4A261', '#E63946'] },
];

// SVG pattern generators
function svgPattern(type: string, fg: string, bg: string): string {
  switch (type) {
    case 'dots': return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${bg}"/><circle cx="10" cy="10" r="2" fill="${fg}"/></svg>`;
    case 'lines': return `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${bg}"/><line x1="0" y1="0" x2="10" y2="10" stroke="${fg}" stroke-width="1"/></svg>`;
    case 'grid': return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${bg}"/><path d="M20 0L0 0L0 20" stroke="${fg}" stroke-width="0.5" fill="none"/></svg>`;
    case 'chevron': return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${bg}"/><polyline points="0,10 10,0 20,10 10,20 0,10" stroke="${fg}" stroke-width="1" fill="none"/></svg>`;
    case 'hex': return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="24"><rect width="28" height="24" fill="${bg}"/><polygon points="14,2 24,7 24,17 14,22 4,17 4,7" fill="none" stroke="${fg}" stroke-width="0.8"/></svg>`;
    default: return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${bg}"/></svg>`;
  }
}

const PATTERN_DEFS = [
  { label: 'Dots', type: 'dots' },
  { label: 'Lines', type: 'lines' },
  { label: 'Grid', type: 'grid' },
  { label: 'Chevron', type: 'chevron' },
  { label: 'Hexagon', type: 'hex' },
];

// ─── Data chart placeholders ──────────────────────────────────────────────────

function makeBars(count: number): string {
  const bars: string[] = [];
  const w = 200;
  const h = 100;
  const barW = Math.floor(w / count) - 4;
  for (let i = 0; i < count; i++) {
    const barH = Math.floor(Math.random() * 70) + 20;
    const x = i * (w / count) + 2;
    const y = h - barH;
    bars.push(`<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="2" fill="#6366f1" opacity="${0.6 + Math.random() * 0.4}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="background:#1e1e2e"><line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="#444" stroke-width="1"/>${bars.join('')}</svg>`;
}

function makeLineChart(): string {
  const w = 200; const h = 100;
  const points = Array.from({ length: 8 }, (_, i) => {
    const x = 10 + i * (w - 20) / 7;
    const y = 10 + Math.random() * (h - 20);
    return `${x},${y}`;
  });
  const area = `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(' ') + ` L ${w - 10},${h - 5} L 10,${h - 5} Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:#1e1e2e"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity="0.4"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#g)"/><polyline points="${points.join(' ')}" fill="none" stroke="#6366f1" stroke-width="2" stroke-linejoin="round"/>${points.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="#6366f1"/>`).join('')}</svg>`;
}

function makeDonut(): string {
  const cx = 50; const cy = 50; const r = 35; const ir = 22;
  const slices = [
    { pct: 0.4, color: '#6366f1' },
    { pct: 0.25, color: '#10b981' },
    { pct: 0.2, color: '#f59e0b' },
    { pct: 0.15, color: '#ef4444' },
  ];
  let startAngle = -90;
  const paths: string[] = [];
  for (const { pct, color } of slices) {
    const angle = pct * 360;
    const end = startAngle + angle;
    const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
    const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
    const x2 = cx + r * Math.cos((end * Math.PI) / 180);
    const y2 = cy + r * Math.sin((end * Math.PI) / 180);
    const xi1 = cx + ir * Math.cos((startAngle * Math.PI) / 180);
    const yi1 = cy + ir * Math.sin((startAngle * Math.PI) / 180);
    const xi2 = cx + ir * Math.cos((end * Math.PI) / 180);
    const yi2 = cy + ir * Math.sin((end * Math.PI) / 180);
    const large = angle > 180 ? 1 : 0;
    paths.push(`<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1} Z" fill="${color}"/>`);
    startAngle = end;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" style="background:transparent">${paths.join('')}<circle cx="${cx}" cy="${cy}" r="${ir - 2}" fill="#1e1e2e"/></svg>`;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/"/g, "'")}`;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShapeIds: string[];
  shapes: Shape[];
  onUpdateShapes: (ids: string[], patch: Partial<Shape>) => void;
  onUpdateText: (id: string, text: string) => void;
}

export function ContentFillPanel({ open, onClose, selectedShapeIds, shapes, onUpdateShapes, onUpdateText }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('photos');
  const [photoTopic, setPhotoTopic] = useState(0);
  const [grayscale, setGrayscale] = useState(false);
  const [avatarStyle, setAvatarStyle] = useState(0);
  const [patternFg, setPatternFg] = useState('#6366f1');
  const [patternBg, setPatternBg] = useState('#1e1e2e');
  const [lastSeed, setLastSeed] = useState(1);

  const selCount = selectedShapeIds.length;
  const selectedShapes = shapes.filter(s => selectedShapeIds.includes(s.id));

  const applyImage = useCallback((url: string) => {
    if (selectedShapeIds.length === 0) return;
    onUpdateShapes(selectedShapeIds, {
      fillType: 'image' as const,
      imageUrl: url,
      imageFit: 'fill' as const,
    });
  }, [selectedShapeIds, onUpdateShapes]);

  const applyFill = useCallback((fill: string) => {
    if (selectedShapeIds.length === 0) return;
    onUpdateShapes(selectedShapeIds, { fill, fillType: 'solid' as const });
  }, [selectedShapeIds, onUpdateShapes]);

  const applyText = useCallback((text: string) => {
    const textShapes = selectedShapes.filter(s => s.type === 'text');
    if (textShapes.length === 0) return;
    for (const s of textShapes) {
      onUpdateText(s.id, text);
    }
  }, [selectedShapes, onUpdateText]);

  const nextSeed = () => { const s = lastSeed + 1; setLastSeed(s); return s; };

  if (!open) return null;

  const topic = PHOTO_TOPICS[photoTopic];

  return (
    <div style={{
      position: 'absolute', top: 48, right: 8, width: 300,
      maxHeight: 'calc(100vh - 120px)',
      background: 'var(--panel, #1e1e2e)',
      border: '1px solid var(--border, #2d2d3d)',
      borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      zIndex: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>✦</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)', flex: 1 }}>Content Fill</span>
        {selCount > 0 && (
          <span style={{ fontSize: 10, color: 'var(--accent, #6366f1)' }}>{selCount} selected</span>
        )}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', padding: '6px 8px', gap: 4, borderBottom: '1px solid var(--border, #2d2d3d)', flexWrap: 'wrap', flexShrink: 0 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: '3px 8px', border: `1px solid ${activeCategory === cat.id ? 'var(--accent, #6366f1)' : 'transparent'}`,
              borderRadius: 12,
              background: activeCategory === cat.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: activeCategory === cat.id ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
              fontSize: 10, cursor: 'pointer', fontWeight: activeCategory === cat.id ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            <span>{cat.icon}</span> {cat.label}
          </button>
        ))}
      </div>

      {/* No selection warning */}
      {selCount === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--muted, #888)', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid var(--border, #2d2d3d)', flexShrink: 0 }}>
          ⚠ Select one or more shapes to fill
        </div>
      )}

      <div style={{ overflowY: 'auto', flex: 1 }}>

        {/* ── Photos ── */}
        {activeCategory === 'photos' && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 8 }}>Topic</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {PHOTO_TOPICS.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setPhotoTopic(i)}
                  style={{
                    padding: '3px 8px', border: `1px solid ${photoTopic === i ? 'var(--accent, #6366f1)' : 'var(--border, #2d2d3d)'}`,
                    borderRadius: 10,
                    background: photoTopic === i ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: photoTopic === i ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                    fontSize: 10, cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={grayscale} onChange={e => setGrayscale(e.target.checked)} />
              <span style={{ fontSize: 11, color: 'var(--text, #e2e8f0)' }}>Grayscale</span>
            </label>

            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 6 }}>Preview & Apply</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {Array.from({ length: 9 }, (_, i) => {
                const seed = topic.seed ? `${topic.seed}-${i + 1}` : String(i + lastSeed * 10);
                const shape = selectedShapes[0];
                const w = shape ? Math.min(shape.width, 400) : 200;
                const h = shape ? Math.min(shape.height, 400) : 200;
                const url = picsumUrl(w, h, typeof seed === 'string' ? seed.length * (i + 1) : i, grayscale);
                return (
                  <div
                    key={i}
                    onClick={() => { applyImage(picsumUrl(w, h, typeof seed === 'string' ? seed.length * (i + 1) : i, grayscale)); }}
                    style={{
                      aspectRatio: '1', borderRadius: 5, overflow: 'hidden', cursor: 'pointer',
                      border: '1px solid var(--border, #2d2d3d)',
                      backgroundImage: `url(${url})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      transition: 'transform 0.1s, border-color 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent, #6366f1)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)')}
                    title={`Apply photo ${i + 1}`}
                  />
                );
              })}
            </div>

            <button
              onClick={() => {
                const s = nextSeed();
                const shape = selectedShapes[0];
                const w = shape ? Math.min(shape.width, 800) : 800;
                const h = shape ? Math.min(shape.height, 600) : 600;
                const url = picsumUrl(w, h, s * 7, grayscale);
                applyImage(url);
              }}
              style={{
                marginTop: 10, width: '100%', padding: '7px', borderRadius: 6,
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                color: 'var(--accent, #6366f1)', fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Apply Random Photo
            </button>
          </div>
        )}

        {/* ── Avatars ── */}
        {activeCategory === 'avatars' && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 8 }}>Style</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {AVATAR_STYLES.map((s, i) => (
                <button key={i} onClick={() => setAvatarStyle(i)}
                  style={{
                    padding: '3px 8px', border: `1px solid ${avatarStyle === i ? 'var(--accent, #6366f1)' : 'var(--border, #2d2d3d)'}`,
                    borderRadius: 10, background: avatarStyle === i ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: avatarStyle === i ? 'var(--accent, #6366f1)' : 'var(--muted, #888)',
                    fontSize: 10, cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 6 }}>Click to apply</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {Array.from({ length: 15 }, (_, i) => {
                const seed = REAL_NAMES[i % REAL_NAMES.length].replace(' ', '');
                const style = AVATAR_STYLES[avatarStyle].style;
                const url = avatarUrl(style, seed + i, 80);
                return (
                  <div
                    key={i}
                    onClick={() => applyImage(url)}
                    style={{
                      aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                      border: '2px solid var(--border, #2d2d3d)',
                      backgroundImage: `url(${url})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      background: '#2a2a3a',
                      transition: 'border-color 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent, #6366f1)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)')}
                    title={REAL_NAMES[i % REAL_NAMES.length]}
                  />
                );
              })}
            </div>

            <button
              onClick={() => {
                const style = AVATAR_STYLES[avatarStyle].style;
                const seed = Math.random().toString(36).slice(2, 8);
                applyImage(avatarUrl(style, seed, 256));
              }}
              style={{
                marginTop: 10, width: '100%', padding: '7px', borderRadius: 6,
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                color: 'var(--accent, #6366f1)', fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Apply Random Avatar
            </button>
          </div>
        )}

        {/* ── Icons ── */}
        {activeCategory === 'icons' && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted, #888)', marginBottom: 12 }}>
              Apply a simple SVG icon as fill. Works best on square shapes.
            </div>
            {[
              { label: '⬟ Shapes', icons: ['▲', '◆', '●', '■', '⬡', '⭐', '♥', '✦'] },
              { label: '→ Arrows', icons: ['→', '←', '↑', '↓', '↗', '↙', '⟶', '⇒'] },
              { label: '✓ UI', icons: ['✓', '✕', '＋', '—', '…', '≡', '⊕', '⊖'] },
              { label: '◎ Media', icons: ['▶', '⏸', '⏹', '⏭', '◀', '⏮', '🔊', '🔇'] },
            ].map(group => (
              <div key={group.label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 6 }}>{group.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
                  {group.icons.map((icon, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const shape = selectedShapes[0];
                        const w = shape?.width ?? 100;
                        const h = shape?.height ?? 100;
                        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><text x="${w/2}" y="${h/2 + h * 0.15}" text-anchor="middle" font-size="${Math.min(w,h) * 0.6}" fill="%23e2e8f0">${icon}</text></svg>`;
                        applyImage(`data:image/svg+xml,${svg}`);
                      }}
                      style={{
                        aspectRatio: '1', background: 'var(--surface2, #2a2a3a)',
                        border: '1px solid var(--border, #2d2d3d)', borderRadius: 5,
                        color: 'var(--text, #e2e8f0)', fontSize: 16, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent, #6366f1)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)')}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Text ── */}
        {activeCategory === 'text' && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 8 }}>
              Click to fill selected text shapes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {TEXT_PRESETS.map((preset) => {
                const preview = preset.fn();
                return (
                  <button
                    key={preset.label}
                    onClick={() => applyText(preset.fn())}
                    style={{
                      padding: '8px 10px', background: 'var(--surface2, #2a2a3a)',
                      border: '1px solid var(--border, #2d2d3d)', borderRadius: 6,
                      cursor: 'pointer', textAlign: 'left',
                      display: 'flex', flexDirection: 'column', gap: 2,
                      transition: 'border-color 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent, #6366f1)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)')}
                  >
                    <span style={{ fontSize: 10, color: 'var(--accent, #6366f1)', fontWeight: 600 }}>{preset.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text, #e2e8f0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {preview}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Data ── */}
        {activeCategory === 'data' && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 8 }}>Click to apply chart as fill</div>
            {[
              { label: 'Bar Chart (5 bars)', fn: () => makeBars(5) },
              { label: 'Bar Chart (8 bars)', fn: () => makeBars(8) },
              { label: 'Line Chart', fn: () => makeLineChart() },
              { label: 'Donut Chart', fn: () => makeDonut() },
            ].map(chart => {
              const svg = chart.fn();
              return (
                <div key={chart.label} style={{ marginBottom: 8 }}>
                  <div
                    onClick={() => applyImage(svgToDataUri(svg))}
                    style={{
                      borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                      border: '1px solid var(--border, #2d2d3d)',
                      backgroundImage: `url(${svgToDataUri(svg)})`,
                      backgroundSize: 'contain', backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center', height: 60, background: '#1e1e2e',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent, #6366f1)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)')}
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 3 }}>{chart.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Gradients ── */}
        {activeCategory === 'gradients' && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 8 }}>Click to apply gradient fill</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {GRADIENT_PRESETS.map(grad => {
                const stops = grad.stops.map((c, i) => `${c} ${Math.round(i / (grad.stops.length - 1) * 100)}%`).join(', ');
                const cssGrad = `linear-gradient(135deg, ${stops})`;
                return (
                  <div
                    key={grad.label}
                    onClick={() => {
                      // Apply as gradient fill type
                      onUpdateShapes(selectedShapeIds, {
                        fillType: 'linear-gradient' as const,
                        gradientAngle: 135,
                        gradientStops: grad.stops.map((color, i) => ({
                          color,
                          position: i / (grad.stops.length - 1),
                        })),
                      });
                    }}
                    style={{
                      height: 48, borderRadius: 6, cursor: 'pointer',
                      background: cssGrad,
                      border: '2px solid transparent',
                      display: 'flex', alignItems: 'flex-end', padding: '4px 6px',
                      transition: 'border-color 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                    title={`Apply ${grad.label} gradient`}
                  >
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                      {grad.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Patterns ── */}
        {activeCategory === 'patterns' && (
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Foreground</div>
                <input type="color" value={patternFg} onChange={e => setPatternFg(e.target.value)}
                  style={{ width: '100%', height: 28, cursor: 'pointer', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Background</div>
                <input type="color" value={patternBg} onChange={e => setPatternBg(e.target.value)}
                  style={{ width: '100%', height: 28, cursor: 'pointer', border: '1px solid var(--border, #2d2d3d)', borderRadius: 4 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PATTERN_DEFS.map(pat => {
                const svg = svgPattern(pat.type, patternFg, patternBg);
                const uri = svgToDataUri(svg);
                return (
                  <div
                    key={pat.type}
                    onClick={() => applyImage(uri)}
                    style={{
                      height: 60, borderRadius: 6, cursor: 'pointer',
                      backgroundImage: `url(${uri})`,
                      backgroundRepeat: 'repeat',
                      border: '1px solid var(--border, #2d2d3d)',
                      display: 'flex', alignItems: 'flex-end', padding: '4px 6px',
                      transition: 'border-color 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent, #6366f1)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)')}
                  >
                    <span style={{ fontSize: 10, color: patternFg === '#ffffff' || patternFg === '#fff' ? '#000' : '#fff', fontWeight: 600, background: 'rgba(0,0,0,0.5)', padding: '1px 4px', borderRadius: 3 }}>
                      {pat.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
