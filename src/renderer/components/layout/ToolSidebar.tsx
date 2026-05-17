import { useState, useRef, useEffect } from 'react';
import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  Type,
  Layout,
  Pen,
  MoreHorizontal,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  Sun,
  Moon,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type Tool = 'cursor' | 'select' | 'pan' | 'frame' | 'rectangle' | 'ellipse' | 'text' | 'pen';
// LeftPanel is now managed in App.tsx directly as a tab within the left panel
export type LeftPanel = 'layers' | 'pages' | 'history' | null;

// ── Theme management ─────────────────────────────────────────────────────────
function getInitialTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem('quill-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try { localStorage.setItem('quill-theme', theme); } catch { /* ignore */ }
}

// Apply on module load (before first render) to avoid flash
applyTheme(getInitialTheme());

interface Props {
  activeTool: Tool;
  hasContent: boolean;
  onToolChange: (tool: Tool) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  leftPanelCollapsed?: boolean;
  onToggleLeftPanel?: () => void;
}

export function ToolSidebar({
  activeTool,
  hasContent,
  onToolChange,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  leftPanelCollapsed,
  onToggleLeftPanel,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      style={{
        width: 44,
        background: 'var(--panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 6,
        paddingBottom: 8,
        flexShrink: 0,
        height: '100%',
      }}
    >
      {/* ── Panel toggle ── */}
      {onToggleLeftPanel && (
        <>
          <div style={{ width: '100%', padding: '0 4px', marginBottom: 2 }}>
            <ToolBtn
              icon={leftPanelCollapsed
                ? <PanelLeftOpen size={16} />
                : <PanelLeftClose size={16} />}
              title={leftPanelCollapsed ? 'Show layers panel (⌘\\)' : 'Hide layers panel (⌘\\)'}
              active={!leftPanelCollapsed}
              onClick={onToggleLeftPanel}
            />
          </div>
          <Divider />
        </>
      )}

      {/* ── Drawing tools ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', padding: '0 4px' }}>
        <ToolBtn icon={<MousePointer2 size={17} />} title="Cursor (V)" active={activeTool === 'cursor'} onClick={() => onToolChange('cursor')} />
        <ToolBtn icon={<Hand size={17} />} title="Pan (H)" active={activeTool === 'pan'} onClick={() => onToolChange('pan')} />
      </div>

      <Divider />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', padding: '0 4px' }}>
        <ToolBtn icon={<Layout size={17} />} title="Frame (F)" active={activeTool === 'frame'} onClick={() => onToolChange('frame')} />
        <ToolBtn icon={<Square size={17} />} title="Rectangle (R)" active={activeTool === 'rectangle'} onClick={() => onToolChange('rectangle')} />
        <ToolBtn icon={<Circle size={17} />} title="Ellipse (O)" active={activeTool === 'ellipse'} onClick={() => onToolChange('ellipse')} />
        <ToolBtn icon={<Type size={17} />} title="Text (T)" active={activeTool === 'text'} onClick={() => onToolChange('text')} />
        <ToolBtn icon={<Pen size={17} />} title="Pen (P)" active={activeTool === 'pen'} onClick={() => onToolChange('pen')} />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── Theme toggle ── */}
      <div style={{ width: '100%', padding: '0 4px', marginBottom: 2 }}>
        <ToolBtn
          icon={theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        />
      </div>

      {/* ── File menu ── */}
      <div ref={menuRef} style={{ position: 'relative', width: '100%', padding: '0 4px' }}>
        {menuOpen && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 4,
            marginBottom: 6,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '4px 0',
            minWidth: 160,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 100,
          }}>
            <MenuItem icon={<FilePlus size={14} />} label="New design" shortcut="—" onClick={() => { onNew(); setMenuOpen(false); }} />
            <MenuItem icon={<FolderOpen size={14} />} label="Open file…" shortcut="—" onClick={() => { onOpen(); setMenuOpen(false); }} />
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <MenuItem icon={<Save size={14} />} label="Save" shortcut="⌘S" onClick={() => { onSave(); setMenuOpen(false); }} disabled={!hasContent} />
            <MenuItem icon={<SaveAll size={14} />} label="Save as…" shortcut="⌘⇧S" onClick={() => { onSaveAs(); setMenuOpen(false); }} disabled={!hasContent} />
          </div>
        )}
        <ToolBtn
          icon={<MoreHorizontal size={17} />}
          title="File menu"
          active={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        />
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: '80%', height: 1, background: 'var(--border)', margin: '6px 0', flexShrink: 0 }} />;
}

function ToolBtn({ icon, title, active, onClick, disabled }: {
  icon: React.ReactNode; title: string; active?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(!active && !disabled && 'hover:bg-white/5')}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        transition: 'all 0.1s',
        flexShrink: 0,
      }}
    >{icon}</button>
  );
}

function MenuItem({ icon, label, shortcut, onClick, disabled }: {
  icon: React.ReactNode; label: string; shortcut: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 12px',
        background: 'none',
        border: 'none',
        color: disabled ? 'var(--muted)' : 'var(--text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        textAlign: 'left',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{shortcut}</span>
    </button>
  );
}
