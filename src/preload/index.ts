import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type {
  ElementSelection,
  ClaudeApiMessage,
  StreamChunkPayload,
  StreamEndPayload,
  StreamErrorPayload,
  FileChangedPayload,
  OpenFileResult,
  SaveFileResult,
  SilentPatchPayload,
  ProjectFolder,
  RecentProject,
  ProjectFileChangedPayload,
} from '../shared/types';

export type AppAPI = {
  // API key
  getApiKey: () => Promise<{ key: string | null; hasKey: boolean }>;
  setApiKey: (key: string) => Promise<{ success: boolean }>;
  deleteApiKey: () => Promise<{ success: boolean }>;
  validateApiKey: (key: string) => Promise<{ valid: boolean; error?: string }>;

  // File
  openFile: () => Promise<OpenFileResult | null>;
  saveFileAs: (defaultName: string) => Promise<SaveFileResult | null>;
  readFile: (filePath: string) => Promise<{ content: string }>;
  saveFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
  watchFile: (filePath: string) => Promise<void>;
  unwatchFile: (filePath: string) => Promise<void>;
  onFileChanged: (cb: (data: FileChangedPayload) => void) => () => void;

  // Claude streaming
  claudeStreamStart: (payload: {
    conversationId: string;
    messages: ClaudeApiMessage[];
    currentJsx: string;
    selection: ElementSelection | null;
    filePath: string | null;
    selectedFrameName?: string | null;
  }) => Promise<void>;
  claudeStreamAbort: (conversationId: string) => Promise<void>;
  onStreamChunk: (cb: (data: StreamChunkPayload) => void) => () => void;
  onStreamEnd: (cb: (data: StreamEndPayload) => void) => () => void;
  onStreamError: (cb: (data: StreamErrorPayload) => void) => () => void;

  // Claude silent patch
  claudeSilentPatch: (payload: SilentPatchPayload) => Promise<{ finalJsx: string | null }>;

  // Project browser
  openProject: () => Promise<{ rootPath: string } | null>;
  scanProject: (rootPath: string) => Promise<ProjectFolder>;
  watchProject: (rootPath: string) => Promise<void>;
  unwatchProject: (rootPath: string) => Promise<void>;
  onProjectFileChanged: (cb: (data: ProjectFileChangedPayload) => void) => () => void;
  getRecentProjects: () => Promise<RecentProject[]>;
  addRecentProject: (project: RecentProject) => Promise<void>;

  // App
  getVersion: () => Promise<string>;

  // Store
  storeRead: () => Promise<{ data: unknown }>;
  storeWrite: (data: unknown) => Promise<{ success: boolean }>;
};

contextBridge.exposeInMainWorld('api', {
  // API key
  getApiKey: () => ipcRenderer.invoke(IPC.API_KEY_GET),
  setApiKey: (key: string) => ipcRenderer.invoke(IPC.API_KEY_SET, { key }),
  deleteApiKey: () => ipcRenderer.invoke(IPC.API_KEY_DELETE),
  validateApiKey: (key: string) => ipcRenderer.invoke(IPC.API_KEY_VALIDATE, { key }),

  // File
  openFile: () => ipcRenderer.invoke(IPC.FILE_OPEN_DIALOG),
  saveFileAs: (defaultName: string) =>
    ipcRenderer.invoke(IPC.FILE_SAVE_DIALOG, { defaultName }),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_READ, { filePath }),
  saveFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC.FILE_WRITE, { filePath, content }),
  watchFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_WATCH_START, { filePath }),
  unwatchFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_WATCH_STOP, { filePath }),
  onFileChanged: (cb: (data: FileChangedPayload) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: FileChangedPayload) => cb(data);
    ipcRenderer.on(IPC.FILE_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.FILE_CHANGED, handler);
  },

  // Claude streaming
  claudeStreamStart: (payload: {
    conversationId: string;
    messages: ClaudeApiMessage[];
    currentJsx: string;
    selection: ElementSelection | null;
    filePath: string | null;
  }) => ipcRenderer.invoke(IPC.CLAUDE_STREAM_START, payload),
  claudeStreamAbort: (conversationId: string) =>
    ipcRenderer.invoke(IPC.CLAUDE_STREAM_ABORT, { conversationId }),
  onStreamChunk: (cb: (data: StreamChunkPayload) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: StreamChunkPayload) => cb(data);
    ipcRenderer.on(IPC.CLAUDE_STREAM_CHUNK, handler);
    return () => ipcRenderer.removeListener(IPC.CLAUDE_STREAM_CHUNK, handler);
  },
  onStreamEnd: (cb: (data: StreamEndPayload) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: StreamEndPayload) => cb(data);
    ipcRenderer.on(IPC.CLAUDE_STREAM_END, handler);
    return () => ipcRenderer.removeListener(IPC.CLAUDE_STREAM_END, handler);
  },
  onStreamError: (cb: (data: StreamErrorPayload) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: StreamErrorPayload) => cb(data);
    ipcRenderer.on(IPC.CLAUDE_STREAM_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.CLAUDE_STREAM_ERROR, handler);
  },

  // Claude silent patch
  claudeSilentPatch: (payload: SilentPatchPayload) =>
    ipcRenderer.invoke(IPC.CLAUDE_SILENT_PATCH, payload),

  // Project browser
  openProject: () => ipcRenderer.invoke(IPC.PROJECT_OPEN_DIALOG),
  scanProject: (rootPath: string) => ipcRenderer.invoke(IPC.PROJECT_SCAN, { rootPath }),
  watchProject: (rootPath: string) => ipcRenderer.invoke(IPC.PROJECT_WATCH_START, { rootPath }),
  unwatchProject: (rootPath: string) => ipcRenderer.invoke(IPC.PROJECT_WATCH_STOP, { rootPath }),
  onProjectFileChanged: (cb: (data: ProjectFileChangedPayload) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: ProjectFileChangedPayload) => cb(data);
    ipcRenderer.on(IPC.PROJECT_FILE_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.PROJECT_FILE_CHANGED, handler);
  },
  getRecentProjects: () => ipcRenderer.invoke(IPC.PROJECT_GET_RECENTS),
  addRecentProject: (project: RecentProject) => ipcRenderer.invoke(IPC.PROJECT_ADD_RECENT, project),

  // App
  getVersion: () => ipcRenderer.invoke(IPC.APP_GET_VERSION),

  // Store
  storeRead: () => ipcRenderer.invoke(IPC.STORE_READ),
  storeWrite: (data: unknown) => ipcRenderer.invoke(IPC.STORE_WRITE, { data }),
} satisfies AppAPI);
