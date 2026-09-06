import { create } from 'zustand';
import type { DatasetId, GraphLayout, GraphSource, Horizon, SampleData, ViewMode } from '@/types/demo';
import type { InteractionEvent } from '@/types/explanation';
import { DATASETS } from '@/data/datasets';
import { loadSample } from '@/data/loaders';

export interface SelectedEdge {
  source: number;
  target: number;
}

interface DemoState {
  dataset: DatasetId;
  sampleId: number;
  horizon: Horizon;
  target: number;
  view: ViewMode;
  sample: SampleData | null;
  loading: boolean;
  windowIdx: number;
  playing: boolean;
  graphSource: GraphSource;
  topkRatio: number;
  edgeThreshold: number;
  showFiltered: boolean;
  showEdgeLabels: boolean;
  highlightTarget: boolean;
  graphLayout: GraphLayout;
  graph3DSpacing: number;
  showPatchBoundary: boolean;
  selectedEdge: SelectedEdge | null;
  selectedNode: number | null;
  history: InteractionEvent[];
  set: <K extends keyof DemoState>(key: K, value: DemoState[K]) => void;
  setCase: (patch: Partial<Pick<DemoState, 'dataset' | 'sampleId' | 'horizon' | 'target'>>) => void;
  setView: (view: ViewMode) => void;
  log: (action: string, oldVal?: string, newVal?: string) => void;
  clearHistory: () => void;
  restore: (event: InteractionEvent) => void;
  reset: () => void;
  loadCurrent: () => Promise<void>;
}

let eventSequence = 0;

export const useDemoStore = create<DemoState>((set, get) => ({
  dataset: 'ETTh1',
  sampleId: 0,
  horizon: 96,
  target: DATASETS.ETTh1.variables.length - 1,
  view: 'graph',
  sample: null,
  loading: false,
  windowIdx: 0,
  playing: false,
  graphSource: 'sparse',
  topkRatio: 1,
  edgeThreshold: 0,
  showFiltered: true,
  showEdgeLabels: false,
  highlightTarget: false,
  graphLayout: '3d-timeline',
  graph3DSpacing: 4.4,
  showPatchBoundary: true,
  selectedEdge: null,
  selectedNode: null,
  history: [],

  set: (key, value) => set({ [key]: value } as Partial<DemoState>),
  setCase: (patch) => {
    set({ ...patch, selectedNode: null });
    void get().loadCurrent();
  },
  setView: (view) => {
    const previous = get().view;
    set({ view });
    get().log('Switch view', previous, view);
  },
  log: (action, oldValue, newValue) => {
    const event: InteractionEvent = {
      id: `evt-${++eventSequence}`,
      ts: Date.now(),
      action,
      oldValue,
      newValue,
      view: get().view,
    };
    set((state) => ({ history: [event, ...state.history].slice(0, 200) }));
  },
  clearHistory: () => set({ history: [] }),
  restore: (event) => {
    set({ view: event.view });
    get().log('Restore view from history', undefined, event.action);
  },
  reset: () => set({
    windowIdx: 0,
    playing: false,
    graphSource: 'sparse',
    topkRatio: 1,
    edgeThreshold: 0,
    showFiltered: true,
    graphLayout: '3d-timeline',
    graph3DSpacing: 4.4,
    selectedEdge: null,
    selectedNode: null,
  }),
  loadCurrent: async () => {
    const { dataset, sampleId, horizon, target, sample: currentSample } = get();
    set({ loading: true });
    try {
      const sample = await loadSample(dataset, sampleId, horizon);
      if (get().dataset !== dataset || get().sampleId !== sampleId || get().horizon !== horizon) return;
      const keepTarget = currentSample?.dataset === sample.dataset && target >= 0 && target < sample.variables.length;
      set({
        sample,
        target: keepTarget ? target : sample.targetDefault,
        loading: false,
        windowIdx: Math.min(get().windowIdx, sample.windows.length - 1),
      });
    } catch (error) {
      if (get().dataset === dataset && get().sampleId === sampleId && get().horizon === horizon) set({ loading: false, sample: null });
      console.error(error);
    }
  },
}));
