"""Independent native-forward / consumed-einsum verification of frozen AGCRN evidence."""
import hashlib
import json
import subprocess
import sys
import types
from pathlib import Path
import torch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from agcrn_adapter import AGCRNAdapter


def main():
    config = json.loads((ROOT / "configs/evaluation_agcrn_external.json").read_text())
    config["config_dir"] = str(ROOT / "configs")
    adapter = AGCRNAdapter()
    adapter.load(config)
    path = ROOT / "public/data/evaluation/agcrn.json"
    data = json.loads(path.read_text())
    repo = ROOT / "third_party/AGCRN"
    pristine = types.ModuleType("pristine_agcn")
    exec(compile(subprocess.check_output(["git", "-C", str(repo), "show", "HEAD:model/AGCN.py"], text=True), "upstream:AGCN.py", "exec"), pristine.__dict__)
    native_einsum = torch.einsum
    expected = None
    consumed = []
    count = 0
    def inspect(equation, *operands):
        nonlocal count
        if equation == "knm,bmc->bknc":
            support = operands[0]
            assert torch.equal(support[0], torch.eye(170)), "Native identity support changed"
            if expected is not None:
                assert torch.equal(support[1], expected), "Consumed support differs from independent removal"
                count += 1
            consumed.append(support[1].detach().clone())
        return native_einsum(equation, *operands)
    torch.einsum = inspect
    maximum = 0.0
    results = []
    try:
        for sample_data in data["samples"]:
            sample = adapter.load_sample(sample_data["id"])
            consumed.clear()
            base = adapter.predict(sample)
            assert len(consumed) == 6
            original_graph = consumed[0]
            assert all(torch.equal(g, original_graph) for g in consumed)
            # Execute the exact upstream forward body, loaded from the pinned Git revision.
            for module in adapter.modules:
                module.forward = types.MethodType(pristine.AVWGCN.forward, module)
            try:
                clean_base = adapter.predict(sample)
            finally:
                for module in adapter.modules:
                    del module.forward
            assert torch.equal(clean_base, base), "Optional-hook patch altered normal upstream forward"
            assert torch.equal(base, torch.tensor(sample_data["baselinePrediction"])), "Stored baseline mismatch"
            assert torch.equal(sample.truth, torch.tensor(sample_data["truth"])), "Stored truth mismatch"
            for edge in sample_data["contexts"][0]["edges"]:
                assert float(original_graph[int(edge["target"]), int(edge["source"])]) == edge["weight"]
            for record in (r for r in data["records"] if r["sampleId"] == sample.id):
                # Independent mask-based removal; never call adapter intervention helper.
                mask = torch.ones_like(original_graph)
                mask[int(record["target"]), int(record["source"])] = 0
                expected = original_graph * mask
                target = int(record["target"])
                expected[target] /= expected[target].sum()
                for module in adapter.modules:
                    module.support_override = lambda support: expected.clone()
                before = count
                try:
                    prediction = adapter.predict(sample)
                finally:
                    for module in adapter.modules:
                        del module.support_override
                assert count - before == 6
                stored = torch.tensor(record["prediction"])
                difference = float((prediction - stored).abs().max())
                maximum = max(maximum, difference)
                assert torch.equal(prediction, stored), "Stored adapter removal differs from independent native forecast"
                results.append({"sampleId": sample.id, "source": record["source"], "target": record["target"],
                    "maxPredictionDifference": difference, "maxChangeFromBaseline": float((prediction-base).abs().max())})
                expected = None
        report = {"status": "passed", "model": "AGCRN", "sourceRevision": data["provenance"]["sourceRevision"],
            "pristineForwardMatched": True, "samples": len(data["samples"]), "records": len(results),
            "consumedEinsumSupportChecks": count, "maxPredictionDifference": maximum,
            "method": "Load pristine AVWGCN.forward from pinned source revision; compare patched no-hook baseline. Independently mask native support[target,source], inspect original knm,bmc->bknc operands (including identity term) at every gate/update/timestep, compare real original-forward predictions.",
            "results": results}
        destination = ROOT / "integrations/agcrn_external/native_validation.json"
        destination.write_text(json.dumps(report, indent=2))
        digest = hashlib.sha256(destination.read_bytes()).hexdigest()
        data["validation"]["nativeIntervention"] = {"status": "passed", "detail": f"Independent native verification: pristine forward equality; {count} consumed einsum supports; {len(results)} predictions exactly matched. Report integrations/agcrn_external/native_validation.json SHA256 {digest}"}
        # Annotate verification only; no numerical array or metric changes.
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
    finally:
        torch.einsum = native_einsum


if __name__ == "__main__": main()
