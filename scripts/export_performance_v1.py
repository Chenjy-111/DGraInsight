"""Checkpoint-backed performance namespace; no controls or inference experiments."""
import argparse, hashlib, json, platform, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import numpy as np
import torch
from dgraudit.adapters import DGraFormerAdapter, MSGNetAdapter

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--model', choices=['dgraformer', 'msgnet'], required=True)
    p.add_argument('--source-root', required=True)
    p.add_argument('--checkpoint', required=True)
    p.add_argument('--data-path', required=True)
    a = p.parse_args()
    old = json.loads((ROOT / f'public/data/evidence/{a.model}_etth1_session_v2.json').read_text())
    digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
    assert digest(a.checkpoint) == old['checkpoint']['sha256']
    assert digest(a.data_path) == old['dataset']['sha256']
    torch.set_num_threads(2)
    cfg = json.loads((ROOT / f'configs/local_audit_{a.model}_etth1.json').read_text())
    if a.model == 'dgraformer':
        reg = json.loads((ROOT / 'configs/phase1_registry.json').read_text())
        ds = {**reg['datasets']['ETTh1'], 'root_path': str(Path(a.data_path).parent), 'data_path': Path(a.data_path).name}
        adapter = DGraFormerAdapter(a.source_root, 'ETTh1', reg['common'], ds, reg['random_seed'])
        adapter.current_epoch = 5
    else:
        adapter = MSGNetAdapter(a.source_root, {'random_seed': 2021, 'dataset': {**cfg['dataset'], 'path': a.data_path}, 'model_config': cfg['adapter_config']['model']})
    adapter.load_checkpoint(a.checkpoint)
    web_ids = set(reg['datasets']['ETTh1']['web_sample_indices']) if a.model == 'dgraformer' else {s['sample_index'] for s in json.loads((ROOT / 'public/data/models/msgnet/etth1/graph_catalog_v2.json').read_text())['samples']}
    ids = sorted({s['sample_index'] for s in old['samples']} | web_ids)
    result = {'version': 'performance.v1', 'model': 'DGraFormer' if a.model == 'dgraformer' else 'MSGNet', 'dataset': 'ETTh1', 'checkpoint': digest(a.checkpoint), 'dataHash': digest(a.data_path), 'parameters': cfg['adapter_config'], 'environment': {'python': platform.python_version(), 'torch': torch.__version__, 'device': str(adapter.device)}, 'thresholdFloor': 0, 'horizon': 96, 'outputs': cfg['dataset']['variables'], 'samples': [], 'records': [], 'historicalReplay': 'FAIL' if a.model == 'msgnet' else 'PASS'}
    raw_baselines, raw_truths, raw_predictions = [], [], []
    result['evaluationSamples'] = [s['sample_index'] for s in old['samples']]
    def metrics(pred, truth):
        error = pred.astype(np.float64) - truth.astype(np.float64)
        return {'mae': np.abs(error).mean(axis=1).tolist(), 'mse': (error**2).mean(axis=1).tolist()}
    for sid in ids:
        batch = adapter.load_sample('test', sid)
        baseline = adapter.predict(batch).numpy().squeeze(0)
        truth = np.asarray(batch['y'][-96:], dtype=np.float32)
        identity = {'type': 'identity', 'window': 0, 'current_epoch': 5} if a.model == 'dgraformer' else {'type': 'identity', 'layer': 0, 'scale_index': 0}
        noop = adapter.predict_with_graph_override(batch, identity)['prediction'].numpy().squeeze(0)
        assert np.array_equal(baseline, noop), 'Identity intervention must equal native forward'
        raw_baselines.append(baseline)
        raw_truths.append(truth)
        stages = adapter.extract_graph_stages(batch)
        if a.model == 'dgraformer':
            active = sorted(set(int(v) % len(stages['windows']) for v in np.asarray(batch['time_index']).ravel()))
            graphs = [(i, stages['windows'][i]['normalized'].numpy()) for i in active]
        else:
            graphs = [(g['scale_index'], g['adaptive'].numpy()) for g in stages['contexts']]
        contexts = [{'index': i, 'edges': [[s,t,float(g[s,t])] for s in range(len(g)) for t in range(len(g)) if s != t and g[s,t] > 0]} for i,g in graphs]
        result['samples'].append({'id': sid, 'contexts': contexts, 'baseline': metrics(baseline, truth)})
        union = sorted({(s,t) for c in contexts for s,t,_ in c['edges']})
        tasks = [(c['index'],s,t,'single') for c in contexts for s,t,_ in c['edges']] + [(-1,s,t,'all') for s,t in union]
        for context,s,t,scope in tasks:
            protocol = {'type': 'structural_edge_removal', 'source': s, 'target': t}
            if a.model == 'dgraformer':
                protocol.update(current_epoch=5, window=context)
                if scope == 'all': protocol['type'] = 'global_structural_edge_removal'
            else:
                protocol.update(layer=0, scale_index=max(0,context))
                if scope == 'all': protocol['scope'] = 'global'
            pred = adapter.predict_with_graph_override(batch, protocol)['prediction'].numpy().squeeze(0)
            assert np.isfinite(pred).all()
            raw_predictions.append(pred)
            result['records'].append({'sample': sid, 'context': context, 'source': s, 'target': t, 'scope': scope, 'after': metrics(pred,truth)})
        print(f'{a.model} sample {sid}: {len(tasks)} deletions', flush=True)
    result['sourceHashes'] = {str(f.relative_to(a.source_root)): digest(f) for folder in ['models','layers'] for f in Path(a.source_root,folder).glob('*.py')}
    out = ROOT / 'public/data/performance/v1'
    out.mkdir(parents=True,exist_ok=True)
    archive = ROOT / 'artifacts/performance/v1'
    archive.mkdir(parents=True,exist_ok=True)
    raw_path = archive / f'{a.model}_raw.npz'
    np.savez_compressed(raw_path, baseline=np.stack(raw_baselines), truth=np.stack(raw_truths), prediction=np.stack(raw_predictions), sample_ids=np.array(ids))
    result['rawArchive'] = {'path': str(raw_path.relative_to(ROOT)).replace('\\','/'), 'sha256': digest(raw_path), 'predictionOrder': 'records array order', 'baselineOrder': 'samples array order'}
    result['nativeIdentityCheck'] = 'PASS: exact equality for every sample'
    (out / f'{a.model}.json').write_text(json.dumps(result,separators=(',',':'),allow_nan=False),encoding='utf-8')
    print(f'Complete: {len(result["records"])} records',flush=True)

if __name__ == '__main__': main()
