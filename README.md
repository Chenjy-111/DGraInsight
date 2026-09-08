# DGraInsight

Evaluate how removing a learned graph relation changes a model's forecast. Run your model locally, then upload the resulting JSON to the website.

## Download and start

**[Download DGraInsight Offline Evaluator for Windows](https://github.com/Chenjy-111/DGraInsight/releases/latest/download/DGraInsight-Offline-Evaluator.zip)**

[Open the website](https://chenjy-111.github.io/DGraInsight/) · [All release assets](https://github.com/Chenjy-111/DGraInsight/releases/latest) · [User guide](offline_app/README.md)

1. Download the ZIP above and extract it to a writable folder.
2. Double-click **Start-Evaluation.cmd**.
3. Select a model and enter your local model source, dataset and checkpoint paths.
4. Select samples and edges, review the plan, and run evaluation.
5. Upload **runs/<timestamp>/manifest.json** using **Import Evaluation Results** on the website.

Use the named **DGraInsight-Offline-Evaluator.zip** asset. GitHub's automatically generated **Source code (zip)** is the development repository, not the ready-to-run application.

The launcher finds an existing Python environment or asks for its path. Python 3.10+, PyTorch, NumPy and your model's own dependencies are required. The download does not include Python, model weights or datasets. No Git, manual JSON editing, model download or retraining is required for this local workflow.

## Connect your model

DGraFormer, MSGNet and MTGNN have maintained backends. Other models use **Connect another model** and an external adapter file.

- [Adapter author guide](offline_app/ADAPTER_GUIDE.md): what to implement and where to put it.
- [Adapter template](offline_app/adapters/template.py): the required six methods.
- [AGCRN external adapter example](https://github.com/Chenjy-111/DGraInsight/releases/latest/download/AGCRN-Adapter.zip): a separate example, not a built-in model. See its [local resource guide](integrations/agcrn_external/LOCAL_ADAPTER_GUIDE.md).

## Repository map

| Location | Contents |
| --- | --- |
| `offline_app/` | Current Windows launcher, wizard and user guides |
| `dgraudit/` | Evaluation engine and shared model backends |
| `integrations/` | External adapter implementations and reproducibility studies |
| `scripts/build_offline.py` | Clean ZIP package builder |
| `src/`, `public/` | Website and existing demo data |
| `docs/` | Developer documentation and historical evidence references |
| `tests/` | Validation and regression tests |

The retired Audit wizard and root launchers have been removed. Historical Session v2 reproduction modules and evidence remain for existing demos; they are excluded from the user download. Release packages exclude local environments, personal paths, user runs, datasets and checkpoints.

## Development

Website: `npm ci`, then `npm run dev`. Production build: `npm run build`.

Build a fresh offline distribution (the destination must not already exist):

```powershell
python scripts/build_offline.py outputs/release/DGraInsight-Offline-Evaluator --agcrn-example outputs/release/AGCRN-Adapter --zip
```

[Maintainer and release guide](docs/DEVELOPMENT.md) · [Technical evaluation guide](docs/EVALUATION_GUIDE.md)

Learned relations describe model computation, not real-world causal connections. An explicit repository LICENSE has not yet been added; upstream model and data terms still apply.
