"""Six model-independent execution preflight checks. No adjacency modification."""
from __future__ import annotations

from .evaluation import array, matrix, metrics, require, validate_results

CHECKS = [("V1", "Adapter load"), ("V2", "Sample load"), ("V3", "Baseline forward"),
          ("V4", "Relation extraction"), ("V5", "Identity intervention"), ("V6", "Edge intervention")]


def prediction(outcome):
    return array(outcome["prediction"] if isinstance(outcome, dict) and "prediction" in outcome else outcome)


def check_request(metadata, sample, request):
    require(request["sampleId"] == sample["id"], "Requested sample is not the loaded sample")
    protocols = {p["id"] for p in metadata["protocols"]}
    require(request["protocolId"] in protocols, "NOT_SUPPORTED: requested intervention scope")
    caps = metadata.get("capabilities", {})
    if request["protocolId"] == "all":
        require(caps.get("supports_all_contexts", True), "NOT_SUPPORTED: all-context intervention")
    if request["protocolId"] == "single":
        require(len(request.get("contextIds", [])) == 1, "Single-context intervention requires exactly one context")
        require(caps.get("supports_single_context", True), "NOT_SUPPORTED: single-context intervention")
    probe = {**metadata, "version": "evaluation.v1", "runStatus": "partial", "provenance": {},
        "validation": {k: {"status": "not_checked", "detail": "Preflight in progress"} for k in ("identity", "nativeIntervention")},
        "samples": [sample], "records": [{**request, "id": "preflight", "metrics": {"mae": 0, "mse": 0}}]}
    validate_results(probe)


def validate_backend(backend, sample_id, requests=None):
    report = {"version": "evaluation.validation.v1", "status": "FAIL", "checks": [],
        "graphStateVerification": {"status": "unavailable", "detail": "Backend did not report native graph-state verification."}}
    current = 0
    def passed(detail):
        nonlocal current
        key, label = CHECKS[current]
        report["checks"].append({"id": key, "label": label, "status": "PASS", "detail": detail})
        current += 1
    try:
        require(backend is not None, "Backend was not loaded")
        passed("External adapter or maintained plugin loaded; model metadata available.")
        batch = backend.load_sample(sample_id)
        truth = array(backend.truth(batch))
        h, n = backend.metadata["horizon"], len(backend.metadata["outputs"])
        matrix(truth, h, n, "ground truth")
        passed(f"Explicit sample {sample_id}; finite truth [{h},{n}].")
        baseline = prediction(backend.predict(batch))
        matrix(baseline, h, n, "baseline")
        passed(f"Original forward returned finite [{h},{n}] prediction.")
        contexts = backend.contexts(batch)
        require(isinstance(contexts, list) and contexts, "UNAVAILABLE: no relational context")
        eligible = [(c, e) for c in contexts for e in c["edges"] if e["source"] != e["target"]]
        require(bool(eligible), "UNAVAILABLE: no valid non-self relation")
        sample = {"id": str(sample_id), "contexts": contexts, "baselineMetrics": metrics(baseline, truth), "baselinePrediction": baseline, "truth": truth}
        if requests is not None:
            request = next((r for r in requests if r["sampleId"] == str(sample_id)), None)
            require(request is not None, "No selected relation for the preflight sample; no fallback performed")
        else:
            c, e = eligible[0]
            request = {"sampleId": str(sample_id), "protocolId": "single", "contextIds": [c["id"]], "source": e["source"], "target": e["target"], "label": f"{e['source']} -> {e['target']}"}
        check_request(backend.metadata, sample, request)
        passed(f"{len(contexts)} contexts, {len(eligible)} eligible relations; selected identity validated.")
        require(callable(backend.identity), "NOT_SUPPORTED: identity intervention callback is required for execution")
        max_difference = 0.0
        for c in contexts:
            same = prediction(backend.identity(batch, c))
            matrix(same, h, n, "identity")
            max_difference = max(max_difference, max(abs(a-b) for ar, br in zip(same, baseline) for a, b in zip(ar, br)))
            require(all(abs(a-b) <= 1e-6 + 1e-5*abs(b) for ar, br in zip(same, baseline) for a, b in zip(ar, br)), "Identity intervention differs from baseline")
        passed(f"All contexts matched; max difference={max_difference:.9g}, atol=1e-6, rtol=1e-5. Does not by itself establish correct removal.")
        outcome = backend.intervene(batch, request)
        changed = prediction(outcome)
        matrix(changed, h, n, "intervention")
        if isinstance(outcome, dict) and "graphStateVerification" in outcome:
            graph_check = outcome["graphStateVerification"]
            require(graph_check.get("status") in ("passed", "failed", "unavailable") and bool(graph_check.get("detail")), "Invalid graph-state verification declaration")
            report["graphStateVerification"] = graph_check
            require(graph_check["status"] != "failed", graph_check["detail"])
        passed(f"Real requested intervention returned finite [{h},{n}] forecast; a zero response is allowed.")
        report.update(status="PASS", sampleId=str(sample_id), request=request,
            baselineMetrics=metrics(baseline, truth), interventionMetrics=metrics(changed, truth))
    except Exception as exc:
        key, label = CHECKS[min(current, 5)]
        status = "NOT_SUPPORTED" if "NOT_SUPPORTED" in str(exc) else "UNAVAILABLE" if "UNAVAILABLE" in str(exc) else "FAIL"
        report["checks"].append({"id": key, "label": label, "status": status, "detail": str(exc)})
        for key, label in CHECKS[current+1:]:
            report["checks"].append({"id": key, "label": label, "status": "UNAVAILABLE", "detail": "Earlier preflight check did not pass."})
    return report


def render_report(report):
    lines = ["DGraInsight Adapter Validation", ""]
    for c in report["checks"]:
        lines.append(f"{c['label']:.<32} {c['status']}")
        if c["status"] != "PASS":
            lines.append("  " + c["detail"])
    lines += ["", f"Validation: {report['status']}", "Graph-state verification: " + report["graphStateVerification"]["status"].upper()]
    return "\n".join(lines)
