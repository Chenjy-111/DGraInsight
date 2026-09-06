export const VERSION = 'performance.v1';
export type Errors = {
    mae: number[];
    mse: number[];
};
export type Record = {
    sample: number;
    context: number;
    source: number;
    target: number;
    scope: 'single' | 'all';
    after: Errors;
};
export type Data = {
    version: string;
    model: string;
    dataset: string;
    checkpoint: string;
    dataHash: string;
    horizon: number;
    outputs: string[];
    thresholdFloor: number;
    environment: object;
    parameters: object;
    historicalReplay: string;
    evaluationSamples: number[];
    samples: {
        id: number;
        baseline: Errors;
        contexts: {
            index: number;
            edges: number[][];
        }[];
    }[];
    records: Record[];
};
const cache = new Map<string, Promise<Data>>();
export function loadPerformance(model: string) {
    const key = `${VERSION}:${model}`;
    if (!cache.has(key))
        cache.set(key, fetch(`${import.meta.env.BASE_URL}data/performance/v1/${model.toLowerCase()}.json?v=${VERSION}`).then(async (r) => {
            if (!r.ok)
                throw new Error(`Performance data could not be loaded (${r.status})`);
            const d = await r.json() as Data;
            if (d.version !== VERSION || d.model !== model || d.dataset !== 'ETTh1' || !/^[a-f0-9]{64}$/.test(d.checkpoint) || !/^[a-f0-9]{64}$/.test(d.dataHash) || d.thresholdFloor !== 0 || d.horizon !== 96 || !Array.isArray(d.outputs) || d.outputs.length !== 7 || !Array.isArray(d.samples) || !Array.isArray(d.records) || !Array.isArray(d.evaluationSamples) || !d.evaluationSamples.length || new Set(d.evaluationSamples).size !== d.evaluationSamples.length || d.evaluationSamples.some(id => !d.samples.some(s => s.id === id)))
                throw new Error('Performance data version or identity mismatch');
            const valid = (e: Errors) => e && (['mae', 'mse'] as const).every(k => Array.isArray(e[k]) && e[k].length === d.horizon && e[k].every(v => Number.isFinite(v) && v >= 0));
            const keys = new Set<string>();
            for (const s of d.samples) {
                if (!valid(s.baseline) || keys.has(`s:${s.id}`))
                    throw new Error('Missing baseline or duplicate sample');
                keys.add(`s:${s.id}`);
            }
            for (const r of d.records) {
                const key = JSON.stringify([r.sample, r.context, r.source, r.target, r.scope]);
                const s = d.samples.find(s => s.id === r.sample);
                if (!valid(r.after) || keys.has(key) || !['single', 'all'].includes(r.scope) || (r.scope === 'all' && r.context !== -1) || !s?.contexts.some(c => (r.scope === 'all' || r.context === c.index) && c.edges.some(e => e[0] === r.source && e[1] === r.target && e[2] > 0)))
                    throw new Error('Missing or duplicate removal data, or invalid relation identity');
                keys.add(key);
            }
            return d;
        }));
    return cache.get(key)!;
}
export const mean = (v: number[]) => v.length && v.every(Number.isFinite) ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
export const percent = (b: number, a: number) => b > 0 && Number.isFinite(a) ? (b - a) / b * 100 : NaN;
export function conclusion(before: Errors | undefined, after: Errors | undefined, floor = 0) {
    if (!before || !after)
        return 'Results unavailable';
    const states = (['mae', 'mse'] as const).map(m => { const b = mean(before[m]), a = mean(after[m]), t = Math.max(b * .001, floor); return !Number.isFinite(b) || !Number.isFinite(a) ? NaN : a - b < -t ? -1 : a - b > t ? 1 : 0; });
    const [a, b] = states;
    if (!states.every(Number.isFinite))
        return 'Results unavailable';
    if (!a && !b)
        return 'No noticeable change';
    if (a === b)
        return a < 0 ? 'Performance improved' : 'Performance degraded';
    if (a && b)
        return 'Mixed metric changes';
    return `${a ? 'MAE' : 'MSE'} ${(a || b) < 0 ? 'improved' : 'degraded'} only`;
}
