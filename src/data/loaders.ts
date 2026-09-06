import type { DatasetId, Horizon, SampleData } from '@/types/demo';
import { loadPerformance } from './performance';

const cache = new Map<string, SampleData>();

function key(d: DatasetId, s: number, h: Horizon) {
  return `${d}_${String(s).padStart(3, '0')}_h${h}`;
}

/**
 * Loads a precomputed sample artifact from public/data/samples/.
 * Each JSON file must conform to the SampleData schema and be exported
 * via scripts/export_demo_data.py from real DGraFormer inference runs.
 */
export async function loadSample(dataset: DatasetId, sampleId: number, horizon: Horizon): Promise<SampleData> {
  const k = key(dataset, sampleId, horizon);
  const cached = cache.get(k);
  if (cached) return cached;

  const base = import.meta.env.BASE_URL ?? '/';
  const res = await fetch(`${base}data/samples/${k}.json`);
  if (!res.ok) {
    throw new Error(
      `Sample data not found: ${k}.json. Run scripts/export_demo_data.py to export real DGraFormer inference artifacts.`
    );
  }
  const json = (await res.json()) as SampleData;
  if (dataset === 'ETTh1') {
    const performance = await loadPerformance('DGraFormer');
    const actual = performance.samples.find(s => s.id === json.provenance?.testSampleIndex);
    if (!actual || json.provenance?.checkpointSha256 !== performance.checkpoint || json.provenance?.dataSha256 !== performance.dataHash || json.provenance?.currentEpochEquivalent !== 5) throw new Error('Graph and performance identities or parameters do not match');
    for (const window of json.windows) {
      const context = actual.contexts.find(c => c.index === window.window_id);
      if (!context) continue;
      if (context.edges.length !== window.kept_edges.length || context.edges.some(([s,t,v]) => !window.kept_edges.some(e => e.source === s && e.target === t) || Math.abs(window.sparse_graph[s][t]-v) > 1e-6)) throw new Error('Graph direction or effective edges do not match the performance run');
    }
  }
  cache.set(k, json);
  return json;
}
