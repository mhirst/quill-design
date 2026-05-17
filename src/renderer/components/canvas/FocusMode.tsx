/**
 * FocusMode — Cinematic "spotlight" that dims everything except the selected shape(s).
 *
 * When active:
 *  - A dark translucent overlay covers the entire canvas
 *  - The selected shapes' bounding box is cut out (transparent) with a soft vignette
 *  - A floating status bar shows "Focus Mode • Press Escape to exit"
 *  - Animated breathing glow around the focused area
 *  - Keyboard shortcut: ⌘⇧F to toggle
 *
 * Pure CSS/SVG — no canvas mutations. Sits above the canvas at z-index 25.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Props {
  shapes: Shape[];
  selectedIds: string[];
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  active: boolean;
  onExit: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function canvasToScreen(v: number, zoom: number, pan: number) {
  return v * zoom + pan;
}

// Compute the screen-space bounding box of all selected shapes
function computeBounds(
  shapes: Shape[],
  selectedIds: string[],
  zoom: number,
  panX: number,
  panY: number,
) {
  const selected = shapes.filter(s => selectedIds.includes(s.id));
  if (selected.length === 0) return null;

  const minX = Math.min(...selected.map(s => s.x));
  const minY = Math.min(...selected.map(s => s.y));
  const maxX = Math.max(...selected.map(s => s.x + s.width));
  const maxY = Math.max(...selected.map(s => s.y + s.height));

  return {
    x: canvasToScreen(minX, zoom, panX),
    y: canvasToScreen(minY, zoom, panY),
    w: (maxX - minX) * zoom,
    h: (maxY - minY) * zoom,
  };
}

// ── Breathing Glow ─────────────────────────────────────────────────────────────

function BreathingGlow({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const PAD = 12;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - PAD,
        top: y - PAD,
        width: w + PAD * 2,
        height: h + PAD * 2,
        borderRadius: 6,
        pointerEvents: 'none',
        boxShadow: '0 0 0 2px rgba(99,102,241,0.6), 0 0 30px rgba(99,102,241,0.3)',
        animation: 'focusBreathe 2.5s ease-in-out infinite',
        zIndex: 27,
      }}
    />
  );
}

// ── Focus Mode Overlay ─────────────────────────────────────────────────────────

export function FocusMode({
  shapes,
  selectedIds,
  zoom,
  panX,
  panY,
  canvasWidth,
  canvasHeight,
  active,
  onExit,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const animRef = useRef<number | null>(null);

  // Animate in
  useEffect(() => {
    if (active) {
      // Small delay lets the transition render
      const t = setTimeout(() => setMounted(true), 16);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
      return;
    }
  }, [active]);

  // ESC key exits
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onExit(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onExit]);

  // Inject CSS animation once
  useEffect(() => {
    const id = 'focus-mode-keyframes';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        @keyframes focusBreathe {
          0%, 100% { opacity: 0.7; box-shadow: 0 0 0 2px rgba(99,102,241,0.6), 0 0 30px rgba(99,102,241,0.25); }
          50% { opacity: 1; box-shadow: 0 0 0 2px rgba(99,102,241,0.9), 0 0 50px rgba(99,102,241,0.45); }
        }
        @keyframes focusFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes focusBarSlide {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  if (!active) return null;

  const bounds = computeBounds(shapes, selectedIds, zoom, panX, panY);

  // Build SVG clip path: full rectangle minus the focused area
  const PAD = 20; // padding around focused element
  const id_unique = 'focus-clip';

  const fx = bounds ? bounds.x - PAD : -1000;
  const fy = bounds ? bounds.y - PAD : -1000;
  const fw = bounds ? bounds.w + PAD * 2 : 0;
  const fh = bounds ? bounds.h + PAD * 2 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: canvasWidth,
        height: canvasHeight,
        zIndex: 25,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* SVG overlay with cutout */}
      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={{
          position: 'absolute',
          inset: 0,
          animation: mounted ? 'focusFadeIn 0.35s ease forwards' : 'none',
          opacity: mounted ? 1 : 0,
        }}
      >
        <defs>
          <mask id={id_unique}>
            {/* White = visible (dimmed), Black = cut out (clear) */}
            <rect width={canvasWidth} height={canvasHeight} fill="white" />
            {bounds && (
              <rect
                x={fx} y={fy}
                width={fw} height={fh}
                rx={6}
                fill="black"
              />
            )}
          </mask>
          {/* Radial gradient for softer vignette */}
          {bounds && (
            <radialGradient
              id="focus-vignette"
              cx={`${((fx + fw / 2) / canvasWidth) * 100}%`}
              cy={`${((fy + fh / 2) / canvasHeight) * 100}%`}
              r="70%"
              fx="50%" fy="50%"
            >
              <stop offset="0%" stopColor="rgba(0,0,0,0)" />
              <stop offset="60%" stopColor="rgba(0,0,0,0.25)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.65)" />
            </radialGradient>
          )}
        </defs>

        {/* Main dimming layer with cutout */}
        <rect
          width={canvasWidth}
          height={canvasHeight}
          fill="rgba(10,10,20,0.72)"
          mask={`url(#${id_unique})`}
        />

        {/* Soft vignette on top */}
        {bounds && (
          <rect
            width={canvasWidth}
            height={canvasHeight}
            fill="url(#focus-vignette)"
            mask={`url(#${id_unique})`}
          />
        )}
      </svg>

      {/* Breathing glow ring around focused shape */}
      {bounds && mounted && (
        <BreathingGlow x={fx} y={fy} w={fw} h={fh} />
      )}

      {/* Status bar — click-through disabled area so user can still interact */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(10,10,20,0.85)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 100,
          padding: '7px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          backdropFilter: 'blur(8px)',
          animation: mounted ? 'focusBarSlide 0.4s ease 0.1s forwards' : 'none',
          opacity: mounted ? undefined : 0,
          pointerEvents: 'all',
          userSelect: 'none',
          zIndex: 28,
          whiteSpace: 'nowrap',
        }}
      >
        {/* Dot indicator */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#6366f1',
          boxShadow: '0 0 8px #6366f1',
          animation: 'focusBreathe 2.5s ease-in-out infinite',
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: 'rgba(255,255,255,0.8)',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.03em',
        }}>
          Focus Mode
        </span>
        <span style={{
          width: 1, height: 12,
          background: 'rgba(255,255,255,0.15)',
          flexShrink: 0,
        }} />
        {bounds && (
          <span style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.45)',
            fontFamily: 'system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.round(bounds.w / zoom)} × {Math.round(bounds.h / zoom)}
          </span>
        )}
        <span style={{
          width: 1, height: 12,
          background: 'rgba(255,255,255,0.15)',
          flexShrink: 0,
        }} />
        <button
          onClick={onExit}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            fontFamily: 'system-ui, sans-serif',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: 0,
          }}
        >
          <span style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 3,
            padding: '0px 5px',
            fontSize: 10,
            lineHeight: '16px',
          }}>
            Esc
          </span>
          <span>to exit</span>
        </button>
      </div>

      {/* Selected shape count badge */}
      {selectedIds.length > 1 && (
        <div style={{
          position: 'absolute',
          top: bounds ? Math.max(8, fy - 28) : 8,
          left: bounds ? fx : 8,
          background: 'rgba(99,102,241,0.9)',
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 11,
          fontWeight: 600,
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          animation: mounted ? 'focusFadeIn 0.4s ease forwards' : 'none',
          opacity: mounted ? 1 : 0,
          pointerEvents: 'none',
          zIndex: 28,
        }}>
          {selectedIds.length} shapes focused
        </div>
      )}
    </div>
  );
}
