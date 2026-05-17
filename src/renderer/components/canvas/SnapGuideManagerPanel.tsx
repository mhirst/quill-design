/**
 * SnapGuideManagerPanel — Persistent ruler guide management
 *
 * Features:
 *  - Create named horizontal/vertical guides at exact positions
 *  - Lock/unlock individual guides (locked guides can't be dragged)
 *  - Toggle visibility per guide or all at once
 *  - Color-code guides (red, blue, green, yellow, purple, custom)
 *  - Generate grid guides from spacing system (e.g. 8pt grid, columns)
 *  - Column grid generator: gutter, margin, count → places vertical guides
 *  - Row grid generator: baseline rhythm → horizontal guides
 *  - Export/import guides as JSON
 *  - Clear all, clear unlocked, snap-to-guides toggle
 *  - Guide groups (named collections you can toggle together)
 */

import React, { useState, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GuideAxis = 'horizontal' | 'vertical';

export interface SnapGuide {
  id: string;
  axis: GuideAxis;
  position: number;   // px from top (H) or left (V)
  name: string;
  color: string;
  locked: boolean;
  visible: boolean;
  groupId: string | null;
}

export interface GuideGroup {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

// ── Utilities (exported for tests) ────────────────────────────────────────────

/** Generate a short guide ID */
export function guideId(): string {
  return 'g-' + Math.random().toString(36).slice(2, 8);
}

/** Create a new guide */
export function createGuide(
  axis: GuideAxis,
  position: number,
  name?: string,
  color = '#3b82f6',
  groupId: string | null = null
): SnapGuide {
  return {
    id: guideId(),
    axis,
    position,
    name: name ?? (axis === 'horizontal' ? `H ${Math.round(position)}` : `V ${Math.round(position)}`),
    color,
    locked: false,
    visible: true,
    groupId,
  };
}

/** Generate column-grid vertical guides */
export function generateColumnGuides(
  canvasWidth: number,
  columns: number,
  gutter: number,
  margin: number,
  color = '#ef4444',
  groupId: string | null = null
): SnapGuide[] {
  if (columns < 1) return [];
  const totalGutters = (columns - 1) * gutter;
  const usableWidth = canvasWidth - 2 * margin - totalGutters;
  const colWidth = usableWidth / columns;
  const guides: SnapGuide[] = [];

  for (let i = 0; i <= columns; i++) {
    const x = margin + i * (colWidth + gutter);
    if (i < columns) {
      // Left edge of column
      guides.push(createGuide('vertical', x, `Col ${i + 1} left`, color, groupId));
      // Right edge of column
      guides.push(createGuide('vertical', x + colWidth, `Col ${i + 1} right`, color, groupId));
    }
  }
  // Deduplicate positions (right edge of col N == left edge of col N+1)
  const seen = new Set<number>();
  return guides.filter(g => {
    const key = Math.round(g.position * 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Generate row/baseline grid horizontal guides */
export function generateBaselineGuides(
  canvasHeight: number,
  baselineHeight: number,
  offset = 0,
  color = '#10b981',
  groupId: string | null = null
): SnapGuide[] {
  if (baselineHeight < 1) return [];
  const guides: SnapGuide[] = [];
  let y = offset;
  let i = 0;
  while (y <= canvasHeight) {
    guides.push(createGuide('horizontal', y, `Row ${i + 1}`, color, groupId));
    y += baselineHeight;
    i++;
  }
  return guides;
}

/** Generate 8pt-grid guides (vertical only, every N px) */
export function generateSpacingGuides(
  canvasWidth: number,
  step: number,
  color = '#8b5cf6',
  groupId: string | null = null
): SnapGuide[] {
  if (step < 1) return [];
  const guides: SnapGuide[] = [];
  let x = step;
  while (x < canvasWidth) {
    guides.push(createGuide('vertical', x, `${x}px`, color, groupId));
    x += step;
  }
  return guides;
}

/** Toggle a guide's locked state */
export function toggleLock(guides: SnapGuide[], id: string): SnapGuide[] {
  return guides.map(g => g.id === id ? { ...g, locked: !g.locked } : g);
}

/** Toggle a guide's visibility */
export function toggleVisible(guides: SnapGuide[], id: string): SnapGuide[] {
  return guides.map(g => g.id === id ? { ...g, visible: !g.visible } : g);
}

/** Delete a guide (only if not locked) */
export function deleteGuide(guides: SnapGuide[], id: string): SnapGuide[] {
  return guides.filter(g => !(g.id === id && !g.locked));
}

/** Clear all unlocked guides */
export function clearUnlocked(guides: SnapGuide[]): SnapGuide[] {
  return guides.filter(g => g.locked);
}

/** Set visibility for all guides in a group */
export function setGroupVisible(guides: SnapGuide[], groupId: string, visible: boolean): SnapGuide[] {
  return guides.map(g => g.groupId === groupId ? { ...g, visible } : g);
}

/** Export guides as JSON */
export function exportGuidesJSON(guides: SnapGuide[], groups: GuideGroup[]): string {
  return JSON.stringify({ guides, groups }, null, 2);
}

/** Import guides from JSON string */
export function importGuidesJSON(json: string): { guides: SnapGuide[]; groups: GuideGroup[] } | null {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed.guides)) return null;
    return { guides: parsed.guides as SnapGuide[], groups: (parsed.groups ?? []) as GuideGroup[] };
  } catch {
    return null;
  }
}

/** Sort guides: horizontal first, then vertical; by position ascending */
export function sortGuides(guides: SnapGuide[]): SnapGuide[] {
  return [...guides].sort((a, b) => {
    if (a.axis !== b.axis) return a.axis === 'horizontal' ? -1 : 1;
    return a.position - b.position;
  });
}

/** Count guides by axis */
export function countByAxis(guides: SnapGuide[]): { horizontal: number; vertical: number } {
  let h = 0; let v = 0;
  for (const g of guides) { if (g.axis === 'horizontal') h++; else v++; }
  return { horizontal: h, vertical: v };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GUIDE_COLORS = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Green', value: '#10b981' },
  { label: 'Yellow', value: '#f59e0b' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Teal', value: '#06b6d4' },
];

const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 380,
  width: 400,
  maxHeight: 'calc(100vh - 80px)',
  background: '#1a0a0a',
  border: '1px solid #3a1a1a',
  borderRadius: 12,
  boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 600,
  fontFamily: 'system-ui, sans-serif',
  color: '#e8d5d5',
  overflow: 'hidden',
};

const HEADER: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid #3a1a1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
};

const SCROLL: React.CSSProperties = {
  overflowY: 'auto',
  flex: 1,
  padding: '12px 16px',
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  color: '#9a7a7a',
  textTransform: 'uppercase' as const,
  marginBottom: 8,
};

const BTN_SM: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #3a1a1a',
  background: '#2a1010',
  color: '#e8d5d5',
  fontSize: 12,
  cursor: 'pointer',
};

const BTN_ACCENT: React.CSSProperties = {
  ...BTN_SM,
  background: '#b5533c',
  border: '1px solid #c4644d',
  color: '#fff',
};

const INPUT: React.CSSProperties = {
  padding: '4px 8px',
  background: '#2a1010',
  border: '1px solid #3a1a1a',
  borderRadius: 6,
  color: '#e8d5d5',
  fontSize: 12,
  minWidth: 0,
};

// ── Guide Row ─────────────────────────────────────────────────────────────────

function GuideRow({
  guide,
  onToggleLock,
  onToggleVisible,
  onDelete,
  onPositionChange,
  onNameChange,
}: {
  guide: SnapGuide;
  onToggleLock: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onPositionChange: (id: string, pos: number) => void;
  onNameChange: (id: string, name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(guide.name);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 8px',
      borderRadius: 6,
      background: '#0d0505',
      border: '1px solid #2a1a1a',
      marginBottom: 4,
      opacity: guide.visible ? 1 : 0.5,
    }}>
      {/* Color bar + axis indicator */}
      <div style={{
        width: 3,
        alignSelf: 'stretch',
        borderRadius: 2,
        background: guide.color,
        flexShrink: 0,
      }} />
      <div style={{
        fontSize: 9,
        color: guide.color,
        fontWeight: 700,
        width: 12,
        flexShrink: 0,
      }}>
        {guide.axis === 'horizontal' ? 'H' : 'V'}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingName ? (
          <input
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={() => { onNameChange(guide.id, nameVal); setEditingName(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onNameChange(guide.id, nameVal); setEditingName(false); } if (e.key === 'Escape') { setNameVal(guide.name); setEditingName(false); } }}
            autoFocus
            style={{ ...INPUT, width: '100%', fontSize: 11 }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditingName(true)}
            style={{ fontSize: 12, color: '#e8d5d5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
            title="Double-click to rename"
          >
            {guide.name}
          </div>
        )}
      </div>

      {/* Position */}
      <input
        type="number"
        value={Math.round(guide.position)}
        onChange={e => onPositionChange(guide.id, Number(e.target.value))}
        disabled={guide.locked}
        style={{
          ...INPUT,
          width: 52,
          textAlign: 'right' as const,
          fontSize: 11,
          opacity: guide.locked ? 0.5 : 1,
        }}
      />
      <span style={{ fontSize: 10, color: '#9a7a7a' }}>px</span>

      {/* Controls */}
      <button
        onClick={() => onToggleVisible(guide.id)}
        title={guide.visible ? 'Hide' : 'Show'}
        style={{ ...BTN_SM, padding: '3px 6px', fontSize: 11, opacity: guide.visible ? 1 : 0.5 }}
      >
        {guide.visible ? '●' : '○'}
      </button>
      <button
        onClick={() => onToggleLock(guide.id)}
        title={guide.locked ? 'Unlock' : 'Lock'}
        style={{ ...BTN_SM, padding: '3px 6px', fontSize: 11, color: guide.locked ? '#f59e0b' : '#e8d5d5' }}
      >
        {guide.locked ? '🔒' : '🔓'}
      </button>
      <button
        onClick={() => onDelete(guide.id)}
        disabled={guide.locked}
        title="Delete"
        style={{ ...BTN_SM, padding: '3px 6px', fontSize: 11, color: guide.locked ? '#5a3a3a' : '#ff6b6b', cursor: guide.locked ? 'not-allowed' : 'pointer' }}
      >
        ×
      </button>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  canvasWidth?: number;
  canvasHeight?: number;
  onGuidesChange?: (guides: SnapGuide[]) => void;
}

export function SnapGuideManagerPanel({ open, onClose, canvasWidth = 1440, canvasHeight = 900, onGuidesChange }: Props) {
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [groups, setGroups] = useState<GuideGroup[]>([]);
  const [newAxis, setNewAxis] = useState<GuideAxis>('vertical');
  const [newPos, setNewPos] = useState(100);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [tab, setTab] = useState<'guides' | 'generate' | 'groups'>('guides');

  // Generate tab state
  const [genType, setGenType] = useState<'columns' | 'baseline' | 'spacing'>('columns');
  const [colCount, setColCount] = useState(12);
  const [colGutter, setColGutter] = useState(24);
  const [colMargin, setColMargin] = useState(80);
  const [colColor, setColColor] = useState('#ef4444');
  const [baseHeight, setBaseHeight] = useState(8);
  const [baseOffset, setBaseOffset] = useState(0);
  const [baseColor, setBaseColor] = useState('#10b981');
  const [spacingStep, setSpacingStep] = useState(8);
  const [spacingColor, setSpacingColor] = useState('#8b5cf6');
  const [showAllGuides, setShowAllGuides] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const sorted = useMemo(() => sortGuides(guides), [guides]);
  const counts = useMemo(() => countByAxis(guides), [guides]);

  const updateGuides = (next: SnapGuide[]) => {
    setGuides(next);
    onGuidesChange?.(next);
  };

  const addGuide = () => {
    const g = createGuide(newAxis, newPos, newName || undefined, newColor);
    const next = [...guides, g];
    updateGuides(next);
    setNewName('');
    setNewPos(prev => prev + 8);
  };

  const handleGenerate = () => {
    const groupG: GuideGroup = {
      id: guideId(),
      name: genType === 'columns' ? `Columns ${colCount}` : genType === 'baseline' ? `Baseline ${baseHeight}px` : `Spacing ${spacingStep}px`,
      color: genType === 'columns' ? colColor : genType === 'baseline' ? baseColor : spacingColor,
      visible: true,
    };
    setGroups(prev => [...prev, groupG]);

    let newGuides: SnapGuide[] = [];
    if (genType === 'columns') {
      newGuides = generateColumnGuides(canvasWidth, colCount, colGutter, colMargin, colColor, groupG.id);
    } else if (genType === 'baseline') {
      newGuides = generateBaselineGuides(canvasHeight, baseHeight, baseOffset, baseColor, groupG.id);
    } else {
      newGuides = generateSpacingGuides(canvasWidth, spacingStep, spacingColor, groupG.id);
    }
    updateGuides([...guides, ...newGuides]);
  };

  const handleToggleAllVisible = () => {
    const next = guides.map(g => ({ ...g, visible: !showAllGuides }));
    setShowAllGuides(!showAllGuides);
    updateGuides(next);
  };

  const handleClearUnlocked = () => {
    updateGuides(clearUnlocked(guides));
  };

  const handleClearAll = () => {
    updateGuides([]);
    setGroups([]);
  };

  const handleExport = () => {
    const json = exportGuidesJSON(guides, groups);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleImport = () => {
    const json = prompt('Paste guide JSON:');
    if (!json) return;
    const result = importGuidesJSON(json);
    if (result) {
      setGuides(result.guides);
      setGroups(result.groups);
      onGuidesChange?.(result.guides);
    } else {
      alert('Invalid guide JSON');
    }
  };

  const handleToggleGroup = (groupId: string, visible: boolean) => {
    const next = setGroupVisible(guides, groupId, visible);
    updateGuides(next);
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, visible } : g));
  };

  const handleDeleteGroup = (groupId: string) => {
    updateGuides(guides.filter(g => g.groupId !== groupId));
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const hGuides = sorted.filter(g => g.axis === 'horizontal');
  const vGuides = sorted.filter(g => g.axis === 'vertical');

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={HEADER}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Snap Guides</div>
          <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 1 }}>
            {counts.horizontal}H · {counts.vertical}V · ⌘⌥⇧G
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleToggleAllVisible}
            style={{ ...BTN_SM, fontSize: 11 }}
            title={showAllGuides ? 'Hide all' : 'Show all'}
          >
            {showAllGuides ? 'Hide All' : 'Show All'}
          </button>
          <button onClick={onClose} style={{ ...BTN_SM, padding: '4px 8px', fontSize: 14, lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3a1a1a', flexShrink: 0 }}>
        {(['guides', 'generate', 'groups'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #b5533c' : '2px solid transparent',
              color: tab === t ? '#b5533c' : '#9a7a7a',
              fontSize: 12,
              fontWeight: tab === t ? 700 : 400,
              cursor: 'pointer',
              textTransform: 'capitalize' as const,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={SCROLL}>
        {/* ── GUIDES TAB ── */}
        {tab === 'guides' && (
          <div>
            {/* Add guide */}
            <div style={{ marginBottom: 14 }}>
              <div style={SECTION_LABEL}>Add Guide</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 28px', gap: 6, marginBottom: 6 }}>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Name (optional)"
                  style={{ ...INPUT }}
                  onKeyDown={e => { if (e.key === 'Enter') addGuide(); }}
                />
                <input
                  type="number"
                  value={newPos}
                  onChange={e => setNewPos(Number(e.target.value))}
                  style={{ ...INPUT, textAlign: 'right' as const }}
                  onKeyDown={e => { if (e.key === 'Enter') addGuide(); }}
                />
                <select
                  value={newAxis}
                  onChange={e => setNewAxis(e.target.value as GuideAxis)}
                  style={{ ...INPUT, appearance: 'none' as const }}
                >
                  <option value="vertical">Vert</option>
                  <option value="horizontal">Horiz</option>
                </select>
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #3a1a1a', cursor: 'pointer', padding: 2 }}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 8 }}>
                {GUIDE_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    title={c.label}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: c.value,
                      border: newColor === c.value ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
              <button onClick={addGuide} style={{ ...BTN_ACCENT, width: '100%', textAlign: 'center' as const }}>
                + Add Guide
              </button>
            </div>

            {/* Guide list — vertical */}
            {vGuides.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={SECTION_LABEL}>Vertical ({vGuides.length})</div>
                {vGuides.map(g => (
                  <GuideRow
                    key={g.id}
                    guide={g}
                    onToggleLock={id => updateGuides(toggleLock(guides, id))}
                    onToggleVisible={id => updateGuides(toggleVisible(guides, id))}
                    onDelete={id => updateGuides(deleteGuide(guides, id))}
                    onPositionChange={(id, pos) => updateGuides(guides.map(gg => gg.id === id ? { ...gg, position: pos } : gg))}
                    onNameChange={(id, name) => updateGuides(guides.map(gg => gg.id === id ? { ...gg, name } : gg))}
                  />
                ))}
              </div>
            )}

            {/* Guide list — horizontal */}
            {hGuides.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={SECTION_LABEL}>Horizontal ({hGuides.length})</div>
                {hGuides.map(g => (
                  <GuideRow
                    key={g.id}
                    guide={g}
                    onToggleLock={id => updateGuides(toggleLock(guides, id))}
                    onToggleVisible={id => updateGuides(toggleVisible(guides, id))}
                    onDelete={id => updateGuides(deleteGuide(guides, id))}
                    onPositionChange={(id, pos) => updateGuides(guides.map(gg => gg.id === id ? { ...gg, position: pos } : gg))}
                    onNameChange={(id, name) => updateGuides(guides.map(gg => gg.id === id ? { ...gg, name } : gg))}
                  />
                ))}
              </div>
            )}

            {guides.length === 0 && (
              <div style={{ color: '#5a3a3a', fontSize: 13, textAlign: 'center' as const, padding: '20px 0' }}>
                No guides yet. Add one above or use the Generate tab.
              </div>
            )}

            {/* Footer actions */}
            {guides.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={handleClearUnlocked} style={{ ...BTN_SM, fontSize: 11, flex: 1 }}>Clear Unlocked</button>
                <button onClick={handleClearAll} style={{ ...BTN_SM, fontSize: 11, color: '#ff6b6b', flex: 1 }}>Clear All</button>
                <button onClick={handleExport} style={{ ...BTN_SM, fontSize: 11 }}>{copied ? '✓' : 'Export'}</button>
                <button onClick={handleImport} style={{ ...BTN_SM, fontSize: 11 }}>Import</button>
              </div>
            )}
          </div>
        )}

        {/* ── GENERATE TAB ── */}
        {tab === 'generate' && (
          <div>
            {/* Type selector */}
            <div style={{ marginBottom: 14 }}>
              <div style={SECTION_LABEL}>Generator Type</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['columns', 'baseline', 'spacing'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setGenType(t)}
                    style={{
                      ...BTN_SM,
                      flex: 1,
                      fontSize: 11,
                      ...(genType === t ? { background: '#b5533c', border: '1px solid #c4644d', color: '#fff' } : {}),
                    }}
                  >
                    {t === 'columns' ? 'Columns' : t === 'baseline' ? 'Baseline' : 'Spacing'}
                  </button>
                ))}
              </div>
            </div>

            {/* Column grid options */}
            {genType === 'columns' && (
              <div style={{ marginBottom: 14 }}>
                <div style={SECTION_LABEL}>Column Grid</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                    Columns
                    <input type="number" value={colCount} min={1} max={24} onChange={e => setColCount(Number(e.target.value))}
                      style={{ ...INPUT, display: 'block', width: '100%', marginTop: 3 }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                    Gutter (px)
                    <input type="number" value={colGutter} min={0} onChange={e => setColGutter(Number(e.target.value))}
                      style={{ ...INPUT, display: 'block', width: '100%', marginTop: 3 }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                    Margin (px)
                    <input type="number" value={colMargin} min={0} onChange={e => setColMargin(Number(e.target.value))}
                      style={{ ...INPUT, display: 'block', width: '100%', marginTop: 3 }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                    Color
                    <input type="color" value={colColor} onChange={e => setColColor(e.target.value)}
                      style={{ display: 'block', width: '100%', height: 26, borderRadius: 4, border: '1px solid #3a1a1a', marginTop: 3, cursor: 'pointer' }} />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 8 }}>
                  Canvas: {canvasWidth}px wide → {colCount} columns + {colCount - 1} gutters
                </div>
              </div>
            )}

            {/* Baseline grid options */}
            {genType === 'baseline' && (
              <div style={{ marginBottom: 14 }}>
                <div style={SECTION_LABEL}>Baseline Grid</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                    Row Height (px)
                    <input type="number" value={baseHeight} min={4} max={200} onChange={e => setBaseHeight(Number(e.target.value))}
                      style={{ ...INPUT, display: 'block', width: '100%', marginTop: 3 }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                    Offset (px)
                    <input type="number" value={baseOffset} min={0} onChange={e => setBaseOffset(Number(e.target.value))}
                      style={{ ...INPUT, display: 'block', width: '100%', marginTop: 3 }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                    Color
                    <input type="color" value={baseColor} onChange={e => setBaseColor(e.target.value)}
                      style={{ display: 'block', width: '100%', height: 26, borderRadius: 4, border: '1px solid #3a1a1a', marginTop: 3, cursor: 'pointer' }} />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 8 }}>
                  Will generate ~{Math.ceil(canvasHeight / baseHeight)} guides
                </div>
              </div>
            )}

            {/* Spacing guides options */}
            {genType === 'spacing' && (
              <div style={{ marginBottom: 14 }}>
                <div style={SECTION_LABEL}>Spacing Grid</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                    Step (px)
                    <input type="number" value={spacingStep} min={4} max={200} onChange={e => setSpacingStep(Number(e.target.value))}
                      style={{ ...INPUT, display: 'block', width: '100%', marginTop: 3 }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#9a7a7a' }}>
                    Color
                    <input type="color" value={spacingColor} onChange={e => setSpacingColor(e.target.value)}
                      style={{ display: 'block', width: '100%', height: 26, borderRadius: 4, border: '1px solid #3a1a1a', marginTop: 3, cursor: 'pointer' }} />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: '#9a7a7a', marginTop: 8 }}>
                  Will generate {Math.floor((canvasWidth - spacingStep) / spacingStep)} guides
                </div>
              </div>
            )}

            <button onClick={handleGenerate} style={{ ...BTN_ACCENT, width: '100%', textAlign: 'center' as const }}>
              Generate Guides
            </button>
          </div>
        )}

        {/* ── GROUPS TAB ── */}
        {tab === 'groups' && (
          <div>
            {groups.length === 0 ? (
              <div style={{ color: '#5a3a3a', fontSize: 13, textAlign: 'center' as const, padding: '20px 0' }}>
                No groups yet. Use Generate tab to create grouped guides.
              </div>
            ) : (
              groups.map(group => {
                const groupGuides = guides.filter(g => g.groupId === group.id);
                return (
                  <div
                    key={group.id}
                    style={{
                      background: '#0d0505',
                      border: '1px solid #2a1a1a',
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{group.name}</div>
                      <div style={{ fontSize: 11, color: '#9a7a7a' }}>{groupGuides.length} guides</div>
                      <button
                        onClick={() => handleToggleGroup(group.id, !group.visible)}
                        style={{ ...BTN_SM, fontSize: 11, padding: '2px 6px' }}
                      >
                        {group.visible ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        style={{ ...BTN_SM, fontSize: 11, padding: '2px 6px', color: '#ff6b6b' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
