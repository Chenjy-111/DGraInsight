# Offline evaluation core

For current usage, read the [Evaluation guide](../docs/EVALUATION_GUIDE.md) and [reproducibility instructions](../docs/REPRODUCIBILITY.md).

| Module | Responsibility |
|---|---|
| `evaluation.py` | Run backends, resume experiments and write results |
| `evaluation_validation.py` | Validate identities, dimensions and numerical consistency |
| `evaluation_plugins.py` | Function and maintained model backends |
| `thin_adapter.py` | External six-method adapter contract and preflight |
| `adapters.py`, `msgnet_semantics.py` | Shared native model loading and graph semantics |

The current output format is `evaluation.v1`. The `dgrainsight` CLI delegates to this core. Modules under `v2/` and the audit commands support retained Session v2 files and regression checks; their controls and inference are separate from current evaluation. See [compatibility](../docs/AUDIT_SESSION_V2.md).
