# Reviewer guide

## Suggested review order

1. Open the [live demo](https://chenjy-111.github.io/DGraInsight/). Select a DGraFormer edge and compare graph windows, sample identities, removal scopes and MAE/MSE. Switch to MSGNet and check scale semantics. Use **Explore MTGNN** for the global-graph reference result.
2. Import `tests/fixtures/evaluation/functions.json` through **Import Evaluation Results** to inspect the generic result workflow. This is a deterministic fixture. Actual reference experiments are under `public/data/evaluation/`.
3. Read [evaluation semantics and adapter contract](EVALUATION_GUIDE.md), then inspect [the structural schema](../schemas/dgrainsight_evaluation_v1.schema.json). Python and browser validators add numerical and identity checks beyond the schema.
4. Follow [reproducibility](REPRODUCIBILITY.md) to build the application, run regression tests and recompute stored performance metrics.
5. Review [native graph differences](PAPER_CODE_GRAPH_DIFFERENCES.md) , [AGCRN integration evidence](EXTERNAL_MODEL_ADAPTER_VALIDATION.md) and [scientific replay limits](SCIENTIFIC_SEMANTICS_REPAIR.md), including the preserved MSGNet historical failure.

## Claim-to-evidence map

| Check | Implementation | Evidence / verification |
|---|---|---|
| Portable evaluation import | `src/data/evaluation.ts`, `dgraudit/evaluation_validation.py` | `tests/evaluationRegression.mjs`, `tests/test_evaluation.py` |
| External model contract | `dgraudit/thin_adapter.py` | `tests/test_thin_adapter.py`, `integrations/agcrn_external/` |
| Native removal execution | `dgraudit/evaluation_plugins.py`, `dgraudit/adapters.py` | `scripts/verify_mtgnn_evaluation.py`, `integrations/agcrn_external/verify_native.py` |
| Built-in performance metrics | `src/data/performance.ts` | `artifacts/performance/v1/`, `scripts/verify_performance_v1.py` |
| Graph identity preservation | `src/data/loaders.ts`, `src/data/msgnetLoader.ts` | `tests/webGraphRegression.mjs`, `tests/fixtures/web_graph_baseline_v2.json` |
| Interactive result display | `src/components/EvaluationWorkspace.tsx`, `src/components/evidence/PerformanceSummary.tsx` | `tests/evaluationBrowserRegression.mjs`, `tests/performanceBrowserRegression.mjs` |

## Interpretation boundaries

The browser displays stored experiments; it does not generate missing removals or execute models. Relations refer to model computation, not established real-world causes. Graph nodes and forecast outputs may differ. MAE/MSE magnitudes should not be compared across incompatible datasets or measurement spaces. The small-change threshold is descriptive.

`performance.v1`, `evaluation.v1` and retained Session v2 files have different purposes. The [compatibility note](AUDIT_SESSION_V2.md) explains why graph validators and some frozen artifacts still use v2 names. Current performance conclusions do not use archived controls or formal support counts.

The repository includes stored reference results and frozen verification inputs. Fresh checkpoint reproduction needs original-model resources and a compatible environment. Read recorded validation statuses rather than inferring scientific validity from a successful frontend build.
