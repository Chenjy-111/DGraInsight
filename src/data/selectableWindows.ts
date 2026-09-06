import type { SampleData } from '@/types/demo';

/** UI indices only. Native graph indices and model calculations are unchanged. */
export function selectableWindows(sample: SampleData | null, edge: {source: number; target: number} | null): number[] {
  return sample?.windows.flatMap((window, index) =>
    window.active_input_steps?.length === 0 ||
    (edge && !window.kept_edges.some(e => e.source === edge.source && e.target === edge.target && e.weight > 0))
      ? [] : [index]
  ) ?? [];
}
