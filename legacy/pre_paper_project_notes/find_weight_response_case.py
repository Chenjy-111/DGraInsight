"""Find descriptive within-context counterexamples in stored real model runs.

Standard-library only. Recompute selected errors from the hashed NPZ operands;
this is verification of stored re-executions, not a new model execution.
"""
import ast
import hashlib
import json
import math
import struct
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/weight-response-case'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_npy(archive, name):
    with archive.open(name + '.npy') as f:
        assert f.read(8) == b'\x93NUMPY\x01\x00'
        header = ast.literal_eval(f.read(struct.unpack('<H', f.read(2))[0]).decode())
        assert not header['fortran_order']
        code = {'<f4': 'f', '<i8': 'q'}[header['descr']]
        values = [x[0] for x in struct.iter_unpack('<' + code, f.read())]
        assert len(values) == math.prod(header['shape'])
        return values, header['shape']


def main():
    path = ROOT / 'public/data/performance/v1/dgraformer.json'
    graph_path = ROOT / 'public/data/samples/ETTh1_000_h96.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    graph = json.loads(graph_path.read_text(encoding='utf-8'))
    assert graph['provenance']['checkpointSha256'] == data['checkpoint']
    assert graph['provenance']['dataSha256'] == data['dataHash']
    records = {(r['sample'], r['context'], r['source'], r['target']): (i, r)
               for i, r in enumerate(data['records']) if r['scope'] == 'single'}
    rows, pairs = [], []
    for sample in data['samples']:
        baseline = {k: sum(sample['baseline'][k]) / data['horizon'] for k in ('mae', 'mse')}
        for context in sample['contexts']:
            edges = context['edges']
            current = []
            for a, b, weight in edges:
                i, record = records[sample['id'], context['index'], a, b]
                after = {k: sum(record['after'][k]) / data['horizon'] for k in baseline}
                row = dict(sample=sample['id'], context=context['index'], source=a, target=b,
                           relation=f"{data['outputs'][a]} -> {data['outputs'][b]}",
                           weight=weight, rank=1 + sum(e[2] > weight for e in edges),
                           rank_population=len(edges), record_index=i, baseline=baseline, after=after,
                           delta={k: after[k] - baseline[k] for k in baseline},
                           relative_percent={k: 100 * (after[k] - baseline[k]) / baseline[k] for k in baseline})
                rows.append(row)
                current.append(row)
            for a in current:
                for b in current:
                    if a['weight'] > b['weight'] and abs(a['delta']['mae']) < abs(b['delta']['mae']):
                        pairs.append(dict(A=a, B=b))

    # Prefer the existing demo sample, the same destination, positive changes in
    # both metrics, and a rank-1 A. Select the largest MAE gap within this subset.
    candidates = [p for p in pairs if p['A']['sample'] == 0 and p['A']['rank'] == 1
                  and p['A']['target'] == p['B']['target']
                  and all(p[x]['delta'][k] > 0 for x in ('A', 'B') for k in ('mae', 'mse'))
                  and abs(p['A']['delta']['mse']) < abs(p['B']['delta']['mse'])]
    chosen = max(candidates, key=lambda p: p['B']['delta']['mae'] - p['A']['delta']['mae'])
    assert chosen['A']['context'] == chosen['B']['context'] == 1
    raw_path = ROOT / data['rawArchive']['path']
    assert digest(raw_path) == data['rawArchive']['sha256']
    with zipfile.ZipFile(raw_path) as archive:
        arrays = {k: read_npy(archive, k) for k in ('baseline', 'truth', 'prediction', 'sample_ids')}
    assert arrays['sample_ids'][0] == [s['id'] for s in data['samples']]
    count = data['horizon'] * len(data['outputs'])
    assert arrays['prediction'][1] == (len(data['records']), data['horizon'], len(data['outputs']))
    context_cases = [r for r in rows if r['sample'] == 0 and r['source'] == 0 and r['target'] == 4]
    for row in [chosen['A'], chosen['B'], *context_cases]:
        si = arrays['sample_ids'][0].index(row['sample'])
        truth = arrays['truth'][0][si * count:(si + 1) * count]
        for key, ai in [('baseline', si), ('after', row['record_index'])]:
            values = arrays['baseline' if key == 'baseline' else 'prediction'][0][ai * count:(ai + 1) * count]
            errors = [v - t for v, t in zip(values, truth)]
            actual = {'mae': sum(map(abs, errors)) / count, 'mse': sum(e * e for e in errors) / count}
            for k in actual:
                assert abs(actual[k] - row[key][k]) < 1e-12
        row['raw_operand_verification'] = 'PASS (absolute tolerance 1e-12)'
        window = graph['windows'][row['context']]
        row['web_weight_absolute_difference'] = abs(window['sparse_graph'][row['source']][row['target']] - row['weight'])
        assert row['web_weight_absolute_difference'] < 1e-7
        dynamic = window['dynamic_graph']
        row['pre_normalization_weight'] = dynamic[row['source']][row['target']]
        row['pre_normalization_rank'] = 1 + sum(dynamic[a][b] > row['pre_normalization_weight']
            for a in range(7) for b in range(7) if a != b and window['sparse_graph'][a][b] > 0)
    report = dict(model=data['model'], dataset=data['dataset'], checkpoint_sha256=data['checkpoint'],
                  data_sha256=data['dataHash'], horizon=data['horizon'], outputs=data['outputs'],
                  verification='Stored model predictions rechecked; no new native run in this analysis.',
                  definition='delta=after-baseline; relative_percent=100*delta/baseline; mean over 96 steps and 7 outputs',
                  weight_definition='Normalized effective non-self graph weights; ranks over all positive non-self edges in the same native context, no display threshold.',
                  selection='Post-hoc descriptive search; sample 0, same target, rank-1 A, both metrics positive and smaller for A; maximize MAE gap.',
                  source_hashes={str(p.relative_to(ROOT)): digest(p) for p in (path, graph_path, raw_path)},
                  scanned_single_records=len(rows), mae_inversion_pairs=len(pairs),
                  chosen=chosen, context_dependence=context_cases)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'evidence.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    (OUT / 'all_mae_inversion_pairs.json').write_text(json.dumps(pairs, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
