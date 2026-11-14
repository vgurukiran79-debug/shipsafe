import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { buildDemoWorkspace } from '../src/engine/demoProject';
import { compareScans } from '../src/engine/scanDiff';
import {
  ScanCancelledError,
  calculateSecurityScore,
  createVirtualFile,
  extractZipFromBuffer,
  runLocalScan,
} from '../src/engine/scanner';
import { SECURITY_RULES } from '../src/engine/securityRules';
import { DEFAULT_SETTINGS } from '../src/utils/storage';

async function scanSingleVirtualFile(path: string, content: string) {
  const vf = createVirtualFile(
    path,
    content,
    Buffer.byteLength(content, 'utf8'),
    DEFAULT_SETTINGS.maxFileSizeKb
  );
  return runLocalScan(
    [vf],
    {
      projectName: 'unit-test-project',
      origin: 'upload',
      uploadType: 'files',
    },
    DEFAULT_SETTINGS
  );
}

test('Rule catalog contains at least 12 distinct deterministic rules with required metadata', () => {
  assert.ok(SECURITY_RULES.length >= 12);
  const ids = new Set<string>();
  for (const rule of SECURITY_RULES) {
    assert.ok(rule.id);
    assert.ok(!ids.has(rule.id), `Duplicate rule ID: ${rule.id}`);
    ids.add(rule.id);
    assert.ok(rule.description.length > 10);
    assert.ok(rule.remediation.length > 10);
    assert.ok(['critical', 'high', 'medium', 'low'].includes(rule.severity));
    assert.ok(rule.supportedLanguages.length > 0);
  }
});

test('CRED-001 detects hardcoded demo credentials and ignores env lookups & TS types', async () => {
  const vulnerable = await scanSingleVirtualFile(
    'config/auth.ts',
    `const demoPassword = "SuperSecretDemoPass99";\n`
  );
  assert.ok(vulnerable.findings.some((f) => f.ruleId === 'CRED-001' && f.lineNumber === 1));

  const clean = await scanSingleVirtualFile(
    'config/auth.ts',
    `interface AuthPayload {\n  password: string;\n}\nconst dbPassword = process.env.DB_PASSWORD ?? '';\nconst placeholderPass = "your_password_here";\n`
  );
  assert.equal(clean.findings.filter((f) => f.ruleId === 'CRED-001').length, 0);
});

test('CRED-002 detects AWS-style access keys and secret keys', async () => {
  const sampleAwsId = 'AKIA' + 'IOSFODNN7EXAMPLE';
  const sampleAwsSecret = 'wJalrXUtnFEMI' + '/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const vulnerable = await scanSingleVirtualFile(
    'cloud/aws.py',
    `aws_key = "${sampleAwsId}"\naws_secret_access_key = "${sampleAwsSecret}"\n`
  );
  const cred002 = vulnerable.findings.filter((f) => f.ruleId === 'CRED-002');
  assert.equal(cred002.length, 2);
  assert.equal(cred002[0].lineNumber, 1);
  assert.equal(cred002[1].lineNumber, 2);

  const clean = await scanSingleVirtualFile(
    'cloud/aws.py',
    `import os\naws_key = os.environ.get("AWS_ACCESS_KEY_ID", "")\n`
  );
  assert.equal(clean.findings.length, 0);
});

test('CRED-003 detects embedded private key headers', async () => {
  const sampleHeader = '-----BEGIN RSA ' + 'PRIVATE KEY-----';
  const vulnerable = await scanSingleVirtualFile(
    'keys/signing.ts',
    `const pem = "${sampleHeader}";\n`
  );
  assert.ok(vulnerable.findings.some((f) => f.ruleId === 'CRED-003' && f.lineNumber === 1));

  const clean = await scanSingleVirtualFile(
    'keys/signing.ts',
    `const pem = process.env.SIGNING_PRIVATE_KEY ?? '';\n`
  );
  assert.equal(clean.findings.length, 0);
});

test('CRED-004 detects hardcoded API tokens and signing secrets', async () => {
  const sampleStripe = 'sk_live_' + '51N9xAbCdEfGhIjKlMnOpQrSt';
  const vulnerable = await scanSingleVirtualFile(
    'server/stripe.js',
    `const stripeKey = "${sampleStripe}";\nconst jwtSecret = "my_static_jwt_signing_secret_2026";\n`
  );
  const matches = vulnerable.findings.filter((f) => f.ruleId === 'CRED-004');
  assert.equal(matches.length, 2);

  const clean = await scanSingleVirtualFile(
    'server/stripe.js',
    `const stripeKey = process.env.STRIPE_SECRET_KEY ?? '';\nconst jwtSecret = process.env.JWT_SECRET ?? '';\n`
  );
  assert.equal(clean.findings.length, 0);
});

