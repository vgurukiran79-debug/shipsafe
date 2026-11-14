import { ChevronDown, ChevronRight, FileCode2, FileWarning, Folder, FolderOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { VirtualFile } from '../types/scanner';

interface TreeNode {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  file?: VirtualFile;
  children: TreeNode[];
}

interface FileTreeProps {
  files: VirtualFile[];
  selectedPath?: string | null;
  onSelectFile?: (file: VirtualFile) => void;
  findingCountsByFile?: Record<string, number>;
}

function buildTree(files: VirtualFile[]): TreeNode[] {
  const root: TreeNode = {
    name: '',
    fullPath: '',
    isDirectory: true,
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const nodePath = parts.slice(0, i + 1).join('/');

      let existing = current.children.find((c) => c.name === part && c.isDirectory === !isLast);
      if (!existing) {
        existing = {
          name: part,
          fullPath: nodePath,
          isDirectory: !isLast,
          file: isLast ? file : undefined,
          children: [],
        };
        current.children.push(existing);
      }
      current = existing;
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.isDirectory) sortNodes(node.children);
    }
  };

  sortNodes(root.children);
  return root.children;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function FileTree({
  files,
  selectedPath,
  onSelectFile,
  findingCountsByFile,
}: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});

  const toggleDir = (dirPath: string) => {
    setCollapsedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.isDirectory) {
      const isCollapsed = Boolean(collapsedDirs[node.fullPath]);
      return (
        <div key={node.fullPath}>
          <button
            type="button"
            onClick={() => toggleDir(node.fullPath)}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            className="w-full flex items-center gap-2 py-1.5 pr-3 text-left text-xs font-medium text-slate-300 hover:bg-slate-800/50 rounded-md transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            {isCollapsed ? (
              <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {!isCollapsed && (
            <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
          )}
        </div>
      );
    }

    const file = node.file!;
    const isSelected = selectedPath === file.path;
    const count = findingCountsByFile?.[file.path] ?? 0;

    return (
      <button
        key={file.path}
        type="button"
        onClick={() => onSelectFile?.(file)}
        style={{ paddingLeft: `${depth * 16 + 24}px` }}
        title={file.skipReason ? `Skipped: ${file.skipReason}` : file.path}
        className={`w-full flex items-center justify-between gap-3 py-1.5 pr-3 text-left text-xs rounded-md transition-colors ${
          isSelected
            ? 'bg-cyan-500/15 text-cyan-200'
            : file.isEligible
              ? 'text-slate-300 hover:bg-slate-800/50'
              : 'text-slate-500 hover:bg-slate-800/30'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {file.isEligible ? (
            <FileCode2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          ) : (
            <FileWarning className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          )}
          <span className="font-mono truncate">{node.name}</span>
          {file.isModified && (
            <span className="text-[11px] text-emerald-400 font-medium whitespace-nowrap">
              Patched
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono tabular-nums">
          {count > 0 && (
            <span className="text-rose-400 font-semibold">
              {count} {count === 1 ? 'issue' : 'issues'}
            </span>
          )}
          {file.isEligible ? (
            <span className="text-slate-500">
              {file.lineCount}L · {formatBytes(file.sizeBytes)}
            </span>
          ) : (
            <span className="text-slate-600">Skipped</span>
          )}
        </div>
      </button>
    );
  };

  if (files.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        No files loaded in workspace.
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto py-1 space-y-0.5">
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
}
