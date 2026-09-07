import { useId, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { displayedMetrics, metricChange, type EvaluationContext, type EvaluationRecord, type EvaluationResults } from '@/data/evaluation';

const selectClass = 'rounded-lg border border-line bg-white px-3 py-2 text-[12px]';
const fmt = (v: number | null) => v === null ? 'Unavailable' : Number(v.toPrecision(6)).toString();
const sameRelation = (a: EvaluationRecord, b: EvaluationRecord) => a.source != null ? a.source === b.source && a.target === b.target : a.label === b.label;
const sameRequest = (a: EvaluationRecord, b: EvaluationRecord) => sameRelation(a, b) && a.protocolId === b.protocolId && JSON.stringify([...a.contextIds].sort()) === JSON.stringify([...b.contextIds].sort());

export function EvaluationWorkspace({ data }: { data: EvaluationResults }) {
  const [sampleId, setSampleId] = useState(data.samples[0].id);
  const [recordId, setRecordId] = useState(data.records.find(r => r.sampleId === sampleId)?.id ?? '');
  const sample = data.samples.find(s => s.id === sampleId)!;
  const [contextId, setContextId] = useState(sample.contexts[0]?.id ?? '');
  const [edge, setEdge] = useState<{ source: string; target: string } | null>(null);
  const [output, setOutput] = useState(-1);
  const [relationFilter, setRelationFilter] = useState('');
  const [metric, setMetric] = useState<'mae' | 'mse'>('mae');
  const record = data.records.find(r => r.id === recordId && r.sampleId === sampleId);
  const context = sample.contexts.find(c => c.id === contextId);
  const selectedEdge = edge ?? (record?.source != null ? { source: record.source, target: record.target! } : null);
  const values = record ? displayedMetrics(sample, record, output) : null;
  const protocol = data.protocols.find(p => p.id === record?.protocolId);
  const label = (id: string) => data.nodes.find(n => n.id === id)?.label ?? id;
  const selectRecord = (r: EvaluationRecord) => {
    setRecordId(r.id); setEdge(null);
    if (r.contextIds.length && !r.contextIds.includes(contextId)) setContextId(r.contextIds[0]);
  };
  const chooseSample = (id: string) => {
    const next = data.samples.find(s => s.id === id)!;
    const nextRecord = record ? data.records.find(r => r.sampleId === id && sameRequest(r, record)) : undefined;
    setSampleId(id); setRecordId(nextRecord?.id ?? ''); setEdge(null);
    setContextId(next.contexts.some(c => c.id === contextId) ? contextId : next.contexts[0]?.id ?? '');
  };
  const chooseContext = (id: string) => {
    setContextId(id); setRecordId('');
    const c = sample.contexts.find(v => v.id === id);
    if (selectedEdge && c?.edges.some(e => e.source === selectedEdge.source && e.target === selectedEdge.target)) {
      setEdge(selectedEdge);
      const r = data.records.find(r => r.sampleId === sampleId && r.source === selectedEdge.source && r.target === selectedEdge.target && r.contextIds.includes(id));
      if (r) setRecordId(r.id);
    } else setEdge(null);
  };
  const related = data.records.filter(r => r.sampleId === sampleId && (selectedEdge ? r.source === selectedEdge.source && r.target === selectedEdge.target : record ? sameRelation(r, record) : true));
  const across = data.samples.map(s => {
    const r = record && data.records.find(r => r.sampleId === s.id && sameRequest(r, record));
    const m = r && displayedMetrics(s, r, output);
    return m ? m.after[metric] - m.before[metric] : null;
  });
  const available = across.filter((v): v is number => v !== null);
  const raw = !!(sample.truth && sample.baselinePrediction && record?.prediction);
  const chart = (names: string[], series: { name: string; data: (number | null)[] }[]) => ({
    animation: false,
    tooltip: { trigger: 'axis', renderMode: 'richText' }, legend: { top: 0 }, grid: { top: 45, bottom: 45, left: 65, right: 25 },
    xAxis: { type: 'category', data: names }, yAxis: { type: 'value', scale: true },
    series: series.map(s => ({ ...s, type: 'line', smooth: false, connectNulls: false, symbolSize: 6,
      markLine: s.name.includes('change') ? { symbol: 'none', data: [{ yAxis: 0 }] } : undefined })),
  });
  return <div className="mx-auto max-w-[1400px] space-y-5 px-5 py-6" data-testid="evaluation-workspace">
    <div className="card flex flex-wrap items-end gap-4 p-5">
      <div className="mr-auto"><div className="eyebrow">Evaluation Results · {data.runStatus}</div><h3 className="mt-2 text-xl font-semibold">{data.model} · {data.dataset}</h3><p className="mt-1 text-[12px] text-ink-500">{data.nodes.length} graph nodes · {data.outputs.length} forecast outputs · {data.horizon} forecast steps</p></div>
      <label className="flex flex-col gap-1 text-[11px]">Sample<select aria-label="Evaluation sample" className={selectClass} value={sampleId} onChange={e => chooseSample(e.target.value)}>{data.samples.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-[11px]">Output<select aria-label="Evaluation output" className={selectClass} value={output} onChange={e => setOutput(Number(e.target.value))}><option value={-1}>All outputs (mean)</option>{data.outputs.map((v, i) => <option key={v} value={i} disabled={!raw}>{v}{!raw ? ' · raw arrays unavailable' : ''}</option>)}</select></label>
    </div>
    <div className="card p-4 text-[12px]"><b>Integration source: {data.sourceMode ?? 'results (producer did not declare execution route)'}</b><p className="mt-2">Adapter / plugin: {String(data.provenance.backendModule ?? data.provenance.plugin ?? 'Unavailable')} · Contract: {String(data.provenance.adapterContract ?? 'Function API / result schema')}</p><p className="mt-2">Capabilities: {data.capabilities ? Object.entries(data.capabilities).map(([k, v]) => `${k}: ${v}`).join(' · ') : 'Not declared in this imported file'}</p></div>
    {data.runStatus === 'partial' && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm">This run is incomplete. Only completed removals are displayed; missing results are not zero changes.</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-5"><h3 className="font-semibold">Graph and selected relation</h3><p className="mt-2 text-[12px] text-ink-500">{data.nodeMeaning}</p>
        {sample.contexts.length > 0 ? <><select aria-label="Evaluation context" className={`${selectClass} mt-3`} value={contextId} onChange={e => chooseContext(e.target.value)}>{sample.contexts.map(c => <option key={c.id} value={c.id}>{c.label} · {c.type}</option>)}</select>
          {context && context.edges.length <= 500 && <EvaluationGraph data={data} context={context} selected={selectedEdge} onSelect={e => { setEdge(e); setRecordId(data.records.find(r => r.sampleId === sampleId && r.contextIds.includes(context.id) && r.source === e.source && r.target === e.target)?.id ?? ''); }}/>}</> : <p className="my-8 text-sm text-ink-500">Graph unavailable. Stored performance results remain accessible.</p>}
        {context && context.edges.length > 500 && <p className="my-4 text-xs">Dense graph: diagram unavailable above 500 relations. Use the searchable relation table below; evidence retains the full graph.</p>}
        {selectedEdge && <p className="text-sm font-semibold">{label(selectedEdge.source)} → {label(selectedEdge.target)}</p>}
      </section>
      <section id="validation-workspace" className="card space-y-4 p-5"><h3 className="text-lg font-semibold">Forecast performance</h3>
        <label className="flex flex-col gap-2 text-[12px]">Stored removal<select aria-label="Evaluation removal" className={selectClass} value={recordId} onChange={e => { const r = data.records.find(r => r.id === e.target.value); if (r) selectRecord(r); else { setRecordId(''); setEdge(null); } }}><option value="">Choose a stored removal</option>{data.records.filter(r => r.sampleId === sampleId).map(r => <option key={r.id} value={r.id}>{r.source != null ? `${label(r.source)} → ${label(r.target!)}` : r.label} · {data.protocols.find(p => p.id === r.protocolId)?.label} · {r.contextIds.join(', ') || 'no graph context'}</option>)}</select></label>
        {!record && <p role="status" className="text-sm text-ink-500">No stored removal selected. Select a result; an edge without a computed result is unavailable.</p>}
        {record && !values && <p role="status">Per-output metrics unavailable. Choose All outputs to view stored aggregate metrics.</p>}
        {values && <div className="overflow-x-auto"><table className="w-full text-left text-[12px]"><thead><tr>{['Metric', 'Before', 'After', 'After − before', 'Improvement %', 'Change'].map(v => <th className="p-2" key={v}>{v}</th>)}</tr></thead><tbody>{(['mae', 'mse'] as const).map(k => { const c = metricChange(values.before[k], values.after[k]); return <tr key={k} className="border-t border-line"><th className="p-2 uppercase">{k}</th><td className="p-2">{fmt(values.before[k])}</td><td className="p-2">{fmt(values.after[k])}</td><td className="p-2">{fmt(c.delta)}</td><td className="p-2">{fmt(c.improvement)}</td><td className="p-2">{c.label}</td></tr>; })}</tbody></table></div>}
        <p className="text-[11px] text-ink-500">Current sample, all {data.horizon} forecast steps, {output < 0 ? 'all outputs' : data.outputs[output]}. {data.measurement.space}; {data.measurement.units}. Positive error change means worse performance.</p>
        {protocol && <div className="rounded-lg bg-[#f5f7fa] p-3 text-[12px]"><b>{protocol.label}</b><p className="mt-2">{protocol.description}</p><p className="mt-2">Injection contexts: {record?.contextIds.join(', ') || 'not supplied'}</p></div>}
        <p className="text-[11px] text-ink-400">No noticeable change: |after − before| ≤ 0.1% of baseline for each metric. This is a descriptive display threshold, not statistical significance. A zero baseline has no relative improvement percentage.</p>
      </section>
    </div>
    {context && <section className="card p-5"><h3 className="font-semibold">Relation table · {context.label}</h3><p className="mt-2 text-xs">Weights are optional; unavailable weights are never treated as zero. Only listed relations can be selected. Showing up to 200 matching relations.</p><input aria-label="Filter relations" placeholder="Source or target id / label" className={`${selectClass} mt-2`} value={relationFilter} onChange={e => setRelationFilter(e.target.value)}/><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>Source</th><th>Target</th><th>Weight</th><th>Stored result</th></tr></thead><tbody>{context.edges.filter(e => `${e.source} ${e.target} ${label(e.source)} ${label(e.target)}`.toLowerCase().includes(relationFilter.toLowerCase())).slice(0, 200).map(e => { const r = data.records.find(r => r.sampleId === sampleId && r.contextIds.includes(context.id) && r.source === e.source && r.target === e.target); return <tr key={JSON.stringify([e.source, e.target])} className="border-t border-line"><td className="p-2">{label(e.source)}</td><td>{label(e.target)}</td><td>{e.weight == null ? 'Unavailable' : fmt(e.weight)}</td><td>{r ? <button className="text-accent underline" onClick={() => selectRecord(r)}>View result</button> : 'Unavailable'}</td></tr>; })}</tbody></table></div></section>}
    <section className="card p-5"><h3 className="font-semibold">Available contexts and deletion scopes</h3><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-[12px]"><thead><tr>{['Removal', 'Contexts', 'Protocol', 'MAE change', 'MSE change'].map(v => <th className="p-2" key={v}>{v}</th>)}</tr></thead><tbody>{related.map(r => { const v = displayedMetrics(sample, r, output); return <tr key={r.id} className={`border-t border-line ${recordId === r.id ? 'bg-[#edf7f6]' : ''}`}><td className="p-2"><button className="text-accent underline" onClick={() => selectRecord(r)}>{r.source != null ? `${label(r.source)} → ${label(r.target!)}` : r.label}</button></td><td className="p-2">{r.contextIds.join(', ') || 'Unavailable'}</td><td className="p-2">{data.protocols.find(p => p.id === r.protocolId)?.label}</td><td className="p-2">{v ? fmt(v.after.mae - v.before.mae) : 'Unavailable'}</td><td className="p-2">{v ? fmt(v.after.mse - v.before.mse) : 'Unavailable'}</td></tr>; })}</tbody></table></div>{!related.length && <p className="mt-3 text-sm">No computed results for this selection.</p>}</section>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-5"><h3 className="font-semibold">Forecast comparison</h3>{raw ? <><p className="mt-2 text-[11px] text-ink-500">Output: {data.outputs[output < 0 ? 0 : output]}. Choose an output above to inspect its trajectory.</p><ReactECharts option={chart(Array.from({ length: data.horizon }, (_, i) => String(i + 1)), [
        { name: 'Truth', data: sample.truth!.map(r => r[output < 0 ? 0 : output]) },
        { name: 'Baseline', data: sample.baselinePrediction!.map(r => r[output < 0 ? 0 : output]) },
        { name: 'After removal', data: record!.prediction!.map(r => r[output < 0 ? 0 : output]) },
      ])} notMerge style={{ height: 300 }}/></> : <p className="mt-5 text-sm text-ink-500">Prediction curves unavailable: truth, baseline and removal arrays are required. Aggregate metrics are retained.</p>}</section>
      <section className="card p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Error change across samples</h3><select aria-label="Evaluation metric" className={selectClass} value={metric} onChange={e => setMetric(e.target.value as 'mae' | 'mse')}><option value="mae">MAE</option><option value="mse">MSE</option></select></div><p className="mt-2 text-[11px] text-ink-500">Same relation, protocol and exact context ids. {available.length}/{data.samples.length} samples available. Missing results remain gaps.</p>{available.length > 1 ? <ReactECharts option={chart(data.samples.map(s => s.id), [{ name: `${metric.toUpperCase()} change`, data: across }])} notMerge style={{ height: 300 }}/> : <p className="my-8 text-sm">Cross-sample profile unavailable: at least two matching sample results are required.</p>}<p className="text-[12px]">Mean change over available samples: {available.length > 1 ? fmt(available.reduce((a, b) => a + b, 0) / available.length) : 'Unavailable'}</p></section>
    </div>
    {raw && <section className="card p-5"><h3 className="font-semibold">Error change by forecast step · {metric.toUpperCase()}</h3><ReactECharts option={chart(Array.from({ length: data.horizon }, (_, i) => String(i + 1)), [{ name: `${metric.toUpperCase()} change`, data: sample.truth!.map((row, t) => {
      const ids = output < 0 ? row.map((_, i) => i) : [output];
      return ids.reduce((sum, i) => { const before = sample.baselinePrediction![t][i] - row[i], after = record!.prediction![t][i] - row[i]; return sum + (metric === 'mae' ? Math.abs(after) - Math.abs(before) : after * after - before * before); }, 0) / ids.length;
    }) }])} notMerge style={{ height: 300 }}/></section>}
    <details className="card p-5"><summary className="cursor-pointer font-semibold">Data checks, native verification and provenance</summary><p className="mt-3 text-sm">Result format validated. Stored metrics were recomputed wherever prediction and truth arrays were supplied. Model execution and native intervention correctness are separate checks; imported verification statements come from the result producer.</p>{(['identity', 'nativeIntervention'] as const).map(k => <p key={k} className="mt-3 text-sm"><b>{k}: {data.validation[k].status}</b> · {data.validation[k].detail}</p>)}<pre className="mt-4 max-h-72 overflow-auto rounded bg-paper p-3 text-[10px]">{JSON.stringify(data.provenance, null, 2)}</pre></details>
  </div>;
}

function EvaluationGraph({ data, context, selected, onSelect }: { data: EvaluationResults; context: EvaluationContext; selected: { source: string; target: string } | null; onSelect: (e: { source: string; target: string }) => void }) {
  const marker = useId().replace(/:/g, '');
  const pos = new Map(data.nodes.map((n, i) => { const a = 2 * Math.PI * i / Math.max(1, data.nodes.length) - Math.PI / 2; return [n.id, { x: 220 + 165 * Math.cos(a), y: 220 + 165 * Math.sin(a) }]; }));
  return <svg viewBox="0 0 440 440" role="img" aria-label="Imported directed graph" className="mx-auto max-h-[400px] w-full"><defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#16827f"/></marker></defs>{context.edges.map(e => {
    const a = pos.get(e.source)!, b = pos.get(e.target)!, dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const path = e.source === e.target ? `M${a.x},${a.y-8} C${a.x+45},${a.y-50} ${a.x+45},${a.y+35} ${a.x+8},${a.y}` : `M${a.x+dx/length*9},${a.y+dy/length*9} Q${(a.x+b.x)/2-dy*.12},${(a.y+b.y)/2+dx*.12} ${b.x-dx/length*11},${b.y-dy/length*11}`;
    return <g key={JSON.stringify([e.source, e.target])} role="button" tabIndex={0} aria-label={`Select edge ${e.source} to ${e.target}`} onClick={() => onSelect(e)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(e); } }} className="evaluation-graph-edge cursor-pointer"><title>{e.source} → {e.target}: {e.weight ?? 'unavailable'}</title><path d={path} fill="none" stroke="transparent" strokeWidth={6}/><path d={path} fill="none" stroke={selected?.source === e.source && selected?.target === e.target ? '#e07b25' : '#16827f'} strokeWidth={selected?.source === e.source && selected?.target === e.target ? 3 : 1.3} strokeDasharray={(e.weight ?? 0) < 0 ? '4 3' : undefined} markerEnd={data.capabilities?.directed === false ? undefined : `url(#${marker})`}/></g>;
  })}{data.nodes.map(n => { const p = pos.get(n.id)!; return <g key={n.id}><circle cx={p.x} cy={p.y} r={7} fill="#263b59"/><text x={p.x} y={p.y-14} textAnchor="middle" fontSize={11}>{n.label}</text></g>; })}</svg>;
}
