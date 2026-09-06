import { MSGNET_GRAPH_NOTICE } from '@/data/graphSemantics';
import { useEffect, useState, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { getMsgnetEvidenceIndex, loadMsgnetCatalog, type MsgnetCatalog, type MsgnetSample } from '@/data/msgnetLoader';
import type { GraphEdge, SampleData } from '@/types/demo';
import { ForecastChart } from './ForecastChart';
import { Select } from './ui/Select';
import { Tabs } from './ui/Tabs';
import { Slider } from './ui/Slider';
import { MsgnetScaleGraph3D } from './three/MsgnetScaleGraph3D';
import { useWorkflowStore } from '@/store/useWorkflowStore';

function useMsgnet() {
  const [catalog, setCatalog] = useState<MsgnetCatalog | null>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => { loadMsgnetCatalog().then(setCatalog).catch((error: Error) => setFailure(error.message)); }, []);
  return { catalog, failure };
}

export function MsgnetDataWorkspace() {
  const selectRelation = useWorkflowStore(state => state.selectRelation);
  const clearSelection = useWorkflowStore(state => state.setModel);
  const { catalog, failure } = useMsgnet();
  const [sampleChoice, setSampleId] = useState(0);
  const [variable, setVariable] = useState(6);
  const [view, setView] = useState<'forecast' | 'graph'>('graph');
  const [scaleChoice, setScale] = useState(0);
  const [layout, setLayout] = useState<'heatmap' | '3d'>('3d');
  const immersive = view === 'graph' && layout === '3d';
  const selection = useWorkflowStore(state => state.selection);
  const selectedSampleIndex = selection?.model === 'MSGNet' ? catalog?.samples.findIndex(s => s.sample_index === selection.sample) ?? -1 : -1;
  const sampleId = selectedSampleIndex >= 0 ? selectedSampleIndex : sampleChoice;
  const scale = selection?.model === 'MSGNet' ? selection.contextIndex : scaleChoice;
  const selected = selection?.model === 'MSGNet' ? {source: selection.source, target: selection.target} : null;
  const [selectionNotice,setSelectionNotice] = useState('');
  useEffect(() => {
    if(selection?.model !== 'MSGNet' || !catalog) return;
    const index = catalog.samples.findIndex(s => s.sample_index === selection.sample);
    if(index < 0 || !catalog.samples[index].contexts[selection.contextIndex]?.adaptive[selection.source]?.[selection.target]) {clearSelection('MSGNet');setSelectionNotice('The selected edge is inactive. Select an effective edge.');return;}
    setSampleId(index);setScale(selection.contextIndex);setSelectionNotice('');
  }, [selection,catalog]);

  if (!catalog) return <div className={`flex min-h-[320px] items-center justify-center ${failure ? 'text-red-700' : 'text-ink-400'}`}>{failure || <><LoaderCircle className="mr-2 animate-spin" size={18}/>Loading MSGNet graph artifacts…</>}</div>;
  const sample = catalog.samples[sampleId];
  const context = sample.contexts[scale];
  const nodeLabels = catalog.graph_semantics.node_labels;
  const edges = matrixEdges(context.adaptive);
  const adapted = adaptSample(catalog, sample);
  const variableEvidence = getMsgnetEvidenceIndex(sample).variables[String(variable)];

  const changeScale = (value: number) => {
    setScale(value);
    if(selected && sample.contexts[value]?.adaptive[selected.source]?.[selected.target] > 0) pick(selected.source,selected.target,value);
    else if(selected) {clearSelection('MSGNet');setSelectionNotice('The selected edge is inactive at this scale. Select an effective edge.');}
  };
  const changeSample = (value:number) => {
    setSampleId(value);
    const next=catalog.samples[value];
    if(selected && next.contexts[scale]?.adaptive[selected.source]?.[selected.target] > 0) selectRelation({model:'MSGNet',dataset:'ETTh1',sample:next.sample_index,contextType:'scale',contextIndex:scale,...selected,sourceName:nodeLabels[selected.source],targetName:nodeLabels[selected.target]});
    else if(selected) {clearSelection('MSGNet');setSelectionNotice('The selected edge is inactive in this sample. Select an effective edge.');}
  };
  const pick = (source: number, target: number, selectedScale = scale) => {
    setScale(selectedScale);

    selectRelation({ model: 'MSGNet', dataset: 'ETTh1', sample: sample.sample_index, contextType: 'scale', contextIndex: selectedScale, source, target, sourceName: nodeLabels[source], targetName: nodeLabels[target] });
  };

  return <div className="border-b border-line bg-white"><div data-testid="msgnet-workspace" className={immersive ? "msgnet-immersive relative min-h-[920px] w-full overflow-hidden" : "mx-auto grid max-w-[1400px] gap-6 px-5 py-14 lg:grid-cols-[280px_1fr_320px]"}>
    <aside className={immersive ? "relative mx-5 my-5 lg:absolute lg:left-5 lg:top-20 lg:m-0 z-30 max-h-[760px] lg:w-[280px] space-y-5 overflow-y-auto rounded-xl bg-white/90 p-4 shadow-xl" : "space-y-5"}><Group label="Case"><div className="space-y-2.5"><Field label="Sample"><Select value={sampleId} onChange={changeSample} options={catalog.samples.map((item,value)=>({value,label:`sample ${item.sample_index}`}))} ariaLabel="MSGNet graph sample"/></Field><Field label="Dataset"><Select value="ETTh1" onChange={() => {}} options={[{ value: 'ETTh1', label: 'ETTh1 · 7 vars' }]} ariaLabel="MSGNet dataset"/></Field><Field label="Target variable"><Select value={variable} onChange={setVariable} options={catalog.variables.map((label, value) => ({ value, label }))} ariaLabel="MSGNet target variable"/></Field><Field label="Prediction horizon"><Tabs value={96} onChange={() => {}} options={[{ value: 96, label: '96' }]} size="sm"/></Field></div></Group><Group label="View"><Tabs value={view} onChange={setView} options={[{ value: 'forecast', label: 'Forecast' }, { value: 'graph', label: 'Dynamic graph' }]} size="sm" wrap/></Group>{view === 'graph' && <Group label="Graph"><Slider label="Scale index" value={scale} min={0} max={2} onChange={changeScale} format={value => `#${value}`}/><Field label="Layout"><Tabs value={layout} onChange={setLayout} options={[{ value: 'heatmap', label: 'Matrix' }, { value: '3d', label: '3D scales' }]} size="sm" wrap/></Field></Group>}{view === 'graph' && <div className="mt-4"><label className="text-xs">Effective relation<select aria-label="MSGNet relation" className="ml-3 rounded border p-2" value={selected ? `${selected.source}-${selected.target}` : ""} onChange={event=>{const [source,target]=event.target.value.split("-").map(Number);pick(source,target);}}><option value="" disabled>Select an edge</option>{edges.map(edge=><option key={`${edge.source}-${edge.target}`} value={`${edge.source}-${edge.target}`}>{nodeLabels[edge.source]} → {nodeLabels[edge.target]}</option>)}</select></label></div>}</aside>
    <main className={immersive ? "relative min-h-[920px] w-full" : "card min-h-[540px] p-5"}>{view === 'forecast' ? <div><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><h3 className="whitespace-nowrap text-[15px] font-semibold">Forecast · {catalog.variables[variable]} <span className="text-ink-400">(ETTh1)</span></h3><Select value={sampleId} onChange={changeSample} options={Object.keys(catalog.samples).map(Number).map(value => ({ value, label: `sample ${value}` }))} ariaLabel="MSGNet sample"/></div><span className="data-num whitespace-nowrap text-[12px] text-ink-400">MSE {sample.metrics.mse.toFixed(6)} · MAE {sample.metrics.mae.toFixed(6)}</span></div><ForecastChart sample={adapted} variable={variable} windowIdx={scale} showPatchBoundary={false}/><p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">The curve is a stored checkpoint output. Scale selection is independent of forecast residuals.</p></div> : <><div className={immersive ? "pointer-events-none absolute left-5 right-5 lg:left-[330px] lg:right-[370px] top-7 z-20 flex flex-wrap items-baseline justify-between gap-2" : "flex flex-wrap items-baseline justify-between gap-3"}><div><h3 className="text-[15px] font-semibold">Internal scale graph · scale_index {scale}</h3><p className="mt-1 text-[11px] font-semibold text-[#176e69]">Click an edge to inspect its evidence. Matrix rows = source; columns = target.</p></div><span className="data-num text-[12px] text-ink-400">current sample FFT period {context.period} · stored mixing weight {formatContribution(context.scale_contribution)}</span></div>{layout === 'heatmap' ? <Matrix matrix={context.adaptive} variables={nodeLabels} selected={selected} onPick={pick}/> : <MsgnetScaleGraph3D immersive={immersive} variables={nodeLabels} contexts={sample.contexts} graphs={sample.contexts.map(item => matrixEdges(item.adaptive))} activeScale={scale} selectedEdge={selected} onSelectScale={changeScale} onSelectEdge={(edge, selectedScale) => pick(edge.source, edge.target, selectedScale)}/>}{!immersive && <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">{MSGNET_GRAPH_NOTICE}</p>}</>}</main>
    <aside className={immersive ? "relative mx-5 my-5 lg:absolute lg:right-5 lg:top-20 lg:m-0 z-30 max-h-[760px] lg:w-[320px] space-y-4 overflow-y-auto rounded-xl bg-white/90 p-4 shadow-xl" : "space-y-4"}><div className="flex items-center justify-between"><span className="rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[10px] font-semibold text-accent">{view === 'forecast' ? 'Forecast artifact' : 'Scale graph artifact'}</span><span className="data-num text-[10px] text-ink-400">sample {sampleId} · scale_index {scale}</span></div><Info label="Stored variable metrics"><EvidenceGrid items={[["Variable", catalog.variables[variable]], ["MSE", variableEvidence.mse.toFixed(6)], ["MAE", variableEvidence.mae.toFixed(6)]]}/></Info><Info label="Stored scale fields"><EvidenceGrid items={[["Scale identity", String(scale)], ["Current FFT period", String(context.period)], ["FFT strength", context.fft_strength.toFixed(6)], ["Mixing weight", formatContribution(context.scale_contribution)]]}/></Info>{selected ? <Info label="Selected graph relation"><div className="text-[13px] font-semibold">{nodeLabels[selected.source]} → {nodeLabels[selected.target]}</div><p className="mt-2 font-mono text-[10px]">weight {context.adaptive[selected.source][selected.target].toFixed(6)}</p><p className="mt-2 text-[9px] text-ink-400">See Summary below for this relation.</p></Info> : <Info label="Selection">{selectionNotice || "Select an effective non-self relation."}</Info>}<Info label="Data provenance" mono>checkpoint {catalog.checkpoint_sha256.slice(0, 16)}…</Info><Info label="Caveat">Forecast variables and internal graph nodes are different axes. A graph node must not be interpreted as a specific sensor.</Info></aside>
  </div></div>;
}

function Group({ label, children }: { label: string; children: ReactNode }) { return <div><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>{children}</div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div><div className="mb-1 text-[12px] text-ink-400">{label}</div>{children}</div>; }
function Info({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) { return <div className="rounded-card border border-line bg-white p-3"><div className="eyebrow mb-1">{label}</div><div className={`text-[12.5px] leading-relaxed text-ink-700 ${mono ? 'font-mono' : ''}`}>{children}</div></div>; }
function EvidenceGrid({ items }: { items: [string, string][] }) { return <div className="grid grid-cols-2 gap-2">{items.map(([label, value]) => <div key={label} className="rounded-md bg-[#f5f7fa] px-2 py-2"><div className="text-[8px] uppercase tracking-wide text-ink-400">{label}</div><div className="mt-1 break-all font-mono text-[10px] font-semibold text-ink-700">{value}</div></div>)}</div>; }
function formatContribution(value: number | number[]) { return Array.isArray(value) ? value.map(item => item.toFixed(4)).join(' · ') : value.toFixed(4); }
function adaptSample(catalog: MsgnetCatalog, sample: MsgnetSample): SampleData { return { dataset: 'ETTh1', sample_id: sample.sample_index, horizon: 96, variables: catalog.variables, targetDefault: 6, history: sample.history, ground_truth: sample.ground_truth, prediction: sample.prediction, error: sample.prediction.map((series, variable) => series.map((value, index) => Math.abs(value - sample.ground_truth[variable][index]))), windows: [], windowSize: 0, patchLen: 0, attention: {} as SampleData['attention'], metrics: sample.metrics, narrative: catalog.notice }; }
function Matrix({ matrix, variables, selected, onPick }: { matrix: number[][]; variables: string[]; selected: { source: number; target: number } | null; onPick: (source: number, target: number) => void }) { const max = Math.max(...matrix.flat(), .001); return <div className="mx-auto mt-8 grid max-w-[560px] gap-1" style={{ gridTemplateColumns: `58px repeat(${variables.length},1fr)` }}><span/>{variables.map(value => <span className="text-center text-[9px] text-ink-400" key={value}>{value}</span>)}{matrix.map((row, source) => <div className="contents" key={source}><span className="flex items-center text-[9px] text-ink-400">{variables[source]}</span>{row.map((value, target) => <button key={target} disabled={source === target || value <= 0} onClick={() => onPick(source, target)} title={`${variables[source]} → ${variables[target]}: ${value.toFixed(4)}`} className={`aspect-square cursor-pointer rounded border transition hover:ring-2 hover:ring-[#16827f]/50 disabled:cursor-default ${selected?.source === source && selected.target === target ? 'border-red-500 ring-2 ring-red-200' : 'border-white'}`} style={{ background: source === target ? '#e8edf0' : `rgba(22,130,127,${.08 + .82 * value / max})` }}/>)}</div>)}</div>; }
function matrixEdges(matrix: number[][]): GraphEdge[] { return matrix.flatMap((row, source) => row.map((weight, target) => ({ source, target, weight, rank: 0, kept: source !== target && weight > 0 }))).filter(edge => edge.source !== edge.target && edge.weight > 0).sort((a, b) => b.weight - a.weight).map((edge, index) => ({ ...edge, rank: index + 1 })); }
