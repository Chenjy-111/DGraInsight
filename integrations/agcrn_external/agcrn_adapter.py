"""External AGCRN adapter. Original model/forward/data pipeline remain in LeiBAI/AGCRN."""
import hashlib
import os
import platform
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import torch
from dgraudit.thin_adapter import ThinAdapter, AdapterCapabilities, GraphContext, Relation, Sample


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class AGCRNAdapter(ThinAdapter):
    capabilities = AdapterCapabilities(node_semantics="observed")

    def load(self, config):
        base = Path(config["config_dir"])
        root = (base / config["source_root"]).resolve()
        checkpoint = (base / config["checkpoint"]["path"]).resolve()
        dataset = root / "data/PeMSD8/pems08.npz"
        for path, expected in [(checkpoint, config["checkpoint"]["sha256"]), (dataset, config["dataset"]["sha256"])]:
            if sha(path) != expected:
                raise ValueError(f"Resource hash mismatch: {path.name}")
        sys.path.insert(0, str(root))
        from model.AGCRN import AGCRN
        from lib.dataloader import get_dataloader
        args = SimpleNamespace(num_nodes=170, input_dim=1, output_dim=1, rnn_units=8,
            horizon=3, num_layers=1, default_graph=True, embed_dim=4, cheb_k=2,
            dataset="PEMSD8", lag=3, val_ratio=0.2, test_ratio=0.2, column_wise=False, batch_size=64)
        torch.set_num_threads(2)
        self.model = AGCRN(args).cpu().eval()
        self.model.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=True))
        cwd = Path.cwd()
        try:
            os.chdir(root / "model")
            _, _, test, self.scaler = get_dataloader(args, normalizer="std", single=False)
        finally:
            os.chdir(cwd)
        self.test = test.dataset
        self.modules = [self.model.encoder.dcrnn_cells[0].gate, self.model.encoder.dcrnn_cells[0].update]
        self.graph = None
        revision = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
        return {"model": "AGCRN", "dataset": "PeMSD8 test split", "horizon": 3,
            "nodes": [{"id": str(i), "label": f"Sensor {i}"} for i in range(170)],
            "outputs": [f"Sensor {i} flow" for i in range(170)],
            "nodeMeaning": "Observed traffic sensor channels in the original PeMSD8 array order. Learned computation relations, not road topology or real-world causal edges.",
            "protocols": [{"id": "single", "label": "Encoder layer 0 relation removal", "scope": "single_context",
                "description": "Canonical source->target maps to native support[target,source] in knm,bmc->bknc. Zero the already-softmax-normalized entry and renormalize its row. Apply to both gate and update AVWGCN at all three encoder timesteps. Native Chebyshev identity term remains unchanged; higher orders would be rebuilt by original code (this checkpoint uses order 2). Other learned diagonal support entries remain but the affected row is rescaled. No all-context or isolated-gate intervention."}],
            "measurement": {"space": "original traffic flow scale after native scaler.inverse_transform", "units": "flow per 5-minute interval; MSE uses squared units", "aggregation": "mean_all_steps_outputs"},
            "provenance": {"sourceUrl": "https://github.com/LeiBAI/AGCRN", "sourceRevision": revision,
                "sourceHashes": {str(p.relative_to(root)): sha(p) for p in root.rglob("*.py") if "experiments" not in p.parts},
                "checkpointSha256": sha(checkpoint), "datasetSha256": sha(dataset),
                "datasetUrl": "https://raw.githubusercontent.com/Davidham3/ASTGCN-2019-mxnet/master/data/PEMS08/pems08.npz",
                "python": platform.python_version(), "torch": torch.__version__, "device": "cpu", "parameters": vars(args),
                "checkpointTraining": "Native Run.py, 1 epoch, seed 10, small configuration; integration study, not paper benchmark reproduction",
                "preprocessingLimitation": "Original loader fits StandardScaler on the entire dataset before chronological 60/20/20 splitting; retained for native consistency. Do not treat this experiment as leakage-free benchmark evaluation."}}

    def load_sample(self, sample_id):
        index = int(sample_id)
        if str(index) != str(sample_id) or not 0 <= index < len(self.test):
            raise ValueError("Invalid exact test sample id")
        x, y = self.test[index]
        return Sample(str(sample_id), (x.unsqueeze(0), y.unsqueeze(0)), self.scaler.inverse_transform(y)[..., 0])

    def predict(self, sample):
        with torch.no_grad():
            y = self.model(*sample.input, teacher_forcing_ratio=0.)
            return self.scaler.inverse_transform(y)[0, ..., 0]

    def get_contexts(self, sample):
        return [GraphContext("encoder:0", "recurrent_layer", "Encoder layer 0: gate + update", 0)]

    def get_relations(self, sample, context):
        if context.id != "encoder:0":
            raise ValueError("Unknown native context")
        if self.graph is None:
            self._native_override(sample, "identity")
        return [Relation(str(s), str(t), float(self.graph[t, s])) for t in range(170) for s in range(170) if t != s and self.graph[t, s] != 0]

    def predict_with_intervention(self, sample, request):
        if request.context_ids != ("encoder:0",) or request.scope != "single_context":
            raise ValueError("NOT_SUPPORTED: only complete encoder layer 0 context")
        if request.operation not in ("identity", "remove"):
            raise ValueError("Unknown operation")
        return self._native_override(sample, request.operation, request.source, request.target)

    def _native_override(self, sample, operation, source=None, target=None):
        calls = 0
        def override(native):
            nonlocal calls
            calls += 1
            self.graph = native.detach().clone()
            changed = native.clone()
            if operation == "remove":
                s, t = int(source), int(target)
                if s == t or not (0 <= s < 170 and 0 <= t < 170) or native[t, s] == 0:
                    raise ValueError("Requested relation is unavailable")
                changed[t, s] = 0
                changed[t] = changed[t] / changed[t].sum()
                if changed[t, s] != 0 or not torch.allclose(changed[t].sum(), torch.ones((), device=native.device)):
                    raise ValueError("Native support removal or normalization failed")
                keep = torch.arange(170) != t
                if not torch.equal(changed[keep], native[keep]):
                    raise ValueError("Unselected support rows changed")
            return changed
        previous = [getattr(m, "support_override", None) for m in self.modules]
        try:
            for m in self.modules:
                m.support_override = override
            prediction = self.predict(sample)
            if calls != 6:
                raise ValueError(f"Expected six native support consumptions; observed {calls}")
        finally:
            for m, prior in zip(self.modules, previous):
                if prior is None:
                    delattr(m, "support_override")
                else:
                    m.support_override = prior
        return {"prediction": prediction, "graphStateVerification": {"status": "passed", "detail": f"Inspected {calls} native support hook invocations (gate and update at three timesteps); removal entry and row normalization checked for remove. Independent einsum-operand verification is a separate report."}}
