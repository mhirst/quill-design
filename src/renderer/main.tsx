import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import './types';
import App from './App';

// ─── Browser dev-mode shim ────────────────────────────────────────────────────
// In Electron, window.api is set synchronously by the preload before this
// module runs. In the browser it's undefined — we install a fetch-based shim.
if (!(window as unknown as Record<string, unknown>).api) {

  type AnyCallback = (data: unknown) => void;
  const streamCallbacks = {
    chunk: [] as AnyCallback[],
    end: [] as AnyCallback[],
    error: [] as AnyCallback[],
  };
  const fileChangedCallbacks: AnyCallback[] = [];
  const projectChangedCallbacks: AnyCallback[] = [];
  let fileEventSource: EventSource | null = null;
  let projectEventSource: EventSource | null = null;

  const post = async <T,>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return res.json() as Promise<T>;
  };

  const get = async <T,>(path: string): Promise<T> => {
    const res = await fetch(path);
    return res.json() as Promise<T>;
  };

  // Parse SSE stream from a fetch Response body and fire callbacks
  function consumeSse(
    body: ReadableStream<Uint8Array>,
    onEvent: (name: string, data: unknown) => void,
    onDone: () => void
  ) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let eventName = '';

    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const raw of lines) {
          const line = raw.trimEnd();
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim();
            try { onEvent(eventName, JSON.parse(dataStr)); } catch { /* skip */ }
            eventName = '';
          }
        }
      }
      onDone();
    })().catch(onDone);
  }

  const api = {
    // ── API key ──────────────────────────────────────────────────────────────
    getApiKey: () => get<{ key: string | null; hasKey: boolean }>('/api/key'),
    setApiKey: (key: string) => post<{ success: boolean }>('/api/key', { key }),
    deleteApiKey: () => post<{ success: boolean }>('/api/key/delete', {}),
    validateApiKey: (key: string) => post<{ valid: boolean; error?: string }>('/api/key/validate', { key }),

    // ── File ─────────────────────────────────────────────────────────────────
    openFile: () => post<null>('/api/file/open-dialog'),
    saveFileAs: (_defaultName: string) => post<null>('/api/file/save-dialog'),
    readFile: (filePath: string) => post<{ content: string }>('/api/file/read', { filePath }),
    saveFile: (filePath: string, content: string) =>
      post<{ success: boolean }>('/api/file/write', { filePath, content }),
    watchFile: async (filePath: string) => {
      await post('/api/file/watch', { filePath });
      if (fileEventSource) fileEventSource.close();
      const es = new EventSource(`/api/file/events?filePath=${encodeURIComponent(filePath)}`);
      fileEventSource = es;
      es.onmessage = (e) => {
        try { const d = JSON.parse(e.data); fileChangedCallbacks.forEach(cb => cb(d)); } catch { /* skip */ }
      };
    },
    unwatchFile: async (filePath: string) => {
      fileEventSource?.close(); fileEventSource = null;
      await post('/api/file/unwatch', { filePath });
    },
    onFileChanged: (cb: AnyCallback) => {
      fileChangedCallbacks.push(cb);
      return () => { const i = fileChangedCallbacks.indexOf(cb); if (i >= 0) fileChangedCallbacks.splice(i, 1); };
    },

    // ── Claude streaming ──────────────────────────────────────────────────────
    claudeStreamStart: async (payload: {
      conversationId: string;
      messages: { role: string; content: string }[];
      currentJsx: string;
      selection: unknown;
      filePath: string | null;
    }) => {
      const res = await fetch('/api/claude/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) {
        streamCallbacks.error.forEach(cb =>
          cb({ conversationId: payload.conversationId, error: 'Stream request failed' })
        );
        return;
      }
      consumeSse(
        res.body,
        (name, data) => {
          if (name === 'chunk') streamCallbacks.chunk.forEach(cb => cb(data));
          else if (name === 'end') streamCallbacks.end.forEach(cb => cb(data));
          else if (name === 'error') streamCallbacks.error.forEach(cb => cb(data));
        },
        () => { /* stream ended */ }
      );
    },

    claudeStreamAbort: (conversationId: string) =>
      post<{ success: boolean }>('/api/claude/abort', { conversationId }),

    onStreamChunk: (cb: AnyCallback) => {
      streamCallbacks.chunk.push(cb);
      return () => { const i = streamCallbacks.chunk.indexOf(cb); if (i >= 0) streamCallbacks.chunk.splice(i, 1); };
    },
    onStreamEnd: (cb: AnyCallback) => {
      streamCallbacks.end.push(cb);
      return () => { const i = streamCallbacks.end.indexOf(cb); if (i >= 0) streamCallbacks.end.splice(i, 1); };
    },
    onStreamError: (cb: AnyCallback) => {
      streamCallbacks.error.push(cb);
      return () => { const i = streamCallbacks.error.indexOf(cb); if (i >= 0) streamCallbacks.error.splice(i, 1); };
    },

    // ── Claude silent patch ───────────────────────────────────────────────────
    claudeSilentPatch: (payload: unknown) =>
      post<{ finalJsx: string | null }>('/api/claude/silent-patch', payload),

    // ── Project browser ───────────────────────────────────────────────────────
    openProject: () => post<null>('/api/project/open-dialog'),
    scanProject: (rootPath: string) => post<unknown>('/api/project/scan', { rootPath }),
    watchProject: async (rootPath: string) => {
      await post('/api/project/watch', { rootPath });
      if (projectEventSource) projectEventSource.close();
      const es = new EventSource(`/api/project/events?rootPath=${encodeURIComponent(rootPath)}`);
      projectEventSource = es;
      es.onmessage = (e) => {
        try { const d = JSON.parse(e.data); projectChangedCallbacks.forEach(cb => cb(d)); } catch { /* skip */ }
      };
    },
    unwatchProject: async (rootPath: string) => {
      projectEventSource?.close(); projectEventSource = null;
      await post('/api/project/unwatch', { rootPath });
    },
    onProjectFileChanged: (cb: AnyCallback) => {
      projectChangedCallbacks.push(cb);
      return () => { const i = projectChangedCallbacks.indexOf(cb); if (i >= 0) projectChangedCallbacks.splice(i, 1); };
    },
    getRecentProjects: () => get<unknown[]>('/api/project/recents'),
    addRecentProject: (project: unknown) => post<void>('/api/project/recents', project),

    // ── App ───────────────────────────────────────────────────────────────────
    getVersion: () => get<{ version: string }>('/api/version').then(r => r.version),
  };

  (window as unknown as Record<string, unknown>).api = api;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
