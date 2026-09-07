import { Section } from './layout/Section';
const steps = [
  ['Select and remove', 'Choose a learned relation and replay its removal in the specified graph context, using the same checkpoint and input.'],
  ['Assess forecast accuracy', 'Compare baseline and removal errors against ground truth. Read MAE and MSE together, then inspect mean changes and per-test improvement or degradation.'],
  ['Explore the changes', 'Inspect forecast errors by sample, output and forecast step. Compare only the deletion scopes actually available for the model.'],
];
export function MethodExplainer() {
  return <Section id="contributions" eyebrow="Method" title="From edge removal to forecast error changes"><div className="grid gap-4 md:grid-cols-3">{steps.map(([title, body], index) => <article className="card p-5" key={title}><div className="font-mono text-[10px] text-accent">0{index + 1}</div><h3 className="mt-2 text-[18px] font-semibold">{title}</h3><p className="mt-3 text-[12px] leading-relaxed text-ink-500">{body}</p></article>)}</div></Section>;
}
