import { useEffect, useRef, useState, useMemo } from 'react';
import { analyzeStream, type StreamPhase } from '../../lib/stream-parser';

interface Props {
  streamingContent: string;
  isStreaming: boolean;
}

const PHASE_LABEL: Record<StreamPhase, string> = {
  thinking:  'Thinking…',
  writing:   'Writing component…',
  finishing: 'Finishing up…',
  done:      'Done',
};

const PHASE_COLOR: Record<StreamPhase, string> = {
  thinking:  '#a78bfa',
  writing:   '#34d399',
  finishing: '#60a5fa',
  done:      '#60a5fa',
};

/** Only re-render the preview iframe every N chars to avoid thrashing */
const REFRESH_EVERY = 200;

/** Build minimal HTML to render a partial React component */
function buildPreviewHtml(jsx: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:system-ui,sans-serif}
    #root{min-height:100vh}
    #err{display:none;padding:12px;background:#fef2f2;color:#991b1b;font:12px monospace;white-space:pre-wrap}
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="err"></div>
  <script type="text/babel" data-presets="react">
    const {useState,useEffect,useRef,useCallback,useMemo,useReducer}=React;
    ${jsx}
    try{
      const root=ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    }catch(e){
      document.getElementById('err').style.display='block';
      document.getElementById('err').textContent=e.message;
    }
  <\/script>
  <script>
    window.onerror=function(msg){
      document.getElementById('err').style.display='block';
      document.getElementById('err').textContent=msg;
    };
  <\/script>
</body>
</html>`;
}

export function StreamPreview({ streamingContent, isStreaming }: Props) {
  const stats = useMemo(() => analyzeStream(streamingContent), [streamingContent]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastRefreshLen = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const [tokenRate, setTokenRate] = useState(0);
  const [dots, setDots] = useState('');
  const [hasPreview, setHasPreview] = useState(false);

  // Animated dots
  useEffect(() => {
    if (!isStreaming) { setDots(''); return; }
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 420);
    return () => clearInterval(id);
  }, [isStreaming]);

  // Token rate
  useEffect(() => {
    if (isStreaming && startTimeRef.current === null) startTimeRef.current = Date.now();
    if (!isStreaming) { startTimeRef.current = null; setTokenRate(0); return; }
    const elapsed = (Date.now() - (startTimeRef.current ?? Date.now())) / 1000;
    if (elapsed > 1) setTokenRate(Math.round(streamingContent.length / elapsed));
  }, [streamingContent, isStreaming]);

  // Reset on new stream start
  useEffect(() => {
    if (isStreaming) {
      lastRefreshLen.current = 0;
      setHasPreview(false);
    }
  }, [isStreaming]);

  // Throttled iframe update via srcdoc
  useEffect(() => {
    if (!stats.partialJsx || !iframeRef.current) return;
    const len = stats.partialJsx.length;
    const isFinishing = stats.phase === 'finishing';
    if (!isFinishing && len - lastRefreshLen.current < REFRESH_EVERY) return;

    const jsx = makeRenderable(stats.partialJsx);
    if (!jsx) return;

    lastRefreshLen.current = len;
    iframeRef.current.srcdoc = buildPreviewHtml(jsx);
    setHasPreview(true);
  }, [stats.partialJsx, stats.phase]);

  if (!isStreaming) return null;

  const color = PHASE_COLOR[stats.phase];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 20, pointerEvents: hasPreview ? 'none' : 'auto' }}>

      {/* ── Status bar ── */}
      <div style={{
        flexShrink: 0, height: 36,
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--panel) 85%, transparent)',
        backdropFilter: 'blur(12px)',
        pointerEvents: 'all',
      }}>
        {/* Pulsing dot */}
        <PulseDot color={color} />

        {/* Phase */}
        <span style={{ fontSize: 13, color, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {PHASE_LABEL[stats.phase]}{stats.phase === 'thinking' ? dots : ''}
        </span>

        {/* Stats */}
        {(stats.phase === 'writing' || stats.phase === 'finishing') && (
          <div style={{ display: 'flex', gap: 14, marginLeft: 2 }}>
            <StatPill value={stats.linesWritten} label="lines" />
            <StatPill value={stats.charsWritten} label="chars" />
            {tokenRate > 0 && <StatPill value={tokenRate} label="ch/s" />}
          </div>
        )}

        {/* Last line ticker */}
        {stats.partialJsx && stats.phase === 'writing' && (
          <div style={{
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'monospace', fontSize: 11, color: 'var(--subtle)', textAlign: 'right',
          }}>
            {getLastMeaningfulLine(stats.partialJsx)}
          </div>
        )}

        {/* Badge */}
        <div style={{
          fontSize: 11, color, border: `1px solid ${color}40`,
          borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em',
          background: `${color}12`, flexShrink: 0,
        }}>
          LIVE
        </div>
      </div>

      {/* ── Preview / skeleton ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Persistent live-preview iframe — fades in once JSX is renderable */}
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            border: 'none', background: 'white',
            opacity: hasPreview ? 1 : 0,
            transition: 'opacity 0.4s ease',
            pointerEvents: hasPreview ? 'all' : 'none',
          }}
          title="Stream Preview"
        />

        {/* Skeleton overlay — visible until we have a live preview, then fades out */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: hasPreview
            ? 'transparent'
            : 'color-mix(in srgb, var(--bg) 70%, transparent)',
          backdropFilter: hasPreview ? 'none' : 'blur(6px)',
          opacity: hasPreview ? 0 : 1,
          transition: 'opacity 0.4s ease, background 0.4s ease',
          pointerEvents: 'none',
        }}>
          <ThinkingSkeleton phase={stats.phase} dots={dots} />
        </div>

        {/* Subtle scanline on top of live preview */}
        {hasPreview && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.018) 3px,rgba(0,0,0,0.018) 4px)',
          }} />
        )}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%,100%{transform:scale(1);opacity:1}
          50%{transform:scale(1.5);opacity:0.5}
        }
        @keyframes shimmer-line {
          0%,100%{opacity:0.15}
          50%{opacity:0.4}
        }
      `}</style>
    </div>
  );
}

