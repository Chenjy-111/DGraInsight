"""Build the current-only user distribution from an explicit file allowlist."""
from pathlib import Path
import shutil
import argparse

ROOT = Path(__file__).resolve().parents[1]


def build(destination):
    destination = Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=False)
    files = ["dgraudit/evaluation.py", "dgraudit/evaluation_validation.py",
             "dgraudit/thin_adapter.py", "dgraudit/cli/evaluate.py",
             "dgraudit/adapters.py", "dgraudit/msgnet_semantics.py"]
    for name in files:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, target)
    for name in ("dgraudit/__init__.py", "dgraudit/cli/__init__.py"):
        (destination / name).write_text("", encoding="utf-8")
    for name in ('evaluation_plugins.py', 'model_specs.py'):
        shutil.copy2(ROOT / 'dgraudit' / name, destination / 'dgraudit' / name)
    for name in ('Start-Evaluation.cmd', 'Start-Offline.ps1', 'offline.py', 'README.md', 'ADAPTER_GUIDE.md', 'adapters/template.py'):
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / 'offline_app' / name, target)
    import json
    (destination / 'profiles').mkdir()
    for model in ('dgraformer', 'msgnet', 'mtgnn'):
        profile = json.loads((ROOT / f'configs/evaluation_{model}.json').read_text())
        profile['source_root'] = ''
        profile['checkpoint'] = {'path': ''}
        profile['dataset']['path'] = ''
        profile['dataset'].pop('sha256', None)
        (destination / f'profiles/{model}.json').write_text(json.dumps(profile, indent=2), encoding='utf-8')
    print(destination)


def build_agcrn_bundle(destination):
    """Separately distributed example; the evaluator has no AGCRN-specific branches."""
    destination = Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=False)
    source = (ROOT / 'integrations/agcrn_external/agcrn_adapter.py').read_text(encoding='utf-8')
    source += '\n\n' + (ROOT / 'integrations/agcrn_external/local_resources.py').read_text(encoding='utf-8')
    (destination / 'agcrn.py').write_text(source, encoding='utf-8')
    shutil.copy2(ROOT / 'integrations/agcrn_external/LOCAL_ADAPTER_GUIDE.md', destination / 'README.md')


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("destination")
    parser.add_argument('--agcrn-example', help='Build a separate external example adapter directory')
    parser.add_argument("--zip", action="store_true", help="Also create ZIP archives next to each package")
    args = parser.parse_args()
    build(args.destination)
    if args.agcrn_example:
        build_agcrn_bundle(args.agcrn_example)

    if args.zip:
        for folder in filter(None, (args.destination, args.agcrn_example)):
            folder = Path(folder).resolve()
            archive = shutil.make_archive(str(folder), 'zip', folder.parent, folder.name)
            print(archive)
