import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { calculateMetrics, displayedMetrics, metricChange, rankedRemovals, type EvaluationRecord, type EvaluationResults } from '@/data/evaluation';

const selectClass = 'rounded-lg border border-line bg-white px-3 py-2 text-[12px]';
const fmt = (v: number | null) => v === null ? 'Unavailable' : Number(v.toPrecision(6)).toString();
const sameRelation = (a: EvaluationRecord, b: EvaluationRecord) => a.source != null ? a.source === b.source && a.target === b.target : a.label === b.label;
const sameRequest = (a: EvaluationRecord, b: EvaluationRecord) => sameRelation(a, b) && a.protocolId === b.protocolId && JSON.stringify([...a.contextIds].sort()) === JSON.stringify([...b.contextIds].sort());

export function EvaluationWorkspace({ data }: { data: EvaluationResults }) {
  const [sampleId, setSampleId] = useState(data.samples[0].id);
  const [recordId, setRecordId] = useState(() => rankedRemovals(data.samples[0], data.records, -1, 'mae')[0]?.record.id ?? '');
  const sample = data.samples.find(s => s.id === sampleId)!;
  const [output, setOutput] = useState(-1);
  const [relationFilter, setRelationFilter] = useState('');
  const [metric, setMetric] = useState<'mae' | 'mse'>('mae');
  const record = data.records.find(r => r.id === recordId && r.sampleId === sampleId);
  const values = record ? displayedMetrics(sample, record, output) : null;
  const label = (id: string) => data.nodes.find(n => n.id === id)?.label ?? id;
  const [page, setPage] = useState(0);
  const ranked = useMemo(() => rankedRemovals(sample, data.records, output, metric), [sample, data.records, output, metric]);
  const relationLabel = (r: EvaluationRecord) => r.source != null ? `${label(r.source)} → ${label(r.target!)}` : r.label;
  const filtered = ranked.filter(({ record: r }) => `${relationLabel(r)} ${r.source ?? ''} ${r.target ?? ''}`.toLowerCase().includes(relationFilter.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const color = (status?: string) => status === 'Improved' ? 'text-emerald-700' : status === 'Degraded' ? 'text-red-600' : 'text-slate-500';
  const selectRecord = (r: EvaluationRecord) => setRecordId(r.id);
  const chooseSample = (id: string) => {
    const nextRecord = record ? data.records.find(r => r.sampleId === id && sameRequest(r, record)) : undefined;
    setSampleId(id); setRecordId(nextRecord?.id ?? ''); setPage(0);
  };
  const raw = !!(sample.truth && sample.baselinePrediction && record?.prediction);
  const steps = raw ? sample.truth!.map((row, t) => {
    const before = calculateMetrics([sample.baselinePrediction![t]], [row], output)[metric];
    const after = calculateMetrics([record!.prediction![t]], [row], output)[metric];
    return { before, after, ...metricChange(before, after) };
  }) : [];
  const chart = {
    animation: false,
    grid: { top: 45, bottom: 65, left: 80, right: 30 },
    tooltip: { trigger: 'axis', renderMode: 'richText', formatter: (params: { dataIndex: number }[]) => {
      const i = params[0]?.dataIndex, step = steps[i];
      return step ? `Forecast step ${i + 1}\nBefore: ${fmt(step.before)}\nAfter: ${fmt(step.after)}\n${metric.toUpperCase()} change: ${fmt(step.delta)}\n${step.label}` : '';
    } },
    xAxis: { type: 'category', name: 'Forecast step', nameLocation: 'middle', nameGap: 35, data: steps.map((_, i) => String(i + 1)), axisTick: { alignWithLabel: true } },
    yAxis: { type: 'value', name: `${metric.toUpperCase()} change`, splitLine: { lineStyle: { color: '#e2e8f0' } } },
    series: [{ name: `${metric.toUpperCase()} change`, type: 'bar', barMaxWidth: 48,
      data: steps.map(step => ({ value: step.delta, itemStyle: { color: step.label === 'Improved' ? '#047857' : step.label === 'Degraded' ? '#dc2626' : '#64748b', borderRadius: 3 } })),
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#475569', type: 'solid' }, data: [{ yAxis: 0 }] },
    }],
  };
  return <div className="mx-auto max-w-[1400px] space-y-5 px-5 py-6" data-testid="evaluation-workspace">
    <div className="card flex flex-wrap items-end gap-4 p-5">
      <div className="mr-auto"><div className="eyebrow">Evaluation Results · {data.runStatus}</div><h3 className="mt-2 text-xl font-semibold">{data.model} · {data.dataset}</h3><p className="mt-1 text-[12px] text-ink-500">{data.nodes.length} graph nodes · {data.outputs.length} forecast outputs · {data.horizon} forecast steps</p></div>
      <label className="flex flex-col gap-1 text-[11px]">Sample<select aria-label="Evaluation sample" className={selectClass} value={sampleId} onChange={e => chooseSample(e.target.value)}>{data.samples.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-[11px]">Output<select aria-label="Evaluation output" className={selectClass} value={output} onChange={e => { setOutput(Number(e.target.value)); setPage(0); }}><option value={-1}>All outputs (mean)</option>{data.outputs.map((v, i) => <option key={v} value={i} disabled={!raw}>{v}{!raw ? ' · raw arrays unavailable' : ''}</option>)}</select></label>
    </div>
    {data.runStatus === 'partial' && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm">This run is incomplete. Only completed removals are displayed; missing results are not zero changes.</p>}
    <section id="validation-workspace" className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-4"><h3 className="mr-auto text-lg font-semibold">Forecast performance</h3>
        <label className="flex items-center gap-2 text-xs">Rank by<select aria-label="Evaluation metric" className={selectClass} value={metric} onChange={e => { setMetric(e.target.value as 'mae' | 'mse'); setPage(0); }}><option value="mae">MAE</option><option value="mse">MSE</option></select></label>
        <input aria-label="Filter relations" placeholder="Search edges" className={selectClass} value={relationFilter} onChange={e => { setRelationFilter(e.target.value); setPage(0); }}/>
      </div>
      <div className="flex flex-wrap gap-5 text-xs font-medium"><span className="text-emerald-700">Improved</span><span className="text-red-600">Degraded</span><span className="text-slate-500">No noticeable change</span></div>
      <div className="max-h-[420px] overflow-auto"><table aria-label="Ranked forecast performance" className="w-full text-left text-xs"><thead className="sticky top-0 bg-white"><tr>{['Edge', ...(sample.contexts.length > 1 ? ['Context'] : []), ...(data.protocols.length > 1 ? ['Removal'] : []), 'Before', 'After', 'Error change', 'Change'].map(v => <th key={v} className="p-3">{v}</th>)}</tr></thead><tbody>
        {filtered.slice(currentPage * 50, (currentPage + 1) * 50).map(({ record: r, values: v, change: c }) => <tr key={r.id} data-change={c?.label ?? 'Unavailable'} className={`border-t border-line ${recordId === r.id ? 'bg-slate-50' : ''}`}>
          <td className="p-3"><button aria-pressed={recordId === r.id} className={`font-semibold hover:underline ${color(c?.label)}`} onClick={() => selectRecord(r)}>{relationLabel(r)}</button></td>
          {sample.contexts.length > 1 && <td className="p-3">{r.contextIds.map(id => sample.contexts.find(c => c.id === id)?.label ?? id).join(', ')}</td>}
          {data.protocols.length > 1 && <td className="p-3">{data.protocols.find(p => p.id === r.protocolId)?.label}</td>}
          <td className="p-3">{v ? fmt(v.before[metric]) : 'Unavailable'}</td><td className="p-3">{v ? fmt(v.after[metric]) : 'Unavailable'}</td><td className="p-3">{c ? fmt(c.delta) : 'Unavailable'}</td><td className={`p-3 ${color(c?.label)}`}>{c?.label ?? 'Unavailable'}</td>
        </tr>)}
      </tbody></table>{!filtered.length && <p className="p-3 text-sm text-slate-500">No matching results.</p>}</div>
      <div className="flex items-center justify-between text-xs"><span>{filtered.length ? `${currentPage * 50 + 1}–${Math.min((currentPage + 1) * 50, filtered.length)} of ${filtered.length} results` : '0 results'}</span><div className="flex gap-3"><button className="disabled:opacity-40" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="disabled:opacity-40" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
      {record && <h4 className={`font-semibold ${color(values ? metricChange(values.before[metric], values.after[metric]).label : undefined)}`}>{relationLabel(record)}</h4>}
        {!record && <p role="status" className="text-sm text-ink-500">No stored removal selected. Select a result; an edge without a computed result is unavailable.</p>}
        {record && !values && <p role="status">Per-output metrics unavailable. Choose All outputs to view stored aggregate metrics.</p>}
        {values && <div className="overflow-x-auto"><table className="w-full text-left text-[12px]"><thead><tr>{['Metric', 'Before', 'After', 'After − before', 'Improvement %', 'Change'].map(v => <th className="p-2" key={v}>{v}</th>)}</tr></thead><tbody>{(['mae', 'mse'] as const).map(k => { const c = metricChange(values.before[k], values.after[k]); return <tr key={k} className="border-t border-line"><th className="p-2 uppercase">{k}</th><td className="p-2">{fmt(values.before[k])}</td><td className="p-2">{fmt(values.after[k])}</td><td className="p-2">{fmt(c.delta)}</td><td className="p-2">{fmt(c.improvement)}</td><td className="p-2">{c.label}</td></tr>; })}</tbody></table></div>}
    </section>
    <section className="card p-5" data-testid="removal-change-chart">
      <h3 className="text-lg font-semibold">{metric.toUpperCase()} change after edge removal · Sample {sampleId}</h3>
      {record && <p className="mt-2 text-sm text-slate-600">{relationLabel(record)} · {output < 0 ? 'All outputs (mean)' : data.outputs[output]}</p>}
      <div className="mt-4 flex flex-wrap gap-5 text-xs"><span className="text-emerald-700">Improved · lower error</span><span className="text-red-600">Degraded · higher error</span><span className="text-slate-500">No noticeable change</span></div>
      {raw ? <ReactECharts option={chart} notMerge style={{ height: 360 }}/> : <p className="my-8 text-sm text-slate-500">Forecast-step error changes unavailable: prediction and truth arrays are required.</p>}
    </section>
    <details className="card p-5"><summary className="cursor-pointer font-semibold">Data checks, native verification and provenance</summary><p className="mt-3 text-sm">Result format validated. Stored metrics were recomputed wherever prediction and truth arrays were supplied. Model execution and native intervention correctness are separate checks; imported verification statements come from the result producer.</p>{(['identity', 'nativeIntervention'] as const).map(k => <p key={k} className="mt-3 text-sm"><b>{k}: {data.validation[k].status}</b> · {data.validation[k].detail}</p>)}<pre className="mt-4 max-h-72 overflow-auto rounded bg-paper p-3 text-[10px]">{JSON.stringify(data.provenance, null, 2)}</pre></details>
  </div>;
}
