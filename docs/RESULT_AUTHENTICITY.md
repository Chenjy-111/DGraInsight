# Result authenticity and verification boundary

This repository provides a reviewer-verifiable evidence chain for the
paper-facing DGraFormer and MSGNet results. The exact fixed checkpoints and
datasets are distributed under `paper_resources/` with a machine-verifiable
SHA-256 manifest.

## What is independently verifiable

The tracked NPZ archives contain the ground truth, unmodified baseline
predictions and post-removal predictions used by the website. The public
`performance.v1` files separately contain the displayed MAE/MSE series, model
configuration, checkpoint and dataset hashes, runtime versions, source-file
hashes, sample identities, graph contexts and removal identities.

Run from the repository root:

```bash
python scripts/verify_performance_v1.py
```

The verifier first checks the SHA-256 identity of each raw archive. It then
recomputes every MAE and MSE value directly from prediction minus ground truth
and requires exact array equality with the public JSON. The tracked verification
summary reports:

| Model | Baselines | Relation removals | Recomputed error values | Result |
|---|---:|---:|---:|---|
| DGraFormer | 44 | 3,073 | 598,464 | exact equality |
| MSGNet | 18 | 3,024 | 584,064 | exact equality |

The evaluator additionally requires identity replay through the same graph
override path before accepting removal runs. The public result files record
`nativeIdentityCheck: PASS: exact equality for every sample`. Model, dataset,
checkpoint, source and raw-archive hashes prevent a different local resource
from being silently represented as the paper run.

## What the evidence establishes

These checks establish that the website's displayed numbers are deterministic
functions of the tracked raw predictions, that the raw archives have the
declared identities, and that the stored records carry the declared execution
provenance. The checked-in adapter and intervention code allows reviewers to
inspect where native relations are removed and how predictions are generated.

## Checkpoint-backed reproduction boundary

The exact checkpoints and datasets are included and match the hashes in the
[resource manifest](../offline_app/docs/RESOURCE_MANIFEST.md). Reviewers can
verify their integrity with `python -m unittest tests.test_paper_resources`.
Original upstream model source trees and model-specific environments are not
duplicated, so a fresh checkpoint-backed forward pass additionally requires the
pinned upstream revisions documented by the maintained adapters.

The legacy `historicalReplay` field compares a current result with a retired
pre-paper capture. It is not part of the current raw-array verification gate.
In particular, the MSGNet value `FAIL` records that the retired capture is not
treated as interchangeable after the model-semantics correction; the current
MSGNet raw archive, metric recomputation and native identity check all pass.
This distinction is retained rather than hidden so reviewers can see the
provenance boundary.

No collection of committed files can by itself cryptographically prove where a
private computation was performed. The repository therefore makes the narrower,
testable claim above and exposes the raw operands, hashes, code and validation
logic needed to audit it.
