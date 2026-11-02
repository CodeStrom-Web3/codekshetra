// Live Monitor — real-time event wall: attack lifecycle, gateway verdicts, guardian rationale.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Radio, Pause, Trash2, Swords, Eye, ShieldHalf, FlaskConical, Zap, Bug, Coffee, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle, DecisionBadge, OutcomeBadge, fmtTime } from '../components/ui';

const EVENT_STYLE: Record<string, { color: string; icon: typeof Zap; label: string }> = {
  'simulation.created': { color: 'text-cyan-300', icon: Zap, label: 'OP CREATED' },
  'simulation.started': { color: 'text-cyan-300', icon: FlaskConical, label: 'SIM STARTED' },
  'simulation.completed': { color: 'text-emerald-300', icon: CheckCircle2, label: 'SIM COMPLETE' },
  'simulation.stopped': { color: 'text-amber-300', icon: AlertTriangle, label: 'SIM STOPPED' },
  'simulation.paused': { color: 'text-amber-300', icon: Pause, label: 'PAUSED' },
  'simulation.resumed': { color: 'text-emerald-300', icon: Zap, label: 'RESUMED' },
  'simulation.failed': { color: 'text-rose-300', icon: Bug, label: 'SIM FAILED' },
  'round.started': { color: 'text-violet-300', icon: ShieldHalf, label: 'ROUND BEGIN' },
  'round.completed': { color: 'text-violet-300', icon: ShieldHalf, label: 'ROUND DONE' },
  'attempt.started': { color: 'text-rose-300', icon: Bug, label: 'ATTACK FIRED' },
  'attempt.step': { color: 'text-amber-300', icon: Swords, label: 'GATEWAY VERDICT' },
  'attempt.completed': { color: 'text-slate-300', icon: Eye, label: 'ATTEMPT DONE' },
  'gateway.sandbox': { color: 'text-cyan-300', icon: Zap, label: 'SANDBOX CALL' },
};

