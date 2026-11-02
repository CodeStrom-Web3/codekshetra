// Shared UI atoms used across AGENTSHIELD pages.
import type { LucideIcon } from 'lucide-react';
import { ShieldAlert, ShieldCheck, Hourglass, Sparkles, Activity } from 'lucide-react';
import type { Decision, Severity } from '../engine/types';

export function Panel({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function SectionTitle({ icon: Icon, title, sub, right }: { icon?: LucideIcon; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2.5">
          {Icon && <span className="p-1.5 rounded-md bg-cyan-400/10 border border-cyan-400/25"><Icon size={16} className="text-cyan-300" /></span>}
          <h1 className="display text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">{title}</h1>
        </div>
        {sub && <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, tone = 'cyan' }: {
  icon: LucideIcon; label: string; value: React.ReactNode; sub?: string;
  tone?: 'cyan' | 'red' | 'green' | 'amber' | 'slate';
}) {
  const tones: Record<string, string> = {
    cyan: 'text-cyan-300 border-cyan-400/25 bg-cyan-400/8',
    red: 'text-rose-300 border-rose-400/25 bg-rose-400/8',
    green: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/8',
    amber: 'text-amber-300 border-amber-400/25 bg-amber-400/8',
    slate: 'text-slate-300 border-slate-400/20 bg-slate-400/5',
  };
  return (
    <div className="panel panel-hover p-4 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-slate-400 truncate">{label}</span>
        <span className={`p-1.5 rounded-md border ${tones[tone]}`}><Icon size={14} /></span>
      </div>
      <div className="display text-2xl font-semibold text-slate-100 leading-none">{value}</div>
      {sub && <div className="text-[10.5px] text-slate-500 leading-snug">{sub}</div>}
    </div>
  );
}

export function DecisionBadge({ decision }: { decision: Decision | string }) {
  const cfg: Record<string, { cls: string; icon: LucideIcon }> = {
    ALLOW: { cls: 'chip-green', icon: ShieldCheck },
    BLOCK: { cls: 'chip-red', icon: ShieldAlert },
    REQUIRE_APPROVAL: { cls: 'chip-amber', icon: Hourglass },
    SANITIZE_AND_RECHECK: { cls: 'chip-cyan', icon: Sparkles },
  };
  const { cls, icon: Icon } = cfg[decision] ?? { cls: 'chip-slate', icon: Activity };
  return <span className={`chip ${cls}`}><Icon size={11} />{decision.replace(/_/g, ' ')}</span>;
}

export function SeverityBadge({ severity }: { severity: Severity | string }) {
  const cls: Record<string, string> = {
    CRITICAL: 'chip-red', HIGH: 'chip-red', MEDIUM: 'chip-amber', LOW: 'chip-cyan', INFO: 'chip-slate',
  };
  return <span className={`chip ${cls[severity] ?? 'chip-slate'}`}>{severity}</span>;
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    PREVENTED: 'chip-green', SUCCEEDED: 'chip-red', COMPLETED: 'chip-green', BLOCKED_FP: 'chip-amber',
  };
  return <span className={`chip ${map[outcome] ?? 'chip-slate'}`}>{outcome.replace(/_/g, ' ')}</span>;
}

export function ClassificationBadge({ classification }: { classification: string }) {
  const map: Record<string, string> = {
    PUBLIC: 'chip-green', INTERNAL: 'chip-cyan', CONFIDENTIAL: 'chip-amber', RESTRICTED: 'chip-red',
  };
  return <span className={`chip ${map[classification] ?? 'chip-slate'}`}>{classification}</span>;
}

export function Empty({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <Icon size={34} className="text-slate-600 mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {sub && <p className="text-xs text-slate-500 mt-1 max-w-md">{sub}</p>}
    </div>
  );
}

export function fmtTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export function timeAgo(iso?: string) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
