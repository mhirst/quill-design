interface Props {
  filePath: string | null;
  projectName: string | null;
}

export function TitleBar({ filePath, projectName }: Props) {
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null;

  return (
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
          className="absolute right-3 flex items-center gap-1.5"
          style={{ fontSize: 13, color: 'var(--muted)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: 'var(--accent)' }}
          />
          {fileName}
        </span>
      )}
    </div>
  );
}
