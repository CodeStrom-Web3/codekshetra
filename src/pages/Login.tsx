// AGENTSHIELD — authentication (local PBKDF2-equivalent demo kdf + salted sessions).
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldHalf, KeyRound, Eye, EyeOff, ArrowRight, AlertCircle, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEMO_USERS } from '../engine/store';

export default function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@nexacorp.example');
  const [password, setPassword] = useState('AgentShield-Demo-2026!');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = login(email, password);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Invalid credentials'); return; }
    navigate('/dashboard');
  };

  const fill = (u: typeof DEMO_USERS[number]) => { setEmail(u.email); setPassword(u.password); setError(null); };

  return (
    <div className="min-h-screen bg-void bg-grid text-slate-200 flex items-center justify-center p-4 relative">
      <img src="/images/hero-shield.jpg" alt="" aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.16]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-void/60 via-void/80 to-void" />
      <div className="relative z-10 w-full max-w-4xl grid lg:grid-cols-2 gap-6 items-stretch">

        {/* left: brand panel */}
        <div className="panel p-7 sm:p-9 flex flex-col justify-between bg-gradient-to-br from-panel2/80 to-panel/60">
          <div>
            <Link to="/" className="flex items-center gap-2.5 w-fit">
              <ShieldHalf size={26} className="text-cyan-400" strokeWidth={1.8} />
              <span className="display font-bold tracking-[0.22em] text-lg text-slate-100">AGENT<span className="text-cyan-400">SHIELD</span></span>
            </Link>
            <h1 className="display text-3xl sm:text-4xl font-bold leading-[1.08] mt-8 text-slate-50">
              The range where<br /><span className="text-cyan-300">AI agents get</span><br />battle-hardened.
            </h1>
            <p className="text-[12px] text-slate-400 mt-4 leading-relaxed">
              Red Team fires synthetic attacks. The Guardian inspects every proposed tool call.
              Every decision is scored, hashed, audited — and exportable as evidence.
            </p>
          </div>
          <div className="mt-8 space-y-1.5">
            {['RBAC · JWT-style sessions · scoped roles', 'SHA-256-bound approvals · mandatory policy overrides', 'Fully local — no keys, no network, no cost'].map((t) => (
              <div key={t} className="flex items-center gap-2 text-[10.5px] text-slate-500">
                <Lock size={11} className="text-emerald-400" /> {t}
              </div>
            ))}
          </div>
        </div>

        {/* right: auth form */}
        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="panel p-7 sm:p-8 flex flex-col justify-center">
          <div className="mono text-[9px] uppercase tracking-[0.25em] text-cyan-400/80 mb-1.5 flex items-center gap-2">
            <KeyRound size={11} /> Secure access
          </div>
          <h2 className="display text-2xl font-semibold text-slate-100">Sign in to the Console</h2>

          <form onSubmit={submit} className="mt-6 space-y-3.5">
            <div>
              <label className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5 block" htmlFor="email">Email</label>
              <input id="email" className="input mono !text-[12.5px]" autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} spellCheck={false} />
            </div>
            <div>
              <label className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5 block" htmlFor="pw">Password</label>
              <div className="relative">
                <input id="pw" type={showPw ? 'text' : 'password'} className="input mono !text-[12.5px] pr-10" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary w-full justify-center !py-3 text-[13px]">
              {busy ? 'Verifying…' : <>Authenticate <ArrowRight size={15} /></>}
            </button>
          </form>

          <div className="mt-6">
            <div className="mono text-[8.5px] uppercase tracking-[0.2em] text-slate-600 mb-2">Quick-fill demo roles</div>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_USERS.map((u) => (
                <button key={u.email} onClick={() => fill(u)}
                  className="rounded-md border border-white/8 bg-white/[0.03] hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all px-2.5 py-2 text-left">
                  <div className="mono text-[9px] text-cyan-300/90">{u.role.replace('_', ' ')}</div>
                  <div className="text-[10px] text-slate-500 truncate">{u.email.split('@')[0]}@…</div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
