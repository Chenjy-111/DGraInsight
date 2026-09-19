# DGraInsight

DGraInsight is an interactive system for analyzing how removing a learned relation changes the forecast errors of a fixed graph time-series forecasting model. It exposes architecture-specific graph contexts, reruns the same checkpoint after an explicit native relation removal, and compares the before/after MAE and MSE.

[Open the live demo](https://chenjy-111.github.io/DGraInsight/) · [Reviewer guide](docs/REVIEWER_GUIDE.md) · [Result authenticity](docs/RESULT_AUTHENTICITY.md) · [Reproducibility](docs/REPRODUCIBILITY.md) · [Resource manifest](offline_app/docs/RESOURCE_MANIFEST.md) · [Offline Evaluator](offline_app/README.md)

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
| `paper_resources/` | Exact fixed checkpoints and datasets, with a machine-verifiable SHA-256 manifest |
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

## Verifying the published results

The repository includes the exact paper checkpoints and datasets under
[`paper_resources/`](paper_resources/README.md), identified by the same SHA-256
values recorded in the public results. It also tracks the raw baseline,
ground-truth and post-removal prediction arrays used by the paper-facing
DGraFormer and MSGNet results. Run:

```bash
python scripts/verify_performance_v1.py
python -m unittest tests.test_paper_resources
```

The verifier checks each archive's SHA-256 identity and recomputes every stored
MAE/MSE value with exact equality. See the [result-authenticity evidence](docs/RESULT_AUTHENTICITY.md)
for the complete provenance chain and its limitations.

## License

DGraInsight's original source code is released under the [MIT License](LICENSE).
Third-party models, datasets, checkpoints, learned weights, dependencies and
third-party-derived artifacts remain subject to their respective licenses and
terms. The MIT License does not grant rights to those external materials.

## Paper alignment

The paper is the authority for the public system description. Current documentation uses the same scope: explicit relation removal, fixed-checkpoint re-execution, MAE/MSE comparison, model-specific native contexts, descriptive cross-sample consistency, and external integration through a Thin Adapter. Retired pre-paper material is isolated under `legacy/` and is not loaded by the current application or packaged in the Offline Evaluator.
