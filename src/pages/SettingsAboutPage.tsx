import { Check, Lock, RotateCcw, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SeverityLabel } from '../components/SeverityLabel';
import { SECURITY_RULES } from '../engine/rules';
import { SEVERITY_WEIGHTS } from '../engine/scanner';
import { RuleCategory, ScannerSettings } from '../types/scanner';
import { DEFAULT_SETTINGS } from '../utils/storage';

interface SettingsAboutPageProps {
  settings: ScannerSettings;
  scanCount: number;
  onUpdateSettings: (next: ScannerSettings) => void;
  onClearHistory: () => void;
}

export function SettingsAboutPage({
  settings,
  scanCount,
  onUpdateSettings,
  onClearHistory,
}: SettingsAboutPageProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const toggleCategory = (cat: RuleCategory) => {
    onUpdateSettings({
      ...settings,
      enabledCategories: {
        ...settings.enabledCategories,
        [cat]: !settings.enabledCategories[cat],
      },
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
            Settings & About
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure deterministic rule categories, heuristic score transparency, and local storage.
          </p>
        </div>

        {savedNotice && (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <Check className="w-4 h-4" />
            <span>Preferences saved locally</span>
          </div>
        )}
      </div>

      {/* Scanner Preferences + Storage Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Enabled Security Rules
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Changes take effect on your next scan or rescan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onUpdateSettings(DEFAULT_SETTINGS);
                setSavedNotice(true);
                setTimeout(() => setSavedNotice(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-cyan-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="divide-y divide-slate-800/70">
            {Array.from(
              SECURITY_RULES.reduce((map, rule) => {
                const existing = map.get(rule.category);
                if (existing) {
                  existing.ruleIds.push(rule.id);
                  existing.titles.push(rule.title);
                } else {
                  map.set(rule.category, {
                    category: rule.category,
                    categoryLabel: rule.categoryLabel,
                    ruleIds: [rule.id],
                    titles: [rule.title],
                  });
                }
                return map;
              }, new Map<RuleCategory, { category: RuleCategory; categoryLabel: string; ruleIds: string[]; titles: string[] }>()).values()
            ).map((group) => {
              const enabled = settings.enabledCategories[group.category] !== false;
              return (
                <label
                  key={group.category}
                  className="flex items-center justify-between gap-4 py-3 cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-200">
                      <span>{group.categoryLabel}</span>
                      <span className="font-mono text-xs text-slate-400">
                        {group.ruleIds.join(', ')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {group.titles.join(' · ')}
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleCategory(group.category)}
                    className="h-4 w-4 accent-cyan-500 rounded cursor-pointer shrink-0"
                  />
                </label>
              );
            })}
          </div>
        </section>

        <div className="lg:col-span-5 space-y-6">
          {/* General Preferences */}
          <section className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-100">
              Workspace & Data Preferences
            </h2>

            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-slate-200">
                  Include Demo Runs in Dashboard Default
                </div>
                <div className="text-xs text-slate-400">
                  Start the Dashboard with both user uploads and built-in demo scans visible.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.includeDemoInDashboard}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    includeDemoInDashboard: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-cyan-500 rounded mt-1 cursor-pointer shrink-0"
              />
            </label>

            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <label
                htmlFor="max-file-size"
                className="block text-sm font-medium text-slate-200"
              >
                Max File Size Per Source File (KB)
              </label>
              <select
                id="max-file-size"
                value={settings.maxFileSizeKb}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    maxFileSizeKb: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#060B16] border border-slate-800 text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value={256}>256 KB</option>
                <option value={512}>512 KB (Recommended)</option>
                <option value={1024}>1,024 KB (1 MB)</option>
                <option value={2048}>2,048 KB (2 MB)</option>
              </select>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-200">
                  Local Scan History
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  {scanCount} stored {scanCount === 1 ? 'scan' : 'scans'} in localStorage
                </div>
              </div>

              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistory();
                      setConfirmClear(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Confirm Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={scanCount === 0}
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 disabled:opacity-40 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Data</span>
                </button>
              )}
            </div>
          </section>

          {/* Privacy & Heuristic Score Methodology */}
          <section className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
              <Lock className="w-4 h-4" />
              <span>Privacy & Zero-AI Architecture</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your source code is processed locally in your browser. ShipSafe does not send project files to an external AI service.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              ZIP extraction uses JSZip inside browser memory, and every check uses deterministic JavaScript pattern rules. No external APIs, LLMs, or cloud databases receive your source code.
            </p>

            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>Heuristic Security Score Formula</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Starts at <span className="font-mono text-slate-200">100</span> and deducts weighted penalties per finding (floored at <span className="font-mono text-slate-200">0</span>):
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono tabular-nums">
                <div className="text-rose-400">
                  Critical: -{SEVERITY_WEIGHTS.critical} pts
                </div>
                <div className="text-orange-400">
                  High: -{SEVERITY_WEIGHTS.high} pts
                </div>
                <div className="text-amber-400">
                  Medium: -{SEVERITY_WEIGHTS.medium} pts
                </div>
                <div className="text-sky-400">
                  Low: -{SEVERITY_WEIGHTS.low} pt
                </div>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Notice: These are heuristic static checks, not a complete security audit or formal certification. A pattern match indicates potential risk and does not prove exploitability.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Documented Rule Catalog */}
      <section className="bg-[#0B1221]/90 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80">
          <h2 className="text-base font-semibold text-slate-100">
            Deterministic Rule Catalog ({SECURITY_RULES.length} Rules)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete specification of all local checks executed across JS, TS, Python, JSON, HTML, CSS, YAML, and environment files.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-xs font-medium text-slate-400">
                <th className="py-3 px-4">Rule ID</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Vulnerability Class</th>
                <th className="py-3 px-4">Supported Formats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {SECURITY_RULES.map((rule) => (
                <tr key={rule.id}>
                  <td className="py-3 px-4 font-mono text-cyan-300 whitespace-nowrap">
                    {rule.id}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <SeverityLabel severity={rule.severity} />
                  </td>
                  <td className="py-3 px-4 text-slate-200 font-medium">
                    {rule.title}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {rule.supportedLanguages.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
