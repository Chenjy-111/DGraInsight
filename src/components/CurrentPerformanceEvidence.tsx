import { useEffect, useState } from 'react';
import { useDemoStore } from '@/store/useDemoStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { loadPerformance, type Data } from '@/data/performance';
import { PerformanceSummary, Unavailable } from './evidence/PerformanceSummary';

function usePerformance(model: string, enabled = true) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadPerformance(model).then(value => { if (live) setData(value); }).catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [model, enabled]);
  return { data, error };
}

export function DgraPerformanceEvidence() {
  const state = useDemoStore();
  const { data, error } = usePerformance('DGraFormer');
  const sampleId = state.sample?.provenance?.testSampleIndex;
  const context = state.sample?.windows[state.windowIdx]?.window_id;
  const sample = data?.samples.find(item => item.id === sampleId);
  const edges = sample?.contexts.find(item => item.index === context)?.edges ?? [];
  const edge = state.selectedEdge;
  const valid = !!edge && edges.some(item => item[0] === edge.source && item[1] === edge.target);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (state.loading || !data) return;
    if (edge && !valid) {
      state.set('selectedEdge', null);
      setNotice('The selected edge is inactive in this sample and window. Select an effective edge.');
    } else if (edge) {
      setNotice('');
      useWorkflowStore.getState().selectRelation({
        model: 'DGraFormer', dataset: state.dataset, sample: sampleId!, contextType: 'window', contextIndex: context!,
        source: edge.source, target: edge.target, sourceName: state.sample!.variables[edge.source], targetName: state.sample!.variables[edge.target],
      });
    }
  }, [state.loading, data, sampleId, context, edge, valid]);

  const identity = data && state.sample?.provenance?.checkpointSha256 === data.checkpoint
    && state.sample?.provenance?.dataSha256 === data.dataHash && state.dataset === data.dataset;
  return <section id="dgra-performance-evidence" className="mx-auto max-w-[1400px] space-y-5 px-5 pb-14">
    <div className="card p-5"><h3>Select an effective relation</h3><div className="mt-3 flex flex-wrap gap-2">
      {!state.loading && identity && edges.map(([source, target]) => <button className={`rounded border px-3 py-2 ${valid && edge?.source === source && edge.target === target ? 'bg-[#263b59] text-white' : ''}`} key={`${source}-${target}`} onClick={() => state.set('selectedEdge', { source, target })}>{state.sample?.variables[source]} → {state.sample?.variables[target]}</button>)}
    </div></div>
    {error ? <Unavailable text={error}/> : state.loading || !data ? <p>Loading performance data…</p> : !identity ? <Unavailable text="Model, checkpoint or dataset identity mismatch."/> : !valid ? <p role="status">{notice || 'Select an edge to view results.'}</p> : <PerformanceSummary data={data} sampleId={sampleId!} context={context!} source={edge.source} target={edge.target} relation={`${state.sample!.variables[edge.source]} → ${state.sample!.variables[edge.target]}`} onContext={index => state.set('windowIdx', state.sample!.windows.findIndex(window => window.window_id === index))}/>}
  </section>;
}

export function MsgnetPerformanceEvidence() {
  const selection = useWorkflowStore(state => state.selection);
  const select = useWorkflowStore(state => state.selectRelation);
  const selected = selection?.model === 'MSGNet' ? selection : null;
  const { data, error } = usePerformance('MSGNet', !!selected);
  if (!selected) return <section id="msgnet-performance-evidence" className="mx-auto max-w-[1400px] space-y-5 px-5 pb-14"><p>Select a directed relation (source → target) to load its performance results.</p></section>;
  if (error) return <Unavailable text={error}/>;
  if (!data) return <p>Loading MSGNet performance data…</p>;
  return <section id="msgnet-performance-evidence" className="mx-auto max-w-[1400px] space-y-5 px-5 pb-14"><PerformanceSummary data={data} sampleId={selected.sample} context={selected.contextIndex} source={selected.source} target={selected.target} relation={`G${selected.source} → G${selected.target}`} onContext={index => select({ ...selected, contextIndex: index })}/></section>;
}
