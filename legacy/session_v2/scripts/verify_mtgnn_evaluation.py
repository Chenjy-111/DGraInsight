"""Independent native MTGNN replay for Evaluation v1 (not legacy row/column ids).

No call to predict_with_graph_override or evaluation plugin removal helpers.
The native gc output is changed with a hook and all nconv consumed matrices checked.
"""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import torch
from dgraudit.evaluation import validate_results, write_results
from dgraudit.evaluation_plugins import resolve, sha256
from dgraudit.validation import MTGNNValidationSpec


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='configs/evaluation_mtgnn.json')
    parser.add_argument('--results', default='public/data/evaluation/mtgnn.json')
    parser.add_argument('--report', default='public/data/evaluation/mtgnn_native_validation.json')
    parser.add_argument('--annotate', action='store_true')
    args = parser.parse_args()
    config_path = Path(args.config).resolve()
    config = json.loads(config_path.read_text(encoding='utf-8'))
    data = validate_results(json.loads(Path(args.results).read_text(encoding='utf-8')))
    resolved = {'source_root': resolve(config_path.parent, config['source_root']), 'dataset': resolve(config_path.parent, config['dataset']['path']), 'checkpoint': resolve(config_path.parent, config['checkpoint']['path'])}
    assert sha256(resolved['dataset']) == data['provenance']['datasetSha256']
    assert sha256(resolved['checkpoint']) == data['provenance']['checkpointSha256']
    torch.set_num_threads(config.get('threads', 2))
    adapter = MTGNNValidationSpec().create_adapter(config, resolved)
    adapter.load_checkpoint(str(resolved['checkpoint']))
    report = {'model': 'MTGNN', 'method': 'Native gc forward hook, no adapter removal helper; inspect nconv matrices in both branches', 'direction': 'nconv ncwl,vw->ncvl: native[target,source]; transpose branch changes reverse channel', 'samples': 0, 'records': 0, 'consumedMatrixChecks': 0, 'maxPredictionDifference': 0.0, 'status': 'passed', 'failures': []}
    try:
        for sample in data['samples']:
            batch = adapter.load_sample('test', int(sample['id']))
            baseline = adapter.predict(batch)
            assert torch.equal(baseline.squeeze(0), torch.tensor(sample['baselinePrediction'], dtype=baseline.dtype)), 'Baseline mismatch'
            assert torch.equal(batch['y'].cpu(), torch.tensor(sample['truth'], dtype=batch['y'].dtype)), 'Truth mismatch'
            with torch.no_grad():
                original = adapter.model.gc(adapter.model.idx).detach().clone()
            context = sample['contexts'][0]
            exported = {(e['source'], e['target']): e['weight'] for e in context['edges']}
            expected_edges = {(str(s), str(t)): float(original[t, s]) for s in range(original.shape[0]) for t in range(original.shape[0]) if s != t and original[t, s] != 0}
            assert exported == expected_edges, 'Canonical direction mismatch'
            report['samples'] += 1
            for record in (r for r in data['records'] if r['sampleId'] == sample['id']):
                source, target = int(record['source']), int(record['target'])
                expected = original.clone()
                expected[target, source] = 0
                observed = []

                def replace_native_graph(module, inputs, output):
                    assert torch.equal(output, original), 'Native graph changed before intervention'
                    changed = output.clone()
                    changed[target, source] = 0
                    return changed

                hooks = [adapter.model.gc.register_forward_hook(replace_native_graph)]
                def observer(branch):
                    def inspect(module, inputs):
                        graph = expected if branch == 1 else expected.T
                        with_loop = graph + torch.eye(graph.shape[0], device=graph.device)
                        normalized = with_loop / with_loop.sum(1).view(-1, 1)
                        assert torch.equal(inputs[1], normalized), f'Wrong graph entering native nconv branch {branch}'
                        observed.append(branch)
                    return inspect
                for layer in adapter.model.gconv1:
                    hooks.append(layer.nconv.register_forward_pre_hook(observer(1)))
                for layer in adapter.model.gconv2:
                    hooks.append(layer.nconv.register_forward_pre_hook(observer(2)))
                try:
                    # Native model call with the ordinary dataset input and inverse scaling.
                    x = batch['x_normalized'].unsqueeze(0).unsqueeze(1).transpose(2, 3).to(adapter.device)
                    with torch.no_grad():
                        pred = adapter.model(x).squeeze(-1) * adapter._dataset('test').scale.view(1, 1, -1)
                    pred = pred.detach().cpu().squeeze(0)
                    stored = torch.tensor(record['prediction'], dtype=pred.dtype)
                    difference = float(torch.max(torch.abs(pred - stored)))
                    report['maxPredictionDifference'] = max(report['maxPredictionDifference'], difference)
                    assert torch.equal(pred, stored), f'Prediction mismatch {record["id"]}'
                    assert 1 in observed and 2 in observed
                    report['consumedMatrixChecks'] += len(observed)
                    report['records'] += 1
                finally:
                    for hook in hooks: hook.remove()
    except Exception as exc:
        report['status'] = 'failed'
        report['failures'].append(str(exc))
    finally:
        adapter.close()
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    if args.annotate:
        data['validation']['nativeIntervention'] = {'status': report['status'], 'detail': f"Independent native gc-hook replay: {report['records']} removals, {report['consumedMatrixChecks']} consumed nconv matrices checked, maximum prediction difference {report['maxPredictionDifference']}. Both branches checked. Report SHA-256: {sha256(report_path)}."}
        data['provenance']['nativeVerificationReport'] = str(report_path).replace('\\', '/')
        write_results(data, args.results)
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
