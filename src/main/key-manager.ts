import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const KEY_FILE = path.join(app.getPath('userData'), 'api-key.json');

interface KeyStore {
  anthropicApiKey: string;
}

function readStore(): KeyStore | null {
  try {
    const raw = fs.readFileSync(KEY_FILE, 'utf-8');
    return JSON.parse(raw) as KeyStore;
  } catch {
    return null;
  }
}

function writeStore(store: KeyStore) {
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export function getApiKey(): string | null {
  // Env var wins (dev mode / CI)
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  // Load from file store and populate env so the Anthropic SDK picks it up
  const stored = readStore()?.anthropicApiKey ?? null;
  if (stored) process.env.ANTHROPIC_API_KEY = stored;
  return stored;
}

export function setApiKey(key: string): void {
  writeStore({ anthropicApiKey: key });
  // Also set on process.env so the Claude client picks it up immediately
  process.env.ANTHROPIC_API_KEY = key;
}

export function deleteApiKey(): void {
  try { fs.unlinkSync(KEY_FILE); } catch { /* ignore */ }
  delete process.env.ANTHROPIC_API_KEY;
}

export async function validateApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Minimal API call — list models, very cheap
    const res = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
    });
    if (res.ok) return { valid: true };
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    return { valid: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
