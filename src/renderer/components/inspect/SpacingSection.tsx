import { useState, useEffect, useRef, useCallback } from 'react';
import { parseFourSides, parsePx } from '../../lib/tailwind-parser';
import { patchTailwindClass } from '../../lib/utils';
import type { ElementSelection } from '@shared/types';

interface Props {
  computedStyles: { padding: string; margin: string };
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

function SpacingInput({
  dir, value, onChange,
}: {
  dir: string; value: number; onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(String(value));
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.04em' }}>{dir}</span>
      <input
        type="number" value={local} min={0}
        onChange={(e) => {
          setLocal(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n) && n >= 0) onChange(n);
        }}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setLocal(String(value)); }}
        style={{
          width: '100%', fontSize: 14,
          background: 'var(--input-bg)', color: 'var(--text)',
          border: '1px solid var(--border)', borderRadius: 6,
          padding: '5px 4px', outline: 'none',
          textAlign: 'center', fontFamily: 'monospace', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function SpacingBox({
  label, prefix, values, selection, onPatch,
}: {
  label: string; prefix: 'p' | 'm';
  values: [string, string, string, string];
  selection: ElementSelection;
  onPatch: (selection: ElementSelection, newClasses: string) => void;
}) {
  const [top, right, bottom, left] = values.map(parsePx);

  const patch = useCallback((dir: 't' | 'r' | 'b' | 'l', px: number) => {
    const newClass = `${prefix}${dir}-[${Math.round(px)}px]`;
    onPatch(selection, patchTailwindClass(selection.className, newClass));
  }, [prefix, selection, onPatch]);

  return (
    <div className="px-3 py-3">
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div className="grid grid-cols-4 gap-2">
        <SpacingInput dir="T" value={top} onChange={(v) => patch('t', v)} />
        <SpacingInput dir="R" value={right} onChange={(v) => patch('r', v)} />
        <SpacingInput dir="B" value={bottom} onChange={(v) => patch('b', v)} />
        <SpacingInput dir="L" value={left} onChange={(v) => patch('l', v)} />
      </div>
    </div>
  );
}

export function SpacingSection({ computedStyles: cs, classes, selection, onPatch }: Props) {
  const padding = parseFourSides(cs.padding);
  const margin = parseFourSides(cs.margin);
  const hasMargin = margin.some((v) => parsePx(v) !== 0);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <SectionHeader label="Spacing" />
      <SpacingBox label="PADDING" prefix="p" values={padding} selection={selection} onPatch={onPatch} />
      {hasMargin && (
        <SpacingBox label="MARGIN" prefix="m" values={margin} selection={selection} onPatch={onPatch} />
      )}
    </div>
  );
}
