"""Recompute all archived MAEs and independently verify the selected pair's supports."""
import importlib.util
import json
import types
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from screen_stemgnn import sha

OUT = Path(__file__).resolve().parents[1] / 'outputs/stemgnn_screening'


def main():
    torch.set_num_threads(2)
    report = json.loads((OUT/'report.json').read_text())
    rows = json.loads((OUT/'records.json').read_text())
    assert sha(OUT/'operands.npz') == report['operands_sha256']
    assert sha(OUT/'screen_checkpoint.pt') == report['checkpoint_sha256']
    arrays = np.load(OUT/'operands.npz')
    metric_error = 0.
    for row in rows:
        s, u, v = row['sample'], row['u'], row['v']
        truth = arrays[f'truth_{s}']
        for key, name in [('baseline_mae', f'baseline_{s}'), ('after_mae', f'prediction_{s}_{u}_{v}')]:
            error = abs(np.abs(arrays[name]-truth).mean()-row[key])
            metric_error = max(metric_error, float(error))
            assert error < 1e-9
    # Explicit post-hoc selection: near-zero positive A, appreciable positive B;
    # maximize B response subject to a >=1.5 weight ratio.
    pairs = []
    for a in rows:
        for b in rows:
            if a['sample']==b['sample'] and a['weight']>=1.5*b['weight'] and .001<=a['relative_percent']<=.05 and b['relative_percent']>=1:
                pairs.append(dict(A=a, B=b, weight_ratio=a['weight']/b['weight'],
                                  response_ratio=b['delta_mae']/a['delta_mae']))
    pair = max(pairs, key=lambda p:p['B']['relative_percent'])
    pair['selection'] = 'Post-hoc; same sample, wA/wB >=1.5, 0.001%<=deltaA/baseline<=0.05%, deltaB/baseline>=1%; maximize deltaB/baseline; not prevalence inference'
    source = OUT/'base_model_fft_compat.py'
    assert sha(source) == report['model_source_sha256']
    spec = importlib.util.spec_from_file_location('screen_verify_model', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    model = module.Model(25, 2, 28, 1, horizon=28).eval()
    model.load_state_dict(torch.load(OUT/'screen_checkpoint.pt',weights_only=True)['state_dict'])
    data = pd.read_csv(OUT/'covid25_daily_2020.csv').to_numpy()
    train_end = report['split']['train_rows']
    test_start = train_end+report['split']['validation_rows']
    mean, std = data[:train_end].mean(0), data[:train_end].std(0)
    std[std==0] = 1
    start = test_start+pair['A']['sample']
    x = torch.tensor(((data-mean)/std)[start:start+28][None],dtype=torch.float32)
    checks = []
    with torch.no_grad():
        for key in ['A','B']:
            row = pair[key]
            u,v = row['u'],row['v']
            native_latent = model.latent_correlation_layer
            expected = {}
            def independent(this,value):
                hidden,_ = this.GRU(value.permute(2,0,1).contiguous())
                attention = this.self_graph_attention(hidden.permute(1,0,2).contiguous()).mean(0)
                attention[u,v] = attention[v,u] = 0
                degree = attention.sum(1)
                symmetric = .5*(attention+attention.T)
                inv = torch.diag(1/(torch.sqrt(degree)+1e-7))
                support = this.cheb_polynomial(inv @ ((torch.diag(degree)-symmetric) @ inv))
                expected['support'] = support
                return support,symmetric
            model.latent_correlation_layer = types.MethodType(independent,model)
            reference,_ = model(x)
            model.latent_correlation_layer = native_latent
            captured = []
            def capture(m,args):
                captured.append(args[1].clone())
            def mask(m,args,output):
                edited = output.clone()
                edited[:,u,v] = edited[:,v,u] = 0
                return edited
            hooks = [b.register_forward_pre_hook(capture) for b in model.stock_block]
            hook = model.dropout.register_forward_hook(mask)
            actual,graph = model(x)
            hook.remove()
            for h in hooks:
                h.remove()
            assert torch.equal(reference,actual)
            assert len(captured)==2 and all(torch.equal(s,expected['support']) for s in captured)
            assert graph[u,v]==graph[v,u]==0
            actual_raw = actual[0].double().numpy()*std+mean
            raw_error = float(np.max(np.abs(actual_raw-arrays[f'prediction_{row["sample"]}_{u}_{v}'])))
            assert raw_error < 1e-8
            checks.append({'pair_member':key,'independent_prediction_max_abs':0.,
                           'both_native_supports_exact':True,'stored_prediction_max_abs':raw_error})
    verification = {'records_recomputed':len(rows),'max_mae_error':metric_error,
                    'pair_native_verification':checks}
    pair['verification'] = verification
    (OUT/'showcase_pair.json').write_text(json.dumps(pair,indent=2))
    print(json.dumps(pair,indent=2))


if __name__=='__main__':
    main()
