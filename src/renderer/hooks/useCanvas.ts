import { useCallback, useEffect, useRef, useState } from 'react';
import type { ElementSelection } from '@shared/types';
import { buildSandboxDataUri } from '../lib/sandbox-template';

export function useCanvas() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentJsx, setCurrentJsx] = useState<string>('');
  const [dataUri, setDataUri] = useState<string>('');
  const [selection, setSelection] = useState<ElementSelection | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  // Rebuild data URI whenever JSX changes
  useEffect(() => {
    if (!currentJsx) {
      setDataUri('');
      return;
    }
    setDataUri(buildSandboxDataUri(currentJsx));
  }, [currentJsx]);

  // Listen for postMessages from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // data URI iframes have origin === 'null'
      if (e.origin !== 'null' && e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'ELEMENT_SELECTED') {
        setSelection(e.data.payload as ElementSelection);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Send selection mode to iframe (called after iframe loads and on mode toggle)
  const sendSelectionMode = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: selectionMode ? 'ENABLE_SELECTION_MODE' : 'DISABLE_SELECTION_MODE' },
      '*'
    );
  }, [selectionMode]);

  // When mode toggles while iframe is already loaded, update it immediately
  useEffect(() => {
    sendSelectionMode();
  }, [selectionMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadJsx = useCallback((jsx: string) => {
    setSelection(null);
    setCurrentJsx(jsx);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'CLEAR_SELECTION' }, '*');
    }
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setSelection(null);
  }, []);

  return {
    iframeRef,
    dataUri,
    currentJsx,
    loadJsx,
    selection,
    clearSelection,
    selectionMode,
    toggleSelectionMode,
    onIframeLoad: sendSelectionMode,
  };
}
