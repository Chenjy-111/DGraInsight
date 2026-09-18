# Offline Evaluator development

All maintained offline source is under `offline_app/`. Do not add current evaluator code, profiles or documentation elsewhere in the repository.

Run current checks from the repository root:

```bash
python -m unittest discover -s tests -p test_offline_distribution.py
python -m unittest discover -s tests -p test_evaluation.py
python -m unittest discover -s tests -p test_thin_adapter.py
node tests/evaluationRegression.mjs
npm run build
```

Build a release with:

```bash
python offline_app/build.py outputs/release/DGraInsight-Offline-Evaluator --zip
```

The builder uses an explicit current-file allowlist. It excludes environments, logs, runs, model source, datasets, checkpoints, experiment scripts and the repository's `legacy/` directory.

Publish a new `offline-v*` tag rather than replacing an existing release tag. The release workflow tests the current runtime, creates one evaluator ZIP and writes its SHA-256 checksum.
