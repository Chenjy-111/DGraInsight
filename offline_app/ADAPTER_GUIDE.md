# Writing and loading an external model adapter

An adapter is a small Python connection layer that calls your original model. It is written by a model developer; users then select it in the wizard. It does not replace the model or require changes to the evaluator registry.

## File location

1. Copy `adapters/template.py` to `adapters/my_model.py`, or place your adapter in a separate folder.
2. Implement `class MyAdapter(ThinAdapter)` in that file. You may choose a different class name.
3. Leave the original model source, dataset and checkpoint in their own local directories.
4. Start the evaluator, select **4. Connect another model**, choose `my_model.py` and enter `MyAdapter` as the class name.
5. Enter the three local resource paths. The wizard generates the configuration automatically.

The adapter module is local Python code and executes when selected. Keep imports free of training or experiment side effects. Install the original model dependencies in the selected environment. The adapter must use architecture parameters that match the checkpoint.

## Six required methods

| Method | Required behavior |
|---|---|
| `load(config)` | Load original model, real checkpoint and preprocessing. `source_root`, `dataset.path`, `checkpoint.path` are absolute paths; resource SHA256 values are also supplied. Return model metadata below. |
| `load_sample(sample_id)` | Return `Sample(str(sample_id), original_input, truth)` for the exact test sample requested. |
| `predict(sample)` | Call normal forward and return a finite `[forecast_steps, output_count]` prediction in the same scale as truth. |
| `get_contexts(sample)` | Return real `GraphContext` objects with stable, distinct IDs for layers, windows or scales. |
| `get_relations(sample, context)` | Return actual `Relation(source, target, weight)` objects with canonical message direction source-to-target. Exclude self edges for this workflow. |
| `predict_with_intervention(sample, request)` | Execute `identity` or `remove` at the actual native graph consumption point; rerun forward and restore state afterwards. |

`close()` is optional. Do not silently replace samples, infer fictional graphs, or fill unavailable measurements with zero.

## Metadata returned by load

Replace every description with the actual model semantics. This is a structural example, not experimental evidence:

```python
return {
    "model": "My model",
    "dataset": "Actual dataset and test split",
    "horizon": self.horizon,
    "nodes": [{"id": str(i), "label": name} for i, name in enumerate(self.node_names)],
    "outputs": self.output_names,
    "nodeMeaning": "Describe observed channels, latent positions, or other native nodes",
    "protocols": [{"id": "single", "label": "Single-context edge removal",
        "scope": "single_context",
        "description": "Declare actual removal point, matrix direction, normalization, self loops and affected layers"}],
    "measurement": {"space": "Actual forecast scale", "units": "Actual units",
        "aggregation": "mean_all_steps_outputs"},
    "provenance": {"checkpointSha256": config["checkpoint"]["sha256"],
        "datasetSha256": config["dataset"]["sha256"]},
}
```

Node count may differ from output count. Record actual source hashes and preprocessing parameters. Git revision is optional; do not attribute a containing repository's revision to exported model files.

## Native intervention

For `identity`, use the same override path with the unchanged native graph and really run forward. Returning a cached baseline is not a valid check.

For `remove`, start from the original graph each time, remove `request.source -> request.target` in `request.context_ids`, apply the declared normalization, and rerun the full forecast. Restore hooks and state in `finally` to avoid cumulative deletions.

Return a prediction array, or:

```python
{"prediction": prediction,
 "graphStateVerification": {"status": "passed", "detail": "Describe the native consumed tensor checks actually performed"}}
```

Only report `passed` after inspecting the actual consumed graph state. Otherwise use `unavailable`. A changed prediction does not establish a correctly implemented removal. Six preflight checks cover loading, samples, baseline, relations, identity and removal; independent native verification remains the model author's responsibility.

## Optional resource preparation

An adapter may export:

```python
DEFAULT_ADAPTER_CLASS = "MyAdapter"

def prepare_resources(config, run_directory):
    # Called once by the wizard before model loading, not on resume.
    # Prepare a local experiment copy if native hooks are needed.
    # Preserve original files; retain resource hashes and record preparation provenance.
    # Return the resulting configuration with source_root pointing to that copy.
    return config
```

This hook belongs to the external adapter, not the evaluator. It is optional: if absent, the selected local resources are passed straight to `load`. Saved configurations retain prepared paths for subsequent validation and resume. The same contract applies to every external model.
