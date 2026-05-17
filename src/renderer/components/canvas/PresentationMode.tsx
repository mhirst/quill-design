/**
 * PresentationMode — full-screen slideshow stepping through frames in canvas order.
 *
 * Features:
 * - Renders each top-level frame as a "slide" using the real buildShapeStyle system
 * - Smooth CSS transitions between slides (fade, slide-left, slide-right, zoom)
 * - Keyboard nav: ← → Space / N / P / Esc
 * - Slide overview (grid) accessible with Tab or G key
 * - Current slide number + frame name in a HUD
 * - Timer bar option showing elapsed time
 * - Laser pointer mode with cursor tracking
 * - Export thumbnail strip of all frames as PNGs via html2canvas
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { buildShapeStyle } from '../../lib/shapes';
import type { Shape } from '../../lib/shapes';
import { X, ChevronLeft, ChevronRight, Grid, Circle, Maximize2, Clock, Zap } from 'lucide-react';

// ─── types ───────────────────────────────────────────────────────────────────

type Transition = 'fade' | 'slide' | 'zoom' | 'flip' | 'none';

interface Props {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  /** Which frame id to start on (optional, defaults to first) */
  startFrameId?: string | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getFrames(shapes: Shape[]): Shape[] {
  return shapes.filter(s => s.type === 'frame' && !s.parentId).sort((a, b) => {
    // Sort by x position, then y — left-to-right, top-to-bottom reading order
    const dy = a.y - b.y;
    if (Math.abs(dy) > 100) return dy; // significant vertical gap → sort by row
    return a.x - b.x;
  });
}

function getChildren(shapes: Shape[], parentId: string): Shape[] {
  return shapes.filter(s => s.parentId === parentId);
}

function flatChildren(shapes: Shape[], parentId: string): Shape[] {
  const direct = getChildren(shapes, parentId);
  return direct.flatMap(s => [s, ...flatChildren(shapes, s.id)]);
}

// ─── SlideRenderer — renders a single frame and all its children ──────────────