test('JS-001 detects JavaScript eval() and ignores method calls like obj.eval()', async () => {
  const vulnerable = await scanSingleVirtualFile(
    'src/calc.js',
    `const result = eval(userInput);\nconst fn = new Function("return 1");\n`
  );
  const matches = vulnerable.findings.filter((f) => f.ruleId === 'JS-001');
  assert.equal(matches.length, 2);

  const clean = await scanSingleVirtualFile(
    'src/calc.js',
    `const parsed = JSON.parse(userInput);\nconst modelOut = evaluator.eval(tensor);\n`
  );
  assert.equal(clean.findings.filter((f) => f.ruleId === 'JS-001').length, 0);
});

test('DOM-001 detects unsafe innerHTML/document.write and ignores empty clear', async () => {
  const vulnerable = await scanSingleVirtualFile(
    'src/render.html',
    `<script>\nel.innerHTML = userBio;\ndocument.write(banner);\n</script>\n`
  );
  const matches = vulnerable.findings.filter((f) => f.ruleId === 'DOM-001');
  assert.equal(matches.length, 2);

  const clean = await scanSingleVirtualFile(
    'src/render.ts',
    `el.textContent = userBio;\nel.innerHTML = '';\n`
  );
  assert.equal(clean.findings.filter((f) => f.ruleId === 'DOM-001').length, 0);
});

test('SQL-001 detects SQL queries constructed with string concatenation or interpolation', async () => {
  const vulnerableJs = await scanSingleVirtualFile(
    'server/users.ts',
    `const q = "SELECT * FROM users WHERE id = " + req.params.id;\nconst q2 = \`DELETE FROM sessions WHERE token = \${tok}\`;\n`
  );
  assert.equal(vulnerableJs.findings.filter((f) => f.ruleId === 'SQL-001').length, 2);

  const vulnerablePy = await scanSingleVirtualFile(
    'server/users.py',
    `cursor.execute(f"SELECT id FROM users WHERE email = '{email}'")\n`
  );
  assert.equal(vulnerablePy.findings.filter((f) => f.ruleId === 'SQL-001').length, 1);

  const clean = await scanSingleVirtualFile(
    'server/users.ts',
    `const q = "SELECT * FROM users WHERE id = $1";\nawait db.query(q, [req.params.id]);\n`
  );
  assert.equal(clean.findings.filter((f) => f.ruleId === 'SQL-001').length, 0);
});

test('PY-001 detects Python subprocess calls with shell=True (single & multi-line) and ignores shell=False', async () => {
  const vulnerable = await scanSingleVirtualFile(
    'scripts/run.py',
    `import subprocess\nsubprocess.run("ls -la " + folder, shell=True)\nsubprocess.Popen(\n    cmd,\n    shell=True,\n)\n`
  );
  const matches = vulnerable.findings.filter((f) => f.ruleId === 'PY-001');
  assert.equal(matches.length, 2);
  assert.equal(matches[0].lineNumber, 2);
  assert.equal(matches[1].lineNumber, 3);

  const clean = await scanSingleVirtualFile(
    'scripts/run.py',
    `import subprocess\nsubprocess.run(["ls", "-la", folder], shell=False, check=True)\n`
  );
  assert.equal(clean.findings.filter((f) => f.ruleId === 'PY-001').length, 0);
});

test('PY-002 detects Python eval() and exec() and ignores ast.literal_eval() & model.eval()', async () => {
  const vulnerable = await scanSingleVirtualFile(
    'scripts/eval_demo.py',
    `res = eval(raw_expr)\nexec(dynamic_code)\n`
  );
  assert.equal(vulnerable.findings.filter((f) => f.ruleId === 'PY-002').length, 2);

  const clean = await scanSingleVirtualFile(
    'scripts/eval_demo.py',
    `import ast\nres = ast.literal_eval(raw_expr)\nmodel.eval()\n`
  );
  assert.equal(clean.findings.filter((f) => f.ruleId === 'PY-002').length, 0);
});

test('TLS-001 detects disabled TLS verification across JS and Python', async () => {
  const vulnerableJs = await scanSingleVirtualFile(
    'server/http.ts',
    `const agent = new https.Agent({ rejectUnauthorized: false });\n`
  );
  assert.equal(vulnerableJs.findings.filter((f) => f.ruleId === 'TLS-001').length, 1);

  const vulnerablePy = await scanSingleVirtualFile(
    'server/http.py',
    `resp = requests.get("https://api.example.com", verify=False)\n`
  );
  assert.equal(vulnerablePy.findings.filter((f) => f.ruleId === 'TLS-001').length, 1);

  const clean = await scanSingleVirtualFile(
    'server/http.ts',
    `const agent = new https.Agent({ rejectUnauthorized: true });\n`
  );
  assert.equal(clean.findings.filter((f) => f.ruleId === 'TLS-001').length, 0);
});

