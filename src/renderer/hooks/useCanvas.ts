import { useCallback, useEffect, useRef, useState } from 'react';
import type { ElementSelection } from '@shared/types';
import { buildSandboxDataUri } from '../lib/sandbox-template';
import { patchTailwindClass } from '../lib/utils';

export interface LayerNode {
  tag: string;
  id: string | null;
  className: string;
  path: string;
  children: LayerNode[];
}

export interface DragEndPayload {
  dx: number;
  dy: number;
  className: string;
  descriptor: string;
}

export function useCanvas() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentJsx, setCurrentJsx] = useState<string>('');
  const [dataUri, setDataUri] = useState<string>('');
  const [selection, setSelection] = useState<ElementSelection | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [layerTree, setLayerTree] = useState<LayerNode | null>(null);
  const onDragEndRef = useRef<((payload: DragEndPayload) => void) | null>(null);

  // Rebuild data URI whenever JSX changes
  useEffect(() => {
    if (!currentJsx) {
      setDataUri('');
      setLayerTree(null);
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

      if (e.data.type === 'LAYER_TREE_RESPONSE') {
        setLayerTree(e.data.tree as LayerNode);
      }

      if (e.data.type === 'ELEMENT_DRAG_END') {
        onDragEndRef.current?.(e.data as DragEndPayload);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Send selection mode to iframe
  const sendSelectionMode = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: selectionMode ? 'ENABLE_SELECTION_MODE' : 'DISABLE_SELECTION_MODE' },
      '*'
    );
  }, [selectionMode]);

  useEffect(() => {
    sendSelectionMode();
  }, [selectionMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Request layer tree from iframe (called after load)
  const requestLayerTree = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    // Small delay to let React render inside iframe
    setTimeout(() => {
      iframe.contentWindow?.postMessage({ type: 'GET_LAYER_TREE' }, '*');
    }, 200);
  }, []);

  const highlightByPath = useCallback((nodePath: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'HIGHLIGHT_BY_PATH', path: nodePath }, '*');
  }, []);

  const patchElementClasses = useCallback((descriptor: string, newClasses: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'PATCH_ELEMENT_CLASSES', descriptor, newClasses }, '*');
  }, []);

  const loadJsx = useCallback((jsx: string) => {
    setSelection(null);
    setLayerTree(null);
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

  const onIframeLoad = useCallback(() => {
    sendSelectionMode();
    requestLayerTree();
  }, [sendSelectionMode, requestLayerTree]);

  const setOnDragEnd = useCallback((fn: (payload: DragEndPayload) => void) => {
    onDragEndRef.current = fn;
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
    onIframeLoad,
    layerTree,
    requestLayerTree,
    highlightByPath,
    patchElementClasses,
    setOnDragEnd,
  };
}
