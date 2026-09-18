import type { AuditSessionV2, CaseEvidence } from '@/data/auditSessionV2';
import { combinedPerformance, changeThreshold, errorDelta, finiteNumber, performanceDirection, performancePolicy, summarizePerformance, type ErrorMetric } from './forecastPerformanceLogic';

const tones = { Improved: 'bg-emerald-50 text-emerald-800', Degraded: 'bg-red-50 text-red-800', Unchanged: 'bg-slate-100 text-slate-700', Unavailable: 'bg-slate-100 text-slate-500' };

export function CombinedPerformanceBadge({ records, session, compact = false }: { records: Array<CaseEvidence | null>; session: AuditSessionV2; compact?: boolean }) {
  const result = combinedPerformance(records, performancePolicy(session));
  const presentation = {
    Improved: { label: '↑ Improved', tone: tones.Improved, note: 'Mean MAE and MSE both decrease beyond the display thresholds after edge removal.' },
    Degraded: { label: '↓ Degraded', tone: tones.Degraded, note: 'Mean MAE and MSE both increase beyond the display thresholds after edge removal.' },
    Mixed: { label: '↕ Mixed', tone: 'bg-violet-50 text-violet-800', note: 'Mean MAE and MSE change in opposite directions beyond their display thresholds after edge removal.' },
    Unchanged: { label: 'No noticeable change', tone: tones.Unchanged, note: 'Both mean error changes are within the display thresholds; this does not establish equivalence.' },
    'Partial improvement': { label: 'One metric improved', tone: tones.Improved, note: 'One metric improves beyond its threshold; the other shows no noticeable change.' },
    'Partial degradation': { label: 'One metric degraded', tone: tones.Degraded, note: 'One metric degrades beyond its threshold; the other shows no noticeable change.' },
    Unavailable: { label: 'Accuracy unavailable', tone: tones.Unavailable, note: 'No active cases, missing planned cases, or incomplete MAE/MSE metrics.' },
  }[result];
  return <span title={`${presentation.note} Based on active planned tests; independent of the formal evidence status.`} className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'} ${presentation.tone}`}>{presentation.label}</span>;
}
function number(value: unknown, signed = false): string {
  if (!finiteNumber(value)) return '—';
  const text = value !== 0 && Math.abs(value) < .001 ? value.toExponential(3) : value.toLocaleString('en-US', { maximumSignificantDigits: 5 });
  return `${signed && value > 0 ? '+' : ''}${text}`;
}

export function PerformanceBadge({ delta, threshold }: { delta: number | null; threshold: number | null }) {
  const direction = performanceDirection(delta, threshold);
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${tones[direction]}`}>{direction === 'Improved' ? '↑ ' : direction === 'Degraded' ? '↓ ' : ''}{direction === 'Unchanged' ? 'No noticeable change' : direction}</span>;
}

export function PerformanceCell({ record, metric, session }: { record: CaseEvidence | null; metric: ErrorMetric; session: AuditSessionV2 }) {
  if (record?.status === 'inactive') return <span className="text-ink-400">Not exposed</span>;
  const delta = errorDelta(record, metric);
  return <div className="space-y-1"><PerformanceBadge delta={delta} threshold={changeThreshold(record?.response_metrics[`baseline_${metric}`], performancePolicy(session))}/><div className="font-mono text-[11px]" title={delta === null ? undefined : String(delta)}>{number(delta, true)}</div></div>;
}

export function ForecastPerformance({ records, session, aggregate = false }: { records: Array<CaseEvidence | null>; session: AuditSessionV2; aggregate?: boolean }) {
  const policy = performancePolicy(session);
  return <section className="rounded-xl border border-line bg-white p-4" aria-label="Forecast accuracy after edge removal"><h4 className="text-[13px] font-semibold text-[#263b59]">Forecast accuracy after edge removal</h4><p className="mt-2 text-[11px] leading-relaxed text-ink-500">↑ Improved / ↓ Degraded require a change beyond the display threshold. No noticeable change = within threshold. Δ error = after − baseline; negative is better. MAE and MSE are evaluated independently.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{(['mae', 'mse'] as const).map(metric => {
    const summary = summarizePerformance(records, metric, policy), record = records[0];
    return <div key={metric} className="min-w-0 rounded-lg bg-[#f5f7fa] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-[12px]">{metric.toUpperCase()}{aggregate ? ' · mean' : ''}</b><PerformanceBadge delta={summary.meanDelta} threshold={summary.threshold}/></div><div className="mt-3 font-mono text-[15px] font-semibold" title={summary.meanDelta === null ? undefined : String(summary.meanDelta)}>Δ {number(summary.meanDelta, true)}</div>{!aggregate && record?.status === 'active' && <p className="mt-2 text-[11px] text-ink-500">Baseline {number(record.response_metrics[`baseline_${metric}`])} → After {number(record.response_metrics[`intervention_${metric}`])}</p>}<p className="mt-2 text-[11px] text-ink-500">Display threshold |Δ| ≤ {number(summary.threshold)}{aggregate ? " (mean baseline)" : ""}</p><p className="mt-2 text-[11px] text-ink-600">Error reduction: {summary.reductionPercent === null ? 'Unavailable' : `${number(summary.reductionPercent, true)}%`}</p>{aggregate && <><p className="mt-3 text-[11px] leading-relaxed">Improved {summary.improved} · Degraded {summary.degraded} · No noticeable change {summary.unchanged} · Unclassified {summary.unclassified}</p><p className="mt-1 text-[11px] text-ink-500">Evaluated {summary.available}/{summary.total} · Not exposed {summary.inactive} · Missing metrics {summary.missing}</p></>}</div>;
  })}</div><p className="mt-3 text-[11px] leading-relaxed text-ink-500">{aggregate ? 'Descriptive, equal-weight mean across available active planned tests for this candidate and scope. Inactive cases are excluded. ' : 'Descriptive accuracy change for this test. '}Threshold = 0.1% of the baseline error{policy.absolute > 0 ? `, with an absolute floor of ${policy.absolute} for this MSGNet checkpoint and dataset` : ""}. This is a descriptive display rule, not a significance test or proof of no effect. Original values are retained and averaged before classification. Uses the stored error metric coverage; the trajectory may show only one variable. Positive error reduction means improvement. Existing D, stability and p/q statistics describe prediction responses and do not test accuracy improvement.</p></section>;
}
