import { Section } from './layout/Section';

export function ResearchMotivation() {
  return <Section id="motivation" eyebrow="The problem" title="What does edge removal tell us?" intro="A learned edge weight alone does not tell you how removing the relation changes forecast error.">
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="card border-accent/40 p-5"><div className="eyebrow">Forecast accuracy</div><h3 className="mt-3 text-[18px] font-semibold">Does removal improve or degrade prediction?</h3><p className="mt-3 text-[12px] leading-relaxed text-ink-500">Compare baseline and edge-removed forecasts against ground truth. Mean MAE and MSE changes identify Improved, Degraded or Mixed outcomes; per-test counts show how often each direction occurs.</p></article>
      <article className="card border-accent/40 p-5"><div className="eyebrow">Sample-specific performance</div><h3 className="mt-3 text-[18px] font-semibold">How does the error change across samples?</h3><p className="mt-3 text-[12px] leading-relaxed text-ink-500">Compare MAE and MSE changes across available samples, output variables and forecast steps. Missing experiments remain unavailable.</p></article>
    </div>
    <p className="mt-4 rounded-xl border border-line bg-white px-5 py-4 text-[12px] leading-relaxed text-ink-500">Read MAE and MSE together. Average improvement alone does not show that every sample improves.</p>
  </Section>;
}
