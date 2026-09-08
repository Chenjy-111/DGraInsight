# Built-in performance results

The website loads `public/data/performance/v1/dgraformer.json` and `msgnet.json`, once per model, through `src/data/performance.ts`. These assets use the `performance.v1` contract and are independent of Session v2 control/inference results.

## Stored experiments

| Model | Baseline samples | Removal predictions | Graph contexts |
|---|---:|---:|---|
| DGraFormer | 44 | 3,073 | Effective native windows |
| MSGNet | 18 | 3,024 | Native scale indices |

Raw arrays are in `artifacts/performance/v1/*_raw.npz`. The JSON `rawArchive` records the archive SHA-256 and array ordering: predictions follow records; baselines and truth follow samples. Source, checkpoint, dataset and runtime identities are recorded in the assets. Do not overwrite them when running a different experiment.

## Display semantics

Select a relation before reading its Summary. Samples, graph contexts, removal scopes and highlighted edges remain synchronized. Only effective contexts are offered for the selected relation; an invalid selection is cleared instead of silently replaced. MSGNet scale indices are not time windows, and its G0–G6 graph nodes are latent positions rather than named sensor outputs.

The default **By forecast step** line chart averages output errors at each step of the selected sample. **Across test samples** averages all steps and outputs within each declared sample. Missing removals remain gaps. MAE and MSE are calculated separately; changing the view does not change stored predictions.

Signed change is `after - before`: negative/green is improved and positive/red is degraded. Improvement percentage is `(before - after) / before`; a zero baseline has no percentage. The inclusive `0.001 * baseline` threshold labels small changes descriptively, without changing their values or establishing significance. Aggregate raw errors first, then classify the aggregate.

## Verification

```bash
python scripts/verify_performance_v1.py
npm run test:performance
npm run test:web-graph-regression
```

The verifier recomputes metrics from the raw archives and checks their hashes. [Reproducibility](REPRODUCIBILITY.md) separates this check from live checkpoint execution and lists browser tests.

The independent performance runs do not turn the archived MSGNet replay result into PASS. See [scientific semantics and replay limits](SCIENTIFIC_SEMANTICS_REPAIR.md).
