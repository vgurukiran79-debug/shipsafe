import {
  FileText,
  FolderGit2,
  History,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { getScoreColorClass } from '../components/SeverityLabel';
import { ScanRecord } from '../types/scanner';

interface ScanHistoryPageProps {
  scanHistory: ScanRecord[];
  onOpenScan: (scanId: string) => void;
  onOpenReportForScan: (scanId: string) => void;
  onDeleteScan: (scanId: string) => void;
  onClearAllHistory: () => void;
  onGoToNewScan: () => void;
}

export function ScanHistoryPage({
  scanHistory,
  onOpenScan,
  onOpenReportForScan,
  onDeleteScan,
  onClearAllHistory,
  onGoToNewScan,
}: ScanHistoryPageProps) {
  const [originFilter, setOriginFilter] = useState<'all' | 'upload' | 'demo'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scanHistory.filter((scan) => {
      if (originFilter !== 'all' && scan.origin !== originFilter) return false;
      if (q) {
        const hay = `${scan.projectName} ${scan.id} ${scan.origin}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scanHistory, originFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
            Scan History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Locally persisted security scan logs stored in browser <span className="font-mono text-slate-300">localStorage</span>.
          </p>
        </div>

        {scanHistory.length > 0 && (
          <div className="shrink-0">
            {confirmClearAll ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-300">Clear all history?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearAllHistory();
                    setConfirmClearAll(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-rose-300 hover:border-rose-500/40 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All History</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0B1221] border border-slate-800 self-start">
          {(
            [
              { id: 'all', label: 'All Scans' },
              { id: 'upload', label: 'User Uploads' },
              { id: 'demo', label: 'Built-in Demo' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOriginFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                originFilter === tab.id
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search project or scan ID..."
            className="pl-9 pr-3 py-2 rounded-lg bg-[#0B1221] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-64"
          />
        </div>
      </div>

      {/* Table or Empty State */}
      <section className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl overflow-hidden">
        {scanHistory.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <History className="w-8 h-8 text-slate-500 mx-auto" />
            <h2 className="text-base font-semibold text-slate-100">
              No scan history recorded yet
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Completed scans are saved automatically in your browser so you can compare scores and export reports later.
            </p>
            <button
              type="button"
              onClick={onGoToNewScan}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              Start a Scan
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No scans match your current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/40 text-xs font-medium text-slate-400">
                  <th className="py-3 px-4">Project & Scan ID</th>
                  <th className="py-3 px-4">Origin</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Files</th>
                  <th className="py-3 px-4 text-right">Severity (C/H/M/L)</th>
                  <th className="py-3 px-4 text-right">Heuristic Score</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filtered.map((scan) => (
                  <tr
                    key={scan.id}
                    onClick={() => onOpenScan(scan.id)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <FolderGit2 className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="font-medium text-slate-100">
                          {scan.projectName}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-500 pl-6 mt-0.5">
                        {scan.id}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                      <span
                        className={`font-semibold ${
                          scan.origin === 'demo' ? 'text-cyan-400' : 'text-slate-300'
                        }`}
                      >
                        {scan.origin === 'demo' ? 'Built-in Demo' : 'User Upload'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-400 whitespace-nowrap">
                      {new Date(scan.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-300">
                      {scan.filesScanned}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                      <span className="text-rose-400">{scan.severityCounts.critical}</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-orange-400">{scan.severityCounts.high}</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-amber-400">{scan.severityCounts.medium}</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-sky-400">{scan.severityCounts.low}</span>
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold ${getScoreColorClass(
                        scan.securityScore
                      )}`}
                    >
                      {scan.securityScore} / 100
                    </td>
                    <td
                      className="py-3.5 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenScan(scan.id)}
                          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                        >
                          Results
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenReportForScan(scan.id)}
                          title="Export report"
                          className="p-1.5 text-slate-400 hover:text-slate-100 rounded-md cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteScan(scan.id)}
                          title="Delete scan"
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
