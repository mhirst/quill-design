/**
 * ImageFillPanel — Quick image fill for shapes.
 *
 * Provides a curated grid of placeholder photos from picsum.photos
 * and a custom URL input. Click any image to apply it as the fill
 * of the currently selected shape(s).
 *
 * Features:
 * - Category-filtered grid (Nature, Architecture, People, Abstract, Food, Tech, Animals)
 * - Custom URL / paste any image URL
 * - Grayscale / color toggle per category
 * - Size variants: Portrait, Landscape, Square
 * - Click to apply as imageFill on selected shape(s)
 * - Hover shows "Apply" overlay with image name
 * - Recent images: last 12 used images are shown first
 * - Random refresh per category
 */

import React, { useCallback, useState, useMemo } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onApplyFill: (ids: string[], imageUrl: string) => void;
}

type Category = {
  id: string;
  label: string;
  seed: number; // starting seed offset for picsum
  emoji: string;
};

type AspectRatio = 'square' | 'landscape' | 'portrait';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  { id: 'nature', label: 'Nature', seed: 10, emoji: '🌿' },
  { id: 'architecture', label: 'Architecture', seed: 100, emoji: '🏛' },
  { id: 'people', label: 'People', seed: 200, emoji: '👤' },
  { id: 'abstract', label: 'Abstract', seed: 300, emoji: '◈' },
  { id: 'travel', label: 'Travel', seed: 400, emoji: '✈' },
  { id: 'tech', label: 'Tech', seed: 500, emoji: '💻' },
  { id: 'animals', label: 'Animals', seed: 600, emoji: '🦋' },
  { id: 'food', label: 'Food', seed: 700, emoji: '🍃' },
];

const GRID_COLS = 3;
const GRID_COUNT = 12;

