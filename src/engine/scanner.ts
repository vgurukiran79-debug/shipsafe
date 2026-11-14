import JSZip from 'jszip';
import {
  FileLanguage,
  ScanProgress,
  ScanRecord,
  ScannerSettings,
  ScoreBreakdown,
  SecurityFinding,
  SeverityCounts,
  VirtualFile,
} from '../types/scanner';
import { SECURITY_RULES } from './securityRules';

export class ScanCancelledError extends Error {
  constructor(message = 'Scan was cancelled by the user.') {
    super(message);
    this.name = 'ScanCancelledError';
  }
}

const IGNORED_DIRECTORIES = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  'out/',
  '.next/',
  '.nuxt/',
  '.svelte-kit/',
  'target/',
  'vendor/',
  '__pycache__/',
  '.venv/',
  'venv/',
  '.cache/',
  'coverage/',
];

const IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.ds_store',
  'thumbs.db',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.tiff',
  '.pdf',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.zip',
  '.gz',
  '.tar',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.dat',
  '.db',
  '.sqlite',
  '.pyc',
  '.pyo',
  '.class',
  '.jar',
  '.wasm',
]);

export function detectLanguage(filePath: string): FileLanguage {
  const normalized = filePath.toLowerCase();
  const baseName = normalized.split('/').pop() ?? normalized;

  if (baseName === '.env' || baseName.startsWith('.env.')) {
    return 'env';
  }
  if (
    baseName.endsWith('.js') ||
    baseName.endsWith('.mjs') ||
    baseName.endsWith('.cjs') ||
    baseName.endsWith('.jsx')
  ) {
    return 'javascript';
  }
  if (
    baseName.endsWith('.ts') ||
    baseName.endsWith('.mts') ||
    baseName.endsWith('.cts') ||
    baseName.endsWith('.tsx')
  ) {
    return 'typescript';
  }
  if (baseName.endsWith('.py')) {
    return 'python';
  }
  if (baseName.endsWith('.json')) {
    return 'json';
  }
  if (baseName.endsWith('.html') || baseName.endsWith('.htm')) {
    return 'html';
  }
  if (baseName.endsWith('.css') || baseName.endsWith('.scss')) {
    return 'css';
  }
  if (baseName.endsWith('.yml') || baseName.endsWith('.yaml')) {
    return 'yaml';
  }
  return 'unsupported';
}

function getExtension(fileName: string): string {
  const base = fileName.toLowerCase();
  if (base === '.env' || base.startsWith('.env.')) return '.env';
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx) : '';
}

export function isBinaryContent(text: string): boolean {
  const sample = text.slice(0, 4096);
  if (sample.includes('\u0000')) return true;
  if (sample.length === 0) return false;

  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (
      code < 32 &&
      code !== 9 && // tab
      code !== 10 && // LF
      code !== 13 // CR
    ) {
      nonPrintable += 1;
    }
  }
  return nonPrintable / sample.length > 0.1;
}

export function createVirtualFile(
  path: string,
  content: string,
  sizeBytes: number,
  maxFileSizeKb: number
): VirtualFile {
  const cleanPath = path.replace(/^\/+/, '');
  const name = cleanPath.split('/').pop() ?? cleanPath;
  const lowerPath = cleanPath.toLowerCase();
  const language = detectLanguage(cleanPath);
  const extension = getExtension(name);
  const lineCount = content ? content.split(/\r?\n/).length : 0;

  let isEligible = true;
  let skipReason: string | undefined;

  if (
    IGNORED_DIRECTORIES.some(
      (dir) => lowerPath.includes(`/${dir}`) || lowerPath.startsWith(dir)
    )
  ) {
    isEligible = false;
    skipReason = 'Dependency or build directory excluded';
  } else if (IGNORED_FILENAMES.has(name.toLowerCase())) {
    isEligible = false;
    skipReason = 'Lockfile or OS metadata excluded';
  } else if (BINARY_EXTENSIONS.has(extension)) {
    isEligible = false;
    skipReason = 'Binary file format excluded';
  } else if (language === 'unsupported') {
    isEligible = false;
    skipReason = 'Unsupported file type';
  } else if (sizeBytes > maxFileSizeKb * 1024) {
    isEligible = false;
    skipReason = `Exceeds ${maxFileSizeKb} KB file size limit`;
  } else if (isBinaryContent(content)) {
    isEligible = false;
    skipReason = 'Binary file content detected';
  }

  return {
    path: cleanPath,
    name,
    extension,
    language,
    content,
    originalContent: content,
    sizeBytes,
    lineCount,
    isEligible,
    skipReason,
    isModified: false,
  };
}

