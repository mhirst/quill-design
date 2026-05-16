import { useCallback, useEffect, useRef, useState } from 'react';
import { analytics } from './lib/analytics';
import { v4 as uuid } from 'uuid';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import { CanvasPane } from './components/canvas/CanvasPane';
import { CanvasOverlay } from './components/canvas/CanvasOverlay';
import { ChatBar } from './components/chat/ChatBar';
import { ToolSidebar, type Tool } from './components/layout/ToolSidebar';
import { LeftPanel, type LeftTab } from './components/layout/LeftPanel';
import { InspectPanel } from './components/inspect/InspectPanel';
import { ShapeInspectPanel } from './components/inspect/ShapeInspectPanel';
import { useCanvas } from './hooks/useCanvas';
import { useChat } from './hooks/useChat';
import { useFileManager } from './hooks/useFileManager';
import { useProjectBrowser } from './hooks/useProjectBrowser';
import { useSilentPatch } from './hooks/useSilentPatch';
import { useDrawingTools } from './hooks/useDrawingTools';
import { usePages } from './hooks/usePages';
import { useProjectStore } from './hooks/useProjectStore';
import { patchTailwindClass as patchTailwindClassLocal } from './lib/utils';
import { defaultShape } from './lib/shapes';
import type { Shape } from './lib/shapes';
import { ExportToolbar } from './components/canvas/ExportToolbar';
import { ChevronRight, Plus, X } from 'lucide-react';
import type { ChatMessage } from '@shared/types';

export default function App() {
  const [apiKeyReady, setApiKeyReady] = useState<boolean | null>(null);

  useEffect(() => {
    const api = (window as unknown as Record<string, unknown>).api as typeof window.api | undefined;
    if (!api) { setApiKeyReady(true); return; }
    api.getApiKey().then(({ hasKey }) => setApiKeyReady(hasKey)).catch(() => setApiKeyReady(true));
  }, []);

  if (apiKeyReady === null) return null;
  if (!apiKeyReady) return <OnboardingScreen onComplete={() => setApiKeyReady(true)} />;
  return <AppShell />;
}

// ─────────────────────────────────────────────────────────────────────────────
// AppShell — wraps project store and renders the tab bar + active project
// ─────────────────────────────────────────────────────────────────────────────

