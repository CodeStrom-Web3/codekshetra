// Settings — account, engine mode, demo reset, deployment documentation.
import { useState } from 'react';
import {
  Settings as SettingsIcon, KeyRound, Cpu, ShieldHalf, RotateCcw, CheckCircle2, Server,
  AlertTriangle, BookOpen, Lock, Eye, EyeOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle } from '../components/ui';
import { resetDb, DEMO_USERS, getSession } from '../engine/store';
import { demoKdf } from '../engine/sha256';

export default function Settings() {
  const { db, version, session, refresh, emit, logout } = useApp();
  void version;
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [aiMode] = useState(db.settings.ai_mode ?? 'deterministic-fallback');
  const [ollamaUrl] = useState(db.settings.ollama_url ?? 'http://localhost:11434');
  const [resetConfirm, setResetConfirm] = useState(false);

  const isAdmin = session?.role === 'ADMIN';
  const me = db.users.find((u) => u.email === session?.email);

  const changePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (!me) return;
    if (demoKdf(pwForm.current, me.salt) !== me.passwordHash) {
      setPwMsg({ ok: false, msg: 'Current password is incorrect.' });
      return;
    }
    if (pwForm.next.length < 10) {
      setPwMsg({ ok: false, msg: 'New password must be at least 10 characters.' });
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ ok: false, msg: 'Confirmation does not match.' });
      return;
    }
    me.passwordHash = demoKdf(pwForm.next, me.salt);
    me.mustChangePassword = false;
    db.audit.push({
      id: (db.seq.audit = (db.seq.audit ?? 0) + 1), actor: me.email, actorRole: me.role,
      action: 'auth.password_change', resource: me.email, result: 'SUCCESS',
      correlationId: crypto.randomUUID(), evidence: {}, createdAt: new Date().toISOString(),
    });
    // persist user to localStorage via a synthetic save of the db object
    localStorage.setItem('agentshield.db.v1', JSON.stringify(db));
    setPwForm({ current: '', next: '', confirm: '' });
    setPwMsg({ ok: true, msg: 'Password rotated. Demo flag cleared.' });
    emit('auth.password_change', { user: me.email });
    refresh();
  };

  const factoryReset = () => {
    resetDb();
    setResetConfirm(false);
    emit('platform.reset', {});
    logout();
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <SectionTitle icon={SettingsIcon} title="Settings & Control Plane"
        sub="Account hygiene, engine mode, demo lifecycle and deployment reference. Admin-only toggles are enforced by role." />

      <div className="grid md:grid-cols-2 gap-4">
        {/* account */}
        <Panel className="p-5">
          <h3 className="display text-base font-semibold text-slate-100 flex items-center gap-2"><KeyRound size={15} className="text-cyan-300" /> Account</h3>
          <div className="mt-3 text-[11px] space-y-1.5">
            <div className="flex justify-between gap-3"><span className="mono text-slate-500">email</span><span className="mono text-slate-200">{session?.email}</span></div>
            <div className="flex justify-between gap-3"><span className="mono text-slate-500">role</span><span className="chip chip-cyan">{session?.role}</span></div>
            <div className="flex justify-between gap-3"><span className="mono text-slate-500">name</span><span className="text-slate-300">{session?.fullName}</span></div>
            {me?.mustChangePassword && (
              <div className="flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-amber-200 mt-2">
                <AlertTriangle size={13} /> Demo account flagged must_change_password. Rotate now — required outside demo mode.
              </div>
            )}
          </div>
          <form onSubmit={changePassword} className="mt-4 space-y-2.5 border-t border-white/5 pt-4">
            <div className="mono text-[9px] uppercase tracking-widest text-slate-500">Rotate password</div>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="input pr-9" placeholder="Current password" value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} autoComplete="current-password" />
              <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input type={showPw ? 'text' : 'password'} className="input" placeholder="New password (≥10 chars)" value={pwForm.next}
              onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} autoComplete="new-password" />
            <input type={showPw ? 'text' : 'password'} className="input" placeholder="Confirm new password" value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} autoComplete="new-password" />
            {pwMsg && (
              <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-[11px] border ${pwMsg.ok ? 'border-emerald-400/40 bg-emerald-500/8 text-emerald-200' : 'border-rose-400/40 bg-rose-500/8 text-rose-200'}`}>
                {pwMsg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{pwMsg.msg}
              </div>
            )}
            <button type="submit" className="btn btn-primary w-full justify-center"><Lock size={13} /> Update password</button>
          </form>
        </Panel>

        {/* engine mode */}
        <Panel className="p-5">
          <h3 className="display text-base font-semibold text-slate-100 flex items-center gap-2"><Cpu size={15} className="text-amber-300" /> AI Engine Mode</h3>
          <p className="text-[10.5px] text-slate-500 mt-1.5 leading-relaxed">AGENTSHIELD never depends on a paid API. The deterministic engine is authoritative; an optional local Ollama model only adds attack variation.</p>
          <div className="mt-3 space-y-2 text-[10.5px]">
            <div className="flex items-center justify-between rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-3 py-2.5">
              <span className="mono text-emerald-300 flex items-center gap-2"><CheckCircle2 size={12} /> deterministic-fallback</span>
              <span className="mono text-[9px] text-emerald-400/70">ACTIVE</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
              <span className="mono text-slate-400 flex items-center gap-2"><Server size={12} /> Ollama @ {ollamaUrl}</span>
              <span className="mono text-[9px] text-slate-600">OPTIONAL — set OLLAMA=1 in backend .env</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-2">Gateway posture</div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2.5">
                <div className="mono text-[11px] text-cyan-300">{db.settings.gateway_mode ?? 'PROTECTED'}</div>
                <div className="mono text-[8px] uppercase tracking-widest text-slate-500 mt-1">gateway mode</div>
              </div>
              <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2.5">
                <div className="mono text-[11px] text-cyan-300">PROTECTED</div>
                <div className="mono text-[8px] uppercase tracking-widest text-slate-500 mt-1">guardian policy</div>
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-white/5 pt-4">
            <div className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><BookOpen size={11} /> Seeded demo identities</div>
            <div className="space-y-1">
              {DEMO_USERS.map((u) => (
                <div key={u.email} className="mono text-[9px] text-slate-500 flex items-center justify-between gap-2">
                  <span>{u.email}</span><span className="text-slate-700">{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* demo lifecycle */}
        <Panel className="p-5 border-rose-400/15">
          <h3 className="display text-base font-semibold text-slate-100 flex items-center gap-2"><RotateCcw size={15} className="text-rose-300" /> Demo Lifecycle</h3>
          <p className="text-[10.5px] text-slate-500 mt-1.5 leading-relaxed">Restore the pristine synthetic universe — 31 scenarios, seeded corpus, canary tokens, zero history. Your login session ends.</p>
          {!resetConfirm ? (
            <button onClick={() => setResetConfirm(true)} className="btn btn-danger mt-4"><RotateCcw size={13} /> Factory-reset demo data</button>
          ) : (
            <div className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 p-4">
              <p className="text-[11px] text-rose-200 font-semibold">This wipes every simulation, decision, approval and audit entry.</p>
              <p className="text-[10px] text-rose-200/70 mt-1">Counts to lose: {db.attempts.length} attempts · {db.decisions.length} decisions · {db.audit.length} audit entries · {db.simulations.length} simulations · {db.approvals.length} approvals</p>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={factoryReset} className="btn btn-danger"><RotateCcw size={13} /> Confirm wipe</button>
                <button onClick={() => setResetConfirm(false)} className="btn btn-ghost">Cancel</button>
              </div>
            </div>
          )}
        </Panel>

        {/* deployment card */}
        <Panel className="p-5">
          <h3 className="display text-base font-semibold text-slate-100 flex items-center gap-2"><ShieldHalf size={15} className="text-cyan-300" /> Deployment Reference</h3>
          <p className="text-[10.5px] text-slate-500 mt-1.5 leading-relaxed">Two runtime modes, one codebase:</p>
          <div className="mt-3 space-y-2 mono text-[9.5px] text-slate-400">
            <div className="rounded-lg border border-white/8 bg-black/40 p-3">
              <div className="text-cyan-300 mb-1">This preview (static)</div>
              In-browser engine — gateway, Guardian, 31 scenarios, reports fully operational client-side. Persistence via browser storage. Zero cost, zero network.
            </div>
            <div className="rounded-lg border border-white/8 bg-black/40 p-3">
              <div className="text-amber-300 mb-1">Full stack (local)</div>
              <span className="text-slate-500">cd backend && uvicorn app.main:app --port 8000<br />pytest tests/ (Pytest + HTTPX)<br />Vite dev server proxies /api → :8000</span>
            </div>
          </div>
          <div className="mono text-[8.5px] text-slate-600 mt-3 border-t border-white/5 pt-3 leading-relaxed">
            {isAdmin ? 'ADMIN tier — full control plane visible.' : 'Note: some control-plane actions are ADMIN-gated; your role is ' + session?.role + '.'}
          </div>
        </Panel>
      </div>
    </div>
  );
}
