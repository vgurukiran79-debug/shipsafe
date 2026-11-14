import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { buildDemoWorkspace } from '../src/engine/demoProject';
import { buildCsvReport, buildJsonReport } from '../src/engine/reports';
import { compareScans } from '../src/engine/scanDiff';
import {
  extractZipArchive,
  ingestUploadedFiles,
  runLocalScan,
} from '../src/engine/scanner';
import {
  DEFAULT_SETTINGS,
  clearScanHistoryStorage,
  loadScanHistory,
  saveScanHistory,
} from '../src/utils/storage';

// Minimal localStorage polyfill for Node environment testing
function installLocalStorageMock() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

test('QA #1: Upload and scan an individual JavaScript file with exact line numbers', async () => {
  const jsCode = [
    '// clean header',
    'const safe = JSON.parse("{}");',
    'const dangerous = eval(userInput);',
    'document.getElementById("out").innerHTML = userInput;',
  ].join('\n');

  const jsFile = new File([jsCode], 'handler.js', { type: 'text/javascript' });
  const { projectName, files } = await ingestUploadedFiles(
    [jsFile],
    DEFAULT_SETTINGS.maxFileSizeKb
  );

  assert.equal(projectName, 'handler.js');
  assert.equal(files.length, 1);
  assert.equal(files[0].language, 'javascript');

  const scan = await runLocalScan(
    files,
    { projectName, origin: 'upload', uploadType: 'files' },
    DEFAULT_SETTINGS
  );

  assert.equal(scan.filesScanned, 1);
  assert.equal(scan.findings.length, 2);
  const evalFinding = scan.findings.find((f) => f.ruleId === 'JS-001');
  const domFinding = scan.findings.find((f) => f.ruleId === 'DOM-001');
  assert.equal(evalFinding?.filePath, 'handler.js');
  assert.equal(evalFinding?.lineNumber, 3);
  assert.equal(domFinding?.filePath, 'handler.js');
  assert.equal(domFinding?.lineNumber, 4);
});

test('QA #2: Upload and scan an individual Python file with exact line numbers', async () => {
  const pyCode = [
    'import subprocess',
    'import requests',
    'subprocess.run(cmd, shell=True)',
    'resp = requests.get("https://example.com", verify=False)',
  ].join('\n');

  const pyFile = new File([pyCode], 'worker.py', { type: 'text/x-python' });
  const { projectName, files } = await ingestUploadedFiles(
    [pyFile],
    DEFAULT_SETTINGS.maxFileSizeKb
  );

  assert.equal(projectName, 'worker.py');
  assert.equal(files[0].language, 'python');

  const scan = await runLocalScan(
    files,
    { projectName, origin: 'upload', uploadType: 'files' },
    DEFAULT_SETTINGS
  );

  assert.equal(scan.findings.length, 2);
  assert.ok(scan.findings.some((f) => f.ruleId === 'PY-001' && f.lineNumber === 3));
  assert.ok(scan.findings.some((f) => f.ruleId === 'TLS-001' && f.lineNumber === 4));
});

test('QA #3 & #4: Upload valid ZIP project and reject invalid ZIP gracefully', async () => {
  const zip = new JSZip();
  zip.file('acme/src/config.yaml', 'app:\n  debug: true\n  url: http://api.example.com\n');
  const zipBuf = await zip.generateAsync({ type: 'arraybuffer' });
  const validZip = new File([zipBuf], 'acme.zip', { type: 'application/zip' });

  const extracted = await extractZipArchive(validZip, DEFAULT_SETTINGS.maxFileSizeKb);
  assert.equal(extracted.projectName, 'acme');
  assert.equal(extracted.files.length, 1);
  assert.equal(extracted.files[0].path, 'src/config.yaml');

  const scan = await runLocalScan(
    extracted.files,
    { projectName: extracted.projectName, origin: 'upload', uploadType: 'zip' },
    DEFAULT_SETTINGS
  );
  assert.equal(scan.findings.length, 2);

  const invalidZip = new File(['corrupt-bytes-not-zip'], 'bad.zip', {
    type: 'application/zip',
  });
  await assert.rejects(
    () => extractZipArchive(invalidZip, DEFAULT_SETTINGS.maxFileSizeKb),
    /corrupted|not a valid ZIP/i
  );
});

