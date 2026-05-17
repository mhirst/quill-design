/**
 * useAppSettings — lightweight persistent settings for app-level prefs.
 *
 * Backed by Electron userData (quill-settings.json via IPC STORE_READ/WRITE
 * on a separate key) or localStorage as fallback.
 *
 * Settings object is merged on update so callers only provide the keys they
 * want to change.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AppSettings {
  /** User has dismissed the canvas empty-state overlay — never show again */
  dismissedEmptyState?: boolean;
  /** Theme override (light / dark / system) */
  theme?: 'light' | 'dark' | 'system';
}

const STORAGE_KEY = 'quill-app-settings';

// ── Storage helpers ───────────────────────────────────────────────────────────

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppSettings) : {};
  } catch {
    return {};
  }
}

function writeSettings(s: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Persist on every change
  useEffect(() => {
    writeSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      settingsRef.current = next;
      writeSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}
