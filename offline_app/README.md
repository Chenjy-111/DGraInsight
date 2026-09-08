# DGraInsight Offline Evaluator

A single local workflow: select a model, supply local resources, evaluate individual edge removals, and import the resulting JSON into the website. This distribution contains no historical Audit/Session v2 launchers or configurations.

Download **DGraInsight-Offline-Evaluator.zip** from [the latest release](https://github.com/Chenjy-111/DGraInsight/releases/latest). Do not use the automatically generated Source code ZIP as the application.

## Start

1. Extract to a writable folder and double-click **Start-Evaluation.cmd**.
2. The launcher checks existing Python environments for Python 3.10+, PyTorch and NumPy. If none is found, enter the full path to your existing `python.exe`. A working path is remembered locally. No software is installed automatically.
3. Select **DGraFormer**, **MSGNet**, **MTGNN**, or **Connect another model**.
4. For a built-in backend, review the reference architecture and preprocessing settings. Use them only if they match your checkpoint, or choose `e` to edit values in the terminal. Other model dependencies must be installed in your selected environment; PyTorch alone is not sufficient for every upstream project.
5. For another model, select its external adapter `.py` file and class. The adapter must have been implemented by its author; this is not automatic model understanding. See **ADAPTER_GUIDE.md**.
6. Enter your model source folder, dataset file and checkpoint. Paths with spaces or surrounding double quotes are accepted.
7. Enter test sample IDs such as `0` or `0,1,2`. Choose all non-self edges or selected edges such as `0->1,1->0`.
8. Review the actual number of planned removals and enter `y` to validate and run.
9. On the website choose **Import Evaluation Results → Choose Evaluation Results**, then select `runs/<timestamp>/manifest.json`.

`manifest.json` is the `evaluation.v1` result. During a run it is a periodic partial snapshot; after successful completion it contains every result. `config.json` is an automatically generated reproduction record, not a website result. Python, model code, data and weights remain local. The tool does not download assets or train models.

Each removal starts from the original graph. By default all non-self relations are evaluated separately in each returned context for one selected sample. Selected edge pairs are evaluated wherever they exist in the returned contexts. This does not combine all contexts into one simultaneous removal. Large graphs can generate many thousands of forwards and large JSON files; the exact request count is shown before execution.

## External model demonstration

An external adapter is distributed separately from this evaluator. Select **4. Connect another model**, choose the adapter file, and supply your local assets. The generic evaluator has no model-specific branch for an external example. An adapter may implement the optional `prepare_resources` hook to prepare a local experiment copy before execution.

## Resume or validate

Run from this folder, replacing the paths with your actual environment and saved run:

```powershell
& "C:/path/to/python.exe" offline.py --config "runs/<timestamp>/config.json" --resume
& "C:/path/to/python.exe" offline.py --config "runs/<timestamp>/config.json" --validate-only
```

A changed model, dataset, checkpoint or request plan requires a new run. A failed preflight stops evaluation. Missing dependencies should be installed according to the original model's requirements in the chosen environment.

Each completed removal is appended and flushed to `manifest.json.journal.jsonl`.
The manifest is streamed atomically every 1,000 removals or 60 seconds, on normal
interruptions, and at completion. The runner never deep-copies the entire growing
result for each edge. Keep the journal beside the manifest until the run is finished:
`--resume` checks its identity and recovers complete records newer than the snapshot.
An incomplete final append is discarded; corrupt complete lines are rejected.
Only the final manifest is needed for website import.

## Diagnostics

Each session writes a timestamped log under `logs/`. The launcher records the Python
exit code in `logs/last-exit.txt` and prints a failure message if the process exits
abnormally. `Validating plan` and `Plan validated` distinguish setup from actual
`Removal i/N` progress. The final key prompt only closes the terminal; it does not
mean the evaluation succeeded. Look for `Complete` and a complete manifest.

The launcher prefers a local `.venv-cpu` environment when one is available. A CUDA
build running CPU computations can still interact with installed GPU driver libraries;
`CUDA_VISIBLE_DEVICES=-1` is not equivalent to installing a CPU-only PyTorch build.
For native driver access violations, use an isolated CPU-only environment rather than
changing a working training environment. The startup message reports the selected
PyTorch version and whether it is a CUDA build. Native exit code `-1073741819` is not
a successful completion or a normal keyboard interruption.

## Package layout

| File | Purpose |
|---|---|
| Start-Evaluation.cmd | Recommended user entry point |
| Start-Offline.ps1 | Internal Windows runtime detection |
| offline.py | Wizard, saved-config execution and resume |
| adapters/template.py | Six-method template for model developers |
| profiles/ | Internal reference settings for the three maintained models |
| dgraudit/ | Current evaluation engine and shared model computation backends; no legacy command entry points |
| runs/ | Generated configurations, prepared resources and results |

No checkpoints, datasets, upstream model repositories, private Python paths or user runs are included in the release ZIP. Graph relations describe model computations, not real-world causal relationships.
