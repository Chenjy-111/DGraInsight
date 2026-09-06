import { useEffect, type ReactNode } from 'react';
import { Pause, Play, RotateCcw, FileDown } from 'lucide-react';
import { useDemoStore } from '@/store/useDemoStore';
import { selectableWindows } from '@/data/selectableWindows';
import { DATASETS } from '@/data/datasets';
import { download } from '@/engine/narrativeGenerator';
import { Select } from './ui/Select';
import { Slider } from './ui/Slider';
import { Tabs } from './ui/Tabs';
import { Button } from './ui/Button';
import type { GraphLayout, ViewMode } from '@/types/demo';

export function ControlStudio() {
  const s = useDemoStore();
  const sample = s.sample;
  const windows = selectableWindows(sample, s.selectedEdge);

  useEffect(() => {
    if (!s.playing) return;
    const id = setInterval(() => {
      const state = useDemoStore.getState();
      const available = selectableWindows(state.sample, state.selectedEdge);
      if (available.length > 1) state.set('windowIdx', available[(available.indexOf(state.windowIdx) + 1) % available.length]);
    }, 1100);
    return () => clearInterval(id);
  }, [s.playing]);

  const variableOptions = sample?.variables.map((label, value) => ({ value, label }))
    ?? DATASETS[s.dataset].variables.map((label, value) => ({ value, label }));

  return (
    <div className="space-y-5">
      <Group title="Case">
        <Field label="Sample"><Select value={s.sampleId} onChange={n => s.setCase({sampleId:n})} options={[0,1,2,3,4].map(value => ({value,label:`sample ${value}`}))} ariaLabel="Graph sample"/></Field>
        <div className="text-[12px] text-ink-500">Dataset: ETTh1 · {DATASETS.ETTh1.variables.length} variables</div>
        <Field label="Target variable">
          <Select<number>
            value={s.target}
            onChange={(target) => {
              s.set('target', target);
              s.log('Change target', undefined, sample?.variables[target]);
            }}
            options={variableOptions}
            ariaLabel="Target variable"
          />
        </Field>
        <div className="text-[12px] text-ink-500">Forecast horizon: 96</div>
      </Group>

      <Group title="View">
        <Tabs<ViewMode>
          value={s.view}
          onChange={s.setView}
          options={[
            { value: 'forecast', label: 'Forecast' },
            { value: 'graph', label: 'Dynamic graph' },
          ]}
          size="sm"
          wrap
        />
      </Group>

      {s.view === 'graph' && (
        <Group title="Graph artifact">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={s.playing ? 'subtle' : 'outline'}
              icon={s.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              onClick={() => s.set('playing', !s.playing)}
            >
              {s.playing ? 'Pause' : 'Play'}
            </Button>
            <span className="data-num text-[12px] text-ink-400">Window {s.windowIdx + 1} · {windows.length} available</span>
          </div>
          <Field label="Window">
            <Select value={windows.includes(s.windowIdx) ? s.windowIdx : -1} onChange={windowIdx => { if (windowIdx >= 0) s.set('windowIdx',windowIdx); }} options={[
              ...(!windows.includes(s.windowIdx) ? [{value:-1,label:'Select an available window'}] : []),
              ...windows.map(value => ({value,label:`Window ${value+1}`}))
            ]} ariaLabel="Graph window"/>
          </Field>

          <Field label="Layout">
            <Tabs<GraphLayout>
              value={s.graphLayout}
              onChange={(layout) => s.set('graphLayout', layout)}
              options={[
                { value: 'matrix', label: 'Matrix' },
                { value: '3d-timeline', label: '3D timeline' },
              ]}
              size="sm"
              wrap
            />
          </Field>

          {s.graphLayout === '3d-timeline' && (
            <Slider
              label="3D layer spacing"
              value={s.graph3DSpacing}
              min={3.4}
              max={6.4}
              step={0.2}
              onChange={(spacing) => s.set('graph3DSpacing', spacing)}
              format={(spacing) => spacing.toFixed(1)}
            />
          )}
        </Group>
      )}

      <Group title="Utilities">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => s.reset()}>Reset</Button>
          <Button
            size="sm"
            variant="outline"
            icon={<FileDown className="h-3.5 w-3.5" />}
            onClick={() => sample && download(`${sample.dataset}_display-state.json`, JSON.stringify(stateSnapshot(), null, 2), 'application/json')}
          >
            Export state
          </Button>
        </div>
      </Group>
    </div>
  );
}

function stateSnapshot() {
  const state = useDemoStore.getState();
  return {
    dataset: state.dataset,
    sampleId: state.sampleId,
    horizon: state.horizon,
    target: state.target,
    view: state.view,
    windowIdx: state.windowIdx,
    graphSource: state.graphSource,
    displayFilter: { strongestRetainedRatio: state.topkRatio, minimumStoredWeight: state.edgeThreshold },
    displayFilterAffectsModelResults: false,
    selectedEdge: state.selectedEdge,
    selectedNode: state.selectedNode,
  };
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div><div className="eyebrow mb-2">{title}</div><div className="space-y-2.5">{children}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><div className="mb-1 text-[12px] text-ink-400">{label}</div>{children}</div>;
}
