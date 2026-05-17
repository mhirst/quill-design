/**
 * CanvasComparePanel — Before/After canvas snapshot comparison.
 *
 * Features:
 *  - Take "Before" and "After" snapshots of the canvas (data URLs via html2canvas-style)
 *  - Interactive drag slider to compare both images side-by-side
 *  - Magnifier zoom toggle (2× region under cursor)
 *  - Difference overlay (pixel diff visualization)
 *  - Thumbnail strip showing saved snapshots
 *  - Download individual snapshots
 *  - Keyboard: ⌘⇧C to toggle
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CanvasSnapshot {
  id: string;
  label: string;
  dataUrl: string;         // PNG data URL
  takenAt: number;
  width: number;
  height: number;
}

export interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when user requests a snapshot. Returns a data URL or null. */
  onCaptureCanvas: () => Promise<string | null>;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Slider comparison component ────────────────────────────────────────────────

interface SliderCompareProps {
  before: CanvasSnapshot;
  after: CanvasSnapshot;
}

function SliderCompare({ before, after }: SliderCompareProps) {
  const [sliderX, setSliderX] = useState(50); // percent
  const [dragging, setDragging] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (dragging) setSliderX(Math.max(0, Math.min(100, x)));
  }, [dragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onUp = () => setDragging(false);
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      setSliderX(Math.max(0, Math.min(100, x)));
    };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    return () => { window.removeEventListener('mouseup', onUp); window.removeEventListener('mousemove', onMove); };
  }, [dragging]);

  // Draw diff overlay
  useEffect(() => {
    if (!showDiff || !diffCanvasRef.current) return;
    const canvas = diffCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgA = new Image();
    const imgB = new Image();
    let loadedCount = 0;

    const tryDraw = () => {
      loadedCount++;
      if (loadedCount < 2) return;
      // Draw both images to compare
      const w = canvas.width;
      const h = canvas.height;
      const offA = document.createElement('canvas');
      offA.width = w; offA.height = h;
      const ctxA = offA.getContext('2d')!;
      ctxA.drawImage(imgA, 0, 0, w, h);

      const offB = document.createElement('canvas');
      offB.width = w; offB.height = h;
      const ctxB = offB.getContext('2d')!;
      ctxB.drawImage(imgB, 0, 0, w, h);

      const dA = ctxA.getImageData(0, 0, w, h).data;
      const dB = ctxB.getImageData(0, 0, w, h).data;
      const out = ctx.createImageData(w, h);

      for (let i = 0; i < dA.length; i += 4) {
        const dr = Math.abs(dA[i] - dB[i]);
        const dg = Math.abs(dA[i + 1] - dB[i + 1]);
        const db = Math.abs(dA[i + 2] - dB[i + 2]);
        const diff = (dr + dg + db) / 3;
        // Highlight differences in red/orange
        if (diff > 8) {
          out.data[i] = 255;
          out.data[i + 1] = Math.max(0, 80 - diff);
          out.data[i + 2] = 0;
          out.data[i + 3] = Math.min(255, diff * 4);
        } else {
          // Desaturate same pixels
          const avg = (dA[i] + dA[i + 1] + dA[i + 2]) / 3;
          out.data[i] = avg;
          out.data[i + 1] = avg;
          out.data[i + 2] = avg;
          out.data[i + 3] = 180;
        }
      }
      ctx.putImageData(out, 0, 0);
    };

    imgA.onload = tryDraw;
    imgB.onload = tryDraw;
    imgA.src = before.dataUrl;
    imgB.src = after.dataUrl;
  }, [showDiff, before.dataUrl, after.dataUrl]);

  const DISPLAY_H = 260;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, padding: '6px 12px 4px', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--muted, #888)', flex: 1 }}>
          Drag the slider to compare
        </span>
        <button
          onClick={() => setShowDiff(d => !d)}
          style={{
            background: showDiff ? 'rgba(239,68,68,0.15)' : 'transparent',
            border: `1px solid ${showDiff ? 'rgba(239,68,68,0.4)' : 'var(--border, #2d2d3d)'}`,
            borderRadius: 4, cursor: 'pointer', fontSize: 9,
            color: showDiff ? '#ef4444' : 'var(--muted, #888)',
            padding: '2px 8px', height: 20,
          }}
        >
          {showDiff ? '✓ ' : ''}Diff
        </button>
        <button
          onClick={() => setZoom(z => !z)}
          style={{
            background: zoom ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: `1px solid ${zoom ? 'rgba(99,102,241,0.4)' : 'var(--border, #2d2d3d)'}`,
            borderRadius: 4, cursor: 'pointer', fontSize: 9,
            color: zoom ? '#818cf8' : 'var(--muted, #888)',
            padding: '2px 8px', height: 20,
          }}
        >
          {zoom ? '✓ ' : ''}2× Zoom
        </button>
      </div>

      {/* Compare viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        style={{
          position: 'relative',
          height: DISPLAY_H,
          overflow: 'hidden',
          background: '#0a0a14',
          cursor: dragging ? 'ew-resize' : 'col-resize',
          margin: '0 12px',
          borderRadius: 8,
          border: '1px solid var(--border, #2d2d3d)',
          userSelect: 'none',
        }}
      >
        {showDiff ? (
          /* Diff mode */
          <canvas
            ref={diffCanvasRef}
            width={after.width}
            height={after.height}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <>
            {/* After image (full width, clipped on right) */}
            <img
              src={after.dataUrl}
              alt="After"
              draggable={false}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'contain',
              }}
            />

            {/* Before image (clipped on left) */}
            <div style={{
              position: 'absolute', inset: 0,
              clipPath: `inset(0 ${100 - sliderX}% 0 0)`,
            }}>
              <img
                src={before.dataUrl}
                alt="Before"
                draggable={false}
                style={{
                  width: '100%', height: '100%', objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>

            {/* Slider line */}
            <div
              onMouseDown={handleMouseDown}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${sliderX}%`,
                transform: 'translateX(-50%)',
                width: 3,
                background: 'white',
                boxShadow: '0 0 8px rgba(0,0,0,0.8)',
                cursor: 'ew-resize',
                zIndex: 10,
              }}
            >
              {/* Handle */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 28, height: 28, borderRadius: '50%',
                background: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#333', fontWeight: 700,
              }}>
                ⟺
              </div>
            </div>

            {/* Labels */}
            <div style={{
              position: 'absolute', top: 6, left: 8,
              background: 'rgba(0,0,0,0.7)',
              color: '#93c5fd', fontSize: 9, fontWeight: 700,
              padding: '2px 6px', borderRadius: 4,
              backdropFilter: 'blur(4px)',
              pointerEvents: 'none',
              opacity: sliderX > 15 ? 1 : 0, transition: 'opacity 0.2s',
            }}>
              BEFORE
            </div>
            <div style={{
              position: 'absolute', top: 6, right: 8,
              background: 'rgba(0,0,0,0.7)',
              color: '#86efac', fontSize: 9, fontWeight: 700,
              padding: '2px 6px', borderRadius: 4,
              backdropFilter: 'blur(4px)',
              pointerEvents: 'none',
              opacity: sliderX < 85 ? 1 : 0, transition: 'opacity 0.2s',
            }}>
              AFTER
            </div>

            {/* Zoom magnifier */}
            {zoom && (
              <div style={{
                position: 'absolute',
                left: Math.min(Math.max(mousePos.x - 50, 0), 300),
                top: mousePos.y > 130 ? mousePos.y - 110 : mousePos.y + 10,
                width: 100, height: 100,
                borderRadius: 8,
                border: '2px solid rgba(255,255,255,0.4)',
                overflow: 'hidden',
                pointerEvents: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                zIndex: 20,
              }}>
                <img
                  src={mousePos.x < containerRef.current!.clientWidth * sliderX / 100
                    ? before.dataUrl : after.dataUrl}
                  alt="zoom"
                  style={{
                    position: 'absolute',
                    width: '200%', height: '200%',
                    left: `${-mousePos.x / (containerRef.current?.clientWidth ?? 1) * 100}%`,
                    top: `${-mousePos.y / DISPLAY_H * 100}%`,
                    objectFit: 'contain',
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Timestamp strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 14px', fontSize: 9, color: 'var(--muted, #888)' }}>
        <span>📷 {before.label} · {new Date(before.takenAt).toLocaleTimeString()}</span>
        <span>{after.label} · {new Date(after.takenAt).toLocaleTimeString()} 📷</span>
      </div>
    </div>
  );
}

// ── Snapshot Thumbnail ─────────────────────────────────────────────────────────

function SnapshotThumb({
  snap, label, isSelected, onSelect, onDownload, onDelete,
}: {
  snap: CanvasSnapshot;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      style={{
        position: 'relative',
        borderRadius: 6,
        overflow: 'hidden',
        border: `2px solid ${isSelected ? 'var(--accent, #6366f1)' : 'var(--border, #2d2d3d)'}`,
        cursor: 'pointer',
        flexShrink: 0,
        width: 80, height: 54,
        background: '#0a0a14',
        transition: 'border-color 0.12s',
      }}
    >
      <img
        src={snap.dataUrl}
        alt={snap.label}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {/* Label chip */}
      <div style={{
        position: 'absolute', bottom: 2, left: 2, right: 2,
        background: 'rgba(0,0,0,0.75)',
        fontSize: 8, color: isSelected ? '#818cf8' : 'rgba(255,255,255,0.7)',
        borderRadius: 3, padding: '1px 3px',
        textAlign: 'center', fontWeight: isSelected ? 700 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>

      {/* Hover actions */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(10,10,20,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <button
            onClick={e => { e.stopPropagation(); onDownload(); }}
            style={{
              background: 'rgba(99,102,241,0.3)', border: 'none',
              borderRadius: 3, color: 'white', fontSize: 9, padding: '2px 5px',
              cursor: 'pointer',
            }}
          >
            ↓
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{
              background: 'rgba(239,68,68,0.3)', border: 'none',
              borderRadius: 3, color: '#ef4444', fontSize: 9, padding: '2px 5px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CanvasComparePanel({ open, onClose, onCaptureCanvas }: Props) {
  const [snapshots, setSnapshots] = useState<CanvasSnapshot[]>([]);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [labelCounter, setLabelCounter] = useState(1);
  const [selectingFor, setSelectingFor] = useState<'before' | 'after' | null>(null);

  const takeSnapshot = useCallback(async (customLabel?: string) => {
    setCapturing(true);
    try {
      const dataUrl = await onCaptureCanvas();
      if (!dataUrl) return;

      const img = new Image();
      await new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = dataUrl;
      });

      const snap: CanvasSnapshot = {
        id: uid(),
        label: customLabel ?? `Snap ${labelCounter}`,
        dataUrl,
        takenAt: Date.now(),
        width: img.naturalWidth || 800,
        height: img.naturalHeight || 600,
      };
      setSnapshots(prev => [...prev, snap]);
      setLabelCounter(c => c + 1);

      // Auto-assign to before/after
      setSnapshots(prev => {
        const all = [...prev];
        if (all.length === 1) setBeforeId(all[0].id);
        if (all.length === 2) setAfterId(all[1].id);
        return all;
      });
      return snap;
    } finally {
      setCapturing(false);
    }
  }, [onCaptureCanvas, labelCounter]);

  const downloadSnapshot = useCallback((snap: CanvasSnapshot) => {
    const a = document.createElement('a');
    a.href = snap.dataUrl;
    a.download = `${snap.label.replace(/\s+/g, '_')}.png`;
    a.click();
  }, []);

  const deleteSnapshot = useCallback((id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
    if (beforeId === id) setBeforeId(null);
    if (afterId === id) setAfterId(null);
  }, [beforeId, afterId]);

  const beforeSnap = snapshots.find(s => s.id === beforeId) ?? null;
  const afterSnap = snapshots.find(s => s.id === afterId) ?? null;

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 20,
      width: 420,
      maxHeight: '85vh',
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
          <span style={{ fontSize: 14 }}>🔭</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>Canvas Compare</span>
          {snapshots.length > 0 && (
            <span style={{
              fontSize: 9, background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#818cf8', padding: '1px 5px', borderRadius: 4, fontWeight: 600,
            }}>
              {snapshots.length} snap{snapshots.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {/* ── Capture button ── */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border, #2d2d3d)',
        display: 'flex', gap: 8, alignItems: 'center',
        flexShrink: 0,
      }}>
        <button
          onClick={() => takeSnapshot()}
          disabled={capturing}
          style={{
            flex: 1,
            background: capturing ? 'rgba(99,102,241,0.15)' : 'var(--accent, #6366f1)',
            border: 'none', borderRadius: 7,
            color: capturing ? '#818cf8' : 'white',
            fontSize: 11, fontWeight: 600,
            padding: '7px 14px', cursor: capturing ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all 0.15s',
          }}
        >
          {capturing ? (
            <>⏳ Capturing…</>
          ) : (
            <>📷 Take Snapshot</>
          )}
        </button>
        <div style={{ fontSize: 10, color: 'var(--muted, #888)', lineHeight: 1.3 }}>
          Takes a snapshot<br />of current canvas
        </div>
      </div>

      {/* ── Snapshot strip ── */}
      {snapshots.length > 0 && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border, #2d2d3d)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 6, fontWeight: 600 }}>
            SNAPSHOTS — click to set as Before/After
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {snapshots.map(snap => {
              const isBefore = snap.id === beforeId;
              const isAfter = snap.id === afterId;
              const selected = isBefore || isAfter;
              return (
                <div key={snap.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <SnapshotThumb
                    snap={snap}
                    label={snap.label}
                    isSelected={selected}
                    onSelect={() => {
                      // Cycle: unassigned → before → after → unassigned
                      if (!isBefore && !isAfter) {
                        if (!beforeId) setBeforeId(snap.id);
                        else if (!afterId) setAfterId(snap.id);
                        else setBeforeId(snap.id);
                      } else if (isBefore) {
                        setBeforeId(null);
                        setAfterId(snap.id);
                      } else {
                        setAfterId(null);
                      }
                    }}
                    onDownload={() => downloadSnapshot(snap)}
                    onDelete={() => deleteSnapshot(snap.id)}
                  />
                  <div style={{ display: 'flex', gap: 2 }}>
                    {isBefore && (
                      <span style={{
                        fontSize: 7, background: 'rgba(147,197,253,0.2)',
                        color: '#93c5fd', padding: '1px 4px', borderRadius: 3, fontWeight: 700,
                      }}>B</span>
                    )}
                    {isAfter && (
                      <span style={{
                        fontSize: 7, background: 'rgba(134,239,172,0.2)',
                        color: '#86efac', padding: '1px 4px', borderRadius: 3, fontWeight: 700,
                      }}>A</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Compare view ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!beforeSnap && !afterSnap && (
          <div style={{
            textAlign: 'center', padding: '32px 20px',
            color: 'var(--muted, #888)', fontSize: 11,
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📸</div>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text, #e2e8f0)' }}>No snapshots yet</div>
            <div style={{ fontSize: 10, lineHeight: 1.5 }}>
              Click <strong style={{ color: '#818cf8' }}>Take Snapshot</strong> to capture<br />
              the current canvas state. Take a second<br />
              snapshot after making changes to compare.
            </div>
          </div>
        )}

        {(beforeSnap || afterSnap) && !(beforeSnap && afterSnap) && (
          <div style={{
            textAlign: 'center', padding: '20px',
            color: 'var(--muted, #888)', fontSize: 11,
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>
              {beforeSnap ? '📷 Before ready' : '📷 After ready'}
            </div>
            <div style={{ fontSize: 10 }}>
              {beforeSnap
                ? 'Take another snapshot after making changes to see the comparison.'
                : 'Select another snapshot as "Before" to compare.'}
            </div>
            {beforeSnap && (
              <img
                src={beforeSnap.dataUrl}
                alt="Before"
                style={{
                  marginTop: 12, width: '100%', borderRadius: 6,
                  border: '1px solid var(--border, #2d2d3d)', objectFit: 'contain',
                }}
              />
            )}
          </div>
        )}

        {beforeSnap && afterSnap && (
          <SliderCompare before={beforeSnap} after={afterSnap} />
        )}
      </div>

      {/* ── Footer ── */}
      {snapshots.length > 0 && (
        <div style={{
          padding: '6px 12px',
          borderTop: '1px solid var(--border, #2d2d3d)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 9, color: 'var(--muted, #888)' }}>
            Click thumbnail to assign B/A · drag slider to compare
          </span>
          <button
            onClick={() => {
              setSnapshots([]);
              setBeforeId(null);
              setAfterId(null);
              setLabelCounter(1);
            }}
            style={{
              background: 'transparent',
              border: '1px solid var(--border, #2d2d3d)',
              borderRadius: 4, color: 'var(--muted, #888)',
              fontSize: 9, padding: '2px 8px', cursor: 'pointer',
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
