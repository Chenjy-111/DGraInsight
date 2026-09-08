import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from dgraudit.evaluation import prepare_results, run_evaluation, validate_results, write_results
from dgraudit.examples.evaluation_functions_example import create_backend, forward, load_sample


class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "result.json"
        self.backend = create_backend({}, Path.cwd())

    def tearDown(self):
        self.tmp.cleanup()

    def run_fixture(self):
        return run_evaluation(self.backend, [0, 1], self.path, progress=lambda _: None)

    def test_independent_node_output_dimensions_and_signed_graph(self):
        d = self.run_fixture()
        self.assertEqual((len(d["nodes"]), len(d["outputs"]), d["horizon"]), (4, 2, 3))
        self.assertEqual(len(d["records"]), 8)
        self.assertTrue(any(e["weight"] < 0 for e in d["samples"][0]["contexts"][0]["edges"]))
        self.assertEqual(d["validation"]["identity"]["status"], "passed")
        self.assertEqual(d["validation"]["nativeIntervention"]["status"], "not_checked")
        # Independent expected forward, source 0 -> target 1 affects only first output.
        r = next(r for r in d["records"] if r["sampleId"] == "0" and r["source"] == "latent-a" and r["target"] == "latent-b")
        self.assertAlmostEqual(r["prediction"][0][0], 0.8)
        self.assertEqual([v[1] for v in r["prediction"]], [v[1] for v in forward(load_sample(0))])

    def test_metrics_only_graphless(self):
        d = self.run_fixture()
        for s in d["samples"]:
            s.pop("truth"); s.pop("baselinePrediction"); s["contexts"] = []
        d["nodes"] = []
        for r in d["records"]:
            r.pop("prediction"); r.pop("forecastStepErrorChange", None); r.pop("source"); r.pop("target"); r["contextIds"] = []
        self.assertEqual(validate_results(d)["records"][0]["metrics"], d["records"][0]["metrics"])

    def test_export_raw_derives_errors_and_does_not_mark_native_verified(self):
        d = self.run_fixture()
        d.pop("validation")
        for s in d["samples"]: s.pop("baselineMetrics")
        for r in d["records"]: r.pop("metrics")
        result = prepare_results(d)
        self.assertGreater(result["samples"][0]["baselineMetrics"]["mse"], 0)
        self.assertEqual(result["validation"]["identity"]["status"], "not_checked")

    def test_reject_wrong_shapes_finite_metrics_and_identity(self):
        d = self.run_fixture()
        mutations = [
            lambda x: x["records"][0]["prediction"].pop(),
            lambda x: x["records"][0]["metrics"].update(mae=99),
            lambda x: x["records"][0].update(source="not-a-node"),
            lambda x: x["records"][0].update(contextIds=["wrong-context"]),
            lambda x: x["records"][0].update(protocolId="unsupported"),
            lambda x: x["records"][0]["prediction"][0].__setitem__(0, float("nan")),
            lambda x: x["records"].append(copy.deepcopy(x["records"][0])),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                bad = copy.deepcopy(d); mutate(bad)
                with self.assertRaises(ValueError): validate_results(bad)

    def test_identity_mismatch_aborts_before_removal(self):
        self.backend.identity = lambda sample, context: [[0, 0]] * 3
        self.backend.intervene = lambda *_: self.fail("Removal must not execute")
        with self.assertRaisesRegex(ValueError, "Identity replay failed"):
            self.run_fixture()
        self.assertFalse(self.path.exists())

    def test_no_identity_callback_blocks_execution(self):
        self.backend.identity = None
        with self.assertRaisesRegex(ValueError, "requires identity"):
            self.run_fixture()

    def test_duplicate_requests_rejected_before_execution(self):
        r = {"sampleId": "0", "protocolId": "single", "contextIds": ["encoder:0"], "source": "latent-a", "target": "latent-b", "label": "a to b"}
        self.backend.intervene = lambda *_: self.fail("Removal must not execute")
        with self.assertRaises(ValueError):
            run_evaluation(self.backend, [0], self.path, requests=[r, r], progress=lambda _: None)

    def test_resume_reuses_only_finished_removals(self):
        original = self.backend.intervene
        calls = []
        def interrupted(batch, request):
            calls.append(request["id"])
            if len(calls) == 3: raise RuntimeError("Simulated interruption")
            return original(batch, request)
        self.backend.intervene = interrupted
        with self.assertRaises(RuntimeError): self.run_fixture()
        partial = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertEqual(partial["runStatus"], "partial")
        self.assertEqual(len(partial["records"]), 2)
        calls.clear()
        def resumed(batch, request):
            calls.append(request["id"])
            return original(batch, request)
        self.backend.intervene = resumed
        done = run_evaluation(self.backend, [0, 1], self.path, resume=True, progress=lambda _: None)
        self.assertEqual(len(calls), 6)
        self.assertEqual(len(done["records"]), 8)
        self.assertEqual(done["runStatus"], "complete")
        self.assertEqual(done["records"][:2], partial["records"])

    def test_resume_rejects_changed_inputs_without_overwrite(self):
        self.run_fixture()
        original_bytes = self.path.read_bytes()
        self.backend.metadata["provenance"]["checkpoint"] = "changed"
        with self.assertRaisesRegex(ValueError, "Resume inputs"):
            run_evaluation(self.backend, [0, 1], self.path, resume=True, progress=lambda _: None)
        self.assertEqual(original_bytes, self.path.read_bytes())

    def test_zero_effect_and_zero_baseline_are_valid(self):
        self.backend.truth = self.backend.predict
        self.backend.intervene = lambda sample, request: self.backend.predict(sample)
        d = self.run_fixture()
        self.assertEqual(d["records"][0]["metrics"], {"mae": 0, "mse": 0})

    def test_graph_edges_are_indexed_once_for_record_validation(self):
        result = self.run_fixture()
        class CountedEdges(list):
            def __iter__(self):
                self.iterations += 1
                return super().__iter__()
        counted = []
        for sample in result['samples']:
            for context in sample['contexts']:
                edges = CountedEdges(context['edges'])
                edges.iterations = 0
                context['edges'] = edges
                counted.append(edges)
        validate_results(result)
        self.assertTrue(all(edges.iterations == 1 for edges in counted))

    def test_bulk_plan_checks_capabilities_before_any_removal(self):
        self.backend.metadata['capabilities'] = {
            'supports_single_context': False, 'supports_all_contexts': False,
            'supports_batch': False, 'directed': True, 'node_semantics': 'latent'}
        self.backend.intervene = lambda *_: self.fail('Unsupported removal executed')
        with self.assertRaisesRegex(ValueError, 'NOT_SUPPORTED'):
            self.run_fixture()

    def test_runner_does_not_use_copying_export_writer(self):
        with patch('dgraudit.evaluation.prepare_results', side_effect=AssertionError('Full export copy called')):
            result = self.run_fixture()
        self.assertEqual(result['runStatus'], 'complete')
        self.assertIn('forecastStepErrorChange', result['records'][0])

    def test_resume_recovers_journal_ahead_of_snapshot_and_torn_tail(self):
        original = self.backend.intervene
        calls = []
        def interrupted(batch, request):
            calls.append(request['id'])
            if len(calls) == 4:
                raise RuntimeError('test interruption')
            return original(batch, request)
        self.backend.intervene = interrupted
        with self.assertRaises(RuntimeError):
            self.run_fixture()
        partial = json.loads(self.path.read_text(encoding='utf-8'))
        retained = copy.deepcopy(partial['records'])
        partial['records'] = []  # Simulate crash before a new periodic snapshot.
        self.path.write_text(json.dumps(partial), encoding='utf-8')
        journal = self.path.with_suffix('.json.journal.jsonl')
        with journal.open('ab') as stream:
            stream.write(b'{"id":"unfinished')
        calls.clear()
        def resumed(batch, request):
            calls.append(request['id'])
            return original(batch, request)
        self.backend.intervene = resumed
        result = run_evaluation(self.backend, [0, 1], self.path, resume=True, progress=lambda _: None)
        self.assertEqual(len(calls), 5)
        self.assertEqual(result['records'][:3], retained)
        self.assertEqual(len(result['records']), 8)

    def test_resume_rejects_modified_journal(self):
        self.run_fixture()
        journal = self.path.with_suffix('.json.journal.jsonl')
        lines = journal.read_text(encoding='utf-8').splitlines()
        changed = json.loads(lines[1])
        changed['metrics']['mae'] += 1
        lines[1] = json.dumps(changed)
        journal.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        original_bytes = self.path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'Conflicting duplicate'):
            run_evaluation(self.backend, [0, 1], self.path, resume=True, progress=lambda _: None)
        self.assertEqual(self.path.read_bytes(), original_bytes)


if __name__ == "__main__":
    unittest.main()
