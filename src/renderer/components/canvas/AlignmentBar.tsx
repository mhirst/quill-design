/**
 * AlignmentBar — appears above the canvas when 2+ shapes are selected.
 * Provides align (left/center-h/right/top/center-v/bottom) and
 * distribute (horizontal/vertical) actions.
 */
import type { Shape } from '../../lib/shapes';

type AlignAction =
  | 'align-left' | 'align-center-h' | 'align-right'
  | 'align-top'  | 'align-center-v' | 'align-bottom'
  | 'distribute-h' | 'distribute-v';

interface Props {
  shapes: Shape[];        // all shapes on canvas
  selectedIds: string[];  // currently selected ids
  onAlign: (patches: { id: string; x: number; y: number }[]) => void;
}

export function AlignmentBar({ shapes, selectedIds, onAlign }: Props) {
  if (selectedIds.length < 2) return null;

  const selected = shapes.filter(s => selectedIds.includes(s.id));

  const handleAlign = (action: AlignAction) => {
    const patches = computeAlign(selected, action);
    onAlign(patches);
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderTop: 'none',
      borderRadius: '0 0 8px 8px',
      padding: '3px 6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      backdropFilter: 'blur(8px)',
      userSelect: 'none',
    }}>
      {/* Align group */}
      <AlignBtn title="Align left edges" onClick={() => handleAlign('align-left')} icon={<AlignLeftIcon />} />
      <AlignBtn title="Align horizontal centers" onClick={() => handleAlign('align-center-h')} icon={<AlignCenterHIcon />} />
      <AlignBtn title="Align right edges" onClick={() => handleAlign('align-right')} icon={<AlignRightIcon />} />
      <Sep />
      <AlignBtn title="Align top edges" onClick={() => handleAlign('align-top')} icon={<AlignTopIcon />} />
      <AlignBtn title="Align vertical centers" onClick={() => handleAlign('align-center-v')} icon={<AlignCenterVIcon />} />
      <AlignBtn title="Align bottom edges" onClick={() => handleAlign('align-bottom')} icon={<AlignBottomIcon />} />
      <Sep />
      {/* Distribute — only useful with 3+ shapes */}
      <AlignBtn
        title="Distribute horizontally"
        onClick={() => handleAlign('distribute-h')}
        disabled={selectedIds.length < 3}
        icon={<DistributeHIcon />}
      />
      <AlignBtn
        title="Distribute vertically"
        onClick={() => handleAlign('distribute-v')}
        disabled={selectedIds.length < 3}
        icon={<DistributeVIcon />}
      />
    </div>
  );
}

// ── Alignment math ────────────────────────────────────────────────────────────

function computeAlign(
  shapes: Shape[],
  action: AlignAction
): { id: string; x: number; y: number }[] {
  if (shapes.length === 0) return [];

  const minX  = Math.min(...shapes.map(s => s.x));
  const minY  = Math.min(...shapes.map(s => s.y));
  const maxX  = Math.max(...shapes.map(s => s.x + s.width));
  const maxY  = Math.max(...shapes.map(s => s.y + s.height));
  const midX  = (minX + maxX) / 2;
  const midY  = (minY + maxY) / 2;

  switch (action) {
    case 'align-left':
      return shapes.map(s => ({ id: s.id, x: minX, y: s.y }));
    case 'align-center-h':
      return shapes.map(s => ({ id: s.id, x: midX - s.width / 2, y: s.y }));
    case 'align-right':
      return shapes.map(s => ({ id: s.id, x: maxX - s.width, y: s.y }));
    case 'align-top':
      return shapes.map(s => ({ id: s.id, x: s.x, y: minY }));
    case 'align-center-v':
      return shapes.map(s => ({ id: s.id, x: s.x, y: midY - s.height / 2 }));
    case 'align-bottom':
      return shapes.map(s => ({ id: s.id, x: s.x, y: maxY - s.height }));

    case 'distribute-h': {
      if (shapes.length < 3) return [];
      const sorted = [...shapes].sort((a, b) => a.x - b.x);
      const totalW = sorted.reduce((acc, s) => acc + s.width, 0);
      const gap = (maxX - minX - totalW) / (sorted.length - 1);
      let cursor = minX;
      return sorted.map(s => {
        const x = cursor;
        cursor += s.width + gap;
        return { id: s.id, x, y: s.y };
      });
    }
    case 'distribute-v': {
      if (shapes.length < 3) return [];
      const sorted = [...shapes].sort((a, b) => a.y - b.y);
      const totalH = sorted.reduce((acc, s) => acc + s.height, 0);
      const gap = (maxY - minY - totalH) / (sorted.length - 1);
      let cursor = minY;
      return sorted.map(s => {
        const y = cursor;
        cursor += s.height + gap;
        return { id: s.id, x: s.x, y };
      });
    }
    default:
      return [];
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AlignBtn({ title, onClick, icon, disabled }: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      style={{
        background: 'none', border: 'none',
        color: disabled ? 'var(--subtle)' : 'var(--muted)',
        cursor: disabled ? 'default' : 'pointer',
        width: 26, height: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, padding: 0,
        transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--panel-alt)';
          e.currentTarget.style.color = 'var(--text)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none';
        e.currentTarget.style.color = disabled ? 'var(--subtle)' : 'var(--muted)';
      }}
    >
      {icon}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 3px', flexShrink: 0 }} />;
}

// ── SVG Icons (16×16, stroke-based) ──────────────────────────────────────────

const S = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function AlignLeftIcon() {
  return <svg {...S}><line x1="2" y1="2" x2="2" y2="14"/><rect x="4" y="4" width="5" height="3" rx="0.5"/><rect x="4" y="9" width="8" height="3" rx="0.5"/></svg>;
}
function AlignCenterHIcon() {
  return <svg {...S}><line x1="8" y1="2" x2="8" y2="14"/><rect x="4" y="4" width="8" height="3" rx="0.5"/><rect x="5.5" y="9" width="5" height="3" rx="0.5"/></svg>;
}
function AlignRightIcon() {
  return <svg {...S}><line x1="14" y1="2" x2="14" y2="14"/><rect x="7" y="4" width="5" height="3" rx="0.5"/><rect x="4" y="9" width="8" height="3" rx="0.5"/></svg>;
}
function AlignTopIcon() {
  return <svg {...S}><line x1="2" y1="2" x2="14" y2="2"/><rect x="4" y="4" width="3" height="5" rx="0.5"/><rect x="9" y="4" width="3" height="8" rx="0.5"/></svg>;
}
function AlignCenterVIcon() {
  return <svg {...S}><line x1="2" y1="8" x2="14" y2="8"/><rect x="4" y="4" width="3" height="8" rx="0.5"/><rect x="9" y="5.5" width="3" height="5" rx="0.5"/></svg>;
}
function AlignBottomIcon() {
  return <svg {...S}><line x1="2" y1="14" x2="14" y2="14"/><rect x="4" y="7" width="3" height="5" rx="0.5"/><rect x="9" y="4" width="3" height="8" rx="0.5"/></svg>;
}
function DistributeHIcon() {
  return <svg {...S}><line x1="2" y1="3" x2="2" y2="13"/><line x1="14" y1="3" x2="14" y2="13"/><rect x="5" y="5" width="6" height="6" rx="0.5"/></svg>;
}
function DistributeVIcon() {
  return <svg {...S}><line x1="3" y1="2" x2="13" y2="2"/><line x1="3" y1="14" x2="13" y2="14"/><rect x="5" y="5" width="6" height="6" rx="0.5"/></svg>;
}
