# Development and releases

## Current offline system

The only recommended user entry point is `Start-Evaluation.cmd` inside the release ZIP.
`offline_app/` is application source, not a complete standalone package: use the builder to include the engine and reference profiles.
The `python -m dgrainsight` and `python -m dgraudit` commands are developer interfaces for current evaluation configs.

The maintained model specifications live in `dgraudit/model_specs.py`. Both repository execution and release packages import this file directly.
Historical Session v2 validators and reproduction modules are retained for existing evidence, but are outside the release allowlist.

## Check changes

Use a Python environment with PyTorch and NumPy:

```powershell
python -m unittest discover -s tests -p test_offline_distribution.py
python -m unittest discover -s tests -p test_agcrn_source_revision.py
python -m unittest discover -s tests -p test_evaluation.py
python -m unittest discover -s tests -p test_thin_adapter.py
node tests/evaluationRegression.mjs
npm run build
```

## Publish a release

Commit the maintained source and push a version tag such as `offline-v1.0.0`.
The Offline Release workflow tests the runtime, builds the evaluator and separate external example ZIPs,
writes SHA256SUMS.txt, and attaches them to a GitHub Release. GitHub authentication stays inside Actions.
The README's latest-download links keep working when a newer release is published.
Never include local Python environments, python-path.txt, runs, logs, model data or checkpoints.
Do not overwrite an existing version tag; publish a new version for changes.
