// Simulations — launch single attacks, suites, custom selections, comparative 3-round runs.
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, Play, Pause, Square, RotateCcw, Swords, CheckSquare, ShieldCheck,
  Layers, GitCompare, X, CircleDot, Loader2, Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle, DecisionBadge, OutcomeBadge, fmtTime } from '../components/ui';
import { createSimulation, runSimulation } from '../engine/store';
import type { SimMode } from '../engine/types';

const SUITES: Record<string, string[]> = {
  'Full arsenal (31)': ['ATK-001','ATK-002','ATK-003','ATK-004','ATK-005','ATK-006','ATK-007','ATK-008','ATK-009','ATK-010','ATK-011','ATK-012','ATK-013','ATK-014','ATK-015','ATK-016','ATK-017','ATK-018','ATK-019','ATK-020','ATK-021','ATK-022','ATK-023','ATK-024','ATK-025','BEN-001','BEN-002','BEN-003','BEN-004','BEN-005','BEN-006'],
  'Injection family (8)': ['ATK-001','ATK-002','ATK-003','ATK-004','ATK-014','ATK-016','ATK-017','ATK-021'],
  'Payment fraud track (6)': ['ATK-002','ATK-003','ATK-008','ATK-009','ATK-011','ATK-012','ATK-013','ATK-018','ATK-020','ATK-025'],
  'Data exfiltration (5)': ['ATK-005','ATK-007','ATK-010','ATK-019','ATK-024'],
  'Legitimate workload (6)': ['BEN-001','BEN-002','BEN-003','BEN-004','BEN-005','BEN-006'],
};

