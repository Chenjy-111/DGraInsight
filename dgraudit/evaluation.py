"""Portable edge-removal evaluation. No framework dependency for result import/export.

Arrays are [forecast step, output]; graph node ids are independent of outputs.
The runner delegates every intervention to the backend; it never edits adjacency.
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

VERSION = "evaluation.v1"
AGGREGATION = "mean_all_steps_outputs"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(x):
    return isinstance(x, (float, int)) and not isinstance(x, bool) and math.isfinite(x)


def array(value):
    if hasattr(value, "detach"):
        value = value.detach().cpu()
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, list) and len(value) == 1 and isinstance(value[0], list) and value[0] and isinstance(value[0][0], list):
        value = value[0]
    return value


def matrix(value, h, n, name):
    require(isinstance(value, list) and len(value) == h, f"{name}: expected {h} forecast steps")
    require(all(isinstance(row, list) and len(row) == n and all(number(v) for v in row) for row in value), f"{name}: expected {n} finite outputs per step")


def metrics(prediction, truth):
    errors = [float(p) - float(t) for pr, tr in zip(prediction, truth) for p, t in zip(pr, tr)]
    require(bool(errors), "Cannot evaluate empty predictions")
    result = {"mae": sum(abs(e) for e in errors) / len(errors), "mse": sum(e * e for e in errors) / len(errors)}
    require(all(number(v) for v in result.values()), "Metric overflow")
    return result


def error_profile(prediction, baseline, truth):
    return [{k: metrics([p], [t])[k] - metrics([b], [t])[k] for k in ("mae", "mse")} for p, b, t in zip(prediction, baseline, truth)]


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _unique(items, name):
    require(isinstance(items, list), f"{name} must be an array")
    ids = [item.get("id") if isinstance(item, dict) else None for item in items]
    require(all(_text(i) for i in ids) and len(set(ids)) == len(ids), f"{name} needs unique nonempty string ids")
    return set(ids)


def validate_results(data):
    """Strict structural / arithmetic validation, never a claim of native correctness."""
    require(isinstance(data, dict) and data.get("version") == VERSION, f"Expected {VERSION}")
    for key in ("model", "dataset", "nodeMeaning"):
        require(_text(data.get(key)), f"{key} is required")
    h, outputs = data.get("horizon"), data.get("outputs")
    require(isinstance(h, int) and not isinstance(h, bool) and h > 0, "horizon must be a positive integer")
    require(isinstance(outputs, list) and bool(outputs) and all(_text(v) for v in outputs) and len(set(outputs)) == len(outputs), "outputs must be unique labels")
    n = len(outputs)
    if "capabilities" in data:
        caps = data["capabilities"]
        require(isinstance(caps, dict) and all(isinstance(caps.get(k), bool) for k in ("supports_single_context", "supports_all_contexts", "supports_batch", "directed")), "Capabilities require explicit boolean flags")
        require(caps.get("node_semantics") in ("observed", "latent", "custom"), "Invalid capability node semantics")
    node_ids = _unique(data.get("nodes"), "nodes")
    require(all(_text(x.get("label")) for x in data["nodes"]), "Node labels are required")
    protocol_ids = _unique(data.get("protocols"), "protocols")
    require(bool(protocol_ids), "At least one protocol is required")
    for p in data["protocols"]:
        require(all(_text(p.get(k)) for k in ("label", "description", "scope")), "Protocol label, description and scope are required")
    measurement = data.get("measurement", {})
    require(isinstance(measurement, dict) and measurement.get("aggregation") == AGGREGATION and all(_text(measurement.get(k)) for k in ("space", "units")), "Declare metric space, units and mean_all_steps_outputs aggregation")
    require(isinstance(data.get("provenance"), dict), "provenance must be an object (unknown values may be omitted)")
    require(data.get("runStatus") in ("complete", "partial"), "runStatus must be complete or partial")
    for field in ("identity", "nativeIntervention"):
        check = data.get("validation", {}).get(field, {})
        require(isinstance(check, dict) and check.get("status") in ("passed", "failed", "not_checked") and _text(check.get("detail")), f"validation.{field} needs status and detail")
    _unique(data.get("samples"), "samples")
    require(bool(data["samples"]), "At least one sample is required")
    samples = {s["id"]: s for s in data["samples"]}

    def check_metrics(value, name):
        require(isinstance(value, dict) and all(number(value.get(k)) and value[k] >= 0 for k in ("mae", "mse")), f"{name}: MAE/MSE must be finite and nonnegative")

    def check_pair(pred, truth, supplied, name):
        if pred is not None:
            matrix(pred, h, n, name)
        if pred is not None and truth is not None:
            computed = metrics(pred, truth)
            require(all(math.isclose(computed[k], supplied[k], rel_tol=1e-8, abs_tol=1e-10) for k in computed), f"{name}: stored metrics do not match raw arrays")

    for s in samples.values():
        check_metrics(s.get("baselineMetrics"), "baselineMetrics")
        if s.get("truth") is not None:
            matrix(s["truth"], h, n, "truth")
        check_pair(s.get("baselinePrediction"), s.get("truth"), s["baselineMetrics"], "baselinePrediction")
        _unique(s.get("contexts"), "contexts")
        for c in s["contexts"]:
            require(_text(c.get("type")) and _text(c.get("label")), "Context type and label are required")
            require(isinstance(c.get("edges"), list), "Context edges must be an array")
            seen = set()
            for e in c["edges"]:
                require(isinstance(e, dict) and e.get("source") in node_ids and e.get("target") in node_ids and ("weight" not in e or (number(e["weight"]) and e["weight"] != 0)), "Edge requires declared nodes; optional weight must be nonzero and finite")
                key = (e["source"], e["target"])
                require(key not in seen, "Duplicate directed edge")
                seen.add(key)
    _unique(data.get("records"), "records")
    requests = set()
    for r in data["records"]:
        require(r.get("sampleId") in samples and r.get("protocolId") in protocol_ids and _text(r.get("label")), "Record sample, protocol and label are required")
        s = samples[r["sampleId"]]
        context_ids = r.get("contextIds")
        require(isinstance(context_ids, list) and all(_text(c) for c in context_ids) and len(set(context_ids)) == len(context_ids) and set(context_ids) <= {c["id"] for c in s["contexts"]}, "Record contextIds must refer to unique sample contexts")
        has_edge = "source" in r or "target" in r
        if has_edge:
            require(r.get("source") in node_ids and r.get("target") in node_ids, "Record edge must refer to declared graph nodes")
            if context_ids:
                require(any(c["id"] in context_ids and any(e["source"] == r["source"] and e["target"] == r["target"] for e in c["edges"]) for c in s["contexts"]), "Removed edge absent from selected contexts")
        key = (r["sampleId"], r["protocolId"], tuple(sorted(context_ids)), r.get("source"), r.get("target"), "" if has_edge else r["label"])
        require(key not in requests, "Duplicate intervention request")
        requests.add(key)
        check_metrics(r.get("metrics"), "record metrics")
        check_pair(r.get("prediction"), s.get("truth"), r["metrics"], "prediction")
        if "errorChange" in r:
            expected = {k: r["metrics"][k] - s["baselineMetrics"][k] for k in ("mae", "mse")}
            require(all(number(r["errorChange"].get(k)) and math.isclose(r["errorChange"][k], expected[k], rel_tol=1e-8, abs_tol=1e-10) for k in expected), "Stored error change mismatch")
        if "forecastStepErrorChange" in r:
            require(r.get("prediction") is not None and s.get("truth") is not None and s.get("baselinePrediction") is not None, "Step profile requires raw arrays")
            expected = error_profile(r["prediction"], s["baselinePrediction"], s["truth"])
            values = r["forecastStepErrorChange"]
            require(isinstance(values, list) and len(values) == h and all(isinstance(v, dict) and all(number(v.get(k)) and math.isclose(v[k], e[k], rel_tol=1e-8, abs_tol=1e-10) for k in e) for v,e in zip(values,expected)), "Stored step error profile mismatch")
    return data


def prepare_results(data):
    """User export entry: accept raw arrays or aggregate metrics; derive missing metrics."""
    result = copy.deepcopy(data)
    result.setdefault("version", VERSION)
    result.setdefault("runStatus", "complete")
    result.setdefault("provenance", {})
    result.setdefault("sourceMode", "results")
    result.setdefault("validation", {
        "identity": {"status": "not_checked", "detail": "External results; no identity replay performed by DGraInsight."},
        "nativeIntervention": {"status": "not_checked", "detail": "External intervention implementation has not been verified by DGraInsight."},
    })
    for s in result.get("samples", []):
        s.setdefault("contexts", [])
        for field in ("truth", "baselinePrediction"):
            if s.get(field) is not None:
                s[field] = array(s[field])
        if s.get("truth") is not None and s.get("baselinePrediction") is not None:
            matrix(s["truth"], result["horizon"], len(result["outputs"]), "truth")
            matrix(s["baselinePrediction"], result["horizon"], len(result["outputs"]), "baselinePrediction")
            s.setdefault("baselineMetrics", metrics(s["baselinePrediction"], s["truth"]))
    samples = {s["id"]: s for s in result.get("samples", [])}
    for r in result.get("records", []):
        r.setdefault("contextIds", [])
        if r.get("prediction") is not None:
            r["prediction"] = array(r["prediction"])
            truth = samples.get(r.get("sampleId"), {}).get("truth")
            if truth is not None:
                matrix(r["prediction"], result["horizon"], len(result["outputs"]), "prediction")
                r.setdefault("metrics", metrics(r["prediction"], truth))
        sample = samples.get(r.get("sampleId"), {})
        if "metrics" in r and "baselineMetrics" in sample:
            r.setdefault("errorChange", {k: r["metrics"][k] - sample["baselineMetrics"][k] for k in ("mae", "mse")})
        if all(sample.get(k) is not None for k in ("truth", "baselinePrediction")) and r.get("prediction") is not None:
            r.setdefault("forecastStepErrorChange", error_profile(r["prediction"], sample["baselinePrediction"], sample["truth"]))
    return validate_results(result)


def write_results(data, path):
    result = prepare_results(data)
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2), encoding="utf-8")
    temporary.replace(destination)
    return result


class FunctionBackend:
    """Connect existing code. Callbacks receive the user's opaque sample unchanged.

    load_sample(id) -> opaque sample; truth(sample) -> [H,O]
    contexts(sample) -> portable contexts; intervene(sample, request) -> prediction
    identity(sample, context) is mandatory for execution; result-only import needs no callback.
    """
    def __init__(self, *, metadata: dict, load_sample: Callable, truth: Callable,
                 predict: Callable, contexts: Callable, intervene: Callable,
                 identity: Callable | None = None, close: Callable | None = None):
        self.metadata = metadata
        self.load_sample = load_sample
        self.truth = truth
        self.predict = predict
        self.contexts = contexts
        self.intervene = intervene
        self.identity = identity
        self.close = close or (lambda: None)


def fingerprint(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, allow_nan=False).encode()).hexdigest()


def run_evaluation(backend, sample_ids, output, *, requests=None, resume=False, progress=print):
    """Persist each completed intervention; resume only against matching inputs/baselines.

    Explicit requests carry sampleId, protocolId, contextIds, source/target and label.
    Without requests, enumerate non-self edges for the backend's 'single' protocol.
    """
    from .evaluation_validation import prediction, check_request
    require(callable(backend.identity), "NOT_SUPPORTED: execution requires identity intervention")
    require(bool(sample_ids) and len({str(s) for s in sample_ids}) == len(sample_ids), "Select unique samples")
    destination = Path(output).resolve()
    require(resume or not destination.exists(), "Output exists; choose another path or use --resume")
    previous = validate_results(json.loads(destination.read_text(encoding="utf-8"))) if resume and destination.exists() else None
    result = {**copy.deepcopy(backend.metadata), "version": VERSION, "runStatus": "partial", "samples": [], "records": []}
    result.setdefault("provenance", {})
    result["provenance"]["timestampUtc"] = previous["provenance"].get("timestampUtc") if previous else datetime.now(timezone.utc).isoformat()
    result["validation"] = {
        "identity": {"status": "not_checked", "detail": "No identity callback supplied."},
        "nativeIntervention": {"status": "not_checked", "detail": "The runner does not independently inspect native message passing. Review the backend's implementation and native validation reports."},
    }
    runtime = {}
    try:
        for sample_id in sample_ids:
            progress(f"Baseline and contexts: {sample_id}")
            batch = backend.load_sample(sample_id)
            truth, baseline = array(backend.truth(batch)), array(backend.predict(batch))
            matrix(truth, result["horizon"], len(result["outputs"]), "truth")
            matrix(baseline, result["horizon"], len(result["outputs"]), "baseline")
            contexts = backend.contexts(batch)
            require(isinstance(contexts, list), "contexts callback must return a list")
            if backend.identity:
                for c in contexts or [None]:
                    same = prediction(backend.identity(batch, c))
                    matrix(same, result["horizon"], len(result["outputs"]), "identity prediction")
                    require(all(abs(a-b) <= 1e-6 + 1e-5 * abs(b) for ar, br in zip(same, baseline) for a, b in zip(ar, br)), f"Identity replay failed for sample {sample_id}; no removals executed")
            result["samples"].append({"id": str(sample_id), "truth": truth, "baselinePrediction": baseline, "baselineMetrics": metrics(baseline, truth), "contexts": contexts})
            runtime[str(sample_id)] = batch
        if backend.identity:
            result["validation"]["identity"] = {"status": "passed", "detail": "Every selected sample/context matched baseline, atol=1e-6, rtol=1e-5. This does not establish correct edge removal."}
        plan = []
        if requests is None:
            require(any(p["id"] == "single" for p in result["protocols"]), "Automatic enumeration requires a declared single protocol; otherwise provide requests")
            for s in result["samples"]:
                for c in s["contexts"]:
                    for e in c["edges"]:
                        if e["source"] != e["target"]:
                            plan.append({"sampleId": s["id"], "protocolId": "single", "contextIds": [c["id"]], "source": e["source"], "target": e["target"], "label": f"{e['source']} → {e['target']}"})
        else:
            require(isinstance(requests, list), "requests must be an array")
            plan = copy.deepcopy(requests)
        for r in plan:
            r["id"] = fingerprint({k: v for k, v in r.items() if k != "id"})[:24]
        # Validate every requested identity and capability before the first removal.
        probe = {**result, "records": [{**r, "metrics": {"mae": 0, "mse": 0}} for r in plan]}
        validate_results(probe)
        require(bool(plan), "UNAVAILABLE: no selected valid relations")
        for request in plan:
            check_request(backend.metadata, next(s for s in result["samples"] if s["id"] == request["sampleId"]), request)
        run_key = fingerprint({"metadata": backend.metadata, "samples": result["samples"], "requests": plan})
        result["provenance"]["runFingerprint"] = run_key
        if previous:
            require(previous["provenance"].get("runFingerprint") == run_key, "Resume inputs, backend identity or requests changed; choose a new output")
            planned = {r["id"]: r for r in plan}
            require(all(r["id"] in planned and all(r.get(k) == v for k, v in planned[r["id"]].items()) for r in previous["records"]), "Resume records differ from the declared requests")
            result["records"] = previous["records"]
        done = {r["id"] for r in result["records"]}
        write_results(result, destination)
        for i, request in enumerate(plan):
            if request["id"] in done:
                continue
            progress(f"Removal {i+1}/{len(plan)}: sample {request['sampleId']} {request['label']}")
            outcome = backend.intervene(runtime[request["sampleId"]], request)
            pred = prediction(outcome)
            matrix(pred, result["horizon"], len(result["outputs"]), "intervention prediction")
            truth = next(s["truth"] for s in result["samples"] if s["id"] == request["sampleId"])
            record = {**request, "prediction": pred, "metrics": metrics(pred, truth)}
            if isinstance(outcome, dict) and "graphStateVerification" in outcome:
                state = outcome["graphStateVerification"]
                require(state.get("status") in ("passed", "unavailable") and _text(state.get("detail")), "Native graph-state check failed or invalid")
                record["graphStateVerification"] = state
            result["records"].append(record)
            write_results(result, destination)
        result["runStatus"] = "complete"
        return write_results(result, destination)
    finally:
        backend.close()
