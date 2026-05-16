import { dialog, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import type { ProjectFolder, RecentProject, ProjectFileChangedPayload } from '../shared/types';

// ── Recents ────────────────────────────────────────────────────────────────────

const RECENTS_FILE = path.join(app.getPath('userData'), 'recents.json');
const MAX_RECENTS = 10;

function readRecents(): RecentProject[] {
  try {
    if (!fs.existsSync(RECENTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(RECENTS_FILE, 'utf-8')) as RecentProject[];
  } catch {
    return [];
  }
}

function writeRecents(recents: RecentProject[]): void {
  try {
    fs.writeFileSync(RECENTS_FILE, JSON.stringify(recents, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

export function getRecentProjects(): RecentProject[] {
  return readRecents();
}

export function addRecentProject(project: RecentProject): void {
  const recents = readRecents().filter((r) => r.rootPath !== project.rootPath);
  recents.unshift({ ...project, lastOpened: Date.now() });
  writeRecents(recents.slice(0, MAX_RECENTS));
}

// ── Folder dialog ──────────────────────────────────────────────────────────────

export async function openFolderDialog(): Promise<{ rootPath: string } | null> {
  const result = await dialog.showOpenDialog({
    title: 'Open Project Folder',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return { rootPath: result.filePaths[0] };
}

// ── Directory scanner ──────────────────────────────────────────────────────────

const COMPONENT_EXTENSIONS = new Set(['.tsx', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.vite', 'coverage', '__pycache__', '.turbo']);

function scanDir(dirPath: string, rootPath: string, depth = 0): ProjectFolder {
  const name = path.basename(dirPath);
  const relativePath = path.relative(rootPath, dirPath);

  const result: ProjectFolder = {
    name,
    path: dirPath,
    relativePath: relativePath || '.',
    files: [],
    folders: [],
  };

  if (depth > 8) return result;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const subDir = scanDir(path.join(dirPath, entry.name), rootPath, depth + 1);
      // Only include folders that have component files somewhere inside
      if (subDir.files.length > 0 || subDir.folders.length > 0) {
        result.folders.push(subDir);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (COMPONENT_EXTENSIONS.has(ext)) {
        result.files.push({
          name: entry.name,
          path: path.join(dirPath, entry.name),
          relativePath: path.relative(rootPath, path.join(dirPath, entry.name)),
        });
      }
    }
  }

  // Sort: folders first, then files, both alphabetically
  result.folders.sort((a, b) => a.name.localeCompare(b.name));
  result.files.sort((a, b) => a.name.localeCompare(b.name));

  return result;
}

export function scanProjectDirectory(rootPath: string): ProjectFolder {
  return scanDir(rootPath, rootPath);
}

// ── Directory watcher ──────────────────────────────────────────────────────────

const dirWatchers = new Map<string, fs.FSWatcher>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function watchProjectDirectory(
  rootPath: string,
  win: BrowserWindow,
  channel: string
): void {
  stopWatchingDirectory(rootPath);

  try {
    const watcher = fs.watch(rootPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      const ext = path.extname(filename).toLowerCase();
      if (!COMPONENT_EXTENSIONS.has(ext)) return;

      // Debounce per-file
      const key = path.join(rootPath, filename);
      const existing = debounceTimers.get(key);
      if (existing) clearTimeout(existing);

      debounceTimers.set(
        key,
        setTimeout(() => {
          debounceTimers.delete(key);
          try {
            const content = fs.readFileSync(key, 'utf-8');
            if (!win.isDestroyed()) {
              const payload: ProjectFileChangedPayload = { filePath: key, content };
              win.webContents.send(channel, payload);
            }
          } catch {
            // File may have been deleted
          }
        }, 300)
      );
    });

    dirWatchers.set(rootPath, watcher);
  } catch {
    // Watch failed (e.g., no permissions)
  }
}

export function stopWatchingDirectory(rootPath: string): void {
  const existing = dirWatchers.get(rootPath);
  if (existing) {
    existing.close();
    dirWatchers.delete(rootPath);
  }
}
