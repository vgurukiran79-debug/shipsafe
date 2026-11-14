import { BarChart3 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { ScanRecord } from '../types/scanner';

interface ScanActivityChartProps {
  scans: ScanRecord[];
  onOpenScan: (scanId: string) => void;
}

export function ScanActivityChart({
  scans,
  onOpenScan,
}: ScanActivityChartProps) {
  // Show up to 8 most recent scans in chronological left-to-right order
  const chronologicalScans = [...scans].slice(0, 8).reverse();
  const [hoveredScanId, setHoveredScanId] = useState<string | null>(null);

  if (chronologicalScans.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center space-y-2">
        <BarChart3 className="w-6 h-6 text-slate-600" aria-hidden="true" />
        <p className="text-sm text-slate-400">No scan history in current filter.</p>
        <p className="text-xs text-slate-500 max-w-xs">
          Completed browser scans will populate chronological activity bars here.
        </p>
      </div>
    );
  }

  const maxFindings = Math.max(
    1,
    ...chronologicalScans.map((s) => s.findings.length)
  );

  const inspectedScan =
    chronologicalScans.find((s) => s.id === hoveredScanId) ??
    chronologicalScans[chronologicalScans.length - 1];

  return (
    <div className="flex-1 flex flex-col justify-between space-y-4">
      {/* Focused readout for hovered or latest scan */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-slate-800/80">
        <div className="min-w-0">
          <span className="text-slate-400">Selected run: </span>
          <span className="text-slate-100 font-medium truncate">
            {inspectedScan.projectName}
          </span>
        </div>
        <div className="font-mono tabular-nums text-slate-300 whitespace-nowrap">
          <span>
            {inspectedScan.findings.length}{' '}
            {inspectedScan.findings.length === 1 ? 'issue' : 'issues'}
          </span>
          <span className="text-slate-600 mx-1.5" aria-hidden="true">
            ·
          </span>
          <span className="text-cyan-400">
            Score {inspectedScan.securityScore}/100
          </span>
        </div>
      </div>

      {/* Stacked bar chart using real scan counts */}
      <div className="pt-2">
        <div
          className="grid gap-2.5 items-end h-36"
          style={{
            gridTemplateColumns: `repeat(${chronologicalScans.length}, minmax(0, 1fr))`,
          }}
        >
          {chronologicalScans.map((scan, idx) => {
            const totalIssues = scan.findings.length;
            const heightPct =
              totalIssues === 0
                ? 8
                : Math.max(14, Math.round((totalIssues / maxFindings) * 100));

            const criticalPct =
              totalIssues > 0
                ? (scan.severityCounts.critical / totalIssues) * 100
                : 0;
            const highPct =
              totalIssues > 0
                ? (scan.severityCounts.high / totalIssues) * 100
                : 0;
            const remainingPct = Math.max(0, 100 - criticalPct - highPct);

            const isSelected = inspectedScan.id === scan.id;
            const dateLabel = new Date(scan.createdAt).toLocaleDateString(
              undefined,
              { month: 'short', day: 'numeric' }
            );

            return (
              <button
                key={scan.id}
                type="button"
                onMouseEnter={() => setHoveredScanId(scan.id)}
                onFocus={() => setHoveredScanId(scan.id)}
                onClick={() => onOpenScan(scan.id)}
                title={`${scan.projectName}: ${totalIssues} findings, score ${scan.securityScore}/100`}
                className="group flex flex-col items-center justify-end h-full focus:outline-none cursor-pointer"
              >
                <span className="text-[11px] font-mono tabular-nums text-slate-400 group-hover:text-slate-100 mb-1.5 transition-colors">
                  {totalIssues}
                </span>

                <div className="w-full max-w-[38px] flex-1 flex items-end justify-center">
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0.4 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{
                      duration: 0.45,
                      delay: idx * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{ height: `${heightPct}%` }}
                    className={`w-full origin-bottom rounded-t-sm overflow-hidden flex flex-col justify-end transition-all duration-150 ${
                      isSelected
                        ? 'ring-1 ring-cyan-400/70'
                        : 'opacity-85 group-hover:opacity-100'
                    }`}
                  >
                    {totalIssues === 0 ? (
                      <div className="w-full h-full bg-emerald-500/70" />
                    ) : (
                      <>
                        {remainingPct > 0 && (
                          <div
                            style={{ height: `${remainingPct}%` }}
                            className="w-full bg-sky-400/85"
                          />
                        )}
                        {highPct > 0 && (
                          <div
                            style={{ height: `${highPct}%` }}
                            className="w-full bg-orange-500"
                          />
                        )}
                        {criticalPct > 0 && (
                          <div
                            style={{ height: `${criticalPct}%` }}
                            className="w-full bg-rose-500"
                          />
                        )}
                      </>
                    )}
                  </motion.div>
                </div>

                <span className="mt-2 text-[11px] font-mono tabular-nums text-slate-500 group-hover:text-slate-300 truncate max-w-full">
                  {dateLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Honest legend / insufficient-history hint */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        {chronologicalScans.length < 2 ? (
          <span>
            Run a second scan or rescan after patching to compare activity over time.
          </span>
        ) : (
          <span>
            Showing last {chronologicalScans.length} chronological scans (click any bar to open)
          </span>
        )}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-rose-500" aria-hidden="true" />
            Crit
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-orange-500" aria-hidden="true" />
            High
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-sky-400" aria-hidden="true" />
            Med/Low
          </span>
        </div>
      </div>
    </div>
  );
}
