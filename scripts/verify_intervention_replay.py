"""Independently replay stored cases through the supplied model/checkpoint.

Run each model in a separate process: upstream packages use the same names.
Writes a verification report only; never updates predictions or model sources.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import numpy as np
import torch
from dgraudit.adapters import DGraFormerAdapter, MSGNetAdapter


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', choices=['dgraformer', 'msgnet'], required=True)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--data-path', type=Path, required=True)
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    session = json.loads((ROOT / f'public/data/evidence/{args.model}_etth1_session_v2.json').read_text(encoding='utf-8'))
    output = args.output.resolve()
    source = args.source_root.resolve(); data = args.data_path.resolve(); checkpoint = args.checkpoint.resolve()
    assert hashlib.sha256(checkpoint.read_bytes()).hexdigest() == session['checkpoint']['sha256']
    assert hashlib.sha256(data.read_bytes()).hexdigest() == session['dataset']['sha256']
    torch.set_num_threads(2)
    if args.model == 'msgnet':
        cfg = json.loads((ROOT / 'configs/local_audit_msgnet_etth1.json').read_text())
        adapter = MSGNetAdapter(str(source), {'random_seed': 2021, 'dataset': {**cfg['dataset'], 'path': str(data)}, 'model_config': cfg['adapter_config']['model']})
    else:
        cfg = json.loads((ROOT / 'configs/phase1_registry.json').read_text())
        ds = {**cfg['datasets']['ETTh1'], 'root_path': str(data.parent), 'data_path': data.name}
        adapter = DGraFormerAdapter(str(source), 'ETTh1', cfg['common'], ds, cfg['random_seed'])
        adapter.current_epoch = 5
    adapter.load_checkpoint(str(checkpoint))
    report = {'model': args.model, 'torch': torch.__version__, 'device': str(adapter.device),
              'checkpoint_sha256': session['checkpoint']['sha256'],
              'atol': 1e-5, 'rtol': 1e-5, 'baseline_count': 0, 'case_count': 0,
              'noop_max_abs': 0., 'baseline_max_abs': 0., 'prediction_max_abs': 0.,
              'input_max_abs': 0., 'truth_max_abs': 0., 'direct_native_max_abs': 0.,
              'input_checked': 0, 'input_unavailable': 0, 'native_graph_checked': 0, 'direct_native_checked': 0,
              'metric_delta_max_abs': {'mae': 0., 'mse': 0.},
              'metric_direction_changes': {'mae': 0, 'mse': 0},
              'direction_change_cases': [],
              'failures': [], 'source_sha256': {}}
    for rel in (['models/MSGNet.py','layers/MSGBlock.py','layers/Embed.py'] if args.model == 'msgnet' else ['models/DGraFormer.py','layers/DGraFormer_framework.py']):
        report['source_sha256'][rel] = hashlib.sha256((source / rel).read_bytes()).hexdigest()
    candidates = {c['candidate_id']: c for c in session['candidate_relations']}
    for sample in session['samples']:
        sid = sample['sample_index']; batch = dict(adapter.load_sample('test', sid))
        baseline = adapter.predict(batch).numpy().squeeze(0)
        saved = np.array(sample['baseline_prediction']['values'], dtype=np.float32)
        saved_baseline = saved.copy()
        truth = np.array(sample['ground_truth']['values'], dtype=np.float32)
        for key, actual in [('input', batch['x']), ('truth', batch['y'][-truth.shape[0]:])]:
            if key == 'input' and sample['history']['value'] is None:
                report['input_unavailable'] += 1
                continue
            if key == 'input': report['input_checked'] += 1
            expected = np.array(sample['history']['value']['values'] if key == 'input' else truth, dtype=np.float32)
            actual = np.asarray(actual, dtype=np.float32)
            report[f'{key}_max_abs'] = max(report[f'{key}_max_abs'], float(np.max(np.abs(expected - actual))))
            if not np.array_equal(actual, expected): report['failures'].append(f'{key}:{sid}')
        report['baseline_max_abs'] = max(report['baseline_max_abs'], float(np.max(np.abs(saved-baseline))))
        if not np.allclose(saved, baseline, atol=1e-5, rtol=1e-5): report['failures'].append(f'baseline:{sid}')
        identity = {'type':'identity','layer':0,'scale_index':0} if args.model == 'msgnet' else {'type':'identity','window':0,'current_epoch':5}
        noop = adapter.predict_with_graph_override(batch, identity)['prediction'].numpy().squeeze(0)
        report['noop_max_abs'] = max(report['noop_max_abs'], float(np.max(np.abs(noop-baseline))))
        if not np.allclose(noop, baseline, atol=1e-6, rtol=1e-5): report['failures'].append(f'noop:{sid}')
        report['baseline_count'] += 1
        for case in session['case_evidence']:
            if case['sample_id'] != sid or case['status'] != 'active': continue
            c = candidates[case['candidate_id']]
            protocol = {'type':'structural_edge_removal','source':c['source'],'target':c['target']}
            captured = {}; handles = []
            if args.model == 'msgnet':
                protocol.update(layer=0, scale_index=c.get('scale_index',0))
                scales = list(range(adapter.args.top_k)) if c['scope'] == 'all_scales' else [c['scale_index']]
                if c['scope'] == 'all_scales': protocol['scope'] = 'global'
                # Capture the ACTUAL normalized adjacency reaching native nconv.
                for scale in scales:
                    block = adapter.model.model[0].gconv[scale].gconv1.nconv
                    def capture(module, inputs, index=scale):
                        captured[index] = inputs[1].detach().cpu().numpy().copy()
                    handles.append(block.register_forward_pre_hook(capture))
            else:
                protocol.update(current_epoch=5, window=c.get('window_index',0))
                if c['scope'] == 'all_retained_windows': protocol['type']='global_structural_edge_removal'
            try:
                outcome = adapter.predict_with_graph_override(batch, protocol)
            finally:
                for handle in handles: handle.remove()
            if args.model == 'msgnet':
                for scale in scales:
                    before = outcome['graph_before'][scale].numpy().T
                    edited = before.copy(); edited[c['target'],c['source']]=0
                    loop = edited + np.eye(edited.shape[0],dtype=np.float32)
                    expected = loop / loop.sum(1,keepdims=True)
                    report['native_graph_checked'] += 1
                    if scale not in captured or not np.allclose(captured[scale],expected,atol=1e-7,rtol=1e-6): report['failures'].append(f'native_graph:{case["case_evidence_id"]}:{scale}')
            pred = outcome['prediction'].numpy().squeeze(0)
            if args.model == 'msgnet':
                # Independent intervention at the native mixprop input. It uses
                # the original model's computed adjacency, not adapter stages.
                direct_handles = []
                def edit_native(module, inputs):
                    x, adjacency = inputs
                    adjacency = adjacency.clone()
                    adjacency[c['target'], c['source']] = 0
                    return x, adjacency
                try:
                    for scale in scales:
                        direct_handles.append(adapter.model.model[0].gconv[scale].gconv1.register_forward_pre_hook(edit_native))
                    direct = adapter.predict(batch).numpy().squeeze(0)
                finally:
                    for handle in direct_handles: handle.remove()
                report['direct_native_max_abs'] = max(report['direct_native_max_abs'], float(np.max(np.abs(direct-pred))))
                report['direct_native_checked'] += 1
                if not np.array_equal(direct, pred): report['failures'].append(f'direct_native:{case["case_evidence_id"]}')
            saved = np.array(case['intervention_output_reference']['value']['values'],dtype=np.float32)
            for metric, loss in [('mae', lambda a: np.mean(np.abs(a))), ('mse', lambda a: np.mean(a ** 2))]:
                # Compute in float64 so aggregation noise does not hide changes.
                archived_delta = float(loss(saved.astype(np.float64)-truth) - loss(saved_baseline.astype(np.float64)-truth))
                replay_delta = float(loss(pred.astype(np.float64)-truth) - loss(baseline.astype(np.float64)-truth))
                report['metric_delta_max_abs'][metric] = max(report['metric_delta_max_abs'][metric], abs(archived_delta-replay_delta))
                if np.sign(archived_delta) != np.sign(replay_delta):
                    report['metric_direction_changes'][metric] += 1
                    report['direction_change_cases'].append({'case_id': case['case_evidence_id'], 'metric': metric,
                        'archived_delta': archived_delta, 'replay_delta': replay_delta})
            report['prediction_max_abs'] = max(report['prediction_max_abs'],float(np.max(np.abs(saved-pred))))
            if not np.allclose(saved,pred,atol=1e-5,rtol=1e-5): report['failures'].append(case['case_evidence_id'])
            report['case_count'] += 1
        print(f'{args.model} sample {sid}: {report["case_count"]} cases, {len(report["failures"])} failures',flush=True)
    report['status'] = 'PASS' if not report['failures'] else 'FAIL'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({**report, 'failures': len(report['failures']), 'direction_change_cases': len(report['direction_change_cases'])}),flush=True)
    return 0 if report['status']=='PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
