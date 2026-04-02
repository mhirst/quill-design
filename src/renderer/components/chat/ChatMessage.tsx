import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';
import type { ChatMessage as ChatMessageType } from '@shared/types';

interface Props {
  message: ChatMessageType;
  isStreaming?: boolean;
  streamingContent?: string;
}

export function ChatMessage({ message, isStreaming, streamingContent }: Props) {
  const isUser = message.role === 'user';
  const content = isStreaming && streamingContent ? streamingContent : message.content;

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-slate-800 text-slate-100 rounded-bl-sm'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const isBlock = className?.includes('language-');
                  return isBlock ? (
                    <code
                      className={cn(
                        'block bg-slate-900/80 rounded-lg p-3 text-xs overflow-x-auto',
                        className
                      )}
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code
                      className="bg-slate-900/60 rounded px-1 py-0.5 text-xs text-indigo-300"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                pre({ children }) {
                  return <pre className="not-prose">{children}</pre>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
