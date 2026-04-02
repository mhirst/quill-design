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
  };
  descriptor: string; // e.g. "button.bg-blue-500#submit"
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
