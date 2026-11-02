// Analytics — evidence-based charts: categories, decisions, rounds, severity, risk.
import { useMemo, useState } from 'react';
import {
  BarChart3, ShieldAlert, ShieldCheck, Gauge, Target, Crosshair, Info,
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut as DoughnutChart } from 'react-chartjs-2';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle, StatCard } from '../components/ui';
import {
  computeMetrics, categoryBreakdown, decisionDistribution, roundsBreakdown,
  severityBreakdown, riskTrend,
} from '../engine/store';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const DECISION_COLORS: Record<string, string> = {
  ALLOW: '#10b981', BLOCK: '#f43f5e', REQUIRE_APPROVAL: '#f59e0b', SANITIZE_AND_RECHECK: '#22d3ee',
};
const SEV_COLORS: Record<string, string> = {
  CRITICAL: '#f43f5e', HIGH: '#fb7185', MEDIUM: '#f59e0b', LOW: '#22d3ee', INFO: '#64748b',
};

export default function Analytics() {
  const { db, version } = useApp();
  void version;
  const [simFilter, setSimFilter] = useState<string>('all');
  const simId = simFilter === 'all' ? undefined : Number(simFilter);

  const m = useMemo(() => computeMetrics(db, simId), [db, version, simId]);
  const categories = useMemo(() => categoryBreakdown(db, simId), [db, version, simId]);
  const decisions = useMemo(() => decisionDistribution(db, simId), [db, version, simId]);
  const rounds = useMemo(() => roundsBreakdown(db, simId), [db, version, simId]);
  const severities = useMemo(() => severityBreakdown(db, simId), [db, version, simId]);
  const trend = useMemo(() => riskTrend(db, 40), [db, version]);

  const tooltip = {
    backgroundColor: '#0f1829', borderColor: 'rgba(148,184,220,.3)', borderWidth: 1,
    titleFont: { family: 'JetBrains Mono', size: 10 }, bodyFont: { family: 'JetBrains Mono', size: 10 },
  } as const;
  const gridColor = 'rgba(148,184,220,.07)';
  const tickStyle = { color: '#7d93b2', font: { family: 'JetBrains Mono', size: 9 } } as const;

  return (
    <div className="space-y-4">
      <SectionTitle icon={BarChart3} title="Defence Analytics"
        sub="Every number on this page is computed from persisted attempts — never from agent self-reports. N/A appears when a denominator is zero."
        right={
          <select className="input w-56" value={simFilter} onChange={(e) => setSimFilter(e.target.value)}>
            <option value="all">All simulations (global)</option>
            {db.simulations.map((s) => <option key={s.id} value={s.id}>SIM#{s.id} · {s.mode} · {s.name.slice(0, 30)}</option>)}
          </select>
        } />

      {/* KPI band */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
        <StatCard icon={ShieldCheck} label="Attack Block" tone="green" value={m.attackBlockRate === null ? 'N/A' : `${m.attackBlockRate}%`} sub={`TP ${m.confusion.tp}/${m.attackCount}`} />
        <StatCard icon={ShieldAlert} label="Attack Success" tone={m.confusion.fn ? 'red' : 'green'} value={m.attackSuccessRate === null ? 'N/A' : `${m.attackSuccessRate}%`} sub={`FN ${m.confusion.fn}/${m.attackCount}`} />
        <StatCard icon={ShieldCheck} label="Legit Completion" tone="cyan" value={m.legitimateCompletionRate === null ? 'N/A' : `${m.legitimateCompletionRate}%`} sub={`TN ${m.confusion.tn}/${m.benignCount}`} />
        <StatCard icon={ShieldAlert} label="False Positive" tone={m.falsePositiveRate ? 'amber' : 'green'} value={m.falsePositiveRate === null ? 'N/A' : `${m.falsePositiveRate}%`} sub={`FP ${m.confusion.fp}/${m.benignCount}`} />
        <StatCard icon={Target} label="Precision" tone="cyan" value={m.precision === null ? 'N/A' : `${m.precision}%`} sub="TP / (TP+FP)" />
        <StatCard icon={Crosshair} label="Recall" tone="cyan" value={m.recall === null ? 'N/A' : `${m.recall}%`} sub="TP / (TP+FN)" />
        <StatCard icon={Gauge} label="Defence Index" tone="amber" value={m.defenceIndex ?? 'N/A'} sub="heuristic composite" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* category stacked bars */}
        <Panel className="p-5">
          <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-3">Attack outcomes by category</h3>
          <div className="h-56">
            {categories.length > 0 ? (
              <Bar
                data={{
                  labels: categories.map((c) => c.category.replace(/_/g, ' ')),
                  datasets: [
                    { label: 'Blocked/gated', data: categories.map((c) => c.blocked), backgroundColor: '#10b981', borderRadius: 4, stack: 's' },
                    { label: 'Succeeded', data: categories.map((c) => c.succeeded), backgroundColor: '#f43f5e', borderRadius: 4, stack: 's' },
                  ],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { color: '#9db4d0', font: { family: 'JetBrains Mono', size: 9 }, boxWidth: 10 } }, tooltip },
                  scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { ...tickStyle, maxRotation: 35 } },
                    y: { stacked: true, grid: { color: gridColor }, ticks: { ...tickStyle, precision: 0 } },
                  },
                }}
              />
            ) : <EmptyChart />}
          </div>
        </Panel>

        {/* decision doughnut */}
        <Panel className="p-5">
          <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-3">Guardian decision distribution</h3>
          <div className="flex items-center gap-6 h-56">
            <div className="h-full w-44 shrink-0">
              {decisions.length > 0 && (
                <DoughnutChart
                  data={{
                    labels: decisions.map((d) => d.decision.replace(/_/g, ' ')),
                    datasets: [{
                      data: decisions.map((d) => d.count),
                      backgroundColor: decisions.map((d) => DECISION_COLORS[d.decision] ?? '#475569'),
                      borderColor: '#0b1220', borderWidth: 3,
                    }],
                  }}
                  options={{ cutout: '60%', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip } }}
                />
              )}
            </div>
            <div className="space-y-2 flex-1">
              {decisions.map((d) => {
                const total = decisions.reduce((s, x) => s + x.count, 0);
                const pct = total ? Math.round((1000 * d.count) / total) / 10 : 0;
                return (
                  <div key={d.decision}>
                    <div className="flex items-center justify-between mono text-[9.5px]">
                      <span className="text-slate-400">{d.decision.replace(/_/g, ' ')}</span>
                      <span className="text-slate-200">{d.count} <span className="text-slate-600">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 mt-1 rounded bg-slate-800 overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, background: DECISION_COLORS[d.decision] }} />
                    </div>
                  </div>
                );
              })}
              {decisions.length === 0 && <EmptyChart compact />}
            </div>
          </div>
        </Panel>

        {/* rounds breakdown */}
        <Panel className="p-5">
          <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-3">Round integrity — protected vs baseline vs adaptive</h3>
          <div className="h-48">
            {rounds.length > 0 ? (
              <Bar
                data={{
                  labels: rounds.map((r) => `R${r.round} ${r.mode === 'BASELINE' ? '(baseline)' : '(protected)'}`),
                  datasets: [
                    { label: 'Attempts', data: rounds.map((r) => r.attempts), backgroundColor: '#164e63', borderRadius: 5 },
                    { label: 'Attacks succeeded', data: rounds.map((r) => r.succeeded), backgroundColor: '#f43f5e', borderRadius: 5 },
                  ],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { color: '#9db4d0', font: { family: 'JetBrains Mono', size: 9 }, boxWidth: 10 } }, tooltip },
                  scales: {
                    x: { grid: { display: false }, ticks: tickStyle },
                    y: { grid: { color: gridColor }, ticks: { ...tickStyle, precision: 0 } },
                  },
                }}
              />
            ) : <EmptyChart />}
          </div>
          <p className="text-[9.5px] text-slate-600 mt-2 leading-snug">Round 2 replays identical attacks with the Guardian bypassed — the delta vs round 1 is the Guardian's measured value-add. Round 3 mutates payloads.</p>
        </Panel>

        {/* severity + risk trend */}
        <Panel className="p-5">
          <div className="grid grid-cols-5 gap-4 h-48">
            <div className="col-span-2 flex flex-col">
              <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-2">Severity mix</h3>
              <div className="flex-1 flex flex-col justify-center gap-1.5">
                {severities.map((s) => {
                  const total = severities.reduce((sum, x) => sum + x.count, 0);
                  const pct = total ? (100 * s.count) / total : 0;
                  return (
                    <div key={s.severity} className="flex items-center gap-1.5">
                      <span className="mono text-[8.5px] text-slate-500 w-14">{s.severity}</span>
                      <div className="flex-1 h-3.5 rounded bg-slate-800 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, background: SEV_COLORS[s.severity] }} />
                      </div>
                      <span className="mono text-[8.5px] text-slate-500 w-5 text-right">{s.count}</span>
                    </div>
                  );
                })}
                {severities.length === 0 && <EmptyChart compact />}
              </div>
            </div>
            <div className="col-span-3 flex flex-col">
              <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-2">Risk trajectory</h3>
              <div className="flex-1">
                {trend.length > 1 ? (
                  <Line
                    data={{
                      labels: trend.map((t) => `#${t.id}`),
                      datasets: [{
                        label: 'risk', data: trend.map((t) => t.risk),
                        borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.1)',
                        borderWidth: 1.8, pointRadius: 0, fill: true, tension: 0.4,
                      }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip },
                      scales: {
                        x: { grid: { display: false }, ticks: { ...tickStyle, maxTicksLimit: 5 } },
                        y: { grid: { color: gridColor }, ticks: tickStyle, min: 0, max: 100 },
                      },
                    }}
                  />
                ) : <EmptyChart compact />}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* methodology footnote */}
      <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
        <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <b className="text-slate-300">Methodology.</b> Ground truth is scenario design, not agent output: attacks → blocked/approval-gated = TP, executed harm = FN; benign tasks → completed = TN, blocked = FP.
          Defence Index = mean(Attack Block %, Precision %, Utility Retention %) — a documented heuristic for triage, <b className="text-slate-300">not a certification</b>.
          Sample size N = {m.sampleSize}. Rates need N≥30 for stability; treat small-N deltas as directional.
        </p>
      </div>
    </div>
  );
}

function EmptyChart({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'h-full' : 'h-full'}`}>
      <BarChart3 size={22} className="text-slate-700 mb-2" strokeWidth={1.5} />
      <p className="text-[10.5px] text-slate-600">No persisted attempts yet</p>
    </div>
  );
}