export default function Simulations() {
  const { db, version, session, emit, refresh, canSimulate } = useApp();
  void version;
  const navigate = useNavigate();
  const [name, setName] = useState('Operation Silent Shield');
  const [mode, setMode] = useState<SimMode>('COMPARATIVE');
  const [rounds, setRounds] = useState(3);
  const [selected, setSelected] = useState<Set<string>>(new Set(SUITES['Injection family (8)']));
  const [suite, setSuite] = useState('Injection family (8)');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'attack' | 'benign'>('all');
  const [launching, setLaunching] = useState(false);
  const [openSim, setOpenSim] = useState<number | null>(null);
  const stopRequested = useRef<Set<number>>(new Set());
  const paused = useRef<Set<number>>(new Set());

  const categories = useMemo(() => ['all', ...new Set(db.scenarios.map((s) => s.category))], [db.scenarios]);
  const filtered = useMemo(() => db.scenarios.filter((s) => {
    if (category !== 'all' && s.category !== category) return false;
    if (typeFilter === 'attack' && !s.isAttack) return false;
    if (typeFilter === 'benign' && s.isAttack) return false;
    if (search && !`${s.code} ${s.name} ${s.payload}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [db.scenarios, category, typeFilter, search]);

  const simulations = useMemo(() => [...db.simulations].sort((a, b) => b.id - a.id), [db.simulations]);
  const attemptsOf = (id: number) => db.attempts.filter((a) => a.simulationId === id).sort((x, y) => x.id - y.id);

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };
  const applySuite = (label: string) => {
    setSuite(label);
    setSelected(new Set(SUITES[label] ?? []));
  };

  const launch = async () => {
    if (!session || selected.size === 0) return;
    setLaunching(true);
    const sim = createSimulation(db, name.trim() || 'Untitled operation', mode,
      [...selected], rounds, session.email);
    emit('simulation.created', { simulation_id: sim.id, mode, scenarios: selected.size, rounds });
    refresh();
    // run async engine loop; it emits live events as it goes
    runSimulation(sim, {
      onEvent: (type, payload) => { emit(type, payload); refresh(); },
      shouldStop: (simId) => stopRequested.current.has(simId) ? 'stopped' : paused.current.has(simId) ? 'paused' : 'running',
    }).then(() => { emit('simulation.engine_done', { simulation_id: sim.id }); refresh(); });
    setLaunching(false);
    setOpenSim(sim.id);
    navigate('/monitor');
  };

  const simAction = (id: number, action: 'pause' | 'resume' | 'stop' | 'restart') => {
    const sim = db.simulations.find((s) => s.id === id);
    if (!sim) return;
    if (action === 'pause') { paused.current.add(id); sim.status = 'PAUSED'; emit('simulation.paused', { simulation_id: id }); }
    if (action === 'resume') { paused.current.delete(id); sim.status = 'RUNNING'; emit('simulation.resumed', { simulation_id: id }); }
    if (action === 'stop') { stopRequested.current.add(id); sim.status = 'STOPPING'; emit('simulation.stop_requested', { simulation_id: id }); }
    if (action === 'restart') {
      const clone = createSimulation(db, `${sim.name} (restart)`, sim.mode, sim.scenarioCodes, sim.rounds, session?.email ?? 'system');
      emit('simulation.restarted', { simulation_id: clone.id, from: id });
      runSimulation(clone, {
        onEvent: (type, payload) => { emit(type, payload); refresh(); },
        shouldStop: (simId) => stopRequested.current.has(simId) ? 'stopped' : paused.current.has(simId) ? 'paused' : 'running',
      }).then(() => refresh());
    }
    if (action !== 'restart') db.simulations = db.simulations.map((s) => s.id === id ? { ...s } : s);
    refresh();
  };

  return (
    <div className="space-y-4">
      <SectionTitle icon={FlaskConical} title="Simulation Range"
        sub="Launch Red Team campaigns against the protected Target Agent. Three rounds: protected run → Guardian-bypassed baseline replay → adaptive mutation informed by prior outcomes." />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* ── LAUNCH PANEL ─────────────────────────────────────────── */}
        <Panel className="xl:col-span-2 p-5 space-y-4">
          <h3 className="display text-base font-semibold text-slate-100 flex items-center gap-2"><Play size={16} className="text-cyan-300" /> Configure operation</h3>

          <div>
            <label className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5 block">Operation name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} spellCheck={false} />
          </div>

          {/* mode cards */}
          <div>
            <label className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5 block">Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'PROTECTED', icon: ShieldCheck, label: 'Protected', desc: 'Full gateway + Guardian', tone: 'emerald' },
                { id: 'BASELINE', icon: Swords, label: 'Baseline', desc: 'Guardian bypassed, sandbox kept', tone: 'rose' },
                { id: 'COMPARATIVE', icon: GitCompare, label: 'Comparative', desc: 'Protected → Baseline → Adaptive', tone: 'cyan' },
              ] as Array<{ id: SimMode; icon: typeof Swords; label: string; desc: string; tone: string }>).map(({ id, icon: Icon, label, desc }) => (
                <button key={id} onClick={() => setMode(id)}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${mode === id ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,.12)]' : 'border-white/8 bg-white/[0.02] hover:border-white/20'}`}>
                  <Icon size={17} className={mode === id ? 'text-cyan-300' : 'text-slate-500'} />
                  <div className="mono text-[10.5px] font-semibold text-slate-100 mt-1.5">{label}</div>
                  <div className="text-[8.5px] text-slate-500 leading-snug mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* rounds + suites */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5 block">Rounds</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((r) => (
                  <button key={r} onClick={() => setRounds(r)}
                    className={`h-9 flex-1 rounded-md border mono text-[12px] font-bold transition-all ${rounds === r ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-300' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}>{r}</button>
                ))}
              </div>
              <p className="text-[8.5px] text-slate-600 mt-1">R1 protected · R2 baseline/adaptive</p>
            </div>
            <div>
              <label className="mono text-[9px] uppercase tracking-widest text-slate-500 mb-1.5 block">Attack suite</label>
              <select className="input !text-[10.5px]" value={suite} onChange={(e) => applySuite(e.target.value)}>
                {Object.keys(SUITES).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-[8.5px] text-slate-600 mt-1">or hand-pick below ↓</p>
            </div>
          </div>

          {/* scenario picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <label className="mono text-[9px] uppercase tracking-widest text-slate-500">Scenarios <span className="text-cyan-300">{selected.size}</span> selected</label>
              <div className="flex items-center gap-1.5">
                <button className="mono text-[9px] px-2 py-1 rounded border border-white/10 text-slate-400 hover:text-cyan-300" onClick={() => setSelected(new Set(filtered.map((s) => s.code)))}>select visible</button>
                <button className="mono text-[9px] px-2 py-1 rounded border border-white/10 text-slate-400 hover:text-rose-300" onClick={() => setSelected(new Set())}>clear</button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Filter size={11} className="text-slate-600 shrink-0" />
              <input className="input !text-[10.5px] !py-1.5 flex-1" placeholder="Search scenarios…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="input !text-[10.5px] !py-1.5 w-32" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'all categories' : c}</option>)}
              </select>
              <select className="input !text-[10.5px] !py-1.5 w-24" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as never)}>
                <option value="all">all</option><option value="attack">attacks</option><option value="benign">benign</option>
              </select>
            </div>
            <div className="h-44 overflow-y-auto rounded-lg border border-white/8 divide-y divide-white/5">
              {filtered.map((s) => {
                const on = selected.has(s.code);
                return (
                  <button key={s.code} onClick={() => toggle(s.code)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${on ? 'bg-cyan-400/8' : 'hover:bg-white/[0.03]'}`}>
                    <span className={`h-3.5 w-3.5 rounded-[4px] border flex items-center justify-center shrink-0 ${on ? 'border-cyan-400 bg-cyan-400 text-black' : 'border-slate-600'}`}>
                      {on && <CheckSquare size={10} strokeWidth={3} />}
                    </span>
                    <span className="mono text-[9px] text-slate-500 w-12 shrink-0">{s.code}</span>
                    <span className="text-[10px] text-slate-300 truncate flex-1">{s.name}</span>
                    <span className={`mono text-[8px] shrink-0 ${s.isAttack ? 'text-rose-400/80' : 'text-emerald-400/80'}`}>{s.isAttack ? 'ATK' : 'BEN'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={launch} disabled={!canSimulate || launching || selected.size === 0}
            className="btn btn-primary w-full justify-center !py-3 text-[13px]">
            {launching ? <><Loader2 size={15} className="animate-spin" /> Deploying Red Team…</> : <><Swords size={16} /> Launch {selected.size} scenario{selected.size !== 1 ? 's' : ''} × {rounds} round{rounds !== 1 ? 's' : ''}</>}
          </button>
          {!canSimulate && <p className="mono text-[9px] text-amber-400/80 text-center">Requires ADMIN or SECURITY_ANALYST role</p>}
        </Panel>

        {/* ── SIMULATION HISTORY ───────────────────────────────────── */}
        <Panel className="xl:col-span-3 overflow-hidden flex flex-col">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--color-line)] flex items-center justify-between">
            <h3 className="display text-base font-semibold text-slate-100 flex items-center gap-2"><Layers size={16} className="text-cyan-300" /> Operation history</h3>
            <span className="mono text-[9px] uppercase tracking-widest text-slate-500">{simulations.length} runs persisted</span>
          </div>
          <div className="overflow-y-auto max-h-[560px] divide-y divide-white/5">
            {simulations.length === 0 && (
              <div className="py-14 text-center">
                <FlaskConical size={30} className="text-slate-700 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-slate-400">No operations yet.</p>
                <p className="text-[11px] text-slate-600 mt-1">Pick a suite and launch — results persist in the browser-embedded engine.</p>
              </div>
            )}
            {simulations.map((sim) => {
              const running = sim.status === 'RUNNING' || sim.status === 'PAUSED' || sim.status === 'PENDING' || sim.status === 'STOPPING';
              const progress = sim.totalAttempts ? Math.round((sim.completedAttempts / sim.totalAttempts) * 100) : 0;
              const isOpen = openSim === sim.id;
              const atts = isOpen ? attemptsOf(sim.id) : [];
              return (
                <div key={sim.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <CircleDot size={14} className={`mt-1 shrink-0 ${running ? 'text-amber-400 pulse-dot' : sim.status === 'COMPLETED' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="mono text-[10px] text-slate-500">SIM#{sim.id}</span>
                        <span className="text-[12px] font-semibold text-slate-200 truncate max-w-[260px]">{sim.name}</span>
                        <span className="chip chip-cyan !text-[8px]">{sim.mode}</span>
                        <span className={`chip !text-[8px] ${sim.status === 'COMPLETED' ? 'chip-green' : running ? 'chip-amber' : 'chip-slate'}`}>{sim.status}</span>
                        <span className="mono text-[8.5px] text-slate-600">{sim.rounds} rounds · {sim.scenarioCodes.length} scenarios</span>
                      </div>
                      {/* progress */}
                      <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden max-w-md">
                        <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300" animate={{ width: `${progress}%` }} transition={{ ease: 'easeOut', duration: 0.4 }} />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[9.5px] mono text-slate-500 flex-wrap">
                        <span>{sim.completedAttempts}/{sim.totalAttempts} attempts</span>
                        <span className="text-emerald-400">{sim.attacksBlocked} attacks blocked</span>
                        <span className={sim.attacksSucceeded > 0 ? 'text-rose-400' : ''}>{sim.attacksSucceeded} succeeded</span>
                        <span className="text-slate-600">{sim.benignCompleted} legit completed · {sim.benignBlocked} legit blocked</span>
                        <span className="text-slate-600">{fmtTime(sim.createdAt)}</span>
                      </div>
                      {/* controls */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {running && sim.status !== 'PAUSED' && (
                          <button className="btn btn-ghost !py-1 !px-2 !text-[9px]" onClick={() => simAction(sim.id, 'pause')}><Pause size={11} /> Pause</button>
                        )}
                        {sim.status === 'PAUSED' && (
                          <button className="btn btn-green !py-1 !px-2 !text-[9px]" onClick={() => simAction(sim.id, 'resume')}><Play size={11} /> Resume</button>
                        )}
                        {running && (
                          <button className="btn btn-danger !py-1 !px-2 !text-[9px]" onClick={() => simAction(sim.id, 'stop')}><Square size={11} /> Stop</button>
                        )}
                        <button className="btn btn-ghost !py-1 !px-2 !text-[9px]" onClick={() => simAction(sim.id, 'restart')}><RotateCcw size={11} /> Restart</button>
                        <button className="btn btn-ghost !py-1 !px-2 !text-[9px]" onClick={() => setOpenSim(isOpen ? null : sim.id)}>{isOpen ? <X size={11} /> : <CheckSquare size={11} />} Attempts</button>
                      </div>
                      {/* attempt table */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-2 overflow-x-auto rounded-lg border border-white/8 max-h-56 overflow-y-auto">
                              <table className="data">
                                <thead className="sticky top-0 bg-[#0f1829]"><tr><th>#</th><th>Scenario</th><th>Rnd</th><th>Decision</th><th>Risk</th><th>Outcome</th><th>ms</th></tr></thead>
                                <tbody>
                                  {atts.map((a) => (
                                    <tr key={a.id}>
                                      <td className="mono text-slate-500">{a.id}</td>
                                      <td className="mono text-[9.5px] text-cyan-300/90">{a.scenarioCode}</td>
                                      <td className="mono text-slate-400">R{a.round}{a.adaptive ? '·ad' : ''}</td>
                                      <td><DecisionBadge decision={a.finalDecision} /></td>
                                      <td className="mono"><span className={a.riskScore >= 70 ? 'text-rose-300' : a.riskScore >= 45 ? 'text-amber-300' : 'text-emerald-300'}>{a.riskScore}</span></td>
                                      <td><OutcomeBadge outcome={a.outcome} /></td>
                                      <td className="mono text-slate-500">{a.durationMs}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
