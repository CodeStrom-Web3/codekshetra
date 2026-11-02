// AGENTSHIELD — public landing page.
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldHalf, Swords, Eye, ArrowRight, Zap, Lock, GitBranch, FileCheck,
  Database, Globe, Mail, CreditCard, FolderLock, Terminal, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { DEMO_USERS } from '../engine/store';

const STATS = [
  { v: '31', l: 'Deterministic scenarios' },
  { v: '10', l: 'Attack categories' },
  { v: '14', l: 'Gateway-enforced tool actions' },
  { v: '100%', l: 'Local · zero cost · offline-capable' },
];

const PIPELINE = [
  'Target Agent proposes action',
  'Tool Gateway intercepts',
  'Schema validation',
  'Permission check (P1/P7)',
  'Guardian risk scoring',
  'Policy engine decides',
  'Approval binding (SHA-256)',
  'Mock tool executes',
  'Audit logged forever',
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-void bg-grid text-slate-200 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 bg-radial-glow" />

      {/* ── nav ─────────────────────────────────────────── */}
      <header className="relative z-10 max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-8 h-16 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <ShieldHalf size={24} className="text-cyan-400" strokeWidth={1.8} />
          <span className="display font-bold tracking-[0.2em] text-slate-100">AGENT<span className="text-cyan-400">SHIELD</span></span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-5 text-xs text-slate-400">
          <a href="#pipeline" className="hidden sm:inline hover:text-cyan-300 transition-colors">Pipeline</a>
          <a href="#arsenal" className="hidden sm:inline hover:text-cyan-300 transition-colors">Arsenal</a>
          <a href="#metrics" className="hidden sm:inline hover:text-cyan-300 transition-colors">Metrics</a>
          <Link to="/login" className="btn btn-primary !text-[11px] !py-2">Launch Console <ArrowRight size={12} /></Link>
        </nav>
      </header>

      {/* ── hero ────────────────────────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-10 lg:pt-16 pb-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="inline-flex items-center gap-2 chip chip-cyan mb-5">
              <Zap size={11} /> Autonomous red/blue team range for AI agents
            </div>
            <h1 className="display font-bold text-[2.6rem] sm:text-6xl leading-[1.02] tracking-tight text-slate-50">
              Attack your AI<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-300 text-glow">before</span> they do.
            </h1>
            <p className="mt-5 text-slate-400 text-sm sm:text-base leading-relaxed max-w-lg">
              AGENTSHIELD is a closed-loop <b className="text-slate-200">Red Team vs Blue Team</b> platform for
              enterprise AI agents. A hostile Red Team fires real prompt-injection campaigns at a tool-using
              Target Agent — while the <b className="text-cyan-300">Guardian</b> intercepts every single tool call,
              scores risk, enforces mandatory policy, and demands cryptographic approval for anything sensitive.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}
            className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/login" className="btn btn-primary text-sm !px-5 !py-3">Enter the Range <ArrowRight size={15} /></Link>
            <Link to="/login" className="btn btn-ghost text-sm !px-5 !py-3">Demo credentials <ChevronRight size={14} /></Link>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-slate-500">
            {['No API keys, ever', 'Fictional data only', 'Runs 100% in this browser'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-400" />{t}</span>
            ))}
          </motion.div>
        </div>

        {/* hero artwork */}
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-cyan-400/10 blur-3xl" />
          <img src="/images/hero-shield.jpg" alt="AGENTSHIELD — cyan defence shield repelling a red-team attack against a corporate agent network"
            className="relative rounded-2xl border border-cyan-400/25 shadow-[0_30px_80px_rgba(0,0,0,.6)] object-cover w-full aspect-[3/2]" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/60 backdrop-blur px-4 py-2.5">
            <div className="min-w-0">
              <div className="mono text-[9px] uppercase tracking-widest text-rose-400">Live interception</div>
              <div className="mono text-[10.5px] text-slate-300 truncate">ATK-009 · payments.execute INV-2026-0207 → <span className="text-rose-300">BLOCKED</span></div>
            </div>
            <ShieldHalf size={22} className="text-cyan-400 shrink-0" />
          </div>
        </motion.div>
      </section>

      {/* ── stat strip ──────────────────────────────────── */}
      <section id="metrics" className="relative z-10 border-y border-white/5 bg-black/30">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
          {STATS.map((s) => (
            <div key={s.l} className="py-5 px-4 text-center">
              <div className="display text-2xl sm:text-3xl font-bold text-cyan-300">{s.v}</div>
              <div className="mono text-[9px] sm:text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── the two teams + pipeline ────────────────────── */}
      <section id="pipeline" className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-16 grid lg:grid-cols-5 gap-6">
        {/* RED TEAM */}
        <div className="lg:col-span-2 panel p-6 border-rose-400/20 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 h-44 w-44 rounded-full bg-rose-500/10 blur-3xl" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-400/30"><Swords size={20} className="text-rose-400" /></div>
            <div>
              <h2 className="display font-semibold text-rose-300 tracking-wide">RED TEAM</h2>
              <p className="mono text-[9px] uppercase tracking-widest text-slate-500">autonomous adversary</p>
            </div>
          </div>
          <ul className="space-y-2 text-[12px] text-slate-300">
            {['Direct & indirect prompt injection', 'Poisoned emails, webpages & documents', 'Goal hijacking & tool-chain abuse', 'Synthetic data extraction & privilege escalation', 'Payment manipulation &approval tampering', 'Adaptive round-3 payload mutation'].map((t) => (
              <li key={t} className="flex items-start gap-2"><span className="text-rose-400 mt-0.5">▸</span>{t.trim()}</li>
            ))}
          </ul>
          <div className="mt-4 mono text-[9.5px] text-rose-300/70 border border-rose-400/20 rounded-md px-3 py-2 bg-rose-500/5">
            deterministic cases fire first — optional local Qwen3-4B (Ollama) adds variation, never required
          </div>
        </div>

        {/* PIPELINE */}
        <div className="lg:col-span-3 panel p-6 relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-cyan-400/10 border border-cyan-400/30"><GitBranch size={20} className="text-cyan-300" /></div>
            <div>
              <h2 className="display font-semibold text-cyan-300 tracking-wide">THE GATEWAY INVARIANT</h2>
              <p className="mono text-[9px] uppercase tracking-widest text-slate-500">no tool executes outside this path — ever</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            {PIPELINE.map((step, i) => (
              <div key={step} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
                <span className="mono text-[10px] text-cyan-500 font-bold">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[11px] leading-snug text-slate-300">{step}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
            <Lock size={12} className="text-emerald-400 shrink-0" /> Decisions: <b className="text-emerald-300">ALLOW</b> · <b className="text-rose-300">BLOCK</b> · <b className="text-amber-300">REQUIRE_APPROVAL</b> · <b className="text-cyan-300">SANITIZE_AND_RECHECK</b> — mandatory policy always overrides risk scores.
          </div>
        </div>
      </section>

      {/* ── arsenal ─────────────────────────────────────── */}
      <section id="arsenal" className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pb-16">
        <h2 className="display text-xl sm:text-2xl font-semibold text-slate-100 mb-1">Four hardened mock tools. Zero real surfaces.</h2>
        <p className="text-xs text-slate-500 mb-6">Every tool is database-backed on reserved example domains. Hostile content is seeded on purpose.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Mail, name: 'Email', desc: 'List · read · search · draft · send synthetic mail. Sending is a sensitive action bound to confirmation.', tag: 'email.send needs approval when external' },
            { icon: Globe, name: 'Browser', desc: 'Search & read synthetic *.nexacorp.example pages only. External URLs fail schema validation at the gateway.', tag: 'untrusted content is data, not commands' },
            { icon: FolderLock, name: 'Files', desc: 'Logical names only — host paths rejected by regex. Executive-class docs demand approval; canaries are DLP-trapped.', tag: 'RESTRICTED ≠ readable' },
            { icon: CreditCard, name: 'Payments', desc: 'View · validate · execute simulated payments. Every execution requires SHA-256-bound human approval.', tag: 'no financial provider exists here' },
          ].map(({ icon: Icon, name, desc, tag }) => (
            <div key={name} className="panel panel-hover p-5">
              <Icon size={22} className="text-cyan-300 mb-3" strokeWidth={1.6} />
              <h3 className="display font-semibold text-slate-100">{name}</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-1.5">{desc}</p>
              <div className="mono text-[9px] text-cyan-400/80 mt-3 border-t border-white/5 pt-2.5">{tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── demo credentials + cta ──────────────────────── */}
      <section className="relative z-10 border-t border-white/5 bg-gradient-to-b from-transparent to-cyan-950/20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="display text-2xl sm:text-3xl font-semibold text-slate-100">See the kill-chain get <span className="text-cyan-300">cut.</span></h2>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed max-w-md">
              Launch a COMPARATIVE simulation — Round 1 runs protected, Round 2 replays the same attacks with the
              Guardian bypassed, Round 3 mutates. Watch blocked attacks turn into breached invoices in real time,
              then export the evidence as a PDF report.
            </p>
            <Link to="/login" className="btn btn-primary mt-6 !px-6 !py-3 text-sm">Launch AGENTSHIELD <ArrowRight size={15} /></Link>
          </div>
          <div className="panel p-5">
            <div className="mono text-[9px] uppercase tracking-[0.2em] text-emerald-300 mb-3 flex items-center gap-2"><Terminal size={11} /> Demo credentials — seeded, free, local</div>
            <div className="space-y-1.5 font-mono text-[11px]">
              {DEMO_USERS.map((u) => (
                <div key={u.email} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-white/5 bg-black/30 px-3 py-2">
                  <div>
                    <div className="text-slate-300">{u.email}</div>
                    <div className="text-slate-600">{u.password}</div>
                  </div>
                  <span className="chip chip-slate self-center">{u.role.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
            <p className="mono text-[8.5px] text-slate-600 mt-3">Admin is flagged must_change_password on first login — this is a demo flag, demonstrated in Settings.</p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-5 text-center mono text-[9px] uppercase tracking-[0.25em] text-slate-600">
        AGENTSHIELD · fictional synthetic enterprise · zero cost · zero real systems · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
