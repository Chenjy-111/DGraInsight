# Native graph semantics

Graph views follow executed model tensors. Source-to-target arrows denote message flow in the named model; they do not establish real-world causality.

## DGraFormer

`Graph_constructor.forward` blends a static prior with a learned matrix, applies ReLU/tanh and diagonal removal, selects global Top-K entries, adds self-loops and normalizes rows. Top-K is over flattened matrix positions, not a separate per-node neighbor selection. The blend depends on `current_epoch`; the loader checks the published ETTh1 parameter identity (`currentEpochEquivalent = 5`) against its performance run.

The canonical `sparse_graph` records the final graph used for message passing. The current loader checks effective edges and weights against the matching performance contexts. It must not apply an additional display Top-K and call that the executed graph. Window-specific parameters are not evidence that the learned matrices themselves are sample-conditioned.

DGraFormer native adjacency uses `[source, target]`. Removing an edge changes the declared native graph before subsequent model computation and normalization; the resulting forecast must come from a model execution.

## MSGNet

Native adjacency uses `[target, source]`; exported graph arrows use canonical source-to-target fields. G0–G6 are latent positions after embedding and convolution, not the seven named forecast variables. `scale_index` is a model scale index, not a contiguous segment of the input timeline.

Removal is injected into the declared scale graph. Native self-loop handling and normalization remain part of execution, and its effects can propagate to later blocks. A single-scale intervention describes its injection site, not isolation of all downstream computation.

## MTGNN and external models

MTGNN has a global learned graph. Its canonical direction follows the first native message-passing branch, while the shared adjacency also feeds a transpose branch. See [MTGNN semantics](../integrations/mtgnn_external/README.md) and [AGCRN native validation](EXTERNAL_MODEL_ADAPTER_VALIDATION.md).

External adapters must declare graph node meanings, native index direction, supported contexts and the exact removal operation. Graph node count need not equal forecast output count. See [the adapter contract](EVALUATION_GUIDE.md#i-have-a-new-graph-forecasting-model).

## Verification

`tests/webGraphRegression.mjs` checks committed graph identities; it is not a fresh model execution. Recorded native replay results, including the MSGNet historical failure, are described in [scientific verification](SCIENTIFIC_SEMANTICS_REPAIR.md). Follow [reproducibility](REPRODUCIBILITY.md) for separate interface, array and checkpoint checks.
