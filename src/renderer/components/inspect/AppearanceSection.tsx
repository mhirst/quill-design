import { useState, useEffect, useCallback, useRef } from 'react';
import { rgbToHex, parsePx } from '../../lib/tailwind-parser';
import { patchTailwindClass } from '../../lib/utils';
import type { ElementSelection } from '@shared/types';

interface Props {
  computedStyles: {
    backgroundColor: string;
    borderRadius: string;
    borderWidth: string;
    borderColor: string;
    opacity: string;
  };
  classes: string[];
  selection: ElementSelection;
  onPatch: (selection: ElementSelection, newClasses: string) => void;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="px-3 py-2 uppercase select-none"
      style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}
    >
      {label}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  background: 'var(--input-bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '5px 8px',
  outline: 'none',
  fontFamily: 'monospace',
  boxSizing: 'border-box',
};

// ── Slider with local drag state ────────────────────────────────────────────
function Slider({
  value, min, max, step = 1, onChange, onCommit,
}: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);

  return (
    <input
      type="range" min={min} max={max} step={step} value={local}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        setLocal(v);
        onChange(v);
      }}
      onMouseDown={() => { dragging.current = true; }}
      onMouseUp={(e) => {
        dragging.current = false;
        onCommit(parseFloat((e.target as HTMLInputElement).value));
      }}
      onTouchStart={() => { dragging.current = true; }}
      onTouchEnd={(e) => {
        dragging.current = false;
        onCommit(parseFloat((e.target as HTMLInputElement).value));
      }}
      style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
    />
  );
}

// ── Number input — fires live, doesn't fight you mid-type ──────────────────
function NumInput({
  value, min, max, width = 56, onCommit,
}: {
  value: number; min?: number; max?: number; width?: number;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(Math.round(value)));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(String(Math.round(value)));
  }, [value]);

  const clamp = (n: number) => {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  };

  return (
    <input
      type="number" value={local} min={min} max={max}
      onChange={(e) => {
        setLocal(e.target.value);
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) onCommit(clamp(n));
      }}
      onFocus={() => { focused.current = true; }}
      onBlur={(e) => {
        focused.current = false;
        let n = parseFloat(e.target.value);
        if (isNaN(n)) n = value;
        const clamped = clamp(n);
        onCommit(clamped);
        setLocal(String(Math.round(clamped)));
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={{ ...inputStyle, width }}
    />
  );
}

// ── Color picker + hex text ────────────────────────────────────────────────
function ColorInput({ label, value, onCommit }: { label: string; value: string; onCommit: (hex: string) => void }) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);

  const isValidHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

  const tryCommit = (raw: string) => {
    const v = raw.startsWith('#') ? raw : '#' + raw;
    if (isValidHex(v)) { setLocal(v); onCommit(v); }
    else setLocal(value);
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={isValidHex(local) ? local : '#ffffff'}
          onChange={(e) => { setLocal(e.target.value); onCommit(e.target.value); }}
          style={{ width: 34, height: 34, padding: 2, borderRadius: 6, flexShrink: 0, border: '1px solid var(--border)', background: 'none', cursor: 'pointer' }}
        />
        <input
          type="text" value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
            if (isValidHex(v)) onCommit(v);
          }}
          onFocus={() => { focused.current = true; }}
          onBlur={(e) => { focused.current = false; tryCommit(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') tryCommit((e.target as HTMLInputElement).value); }}
          style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
        />
      </div>
    </div>
  );
}

export function AppearanceSection({ computedStyles: cs, selection, onPatch }: Props) {
  const hasBg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
  const hasBorder = cs.borderWidth && cs.borderWidth !== '0px';

  const bgHex = hasBg ? rgbToHex(cs.backgroundColor) : '#ffffff';
  const borderHex = hasBorder ? rgbToHex(cs.borderColor) : '#000000';
  const radius = parsePx(cs.borderRadius);
  const opacity = cs.opacity ? parseFloat(cs.opacity) : 1;
  const opacityPct = Math.round(opacity * 100);

  const [radiusDisplay, setRadiusDisplay] = useState(radius);
  const [opacityDisplay, setOpacityDisplay] = useState(opacityPct);

  useEffect(() => setRadiusDisplay(radius), [radius]);
  useEffect(() => setOpacityDisplay(opacityPct), [opacityPct]);

  const patch = useCallback((newClass: string) => {
    onPatch(selection, patchTailwindClass(selection.className, newClass));
  }, [selection, onPatch]);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <SectionHeader label="Appearance" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 12px' }}>

        <ColorInput label="BACKGROUND" value={bgHex} onCommit={(hex) => patch(`bg-[${hex}]`)} />

        {hasBorder && (
          <ColorInput label="BORDER COLOR" value={borderHex} onCommit={(hex) => patch(`border-[${hex}]`)} />
        )}

        {/* Border radius */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>RADIUS</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text)', fontSize: 13 }}>{Math.round(radiusDisplay)}px</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Slider value={radius} min={0} max={64}
              onChange={setRadiusDisplay}
              onCommit={(v) => patch(`rounded-[${Math.round(v)}px]`)}
            />
            <NumInput value={radius} min={0} max={999} onCommit={(v) => patch(`rounded-[${Math.round(v)}px]`)} />
          </div>
        </div>

        {/* Opacity */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>OPACITY</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text)', fontSize: 13 }}>{Math.round(opacityDisplay)}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Slider value={opacityPct} min={0} max={100}
              onChange={setOpacityDisplay}
              onCommit={(v) => patch(`opacity-[${Math.round(v)}%]`)}
            />
            <NumInput value={opacityPct} min={0} max={100} onCommit={(v) => patch(`opacity-[${Math.round(v)}%]`)} />
          </div>
        </div>

      </div>
    </div>
  );
}
