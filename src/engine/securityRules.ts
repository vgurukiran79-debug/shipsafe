import { FileLanguage, SecurityRule } from '../types/scanner';

function isCommentLine(trimmed: string, lang: FileLanguage): boolean {
  if (!trimmed) return true;
  if (lang === 'python' || lang === 'yaml' || lang === 'env') {
    return trimmed.startsWith('#');
  }
  if (lang === 'html') {
    return trimmed.startsWith('<!--');
  }
  if (lang === 'css') {
    return trimmed.startsWith('/*') || trimmed.startsWith('*');
  }
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*')
  );
}

function isPlaceholderValue(val: string): boolean {
  const lower = val.toLowerCase().trim();
  return (
    !lower ||
    lower.length < 5 ||
    lower.includes('your_') ||
    lower.includes('your-') ||
    lower === 'example' ||
    lower.includes('example_key') ||
    lower.includes('example_secret') ||
    lower.includes('placeholder') ||
    lower.includes('changeme') ||
    lower.includes('replace_me') ||
    lower.includes('redacted') ||
    lower.includes('dummy') ||
    lower.startsWith('<') ||
    lower.startsWith('${') ||
    lower.startsWith('env(') ||
    /^\*+$/.test(lower) ||
    /^x+$/i.test(lower)
  );
}

function isTypeScriptDeclarationLine(trimmed: string, lang: FileLanguage): boolean {
  if (lang !== 'typescript') return false;
  return /^(?:readonly\s+)?[a-zA-Z0-9_]+\??\s*:\s*(?:string|number|boolean|unknown|any)\s*[;,]?$/.test(
    trimmed
  );
}

