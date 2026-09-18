"""Small real-data candidate screen, not a full Thin Adapter or benchmark reproduction.

Requires upstream files and JHU CSV in outputs/stemgnn_screening (sources.json).
Runs the upstream model with only two explicit FFT API compatibility substitutions.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import types

import numpy as np
import pandas as pd
import torch

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/stemgnn_screening'
COUNTRIES = ['US', 'Canada', 'Mexico', 'Russia', 'United Kingdom', 'Italy',
             'Germany', 'France', 'Belarus', 'Brazil', 'Peru', 'Ecuador', 'Chile',
             'India', 'Turkey', 'Saudi Arabia', 'Pakistan', 'Iran', 'Singapore',
             'Qatar', 'Bangladesh', 'United Arab Emirates', 'China', 'Japan', 'Korea, South']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    torch.set_num_threads(2)
    torch.manual_seed(0)
    np.random.seed(0)
    provenance = json.loads((OUT / 'sources.json').read_text())
    source = OUT / 'upstream/models/base_model.py'
    assert sha(source) == provenance['files']['models/base_model.py']['sha256']
    assert sha(OUT / 'confirmed_global.csv') == provenance['data']['sha256']
    original = source.read_text()
    substitutions = {
        'torch.rfft(input, 1, onesided=False)':
        'torch.view_as_real(torch.fft.fft(input, dim=-1))',
        'torch.irfft(time_step_as_inner, 1, onesided=False)':
        'torch.fft.ifft(torch.view_as_complex(time_step_as_inner.contiguous()), dim=-1).real',
    }
    compatible = original
    for old, new in substitutions.items():
        assert compatible.count(old) == 1
        compatible = compatible.replace(old, new)
    compat_path = OUT / 'base_model_fft_compat.py'
    compat_path.write_text(compatible)
    spec = importlib.util.spec_from_file_location('stemgnn_screen_model', compat_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    frame = pd.read_csv(OUT / 'confirmed_global.csv')
    dates = list(frame.columns[4:])
    dates = [c for c in dates if pd.Timestamp(c).year == 2020]
    grouped = frame.groupby('Country/Region')[dates].sum()
    cumulative = grouped.loc[COUNTRIES].to_numpy(dtype=np.float64).T
    # Retain reported negative corrections; do not clip/rewrite observations.
    daily = np.diff(cumulative, axis=0)
    date_labels = [str(pd.Timestamp(c).date()) for c in dates[1:]]
    pd.DataFrame(daily, columns=COUNTRIES).to_csv(OUT / 'covid25_daily_2020.csv', index=False)
    n = len(daily)
    cut1, cut2 = int(.6*n), int(.8*n)
    mean, std = daily[:cut1].mean(0), daily[:cut1].std(0)
    std[std == 0] = 1
    normalized = (daily-mean)/std
    window = horizon = 28

    def windows(lo, hi):
        starts = list(range(lo, hi-window-horizon+1))
        x = torch.tensor(np.stack([normalized[i:i+window] for i in starts]), dtype=torch.float32)
        y = torch.tensor(np.stack([normalized[i+window:i+window+horizon] for i in starts]), dtype=torch.float32)
        return x, y, starts

    train_x, train_y, _ = windows(0, cut1)
    valid_x, valid_y, _ = windows(cut1, cut2)
    test_x, test_y, starts = windows(cut2, n)
    model = module.Model(25, 2, window, 1, horizon=horizon).eval()
    optimizer = torch.optim.Adam(model.parameters(), lr=.001)
    scale = torch.tensor(std, dtype=torch.float64)
    offset = torch.tensor(mean, dtype=torch.float64)
    checkpoint = OUT / 'screen_checkpoint.pt'
    history = []
    best = float('inf')
    # Fixed budget; checkpoint selection uses validation MAE only, never removal effects.
    for epoch in range(60):
        model.train()
        losses = []
        for ids in torch.randperm(len(train_x)).split(32):
            optimizer.zero_grad()
            pred, _ = model(train_x[ids])
            loss = (pred-train_y[ids]).square().mean()
            assert torch.isfinite(loss)
            loss.backward()
            optimizer.step()
            losses.append(loss.item())
        model.eval()
        with torch.no_grad():
            val = np.mean([((model(x[None])[0][0].double()-y.double())*scale).abs().mean().item()
                           for x, y in zip(valid_x, valid_y)])
        history.append({'epoch': epoch+1, 'train_mse_normalized': float(np.mean(losses)), 'validation_mae_raw': val})
        if val < best:
            best = val
            torch.save({'state_dict': model.state_dict(), 'epoch': epoch+1}, checkpoint)
        if (epoch+1) % 10 == 0:
            print(json.dumps(history[-1]), flush=True)
    saved = torch.load(checkpoint, weights_only=True)
    model.load_state_dict(saved['state_dict'])
    model.eval()
    indices = sorted(set(np.linspace(0, len(test_x)-1, 5, dtype=int).tolist()))
    records, operands, baseline_scores, persistence_scores = [], {}, [], []
    identity_max = 0.
    reference_max = 0.
    selected_cases = []
    with torch.no_grad():
        for ti in indices:
            x = test_x[ti:ti+1]
            truth = test_y[ti].double()*scale+offset
            pred, graph = model(x)
            base = pred[0].double()*scale+offset
            baseline_mae = (base-truth).abs().mean().item()
            baseline_scores.append(baseline_mae)
            persistence_scores.append(((x[0,-1].double()*scale+offset)-truth).abs().mean().item())
            handle = model.dropout.register_forward_hook(lambda m, a, o: o.clone())
            noop, _ = model(x)
            handle.remove()
            identity_max = max(identity_max, (noop-pred).abs().max().item())
            assert torch.equal(noop, pred)
            operands[f'truth_{ti}'] = truth.numpy()
            operands[f'baseline_{ti}'] = base.numpy()
            operands[f'graph_{ti}'] = graph.numpy()
            local = []
            for u in range(25):
                for v in range(u+1, 25):
                    captured = {}

                    def mask(m, args, output):
                        result = output.clone()
                        result[:, u, v] = result[:, v, u] = 0
                        captured['attention'] = result.mean(0).clone()
                        return result

                    hook = model.dropout.register_forward_hook(mask)
                    after, removed_graph = model(x)
                    hook.remove()
                    assert removed_graph[u, v] == removed_graph[v, u] == 0
                    expected_graph = graph.clone()
                    expected_graph[u, v] = expected_graph[v, u] = 0
                    assert torch.equal(removed_graph, expected_graph)
                    after_raw = after[0].double()*scale+offset
                    mae = (after_raw-truth).abs().mean().item()
                    row = dict(sample=ti, input_start=date_labels[starts[ti]],
                               forecast_start=date_labels[starts[ti]+window], u=u, v=v,
                               relation=f'{COUNTRIES[u]} -- {COUNTRIES[v]}',
                               weight=graph[u,v].item(), baseline_mae=baseline_mae,
                               after_mae=mae, delta_mae=mae-baseline_mae,
                               relative_percent=100*(mae-baseline_mae)/baseline_mae)
                    local.append(row)
                    operands[f'prediction_{ti}_{u}_{v}'] = after_raw.numpy()
            records.extend(local)
            # Independent boundary: reproduce only the native graph-to-support preparation,
            # then use unchanged original forward / stock blocks for the strongest response.
            largest = max(local, key=lambda r: abs(r['delta_mae']))
            u, v = largest['u'], largest['v']
            native_latent = model.latent_correlation_layer
            native_cheb = model.cheb_polynomial
            expected = {}

            def reference(this, value):
                hidden, _ = this.GRU(value.permute(2,0,1).contiguous())
                attention = this.self_graph_attention(hidden.permute(1,0,2).contiguous()).mean(0)
                attention[u,v] = attention[v,u] = 0
                degree = attention.sum(1)
                symmetric = .5*(attention+attention.T)
                inv = torch.diag(1/(torch.sqrt(degree)+1e-7))
                laplacian = inv @ ((torch.diag(degree)-symmetric) @ inv)
                support = native_cheb(laplacian)
                expected['support'] = support
                return support, symmetric

            model.latent_correlation_layer = types.MethodType(reference, model)
            independent, _ = model(x)
            model.latent_correlation_layer = native_latent
            observed = []
            def consumed(m, args):
                observed.append(args[1].clone())
            checks = [block.register_forward_pre_hook(consumed) for block in model.stock_block]
            def selected_mask(m, args, output):
                result = output.clone()
                result[:,u,v] = result[:,v,u] = 0
                return result
            hook = model.dropout.register_forward_hook(selected_mask)
            actual, _ = model(x)
            hook.remove()
            for h in checks:
                h.remove()
            err = (independent-actual).abs().max().item()
            reference_max = max(reference_max, err)
            assert torch.equal(independent, actual)
            assert len(observed) == 2 and all(torch.equal(s,expected['support']) for s in observed)
            selected_cases.append(largest)
            print('Screened sample', ti, '300 undirected relations; strongest', largest['relative_percent'], flush=True)
    pairs = []
    for ti in indices:
        local = [r for r in records if r['sample']==ti]
        for a in local:
            for b in local:
                # Require appreciable B response and a non-tiny A denominator for ranking.
                if a['weight']>b['weight'] and 0<a['relative_percent']<b['relative_percent'] and a['relative_percent']>=.001 and b['relative_percent']>=.1:
                    wr, dr = a['weight']/b['weight'], b['delta_mae']/a['delta_mae']
                    if wr>=1.5 and dr>=10:
                        pairs.append({'A':a,'B':b,'weight_ratio':wr,'response_ratio':dr})
    pairs.sort(key=lambda p: p['B']['relative_percent'], reverse=True)
    delta = np.array([r['delta_mae'] for r in records])
    pct = np.array([r['relative_percent'] for r in records])
    raw_path = OUT / 'operands.npz'
    np.savez_compressed(raw_path, **operands)
    result = dict(model='StemGNN', dataset='JHU COVID-19 daily confirmed, 25 countries, 2020',
                  status='Exploratory trained candidate screen; not official pretrained weights or paper benchmark reproduction',
                  provenance=provenance, runtime={'torch':torch.__version__, 'numpy':np.__version__},
                  fft_compatibility=substitutions, model_source_sha256=sha(compat_path),
                  data_sha256=sha(OUT/'covid25_daily_2020.csv'), countries=COUNTRIES,
                  date_range=[date_labels[0],date_labels[-1]], negative_corrections=int((daily<0).sum()),
                  split={'train_rows':cut1,'validation_rows':cut2-cut1,'test_rows':n-cut2,
                         'train_windows':len(train_x),'validation_windows':len(valid_x),'test_windows':len(test_x)},
                  training={'seed':0,'epochs':60,'optimizer':'Adam','lr':.001,'batch_size':32,'multi_layer':1,
                            'window':window,'horizon':horizon,'checkpoint_epoch':saved['epoch'],
                            'checkpoint_selection':'minimum raw validation MAE, batch size 1',
                            'scaler_fit':'train only','history':history},
                  checkpoint_sha256=sha(checkpoint), operands_sha256=sha(raw_path),
                  intervention='Both pre-symmetrization attention entries zeroed at dropout output; native degree, symmetrization, Laplacian, Chebyshev and forward preserved; no extra row normalization',
                  inference_batch_size=1, samples=indices, relation_count=300, run_count=len(records),
                  baseline_mae_mean=float(np.mean(baseline_scores)), persistence_mae_mean=float(np.mean(persistence_scores)),
                  identity_max_abs=identity_max, independent_reference_max_abs=reference_max,
                  consumed_support_check='Exact equality in both stock blocks for largest-response relation in each sampled window',
                  delta_mae_quantiles=dict(zip(['min','p10','median','p90','max'],np.quantile(delta,[0,.1,.5,.9,1]).tolist())),
                  abs_relative_percent_quantiles=dict(zip(['min','p10','median','p90','max'],np.quantile(abs(pct),[0,.1,.5,.9,1]).tolist())),
                  fraction_abs_response_above_point1_percent=float(np.mean(abs(pct)>.1)),
                  inversion_pair_count=len(pairs), top_pairs=pairs[:10], strongest_by_sample=selected_cases)
    (OUT/'records.json').write_text(json.dumps(records,indent=2))
    (OUT/'report.json').write_text(json.dumps(result,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k not in ['provenance','training','top_pairs','strongest_by_sample']},indent=2))
    print('TOP PAIR',json.dumps(pairs[:1]))


if __name__ == '__main__':
    main()
