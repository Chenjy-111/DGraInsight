import { Section } from './layout/Section';
export function Limitations() {
  return <Section id="limitations" eyebrow="Interpretation" title="Read accuracy and stability within the audit scope"><div className="card space-y-3 p-5 text-[12px] leading-relaxed text-ink-500">
    <p>Results apply to the named checkpoint, audited samples, graph context, relation and removal protocol.</p>
    <p><b className="text-ink-700">Forecast accuracy:</b> Improved, Degraded and Mixed describe mean MAE/MSE changes across available active tests. They do not establish a statistically significant accuracy gain or a benefit on every sample.</p>
    <p><b className="text-ink-700">Response stability:</b> Per-test D and its positive fraction describe consistency relative to controls. Supported tests a positive mean D after multiple-testing correction; it does not guarantee uniform responses. A single-case Quick Inspection cannot establish stability across samples.</p>
    <p className="font-semibold text-ink-700">These results describe model behavior under edge removal, not causal relationships between real-world variables.</p>
  </div></Section>;
}
