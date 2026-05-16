import { Clock, FolderOpen, RefreshCw } from 'lucide-react';
import type { ProjectFolder, RecentProject, ProjectFile } from '@shared/types';
import { FolderNode } from './FileTreeNode';

interface Props {
  rootPath: string | null;
  projectName: string | null;
  tree: ProjectFolder | null;
  activeFilePath: string | null;
  recentProjects: RecentProject[];
  onOpenProject: () => void;
  onLoadProject: (rootPath: string) => void;
  onSelectFile: (file: ProjectFile) => void;
  onRefresh: () => void;
}

export function ProjectPanel({
  rootPath,
  projectName,
  tree,
  activeFilePath,
  recentProjects,
  onOpenProject,
  onLoadProject,
  onSelectFile,
  onRefresh,
}: Props) {
  // No project open → show welcome / recents
  if (!rootPath || !tree) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--panel)' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 flex-shrink-0"
          style={{ height: 44, borderBottom: '1px solid var(--border)' }}
        >
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Project
          </span>
        </div>

        {/* Open button */}
        <div className="px-3 pt-4">
          <button
            onClick={onOpenProject}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors text-sm"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <FolderOpen size={14} />
            Open Folder
          </button>
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="flex-1 overflow-y-auto mt-4">
            <div
              className="px-3 pb-2 flex items-center gap-1.5"
              style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              <Clock size={12} />
              Recent
            </div>
            {recentProjects.map((r) => (
              <button
                key={r.rootPath}
                onClick={() => onLoadProject(r.rootPath)}
                className="w-full text-left px-3 py-2 transition-colors"
                style={{ fontSize: 13, color: 'var(--muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--panel-alt)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--muted)';
                }}
              >
                <div className="truncate font-medium" style={{ color: 'inherit' }}>{r.name}</div>
                <div className="truncate mt-0.5" style={{ fontSize: 12, color: 'var(--subtle)' }}>{r.rootPath}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Project open → show file tree
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--panel)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ height: 44, borderBottom: '1px solid var(--border)' }}
      >
        <span className="flex-1 truncate font-semibold" style={{ fontSize: 13, color: 'var(--text)' }}>
          {projectName}
        </span>
        <button
          onClick={onRefresh}
          style={{ color: 'var(--muted)' }}
          className="hover:text-white transition-colors flex-shrink-0"
          title="Refresh"
          aria-label="Refresh project"
        >
          <RefreshCw size={14} />
        </button>
        <button
          onClick={onOpenProject}
          style={{ color: 'var(--muted)' }}
          className="hover:text-white transition-colors flex-shrink-0"
          title="Open different folder"
          aria-label="Open different folder"
        >
          <FolderOpen size={14} />
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        <FolderNode
          folder={tree}
          activeFilePath={activeFilePath}
          onSelectFile={onSelectFile}
          depth={0}
        />
      </div>
    </div>
  );
}
