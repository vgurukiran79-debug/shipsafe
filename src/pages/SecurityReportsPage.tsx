import { Download, FileSpreadsheet, FileText, FileJson } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SeverityLabel, getScoreColorClass } from '../components/SeverityLabel';
import {
  buildCsvReport,
  buildJsonReport,
  downloadTextFile,
} from '../engine/reports';
import { ScanRecord } from '../types/scanner';

interface SecurityReportsPageProps {
  scanHistory: ScanRecord[];
  activeScanId: string | null;
  onGoToNewScan: () => void;
}

export function SecurityReportsPage({
  scanHistory,
  activeScanId,
  onGoToNewScan,
}: SecurityReportsPageProps) {
  const [selectedScanId, setSelectedScanId] = useState<string>(
    activeScanId ?? scanHistory[0]?.id ?? ''
  );

  useEffect(() => {
    if (activeScanId && scanHistory.some((s) => s.id === activeScanId)) {
      setSelectedScanId(activeScanId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScanId]);

  useEffect(() => {
    if (!scanHistory.some((s) => s.id === selectedScanId)) {
      setSelectedScanId(scanHistory[0]?.id ?? '');
    }
  }, [scanHistory, selectedScanId]);

  const selectedScan =
    scanHistory.find((s) => s.id === selectedScanId) ?? scanHistory[0] ?? null;

  const handleDownloadJson = () => {
    if (!selectedScan) return;
    const json = buildJsonReport(selectedScan);
    const slug = selectedScan.projectName.replace(/[^a-zA-Z0-9._-]/g, '_');
    downloadTextFile(
      json,
      `${slug}-${selectedScan.id}-report.json`,
      'application/json'
    );
  };

  const handleDownloadCsv = () => {
    if (!selectedScan) return;
    const csv = buildCsvReport(selectedScan);
    const slug = selectedScan.projectName.replace(/[^a-zA-Z0-9._-]/g, '_');
    downloadTextFile(
      csv,
      `${slug}-${selectedScan.id}-report.csv`,
      'text/csv;charset=utf-8'
    );
  };

  if (!selectedScan) {
    return (
      <div className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-10 text-center space-y-4">
        <FileText className="w-8 h-8 text-slate-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-100">
          No Scan Reports Available
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Complete a local security scan to generate downloadable JSON and CSV reports.
        </p>
        <button
          type="button"
          onClick={onGoToNewScan}
          className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm cursor-pointer"
        >
          Run a Security Scan
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
            Security Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Export deterministic audit summaries and line-level findings as structured JSON or CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            aria-label="Select scan for report export"
            value={selectedScan.id}
            onChange={(e) => setSelectedScanId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0B1221] border border-slate-800 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-cyan-500 max-w-xs"
          >
            {scanHistory.map((s) => (
              <option key={s.id} value={s.id}>
                {s.projectName} ({s.origin === 'demo' ? 'Demo' : 'Upload'} · {s.securityScore}/100)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileJson className="w-4 h-4" />
            <span>Download JSON</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-100 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Report Preview Sheet */}
      <section className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="space-y-1">
            <div className="text-xs font-medium text-cyan-400">
              {selectedScan.origin === 'demo'
                ? 'Built-in Demo Assessment Report'
                : 'Local Project Security Report'}
            </div>
            <h2 className="text-xl font-bold text-slate-100">
              {selectedScan.projectName}
            </h2>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              Scan ID: {selectedScan.id} · Scanned{' '}
              {new Date(selectedScan.createdAt).toLocaleString()}
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-xs text-slate-400">
              Estimated Heuristic Score
            </div>
            <div
              className={`text-3xl font-bold font-mono tabular-nums ${getScoreColorClass(
                selectedScan.securityScore
              )}`}
            >
              {selectedScan.securityScore} / 100
            </div>
            <div className="text-[11px] text-slate-500">
              Not a security certification
            </div>
          </div>
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="text-xs text-slate-400">Files Scanned</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-100 mt-1">
              {selectedScan.filesScanned}
            </div>
          </div>
          <div>
            <div className="text-xs text-rose-400">Critical</div>
            <div className="text-lg font-bold font-mono tabular-nums text-rose-400 mt-1">
              {selectedScan.severityCounts.critical}
            </div>
          </div>
          <div>
            <div className="text-xs text-orange-400">High</div>
            <div className="text-lg font-bold font-mono tabular-nums text-orange-400 mt-1">
              {selectedScan.severityCounts.high}
            </div>
          </div>
          <div>
            <div className="text-xs text-amber-400">Medium</div>
            <div className="text-lg font-bold font-mono tabular-nums text-amber-400 mt-1">
              {selectedScan.severityCounts.medium}
            </div>
          </div>
          <div>
            <div className="text-xs text-sky-400">Low</div>
            <div className="text-lg font-bold font-mono tabular-nums text-sky-400 mt-1">
              {selectedScan.severityCounts.low}
            </div>
          </div>
        </div>

        {/* Findings Preview List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Included Findings ({selectedScan.findings.length})
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {selectedScan.scoreBreakdown.formulaText}
            </span>
          </div>

          {selectedScan.findings.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">
              No findings were detected in this scan. Exported JSON/CSV will record a clean pass.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400">
                    <th className="py-2.5 pr-4">ID</th>
                    <th className="py-2.5 pr-4">Severity</th>
                    <th className="py-2.5 pr-4">Rule</th>
                    <th className="py-2.5 pr-4">Title</th>
                    <th className="py-2.5">File & Line</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {selectedScan.findings.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2.5 pr-4 font-mono text-slate-400 whitespace-nowrap">
                        {f.id}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <SeverityLabel severity={f.severity} />
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-400 whitespace-nowrap">
                        {f.ruleId}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-200 font-medium">
                        {f.title}
                      </td>
                      <td className="py-2.5 font-mono text-cyan-300 whitespace-nowrap tabular-nums">
                        {f.filePath}:{f.lineNumber}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>
            Generated locally inside your browser · No external upload performed
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <Download className="w-3.5 h-3.5" />
            Ready for JSON & CSV export
          </span>
        </div>
      </section>
    </div>
  );
}
