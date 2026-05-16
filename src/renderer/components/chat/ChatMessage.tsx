import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Check, LoaderCircle } from 'lucide-react';
import { stripJsxBlock } from '../../lib/utils';
import type { ChatMessage as ChatMessageType } from '@shared/types';

interface Props {
  message: ChatMessageType;
  isStreaming?: boolean;
  streamingContent?: string;
}

export function ChatMessage({ message, isStreaming, streamingContent }: Props) {
  const isUser = message.role === 'user';

  // ── User message ─────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] px-3 py-2 whitespace-pre-wrap"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '12px 12px 3px 12px',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  // ── Assistant message ─────────────────────────────────────────────────────
  // While streaming: ONLY show the task pill. No raw text ever.
  if (isStreaming) {
    return (
      <div className="flex gap-2 justify-start">
        <AssistantAvatar />
        <TaskPill done={false} />
      </div>
    );
  }

  // After streaming: show completed pill + explanation text (if any)
  const explanationText = stripJsxBlock(message.content).trim();
  const hadCode = /```(?:jsx?|tsx?)/.test(message.content);

  return (
    <div className="flex gap-2 justify-start">
      <AssistantAvatar />
      <div className="flex flex-col gap-1.5 max-w-[85%]">
        {hadCode && <TaskPill done={true} />}
        {explanationText && (
          <div
            className="px-3 py-2 rounded-xl leading-relaxed"
            style={{
              background: 'var(--panel-alt)',
              color: 'var(--text)',
              borderRadius: '3px 12px 12px 12px',
              fontSize: 13,
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ children, ...props }) {
                  return (
                    <code
                      className="rounded px-1 py-0.5 text-xs"
                      style={{ background: 'var(--input-bg)', color: 'var(--accent)' }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                pre({ children }) {
                  return <pre className="not-prose">{children}</pre>;
                },
                p({ children }) {
                  return <p style={{ margin: '0 0 4px' }}>{children}</p>;
                },
              }}
            >
              {explanationText}
            </ReactMarkdown>
          </div>
        )}
        {!hadCode && !explanationText && (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Done.</div>
        )}
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div
      className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5"
      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
    >
      <Sparkles size={12} />
    </div>
  );
}

function TaskPill({ done }: { done: boolean }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit"
      style={{
        fontSize: 13,
        background: 'var(--accent-dim)',
        border: `1px solid color-mix(in srgb, var(--accent) ${done ? 25 : 16}%, transparent)`,
      }}
    >
      {done ? (
        <Check size={11} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />
      ) : (
        <LoaderCircle size={11} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />
      )}
      <span style={{ color: done ? 'var(--text)' : 'var(--muted)' }}>
        {done ? 'Component ready' : 'Generating component…'}
      </span>
    </div>
  );
}
