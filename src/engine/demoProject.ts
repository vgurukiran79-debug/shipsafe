import { ActiveWorkspace, VirtualFile } from '../types/scanner';
import { createVirtualFile } from './scanner';

interface DemoSeedFile {
  path: string;
  content: string;
}

const DEMO_SEED_FILES: DemoSeedFile[] = [
  {
    path: 'package.json',
    content: `{
  "name": "acme-commerce-portal",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx server/app.ts",
    "build": "vite build"
  },
  "dependencies": {
    "express": "^4.21.2",
    "cors": "^2.8.5",
    "react": "^19.0.0"
  }
}`,
  },
  {
    path: '.env.example',
    content: `# Reference environment template (no secrets committed)
PORT=4000
NODE_ENV=production
DATABASE_URL=
JWT_SIGNING_SECRET=
`,
  },
  {
    path: 'config/app.config.yaml',
    content: `service:
  name: acme-commerce-portal
  debug: true
  webhook_url: http://hooks.internal-gateway.example.com/events
`,
  },
  {
    path: 'server/db.ts',
    content: `// Intentionally vulnerable database helper for ShipSafe Demo
export interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
}

export async function findOrderByReference(db: DbClient, orderRef: string) {
  const rows = await db.query(\`SELECT id, total_cents, status FROM orders WHERE reference = \${orderRef}\`);
  return rows;
}
`,
  },
  {
    path: 'server/auth.ts',
    content: `const jwtSecret = "jwt_dev_secret_key_that_was_committed";

export function verifySigningKey(): string {
  return jwtSecret;
}
`,
  },
  {
    path: 'server/app.ts',
    content: `import express from 'express';
import cors from 'cors';
import https from 'https';

const app = express();

app.use(cors({
  origin: '*',
  credentials: true,
}));

const billingAgent = new https.Agent({
  rejectUnauthorized: false,
});

app.post('/api/discount/preview', (req, res) => {
  const formula = String(req.body?.expression ?? '0');
  const calculated = eval(formula);
  res.json({ calculated, agentActive: Boolean(billingAgent) });
});

export default app;
`,
  },
  {
    path: 'client/src/components/AnnouncementBanner.tsx',
    content: `import React from 'react';

interface Props {
  htmlMessage: string;
}

export function AnnouncementBanner({ htmlMessage }: Props) {
  return (
    <section className="banner-shell">
      <div dangerouslySetInnerHTML={{ __html: htmlMessage }} />
    </section>
  );
}
`,
  },
  {
    path: 'client/src/styles/theme.css',
    content: `.banner-shell {
  padding: 16px;
  border-radius: 8px;
}
`,
  },
  {
    path: 'README.md',
    content: `# Acme Commerce Portal (Built-In Demo Project)

This sample repository contains intentional security flaws for testing ShipSafe's local deterministic scanner.
`,
  },
];

export function buildDemoWorkspace(maxFileSizeKb = 512): ActiveWorkspace {
  const files: VirtualFile[] = DEMO_SEED_FILES.map((item) =>
    createVirtualFile(
      item.path,
      item.content,
      new TextEncoder().encode(item.content).length,
      maxFileSizeKb
    )
  ).sort((a, b) => a.path.localeCompare(b.path));

  return {
    projectName: 'acme-commerce-portal (Built-in Demo)',
    origin: 'demo',
    uploadType: 'demo',
    files,
    loadedAt: new Date().toISOString(),
  };
}
