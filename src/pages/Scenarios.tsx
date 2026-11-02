// Scenario Library — 31 deterministic, verifiable scenarios with full detail.
import { useMemo, useState } from 'react';
import { Crosshair, Search, ShieldAlert, Coffee, Filter, ChevronDown, ChevronUp, Bug, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle, DecisionBadge, SeverityBadge, ClassificationBadge, Empty } from '../components/ui';

export default function Scenarios() {
  const { db, version } = useApp();
  void version;
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | 'attack' | 'benign'>('all');
  const [severity, setSeverity] = useState('all');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => db.scenarios.filter((s) => {
    if (type === 'attack' && !s.isAttack) return false;
    if (type === 'benign' && s.isAttack) return false;
    if (severity !== 'all' && s.severity !== severity) return false;
    if (q) {
      const hay = `${s.code} ${s.name} ${s.category} ${s.payload} ${s.description}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [db.scenarios, q, type, severity]);

  const attackCount = db.scenarios.filter((s) => s.isAttack).length;
  const benignCount = db.scenarios.length - attackCount;

  return (
    <div className="space-y-4">
      <SectionTitle icon={Crosshair} title="Scenario Library"
        sub="Every scenario carries an ID, category, severity, payload, expected decision and a verifiable outcome — measured via synthetic state changes, never agent claims."
        right={
          <div className="flex items-center gap-2">
            <span className="chip chip-red"><Bug size={11} /> {attackCount} attacks</span>
            <span className="chip chip-green"><Coffee size={11} /> {benignCount} benign</span>
          </div>
        } />

      {/* filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input !pl-9" placeholder="Search code, name, payload…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/8 p-1">
          {(['all', 'attack', 'benign'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-md transition-all ${type === t ? 'bg-cyan-400/15 text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}>{t}</button>
          ))}
        </div>
        <select className="input w-36" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((s) => <option key={s} value={s}>{s === 'all' ? 'all severities' : s}</option>)}
        </select>
        <span className="mono text-[10px] text-slate-500 flex items-center gap-1.5"><Filter size={11} /> {list.length} shown</span>
      </div>

      {/* cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {list.map((s) => {
          const isOpen = open === s.code;
          return (
            <Panel key={s.code} className={`overflow-hidden ${s.isAttack ? '' : 'border-emerald-400/10'}`}>
              <button className="w-full text-left p-4" onClick={() => setOpen(isOpen ? null : s.code)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono text-[10px] font-bold text-cyan-300">{s.code}</span>
                      <SeverityBadge severity={s.severity} />
                      <span className={`chip ${s.isAttack ? 'chip-red' : 'chip-green'} !text-[8px]`}>{s.isAttack ? 'ATTACK' : 'BENIGN'}</span>
                      <span className="chip chip-slate !text-[8px]">{s.vector}</span>
                    </div>
                    <h3 className="text-[13px] font-semibold text-slate-100 mt-1.5 leading-snug">{s.name}</h3>
                    <p className="mono text-[8.5px] uppercase tracking-widest text-slate-600 mt-1">{s.category.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <DecisionBadge decision={s.expectedDecision} />
                    {isOpen ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
                  </div>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-[var(--color-line)] p-4 space-y-3 bg-black/20">
                  <div>
                    <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Description</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{s.description}</p>
                  </div>
                  <div>
                    <div className="mono text-[9px] uppercase tracking-widest text-rose-400/80 mb-1 flex items-center gap-1.5"><ShieldAlert size={11} /> Payload</div>
                    <pre className="mono text-[10px] text-rose-100/75 bg-rose-950/20 border border-rose-400/15 rounded-lg p-3 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{s.payload}</pre>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                      <div className="mono text-[8.5px] uppercase tracking-widest text-slate-500">Expected decision</div>
                      <div className="mt-1"><DecisionBadge decision={s.expectedDecision} /></div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                      <div className="mono text-[8.5px] uppercase tracking-widest text-slate-500">Source vector</div>
                      <div className="mt-1 flex items-center gap-1.5 text-slate-300"><CheckCircle2 size={11} className="text-cyan-400" />{s.sourceRef}</div>
                    </div>
                  </div>
                  <div className="mono text-[9px] text-slate-600">{s.steps.length} gateway step(s) · harm tools watched: {s.harmTools.length ? s.harmTools.join(', ') : 'none — outcome measured by decision + state'}</div>
                </div>
              )}
            </Panel>
          );
        })}
        {list.length === 0 && <div className="col-span-full"><Empty icon={Search} title="No scenarios match" sub="Clear the filters and try again." /></div>}
      </div>

      {/* mock corpus peek */}
      <Panel className="p-5">
        <h3 className="display text-sm font-semibold text-slate-100 mb-1">Seeded corpus (fictional)</h3>
        <p className="text-[11px] text-slate-500 mb-3">Malicious instructions hide inside the marked records — that's the point.</p>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 text-[10px]">
          <div>
            <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Emails — {db.emails.length}</div>
            <div className="space-y-1 max-h-36 overflow-y-auto">{db.emails.map((e) => (
              <div key={e.id} className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${e.isMalicious ? 'bg-rose-400' : 'bg-emerald-500/70'}`} /><span className="text-slate-400 truncate">{e.subject}</span></div>
            ))}</div>
          </div>
          <div>
            <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Webpages — {db.webpages.length}</div>
            <div className="space-y-1 max-h-36 overflow-y-auto">{db.webpages.map((w) => (
              <div key={w.id} className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${w.isMalicious ? 'bg-rose-400' : 'bg-emerald-500/70'}`} /><span className="text-slate-400 truncate">{w.title}</span></div>
            ))}</div>
          </div>
          <div>
            <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Documents — {db.documents.length}</div>
            <div className="space-y-1 max-h-36 overflow-y-auto">{db.documents.map((d) => (
              <div key={d.id} className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${d.isCanaryHolder ? 'bg-amber-400' : 'bg-emerald-500/70'}`} /><span className="text-slate-400 truncate">{d.name}</span><ClassificationBadge classification={d.classification} /></div>
            ))}</div>
          </div>
          <div>
            <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Payments — {db.payments.length}</div>
            <div className="space-y-1 max-h-36 overflow-y-auto">{db.payments.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5"><span className="mono text-slate-500">{p.invoice}</span><span className="text-slate-400 truncate flex-1">€{p.amount.toLocaleString()}</span><span className={`mono text-[8.5px] ${p.status === 'EXECUTED' ? 'text-rose-300' : p.status === 'VALIDATED' ? 'text-cyan-300' : 'text-slate-600'}`}>{p.status}</span></div>
            ))}</div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
