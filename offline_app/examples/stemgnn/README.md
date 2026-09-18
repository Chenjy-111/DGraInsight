# StemGNN Thin Adapter example

This is the external-model example described in the DGraInsight paper. It connects the pinned Microsoft StemGNN source to the generic Offline Evaluator without adding a StemGNN-specific branch to the evaluator core.

## Declared experiment

- Model: StemGNN, source revision `dc7dea6842c20c5dcece2f18b435e26770b3421c`.
- Data: JHU COVID-19 daily confirmed cases for 25 countries.
- Input and forecast horizon: 28 days each.
- Checkpoint: locally trained fixed checkpoint declared by SHA-256 in `example_config.json`.
- Relation: the symmetric latent-correlation entry consumed by the native StemGNN graph-to-spectral computation.
- Removal: mask both directions of the selected undirected relation, preserve the original operation order, and rerun both StockBlocks.
- Measurement: MAE/MSE after reversing the training-only normalization, aggregated over 28 forecast steps and 25 outputs.

On test sample 9, the paper's `US — France` example reports a 4.69% MAE degradation and an 11.38% MSE degradation after removal. These are descriptive fixed-checkpoint results, not causal claims about countries.

## Files

- `stemgnn.py`: six-method Thin Adapter with native graph-state checks.
- `example_config.json`: resource identities and the paper's sample-9 requests.
- `screen_stemgnn.py` and `verify_stemgnn_screen.py`: experiment-generation and independent verification utilities. These require the exact local sources, data, checkpoint and archived output operands; they are not run by the generic evaluator.

Update only resource paths when the files retain the declared hashes. If the source, dataset or checkpoint differs, record the new identity and do not attribute the paper's numerical results to that run.
