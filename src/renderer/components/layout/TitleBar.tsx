import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { ProviderSettings } from '../settings/ProviderSettings';

interface Props {
  filePath: string | null;
  projectName: string | null;
}

export function TitleBar({ filePath, projectName }: Props) {
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null;
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div
        className="flex items-center justify-center flex-shrink-0 relative select-none"
        style={{
          height: 36,
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em' }}>
          {projectName ? (
            <>
              <span style={{ color: 'var(--text)' }}>QUILL</span>
              <span style={{ color: 'var(--subtle)', margin: '0 8px' }}>·</span>
              <span style={{ color: 'var(--muted)' }}>{projectName}</span>
            </>
          ) : (
            'QUILL'
          )}
        </span>

        {fileName && (
          <span
            className="absolute right-10 flex items-center gap-1.5"
            style={{ fontSize: 13, color: 'var(--muted)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} />
            {fileName}
          </span>
        )}

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          title="AI Provider Settings"
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 4, borderRadius: 4,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--panel-alt)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Provider settings modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div style={{
            width: '100%', maxWidth: 500,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '28px 28px 24px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>AI Provider</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                  Switch between Claude, OpenAI, or a local model
                </p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 4, display: 'flex' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                <X size={16} />
              </button>
            </div>
            <ProviderSettings onSaved={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </>
  );
}
