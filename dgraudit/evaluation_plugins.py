"""Built-in model backends and explicit external backend factories.

New backends export create_backend(config, base_dir) -> FunctionBackend.
No registry edit or framework import is needed by the result viewer/export API.
"""
from __future__ import annotations

import hashlib
import importlib
import os
import platform
import sys
from pathlib import Path

from .evaluation import FunctionBackend, array, require

PLUGIN_INFO = {
    "dgraformer": {"model": "DGraFormer", "context": "window", "config": "configs/evaluation_dgraformer.json", "compatibility": "DGraFormerAdapter source layout and declared architecture/checkpoint; source hashes recorded on each run."},
    "msgnet": {"model": "MSGNet", "context": "scale", "config": "configs/evaluation_msgnet.json", "compatibility": "MSGNetAdapter source layout with corrected source/target semantics; internal graph positions are not output variables."},
    "mtgnn": {"model": "MTGNN", "context": "global_graph", "config": "configs/evaluation_mtgnn.json", "compatibility": "MTGNN single-step learned-graph configuration; shared adjacency and transpose branches; no broader-context operation."},
}


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def resolve(base, raw):
    path = Path(raw)
    return (base / path).resolve() if not path.is_absolute() else path.resolve()


def load_backend(config, base):
    plugin = config.get("plugin")
    if plugin in PLUGIN_INFO:
        return official_backend(plugin, config, base)
    require(plugin == "external", "Unknown plugin. Use dgraformer, msgnet, mtgnn or external.")
    declaration = config.get("backend", {})
    module_name, factory_name = declaration.get("module"), declaration.get("factory", "create_backend")
    require(isinstance(module_name, str) and module_name and isinstance(factory_name, str), "Declare backend.module and backend.factory")
    root = resolve(base, declaration["source_root"])
    sys.path.insert(0, str(root))
    module = importlib.import_module(module_name)
    module_path = Path(module.__file__).resolve()
    require(root == module_path.parent or root in module_path.parents, "Backend module resolved outside declared source_root")
    if declaration.get("class"):
        from .thin_adapter import connect_adapter
        backend = connect_adapter(getattr(module, declaration["class"])(), {**config, "config_dir": str(base)})
        factory_name = declaration["class"]
    else:
        backend = getattr(module, factory_name)(config, base)
        backend.metadata.setdefault("sourceMode", "functions")
    require(isinstance(backend, FunctionBackend), "Factory must return FunctionBackend")
    backend.metadata.setdefault("provenance", {}).update({"backendModule": module_name, "backendFactory": factory_name, "backendModuleSha256": sha256(module_path), "python": platform.python_version()})
    return backend


