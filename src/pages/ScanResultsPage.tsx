import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import {
  SeverityLabel,
  getScoreColorClass,
} from '../components/SeverityLabel';
import {
  buildCsvReport,
  buildJsonReport,
  downloadTextFile,
} from '../engine/reports';
import { compareScans } from '../engine/scanDiff';
import {
  ActiveWorkspace,
  ScanProgress,
  ScanRecord,
  SecurityFinding,
  Severity,
} from '../types/scanner';

interface ScanResultsPageProps {
  scan: ScanRecord | null;
  scanHistory: ScanRecord[];
  workspace: ActiveWorkspace | null;
  scanProgress: ScanProgress;
  justCompletedScanId: string | null;
  onSelectFinding: (findingId: string) => void;
  onRescanWorkspace: () => void;
  onCancelScan: () => void;
  onExportPatchedZip: () => void;
  onOpenReports: () => void;
  onGoToNewScan: () => void;
}

type DiffTab = 'resolved' | 'remaining' | 'newlyDetected';

export function ScanResultsPage({
  scan,
  scanHistory,
  workspace,
  scanProgress,
  justCompletedScanId,
  onSelectFinding,
  onRescanWorkspace,
  onCancelScan,
  onExportPatchedZip,
  onOpenReports,
  onGoToNewScan,
}: ScanResultsPageProps) {
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [fileFilter, setFileFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [diffTab, setDiffTab] = useState<DiffTab>('resolved');

  const priorProjectScans = useMemo(() => {
    if (!scan) return [];
    const currentIdx = scanHistory.findIndex((s) => s.id === scan.id);
    if (currentIdx === -1) return [];
    return scanHistory
      .slice(currentIdx + 1)
      .filter((s) => s.projectName === scan.projectName);
  }, [scan, scanHistory]);

  const [compareScanId, setCompareScanId] = useState<string>('');

  useEffect(() => {
    if (!scan) {
      setCompareScanId('');
      return;
    }
    if (scan.parentScanId && priorProjectScans.some((s) => s.id === scan.parentScanId)) {
      setCompareScanId(scan.parentScanId);
    } else if (priorProjectScans.length > 0) {
      setCompareScanId(priorProjectScans[0].id);
    } else {
      setCompareScanId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan?.id, priorProjectScans.length]);

  const comparison = useMemo(() => {
    if (!scan || !compareScanId) return null;
    const baseline = priorProjectScans.find((s) => s.id === compareScanId);
    if (!baseline) return null;
    return compareScans(scan, baseline);
  }, [scan, compareScanId, priorProjectScans]);

  useEffect(() => {
    if (comparison) {
      if (comparison.resolved.length > 0) setDiffTab('resolved');
      else if (comparison.newlyDetected.length > 0) setDiffTab('newlyDetected');
      else setDiffTab('remaining');
    }
  }, [comparison]);

  const fileOptions = useMemo(() => {
    if (!scan) return [];
    return Array.from(new Set(scan.findings.map((f) => f.filePath))).sort();
  }, [scan]);

  const filteredFindings = useMemo(() => {
    if (!scan) return [];
    const q = searchQuery.trim().toLowerCase();
    return scan.findings.filter((f) => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (fileFilter !== 'all' && f.filePath !== fileFilter) return false;
      if (q) {
        const hay =
          `${f.id} ${f.ruleId} ${f.title} ${f.filePath} ${f.evidenceSnippet}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scan, severityFilter, fileFilter, searchQuery]);

  const patchedWorkspaceCount = useMemo(() => {
    if (!workspace) return 0;
    return workspace.files.filter((f) => f.isModified).length;
  }, [workspace]);

  if (!scan) {
    return (
      <div className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-10 text-center space-y-4">
        <ShieldCheck className="w-8 h-8 text-slate-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-100">No Scan Selected</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Run a new security scan or select an existing scan from Scan History to inspect findings.
        </p>
        <button
          type="button"
          onClick={onGoToNewScan}
          className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm cursor-pointer"
        >
          Go to New Security Scan
        </button>
      </div>
    );
  }

  const canRescanActiveWorkspace =
    Boolean(workspace) && workspace?.projectName === scan.projectName;

  const isFreshCompletion = justCompletedScanId === scan.id;
  const ringRadius = 40;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ringCircumference - (scan.securityScore / 100) * ringCircumference;

  const ringStrokeColor =
    scan.securityScore >= 85
      ? '#10B981'
      : scan.securityScore >= 60
        ? '#F59E0B'
        : scan.securityScore >= 35
          ? '#F97316'
          : '#F43F5E';

  const handleQuickDownloadJson = () => {
    const slug = scan.projectName.replace(/[^a-zA-Z0-9._-]/g, '_');
    downloadTextFile(
      buildJsonReport(scan),
      `${slug}-${scan.id}-report.json`,
      'application/json'
    );
  };

  const handleQuickDownloadCsv = () => {
    const slug = scan.projectName.replace(/[^a-zA-Z0-9._-]/g, '_');
    downloadTextFile(
      buildCsvReport(scan),
      `${slug}-${scan.id}-report.csv`,
      'text/csv;charset=utf-8'
    );
  };

  const activeDiffList = comparison
    ? comparison[diffTab]
    : [];

  return (
    <div className="space-y-6">
      {/* Scan Completion Animation Banner */}
      {isFreshCompletion && (
        <motion.div
          key={scan.id}
          initial={{ opacity: 0, y: -10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 rounded-xl bg-gradient-to-r from-cyan-950/50 via-[#0B1221] to-emerald-950/35 border border-cyan-500/35"
        >
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
            </motion.div>
            <div>
              <div className="text-sm font-semibold text-slate-100">
                Local Scan Completed
              </div>
              <div className="text-xs text-slate-400 font-mono tabular-nums">
                Analyzed {scan.filesScanned} eligible files ({scan.linesScanned} lines) in {scan.durationMs} ms · {scan.findings.length} findings
              </div>
            </div>
          </div>

          {comparison && comparison.resolved.length > 0 && (
            <div className="text-xs font-semibold text-emerald-400 whitespace-nowrap">
              {comparison.resolved.length}{' '}
              {comparison.resolved.length === 1 ? 'vulnerability' : 'vulnerabilities'} resolved since previous scan
            </div>
          )}
        </motion.div>
      )}

      {/* Demo Walkthrough Progress Strip (only for Built-in Demo scans) */}
      {scan.origin === 'demo' && (
        <section
          aria-label="Demo workflow status"
          className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <span className="font-semibold text-cyan-400">
            Demo Verification Flow
          </span>
          <div className="flex flex-wrap items-center gap-2 text-slate-400">
            <span className="text-emerald-400 font-medium">1. Load Demo</span>
            <span aria-hidden="true">→</span>
            <span className="text-emerald-400 font-medium">2. Scan Locally</span>
            <span aria-hidden="true">→</span>
            <span
              className={
                patchedWorkspaceCount > 0 || (comparison?.resolved.length ?? 0) > 0
                  ? 'text-emerald-400 font-medium'
                  : 'text-slate-200 font-medium'
              }
            >
              3. Inspect & Copy Fix
            </span>
            <span aria-hidden="true">→</span>
            <span
              className={
                patchedWorkspaceCount > 0 || (comparison?.resolved.length ?? 0) > 0
                  ? 'text-emerald-400 font-medium'
                  : 'text-slate-400'
              }
            >
              4. Confirm Patch
            </span>
            <span aria-hidden="true">→</span>
            <span
              className={
                (comparison?.resolved.length ?? 0) > 0
                  ? 'text-emerald-400 font-semibold'
                  : 'text-slate-400'
              }
            >
              5. Rescan & Verify Resolved
            </span>
          </div>
        </section>
      )}

      {/* Header & Workspace Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span
              className={`font-semibold ${
                scan.origin === 'demo' ? 'text-cyan-400' : 'text-blue-400'
              }`}
            >
              {scan.origin === 'demo' ? 'Built-in Demo' : 'User Upload'}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-mono">{scan.id}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {new Date(scan.createdAt).toLocaleString()}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{scan.durationMs} ms</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            {scan.projectName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canRescanActiveWorkspace && (
            <button
              type="button"
              disabled={scanProgress.isScanning}
              onClick={onRescanWorkspace}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${scanProgress.isScanning ? 'animate-spin' : ''}`}
              />
              <span>
                {scanProgress.isScanning ? 'Rescanning...' : 'Rescan Project'}
              </span>
            </button>
          )}

          {canRescanActiveWorkspace && scanProgress.isScanning && (
            <button
              type="button"
              onClick={onCancelScan}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-950/50 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Cancel</span>
            </button>
          )}

          {canRescanActiveWorkspace && (
            <button
              type="button"
              onClick={onExportPatchedZip}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>
                Export ZIP{patchedWorkspaceCount > 0 ? ` (${patchedWorkspaceCount} patched)` : ''}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleQuickDownloadJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileJson className="w-4 h-4 text-cyan-400" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={handleQuickDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenReports}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            <span>Report View</span>
          </button>
        </div>
      </div>

      {/* Honest Heuristic Security Score + Visible Scoring Methodology */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-6">
        <div className="lg:col-span-5 flex items-center gap-5">
          {/* Animated SVG Score Ring */}
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={ringRadius}
                fill="none"
                stroke="#1E293B"
                strokeWidth="8"
              />
              <motion.circle
                key={`${scan.id}-${scan.securityScore}`}
                cx="50"
                cy="50"
                r={ringRadius}
                fill="none"
                stroke={ringStrokeColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                initial={{ strokeDashoffset: ringCircumference }}
                animate={{ strokeDashoffset: ringOffset }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`text-2xl font-bold font-mono tabular-nums ${getScoreColorClass(
                  scan.securityScore
                )}`}
              >
                {scan.securityScore}
              </span>
              <span className="text-[10px] font-mono text-slate-500">/ 100</span>
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="text-xs font-semibold text-slate-200">
              Estimated Heuristic Score
            </div>
            <div className="text-xs font-mono text-cyan-300 break-words">
              {scan.scoreBreakdown.formulaText}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Heuristic static checks only — not a complete security audit, certification, or proof of exploitability.
            </p>
          </div>
        </div>

        {/* Transparent Weight & Coverage Breakdown */}
        <div className="lg:col-span-7 lg:border-l lg:border-slate-800/80 lg:pl-6 grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
          <div>
            <div className="text-xs text-slate-400">Files Scanned</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
              {scan.filesScanned}
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              {scan.filesSkipped} skipped · {scan.linesScanned} lines
            </div>
          </div>
          <div>
            <div className="text-xs text-rose-400">Critical (-20 ea)</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-rose-400 mt-1">
              {scan.severityCounts.critical}
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              -{scan.scoreBreakdown.penalties.critical} pts
            </div>
          </div>
          <div>
            <div className="text-xs text-orange-400">High (-10 ea)</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-orange-400 mt-1">
              {scan.severityCounts.high}
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              -{scan.scoreBreakdown.penalties.high} pts
            </div>
          </div>
          <div>
            <div className="text-xs text-amber-400">Med (-4) / Low (-1)</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1">
              {scan.severityCounts.medium} / {scan.severityCounts.low}
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              -{scan.scoreBreakdown.penalties.medium + scan.scoreBreakdown.penalties.low} pts
            </div>
          </div>
        </div>
      </section>

      {/* Previous vs Current Scan Comparison */}
      {priorProjectScans.length > 0 && comparison && (
        <section className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <GitCompareArrows className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Scan Comparison (Previous vs. Current)
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                  <span>
                    Score: {comparison.previousScan.securityScore} → {comparison.currentScan.securityScore}
                  </span>
                  {comparison.scoreDelta !== 0 && (
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        comparison.scoreDelta > 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {comparison.scoreDelta > 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {comparison.scoreDelta > 0
                        ? `+${comparison.scoreDelta}`
                        : comparison.scoreDelta}{' '}
                      pts
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Baseline scan for comparison"
                value={compareScanId}
                onChange={(e) => setCompareScanId(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#060B16] border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
              >
                {priorProjectScans.map((prev) => (
                  <option key={prev.id} value={prev.id}>
                    vs {prev.id} ({new Date(prev.createdAt).toLocaleTimeString()} · {prev.securityScore}/100)
                  </option>
                ))}
              </select>

              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#060B16] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDiffTab('resolved')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    diffTab === 'resolved'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  Resolved ({comparison.resolved.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDiffTab('remaining')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    diffTab === 'remaining'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  Remaining ({comparison.remaining.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDiffTab('newlyDetected')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    diffTab === 'newlyDetected'
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  New ({comparison.newlyDetected.length})
                </button>
              </div>
            </div>
          </div>

          <div className="p-4">
            {activeDiffList.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                {diffTab === 'resolved'
                  ? 'No previously detected findings were resolved between these two scans.'
                  : diffTab === 'remaining'
                    ? 'Zero findings remain from the previous scan.'
                    : 'No newly introduced findings detected since the previous scan.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {activeDiffList.map((item) => (
                  <div
                    key={`${diffTab}-${item.id}-${item.filePath}-${item.lineNumber}`}
                    onClick={() => {
                      if (diffTab !== 'resolved') {
                        onSelectFinding(item.id);
                      }
                    }}
                    className={`py-2.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      diffTab !== 'resolved'
                        ? 'hover:bg-slate-800/40 rounded cursor-pointer'
                        : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                      <SeverityLabel severity={item.severity} />
                      <span className="font-mono text-slate-400">{item.ruleId}</span>
                      <span className="font-medium text-slate-200 truncate">
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-cyan-300 tabular-nums">
                        {item.filePath}:{item.lineNumber}
                      </span>
                      {diffTab === 'resolved' ? (
                        <span className="text-emerald-400 font-semibold">
                          Resolved
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          {diffTab === 'newlyDetected' ? 'New' : 'Open'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Filters Toolbar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0B1221] border border-slate-800">
          {(
            [
              { id: 'all', label: `All (${scan.findings.length})` },
              { id: 'critical', label: `Critical (${scan.severityCounts.critical})` },
              { id: 'high', label: `High (${scan.severityCounts.high})` },
              { id: 'medium', label: `Medium (${scan.severityCounts.medium})` },
              { id: 'low', label: `Low (${scan.severityCounts.low})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSeverityFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                severityFilter === tab.id
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter findings by file"
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0B1221] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 max-w-[240px]"
          >
            <option value="all">All Files ({fileOptions.length})</option>
            {fileOptions.map((fp) => (
              <option key={fp} value={fp}>
                {fp}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rules, paths, snippets..."
              className="pl-9 pr-3 py-2 rounded-lg bg-[#0B1221] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-60"
            />
          </div>
        </div>
      </section>

      {/* Findings Table */}
      <section className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl overflow-hidden">
        {filteredFindings.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
            <h2 className="text-base font-semibold text-slate-100">
              {scan.findings.length === 0
                ? 'No matching patterns found by enabled heuristic checks'
                : 'No findings match your current filters'}
            </h2>
            <p className="text-xs text-slate-400">
              {scan.findings.length === 0
                ? 'All analyzed lines passed the enabled deterministic rules. Heuristic checks do not replace a full manual security audit.'
                : 'Try resetting the severity filter, file filter, or search query.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/40 text-xs font-medium text-slate-400">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Rule ID</th>
                  <th className="py-3 px-4">Vulnerability</th>
                  <th className="py-3 px-4">File & Line</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredFindings.map((finding: SecurityFinding) => (
                  <tr
                    key={finding.id}
                    onClick={() => onSelectFinding(finding.id)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <SeverityLabel severity={finding.severity} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-cyan-300 whitespace-nowrap">
                      {finding.ruleId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-100">
                        {finding.title}
                      </div>
                      <div className="font-mono text-xs text-slate-500 truncate max-w-md mt-0.5">
                        {finding.evidenceSnippet}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-cyan-300 whitespace-nowrap tabular-nums">
                      {finding.filePath}:{finding.lineNumber}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                      {finding.patchedInWorkspace ? (
                        <span className="text-emerald-400 font-medium">
                          Patched (rescan pending)
                        </span>
                      ) : (
                        <span className="text-slate-400">Open</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFinding(finding.id);
                        }}
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                      >
                        Inspect & Fix
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
