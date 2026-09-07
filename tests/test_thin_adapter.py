import copy, tempfile, unittest
from pathlib import Path
from dgraudit.thin_adapter import connect_adapter
from dgraudit.evaluation import run_evaluation
from dgraudit.evaluation_validation import validate_backend
from integrations.contract_fixture.adapter import FixtureAdapter

class ThinContractTests(unittest.TestCase):
    def backend(self): return connect_adapter(FixtureAdapter(), {})
    def test_six_checks_optional_weight_and_dictionary_prediction(self):
        b = self.backend(); r = validate_backend(b, 0)
        self.assertEqual([c["status"] for c in r["checks"]], ["PASS"]*6)
        self.assertEqual(r["graphStateVerification"]["status"], "unavailable")
        with tempfile.TemporaryDirectory() as t:
            result = run_evaluation(b, [0,1], Path(t)/"manifest.json", progress=lambda _: None)
            self.assertEqual(len(result["records"]), 8)
            self.assertNotIn("weight", result["samples"][0]["contexts"][0]["edges"][0])
    def test_identity_failure_stops_real_removal(self):
        b=self.backend(); b.identity=lambda *_: [[9,9]]*3
        b.intervene=lambda *_: self.fail("Must not remove")
        r=validate_backend(b,0)
        self.assertEqual(r["checks"][4]["status"],"FAIL")
        self.assertEqual(r["checks"][5]["status"],"UNAVAILABLE")
    def test_missing_identity_is_not_supported(self):
        b=self.backend(); b.identity=None
        self.assertEqual(validate_backend(b,0)["checks"][4]["status"],"NOT_SUPPORTED")
    def test_wrong_sample_not_substituted(self):
        b=self.backend(); original=b.load_sample
        b.load_sample=lambda _: original(1)
        r=validate_backend(b,0)
        # Function route receives opaque batches; class bridge itself owns exact identity.
        adapter=FixtureAdapter(); original=adapter.load_sample
        adapter.load_sample=lambda _: original(1)
        b=connect_adapter(adapter,{})
        self.assertEqual(validate_backend(b,0)["checks"][1]["status"],"FAIL")
    def test_unsupported_all_is_not_replaced_with_single(self):
        b=self.backend(); b.intervene=lambda *_: self.fail("Must not remove")
        r=validate_backend(b,0,[{"sampleId":"0","protocolId":"all","contextIds":["encoder:0"],"source":"latent-a","target":"latent-b","label":"remove"}])
        self.assertEqual(r["checks"][3]["status"],"NOT_SUPPORTED")
    def test_native_graph_failure_fails_preflight(self):
        b=self.backend(); b.intervene=lambda s,r: {"prediction": b.predict(s), "graphStateVerification":{"status":"failed","detail":"Requested entry remained nonzero"}}
        self.assertEqual(validate_backend(b,0)["checks"][5]["status"],"FAIL")

if __name__ == "__main__": unittest.main()
