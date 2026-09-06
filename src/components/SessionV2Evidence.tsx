import { useEffect, useState } from 'react';
import type { AuditSessionV2 } from '@/data/auditSessionV2';
import { useDemoStore } from '@/store/useDemoStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { loadPerformance, type Data } from '@/data/performance';
import { PerformanceSummary, Unavailable } from './evidence/PerformanceSummary';
function usePerformance(model: string) { const [data, setData] = useState<Data | null>(null), [error, setError] = useState(''); useEffect(() => { let live = true; loadPerformance(model).then(d => { if (live)
    setData(d); }).catch(e => { if (live)
    setError(String(e)); }); return () => { live = false; }; }, [model]); return { data, error }; }
export function DgraSessionV2Evidence({ supplied }: {
    supplied?: AuditSessionV2 | null;
}) {
    const s = useDemoStore(), { data, error } = usePerformance('DGraFormer');
    const sampleId = s.sample?.provenance?.testSampleIndex, context = s.sample?.windows[s.windowIdx]?.window_id;
    const sample = data?.samples.find(x => x.id === sampleId), edges = sample?.contexts.find(c => c.index === context)?.edges ?? [], edge = s.selectedEdge;
    const valid = !!edge && edges.some(e => e[0] === edge.source && e[1] === edge.target);
    const [notice, setNotice] = useState('');
    useEffect(() => { if (s.loading || !data)
        return; if (edge && !valid) {
        s.set('selectedEdge', null);
        setNotice('The selected edge is inactive in this sample and window. Select an effective edge.');
    }
    else if (edge) {
        setNotice('');
        useWorkflowStore.getState().selectRelation({model:'DGraFormer',dataset:s.dataset,sample:sampleId!,contextType:'window',contextIndex:context!,source:edge.source,target:edge.target,sourceName:s.sample!.variables[edge.source],targetName:s.sample!.variables[edge.target]});
    } }, [s.loading, data, sampleId, context, edge, valid]);
    if (supplied)
        return <Unavailable text="This import uses an older format. Generate independent performance.v1 results."/>;
    const identity = data && s.sample?.provenance?.checkpointSha256 === data.checkpoint && s.sample?.provenance?.dataSha256 === data.dataHash && s.dataset === data.dataset;
    return <section id="dgra-session-v2-evidence" className="mx-auto max-w-[1400px] space-y-5 px-5 pb-14"><div className="card p-5"><h3>Select an effective relation</h3><div className="mt-3 flex flex-wrap gap-2">{!s.loading && identity && edges.map(([source, target]) => <button className={`rounded border px-3 py-2 ${valid && edge?.source === source && edge.target === target ? 'bg-[#263b59] text-white' : ''}`} key={`${source}-${target}`} onClick={() => s.set('selectedEdge', { source, target })}>{s.sample?.variables[source]} → {s.sample?.variables[target]}</button>)}</div></div>{error ? <Unavailable text={error}/> : s.loading || !data ? <p>Loading performance data…</p> : !identity ? <Unavailable text="Model, checkpoint or dataset identity mismatch."/> : !valid ? <p role="status">{notice || 'Select an edge to view results.'}</p> : <PerformanceSummary data={data} sampleId={sampleId!} context={context!} source={edge.source} target={edge.target} relation={`${s.sample!.variables[edge.source]} → ${s.sample!.variables[edge.target]}`} onContext={i => s.set('windowIdx', s.sample!.windows.findIndex(w => w.window_id === i))}/>}</section>;
}
export function MsgnetSessionV2Evidence({ supplied }: {
    supplied?: AuditSessionV2 | null;
}) {
    const selection = useWorkflowStore(s => s.selection), select = useWorkflowStore(s => s.selectRelation), { data, error } = usePerformance('MSGNet');
    if (supplied)
        return <Unavailable text="This legacy import has no independent performance results. Regenerate the results."/>;
    if (error)
        return <Unavailable text={error}/>;
    if (!data)
        return <p>Loading MSGNet performance data…</p>;
    const s = selection?.model === 'MSGNet' ? selection : null;
    return <section id="msgnet-session-v2-evidence" className="mx-auto max-w-[1400px] space-y-5 px-5 pb-14">{!s ? <p>Select an effective edge to view results.</p> : <PerformanceSummary data={data} sampleId={s.sample} context={s.contextIndex} source={s.source} target={s.target} relation={`G${s.source} → G${s.target}`} onContext={i => select({ ...s, contextIndex: i })}/>}</section>;
}
