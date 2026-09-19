# Reproducibility

## Website and stored-result checks

Install the JavaScript dependencies and run the deterministic data/logic tests:

```bash
npm ci
npm test
npm run build
```

The test suite validates graph semantics, `performance.v1`, `evaluation.v1`, relation selection, the 0.1% descriptive classification rule, forecast-step profiles and cross-sample summaries.

Install the Playwright Chromium runtime once, then run the browser regressions
through the cross-platform test server:

```bash
npm run test:web-install
npm run test:web
```

The browser reads stored results. These tests verify presentation and contract consistency; they do not rerun neural checkpoints.

## Offline Evaluator checks

The current Python package is self-contained under `offline_app/`:

```bash
python -m pip install -r offline_app/requirements-core.txt
python -m unittest discover -s tests -p "test_*.py"
python offline_app/build.py outputs/release/DGraInsight-Offline-Evaluator
```

The [resource manifest](../offline_app/docs/RESOURCE_MANIFEST.md) lists the
checkpoint, dataset, source-file and raw-array identities used by the built-in
results. It also states which resources are included and which must be supplied
locally. The pinned file is the evaluator's tested CPU baseline, not a universal
dependency lock for every upstream forecasting model.

The pinned CPU requirements support Python 3.10 or 3.11. Maintained plugins
require an environment compatible with the selected original model and its
checkpoint; a different Python version is acceptable only when that complete
model environment already provides compatible PyTorch and NumPy versions. The
Windows launcher does not install dependencies, download source, train a model
or substitute missing resources.

Before executing removals, the evaluator checks adapter loading, explicit sample loading, baseline prediction, relation extraction, identity intervention and an actual edge intervention. `evaluation.v1` stores resource hashes and declared provenance. Correct placement of a native intervention remains model-specific and must be verified by the adapter implementation.

## Built-in data

- `public/data/performance/v1/dgraformer.json` and `msgnet.json` are the website's paper-facing built-in results.
- Raw-array verification assets are under `artifacts/performance/v1/`.
- Exact fixed checkpoints and datasets are under `paper_resources/`, with
  SHA-256 identities in `paper_resources/manifest.json`.
- `python scripts/verify_performance_v1.py` recomputes stored metrics from those arrays.
- [`RESULT_AUTHENTICITY.md`](RESULT_AUTHENTICITY.md) explains the evidence chain
  and the exact boundary between stored-result verification and a fresh model run.

## External StemGNN example

The current example adapter and its declared resources are documented in [`offline_app/examples/stemgnn/`](../offline_app/examples/stemgnn/README.md). It uses the pinned Microsoft StemGNN source, a locally trained checkpoint and processed JHU COVID-19 daily counts. The adapter preserves StemGNN's native graph-to-spectral computation and masks both directions of the selected undirected relation before rerunning the model.

The exact example checkpoint and processed dataset are bundled in
`paper_resources/`. A fresh run still requires the pinned Microsoft StemGNN
source revision and its model-specific Python environment.

## Historical material

Retired pre-paper implementations and notes are isolated under `legacy/`. They are preserved for provenance only, excluded from current release packaging, and should not be used to describe the submitted system.
