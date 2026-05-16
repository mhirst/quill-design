import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectFolder, RecentProject, ProjectFileChangedPayload } from '@shared/types';

export interface ProjectState {
  rootPath: string | null;
  name: string | null;
  tree: ProjectFolder | null;
  recentProjects: RecentProject[];
}

interface UseProjectBrowserOptions {
  onFileChanged: (filePath: string, content: string) => void;
}

export function useProjectBrowser({ onFileChanged }: UseProjectBrowserOptions) {
  const [state, setState] = useState<ProjectState>({
    rootPath: null,
    name: null,
    tree: null,
    recentProjects: [],
  });

  const currentRootRef = useRef<string | null>(null);

  // Load recent projects on mount
  useEffect(() => {
    window.api.getRecentProjects().then((recents) => {
      setState((prev) => ({ ...prev, recentProjects: recents }));
    });
  }, []);

  // Subscribe to external file changes
  useEffect(() => {
    const unsub = window.api.onProjectFileChanged((data: ProjectFileChangedPayload) => {
      onFileChanged(data.filePath, data.content);
    });
    return unsub;
  }, [onFileChanged]);

  const openProject = useCallback(async () => {
    const result = await window.api.openProject();
    if (!result) return null;

    const { rootPath } = result;
    return loadProject(rootPath);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProject = useCallback(async (rootPath: string) => {
    // Stop watching previous project
    if (currentRootRef.current && currentRootRef.current !== rootPath) {
      await window.api.unwatchProject(currentRootRef.current);
    }

    const name = rootPath.split(/[\\/]/).pop() ?? rootPath;
    const tree = await window.api.scanProject(rootPath);
    await window.api.watchProject(rootPath);

    currentRootRef.current = rootPath;

    const recent: RecentProject = { rootPath, name, lastOpened: Date.now() };
    await window.api.addRecentProject(recent);
    const recents = await window.api.getRecentProjects();

    setState({ rootPath, name, tree, recentProjects: recents });
    return { rootPath, name, tree };
  }, []);

  const closeProject = useCallback(async () => {
    if (currentRootRef.current) {
      await window.api.unwatchProject(currentRootRef.current);
      currentRootRef.current = null;
    }
    setState((prev) => ({ ...prev, rootPath: null, name: null, tree: null }));
  }, []);

  const refreshTree = useCallback(async () => {
    if (!currentRootRef.current) return;
    const tree = await window.api.scanProject(currentRootRef.current);
    setState((prev) => ({ ...prev, tree }));
  }, []);

  const readFile = useCallback(async (filePath: string): Promise<string | null> => {
    try {
      const result = await window.api.readFile(filePath);
      return result.content;
    } catch {
      return null;
    }
  }, []);

  return {
    ...state,
    openProject,
    loadProject,
    closeProject,
    refreshTree,
    readFile,
  };
}
