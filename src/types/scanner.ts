export type PageId =
  | 'dashboard'
  | 'scan'
  | 'results'
  | 'details'
  | 'history'
  | 'reports'
  | 'settings';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type RuleCategory =
  | 'secrets'
  | 'eval'
  | 'sqli'
  | 'xss'
  | 'subprocess'
  | 'tls'
  | 'crypto'
  | 'debug'
  | 'http'
  | 'cors'
  | 'env';

export type FileLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'json'
  | 'html'
  | 'css'
  | 'yaml'
  | 'env'
  | 'unsupported';

export interface VirtualFile {
  path: string;
  name: string;
  extension: string;
  language: FileLanguage;
  content: string;
  originalContent: string;
  sizeBytes: number;
  lineCount: number;
  isEligible: boolean;
  skipReason?: string;
  isModified: boolean;
}

export interface RuleMatchResult {
  columnStart: number;
  evidenceSnippet: string;
  suggestedFix: string;
  fixExplanation: string;
}

export interface SecurityRule {
  id: string;
  title: string;
  category: RuleCategory;
  categoryLabel: string;
  severity: Severity;
  supportedLanguages: FileLanguage[];
  description: string;
  impact: string;
  remediation: string;
  evaluateLine: (
    line: string,
    lineIndex: number,
    allLines: string[],
    file: VirtualFile
  ) => RuleMatchResult | null;
}

export interface SecurityFinding {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  category: RuleCategory;
  categoryLabel: string;
  filePath: string;
  lineNumber: number;
  columnStart: number;
  evidenceSnippet: string;
  contextBefore: string[];
  contextAfter: string[];
  explanation: string;
  impact: string;
  remediation: string;
  suggestedFix: string;
  fixExplanation: string;
  patchedInWorkspace: boolean;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  weights: SeverityCounts;
  counts: SeverityCounts;
  penalties: SeverityCounts;
  totalPenalty: number;
  finalScore: number;
  formulaText: string;
}

export interface ScanRecord {
  id: string;
  projectName: string;
  origin: 'upload' | 'demo';
  uploadType: 'zip' | 'files' | 'demo';
  createdAt: string;
  durationMs: number;
  filesTotal: number;
  filesScanned: number;
  filesSkipped: number;
  linesScanned: number;
  findings: SecurityFinding[];
  severityCounts: SeverityCounts;
  securityScore: number;
  scoreBreakdown: ScoreBreakdown;
  parentScanId?: string;
}

export interface ScannerSettings {
  enabledCategories: Record<RuleCategory, boolean>;
  includeDemoInDashboard: boolean;
  maxFileSizeKb: number;
}

export interface ScanProgress {
  isScanning: boolean;
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  findingsSoFar: number;
}

export interface ActiveWorkspace {
  projectName: string;
  origin: 'upload' | 'demo';
  uploadType: 'zip' | 'files' | 'demo';
  files: VirtualFile[];
  loadedAt: string;
}
