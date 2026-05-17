/**
 * MicroInteractionPanel — CSS micro-interaction state builder.
 *
 * Features:
 *  - Define hover, focus, active, disabled states for a selected shape
 *  - Per-state controls: transform (scale/translate/rotate), opacity,
 *    background color, border, box-shadow, transition duration + easing
 *  - Live interactive preview: hover/click on preview element to see states
 *  - CSS export: generates full .element:hover { ... } blocks
 *  - 12 quick-apply interaction presets (lift, glow, shrink, bounce, etc.)
 *  - Keyboard: ⌘⇧⌥I to toggle (reuses layout inspector shortcut, different layer)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Shape } from '../../lib/shapes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Props {
  open: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
}

type StateId = 'hover' | 'focus' | 'active' | 'disabled';

interface StateConfig {
  enabled: boolean;
  scale: number;
  translateY: number;
  translateX: number;
  rotate: number;
  opacity: number;
  backgroundColor: string;
  boxShadow: string;
  borderColor: string;
  borderWidth: number;
  filter: string;
  duration: number;
  easing: string;
}

const DEFAULT_STATE: StateConfig = {
  enabled: false,
  scale: 1,
  translateY: 0,
  translateX: 0,
  rotate: 0,
  opacity: 1,
  backgroundColor: '',
  boxShadow: '',
  borderColor: '',
  borderWidth: 0,
  filter: '',
  duration: 200,
  easing: 'ease',
};

// ── Quick Presets ──────────────────────────────────────────────────────────────

interface MicroPreset {
  id: string;
  label: string;
  emoji: string;
  states: Partial<Record<StateId, Partial<StateConfig>>>;
}

const PRESETS: MicroPreset[] = [
  {
    id: 'lift',
    label: 'Lift',
    emoji: '⬆️',
    states: {
      hover: { enabled: true, translateY: -4, scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', duration: 200 },
      active: { enabled: true, translateY: -1, scale: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', duration: 100 },
    },
  },
  {
    id: 'glow',
    label: 'Glow',
    emoji: '✨',
    states: {
      hover: { enabled: true, boxShadow: '0 0 20px rgba(99,102,241,0.6)', scale: 1.01, duration: 300 },
      active: { enabled: true, boxShadow: '0 0 8px rgba(99,102,241,0.4)', duration: 100 },
    },
  },
  {
    id: 'shrink',
    label: 'Press',
    emoji: '🫳',
    states: {
      hover: { enabled: true, scale: 1.02, duration: 150 },
      active: { enabled: true, scale: 0.97, duration: 80 },
    },
  },
  {
    id: 'fade',
    label: 'Fade',
    emoji: '👻',
    states: {
      hover: { enabled: true, opacity: 0.75, duration: 200 },
      active: { enabled: true, opacity: 0.5, duration: 80 },
    },
  },
  {
    id: 'slide-right',
    label: 'Slide →',
    emoji: '➡️',
    states: {
      hover: { enabled: true, translateX: 4, duration: 200 },
      active: { enabled: true, translateX: 2, duration: 80 },
    },
  },
  {
    id: 'spin',
    label: 'Spin',
    emoji: '🌀',
    states: {
      hover: { enabled: true, rotate: 12, scale: 1.05, duration: 300, easing: 'ease-out' },
      active: { enabled: true, rotate: -6, duration: 100 },
    },
  },
  {
    id: 'bounce',
    label: 'Bounce',
    emoji: '🏀',
    states: {
      hover: { enabled: true, scale: 1.1, translateY: -6, duration: 300, easing: 'cubic-bezier(0.34,1.56,0.64,1)' },
      active: { enabled: true, scale: 0.95, translateY: 2, duration: 100 },
    },
  },
  {
    id: 'highlight',
    label: 'Highlight',
    emoji: '🖌️',
    states: {
      hover: { enabled: true, backgroundColor: 'rgba(99,102,241,0.15)', borderColor: '#6366f1', borderWidth: 2, duration: 150 },
      active: { enabled: true, backgroundColor: 'rgba(99,102,241,0.25)', duration: 80 },
    },
  },
  {
    id: 'grayscale',
    label: 'Desaturate',
    emoji: '🩶',
    states: {
      hover: { enabled: false },
      disabled: { enabled: true, opacity: 0.5, filter: 'grayscale(1)', duration: 200 },
    },
  },
  {
    id: 'grow-border',
    label: 'Border',
    emoji: '⬜',
    states: {
      hover: { enabled: true, borderColor: '#6366f1', borderWidth: 3, duration: 150 },
      focus: { enabled: true, borderColor: '#818cf8', borderWidth: 3, boxShadow: '0 0 0 4px rgba(99,102,241,0.2)', duration: 150 },
    },
  },
  {
    id: 'blur-in',
    label: 'Blur In',
    emoji: '🔮',
    states: {
      hover: { enabled: true, filter: 'blur(0px)', opacity: 1, duration: 200 },
      disabled: { enabled: true, filter: 'blur(2px)', opacity: 0.6, duration: 200 },
    },
  },
  {
    id: 'ripple',
    label: 'Ripple',
    emoji: '💧',
    states: {
      hover: { enabled: true, scale: 1.03, boxShadow: '0 0 0 6px rgba(99,102,241,0.1)', duration: 250 },
      active: { enabled: true, scale: 0.98, boxShadow: '0 0 0 2px rgba(99,102,241,0.3)', duration: 80 },
    },
  },
];

// ── CSS Generator ──────────────────────────────────────────────────────────────

function stateToCSS(state: StateConfig): string {
  const transforms: string[] = [];
  if (state.scale !== 1) transforms.push(`scale(${state.scale})`);
  if (state.translateX !== 0) transforms.push(`translateX(${state.translateX}px)`);
  if (state.translateY !== 0) transforms.push(`translateY(${state.translateY}px)`);
  if (state.rotate !== 0) transforms.push(`rotate(${state.rotate}deg)`);

  const props: string[] = [];
  if (transforms.length) props.push(`  transform: ${transforms.join(' ')};`);
  if (state.opacity !== 1) props.push(`  opacity: ${state.opacity};`);
  if (state.backgroundColor) props.push(`  background-color: ${state.backgroundColor};`);
  if (state.boxShadow) props.push(`  box-shadow: ${state.boxShadow};`);
  if (state.borderColor && state.borderWidth) {
    props.push(`  border: ${state.borderWidth}px solid ${state.borderColor};`);
  }
  if (state.filter) props.push(`  filter: ${state.filter};`);
  return props.join('\n');
}

function generateFullCSS(
  shapeName: string,
  baseState: StateConfig,
  states: Record<StateId, StateConfig>,
): string {
  const selector = `.${shapeName.replace(/\s+/g, '-').toLowerCase() || 'element'}`;
  const transitionProps = ['transform', 'opacity', 'background-color', 'box-shadow', 'border', 'filter'];
  const baseDuration = baseState.duration;
  const baseEasing = baseState.easing;

  const lines: string[] = [];
  lines.push(`${selector} {`);
  lines.push(`  transition: ${transitionProps.join(', ')} ${baseDuration}ms ${baseEasing};`);
  lines.push(`}`);

  const stateMap: [StateId, string][] = [
    ['hover', ':hover'],
    ['focus', ':focus'],
    ['active', ':active'],
    ['disabled', ':disabled, [aria-disabled="true"]'],
  ];

  for (const [stateId, pseudo] of stateMap) {
    const state = states[stateId];
    if (!state.enabled) continue;
    const css = stateToCSS(state);
    if (!css) continue;
    lines.push('');
    lines.push(`${selector}${pseudo} {`);
    if (state.duration !== baseDuration || state.easing !== baseEasing) {
      lines.push(`  transition-duration: ${state.duration}ms;`);
    }
    lines.push(css);
    lines.push(`}`);
  }

  return lines.join('\n');
}

// ── Live Preview ───────────────────────────────────────────────────────────────

interface PreviewProps {
  shape: Shape | null;
  states: Record<StateId, StateConfig>;
  baseEasing: string;
  baseDuration: number;
}

function MicroPreview({ shape, states, baseEasing, baseDuration }: PreviewProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(false);

  const getActiveState = (): StateConfig | null => {
    if (active && states.active.enabled) return states.active;
    if (hovered && states.hover.enabled) return states.hover;
    if (focused && states.focus.enabled) return states.focus;
    return null;
  };

  const s = getActiveState();
  const transforms: string[] = [];
  if (s) {
    if (s.scale !== 1) transforms.push(`scale(${s.scale})`);
    if (s.translateX !== 0) transforms.push(`translateX(${s.translateX}px)`);
    if (s.translateY !== 0) transforms.push(`translateY(${s.translateY}px)`);
    if (s.rotate !== 0) transforms.push(`rotate(${s.rotate}deg)`);
  }

  const previewStyle: React.CSSProperties = {
    width: 120, height: 60,
    borderRadius: shape?.borderRadius ? (typeof shape.borderRadius === 'number' ? shape.borderRadius : 8) : 8,
    background: s?.backgroundColor || shape?.fill || '#6366f1',
    opacity: s ? s.opacity : 1,
    boxShadow: s?.boxShadow || 'none',
    border: s?.borderColor && s?.borderWidth
      ? `${s.borderWidth}px solid ${s.borderColor}`
      : `1px solid transparent`,
    filter: s?.filter || 'none',
    transform: transforms.length ? transforms.join(' ') : 'none',
    transition: `all ${(s?.duration ?? baseDuration)}ms ${s?.easing ?? baseEasing}`,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontSize: 11, fontWeight: 600,
    userSelect: 'none',
  };

  const label = hovered ? 'hover' : focused ? 'focus' : active ? 'active' : 'default';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '16px 12px',
      background: 'rgba(10,10,20,0.6)',
      borderRadius: 8,
      border: '1px solid var(--border, #2d2d3d)',
      margin: '0 12px 10px',
    }}>
      <div
        style={previewStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setActive(false); }}
        onMouseDown={() => setActive(true)}
        onMouseUp={() => setActive(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        tabIndex={0}
        role="button"
      >
        {shape?.name || 'Element'}
      </div>
      <div style={{ fontSize: 9, color: 'var(--muted, #888)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{
          padding: '1px 6px', borderRadius: 4,
          background: label === 'default' ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.2)',
          color: label === 'default' ? 'var(--muted)' : '#818cf8',
          fontSize: 9, fontWeight: 600,
        }}>
          {label}
        </span>
        <span>Hover / click to test</span>
      </div>
    </div>
  );
}

// ── State Editor ───────────────────────────────────────────────────────────────

function StateEditor({
  stateId, config, onChange,
}: {
  stateId: StateId;
  config: StateConfig;
  onChange: (patch: Partial<StateConfig>) => void;
}) {
  const stateLabels: Record<StateId, string> = {
    hover: '🖱 Hover',
    focus: '🎯 Focus',
    active: '👆 Active',
    disabled: '🚫 Disabled',
  };

  return (
    <div style={{
      border: `1px solid ${config.enabled ? 'rgba(99,102,241,0.3)' : 'var(--border, #2d2d3d)'}`,
      borderRadius: 8, overflow: 'hidden', marginBottom: 8,
    }}>
      {/* State header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px',
        background: config.enabled ? 'rgba(99,102,241,0.08)' : 'transparent',
      }}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={e => onChange({ enabled: e.target.checked })}
          style={{ cursor: 'pointer', accentColor: '#6366f1' }}
        />
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: config.enabled ? 'var(--text, #e2e8f0)' : 'var(--muted, #888)',
        }}>
          {stateLabels[stateId]}
        </span>
        {config.enabled && (
          <button
            onClick={() => onChange({ ...DEFAULT_STATE, enabled: true })}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--muted, #888)', fontSize: 8,
              padding: '1px 5px',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {config.enabled && (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Transform */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Scale</span>
              <input
                type="number" step={0.01} min={0} max={3}
                value={config.scale}
                onChange={e => onChange({ scale: +e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Rotate (deg)</span>
              <input
                type="number" step={1}
                value={config.rotate}
                onChange={e => onChange({ rotate: +e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Translate X (px)</span>
              <input
                type="number" step={1}
                value={config.translateX}
                onChange={e => onChange({ translateX: +e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Translate Y (px)</span>
              <input
                type="number" step={1}
                value={config.translateY}
                onChange={e => onChange({ translateY: +e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>

          {/* Opacity */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--muted, #888)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Opacity</span> <span>{Math.round(config.opacity * 100)}%</span>
            </span>
            <input
              type="range" min={0} max={1} step={0.01}
              value={config.opacity}
              onChange={e => onChange({ opacity: +e.target.value })}
              style={{ accentColor: '#6366f1' }}
            />
          </label>

          {/* Shadow */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Box Shadow</span>
            <input
              type="text"
              value={config.boxShadow}
              onChange={e => onChange({ boxShadow: e.target.value })}
              placeholder="0 4px 16px rgba(0,0,0,0.2)"
              style={inputStyle}
            />
          </label>

          {/* Filter */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Filter</span>
            <input
              type="text"
              value={config.filter}
              onChange={e => onChange({ filter: e.target.value })}
              placeholder="blur(4px) grayscale(1)"
              style={inputStyle}
            />
          </label>

          {/* Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Duration (ms)</span>
              <input
                type="number" step={50} min={0} max={2000}
                value={config.duration}
                onChange={e => onChange({ duration: +e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Easing</span>
              <select
                value={config.easing}
                onChange={e => onChange({ easing: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out',
                  'cubic-bezier(0.34,1.56,0.64,1)', 'steps(4,end)'].map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg, #131320)',
  border: '1px solid var(--border, #2d2d3d)',
  color: 'var(--text, #e2e8f0)', fontSize: 10,
  padding: '3px 6px', borderRadius: 4, outline: 'none',
};

// ── Main Component ─────────────────────────────────────────────────────────────

const STATE_IDS: StateId[] = ['hover', 'focus', 'active', 'disabled'];

export function MicroInteractionPanel({ open, onClose, selectedShape }: Props) {
  const [states, setStates] = useState<Record<StateId, StateConfig>>({
    hover: { ...DEFAULT_STATE },
    focus: { ...DEFAULT_STATE },
    active: { ...DEFAULT_STATE },
    disabled: { ...DEFAULT_STATE },
  });
  const [baseDuration, setBaseDuration] = useState(200);
  const [baseEasing, setBaseEasing] = useState('ease');
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const updateState = useCallback((stateId: StateId, patch: Partial<StateConfig>) => {
    setStates(prev => ({
      ...prev,
      [stateId]: { ...prev[stateId], ...patch },
    }));
  }, []);

  const applyPreset = useCallback((preset: MicroPreset) => {
    const next: Record<StateId, StateConfig> = {
      hover: { ...DEFAULT_STATE },
      focus: { ...DEFAULT_STATE },
      active: { ...DEFAULT_STATE },
      disabled: { ...DEFAULT_STATE },
    };
    for (const [stateId, config] of Object.entries(preset.states) as [StateId, Partial<StateConfig>][]) {
      next[stateId] = { ...DEFAULT_STATE, ...config };
    }
    setStates(next);
  }, []);

  const css = generateFullCSS(selectedShape?.name ?? 'element', { ...DEFAULT_STATE, duration: baseDuration, easing: baseEasing }, states);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(css).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [css]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      left: 60,
      width: 320,
      maxHeight: '88vh',
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
          <span style={{ fontSize: 14 }}>⚡</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>Micro-interactions</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ── Preview ── */}
        <MicroPreview
          shape={selectedShape}
          states={states}
          baseEasing={baseEasing}
          baseDuration={baseDuration}
        />

        {/* ── Quick presets ── */}
        <div style={{ padding: '0 12px 10px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 6, fontWeight: 600 }}>QUICK PRESETS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                style={{
                  padding: '5px 4px',
                  background: 'transparent',
                  border: '1px solid var(--border, #2d2d3d)',
                  borderRadius: 5, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #2d2d3d)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 14 }}>{preset.emoji}</span>
                <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Base transition ── */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #2d2d3d)' }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 6, fontWeight: 600 }}>BASE TRANSITION</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Duration (ms)</span>
              <input
                type="number" step={50} min={0} max={2000}
                value={baseDuration}
                onChange={e => setBaseDuration(+e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8, color: 'var(--muted, #888)' }}>Easing</span>
              <select
                value={baseEasing}
                onChange={e => setBaseEasing(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out',
                  'cubic-bezier(0.34,1.56,0.64,1)'].map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── State editors ── */}
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 8, fontWeight: 600 }}>STATES</div>
          {STATE_IDS.map(stateId => (
            <StateEditor
              key={stateId}
              stateId={stateId}
              config={states[stateId]}
              onChange={(patch) => updateState(stateId, patch)}
            />
          ))}
        </div>

        {/* ── CSS export ── */}
        <div style={{ padding: '0 12px 12px' }}>
          <button
            onClick={() => setShowCode(v => !v)}
            style={{
              width: '100%', height: 28,
              background: showCode ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: `1px solid ${showCode ? 'rgba(99,102,241,0.3)' : 'var(--border, #2d2d3d)'}`,
              borderRadius: 6, cursor: 'pointer',
              color: showCode ? '#818cf8' : 'var(--muted, #888)',
              fontSize: 10, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            {showCode ? '▼' : '▶'} CSS Export
          </button>

          {showCode && (
            <div style={{ marginTop: 8, position: 'relative' }}>
              <pre style={{
                background: 'var(--bg, #131320)',
                border: '1px solid var(--border, #2d2d3d)',
                borderRadius: 6, padding: '8px 10px',
                fontSize: 9, color: '#a5b4fc',
                fontFamily: 'monospace',
                overflow: 'auto', maxHeight: 200,
                margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {css}
              </pre>
              <button
                onClick={handleCopy}
                style={{
                  position: 'absolute', top: 6, right: 6,
                  background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)',
                  border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.3)'}`,
                  borderRadius: 4, cursor: 'pointer',
                  color: copied ? '#22c55e' : '#818cf8',
                  fontSize: 9, padding: '2px 8px',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
