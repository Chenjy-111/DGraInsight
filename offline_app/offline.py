"""Local resources -> maintained backend or external adapter -> evaluation.v1."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import traceback
import faulthandler
from datetime import datetime
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent
MODELS = {'1': 'dgraformer', '2': 'msgnet', '3': 'mtgnn'}


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def ask_path(label, directory=False):
    while True:
        raw = input(label + ': ').strip().strip('"')
        if not raw:
            raise ValueError('A path is required.')
        path = Path(raw).expanduser().resolve()
        if (path.is_dir() if directory else path.is_file()):
            return path
        print('Path not found or wrong path type. Please try again.')


def import_adapter(path):
    if path.suffix != '.py' or not path.stem.isidentifier():
        raise ValueError('Select a Python file with a valid module name, such as my_model.py.')
    if path.stem in sys.modules:
        raise ValueError('Adapter name conflicts with an imported module. Rename the adapter file.')
    sys.path.insert(0, str(path.parent))
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[path.stem] = module
    spec.loader.exec_module(module)
    return module


def edit_fields(mapping, prefix=''):
    for key, value in list(mapping.items()):
        if key in ('path', 'sha256'):
            continue
        label = prefix + key
        if isinstance(value, dict):
            edit_fields(value, label + '.')
        else:
            raw = input(f'{label} [{json.dumps(value)}] (Enter to keep): ').strip()
            if raw:
                if isinstance(value, str):
                    mapping[key] = raw.strip('"')
                else:
                    updated = json.loads(raw)
                    if type(updated) is not type(value):
                        raise ValueError(f'{label} requires a {type(value).__name__} value.')
                    mapping[key] = updated


def builtin_profile(model):
    config = json.loads((ROOT / 'profiles' / f'{model}.json').read_text(encoding='utf-8'))
    print('Reference architecture and preprocessing settings (must match your checkpoint):')
    print(json.dumps({'dataset': {k: v for k, v in config['dataset'].items() if k != 'path'},
                      'adapter_config': config['adapter_config']}, indent=2))
    choice = input('Use these matching settings? [y = use / e = edit / other = cancel]: ').strip().lower()
    if choice == 'e':
        edit_fields(config['dataset'], 'dataset.')
        edit_fields(config['adapter_config'], 'adapter_config.')
    elif choice != 'y':
        raise ValueError('Cancelled. Use settings that match the trained model.')
    return config


def wizard():
    print('DGraInsight Offline Evaluator\nLocal evaluation. No model downloads or training.')
    print('1. DGraFormer\n2. MSGNet\n3. MTGNN\n4. Connect another model')
    choice = input('Select model [1-4]: ').strip()
    if choice not in (*MODELS, '4'):
        raise ValueError('Select 1, 2, 3 or 4.')
    module = None
    if choice == '4':
        print('Select an adapter written for your model. See ADAPTER_GUIDE.md and adapters/template.py.')
        adapter = ask_path('External adapter Python file')
        module = import_adapter(adapter)
        default_class = getattr(module, 'DEFAULT_ADAPTER_CLASS', 'MyAdapter')
        class_name = input(f'Adapter class [{default_class}]: ').strip() or default_class
        if not isinstance(getattr(module, class_name, None), type):
            raise ValueError(f'Adapter class {class_name!r} was not found in {adapter.name}.')
        config = {'version': 'evaluation.config.v1', 'plugin': 'external',
                  'backend': {'source_root': str(adapter.parent), 'module': adapter.stem, 'class': class_name},
                  'dataset': {}}
    else:
        config = builtin_profile(MODELS[choice])
    source = ask_path('Model source directory', True)
    dataset = ask_path('Dataset file')
    checkpoint = ask_path('Checkpoint file')
    ids = [int(s.strip()) for s in (input('Test sample IDs, comma-separated [0]: ').strip() or '0').split(',')]
    if not ids or min(ids) < 0 or len(set(ids)) != len(ids):
        raise ValueError('Sample IDs must be unique non-negative integers.')
    scope = input('Evaluation: 1 = all non-self edges, 2 = selected edges [1]: ').strip() or '1'
    if scope not in ('1', '2'):
        raise ValueError('Select 1 or 2.')
    edges = None
    if scope == '2':
        edges = []
        for item in input('Edges, for example 0->1,1->0: ').split(','):
            pair = item.strip().split('->')
            if len(pair) != 2 or not all(s.strip() for s in pair):
                raise ValueError('Use source->target for each edge.')
            edge = tuple(s.strip() for s in pair)
            if edge[0] == edge[1] or edge in edges:
                raise ValueError('Self edges and duplicate edges are not supported.')
            edges.append(edge)
    run_dir = ROOT / 'runs' / datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    run_dir.mkdir(parents=True)
    config.update({'source_root': str(source), 'checkpoint': {'path': str(checkpoint), 'sha256': digest(checkpoint)},
        'samples': ids, 'localResources': {'originalSource': str(source), 'dataset': str(dataset),
        'checkpoint': str(checkpoint), 'preparation': 'user-selected local resources'}})
    config['dataset'].update({'path': str(dataset), 'sha256': digest(dataset)})
    config['dataset'].setdefault('name', dataset.stem)
    if module is not None and callable(getattr(module, 'prepare_resources', None)):
        print('Preparing local resources using the selected external adapter...')
        config = module.prepare_resources(config, run_dir)
        if not isinstance(config, dict):
            raise ValueError('prepare_resources must return the prepared configuration dictionary.')
    config_path = run_dir / 'config.json'
    config_path.write_text(json.dumps(config, indent=2), encoding='utf-8')
    from dgraudit.evaluation_plugins import load_backend
    backend = load_backend(config, run_dir)
    requests = []
    try:
        for sid in ids:
            sample = backend.load_sample(sid)
            for context in backend.contexts(sample):
                available = {(e['source'], e['target']) for e in context['edges'] if e['source'] != e['target']}
                chosen = sorted(available) if edges is None else [edge for edge in edges if edge in available]
                for s, t in chosen:
                    requests.append({'sampleId': str(sid), 'protocolId': 'single', 'contextIds': [context['id']],
                        'source': s, 'target': t, 'label': f'{s} -> {t}'})
            if edges is not None:
                present = {(r['source'], r['target']) for r in requests if r['sampleId'] == str(sid)}
                if set(edges) - present:
                    raise ValueError(f'Sample {sid} has no selected relation: {set(edges) - present}')
    finally:
        backend.close()
    if not requests:
        raise ValueError('No eligible non-self edges were found.')
    config['requests'] = requests
    config_path.write_text(json.dumps(config, indent=2), encoding='utf-8')
    print(f'Configuration saved: {config_path}\nPlanned edge removals: {len(requests)}. Each starts from the original graph.')
    print('Large graphs can take a long time and produce large JSON files. Results are saved incrementally; --resume is available.')
    if input('Validate and start evaluation? [y/N]: ').strip().lower() != 'y':
        print('Configuration saved. Evaluation was not started.')
        return 0
    from dgraudit.cli.evaluate import execute
    code = execute(SimpleNamespace(command='evaluate', config=str(config_path), output=str(run_dir / 'manifest.json'), resume=False))
    if code == 0:
        print(f'On the website, choose Import Evaluation Results and select:\n{run_dir / "manifest.json"}')
    return code


def main():
    os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
    parser = argparse.ArgumentParser(description='Current offline evaluation only')
    parser.add_argument('--config', help='Run a configuration previously generated by the wizard')
    parser.add_argument('--resume', action='store_true', help='Resume a matching partial result')
    parser.add_argument('--validate-only', action='store_true', help='Run preflight without evaluation')
    args = parser.parse_args()
    if args.config:
        from dgraudit.cli.evaluate import execute
        config = Path(args.config).resolve()
        return execute(SimpleNamespace(command='preflight' if args.validate_only else 'evaluate',
            config=str(config), output=str(config.parent / ('preflight.json' if args.validate_only else 'manifest.json')), resume=args.resume))
    return wizard()


class LogStream:
    def __init__(self, console, log):
        self.console, self.log = console, log

    def write(self, text):
        self.console.write(text)
        self.log.write(text)
        self.log.flush()
        return len(text)

    def flush(self):
        self.console.flush()
        self.log.flush()


def logged_main():
    directory = ROOT / 'logs'
    directory.mkdir(exist_ok=True)
    path = directory / (datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.log')
    original_out, original_err = sys.stdout, sys.stderr
    with path.open('w', encoding='utf-8') as log:
        sys.stdout, sys.stderr = LogStream(original_out, log), LogStream(original_err, log)
        faulthandler.enable(file=log)
        try:
            print(f'Session log: {path}', flush=True)
            code = main()
            print(f'Python session finished with exit code {code}.', flush=True)
            return code
        except (Exception, KeyboardInterrupt) as exc:
            traceback.print_exc(file=log)
            print(f'Not completed: {exc}\nDetails saved to: {path}', file=sys.stderr)
            return 1
        finally:
            faulthandler.disable()
            sys.stdout, sys.stderr = original_out, original_err


if __name__ == '__main__':
    try:
        raise SystemExit(logged_main())
    except OSError as exc:
        print(f'Unable to create the session log: {exc}', file=sys.stderr)
        raise SystemExit(1)
