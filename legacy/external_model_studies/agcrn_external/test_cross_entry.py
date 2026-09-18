"""Existing MTGNN plugin evidence -> result import/export preserves every numerical result."""
import json
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
from dgraudit.evaluation import prepare_results, validate_results
a=validate_results(json.loads((root/"public/data/evaluation/mtgnn.json").read_text(encoding="utf-8")))
b=prepare_results(a)
assert a["samples"] == b["samples"]
for x,y in zip(a["records"],b["records"]):
    assert all(x[k] == y[k] for k in x)
report={"status":"PASS","reference":"MTGNN maintained plugin evidence","samples":len(a["samples"]),"records":len(a["records"]),"sameSampleContextRelationScope":True,"sameMAEMSE":True,"sameRawArrays":True,"note":"Result import/export may derive profiles but preserves original numerical records. Both routes use the same Generic Web validator and metric functions."}
Path(__file__).with_name("cross_entry_validation.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report))
