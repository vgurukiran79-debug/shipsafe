import {
  ArrowRight,
  FolderGit2,
  Play,
  ScanSearch,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { SeverityChart } from '../components/SeverityChart';
import { getScoreBarClass, getScoreColorClass } from '../components/SeverityLabel';
import { PageId, ScanRecord, ScannerSettings, SeverityCounts } from '../types/scanner';

interface DashboardPageProps {
  scanHistory: ScanRecord[];
  settings: ScannerSettings;
  onNavigate: (page: PageId) => void;
  onOpenScan: (scanId: string) => void;
  onQuickLoadDemoAndScan: () => void;
}

type OriginFilter = 'all' | 'upload' | 'demo';

export function DashboardPage({
  scanHistory,
  settings,
  onNavigate,
  onOpenScan,
  onQuickLoadDemoAndScan,
}: DashboardPageProps) {
  const [originFilter, setOriginFilter] = useState<OriginFilter>(
    settings.includeDemoInDashboard ? 'all' : 'upload'
  );

  const filteredScans = useMemo(() => {
    if (originFilter === 'all') return scanHistory;
    return scanHistory.filter((s) => s.origin === originFilter);
  }, [scanHistory, originFilter]);

  const metrics = useMemo(() => {
    const uniqueProjects = new Set(filteredScans.map((s) => s.projectName)).size;
    let totalVulns = 0;
    const totals: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const scan of filteredScans) {
      totals.critical += scan.severityCounts.critical;
      totals.high += scan.severityCounts.high;
      totals.medium += scan.severityCounts.medium;
      totals.low += scan.severityCounts.low;
      totalVulns += scan.findings.length;
    }

    const latestScan = filteredScans[0] ?? null;
    const averageScore =
      filteredScans.length > 0
        ? Math.round(
            filteredScans.reduce((acc, s) => acc + s.securityScore, 0) /
              filteredScans.length
          )
        : null;

    return {
      totalScans: filteredScans.length,
      uniqueProjects,
      totalVulns,
      totals,
      latestScan,
      averageScore,
    };
  }, [filteredScans]);

  return (
    <div className="space-y-8">
      {/* Header row with origin scope selector */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
            Security Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregated metrics computed strictly from your local browser scan history.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0B1221] border border-slate-800 self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All Scans' },
              { id: 'upload', label: 'User Projects' },
              { id: 'demo', label: 'Demo Only' },
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
      </div>

      {/* Empty state if no scans match */}
      {scanHistory.length === 0 ? (
        <section className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-8 sm:p-10">
          <div className="max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 text-cyan-400 text-sm font-medium">
              <ShieldCheck className="w-5 h-5" />
              <span>Local-First Static Security Engine Ready</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
              Scan your first repository or test with the built-in demo project
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              No scan records exist in local storage yet. Upload a ZIP archive or source files to run deterministic checks for hardcoded secrets, SQL injection, unsafe eval, DOM XSS, weak cryptography, and configuration risks—all inside your browser.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('scan')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <ScanSearch className="w-4 h-4" />
                <span>Start New Security Scan</span>
              </button>
              <button
                type="button"
                onClick={onQuickLoadDemoAndScan}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 text-cyan-400" />
                <span>Scan Built-in Demo Project</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* KPI Strip */}
          <section
            aria-label="Key security metrics"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"
          >
            <div className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <div className="text-xs font-medium text-slate-400">
                Projects Scanned
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-slate-100">
                {metrics.uniqueProjects}
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                {metrics.totalScans} total {metrics.totalScans === 1 ? 'run' : 'runs'}
              </div>
            </div>

            <div className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <div className="text-xs font-medium text-slate-400">
                Total Vulnerabilities
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-slate-100">
                {metrics.totalVulns}
              </div>
              <div className="text-xs text-slate-500">
                Across filtered scans
              </div>
            </div>

            <div className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <div className="text-xs font-medium text-rose-400">
                Critical Findings
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-rose-400">
                {metrics.totals.critical}
              </div>
              <div className="text-xs text-slate-500">
                Weight: -20 pts each
              </div>
            </div>

            <div className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <div className="text-xs font-medium text-orange-400">
                High-Severity Findings
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-orange-400">
                {metrics.totals.high}
              </div>
              <div className="text-xs text-slate-500">
                Weight: -10 pts each
              </div>
            </div>

            <div className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-5 space-y-2">
              <div className="text-xs font-medium text-slate-400">
                Latest Security Score
              </div>
              {metrics.latestScan ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-bold font-mono tabular-nums ${getScoreColorClass(
                        metrics.latestScan.securityScore
                      )}`}
                    >
                      {metrics.latestScan.securityScore}
                    </span>
                    <span className="text-sm font-mono text-slate-500">/ 100</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${getScoreBarClass(
                        metrics.latestScan.securityScore
                      )}`}
                      style={{ width: `${metrics.latestScan.securityScore}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Estimated heuristic score · Avg {metrics.averageScore}/100
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500 pt-2">No scans in filter</div>
              )}
            </div>
          </section>

          {/* Main 2-column grid: Chart + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Severity Chart */}
            <section className="lg:col-span-5 bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Vulnerability Severity Breakdown
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Deterministic counts from {metrics.totalScans} stored{' '}
                  {metrics.totalScans === 1 ? 'scan' : 'scans'}.
                </p>
              </div>

              <SeverityChart counts={metrics.totals} />

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  Heuristic score is not a certification.
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300 whitespace-nowrap cursor-pointer"
                >
                  View formula
                </button>
              </div>
            </section>

            {/* Recent Scan Activity */}
            <section className="lg:col-span-7 bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-6 flex flex-col">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Recent Scan Activity
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Select any scan run to inspect findings and apply fixes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 whitespace-nowrap cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {filteredScans.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-3">
                  <ShieldAlert className="w-6 h-6 text-slate-500" />
                  <p className="text-sm text-slate-400">
                    No scans match the selected origin filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('scan')}
                    className="text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Upload a project to scan
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400">
                        <th className="py-2.5 px-2">Project</th>
                        <th className="py-2.5 px-2">Origin</th>
                        <th className="py-2.5 px-2 text-right">Files</th>
                        <th className="py-2.5 px-2 text-right">Findings</th>
                        <th className="py-2.5 px-2 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {filteredScans.slice(0, 6).map((scan) => (
                        <tr
                          key={scan.id}
                          onClick={() => onOpenScan(scan.id)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FolderGit2 className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="font-medium text-slate-200 truncate max-w-[200px]">
                                {scan.projectName}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono tabular-nums pl-6 mt-0.5">
                              {new Date(scan.createdAt).toLocaleString()}
                            </div>
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap">
                            <span
                              className={`text-xs font-medium ${
                                scan.origin === 'demo'
                                  ? 'text-cyan-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {scan.origin === 'demo' ? 'Built-in Demo' : 'User Upload'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-300 text-xs">
                            {scan.filesScanned}
                          </td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums text-xs">
                            <span className="text-slate-200 font-semibold">
                              {scan.findings.length}
                            </span>
                            {scan.severityCounts.critical > 0 && (
                              <span className="text-rose-400 ml-1.5">
                                ({scan.severityCounts.critical}C)
                              </span>
                            )}
                          </td>
                          <td
                            className={`py-3 px-2 text-right font-mono tabular-nums font-semibold ${getScoreColorClass(
                              scan.securityScore
                            )}`}
                          >
                            {scan.securityScore}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
