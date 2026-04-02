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
} from '../shared/types';

export type AppAPI = {
  // File
  openFile: () => Promise<OpenFileResult | null>;
  saveFileAs: (defaultName: string) => Promise<SaveFileResult | null>;
  readFile: (filePath: string) => Promise<{ content: string }>;
  saveFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
  watchFile: (filePath: string) => Promise<void>;
  unwatchFile: (filePath: string) => Promise<void>;
  onFileChanged: (cb: (data: FileChangedPayload) => void) => () => void;

  // Claude
  claudeStreamStart: (payload: {
    conversationId: string;
    messages: ClaudeApiMessage[];
    currentJsx: string;
    selection: ElementSelection | null;
    filePath: string | null;
  }) => Promise<void>;
  claudeStreamAbort: (conversationId: string) => Promise<void>;
  onStreamChunk: (cb: (data: StreamChunkPayload) => void) => () => void;
  onStreamEnd: (cb: (data: StreamEndPayload) => void) => () => void;
  onStreamError: (cb: (data: StreamErrorPayload) => void) => () => void;

  // App
  getVersion: () => Promise<string>;
};

contextBridge.exposeInMainWorld('api', {
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

  // Claude
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

  // App
  getVersion: () => ipcRenderer.invoke(IPC.APP_GET_VERSION),
} satisfies AppAPI);
