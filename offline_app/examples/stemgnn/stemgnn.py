"""StemGNN external Thin Adapter for the DGraInsight Offline Evaluator.

This module connects the pinned Microsoft StemGNN source, the locally trained
COVID-25 checkpoint, and the matching processed dataset.  It does not copy the
evaluator and does not reimplement StemGNN's spectral forecasting blocks.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import platform
from pathlib import Path
from typing import Any

import numpy as np
import torch

from dgraudit.thin_adapter import (
    AdapterCapabilities,
    GraphContext,
    Relation,
    Sample,
    ThinAdapter,
)


DEFAULT_ADAPTER_CLASS = "StemGNNAdapter"
OFFICIAL_REVISION = "dc7dea6842c20c5dcece2f18b435e26770b3421c"
OFFICIAL_MODEL_SHA256 = "fa247c2036046091c6f68e27967ce45ace3e04ed16bbf2e957cc8df56374500a"
COMPATIBLE_MODEL_SHA256 = "ae87de6c4ed4c011ec35bb28bcea194b291f9b14ed3ae306ef19faac38eb9f25"
KNOWN_CHECKPOINT_SHA256 = "2a8780f6324b60550133721dcf6770200074a34c9e38023f1834cd987925eb5d"
KNOWN_DATASET_SHA256 = "58bd45956f25d57762982da99b9647d47bec8d1b146d3d255a4b7b314f022c67"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve(config: dict, value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path.resolve()
    return (Path(config["config_dir"]) / path).resolve()


class StemGNNAdapter(ThinAdapter):
    """Adapter for one sample-dependent, symmetric StemGNN relation graph."""

    capabilities = AdapterCapabilities(
        supports_single_context=True,
        supports_all_contexts=False,
        supports_batch=False,
        directed=False,
        node_semantics="observed",
    )

    node_count = 25
    window = 28
    horizon = 28
    stack_count = 2
    multi_layer = 1
    context_id = "latent-correlation"

    def load(self, config: dict) -> dict:
        """Load exact local resources and reconstruct checkpoint preprocessing."""
        self.config = config
        self.source_root = resolve(config, config["source_root"])
        self.dataset_path = resolve(config, config["dataset"]["path"])
        self.checkpoint_path = resolve(config, config["checkpoint"]["path"])
        for name, path in (
            ("model source directory", self.source_root),
            ("dataset", self.dataset_path),
            ("checkpoint", self.checkpoint_path),
        ):
            if not path.exists():
                raise ValueError(f"Missing {name}: {path}")

        dataset_hash = sha256(self.dataset_path)
        checkpoint_hash = sha256(self.checkpoint_path)
        if config["dataset"].get("sha256") not in (None, dataset_hash):
            raise ValueError("Dataset SHA-256 does not match the selected file")
        if config["checkpoint"].get("sha256") not in (None, checkpoint_hash):
            raise ValueError("Checkpoint SHA-256 does not match the selected file")

        official_model = self.source_root / "models" / "base_model.py"
        if sha256(official_model) != OFFICIAL_MODEL_SHA256:
            raise ValueError(
                "This adapter requires the pinned Microsoft StemGNN model source "
                f"at revision {OFFICIAL_REVISION}"
            )
        compatible_model = Path(__file__).with_name("base_model_fft_compat.py")
        if not compatible_model.is_file() or sha256(compatible_model) != COMPATIBLE_MODEL_SHA256:
            raise ValueError(
                "Missing or modified bundled PyTorch-2 FFT compatibility source "
                f"at {compatible_model}"
            )

        spec = importlib.util.spec_from_file_location(
            "dgrainsight_external_stemgnn_model", compatible_model
        )
        if spec is None or spec.loader is None:
            raise ValueError("Could not load the StemGNN compatibility module")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        torch.set_num_threads(2)
        self.model = module.Model(
            self.node_count,
            self.stack_count,
            self.window,
            self.multi_layer,
            horizon=self.horizon,
            device="cpu",
        ).cpu().eval()
        checkpoint = torch.load(
            self.checkpoint_path, map_location="cpu", weights_only=True
        )
        if not isinstance(checkpoint, dict) or "state_dict" not in checkpoint:
            raise ValueError("Checkpoint must contain a StemGNN state_dict")
        self.model.load_state_dict(checkpoint["state_dict"], strict=True)
        self.checkpoint_epoch = checkpoint.get("epoch")

        with self.dataset_path.open(encoding="utf-8-sig", newline="") as stream:
            self.node_names = next(csv.reader(stream))
        if len(self.node_names) != self.node_count or len(set(self.node_names)) != self.node_count:
            raise ValueError("Dataset must declare 25 unique country columns")
        data = np.genfromtxt(
            self.dataset_path, delimiter=",", skip_header=1, dtype=np.float64
        )
        if data.ndim != 2 or data.shape[1] != self.node_count or not np.isfinite(data).all():
            raise ValueError("Dataset must contain finite rows with 25 numeric columns")

        train_end = int(0.6 * len(data))
        validation_end = int(0.8 * len(data))
        self.train_mean = data[:train_end].mean(axis=0)
        self.train_std = data[:train_end].std(axis=0)
        self.train_std[self.train_std == 0] = 1
        self.test_data = data[validation_end:]
        self.sample_count = len(self.test_data) - self.window - self.horizon + 1
        if self.sample_count <= 0:
            raise ValueError("Test split is too short for the declared window and horizon")

        self.last_graph = None
        self.last_sample_id = None
        source_hashes = {
            str(path.relative_to(self.source_root)).replace("\\", "/"): sha256(path)
            for path in sorted(self.source_root.rglob("*.py"))
            if "__pycache__" not in path.parts
        }
        checkpoint_training = (
            "Locally trained StemGNN checkpoint, seed 0, 60 epochs; epoch 27 "
            "selected only by validation MAE. Not an official pretrained checkpoint."
            if checkpoint_hash == KNOWN_CHECKPOINT_SHA256
            else "User-selected checkpoint with architecture matching this adapter."
        )
        dataset_identity = (
            "Verified packaged JHU COVID-25 daily dataset"
            if dataset_hash == KNOWN_DATASET_SHA256
            else "User-selected 25-column dataset"
        )
        return {
            "model": "StemGNN",
            "dataset": "JHU COVID-19 daily confirmed cases, 25 countries, 2020",
            "horizon": self.horizon,
            "nodes": [
                {"id": str(index), "label": name}
                for index, name in enumerate(self.node_names)
            ],
            "outputs": list(self.node_names),
            "nodeMeaning": (
                "Observed country-level daily confirmed-case series in the packaged "
                "COVID-25 column order. Learned computation relations are not "
                "real-world causal relations between countries."
            ),
            "protocols": [
                {
                    "id": "single",
                    "label": "Latent-correlation relation removal",
                    "scope": "single_context",
                    "description": (
                        "The relation is an undirected symmetric pair. Zero both "
                        "pre-symmetrization attention entries at the native attention "
                        "dropout output, before native batch mean and degree computation. "
                        "The original StemGNN forward then computes symmetrization, "
                        "Laplacian, Chebyshev supports and both StockBlocks. No extra "
                        "softmax or row normalization is applied after deletion."
                    ),
                }
            ],
            "measurement": {
                "space": "original daily-case scale after reversing training-only z-score normalization",
                "units": "reported daily confirmed cases; MSE uses squared case units",
                "aggregation": "mean_all_steps_outputs",
            },
            "provenance": {
                "sourceUrl": "https://github.com/microsoft/StemGNN",
                "sourceRevision": OFFICIAL_REVISION,
                "sourceRevisionStatus": "verified_by_pinned_model_hash",
                "sourceHashes": source_hashes,
                "compatibleModelSha256": sha256(compatible_model),
                "compatibilityChange": (
                    "Only torch.rfft/torch.irfft were replaced by corresponding "
                    "torch.fft.fft/ifft APIs for current PyTorch."
                ),
                "checkpointSha256": checkpoint_hash,
                "checkpointEpoch": self.checkpoint_epoch,
                "checkpointTraining": checkpoint_training,
                "datasetSha256": dataset_hash,
                "datasetIdentity": dataset_identity,
                "datasetUrl": (
                    "https://github.com/CSSEGISandData/COVID-19/tree/master/"
                    "csse_covid_19_data/csse_covid_19_time_series"
                ),
                "preprocessing": (
                    "Chronological 60/20/20 row split; per-node z-score fit on "
                    "training rows only; 28 input steps and 28 forecast steps."
                ),
                "parameters": {
                    "nodes": self.node_count,
                    "stack_count": self.stack_count,
                    "window": self.window,
                    "horizon": self.horizon,
                    "multi_layer": self.multi_layer,
                    "inference_batch_size": 1,
                },
                "localResources": config.get("localResources", {}),
                "python": platform.python_version(),
                "torch": torch.__version__,
                "numpy": np.__version__,
                "device": "cpu",
            },
        }

    def load_sample(self, sample_id: Any) -> Sample:
        """Map a stable ID to one exact 28-input/28-target test window."""
        try:
            index = int(sample_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("Sample ID must be an integer") from exc
        if str(index) != str(sample_id) or not 0 <= index < self.sample_count:
            raise ValueError(
                f"Sample ID must be an integer from 0 to {self.sample_count - 1}"
            )
        history = self.test_data[index:index + self.window]
        truth = self.test_data[
            index + self.window:index + self.window + self.horizon
        ].copy()
        normalized = (history - self.train_mean) / self.train_std
        model_input = torch.tensor(normalized[None], dtype=torch.float32)
        return Sample(str(sample_id), model_input, truth)

    def predict(self, sample: Sample) -> np.ndarray:
        """Call the original model forward and restore the raw data scale."""
        prediction, graph = self._native_forward(sample)
        self.last_graph = graph
        self.last_sample_id = sample.id
        return prediction

    def get_contexts(self, sample: Sample) -> list[GraphContext]:
        """Declare the one graph shared by both native StockBlocks."""
        return [
            GraphContext(
                self.context_id,
                "sample_dependent_undirected_graph",
                "Latent correlation graph shared by both StockBlocks",
                0,
            )
        ]

    def get_relations(
        self, sample: Sample, context: GraphContext
    ) -> list[Relation]:
        """Expose each unordered non-self pair once using the native graph weight."""
        if context.id != self.context_id:
            raise ValueError(f"Unknown StemGNN context: {context.id}")
        if self.last_graph is None or self.last_sample_id != sample.id:
            self.predict(sample)
        graph = self.last_graph
        return [
            Relation(str(source), str(target), float(graph[source, target]))
            for source in range(self.node_count)
            for target in range(source + 1, self.node_count)
            if float(graph[source, target]) != 0.0
        ]

    def predict_with_intervention(self, sample: Sample, request) -> dict:
        """Run identity/remove through the real attention-to-spectral path."""
        if request.context_ids != (self.context_id,):
            raise ValueError("StemGNN requires the exact latent-correlation context")
        if request.scope != "single_context":
            raise ValueError("NOT_SUPPORTED: StemGNN exposes one single context")
        if request.operation == "identity":
            return self._run_override(sample, None, None)
        if request.operation != "remove":
            raise ValueError(f"Unsupported intervention operation: {request.operation}")
        try:
            source, target = int(request.source), int(request.target)
        except (TypeError, ValueError) as exc:
            raise ValueError("StemGNN relation IDs must be integer node IDs") from exc
        if not (0 <= source < target < self.node_count):
            raise ValueError(
                "StemGNN exposes each undirected relation once with source < target"
            )
        return self._run_override(sample, source, target)

    def _native_forward(self, sample: Sample) -> tuple[np.ndarray, torch.Tensor]:
        with torch.no_grad():
            forecast, graph = self.model(sample.input)
        prediction = (
            forecast[0].detach().cpu().double().numpy() * self.train_std
            + self.train_mean
        )
        if prediction.shape != (self.horizon, self.node_count):
            raise ValueError(f"Unexpected StemGNN prediction shape: {prediction.shape}")
        if not np.isfinite(prediction).all():
            raise ValueError("StemGNN produced non-finite predictions")
        return prediction, graph.detach().cpu().clone()

    def _expected_support(self, directed_attention: torch.Tensor) -> torch.Tensor:
        """Independent check of the exact upstream graph preparation order."""
        attention = directed_attention.mean(dim=0)
        degree = attention.sum(dim=1)
        symmetric = 0.5 * (attention + attention.T)
        degree_hat = torch.diag(1 / (torch.sqrt(degree) + 1e-7))
        laplacian = degree_hat @ (
            (torch.diag(degree) - symmetric) @ degree_hat
        )
        return self.model.cheb_polynomial(laplacian)

    def _run_override(
        self, sample: Sample, source: int | None, target: int | None
    ) -> dict:
        baseline_prediction, baseline_graph = self._native_forward(sample)
        if source is not None and float(baseline_graph[source, target]) == 0.0:
            raise ValueError("Requested relation is absent from the native graph")

        attention_calls = 0
        directed_after_override = None
        consumed_supports: list[torch.Tensor] = []

        def attention_override(_module, _args, output):
            nonlocal attention_calls, directed_after_override
            attention_calls += 1
            changed = output.clone()
            if source is not None:
                changed[:, source, target] = 0
                changed[:, target, source] = 0
            directed_after_override = changed.detach().clone()
            return changed

        def capture_support(_module, args):
            consumed_supports.append(args[1].detach().clone())

        attention_hook = self.model.dropout.register_forward_hook(attention_override)
        support_hooks = [
            block.register_forward_pre_hook(capture_support)
            for block in self.model.stock_block
        ]
        try:
            prediction, graph = self._native_forward(sample)
        finally:
            attention_hook.remove()
            for hook in support_hooks:
                hook.remove()

        if attention_calls != 1 or directed_after_override is None:
            raise ValueError(
                f"Expected one native attention override; observed {attention_calls}"
            )
        if len(consumed_supports) != self.stack_count:
            raise ValueError(
                f"Expected {self.stack_count} StockBlock support consumptions; "
                f"observed {len(consumed_supports)}"
            )
        expected_support = self._expected_support(directed_after_override)
        if not all(torch.equal(value, expected_support) for value in consumed_supports):
            raise ValueError("A StockBlock did not consume the expected native support")

        if source is None:
            if not torch.equal(graph, baseline_graph):
                raise ValueError("Identity override changed the native graph")
            if not np.array_equal(prediction, baseline_prediction):
                raise ValueError("Identity override changed the native prediction")
            detail = (
                "Identity passed: one attention hook invocation; graph and prediction "
                "exactly matched native forward; both StockBlocks consumed the exact "
                "independently recomputed support."
            )
        else:
            if graph[source, target] != 0 or graph[target, source] != 0:
                raise ValueError("Requested symmetric relation entries remained nonzero")
            keep = torch.ones_like(graph, dtype=torch.bool)
            keep[source, target] = False
            keep[target, source] = False
            if not torch.equal(graph[keep], baseline_graph[keep]):
                raise ValueError("An unselected symmetric graph entry changed")
            detail = (
                f"Removal passed: native attention entries [{source},{target}] and "
                f"[{target},{source}] are zero; all other returned graph entries are "
                "exactly unchanged; both StockBlocks consumed the exact independently "
                "recomputed support."
            )

        self.last_graph = baseline_graph
        self.last_sample_id = sample.id
        return {
            "prediction": prediction,
            "graphStateVerification": {"status": "passed", "detail": detail},
        }

    def close(self):
        """Release references; every per-run hook is already removed in finally."""
        self.last_graph = None
        self.last_sample_id = None
        self.model = None
