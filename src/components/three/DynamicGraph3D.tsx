import { ScrollFriendlyOrbitControls } from './ScrollFriendlyOrbitControls';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Html, Line, QuadraticBezierLine, Ring } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GraphEdge } from '@/types/demo';
import { selectableWindows } from '@/data/selectableWindows';
import { useDemoStore } from '@/store/useDemoStore';

interface Props {
  variables: string[]; windows: GraphEdge[][]; activeWindow: number; target: number;
  displayRatio: number;
  displayThreshold: number; spacing: number; selectedNode: number | null;
  selectedEdge: { source: number; target: number } | null;
  onSelectWindow: (index: number) => void; onSelectNode: (index: number) => void;
  onSelectEdge: (edge: GraphEdge, windowIndex: number) => void;
  onClearSelection: (windowIndex: number) => void;
}
type CameraMode = 'focus' | 'overview';

export function DynamicGraph3D(props: Props) {
  const sample = useDemoStore(s => s.sample);
  const availableWindows = selectableWindows(sample, props.selectedEdge);
  const [cameraMode, setCameraMode] = useState<CameraMode>('focus');
  const current = props.windows[props.activeWindow] ?? [];
  const mean = current.length ? current.reduce((n, e) => n + Math.abs(e.weight), 0) / current.length : 0;
  const strongest = [...current].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))[0];

  return (
    <div className="relative h-[920px] w-full overflow-hidden bg-[#eef3f8]">
      <div className={`absolute left-[330px] top-20 z-10 flex items-start justify-between rounded-xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-md transition-all right-5`}>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#718096]">Dynamic correlation laboratory</div>
          <div className="mt-1 flex items-baseline gap-2"><span className="text-lg font-semibold text-[#233047]">Window {props.activeWindow + 1}</span><span className="text-[11px] text-[#7b879a]">{current.length} effective edges · mean weight {mean.toFixed(3)}</span></div>
        </div>
        <div className="flex items-center gap-2">

        <div className="flex rounded-lg border border-[#d6dde7] bg-white/90 p-0.5 shadow-sm backdrop-blur">
          {(['focus', 'overview'] as CameraMode[]).map((mode) => <button key={mode} onClick={() => setCameraMode(mode)} className={`rounded-md px-3 py-1.5 text-[11px] font-medium capitalize transition ${cameraMode === mode ? 'bg-[#263b59] text-white shadow-sm' : 'text-[#66748a] hover:bg-[#edf1f6]'}`}>{mode}</button>)}
        </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-20 left-[330px] z-10 w-[230px] rounded-lg border border-white/80 bg-white/88 p-3 shadow-[0_8px_28px_rgba(42,55,78,.12)] backdrop-blur-md">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#758196]">Graph summary</div>
        <Metric label="Effective edges" value={String(current.length)} />
        <Metric label="Highest-weight edge" value={strongest ? `${props.variables[strongest.source]} → ${props.variables[strongest.target]}` : '—'} accent />
      </div>
      <div className={`pointer-events-none absolute bottom-20 z-10 rounded-lg border border-white/80 bg-white/85 px-3 py-2 text-[10.5px] leading-5 text-[#718096] shadow-sm backdrop-blur transition-all right-5`}>
        <div><i className="mr-2 inline-block h-1.5 w-5 rounded bg-[#16827f]" />Effective relation</div>
        <div><i className="mr-2 inline-block h-1.5 w-5 rounded bg-[#cf503d]" />Selected relation</div>
        <div className="mt-1 border-t border-[#e5e9ef] pt-1">Arrow direction: source → target</div>
        <div>Scroll to page · Ctrl + scroll to zoom · drag to rotate</div>
      </div>

      <div className={`absolute bottom-6 left-[330px] z-20 transition-all right-5`}>
        <div className="relative flex items-center justify-between px-2">
          <div className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-[#bfc9d6]" />
          <div className="absolute left-3 top-1/2 h-[2px] -translate-y-1/2 bg-[#16827f] transition-all duration-700" style={{ width: `calc(${props.windows.length > 1 ? props.activeWindow / (props.windows.length - 1) * 100 : 0}% - 12px)` }} />
          {availableWindows.map(i => <button key={i} onClick={() => props.onSelectWindow(i)} aria-label={`Select window ${i + 1}`} className={`relative flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-semibold shadow-sm transition-all duration-300 ${i === props.activeWindow ? 'scale-110 border-[#16827f] bg-[#16827f] text-white' : i < props.activeWindow ? 'border-[#62aaa7] bg-[#e7f4f3] text-[#167a77]' : 'border-[#c9d1dc] bg-white text-[#718096] hover:border-[#16827f]'}`}>{i + 1}</button>)}
        </div>
        <div className="mt-2 flex justify-between px-1 text-[9px] font-medium uppercase tracking-[.12em] text-[#8793a5]"><span>graph context</span><span>native graph context index</span><span>graph context</span></div>
      </div>

      <Canvas
        camera={{ position: [0, 4.8, 10.5], fov: 40 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        onPointerMissed={() => props.onClearSelection(props.activeWindow)}
      >
        <color attach="background" args={['#f4f7fb']} />
        <fog attach="fog" args={['#f4f7fb', 13, 28]} />
        <ambientLight intensity={1.15} />
        <directionalLight position={[4, 7, 8]} intensity={1.5} />
        <pointLight position={[-4, 2, 4]} color="#9dd8d5" intensity={1.4} />
        <CameraRig activeWindow={props.activeWindow} count={props.windows.length} spacing={props.spacing} mode={cameraMode} />
        <GraphLaboratory {...props} />
        <ScrollFriendlyOrbitControls />
      </Canvas>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex items-start justify-between gap-3 border-t border-[#e8ecf1] py-1.5 first:border-0"><span className="text-[10.5px] text-[#7a8799]">{label}</span><span className={`text-right text-[10.5px] font-semibold ${accent ? 'text-[#167a77]' : 'text-[#344158]'}`}>{value}</span></div>;
}

function CameraRig({ activeWindow, count, spacing, mode }: { activeWindow: number; count: number; spacing: number; mode: CameraMode }) {
  const { camera } = useThree();
  const center = (count - 1) * spacing * .5;
  useFrame((_, dt) => {
    const x = mode === 'focus' ? activeWindow * spacing - center : 0;
    const target = mode === 'focus' ? new THREE.Vector3(x, 3.6, 9.5) : new THREE.Vector3(0, 8.5, Math.max(14, count * spacing * .72));
    camera.position.lerp(target, 1 - Math.exp(-dt * 2.7));
    camera.lookAt(mode === 'focus' ? x : 0, 0, 0);
  });
  return null;
}

function GraphLaboratory(props: Props) {
  const { variables, windows, activeWindow, spacing, target } = props;
  const radius = 2.15;
  const center = (windows.length - 1) * spacing * .5;
  const positions = useMemo(() => variables.map((_, i) => {
    const a = i / variables.length * Math.PI * 2 - Math.PI / 2;
    return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  }), [variables]);
  return <group rotation={[-.08, 0, 0]}>
    {windows.map((edges, wi) => <WindowGraph key={wi} {...props} edges={edges} windowIndex={wi} active={wi === activeWindow} positionX={wi * spacing - center} positions={positions} />)}
    {positions.map((p, ni) => <Line key={ni} points={windows.map((_, wi) => [wi * spacing - center + p.x, p.y, -.22])} color={ni === target ? '#cf553f' : '#bac4d1'} lineWidth={ni === target ? 1.1 : .45} transparent opacity={ni === target ? .28 : .12} />)}
  </group>;
}

function WindowGraph({ edges, windowIndex, active, positionX, positions, ...props }: Props & { edges: GraphEdge[]; windowIndex: number; active: boolean; positionX: number; positions: THREE.Vector3[] }) {
  const [hoverNode, setHoverNode] = useState<number | null>(null);
  const visible = displayEdges(edges.filter((edge) => edge.kept), props.displayRatio, props.displayThreshold);
  return <group
    position={[positionX, 0, active ? .35 : -.4]}
    rotation={[THREE.MathUtils.degToRad(-4), THREE.MathUtils.degToRad(-27), THREE.MathUtils.degToRad(-1.5)]}
    scale={active ? 1.04 : .76}
  >
    <mesh onClick={(e) => { e.stopPropagation(); props.onClearSelection(windowIndex); }}>
      <circleGeometry args={[2.65, 72]} /><meshPhysicalMaterial color={active ? '#f7ffff' : '#ffffff'} transparent opacity={active ? .9 : .28} roughness={.82} transmission={active ? .05 : 0} depthWrite={false} />
    </mesh>
    <Ring args={[2.61, 2.66, 72]} position={[0, 0, .015]}><meshBasicMaterial color={active ? '#16827f' : '#b8c2cf'} transparent opacity={active ? .9 : .25} /></Ring>
    <Billboard position={[0, 2.92, .1]}><Html center distanceFactor={8} style={{ pointerEvents: 'none' }}><div className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide shadow-sm ${active ? 'border-[#16827f] bg-[#16827f] text-white' : 'border-[#d5dbe4] bg-white/80 text-[#7b8797]'}`}>{`WINDOW ${windowIndex + 1}`}</div></Html></Billboard>
    {visible.map((edge, i) => <CorrelationEdge key={`${edge.source}-${edge.target}-${i}`} edge={edge} variables={props.variables} active={active} selected={active && props.selectedEdge?.source === edge.source && props.selectedEdge?.target === edge.target} dimmed={props.selectedNode != null && edge.source !== props.selectedNode && edge.target !== props.selectedNode} a={positions[edge.source]} b={positions[edge.target]} onClick={() => { props.onSelectWindow(windowIndex); props.onSelectEdge(edge, windowIndex); }} />)}
    {positions.map((p, ni) => <Node key={ni} p={p} name={props.variables[ni]} active={active} target={ni === props.target} selected={ni === props.selectedNode} hovered={ni === hoverNode} onHover={(v) => setHoverNode(v ? ni : null)} onClick={() => { props.onSelectWindow(windowIndex); props.onSelectNode(ni); }} />)}
  </group>;
}

function CorrelationEdge({ edge, variables, active, selected, dimmed, a, b, onClick }: { edge: GraphEdge; variables: string[]; active: boolean; selected: boolean; dimmed: boolean; a: THREE.Vector3; b: THREE.Vector3; onClick: () => void }) {
  const particle = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const bend = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, .22 + a.distanceTo(b) * .12);
  useFrame(({ clock }) => {
    if (!particle.current || !active || !edge.kept) return;
    const t = (clock.elapsedTime * (.18 + Math.abs(edge.weight) * .25) + edge.source * .13) % 1;
    const p = new THREE.QuadraticBezierCurve3(a, bend, b).getPoint(t); particle.current.position.copy(p);
  });
  const color = selected ? '#cf503d' : edge.kept ? '#16827f' : '#aeb8c6';
  const opacity = dimmed ? .05 : hovered || selected ? 1 : active ? edge.kept ? .88 : .16 : .14;
  return <group onClick={(e) => { e.stopPropagation(); onClick(); }} onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}>
    <QuadraticBezierLine start={a} end={b} mid={bend} color={color} lineWidth={hovered ? 4 : selected ? 4.2 : edge.kept ? 1.25 + Math.abs(edge.weight) * 2.7 : .55} dashed={!edge.kept} dashSize={.06} gapSize={.045} transparent opacity={opacity} />
    {active && edge.kept && !dimmed && <mesh ref={particle}><sphereGeometry args={[selected ? .055 : .035, 10, 10]} /><meshBasicMaterial color={selected ? '#ef8a72' : '#63c8c2'} transparent opacity={.9} /></mesh>}
    {hovered && <Billboard position={bend}><Html center distanceFactor={8} style={{ pointerEvents: 'none' }}><div className="min-w-[150px] rounded-lg border border-[#cfd7e2] bg-white/95 p-2.5 text-[10px] shadow-xl backdrop-blur">
      <div className="font-semibold text-[#26364d]">{variables[edge.source]} → {variables[edge.target]}</div>
      <div className="mt-1 flex justify-between gap-4 text-[#6f7d90]"><span>Correlation</span><b className="font-mono text-[#26364d]">{edge.weight.toFixed(4)}</b></div>
      <div className="flex justify-between gap-4 text-[#6f7d90]"><span>Weight rank</span><b className="text-[#26364d]">#{edge.rank}</b></div>
      <div className={`mt-1.5 rounded px-1.5 py-1 text-center font-semibold ${edge.kept ? 'bg-[#e4f4f1] text-[#167a77]' : 'bg-[#faeae6] text-[#a64f3d]'}`}>{edge.kept ? 'Retained by the stored model mask' : 'Excluded by the stored model mask'}</div>
    </div></Html></Billboard>}
  </group>;
}

function displayEdges(edges: GraphEdge[], ratio: number, threshold: number) {
  const eligible = edges
    .filter((edge) => edge.weight > 0 && Math.abs(edge.weight) >= threshold)
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
  if (eligible.length === 0) return [];
  const count = Math.max(1, Math.ceil(eligible.length * Math.min(1, Math.max(0, ratio))));
  return eligible.slice(0, count);
}

function Node({ p, name, active, target, selected, hovered, onHover, onClick }: { p: THREE.Vector3; name: string; active: boolean; target: boolean; selected: boolean; hovered: boolean; onHover: (v: boolean) => void; onClick: () => void }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.2) * .08); });
  const color = target ? '#cf503d' : selected ? '#425aa5' : active ? '#354862' : '#8794a6';
  return <group position={p} onPointerOver={(e) => { e.stopPropagation(); onHover(true); }} onPointerOut={() => onHover(false)} onClick={(e) => { e.stopPropagation(); onClick(); }}>
    {(target || selected) && <mesh ref={ring} position={[0, 0, -.01]}><ringGeometry args={[.17, .225, 32]} /><meshBasicMaterial color={color} transparent opacity={.25} side={THREE.DoubleSide} /></mesh>}
    <mesh scale={hovered ? 1.32 : active ? 1.08 : .9}><sphereGeometry args={[target ? .145 : .115, 24, 24]} /><meshStandardMaterial color={color} roughness={.25} metalness={.12} emissive={color} emissiveIntensity={hovered ? .32 : .06} /></mesh>
    {(active || hovered) && <Billboard position={[0, .28, .04]}><Html center distanceFactor={8.5} style={{ pointerEvents: 'none' }}><div className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-[9.5px] shadow-sm ${target ? 'border-[#edc7bf] bg-white/95 font-semibold text-[#b44332]' : 'border-[#dce2ea] bg-white/92 text-[#344158]'}`}>{name}</div></Html></Billboard>}
  </group>;
}