export default function LiveMonitor() {
  const { events, clearEvents, db, version } = useApp();
  void version;
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<'all' | 'attack' | 'benign' | 'gateway'>('all');
  const [searchParams] = useSearchParams();
  const focusAttempt = searchParams.get('attempt');
  const feedRef = useRef<HTMLDivElement>(null);
  const focused = focusAttempt ? db.attempts.find((a) => a.id === Number(focusAttempt)) : null;

  const shown = useMemo(() => {
    let list = events;
    if (filter === 'gateway') list = list.filter((e) => e.type === 'attempt.step' || e.type === 'gateway.sandbox');
    if (filter === 'attack') list = list.filter((e) => String(e.payload.is_attack) === 'true' || e.type === 'attempt.step' || e.type === 'attempt.started');
    if (filter === 'benign') list = list.filter((e) => String(e.payload.is_attack) === 'false');
    return paused ? list.slice(-60) : list.slice(-60);
  }, [events, filter, paused]);

  useEffect(() => {
    if (!paused) feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [shown.length, paused]);

  const activeSim = [...db.simulations].sort((a, b) => b.id - a.id)[0];
  const running = activeSim && ['RUNNING', 'PAUSED', 'PENDING'].includes(activeSim.status);

  return (
    <div className="space-y-4">
      <SectionTitle icon={Radio} title="Live Fire Monitor"
        sub="Real-time gateway verdicts, Guardian rationales and attack lifecycle events — streamed from the engine, not simulated theatre."
        right={
          <div className="flex items-center gap-2">
            <button onClick={() => setPaused((v) => !v)} className="btn btn-ghost !text-[11px]">
              {paused ? <><Radio size={13} /> Resume feed</> : <><Pause size={13} /> Freeze feed</>}
            </button>
            <button onClick={clearEvents} className="btn btn-ghost !text-[11px]"><Trash2 size={13} /> Clear</button>
          </div>
        } />

      {/* focused attempt (deep link from elsewhere) */}
      {focused && (
        <Panel className="p-4 border-cyan-400/30 flex flex-wrap items-center gap-4 text-[11px]">
          <span className="mono text-cyan-300">ATTEMPT #{focused.id}</span>
          <span className="text-slate-300 font-medium">{focused.scenarioName}</span>
          <DecisionBadge decision={focused.finalDecision} />
          <OutcomeBadge outcome={focused.outcome} />
          <span className="mono text-slate-500">risk {focused.riskScore} · round {focused.round} ({focused.roundMode}) · {focused.durationMs}ms</span>
        </Panel>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ── event firehose ─────────────────────────────── */}
        <Panel className="xl:col-span-2 overflow-hidden relative">
          {/* scanline */}
          <div className="pointer-events-none absolute inset-x-0 h-16 scanline bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent" />
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-line)] relative">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${running ? 'bg-rose-400 pulse-dot' : 'bg-slate-600'}`} />
              <span className="mono text-[9px] uppercase tracking-[0.22em] text-slate-400">{running ? 'Live — operation in flight' : 'Event stream (recent)'}</span>
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'attack', 'benign', 'gateway'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`mono text-[9px] uppercase px-2 py-1 rounded ${filter === f ? 'bg-cyan-400/15 text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}>{f}</button>
              ))}
            </div>
          </div>
          <div ref={feedRef} className="h-[560px] overflow-y-auto px-3 py-2 font-mono text-[10.5px] leading-relaxed relative">
            {shown.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Radio size={30} className="text-slate-700 mb-3" strokeWidth={1.5} />
                <p className="text-slate-500 text-[12px]">Silence on the wire.</p>
                <p className="text-slate-600 text-[10px] mt-1 max-w-xs">Launch a simulation and every gateway verdict lands here in real time.</p>
              </div>
            )}
            {shown.map((e) => {
              const style = EVENT_STYLE[e.type] ?? { color: 'text-slate-400', icon: Zap, label: e.type.toUpperCase() };
              const Icon = style.icon;
              const p = e.payload as Record<string, string | number | boolean>;
              const detail =
                e.type === 'attempt.step' ? `${p.tool}.${p.action} → ${p.decision} · risk ${p.risk} ${p.executed ? '· EXECUTED' : '· not run'}` :
                e.type === 'attempt.started' ? `${p.scenario} — ${p.name} [${p.category}] · sev ${p.severity}` :
                e.type === 'attempt.completed' ? `${p.scenario} → ${p.outcome} · expected ${p.expected} vs ${p.final_decision} · risk ${p.risk} · ${p.duration_ms}ms` :
                e.type === 'round.started' ? String(p.label) :
                e.type === 'simulation.completed' ? `${p.name}: ${p.attacks_blocked} blocked / ${p.attacks_succeeded} succeeded / ${p.benign_completed} legit ok` :
                e.type === 'gateway.sandbox' ? `${p.tool}.${p.action} → ${p.decision} · risk ${p.risk}` :
                JSON.stringify(e.payload).slice(0, 150);
              return (
                <div key={e.id} className="feed-item flex items-start gap-2 py-[5px] border-b border-white/[0.04]">
                  <span className="text-slate-700 shrink-0 w-[52px]">{new Date(e.ts).toLocaleTimeString('en-GB', { hour12: false })}</span>
                  <Icon size={12} className={`${style.color} shrink-0 mt-[2px]`} />
                  <span className={`${style.color} shrink-0 w-[108px] font-semibold`}>{style.label}</span>
                  <span className="text-slate-400 break-all">{detail}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ── right rail: live stats + current operation ─── */}
        <div className="space-y-4">
          {activeSim && (
            <Panel className="p-4">
              <div className="mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2">Current operation</div>
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] text-slate-500">SIM#{activeSim.id}</span>
                <span className="text-[12px] font-semibold text-slate-100 truncate">{activeSim.name}</span>
              </div>
              <div className="mt-2.5 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-500"
                  style={{ width: `${activeSim.totalAttempts ? (100 * activeSim.completedAttempts) / activeSim.totalAttempts : 0}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                {[
                  ['Blocked', activeSim.attacksBlocked, 'text-emerald-300'],
                  ['Succeeded', activeSim.attacksSucceeded, activeSim.attacksSucceeded ? 'text-rose-300' : 'text-slate-400'],
                  ['Legit OK', activeSim.benignCompleted, 'text-cyan-300'],
                  ['Legit FP', activeSim.benignBlocked, activeSim.benignBlocked ? 'text-amber-300' : 'text-slate-400'],
                ].map(([l, v, c]) => (
                  <div key={String(l)} className="rounded-lg border border-white/6 bg-white/[0.02] py-2">
                    <div className={`display text-lg font-bold ${c}`}>{v as number}</div>
                    <div className="mono text-[8.5px] uppercase tracking-widest text-slate-500">{l as string}</div>
                  </div>
                ))}
              </div>
              <div className="mono text-[9px] text-slate-600 mt-2 text-center">{activeSim.rounds} rounds · mode {activeSim.mode} · {activeSim.completedAttempts}/{activeSim.totalAttempts} attempts</div>
            </Panel>
          )}

          <Panel className="p-4">
            <div className="mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2">Attack mix — last 60 events</div>
            {(() => {
              const atk = events.filter((e) => e.type === 'attempt.completed' && (e.payload.is_attack ?? true));
              const byOutcome = atk.reduce<Record<string, number>>((acc, e) => {
                const o = String(e.payload.outcome ?? 'UNKNOWN');
                acc[o] = (acc[o] ?? 0) + 1;
                return acc;
              }, {});
              const rows = Object.entries(byOutcome);
              if (rows.length === 0) return <p className="text-[11px] text-slate-600">Waiting for attempt completions…</p>;
              const total = rows.reduce((s, [, n]) => s + n, 0);
              return (
                <div className="space-y-1.5">
                  {rows.map(([outcome, n]) => (
                    <div key={outcome} className="flex items-center gap-2">
                      <span className="mono text-[9px] w-20 text-slate-400">{outcome}</span>
                      <div className="flex-1 h-3 rounded bg-slate-800 overflow-hidden">
                        <div className={`h-full ${outcome === 'PREVENTED' || outcome === 'COMPLETED' ? 'bg-emerald-500' : outcome === 'SUCCEEDED' ? 'bg-rose-500' : 'bg-amber-500'}`}
                          style={{ width: `${(100 * n) / total}%` }} />
                      </div>
                      <span className="mono text-[9px] text-slate-500 w-6 text-right">{n}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Panel>

          <Panel className="p-4">
            <div className="mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2">Seeded threat corpus — live targets</div>
            <div className="space-y-1.5 text-[10px]">
              {db.emails.filter((e) => e.isMalicious).map((e) => (
                <div key={e.id} className="flex items-start gap-1.5"><Bug size={11} className="text-rose-400 mt-0.5 shrink-0" /><span className="text-slate-400 leading-snug">email #{e.id}: {e.subject}</span></div>
              ))}
              {db.webpages.filter((w) => w.isMalicious).map((w) => (
                <div key={w.id} className="flex items-start gap-1.5"><Bug size={11} className="text-rose-400 mt-0.5 shrink-0" /><span className="text-slate-400 leading-snug">{w.title}</span></div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
