import { useRef } from 'react';
import { Database, FileJson, LoaderCircle, RotateCcw, Upload, X } from 'lucide-react';
import { useEvaluationStore } from '@/store/useEvaluationStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { useDemoStore } from '@/store/useDemoStore';

export function EvaluationImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const model = useWorkflowStore(state => state.model);
  const setModel = useWorkflowStore(state => state.setModel);
  const runGuidedExample = useWorkflowStore(state => state.runGuidedExample);
  const setDemo = useDemoStore(state => state.set);
  const setCase = useDemoStore(state => state.setCase);
  const source = useEvaluationStore(state => state.source);
  const evaluation = useEvaluationStore(state => state.evaluation);
  const fileName = useEvaluationStore(state => state.fileName);
  const previousModel = useEvaluationStore(state => state.previousModel);
  const importState = useEvaluationStore(state => state.importState);
  const errors = useEvaluationStore(state => state.errors);
  const importFile = useEvaluationStore(state => state.importFile);
  const closeImport = useEvaluationStore(state => state.closeImport);
  const clearError = useEvaluationStore(state => state.clearError);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    const imported = await importFile(file, model);
    if (imported) {
      setModel(imported.model);
      setTimeout(() => document.getElementById('discovery-workspace')?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
    if (inputRef.current) inputRef.current.value = '';
  };
  const loadExistingExample = () => {
    if (source === 'imported') closeImport();
    runGuidedExample();
    setCase({ dataset: 'ETTh1', sampleId: 0, horizon: 96 });
    setDemo('windowIdx', 0);
    setDemo('selectedEdge', { source: 0, target: 4 });
    setDemo('view', 'graph');
    setTimeout(() => document.getElementById('discovery-workspace')?.scrollIntoView({ behavior: 'smooth' }), 0);
  };
  const restoreDemo = () => {
    const restoreModel = previousModel ?? 'DGraFormer';
    closeImport();
    setModel(restoreModel);
  };
  const busy = importState === 'reading' || importState === 'validating';

  return <section id="evaluation-source" className="border-b border-line bg-[#f5f7fa]">
    <div className="mx-auto max-w-[1400px] px-5 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><div className="eyebrow">Data source</div><h2 className="mt-1 font-serif text-[30px] font-semibold">Choose a data source</h2></div>
        <div className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-600">
          {source === 'imported' ? 'Imported Evaluation Results' : 'Built-in Demo'}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className={`rounded-xl border p-5 ${source === 'built_in' ? 'border-accent/40 bg-white shadow-card' : 'border-line bg-white/60'}`}>
          <div className="flex items-center gap-2 text-[#263b59]"><Database size={19}/><h3 className="text-[18px] font-semibold">Explore built-in results</h3></div>
          <p className="mt-3 text-[14px] leading-7 text-ink-500">Explore stored relation-removal results.</p>
          <button disabled={busy} onClick={loadExistingExample} className="mt-4 mr-3 rounded-lg bg-[#263b59] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">Load existing example</button>
          {source === 'imported' && <button onClick={restoreDemo} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#263b59] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#263b59]"><RotateCcw size={15}/>Return to Built-in Demo</button>}
        </article>
        <article className={`rounded-xl border p-5 ${source === 'imported' ? 'border-[#16827f] bg-[#edf7f6]' : 'border-line bg-white'}`}>
          <div className="flex items-center gap-2 text-[#176e69]"><FileJson size={19}/><h3 className="text-[18px] font-semibold">Import evaluation results</h3></div>
          <p className="mt-3 text-[14px] leading-7 text-ink-500">Run relation-removal evaluation locally, then import the generated result into this website.</p>
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={event => void chooseFile(event.target.files?.[0])}/>
          <button disabled={busy} onClick={() => inputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#263b59] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">
            {busy ? <LoaderCircle size={14} className="animate-spin"/> : <Upload size={14}/>}
            {busy ? (importState === 'reading' ? 'Reading file…' : 'Validating results…') : 'Choose Evaluation Results'}
          </button>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-400">Select <span className="font-mono">runs/&lt;timestamp&gt;/manifest.json</span> generated by DGraInsight Offline Evaluator.</p>
        </article>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="eyebrow">Run a new evaluation</div><h3 className="mt-1 text-[20px] font-semibold text-[#263b59]">Evaluate your model locally</h3><p className="mt-2 text-[14px] leading-7 text-ink-500">Download and extract DGraInsight Offline Evaluator, then double-click <span className="font-mono">Start-Evaluation.cmd</span>.</p></div><div className="flex flex-wrap gap-2"><a className="rounded-lg bg-[#263b59] px-4 py-2.5 text-[13px] font-semibold text-white" href="https://github.com/Chenjy-111/DGraInsight/releases/latest/download/DGraInsight-Offline-Evaluator.zip">Download Offline Evaluator</a><a className="rounded-lg border border-[#263b59] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#263b59]" href="https://github.com/Chenjy-111/DGraInsight/tree/main/offline_app">Evaluation Guide</a></div></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <EvaluationStep number="1" title="Select a model">Choose DGraFormer, MSGNet, MTGNN or <b>Connect another model</b> with a Thin Adapter.</EvaluationStep>
          <EvaluationStep number="2" title="Provide local resources">Select your model source, dataset, checkpoint, forecasting origins and relations.</EvaluationStep>
          <EvaluationStep number="3" title="Run and import">Run the evaluation, then import <span className="font-mono">runs/&lt;timestamp&gt;/manifest.json</span> above.</EvaluationStep>
        </div>
      </div>

      {evaluation && <div className="mt-4 rounded-lg border border-line bg-white p-4"><b className="text-sm">Result format validated</b><p className="mt-2 text-[12px]">{fileName} · {evaluation.model} · {evaluation.dataset} · {evaluation.horizon} forecast steps · {evaluation.outputs.length} outputs</p><p className="mt-2 text-[11px] text-ink-500">Native intervention verification is reported separately in the workspace.</p><button onClick={restoreDemo} className="mt-3 text-sm text-accent">Return to Built-in Demo</button></div>}
      {errors.length > 0 && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-[13px] font-semibold">Invalid or incompatible result file</h3><p className="mt-1 text-[10px] text-red-700">The active data source was not changed.</p></div><button onClick={clearError} aria-label="Dismiss import errors"><X size={15}/></button></div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[10px] leading-relaxed">{errors.slice(0, 8).map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>
        {errors.length > 8 && <p className="mt-2 text-[9px] text-red-700">{errors.length - 8} additional validation errors were suppressed.</p>}
      </div>}
    </div>
  </section>;
}

function EvaluationStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <article className="rounded-xl border border-line bg-[#fafbfd] p-5"><div className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#263b59] text-[12px] font-semibold text-white">{number}</span><h3 className="text-[16px] font-semibold text-[#263b59]">{title}</h3></div><div className="mt-3 text-[14px] leading-7 text-ink-500">{children}</div></article>;
}