const ASPECT_DIMS: Record<AspectRatio, [number, number]> = {
  square: [400, 400],
  landscape: [600, 400],
  portrait: [400, 600],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPicsumUrl(seed: number, w: number, h: number, grayscale: boolean): string {
  const base = `https://picsum.photos/seed/${seed}/${w}/${h}`;
  return grayscale ? `${base}?grayscale` : base;
}

function buildThumbUrl(seed: number, grayscale: boolean): string {
  return buildPicsumUrl(seed, 120, 80, grayscale);
}

// ── Image Tile ────────────────────────────────────────────────────────────────

function ImageTile({
  seed,
  grayscale,
  onApply,
}: {
  seed: number;
  grayscale: boolean;
  onApply: (url: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const thumbUrl = buildThumbUrl(seed, grayscale);

  const handleApply = () => {
    // Use full-size URL when applying
    const [w, h] = ASPECT_DIMS['square'];
    const fullUrl = buildPicsumUrl(seed, w, h, grayscale);
    onApply(fullUrl);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingTop: '66.7%', // 3:2 aspect ratio
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        background: errored ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
        transition: 'transform 0.12s, box-shadow 0.12s',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.5)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleApply}
    >
      {/* Image */}
      {!errored && (
        <img
          src={thumbUrl}
          alt={`Photo ${seed}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        />
      )}

      {/* Loading skeleton */}
      {!loaded && !errored && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }} />
      )}

      {/* Error state */}
      {errored && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: '#334155',
        }}>
          🖼
        </div>
      )}

      {/* Hover overlay */}
      {hovered && !errored && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(99,102,241,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}>
            <span style={{ fontSize: 16 }}>↓</span>
            <span>Apply Fill</span>
          </div>
        </div>
      )}

      {/* Seed number (bottom right) */}
      <div style={{
        position: 'absolute',
        bottom: 3,
        right: 4,
        fontSize: 8,
        color: 'rgba(255,255,255,0.2)',
        fontFamily: 'monospace',
        pointerEvents: 'none',
      }}>
        #{seed}
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ImageFillPanel({
  open,
  onClose,
  selectedShape,
  selectedShapeIds,
  onApplyFill,
}: Props) {
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [grayscale, setGrayscale] = useState(false);
  const [aspect, setAspect] = useState<AspectRatio>('square');
  const [customUrl, setCustomUrl] = useState('');
  const [customApplied, setCustomApplied] = useState(false);
  const [seedOffset, setSeedOffset] = useState(0);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);

  const seeds = useMemo(() => {
    return Array.from({ length: GRID_COUNT }, (_, i) => category.seed + i + seedOffset);
  }, [category, seedOffset]);

  const getTargetIds = useCallback((): string[] => {
    if (selectedShapeIds.length > 0) return selectedShapeIds;
    if (selectedShape) return [selectedShape.id];
    return [];
  }, [selectedShape, selectedShapeIds]);

  const applyFill = useCallback((url: string) => {
    const ids = getTargetIds();
    if (ids.length === 0) return;
    onApplyFill(ids, url);
    setRecentUrls(prev => [url, ...prev.filter(u => u !== url)].slice(0, 12));
  }, [getTargetIds, onApplyFill]);

  const applyFullSizeFill = useCallback((seed: number) => {
    const [w, h] = ASPECT_DIMS[aspect];
    const url = buildPicsumUrl(seed, w, h, grayscale);
    applyFill(url);
  }, [aspect, grayscale, applyFill]);

  const applyCustomUrl = useCallback(() => {
    if (!customUrl.trim()) return;
    applyFill(customUrl.trim());
    setCustomApplied(true);
    setTimeout(() => setCustomApplied(false), 1500);
  }, [customUrl, applyFill]);

  if (!open) return null;

  const targetCount = getTargetIds().length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '60px 16px 16px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 320,
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: 'linear-gradient(135deg,rgba(12,12,22,0.98),rgba(18,12,28,0.98))',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
          fontFamily: 'system-ui,-apple-system,sans-serif',
          color: '#e2e8f0',
          pointerEvents: 'all',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>🖼 Image Fill</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
              {targetCount > 0
                ? `Applying to ${targetCount} shape${targetCount !== 1 ? 's' : ''}`
                : 'Select a shape first'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Category tabs */}
        <div style={{
          padding: '8px 12px',
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setCategory(cat); setSeedOffset(0); }}
              style={{
                padding: '4px 8px',
                fontSize: 10,
                borderRadius: 5,
                border: `1px solid ${category.id === cat.id ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.06)'}`,
                background: category.id === cat.id ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.02)',
                color: category.id === cat.id ? '#c7d2fe' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Options row */}
        <div style={{
          padding: '8px 12px',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexWrap: 'wrap',
        }}>
          {/* Aspect ratio */}
          {(['square', 'landscape', 'portrait'] as AspectRatio[]).map(a => (
            <button
              key={a}
              onClick={() => setAspect(a)}
              style={{
                padding: '3px 7px',
                fontSize: 10,
                borderRadius: 4,
                border: `1px solid ${aspect === a ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                background: aspect === a ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: aspect === a ? '#818cf8' : '#475569',
                cursor: 'pointer',
              }}
            >
              {a === 'square' ? '■' : a === 'landscape' ? '▬' : '▮'} {a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Grayscale toggle */}
          <button
            onClick={() => setGrayscale(g => !g)}
            style={{
              padding: '3px 7px',
              fontSize: 10,
              borderRadius: 4,
              border: `1px solid ${grayscale ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
              background: grayscale ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: grayscale ? '#e2e8f0' : '#475569',
              cursor: 'pointer',
            }}
          >
            ⬛ B&W
          </button>

          {/* Refresh / next batch */}
          <button
            onClick={() => setSeedOffset(o => o + GRID_COUNT)}
            style={{
              padding: '3px 7px',
              fontSize: 10,
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'transparent',
              color: '#475569',
              cursor: 'pointer',
            }}
            title="Load next batch"
          >
            ↻ Next
          </button>
        </div>

        {/* Shimmer keyframe */}
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>

        {/* Image grid */}
        <div style={{
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gap: 6,
        }}>
          {seeds.map(seed => (
            <ImageTile
              key={seed}
              seed={seed}
              grayscale={grayscale}
              onApply={() => applyFullSizeFill(seed)}
            />
          ))}
        </div>

        {/* Custom URL input */}
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>Custom image URL</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyCustomUrl(); }}
              placeholder="https://example.com/image.jpg"
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: '#e2e8f0',
                fontSize: 11,
                outline: 'none',
                fontFamily: 'ui-monospace,monospace',
              }}
            />
            <button
              onClick={applyCustomUrl}
              disabled={!customUrl.trim() || targetCount === 0}
              style={{
                padding: '6px 10px',
                fontSize: 11,
                borderRadius: 6,
                border: '1px solid rgba(99,102,241,0.4)',
                background: customApplied ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.15)',
                color: customApplied ? '#6ee7b7' : '#818cf8',
                cursor: 'pointer',
                transition: 'all 0.15s',
                opacity: (!customUrl.trim() || targetCount === 0) ? 0.4 : 1,
              }}
            >
              {customApplied ? '✓' : 'Apply'}
            </button>
          </div>
        </div>

        {/* Recent images */}
        {recentUrls.length > 0 && (
          <div style={{
            padding: '0 12px 12px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ fontSize: 10, color: '#475569', margin: '10px 0 6px' }}>Recent</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 4,
            }}>
              {recentUrls.slice(0, 6).map((url, i) => (
                <div
                  key={i}
                  onClick={() => applyFill(url)}
                  title={url}
                  style={{
                    paddingTop: '100%',
                    position: 'relative',
                    borderRadius: 4,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <img
                    src={url}
                    alt=""
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No shape selected warning */}
        {targetCount === 0 && (
          <div style={{
            margin: '0 12px 12px',
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(245,158,11,0.07)',
            border: '1px solid rgba(245,158,11,0.15)',
            fontSize: 10,
            color: '#92400e',
          }}>
            ⚠ Select a shape on the canvas before applying an image fill
          </div>
        )}
      </div>
    </div>
  );
}
