import { RuleCategory, ScanRecord, ScannerSettings } from '../types/scanner';

const HISTORY_KEY = 'shipsafe_scan_history_v1';
const SETTINGS_KEY = 'shipsafe_scanner_settings_v1';

export const DEFAULT_ENABLED_CATEGORIES: Record<RuleCategory, boolean> = {
  secrets: true,
  eval: true,
  sqli: true,
  xss: true,
  subprocess: true,
  tls: true,
  crypto: true,
  debug: true,
  http: true,
  cors: true,
  env: true,
};

export const DEFAULT_SETTINGS: ScannerSettings = {
  enabledCategories: { ...DEFAULT_ENABLED_CATEGORIES },
  includeDemoInDashboard: true,
  maxFileSizeKb: 512,
};

export function loadScanHistory(): ScanRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ScanRecord[];
  } catch {
    return [];
  }
}

export function saveScanHistory(records: ScanRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
  } catch {
    const trimmed = [...records];
    while (trimmed.length > 1) {
      trimmed.pop();
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
        return;
      } catch {
        // continue trimming
      }
    }
  }
}

export function clearScanHistoryStorage(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore storage access errors
  }
}

export function loadSettings(): ScannerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ScannerSettings>;
    return {
      enabledCategories: {
        ...DEFAULT_ENABLED_CATEGORIES,
        ...(parsed.enabledCategories ?? {}),
      },
      includeDemoInDashboard:
        typeof parsed.includeDemoInDashboard === 'boolean'
          ? parsed.includeDemoInDashboard
          : DEFAULT_SETTINGS.includeDemoInDashboard,
      maxFileSizeKb:
        typeof parsed.maxFileSizeKb === 'number' && parsed.maxFileSizeKb >= 64
          ? parsed.maxFileSizeKb
          : DEFAULT_SETTINGS.maxFileSizeKb,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ScannerSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage access errors
  }
}
