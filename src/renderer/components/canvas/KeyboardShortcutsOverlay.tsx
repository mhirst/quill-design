/**
 * KeyboardShortcutsOverlay
 * Press '?' to open. Shows all keyboard shortcuts in a modal.
 */
import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SECTIONS: { title: string; shortcuts: [string, string][] }[] = [
  {
    title: 'Tools',
    shortcuts: [
      ['V', 'Cursor / Select'],
      ['H', 'Pan'],
      ['F', 'Frame'],
      ['R', 'Rectangle'],
      ['O', 'Ellipse'],
      ['T', 'Text'],
      ['P', 'Pen'],
      ['I', 'Quick Insert (UI elements)'],
      ['⇧I', 'Icon Picker (Lucide icons)'],
      ['⇧U', 'Device Frames'],
      ['Esc', 'Cancel / Deselect'],
    ],
  },
  {
    title: 'Canvas',
    shortcuts: [
      ['= / +', 'Zoom in'],
      ['−', 'Zoom out'],
      ['0', 'Reset zoom (100%)'],
      ['1', 'Zoom to fit all'],
      ['⇧2', 'Zoom to selection'],
      ['G', 'Toggle grid snap (8px)'],
      ['⇧G', 'Toggle pixel grid overlay'],
      ['⇧B', 'Toggle baseline grid overlay'],
      ['⇧C', 'Toggle column grid overlay'],
      ['⇧R', 'Toggle rulers'],
      ['Space + drag', 'Pan canvas'],
      ['Scroll', 'Zoom in / out'],
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      ['⌘A', 'Select all'],
      ['⌘D', 'Duplicate'],
      ['⌘C / ⌘V', 'Copy / Paste'],
      ['⌘⇧V', 'Paste in place'],
      ['⌘⌥C / ⌘⌥V', 'Copy / Paste style'],
      ['Delete / ⌫', 'Delete'],
      ['Shift + click', 'Multi-select'],
      ['⌘] / ⌘[', 'Front / Back'],
    ],
  },
  {
    title: 'Layers',
    shortcuts: [
      ['⇧H', 'Toggle hide layer'],
      ['L', 'Toggle lock layer'],
      ['⌘G / ⌘⇧G', 'Group / Ungroup'],
      ['⌘⌥G', 'Wrap selection in Frame'],
      ['Arrow keys', 'Nudge 1px'],
      ['Shift + arrows', 'Nudge 10px'],
      ['1–9', 'Set opacity 10%–90%'],
      ['0', 'Set opacity 100%'],
      ['⌘Z / ⌘⇧Z', 'Undo / Redo'],
      ['Double-click', 'Edit text / rename'],
      ['Enter', 'Commit pen path'],
    ],
  },
  {
    title: 'View',
    shortcuts: [
      ['⌘K', 'Command palette'],
      ['⌘⇧N', 'Comment mode (place pin)'],
      ['F5', 'Presentation mode'],
      ['⌘⇧W', 'Wireframe / outline view'],
      ['⇧F', 'Focus mode (dim others)'],
      ['M', 'Toggle minimap'],
      ['⌘⇧D', 'Design system & tokens'],
      ['⌘⇧R', 'Find & replace colors'],
      ['⌘⇧H', 'Find & replace text'],
      ['⌘⇧T', 'Typography scale'],
      ['⌘⇧Y', 'Color harmony generator'],
      ['⌘⇧P', 'Theme customizer'],
      ['⌘⇧E', 'Developer spec / handoff'],
      ['⌘⇧M', 'Canvas snapshots'],
      ['⌘⌥H', 'History browser'],
      ['⌘⇧B', 'Batch rename layers'],
      ['⌘⌥S', 'Frame sorter — reorder slides'],
      ['⌘⇧/', 'Code export — React / CSS / SVG'],
      ['⌘K → "tokens"', 'Design tokens panel'],
      ['⌘K → "variant"', 'Switch shape variant'],
      ['⌘K → "bento"', 'Generate Bento grid'],
      ['⌘K → "hero"', 'Generate hero section'],
      ['⇧K', 'Color palettes library'],
      ['⇧L', 'Design lint / issues'],
      ['⇧U', 'Device frames'],
      ['⌘F', 'Spotlight — search shapes'],
      ['⇧J', 'Place sticky note on canvas'],
      ['⌘⇧F', 'Import custom fonts'],
      ['Esc', 'Exit presentation / deselect'],
      ['?', 'Toggle this help'],
    ],
  },
];

export function KeyboardShortcutsOverlay({ open, onClose }: Props) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === '?') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '24px 28px 20px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        width: 560,
        maxWidth: 'calc(100vw - 48px)',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Keyboard Shortcuts
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Grid of sections */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {SECTIONS.map(section => (
            <div key={section.title}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8,
              }}>
                {section.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {section.shortcuts.map(([key, desc]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>{desc}</span>
                    <Kbd>{key}</Kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--subtle)', textAlign: 'center',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div>Hold <Kbd>Shift</Kbd> while drawing to constrain proportions</div>
          <div>Right-click any shape for the context menu · Double-click canvas to fit view</div>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
      color: 'var(--text)',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid var(--border)',
      borderRadius: 4,
      padding: '1px 5px',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {children}
    </span>
  );
}
