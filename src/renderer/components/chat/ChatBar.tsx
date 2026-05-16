import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Sparkles, Send, Square, ChevronDown, X } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { cn, stripJsxBlock } from '../../lib/utils';
import type { ChatMessage as ChatMessageType, ElementSelection } from '@shared/types';

const EXPANDED_HEIGHT = 340;
const COLLAPSED_HEIGHT = 52;

interface Props {
  messages: ChatMessageType[];
  isStreaming: boolean;
  streamingContent: string;
  selection: ElementSelection | null;
  selectedShape?: { type: string; name: string; iframeJsx?: string } | null;
  onSend: (text: string) => void;
  onAbort: () => void;
  onClearSelection: () => void;
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
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRowRef = useRef<HTMLDivElement>(null);

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
    onSend(text);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') setExpanded(false);
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // Collapsed bar snippet — never show raw code
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const snippetText = isStreaming
    ? 'Generating component…'
    : (stripJsxBlock(lastAssistantMsg?.content ?? '').trim().slice(0, 80) || (lastAssistantMsg ? 'Component ready' : ''));

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
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <Sparkles size={18} style={{ color: 'var(--muted)' }} />
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                Describe a component to generate it
              </p>
              <div className="flex flex-col gap-1.5 w-full max-w-sm mt-1">
                {['A pricing card with 3 tiers', 'A login form', 'A dashboard stat card'].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => onSend(ex)}
                    className="text-left px-3 py-2 rounded-lg transition-colors text-sm"
                    style={{
                      background: 'var(--panel-alt)',
                      color: 'var(--muted)',
                      border: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    {ex}
                  </button>
                ))}
              </div>
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

      {/* ── Input row (always visible) ── */}
      <div
        ref={inputRowRef}
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{
          height: COLLAPSED_HEIGHT,
          borderTop: expanded ? '1px solid var(--border)' : 'none',
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
                selection ? `Edit ${selection.descriptor}…` :
                selectedShape?.type === 'frame' ? `Design inside "${selectedShape.name}"…` :
                'Design with Quill… (creates a new frame)'
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
              style={{ color: snippetText ? 'var(--muted)' : 'var(--subtle)' }}
            >
              {snippetText ? snippetText + (snippetText.length >= 80 ? '…' : '') :
               selectedShape?.type === 'frame' ? `Design inside "${selectedShape.name}"… (click to open)` :
               'Design with Quill… (click to open)'}
            </span>
          )}
        </div>

        {/* Collapse button (only when expanded) */}
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            title="Collapse chat"
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
