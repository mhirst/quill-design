/**
 * dev-server.ts
 *
 * Lightweight Express backend that mirrors all Electron IPC handlers as HTTP
 * endpoints so the renderer can run in Chrome (no Electron needed).
 *
 * Run with:  npx tsx dev-server.ts
 * Then open: http://localhost:5173  (Vite renderer dev server, already running)
 */

import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeApiMessage, SilentPatchPayload, RecentProject } from './src/shared/types';

const app = express();
app.use(express.json({ limit: '4mb' }));

// ── CORS: allow Vite dev server (port 5173) ───────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Key management (stored in ~/.quill-dev/api-key.json)
// ─────────────────────────────────────────────────────────────────────────────

const KEY_DIR = path.join(os.homedir(), '.quill-dev');
const KEY_FILE = path.join(KEY_DIR, 'api-key.json');

function readKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const raw = fs.readFileSync(KEY_FILE, 'utf-8');
    const stored = (JSON.parse(raw) as { anthropicApiKey?: string }).anthropicApiKey ?? null;
    if (stored) process.env.ANTHROPIC_API_KEY = stored;
    return stored;
  } catch { return null; }
}

function writeKey(key: string) {
  fs.mkdirSync(KEY_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify({ anthropicApiKey: key }, null, 2));
  process.env.ANTHROPIC_API_KEY = key;
}

function deleteKey() {
  try { fs.unlinkSync(KEY_FILE); } catch { /* ignore */ }
  delete process.env.ANTHROPIC_API_KEY;
}

app.get('/api/key', (_req, res) => {
  const key = readKey();
  res.json({ key, hasKey: !!key });
});

app.post('/api/key', (req, res) => {
  const { key } = req.body as { key: string };
  writeKey(key);
  res.json({ success: true });
});

app.delete('/api/key', (_req, res) => {
  deleteKey();
  res.json({ success: true });
});

