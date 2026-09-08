export const EVALUATION_VERSION = 'evaluation.v1';
export type MetricPair = { mae: number; mse: number };
export type EvaluationContext = { id: string; type: string; label: string; edges: { source: string; target: string; weight?: number }[] };
export type EvaluationSample = { id: string; contexts: EvaluationContext[]; baselineMetrics: MetricPair; truth?: number[][]; baselinePrediction?: number[][] };
export type EvaluationRecord = { id: string; sampleId: string; protocolId: string; contextIds: string[]; label: string; source?: string; target?: string; metrics: MetricPair; errorChange?: MetricPair; forecastStepErrorChange?: MetricPair[]; prediction?: number[][] };
export type EvaluationResults = {
  version: 'evaluation.v1'; model: string; dataset: string; horizon: number; outputs: string[];
  nodes: { id: string; label: string }[]; nodeMeaning: string;
  protocols: { id: string; label: string; description: string; scope: string }[];
  measurement: { space: string; units: string; aggregation: 'mean_all_steps_outputs' };
  sourceMode?: string; capabilities?: { [key: string]: boolean | string };
  provenance: { [key: string]: unknown };
  validation: { identity: Verification; nativeIntervention: Verification };
  runStatus: 'partial' | 'complete'; samples: EvaluationSample[]; records: EvaluationRecord[];
};
type Verification = { status: 'passed' | 'failed' | 'not_checked'; detail: string };
const object = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: any): v is string => typeof v === 'string' && v.trim().length > 0;
const num = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);
const pair = (v: any) => object(v) && ['mae', 'mse'].every(k => num(v[k]) && v[k] >= 0);
export function calculateMetrics(prediction: number[][], truth: number[][], output = -1): MetricPair {
  const errors = prediction.flatMap((row, t) => row.flatMap((p, i) => output < 0 || i === output ? [p - truth[t][i]] : []));
  return { mae: errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length, mse: errors.reduce((a, b) => a + b * b, 0) / errors.length };
}
export function validateEvaluation(input: unknown): { ok: true; value: EvaluationResults } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const unique = (items: any, name: string): Set<string> => {
    check(Array.isArray(items), `${name} must be an array`);
    check(items.every((x: any) => object(x) && text(x.id)), `${name} requires string ids`);
    const ids = new Set<string>(items.map((x: any) => x.id));
    check(ids.size === items.length, `${name} contains duplicate ids`);
    return ids;
  };
  try {
    const d = input as any;
    check(object(d) && d.version === EVALUATION_VERSION, `Expected ${EVALUATION_VERSION}`);
    ['model', 'dataset', 'nodeMeaning'].forEach(k => check(text(d[k]), `${k} is required`));
    check(Number.isInteger(d.horizon) && d.horizon > 0, 'horizon must be a positive integer');
    check(Array.isArray(d.outputs) && d.outputs.length && d.outputs.every(text) && new Set(d.outputs).size === d.outputs.length, 'outputs must be unique labels');
    const nodes = unique(d.nodes, 'nodes');
    check(d.nodes.every((x: any) => text(x.label)), 'Node labels are required');
    const protocols = unique(d.protocols, 'protocols');
    check(protocols.size > 0 && d.protocols.every((p: any) => ['label', 'description', 'scope'].every(k => text(p[k]))), 'Protocol label, description and scope are required');
    check(object(d.measurement) && d.measurement.aggregation === 'mean_all_steps_outputs' && text(d.measurement.space) && text(d.measurement.units), 'Declare metric space, units and mean_all_steps_outputs aggregation');
    check(object(d.provenance), 'provenance must be an object');
    check(['complete', 'partial'].includes(d.runStatus), 'runStatus must be complete or partial');
    for (const key of ['identity', 'nativeIntervention']) {
      const c = d.validation?.[key];
      check(object(c) && ['passed', 'failed', 'not_checked'].includes(c.status) && text(c.detail), `validation.${key} needs status and detail`);
    }
    unique(d.samples, 'samples');
    check(d.samples.length > 0, 'At least one sample is required');
    const samples = new Map<string, EvaluationSample>(d.samples.map((s: any) => [s.id, s]));
    const matrix = (m: any, name: string) => check(Array.isArray(m) && m.length === d.horizon && m.every((row: any) => Array.isArray(row) && row.length === d.outputs.length && row.every(num)), `${name}: expected ${d.horizon} × ${d.outputs.length} finite values`);
    const checkPrediction = (pred: any, truth: any, stored: MetricPair, name: string) => {
      if (pred != null) matrix(pred, name);
      if (pred != null && truth != null) {
        const calculated = calculateMetrics(pred, truth);
        check(['mae', 'mse'].every(k => { const key = k as keyof MetricPair; return Number.isFinite(calculated[key]) && Math.abs(calculated[key] - stored[key]) <= Math.max(1e-10, 1e-8 * Math.max(Math.abs(calculated[key]), Math.abs(stored[key]))); }), `${name}: stored metrics do not match raw arrays`);
      }
    };
    for (const s of d.samples) {
      check(pair(s.baselineMetrics), 'baselineMetrics requires finite nonnegative MAE/MSE');
      if (s.truth != null) matrix(s.truth, 'truth');
      checkPrediction(s.baselinePrediction, s.truth, s.baselineMetrics, 'baselinePrediction');
      unique(s.contexts, 'contexts');
      for (const c of s.contexts) {
        check(text(c.type) && text(c.label) && Array.isArray(c.edges), 'Context type, label and edges are required');
        const seen = new Set<string>();
        for (const e of c.edges) {
          check(object(e) && nodes.has(e.source) && nodes.has(e.target) && (e.weight === undefined || (num(e.weight) && e.weight !== 0)), 'Edge requires declared nodes; optional weight must be nonzero and finite');
          const key = JSON.stringify([e.source, e.target]);
          check(!seen.has(key), 'Duplicate directed edge'); seen.add(key);
        }
      }
    }
    unique(d.records, 'records');
    const requests = new Set<string>();
    for (const r of d.records) {
      check(samples.has(r.sampleId) && protocols.has(r.protocolId) && text(r.label), 'Record sample, protocol and label are required');
      const s = samples.get(r.sampleId)!;
      check(Array.isArray(r.contextIds) && r.contextIds.every(text) && new Set(r.contextIds).size === r.contextIds.length && r.contextIds.every((id: string) => s.contexts.some(c => c.id === id)), 'Record references invalid contexts');
      const hasEdge = 'source' in r || 'target' in r;
      if (hasEdge) {
        check(nodes.has(r.source) && nodes.has(r.target), 'Record edge references undeclared nodes');
        if (r.contextIds.length) check(s.contexts.some(c => r.contextIds.includes(c.id) && c.edges.some(e => e.source === r.source && e.target === r.target)), 'Removed edge absent from selected contexts');
      }
      const key = JSON.stringify([r.sampleId, r.protocolId, [...r.contextIds].sort(), r.source ?? null, r.target ?? null, hasEdge ? '' : r.label]);
      check(!requests.has(key), 'Duplicate intervention request'); requests.add(key);
      check(pair(r.metrics), 'Record metrics require finite nonnegative MAE/MSE');
      checkPrediction(r.prediction, s.truth, r.metrics, 'prediction');
      const close = (a: number, b: number) => num(a) && Math.abs(a-b) <= Math.max(1e-10, 1e-8 * Math.max(Math.abs(a), Math.abs(b)));
      if (r.errorChange != null) check(object(r.errorChange) && ['mae', 'mse'].every(k => close(r.errorChange[k], r.metrics[k] - s.baselineMetrics[k as keyof MetricPair])), 'Stored error change mismatch');
      if (r.forecastStepErrorChange != null) {
        check(r.prediction && s.truth && s.baselinePrediction && Array.isArray(r.forecastStepErrorChange) && r.forecastStepErrorChange.length === d.horizon, 'Step profile requires raw arrays and matching horizon');
        r.forecastStepErrorChange.forEach((v: any, t: number) => {
          const a = calculateMetrics([r.prediction[t]], [s.truth![t]]), b = calculateMetrics([s.baselinePrediction![t]], [s.truth![t]]);
          check(object(v) && ['mae', 'mse'].every(k => close(v[k], a[k as keyof MetricPair] - b[k as keyof MetricPair])), 'Stored step error profile mismatch');
        });
      }
    }
    return { ok: true, value: d as EvaluationResults };
  } catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
  return { ok: false, errors };
}

