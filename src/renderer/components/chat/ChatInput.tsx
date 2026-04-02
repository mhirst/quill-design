import { useRef, useState, type KeyboardEvent } from 'react';
import { Send, Square, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ElementSelection } from '@shared/types';

interface Props {
  isStreaming: boolean;
  selection: ElementSelection | null;
  onSend: (text: string) => void;
  onAbort: () => void;
  onClearSelection: () => void;
}

export function ChatInput({ isStreaming, selection, onSend, onAbort, onClearSelection }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  return (
    <div className="flex flex-col gap-2 p-3 border-t border-slate-700/60 bg-slate-900">
      {/* Selection badge */}
      {selection && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-950/60 border border-indigo-700/50 rounded-lg text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
          <span className="text-indigo-300 font-medium">Editing:</span>
          <code className="text-indigo-200 font-mono truncate flex-1">{selection.descriptor}</code>
          <button
            onClick={onClearSelection}
            className="text-slate-400 hover:text-slate-200 transition-colors ml-1 flex-shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={
            selection
              ? `Describe changes to ${selection.descriptor}…`
              : 'Describe a UI component to generate…'
          }
          rows={1}
          disabled={false}
          className={cn(
            'flex-1 resize-none rounded-xl px-4 py-3 text-sm',
            'bg-slate-800 text-slate-100 placeholder-slate-500',
            'border border-slate-700 focus:border-indigo-500 focus:outline-none',
            'transition-colors leading-relaxed min-h-[44px] max-h-[160px] overflow-y-auto'
          )}
        />
        <button
          onClick={isStreaming ? onAbort : handleSend}
          disabled={!isStreaming && !value.trim()}
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all',
            isStreaming
              ? 'bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30'
              : value.trim()
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/40'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
          )}
        >
          {isStreaming ? <Square size={16} /> : <Send size={16} />}
        </button>
      </div>
      <p className="text-xs text-slate-600 px-1">Enter to send · Shift+Enter for newline</p>
    </div>
  );
}
