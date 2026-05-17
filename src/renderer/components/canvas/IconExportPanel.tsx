/**
 * IconExportPanel — Multi-size icon export and preview panel for Quill.
 *
 * For a selected shape or frame, this panel:
 *  - Shows live preview at all standard icon sizes
 *  - Generates optimized SVG markup with viewBox scaling
 *  - Generates PNG data URLs at each size (via Canvas API)
 *  - Exports: individual PNGs, sprite sheet, SVG set, favicon ICO description
 *  - Padding control (icon padding % from edge)
 *  - Background: transparent, white, or custom color
 *  - Rounded corners toggle (for macOS-style app icons)
 *  - Shows rendered pixel count and file size estimate
 *
 * Keyboard: ⌘⌥I
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Shape } from '../../lib/shapes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IconSize {
  px: number;
  label: string;
  platform: string;
  selected: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_ICON_SIZES: IconSize[] = [
  { px: 16, label: '16px', platform: 'Favicon, toolbar', selected: true },
  { px: 24, label: '24px', platform: 'Android MDPI, status bar', selected: true },
  { px: 32, label: '32px', platform: 'Favicon, Windows', selected: true },
  { px: 48, label: '48px', platform: 'Android MDPI launcher', selected: true },
  { px: 64, label: '64px', platform: 'Browser extension', selected: false },
  { px: 96, label: '96px', platform: 'Android HDPI launcher', selected: false },
  { px: 128, label: '128px', platform: 'Chrome Web Store, macOS', selected: true },
  { px: 180, label: '180px', platform: 'Apple Touch icon', selected: false },
  { px: 192, label: '192px', platform: 'Android XXXHDPI, PWA', selected: true },
  { px: 256, label: '256px', platform: 'macOS, Windows 256', selected: true },
  { px: 512, label: '512px', platform: 'macOS 512, Google Play', selected: false },
  { px: 1024, label: '1024px', platform: 'iOS App Store', selected: false },
];

type BgMode = 'transparent' | 'white' | 'black' | 'custom';

// ─── Estimate file size ────────────────────────────────────────────────────────

export function estimatePNGSize(px: number): string {
  // Very rough: PNG ~3.5 bytes/pixel for icons
  const bytes = px * px * 3.5;
  if (bytes < 1024) return `${Math.round(bytes)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ─── Generate SVG from shape ──────────────────────────────────────────────────

/** Build an SVG string representing a simplified version of the shape */
export function shapeToSVG(shape: Shape, size: number, padding: number, bgMode: BgMode, bgColor: string, rounded: boolean): string {
  const pad = Math.round(size * padding);
  const inner = size - pad * 2;

  let bgRect = '';
  if (bgMode === 'white') bgRect = `<rect width="${size}" height="${size}" fill="white"/>`;
  else if (bgMode === 'black') bgRect = `<rect width="${size}" height="${size}" fill="black"/>`;
  else if (bgMode === 'custom') bgRect = `<rect width="${size}" height="${size}" fill="${bgColor}"/>`;

  const fill = shape.fill ?? '#000000';
  const stroke = shape.stroke;
  const strokeW = shape.strokeWidth ?? 0;
  const opacity = shape.opacity ?? 1;
  const rawRadius = Array.isArray(shape.borderRadius) ? shape.borderRadius[0] : (shape.borderRadius ?? 0);
  const radius = rounded ? Math.round(size * 0.2) : rawRadius * (inner / Math.max(shape.width, 1));
  const strokeAttr = stroke && strokeW > 0 ? ` stroke="${stroke}" stroke-width="${(strokeW * inner / Math.max(shape.width, 1)).toFixed(2)}"` : '';

  let shapeEl = '';
  if (shape.type === 'rectangle' || shape.type === 'frame') {
    const rx = Math.min(radius, inner / 2);
    shapeEl = `<rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" fill="${fill}" fill-opacity="${opacity}" rx="${rx}"${strokeAttr}/>`;
  } else if (shape.type === 'ellipse') {
    const cx = pad + inner / 2;
    const cy = pad + inner / 2;
    const rx = inner / 2;
    shapeEl = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx}" fill="${fill}" fill-opacity="${opacity}"${strokeAttr}/>`;
  } else if (shape.type === 'text') {
    const fontSize = Math.round(inner * 0.6);
    shapeEl = `<text x="${size / 2}" y="${size / 2 + fontSize * 0.35}" text-anchor="middle" font-family="${shape.fontFamily ?? 'sans-serif'}" font-size="${fontSize}" fill="${fill}" fill-opacity="${opacity}">${shape.text ?? 'A'}</text>`;
  } else {
    // Path or fallback — diamond shape
    const cx = size / 2;
    const cy = size / 2;
    const r = inner / 2;
    shapeEl = `<polygon points="${cx},${pad} ${cx + r},${cy} ${cx},${size - pad} ${cx - r},${cy}" fill="${fill}" fill-opacity="${opacity}"${strokeAttr}/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n  ${bgRect}\n  ${shapeEl}\n</svg>`;
}

