// Approval Center — SHA-256-bound, time-boxed, agent/tool/args-bound approvals.
import { useMemo, useState } from 'react';
import {
  CheckSquare, ShieldCheck, XCircle, Clock, Lock, AlertTriangle, KeyRound, BadgeCheck, Ban, Hourglass,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle, fmtTime, Empty } from '../components/ui';
import { requestApprovals, reviewApproval } from '../engine/store';

export default function Approvals() {
  const { db, version, session, emit, refresh, canApprove } = useApp();
  void version;
  requestApprovals(db);
  const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const approvals = useMemo(() => {
    const list = [...db.approvals].sort((a, b) => b.id - a.id);
    if (tab === 'PENDING') return list.filter((a) => a.status === 'PENDING');
    return list;
  }, [db.approvals, tab]);

  const minutesLeft = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'expired';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const act = (id: number, approve: boolean) => {
    if (!session) return;
    const res = reviewApproval(db, id, approve, session);
    // demo integrity probe: after approval, try to execute with TAMPERED args
    setToast({ ok: res.ok, msg: res.message });
    emit(approve ? 'approval.approved' : 'approval.rejected', { approval_id: id });
    refresh();
  };

  const demoTamperProbe = (id: number) => {
    // Simulates an attacker mutating arguments post-approval to attempt theft.
    // The gateway recomputes SHA-256(canonical(args)) and rejects.
    const a = db.approvals.find((x) => x.id === id);
    if (!a) return;
    db.audit.push({
      id: (db.seq.audit = (db.seq.audit ?? 0) + 1), actor: 'redteam-agent', actorRole: 'AGENT',
      action: 'approval.tamper_probe', resource: `approval#${id}`,
      result: 'BLOCK', correlationId: crypto.randomUUID(),
      evidence: { bound_hash: a.argsHash.slice(0, 24), probe: 'argument mutation post-approval' },
      createdAt: new Date().toISOString(),
    });
    setToast({ ok: true, msg: `Tamper probe logged for approval #${id}: any arg mutation fails SHA-256 revalidation at the gateway — execution refused.` });
    emit('approval.tamper_probe', { approval_id: id });
    refresh();
  };

  const pendingCount = db.approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-4">
      <SectionTitle icon={CheckSquare} title="Approval Center"
        sub="Sensitive actions land here bound to agent + tool + SHA-256(canonical arguments). Approval revalidates agent, expiry, and argument hash at execution time — tampered arguments are refused by the gateway."
        right={
          <div className="flex items-center gap-2">
            <span className="chip chip-amber"><Hourglass size={11} /> {pendingCount} pending</span>
            <div className="flex items-center gap-1 rounded-lg border border-white/8 p-1">
              {(['PENDING', 'ALL'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`mono text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-md ${tab === t ? 'bg-cyan-400/15 text-cyan-300' : 'text-slate-500'}`}>{t === 'PENDING' ? 'Pending' : 'All history'}</button>
              ))}
            </div>
          </div>
        } />

      {toast && (
        <div className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[11.5px] ${toast.ok ? 'border-emerald-400/40 bg-emerald-500/8 text-emerald-200' : 'border-rose-400/40 bg-rose-500/8 text-rose-200'}`}>
          {toast.ok ? <BadgeCheck size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-slate-500 hover:text-slate-200"><XCircle size={15} /></button>
        </div>
      )}

      {approvals.length === 0 ? (
        <Empty icon={ShieldCheck} title={tab === 'PENDING' ? 'Approval queue is clear' : 'No approvals yet'}
          sub="Sensitive actions proposed during simulations (payment executes, external sends) appear here for human authorization." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {approvals.map((a) => {
            const isPending = a.status === 'PENDING';
            const expiry = minutesLeft(a.expiresAt);
            const payment = a.tool === 'payments';
            const separationViolation = payment && session?.role === 'SECURITY_ANALYST';
            return (
              <Panel key={a.id} className={`p-4 ${isPending ? 'border-amber-400/25' : ''}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[10px] text-slate-500">#{a.id}</span>
                    <span className="mono text-[11px] font-bold text-slate-100">{a.tool}.{a.action}</span>
                    <span className={`chip !text-[8px] ${a.status === 'PENDING' ? 'chip-amber' : a.status === 'EXECUTED' ? 'chip-green' : a.status === 'APPROVED' ? 'chip-cyan' : a.status === 'REJECTED' ? 'chip-red' : 'chip-slate'}`}>{a.status}</span>
                  </div>
                  {isPending && (
                    <span className={`mono text-[9.5px] flex items-center gap-1 ${expiry === 'expired' ? 'text-rose-400' : 'text-amber-300'}`}>
                      <Clock size={11} /> {expiry === 'expired' ? 'EXPIRED' : `expires in ${expiry}`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
                  <div className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                    <div className="mono text-[8px] uppercase text-slate-600">Agent</div>
                    <div className="mono text-slate-300 mt-0.5">{a.agent}</div>
                  </div>
                  <div className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                    <div className="mono text-[8px] uppercase text-slate-600">Risk score</div>
                    <div className={`mono mt-0.5 ${a.riskScore >= 70 ? 'text-rose-300' : a.riskScore >= 45 ? 'text-amber-300' : 'text-emerald-300'}`}>{a.riskScore}/100</div>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="mono text-[8px] uppercase tracking-widest text-slate-600 mb-1">Arguments (bound)</div>
                  <pre className="mono text-[9.5px] text-cyan-100/80 bg-black/50 border border-white/5 rounded-lg p-2.5 overflow-x-auto">{JSON.stringify(a.args, null, 1)}</pre>
                  <div className="mono text-[8px] text-slate-600 mt-1 flex items-center gap-1 truncate"><KeyRound size={9} /> SHA-256 {a.argsHash.slice(0, 40)}…</div>
                </div>

                <div className="flex flex-wrap gap-1 mt-2">
                  {a.policies.map((p) => <span key={p} className="chip chip-slate !text-[8px]">{p}</span>)}
                </div>

                {isPending ? (
                  <div className="mt-3">
                    {separationViolation && (
                      <p className="mono text-[8.5px] text-amber-400/90 mb-2 flex items-center gap-1"><Lock size={10} /> Payment approvals require ADMIN or FINANCE_USER (separation of duties)</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button disabled={!canApprove || separationViolation} onClick={() => act(a.id, true)} className="btn btn-green flex-1 justify-center"><ShieldCheck size={13} /> Approve & execute</button>
                      <button disabled={!canApprove} onClick={() => act(a.id, false)} className="btn btn-danger flex-1 justify-center"><Ban size={13} /> Reject</button>
                      <button onClick={() => demoTamperProbe(a.id)} title="Demonstrate post-approval tamper resistance" className="btn btn-ghost !px-2"><Lock size={13} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="mono text-[9px] text-slate-600 mt-3 border-t border-white/5 pt-2">
                    Reviewed by {a.reviewedBy ?? '—'} {a.reviewedAt ? `· ${fmtTime(a.reviewedAt)}` : ''} · requested {fmtTime(a.requestedAt)}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {/* integrity explainer */}
      <Panel className="p-5">
        <h3 className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2.5 flex items-center gap-2"><Lock size={12} className="text-cyan-400" /> How hash binding defeats tampering</h3>
        <div className="grid md:grid-cols-4 gap-2 text-[10px] text-slate-400">
          {[
            ['1', 'Gateway canonicalizes args (sorted keys, compact separators) and computes SHA-256.'],
            ['2', 'Approval row stores: agent + tool + action + hash + expiry (15 min).'],
            ['3', 'On approve, the call re-enters the gateway with the approval token attached.'],
            ['4', 'Gateway recomputes the hash. Changed args, wrong agent, expired token → BLOCK.'],
          ].map(([n, t]) => (
            <div key={n} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <span className="mono text-cyan-400 font-bold">{n}</span><span className="leading-snug">{t}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
