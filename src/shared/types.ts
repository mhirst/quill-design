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