export async function extractZipFromBuffer(
  buffer: ArrayBuffer | Uint8Array,
  archiveName: string,
  maxFileSizeKb: number
): Promise<{ projectName: string; files: VirtualFile[] }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error(
      `Unable to read "${archiveName}". The file may be corrupted, encrypted, or not a valid ZIP archive.`
    );
  }

  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && !entry.name.startsWith('__MACOSX/')
  );

  if (entries.length === 0) {
    throw new Error(`The archive "${archiveName}" contains no files to inspect.`);
  }

  const firstSegments = new Set(entries.map((e) => e.name.split('/')[0]));
  const stripRootPrefix =
    firstSegments.size === 1 && entries.every((e) => e.name.includes('/'))
      ? `${[...firstSegments][0]}/`
      : '';

  const virtualFiles: VirtualFile[] = [];

  for (const entry of entries) {
    const normalizedPath = stripRootPrefix
      ? entry.name.slice(stripRootPrefix.length)
      : entry.name;
    if (!normalizedPath) continue;

    const ext = getExtension(normalizedPath.split('/').pop() ?? normalizedPath);
    const language = detectLanguage(normalizedPath);
    const uncompressedSize =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize ?? 0;

    if (BINARY_EXTENSIONS.has(ext) || language === 'unsupported') {
      virtualFiles.push(
        createVirtualFile(normalizedPath, '', uncompressedSize, maxFileSizeKb)
      );
      continue;
    }

    if (uncompressedSize > maxFileSizeKb * 1024) {
      virtualFiles.push(
        createVirtualFile(normalizedPath, '', uncompressedSize, maxFileSizeKb)
      );
      continue;
    }

    const bytes = await entry.async('uint8array');
    const byteSize = bytes.byteLength;
    if (byteSize > maxFileSizeKb * 1024) {
      virtualFiles.push(
        createVirtualFile(normalizedPath, '', byteSize, maxFileSizeKb)
      );
      continue;
    }

    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    virtualFiles.push(createVirtualFile(normalizedPath, text, byteSize, maxFileSizeKb));
  }

  if (virtualFiles.length === 0) {
    throw new Error(`No readable files were found inside "${archiveName}".`);
  }

  const projectName = archiveName.replace(/\.zip$/i, '');
  return {
    projectName,
    files: virtualFiles.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export async function extractZipArchive(
  file: File,
  maxFileSizeKb: number
): Promise<{ projectName: string; files: VirtualFile[] }> {
  const buffer = await file.arrayBuffer();
  return extractZipFromBuffer(buffer, file.name, maxFileSizeKb);
}

export async function ingestUploadedFiles(
  fileList: FileList | File[],
  maxFileSizeKb: number
): Promise<{ projectName: string; files: VirtualFile[] }> {
  const rawFiles = Array.from(fileList);
  if (rawFiles.length === 0) {
    throw new Error('No files were selected for upload.');
  }

  const virtualFiles: VirtualFile[] = [];
  for (const raw of rawFiles) {
    const relativePath =
      (raw as File & { webkitRelativePath?: string }).webkitRelativePath || raw.name;
    const ext = getExtension(raw.name);
    const language = detectLanguage(relativePath);

    if (
      BINARY_EXTENSIONS.has(ext) ||
      language === 'unsupported' ||
      raw.size > maxFileSizeKb * 1024
    ) {
      virtualFiles.push(createVirtualFile(relativePath, '', raw.size, maxFileSizeKb));
      continue;
    }

    const text = await raw.text();
    virtualFiles.push(createVirtualFile(relativePath, text, raw.size, maxFileSizeKb));
  }

  const projectName =
    rawFiles.length === 1 ? rawFiles[0].name : `${rawFiles.length} Uploaded Files`;

  return {
    projectName,
    files: virtualFiles.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export const SEVERITY_WEIGHTS: SeverityCounts = {
  critical: 20,
  high: 10,
  medium: 4,
  low: 1,
};

export function calculateSecurityScore(findings: SecurityFinding[]): ScoreBreakdown {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    counts[f.severity] += 1;
  }

  const penalties: SeverityCounts = {
    critical: counts.critical * SEVERITY_WEIGHTS.critical,
    high: counts.high * SEVERITY_WEIGHTS.high,
    medium: counts.medium * SEVERITY_WEIGHTS.medium,
    low: counts.low * SEVERITY_WEIGHTS.low,
  };

  const totalPenalty =
    penalties.critical + penalties.high + penalties.medium + penalties.low;
  const finalScore = Math.max(0, 100 - totalPenalty);

  const formulaText = `100 - (${counts.critical}×20 + ${counts.high}×10 + ${counts.medium}×4 + ${counts.low}×1) = ${finalScore}`;

  return {
    baseScore: 100,
    weights: { ...SEVERITY_WEIGHTS },
    counts,
    penalties,
    totalPenalty,
    finalScore,
    formulaText,
  };
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function runLocalScan(
  files: VirtualFile[],
  meta: {
    projectName: string;
    origin: 'upload' | 'demo';
    uploadType: 'zip' | 'files' | 'demo';
    parentScanId?: string;
  },
  settings: ScannerSettings,
  onProgress?: (progress: ScanProgress) => void,
  signal?: AbortSignal
): Promise<ScanRecord> {
  if (signal?.aborted) {
    throw new ScanCancelledError();
  }

  const startTime = performance.now();
  const eligibleFiles = files.filter((f) => f.isEligible);
  const activeRules = SECURITY_RULES.filter(
    (rule) => settings.enabledCategories[rule.category] !== false
  );

  const findings: SecurityFinding[] = [];
  const dedupKeys = new Set<string>();
  let linesScanned = 0;
  let findingCounter = 0;

  for (let i = 0; i < eligibleFiles.length; i++) {
    if (signal?.aborted) {
      throw new ScanCancelledError();
    }

    const file = eligibleFiles[i];
    const lines = file.content.split(/\r?\n/);
    linesScanned += lines.length;

    const applicableRules = activeRules.filter((rule) =>
      rule.supportedLanguages.includes(file.language)
    );

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      // Periodically yield and check cancellation on very large files
      if (lineIdx > 0 && lineIdx % 250 === 0) {
        await yieldToMainThread();
        if (signal?.aborted) {
          throw new ScanCancelledError();
        }
      }

      const lineText = lines[lineIdx];
      if (!lineText.trim()) continue;

      for (const rule of applicableRules) {
        const dedupKey = `${rule.id}::${file.path}::${lineIdx + 1}`;
        if (dedupKeys.has(dedupKey)) continue;

        const match = rule.evaluateLine(lineText, lineIdx, lines, file);
        if (match) {
          dedupKeys.add(dedupKey);
          findingCounter += 1;
          const contextBefore = lines.slice(Math.max(0, lineIdx - 3), lineIdx);
          const contextAfter = lines.slice(
            lineIdx + 1,
            Math.min(lines.length, lineIdx + 4)
          );

          findings.push({
            id: `FND-${String(findingCounter).padStart(4, '0')}`,
            ruleId: rule.id,
            title: rule.title,
            severity: rule.severity,
            category: rule.category,
            categoryLabel: rule.categoryLabel,
            filePath: file.path,
            lineNumber: lineIdx + 1,
            columnStart: match.columnStart,
            evidenceSnippet: match.evidenceSnippet,
            contextBefore,
            contextAfter,
            explanation: rule.description,
            impact: rule.impact,
            remediation: rule.remediation,
            suggestedFix: match.suggestedFix,
            fixExplanation: match.fixExplanation,
            patchedInWorkspace: false,
          });
        }
      }
    }

    onProgress?.({
      isScanning: true,
      currentFile: file.path,
      processedFiles: i + 1,
      totalFiles: eligibleFiles.length,
      findingsSoFar: findings.length,
    });

    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  if (signal?.aborted) {
    throw new ScanCancelledError();
  }

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const pathDiff = a.filePath.localeCompare(b.filePath);
    if (pathDiff !== 0) return pathDiff;
    return a.lineNumber - b.lineNumber;
  });

  const scoreBreakdown = calculateSecurityScore(findings);
  const durationMs = Math.max(1, Math.round(performance.now() - startTime));

  return {
    id: `SCAN-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`,
    projectName: meta.projectName,
    origin: meta.origin,
    uploadType: meta.uploadType,
    createdAt: new Date().toISOString(),
    durationMs,
    filesTotal: files.length,
    filesScanned: eligibleFiles.length,
    filesSkipped: files.length - eligibleFiles.length,
    linesScanned,
    findings,
    severityCounts: scoreBreakdown.counts,
    securityScore: scoreBreakdown.finalScore,
    scoreBreakdown,
    parentScanId: meta.parentScanId,
  };
}

export async function exportWorkspaceAsZip(
  files: VirtualFile[],
  projectName: string
): Promise<void> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${projectName.replace(/[^a-zA-Z0-9._-]/g, '_')}-shipsafe-patched.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
