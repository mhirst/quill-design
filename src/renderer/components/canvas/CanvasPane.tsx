import { type RefObject } from 'react';
import { Layout } from 'lucide-react';
import { CanvasToolbar } from './CanvasToolbar';
import type { ElementSelection } from '@shared/types';

interface Props {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  dataUri: string;
  hasContent: boolean;
  filePath: string | null;
  selection: ElementSelection | null;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  onClearSelection: () => void;
  onIframeLoad: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onNew: () => void;
}

export function CanvasPane({
  iframeRef,
  dataUri,
  hasContent,
  filePath,
  selection,
  selectionMode,
  onToggleSelectionMode,
  onClearSelection,
  onIframeLoad,
  onOpen,
  onSave,
  onSaveAs,
  onNew,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <CanvasToolbar
        filePath={filePath}
        hasContent={hasContent}
        selectionMode={selectionMode}
        onOpen={onOpen}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onNew={onNew}
        onToggleSelectionMode={onToggleSelectionMode}
      />

      <div className="flex-1 relative overflow-hidden bg-slate-950">
        {/* Empty state */}
        {!hasContent && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
              <Layout size={24} className="text-slate-500" />
            </div>
            <p className="text-sm text-slate-500">Canvas is empty</p>
            <p className="text-xs text-slate-600 max-w-xs">
              Describe a UI in the chat panel and Claude will render it here.
            </p>
          </div>
        )}

        {/* Canvas iframe */}
        {hasContent && dataUri && (
          <iframe
            ref={iframeRef}
            src={dataUri}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="w-full h-full border-0 bg-white"
            title="Design Canvas"
            onLoad={onIframeLoad}
          />
        )}

        {/* Selection info bar */}
        {selection && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-2 bg-slate-900/90 backdrop-blur-sm border-t border-indigo-700/40 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            <span className="text-slate-400">Selected:</span>
            <code className="text-indigo-300 font-mono">{selection.descriptor}</code>
            <span className="text-slate-600">
              {Math.round(selection.rect.width)} × {Math.round(selection.rect.height)}px
            </span>
            <button
              onClick={onClearSelection}
              className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
            >
              Deselect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
