import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { calculateMetrics, crossSampleConsistency, displayedMetrics, metricChange, rankedRemovals, sameEvaluationRequest, type EvaluationRecord, type EvaluationResults } from '@/data/evaluation';

const selectClass = 'rounded-lg border border-line bg-white px-3 py-2 text-[12px]';
const fmt = (v: number | null) => v === null ? 'Unavailable' : Number(v.toPrecision(6)).toString();

export function EvaluationWorkspace({ data }: { data: EvaluationResults }) {
  const [sampleId, setSampleId] = useState(data.samples[0].id);
  const [recordId, setRecordId] = useState(() => rankedRemovals(data.samples[0], data.records, -1, 'mae')[0]?.record.id ?? '');
  const sample = data.samples.find(s => s.id === sampleId)!;
  const [output, setOutput] = useState(-1);
  const [relationFilter, setRelationFilter] = useState('');
  const [metric, setMetric] = useState<'mae' | 'mse'>('mae');
  const [chartAxis, setChartAxis] = useState<'steps' | 'samples'>('steps');
  const record = data.records.find(r => r.id === recordId && r.sampleId === sampleId);
  const values = record ? displayedMetrics(sample, record, output) : null;
  const label = (id: string) => data.nodes.find(n => n.id === id)?.label ?? id;
  const [page, setPage] = useState(0);
  const ranked = useMemo(() => rankedRemovals(sample, data.records, output, metric), [sample, data.records, output, metric]);
  const relationLabel = (r: EvaluationRecord) => r.source != null ? `${label(r.source)} → ${label(r.target!)}` : r.label;
  const consistency = useMemo(() => record ? crossSampleConsistency(data, record) : [], [data, record]);
  const filtered = ranked.filter(({ record: r }) => `${relationLabel(r)} ${r.source ?? ''} ${r.target ?? ''}`.toLowerCase().includes(relationFilter.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const color = (status?: string) => status === 'Improved' ? 'text-emerald-700' : status === 'Degraded' ? 'text-red-600' : 'text-slate-500';
  const selectRecord = (r: EvaluationRecord) => setRecordId(r.id);
  const chooseSample = (id: string) => {
    const nextRecord = record ? data.records.find(r => r.sampleId === id && sameEvaluationRequest(r, record)) : undefined;
    setSampleId(id); setRecordId(nextRecord?.id ?? ''); setPage(0);
  };
  const raw = !!(sample.truth && sample.baselinePrediction && record?.prediction);
  const steps = raw ? sample.truth!.map((row, t) => {
    const before = calculateMetrics([sample.baselinePrediction![t]], [row], output)[metric];
    const after = calculateMetrics([record!.prediction![t]], [row], output)[metric];
    return { before, after, ...metricChange(before, after) };
  }) : [];
  const crossSamplePoints = record ? data.records.filter(candidate => sameEvaluationRequest(candidate, record)).map(candidate => {
    const candidateSample = data.samples.find(item => item.id === candidate.sampleId)!;
    const change = metricChange(candidateSample.baselineMetrics[metric], candidate.metrics[metric]);
    return { sampleId: candidate.sampleId, before: candidateSample.baselineMetrics[metric], after: candidate.metrics[metric], ...change };
  }).sort((a, b) => a.sampleId.localeCompare(b.sampleId, undefined, { numeric: true })) : [];
  const pointColor = (label: string) => label === 'Improved' ? '#16827f' : label === 'Degraded' ? '#c95445' : '#64748b';
  const zeroLine = { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#475569', type: 'solid' }, data: [{ yAxis: 0 }] };
  const stepChart = {
    animation: false,
    grid: { top: 45, bottom: 65, left: 80, right: 30 },
    tooltip: { trigger: 'axis', renderMode: 'richText', formatter: (params: { dataIndex: number }[]) => {
      const i = params[0]?.dataIndex, step = steps[i];
      return step ? `Forecast step ${i + 1}\nBefore: ${fmt(step.before)}\nAfter: ${fmt(step.after)}\nΔ${metric.toUpperCase()} (after removal − baseline): ${fmt(step.delta)}\n${step.label}` : '';
    } },
    xAxis: { type: 'category', name: 'Forecast step', nameLocation: 'middle', nameGap: 35, data: steps.map((_, i) => String(i + 1)), axisTick: { alignWithLabel: true } },
    yAxis: { type: 'value', name: `Δ${metric.toUpperCase()}`, splitLine: { lineStyle: { color: '#e2e8f0' } } },
    series: [{ name: `Δ${metric.toUpperCase()}`, type: 'line', smooth: false, showSymbol: true, symbol: 'circle', symbolSize: 7, lineStyle: { color: '#64748b', width: 1.5 },
      data: steps.map(step => ({ value: step.delta, itemStyle: { color: pointColor(step.label), borderColor: '#fff', borderWidth: 1 } })),
      markLine: zeroLine,
    }],
  };
  const sampleChart = {
    animation: false,
    grid: { top: 45, bottom: 65, left: 90, right: 30 },
    tooltip: { trigger: 'item', renderMode: 'richText', formatter: (param: { data: { detail: string } }) => param.data.detail },
    xAxis: { type: 'category', name: 'Test sample', nameLocation: 'middle', nameGap: 35, data: crossSamplePoints.map(point => point.sampleId), axisTick: { alignWithLabel: true } },
    yAxis: { type: 'value', name: `${metric.toUpperCase()} change (%)`, splitLine: { lineStyle: { color: '#e2e8f0' } } },
    series: [{ name: `${metric.toUpperCase()} change (%)`, type: 'line', smooth: false, showSymbol: true, symbol: 'circle', symbolSize: 10, lineStyle: { color: '#64748b', width: 1.5 },
      data: crossSamplePoints.map(point => ({ value: point.percentChange, detail: `Test sample ${point.sampleId}\nBefore: ${fmt(point.before)}\nAfter: ${fmt(point.after)}\nChange: ${fmt(point.percentChange)}%\n${point.label}`, itemStyle: { color: pointColor(point.label), borderColor: '#fff', borderWidth: 1 } })),
      markLine: zeroLine,
      markArea: { silent: true, itemStyle: { color: 'rgba(100,116,139,.08)' }, data: [[{ yAxis: -.1 }, { yAxis: .1 }]] },
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
        {values && <div className="overflow-x-auto"><table className="w-full text-left text-[12px]"><thead><tr>{['Metric', 'Before', 'After', 'Δ (after removal − baseline)', 'Change (%)', 'Classification'].map(v => <th className="p-2" key={v}>{v}</th>)}</tr></thead><tbody>{(['mae', 'mse'] as const).map(k => { const c = metricChange(values.before[k], values.after[k]); return <tr key={k} className="border-t border-line"><th className="p-2 uppercase">{k}</th><td className="p-2">{fmt(values.before[k])}</td><td className="p-2">{fmt(values.after[k])}</td><td className="p-2">{fmt(c.delta)}</td><td className="p-2">{fmt(c.percentChange)}</td><td className="p-2">{c.label}</td></tr>; })}</tbody></table></div>}
    </section>
    {record && <section className="card space-y-4 p-5" data-testid="evaluation-consistency">
      <div><div className="eyebrow">Across uploaded test samples · {relationLabel(record)}</div><h3 className="mt-1 text-lg font-semibold">Cross-sample consistency by graph context</h3><p className="mt-2 text-sm text-ink-500">The selected relation is matched across all samples using the same removal protocol and context IDs. Values use the stored all-output mean.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">{consistency.map(group => {
        const contextNames = group.representative.contextIds.map(id => data.samples.flatMap(s => s.contexts).find(c => c.id === id)?.label ?? id);
        const protocol = data.protocols.find(p => p.id === group.representative.protocolId);
        const groupLabel = contextNames.length ? contextNames.join(', ') : protocol?.label ?? group.representative.label;
        return <article key={group.key} className={`rounded-xl border p-4 ${group.selected ? 'border-[#16827f] bg-[#f2faf9]' : 'border-line bg-[#fafbfd]'}`}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold">{groupLabel}</h4>{protocol && protocol.label !== groupLabel && <p className="mt-1 text-xs text-ink-500">{protocol.label}</p>}</div><div className="flex items-center gap-2"><span className="text-xs text-ink-500">n = {group.available}/{group.total}</span>{group.selected && <span className="rounded-full bg-[#16827f] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">Selected removal</span>}</div></div>
          {!group.assessable ? <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><b>Insufficient data for cross-sample consistency.</b><p className="mt-1 text-xs">At least 2 matching samples are required; this context has n = {group.available}.</p></div> : <div className="mt-4 space-y-4">{(['mae', 'mse'] as const).map(m => {
            const counts = group.directions[m], total = group.available;
            const share = (count: number) => Number((count / total * 100).toFixed(1));
            return <div key={m}><b className="text-sm">{m.toUpperCase()}</b><div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${groupLabel} ${m.toUpperCase()}: ${share(counts.improved)}% improved, ${share(counts.degraded)}% degraded, ${share(counts.unchanged)}% little change`}><span className="bg-[#16827f]" style={{width: `${share(counts.improved)}%`}}/><span className="bg-[#c95445]" style={{width: `${share(counts.degraded)}%`}}/><span className="bg-slate-300" style={{width: `${share(counts.unchanged)}%`}}/></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs"><span className="text-[#14736f]">● {share(counts.improved)}% improved</span><span className="text-[#b7473a]">● {share(counts.degraded)}% degraded</span><span className="text-ink-500">● {share(counts.unchanged)}% little change</span></div></div>;
          })}</div>}
        </article>;
      })}</div>
      <p className="text-xs leading-relaxed text-ink-500">Each matching sample contributes one stored aggregate MAE and MSE result. Missing removals are excluded from n. Percentages are descriptive and do not use a significance test.</p>
    </section>}
    <section className="card p-5" data-testid="removal-change-chart">
      <h3 className="text-lg font-semibold">{metric.toUpperCase()} change{chartAxis === 'samples' ? ' (%)' : ''} after edge removal{chartAxis === 'steps' ? ` · Sample ${sampleId}` : ''}</h3>
      {record && <p className="mt-2 text-sm text-slate-600">{relationLabel(record)} · {chartAxis === 'samples' || output < 0 ? 'All outputs (mean)' : data.outputs[output]}</p>}
      <p className="mt-2 text-sm">{chartAxis === 'samples' ? `${metric.toUpperCase()} change (%) = (after removal − baseline) / baseline × 100. The gray band is −0.1% to +0.1%.` : `Δ${metric.toUpperCase()} = after removal − baseline.`} Above zero: worse; below zero: better.</p>
      <div className="mt-4 flex flex-wrap gap-2">{([['steps', 'By forecast step'], ['samples', 'Across test samples']] as const).map(([value, text]) => <button key={value} type="button" aria-pressed={chartAxis === value} onClick={() => setChartAxis(value)} className={`rounded-lg border px-4 py-2 text-sm ${chartAxis === value ? 'border-[#16827f] bg-[#edf7f6]' : 'border-line bg-white'}`}>{text}</button>)}{(['mae', 'mse'] as const).map(value => <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)} className={`rounded-lg border px-4 py-2 text-sm ${metric === value ? 'border-[#263b59] bg-[#263b59] text-white' : 'border-line bg-white'}`}>{value.toUpperCase()}</button>)}</div>
      <p className="mt-3 text-sm text-slate-500">{chartAxis === 'steps' ? `Selected sample: each point uses one forecast step${output < 0 ? ` averaged across ${data.outputs.length} outputs` : ` for ${data.outputs[output]}`}.` : `${crossSamplePoints.length} matching test samples: each point uses the stored all-output mean for the same relation, removal protocol and graph contexts.`}</p>
      <div className="mt-4 flex flex-wrap gap-5 text-xs"><span className="text-emerald-700">Improved · lower error</span><span className="text-red-600">Degraded · higher error</span><span className="text-slate-500">No noticeable change</span></div>
      {chartAxis === 'steps' ? raw ? <ReactECharts option={stepChart} notMerge style={{ height: 360 }}/> : <p className="my-8 text-sm text-slate-500">Forecast-step error changes unavailable: prediction and truth arrays are required.</p> : crossSamplePoints.length >= 2 ? <ReactECharts option={sampleChart} notMerge style={{ height: 360 }}/> : <div className="my-8 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><b>Insufficient data for cross-sample consistency.</b><p className="mt-1 text-xs">At least 2 matching samples are required; this context has n = {crossSamplePoints.length}.</p></div>}
    </section>
    <details className="card p-5"><summary className="cursor-pointer font-semibold">Data checks, native verification and provenance</summary><p className="mt-3 text-sm">Result format validated. Stored metrics were recomputed wherever prediction and truth arrays were supplied. Model execution and native intervention correctness are separate checks; imported verification statements come from the result producer.</p>{(['identity', 'nativeIntervention'] as const).map(k => <p key={k} className="mt-3 text-sm"><b>{k}: {data.validation[k].status}</b> · {data.validation[k].detail}</p>)}<pre className="mt-4 max-h-72 overflow-auto rounded bg-paper p-3 text-[10px]">{JSON.stringify(data.provenance, null, 2)}</pre></details>
  </div>;
}