app.post('/api/key/validate', async (req, res) => {
  const { key } = req.body as { key: string };
  try {
    const r = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (r.ok) { res.json({ valid: true }); return; }
    const body = await r.json().catch(() => ({})) as { error?: { message?: string } };
    res.json({ valid: false, error: body?.error?.message ?? `HTTP ${r.status}` });
  } catch (e) {
    res.json({ valid: false, error: e instanceof Error ? e.message : 'Network error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// File operations  (browser can't access the local FS — we proxy it)
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/file/read', (req, res) => {
  const { filePath } = req.body as { filePath: string };
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/file/write', (req, res) => {
  const { filePath, content } = req.body as { filePath: string; content: string };
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// File open/save dialogs aren't available in browser — return null
app.post('/api/file/open-dialog', (_req, res) => res.json(null));
app.post('/api/file/save-dialog', (_req, res) => res.json(null));

// File watching via SSE
const fileWatchers = new Map<string, fs.FSWatcher>();
const fileWatchClients = new Map<string, Response[]>();

app.post('/api/file/watch', (req, res) => {
  const { filePath } = req.body as { filePath: string };
  if (!fileWatchers.has(filePath)) {
    const watcher = fs.watch(filePath, () => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const clients = fileWatchClients.get(filePath) ?? [];
        clients.forEach(c => {
          try { c.write(`data: ${JSON.stringify({ filePath, content })}\n\n`); } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
    });
    fileWatchers.set(filePath, watcher);
  }
  res.json({ success: true });
});

app.post('/api/file/unwatch', (req, res) => {
  const { filePath } = req.body as { filePath: string };
  fileWatchers.get(filePath)?.close();
  fileWatchers.delete(filePath);
  res.json({ success: true });
});

// SSE endpoint for file change events
app.get('/api/file/events', (req, res) => {
  const filePath = req.query.filePath as string;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clients = fileWatchClients.get(filePath) ?? [];
  clients.push(res);
  fileWatchClients.set(filePath, clients);

  req.on('close', () => {
    const updated = (fileWatchClients.get(filePath) ?? []).filter(c => c !== res);
    fileWatchClients.set(filePath, updated);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Project browser
// ─────────────────────────────────────────────────────────────────────────────

const JS_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);

function scanDir(dir: string, relBase: string): { name: string; path: string; relativePath: string; files: unknown[]; folders: unknown[] } {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: { name: string; path: string; relativePath: string }[] = [];
  const folders: ReturnType<typeof scanDir>[] = [];
  const IGNORE = new Set(['node_modules', '.git', '.vite', 'dist', '.next', 'build', '__pycache__']);

  for (const e of entries) {
    if (e.name.startsWith('.') && !e.name.startsWith('.env')) continue;
    if (IGNORE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = path.join(relBase, e.name);
    if (e.isDirectory()) {
      folders.push(scanDir(full, rel));
    } else if (JS_EXTENSIONS.has(path.extname(e.name))) {
      files.push({ name: e.name, path: full, relativePath: rel });
    }
  }
  return { name: path.basename(dir), path: dir, relativePath: relBase, files, folders };
}

// Project open dialog — not available in browser
app.post('/api/project/open-dialog', (_req, res) => res.json(null));

app.post('/api/project/scan', (req, res) => {
  const { rootPath } = req.body as { rootPath: string };
  try { res.json(scanDir(rootPath, '')); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

// Project watching (simple: poll the directory)
const projectWatchers = new Map<string, fs.FSWatcher>();
const projectWatchClients = new Map<string, Response[]>();

app.post('/api/project/watch', (req, res) => {
  const { rootPath } = req.body as { rootPath: string };
  if (!projectWatchers.has(rootPath)) {
    const watcher = fs.watch(rootPath, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const ext = path.extname(filename);
      if (!JS_EXTENSIONS.has(ext)) return;
      const full = path.join(rootPath, filename);
      try {
        const content = fs.readFileSync(full, 'utf-8');
        const clients = projectWatchClients.get(rootPath) ?? [];
        clients.forEach(c => {
          try { c.write(`data: ${JSON.stringify({ filePath: full, content })}\n\n`); } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
    });
    projectWatchers.set(rootPath, watcher);
  }
  res.json({ success: true });
});

app.post('/api/project/unwatch', (req, res) => {
  const { rootPath } = req.body as { rootPath: string };
  projectWatchers.get(rootPath)?.close();
  projectWatchers.delete(rootPath);
  res.json({ success: true });
});

app.get('/api/project/events', (req, res) => {
  const rootPath = req.query.rootPath as string;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clients = projectWatchClients.get(rootPath) ?? [];
  clients.push(res);
  projectWatchClients.set(rootPath, clients);

  req.on('close', () => {
    const updated = (projectWatchClients.get(rootPath) ?? []).filter(c => c !== res);
    projectWatchClients.set(rootPath, updated);
  });
});

// Recents
const RECENTS_FILE = path.join(KEY_DIR, 'recents.json');

function readRecents(): RecentProject[] {
  try { return JSON.parse(fs.readFileSync(RECENTS_FILE, 'utf-8')) as RecentProject[]; }
  catch { return []; }
}

app.get('/api/project/recents', (_req, res) => res.json(readRecents()));

app.post('/api/project/recents', (req, res) => {
  const project = req.body as RecentProject;
  const existing = readRecents().filter(p => p.rootPath !== project.rootPath);
  const updated = [project, ...existing].slice(0, 10);
  fs.mkdirSync(KEY_DIR, { recursive: true });
  fs.writeFileSync(RECENTS_FILE, JSON.stringify(updated, null, 2));
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Claude streaming  (SSE)
// ─────────────────────────────────────────────────────────────────────────────

const JSX_BLOCK_REGEX = /```(?:jsx?|tsx?)\n([\s\S]+?)```/;
function extractJsx(text: string): string | null {
  const m = JSX_BLOCK_REGEX.exec(text);
  return m ? m[1].trim() : null;
}

const SYSTEM_PROMPT = `You are an expert React and Tailwind CSS component engineer embedded in a visual design tool.

Your role is to generate and modify React functional components based on user instructions.

## Output rules
1. Always output a SINGLE, complete, self-contained React component named \`App\`.
2. Wrap the component in a markdown code block: \`\`\`jsx ... \`\`\`
3. Use only React (useState, useEffect, useRef, useCallback are available globally — do NOT import them).
4. Use Tailwind CSS utility classes for all styling. Do NOT use inline styles unless absolutely necessary.
5. Do NOT write any import or export statements — the component is injected into a pre-built environment.
6. The component must be renderable standalone — no external data, no network calls.
7. Make it visually polished and production-ready.
8. After the code block, you may add a brief explanation (1–3 sentences max).

## When modifying an existing component
- Return the COMPLETE updated component, not a diff or partial snippet.
- Preserve all existing functionality unless the user explicitly asks to remove it.
- Only change what the user requested.`;

const activeStreams = new Map<string, AbortController>();

app.post('/api/claude/stream', async (req: Request, res: Response) => {
  const { conversationId, messages, currentJsx, selection, filePath } = req.body as {
    conversationId: string;
    messages: ClaudeApiMessage[];
    currentJsx: string;
    selection: unknown;
    filePath: string | null;
  };

  // Build enriched message (same logic as ipc-handlers.ts)
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') { res.status(400).json({ error: 'No user message' }); return; }

  const contextParts: string[] = [];
  if (currentJsx) contextParts.push(`## Current component\n\`\`\`jsx\n${currentJsx}\n\`\`\``);
  if (selection) {
    const sel = selection as { descriptor: string; tagName: string; className: string; innerText: string; computedStyles: Record<string, string> };
    const styles = Object.entries(sel.computedStyles).map(([k, v]) => `  - ${k}: ${v}`).join('\n');
    contextParts.push(`## Selected element\nSelector: \`${sel.descriptor}\`\nTag: ${sel.tagName}\nClasses: ${sel.className || '(none)'}\nText content: "${sel.innerText}"\nComputed styles:\n${styles}`);
  }
  contextParts.push(`## User instruction\n${lastMessage.content}`);

  const enrichedMessages = [
    ...messages.slice(0, -1),
    { role: 'user' as const, content: contextParts.join('\n\n') },
  ];

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const controller = new AbortController();
  activeStreams.set(conversationId, controller);

  const apiKey = readKey();
  if (!apiKey) { send('error', { conversationId, error: 'No API key configured' }); res.end(); return; }

  const client = new Anthropic({ apiKey });

  try {
    const stream = await client.messages.stream(
      { model: 'claude-sonnet-4-6', max_tokens: 8192, system: SYSTEM_PROMPT, messages: enrichedMessages },
      { signal: controller.signal }
    );

    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
        send('chunk', { conversationId, text: chunk.delta.text });
      }
    }

    const jsx = extractJsx(fullText);
    let savedPath: string | null = null;
    if (jsx && filePath) {
      try { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, jsx, 'utf-8'); savedPath = filePath; } catch { /* ignore */ }
    }
    send('end', { conversationId, finalJsx: jsx, savedPath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg !== 'AbortError') send('error', { conversationId, error: msg });
    send('end', { conversationId, finalJsx: null, savedPath: null });
  } finally {
    activeStreams.delete(conversationId);
    res.end();
  }
});

app.post('/api/claude/abort', (req, res) => {
  const { conversationId } = req.body as { conversationId: string };
  activeStreams.get(conversationId)?.abort();
  activeStreams.delete(conversationId);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Claude silent patch
// ─────────────────────────────────────────────────────────────────────────────

const SILENT_PATCH_SYSTEM = `You are a JSX component patcher. Update Tailwind classes on a specific element in a React component.
Return ONLY the complete updated component wrapped in \`\`\`jsx....\`\`\`. Make no other changes. Do not explain anything.`;

app.post('/api/claude/silent-patch', async (req, res) => {
  const { currentJsx, descriptor, originalClasses, newClasses, filePath } = req.body as SilentPatchPayload;

  const apiKey = readKey();
  if (!apiKey) { res.json({ finalJsx: null }); return; }

  const client = new Anthropic({ apiKey });
  const userMessage = `Element to update: ${descriptor}\nCurrent classes: ${originalClasses}\nNew classes: ${newClasses}\n\n## Component\n\`\`\`jsx\n${currentJsx}\n\`\`\``;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20250514',
      max_tokens: 4096,
      system: SILENT_PATCH_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = response.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
    const jsx = extractJsx(text);
    if (jsx && filePath) {
      try { fs.writeFileSync(filePath, jsx, 'utf-8'); } catch { /* ignore */ }
    }
    res.json({ finalJsx: jsx });
  } catch {
    res.json({ finalJsx: null });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// App version
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/version', (_req, res) => res.json({ version: '1.0.0-dev' }));

// ─────────────────────────────────────────────────────────────────────────────
// Store — persists quill-store.json in ~/.quill-dev/
// ─────────────────────────────────────────────────────────────────────────────
const STORE_FILE = path.join(KEY_DIR, 'quill-store.json');

app.get('/api/store', (_req, res) => {
  try {
    if (!fs.existsSync(STORE_FILE)) { res.json({ data: null }); return; }
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    res.json({ data: JSON.parse(raw) });
  } catch { res.json({ data: null }); }
});

app.post('/api/store', (req, res) => {
  try {
    fs.mkdirSync(KEY_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(req.body.data, null, 2), 'utf-8');
    res.json({ success: true });
  } catch { res.json({ success: false }); }
});

// ─────────────────────────────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🖊  Quill dev server running at http://localhost:${PORT}`);
  console.log(`   Open http://localhost:5173 in Chrome after starting Vite\n`);
});