test('CONF-001 detects debug mode enabled across JSON, YAML, Python, and .env', async () => {
  const vulnJson = await scanSingleVirtualFile('config.json', `{\n  "debug": true\n}\n`);
  const vulnYaml = await scanSingleVirtualFile('config.yaml', `app:\n  debug: true\n`);
  const vulnPy = await scanSingleVirtualFile('app.py', `app.run(host="0.0.0.0", debug=True)\n`);
  const vulnEnv = await scanSingleVirtualFile('.env', `DEBUG=true\nNODE_ENV=development\n`);

  assert.equal(vulnJson.findings.filter((f) => f.ruleId === 'CONF-001').length, 1);
  assert.equal(vulnYaml.findings.filter((f) => f.ruleId === 'CONF-001').length, 1);
  assert.equal(vulnPy.findings.filter((f) => f.ruleId === 'CONF-001').length, 1);
  assert.equal(vulnEnv.findings.filter((f) => f.ruleId === 'CONF-001').length, 2);

  const clean = await scanSingleVirtualFile('config.json', `{\n  "debug": false\n}\n`);
  assert.equal(clean.findings.filter((f) => f.ruleId === 'CONF-001').length, 0);
});

test('NET-001 detects insecure HTTP endpoints across CSS/HTML/YAML and excludes localhost & w3.org', async () => {
  const vulnerableCss = await scanSingleVirtualFile(
    'styles/app.css',
    `@font-face { src: url('http://cdn.example.com/font.woff2'); }\n`
  );
  assert.equal(vulnerableCss.findings.filter((f) => f.ruleId === 'NET-001').length, 1);

  const clean = await scanSingleVirtualFile(
    'src/urls.ts',
    `const local = "http://localhost:3000/api";\nconst svg = "http://www.w3.org/2000/svg";\nconst prod = "https://api.example.com/v1";\n`
  );
  assert.equal(clean.findings.filter((f) => f.ruleId === 'NET-001').length, 0);
});

test('CRYPTO-001, CORS-001, and ENV-001 detect weak crypto, wildcard CORS, and exposed env secrets', async () => {
  const vulnCrypto = await scanSingleVirtualFile(
    'auth.ts',
    `const h = crypto.createHash('md5').update(pw).digest('hex');\nconst resetToken = Math.random().toString(36);\n`
  );
  assert.equal(vulnCrypto.findings.filter((f) => f.ruleId === 'CRYPTO-001').length, 2);

  const vulnCors = await scanSingleVirtualFile(
    'cors.ts',
    `app.use(cors({ origin: '*' }));\n`
  );
  assert.equal(vulnCors.findings.filter((f) => f.ruleId === 'CORS-001').length, 1);

  const vulnEnv = await scanSingleVirtualFile(
    '.env',
    `JWT_SECRET=real_live_secret_value_12345\nVITE_ADMIN_SECRET=exposed_client_key\n`
  );
  assert.equal(vulnEnv.findings.filter((f) => f.ruleId === 'ENV-001').length, 2);

  // .env.example should NOT trigger ENV-001
  const cleanExampleEnv = await scanSingleVirtualFile(
    '.env.example',
    `JWT_SECRET=placeholder_value_only\n`
  );
  assert.equal(cleanExampleEnv.findings.filter((f) => f.ruleId === 'ENV-001').length, 0);
});

test('Scanner excludes binary files, node_modules, .git, build directories, and oversized files', async () => {
  const zip = new JSZip();
  zip.file('my-app/src/index.ts', 'const x = eval("1+1");\n');
  zip.file('my-app/node_modules/pkg/index.js', 'eval("should be ignored");\n');
  zip.file('my-app/.git/config', 'url = http://insecure.example.com\n');
  zip.file('my-app/dist/bundle.js', 'eval("build artifact ignored");\n');
  zip.file('my-app/assets/logo.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
  zip.file('my-app/src/huge.js', 'const a = 1;\n'.repeat(60000)); // > 512 KB

  const buffer = await zip.generateAsync({ type: 'uint8array' });
  const { projectName, files } = await extractZipFromBuffer(buffer, 'my-app.zip', 512);

  assert.equal(projectName, 'my-app');
  const eligible = files.filter((f) => f.isEligible);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].path, 'src/index.ts');

  const scan = await runLocalScan(
    files,
    { projectName, origin: 'upload', uploadType: 'zip' },
    DEFAULT_SETTINGS
  );
  assert.equal(scan.filesScanned, 1);
  assert.equal(scan.filesSkipped, 5);
  assert.equal(scan.findings.length, 1);
  assert.equal(scan.findings[0].filePath, 'src/index.ts');
  assert.equal(scan.findings[0].ruleId, 'JS-001');
  assert.equal(scan.findings[0].lineNumber, 1);
});

