import { Section } from './layout/Section';
const steps = [
  ['Select and remove', 'Choose a learned relation and replay its removal in the specified graph context, using the same checkpoint and input.'],
  ['Assess forecast accuracy', 'Compare baseline and removal errors against ground truth. Read MAE and MSE together, then inspect mean changes and per-test improvement or degradation.'],
  ['Assess response stability', 'Across audited samples, compare the response with controls using D. Inspect consistency and sensitivity, then read the p/q-based support status alongside accuracy.'],
];
export function MethodExplainer() {
  return <Section id="contributions" eyebrow="Method" title="Edge removal reveals accuracy and stability"><div className="grid gap-4 md:grid-cols-3">{steps.map(([title, body], index) => <article className="card p-5" key={title}><div className="font-mono text-[10px] text-accent">0{index + 1}</div><h3 className="mt-2 text-[18px] font-semibold">{title}</h3><p className="mt-3 text-[12px] leading-relaxed text-ink-500">{body}</p></article>)}</div></Section>;
}
