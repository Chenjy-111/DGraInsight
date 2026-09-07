"""Runnable synthetic example: 4 latent graph nodes, 2 outputs, 3 forecast steps.

Replace these functions with your existing model code. No subclass is necessary.
This example is a mechanism test, not a trained forecasting benchmark.
"""
from dgraudit.evaluation import FunctionBackend

NODES = ["latent-a", "latent-b", "latent-c", "latent-d"]
# Native coordinates are [target, source], unlike the exported directed edges.
ADJACENCY = [[0, 0, 0, 0], [0.7, 0, 0, 0], [0, -0.2, 0, 0], [0.4, 0, 0.8, 0]]


def load_sample(sample_id):
    return {"input": [float(sample_id) + 1, 2.0, 0.5, 3.0], "truth": [[1.0, 2.0], [1.2, 2.3], [1.4, 2.6]]}


def forward(sample, adjacency=ADJACENCY):
    x = sample["input"]
    hidden = [x[t] + sum(adjacency[t][s] * x[s] for s in range(4)) for t in range(4)]
    return [[hidden[1] * 0.4 + step * 0.1, hidden[3] * 0.3 + step * 0.2] for step in range(3)]


def contexts(sample):
    return [{"id": "encoder:0", "label": "Encoder latent graph", "type": "latent_layer", "edges": [
        {"source": NODES[s], "target": NODES[t], "weight": ADJACENCY[t][s]}
        for t in range(4) for s in range(4) if ADJACENCY[t][s] != 0
    ]}]


def remove(sample, request):
    if request["protocolId"] != "single" or request["contextIds"] != ["encoder:0"]:
        raise ValueError("This backend only supports a single encoder graph removal")
    source, target = NODES.index(request["source"]), NODES.index(request["target"])
    adjacency = [row[:] for row in ADJACENCY]
    adjacency[target][source] = 0
    return forward(sample, adjacency)


def create_backend(config, base_dir):
    return FunctionBackend(
        metadata={"model": "Synthetic function example", "dataset": "Synthetic mechanism fixture", "horizon": 3,
            "outputs": ["Forecast A", "Forecast B"], "nodes": [{"id": n, "label": n} for n in NODES],
            "nodeMeaning": "Four synthetic latent positions. They are not the two forecast outputs.",
            "protocols": [{"id": "single", "label": "Encoder relation removal", "scope": "single_encoder", "description": "Set native [target,source] to zero in the encoder. Additive self contribution stays unchanged; no renormalization. Signed graph weights are retained."}],
            "measurement": {"space": "synthetic output scale", "units": "synthetic units", "aggregation": "mean_all_steps_outputs"},
            "provenance": {"kind": "synthetic_example", "checkpoint": None, "note": "Deterministic integration example, not a trained model."}},
        load_sample=load_sample, truth=lambda sample: sample["truth"], predict=forward,
        contexts=contexts, intervene=remove, identity=lambda sample, context: forward(sample, [row[:] for row in ADJACENCY]),
    )
