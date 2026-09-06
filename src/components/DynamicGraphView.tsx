import { useMemo } from 'react';
import { useDemoStore } from '@/store/useDemoStore';
import { GraphMatrix } from './charts/GraphMatrix';
import { DynamicGraph3D } from './three/DynamicGraph3D';

export function DynamicGraphView() {
  const s = useDemoStore();
  const sample = s.sample;
  const win = sample?.windows[s.windowIdx];

  const retainedWindows = useMemo(
    () => sample?.windows.map((window) => window.active_input_steps?.length === 0 ? [] : window.kept_edges.map((edge) => ({ ...edge, kept: true }))) ?? [],
    [sample]
  );
  if (!sample || !win) return null;

  const is3D = s.graphLayout === '3d-timeline';
  const displayedSource = 'sparse';

  return (
    <div className={is3D ? 'h-full' : ''}>
      <div className={is3D ? 'pointer-events-none absolute left-[330px] right-5 top-7 z-20 flex items-baseline justify-between' : 'mb-3 flex items-baseline justify-between'}>
        <h3 className="text-[15px] font-semibold">
          {sourceLabel(displayedSource)} · window {s.windowIdx + 1}/{sample.windows.length}
        </h3>
        <span className="data-num text-[12px] text-ink-400">
          steps {win.start}–{win.end} · retained {win.kept_edges.length}/{win.edges.length}
        </span>
      </div>

      {is3D ? (
        <DynamicGraph3D
          variables={sample.variables}
          windows={retainedWindows}
          displayRatio={1}
          displayThreshold={0}
          activeWindow={s.windowIdx}
          target={s.target}
          spacing={s.graph3DSpacing}
          selectedNode={s.selectedNode}
          selectedEdge={s.selectedEdge}
          onSelectWindow={(index) => {
            s.set('windowIdx', index);
            s.log('Select artifact window', undefined, `window ${index + 1}`);
          }}
          onClearSelection={(index) => {
            s.set('windowIdx', index);
            s.set('selectedNode', null);
            s.set('selectedEdge', null);
            s.log('Clear graph selection', undefined, `window ${index + 1}`);
          }}
          onSelectNode={(node) => {
            s.set('selectedNode', node);
            s.set('selectedEdge', null);
            s.log('Select artifact node', undefined, sample.variables[node]);
          }}
          onSelectEdge={(edge, windowIdx) => {
            s.set('windowIdx', windowIdx);
            s.set('selectedEdge', { source: edge.source, target: edge.target });
            s.set('selectedNode', null);
            s.log('Select artifact edge', undefined, `${sample.variables[edge.source]} → ${sample.variables[edge.target]} · window ${windowIdx + 1}`);
          }}
        />
      ) : (
        <div className="flex max-w-full justify-center overflow-auto pb-2">
          <GraphMatrix
            variables={sample.variables}
            matrix={win.active_input_steps?.length === 0 ? win.sparse_graph.map(row => row.map(() => 0)) : win.sparse_graph}
            selectedEdge={s.selectedEdge}
            onSelectEdge={(source,target) => s.set('selectedEdge',{source,target})}
            diverging={s.graphSource === 'difference'}
            target={s.target}
            size={sample.variables.length > 12 ? Math.min(720, 80 + sample.variables.length * 30) : Math.min(420, 60 + sample.variables.length * 44)}
          />
        </div>
      )}

      {!is3D && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
          {s.graphSource === 'difference'
            ? 'Descriptive display only: each cell is the stored learned-graph value minus the stored static-prior value. No new model result is computed.'
            : 'All matrices and retained-edge states are read from checkpoint-replayed artifacts. Selecting a relation defines a candidate for intervention validation; graph weight alone is not functional evidence.'}
        </p>
      )}
    </div>
  );
}

function sourceLabel(src: string): string {
  switch (src) {
    case 'static': return 'Stored static prior';
    case 'sparse': return 'Stored message-passing graph';
    case 'difference': return 'Derived display: learned score − static prior';
    default: return 'Stored learned graph score';
  }
}
