# Reproducibility

Run commands from the repository root. Distinguish interface checks, recomputation of stored arrays, and fresh model execution: passing one does not prove the others.

## 1. Build and validate the interface

Use Node.js 20 or newer:

```bash
npm ci
npm run build
npm run test:web-graph-regression
npm run test:session-v2-validator
node tests/sessionV2WebRegression.mjs
npm run test:performance
node tests/evaluationRegression.mjs
```

Graph regression compares the committed DGraFormer, MSGNet and MTGNN graph fixtures. The other checks cover result validation and performance calculations. Test fixtures demonstrate the contracts; they are not additional scientific experiments.

## 2. Check browser interactions

Install Playwright in a test environment with Microsoft Edge available. Start `npm run preview -- --port 5181`, then run:

```bash
npm run test:evaluation-browser
npm run test:performance-browser
```

The tests default to `http://127.0.0.1:5181/DGraInsight/`. Set `PERFORMANCE_URL` for another preview address and `PLAYWRIGHT_MODULE` if Playwright is installed outside this project. Tests cover edge selection, model/sample/context switching, MAE/MSE, imports, invalid and partial results, chart rendering and restoration of the built-in demo.

## 3. Recompute stored results

Use Python with NumPy:

```bash
python scripts/verify_performance_v1.py
python -m unittest discover -s tests -p test_evaluation.py
python -m unittest discover -s tests -p test_thin_adapter.py
```

The performance verifier reads `artifacts/performance/v1/*_raw.npz`, checks archive hashes and compares the published metrics with calculations from those arrays. Read the resulting `artifacts/performance/v1/verification.json`; a metric match is not a fresh checkpoint replay.

`requirements.txt` pins the earlier Python 3.9 scientific environment. Do not install those pins blindly into newer Python versions. Live adapters and the AGCRN study require a compatible original-model environment (AGCRN: Python 3.10+). Use the runtime versions recorded with each result when reproducing that experiment.

## 4. Execute original models

Obtain the original model source, matching checkpoint and dataset. Configure local paths using [the Evaluation guide](EVALUATION_GUIDE.md). Maintain source revisions, hashes, split, normalization, sample identities and intervention scope.

To regenerate the built-in performance experiments, execute each model in a separate process to avoid collisions between upstream packages:

```bash
python scripts/export_performance_v1.py --model dgraformer --source-root <source> --checkpoint <checkpoint.pth> --data-path <ETTh1.csv>
python scripts/export_performance_v1.py --model msgnet --source-root <source> --checkpoint <checkpoint.pth> --data-path <ETTh1.csv>
python scripts/verify_performance_v1.py
```

These export commands write experiment artifacts; use a separate checkout for new runs. [AGCRN reproduction](../integrations/agcrn_external/README.md) and [MTGNN integration](../integrations/mtgnn_external/README.md) provide model-specific instructions.

The archived MSGNet replay has a recorded failure at the declared tolerance. Preserve that failure and see [scientific semantics](SCIENTIFIC_SEMANTICS_REPAIR.md). [Session v2 compatibility](AUDIT_SESSION_V2.md) describes retained historical contracts separately.
