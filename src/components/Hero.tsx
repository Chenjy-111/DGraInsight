import { PlayCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { useDemoStore } from '@/store/useDemoStore';
import { useEvaluationStore } from '@/store/useEvaluationStore';

export function Hero() {
  const runGuidedExample = useWorkflowStore(s => s.runGuidedExample);
  const setDemo = useDemoStore(s => s.set);
  const imported = useEvaluationStore(s => s.source === 'imported');
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const loadGuidedExample = () => {
    if (imported) {
      scrollTo('discovery-workspace');
      return;
    }
    runGuidedExample();
    setDemo('sampleId', 0);
    setDemo('windowIdx', 0);
    setDemo('selectedEdge', { source: 0, target: 4 });
    setDemo('view', 'graph');
    setTimeout(() => scrollTo('discovery-workspace'), 0);
  };
  return <section id="top" className="border-b border-line bg-white">
    <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-20">
      <div><div className="eyebrow mb-3">Explore forecast performance under edge removal</div>
        <h1 className="font-serif text-[42px] font-semibold leading-none tracking-tight md:text-[56px]">DGra<span className="text-accent">Insight</span></h1>
        <p className="mt-5 max-w-2xl text-[20px] leading-snug text-ink-800">Remove a relation. Compare forecast performance and inspect cross-sample consistency.</p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Button variant="primary" icon={<PlayCircle size={15}/>} onClick={loadGuidedExample}>Start guided example</Button>
        </div>
      </div>
      <div className="card p-6"><div className="eyebrow">From graph relations to forecast errors</div><p className="mt-3 font-serif text-[25px] leading-snug text-[#263b59]">Does removing this relation improve or worsen the forecast?</p><p className="mt-3 font-serif text-[20px] leading-snug text-[#263b59]">Is this change consistent across forecasting origins?</p><div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold"><div className="rounded-lg bg-[#edf7f6] p-3 text-accent">Inspect relation</div><div className="rounded-lg bg-[#eef2f7] p-3 text-[#263b59]">Compare errors</div><div className="rounded-lg bg-[#f8f2e8] p-3 text-amber-800">Assess consistency</div></div></div>
    </div>
  </section>;
}
