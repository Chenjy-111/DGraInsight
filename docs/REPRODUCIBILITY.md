# Reproducibility

## Website and stored-result checks

Install the JavaScript dependencies and run the deterministic data/logic tests:

```bash
npm ci
npm test
npm run build
```

The test suite validates graph semantics, `performance.v1`, `evaluation.v1`, relation selection, the 0.1% descriptive classification rule, forecast-step profiles and cross-sample summaries.

Browser regressions require a local preview plus Playwright:

```bash
npm run dev -- --host 127.0.0.1 --port 5181
npm run test:web-graph
npm run test:web-performance
npm run test:web-evaluation
```

The browser reads stored results. These tests verify presentation and contract consistency; they do not rerun neural checkpoints.

## Offline Evaluator checks

The current Python package is self-contained under `offline_app/`:

```bash
python -m unittest discover -s tests -p "test_*.py"
python offline_app/build.py outputs/release/DGraInsight-Offline-Evaluator
```

Maintained plugins require an environment compatible with the selected original model and its checkpoint. The Windows launcher looks for Python 3.10 or later with PyTorch and NumPy. It does not install dependencies, download source, train a model or substitute missing resources.

Before executing removals, the evaluator checks adapter loading, explicit sample loading, baseline prediction, relation extraction, identity intervention and an actual edge intervention. `evaluation.v1` stores resource hashes and declared provenance. Correct placement of a native intervention remains model-specific and must be verified by the adapter implementation.

## Built-in data

- `public/data/performance/v1/dgraformer.json` and `msgnet.json` are the website's paper-facing built-in results.
- Raw-array verification assets are under `artifacts/performance/v1/`.
- `python scripts/verify_performance_v1.py` recomputes stored metrics from those arrays.

## External StemGNN example

The current example adapter and its declared resources are documented in [`offline_app/examples/stemgnn/`](../offline_app/examples/stemgnn/README.md). It uses the pinned Microsoft StemGNN source, a locally trained checkpoint and processed JHU COVID-19 daily counts. The adapter preserves StemGNN's native graph-to-spectral computation and masks both directions of the selected undirected relation before rerunning the model.

Large third-party model sources, datasets and checkpoints are not bundled in the repository release. Reproduction therefore requires the exact local resources whose hashes are declared in the example configuration.

## Historical material

Retired pre-paper implementations and notes are isolated under `legacy/`. They are preserved for provenance only, excluded from current release packaging, and should not be used to describe the submitted system.
