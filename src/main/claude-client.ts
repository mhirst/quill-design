import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeApiMessage } from '../shared/types';

const SYSTEM_PROMPT = `You are an expert React and Tailwind CSS component engineer embedded in a visual design tool.

Your role is to generate and modify React functional components based on user instructions.

## Output rules
1. Always output a SINGLE, complete, self-contained React component named \`App\`.
2. Wrap the component in a markdown code block: \`\`\`jsx ... \`\`\`
3. Use only React (useState, useEffect, useRef, useCallback are available globally — do NOT import them).
4. Use Tailwind CSS utility classes for all styling. Do NOT use inline styles unless absolutely necessary.
5. Do NOT write any import or export statements — the component is injected into a pre-built environment.
6. The component must be renderable standalone — no external data, no network calls.
7. Make it visually polished and production-ready.
8. After the code block, you may add a brief explanation (1–3 sentences max).

## When modifying an existing component
- Return the COMPLETE updated component, not a diff or partial snippet.
- Preserve all existing functionality unless the user explicitly asks to remove it.
- Only change what the user requested.`;

const JSX_BLOCK_REGEX = /```(?:jsx?|tsx?)\n([\s\S]+?)```/;

const activeStreams = new Map<string, AbortController>();

export function extractJsx(text: string): string | null {
  const match = JSX_BLOCK_REGEX.exec(text);
  return match ? match[1].trim() : null;
}

export async function streamMessage(
  conversationId: string,
  messages: ClaudeApiMessage[],
  onChunk: (text: string) => void,
  onEnd: (fullText: string) => void,
  onError: (error: string) => void
): Promise<void> {
  const controller = new AbortController();
  activeStreams.set(conversationId, controller);

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const stream = await client.messages.stream(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages,
      },
      { signal: controller.signal }
    );

    let fullText = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
        onChunk(chunk.delta.text);
      }
    }

    onEnd(fullText);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      onError('Stream aborted');
    } else {
      onError(err instanceof Error ? err.message : String(err));
    }
  } finally {
    activeStreams.delete(conversationId);
  }
}

export function abortStream(conversationId: string): void {
  const controller = activeStreams.get(conversationId);
  if (controller) {
    controller.abort();
    activeStreams.delete(conversationId);
  }
}
