import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Sparkles, Send, Square, ChevronDown, X } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { cn } from '../../lib/utils';
import { usePromptHistory } from '../../hooks/usePromptHistory';
import type { ChatMessage as ChatMessageType, ElementSelection } from '@shared/types';

const EXPANDED_HEIGHT = 340;
const COLLAPSED_HEIGHT = 52;

const SUGGESTIONS = [
  'A pricing card with 3 tiers',
  'A login form with email & password',
  'A dashboard stat card',
  'A hero section with a CTA button',
  'A navigation bar with logo and links',
  'A product card with image and price',
];

interface Props {
  messages: ChatMessageType[];
  isStreaming: boolean;
  streamingContent: string;
  selection: ElementSelection | null;
  selectedShape?: { type: string; name: string; iframeJsx?: string } | null;
  onSend: (text: string) => void;
  onAbort: () => void;
  onClearSelection: () => void;
  /** Increments each time the canvas is clicked — ChatBar collapses when this fires (unless streaming) */
  collapseSignal?: number;
}

export function ChatBar({
  messages,
  isStreaming,
  streamingContent,
  selection,
  selectedShape,
  onSend,
  onAbort,
  onClearSelection,
  collapseSignal,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRowRef = useRef<HTMLDivElement>(null);

  // Prompt history navigation
  const promptHistory = usePromptHistory();
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 = not navigating

  // Auto-collapse when canvas is clicked (unless streaming)
  useEffect(() => {
    if (collapseSignal && collapseSignal > 0 && !isStreaming) {
      setExpanded(false);
      setHistoryIndex(-1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseSignal]);

  // Auto-expand when streaming starts
  useEffect(() => {
    if (isStreaming) setExpanded(true);
  }, [isStreaming]);

  // Auto-scroll messages
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, expanded]);

  // Focus textarea when expanding
  useEffect(() => {
    if (expanded) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [expanded]);

  const handleSend = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    promptHistory.push(text);
    setHistoryIndex(-1);
    onSend(text);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    if (e.key === 'Escape') {
      setExpanded(false);
      setHistoryIndex(-1);
      return;
    }

    // Prompt history navigation — only when cursor is at the start/end of input
    if (e.key === 'ArrowUp' && !isStreaming) {
      const history = promptHistory.getAll();
      if (history.length === 0) return;
      e.preventDefault();
      const next = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      setValue(history[next]);
      // Move cursor to end after state update
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) { el.selectionStart = el.selectionEnd = el.value.length; }
      }, 0);
      return;
    }

    if (e.key === 'ArrowDown' && !isStreaming && historyIndex >= 0) {
      e.preventDefault();
      const history = promptHistory.getAll();
      const next = historyIndex - 1;
      if (next < 0) {
        setHistoryIndex(-1);
        setValue('');
      } else {
        setHistoryIndex(next);
        setValue(history[next]);
      }
      return;
    }

    // If user edits while navigating history, exit history mode
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      setHistoryIndex(-1);
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // Collapsed bar snippet — show status only when actively streaming, otherwise just the prompt hint
  const snippetText = isStreaming ? 'Generating…' : '';

  const showSuggestions = expanded && value === '' && messages.length === 0;

  return (
    <div
      className="flex flex-col flex-shrink-0 transition-all duration-200"
      style={{
        height: expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
        background: 'var(--panel)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* ── Expanded: message history ── */}
      {expanded && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Sparkles size={18} style={{ color: 'var(--muted)' }} />
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                Describe a component to generate it
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            const isStreamingThis = isLast && msg.role === 'assistant' && isStreaming;
            return (
              <ChatMessage
                key={msg.id}
                message={msg}
                isStreaming={isStreamingThis}
                streamingContent={isStreamingThis ? streamingContent : undefined}
              />
            );
          })}

          {/* Streaming placeholder before first assistant reply */}
          {isStreaming && streamingContent && messages[messages.length - 1]?.role === 'user' && (
            <ChatMessage
              message={{ id: 'streaming', role: 'assistant', content: streamingContent, timestamp: Date.now() }}
              isStreaming
              streamingContent={streamingContent}
            />
          )}
        </div>
      )}

      {/* ── Suggestion chips (above input, when empty and expanded) ── */}
      {showSuggestions && (
        <div
          className="flex flex-wrap gap-1.5 px-3 pb-2 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setValue(s);
                setHistoryIndex(-1);
                setTimeout(() => textareaRef.current?.focus(), 0);
              }}
              style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--panel-alt)',
                color: 'var(--muted)',
                cursor: 'pointer',
                transition: 'color 0.1s, border-color 0.1s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--muted)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input row (always visible) ── */}
      <div
        ref={inputRowRef}
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{
          height: COLLAPSED_HEIGHT,
          borderTop: expanded && !showSuggestions ? '1px solid var(--border)' : 'none',
        }}
      >
        {/* Sparkle icon */}
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer"
          style={{ color: 'var(--accent)' }}
          onClick={() => setExpanded((v) => !v)}
        >
          <Sparkles size={14} />
        </div>

        {/* Frame context badge */}
        {selectedShape?.type === 'frame' && !selection && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md flex-shrink-0 text-sm"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-dim)' }}
          >
            <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 11 }}>
              ⬜ {selectedShape.name}
            </span>
          </div>
        )}

        {/* Selection badge */}
        {selection && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md flex-shrink-0 text-sm"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-dim)' }}
          >
            <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>
              {selection.descriptor}
            </span>
            <button
              onClick={onClearSelection}
              style={{ color: 'var(--muted)' }}
              className="hover:text-white transition-colors"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {/* Input / snippet */}
        <div
          className="flex-1 relative cursor-text"
          onClick={() => { if (!expanded) setExpanded(true); textareaRef.current?.focus(); }}
        >
          {expanded ? (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              rows={1}
              placeholder={
                historyIndex >= 0 ? 'Browsing history — ↑↓ to navigate, Enter to send' :
                selection ? `Edit ${selection.descriptor}…` :
                selectedShape?.type === 'frame' ? `Design inside "${selectedShape.name}"…` :
                'Describe a component… (↑ for history)'
              }
              className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed"
              style={{
                color: 'var(--text)',
                minHeight: 20,
                maxHeight: 120,
                caretColor: 'var(--accent)',
              }}
            />
          ) : (
            <span
              className="text-sm truncate block"
              style={{ color: snippetText ? 'var(--accent)' : 'var(--subtle)' }}
            >
              {snippetText ||
               (selectedShape?.type === 'frame' ? `Ask AI to design inside "${selectedShape.name}"…` :
               messages.length > 0 ? 'Continue conversation… (click to open)' :
               'Ask AI to design something… (click to open)')}
            </span>
          )}
        </div>

        {/* Collapse button (only when expanded) */}
        {expanded && (
          <button
            onClick={() => { setExpanded(false); setHistoryIndex(-1); }}
            className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            title="Collapse chat (Esc)"
            aria-label="Collapse chat"
          >
            <ChevronDown size={14} />
          </button>
        )}

        {/* Send / abort */}
        <button
          onClick={isStreaming ? onAbort : handleSend}
          disabled={!isStreaming && !value.trim() && !expanded}
          className={cn(
            'flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all',
          )}
          style={
            isStreaming
              ? { background: 'color-mix(in srgb, var(--error) 8%, transparent)', color: 'var(--error)', border: '1px solid color-mix(in srgb, var(--error) 20%, transparent)' }
              : value.trim()
              ? { background: 'var(--accent)', color: '#fff' }
              : { color: 'var(--subtle)' }
          }
          title={isStreaming ? 'Stop' : 'Send'}
        >
          {isStreaming ? <Square size={12} /> : <Send size={12} />}
        </button>
      </div>
    </div>
  );
}
