import { ipcMain, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { IPC } from '../shared/ipc-channels';
import { getApiKey, setApiKey, deleteApiKey, validateApiKey } from './key-manager';
import type {
  StreamStartPayload,
  FileWritePayload,
  FileReadPayload,
  WatchPayload,
  SilentPatchPayload,
  RecentProject,
} from '../shared/types';
import {
  openFileDialog,
  saveFileDialog,
  readFile,
  writeFile,
  watchFile,
  stopWatchingFile,
} from './file-manager';
import { streamMessage, abortStream, extractJsx, silentPatch } from './claude-client';
import {
  openFolderDialog,
  scanProjectDirectory,
  watchProjectDirectory,
  stopWatchingDirectory,
  getRecentProjects,
  addRecentProject,
} from './project-manager';

export function registerIpcHandlers(win: BrowserWindow): void {
  // ── File: open dialog ──────────────────────────────────────────────────────
  ipcMain.handle(IPC.FILE_OPEN_DIALOG, async () => {
    return openFileDialog();
  });

  // ── File: save-as dialog ───────────────────────────────────────────────────
  ipcMain.handle(IPC.FILE_SAVE_DIALOG, async (_e, { defaultName }: { defaultName: string }) => {
    return saveFileDialog(defaultName);
  });

  // ── File: read ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.FILE_READ, (_e, { filePath }: FileReadPayload) => {
    return { content: readFile(filePath) };
  });

  // ── File: write ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.FILE_WRITE, (_e, { filePath, content }: FileWritePayload) => {
    writeFile(filePath, content);
    return { success: true };
  });

  // ── File: watch ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.FILE_WATCH_START, (_e, { filePath }: WatchPayload) => {
    watchFile(filePath, win, IPC.FILE_CHANGED);
  });

  ipcMain.handle(IPC.FILE_WATCH_STOP, (_e, { filePath }: WatchPayload) => {
    stopWatchingFile(filePath);
  });

  // ── Claude: stream ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CLAUDE_STREAM_START, async (_e, payload: StreamStartPayload) => {
    const { conversationId, messages, currentJsx, selection, filePath, selectedFrameName } = payload;

    // Build the final user message with context injected
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') return;

    // Build contextual user message (inject JSX + selection context)
    const contextParts: string[] = [];

    if (selectedFrameName) {
      contextParts.push(`## Canvas context\nThe user has a frame named "${selectedFrameName}" selected. Design content that fits inside this frame. If modifying an existing component, work with the current JSX below.`);
    } else if (!currentJsx) {
      contextParts.push(`## Canvas context\nNo frame is selected. Generate a new self-contained React component. It will be placed in a new frame on the canvas.`);
    }

    if (currentJsx) {
      contextParts.push(`## Current component\n\`\`\`jsx\n${currentJsx}\n\`\`\``);
    }

    if (selection) {
      const styles = Object.entries(selection.computedStyles)
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join('\n');
      contextParts.push(
        `## Selected element\n` +
          `Selector: \`${selection.descriptor}\`\n` +
          `Tag: ${selection.tagName}\n` +
          `Classes: ${selection.className || '(none)'}\n` +
          `Text content: "${selection.innerText}"\n` +
          `Computed styles:\n${styles}`
      );
    }

    contextParts.push(`## User instruction\n${lastMessage.content}`);

    const enrichedMessages = [
      ...messages.slice(0, -1),
      { role: 'user' as const, content: contextParts.join('\n\n') },
    ];

    await streamMessage(
      conversationId,
      enrichedMessages,
      (text) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.CLAUDE_STREAM_CHUNK, { conversationId, text });
        }
      },
      (fullText) => {
        const jsx = extractJsx(fullText);
        let savedPath: string | null = null;

        if (jsx && filePath) {
          try {
            writeFile(filePath, jsx);
            savedPath = filePath;
          } catch {
            // ignore write errors — renderer still gets the JSX
          }
        }

        if (!win.isDestroyed()) {
          win.webContents.send(IPC.CLAUDE_STREAM_END, {
            conversationId,
            finalJsx: jsx,
            savedPath,
          });
        }
      },
      (error) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.CLAUDE_STREAM_ERROR, { conversationId, error });
        }
      }
    );
  });

  // ── Claude: abort ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CLAUDE_STREAM_ABORT, (_e, { conversationId }: { conversationId: string }) => {
    abortStream(conversationId);
  });

  // ── Claude: silent patch ───────────────────────────────────────────────────
  ipcMain.handle(IPC.CLAUDE_SILENT_PATCH, async (_e, payload: SilentPatchPayload) => {
    const { currentJsx, descriptor, originalClasses, newClasses, filePath } = payload;
    const jsx = await silentPatch(currentJsx, descriptor, originalClasses, newClasses);
    if (jsx && filePath) {
      try { writeFile(filePath, jsx); } catch { /* ignore */ }
    }
    return { finalJsx: jsx };
  });

  // ── Project: open folder dialog ────────────────────────────────────────────
  ipcMain.handle(IPC.PROJECT_OPEN_DIALOG, async () => {
    return openFolderDialog();
  });

  // ── Project: scan directory ────────────────────────────────────────────────
  ipcMain.handle(IPC.PROJECT_SCAN, (_e, { rootPath }: { rootPath: string }) => {
    return scanProjectDirectory(rootPath);
  });

  // ── Project: watch directory ───────────────────────────────────────────────
  ipcMain.handle(IPC.PROJECT_WATCH_START, (_e, { rootPath }: { rootPath: string }) => {
    watchProjectDirectory(rootPath, win, IPC.PROJECT_FILE_CHANGED);
  });

  ipcMain.handle(IPC.PROJECT_WATCH_STOP, (_e, { rootPath }: { rootPath: string }) => {
    stopWatchingDirectory(rootPath);
  });

  // ── Project: recents ───────────────────────────────────────────────────────
  ipcMain.handle(IPC.PROJECT_GET_RECENTS, () => {
    return getRecentProjects();
  });

  ipcMain.handle(IPC.PROJECT_ADD_RECENT, (_e, project: RecentProject) => {
    addRecentProject(project);
  });

  // ── API key ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.API_KEY_GET, () => {
    const key = getApiKey();
    return { key, hasKey: !!key };
  });

  ipcMain.handle(IPC.API_KEY_SET, (_e, { key }: { key: string }) => {
    setApiKey(key);
    return { success: true };
  });

  ipcMain.handle(IPC.API_KEY_DELETE, () => {
    deleteApiKey();
    return { success: true };
  });

  ipcMain.handle(IPC.API_KEY_VALIDATE, async (_e, { key }: { key: string }) => {
    return validateApiKey(key);
  });

  // ── App ────────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion());

  // ── Store: read/write JSON persistence in userData ─────────────────────────
  const storePath = path.join(app.getPath('userData'), 'quill-store.json');

  ipcMain.handle(IPC.STORE_READ, () => {
    try {
      if (!fs.existsSync(storePath)) return { data: null };
      const raw = fs.readFileSync(storePath, 'utf-8');
      return { data: JSON.parse(raw) };
    } catch {
      return { data: null };
    }
  });

  ipcMain.handle(IPC.STORE_WRITE, (_e, { data }: { data: unknown }) => {
    try {
      fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch {
      return { success: false };
    }
  });
}
