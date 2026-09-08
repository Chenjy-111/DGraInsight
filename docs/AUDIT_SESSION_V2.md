# Session v2 compatibility

The current portable evaluation format is `evaluation.v1`, described in the [Evaluation guide](EVALUATION_GUIDE.md). Built-in performance summaries use `performance.v1`.

The browser also accepts validated Session v2 files for graph inspection. These files do not provide current performance results: the interface reports those results as unavailable. Retained `dgraudit/v2/`, audit CLI commands, frozen inputs and fixtures allow recorded files to be validated and reproduced. Their version names do not indicate unused code.

The [Session v2 schema](../schemas/dgrainsight_audit_session_v2.schema.json) records model identity, contexts, case evidence, candidate families and provenance. Case-level formal inference must remain unavailable; any stored candidate-level inference belongs to this separate protocol. It must not be relabeled as current evaluation evidence.

```bash
python -m dgraudit.cli.validate_session_v2 path/to/session.json
npm run test:web-session-v2
npm run test:web-graph-regression
```

The retired audit launchers have been removed. The retained `configs/local_audit_*.json` / `configs/formal_audit_v2_*.json` are compatibility inputs. New evaluation work should use `configs/evaluation_*.json`. The schema and regression tests are the reference for compatibility behavior.