/** Render SVG to a canvas and return data URL */
async function svgToDataURL(svgString: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(''); return; }
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    img.src = url;
  });
}

// ─── Component Props ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function IconExportPanel({ open, onClose, selectedShape }: Props) {
  const [sizes, setSizes] = useState<IconSize[]>(DEFAULT_ICON_SIZES);
  const [padding, setPadding] = useState(0.1); // 10% padding
  const [bgMode, setBgMode] = useState<BgMode>('transparent');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [rounded, setRounded] = useState(false);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState(false);
  const [copiedSVG, setCopiedSVG] = useState(false);
  const [activePreviewSize, setActivePreviewSize] = useState(64);

  if (!open) return null;

  const selectedSizes = sizes.filter(s => s.selected);

  // Generate SVG for current shape
  const svgString = useMemo(() => {
    if (!selectedShape) return '';
    return shapeToSVG(selectedShape, 512, padding, bgMode, bgColor, rounded);
  }, [selectedShape, padding, bgMode, bgColor, rounded]);

  // Render preview PNG for the active preview size
  useEffect(() => {
    if (!selectedShape || !svgString) return;
    const svg = shapeToSVG(selectedShape, activePreviewSize, padding, bgMode, bgColor, rounded);
    svgToDataURL(svg, activePreviewSize).then(url => {
      if (url) setPreviews(p => ({ ...p, [activePreviewSize]: url }));
    });
  }, [selectedShape, svgString, activePreviewSize, padding, bgMode, bgColor, rounded]);

  const generateAll = useCallback(async () => {
    if (!selectedShape) return;
    setGenerating(true);
    const results: Record<number, string> = {};
    for (const s of selectedSizes) {
      const svg = shapeToSVG(selectedShape, s.px, padding, bgMode, bgColor, rounded);
      const url = await svgToDataURL(svg, s.px);
      if (url) results[s.px] = url;
    }
    setPreviews(p => ({ ...p, ...results }));
    setGenerating(false);
  }, [selectedShape, selectedSizes, padding, bgMode, bgColor, rounded]);

  const downloadSVG = useCallback(() => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedShape?.name ?? 'icon'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [svgString, selectedShape]);

  const downloadPNG = useCallback((px: number) => {
    const url = previews[px];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedShape?.name ?? 'icon'}-${px}.png`;
    a.click();
  }, [previews, selectedShape]);

  const copySVG = useCallback(() => {
    navigator.clipboard.writeText(svgString).then(() => {
      setCopiedSVG(true);
      setTimeout(() => setCopiedSVG(false), 1500);
    });
  }, [svgString]);

  const toggleSize = useCallback((px: number) => {
    setSizes(prev => prev.map(s => s.px === px ? { ...s, selected: !s.selected } : s));
  }, []);

  const previewUrl = previews[activePreviewSize] ?? '';

  return (
    <div style={{
      position: 'fixed',
      right: 8,
      top: 60,
      width: 460,
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
          <span style={{ fontSize: 15 }}>🔷</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e0e0f8' }}>Icon Export Studio</span>
          <span style={{ fontSize: 10, color: '#555', background: '#1a1a2e', borderRadius: 4, padding: '1px 5px' }}>⌘⌥I</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {!selectedShape ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#555', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔷</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>No shape selected</div>
          <div style={{ fontSize: 11, color: '#555' }}>Select a shape or frame to generate icon exports</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Preview area */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e1e3a' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Main preview */}
              <div style={{ background: bgMode === 'white' ? '#fff' : bgMode === 'black' ? '#000' : 'repeating-conic-gradient(#1e1e3a 0% 25%, #13131f 0% 50%) 0 0 / 12px 12px', borderRadius: rounded ? '22%' : 8, border: '1px solid #2a2a4a', overflow: 'hidden', flexShrink: 0, width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {previewUrl ? (
                  <img src={previewUrl} width={Math.min(activePreviewSize, 80)} height={Math.min(activePreviewSize, 80)} style={{ imageRendering: activePreviewSize <= 32 ? 'pixelated' : 'auto' }} alt="preview" />
                ) : (
                  <div style={{ color: '#444', fontSize: 10 }}>Generating…</div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                {/* Shape info */}
                <div style={{ fontWeight: 600, fontSize: 13, color: '#e0e0f8', marginBottom: 4 }}>{selectedShape.name}</div>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>{selectedShape.type} · {selectedShape.width}×{selectedShape.height}px source</div>

                {/* Preview size selector */}
                <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Preview at:</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[16, 32, 64, 128, 256].map(px => (
                    <button key={px} onClick={() => setActivePreviewSize(px)}
                      style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, border: `1px solid ${activePreviewSize === px ? '#4a4a8a' : '#2a2a4a'}`, background: activePreviewSize === px ? '#2a2a5a' : 'transparent', color: activePreviewSize === px ? '#bbbfff' : '#666', cursor: 'pointer' }}>
                      {px}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Options */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e3a' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Background</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {(['transparent', 'white', 'black', 'custom'] as BgMode[]).map(mode => (
                    <button key={mode} onClick={() => setBgMode(mode)}
                      style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, border: `1px solid ${bgMode === mode ? '#4a4a8a' : '#2a2a4a'}`, background: bgMode === mode ? '#2a2a5a' : 'transparent', color: bgMode === mode ? '#bbbfff' : '#666', cursor: 'pointer' }}>
                      {mode}
                    </button>
                  ))}
                  {bgMode === 'custom' && (
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                      style={{ width: 28, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none' }} />
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Options</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                    <input type="checkbox" checked={rounded} onChange={e => setRounded(e.target.checked)} style={{ accentColor: '#7b7bff' }} />
                    <span style={{ color: '#aaa' }}>Rounded corners (20%)</span>
                  </label>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Padding: {Math.round(padding * 100)}%</div>
              <input type="range" min={0} max={0.3} step={0.01} value={padding}
                onChange={e => setPadding(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#7b7bff' }} />
            </div>
          </div>

          {/* Size selection */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e3a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Export Sizes ({selectedSizes.length} selected)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setSizes(s => s.map(x => ({ ...x, selected: true })))}
                  style={{ fontSize: 10, color: '#7b7bff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>All</button>
                <button onClick={() => setSizes(s => s.map(x => ({ ...x, selected: false })))}
                  style={{ fontSize: 10, color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>None</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {sizes.map(size => (
                <button key={size.px} onClick={() => toggleSize(size.px)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: size.selected ? '#1e1e4a' : '#0d0d1a', border: `1px solid ${size.selected ? '#3a3a7a' : '#1e1e3a'}`, borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                  {/* Mini icon preview */}
                  <div style={{ width: 20, height: 20, background: '#2a2a3a', borderRadius: 2, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {previews[size.px] ? (
                      <img src={previews[size.px]} width={18} height={18} style={{ imageRendering: size.px <= 32 ? 'pixelated' : 'auto' }} alt={`${size.px}px`} />
                    ) : (
                      <div style={{ width: Math.min(16, size.px / 16 + 4), height: Math.min(16, size.px / 16 + 4), background: selectedShape.fill ?? '#7b7bff', borderRadius: 1 }} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: size.selected ? '#bbbfff' : '#666' }}>{size.label}</div>
                    <div style={{ fontSize: 9, color: '#444' }}>{estimatePNGSize(size.px)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <button onClick={generateAll} disabled={generating}
                style={{ flex: 1, padding: '8px', background: generating ? '#1a1a3a' : '#2a2a5a', border: 'none', borderRadius: 6, color: generating ? '#555' : '#bbbfff', cursor: generating ? 'default' : 'pointer', fontSize: 11, fontWeight: 600 }}>
                {generating ? '⏳ Generating…' : `⚡ Generate ${selectedSizes.length} PNGs`}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={downloadSVG}
                style={{ padding: '6px 12px', background: '#1a2a3a', border: 'none', borderRadius: 6, color: '#88bbdd', cursor: 'pointer', fontSize: 11 }}>
                📥 Download SVG
              </button>
              <button onClick={copySVG}
                style={{ padding: '6px 12px', background: '#1a1a2e', border: 'none', borderRadius: 6, color: '#8888cc', cursor: 'pointer', fontSize: 11 }}>
                {copiedSVG ? '✓ Copied!' : '📋 Copy SVG'}
              </button>
            </div>

            {/* Download individual PNGs after generation */}
            {Object.keys(previews).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Download PNGs</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {selectedSizes.filter(s => previews[s.px]).map(s => (
                    <button key={s.px} onClick={() => downloadPNG(s.px)}
                      style={{ padding: '4px 8px', background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 5, color: '#888', cursor: 'pointer', fontSize: 10 }}>
                      ↓ {s.px}px
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Favicon guidance */}
            <div style={{ marginTop: 12, padding: 10, background: '#0d0d1a', borderRadius: 6, border: '1px solid #1e1e3a' }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>📌 Favicon Setup</div>
              <div style={{ fontSize: 10, color: '#444', lineHeight: 1.5 }}>
                For best browser support, export 16, 32, 48px PNGs then combine into an .ico file using a tool like ImageMagick: <span style={{ color: '#6699ff', fontFamily: 'monospace' }}>convert 16.png 32.png 48.png favicon.ico</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #1e1e3a', background: '#0f0f1e', fontSize: 10, color: '#333', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>{selectedSizes.length} sizes · Select sizes then Generate</span>
        <span>⌘⌥I</span>
      </div>
    </div>
  );
}
