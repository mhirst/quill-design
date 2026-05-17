/**
 * useProjectStore — persists all projects to Electron's userData via IPC.
 *
 * Store shape on disk:
 * {
 *   version: 1,
 *   projects: ProjectData[]
 * }
 *
 * Each project holds its pages (with shapes), name, and chat history.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Shape, ComponentDef } from '../lib/shapes';
import type { Page } from './usePages';
import type { ChatMessage } from '@shared/types';

export interface ProjectData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  pages: Page[];
  activePageId: string;
  chatHistory: ChatMessage[];
  components: ComponentDef[];
}

export type { ComponentDef };

interface StoreShape {
  version: 1;
  projects: ProjectData[];
  activeProjectId: string | null;
}

function makeProject(name = 'Untitled Project'): ProjectData {
  const pageId = uuid();
  return {
    id: uuid(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [{ id: pageId, name: 'Page 1', shapes: [] }],
    activePageId: pageId,
    chatHistory: [],
    components: [],
  };
}

function defaultStore(): StoreShape {
  const p = makeProject();
  return { version: 1, projects: [p], activeProjectId: p.id };
}

// ── Storage helpers (IPC or localStorage fallback) ───────────────────────────

function getStoreApi() {
  const api = (window as unknown as Record<string, unknown>).api as (typeof window.api & {
    storeRead?: () => Promise<{ data: unknown }>;
    storeWrite?: (data: unknown) => Promise<{ success: boolean }>;
  }) | undefined;
  if (api?.storeRead && api?.storeWrite) return api;
  return null;
}

function localStorageRead(): { data: unknown } {
  try {
    const raw = localStorage.getItem('quill-store');
    return { data: raw ? JSON.parse(raw) : null };
  } catch {
    return { data: null };
  }
}

function localStorageWrite(data: unknown) {
  try { localStorage.setItem('quill-store', JSON.stringify(data)); } catch { /* ignore */ }
}

// Debounce writes to avoid hammering disk on every shape drag
function useDebouncedWrite() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((store: StoreShape) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const api = getStoreApi();
      if (api) api.storeWrite!(store);
      else localStorageWrite(store);
    }, 800);
  }, []);
}

export function useProjectStore() {
  const [store, setStore] = useState<StoreShape | null>(null); // null = loading
  const storeRef = useRef<StoreShape | null>(null);
  storeRef.current = store;
  const debouncedWrite = useDebouncedWrite();

  // Load on mount
  useEffect(() => {
    const api = getStoreApi();
    if (!api) {
      // localStorage fallback (browser dev mode without IPC storeRead/storeWrite)
      const { data } = localStorageRead();
      if (!data) { setStore(defaultStore()); return; }
      const raw = data as StoreShape;
      if (!raw.projects || raw.projects.length === 0) { setStore(defaultStore()); return; }
      const projects = raw.projects.map(p => ({
        ...p,
        pages: (p.pages ?? []).map(pg => ({ ...pg, shapes: pg.shapes ?? [] })),
        chatHistory: p.chatHistory ?? [],
        components: p.components ?? [],
      }));
      const active = raw.activeProjectId && projects.find(p => p.id === raw.activeProjectId)
        ? raw.activeProjectId : projects[0].id;
      setStore({ version: 1, projects, activeProjectId: active });
      return;
    }
    api.storeRead!().then(({ data }) => {
      if (!data) {
        setStore(defaultStore());
        return;
      }
      const raw = data as StoreShape;
      // Migrate / validate
      if (!raw.projects || raw.projects.length === 0) {
        setStore(defaultStore());
        return;
      }
      // Ensure all shapes arrays exist
      const projects = raw.projects.map(p => ({
        ...p,
        pages: (p.pages ?? []).map(pg => ({ ...pg, shapes: pg.shapes ?? [] })),
        chatHistory: p.chatHistory ?? [],
        components: p.components ?? [],
      }));
      // Validate activeProjectId
      const active = raw.activeProjectId && projects.find(p => p.id === raw.activeProjectId)
        ? raw.activeProjectId
        : projects[0].id;
      setStore({ version: 1, projects, activeProjectId: active });
    });
  }, []);

  // Internal updater — modifies store and schedules a write
  const update = useCallback((fn: (prev: StoreShape) => StoreShape) => {
    setStore(prev => {
      if (!prev) return prev;
      const next = fn(prev);
      storeRef.current = next;
      debouncedWrite(next);
      return next;
    });
  }, [debouncedWrite]);

  // ── Project CRUD ──────────────────────────────────────────────────────────

  const createProject = useCallback((name?: string) => {
    const p = makeProject(name);
    update(s => ({
      ...s,
      projects: [...s.projects, p],
      activeProjectId: p.id,
    }));
    return p;
  }, [update]);

  const deleteProject = useCallback((projectId: string) => {
    update(s => {
      const remaining = s.projects.filter(p => p.id !== projectId);
      if (remaining.length === 0) {
        const fresh = makeProject();
        return { ...s, projects: [fresh], activeProjectId: fresh.id };
      }
      const newActive = s.activeProjectId === projectId
        ? remaining[remaining.length - 1].id
        : s.activeProjectId;
      return { ...s, projects: remaining, activeProjectId: newActive };
    });
  }, [update]);

  const renameProject = useCallback((projectId: string, name: string) => {
    update(s => ({
      ...s,
      projects: s.projects.map(p => p.id === projectId ? { ...p, name, updatedAt: Date.now() } : p),
    }));
  }, [update]);

  const switchProject = useCallback((projectId: string) => {
    update(s => ({ ...s, activeProjectId: projectId }));
  }, [update]);

  // ── Shape / page persistence for active project ───────────────────────────

  const saveProjectState = useCallback((
    projectId: string,
    pages: Page[],
    activePageId: string,
    chatHistory: ChatMessage[],
  ) => {
    update(s => ({
      ...s,
      projects: s.projects.map(p =>
        p.id === projectId
          ? { ...p, pages, activePageId, chatHistory, updatedAt: Date.now() }
          : p
      ),
    }));
  }, [update]);

  const saveComponents = useCallback((
    projectId: string,
    components: ComponentDef[],
  ) => {
    update(s => ({
      ...s,
      projects: s.projects.map(p =>
        p.id === projectId
          ? { ...p, components, updatedAt: Date.now() }
          : p
      ),
    }));
  }, [update]);

  const activeProject = store?.projects.find(p => p.id === store.activeProjectId) ?? null;

  return {
    loading: store === null,
    projects: store?.projects ?? [],
    activeProjectId: store?.activeProjectId ?? null,
    activeProject,
    createProject,
    deleteProject,
    renameProject,
    switchProject,
    saveProjectState,
    saveComponents,
  };
}

// Helpers exported for other modules
export type { Page };
export { makeProject };
