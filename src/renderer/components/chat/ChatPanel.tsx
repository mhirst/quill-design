import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { ChatMessage as ChatMessageType, ElementSelection } from '@shared/types';

interface Props {
  messages: ChatMessageType[];
  isStreaming: boolean;
  streamingContent: string;
  selection: ElementSelection | null;
  onSend: (text: string) => void;
  onAbort: () => void;
  onClearSelection: () => void;
}

export function ChatPanel({
  messages,
  isStreaming,
  streamingContent,
  selection,
  onSend,
  onAbort,
  onClearSelection,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingContent]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-700/60 bg-slate-900/80 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
          <Sparkles size={14} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-slate-100">Claude Design</h1>
          <p className="text-xs text-slate-500">AI-powered UI generator</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center">
              <Sparkles size={22} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">Start designing</p>
              <p className="text-xs text-slate-500 mt-1">
                Describe a UI component and Claude will generate it live in the canvas.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {[
                'A pricing card with 3 tiers',
                'A login form with email & password',
                'A dashboard stat card with an icon',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => onSend(example)}
                  className="text-xs text-left px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-indigo-600/40 transition-all"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLastAssistant =
            msg.role === 'assistant' && i === messages.length - 1 && isStreaming;
          return (
            <ChatMessage
              key={msg.id}
              message={msg}
              isStreaming={isLastAssistant}
              streamingContent={isLastAssistant ? streamingContent : undefined}
            />
          );
        })}

        {/* Streaming placeholder if no assistant message yet */}
        {isStreaming && streamingContent && messages[messages.length - 1]?.role === 'user' && (
          <ChatMessage
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
              timestamp: Date.now(),
            }}
            isStreaming={true}
            streamingContent={streamingContent}
          />
        )}
      </div>

      {/* Input */}
      <ChatInput
        isStreaming={isStreaming}
        selection={selection}
        onSend={onSend}
        onAbort={onAbort}
        onClearSelection={onClearSelection}
      />
    </div>
  );
}
