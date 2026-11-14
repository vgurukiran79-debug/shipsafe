import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { buildDemoWorkspace } from './engine/demoProject';
import {
  ScanCancelledError,
  exportWorkspaceAsZip,
  runLocalScan,
} from './engine/scanner';
import { DashboardPage } from './pages/DashboardPage';
import { NewScanPage } from './pages/NewScanPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { ScanResultsPage } from './pages/ScanResultsPage';
import { SecurityReportsPage } from './pages/SecurityReportsPage';
import { SettingsAboutPage } from './pages/SettingsAboutPage';
import { VulnerabilityDetailsPage } from './pages/VulnerabilityDetailsPage';
import {
  ActiveWorkspace,
  PageId,
  ScanProgress,
  ScanRecord,
  ScannerSettings,
  SecurityFinding,
} from './types/scanner';
import {
  clearScanHistoryStorage,
  loadScanHistory,
  loadSettings,
  saveScanHistory,
  saveSettings,
} from './utils/storage';

const INITIAL_PROGRESS: ScanProgress = {
  isScanning: false,
  currentFile: '',
  processedFiles: 0,
  totalFiles: 0,
  findingsSoFar: 0,
};

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [settings, setSettings] = useState<ScannerSettings>(() => loadSettings());
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>(() =>
    loadScanHistory()
  );

  const [workspace, setWorkspace] = useState<ActiveWorkspace | null>(null);
  const [activeScanId, setActiveScanId] = useState<string | null>(
    () => loadScanHistory()[0]?.id ?? null
  );
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null
  );
  const [scanProgress, setScanProgress] =
    useState<ScanProgress>(INITIAL_PROGRESS);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [justCompletedScanId, setJustCompletedScanId] = useState<string | null>(
    null
  );

  const scanAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveScanHistory(scanHistory);
  }, [scanHistory]);

  const activeScan = useMemo(
    () => scanHistory.find((s) => s.id === activeScanId) ?? null,
    [scanHistory, activeScanId]
  );

  const selectedFinding = useMemo(() => {
    if (!activeScan || !selectedFindingId) return null;
    return activeScan.findings.find((f) => f.id === selectedFindingId) ?? null;
  }, [activeScan, selectedFindingId]);

  const handleCancelScan = useCallback(() => {
    scanAbortRef.current?.abort();
  }, []);

  const executeScanOnWorkspace = useCallback(
    async (targetWorkspace: ActiveWorkspace, parentScanId?: string) => {
      scanAbortRef.current?.abort();
      const controller = new AbortController();
      scanAbortRef.current = controller;

      setScanNotice(null);
      const eligibleTotal = targetWorkspace.files.filter(
        (f) => f.isEligible
      ).length;
      setScanProgress({
        isScanning: true,
        currentFile: 'Initializing local rules...',
        processedFiles: 0,
        totalFiles: eligibleTotal,
        findingsSoFar: 0,
      });

      try {
        const record = await runLocalScan(
          targetWorkspace.files,
          {
            projectName: targetWorkspace.projectName,
            origin: targetWorkspace.origin,
            uploadType: targetWorkspace.uploadType,
            parentScanId,
          },
          settings,
          (progress) => setScanProgress(progress),
          controller.signal
        );

        setScanHistory((prev) => [record, ...prev]);
        setActiveScanId(record.id);
        setJustCompletedScanId(record.id);
        setSelectedFindingId(record.findings[0]?.id ?? null);
        setActivePage('results');
      } catch (err) {
        if (err instanceof ScanCancelledError) {
          setScanNotice('Scan was cancelled before completion. No partial results were saved.');
        } else {
          setScanNotice(
            err instanceof Error
              ? `Scan stopped: ${err.message}`
              : 'Scan failed unexpectedly.'
          );
        }
      } finally {
        if (scanAbortRef.current === controller) {
          scanAbortRef.current = null;
        }
        setScanProgress(INITIAL_PROGRESS);
      }
    },
    [settings]
  );

  const handleLoadDemoWorkspace = useCallback(() => {
    setScanNotice(null);
    const demoWs = buildDemoWorkspace(settings.maxFileSizeKb);
    setWorkspace(demoWs);
  }, [settings.maxFileSizeKb]);

  const handleQuickLoadDemoAndScan = useCallback(async () => {
    setScanNotice(null);
    const demoWs = buildDemoWorkspace(settings.maxFileSizeKb);
    setWorkspace(demoWs);
    await executeScanOnWorkspace(demoWs);
  }, [settings.maxFileSizeKb, executeScanOnWorkspace]);

  const handleApplyConfirmedPatch = useCallback(
    (finding: SecurityFinding) => {
      if (!workspace) return;

      const updatedFiles = workspace.files.map((file) => {
        if (file.path !== finding.filePath) return file;
        const lines = file.content.split(/\r?\n/);
        const targetIndex = finding.lineNumber - 1;
        if (targetIndex < 0 || targetIndex >= lines.length) return file;

        const nextLines = [...lines];
        nextLines[targetIndex] = finding.suggestedFix;
        const nextContent = nextLines.join('\n');

        return {
          ...file,
          content: nextContent,
          lineCount: nextLines.length,
          sizeBytes: new TextEncoder().encode(nextContent).length,
          isModified: true,
        };
      });

      setWorkspace({
        ...workspace,
        files: updatedFiles,
      });

      if (activeScanId) {
        setScanHistory((prev) =>
          prev.map((scan) => {
            if (scan.id !== activeScanId) return scan;
            return {
              ...scan,
              findings: scan.findings.map((f) =>
                f.id === finding.id ? { ...f, patchedInWorkspace: true } : f
              ),
            };
          })
        );
      }
    },
    [workspace, activeScanId]
  );

  const handleOpenScan = useCallback((scanId: string) => {
    setJustCompletedScanId(null);
    setActiveScanId(scanId);
    setSelectedFindingId(null);
    setActivePage('results');
  }, []);

  const handleDeleteScan = useCallback(
    (scanId: string) => {
      setScanHistory((prev) => {
        const next = prev.filter((s) => s.id !== scanId);
        if (activeScanId === scanId) {
          setActiveScanId(next[0]?.id ?? null);
          setSelectedFindingId(null);
        }
        return next;
      });
    },
    [activeScanId]
  );

  const handleClearAllHistory = useCallback(() => {
    clearScanHistoryStorage();
    setScanHistory([]);
    setActiveScanId(null);
    setSelectedFindingId(null);
  }, []);

  const handleExportPatchedZip = useCallback(async () => {
    if (!workspace) return;
    await exportWorkspaceAsZip(workspace.files, workspace.projectName);
  }, [workspace]);

  return (
    <div className="min-h-screen bg-[#060B16] text-slate-100 flex">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        hasActiveScan={Boolean(activeScan)}
        hasSelectedFinding={Boolean(selectedFinding)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activePage={activePage}
          workspace={workspace}
          activeScan={activeScan}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickScan={() => setActivePage('scan')}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-7 max-w-[1400px] w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardPage
              scanHistory={scanHistory}
              settings={settings}
              onNavigate={setActivePage}
              onOpenScan={handleOpenScan}
              onQuickLoadDemoAndScan={handleQuickLoadDemoAndScan}
            />
          )}

          {activePage === 'scan' && (
            <NewScanPage
              workspace={workspace}
              settings={settings}
              scanProgress={scanProgress}
              scanNotice={scanNotice}
              onWorkspaceLoaded={(ws) => {
                setScanNotice(null);
                setWorkspace(ws);
              }}
              onLoadDemoWorkspace={handleLoadDemoWorkspace}
              onStartScan={() => {
                if (workspace) {
                  void executeScanOnWorkspace(workspace);
                }
              }}
              onCancelScan={handleCancelScan}
              onClearWorkspace={() => {
                setScanNotice(null);
                setWorkspace(null);
              }}
            />
          )}

          {activePage === 'results' && (
            <ScanResultsPage
              scan={activeScan}
              scanHistory={scanHistory}
              workspace={workspace}
              scanProgress={scanProgress}
              justCompletedScanId={justCompletedScanId}
              onSelectFinding={(id) => {
                setSelectedFindingId(id);
                setActivePage('details');
              }}
              onRescanWorkspace={() => {
                if (workspace) {
                  void executeScanOnWorkspace(workspace, activeScan?.id);
                }
              }}
              onCancelScan={handleCancelScan}
              onExportPatchedZip={() => void handleExportPatchedZip()}
              onOpenReports={() => setActivePage('reports')}
              onGoToNewScan={() => setActivePage('scan')}
            />
          )}

          {activePage === 'details' && (
            <VulnerabilityDetailsPage
              scan={activeScan}
              finding={selectedFinding}
              workspace={workspace}
              scanProgress={scanProgress}
              onBackToResults={() => setActivePage('results')}
              onApplyConfirmedPatch={handleApplyConfirmedPatch}
              onRescanWorkspace={() => {
                if (workspace) {
                  void executeScanOnWorkspace(workspace, activeScan?.id);
                }
              }}
            />
          )}

          {activePage === 'history' && (
            <ScanHistoryPage
              scanHistory={scanHistory}
              onOpenScan={handleOpenScan}
              onOpenReportForScan={(scanId) => {
                setActiveScanId(scanId);
                setActivePage('reports');
              }}
              onDeleteScan={handleDeleteScan}
              onClearAllHistory={handleClearAllHistory}
              onGoToNewScan={() => setActivePage('scan')}
            />
          )}

          {activePage === 'reports' && (
            <SecurityReportsPage
              scanHistory={scanHistory}
              activeScanId={activeScanId}
              onGoToNewScan={() => setActivePage('scan')}
            />
          )}

          {activePage === 'settings' && (
            <SettingsAboutPage
              settings={settings}
              scanCount={scanHistory.length}
              onUpdateSettings={setSettings}
              onClearHistory={handleClearAllHistory}
            />
          )}
        </main>
      </div>
    </div>
  );
}
