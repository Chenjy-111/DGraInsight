# DGraInsight

DGraInsight is an interactive system for analyzing how removing a learned relation changes the forecast errors of a fixed graph time-series forecasting model. It exposes architecture-specific graph contexts, reruns the same checkpoint after an explicit native relation removal, and compares the before/after MAE and MSE.

[Open the live demo](https://chenjy-111.github.io/DGraInsight/) · [Reviewer guide](docs/REVIEWER_GUIDE.md) · [Reproducibility](docs/REPRODUCIBILITY.md) · [Resource manifest](offline_app/docs/RESOURCE_MANIFEST.md) · [Offline Evaluator](offline_app/README.md)

## What the demo contains

- Built-in interactive results for DGraFormer and MSGNet on ETTh1.
- Single-context and all-relevant-context relation-removal results where the model supports both scopes.
- Forecast-step and cross-sample views. The 0.1% baseline-relative threshold is descriptive, not a significance test.
- A portable `evaluation.v1` result format that can be imported without rerunning a model in the browser.
- Maintained offline adapters for DGraFormer, MSGNet and MTGNN, plus a Thin Adapter interface for external models.
- A StemGNN external-adapter example on JHU COVID-19 data, matching the external-model case described in the paper.

Learned relations describe model computation. They do not establish real-world causal relationships.

## Offline Evaluator

All current offline code, profiles, documentation and examples live under [`offline_app/`](offline_app/README.md). On Windows, extract the release and double-click `Start-Evaluation.cmd`. The evaluator uses only local model source, checkpoint and dataset paths; it does not download or train a model.

The generated `runs/<timestamp>/manifest.json` is an `evaluation.v1` result that can be imported into the website.

For development builds:

```bash
python offline_app/build.py outputs/release/DGraInsight-Offline-Evaluator --zip
```

## Repository map

| Path | Purpose |
|---|---|
| `src/` | React/TypeScript interactive website |
| `public/data/performance/v1/` | Built-in DGraFormer and MSGNet relation-removal results |
| `offline_app/` | Current Offline Evaluator, engine, profiles, docs and adapter examples |
| `tests/` | Current web and evaluator regression tests |
| `legacy/` | Clearly separated pre-paper and retired implementations; not part of the current system |

## Development

```bash
npm ci
npm test
npm run build
python -m unittest discover -s tests -p "test_*.py"
```

See [the reproducibility guide](docs/REPRODUCIBILITY.md) for the focused checks and environment boundaries.

## Paper alignment

The paper is the authority for the public system description. Current documentation uses the same scope: explicit relation removal, fixed-checkpoint re-execution, MAE/MSE comparison, model-specific native contexts, descriptive cross-sample consistency, and external integration through a Thin Adapter. Retired pre-paper material is isolated under `legacy/` and is not loaded by the current application or packaged in the Offline Evaluator.

An explicit repository license has not yet been added. Upstream model, dataset and dependency terms still apply.
