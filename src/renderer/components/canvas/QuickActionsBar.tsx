/**
 * QuickActionsBar — Contextual floating toolbar near the selected shape.
 *
 * Appears above or below the selected shape (wherever fits better) with:
 * - Duplicate / Delete / Lock / Hide
 * - Flip H / Flip V
 * - Bring to front / Send to back
 * - Copy style / Paste style (eyedropper)
 * - Quick opacity slider
 *
 * Disappears when nothing is selected. Stays out of the way when near edges.
 */

import React, { useRef, useState, useCallback } from 'react';
import { Lock, Unlock, Eye, EyeOff, FlipHorizontal, FlipVertical, ChevronsUp, ChevronsDown, Copy, ClipboardPaste, Circle } from 'lucide-react';
import type { Shape } from '../../lib/shapes';

interface Props {
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  shapes: Shape[];
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onToggleHide: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onOpacityChange: (opacity: number) => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
  hasCopiedStyle: boolean;
  enabled: boolean;
}

interface TooltipProps {
  children: React.ReactNode;
  tip: string;
}

function Btn({
  onClick, children, active, danger, disabled, title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26, height: 26,
        background: active
          ? 'rgba(99,102,241,0.25)'
          : danger && hover
            ? 'rgba(239,68,68,0.2)'
            : hover
              ? 'rgba(255,255,255,0.08)'
              : 'transparent',
        border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
        borderRadius: 5,
        color: active
          ? 'var(--accent, #6366f1)'
          : danger && hover
            ? '#ef4444'
            : disabled
              ? 'var(--subtle, #444)'
              : 'var(--text, #e2e8f0)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, transition: 'background 0.1s, color 0.1s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 16, background: 'var(--border, #2d2d3d)', margin: '0 2px', flexShrink: 0 }} />;
}

export function QuickActionsBar({
  selectedShape, selectedShapeIds, shapes, zoom, panX, panY,
  canvasWidth, canvasHeight,
  onDuplicate, onDelete, onToggleLock, onToggleHide,
  onBringToFront, onSendToBack, onFlipH, onFlipV,
  onOpacityChange, onCopyStyle, onPasteStyle, hasCopiedStyle,
  enabled,
}: Props) {
  const [opacityOpen, setOpacityOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  if (!enabled || !selectedShape) return null;

  const s = selectedShape;

  // Calculate position in screen space
  const shapeRight = (s.x + s.width) * zoom + panX;
  const shapeTop = s.y * zoom + panY;
  const shapeBottom = (s.y + s.height) * zoom + panY;
  const shapeCenterX = (s.x + s.width / 2) * zoom + panX;

  const BAR_W = 310;
  const BAR_H = 34;
  const MARGIN = 8;
  const ABOVE = shapeTop - BAR_H - MARGIN;
  const BELOW = shapeBottom + MARGIN;

  // Prefer above, fall back to below
  let top = ABOVE >= 10 ? ABOVE : BELOW;
  let left = shapeCenterX - BAR_W / 2;

  // Clamp to canvas bounds
  left = Math.max(MARGIN, Math.min(canvasWidth - BAR_W - MARGIN, left));
  top = Math.max(MARGIN, Math.min(canvasHeight - BAR_H - MARGIN - 24, top));

  const idx = shapes.findIndex(sh => sh.id === s.id);
  const isFirst = idx === 0;
  const isLast = idx === shapes.length - 1;
  const opacity = s.opacity ?? 1;

  return (
    <div
      ref={barRef}
      style={{
        position: 'absolute',
        left,
        top,
        height: BAR_H,
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        gap: 1,
        zIndex: 21,
        userSelect: 'none',
        pointerEvents: 'all',
        flexShrink: 0,
        width: BAR_W,
      }}
    >
      {/* Lock */}
      <Btn onClick={onToggleLock} active={s.locked} title={s.locked ? 'Unlock' : 'Lock'}>
        {s.locked ? <Lock size={13} /> : <Unlock size={13} />}
      </Btn>

      {/* Hide/show */}
      <Btn onClick={onToggleHide} active={s.hidden} title={s.hidden ? 'Show' : 'Hide'}>
        {s.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </Btn>

      <Sep />

      {/* Flip H */}
      <Btn onClick={onFlipH} title="Flip horizontal">
        <FlipHorizontal size={13} />
      </Btn>

      {/* Flip V */}
      <Btn onClick={onFlipV} title="Flip vertical">
        <FlipVertical size={13} />
      </Btn>

      <Sep />

      {/* Bring to front */}
      <Btn onClick={onBringToFront} disabled={isLast} title="Bring to front">
        <ChevronsUp size={13} />
      </Btn>

      {/* Send to back */}
      <Btn onClick={onSendToBack} disabled={isFirst} title="Send to back">
        <ChevronsDown size={13} />
      </Btn>

      <Sep />

      {/* Copy style */}
      <Btn onClick={onCopyStyle} title="Copy style (fill, stroke, effects)">
        <Copy size={13} />
      </Btn>

      {/* Paste style */}
      <Btn onClick={onPasteStyle} disabled={!hasCopiedStyle} active={hasCopiedStyle} title={hasCopiedStyle ? 'Paste style' : 'No style copied'}>
        <ClipboardPaste size={13} />
      </Btn>

      <Sep />

      {/* Opacity */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpacityOpen(o => !o)}
          title={`Opacity: ${Math.round(opacity * 100)}%`}
          style={{
            height: 26, padding: '0 6px',
            background: opacityOpen ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: `1px solid ${opacityOpen ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
            borderRadius: 5,
            color: 'var(--text, #e2e8f0)',
            cursor: 'pointer', fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
            display: 'flex', alignItems: 'center', gap: 3,
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--muted, #888)' }}>○</span>
          {Math.round(opacity * 100)}%
        </button>

        {opacityOpen && (
          <div style={{
            position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--panel, #1e1e2e)',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 6, padding: '6px 10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            width: 120, zIndex: 100,
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginBottom: 4 }}>Opacity</div>
            <input
              type="range" min={0} max={100} value={Math.round(opacity * 100)}
              onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
              style={{ width: '100%', accentColor: 'var(--accent, #6366f1)' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text)', textAlign: 'center', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              {Math.round(opacity * 100)}%
            </div>
          </div>
        )}
      </div>

      <Sep />

      {/* Duplicate */}
      <Btn onClick={onDuplicate} title="Duplicate (⌘D)">
        ⧉
      </Btn>

      {/* Delete */}
      <Btn onClick={onDelete} danger title="Delete (⌫)">
        ✕
      </Btn>
    </div>
  );
}