function PulseDot({ color }: { color: string }) {
  return (
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
      <span style={{ fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
    </div>
  );
}

function ThinkingSkeleton({ phase, dots }: { phase: StreamPhase; dots: string }) {
  const rows = [62, 80, 48, 72, 55, 88, 42, 65];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
      <div style={{
        width: '100%', maxWidth: 340, padding: '18px 20px',
        background: '#0c0c0c', borderRadius: 10, border: '1px solid #2a2a2a',
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        {/* Fake window chrome */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 4 }}>
          {['#ff5f57','#febc2e','#28c840'].map((c,i) => (
            <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
          ))}
        </div>
        {rows.map((w, i) => (
          <div key={i} style={{
            height: 9, width: `${w}%`, borderRadius: 4, background: '#1e1e1e',
            animation: `shimmer-line 2s ease-in-out ${(i * 0.12).toFixed(2)}s infinite`,
          }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
        {phase === 'thinking'
          ? `Claude is planning your component${dots}`
          : `Building${dots}`}
      </p>
    </div>
  );
}

/** Try to make partial JSX renderable */
function makeRenderable(partial: string): string | null {
  if (!partial.trim()) return null;
  // Has a complete-looking App function
  if (/function\s+App\s*\(/.test(partial)) {
    // Already closed
    if (/^}/m.test(partial.split('function App')[1] ?? '')) return partial;
    // Add minimal closing
    return partial + '\n  return null;\n}';
  }
  return null;
}

function getLastMeaningfulLine(jsx: string): string {
  const lines = jsx.split('\n').map(l => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? '';
}
