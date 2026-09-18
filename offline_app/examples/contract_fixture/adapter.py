"""Deterministic integration fixture, NOT real-model/benchmark evidence."""
from pathlib import Path
from dgraudit.thin_adapter import ThinAdapter, Sample, GraphContext, Relation, AdapterCapabilities
from dgraudit.examples.evaluation_functions_example import create_backend, forward, remove, contexts, load_sample


class FixtureAdapter(ThinAdapter):
    capabilities = AdapterCapabilities(node_semantics="latent")

    def load(self, config):
        self.config = config
        return create_backend({}, Path.cwd()).metadata

    def load_sample(self, sample_id):
        original = load_sample(sample_id)
        return Sample(str(sample_id), original, original["truth"])

    def predict(self, sample):
        return forward(sample.input)

    def get_contexts(self, sample):
        return [GraphContext("encoder:0", "latent_layer", "Fixture encoder")]

    def get_relations(self, sample, context):
        return [Relation(e["source"], e["target"]) for e in contexts(sample.input)[0]["edges"]]

    def predict_with_intervention(self, sample, request):
        if request.operation == "identity":
            return {"prediction": forward(sample.input), "graphStateVerification": {"status": "unavailable", "detail": "Fixture does not independently inspect consumed state."}}
        return remove(sample.input, {"source": request.source, "target": request.target, "protocolId": "single", "contextIds": list(request.context_ids)})
