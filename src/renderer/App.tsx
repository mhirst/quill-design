import { useCallback, useRef } from 'react';
import { ChatPanel } from './components/chat/ChatPanel';
import { CanvasPane } from './components/canvas/CanvasPane';
import { useCanvas } from './hooks/useCanvas';
import { useChat } from './hooks/useChat';
import { useFileManager } from './hooks/useFileManager';

export default function App() {
  const canvas = useCanvas();
  const fileManager = useFileManager();

  // Stable refs so hooks don't re-create on every render
  const getCurrentJsx = useCallback(() => canvas.currentJsx, [canvas.currentJsx]);
  const getSelection = useCallback(() => canvas.selection, [canvas.selection]);
  const getFilePath = useCallback(() => fileManager.filePath, [fileManager.filePath]);

  const chat = useChat({
    onJsxReady: canvas.loadJsx,
    getCurrentJsx,
    getSelection,
    getFilePath,
  });

  // When user opens a file: load JSX into canvas + reset chat
  const handleOpen = useCallback(async () => {
    const result = await fileManager.openFile();
    if (!result) return;
    canvas.loadJsx(result.content);
    chat.reset();
  }, [fileManager, canvas, chat]);

  // Save current JSX
  const handleSave = useCallback(async () => {
    if (!canvas.currentJsx) return;
    await fileManager.saveFile(canvas.currentJsx);
  }, [canvas.currentJsx, fileManager]);

  const handleSaveAs = useCallback(async () => {
    if (!canvas.currentJsx) return;
    await fileManager.saveFileAs(canvas.currentJsx);
  }, [canvas.currentJsx, fileManager]);

  // New design — clear everything
  const handleNew = useCallback(() => {
    canvas.loadJsx('');
    canvas.clearSelection();
    chat.reset();
    fileManager.clearFile();
  }, [canvas, chat, fileManager]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-900">
      {/* Left: Chat panel */}
      <div className="flex flex-col w-[380px] min-w-[300px] max-w-[480px] border-r border-slate-700/60 flex-shrink-0">
        <ChatPanel
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          streamingContent={chat.streamingContent}
          selection={canvas.selection}
          onSend={chat.send}
          onAbort={chat.abort}
          onClearSelection={canvas.clearSelection}
        />
      </div>

      {/* Right: Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <CanvasPane
          iframeRef={canvas.iframeRef}
          dataUri={canvas.dataUri}
          hasContent={!!canvas.currentJsx}
          filePath={fileManager.filePath}
          selection={canvas.selection}
          selectionMode={canvas.selectionMode}
          onToggleSelectionMode={canvas.toggleSelectionMode}
          onClearSelection={canvas.clearSelection}
          onIframeLoad={canvas.onIframeLoad}
          onOpen={handleOpen}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onNew={handleNew}
        />
      </div>
    </div>
  );
}
