"""Copy to adapters/my_model.py, implement the six methods, then select it in the wizard.
This template deliberately fails until connected to a real model; it generates no fake data.
"""
from dgraudit.thin_adapter import ThinAdapter, AdapterCapabilities, Sample, GraphContext, Relation


class MyAdapter(ThinAdapter):
    capabilities = AdapterCapabilities(node_semantics="custom")

    def load(self, config):
        # Absolute paths from wizard:
        # config['source_root'], config['dataset']['path'], config['checkpoint']['path']
        # Load original model with checkpoint-matching architecture, eval mode and scaler.
        # Return metadata with model, dataset, horizon, nodes [{id,label}], outputs [str],
        # nodeMeaning, protocols [{id:'single', label, scope, description}],
        # measurement {space, units, aggregation:'mean_all_steps_outputs'} and provenance.
        # Describe direction, normalization, self loops and affected layers in description.
        raise NotImplementedError("Implement model loading and metadata; see ADAPTER_GUIDE.md")

    def load_sample(self, sample_id):
        # Return Sample(str(sample_id), original_input, truth_array).
        # truth shape [forecast_steps, output_count], using actual test split/scaler.
        raise NotImplementedError("Read exact requested test sample")

    def predict(self, sample):
        # Run original forward without intervention. Return [forecast_steps, output_count].
        raise NotImplementedError("Call original model forward")

    def get_contexts(self, sample):
        # Example declaration only: [GraphContext('encoder:0', 'layer', 'Encoder layer 0')]
        # Use real layers/scales/windows and stable, distinct IDs.
        raise NotImplementedError("Declare real graph contexts")

    def get_relations(self, sample, context):
        # Return [Relation(source_id, target_id, actual_weight), ...].
        # Extract relations actually consumed by forward, canonical source -> target.
        # Exclude self edges for this workflow. Do not invent an adjacency.
        raise NotImplementedError("Extract native non-self relations")

    def predict_with_intervention(self, sample, request):
        # request.operation is 'identity' or 'remove'; context_ids names native scope.
        # identity: run override path with UNCHANGED native graph, not cached baseline.
        # remove: start from original graph, remove source -> target, apply declared
        # normalization, rerun full forward. Always restore hooks/state in finally.
        # Return prediction array or {prediction, graphStateVerification:{status,detail}}.
        # 'passed' requires inspection of native consumed graph state, not just changed output.
        raise NotImplementedError("Implement real identity and removal intervention")
