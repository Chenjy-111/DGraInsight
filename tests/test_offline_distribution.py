import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class OfflineDistributionTests(unittest.TestCase):
    def test_release_is_current_complete_and_self_contained(self):
        builder = module(ROOT / 'offline_app/build.py', 'build_offline')
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'release'
            builder.build(target)
            self.assertTrue((target / 'Start-Evaluation.cmd').exists())
            self.assertEqual(
                (target / 'dgraudit/model_specs.py').read_bytes(),
                (ROOT / 'offline_app/dgraudit/model_specs.py').read_bytes(),
            )
            for private in ('python-path.txt', '.venv-cpu', '.venv', 'runs', 'logs'):
                self.assertFalse((target / private).exists())
            for retired in ('legacy', 'dgraudit/v2', 'configs', 'third_party'):
                self.assertFalse((target / retired).exists(), retired)
            self.assertTrue((target / 'profiles/dgraformer.json').exists())
            self.assertTrue((target / 'profiles/msgnet.json').exists())
            self.assertTrue((target / 'profiles/mtgnn.json').exists())
            self.assertTrue((target / 'examples/stemgnn/stemgnn.py').exists())
            self.assertTrue((target / 'examples/stemgnn/base_model_fft_compat.py').exists())
            self.assertEqual(
                (target / 'examples/stemgnn/base_model_fft_compat.py').read_bytes(),
                (ROOT / 'offline_app/examples/stemgnn/base_model_fft_compat.py').read_bytes(),
            )
            self.assertTrue((target / 'examples/stemgnn/README.md').exists())
            self.assertTrue((target / 'requirements-core.txt').exists())
            self.assertTrue((target / 'docs/RESOURCE_MANIFEST.md').exists())
            self.assertEqual(
                (target / 'LICENSE').read_bytes(),
                (ROOT / 'LICENSE').read_bytes(),
            )
            self.assertEqual(
                (target / 'paper_resources/manifest.json').read_bytes(),
                (ROOT / 'paper_resources/manifest.json').read_bytes(),
            )
            self.assertFalse((target / 'adapters/agcrn.py').exists())
            self.assertNotIn('agcrn', (target / 'offline.py').read_text(encoding='utf-8').lower())
            help_result = subprocess.run(
                [sys.executable, '-B', 'offline.py', '--help'], cwd=target,
                capture_output=True, text=True,
            )
            self.assertEqual(help_result.returncode, 0, help_result.stderr)
            check = subprocess.run(
                [sys.executable, '-B', '-m', 'compileall', '-q', '.'],
                cwd=target, capture_output=True, text=True,
            )
            self.assertEqual(check.returncode, 0, check.stderr)
            registry = (target / 'dgraudit/model_specs.py').read_text(encoding='utf-8')
            for model in ('dgraformer', 'msgnet', 'mtgnn'):
                self.assertIn(f"'{model}'", registry)
            for path in target.rglob('*'):
                if path.suffix in ('.py', '.md', '.ps1', '.cmd', '.json'):
                    self.assertIsNone(re.search(r'[\u4e00-\u9fff]', path.read_text(encoding='utf-8-sig')), str(path))

    def test_builder_copies_only_declared_files(self):
        builder = module(ROOT / 'offline_app/build.py', 'build_offline_second')
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'release'
            builder.build(target)
            copied = {path.relative_to(target).as_posix() for path in target.rglob('*') if path.is_file()}
            self.assertNotIn('examples/stemgnn/screen_stemgnn.py', copied)
            self.assertNotIn('examples/stemgnn/verify_stemgnn_screen.py', copied)
            self.assertIn('docs/EVALUATION_GUIDE.md', copied)
            self.assertIn('docs/RESOURCE_MANIFEST.md', copied)
            self.assertIn('requirements-core.txt', copied)
            self.assertIn('dgraudit/evaluation.py', copied)
            self.assertIn('LICENSE', copied)
            self.assertIn('paper_resources/manifest.json', copied)
            self.assertIn('examples/stemgnn/base_model_fft_compat.py', copied)


if __name__ == '__main__':
    unittest.main()
