import { useState, useEffect, useRef, useCallback } from 'react';
import { rgbToHex, parsePx } from '../../lib/tailwind-parser';
import { patchTailwindClass } from '../../lib/utils';
import type { ElementSelection } from '@shared/types';

interface Props {
  computedStyles: {
    color: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    letterSpacing: string;
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
  width: '100%',
  fontFamily: 'monospace',
  boxSizing: 'border-box',
};

export function TypographySection({ computedStyles: cs, selection, onPatch }: Props) {
  const currentHex = rgbToHex(cs.color);
  const currentSize = parsePx(cs.fontSize);
  const currentWeight = cs.fontWeight || '400';

  const [hexInput, setHexInput] = useState(currentHex);
  const [sizeInput, setSizeInput] = useState(String(Math.round(currentSize)));
  const hexFocused = useRef(false);
  const sizeFocused = useRef(false);

  useEffect(() => { if (!hexFocused.current) setHexInput(currentHex); }, [currentHex]);
  useEffect(() => { if (!sizeFocused.current) setSizeInput(String(Math.round(currentSize))); }, [currentSize]);

  const patch = useCallback((newClass: string) => {
    onPatch(selection, patchTailwindClass(selection.className, newClass));
  }, [selection, onPatch]);

  const patchColor = (raw: string) => {
    const v = raw.startsWith('#') ? raw : '#' + raw;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) patch(`text-[${v}]`);
  };

  const patchSize = (px: number) => {
    if (isNaN(px) || px < 1) return;
    patch(`text-[${Math.round(px)}px]`);
  };

  const patchWeight = (w: string) => {
    const map: Record<string, string> = {
      '100': 'font-thin', '200': 'font-extralight', '300': 'font-light',
      '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold',
      '700': 'font-bold', '800': 'font-extrabold', '900': 'font-black',
    };
    patch(map[w] ?? `font-[${w}]`);
  };

  const isValidHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <SectionHeader label="Typography" />
      <div className="py-3 px-3 flex flex-col gap-4">

        {/* Size + Weight */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 6 }}>SIZE (px)</div>
            <input
              type="number" value={sizeInput} min={1}
              onChange={(e) => {
                setSizeInput(e.target.value);
                patchSize(parseFloat(e.target.value));
              }}
              onFocus={() => { sizeFocused.current = true; }}
              onBlur={() => { sizeFocused.current = false; setSizeInput(String(Math.round(currentSize))); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              style={inputStyle}
            />
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 6 }}>WEIGHT</div>
            <select value={currentWeight} onChange={(e) => patchWeight(e.target.value)} style={inputStyle}>
              {[['100','Thin'],['200','ExtraLight'],['300','Light'],['400','Normal'],['500','Medium'],['600','SemiBold'],['700','Bold'],['800','ExtraBold'],['900','Black']].map(([w, label]) => (
                <option key={w} value={w}>{w} · {label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Color */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 6 }}>COLOR</div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={isValidHex(hexInput) ? hexInput : '#000000'}
              onChange={(e) => { setHexInput(e.target.value); patchColor(e.target.value); }}
              style={{ width: 34, height: 34, padding: 2, borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', flexShrink: 0 }}
            />
            <input
              type="text" value={hexInput}
              onChange={(e) => {
                setHexInput(e.target.value);
                const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
                if (isValidHex(v)) patchColor(v);
              }}
              onFocus={() => { hexFocused.current = true; }}
              onBlur={(e) => { hexFocused.current = false; patchColor(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter') patchColor((e.target as HTMLInputElement).value); }}
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
