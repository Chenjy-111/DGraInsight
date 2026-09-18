# Evaluation developer guide

The evaluator produces `evaluation.v1`, the same portable result contract accepted by the website. It executes explicit native relation-removal requests against a fixed checkpoint and computes MAE/MSE before and after removal.

## Run a maintained plugin

From `offline_app/`, copy a matching reference profile, replace the source, dataset and checkpoint paths, and keep architecture parameters consistent with the checkpoint:

```bash
python -m dgraudit preflight --config profiles/dgraformer.json
python -m dgraudit evaluate --config profiles/dgraformer.json --output runs/dgraformer/manifest.json
```

Available maintained plugins are `dgraformer`, `msgnet` and `mtgnn`. `python -m dgraudit plugins` prints their graph-context and compatibility boundaries.

## Result requests

Each request declares:

```json
{
  "sampleId": "0",
  "protocolId": "single",
  "contextIds": ["window:0"],
  "source": "0",
  "target": "4",
  "label": "HUFL -> LUFL"
}
```

Use `protocolId: "all"` only when the backend declares all-context support, and list every context affected in that one run. Each request starts from the original graph.

## External model

Implement the six methods in [`../ADAPTER_GUIDE.md`](../ADAPTER_GUIDE.md), then select the adapter through the guided application. The Thin Adapter must call the original model, expose real native relations, run identity through the same override path, and restore modified state after every intervention.

The paper-aligned external example is [`../examples/stemgnn/`](../examples/stemgnn/README.md).

## Validation boundary

The evaluator checks result structure, metric arithmetic, identities, capability declarations and baseline/identity agreement. Correct native intervention placement is architecture-specific; the adapter must verify the tensor actually consumed by message passing. A changed forecast alone is not proof of correct removal.
