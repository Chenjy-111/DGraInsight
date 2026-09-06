"""Regression checks for scientific coordinate meaning, not forecast synthesis."""
import copy
import json
from pathlib import Path
import unittest

import numpy as np

from dgraudit.msgnet_semantics import correct_legacy_graph, native_edge_indices, semantics_errors

ROOT = Path(__file__).resolve().parents[1]


class MSGNetSemanticsTests(unittest.TestCase):
    def test_native_contraction_direction(self):
        # Exact index formula in upstream MSGBlock.nconv: A[v,w] is w -> v.
        x = np.zeros((1, 1, 3, 1)); x[0, 0, 2, 0] = 1
        a = np.zeros((3, 3)); a[native_edge_indices(2, 0)] = 1
        out = np.einsum('ncwl,vw->ncvl', x, a)
        np.testing.assert_array_equal(out.ravel(), [1, 0, 0])

    def test_frozen_predictions_follow_corrected_edge(self):
        session = json.loads((ROOT / 'public/data/evidence/msgnet_etth1_session_v2.json').read_text())
        self.assertEqual(semantics_errors(session), [])
        candidates = {c['candidate_id']: c for c in session['candidate_relations']}
        root = ROOT / 'artifacts/msgnet_frozen14'
        records = {r['case_id']: r for r in map(json.loads, (root / 'intervention_records.jsonl').read_text().splitlines())}
        for case in session['case_evidence']:
            candidate = candidates[case['candidate_id']]
            record = records[case['case_evidence_id']]
            self.assertEqual((candidate['target'], candidate['source']), (record['source'], record['target']))
            self.assertEqual(candidate['source_name'], f"G{record['target']}")
            actual = np.load(root / record['intervention_prediction_file'], allow_pickle=False)
            np.testing.assert_array_equal(actual, case['intervention_output_reference']['value']['values'])
        bad = copy.deepcopy(session)
        bad['candidate_relations'][0]['source_name'] = 'HUFL'
        self.assertTrue(semantics_errors(bad))
        del bad['model']['graph_semantics']
        self.assertTrue(semantics_errors(bad))

    def test_migration_is_idempotent_and_preserves_forecasts(self):
        legacy = json.loads((ROOT / 'tests/fixtures/msgnet_graph_core_baseline.json').read_text())
        original = copy.deepcopy(legacy)
        correct_legacy_graph(legacy)
        corrected = copy.deepcopy(legacy)
        correct_legacy_graph(legacy)
        self.assertEqual(legacy, corrected)
        for before, after in zip(original['samples'], legacy['samples']):
            self.assertEqual(before['baseline_prediction'], after['baseline_prediction'])
            for b, a in zip(before['contexts'], after['contexts']):
                np.testing.assert_array_equal(np.array(b['graphs']['adaptive']['values']).T, a['graphs']['adaptive']['values'])


if __name__ == '__main__':
    unittest.main()