test('Scanner rejects corrupted and empty ZIP files gracefully', async () => {
  const badBytes = new TextEncoder().encode('not-a-zip-archive');
  await assert.rejects(
    () => extractZipFromBuffer(badBytes, 'broken.zip', 512),
    /corrupted|not a valid ZIP/i
  );

  const emptyZip = new JSZip();
  const emptyBuffer = await emptyZip.generateAsync({ type: 'uint8array' });
  await assert.rejects(
    () => extractZipFromBuffer(emptyBuffer, 'empty.zip', 512),
    /contains no files/i
  );
});

test('Scanner avoids duplicate findings and computes accurate heuristic score', async () => {
  const demo = buildDemoWorkspace(DEFAULT_SETTINGS.maxFileSizeKb);
  const scan = await runLocalScan(
    demo.files,
    {
      projectName: demo.projectName,
      origin: 'demo',
      uploadType: 'demo',
    },
    DEFAULT_SETTINGS
  );

  assert.ok(scan.findings.length >= 8);
  const dedupCheck = new Set(
    scan.findings.map((f) => `${f.ruleId}::${f.filePath}::${f.lineNumber}`)
  );
  assert.equal(dedupCheck.size, scan.findings.length);

  const recomputed = calculateSecurityScore(scan.findings);
  assert.equal(scan.securityScore, recomputed.finalScore);
});

test('Scanner supports real-time progress reporting and AbortController cancellation', async () => {
  const files = Array.from({ length: 15 }, (_, idx) =>
    createVirtualFile(
      `src/file_${idx}.js`,
      `const v${idx} = eval("1 + 1");\n`,
      32,
      512
    )
  );

  const controller = new AbortController();
  let progressUpdates = 0;

  await assert.rejects(
    () =>
      runLocalScan(
        files,
        { projectName: 'cancel-test', origin: 'upload', uploadType: 'files' },
        DEFAULT_SETTINGS,
        (progress) => {
          progressUpdates += 1;
          if (progress.processedFiles >= 2) {
            controller.abort();
          }
        },
        controller.signal
      ),
    (err: unknown) => err instanceof ScanCancelledError
  );

  assert.ok(progressUpdates >= 2);
});

test('End-to-end ZIP File upload -> scan -> patch -> rescan resolves finding and improves score', async () => {
  const zip = new JSZip();
  zip.file('sample-repo/src/api.ts', 'const out = eval(req.body.expr);\n');
  zip.file('sample-repo/config.json', '{\n  "debug": true\n}\n');
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });

  const uploadedZipFile = new File([buffer], 'sample-repo.zip', {
    type: 'application/zip',
  });

  const { projectName, files } = await extractZipFromBuffer(
    await uploadedZipFile.arrayBuffer(),
    uploadedZipFile.name,
    DEFAULT_SETTINGS.maxFileSizeKb
  );

  const firstScan = await runLocalScan(
    files,
    { projectName, origin: 'upload', uploadType: 'zip' },
    DEFAULT_SETTINGS
  );

  assert.equal(firstScan.findings.length, 2);
  assert.equal(firstScan.securityScore, 76); // 100 - 20 (critical) - 4 (medium)

  // Apply the suggestedFix for the critical finding
  const evalFinding = firstScan.findings.find((f) => f.ruleId === 'JS-001');
  assert.ok(evalFinding);
  const patchedFiles = files.map((file) => {
    if (file.path !== evalFinding.filePath) return file;
    const lines = file.content.split(/\r?\n/);
    lines[evalFinding.lineNumber - 1] = evalFinding.suggestedFix;
    return { ...file, content: lines.join('\n'), isModified: true };
  });

  const rescan = await runLocalScan(
    patchedFiles,
    {
      projectName,
      origin: 'upload',
      uploadType: 'zip',
      parentScanId: firstScan.id,
    },
    DEFAULT_SETTINGS
  );

  assert.equal(rescan.findings.length, 1);
  assert.equal(rescan.findings[0].ruleId, 'CONF-001');
  assert.equal(rescan.securityScore, 96);

  const diff = compareScans(rescan, firstScan);
  assert.equal(diff.resolved.length, 1);
  assert.equal(diff.resolved[0].ruleId, 'JS-001');
  assert.equal(diff.remaining.length, 1);
  assert.equal(diff.remaining[0].ruleId, 'CONF-001');
  assert.equal(diff.newlyDetected.length, 0);
  assert.equal(diff.scoreDelta, 20);
});


