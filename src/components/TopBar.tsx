import { Loader2, Menu, ScanSearch, ShieldCheck } from 'lucide-react';
import {
  ActiveWorkspace,
  PageId,
  ScanProgress,
  ScanRecord,
} from '../types/scanner';

interface TopBarProps {
  activePage: PageId;
  workspace: ActiveWorkspace | null;
  activeScan: ScanRecord | null;
  scanProgress: ScanProgress;
  onOpenMobileMenu: () => void;
  onQuickScan: () => void;
}

const PAGE_TITLES: Record<PageId, string> = {
  dashboard: 'Dashboard',
  scan: 'New Security Scan',
  results: 'Scan Results',
  details: 'Vulnerability Details',
  history: 'Scan History',
  reports: 'Security Reports',
  settings: 'Settings & About',
};

export function TopBar({
  activePage,
  workspace,
  activeScan,
  scanProgress,
  onOpenMobileMenu,
  onQuickScan,
}: TopBarProps) {
  const activeProjectLabel =
    workspace?.projectName ?? activeScan?.projectName ?? null;
  const activeOrigin = workspace?.origin ?? activeScan?.origin ?? null;

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#060B16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Left: Mobile menu button + Breadcrumb & project context */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm min-w-0"
        >
          <span className="text-slate-400 font-medium whitespace-nowrap">
            ShipSafe
          </span>
          <span className="text-slate-600" aria-hidden="true">
            /
          </span>
          <h2 className="font-display text-slate-100 font-semibold whitespace-nowrap text-sm sm:text-base">
            {PAGE_TITLES[activePage]}
          </h2>

          {activeProjectLabel && (
            <>
              <span className="hidden md:inline text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="hidden md:inline text-slate-400 truncate max-w-[220px]">
                {activeProjectLabel}
              </span>
              {activeOrigin && (
                <>
                  <span
                    className="hidden xl:inline text-slate-600"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  <span
                    className={`hidden xl:inline text-xs font-medium whitespace-nowrap ${
                      activeOrigin === 'demo' ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    {activeOrigin === 'demo' ? 'Built-in Demo' : 'Local Upload'}
                  </span>
                </>
              )}
            </>
          )}
        </nav>
      </div>

      {/* Right: Real scan status indicator + Quick Scan action */}
      <div className="flex items-center gap-4 shrink-0">
        {scanProgress.isScanning ? (
          <div
            className="hidden sm:flex items-center gap-2 text-xs font-medium text-cyan-300 whitespace-nowrap font-mono tabular-nums"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" aria-hidden="true" />
            <span>
              Scanning {scanProgress.processedFiles}/{scanProgress.totalFiles} files
            </span>
          </div>
        ) : activeScan ? (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap font-mono tabular-nums">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>
              Latest score{' '}
              <span className="text-slate-200 font-semibold">
                {activeScan.securityScore}/100
              </span>
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span>
              {activeScan.findings.length}{' '}
              {activeScan.findings.length === 1 ? 'finding' : 'findings'}
            </span>
          </div>
        ) : workspace ? (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
            <span>
              {workspace.files.filter((f) => f.isEligible).length} files ready to scan
            </span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onQuickScan}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs sm:text-sm transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_20px_-6px_rgba(6,182,212,0.55)]"
        >
          <ScanSearch className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Quick Scan</span>
        </button>
      </div>
    </header>
  );
}
