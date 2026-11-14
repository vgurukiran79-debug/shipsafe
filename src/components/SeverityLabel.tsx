import { AlertOctagon, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Severity } from '../types/scanner';

interface SeverityLabelProps {
  severity: Severity;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; textClass: string; Icon: typeof AlertOctagon }
> = {
  critical: {
    label: 'Critical',
    textClass: 'text-rose-400',
    Icon: AlertOctagon,
  },
  high: {
    label: 'High',
    textClass: 'text-orange-400',
    Icon: ShieldAlert,
  },
  medium: {
    label: 'Medium',
    textClass: 'text-amber-400',
    Icon: AlertTriangle,
  },
  low: {
    label: 'Low',
    textClass: 'text-sky-400',
    Icon: Info,
  },
};

export function SeverityLabel({ severity }: SeverityLabelProps) {
  const { label, textClass, Icon } = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${textClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function getScoreColorClass(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 35) return 'text-orange-400';
  return 'text-rose-400';
}

export function getScoreBarClass(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 35) return 'bg-orange-500';
  return 'bg-rose-500';
}
