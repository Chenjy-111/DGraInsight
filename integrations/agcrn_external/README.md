# AGCRN external Thin Adapter study

This is the previously unsupported model integration study. MTGNN remains an already
integrated reference plugin. AGCRN uses the same frozen Thin Adapter, runner, evaluator,
schema and generic Web without model-specific core changes.

## Use your local resources

Download the separate [AGCRN-Adapter.zip](https://github.com/Chenjy-111/DGraInsight/releases/latest/download/AGCRN-Adapter.zip) and follow the [local guide](LOCAL_ADAPTER_GUIDE.md). Select **Connect another model** in the evaluator. The pinned download/training commands below are only for reproducing the original integration study.

## Reproduce

Use Python >=3.10 with PyTorch and NumPy (actual versions/hashes are in evidence provenance).
From the repository root:

```powershell
python integrations/agcrn_external/prepare.py
python -m dgrainsight validate configs/evaluation_agcrn_external.json --output outputs/agcrn_preflight.json
python -m dgrainsight run configs/evaluation_agcrn_external.json --output outputs/agcrn/manifest.json
```

Import `outputs/agcrn/manifest.json` with **Import Evaluation Results**. The already-run,
independently verified result is `public/data/evaluation/agcrn.json`.
The first command clones the pinned official source if missing, applies only the supplied
small patch, downloads the official-referenced real dataset, and checks data/checkpoint hashes.
It refuses a conflicting source revision or patch rather than overwriting local edits.
The included 13,624-byte checkpoint was genuinely trained by the official Run.py on PeMSD8.
It is a one-epoch, small-configuration integration example, not an official pretrained
checkpoint or a claim of paper-level benchmark performance.

To repeat the actual training, run `python integrations/agcrn_external/train_native.py`.
The original Trainer writes a new checkpoint beneath its dated experiments directory;
it does not replace the frozen study checkpoint. Record the new checkpoint hash in a new
config before evaluating it. Native log is retained as `training_run.txt`.

For independent validation of the committed study result:

```powershell
python integrations/agcrn_external/verify_native.py
```

This checks pristine upstream forward equivalence, every consumed native einsum support,
and all nine stored intervention predictions. It annotates only verification metadata in
the study JSON, never its predictions/metrics. The default generic run reports native graph
state checks separately from this stronger independent comparison.

## Supported semantics

Local exported source folders (including ZIP downloads) do not need `.git` or a
provenance declaration to load. The adapter records `sourceRevision: null` and
`sourceRevisionStatus: "unavailable"` when Git metadata cannot be read, while still
hashing the actual Python source files, dataset and checkpoint. A containing
repository's revision is never used for an exported model directory. Native
intervention hooks and matching model resources remain required. `prepare.py` is
the separate pinned-download workflow and still requires Git.

Single context `encoder:0` includes gate and update convolutions at every encoder timestep.
Canonical source->target is native `[target,source]`. Zero that softmax-normalized support
entry, then normalize its row. The native Chebyshev identity term is preserved. Deletion
therefore removes an explicit learned support entry while changing the relative contribution
of the remaining row; it does not eliminate every multihop or recurrent route.
The adapter does not expose isolated-gate, all-context, or vectorized batch operations.
Three samples are orchestrated sequentially by the generic runner.

The original data loader fits scaling on the entire dataset before splitting. This is
preserved and disclosed for original-code consistency. Treat the run as an integration
study, not an independent leakage-free forecasting benchmark. Learned edges are model
computation relations, not road connections or real-world causal findings.

See [the integration validation study](../../docs/EXTERNAL_MODEL_ADAPTER_VALIDATION.md) for numerical results, limitations and
`BEFORE_EXTERNAL_MODEL` core-zero-change evidence.

The core-freeze report describes commit `82b3caa` against `7c25aef`; its file paths and hashes are historical evidence, not a requirement that later cleanups retain unused files.
