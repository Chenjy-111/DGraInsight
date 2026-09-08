# AGCRN external adapter demonstration

This is a separately prepared adapter, not a built-in model choice. It demonstrates
connecting a new model through the generic evaluator without changing the core.
The adapter is written in advance; the tool does not automatically understand models.

1. Start **DGraInsight Offline Evaluator** with `Start-Evaluation.cmd`.
2. Select **4: Connect another model**.
3. Choose this folder's `agcrn.py`; accept the proposed class `AGCRNAdapter`.
4. Enter your local AGCRN source folder, PeMSD8 NPZ and checkpoint.
5. Choose samples, all non-self edges or selected edges, then validate and run.
6. Import the generated `manifest.json` in the website.

The optional `prepare_resources` function in this adapter creates a local experiment
copy, adds the two-line native graph hook and copies the selected data. The original
files are preserved. No Git, network, download or training is needed. Unknown hook
structure is rejected rather than guessed. The generic evaluator invokes this same
optional preparation contract for any external adapter.

This adapter supports the documented small AGCRN checkpoint architecture only:
170 nodes, input/output dim 1, lag/horizon 3, hidden 8, embedding 4, one layer, Chebyshev
order 2. Different architectures need matching model loading logic. It retains the
upstream scaler fit before splitting, and is not a leakage-free paper benchmark.
It removes support[target,source], renormalizes the row and preserves the identity
term, affecting gate and update computations across the encoder timesteps.

`load`, `load_sample`, `predict`, `get_contexts`, `get_relations`, and
`predict_with_intervention` implement the six-method Thin Adapter interface.
