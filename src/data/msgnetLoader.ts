import { MSGNET_SEMANTICS_VERSION } from './graphSemantics';
import { loadPerformance } from './performance';

export interface MsgnetContext {
  scale_index: number;
  period: number;
  fft_strength: number;
  scale_contribution: number;
  adaptive: number[][];
  effective: number[][];
}

export interface MsgnetSample {
  sample_index: number;
  history: number[][];
  ground_truth: number[][];
  prediction: number[][];
  metrics: { mse: number; mae: number };
  contexts: MsgnetContext[];
}

export interface MsgnetVariableEvidence {
  mse: number;
  mae: number;
  truth: number[];
  prediction: number[];
  absolute_error: number[];
}

export interface MsgnetEvidenceIndex {
  variables: Record<string, MsgnetVariableEvidence>;
}

export interface MsgnetCatalog {
  graph_semantics: { version: string; node_kind: string; node_labels: string[]; tensor_axes: string[]; native_tensor_axes: string[]; native_entry_for_edge: string };
  model: 'MSGNet';
  dataset: 'ETTh1';
  variables: string[];
  lookback: number;
  horizon: number;
  checkpoint_sha256: string;
  samples: MsgnetSample[];
  notice: string;
}

let catalogPromise: Promise<MsgnetCatalog> | null = null;
const evidenceCache = new WeakMap<MsgnetSample, MsgnetEvidenceIndex>();

export function getMsgnetEvidenceIndex(sample: MsgnetSample): MsgnetEvidenceIndex {
  const cached = evidenceCache.get(sample);
  if (cached) return cached;
  const variables: MsgnetEvidenceIndex['variables'] = {};
  sample.prediction.forEach((prediction, variable) => {
    const truth = sample.ground_truth[variable];
    const absolute_error = prediction.map((value, step) => Math.abs(value - truth[step]));
    const squared_error = prediction.map((value, step) => (value - truth[step]) ** 2);
    variables[String(variable)] = {
      mse: squared_error.reduce((sum, value) => sum + value, 0) / squared_error.length,
      mae: absolute_error.reduce((sum, value) => sum + value, 0) / absolute_error.length,
      truth,
      prediction,
      absolute_error,
    };
  });
  const index = { variables };
  evidenceCache.set(sample, index);
  return index;
}

export function loadMsgnetCatalog(): Promise<MsgnetCatalog> {
  if (!catalogPromise) {
    const base = import.meta.env.BASE_URL ?? '/';
    catalogPromise = fetch(`${base}data/models/msgnet/etth1/graph_catalog_v2.json?v=web-v2`, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error(`MSGNet data could not be loaded (${response.status}).`);
      const catalog = await response.json() as MsgnetCatalog;
      const semantics = catalog.graph_semantics;
      if (semantics?.version !== MSGNET_SEMANTICS_VERSION || semantics.node_kind !== 'latent_graph_position' || !Array.isArray(semantics.node_labels) || semantics.node_labels.some((label, index) => label !== `G${index}`) || JSON.stringify(semantics.tensor_axes) !== '["source_node","target_node"]' || semantics.native_entry_for_edge !== 'A[target, source]') throw new Error('MSGNet catalog has unverified graph directions or node labels.');
      if (!Array.isArray(catalog.samples) || catalog.samples.length !== 5) {
        throw new Error('MSGNet catalog has an incompatible sample structure.');
      }
      const performance = await loadPerformance('MSGNet');
      if (catalog.checkpoint_sha256 !== performance.checkpoint || catalog.dataset !== performance.dataset) throw new Error('MSGNet graph and performance checkpoint or dataset do not match.');
      for (const sample of catalog.samples) {
        const actual = performance.samples.find(s => s.id === sample.sample_index);
        if (!actual) throw new Error('No performance data is available for this graph sample.');
        for (const context of sample.contexts) {
          const edges = actual.contexts.find(c => c.index === context.scale_index)?.edges;
          const stored = context.adaptive.flatMap((row,s) => row.flatMap((v,t) => s !== t && v > 0 ? [[s,t,v]] : []));
          if (!edges || stored.length !== edges.length || stored.some(([s,t,v]) => !edges.some(e => e[0] === s && e[1] === t && Math.abs(e[2]-v) < 1e-6))) throw new Error('MSGNet graph direction or effective edges do not match the performance run.');
        }
      }
      return catalog;
    });
  }
  return catalogPromise;
}