def official_backend(plugin, config, base):
    caller_directory = Path.cwd()
    # Framework dependencies are loaded only for actual model execution.
    import numpy as np
    import torch
    from .validation import OFFICIAL_ADAPTER_REGISTRY
    spec = OFFICIAL_ADAPTER_REGISTRY[plugin]
    if isinstance(spec, type):
        spec = spec()
    resolved = {"source_root": resolve(base, config["source_root"]), "dataset": resolve(base, config["dataset"]["path"]), "checkpoint": resolve(base, config["checkpoint"]["path"])}
    for name, path in resolved.items():
        require(path.exists(), f"Missing {name}: {path}")
    hashes = {key: sha256(resolved[key]) for key in ("dataset", "checkpoint")}
    for key, actual in hashes.items():
        expected = config[key].get("sha256")
        require(not expected or expected == actual, f"{key} SHA-256 mismatch")
    issues = spec.validate_adapter_config(config)
    require(not issues, f"Invalid model configuration: {issues}")
    spec.validate_dataset(resolved["dataset"], config)
    torch.set_num_threads(int(config.get("threads", 2)))
    adapter = spec.create_adapter(config, resolved)
    try:
        adapter.load_checkpoint(str(resolved["checkpoint"]))
    except Exception:
        adapter.close()
        raise
    outputs = list(config["dataset"]["variables"])
    horizon = int(config["dataset"]["pred_len"])
    # Reference backends expose this node count; external FunctionBackend has no such restriction.
    labels = [f"G{i}" for i in range(len(outputs))] if plugin == "msgnet" else outputs
    descriptions = {
        "dgraformer": "Remove canonical source→target at the native pre-normalization graph in one effective window; recompute normalization and the complete forecast.",
        "msgnet": "Remove canonical source→target at native [target,source] in one layer/scale adaptive adjacency; native mixprop adds self-loops and normalizes. Later scales continue to execute and may be affected.",
        "mtgnn": "The arrow follows the first branch's native message direction: canonical source→target maps to native [target,source]. Remove that shared learned adjacency entry before all graph-convolution layers. The transpose branch's reverse channel also changes; each native mixprop applies its own self-loop and normalization. This is a coupled shared-relation intervention, not an isolated directed message channel.",
    }
    protocols = [{"id": "single", "label": spec.capabilities.local_scope.replace("_", " "), "scope": spec.capabilities.local_scope, "description": descriptions[plugin]}]
    if spec.capabilities.supports_broader_context:
        protocols.append({"id": "all", "label": "All windows" if plugin == "dgraformer" else "All scales in one layer", "scope": spec.capabilities.broader_scope, "description": descriptions[plugin] + (" Apply at all native windows." if plugin == "dgraformer" else " Apply at every scale in the selected layer.")})
    sources = {str(p.relative_to(resolved["source_root"])): sha256(p) for p in resolved["source_root"].rglob("*.py") if ".git" not in p.parts and "__pycache__" not in p.parts}
    metadata = {"model": spec.model_name, "dataset": config["dataset"]["name"], "horizon": horizon, "outputs": outputs,
        "nodes": [{"id": str(i), "label": label} for i, label in enumerate(labels)],
        "nodeMeaning": "Internal embedding graph positions; no one-to-one mapping to input/output variables." if plugin == "msgnet" else "Dataset variable channels in the declared native order." + (" MTGNN arrows follow the first message-passing branch; the reverse branch is coupled to the same relation." if plugin == "mtgnn" else ""),
        "protocols": protocols, "measurement": {"space": "original dataset scale (native MTGNN inverse scaling)" if plugin == "mtgnn" else "training-split StandardScaler space; model-internal normalization is reversed, dataset scaling is retained", "units": "dataset variable units; MSE uses squared units" if plugin == "mtgnn" else "standardized output units; MSE uses squared standardized units", "aggregation": "mean_all_steps_outputs"},
        "provenance": {"plugin": plugin, "pluginVersion": "1.0", "checkpointSha256": hashes["checkpoint"], "datasetSha256": hashes["dataset"], "sourceHashes": sources, "parameters": config["adapter_config"], "python": platform.python_version(), "torch": torch.__version__, "device": str(adapter.device), "compatibility": PLUGIN_INFO[plugin]["compatibility"]}}
    metadata["sourceMode"] = "plugin"
    metadata["capabilities"] = {"supports_single_context": True, "supports_all_contexts": spec.capabilities.supports_broader_context, "supports_batch": False, "directed": True, "node_semantics": "latent" if plugin == "msgnet" else "observed"}
    metadata["provenance"]["implementationHashes"] = {name: sha256(Path(__file__).parent / name) for name in ("evaluation.py", "evaluation_plugins.py", "adapters.py", "validation.py")}

    def load_sample(sid):
        batch = spec.prepare_batch(adapter.load_sample(config.get("split", "test"), int(sid)), config)
        spec.validate_sample(batch, config)
        return batch

    def native_contexts(batch):
        contexts = spec.contexts(adapter.extract_graph_stages(batch))
        if plugin == "dgraformer":
            active = {int(v) % len(contexts) for v in np.asarray(batch["time_index"]).ravel()}
            contexts = [c for c in contexts if spec.context_index(c) in active]
        return contexts

    def contexts(batch):
        result = []
        for c in native_contexts(batch):
            graph = array(spec.context_weight(c))
            if plugin == "mtgnn":
                graph = [list(row) for row in zip(*graph)]
            require(len(graph) == len(labels) and all(len(row) == len(labels) for row in graph), "Reference plugin graph dimensions differ from its declared nodes; implement a custom backend")
            result.append({"id": spec.context_id(c), "type": spec.native_context_type, "label": spec.context_id(c),
                "edges": [{"source": str(s), "target": str(t), "weight": float(w)} for s, row in enumerate(graph) for t, w in enumerate(row) if s != t and w != 0]})
        return result

    def find(batch, cid):
        return next(c for c in native_contexts(batch) if spec.context_id(c) == cid)

    def probe(c):
        return {"context": {"type": spec.native_context_type, "index": spec.context_index(c), **({"layer": int(c["layer"])} if "layer" in c else {})}}

    def identity(batch, context):
        c = find(batch, context["id"])
        return adapter.predict_with_graph_override(batch, spec.identity_override(probe(c), config))["prediction"]

    def intervene(batch, request):
        require(request["protocolId"] in {p["id"] for p in protocols}, "Unsupported deletion scope")
        require(bool(request["contextIds"]), "Reference model deletion needs an exact context")
        c = find(batch, request["contextIds"][0])
        broader = request["protocolId"] == "all"
        if broader:
            applicable = native_contexts(batch)
            if plugin == "msgnet":
                applicable = [v for v in applicable if v["layer"] == c["layer"]]
            require(set(request["contextIds"]) == {spec.context_id(v) for v in applicable}, "Broader deletion must declare every affected native context")
        else:
            require(len(request["contextIds"]) == 1, "Single-context deletion takes exactly one context")
        source, target = int(request["source"]), int(request["target"])
        # The legacy MTGNN adapter accepts native row/column coordinates.
        if plugin == "mtgnn":
            source, target = target, source
        p = {**probe(c), "source": source, "target": target}
        return adapter.predict_with_graph_override(batch, spec.intervention_override_for_context(p, config, c, broader=broader))["prediction"]

    def native_call(callback):
        def wrapped(*args):
            previous = Path.cwd()
            os.chdir(resolved["source_root"])
            try:
                return callback(*args)
            finally:
                os.chdir(previous)
        return wrapped
    os.chdir(caller_directory)
    return FunctionBackend(metadata=metadata, load_sample=native_call(load_sample), truth=lambda b: b["y"][-horizon:, :], predict=native_call(adapter.predict), contexts=native_call(contexts), intervene=native_call(intervene), identity=native_call(identity), close=native_call(adapter.close))
