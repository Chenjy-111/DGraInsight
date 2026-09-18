# Reviewer guide

## Recommended walkthrough

1. Open the [live demo](https://chenjy-111.github.io/DGraInsight/).
2. In DGraFormer, select `HUFL → LUFL` for test sample 0, Window 1. The stored normalized weight is 0.211185 (rank 2); removal increases MAE by about 0.204% and MSE by about 0.345%.
3. Switch between single-window and all-relevant-window results, then inspect the forecast-step and cross-sample views. For this relation, 96.4% of available samples show little MAE change and 3.6% degrade under the declared 0.1% descriptive threshold.
4. Switch to MSGNet. Its graph nodes `G0–G6` are latent graph positions, not ETTh1 variable names; scale indices are native scale contexts, not consecutive time windows.
5. Inspect the all-scale `G4 → G3` example: MAE and MSE improve by about 0.106% and 0.152%, with MAE improvement in 10 of 14 samples (71.4%).
6. Open **Import Evaluation Results** to inspect the portable `evaluation.v1` path. The browser validates and displays stored results; it does not run the neural model.
7. Review [`offline_app/examples/stemgnn/`](../offline_app/examples/stemgnn/README.md) for the external-model example. On test sample 9, removing the undirected `US — France` relation degrades MAE by about 4.69% and MSE by about 11.38%.
8. Use the [`resource manifest`](../offline_app/docs/RESOURCE_MANIFEST.md) to distinguish repository-complete checks from checkpoint-backed runs that require declared external resources.

## Claim-to-code map

| Paper-facing capability | Current implementation | Checks |
|---|---|---|
| Interactive native graph contexts | `src/components/ControlStudio.tsx`, `src/components/MsgnetWorkspace.tsx` | `tests/webGraphRegression.mjs` |
| Before/after MAE and MSE | `src/components/evidence/PerformanceSummary.tsx`, `src/data/performance.ts` | `tests/performanceRegression.mjs`, `tests/performanceBrowserRegression.mjs` |
| Cross-sample descriptive consistency | `src/components/evidence/CrossSampleConsistency.tsx` | `tests/performanceRegression.mjs` |
| Portable `evaluation.v1` import | `src/data/evaluation.ts`, `offline_app/dgraudit/evaluation.py` | `tests/evaluationRegression.mjs`, `tests/test_evaluation.py` |
| Model-specific native removal | `offline_app/dgraudit/adapters.py`, `offline_app/dgraudit/evaluation_plugins.py` | evaluator preflight and model-specific verification |
| Thin Adapter for external models | `offline_app/dgraudit/thin_adapter.py` | `tests/test_thin_adapter.py` |
| StemGNN external case | `offline_app/examples/stemgnn/stemgnn.py` | adapter graph-state checks and example verification script |

## Interpretation boundaries

- Results apply to the declared checkpoint, sample, relation, context and removal protocol.
- MAE/MSE are aggregated in the measurement space declared by each result. Values across incompatible datasets or scales should not be compared directly.
- The 0.1% threshold labels small relative changes for display only. It is not a p-value, significance test or equivalence test.
- A relation weight and its forecasting-error response are different quantities.
- Graph relations are internal computational relations, not claims of real-world causality.
- Retired pre-paper material is retained only under `legacy/`; it is not part of the paper-facing implementation.
