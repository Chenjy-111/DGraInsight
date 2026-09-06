import { Fragment, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { conclusion, mean, percent, type Data, type Record } from '@/data/performance';
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
  const points = axis === 'steps'
    ? sample.baseline[metric].map((before, i) => ({ x: i + 1, label: `Forecast step ${i + 1}`, before, after: chosen?.after[metric][i], current: false }))
    : timeSamples.map(s => {
      const r = data.records.find(r => r.sample === s.id && r.source === source && r.target === target && r.scope === scope && r.context === (scope === 'all' ? -1 : context));
      return { x: s.id, label: `Test sample ${s.id}`, before: mean(s.baseline[metric]), after: r ? mean(r.after[metric]) : undefined, current: s.id === sampleId };
    }).sort((a,b) => a.x - b.x);
  const detail = (i: number) => {
    const p = points[i];
    return p ? `${p.label} · Baseline ${metric.toUpperCase()}: ${num(p.before)} · After removal: ${num(p.after ?? NaN)} · Change: ${num((p.after ?? NaN) - p.before)} · Improvement: ${pct(percent(p.before, p.after ?? NaN))}` : '';
  };
  const row = (r: Record | undefined, name: string) => <tr key={name}><td>{name}</td><td>{conclusion(sample.baseline, r?.after)}</td>{(['mae', 'mse'] as const).map(m => <Fragment key={m}><td>{num(mean(sample.baseline[m]))} → {num(r ? mean(r.after[m]) : NaN)}</td><td>{pct(percent(mean(sample.baseline[m]), r ? mean(r.after[m]) : NaN))}</td></Fragment>)}</tr>;
  return <div className="performance-summary space-y-5" data-testid="performance-summary">
    <section className="card space-y-4 p-6">
      <div className="eyebrow">Summary · {data.model} · {relation}</div>
      <h2 className="text-3xl font-semibold">{conclusion(sample.baseline, chosen?.after)}</h2>
      <p>{label} · Test sample {sampleId} · 1 sample, {data.horizon} forecast steps × {data.outputs.length} output variables</p>
      {!chosen && <Unavailable text="No performance record matches this selection."/>}
      <table className="w-full text-left"><thead><tr><th>Metric</th><th>Baseline</th><th>After removal</th><th>Improvement (%)</th></tr></thead><tbody>{(['mae', 'mse'] as const).map(m => {
        const b = mean(sample.baseline[m]), a = chosen ? mean(chosen.after[m]) : NaN;
        return <tr key={m}><td>{m.toUpperCase()}</td><td>{num(b)}</td><td>{num(a)}</td><td>{pct(percent(b, a))}</td></tr>;
      })}</tbody></table>
      <p className="text-sm text-ink-500">Positive improvement (%) means lower error.</p>
    </section>
    <section className="card space-y-4 p-5">
      <h3>Removal scope comparison</h3>
      <div className="flex flex-wrap gap-2" aria-label="Effective graph contexts">{relevant.map(c => <button className={`rounded border px-3 py-2 ${c.index === context ? 'bg-[#16827f] text-white' : ''}`} key={c.index} onClick={() => onContext(c.index)}>{isMsg ? 'Scale' : 'Window'} {isMsg ? c.index : c.index + 1}</button>)}</div>
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-ink-500">Summary & chart scope:</span>{(['single', 'all'] as const).map(v => <button key={v} aria-pressed={scope === v} className={`rounded border p-2 ${scope === v ? 'bg-[#263b59] text-white' : ''}`} onClick={() => setScope(v)}>{v === 'single' ? localLabel : allLabel}</button>)}</div>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Removal scope</th><th>Performance</th><th>MAE: before → after</th><th>MAE improvement (%)</th><th>MSE: before → after</th><th>MSE improvement (%)</th></tr></thead><tbody>{row(local, localLabel)}{row(all, allLabel)}</tbody></table></div>
      {relevant.length === 1 && <p className="text-sm text-ink-500">Equivalent scopes: this edge is effective in only one context.</p>}
    </section>
    <section className="card p-5">
      <h3>{metric.toUpperCase()} change after edge removal · {label}</h3>
      <p className="mt-2 text-sm">Δ{metric.toUpperCase()} = after removal − baseline. Above zero: worse; below zero: better.</p>
      <div className="my-3 flex flex-wrap gap-2">{([['steps','By forecast step'],['samples','Across test samples']] as const).map(([v, title]) => <button key={v} aria-pressed={axis === v} className={`rounded border px-3 py-2 ${axis === v ? 'bg-[#edf7f6] border-[#16827f]' : ''}`} onClick={() => setAxis(v)}>{title}</button>)}{(['mae', 'mse'] as const).map(m => <button className={`rounded border px-4 py-2 ${metric === m ? 'bg-[#263b59] text-white' : ''}`} key={m} onClick={() => setMetric(m)}>{m.toUpperCase()}</button>)}</div>
      <p className="mb-3 text-sm text-ink-500">{axis === 'steps' ? `Selected sample: each point averages ${data.outputs.length} outputs at one forecast step.` : `${timeSamples.length} test samples: each point averages ${data.horizon} steps × ${data.outputs.length} outputs. A sample is one 96-step input → 96-step forecast task.`} Graph {isMsg ? 'scales' : 'windows'} are model contexts, not forecast steps.</p>
      <label className="mb-3 block text-sm">Inspect {axis === 'steps' ? 'forecast step' : 'test sample'}<select aria-label="Error point" className="ml-3 rounded border p-2" value={point ?? ''} onChange={event => setPoint(event.target.value === '' ? null : Number(event.target.value))}><option value="">Select a point</option>{points.map((p,i) => <option key={p.label} value={i} disabled={p.after === undefined}>{p.label}{p.after === undefined ? ' (N/A)' : ''}</option>)}</select></label>
      {chosen ? <ReactECharts key={`${sampleId}:${context}:${source}:${target}:${scope}:${metric}:${axis}`} notMerge option={{
        animation: false, grid: { left: 85, right: 25, bottom: 60, top: 45 },
        tooltip: { trigger: 'axis', formatter: (p: any) => detail(p[0].dataIndex) },
        xAxis: { type: 'value', name: axis === 'samples' ? 'Test sample index' : 'Forecast step', nameLocation: 'middle', nameGap: 35, min: axis === 'steps' ? 1 : undefined, max: axis === 'steps' ? data.horizon : undefined, minInterval: 1 },
        yAxis: { type: 'value', name: `Δ${metric.toUpperCase()}`, scale: false },
        series: [{ type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbolSize: axis === 'steps' ? 5 : 7, lineStyle: { color: '#64748b', width: 1.5 },
          data: points.map((p,i) => ({ value: [p.x, p.after === undefined ? null : p.after - p.before], itemStyle: { color: (p.after ?? NaN) - p.before > 0 ? '#c95445' : '#16827f', borderColor: point === i ? '#e8a33f' : p.current ? '#263b59' : undefined, borderWidth: point === i || p.current ? 2 : 0 } })),
          markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: '#263b59', type: 'solid' } }
        }]
      }} onEvents={{ click: (p: any) => setPoint(p.dataIndex) }} style={{ height: 340 }}/> : <Unavailable text="No error series is available for this scope."/>}
      {point !== null && <p role="status" className="text-sm">{detail(point)}</p>}
      {points.some(p => p.after === undefined) && <p className="text-sm text-ink-500">Gaps indicate unavailable removals; no values are imputed.</p>}
    </section>
    <details className="card p-5">
      <summary className="cursor-pointer font-semibold">Data & methods</summary>
      <div className="mt-4 space-y-3 text-sm">
        <p>{data.model} · {data.dataset} · {data.version}<br/>Checkpoint: <code className="break-all">{data.checkpoint}</code></p>
        <p>Test sample indices: {data.samples.map(s => s.id).join(', ')}. Forecast horizon: {data.horizon}. Outputs: {data.outputs.join(', ')}. Errors use the model's standardized output scale.</p>
        <p>Single-context removal affects the selected native graph; all-context removal affects every effective occurrence of the edge. Original self-loops, renormalization and subsequent propagation are preserved.</p>
        <p>MAE = mean(|prediction − observation|); MSE = mean((prediction − observation)²). Improvement (%) = (baseline − after removal) / baseline × 100; N/A for a zero baseline.</p>
        <p>Each metric is classified after averaging raw errors. Threshold: 0.1% of baseline error. Changes below −threshold improve; above +threshold degrade; otherwise no noticeable change. Both metrics must agree for an overall improvement or degradation; a change in only one is named explicitly.</p>
        <p>{isMsg ? 'G0–G6 are latent graph positions, not output variables. Source → target maps to native A[target, source]. Scales are not consecutive time windows.' : 'Graph nodes follow the model variable-channel order. Source → target maps to A[source, target]. Window labels are 1-based; native graph indices are 0-based.'}</p>
        <p>Offline source: scripts/export_performance_v1.py. Baselines and removals share the same checkpoint, data and runtime; the browser loads stored results. Runtime: {JSON.stringify(data.environment)}.</p>
        <p>Historical replay: {data.historicalReplay}. {isMsg ? 'The historical CPU/CUDA replay failure remains unresolved. This version recomputes both baseline and removal on CPU; it does not validate historical reproduction. The old frozen-data floor of 0.00002 does not apply here.' : 'Historical replay passed the declared tolerances.'} Cross-environment equivalence is not established.</p>
        <p>Fixed model parameters: <code className="break-all">{JSON.stringify(data.parameters)}</code></p>
      </div>
    </details>
  </div>;
}