const AWS_KEY_REGEX = /\b((?:AKIA|ASIA)[0-9A-Z]{16})\b/;
const PRIVATE_KEY_HEADER_REGEX =
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/;
const KNOWN_TOKEN_REGEX =
  /\b(sk_live_[0-9a-zA-Z]{16,}|rk_live_[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{20,}|github_pat_[0-9a-zA-Z_]{20,}|xox[baprs]-[0-9a-zA-Z-]{10,})\b/;

export const SECURITY_RULES: SecurityRule[] = [
  // 1. Hardcoded Demo / Static Credentials
  {
    id: 'CRED-001',
    title: 'Hardcoded Credential or Password Literal',
    category: 'secrets',
    categoryLabel: 'Credentials & Secrets',
    severity: 'critical',
    supportedLanguages: ['javascript', 'typescript', 'python', 'json', 'yaml', 'html'],
    description:
      'Heuristic check detected a password or credential variable assigned to a static string literal rather than loaded from runtime configuration.',
    impact:
      'Static credentials committed into source files or config artifacts may be exposed to anyone with repository or bundle access.',
    remediation:
      'Load credentials from environment variables or a secret manager at runtime and rotate any exposed demo/static passwords.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;
      if (isTypeScriptDeclarationLine(trimmed, file.language)) return null;
      if (AWS_KEY_REGEX.test(line) || PRIVATE_KEY_HEADER_REGEX.test(line) || KNOWN_TOKEN_REGEX.test(line)) {
        return null;
      }
      if (
        line.includes('process.env') ||
        line.includes('os.environ') ||
        line.includes('os.getenv') ||
        line.includes('import.meta.env')
      ) {
        return null;
      }

      const credMatch =
        /\b([a-zA-Z0-9_]*(?:password|passwd|db_pass|admin_pass|demo_pass|credentials?)[a-zA-Z0-9_]*)\s*[:=]\s*(['"`])([^'"`\n]{5,})\2/i.exec(
          line
        );
      if (!credMatch) return null;

      const keyName = credMatch[1];
      const quote = credMatch[2];
      const value = credMatch[3];
      if (isPlaceholderValue(value)) return null;

      const upperEnv = keyName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
      let suggestedFix = line;
      if (file.language === 'python') {
        suggestedFix = line.replace(`${quote}${value}${quote}`, `os.environ.get("${upperEnv}", "")`);
      } else if (file.language === 'json') {
        suggestedFix = line.replace(`${quote}${value}${quote}`, `""`);
      } else if (file.language === 'yaml') {
        suggestedFix = line.replace(`${quote}${value}${quote}`, `\${${upperEnv}}`);
      } else {
        suggestedFix = line.replace(`${quote}${value}${quote}`, `process.env.${upperEnv} ?? ''`);
      }

      return {
        columnStart: credMatch.index + 1,
        evidenceSnippet: trimmed,
        suggestedFix,
        fixExplanation: `Replace static credential literal for '${keyName}' with a runtime lookup for ${upperEnv}.`,
      };
    },
  },

  // 2. AWS-Style Access Key Patterns
  {
    id: 'CRED-002',
    title: 'AWS-Style Access Key Pattern',
    category: 'secrets',
    categoryLabel: 'Credentials & Secrets',
    severity: 'critical',
    supportedLanguages: ['javascript', 'typescript', 'python', 'json', 'yaml', 'html', 'env'],
    description:
      'Heuristic check matched an AWS-style access key identifier (AKIA/ASIA prefix) or static AWS secret access key assignment.',
    impact:
      'Cloud provider access keys embedded in code may allow unauthorized access to cloud APIs, storage buckets, or compute resources.',
    remediation:
      'Revoke and rotate the key in IAM, use IAM roles or temporary STS credentials, and load any required keys via runtime environment configuration.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      const awsId = AWS_KEY_REGEX.exec(line);
      if (awsId) {
        const matched = awsId[1];
        let suggestedFix = line.replace(matched, '');
        if (file.language === 'python') {
          suggestedFix = line.replace(
            new RegExp(`(['"])${matched}\\1`),
            'os.environ.get("AWS_ACCESS_KEY_ID", "")'
          );
        } else if (file.language === 'javascript' || file.language === 'typescript') {
          suggestedFix = line.replace(
            new RegExp(`(['"\`])${matched}\\1`),
            "process.env.AWS_ACCESS_KEY_ID ?? ''"
          );
        } else if (file.language === 'env') {
          suggestedFix = line.replace(matched, '');
        }
        return {
          columnStart: awsId.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix,
          fixExplanation: 'Remove the hardcoded AWS access key ID and load AWS_ACCESS_KEY_ID from the runtime environment or IAM role.',
        };
      }

      const awsSecret =
        /\b(aws_secret_access_key|awsSecretAccessKey)\s*[:=]\s*(['"`])([A-Za-z0-9/+=]{20,})\2/i.exec(
          line
        );
      if (awsSecret && !isPlaceholderValue(awsSecret[3])) {
        const quote = awsSecret[2];
        const secret = awsSecret[3];
        const suggestedFix =
          file.language === 'python'
            ? line.replace(`${quote}${secret}${quote}`, 'os.environ.get("AWS_SECRET_ACCESS_KEY", "")')
            : file.language === 'json'
              ? line.replace(`${quote}${secret}${quote}`, '""')
              : line.replace(`${quote}${secret}${quote}`, "process.env.AWS_SECRET_ACCESS_KEY ?? ''");
        return {
          columnStart: awsSecret.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix,
          fixExplanation: 'Replace static AWS secret access key with runtime environment or IAM role credentials.',
        };
      }

      return null;
    },
  },

  // 3. Private Key Headers
  {
    id: 'CRED-003',
    title: 'Embedded Private Key Header',
    category: 'secrets',
    categoryLabel: 'Credentials & Secrets',
    severity: 'critical',
    supportedLanguages: ['javascript', 'typescript', 'python', 'json', 'yaml', 'html', 'env'],
    description:
      'Heuristic check detected a PEM-encoded private key header directly inside source code or configuration.',
    impact:
      'Private keys committed to application repositories can compromise TLS termination, SSH access, or cryptographic token signing.',
    remediation:
      'Remove the private key material from source control, rotate the key pair, and mount keys via secure runtime secrets.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      const match = PRIVATE_KEY_HEADER_REGEX.exec(line);
      if (!match) return null;

      const suggestedFix =
        file.language === 'python'
          ? 'private_key = os.environ.get("APP_PRIVATE_KEY", "")'
          : file.language === 'env'
            ? 'APP_PRIVATE_KEY=""'
            : file.language === 'json'
              ? '"privateKey": ""'
              : "const privateKey = process.env.APP_PRIVATE_KEY ?? '';";

      return {
        columnStart: match.index + 1,
        evidenceSnippet: trimmed,
        suggestedFix,
        fixExplanation: 'Remove embedded PEM private key material and supply it at runtime via secret mount or environment variable.',
      };
    },
  },

  // 4. Hardcoded Token Assignments
  {
    id: 'CRED-004',
    title: 'Hardcoded API Token or Signing Secret',
    category: 'secrets',
    categoryLabel: 'Credentials & Secrets',
    severity: 'critical',
    supportedLanguages: ['javascript', 'typescript', 'python', 'json', 'yaml', 'html'],
    description:
      'Heuristic check detected a known provider token prefix or an API key / signing secret assigned to a static string literal.',
    impact:
      'Hardcoded API tokens and JWT secrets may allow unauthorized API usage or token forgery if source code is inspected.',
    remediation:
      'Inject API keys and signing secrets via environment variables or a secret vault, and revoke any committed tokens.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;
      if (isTypeScriptDeclarationLine(trimmed, file.language)) return null;
      if (AWS_KEY_REGEX.test(line) || PRIVATE_KEY_HEADER_REGEX.test(line)) return null;
      if (
        line.includes('process.env') ||
        line.includes('os.environ') ||
        line.includes('os.getenv') ||
        line.includes('import.meta.env')
      ) {
        return null;
      }

      const tokenLiteral = KNOWN_TOKEN_REGEX.exec(line);
      if (tokenLiteral) {
        const matched = tokenLiteral[1];
        const envKey = matched.startsWith('sk_live') || matched.startsWith('rk_live')
          ? 'STRIPE_SECRET_KEY'
          : matched.startsWith('ghp_') || matched.startsWith('github_pat_')
            ? 'GITHUB_TOKEN'
            : 'SERVICE_API_TOKEN';

        const escaped = matched.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let suggestedFix = line;
        if (file.language === 'python') {
          suggestedFix = line.replace(new RegExp(`(['"])${escaped}\\1`), `os.environ.get("${envKey}", "")`);
        } else if (file.language === 'json') {
          suggestedFix = line.replace(matched, '');
        } else {
          suggestedFix = line.replace(new RegExp(`(['"\`])${escaped}\\1`), `process.env.${envKey} ?? ''`);
        }

        return {
          columnStart: tokenLiteral.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix,
          fixExplanation: `Replace hardcoded service token with runtime lookup for ${envKey} and rotate the token.`,
        };
      }

      const tokenAssign =
        /\b([a-zA-Z0-9_]*(?:api_?key|jwt_?secret|access_?token|auth_?token|client_?secret|bearer_?token|signing_?key|secret_?key)[a-zA-Z0-9_]*)\s*[:=]\s*(['"`])([^'"`\n]{6,})\2/i.exec(
          line
        );
      if (!tokenAssign) return null;

      const keyName = tokenAssign[1];
      const quote = tokenAssign[2];
      const secretVal = tokenAssign[3];
      if (isPlaceholderValue(secretVal)) return null;

      const upperEnv = keyName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
      let suggestedFix = line;
      if (file.language === 'python') {
        suggestedFix = line.replace(`${quote}${secretVal}${quote}`, `os.environ.get("${upperEnv}", "")`);
      } else if (file.language === 'json') {
        suggestedFix = line.replace(`${quote}${secretVal}${quote}`, `""`);
      } else if (file.language === 'yaml') {
        suggestedFix = line.replace(`${quote}${secretVal}${quote}`, `\${${upperEnv}}`);
      } else {
        suggestedFix = line.replace(`${quote}${secretVal}${quote}`, `process.env.${upperEnv} ?? ''`);
      }

      return {
        columnStart: tokenAssign.index + 1,
        evidenceSnippet: trimmed,
        suggestedFix,
        fixExplanation: `Load '${keyName}' from environment variable '${upperEnv}' rather than embedding a static literal.`,
      };
    },
  },

  // 5. JavaScript eval() & dynamic code execution
  {
    id: 'JS-001',
    title: 'JavaScript Dynamic Code Evaluation (eval / Function)',
    category: 'eval',
    categoryLabel: 'Dynamic Code Execution',
    severity: 'critical',
    supportedLanguages: ['javascript', 'typescript', 'html'],
    description:
      'Heuristic check detected eval(), new Function(), or string-argument timer execution in JavaScript/TypeScript.',
    impact:
      'Evaluating dynamic strings as code may lead to arbitrary code execution or cross-site scripting if external input reaches the argument.',
    remediation:
      'Replace eval() with JSON.parse() for data parsing, an explicit operation dispatch table for expressions, or function callbacks for timers.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      // Avoid matching method calls like obj.eval(...)
      const evalMatch = /(?:^|[^.\w$])eval\s*\(([^)]*)\)/.exec(line);
      if (evalMatch) {
        const inner = evalMatch[1].trim();
        const callMatch = /\beval\s*\(([^)]*)\)/.exec(line);
        if (callMatch) {
          return {
            columnStart: callMatch.index + 1,
            evidenceSnippet: trimmed,
            suggestedFix: line.replace(/\beval\s*\(([^)]*)\)/, `JSON.parse(${inner})`),
            fixExplanation: 'Replace eval() with JSON.parse() or a safe deterministic expression parser.',
          };
        }
      }

      const fnMatch = /\bnew\s+Function\s*\(/.exec(line);
      if (fnMatch) {
        return {
          columnStart: fnMatch.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(
            /\bnew\s+Function\s*\([^)]*\)/,
            '(() => { throw new Error("Dynamic Function constructor disabled"); })'
          ),
          fixExplanation: 'Replace new Function() with a statically declared function.',
        };
      }

      const timerMatch = /\b(setTimeout|setInterval)\s*\(\s*(['"`])([^'"`]+)\2/.exec(line);
      if (timerMatch) {
        const fnName = timerMatch[1];
        const body = timerMatch[3];
        return {
          columnStart: timerMatch.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(
            timerMatch[0],
            `${fnName}(() => { /* ${body} */ }`
          ),
          fixExplanation: `Pass a function callback to ${fnName}() instead of an evaluated string.`,
        };
      }

      return null;
    },
  },

  // 6. Potentially unsafe innerHTML & DOM HTML sinks
  {
    id: 'DOM-001',
    title: 'Potentially Unsafe innerHTML / DOM HTML Sink',
    category: 'xss',
    categoryLabel: 'Cross-Site Scripting',
    severity: 'high',
    supportedLanguages: ['javascript', 'typescript', 'html'],
    description:
      'Heuristic check detected direct HTML sink usage (.innerHTML, .outerHTML, document.write, insertAdjacentHTML, or dangerouslySetInnerHTML).',
    impact:
      'Writing unescaped or unsanitized content into HTML sinks may enable Cross-Site Scripting (XSS) in client browsers.',
    remediation:
      'Prefer .textContent or escaped JSX rendering for text, or sanitize rich HTML through a strict allowlist library such as DOMPurify.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      // Contextual guard: clearing with empty string is safe
      const innerMatch = /\.(innerHTML|outerHTML)\s*=\s*(.+)$/.exec(line);
      if (innerMatch) {
        const rhs = innerMatch[2].replace(/;$/, '').trim();
        if (rhs === "''" || rhs === '""' || rhs === '``') return null;

        return {
          columnStart: innerMatch.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(/\.(innerHTML|outerHTML)\s*=/, '.textContent ='),
          fixExplanation: `Use .textContent instead of .${innerMatch[1]} so values are rendered as plain text rather than parsed as HTML.`,
        };
      }

      const reactDangerMatch =
        /<([a-zA-Z0-9]+)\s+[^>]*dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*([^}]+)\}\}\s*\/?>/.exec(
          line
        );
      if (reactDangerMatch) {
        const tag = reactDangerMatch[1];
        const expr = reactDangerMatch[2].trim();
        return {
          columnStart: reactDangerMatch.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(reactDangerMatch[0], `<${tag}>{${expr}}</${tag}>`),
          fixExplanation: 'Render content as escaped JSX text children instead of dangerouslySetInnerHTML.',
        };
      }

      const docWriteMatch = /\bdocument\.write\s*\((.+)\)\s*;?$/.exec(line);
      if (docWriteMatch) {
        const expr = docWriteMatch[1].trim();
        return {
          columnStart: docWriteMatch.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(
            docWriteMatch[0],
            `document.body.append(document.createTextNode(String(${expr})));`
          ),
          fixExplanation: 'Replace document.write() with DOM text node insertion via createTextNode().',
        };
      }

      const adjMatch = /\.insertAdjacentHTML\s*\(\s*(['"][^'"]+['"])\s*,\s*([^)]+)\)/.exec(line);
      if (adjMatch) {
        return {
          columnStart: adjMatch.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(
            adjMatch[0],
            `.insertAdjacentText(${adjMatch[1]}, String(${adjMatch[2].trim()}))`
          ),
          fixExplanation: 'Use insertAdjacentText() instead of insertAdjacentHTML() when inserting untrusted text.',
        };
      }

      return null;
    },
  },

  // 7. SQL queries constructed with string concatenation or interpolation
  {
    id: 'SQL-001',
    title: 'SQL Query Constructed via String Concatenation or Interpolation',
    category: 'sqli',
    categoryLabel: 'SQL Injection',
    severity: 'critical',
    supportedLanguages: ['javascript', 'typescript', 'python'],
    description:
      'Heuristic check detected a SQL keyword statement assembled with template interpolation, string concatenation, or Python string formatting.',
    impact:
      'Interpolating unvalidated variables into SQL strings may allow attackers to alter query structure and access or modify database records.',
    remediation:
      'Use parameterized queries (prepared statements) with placeholder bindings (? or $1 / %s) rather than string concatenation.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      // JS/TS template literal SQL: `SELECT ... ${var}`
      const tplSql =
        /`([^`]*\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^`]*\$\{([^}]+)\}[^`]*)`/i.exec(
          line
        );
      if (tplSql) {
        const rawSql = tplSql[1];
        const extractedVars: string[] = [];
        let paramIdx = 0;
        const parameterizedSql = rawSql.replace(/\$\{([^}]+)\}/g, (_m, expr) => {
          paramIdx += 1;
          extractedVars.push(expr.trim());
          return `$${paramIdx}`;
        });
        return {
          columnStart: tplSql.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(tplSql[0], `'${parameterizedSql}', [${extractedVars.join(', ')}]`),
          fixExplanation: 'Convert interpolated SQL template literal into a parameterized query with bound parameters.',
        };
      }

      // Python f-string SQL: f"SELECT ... '{var}'" or f'SELECT ... "{var}"'
      if (file.language === 'python') {
        const pyFstringDouble =
          /f"([^"]*\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^"]*\{[^}]+\}[^"]*)"/i.exec(
            line
          );
        const pyFstringSingle =
          /f'([^']*\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^']*\{[^}]+\}[^']*)'/i.exec(
            line
          );
        const pyFstring = pyFstringDouble ?? pyFstringSingle;
        if (pyFstring) {
          const quote = pyFstringDouble ? '"' : "'";
          const rawSql = pyFstring[1];
          const extractedVars: string[] = [];
          const parameterizedSql = rawSql.replace(/(['"]?)\{([^}]+)\}\1/g, (_m, _q, expr) => {
            extractedVars.push(expr.trim());
            return '%s';
          });
          return {
            columnStart: pyFstring.index + 1,
            evidenceSnippet: trimmed,
            suggestedFix: line.replace(
              pyFstring[0],
              `${quote}${parameterizedSql}${quote}, (${extractedVars.join(', ')},)`
            ),
            fixExplanation: 'Replace Python f-string SQL query with parameterized %s placeholders and tuple arguments.',
          };
        }

        // Python % or .format() on SQL string
        const pyFormat =
          /(?:"([^"]*\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^"]*)"|'([^']*\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^']*)')\s*(?:%|\.format\s*\()/i.exec(
            line
          );
        if (pyFormat) {
          const quote = pyFormat[1] !== undefined ? '"' : "'";
          const sqlRaw = pyFormat[1] ?? pyFormat[2];
          const sqlText = sqlRaw.replace(/%s|\{\}/g, '?');
          return {
            columnStart: pyFormat.index + 1,
            evidenceSnippet: trimmed,
            suggestedFix: `${line.match(/^\s*/)?.[0] ?? ''}cursor.execute(${quote}${sqlText}${quote}, (param,))`,
            fixExplanation: 'Pass parameters as a tuple argument to cursor.execute() instead of formatting the SQL string.',
          };
        }
      }

      // String concatenation SQL: "SELECT ... " + var or 'SELECT ... ' + var
      const concatDouble =
        /"([^"]*\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^"]*)"\s*\+\s*([a-zA-Z0-9_.[\]()]+)/i.exec(
          line
        );
      const concatSingle =
        /'([^']*\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^']*)'\s*\+\s*([a-zA-Z0-9_.[\]()]+)/i.exec(
          line
        );
      const concatSql = concatDouble ?? concatSingle;
      if (concatSql) {
        const quote = concatDouble ? '"' : "'";
        const sqlPart = concatSql[1];
        const varPart = concatSql[2];
        return {
          columnStart: concatSql.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(concatSql[0], `${quote}${sqlPart}?${quote}, [${varPart}]`),
          fixExplanation: 'Replace SQL string concatenation with a parameterized placeholder (?) and bound parameter.',
        };
      }

      return null;
    },
  },

  // 8. Python subprocess calls with shell=True
  {
    id: 'PY-001',
    title: 'Python subprocess Call with shell=True',
    category: 'subprocess',
    categoryLabel: 'Command Execution',
    severity: 'high',
    supportedLanguages: ['python'],
    description:
      'Heuristic check detected a Python subprocess invocation with shell=True enabled, which routes command execution through a system shell.',
    impact:
      'If any portion of the command string includes untrusted input, invoking a shell may permit command injection via shell metacharacters.',
    remediation:
      'Pass the command and arguments as a list of strings (e.g., ["ls", "-la"]) and set shell=False (the default).',
    evaluateLine(line, lineIndex, allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      // Single-line subprocess.(run|Popen|call|check_output|check_call)(..., shell=True)
      const sameLineSubprocess =
        /\bsubprocess\.(?:run|Popen|call|check_output|check_call)\s*\(/.exec(line);
      if (sameLineSubprocess) {
        // Check current line or up to 5 subsequent lines within the same call
        const windowEnd = Math.min(allLines.length, lineIndex + 6);
        let foundShellTrue = /\bshell\s*=\s*True\b/.test(line);
        if (!foundShellTrue && !/\)\s*$/.test(trimmed)) {
          for (let i = lineIndex + 1; i < windowEnd; i++) {
            const nextTrim = allLines[i].trim();
            if (/\bshell\s*=\s*True\b/.test(nextTrim)) {
              foundShellTrue = true;
              break;
            }
            if (nextTrim.includes(')')) break;
          }
        }
        if (foundShellTrue) {
          return {
            columnStart: sameLineSubprocess.index + 1,
            evidenceSnippet: trimmed,
            suggestedFix: /\bshell\s*=\s*True\b/.test(line)
              ? line.replace(/\bshell\s*=\s*True\b/, 'shell=False')
              : `${line} # pass argument list and set shell=False`,
            fixExplanation: 'Avoid shell=True by passing command arguments as a list (shlex.split or explicit array) with shell=False.',
          };
        }
      }

      return null;
    },
  },

  // 9. Python eval() and exec()
  {
    id: 'PY-002',
    title: 'Python eval() or exec() Dynamic Execution',
    category: 'eval',
    categoryLabel: 'Dynamic Code Execution',
    severity: 'critical',
    supportedLanguages: ['python'],
    description:
      'Heuristic check detected Python built-in eval() or exec(), which evaluates arbitrary strings as Python expressions or statements.',
    impact:
      'If external input reaches eval() or exec(), attackers may execute arbitrary Python code on the host.',
    remediation:
      'Use ast.literal_eval() for safe literal parsing, json.loads() for JSON data, or explicit function dispatch maps.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      // Contextual check: ignore method calls like model.eval() or ast.literal_eval()
      const pyEval = /(?:^|[^.\w])eval\s*\(([^)]*)\)/.exec(line);
      if (pyEval) {
        const callMatch = /\beval\s*\(([^)]*)\)/.exec(line);
        if (callMatch) {
          const inner = callMatch[1].trim();
          return {
            columnStart: callMatch.index + 1,
            evidenceSnippet: trimmed,
            suggestedFix: line.replace(/\beval\s*\(([^)]*)\)/, `ast.literal_eval(${inner})`),
            fixExplanation: 'Use ast.literal_eval() instead of built-in eval() for safe parsing of Python literals.',
          };
        }
      }

      const pyExec = /(?:^|[^.\w])exec\s*\(([^)]*)\)/.exec(line);
      if (pyExec) {
        const callMatch = /\bexec\s*\(([^)]*)\)/.exec(line);
        if (callMatch) {
          const indent = line.match(/^\s*/)?.[0] ?? '';
          return {
            columnStart: callMatch.index + 1,
            evidenceSnippet: trimmed,
            suggestedFix: `${indent}raise RuntimeError("Dynamic exec() disabled — use explicit function dispatch")`,
            fixExplanation: 'Eliminate exec() and route execution through an explicit allowlist of functions.',
          };
        }
      }

      return null;
    },
  },

  // 10. Disabled TLS verification
  {
    id: 'TLS-001',
    title: 'Disabled TLS Certificate Verification',
    category: 'tls',
    categoryLabel: 'Transport & TLS',
    severity: 'high',
    supportedLanguages: ['javascript', 'typescript', 'python', 'json', 'yaml', 'env'],
    description:
      'Heuristic check detected configuration or client code that disables TLS/SSL certificate validation.',
    impact:
      'Disabling certificate verification prevents validating server identity and may expose HTTPS traffic to interception.',
    remediation:
      'Keep TLS certificate validation enabled (rejectUnauthorized: true / verify=True) and configure custom internal CAs explicitly if needed.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      const jsTls = /\brejectUnauthorized\s*:\s*false\b/.exec(line);
      if (jsTls) {
        return {
          columnStart: jsTls.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(/\brejectUnauthorized\s*:\s*false\b/, 'rejectUnauthorized: true'),
          fixExplanation: 'Restore TLS verification by setting rejectUnauthorized: true.',
        };
      }

      const nodeEnvTls = /\bNODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*['"]?0['"]?/.exec(line);
      if (nodeEnvTls) {
        return {
          columnStart: nodeEnvTls.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(nodeEnvTls[0], 'NODE_TLS_REJECT_UNAUTHORIZED=1'),
          fixExplanation: 'Do not set NODE_TLS_REJECT_UNAUTHORIZED=0; keep TLS verification enabled.',
        };
      }

      if (file.language === 'python') {
        const pyVerify = /\bverify\s*=\s*False\b/.exec(line);
        if (pyVerify) {
          return {
            columnStart: pyVerify.index + 1,
            evidenceSnippet: trimmed,
            suggestedFix: line.replace(/\bverify\s*=\s*False\b/, 'verify=True'),
            fixExplanation: 'Set verify=True so HTTPS requests validate server TLS certificates.',
          };
        }

        const pySsl = /\bssl\._create_unverified_context\b/.exec(line);
        if (pySsl) {
          return {
            columnStart: pySsl.index + 1,
            evidenceSnippet: trimmed,
            suggestedFix: line.replace(/\bssl\._create_unverified_context\b/, 'ssl.create_default_context'),
            fixExplanation: 'Use ssl.create_default_context() to enforce certificate validation.',
          };
        }
      }

      return null;
    },
  },

  // 11. Debug mode enabled
  {
    id: 'CONF-001',
    title: 'Debug or Development Mode Enabled',
    category: 'debug',
    categoryLabel: 'Configuration Hardening',
    severity: 'medium',
    supportedLanguages: ['javascript', 'typescript', 'python', 'json', 'yaml', 'env'],
    description:
      'Heuristic check detected an explicit debug flag or development runtime mode in application configuration or startup code.',
    impact:
      'Running deployed services with debug mode enabled can expose detailed tracebacks, internal state, or interactive debug consoles.',
    remediation:
      'Disable debug flags (debug=False / debug: false) for production deployments and default NODE_ENV to production.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      const debugFlag =
        /(\b["']?(?:debug|DEBUG|APP_DEBUG)["']?\s*[:=]\s*)(true|True|1|["']true["'])\b/.exec(
          line
        );
      if (debugFlag) {
        const val = debugFlag[2];
        const safeVal =
          val === 'True'
            ? 'False'
            : val.startsWith('"')
              ? '"false"'
              : val.startsWith("'")
                ? "'false'"
                : 'false';
        return {
          columnStart: debugFlag.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(debugFlag[0], `${debugFlag[1]}${safeVal}`),
          fixExplanation: `Disable debug mode by setting the configuration flag to ${safeVal}.`,
        };
      }

      if (file.language === 'env') {
        const envNodeDev = /^(\s*NODE_ENV\s*=\s*)development\s*$/i.exec(line);
        if (envNodeDev) {
          return {
            columnStart: 1,
            evidenceSnippet: trimmed,
            suggestedFix: `${envNodeDev[1]}production`,
            fixExplanation: 'Set NODE_ENV=production to enforce production framework defaults.',
          };
        }
      }

      const sourceMapMatch = /(\b["']?sourceMap["']?\s*:\s*)true\b/.exec(line);
      if (sourceMapMatch) {
        return {
          columnStart: sourceMapMatch.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(sourceMapMatch[0], `${sourceMapMatch[1]}false`),
          fixExplanation: 'Disable public production source maps to avoid shipping unminified source code.',
        };
      }

      return null;
    },
  },

  // 12. Insecure HTTP endpoints
  {
    id: 'NET-001',
    title: 'Insecure Plaintext HTTP Endpoint',
    category: 'http',
    categoryLabel: 'Transport & TLS',
    severity: 'medium',
    supportedLanguages: ['javascript', 'typescript', 'python', 'json', 'html', 'css', 'yaml', 'env'],
    description:
      'Heuristic check detected an external http:// URL rather than encrypted https:// (excluding localhost and standard XML/schema namespaces).',
    impact:
      'Unencrypted HTTP requests can be observed or altered in transit and may trigger browser mixed-content errors.',
    remediation:
      'Upgrade external URLs and asset links to https:// so transport encryption is enforced.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      const httpRegex =
        /http:\/\/(?!localhost\b|127\.0\.0\.1\b|0\.0\.0\.0\b|\[::1\]|www\.w3\.org\b|schemas\.|xmlns\.|purl\.org\b)([a-zA-Z0-9.-]+(?::\d+)?[^\s'"`>)]*)/;
      const match = httpRegex.exec(line);
      if (!match) return null;

      return {
        columnStart: match.index + 1,
        evidenceSnippet: trimmed,
        suggestedFix: line.replace(match[0], `https://${match[1]}`),
        fixExplanation: 'Upgrade the plaintext http:// endpoint to https://.',
      };
    },
  },

  // 13. Weak or predictable cryptographic patterns
  {
    id: 'CRYPTO-001',
    title: 'Weak Hash Algorithm or Predictable PRNG',
    category: 'crypto',
    categoryLabel: 'Cryptography',
    severity: 'high',
    supportedLanguages: ['javascript', 'typescript', 'python'],
    description:
      'Heuristic check detected deprecated hash algorithms (MD5/SHA-1), ECB cipher mode, or Math.random() used in a security-sensitive context.',
    impact:
      'Weak hashes and predictable pseudo-random values may allow offline cracking or token prediction.',
    remediation:
      'Use SHA-256 or Argon2/bcrypt for hashing, AES-256-GCM for encryption, and crypto.randomUUID()/secrets for security tokens.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      const weakHashJs = /createHash\s*\(\s*(['"])(md5|sha1)\1\s*\)/i.exec(line);
      if (weakHashJs) {
        return {
          columnStart: weakHashJs.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(weakHashJs[0], `createHash(${weakHashJs[1]}sha256${weakHashJs[1]})`),
          fixExplanation: `Upgrade deprecated ${weakHashJs[2].toUpperCase()} hash to SHA-256 (or bcrypt/argon2 for passwords).`,
        };
      }

      const weakHashPy = /hashlib\.(md5|sha1)\s*\(/i.exec(line);
      if (weakHashPy) {
        return {
          columnStart: weakHashPy.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(weakHashPy[0], 'hashlib.sha256('),
          fixExplanation: `Replace hashlib.${weakHashPy[1]}() with hashlib.sha256().`,
        };
      }

      const ecbMatch = /createCipheriv\s*\(\s*(['"])([^'"]*ecb[^'"]*)\1/i.exec(line);
      if (ecbMatch) {
        return {
          columnStart: ecbMatch.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(ecbMatch[2], 'aes-256-gcm'),
          fixExplanation: 'Replace ECB block cipher mode with authenticated AES-256-GCM.',
        };
      }

      const mathRandom =
        /\bMath\.random\s*\(\s*\)(?:\.toString\([^)]*\)(?:\.(?:substring|slice)\([^)]*\))?)?/.exec(
          line
        );
      if (
        mathRandom &&
        /(token|secret|key|salt|password|session|otp|nonce|reset|auth)/i.test(line)
      ) {
        return {
          columnStart: mathRandom.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(mathRandom[0], 'crypto.randomUUID()'),
          fixExplanation: 'Replace predictable Math.random() with cryptographically secure crypto.randomUUID().',
        };
      }

      return null;
    },
  },

  // 14. Unsafe CORS wildcard policy
  {
    id: 'CORS-001',
    title: 'Overly Permissive Wildcard CORS Policy',
    category: 'cors',
    categoryLabel: 'Access Control (CORS)',
    severity: 'high',
    supportedLanguages: ['javascript', 'typescript', 'python', 'json', 'yaml'],
    description:
      'Heuristic check detected a wildcard CORS origin ("*") allowing requests from any third-party origin.',
    impact:
      'Permissive cross-origin policies may allow untrusted origins to interact with API endpoints or read sensitive responses.',
    remediation:
      'Restrict CORS origins to an explicit allowlist of trusted application domains.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      const headerWildcard = /(Access-Control-Allow-Origin['"`\s:=]+)(['"]?)\*\2/i.exec(line);
      if (headerWildcard) {
        const quote = headerWildcard[2] || "'";
        return {
          columnStart: headerWildcard.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(
            headerWildcard[0],
            `${headerWildcard[1]}${quote}https://app.example.com${quote}`
          ),
          fixExplanation: 'Restrict Access-Control-Allow-Origin to your explicit trusted origin.',
        };
      }

      const corsOptionWildcard = /(\borigin\s*:\s*)(['"`])\*\2/.exec(line);
      if (corsOptionWildcard) {
        return {
          columnStart: corsOptionWildcard.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(
            corsOptionWildcard[0],
            `${corsOptionWildcard[1]}process.env.ALLOWED_ORIGIN ?? 'https://app.example.com'`
          ),
          fixExplanation: 'Replace wildcard CORS origin "*" with an explicit origin allowlist.',
        };
      }

      const pyWildcard = /(allow_origins\s*=\s*\[\s*)(['"])\*\2(\s*\])/.exec(line);
      if (pyWildcard) {
        return {
          columnStart: pyWildcard.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: line.replace(pyWildcard[0], `${pyWildcard[1]}"https://app.example.com"${pyWildcard[3]}`),
          fixExplanation: 'Replace wildcard allow_origins=["*"] with explicit trusted origins.',
        };
      }

      const yamlWildcard = /^(\s*(?:allowed_origins|cors_origin|origin)\s*:\s*)(['"]?)\*\2\s*$/i.exec(line);
      if (file.language === 'yaml' && yamlWildcard) {
        return {
          columnStart: yamlWildcard.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix: `${yamlWildcard[1]}"https://app.example.com"`,
          fixExplanation: 'Specify an explicit HTTPS origin instead of wildcard "*" in configuration.',
        };
      }

      return null;
    },
  },

  // 15. Exposed sensitive environment variables
  {
    id: 'ENV-001',
    title: 'Exposed Sensitive Environment Variable',
    category: 'env',
    categoryLabel: 'Environment Exposure',
    severity: 'high',
    supportedLanguages: ['env', 'javascript', 'typescript', 'json', 'yaml', 'html'],
    description:
      'Heuristic check detected either a populated secret inside an .env file or a public client-bundle prefix (VITE_, NEXT_PUBLIC_, REACT_APP_) attached to a sensitive key name.',
    impact:
      'Committed .env files can leak secrets in repositories, and public framework prefixes expose keys in client-side JavaScript bundles.',
    remediation:
      'Keep .env files out of version control (use empty placeholders in .env.example) and remove public client prefixes from sensitive keys.',
    evaluateLine(line, _idx, _allLines, file) {
      const trimmed = line.trim();
      if (isCommentLine(trimmed, file.language)) return null;

      const clientExposed =
        /\b((?:VITE|NEXT_PUBLIC|REACT_APP)_[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|PASSWD|TOKEN|API_KEY|ADMIN_KEY|AUTH_KEY))\b/.exec(
          line
        );
      if (clientExposed) {
        const varName = clientExposed[1];
        const serverOnlyName = varName.replace(/^(?:VITE|NEXT_PUBLIC|REACT_APP)_/, 'SERVER_');
        const suggestedFix =
          file.language === 'env'
            ? `${serverOnlyName}=""`
            : line.replace(varName, serverOnlyName);
        return {
          columnStart: clientExposed.index + 1,
          evidenceSnippet: trimmed,
          suggestedFix,
          fixExplanation: `Remove the public client-bundle prefix from '${varName}' so it is not bundled into browser assets.`,
        };
      }

      if (file.language === 'env' && !/\.(example|sample|template)$/i.test(file.name)) {
        if (AWS_KEY_REGEX.test(line) || PRIVATE_KEY_HEADER_REGEX.test(line)) return null;
        const envLine =
          /^\s*([A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE_KEY|API_KEY|DATABASE_URL|AUTH_KEY|CLIENT_SECRET)[A-Z0-9_]*)\s*=\s*(.+)$/.exec(
            line
          );
        if (envLine) {
          const key = envLine[1];
          const rawVal = envLine[2].replace(/^['"]|['"]$/g, '').trim();
          if (!isPlaceholderValue(rawVal)) {
            return {
              columnStart: 1,
              evidenceSnippet: `${key}=${rawVal.slice(0, 6)}... (redacted preview)`,
              suggestedFix: `${key}=""`,
              fixExplanation: `Clear the live secret value for '${key}' from committed environment files and inject it at deploy time.`,
            };
          }
        }
      }

      return null;
    },
  },
];
