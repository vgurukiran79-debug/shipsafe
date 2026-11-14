import { AlertTriangle, Check, X } from 'lucide-react';
import { SecurityFinding } from '../types/scanner';

interface PatchConfirmModalProps {
  finding: SecurityFinding;
  originalLine: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PatchConfirmModal({
  finding,
  originalLine,
  onCancel,
  onConfirm,
}: PatchConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patch-modal-title"
    >
      <div className="w-full max-w-2xl bg-[#0B1221] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 id="patch-modal-title" className="text-base font-semibold text-slate-100">
              Confirm In-Memory Workspace Patch
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close patch preview"
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="text-sm text-slate-300 leading-relaxed">
            <p>
              Applying this patch updates{' '}
              <span className="font-mono text-cyan-300">{finding.filePath}</span> at line{' '}
              <span className="font-mono tabular-nums text-slate-100">
                {finding.lineNumber}
              </span>{' '}
              inside your browser workspace only. Files on your local disk are never modified silently.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-rose-400 mb-1.5">
                Original line ({finding.lineNumber})
              </div>
              <pre className="p-3 rounded-lg bg-rose-950/25 border border-rose-500/30 text-xs font-mono text-rose-200 overflow-x-auto whitespace-pre">
                - {originalLine}
              </pre>
            </div>

            <div>
              <div className="text-xs font-medium text-emerald-400 mb-1.5">
                Proposed replacement ({finding.lineNumber})
              </div>
              <pre className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/30 text-xs font-mono text-emerald-200 overflow-x-auto whitespace-pre">
                + {finding.suggestedFix}
              </pre>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {finding.fixExplanation} After confirming, run{' '}
            <strong className="text-slate-200">Rescan Project</strong> to verify the updated score and export the patched ZIP if desired.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-900/50 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Confirm & Apply Patch</span>
          </button>
        </div>
      </div>
    </div>
  );
}
