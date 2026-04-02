import { dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

const watchers = new Map<string, fs.FSWatcher>();

export async function openFileDialog(): Promise<{ filePath: string; content: string } | null> {
  const result = await dialog.showOpenDialog({
    title: 'Open JSX Component',
    filters: [
      { name: 'JSX/TSX Files', extensions: ['jsx', 'tsx', 'js', 'ts'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { filePath, content };
}

export async function saveFileDialog(
  defaultName: string
): Promise<{ filePath: string } | null> {
  const result = await dialog.showSaveDialog({
    title: 'Save Component',
    defaultPath: defaultName,
    filters: [{ name: 'JSX Files', extensions: ['jsx'] }],
  });

  if (result.canceled || !result.filePath) return null;
  return { filePath: result.filePath };
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function watchFile(
  filePath: string,
  win: BrowserWindow,
  channel: string
): void {
  // Stop existing watcher for this path first
  stopWatchingFile(filePath);

  const watcher = fs.watch(filePath, (eventType) => {
    if (eventType === 'change') {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!win.isDestroyed()) {
          win.webContents.send(channel, { filePath, content });
        }
      } catch {
        // File may have been deleted — ignore
      }
    }
  });

  watchers.set(filePath, watcher);
}

export function stopWatchingFile(filePath: string): void {
  const existing = watchers.get(filePath);
  if (existing) {
    existing.close();
    watchers.delete(filePath);
  }
}

export function stopAllWatchers(): void {
  for (const watcher of watchers.values()) {
    watcher.close();
  }
  watchers.clear();
}
