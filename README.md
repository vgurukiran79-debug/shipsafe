# ShipSafe — Local-First Application Security Scanner

ShipSafe is a browser-based, local-first static application security scanner built for engineering students, independent developers, and startups. It inspects uploaded ZIP archives and individual source files entirely inside the browser using deterministic security rules—without sending source code to any server or external AI service.

> **Privacy & Scope Notice:** Your source code is processed locally in your browser. ShipSafe does not send project files to an external AI service. All detections are heuristic static pattern checks and do not prove exploitability or replace a comprehensive manual security audit.

---

## Features

- **100% Local File & ZIP Processing**: Extract `.zip` repositories in-browser with JSZip or upload individual source files via drag-and-drop or file picker. Automatically excludes binary files, `node_modules/`, `.git/`, build directories (`dist/`, `build/`, `out/`, `.next/`), lockfiles, and oversized files.
- **15 Deterministic Security Checks**:
  - `CRED-001` — Hardcoded credential or password literals
  - `CRED-002` — AWS-style access key patterns (`AKIA` / `ASIA`)
  - `CRED-003` — Embedded PEM private key headers
  - `CRED-004` — Hardcoded API tokens and signing secrets
  - `JS-001` — JavaScript `eval()`, `new Function()`, and string-argument timers
  - `DOM-001` — Potentially unsafe `innerHTML`, `outerHTML`, `document.write()`, and `dangerouslySetInnerHTML`
  - `SQL-001` — SQL queries built via string concatenation, template literals, or Python f-strings
  - `PY-001` — Python `subprocess` calls with `shell=True`
  - `PY-002` — Python `eval()` and `exec()`
  - `TLS-001` — Disabled TLS certificate verification (`rejectUnauthorized: false`, `verify=False`)
  - `CONF-001` — Debug/development mode flags enabled in configuration
  - `NET-001` — Insecure plaintext `http://` external endpoints
  - `CRYPTO-001` — Weak hashes (`md5`, `sha1`), ECB cipher mode, or predictable `Math.random()` tokens
  - `CORS-001` — Overly permissive wildcard CORS (`*`) policies
  - `ENV-001` — Committed secrets in `.env` files and client-exposed `VITE_`/`NEXT_PUBLIC_`/`REACT_APP_` secret keys
- **Supported Formats**: JavaScript, TypeScript, Python, JSON, HTML, CSS, YAML, and `.env` configuration files.
- **Interactive Triage & Line-Highlighted Code Viewer**: Filter findings by severity (`Critical`, `High`, `Medium`, `Low`), file path, or search query, and inspect highlighted source lines with plain-English explanations and secure coding recommendations.
- **Confirm-to-Apply In-Memory Patching & Rescan Diffing**: Copy fixes to clipboard, preview proposed line diffs with explicit confirmation before modifying the in-memory workspace, export a patched `.zip`, and compare **Previous vs. Current** scan results (**Resolved**, **Remaining**, and **Newly Detected** findings).
- **Transparent Heuristic Security Score**: Calculates `100 - (Critical×20 + High×10 + Medium×4 + Low×1)` (floored at `0`) with visible breakdown math.
- **Built-In Vulnerable Demo Project**: Includes a clearly labeled full-stack JavaScript/TypeScript demo (`acme-commerce-portal`) that runs through the exact same local scanning engine.
- **Exportable Reports & Persistent Local History**: Download structured **JSON** and **CSV** security reports and persist scan history in browser `localStorage`.

---

## Technologies Used

- **Frontend**: React 19, TypeScript, Vite
- **Styling & Motion**: Tailwind CSS v4, Motion (`motion/react`), Lucide Icons
- **Local Archive & Persistence**: JSZip, Browser File API, `localStorage`
- **Testing**: Node.js built-in test runner (`node --test`) with `tsx`

---

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-username>/shipsafe.git
   cd shipsafe
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

---

## Running Locally

Start the development server on port `3000`:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Additional Scripts

```bash
# Typecheck TypeScript sources and tests
npm run lint

# Run the deterministic rule and QA test suite
npm test

# Build the production bundle into dist/
npm run build

# Preview the production build locally
npm run preview
```

---

## Screenshots

| View | Description |
| :--- | :--- |
| **Dashboard** | Live KPI summary derived from local scan history, severity distribution chart, and origin filter (`All Scans`, `User Projects`, `Demo Only`). |
| **New Security Scan** | Drag-and-drop ZIP/file uploader, built-in demo loader, interactive file tree preview, and cancellable progress bar. |
| **Scan Results** | Animated heuristic score ring with transparent formula breakdown, severity/file filters, previous-vs-current diff tabs, and JSON/CSV export buttons. |
| **Vulnerability Details** | Line-highlighted source snippet viewer, beginner-friendly risk explanations, copy-to-clipboard fix, and confirm-to-apply patch preview modal. |
| **Scan History & Reports** | Persistent local scan archive and downloadable JSON/CSV audit reports. |

*(Add captured screenshots from your local session under a `docs/screenshots/` folder if desired.)*
