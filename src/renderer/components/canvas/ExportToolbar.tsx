import { useCallback, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { shapesToJsx, shapesToCanvas, pathBbox } from '../../lib/shapes';
import { shapesToSvg } from '../../lib/exportSvg';
import { shapesToHtml } from '../../lib/exportHtml';
import { analytics } from '../../lib/analytics';

interface Props {
  shapes: Shape[];
  onPresent?: () => void;
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportToolbar({ shapes, onPresent }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [showPngMenu, setShowPngMenu] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const copyAsJsx = useCallback(() => {
    if (shapes.length === 0) { showToast('No shapes to export'); return; }
    const jsx = shapesToJsx(shapes);
    navigator.clipboard.writeText(jsx).then(() => {
      showToast('Copied!');
      analytics.track('export', { format: 'jsx', shape_count: shapes.length });
    }).catch(() => {
      showToast('Copy failed');
    });
  }, [shapes, showToast]);

  const exportPngAtScale = useCallback((scale: number) => {
    if (shapes.length === 0) { showToast('No shapes to export'); return; }
    const canvas = document.createElement('canvas');

    // Compute bounds
    const allBounds = shapes.map(s => {
      if (s.type === 'path' && s.points?.length) {
        const bb = pathBbox(s.points, s.pathClosed ?? false);
        return { x1: bb.x, y1: bb.y, x2: bb.x + bb.width, y2: bb.y + bb.height };
      }
      return { x1: s.x, y1: s.y, x2: s.x + s.width, y2: s.y + s.height };
    });
    const minX = Math.min(...allBounds.map(b => b.x1));
    const minY = Math.min(...allBounds.map(b => b.y1));
    const maxX = Math.max(...allBounds.map(b => b.x2));
    const maxY = Math.max(...allBounds.map(b => b.y2));
    const pad = 20;
    const W = (maxX - minX + pad * 2) * scale;
    const H = (maxY - minY + pad * 2) * scale;

    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W / scale}px`;
    canvas.style.height = `${H / scale}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W / scale, H / scale);

    // Use shapesToCanvas to draw at this custom scale
    // We can't easily reuse shapesToCanvas directly since it sets canvas dimensions with dpr.
    // Instead, render each shape manually by re-using our canvas with our scale.
    shapesToCanvas(shapes, canvas);

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `design@${scale}x.png`;
    a.click();
    showToast(`Exported @${scale}x!`);
    setShowPngMenu(false);
    analytics.track('export', { format: 'png', scale, shape_count: shapes.length });
  }, [shapes, showToast]);

  const exportPng = useCallback(() => exportPngAtScale(1), [exportPngAtScale]);

  const exportSvg = useCallback(() => {
    if (shapes.length === 0) { showToast('No shapes to export'); return; }
    const svg = shapesToSvg(shapes);
    downloadText(svg, 'design.svg', 'image/svg+xml');
    showToast('Exported!');
    analytics.track('export', { format: 'svg', shape_count: shapes.length });
  }, [shapes, showToast]);

  const exportHtml = useCallback(() => {
    if (shapes.length === 0) { showToast('No shapes to export'); return; }
    const html = shapesToHtml(shapes);
    downloadText(html, 'design.html', 'text/html');
    showToast('Exported!');
    analytics.track('export', { format: 'html', shape_count: shapes.length });
  }, [shapes, showToast]);

  // ── Batch export: each named frame as its own PNG ─────────────────────────
  const [exportingFrames, setExportingFrames] = useState(false);
  const exportFrames = useCallback(async () => {
    const frames = shapes.filter(s => s.type === 'frame');
    if (frames.length === 0) { showToast('No frames to export'); return; }
    setExportingFrames(true);
    showToast(`Exporting ${frames.length} frame${frames.length > 1 ? 's' : ''}…`);

    // Helper: collect a frame + its descendants
    const collectDescendants = (frameId: string): Shape[] => {
      const result: Shape[] = [];
      const visit = (id: string) => {
        const s = shapes.find(x => x.id === id);
        if (!s) return;
        result.push(s);
        shapes.filter(x => x.parentId === id).forEach(c => visit(c.id));
      };
      visit(frameId);
      return result;
    };

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      // Collect frame + children, translated to origin
      const frameShapes = collectDescendants(frame.id).map(s => ({
        ...s,
        x: s.x - frame.x,
        y: s.y - frame.y,
      }));

      // Use shapesToCanvas but clip result to frame dimensions
      const tmp = document.createElement('canvas');
      shapesToCanvas(frameShapes, tmp);

      // Now create the properly-sized output canvas at @2x
      const out = document.createElement('canvas');
      const scale = 2;
      out.width = frame.width * scale;
      out.height = frame.height * scale;
      const ctx = out.getContext('2d');
      if (!ctx) continue;
      // White/frame-color background
      ctx.fillStyle = frame.fill !== 'transparent' ? frame.fill : '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      // Draw the tmp canvas scaled into the frame bounds
      ctx.drawImage(tmp, 0, 0, out.width, out.height);

      const dataUrl = out.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const safeName = (frame.name || `frame-${i + 1}`).replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      a.download = `${safeName}@2x.png`;
      a.click();
      // Stagger downloads so browser doesn't throttle
      await new Promise(r => setTimeout(r, 180));
    }

    setExportingFrames(false);
    showToast(`Exported ${frames.length} frame${frames.length > 1 ? 's' : ''}!`);
    analytics.track('export', { format: 'frames-png', frame_count: frames.length });
  }, [shapes, showToast]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        zIndex: 20,
        pointerEvents: 'all',
      }}
    >
      {/* Toast */}
      {toast && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          fontSize: 12,
          padding: '4px 10px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {toast}
        </div>
      )}

      {/* Buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '2px 4px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <ExportBtn title="Copy as JSX" onClick={copyAsJsx} label="JSX" />

        {/* PNG button with scale popup */}
        <div style={{ position: 'relative' }}>
          <ExportBtn
            title="Export as PNG (right-click for 2x/3x)"
            onClick={exportPng}
            onContextMenu={(e) => { e.preventDefault(); setShowPngMenu(p => !p); }}
            label="PNG"
          />
          {showPngMenu && (
            <div
              style={{
                position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column', gap: 2,
                minWidth: 90, zIndex: 100,
              }}
              onMouseLeave={() => setShowPngMenu(false)}
            >
              {[1, 2, 3].map(scale => (
                <button
                  key={scale}
                  onMouseDown={(e) => { e.stopPropagation(); exportPngAtScale(scale); }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--muted)',
                    cursor: 'pointer', padding: '5px 10px', borderRadius: 4,
                    fontSize: 11, fontFamily: 'monospace', fontWeight: 600, textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.color = 'var(--text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                >
                  <span style={{
                    fontSize: 9, background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
                    borderRadius: 3, padding: '1px 4px', flexShrink: 0, fontWeight: 700,
                  }}>@{scale}x</span>
                  PNG {scale}×
                </button>
              ))}
            </div>
          )}
        </div>

        <ExportBtn title="Export as SVG" onClick={exportSvg} label="SVG" />
        <ExportBtn title="Export as HTML" onClick={exportHtml} label="HTML" />
        {shapes.some(s => s.type === 'frame') && (
          <ExportBtn
            title="Export each frame as PNG @2x"
            onClick={exportFrames}
            label={exportingFrames ? '…' : '⬜ Frames'}
          />
        )}
        {onPresent && (
          <>
            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
            <ExportBtn title="Presentation mode (F5)" onClick={onPresent} label="▶ Present" />
          </>
        )}
      </div>
    </div>
  );
}

function ExportBtn({ title, onClick, onContextMenu, label }: { title: string; onClick: () => void; onContextMenu?: (e: React.MouseEvent) => void; label: string }) {
  return (
    <button
      title={title}
      onMouseDown={(e) => { e.stopPropagation(); onClick(); }}
      onContextMenu={onContextMenu}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--muted)',
        cursor: 'pointer',
        padding: '0 8px',
        height: 26,
        display: 'flex',
        alignItems: 'center',
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 600,
        letterSpacing: '0.04em',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-alt)'; e.currentTarget.style.color = 'var(--text)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
    >
      {label}
    </button>
  );
}
