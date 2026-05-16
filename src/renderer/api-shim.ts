/**
 * api-shim.ts
 *
 * Browser-compatible implementation of window.api that talks to the Express
 * dev server (port 3001) instead of Electron IPC. Auto-installs itself when
 * imported — just `import './api-shim'` and window.api is ready.
 */

// Use relative URLs — Vite proxies /api → http://localhost:3001
const BASE = '';

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  return res.json() as Promise<T>;
}

// ── File-change event listeners (SSE) ──────────────────────────────────────

type FileChangedCb = (data: { filePath: string; content: string }) => void;
const fileWatchers = new Map<string, { es: EventSource; cb: FileChangedCb }>();

// ── The API object ─────────────────────────────────────────────────────────

const api = {
  getApiKey: () => get<{ hasKey: boolean; key?: string }>('/api/key'),
  setApiKey: (key: string) => post<void>('/api/key', { key }),

  readFile: (filePath: string) => post<{ content: string }>('/api/file/read', { filePath }),
  writeFile: (filePath: string, content: string) => post<void>('/api/file/write', { filePath, content }),
  openFile: () => post<{ filePath: string; content: string } | null>('/api/file/open'),
  saveFileAs: (content: string) => post<{ filePath: string } | null>('/api/file/save-as', { content }),
  watchFile: (filePath: string, cb: FileChangedCb) => {
    const es = new EventSource(`${BASE}/api/file/watch?path=${encodeURIComponent(filePath)}`);
    es.onmessage = (e) => cb(JSON.parse(e.data));
    fileWatchers.set(filePath, { es, cb });
  },
  unwatchFile: (filePath: string) => {
    const w = fileWatchers.get(filePath);
    if (w) { w.es.close(); fileWatchers.delete(filePath); }
  },

  // Streaming claude chat via SSE
  streamClaude: (
    messages: { role: string; content: string }[],
    systemPrompt: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: string) => void
  ) => {
    let aborted = false;
    fetch(`${BASE}/api/claude/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemPrompt }),
    }).then(async (res) => {
      if (!res.ok || !res.body) { onError('Stream failed'); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        if (aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') { onDone(); return; }
            try { const j = JSON.parse(data); if (j.text) onChunk(j.text); } catch { /* ignore */ }
          }
        }
      }
      onDone();
    }).catch((e) => { if (!aborted) onError(String(e)); });
    return { abort: () => { aborted = true; } };
  },

  silentPatch: (filePath: string, selector: string, newClasses: string) =>
    post<void>('/api/claude/silent-patch', { filePath, selector, newClasses }),

  // Project
  openProject: () => post<{ rootPath: string } | null>('/api/project/open'),
  readDir: (rootPath: string) => post<unknown>('/api/project/read-dir', { rootPath }),
  getRecentProjects: () => get<string[]>('/api/project/recent'),

  // Store — backed by dev-server /api/store (files in ~/.quill-dev/)
  storeRead: () => get<{ data: unknown }>('/api/store'),
  storeWrite: (data: unknown) => post<{ success: boolean }>('/api/store', { data }),
};

// ── Auto-install on import ─────────────────────────────────────────────────

export function installApiShim() {
  (window as unknown as Record<string, unknown>).api = api;
}

// Install immediately when this module is imported
installApiShim();
