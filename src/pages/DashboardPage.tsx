import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCode2,
  FolderGit2,
  Layers,
  Play,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { ScanActivityChart } from '../components/ScanActivityChart';
import { SeverityChart } from '../components/SeverityChart';
import {
  getScoreBarClass,
  getScoreColorClass,
} from '../components/SeverityLabel';
import { compareScans } from '../engine/scanDiff';
import {
  PageId,
  ScanRecord,
  ScannerSettings,
  SeverityCounts,
} from '../types/scanner';

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

    const categoryMap = new Map<string, number>();

    for (const scan of filteredScans) {
      totals.critical += scan.severityCounts.critical;
      totals.high += scan.severityCounts.high;
      totals.medium += scan.severityCounts.medium;
      totals.low += scan.severityCounts.low;
      totalVulns += scan.findings.length;

      for (const finding of scan.findings) {
        categoryMap.set(
          finding.categoryLabel,
          (categoryMap.get(finding.categoryLabel) ?? 0) + 1
        );
      }
    }

    // Compute resolved findings deterministically across consecutive project scans / rescans
    const scanById = new Map<string, ScanRecord>(
      scanHistory.map((s) => [s.id, s])
    );
    const chronologicalFiltered = [...filteredScans].reverse();
    const lastScanByProject = new Map<string, ScanRecord>();

    let resolvedTotal = 0;
    let rescanPairs = 0;

    for (const scan of chronologicalFiltered) {
      const explicitParent = scan.parentScanId
        ? scanById.get(scan.parentScanId)
        : undefined;
      const projectKey = `${scan.origin}::${scan.projectName}`;
      const priorScan = explicitParent ?? lastScanByProject.get(projectKey);

      if (priorScan && priorScan.id !== scan.id) {
        const diff = compareScans(scan, priorScan);
        resolvedTotal += diff.resolved.length;
        rescanPairs += 1;
      }

      lastScanByProject.set(projectKey, scan);
    }

    const topCategories = Array.from(categoryMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

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
      resolvedTotal,
      rescanPairs,
      topCategories,
      latestScan,
      averageScore,
    };
  }, [filteredScans, scanHistory]);

  const recommendedAction = useMemo(() => {
    const latest = metrics.latestScan;
    if (!latest) return null;

    const topCritical = latest.findings.find((f) => f.severity === 'critical');
    if (topCritical) {
      return {
        tone: 'critical' as const,
        title: `Remediate ${topCritical.title}`,
        detail: `${latest.projectName} has ${latest.severityCounts.critical} critical ${
          latest.severityCounts.critical === 1 ? 'finding' : 'findings'
        }. Inspect ${topCritical.filePath} (line ${topCritical.lineNumber}) and apply a verified patch before deploying.`,
        ctaLabel: 'Inspect Latest Scan',
        action: () => onOpenScan(latest.id),
      };
    }

    const topHigh = latest.findings.find((f) => f.severity === 'high');
    if (topHigh) {
      return {
        tone: 'high' as const,
        title: `Address High-Severity Risk (${topHigh.ruleId})`,
        detail: `No critical secrets remain in ${latest.projectName}, but ${latest.severityCounts.high} high-severity ${
          latest.severityCounts.high === 1 ? 'issue needs' : 'issues need'
        } review starting at ${topHigh.filePath}:${topHigh.lineNumber}.`,
        ctaLabel: 'Review Findings',
        action: () => onOpenScan(latest.id),
      };
    }

    if (latest.findings.length > 0) {
      return {
        tone: 'medium' as const,
        title: 'Harden Remaining Medium & Low Checks',
        detail: `${latest.projectName} has ${latest.findings.length} remaining configuration or best-practice ${
          latest.findings.length === 1 ? 'note' : 'notes'
        }. Review and export a compliance summary.`,
        ctaLabel: 'Open Scan Results',
        action: () => onOpenScan(latest.id),
      };
    }

    return {
      tone: 'clean' as const,
      title: 'Export Report or Scan Next Repository',
      detail: `${latest.projectName} passed all enabled static checks with zero findings. Export your JSON/CSV report or scan another codebase.`,
      ctaLabel: 'Export Security Report',
      action: () => onNavigate('reports'),
    };
  }, [metrics.latestScan, onNavigate, onOpenScan]);

  return (
    <div className="space-y-7">
      {/* Welcome Banner & Scope Filter */}
      <section className="relative overflow-hidden bg-[#0B1221] border border-slate-800/90 rounded-2xl p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              Security Overview
            </h1>
            <p className="text-sm sm:text-base font-medium text-cyan-300">
              Your code. Your security. Your control.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              ShipSafe executes deterministic static security checks entirely inside your browser—helping you catch exposed secrets, injection risks, and unsafe configuration before shipping code.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('scan')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-sm transition-colors duration-150 whitespace-nowrap cursor-pointer shadow-[0_0_24px_-6px_rgba(6,182,212,0.6)]"
              >
                <ScanSearch className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Start New Security Scan</span>
              </button>
              <button
                type="button"
                onClick={onQuickLoadDemoAndScan}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700/90 bg-slate-900/70 hover:bg-slate-800/80 hover:border-slate-600 text-slate-200 font-medium text-sm transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
                <span>Scan Demo Project</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-400">
              Dashboard Scope
            </span>
            <div
              role="group"
              aria-label="Filter dashboard metrics by project origin"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#060B16] border border-slate-800"
            >
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
        </div>
      </section>

      {/* 4 Security KPI Cards (Real local metrics, 0 when empty) */}
      <section
        aria-label="Security key performance indicators"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-[#0B1221] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-3 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">
              Total Scans
            </span>
            <Activity className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-100">
            {metrics.totalScans}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {metrics.uniqueProjects}{' '}
            {metrics.uniqueProjects === 1 ? 'unique project' : 'unique projects'}
          </div>
        </div>

        <div className="bg-[#0B1221] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-3 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">
              Total Vulnerabilities
            </span>
            <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-100">
            {metrics.totalVulns}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {metrics.totals.high} High · {metrics.totals.medium} Med · {metrics.totals.low} Low
          </div>
        </div>

        <div className="bg-[#0B1221] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-3 hover:border-rose-500/30 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-rose-400">
              Critical Vulnerabilities
            </span>
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
          </div>
          <div
            className={`text-3xl font-bold font-mono tabular-nums ${
              metrics.totals.critical > 0 ? 'text-rose-400' : 'text-slate-100'
            }`}
          >
            {metrics.totals.critical}
          </div>
          <div className="text-xs text-slate-500">
            Penalty weight: -20 pts each
          </div>
        </div>

        <div className="bg-[#0B1221] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-3 hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-emerald-400">
              Resolved Findings
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          </div>
          <div
            className={`text-3xl font-bold font-mono tabular-nums ${
              metrics.resolvedTotal > 0 ? 'text-emerald-400' : 'text-slate-100'
            }`}
          >
            {metrics.resolvedTotal}
          </div>
          <div className="text-xs text-slate-500">
            {metrics.rescanPairs > 0
              ? `Verified across ${metrics.rescanPairs} ${
                  metrics.rescanPairs === 1 ? 'rescan' : 'rescans'
                }`
              : 'Rescan after applying fixes to verify'}
          </div>
        </div>
      </section>

      {/* First-Time Empty State OR Full Analytics Dashboard */}
      {scanHistory.length === 0 ? (
        <section className="bg-[#0B1221] border border-slate-800/80 rounded-2xl p-8 sm:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Cybersecurity SVG Illustration */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <div className="w-full max-w-xs aspect-[4/3] rounded-xl bg-[#060B16] border border-slate-800/80 flex items-center justify-center p-6">
                <svg
                  viewBox="0 0 240 180"
                  className="w-full h-full"
                  role="img"
                  aria-label="Local-first browser security shield illustration"
                >
                  <defs>
                    <linearGradient
                      id="shieldGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.12" />
                    </linearGradient>
                    <linearGradient
                      id="shieldStroke"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#22D3EE" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                  {/* Subtle grid lines */}
                  <line x1="20" y1="45" x2="220" y2="45" stroke="#1E293B" strokeWidth="1" />
                  <line x1="20" y1="90" x2="220" y2="90" stroke="#1E293B" strokeWidth="1" />
                  <line x1="20" y1="135" x2="220" y2="135" stroke="#1E293B" strokeWidth="1" />
                  <line x1="70" y1="20" x2="70" y2="160" stroke="#1E293B" strokeWidth="1" />
                  <line x1="170" y1="20" x2="170" y2="160" stroke="#1E293B" strokeWidth="1" />

                  {/* Decorative code bars */}
                  <rect x="28" y="58" width="32" height="6" rx="2" fill="#1E293B" />
                  <rect x="28" y="72" width="22" height="6" rx="2" fill="#0E7490" fillOpacity="0.6" />
                  <rect x="180" y="98" width="32" height="6" rx="2" fill="#1E293B" />
                  <rect x="186" y="112" width="26" height="6" rx="2" fill="#1D4ED8" fillOpacity="0.6" />

                  {/* Outer radar ring */}
                  <circle
                    cx="120"
                    cy="90"
                    r="56"
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />

                  {/* Central Shield */}
                  <path
                    d="M120 38 L160 54 V92 C160 119 142 138 120 146 C98 138 80 119 80 92 V54 Z"
                    fill="url(#shieldGrad)"
                    stroke="url(#shieldStroke)"
                    strokeWidth="2"
                  />

                  {/* Checkmark & code bracket accent */}
                  <path
                    d="M105 91 L115 101 L136 79"
                    fill="none"
                    stroke="#22D3EE"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Onboarding Copy & CTAs */}
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-semibold tracking-wide">
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Local-First Static Security Workspace</span>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
                Your security journey starts here.
              </h2>

              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Upload a compressed ZIP archive or select individual source files (JavaScript, TypeScript, Python, JSON, HTML, CSS, YAML, or environment files) to scan for hardcoded secrets, SQL injection, unsafe execution, DOM XSS, TLS misconfigurations, and weak cryptography—directly inside your browser.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('scan')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ScanSearch className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Start Your First Scan</span>
                </button>
                <button
                  type="button"
                  onClick={onQuickLoadDemoAndScan}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
                  <span>Explore Demo Project</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Security Analytics Grid: Severity Distribution + Scan Activity + Health Summary */}
          <section
            aria-label="Security analytics"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
          >
            {/* 1. Vulnerability Severity Distribution */}
            <div className="lg:col-span-4 bg-[#0B1221] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between space-y-5">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-100">
                  Vulnerability Severity Distribution
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Exact counts across {metrics.totalScans}{' '}
                  {metrics.totalScans === 1 ? 'stored scan' : 'stored scans'}.
                </p>
              </div>

              <SeverityChart counts={metrics.totals} />
            </div>

            {/* 2. Scan Activity Chart */}
            <div className="lg:col-span-4 bg-[#0B1221] border border-slate-800/80 rounded-xl p-6 flex flex-col space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-100">
                  Scan Activity
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Recent scan runs and findings recorded in local storage.
                </p>
              </div>

              <ScanActivityChart
                scans={filteredScans}
                onOpenScan={onOpenScan}
              />
            </div>

            {/* 3. Security Health Summary */}
            <div className="lg:col-span-4 bg-[#0B1221] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-100">
                    Security Health Summary
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {metrics.latestScan
                      ? `Latest run: ${metrics.latestScan.projectName}`
                      : 'No scans match the selected filter.'}
                  </p>
                </div>

                {metrics.latestScan ? (
                  <div className="space-y-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-4xl font-bold font-mono tabular-nums ${getScoreColorClass(
                            metrics.latestScan.securityScore
                          )}`}
                        >
                          {metrics.latestScan.securityScore}
                        </span>
                        <span className="text-sm font-mono text-slate-500">
                          / 100
                        </span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        Avg across scope: {metrics.averageScore}/100
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-800/90 rounded-sm overflow-hidden">
                      <motion.div
                        key={metrics.latestScan.id}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full origin-left rounded-sm ${getScoreBarClass(
                          metrics.latestScan.securityScore
                        )}`}
                        style={{
                          width: `${metrics.latestScan.securityScore}%`,
                        }}
                      />
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
                        <dt className="text-slate-400">Files scanned</dt>
                        <dd className="font-mono tabular-nums text-slate-200 font-medium">
                          {metrics.latestScan.filesScanned}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
                        <dt className="text-slate-400">Lines analyzed</dt>
                        <dd className="font-mono tabular-nums text-slate-200 font-medium">
                          {metrics.latestScan.linesScanned.toLocaleString()}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
                        <dt className="text-slate-400">Scan duration</dt>
                        <dd className="font-mono tabular-nums text-slate-200 font-medium">
                          {metrics.latestScan.durationMs} ms
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
                        <dt className="text-slate-400">Total penalty</dt>
                        <dd className="font-mono tabular-nums text-rose-400 font-medium">
                          -{metrics.latestScan.scoreBreakdown.totalPenalty} pts
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">
                    Switch scope or run a scan to compute health metrics.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  Heuristic estimate — not a security certification.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300 whitespace-nowrap cursor-pointer"
                >
                  View formula
                </button>
              </div>
            </div>
          </section>

          {/* Recent Scan Activity Table */}
          <section className="bg-[#0B1221] border border-slate-800/80 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-100">
                  Recent Scan Activity
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Inspect completed scans, verify resolved findings, or open reports.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 whitespace-nowrap cursor-pointer"
              >
                <span>View full history</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {filteredScans.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <ShieldAlert
                  className="w-6 h-6 text-slate-500 mx-auto"
                  aria-hidden="true"
                />
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
                <table className="w-full text-left border-collapse min-w-[680px]">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400">
                      <th className="py-2.5 px-3">Project Name</th>
                      <th className="py-2.5 px-3">Scan Date</th>
                      <th className="py-2.5 px-3 text-right">Total Issues</th>
                      <th className="py-2.5 px-3 text-right">Critical Issues</th>
                      <th className="py-2.5 px-3">Scan Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {filteredScans.slice(0, 6).map((scan) => {
                      const totalIssues = scan.findings.length;
                      const criticalIssues = scan.severityCounts.critical;

                      const status =
                        totalIssues === 0
                          ? {
                              label: 'Clean',
                              colorClass: 'text-emerald-400',
                              Icon: CheckCircle2,
                            }
                          : criticalIssues > 0
                            ? {
                                label: 'Action Required',
                                colorClass: 'text-rose-400',
                                Icon: AlertOctagon,
                              }
                            : {
                                label: 'Review Needed',
                                colorClass: 'text-amber-400',
                                Icon: AlertTriangle,
                              };
                      const StatusIcon = status.Icon;

                      return (
                        <tr
                          key={scan.id}
                          onClick={() => onOpenScan(scan.id)}
                          className="hover:bg-slate-800/35 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FolderGit2
                                className="w-4 h-4 text-slate-500 shrink-0"
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-100 truncate max-w-[230px]">
                                  {scan.projectName}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                  <span
                                    className={
                                      scan.origin === 'demo'
                                        ? 'text-cyan-400'
                                        : 'text-slate-400'
                                    }
                                  >
                                    {scan.origin === 'demo'
                                      ? 'Built-in Demo'
                                      : 'Local Upload'}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {scan.filesScanned} files
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap">
                            {new Date(scan.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-200 font-semibold">
                            {totalIssues}
                          </td>
                          <td
                            className={`py-3.5 px-3 text-right font-mono tabular-nums font-semibold ${
                              criticalIssues > 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {criticalIssues}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${status.colorClass}`}
                            >
                              <StatusIcon
                                className="w-3.5 h-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{status.label}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenScan(scan.id);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-700/80 bg-slate-900/70 hover:border-cyan-500/40 hover:text-cyan-300 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                            >
                              <span>View Results</span>
                              <ArrowRight
                                className="w-3 h-3 shrink-0"
                                aria-hidden="true"
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Security Insights Section */}
          <section
            aria-label="Security insights"
            className="bg-[#0B1221] border border-slate-800/80 rounded-xl p-6"
          >
            <div className="mb-5">
              <h2 className="font-display text-base font-semibold text-slate-100">
                Security Insights
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Actionable patterns derived strictly from your local scan results.
              </p>
            </div>

            {filteredScans.length === 0 ? (
              <div className="py-6 text-sm text-slate-400">
                No scans match the current filter to generate insights.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:divide-x lg:divide-slate-800/80">
                {/* Insight 1: Most Common Categories */}
                <div className="space-y-3 lg:pr-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Layers className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
                    <span>Most Common Vulnerability Categories</span>
                  </div>
                  {metrics.topCategories.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      Zero vulnerabilities detected across the selected scans.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {metrics.topCategories.map((cat) => {
                        const sharePct =
                          metrics.totalVulns > 0
                            ? Math.round((cat.count / metrics.totalVulns) * 100)
                            : 0;
                        return (
                          <div key={cat.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-200 truncate pr-2">
                                {cat.label}
                              </span>
                              <span className="font-mono tabular-nums text-slate-400 whitespace-nowrap">
                                {cat.count} ({sharePct}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-800/80 rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-cyan-500/80 rounded-sm"
                                style={{ width: `${Math.max(6, sharePct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Insight 2: Latest Scan Summary */}
                <div className="space-y-3 lg:px-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <FileCode2 className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                    <span>Latest Scan Summary</span>
                  </div>
                  {metrics.latestScan && (
                    <div className="space-y-2 text-sm">
                      <p className="text-slate-300 leading-relaxed">
                        <span className="font-semibold text-slate-100">
                          {metrics.latestScan.projectName}
                        </span>{' '}
                        analyzed{' '}
                        <span className="font-mono tabular-nums text-slate-100">
                          {metrics.latestScan.filesScanned}
                        </span>{' '}
                        files ({metrics.latestScan.linesScanned.toLocaleString()}{' '}
                        lines) with{' '}
                        <span className="font-mono tabular-nums text-slate-100">
                          {metrics.latestScan.findings.length}
                        </span>{' '}
                        detected{' '}
                        {metrics.latestScan.findings.length === 1
                          ? 'issue'
                          : 'issues'}{' '}
                        and a heuristic score of{' '}
                        <span
                          className={`font-mono tabular-nums font-semibold ${getScoreColorClass(
                            metrics.latestScan.securityScore
                          )}`}
                        >
                          {metrics.latestScan.securityScore}/100
                        </span>
                        .
                      </p>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        {metrics.latestScan.severityCounts.critical} Crit ·{' '}
                        {metrics.latestScan.severityCounts.high} High ·{' '}
                        {metrics.latestScan.severityCounts.medium} Med ·{' '}
                        {metrics.latestScan.severityCounts.low} Low
                      </div>
                    </div>
                  )}
                </div>

                {/* Insight 3: Recommended Next Action */}
                <div className="space-y-3 lg:pl-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-800/80 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                      <span>Recommended Next Action</span>
                    </div>
                    {recommendedAction && (
                      <>
                        <div className="text-sm font-semibold text-slate-100">
                          {recommendedAction.title}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {recommendedAction.detail}
                        </p>
                      </>
                    )}
                  </div>

                  {recommendedAction && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={recommendedAction.action}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>{recommendedAction.ctaLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
