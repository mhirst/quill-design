import { useCallback, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';
import { shapesToJsx, shapesToCanvas } from '../../lib/shapes';
import { analytics } from '../../lib/analytics';

interface Props {
  shapes: Shape[];
}

export function ExportToolbar({ shapes }: Props) {
  const [toast, setToast] = useState<string | null>(null);
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

  const exportPng = useCallback(() => {
    if (shapes.length === 0) { showToast('No shapes to export'); return; }
    const canvas = document.createElement('canvas');
    shapesToCanvas(shapes, canvas);
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'design.png';
    a.click();
    showToast('Exported!');
    analytics.track('export', { format: 'png', shape_count: shapes.length });
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
        <ExportBtn title="Export as PNG" onClick={exportPng} label="PNG" />
      </div>
    </div>
  );
}

function ExportBtn({ title, onClick, label }: { title: string; onClick: () => void; label: string }) {
  return (
    <button
      title={title}
      onMouseDown={(e) => { e.stopPropagation(); onClick(); }}
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
