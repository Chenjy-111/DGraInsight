# DGraInsight

Interactive exploration of forecast changes after removing learned graph relations. Models execute locally; the website loads stored results and displays graphs, forecasts, and MAE/MSE changes.

**[Live demo](https://chenjy-111.github.io/DGraInsight/) · [Reviewer guide](docs/REVIEWER_GUIDE.md) · [Reproducibility](docs/REPRODUCIBILITY.md) · [Evaluation and adapter guide](docs/EVALUATION_GUIDE.md)**

## Run the website

Use Node.js 20 or newer. From the repository root:

```bash
npm ci
npm run dev
```

For a production build, run `npm run build`, then `npm run preview`. Open the URL printed by Vite. GitHub Pages builds from `main` using [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Evaluate your model

Import existing `evaluation.v1` results, connect prediction/removal functions, or implement the six-method [Thin Adapter](dgraudit/thin_adapter.py). The browser does not execute Python or load checkpoints.

```bash
python -m dgraudit evaluate --config configs/evaluation_functions_example.json --output outputs/functions_evaluation.json
python -m dgraudit validate-results outputs/functions_evaluation.json
```

Choose **Import Evaluation Results** and select the output. The function example is a deterministic contract fixture, not research evidence. Real model execution requires the original source, dataset, checkpoint and compatible Python dependencies; see [setup and verification](docs/REPRODUCIBILITY.md).

Maintained execution backends cover DGraFormer, MSGNet and MTGNN. [AGCRN](integrations/agcrn_external/README.md) demonstrates an external Thin Adapter. On Windows, `Start-DGraInsight-Evaluation.cmd <config> <output>` wraps the evaluation CLI.

## Repository map

| Path | Purpose |
|---|---|
| `src/` | React interface, graph views, result import and validation |
| `public/data/performance/v1/` | Built-in DGraFormer and MSGNet performance results |
| `public/data/evaluation/` | Importable evaluation reference results |
| `artifacts/performance/v1/` | Raw prediction archives and metric verification |
| `dgraudit/evaluation.py`, `evaluation_validation.py`, `thin_adapter.py` | Evaluation runner, validation and adapter contract |
| `dgrainsight/` | Short `validate` / `run` CLI aliases |
| `integrations/`, `configs/evaluation_*.json` | Model integrations and evaluation configurations |
| `schemas/`, `tests/`, `scripts/` | Contracts, regression fixtures and reproduction tools |
| `docs/` | Reviewer instructions, current usage and scientific semantics |

`performance.v1` serves built-in summaries; `evaluation.v1` is the portable evaluation format. Session v2 modules and frozen artifacts remain where needed for graph compatibility and recorded-result verification; see [the compatibility boundary](docs/AUDIT_SESSION_V2.md). They do not supply the current performance conclusions.

## Interpretation and provenance

Signed error change is `after - before`; negative means improvement. Missing experiments remain unavailable. The 0.1% relative display threshold is descriptive, not statistical significance. Learned relations describe model computation, not real-world causal connections. MSGNet graph nodes are latent positions, distinct from forecast outputs.

The recorded MSGNet historical replay failure remains visible in [scientific verification](docs/SCIENTIFIC_SEMANTICS_REPAIR.md). Current performance data use independently recorded runs; do not confuse metric recomputation with a fresh checkpoint replay.

Original model contributions belong to their authors. Live execution needs externally obtained model/data assets. No project license is currently declared in this repository.
