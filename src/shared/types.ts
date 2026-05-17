// ── AI Provider config ────────────────────────────────────────────────────────

export type AIProviderType =
  | 'anthropic'       // Anthropic API (Claude)
  | 'openai'          // OpenAI API
  | 'lmstudio'        // LM Studio (local, OpenAI-compatible)
  | 'ollama'          // Ollama (local, OpenAI-compatible)
  | 'openai-compat';  // Any other OpenAI-compatible endpoint

export interface AIProviderConfig {
  provider: AIProviderType;
  // API key — required for cloud providers, optional/unused for local
  apiKey?: string;
  // Base URL override — required for local providers, optional for cloud
  // e.g. "http://localhost:1234/v1" for LM Studio
  baseUrl?: string;
  // Model name to use
  // e.g. "claude-sonnet-4-6", "gpt-4o", "llama-3.2-3b-instruct"
  model?: string;
}

export const PROVIDER_DEFAULTS: Record<AIProviderType, Partial<AIProviderConfig>> = {
  anthropic:    { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
  openai:       { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  lmstudio:     { baseUrl: 'http://localhost:1234/v1',  model: 'local-model' },
  ollama:       { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  'openai-compat': { baseUrl: 'http://localhost:8080/v1', model: 'local-model' },
};

export const PROVIDER_LABELS: Record<AIProviderType, string> = {
  anthropic:       'Anthropic (Claude)',
  openai:          'OpenAI',
  lmstudio:        'LM Studio (local)',
  ollama:          'Ollama (local)',
  'openai-compat': 'Custom OpenAI-compatible',
};

// ── Element selection ─────────────────────────────────────────────────────────

export interface ElementSelection {
  tagName: string;
  id: string | null;
  className: string;
  innerText: string;
  rect: { top: number; left: number; width: number; height: number };
  computedStyles: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontWeight: string;
    padding: string;
    margin: string;
    borderRadius: string;
    display: string;
    flexDirection: string;
    justifyContent: string;
    alignItems: string;
    gap: string;
    lineHeight: string;
    letterSpacing: string;
    borderWidth: string;
    borderColor: string;
    opacity: string;
    width: string;
    height: string;
    position: string;
    top: string;
    left: string;
  };
  descriptor: string; // e.g. "button.bg-blue-500#submit"
}

// Project browser types
export interface ProjectFile {
  name: string;
  path: string;
  relativePath: string;
}

export interface ProjectFolder {
  name: string;
  path: string;
  relativePath: string;
  files: ProjectFile[];
  folders: ProjectFolder[];
}

export interface RecentProject {
  rootPath: string;
  name: string;
  lastOpened: number;
}

export interface SilentPatchPayload {
  currentJsx: string;
  descriptor: string;
  originalClasses: string;
  newClasses: string;
  filePath: string | null;
}

export interface ProjectFileChangedPayload {
  filePath: string;
  content: string;
}

export interface ClaudeApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  extractedJsx?: string;
}

// Payloads sent from renderer → main
export interface StreamStartPayload {
  conversationId: string;
  messages: ClaudeApiMessage[];
  currentJsx: string;
  selection: ElementSelection | null;
  filePath: string | null;
  selectedFrameName?: string | null; // name of selected frame, if any
}

export interface FileWritePayload {
  filePath: string;
  content: string;
}

export interface FileReadPayload {
  filePath: string;
}

export interface WatchPayload {
  filePath: string;
}

// Payloads pushed from main → renderer
export interface StreamChunkPayload {
  conversationId: string;
  text: string;
}

export interface StreamEndPayload {
  conversationId: string;
  finalJsx: string | null;
  savedPath: string | null;
}

export interface StreamErrorPayload {
  conversationId: string;
  error: string;
}

export interface FileChangedPayload {
  filePath: string;
  content: string;
}

export interface OpenFileResult {
  filePath: string;
  content: string;
}

export interface SaveFileResult {
  filePath: string;
}
