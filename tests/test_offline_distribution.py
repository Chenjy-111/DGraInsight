import importlib.util
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys
import re

ROOT = Path(__file__).resolve().parents[1]


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class OfflineDistributionTests(unittest.TestCase):
    def test_release_has_only_current_runtime(self):
        builder = module(ROOT / 'scripts/build_offline.py', 'build_offline')
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'release'
            builder.build(target)
            self.assertTrue((target / 'Start-Evaluation.cmd').exists())
            self.assertEqual((target / 'dgraudit/model_specs.py').read_bytes(), (ROOT / 'dgraudit/model_specs.py').read_bytes())
            self.assertNotIn('from .validation', (target / 'dgraudit/evaluation_plugins.py').read_text())
            for private in ('python-path.txt', '.venv-cpu', 'runs', 'logs'):
                self.assertFalse((target / private).exists())
            help_result = subprocess.run([sys.executable, '-B', 'offline.py', '--help'], cwd=target, capture_output=True, text=True)
            self.assertEqual(help_result.returncode, 0, help_result.stderr)
            self.assertTrue((target / 'adapters/template.py').exists())
            for old in ('dgraudit/v2', 'dgraudit/__main__.py', 'configs', 'legacy', 'third_party'):
                self.assertFalse((target / old).exists(), old)
            self.assertIn('official_backend', (target / 'dgraudit/evaluation_plugins.py').read_text())
            self.assertFalse((target / 'adapters/agcrn.py').exists())
            self.assertNotIn('agcrn', (target / 'offline.py').read_text(encoding='utf-8').lower())
            self.assertNotIn('def validate_audit_config', (target / 'dgraudit/model_specs.py').read_text())
            for path in target.rglob('*'):
                if path.suffix in ('.py', '.md', '.ps1', '.cmd', '.json'):
                    self.assertIsNone(re.search(r'[\u4e00-\u9fff]', path.read_text(encoding='utf-8-sig')), str(path))
            check = subprocess.run([sys.executable, '-B', '-c',
                "from dgraudit.model_specs import OFFICIAL_ADAPTER_REGISTRY as r; "
                "assert set(r) == {'dgraformer','msgnet','mtgnn'}; "
                "import json; from pathlib import Path; "
                "assert all(not r[n].validate_adapter_config(json.loads(Path('profiles',n+'.json').read_text())) for n in r)"],
                cwd=target, capture_output=True, text=True)
            self.assertEqual(check.returncode, 0, check.stderr)

    def test_local_copy_and_hook_preserve_original_and_data(self):
        builder = module(ROOT / 'scripts/build_offline.py', 'build_offline')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / 'source'
            (source / 'model').mkdir(parents=True)
            text = '        support_set = [torch.eye(node_num).to(supports.device), supports]\n'
            original = source / 'model/AGCN.py'
            original.write_text(text)
            data = root / 'user.npz'
            data.write_bytes(b'file integrity test, not model evidence')
            builder.build_agcrn_bundle(root / 'bundle')
            adapter = module(root / 'bundle/agcrn.py', 'external_example_test')
            result = adapter.prepare_resources({'source_root': str(source), 'dataset': {'path': str(data)}}, root / 'run')
            destination = Path(result['source_root'])
            self.assertEqual(original.read_text(), text)
            self.assertIn('support_override', (destination / 'model/AGCN.py').read_text())
            self.assertEqual(data.read_bytes(), (destination / 'data/PeMSD8/pems08.npz').read_bytes())

    def test_unknown_native_structure_fails_before_copy(self):
        builder = module(ROOT / 'scripts/build_offline.py', 'build_offline')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'source/model').mkdir(parents=True)
            (root / 'source/model/AGCN.py').write_text('unknown architecture')
            builder.build_agcrn_bundle(root / 'bundle')
            adapter = module(root / 'bundle/agcrn.py', 'external_example_test')
            with self.assertRaises(ValueError):
                adapter.prepare_resources({'source_root': str(root / 'source'), 'dataset': {'path': str(root / 'unused')}}, root / 'run')
            self.assertFalse((root / 'run/model').exists())
