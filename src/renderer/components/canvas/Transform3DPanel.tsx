/**
 * Transform3DPanel — Full CSS 3D perspective transform studio.
 *
 * Controls: rotateX, rotateY, rotateZ, perspective depth, translateZ,
 *           plus isometric / floating / flipped / kabob angle presets.
 *
 * Shortcut: Cmd+Shift+Alt+3
 */

import React, { useState, useCallback } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Transform3DValues {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  perspective: number;
  translateZ: number;
}

interface Preset3D {
  id: string;
  name: string;
  emoji: string;
  description: string;
  values: Transform3DValues;
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS: Preset3D[] = [
  {
    id: 'flat',
    name: 'Flat',
    emoji: '⬜',
    description: 'No 3D transform — reset to default',
    values: { rotateX: 0, rotateY: 0, rotateZ: 0, perspective: 800, translateZ: 0 },
  },
  {
    id: 'isometric',
    name: 'Isometric',
    emoji: '⬡',
    description: 'Classic isometric projection (30° X, 45° Y)',
    values: { rotateX: 30, rotateY: 45, rotateZ: 0, perspective: 800, translateZ: 0 },
  },
  {
    id: 'isometric-left',
    name: 'Iso Left',
    emoji: '◧',
    description: 'Isometric left-facing view',
    values: { rotateX: 30, rotateY: -45, rotateZ: 0, perspective: 800, translateZ: 0 },
  },
  {
    id: 'tilt-top',
    name: 'Tilt Top',
    emoji: '⬆',
    description: 'Perspective tilt toward viewer from top',
    values: { rotateX: -20, rotateY: 0, rotateZ: 0, perspective: 600, translateZ: 0 },
  },
  {
    id: 'tilt-bottom',
    name: 'Tilt Bottom',
    emoji: '⬇',
    description: 'Perspective tilt away from viewer at bottom',
    values: { rotateX: 20, rotateY: 0, rotateZ: 0, perspective: 600, translateZ: 0 },
  },
  {
    id: 'tilt-left',
    name: 'Tilt Left',
    emoji: '⬅',
    description: 'Perspective tilt toward viewer from left',
    values: { rotateX: 0, rotateY: -20, rotateZ: 0, perspective: 600, translateZ: 0 },
  },
  {
    id: 'tilt-right',
    name: 'Tilt Right',
    emoji: '➡',
    description: 'Perspective tilt toward viewer from right',
    values: { rotateX: 0, rotateY: 20, rotateZ: 0, perspective: 600, translateZ: 0 },
  },
  {
    id: 'floating',
    name: 'Floating',
    emoji: '🫧',
    description: 'Gentle diagonal float with depth',
    values: { rotateX: -10, rotateY: 15, rotateZ: 0, perspective: 900, translateZ: 40 },
  },
  {
    id: 'flip-horizontal',
    name: 'Flip H',
    emoji: '↔',
    description: 'Flip horizontally (180° Y)',
    values: { rotateX: 0, rotateY: 180, rotateZ: 0, perspective: 800, translateZ: 0 },
  },
  {
    id: 'flip-vertical',
    name: 'Flip V',
    emoji: '↕',
    description: 'Flip vertically (180° X)',
    values: { rotateX: 180, rotateY: 0, rotateZ: 0, perspective: 800, translateZ: 0 },
  },
  {
    id: 'book-open',
    name: 'Book',
    emoji: '📖',
    description: 'Open book / folded card left panel',
    values: { rotateX: 0, rotateY: 40, rotateZ: 0, perspective: 500, translateZ: 0 },
  },
  {
    id: 'overhead',
    name: 'Overhead',
    emoji: '🔭',
    description: 'Bird\'s eye / top-down view',
    values: { rotateX: 60, rotateY: 0, rotateZ: 0, perspective: 800, translateZ: 0 },
  },
  {
    id: 'side-profile',
    name: 'Side',
    emoji: '🪟',
    description: 'Near-side profile view',
    values: { rotateX: 0, rotateY: 70, rotateZ: 0, perspective: 600, translateZ: 0 },
  },
  {
    id: 'cabinet',
    name: 'Cabinet',
    emoji: '🗄️',
    description: 'Cabinet / oblique projection look',
    values: { rotateX: 20, rotateY: 30, rotateZ: -5, perspective: 900, translateZ: 0 },
  },
  {
    id: 'spin-45',
    name: '45° Spin',
    emoji: '🔄',
    description: 'Diamond orientation — 45° Z rotation',
    values: { rotateX: 0, rotateY: 0, rotateZ: 45, perspective: 800, translateZ: 0 },
  },
  {
    id: 'hero-tilt',
    name: 'Hero Tilt',
    emoji: '🦸',
    description: 'Dramatic hero section perspective card',
    values: { rotateX: -8, rotateY: 12, rotateZ: -2, perspective: 700, translateZ: 20 },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '°',
  onChange,
  color = 'var(--accent, #6366f1)',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text, #e2e8f0)', fontVariantNumeric: 'tabular-nums' }}>
          {value > 0 && unit === '°' ? '+' : ''}{value}{unit}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            flex: 1,
            height: 4,
            accentColor: color,
            cursor: 'pointer',
          }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: 48,
            background: 'var(--input-bg, #13131f)',
            border: '1px solid var(--border, #2d2d3d)',
            borderRadius: 4,
            padding: '2px 4px',
            fontSize: 10,
            color: 'var(--text, #e2e8f0)',
            textAlign: 'right',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}

// Mini 3D preview of a rectangle with the current transform
function Preview3D({ rx, ry, rz, perspective }: { rx: number; ry: number; rz: number; perspective: number }) {
  const transform = `perspective(${perspective}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 120,
        background: 'var(--canvas-bg, #0f0f17)',
        borderRadius: 8,
        border: '1px solid var(--border, #2d2d3d)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, var(--canvas-dot, #2a2a3a) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          opacity: 0.5,
        }}
      />
      <div
        style={{
          width: 80,
          height: 52,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          borderRadius: 6,
          transform,
          boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.7)',
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        Preview
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  selectedShapeIds: string[];
  onUpdate: (ids: string[], patch: Partial<Shape>) => void;
}

export function Transform3DPanel({ open, onClose, selectedShape, selectedShapeIds, onUpdate }: Props) {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Derive current values from selected shape
  const current: Transform3DValues = {
    rotateX: selectedShape?.transform3dRotateX ?? 0,
    rotateY: selectedShape?.transform3dRotateY ?? 0,
    rotateZ: selectedShape?.transform3dRotateZ ?? 0,
    perspective: selectedShape?.transform3dPerspective ?? 800,
    translateZ: selectedShape?.transform3dTranslateZ ?? 0,
  };

  const ids = selectedShapeIds.length > 0
    ? selectedShapeIds
    : selectedShape ? [selectedShape.id] : [];
  const hasSelection = ids.length > 0;

  const apply = useCallback((patch: Partial<Shape>) => {
    if (ids.length === 0) return;
    onUpdate(ids, patch);
    setActivePreset(null);
  }, [ids, onUpdate]);

  const applyValues = useCallback((v: Transform3DValues) => {
    onUpdate(ids, {
      transform3dRotateX: v.rotateX,
      transform3dRotateY: v.rotateY,
      transform3dRotateZ: v.rotateZ,
      transform3dPerspective: v.perspective,
      transform3dTranslateZ: v.translateZ,
    });
  }, [ids, onUpdate]);

  const applyPreset = useCallback((preset: Preset3D) => {
    if (!hasSelection) return;
    setActivePreset(preset.id);
    applyValues(preset.values);
  }, [hasSelection, applyValues]);

  const reset = useCallback(() => {
    if (!hasSelection) return;
    onUpdate(ids, {
      transform3dRotateX: 0,
      transform3dRotateY: 0,
      transform3dRotateZ: 0,
      transform3dPerspective: 800,
      transform3dTranslateZ: 0,
    });
    setActivePreset('flat');
  }, [ids, hasSelection, onUpdate]);

  if (!open) return null;

  const is3DActive =
    current.rotateX !== 0 || current.rotateY !== 0 || current.rotateZ !== 0 || current.translateZ !== 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        right: 340,
        width: 300,
        maxHeight: 'calc(100vh - 80px)',
        background: 'var(--panel, #1e1e2e)',
        border: '1px solid var(--border, #2d2d3d)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        zIndex: 310,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border, #2d2d3d)',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🧊 3D Transform Studio
            {is3DActive && (
              <span style={{
                background: 'var(--accent, #6366f1)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 4,
                letterSpacing: '0.03em',
              }}>
                ACTIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
            {hasSelection ? `${ids.length} shape${ids.length > 1 ? 's' : ''} selected` : 'Select a shape'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {is3DActive && (
            <button
              onClick={reset}
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 6,
                color: '#ef4444',
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
              title="Reset all 3D transforms"
            >
              Reset
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted, #888)', cursor: 'pointer', fontSize: 16, padding: 4, borderRadius: 4 }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 3D Preview */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <Preview3D
            rx={current.rotateX}
            ry={current.rotateY}
            rz={current.rotateZ}
            perspective={current.perspective}
          />
        </div>

        {/* Presets grid */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Presets
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                title={preset.description}
                style={{
                  background: activePreset === preset.id ? 'var(--accent, #6366f1)' : 'var(--panel-alt, #252535)',
                  border: activePreset === preset.id ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border, #2d2d3d)',
                  borderRadius: 6,
                  padding: '5px 2px',
                  cursor: hasSelection ? 'pointer' : 'not-allowed',
                  opacity: hasSelection ? 1 : 0.4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 14 }}>{preset.emoji}</span>
                <span style={{ fontSize: 8, fontWeight: 600, color: activePreset === preset.id ? '#fff' : 'var(--muted, #888)', lineHeight: 1.1, textAlign: 'center' }}>
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Manual controls */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Manual Controls
          </div>

          {/* Rotation */}
          <div
            style={{
              background: 'var(--panel-alt, #252535)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent, #6366f1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rotation
            </div>
            <Knob
              label="Rotate X"
              value={current.rotateX}
              min={-180}
              max={180}
              color="#ef4444"
              onChange={(v) => apply({ transform3dRotateX: v })}
            />
            <Knob
              label="Rotate Y"
              value={current.rotateY}
              min={-180}
              max={180}
              color="#22c55e"
              onChange={(v) => apply({ transform3dRotateY: v })}
            />
            <Knob
              label="Rotate Z"
              value={current.rotateZ}
              min={-180}
              max={180}
              color="#3b82f6"
              onChange={(v) => apply({ transform3dRotateZ: v })}
            />
          </div>

          {/* Perspective & Depth */}
          <div
            style={{
              background: 'var(--panel-alt, #252535)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Depth
            </div>
            <Knob
              label="Perspective"
              value={current.perspective}
              min={100}
              max={2000}
              step={50}
              unit="px"
              color="#f59e0b"
              onChange={(v) => apply({ transform3dPerspective: v })}
            />
            <Knob
              label="Translate Z"
              value={current.translateZ}
              min={-500}
              max={500}
              step={10}
              unit="px"
              color="#a78bfa"
              onChange={(v) => apply({ transform3dTranslateZ: v })}
            />
          </div>

          {/* Axis diagram */}
          <div
            style={{
              background: 'var(--panel-alt, #252535)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Axis Reference
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <svg width={64} height={64} viewBox="0 0 64 64">
                {/* Origin */}
                <circle cx={32} cy={32} r={3} fill="var(--muted, #888)" />
                {/* X axis - red */}
                <line x1={32} y1={32} x2={58} y2={32} stroke="#ef4444" strokeWidth={2} />
                <polygon points="58,30 62,32 58,34" fill="#ef4444" />
                <text x={50} y={28} fontSize={8} fill="#ef4444" fontWeight="bold">X</text>
                {/* Y axis - green */}
                <line x1={32} y1={32} x2={32} y2={6} stroke="#22c55e" strokeWidth={2} />
                <polygon points="30,6 32,2 34,6" fill="#22c55e" />
                <text x={35} y={12} fontSize={8} fill="#22c55e" fontWeight="bold">Y</text>
                {/* Z axis - blue (into screen, drawn at angle) */}
                <line x1={32} y1={32} x2={14} y2={50} stroke="#3b82f6" strokeWidth={2} strokeDasharray="3,2" />
                <polygon points="12,52 10,47 16,49" fill="#3b82f6" />
                <text x={7} y={58} fontSize={8} fill="#3b82f6" fontWeight="bold">Z</text>
              </svg>
              <div style={{ flex: 1, fontSize: 9, color: 'var(--muted, #888)', lineHeight: 1.6 }}>
                <div><span style={{ color: '#ef4444', fontWeight: 700 }}>X</span> — nod (pitch)</div>
                <div><span style={{ color: '#22c55e', fontWeight: 700 }}>Y</span> — shake (yaw)</div>
                <div><span style={{ color: '#3b82f6', fontWeight: 700 }}>Z</span> — roll (in-plane)</div>
                <div style={{ marginTop: 4, color: 'var(--subtle, #555)' }}>
                  Lower perspective = more distortion
                </div>
              </div>
            </div>
          </div>

          {/* Quick transforms */}
          <div
            style={{
              background: 'var(--panel-alt, #252535)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Nudge
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {(
                [
                  { label: 'X −15°', dx: -15, dy: 0, dz: 0 },
                  { label: 'X +15°', dx: 15, dy: 0, dz: 0 },
                  { label: 'Y −15°', dx: 0, dy: -15, dz: 0 },
                  { label: 'Y +15°', dx: 0, dy: 15, dz: 0 },
                  { label: 'Z −15°', dx: 0, dy: 0, dz: -15 },
                  { label: 'Z +15°', dx: 0, dy: 0, dz: 15 },
                ] as { label: string; dx: number; dy: number; dz: number }[]
              ).map(({ label, dx, dy, dz }) => (
                <button
                  key={label}
                  onClick={() => {
                    if (!hasSelection) return;
                    apply({
                      transform3dRotateX: current.rotateX + dx,
                      transform3dRotateY: current.rotateY + dy,
                      transform3dRotateZ: current.rotateZ + dz,
                    });
                  }}
                  style={{
                    background: 'var(--panel, #1e1e2e)',
                    border: '1px solid var(--border, #2d2d3d)',
                    borderRadius: 4,
                    color: 'var(--text, #e2e8f0)',
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '4px 2px',
                    cursor: hasSelection ? 'pointer' : 'not-allowed',
                    opacity: hasSelection ? 1 : 0.5,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* CSS Output */}
          {is3DActive && (
            <div
              style={{
                background: 'var(--panel-alt, #252535)',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Generated CSS
              </div>
              <code
                style={{
                  fontSize: 9,
                  color: '#a5f3fc',
                  background: 'var(--canvas-bg, #0f0f17)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  display: 'block',
                  lineHeight: 1.7,
                  userSelect: 'all',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {`transform: perspective(${current.perspective}px)${current.rotateX !== 0 ? ` rotateX(${current.rotateX}deg)` : ''}${current.rotateY !== 0 ? ` rotateY(${current.rotateY}deg)` : ''}${current.rotateZ !== 0 ? ` rotateZ(${current.rotateZ}deg)` : ''}${current.translateZ !== 0 ? ` translateZ(${current.translateZ}px)` : ''};
transform-style: preserve-3d;`}
              </code>
              <button
                onClick={() => {
                  const css = `transform: perspective(${current.perspective}px)${current.rotateX !== 0 ? ` rotateX(${current.rotateX}deg)` : ''}${current.rotateY !== 0 ? ` rotateY(${current.rotateY}deg)` : ''}${current.rotateZ !== 0 ? ` rotateZ(${current.rotateZ}deg)` : ''}${current.translateZ !== 0 ? ` translateZ(${current.translateZ}px)` : ''};\ntransform-style: preserve-3d;`;
                  navigator.clipboard.writeText(css).catch(() => {});
                }}
                style={{
                  background: 'var(--panel, #1e1e2e)',
                  border: '1px solid var(--border, #2d2d3d)',
                  borderRadius: 6,
                  color: 'var(--muted, #888)',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '5px 10px',
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                Copy CSS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '7px 12px',
          borderTop: '1px solid var(--border, #2d2d3d)',
          fontSize: 10,
          color: 'var(--muted, #888)',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{PRESETS.length} presets · Full CSS 3D</span>
        <span>⌘⇧⌥3</span>
      </div>
    </div>
  );
}
