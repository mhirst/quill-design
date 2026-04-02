import { ipcMain, app, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type {
  StreamStartPayload,
  FileWritePayload,
  FileReadPayload,
  WatchPayload,
} from '../shared/types';
import {
  openFileDialog,
  saveFileDialog,
  readFile,
  writeFile,
  watchFile,
  stopWatchingFile,
} from './file-manager';
import { streamMessage, abortStream, extractJsx } from './claude-client';

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
    const { conversationId, messages, currentJsx, selection, filePath } = payload;

    // Build the final user message with context injected
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') return;

    // Build contextual user message (inject JSX + selection context)
    const contextParts: string[] = [];

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

  // ── App ────────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion());
}
