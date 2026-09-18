# DGraInsight Offline Evaluator

This folder contains the complete current offline workflow described by the paper: connect a fixed pretrained graph forecasting model, inspect its native relation contexts, remove a selected relation at the model's real computation point, rerun the model, and export before/after MAE and MSE as `evaluation.v1`.

No model, dataset or checkpoint is downloaded or trained by this application.

## Windows quick start

1. Keep this folder together after extraction.
2. Double-click `Start-Evaluation.cmd`.
3. Select DGraFormer, MSGNet, MTGNN, or an external Thin Adapter.
4. Provide the local model source directory, dataset file and checkpoint file.
5. Select test sample IDs and either all non-self relations or explicit relations.
6. Where supported, choose one native context or all relevant contexts.
7. Confirm the generated plan and start evaluation.
8. Import `runs/<timestamp>/manifest.json` through **Import Evaluation Results** on the website.

The launcher searches for Python 3.10+ with PyTorch and NumPy. Set `DGRAINSIGHT_PYTHON` to a compatible `python.exe` if automatic detection does not find your environment.

## Removal semantics

- Every removal starts from the original relation graph; removals are not cumulative.
- `single` removes the declared relation in exactly one native window, scale or global graph.
- `all` removes the same relation from every relevant native context in one run when the adapter declares that capability.
- The same checkpoint and sample are used before and after removal.
- Identity replay must match the unmodified baseline before removals are accepted.
- MAE and MSE are computed against the same ground truth in the declared measurement space.

The 0.1% threshold used by the website is a descriptive display threshold, not a statistical test.

## Folder layout

| Path | Purpose |
|---|---|
| `offline.py` | Guided local workflow |
| `dgraudit/` | Current evaluator engine and maintained model plugins |
| `profiles/` | DGraFormer, MSGNet and MTGNN reference profiles |
| `adapters/template.py` | Thin Adapter starter |
| `examples/stemgnn/` | Paper-aligned external StemGNN adapter example |
| `docs/` | Developer API, development and release notes |
| `build.py` | Current-only release packager |

There are no retired pre-paper modules in this folder or in its generated release package. Historical material is kept separately under the repository's `legacy/` directory.

## External models

Read [`ADAPTER_GUIDE.md`](ADAPTER_GUIDE.md), copy `adapters/template.py`, and implement the six Thin Adapter methods against the original model. The evaluator does not accept fictional graph data or silently substitute samples. See [`examples/stemgnn/`](examples/stemgnn/README.md) for the external model used in the paper demonstration.

## Command-line use

From this folder:

```bash
python -m dgraudit plugins
python -m dgraudit preflight --config profiles/dgraformer.json
python -m dgraudit evaluate --config profiles/dgraformer.json --output runs/example/manifest.json
```

Reference profile paths are placeholders and must be changed to resources that match the selected checkpoint.
