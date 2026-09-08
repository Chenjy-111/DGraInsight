# Evaluation engine

The current user application is [DGraInsight Offline Evaluator](../offline_app/README.md).
Download the ready-to-extract package from [Releases](https://github.com/Chenjy-111/DGraInsight/releases/latest).

`evaluation.py`, `evaluation_validation.py`, `evaluation_plugins.py`, `thin_adapter.py`,
`model_specs.py`, and the shared model backends implement the current workflow.
The release builder copies these files directly, without extracting code from the historical audit validator.

Remaining Session v2 modules support reproduction of existing evidence and maintenance tests.
They are not included in the offline download. See the [compatibility boundary](../docs/AUDIT_SESSION_V2.md). The retired Audit wizard and root launchers have been removed.
