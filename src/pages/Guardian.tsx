// Guardian Feed — every decision with full evidence: rules, rationale, risk breakdown.
import { useMemo, useState } from 'react';
import { Eye, Search, X, ShieldAlert, ShieldCheck, Hourglass, Sparkles, FileSearch } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle, DecisionBadge, SeverityBadge, fmtTime, Empty } from '../components/ui';

export default function Guardian() {
  const { db, version } = useApp();
  void version;
  const [decision, setDecision] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const decisions = useMemo(() => {
    let list = [...db.decisions].sort((a, b) => b.id - a.id);
    if (decision !== 'all') list = list.filter((d) => d.decision === decision);
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((d) => {
        const tc = db.toolCalls.find((t) => t.id === d.toolCallId);
        return JSON.stringify([tc?.tool, tc?.action, tc?.args, d.rationale, d.triggeredRules.map((r) => r.code)]).toLowerCase().includes(needle);
      });
    }
    return list.slice(0, 80);
  }, [db.decisions, db.toolCalls, decision, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALLOW: 0, BLOCK: 0, REQUIRE_APPROVAL: 0, SANITIZE_AND_RECHECK: 0 };
    for (const d of db.decisions) c[d.decision] = (c[d.decision] ?? 0) + 1;
    return c;
  }, [db.decisions]);

  const stats = [
    { label: 'ALLOW', value: counts.ALLOW, icon: ShieldCheck, tone: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/8' },
    { label: 'BLOCK', value: counts.BLOCK, icon: ShieldAlert, tone: 'text-rose-300 border-rose-400/30 bg-rose-400/8' },
    { label: 'REQUIRE APPROVAL', value: counts.REQUIRE_APPROVAL, icon: Hourglass, tone: 'text-amber-300 border-amber-400/30 bg-amber-400/8' },
    { label: 'SANITIZE+RECHECK', value: counts.SANITIZE_AND_RECHECK, icon: Sparkles, tone: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/8' },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle icon={Eye} title="Guardian Decision Feed"
        sub="Every proposed tool call, adjudicated. Expand any decision to see triggered rules, the evidence dict, and the risk breakdown — exactly what an auditor would ask for." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`panel border p-4 flex items-center gap-3 ${tone}`}>
            <Icon size={20} strokeWidth={1.8} />
            <div>
              <div className="display text-2xl font-bold text-slate-100 leading-none">{value}</div>
              <div className="mono text-[8.5px] uppercase tracking-[0.16em] text-slate-500 mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input !pl-9" placeholder="Search tool, action, args, rationale, rule…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-52" value={decision} onChange={(e) => setDecision(e.target.value)}>
          {['all', 'ALLOW', 'BLOCK', 'REQUIRE_APPROVAL', 'SANITIZE_AND_RECHECK'].map((d) => <option key={d} value={d}>{d === 'all' ? 'all decisions' : d.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {decisions.map((d) => {
          const tc = db.toolCalls.find((t) => t.id === d.toolCallId);
          const isOpen = open === d.id;
          const borderTone = d.decision === 'BLOCK' ? 'border-l-rose-500' : d.decision === 'REQUIRE_APPROVAL' ? 'border-l-amber-400' : d.decision === 'SANITIZE_AND_RECHECK' ? 'border-l-cyan-400' : 'border-l-emerald-500';
          return (
            <Panel key={d.id} className={`border-l-2 ${borderTone} overflow-hidden`}>
              <button className="w-full text-left px-4 py-3 flex items-center gap-3 flex-wrap" onClick={() => setOpen(isOpen ? null : d.id)}>
                <span className="mono text-[9px] text-slate-600 w-8">#{d.id}</span>
                <span className="mono text-[11px] text-slate-100 font-semibold">{tc?.tool}.{tc?.action}</span>
                <DecisionBadge decision={d.decision} />
                <SeverityBadge severity={d.severity} />
                <span className="mono text-[10px] text-slate-500">risk <b className={d.riskScore >= 70 ? 'text-rose-300' : d.riskScore >= 45 ? 'text-amber-300' : 'text-emerald-300'}>{d.riskScore}</b></span>
                <span className="mono text-[9px] text-slate-600 ml-auto hidden md:inline">{fmtTime(d.createdAt)}</span>
              </button>
              {isOpen && (
                <div className="border-t border-[var(--color-line)] px-4 py-4 grid md:grid-cols-2 gap-4 bg-black/20">
                  <div className="space-y-3">
                    <div>
                      <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Arguments</div>
                      <pre className="mono text-[9.5px] text-cyan-100/75 bg-black/50 border border-white/5 rounded-lg p-2.5 max-h-32 overflow-auto">{JSON.stringify(tc?.args, null, 2)}</pre>
                      <div className="mono text-[8.5px] text-slate-600 mt-1 truncate">SHA-256 {tc?.argsHash}</div>
                    </div>
                    <div>
                      <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Rationale</div>
                      <p className="text-[11px] text-slate-300 leading-relaxed border-l-2 border-cyan-400/40 pl-3">{d.rationale}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Triggered rules ({d.triggeredRules.length})</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {d.triggeredRules.length === 0 && <p className="text-[10.5px] text-emerald-300/80">Clean evaluation — no rules fired.</p>}
                        {d.triggeredRules.map((r) => (
                          <div key={r.code} className="flex items-start gap-2 rounded border border-white/5 bg-white/[0.02] px-2 py-1.5">
                            <span className="mono text-[9px] text-amber-300 shrink-0 w-14">{r.code}</span>
                            <span className="text-[10px] text-slate-400 leading-snug">{r.name}{r.detail ? ` — ${r.detail}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Evidence & risk breakdown</div>
                      <pre className="mono text-[9px] text-slate-400 bg-black/50 border border-white/5 rounded-lg p-2.5 max-h-36 overflow-auto">{JSON.stringify(d.evidence, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          );
        })}
        {decisions.length === 0 && <Empty icon={FileSearch} title="No decisions recorded" sub="Run a simulation or use the Agents sandbox console to generate Guardian traffic." />}
      </div>
    </div>
  );
}
