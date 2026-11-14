import { ScanRecord } from '../types/scanner';

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildJsonReport(scan: ScanRecord): string {
  const payload = {
    reportGeneratedAt: new Date().toISOString(),
    scanner: 'ShipSafe Local-First Static Security Scanner',
    privacyNotice:
      'Your source code is processed locally in your browser. ShipSafe does not send project files to an external AI service.',
    scoreDisclaimer:
      'Estimated heuristic score calculated deterministically from local rule findings; not a security certification.',
    scanSummary: {
      scanId: scan.id,
      projectName: scan.projectName,
      origin: scan.origin,
      uploadType: scan.uploadType,
      scannedAt: scan.createdAt,
      durationMs: scan.durationMs,
      filesTotal: scan.filesTotal,
      filesScanned: scan.filesScanned,
      filesSkipped: scan.filesSkipped,
      linesScanned: scan.linesScanned,
      securityScore: scan.securityScore,
      scoreBreakdown: scan.scoreBreakdown,
      severityCounts: scan.severityCounts,
      totalFindings: scan.findings.length,
    },
    findings: scan.findings.map((f) => ({
      id: f.id,
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity,
      category: f.categoryLabel,
      filePath: f.filePath,
      lineNumber: f.lineNumber,
      columnStart: f.columnStart,
      evidenceSnippet: f.evidenceSnippet,
      explanation: f.explanation,
      impact: f.impact,
      remediation: f.remediation,
      suggestedFix: f.suggestedFix,
      patchedInWorkspace: f.patchedInWorkspace,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

export function buildCsvReport(scan: ScanRecord): string {
  const headers = [
    'Finding ID',
    'Rule ID',
    'Severity',
    'Category',
    'Title',
    'File Path',
    'Line Number',
    'Evidence Snippet',
    'Explanation',
    'Potential Impact',
    'Recommended Remediation',
    'Suggested Fix',
    'Patched In Workspace',
    'Project Name',
    'Origin',
    'Heuristic Score',
  ];

  const rows = scan.findings.map((f) =>
    [
      f.id,
      f.ruleId,
      f.severity.toUpperCase(),
      f.categoryLabel,
      f.title,
      f.filePath,
      f.lineNumber,
      f.evidenceSnippet,
      f.explanation,
      f.impact,
      f.remediation,
      f.suggestedFix,
      f.patchedInWorkspace ? 'Yes' : 'No',
      scan.projectName,
      scan.origin === 'demo' ? 'Built-in Demo' : 'User Upload',
      scan.securityScore,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  if (rows.length === 0) {
    rows.push(
      [
        'NONE',
        'N/A',
        'NONE',
        'Summary',
        'No vulnerabilities detected by enabled deterministic rules',
        '-',
        0,
        '-',
        '-',
        '-',
        '-',
        '-',
        'N/A',
        scan.projectName,
        scan.origin === 'demo' ? 'Built-in Demo' : 'User Upload',
        scan.securityScore,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