export function metricChange(before: number, after: number) {
  const delta = after - before;
  return { delta, improvement: before > 0 ? (before - after) / before * 100 : null,
    label: Math.abs(delta) <= Math.abs(before) * 0.001 ? 'No noticeable change' : delta < 0 ? 'Improved' : 'Degraded' };
}

export function displayedMetrics(sample: EvaluationSample, record: EvaluationRecord, output: number) {
  if (output >= 0) {
    if (!sample.truth || !sample.baselinePrediction || !record.prediction) return null;
    return { before: calculateMetrics(sample.baselinePrediction, sample.truth, output), after: calculateMetrics(record.prediction, sample.truth, output) };
  }
  return { before: sample.baselineMetrics, after: record.metrics };
}

export function rankedRemovals(sample: EvaluationSample, records: EvaluationRecord[], output: number, metric: keyof MetricPair) {
  const order: Record<string, number> = { Improved: 0, Degraded: 1, 'No noticeable change': 2 };
  return records.filter(r => r.sampleId === sample.id).map(record => {
    const values = displayedMetrics(sample, record, output);
    const change = values ? metricChange(values.before[metric], values.after[metric]) : null;
    return { record, values, change };
  }).sort((a, b) => (order[a.change?.label ?? ''] ?? 3) - (order[b.change?.label ?? ''] ?? 3)
    || Math.abs(b.change?.delta ?? 0) - Math.abs(a.change?.delta ?? 0)
    || a.record.id.localeCompare(b.record.id));
}
