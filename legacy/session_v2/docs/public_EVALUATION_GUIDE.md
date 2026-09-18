# Offline Edge-Removal Evaluation

Evaluation compares forecast performance before and after a declared graph
relation removal, using MAE/MSE, forecasts and descriptive sample comparisons. The workflow reports descriptive forecast changes. See [Session v2 compatibility](https://github.com/Chenjy-111/DGraInsight/blob/main/docs/AUDIT_SESSION_V2.md) for the retained audit interfaces.

## 1. Import an existing experiment

The browser accepts `evaluation.v1` JSON. Model frameworks are not required for this
route. Keep your experiment code and package its existing results:

```python
from dgraudit.evaluation import write_results
write_results(my_results, "evaluation_results.json")
```

Or supply a JSON object and let the CLI derive missing metrics from arrays:

```bash
python -m dgraudit export-results --input my_results.json --output evaluation_results.json
python -m dgraudit validate-results evaluation_results.json
```

Choose **Import Evaluation Results → Choose Evaluation Results** on the website.
The browser never imports Python, loads a checkpoint or performs a model forward.
It validates result identities and recomputes stored metrics where raw arrays exist.

Minimal aggregate-only example (no graph or curves are required):

```json
{
  "model": "My model",
  "dataset": "My test split",
  "horizon": 12,
  "outputs": ["Temperature", "Pressure"],
  "nodes": [],
  "nodeMeaning": "Graph not exported; removal labels supplied by the experiment author.",
  "protocols": [{"id": "my-removal", "label": "Selected connection", "scope": "encoder", "description": "Author's encoder connection mask before normalization; downstream computation runs normally."}],
  "measurement": {"space": "original output scale", "units": "declared dataset units; MSE in squared units", "aggregation": "mean_all_steps_outputs"},
  "samples": [{"id": "test:10", "baselineMetrics": {"mae": 1.0, "mse": 2.0}}],
  "records": [{"id": "r1", "sampleId": "test:10", "protocolId": "my-removal", "label": "Encoder connection A", "metrics": {"mae": 0.9, "mse": 1.8}}]
}
```

This is **writer input**: `write_results` / `export-results` fill version, contexts,
provenance and unchecked validation declarations. Import the resulting file, not this
incomplete input directly. A complete raw example is in
`tests/fixtures/evaluation/functions.json`.

For raw results, add `truth` and `baselinePrediction` to each sample, and `prediction`
to each removal. Each array is `[horizon, output_count]` (the Python writer also accepts
a singleton batch axis). Missing aggregate metrics are computed in float arithmetic.
Supplied metrics must agree with the arrays; contradictory values are rejected.

For graphs, declare global `nodes: [{id,label}]`, and sample-specific
`contexts: [{id,type,label,edges:[{source,target,weight}]}]`. Edge ids reference **graph
nodes**, not the output list. Weights are optional; when provided they must be finite and nonzero. Positive and negative weights are supported.
Arrows follow canonical message source→target; the backend maps native matrix indices.
Record `contextIds`, `source`, `target` and `protocolId` identify the exact removal.
Context ids must be stable for a cross-sample comparison to be meaningful. Distinct
native layers must not reuse a context id merely because they share a scale index.

Available data determines functionality:

| Available data | Enabled functionality |
|---|---|
| Aggregate baseline/removal MAE and MSE | Error table, scope comparison, cross-sample changes |
| Graph nodes and sample contexts | Directed graph, edge selection and result linkage |
| Truth and both prediction arrays | Forecast curves, per-step errors, per-output evaluation |

Missing data remains unavailable, not zero. Overall metrics are the equal mean of all
declared forecast steps and outputs. If your experiment uses a different weighting,
masking or aggregation, recompute this protocol or use a separate declared format;
do not relabel a different metric as this one. Heterogeneous output units are recorded;
use per-output views to interpret them. The current format requires finite complete
arrays and one horizon/output list per file; separate incompatible experiments.

## 2. Connect your existing functions

`FunctionBackend` accepts ordinary functions; no model inheritance or checkpoint loader
rewrite is required. A factory can load your model once or capture an already loaded
model when used from Python:

```python
from dgraudit.evaluation import FunctionBackend, run_evaluation

backend = FunctionBackend(
    metadata=metadata,                  # model, dataset, nodes, outputs, protocols, units
    load_sample=my_load_sample,         # id -> your opaque batch object
    truth=my_truth,                     # batch -> exact evaluation truth [H,O]
    predict=my_predict,                 # batch -> original forecast [H,O]
    contexts=my_contexts,               # batch -> portable context list (or [])
    intervene=my_remove,                # batch, request -> full modified forecast
    identity=my_unchanged_graph_replay,  # required for execution: batch, context -> forecast
    close=my_cleanup,                   # optional
)
run_evaluation(backend, [0, 1], "evaluation_results.json")
```

`intervene` must execute the user's real removal code; the shared runner does not zero
an adjacency matrix. Declare direction, consumption point, self-loops, normalization,
affected branches and scope in `protocols.description`. Do not infer variable meaning
from equal graph/output dimensions. A no-effect removal is a valid result.

The mandatory identity callback must run the same override path with an unchanged
graph. The runner checks every sample/context against the original prediction at
`atol=1e-6, rtol=1e-5` before any removal. Copying the baseline into this callback is
not a meaningful check. Without the callback execution fails as `NOT_SUPPORTED`; existing-result import remains available.
Identity success does not establish correct native removal. Inspect tensors actually
consumed by native message-passing and run an independent native intervention test;
record the report separately. Imported producer declarations are not certifications.

Runnable example, with **4 latent nodes, 2 outputs, 3 forecast steps, signed edges**:

```bash
python -m dgraudit evaluate --config configs/evaluation_functions_example.json --output outputs/functions_evaluation.json
```

Copy `dgraudit/examples/evaluation_functions_example.py` and replace the example functions.
The external config names exactly one local module and factory. Loading it executes
local Python, so use code you intend to run. A new backend does not modify the registry.
The example is synthetic and explicitly marked as such; it is not model evidence.

Default execution enumerates non-self edges in each returned context for the declared
`single` protocol. Alternatively provide an explicit `requests` list in the config:

```json
[{"sampleId":"0", "protocolId":"single", "contextIds":["encoder:0"],
  "source":"latent-a", "target":"latent-b", "label":"Selected encoder relation"}]
```

Request sample ids are strings matching the configured sample ids. For graphless
custom interventions, omit source/target and use a unique label with empty contextIds.
Custom protocols are permitted; their backends must implement and validate them.

The runner evaluates each baseline once, batches requests serially, and atomically
saves after each removal. Interrupted results say `partial`; inspect them or resume:

```bash
python -m dgraudit evaluate --config configs/evaluation_functions_example.json --output outputs/functions_evaluation.json --resume
```

Resume reruns baseline/identity checks, verifies metadata, inputs, contexts and the
request plan, then skips completed removals. Different inputs require a new file.
Include checkpoint, dataset and dependency/source hashes in backend provenance to make
resume identity meaningful. The factory module is hashed automatically; arbitrary
downstream custom dependencies cannot be inferred. No parallel GPU execution or
automatic adaptation of unknown model architectures is claimed.

## 3. Use or distribute a model plugin

```bash
python -m dgraudit plugins
python -m dgraudit evaluate --config configs/evaluation_dgraformer.json --output outputs/dgraformer_evaluation.json
python -m dgraudit evaluate --config configs/evaluation_msgnet.json --output outputs/msgnet_evaluation.json
python -m dgraudit evaluate --config configs/evaluation_mtgnn.json --output outputs/mtgnn_evaluation.json
```

Run each official model in a separate process because upstream repositories use
overlapping Python module names. Install the original model dependencies in the chosen
Python environment. Update source_root, checkpoint.path, dataset.path and architecture
parameters to your local assets. Optional declared hashes are enforced; actual hashes
and all Python source hashes under source_root are recorded. Config templates contain
reference architecture settings, not a promise of compatibility with every version.

| Plugin | Native behavior and boundary |
|---|---|
| DGraFormer | Variable nodes; effective native windows; removal before normalization; optional all-window protocol |
| MSGNet | Internal G nodes; canonical source→target maps to native [target,source]; scale injection with downstream propagation; broader scope is all scales in one layer |
| MTGNN | Variable nodes; one global shared graph; canonical arrow follows gconv1 and maps to native [target,source]; transpose branch reverse channel is also affected |

The `single` operation on MTGNN already acts on the shared graph across convolution
layers; there is no additional all-context option. The reference single-step model
predicts **one value at a lead of 3**, not a three-step output trajectory. The UI shows
one forecast position and provenance retains the lead parameter.

The maintained DGraFormer and MSGNet adapters evaluate in their native training-split
StandardScaler space, not physical variable units. Reversing model-internal RevIN or
similar normalization does not reverse dataset scaling. MTGNN's adapter explicitly
applies native inverse scaling and reports original dataset units. Result metadata
records these differences; do not compare their raw MAE/MSE magnitudes across models
with different datasets or measurement spaces.

For supported broader operations, explicitly request protocol `all` and include every
affected context id (every effective window, or every scale in the selected MSGNet
layer). Requests with unsupported scopes are rejected; missing experiments are not
generated by the browser.

An external factory can reuse an existing plugin or wrap another model:
`integrations/mtgnn_external/evaluation_backend.py` and
`configs/evaluation_mtgnn_external.json` demonstrate the maintained MTGNN backend through
the same external route. Distribute a factory, requirements, compatible source revision,
example config, semantic description and native validation report with your plugin.

## Validation and references

`schemas/dgrainsight_evaluation_v1.schema.json` documents the structural format. Both
Python and browser validators additionally enforce dimensions, identifiers, exact
context references, nonzero graph edges, duplicate requests and raw metric consistency.
Metric display uses `(after-before)` for signed error change and `(before-after)/before`
for improvement percentage; zero baseline has no percentage. A 0.1% relative threshold
is descriptive only. Controls and formal inference are not part of this workflow.

The MTGNN reference result uses test samples 0,1,2 and a new CPU run, not legacy D or
control records. `scripts/verify_mtgnn_evaluation.py` independently changes native gc
output, checks both branches' consumed nconv matrices, and compares all stored forecasts.
Historical Session v2 MTGNN row/column ids must not be treated as the new canonical
arrows. Regenerate from the original model rather than silently relabeling legacy files.


## I have a new graph forecasting model

1. Identify relations actually used by the original forward and document their semantics.
2. Add an external module implementing `dgraudit.thin_adapter.ThinAdapter` (see
   `integrations/contract_fixture/adapter.py`, explicitly a deterministic integration fixture).
3. Implement six responsibilities: `load`, `load_sample`, `predict`, `get_contexts`,
   `get_relations`, `predict_with_intervention`. The last method handles `identity` and `remove`.
   `close` is optional. Original tensors and batches remain opaque to the core.
4. Declare the external module/class in `backend` with `source_root`, `module`, `class`.
   Paths are relative to the config directory; `load` receives `config_dir` for resolving paths.
   No central registry edit is needed. The existing FunctionBackend factory API remains Level 2.
5. Run:

```powershell
python -m dgrainsight validate configs/evaluation_contract_fixture.json
python -m dgrainsight run configs/evaluation_contract_fixture.json --output outputs/my_run/manifest.json
```

6. Import `manifest.json` through **Import Evaluation Results** in the existing Web.

The public CLI is a small alias over the existing runner in `dgraudit`, not a parallel
framework. Configs use JSON to keep result-only tooling free of extra dependencies.
The unified `evaluation.v1` manifest is self-contained: metadata, records and raw arrays
are kept in one JSON file. `results.json` and `arrays.npz` are not required companions.
This deliberately retains the existing evidence schema and avoids archive unpacking.
Each raw-array result also stores `errorChange` and `forecastStepErrorChange`; Python
and Web recalculate these fields on import. Multiple samples carry one record per
sample/relation/context/scope, from which the Web computes the matching sample profile.

Capabilities are explicit booleans `supports_single_context`, `supports_all_contexts`,
`supports_batch`, `directed`, and semantic type `observed`, `latent` or `custom`.
The runner is sequential; `supports_batch` describes native batch execution and never
causes samples to be silently substituted. `single` needs exactly one context, `all`
requires adapter support. The adapter must enforce which complete native context group
constitutes its all-context scope. Weights may be omitted. Node count need not equal
output count. Relation arrows represent declared model computation, not real-world causality.

Six preflight checks cover load, sample, baseline, relations, identity and actual removal.
Failure states are `FAIL`, `NOT_SUPPORTED`, `UNAVAILABLE`; only six passes allow execution.
Identity uses `atol=1e-6, rtol=1e-5` for every selected sample/context. A finite changed
prediction alone does not verify removal: adapters may attach `graphStateVerification`
with `passed`, `failed` or `unavailable` and an actual inspection description. Independent
native verification is recorded separately. Missing graph evidence never becomes PASS.

**Analysis compatibility** means a result producer can provide valid evidence, regardless
of its model framework. **Execution compatibility** additionally requires identifiable
native relations, a valid model-specific intervention and a working adapter/runtime.
MTGNN is an existing reference plugin, not proof of previously unsupported-model integration.
