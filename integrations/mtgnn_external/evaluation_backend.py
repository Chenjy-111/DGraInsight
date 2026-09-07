"""External factory route to the maintained MTGNN performance backend.

Reuses native MTGNN operations; exports Evaluation v1 without controls or inference.
No change to either the legacy adapter registry or the shared evaluation runner.
"""
from dgraudit.evaluation_plugins import official_backend


def create_backend(config, base_dir):
    return official_backend("mtgnn", config, base_dir)
