/**
 * ai-client.ts  (still exported as claude-client for compatibility)
 *
 * Provider-agnostic streaming AI client.
 * Supports: Anthropic (Claude), OpenAI, LM Studio, Ollama, and any
 * OpenAI-compatible endpoint.
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { AIProviderConfig, ClaudeApiMessage } from '../shared/types';
import { PROVIDER_DEFAULTS } from '../shared/types';
import { getProviderConfig } from './key-manager';

// ── System prompt (shared across all providers) ───────────────────────────────

const SYSTEM_PROMPT = `You are an expert React + Tailwind CSS UI engineer embedded in Quill, a visual design tool.

## Environment
- React 18 (createRoot). Hook globals: \`useState\`, \`useEffect\`, \`useRef\`, \`useCallback\`, \`useMemo\`, \`useReducer\`
- Tailwind CSS via CDN (all utilities available, including arbitrary values like \`w-[320px]\`)
- NO imports, NO exports — component is injected directly into a pre-built sandbox
- NO network calls, NO external images (use placeholder colors/gradients instead)
- lucide-react is NOT available — use inline SVGs or emoji for icons if needed

## Output format
1. Output exactly ONE markdown code block: \`\`\`jsx\\n...\\n\`\`\`
2. The component MUST be named \`App\` (no default export, just the function declaration)
3. After the code block, optionally add 1–2 sentences of plain-text explanation

## Quality bar
- Dark mode by default — use slate/gray dark backgrounds unless asked for light
- Pixel-perfect spacing, proper visual hierarchy, real-feeling data/copy
- Use Tailwind gradients, shadows, rings, and transitions for polish
- Make interactive elements (buttons, inputs, tabs) actually work with useState
- If generating a multi-panel layout, fill all panels with realistic content

## When modifying an existing component
- Return the COMPLETE updated component — never a partial diff
- Preserve all functionality not mentioned in the request
- Make only the minimum changes needed`;

const SILENT_PATCH_SYSTEM = `You are a JSX component patcher. Update Tailwind classes on a specific element in a React component.
Return ONLY the complete updated component wrapped in \`\`\`jsx....\`\`\`. Make no other changes. Do not explain anything.`;

// ── JSX extraction ────────────────────────────────────────────────────────────

const JSX_BLOCK_REGEX = /```(?:jsx?|tsx?)\n([\s\S]+?)```/;

export function extractJsx(text: string): string | null {
  const match = JSX_BLOCK_REGEX.exec(text);
  return match ? match[1].trim() : null;
}

// ── Active stream registry ────────────────────────────────────────────────────

const activeStreams = new Map<string, AbortController>();

export function abortStream(conversationId: string): void {
  const controller = activeStreams.get(conversationId);
  if (controller) {
    controller.abort();
    activeStreams.delete(conversationId);
  }
}

// ── Anthropic streaming ───────────────────────────────────────────────────────

async function streamAnthropic(
  config: AIProviderConfig,
  conversationId: string,
  messages: ClaudeApiMessage[],
  onChunk: (text: string) => void,
  onEnd: (fullText: string) => void,
  onError: (error: string) => void
): Promise<void> {
  const controller = new AbortController();
  activeStreams.set(conversationId, controller);

  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl !== PROVIDER_DEFAULTS.anthropic.baseUrl
      ? config.baseUrl
      : undefined,
  });

  try {
    const stream = await client.messages.stream(
      {
        model: config.model ?? PROVIDER_DEFAULTS.anthropic.model!,
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

// ── OpenAI-compatible streaming (OpenAI, LM Studio, Ollama, custom) ───────────

async function streamOpenAICompat(
  config: AIProviderConfig,
  conversationId: string,
  messages: ClaudeApiMessage[],
  onChunk: (text: string) => void,
  onEnd: (fullText: string) => void,
  onError: (error: string) => void
): Promise<void> {
  const controller = new AbortController();
  activeStreams.set(conversationId, controller);

  const defaults = PROVIDER_DEFAULTS[config.provider] ?? {};
  const baseURL = config.baseUrl ?? defaults.baseUrl ?? 'http://localhost:1234/v1';
  const model = config.model ?? defaults.model ?? 'local-model';

  const client = new OpenAI({
    apiKey: config.apiKey ?? 'not-required', // local servers don't need a key
    baseURL,
  });

  try {
    const stream = await client.chat.completions.create(
      {
        model,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      },
      { signal: controller.signal }
    );

    let fullText = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
    }
    onEnd(fullText);
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))) {
      onError('Stream aborted');
    } else {
      onError(err instanceof Error ? err.message : String(err));
    }
  } finally {
    activeStreams.delete(conversationId);
  }
}

// ── Public streaming entry point ──────────────────────────────────────────────

export async function streamMessage(
  conversationId: string,
  messages: ClaudeApiMessage[],
  onChunk: (text: string) => void,
  onEnd: (fullText: string) => void,
  onError: (error: string) => void
): Promise<void> {
  const config = getProviderConfig();

  if (!config) {
    onError('No AI provider configured. Please set up a provider in Settings.');
    return;
  }

  if (config.provider === 'anthropic') {
    return streamAnthropic(config, conversationId, messages, onChunk, onEnd, onError);
  } else {
    return streamOpenAICompat(config, conversationId, messages, onChunk, onEnd, onError);
  }
}

// ── Silent patch ──────────────────────────────────────────────────────────────

export async function silentPatch(
  currentJsx: string,
  descriptor: string,
  originalClasses: string,
  newClasses: string
): Promise<string | null> {
  const config = getProviderConfig();
  if (!config) return null;

  const userMessage = `Element to update: ${descriptor}
Current classes: ${originalClasses}
New classes: ${newClasses}

## Component
\`\`\`jsx
${currentJsx}
\`\`\``;

  try {
    if (config.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: config.apiKey });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20250514',
        max_tokens: 4096,
        system: SILENT_PATCH_SYSTEM,
        messages: [{ role: 'user', content: userMessage }],
      });
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');
      return extractJsx(text);
    } else {
      const defaults = PROVIDER_DEFAULTS[config.provider] ?? {};
      const client = new OpenAI({
        apiKey: config.apiKey ?? 'not-required',
        baseURL: config.baseUrl ?? defaults.baseUrl ?? 'http://localhost:1234/v1',
      });
      const response = await client.chat.completions.create({
        model: config.model ?? defaults.model ?? 'local-model',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: SILENT_PATCH_SYSTEM },
          { role: 'user', content: userMessage },
        ],
      });
      const text = response.choices[0]?.message?.content ?? '';
      return extractJsx(text);
    }
  } catch {
    return null;
  }
}
