// Audit Logs — immutable evidence ledger: actor, action, resource, correlation ID.
import { useMemo, useState } from 'react';
import { ShieldHalf, Search, Lock, Download, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle, fmtTime, Empty } from '../components/ui';

const ACTION_TONE: Record<string, string> = {
  'auth.login': 'text-emerald-300', 'auth.logout': 'text-slate-400', 'auth.password_change': 'text-cyan-300',
  'simulation.create': 'text-cyan-300', 'simulation.complete': 'text-emerald-300',
  'approval.approve': 'text-emerald-300', 'approval.reject': 'text-rose-300', 'approval.tamper_probe': 'text-amber-300',
  'policy.toggle': 'text-amber-300', 'policy.test': 'text-cyan-300', 'policy.update': 'text-amber-300',
  'gateway.call': 'text-slate-300', 'report.generate': 'text-cyan-300', 'settings.update': 'text-amber-300',
  'platform.seed': 'text-slate-500', 'policy.load': 'text-slate-500',
};

export default function AuditLogs() {
  const { db, version } = useApp();
  void version;
  const [q, setQ] = useState('');
  const [action, setAction] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const actionTypes = useMemo(() => ['all', ...new Set(db.audit.map((a) => a.action))].sort(), [db.audit]);

  const filtered = useMemo(() => {
    let list = [...db.audit].sort((a, b) => b.id - a.id);
    if (action !== 'all') list = list.filter((a) => a.action === action);
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((a) => `${a.actor} ${a.action} ${a.resource} ${a.result} ${a.correlationId} ${JSON.stringify(a.evidence)}`.toLowerCase().includes(needle));
    }
    return list;
  }, [db.audit, action, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCsv = () => {
    const rows = [['id', 'time', 'actor', 'role', 'action', 'resource', 'result', 'correlation_id', 'evidence']];
    for (const a of filtered) {
      rows.push([String(a.id), a.createdAt, a.actor, a.actorRole, a.action, a.resource, a.result, a.correlationId,
        JSON.stringify(a.evidence).replace(/"/g, '""')]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'agentshield-audit.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <SectionTitle icon={ShieldHalf} title="Audit Ledger"
        sub="Append-only evidence: logins, simulations, gateway verdicts, policy mutations, approvals, reports — each bound to a correlation ID. Editing is structurally absent from this UI."
        right={
          <div className="flex items-center gap-2">
            <span className="chip chip-slate"><Lock size={10} /> {db.audit.length} entries · read-only</span>
            <button onClick={exportCsv} className="btn btn-ghost !text-[11px]"><Download size={13} /> Export CSV</button>
          </div>
        } />

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input !pl-9" placeholder="Search actor, action, resource, correlation…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          {q && <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setQ('')}><X size={13} /></button>}
        </div>
        <select className="input w-56" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
          {actionTypes.map((a) => <option key={a} value={a}>{a === 'all' ? 'all actions' : a}</option>)}
        </select>
        <span className="mono text-[10px] text-slate-500">{filtered.length} match{filtered.length === 1 ? '' : 'es'}</span>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr><th>#</th><th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Resource</th><th>Result</th><th>Correlation</th></tr>
            </thead>
            <tbody>
              {slice.map((a) => (
                <tr key={a.id}>
                  <td className="mono text-slate-600">{a.id}</td>
                  <td className="mono text-[9.5px] text-slate-500 whitespace-nowrap">{fmtTime(a.createdAt)}</td>
                  <td className="mono text-[10px] text-slate-300">{a.actor.split('@')[0]}</td>
                  <td><span className="mono text-[8.5px] text-slate-500">{a.actorRole}</span></td>
                  <td><span className={`mono text-[10px] ${ACTION_TONE[a.action] ?? 'text-slate-300'}`}>{a.action}</span></td>
                  <td className="text-[10px] text-slate-400 max-w-40 truncate" title={a.resource}>{a.resource || '—'}</td>
                  <td><span className={`mono text-[9px] font-semibold ${a.result === 'SUCCESS' || a.result === 'ALLOW' || a.result === 'EXECUTED' ? 'text-emerald-400' : a.result === 'FAILURE' || a.result === 'BLOCK' || a.result === 'REJECTED' ? 'text-rose-400' : a.result === 'REQUIRE_APPROVAL' ? 'text-amber-400' : 'text-slate-400'}`}>{a.result}</span></td>
                  <td className="mono text-[8.5px] text-slate-600">{a.correlationId.slice(0, 13)}…</td>
                </tr>
              ))}
              {slice.length === 0 && <tr><td colSpan={8} className="text-center text-slate-600 py-8">No audit entries match.</td></tr>}
            </tbody>
          </table>
        </div>
        {/* pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-line)]">
          <span className="mono text-[9px] text-slate-600">page {page + 1}/{pageCount}</span>
          <div className="flex items-center gap-1.5">
            <button className="btn btn-ghost !py-1 !px-2.5 !text-[10px]" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
            <button className="btn btn-ghost !py-1 !px-2.5 !text-[10px]" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</button>
          </div>
        </div>
      </Panel>

      <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
        <Lock size={13} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <b className="text-slate-300">Immutability model.</b> The embedded engine keeps audit entries append-only in the browser store; the FastAPI backend
          enforces the same via SQLAlchemy with no UPDATE/DELETE routes exposed. SQLite/browser storage is single-writer — for multi-analyst concurrency use the
          shipped backend behind Postgres. Audit rows pair 1:1 with correlation IDs present in attempt/tool-call tables, so evidence chains stay stitchable.
        </p>
      </div>
    </div>
  );
}
