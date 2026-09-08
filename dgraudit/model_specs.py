from __future__ import annotations

import csv

import math

from dataclasses import dataclass

from datetime import datetime

from pathlib import Path

from typing import Any, Mapping, MutableMapping, Sequence

from dgraudit.adapters import AdapterCapabilities, canonical_graph_contexts

@dataclass
class ValidationFailure(Exception):
    code: str
    message: str
    expected: Any = None
    found: Any = None
    details: Mapping[str, Any] | None = None

    def __str__(self) -> str:
        return self.message

class AdapterValidationSpec:
    adapter_id = ''
    adapter_name = ''
    model_name = ''
    native_context_type = ''
    supported_formats: tuple[str, ...] = ()
    required_source_files: tuple[str, ...] = ()
    required_model_fields: tuple[str, ...] = ()

    def validate_adapter_config(self, config: Mapping[str, Any]) -> list[dict[str, Any]]:
        issues: list[dict[str, Any]] = []
        adapter_config = config.get('adapter_config')
        if not isinstance(adapter_config, Mapping):
            return [_issue('CONFIG_FIELD_INVALID', 'adapter_config must be an object.', 'object', type(adapter_config).__name__)]
        model = adapter_config.get('model')
        if not isinstance(model, Mapping):
            issues.append(_issue('CONFIG_FIELD_INVALID', 'adapter_config.model must be an object.', 'object', type(model).__name__))
            return issues
        for field in self.required_model_fields:
            if field not in model:
                issues.append(_issue('CONFIG_FIELD_MISSING', f'Missing adapter_config.model.{field}.', field, None))
        unknown_model = sorted(set(model) - set(self.required_model_fields))
        if unknown_model:
            issues.append(_issue('CONFIG_FIELD_INVALID', 'adapter_config.model contains fields not consumed by the official adapter.', list(self.required_model_fields), unknown_model))
        if not isinstance(adapter_config.get('random_seed'), int):
            issues.append(_issue('CONFIG_FIELD_INVALID', 'adapter_config.random_seed must be an integer.', 'integer', adapter_config.get('random_seed')))
        return issues

    def create_adapter(self, config: Mapping[str, Any], resolved: Mapping[str, Path]) -> Any:
        raise NotImplementedError

    def validate_dataset(self, path: Path, config: Mapping[str, Any]) -> Mapping[str, Any]:
        dataset = config['dataset']
        expected_columns = [dataset['date_column'], *dataset['variables']]
        row_count = 0
        try:
            with path.open('r', encoding='utf-8-sig', newline='') as handle:
                reader = csv.reader(handle)
                header = next(reader, None)
                if header != expected_columns:
                    raise ValidationFailure('DATASET_COLUMNS_MISMATCH', 'Dataset columns do not match the supported schema and exact variable order.', expected_columns, header)
                for line_number, row in enumerate(reader, start=2):
                    row_count += 1
                    if len(row) != len(expected_columns):
                        raise ValidationFailure('DATASET_COLUMNS_MISMATCH', f'Dataset row {line_number} has an incompatible column count.', len(expected_columns), len(row))
                    try:
                        datetime.fromisoformat(row[0])
                        values = [float(value) for value in row[1:]]
                    except (ValueError, TypeError) as exc:
                        raise ValidationFailure('DATASET_VALUE_INVALID', f'Dataset row {line_number} cannot be parsed using the declared schema.', details={'line': line_number, 'reason': str(exc)}) from exc
                    if not all((math.isfinite(value) for value in values)):
                        raise ValidationFailure('DATASET_VALUE_INVALID', f'Dataset row {line_number} contains non-finite values.')
        except ValidationFailure:
            raise
        except (OSError, UnicodeError, csv.Error) as exc:
            raise ValidationFailure('DATASET_LOAD_FAILED', f'Dataset could not be read: {exc}') from exc
        if row_count == 0:
            raise ValidationFailure('DATASET_LOAD_FAILED', 'Dataset contains no data rows.')
        return {'format': dataset['format'], 'columns': expected_columns, 'row_count': row_count}

    def prepare_batch(self, batch: Mapping[str, Any], config: Mapping[str, Any]) -> dict[str, Any]:
        return dict(batch)

    def validate_sample(self, batch: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        raise NotImplementedError

    def validate_graph(self, extracted: Mapping[str, Any], probe: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        raise NotImplementedError

    def identity_override(self, probe: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        raise NotImplementedError

    def intervention_override(self, probe: Mapping[str, Any], config: Mapping[str, Any], broader: bool=False) -> Mapping[str, Any]:
        raise NotImplementedError

    def intervention_override_for_context(self, probe: Mapping[str, Any], config: Mapping[str, Any], context: Mapping[str, Any], broader: bool=False) -> Mapping[str, Any]:
        return self.intervention_override(probe, config, broader=broader)

    def contexts(self, extracted: Mapping[str, Any]) -> list[Mapping[str, Any]]:
        return canonical_graph_contexts(extracted)

    def context_id(self, context: Mapping[str, Any]) -> str:
        return str(context['context_id'])

    def context_index(self, context: Mapping[str, Any]) -> int:
        return int(context['index'])

    def context_cache_key(self, context: Mapping[str, Any]) -> tuple[Any, ...]:
        return (self.context_id(context),)

    def context_weight(self, context: Mapping[str, Any]) -> Any:
        graph = context.get('audit_graph')
        if graph is None:
            graphs = context.get('graphs', {})
            graph = graphs.get(getattr(self, 'audit_graph_key', 'audit_graph')) if isinstance(graphs, Mapping) else None
        if graph is None:
            raise ValidationFailure('GRAPH_EXTRACTION_FAILED', 'Graph context does not expose its declared audit graph.')
        return graph

    def context_graphs(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        graphs = context.get('graphs')
        if isinstance(graphs, Mapping) and graphs:
            return graphs
        return {'audit_graph': self.context_weight(context)}

    def context_metadata(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        metadata = context.get('metadata', {})
        return dict(metadata) if isinstance(metadata, Mapping) else {}

    def find_context(self, contexts: Sequence[Mapping[str, Any]], requested: Mapping[str, Any]) -> Mapping[str, Any]:
        requested_index = int(requested['index'])
        match = next((item for item in contexts if self.context_index(item) == requested_index), None)
        if match is None:
            raise ValidationFailure('GRAPH_CONTEXT_MISSING', 'The exact requested native graph context is unavailable.', requested_index, [self.context_index(item) for item in contexts])
        return match

    def selection(self, model_name: str, dataset_name: str, relation: Mapping[str, Any], variables: Sequence[str], context: Mapping[str, Any], broader: bool) -> dict[str, Any]:
        capabilities = getattr(self, 'capabilities', None)
        if broader and (not bool(getattr(capabilities, 'supports_broader_context', False))):
            raise ValueError(f'{self.model_name} does not declare a broader native graph context.')
        sample, source, target = (int(relation['sample']), int(relation['source']), int(relation['target']))
        native_type = self.native_context_type
        native_indices = [self.context_index(context)]
        scope = getattr(capabilities, 'broader_scope', 'all_contexts') if broader else getattr(capabilities, 'local_scope', 'single_context')
        context_id = f'{native_type}-set:all' if broader else self.context_id(context)
        candidate_id = f'quick:{self.adapter_id}:{scope}:{context_id}:{source}->{target}'
        return {'model': model_name, 'dataset': dataset_name, 'sample_id': f'test:{sample}', 'sample_index': sample, 'source': source, 'target': target, 'source_name': variables[source], 'target_name': variables[target], 'scope': 'broader_context' if broader else 'local', 'context_type': f'{native_type}_set' if broader else native_type, 'context_id': context_id, 'context_index': 'all_applicable' if broader else self.context_index(context), 'candidate_scope': scope, 'candidate_id': candidate_id, 'candidate_native_context_type': native_type, 'candidate_retained_contexts': native_indices, 'candidate_identity': dict(context.get('identity', {})) if not broader else {}}

    def graph_effect_metadata(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return self.context_metadata(context)

    def model_configuration(self, config: Mapping[str, Any]) -> Mapping[str, Any]:
        adapter_config = config.get('adapter_config', {})
        model = dict(adapter_config.get('model', {})) if isinstance(adapter_config, Mapping) else {}
        if isinstance(adapter_config, Mapping) and isinstance(adapter_config.get('random_seed'), int):
            model['random_seed'] = int(adapter_config['random_seed'])
        return model

class DGraFormerValidationSpec(AdapterValidationSpec):
    adapter_id = 'dgraformer'
    adapter_name = 'DGraFormerAdapter'
    model_name = 'DGraFormer'
    native_context_type = 'window'
    supported_formats = ('ett_hour',)
    required_source_files = ('exp/exp_main.py', 'models/DGraFormer.py')
    required_model_fields = ('numpoint_win', 'w_bias', 'd_graph', 'd_gcn', 'w_ratio', 'mp_layers', 'predictor_dropout', 'patch_len', 'stride', 'revin', 'affine', 'subtract_last', 'd_model', 'n_heads', 'e_layers', 'd_ff', 'dropout', 'embed', 'activation')
    capabilities = AdapterCapabilities(graph_context_type='window', supports_multi_context=True, supports_broader_context=True, audit_graph_key='normalized', local_scope='single_window', broader_scope='all_retained_windows', dataset_formats=('ett_hour',))

    def validate_adapter_config(self, config: Mapping[str, Any]) -> list[dict[str, Any]]:
        issues = super().validate_adapter_config(config)
        adapter_config = config.get('adapter_config')
        if isinstance(adapter_config, Mapping) and (not isinstance(adapter_config.get('current_epoch'), int)):
            issues.append(_issue('CONFIG_FIELD_INVALID', 'adapter_config.current_epoch is required and must be an integer.', 'integer', adapter_config.get('current_epoch')))
        return issues

    def create_adapter(self, config: Mapping[str, Any], resolved: Mapping[str, Path]) -> Any:
        from dgraudit.adapters import DGraFormerAdapter
        dataset = config['dataset']
        adapter_config = config['adapter_config']
        common = {'seq_len': dataset['seq_len'], 'label_len': dataset['label_len'], 'pred_len': dataset['pred_len'], **dict(adapter_config['model'])}
        dataset_config = {'data': dataset['name'], 'root_path': str(resolved['dataset'].parent), 'data_path': resolved['dataset'].name, 'freq': dataset['frequency'], 'n_vars': len(dataset['variables'])}
        adapter = DGraFormerAdapter(str(resolved['source_root']), dataset['name'], common, dataset_config, int(adapter_config['random_seed']))
        adapter.current_epoch = int(adapter_config['current_epoch'])
        return adapter

    def prepare_batch(self, batch: Mapping[str, Any], config: Mapping[str, Any]) -> dict[str, Any]:
        return {**batch, 'current_epoch': int(config['adapter_config']['current_epoch'])}

    def validate_sample(self, batch: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        dataset = config['dataset']
        expected_x = [dataset['seq_len'], len(dataset['variables'])]
        x_shape = list(_shape(batch.get('x')))
        y_shape = list(_shape(batch.get('y')))
        if x_shape != expected_x:
            raise ValidationFailure('SAMPLE_SHAPE_MISMATCH', 'DGraFormer input shape is incompatible.', expected_x, x_shape)
        if len(y_shape) != 2 or y_shape[0] < dataset['pred_len'] or y_shape[1] != len(dataset['variables']):
            raise ValidationFailure('SAMPLE_SHAPE_MISMATCH', 'DGraFormer target container shape is incompatible.', [f">={dataset['pred_len']}", len(dataset['variables'])], y_shape)
        for key in ('x', 'y', 'time_index'):
            if key not in batch:
                raise ValidationFailure('SAMPLE_CONSTRUCTION_FAILED', f'DGraFormer sample is missing {key}.')
            if not _is_finite(batch[key]):
                raise ValidationFailure('SAMPLE_NONFINITE', f'DGraFormer sample field {key} contains non-finite values.')
        return {'x_shape': x_shape, 'y_shape': y_shape, 'time_index_shape': list(_shape(batch['time_index']))}

    def validate_graph(self, extracted: Mapping[str, Any], probe: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        windows = extracted.get('windows')
        if not isinstance(windows, Sequence) or not windows:
            raise ValidationFailure('GRAPH_EXTRACTION_FAILED', 'DGraFormer did not return native window contexts.')
        requested = next((item for item in windows if int(item.get('window', -1)) == int(probe['context']['index'])), None)
        if requested is None:
            raise ValidationFailure('GRAPH_CONTEXT_MISSING', 'Requested DGraFormer window does not exist.', probe['context']['index'], [item.get('window') for item in windows])
        n = len(config['dataset']['variables'])
        source, target = (int(probe['source']), int(probe['target']))
        normalized = requested.get('normalized')
        _validate_square_finite_matrix(normalized, n, 'DGraFormer normalized graph')
        rows = _matrix_rows(normalized)
        max_row_error = max((abs(sum(row) - 1.0) for row in rows))
        if max_row_error > 1e-05:
            raise ValidationFailure('GRAPH_SHAPE_MISMATCH', 'DGraFormer normalized graph rows do not sum to one.', '<=1e-5', max_row_error)
        weight = float(rows[source][target])
        if weight <= 0:
            raise ValidationFailure('RELATION_NOT_PRESENT', 'Declared DGraFormer relation is not retained in the exact requested window.', 'positive normalized weight', weight)
        if probe.get('include_broader_context'):
            broader_weights = []
            for item in windows:
                matrix = _matrix_rows(item.get('normalized'))
                broader_weights.append(float(matrix[source][target]))
            if not any((value > 0 for value in broader_weights)):
                raise ValidationFailure('RELATION_NOT_PRESENT', 'Declared relation is absent from every DGraFormer window.')
        return {'context_count': len(windows), 'requested_window': int(probe['context']['index']), 'matrix_shape': [n, n], 'requested_weight': weight, 'normalized_row_sum_max_error': max_row_error}

    def identity_override(self, probe: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        return {'type': 'identity', 'window': int(probe['context']['index']), 'current_epoch': int(config['adapter_config']['current_epoch'])}

    def intervention_override(self, probe: Mapping[str, Any], config: Mapping[str, Any], broader: bool=False) -> Mapping[str, Any]:
        common = {'source': int(probe['source']), 'target': int(probe['target']), 'current_epoch': int(config['adapter_config']['current_epoch'])}
        if broader:
            return {'type': 'global_structural_edge_removal', **common}
        return {'type': 'structural_edge_removal', 'window': int(probe['context']['index']), **common}

    def contexts(self, extracted: Mapping[str, Any]) -> list[Mapping[str, Any]]:
        return list(extracted['windows'])

    def context_id(self, context: Mapping[str, Any]) -> str:
        return f"window:{int(context['window'])}"

    def context_index(self, context: Mapping[str, Any]) -> int:
        return int(context['window'])

    def context_weight(self, context: Mapping[str, Any]) -> Any:
        return context['normalized']

    def context_graphs(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        names = ('static_prior', 'raw_score', 'activated', 'diagonal_removed', 'topk_mask', 'topk_graph', 'self_loop_graph', 'normalized')
        return {name: context[name] for name in names}

    def context_metadata(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return {'topk_slots': int(context['topk_slots']), 'blend_proportion': float(context['blend_proportion'])}

    def selection(self, model_name, dataset_name, relation, variables, context, broader):
        sample, source, target = (int(relation['sample']), int(relation['source']), int(relation['target']))
        window = int(context['window'])
        common = {'model': model_name, 'dataset': dataset_name, 'sample_id': f'test:{sample}', 'sample_index': sample, 'source': source, 'target': target, 'source_name': variables[source], 'target_name': variables[target], 'scope': 'broader_context' if broader else 'local'}
        return {**common, 'context_type': 'window_set' if broader else 'window', 'context_id': 'window-set:all' if broader else f'window:{window}', 'context_index': 'all_applicable' if broader else window, 'candidate_scope': 'all_retained_windows' if broader else 'single_window', 'candidate_id': f"quick:dgra:{('all' if broader else f'window:{window}')}:{source}->{target}", 'candidate_native_context_type': 'window', 'candidate_retained_contexts': [] if broader else [window], 'candidate_identity': {} if broader else {'window_index': window}}

    def graph_effect_metadata(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return {'blend_proportion': float(context['blend_proportion']), 'topk_slots': int(context['topk_slots'])}

    def model_configuration(self, config: Mapping[str, Any]) -> Mapping[str, Any]:
        result = dict(super().model_configuration(config))
        result['current_epoch'] = int(config['adapter_config']['current_epoch'])
        return result

class MSGNetValidationSpec(AdapterValidationSpec):
    adapter_id = 'msgnet'
    adapter_name = 'MSGNetAdapter'
    model_name = 'MSGNet'
    native_context_type = 'scale'
    supported_formats = ('ett_hour',)
    required_source_files = ('models/MSGNet.py', 'data_provider/data_loader.py')
    required_model_fields = ('task_name', 'top_k', 'enc_in', 'c_out', 'e_layers', 'd_model', 'n_heads', 'd_ff', 'conv_channel', 'skip_channel', 'node_dim', 'gcn_depth', 'propalpha', 'dropout', 'embed', 'individual')
    capabilities = AdapterCapabilities(graph_context_type='scale', supports_multi_context=True, supports_broader_context=True, audit_graph_key='adaptive', local_scope='single_scale', broader_scope='all_scales', dataset_formats=('ett_hour',))

    def create_adapter(self, config: Mapping[str, Any], resolved: Mapping[str, Path]) -> Any:
        from dgraudit.adapters import MSGNetAdapter
        dataset = config['dataset']
        adapter_config = config['adapter_config']
        adapter_runtime_config = {'random_seed': adapter_config['random_seed'], 'dataset': {'name': dataset['name'], 'path': str(resolved['dataset']), 'features': dataset['features'], 'target': dataset['target'], 'frequency': dataset['frequency'], 'seq_len': dataset['seq_len'], 'label_len': dataset['label_len'], 'pred_len': dataset['pred_len']}, 'model_config': dict(adapter_config['model'])}
        return MSGNetAdapter(str(resolved['source_root']), adapter_runtime_config)

    def validate_sample(self, batch: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        dataset = config['dataset']
        n = len(dataset['variables'])
        expected_x = [dataset['seq_len'], n]
        expected_y = [dataset['label_len'] + dataset['pred_len'], n]
        x_shape, y_shape = (list(_shape(batch.get('x'))), list(_shape(batch.get('y'))))
        x_mark_shape, y_mark_shape = (list(_shape(batch.get('x_mark'))), list(_shape(batch.get('y_mark'))))
        if x_shape != expected_x or y_shape != expected_y:
            raise ValidationFailure('SAMPLE_SHAPE_MISMATCH', 'MSGNet sample tensor shapes are incompatible.', {'x': expected_x, 'y': expected_y}, {'x': x_shape, 'y': y_shape})
        if not x_mark_shape or x_mark_shape[0] != dataset['seq_len'] or (not y_mark_shape) or (y_mark_shape[0] != expected_y[0]):
            raise ValidationFailure('SAMPLE_SHAPE_MISMATCH', 'MSGNet time-mark lengths are incompatible.', {'x_mark_rows': dataset['seq_len'], 'y_mark_rows': expected_y[0]}, {'x_mark': x_mark_shape, 'y_mark': y_mark_shape})
        for key in ('x', 'y', 'x_mark', 'y_mark'):
            if key not in batch:
                raise ValidationFailure('SAMPLE_CONSTRUCTION_FAILED', f'MSGNet sample is missing {key}.')
            if not _is_finite(batch[key]):
                raise ValidationFailure('SAMPLE_NONFINITE', f'MSGNet sample field {key} contains non-finite values.')
        return {'x_shape': x_shape, 'y_shape': y_shape, 'x_mark_shape': x_mark_shape, 'y_mark_shape': y_mark_shape}

    def validate_graph(self, extracted: Mapping[str, Any], probe: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        contexts = extracted.get('contexts')
        if not isinstance(contexts, Sequence) or not contexts:
            raise ValidationFailure('GRAPH_EXTRACTION_FAILED', 'MSGNet did not return native scale contexts.')
        layer = int(probe['context'].get('layer', 0))
        scale = int(probe['context']['index'])
        requested = next((item for item in contexts if int(item.get('layer', -1)) == layer and int(item.get('scale_index', -1)) == scale), None)
        if requested is None:
            raise ValidationFailure('GRAPH_CONTEXT_MISSING', 'Requested MSGNet layer/scale context does not exist.', {'layer': layer, 'scale_index': scale}, [{'layer': item.get('layer'), 'scale_index': item.get('scale_index')} for item in contexts])
        n = len(config['dataset']['variables'])
        _validate_square_finite_matrix(requested.get('adaptive'), n, 'MSGNet adaptive graph')
        _validate_square_finite_matrix(requested.get('effective'), n, 'MSGNet effective graph')
        period = int(requested.get('period', 0))
        fft_strength = float(requested.get('fft_strength', math.nan))
        contribution = float(requested.get('scale_contribution', math.nan))
        if period <= 0 or not math.isfinite(fft_strength) or (not math.isfinite(contribution)):
            raise ValidationFailure('GRAPH_NONFINITE', 'MSGNet native scale metadata is invalid.', 'positive period and finite FFT/mixing values', {'period': period, 'fft_strength': fft_strength, 'scale_contribution': contribution})
        adaptive = _matrix_rows(requested['adaptive'])
        return {'context_count': len(contexts), 'requested_layer': layer, 'requested_scale': scale, 'period': period, 'fft_strength': fft_strength, 'scale_contribution': contribution, 'requested_weight': float(adaptive[int(probe['source'])][int(probe['target'])]), 'matrix_shape': [n, n]}

    def identity_override(self, probe: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        return {'type': 'identity', 'layer': int(probe['context'].get('layer', 0)), 'scale_index': int(probe['context']['index'])}

    def intervention_override(self, probe: Mapping[str, Any], config: Mapping[str, Any], broader: bool=False) -> Mapping[str, Any]:
        result = {'type': 'structural_edge_removal', 'layer': int(probe['context'].get('layer', 0)), 'scale_index': int(probe['context']['index']), 'source': int(probe['source']), 'target': int(probe['target'])}
        if broader:
            result['scope'] = 'global'
        return result

    def contexts(self, extracted: Mapping[str, Any]) -> list[Mapping[str, Any]]:
        return list(extracted['contexts'])

    def context_id(self, context: Mapping[str, Any]) -> str:
        return f"layer:{int(context['layer'])}:scale:{int(context['scale_index'])}"

    def context_index(self, context: Mapping[str, Any]) -> int:
        return int(context['scale_index'])

    def context_cache_key(self, context: Mapping[str, Any]) -> tuple[Any, ...]:
        return (int(context['layer']), int(context['scale_index']))

    def context_weight(self, context: Mapping[str, Any]) -> Any:
        return context['adaptive']

    def context_graphs(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        names = ('raw_affinity', 'activated', 'adaptive', 'self_loop_graph', 'effective')
        return {name: context[name] for name in names}

    def context_metadata(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return {'period': int(context['period']), 'fft_strength': float(context['fft_strength']), 'scale_contribution': float(context['scale_contribution'])}

    def find_context(self, contexts, requested):
        layer, scale = (int(requested.get('layer', 0)), int(requested['index']))
        match = next((item for item in contexts if int(item['layer']) == layer and int(item['scale_index']) == scale), None)
        if match is None:
            raise ValidationFailure('GRAPH_CONTEXT_MISSING', 'The exact requested MSGNet scale is unavailable.', {'layer': layer, 'scale': scale})
        return match

    def selection(self, model_name, dataset_name, relation, variables, context, broader):
        sample, source, target = (int(relation['sample']), int(relation['source']), int(relation['target']))
        layer, scale = (int(context['layer']), int(context['scale_index']))
        common = {'model': model_name, 'dataset': dataset_name, 'sample_id': f'test:{sample}', 'sample_index': sample, 'source': source, 'target': target, 'source_name': f'G{source}', 'target_name': f'G{target}', 'scope': 'broader_context' if broader else 'local'}
        return {**common, 'context_type': 'scale_set' if broader else 'scale', 'context_id': f'layer:{layer}:scale-set:all' if broader else f'layer:{layer}:scale:{scale}', 'context_index': 'all_applicable' if broader else scale, 'layer': layer, 'candidate_scope': 'all_scales' if broader else 'single_scale', 'candidate_id': f"quick:msgnet:{('all' if broader else f'scale:{scale}')}:{source}->{target}", 'candidate_native_context_type': 'scale', 'candidate_retained_contexts': [0, 1, 2] if broader else [scale], 'candidate_identity': {} if broader else {'scale_index': scale}}

    def graph_effect_metadata(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return self.context_metadata(context)

class MTGNNValidationSpec(AdapterValidationSpec):
    adapter_id = 'mtgnn'
    adapter_name = 'MTGNNAdapter'
    model_name = 'MTGNN'
    native_context_type = 'global_graph'
    supported_formats = ('mtgnn_numeric_matrix', 'mtgnn_exchange_rate')
    required_source_files = ('net.py', 'layer.py', 'util.py')
    required_model_fields = ('gcn_true', 'build_a_true', 'gcn_depth', 'num_nodes', 'dropout', 'subgraph_size', 'node_dim', 'dilation_exponential', 'conv_channels', 'residual_channels', 'skip_channels', 'end_channels', 'in_dim', 'seq_in_len', 'seq_out_len', 'horizon', 'layers', 'propalpha', 'tanhalpha', 'layer_norm_affline', 'normalize', 'train_ratio', 'validation_ratio')
    capabilities = AdapterCapabilities(graph_context_type='global_graph', audit_graph_key='learned_adjacency', local_scope='global_graph', dataset_formats=('mtgnn_matrix',))

    def validate_adapter_config(self, config: Mapping[str, Any]) -> list[dict[str, Any]]:
        issues = super().validate_adapter_config(config)
        model = config.get('adapter_config', {}).get('model', {})
        if isinstance(model, Mapping):
            if model.get('gcn_true') is not True or model.get('build_a_true') is not True:
                issues.append(_issue('CONFIG_FIELD_INVALID', 'MTGNN local graph audit requires gcn_true and build_a_true.', True, {'gcn_true': model.get('gcn_true'), 'build_a_true': model.get('build_a_true')}))
            for field in ('train_ratio', 'validation_ratio'):
                value = model.get(field)
                if not isinstance(value, (int, float)) or isinstance(value, bool) or (not 0 < float(value) < 1):
                    issues.append(_issue('CONFIG_FIELD_INVALID', f'MTGNN {field} must be between zero and one.', '0 < value < 1', value))
            train_ratio, validation_ratio = (model.get('train_ratio'), model.get('validation_ratio'))
            if isinstance(train_ratio, (int, float)) and isinstance(validation_ratio, (int, float)) and (train_ratio + validation_ratio >= 1):
                issues.append(_issue('CONFIG_FIELD_INVALID', 'MTGNN train_ratio + validation_ratio must be less than one.', '< 1', train_ratio + validation_ratio))
        audit = config.get('audit')
        if isinstance(audit, Mapping):
            for index, relation in enumerate(audit.get('relations', [])):
                if isinstance(relation, Mapping) and relation.get('include_broader_context'):
                    issues.append(_issue('CONFIG_FIELD_INVALID', f'audit.relations[{index}] requests broader context, but MTGNN exposes one global learned graph only.', False, True))
        return issues

    def validate_dataset(self, path: Path, config: Mapping[str, Any]) -> Mapping[str, Any]:
        expected_count = len(config['dataset']['variables'])
        row_count = 0
        try:
            with path.open('r', encoding='utf-8-sig', newline='') as handle:
                for line_number, row in enumerate(csv.reader(handle), start=1):
                    if not row:
                        continue
                    row_count += 1
                    if len(row) != expected_count:
                        raise ValidationFailure('DATASET_COLUMNS_MISMATCH', f'MTGNN dataset row {line_number} has an incompatible variable count.', expected_count, len(row))
                    try:
                        values = [float(value) for value in row]
                    except (ValueError, TypeError) as exc:
                        raise ValidationFailure('DATASET_VALUE_INVALID', f'MTGNN dataset row {line_number} contains a non-numeric value.', details={'line': line_number, 'reason': str(exc)}) from exc
                    if not all((math.isfinite(value) for value in values)):
                        raise ValidationFailure('DATASET_VALUE_INVALID', f'MTGNN dataset row {line_number} contains non-finite values.')
        except ValidationFailure:
            raise
        except (OSError, UnicodeError, csv.Error) as exc:
            raise ValidationFailure('DATASET_LOAD_FAILED', f'MTGNN dataset could not be read: {exc}') from exc
        if row_count == 0:
            raise ValidationFailure('DATASET_LOAD_FAILED', 'MTGNN dataset contains no data rows.')
        return {'format': config['dataset']['format'], 'variable_count': expected_count, 'row_count': row_count, 'header': False}

    def create_adapter(self, config: Mapping[str, Any], resolved: Mapping[str, Path]) -> Any:
        from dgraudit.adapters import MTGNNAdapter
        adapter_config = config['adapter_config']
        return MTGNNAdapter(str(resolved['source_root']), {'random_seed': adapter_config['random_seed'], 'dataset': {'name': config['dataset']['name'], 'path': str(resolved['dataset'])}, 'model_config': dict(adapter_config['model'])})

    def validate_sample(self, batch: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        dataset = config['dataset']
        expected_x = [dataset['seq_len'], len(dataset['variables'])]
        expected_y = [dataset['pred_len'], len(dataset['variables'])]
        x_shape, y_shape = (list(_shape(batch.get('x'))), list(_shape(batch.get('y'))))
        normalized_shape = list(_shape(batch.get('x_normalized')))
        if x_shape != expected_x or y_shape != expected_y or normalized_shape != expected_x:
            raise ValidationFailure('SAMPLE_SHAPE_MISMATCH', 'MTGNN sample tensor shapes are incompatible.', {'x': expected_x, 'y': expected_y, 'x_normalized': expected_x}, {'x': x_shape, 'y': y_shape, 'x_normalized': normalized_shape})
        for key in ('x', 'y', 'x_normalized'):
            if not _is_finite(batch.get(key)):
                raise ValidationFailure('SAMPLE_NONFINITE', f'MTGNN sample field {key} contains non-finite values.')
        return {'x_shape': x_shape, 'y_shape': y_shape, 'x_normalized_shape': normalized_shape}

    def validate_graph(self, extracted: Mapping[str, Any], probe: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        contexts = extracted.get('contexts')
        if not isinstance(contexts, Sequence) or len(contexts) != 1:
            raise ValidationFailure('GRAPH_EXTRACTION_FAILED', 'MTGNN must expose exactly one global learned graph.', 1, len(contexts or []))
        requested_index = int(probe['context']['index'])
        context = contexts[0]
        if requested_index != int(context.get('index', -1)):
            raise ValidationFailure('GRAPH_CONTEXT_MISSING', 'Requested MTGNN global graph does not exist.', 0, requested_index)
        n = len(config['dataset']['variables'])
        _validate_square_finite_matrix(context.get('learned_adjacency'), n, 'MTGNN learned adjacency')
        rows = _matrix_rows(context['learned_adjacency'])
        source, target = (int(probe['source']), int(probe['target']))
        weight = float(rows[source][target])
        if weight <= 0:
            raise ValidationFailure('RELATION_NOT_PRESENT', 'Declared MTGNN relation is not retained in the learned graph.', 'positive learned weight', weight)
        return {'context_count': 1, 'requested_global_graph': 0, 'matrix_shape': [n, n], 'requested_weight': weight, 'edge_count': int(context['edge_count'])}

    def identity_override(self, probe: Mapping[str, Any], config: Mapping[str, Any]) -> Mapping[str, Any]:
        return {'type': 'identity', 'context_index': 0}

    def intervention_override(self, probe: Mapping[str, Any], config: Mapping[str, Any], broader: bool=False) -> Mapping[str, Any]:
        if broader:
            raise ValueError('MTGNN has no broader native context beyond its single global learned graph.')
        return {'type': 'structural_edge_removal', 'context_index': 0, 'source': int(probe['source']), 'target': int(probe['target'])}

    def contexts(self, extracted: Mapping[str, Any]) -> list[Mapping[str, Any]]:
        return list(extracted['contexts'])

    def context_id(self, context: Mapping[str, Any]) -> str:
        return f"global_graph:{int(context['index'])}"

    def context_index(self, context: Mapping[str, Any]) -> int:
        return int(context['index'])

    def context_weight(self, context: Mapping[str, Any]) -> Any:
        return context['learned_adjacency']

    def context_graphs(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return {name: context[name] for name in ('learned_adjacency', 'transpose_adjacency')}

    def context_metadata(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return {'edge_count': int(context['edge_count']), 'subgraph_size': int(context['subgraph_size']), 'gcn_layer_count': int(context['gcn_layer_count']), 'construction': str(context['construction'])}

    def selection(self, model_name, dataset_name, relation, variables, context, broader):
        if broader:
            raise ValueError('MTGNN exposes only one global learned graph; broader context is unavailable.')
        sample, source, target, index = (int(relation['sample']), int(relation['source']), int(relation['target']), int(context['index']))
        return {'model': model_name, 'dataset': dataset_name, 'sample_id': f'test:{sample}', 'sample_index': sample, 'source': source, 'target': target, 'source_name': variables[source], 'target_name': variables[target], 'scope': 'local', 'context_type': 'global_graph', 'context_id': f'global_graph:{index}', 'context_index': index, 'candidate_scope': 'global_graph', 'candidate_id': f'quick:mtgnn:global:{source}->{target}', 'candidate_native_context_type': 'global_graph', 'candidate_retained_contexts': [0], 'candidate_identity': {}}

    def graph_effect_metadata(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return {'edge_count': int(context['edge_count']), 'subgraph_size': int(context['subgraph_size']), 'shared_across_gcn_layers': True}

OFFICIAL_ADAPTER_REGISTRY: dict[str, AdapterValidationSpec] = {'dgraformer': DGraFormerValidationSpec(), 'msgnet': MSGNetValidationSpec(), 'mtgnn': MTGNNValidationSpec()}

def _issue(code: str, message: str, expected: Any=None, found: Any=None) -> dict[str, Any]:
    return {'code': code, 'message': message, 'expected': _json_safe(expected), 'found': _json_safe(found)}

def _shape(value: Any) -> tuple[int, ...]:
    if value is None:
        return ()
    shape = getattr(value, 'shape', None)
    if shape is not None:
        return tuple((int(item) for item in shape))
    if isinstance(value, Sequence) and (not isinstance(value, (str, bytes, bytearray))):
        if not value:
            return (0,)
        child = _shape(value[0])
        if any((_shape(item) != child for item in value)):
            return (len(value),)
        return (len(value), *child)
    return ()

def _as_list(value: Any) -> Any:
    current = value
    for method in ('detach', 'cpu'):
        callback = getattr(current, method, None)
        if callable(callback):
            current = callback()
    callback = getattr(current, 'tolist', None)
    return callback() if callable(callback) else current

def _flatten(value: Any) -> list[float]:
    value = _as_list(value)
    if isinstance(value, Sequence) and (not isinstance(value, (str, bytes, bytearray))):
        result: list[float] = []
        for item in value:
            result.extend(_flatten(item))
        return result
    return [float(value)]

def _is_finite(value: Any) -> bool:
    try:
        return all((math.isfinite(item) for item in _flatten(value)))
    except (TypeError, ValueError):
        return False

def _matrix_rows(value: Any) -> list[list[float]]:
    converted = _as_list(value)
    if not isinstance(converted, Sequence):
        raise ValidationFailure('GRAPH_SHAPE_MISMATCH', 'Graph value is not a matrix.')
    return [[float(cell) for cell in row] for row in converted]

def _validate_square_finite_matrix(value: Any, n: int, label: str) -> None:
    shape = list(_shape(value))
    if shape != [n, n]:
        raise ValidationFailure('GRAPH_SHAPE_MISMATCH', f'{label} shape is incompatible.', [n, n], shape)
    if not _is_finite(value):
        raise ValidationFailure('GRAPH_NONFINITE', f'{label} contains non-finite values.')

def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, Sequence) and (not isinstance(value, (str, bytes, bytearray))):
        return [_json_safe(item) for item in value]
    converted = _as_list(value)
    if converted is not value:
        return _json_safe(converted)
    return str(value)
