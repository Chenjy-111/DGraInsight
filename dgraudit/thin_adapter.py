"""Public, framework-independent Thin Adapter Contract v1.

Six responsibilities only. Factories/FunctionBackend remain supported and use the same
runner; this class interface is a small bridge, not a second execution framework.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from typing import Any

from .evaluation import FunctionBackend, require

CONTRACT_VERSION = "thin-adapter.v1"


@dataclass(frozen=True)
class GraphContext:
    id: str
    kind: str
    label: str
    index: int | None = None


@dataclass(frozen=True)
class Node:
    id: str
    label: str
    semantic_type: str = "custom"


@dataclass(frozen=True)
class Relation:
    source: str
    target: str
    weight: float | None = None


@dataclass(frozen=True)
class AdapterCapabilities:
    supports_single_context: bool = True
    supports_all_contexts: bool = False
    supports_batch: bool = False
    directed: bool = True
    node_semantics: str = "custom"


@dataclass
class Sample:
    id: str
    input: Any
    truth: Any


@dataclass(frozen=True)
class InterventionRequest:
    operation: str  # identity or remove
    context_ids: tuple[str, ...]
    scope: str = "single_context"
    source: str | None = None
    target: str | None = None


class ThinAdapter(ABC):
    capabilities = AdapterCapabilities()

    @abstractmethod
    def load(self, config: dict) -> dict:
        """Load the original project; return portable model/dataset/output metadata."""

    @abstractmethod
    def load_sample(self, sample_id: Any) -> Sample:
        """Return explicit sample identity, the original batch and evaluation truth."""

    @abstractmethod
    def predict(self, sample: Sample) -> Any:
        """Call original model forward. Do not copy the model into this adapter."""

    @abstractmethod
    def get_contexts(self, sample: Sample) -> list[GraphContext]:
        """Return native contexts; ids must distinguish different layers/scales."""

    @abstractmethod
    def get_relations(self, sample: Sample, context: GraphContext) -> list[Relation]:
        """Return eligible canonical source→target relations (weight optional)."""

    @abstractmethod
    def predict_with_intervention(self, sample: Sample, request: InterventionRequest) -> Any:
        """Implement identity and remove using the real native intervention path.

        Return a prediction, or {prediction, graphStateVerification:{status,detail}}.
        Graph-state status must be passed/failed/unavailable and backed by actual checks.
        """

    def close(self):
        """Optional cleanup."""


def connect_adapter(adapter: ThinAdapter, config: dict) -> FunctionBackend:
    require(isinstance(adapter, ThinAdapter), "External class must implement ThinAdapter")
    metadata = adapter.load(config)
    capabilities = adapter.capabilities
    require(isinstance(capabilities, AdapterCapabilities), "Declare AdapterCapabilities")
    require(capabilities.node_semantics in {"observed", "latent", "custom"}, "Invalid node semantics")
    metadata["sourceMode"] = "adapter"
    metadata["capabilities"] = asdict(capabilities)
    metadata.setdefault("provenance", {})["adapterContract"] = CONTRACT_VERSION
    metadata["nodes"] = [asdict(n) if isinstance(n, Node) else n for n in metadata["nodes"]]
    for node in metadata["nodes"]:
        node.setdefault("semantic_type", capabilities.node_semantics)
    protocol_ids = {p["id"] for p in metadata["protocols"]}
    require(protocol_ids <= {"single", "all"}, "Thin contract v1 supports single/all protocol ids")
    require("single" not in protocol_ids or capabilities.supports_single_context, "NOT_SUPPORTED: single-context protocol")
    require("all" not in protocol_ids or capabilities.supports_all_contexts, "NOT_SUPPORTED: all-context protocol")

    def sample(sample_id):
        value = adapter.load_sample(sample_id)
        require(isinstance(value, Sample) and value.id == str(sample_id), "Sample id mismatch; do not substitute another sample")
        return value

    def contexts(value):
        result = []
        for c in adapter.get_contexts(value):
            require(isinstance(c, GraphContext), "get_contexts must return GraphContext values")
            relations = []
            for r in adapter.get_relations(value, c):
                require(isinstance(r, Relation), "get_relations must return Relation values")
                edge = {"source": r.source, "target": r.target}
                if r.weight is not None:
                    edge["weight"] = r.weight
                relations.append(edge)
            result.append({"id": c.id, "type": c.kind, "label": c.label, "index": c.index, "edges": relations})
        return result

    def intervene(value, request):
        scope = "all_contexts" if request["protocolId"] == "all" else "single_context"
        if scope == "all_contexts":
            require(capabilities.supports_all_contexts, "NOT_SUPPORTED: all-context intervention")
        else:
            require(capabilities.supports_single_context, "NOT_SUPPORTED: single-context intervention")
            require(len(request["contextIds"]) == 1, "Single-context intervention requires exactly one context")
        return adapter.predict_with_intervention(value, InterventionRequest("remove", tuple(request["contextIds"]), scope, request.get("source"), request.get("target")))

    def identity(value, context):
        return adapter.predict_with_intervention(value, InterventionRequest("identity", (context["id"],)))

    return FunctionBackend(metadata=metadata, load_sample=sample, truth=lambda s: s.truth,
        predict=adapter.predict, contexts=contexts, intervene=intervene, identity=identity, close=adapter.close)
