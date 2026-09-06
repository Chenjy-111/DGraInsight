import type { AuditSessionV2, CaseEvidence } from '../../data/auditSessionV2';

export type ErrorMetric = 'mae' | 'mse';
export type PerformanceDirection = 'Improved' | 'Degraded' | 'Unchanged' | 'Unavailable';
export const DEFAULT_PERFORMANCE_POLICY = { relative: 0.001, absolute: 0 };
export type PerformancePolicy = typeof DEFAULT_PERFORMANCE_POLICY;
export function performancePolicy(session?: AuditSessionV2): PerformancePolicy {
  // Empirical display floor for this verified, standardized frozen dataset only.
  // It is neither a statistical test nor a bound for other models/runtimes.
  const calibrated = session?.model.adapter_id === 'msgnet'
    && session.session.session_id === 'msgnet_etth1_frozen14_graph_core'
    && session.checkpoint.sha256 === '78cf820042156a3e7d30e137ad944b9fb9a079b3d50be4893b49d1567bb6309d'
    && session.dataset.sha256 === 'f18de3ad269cef59bb07b5438d79bb3042d3be49bdeecf01c1cd6d29695ee066';
  return { ...DEFAULT_PERFORMANCE_POLICY, absolute: calibrated ? 0.00002 : 0 };
}
export function changeThreshold(baseline: unknown, policy = DEFAULT_PERFORMANCE_POLICY): number | null {
  return finiteNumber(baseline) && baseline >= 0 ? Math.max(policy.absolute, policy.relative * baseline) : null;
}
export function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function errorDelta(record: CaseEvidence | null, metric: ErrorMetric): number | null {
  if (!record || record.status !== 'active') return null;
  const metrics = record.response_metrics;
  const delta = metrics[`error_delta_${metric}`];
  if (finiteNumber(delta)) return delta;
  const before = metrics[`baseline_${metric}`], after = metrics[`intervention_${metric}`];
  return finiteNumber(before) && finiteNumber(after) ? after - before : null;
}

export function performanceDirection(delta: number | null, threshold: number | null = 0): PerformanceDirection {
  if (!finiteNumber(delta) || !finiteNumber(threshold) || threshold < 0) return 'Unavailable';
  return Math.abs(delta) <= threshold ? 'Unchanged' : delta < 0 ? 'Improved' : 'Degraded';
}

export function combinedPerformance(records: Array<CaseEvidence | null>, policy = DEFAULT_PERFORMANCE_POLICY): PerformanceDirection | 'Mixed' | 'Partial improvement' | 'Partial degradation' {
  const active = records.filter(record => record?.status === 'active');
  if (!active.length || records.some(record => record === null)) return 'Unavailable';
  const mae = summarizePerformance(active, 'mae', policy), mse = summarizePerformance(active, 'mse', policy);
  if (mae.missing || mse.missing || mae.direction === 'Unavailable' || mse.direction === 'Unavailable') return 'Unavailable';
  if (mae.direction === mse.direction) return mae.direction;
  if (mae.direction === 'Unchanged' || mse.direction === 'Unchanged') {
    return mae.direction === 'Improved' || mse.direction === 'Improved' ? 'Partial improvement' : 'Partial degradation';
  }
  return 'Mixed';
}

export function summarizePerformance(records: Array<CaseEvidence | null>, metric: ErrorMetric, policy = DEFAULT_PERFORMANCE_POLICY) {
  const deltas = records.map(record => errorDelta(record, metric)).filter(finiteNumber);
  // Relative change uses the same paired subset for both numerator and denominator.
  const paired = records.flatMap(record => {
    const delta = errorDelta(record, metric), baseline = record?.response_metrics[`baseline_${metric}`];
    return delta !== null && finiteNumber(baseline) && baseline >= 0 ? [{ delta, baseline }] : [];
  });
  const baselineSum = paired.reduce((sum, item) => sum + item.baseline, 0);
  const meanDelta = deltas.length ? deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length : null;
  const threshold = paired.length === deltas.length && paired.length ? changeThreshold(baselineSum / paired.length, policy) : null;
  const directions = paired.map(item => performanceDirection(item.delta, changeThreshold(item.baseline, policy)));
  return {
    total: records.length,
    available: deltas.length,
    inactive: records.filter(record => record?.status === 'inactive').length,
    missing: records.filter(record => record?.status !== 'inactive' && errorDelta(record, metric) === null).length,
    improved: directions.filter(direction => direction === 'Improved').length,
    degraded: directions.filter(direction => direction === 'Degraded').length,
    unchanged: directions.filter(direction => direction === 'Unchanged').length,
    unclassified: deltas.length - paired.length,
    threshold,
    direction: performanceDirection(meanDelta, threshold),
    meanDelta,
    reductionPercent: paired.length === deltas.length && baselineSum > 0 ? -100 * paired.reduce((sum, item) => sum + item.delta, 0) / baselineSum : null,
  };
}
