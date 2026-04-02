import { FolderOpen, Save, FilePlus, SaveAll, MousePointer2, MousePointer } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  filePath: string | null;
  hasContent: boolean;
  selectionMode: boolean;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onNew: () => void;
  onToggleSelectionMode: () => void;
}

export function CanvasToolbar({
  filePath,
  hasContent,
  selectionMode,
  onOpen,
  onSave,
  onSaveAs,
  onNew,
  onToggleSelectionMode,
}: Props) {
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null;

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-700/60 bg-slate-900/80 flex-shrink-0">
      {/* File actions */}
      <ToolbarButton onClick={onNew} title="New design">
        <FilePlus size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={onOpen} title="Open .jsx file">
        <FolderOpen size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={onSave} title="Save" disabled={!hasContent}>
        <Save size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={onSaveAs} title="Save as…" disabled={!hasContent}>
        <SaveAll size={15} />
      </ToolbarButton>

      <div className="w-px h-5 bg-slate-700/60 mx-1" />

      {/* Selection mode toggle */}
      <ToolbarButton
        onClick={onToggleSelectionMode}
        title={selectionMode ? 'Disable selection mode' : 'Enable selection mode (click elements)'}
        active={selectionMode}
      >
        {selectionMode ? <MousePointer2 size={15} /> : <MousePointer size={15} />}
      </ToolbarButton>

      {/* File name indicator */}
      {fileName && (
        <span className="ml-2 text-xs text-slate-500 truncate max-w-[200px]" title={filePath ?? ''}>
          {fileName}
        </span>
      )}

      <div className="flex-1" />

      {selectionMode && (
        <span className="text-xs text-indigo-400 animate-pulse">Click an element to select</span>
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  title,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center transition-all text-slate-400',
        active
          ? 'bg-indigo-600/20 border border-indigo-600/50 text-indigo-400'
          : 'hover:bg-slate-800 hover:text-slate-200',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}
