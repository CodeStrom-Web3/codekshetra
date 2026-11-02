// Command Center — headline evidence metrics, risk trend, decision split, live feed.
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldHalf, ShieldAlert, CheckCircle2, Gauge, ListChecks, Radio, FlaskConical,
  Swords, Bot, ArrowRight, AlertTriangle, Database,
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle, StatCard, DecisionBadge, fmtTime } from '../components/ui';
import {
  computeMetrics, decisionDistribution, policyHitCounts, riskTrend,
} from '../engine/store';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const DECISION_COLORS: Record<string, string> = {
  ALLOW: '#10b981', BLOCK: '#f43f5e', REQUIRE_APPROVAL: '#f59e0b', SANITIZE_AND_RECHECK: '#22d3ee',
};

export default function Dashboard() {
  const { db, version, events } = useApp();
  void version;
  const m = computeMetrics(db);
  const decisions = decisionDistribution(db);
  const policyHits = policyHitCounts(db, 6);
  const trend = riskTrend(db, 30);
  const pendingApprovals = db.approvals.filter((a) => a.status === 'PENDING').length;
  const latestSim = [...db.simulations].sort((a, b) => b.id - a.id)[0];
  const recentAttempts = [...db.attempts].sort((a, b) => b.id - a.id).slice(0, 7);
  const blockedCalls = db.toolCalls.filter((t) => t.decision === 'BLOCK').length;
  const navigate = useNavigate();

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f1829', borderColor: 'rgba(148,184,220,.3)', borderWidth: 1, titleFont: { family: 'JetBrains Mono', size: 10 }, bodyFont: { family: 'JetBrains Mono', size: 10 } } },
    scales: {
      x: { grid: { color: 'rgba(148,184,220,.06)' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 8 } },
      y: { grid: { color: 'rgba(148,184,220,.06)' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 9 } }, min: 0, max: 100 },
    },
  } as const;

  return (
    <div className="space-y-4">
      <SectionTitle
        icon={ShieldHalf}
        title="Command Center"
        sub="Evidence-based posture from every persisted attempt. Baseline vs protected rounds prove the Guardian's value — nothing here is a canned number."
        right={
          <div className="flex items-center gap-2">
            {pendingApprovals > 0 && (
              <Link to="/approvals" className="btn btn-amber !text-[11px]"><AlertTriangle size={13} /> {pendingApprovals} pending approval{pendingApprovals > 1 ? 's' : ''}</Link>
            )}
            <Link to="/simulations" className="btn btn-primary !text-[11px]"><FlaskConical size={13} /> New Simulation</Link>
          </div>
        }
      />

      {/* headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard icon={Swords} label="Attack Block Rate" tone="green"
          value={m.attackBlockRate === null ? 'N/A' : `${m.attackBlockRate}%`}
          sub={`TP ${m.confusion.tp} / ${m.attackCount} attacks — FN ${m.confusion.fn}`} />
        <StatCard icon={ShieldAlert} label="Attack Success" tone={m.confusion.fn > 0 ? 'red' : 'green'}
          value={m.attackSuccessRate === null ? 'N/A' : `${m.attackSuccessRate}%`}
          sub="attacks that executed harm" />
        <StatCard icon={CheckCircle2} label="Legit Completion" tone="cyan"
          value={m.legitimateCompletionRate === null ? 'N/A' : `${m.legitimateCompletionRate}%`}
          sub={`TN ${m.confusion.tn} / ${m.benignCount} benign tasks`} />
        <StatCard icon={ShieldAlert} label="False Positive" tone={m.falsePositiveRate && m.falsePositiveRate > 20 ? 'amber' : 'green'}
          value={m.falsePositiveRate === null ? 'N/A' : `${m.falsePositiveRate}%`}
          sub={`FP ${m.confusion.fp} / ${m.benignCount} benign blocked`} />
        <StatCard icon={Gauge} label="Defence Index" tone="cyan"
          value={m.defenceIndex === null ? 'N/A' : m.defenceIndex}
          sub="mean(block, precision, utility) — heuristic, not certified" />
        <StatCard icon={ListChecks} label="Tool Calls" tone="slate"
          value={db.toolCalls.length}
          sub={`${blockedCalls} blocked · ${db.decisions.length} decisions`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* risk trend */}
        <Panel className="xl:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 flex items-center gap-2"><Radio size={12} className="text-cyan-400" /> Risk score per attempt</h3>
            <span className="mono text-[9px] text-slate-600">last {trend.length} attempts</span>
          </div>
          <div className="h-48">
            {trend.length > 1 ? (
              <Line
                data={{
                  labels: trend.map((t) => `#${t.id}`),
                  datasets: [{
                    label: 'risk', data: trend.map((t) => t.risk),
                    borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,.12)',
                    borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#22d3ee',
                    fill: true, tension: 0.35,
                  }],
                }}
                options={chartOpts}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </Panel>

        {/* decision distribution */}
        <Panel className="p-5">
          <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-3 flex items-center gap-2"><ShieldHalf size={12} className="text-cyan-400" /> Guardian decisions</h3>
          <div className="flex items-center gap-4">
            <div className="h-36 w-36 shrink-0">
              {decisions.length > 0 ? (
                <Doughnut
                  data={{
                    labels: decisions.map((d) => d.decision.replace(/_/g, ' ')),
                    datasets: [{
                      data: decisions.map((d) => d.count),
                      backgroundColor: decisions.map((d) => DECISION_COLORS[d.decision] ?? '#475569'),
                      borderColor: '#0b1220', borderWidth: 3, hoverOffset: 6,
                    }],
                  }}
                  options={{ cutout: '62%', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: chartOpts.plugins.tooltip } } as never}
                />
              ) : <EmptyState small />}
            </div>
            <ul className="space-y-1.5 flex-1">
              {decisions.map((d) => (
                <li key={d.decision} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 min-w-0"><span className="h-2 w-2 rounded-sm shrink-0" style={{ background: DECISION_COLORS[d.decision] }} /><span className="mono text-slate-400 truncate">{d.decision.replace(/_/g, ' ')}</span></span>
                  <span className="mono text-slate-200">{d.count}</span>
                </li>
              ))}
              {decisions.length === 0 && <li className="text-[11px] text-slate-600">No attempts yet — run a simulation.</li>}
            </ul>
          </div>
          {/* policy hits */}
          <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-4 mb-2">Most-triggered rules</h3>
          <div className="flex flex-wrap gap-1.5">
            {policyHits.map((p) => (
              <span key={p.rule} className="chip chip-slate">{p.rule} <span className="text-slate-500">×{p.count}</span></span>
            ))}
            {policyHits.length === 0 && <span className="text-[11px] text-slate-600">No rule triggers recorded yet.</span>}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* latest simulation + recent attempts */}
        <Panel className="xl:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--color-line)]">
            <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 flex items-center gap-2"><Database size={12} className="text-cyan-400" /> Latest attack ledger</h3>
            <Link to="/simulations" className="mono text-[9.5px] uppercase tracking-widest text-cyan-400 hover:text-cyan-300 flex items-center gap-1">All simulations <ArrowRight size={11} /></Link>
          </div>
          {latestSim && (
            <div className="px-5 py-2.5 border-b border-[var(--color-line)] flex items-center gap-3 flex-wrap text-[11px]">
              <span className="mono text-slate-500">SIM#{latestSim.id}</span>
              <span className="text-slate-300 font-medium truncate max-w-[240px]">{latestSim.name}</span>
              <span className="chip chip-cyan">{latestSim.mode}</span>
              <span className={`chip ${latestSim.status === 'COMPLETED' ? 'chip-green' : 'chip-amber'}`}>{latestSim.status}</span>
              <span className="text-slate-500">{latestSim.completedAttempts}/{latestSim.totalAttempts} attempts · {latestSim.attacksBlocked} blocked · {latestSim.attacksSucceeded} succeeded</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="data">
              <thead><tr><th>Attempt</th><th>Scenario</th><th>Round</th><th>Decision</th><th>Risk</th><th>Outcome</th><th>When</th></tr></thead>
              <tbody>
                {recentAttempts.map((a) => (
                  <tr key={a.id} className="cursor-pointer" onClick={() => navigate(`/monitor?attempt=${a.id}`)}>
                    <td className="mono text-slate-500">#{a.id}</td>
                    <td><span className="mono text-cyan-300/90 text-[10px]">{a.scenarioCode}</span><div className="text-[10px] text-slate-500 max-w-[220px] truncate">{a.scenarioName}</div></td>
                    <td className="mono text-slate-400">R{a.round}{a.adaptive ? '·A' : ''} <span className="text-slate-600">{a.roundMode === 'BASELINE' ? 'BASE' : 'PROT'}</span></td>
                    <td><DecisionBadge decision={a.finalDecision} /></td>
                    <td className="mono"><span className={a.riskScore >= 70 ? 'text-rose-300' : a.riskScore >= 45 ? 'text-amber-300' : 'text-emerald-300'}>{a.riskScore}</span></td>
                    <td className="mono text-[10px] text-slate-400">{a.outcome}</td>
                    <td className="mono text-[9.5px] text-slate-500">{fmtTime(a.startedAt)}</td>
                  </tr>
                ))}
                {recentAttempts.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-600 py-8">No attempts persisted yet. Head to <Link to="/simulations" className="text-cyan-400">Simulations</Link> and fire your first suite.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* agents at a glance */}
        <Panel className="p-5">
          <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-3 flex items-center gap-2"><Bot size={12} className="text-cyan-400" /> Three-agent doctrine</h3>
          <div className="space-y-2.5">
            {db.agents.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
                <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${a.kind === 'RED_TEAM' ? 'bg-rose-400' : a.kind === 'GUARDIAN' ? 'bg-cyan-400' : 'bg-emerald-400'} pulse-dot`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[10.5px] text-slate-200">{a.name}</span>
                    <span className={`chip ${a.kind === 'RED_TEAM' ? 'chip-red' : a.kind === 'GUARDIAN' ? 'chip-cyan' : 'chip-green'} !text-[8px] !py-0.5`}>{a.kind.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug mt-1 line-clamp-2">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-cyan-400/15 bg-cyan-400/5 px-3 py-2.5">
            <div>
              <div className="mono text-[9px] uppercase tracking-widest text-cyan-300">Live event bus</div>
              <div className="text-[10px] text-slate-500">{events.length} events this session</div>
            </div>
            <Link to="/monitor" className="btn btn-ghost !text-[10px] !py-1.5"><Radio size={12} /> Open Monitor</Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function EmptyState({ small }: { small?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${small ? 'h-36' : 'h-full'}`}>
      <FlaskConical size={26} className="text-slate-700 mb-2" strokeWidth={1.5} />
      <p className="text-[11px] text-slate-600 max-w-[220px]">Run a simulation to populate evidence</p>
    </div>
  );
}
