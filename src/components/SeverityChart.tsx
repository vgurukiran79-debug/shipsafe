import { motion } from 'motion/react';
import { SeverityCounts } from '../types/scanner';

interface SeverityChartProps {
  counts: SeverityCounts;
}

const SEGMENTS: Array<{
  key: keyof SeverityCounts;
  label: string;
  barColor: string;
  textColor: string;
}> = [
  { key: 'critical', label: 'Critical', barColor: '#F43F5E', textColor: 'text-rose-400' },
  { key: 'high', label: 'High', barColor: '#F97316', textColor: 'text-orange-400' },
  { key: 'medium', label: 'Medium', barColor: '#EAB308', textColor: 'text-amber-400' },
  { key: 'low', label: 'Low', barColor: '#38BDF8', textColor: 'text-sky-400' },
];

export function SeverityChart({ counts }: SeverityChartProps) {
  const total = counts.critical + counts.high + counts.medium + counts.low;
  const maxCount = Math.max(1, counts.critical, counts.high, counts.medium, counts.low);

  return (
    <div className="space-y-5">
      {/* Stacked proportional bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Distribution across severities</span>
          <span className="font-mono tabular-nums text-slate-300">
            {total} {total === 1 ? 'finding' : 'findings'}
          </span>
        </div>

        <svg
          viewBox="0 0 400 14"
          className="w-full h-3.5 rounded-sm overflow-hidden bg-slate-800/80"
          role="img"
          aria-label={`Severity distribution: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low`}
        >
          {total === 0 ? (
            <rect x="0" y="0" width="400" height="14" fill="#1E293B" />
          ) : (
            (() => {
              let offset = 0;
              return SEGMENTS.map((seg, idx) => {
                const value = counts[seg.key];
                if (value === 0) return null;
                const width = (value / total) * 400;
                const x = offset;
                offset += width;
                return (
                  <motion.rect
                    key={seg.key}
                    x={x}
                    y="0"
                    width={Math.max(width, 2)}
                    height="14"
                    fill={seg.barColor}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{
                      duration: 0.45,
                      delay: idx * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{ transformOrigin: `${x}px 7px` }}
                  />
                );
              });
            })()
          )}
        </svg>
      </div>

      {/* Comparative horizontal severity bars */}
      <div className="space-y-3.5">
        {SEGMENTS.map((seg, idx) => {
          const val = counts[seg.key];
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          const barWidth =
            total > 0 ? Math.max(val > 0 ? 4 : 0, (val / maxCount) * 100) : 0;

          return (
            <div key={seg.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: seg.barColor }}
                    aria-hidden="true"
                  />
                  <span className={`font-semibold ${seg.textColor}`}>
                    {seg.label}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-slate-300">
                  {val}{' '}
                  <span className="text-slate-500">({pct}%)</span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800/75 rounded-sm overflow-hidden">
                <motion.div
                  key={`${seg.key}-${val}-${total}`}
                  className="h-full origin-left rounded-sm"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: idx * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: seg.barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