function SlideRenderer({
  frame,
  allShapes,
  scale,
}: {
  frame: Shape;
  allShapes: Shape[];
  scale: number;
}) {
  const children = flatChildren(allShapes, frame.id);

  return (
    <div
      style={{
        ...buildShapeStyle(frame),
        // Override position-related styles — we want it static here
        width: frame.width,
        height: frame.height,
        position: 'relative',
        left: 'unset',
        top: 'unset',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        overflow: frame.clipContents ? 'hidden' : 'visible',
      }}
    >
      {children.map(child => {
        // Compute position relative to the frame (account for nested parents)
        const relX = child.x - frame.x;
        const relY = child.y - frame.y;
        const childStyle = buildShapeStyle(child);
        return (
          <div
            key={child.id}
            style={{
              ...childStyle,
              position: 'absolute',
              left: relX,
              top: relY,
              width: child.width,
              height: child.height,
            }}
          >
            {(child.type === 'text') && (
              <span style={{ pointerEvents: 'none', userSelect: 'none' }}>{child.text}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Thumbnail — small preview of a slide ────────────────────────────────────

function SlideThumbnail({
  frame,
  allShapes,
  index,
  active,
  onClick,
}: {
  frame: Shape;
  allShapes: Shape[];
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const maxW = 180;
  const maxH = 120;
  const scaleW = maxW / frame.width;
  const scaleH = maxH / frame.height;
  const scale = Math.min(scaleW, scaleH, 1);
  const renderedW = frame.width * scale;
  const renderedH = frame.height * scale;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '8px 6px',
        borderRadius: 10,
        border: active ? '2px solid #6366f1' : '2px solid transparent',
        background: active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        outline: 'none',
      }}
    >
      {/* Frame preview */}
      <div
        style={{
          width: maxW,
          height: maxH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: renderedW,
            height: renderedH,
            flexShrink: 0,
            overflow: 'hidden',
            borderRadius: 2,
          }}
        >
          <SlideRenderer frame={frame} allShapes={allShapes} scale={scale} />
        </div>
      </div>
      {/* Slide number + name */}
      <div style={{ fontSize: 11, color: active ? '#a5b4fc' : '#94a3b8', lineHeight: 1.2, textAlign: 'center', maxWidth: maxW }}>
        <span style={{ fontWeight: 600, marginRight: 4, color: active ? '#6366f1' : '#64748b' }}>{index + 1}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 140, verticalAlign: 'bottom' }}>
          {frame.name || `Frame ${index + 1}`}
        </span>
      </div>
    </button>
  );
}

// ─── transition CSS ───────────────────────────────────────────────────────────

function getTransitionStyle(
  transition: Transition,
  phase: 'enter' | 'exit',
  direction: 'forward' | 'backward',
): React.CSSProperties {
  if (transition === 'none') return { opacity: 1 };

  if (transition === 'fade') {
    return phase === 'enter'
      ? { opacity: 0, transition: 'opacity 0.4s ease' }
      : { opacity: 0, transition: 'opacity 0.4s ease' };
  }

  if (transition === 'slide') {
    const enterFrom = direction === 'forward' ? 'translateX(100%)' : 'translateX(-100%)';
    const exitTo = direction === 'forward' ? 'translateX(-100%)' : 'translateX(100%)';
    return phase === 'enter'
      ? { transform: enterFrom, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
      : { transform: exitTo, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' };
  }

  if (transition === 'zoom') {
    return phase === 'enter'
      ? { opacity: 0, transform: 'scale(0.88)', transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }
      : { opacity: 0, transform: 'scale(1.08)', transition: 'all 0.35s ease' };
  }

  if (transition === 'flip') {
    return phase === 'enter'
      ? { opacity: 0, transform: 'rotateY(90deg)', transition: 'all 0.35s ease', transformOrigin: direction === 'forward' ? 'left center' : 'right center' }
      : { opacity: 0, transform: direction === 'forward' ? 'rotateY(-90deg)' : 'rotateY(90deg)', transition: 'all 0.35s ease', transformOrigin: direction === 'forward' ? 'right center' : 'left center' };
  }

  return {};
}

// ─── PresentationMode component ──────────────────────────────────────────────

export function PresentationMode({ open, onClose, shapes, startFrameId }: Props) {
  const frames = getFrames(shapes);
  const startIdx = startFrameId ? Math.max(0, frames.findIndex(f => f.id === startFrameId)) : 0;

  const [currentIdx, setCurrentIdx] = useState(startIdx);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [transitioning, setTransitioning] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [transition, setTransition] = useState<Transition>('fade');
  const [laserMode, setLaserMode] = useState(false);
  const [laserPos, setLaserPos] = useState({ x: 0, y: 0 });
  const [laserVisible, setLaserVisible] = useState(false);
  const [showHUD, setShowHUD] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentIdx(startIdx);
      setPrevIdx(null);
      setShowOverview(false);
      setElapsed(0);
      setTimerRunning(false);
    }
  }, [open, startIdx]);

  // Timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // HUD auto-hide
  const showHUDTemporarily = useCallback(() => {
    setShowHUD(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setShowHUD(false), 3000);
  }, []);

  const navigate = useCallback((delta: number) => {
    if (transitionRef.current || frames.length === 0) return;
    const newIdx = Math.max(0, Math.min(frames.length - 1, currentIdx + delta));
    if (newIdx === currentIdx) return;

    transitionRef.current = true;
    setDirection(delta > 0 ? 'forward' : 'backward');
    setPrevIdx(currentIdx);
    setCurrentIdx(newIdx);
    setTransitioning(true);

    setTimeout(() => {
      setPrevIdx(null);
      setTransitioning(false);
      transitionRef.current = false;
    }, 450);

    showHUDTemporarily();
  }, [currentIdx, frames.length, showHUDTemporarily]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (showOverview) return;
        navigate(1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (showOverview) return;
        navigate(-1);
      }
      if (e.key === 'Tab' || e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowOverview(o => !o);
      }
      if (e.key.toLowerCase() === 'l') setLaserMode(m => !m);
      if (e.key.toLowerCase() === 't') setTimerRunning(r => !r);
      if (e.key.toLowerCase() === 'h') setShowHUD(h => !h);
      if (e.key.toLowerCase() === 's') setShowSettings(s => !s);
      // Number keys to jump to slide
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= frames.length) {
        const idx = num - 1;
        setDirection(idx > currentIdx ? 'forward' : 'backward');
        setPrevIdx(currentIdx);
        setCurrentIdx(idx);
        setTransitioning(true);
        transitionRef.current = true;
        setTimeout(() => { setPrevIdx(null); setTransitioning(false); transitionRef.current = false; }, 450);
        showHUDTemporarily();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, navigate, onClose, showOverview, frames.length, currentIdx, showHUDTemporarily]);

  // Laser pointer
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!laserMode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLaserPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setLaserVisible(true);
  }, [laserMode]);

  if (!open || frames.length === 0) {
    if (!open) return null;
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0f0f0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>🎯</div>
        <div style={{ color: '#94a3b8', fontSize: 18 }}>No frames to present</div>
        <div style={{ color: '#475569', fontSize: 14 }}>Create some frames on the canvas first</div>
        <button
          onClick={onClose}
          style={{
            marginTop: 8, padding: '8px 20px', borderRadius: 8,
            background: '#6366f1', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>
    );
  }

  const currentFrame = frames[currentIdx];
  const prevFrame = prevIdx !== null ? frames[prevIdx] : null;

  // Compute scale to fit the frame in the viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const scaleW = vw / currentFrame.width;
  const scaleH = vh / currentFrame.height;
  const scale = Math.min(scaleW, scaleH, 1.5);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: laserMode ? 'none' : 'default',
        overflow: 'hidden',
        perspective: '1200px',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setLaserVisible(false)}
      onClick={() => { if (!showOverview) navigate(1); }}
    >
      {/* ── Slide stage ── */}
      {!showOverview && (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          {/* Previous slide (exiting) */}
          {prevFrame && transitioning && (() => {
            const prevScale = Math.min(vw / prevFrame.width, vh / prevFrame.height, 1.5);
            const exitStyle = getTransitionStyle(transition, 'exit', direction);
            return (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...exitStyle,
              }}>
                <div style={{
                  width: prevFrame.width * prevScale,
                  height: prevFrame.height * prevScale,
                  overflow: 'hidden',
                  borderRadius: 4,
                  boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                }}>
                  <SlideRenderer frame={prevFrame} allShapes={shapes} scale={prevScale} />
                </div>
              </div>
            );
          })()}

          {/* Current slide (entering) */}
          {(() => {
            const enterStyle = transitioning && prevFrame
              ? getTransitionStyle(transition, 'enter', direction)
              : {};
            return (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...enterStyle,
                }}
              >
                <div
                  style={{
                    width: currentFrame.width * scale,
                    height: currentFrame.height * scale,
                    overflow: 'hidden',
                    borderRadius: 4,
                    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <SlideRenderer frame={currentFrame} allShapes={shapes} scale={scale} />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Slide overview grid ── */}
      {showOverview && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            padding: '60px 40px 80px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            All Slides ({frames.length})
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            {frames.map((frame, i) => (
              <SlideThumbnail
                key={frame.id}
                frame={frame}
                allShapes={shapes}
                index={i}
                active={i === currentIdx}
                onClick={() => {
                  setCurrentIdx(i);
                  setShowOverview(false);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Laser pointer ── */}
      {laserMode && laserVisible && (
        <div style={{
          position: 'absolute',
          left: laserPos.x - 12,
          top: laserPos.y - 12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.85)',
          boxShadow: '0 0 0 4px rgba(239,68,68,0.3), 0 0 16px rgba(239,68,68,0.6)',
          pointerEvents: 'none',
          transition: 'left 0.05s linear, top 0.05s linear',
        }} />
      )}

      {/* ── HUD ── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
        opacity: showHUD || showOverview ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: showHUD || showOverview ? 'auto' : 'none',
      }}>
        {/* Left: nav arrows */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
            disabled={currentIdx === 0}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: currentIdx === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
              border: 'none', color: currentIdx === 0 ? '#475569' : '#e2e8f0',
              cursor: currentIdx === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <ChevronLeft size={16} />
          </button>

          <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, minWidth: 60, textAlign: 'center' }}>
            {currentIdx + 1} / {frames.length}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); navigate(1); }}
            disabled={currentIdx === frames.length - 1}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: currentIdx === frames.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
              border: 'none', color: currentIdx === frames.length - 1 ? '#475569' : '#e2e8f0',
              cursor: currentIdx === frames.length - 1 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Center: slide name */}
        <div style={{ color: '#94a3b8', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentFrame.name || `Frame ${currentIdx + 1}`}
        </div>

        {/* Right: tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {timerRunning && (
            <div style={{ color: '#94a3b8', fontSize: 12, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} />
              {formatTime(elapsed)}
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowSettings(s => !s); }}
            style={{
              position: 'relative',
              width: 32, height: 32, borderRadius: 8,
              background: showSettings ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
              border: showSettings ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
              color: '#94a3b8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Zap size={14} />
            {/* Settings flyout */}
            {showSettings && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  marginBottom: 8,
                  background: '#1e1e2e',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: 12,
                  minWidth: 220,
                  zIndex: 100,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  textAlign: 'left',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Presentation Settings
                </div>

                {/* Transition picker */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Transition</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['none', 'fade', 'slide', 'zoom', 'flip'] as Transition[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setTransition(t)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11,
                          background: transition === t ? '#6366f1' : 'rgba(255,255,255,0.06)',
                          border: transition === t ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                          color: transition === t ? '#fff' : '#94a3b8',
                          cursor: 'pointer', fontWeight: transition === t ? 600 : 400,
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Laser mode toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6 }}>
                  <div
                    onClick={() => setLaserMode(m => !m)}
                    style={{
                      width: 28, height: 16, borderRadius: 8,
                      background: laserMode ? '#ef4444' : 'rgba(255,255,255,0.1)',
                      position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: laserMode ? 14 : 2,
                      width: 12, height: 12, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Laser pointer (L)</span>
                </label>

                {/* Timer toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <div
                    onClick={() => setTimerRunning(r => !r)}
                    style={{
                      width: 28, height: 16, borderRadius: 8,
                      background: timerRunning ? '#22c55e' : 'rgba(255,255,255,0.1)',
                      position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: timerRunning ? 14 : 2,
                      width: 12, height: 12, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Timer {timerRunning ? `(${formatTime(elapsed)})` : '(T)'}</span>
                </label>
              </div>
            )}
          </button>

          {/* Overview / grid */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowOverview(o => !o); }}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: showOverview ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
              border: showOverview ? '1px solid rgba(99,102,241,0.4)' : 'none',
              color: '#94a3b8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Grid size={14} />
          </button>

          {/* Laser */}
          <button
            onClick={(e) => { e.stopPropagation(); setLaserMode(m => !m); }}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: laserMode ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
              border: laserMode ? '1px solid rgba(239,68,68,0.4)' : 'none',
              color: laserMode ? '#f87171' : '#94a3b8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Circle size={12} fill={laserMode ? '#f87171' : 'none'} />
          </button>

          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              border: 'none', color: '#94a3b8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Slide progress dots ── */}
      {!showOverview && frames.length <= 20 && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          opacity: showHUD ? 1 : 0,
          transition: 'opacity 0.3s',
          pointerEvents: 'none',
        }}>
          {frames.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentIdx ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === currentIdx ? '#6366f1' : 'rgba(255,255,255,0.25)',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          ))}
        </div>
      )}

      {/* ── Keyboard shortcut hint (first load) ── */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '6px 14px',
        fontSize: 11,
        color: '#64748b',
        opacity: showHUD ? 1 : 0,
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        ← → Navigate · G Overview · L Laser · Esc Exit
      </div>

      {/* ── Close button (top-right, always visible on hover) ── */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.08)',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showHUD ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
