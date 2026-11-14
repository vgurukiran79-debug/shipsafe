import {
  AlertCircle,
  FileArchive,
  FileCode2,
  FlaskConical,
  Lock,
  Play,
  RotateCcw,
  Upload,
  XCircle,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { FileTree } from '../components/FileTree';
import { extractZipArchive, ingestUploadedFiles } from '../engine/scanner';
import {
  ActiveWorkspace,
  ScanProgress,
  ScannerSettings,
  VirtualFile,
} from '../types/scanner';

interface NewScanPageProps {
  workspace: ActiveWorkspace | null;
  settings: ScannerSettings;
  scanProgress: ScanProgress;
  scanNotice: string | null;
  onWorkspaceLoaded: (ws: ActiveWorkspace) => void;
  onLoadDemoWorkspace: () => void;
  onStartScan: () => void;
  onCancelScan: () => void;
  onClearWorkspace: () => void;
}

export function NewScanPage({
  workspace,
  settings,
  scanProgress,
  scanNotice,
  onWorkspaceLoaded,
  onLoadDemoWorkspace,
  onStartScan,
  onCancelScan,
  onClearWorkspace,
}: NewScanPageProps) {
  const zipInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState<VirtualFile | null>(null);

  const handleZipSelection = async (file: File) => {
    setUploadError(null);
    setIsLoadingFiles(true);
    setPreviewFile(null);
    try {
      const { projectName, files } = await extractZipArchive(
        file,
        settings.maxFileSizeKb
      );
      onWorkspaceLoaded({
        projectName,
        origin: 'upload',
        uploadType: 'zip',
        files,
        loadedAt: new Date().toISOString(),
      });
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Failed to extract ZIP archive locally.'
      );
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSourceFilesSelection = async (filesList: FileList | File[]) => {
    setUploadError(null);
    setIsLoadingFiles(true);
    setPreviewFile(null);
    try {
      const arr = Array.from(filesList);
      if (arr.length === 1 && arr[0].name.toLowerCase().endsWith('.zip')) {
        await handleZipSelection(arr[0]);
        return;
      }

      const nonZipFiles = arr.filter(
        (f) => !f.name.toLowerCase().endsWith('.zip')
      );
      if (nonZipFiles.length === 0) {
        await handleZipSelection(arr[0]);
        return;
      }

      const { projectName, files } = await ingestUploadedFiles(
        nonZipFiles,
        settings.maxFileSizeKb
      );
      onWorkspaceLoaded({
        projectName,
        origin: 'upload',
        uploadType: 'files',
        files,
        loadedAt: new Date().toISOString(),
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to read selected files.'
      );
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const onZipInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleZipSelection(file);
    }
    e.target.value = '';
  };

  const onFilesInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleSourceFilesSelection(e.target.files);
    }
    e.target.value = '';
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleSourceFilesSelection(e.dataTransfer.files);
    }
  };

  const eligibleCount =
    workspace?.files.filter((f) => f.isEligible).length ?? 0;
  const skippedCount = (workspace?.files.length ?? 0) - eligibleCount;
  const progressPercent =
    scanProgress.totalFiles > 0
      ? Math.round((scanProgress.processedFiles / scanProgress.totalFiles) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
            New Security Scan
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload a ZIP archive or individual source files, inspect the file tree, and scan locally.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Your source code is processed locally in your browser. ShipSafe does not send project files to an external AI service.
          </span>
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/35 border border-rose-500/40 text-sm text-rose-200"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-rose-100">Upload Error</div>
            <p>{uploadError}</p>
          </div>
        </div>
      )}

      {scanNotice && !uploadError && (
        <div
          role="status"
          className="flex items-center gap-3 p-4 rounded-xl bg-amber-950/30 border border-amber-500/35 text-sm text-amber-200"
        >
          <XCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{scanNotice}</span>
        </div>
      )}

      {/* Upload Dropzone + Built-in Demo Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Dropzone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`lg:col-span-8 bg-[#0B1221]/90 border rounded-xl p-6 sm:p-8 flex flex-col justify-between transition-colors ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/20'
              : 'border-slate-800/80 border-dashed'
          }`}
        >
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Drop a project ZIP or source files here
              </h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Supports JavaScript, TypeScript, Python, JSON, HTML, CSS, YAML, and <span className="font-mono text-slate-300">.env</span> configuration files. Dependency directories (<span className="font-mono text-slate-300">node_modules</span>, <span className="font-mono text-slate-300">.git</span>, <span className="font-mono text-slate-300">dist</span>) are skipped automatically.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6">
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={onZipInputChange}
              className="hidden"
            />
            <input
              ref={filesInputRef}
              type="file"
              multiple
              accept=".js,.jsx,.mjs,.cjs,.ts,.tsx,.mts,.cts,.py,.json,.html,.htm,.css,.scss,.yml,.yaml,.env,.env.local,.env.development,.env.production,.txt"
              onChange={onFilesInputChange}
              className="hidden"
            />

            <button
              type="button"
              disabled={isLoadingFiles || scanProgress.isScanning}
              onClick={() => zipInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileArchive className="w-4 h-4" />
              <span>{isLoadingFiles ? 'Extracting...' : 'Upload ZIP Project'}</span>
            </button>

            <button
              type="button"
              disabled={isLoadingFiles || scanProgress.isScanning}
              onClick={() => filesInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 disabled:opacity-50 text-slate-200 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileCode2 className="w-4 h-4 text-blue-400" />
              <span>Select Individual Files</span>
            </button>
          </div>
        </div>

        {/* Built-in Demo Project Card */}
        <div className="lg:col-span-4 bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <FlaskConical className="w-4 h-4 shrink-0" />
              <span>Built-in Vulnerable Demo</span>
            </div>
            <h2 className="text-base font-semibold text-slate-100">
              Acme Commerce Portal
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Full-stack Express TypeScript API, React components, YAML config, and <span className="font-mono text-slate-300">.env</span> files containing intentional security issues. Runs through the exact same local scanner as user uploads.
            </p>
          </div>

          <button
            type="button"
            disabled={scanProgress.isScanning}
            onClick={() => {
              setUploadError(null);
              setPreviewFile(null);
              onLoadDemoWorkspace();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            <FlaskConical className="w-4 h-4" />
            <span>Load Demo Project</span>
          </button>
        </div>
      </div>

      {/* Loaded Project Workspace & File Tree */}
      {workspace && (
        <section className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl overflow-hidden">
          {/* Workspace Bar */}
          <div className="px-6 py-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`font-semibold ${
                    workspace.origin === 'demo' ? 'text-cyan-400' : 'text-blue-400'
                  }`}
                >
                  {workspace.origin === 'demo' ? 'Built-in Demo Project' : 'User Uploaded Project'}
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {eligibleCount} eligible
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-500">
                  {skippedCount} skipped
                </span>
              </div>
              <h2 className="text-lg font-semibold text-slate-100 truncate">
                {workspace.projectName}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                disabled={scanProgress.isScanning}
                onClick={() => {
                  setPreviewFile(null);
                  onClearWorkspace();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Workspace</span>
              </button>

              <button
                type="button"
                disabled={eligibleCount === 0 || scanProgress.isScanning}
                onClick={onStartScan}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>
                  {scanProgress.isScanning ? 'Scanning Locally...' : 'Start Scan'}
                </span>
              </button>
            </div>
          </div>

          {/* Real Scan Progress Bar */}
          {scanProgress.isScanning && (
            <div className="px-6 py-4 bg-slate-900/70 border-b border-slate-800/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-cyan-300 font-medium truncate max-w-md">
                  Scanning <span className="font-mono">{scanProgress.currentFile}</span>
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono tabular-nums text-slate-300">
                    {scanProgress.processedFiles} / {scanProgress.totalFiles} files ({progressPercent}%) · {scanProgress.findingsSoFar} findings
                  </span>
                  <button
                    type="button"
                    onClick={onCancelScan}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-rose-500/40 text-rose-300 hover:bg-rose-950/50 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Split File Tree + Source Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
            <div className="lg:col-span-5 p-4">
              <div className="text-xs font-semibold text-slate-400 px-2 pb-2">
                Project File Tree (click a file to inspect)
              </div>
              <FileTree
                files={workspace.files}
                selectedPath={previewFile?.path ?? null}
                onSelectFile={(file) => setPreviewFile(file)}
              />
            </div>

            <div className="lg:col-span-7 p-4 flex flex-col">
              {previewFile ? (
                <div className="flex-1 flex flex-col min-h-[260px]">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <span className="font-mono text-xs text-cyan-300 truncate">
                      {previewFile.path}
                    </span>
                    <span className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
                      {previewFile.isEligible
                        ? `${previewFile.language} · ${previewFile.lineCount} lines`
                        : `Skipped (${previewFile.skipReason})`}
                    </span>
                  </div>
                  {previewFile.isEligible ? (
                    <pre className="mt-3 flex-1 max-h-72 overflow-auto text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
                      {previewFile.content}
                    </pre>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-10">
                      {previewFile.skipReason || 'This file is excluded from static scanning.'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <FileCode2 className="w-6 h-6 text-slate-600" />
                  <p className="text-sm text-slate-400">
                    Select any file in the project tree to preview its contents before scanning.
                  </p>
                  {eligibleCount === 0 && (
                    <p className="text-xs text-amber-400 pt-2">
                      No eligible source or configuration files were found in this upload.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
