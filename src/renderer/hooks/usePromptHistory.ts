/**
 * usePromptHistory — persists sent prompts to localStorage so users can
 * cycle through them with ArrowUp / ArrowDown (terminal-style).
 *
 * Newest prompt is at index 0.  Capacity is capped at MAX_ENTRIES.
 */

const STORAGE_KEY = 'quill-prompt-history';
const MAX_ENTRIES = 50;

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable — silently skip
  }
}

export function usePromptHistory() {
  /** Add a new entry.  Deduplicates consecutive identical prompts. */
  function push(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const current = read();
    // Don't duplicate if the most recent entry is the same text
    if (current[0] === trimmed) return;
    const next = [trimmed, ...current].slice(0, MAX_ENTRIES);
    write(next);
  }

  /** Get the full history array (newest first). */
  function getAll(): string[] {
    return read();
  }

  /** Clear all history. */
  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ok */ }
  }

  return { push, getAll, clear };
}