function AppShell() {
  const store = useProjectStore();

  if (store.loading) {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--subtle)', fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
      {/* Project tab bar + title */}
      <ProjectTabBar store={store} />

      {/* Active project workspace */}
      {store.activeProject && (
        <ProjectWorkspace
          key={store.activeProject.id}
          projectId={store.activeProject.id}
          initialProject={store.activeProject}
          onSave={store.saveProjectState}
          onRename={store.renameProject}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectTabBar
// ─────────────────────────────────────────────────────────────────────────────

function ProjectTabBar({ store }: { store: ReturnType<typeof useProjectStore> }) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const startRename = (id: string, name: string) => {
    setRenamingId(id);
    setRenameVal(name);
  };

  const commitRename = (id: string) => {
    if (renameVal.trim()) store.renameProject(id, renameVal.trim());
    setRenamingId(null);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      height: 38,
      background: 'var(--panel)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      paddingLeft: 8,
      gap: 0,
      // macOS inset traffic lights — leave space
      paddingTop: 0,
      WebkitAppRegion: 'drag',
    } as React.CSSProperties}>
      {/* App name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        paddingRight: 16,
        paddingLeft: 8,
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--accent)',
        letterSpacing: '-0.01em',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}>
        Quill
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        flex: 1,
        overflow: 'hidden',
        gap: 2,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        {store.projects.map(p => {
          const isActive = p.id === store.activeProjectId;
          return (
            <div
              key={p.id}
              onClick={() => store.switchProject(p.id)}
              onDoubleClick={() => startRename(p.id, p.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 12,
                paddingRight: 6,
                minWidth: 100,
                maxWidth: 200,
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                background: isActive ? 'rgba(99,102,241,0.06)' : 'transparent',
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              {renamingId === p.id ? (
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => commitRename(p.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(p.id);
                    if (e.key === 'Escape') setRenamingId(null);
                    e.stopPropagation();
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: '1px solid var(--accent)',
                    color: 'var(--text)',
                    fontSize: 12,
                    width: '100%',
                    borderRadius: 3,
                    padding: '1px 4px',
                  }}
                />
              ) : (
                <span style={{
                  fontSize: 12,
                  color: isActive ? 'var(--text)' : 'var(--muted)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {p.name}
                </span>
              )}
              {store.projects.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); store.deleteProject(p.id); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', padding: '2px', borderRadius: 3,
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    opacity: isActive ? 1 : 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--error)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = isActive ? '1' : '0'; e.currentTarget.style.color = 'var(--muted)'; }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}

        {/* New project button */}
        <button
          onClick={() => store.createProject()}
          title="New project"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectWorkspace — one full editor for a single project
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceProps {
  projectId: string;
  initialProject: import('./hooks/useProjectStore').ProjectData;
  onSave: (
    projectId: string,
    pages: import('./hooks/usePages').Page[],
    activePageId: string,
    chatHistory: ChatMessage[],
  ) => void;
  onRename: (projectId: string, name: string) => void;
}

function ProjectWorkspace({ projectId, initialProject, onSave, onRename }: WorkspaceProps) {
  const canvas = useCanvas();
  const fileManager = useFileManager();
  const [activeTool, setActiveTool] = useState<Tool>('cursor');

  // Track app opened once per workspace mount
  useEffect(() => { analytics.track('app_opened'); }, []);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  // Left panel state
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>('layers');

  // Right panel collapse
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Track whether the iframe content came from Claude
  const [hasClaudeContent, setHasClaudeContent] = useState(false);

  // Project browser
  const project = useProjectBrowser({
    onFileChanged: useCallback((filePath: string, content: string) => {
      if (filePath === activeFilePath) canvas.loadJsx(content);
    }, [activeFilePath, canvas.loadJsx]),
  });

  // Pages — initialise from persisted data
  const pages = usePages(initialProject.pages, initialProject.activePageId);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // Drawing tools
  const drawing = useDrawingTools(
    useCallback((jsx: string, shapes: Shape[]) => {
      canvas.loadJsx(jsx);
      pagesRef.current.saveCurrentPageShapes(shapes);
    }, [canvas.loadJsx])
  );

  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  // Initialise drawing from the active page's persisted shapes
  const initDoneRef = useRef(false);
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;
    const activePage = initialProject.pages.find(p => p.id === initialProject.activePageId);
    if (activePage && activePage.shapes.length > 0) {
      drawing.loadShapes(activePage.shapes);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat — restore history from persisted data
  const [chatHistoryInit] = useState<ChatMessage[]>(() => initialProject.chatHistory ?? []);
  const chatHistoryRef = useRef<ChatMessage[]>(chatHistoryInit);

  // ── Stable refs ──────────────────────────────────────────────────────────
  const handleSaveRef = useRef<() => void>(() => {});
  const handleSaveAsRef = useRef<() => void>(() => {});
  const handleNewDocRef = useRef<() => void>(() => {});
  const canvasRef = useRef(canvas);
  const fileManagerRef = useRef(fileManager);
  const projectRef = useRef(project);
  const clearDrawingRef = useRef<() => void>(() => {});

  canvasRef.current = canvas;
  fileManagerRef.current = fileManager;
  projectRef.current = project;
  clearDrawingRef.current = drawing.clearAll;

  // ── Persist state on every meaningful change ──────────────────────────────
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    saveRef.current(
      projectId,
      pagesRef.current.pages,
      pagesRef.current.activePageId,
      chatHistoryRef.current,
    );
  // Trigger when drawing shapes change — via historyVersion proxy
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing.historyEntries, pages.pages, pages.activePageId]);

  // ── AI frame-wrapping ─────────────────────────────────────────────────────
  /**
   * When AI produces JSX:
   * - If a frame is selected → update that frame's iframeJsx (re-use existing frame)
   * - Otherwise → create a new frame shape positioned to the right of existing AI frames
   */
  const handleJsxReady = useCallback((jsx: string) => {
    const d = drawingRef.current;
    const { shapes, selectedId } = d.state;
    const sel = shapes.find(s => s.id === selectedId);

    if (sel && sel.type === 'frame') {
      // Embed into the selected frame
      d.updateShape(sel.id, { iframeJsx: jsx });
      // Sync updated shapes to the page so iframeJsx persists across tab switches
      const updatedShapes = d.state.shapes.map(s => s.id === sel.id ? { ...s, iframeJsx: jsx } : s);
      pagesRef.current.saveCurrentPageShapes(updatedShapes);
      canvas.loadJsx(jsx);
      setHasClaudeContent(true);
      return;
    }

    // Auto-place: right of existing AI frames
    const aiFrames = shapes.filter(s => s.iframeJsx);
    let newX = 80;
    let newY = 80;
    if (aiFrames.length > 0) {
      const rightmost = aiFrames.reduce((best, s) => s.x + s.width > best.x + best.width ? s : best, aiFrames[0]);
      newX = rightmost.x + rightmost.width + 40;
      newY = rightmost.y;
    }

    const frame = defaultShape('frame', uuid());
    frame.x = newX;
    frame.y = newY;
    frame.width = 600;
    frame.height = 440;
    frame.name = 'AI Frame';
    frame.iframeJsx = jsx;

    d.addShape(frame);
    canvas.loadJsx(jsx);
    setHasClaudeContent(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.loadJsx]);

  const getCurrentJsx = useCallback(() => canvas.currentJsx, [canvas.currentJsx]);
  const getSelection = useCallback(() => canvas.selection, [canvas.selection]);
  const getFilePath = useCallback(() => fileManager.filePath ?? activeFilePath, [fileManager.filePath, activeFilePath]);
  const getSelectedFrameName = useCallback(() => {
    const { shapes, selectedId } = drawingRef.current.state;
    const sel = shapes.find(s => s.id === selectedId);
    return (sel?.type === 'frame') ? sel.name : null;
  }, []);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const chat = useChat({
    onJsxReady: handleJsxReady,
    getCurrentJsx,
    getSelection,
    getFilePath,
    getSelectedFrameName,
    initialMessages: chatHistoryInit,
    onMessagesChange: useCallback((msgs: ChatMessage[]) => {
      chatHistoryRef.current = msgs;
    }, []),
  });

  const silentPatch = useSilentPatch({
    getCurrentJsx,
    getFilePath,
    onJsxReady: canvas.loadJsx,
    onOptimisticPatch: canvas.patchElementClasses,
  });

  // ── Drag-to-move → margin patch ───────────────────────────────────────────
  useEffect(() => {
    canvas.setOnDragEnd(({ dx, dy, className }) => {
      if (!canvas.selection) return;
      const sel = canvas.selection;
      let newClasses = className;
      if (Math.abs(dx) > 2) newClasses = patchTailwindClassLocal(newClasses, dx > 0 ? `ml-[${dx}px]` : `-ml-[${Math.abs(dx)}px]`);
      if (Math.abs(dy) > 2) newClasses = patchTailwindClassLocal(newClasses, dy > 0 ? `mt-[${dy}px]` : `-mt-[${Math.abs(dy)}px]`);
      silentPatch.patch(sel, newClasses);
    });
  }, [canvas, silentPatch]);

  // ── Tool change ───────────────────────────────────────────────────────────
  const handleToolChange = useCallback((tool: Tool) => {
    if (tool !== 'pen') drawingRef.current.penCancel();
    setActiveTool(tool);
    const c = canvasRef.current;
    if (tool === 'select') { if (!c.selectionMode) c.toggleSelectionMode(); }
    else { if (c.selectionMode) c.toggleSelectionMode(); }
    if (tool !== 'cursor') drawingRef.current.select(null);
    analytics.track('tool_selected', { tool });
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod) {
        switch (e.key.toLowerCase()) {
          case 's': e.preventDefault(); if (e.shiftKey) handleSaveAsRef.current(); else handleSaveRef.current(); return;
          case 'n': e.preventDefault(); handleNewDocRef.current(); return;
          case 'a': { e.preventDefault(); const d = drawingRef.current; if (d.state.shapes.length === 0) return; d.selectAll(); setActiveTool('cursor'); return; }
          case 'g': e.preventDefault(); if (e.shiftKey) drawingRef.current.ungroup(); else drawingRef.current.group(); return;
          case 'z': e.preventDefault(); if (e.shiftKey) drawingRef.current.redo(); else drawingRef.current.undo(); return;
          case 'y': e.preventDefault(); drawingRef.current.redo(); return;
          case 'c': e.preventDefault(); drawingRef.current.copy(); return;
          case 'v': e.preventDefault(); drawingRef.current.paste(); return;
          case 'd': e.preventDefault(); drawingRef.current.duplicate(); return;
          case ']': e.preventDefault(); drawingRef.current.bringToFront(); return;
          case '[': e.preventDefault(); drawingRef.current.sendToBack(); return;
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('cursor'); break;
        case 's': handleToolChange('select'); break;
        case 'h': setActiveTool('pan'); break;
        case 'f': setActiveTool('frame'); break;
        case 'r': setActiveTool('rectangle'); break;
        case 'o': setActiveTool('ellipse'); break;
        case 't': setActiveTool('text'); break;
        case 'p': setActiveTool('pen'); break;
        case 'delete':
        case 'backspace': drawingRef.current.deleteSelected(); break;
        case 'escape':
          drawingRef.current.select(null);
          drawingRef.current.setSelectedIds([]);
          if (activeTool !== 'cursor') setActiveTool('cursor');
          break;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const d = drawingRef.current;
        const sel = d.state.selectedId;
        if (!sel) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const shape = d.state.shapes.find(s => s.id === sel);
        if (!shape) return;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft')  dx = -step;
        if (e.key === 'ArrowRight') dx = +step;
        if (e.key === 'ArrowUp')    dy = -step;
        if (e.key === 'ArrowDown')  dy = +step;
        // Path shapes: also translate all points
        let patch: Partial<Shape> = { x: shape.x + dx, y: shape.y + dy };
        if (shape.type === 'path' && shape.points) {
          patch = { ...patch, points: shape.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        }
        d.updateShape(sel, patch);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, handleToolChange]);

  // ── File actions ───────────────────────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    const result = await fileManagerRef.current.openFile();
    if (!result) return;
    canvasRef.current.loadJsx(result.content);
    setActiveFilePath(result.filePath);
    setHasClaudeContent(true);
    chat.reset();
    drawingRef.current.clearAll();
  }, [chat.reset]);

  const handleSave = useCallback(async () => {
    const jsx = canvasRef.current.currentJsx;
    if (!jsx) return;
    await fileManagerRef.current.saveFile(jsx);
  }, []);

  const handleSaveAs = useCallback(async () => {
    const jsx = canvasRef.current.currentJsx;
    if (!jsx) return;
    await fileManagerRef.current.saveFileAs(jsx);
  }, []);

  const handleNewDoc = useCallback(() => {
    canvasRef.current.loadJsx('');
    canvasRef.current.clearSelection();
    chat.reset();
    fileManagerRef.current.clearFile();
    setActiveFilePath(null);
    setHasClaudeContent(false);
    setActiveTool('cursor');
    drawingRef.current.clearAll();
  }, [chat.reset]);

  handleSaveRef.current = handleSave;
  handleSaveAsRef.current = handleSaveAs;
  handleNewDocRef.current = handleNewDoc;

  // ── Layer selection ───────────────────────────────────────────────────────
  const handleLayerSelect = useCallback((path: string) => {
    canvasRef.current.highlightByPath(path);
  }, []);

  // ── Drawing handlers ──────────────────────────────────────────────────────
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const handleDrawStart = useCallback((x: number, y: number) => {
    drawingRef.current.startDraw(activeToolRef.current, x, y);
  }, []);

  const handleDrawUpdate = useCallback((x: number, y: number, ox: number, oy: number) => {
    drawingRef.current.updateDraft(x, y, ox, oy);
  }, []);

  const [autoEditId, setAutoEditId] = useState<string | null>(null);

  const handleDrawCommit = useCallback(() => {
    const d = drawingRef.current;
    const drafting = d.state.drafting;
    d.commitDraft();
    setActiveTool('cursor');
    if (drafting) analytics.track('shape_created', { type: drafting.shape.type });
    // Auto-enter text edit mode: works for both drag-drawn text (width>=4) and single-click text (width<4 → default size)
    if (drafting && drafting.shape.type === 'text') {
      setAutoEditId(drafting.shape.id);
      setTimeout(() => setAutoEditId(null), 100);
    }
  }, []);

  const handleShapePreview = useCallback((patch: Partial<Shape>) => {
    const d = drawingRef.current;
    if (!d.state.selectedId) return;
    d.previewShape(d.state.selectedId, patch);
  }, []);

  const handleShapeChange = useCallback((patch: Partial<Shape>) => {
    const d = drawingRef.current;
    if (!d.state.selectedId) return;
    d.updateShape(d.state.selectedId, patch);
  }, []);

  const handleShapeChangeById = useCallback((id: string, patch: Partial<Shape>) => {
    drawingRef.current.updateShape(id, patch);
  }, []);

  const handleShapePreviewById = useCallback((id: string, patch: Partial<Shape>) => {
    drawingRef.current.previewShape(id, patch);
  }, []);

  const handleMoveEnd = useCallback(() => drawingRef.current.endMove(), []);
  const handleResizeEnd = useCallback(() => drawingRef.current.endResize(), []);

  // ── Page actions ───────────────────────────────────────────────────────────
  const handleSwitchPage = useCallback((pageId: string) => {
    pagesRef.current.switchPage(pageId, drawingRef.current.state.shapes, (shapes) => {
      drawingRef.current.loadShapes(shapes);
    });
  }, []);

  const handleAddPage = useCallback(() => {
    pagesRef.current.addPage(drawingRef.current.state.shapes, (shapes) => {
      drawingRef.current.loadShapes(shapes);
    });
    analytics.track('page_added');
  }, []);

  const handleDeletePage = useCallback((pageId: string) => {
    pagesRef.current.deletePage(pageId, drawingRef.current.state.shapes, (shapes) => {
      drawingRef.current.loadShapes(shapes);
    });
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────
  const selectedShape = drawing.state.shapes.find(s => s.id === drawing.state.selectedId) ?? null;
  const showShapeInspect = selectedShape !== null && activeTool === 'cursor';
  const showElementInspect = canvas.selection !== null && !showShapeInspect;
  const showRightPanel = (showShapeInspect || showElementInspect) && !rightCollapsed;

  // When a frame with iframeJsx is selected, show its content in the main iframe
  useEffect(() => {
    if (selectedShape?.iframeJsx) {
      canvas.loadJsx(selectedShape.iframeJsx);
    }
  }, [selectedShape?.id, selectedShape?.iframeJsx, canvas.loadJsx]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left icon sidebar */}
      <ToolSidebar
        activeTool={activeTool}
        hasContent={!!canvas.currentJsx || drawing.state.shapes.length > 0}
        onToolChange={handleToolChange}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onNew={handleNewDoc}
      />

      {/* Unified left panel (Layers / Pages / History) */}
      <LeftPanel
        collapsed={leftCollapsed}
        onCollapse={() => setLeftCollapsed(c => !c)}
        activeTab={leftTab}
        onTabChange={setLeftTab}
        layerTree={canvas.layerTree}
        shapes={drawing.state.shapes}
        selectedShapeId={drawing.state.selectedId}
        selectedShapeIds={drawing.state.selectedIds}
        onSelectShape={(id) => {
          drawing.select(id);
          if (id) setActiveTool('cursor');
        }}
        onSelectPath={handleLayerSelect}
        canvasSelection={canvas.selection}
        pages={pages.pages}
        activePageId={pages.activePageId}
        onSwitchPage={handleSwitchPage}
        onAddPage={handleAddPage}
        onRenamePage={pages.renamePage}
        onDeletePage={handleDeletePage}
        historyEntries={drawing.historyEntries}
        historyIndex={drawing.historyIndex}
        onJumpHistory={drawing.jumpToHistory}
      />

      {/* Canvas + overlay + chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Canvas area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
          <CanvasPane
            iframeRef={canvas.iframeRef}
            dataUri={canvas.dataUri}
            hasContent={!!canvas.currentJsx || drawing.state.shapes.length > 0}
            selection={canvas.selection}
            isStreaming={chat.isStreaming}
            streamingContent={chat.streamingContent}
            onClearSelection={canvas.clearSelection}
            onIframeLoad={canvas.onIframeLoad}
          />

          {drawing.state.shapes.length > 0 && <ExportToolbar shapes={drawing.state.shapes} />}

          <CanvasOverlay
            activeTool={activeTool}
            shapes={drawing.state.shapes}
            drafting={drawing.state.drafting}
            selectedId={drawing.state.selectedId}
            selectedIds={drawing.state.selectedIds}
            marquee={drawing.state.marquee}
            isDraggingMove={drawing.state.draggingMove !== null}
            isDraggingResize={drawing.state.draggingHandle !== null}
            hasIframeContent={hasClaudeContent}
            onDrawStart={handleDrawStart}
            onDrawUpdate={handleDrawUpdate}
            onDrawCommit={handleDrawCommit}
            onSelect={drawing.select}
            onAddToSelection={drawing.addToSelection}
            onRemoveFromSelection={drawing.removeFromSelection}
            onSetMarquee={drawing.setMarquee}
            onCommitMarquee={drawing.commitMarquee}
            onMoveStart={drawing.startMove}
            onMove={drawing.move}
            onMoveEnd={handleMoveEnd}
            onResizeStart={drawing.startResize}
            onResize={drawing.resize}
            onResizeEnd={handleResizeEnd}
            onDrawCancel={drawing.cancelDraft}
            onShapeChange={handleShapeChangeById}
            onShapePreview={handleShapePreviewById}
            autoEditId={autoEditId}
            onDuplicate={drawing.duplicate}
            onDelete={drawing.deleteSelected}
            onBringToFront={drawing.bringToFront}
            onSendToBack={drawing.sendToBack}
            onCopy={drawing.copy}
            onPaste={drawing.paste}
            penPoints={drawing.penPoints}
            penCursor={drawing.penCursor}
            penDragPointIndex={drawing.penDragPointIndex}
            penPullingHandleRef={drawing.penPullingHandleRef}
            onPenClick={drawing.penAddPoint}
            onPenPullHandle={drawing.penPullHandle}
            onPenEndHandlePull={drawing.penEndHandlePull}
            onPenMove={drawing.penMoveCursor}
            onPenCommit={(closed) => { drawing.penCommit(closed); setActiveTool('cursor'); analytics.track('shape_created', { type: 'path', closed }); }}
            onPenCancel={() => { drawing.penCancel(); setActiveTool('cursor'); }}
            onPenStartDragPoint={drawing.penStartDragPoint}
            onPenDragPoint={drawing.penDragPoint}
            onPenEndDragPoint={drawing.penEndDragPoint}
          />
        </div>

        <ChatBar
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          streamingContent={chat.streamingContent}
          selection={canvas.selection}
          selectedShape={selectedShape}
          onSend={chat.send}
          onAbort={chat.abort}
          onClearSelection={canvas.clearSelection}
        />
      </div>

      {/* Right panel — always present, collapses to toggle button */}
      <div className="flex-shrink-0 flex overflow-hidden" style={{ position: 'relative' }}>
        <button
          onClick={() => setRightCollapsed(c => !c)}
          title={rightCollapsed ? 'Show properties' : 'Hide properties'}
          style={{
            position: 'absolute', top: 10,
            left: rightCollapsed ? 0 : -1,
            width: 20, height: 32,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRight: rightCollapsed ? '1px solid var(--border)' : 'none',
            borderLeft: rightCollapsed ? 'none' : '1px solid var(--border)',
            borderRadius: rightCollapsed ? '0 6px 6px 0' : '6px 0 0 6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--muted)', zIndex: 10, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
        >
          {rightCollapsed ? (
            <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
              <path d="M6 2l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <ChevronRight size={12} />
          )}
        </button>

        {!rightCollapsed && (
          <div style={{ width: 280, overflow: 'hidden', borderLeft: '1px solid var(--border)', background: 'var(--panel)', height: '100%' }}>
            {showShapeInspect && (
              <ShapeInspectPanel shape={selectedShape!} onPreview={handleShapePreview} onChange={handleShapeChange} />
            )}
            {showElementInspect && (
              <InspectPanel
                selection={canvas.selection!}
                isPatching={silentPatch.isPatching}
                onPatch={silentPatch.patch}
              />
            )}
            {!showShapeInspect && !showElementInspect && (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: 24, color: 'var(--muted)', textAlign: 'center',
              }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.3 }}>
                  <rect x="6" y="6" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <span style={{ fontSize: 12, lineHeight: 1.5 }}>
                  Select a shape<br />to edit its properties
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
