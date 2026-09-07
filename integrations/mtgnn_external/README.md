# MTGNN external evaluation backend

MTGNN now uses Offline Edge-Removal Evaluation: baseline and removal MAE/MSE,
forecast arrays and descriptive sample comparisons. It does not compute matched
controls, D or p/q values in the new workflow.

1. Prepare MTGNN source, an architecture-matching checkpoint and its native numeric dataset.
2. Set source_root, checkpoint, dataset and adapter_config in
   `configs/evaluation_mtgnn_external.json`.
3. Run from the repository root:

```bash
python -m dgraudit evaluate --config configs/evaluation_mtgnn_external.json --output outputs/mtgnn_external_evaluation.json
python -m dgraudit validate-results outputs/mtgnn_external_evaluation.json
```

Click **Import Evaluation Results** and choose that output file. The native graph is
interactive; select any stored removal and inspect its errors and forecasts. The
maintained direct plugin uses `configs/evaluation_mtgnn.json` and the same calculation.

Canonical arrows follow the first native message-passing branch: source to target maps
to native [target,source]. The shared adjacency also drives the transpose branch, so
removing the relation affects the reverse channel there. Native self-loops and mixprop
normalization remain in place. MTGNN exposes one global graph and no broader-context
option. Its reference checkpoint emits one output step at forecast lead 3.

`evaluation_backend.py` is the new external factory. `mtgnn_external_adapter.py` and
`configs/custom_adapter_mtgnn_exchange.json` remain legacy Session v2 integrations for
historical reproduction; their row/column edge ids must not be interpreted as new
canonical directions. Generate new results from the model rather than reusing old
control responses as performance data.

See [the complete Evaluation guide](../../docs/EVALUATION_GUIDE.md) for callback functions,
metadata, result format, resume and native verification. Original model code and weights
are not redistributed as part of the evaluation backend.
