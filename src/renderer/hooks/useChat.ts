import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ClaudeApiMessage, ElementSelection } from '@shared/types';
import { extractJsx } from '../lib/utils';
import { analytics } from '../lib/analytics';

const MAX_HISTORY = 20; // 10 turns

interface UseChatOptions {
  onJsxReady: (jsx: string) => void;
  getCurrentJsx: () => string;
  getSelection: () => ElementSelection | null;
  getFilePath: () => string | null;
  getSelectedFrameName?: () => string | null;
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

export function useChat({ onJsxReady, getCurrentJsx, getSelection, getFilePath, getSelectedFrameName, initialMessages, onMessagesChange }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages ?? []);
  const onMessagesChangeRef = useRef(onMessagesChange);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const conversationIdRef = useRef<string>(uuidv4());
  const streamingIdRef = useRef<string | null>(null);
  // Keep a ref to streaming content so the onStreamEnd handler can read it without stale closure
  const streamingContentRef = useRef('');
  onMessagesChangeRef.current = onMessagesChange;

  // Subscribe to streaming events
  useEffect(() => {
    const unsubChunk = window.api.onStreamChunk((data) => {
      if (data.conversationId !== conversationIdRef.current) return;
      setStreamingContent((prev) => prev + data.text);
    });

    const unsubEnd = window.api.onStreamEnd((data) => {
      if (data.conversationId !== conversationIdRef.current) return;

      setIsStreaming(false);
      const content = streamingContentRef.current;

      const assistantMsg: ChatMessage = {
        id: streamingIdRef.current ?? uuidv4(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        extractedJsx: data.finalJsx ?? undefined,
      };

      setMessages((prev) => {
        const next = [...prev, assistantMsg];
        onMessagesChangeRef.current?.(next);
        return next;
      });
      setStreamingContent('');
      streamingIdRef.current = null;

      analytics.track('ai_generation_completed', { has_jsx: !!data.finalJsx });
      if (data.finalJsx) {
        onJsxReady(data.finalJsx);
      }
    });

    const unsubError = window.api.onStreamError((data) => {
      if (data.conversationId !== conversationIdRef.current) return;
      setIsStreaming(false);

      const errMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `Error: ${data.error}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      setStreamingContent('');
      streamingIdRef.current = null;
    });

    return () => {
      unsubChunk();
      unsubEnd();
      unsubError();
    };
  }, [onJsxReady]);

  // Keep streamingContentRef in sync with state
  useEffect(() => {
    streamingContentRef.current = streamingContent;
  }, [streamingContent]);

  const send = useCallback(
    async (userText: string) => {
      if (isStreaming || !userText.trim()) return;

      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: userText.trim(),
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      onMessagesChangeRef.current?.(updatedMessages);
      setIsStreaming(true);
      streamingIdRef.current = uuidv4();

      // Build API messages — only last MAX_HISTORY, plain text (context injected by main)
      const apiMessages: ClaudeApiMessage[] = updatedMessages
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content }));

      conversationIdRef.current = uuidv4();

      analytics.track('ai_generation_started', { prompt_length: userText.trim().length });
      await window.api.claudeStreamStart({
        conversationId: conversationIdRef.current,
        messages: apiMessages,
        currentJsx: getCurrentJsx(),
        selection: getSelection(),
        filePath: getFilePath(),
        selectedFrameName: getSelectedFrameName?.() ?? null,
      });
    },
    [isStreaming, messages, getCurrentJsx, getSelection, getFilePath]
  );

  const abort = useCallback(async () => {
    await window.api.claudeStreamAbort(conversationIdRef.current);
    setIsStreaming(false);
    setStreamingContent('');
    streamingIdRef.current = null;
  }, []);

  const reset = useCallback(() => {
    if (isStreaming) {
      window.api.claudeStreamAbort(conversationIdRef.current);
    }
    setMessages([]);
    setIsStreaming(false);
    setStreamingContent('');
    conversationIdRef.current = uuidv4();
    streamingIdRef.current = null;
  }, [isStreaming]);

  return {
    messages,
    isStreaming,
    streamingContent,
    send,
    abort,
    reset,
  };
}
