import { useEffect } from 'react';
import { GitBranch, LockKeyhole, Waves } from 'lucide-react';
import { Hero } from './components/Hero';
import { ResearchMotivation } from './components/ResearchMotivation';
import { MethodExplainer } from './components/MethodExplainer';
import { SystemOverview } from './components/SystemOverview';
import { SystemArchitecture } from './components/SystemArchitecture';
import { Limitations } from './components/Limitations';
import { CitationSection } from './components/CitationSection';
import { VisualizationCanvas } from './components/VisualizationCanvas';
import { ControlStudio } from './components/ControlStudio';
import { MsgnetDataWorkspace } from './components/MsgnetWorkspace';
import { WorkflowBar } from './components/WorkflowChrome';
import { AuditSessionImport } from './components/AuditSessionImport';
import { ImportedSessionV2Workspace } from './components/ImportedSessionV2Workspace';
import { DgraSessionV2Evidence, MsgnetSessionV2Evidence } from './components/SessionV2Evidence';
import { useDemoStore } from './store/useDemoStore';
import { useWorkflowStore, type WorkflowModel } from './store/useWorkflowStore';
import { useAuditSessionStore } from './store/useAuditSessionStore';
import { EvaluationWorkspace } from './components/EvaluationWorkspace';

export default function App() {
  const model = useWorkflowStore(state => state.model);
  const setModel = useWorkflowStore(state => state.setModel);
  const pending = useWorkflowStore(state => state.pendingIntervention);
  const load = useDemoStore(state => state.loadCurrent);
  const immersive = useDemoStore(state => state.view === 'graph' && state.graphLayout === '3d-timeline');
  const setDemo = useDemoStore(state => state.set);
  const source = useAuditSessionStore(state => state.source);
  const sessionV2 = useAuditSessionStore(state => state.sessionV2);
  const evaluation = useAuditSessionStore(state => state.evaluation);
  const generation = useAuditSessionStore(state => state.generation);
  const importedV2 = source === 'imported' && sessionV2 !== null;
  const imported = importedV2 || evaluation !== null;

  useEffect(() => { void load(); }, [load]);

  return <div className="min-h-screen bg-paper">
    <Hero/>
    <AuditSessionImport/>
    <ResearchMotivation/>
    <MethodExplainer/>
    <SystemOverview/>
    {!evaluation && <WorkflowBar/>}
    <section id="discovery-workspace" className="border-b border-line bg-white">
      <WorkspaceHeader number="01" title="Edge-Removal Evaluation" text="Select a stored relation and compare forecast errors before and after removal."/>
      {imported ? <ImportedModelLock model={evaluation?.model ?? sessionV2!.model.name as string} context={evaluation ? 'declared' : sessionV2!.model.native_context_type as string}/> : <ModelSwitch value={model} onChange={next => {
        if (next === model) return;
        if (next === 'DGraFormer') { setDemo('view', 'graph'); setDemo('graphLayout', '3d-timeline'); }
        setModel(next);
      }}/>}
      {evaluation ? <EvaluationWorkspace key={generation} data={evaluation}/> : importedV2
        ? <ImportedSessionV2Workspace key={String((sessionV2.session as any).session_id)} session={sessionV2}/>
        : model === 'DGraFormer'
          ? <>
              <div className={immersive ? 'relative min-h-[920px] w-full overflow-hidden' : 'relative grid min-h-[920px] w-full gap-6 px-5 py-10 lg:grid-cols-[280px_minmax(0,1fr)]'}>
                <div className={immersive ? 'absolute left-5 top-20 z-30 max-h-[760px] w-[280px] overflow-y-auto rounded-xl bg-white/90 p-4 shadow-xl' : ''}><ControlStudio/></div>
                <VisualizationCanvas/>

              </div>
              <DgraSessionV2Evidence/>
            </>
          : <><MsgnetDataWorkspace/><MsgnetSessionV2Evidence/></>}
    </section>
    <SystemArchitecture/>
    <Limitations/>
    <CitationSection/>
    <footer className="border-t border-line bg-white px-5 py-8 text-center text-[12px] text-ink-400">DGraInsight · Offline edge-removal evaluation and forecast performance exploration</footer>
  </div>;
}

function WorkspaceHeader({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="mx-auto max-w-[1400px] px-5 pt-12"><div className="eyebrow">Workspace {number}</div><h2 className="mt-2 font-serif text-[30px] font-semibold">{title}</h2><p className="mt-2 text-[12px] text-ink-400">{text}</p></div>;
}

function ModelSwitch({ value, onChange }: { value: WorkflowModel; onChange: (value: WorkflowModel) => void }) {
  return <div className="mx-auto flex max-w-[1400px] gap-2 px-5 py-5"><button onClick={() => onChange('DGraFormer')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-semibold ${value === 'DGraFormer' ? 'bg-[#263b59] text-white' : 'border border-line bg-white'}`}><GitBranch size={14}/>DGraFormer · window graph</button><button onClick={() => onChange('MSGNet')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-semibold ${value === 'MSGNet' ? 'bg-[#263b59] text-white' : 'border border-line bg-white'}`}><Waves size={14}/>MSGNet · scale graph</button></div>;
}

function ImportedModelLock({ model, context }: { model: string; context: string }) {
  return <div className="mx-auto flex max-w-[1400px] px-5 py-5"><div className="inline-flex items-center gap-2 rounded-lg border border-[#16827f]/30 bg-[#edf7f6] px-4 py-2 text-[11px] font-semibold text-[#176e69]"><LockKeyhole size={13}/>{model} · {context} graph · fixed by imported session</div></div>;
}
