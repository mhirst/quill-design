import { useCallback, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Shape } from '../lib/shapes';

export interface Page {
  id: string;
  name: string;
  shapes: Shape[];
}

function makePage(name: string): Page {
  return { id: uuid(), name, shapes: [] };
}

export function usePages(initialPages?: Page[], initialActivePageId?: string) {
  const [state, setState] = useState<{ pages: Page[]; activePageId: string }>(() => {
    if (initialPages && initialPages.length > 0) {
      const activeId = initialActivePageId && initialPages.find(p => p.id === initialActivePageId)
        ? initialActivePageId
        : initialPages[0].id;
      return { pages: initialPages, activePageId: activeId };
    }
    const first = makePage('Page 1');
    return { pages: [first], activePageId: first.id };
  });

  const activePage = state.pages.find(p => p.id === state.activePageId) ?? state.pages[0];

  /** Save shapes for the current page and switch to a new page */
  const switchPage = useCallback((
    pageId: string,
    currentShapes: Shape[],
    onLoad: (shapes: Shape[]) => void
  ) => {
    setState(prev => {
      // Save current shapes into current page
      const saved = prev.pages.map(p =>
        p.id === prev.activePageId ? { ...p, shapes: currentShapes } : p
      );
      // Load new page's shapes
      const next = saved.find(p => p.id === pageId);
      if (next) onLoad(next.shapes);
      return { pages: saved, activePageId: pageId };
    });
  }, []);

  /** Save shapes for the current page without switching */
  const saveCurrentPageShapes = useCallback((shapes: Shape[]) => {
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p =>
        p.id === prev.activePageId ? { ...p, shapes } : p
      ),
    }));
  }, []);

  const addPage = useCallback((
    currentShapes: Shape[],
    onLoad: (shapes: Shape[]) => void
  ) => {
    const newPage = makePage(`Page ${Date.now() % 1000}`); // temp name, renamed below
    setState(prev => {
      // Save current page shapes
      const savedPages = prev.pages.map(p =>
        p.id === prev.activePageId ? { ...p, shapes: currentShapes } : p
      );
      const count = savedPages.length + 1;
      const named: Page = { ...newPage, name: `Page ${count}` };
      const next = [...savedPages, named];
      onLoad([]);
      return { pages: next, activePageId: named.id };
    });
  }, []);

  const renamePage = useCallback((pageId: string, name: string) => {
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === pageId ? { ...p, name } : p),
    }));
  }, []);

  const deletePage = useCallback((
    pageId: string,
    currentShapes: Shape[],
    onLoad: (shapes: Shape[]) => void
  ) => {
    setState(prev => {
      if (prev.pages.length <= 1) return prev; // can't delete last page
      // Save current shapes before deleting
      const saved = prev.pages.map(p =>
        p.id === prev.activePageId ? { ...p, shapes: currentShapes } : p
      );
      const filtered = saved.filter(p => p.id !== pageId);
      // If we deleted the active page, switch to the first remaining page
      let newActiveId = prev.activePageId;
      if (pageId === prev.activePageId) {
        newActiveId = filtered[0].id;
        onLoad(filtered[0].shapes);
      }
      return { pages: filtered, activePageId: newActiveId };
    });
  }, []);

  return {
    pages: state.pages,
    activePageId: state.activePageId,
    activePage,
    switchPage,
    saveCurrentPageShapes,
    addPage,
    renamePage,
    deletePage,
  };
}
