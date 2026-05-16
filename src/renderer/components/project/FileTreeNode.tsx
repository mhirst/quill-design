import { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen } from 'lucide-react';
import type { ProjectFolder, ProjectFile } from '@shared/types';

interface FileNodeProps {
  file: ProjectFile;
  isActive: boolean;
  onSelect: (file: ProjectFile) => void;
}

export function FileNode({ file, isActive, onSelect }: FileNodeProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-sm select-none"
      style={{
        background: isActive ? 'var(--accent-dim)' : 'transparent',
        color: isActive ? 'var(--accent)' : 'var(--text)',
        paddingLeft: 28,
        fontSize: 13,
      }}
      onClick={() => onSelect(file)}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--panel-alt)'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <FileCode size={14} style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--muted)' }} />
      <span className="truncate">{file.name}</span>
    </div>
  );
}

interface FolderNodeProps {
  folder: ProjectFolder;
  activeFilePath: string | null;
  onSelectFile: (file: ProjectFile) => void;
  depth?: number;
}

export function FolderNode({ folder, activeFilePath, onSelectFile, depth = 0 }: FolderNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = folder.files.length > 0 || folder.folders.length > 0;

  return (
    <div>
      {depth > 0 && (
        <div
          className="flex items-center gap-1.5 cursor-pointer select-none rounded-sm"
          style={{
            paddingLeft: 8 + depth * 12,
            paddingTop: 4,
            paddingBottom: 4,
            paddingRight: 8,
            color: 'var(--muted)',
            fontSize: 13,
          }}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
        >
          <span style={{ color: 'var(--muted)' }}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          {open
            ? <FolderOpen size={14} style={{ flexShrink: 0 }} />
            : <Folder size={14} style={{ flexShrink: 0 }} />
          }
          <span className="truncate">{folder.name}</span>
        </div>
      )}

      {(open || depth === 0) && hasChildren && (
        <div>
          {folder.folders.map((sub) => (
            <FolderNode
              key={sub.path}
              folder={sub}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ))}
          {folder.files.map((file) => (
            <div key={file.path} style={{ paddingLeft: depth > 0 ? depth * 12 : 0 }}>
              <FileNode
                file={file}
                isActive={activeFilePath === file.path}
                onSelect={onSelectFile}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
