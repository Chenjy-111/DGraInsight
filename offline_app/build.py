"""Build the paper-aligned Offline Evaluator from this self-contained folder."""
from pathlib import Path
import shutil
import argparse

ROOT = Path(__file__).resolve().parent


def build(destination):
    destination = Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=False)
    files = [
        "dgraudit/__init__.py", "dgraudit/__main__.py", "dgraudit/README.md",
        "dgraudit/evaluation.py", "dgraudit/evaluation_validation.py",
        "dgraudit/evaluation_plugins.py", "dgraudit/model_specs.py",
        "dgraudit/thin_adapter.py", "dgraudit/adapters.py", "dgraudit/msgnet_semantics.py",
        "dgraudit/cli/__init__.py", "dgraudit/cli/evaluate.py",
        "Start-Evaluation.cmd", "Start-Offline.ps1", "offline.py", "README.md",
        "requirements-core.txt",
        "ADAPTER_GUIDE.md", "adapters/template.py",
        "docs/EVALUATION_GUIDE.md", "docs/OFFLINE_RELEASE_NOTES.md",
        "docs/RESOURCE_MANIFEST.md",
        "examples/stemgnn/stemgnn.py", "examples/stemgnn/base_model_fft_compat.py",
        "examples/stemgnn/example_config.json",
        "examples/stemgnn/README.md",
    ]
    for name in files:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, target)
    shutil.copy2(ROOT.parent / "LICENSE", destination / "LICENSE")
    shutil.copytree(ROOT.parent / "paper_resources", destination / "paper_resources")
    (destination / 'profiles').mkdir(parents=True)
    for model in ('dgraformer', 'msgnet', 'mtgnn'):
        shutil.copy2(ROOT / f'profiles/{model}.json', destination / f'profiles/{model}.json')
    print(destination)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("destination")
    parser.add_argument("--zip", action="store_true", help="Also create a ZIP archive next to the package")
    args = parser.parse_args()
    build(args.destination)
    if args.zip:
        folder = Path(args.destination).resolve()
        archive = shutil.make_archive(str(folder), 'zip', folder.parent, folder.name)
        print(archive)
