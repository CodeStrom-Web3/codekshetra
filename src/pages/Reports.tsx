// Reports — generate PDF/CSV/JSON from persisted evidence; download instantly.
import { useState } from 'react';
import {
  FileText, FileDown, FileJson, FileSpreadsheet, Loader2, Sparkles, Eye, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Panel, SectionTitle, fmtTime, Empty } from '../components/ui';
import {
  generateReportSnapshot, buildPdf, buildCsv, buildJson, downloadBlob, registerReport,
} from '../engine/reports';
import { persist } from '../engine/store';

export default function Reports() {
  const { db, version, session, emit, refresh } = useApp();
  void version;
  const [scope, setScope] = useState<string>('GLOBAL');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);

  const simulationId = scope === 'GLOBAL' ? undefined : Number(scope);
  const previewReport = preview !== null ? db.reports.find((r) => r.id === preview) : null;

  const generate = (fmt: 'pdf' | 'csv' | 'json') => {
    if (!session) return;
    setGenerating(true);
    setTimeout(() => {
      const rec = registerReport(db, simulationId, session.email);
      const data = generateReportSnapshot(db, simulationId, session.email);
      if (fmt === 'pdf') downloadBlob(buildPdf(rec.name, data, session.email), `${rec.name}.pdf`);
      if (fmt === 'csv') downloadBlob(buildCsv(data), `${rec.name}.csv`);
      if (fmt === 'json') downloadBlob(buildJson(data), `${rec.name}.json`);
      persist();
      emit('report.generated', { report: rec.name, scope: rec.scope, format: fmt });
      refresh();
      setGenerating(false);
    }, 350);
  };

  const download = (reportId: number, fmt: 'pdf' | 'csv' | 'json') => {
    if (!session) return;
    const rec = db.reports.find((r) => r.id === reportId);
    if (!rec) return;
    const data = generateReportSnapshot(db, rec.simulationId, rec.generatedBy);
    if (fmt === 'pdf') downloadBlob(buildPdf(rec.name, data, rec.generatedBy), `${rec.name}.pdf`);
    if (fmt === 'csv') downloadBlob(buildCsv(data), `${rec.name}.csv`);
    if (fmt === 'json') downloadBlob(buildJson(data), `${rec.name}.json`);
  };

  return (
    <div className="space-y-4">
      <SectionTitle icon={FileText} title="Evidence Reports"
        sub="PDF, CSV and JSON generated from persisted attempts, decisions and audit rows — never from agent narration. PDF includes executive summary, metrics with confusion matrix, findings, recommendations and the full attempt ledger." />

      {/* generator */}
      <Panel className="p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <h3 className="display text-base font-semibold text-slate-100 flex items-center gap-2"><Sparkles size={15} className="text-amber-300" /> Forge a new report</h3>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <label className="mono text-[9px] uppercase tracking-widest text-slate-500">Scope</label>
            <select className="input w-64" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="GLOBAL">GLOBAL — everything persisted ({db.attempts.length} attempts)</option>
              {db.simulations.map((s) => (
                <option key={s.id} value={s.id}>SIM#{s.id} · {s.name.slice(0, 42)} ({s.mode})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => generate('pdf')} disabled={generating} className="btn btn-primary !px-4 !py-2.5">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={15} />} PDF
          </button>
          <button onClick={() => generate('csv')} disabled={generating} className="btn btn-ghost !px-4 !py-2.5"><FileSpreadsheet size={15} /> CSV</button>
          <button onClick={() => generate('json')} disabled={generating} className="btn btn-ghost !px-4 !py-2.5"><FileJson size={15} /> JSON</button>
        </div>
      </Panel>

      {/* report history */}
      <Panel className="overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--color-line)] flex items-center justify-between">
          <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Report registry — {db.reports.length}</h3>
        </div>
        {db.reports.length === 0 ? (
          <Empty icon={FileText} title="No reports generated yet" sub="Pick a scope and forge a PDF — it will include the full evidence chain from your simulations." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data">
              <thead><tr><th>#</th><th>Name</th><th>Scope</th><th>By</th><th>Created</th><th>Download</th><th>Preview</th></tr></thead>
              <tbody>
                {[...db.reports].reverse().map((r) => (
                  <tr key={r.id}>
                    <td className="mono text-slate-600">{r.id}</td>
                    <td className="mono text-[10px] text-cyan-200 max-w-56 truncate" title={r.name}>{r.name}</td>
                    <td className="text-[10px] text-slate-400 max-w-44 truncate" title={r.scope}>{r.scope}</td>
                    <td className="mono text-[9.5px] text-slate-500">{r.generatedBy.split('@')[0]}</td>
                    <td className="mono text-[9.5px] text-slate-500">{fmtTime(r.createdAt)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button title="Download PDF" onClick={() => download(r.id, 'pdf')} className="p-1.5 rounded border border-white/10 text-rose-300 hover:bg-rose-500/10"><FileDown size={12} /></button>
                        <button title="Download CSV" onClick={() => download(r.id, 'csv')} className="p-1.5 rounded border border-white/10 text-emerald-300 hover:bg-emerald-500/10"><FileSpreadsheet size={12} /></button>
                        <button title="Download JSON" onClick={() => download(r.id, 'json')} className="p-1.5 rounded border border-white/10 text-cyan-300 hover:bg-cyan-500/10"><FileJson size={12} /></button>
                      </div>
                    </td>
                    <td>
                      <button onClick={() => setPreview(preview === r.id ? null : r.id)} className="p-1.5 rounded border border-white/10 text-slate-400 hover:text-slate-100">
                        {preview === r.id ? <X size={12} /> : <Eye size={12} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* inline snapshot preview */}
      {previewReport && (
        <Panel className="p-5">
          <h3 className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">Snapshot preview — {previewReport.name}</h3>
          <div className="grid md:grid-cols-3 gap-3 text-[10.5px]">
            <div className="rounded-lg border border-white/6 bg-black/40 p-4">
              <div className="mono text-[9px] uppercase tracking-widest text-cyan-300 mb-2">Metrics</div>
              <pre className="mono text-[9px] text-slate-400 whitespace-pre-wrap max-h-52 overflow-auto">{JSON.stringify((previewReport.snapshot as Record<string, unknown>).metrics, null, 2)}</pre>
            </div>
            <div className="rounded-lg border border-white/6 bg-black/40 p-4">
              <div className="mono text-[9px] uppercase tracking-widest text-cyan-300 mb-2">Category outcomes</div>
              <pre className="mono text-[9px] text-slate-400 whitespace-pre-wrap max-h-52 overflow-auto">{JSON.stringify((previewReport.snapshot as Record<string, unknown>).categories, null, 2)}</pre>
            </div>
            <div className="rounded-lg border border-white/6 bg-black/40 p-4">
              <div className="mono text-[9px] uppercase tracking-widest text-cyan-300 mb-2">Round integrity</div>
              <pre className="mono text-[9px] text-slate-400 whitespace-pre-wrap max-h-52 overflow-auto">{JSON.stringify((previewReport.snapshot as Record<string, unknown>).rounds, null, 2)}</pre>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
