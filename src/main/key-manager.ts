import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import type { AIProviderConfig, AIProviderType } from '../shared/types';
import { PROVIDER_DEFAULTS } from '../shared/types';

const KEY_FILE = path.join(app.getPath('userData'), 'api-key.json');
const PROVIDER_FILE = path.join(app.getPath('userData'), 'provider-config.json');

// ── Legacy key store (Anthropic only) ────────────────────────────────────────

interface LegacyKeyStore {
  anthropicApiKey: string;
}

function readLegacyStore(): LegacyKeyStore | null {
  try {
    const raw = fs.readFileSync(KEY_FILE, 'utf-8');
    return JSON.parse(raw) as LegacyKeyStore;
  } catch {
    return null;
  }
}

// ── Provider config store ─────────────────────────────────────────────────────

function readProviderConfig(): AIProviderConfig | null {
  try {
    const raw = fs.readFileSync(PROVIDER_FILE, 'utf-8');
    return JSON.parse(raw) as AIProviderConfig;
  } catch {
    return null;
  }
}

function writeProviderConfig(config: AIProviderConfig): void {
  fs.mkdirSync(path.dirname(PROVIDER_FILE), { recursive: true });
  fs.writeFileSync(PROVIDER_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the active provider config. Falls back to migrating the legacy
 * Anthropic key if no provider config exists yet.
 */
export function getProviderConfig(): AIProviderConfig | null {
  // Primary: new provider config file
  const stored = readProviderConfig();
  if (stored) return stored;

  // Migration: legacy Anthropic-only key file
  const legacy = readLegacyStore();
  if (legacy?.anthropicApiKey) {
    const migrated: AIProviderConfig = {
      provider: 'anthropic',
      apiKey: legacy.anthropicApiKey,
      model: PROVIDER_DEFAULTS.anthropic.model,
      baseUrl: PROVIDER_DEFAULTS.anthropic.baseUrl,
    };
    // Persist migrated config and keep legacy file for safety
    writeProviderConfig(migrated);
    return migrated;
  }

  return null;
}

export function setProviderConfig(config: AIProviderConfig): void {
  writeProviderConfig(config);
  // Keep process.env in sync for the Anthropic SDK path
  if (config.provider === 'anthropic' && config.apiKey) {
    process.env.ANTHROPIC_API_KEY = config.apiKey;
  }
}

export function deleteProviderConfig(): void {
  try { fs.unlinkSync(PROVIDER_FILE); } catch { /* ignore */ }
  try { fs.unlinkSync(KEY_FILE); } catch { /* ignore */ }
  delete process.env.ANTHROPIC_API_KEY;
}

/** Called at startup — loads config into process.env so the Anthropic SDK picks it up */
export function initProviderConfig(): AIProviderConfig | null {
  const config = getProviderConfig();
  if (config?.provider === 'anthropic' && config.apiKey) {
    process.env.ANTHROPIC_API_KEY = config.apiKey;
  }
  return config;
}

// ── Legacy shims (keep existing IPC working during transition) ────────────────

export function getApiKey(): string | null {
  const config = getProviderConfig();
  if (config?.provider === 'anthropic') return config.apiKey ?? null;
  return null;
}

export function setApiKey(key: string): void {
  // Write both legacy file and new provider config
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify({ anthropicApiKey: key }, null, 2), 'utf-8');
  setProviderConfig({
    provider: 'anthropic',
    apiKey: key,
    model: PROVIDER_DEFAULTS.anthropic.model,
    baseUrl: PROVIDER_DEFAULTS.anthropic.baseUrl,
  });
}

export function deleteApiKey(): void {
  deleteProviderConfig();
}

export async function validateApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
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

/** Validate any provider config by attempting a real API call */
export async function validateProviderConfig(
  config: AIProviderConfig
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (config.provider === 'anthropic') {
      return validateApiKey(config.apiKey ?? '');
    }

    // OpenAI-compatible providers: try GET /v1/models
    const baseUrl = (config.baseUrl ?? '').replace(/\/$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

    const res = await fetch(`${baseUrl}/models`, { method: 'GET', headers });
    if (res.ok) return { valid: true };

    // Some local servers (LM Studio) don't implement /models — try a minimal
    // chat completion instead
    const chatRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model ?? 'local-model',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    });
    if (chatRes.ok || chatRes.status === 400) return { valid: true }; // 400 = server reachable
    return { valid: false, error: `HTTP ${chatRes.status}` };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Could not connect' };
  }
}
