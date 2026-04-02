import { useCallback, useEffect, useRef, useState } from 'react';

export function useFileManager() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [externalChangeCount, setExternalChangeCount] = useState(0);
  const [externalContent, setExternalContent] = useState<string | null>(null);
  const unwatchRef = useRef<(() => void) | null>(null);

  // Subscribe to external file changes
  useEffect(() => {
    const unsubscribe = window.api.onFileChanged((data) => {
      setExternalContent(data.content);
      setExternalChangeCount((c) => c + 1);
    });
    return unsubscribe;
  }, []);

  const openFile = useCallback(async () => {
    const result = await window.api.openFile();
    if (!result) return null;

    // Unwatch previous file
    if (filePath && unwatchRef.current) {
      unwatchRef.current();
      unwatchRef.current = null;
      await window.api.unwatchFile(filePath);
    }

    setFilePath(result.filePath);
    await window.api.watchFile(result.filePath);
    unwatchRef.current = () => window.api.unwatchFile(result.filePath);

    return result;
  }, [filePath]);

  const saveFile = useCallback(
    async (content: string): Promise<string | null> => {
      if (filePath) {
        await window.api.saveFile(filePath, content);
        return filePath;
      }
      // No path yet — trigger save-as
      const result = await window.api.saveFileAs('component.jsx');
      if (!result) return null;

      setFilePath(result.filePath);
      await window.api.saveFile(result.filePath, content);
      await window.api.watchFile(result.filePath);
      unwatchRef.current = () => window.api.unwatchFile(result.filePath);

      return result.filePath;
    },
    [filePath]
  );

  const saveFileAs = useCallback(
    async (content: string): Promise<string | null> => {
      const result = await window.api.saveFileAs('component.jsx');
      if (!result) return null;

      // Stop watching old path
      if (filePath) {
        await window.api.unwatchFile(filePath);
      }

      setFilePath(result.filePath);
      await window.api.saveFile(result.filePath, content);
      await window.api.watchFile(result.filePath);
      unwatchRef.current = () => window.api.unwatchFile(result.filePath);

      return result.filePath;
    },
    [filePath]
  );

  const clearFile = useCallback(async () => {
    if (filePath) {
      await window.api.unwatchFile(filePath);
    }
    setFilePath(null);
    setExternalContent(null);
  }, [filePath]);

  return {
    filePath,
    openFile,
    saveFile,
    saveFileAs,
    clearFile,
    externalChangeCount,
    externalContent,
  };
}
