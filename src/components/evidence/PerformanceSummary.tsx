import { Fragment, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { changePercent, conclusion, errorDelta, mean, metricDirection, type Data, type Record } from '@/data/performance';
const num = (v: number) => Number.isFinite(v) ? v.toPrecision(8) : 'N/A';
const pct = (v: number) => Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toPrecision(6)}%` : 'N/A';
export function Unavailable({ text }: { text: string }) {
  return <div role="alert" className="card border-amber-300 p-5">Results unavailable: {text}</div>;
}
export function PerformanceSummary({ data, sampleId, context, source, target, relation, onContext }: {
  data: Data; sampleId: number; context: number; source: number; target: number; relation: string; onContext: (index: number) => void;
}) {
  const [axis, setAxis] = useState<'samples' | 'steps'>('steps');
  const [scope, setScope] = useState<'single' | 'all'>('single');
  const [metric, setMetric] = useState<'mae' | 'mse'>('mae');
  const [point, setPoint] = useState<number | null>(null);
  useEffect(() => setPoint(null), [sampleId, context, source, target, scope, metric, axis]);
  const sample = data.samples.find(s => s.id === sampleId);
  const matches = (r: Record) => r.sample === sampleId && r.source === source && r.target === target;
  const local = data.records.find(r => matches(r) && r.context === context && r.scope === 'single');
  const all = data.records.find(r => matches(r) && r.context === -1 && r.scope === 'all');
  const chosen = scope === 'single' ? local : all;
  const isMsg = data.model === 'MSGNet';
  const localLabel = isMsg ? `Single scale ${context}` : `Single window ${context + 1}`;
  const allLabel = isMsg ? 'All relevant scales' : 'All relevant windows';
  const label = scope === 'single' ? localLabel : allLabel;
  const relevant = sample?.contexts.filter(c => c.edges.some(e => e[0] === source && e[1] === target)) ?? [];
  if (!sample || !relevant.some(c => c.index === context)) return <Unavailable text="This relation is inactive in the selected context. Select an effective edge."/>;
  const timeSamples = data.samples.filter(s => data.evaluationSamples.includes(s.id));
  const consistency = (rowScope: 'single' | 'all', rowMetric: 'mae' | 'mse', rowContext = context) => {
    const counts = { improved: 0, degraded: 0, unchanged: 0 };
    for (const s of timeSamples) {
      const r = data.records.find(r => r.sample === s.id && r.source === source && r.target === target && r.scope === rowScope && r.context === (rowScope === 'all' ? -1 : rowContext));
      if (!r) continue;
      const direction = metricDirection(mean(s.baseline[rowMetric]), mean(r.after[rowMetric]), data.thresholdFloor);
      if (direction !== 'unavailable') counts[direction]++;
    }
    const available = counts.improved + counts.degraded + counts.unchanged;
    const share = (count: number) => available ? `${Number((count / available * 100).toFixed(1))}%` : 'N/A';
    return { ...counts, available, text: `${share(counts.improved)} improved · ${share(counts.degraded)} degraded · ${share(counts.unchanged)} little change` };
  };
  const points = axis === 'steps'
    ? sample.baseline[metric].map((before, i) => ({ x: i + 1, label: `Forecast step ${i + 1}`, before, after: chosen?.after[metric][i], current: false }))
    : timeSamples.map(s => {
      const r = data.records.find(r => r.sample === s.id && r.source === source && r.target === target && r.scope === scope && r.context === (scope === 'all' ? -1 : context));
      return { x: s.id, label: `Test sample ${s.id}`, before: mean(s.baseline[metric]), after: r ? mean(r.after[metric]) : undefined, current: s.id === sampleId };
    }).sort((a,b) => a.x - b.x);
  const detail = (i: number) => {
    const p = points[i];
    return p ? `${p.label} · Baseline ${metric.toUpperCase()}: ${num(p.before)} · After removal: ${num(p.after ?? NaN)} · Δ${metric.toUpperCase()} (after removal − baseline): ${num(errorDelta(p.before, p.after ?? NaN))} · Change: ${pct(changePercent(p.before, p.after ?? NaN))}` : '';
  };
  const plottedPoints = points.map((p, index) => ({
    p,
    index,
    delta: p.after === undefined ? null : axis === 'samples' ? changePercent(p.before, p.after) : errorDelta(p.before, p.after),
    direction: p.after === undefined ? 'unavailable' as const : metricDirection(p.before, p.after, data.thresholdFloor),
  }));
  const markerData = (direction: 'improved' | 'degraded' | 'unchanged') => plottedPoints.filter(item => item.direction === direction).map(item => ({
    value: [item.p.x, item.delta, item.index],
  }));
  const zeroLine = { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: '#263b59', type: 'solid' } };
  const neutralBand = { silent: true, itemStyle: { color: 'rgba(100,116,139,.08)' }, data: [[{ yAxis: -.1 }, { yAxis: .1 }]] };
  const chartSeries = axis === 'samples' ? [
    { name: 'Improved', type: 'scatter', symbol: 'circle', symbolSize: 10, itemStyle: { color: '#16827f', borderColor: '#fff', borderWidth: 1 }, data: markerData('improved'), markLine: zeroLine, markArea: neutralBand },
    { name: 'Degraded', type: 'scatter', symbol: 'circle', symbolSize: 10, itemStyle: { color: '#c95445', borderColor: '#fff', borderWidth: 1 }, data: markerData('degraded') },
    { name: 'Little change', type: 'scatter', symbol: 'circle', symbolSize: 10, itemStyle: { color: '#64748b', borderColor: '#fff', borderWidth: 1 }, data: markerData('unchanged') },
  ] : [{
    type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbol: 'circle', symbolSize: 7, lineStyle: { color: '#64748b', width: 1.5 },
    data: plottedPoints.map(item => { const color = item.direction === 'degraded' ? '#c95445' : item.direction === 'improved' ? '#16827f' : item.direction === 'unchanged' ? '#64748b' : '#94a3b8'; return { value: [item.p.x, item.delta, item.index], itemStyle: { color, borderColor: '#fff', borderWidth: 1 } }; }),
    markLine: zeroLine,
  }];
  const row = (r: Record | undefined, name: string) => <tr key={name}><td>{name}</td><td>{conclusion(sample.baseline, r?.after)}</td>{(['mae', 'mse'] as const).map(m => <Fragment key={m}><td>{num(mean(sample.baseline[m]))} → {num(r ? mean(r.after[m]) : NaN)}</td><td>{pct(changePercent(mean(sample.baseline[m]), r ? mean(r.after[m]) : NaN))}</td></Fragment>)}</tr>;
  const consistencyScopes = [
    { key: `single-${context}`, label: localLabel, context, scope: 'single' as const, selected: true },
    { key: 'all', label: allLabel, context: -1, scope: 'all' as const, selected: false }
  ];
  return <div className="performance-summary space-y-5" data-testid="performance-summary">
    <section className="card space-y-4 p-6">
      <div className="eyebrow">Summary · {data.model} · {relation}</div>
      <h2 className="text-3xl font-semibold">{conclusion(sample.baseline, chosen?.after)}</h2>
      <p>{label} · Test sample {sampleId} · 1 sample, {data.horizon} forecast steps × {data.outputs.length} output variables</p>
      {!chosen && <Unavailable text="No performance record matches this selection."/>}
      <table className="w-full text-left"><thead><tr><th>Metric</th><th>Baseline</th><th>After removal</th><th>Change (%)</th></tr></thead><tbody>{(['mae', 'mse'] as const).map(m => {
        const b = mean(sample.baseline[m]), a = chosen ? mean(chosen.after[m]) : NaN;
        return <tr key={m}><td>{m.toUpperCase()}</td><td>{num(b)}</td><td>{num(a)}</td><td>{pct(changePercent(b, a))}</td></tr>;
      })}</tbody></table>
      <p className="text-sm text-ink-500">Positive change means higher error; negative change means lower error.</p>
    </section>
    <section className="card space-y-4 p-5">
      <h3>Removal scope comparison</h3>
      <div className="flex flex-wrap gap-2" aria-label="Effective graph contexts">{relevant.map(c => <button className={`rounded border px-3 py-2 ${c.index === context ? 'bg-[#16827f] text-white' : ''}`} key={c.index} onClick={() => onContext(c.index)}>{isMsg ? 'Scale' : 'Window'} {isMsg ? c.index : c.index + 1}</button>)}</div>
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-ink-500">Summary & chart scope:</span>{(['single', 'all'] as const).map(v => <button key={v} aria-pressed={scope === v} className={`rounded border p-2 ${scope === v ? 'bg-[#263b59] text-white' : ''}`} onClick={() => setScope(v)}>{v === 'single' ? localLabel : allLabel}</button>)}</div>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Removal scope</th><th>Performance</th><th>MAE: before → after</th><th>MAE change (%)</th><th>MSE: before → after</th><th>MSE change (%)</th></tr></thead><tbody>{row(local, localLabel)}{row(all, allLabel)}</tbody></table></div>
      {relevant.length === 1 && <p className="text-sm text-ink-500">Equivalent scopes: this edge is effective in only one context.</p>}
    </section>
    <section className="card space-y-4 p-5" aria-labelledby="cross-sample-consistency-heading">
      <div><div className="eyebrow">Across test samples · {data.model} · {relation}</div><h3 id="cross-sample-consistency-heading" className="mt-1">Across-sample consistency</h3><p className="mt-2 text-sm text-ink-500">The left card follows the selected {isMsg ? 'scale' : 'window'} above. The right card always shows removal across all relevant {isMsg ? 'scales' : 'windows'}.</p></div>
      <div className="grid gap-4 md:grid-cols-2">{consistencyScopes.map(item => <article key={item.key} className={`rounded-xl border p-4 ${item.selected ? 'border-[#16827f] bg-[#f2faf9]' : 'border-line bg-[#fafbfd]'}`}>
        <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">{item.label}</h4>{item.selected && <span className="rounded-full bg-[#16827f] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">Selected context</span>}</div>
        <div className="mt-4 space-y-4">{(['mae', 'mse'] as const).map(m => {
          const summary = consistency(item.scope, m, item.context), total = summary.available || 1;
          return <div key={m}><div className="flex items-baseline justify-between gap-3"><b className="text-sm">{m.toUpperCase()}</b><span className="text-xs text-ink-500">n = {summary.available}/{timeSamples.length}</span></div><div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${item.label} ${m.toUpperCase()}: ${summary.text}`}><span className="bg-[#16827f]" style={{width: `${summary.improved / total * 100}%`}}/><span className="bg-[#c95445]" style={{width: `${summary.degraded / total * 100}%`}}/><span className="bg-slate-300" style={{width: `${summary.unchanged / total * 100}%`}}/></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs"><span className="text-[#14736f]">● {summary.available ? Number((summary.improved / summary.available * 100).toFixed(1)) : 0}% improved</span><span className="text-[#b7473a]">● {summary.available ? Number((summary.degraded / summary.available * 100).toFixed(1)) : 0}% degraded</span><span className="text-ink-500">● {summary.available ? Number((summary.unchanged / summary.available * 100).toFixed(1)) : 0}% little change</span></div></div>;
        })}</div>
      </article>)}</div>
      <p className="text-xs leading-relaxed text-ink-500">Each available test sample is one forecast task. Its {data.horizon} forecast steps and {data.outputs.length} outputs are averaged before classification. Missing removals are excluded from n. This is descriptive and does not use a significance test.</p>
    </section>
    <section className="card p-5">
      <h3>{metric.toUpperCase()} change{axis === 'samples' ? ' (%)' : ''} after edge removal · {label}</h3>
      <p className="mt-2 text-sm">{axis === 'samples' ? `${metric.toUpperCase()} change (%) = (after removal − baseline) / baseline × 100. The gray band is −0.1% to +0.1%.` : `Δ${metric.toUpperCase()} = after removal − baseline.`} Above zero: worse; below zero: better.</p>
      <div className="my-3 flex flex-wrap gap-2">{([['steps','By forecast step'],['samples','Across test samples']] as const).map(([v, title]) => <button key={v} aria-pressed={axis === v} className={`rounded border px-3 py-2 ${axis === v ? 'bg-[#edf7f6] border-[#16827f]' : ''}`} onClick={() => setAxis(v)}>{title}</button>)}{(['mae', 'mse'] as const).map(m => <button className={`rounded border px-4 py-2 ${metric === m ? 'bg-[#263b59] text-white' : ''}`} key={m} onClick={() => setMetric(m)}>{m.toUpperCase()}</button>)}</div>
      <p className="mb-3 text-sm text-ink-500">{axis === 'steps' ? `Selected sample: each point averages ${data.outputs.length} outputs at one forecast step.` : `${timeSamples.length} test samples: each point averages ${data.horizon} steps × ${data.outputs.length} outputs. A sample is one 96-step input → 96-step forecast task.`} Graph {isMsg ? 'scales' : 'windows'} are model contexts, not forecast steps.</p>
      <label className="mb-3 block text-sm">Inspect {axis === 'steps' ? 'forecast step' : 'test sample'}<select aria-label="Error point" className="ml-3 rounded border p-2" value={point ?? ''} onChange={event => setPoint(event.target.value === '' ? null : Number(event.target.value))}><option value="">Select a point</option>{points.map((p,i) => <option key={p.label} value={i} disabled={p.after === undefined}>{p.label}{p.after === undefined ? ' (N/A)' : ''}</option>)}</select></label>
      {chosen ? <ReactECharts key={`${sampleId}:${context}:${source}:${target}:${scope}:${metric}:${axis}`} notMerge option={{
        animation: false, grid: { left: 85, right: 25, bottom: 60, top: 45 },
        tooltip: { trigger: 'axis', formatter: (params: any) => { const rows = Array.isArray(params) ? params : [params], row = rows.find(item => Array.isArray(item?.value) && Number.isInteger(item.value[2])); return detail(row?.value[2] ?? 0); } },
        xAxis: { type: 'value', name: axis === 'samples' ? 'Test sample index' : 'Forecast step', nameLocation: 'middle', nameGap: 35, min: axis === 'steps' ? 1 : undefined, max: axis === 'steps' ? data.horizon : undefined, minInterval: 1 },
        yAxis: { type: 'value', name: axis === 'samples' ? `${metric.toUpperCase()} change (%)` : `Δ${metric.toUpperCase()}`, scale: false },
        series: chartSeries
      }} onEvents={{ click: (p: any) => setPoint(Array.isArray(p.value) && Number.isInteger(p.value[2]) ? p.value[2] : p.dataIndex) }} style={{ height: 340 }}/> : <Unavailable text="No error series is available for this scope."/>}
      {point !== null && <p role="status" className="text-sm">{detail(point)}</p>}
      {points.some(p => p.after === undefined) && <p className="text-sm text-ink-500">Gaps indicate unavailable removals; no values are imputed.</p>}
    </section>
    <details className="card p-5">
      <summary className="cursor-pointer font-semibold">Data & methods</summary>
      <div className="mt-4 space-y-3 text-sm">
        <p>{data.model} · {data.dataset} · {data.version}<br/>Checkpoint: <code className="break-all">{data.checkpoint}</code></p>
        <p>Test sample indices: {data.samples.map(s => s.id).join(', ')}. Forecast horizon: {data.horizon}. Outputs: {data.outputs.join(', ')}. Errors use the model's standardized output scale.</p>
        <p>Single-context removal affects the selected native graph; all-context removal affects every effective occurrence of the edge. Original self-loops, renormalization and subsequent propagation are preserved.</p>
        <p>MAE = mean(|prediction − observation|); MSE = mean((prediction − observation)²). Change (%) = (after removal − baseline) / baseline × 100; N/A for a zero baseline.</p>
        <p>Each metric is classified after averaging raw errors. With Δ = after removal − baseline, the threshold is 0.1% of baseline error: changes below −threshold improve, above +threshold degrade, and values within the threshold show no noticeable change. Both metrics must agree for an overall improvement or degradation; a change in only one is named explicitly.</p>
        <p>{isMsg ? 'G0–G6 are latent graph positions, not output variables. Source → target maps to native A[target, source]. Scales are not consecutive time windows.' : 'Graph nodes follow the model variable-channel order. Source → target maps to A[source, target]. Window labels are 1-based; native graph indices are 0-based.'}</p>
        <p>Offline source: versioned checkpoint-derived performance artifacts. Baselines and removals share the same checkpoint, data and runtime; the browser loads stored results. Runtime: {JSON.stringify(data.environment)}.</p>
        <p>Fixed model parameters: <code className="break-all">{JSON.stringify(data.parameters)}</code></p>
      </div>
    </details>
  </div>;
}
