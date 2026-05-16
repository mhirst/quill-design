import { type RefObject } from 'react';
import { Layout } from 'lucide-react';
import type { ElementSelection } from '@shared/types';
import { StreamPreview } from './StreamPreview';

interface Props {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  dataUri: string;
  hasContent: boolean;
  selection: ElementSelection | null;
  isStreaming: boolean;
  streamingContent: string;
  onClearSelection: () => void;
  onIframeLoad: () => void;
}

export function CanvasPane({
  iframeRef,
  dataUri,
  hasContent,
  selection,
  isStreaming,
  streamingContent,
  onClearSelection,
  onIframeLoad,
}: Props) {
  return (
    // Fill the parent (which is already relative + overflow-hidden)
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)' }}>

      {/* Empty state */}
      {!hasContent && !isStreaming && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, textAlign: 'center', userSelect: 'none',
          }}
        >
          <div
            style={{
              width: 48, height: 48, borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--panel-alt)', border: '1px solid var(--border)',
            }}
          >
            <Layout size={20} style={{ color: 'var(--muted)' }} />
          </div>
          <p style={{ fontSize: 15, color: 'var(--text)', margin: 0, fontWeight: 500 }}>Canvas is empty</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 220, margin: 0 }}>
            Describe a UI component below and Claude will render it here.
          </p>
        </div>
      )}

      {/* Canvas iframe — always mounted when there's content so it doesn't re-init */}
      {hasContent && dataUri && (
        <iframe
          ref={iframeRef}
          src={dataUri}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            border: 'none', background: 'white',
            outline: 'none',
          }}
          title="Design Canvas"
          onLoad={onIframeLoad}
        />
      )}

      {/* Live stream preview — overlays everything while streaming */}
      <StreamPreview isStreaming={isStreaming} streamingContent={streamingContent} />

      {/* Selection info bar */}
      {selection && !isStreaming && (
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '6px 16px',
            background: 'color-mix(in srgb, var(--panel) 93%, transparent)',
            backdropFilter: 'blur(8px)',
            borderTop: '1px solid color-mix(in srgb, var(--accent) 19%, transparent)',
            fontSize: 13,
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          <code style={{ color: 'var(--accent)', fontFamily: 'monospace', flexShrink: 0 }}>
            {selection.tagName.toLowerCase()}
          </code>
          <span
            style={{ color: 'var(--subtle)', fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
            title={selection.className}
          >
            {selection.className ? selection.className.split(' ').slice(0, 4).join(' ') + (selection.className.split(' ').length > 4 ? '…' : '') : ''}
          </span>
          <span style={{ color: 'var(--subtle)', flexShrink: 0 }}>
            {Math.round(selection.rect.width)} × {Math.round(selection.rect.height)}px
          </span>
          <button
            onClick={onClearSelection}
            style={{ marginLeft: 'auto', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
