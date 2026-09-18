# Optional external-adapter preparation hook. This file is bundled into agcrn.py.
# Nothing in the generic evaluator knows this model or patches its source.
import shutil


DEFAULT_ADAPTER_CLASS = 'AGCRNAdapter'


def prepare_resources(config, run_directory):
    """Prepare local user assets once, before generic evaluation; preserve originals."""
    root = Path(config['source_root']).resolve()
    dataset = Path(config['dataset']['path']).resolve()
    destination = Path(run_directory) / 'model'
    text = (root / 'model/AGCN.py').read_text(encoding='utf-8-sig')
    anchor = '        support_set = [torch.eye(node_num).to(supports.device), supports]'
    hook = '        if getattr(self, "support_override", None) is not None:\n            supports = self.support_override(supports)\n'
    if 'support_override' not in text:
        if text.count(anchor) != 1:
            raise ValueError('AGCRN native graph structure differs from this adapter; preparation stopped.')
        text = text.replace(anchor, hook + anchor)
    elif hook not in text:
        raise ValueError('Unrecognized support override; adapter author must inspect the native hook.')
    shutil.copytree(root, destination, ignore=shutil.ignore_patterns(
        '.git', '__pycache__', 'data', 'experiments', '.venv', 'venv'))
    (destination / 'model/AGCN.py').write_text(text, encoding='utf-8')
    target = destination / 'data/PeMSD8/pems08.npz'
    target.parent.mkdir(parents=True)
    shutil.copy2(dataset, target)
    if sha(dataset) != sha(target):
        raise ValueError('Local dataset copy hash mismatch')
    return {**config, 'source_root': str(destination),
        'dataset': {**config['dataset'], 'name': 'PeMSD8'},
        'localResources': {**config.get('localResources', {}),
            'preparation': 'External AGCRN adapter created local source/data copy with support hook'}}