test('QA #5 & #6: Scan vulnerable demo project vs clean project', async () => {
  const demo = buildDemoWorkspace(DEFAULT_SETTINGS.maxFileSizeKb);
  const demoScan = await runLocalScan(
    demo.files,
    { projectName: demo.projectName, origin: 'demo', uploadType: 'demo' },
    DEFAULT_SETTINGS
  );
  assert.ok(demoScan.findings.length >= 8);
  assert.ok(demoScan.severityCounts.critical > 0);
  assert.ok(demoScan.severityCounts.high > 0);
  assert.ok(demoScan.severityCounts.medium > 0);
  assert.ok(demoScan.securityScore < 100);

  // Every finding must have beginner explanation, impact, remediation, and suggestedFix
  for (const finding of demoScan.findings) {
    assert.ok(finding.ruleId);
    assert.ok(finding.explanation.length > 15);
    assert.ok(finding.impact.length > 15);
    assert.ok(finding.remediation.length > 15);
    assert.ok(finding.suggestedFix.length > 0);
  }

  // Clean project check
  const cleanFile = new File(
    [
      'export async function fetchUser(db: { query: (s: string, p: unknown[]) => Promise<unknown> }, id: string) {\n  return db.query("SELECT id, name FROM users WHERE id = $1", [id]);\n}\n',
    ],
    'clean.ts',
    { type: 'text/typescript' }
  );
  const cleanIngest = await ingestUploadedFiles([cleanFile], DEFAULT_SETTINGS.maxFileSizeKb);
  const cleanScan = await runLocalScan(
    cleanIngest.files,
    { projectName: 'clean-repo', origin: 'upload', uploadType: 'files' },
    DEFAULT_SETTINGS
  );
  assert.equal(cleanScan.findings.length, 0);
  assert.equal(cleanScan.securityScore, 100);
});

test('QA #12, #13, #14 & #15: Patch, rescan diff, JSON/CSV reports, and localStorage history persistence', async () => {
  installLocalStorageMock();
  clearScanHistoryStorage();

  const demo = buildDemoWorkspace(DEFAULT_SETTINGS.maxFileSizeKb);
  const initialScan = await runLocalScan(
    demo.files,
    { projectName: demo.projectName, origin: 'demo', uploadType: 'demo' },
    DEFAULT_SETTINGS
  );

  // Apply fix to the first finding (same line-replacement logic as App.tsx)
  const target = initialScan.findings[0];
  const patchedFiles = demo.files.map((file) => {
    if (file.path !== target.filePath) return file;
    const lines = file.content.split(/\r?\n/);
    lines[target.lineNumber - 1] = target.suggestedFix;
    return { ...file, content: lines.join('\n'), isModified: true };
  });

  const rescan = await runLocalScan(
    patchedFiles,
    {
      projectName: demo.projectName,
      origin: 'demo',
      uploadType: 'demo',
      parentScanId: initialScan.id,
    },
    DEFAULT_SETTINGS
  );

  const diff = compareScans(rescan, initialScan);
  assert.ok(diff.resolved.some((f) => f.ruleId === target.ruleId && f.filePath === target.filePath && f.lineNumber === target.lineNumber));
  assert.equal(diff.remaining.length, initialScan.findings.length - 1);
  assert.equal(diff.newlyDetected.length, 0);
  assert.ok(diff.scoreDelta > 0);

  // Reports validation
  const jsonText = buildJsonReport(rescan);
  const parsedJson = JSON.parse(jsonText);
  assert.equal(parsedJson.scanSummary.scanId, rescan.id);
  assert.equal(parsedJson.findings.length, rescan.findings.length);

  const csvText = buildCsvReport(rescan);
  const csvLines = csvText.trim().split('\r\n');
  assert.equal(csvLines.length, rescan.findings.length + 1); // header + rows
  assert.ok(csvLines[0].includes('Rule ID'));

  // localStorage persistence across simulated page refresh
  saveScanHistory([rescan, initialScan]);
  const reloaded = loadScanHistory();
  assert.equal(reloaded.length, 2);
  assert.equal(reloaded[0].id, rescan.id);
  assert.equal(reloaded[1].id, initialScan.id);
});
