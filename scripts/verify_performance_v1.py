"""Recompute every browser error from independent stored prediction operands."""
import hashlib
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
report = {}
for model in ['dgraformer', 'msgnet']:
    data = json.loads((ROOT / f'public/data/performance/v1/{model}.json').read_text())
    path = ROOT / data['rawArchive']['path']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == data['rawArchive']['sha256']
    raw = np.load(path)
    baselines, truths, predictions = raw['baseline'], raw['truth'], raw['prediction']
    assert raw['sample_ids'].tolist() == [s['id'] for s in data['samples']]
    def check(pred, truth, errors):
        residual = pred.astype(np.float64) - truth.astype(np.float64)
        np.testing.assert_array_equal(np.abs(residual).mean(axis=1), errors['mae'])
        np.testing.assert_array_equal((residual**2).mean(axis=1), errors['mse'])
    lookup = {s['id']: i for i, s in enumerate(data['samples'])}
    for i, sample in enumerate(data['samples']):
        check(baselines[i], truths[i], sample['baseline'])
    for i, record in enumerate(data['records']):
        check(predictions[i], truths[lookup[record['sample']]], record['after'])
    report[model] = {'status': 'PASS', 'baselines': len(data['samples']), 'deletions': len(data['records']), 'error_values': (len(data['samples']) + len(data['records'])) * 96 * 2, 'exact_equality': True}
out = ROOT / 'artifacts/performance/v1/verification.json'
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
