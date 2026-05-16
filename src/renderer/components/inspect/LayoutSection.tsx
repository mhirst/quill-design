import { useCallback } from 'react';
import { patchTailwindClass } from '../../lib/utils';
import type { ElementSelection } from '@shared/types';

interface Props {
  computedStyles: {
    display: string;
    flexDirection: string;
    justifyContent: string;
    alignItems: string;
    gap: string;
    width: string;
    height: string;
  };
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

const selectStyle: React.CSSProperties = {
  fontSize: 14,
  background: 'var(--input-bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '5px 8px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  width: 72,
  fontFamily: 'monospace',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span style={{ color: 'var(--muted)', fontSize: 13, minWidth: 80, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function LayoutSection({ computedStyles: cs, selection, onPatch }: Props) {
  const isFlex = cs.display === 'flex';
  const isGrid = cs.display === 'grid';
  const gapPx = cs.gap === 'normal' ? 0 : parseInt(cs.gap) || 0;

  const patch = useCallback((newClass: string) => {
    onPatch(selection, patchTailwindClass(selection.className, newClass));
  }, [selection, onPatch]);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <SectionHeader label="Layout" />
      <div className="py-1">

        {/* Display */}
        <Row label="display">
          <select
            value={cs.display === 'none' ? 'hidden' : (cs.display || 'block')}
            onChange={(e) => {
              const v = e.target.value;
              const cls = v === 'hidden' ? 'hidden' : v;
              patch(cls);
            }}
            style={selectStyle}
          >
            {['block','flex','grid','inline','inline-flex','inline-block','hidden'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </Row>

        {(isFlex || isGrid) && (
          <>
            <Row label="direction">
              <select
                value={cs.flexDirection || 'row'}
                onChange={(e) => {
                  const map: Record<string, string> = { row: 'flex-row', column: 'flex-col', 'row-reverse': 'flex-row-reverse', 'column-reverse': 'flex-col-reverse' };
                  patch(map[e.target.value] ?? 'flex-row');
                }}
                style={selectStyle}
              >
                <option value="row">row</option>
                <option value="column">column</option>
                <option value="row-reverse">row-reverse</option>
                <option value="column-reverse">col-reverse</option>
              </select>
            </Row>

            <Row label="justify">
              <select
                value={cs.justifyContent || 'flex-start'}
                onChange={(e) => {
                  const map: Record<string, string> = {
                    'flex-start': 'justify-start', 'center': 'justify-center',
                    'flex-end': 'justify-end', 'space-between': 'justify-between',
                    'space-around': 'justify-around', 'space-evenly': 'justify-evenly',
                  };
                  patch(map[e.target.value] ?? 'justify-start');
                }}
                style={selectStyle}
              >
                <option value="flex-start">start</option>
                <option value="center">center</option>
                <option value="flex-end">end</option>
                <option value="space-between">space-between</option>
                <option value="space-around">space-around</option>
                <option value="space-evenly">space-evenly</option>
              </select>
            </Row>

            <Row label="align">
              <select
                value={cs.alignItems || 'stretch'}
                onChange={(e) => {
                  const map: Record<string, string> = {
                    'flex-start': 'items-start', 'center': 'items-center',
                    'flex-end': 'items-end', 'stretch': 'items-stretch', 'baseline': 'items-baseline',
                  };
                  patch(map[e.target.value] ?? 'items-stretch');
                }}
                style={selectStyle}
              >
                <option value="flex-start">start</option>
                <option value="center">center</option>
                <option value="flex-end">end</option>
                <option value="stretch">stretch</option>
                <option value="baseline">baseline</option>
              </select>
            </Row>

            <Row label="gap (px)">
              <input
                type="number" value={gapPx} min={0}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 0;
                  patch(`gap-[${v}px]`);
                }}
                style={inputStyle}
              />
            </Row>
          </>
        )}
      </div>
    </div>
  );
}
